// ============================================================
// app-habits.js — Звички, productivity tabs, universal action processor
// Залежності: app-core.js, app-ai.js, app-tasks-core.js
// ============================================================

import { currentTab, showToast } from '../core/nav.js';
import { escapeHtml, logRecentAction, extractJsonBlocks } from '../core/utils.js';
import { logUsage } from '../core/usage-meter.js';
import { generateUUID } from '../core/uuid.js';
import { addToTrash, showUndoToast } from '../core/trash.js';
import { callAIWithTools, getAIContext, getOWLPersonality, safeAgentReply, INBOX_TOOLS, handleChatError } from '../ai/core.js';
import { UI_TOOLS_RULES, REMINDER_RULES, GLOBAL_TOOLS_RULE } from '../ai/prompts.js';
import { dispatchChatToolCalls } from '../ai/tool-dispatcher.js';
import { attachSwipeDelete } from '../ui/swipe-delete.js';
import { addInboxChatMsg, getInbox, saveInbox, renderInbox, _detectEventFromTask } from './inbox.js';
import { getTasks, saveTasks, renderTasks, openAddTask, addTaskBarMsg, taskBarHistory, taskBarLoading, setTaskBarLoading, setupModalSwipeClose, toggleTaskStatus } from './tasks.js';
import { getNotes, saveNotes, renderNotes, addNoteFromInbox, currentNotesFolder, setCurrentNotesFolder } from './notes.js';
import { getFinance, saveFinance, renderFinance, formatMoney, getFinCats, saveFinCats, _resolveFinanceDate, createFinCategory } from './finance.js';
import { getMoments, saveMoments } from './evening.js';
import { renderMeHabitsStats } from './me.js';
import { getEvents, saveEvents, addEventDedup, generateWeeklySeries, getRoutine, saveRoutine } from './calendar.js';

// === HABITS ===
let editingHabitId = null;

export function getHabits() { return JSON.parse(localStorage.getItem('nm_habits2') || '[]'); }
export function saveHabits(arr) { localStorage.setItem('nm_habits2', JSON.stringify(arr)); window.dispatchEvent(new CustomEvent('nm-data-changed', { detail: 'habits' })); }
export function getHabitLog() { return JSON.parse(localStorage.getItem('nm_habit_log2') || '{}'); }
export function saveHabitLog(obj) { localStorage.setItem('nm_habit_log2', JSON.stringify(obj)); window.dispatchEvent(new CustomEvent('nm-data-changed', { detail: 'habits' })); }

// === QUIT HABITS — челендж "Кинути" ===
function getQuitLog() { return JSON.parse(localStorage.getItem('nm_quit_log') || '{}'); }
function saveQuitLog(obj) { localStorage.setItem('nm_quit_log', JSON.stringify(obj)); window.dispatchEvent(new CustomEvent('nm-data-changed', { detail: 'habits' })); }

// Повертає статус quit-звички: { streak, longestStreak, relapses, lastHeld, freedomDays }
// freedomDays — сумарна кількість днів "тримався", ніколи не скидається
export function getQuitStatus(habitId) {
  const log = getQuitLog();
  return log[habitId] || { streak: 0, longestStreak: 0, relapses: [], lastHeld: null, freedomDays: 0 };
}

// Відмітити що "тримається" сьогодні
function holdQuitHabit(habitId) {
  const today = new Date().toISOString().slice(0, 10);
  const log = getQuitLog();
  if (!log[habitId]) log[habitId] = { streak: 0, longestStreak: 0, relapses: [], lastHeld: null, freedomDays: 0 };
  const s = log[habitId];
  if (s.lastHeld === today) return; // вже відмічено сьогодні
  // freedomDays — ніколи не скидається, рахуємо кожен день "тримався"
  s.freedomDays = (s.freedomDays || 0) + 1;
  // Перевіряємо чи стрік безперервний (вчора теж тримався)
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (s.lastHeld === yesterday || s.lastHeld === null) {
    s.streak = (s.streak || 0) + 1;
  } else {
    s.streak = 1; // пропустив — скидаємо
  }
  s.longestStreak = Math.max(s.streak, s.longestStreak || 0);
  s.lastHeld = today;
  log[habitId] = s;
  saveQuitLog(log);
  renderProdHabits();
  const fd = s.freedomDays;
  showToast('💪 +1 вільний день! Всього: ' + fd + ' ' + _dayWord(fd));
}

// Відмітити зрив
function relapseQuitHabit(habitId) {
  const today = new Date().toISOString().slice(0, 10);
  const log = getQuitLog();
  if (!log[habitId]) log[habitId] = { streak: 0, longestStreak: 0, relapses: [], lastHeld: null, freedomDays: 0 };
  const s = log[habitId];
  if (!s.relapses) s.relapses = [];
  // Не дозволяємо два зриви в один день
  if (s.relapses[s.relapses.length - 1] === today) {
    showToast('Зрив вже відмічено сьогодні');
    return;
  }
  s.relapses.push(today);
  // Залишаємо тільки останні 90 днів
  const cutoff = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
  s.relapses = s.relapses.filter(d => d >= cutoff);
  const prevStreak = s.streak;
  // freedomDays НЕ змінюється — зрив не анулює вільні дні
  s.streak = 0;
  s.lastHeld = null;
  log[habitId] = s;
  saveQuitLog(log);
  renderProdHabits();
  // OWL реагує
  _owlQuitRelapse(habitId, prevStreak, s.freedomDays || 0);
}

function _dayWord(n) {
  if (n % 10 === 1 && n % 100 !== 11) return 'день';
  if ([2,3,4].includes(n % 10) && ![12,13,14].includes(n % 100)) return 'дні';
  return 'днів';
}

function _owlQuitRelapse(habitId, prevStreak, freedomDays) {
  const habits = getHabits();
  const h = habits.find(x => x.id === habitId);
  const name = h ? h.name : 'звичку';
  const fdText = freedomDays > 0 ? ` Твої ${freedomDays} вільних ${_dayWord(freedomDays)} — назавжди твої.` : '';
  const key = localStorage.getItem('nm_gemini_key');
  if (!key) {
    addInboxChatMsg('agent', `Сьогодні важкий день з "${name}".${fdText} Завтра новий шанс.`);
    return;
  }
  const settings = JSON.parse(localStorage.getItem('nm_settings') || '{}');
  const owlMode = settings.owl_mode || 'balanced';
  const tone = owlMode === 'brutal' ? 'різкий, чесний, без зайвого жалю' : owlMode === 'soft' ? 'м\'який, підтримуючий, співчутливий' : 'збалансований, чесний але підтримуючий';
  fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      max_tokens: 80,
      messages: [{
        role: 'system',
        content: `Ти OWL — персональний агент. Тон: ${tone}. Відповідай ТІЛЬКИ одним реченням українською. Не згадуй "стрік обнулено". Підкресли що ${freedomDays} вільних днів нікуди не ділись.`
      }, {
        role: 'user',
        content: `Користувач зірвався з "${name}". Серія була ${prevStreak} ${_dayWord(prevStreak)}, але загалом ${freedomDays} вільних ${_dayWord(freedomDays)} — вони залишаються. Скажи щось коротке та підтримуюче.`
      }]
    })
  }).then(r => r.json()).then(d => {
    if (d?.usage) logUsage('habits-ai', d.usage, d.model);
    const reply = d.choices?.[0]?.message?.content;
    if (reply) addInboxChatMsg('agent', reply);
  }).catch(() => {
    addInboxChatMsg('agent', `Сьогодні важкий день з "${name}".${fdText} Завтра — новий шанс.`);
  });
}

// Поточний тип в модалці (build або quit)
let _habitModalType = 'build';

function setHabitModalType(type) {
  _habitModalType = type;
  const buildBtn = document.getElementById('habit-type-build');
  const quitBtn = document.getElementById('habit-type-quit');
  const countSection = document.getElementById('habit-count-section');
  if (type === 'build') {
    buildBtn.style.background = 'white';
    buildBtn.style.color = '#16a34a';
    buildBtn.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';
    quitBtn.style.background = 'transparent';
    quitBtn.style.color = 'rgba(30,16,64,0.4)';
    quitBtn.style.boxShadow = 'none';
    if (countSection) countSection.style.display = 'flex';
  } else {
    quitBtn.style.background = 'white';
    quitBtn.style.color = '#c2410c';
    quitBtn.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';
    buildBtn.style.background = 'transparent';
    buildBtn.style.color = 'rgba(30,16,64,0.4)';
    buildBtn.style.boxShadow = 'none';
    if (countSection) countSection.style.display = 'none';
  }
}

function adjustHabitCount(delta) {
  const inp = document.getElementById('habit-input-count');
  const disp = document.getElementById('habit-count-display');
  if (!inp || !disp) return;
  let val = Math.max(1, Math.min(20, parseInt(inp.value || 1) + delta));
  inp.value = val;
  disp.textContent = val;
}

function openEditHabit(id) {
  const habits = getHabits();
  const h = habits.find(x => x.id === id);
  if (!h) return;
  editingHabitId = id;
  document.getElementById('habit-modal-title').textContent = 'Редагувати звичку';
  document.getElementById('habit-input-name').value = h.name;
  let details = h.details || '';
  if (!details && h.name) {
    const parts = h.name.split(/[,]\s*/);
    if (parts.length > 1) details = parts.slice(1).join(', ').trim();
  }
  document.getElementById('habit-input-details').value = details;
  document.getElementById('habit-input-emoji').value = h.emoji || '';
  // Кількість разів
  const cnt = h.targetCount || 1;
  document.getElementById('habit-input-count').value = cnt;
  document.getElementById('habit-count-display').textContent = cnt;
  let days = h.days || [0,1,2,3,4];
  const nameAndDetails = (h.name + ' ' + details).toLowerCase();
  const hasSpecificDays = /понеділ|вівтор|серед|четвер|п.ятниц|субот|неділ/.test(nameAndDetails);
  if (hasSpecificDays && days.length === 7) {
    days = [];
    if (/понеділ|пн/.test(nameAndDetails)) days.push(0);
    if (/вівтор|вт/.test(nameAndDetails)) days.push(1);
    if (/серед|ср/.test(nameAndDetails)) days.push(2);
    if (/четвер|чт/.test(nameAndDetails)) days.push(3);
    if (/п.ятниц|пт/.test(nameAndDetails)) days.push(4);
    if (/субот|сб/.test(nameAndDetails)) days.push(5);
    if (/неділ|нд/.test(nameAndDetails)) days.push(6);
    if (days.length === 0) days = [0,1,2,3,4];
  }
  document.querySelectorAll('.habit-day-btn').forEach(b => {
    b.classList.toggle('active', days.includes(parseInt(b.dataset.day)));
  });
  setHabitModalType(h.type === 'quit' ? 'quit' : 'build');
  document.getElementById('habit-modal').style.display = 'flex';
  document.getElementById('habit-delete-btn').style.display = 'inline-block';
  setupModalSwipeClose(document.querySelector('#habit-modal > div:last-child'), closeHabitModal);
}

