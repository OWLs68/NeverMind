// ============================================================
// app-ai-core.js — AI контекст, OpenAI API, chat storage
// Залежності: app-core.js
// ============================================================

import { currentTab, getProfile, showToast } from '../core/nav.js';
import { escapeHtml } from '../core/utils.js';
import { getTrash } from '../core/trash.js';
import { getInbox, _clearInboxUnreadBadge, addInboxChatMsg } from '../tabs/inbox.js';
import { getTasks, addTaskBarMsg } from '../tabs/tasks.js';
import { getHabits, getHabitLog } from '../tabs/habits.js';
import { getNotes, addNotesChatMsg, getNotesContext } from '../tabs/notes.js';
import { getFinance, getFinanceContext, addFinanceChatMsg } from '../tabs/finance.js';
import { getEvents, getTodayRoutine, getRoutine } from '../tabs/calendar.js';
import { getEveningMood, getMomentsContext, getEveningContext } from '../tabs/evening.js';
import { addEveningBarMsg } from '../tabs/evening-chat.js';
import { addMeChatMsg } from '../tabs/me.js';
import { getHealthContext, addHealthChatMsg } from '../tabs/health.js';
import { getProjectsContext, addProjectsChatMsg } from '../tabs/projects.js';
import { _getTabChatAHeight, _tabChatState, closeOwlChat } from '../owl/inbox-board.js';
import { getBoardContext } from '../owl/proactive.js';
import { formatFactsForContext, getFacts } from './memory.js';
import { getOWLPersonality, INBOX_SYSTEM_PROMPT, INBOX_TOOLS, getOwlChatSystemPrompt } from './prompts.js';
import { clearUnreadBadge, showUnreadBadge } from '../ui/unread-badge.js';
import { logUsage } from '../core/usage-meter.js';

// Backward-compat: re-export промптів з prompts.js — щоб 11 файлів
// які імпортують ці константи з './ai/core.js' продовжували працювати без змін.
export { getOWLPersonality, INBOX_SYSTEM_PROMPT, INBOX_TOOLS } from './prompts.js';

export let activeChatBar = null;
export function setActiveChatBar(v) { activeChatBar = v; }
// 4.5 (ROADMAP Блок 1) — таймстемп останнього закриття чату.
// Використовується у _judgeBoard щоб блокувати табло ще 10 сек після закриття —
// не дає OWL перезаписати табло над чатом, з якого юзер щойно вийшов.
export let lastChatClosedTs = 0;

// ===== 15. РОЗШИРЕНИЙ КОНТЕКСТ ШІ =====
// getOWLPersonality() перенесено у ./prompts.js (17.04.2026 сесія 14zLe)
// Re-exported вище для backward-compat.

