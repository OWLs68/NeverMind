// ============================================================
// evening.js — Вкладка Вечір (core: рендер, моменти, настрій, підсумок)
// ============================================================
// Рефакторинг QV1n2 (19.04.2026): вкладка "Я" винесена у me.js,
// чат Вечора — у evening-chat.js, tool handlers — у evening-actions.js.
// Детальний план → docs/EVENING_2.0_PLAN.md
// ============================================================

import { showToast } from '../core/nav.js';
import { escapeHtml, logRecentAction } from '../core/utils.js';
import { logUsage } from '../core/usage-meter.js';
import { getTasks, setupModalSwipeClose } from './tasks.js';
import { getHabits, getHabitLog, getQuitStatus } from './habits.js';
import { getNotes } from './notes.js';
import { getCurrency, getFinance } from './finance.js';
import { getProjects } from './projects.js';
import { getEvents } from './calendar.js';

// === EVENING TAB ===
let currentMomentMood = 'positive';

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

// Вечірній зріз дня для AI-контексту (Фаза 2 Вечора 2.0).
// Доповнює getAIContext() тим чого там немає: настрій, недороблені
// сьогоднішні задачі, закриті кроки проектів, quit-звички статус,
// минулі події календаря, витрати дня. Не дублюємо моменти/ліки/нотатки
// (вони додаються окремими функціями у core.js).
export function getEveningContext() {
  const lines = [];
  const today = new Date().toDateString();
  const todayISO = new Date().toISOString().slice(0, 10);
  const nowMs = Date.now();

  // Настрій дня (5 рівнів, юзер сам тапнув)
  const mood = getEveningMood();
  if (mood) {
    const moodMap = { bad: '😔 важкий', meh: '😐 так собі', ok: '🙂 норм', good: '😄 гарний', fire: '🔥 чудовий' };
    lines.push(`Настрій дня (юзер сам обрав у Вечорі): ${moodMap[mood] || mood}`);
  }

  // Недороблені задачі з дедлайном === сьогодні
  try {
    const dueToday = getTasks().filter(t => t.status === 'active' && t.dueDate === todayISO);
    if (dueToday.length > 0) {
      const list = dueToday.slice(0, 6).map(t => `- [ID:${t.id}] "${t.title}"`).join('\n');
      lines.push(`Задачі з дедлайном СЬОГОДНІ але не закриті:\n${list}`);
    }
  } catch(e) {}

  // Кроки проектів закриті сьогодні
  try {
    const stepsToday = [];
    getProjects().forEach(p => {
      (p.steps || []).forEach(s => {
        if (s.done && s.doneAt && new Date(s.doneAt).toDateString() === today) {
          stepsToday.push(`- ✅ "${s.title || s.text || ''}" (проект: ${p.title || p.name || '—'})`);
        }
      });
    });
    if (stepsToday.length > 0) {
      lines.push(`Кроки проектів закриті сьогодні:\n${stepsToday.slice(0, 8).join('\n')}`);
    }
  } catch(e) {}

  // Звички — короткий summary за сьогодні
  try {
    const habits = getHabits();
    const log = getHabitLog();
    const nonQuit = habits.filter(h => h.type !== 'quit');
    const todayDow = (new Date().getDay() + 6) % 7;
    const todayH = nonQuit.filter(h => (h.days || [0,1,2,3,4,5,6]).includes(todayDow));
    if (todayH.length > 0) {
      const doneH = todayH.filter(h => !!log[today]?.[h.id]).length;
      lines.push(`Звички дня: ${doneH}/${todayH.length} виконано`);
    }
    // Quit-звички статус сьогодні (челенджі кинути)
    const quitHabits = habits.filter(h => h.type === 'quit');
    if (quitHabits.length > 0) {
      const qLines = quitHabits.map(h => {
        const s = getQuitStatus(h.id);
        const marked = s.lastHeld === todayISO ? 'тримався сьогодні ✓' : 'сьогодні НЕ відмічено';
        return `- "${h.name}": стрік ${s.streak || 0} дн, ${marked}`;
      }).join('\n');
      lines.push(`Челенджі "кинути":\n${qLines}`);
    }
  } catch(e) {}

  // Минулі події календаря сьогодні (по часу)
  try {
    const pastEvents = getEvents().filter(ev => {
      if (ev.date !== todayISO) return false;
      if (!ev.time) return true;
      const [h, m] = ev.time.split(':').map(Number);
      return new Date().setHours(h, m, 0, 0) < nowMs;
    });
    if (pastEvents.length > 0) {
      const evLines = pastEvents.slice(0, 5)
        .map(ev => `- 📅 "${ev.title}"${ev.time ? ' о ' + ev.time : ''}`).join('\n');
      lines.push(`Минулі події сьогодні:\n${evLines}`);
    }
  } catch(e) {}

  // Витрати дня — сума + топ-3 категорії
  try {
    const todayExpenses = getFinance()
      .filter(t => t.type === 'expense' && new Date(t.ts).toDateString() === today);
    if (todayExpenses.length > 0) {
      const total = todayExpenses.reduce((s, t) => s + t.amount, 0);
      const byCat = {};
      todayExpenses.forEach(t => { byCat[t.category || 'Інше'] = (byCat[t.category || 'Інше'] || 0) + t.amount; });
      const top3 = Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 3)
        .map(([c, a]) => `${c} ${Math.round(a)}`).join(', ');
      const cur = getCurrency ? getCurrency() : '₴';
      lines.push(`Витрати дня: ${cur}${Math.round(total)} (топ: ${top3})`);
    }
  } catch(e) {}

  if (lines.length === 0) return '';
  return `ВЕЧІРНІЙ ЗРІЗ ДНЯ (використовуй для підсумків/діалогу у Вечорі і емпатійних реакцій на інших вкладках):\n${lines.join('\n\n')}`;
}

