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
import { escapeHtml, logRecentAction, extractJsonBlocks } from '../core/utils.js';
import { callAI, callAIWithHistory, callAIWithTools, getAIContext, getMeStatsContext, getOWLPersonality, openChatBar, saveChatMsg, INBOX_TOOLS } from '../ai/core.js';
import { UI_TOOLS_RULES } from '../ai/prompts.js';
import { dispatchChatToolCalls } from '../ai/tool-dispatcher.js';
import { getTasks } from './tasks.js';
import { getHabits, getHabitLog, getHabitPct, getHabitStreak, processUniversalAction } from './habits.js';
import { getNotes } from './notes.js';
import { getMoments } from './evening.js';
import { getProjects } from './projects.js';

// === ME TAB CHAT ===
let meChatHistory = [];

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

  el.innerHTML = habits.map(h => {
    const pct = getHabitPct(h.id);
    const streak = getHabitStreak(h.id);
    const isDoneToday = !!log[today]?.[h.id];
    const isScheduledToday = (h.days || [0,1,2,3,4]).includes(todayDow);
    return `
    <div style="margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
        <span style="font-size:15px;font-weight:600;color:#1e1040">${h.emoji || '⭕'} ${escapeHtml(h.name)}</span>
        <span style="font-size:13px;font-weight:700;color:${pct >= 70 ? '#16a34a' : pct >= 40 ? '#d97706' : '#dc2626'}">${pct}%</span>
      </div>
      <div style="height:5px;background:rgba(30,16,64,0.06);border-radius:3px;margin-bottom:4px">
        <div style="height:100%;width:${pct}%;background:${pct >= 70 ? '#16a34a' : pct >= 40 ? '#d97706' : '#ef4444'};border-radius:3px;transition:width 0.5s"></div>
      </div>
      <div style="font-size:12px;color:rgba(30,16,64,0.4)">${streak >= 2 ? `🔥 ${streak} дні поспіль · ` : ''}за 30 днів${isScheduledToday ? (isDoneToday ? ' · ✅ сьогодні виконано' : ' · ⏳ сьогодні ще не виконано') : ''}</div>
    </div>`;
  }).join('');
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
Для CRUD дій — викликай відповідний tool. Для аналізу/відповіді — пиши текст.

