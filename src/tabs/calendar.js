// ============================================================
// calendar.js — Календар, події (nm_events), блок "Найближче"
// ============================================================

import { escapeHtml, t } from '../core/utils.js';
import { getTasks, setupModalSwipeClose } from './tasks.js';
import { addToTrash, showUndoToast } from '../core/trash.js';
import { monthNominative, monthGenitive, monthShort } from '../data/months.js';

// === EVENTS STORAGE ===
export function getEvents() { return JSON.parse(localStorage.getItem('nm_events') || '[]'); }
export function saveEvents(arr) { localStorage.setItem('nm_events', JSON.stringify(arr)); window.dispatchEvent(new CustomEvent('nm-data-changed', { detail: 'events' })); }

// === DEDUP HELPER (B-103, qG4fj 25.04) ===
// Перевіряє чи вже є подія з тією ж датою+часом+назвою за останні 60 сек.
// Захищає від дублів коли AI повертає 2 create_event tool_calls у одній відповіді
// або юзер двічі тапнув до отримання відповіді.
// Повертає { added: true, event } якщо додано, { added: false, existing } якщо дубль.
export function addEventDedup(ev) {
  const events = getEvents();
  const now = Date.now();
  const newTitle = (ev.title || '').toLowerCase().trim();
  const newTime = ev.time || null;

  const existing = events.find(e => {
    if (e.date !== ev.date) return false;
    if ((e.time || null) !== newTime) return false;
    if ((e.title || '').toLowerCase().trim() !== newTitle) return false;
    const age = now - (e.createdAt || 0);
    return age < 60_000;
  });

  if (existing) return { added: false, existing };

  events.unshift(ev);
  saveEvents(events);
  return { added: true, event: ev };
}