function openAddHabit() {
  editingHabitId = null;
  document.getElementById('habit-modal-title').textContent = 'Нова звичка';
  document.getElementById('habit-input-name').value = '';
  document.getElementById('habit-input-details').value = '';
  document.getElementById('habit-input-emoji').value = '';
  document.getElementById('habit-input-count').value = '1';
  document.getElementById('habit-count-display').textContent = '1';
  document.getElementById('habit-delete-btn').style.display = 'none';
  setHabitModalType('build');
  document.querySelectorAll('.habit-day-btn').forEach(b => {
    b.classList.toggle('active', [0,1,2,3,4].includes(parseInt(b.dataset.day)));
  });
  document.getElementById('habit-modal').style.display = 'flex';
  setupModalSwipeClose(document.querySelector('#habit-modal > div:last-child'), closeHabitModal);
}

function closeHabitModal() {
  document.getElementById('habit-modal').style.display = 'none';
}

// Toggle day button
document.addEventListener('click', e => {
  if (e.target.classList.contains('habit-day-btn')) {
    e.target.classList.toggle('active');
  }
});

function saveHabit() {
  const name = document.getElementById('habit-input-name').value.trim();
  if (!name) { showToast('Введи назву звички'); return; }
  const details = document.getElementById('habit-input-details').value.trim();
  const emoji = document.getElementById('habit-input-emoji').value.trim() || (_habitModalType === 'quit' ? '🚫' : '⭕');
  const days = [...document.querySelectorAll('.habit-day-btn.active')].map(b => parseInt(b.dataset.day));
  const targetCount = _habitModalType === 'quit' ? 1 : (parseInt(document.getElementById('habit-input-count').value || 1) || 1);
  const type = _habitModalType;
  const habits = getHabits();

  if (editingHabitId) {
    const idx = habits.findIndex(x => x.id === editingHabitId);
    if (idx !== -1) habits[idx] = { ...habits[idx], name, details, emoji, days, targetCount, type };
  } else {
    habits.push({ id: Date.now(), name, details, emoji, days, targetCount, type, createdAt: Date.now() });
  }
  saveHabits(habits);
  closeHabitModal();
  renderHabits();
  renderProdHabits();
  showToast(editingHabitId ? '✓ Звичку оновлено' : (type === 'quit' ? '🚫 Челендж створено' : '✓ Звичку додано'));
}

function deleteHabit(id) {
  if (!confirm('Видалити звичку?')) return;
  saveHabits(getHabits().filter(h => h.id !== id));
  renderHabits();
  renderProdHabits();
}

function deleteHabitFromModal() {
  if (!editingHabitId) return;
  const id = editingHabitId;
  const item = getHabits().find(h => h.id === id);
  saveHabits(getHabits().filter(h => h.id !== id));
  renderHabits(); renderProdHabits();
  closeHabitModal();
  if (item) showUndoToast('Звичку видалено', () => { const habits = getHabits(); habits.push(item); saveHabits(habits); renderHabits(); renderProdHabits(); });
}

// Хелпер — чи вважається звичка виконаною за день
function _habitDone(h, logDay) {
  const target = h.targetCount || 1;
  const val = logDay?.[h.id];
  const cur = typeof val === 'boolean' ? (val ? 1 : 0) : (val || 0);
  return cur >= target;
}

function toggleHabitToday(id) {
  const today = new Date().toDateString();
  const log = getHabitLog();
  if (!log[today]) log[today] = {};
  const habits = getHabits();
  const h = habits.find(x => x.id === id);
  const target = h?.targetCount || 1;
  const rawVal = log[today][id];
  const cur = typeof rawVal === 'boolean' ? (rawVal ? 1 : 0) : (rawVal || 0);
  // Тристаний цикл для звичайних звичок (target=1): 0→1→2→0 (порожня→зелена→жовта→порожня).
  // Звички з лічильником (target>1) — старий behavior cur+1 щоб рахувати підходи.
  const newVal = (target === 1)
    ? (cur === 0 ? 1 : cur === 1 ? 2 : 0)
    : cur + 1;
  log[today][id] = newVal;
  saveHabitLog(log);
  if (h) logRecentAction('complete_habit', h.name, 'habits');
  renderHabits();
  renderMeHabitsStats();
}

export function getHabitStreak(id) {
  const log = getHabitLog();
  const habits = getHabits();
  const h = habits.find(x => x.id === id);
  if (!h) return 0;
  let streak = 0;
  const d = new Date();
  for (let i = 0; i < 60; i++) {
    const ds = d.toDateString();
    const dow = (d.getDay() + 6) % 7;
    if ((h.days || [0,1,2,3,4]).includes(dow)) {
      if (_habitDone(h, log[ds])) streak++;
      else if (i > 0) break;
    }
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

export function getHabitPct(id) {
  const log = getHabitLog();
  const habits = getHabits();
  const h = habits.find(x => x.id === id);
  if (!h) return 0;
  const plannedDays = h.days || [0,1,2,3,4];
  const d = new Date();
  let total = 0, done = 0;
  for (let i = 0; i < 30; i++) {
    const ds = d.toDateString();
    const dow = (d.getDay() + 6) % 7;
    if (plannedDays.includes(dow)) {
      total++;
      if (_habitDone(h, log[ds])) done++;
    } else if (_habitDone(h, log[ds])) {
      done++;
    }
    d.setDate(d.getDate() - 1);
  }
  return total > 0 ? Math.round(done / total * 100) : 0;
}


// Повертає масив {i, bonus} — дні цього тижня коли звичка виконана.
// bonus=true якщо cur > target (жовта галочка = подвійне виконання).
function getHabitWeekDays(id, target) {
  const log = getHabitLog();
  const done = [];
  const today = new Date();
  const todayDow = (today.getDay() + 6) % 7;
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - todayDow);
  weekStart.setHours(0,0,0,0);
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    const ds = d.toDateString();
    const val = log[ds]?.[id];
    const cur = typeof val === 'boolean' ? (val ? 1 : 0) : (val || 0);
    if (cur >= target) done.push({ i, bonus: cur > target });
  }
  return done;
}

function makeHabitDayDots(h, weekState, todayDow) {
  const labels = ['Пн','Вт','Ср','Чт','Пт','Сб','Нд'];
  return labels.map(function(label, i) {
    const isPlanned = (h.days || [0,1,2,3,4]).includes(i);
    const entry = weekState.find(x => x.i === i);
    const isDone = !!entry;
    const isBonus = !!(entry && entry.bonus);
    const isToday = i === todayDow;
    let bg, border, color;
    if (isDone) {
      if (isBonus) { bg = 'linear-gradient(135deg,#fbbf24,#f59e0b)'; border = 'transparent'; }
      else { bg = '#16a34a'; border = '#16a34a'; }
      color = 'white';
    }
    else if (isPlanned) { bg = 'transparent'; border = 'rgba(30,16,64,0.2)'; color = 'rgba(30,16,64,0.4)'; }
    else { bg = 'transparent'; border = 'rgba(30,16,64,0.08)'; color = 'rgba(30,16,64,0.15)'; }
    const shadow = isToday ? 'box-shadow:0 0 0 2px rgba(22,163,74,0.3);' : '';
    const text = isDone ? '✓' : label.charAt(0);
    return '<div style="width:24px;height:24px;border-radius:50%;background:' + bg + ';border:1.5px solid ' + border + ';display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;color:' + color + ';' + shadow + '">' + text + '</div>';
  }).join('');
}

