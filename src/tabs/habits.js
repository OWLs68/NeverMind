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
      const ev = makeEvent({ title: eventDetected.title || title, date: eventDetected.date, time: null, priority: parsed.priority || 'normal' });
      const res = addEventDedup(ev);
      if (!res.added) { addMsg('agent', t('habits.event.dup', 'Така подія "{title}" вже є в календарі.', { title: ev.title })); return true; }
      const dateObj = new Date(eventDetected.date);
      const dayStr = `${dateObj.getDate()} ${monthGenitive(dateObj.getMonth())}`;
      const items = getInbox(); items.unshift({ id: generateUUID(), eventId: ev.id, text: title, category: 'event', ts: Date.now(), processed: true }); saveInbox(items);
      addMsg('agent', t('habits.event.added', '📅 Подію "{title}" додано на {date}', { title: ev.title, date: dayStr }));
      return true;
    }
    const steps = Array.isArray(parsed.steps) ? parsed.steps.map(s => ({ id: generateUUID(), text: s, done: false })) : [];
    const newTask = makeTask({ title, desc: parsed.desc || '', steps, dueDate: parsed.dueDate, priority: parsed.priority });
    const tasks = getTasks();
    tasks.unshift(newTask);
    saveTasks(tasks);
    if (currentTab === 'tasks') renderTasks();
    const items = getInbox(); items.unshift({ id: generateUUID(), text: title, category: 'task', ts: Date.now(), processed: true }); saveInbox(items);
    addMsg('agent', t('habits.task.created', '✅ Задачу "{title}" створено', { title }));
    if (parsed.ask_after) setTimeout(() => addMsg('agent', parsed.ask_after), 600);
    return true;
  }

  // Список-чекліст (v3pexs) — окрема сутність nm_lists + картка в стрічці Inbox.
  // НЕ задача: жодного запису у nm_tasks.
  if (action === 'create_list') {
    const title = (parsed.title || t('lists.untitled', 'Список')).trim();
    const items = (Array.isArray(parsed.items) ? parsed.items : [])
      .map(s => (typeof s === 'string' ? s : (s && s.text ? String(s.text) : '')).trim())
      .filter(Boolean)
      .map(text => ({ id: generateUUID(), text, done: false }));
    if (items.length === 0) return false;
    const list = makeList({ title, items });
    const lists = getLists();
    lists.unshift(list);
    saveLists(lists);
    const inbox = getInbox();
    inbox.unshift({ id: generateUUID(), listId: list.id, text: title, category: 'list', ts: Date.now(), processed: true });
    saveInbox(inbox);
    if (currentTab === 'inbox') renderInbox();
    addMsg('agent', t('lists.created', '📝 Список "{title}" ({n}) — у стрічці Inbox', { title, n: items.length }));
    return true;
  }

  if (action === 'delete_list') {
    const lists = getLists();
    const idx = lists.findIndex(l => String(l.id) === String(parsed.list_id));
    if (idx === -1) { addMsg('agent', t('lists.not_found', 'Список не знайдено.')); return true; }
    const removed = lists[idx];
    lists.splice(idx, 1);
    saveLists(lists);
    saveInbox(getInbox().filter(i => String(i.listId) !== String(parsed.list_id)));
    if (currentTab === 'inbox') renderInbox();
    addMsg('agent', t('lists.deleted', '🗑 Список "{title}" видалено', { title: removed.title || '' }));
    return true;
  }

  if (action === 'edit_habit') {
    const habits = getHabits();
    const h = habits.find(x => x.id === parsed.habit_id);
    if (!h) {
      // Fuzzy match по назві
      const nameQ = (parsed.name || parsed.habit_name || '').toLowerCase();
      const found = habits.find(x => x.name.toLowerCase().includes(nameQ.slice(0, 6)));
      if (!found) { addMsg('agent', t('habits.err.habit_not_found', 'Не знайшов цю звичку.')); return true; }
      if (parsed.name) found.name = parsed.name;
      if (parsed.days) found.days = parsed.days;
      if (parsed.details !== undefined) found.details = parsed.details;
      saveHabits(habits);
      renderProdHabits(); renderHabits();
      addMsg('agent', t('habits.habit.updated', '✏️ Звичку "{name}" оновлено', { name: found.name }));
      return true;
    }
    if (parsed.name) h.name = parsed.name;
    if (parsed.days) h.days = parsed.days;
    if (parsed.details !== undefined) h.details = parsed.details;
    saveHabits(habits);
    renderProdHabits(); renderHabits();
    addMsg('agent', t('habits.habit.updated', '✏️ Звичку "{name}" оновлено', { name: h.name }));
    return true;
  }

  if (action === 'edit_task') {
    const tasks = getTasks();
    const task = tasks.find(x => String(x.id) === String(parsed.task_id));
    if (!task) {
      const nameQ = (parsed.title || '').toLowerCase();
      const found = tasks.find(x => x.title.toLowerCase().includes(nameQ.slice(0, 8)));
      if (!found) { addMsg('agent', t('habits.err.task_not_found_short', 'Не знайшов цю задачу.')); return true; }
      if (parsed.title) found.title = parsed.title;
      if (parsed.dueDate && parsed.dueDate !== found.dueDate) {
        if (found.dueDate) found.rescheduleCount = (found.rescheduleCount || 0) + 1;
        found.dueDate = parsed.dueDate;
        found.updatedAt = Date.now();
      }
      if (parsed.priority && ['normal','important','critical'].includes(parsed.priority)) found.priority = parsed.priority;
      saveTasks(tasks);
      if (currentTab === 'tasks') renderTasks();
      addMsg('agent', t('habits.task.updated', '✏️ Задачу "{title}" оновлено', { title: found.title }));
      return true;
    }
    if (parsed.title) task.title = parsed.title;
    if (parsed.dueDate && parsed.dueDate !== task.dueDate) {
      if (task.dueDate) task.rescheduleCount = (task.rescheduleCount || 0) + 1;
      task.dueDate = parsed.dueDate;
      task.updatedAt = Date.now();
    }
    if (parsed.priority && ['normal','important','critical'].includes(parsed.priority)) task.priority = parsed.priority;
    saveTasks(tasks);
    if (currentTab === 'tasks') renderTasks();
    addMsg('agent', t('habits.task.updated', '✏️ Задачу "{title}" оновлено', { title: task.title }));
    return true;
  }

  if (action === 'delete_task') {
    const tasks = getTasks();
    let target = tasks.find(x => String(x.id) === String(parsed.task_id));
    if (!target) {
      const nameQ = (parsed.title || parsed.query || '').toLowerCase().trim();
      // QDIGl 04.05 SAFETY: пустий nameQ (AI забув title) → .includes('')=true
      // → видаляли ПЕРШУ активну задачу при будь-якому невідомому task_id.
      // Це був корінь «видали проект Х» → видалена випадкова задача. Тепер
      // короткий query (<3 літери) → відмова + повідомлення юзеру.
      if (nameQ.length >= 3) {
        target = tasks.find(x => x.title.toLowerCase().includes(nameQ.slice(0, 8)));
      }
    }
    if (!target) { addMsg('agent', t('habits.err.task_not_found', 'Не знайшов цю задачу. Уточни назву.')); return true; }
    addToTrash('task', target, null);
    const remaining = tasks.filter(x => x.id !== target.id);
    saveTasks(remaining);
    if (currentTab === 'tasks') renderTasks();
    addMsg('agent', t('habits.task.deleted', '🗑️ Задачу "{title}" видалено', { title: target.title }));
    // 64CXo: showUndoToast() без msg/restoreFn → toast «undefined», кнопка «Відновити» нічого не робила.
    showUndoToast(t('habits.toast.task_deleted', 'Задачу "{title}" видалено', { title: target.title }), () => {
      const cur = getTasks();
      cur.push(target);
      saveTasks(cur);
      if (currentTab === 'tasks') renderTasks();
    });
    return true;
  }

  if (action === 'delete_habit') {
    const habits = getHabits();
    const h = habits.find(x => x.id === parsed.habit_id);
    const nameQ = (parsed.name || parsed.query || '').toLowerCase();
    const target = h || habits.find(x => x.name.toLowerCase().includes(nameQ.slice(0, 6)));
    if (!target) { addMsg('agent', t('habits.err.habit_not_found', 'Не знайшов цю звичку.')); return true; }
    addToTrash('habit', target, null);
    const remaining = habits.filter(x => x.id !== target.id);
    saveHabits(remaining);
    renderProdHabits(); renderHabits();
    addMsg('agent', t('habits.habit.deleted', '🗑️ Звичку "{name}" видалено', { name: target.name }));
    // 64CXo: showUndoToast() без аргументів → toast «undefined».
    showUndoToast(t('habits.toast.habit_deleted', 'Звичку "{name}" видалено', { name: target.name }), () => {
      const cur = getHabits();
      cur.push(target);
      saveHabits(cur);
      renderProdHabits(); renderHabits();
    });
    return true;
  }

  if (action === 'reopen_task') {
    const tasks = getTasks();
    const task = tasks.find(x => String(x.id) === String(parsed.task_id) && x.status === 'done');
    const nameQ = (parsed.title || parsed.query || '').toLowerCase();
    const target = task || tasks.find(x => x.status === 'done' && x.title.toLowerCase().includes(nameQ.slice(0, 8)));
    if (!target) { addMsg('agent', t('habits.err.closed_task_not_found', 'Не знайшов закриту задачу з такою назвою.')); return true; }
    target.status = 'active';
    delete target.completedAt;
    saveTasks(tasks);
    if (currentTab === 'tasks') renderTasks();
    addMsg('agent', t('habits.task.reopened', '🔄 Задачу "{title}" перевідкрито', { title: target.title }));
    return true;
  }

  // B-106 fix (Aps79 27.04): complete_task/complete_habit/add_step тепер у processUniversalAction.
  // Раніше були тільки у fallback text-JSON шляху sendTasksBarMessage — коли AI кликав через
  // tool_calls, dispatchChatToolCalls йшов сюди і не знаходив обробник → жодного addMsg → точки
  // друку висіли назавжди.
  if (action === 'complete_task') {
    const tasks = getTasks();
    const task = tasks.find(x => String(x.id) === String(parsed.task_id));
    if (!task) { addMsg('agent', t('habits.err.task_not_found_by_id', 'Не знайшов задачу з таким ID.')); return true; }
    if (task.status === 'done') { addMsg('agent', t('habits.task.already_done', 'Задача "{title}" вже закрита.', { title: task.title })); return true; }
    // 64CXo B-160 guard: AI міг зматчити task через назву коли юзер закрив КРОК.
    // Перевіряємо чи user-message містить текст активного кроку — якщо так, закриваємо
    // тільки цей крок, не цілу задачу. Юзер каже «Купив перець» при «Купити перець,
    // цибулю, ківі» з 7 кроками → закрити крок «перець», не всю задачу.
    if (Array.isArray(task.steps) && task.steps.length > 0 && originalText) {
      const userMsg = originalText.toLowerCase();
      const matchStep = task.steps.find(s => !s.done && s.text && userMsg.includes(s.text.toLowerCase().replace(/^купити\s+/, '').slice(0, 6)));
      if (matchStep && task.steps.some(s => !s.done && s !== matchStep)) {
        matchStep.done = true;
        if (task.steps.every(s => s.done)) {
          task.status = 'done';
          task.completedAt = Date.now();
        }
        task.updatedAt = Date.now();
        saveTasks(tasks);
        if (currentTab === 'tasks') renderTasks();
        addMsg('agent', t('habits.step.closed', '✓ Крок «{step}» закрито', { step: matchStep.text }));
        return true;
      }
    }
    addMsg('agent', t('habits.task.done', '✅ Задачу "{title}" виконано!', { title: task.title }));
    // Викликаємо ту саму 3-фазну анімацію що й при ручному тапі ✓:
    // галочка → 250мс пауза → сповзання картки → save+render через 620мс.
    if (currentTab === 'tasks') {
      toggleTaskStatus(task.id);
    } else {
      // Не на вкладці Задач — анімувати нема де, просто зберігаємо статус.
      task.status = 'done';
      task.completedAt = Date.now();
      task.updatedAt = Date.now();
      if (Array.isArray(task.steps)) task.steps.forEach(s => s.done = true);
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
    if (!h) { addMsg('agent', t('habits.err.habit_not_found_short', 'Не знайшов звичку.')); return true; }
    const todayStr = new Date().toDateString();
    const log = getHabitLog();
    if (!log[todayStr]) log[todayStr] = {};
    log[todayStr][h.id] = true;
    saveHabitLog(log);
    renderProdHabits();
    renderHabits();
    addMsg('agent', t('habits.habit.marked_today', '✅ Відмітив звичку "{name}" як виконану сьогодні', { name: h.name }));
    return true;
  }

  // 64CXo B-161: complete_step як універсальна action (через tool у prompts.js
  // + case у tool-dispatcher.js). Раніше працювало тільки як text-JSON у Tasks-чаті
  // → у Inbox AI писав «[complete_task]» plain text бо tool недосяжний.
  if (action === 'complete_step') {
    const tasks = getTasks();
    const task = tasks.find(x => String(x.id) === String(parsed.task_id));
    if (!task) { addMsg('agent', t('habits.err.task_not_found_short', 'Не знайшов задачу.')); return true; }
    if (!Array.isArray(task.steps) || task.steps.length === 0) {
      addMsg('agent', t('habits.step.no_steps', 'У задачі «{title}» немає кроків.', { title: task.title })); return true;
    }
    const q = (parsed.step_text || '').toLowerCase().trim();
    // 64CXo regression-hunter: без guard порожній q → ''.includes('') = true → закривав
    // перший-ліпший активний крок. Тепер вимагаємо мінімум 2 символи для match.
    if (q.length < 2) { addMsg('agent', t('habits.step.empty_text', 'Уточни який саме крок закрити.')); return true; }
    const qSlice = q.slice(0, 8);
    const step = task.steps.find(s => {
      if (s.done) return false;
      const sLow = s.text.toLowerCase();
      // Захист від false-match на занадто коротких словах: вимагаємо щоб slice
      // мав мінімум 3 символи І щоб збіг був не у 1-1 нерелевантному слові.
      return (sLow.length >= 3 && sLow.includes(qSlice) && qSlice.length >= 3) ||
             (q.length >= 3 && q.includes(sLow.slice(0, Math.min(8, sLow.length))) && sLow.length >= 3);
    });
    if (!step) { addMsg('agent', t('habits.step.not_found', 'Не знайшов активний крок «{step}» у задачі «{title}».', { step: parsed.step_text, title: task.title })); return true; }
    step.done = true;
    if (task.steps.every(s => s.done)) {
      task.status = 'done';
      task.completedAt = Date.now();
    }
    task.updatedAt = Date.now();
    saveTasks(tasks);
    if (currentTab === 'tasks') renderTasks();
    const allDone = task.steps.every(s => s.done);
    addMsg('agent', allDone
      ? t('habits.step.last_done', '✅ Останній крок «{step}» закрито — задачу «{title}» виконано!', { step: step.text, title: task.title })
      : t('habits.step.closed', '✓ Крок «{step}» закрито', { step: step.text }));
    return true;
  }

  // 64CXo B-163: merge_tasks — об'єднання двох задач у одну. Кроки з 'from' переходять
  // у 'to' (з дедупом), назва 'from' стає кроком, 'from' видаляється.
  if (action === 'merge_tasks') {
    const tasks = getTasks();
    const from = tasks.find(x => String(x.id) === String(parsed.from_task_id));
    const to = tasks.find(x => String(x.id) === String(parsed.to_task_id));
    if (!from || !to) { addMsg('agent', t('habits.merge.not_found', 'Не знайшов одну з задач для об\'єднання.')); return true; }
    if (from.id === to.id) { addMsg('agent', t('habits.merge.same', 'Не можу об\'єднати задачу з самою собою.')); return true; }
    if (!Array.isArray(to.steps)) to.steps = [];
    if (!Array.isArray(from.steps)) from.steps = [];
    let added = 0;
    from.steps.filter(s => !s.done).forEach(s => {
      if (!to.steps.some(ts => ts.text.toLowerCase() === s.text.toLowerCase())) {
        to.steps.push({ id: generateUUID(), text: s.text, done: false });
        added++;
      }
    });
    if (!to.steps.some(ts => ts.text.toLowerCase() === from.title.toLowerCase())) {
      to.steps.push({ id: generateUUID(), text: from.title, done: false });
      added++;
    }
    const idx = tasks.findIndex(x => String(x.id) === String(from.id));
    if (idx !== -1) tasks.splice(idx, 1);
    to.updatedAt = Date.now();
    saveTasks(tasks);
    if (currentTab === 'tasks') renderTasks();
    addMsg('agent', t('habits.merge.done', '✅ Об\'єднав «{from}» з «{to}» (+{n} кроків)', { from: from.title, to: to.title, n: added }));
    return true;
  }

  if (action === 'add_step') {
    const tasks = getTasks();
    const task = tasks.find(x => String(x.id) === String(parsed.task_id));
    if (!task) { addMsg('agent', t('habits.err.task_for_step', 'Не знайшов задачу для додавання кроку.')); return true; }
    const stepText = (parsed.step || '').trim();
    if (!stepText) { addMsg('agent', t('habits.err.step_empty', 'Не вказано текст кроку.')); return true; }
    if (!Array.isArray(task.steps)) task.steps = [];
    // 64CXo B-162: дедуп — пропускаємо якщо такий крок (нечутливо до регістру) вже є.
    // На «Об'єднай дві останні» AI робив add_step з 4 рядками, з них 3 вже були → дублі.
    if (task.steps.some(s => s.text.toLowerCase() === stepText.toLowerCase())) {
      addMsg('agent', t('habits.step.dup', 'Крок «{step}» вже є — пропускаю', { step: stepText }));
      return true;
    }
    task.steps.push({ id: generateUUID(), text: stepText, done: false });
    task.updatedAt = Date.now();
    saveTasks(tasks);
    if (currentTab === 'tasks') renderTasks();
    addMsg('agent', t('habits.step.added', '✅ Додав крок "{step}"', { step: stepText }));
    return true;
  }

  if (action === 'add_moment') {
    const text = (parsed.text || '').trim();
    if (!text) return false;
    const mood = /добре|чудово|супер|відмінно|весело|щасли|круто|кайф/i.test(text) ? 'positive' :
                 /погано|жахливо|сумно|нудно|важко|втомив|зле|дістало/i.test(text) ? 'negative' : 'neutral';
    // 64CXo: парсимо date якщо AI передав («вчора» → YYYY-MM-DD). Phase B hook
    // використовує ts для дейлі-папки — так момент про вчора йде у вчорашню папку.
    let momentTs = Date.now();
    if (parsed.date && /^\d{4}-\d{2}-\d{2}$/.test(parsed.date)) {
      const parsedDate = new Date(parsed.date + 'T12:00:00');
      if (!isNaN(parsedDate.getTime())) momentTs = parsedDate.getTime();
    } else {
      // 64CXo: code-side fallback через ua-time-parser. AI часто не передає
      // date навіть з явним промптом → парсимо «вчора»/«тиждень тому»/etc
      // з originalText юзера + text моменту.
      const resolved = resolveDateFromText((originalText || '') + ' ' + text);
      if (resolved) momentTs = resolved.getTime();
    }
    const moments = getMoments();
    moments.push({ id: generateUUID(), text, mood, ts: momentTs });
    saveMoments(moments);
    addMsg('agent', t('habits.moment.added', '✨ Момент записано'));
    return true;
  }

  if (action === 'create_habit') {
    const name = (parsed.name || '').trim();
    if (!name) return false;
    const habits = getHabits();
    habits.push(makeHabit({ name, details: parsed.details || '', days: parsed.days }));
    saveHabits(habits);
    renderProdHabits(); renderHabits();
    addMsg('agent', t('habits.habit.created', '🌱 Звичку "{name}" створено', { name }));
    if (parsed.ask_after) setTimeout(() => addMsg('agent', parsed.ask_after), 600);
    return true;
  }

  if (action === 'create_note') {
    addNoteFromInbox(parsed.text, 'note', parsed.folder || null, 'agent');
    if (currentTab === 'notes') renderNotes();
    addMsg('agent', parsed.folder
      ? t('habits.note.saved_to', '✓ Нотатку збережено в папку "{folder}"', { folder: parsed.folder })
      : t('habits.note.saved', '✓ Нотатку збережено'));
    if (parsed.ask_after) setTimeout(() => addMsg('agent', parsed.ask_after), 600);
    return true;
  }

  if (action === 'create_event') {
    const title = (parsed.title || '').trim();
    if (!title) return false;
    // 64CXo Phase 3: code-side date resolve via ua-time-parser. AI with strict
    // mode may pass date=null for abstract expressions — parser handles them.
    let resolvedDate = parsed.date;
    if (!resolvedDate || !/^\d{4}-\d{2}-\d{2}$/.test(resolvedDate)) {
      const d = resolveDateFromText(originalText || title, new Date(), 'future');
      if (d) {
        resolvedDate = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      }
    }
    if (!resolvedDate) return false;
    let endTime = parsed.end_time || null;
    if (!parsed.time) endTime = null;
    if (endTime && parsed.time && endTime <= parsed.time) endTime = null;
    let conflict = null;
    if (parsed.time) {
      conflict = getEvents().find(e => e.date === resolvedDate && e.time === parsed.time && e.title !== title);
    }
    const ev = makeEvent({ title, date: resolvedDate, time: parsed.time || null, endTime, priority: parsed.priority || 'normal' });
    const res = addEventDedup(ev);
    if (!res.added) { addMsg('agent', t('habits.event.dup', 'Така подія "{title}" вже є в календарі.', { title })); return true; }
    const dateObj = new Date(resolvedDate);
    const dayStr = `${dateObj.getDate()} ${monthGenitive(dateObj.getMonth())}`;
    const items = getInbox(); items.unshift({ id: generateUUID(), eventId: ev.id, text: title, category: 'event', ts: Date.now(), processed: true }); saveInbox(items);
    const timeStr = parsed.time ? ` о ${parsed.time}${endTime ? '–' + endTime : ''}` : '';
    const warn = conflict ? '\n' + t('habits.event.conflict', '⚠️ На цей час уже є "{title}". Лишити обидві чи перенести?', { title: conflict.title }) : '';
    addMsg('agent', t('habits.event.added_full', '📅 Подію "{title}" додано на {date}{time}{warn}', { title, date: dayStr, time: timeStr, warn }));
    return true;
  }

  if (action === 'edit_event') {
    const events = getEvents();
    const idx = events.findIndex(e => e.id === parsed.event_id);
    if (idx === -1) { addMsg('agent', t('habits.err.event_for_edit', 'Не знайшов подію для редагування.')); return true; }
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
    const dayStr = `${dateObj.getDate()} ${monthGenitive(dateObj.getMonth())}`;
    const tm = events[idx].time;
    const et = events[idx].endTime;
    const timeStr = tm ? ` о ${tm}${et ? '–' + et : ''}` : '';
    const editText = t('habits.event.edited', '✏️ Змінено: "{title}" → {date}{time}', { title: events[idx].title, date: dayStr, time: timeStr });
    addMsg('agent', editText);
    // Карточка в Inbox стрічку щоб юзер бачив що було змінено
    try {
      const inbox = getInbox();
      inbox.unshift({ id: generateUUID(), eventId: events[idx].id, text: editText, type: 'edit', category: 'event', ts: Date.now() });
      saveInbox(inbox);
      if (typeof renderInbox === 'function') renderInbox();
    } catch(e) {}
    return true;
  }

  if (action === 'delete_event') {
    const events = getEvents();
    const idx = events.findIndex(e => e.id === parsed.event_id);
    if (idx === -1) { addMsg('agent', t('habits.err.event_not_found', 'Не знайшов подію.')); return true; }
    const title = events[idx].title;
    const removed = events[idx];
    const eventId = removed.id;
    addToTrash('event', removed);
    events.splice(idx, 1);
    saveEvents(events);
    // B-165 dyhJu 10.05: Cleanup nm_inbox — видаляємо event-картку, інакше
    // вона лишається зомбі у Inbox після видалення з календаря (юзер бачить
    // картку «Подія» якої вже немає). Дзеркальне до B-126 delete_reminder.
    // Match за eventId (нові картки після dyhJu) АБО fallback за text+category
    // (старі картки до dyhJu без eventId field).
    try {
      const inbox = getInbox();
      const inboxRest = inbox.filter(it => {
        const matchById = it.eventId === eventId;
        const matchByText = !it.eventId && it.category === 'event' && it.text === title;
        return !(matchById || matchByText);
      });
      if (inboxRest.length !== inbox.length) saveInbox(inboxRest);
    } catch(e) {}
    try { renderInbox(); } catch(e) {}
    addMsg('agent', t('habits.event.deleted', '🗑 Подію "{title}" видалено', { title }));
    // 64CXo: showUndoToast('event', title) — другий arg був рядок назви, не функція restore.
    // При кліку «Відновити» — TypeError. Виправлено на правильну сигнатуру.
    showUndoToast(t('habits.toast.event_deleted', 'Подію "{title}" видалено', { title }), () => {
      const cur = getEvents();
      cur.push(removed);
      saveEvents(cur);
    });
    return true;
  }

  if (action === 'edit_note') {
    const notes = getNotes();
    const idx = notes.findIndex(n => n.id === parsed.note_id);
    if (idx === -1) { addMsg('agent', t('habits.err.note_not_found', 'Не знайшов нотатку.')); return true; }
    if (parsed.text) notes[idx].text = parsed.text;
    if (parsed.folder) notes[idx].folder = parsed.folder;
    notes[idx].updatedAt = Date.now();
    saveNotes(notes);
    addMsg('agent', parsed.folder
      ? t('habits.note.updated_folder', '✓ Нотатку оновлено → папка "{folder}"', { folder: parsed.folder })
      : t('habits.note.updated', '✓ Нотатку оновлено'));
    return true;
  }

  if (action === 'create_folder') {
    const folderName = (parsed.folder || '').trim();
    if (!folderName) return false;
    // Папка "існує" якщо є хоч одна нотатка з такою назвою
    const notes = getNotes();
    const exists = notes.some(n => (n.folder || 'Загальне') === folderName);
    if (exists) {
      addMsg('agent', t('habits.folder.exists', 'Папка "{folder}" вже є.', { folder: folderName }));
    } else {
      // Створюємо папку через додавання порожньої нотатки-заглушки яку одразу прибираємо
      // Правильний спосіб — просто кажемо юзеру що папка з'явиться при першій нотатці
      addMsg('agent', t('habits.folder.created_hint', 'Папка "{folder}" створена. Напиши нотатку і я покладу її туди.', { folder: folderName }));
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
      addMsg('agent', t('habits.folder.not_found', 'Папку "{folder}" не знайшов. Доступні: {list}', { folder: targetName, list: folders.join(', ') }));
      return true;
    }
    // 64CXo Фаза D: recursive — якщо папка має дочірніх, видаляємо їх теж.
    // Узгоджено з swipe-delete у notes.js (Фаза C).
    const childNames = getDirectChildren(matched);
    const toDeleteSet = new Set([matched, ...childNames]);
    const toDelete = notes.filter(n => toDeleteSet.has(n.folder || 'Загальне'));
    toDelete.forEach(n => addToTrash('folder', n, null));
    const remaining = notes.filter(n => !toDeleteSet.has(n.folder || 'Загальне'));
    saveNotes(remaining);
    if (currentTab === 'notes') { setCurrentNotesFolder(null); renderNotes(); }
    const childInfo = childNames.length > 0 ? t('habits.folder.deleted_children', ' + {n} підпапок', { n: childNames.length }) : '';
    addMsg('agent', t('habits.folder.deleted', '✓ Папку "{folder}" видалено ({n} нотаток)', { folder: matched, n: toDelete.length }) + childInfo);
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
      addMsg('agent', t('habits.note.not_found_q', 'Нотатку "{q}" не знайшов.', { q: noteQuery }));
      return true;
    }
    const oldFolder = notes[idx].folder || 'Загальне';
    // Видаляємо зі старої папки
    const oldIdx = notes.findIndex(n => n.id === notes[idx].id && (n.folder || 'Загальне') === oldFolder && n !== notes[idx]);
    notes[idx] = { ...notes[idx], folder: resolvedFolder, updatedAt: Date.now() };
    saveNotes(notes);
    if (currentTab === 'notes') renderNotes();
    addMsg('agent', t('habits.note.moved', '✓ Нотатку переміщено з "{from}" до "{to}"', { from: oldFolder, to: resolvedFolder }));
    return true;
  }

  if (action === 'save_finance' || action === 'save_expense' || action === 'save_income') {
    // Phase 2 nliW8 13.05: уніфіковано через processFinanceAction (finance.js).
    // Раніше тут був 50-рядковий дубль з активними розбіжностями (auto-create
    // вигаданих категорій, Date.now() ID, відсутні syncHealth + budget + logAction +
    // chip-діалог). Тепер один мозок для всіх 7 non-Inbox чатів — handler приймає
    // addMsg як 3-й параметр (DI), повідомлення йде у поточний чат.
    // save_income → forced fin_type='income' через нормалізацію args.
    const normalizedParsed = action === 'save_income' ? { ...parsed, fin_type: 'income' } : parsed;
    processFinanceAction(normalizedParsed, originalText, addMsg);
    return true;
  }

  if (action === 'save_routine') {
    const blocks = (parsed.blocks || []).map(b => ({ time: b.time, activity: b.activity }));
    const days = Array.isArray(parsed.day) ? parsed.day : [parsed.day || 'default'];
    if (days.length > 1) {
      _splitReply(t('habits.routine.copying', 'Копіюю розпорядок на {n} днів...', { n: days.length }), () => {
        const routine = getRoutine();
        days.forEach(d => { routine[d] = [...blocks]; });
        saveRoutine(routine);
        addMsg('agent', t('habits.routine.done_multi', '🕐 Готово! Розпорядок на {n} дн. ({blocks} блоків)', { n: days.length, blocks: blocks.length }));
      });
    } else {
      const routine = getRoutine();
      days.forEach(d => { routine[d] = [...blocks]; });
      saveRoutine(routine);
      addMsg('agent', t('habits.routine.saved', '🕐 Розпорядок збережено ({blocks} блоків)', { blocks: blocks.length }));
    }
    return true;
  }

  if (action === 'set_reminder') {
    const text = parsed.text || 'Нагадування';
    // 64CXo Phase 3: code-side date resolve via ua-time-parser, mode='future'.
    let date = parsed.date;
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      const d = resolveDateFromText(originalText || text, new Date(), 'future');
      if (d) {
        date = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      } else {
        date = new Date().toISOString().slice(0, 10);
      }
    }
    // dyhJu G2: parseUaTimeOfDay як fallback коли AI не передав явний `time`.
    // Покриває «зранку»→08:00, «через годину»→now+60, «о 15:00»→15:00 тощо.
    // Якщо парсер теж null — питаємо юзера.
    let time = parsed.time;
    if (!time) {
      const parsedTime = parseUaTimeOfDay(originalText || text, new Date());
      if (parsedTime) time = parsedTime;
    }
    if (!time) { addMsg('agent', t('habits.err.reminder_time', 'Вкажи час нагадування.')); return true; }
    // B-169 dyhJu 10.05: guard «date=today + time у минулому → +1 день».
    // Юзер каже «нагадай зранку» о 20:00 → parser ставить time=08:00, date=today
    // (нема явного слова «завтра» у тексті). Reminder на 08:00 СЬОГОДНI = у
    // минулому → spawn'иться одразу або не спрацює зовсім. Логіка: «зранку»
    // вже не сьогодні якщо ранок минув — переносимо на завтра.
    {
      const now = new Date();
      const todayISO = now.toISOString().slice(0, 10);
      if (date === todayISO && time) {
        const [hh, mm] = time.split(':').map(n => parseInt(n, 10));
        if (Number.isFinite(hh) && Number.isFinite(mm)) {
          const reminderTs = new Date(now);
          reminderTs.setHours(hh, mm, 0, 0);
          if (reminderTs.getTime() <= now.getTime()) {
            const tomorrow = new Date(now);
            tomorrow.setDate(tomorrow.getDate() + 1);
            date = tomorrow.toISOString().slice(0, 10);
          }
        }
      }
    }
    // myshu Сесія 3: UUID замість Date.now()+1/+2 арифметики. Раніше:
    //   reminderId = Date.now()
    //   event.id = reminderId + 1   ← числова арифметика
    //   inbox.id = reminderId + 2   ← числова арифметика
    // Проблема: коли reminderId стане UUID-рядок, +1 = конкатенація («uuid1»),
    // 3 сховища (nm_reminders/nm_events/nm_inbox) перестали б знаходити одне
    // одного. Тепер: КОЖЕН запис має свій UUID, зв'язок через окреме поле
    // `reminderId` (primary key для cross-storage cleanup).
    const reminderId = generateUUID();
    // 1. nm_reminders — для тригера спливаючого попередження
    const reminders = getReminders();
    reminders.push({ id: reminderId, time, text, date, done: false });
    saveReminders(reminders);
    // 2. nm_events — щоб було видно у календарі і модалці "Розпорядок дня"
    addEventDedup({
      id: generateUUID(),
      title: text,
      date,
      time,
      priority: 'normal',
      createdAt: Date.now(),
      source: 'reminder',
      reminderId
    });
    // 3. nm_inbox — картка у стрічку з категорією "Нагадування" (⏰).
    // QDIGl 04.05: reminderId поле додано для синхронного видалення —
    // свайп картки прибирає nm_reminders + nm_events за тим же ID.
    const items = getInbox();
    items.unshift({
      id: generateUUID(),
      reminderId: reminderId,
      text: `${time} — ${text}`,
      category: 'reminder',
      ts: Date.now(),
      processed: true
    });
    saveInbox(items);
    try { renderInbox(); } catch(e) {}
    window.dispatchEvent(new CustomEvent('nm-data-changed', { detail: 'reminder' }));
    addMsg('agent', t('habits.reminder.set.ok', '⏰ Нагадаю о {time}: "{text}"', { time, text }));
    return true;
  }

  if (action === 'delete_reminder') {
    // B-126 fix MPVly 05.05: AI викликає при коригуванні часу свіжого reminder.
    // Шукаємо у nm_reminders за text (нечіткий) + опційно time/date для уточнення.
    // Cleanup трисховищний: nm_reminders + nm_events (за reminderId) + nm_inbox (за reminderId).
    const qText = (parsed.text || '').trim().toLowerCase();
    const qTime = parsed.time || null;
    const qDate = parsed.date || null;
    if (!qText && !qTime && !qDate) { addMsg('agent', t('habits.reminder.del.unclear', 'Не зрозумів яке нагадування видалити.')); return true; }

    const reminders = getReminders();
    // MPVly 05.05 follow-up: 3-рівневий fuzzy match для опечаток.
    // 1) substring (швидко) → 2) Levenshtein ≤2 для слів ≥5 літер (опечатки) →
    // 3) ні те, ні те — пропускаємо.
    // Кейс: AI зберіг "поприбрати" (опечатка), юзер каже "поприбирати" — distance=1.
    const _textMatch = (rText) => {
      if (!qText) return true;
      if (rText.includes(qText) || qText.includes(rText)) return true;
      if (qText.length >= 5 && rText.length >= 5) {
        const dist = levenshtein(qText, rText);
        if (dist <= 2) return true;
      }
      return false;
    };
    const idx = reminders.findIndex(r => {
      const rText = (r.text || '').toLowerCase();
      const tMatch = _textMatch(rText);
      const timeMatch = !qTime || r.time === qTime;
      const dateMatch = !qDate || r.date === qDate;
      return tMatch && timeMatch && dateMatch;
    });
    if (idx === -1) {
      const atTime = qTime ? t('habits.reminder.del.at_time', ' на {time}', { time: qTime }) : '';
      addMsg('agent', t('habits.reminder.del.not_found', 'Не знайшов нагадування "{text}"{atTime}.', { text: parsed.text || '', atTime }));
      return true;
    }

    const removed = reminders[idx];
    const reminderId = removed.id;
    reminders.splice(idx, 1);
    saveReminders(reminders);

    // nm_events — видаляємо event пов'язаний з reminder (id+1 або поле reminderId)
    try {
      const events = getEvents();
      const eventsRest = events.filter(e => e.reminderId !== reminderId && e.id !== reminderId + 1);
      // 64CXo: saveEvents() замість прямого setItem — диспатч nm-data-changed
      // потрібний для board re-render, інакше OWL не дізнається що подія зникла.
      if (eventsRest.length !== events.length) saveEvents(eventsRest);
    } catch(e) {}

    // nm_inbox — видаляємо картку (id+2 або поле reminderId)
    try {
      const inbox = getInbox();
      const inboxRest = inbox.filter(it => it.reminderId !== reminderId && it.id !== reminderId + 2);
      if (inboxRest.length !== inbox.length) saveInbox(inboxRest);
    } catch(e) {}

    try { renderInbox(); } catch(e) {}
    window.dispatchEvent(new CustomEvent('nm-data-changed', { detail: 'reminder' }));
    addMsg('agent', t('habits.reminder.del.ok', '🗑️ Видалив нагадування "{text}" о {time}.', { text: removed.text, time: removed.time }));
    return true;
  }

  // db0YY 12.05: B-174 fix — undo cases для tools що раніше жили ТIЛЬКИ у
  // tool-dispatcher.js direct handlers. action-undo через DI кличе сюди →
  // ці cases дозволяють universal undo для save_finance / create_health_card /
  // add_allergy не падати silent false.

  if (action === 'delete_transaction') {
    const txId = parsed.id;
    if (!txId) { addMsg('agent', t('habits.tx.del.no_id', 'Не зрозумів яку транзакцію видалити.')); return true; }
    const txs = getFinance();
    const idx = txs.findIndex(t => String(t.id) === String(txId));
    if (idx === -1) { addMsg('agent', t('habits.tx.del.not_found', 'Не знайшов транзакцію.')); return true; }
    const removed = txs[idx];
    txs.splice(idx, 1);
    saveFinance(txs);
    try { addToTrash('finance', removed); } catch(e) {}
    if (currentTab === 'finance') renderFinance();
    addMsg('agent', t('habits.tx.del.ok', '🗑️ Видалив транзакцію.'));
    return true;
  }

  if (action === 'delete_health_card') {
    if (!parsed.card_id) { addMsg('agent', t('habits.health_card.del.no_id', 'Не зрозумів яку картку видалити.')); return true; }
    const ok = deleteHealthCardProgrammatic(parsed.card_id);
    if (ok) addMsg('agent', t('habits.health_card.del.ok', '🗑️ Картку видалено.'));
    else addMsg('agent', t('habits.health_card.del.not_found', 'Не знайшов картку.'));
    return true;
  }

  if (action === 'delete_allergy') {
    if (!parsed.allergy_id) { addMsg('agent', t('habits.allergy.del.no_id', 'Не зрозумів яку алергію видалити.')); return true; }
    const ok = deleteAllergy(parsed.allergy_id);
    if (ok) addMsg('agent', t('habits.allergy.del.ok', '🗑️ Алергію видалено.'));
    else addMsg('agent', t('habits.allergy.del.not_found', 'Не знайшов алергію.'));
    return true;
  }

  if (action === 'delete_medication') {
    // nliW8 13.05: case у processUniversalAction обов'язковий для DI flow undo
    // (executeReverse шле сюди через action-undo.js, не у tool-dispatcher direct).
    // Урок B-174 — без цього case reverser add_medication → silent fail.
    if (!parsed.card_id || !parsed.med_id) { addMsg('agent', t('habits.medication.del.no_id', 'Не зрозумів який препарат видалити.')); return true; }
    const ok = deleteMedicationFromCard(parsed.card_id, parsed.med_id);
    if (ok) addMsg('agent', t('habits.medication.del.ok', '🗑️ Препарат видалено.'));
    else addMsg('agent', t('habits.medication.del.not_found', 'Не знайшов препарат.'));
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