// === RECURRING SERIES (Фаза 2) ===
// Генерує N копій події через 7 днів кожна. Усі копії одержують спільний recurringId
// (timestamp ID першої події) — це дозволяє згрупувати, але не блокує редагування
// окремих копій (кожна — звичайна подія, edit/delete працює як зараз).
// Повертає масив створених подій (без першої — вона вже у sourceEvent).
export function generateWeeklySeries(sourceEvent, weeks = 12) {
  if (!sourceEvent || !sourceEvent.date) return [];
  const recurringId = sourceEvent.recurringId || sourceEvent.id;
  const events = getEvents();
  const created = [];
  const baseDate = new Date(sourceEvent.date + 'T00:00:00');
  for (let i = 1; i < weeks; i++) {
    const next = new Date(baseDate.getTime() + i * 7 * 86400000);
    const dateISO = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`;
    const copy = {
      id: Date.now() + i,
      title: sourceEvent.title,
      date: dateISO,
      time: sourceEvent.time || null,
      endTime: sourceEvent.endTime || null,
      priority: sourceEvent.priority || 'normal',
      recurringId,
      createdAt: Date.now() + i,
    };
    events.push(copy);
    created.push(copy);
  }
  // Прив'язати recurringId до першої події (sourceEvent у сховищі)
  const idx = events.findIndex(e => e.id === sourceEvent.id);
  if (idx !== -1 && !events[idx].recurringId) events[idx].recurringId = recurringId;
  saveEvents(events);
  return created;
}

// Місяці — через canonical довідник src/data/months.js (monthNominative / monthGenitive / monthShort).

// === CALENDAR MODAL ===
let _calYear, _calMonth;

// === Zoom-анімація для модалок ===
function _zoomIn(panelId) {
  const panel = document.getElementById(panelId);
  if (!panel) return;
  requestAnimationFrame(() => { panel.style.transform = 'scale(1)'; panel.style.opacity = '1'; });
}
function _zoomOut(panelId, modalId, cb) {
  const panel = document.getElementById(panelId);
  const modal = document.getElementById(modalId);
  if (panel) { panel.style.transform = 'scale(0)'; panel.style.opacity = '0'; }
  setTimeout(() => { if (modal) modal.style.display = 'none'; if (cb) cb(); }, 300);
}

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
    _zoomIn('calendar-panel');
    setupModalSwipeClose(document.getElementById('calendar-panel'), closeCalendarModal);
  }
}

function closeCalendarModal() {
  _zoomOut('calendar-panel', 'calendar-modal');
}

// === EVENTS LIST (всередині calendar modal) ===
function renderMonthEventsList() {
  const listEl = document.getElementById('calendar-events-list');
  if (!listEl) return;

  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const monthStart = `${_calYear}-${String(_calMonth + 1).padStart(2, '0')}-01`;
  const monthEnd = `${_calYear}-${String(_calMonth + 1).padStart(2, '0')}-${new Date(_calYear, _calMonth + 1, 0).getDate()}`;

  const items = [];

  getEvents().forEach(ev => {
    if (ev.date >= monthStart && ev.date <= monthEnd) {
      items.push({ id: ev.id, title: ev.title, date: ev.date, time: ev.time || null, endTime: ev.endTime || null, type: 'event', priority: ev.priority || 'normal' });
    }
  });

  getTasks().filter(t => t.status === 'active' && t.dueDate).forEach(t => {
    if (t.dueDate >= monthStart && t.dueDate <= monthEnd) {
      items.push({ title: t.title, date: t.dueDate, type: 'task', priority: t.priority || 'normal' });
    }
  });

  if (items.length === 0) {
    listEl.style.display = 'none';
    return;
  }

  // Варіант A (узгоджено ZJmdF 22.04): сьогодні → майбутні (за зростанням) → минулі (за спаданням)
  const bucket = (d) => d === todayStr ? 0 : d > todayStr ? 1 : 2;
  items.sort((a, b) => {
    const ba = bucket(a.date), bb = bucket(b.date);
    if (ba !== bb) return ba - bb;
    // у минулому — свіже зверху (спадання), інакше — зростання
    const cmp = ba === 2 ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date);
    if (cmp !== 0) return cmp;
    const ta = a.time || '', tb = b.time || '';
    return ba === 2 ? tb.localeCompare(ta) : ta.localeCompare(tb);
  });

  const prioIcons = { critical: '🔴 ', important: '🟠 ', normal: '' };

  let html = `<div style="font-size:11px;font-weight:800;color:rgba(30,16,64,0.4);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:10px">Події · ${monthNominative(_calMonth)}</div>`;

  items.forEach(item => {
    const d = new Date(item.date + 'T00:00:00');
    const isPast = item.date < todayStr;
    const isToday = item.date === todayStr;
    const dayLabel = isToday ? 'Сьогодні' : `${d.getDate()} ${monthGenitive(d.getMonth())}`;
    const icon = item.type === 'event' ? '📅' : '⏰';
    const prio = prioIcons[item.priority] || '';
    const timeStr = item.time ? ` · ${item.time}${item.endTime ? '–' + item.endTime : ''}` : '';
    const opacity = isPast ? 'opacity:0.4;' : '';
    const dateColor = isToday ? '#ea580c' : item.type === 'event' ? '#3b82f6' : 'rgba(30,16,64,0.45)';

    const tapAttr = item.type === 'event' && item.id ? `onclick="openEventEditModal(${item.id})" style="cursor:pointer;` : `style="`;
    html += `<div ${tapAttr}display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid rgba(30,16,64,0.06);${opacity}">
      <div style="font-size:15px;flex-shrink:0">${icon}</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:13.5px;font-weight:600;color:#1e1040;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${prio}${escapeHtml(item.title)}</div>
        <div style="font-size:11px;font-weight:600;color:${dateColor};margin-top:1px">${dayLabel}${timeStr}</div>
      </div>
    </div>`;
  });

  listEl.innerHTML = html;
  listEl.style.display = 'block';
}

function calendarPrevMonth() { _calMonth--; if (_calMonth < 0) { _calMonth = 11; _calYear--; } _selectedDay = null; renderCalendar(); renderMonthEventsList(); }
function calendarNextMonth() { _calMonth++; if (_calMonth > 11) { _calMonth = 0; _calYear++; } _selectedDay = null; renderCalendar(); renderMonthEventsList(); }

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
      items.push({ id: ev.id, title: ev.title, date: d, type: 'event', priority: ev.priority || 'normal', time: ev.time || null, endTime: ev.endTime || null });
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
      const dayLabel = isToday ? 'Сьогодні' : `${item.date.getDate()} ${monthGenitive(item.date.getMonth())}`;
      const icon = item.type === 'event' ? '📅' : '☑️';
      const prio = prioIcons[item.priority] || '';
      const timeStr = item.time ? ` · ${item.time}${item.endTime ? '–' + item.endTime : ''}` : '';
      const tapAttr = item.type === 'event' && item.id ? `onclick="openEventEditModal(${item.id})" ` : '';
      return `<div ${tapAttr}style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid rgba(30,16,64,0.06);${tapAttr ? 'cursor:pointer;' : ''}">
        <div style="font-size:16px;flex-shrink:0">${icon}</div>
        <div style="flex:1">
          <div style="font-size:14px;font-weight:600;color:#1e1040">${prio} ${escapeHtml(item.title)}</div>
          <div style="font-size:11px;font-weight:600;color:${prioColors[item.priority]};margin-top:1px">${dayLabel}${timeStr}</div>
        </div>
      </div>`;
    }).join('');
}

// === CALENDAR GRID ===
let _selectedDay = null;

function renderCalendar() {
  const label = document.getElementById('calendar-month-label');
  const grid = document.getElementById('calendar-grid');
  const dayDetails = document.getElementById('calendar-day-tasks');
  if (!label || !grid) return;

  label.textContent = `${monthNominative(_calMonth)} ${_calYear}`;
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

    const isSelected = _selectedDay === d && !isToday;

    if (isToday) { bg = '#ea580c'; color = 'white'; border = '#ea580c'; }
    else if (isSelected) { bg = 'rgba(234,88,12,0.18)'; color = '#ea580c'; border = '#ea580c'; }
    else if (hasCritical) { bg = 'rgba(239,68,68,0.15)'; color = '#ef4444'; border = 'rgba(239,68,68,0.3)'; }
    else if (hasImportant) { bg = 'rgba(234,88,12,0.12)'; color = '#ea580c'; border = 'rgba(234,88,12,0.25)'; }
    else if (hasEvent) { bg = 'rgba(59,130,246,0.15)'; color = '#1e1040'; border = 'rgba(59,130,246,0.45)'; }
    else if (hasItems) { bg = 'rgba(30,16,64,0.1)'; color = '#1e1040'; }

    if (hasItems && !isToday) dot = `<div style="width:4px;height:4px;border-radius:50%;background:${hasEvent ? '#3b82f6' : 'currentColor'};margin-top:1px"></div>`;

    const cls = hasEvent ? ' class="cal-day-event"' : '';
    cells += `<div${cls} onclick="calendarDayTap(${d})" data-day="${d}" style="aspect-ratio:1;border-radius:8px;display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:13px;font-weight:700;background:${bg};color:${color};border:1.5px solid ${border};cursor:pointer;transition:all 0.15s;-webkit-tap-highlight-color:transparent" ontouchstart="this.style.transform='scale(0.88)'" ontouchend="this.style.transform=''">${d}${dot}</div>`;
  }
  grid.innerHTML = cells;
}

// === HIGHLIGHT EVENT DAYS (rJYkw 21.04.2026) ===
// Додає пульсацію на клітинки з подіями коли юзер питає "які події заплановані".
// Знімається через 8 сек або при тапі на день (через renderCalendar після selectedDay).
// Клас .cal-day-event-pulse — CSS keyframes у style.css.
export function highlightEventDays() {
  const cells = document.querySelectorAll('#calendar-grid .cal-day-event');
  if (cells.length === 0) return;
  cells.forEach(c => c.classList.add('cal-day-event-pulse'));
  // Самознаття через 8 сек — не відволікати юзера надовго
  setTimeout(() => {
    cells.forEach(c => c.classList.remove('cal-day-event-pulse'));
  }, 8000);
}

// === DAY TAP → модалка розкладу дня ===
const DAYS_UA_FULL = ['Неділя','Понеділок','Вівторок','Середа','Четвер','П\'ятниця','Субота'];

function calendarDayTap(day) {
  _selectedDay = day;
  renderCalendar();
  _openDayScheduleModal(day);
}

function _openDayScheduleModal(day) {
  const date = new Date(_calYear, _calMonth, day);
  const dateISO = `${_calYear}-${String(_calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const dayKey = DAY_KEYS[date.getDay()];

  // Заголовок
  const titleEl = document.getElementById('day-schedule-title');
  if (titleEl) titleEl.textContent = `${day} ${monthGenitive(_calMonth)} · ${DAYS_UA_FULL[date.getDay()]}`;

  // Events на цей день
  const dayEvents = getEvents().filter(ev => ev.date === dateISO);
  const allDayEvents = dayEvents.filter(ev => !ev.time);
  const timedEvents = dayEvents.filter(ev => ev.time);

  // Tasks на цей день (по dueDate або createdAt)
  const dateStr = date.toDateString();
  const dayTasks = getTasks().filter(t => {
    if (t.dueDate && new Date(t.dueDate).toDateString() === dateStr) return true;
    if (t.createdAt && new Date(t.createdAt).toDateString() === dateStr) return true;
    return false;
  });

  // Routine blocks на цей день тижня
  const routineBlocks = getRoutineForDay(dayKey);

  // All-day events (події без часу) — зверху
  const alldayEl = document.getElementById('day-schedule-allday');
  if (alldayEl) {
    if (allDayEvents.length > 0) {
      alldayEl.style.display = 'block';
      alldayEl.innerHTML = allDayEvents.map(ev => {
        const prio = ev.priority === 'critical' ? '🔴 ' : ev.priority === 'important' ? '🟠 ' : '';
        return `<div onclick="openEventEditModal(${ev.id})" style="display:flex;align-items:center;gap:10px;padding:8px 4px;cursor:pointer;border-radius:10px;background:rgba(59,130,246,0.10)">
          <div style="font-size:15px;flex-shrink:0">📅</div>
          <div style="flex:1;font-size:14px;font-weight:600;color:#3b82f6">${prio}${escapeHtml(ev.title)}</div>
          <div style="font-size:11px;color:rgba(30,16,64,0.35);font-weight:600">весь день</div>
        </div>`;
      }).join('');
    } else {
      alldayEl.style.display = 'none';
    }
  }

  // Об'єднаний таймлайн: routine + timed events + tasks з dueDate
  const timeline = [];
  routineBlocks.forEach(b => timeline.push({ time: b.time, text: b.activity, type: 'routine' }));
  timedEvents.forEach(ev => timeline.push({ time: ev.time, endTime: ev.endTime || null, text: ev.title, type: 'event', id: ev.id, priority: ev.priority }));
  dayTasks.forEach(t => {
    // Задачі з часом у назві (HH:MM)
    const m = t.title.match(/(\d{1,2}):(\d{2})/);
    const time = m ? `${String(m[1]).padStart(2,'0')}:${m[2]}` : null;
    timeline.push({ time, text: t.title, type: 'task', priority: t.priority, done: t.status === 'done', dueDate: t.dueDate });
  });
  // Задачі без часу — внизу
  const timedItems = timeline.filter(i => i.time).sort((a, b) => a.time.localeCompare(b.time));
  const untimedTasks = timeline.filter(i => !i.time && i.type === 'task');

  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const nowMin = now.getHours() * 60 + now.getMinutes();

  const timelineEl = document.getElementById('day-schedule-timeline');
  if (timelineEl) {
    if (timedItems.length === 0 && untimedTasks.length === 0 && allDayEvents.length === 0) {
      timelineEl.innerHTML = `<div style="text-align:center;font-size:14px;color:rgba(30,16,64,0.3);padding:24px 0">Немає подій</div>`;
    } else {
      let html = '';
      timedItems.forEach((item, i) => {
        const [h, m] = item.time.split(':').map(Number);
        const itemMin = h * 60 + (m || 0);
        const next = timedItems[i + 1];
        const nextMin = next ? parseInt(next.time.split(':')[0]) * 60 + (parseInt(next.time.split(':')[1]) || 0) : 24 * 60;
        const isCurrent = isToday && nowMin >= itemMin && nowMin < nextMin;
        const isPast = isToday && nowMin >= nextMin;

        const isEvent = item.type === 'event';
        const isTask = item.type === 'task';
        const isDone = item.done;
        const color = isDone ? 'rgba(30,16,64,0.3)' : isEvent ? '#3b82f6' : isCurrent ? '#ea580c' : '#1e1040';
        const icon = isEvent ? '📅' : isTask ? (isDone ? '✅' : '☑️') : '';
        const prio = (item.priority === 'critical') ? '🔴 ' : (item.priority === 'important') ? '🟠 ' : '';
        const strike = isDone ? 'text-decoration:line-through;' : '';
        let tapAttr;
        if (isEvent && item.id) tapAttr = `onclick="openEventEditModal(${item.id})" style="cursor:pointer;`;
        else if (item.type === 'routine') tapAttr = `onclick="openRoutineFromCalendar('${dayKey}')" style="cursor:pointer;`;
        else tapAttr = `style="`;

        const timeLabel = item.endTime ? `${item.time}<br><span style="font-size:11px;font-weight:500;color:rgba(30,16,64,0.4)">${item.endTime}</span>` : item.time;
        html += `<div ${tapAttr}display:flex;align-items:flex-start;gap:12px;padding:10px 0;${isPast ? 'opacity:0.4;' : ''}${isCurrent ? 'background:rgba(234,88,12,0.06);border-radius:12px;padding:10px 8px;margin:0 -8px;' : ''}">
          <div style="width:46px;flex-shrink:0;font-size:14px;font-weight:700;color:${isCurrent ? '#ea580c' : 'rgba(30,16,64,0.5)'};text-align:right;line-height:1.2">${timeLabel}</div>
          <div style="width:8px;height:8px;border-radius:50%;margin-top:5px;flex-shrink:0;background:${isEvent ? '#3b82f6' : isCurrent ? '#ea580c' : isPast ? 'rgba(30,16,64,0.15)' : 'rgba(234,88,12,0.35)'}"></div>
          <div style="flex:1;font-size:14px;font-weight:${isCurrent ? '700' : '500'};color:${color};${strike}">${icon ? icon + ' ' : ''}${prio}${escapeHtml(item.text)}${isCurrent ? ' ←' : ''}${isTask && item.dueDate ? ' 📅' : ''}</div>
        </div>`;
      });

      // Задачі без часу — внизу
      if (untimedTasks.length > 0) {
        html += `<div style="margin-top:12px;padding-top:12px;border-top:1px solid rgba(30,16,64,0.08)">`;
        html += `<div style="font-size:11px;font-weight:800;color:rgba(30,16,64,0.4);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px">Задачі</div>`;
        untimedTasks.forEach(t => {
          const prio = (t.priority === 'critical') ? '🔴 ' : (t.priority === 'important') ? '🟠 ' : '';
          const doneStyle = t.done ? 'color:rgba(30,16,64,0.3);text-decoration:line-through;' : 'color:#1e1040;';
          html += `<div style="display:flex;align-items:center;gap:10px;padding:6px 0">
            <div style="font-size:14px">${t.done ? '✅' : '☑️'}</div>
            <div style="font-size:14px;font-weight:500;${doneStyle}">${prio}${escapeHtml(t.text)}${t.dueDate ? ' 📅' : ''}</div>
          </div>`;
        });
        html += `</div>`;
      }

      timelineEl.innerHTML = html;
    }
  }

  // Відкриваємо модалку з анімацією zoom з центру
  const modal = document.getElementById('day-schedule-modal');
  const panel = document.getElementById('day-schedule-panel');
  if (modal && panel) {
    modal.style.display = 'flex';
    _zoomIn('day-schedule-panel');
    setupModalSwipeClose(panel, closeDayScheduleModal);
  }
}

function closeDayScheduleModal() {
  _zoomOut('day-schedule-panel', 'day-schedule-modal');
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

// ============================================================
// QDIGl 04.05 — Combined timeline для модалки Розпорядку.
// Об'єднує 3 джерела на конкретну ДАТУ (не день тижня):
//   - nm_routine[dayKey] — recurring blocks (recurring weekly schedule)
//   - nm_events.filter(date===dateISO) — one-off events
//   - nm_events.filter(date===dateISO && source==='reminder') — нагадування
// nm_routine storage НЕ змінюємо — AI tool save_routine + ai-context
// зав'язані на dayKey enum, тому per-date overrides — окремий шар у v2.
// ============================================================

// Локальний (не UTC) маппінг ISO дати на dayKey. Уникаємо new Date(iso)
// бо у TZ<0 UTC midnight зміщує день на попередній.
function _dateToKey(dateISO) {
  if (!dateISO || typeof dateISO !== 'string') return DAY_KEYS[new Date().getDay()];
  const m = dateISO.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return DAY_KEYS[new Date().getDay()];
  const [, y, mo, d] = m;
  return DAY_KEYS[new Date(+y, +mo - 1, +d).getDay()];
}

function _todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function _toMin(time) {
  if (!time || typeof time !== 'string') return -1;
  const [h, m] = time.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

// Чи блок у минулому ЛИШЕ якщо це сьогодні І час уже пройшов.
function _isBlockPast(time, dateISO) {
  if (!time) return false;
  const today = _todayISO();
  if (dateISO < today) return true;   // вся минула дата
  if (dateISO > today) return false;  // майбутня
  const now = new Date();
  return _toMin(time) <= now.getHours() * 60 + now.getMinutes();
}

// Повертає масив блоків відсортованих за часом, потім за kind (routine→event→reminder).
// Кожен блок: {time, activity, kind, sourceId|sourceIdx, isPast, reminderId?, _ev?}
// Виконані прострочені reminders (event.done && minute<now) — фільтруються out.
export function getCombinedTimelineForDate(dateISO) {
  const out = [];
  const dayKey = _dateToKey(dateISO);

  // 1. Routine — recurring блоки
  getRoutineForDay(dayKey).forEach((b, idx) => {
    out.push({
      time: b.time || null,
      activity: b.activity || '',
      kind: 'routine',
      sourceIdx: idx,
      isPast: _isBlockPast(b.time, dateISO),
    });
  });

  // 2. Events + reminders на конкретну дату
  const isHistoricDate = dateISO < _todayISO();
  getEvents().forEach(ev => {
    if (ev.date !== dateISO) return;
    const isReminder = ev.source === 'reminder';
    const isPast = _isBlockPast(ev.time, dateISO);
    // QDIGl 04.05: для today приховуємо виконані прострочені reminders
    // (щоб не засмічувати timeline). Для МИНУЛИХ днів — показуємо все
    // (історія: юзер хоче бачити що вчора зробив о 22:00).
    if (isReminder && isPast && ev.done && !isHistoricDate) return;
    out.push({
      time: ev.time || null,
      activity: ev.title || '',
      kind: isReminder ? 'reminder' : 'event',
      sourceId: ev.id,
      reminderId: isReminder ? (ev.reminderId || ev.id) : undefined,
      isPast,
      _ev: ev,
    });
  });

  // Sort: time asc (null=кінець), потім за kind (routine→event→reminder)
  const KIND_ORDER = { routine: 0, event: 1, reminder: 2 };
  out.sort((a, b) => {
    const ta = a.time || '99:99';
    const tb = b.time || '99:99';
    const cmp = ta.localeCompare(tb);
    if (cmp !== 0) return cmp;
    return (KIND_ORDER[a.kind] || 9) - (KIND_ORDER[b.kind] || 9);
  });

  return out;
}

function openRoutineFromCalendar(dayKey) {
  closeDayScheduleModal();
  _routineReturnTo = 'calendar';
  _routineDay = dayKey;
  _renderRoutineDayTabs();
  _renderRoutineTimeline();
  const modal = document.getElementById('routine-modal');
  if (modal) {
    modal.style.display = 'flex';
    _zoomIn('routine-panel');
    setupModalSwipeClose(document.getElementById('routine-panel'), closeRoutineModal);
  }
}

function openRoutineModal() {
  _routineReturnTo = null;
  _routineDay = DAY_KEYS[new Date().getDay()];
  _renderRoutineDayTabs();
  _renderRoutineTimeline();
  const modal = document.getElementById('routine-modal');
  if (modal) {
    modal.style.display = 'flex';
    _zoomIn('routine-panel');
    setupModalSwipeClose(document.getElementById('routine-panel'), closeRoutineModal);
  }
}

// Навігаційний стек: звідки відкрили routine modal
let _routineReturnTo = null;

function closeRoutineModal() {
  const returnTo = _routineReturnTo;
  _routineReturnTo = null;
  _zoomOut('routine-panel', 'routine-modal', () => {
    if (returnTo === 'calendar') openCalendarModal();
  });
}

// QDIGl 04.05: render-order Пн-Нд (тижень починається з понеділка),
// центрування + більший розмір. Storage DAY_KEYS лишається ['sun','mon',...]
// бо AI tool save_routine + ai-context зав'язані на цьому enum.
const ROUTINE_TAB_ORDER = ['mon','tue','wed','thu','fri','sat','sun'];
const ROUTINE_TAB_LABELS = { mon:'Пн', tue:'Вт', wed:'Ср', thu:'Чт', fri:'Пт', sat:'Сб', sun:'Нд' };

function _renderRoutineDayTabs() {
  const el = document.getElementById('routine-day-tabs');
  if (!el) return;
  const routine = getRoutine();
  const todayKey = DAY_KEYS[new Date().getDay()];
  // Центрування + збільшено padding/font для тач-області (~44pt)
  el.style.justifyContent = 'center';
  el.style.gap = '6px';
  el.innerHTML = ROUTINE_TAB_ORDER.map(key => {
    const isActive = key === _routineDay;
    const isToday = key === todayKey;
    const hasOwn = !!routine[key];
    return `<div onclick="routineSelectDay('${key}')" style="padding:10px 14px;border-radius:12px;font-size:14px;font-weight:${isActive ? '800' : '600'};cursor:pointer;white-space:nowrap;min-width:42px;text-align:center;
      background:${isActive ? '#ea580c' : 'rgba(255,255,255,0.5)'};
      color:${isActive ? 'white' : isToday ? '#ea580c' : 'rgba(30,16,64,0.5)'};
      border:1.5px solid ${isActive ? '#ea580c' : isToday ? 'rgba(234,88,12,0.3)' : 'rgba(30,16,64,0.08)'};
      ${hasOwn && !isActive ? 'box-shadow:inset 0 -2px 0 rgba(234,88,12,0.3);' : ''}
      -webkit-tap-highlight-color:transparent
      ">${ROUTINE_TAB_LABELS[key]}</div>`;
  }).join('');
  // Лейбл «сьогодні» / «вчора» / дата
  const label = document.getElementById('routine-day-label');
  if (label) {
    if (_routineDay === todayKey) {
      label.textContent = t('routine.day.today', 'сьогодні');
    } else {
      const dateISO = _lastDateForDayKey(_routineDay);
      const [, m, d] = dateISO.split('-');
      const diffDays = Math.round((new Date(_todayISO()) - new Date(dateISO)) / (24*60*60*1000));
      if (diffDays === 1) label.textContent = t('routine.day.yesterday', 'вчора');
      else if (diffDays === 2) label.textContent = t('routine.day.day_before', 'позавчора');
      else if (diffDays === -1) label.textContent = t('routine.day.tomorrow', 'завтра');
      else if (diffDays === -2) label.textContent = t('routine.day.day_after', 'післязавтра');
      else label.textContent = `${parseInt(d)}.${m}`;
    }
  }
}

// QDIGl 04.05: для day-tab → дата ПОТОЧНОГО ТИЖНЯ (Пн-Нд від цього понеділка).
// Так модалка показує саме поточний тиждень як юзер бачить календар:
// Сьогодні Вт 05.05 → Пн=04.05, Вт=05.05 (today), Ср=06.05, Сб=09.05, Нд=10.05.
// Минулий тиждень (вчора-Пн) автоматично є — Пн понеділка тижня = вчорашня дата.
// Майбутні дні поточного тижня (Ср-Нд після Вт-today) теж видимі для планування.
// 'default' не має конкретної дати — фолбек на today (без events).
function _lastDateForDayKey(dayKey) {
  if (dayKey === 'default') return _todayISO();
  const targetIdxMon = ROUTINE_TAB_ORDER.indexOf(dayKey); // 0=Пн, 6=Нд
  if (targetIdxMon < 0) return _todayISO();
  const today = new Date();
  const todayIdxMon = (today.getDay() + 6) % 7; // 0=Пн, 6=Нд
  const target = new Date(today);
  target.setDate(today.getDate() + (targetIdxMon - todayIdxMon));
  return `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}-${String(target.getDate()).padStart(2, '0')}`;
}

function _renderRoutineTimeline() {
  const el = document.getElementById('routine-timeline');
  if (!el) return;
  // QDIGl 04.05: combined timeline — routine + events + reminders на конкретну дату.
  // Для default (legacy fallback dayKey без конкретного дня) — тільки routine блоки
  // бо немає дати для filtering events.
  const dateISO = _lastDateForDayKey(_routineDay);
  const blocks = _routineDay === 'default'
    ? getRoutineForDay('default').map((b, idx) => ({ time: b.time, activity: b.activity, kind: 'routine', sourceIdx: idx, isPast: false }))
    : getCombinedTimelineForDate(dateISO);

  if (blocks.length === 0) {
    el.innerHTML = `<div style="text-align:center;padding:32px 0;color:rgba(30,16,64,0.3);font-size:14px">
      Розпорядок порожній.<br>Натисни «+ Додати блок» або напиши в чат:<br>
      <span style="color:rgba(234,88,12,0.6);font-weight:600">"Мій розклад: 7 підйом, 9 робота, 18 зал"</span>
    </div>`;
    return;
  }

  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const isViewingToday = dateISO === _todayISO();

  // Іконки + кольори за kind. routine — нейтральний помаранчевий (як зараз).
  // event — синій (calendar accent). reminder — жовтий (⏰).
  const KIND_STYLE = {
    routine:  { icon: '', color: 'rgba(234,88,12,0.35)', text: '#1e1040' },
    event:    { icon: '📅 ', color: '#3b82f6',           text: '#1e3a8a' },
    reminder: { icon: '⏰ ', color: '#ea580c',           text: '#7c2d12' },
  };

  el.innerHTML = blocks.map((b, i) => {
    const time = b.time || '—';
    const blockMin = b.time ? (() => { const [h, m] = b.time.split(':').map(Number); return h * 60 + (m || 0); })() : -1;
    const nextBlock = blocks.slice(i + 1).find(x => x.time);
    const nextMin = nextBlock ? (() => { const [h, m] = nextBlock.time.split(':').map(Number); return h * 60 + (m || 0); })() : 24 * 60;
    const isCurrent = isViewingToday && b.kind === 'routine' && blockMin >= 0 && nowMin >= blockMin && nowMin < nextMin;
    const isPast = b.isPast || (isViewingToday && blockMin >= 0 && nowMin >= nextMin && b.kind === 'routine');
    const style = KIND_STYLE[b.kind] || KIND_STYLE.routine;
    // delete-routing залежить від kind
    const delAttr = b.kind === 'routine'
      ? `onclick="routineDeleteBlock(${b.sourceIdx})"`
      : `onclick="routineDeleteFromTimeline('${b.kind}', ${b.sourceId}, ${b.reminderId || 'null'})"`;
    const dot = b.kind === 'routine'
      ? `<div style="width:8px;height:8px;border-radius:50%;margin-top:5px;flex-shrink:0;background:${isCurrent ? '#ea580c' : isPast ? 'rgba(30,16,64,0.15)' : style.color}"></div>`
      : `<div style="width:8px;height:8px;border-radius:50%;margin-top:5px;flex-shrink:0;background:${style.color};box-shadow:0 0 0 2px ${style.color}33"></div>`;
    return `<div style="display:flex;align-items:flex-start;gap:12px;padding:10px 0;${isPast ? 'opacity:0.4;' : ''}${isCurrent ? 'background:rgba(234,88,12,0.06);border-radius:12px;padding:10px 8px;margin:0 -8px;' : ''}">
      <div style="width:46px;flex-shrink:0;font-size:14px;font-weight:700;color:${isCurrent ? '#ea580c' : style.text};text-align:right">${time}</div>
      ${dot}
      <div style="flex:1;display:flex;align-items:center;justify-content:space-between">
        <div style="font-size:14px;font-weight:${isCurrent ? '700' : '500'};color:${isCurrent ? '#ea580c' : style.text}">${style.icon}${escapeHtml(b.activity)}${isCurrent ? ' ←' : ''}</div>
        <div ${delAttr} style="font-size:16px;color:rgba(30,16,64,0.2);cursor:pointer;padding:0 4px">×</div>
      </div>
    </div>`;
  }).join('');
}

// QDIGl 04.05: видалення event/reminder з timeline. Routine має свій
// routineDeleteBlock(idx) — тут обробляємо тільки kind='event'|'reminder'.
function routineDeleteFromTimeline(kind, sourceId, reminderId) {
  if (kind === 'event' || kind === 'reminder') {
    const events = getEvents();
    const ev = events.find(e => e.id === sourceId);
    if (!ev) { _renderRoutineTimeline(); return; }
    saveEvents(events.filter(e => e.id !== sourceId));
    if (kind === 'reminder') {
      try {
        const rid = reminderId || ev.reminderId || ev.id;
        const reminders = JSON.parse(localStorage.getItem('nm_reminders') || '[]');
        const filtered = reminders.filter(r => r.id !== rid);
        if (filtered.length !== reminders.length) localStorage.setItem('nm_reminders', JSON.stringify(filtered));
      } catch(e) { console.warn('[routine] reminder cleanup failed', e); }
    }
  }
  _renderRoutineTimeline();
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

// ============================================================
// EVENT EDIT MODAL — редагування події
// ============================================================
let _editEventId = null;
let _editEventPriority = 'normal';
let _drumValues = { day: 1, month: 0, year: 2026, hour: -1, min: 0 };

// === DRUM PICKER ===
const DRUM_H = 40;
// MONTHS_SHORT — через canonical monthShort() з src/data/months.js.

// Експортується для перевикористання в інших модалках (Health date/time picker).
export function _initDrumCol(colId, items, selectedIdx, onSelect) {
  const col = document.getElementById(colId);
  if (!col) return;
  col.innerHTML = '<div class="drum-spacer"></div>' +
    items.map((label, i) => `<div class="drum-item" data-i="${i}">${label}</div>`).join('') +
    '<div class="drum-spacer"></div>';
  col.scrollTop = selectedIdx * DRUM_H;
  let timer;
  col.onscroll = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      const idx = Math.round(col.scrollTop / DRUM_H);
      const clamped = Math.max(0, Math.min(items.length - 1, idx));
      col.scrollTo({ top: clamped * DRUM_H, behavior: 'smooth' });
      onSelect(clamped);
    }, 80);
  };
}

function _initDateDrum(dateStr) {
  const d = dateStr ? new Date(dateStr + 'T00:00:00') : new Date();
  _drumValues.day = d.getDate();
  _drumValues.month = d.getMonth();
  _drumValues.year = d.getFullYear();

  const days = Array.from({length: 31}, (_, i) => String(i + 1));
  const years = Array.from({length: 8}, (_, i) => String(2024 + i));

  _initDrumCol('drum-day', days, _drumValues.day - 1, i => { _drumValues.day = i + 1; });
  _initDrumCol('drum-month', Array.from({ length: 12 }, (_, i) => monthShort(i)), _drumValues.month, i => { _drumValues.month = i; });
  _initDrumCol('drum-year', years, _drumValues.year - 2024, i => { _drumValues.year = 2024 + i; });
}

function _initTimeDrum(timeStr, prefix = 'start') {
  const hours = Array.from({length: 24}, (_, i) => String(i).padStart(2, '0'));
  const mins = Array.from({length: 12}, (_, i) => String(i * 5).padStart(2, '0'));
  const isEnd = prefix === 'end';
  const hKey = isEnd ? 'endHour' : 'hour';
  const mKey = isEnd ? 'endMin' : 'min';
  const hourId = isEnd ? 'drum-end-hour' : 'drum-hour';
  const minId = isEnd ? 'drum-end-min' : 'drum-min';

  if (timeStr) {
    const [h, m] = timeStr.split(':').map(Number);
    _drumValues[hKey] = h;
    _drumValues[mKey] = Math.round(m / 5);
  } else {
    _drumValues[hKey] = -1;
    _drumValues[mKey] = 0;
  }

  _initDrumCol(hourId, hours, Math.max(0, _drumValues[hKey]), i => { _drumValues[hKey] = i; });
  _initDrumCol(minId, mins, _drumValues[mKey], i => { _drumValues[mKey] = i; });

  if (isEnd) {
    const clearBtn = document.getElementById('event-end-clear-btn');
    if (clearBtn) clearBtn.style.display = timeStr ? 'block' : 'none';
  }
}

function _getDrumDate() {
  const y = _drumValues.year;
  const m = String(_drumValues.month + 1).padStart(2, '0');
  const maxDay = new Date(y, _drumValues.month + 1, 0).getDate();
  const d = String(Math.min(_drumValues.day, maxDay)).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function _getDrumTime() {
  if (_drumValues.hour < 0) return null;
  return `${String(_drumValues.hour).padStart(2, '0')}:${String(_drumValues.min * 5).padStart(2, '0')}`;
}

function _getDrumEndTime() {
  if (_drumValues.endHour === undefined || _drumValues.endHour < 0) return null;
  return `${String(_drumValues.endHour).padStart(2, '0')}:${String(_drumValues.endMin * 5).padStart(2, '0')}`;
}

function clearEventEndTime() {
  _drumValues.endHour = -1;
  _drumValues.endMin = 0;
  const hourCol = document.getElementById('drum-end-hour');
  const minCol = document.getElementById('drum-end-min');
  if (hourCol) hourCol.scrollTop = 0;
  if (minCol) minCol.scrollTop = 0;
  const btn = document.getElementById('event-end-clear-btn');
  if (btn) btn.style.display = 'none';
}

function openEventEditModal(eventId) {
  const events = getEvents();
  const ev = events.find(e => e.id === eventId);
  if (!ev) return;
  _editEventId = eventId;
  _editEventPriority = ev.priority || 'normal';
  document.getElementById('event-edit-title').value = ev.title || '';
  _renderEventPriority();
  const modal = document.getElementById('event-edit-modal');
  if (modal) {
    modal.style.display = 'flex';
    // Ініціалізуємо барабани ПІСЛЯ показу модалки — інакше scrollTop не працює
    requestAnimationFrame(() => {
      _initDateDrum(ev.date);
      _initTimeDrum(ev.time, 'start');
      _initTimeDrum(ev.endTime, 'end');
    });
    setupModalSwipeClose(modal.querySelector(':scope > div:last-child'), closeEventEditModal);
  }
}

function closeEventEditModal() {
  const modal = document.getElementById('event-edit-modal');
  if (modal) modal.style.display = 'none';
  _editEventId = null;
}

function setEventPriority(p) {
  _editEventPriority = p;
  _renderEventPriority();
}

function _renderEventPriority() {
  const wrap = document.getElementById('event-edit-priority');
  if (!wrap) return;
  const colors = { normal: '#3b82f6', important: '#ea580c', critical: '#ef4444' };
  wrap.querySelectorAll('[data-p]').forEach(el => {
    const p = el.dataset.p;
    const active = p === _editEventPriority;
    el.style.background = active ? colors[p] : 'rgba(255,255,255,0.5)';
    el.style.color = active ? 'white' : 'rgba(30,16,64,0.5)';
    el.style.borderColor = active ? colors[p] : 'rgba(30,16,64,0.12)';
  });
}

function saveEventFromModal() {
  if (!_editEventId) return;
  const title = document.getElementById('event-edit-title').value.trim();
  const date = _getDrumDate();
  if (!title || !date) return;
  const time = _getDrumTime();
  let endTime = _getDrumEndTime();
  // Без часу початку — час кінця не має сенсу
  if (!time) endTime = null;
  // Якщо «до» <= «з» — ігноруємо (юзер мабуть забув вимкнути)
  if (endTime && time && endTime <= time) endTime = null;
  const events = getEvents();
  const idx = events.findIndex(e => e.id === _editEventId);
  if (idx === -1) return;
  events[idx].title = title;
  events[idx].date = date;
  events[idx].time = time;
  events[idx].endTime = endTime;
  events[idx].priority = _editEventPriority;
  saveEvents(events);
  closeEventEditModal();
  renderCalendar();
  renderUpcoming();
  renderMonthEventsList();
}

function deleteEventFromModal() {
  if (!_editEventId) return;
  const events = getEvents();
  const idx = events.findIndex(e => e.id === _editEventId);
  if (idx === -1) return;
  const removed = events.splice(idx, 1)[0];
  saveEvents(events);
  addToTrash('event', removed);
  showUndoToast('Подію видалено');
  closeEventEditModal();
  renderCalendar();
  renderUpcoming();
  renderMonthEventsList();
}

// === WINDOW EXPORTS ===
// Оновлення числа на іконці календаря
function _updateCalIconDay() {
  const el = document.getElementById('cal-icon-day');
  if (el) el.textContent = new Date().getDate();
}
_updateCalIconDay();
// Оновлювати о півночі
setInterval(_updateCalIconDay, 60 * 1000);

Object.assign(window, {
  openCalendarModal, closeCalendarModal, calendarPrevMonth, calendarNextMonth, calendarDayTap,
  openRoutineModal, closeRoutineModal, routineSelectDay, routineAddBlock, routineDeleteBlock, routineDeleteFromTimeline, routineSaveNewBlock, routineCancelAdd,
  openEventEditModal, closeEventEditModal, saveEventFromModal, deleteEventFromModal, setEventPriority, clearEventEndTime,
  closeDayScheduleModal, openRoutineFromCalendar,
  highlightEventDays,
});