export function getAIContext() {
  const profile = getProfile();
  const parts = [];

  // === ТИША (Фаза 3 OWL Silence Engine UVKL1 27.04.2026) ===
  // Якщо юзер увімкнув режим тиші через request_quiet — у промпт чатів
  // додається жорсткий прапорець «не нав'язуй нового». Чат лишається
  // доступним для прямих запитів («що я зробив?»), але сова не пропонує
  // наступних дій, не питає «що далі», не нагадує. Табло і Brain Pulse
  // вже заблоковані Judge Layer (shouldOwlSpeak) — це лише про ЧАТ.
  try {
    const silenceUntil = parseInt(localStorage.getItem('nm_owl_silence_until') || '0');
    if (silenceUntil > Date.now()) {
      const endTime = new Date(silenceUntil).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
      parts.push(`[ВАЖЛИВО — РЕЖИМ ТИШІ] Юзер попросив не турбувати до ${endTime}. ПРАВИЛА: відповідай прямо на питання юзера, давай конкретні факти ("що я закрив?" → перерахуй закриті задачі). АЛЕ НЕ пропонуй нових задач/звичок/дій, НЕ нагадуй про незавершене, НЕ питай "що далі" чи "хочеш ще". Якщо юзер просто щось коментує — підтверди коротко без пропозицій. Чіпи у відповідях — тільки нейтральні ("Зрозуміло", "Дякую"), без активних дій.`);
    }
  } catch (e) {}

  // === Дата і час ===
  const now = new Date();
  const days = ['неділя','понеділок','вівторок','середа','четвер','п\'ятниця','субота'];
  const months = ['січня','лютого','березня','квітня','травня','червня','липня','серпня','вересня','жовтня','листопада','грудня'];
  const timeStr = now.toLocaleTimeString('uk-UA', {hour:'2-digit', minute:'2-digit'});
  const tzName = Intl.DateTimeFormat().resolvedOptions().timeZone; // напр: Europe/Kiev
  const tzOffset = -now.getTimezoneOffset() / 60; // напр: +2 або +3
  const tzStr = `UTC${tzOffset >= 0 ? '+' : ''}${tzOffset} (${tzName})`;
  const dateStr = `${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}, ${timeStr}, часовий пояс: ${tzStr}`;
  parts.push(`Зараз: ${dateStr}`);

  // === Профіль і пам'ять ===
  if (profile) parts.push(`Профіль (з анкети налаштувань — ти вже це знаєш, НЕ перепитуй): ${profile}`);

  // === Розклад дня (з налаштувань — єдине джерело правди для ритму) ===
  try {
    const sRaw = JSON.parse(localStorage.getItem('nm_settings') || '{}');
    const sc = sRaw.schedule || {};
    if (sc.wakeUp || sc.workStart || sc.workEnd || sc.bedTime) {
      parts.push(`Розклад дня (з налаштувань): прокидається о ${sc.wakeUp || '?'}, починає активний день о ${sc.workStart || '?'}, завершує роботу о ${sc.workEnd || '?'}, лягає спати о ${sc.bedTime || '?'}. НЕ питай цей розклад — він уже заданий. Якщо юзер хоче змінити — сам скаже.`);
    }
  } catch(e) {}

  // Структуровані факти (nm_facts) — нова пам'ять з часовими мітками
  const factsStr = formatFactsForContext(30);
  if (factsStr) {
    parts.push(factsStr);
  } else {
    // Fallback на legacy текст поки міграція не пройшла (щоб AI не втрачав контекст)
    const legacyMemory = localStorage.getItem('nm_memory') || '';
    if (legacyMemory) {
      parts.push(`Довгостроковий профіль (ІСТОРИЧНИЙ, може бути застарілим — для стилю спілкування; НЕ цитуй поточний стан здоров'я/настрою):\n${legacyMemory}`);
    }
  }

  // === Активні задачі (з ID для зіставлення) ===
  const tasks = getTasks().filter(t => t.status === 'active').slice(0, 8);
  if (tasks.length > 0) {
    const taskList = tasks.map(t => {
      const steps = (t.steps || []);
      const doneSteps = steps.filter(s => s.done).length;
      const stepInfo = steps.length > 0 ? ` (${doneSteps}/${steps.length} кроків)` : '';
      const dueInfo = t.dueDate ? ` 📅${t.dueDate}` : '';
      const prioInfo = t.priority === 'critical' ? ' 🔴' : t.priority === 'important' ? ' 🟠' : '';
      return `- [ID:${t.id}] ${t.title}${stepInfo}${dueInfo}${prioInfo}`;
    }).join('\n');
    parts.push(`Активні задачі (використовуй ID для complete_task):\n${taskList}`);
  }

  // === Нещодавно закриті задачі (24 години) — щоб AI знав що вже зроблено ===
  const recentlyDone = getTasks().filter(t => t.status === 'done' && t.completedAt && (now - t.completedAt) < 24 * 60 * 60 * 1000).slice(0, 5);
  if (recentlyDone.length > 0) {
    parts.push(`[ФАКТ] Нещодавно ЗАКРИТІ задачі (вже виконані, НЕ нагадуй про них!):\n${recentlyDone.map(t => '- ✅ "' + t.title + '"').join('\n')}`);
  }

  // === Найближчі події та дедлайни (7 днів) ===
  try {
    const todayISO = now.toISOString().slice(0, 10);
    const in7 = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const isPassedToday = (ev) => {
      if (ev.date !== todayISO || !ev.time) return false;
      const endStr = ev.endTime || ev.time;
      const evMinutes = parseInt(endStr.slice(0, 2)) * 60 + parseInt(endStr.slice(3, 5));
      return evMinutes < nowMinutes;
    };
    const upcoming = [];
    const passedToday = [];
    getEvents().forEach(ev => {
      if (ev.date >= todayISO && ev.date <= in7) {
        const tStr = ev.time ? (ev.endTime ? ` о ${ev.time}–${ev.endTime}` : ` о ${ev.time}`) : '';
        if (isPassedToday(ev)) {
          passedToday.push(`- ✓ [ID:${ev.id}] "${ev.title}" — було сьогодні${tStr} (МИНУЛО, не нагадуй як майбутнє)`);
          return;
        }
        const diff = Math.round((new Date(ev.date + 'T00:00:00') - new Date(todayISO + 'T00:00:00')) / 86400000);
        const when = diff === 0 ? 'СЬОГОДНІ' : diff === 1 ? 'ЗАВТРА' : `через ${diff} дн`;
        upcoming.push(`- 📅 [ID:${ev.id}] "${ev.title}" — ${when}${tStr}`);
      }
    });
    // Всі події (не тільки 7 днів) — для редагування
    const allEvents = getEvents();
    const futureEvents = allEvents.filter(ev => ev.date >= todayISO && !isPassedToday(ev) && !upcoming.some(u => u.includes(ev.id)));
    if (futureEvents.length > 0) {
      futureEvents.slice(0, 10).forEach(ev => {
        const tStr = ev.time ? (ev.endTime ? ` о ${ev.time}–${ev.endTime}` : ` о ${ev.time}`) : '';
        upcoming.push(`- 📅 [ID:${ev.id}] "${ev.title}" — ${ev.date}${tStr}`);
      });
    }
    if (passedToday.length > 0) {
      parts.push(`[ФАКТ] Сьогодні вже МИНУЛІ події (не нагадуй про них як про майбутні):\n${passedToday.join('\n')}`);
    }
    getTasks().filter(t => t.status === 'active' && t.dueDate).forEach(t => {
      if (t.dueDate >= todayISO && t.dueDate <= in7) {
        const diff = Math.round((new Date(t.dueDate + 'T00:00:00') - new Date(todayISO + 'T00:00:00')) / 86400000);
        const when = diff === 0 ? 'СЬОГОДНІ' : diff === 1 ? 'ЗАВТРА' : `через ${diff} дн`;
        if (!upcoming.some(u => u.includes(t.title))) {
          upcoming.push(`- ⏰ "${t.title}" — дедлайн ${when}`);
        }
      }
    });
    if (upcoming.length > 0) {
      parts.push(`[ВАЖЛИВО] Найближчі події та дедлайни:\n${upcoming.join('\n')}\nНагадуй про них проактивно!`);
    }
  } catch(e) {}

  // === Звички сьогодні (з ID для зіставлення) ===
  const habits = getHabits();
  const log = getHabitLog();
  const today = now.toDateString();
  if (habits.length > 0) {
    const habitList = habits.map(h => {
      const done = !!log[today]?.[h.id];
      return `- [ID:${h.id}] "${h.name}": ${done ? '✓ виконано' : '✗ не виконано'}`;
    }).join('\n');
    parts.push(`Звички (використовуй ID для complete_habit):\n${habitList}`);

    // === Звички за останні 7 днів ===
    // Табло і всі чати бачать тижневий зріз — щоб OWL не казав «не виконано жодної»
    // коли реально 3/7. Рахуємо тільки заплановані дні (h.days), як у _buildWindowContext.
    try {
      const buildHabits = habits.filter(h => h.type !== 'quit');
      const weekLines = buildHabits.map(h => {
        let done = 0, scheduled = 0;
        for (let i = 0; i < 7; i++) {
          const d = new Date(now); d.setDate(now.getDate() - i);
          const dow = (d.getDay() + 6) % 7;
          if (!(h.days || [0,1,2,3,4]).includes(dow)) continue;
          scheduled++;
          if (log[d.toDateString()]?.[h.id]) done++;
        }
        const pct = scheduled > 0 ? Math.round(done / scheduled * 100) : 0;
        return `- "${h.name}": ${done}/${scheduled} (${pct}%)`;
      }).filter(Boolean).join('\n');
      const quitWeek = habits.filter(h => h.type === 'quit').map(h => {
        let abstained = 0;
        for (let i = 0; i < 7; i++) {
          const d = new Date(now); d.setDate(now.getDate() - i);
          if (log[d.toDateString()]?.[h.id]) abstained++;
        }
        return `- "${h.name}" (відмова): ${abstained}/7 днів утримання`;
      }).join('\n');
      const cutoff = Date.now() - 7 * 86400000;
      const doneTasksWeek = getTasks().filter(t => t.status === 'done' && t.completedAt && t.completedAt >= cutoff).length;
      const weekParts = [];
      if (weekLines) weekParts.push(`Звички за тиждень (виконано/заплановано):\n${weekLines}`);
      if (quitWeek) weekParts.push(`Відмова від звичок:\n${quitWeek}`);
      weekParts.push(`Закриті задачі за тиждень: ${doneTasksWeek}`);
      parts.push(`[РЕАЛЬНІ ДАНІ ЗА 7 ДНІВ — НЕ кажи "жодної звички не виконано" якщо тут видно цифри]\n${weekParts.join('\n')}`);
    } catch(e) {}
  }

  // === Записи Inbox за сьогодні (останні 8) ===
  const todayInbox = JSON.parse(localStorage.getItem('nm_inbox') || '[]')
    .filter(i => new Date(i.ts).toDateString() === today)
    .slice(0, 8);
  if (todayInbox.length > 0) {
    const inboxList = todayInbox.map(i => `- [${i.category}] ${i.text}`).join('\n');
    parts.push(`Записи сьогодні:\n${inboxList}`);
  }

  // === Фінанси ===
  try {
    const finCtx = getFinanceContext();
    if (finCtx) parts.push(finCtx);
  } catch(e) {}

  // === Здоров'я (Фаза 1, 15.04 jMR6m) — алергії + картки + ліки + прийоми ===
  // Принцип "один мозок": OWL бачить здоров'я у ВСІХ чатах (Inbox, Нотатки, Фінанси тощо),
  // а не лише у чат-барі Здоров'я. Алергії всередині — критичні правила попередження.
  try {
    const healthCtx = getHealthContext();
    if (healthCtx) parts.push(healthCtx);
  } catch(e) {}

  // === Проекти (18.04 pvZG1) — принцип "один мозок" для Проектів ===
  // Назва, % готовності, наступний крок, днів тиші. До 5 проектів.
  try {
    const projectsCtx = getProjectsContext();
    if (projectsCtx) parts.push(projectsCtx);
  } catch(e) {}

  // === Моменти дня (18.04 pvZG1) — що юзер зафіксував сьогодні ===
  // Ключове для вечірнього підсумку і емпатійних реакцій у чатах.
  try {
    const momentsCtx = getMomentsContext();
    if (momentsCtx) parts.push(momentsCtx);
  } catch(e) {}

  // === Вечірній зріз дня (19.04 Фаза 2 Вечора 2.0) — настрій, недороблені
  // задачі, закриті кроки проектів, quit-звички, минулі події, витрати дня.
  // Принцип "один мозок": сова на ВСІХ вкладках бачить вечірній контекст.
  try {
    const eveCtx = getEveningContext();
    if (eveCtx) parts.push(eveCtx);
  } catch(e) {}

  // === Нотатки (18.04 pvZG1) — щоб OWL не вигадував неіснуючі нотатки ===
  // Загальна кількість + розбивка по папках + 5 останніх з ID.
  try {
    const notesCtx = getNotesContext();
    if (notesCtx) parts.push(notesCtx);
  } catch(e) {}

  // === Кеш видалених (для restore_deleted) ===
  try {
    const trash = getTrash().filter(t => Date.now() - t.deletedAt < 7 * 24 * 60 * 60 * 1000);
    if (trash.length > 0) {
      const trashByType = {};
      trash.forEach(t => { trashByType[t.type] = (trashByType[t.type] || 0) + 1; });
      const summary = Object.entries(trashByType).map(([type, count]) => {
        const labels = { task:'задач', note:'нотаток', habit:'звичок', inbox:'записів', folder:'папок', finance:'операцій' };
        return `${count} ${labels[type] || type}`;
      }).join(', ');
      parts.push(`Кеш видалених (nm_trash): ${summary}. Щоб відновити — скажи "відновити всі задачі" або назву конкретного запису.`);
    }
  } catch(e) {}

  // === Останні повідомлення OWL на табло (Фаза 1.2 — синхронізація табло ↔ чат) ===
  // Чат бачить історію табло щоб відповіді були послідовними —
  // якщо OWL задав кілька питань підряд, AI розуміє на яке саме юзер відповідає.
  // Шар 2 "Один мозок V2" (rJYkw 21.04): читаємо з unified storage — бачимо
  // історію всіх вкладок, не тільки поточної.
  try {
    const tab = typeof currentTab !== 'undefined' ? currentTab : 'inbox';
    const unified = JSON.parse(localStorage.getItem('nm_owl_board_unified') || '[]');
    const msgs = Array.isArray(unified) ? unified : [];
    const recent = msgs.slice(0, 3).filter(m => m && m.text);
    if (recent.length > 0) {
      const formatted = recent.map(m => {
        const ago = Date.now() - (m.ts || m.id || 0);
        const mins = Math.floor(ago / 60000);
        const when = mins < 1 ? 'щойно' : mins < 60 ? mins + ' хв тому' : Math.floor(mins / 60) + ' год тому';
        return `[${when}] ${m.text}`;
      }).join('\n');
      parts.push(`OWL нещодавно казав на табло (вкладка "${tab}") — враховуй послідовність, не суперечь собі:\n${formatted}\n\nЯкщо користувач відповідає на це — це відповідь на повідомлення OWL, НЕ нова задача/нотатка.`);
    }
  } catch(e) {}

  // === Розпорядок дня (всі дні) ===
  try {
    const allRoutine = getRoutine();
    const dayLabels = { default:'Будні', mon:'Пн', tue:'Вт', wed:'Ср', thu:'Чт', fri:'Пт', sat:'Сб', sun:'Нд' };
    const filledDays = Object.keys(allRoutine).filter(k => allRoutine[k]?.length > 0);
    if (filledDays.length > 0) {
      const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
      const dayKeys = ['sun','mon','tue','wed','thu','fri','sat'];
      const todayKey = dayKeys[new Date().getDay()];
      const routineParts = filledDays.map(day => {
        const isToday = day === todayKey || (day === 'default' && !allRoutine[todayKey]);
        const blocks = allRoutine[day].sort((a, b) => a.time.localeCompare(b.time)).map(b => {
          const mark = isToday && (parseInt(b.time) * 60 + parseInt(b.time.split(':')[1] || 0)) <= nowMin ? '✓' : '';
          return `${b.time} ${b.activity}${mark}`;
        }).join(', ');
        return `${dayLabels[day] || day}${isToday ? ' (сьогодні)' : ''}: ${blocks}`;
      });
      // Знайти наступний блок сьогодні
      const todayBlocks = (allRoutine[todayKey] || allRoutine['default'] || []).sort((a, b) => a.time.localeCompare(b.time));
      const nextBlock = todayBlocks.find(b => {
        const [bh, bm] = b.time.split(':').map(Number);
        return bh * 60 + (bm || 0) > nowMin;
      });
      let nextHint = '';
      if (nextBlock) {
        const [bh, bm] = nextBlock.time.split(':').map(Number);
        const minsUntil = bh * 60 + (bm || 0) - nowMin;
        nextHint = `\n[НАСТУПНЕ ЗА РОЗКЛАДОМ] ${nextBlock.time} — ${nextBlock.activity} (через ${minsUntil} хв). Нагадай завчасно!`;
      }
      parts.push(`Розпорядок дня:\n${routineParts.join('\n')}${nextHint}\nМожеш копіювати, змінювати блоки через save_routine.`);
    }
  } catch(e) {}

  // === Настрій дня (смайлик "Як пройшов день?") ===
  const eveningMood = getEveningMood();
  if (eveningMood) {
    const moodLabels = { bad: '😔 погано', meh: '😐 так собі', ok: '🙂 нормально', good: '😄 добре', fire: '🔥 чудово' };
    parts.push(`Настрій дня (обрав користувач): ${moodLabels[eveningMood] || eveningMood}. Адаптуй тон: якщо погано — підтримай, якщо добре — підбадьор.`);
  }

  // Фаза 6 OWL V3 (xHQfi 30.04): довгострокові патерни юзера за 30 днів
  // (5-7 тенденцій, оновлюються раз на 24 год через requestIdleCallback).
  try {
    if (typeof window.getUserPatternsForContext === 'function') {
      const patternsBlock = window.getUserPatternsForContext();
      if (patternsBlock) parts.push(patternsBlock);
    }
  } catch {}

  return parts.join('\n\n');
}

