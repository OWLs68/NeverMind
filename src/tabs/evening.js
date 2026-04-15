// ============================================================
// app-evening-moments.js — Вкладки Я і Вечір, AI бари
// Залежності: app-core.js, app-ai-core.js
// ============================================================

import { currentTab, showToast, switchTab } from '../core/nav.js';
import { escapeHtml, logRecentAction } from '../core/utils.js';
import { callAI, callAIWithHistory, getAIContext, getMeStatsContext, getOWLPersonality, openChatBar, safeAgentReply, saveChatMsg } from '../ai/core.js';
import { getTasks, setupModalSwipeClose } from './tasks.js';
import { getHabits, getHabitLog, getHabitPct, getHabitStreak, getQuitStatus, processUniversalAction } from './habits.js';
import { getNotes } from './notes.js';
import { getCurrency, getFinance } from './finance.js';
import { getProjects } from './projects.js';

// === ME TAB CHAT ===
let _eveningTypingEl = null;
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
  input.focus(); // утримуємо клавіатуру

  addMeChatMsg('user', text);
  meChatHistory.push({ role: 'user', content: text });

  const loadId = 'me-chat-load-' + Date.now();
  addMeChatMsg('agent', '…', false, loadId);

  const context = getAIContext();
  const stats = getMeStatsContext();
  const systemPrompt = `${getOWLPersonality()} Аналізуєш дані користувача і даєш чесний, корисний зворотній звʼязок. Відповіді — 2-4 речення, конкретно і по ділу. Відповідай українською. НЕ вигадуй факти яких немає в даних.
Якщо треба виконати дію — відповідай JSON:
- Задача: {"action":"create_task","title":"назва","steps":[]}
- Звичка: {"action":"create_habit","name":"назва","days":[0,1,2,3,4,5,6]}
- Редагувати звичку: {"action":"edit_habit","habit_id":ID,"name":"нова назва","days":[0,1,2,3,4,5,6]}
- Закрити задачу: {"action":"complete_task","task_id":ID}
- Відмітити звичку: {"action":"complete_habit","habit_name":"назва"}
- Редагувати задачу: {"action":"edit_task","task_id":ID,"title":"назва","dueDate":"YYYY-MM-DD","priority":"normal|important|critical"}
- Видалити задачу: {"action":"delete_task","task_id":ID}
- Видалити звичку: {"action":"delete_habit","habit_id":ID}
- Перевідкрити задачу: {"action":"reopen_task","task_id":ID}
- Записати момент дня: {"action":"add_moment","text":"що сталося"}
- Нотатка: {"action":"create_note","text":"текст","folder":null}
- Витрата: {"action":"save_finance","fin_type":"expense","amount":число,"category":"категорія","comment":"текст"}
- Подія: {"action":"create_event","title":"назва","date":"YYYY-MM-DD","time":null,"priority":"normal"}
- Змінити подію: {"action":"edit_event","event_id":ID,"date":"YYYY-MM-DD"}
- Видалити подію: {"action":"delete_event","event_id":ID}
- Змінити нотатку: {"action":"edit_note","note_id":ID,"text":"новий текст"}
- Розпорядок: {"action":"save_routine","day":"mon" або масив,"blocks":[{"time":"07:00","activity":"Підйом"}]}
ЗАДАЧА = дія ЗРОБИТИ. ПОДІЯ = факт що СТАНЕТЬСЯ. "Перенеси подію" = edit_event.${context ? '\n\n' + context : ''}${stats ? '\n\n' + stats : ''}`;

  const reply = await callAIWithHistory(systemPrompt, [...meChatHistory]);
  const loadEl = document.getElementById(loadId);

  // Спробуємо розпарсити JSON дію
  let handled = false;
  if (reply) {
    try {
      const jsonMatch = reply.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.action && processUniversalAction(parsed, text, (r, t) => addMeChatMsg(r, t))) {
          if (loadEl) loadEl.textContent = '✅';
          handled = true;
        }
      }
    } catch(e) {}
  }

  if (!handled && loadEl) loadEl.textContent = reply || 'Не вдалося отримати відповідь.';
  if (reply) meChatHistory.push({ role: 'assistant', content: reply });
  if (meChatHistory.length > 20) meChatHistory = meChatHistory.slice(-20);
}

