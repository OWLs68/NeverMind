// ============================================================
// calendar.js — Календар, події (nm_events), блок "Найближче"
// ============================================================

import { escapeHtml } from '../core/utils.js';
import { getTasks, setupModalSwipeClose } from './tasks.js';

// === EVENTS STORAGE ===
export function getEvents() { return JSON.parse(localStorage.getItem('nm_events') || '[]'); }
export function saveEvents(arr) { localStorage.setItem('nm_events', JSON.stringify(arr)); window.dispatchEvent(new CustomEvent('nm-data-changed', { detail: 'events' })); }

const MONTHS_UA = ['Січень','Лютий','Березень','Квітень','Травень','Червень','Липень','Серпень','Вересень','Жовтень','Листопад','Грудень'];
const MONTHS_OF = ['січня','лютого','березня','квітня','травня','червня','липня','серпня','вересня','жовтня','листопада','грудня'];

// === CALENDAR MODAL ===
let _calYear, _calMonth;

function openCalendarModal() {
  const now = new Date();
  _calYear = now.getFullYear();
  _calMonth = now.getMonth();
  renderCalendar();
  renderUpcoming();
  renderMonthEventsList();
  const modal = document.getElementById('calendar-modal');
  if (modal) {
    modal.style.display = 'flex';
    setupModalSwipeClose(modal.querySelector(':scope > div:last-child'), closeCalendarModal);
  }
}

function closeCalendarModal() {
  const modal = document.getElementById('calendar-modal');
  if (modal) modal.style.display = 'none';
  const eventsModal = document.getElementById('calendar-events-modal');
  if (eventsModal) eventsModal.style.display = 'none';
}

// === EVENTS LIST MODAL (зверху екрану) ===
function renderMonthEventsList() {
  const listEl = document.getElementById('calendar-events-list');
  const modalEl = document.getElementById('calendar-events-modal');
  if (!listEl || !modalEl) return;

  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const monthStart = `${_calYear}-${String(_calMonth + 1).padStart(2, '0')}-01`;
  const monthEnd = `${_calYear}-${String(_calMonth + 1).padStart(2, '0')}-${new Date(_calYear, _calMonth + 1, 0).getDate()}`;

  const items = [];

  getEvents().forEach(ev => {
    if (ev.date >= monthStart && ev.date <= monthEnd) {
      items.push({ title: ev.title, date: ev.date, time: ev.time || null, type: 'event', priority: ev.priority || 'normal' });
    }
  });

  getTasks().filter(t => t.status === 'active' && t.dueDate).forEach(t => {
    if (t.dueDate >= monthStart && t.dueDate <= monthEnd) {
      items.push({ title: t.title, date: t.dueDate, type: 'task', priority: t.priority || 'normal' });
    }
  });

  if (items.length === 0) {
    modalEl.style.display = 'none';
    return;
  }

  items.sort((a, b) => a.date.localeCompare(b.date) || (a.time || '').localeCompare(b.time || ''));

  const prioIcons = { critical: '🔴 ', important: '🟠 ', normal: '' };

  let html = `<div style="font-size:11px;font-weight:800;color:rgba(30,16,64,0.4);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:10px">Події · ${MONTHS_UA[_calMonth]}</div>`;

  items.forEach(item => {
    const d = new Date(item.date + 'T00:00:00');
    const isPast = item.date < todayStr;
    const isToday = item.date === todayStr;
    const dayLabel = isToday ? 'Сьогодні' : `${d.getDate()} ${MONTHS_OF[d.getMonth()]}`;
    const icon = item.type === 'event' ? '📅' : '⏰';
    const prio = prioIcons[item.priority] || '';
    const timeStr = item.time ? ` · ${item.time}` : '';
    const opacity = isPast ? 'opacity:0.4;' : '';
    const dateColor = isToday ? '#ea580c' : item.type === 'event' ? '#6366f1' : 'rgba(30,16,64,0.45)';

    html += `<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid rgba(30,16,64,0.06);${opacity}">
      <div style="font-size:15px;flex-shrink:0">${icon}</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:13.5px;font-weight:600;color:#1e1040;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${prio}${escapeHtml(item.title)}</div>
        <div style="font-size:11px;font-weight:600;color:${dateColor};margin-top:1px">${dayLabel}${timeStr}</div>
      </div>
    </div>`;
  });

  listEl.innerHTML = html;
  modalEl.style.display = 'block';
}

