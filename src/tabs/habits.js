// ============================================================
// app-habits.js — Звички, productivity tabs, universal action processor
// Залежності: app-core.js, app-ai.js, app-tasks-core.js
// ============================================================

import { currentTab, showToast } from '../core/nav.js';
import { getSettings } from '../core/settings.js';
import { escapeHtml, logRecentAction, extractJsonBlocks, parseContentChips, levenshtein, t, getReminders, saveReminders } from '../core/utils.js';
import { logUsage } from '../core/usage-meter.js';
import { generateUUID } from '../core/uuid.js';
import { makeHabit } from '../data/habit-classifier.js';
import { makeEvent, makeTask, makeList } from '../data/entity-factories.js';
import { getLists, saveLists } from './lists.js';
import { addToTrash, showUndoToast } from '../core/trash.js';
import { callAIWithTools, getAIContext, getOWLPersonality, safeAgentReply, INBOX_TOOLS, handleChatError, openaiFetch } from '../ai/core.js';
import { UI_TOOLS_RULES, BASE_CHAT_RULES } from '../ai/prompts.js';
import { dispatchChatToolCalls } from '../ai/tool-dispatcher.js';
import { shouldClarify } from '../owl/clarify-guard.js';
import { attachSwipeDelete } from '../ui/swipe-delete.js';
import { addInboxChatMsg, getInbox, saveInbox, renderInbox, _detectEventFromTask } from './inbox.js';
import { monthGenitive } from '../data/months.js';
import { getTasks, saveTasks, renderTasks, openAddTask, addTaskBarMsg, taskBarHistory, taskBarLoading, setTaskBarLoading, setupModalSwipeClose, toggleTaskStatus } from './tasks.js';
import { getNotes, saveNotes, renderNotes, addNoteFromInbox, currentNotesFolder, setCurrentNotesFolder, getDirectChildren } from './notes.js';
import { getFinance, saveFinance, renderFinance, formatMoney, getFinCats, saveFinCats, _resolveFinanceDate, createFinCategory, processFinanceAction } from './finance.js';
import { deleteHealthCardProgrammatic, deleteAllergy, deleteMedicationFromCard } from './health.js';
import { matchSubcategoryFromComment } from '../data/finance-subcat-keywords.js';
import { resolveDateFromText, parseUaTimeOfDay } from '../data/ua-time-parser.js';
import { getMoments, saveMoments } from './evening.js';
import { getEvents, saveEvents, addEventDedup, getRoutine, saveRoutine } from './calendar.js';

// === HABITS ===
let editingHabitId = null;

export function getHabits() { try { return JSON.parse(localStorage.getItem('nm_habits2') || '[]'); } catch { return []; } }
export function saveHabits(arr) { localStorage.setItem('nm_habits2', JSON.stringify(arr)); window.dispatchEvent(new CustomEvent('nm-data-changed', { detail: 'habits' })); }
export function getHabitLog() { try { return JSON.parse(localStorage.getItem('nm_habit_log2') || '{}'); } catch { return {}; } }
export function saveHabitLog(obj) { localStorage.setItem('nm_habit_log2', JSON.stringify(obj)); window.dispatchEvent(new CustomEvent('nm-data-changed', { detail: 'habits' })); }

// === QUIT HABITS — челендж "Кинути" ===
export function getQuitLog() { try { return JSON.parse(localStorage.getItem('nm_quit_log') || '{}'); } catch { return {}; } }
export function saveQuitLog(obj) { localStorage.setItem('nm_quit_log', JSON.stringify(obj)); window.dispatchEvent(new CustomEvent('nm-data-changed', { detail: 'habits' })); }

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
  showToast(t('habits.quit.toast.held', '💪 +1 вільний день! Всього: {fd} {dayWord}', { fd, dayWord: _dayWord(fd) }));
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
    showToast(t('habits.quit.toast.relapse_dup', 'Зрив вже відмічено сьогодні'));
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
  if (n % 10 === 1 && n % 100 !== 11) return t('habits.day.one', 'день');
  if ([2,3,4].includes(n % 10) && ![12,13,14].includes(n % 100)) return t('habits.day.few', 'дні');
  return t('habits.day.many', 'днів');
}