// === ME TAB ===
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
      // Задачі закриті цього дня
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
    // Поточний тиждень (Пн–сьогодні)
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
    const diffVal = (a, b) => { const d = a - b; return (d >= 0 ? '+' : '') + d; };

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
      // Якщо немає mood — дивимось позитивні моменти
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

  // === АКТИВНІ ПРОЕКТИ (заглушка — поки даних немає) ===
  // Проекти будуть реалізовані як окрема вкладка — тут показуємо задачі-проекти
  const projBlock = document.getElementById('me-projects-block');
  const projList = document.getElementById('me-projects-list');
  if (projBlock && projList) {
    // Реальні проекти з nm_projects
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

  // Базова норма = build звички на цей день + активні задачі / 7
  const allBuildHabits = getHabits().filter(h => h.type !== 'quit');
  const activeTasks = getTasks().filter(t => t.status === 'active').length;
  const baseline = Math.max(1, Math.round(activeTasks / 7) + 1); // мінімум 1

  // Рахуємо активність за кожен день тижня
  const values = dayLabels.map((_, i) => {
    const daysAgo = todayDow - i;
    const d = new Date(now);
    d.setDate(now.getDate() - daysAgo);
    const ds = d.toDateString();
    if (daysAgo < 0) return null; // майбутнє
    const inboxCount = inbox.filter(item => new Date(item.ts).toDateString() === ds).length;
    const doneTasks = getTasks().filter(t => t.status === 'done' && t.completedAt && new Date(t.completedAt).toDateString() === ds).length;
    const log = getHabitLog();
    const dow = (d.getDay() + 6) % 7;
    const todayH = allBuildHabits.filter(h => (h.days || [0,1,2,3,4]).includes(dow));
    const doneH = todayH.filter(h => !!log[ds]?.[h.id]).length;
    // Норма цього дня = build звички за цей день + 1 (мінімум)
    return { val: inboxCount + doneTasks + doneH, norm: Math.max(1, todayH.length + Math.round(activeTasks / 7)) };
  });

  const validValues = values.filter(v => v !== null);
  const maxVal = Math.max(...validValues.map(v => v.val), baseline * 2, 1);
  const totalActivity = validValues.reduce((s, v) => s + v.val, 0);
  if (totalEl) totalEl.textContent = `${totalActivity} дій`;

  // Реальна ширина контейнера — уникаємо preserveAspectRatio:none
  const W = chartEl.offsetWidth || 300;
  const H = 64;
  const padT = 6, padB = 10;
  const chartH = H - padT - padB;

  // Центр колонки i при 7 рівних стовпцях = (i + 0.5) * W / 7
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

  // Кольорові точки — зелені вище норми, червоні нижче
  const dots = points.map(p => {
    const isToday = p.i === todayDow;
    const aboveNorm = p.v >= p.norm;
    const fill = p.v === 0 ? 'rgba(124,74,42,0.2)' : aboveNorm ? '#16a34a' : '#c2410c';
    const r = isToday ? 5 : 3.5;
    return `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${r}" fill="${fill}" stroke="white" stroke-width="1.5"/>`;
  }).join('');

  // Позиція мітки "НОРМА" — HTML-оверлей, точний шрифт без SVG-спотворень
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

  // Генеруємо 3 поради окремим запитом
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

// === EVENING TAB ===
let currentMomentMood = 'positive';
let dialogHistory = [];
let dialogLoading = false;

export function getMoments() { return JSON.parse(localStorage.getItem('nm_moments') || '[]'); }
export function saveMoments(arr) { localStorage.setItem('nm_moments', JSON.stringify(arr)); window.dispatchEvent(new CustomEvent('nm-data-changed', { detail: 'moments' })); }

export function renderEvening() {
  const today = new Date().toDateString();
  const todayMoments = getMoments().filter(m => new Date(m.ts).toDateString() === today);

  // === 1. Три статки ===
  const statsEl = document.getElementById('evening-stats-row');
  if (statsEl) {
    const doneTasks = getTasks().filter(t => t.status === 'done' && t.completedAt && new Date(t.completedAt).toDateString() === today).length;
    const habits = getHabits();
    const buildHabitsEvening = habits.filter(h => h.type !== 'quit');
    const log = getHabitLog();
    const todayDow = (new Date().getDay() + 6) % 7;
    const todayH = buildHabitsEvening.filter(h => (h.days || [0,1,2,3,4,5,6]).includes(todayDow));
    const doneH = todayH.filter(h => !!log[today]?.[h.id]).length;
    let todayExp = 0;
    try { todayExp = getFinance().filter(t => t.type === 'expense' && new Date(t.ts).toDateString() === today).reduce((s, t) => s + t.amount, 0); } catch(e) {}
    const cur = getCurrency();
    statsEl.innerHTML = `
      <div style="flex:1;background:rgba(255,255,255,0.72);border:1.5px solid rgba(255,255,255,0.75);border-radius:12px;padding:10px 6px;text-align:center">
        <div style="font-size:22px;font-weight:900;color:#1e3350;line-height:1">${doneTasks}</div>
        <div style="font-size:10px;font-weight:700;color:rgba(30,16,64,0.4);margin-top:2px">задачі ✓</div>
      </div>
      <div style="flex:1;background:rgba(255,255,255,0.72);border:1.5px solid rgba(255,255,255,0.75);border-radius:12px;padding:10px 6px;text-align:center">
        <div style="font-size:22px;font-weight:900;color:#16a34a;line-height:1">${todayH.length > 0 ? doneH + '/' + todayH.length : '—'}</div>
        <div style="font-size:10px;font-weight:700;color:rgba(30,16,64,0.4);margin-top:2px">звички</div>
      </div>
      <div style="flex:1;background:rgba(255,255,255,0.72);border:1.5px solid rgba(255,255,255,0.75);border-radius:12px;padding:10px 6px;text-align:center">
        <div style="font-size:22px;font-weight:900;color:#c2410c;line-height:1">${todayExp > 0 ? cur + Math.round(todayExp) : '—'}</div>
        <div style="font-size:10px;font-weight:700;color:rgba(30,16,64,0.4);margin-top:2px">витрати</div>
      </div>`;
  }

  // === 2. Кільце продуктивності (динамічна формула) ===
  // Кожне джерело дає 0..1, скор = середнє тих що мають дані
  const sources = [];

  // Звички: % виконаних за сьогодні
  const habits2 = getHabits().filter(h => h.type !== 'quit'); const log2 = getHabitLog();
  const todayDow2 = (new Date().getDay() + 6) % 7;
  const todayH2 = habits2.filter(h => (h.days || [0,1,2,3,4,5,6]).includes(todayDow2));
  const doneH2 = todayH2.filter(h => !!log2[today]?.[h.id]).length;
  if (todayH2.length > 0) sources.push(doneH2 / todayH2.length);

  // Задачі: closedToday / max(totalActive * 0.2, 1)
  const allTasks = getTasks();
  const doneTasks2 = allTasks.filter(t => t.status === 'done' && t.completedAt && new Date(t.completedAt).toDateString() === today).length;
  const activeTasks = allTasks.filter(t => t.status === 'active').length;
  if (doneTasks2 > 0 || activeTasks > 0) sources.push(Math.min(doneTasks2 / Math.max(activeTasks * 0.2, 1), 1));

  // Проекти: stepsClosedToday / max(totalOpenSteps * 0.2, 1)
  const activeProjs = getProjects().filter(p => p.status === 'active');
  const allSteps = activeProjs.flatMap(p => p.steps || []);
  const stepsToday = allSteps.filter(s => s.done && s.doneAt && new Date(s.doneAt).toDateString() === today).length;
  const openSteps = allSteps.filter(s => !s.done).length;
  if (stepsToday > 0 || openSteps > 0) sources.push(Math.min(stepsToday / Math.max((openSteps + stepsToday) * 0.2, 1), 1));

  const score = sources.length > 0 ? Math.round((sources.reduce((a, b) => a + b, 0) / sources.length) * 100) : 0;

  const arc = document.getElementById('evening-ring-arc');
  const pctEl = document.getElementById('evening-ring-pct');
  const descEl = document.getElementById('evening-score-desc');
  if (arc) { const circ = 151; setTimeout(() => { arc.style.strokeDashoffset = circ - (circ * score / 100); }, 100); }
  if (pctEl) pctEl.textContent = score + '%';
  if (descEl) descEl.textContent = sources.length === 0 ? 'Додай задачі або звички' : score >= 70 ? 'Гарний день 💪' : score >= 40 ? 'Середній день' : 'Важкий день';

  // === 3. Настрій ===
  const savedMood = getEveningMood();
  if (savedMood) renderEveningMoodButtons(savedMood);

  // === 4. Моменти дня ===
  const momEl = document.getElementById('evening-moments');
  if (momEl) {
    const todayNotes = getNotes().filter(n => new Date(n.ts || n.createdAt || 0).toDateString() === today);
    const notesAsItems = todayNotes.map(n => ({ id: 'note_' + n.id, text: n.title || n.text || '', mood: 'neutral', ts: n.ts || n.createdAt || 0, isNote: true }));
    const allItems = [...todayMoments, ...notesAsItems].sort((a, b) => (a.ts || 0) - (b.ts || 0));

    if (allItems.length === 0) {
      momEl.innerHTML = '<div style="font-size:13px;color:rgba(30,16,64,0.3);text-align:center;padding:8px 0">Додай моменти свого дня</div>';
    } else {
      const moodDots = { positive: '#16a34a', neutral: '#f59e0b', negative: '#ef4444' };
      momEl.innerHTML = allItems.map(m => {
        const dot = m.isNote ? '#818cf8' : (moodDots[m.mood] || '#888');
        const timeStr = m.ts ? new Date(m.ts).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' }) : '';
        const clickable = !m.isNote;
        return `<div style="display:flex;gap:8px;align-items:flex-start;padding:7px 0;border-bottom:1px solid rgba(30,16,64,0.06)${clickable ? ';cursor:pointer' : ''}"${clickable ? ` onclick="openMomentView(${m.id})"` : ''}>
          <div style="width:7px;height:7px;border-radius:50%;background:${dot};flex-shrink:0;margin-top:5px"></div>
          <div style="flex:1">
            <div style="font-size:13px;color:#1e1040;font-weight:500;line-height:1.45">${escapeHtml(m.summary || m.text)}</div>
            ${timeStr ? `<div style="font-size:10px;color:rgba(30,16,64,0.3);font-weight:600;margin-top:2px">${timeStr}</div>` : ''}
          </div>
          ${!m.isNote ? `<div onclick="event.stopPropagation();deleteMoment(${m.id})" style="font-size:18px;color:rgba(30,16,64,0.2);cursor:pointer;padding:0 2px">×</div>` : ''}
        </div>`;
      }).join('');
    }
  }

  // === 5. Фінанси сьогодні ===
  const finBlock = document.getElementById('evening-finance-block');
  const finContent = document.getElementById('evening-finance-content');
  try {
    const todayTxs = getFinance().filter(t => new Date(t.ts).toDateString() === today);
    if (finBlock && finContent && todayTxs.length > 0) {
      finBlock.style.display = 'block';
      const cur = getCurrency ? getCurrency() : '₴';
      const todayExpF = todayTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
      finContent.innerHTML = todayTxs.slice(0, 5).map(t =>
        `<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;border-bottom:1px solid rgba(30,16,64,0.06)">
          <span style="font-size:13px;font-weight:600;color:rgba(30,16,64,0.6)">${escapeHtml(t.category)}${t.comment ? ' · ' + escapeHtml(t.comment) : ''}</span>
          <span style="font-size:14px;font-weight:800;color:${t.type === 'expense' ? '#c2410c' : '#16a34a'}">${t.type === 'expense' ? '-' : '+'}${cur}${Math.round(t.amount)}</span>
        </div>`
      ).join('') + `<div style="margin-top:7px;padding-top:6px;border-top:1px solid rgba(30,16,64,0.06);display:flex;justify-content:space-between">
        <span style="font-size:11px;font-weight:700;color:rgba(30,16,64,0.4)">Всього витрати</span>
        <span style="font-size:13px;font-weight:800;color:#c2410c">${todayExpF > 0 ? '-' + cur + Math.round(todayExpF) : '—'}</span>
      </div>`;
    } else if (finBlock) { finBlock.style.display = 'none'; }
  } catch(e) { if (finBlock) finBlock.style.display = 'none'; }

  // === 6. Відновлюємо підсумок OWL ===
  try {
    const saved = JSON.parse(localStorage.getItem('nm_evening_summary') || 'null');
    const el = document.getElementById('evening-summary');
    const btn = document.getElementById('evening-summary-btn');
    if (saved && saved.date === today && saved.text && el) {
      el.textContent = saved.text;
      el.style.color = 'white';
      if (btn) btn.textContent = 'Оновити';
    }
  } catch(e) {}
}

export function getEveningMood() {
  const today = new Date().toDateString();
  try {
    const saved = JSON.parse(localStorage.getItem('nm_evening_mood') || 'null');
    if (saved && saved.date === today) return saved.mood;
  } catch(e) {}
  return null;
}

function setEveningMood(level) {
  const today = new Date().toDateString();
  localStorage.setItem('nm_evening_mood', JSON.stringify({ mood: level, date: today }));
  renderEveningMoodButtons(level);
  renderEvening();
}

function renderEveningMoodButtons(active) {
  ['bad','meh','ok','good','fire'].forEach(m => {
    const btn = document.getElementById('evening-mood-' + m);
    if (!btn) return;
    const isActive = m === active;
    btn.style.opacity = isActive ? '1' : '0.4';
    btn.style.background = isActive ? 'white' : 'rgba(30,16,64,0.06)';
    btn.style.boxShadow = isActive ? '0 2px 10px rgba(0,0,0,0.12)' : 'none';
    btn.style.transform = isActive ? 'scale(1.1)' : 'scale(1)';
  });
}

function openAddMoment() {
  currentMomentMood = 'positive';
  document.getElementById('moment-input-text').value = '';
  updateMoodButtons();
  document.getElementById('moment-modal').style.display = 'flex';
  setTimeout(() => { const el = document.getElementById('moment-input-text'); el.removeAttribute('readonly'); el.focus(); }, 350);
}

function closeMomentModal() {
  document.getElementById('moment-modal').style.display = 'none';
}

function setMomentMood(mood) {
  currentMomentMood = mood;
  updateMoodButtons();
}

function updateMoodButtons() {
  ['positive','neutral','negative'].forEach(m => {
    const btn = document.getElementById('mood-' + m);
    if (!btn) return;
    btn.style.opacity = currentMomentMood === m ? '1' : '0.4';
    btn.style.transform = currentMomentMood === m ? 'scale(1.04)' : 'scale(1)';
  });
}

function saveMoment() {
  const text = document.getElementById('moment-input-text').value.trim();
  if (!text) { showToast('Введіть текст моменту'); return; }
  const moments = getMoments();
  const newMoment = { id: Date.now(), text, mood: currentMomentMood, ts: Date.now() };
  moments.push(newMoment);
  saveMoments(moments);
  logRecentAction('add_moment', text.substring(0, 40), 'evening');
  closeMomentModal();
  renderEvening();
  showToast('✓ Момент збережено');
  // Генеруємо короткий summary через ШІ (у фоні, не блокує UI)
  generateMomentSummary(newMoment.id, text);
}

export async function generateMomentSummary(momentId, text) {
  const key = localStorage.getItem('nm_gemini_key');
  if (!key) return;
  // Не генеруємо для коротких текстів — вони вже короткі
  if (text.length <= 60) return;
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: `Стисни цей момент дня до 1 короткої фрази (максимум 7 слів, без крапки в кінці, українською): "${text}"` }],
        max_tokens: 30, temperature: 0.5
      })
    });
    const data = await res.json();
    const summary = data.choices?.[0]?.message?.content?.trim().replace(/["""]/g, '');
    if (!summary) return;
    // Зберігаємо summary в обʼєкт моменту
    const moments = getMoments();
    const idx = moments.findIndex(m => m.id === momentId);
    if (idx !== -1) {
      moments[idx].summary = summary;
      saveMoments(moments);
      renderEvening(); // оновлюємо UI після отримання summary
    }
  } catch(e) {}
}

function deleteMoment(id) {
  saveMoments(getMoments().filter(m => m.id !== id));
  renderEvening();
}

const EVENING_SUMMARY_PROMPT = `${getOWLPersonality()} Зроби підсумок дня (3-4 речення) у своєму стилі. Звертайся на "ти". Відзнач що сьогодні вдалось. Якщо є що покращити — скажи конкретно. Завершуй думкою на завтра. Відповідай українською.

ЗДОРОВ'Я у підсумку (Фаза 5):
- Якщо у контексті є "Активні стани здоров'я" і юзер мав пропущені дози сьогодні (history записи типу 'auto' з "Пропустив дозу") — м'яко згадай ("Пропустив дозу Омезу — не забудь завтра"). БЕЗ моралізаторства.
- Якщо дисципліна курсу добра (всі дози прийняті, є status_change з покращенням) — похвали конкретно ("Курс Омезу тримаєш чітко").
- Згадка здоров'я — ОПЦІЙНА. Якщо нічого особливого — не вигадуй.`;

async function generateEveningSummary() {
  const btn = document.getElementById('evening-summary-btn');
  const el = document.getElementById('evening-summary');
  btn.textContent = '…';
  btn.disabled = true;
  el.textContent = '…';

  const today = new Date().toDateString();
  const moments = getMoments().filter(m => new Date(m.ts).toDateString() === today);
  const inbox = JSON.parse(localStorage.getItem('nm_inbox') || '[]').filter(i => new Date(i.ts).toDateString() === today);
  const aiContext = getAIContext();

  const systemPrompt = EVENING_SUMMARY_PROMPT + (aiContext ? `\n\n${aiContext}` : '');

  const dayData = `Моменти дня: ${moments.map(m=>`[${m.mood}] ${m.text}`).join('; ') || 'немає'}
Записи в Inbox за сьогодні: ${inbox.map(i=>`[${i.category}] ${i.text}`).join('; ') || 'немає'}`;

  // Quit звички в контексті вечора
  let _quitCtx = '';
  try {
    const _qh = getHabits().filter(h => h.type === 'quit');
    if (_qh.length > 0) {
      const _ts = new Date().toISOString().slice(0, 10);
      _quitCtx = '\nЧеленджі "Кинути": ' + _qh.map(h => {
        const s = getQuitStatus(h.id);
        return '"' + h.name + '": ' + (s.streak||0) + ' дн, ' + (s.lastHeld===_ts ? 'тримався ✓' : 'не відмічено');
      }).join('; ');
    }
  } catch(e) {}
  const reply = await callAI(systemPrompt, dayData + _quitCtx, {});
  const text = reply || 'Не вдалось отримати підсумок.';
  el.textContent = text;
  // Зберігаємо підсумок в localStorage — відновиться після перезапуску
  localStorage.setItem('nm_evening_summary', JSON.stringify({ text, date: today }));
  btn.textContent = '↻';
  btn.disabled = false;
}

// === АВТОПІДСУМОК ВЕЧОРА ЩОГОДИНИ ===
async function autoEveningSummary() {
  const key = localStorage.getItem('nm_gemini_key');
  if (!key) return;

  // Підсумок дня має сенс тільки з вечора — до 18:00 не генеруємо
  if (new Date().getHours() < 18) return;

  // Перевіряємо чи є взагалі записи за сьогодні
  const today = new Date().toDateString();
  const moments = getMoments().filter(m => new Date(m.ts).toDateString() === today);
  const inbox = JSON.parse(localStorage.getItem('nm_inbox') || '[]').filter(i => new Date(i.ts).toDateString() === today);
  if (moments.length === 0 && inbox.length === 0) return; // нема чого підсумовувати

  // Перевіряємо чи не оновлювали менше ніж 50 хвилин тому
  try {
    const saved = JSON.parse(localStorage.getItem('nm_evening_summary') || 'null');
    if (saved && saved.date === today && saved.autoTs) {
      const elapsed = Date.now() - saved.autoTs;
      if (elapsed < 50 * 60 * 1000) return; // 50 хвилин
    }
  } catch(e) {}

  const aiContext = getAIContext();
  const systemPrompt = EVENING_SUMMARY_PROMPT + (aiContext ? `\n\n${aiContext}` : '');
  const dayData = `Моменти дня: ${moments.map(m=>`[${m.mood}] ${m.text}`).join('; ') || 'немає'}
Записи в Inbox за сьогодні: ${inbox.map(i=>`[${i.category}] ${i.text}`).join('; ') || 'немає'}`;

  try {
    const reply = await callAI(systemPrompt, dayData, {});
    if (!reply) return;
    // Зберігаємо з позначкою autoTs — щоб не запускати занадто часто
    localStorage.setItem('nm_evening_summary', JSON.stringify({ text: reply, date: today, autoTs: Date.now() }));
    // Якщо зараз відкрита вкладка Вечір — оновлюємо UI
    if (currentTab === 'evening') {
      const el = document.getElementById('evening-summary');
      if (el) el.textContent = reply;
    }
  } catch(e) {}
}

export function setupAutoEveningSummary() {
  // Перший раз — через 5 хвилин після старту
  setTimeout(() => {
    autoEveningSummary();
    // Далі — кожну годину
    setInterval(autoEveningSummary, 60 * 60 * 1000);
  }, 5 * 60 * 1000);
}

// Evening dialog
function openEveningDialog() {
  dialogHistory = [];
  document.getElementById('evening-dialog').style.display = 'flex';
  document.getElementById('dialog-messages').innerHTML = '';
  document.getElementById('dialog-input').value = '';

  // Перше повідомлення від агента
  const settings = JSON.parse(localStorage.getItem('nm_settings') || '{}');
  const name = settings.name ? `, ${settings.name}` : '';
  addDialogMessage('agent', `Привіт${name}. Розкажи як пройшов день — що вийшло, що ні. Без прикрас.`);
}

function closeEveningDialog() {
  document.getElementById('evening-dialog').style.display = 'none';
}

function addDialogMessage(role, text) {
  const el = document.getElementById('dialog-messages');
  const isAgent = role === 'agent';
  const div = document.createElement('div');
  div.style.cssText = `display:flex;${isAgent ? '' : 'justify-content:flex-end'}`;
  div.innerHTML = `<div style="max-width:80%;background:${isAgent ? 'rgba(237,233,255,0.9)' : '#7c3aed'};color:${isAgent ? '#4c1d95' : 'white'};border-radius:${isAgent ? '4px 16px 16px 16px' : '16px 4px 16px 16px'};padding:10px 13px;font-size:15px;line-height:1.55;font-weight:500">${escapeHtml(text)}</div>`;
  el.appendChild(div);
  el.scrollTop = el.scrollHeight;
  dialogHistory.push({ role: isAgent ? 'assistant' : 'user', content: text });
}

async function sendDialogMessage() {
  if (dialogLoading) return;
  const input = document.getElementById('dialog-input');
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  input.style.height = 'auto';
  addDialogMessage('user', text);
  dialogLoading = true;

  const aiContext = getAIContext();
  const today = new Date().toDateString();
  const moments = getMoments().filter(m => new Date(m.ts).toDateString() === today);
  const systemPrompt = `${getOWLPersonality()} Короткі відповіді (1-3 речення). Конкретно і по ділу. Відповідай українською.${aiContext ? '\n\n' + aiContext : ''}
Контекст дня: ${moments.map(m=>`[${m.mood}] ${m.text}`).join('; ') || 'моменти не додані'}`;

  const key = localStorage.getItem('nm_gemini_key');
  if (!key) { addDialogMessage('agent', 'Введи OpenAI ключ в налаштуваннях.'); dialogLoading = false; return; }

  // Відправляємо всю історію
  const messages = [
    { role: 'system', content: systemPrompt },
    ...dialogHistory.slice(-10) // останні 10 повідомлень
  ];

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({ model: 'gpt-4o-mini', messages, max_tokens: 200, temperature: 0.8 })
    });
    const data = await res.json();
    const reply = data.choices?.[0]?.message?.content;
    if (reply) addDialogMessage('agent', reply);
    else addDialogMessage('agent', 'Щось пішло не так. Спробуй ще раз.');
  } catch {
    addDialogMessage('agent', 'Мережева помилка.');
  }
  dialogLoading = false;
}


// === ME AI BAR ===
let meBarLoading = false;

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

// === EVENING AI BAR ===
let eveningBarHistory = [];
let eveningBarLoading = false;

function showEveningBarMessages() {
  openChatBar('evening');
}

export function addEveningBarMsg(role, text, _noSave = false) {
  const el = document.getElementById('evening-bar-messages');
  if (!el) return;
  if (_eveningTypingEl) { _eveningTypingEl.remove(); _eveningTypingEl = null; }
  if (role === 'typing') {
    const td = document.createElement('div');
    td.style.cssText = 'display:flex';
    td.innerHTML = '<div style="background:rgba(255,255,255,0.12);border-radius:4px 12px 12px 12px;padding:5px 10px"><div class=\"ai-typing\"><span></span><span></span><span></span></div></div>';
    el.appendChild(td);
    _eveningTypingEl = td;
    el.scrollTop = el.scrollHeight;
    return;
  }
  if (!_noSave) { try { openChatBar('evening'); } catch(e) {} }
  const isAgent = role === 'agent';
  const div = document.createElement('div');
  div.style.cssText = `display:flex;${isAgent ? '' : 'justify-content:flex-end'}`;
  div.innerHTML = `<div class="msg-bubble ${isAgent ? 'msg-bubble--agent' : 'msg-bubble--user'}">${escapeHtml(text)}</div>`;
  el.appendChild(div);
  el.scrollTop = el.scrollHeight;
  if (role !== 'agent') eveningBarHistory.push({ role: 'user', content: text });
  else eveningBarHistory.push({ role: 'assistant', content: text });
  if (!_noSave) saveChatMsg('evening', role, text);
}

export async function sendEveningBarMessage() {
  if (eveningBarLoading) return;
  const input = document.getElementById('evening-bar-input');
  const text = input.value.trim();
  if (!text) return;
  const key = localStorage.getItem('nm_gemini_key');
  if (!key) { addEveningBarMsg('agent', 'Введи OpenAI ключ в налаштуваннях.'); return; }
  input.value = ''; input.style.height = 'auto';
  input.focus(); // утримуємо клавіатуру
  addEveningBarMsg('user', text);
  eveningBarLoading = true;
  addEveningBarMsg('typing', '');

  const today = new Date().toDateString();
  const moments = getMoments().filter(m => new Date(m.ts).toDateString() === today);
  const inbox = JSON.parse(localStorage.getItem('nm_inbox') || '[]').filter(i => new Date(i.ts).toDateString() === today);
  const todayNotes = JSON.parse(localStorage.getItem('nm_notes') || '[]').filter(n => new Date(n.ts || n.createdAt || 0).toDateString() === today);
  const aiContext = getAIContext();
  const systemPrompt = `${getOWLPersonality()} Короткі відповіді (1-3 речення).
Моменти дня: ${moments.map(m=>`[${m.mood}] ${m.text}`).join('; ') || 'не додані'}.
Нотатки сьогодні: ${todayNotes.map(n=>n.title||n.text||'').join('; ') || 'немає'}.
Всі записи: ${inbox.map(i=>`[${i.category}] ${i.text}`).join('; ') || 'немає'}.
Якщо треба зберегти запис — відповідай JSON:
- Нотатка: {"action":"create_note","text":"текст","folder":null}
- Задача: {"action":"create_task","title":"назва","steps":[]}
- Звичка: {"action":"create_habit","name":"назва","days":[0,1,2,3,4,5,6]}
- Редагувати звичку: {"action":"edit_habit","habit_id":ID,"name":"нова назва","days":[0,1,2,3,4,5,6]}
- Закрити задачу: {"action":"complete_task","task_id":ID}
- Відмітити звичку: {"action":"complete_habit","habit_name":"назва"}
- Редагувати задачу: {"action":"edit_task","task_id":ID,"title":"назва","dueDate":"YYYY-MM-DD","priority":"normal|important|critical"}
- Видалити задачу: {"action":"delete_task","task_id":ID}
- Видалити звичку: {"action":"delete_habit","habit_id":ID}
- Перевідкрити задачу: {"action":"reopen_task","task_id":ID}
- Записати момент дня: {"action":"add_moment","text":"що сталося"}
- Витрата: {"action":"save_finance","fin_type":"expense","amount":число,"category":"категорія","comment":"текст"}
- Дохід: {"action":"save_finance","fin_type":"income","amount":число,"category":"категорія","comment":"текст"}
- Подія з датою: {"action":"create_event","title":"назва","date":"YYYY-MM-DD","time":null,"priority":"normal"}
- Змінити подію: {"action":"edit_event","event_id":ID,"date":"YYYY-MM-DD"}
- Видалити подію: {"action":"delete_event","event_id":ID}
- Змінити нотатку: {"action":"edit_note","note_id":ID,"text":"новий текст"}
- Розпорядок: {"action":"save_routine","day":"mon" або масив,"blocks":[{"time":"07:00","activity":"Підйом"}]}
ЗАДАЧА = дія ЗРОБИТИ. ПОДІЯ = факт що СТАНЕТЬСЯ. "Перенеси подію" = edit_event.
Інакше — текст українською 1-3 речення.
НЕ вигадуй ліміти, плани або факти яких немає в даних вище.${aiContext ? '\n\n' + aiContext : ''}`;

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'system', content: systemPrompt }, ...eveningBarHistory.slice(-10)], max_tokens: 300, temperature: 0.8 })
    });
    const data = await res.json();
    const reply = data.choices?.[0]?.message?.content?.trim();
    if (!reply) { addEveningBarMsg('agent', 'Щось пішло не так.'); eveningBarLoading = false; return; }

    try {
      const jsonMatch = reply.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : reply.replace(/```json|```/g,'').trim());
      if (!processUniversalAction(parsed, text, addEveningBarMsg)) {
        safeAgentReply(reply, addEveningBarMsg);
      }
    } catch {
      safeAgentReply(reply, addEveningBarMsg);
    }
  } catch { addEveningBarMsg('agent', 'Мережева помилка.'); }
  eveningBarLoading = false;
}


// === MOMENT VIEW MODAL ===
function openMomentView(momentId) {
  const moments = JSON.parse(localStorage.getItem('nm_moments') || '[]');
  const m = moments.find(x => x.id === momentId);
  if (!m) return;

  const moodEmoji = { positive: '😊', neutral: '😐', negative: '😞' };
  const headerEl = document.getElementById('moment-view-header');
  const timeEl = document.getElementById('moment-view-time');
  const textEl = document.getElementById('moment-view-text');
  const summaryBlock = document.getElementById('moment-view-summary-block');
  const summaryEl = document.getElementById('moment-view-summary');

  if (headerEl) headerEl.textContent = (moodEmoji[m.mood] || '') + ' Момент дня';
  if (timeEl && m.ts) timeEl.textContent = new Date(m.ts).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
  if (textEl) textEl.textContent = m.text || '';

  if (summaryBlock && summaryEl && m.summary && m.summary !== m.text) {
    summaryEl.textContent = m.summary;
    summaryBlock.style.display = 'block';
  } else if (summaryBlock) {
    summaryBlock.style.display = 'none';
  }

  const modal = document.getElementById('moment-view-modal');
  if (modal) {
    modal.style.display = 'flex';
    setupModalSwipeClose(modal.querySelector(':scope > div:last-child'), closeMomentView);
  }
}

function closeMomentView() {
  const modal = document.getElementById('moment-view-modal');
  if (modal) modal.style.display = 'none';
}

// === WINDOW EXPORTS (HTML handlers only) ===
Object.assign(window, {
  openAddMoment, saveMoment, closeMomentModal, setMomentMood,
  generateEveningSummary, closeEveningDialog, setEveningMood,
  sendDialogMessage, sendEveningBarMessage, sendMeChatMessage,
  switchTab, deleteMoment, openMomentView, closeMomentView,
});