function calendarPrevMonth() { _calMonth--; if (_calMonth < 0) { _calMonth = 11; _calYear--; } renderCalendar(); renderMonthEventsList(); }
function calendarNextMonth() { _calMonth++; if (_calMonth > 11) { _calMonth = 0; _calYear++; } renderCalendar(); renderMonthEventsList(); }

// === UPCOMING BLOCK (Найближче) ===
function renderUpcoming() {
  const el = document.getElementById('calendar-upcoming');
  if (!el) return;

  const now = new Date();
  const todayStr = now.toDateString();
  const in7days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const items = [];

  // Events on next 7 days
  getEvents().forEach(ev => {
    const d = new Date(ev.date);
    if (d >= new Date(now.toDateString()) && d <= in7days) {
      items.push({ title: ev.title, date: d, type: 'event', priority: ev.priority || 'normal', time: ev.time || null });
    }
  });

  // Tasks with dueDate in next 7 days
  getTasks().filter(t => t.status === 'active' && t.dueDate).forEach(t => {
    const d = new Date(t.dueDate);
    if (d >= new Date(now.toDateString()) && d <= in7days) {
      items.push({ title: t.title, date: d, type: 'task', priority: t.priority || 'normal' });
    }
  });

  items.sort((a, b) => a.date - b.date);

  if (items.length === 0) {
    el.style.display = 'none';
    return;
  }

  const prioColors = { critical: '#ef4444', important: '#ea580c', normal: 'rgba(30,16,64,0.4)' };
  const prioIcons = { critical: '🔴', important: '🟠', normal: '' };

  el.style.display = 'block';
  el.innerHTML = `<div style="font-size:11px;font-weight:800;color:rgba(30,16,64,0.4);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:10px">Найближче</div>` +
    items.map(item => {
      const isToday = item.date.toDateString() === todayStr;
      const dayLabel = isToday ? 'Сьогодні' : `${item.date.getDate()} ${MONTHS_OF[item.date.getMonth()]}`;
      const icon = item.type === 'event' ? '📅' : '☑️';
      const prio = prioIcons[item.priority] || '';
      const timeStr = item.time ? ` · ${item.time}` : '';
      return `<div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid rgba(30,16,64,0.06)">
        <div style="font-size:16px;flex-shrink:0">${icon}</div>
        <div style="flex:1">
          <div style="font-size:14px;font-weight:600;color:#1e1040">${prio} ${escapeHtml(item.title)}</div>
          <div style="font-size:11px;font-weight:600;color:${prioColors[item.priority]};margin-top:1px">${dayLabel}${timeStr}</div>
        </div>
      </div>`;
    }).join('');
}

// === CALENDAR GRID ===
function renderCalendar() {
  const label = document.getElementById('calendar-month-label');
  const grid = document.getElementById('calendar-grid');
  const dayDetails = document.getElementById('calendar-day-tasks');
  if (!label || !grid) return;

  label.textContent = `${MONTHS_UA[_calMonth]} ${_calYear}`;
  if (dayDetails) dayDetails.style.display = 'none';

  const firstDay = new Date(_calYear, _calMonth, 1);
  const firstDow = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(_calYear, _calMonth + 1, 0).getDate();
  const today = new Date();
  const isCurrentMonth = _calYear === today.getFullYear() && _calMonth === today.getMonth();

  // Collect tasks and events per day
  const itemsByDay = {};
  const addItem = (day, item) => { if (!itemsByDay[day]) itemsByDay[day] = []; itemsByDay[day].push(item); };

  getTasks().forEach(t => {
    if (t.dueDate) {
      const d = new Date(t.dueDate);
      if (d.getFullYear() === _calYear && d.getMonth() === _calMonth) addItem(d.getDate(), { ...t, _type: 'task' });
    }
    if (t.createdAt) {
      const d = new Date(t.createdAt);
      if (d.getFullYear() === _calYear && d.getMonth() === _calMonth) {
        const day = d.getDate();
        if (!itemsByDay[day]?.some(x => x.id === t.id)) addItem(day, { ...t, _type: 'task' });
      }
    }
  });

  getEvents().forEach(ev => {
    const d = new Date(ev.date);
    if (d.getFullYear() === _calYear && d.getMonth() === _calMonth) addItem(d.getDate(), { ...ev, _type: 'event' });
  });

  let cells = '';
  for (let i = 0; i < firstDow; i++) cells += '<div></div>';
  for (let d = 1; d <= daysInMonth; d++) {
    const isToday = isCurrentMonth && d === today.getDate();
    const dayItems = itemsByDay[d] || [];
    const hasItems = dayItems.length > 0;
    const hasEvent = dayItems.some(x => x._type === 'event');
    const hasCritical = dayItems.some(x => x.priority === 'critical');
    const hasImportant = dayItems.some(x => x.priority === 'important');

    let bg = 'rgba(30,16,64,0.04)';
    let color = 'rgba(30,16,64,0.35)';
    let border = 'transparent';
    let dot = '';

    if (isToday) { bg = '#ea580c'; color = 'white'; border = '#ea580c'; }
    else if (hasCritical) { bg = 'rgba(239,68,68,0.15)'; color = '#ef4444'; border = 'rgba(239,68,68,0.3)'; }
    else if (hasImportant) { bg = 'rgba(234,88,12,0.12)'; color = '#ea580c'; border = 'rgba(234,88,12,0.25)'; }
    else if (hasEvent) { bg = 'rgba(99,102,241,0.12)'; color = '#6366f1'; border = 'rgba(99,102,241,0.25)'; }
    else if (hasItems) { bg = 'rgba(30,16,64,0.1)'; color = '#1e1040'; }

    if (hasItems && !isToday) dot = `<div style="width:4px;height:4px;border-radius:50%;background:${hasEvent ? '#6366f1' : 'currentColor'};margin-top:1px"></div>`;

    cells += `<div onclick="calendarDayTap(${d})" style="aspect-ratio:1;border-radius:8px;display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:13px;font-weight:700;background:${bg};color:${color};border:1.5px solid ${border};cursor:pointer;transition:all 0.15s">${d}${dot}</div>`;
  }
  grid.innerHTML = cells;
}

