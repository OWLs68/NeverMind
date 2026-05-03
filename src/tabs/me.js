// ============================================================
// me.js — Вкладка "Я" (тижневий/місячний огляд розвитку)
// ============================================================
// Винесено з evening.js у сесії QV1n2 (19.04.2026) в рамках Фази 0
// рефакторингу Вечора 2.0 (детальний план → docs/EVENING_2.0_PLAN.md).
//
// Містить:
//   • renderMe() — головний рендер вкладки Я
//   • renderMeActivityChart() — графік активності тижня
//   • refreshMeAnalysis() — AI-аналіз з 3 порадами
//   • sendMeChatMessage() / addMeChatMsg() — чат-бар вкладки Я
//
// Залежності: core/nav, core/utils, ai/core, tabs/tasks, tabs/habits,
//             tabs/notes, tabs/finance, tabs/projects, tabs/evening (getMoments)
// ============================================================

import { showToast, switchTab, currentTab } from '../core/nav.js';
import { escapeHtml, logRecentAction, extractJsonBlocks, parseContentChips, t } from '../core/utils.js';
import { callAI, callAIWithHistory, callAIWithTools, getAIContext, getMeStatsContext, getOWLPersonality, openChatBar, saveChatMsg, INBOX_TOOLS } from '../ai/core.js';
import { renderChips } from '../owl/chips.js';
import { UI_TOOLS_RULES, REMINDER_RULES } from '../ai/prompts.js';
import { dispatchChatToolCalls } from '../ai/tool-dispatcher.js';
import { shouldClarify } from '../owl/clarify-guard.js';
import { getTasks } from './tasks.js';
import { getHabits, getHabitLog, getHabitPct, getHabitStreak, processUniversalAction } from './habits.js';
import { getNotes } from './notes.js';
import { getMoments } from './evening.js';
import { getProjects } from './projects.js';
import { monthGenitive } from '../data/months.js';

// === ME TAB CHAT ===
let meChatHistory = [];