function _owlQuitRelapse(habitId, prevStreak, freedomDays) {
  const habits = getHabits();
  const h = habits.find(x => x.id === habitId);
  const name = h ? h.name : t('habits.quit.fallback_name', 'звичку');
  const fdText = freedomDays > 0 ? t('habits.quit.freedom_kept', ' Твої {fd} вільних {dayWord} — назавжди твої.', { fd: freedomDays, dayWord: _dayWord(freedomDays) }) : '';
  const key = localStorage.getItem('nm_gemini_key');
  if (!key) {
    addInboxChatMsg('agent', t('habits.quit.msg.hard_day_offline', 'Сьогодні важкий день з "{name}".{fdText} Завтра новий шанс.', { name, fdText }));
    return;
  }
  const settings = getSettings();
  const owlMode = settings.owl_mode || 'balanced';
  const tone = owlMode === 'brutal' ? 'різкий, чесний, без зайвого жалю' : owlMode === 'soft' ? 'м\'який, підтримуючий, співчутливий' : 'збалансований, чесний але підтримуючий';
  openaiFetch('chat/completions', {
      model: 'gpt-4o-mini',
      max_tokens: 80,
      messages: [{
        role: 'system',
        content: `Ти OWL — персональний агент. Тон: ${tone}. Відповідай ТІЛЬКИ одним реченням українською. Не згадуй "стрік обнулено". Підкресли що ${freedomDays} вільних днів нікуди не ділись.`
      }, {
        role: 'user',
        content: `Користувач зірвався з "${name}". Серія була ${prevStreak} ${_dayWord(prevStreak)}, але загалом ${freedomDays} вільних ${_dayWord(freedomDays)} — вони залишаються. Скажи щось коротке та підтримуюче.`
      }]
    }).then(r => r.json()).then(d => {
    if (d?.usage) logUsage('habits-ai', d.usage, d.model);
    const reply = d.choices?.[0]?.message?.content;
    if (reply) addInboxChatMsg('agent', reply);
  }).catch(() => {
    addInboxChatMsg('agent', t('habits.quit.msg.hard_day_fallback', 'Сьогодні важкий день з "{name}".{fdText} Завтра — новий шанс.', { name, fdText }));
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
  document.getElementById('habit-modal-title').textContent = t('habits.modal.title_edit', 'Редагувати звичку');
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
  document.getElementById('habit-modal-title').textContent = t('habits.modal.title_new', 'Нова звичка');
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
  if (!name) { showToast(t('habits.modal.err.empty_name', 'Введи назву звички')); return; }
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
    habits.push(makeHabit({ name, details, emoji, days, targetCount, type }));
  }
  saveHabits(habits);
  closeHabitModal();
  renderHabits();
  renderProdHabits();
  showToast(editingHabitId ? t('habits.toast.updated', '✓ Звичку оновлено') : (type === 'quit' ? t('habits.toast.quit_created', '🚫 Челендж створено') : t('habits.toast.added', '✓ Звичку додано')));
}

function deleteHabit(id) {
  if (!confirm(t('habits.confirm.delete', 'Видалити звичку?'))) return;
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
  if (item) showUndoToast(t('habits.toast.deleted', 'Звичку видалено'), () => { const habits = getHabits(); habits.push(item); saveHabits(habits); renderHabits(); renderProdHabits(); });
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
  const labels = [t('day.mon','Пн'),t('day.tue','Вт'),t('day.wed','Ср'),t('day.thu','Чт'),t('day.fri','Пт'),t('day.sat','Сб'),t('day.sun','Нд')];
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
    el.innerHTML = '<div style="text-align:center;padding:20px 0;color:rgba(30,16,64,0.3);font-size:15px">' + t('habits.empty.me_list', 'Додай першу звичку') + '</div>';
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
        squaresHtml += `<div data-action="tap-habit-square" data-entity="habit" data-id="${h.id}" data-idx="${i}" style="width:13px;height:13px;border-radius:3px;background:${bg};border:${border};cursor:pointer;transition:all 0.15s;display:flex;align-items:center;justify-content:center">`;
        if (filled) squaresHtml += `<svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3.5"><polyline points="20 6 9 17 4 12"/></svg>`;
        squaresHtml += '</div>';
      }
      if (cur < 20) squaresHtml += `<div data-action="toggle-entity-done" data-entity="habit" data-id="${h.id}" style="width:13px;height:13px;border-radius:3px;background:rgba(30,16,64,0.04);border:1.5px dashed rgba(30,16,64,0.15);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:9px;color:rgba(30,16,64,0.3)">+</div>`;
      squaresHtml += '</div>';
    }

    const countLabel = target > 1 ? `<span style="font-size:11px;font-weight:700;color:${cur>=target?'#16a34a':'rgba(30,16,64,0.4)'};margin-left:4px">${cur}/${target}</span>` : '';

    return '<div class="habit-me-item-wrap" data-id="' + h.id + '" style="position:relative;overflow:hidden;border-radius:14px;margin-bottom:6px">'
      + '<div id="habit-me-item-' + h.id + '" class="inbox-item" data-action="open-edit-habit" data-id="' + h.id + '" style="padding:10px 12px;cursor:pointer;width:100%;box-sizing:border-box;-webkit-tap-highlight-color:transparent">'
        + '<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">'
          + '<div data-action="toggle-entity-done" data-entity="habit" data-id="' + h.id + '" data-habit-check="1" style="width:36px;height:36px;border-radius:50%;flex-shrink:0;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.25s;-webkit-tap-highlight-color:transparent;' + checkBg + '">'
            + `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${checkStroke}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`
          + '</div>'
          + '<div style="flex:1;min-width:0">'
            + '<div style="display:flex;align-items:center;gap:6px">'
              + '<span style="font-size:15px;font-weight:700;color:#1e1040">' + escapeHtml(shortName) + '</span>'
              + countLabel + streakHtml
            + '</div>'
            + '<div style="font-size:11px;font-weight:600;color:' + pctColor + ';margin-top:1px">' + t('habits.stat.pct_30d', '{pct}% за 30 днів', { pct }) + '</div>'
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
  const taskCount = getTasks().filter(task => task.status !== 'done').length;
  const taskCountEl = document.getElementById('prod-tab-tasks-count');
  const taskSubEl = document.getElementById('prod-tab-tasks-sub');
  if (taskCountEl) taskCountEl.textContent = taskCount;
  if (taskSubEl) taskSubEl.textContent = taskCount === 1 ? t('tasks.counter.active_one', 'активна') : t('tasks.counter.active_many', 'активних');

  // Лічильник звичок — загальна кількість (build + quit). QDIGl 04.05:
  // прибрано підпис «X з Y сьогодні» — створював невідповідність з великим
  // числом (4 vs 3/3) коли частина звичок не scheduled на поточний день.
  // Прогрес-бар «Звички сьогодні X/Y» лишається окремим блоком нижче карток.
  const habits = getHabits();
  const buildHabitsAll = habits.filter(h => h.type !== 'quit');
  const quitHabitsAll = habits.filter(h => h.type === 'quit');
  const habitCountEl = document.getElementById('prod-tab-habits-count');
  const habitSubEl = document.getElementById('prod-tab-habits-sub');
  const totalHabits = buildHabitsAll.length + quitHabitsAll.length;
  if (habitCountEl) habitCountEl.textContent = totalHabits;
  if (habitSubEl) habitSubEl.textContent = totalHabits === 1 ? t('habits.counter.one', 'звичка') : t('habits.counter.many', 'звичок');

  // QDIGl 04.05 — lazy attach swipe handler. Викликається при кожному показі
  // вкладки Tasks через nav.js:136. Idempotent через _prodSwipeAttached.
  _attachProdTabSwipe();
}