${UI_TOOLS_RULES}${context ? '\n\n' + context : ''}${stats ? '\n\n' + stats : ''}`;

  // "Один мозок #2 A": INBOX_TOOLS (31) + UI tools — повний набір для CRUD і навігації.
  const msg = await callAIWithTools(systemPrompt, [...meChatHistory], INBOX_TOOLS);
  const loadEl = document.getElementById(loadId);

  // Tool dispatch — через спільний dispatcher (UI tool OR CRUD через universal action)
  if (msg && Array.isArray(msg.tool_calls) && msg.tool_calls.length > 0) {
    if (loadEl) loadEl.remove();
    dispatchChatToolCalls(msg.tool_calls, (r, t) => addMeChatMsg(r, t), text);
    if (msg.content) meChatHistory.push({ role: 'assistant', content: msg.content });
    if (meChatHistory.length > 20) meChatHistory = meChatHistory.slice(-20);
    return;
  }

  // Fallback на існуючий текст-JSON флоу (CRUD через processUniversalAction)
  const reply = msg && msg.content ? msg.content : '';

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

  if (!handled && loadEl) loadEl.textContent = reply || 'Не вдалося отримати відповідь.';
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

  // === КРУЖЕЧКИ ТИЖНЯ ===
  const ringsEl = document.getElementById('me-week-rings');
  if (ringsEl) {
    const days = ['Пн','Вт','Ср','Чт','Пт','Сб','Нд'];
    const accent = '#7c4a2a';
    ringsEl.innerHTML = days.map((d, i) => {
      const daysAgo = todayDow - i;
      const date = new Date(now); date.setDate(now.getDate() - daysAgo);
      const ds = date.toDateString();
      const future = daysAgo < 0;
      const count = future ? 0 : inbox.filter(item => new Date(item.ts).toDateString() === ds).length;
      const doneTasks = future ? 0 : getTasks().filter(t => t.status === 'done' && t.completedAt && new Date(t.completedAt).toDateString() === ds).length;
      const total = count + doneTasks;
      const maxVal = 8;
      const pct = future ? 0 : Math.min(total / maxVal, 1);
      const circ = 69;
      const offset = circ - circ * pct;
      const isToday = daysAgo === 0;
      const isBest = !future && pct >= 0.85;
      const strokeColor = isBest ? accent : pct > 0.4 ? `rgba(124,74,42,0.6)` : pct > 0 ? `rgba(124,74,42,0.3)` : 'transparent';
      const label = future ? '–' : isBest ? '★' : total > 0 ? total : '·';
      const labelColor = isBest ? accent : pct > 0.4 ? `rgba(124,74,42,0.65)` : 'rgba(30,16,64,0.22)';
      return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:3px">
        <svg width="32" height="32" viewBox="0 0 30 30">
          <circle cx="15" cy="15" r="11" fill="none" stroke="rgba(30,16,64,0.07)" stroke-width="3.5"/>
          ${!future && pct > 0 ? `<circle cx="15" cy="15" r="11" fill="none" stroke="${strokeColor}" stroke-width="3.5" stroke-dasharray="${circ}" stroke-dashoffset="${offset}" stroke-linecap="round" transform="rotate(-90 15 15)"/>` : ''}
          <text x="15" y="19" text-anchor="middle" font-size="${isBest ? 9 : 8}" font-weight="${isBest ? 900 : 800}" fill="${labelColor}">${label}</text>
        </svg>
        <div style="font-size:9px;font-weight:${isToday ? 800 : 700};color:${isToday ? accent : 'rgba(30,16,64,0.35)'}">${d}</div>
      </div>`;
    }).join('');
  }

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
    let activeProjects = [];
    try { activeProjects = getProjects().slice(0, 3); } catch(e) {}

    if (activeProjects.length > 0) {
      projBlock.style.display = 'block';
      projList.innerHTML = activeProjects.map(p => {
        const steps = p.steps || [];
        const done = steps.filter(s => s.done).length;
        const pct = steps.length > 0 ? Math.round(done / steps.length * 100) : (p.progress || 0);
        const nextStep = steps.find(s => !s.done);
        return `<div style="margin-bottom:10px;cursor:pointer" onclick="switchTab('projects')">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px">
            <div style="flex:1">
              <div style="font-size:13px;font-weight:700;color:#1e1040">${escapeHtml(p.name)}</div>
              ${p.subtitle ? `<div style="font-size:10px;color:rgba(30,16,64,0.4);margin-top:1px;font-weight:600">${escapeHtml(p.subtitle)}</div>` : ''}
              ${nextStep ? `<div style="font-size:10px;color:rgba(30,16,64,0.5);margin-top:2px;font-weight:600">→ ${escapeHtml(nextStep.text)}</div>` : ''}
            </div>
            <div style="font-size:20px;font-weight:900;color:#7c4a2a;line-height:1;margin-left:8px">${pct}%</div>
          </div>
          <div style="height:4px;background:rgba(30,16,64,0.07);border-radius:3px;overflow:hidden">
            <div style="height:100%;width:${pct}%;background:#7c4a2a;border-radius:3px;transition:width 0.5s"></div>
          </div>
        </div>`;
      }).join('');
    } else {
      projBlock.style.display = 'none';
    }
  }

  // === ЗВИЧКИ СТАТИСТИКА ===
  renderMeHabitsStats();

  // === ГРАФІК АКТИВНОСТІ ===
  renderMeActivityChart();
}