export async function sendMeChatMessage() {
  const input = document.getElementById('me-chat-input');
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  input.style.height = 'auto';
  input.focus();

  addMeChatMsg('user', text);
  meChatHistory.push({ role: 'user', content: text });

  const loadId = 'me-chat-load-' + Date.now();
  addMeChatMsg('agent', '…', false, loadId);

  const context = getAIContext();
  const stats = getMeStatsContext();
  const systemPrompt = `${getOWLPersonality()} Аналізуєш дані користувача і даєш чесний, корисний зворотній звʼязок. Відповіді — 2-4 речення, конкретно і по ділу. Відповідай українською. НЕ вигадуй факти яких немає в даних.
ЗАДАЧА = дія ЗРОБИТИ (save_task). ПОДІЯ = факт що СТАНЕТЬСЯ (create_event). "Перенеси подію" = edit_event.

${REMINDER_RULES}

Для CRUD дій — викликай відповідний tool. Для аналізу/відповіді — пиши текст.

${UI_TOOLS_RULES}${context ? '\n\n' + context : ''}${stats ? '\n\n' + stats : ''}`;

  // "Один мозок #2 A": INBOX_TOOLS (31) + UI tools — повний набір для CRUD і навігації.
  const msg = await callAIWithTools(systemPrompt, [...meChatHistory], INBOX_TOOLS, 'me-chat');
  const loadEl = document.getElementById(loadId);

  // Tool dispatch — через спільний dispatcher (UI tool OR CRUD через universal action)
  if (msg && Array.isArray(msg.tool_calls) && msg.tool_calls.length > 0) {
    if (loadEl) loadEl.remove();
    const guard = shouldClarify(text, msg.tool_calls, 'me');
    if (guard) {
      addMeChatMsg('agent', guard.question, false, '', guard.chips);
      return;
    }
    dispatchChatToolCalls(msg.tool_calls, (r, t) => addMeChatMsg(r, t), text);
    if (msg.content) {
      const { text: rt, chips } = parseContentChips(msg.content);
      if (rt) addMeChatMsg('agent', rt, false, '', chips);
      meChatHistory.push({ role: 'assistant', content: msg.content });
    }
    if (meChatHistory.length > 20) meChatHistory = meChatHistory.slice(-20);
    return;
  }

  // Fallback на існуючий текст-JSON флоу (CRUD через processUniversalAction)
  const rawReply = msg && msg.content ? msg.content : '';
  const { text: reply, chips: extractedChips } = parseContentChips(rawReply);

  // Розбиваємо AI-відповідь на окремі JSON блоки (кілька дій одразу).
  let handled = false;
  if (reply) {
    const blocks = extractJsonBlocks(reply);
    for (const parsed of blocks) {
      if (parsed.action && processUniversalAction(parsed, text, (r, t) => addMeChatMsg(r, t))) {
        handled = true;
      }
    }
    if (handled && loadEl) loadEl.textContent = '✅';
  }

  if (!handled) {
    if (loadEl) loadEl.remove();
    addMeChatMsg('agent', reply || t('me.chat.no_reply', 'Не вдалося отримати відповідь.'), false, '', extractedChips);
  }
  if (reply) meChatHistory.push({ role: 'assistant', content: reply });
  if (meChatHistory.length > 20) meChatHistory = meChatHistory.slice(-20);
}
export function renderMe() {
  const inbox = JSON.parse(localStorage.getItem('nm_inbox') || '[]');
  const now = new Date();
  const todayDow = (now.getDay() + 6) % 7; // 0=Пн

  // === СТРІК (дні поспіль з хоча б 1 записом) ===
  try {
    let streak = 0;
    for (let i = 0; i <= 60; i++) {
      const d = new Date(now); d.setDate(now.getDate() - i);
      const ds = d.toDateString();
      const hasRecord = inbox.some(item => new Date(item.ts).toDateString() === ds) ||
        getTasks().some(t => t.createdAt && new Date(t.createdAt).toDateString() === ds);
      if (hasRecord) streak++;
      else if (i > 0) break;
    }
    const badge = document.getElementById('me-streak-badge');
    const count = document.getElementById('me-streak-count');
    if (badge && count) {
      if (streak >= 2) { badge.style.display = 'flex'; count.textContent = streak; }
      else badge.style.display = 'none';
    }
  } catch(e) {}

  // === АКТИВНІ ПРОЕКТИ ===
  const projBlock = document.getElementById('me-projects-block');
  const projList = document.getElementById('me-projects-list');
  if (projBlock && projList) {
    let allProjects = [];
    try { allProjects = getProjects(); } catch(e) {}

    if (allProjects.length > 0) {
      projBlock.style.display = 'block';
      const weekAgo = Date.now() - 7 * 86400000;

      // Кроки виконані за тиждень для кожного проекту
      const projWithStats = allProjects.map(p => {
        const steps = p.steps || [];
        const done = steps.filter(s => s.done).length;
        const pct = steps.length > 0 ? Math.round(done / steps.length * 100) : (p.progress || 0);
        const stepsThisWeek = steps.filter(s => s.done && s.doneAt && s.doneAt >= weekAgo).length;
        const lastDoneAt = steps.filter(s => s.done && s.doneAt).reduce((max, s) => Math.max(max, s.doneAt), 0);
        const daysSince = lastDoneAt > 0 ? Math.floor((Date.now() - lastDoneAt) / 86400000) : null;
        const nextStep = steps.find(s => !s.done);
        return { p, steps, done, pct, stepsThisWeek, daysSince, nextStep };
      });

      // Сортування: спочатку ті що рухались цього тижня (DESC), потім інші
      projWithStats.sort((a, b) => b.stepsThisWeek - a.stepsThisWeek);

      // Загальний підсумок: скільки рухаються vs стоять
      const moving = projWithStats.filter(s => s.stepsThisWeek > 0).length;
      const stagnant = projWithStats.length - moving;
      const activeWord = allProjects.length === 1 ? t('me.proj.active_one', 'активний') : t('me.proj.active_many', 'активних');
      const movingWord = moving === 1 ? t('me.proj.moving_one', 'рухається') : t('me.proj.moving_many', 'рухаються');
      const stagnantWord = t('me.proj.stagnant', 'стоїть');
      const summaryHTML = `
        <div style="display:flex;justify-content:space-between;align-items:baseline;padding:7px 10px;background:rgba(255,255,255,0.55);border-radius:10px;margin-bottom:12px">
          <span style="font-size:11px;font-weight:700;color:rgba(30,16,64,0.5)">${allProjects.length} ${activeWord}</span>
          <span style="font-size:11px;font-weight:700">
            <span style="color:#16a34a">${moving} ${movingWord}</span>
            ${stagnant > 0 ? `<span style="color:rgba(30,16,64,0.4)"> · </span><span style="color:#c2410c">${stagnant} ${stagnantWord}</span>` : ''}
          </span>
        </div>`;

      const itemsHTML = projWithStats.slice(0, 5).map(({ p, pct, stepsThisWeek, daysSince, nextStep }) => {
        let trendChip = '';
        if (stepsThisWeek > 0) {
          const stepWord = stepsThisWeek === 1
            ? t('me.proj.step_one', 'крок')
            : stepsThisWeek < 5
              ? t('me.proj.step_few', 'кроки')
              : t('me.proj.step_many', 'кроків');
          trendChip = `<span style="font-size:10px;font-weight:700;color:#16a34a;margin-top:2px;display:block">+${stepsThisWeek} ${stepWord} ${t('me.proj.per_week', 'за тиждень')}</span>`;
        } else if (daysSince !== null && daysSince >= 7) {
          trendChip = `<span style="font-size:10px;font-weight:700;color:#c2410c;margin-top:2px;display:block">${t('me.proj.no_changes', '⏸ без змін {n} дн', { n: daysSince })}</span>`;
        } else if (daysSince === null) {
          trendChip = `<span style="font-size:10px;font-weight:700;color:rgba(30,16,64,0.4);margin-top:2px;display:block">${t('me.proj.just_created', 'щойно створений')}</span>`;
        }
        return `<div style="margin-bottom:10px;cursor:pointer" onclick="switchTab('projects')">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px">
            <div style="flex:1">
              <div style="font-size:13px;font-weight:700;color:#1e1040">${escapeHtml(p.name)}</div>
              ${p.subtitle ? `<div style="font-size:10px;color:rgba(30,16,64,0.4);margin-top:1px;font-weight:600">${escapeHtml(p.subtitle)}</div>` : ''}
              ${nextStep ? `<div style="font-size:10px;color:rgba(30,16,64,0.5);margin-top:2px;font-weight:600">→ ${escapeHtml(nextStep.text)}</div>` : ''}
              ${trendChip}
            </div>
            <div style="font-size:20px;font-weight:900;color:#7c4a2a;line-height:1;margin-left:8px">${pct}%</div>
          </div>
          <div style="height:4px;background:rgba(30,16,64,0.07);border-radius:3px;overflow:hidden">
            <div style="height:100%;width:${pct}%;background:#7c4a2a;border-radius:3px;transition:width 0.5s"></div>
          </div>
        </div>`;
      }).join('');

      projList.innerHTML = summaryHTML + itemsHTML;
    } else {
      projBlock.style.display = 'none';
    }
  }

  renderMeHeatmap();
  renderWeeklyInsights();
  renderMonthlyReport();

  // === ГРАФІК АКТИВНОСТІ ===
  renderMeActivityChart();
}

