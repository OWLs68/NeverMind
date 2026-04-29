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
//   • renderMeHabitsStats() — блок статистики звичок у вкладці Я
//   • sendMeChatMessage() / addMeChatMsg() — чат-бар вкладки Я
//
// Залежності: core/nav, core/utils, ai/core, tabs/tasks, tabs/habits,
//             tabs/notes, tabs/finance, tabs/projects, tabs/evening (getMoments)
// ============================================================

import { showToast, switchTab } from '../core/nav.js';
import { escapeHtml, logRecentAction, extractJsonBlocks, parseContentChips } from '../core/utils.js';
import { callAI, callAIWithHistory, callAIWithTools, getAIContext, getMeStatsContext, getOWLPersonality, openChatBar, saveChatMsg, INBOX_TOOLS } from '../ai/core.js';
import { renderChips } from '../owl/chips.js';
import { UI_TOOLS_RULES, REMINDER_RULES } from '../ai/prompts.js';
import { dispatchChatToolCalls } from '../ai/tool-dispatcher.js';
import { getTasks } from './tasks.js';
import { getHabits, getHabitLog, getHabitPct, getHabitStreak, processUniversalAction } from './habits.js';
import { getNotes } from './notes.js';
import { getMoments } from './evening.js';
import { getProjects } from './projects.js';

// === ME TAB CHAT ===
let meChatHistory = [];

// Підраховує % виконання звички у вікні [startDaysAgo, endDaysAgo) — для тренду.
function _habitPctInWindow(habit, startDaysAgo, endDaysAgo, log) {
  const now = new Date();
  let total = 0, done = 0;
  for (let i = startDaysAgo; i < endDaysAgo; i++) {
    const d = new Date(now); d.setDate(now.getDate() - i);
    const dow = (d.getDay() + 6) % 7;
    if (!(habit.days || [0,1,2,3,4]).includes(dow)) continue;
    total++;
    if (log[d.toDateString()]?.[habit.id]) done++;
  }
  return total > 0 ? Math.round(done / total * 100) : 0;
}