export function getMeStatsContext() {
  // Короткий контекст — не більше 800 символів щоб не ламати JSON-режим
  const tasks = getTasks().filter(t => t.status === 'active').slice(0, 10);
  const habits = getHabits();
  const log = getHabitLog();
  const today = new Date().toDateString();

  const parts = [];
  if (tasks.length > 0) parts.push(`Задачі: ${tasks.map(t => t.title).join(', ')}`);
  if (habits.length > 0) {
    const habitStats = habits.map(h => {
      const doneToday = !!log[today]?.[h.id];
      return `${h.name}(${doneToday ? '✓' : '✗'})`;
    }).join(', ');
    parts.push(`Звички сьогодні: ${habitStats}`);
  }
  return parts.length > 0 ? parts.join('\n') : '';
}

// Захист від показу сирого JSON в чаті агента
// Якщо відповідь схожа на JSON — показуємо нейтральну фразу
export function safeAgentReply(reply, addMsg) {
  if (!reply) return;
  const trimmed = reply.trim();
  // Перевіряємо чи це JSON об'єкт або масив
  const looksLikeJson = (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
                        (trimmed.startsWith('[') && trimmed.endsWith(']'));
  if (looksLikeJson) {
    try {
      JSON.parse(trimmed);
      // Якщо парсинг вдався — це JSON, не показуємо
      addMsg('agent', 'Зроблено ✓');
      return;
    } catch(e) {
      // Не валідний JSON — показуємо як є
    }
  }
  addMsg('agent', reply);
}

// === OpenAI API === (ключ зберігається як nm_gemini_key — стара назва з часів Gemini)
// INBOX_SYSTEM_PROMPT перенесено у ./prompts.js (17.04.2026 сесія 14zLe)
// Re-exported вище для backward-compat.
// INBOX_TOOLS перенесено у ./prompts.js (17.04.2026 сесія 14zLe)
// Re-exported вище для backward-compat.



// === HTTP WRAPPER — єдине місце де робиться запит до AI ===
// Повертає message object { content?, tool_calls? } коли tools передані
// Повертає content string коли tools НЕ передані (backward compat)

// Helper: чи це мережева помилка яку можна ігнорувати у логах
// (Safari: "Load failed", Chrome: "Failed to fetch", Firefox: "NetworkError",
//  timeout abort: "AbortError"/"aborted"). Засмічують error-log без користі.
export function _isNetworkError(e) {
  if (!e) return false;
  if (e.name === 'AbortError') return true;
  const msg = e.message || String(e);
  return /Load failed|Failed to fetch|NetworkError|aborted|The operation was aborted/i.test(msg);
}

// B-101 fix (UVKL1 26.04): єдиний обробник «нема відповіді» у 9 чат-барах.
// callAIWithTools/callAIWithHistory ловлять усі винятки і повертають null —
// тому викликаючий код бачить `if (!reply)` для всіх причин (мережа/ключ/5xx).
// Замість туманного «Щось пішло не так» розрізняємо офлайн → конкретна порада.
export function handleChatError(addMsg) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    addMsg('agent', '📡 Мережа не відповіла. Перевір інтернет і повтори повідомлення.');
  } else {
    addMsg('agent', 'Щось пішло не так. Спробуй ще раз.');
  }
}