function switchProdTab(tab) {
  currentProdTab = tab;
  const isHabits = tab === 'habits';

  // QDIGl 04.05 — segmented control: sliding indicator + кольори тексту.
  // Замість двох окремих карток (R5Ejr 24.04) — одна рамка з білою половинкою
  // що ковзає між Задачі ↔ Звички. Колір рамки індикатора синхронізується
  // з активним табом (помаранчевий tasks / зелений habits).
  const indicator = document.getElementById('prod-tab-indicator');
  if (indicator) {
    indicator.style.transform = isHabits ? 'translateX(100%)' : 'translateX(0)';
    indicator.style.borderColor = isHabits ? 'rgba(22,163,74,0.6)' : 'rgba(234,88,12,0.6)';
  }

  const tabTasks = document.getElementById('prod-tab-tasks');
  const tasksTitle = tabTasks ? tabTasks.querySelector('div > div:first-child') : null;
  const tasksCount = document.getElementById('prod-tab-tasks-count');
  const tasksSub = document.getElementById('prod-tab-tasks-sub');
  if (tasksTitle) tasksTitle.style.color = !isHabits ? '#ea580c' : 'rgba(30,16,64,0.3)';
  if (tasksCount) tasksCount.style.color = !isHabits ? '#ea580c' : 'rgba(30,16,64,0.3)';
  if (tasksSub)   tasksSub.style.color   = !isHabits ? 'rgba(30,16,64,0.35)' : 'rgba(30,16,64,0.3)';

  const tabHabits = document.getElementById('prod-tab-habits');
  const habitsTitle = tabHabits ? tabHabits.querySelector('div > div:first-child') : null;
  const habitsCount = document.getElementById('prod-tab-habits-count');
  const habitsSub = document.getElementById('prod-tab-habits-sub');
  if (habitsTitle) habitsTitle.style.color = isHabits ? '#16a34a' : 'rgba(30,16,64,0.3)';
  if (habitsCount) habitsCount.style.color = isHabits ? '#16a34a' : 'rgba(30,16,64,0.3)';
  if (habitsSub)   habitsSub.style.color   = isHabits ? 'rgba(30,16,64,0.35)' : 'rgba(30,16,64,0.3)';

  document.getElementById('prod-page-tasks').style.display = isHabits ? 'none' : 'block';
  document.getElementById('prod-page-habits').style.display = isHabits ? 'block' : 'none';

  // HKnlM: оновлюємо data-fn (НЕ onclick) — delegation handler єдиний source of truth.
  // Раніше onclick перезаписувався динамічно → на cold profile (де switchProdTab ще не
  // викликався) handler був відсутній → AI-тестер не міг клікнути. data-fn з HTML default
  // 'openAddTask' тепер працює одразу для Tasks-drum, switchProdTab лише змінює коли
  // юзер перемикає на Habits-drum. (Gemini self-critique + Realist Корінь #1.)
  const addBtn = document.getElementById('prod-add-btn');
  if (addBtn) addBtn.dataset.fn = isHabits ? 'openAddHabit' : 'openAddTask';

  updateProdTabCounters();
  if (isHabits) renderProdHabits();

  _attachProdTabSwipe();
}