export function renderHabits() {
  const habits = getHabits();
  const el = document.getElementById('me-habits-stats-list');
  const block = document.getElementById('me-habits-stats');
  if (!el) return;
  const log = getHabitLog();
  const today = new Date().toDateString();
  const todayDow = (new Date().getDay() + 6) % 7;

  if (habits.length === 0) {
    el.innerHTML = '<div style="text-align:center;padding:20px 0;color:rgba(30,16,64,0.3);font-size:15px">Додай першу звичку</div>';
    return;
  }

  el.innerHTML = habits.map(function(h) {
    const target = h.targetCount || 1;
    const rawVal = log[today]?.[h.id];
    const cur = typeof rawVal === 'boolean' ? (rawVal ? 1 : 0) : (rawVal || 0);
    const pct100 = Math.min(cur / target, 1);
    const isOver = cur > target;
    const isScheduledToday = (h.days || [0,1,2,3,4]).includes(todayDow);
    const streak = getHabitStreak(h.id);
    const pct = getHabitPct(h.id);
    const weekDone = getHabitWeekDays(h.id, target);
    const shortName = h.name.split(' ').slice(0,4).join(' ');
    const dayDots = makeHabitDayDots(h, weekDone, todayDow);
    const pctColor = pct > 0 ? '#16a34a' : 'rgba(30,16,64,0.3)';
    const streakHtml = streak >= 2 ? '<span style="font-size:12px;font-weight:700;color:#f59e0b">🔥' + streak + '</span>' : '';

    // Галочка — градієнт як у Продуктивності
    let checkBg, checkStroke;
    if (cur === 0) {
      checkBg = 'background:rgba(30,16,64,0.03);border:2px solid rgba(30,16,64,0.15)';
      checkStroke = 'rgba(30,16,64,0.25)';
    } else if (isOver) {
      checkBg = 'background:linear-gradient(135deg,#fbbf24,#f59e0b);border:none';
      checkStroke = 'white';
    } else if (pct100 >= 1) {
      checkBg = 'background:#16a34a;border:none';
      checkStroke = 'white';
    } else {
      const fillH = Math.round(pct100 * 36);
      checkBg = `background:linear-gradient(to top,#16a34a ${fillH}px,rgba(30,16,64,0.05) ${fillH}px);border:2px solid rgba(22,163,74,0.4)`;
      checkStroke = pct100 > 0.5 ? 'white' : 'rgba(30,16,64,0.4)';
    }

    // Квадратики (тільки якщо target > 1)
    let squaresHtml = '';
    if (target > 1) {
      const showCount = Math.min(Math.max(target, cur), 20);
      squaresHtml = '<div style="display:flex;gap:3px;flex-wrap:wrap;padding-left:46px;margin-top:5px">';
      for (let i = 0; i < showCount; i++) {
        const filled = i < cur;
        const isBonus = i >= target;
        const bg = filled ? (isBonus ? '#fbbf24' : '#16a34a') : 'rgba(30,16,64,0.08)';
        const border = filled ? 'none' : '1.5px solid rgba(30,16,64,0.12)';
        squaresHtml += `<div onclick="event.stopPropagation();tapHabitSquareMe(${h.id},${i})" style="width:13px;height:13px;border-radius:3px;background:${bg};border:${border};cursor:pointer;transition:all 0.15s;display:flex;align-items:center;justify-content:center">`;
        if (filled) squaresHtml += `<svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3.5"><polyline points="20 6 9 17 4 12"/></svg>`;
        squaresHtml += '</div>';
      }
      if (cur < 20) squaresHtml += `<div onclick="event.stopPropagation();toggleHabitToday(${h.id})" style="width:13px;height:13px;border-radius:3px;background:rgba(30,16,64,0.04);border:1.5px dashed rgba(30,16,64,0.15);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:9px;color:rgba(30,16,64,0.3)">+</div>`;
      squaresHtml += '</div>';
    }

    const countLabel = target > 1 ? `<span style="font-size:11px;font-weight:700;color:${cur>=target?'#16a34a':'rgba(30,16,64,0.4)'};margin-left:4px">${cur}/${target}</span>` : '';

    return '<div class="habit-me-item-wrap" data-id="' + h.id + '" style="position:relative;overflow:hidden;border-radius:14px;margin-bottom:6px">'
      + '<div id="habit-me-item-' + h.id + '" class="inbox-item" style="padding:10px 12px;cursor:pointer;width:100%;box-sizing:border-box;-webkit-tap-highlight-color:transparent" onclick="openEditHabit(' + h.id + ')">'
        + '<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">'
          + '<div onclick="event.stopPropagation();toggleHabitToday(' + h.id + ')" data-habit-check="1" style="width:36px;height:36px;border-radius:50%;flex-shrink:0;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.25s;-webkit-tap-highlight-color:transparent;' + checkBg + '">'
            + `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${checkStroke}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`
          + '</div>'
          + '<div style="flex:1;min-width:0">'
            + '<div style="display:flex;align-items:center;gap:6px">'
              + '<span style="font-size:15px;font-weight:700;color:#1e1040">' + escapeHtml(shortName) + '</span>'
              + countLabel + streakHtml
            + '</div>'
            + '<div style="font-size:11px;font-weight:600;color:' + pctColor + ';margin-top:1px">' + pct + '% за 30 днів</div>'
          + '</div>'
        + '</div>'
        + squaresHtml
        + '<div style="display:flex;gap:4px;padding-left:46px">' + dayDots + '</div>'
      + '</div>'
    + '</div>';
  }).join('');
  _attachHabitsSwipeDelete();
}



// === PRODUCTIVITY INNER TABS ===
export let currentProdTab = 'tasks';

export function updateProdTabCounters() {
  // Лічильник задач
  const taskCount = getTasks().filter(t => t.status !== 'done').length;
  const taskCountEl = document.getElementById('prod-tab-tasks-count');
  const taskSubEl = document.getElementById('prod-tab-tasks-sub');
  if (taskCountEl) taskCountEl.textContent = taskCount;
  if (taskSubEl) taskSubEl.textContent = taskCount === 1 ? 'активна' : 'активних';

  // Лічильник звичок — тільки build звички в основному лічильнику
  const habits = getHabits();
  const buildHabitsAll = habits.filter(h => h.type !== 'quit');
  const quitHabitsAll = habits.filter(h => h.type === 'quit');
  const log = getHabitLog();
  const today = new Date().toDateString();
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayDow = (new Date().getDay() + 6) % 7;
  const todayHabits = buildHabitsAll.filter(h => (h.days || [0,1,2,3,4]).includes(todayDow));
  const doneToday = todayHabits.filter(h => _habitDone(h, log[today])).length;
  // Quit звички — скільки тримається сьогодні
  const quitHeldToday = quitHabitsAll.filter(h => getQuitStatus(h.id).lastHeld === todayStr).length;
  const habitCountEl = document.getElementById('prod-tab-habits-count');
  const habitSubEl = document.getElementById('prod-tab-habits-sub');
  const totalHabits = buildHabitsAll.length + quitHabitsAll.length;
  if (habitCountEl) habitCountEl.textContent = totalHabits;
  if (habitSubEl) {
    if (todayHabits.length > 0 || quitHabitsAll.length > 0) {
      const total = todayHabits.length + quitHabitsAll.length;
      const done = doneToday + quitHeldToday;
      habitSubEl.textContent = `${done} з ${total} сьогодні`;
    } else {
      habitSubEl.textContent = 'звичок';
    }
  }
}

function switchProdTab(tab) {
  currentProdTab = tab;
  const isHabits = tab === 'habits';

  // Стилі карток перемикача
  const tabTasks = document.getElementById('prod-tab-tasks');
  const tabHabits = document.getElementById('prod-tab-habits');
  const tasksCount = document.getElementById('prod-tab-tasks-count');
  const tasksTitle = tabTasks ? tabTasks.querySelector('div > div:first-child') : null;
  const habitsCount = document.getElementById('prod-tab-habits-count');
  const habitsTitle = tabHabits ? tabHabits.querySelector('div > div:first-child') : null;

  // R5Ejr 24.04: активна — біла без тіні з яскравою обводкою; неактивні — напівпрозорі з м'якою тінню (як категорії Фінансів)
  if (tabTasks) {
    tabTasks.style.background = !isHabits ? 'white' : 'rgba(255,255,255,0.6)';
    tabTasks.style.borderColor = !isHabits ? 'rgba(234,88,12,0.6)' : 'rgba(234,88,12,0.1)';
    tabTasks.style.boxShadow = !isHabits ? 'none' : '0 2px 12px rgba(30,16,64,0.06)';
  }
  if (tasksCount) tasksCount.style.color = !isHabits ? '#ea580c' : 'rgba(30,16,64,0.35)';
  if (tasksTitle) tasksTitle.style.color = !isHabits ? '#ea580c' : 'rgba(30,16,64,0.35)';

  if (tabHabits) {
    tabHabits.style.background = isHabits ? 'white' : 'rgba(255,255,255,0.6)';
    tabHabits.style.borderColor = isHabits ? 'rgba(22,163,74,0.6)' : 'rgba(22,163,74,0.1)';
    tabHabits.style.boxShadow = isHabits ? 'none' : '0 2px 12px rgba(30,16,64,0.06)';
  }
  if (habitsCount) habitsCount.style.color = isHabits ? '#16a34a' : 'rgba(30,16,64,0.35)';
  if (habitsTitle) habitsTitle.style.color = isHabits ? '#16a34a' : 'rgba(30,16,64,0.35)';

  document.getElementById('prod-page-tasks').style.display = isHabits ? 'none' : 'block';
  document.getElementById('prod-page-habits').style.display = isHabits ? 'block' : 'none';

  // Update + button action
  const addBtn = document.getElementById('prod-add-btn');
  if (addBtn) addBtn.onclick = isHabits ? openAddHabit : openAddTask;

  updateProdTabCounters();
  if (isHabits) renderProdHabits();
}

function toggleProdHabitToday(id) {
  const today = new Date().toDateString();
  const log = getHabitLog();
  if (!log[today]) log[today] = {};
  const habits = getHabits();
  const h = habits.find(x => x.id === id);
  const target = h?.targetCount || 1;
  const rawVal = log[today][id];
  const cur = typeof rawVal === 'boolean' ? (rawVal ? 1 : 0) : (rawVal || 0);
  // Тристаний цикл для звичайних звичок (target=1): 0→1→2→0.
  const newVal = (target === 1)
    ? (cur === 0 ? 1 : cur === 1 ? 2 : 0)
    : cur + 1;
  log[today][id] = newVal;
  saveHabitLog(log);
  if (newVal === target) _habitConfetti(id);
  renderProdHabits();
}

function tapHabitSquare(id, idx) {
  // Тап на квадратик — якщо це останній заповнений, знімаємо одне виконання
  const today = new Date().toDateString();
  const log = getHabitLog();
  if (!log[today]) log[today] = {};
  const rawVal = log[today][id];
  const cur = typeof rawVal === 'boolean' ? (rawVal ? 1 : 0) : (rawVal || 0);
  if (cur > 0 && idx === cur - 1) {
    log[today][id] = cur - 1;
    saveHabitLog(log);
    renderProdHabits();
  } else if (idx >= cur) {
    toggleProdHabitToday(id);
  }
}

function tapHabitSquareMe(id, idx) {
  const today = new Date().toDateString();
  const log = getHabitLog();
  if (!log[today]) log[today] = {};
  const rawVal = log[today][id];
  const cur = typeof rawVal === 'boolean' ? (rawVal ? 1 : 0) : (rawVal || 0);
  if (cur > 0 && idx === cur - 1) {
    log[today][id] = cur - 1;
    saveHabitLog(log);
    renderHabits();
  } else if (idx >= cur) {
    toggleHabitToday(id);
  }
}