async function _fetchAI(messages, signal, tools, temperature = 0.7, module = 'unknown') {
  const key = localStorage.getItem('nm_gemini_key');
  if (!key) { showToast('⚙️ Введіть OpenAI API ключ у налаштуваннях', 3000); return null; }
  if (location.protocol === 'file:') { showToast('⚠️ Відкрий файл через сервер, не file://', 5000); return null; }
  const body = { model: 'gpt-4o-mini', messages, max_tokens: 400, temperature };
  if (tools && tools.length > 0) body.tools = tools;
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    showToast('❌ ' + (data?.error?.message || `Помилка ${res.status}`), 4000);
    return null;
  }
  const data = await res.json();
  if (data?.usage) logUsage(module, data.usage, data.model || 'gpt-4o-mini');
  const msg = data.choices?.[0]?.message;
  if (!msg) return null;
  // Якщо tools передані — повертаємо повний message object
  if (tools) return msg;
  // Інакше — backward compat, тільки content string
  return msg.content || null;
}

export async function callAI(systemPrompt, userMessage, contextData = {}, module = 'callAI') {
  const context = Object.keys(contextData).length > 0
    ? `\n\nКонтекст:\n${JSON.stringify(contextData, null, 2)}`
    : '';
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage + context }
  ];
  try {
    const text = await _fetchAI(messages, undefined, undefined, 0.7, module);
    if (text === null) return null;
    if (!text) { showToast('❌ Порожня відповідь від Агента', 3000); return null; }
    return text;
  } catch (e) {
    if (e.message === 'Load failed' || e.message.includes('Failed to fetch')) {
      showToast('❌ Мережева помилка. Перевір інтернет', 4000);
    } else {
      showToast('❌ ' + e.message, 4000);
    }
    return null;
  }
}