// Drag-to-toggle: повзунок рухається під пальцем у реальному часі.
// touchstart — фіксуємо startX, вимикаємо transition. touchmove — translateX
// в межах [0, indicatorWidth]. Direction lock після 8px (вертикальне → scroll).
// touchend — snap до найближчої позиції (середина indicatorWidth = поріг).
let _prodSwipeAttached = false;
function _attachProdTabSwipe() {
  if (_prodSwipeAttached) return;
  const toggle = document.getElementById('prod-tab-toggle');
  const indicator = document.getElementById('prod-tab-indicator');
  if (!toggle || !indicator) return;
  _prodSwipeAttached = true;

  let startX = 0, startY = 0;
  let startTranslateX = 0;
  let indicatorWidth = 0;
  let dragging = false;
  let lockedDir = null; // 'h' | 'v' | null

  toggle.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) return;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    indicatorWidth = indicator.offsetWidth;
    startTranslateX = currentProdTab === 'habits' ? indicatorWidth : 0;
    dragging = true;
    lockedDir = null;
    indicator.style.transition = 'border-color 0.3s ease';
  }, { passive: true });

  toggle.addEventListener('touchmove', (e) => {
    if (!dragging) return;
    const dx = e.touches[0].clientX - startX;
    const dy = e.touches[0].clientY - startY;
    if (!lockedDir && Math.abs(dx) + Math.abs(dy) > 8) {
      lockedDir = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v';
      if (lockedDir === 'v') {
        // Вертикальний swipe — скрол сторінки. Повертаємо повзунок на місце.
        dragging = false;
        indicator.style.transition = '';
        indicator.style.transform = currentProdTab === 'habits' ? 'translateX(100%)' : 'translateX(0)';
        return;
      }
    }
    if (lockedDir !== 'h') return;
    let pos = startTranslateX + dx;
    pos = Math.max(0, Math.min(pos, indicatorWidth));
    indicator.style.transform = `translateX(${pos}px)`;
  }, { passive: true });

  toggle.addEventListener('touchend', (e) => {
    if (!dragging) return;
    dragging = false;
    indicator.style.transition = '';
    if (lockedDir !== 'h') {
      indicator.style.transform = currentProdTab === 'habits' ? 'translateX(100%)' : 'translateX(0)';
      return;
    }
    const endX = e.changedTouches[0]?.clientX ?? startX;
    const finalPos = startTranslateX + (endX - startX);
    const target = finalPos > indicatorWidth / 2 ? 'habits' : 'tasks';
    // switchProdTab сам встановить translateX(0/100%) через CSS transition.
    switchProdTab(target);
  }, { passive: true });
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

  // QDIGl 04.05 (двофазний фікс): шкала показує ВСІ build звички у total,
  // а не тільки scheduled-on-DOW. Раніше юзер бачив «1/3» при 4 звичках
  // (одна не у розкладі понеділка) — невідповідність з карткою «4 звичок».
  // Тепер total = всі buildHabits (4), done = реально виконані (1) → «1/4».
  const _isDone = (h) => {
    const target = h.targetCount || 1;
    const rawVal = log[today]?.[h.id];
    const cur = typeof rawVal === 'boolean' ? (rawVal ? 1 : 0) : (rawVal || 0);
    return cur >= target;
  };
  const buildHabitsForBar = habits.filter(h => h.type !== 'quit');
  const todayHabits = buildHabitsForBar; // total = всі (юзер хоче 1/4, не 1/3)
  const doneTodayCount = todayHabits.filter(_isDone).length;
  const countEl = document.getElementById('habits-today-count');
  const barEl = document.getElementById('habits-today-bar');
  if (countEl) countEl.textContent = `${doneTodayCount} / ${todayHabits.length}`;
  if (barEl) barEl.style.width = todayHabits.length > 0 ? `${Math.round(doneTodayCount/todayHabits.length*100)}%` : '0%';

  if (habits.length === 0) {
    el.innerHTML = '<div style="text-align:center;padding:40px 20px;color:rgba(30,16,64,0.3);font-size:15px">' + t('habits.empty.prod_list', 'Ще немає звичок<br>Натисни + щоб додати') + '</div>';
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
        squaresHtml += `<div data-action="tap-habit-square" data-entity="habit-prod" data-id="${h.id}" data-idx="${i}" style="width:14px;height:14px;border-radius:4px;background:${bg};border:${border};cursor:pointer;transition:all 0.15s;display:flex;align-items:center;justify-content:center">`;
        if (filled) squaresHtml += `<svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3.5"><polyline points="20 6 9 17 4 12"/></svg>`;
        squaresHtml += '</div>';
      }
      if (cur < 20) squaresHtml += `<div data-action="toggle-entity-done" data-entity="habit-prod" data-id="${h.id}" style="width:14px;height:14px;border-radius:4px;background:rgba(30,16,64,0.04);border:1.5px dashed rgba(30,16,64,0.15);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:10px;color:rgba(30,16,64,0.3);line-height:1">+</div>`;
      squaresHtml += '</div>';
    }

    const countLabel = target > 1 ? `<span style="font-size:11px;font-weight:700;color:${cur>=target?'#16a34a':'rgba(30,16,64,0.4)'};margin-left:4px">${cur}/${target}</span>` : '';

    return '<div class="prod-habit-item-wrap" id="prod-habit-wrap-' + h.id + '" data-id="' + h.id + '" style="position:relative;border-radius:16px;margin-bottom:var(--card-gap);overflow:hidden">'
      + '<div id="prod-habit-item-' + h.id + '" data-action="prod-habit-card-click" data-id="' + h.id + '" style="background:rgba(255,255,255,0.6);border:1.5px solid rgba(255,255,255,0.85);border-radius:16px;padding:var(--card-pad-y) var(--card-pad-x);box-shadow:var(--card-shadow);position:relative;z-index:1;will-change:transform;cursor:pointer;-webkit-tap-highlight-color:transparent">'
      + '<div style="display:flex;align-items:center;gap:12px;margin-bottom:8px">'
        + '<div data-action="toggle-entity-done" data-entity="habit-prod" data-id="' + h.id + '" data-habit-check="1" style="width:40px;height:40px;border-radius:12px;flex-shrink:0;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.25s;-webkit-tap-highlight-color:transparent;' + checkBg + '">'
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
    html += '<div style="font-size:11px;font-weight:800;color:rgba(30,16,64,0.35);text-transform:uppercase;letter-spacing:0.08em;margin:14px 14px 8px">' + t('habits.quit.section_title', '🚫 Челенджі') + '</div>';
    html += quitHabits.map(h => _renderQuitHabitCard(h)).join('');
  }

  el.innerHTML = html;
  _attachHabitsSwipeDelete();
}