function renderMeActivityChart() {
  const chartEl = document.getElementById('me-activity-chart');
  const labelsEl = document.getElementById('me-activity-labels');
  const totalEl = document.getElementById('me-activity-total');
  if (!chartEl) return;

  const now = new Date();
  const todayDow = (now.getDay() + 6) % 7;
  const inbox = JSON.parse(localStorage.getItem('nm_inbox') || '[]');
  const dayLabels = ['Пн','Вт','Ср','Чт','Пт','Сб','Нд'];
  const accent = '#7c4a2a';

  const allBuildHabits = getHabits().filter(h => h.type !== 'quit');
  const activeTasks = getTasks().filter(t => t.status === 'active').length;
  const baseline = Math.max(1, Math.round(activeTasks / 7) + 1);

  const values = dayLabels.map((_, i) => {
    const daysAgo = todayDow - i;
    const d = new Date(now);
    d.setDate(now.getDate() - daysAgo);
    const ds = d.toDateString();
    if (daysAgo < 0) return null;
    const inboxCount = inbox.filter(item => new Date(item.ts).toDateString() === ds).length;
    const doneTasks = getTasks().filter(t => t.status === 'done' && t.completedAt && new Date(t.completedAt).toDateString() === ds).length;
    const log = getHabitLog();
    const dow = (d.getDay() + 6) % 7;
    const todayH = allBuildHabits.filter(h => (h.days || [0,1,2,3,4]).includes(dow));
    const doneH = todayH.filter(h => !!log[ds]?.[h.id]).length;
    return { val: inboxCount + doneTasks + doneH, norm: Math.max(1, todayH.length + Math.round(activeTasks / 7)) };
  });

  const validValues = values.filter(v => v !== null);
  const maxVal = Math.max(...validValues.map(v => v.val), baseline * 2, 1);
  const totalActivity = validValues.reduce((s, v) => s + v.val, 0);
  if (totalEl) totalEl.textContent = `${totalActivity} дій`;

  const W = chartEl.offsetWidth || 300;
  const H = 64;
  const padT = 6, padB = 10;
  const chartH = H - padT - padB;

  const xOf = i => (i + 0.5) * W / 7;
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
  const areaPath = `${linePath} L ${points[points.length-1].x.toFixed(1)} ${H} L ${points[0].x.toFixed(1)} ${H} Z`;

  const dots = points.map(p => {
    const isToday = p.i === todayDow;
    const aboveNorm = p.v >= p.norm;
    const fill = p.v === 0 ? 'rgba(124,74,42,0.2)' : aboveNorm ? '#16a34a' : '#c2410c';
    const r = isToday ? 5 : 3.5;
    return `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${r}" fill="${fill}" stroke="white" stroke-width="1.5"/>`;
  }).join('');

  const normLabelTop = Math.max(0, Math.round(baselineY) - 18);

  chartEl.innerHTML = `
    <svg width="${W}" height="${H}" style="display:block;overflow:visible">
      <defs>
        <linearGradient id="actGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${accent}" stop-opacity="0.18"/>
          <stop offset="100%" stop-color="${accent}" stop-opacity="0.02"/>
        </linearGradient>
      </defs>
      <line x1="0" y1="${baselineY.toFixed(1)}" x2="${W}" y2="${baselineY.toFixed(1)}"
            stroke="rgba(30,16,64,0.3)" stroke-width="1" stroke-dasharray="4,4"/>
      <path d="${areaPath}" fill="url(#actGrad)"/>
      <path d="${linePath}" fill="none" stroke="${accent}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      ${dots}
    </svg>
    <div style="position:absolute;right:0;top:${normLabelTop}px;font-size:9px;font-weight:700;letter-spacing:0.03em;color:rgba(30,16,64,0.45);background:rgba(245,240,235,0.85);padding:1px 5px;border-radius:4px;line-height:1.4;pointer-events:none">НОРМА</div>
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

  const reply = await callAI(systemPrompt, userData, {});
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

Дані: ${userData}`, {});
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

export function addMeChatMsg(role, text, _noSave = false, id = '') {
  const el = document.getElementById('me-chat-messages');
  if (!el) return;
  if (!_noSave) { try { openChatBar('me'); } catch(e) {} }
  const isAgent = role === 'agent';
  const div = document.createElement('div');
  div.style.cssText = `display:flex;${isAgent ? '' : 'justify-content:flex-end'}`;
  div.innerHTML = `<div ${id ? `id="${id}"` : ''} class="msg-bubble ${isAgent ? 'msg-bubble--agent' : 'msg-bubble--user'}">${escapeHtml(text)}</div>`;
  el.appendChild(div);
  el.scrollTop = el.scrollHeight;
  if (!_noSave) saveChatMsg('me', role, text);
}
// === WINDOW EXPORTS (HTML handlers only) ===
Object.assign(window, {
  sendMeChatMessage,
  showMeChatMessages,
  refreshMeAnalysis,
});