// === OWL MINI-CHAT — окремий AI виклик ===
export async function callOwlChat(userText) {
  const key = localStorage.getItem('nm_gemini_key');
  if (!key) return null;

  const context = getBoardContext('inbox');
  const chatHistory = JSON.parse(localStorage.getItem('nm_owl_chat') || '[]');

  // G12 — мікро-розмови: тільки 3-4 останніх обміни (8 повідомлень)
  // замість 6 (12). Менше історії = менше зациклень на старій темі.
  const recentChat = chatHistory.slice(-8).map(m => ({
    role: m.role === 'user' ? 'user' : 'assistant',
    content: m.text
  }));
  const systemPrompt = getOwlChatSystemPrompt(context);


  const messages = [
    { role: 'system', content: systemPrompt },
    ...recentChat,
    { role: 'user', content: userText }
  ];

  try {
    const reply = await _fetchAI(messages, undefined, undefined, 0.7, 'owl-mini-chat');
    return reply;
  } catch(e) {
    return null;
  }
}

export async function callAIWithHistory(systemPrompt, history, module = 'callAIWithHistory') {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000); // 25 сек таймаут
  try {
    const messages = [{ role: 'system', content: systemPrompt }, ...history];
    const reply = await _fetchAI(messages, controller.signal, undefined, 0.7, module);
    clearTimeout(timeout);
    return reply;
  } catch(e) {
    clearTimeout(timeout);
    if (!_isNetworkError(e)) console.error('callAIWithHistory error:', e);
    return null;
  }
}

// === V3 Фаза 1.5 — Dynamic Tool Loading (фільтрація 60→15 tools по контексту) ===
// Regex-класифікатор економить токени (~30-40% на запит) + зменшує Context Window
// Bloat коли всі 60 tools передаються у промпт.
// Базові tools завжди включаються (модель може потребувати їх для будь-якого запиту).
// Якщо матч слабкий — fallback на повний набір (через `keepFullThreshold`).
const _BASE_TOOL_NAMES = new Set([
  'save_memory_fact', 'save_task', 'save_note', 'save_finance', 'create_event', 'clarify',
  'switch_tab', 'request_quiet'
]);

const _TOOL_CATEGORIES = {
  finance: {
    rx: /\b(гр(н|івн)|€|\$|usd|usdt|eur|витрат|дохо|купив|оплат|плат[іиї]|ціна|сума|бюджет|категор[іи]|підкатегор|зарплат|грош|каса|платіж)/i,
    tools: ['save_finance', 'update_transaction', 'delete_transaction', 'set_finance_budget', 'add_finance_category', 'rename_finance_category', 'delete_finance_category', 'add_finance_subcategory', 'rename_finance_subcategory', 'delete_finance_subcategory', 'set_finance_period', 'open_finance_analytics']
  },
  habit: {
    rx: /\b(звичк|щодня|повторюй|кожен ?(день|ранок|вечір)|трекер|стрік|streak)/i,
    tools: ['save_habit', 'edit_habit', 'delete_habit', 'complete_habit']
  },
  task: {
    rx: /\b(задач|треба зробити|нагада[йт]|напомни|зроби|купи|відправ|зателефонуй|написати|подати|оплатити|закрив|зробив|поприбирай|поміняй)/i,
    tools: ['save_task', 'edit_task', 'delete_task', 'complete_task', 'reopen_task', 'add_step', 'set_reminder']
  },
  event: {
    rx: /\b(подія|подію|зустріч|прийом|приїзд|концерт|рейс|тренуван|відміни|відмін|перенес|завтра|післязавтра|сьогодні о|у (понеділ|вівтор|серед|четвер|пятниц|субот|неділ))/i,
    tools: ['create_event', 'edit_event', 'delete_event', 'open_calendar']
  },
  health: {
    rx: /\b(болить|симптом|лікар|тиск|пігулк|таблетк|шкір|алерг|тренуван|травм|діагно|алерг|висип)/i,
    tools: ['create_health_card', 'edit_health_card', 'delete_health_card', 'add_health_history_entry', 'export_health_card']
  },
  note: {
    rx: /\b(нотатк|запиши думк|щоден|рефлекс|папк[уи])/i,
    tools: ['save_note', 'edit_note', 'move_note', 'delete_folder']
  },
  project: {
    rx: /\b(проект|ремонт|запуск|розробк|організац|крок проект|етап|віх|milestone|метрик|ризик)/i,
    tools: ['create_project', 'complete_project_step', 'add_project_step', 'update_project_progress', 'add_project_decision', 'add_project_metric', 'add_project_resource', 'update_project_tempo', 'update_project_risks']
  },
  moment: {
    rx: /\b(момент|щойно|поїхав|зустрів(ся|ла)|побачив|був на)/i,
    tools: ['save_moment']
  },
  routine: {
    rx: /\b(розклад|розпорядок|прокидаюсь|лягаю|режим дня)/i,
    tools: ['save_routine']
  },
  trash: {
    rx: /\b(відновити|повернути назад|з кошика|undo|поверни)/i,
    tools: ['restore_deleted']
  },
  memory: {
    rx: /\b(запамʼятай|що ти про мене|памʼять|memory)/i,
    tools: ['save_memory_fact', 'open_memory']
  },
  ui: {
    rx: /\b(відкрий|покажи|перейди|переключи|режим тиші|дай спокій|не доставай|тренер|партнер|ментор)/i,
    tools: ['switch_tab', 'open_settings', 'set_owl_mode', 'request_quiet']
  }
};