// === Helper: агрегат за вікно днів (звички + задачі + інбокс + настрій) ===
// Збирає СПРАВЖНІ цифри за період щоб AI не казав «не виконано» бо
// getMeStatsContext показує тільки сьогодні (баг знайдений 29.04.2026).
function _buildWindowContext(days) {
  const now = new Date();
  const habits = getHabits();
  const log = getHabitLog();
  const buildHabits = habits.filter(h => h.type !== 'quit');

  // Звички: для кожної рахуємо done/scheduled за вікно
  const habitLines = buildHabits.map(h => {
    let done = 0, scheduled = 0;
    for (let i = 0; i < days; i++) {
      const d = new Date(now); d.setDate(now.getDate() - i);
      const dow = (d.getDay() + 6) % 7;
      if (!(h.days || [0,1,2,3,4]).includes(dow)) continue;
      scheduled++;
      if (log[d.toDateString()]?.[h.id]) done++;
    }
    return `- "${h.name}": ${done} з ${scheduled} днів`;
  }).join('\n');

  // Quit-звички: скільки днів утримався
  const quitHabits = habits.filter(h => h.type === 'quit');
  const quitLines = quitHabits.map(h => {
    let abstained = 0;
    for (let i = 0; i < days; i++) {
      const d = new Date(now); d.setDate(now.getDate() - i);
      if (log[d.toDateString()]?.[h.id]) abstained++;
    }
    return `- "${h.name}" (відмова): ${abstained}/${days} днів утримання`;
  }).join('\n');

  // Закриті задачі за вікно
  const cutoff = Date.now() - days * 86400000;
  const doneTasks = getTasks().filter(t => t.status === 'done' && t.completedAt && t.completedAt >= cutoff).length;

  // Inbox-записи за вікно
  const inbox = JSON.parse(localStorage.getItem('nm_inbox') || '[]');
  const inboxCount = inbox.filter(i => i.ts >= cutoff).length;

  // Настрій (з nm_evening_mood якщо ведеться)
  let moodSummary = '';
  try {
    const moods = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(now); d.setDate(now.getDate() - i);
      const ds = d.toDateString();
      const saved = JSON.parse(localStorage.getItem('nm_evening_mood') || 'null');
      if (saved && saved.date === ds && saved.mood) moods.push(saved.mood);
    }
    if (moods.length > 0) moodSummary = `Настрій (записано ${moods.length} днів): ${moods.join(', ')}`;
  } catch {}

  const parts = [`=== РЕАЛЬНІ ДАНІ ЗА ОСТАННІ ${days} ДНІВ ===`];
  if (habitLines) parts.push(`🎯 ЗВИЧКИ (повторювані дії за днями тижня — рахується "виконано / заплановано на ці дні"):\n${habitLines}`);
  if (quitLines) parts.push(`🚫 ВІДМОВА ВІД ЗВИЧОК (днів утримання):\n${quitLines}`);
  parts.push(`✅ ЗАКРИТІ ЗАДАЧІ за ${days} днів (одноразові завдання, НЕ звички, НЕ плутати): ${doneTasks}`);
  parts.push(`📥 НОВИХ ЗАПИСІВ В INBOX за ${days} днів: ${inboxCount}`);
  if (moodSummary) parts.push(moodSummary);
  return parts.join('\n\n');
}

// === 🦉 ТИЖНЕВІ ІНСАЙТИ ВІД AI ===
// Один AI-виклик за тиждень → JSON {oneliner, patterns[], deepReport}.
// Зберігається у localStorage 'nm_me_weekly_insights'.
// Авто-генерується у неділю (день тижня = 6) або якщо нема свіжих даних 7+ днів.

const INSIGHTS_KEY = 'nm_me_weekly_insights';
let _insightsGenerating = false;

// B-113: Auto-refresh on data changes. Debounced 5s — burst of edits = 1 regen.
// If Me tab not active, mark cache stale; regen on next open.
let _insightsRegenTimer = null;
window.addEventListener('nm-data-changed', (e) => {
  // Skip own dispatches (insights save) — would loop.
  if (e.detail === 'insights') return;
  const isMeActive = currentTab === 'me';
  if (isMeActive) {
    clearTimeout(_insightsRegenTimer);
    _insightsRegenTimer = setTimeout(() => {
      generateWeeklyInsights();
    }, 5000);
  } else {
    try {
      const cached = _getInsights();
      if (cached) {
        cached.version = -1;
        localStorage.setItem(INSIGHTS_KEY, JSON.stringify(cached));
      }
    } catch {}
  }
});

