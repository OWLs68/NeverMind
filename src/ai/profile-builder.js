// src/ai/profile-builder.js
//
// Фаза 6 OWL Reasoning V3 (xHQfi 30.04): Lazy Profile Builder.
//
// Раз на 24 години у фоні (requestIdleCallback) збирає дані юзера за 30 днів,
// надсилає один запит до OpenAI з інструкцією «знайди 5-7 довгострокових
// тенденцій». Відповідь зберігається у localStorage як nm_user_patterns.
//
// Інжектиться у getAIContext() як додаткова секція [ДОВГОСТРОКОВІ ПАТЕРНИ].
// До Supabase (Фаза 7) — клієнтський; пізніше переносимо у Edge Function cron.
//
// Принципи:
// - НЕ блокує UI (idle callback з fallback на setTimeout)
// - Дешево: один запит на 24 год = ~$0.001/юзер/місяць
// - Безпечно: помилка → залишається старий профіль; нема профілю → секція пуста

import { callAI } from './core.js';

const KEY_PATTERNS = 'nm_user_patterns';
const KEY_TS = 'nm_user_patterns_ts';
const REFRESH_MS = 24 * 60 * 60 * 1000; // 24 год
const _DAY_MS = 86400000;

// Збираємо дані за 30 днів — щоб patterns бачили ширшу картину ніж щоденний контекст
function _buildProfileSource() {
  const now = Date.now();
  const cutoff = now - 30 * _DAY_MS;
  const sections = [];

  try {
    const tasks = JSON.parse(localStorage.getItem('nm_tasks') || '[]');
    const closedRecent = tasks.filter(t => t.status === 'done' && t.completedAt >= cutoff);
    const stillOpen = tasks.filter(t => t.status !== 'done').length;
    sections.push(`Задачі за 30 днів: ${closedRecent.length} закрито, ${stillOpen} відкрито зараз. ` +
      `Закриті з пріоритетом high: ${closedRecent.filter(t => t.priority === 'high').length}.`);
    // Hours of completion to detect activity peaks
    const hours = closedRecent.map(t => new Date(t.completedAt).getHours()).filter(h => !isNaN(h));
    if (hours.length > 0) {
      const buckets = { ранок_6_12: 0, день_12_18: 0, вечір_18_23: 0, ніч_23_6: 0 };
      hours.forEach(h => {
        if (h >= 6 && h < 12) buckets.ранок_6_12++;
        else if (h >= 12 && h < 18) buckets.день_12_18++;
        else if (h >= 18 && h < 23) buckets.вечір_18_23++;
        else buckets.ніч_23_6++;
      });
      sections.push(`Години закриття задач: ${JSON.stringify(buckets)}.`);
    }
  } catch {}

  try {
    const habits = JSON.parse(localStorage.getItem('nm_habits2') || '[]');
    const log = JSON.parse(localStorage.getItem('nm_habit_log') || '{}');
    const habitStats = habits.filter(h => h.type !== 'quit').map(h => {
      let done = 0, scheduled = 0;
      for (let i = 0; i < 30; i++) {
        const d = new Date(now - i * _DAY_MS);
        const dow = (d.getDay() + 6) % 7;
        if (!(h.days || [0,1,2,3,4]).includes(dow)) continue;
        scheduled++;
        if (log[d.toDateString()]?.[h.id]) done++;
      }
      return `"${h.name}": ${done}/${scheduled}`;
    });
    if (habitStats.length > 0) {
      sections.push(`Звички за 30 днів: ${habitStats.join('; ')}.`);
    }
  } catch {}

  try {
    const finance = JSON.parse(localStorage.getItem('nm_finance') || '[]');
    const recentTx = finance.filter(t => t.ts >= cutoff);
    const expenseTx = recentTx.filter(t => t.fin_type === 'expense');
    if (expenseTx.length > 0) {
      const byCategory = {};
      expenseTx.forEach(t => {
        const cat = t.category || 'Інше';
        byCategory[cat] = (byCategory[cat] || 0) + (parseFloat(t.amount) || 0);
      });
      const topCats = Object.entries(byCategory).sort((a, b) => b[1] - a[1]).slice(0, 5);
      sections.push(`Топ-5 категорій витрат за 30 днів: ${topCats.map(([c, s]) => `${c}=${Math.round(s)}`).join(', ')}.`);
      sections.push(`Кількість транзакцій за 30 днів: ${expenseTx.length}.`);
    }
  } catch {}

  try {
    const moments = JSON.parse(localStorage.getItem('nm_moments') || '[]');
    const recentMoments = moments.filter(m => m.ts >= cutoff);
    if (recentMoments.length > 0) {
      const allText = recentMoments.map(m => (m.text || '') + ' ' + (m.note || '')).join(' ');
      const emotionMarkers = (allText.match(/(втомив|стрес|тривог|болить|радіс|щас|злий|сумно|виснаж|погано)/gi) || []).length;
      sections.push(`Моментів за 30 днів: ${recentMoments.length}. Маркерів емоцій: ${emotionMarkers}.`);
    }
  } catch {}

  try {
    const events = JSON.parse(localStorage.getItem('nm_events') || '[]');
    const eventsCount = events.length;
    sections.push(`Подій у календарі: ${eventsCount}.`);
  } catch {}

  return sections.join('\n');
}