export function selectRelevantTools(userText, fullTools) {
  if (!userText || typeof userText !== 'string' || !Array.isArray(fullTools)) return fullTools;
  const text = userText.toLowerCase();
  const matched = new Set();
  let hits = 0;
  for (const cat of Object.values(_TOOL_CATEGORIES)) {
    if (cat.rx.test(text)) {
      hits++;
      cat.tools.forEach(n => matched.add(n));
    }
  }
  // Якщо нема матчу або матчів забагато (>4 категорій — амбівалентний запит) — повний набір.
  if (hits === 0 || hits > 4) return fullTools;
  // Завжди додаємо базові tools.
  _BASE_TOOL_NAMES.forEach(n => matched.add(n));
  const filtered = fullTools.filter(t => matched.has(t.function?.name));
  // Sanity check — мінімум 5 tools має лишитись.
  return filtered.length >= 5 ? filtered : fullTools;
}

// === callAIWithTools — tool calling для Inbox ===
// Повертає message object { content?, tool_calls? } або null
// Temperature 0.2 — класифікація має бути стабільною, не творчою
// `module` — ідентифікатор для лічильника витрат (inbox/tasks-bar/notes-bar тощо).
// V3 Фаза 1.5 — авто-фільтрація tools на основі останньої репліки юзера у history.
export async function callAIWithTools(systemPrompt, history, tools, module = 'callAIWithTools') {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);
  try {
    // Витягуємо останній user message для класифікатора.
    const lastUser = [...history].reverse().find(m => m.role === 'user');
    const userText = lastUser ? (typeof lastUser.content === 'string' ? lastUser.content : '') : '';
    const filteredTools = selectRelevantTools(userText, tools);
    // Лог для діагностики ефективності класифікатора (перші 2 тижні моніторити).
    if (Array.isArray(tools) && filteredTools.length < tools.length) {
      try {
        const log = JSON.parse(localStorage.getItem('nm_tool_filter_log') || '[]');
        log.unshift({ ts: Date.now(), module, full: tools.length, picked: filteredTools.length, text: userText.slice(0, 80) });
        localStorage.setItem('nm_tool_filter_log', JSON.stringify(log.slice(0, 50)));
      } catch {}
    }
    const messages = [{ role: 'system', content: systemPrompt }, ...history];
    const msg = await _fetchAI(messages, controller.signal, filteredTools, 0.2, module);
    clearTimeout(timeout);
    return msg;
  } catch(e) {
    clearTimeout(timeout);
    if (!_isNetworkError(e)) console.error('callAIWithTools error:', e);
    return null;
  }
}

// === CHAT STORAGE — зберігає чати по вкладках ===
const CHAT_STORE_MAX = 30; // максимум повідомлень на вкладку
const CHAT_STORE_KEYS = {
  inbox:    'nm_chat_inbox',
  tasks:    'nm_chat_tasks',
  notes:    'nm_chat_notes',
  me:       'nm_chat_me',
  evening:  'nm_chat_evening',
  finance:  'nm_chat_finance',
  health:   'nm_chat_health',
  projects: 'nm_chat_projects',
};

export function saveChatMsg(tab, role, text, chips) {
  if (role === 'typing') return;
  const key = CHAT_STORE_KEYS[tab];
  if (!key) return;
  try {
    const msgs = JSON.parse(localStorage.getItem(key) || '[]');
    const entry = { role, text, ts: Date.now() };
    if (Array.isArray(chips) && chips.length > 0) entry.chips = chips;
    msgs.push(entry);
    if (msgs.length > CHAT_STORE_MAX) msgs.splice(0, msgs.length - CHAT_STORE_MAX);
    localStorage.setItem(key, JSON.stringify(msgs));
    if (role === 'user') window.dispatchEvent(new CustomEvent('nm-data-changed', { detail: 'chat' }));
  } catch(e) {
    // Phase 5 Шар 6 (04.05): не глитаємо QuotaExceededError мовчки.
    // Council Critic Р7: silent catch → юзер бачить "повідомлення зникають
    // при reload" без розуміння чому. Тепер console.warn + один раз on-screen
    // toast щоб юзер знав що localStorage iPhone заповнений.
    if (e && (e.name === 'QuotaExceededError' || e.code === 22 || e.code === 1014)) {
      console.error('[saveChatMsg] QuotaExceededError у', key, '— iPhone localStorage переповнений');
      try {
        if (!window._nm_quota_warned) {
          window._nm_quota_warned = true;
          import('../core/nav.js').then(m => m.showToast && m.showToast('⚠️ Памʼять застосунку переповнена. Очисти старі чати у Налаштуваннях.', 6000));
        }
      } catch {}
    } else {
      console.warn('[saveChatMsg] write failed у', key, e);
    }
  }
}

export function loadChatMsgs(tab) {
  const key = CHAT_STORE_KEYS[tab];
  if (!key) return [];
  try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; }
}

// === КРОС-ЧАТОВА ПАМ'ЯТЬ (Шар 2 "Один мозок V2" Фаза 2 — rJYkw 21.04.2026) ===
// Повертає останні N повідомлень з БУДЬ-якого чату (крім excludeTab) за вікно часу.
// Дає мозку побачити що юзер обговорював на ІНШИХ вкладках — щоб не забувати
// контекст "ти на Здоровʼї, а в Inbox 5 хв тому було 'болить спина'".
const _ALL_CHAT_TABS = ['inbox','tasks','notes','me','evening','finance','health','projects'];
const _TAB_LABELS_CHAT = { inbox:'Inbox', tasks:'Продуктивність', notes:'Нотатки', me:'Я', evening:'Вечір', finance:'Фінанси', health:"Здоров'я", projects:'Проекти' };
export function getRecentChatsAcrossTabs(excludeTab, limit = 5, windowMs = 60 * 60 * 1000) {
  const now = Date.now();
  const all = [];
  _ALL_CHAT_TABS.filter(t => t !== excludeTab).forEach(t => {
    const key = 'nm_chat_' + t;
    let msgs = [];
    try { msgs = JSON.parse(localStorage.getItem(key) || '[]'); } catch {}
    // Шар 3 (ZJmdF 21.04.2026): беремо останні 5 з кожного чату (було 3)
    msgs.slice(-5).forEach(m => {
      if (m && m.ts && (now - m.ts) < windowMs && m.text) {
        all.push({ role: m.role, text: m.text, ts: m.ts, tab: t, tabLabel: _TAB_LABELS_CHAT[t] || t });
      }
    });
  });
  all.sort((a, b) => b.ts - a.ts);
  return all.slice(0, limit);
}

