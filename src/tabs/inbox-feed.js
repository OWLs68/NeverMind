// ============================================================
// tabs/inbox-feed.js — стрічка Inbox: дані (nm_inbox) + рендер карток
//
// Винесено з src/tabs/inbox.js (v3pexs 28.06, D2 автономного блоку; мапа
// розвідника): inbox.js був 1459 рядків (>1200). Блок односторонній — НУЛЬ
// звернень до чат-логіки inbox.js (перевірено grep), імпорт НЕ циклічний.
// Тут: категорії-мапи, getInbox/saveInbox, toggleListItem+regTouch,
// navigateInboxItem, _renderUpcoming, renderInbox (+свайп+undo). 1:1.
// inbox.js ре-експортує getInbox/saveInbox/renderInbox (strangler).
// ============================================================

import { switchTab } from '../core/nav.js';
import { escapeHtml, t, getReminders, saveReminders } from '../core/utils.js';
import { addToTrash, showUndoToast } from '../core/trash.js';
import { attachSwipeDelete } from '../ui/swipe-delete.js';
import { renderChecklist } from '../ui/checklist.js';
import { regTouch } from '../ui/touch-detect.js';
import { getLists, saveLists } from './lists.js';
import { getTasks } from './tasks.js';
import { getEvents, saveEvents } from './calendar.js';
import { monthShortCaps, monthGenitive } from '../data/months.js';


// Внутрішній рендер без запису в storage (щоб не дублювати при відновленні)
const CAT_DOT_BG = {
  task:     'background:rgba(47,208,249,0.2)',
  idea:     'background:rgba(236,247,85,0.3)',
  note:     'background:rgba(180,140,90,0.15)',
  habit:    'background:rgba(22,163,74,0.15)',
  event:    'background:rgba(59,130,246,0.15)',
  finance:  'background:rgba(194,65,12,0.15)',
  reminder: 'background:rgba(194,121,10,0.15)',
  list:     'background:rgba(234,88,12,0.15)',
};
// Solid кольори для 8px крапки в компактній стрічці
const CAT_DOT_SOLID = {
  task:     'background:#2fd0f9',
  idea:     'background:#c4b820',
  note:     'background:#a07850',
  habit:    'background:#16a34a',
  event:    'background:#3b82f6',
  finance:  'background:#c2410c',
  reminder: 'background:#c2790a',
  list:     'background:#ea580c',
};
const CAT_TAG_STYLE = {
  task:     'background:rgba(47,208,249,0.2);color:#0a7a97',
  idea:     'background:rgba(245,240,168,0.5);color:#7a6c00',
  note:     'background:rgba(180,140,90,0.2);color:#6a4a1a',
  habit:    'background:rgba(22,163,74,0.15);color:#14532d',
  event:    'background:rgba(59,130,246,0.15);color:#1d4ed8',
  finance:  'background:rgba(194,65,12,0.15);color:#7c2d12',
  reminder: 'background:rgba(194,121,10,0.18);color:#7a4e05',
  list:     'background:rgba(234,88,12,0.15);color:#9a3412',
};
const CAT_META = {
  idea:     { icon: '💡', label: t('inbox.cat.idea',     'Ідея'),        dotClass: 'cat-dot-idea',     tagClass: 'cat-idea'     },
  task:     { icon: '📌', label: t('inbox.cat.task',     'Задача'),      dotClass: 'cat-dot-task',     tagClass: 'cat-task'     },
  habit:    { icon: '🌱', label: t('inbox.cat.habit',    'Звичка'),      dotClass: 'cat-dot-habit',    tagClass: 'cat-habit'    },
  note:     { icon: '📝', label: t('inbox.cat.note',     'Нотатка'),     dotClass: 'cat-dot-note',     tagClass: 'cat-note'     },
  event:    { icon: '📅', label: t('inbox.cat.event',    'Подія'),       dotClass: 'cat-dot-event',    tagClass: 'cat-event'    },
  finance:  { icon: '₴',  label: t('inbox.cat.finance',  'Фінанси'),     dotClass: 'cat-dot-finance',  tagClass: 'cat-finance'  },
  reminder: { icon: '⏰', label: t('inbox.cat.reminder', 'Нагадування'), dotClass: 'cat-dot-reminder', tagClass: 'cat-reminder' },
  list:     { icon: '☑️', label: t('inbox.cat.list',     'Список'),      dotClass: 'cat-dot-list',     tagClass: 'cat-list'     },
};