function _getInsights() {
  try { return JSON.parse(localStorage.getItem(INSIGHTS_KEY) || 'null'); }
  catch { return null; }
}

const INSIGHTS_VERSION = 5; // bump якщо змінюється формат/контекст промпту
function _isInsightsStale(insights) {
  if (!insights || !insights.generatedAt) return true;
  if (insights.version !== INSIGHTS_VERSION) return true; // примусова перегенерація після фіксу контексту
  const ageMs = Date.now() - insights.generatedAt;
  return ageMs > 7 * 86400000;
}

function _formatInsightAge(ts) {
  const days = Math.floor((Date.now() - ts) / 86400000);
  if (days === 0) return t('me.weekly.age_today', 'сьогодні');
  if (days === 1) return t('me.weekly.age_yesterday', 'вчора');
  return t('me.weekly.age_days_ago', '{n} дн тому', { n: days });
}

async function generateWeeklyInsights() {
  if (_insightsGenerating) return;
  _insightsGenerating = true;
  try {
    const aiCtx = getAIContext();
    const stats = getMeStatsContext ? getMeStatsContext() : '';
    const systemPrompt = `${getOWLPersonality()} Ти аналізуєш дані юзера за минулий тиждень і повертаєш ТІЛЬКИ валідний JSON без markdown, без коментарів. Структура:
{"oneliner":"одне речення-підсумок тижня (12-20 слів, чесно — не лестощі)","patterns":["патерн 1 (10-15 слів про закономірність)","патерн 2","патерн 3"],"deepReport":"4-6 речень глибокого звіту: цифри, прогрес, проблеми, рекомендації"}
ВАЖЛИВО: пиши українською. НЕ вигадуй факти яких нема в даних. Якщо даних мало — все одно зроби короткий чесний звіт ("даних замало для патернів"). НЕ хвали без причини. Конкретика > загальні фрази.

⚠️ РОЗРІЗНЕННЯ СУТНОСТЕЙ — ЗАДАЧА ≠ ЗВИЧКА. ЦЕ КРИТИЧНО:
- 🎯 ЗВИЧКА — повторювана дія (бігати щодня, читати, ходити в зал). Рахується "X з Y днів" за тиждень.
- ✅ ЗАДАЧА — одноразове завдання (поприбирати в машині, заплатити штраф, подати декларацію). Або відкрита, або закрита.
- ❌ ЗАБОРОНЕНО плутати: якщо у даних "ЗАКРИТІ ЗАДАЧІ за 7 днів: 3" і "ЗВИЧКИ: Бігати щодня — 1 з 7 днів", НЕ кажи "ти закрив 3 задачі за тиждень" коли мав на увазі звички. І навпаки.
- ✅ ПРАВИЛЬНО цитуй джерело: "ти закрив 3 задачі" (з блоку ЗАКРИТІ ЗАДАЧІ) або "виконав звичку 3 з 7 днів" (з блоку ЗВИЧКИ).
- Якщо у даних нема ЗАКРИТИХ ЗАДАЧ — НЕ вигадуй їх з кількості виконаних звичок.

⚠️ ФОРМАТ МЕТРИК — ОБОВʼЯЗКОВО АБСОЛЮТНІ ЦИФРИ:
- ❌ ЗАБОРОНЕНО: "14%", "виконана на 43%", "лише 0%". Юзер не розуміє відсотки за який період.
- ✅ ПРАВИЛЬНО: "1 з 7 днів за тиждень", "0 з 4 днів", "3 з 7", "займався 3 з 7 днів".
- Для звичок завжди пиши "X з Y днів" — формат уже у даних.
- Можеш писати "жодного разу за тиждень", "всі 7 днів поспіль" — але без процентів.`;
    const windowCtx = _buildWindowContext(7);
    const userMsg = 'Згенеруй тижневі інсайти на основі даних. ОБОВʼЯЗКОВО використовуй РЕАЛЬНІ ЦИФРИ з секції "РЕАЛЬНІ ДАНІ ЗА ОСТАННІ 7 ДНІВ" — не кажи "не виконано жодної звички" якщо там видно цифри.\n\n' + windowCtx + (aiCtx ? '\n\n' + aiCtx : '') + (stats ? '\n\n' + stats : '');
    const reply = await callAI(systemPrompt, userMsg, {}, 'me-weekly-insights');
    if (!reply) return;
    // Витягти JSON з відповіді (іноді AI обгортає у ```json...```)
    const jsonMatch = reply.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return;
    const parsed = JSON.parse(jsonMatch[0]);
    if (!parsed.oneliner || !parsed.patterns) return;
    const insights = {
      version: INSIGHTS_VERSION,
      generatedAt: Date.now(),
      oneliner: String(parsed.oneliner).slice(0, 200),
      patterns: Array.isArray(parsed.patterns) ? parsed.patterns.slice(0, 3).map(p => String(p).slice(0, 200)) : [],
      deepReport: parsed.deepReport ? String(parsed.deepReport).slice(0, 1000) : '',
    };
    localStorage.setItem(INSIGHTS_KEY, JSON.stringify(insights));
    renderWeeklyInsights();
  } catch (e) {
    console.warn('[me-weekly-insights] generation failed:', e);
  } finally {
    _insightsGenerating = false;
  }
}