// === addMsgForTab — універсальний диспатчер для проактивних повідомлень агента ===
// Використовується followups.js щоб писати в контекстний чат ("один мозок на все")
// Не відкриває чат-бар, не спамить DOM при закритому барі — надійно зберігає в localStorage
// і синхронізує DOM якщо чат уже був відновлений (юзер відкривав бар у цій сесії)
// Кнопки "Надіслати" для червоної крапки непрочитаних.
// Inbox і Evening вже мають власні виклики у своїх add-функціях (backward-compat).
const SEND_BTN_MAP = {
  tasks:    'tasks-send-btn',
  notes:    'notes-send-btn',
  me:       'me-send-btn',
  finance:  'finance-send-btn',
  health:   'health-send-btn',
  projects: 'projects-send-btn',
};

export function addMsgForTab(tab, role, text, chips = null) {
  // MPVly 05.05 — 4-й параметр chips (Council Agent 1+3 знахідка): проактивні
  // повідомлення (Brain Pulse, followups, OWL board) не передавали chips →
  // Inbox й 7 інших чатів втрачали кнопки у localStorage + DOM.
  // Inbox — спеціальний: addInboxChatMsg сам зберігає + показує бейдж
  if (tab === 'inbox') {
    addInboxChatMsg(role, text, chips);
    return;
  }
  // Інші вкладки: зберігаємо у localStorage (при відкритті чат-бара restoreChatUI прочитає)
  saveChatMsg(tab, role, text, chips);
  // Якщо DOM контейнер уже був відновлений (юзер відкривав бар) — додаємо у DOM зараз
  const containerMap = {
    tasks:    'tasks-chat-messages',
    notes:    'notes-chat-messages',
    me:       'me-chat-messages',
    evening:  'evening-bar-messages',
    finance:  'finance-chat-messages',
    health:   'health-chat-messages',
    projects: 'projects-chat-messages',
  };
  // me має сигнатуру (role, text, _noSave, id, chips) — позиція 5; решта (role, text, _noSave, chips) — 4.
  const renderMap = {
    tasks:    (r, t, c) => addTaskBarMsg(r, t, true, c),
    notes:    (r, t, c) => addNotesChatMsg(r, t, true, c),
    me:       (r, t, c) => addMeChatMsg(r, t, true, '', c),
    evening:  (r, t, c) => addEveningBarMsg(r, t, true, c),
    finance:  (r, t, c) => addFinanceChatMsg(r, t, true, c),
    health:   (r, t, c) => addHealthChatMsg(r, t, true, c),
    projects: (r, t, c) => addProjectsChatMsg(r, t, true, c),
  };
  const el = document.getElementById(containerMap[tab]);
  if (el && el.dataset.restored && renderMap[tab]) {
    renderMap[tab](role, text, chips);
  }
  // Універсальний бейдж непрочитаних для всіх вкладок з чат-баром.
  // Evening має локальний виклик у addEveningBarMsg — не дублюємо щоб не було +2.
  if (role === 'agent' && tab !== 'evening' && SEND_BTN_MAP[tab]) {
    const bar = document.getElementById(tab + '-ai-bar');
    const chatWin = bar ? bar.querySelector('.ai-bar-chat-window') : null;
    const isOpen = chatWin && chatWin.classList.contains('open');
    if (!isOpen) showUnreadBadge(tab, SEND_BTN_MAP[tab]);
  }
}

export function restoreChatUI(tab) {
  const containerMap = {
    inbox:    'inbox-chat-messages',
    tasks:    'tasks-chat-messages',
    notes:    'notes-chat-messages',
    me:       'me-chat-messages',
    evening:  'evening-bar-messages',
    finance:  'finance-chat-messages',
    health:   'health-chat-messages',
    projects: 'projects-chat-messages',
  };
  // chips підтримуються у всіх 7 чатів (Phase 1 Шар 6 04.05 RGisY — Р1 фікс).
  // me має 5-й параметр (id посередині — '' дефолт), решта 4-й.
  const addMsgMap = {
    tasks:    (r,t,c) => addTaskBarMsg(r,t,true,c),
    notes:    (r,t,c) => addNotesChatMsg(r,t,true,c),
    me:       (r,t,c) => addMeChatMsg(r,t,true,'',c),
    evening:  (r,t,c) => addEveningBarMsg(r,t,true,c),
    finance:  (r,t,c) => addFinanceChatMsg(r,t,true,c),
    health:   (r,t,c) => addHealthChatMsg(r,t,true,c),
    projects: (r,t,c) => addProjectsChatMsg(r,t,true,c),
  };
  const containerId = containerMap[tab];
  if (!containerId) return;
  const el = document.getElementById(containerId);
  if (!el || el.dataset.restored) return; // вже відновлено
  el.dataset.restored = '1';
  const msgs = loadChatMsgs(tab);

  if (msgs.length === 0) {
    // Немає збереженої історії — показуємо welcome тільки для inbox
    if (tab === 'inbox') {
      const div = document.createElement('div');
      div.style.cssText = 'display:flex';
      div.innerHTML = `<div style="background:rgba(255,255,255,0.12);color:white;border-radius:4px 14px 14px 14px;padding:5px 10px;font-size:13px;font-weight:500;line-height:1.5;max-width:85%">Привіт! Напиши що завгодно — я розберусь 👋</div>`;
      el.appendChild(div);
    }
    return;
  }

  // Є збережена історія — додаємо розділювач і відновлюємо
  const sep = document.createElement('div');
  sep.style.cssText = 'display:flex;align-items:center;gap:8px;margin:4px 0 8px;opacity:0.4';
  sep.innerHTML = `<div style="flex:1;height:1px;background:rgba(255,255,255,0.2)"></div><div style="font-size:10px;color:rgba(255,255,255,0.6);white-space:nowrap;font-weight:600;text-transform:uppercase;letter-spacing:0.06em">Попередня розмова</div><div style="flex:1;height:1px;background:rgba(255,255,255,0.2)"></div>`;
  el.appendChild(sep);

  if (tab === 'inbox') {
    msgs.forEach(m => _renderInboxChatMsg(m.role, m.text, el, m.chips));
  } else if (addMsgMap[tab]) {
    msgs.forEach(m => addMsgMap[tab](m.role, m.text, m.chips));
  }
}

