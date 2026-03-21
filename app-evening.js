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
  const tasks = JSON.parse(localStorage.getItem('nm_tasks') || '[]');
  const notes = getNotes();

  // Stats
  document.getElementById('me-stat-inbox').textContent = inbox.length;
  document.getElementById('me-stat-tasks').textContent = tasks.filter(t => t.status !== 'done').length;
  document.getElementById('me-stat-notes').textContent = notes.length;

  // Week grid — активність по дням (inbox записи)
  const weekEl = document.getElementById('me-week-grid');
  const days = ['Пн','Вт','Ср','Чт','Пт','Сб','Нд'];
  const now = new Date();
  const todayDow = (now.getDay() + 6) % 7; // 0=Пн
  weekEl.innerHTML = days.map((d, i) => {
    const daysAgo = todayDow - i;
    const date = new Date(now);
    date.setDate(now.getDate() - daysAgo);
    const dateStr = date.toDateString();
    const count = inbox.filter(item => new Date(item.ts).toDateString() === dateStr).length;
    const future = daysAgo < 0;
    let bg = 'rgba(30,16,64,0.05)', color = 'rgba(30,16,64,0.2)';
    if (!future && count > 0) { bg = count >= 5 ? '#16a34a' : count >= 2 ? 'rgba(22,163,74,0.4)' : 'rgba(22,163,74,0.2)'; color = count >= 5 ? 'white' : '#16a34a'; }
    const isToday = daysAgo === 0;
    return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px">
      <div style="font-size:10px;font-weight:700;color:rgba(30,16,64,0.35)">${d}</div>
      <div style="width:32px;height:32px;border-radius:9px;background:${bg};display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:${color};${isToday ? 'box-shadow:0 0 0 2px rgba(22,163,74,0.4)' : ''}">${future ? '–' : count || '·'}</div>
    </div>`;
  }).join('');

  // Categories breakdown
  const catEl = document.getElementById('me-categories');
  const catCount = {};
  inbox.forEach(i => { catCount[i.category] = (catCount[i.category] || 0) + 1; });
  const total = inbox.length || 1;
  const catColors = { note:'#6366f1', idea:'#f59e0b', task:'#ea580c', habit:'#16a34a', event:'#0ea5e9' };
  const catLabels = { note:'Нотатки', idea:'Ідеї', task:'Задачі', habit:'Звички', event:'Події', finance:'Фінанси' };
  catEl.innerHTML = Object.entries(catCount).sort((a,b) => b[1]-a[1]).map(([cat, cnt]) => {
    const pct = Math.round(cnt / total * 100);
    const color = catColors[cat] || '#888';
    return `<div style="display:flex;align-items:center;gap:8px">
      <div style="font-size:13px;font-weight:700;color:rgba(30,16,64,0.5);width:52px">${catLabels[cat]||cat}</div>
      <div style="flex:1;height:6px;background:rgba(0,0,0,0.05);border-radius:4px;overflow:hidden">
        <div style="height:100%;width:${pct}%;background:${color};border-radius:4px;transition:width 0.6s ease"></div>
      </div>
      <div style="font-size:13px;font-weight:700;color:rgba(30,16,64,0.4);width:28px;text-align:right">${cnt}</div>
    </div>`;
  }).join('') || '<div style="font-size:14px;color:rgba(30,16,64,0.3)">Немає даних</div>';

  // Activity last 14 days
  const actEl = document.getElementById('me-activity');
  const days14 = Array.from({length:14}, (_,i) => {
    const d = new Date(now);
    d.setDate(now.getDate() - (13 - i));
    return d.toDateString();
  });
  const maxAct = Math.max(1, ...days14.map(ds => inbox.filter(i => new Date(i.ts).toDateString() === ds).length));
  actEl.innerHTML = days14.map((ds, i) => {
    const cnt = inbox.filter(item => new Date(item.ts).toDateString() === ds).length;
    const h = Math.max(4, Math.round(cnt / maxAct * 44));
    const isToday = i === 13;
    return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:2px">
      <div style="width:100%;height:${h}px;background:${isToday ? '#16a34a' : 'rgba(22,163,74,0.3)'};border-radius:3px;transition:height 0.5s ease"></div>
    </div>`;
  }).join('');
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
  const moments = getMoments();
  const today = new Date().toDateString();
  const todayMoments = moments.filter(m => new Date(m.ts).toDateString() === today);

  // Додаємо нотатки за сьогодні з nm_notes (без копіювання — читаємо напряму)
  const allNotes = getNotes();
  const todayNotes = allNotes.filter(n => new Date(n.ts || n.createdAt || 0).toDateString() === today);
  // Обʼєднуємо: спочатку події/моменти, потім нотатки — без дублів
  const notesAsItems = todayNotes.map(n => ({
    id: 'note_' + n.id,
    text: n.title || n.text || '',
    mood: 'neutral',
    ts: n.ts || n.createdAt || 0,
    isNote: true,
    folder: n.folder || 'note'
  }));
  const allTodayItems = [...todayMoments, ...notesAsItems]
    .sort((a, b) => (b.ts || 0) - (a.ts || 0));

  // Відновлюємо збережений підсумок
  try {
    const saved = JSON.parse(localStorage.getItem('nm_evening_summary') || 'null');
    if (saved && saved.date === today && saved.text) {
      const el = document.getElementById('evening-summary');
      if (el && el.textContent.includes('Натисни')) el.textContent = saved.text;
    }
  } catch(e) {}

  // Score — based on today's positive vs negative moments
  const pos = todayMoments.filter(m => m.mood === 'positive').length;
  const neg = todayMoments.filter(m => m.mood === 'negative').length;
  const total = todayMoments.length;
  const score = total > 0 ? Math.round((pos / total) * 100) : 0;

  const arc = document.getElementById('evening-ring-arc');
  const pctEl = document.getElementById('evening-ring-pct');
  const descEl = document.getElementById('evening-score-desc');

  if (arc) {
    const offset = 157 - (157 * score / 100);
    setTimeout(() => { arc.style.strokeDashoffset = offset; }, 100);
    pctEl.textContent = score + '%';
    descEl.textContent = total === 0 && todayNotes.length === 0 ? 'Додай моменти дня' :
      score >= 70 ? 'Гарний день 💪' : score >= 40 ? 'Середній день' : 'Важкий день';
  }

  // Moments + Notes list
  const momEl = document.getElementById('evening-moments');
  if (allTodayItems.length === 0) {
    momEl.innerHTML = '<div style="font-size:14px;color:rgba(30,16,64,0.3);text-align:center;padding:8px">Додай моменти свого дня</div>';
  } else {
    const moodColors = { positive:'#16a34a', neutral:'#d97706', negative:'#ef4444' };
    const folderIcons = { note:'📝', idea:'💡', event:'📅' };
    momEl.innerHTML = allTodayItems.map(m => `
      <div style="display:flex;align-items:flex-start;gap:8px;padding:8px 0;border-bottom:1px solid rgba(30,16,64,0.05)">
        <div style="width:8px;height:8px;border-radius:50%;background:${m.isNote ? '#818cf8' : (moodColors[m.mood]||'#888')};margin-top:5px;flex-shrink:0"></div>
        <div style="flex:1;min-width:0">
          <div style="font-size:15px;color:#1e1040;line-height:1.5;font-weight:${m.summary ? '600' : '400'}">${escapeHtml(m.summary || m.text)}${m.isNote ? ' <span style="font-size:11px;color:rgba(30,16,64,0.3)">' + (folderIcons[m.folder] || '📝') + '</span>' : ''}</div>
          ${m.summary ? `<div style="font-size:12px;color:rgba(30,16,64,0.35);line-height:1.4;margin-top:2px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical">${escapeHtml(m.text)}</div>` : ''}
        </div>
        ${!m.isNote ? `<div onclick="deleteMoment(${m.id})" style="font-size:18px;color:rgba(30,16,64,0.2);cursor:pointer">×</div>` : ''}
      </div>
    `).join('');
  }

  // Фінанси сьогодні
  try {
    const todayFinTxs = getFinance().filter(t => new Date(t.ts).toDateString() === today);
    const finBlock = document.getElementById('evening-finance-block');
    const finContent = document.getElementById('evening-finance-content');
    if (finBlock && finContent && todayFinTxs.length > 0) {
      finBlock.style.display = 'block';
      const todayExp = todayFinTxs.filter(t => t.type === 'expense').reduce((s,t) => s+t.amount, 0);
      const todayInc = todayFinTxs.filter(t => t.type === 'income').reduce((s,t) => s+t.amount, 0);
      finContent.innerHTML = todayFinTxs.slice(0,5).map(t =>
        `<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid rgba(194,65,12,0.08);font-size:13px">
          <span style="color:#7c2d12;font-weight:600">${escapeHtml(t.category)}${t.comment ? ' · '+escapeHtml(t.comment) : ''}</span>
          <span style="font-weight:700;color:${t.type==='expense'?'#c2410c':'#16a34a'}">${t.type==='expense'?'-':'+'}${formatMoney(t.amount)}</span>
        </div>`
      ).join('') + (todayExp > 0 || todayInc > 0 ? `<div style="margin-top:6px;font-size:13px;color:rgba(194,65,12,0.6);font-weight:600">${todayExp>0?'Витрати: '+formatMoney(todayExp):''}${todayExp>0&&todayInc>0?' · ':''}${todayInc>0?'Доходи: +'+formatMoney(todayInc):''}</div>` : '');
    } else if (finBlock) {
      finBlock.style.display = 'none';
    }
  } catch(e) {}
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
const UPDATE_VERSION = 'v028'; // змінювати при кожному оновленні зі слайдами