function _habitConfetti(habitId) {
  const btn = document.querySelector(`#prod-habit-item-${habitId} [data-habit-check]`);
  if (!btn) return;
  const rect = btn.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const colors = ['#16a34a','#4ade80','#fbbf24','#f97316','#60a5fa','#a78bfa'];
  for (let i = 0; i < 20; i++) {
    const el = document.createElement('div');
    const angle = (Math.random() * 360) * Math.PI / 180;
    const dist = 40 + Math.random() * 70;
    el.style.cssText = `position:fixed;left:${cx}px;top:${cy}px;width:7px;height:7px;border-radius:${Math.random()>0.5?'50%':'2px'};background:${colors[Math.floor(Math.random()*colors.length)]};pointer-events:none;z-index:9999;transition:transform 0.6s ease-out,opacity 0.6s ease-out`;
    document.body.appendChild(el);
    requestAnimationFrame(() => {
      el.style.transform = `translate(${Math.cos(angle)*dist}px,${Math.sin(angle)*dist-20}px) rotate(${Math.random()*360}deg)`;
      el.style.opacity = '0';
    });
    setTimeout(() => el.remove(), 660);
  }
}

export function renderProdHabits() {
  updateProdTabCounters();
  const habits = getHabits();
  const el = document.getElementById('prod-habits-list');
  if (!el) return;
  const log = getHabitLog();
  const today = new Date().toDateString();
  const todayDow = (new Date().getDay() + 6) % 7;

  const todayHabits = habits.filter(h => (h.days || [0,1,2,3,4]).includes(todayDow));
  const doneTodayCount = todayHabits.filter(h => {
    const target = h.targetCount || 1;
    const rawVal = log[today]?.[h.id];
    const cur = typeof rawVal === 'boolean' ? (rawVal ? 1 : 0) : (rawVal || 0);
    return cur >= target;
  }).length;
  const countEl = document.getElementById('habits-today-count');
  const barEl = document.getElementById('habits-today-bar');
  if (countEl) countEl.textContent = `${doneTodayCount} / ${todayHabits.length}`;
  if (barEl) barEl.style.width = todayHabits.length > 0 ? `${Math.round(doneTodayCount/todayHabits.length*100)}%` : '0%';

  if (habits.length === 0) {
    el.innerHTML = '<div style="text-align:center;padding:40px 20px;color:rgba(30,16,64,0.3);font-size:15px">Ще немає звичок<br>Натисни + щоб додати</div>';
    return;
  }

  const buildHabits = habits.filter(h => h.type !== 'quit');
  const quitHabits = habits.filter(h => h.type === 'quit');

  let html = '';

  // Звичайні звички
  html += buildHabits.map(h => {
    const target = h.targetCount || 1;
    const rawVal = log[today]?.[h.id];
    const cur = typeof rawVal === 'boolean' ? (rawVal ? 1 : 0) : (rawVal || 0);
    const pct100 = Math.min(cur / target, 1);
    const isOver = cur > target;
    const streak = getHabitStreak(h.id);
    const weekDone = getHabitWeekDays(h.id, target);
    const shortName2 = h.name.split(' ').slice(0,4).join(' ');
    const dayDots2 = makeHabitDayDots(h, weekDone, todayDow);
    const habitPct = getHabitPct(h.id);
    const pctColor2 = habitPct > 0 ? '#16a34a' : 'rgba(30,16,64,0.3)';
    const streakTxt = streak >= 2 ? '🔥 ' + streak + ' · ' : '';

    // Велика галочка — колір залежить від прогресу
    let checkBg, checkStroke;
    if (cur === 0) {
      checkBg = 'background:rgba(30,16,64,0.03);border:1.5px solid rgba(30,16,64,0.15)';
      checkStroke = 'rgba(30,16,64,0.25)';
    } else if (isOver) {
      checkBg = 'background:linear-gradient(135deg,#fbbf24,#f59e0b);border:none';
      checkStroke = 'white';
    } else if (pct100 >= 1) {
      checkBg = 'background:#16a34a;border:none';
      checkStroke = 'white';
    } else {
      const fillH = Math.round(pct100 * 40);
      checkBg = `background:linear-gradient(to top,#16a34a ${fillH}px,rgba(30,16,64,0.05) ${fillH}px);border:1.5px solid rgba(22,163,74,0.4)`;
      checkStroke = pct100 > 0.5 ? 'white' : 'rgba(30,16,64,0.4)';
    }

    // Квадратики (тільки якщо target > 1)
    let squaresHtml = '';
    if (target > 1) {
      const showCount = Math.min(Math.max(target, cur), 20);
      squaresHtml = '<div style="display:flex;gap:3px;flex-wrap:wrap;padding-left:52px;margin-top:6px">';
      for (let i = 0; i < showCount; i++) {
        const filled = i < cur;
        const isBonus = i >= target;
        const bg = filled ? (isBonus ? '#fbbf24' : '#16a34a') : 'rgba(30,16,64,0.08)';
        const border = filled ? 'none' : '1.5px solid rgba(30,16,64,0.12)';
        squaresHtml += `<div onclick="event.stopPropagation();tapHabitSquare(${h.id},${i})" style="width:14px;height:14px;border-radius:4px;background:${bg};border:${border};cursor:pointer;transition:all 0.15s;display:flex;align-items:center;justify-content:center">`;
        if (filled) squaresHtml += `<svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3.5"><polyline points="20 6 9 17 4 12"/></svg>`;
        squaresHtml += '</div>';
      }
      if (cur < 20) squaresHtml += `<div onclick="event.stopPropagation();toggleProdHabitToday(${h.id})" style="width:14px;height:14px;border-radius:4px;background:rgba(30,16,64,0.04);border:1.5px dashed rgba(30,16,64,0.15);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:10px;color:rgba(30,16,64,0.3);line-height:1">+</div>`;
      squaresHtml += '</div>';
    }

    const countLabel = target > 1 ? `<span style="font-size:11px;font-weight:700;color:${cur>=target?'#16a34a':'rgba(30,16,64,0.4)'};margin-left:4px">${cur}/${target}</span>` : '';

    return '<div class="prod-habit-item-wrap" id="prod-habit-wrap-' + h.id + '" data-id="' + h.id + '" style="position:relative;border-radius:16px;margin-bottom:var(--card-gap);overflow:hidden">'
      + '<div id="prod-habit-item-' + h.id + '" onclick="prodHabitCardClick(' + h.id + ', event)" style="background:rgba(255,255,255,0.6);border:1.5px solid rgba(255,255,255,0.85);border-radius:16px;padding:var(--card-pad-y) var(--card-pad-x);box-shadow:var(--card-shadow);position:relative;z-index:1;will-change:transform;cursor:pointer;-webkit-tap-highlight-color:transparent">'
      + '<div style="display:flex;align-items:center;gap:12px;margin-bottom:8px">'
        + '<div onclick="event.stopPropagation();toggleProdHabitToday(' + h.id + ')" data-habit-check="1" style="width:40px;height:40px;border-radius:12px;flex-shrink:0;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.25s;-webkit-tap-highlight-color:transparent;' + checkBg + '">'
          + `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${checkStroke}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`
        + '</div>'
        + '<div style="flex:1;min-width:0">'
          + '<div style="display:flex;align-items:center;flex-wrap:wrap;gap:4px;margin-bottom:1px">'
            + '<span style="font-size:16px;font-weight:700;color:#1e1040">' + escapeHtml(shortName2) + '</span>'
            + countLabel
          + '</div>'
          + '<div style="font-size:11px;font-weight:600;color:' + pctColor2 + '">' + streakTxt + habitPct + '% за 30 днів</div>'
        + '</div>'
      + '</div>'
      + squaresHtml
      + '<div style="display:flex;gap:4px;padding-left:52px;margin-top:6px">' + dayDots2 + '</div>'
      + '</div>'
    + '</div>';
  }).join('');

  // Челенджі "Кинути"
  if (quitHabits.length > 0) {
    html += '<div style="font-size:11px;font-weight:800;color:rgba(30,16,64,0.35);text-transform:uppercase;letter-spacing:0.08em;margin:14px 14px 8px">🚫 Челенджі</div>';
    html += quitHabits.map(h => _renderQuitHabitCard(h)).join('');
  }

  el.innerHTML = html;
  _attachHabitsSwipeDelete();
}

// Рівень стійкості на основі кількості зривів за 30 днів
function _quitResilienceLamp(relapses30) {
  if (relapses30 === 0) return { color: '#16a34a', glow: 'rgba(22,163,74,0.35)', label: 'Стійкий' };
  if (relapses30 <= 2)  return { color: '#ca8a04', glow: 'rgba(202,138,4,0.35)',  label: 'Тримається' };
  if (relapses30 <= 5)  return { color: '#ea580c', glow: 'rgba(234,88,12,0.35)',  label: 'Відновлюється' };
  return                       { color: '#dc2626', glow: 'rgba(220,38,38,0.4)',   label: 'Небезпека!' };
}

// Тренд зривів: порівнюємо останні 14 днів з попередніми 14
function _quitTrend(relapses) {
  const now = Date.now();
  const d14 = new Date(now - 14 * 86400000).toISOString().slice(0, 10);
  const d28 = new Date(now - 28 * 86400000).toISOString().slice(0, 10);
  const arr = relapses || [];
  const recent = arr.filter(d => d >= d14).length;
  const prev   = arr.filter(d => d >= d28 && d < d14).length;
  if (recent < prev)  return { arrow: '↓', color: '#16a34a', text: 'зривів менше' };
  if (recent > prev)  return { arrow: '↑', color: '#dc2626', text: 'зривів більше' };
  return                     { arrow: '→', color: 'rgba(30,16,64,0.4)', text: 'без змін' };
}