// === DAY TAP ===
function calendarDayTap(day) {
  const el = document.getElementById('calendar-day-tasks');
  if (!el) return;

  const dateStr = new Date(_calYear, _calMonth, day).toDateString();

  const tasks = getTasks().filter(t => {
    if (t.dueDate && new Date(t.dueDate).toDateString() === dateStr) return true;
    if (t.createdAt && new Date(t.createdAt).toDateString() === dateStr) return true;
    return false;
  });

  const events = getEvents().filter(ev => new Date(ev.date).toDateString() === dateStr);

  if (tasks.length === 0 && events.length === 0) {
    el.style.display = 'block';
    el.innerHTML = `<div style="text-align:center;font-size:13px;color:rgba(30,16,64,0.35);padding:12px 0">Немає записів на ${day} ${MONTHS_OF[_calMonth]}</div>`;
    return;
  }

  const prioColors = { critical: '#ef4444', important: '#ea580c' };
  let html = `<div style="font-size:11px;font-weight:800;color:rgba(30,16,64,0.4);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px">${day} ${MONTHS_OF[_calMonth]}</div>`;

  // Events first
  events.forEach(ev => {
    const timeStr = ev.time ? `${ev.time} · ` : '';
    const prio = ev.priority === 'critical' ? '🔴 ' : ev.priority === 'important' ? '🟠 ' : '';
    html += `<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid rgba(30,16,64,0.06)">
      <div style="font-size:16px;flex-shrink:0">📅</div>
      <div style="flex:1;font-size:14px;font-weight:600;color:#6366f1">${prio}${timeStr}${escapeHtml(ev.title)}</div>
    </div>`;
  });

  // Tasks
  tasks.forEach(t => {
    const isDone = t.status === 'done';
    const prioColor = prioColors[t.priority] || '';
    const dueLabel = t.dueDate ? ' 📅' : '';
    html += `<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid rgba(30,16,64,0.06)">
      <div style="width:20px;height:20px;border-radius:6px;border:2px solid ${isDone ? '#16a34a' : (prioColor || 'rgba(30,16,64,0.2)')};background:${isDone ? '#16a34a' : 'transparent'};display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:11px;color:white">${isDone ? '✓' : ''}</div>
      <div style="flex:1;font-size:14px;font-weight:600;color:${isDone ? 'rgba(30,16,64,0.3)' : '#1e1040'};${isDone ? 'text-decoration:line-through' : ''}">${escapeHtml(t.title)}${dueLabel}</div>
    </div>`;
  });

  el.style.display = 'block';
  el.innerHTML = html;
}

// ============================================================
// ROUTINE — Розпорядок дня
// nm_routine = { default: [{time,activity}], mon: [...], ... }
// ============================================================
const NM_ROUTINE_KEY = 'nm_routine';
const DAY_KEYS = ['sun','mon','tue','wed','thu','fri','sat'];
const DAY_LABELS = ['Нд','Пн','Вт','Ср','Чт','Пт','Сб'];
let _routineDay = DAY_KEYS[new Date().getDay()]; // поточний день