export function renderEvening() {
  updateEveningLock();
  updateEveningClosedBadge();
  const today = new Date().toDateString();
  const todayMoments = getMoments().filter(m => new Date(m.ts).toDateString() === today);

  // === Настрій (піднято вище у Фазі 5, не об'єднаний з кільцем — кільце видалено)
  const savedMood = getEveningMood();
  if (savedMood) renderEveningMoodButtons(savedMood);

  // === Моменти дня + нотатки (маркер кольору відрізняється)
  const momEl = document.getElementById('evening-moments');
  if (momEl) {
    const todayNotes = getNotes().filter(n => new Date(n.ts || n.createdAt || 0).toDateString() === today);
    const notesAsItems = todayNotes.map(n => ({ id: 'note_' + n.id, text: n.title || n.text || '', mood: 'neutral', ts: n.ts || n.createdAt || 0, isNote: true }));
    const allItems = [...todayMoments, ...notesAsItems].sort((a, b) => (a.ts || 0) - (b.ts || 0));

    if (allItems.length === 0) {
      momEl.innerHTML = '<div style="font-size:13px;color:rgba(30,16,64,0.3);text-align:center;padding:8px 0">Моменти і нотатки за сьогодні зʼявляться тут</div>';
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

  renderEveningUndoneTasks();
  renderEveningQuitHabits();
}

// === НЕДОРОБЛЕНІ ЗАДАЧІ (Фаза 5) ===
// Задачі з dueDate=today + status=active. Біля кожної — чіпи
// [На завтра] [На тиждень]. Один тап = переніс + закрив питання.
function renderEveningUndoneTasks() {
  const container = document.getElementById('evening-undone');
  if (!container) return;
  const todayISO = new Date().toISOString().slice(0, 10);
  const undone = getTasks().filter(t => t.status === 'active' && t.dueDate === todayISO);
  const wrapBlock = document.getElementById('evening-undone-block');
  if (undone.length === 0) {
    if (wrapBlock) wrapBlock.style.display = 'none';
    return;
  }
  if (wrapBlock) wrapBlock.style.display = 'block';
  const top = undone.slice(0, 5);
  const more = undone.length - top.length;
  container.innerHTML = top.map(t => `
    <div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid rgba(30,16,64,0.06)">
      <div style="flex:1;font-size:14px;color:#1e1040;font-weight:500;line-height:1.4">${escapeHtml(t.title)}</div>
      <button onclick="rescheduleTaskTomorrow('${t.id}')" style="background:rgba(194,121,10,0.12);color:#5b3d12;border:1px solid rgba(194,121,10,0.35);border-radius:999px;padding:5px 10px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">На завтра</button>
      <button onclick="rescheduleTaskWeek('${t.id}')" style="background:rgba(30,16,64,0.06);color:rgba(30,16,64,0.7);border:1px solid rgba(30,16,64,0.12);border-radius:999px;padding:5px 10px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">На тиждень</button>
    </div>
  `).join('') + (more > 0 ? `<div style="font-size:11px;color:rgba(30,16,64,0.4);text-align:center;padding:6px 0 0 0">і ще ${more}</div>` : '');
}

function _rescheduleTask(taskId, daysAhead) {
  const tasks = getTasks();
  const idx = tasks.findIndex(t => String(t.id) === String(taskId));
  if (idx === -1) return;
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  tasks[idx].dueDate = d.toISOString().slice(0, 10);
  tasks[idx].updatedAt = Date.now();
  // saveTasks не експортований з цього модуля, але localStorage пишемо напряму
  localStorage.setItem('nm_tasks', JSON.stringify(tasks));
  window.dispatchEvent(new CustomEvent('nm-data-changed', { detail: 'tasks' }));
  showToast(daysAhead === 1 ? '📅 На завтра' : '📅 Через ' + daysAhead + ' дн');
  renderEvening();
}

function rescheduleTaskTomorrow(taskId) { _rescheduleTask(taskId, 1); }
function rescheduleTaskWeek(taskId) { _rescheduleTask(taskId, 7); }

// === QUIT-ЗВИЧКИ ВІДМІТКА (Фаза 5) ===
// Вечір = обовʼязкова точка щоденної відмітки для збереження стріку.
// Чіпи [Тримався 💪] [Зірвався] по кожній активній quit-звичці.
function renderEveningQuitHabits() {
  const container = document.getElementById('evening-quit');
  if (!container) return;
  const todayISO = new Date().toISOString().slice(0, 10);
  const quits = getHabits().filter(h => h.type === 'quit');
  const wrapBlock = document.getElementById('evening-quit-block');
  if (quits.length === 0) {
    if (wrapBlock) wrapBlock.style.display = 'none';
    return;
  }
  if (wrapBlock) wrapBlock.style.display = 'block';
  container.innerHTML = quits.map(h => {
    const s = getQuitStatus(h.id);
    const heldToday = s.lastHeld === todayISO;
    const streak = s.streak || 0;
    const streakText = streak > 0 ? `стрік ${streak} дн` : 'новий старт';
    if (heldToday) {
      return `
        <div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid rgba(30,16,64,0.06)">
          <div style="flex:1">
            <div style="font-size:14px;color:#1e1040;font-weight:600">${escapeHtml(h.name)}</div>
            <div style="font-size:11px;color:#16a34a;font-weight:700;margin-top:2px">Тримаєшся сьогодні ✓ · ${streakText}</div>
          </div>
        </div>`;
    }
    return `
      <div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid rgba(30,16,64,0.06)">
        <div style="flex:1">
          <div style="font-size:14px;color:#1e1040;font-weight:600">${escapeHtml(h.name)}</div>
          <div style="font-size:11px;color:rgba(30,16,64,0.5);font-weight:600;margin-top:2px">${streakText}</div>
        </div>
        <button onclick="holdQuitHabit(${h.id});renderEvening()" style="background:rgba(22,163,74,0.12);color:#15803d;border:1px solid rgba(22,163,74,0.35);border-radius:999px;padding:5px 10px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">Тримався 💪</button>
        <button onclick="confirmQuitRelapse(${h.id});setTimeout(renderEvening,50)" style="background:rgba(30,16,64,0.06);color:rgba(30,16,64,0.7);border:1px solid rgba(30,16,64,0.12);border-radius:999px;padding:5px 10px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">Зірвався</button>
      </div>`;
  }).join('');
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
    if (data?.usage) logUsage('evening-summary', data.usage, data.model);
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

// ============================================================
// EVENING LOCK — вкладка заблокована до 18:00 (ритуал закриття дня)
// Матове скло поверх вмісту, таймер "до розблокування", о 18:00
// скло "тане" і з'являється вміст. Знову замикається о 23:59.
// План → docs/EVENING_2.0_PLAN.md Фаза 1.
// ============================================================
let _eveningLockTickerId = null;
let _eveningLockVisListener = false;

export function isEveningLocked() {
  const d = new Date();
  const h = d.getHours();
  const m = d.getMinutes();
  return h < 18 || (h === 23 && m >= 59);
}

function _formatUnlockCountdown() {
  const now = new Date();
  const target = new Date(now);
  target.setHours(18, 0, 0, 0);
  if (now.getHours() >= 18) target.setDate(target.getDate() + 1);
  const diffMin = Math.max(1, Math.round((target - now) / 60000));
  const h = Math.floor(diffMin / 60);
  const m = diffMin % 60;
  if (h > 0) return `до розблокування: ${h} год ${m} хв`;
  return `до розблокування: ${m} хв`;
}

export function updateEveningLock() {
  const overlay = document.getElementById('evening-lock-overlay');
  if (!overlay) return;
  const bar = document.getElementById('evening-ai-bar');
  const timerEl = document.getElementById('evening-lock-timer');
  const locked = isEveningLocked();
  const wasVisible = overlay.style.display !== 'none';

  if (locked) {
    overlay.classList.remove('melting');
    overlay.style.display = 'flex';
    if (bar) bar.style.display = 'none';
    if (timerEl) timerEl.textContent = _formatUnlockCountdown();
  } else if (wasVisible) {
    overlay.classList.add('melting');
    setTimeout(() => {
      overlay.style.display = 'none';
      overlay.classList.remove('melting');
    }, 650);
  }
}

function _startEveningLockTicker() {
  if (_eveningLockTickerId) return;
  _eveningLockTickerId = setInterval(updateEveningLock, 60 * 1000);
  if (!_eveningLockVisListener) {
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) updateEveningLock();
    });
    _eveningLockVisListener = true;
  }
}

// Значок "✓ День закрито" у верхньому куті вкладки (Фаза 8).
// Перевіряємо nm_evening_closed: якщо date === сьогодні — показуємо бейдж.
export function updateEveningClosedBadge() {
  const badge = document.getElementById('evening-day-closed-badge');
  if (!badge) return;
  try {
    const s = JSON.parse(localStorage.getItem('nm_evening_closed') || 'null');
    const todayISO = new Date().toISOString().slice(0, 10);
    badge.style.display = (s && s.date === todayISO) ? 'inline-block' : 'none';
  } catch(e) { badge.style.display = 'none'; }
}

window.addEventListener('nm-evening-closed', updateEveningClosedBadge);

// === WINDOW EXPORTS (HTML handlers only) ===
// sendEveningBarMessage, openEveningTopic, showEveningBarMessages
// → живуть у evening-chat.js (їхній власний window.assign).
Object.assign(window, {
  openAddMoment, saveMoment, closeMomentModal, setMomentMood,
  setEveningMood,
  deleteMoment, openMomentView, closeMomentView,
  rescheduleTaskTomorrow, rescheduleTaskWeek,
});

_startEveningLockTicker();