function _renderQuitHabitCard(h) {
  const s = getQuitStatus(h.id);
  const today = new Date().toISOString().slice(0, 10);
  const heldToday = s.lastHeld === today;
  const relapses30 = (s.relapses || []).filter(d => {
    const cutoff = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    return d >= cutoff;
  }).length;
  const streak    = s.streak || 0;
  const longest   = s.longestStreak || 0;
  const freedomDays = s.freedomDays || 0;
  const shortName = h.name.split(' ').slice(0,4).join(' ');

  const lamp  = _quitResilienceLamp(relapses30);
  const trend = _quitTrend(s.relapses);

  // Колір картки залежить від рівня стійкості
  const cardBg = relapses30 === 0 && streak > 0
    ? 'background:rgba(232,240,232,0.8);border-color:rgba(22,163,74,0.2)'
    : relapses30 >= 6
      ? 'background:rgba(255,235,235,0.85);border-color:rgba(220,38,38,0.2)'
      : 'background:rgba(255,248,240,0.85);border-color:rgba(234,88,12,0.15)';

  const streakColor = streak > 0 ? '#16a34a' : 'rgba(30,16,64,0.3)';

  // Лампа — кругла індикаторна точка з підсвіткою
  const lampHtml = '<div style="flex-shrink:0;width:14px;height:14px;border-radius:50%;background:' + lamp.color + ';box-shadow:0 0 8px 3px ' + lamp.glow + ';margin-top:3px"></div>';

  return '<div class="prod-habit-item-wrap" id="quit-wrap-' + h.id + '" data-id="' + h.id + '" style="position:relative;border-radius:16px;margin-bottom:var(--card-gap);overflow:hidden">'
    + '<div id="prod-habit-item-' + h.id + '" onclick="openEditHabit(' + h.id + ')" style="' + cardBg + ';border:1.5px solid;border-radius:16px;padding:var(--card-pad-y) var(--card-pad-x);position:relative;z-index:1;cursor:pointer;-webkit-tap-highlight-color:transparent">'

    // Рядок 1: лампа + назва + тренд
    + '<div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:8px">'
      + lampHtml
      + '<div style="flex:1;min-width:0">'
        + '<div style="font-size:15px;font-weight:700;color:#1e1040;line-height:1.2">' + escapeHtml(shortName) + '</div>'
        + '<div style="font-size:11px;color:' + lamp.color + ';font-weight:600;margin-top:1px">' + lamp.label + '</div>'
      + '</div>'
      + '<div style="text-align:right;flex-shrink:0">'
        + '<div style="font-size:16px;font-weight:700;color:' + trend.color + ';line-height:1">' + trend.arrow + '</div>'
        + '<div style="font-size:10px;color:rgba(30,16,64,0.4);font-weight:500">' + trend.text + '</div>'
      + '</div>'
    + '</div>'

    // Рядок 2: Вільні дні (головна метрика) + серія маленько
    + '<div style="display:flex;align-items:baseline;gap:10px;margin-bottom:8px">'
      + '<div>'
        + '<span style="font-size:26px;font-weight:800;color:#1e1040;line-height:1">' + freedomDays + '</span>'
        + '<span style="font-size:12px;font-weight:600;color:rgba(30,16,64,0.5);margin-left:4px">вільних ' + _dayWord(freedomDays) + '</span>'
      + '</div>'
      + (streak > 0
        ? '<div style="font-size:11px;font-weight:600;color:' + streakColor + ';margin-left:auto">'
          + '🔥 серія ' + streak + ' ' + _dayWord(streak)
          + (longest > streak ? ' · рекорд ' + longest : '')
          + '</div>'
        : (longest > 0
          ? '<div style="font-size:11px;font-weight:500;color:rgba(30,16,64,0.35);margin-left:auto">рекорд ' + longest + ' ' + _dayWord(longest) + '</div>'
          : ''))
    + '</div>'

    // Кнопки дій
    + '<div style="display:flex;gap:8px" onclick="event.stopPropagation()">'
      + '<button ontouchend="event.preventDefault();event.stopPropagation();holdQuitHabit(' + h.id + ')" onclick="holdQuitHabit(' + h.id + ')" style="flex:2;padding:10px;border-radius:12px;border:none;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;'
        + (heldToday ? 'background:rgba(22,163,74,0.15);color:#16a34a' : 'background:rgba(22,163,74,0.1);color:#16a34a')
        + '">' + (heldToday ? '✅ Тримаюсь сьогодні' : '✓ Тримаюсь') + '</button>'
      + '<button ontouchend="event.preventDefault();event.stopPropagation();confirmQuitRelapse(' + h.id + ')" onclick="confirmQuitRelapse(' + h.id + ')" style="flex:1;padding:10px;border-radius:12px;border:1.5px solid rgba(30,16,64,0.1);font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;background:rgba(30,16,64,0.03);color:rgba(30,16,64,0.35)">Зірвався</button>'
    + '</div>'
    + '</div>'
  + '</div>';
}

function confirmQuitRelapse(habitId) {
  const s = getQuitStatus(habitId);
  const fd = s.freedomDays || 0;
  const fdText = fd > 0 ? '\n' + fd + ' вільних ' + _dayWord(fd) + ' залишаться твоїми.' : '';
  if (window.confirm('Важкий день? Відмітити зрив?' + fdText)) {
    relapseQuitHabit(habitId);
  }
}


// === HABIT SWIPE TO DELETE — через спільну attachSwipeDelete ===
// Me-вкладка: .habit-me-item-wrap. Prod-вкладка: .prod-habit-item-wrap.
// Підключається post-render з renderHabits і renderProdHabits.
function _attachHabitsSwipeDelete() {
  const bind = (wrap, card) => {
    if (!card) return;
    const id = wrap.dataset.id;
    attachSwipeDelete(wrap, card, () => {
      const allHabits = getHabits();
      const habitOrigIdx = allHabits.findIndex(h => String(h.id) === id);
      const item = allHabits.find(h => String(h.id) === id);
      if (item) addToTrash('habit', item);
      saveHabits(allHabits.filter(h => String(h.id) !== id));
      renderHabits();
      renderProdHabits();
      if (item) showUndoToast('Звичку видалено', () => {
        const habits = getHabits();
        const idx = Math.min(habitOrigIdx, habits.length);
        habits.splice(idx, 0, item);
        saveHabits(habits);
        renderHabits();
        renderProdHabits();
      });
    });
  };
  document.querySelectorAll('.habit-me-item-wrap').forEach(w =>
    bind(w, w.querySelector('[id^="habit-me-item-"]')));
  document.querySelectorAll('.prod-habit-item-wrap').forEach(w =>
    bind(w, w.querySelector('[id^="prod-habit-item-"]')));
}

// Тап на prod-habit картку — якщо на чекбокс → toggleProdHabitToday, інакше → edit
function prodHabitCardClick(id, event) {
  if (event.target.closest('[data-habit-check]')) return; // чекбокс має власний handler
  openEditHabit(id);
}