export function getRoutine() {
  try { return JSON.parse(localStorage.getItem(NM_ROUTINE_KEY) || '{}'); } catch { return {}; }
}
export function saveRoutine(obj) {
  localStorage.setItem(NM_ROUTINE_KEY, JSON.stringify(obj));
  window.dispatchEvent(new CustomEvent('nm-data-changed', { detail: 'routine' }));
}

// Отримати розклад на конкретний день (fallback → default)
export function getRoutineForDay(dayKey) {
  const r = getRoutine();
  return r[dayKey] || r['default'] || [];
}

// Отримати розклад на сьогодні (для AI контексту)
export function getTodayRoutine() {
  return getRoutineForDay(DAY_KEYS[new Date().getDay()]);
}

function openRoutineModal() {
  _routineDay = DAY_KEYS[new Date().getDay()];
  _renderRoutineDayTabs();
  _renderRoutineTimeline();
  const modal = document.getElementById('routine-modal');
  if (modal) {
    modal.style.display = 'flex';
    setupModalSwipeClose(modal.querySelector(':scope > div:last-child'), closeRoutineModal);
  }
}

function closeRoutineModal() {
  const modal = document.getElementById('routine-modal');
  if (modal) modal.style.display = 'none';
}

function _renderRoutineDayTabs() {
  const el = document.getElementById('routine-day-tabs');
  if (!el) return;
  const routine = getRoutine();
  const todayIdx = new Date().getDay();
  el.innerHTML = DAY_KEYS.map((key, i) => {
    const isActive = key === _routineDay;
    const isToday = i === todayIdx;
    const hasOwn = !!routine[key];
    return `<div onclick="routineSelectDay('${key}')" style="padding:6px 10px;border-radius:10px;font-size:12px;font-weight:${isActive ? '800' : '600'};cursor:pointer;white-space:nowrap;
      background:${isActive ? '#ea580c' : 'rgba(255,255,255,0.5)'};
      color:${isActive ? 'white' : isToday ? '#ea580c' : 'rgba(30,16,64,0.5)'};
      border:1.5px solid ${isActive ? '#ea580c' : isToday ? 'rgba(234,88,12,0.3)' : 'rgba(30,16,64,0.08)'};
      ${hasOwn && !isActive ? 'box-shadow:inset 0 -2px 0 rgba(234,88,12,0.3);' : ''}
      ">${DAY_LABELS[i]}</div>`;
  }).join('');
  const label = document.getElementById('routine-day-label');
  if (label) label.textContent = _routineDay === DAY_KEYS[todayIdx] ? 'сьогодні' : '';
}

function _renderRoutineTimeline() {
  const el = document.getElementById('routine-timeline');
  if (!el) return;
  const blocks = getRoutineForDay(_routineDay);
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const isToday = DAY_KEYS[now.getDay()] === _routineDay;

  if (blocks.length === 0) {
    el.innerHTML = `<div style="text-align:center;padding:32px 0;color:rgba(30,16,64,0.3);font-size:14px">
      Розпорядок порожній.<br>Натисни «+ Додати блок» або напиши в чат:<br>
      <span style="color:rgba(234,88,12,0.6);font-weight:600">"Мій розклад: 7 підйом, 9 робота, 18 зал"</span>
    </div>`;
    return;
  }

  const sorted = [...blocks].sort((a, b) => a.time.localeCompare(b.time));
  el.innerHTML = sorted.map((b, i) => {
    const [h, m] = b.time.split(':').map(Number);
    const blockMin = h * 60 + (m || 0);
    const nextBlock = sorted[i + 1];
    const nextMin = nextBlock ? parseInt(nextBlock.time.split(':')[0]) * 60 + (parseInt(nextBlock.time.split(':')[1]) || 0) : 24 * 60;
    const isCurrent = isToday && nowMin >= blockMin && nowMin < nextMin;
    const isPast = isToday && nowMin >= nextMin;
    return `<div style="display:flex;align-items:flex-start;gap:12px;padding:10px 0;${isPast ? 'opacity:0.4;' : ''}${isCurrent ? 'background:rgba(234,88,12,0.06);border-radius:12px;padding:10px 8px;margin:0 -8px;' : ''}">
      <div style="width:46px;flex-shrink:0;font-size:14px;font-weight:700;color:${isCurrent ? '#ea580c' : '#1e1040'};text-align:right">${b.time}</div>
      <div style="width:8px;height:8px;border-radius:50%;margin-top:5px;flex-shrink:0;background:${isCurrent ? '#ea580c' : isPast ? 'rgba(30,16,64,0.15)' : 'rgba(234,88,12,0.35)'}"></div>
      <div style="flex:1;display:flex;align-items:center;justify-content:space-between">
        <div style="font-size:14px;font-weight:${isCurrent ? '700' : '500'};color:${isCurrent ? '#ea580c' : '#1e1040'}">${escapeHtml(b.activity)}${isCurrent ? ' ←' : ''}</div>
        <div onclick="routineDeleteBlock(${i})" style="font-size:16px;color:rgba(30,16,64,0.2);cursor:pointer;padding:0 4px">×</div>
      </div>
    </div>`;
  }).join('');
}