export function getInbox() { return JSON.parse(localStorage.getItem('nm_inbox') || '[]'); }
export function saveInbox(arr) {
  localStorage.setItem('nm_inbox', JSON.stringify(arr));
  // B-153 fix (LfA6w 07.05): сповіщаємо інші вкладки + Brain Pulse + OWL board.
  // Раніше Inbox-картка додавалась через AI processSaveAction, але board/brain-pulse
  // не реагували миттєво — тільки після наступного nm-data-changed від ІНШОГО джерела.
  try { window.dispatchEvent(new CustomEvent('nm-data-changed', { detail: 'inbox' })); } catch(e) {}
}

// Тап по квадратику пункту списку (v3pexs) — закреслює пункт, зберігає, перемальовує.
// Та сама механіка що toggle-task-step у задачах (спільний renderChecklist).
export function toggleListItem(listId, itemId) {
  const lists = getLists();
  const list = lists.find(l => String(l.id) === String(listId));
  if (!list) return;
  const item = (list.items || []).find(i => String(i.id) === String(itemId));
  if (!item) return;
  item.done = !item.done;
  list.updatedAt = Date.now();
  saveLists(lists);
  renderInbox();
}
regTouch('toggle-list-item', (data) => {
  if (!data.listId || !data.itemId) return;
  toggleListItem(data.listId, data.itemId);
});


// Датовий сепаратор для стрічки
export function _inboxFormatHour(ts) {
  const d = new Date(ts);
  return d.getHours().toString().padStart(2,'0') + ':' + d.getMinutes().toString().padStart(2,'0');
}

export function _inboxDateLabel(ts) {
  const d = new Date(ts);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const itemDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.round((today - itemDay) / 86400000);
  // *_caps — UPPERCASE для секцій-роздільників стрічки. Lowercase варіанти
  // 'inbox.date.today/tomorrow' — для карток _renderUpcoming. Різний регістр —
  // дизайн-вимога; перекладам теж зберігати дві форми.
  if (diff === 0) return t('inbox.date.today_caps', 'СЬОГОДНІ');
  if (diff === 1) return t('inbox.date.yesterday_caps', 'ВЧОРА');
  return `${d.getDate()} ${monthShortCaps(d.getMonth())}`;
}

// Тап: перекинути на відповідну вкладку (блокування після свайпу — у attachSwipeDelete)
const INBOX_NAV_MAP = {
  task: 'tasks',
  habit: 'tasks', // habit — підвкладка всередині tasks; switchProdTab('habits') викликається у navigateInboxItem
  note: 'notes',
  idea: 'notes',
  finance: 'finance',
};
export function navigateInboxItem(id) {
  const el = document.getElementById('item-' + id);
  if (!el) return;
  const cat = el.dataset.cat;
  if (cat === 'event' || cat === 'reminder') { window.openCalendarModal(); return; }
  const tab = INBOX_NAV_MAP[cat];
  if (tab) {
    switchTab(tab);
    // Habit живе як підвкладка всередині #page-tasks → переключаємо subtab.
    if (cat === 'habit' && typeof window.switchProdTab === 'function') {
      window.switchProdTab('habits');
    }
  }
}

