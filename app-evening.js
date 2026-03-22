// ============================================================
// app-evening.js — Вечір, Я, моменти, підсумок, слайди, онбординг, Me/Evening AI bar
// Функції: renderEvening, renderMe, saveMoment, generateEveningSummary, checkOnboarding, openSlidesTour, sendMeChatMessage, sendEveningBarMessage, addMeChatMsg
// Залежності: app-core.js, app-ai.js
// ============================================================

// === ME TAB CHAT ===
let meChatHistory = [];

function renderMeHabitsStats() {
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

async function sendMeChatMessage() {
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
  const systemPrompt = `${getOWLPersonality()} Аналізуєш дані користувача і даєш чесний, корисний зворотній звʼязок. Відповіді — 2-4 речення, конкретно і по ділу. Відповідай українською. НЕ вигадуй факти яких немає в даних.${context ? '\n\n' + context : ''}${stats ? '\n\n' + stats : ''}`;

  const reply = await callAIWithHistory(systemPrompt, [...meChatHistory]);
  const loadEl = document.getElementById(loadId);
  if (loadEl) loadEl.textContent = reply || 'Не вдалося отримати відповідь.';
  if (reply) meChatHistory.push({ role: 'assistant', content: reply });
  if (meChatHistory.length > 20) meChatHistory = meChatHistory.slice(-20);
}

// === ME TAB ===
function renderMe() {
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
    let thisHabitPct = 0, prevHabitPct = 0;
    if (habits.length > 0) {
      let thisDone = 0, thisTotal = 0, prevDone = 0, prevTotal = 0;
      for (let i = 0; i <= todayDow; i++) {
        const d = new Date(weekStart); d.setDate(weekStart.getDate() + i);
        const dow = (d.getDay() + 6) % 7;
        const ds = d.toDateString();
        const dayH = habits.filter(h => (h.days || [0,1,2,3,4]).includes(dow));
        thisTotal += dayH.length;
        thisDone += dayH.filter(h => !!log[ds]?.[h.id]).length;
      }
      for (let i = 0; i < 7; i++) {
        const d = new Date(prevStart); d.setDate(prevStart.getDate() + i);
        const dow = (d.getDay() + 6) % 7;
        const ds = d.toDateString();
        const dayH = habits.filter(h => (h.days || [0,1,2,3,4]).includes(dow));
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

  // === НАЙБЛИЖЧИЙ ДЕДЛАЙН + КАЛЕНДАР ===
  const deadlineBlock = document.getElementById('me-deadline-block');
  const deadlineContent = document.getElementById('me-deadline-content');
  const calGrid = document.getElementById('me-cal-grid');
  const calLabel = document.getElementById('me-cal-label');
  if (deadlineBlock && deadlineContent) {
    // Задачі з дедлайном (поки шукаємо по тексту "завтра", "deadline" — справжні дедлайни будуть після Supabase)
    const activeTasks = getTasks().filter(t => t.status === 'active');
    if (activeTasks.length > 0) {
      deadlineBlock.style.display = 'block';
      // Перша активна задача як "найближчий"
      const t = activeTasks[0];
      deadlineContent.innerHTML = `<div style="display:flex;align-items:center;gap:10px">
        <div style="width:32px;height:32px;border-radius:10px;background:rgba(234,88,12,0.1);display:flex;align-items:center;justify-content:center;flex-shrink:0">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ea580c" stroke-width="2.5"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        </div>
        <div>
          <div style="font-size:13px;font-weight:700;color:#1e1040">${escapeHtml(t.title)}</div>
          <div style="font-size:10px;font-weight:800;color:#ea580c;margin-top:1px">Активна задача</div>
        </div>
      </div>`;

      // Міні-календар поточного місяця
      if (calGrid && calLabel) {
        const monthNames = ['Січень','Лютий','Березень','Квітень','Травень','Червень','Липень','Серпень','Вересень','Жовтень','Листопад','Грудень'];
        calLabel.textContent = monthNames[now.getMonth()] + ' · задачі';
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        const firstDow = (firstDay.getDay() + 6) % 7; // 0=Пн
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        // Дні з задачами (createdAt)
        const taskDays = new Set(getTasks().filter(t => t.createdAt).map(t => new Date(t.createdAt).getDate()));
        let cells = '';
        for (let i = 0; i < firstDow; i++) cells += '<div></div>';
        for (let d = 1; d <= daysInMonth; d++) {
          const isToday = d === now.getDate();
          const hasTask = taskDays.has(d);
          let style = 'aspect-ratio:1;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;';
          if (isToday) style += 'background:rgba(234,88,12,0.15);color:#ea580c;';
          else if (hasTask) style += 'background:#7c4a2a;color:white;';
          else style += 'background:rgba(30,16,64,0.04);color:rgba(30,16,64,0.3);';
          cells += `<div style="${style}">${d}</div>`;
        }
        calGrid.innerHTML = cells;
      }
    } else {
      deadlineBlock.style.display = 'none';
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

  // Рахуємо активність за кожен день тижня
  const values = dayLabels.map((_, i) => {
    const daysAgo = todayDow - i;
    const d = new Date(now);
    d.setDate(now.getDate() - daysAgo);
    const ds = d.toDateString();
    if (daysAgo < 0) return null; // майбутнє
    const inboxCount = inbox.filter(item => new Date(item.ts).toDateString() === ds).length;
    const doneTasks = getTasks().filter(t => t.status === 'done' && t.completedAt && new Date(t.completedAt).toDateString() === ds).length;
    const habits = getHabits();
    const log = getHabitLog();
    const dow = (d.getDay() + 6) % 7;
    const todayH = habits.filter(h => (h.days || [0,1,2,3,4]).includes(dow));
    const doneH = todayH.filter(h => !!log[ds]?.[h.id]).length;
    return inboxCount + doneTasks + doneH;
  });

  const validValues = values.filter(v => v !== null);
  const maxVal = Math.max(...validValues, 1);
  const totalActivity = validValues.reduce((s, v) => s + v, 0);
  if (totalEl) totalEl.textContent = `${totalActivity} дій`;

  const W = 100, H = 64;
  const points = values.map((v, i) => {
    if (v === null) return null;
    const x = values.length <= 1 ? W / 2 : (i / (values.length - 1)) * W;
    const y = H - 8 - (v / maxVal) * (H - 16);
    return { x, y, v, i };
  }).filter(Boolean);

  if (points.length < 2) {
    chartEl.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;font-size:12px;color:rgba(30,16,64,0.3)">Немає даних за тиждень</div>';
    if (labelsEl) labelsEl.innerHTML = '';
    return;
  }

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath = `${linePath} L ${points[points.length-1].x} ${H} L ${points[0].x} ${H} Z`;
  const dots = points.map(p => {
    const isToday = p.i === todayDow;
    const fill = p.v === 0 ? 'rgba(124,74,42,0.2)' : accent;
    const r = isToday ? 3.5 : 2.5;
    return `<circle cx="${p.x}" cy="${p.y}" r="${r}" fill="${fill}" stroke="white" stroke-width="1.5"/>`;
  }).join('');

  chartEl.innerHTML = `<svg width="100%" height="${H}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" style="overflow:visible">
    <defs>
      <linearGradient id="actGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${accent}" stop-opacity="0.18"/>
        <stop offset="100%" stop-color="${accent}" stop-opacity="0.02"/>
      </linearGradient>
    </defs>
    <line x1="0" y1="${H-8}" x2="${W}" y2="${H-8}" stroke="rgba(30,16,64,0.06)" stroke-width="0.5"/>
    <line x1="0" y1="${Math.round((H-8)/2)}" x2="${W}" y2="${Math.round((H-8)/2)}" stroke="rgba(30,16,64,0.06)" stroke-width="0.5"/>
    <path d="${areaPath}" fill="url(#actGrad)"/>
    <path d="${linePath}" fill="none" stroke="${accent}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
    ${dots}
  </svg>`;

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
  const systemPrompt = `${getOWLPersonality()} Проаналізуй дані та дай короткий аналіз (3-5 речень) у своєму стилі. Що вдається добре і що можна покращити — конкретно. ${dataNote} Завершуй конкретною порадою. Відповідай українською.${aiContext ? '\n\n' + aiContext : ''}`;

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

function getMoments() { return JSON.parse(localStorage.getItem('nm_moments') || '[]'); }
function saveMoments(arr) { localStorage.setItem('nm_moments', JSON.stringify(arr)); }

function renderEvening() {
  const today = new Date().toDateString();
  const todayMoments = getMoments().filter(m => new Date(m.ts).toDateString() === today);

  // === 1. Три статки ===
  const statsEl = document.getElementById('evening-stats-row');
  if (statsEl) {
    const doneTasks = getTasks().filter(t => t.status === 'done' && t.completedAt && new Date(t.completedAt).toDateString() === today).length;
    const habits = getHabits();
    const log = getHabitLog();
    const todayDow = (new Date().getDay() + 6) % 7;
    const todayH = habits.filter(h => (h.days || [0,1,2,3,4,5,6]).includes(todayDow));
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

  // === 2. Кільце продуктивності ===
  const doneTasks2 = getTasks().filter(t => t.status === 'done' && t.completedAt && new Date(t.completedAt).toDateString() === today).length;
  const habits2 = getHabits(); const log2 = getHabitLog();
  const todayDow2 = (new Date().getDay() + 6) % 7;
  const todayH2 = habits2.filter(h => (h.days || [0,1,2,3,4,5,6]).includes(todayDow2));
  const doneH2 = todayH2.filter(h => !!log2[today]?.[h.id]).length;
  const habitPct = todayH2.length > 0 ? doneH2 / todayH2.length : 0;
  const pos = todayMoments.filter(m => m.mood === 'positive').length;
  const moodBonus = todayMoments.length > 0 ? (pos / todayMoments.length) * 0.3 : 0;
  const taskBonus = doneTasks2 > 0 ? Math.min(doneTasks2 / 5, 1) * 0.4 : 0;
  const score = Math.round((habitPct * 0.3 + moodBonus + taskBonus) * 100);

  const arc = document.getElementById('evening-ring-arc');
  const pctEl = document.getElementById('evening-ring-pct');
  const descEl = document.getElementById('evening-score-desc');
  if (arc) { const circ = 151; setTimeout(() => { arc.style.strokeDashoffset = circ - (circ * score / 100); }, 100); }
  if (pctEl) pctEl.textContent = score + '%';
  if (descEl) descEl.textContent = score === 0 ? 'Додай моменти дня' : score >= 70 ? 'Гарний день 💪' : score >= 40 ? 'Середній день' : 'Важкий день';

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
        return `<div style="display:flex;gap:8px;align-items:flex-start;padding:7px 0;border-bottom:1px solid rgba(30,16,64,0.06)">
          <div style="width:7px;height:7px;border-radius:50%;background:${dot};flex-shrink:0;margin-top:5px"></div>
          <div style="flex:1">
            <div style="font-size:13px;color:#1e1040;font-weight:500;line-height:1.45">${escapeHtml(m.summary || m.text)}</div>
            ${timeStr ? `<div style="font-size:10px;color:rgba(30,16,64,0.3);font-weight:600;margin-top:2px">${timeStr}</div>` : ''}
          </div>
          ${!m.isNote ? `<div onclick="deleteMoment(${m.id})" style="font-size:18px;color:rgba(30,16,64,0.2);cursor:pointer;padding:0 2px">×</div>` : ''}
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

function getEveningMood() {
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
  closeMomentModal();
  renderEvening();
  showToast('✓ Момент збережено');
  // Генеруємо короткий summary через ШІ (у фоні, не блокує UI)
  generateMomentSummary(newMoment.id, text);
}

async function generateMomentSummary(momentId, text) {
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

const EVENING_SUMMARY_PROMPT = `${getOWLPersonality()} Зроби підсумок дня (3-4 речення) у своєму стилі. Звертайся на "ти". Відзнач що сьогодні вдалось. Якщо є що покращити — скажи конкретно. Завершуй думкою на завтра. Відповідай українською.`;

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

  const reply = await callAI(systemPrompt, dayData, {});
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

function setupAutoEveningSummary() {
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

// === SLIDES TOUR ===
const UPDATE_VERSION = 'v031';

const UPDATE_SLIDES = [
  {
    tag: '🆕 v0.31',
    emoji: '✨',
    title: 'Великий апдейт',
    body: `<div style="display:flex;flex-direction:column;gap:7px">
  <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:rgba(30,16,64,0.04);border-radius:12px">
    <div style="font-size:20px">🌙</div>
    <div style="font-size:13px;color:rgba(30,16,64,0.7);font-weight:600">Новий Вечір — продуктивність, настрій, фінанси</div>
  </div>
  <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:rgba(30,16,64,0.04);border-radius:12px">
    <div style="font-size:20px">🪞</div>
    <div style="font-size:13px;color:rgba(30,16,64,0.7);font-weight:600">Нова вкладка Я — тижневі кружечки, порівняння, настрій</div>
  </div>
  <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:rgba(30,16,64,0.04);border-radius:12px">
    <div style="font-size:20px">🫀</div>
    <div style="font-size:13px;color:rgba(30,16,64,0.7);font-weight:600">Нова вкладка Здоров'я — картки, трекер, препарати</div>
  </div>
  <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:rgba(30,16,64,0.04);border-radius:12px">
    <div style="font-size:20px">🚀</div>
    <div style="font-size:13px;color:rgba(30,16,64,0.7);font-weight:600">Нова вкладка Проекти — від ідеї до результату</div>
  </div>
</div>`,
    color: 'linear-gradient(135deg,#f2d978,#f97316)',
  },
  {
    tag: '🥁 Барабан',
    emoji: '🥁',
    title: 'Барабан став розумнішим',
    body: `<div style="display:flex;flex-direction:column;gap:7px">
  <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:rgba(30,16,64,0.04);border-radius:12px">
    <div style="font-size:20px">➕</div>
    <div style="font-size:13px;color:rgba(30,16,64,0.7);font-weight:600">Кнопка + — обирай які вкладки показувати</div>
  </div>
  <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:rgba(30,16,64,0.04);border-radius:12px">
    <div style="font-size:20px">💨</div>
    <div style="font-size:13px;color:rgba(30,16,64,0.7);font-weight:600">Кинь швидко — барабан долетить до крайньої вкладки</div>
  </div>
  <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:rgba(30,16,64,0.04);border-radius:12px">
    <div style="font-size:20px">🎯</div>
    <div style="font-size:13px;color:rgba(30,16,64,0.7);font-weight:600">Крайні вкладки тепер точно доходять до центру</div>
  </div>
</div>`,
    color: 'linear-gradient(135deg,#fdb87a,#ea580c)',
  },
  {
    tag: '🔧 Фікси',
    emoji: '🔧',
    title: 'Виправили баги',
    body: `<div style="display:flex;flex-direction:column;gap:7px">
  <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:rgba(30,16,64,0.04);border-radius:12px">
    <div style="font-size:20px">💳</div>
    <div style="font-size:13px;color:rgba(30,16,64,0.7);font-weight:600">Фінанси більше не порожні після відкриття</div>
  </div>
  <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:rgba(30,16,64,0.04);border-radius:12px">
    <div style="font-size:20px">↩️</div>
    <div style="font-size:13px;color:rgba(30,16,64,0.7);font-weight:600">"Відновити всі задачі" — тепер працює</div>
  </div>
  <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:rgba(30,16,64,0.04);border-radius:12px">
    <div style="font-size:20px">🎨</div>
    <div style="font-size:13px;color:rgba(30,16,64,0.7);font-weight:600">Нові кольори вкладок — чіткіше і красивіше</div>
  </div>
</div>`,
    color: 'linear-gradient(135deg,#a7f3d0,#16a34a)',
    isLast: true,
  },
];

const SLIDES = [
  {
    tag: 'Що таке NeverMind',
    emoji: '🧠',
    title: 'Один потік для всього',
    body: `<p style="font-size:14px;color:rgba(30,16,64,0.6);line-height:1.65;margin-bottom:12px">Думки зникають. Записи губляться по різних застосунках. Нічого не виконується бо немає системи.</p>
<p style="font-size:14px;color:rgba(30,16,64,0.6);line-height:1.65">NeverMind — один рядок куди скидаєш все що в голові. OWL сам розбереться.</p>`,
    color: 'linear-gradient(135deg,#f2d978,#f97316)',
  },
  {
    tag: 'Inbox',
    emoji: '📥',
    title: 'Пиши — OWL розбирає',
    body: `<div style="display:flex;flex-direction:column;gap:7px">
  <div style="padding:10px 12px;background:rgba(30,16,64,0.04);border-radius:12px;font-size:13px;color:rgba(30,16,64,0.65);line-height:1.5">"купити хліб" → <b style="color:#1e1040">задача</b></div>
  <div style="padding:10px 12px;background:rgba(30,16,64,0.04);border-radius:12px;font-size:13px;color:rgba(30,16,64,0.65);line-height:1.5">"бігати щоранку" → <b style="color:#1e1040">звичка</b></div>
  <div style="padding:10px 12px;background:rgba(30,16,64,0.04);border-radius:12px;font-size:13px;color:rgba(30,16,64,0.65);line-height:1.5">"витратив 50 на їжу" → <b style="color:#1e1040">фінанси</b></div>
  <div style="padding:10px 12px;background:rgba(30,16,64,0.04);border-radius:12px;font-size:13px;color:rgba(30,16,64,0.65);line-height:1.5">"класна ідея про стартап" → <b style="color:#1e1040">нотатка в Ідеях</b></div>
</div>`,
    color: 'linear-gradient(135deg,#f2d978,#f97316)',
  },
  {
    tag: 'Продуктивність',
    emoji: '⚡',
    title: 'Задачі і звички',
    body: `<div style="display:flex;flex-direction:column;gap:7px">
  <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:rgba(30,16,64,0.04);border-radius:12px">
    <div style="font-size:18px">✅</div>
    <div style="font-size:13px;color:rgba(30,16,64,0.7);font-weight:600">Тап на чекбокс — виконати задачу або звичку</div>
  </div>
  <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:rgba(30,16,64,0.04);border-radius:12px">
    <div style="font-size:18px">👈</div>
    <div style="font-size:13px;color:rgba(30,16,64,0.7);font-weight:600">Свайп вліво — видалити</div>
  </div>
  <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:rgba(30,16,64,0.04);border-radius:12px">
    <div style="font-size:18px">💬</div>
    <div style="font-size:13px;color:rgba(30,16,64,0.7);font-weight:600">Скажи OWL "додай крок до задачі X"</div>
  </div>
</div>`,
    color: 'linear-gradient(135deg,#fdb87a,#ea580c)',
  },
  {
    tag: 'Вечір і Я',
    emoji: '🌙',
    title: 'Закриття дня і дзеркало',
    body: `<div style="display:flex;flex-direction:column;gap:7px">
  <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:rgba(30,16,64,0.04);border-radius:12px">
    <div style="font-size:18px">🌙</div>
    <div style="font-size:13px;color:rgba(30,16,64,0.7);font-weight:600">Вечір — задачі, звички, витрати за день + настрій</div>
  </div>
  <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:rgba(30,16,64,0.04);border-radius:12px">
    <div style="font-size:18px">🪞</div>
    <div style="font-size:13px;color:rgba(30,16,64,0.7);font-weight:600">Я — тижневі кружечки, настрій, порівняння</div>
  </div>
  <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:rgba(30,16,64,0.04);border-radius:12px">
    <div style="font-size:18px">🤝</div>
    <div style="font-size:13px;color:rgba(30,16,64,0.7);font-weight:600">OWL аналізує тиждень і каже що насправді відбувається</div>
  </div>
</div>`,
    color: 'linear-gradient(135deg,#1e3350,#3a5a80)',
  },
  {
    tag: 'Нові вкладки',
    emoji: '🆕',
    title: "Здоров'я і Проекти",
    body: `<div style="display:flex;flex-direction:column;gap:7px">
  <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:rgba(30,16,64,0.04);border-radius:12px">
    <div style="font-size:18px">🫀</div>
    <div style="font-size:13px;color:rgba(30,16,64,0.7);font-weight:600">Здоров'я — картки хвороб, трекер самопочуття, препарати</div>
  </div>
  <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:rgba(30,16,64,0.04);border-radius:12px">
    <div style="font-size:18px">🚀</div>
    <div style="font-size:13px;color:rgba(30,16,64,0.7);font-weight:600">Проекти — від ідеї до результату з OWL як наставником</div>
  </div>
  <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:rgba(30,16,64,0.04);border-radius:12px">
    <div style="font-size:18px">➕</div>
    <div style="font-size:13px;color:rgba(30,16,64,0.7);font-weight:600">Кнопка + в барабані — увімкни потрібні вкладки</div>
  </div>
</div>`,
    color: 'linear-gradient(135deg,#d4e8d8,#16a34a)',
    isLast: true,
  },
];

let currentSlide = 0;

let _slidesIsUpdate = false;

let _slidesFromOnboarding = false;

function openSlidesTour(fromOnboarding = false) {
  _slidesFromOnboarding = fromOnboarding;
  _slidesIsUpdate = false;
  currentSlide = 0;
  const el = document.getElementById('slides-tour');
  el.style.display = 'flex';
  renderSlide();
}

function openUpdateSlides() {
  _slidesFromOnboarding = false;
  _slidesIsUpdate = true;
  currentSlide = 0;
  const el = document.getElementById('slides-tour');
  el.style.display = 'flex';
  renderSlide();
}

function closeSlidesTour(fromOnboarding = false) {
  const el = document.getElementById('slides-tour');
  el.style.opacity = '0';
  el.style.transition = 'opacity 0.3s ease';
  // Зберігаємо що бачили поточне оновлення
  if (_slidesIsUpdate) {
    localStorage.setItem('nm_seen_update', UPDATE_VERSION);
  }
  setTimeout(() => {
    el.style.display = 'none'; el.style.opacity = ''; el.style.transition = '';
    if (fromOnboarding && !localStorage.getItem('nm_survey_done')) {
      startSurvey();
    }
  }, 300);
}

function getCurrentSlides() {
  return _slidesIsUpdate ? UPDATE_SLIDES : SLIDES;
}

function slidesNext() {
  const slides = getCurrentSlides();
  if (currentSlide < slides.length - 1) {
    currentSlide++;
    renderSlide();
  } else {
    closeSlidesTour(_slidesFromOnboarding);
  }
}

function renderSlide() {
  const slides = getCurrentSlides();
  const slide = slides[currentSlide];
  const total = slides.length;

  // Крапки прогресу
  const dotsEl = document.getElementById('slides-dots');
  dotsEl.innerHTML = Array.from({length: total}, (_, i) => {
    const isActive = i === currentSlide;
    const isDone = i < currentSlide;
    const bg = isActive || isDone ? '#f97316' : 'rgba(30,16,64,0.1)';
    const w = isActive ? '24px' : '7px';
    return `<div style="height:4px;width:${w};border-radius:2px;background:${bg};transition:all 0.3s"></div>`;
  }).join('');

  // Контент — новий дизайн з великим emoji зверху
  const contentEl = document.getElementById('slides-content');
  contentEl.innerHTML = `
    ${slide.emoji ? `<div style="font-size:44px;margin-bottom:10px;line-height:1">${slide.emoji}</div>` : ''}
    <div style="display:inline-block;font-size:11px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;padding:3px 10px;border-radius:20px;background:rgba(30,16,64,0.06);color:rgba(30,16,64,0.4);margin-bottom:10px">${slide.tag}</div>
    <div style="font-size:20px;font-weight:900;color:#1e1040;line-height:1.3;margin-bottom:14px">${slide.title}</div>
    ${slide.body}
  `;

  // Кнопка
  const nextBtn = document.getElementById('slides-next-btn');
  nextBtn.textContent = slide.isLast ? 'Почати →' : 'Далі →';
  nextBtn.style.background = slide.color;

  // Пропустити → Закрити на останньому
  const skipBtn = document.getElementById('slides-skip-btn');
  skipBtn.textContent = slide.isLast ? '' : 'Пропустити';
  skipBtn.style.display = slide.isLast ? 'none' : 'block';
}


// === ONBOARDING ===
// === HELP SYSTEM ===
const HELP_CONTENT = {
  inbox: {
    title: 'Inbox',
    subtitle: 'Один потік для всіх думок.',
    color: 'linear-gradient(135deg, #f2d978, #f97316)',
    accent: '#8b6914',
    sections: [
      { title: 'Як писати', items: [
        { icon: 'edit',  title: 'Будь-який текст', desc: 'Пиши як думаєш. Агент сам визначить — це задача, нотатка, звичка чи ідея.' },
        { icon: 'clock', title: 'З часом', desc: '«Зателефонувати завтра о 9» — час автоматично потрапить у заголовок задачі.' },
        { icon: 'list',  title: 'Список одним рядком', desc: '«Ремонт: купити фарбу, найняти майстра» — Агент розбʼє на окремі кроки.' },
      ]},
      { title: 'Жести', items: [
        { icon: 'swipe', title: 'Свайп вліво — видалити', desc: 'Довгий свайп (200px) видаляє запис. Можна відновити через «Відновити».' },
        { icon: 'help',  title: 'Агент уточнить', desc: 'Якщо незрозуміло — зʼявляться варіанти відповіді. Просто вибери.' },
      ]},
      { title: 'Агент', items: [
        { icon: 'chat', title: 'Запитай про свої записи', desc: '«Які задачі відкриті», «що я записував вчора» — Агент знає весь контекст.' },
        { icon: 'idea', title: 'Розвинь ідею', desc: 'Попроси Агента знайти підводні камені або розгорнути думку.' },
      ]},
    ]
  },
  tasks: {
    title: 'Продуктивність',
    subtitle: 'Задачі з кроками і щоденні звички.',
    color: 'linear-gradient(135deg, #fdb87a, #f97316)',
    accent: '#ea580c',
    sections: [
      { title: 'Задачі', items: [
        { icon: 'check',  title: 'Відмічай кроки', desc: 'Тап на чекбокс — відмічає крок. Всі кроки виконані → задача закривається.' },
        { icon: 'list',   title: 'Кроки через Агента', desc: '«Додай кроки до задачі Ремонт: купити фарбу, найняти майстра».' },
        { icon: 'edit',   title: 'Редагувати', desc: 'Тап на назву задачі відкриває редагування.' },
      ]},
      { title: 'Звички', items: [
        { icon: 'habit',    title: 'Щоденний трекер', desc: 'Нова звичка з Inbox одразу зʼявляється тут. Відмічай кожен день — будується стрік.' },
        { icon: 'calendar', title: 'Вибір днів', desc: 'При створенні вкажи конкретні дні тижня — Агент враховує розклад.' },
        { icon: 'swipe',    title: 'Свайп вліво — видалити', desc: 'Довгий свайп видаляє звичку.' },
      ]},
      { title: 'Агент', items: [
        { icon: 'chat', title: 'Керуй голосом', desc: null,
          cmds: ['виконав задачу: назва', 'додай крок: назва', 'відміни крок', 'відмітити звичку'] },
      ]},
    ]
  },
  notes: {
    title: 'Нотатки',
    subtitle: 'Записи автоматично сортуються по папках.',
    color: 'linear-gradient(135deg, #fed7aa, #f97316)',
    accent: '#c2620a',
    sections: [
      { title: 'Навігація', items: [
        { icon: 'folder', title: 'Папки', desc: 'Агент сам визначає папку при збереженні. Тапни на папку щоб побачити записи всередині.' },
        { icon: 'search', title: 'Пошук', desc: 'Шукає по тексту всіх нотаток одразу, незалежно від папки.' },
      ]},
      { title: 'Робота з нотаткою', items: [
        { icon: 'chat',  title: 'Обговори з Агентом', desc: 'Відкрий нотатку — знизу зʼявиться чат. Агент допоможе розвинути думку.' },
        { icon: 'swipe', title: 'Свайп вліво — видалити', desc: 'Довгий свайп видаляє нотатку. Можна відновити.' },
        { icon: 'menu',  title: 'Меню ···', desc: 'Три крапки на нотатці — перемістити в іншу папку, скопіювати.' },
      ]},
    ]
  },
  me: {
    title: 'Я',
    subtitle: 'Твоя активність і чесний аналіз від Агента.',
    color: 'linear-gradient(135deg, #a7f3d0, #22c55e)',
    accent: '#16a34a',
    sections: [
      { title: 'Що тут є', items: [
        { icon: 'grid',  title: 'Активність тижня', desc: 'Кожна клітинка — один день. Чим темніше — більше записів.' },
        { icon: 'stats', title: 'Статистика', desc: 'Кількість записів, активних задач і нотаток одним поглядом.' },
        { icon: 'habit', title: 'Прогрес звичок', desc: 'Відсоток за 30 днів і кількість днів поспіль по кожній звичці.' },
      ]},
      { title: 'Агент-коуч', items: [
        { icon: 'refresh', title: 'Аналіз', desc: 'Натисни ↻ — Агент скаже де ти провисаєш і що вдається добре.' },
        { icon: 'star',    title: '3 поради', desc: 'Конкретні практичні поради на основі твоїх реальних даних.' },
        { icon: 'chat',    title: 'Запитай сам', desc: 'Чат внизу — питай про свою продуктивність, звички, прогрес.' },
      ]},
    ]
  },
  evening: {
    title: 'Вечір',
    subtitle: 'Рефлексія дня і підсумок від Агента.',
    color: 'linear-gradient(135deg, #818cf8, #4f46e5)',
    accent: '#4f46e5',
    sections: [
      { title: 'Моменти дня', items: [
        { icon: 'plus', title: 'Додай момент', desc: 'Що трапилось, що відчував, що думав — кнопка «+ Додати» або через Агента.' },
        { icon: 'mood', title: 'Настрій', desc: 'Позначай кожен момент — позитивний, нейтральний чи негативний.' },
        { icon: 'ring', title: 'Кільце продуктивності', desc: 'Відсоток позитивних моментів за день. Чесна картина твого дня.' },
      ]},
      { title: 'Агент-підсумок', items: [
        { icon: 'refresh', title: 'Підсумок дня', desc: 'Натисни ↻ — Агент бачить всі записи і моменти, дає пораду на завтра.' },
        { icon: 'chat',    title: 'Поговори', desc: 'Чат внизу — обговори день, поділись думками, отримай підтримку.' },
      ]},
      { title: 'Агент', items: [
        { icon: 'chat', title: 'Питання', desc: null,
          cmds: ['що я зробив сьогодні', 'як пройшов тиждень', 'що покращити завтра'] },
      ]},
    ]
  },
  finance: {
    title: 'Фінанси',
    subtitle: 'Облік витрат і доходів без таблиць.',
    color: 'linear-gradient(135deg, #fcd9bd, #f97316)',
    accent: '#c2410c',
    sections: [
      { title: 'Як додавати', items: [
        { icon: 'chat',   title: 'Через Inbox або чат', desc: '«Витратив 50 на їжу» або «отримав зарплату 3000» — Агент сам збереже.' },
        { icon: 'plus',   title: 'Вручну', desc: 'Кнопка «+ Додати» — вибери тип, суму і категорію.' },
      ]},
      { title: 'Бюджет', items: [
        { icon: 'limit',  title: 'Загальний ліміт', desc: 'Натисни ✎ в блоці «Бюджет по категоріях» щоб задати місячний ліміт.' },
        { icon: 'cat',    title: 'Ліміти по категоріях', desc: 'Агент попередить коли витрати наближаються до ліміту.' },
      ]},
      { title: 'Агент', items: [
        { icon: 'wallet', title: 'Запити', desc: null,
          cmds: ['скільки витратив цього тижня', 'де найбільше трачу', 'встанови бюджет 2000 на місяць', 'видали останню витрату'] },
      ]},
    ]
  },
};

const FIRST_VISIT_TIPS = {
  inbox:   { icon: '💡', title: 'Підказка', text: 'Пиши будь-що — задачу, ідею, звичку. Агент сам розбере. Спробуй: "купити хліб о 18:00"' },
  tasks:   { icon: '⚡', title: 'Підказка', text: 'Пиши список одним записом: "Ремонт: купити фарбу, знайти майстра" — Агент розібʼє на кроки' },
  notes:   { icon: '📁', title: 'Підказка', text: 'Нотатки автоматично сортуються по папках. Тапни на папку щоб побачити записи всередині' },
  me:      { icon: '📊', title: 'Підказка', text: 'Натисни ↻ в блоці "Аналіз агента" — отримаєш чесний огляд своєї продуктивності' },
  evening: { icon: '🌙', title: 'Підказка', text: 'Натисни ↻ в "Агент на вечір" — Агент підсумує твій день на основі всіх записів' },
  finance: { icon: '◈',  title: 'Підказка', text: 'Пиши витрати прямо в Inbox: "витратив 50 на їжу" — Агент сам збереже у Фінанси' },
};

let _helpOpen = false;

const HELP_ICONS = {
  edit:    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
  clock:   '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
  list:    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>',
  swipe:   '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>',
  help:    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  chat:    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
  idea:    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><circle cx="12" cy="12" r="4"/></svg>',
  check:   '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
  habit:   '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/><path d="M12 8v4l3 3"/></svg>',
  calendar:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
  folder:  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>',
  search:  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
  menu:    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>',
  grid:    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>',
  stats:   '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>',
  refresh: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>',
  star:    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
  plus:    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
  mood:    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>',
  ring:    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>',
  wallet:  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4z"/></svg>',
  limit:   '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
  cat:     '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>',
};

function openHelp(tab) {
  const data = HELP_CONTENT[tab];
  if (!data) return;

  const panel = document.getElementById('help-drawer-panel');

  // Кольоровий хедер
  const headerEl = document.getElementById('help-drawer-header');
  if (headerEl) {
    headerEl.style.background = data.color;
  }

  document.getElementById('help-drawer-title').textContent = data.title;
  document.getElementById('help-drawer-subtitle').textContent = data.subtitle;

  const contentEl = document.getElementById('help-drawer-content');
  contentEl.innerHTML = data.sections.map(section => `
    <div class="help-section-title">${section.title}</div>
    ${section.items.map(item => `
      <div class="help-item">
        <div class="help-item-icon" style="color:${data.accent}">${HELP_ICONS[item.icon] || ''}</div>
        <div style="flex:1;min-width:0">
          <div class="help-item-title">${item.title}</div>
          ${item.desc ? `<div class="help-item-desc">${item.desc}</div>` : ''}
          ${item.cmds ? `<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:6px">${item.cmds.map(c => `<span class="help-cmd">${c}</span>`).join('')}</div>` : ''}
        </div>
      </div>
    `).join('')}
  `).join('');

  const drawer = document.getElementById('help-drawer');
  drawer.style.display = 'flex';
  requestAnimationFrame(() => {
    document.getElementById('help-drawer-panel').style.transform = 'translateX(0)';
  });
  _helpOpen = true;

  // Свайп вправо — закрити
  if (!panel._helpSwipe) {
    panel._helpSwipe = true;
    let _sx = 0, _sy = 0, _dragging = false;
    panel.addEventListener('touchstart', e => {
      _sx = e.touches[0].clientX;
      _sy = e.touches[0].clientY;
      _dragging = false;
      panel.style.transition = 'none';
    }, { passive: true });
    panel.addEventListener('touchmove', e => {
      const dx = e.touches[0].clientX - _sx;
      const dy = Math.abs(e.touches[0].clientY - _sy);
      if (!_dragging && dx > 8 && dy < dx) _dragging = true;
      if (!_dragging) return;
      if (dx > 0) panel.style.transform = `translateX(${dx}px)`;
    }, { passive: true });
    panel.addEventListener('touchend', e => {
      if (!_dragging) { panel.style.transition = ''; panel.style.transform = 'translateX(0)'; return; }
      const dx = e.changedTouches[0].clientX - _sx;
      panel.style.transition = 'transform 0.24s cubic-bezier(0.32,0.72,0,1)';
      if (dx > 80) {
        panel.style.transform = 'translateX(100%)';
        setTimeout(() => { drawer.style.display = 'none'; panel.style.transition = ''; }, 240);
        _helpOpen = false;
      } else {
        panel.style.transform = 'translateX(0)';
        setTimeout(() => { panel.style.transition = ''; }, 250);
      }
      _dragging = false;
    }, { passive: true });
  }
}

function closeHelp() {
  const panel = document.getElementById('help-drawer-panel');
  if (panel) {
    panel.style.transition = 'transform 0.24s cubic-bezier(0.32,0.72,0,1)';
    panel.style.transform = 'translateX(100%)';
  }
  setTimeout(() => {
    const drawer = document.getElementById('help-drawer');
    if (drawer) drawer.style.display = 'none';
    if (panel) panel.style.transition = '';
  }, 240);
  _helpOpen = false;
}

// Підказка першого відвідування
function showFirstVisitTip(tab) {
  const key = 'nm_visited_' + tab;
  if (localStorage.getItem(key)) return;
  localStorage.setItem(key, '1');
  const tip = FIRST_VISIT_TIPS[tab];
  if (!tip) return;

  // Видаляємо попередню підказку якщо є
  const prev = document.getElementById('fv-tip');
  if (prev) prev.remove();

  const tipEl = document.createElement('div');
  tipEl.id = 'fv-tip';
  tipEl.className = 'fv-tip';
  // Позиціонуємо над таббаром
  const tbH = document.getElementById('tab-bar')?.offsetHeight || 83;
  tipEl.style.bottom = (tbH + 12) + 'px';
  tipEl.innerHTML = `
    <div class="fv-tip-icon">${tip.icon}</div>
    <div class="fv-tip-body">
      <div class="fv-tip-title">${tip.title}</div>
      <div class="fv-tip-text">${tip.text}</div>
    </div>
    <div class="fv-tip-close" onclick="this.closest('#fv-tip').remove()">✕</div>
  `;
  document.body.appendChild(tipEl);

  // Автозакриття через 6 секунд
  setTimeout(() => { if (document.getElementById('fv-tip') === tipEl) tipEl.remove(); }, 6000);
}


// === SURVEY (після першого онбордингу) ===
const SURVEY_QUESTIONS = [
  'Чим займаєшся? (наприклад: підприємець, студент, програміст, фрілансер…)',
  'Які твої головні цілі зараз? (коротко, 1-2 речення)',
  'Що хочеш тримати під контролем — задачі, звички, ідеї, або все разом?',
];
let surveyAnswers = [];
let surveyStep = 0;
let surveyWaiting = false;

function startSurvey() {
  surveyAnswers = [];
  surveyStep = 0;
  surveyWaiting = false;
  // Переходимо на Inbox
  if (currentTab !== 'inbox') switchTab('inbox');
  // Невелика затримка щоб Inbox відрендерився
  setTimeout(() => {
    addInboxChatMsg('agent', 'Привіт! 👋 Щоб я міг бути кориснішим — розкажи трохи про себе. Це займе хвилину, а я зможу давати конкретніші поради саме для тебе.');
    setTimeout(() => askSurveyQuestion(), 800);
  }, 400);
}

function askSurveyQuestion() {
  if (surveyStep >= SURVEY_QUESTIONS.length) {
    finishSurvey();
    return;
  }
  surveyWaiting = true;
  addInboxChatMsg('agent', SURVEY_QUESTIONS[surveyStep]);
}

// Перехоплюємо відповіді під час опитування
function handleSurveyAnswer(text) {
  if (!surveyWaiting) return false;
  surveyWaiting = false;
  surveyAnswers.push({ q: SURVEY_QUESTIONS[surveyStep], a: text });
  surveyStep++;
  if (surveyStep < SURVEY_QUESTIONS.length) {
    setTimeout(() => askSurveyQuestion(), 400);
  } else {
    setTimeout(() => finishSurvey(), 400);
  }
  return true; // означає що повідомлення перехоплено
}

async function finishSurvey() {
  addInboxChatMsg('agent', 'Дякую! Зараз підготую персональні поради…');
  const key = localStorage.getItem('nm_gemini_key');
  if (!key) {
    addInboxChatMsg('agent', 'Введи API ключ в налаштуваннях — і я збережу все про тебе в памʼять.');
    localStorage.setItem('nm_survey_done', '1');
    return;
  }
  const settings = JSON.parse(localStorage.getItem('nm_settings') || '{}');
  const name = settings.name || 'користувач';
  const answersText = surveyAnswers.map((a, i) => `Питання ${i+1}: ${a.q}\nВідповідь: ${a.a}`).join('\n\n');
  const prompt = `Ти — OWL, агент NeverMind. Користувач ${name} тільки що завершив онбординг і відповів на питання анкети:\n\n${answersText}\n\nЗроби дві речі:\n1. Збережи ключові факти про користувача у форматі короткого резюме (3-5 речень) — це піде в памʼять агента.\n2. Дай 2-3 конкретні поради як використовувати NeverMind саме для цієї людини. Поради мають бути практичними і специфічними.\n\nФормат відповіді — ТІЛЬКИ валідний JSON:\n{"memory": "текст для памʼяті", "advice": "персональні поради 2-3 речення"}`;

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: prompt }], max_tokens: 400, temperature: 0.7 })
    });
    const data = await res.json();
    const reply = data.choices?.[0]?.message?.content?.trim();
    if (reply) {
      try {
        const parsed = JSON.parse(reply.replace(/```json|```/g, '').trim());
        if (parsed.memory) {
          localStorage.setItem('nm_memory', parsed.memory);
          localStorage.setItem('nm_memory_ts', Date.now().toString());
        }
        if (parsed.advice) {
          addInboxChatMsg('agent', parsed.advice);
        }
      } catch(e) {
        safeAgentReply(reply, addInboxChatMsg);
      }
    }
  } catch(e) {
    addInboxChatMsg('agent', 'Не вдалось зберегти — але твої відповіді я запамʼятав. Спробуй оновити сторінку.');
  }
  localStorage.setItem('nm_survey_done', '1');
}


function checkOnboarding() {
  const done = localStorage.getItem('nm_onboarding_done');
  if (!done) {
    // Новий користувач — показуємо онбординг
    document.getElementById('onboarding').style.display = 'block';
    return true;
  }
  // Існуючий користувач — перевіряємо чи бачив оновлення
  const seenUpdate = localStorage.getItem('nm_seen_update');
  if (seenUpdate !== UPDATE_VERSION) {
    setTimeout(() => openUpdateSlides(), 500);
    return false;
  }
  return false;
}

function obNext(step) {
  if (step === 1) {
    const name = document.getElementById('ob-name').value.trim();
    const age = document.getElementById('ob-age').value.trim();
    if (!name) { showToast('Введи імʼя'); return; }
    const settings = JSON.parse(localStorage.getItem('nm_settings') || '{}');
    settings.name = name;
    if (age) settings.age = age;
    localStorage.setItem('nm_settings', JSON.stringify(settings));
    document.getElementById('ob-step-1').style.display = 'none';
    document.getElementById('ob-step-2').style.display = 'block';
  } else if (step === 2) {
    const key = document.getElementById('ob-key').value.trim();
    if (key) localStorage.setItem('nm_gemini_key', key);
    document.getElementById('ob-step-2').style.display = 'none';
    document.getElementById('ob-step-owl').style.display = 'block';
    // Дефолтно вибрати "partner"
    selectOwlMode('partner');
  } else if (step === 'owl') {
    const settings = JSON.parse(localStorage.getItem('nm_settings') || '{}');
    if (!settings.owl_mode) settings.owl_mode = 'partner';
    localStorage.setItem('nm_settings', JSON.stringify(settings));
    document.getElementById('ob-step-owl').style.display = 'none';
    document.getElementById('ob-step-consent').style.display = 'block';
  }
}

function obSkipKey() {
  document.getElementById('ob-step-2').style.display = 'none';
  document.getElementById('ob-step-owl').style.display = 'block';
  selectOwlMode('partner');
}

function selectOwlMode(mode) {
  const settings = JSON.parse(localStorage.getItem('nm_settings') || '{}');
  settings.owl_mode = mode;
  localStorage.setItem('nm_settings', JSON.stringify(settings));
  ['coach','partner','mentor'].forEach(m => {
    const card = document.getElementById('owl-card-' + m);
    if (!card) return;
    card.style.border = m === mode ? '2px solid #7c3aed' : '2px solid rgba(124,58,237,0.15)';
    card.style.background = m === mode ? 'rgba(124,58,237,0.08)' : 'rgba(255,255,255,0.8)';
  });
}

function obShowWelcome() {
  const settings = JSON.parse(localStorage.getItem('nm_settings') || '{}');
  document.getElementById('ob-welcome-text').textContent = `Привіт, ${settings.name || 'друже'}! 👋`;
  document.getElementById('ob-step-2').style.display = 'none';
  document.getElementById('ob-step-3').style.display = 'block';
}

function obFinish() {
  localStorage.setItem('nm_onboarding_done', '1');
  const ob = document.getElementById('onboarding');
  ob.style.opacity = '0';
  ob.style.transition = 'opacity 0.4s ease';
  setTimeout(() => {
    ob.style.display = 'none';
    // Показуємо тур після онбордингу
    openSlidesTour(true);
  }, 400);
  updateKeyStatus(!!localStorage.getItem('nm_gemini_key'));
}

// === ME AI BAR ===
let meBarLoading = false;

function showMeChatMessages() {
  openChatBar('me');
}

function addMeChatMsg(role, text, _noSave = false, id = '') {
  const el = document.getElementById('me-chat-messages');
  if (!el) return;
  try { openChatBar('me'); } catch(e) {}
  const isAgent = role === 'agent';
  const div = document.createElement('div');
  div.style.cssText = `display:flex;${isAgent ? '' : 'justify-content:flex-end'}`;
  div.innerHTML = `<div ${id ? `id="${id}"` : ''} style="max-width:85%;background:${isAgent ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.88)'};color:${isAgent ? 'white' : '#1e1040'};border-radius:${isAgent ? '4px 12px 12px 12px' : '12px 4px 12px 12px'};padding:8px 12px;font-size:15px;line-height:1.5;font-weight:500">${escapeHtml(text)}</div>`;
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

function addEveningBarMsg(role, text, _noSave = false) {
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
  try { openChatBar('evening'); } catch(e) {}
  const isAgent = role === 'agent';
  const div = document.createElement('div');
  div.style.cssText = `display:flex;${isAgent ? '' : 'justify-content:flex-end'}`;
  div.innerHTML = `<div style="max-width:85%;background:${isAgent ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.88)'};color:${isAgent ? 'white' : '#1e1040'};border-radius:${isAgent ? '4px 12px 12px 12px' : '12px 4px 12px 12px'};padding:8px 11px;font-size:15px;line-height:1.5;font-weight:500">${escapeHtml(text)}</div>`;
  el.appendChild(div);
  el.scrollTop = el.scrollHeight;
  if (role !== 'agent') eveningBarHistory.push({ role: 'user', content: text });
  else eveningBarHistory.push({ role: 'assistant', content: text });
  if (!_noSave) saveChatMsg('evening', role, text);
}

async function sendEveningBarMessage() {
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
- Витрата: {"action":"save_finance","fin_type":"expense","amount":число,"category":"категорія","comment":"текст"}
- Дохід: {"action":"save_finance","fin_type":"income","amount":число,"category":"категорія","comment":"текст"}
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