function routineSelectDay(dayKey) {
  _routineDay = dayKey;
  _renderRoutineDayTabs();
  _renderRoutineTimeline();
}

function routineAddBlock() {
  const wrap = document.getElementById('routine-add-wrap');
  if (!wrap) return;
  // Показуємо inline форму замість prompt()
  wrap.innerHTML = `
    <div style="background:rgba(255,255,255,0.6);border-radius:16px;padding:14px;border:1.5px solid rgba(234,88,12,0.2)">
      <div style="display:flex;gap:10px;margin-bottom:10px">
        <input type="time" id="routine-add-time" value="09:00"
          style="flex:0 0 110px;padding:10px 8px;border-radius:12px;border:1.5px solid rgba(30,16,64,0.15);font-size:16px;font-weight:600;color:#1e1040;background:white;-webkit-appearance:none">
        <input type="text" id="routine-add-activity" placeholder="Що робити..." maxlength="40"
          style="flex:1;min-width:0;padding:10px 12px;border-radius:12px;border:1.5px solid rgba(30,16,64,0.15);font-size:15px;color:#1e1040;background:white">
      </div>
      <div style="display:flex;gap:8px">
        <button onclick="routineSaveNewBlock()" style="flex:1;padding:10px;border-radius:12px;border:none;background:#ea580c;color:white;font-size:14px;font-weight:700;cursor:pointer">Зберегти</button>
        <button onclick="routineCancelAdd()" style="flex:1;padding:10px;border-radius:12px;border:1.5px solid rgba(30,16,64,0.12);background:none;color:rgba(30,16,64,0.5);font-size:14px;font-weight:600;cursor:pointer">Скасувати</button>
      </div>
    </div>`;
  // Фокус на поле активності
  setTimeout(() => document.getElementById('routine-add-activity')?.focus(), 100);
}

function routineSaveNewBlock() {
  const timeInput = document.getElementById('routine-add-time');
  const actInput = document.getElementById('routine-add-activity');
  if (!timeInput || !actInput) return;
  const time = timeInput.value;
  const activity = actInput.value.trim();
  if (!time || !activity) return;
  const routine = getRoutine();
  if (!routine[_routineDay]) routine[_routineDay] = [...(routine['default'] || [])];
  routine[_routineDay].push({ time, activity });
  saveRoutine(routine);
  _renderRoutineTimeline();
  routineCancelAdd();
}

function routineCancelAdd() {
  const wrap = document.getElementById('routine-add-wrap');
  if (!wrap) return;
  wrap.innerHTML = `<button onclick="routineAddBlock()" style="width:100%;padding:12px;border-radius:14px;border:2px dashed rgba(234,88,12,0.25);background:none;font-size:14px;font-weight:600;color:rgba(234,88,12,0.6);cursor:pointer">+ Додати блок</button>`;
}

function routineDeleteBlock(idx) {
  const routine = getRoutine();
  const blocks = routine[_routineDay] || routine['default'] || [];
  if (!routine[_routineDay]) routine[_routineDay] = [...blocks];
  routine[_routineDay].splice(idx, 1);
  if (routine[_routineDay].length === 0) delete routine[_routineDay];
  saveRoutine(routine);
  _renderRoutineTimeline();
}

// === WINDOW EXPORTS ===
Object.assign(window, {
  openCalendarModal, closeCalendarModal, calendarPrevMonth, calendarNextMonth, calendarDayTap,
  openRoutineModal, closeRoutineModal, routineSelectDay, routineAddBlock, routineDeleteBlock, routineSaveNewBlock, routineCancelAdd,
});