// Внутрішній рендер без запису в storage (щоб не дублювати при відновленні)
function _renderInboxChatMsg(role, text, el, chips = null) {
  const isAgent = role === 'agent';
  // MPVly 05.05 fix: cleanup попередніх chips ПЕРЕД appending нового agent повідомлення.
  // Live addInboxChatMsg це робить (рядок 46), але restore (цей шлях) пропускав → всі
  // історичні chips накопичувались на екрані. Тепер restore matchиться live: лишається
  // тільки chips ОСТАННЬОГО agent повідомлення.
  if (isAgent) el.querySelectorAll('.chat-chips-row').forEach(n => n.remove());
  const div = document.createElement('div');
  div.style.cssText = `display:flex;${isAgent ? 'gap:8px;align-items:flex-start' : 'justify-content:flex-end'}`;
  if (isAgent) {
    div.innerHTML = `<div style="background:rgba(255,255,255,0.12);color:white;border-radius:4px 14px 14px 14px;padding:8px 12px;font-size:15px;font-weight:500;line-height:1.5;max-width:85%">${escapeHtml(text).replace(/\n/g,'<br>')}</div>`;
  } else {
    div.innerHTML = `<div style="background:rgba(255,255,255,0.88);color:#1e1040;border-radius:14px 4px 14px 14px;padding:8px 12px;font-size:15px;font-weight:500;line-height:1.5;max-width:85%">${escapeHtml(text)}</div>`;
  }
  el.appendChild(div);
  // Phase 9 Шар 6 (RGisY 04.05) — Регресія 1 fix: chips render при restore історії.
  // Раніше Phase 1 додала chips у saveChatMsg('inbox',...) але restore не відображав
  // — _renderInboxChatMsg ігнорував. Тепер 4-й параметр + динамічний import щоб
  // не створювати static circular dependency core.js ↔ chips.js (вже двостороння).
  if (isAgent && Array.isArray(chips) && chips.length > 0) {
    import('../owl/chips.js').then(m => {
      // MPVly 06.05 fix (Council Agent 2): cleanup ВНУТРІ async .then() щоб
      // встигнути ПІСЛЯ resolve інших паралельних import()'ів. Раніше cleanup
      // був синхронний (рядок 828) — при restore історії 4 agent повідомлень
      // 4 import().then() запускались паралельно, кожен cleanup видаляв 0
      // existing chipsRow (бо .then() ще не виконались) → кінцевий DOM мав 4
      // chipsRow одночасно. Тепер кожен resolve очищає ВСІ попередні перед
      // appendChild — у DOM лишається chipsRow тільки ОСТАННЬОГО resolve'у
      // (= останнє повідомлення в історії, бо Promise FIFO у V8/JSC).
      el.querySelectorAll('.chat-chips-row').forEach(n => n.remove());
      const chipsRow = document.createElement('div');
      chipsRow.className = 'chat-chips-row';
      m.renderChips(chipsRow, chips, 'inbox');
      el.appendChild(chipsRow);
      el.scrollTop = el.scrollHeight;
    }).catch(() => {});
  }
  el.scrollTop = el.scrollHeight;
}

export function openChatBar(tab) {
  if (activeChatBar === tab) return;

  // Закриваємо OWL чат якщо відкритий
  try { closeOwlChat(); } catch(e) {}

  // Закриваємо інші бари
  ['inbox','tasks','notes','me','evening','finance','health','projects'].forEach(t => {
    if (t === tab) return;
    const b = document.getElementById(t + '-ai-bar');
    if (!b) return;
    const cw = b.querySelector('.ai-bar-chat-window');
    if (cw) { cw.classList.remove('open'); _tabChatState[t] = undefined; }
    const inputs = b.querySelectorAll('input, textarea');
    inputs.forEach(i => i.blur());
  });

  activeChatBar = tab;

  // Очищуємо бейдж непрочитаних — юзер відкрив чат, повідомлення прочитано
  if (tab === 'inbox') { try { _clearInboxUnreadBadge(); } catch(e) {} }
  else { try { clearUnreadBadge(tab); } catch(e) {} }

  const bar = document.getElementById(tab + '-ai-bar');
  if (!bar) return;

  restoreChatUI(tab);

  const chatWin = bar.querySelector('.ai-bar-chat-window');
  if (chatWin) requestAnimationFrame(() => {
    // Відкриваємо в стані A (compact)
    const h = _getTabChatAHeight(tab);
    chatWin.style.height = h + 'px';
    chatWin.style.maxHeight = h + 'px';
    chatWin.classList.add('open');
    _tabChatState[tab] = 'a';
    // Скролимо до останнього повідомлення після відкриття
    const msgs = chatWin.querySelector('.ai-bar-messages');
    if (msgs) setTimeout(() => { msgs.scrollTop = msgs.scrollHeight; }, 50);
  });
}

export function closeChatBar(tab) {
  const bar = document.getElementById(tab + '-ai-bar');
  if (!bar) return;

  const chatWin = bar.querySelector('.ai-bar-chat-window');
  if (chatWin) chatWin.classList.remove('open');
  _tabChatState[tab] = undefined;

  // Знімаємо фокус але НЕ очищуємо текст — користувач може повернутись
  const inputs = bar.querySelectorAll('input, textarea');
  inputs.forEach(i => i.blur());

  activeChatBar = null;
  lastChatClosedTs = Date.now();

  // Табло може оновитись після закриття чату
  window.dispatchEvent(new CustomEvent('nm-chat-closed', { detail: tab }));
}

export function closeAllChatBars(resetActive = true) {
  ['inbox','tasks','notes','me','evening','finance','health','projects'].forEach(t => {
    const bar = document.getElementById(t + '-ai-bar');
    if (!bar) return;
    const chatWin = bar.querySelector('.ai-bar-chat-window');
    if (chatWin) { chatWin.classList.remove('open'); _tabChatState[t] = undefined; }
    const inputs = bar.querySelectorAll('input, textarea');
    inputs.forEach(i => i.blur());
  });
  if (resetActive) {
    if (activeChatBar) lastChatClosedTs = Date.now();
    activeChatBar = null;
  }
}

// === WINDOW GLOBALS (HTML handlers only) ===
Object.assign(window, { openChatBar, closeChatBar });