function renderWeeklyInsights() {
  const el = document.getElementById('me-weekly-insights');
  if (!el) return;
  const insights = _getInsights();
  const accent = '#7c4a2a';

  // Якщо немає або застаріло — плейсхолдер + запуск генерації у фоні
  if (_isInsightsStale(insights)) {
    el.style.display = 'block';
    el.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
        <span style="font-size:14px">🦉</span>
        <span style="font-size:11px;font-weight:800;color:${accent};text-transform:uppercase;letter-spacing:0.07em">${t('me.weekly.title', 'OWL знає тебе')}</span>
      </div>
      <div style="font-size:13px;color:rgba(30,16,64,0.5);font-style:italic">${t('me.insights.loading', 'Аналізую твій тиждень — інсайти зʼявляться за хвилину…')}</div>`;
    // Запускаємо генерацію (не чекаємо)
    setTimeout(() => { generateWeeklyInsights(); }, 800);
    return;
  }

  // Є свіжі — рендеримо
  el.style.display = 'block';
  const ageStr = _formatInsightAge(insights.generatedAt);
  const patternsHTML = (insights.patterns || []).map(p => `
    <div style="display:flex;gap:8px;font-size:12.5px;color:rgba(30,16,64,0.75);line-height:1.4;margin-top:6px">
      <span style="color:${accent};flex-shrink:0">•</span>
      <span>${escapeHtml(p)}</span>
    </div>`).join('');
  const deepHTML = insights.deepReport ? `
    <div style="margin-top:10px;padding-top:10px;border-top:1px solid rgba(124,74,42,0.12)">
      <div style="font-size:10px;font-weight:700;color:rgba(124,74,42,0.6);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px">${t('me.weekly.deep_report', 'Глибокий звіт')}</div>
      <div style="font-size:12.5px;color:rgba(30,16,64,0.75);line-height:1.5">${escapeHtml(insights.deepReport)}</div>
    </div>` : '';

  el.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
      <div style="display:flex;align-items:center;gap:8px">
        <span style="font-size:14px">🦉</span>
        <span style="font-size:11px;font-weight:800;color:${accent};text-transform:uppercase;letter-spacing:0.07em">${t('me.weekly.title', 'OWL знає тебе')}</span>
      </div>
      <span style="font-size:10px;color:rgba(30,16,64,0.35);font-weight:600">${ageStr}</span>
    </div>
    <div style="font-size:14px;font-weight:600;color:#1e1040;line-height:1.4">${escapeHtml(insights.oneliner)}</div>
    ${patternsHTML}
    ${deepHTML}`;
}

// === 📆 МІСЯЧНИЙ AI-ЗВІТ ===
// Генерується автоматично 1-го числа коли юзер відкриває Я.
// Показується з 1-го по 15-те число поточного місяця (звіт за попередній).
// Після 15-го — ховається щоб не засмічувати, дані лишаються у localStorage.

const MONTHLY_KEY = 'nm_me_monthly_report';
let _monthlyGenerating = false;

function _getMonthlyReport() {
  try { return JSON.parse(localStorage.getItem(MONTHLY_KEY) || 'null'); }
  catch { return null; }
}

function _prevMonthKey() {
  const now = new Date();
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;
}

function _prevMonthName() {
  const now = new Date();
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return monthGenitive(prev.getMonth());
}

async function generateMonthlyReport() {
  if (_monthlyGenerating) return;
  _monthlyGenerating = true;
  try {
    const aiCtx = getAIContext();
    const stats = getMeStatsContext ? getMeStatsContext() : '';
    const monthLabel = _prevMonthName();
    const systemPrompt = `${getOWLPersonality()} Ти робиш місячний звіт юзера за ПОПЕРЕДНІЙ місяць (${monthLabel}). Поверни ТІЛЬКИ валідний JSON без markdown:
{"oneliner":"одне речення-підсумок місяця (15-25 слів, чесно)","topActivities":["заняття 1","заняття 2","заняття 3"],"moodTrend":"рядок про настрій (1 речення)","projectsProgress":"рядок про прогрес проектів (1 речення)","financeNote":"рядок про фінанси якщо є дані, інакше пустий","patterns":["патерн 1","патерн 2"]}
ВАЖЛИВО: пиши українською. НЕ вигадуй цифр. Якщо даних мало — все одно зроби чесний короткий звіт. Конкретика > загальні фрази.`;
    const windowCtx = _buildWindowContext(30);
    const userMsg = `Згенеруй підсумок ${monthLabel} на основі даних. ОБОВʼЯЗКОВО використовуй РЕАЛЬНІ ЦИФРИ з секції "РЕАЛЬНІ ДАНІ ЗА ОСТАННІ 30 ДНІВ".\n\n${windowCtx}${aiCtx ? '\n\n' + aiCtx : ''}${stats ? '\n\n' + stats : ''}`;
    const reply = await callAI(systemPrompt, userMsg, {}, 'me-monthly-report');
    if (!reply) return;
    const jsonMatch = reply.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return;
    const parsed = JSON.parse(jsonMatch[0]);
    if (!parsed.oneliner) return;
    const report = {
      month: _prevMonthKey(),
      generatedAt: Date.now(),
      monthLabel,
      oneliner: String(parsed.oneliner).slice(0, 250),
      topActivities: Array.isArray(parsed.topActivities) ? parsed.topActivities.slice(0, 3).map(a => String(a).slice(0, 100)) : [],
      moodTrend: parsed.moodTrend ? String(parsed.moodTrend).slice(0, 200) : '',
      projectsProgress: parsed.projectsProgress ? String(parsed.projectsProgress).slice(0, 200) : '',
      financeNote: parsed.financeNote ? String(parsed.financeNote).slice(0, 200) : '',
      patterns: Array.isArray(parsed.patterns) ? parsed.patterns.slice(0, 3).map(p => String(p).slice(0, 200)) : [],
    };
    localStorage.setItem(MONTHLY_KEY, JSON.stringify(report));
    renderMonthlyReport();
  } catch (e) {
    console.warn('[me-monthly-report] generation failed:', e);
  } finally {
    _monthlyGenerating = false;
  }
}

function renderMonthlyReport() {
  const el = document.getElementById('me-monthly-report');
  if (!el) return;
  const now = new Date();
  const dayOfMonth = now.getDate();

  // Показуємо тільки з 1-го по 15-те число поточного місяця
  if (dayOfMonth > 15) {
    el.style.display = 'none';
    return;
  }

  const report = _getMonthlyReport();
  const expectedMonth = _prevMonthKey();

  // Якщо немає звіту за попередній місяць — генеруємо
  if (!report || report.month !== expectedMonth) {
    if (_monthlyGenerating) {
      el.style.display = 'block';
      el.innerHTML = `
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
          <span style="font-size:14px">📆</span>
          <span style="font-size:11px;font-weight:800;color:#16a34a;text-transform:uppercase;letter-spacing:0.07em">${t('me.monthly.title', 'Підсумок {month}', { month: _prevMonthName() })}</span>
        </div>
        <div style="font-size:13px;color:rgba(30,16,64,0.5);font-style:italic">${t('me.monthly.loading', 'Складаю місячний звіт…')}</div>`;
    } else {
      el.style.display = 'none';
      setTimeout(() => { generateMonthlyReport(); }, 1500); // після weekly insights
    }
    return;
  }

  // Є звіт за поточний попередній місяць — показуємо
  el.style.display = 'block';
  const greenAccent = '#16a34a';
  const sections = [];
  if (report.topActivities && report.topActivities.length > 0) {
    sections.push(`<div style="margin-top:8px"><span style="font-size:10px;font-weight:800;color:rgba(22,163,74,0.7);text-transform:uppercase;letter-spacing:0.06em">${t('me.monthly.top_activities', 'Топ занять')}</span>
      ${report.topActivities.map(a => `<div style="font-size:12.5px;color:rgba(30,16,64,0.75);margin-top:3px">• ${escapeHtml(a)}</div>`).join('')}
    </div>`);
  }
  if (report.moodTrend) sections.push(`<div style="font-size:12.5px;color:rgba(30,16,64,0.75);margin-top:8px"><span style="font-weight:700">${t('me.monthly.mood', 'Настрій:')}</span> ${escapeHtml(report.moodTrend)}</div>`);
  if (report.projectsProgress) sections.push(`<div style="font-size:12.5px;color:rgba(30,16,64,0.75);margin-top:6px"><span style="font-weight:700">${t('me.monthly.projects', 'Проекти:')}</span> ${escapeHtml(report.projectsProgress)}</div>`);
  if (report.financeNote) sections.push(`<div style="font-size:12.5px;color:rgba(30,16,64,0.75);margin-top:6px"><span style="font-weight:700">${t('me.monthly.finance', 'Фінанси:')}</span> ${escapeHtml(report.financeNote)}</div>`);
  if (report.patterns && report.patterns.length > 0) {
    sections.push(`<div style="margin-top:10px;padding-top:10px;border-top:1px solid rgba(22,163,74,0.15)">
      <span style="font-size:10px;font-weight:800;color:rgba(22,163,74,0.7);text-transform:uppercase;letter-spacing:0.06em">${t('me.monthly.patterns', 'Патерни')}</span>
      ${report.patterns.map(p => `<div style="font-size:12.5px;color:rgba(30,16,64,0.75);margin-top:3px">• ${escapeHtml(p)}</div>`).join('')}
    </div>`);
  }

  el.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
      <span style="font-size:14px">📆</span>
      <span style="font-size:11px;font-weight:800;color:${greenAccent};text-transform:uppercase;letter-spacing:0.07em">${t('me.monthly.title', 'Підсумок {month}', { month: report.monthLabel })}</span>
    </div>
    <div style="font-size:14px;font-weight:600;color:#1e1040;line-height:1.45">${escapeHtml(report.oneliner)}</div>
    ${sections.join('')}`;
}

function renderMeHeatmap() {
  const grid = document.getElementById('me-heatmap-grid');
  const legend = document.getElementById('me-heatmap-legend');
  if (!grid) return;

  const now = new Date();
  const habits = getHabits().filter(h => h.type !== 'quit');
  const log = getHabitLog();
  const accent = '#7c4a2a';
  const dowLabels = [t('dow_mon','Пн'),t('dow_tue','Вт'),t('dow_wed','Ср'),t('dow_thu','Чт'),t('dow_fri','Пт'),t('dow_sat','Сб'),t('dow_sun','Нд')];

  // 7 днів від найстарішого до сьогодні. Шкала заповнення = % виконаних дій
  // (звички призначені на dow + задачі що завершились того дня).
  const cells = [];
  let totalDone = 0;
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now); d.setDate(now.getDate() - i);
    const ds = d.toDateString();
    const dow = (d.getDay() + 6) % 7;
    const dayHabits = habits.filter(h => (h.days || [0,1,2,3,4]).includes(dow));
    const doneH = dayHabits.filter(h => !!log[ds]?.[h.id]).length;
    const doneT = getTasks().filter(t => t.status === 'done' && t.completedAt && new Date(t.completedAt).toDateString() === ds).length;
    const total = dayHabits.length + doneT;
    const done = doneH + doneT;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    totalDone += done;
    cells.push({ pct, done, total, day: d.getDate(), isToday: i === 0, dow });
  }

  grid.innerHTML = cells.map(c => {
    const border = c.isToday ? `2px solid ${accent}` : '1.5px solid rgba(30,16,64,0.10)';
    const fillH = Math.max(0, Math.min(100, c.pct));
    const labelColor = c.isToday ? accent : 'rgba(30,16,64,0.45)';
    const numColor = fillH >= 60 ? 'white' : 'rgba(30,16,64,0.7)';
    const tooltip = c.total > 0 ? t('day_done_total','{done}/{total} дій',{done:c.done,total:c.total}) : t('day_zero','0 дій');
    return `
      <div style="display:flex;flex-direction:column;align-items:center;gap:4px">
        <div style="font-size:9px;font-weight:700;color:${labelColor};text-transform:uppercase;letter-spacing:0.04em">${dowLabels[c.dow]}</div>
        <div title="${tooltip}" style="position:relative;width:100%;aspect-ratio:1;background:rgba(30,16,64,0.06);border-radius:6px;border:${border};overflow:hidden">
          <div style="position:absolute;left:0;right:0;bottom:0;height:${fillH}%;background:${accent};transition:height 0.4s ease"></div>
          <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:${numColor};z-index:1">${c.day}</div>
        </div>
      </div>
    `;
  }).join('');

  if (legend) legend.textContent = t('week_done_count','{n} дій',{n:totalDone});
}

// Два progress-кільця на сьогодні: задачі (виконані сьогодні / всі активні+закриті сьогодні)
// + звички (виконані сьогодні / призначені на сьогодні за днями тижня).
function renderMeActivityChart() {
  const chartEl = document.getElementById('me-activity-chart');
  const labelsEl = document.getElementById('me-activity-labels');
  const totalEl = document.getElementById('me-activity-total');
  if (!chartEl) return;
  if (labelsEl) labelsEl.innerHTML = '';
  if (totalEl) totalEl.textContent = '';

  const now = new Date();
  const todayDS = now.toDateString();
  const todayDow = (now.getDay() + 6) % 7;

  const allTasks = getTasks();
  const doneToday = allTasks.filter(t => t.status === 'done' && t.completedAt && new Date(t.completedAt).toDateString() === todayDS).length;
  const stillActive = allTasks.filter(t => t.status === 'active').length;
  const tasksTotal = doneToday + stillActive;
  const tasksDone = doneToday;

  const buildHabits = getHabits().filter(h => h.type !== 'quit');
  const todaysHabits = buildHabits.filter(h => (h.days || [0,1,2,3,4]).includes(todayDow));
  const log = getHabitLog();
  const habitsDone = todaysHabits.filter(h => !!log[todayDS]?.[h.id]).length;
  const habitsTotal = todaysHabits.length;

  const ringSVG = (done, total, color, label) => {
    const r = 38;
    const C = 2 * Math.PI * r;
    const pct = total > 0 ? Math.min(1, done / total) : 0;
    const dash = `${(C * pct).toFixed(1)} ${C.toFixed(1)}`;
    const text = total > 0 ? `${done}/${total}` : '—';
    const textColor = total > 0 ? color : 'rgba(30,16,64,0.3)';
    return `
      <div style="display:flex;flex-direction:column;align-items:center;gap:6px;flex:1">
        <svg width="92" height="92" viewBox="0 0 100 100" style="display:block">
          <circle cx="50" cy="50" r="${r}" fill="none" stroke="rgba(30,16,64,0.08)" stroke-width="9"/>
          <circle cx="50" cy="50" r="${r}" fill="none" stroke="${color}" stroke-width="9" stroke-linecap="round"
                  stroke-dasharray="${dash}" transform="rotate(-90 50 50)"
                  style="transition:stroke-dasharray 0.4s ease"/>
          <text x="50" y="52" text-anchor="middle" dominant-baseline="middle"
                font-size="19" font-weight="800" fill="${textColor}" font-family="inherit">${text}</text>
        </svg>
        <div style="font-size:11px;font-weight:700;color:rgba(30,16,64,0.55);text-transform:uppercase;letter-spacing:0.04em">${label}</div>
      </div>
    `;
  };

  chartEl.innerHTML = `
    <div style="display:flex;gap:10px;align-items:center;justify-content:center;padding:6px 0">
      ${ringSVG(tasksDone, tasksTotal, '#2fd0f9', t('me.chart.tasks', 'Задачі'))}
      ${ringSVG(habitsDone, habitsTotal, '#16a34a', t('me.chart.habits', 'Звички'))}
    </div>
  `;
}
async function refreshMeAnalysis() {
  const btn = document.getElementById('me-refresh-btn');
  const el = document.getElementById('me-ai-analysis');
  btn.textContent = '…';
  btn.disabled = true;
  el.textContent = '…';

  const inbox = JSON.parse(localStorage.getItem('nm_inbox') || '[]');
  const tasks = JSON.parse(localStorage.getItem('nm_tasks') || '[]');
  const notes = getNotes();
  const aiContext = getAIContext();
  const totalRecords = inbox.length + tasks.length + notes.length;

  if (totalRecords < 3) {
    el.textContent = t('me.analysis.too_few_records', 'Ще замало даних для аналізу. Додай кілька записів в Inbox, створи задачі або нотатки — і я дам тобі корисний аналіз.');
    btn.textContent = '↻';
    btn.disabled = false;
    return;
  }

  const dataNote = totalRecords < 10 ? 'УВАГА: даних мало, не роби глибоких висновків про особистість — просто опиши що бачиш і запропонуй що додати.' : '';
  const systemPrompt = `${getOWLPersonality()} Проаналізуй дані та дай короткий аналіз (3-5 речень) у своєму стилі. Що вдається добре і що можна покращити — конкретно. ${dataNote} Завершуй конкретною порадою. Відповідай українською.

ЗДОРОВ'Я у огляді (Фаза 5):
- Якщо є "Активні стани здоров'я" — включи коротку строку про дисципліну курсів (наприклад "Курс Омезу 85%, стан висипу — покращення, 2 пропуски за тиждень"). Але тільки якщо дані релевантні (є картки + є history за тиждень).
- НЕ ставь діагнозів, НЕ інтерпретуй симптоми.${aiContext ? '\n\n' + aiContext : ''}`;

  const userData = `Записів в Inbox: ${inbox.length}
Активних задач: ${tasks.filter(t=>t.status!=='done').length}
Виконаних задач: ${tasks.filter(t=>t.status==='done').length}
Нотаток: ${notes.length}
Останні 10 записів: ${inbox.slice(0,10).map(i=>`[${i.category}] ${i.text}`).join('; ')}`;

  const reply = await callAI(systemPrompt, userData, {}, 'me-profile-analysis');
  el.textContent = reply || t('me.analysis.no_reply', 'Не вдалось отримати аналіз. Спробуй ще раз.');
  btn.textContent = '↻';
  btn.disabled = false;

  if (reply && totalRecords >= 5) {
    const adviceEl = document.getElementById('me-ai-advice');
    const adviceBlock = document.getElementById('me-advice-block');
    if (adviceEl && adviceBlock) {
      adviceEl.textContent = '…';
      adviceBlock.style.display = 'block';
      const advicePrompt = `${getOWLPersonality()} На основі аналізу дай рівно 3 конкретні, практичні поради для цієї людини. Кожна порада — одне речення, максимально конкретна і дієва. Формат відповіді: "1. [порада]\n2. [порада]\n3. [порада]". Відповідай українською.${aiContext ? '\n\n' + aiContext : ''}`;
      const adviceReply = await callAI(advicePrompt, `Аналіз: ${reply}

Дані: ${userData}`, {}, 'me-advice');
      if (adviceReply) {
        adviceEl.innerHTML = adviceReply.split('\n').filter(l => l.trim()).map(l => `<div style="margin-bottom:8px">${escapeHtml(l.trim())}</div>`).join('');
      } else {
        adviceBlock.style.display = 'none';
      }
    }
  }
}
function showMeChatMessages() {
  openChatBar('me');
}

export function addMeChatMsg(role, text, _noSave = false, id = '', chips = null) {
  const el = document.getElementById('me-chat-messages');
  if (!el) return;
  if (role === 'agent') el.querySelectorAll('.chat-chips-row').forEach(n => n.remove());
  if (!_noSave) { try { openChatBar('me'); } catch(e) {} }
  const isAgent = role === 'agent';
  const div = document.createElement('div');
  div.style.cssText = `display:flex;${isAgent ? '' : 'justify-content:flex-end'}`;
  div.innerHTML = `<div ${id ? `id="${id}"` : ''} class="msg-bubble ${isAgent ? 'msg-bubble--agent' : 'msg-bubble--user'}">${escapeHtml(text)}</div>`;
  el.appendChild(div);
  if (isAgent && Array.isArray(chips) && chips.length > 0) {
    const chipsRow = document.createElement('div');
    chipsRow.className = 'chat-chips-row';
    renderChips(chipsRow, chips, 'me');
    el.appendChild(chipsRow);
  }
  // B-119 (UvEHE розкочення): rAF щоб iOS Safari порахував висоту chipsRow ДО scrollу.
  el.scrollTop = el.scrollHeight;
  requestAnimationFrame(() => { el.scrollTop = el.scrollHeight; });
  if (!_noSave) saveChatMsg('me', role, text);
}
// === WINDOW EXPORTS (HTML handlers only) ===
Object.assign(window, {
  sendMeChatMessage,
  showMeChatMessages,
  refreshMeAnalysis,
});