// Рівень стійкості на основі кількості зривів за 30 днів
function _quitResilienceLamp(relapses30) {
  if (relapses30 === 0) return { color: '#16a34a', glow: 'rgba(22,163,74,0.35)', label: t('habits.quit.lamp.steady', 'Стійкий') };
  if (relapses30 <= 2)  return { color: '#ca8a04', glow: 'rgba(202,138,4,0.35)',  label: t('habits.quit.lamp.holding', 'Тримається') };
  if (relapses30 <= 5)  return { color: '#ea580c', glow: 'rgba(234,88,12,0.35)',  label: t('habits.quit.lamp.recovering', 'Відновлюється') };
  return                       { color: '#dc2626', glow: 'rgba(220,38,38,0.4)',   label: t('habits.quit.lamp.danger', 'Небезпека!') };
}

// Тренд зривів: порівнюємо останні 14 днів з попередніми 14
function _quitTrend(relapses) {
  const now = Date.now();
  const d14 = new Date(now - 14 * 86400000).toISOString().slice(0, 10);
  const d28 = new Date(now - 28 * 86400000).toISOString().slice(0, 10);
  const arr = relapses || [];
  const recent = arr.filter(d => d >= d14).length;
  const prev   = arr.filter(d => d >= d28 && d < d14).length;
  if (recent < prev)  return { arrow: '↓', color: '#16a34a', text: t('habits.quit.trend.less', 'зривів менше') };
  if (recent > prev)  return { arrow: '↑', color: '#dc2626', text: t('habits.quit.trend.more', 'зривів більше') };
  return                     { arrow: '→', color: 'rgba(30,16,64,0.4)', text: t('habits.quit.trend.same', 'без змін') };
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
    + '<div id="prod-habit-item-' + h.id + '" data-action="open-edit-habit" data-id="' + h.id + '" style="' + cardBg + ';border:1.5px solid;border-radius:16px;padding:var(--card-pad-y) var(--card-pad-x);position:relative;z-index:1;cursor:pointer;-webkit-tap-highlight-color:transparent">'

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
        + '<span style="font-size:12px;font-weight:600;color:rgba(30,16,64,0.5);margin-left:4px">' + t('habits.quit.label.free_days', 'вільних {word}', { word: _dayWord(freedomDays) }) + '</span>'
      + '</div>'
      + (streak > 0
        ? '<div style="font-size:11px;font-weight:600;color:' + streakColor + ';margin-left:auto">'
          + t('habits.quit.label.streak', '🔥 серія {n} {word}', { n: streak, word: _dayWord(streak) })
          + (longest > streak ? t('habits.quit.label.record_inline', ' · рекорд {n}', { n: longest }) : '')
          + '</div>'
        : (longest > 0
          ? '<div style="font-size:11px;font-weight:500;color:rgba(30,16,64,0.35);margin-left:auto">' + t('habits.quit.label.record', 'рекорд {n} {word}', { n: longest, word: _dayWord(longest) }) + '</div>'
          : ''))
    + '</div>'

    // Кнопки дій
    // Wrapper більше не потребує stopPropagation (delegation closest бере найближчий)
    + '<div style="display:flex;gap:8px">'
      + '<button data-action="hold-quit-habit" data-id="' + h.id + '" style="flex:2;padding:10px;border-radius:12px;border:none;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;touch-action:manipulation;'
        + (heldToday ? 'background:rgba(22,163,74,0.15);color:#16a34a' : 'background:rgba(22,163,74,0.1);color:#16a34a')
        + '">' + (heldToday ? t('habits.quit.btn.held_today', '✅ Тримаюсь сьогодні') : t('habits.quit.btn.hold', '✓ Тримаюсь')) + '</button>'
      + '<button data-action="confirm-quit-relapse" data-id="' + h.id + '" style="flex:1;padding:10px;border-radius:12px;border:1.5px solid rgba(30,16,64,0.1);font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;background:rgba(30,16,64,0.03);color:rgba(30,16,64,0.35);touch-action:manipulation">' + t('habits.quit.btn.relapse', 'Зірвався') + '</button>'
    + '</div>'
    + '</div>'
  + '</div>';
}