// === UNIVERSAL ACTION PROCESSOR — один мозок для всіх барів ===
// Fuzzy пошук папки — знаходить найближчу по назві з урахуванням опечаток
function _fuzzyFindFolder(query, folders) {
  if (!query || !folders.length) return null;
  const q = query.toLowerCase().replace(/[ʼ']/g, '');
  // 1. Точний збіг
  const exact = folders.find(f => f.toLowerCase() === query.toLowerCase());
  if (exact) return exact;
  // 2. Містить рядок
  const contains = folders.find(f => f.toLowerCase().includes(q) || q.includes(f.toLowerCase()));
  if (contains) return contains;
  // 3. Відстань Левенштейна
  let best = null, bestDist = Infinity;
  folders.forEach(f => {
    const d = _levenshtein(q, f.toLowerCase().replace(/[ʼ']/g, ''));
    if (d < bestDist) { bestDist = d; best = f; }
  });
  // Приймаємо якщо відстань <= 3 або <= 40% довжини слова
  return (bestDist <= 3 || bestDist <= Math.floor(q.length * 0.4)) ? best : null;
}

function _levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({length: m+1}, (_, i) => Array.from({length: n+1}, (_, j) => i === 0 ? j : j === 0 ? i : 0));
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1] : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
  return dp[m][n];
}

// ============================================================
// Перенесено 20.04.2026 Gg3Fy ("Один мозок V2" Шар 1):
// - _toolCallToUniversalAction і dispatchChatToolCalls → src/ai/tool-dispatcher.js
// - processUniversalAction залишається тут (384 рядки, тісні локальні залежності)
// ============================================================
export function processUniversalAction(parsed, originalText, addMsg) {
  const action = parsed.action;

  // Розбита відповідь: проміжне повідомлення → пауза → результат
  const _splitReply = (thinking, doWork) => {
    addMsg('agent', thinking);
    setTimeout(() => doWork(), 1200 + Math.random() * 800);
  };

  if (action === 'create_task') {
    const title = (parsed.title || '').trim();
    if (!title) return false;
    // Fallback: якщо AI створив task але це схоже на подію — конвертуємо в event
    const eventDetected = _detectEventFromTask(title);
    if (eventDetected) {
      const ev = { id: Date.now(), title: eventDetected.title || title, date: eventDetected.date, time: null, priority: parsed.priority || 'normal', createdAt: Date.now() };
      const res = addEventDedup(ev);
      if (!res.added) { addMsg('agent', `Така подія "${ev.title}" вже є в календарі.`); return true; }
      const dateObj = new Date(eventDetected.date);
      const dayStr = `${dateObj.getDate()} ${['січня','лютого','березня','квітня','травня','червня','липня','серпня','вересня','жовтня','листопада','грудня'][dateObj.getMonth()]}`;
      const items = getInbox(); items.unshift({ id: Date.now(), text: title, category: 'event', ts: Date.now(), processed: true }); saveInbox(items);
      addMsg('agent', `📅 Подію "${ev.title}" додано на ${dayStr}`);
      return true;
    }
    const steps = Array.isArray(parsed.steps) ? parsed.steps.map(s => ({ id: Date.now() + Math.random(), text: s, done: false })) : [];
    const newTask = { id: generateUUID(), title, desc: parsed.desc || '', steps, status: 'active', createdAt: Date.now() };
    if (parsed.dueDate) newTask.dueDate = parsed.dueDate;
    if (parsed.priority && ['important','critical'].includes(parsed.priority)) newTask.priority = parsed.priority;
    const tasks = getTasks();
    tasks.unshift(newTask);
    saveTasks(tasks);
    if (currentTab === 'tasks') renderTasks();
    const items = getInbox(); items.unshift({ id: Date.now(), text: title, category: 'task', ts: Date.now(), processed: true }); saveInbox(items);
    addMsg('agent', '✅ Задачу "' + title + '" створено');
    if (parsed.ask_after) setTimeout(() => addMsg('agent', parsed.ask_after), 600);
    return true;
  }

  if (action === 'edit_habit') {
    const habits = getHabits();
    const h = habits.find(x => x.id === parsed.habit_id);
    if (!h) {
      // Fuzzy match по назві
      const nameQ = (parsed.name || parsed.habit_name || '').toLowerCase();
      const found = habits.find(x => x.name.toLowerCase().includes(nameQ.slice(0, 6)));
      if (!found) { addMsg('agent', 'Не знайшов цю звичку.'); return true; }
      if (parsed.name) found.name = parsed.name;
      if (parsed.days) found.days = parsed.days;
      if (parsed.details !== undefined) found.details = parsed.details;
      saveHabits(habits);
      renderProdHabits(); renderHabits();
      addMsg('agent', '✏️ Звичку "' + found.name + '" оновлено');
      return true;
    }
    if (parsed.name) h.name = parsed.name;
    if (parsed.days) h.days = parsed.days;
    if (parsed.details !== undefined) h.details = parsed.details;
    saveHabits(habits);
    renderProdHabits(); renderHabits();
    addMsg('agent', '✏️ Звичку "' + h.name + '" оновлено');
    return true;
  }

  if (action === 'edit_task') {
    const tasks = getTasks();
    const t = tasks.find(x => String(x.id) === String(parsed.task_id));
    if (!t) {
      const nameQ = (parsed.title || '').toLowerCase();
      const found = tasks.find(x => x.title.toLowerCase().includes(nameQ.slice(0, 8)));
      if (!found) { addMsg('agent', 'Не знайшов цю задачу.'); return true; }
      if (parsed.title) found.title = parsed.title;
      if (parsed.dueDate && parsed.dueDate !== found.dueDate) {
        if (found.dueDate) found.rescheduleCount = (found.rescheduleCount || 0) + 1;
        found.dueDate = parsed.dueDate;
        found.updatedAt = Date.now();
      }
      if (parsed.priority && ['normal','important','critical'].includes(parsed.priority)) found.priority = parsed.priority;
      saveTasks(tasks);
      if (currentTab === 'tasks') renderTasks();
      addMsg('agent', '✏️ Задачу "' + found.title + '" оновлено');
      return true;
    }
    if (parsed.title) t.title = parsed.title;
    if (parsed.dueDate && parsed.dueDate !== t.dueDate) {
      if (t.dueDate) t.rescheduleCount = (t.rescheduleCount || 0) + 1;
      t.dueDate = parsed.dueDate;
      t.updatedAt = Date.now();
    }
    if (parsed.priority && ['normal','important','critical'].includes(parsed.priority)) t.priority = parsed.priority;
    saveTasks(tasks);
    if (currentTab === 'tasks') renderTasks();
    addMsg('agent', '✏️ Задачу "' + t.title + '" оновлено');
    return true;
  }

  if (action === 'delete_task') {
    const tasks = getTasks();
    const t = tasks.find(x => String(x.id) === String(parsed.task_id));
    const nameQ = (parsed.title || parsed.query || '').toLowerCase();
    const target = t || tasks.find(x => x.title.toLowerCase().includes(nameQ.slice(0, 8)));
    if (!target) { addMsg('agent', 'Не знайшов цю задачу.'); return true; }
    addToTrash('task', target, null);
    const remaining = tasks.filter(x => x.id !== target.id);
    saveTasks(remaining);
    if (currentTab === 'tasks') renderTasks();
    addMsg('agent', '🗑️ Задачу "' + target.title + '" видалено');
    showUndoToast();
    return true;
  }

  if (action === 'delete_habit') {
    const habits = getHabits();
    const h = habits.find(x => x.id === parsed.habit_id);
    const nameQ = (parsed.name || parsed.query || '').toLowerCase();
    const target = h || habits.find(x => x.name.toLowerCase().includes(nameQ.slice(0, 6)));
    if (!target) { addMsg('agent', 'Не знайшов цю звичку.'); return true; }
    addToTrash('habit', target, null);
    const remaining = habits.filter(x => x.id !== target.id);
    saveHabits(remaining);
    renderProdHabits(); renderHabits();
    addMsg('agent', '🗑️ Звичку "' + target.name + '" видалено');
    showUndoToast();
    return true;
  }

  if (action === 'reopen_task') {
    const tasks = getTasks();
    const t = tasks.find(x => String(x.id) === String(parsed.task_id) && x.status === 'done');
    const nameQ = (parsed.title || parsed.query || '').toLowerCase();
    const target = t || tasks.find(x => x.status === 'done' && x.title.toLowerCase().includes(nameQ.slice(0, 8)));
    if (!target) { addMsg('agent', 'Не знайшов закриту задачу з такою назвою.'); return true; }
    target.status = 'active';
    delete target.completedAt;
    saveTasks(tasks);
    if (currentTab === 'tasks') renderTasks();
    addMsg('agent', '🔄 Задачу "' + target.title + '" перевідкрито');
    return true;
  }

  // B-106 fix (Aps79 27.04): complete_task/complete_habit/add_step тепер у processUniversalAction.
  // Раніше були тільки у fallback text-JSON шляху sendTasksBarMessage — коли AI кликав через
  // tool_calls, dispatchChatToolCalls йшов сюди і не знаходив обробник → жодного addMsg → точки
  // друку висіли назавжди.
  if (action === 'complete_task') {
    const tasks = getTasks();
    const t = tasks.find(x => String(x.id) === String(parsed.task_id));
    if (!t) { addMsg('agent', 'Не знайшов задачу з таким ID.'); return true; }
    if (t.status === 'done') { addMsg('agent', `Задача "${t.title}" вже закрита.`); return true; }
    addMsg('agent', `✅ Задачу "${t.title}" виконано!`);
    // Викликаємо ту саму 3-фазну анімацію що й при ручному тапі ✓:
    // галочка → 250мс пауза → сповзання картки → save+render через 620мс.
    if (currentTab === 'tasks') {
      toggleTaskStatus(t.id);
    } else {
      // Не на вкладці Задач — анімувати нема де, просто зберігаємо статус.
      t.status = 'done';
      t.completedAt = Date.now();
      t.updatedAt = Date.now();
      if (Array.isArray(t.steps)) t.steps.forEach(s => s.done = true);
      saveTasks(tasks);
    }
    return true;
  }

  if (action === 'complete_habit') {
    const habits = getHabits();
    let h = habits.find(x => String(x.id) === String(parsed.habit_id));
    if (!h && parsed.habit_name) {
      const q = parsed.habit_name.toLowerCase();
      h = habits.find(x => x.name.toLowerCase().includes(q.slice(0, 6)));
    }
    if (!h) { addMsg('agent', 'Не знайшов звичку.'); return true; }
    const todayStr = new Date().toDateString();
    const log = getHabitLog();
    if (!log[todayStr]) log[todayStr] = {};
    log[todayStr][h.id] = true;
    saveHabitLog(log);
    renderProdHabits();
    renderHabits();
    addMsg('agent', `✅ Відмітив звичку "${h.name}" як виконану сьогодні`);
    return true;
  }

  if (action === 'add_step') {
    const tasks = getTasks();
    const t = tasks.find(x => String(x.id) === String(parsed.task_id));
    if (!t) { addMsg('agent', 'Не знайшов задачу для додавання кроку.'); return true; }
    const stepText = (parsed.step || '').trim();
    if (!stepText) { addMsg('agent', 'Не вказано текст кроку.'); return true; }
    if (!Array.isArray(t.steps)) t.steps = [];
    t.steps.push({ id: Date.now(), text: stepText, done: false });
    t.updatedAt = Date.now();
    saveTasks(tasks);
    if (currentTab === 'tasks') renderTasks();
    addMsg('agent', `✅ Додав крок "${stepText}"`);
    return true;
  }

  if (action === 'add_moment') {
    const text = (parsed.text || '').trim();
    if (!text) return false;
    const mood = /добре|чудово|супер|відмінно|весело|щасли|круто|кайф/i.test(text) ? 'positive' :
                 /погано|жахливо|сумно|нудно|важко|втомив|зле|дістало/i.test(text) ? 'negative' : 'neutral';
    const moments = getMoments();
    moments.push({ id: Date.now(), text, mood, ts: Date.now() });
    saveMoments(moments);
    addMsg('agent', '✨ Момент записано');
    return true;
  }

  if (action === 'create_habit') {
    const name = (parsed.name || '').trim();
    if (!name) return false;
    const habits = getHabits();
    habits.push({ id: Date.now(), name, details: parsed.details || '', emoji: '⭕', days: parsed.days || [0,1,2,3,4,5,6], createdAt: Date.now() });
    saveHabits(habits);
    renderProdHabits(); renderHabits();
    addMsg('agent', '🌱 Звичку "' + name + '" створено');
    if (parsed.ask_after) setTimeout(() => addMsg('agent', parsed.ask_after), 600);
    return true;
  }

  if (action === 'create_note') {
    addNoteFromInbox(parsed.text, 'note', parsed.folder || null, 'agent');
    if (currentTab === 'notes') renderNotes();
    addMsg('agent', '✓ Нотатку збережено' + (parsed.folder ? ' в папку "' + parsed.folder + '"' : ''));
    if (parsed.ask_after) setTimeout(() => addMsg('agent', parsed.ask_after), 600);
    return true;
  }

  if (action === 'create_event') {
    const title = (parsed.title || '').trim();
    if (!title || !parsed.date) return false;
    let endTime = parsed.end_time || null;
    if (!parsed.time) endTime = null;
    if (endTime && parsed.time && endTime <= parsed.time) endTime = null;
    const ev = { id: Date.now(), title, date: parsed.date, time: parsed.time || null, endTime, priority: parsed.priority || 'normal', createdAt: Date.now() };
    const res = addEventDedup(ev);
    if (!res.added) { addMsg('agent', `Така подія "${title}" вже є в календарі.`); return true; }
    let extraSeries = '';
    if (parsed.repeat_weekly) {
      const created = generateWeeklySeries(res.event, 12);
      if (created.length > 0) extraSeries = ` + ще ${created.length} щотижня`;
    }
    const dateObj = new Date(parsed.date);
    const dayStr = `${dateObj.getDate()} ${['січня','лютого','березня','квітня','травня','червня','липня','серпня','вересня','жовтня','листопада','грудня'][dateObj.getMonth()]}`;
    const items = getInbox(); items.unshift({ id: Date.now(), text: title, category: 'event', ts: Date.now(), processed: true }); saveInbox(items);
    const timeStr = parsed.time ? ` о ${parsed.time}${endTime ? '–' + endTime : ''}` : '';
    addMsg('agent', `📅 Подію "${title}" додано на ${dayStr}${timeStr}${extraSeries}`);
    return true;
  }

  if (action === 'edit_event') {
    const events = getEvents();
    const idx = events.findIndex(e => e.id === parsed.event_id);
    if (idx === -1) { addMsg('agent', 'Не знайшов подію для редагування.'); return true; }
    if (parsed.date) events[idx].date = parsed.date;
    if (parsed.time !== undefined) events[idx].time = parsed.time || null;
    if (parsed.end_time !== undefined) {
      // Порожній рядок — юзер просить прибрати тривалість
      const newEnd = parsed.end_time || null;
      const startT = events[idx].time;
      events[idx].endTime = (newEnd && startT && newEnd > startT) ? newEnd : null;
    }
    // Якщо стартовий час прибрано — тривалість теж зникає
    if (parsed.time === null || parsed.time === '') events[idx].endTime = null;
    if (parsed.title) events[idx].title = parsed.title;
    if (parsed.priority) events[idx].priority = parsed.priority;
    saveEvents(events);
    const dateObj = new Date(events[idx].date);
    const dayStr = `${dateObj.getDate()} ${['січня','лютого','березня','квітня','травня','червня','липня','серпня','вересня','жовтня','листопада','грудня'][dateObj.getMonth()]}`;
    const t = events[idx].time;
    const et = events[idx].endTime;
    const timeStr = t ? ` о ${t}${et ? '–' + et : ''}` : '';
    const editText = `✏️ Змінено: "${events[idx].title}" → ${dayStr}${timeStr}`;
    addMsg('agent', editText);
    // Карточка в Inbox стрічку щоб юзер бачив що було змінено
    try {
      const inbox = getInbox();
      inbox.unshift({ id: Date.now(), text: editText, type: 'edit', category: 'event', ts: Date.now() });
      saveInbox(inbox);
      if (typeof renderInbox === 'function') renderInbox();
    } catch(e) {}
    return true;
  }

  if (action === 'delete_event') {
    const events = getEvents();
    const idx = events.findIndex(e => e.id === parsed.event_id);
    if (idx === -1) { addMsg('agent', 'Не знайшов подію.'); return true; }
    const title = events[idx].title;
    addToTrash('event', events[idx]);
    events.splice(idx, 1);
    saveEvents(events);
    addMsg('agent', `🗑 Подію "${title}" видалено`);
    showUndoToast('event', title);
    return true;
  }

  if (action === 'edit_note') {
    const notes = getNotes();
    const idx = notes.findIndex(n => n.id === parsed.note_id);
    if (idx === -1) { addMsg('agent', 'Не знайшов нотатку.'); return true; }
    if (parsed.text) notes[idx].text = parsed.text;
    if (parsed.folder) notes[idx].folder = parsed.folder;
    notes[idx].updatedAt = Date.now();
    saveNotes(notes);
    addMsg('agent', `✓ Нотатку оновлено${parsed.folder ? ' → папка "' + parsed.folder + '"' : ''}`);
    return true;
  }

  if (action === 'create_folder') {
    const folderName = (parsed.folder || '').trim();
    if (!folderName) return false;
    // Папка "існує" якщо є хоч одна нотатка з такою назвою
    const notes = getNotes();
    const exists = notes.some(n => (n.folder || 'Загальне') === folderName);
    if (exists) {
      addMsg('agent', `Папка "${folderName}" вже є.`);
    } else {
      // Створюємо папку через додавання порожньої нотатки-заглушки яку одразу прибираємо
      // Правильний спосіб — просто кажемо юзеру що папка з'явиться при першій нотатці
      addMsg('agent', `Папка "${folderName}" створена. Напиши нотатку і я покладу її туди.`);
    }
    return true;
  }

  if (action === 'delete_folder') {
    const targetName = (parsed.folder || '').trim();
    if (!targetName) return false;
    const notes = getNotes();
    const folders = [...new Set(notes.map(n => n.folder || 'Загальне'))];
    // Fuzzy match — знаходимо найближчу папку
    const matched = _fuzzyFindFolder(targetName, folders);
    if (!matched) {
      addMsg('agent', `Папку "${targetName}" не знайшов. Доступні: ${folders.join(', ')}`);
      return true;
    }
    const toDelete = notes.filter(n => (n.folder || 'Загальне') === matched);
    toDelete.forEach(n => addToTrash('folder', n, null));
    const remaining = notes.filter(n => (n.folder || 'Загальне') !== matched);
    saveNotes(remaining);
    if (currentTab === 'notes') { setCurrentNotesFolder(null); renderNotes(); }
    addMsg('agent', `✓ Папку "${matched}" видалено (${toDelete.length} нотаток)`);
    return true;
  }

  if (action === 'move_note') {
    const noteQuery = (parsed.query || parsed.text || '').toLowerCase().trim();
    const targetFolder = (parsed.folder || '').trim();
    if (!noteQuery || !targetFolder) return false;
    const notes = getNotes();
    const folders = [...new Set(notes.map(n => n.folder || 'Загальне'))];
    const resolvedFolder = _fuzzyFindFolder(targetFolder, folders) || targetFolder;
    // Знаходимо нотатку по тексту
    const idx = notes.findIndex(n => n.text.toLowerCase().includes(noteQuery));
    if (idx === -1) {
      addMsg('agent', `Нотатку "${noteQuery}" не знайшов.`);
      return true;
    }
    const oldFolder = notes[idx].folder || 'Загальне';
    // Видаляємо зі старої папки
    const oldIdx = notes.findIndex(n => n.id === notes[idx].id && (n.folder || 'Загальне') === oldFolder && n !== notes[idx]);
    notes[idx] = { ...notes[idx], folder: resolvedFolder, updatedAt: Date.now() };
    saveNotes(notes);
    if (currentTab === 'notes') renderNotes();
    addMsg('agent', `✓ Нотатку переміщено з "${oldFolder}" до "${resolvedFolder}"`);
    return true;
  }

  if (action === 'save_finance' || action === 'save_expense' || action === 'save_income') {
    const type = action === 'save_income' ? 'income' : (parsed.fin_type || 'expense');
    const amount = parseFloat(parsed.amount) || 0;
    if (!amount || amount <= 0) { addMsg('agent', 'Не вдалось розпізнати суму.'); return true; }
    const category = parsed.category || 'Інше';
    const comment = parsed.comment || originalText;
    // B-70 fix: catList — масив об'єктів, не рядків. Раніше .includes('Їжа') завжди false
    // і .push('Їжа') додавав рядок у масив об'єктів → биті категорії без id → _finCatsGrid падав.
    const cats = getFinCats();
    const catList = type === 'expense' ? cats.expense : cats.income;
    if (!catList.some(c => c.name === category)) {
      createFinCategory(type, { name: category });
    }
    const txs = getFinance();
    const finTs = _resolveFinanceDate(parsed.date, originalText);
    const txId = Date.now();
    txs.unshift({ id: txId, type, amount, category, comment, ts: finTs });
    saveFinance(txs);
    // B-71 fix: створюємо картку у Inbox стрічці — будь-яка операція видима скрізь,
    // незалежно від точки введення (чат Фінансів, Task chat, Me chat тощо).
    try {
      const items = getInbox();
      const inboxText = (type === 'expense' ? '-' : '+') + formatMoney(amount) + ' · ' + category + (comment && comment !== originalText ? ' — ' + comment : '');
      items.unshift({ id: txId, text: inboxText, category: 'finance', ts: finTs, processed: true });
      saveInbox(items);
      if (currentTab === 'inbox') renderInbox();
    } catch(e) {}
    if (currentTab === 'finance') renderFinance();
    addMsg('agent', '✓ ' + (type === 'expense' ? '-' : '+') + formatMoney(amount) + ' · категорія: ' + category + (parsed.comment ? ' · ' + parsed.comment : ''));
    return true;
  }

  if (action === 'save_routine') {
    const blocks = (parsed.blocks || []).map(b => ({ time: b.time, activity: b.activity }));
    const days = Array.isArray(parsed.day) ? parsed.day : [parsed.day || 'default'];
    if (days.length > 1) {
      _splitReply(`Копіюю розпорядок на ${days.length} днів...`, () => {
        const routine = getRoutine();
        days.forEach(d => { routine[d] = [...blocks]; });
        saveRoutine(routine);
        addMsg('agent', `🕐 Готово! Розпорядок на ${days.length} дн. (${blocks.length} блоків)`);
      });
    } else {
      const routine = getRoutine();
      days.forEach(d => { routine[d] = [...blocks]; });
      saveRoutine(routine);
      addMsg('agent', `🕐 Розпорядок збережено (${blocks.length} блоків)`);
    }
    return true;
  }

  if (action === 'set_reminder') {
    const time = parsed.time;
    const text = parsed.text || 'Нагадування';
    const date = parsed.date || new Date().toISOString().slice(0, 10);
    if (!time) { addMsg('agent', 'Вкажи час нагадування.'); return true; }
    const reminderId = Date.now();
    // 1. nm_reminders — для тригера спливаючого попередження
    const reminders = JSON.parse(localStorage.getItem('nm_reminders') || '[]');
    reminders.push({ id: reminderId, time, text, date, done: false });
    localStorage.setItem('nm_reminders', JSON.stringify(reminders));
    // 2. nm_events — щоб було видно у календарі і модалці "Розпорядок дня"
    addEventDedup({
      id: reminderId + 1,
      title: text,
      date,
      time,
      priority: 'normal',
      createdAt: Date.now(),
      source: 'reminder',
      reminderId
    });
    // 3. nm_inbox — картка у стрічку з категорією "Нагадування" (⏰)
    const items = getInbox();
    items.unshift({
      id: reminderId + 2,
      text: `${time} — ${text}`,
      category: 'reminder',
      ts: Date.now(),
      processed: true
    });
    saveInbox(items);
    try { renderInbox(); } catch(e) {}
    window.dispatchEvent(new CustomEvent('nm-data-changed', { detail: 'reminder' }));
    addMsg('agent', `⏰ Нагадаю о ${time}: "${text}"`);
    return true;
  }

  return false;
}


export async function sendTasksBarMessage() {
  if (taskBarLoading) return;
  const input = document.getElementById('tasks-chat-input');
  const text = input.value.trim();
  if (!text) return;
  const key = localStorage.getItem('nm_gemini_key');
  if (!key) { addTaskBarMsg('agent', 'Введи OpenAI ключ в налаштуваннях.'); return; }

  input.value = '';
  input.style.height = 'auto';
  addTaskBarMsg('user', text);
  setTaskBarLoading(true);
  addTaskBarMsg('typing', '');

  const tasks = getTasks().filter(t => t.status !== 'done');
  const tasksSummary = tasks.map(t => {
    const steps = (t.steps || []).map(s => '  - ' + s.text + (s.done ? ' [✓]' : '')).join('\n');
    return 'Задача ID:' + t.id + ' "' + t.title + '"' + (steps ? '\nКроки:\n' + steps : '');
  }).join('\n\n');

  const habits = getHabits();
  const log = getHabitLog();
  const today = new Date().toDateString();
  const habitsSummary = habits.map(h => {
    const done = !!log[today]?.[h.id];
    return h.name + (done ? ' [виконано сьогодні]' : ' [не виконано сьогодні]');
  }).join(', ');

  const aiContext = getAIContext();
  const systemPrompt = getOWLPersonality() + '\n\n'
    + 'ЗАДАЧІ:\n' + (tasksSummary || 'Немає активних задач') + '\n\n'
    + (habitsSummary ? 'ЗВИЧКИ СЬОГОДНІ:\n' + habitsSummary + '\n\n' : '')
    + 'Ти можеш:\n'
    + '1. Для CRUD дій (створити/видалити/редагувати/закрити задачу-звичку-подію-нотатку-момент-витрату) — викликай відповідний tool.\n'
    + '2. Специфічні fallback-JSON (НЕ як tool): {"action":"complete_step","task_id":ID,"step_text":"текст"} (закрити конкретний крок задачі), {"action":"undo_step","task_id":ID,"step_text":"текст"} (скасувати крок), {"action":"complete_habit","habit_name":"назва"} (позначити звичку за назвою коли ID невідомий).\n'
    + 'ЗАДАЧА = дія яку ТИ маєш ЗРОБИТИ (купити, подзвонити, зробити) → save_task. ПОДІЯ = факт що СТАНЕТЬСЯ (приїзд, зустріч, свято, рейс) → create_event. "приїзд мами 20го" = create_event. "купити молоко" = save_task.\n'
    + 'МИНУЛИЙ ЧАС (B-105 fix Aps79): "поміняв", "подав", "зробив", "написав", "сходив", "купив" — це факт що ВЖЕ стався. ОБРОБКА: (а) якщо у списку АКТИВНИХ задач є явно відповідна задача з тією ж дією — complete_task на ту задачу; (б) якщо явної відповідності немає — ТЕКСТ-ВІДПОВІДЬ "✓ Записав. Якщо це закриває задачу — скажи яку." або save_moment, але НІКОЛИ delete_task. Не вигадуй фузі-зв\'язок ("поміняв номер" ≠ "Зареєструватися на Upwirk"). НІКОЛИ не видаляй задачу без явного слова "видали/забудь/прибери" від юзера.\n'
    + 'Для редагування існуючої звички (зміна днів/назви) — edit_habit, НЕ save_habit нову.\n'
    + 'Інакше — текст 1-3 речення українською. НЕ вигадуй даних яких немає.\n\n'
    + GLOBAL_TOOLS_RULE + '\n\n'
    + REMINDER_RULES + '\n\n'
    + UI_TOOLS_RULES
    + (aiContext ? '\n\n' + aiContext : '');

  try {
    // "Один мозок #2 A": INBOX_TOOLS — повний набір CRUD + UI.
    const history = [...taskBarHistory.slice(-8), { role: 'user', content: text }];
    const msg = await callAIWithTools(systemPrompt, history, INBOX_TOOLS, 'tasks-bar');

    // Tool dispatch — UI tool або CRUD через universal action
    if (msg && Array.isArray(msg.tool_calls) && msg.tool_calls.length > 0) {
      const handled = dispatchChatToolCalls(msg.tool_calls, addTaskBarMsg, text);
      // B-106 safety net: якщо жоден з tool-обробників не запалив addMsg —
      // точки друку залишились би назавжди. Покажемо текст-fallback або помилку.
      if (!handled) {
        const fallback = msg.content && msg.content.trim();
        if (fallback) addTaskBarMsg('agent', fallback);
        else addTaskBarMsg('agent', 'Не зрозуміла дію. Переформулюй коротше — напр. "закрий [назву задачі]".');
      }
      setTaskBarLoading(false);
      return;
    }

    const reply = msg && msg.content ? msg.content.trim() : '';
    if (!reply) { handleChatError(addTaskBarMsg); setTaskBarLoading(false); return; }

    // Fallback text-JSON — специфічні actions не в INBOX_TOOLS (complete_step, undo_step, complete_habit by name)
    const _processOne = (parsed) => {
      if (processUniversalAction(parsed, text, addTaskBarMsg)) return true;
      if (parsed.action === 'complete_step') {
        const allTasks = getTasks();
        const t = allTasks.find(x => String(x.id) === String(parsed.task_id));
        if (t) {
          const step = t.steps.find(s => s.text.toLowerCase().includes(parsed.step_text.toLowerCase().substring(0,10)));
          if (step) {
            step.done = true;
            if (t.steps.every(s => s.done)) {
              t.status = 'done';
              t.completedAt = Date.now();
              t.updatedAt = Date.now();
            }
            saveTasks(allTasks); renderTasks();
            addTaskBarMsg('agent', `✅ Відмітив "${step.text}" як виконано`);
          } else { addTaskBarMsg('agent', 'Не знайшов такий крок. Уточни будь ласка.'); }
        }
        return true;
      }
      if (parsed.action === 'complete_task') {
        const allTasks = getTasks();
        const t = allTasks.find(x => String(x.id) === String(parsed.task_id));
        if (t) { t.status = 'done'; t.completedAt = Date.now(); t.updatedAt = Date.now(); t.steps.forEach(s => s.done = true); saveTasks(allTasks); renderTasks(); addTaskBarMsg('agent', `✅ Задачу "${t.title}" виконано!`); }
        return true;
      }
      if (parsed.action === 'add_step') {
        const allTasks = getTasks();
        const t = allTasks.find(x => String(x.id) === String(parsed.task_id));
        if (t) { t.steps.push({ id: Date.now(), text: parsed.step, done: false }); saveTasks(allTasks); renderTasks(); addTaskBarMsg('agent', '✅ Додав крок "' + parsed.step + '"'); }
        return true;
      }
      if (parsed.action === 'complete_habit') {
        const habits = getHabits();
        const h = habits.find(x => x.name.toLowerCase().includes((parsed.habit_name || '').toLowerCase().substring(0,6)));
        if (h) {
          const todayStr = new Date().toDateString();
          const log = getHabitLog();
          if (!log[todayStr]) log[todayStr] = {};
          log[todayStr][h.id] = true;
          saveHabitLog(log);
          renderProdHabits();
          renderHabits();
          addTaskBarMsg('agent', '✅ Відмітив звичку "' + h.name + '" як виконану сьогодні');
          return true;
        }
        return false;
      }
      if (parsed.action === 'create_habit') {
        const habits = getHabits();
        const name = (parsed.name || '').trim();
        if (name) {
          const days = parsed.days || [0,1,2,3,4,5,6];
          habits.push({ id: Date.now(), name, details: parsed.details || '', emoji: '⭕', days, createdAt: Date.now() });
          saveHabits(habits);
          renderProdHabits(); renderHabits();
          addTaskBarMsg('agent', '🌱 Звичку "' + name + '" створено!');
        }
        return true;
      }
      if (parsed.action === 'create_task') {
        const tasks = getTasks();
        const title = (parsed.title || '').trim();
        if (title) {
          const steps = Array.isArray(parsed.steps) ? parsed.steps.map(s => ({ id: Date.now() + Math.random(), text: s, done: false })) : [];
          tasks.unshift({ id: generateUUID(), title, desc: parsed.desc || '', steps, status: 'active', createdAt: Date.now() });
          saveTasks(tasks); renderTasks();
          addTaskBarMsg('agent', '✅ Задачу "' + title + '" створено!');
        }
        return true;
      }
      if (parsed.action === 'undo_step') {
        const allTasks = getTasks();
        const t = allTasks.find(x => String(x.id) === String(parsed.task_id));
        if (t) {
          const step = t.steps.find(s => s.text.toLowerCase().includes((parsed.step_text || '').toLowerCase().substring(0,10)));
          if (step) {
            step.done = false;
            if (t.status === 'done') t.status = 'active';
            saveTasks(allTasks); renderTasks();
            addTaskBarMsg('agent', `↩️ Скасував виконання "${step.text}"`);
          } else { addTaskBarMsg('agent', 'Не знайшов такий крок. Уточни будь ласка.'); }
        }
        return true;
      }
      return false;
    };

    // Розбиваємо AI-відповідь на окремі JSON блоки (може бути кілька дій одразу).
    const blocks = extractJsonBlocks(reply);
    let handled = false;
    for (const parsed of blocks) {
      if (_processOne(parsed)) handled = true;
    }
    if (!handled) safeAgentReply(reply, addTaskBarMsg);
  } catch { addTaskBarMsg('agent', 'Мережева помилка.'); }
  setTaskBarLoading(false);
}


// === WINDOW EXPORTS (HTML handlers only) ===
Object.assign(window, {
  switchProdTab, saveHabit, closeHabitModal, setHabitModalType,
  deleteHabitFromModal, adjustHabitCount, sendTasksBarMessage,
  openEditHabit, toggleHabitToday, toggleProdHabitToday,
  tapHabitSquare, tapHabitSquareMe,
  prodHabitCardClick,
  holdQuitHabit, confirmQuitRelapse,
});