export function renderMeHabitsStats() {
  const habits = getHabits();
  const el = document.getElementById('me-habits-stats-list');
  const block = document.getElementById('me-habits-stats');
  if (!el) return;
  if (habits.length === 0) {
    if (block) block.style.display = 'none';
    return;
  }
  if (block) block.style.display = 'block';
  const log = getHabitLog();
  const today = new Date().toDateString();
  const todayDow = (new Date().getDay() + 6) % 7;

  // Загальний місячний підсумок: середнє % всіх звичок за 30 днів vs попередні 30
  const buildHabits = habits.filter(h => h.type !== 'quit');
  let monthAvg = 0, prevAvg = 0;
  if (buildHabits.length > 0) {
    monthAvg = Math.round(buildHabits.reduce((s, h) => s + _habitPctInWindow(h, 0, 30, log), 0) / buildHabits.length);
    prevAvg = Math.round(buildHabits.reduce((s, h) => s + _habitPctInWindow(h, 30, 60, log), 0) / buildHabits.length);
  }
  const trendDiff = monthAvg - prevAvg;
  const trendArrow = trendDiff > 2 ? '↑' : trendDiff < -2 ? '↓' : '→';
  const trendColor = trendDiff > 2 ? '#16a34a' : trendDiff < -2 ? '#c2410c' : 'rgba(30,16,64,0.4)';
  const summaryColor = monthAvg >= 70 ? '#16a34a' : monthAvg >= 40 ? '#d97706' : '#dc2626';

  const summaryHTML = buildHabits.length > 0 ? `
    <div style="display:flex;justify-content:space-between;align-items:baseline;padding:8px 10px;background:rgba(255,255,255,0.55);border-radius:10px;margin-bottom:12px">
      <span style="font-size:11px;font-weight:700;color:rgba(30,16,64,0.5)">Місячний огляд</span>
      <span style="font-size:18px;font-weight:900;color:${summaryColor}">${monthAvg}%
        <span style="font-size:12px;font-weight:700;color:${trendColor};margin-left:6px">${trendArrow} ${trendDiff >= 0 ? '+' : ''}${trendDiff}%</span>
      </span>
    </div>` : '';

  const itemsHTML = habits.map(h => {
    const pct = getHabitPct(h.id);
    const streak = getHabitStreak(h.id);
    const isDoneToday = !!log[today]?.[h.id];
    const isScheduledToday = (h.days || [0,1,2,3,4]).includes(todayDow);
    // Тренд цієї звички vs попередні 30 днів
    const prevPct = h.type !== 'quit' ? _habitPctInWindow(h, 30, 60, log) : 0;
    const diff = pct - prevPct;
    const arrow = diff > 2 ? '↑' : diff < -2 ? '↓' : '→';
    const arrowColor = diff > 2 ? '#16a34a' : diff < -2 ? '#c2410c' : 'rgba(30,16,64,0.3)';
    const trendChip = h.type !== 'quit' && Math.abs(diff) > 2
      ? `<span style="font-size:11px;font-weight:700;color:${arrowColor};margin-left:4px">${arrow}${diff >= 0 ? '+' : ''}${diff}%</span>`
      : '';
    return `
    <div style="margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
        <span style="font-size:15px;font-weight:600;color:#1e1040">${h.emoji || '⭕'} ${escapeHtml(h.name)}</span>
        <span style="font-size:13px;font-weight:700;color:${pct >= 70 ? '#16a34a' : pct >= 40 ? '#d97706' : '#dc2626'}">${pct}%${trendChip}</span>
      </div>
      <div style="height:5px;background:rgba(30,16,64,0.06);border-radius:3px;margin-bottom:4px">
        <div style="height:100%;width:${pct}%;background:${pct >= 70 ? '#16a34a' : pct >= 40 ? '#d97706' : '#ef4444'};border-radius:3px;transition:width 0.5s"></div>
      </div>
      <div style="font-size:12px;color:rgba(30,16,64,0.4)">${streak >= 2 ? `🔥 ${streak} дні поспіль · ` : ''}за 30 днів${isScheduledToday ? (isDoneToday ? ' · ✅ сьогодні виконано' : ' · ⏳ сьогодні ще не виконано') : ''}</div>
    </div>`;
  }).join('');

  el.innerHTML = summaryHTML + itemsHTML;
}
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
    addMeChatMsg('agent', reply || 'Не вдалося отримати відповідь.', false, '', extractedChips);
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

  // === ПОРІВНЯННЯ ТИЖДЕНЬ vs МИНУЛИЙ ===
  const compareEl = document.getElementById('me-week-compare');
  if (compareEl) {
    const weekStart = new Date(now); weekStart.setDate(now.getDate() - todayDow); weekStart.setHours(0,0,0,0);
    const prevStart = new Date(weekStart); prevStart.setDate(prevStart.getDate() - 7);
    const prevEnd = new Date(weekStart);

    const thisWeekTasks = getTasks().filter(t => t.status === 'done' && t.completedAt >= weekStart.getTime()).length;
    const prevWeekTasks = getTasks().filter(t => t.status === 'done' && t.completedAt >= prevStart.getTime() && t.completedAt < prevEnd.getTime()).length;

    const habits = getHabits(); const log = getHabitLog();
    const buildHabitsMe = habits.filter(h => h.type !== 'quit');
    let thisHabitPct = 0, prevHabitPct = 0;
    if (buildHabitsMe.length > 0) {
      let thisDone = 0, thisTotal = 0, prevDone = 0, prevTotal = 0;
      for (let i = 0; i <= todayDow; i++) {
        const d = new Date(weekStart); d.setDate(weekStart.getDate() + i);
        const dow = (d.getDay() + 6) % 7;
        const ds = d.toDateString();
        const dayH = buildHabitsMe.filter(h => (h.days || [0,1,2,3,4]).includes(dow));
        thisTotal += dayH.length;
        thisDone += dayH.filter(h => !!log[ds]?.[h.id]).length;
      }
      for (let i = 0; i < 7; i++) {
        const d = new Date(prevStart); d.setDate(prevStart.getDate() + i);
        const dow = (d.getDay() + 6) % 7;
        const ds = d.toDateString();
        const dayH = buildHabitsMe.filter(h => (h.days || [0,1,2,3,4]).includes(dow));
        prevTotal += dayH.length;
        prevDone += dayH.filter(h => !!log[ds]?.[h.id]).length;
      }
      thisHabitPct = thisTotal > 0 ? Math.round(thisDone / thisTotal * 100) : 0;
      prevHabitPct = prevTotal > 0 ? Math.round(prevDone / prevTotal * 100) : 0;
    }

    const thisNotes = getNotes().filter(n => (n.ts || 0) >= weekStart.getTime()).length;
    const prevNotes = getNotes().filter(n => (n.ts || 0) >= prevStart.getTime() && (n.ts || 0) < prevEnd.getTime()).length;

    const diffColor = (a, b) => a >= b ? '#16a34a' : '#c2410c';
    const diffArrow = (a, b) => a >= b ? '↑' : '↓';

    compareEl.innerHTML = [
      { label: 'задачі', cur: thisWeekTasks, prev: prevWeekTasks, color: '#ea580c' },
      { label: 'звички', cur: thisHabitPct + '%', prev: prevHabitPct + '%', rawCur: thisHabitPct, rawPrev: prevHabitPct, color: '#16a34a' },
      { label: 'нотатки', cur: thisNotes, prev: prevNotes, color: '#7c4a2a' },
    ].map(item => {
      const rc = item.rawCur !== undefined ? item.rawCur : item.cur;
      const rp = item.rawPrev !== undefined ? item.rawPrev : item.prev;
      const diff = rc - rp;
      return `<div style="flex:1;background:rgba(255,255,255,0.55);border-radius:12px;padding:8px 6px;text-align:center">
        <div style="font-size:20px;font-weight:900;color:${item.color};line-height:1">${item.cur}</div>
        <div style="font-size:9px;font-weight:700;color:rgba(30,16,64,0.4);margin-top:2px">${item.label}</div>
        <div style="font-size:10px;font-weight:800;color:${diffColor(rc,rp)};margin-top:2px">${diffArrow(rc,rp)} ${diff >= 0 ? '+' : ''}${item.rawCur !== undefined ? diff + '%' : diff}</div>
      </div>`;
    }).join('');
  }

  // === НАСТРІЙ ТИЖНЯ ===
  const moodEl = document.getElementById('me-mood-bars');
  if (moodEl) {
    const days = ['Пн','Вт','Ср','Чт','Пт','Сб','Нд'];
    const moodMap = { fire: 5, good: 4, ok: 3, meh: 2, bad: 1 };
    const bars = days.map((d, i) => {
      const daysAgo = todayDow - i;
      const future = daysAgo < 0;
      if (future) return { d, h: 3, color: 'rgba(30,16,64,0.05)', future: true };
      const date = new Date(now); date.setDate(now.getDate() - daysAgo);
      const ds = date.toDateString();
      try {
        const saved = JSON.parse(localStorage.getItem('nm_evening_mood') || 'null');
        if (saved && saved.date === ds && saved.mood) {
          const val = moodMap[saved.mood] || 3;
          const maxH = 26;
          const h = Math.round((val / 5) * maxH);
          const colors = { fire:'#ea580c', good:'#22c55e', ok:'#16a34a', meh:'#d97706', bad:'#ef4444' };
          return { d, h: Math.max(4, h), color: colors[saved.mood] || '#16a34a', future: false };
        }
      } catch(e) {}
      const dayMoments = getMoments().filter(m => new Date(m.ts).toDateString() === ds);
      if (dayMoments.length === 0) return { d, h: 3, color: 'rgba(30,16,64,0.07)', future: false };
      const pos = dayMoments.filter(m => m.mood === 'positive').length;
      const pct = pos / dayMoments.length;
      const h = Math.max(5, Math.round(pct * 26));
      return { d, h, color: pct >= 0.6 ? '#16a34a' : pct >= 0.3 ? '#d97706' : '#ef4444', future: false };
    });
    moodEl.innerHTML = bars.map(b =>
      `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px;justify-content:flex-end">
        <div style="width:100%;height:${b.h}px;background:${b.color};border-radius:2px 2px 0 0"></div>
        <div style="font-size:8px;font-weight:700;color:rgba(30,16,64,0.35)">${b.d}</div>
      </div>`
    ).join('');
  }

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
      const summaryHTML = `
        <div style="display:flex;justify-content:space-between;align-items:baseline;padding:7px 10px;background:rgba(255,255,255,0.55);border-radius:10px;margin-bottom:12px">
          <span style="font-size:11px;font-weight:700;color:rgba(30,16,64,0.5)">${allProjects.length} активн${allProjects.length === 1 ? 'ий' : 'их'}</span>
          <span style="font-size:11px;font-weight:700">
            <span style="color:#16a34a">${moving} рух${moving === 1 ? 'ається' : 'аються'}</span>
            ${stagnant > 0 ? `<span style="color:rgba(30,16,64,0.4)"> · </span><span style="color:#c2410c">${stagnant} стоїть</span>` : ''}
          </span>
        </div>`;

      const itemsHTML = projWithStats.slice(0, 5).map(({ p, pct, stepsThisWeek, daysSince, nextStep }) => {
        let trendChip = '';
        if (stepsThisWeek > 0) {
          trendChip = `<span style="font-size:10px;font-weight:700;color:#16a34a;margin-top:2px;display:block">+${stepsThisWeek} крок${stepsThisWeek === 1 ? '' : stepsThisWeek < 5 ? 'и' : 'ів'} за тиждень</span>`;
        } else if (daysSince !== null && daysSince >= 7) {
          trendChip = `<span style="font-size:10px;font-weight:700;color:#c2410c;margin-top:2px;display:block">⏸ без змін ${daysSince} дн</span>`;
        } else if (daysSince === null) {
          trendChip = `<span style="font-size:10px;font-weight:700;color:rgba(30,16,64,0.4);margin-top:2px;display:block">щойно створений</span>`;
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

  // === ЗВИЧКИ СТАТИСТИКА ===
  renderMeHabitsStats();
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
    const pct = scheduled > 0 ? Math.round(done / scheduled * 100) : 0;
    return `- "${h.name}": ${done}/${scheduled} (${pct}%)`;
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
  if (habitLines) parts.push(`Звички (виконано/заплановано):\n${habitLines}`);
  if (quitLines) parts.push(`Відмова від звичок:\n${quitLines}`);
  parts.push(`Закриті задачі: ${doneTasks}`);
  parts.push(`Записів у Inbox: ${inboxCount}`);
  if (moodSummary) parts.push(moodSummary);
  return parts.join('\n\n');
}

// === 🦉 ТИЖНЕВІ ІНСАЙТИ ВІД AI ===
// Один AI-виклик за тиждень → JSON {oneliner, patterns[], deepReport}.
// Зберігається у localStorage 'nm_me_weekly_insights'.
// Авто-генерується у неділю (день тижня = 6) або якщо нема свіжих даних 7+ днів.

const INSIGHTS_KEY = 'nm_me_weekly_insights';
let _insightsGenerating = false;

function _getInsights() {
  try { return JSON.parse(localStorage.getItem(INSIGHTS_KEY) || 'null'); }
  catch { return null; }
}

const INSIGHTS_VERSION = 2; // bump якщо змінюється формат/контекст промпту
function _isInsightsStale(insights) {
  if (!insights || !insights.generatedAt) return true;
  if (insights.version !== INSIGHTS_VERSION) return true; // примусова перегенерація після фіксу контексту
  const ageMs = Date.now() - insights.generatedAt;
  return ageMs > 7 * 86400000;
}

function _formatInsightAge(ts) {
  const days = Math.floor((Date.now() - ts) / 86400000);
  if (days === 0) return 'сьогодні';
  if (days === 1) return 'вчора';
  return `${days} дн тому`;
}

async function generateWeeklyInsights() {
  if (_insightsGenerating) return;
  _insightsGenerating = true;
  try {
    const aiCtx = getAIContext();
    const stats = getMeStatsContext ? getMeStatsContext() : '';
    const systemPrompt = `${getOWLPersonality()} Ти аналізуєш дані юзера за минулий тиждень і повертаєш ТІЛЬКИ валідний JSON без markdown, без коментарів. Структура:
{"oneliner":"одне речення-підсумок тижня (12-20 слів, чесно — не лестощі)","patterns":["патерн 1 (10-15 слів про закономірність)","патерн 2","патерн 3"],"deepReport":"4-6 речень глибокого звіту: цифри, прогрес, проблеми, рекомендації"}
ВАЖЛИВО: пиши українською. НЕ вигадуй факти яких нема в даних. Якщо даних мало — все одно зроби короткий чесний звіт ("даних замало для патернів"). НЕ хвали без причини. Конкретика > загальні фрази.`;
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
        <span style="font-size:11px;font-weight:800;color:${accent};text-transform:uppercase;letter-spacing:0.07em">OWL знає тебе</span>
      </div>
      <div style="font-size:13px;color:rgba(30,16,64,0.5);font-style:italic">Аналізую твій тиждень — інсайти зʼявляться за хвилину…</div>`;
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
      <div style="font-size:10px;font-weight:700;color:rgba(124,74,42,0.6);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px">Глибокий звіт</div>
      <div style="font-size:12.5px;color:rgba(30,16,64,0.75);line-height:1.5">${escapeHtml(insights.deepReport)}</div>
    </div>` : '';

  el.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
      <div style="display:flex;align-items:center;gap:8px">
        <span style="font-size:14px">🦉</span>
        <span style="font-size:11px;font-weight:800;color:${accent};text-transform:uppercase;letter-spacing:0.07em">OWL знає тебе</span>
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
  const names = ['січня','лютого','березня','квітня','травня','червня','липня','серпня','вересня','жовтня','листопада','грудня'];
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return names[prev.getMonth()];
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
          <span style="font-size:11px;font-weight:800;color:#16a34a;text-transform:uppercase;letter-spacing:0.07em">Підсумок ${_prevMonthName()}</span>
        </div>
        <div style="font-size:13px;color:rgba(30,16,64,0.5);font-style:italic">Складаю місячний звіт…</div>`;
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
    sections.push(`<div style="margin-top:8px"><span style="font-size:10px;font-weight:800;color:rgba(22,163,74,0.7);text-transform:uppercase;letter-spacing:0.06em">Топ занять</span>
      ${report.topActivities.map(a => `<div style="font-size:12.5px;color:rgba(30,16,64,0.75);margin-top:3px">• ${escapeHtml(a)}</div>`).join('')}
    </div>`);
  }
  if (report.moodTrend) sections.push(`<div style="font-size:12.5px;color:rgba(30,16,64,0.75);margin-top:8px"><span style="font-weight:700">Настрій:</span> ${escapeHtml(report.moodTrend)}</div>`);
  if (report.projectsProgress) sections.push(`<div style="font-size:12.5px;color:rgba(30,16,64,0.75);margin-top:6px"><span style="font-weight:700">Проекти:</span> ${escapeHtml(report.projectsProgress)}</div>`);
  if (report.financeNote) sections.push(`<div style="font-size:12.5px;color:rgba(30,16,64,0.75);margin-top:6px"><span style="font-weight:700">Фінанси:</span> ${escapeHtml(report.financeNote)}</div>`);
  if (report.patterns && report.patterns.length > 0) {
    sections.push(`<div style="margin-top:10px;padding-top:10px;border-top:1px solid rgba(22,163,74,0.15)">
      <span style="font-size:10px;font-weight:800;color:rgba(22,163,74,0.7);text-transform:uppercase;letter-spacing:0.06em">Патерни</span>
      ${report.patterns.map(p => `<div style="font-size:12.5px;color:rgba(30,16,64,0.75);margin-top:3px">• ${escapeHtml(p)}</div>`).join('')}
    </div>`);
  }

  el.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
      <span style="font-size:14px">📆</span>
      <span style="font-size:11px;font-weight:800;color:${greenAccent};text-transform:uppercase;letter-spacing:0.07em">Підсумок ${report.monthLabel}</span>
    </div>
    <div style="font-size:14px;font-weight:600;color:#1e1040;line-height:1.45">${escapeHtml(report.oneliner)}</div>
    ${sections.join('')}`;
}

function renderMeHeatmap() {
  const grid = document.getElementById('me-heatmap-grid');
  const legend = document.getElementById('me-heatmap-legend');
  if (!grid) return;

  const now = new Date();
  const inbox = JSON.parse(localStorage.getItem('nm_inbox') || '[]');
  const habits = getHabits().filter(h => h.type !== 'quit');
  const log = getHabitLog();
  const accent = '#7c4a2a';

  // 14 днів від найстарішого до сьогодні
  const cells = [];
  let total = 0;
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now); d.setDate(now.getDate() - i);
    const ds = d.toDateString();
    const dow = (d.getDay() + 6) % 7;
    const inboxCount = inbox.filter(item => new Date(item.ts).toDateString() === ds).length;
    const doneTasks = getTasks().filter(t => t.status === 'done' && t.completedAt && new Date(t.completedAt).toDateString() === ds).length;
    const dayHabits = habits.filter(h => (h.days || [0,1,2,3,4]).includes(dow));
    const doneH = dayHabits.filter(h => !!log[ds]?.[h.id]).length;
    const score = inboxCount + doneTasks + doneH;
    total += score;
    cells.push({ score, day: d.getDate(), isToday: i === 0, dow });
  }

  // 4 рівні кольору (0=порожньо, 1-3 = активність)
  const maxScore = Math.max(...cells.map(c => c.score), 1);
  const levelOf = s => {
    if (s === 0) return 0;
    if (s <= maxScore * 0.33) return 1;
    if (s <= maxScore * 0.66) return 2;
    return 3;
  };
  const colorOf = lvl => {
    if (lvl === 0) return 'rgba(30,16,64,0.06)';
    if (lvl === 1) return 'rgba(124,74,42,0.18)';
    if (lvl === 2) return 'rgba(124,74,42,0.45)';
    return accent;
  };

  grid.innerHTML = cells.map(c => {
    const lvl = levelOf(c.score);
    const bg = colorOf(lvl);
    const txtColor = lvl >= 2 ? 'white' : 'rgba(30,16,64,0.45)';
    const border = c.isToday ? `2px solid ${accent}` : '1px solid rgba(30,16,64,0.06)';
    return `<div title="${c.score} дій" style="aspect-ratio:1;background:${bg};border-radius:5px;border:${border};display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;color:${txtColor}">${c.day}</div>`;
  }).join('');

  if (legend) legend.textContent = `${total} дій · 2 тижні`;
}

function renderMeActivityChart() {
  const chartEl = document.getElementById('me-activity-chart');
  const labelsEl = document.getElementById('me-activity-labels');
  const totalEl = document.getElementById('me-activity-total');
  if (!chartEl) return;

  const now = new Date();
  const todayDow = (now.getDay() + 6) % 7;
  const dayLabels = ['Пн','Вт','Ср','Чт','Пт','Сб','Нд'];
  const accent = '#7c4a2a';

  const allBuildHabits = getHabits().filter(h => h.type !== 'quit');
  const log = getHabitLog();
  const allTasks = getTasks();

  const dayActivity = (date) => {
    const ds = date.toDateString();
    const dow = (date.getDay() + 6) % 7;
    const dayH = allBuildHabits.filter(h => (h.days || [0,1,2,3,4]).includes(dow));
    const doneH = dayH.filter(h => !!log[ds]?.[h.id]).length;
    const doneT = allTasks.filter(t => t.status === 'done' && t.completedAt && new Date(t.completedAt).toDateString() === ds).length;
    return doneH + doneT;
  };

  // Адаптивна норма: середнє денне виконання (задачі + звички) за 30 днів × 1.15
  let avg30Total = 0;
  for (let i = 0; i < 30; i++) {
    const d = new Date(now); d.setDate(now.getDate() - i);
    avg30Total += dayActivity(d);
  }
  const avg30 = avg30Total / 30;

  // Fallback на стару формулу якщо новий юзер (<7 днів даних або пусто)
  const inb = JSON.parse(localStorage.getItem('nm_inbox') || '[]');
  const oldestTs = inb.length ? Math.min(...inb.map(i => i.ts || Date.now())) : Date.now();
  const inboxAgeDays = Math.floor((Date.now() - oldestTs) / (24 * 3600 * 1000));
  const hasEnoughData = inboxAgeDays >= 7 || avg30Total > 0;

  const activeTasks = allTasks.filter(t => t.status === 'active').length;
  const fallbackBaseline = Math.max(1, Math.round(activeTasks / 7) + 1);
  const baseline = hasEnoughData
    ? Math.max(1, Math.round(avg30 * 1.15))
    : fallbackBaseline;

  const values = dayLabels.map((_, i) => {
    const daysAgo = todayDow - i;
    if (daysAgo < 0) return null;
    const d = new Date(now); d.setDate(now.getDate() - daysAgo);
    return { val: dayActivity(d), norm: baseline };
  });

  const validValues = values.filter(v => v !== null);
  const maxVal = Math.max(...validValues.map(v => v.val), baseline * 2, 1);
  const totalActivity = validValues.reduce((s, v) => s + v.val, 0);
  if (totalEl) totalEl.textContent = `${totalActivity} дій`;

  const W = chartEl.offsetWidth || 300;
  const H = 96;
  const padL = 28;
  const padR = 46;
  const padT = 12;
  const padB = 12;
  const chartH = H - padT - padB;
  const chartW = W - padL - padR;

  const xOf = i => padL + (i + 0.5) * chartW / 7;
  const yOf = val => padT + chartH * (1 - val / maxVal);

  const points = values.map((v, i) => {
    if (v === null) return null;
    return { x: xOf(i), y: yOf(v.val), v: v.val, norm: v.norm, i };
  }).filter(Boolean);

  if (points.length < 2) {
    chartEl.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;font-size:12px;color:rgba(30,16,64,0.3)">Немає даних за тиждень</div>';
    if (labelsEl) labelsEl.innerHTML = '';
    return;
  }

  const baselineY = yOf(baseline);

  const linePath = points.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L ${points[points.length-1].x.toFixed(1)} ${(padT + chartH).toFixed(1)} L ${points[0].x.toFixed(1)} ${(padT + chartH).toFixed(1)} Z`;

  const dots = points.map(p => {
    const isToday = p.i === todayDow;
    const aboveNorm = p.v >= p.norm;
    const fill = p.v === 0 ? 'rgba(124,74,42,0.2)' : aboveNorm ? '#16a34a' : '#c2410c';
    const r = isToday ? 5 : 3.5;
    return `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${r}" fill="${fill}" stroke="white" stroke-width="1.5"/>`;
  }).join('');

  const normLabelTop = Math.max(padT, Math.round(baselineY) - 9);

  chartEl.innerHTML = `
    <svg width="${W}" height="${H}" style="display:block;overflow:visible">
      <defs>
        <linearGradient id="actGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${accent}" stop-opacity="0.18"/>
          <stop offset="100%" stop-color="${accent}" stop-opacity="0.02"/>
        </linearGradient>
      </defs>
      <rect x="${padL}" y="${padT}" width="${chartW}" height="${chartH}" fill="rgba(255,255,255,0.35)" stroke="rgba(30,16,64,0.12)" stroke-width="1" rx="8"/>
      <text x="${padL - 6}" y="${padT + 4}" text-anchor="end" font-size="9" font-weight="700" fill="rgba(30,16,64,0.4)">${maxVal}</text>
      <text x="${padL - 6}" y="${padT + chartH + 3}" text-anchor="end" font-size="9" font-weight="700" fill="rgba(30,16,64,0.4)">0</text>
      <line x1="${padL}" y1="${baselineY.toFixed(1)}" x2="${padL + chartW}" y2="${baselineY.toFixed(1)}"
            stroke="rgba(30,16,64,0.3)" stroke-width="1" stroke-dasharray="4,4"/>
      <path d="${areaPath}" fill="url(#actGrad)"/>
      <path d="${linePath}" fill="none" stroke="${accent}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      ${dots}
    </svg>
    <div style="position:absolute;right:0;top:${normLabelTop}px;font-size:9px;font-weight:700;letter-spacing:0.03em;color:rgba(30,16,64,0.55);background:rgba(245,240,235,0.92);padding:1px 5px;border-radius:4px;line-height:1.4;pointer-events:none">НОРМА ${baseline}</div>
  `;

  if (labelsEl) {
    labelsEl.innerHTML = values.map((v, i) => {
      const isToday = i === todayDow;
      const isFuture = v === null;
      return `<div style="flex:1;text-align:center;font-size:9px;font-weight:${isToday ? 800 : 700};color:${isToday ? accent : isFuture ? 'rgba(30,16,64,0.15)' : 'rgba(30,16,64,0.35)'}">${dayLabels[i]}</div>`;
    }).join('');
  }
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
    el.textContent = 'Ще замало даних для аналізу. Додай кілька записів в Inbox, створи задачі або нотатки — і я дам тобі корисний аналіз.';
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
  el.textContent = reply || 'Не вдалось отримати аналіз. Спробуй ще раз.';
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
  el.scrollTop = el.scrollHeight;
  if (!_noSave) saveChatMsg('me', role, text);
}
// === WINDOW EXPORTS (HTML handlers only) ===
Object.assign(window, {
  sendMeChatMessage,
  showMeChatMessages,
  refreshMeAnalysis,
});