// ============================================================
// _renderUpcoming — закріплені картки найближчих подій/дедлайнів
// Показує зверху стрічки Inbox: події (nm_events) + задачі з dueDate
// Максимум 3, наступні 7 днів, відсортовані по даті
// ============================================================
export function _renderUpcoming() {
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const in7days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const upcoming = [];

  // Події з nm_events
  const events = getEvents();
  for (const ev of events) {
    if (ev.date >= todayStr && ev.date <= in7days) {
      const type = ev.source === 'reminder' ? 'reminder' : 'event';
      upcoming.push({ type, title: ev.title, date: ev.date, time: ev.time, id: ev.id });
    }
  }

  // Задачі з dueDate
  const tasks = getTasks().filter(t => t.status === 'active' && t.dueDate);
  for (const t of tasks) {
    if (t.dueDate >= todayStr && t.dueDate <= in7days) {
      upcoming.push({ type: 'task', title: t.title, date: t.dueDate, id: t.id });
    }
  }

  if (upcoming.length === 0) return '';

  // Сортуємо по даті (найближчі першими)
  upcoming.sort((a, b) => a.date.localeCompare(b.date));

  const cards = upcoming.slice(0, 3).map(item => {
    const d = new Date(item.date + 'T00:00:00');
    const diffDays = Math.round((d - new Date(todayStr + 'T00:00:00')) / 86400000);
    let when;
    if (diffDays === 0) when = t('inbox.date.today', 'сьогодні');
    else if (diffDays === 1) when = t('inbox.date.tomorrow', 'завтра');
    else when = `${d.getDate()} ${monthGenitive(d.getMonth())}`;

    const icon = item.type === 'task' ? '📌' : item.type === 'reminder' ? '⏰' : '📅';
    const timeStr = item.time ? t('inbox.date.at_time', ' о {time}', { time: item.time }) : '';
    const action = item.type === 'task'
      ? `data-action="switch-tab" data-tab="tasks"`
      : `data-action="open-calendar"`;

    return `<div class="inbox-upcoming-card" ${action}>
      <span class="inbox-upcoming-icon">${icon}</span>
      <span class="inbox-upcoming-text">${escapeHtml(item.title)}</span>
      <span class="inbox-upcoming-when">${when}${timeStr}</span>
    </div>`;
  }).join('');

  return `<div class="inbox-upcoming">${cards}</div>`;
}