const UPDATE_SLIDES = [
  {
    tag: '🆕 v0.28',
    title: 'NeverMind став зручнішим',
    body: `<p style="font-size:14px;color:rgba(30,16,64,0.58);line-height:1.6;margin-bottom:12px">Великий UX апдейт — навігація, редагування і дизайн стали простішими і логічнішими.</p>
<p style="font-size:14px;color:rgba(30,16,64,0.58);line-height:1.6">Всі твої дані на місці. Просто спробуй — відчуєш різницю.</p>`,
    color: 'linear-gradient(135deg,#f2d978,#f97316)',
  },
  {
    tag: '👆 Тап по картці',
    title: 'Тап — і одразу редагуєш',
    body: `<p style="font-size:14px;color:rgba(30,16,64,0.58);line-height:1.6;margin-bottom:10px">Більше не треба шукати кнопку олівця або три крапки:</p>
<div style="display:flex;flex-direction:column;gap:8px">
  <div style="background:rgba(30,16,64,0.04);border-radius:10px;padding:9px 12px;font-size:13px;color:rgba(30,16,64,0.65)"><b style="color:#1e1040">Тап по картці</b> → відкриває вікно редагування</div>
  <div style="background:rgba(30,16,64,0.04);border-radius:10px;padding:9px 12px;font-size:13px;color:rgba(30,16,64,0.65)"><b style="color:#1e1040">Чекбокс</b> → виконати задачу або звичку</div>
  <div style="background:rgba(30,16,64,0.04);border-radius:10px;padding:9px 12px;font-size:13px;color:rgba(30,16,64,0.65)"><b style="color:#1e1040">Свайп вліво</b> → видалити картку</div>
</div>`,
    color: 'linear-gradient(135deg,#fdb87a,#f97316)',
  },
  {
    tag: '🥁 Новий таббар',
    title: 'Барабан замість рядка',
    body: `<p style="font-size:14px;color:rgba(30,16,64,0.58);line-height:1.6;margin-bottom:10px">Таббар тепер — капсула-барабан:</p>
<div style="display:flex;flex-direction:column;gap:8px">
  <div style="background:rgba(30,16,64,0.04);border-radius:10px;padding:9px 12px;font-size:13px;color:rgba(30,16,64,0.65)"><b style="color:#1e1040">Тягни барабан</b> ← → щоб переключати вкладки</div>
  <div style="background:rgba(30,16,64,0.04);border-radius:10px;padding:9px 12px;font-size:13px;color:rgba(30,16,64,0.65)"><b style="color:#1e1040">Свайп по екрану</b> також перемикає вкладки</div>
  <div style="background:rgba(30,16,64,0.04);border-radius:10px;padding:9px 12px;font-size:13px;color:rgba(30,16,64,0.65)">Задачі і Звички — <b style="color:#1e1040">окремі вкладки</b> в навігації</div>
</div>`,
    color: 'linear-gradient(135deg,#fed7aa,#f97316)',
  },
  {
    tag: '📝 Нотатки',
    title: 'Пиши прямо у вікні нотатки',
    body: `<p style="font-size:14px;color:rgba(30,16,64,0.58);line-height:1.6;margin-bottom:10px">Відкрив нотатку — і одразу можна писати:</p>
<div style="display:flex;flex-direction:column;gap:8px">
  <div style="background:rgba(30,16,64,0.04);border-radius:10px;padding:9px 12px;font-size:13px;color:rgba(30,16,64,0.65)"><b style="color:#1e1040">Тап по тексту</b> → курсор і клавіатура</div>
  <div style="background:rgba(30,16,64,0.04);border-radius:10px;padding:9px 12px;font-size:13px;color:rgba(30,16,64,0.65)"><b style="color:#1e1040">Автозбереження</b> — зміни зберігаються самі</div>
  <div style="background:rgba(30,16,64,0.04);border-radius:10px;padding:9px 12px;font-size:13px;color:rgba(30,16,64,0.65)">Колір вікна = <b style="color:#1e1040">колір папки</b> нотатки</div>
</div>`,
    color: 'linear-gradient(135deg,#a7f3d0,#22c55e)',
  },
  {
    tag: '❓ Довідка',
    title: 'Довідка стала зрозумілішою',
    body: `<p style="font-size:14px;color:rgba(30,16,64,0.58);line-height:1.6;margin-bottom:10px">Натисни <b style="color:#1e1040">?</b> на будь-якій вкладці:</p>
<div style="display:flex;flex-direction:column;gap:8px">
  <div style="background:rgba(30,16,64,0.04);border-radius:10px;padding:9px 12px;font-size:13px;color:rgba(30,16,64,0.65)">Кольоровий хедер — одразу видно про яку вкладку</div>
  <div style="background:rgba(30,16,64,0.04);border-radius:10px;padding:9px 12px;font-size:13px;color:rgba(30,16,64,0.65)">Зрозумілі іконки і живий текст замість технічного</div>
</div>`,
    color: 'linear-gradient(135deg,#818cf8,#4f46e5)',
    isLast: true,
  },
];