function confirmQuitRelapse(habitId) {
  const s = getQuitStatus(habitId);
  const fd = s.freedomDays || 0;
  const fdText = fd > 0 ? '\n' + t('habits.quit.confirm.kept', '{n} вільних {word} залишаться твоїми.', { n: fd, word: _dayWord(fd) }) : '';
  if (window.confirm(t('habits.quit.confirm.relapse', 'Важкий день? Відмітити зрив?') + fdText)) {
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
      if (item) showUndoToast(t('habits.toast.deleted', 'Звичку видалено'), () => {
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

// Тап на prod-habit картку → відкрити edit модалку.
// Guard `event.target.closest('[data-habit-check]')` ВИДАЛЕНО JMQuT (Council post-аудит):
// delegation `closest('[data-action]')` уже бере НАЙБЛИЖЧИЙ data-action елемент — якщо клік
// був на чекбокс з `data-action="toggle-entity-done"`, prod-habit-card-click ВЗАГАЛІ НЕ
// викликається. Guard став dead code після event-delegation міграції.
function prodHabitCardClick(id, _event) {
  openEditHabit(id);
}


// === UNIVERSAL ACTION PROCESSOR — ПЕРЕНЕСЕНО (v3pexs 28.06, D1) ===
// processUniversalAction + _fuzzyFindFolder + _levenshtein (835 рядків) тепер у
// src/core/execute-action.js (Architecture Refactor Сесія 4). Import+export (НЕ
// `export ... from`) — B-201: чистий re-export не створює локального імені, а
// _processOne нижче викликає функцію і в цьому файлі. Strangler: 7 наявних
// імпортерів (tool-dispatcher/inbox/tasks/notes/finance/me) працюють без змін.
// Нові споживачі — імпортуйте одразу з core/execute-action.js.
import { processUniversalAction } from '../core/execute-action.js';
export { processUniversalAction };


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

  const tasks = getTasks().filter(task => task.status !== 'done');
  const tasksSummary = tasks.map(task => {
    const steps = (task.steps || []).map(s => '  - ' + s.text + (s.done ? ' [✓]' : '')).join('\n');
    return 'Задача ID:' + task.id + ' "' + task.title + '"' + (steps ? '\nКроки:\n' + steps : '');
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
    + 'МИНУЛИЙ ЧАС (B-105 fix Aps79 + 64CXo фікс): "поміняв", "подав", "зробив", "написав", "сходив", "купив" — це факт що ВЖЕ стався. ОБРОБКА: (а) якщо у списку АКТИВНИХ задач є явно відповідна задача з тією ж дією — complete_task на ту задачу; (б) якщо явної відповідності немає — **ОБОВʼЯЗКОВО save_moment з текстом юзера** + content "✓ Записав у Моменти. Якщо це закриває задачу — скажи яку." (юзер має знати КУДИ записано). НIКОЛИ не пиши "Записав" без виклику save_moment — це обман. НIКОЛИ delete_task. Не вигадуй фузі-зв\'язок ("поміняв номер" ≠ "Зареєструватися на Upwirk"). НIКОЛИ не видаляй задачу без явного слова "видали/забудь/прибери" від юзера.\n'
    + 'Для редагування існуючої звички (зміна днів/назви) — edit_habit, НЕ save_habit нову.\n'
    + 'Інакше — текст 1-3 речення українською. НЕ вигадуй даних яких немає.\n\n'
    + BASE_CHAT_RULES + '\n\n'
    + UI_TOOLS_RULES
    + (aiContext ? '\n\n' + aiContext : '');

  try {
    // "Один мозок #2 A": INBOX_TOOLS — повний набір CRUD + UI.
    const history = [...taskBarHistory.slice(-8), { role: 'user', content: text }];
    const msg = await callAIWithTools(systemPrompt, history, INBOX_TOOLS, 'tasks-bar');

    // Tool dispatch — UI tool або CRUD через universal action
    if (msg && Array.isArray(msg.tool_calls) && msg.tool_calls.length > 0) {
      // Clarify guard (UvEHE 03.05 Phase 3) — інлайн-чіпи замість галюцинації типу B-115
      const guard = shouldClarify(text, msg.tool_calls, 'tasks');
      if (guard) {
        addTaskBarMsg('agent', guard.question, false, guard.chips);
        setTaskBarLoading(false);
        return;
      }
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

    // v3pexs: одне слово без інструмента (bareNoun) → справжні клікабельні чіпи.
    const bnGuard = shouldClarify(text, [], 'tasks');
    if (bnGuard) { addTaskBarMsg('agent', bnGuard.question, false, bnGuard.chips); setTaskBarLoading(false); return; }

    // Fallback text-JSON — специфічні actions не в INBOX_TOOLS (complete_step, undo_step, complete_habit by name)
    const _processOne = (parsed) => {
      if (processUniversalAction(parsed, text, addTaskBarMsg)) return true;
      if (parsed.action === 'complete_step') {
        const allTasks = getTasks();
        const task = allTasks.find(x => String(x.id) === String(parsed.task_id));
        if (task) {
          const step = task.steps.find(s => s.text.toLowerCase().includes(parsed.step_text.toLowerCase().substring(0,10)));
          if (step) {
            step.done = true;
            if (task.steps.every(s => s.done)) {
              task.status = 'done';
              task.completedAt = Date.now();
              task.updatedAt = Date.now();
            }
            saveTasks(allTasks); renderTasks();
            addTaskBarMsg('agent', `✅ Відмітив "${step.text}" як виконано`);
          } else { addTaskBarMsg('agent', 'Не знайшов такий крок. Уточни будь ласка.'); }
        }
        return true;
      }
      if (parsed.action === 'complete_task') {
        const allTasks = getTasks();
        const task = allTasks.find(x => String(x.id) === String(parsed.task_id));
        if (task) { task.status = 'done'; task.completedAt = Date.now(); task.updatedAt = Date.now(); task.steps.forEach(s => s.done = true); saveTasks(allTasks); renderTasks(); addTaskBarMsg('agent', `✅ Задачу "${task.title}" виконано!`); }
        return true;
      }
      if (parsed.action === 'add_step') {
        const allTasks = getTasks();
        const task = allTasks.find(x => String(x.id) === String(parsed.task_id));
        if (task) { task.steps.push({ id: generateUUID(), text: parsed.step, done: false }); saveTasks(allTasks); renderTasks(); addTaskBarMsg('agent', '✅ Додав крок "' + parsed.step + '"'); }
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
          habits.push(makeHabit({ name, details: parsed.details || '', days }));
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
          const steps = Array.isArray(parsed.steps) ? parsed.steps.map(s => ({ id: generateUUID(), text: s, done: false })) : [];
          tasks.unshift(makeTask({ title, desc: parsed.desc || '', steps }));
          saveTasks(tasks); renderTasks();
          addTaskBarMsg('agent', '✅ Задачу "' + title + '" створено!');
        }
        return true;
      }
      if (parsed.action === 'undo_step') {
        const allTasks = getTasks();
        const task = allTasks.find(x => String(x.id) === String(parsed.task_id));
        if (task) {
          const step = task.steps.find(s => s.text.toLowerCase().includes((parsed.step_text || '').toLowerCase().substring(0,10)));
          if (step) {
            step.done = false;
            if (task.status === 'done') task.status = 'active';
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
  openAddHabit, openEditHabit, toggleHabitToday, toggleProdHabitToday,
  tapHabitSquare, tapHabitSquareMe,
  prodHabitCardClick,
  holdQuitHabit, confirmQuitRelapse,
});

