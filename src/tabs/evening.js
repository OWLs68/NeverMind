// ============================================================
// evening.js — Вкладка Вечір (core: рендер, моменти, настрій, підсумок)
// ============================================================
// Рефакторинг QV1n2 (19.04.2026): вкладка "Я" винесена у me.js,
// чат Вечора — у evening-chat.js, tool handlers — у evening-actions.js.
// Детальний план → docs/EVENING_2.0_PLAN.md
// ============================================================

import { currentTab, showToast } from '../core/nav.js';
import { escapeHtml, logRecentAction, extractJsonBlocks } from '../core/utils.js';
import { callAI, callAIWithHistory, getAIContext, getOWLPersonality, openChatBar, safeAgentReply, saveChatMsg } from '../ai/core.js';
import { getTasks, setupModalSwipeClose } from './tasks.js';
import { getHabits, getHabitLog, getQuitStatus, processUniversalAction } from './habits.js';
import { getNotes } from './notes.js';
import { getCurrency, getFinance } from './finance.js';
import { getProjects } from './projects.js';

// Typing indicator shared with evening chat (evening-chat.js reads/writes)
let _eveningTypingEl = null;

// === EVENING TAB ===
let currentMomentMood = 'positive';
let dialogHistory = [];
let dialogLoading = false;

export function getMoments() { return JSON.parse(localStorage.getItem('nm_moments') || '[]'); }
export function saveMoments(arr) { localStorage.setItem('nm_moments', JSON.stringify(arr)); window.dispatchEvent(new CustomEvent('nm-data-changed', { detail: 'moments' })); }

// Контекст моментів сьогодні для AI (принцип "один мозок")
// OWL бачить що юзер зафіксував протягом дня — ключове для вечірнього підсумку
// і для емпатійних реакцій у чатах ("бачу ти писав зранку що втомився — як зараз?")
export function getMomentsContext() {
  const today = new Date().toDateString();
  const moments = getMoments().filter(m => new Date(m.ts).toDateString() === today);
  if (moments.length === 0) return '';
  const moodEmoji = { positive: '😊', neutral: '😐', negative: '😞' };
  const lines = moments.slice(-8).map(m => {
    const d = new Date(m.ts);
    const time = d.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
    const em = moodEmoji[m.mood] || '';
    const txt = m.summary || m.text;
    return `- ${time} ${em} "${txt}"`;
  }).join('\n');
  return `Моменти дня (що юзер зафіксував сьогодні — використовуй у підсумках і емпатійних відповідях):\n${lines}`;
}

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

    // Розбиваємо AI-відповідь на окремі JSON блоки (кілька дій одразу).
    const blocks = extractJsonBlocks(reply);
    let handled = false;
    for (const parsed of blocks) {
      if (processUniversalAction(parsed, text, addEveningBarMsg)) handled = true;
    }
    if (!handled) safeAgentReply(reply, addEveningBarMsg);
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
  sendDialogMessage, sendEveningBarMessage,
  deleteMoment, openMomentView, closeMomentView,
});