const SLIDES = [
  {
    tag: 'Що таке NeverMind',
    title: 'Думки зникають. Записав — забув де.',
    body: `<p style="font-size:14px;color:rgba(30,16,64,0.58);line-height:1.6;margin-bottom:12px">Нічого не виконується бо немає системи.</p>
<p style="font-size:14px;color:rgba(30,16,64,0.58);line-height:1.6">NeverMind — один потік куди скидаєш все що в голові. Пишеш одним рядком — Агент визначає категорію, зберігає куди треба і підтверджує в чаті.</p>`,
    color: 'linear-gradient(135deg,#f2d978,#f97316)',
  },
  {
    tag: 'Inbox',
    title: 'Один рядок — Агент розбирає',
    body: `<div style="display:flex;flex-direction:column;gap:7px">
      <div style="background:rgba(30,16,64,0.04);border-radius:10px;padding:9px 12px;font-size:13px;color:rgba(30,16,64,0.65);line-height:1.5">"купити хліб о 18:00" → <b style="color:#1e1040">задача з часом</b></div>
      <div style="background:rgba(30,16,64,0.04);border-radius:10px;padding:9px 12px;font-size:13px;color:rgba(30,16,64,0.65);line-height:1.5">"бігати щоранку" → <b style="color:#1e1040">звичка в трекері</b></div>
      <div style="background:rgba(30,16,64,0.04);border-radius:10px;padding:9px 12px;font-size:13px;color:rgba(30,16,64,0.65);line-height:1.5">"ідея про автоматизацію" → <b style="color:#1e1040">збережено в Ідеях. Обговори з Агентом</b></div>
      <div style="background:rgba(30,16,64,0.04);border-radius:10px;padding:9px 12px;font-size:13px;color:rgba(30,16,64,0.65);line-height:1.5">"зустрівся з Вовою" → <b style="color:#1e1040">момент у Вечорі</b></div>
    </div>`,
    color: 'linear-gradient(135deg,#f2d978,#f97316)',
  },
  {
    tag: 'Задачі та Звички',
    title: 'Списки і команди Агенту',
    body: `<p style="font-size:13px;color:rgba(30,16,64,0.55);line-height:1.5;margin-bottom:10px">Пиши список одним записом — Агент розібʼє на кроки:</p>
<div style="background:rgba(30,16,64,0.04);border-radius:10px;padding:9px 12px;font-size:13px;color:#1e1040;font-style:italic;margin-bottom:12px">"Зробити ремонт: купити фарбу, найняти майстра, вибрати колір"</div>
<div style="font-size:11px;font-weight:800;color:rgba(30,16,64,0.3);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:7px">Команди Агенту</div>
<div style="display:flex;flex-direction:column;gap:5px">
  <div style="background:rgba(79,70,229,0.07);border-radius:8px;padding:7px 10px;font-size:12px;font-family:monospace;color:#4f46e5;font-weight:600">"додай крок: зателефонувати"</div>
  <div style="background:rgba(79,70,229,0.07);border-radius:8px;padding:7px 10px;font-size:12px;font-family:monospace;color:#4f46e5;font-weight:600">"відміни останній крок"</div>
  <div style="background:rgba(79,70,229,0.07);border-radius:8px;padding:7px 10px;font-size:12px;font-family:monospace;color:#4f46e5;font-weight:600">"які задачі відкриті"</div>
</div>`,
    color: 'linear-gradient(135deg,#fdb87a,#ea580c)',
  },
  {
    tag: 'Вечір',
    title: 'Підсумок дня від Агента',
    body: `<p style="font-size:14px;color:rgba(30,16,64,0.58);line-height:1.6;margin-bottom:12px">Щодня: що зробив, що було цікавого, про що думав. Додавай моменти — Агент бачить весь твій день і дає конкретну пораду на завтра.</p>
<p style="font-size:14px;color:rgba(30,16,64,0.58);line-height:1.6">Записи з Inbox автоматично потрапляють у Вечір.</p>`,
    color: 'linear-gradient(135deg,#818cf8,#4f46e5)',
  },
  {
    tag: 'Вкладка Я',
    title: 'Твоя продуктивність чесно',
    body: `<p style="font-size:14px;color:rgba(30,16,64,0.58);line-height:1.6;margin-bottom:12px">Активність щодня, скільки записів зробив, які звички пропускаєш, де провисаєш.</p>
<p style="font-size:14px;color:rgba(30,16,64,0.58);line-height:1.6">Агент дає чесний аналіз і конкретні поради — без лестощів.</p>`,
    color: 'linear-gradient(135deg,#6ee7b7,#16a34a)',
  },
  {
    tag: 'Фінанси',
    title: 'Облік грошей без таблиць',
    body: `<p style="font-size:14px;color:rgba(30,16,64,0.58);line-height:1.6;margin-bottom:12px">Пиши в Inbox: "витратив 50 на їжу" — Агент сам запише у Фінанси, визначить категорію і стежитиме за бюджетом.</p>
<div style="display:flex;flex-direction:column;gap:6px">
  <div style="background:rgba(30,16,64,0.04);border-radius:10px;padding:8px 12px;font-size:13px;color:rgba(30,16,64,0.65)">"отримав зарплату 3000" → <b style="color:#1e1040">дохід зафіксовано</b></div>
  <div style="background:rgba(30,16,64,0.04);border-radius:10px;padding:8px 12px;font-size:13px;color:rgba(30,16,64,0.65)">"заплатив за Netflix 15" → <b style="color:#1e1040">Підписки</b></div>
  <div style="background:rgba(30,16,64,0.04);border-radius:10px;padding:8px 12px;font-size:13px;color:rgba(30,16,64,0.65)">Перевищив ліміт → <b style="color:#1e1040">Агент попередить</b></div>
</div>`,
    color: 'linear-gradient(135deg,#fcd9bd,#f97316)',
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

  // Контент
  const contentEl = document.getElementById('slides-content');
  contentEl.innerHTML = `
    <div style="display:inline-block;font-size:11px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;padding:3px 10px;border-radius:20px;background:rgba(30,16,64,0.06);color:rgba(30,16,64,0.4);margin-bottom:10px">${slide.tag}</div>
    <div style="font-size:17px;font-weight:800;color:#1e1040;line-height:1.35;margin-bottom:14px">${slide.title}</div>
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
        addInboxChatMsg('agent', reply);
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
        addEveningBarMsg('agent', reply);
      }
    } catch {
      addEveningBarMsg('agent', reply);
    }
  } catch { addEveningBarMsg('agent', 'Мережева помилка.'); }
  eveningBarLoading = false;
}