async function _generatePatterns() {
  const source = _buildProfileSource();
  if (!source || source.length < 50) return null;

  const systemPrompt = `Ти аналізуєш поведінкові дані юзера у застосунку NeverMind за останні 30 днів.
ЗАВДАННЯ: знайти 5-7 ДОВГОСТРОКОВИХ ТЕНДЕНЦІЙ — патерни, які корисні для адаптації агента у наступних взаємодіях.

ФОРМАТ ВІДПОВІДІ — РІВНО валідний JSON без markdown:
{
  "patterns": [
    "Коротко (15-25 слів) — одна тенденція. Конкретно з даних: години активності, які звички тримаються/розвалюються, категорії витрат, тригери стресу.",
    "Друга тенденція...",
    ...
  ]
}

ВИМОГИ:
- 5-7 пунктів. НЕ менше, НЕ більше.
- УКРАЇНСЬКА мова. Без англійських термінів.
- КОНКРЕТНО з даних. НЕ загальні фрази типу «юзер активний». Цифри, назви категорій/звичок.
- БЕЗ оцінок ("молодець", "погано"). Тільки спостереження.
- БЕЗ повторень. Кожен пункт — окрема тенденція.

Приклад хорошого пункту: "Найактивніший період — ранок 6-12 (закриває 18 з 24 задач)."
Приклад поганого: "Юзер активний." (банально, без цифр)`;

  try {
    const reply = await callAI(systemPrompt, source, {}, 'profile-builder');
    if (!reply) return null;
    const jsonMatch = reply.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]);
    if (!parsed.patterns || !Array.isArray(parsed.patterns)) return null;
    return parsed.patterns.filter(p => typeof p === 'string' && p.length > 10).slice(0, 7);
  } catch (e) {
    console.warn('[profile-builder] generation error:', e);
    return null;
  }
}

// Публічна — викликається з boot.js (idle callback). Сама вирішує чи треба оновлювати.
export function buildProfileIfStale() {
  try {
    const ts = parseInt(localStorage.getItem(KEY_TS) || '0');
    if (Date.now() - ts < REFRESH_MS) return; // свіжий — пропускаємо

    const run = async () => {
      const patterns = await _generatePatterns();
      if (patterns && patterns.length > 0) {
        localStorage.setItem(KEY_PATTERNS, JSON.stringify(patterns));
        localStorage.setItem(KEY_TS, String(Date.now()));
        console.log(`[profile-builder] updated with ${patterns.length} patterns`);
      }
    };

    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(() => run(), { timeout: 10000 });
    } else {
      setTimeout(run, 5000);
    }
  } catch (e) {
    console.warn('[profile-builder] schedule error:', e);
  }
}

// Експорт getter — для інжекту у getAIContext()
export function getUserPatternsForContext() {
  try {
    const raw = localStorage.getItem(KEY_PATTERNS);
    if (!raw) return '';
    const patterns = JSON.parse(raw);
    if (!Array.isArray(patterns) || patterns.length === 0) return '';
    return `[ДОВГОСТРОКОВІ ПАТЕРНИ ЮЗЕРА за 30 днів] (для стилю спілкування і адаптації, не цитуй прямо):\n${patterns.map(p => `- ${p}`).join('\n')}`;
  } catch {
    return '';
  }
}

try { Object.assign(window, { buildProfileIfStale, getUserPatternsForContext }); } catch {}