export function renderInbox() {
  const items = getInbox();
  const list = document.getElementById('inbox-list');
  const countEl = document.getElementById('inbox-count');

  if (items.length === 0) {
    list.innerHTML = _renderUpcoming() + `<div class="inbox-empty">
      <div class="inbox-empty-icon">📥</div>
      <div class="inbox-empty-title">${t('inbox.empty.title', 'Inbox порожній')}</div>
      <div class="inbox-empty-sub">${t('inbox.empty.sub', 'Напиши що завгодно — Агент розбереться')}</div>
    </div>`;
    countEl.style.display = 'none';
    return;
  }
  countEl.style.display = 'inline';
  countEl.textContent = items.length;

  let html = _renderUpcoming();
  let lastDateLabel = '';

  items.forEach(item => {
    // Датовий сепаратор
    const dateLabel = _inboxDateLabel(item.ts);
    if (dateLabel !== lastDateLabel) {
      html += `<div class="inbox-date-sep">${dateLabel}</div>`;
      lastDateLabel = dateLabel;
    }

    const meta = CAT_META[item.category] || CAT_META.note;
    const dotBg = CAT_DOT_SOLID[item.category] || CAT_DOT_SOLID.note;
    const tagStyle = CAT_TAG_STYLE[item.category] || CAT_TAG_STYLE.note;

    // Список-чекліст (v3pexs): розгорнута картка з квадратиками прямо у стрічці.
    // Дані живуть у nm_lists; картка стрічки лише посилається через listId.
    if (item.category === 'list') {
      const listData = getLists().find(l => String(l.id) === String(item.listId));
      const lItems = (listData && Array.isArray(listData.items)) ? listData.items : [];
      const doneN = lItems.filter(i => i.done).length;
      html += `<div class="inbox-item-wrap" id="wrap-${item.id}" data-id="${item.id}">
        <div class="inbox-item" id="item-${item.id}" data-id="${item.id}" data-cat="list" style="cursor:default;padding:var(--card-pad-y) var(--card-pad-x)">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px">
            <div style="display:flex;align-items:center;gap:8px;min-width:0">
              <div class="inbox-item-dot" style="${dotBg}"></div>
              <div style="font-size:15px;font-weight:700;color:#1e1040;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(item.text)}</div>
            </div>
            <div style="display:flex;align-items:center;gap:6px;flex-shrink:0">
              <span style="font-size:12px;color:rgba(30,16,64,0.45)">${doneN}/${lItems.length}</span>
              <span class="inbox-item-tag" style="${tagStyle}">${meta.label}</span>
            </div>
          </div>
          ${renderChecklist(lItems, { tapAction: 'toggle-list-item', entityAttr: 'data-list-id', entityId: item.listId, itemAttr: 'data-item-id' })}
        </div>
      </div>`;
      return;
    }

    html += `<div class="inbox-item-wrap" id="wrap-${item.id}" data-id="${item.id}">
      <div class="inbox-item" id="item-${item.id}" data-id="${item.id}" data-cat="${item.category}"
           data-action="navigate-inbox-item">
        <div class="inbox-item-inner">
          <div class="inbox-item-dot" style="${dotBg}"></div>
          <div class="inbox-item-body">
            <div class="inbox-item-text">${escapeHtml(item.text)}</div>
          </div>
          <div class="inbox-item-right">
            <span class="inbox-item-time">${_inboxFormatHour(item.ts)}</span>
            <span class="inbox-item-tag" style="${tagStyle}">${meta.label}</span>
          </div>
        </div>
      </div>
    </div>`;
  });

  list.innerHTML = html;
  // Підключаємо B-54 свайп-видалення (винесено у спільну утиліту 18.04 14zLe)
  document.querySelectorAll('#inbox-list .inbox-item-wrap').forEach(wrap => {
    const card = wrap.querySelector('.inbox-item');
    if (!card) return;
    attachSwipeDelete(wrap, card, () => {
      const id = wrap.dataset.id;
      const allItems = getInbox();
      const originalIdx = allItems.findIndex(i => String(i.id) === id);
      const item = allItems.find(i => String(i.id) === id);
      if (item) addToTrash('inbox', item);
      saveInbox(allItems.filter(i => String(i.id) !== id));

      // QDIGl 04.05: для reminder-карток cleanup nm_reminders + nm_events
      // одночасно — щоб після свайпу сова не нагадала о 22:00 і у Календарі
      // подія зникла. Лінк через item.reminderId (нові картки) АБО fallback
      // на парсинг "HH:MM — text" з item.text (старі картки до Q сесії).
      let removedReminders = null;
      let removedEvents = null;
      if (item && item.category === 'reminder') {
        try {
          let rid = item.reminderId;
          if (!rid && typeof item.text === 'string') {
            // Backward compat: HH:MM — текст. Знаходимо у nm_reminders за time+text+date.
            const match = item.text.match(/^(\d{2}:\d{2})\s*[—-]\s*(.+)$/);
            if (match) {
              const itemDay = new Date(item.ts).toISOString().slice(0, 10);
              const reminders = getReminders();
              const found = reminders.find(r => r.time === match[1] && r.text === match[2].trim() && r.date === itemDay);
              if (found) rid = found.id;
            }
          }
          if (rid) {
            const reminders = getReminders();
            removedReminders = reminders.filter(r => r.id === rid);
            const remRest = reminders.filter(r => r.id !== rid);
            if (remRest.length !== reminders.length) saveReminders(remRest);
            const events = getEvents();
            removedEvents = events.filter(e => e.reminderId === rid || (e.source === 'reminder' && e.id === rid + 1));
            const evRest = events.filter(e => !(e.reminderId === rid || (e.source === 'reminder' && e.id === rid + 1)));
            if (evRest.length !== events.length) saveEvents(evRest);
          }
        } catch (e) { console.warn('[inbox swipe] reminder cleanup failed', e); }
      }

      renderInbox();
      if (item) showUndoToast(t('inbox.undo.deleted', 'Видалено з Inbox'), () => {
        const items = getInbox();
        const idx = Math.min(originalIdx, items.length);
        items.splice(idx, 0, item);
        saveInbox(items);
        // Відновлюємо nm_reminders + nm_events якщо видалили
        if (removedReminders && removedReminders.length > 0) {
          try {
            const reminders = getReminders();
            saveReminders([...removedReminders, ...reminders]);
          } catch(e) {}
        }
        if (removedEvents && removedEvents.length > 0) {
          try {
            const events = getEvents();
            saveEvents([...removedEvents, ...events]);
          } catch(e) {}
        }
        renderInbox();
      });
    });
  });
}
