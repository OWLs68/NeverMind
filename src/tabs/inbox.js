// ============================================================
// app-inbox.js — Inbox — чат, рендер, swipe, sendToAI, processSave, clarify
// Функції: addInboxChatMsg, renderInbox, swipeStart/Move/End, sendToAI, processSaveAction, processCompleteHabit, processCompleteTask, showClarify
// Залежності: app-core.js, app-ai.js
// ============================================================

import { currentTab, switchTab, showToast } from '../core/nav.js';
import { escapeHtml, saveOffline, extractJsonBlocks, parseContentChips } from '../core/utils.js';
import { generateUUID } from '../core/uuid.js';
import { addToTrash, getTrash, restoreFromTrash, showUndoToast } from '../core/trash.js';
import { INBOX_SYSTEM_PROMPT, INBOX_TOOLS, callAI, callAIWithTools, callAIWithHistory, getAIContext, getOWLPersonality, saveChatMsg, activeChatBar } from '../ai/core.js';
import { UI_TOOL_NAMES, handleUITool } from '../ai/ui-tools.js';
import { addFact } from '../ai/memory.js';
import { handleScheduleAnswer } from '../owl/inbox-board.js';
import { attachSwipeDelete } from '../ui/swipe-delete.js';
import { getTasks, saveTasks, renderTasks, autoGenerateTaskSteps } from './tasks.js';
import { getEvents, saveEvents, addEventDedup } from './calendar.js';
import { getHabits, saveHabits, getHabitLog, saveHabitLog, renderHabits, renderProdHabits, processUniversalAction } from './habits.js';
import { addNoteFromInbox, getNotes, saveNotes } from './notes.js';
import { getFinance, saveFinance, renderFinance, formatMoney, processFinanceAction,
  createFinCategory, updateFinCategory, deleteFinCategory, mergeFinCategories, addFinSubcategory, findFinCatByName } from './finance.js';
import { getMoments, saveMoments, generateMomentSummary } from './evening.js';
import { getProjects, saveProjects, startProjectInboxInterview } from './projects.js';
import { getRoutine, saveRoutine } from './calendar.js';
import { handleSurveyAnswer, maybeAskGuideQuestion, saveGuideTopicAnswer } from './onboarding.js';
import { renderChips } from '../owl/chips.js';
// Фаза 2 (15.04 6v2eR) — Здоров'я tool handlers
import { renderHealth, addAllergy, deleteAllergy, createHealthCardProgrammatic, editHealthCardProgrammatic, deleteHealthCardProgrammatic, addMedicationToCard, editMedicationInCard, logMedicationDose, addHealthHistoryEntry } from './health.js';
// Unread badge (універсальна червона крапка — QV1n2 19.04 Фаза 0)
import { showUnreadBadge, clearUnreadBadge } from '../ui/unread-badge.js';

// === INBOX CHAT MESSAGES ===
let _inboxTypingEl = null;

export function addInboxChatMsg(role, text, chips = null) {
  const el = document.getElementById('inbox-chat-messages');
  if (!el) return;

  // Видаляємо typing індикатор якщо є
  if (_inboxTypingEl) { _inboxTypingEl.remove(); _inboxTypingEl = null; }

  // Чистимо застарілі чіпи попередніх повідомлень сови —
  // чіпи релевантні тільки останньому питанню (як у evening-chat)
  if (role === 'agent') el.querySelectorAll('.chat-chips-row').forEach(n => n.remove());

  if (role === 'typing') {
    const div = document.createElement('div');
    div.style.cssText = 'display:flex';
    div.innerHTML = `<div style="background:rgba(255,255,255,0.12);border-radius:4px 14px 14px 14px;padding:5px 10px"><div class="ai-typing"><span></span><span></span><span></span></div></div>`;
    el.appendChild(div);
    _inboxTypingEl = div;
    el.scrollTop = el.scrollHeight;
    return;
  }

  // Розділювач часу — якщо юзер пише після паузи >5 хвилин
  if (role === 'user') {
    const now = Date.now();
    const gap = now - _lastUserMsgTs;
    if (_lastUserMsgTs > 0 && gap > 5 * 60 * 1000) {
      const mins = Math.round(gap / 60000);
      const label = mins < 60
        ? t('inbox.time.mins_ago', '{n} хв тому', { n: mins })
        : mins < 1440
        ? t('inbox.time.hours_ago', '{n} год тому', { n: Math.round(mins/60) })
        : t('inbox.time.earlier', 'раніше');
      const sep = document.createElement('div');
      sep.style.cssText = 'display:flex;align-items:center;gap:8px;margin:6px 0;opacity:0.45';
      sep.innerHTML = `<div style="flex:1;height:1px;background:rgba(255,255,255,0.2)"></div><div style="font-size:11px;color:rgba(255,255,255,0.6);white-space:nowrap;font-weight:500">${label}</div><div style="flex:1;height:1px;background:rgba(255,255,255,0.2)"></div>`;
      el.appendChild(sep);
    }
    _lastUserMsgTs = now;
  }

  const isAgent = role === 'agent';
  const div = document.createElement('div');
  div.style.cssText = `display:flex;${isAgent ? 'gap:8px;align-items:flex-start' : 'justify-content:flex-end'}`;
  if (isAgent) {
    div.innerHTML = `<div style="background:rgba(255,255,255,0.12);color:white;border-radius:4px 14px 14px 14px;padding:8px 12px;font-size:15px;font-weight:500;line-height:1.5;max-width:85%">${escapeHtml(text).replace(/\n/g, "<br>")}</div>`;
  } else {
    div.innerHTML = `<div style="background:rgba(255,255,255,0.88);color:#1e1040;border-radius:14px 4px 14px 14px;padding:8px 12px;font-size:15px;font-weight:500;line-height:1.5;max-width:85%">${escapeHtml(text)}</div>`;
  }
  el.appendChild(div);

  // Чіпи під бульбою сови — рендер через спільний chips.js.
  // Клік на чіп кладе label у textarea і викликає sendToAI(true).
  if (isAgent && Array.isArray(chips) && chips.length > 0) {
    const chipsRow = document.createElement('div');
    chipsRow.className = 'chat-chips-row';
    renderChips(chipsRow, chips, 'inbox');
    el.appendChild(chipsRow);
  }

  el.scrollTop = el.scrollHeight;
  saveChatMsg('inbox', role, text);

  // Якщо агент надіслав повідомлення а чат закритий — показуємо бейдж
  if (role === 'agent') {
    const bar = document.getElementById('inbox-ai-bar');
    const chatWin = bar ? bar.querySelector('.ai-bar-chat-window') : null;
    const isOpen = chatWin && chatWin.classList.contains('open');
    if (!isOpen) showUnreadBadge('inbox', 'ai-send-btn');
  }
}

// Backward-compat: core.js викликає _clearInboxUnreadBadge коли юзер відкриває чат.
// Після Фази 0 це просто обгортка над універсальним clearUnreadBadge('inbox').
export function _clearInboxUnreadBadge() {
  clearUnreadBadge('inbox');
}

// B-87 fix (20.04 NRw8G): делегуємо у utils.parseContentChips (depth-tracking).
// Старий регекс /\{[\s\S]*?"chips"[\s\S]*?\}/g різав на першому `}` після
// "chips" (всередині чіп-об'єкта) → решта `{...}]}` лишалась як сміття у тексті.
const _parseContentChips = parseContentChips;

// Внутрішній рендер без запису в storage (щоб не дублювати при відновленні)
const CAT_DOT_BG = {
  task:     'background:rgba(47,208,249,0.2)',
  idea:     'background:rgba(236,247,85,0.3)',
  note:     'background:rgba(180,140,90,0.15)',
  habit:    'background:rgba(22,163,74,0.15)',
  event:    'background:rgba(59,130,246,0.15)',
  finance:  'background:rgba(194,65,12,0.15)',
  reminder: 'background:rgba(194,121,10,0.15)',
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
};
const CAT_TAG_STYLE = {
  task:     'background:rgba(47,208,249,0.2);color:#0a7a97',
  idea:     'background:rgba(245,240,168,0.5);color:#7a6c00',
  note:     'background:rgba(180,140,90,0.2);color:#6a4a1a',
  habit:    'background:rgba(22,163,74,0.15);color:#14532d',
  event:    'background:rgba(59,130,246,0.15);color:#1d4ed8',
  finance:  'background:rgba(194,65,12,0.15);color:#7c2d12',
  reminder: 'background:rgba(194,121,10,0.18);color:#7a4e05',
};
const CAT_META = {
  idea:     { icon: '💡', label: t('inbox.cat.idea',     'Ідея'),        dotClass: 'cat-dot-idea',     tagClass: 'cat-idea'     },
  task:     { icon: '📌', label: t('inbox.cat.task',     'Задача'),      dotClass: 'cat-dot-task',     tagClass: 'cat-task'     },
  habit:    { icon: '🌱', label: t('inbox.cat.habit',    'Звичка'),      dotClass: 'cat-dot-habit',    tagClass: 'cat-habit'    },
  note:     { icon: '📝', label: t('inbox.cat.note',     'Нотатка'),     dotClass: 'cat-dot-note',     tagClass: 'cat-note'     },
  event:    { icon: '📅', label: t('inbox.cat.event',    'Подія'),       dotClass: 'cat-dot-event',    tagClass: 'cat-event'    },
  finance:  { icon: '₴',  label: t('inbox.cat.finance',  'Фінанси'),     dotClass: 'cat-dot-finance',  tagClass: 'cat-finance'  },
  reminder: { icon: '⏰', label: t('inbox.cat.reminder', 'Нагадування'), dotClass: 'cat-dot-reminder', tagClass: 'cat-reminder' },
};

export function getInbox() { return JSON.parse(localStorage.getItem('nm_inbox') || '[]'); }
export function saveInbox(arr) { localStorage.setItem('nm_inbox', JSON.stringify(arr)); }


// Датовий сепаратор для стрічки
function _inboxFormatHour(ts) {
  const d = new Date(ts);
  return d.getHours().toString().padStart(2,'0') + ':' + d.getMinutes().toString().padStart(2,'0');
}

function _inboxDateLabel(ts) {
  const d = new Date(ts);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const itemDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.round((today - itemDay) / 86400000);
  if (diff === 0) return t('inbox.date.today_caps', 'СЬОГОДНІ');
  if (diff === 1) return t('inbox.date.yesterday_caps', 'ВЧОРА');
  const months = ['СІЧ','ЛЮТ','БЕР','КВІТ','ТРАВ','ЧЕРВ','ЛИП','СЕРП','ВЕР','ЖОВТ','ЛИСТ','ГРУД'];
  return `${d.getDate()} ${months[d.getMonth()]}`;
}

// Тап: перекинути на відповідну вкладку (блокування після свайпу — у attachSwipeDelete)
const INBOX_NAV_MAP = {
  task: 'tasks',
  habit: 'habits',
  note: 'notes',
  idea: 'notes',
  finance: 'finance',
};
function navigateInboxItem(id) {
  const el = document.getElementById('item-' + id);
  if (!el) return;
  const cat = el.dataset.cat;
  if (cat === 'event' || cat === 'reminder') { window.openCalendarModal(); return; }
  const tab = INBOX_NAV_MAP[cat];
  if (tab) switchTab(tab);
}

// ============================================================
// _renderUpcoming — закріплені картки найближчих подій/дедлайнів
// Показує зверху стрічки Inbox: події (nm_events) + задачі з dueDate
// Максимум 3, наступні 7 днів, відсортовані по даті
// ============================================================
function _renderUpcoming() {
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

  const MONTHS_OF = ['січня','лютого','березня','квітня','травня','червня','липня','серпня','вересня','жовтня','листопада','грудня'];

  const cards = upcoming.slice(0, 3).map(item => {
    const d = new Date(item.date + 'T00:00:00');
    const diffDays = Math.round((d - new Date(todayStr + 'T00:00:00')) / 86400000);
    let when;
    if (diffDays === 0) when = t('inbox.date.today', 'сьогодні');
    else if (diffDays === 1) when = t('inbox.date.tomorrow', 'завтра');
    else when = `${d.getDate()} ${MONTHS_OF[d.getMonth()]}`;

    const icon = item.type === 'task' ? '📌' : item.type === 'reminder' ? '⏰' : '📅';
    const timeStr = item.time ? t('inbox.date.at_time', ' о {time}', { time: item.time }) : '';
    const action = item.type === 'task'
      ? `onclick="switchTab('tasks')"`
      : `onclick="openCalendarModal()"`;

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

    html += `<div class="inbox-item-wrap" id="wrap-${item.id}" data-id="${item.id}">
      <div class="inbox-item" id="item-${item.id}" data-id="${item.id}" data-cat="${item.category}"
           onclick="navigateInboxItem(${item.id})">
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
      renderInbox();
      if (item) showUndoToast('Видалено з Inbox', () => {
        const items = getInbox();
        const idx = Math.min(originalIdx, items.length);
        items.splice(idx, 0, item);
        saveInbox(items);
        renderInbox();
      });
    });
  });
}

// === UNIFIED SEND TO AI ===
let aiLoading = false;
let inboxChatHistory = []; // зберігає останні 6 обмінів
let _lastUserMsgTs = 0; // timestamp останнього повідомлення юзера
const SEND_SVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>`;

function unifiedInputKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendToAI(); }
}

// === TOOL CALL → OLD ACTION FORMAT CONVERTER ===
function _toolCallToAction(name, args) {
  switch(name) {
    case 'save_task': return { action: 'save', category: 'task', task_title: args.title, text: args.text, task_steps: args.steps || [], dueDate: args.due_date, priority: args.priority, comment: args.comment };
    case 'save_note': return { action: 'save', category: args.folder === 'Ідеї' ? 'idea' : 'note', text: args.text, folder: args.folder, comment: args.comment };
    case 'save_habit': return { action: 'save', category: 'habit', text: args.name, details: args.details, days: args.days, targetCount: args.target_count, comment: args.comment };
    case 'save_moment': return { action: 'save', category: 'event', text: args.text, mood: args.mood, comment: args.comment };
    case 'create_event': return { action: 'create_event', title: args.title, date: args.date, time: args.time || null, end_time: args.end_time || null, priority: args.priority || 'normal', comment: args.comment };
    case 'save_finance': return { action: 'save_finance', fin_type: args.fin_type, amount: args.amount, category: args.category, fin_comment: args.fin_comment, date: args.date, comment: args.fin_comment };
    case 'complete_habit': return { action: 'complete_habit', habit_ids: args.habit_ids, comment: args.comment };
    case 'complete_task': return { action: 'complete_task', task_ids: args.task_ids, comment: args.comment };
    case 'create_project': return { action: 'create_project', name: args.name, subtitle: args.subtitle || '' };
    case 'add_step': return { action: 'add_step', task_id: args.task_id, steps: args.steps };
    case 'update_transaction': return { action: 'update_transaction', id: args.id, category: args.category, amount: args.amount, comment: args.comment };
    case 'restore_deleted': return { action: 'restore_deleted', query: args.query, type: args.type || null };
    case 'save_routine': return { action: 'save_routine', day: args.day, blocks: args.blocks };
    case 'clarify': return { action: 'clarify', question: args.question, options: args.options };
    case 'save_memory_fact': return { action: 'save_memory_fact', fact: args.fact, category: args.category, ttl_days: args.ttl_days };
    case 'set_reminder': return { action: 'set_reminder', text: args.text, time: args.time, date: args.date };
    case 'edit_event': return { action: 'edit_event', event_id: args.event_id, title: args.title, date: args.date, time: args.time, end_time: args.end_time, priority: args.priority, comment: args.comment };
    case 'delete_event': return { action: 'delete_event', event_id: args.event_id };
    case 'edit_note': return { action: 'edit_note', note_id: args.note_id, text: args.text, folder: args.folder, comment: args.comment };
    case 'edit_task': return { action: 'edit_task', task_id: args.task_id, title: args.title, dueDate: args.due_date, priority: args.priority, comment: args.comment };
    case 'edit_habit': return { action: 'edit_habit', habit_id: args.habit_id, name: args.name, days: args.days, details: args.details, comment: args.comment };
    case 'delete_task': return { action: 'delete_task', task_id: args.task_id };
    case 'delete_habit': return { action: 'delete_habit', habit_id: args.habit_id };
    case 'delete_folder': return { action: 'delete_folder', folder: args.folder };
    case 'move_note': return { action: 'move_note', query: args.query, folder: args.folder };
    case 'reopen_task': return { action: 'reopen_task', task_id: args.task_id };
    // Здоров'я (Фаза 2, 15.04 6v2eR)
    case 'create_health_card': return { action: 'create_health_card', name: args.name, subtitle: args.subtitle, doctor: args.doctor, doctor_recommendations: args.doctor_recommendations, doctor_conclusion: args.doctor_conclusion, start_date: args.start_date, next_appointment_date: args.next_appointment_date, next_appointment_time: args.next_appointment_time, status: args.status, initial_history_text: args.initial_history_text, comment: args.comment };
    case 'edit_health_card': return { action: 'edit_health_card', card_id: args.card_id, name: args.name, subtitle: args.subtitle, doctor: args.doctor, doctor_recommendations: args.doctor_recommendations, doctor_conclusion: args.doctor_conclusion, start_date: args.start_date, next_appointment_date: args.next_appointment_date, next_appointment_time: args.next_appointment_time, status: args.status, comment: args.comment };
    case 'delete_health_card': return { action: 'delete_health_card', card_id: args.card_id, comment: args.comment };
    case 'add_medication': return { action: 'add_medication', card_id: args.card_id, med_name: args.med_name, dosage: args.dosage, schedule: args.schedule, course_duration: args.course_duration, comment: args.comment };
    case 'edit_medication': return { action: 'edit_medication', card_id: args.card_id, med_id: args.med_id, med_name: args.med_name, dosage: args.dosage, schedule: args.schedule, course_duration: args.course_duration, comment: args.comment };
    case 'log_medication_dose': return { action: 'log_medication_dose', card_id: args.card_id, med_name: args.med_name, comment: args.comment };
    case 'add_allergy': return { action: 'add_allergy', name: args.name, notes: args.notes, comment: args.comment };
    case 'delete_allergy': return { action: 'delete_allergy', allergy_id: args.allergy_id, comment: args.comment };
    case 'add_health_history_entry': return { action: 'add_health_history_entry', card_id: args.card_id, entry_type: args.entry_type, text: args.text, comment: args.comment };
    // Фаза 4 (K-02): CRUD категорій Фінансів через агента
    case 'create_finance_category': return { action: 'create_finance_category', name: args.name, cat_type: args.type || 'expense', icon: args.icon, color: args.color, subcategories: args.subcategories, comment: args.comment };
    case 'edit_finance_category': return { action: 'edit_finance_category', current_name: args.current_name, new_name: args.new_name, icon: args.icon, color: args.color, subcategories: args.subcategories, archived: args.archived, comment: args.comment };
    case 'delete_finance_category': return { action: 'delete_finance_category', name: args.name, comment: args.comment };
    case 'merge_finance_categories': return { action: 'merge_finance_categories', from_name: args.from_name, to_name: args.to_name, comment: args.comment };
    case 'add_finance_subcategory': return { action: 'add_finance_subcategory', category_name: args.category_name, subcategory: args.subcategory, comment: args.comment };
    default: return null;
  }
}

export async function sendToAI(fromChip = false) {
  if (aiLoading) return;
  const input = document.getElementById('inbox-input');
  const text = input.value.trim();
  if (!text) return;

  addInboxChatMsg('user', text);
  input.value = ''; input.style.height = 'auto';
  // НЕ фокусуємо input після відправки — щоб не відкривався чат автоматично
  // Зберігаємо відповідь якщо OWL чекав відповідь по темі провідника
  try { saveGuideTopicAnswer(text); } catch(e) {}
  if (handleSurveyAnswer(text)) return;
  try { if (handleScheduleAnswer(text)) return; } catch(e) {}

  const key = localStorage.getItem('nm_gemini_key');

  // Немає ключа або file:// — зберігаємо офлайн миттєво
  if (!key || location.protocol === 'file:') {
    saveOffline(text);
    return;
  }

  aiLoading = true;

  const btn = document.getElementById('ai-send-btn');
  btn.disabled = true;
  btn.innerHTML = '<div class="ai-typing" style="transform:scale(0.65)"><span></span><span></span><span></span></div>';

  // Показуємо typing в чаті
  addInboxChatMsg('typing', '…');

  const aiContext = getAIContext();
  // Додаємо контекст паузи якщо >5 хвилин
  const gapMs = _lastUserMsgTs > 0 ? Date.now() - _lastUserMsgTs : 0;
  const gapContext = gapMs > 5 * 60 * 1000
    ? `\n\n[Пауза ${Math.round(gapMs/60000)} хв — може бути нова думка, не продовження]`
    : '';
  const fullPrompt = aiContext ? `${INBOX_SYSTEM_PROMPT}${gapContext}\n\n${aiContext}` : `${INBOX_SYSTEM_PROMPT}${gapContext}`;
  // Якщо це відповідь на чіп — вставити повідомлення табло прямо в текст для AI
  let aiText = text;
  if (fromChip) {
    try {
      // Шар 2 "Один мозок V2" (rJYkw 21.04): читаємо з unified — табло ЄДИНЕ на всі вкладки
      const boardMsgs = JSON.parse(localStorage.getItem('nm_owl_board_unified') || '[]');
      if (boardMsgs[0]?.text) {
        aiText = `[Відповідь на повідомлення OWL на табло: "${boardMsgs[0].text}"] ${text}`;
      }
    } catch(e) {}
  }
  // Build history for context — but keep it short so JSON format is not broken
  inboxChatHistory.push({ role: 'user', content: aiText });
  if (inboxChatHistory.length > 24) inboxChatHistory = inboxChatHistory.slice(-24);
  // Передаємо останні 12 повідомлень — достатньо для контексту розмови
  const historySlice = inboxChatHistory.slice(-12);
  const _aiStart = Date.now();

  // === ПИТАЛЬНИЙ GUARD (18.04 pvZG1) ===
  // Якщо текст закінчується на "?" і короткий (≤80 знаків) — це питання до OWL,
  // а не запис. Не викликаємо tools, а просто відповідаємо у чаті по контексту.
  // Прибирає випадки коли "Скільки у мене нотаток?" зберігалось як нотатка.
  const isQuestion = /\?\s*$/.test(text) && text.length <= 80;
  if (isQuestion) {
    const qPrompt = `${getOWLPersonality()} Юзер у чаті Inbox ставить ПИТАННЯ про свої дані.
ПРАВИЛА:
- НЕ створюй жодних записів, жодних tool calls
- Відповідай коротко (1-2 речення) по реальних даних з контексту
- Посилайся на конкретні ID/назви якщо є
- Якщо даних нема — скажи прямо "поки що нема"

${aiContext}`;
    const reply = await callAIWithHistory(qPrompt, historySlice, 'inbox-quick-q');
    const elapsedQ = Date.now() - _aiStart;
    if (elapsedQ < 800) await new Promise(r => setTimeout(r, 800 - elapsedQ));
    addInboxChatMsg('agent', reply || t('inbox.chat.misunderstood', 'Не зрозумів, переформулюй?'));
    inboxChatHistory.push({ role: 'assistant', content: reply || '' });
    aiLoading = false;
    btn.disabled = false;
    btn.innerHTML = SEND_SVG;
    return;
  }

  // === TOOL CALLING — основний виклик ===
  const msg = await callAIWithTools(fullPrompt, historySlice, INBOX_TOOLS, 'inbox');

  // Мінімальна затримка — typing indicator тримається хоча б 0.8 сек
  const elapsed = Date.now() - _aiStart;
  if (elapsed < 800) await new Promise(r => setTimeout(r, 800 - elapsed));

  if (!msg) {
    saveOffline(text);
    addInboxChatMsg('agent', t('inbox.chat.saved', '✓ Збережено'));
    aiLoading = false;
    btn.disabled = false;
    btn.innerHTML = SEND_SVG;
    return;
  }

  // Save assistant reply to history for context
  // НЕ зберігаємо tool_calls в історію — OpenAI вимагає tool result messages після них,
  // а ми їх не надсилаємо. Для контексту розмови достатньо msg.content.
  inboxChatHistory.push({ role: 'assistant', content: msg.content || '' });

  try {
    if (msg.tool_calls && msg.tool_calls.length > 0) {
      // === TOOL CALLING DISPATCH ===
      for (const tc of msg.tool_calls) {
        const args = JSON.parse(tc.function.arguments);
        // V3 Фаза 1: strip _reasoning_log + log for diagnostics (no handler should see it)
        if (args._reasoning_log) {
          try {
            const log = JSON.parse(localStorage.getItem('nm_reasoning_log') || '[]');
            log.unshift({ ts: Date.now(), tool: tc.function.name, reasoning: String(args._reasoning_log).slice(0, 400) });
            localStorage.setItem('nm_reasoning_log', JSON.stringify(log.slice(0, 50)));
          } catch {}
          delete args._reasoning_log;
        }

        // UI TOOLS (4.17) — hands-free навігація/фільтри/налаштування
        if (UI_TOOL_NAMES.has(tc.function.name)) {
          const res = handleUITool(tc.function.name, args);
          if (res && res.text) {
            addInboxChatMsg('agent', res.text);
          }
          continue;
        }

        const action = _toolCallToAction(tc.function.name, args);
        if (!action) continue;

        // Dispatch через існуючі handlers
        if (action.action === 'clarify') {
          showClarify(action, text);
          aiLoading = false;
          btn.disabled = false;
          btn.innerHTML = SEND_SVG;
          return;
        }
        if (action.action === 'save') {
          if (fromChip) {
            addInboxChatMsg('agent', t('inbox.chat.saved_as_reply', 'Окей, записав у чат як відповідь.'));
          } else {
            await processSaveAction(action, text);
          }
        } else if (action.action === 'save_finance') {
          processFinanceAction(action, text);
        } else if (action.action === 'update_transaction') {
          const txs = getFinance();
          const idx = txs.findIndex(t => t.id === action.id);
          if (idx !== -1) {
            if (action.category) txs[idx].category = action.category;
            if (action.comment !== undefined) txs[idx].comment = action.comment;
            if (action.amount) txs[idx].amount = parseFloat(action.amount);
            saveFinance(txs);
            if (currentTab === 'finance') renderFinance();
            const updParts = [];
            if (action.category) updParts.push('категорія: ' + txs[idx].category);
            if (action.amount) updParts.push('сума: ' + formatMoney(txs[idx].amount));
            addInboxChatMsg('agent', '✓ Оновлено: ' + (updParts.join(', ') || txs[idx].category));
          } else {
            addInboxChatMsg('agent', t('inbox.chat.tx_not_found', 'Не знайшов операцію. Спробуй ще раз.'));
          }
        } else if (action.action === 'complete_habit') {
          await processCompleteHabit(action, text);
        } else if (action.action === 'complete_task') {
          await processCompleteTask(action, text);
        } else if (action.action === 'add_step') {
          const tasks = getTasks();
          const idx = tasks.findIndex(t => t.id === action.task_id);
          if (idx !== -1) {
            const steps = Array.isArray(action.steps) ? action.steps : [];
            steps.forEach(s => tasks[idx].steps.push({ id: Date.now() + Math.random(), text: s, done: false }));
            saveTasks(tasks);
            renderTasks();
            const stepWord = steps.length === 1
              ? t('inbox.step_one', 'крок')
              : steps.length < 5
                ? t('inbox.step_few', 'кроки')
                : t('inbox.step_many', 'кроків');
            addInboxChatMsg('agent', t('inbox.chat.steps_added', '✓ Додано {n} {word} до "{title}"', { n: steps.length, word: stepWord, title: tasks[idx].title }));
          } else {
            addInboxChatMsg('agent', t('inbox.chat.task_not_found', 'Не знайшов задачу. Спробуй через вкладку Продуктивність.'));
          }
        } else if (action.action === 'create_project' && !fromChip) {
          addInboxChatMsg('agent', `Створюю проект "${action.name || text}"...`);
          const projects = getProjects();
          const newProject = {
            id: Date.now(),
            name: action.name || text,
            subtitle: action.subtitle || '',
            progress: 0,
            steps: [],
            budget: { total: 0, spent: 0, items: [] },
            metrics: [],
            decisions: [],
            resources: [],
            risks: '',
            tempoNow: '?',
            tempoMore: '?',
            tempoIdeal: '?',
            notesPreview: '',
            lastActivity: Date.now(),
            createdAt: Date.now(),
          };
          projects.unshift(newProject);
          saveProjects(projects);
          addInboxChatMsg('agent', `✅ Проект "${newProject.name}" створено`);
          setTimeout(() => startProjectInboxInterview(newProject.name, newProject.subtitle), 600);
        } else if (action.action === 'create_event') {
          let endTime = action.end_time || null;
          if (!action.time) endTime = null;
          if (endTime && action.time && endTime <= action.time) endTime = null;
          // Перевірка конфлікту часу: якщо є подія на ту саму дату+час — попередимо.
          let conflict = null;
          if (action.time) {
            conflict = getEvents().find(e => e.date === action.date && e.time === action.time && e.title !== action.title);
          }
          const ev = { id: Date.now(), title: action.title || 'Подія', date: action.date, time: action.time || null, endTime, priority: action.priority || 'normal', createdAt: Date.now() };
          const res = addEventDedup(ev);
          if (!res.added) { addInboxChatMsg('agent', t('inbox.chat.event_dupe', 'Така подія "{title}" вже є в календарі.', { title: ev.title })); continue; }
          const items = getInbox(); items.unshift({ id: Date.now() + 1, text: ev.title, category: 'event', ts: Date.now(), processed: true }); saveInbox(items); renderInbox();
          const dateObj = new Date(action.date);
          const dayStr = `${dateObj.getDate()} ${['січня','лютого','березня','квітня','травня','червня','липня','серпня','вересня','жовтня','листопада','грудня'][dateObj.getMonth()]}`;
          const timeStr = action.time ? ` о ${action.time}${endTime ? '–' + endTime : ''}` : '';
          const warn = conflict ? `\n⚠️ На цей час уже є "${conflict.title}". Лишити обидві чи перенести?` : '';
          addInboxChatMsg('agent', `📅 Подію "${ev.title}" додано в календар на ${dayStr}${timeStr}${warn}`);
        } else if (action.action === 'restore_deleted') {
          const q = (action.query || '').trim();
          const typeFilter = action.type || null;
          const trash = getTrash().filter(t => Date.now() - t.deletedAt < 7 * 24 * 60 * 60 * 1000);
          const typeLabel = { task:'задачу', note:'нотатку', habit:'звичку', inbox:'запис', folder:'папку', finance:'операцію' };
          const typeIcon = { task:'📋', note:'📝', habit:'🌱', inbox:'📥', folder:'📁', finance:'💰' };
          const filtered = typeFilter ? trash.filter(t => t.type === typeFilter) : trash;
          if (q === 'all') {
            if (filtered.length === 0) {
              addInboxChatMsg('agent', t('inbox.chat.trash_empty', 'Кеш видалених порожній. Записи зберігаються 7 днів.'));
            } else {
              filtered.forEach(t => restoreFromTrash(t.deletedAt));
              addInboxChatMsg('agent', `✅ Відновив ${filtered.length} записів`);
            }
          } else if (q === 'last') {
            const last = filtered.sort((a, b) => b.deletedAt - a.deletedAt)[0];
            if (!last) {
              addInboxChatMsg('agent', t('inbox.chat.trash_no_match', 'Нічого не знайшов в кеші видалених.'));
            } else {
              const itemLabel = last.item.text || last.item.title || last.item.name || last.item.folder || 'запис';
              restoreFromTrash(last.deletedAt);
              addInboxChatMsg('agent', `✅ Відновив ${typeLabel[last.type] || 'запис'} "${itemLabel}"`);
            }
          } else {
            const words = q.toLowerCase().split(/[\s,]+/).filter(Boolean);
            const results = filtered.filter(t => {
              const txt = (t.item.text || t.item.title || t.item.name || t.item.folder || '').toLowerCase();
              return words.some(w => txt.includes(w));
            }).sort((a, b) => b.deletedAt - a.deletedAt);
            if (results.length === 0) {
              addInboxChatMsg('agent', t('inbox.chat.trash_no_similar', 'Не знайшов нічого схожого в кеші видалених.'));
            } else if (results.length <= 5) {
              results.forEach(t => restoreFromTrash(t.deletedAt));
              const labels = results.map(e => `${typeIcon[e.type] || '•'} ${(e.item.text || e.item.title || e.item.name || '').substring(0, 35)}`).join('\n');
              addInboxChatMsg('agent', `✅ Відновив ${results.length} записи:\n${labels}`);
            } else {
              const list = results.slice(0, 5).map(e => {
                const lbl = (e.item.text || e.item.title || e.item.name || e.item.folder || 'запис').substring(0, 40);
                const ago = Math.round((Date.now() - e.deletedAt) / 86400000);
                return `${typeIcon[e.type] || '•'} ${lbl} (${ago === 0 ? t('inbox.date.today', 'сьогодні') : t('inbox.time.days_ago', '{n} дн тому', { n: ago })})`;
              }).join('\n');
              addInboxChatMsg('agent', `Знайшов ${results.length} схожих. Ось перші 5:\n${list}\n\nУточни який саме.`);
            }
          }
        } else if (action.action === 'save_routine') {
          const routine = getRoutine();
          const blocks = (action.blocks || []).map(b => ({ time: b.time, activity: b.activity }));
          const days = Array.isArray(action.day) ? action.day : [action.day || 'default'];
          const dayLabels = { default:'будні', mon:'понеділок', tue:'вівторок', wed:'середу', thu:'четвер', fri:'п\'ятницю', sat:'суботу', sun:'неділю' };
          days.forEach(d => { routine[d] = [...blocks]; });
          saveRoutine(routine);
          const label = days.length === 1 ? dayLabels[days[0]] || days[0] : days.map(d => dayLabels[d] || d).join(', ');
          addInboxChatMsg('agent', `🕐 Розпорядок збережено на ${label} (${blocks.length} блоків)`);
        } else if (action.action === 'save_memory_fact') {
          // Безшумно зберігаємо факт — user feedback приходить через msg.content
          // (AI проінструктований також писати коротке "Запам'ятав..." у content)
          try {
            addFact({
              text: action.fact,
              category: action.category,
              ttlDays: action.ttl_days,
              source: 'inbox',
            });
          } catch (e) {
            console.warn('[memory] addFact failed:', e);
          }
        // === ЗДОРОВ'Я (Фаза 2, 15.04 6v2eR) ===
        } else if (action.action === 'create_health_card') {
          const created = createHealthCardProgrammatic({
            name: action.name,
            subtitle: action.subtitle,
            doctor: action.doctor,
            doctorRecommendations: action.doctor_recommendations,
            doctorConclusion: action.doctor_conclusion,
            startDate: action.start_date,
            nextAppointment: action.next_appointment_date ? { date: action.next_appointment_date, time: action.next_appointment_time || '' } : null,
            status: action.status,
            initialHistoryEntry: action.initial_history_text,
          });
          if (created) {
            if (currentTab === 'health') renderHealth();
            const items = getInbox(); items.unshift({ id: Date.now() + 1, text: `🏥 Стан: ${created.name}`, category: 'note', ts: Date.now(), processed: true }); saveInbox(items); renderInbox();
            addInboxChatMsg('agent', `🏥 Створив картку "${created.name}" у Здоров'ї. ${action.comment || ''}`);
          } else {
            addInboxChatMsg('agent', t('inbox.chat.health_no_name', 'Не вдалось створити картку — потрібна назва.'));
          }
        } else if (action.action === 'edit_health_card') {
          const updates = {};
          if (action.name !== undefined) updates.name = action.name;
          if (action.subtitle !== undefined) updates.subtitle = action.subtitle;
          if (action.doctor !== undefined) updates.doctor = action.doctor;
          if (action.doctor_recommendations !== undefined) updates.doctorRecommendations = action.doctor_recommendations;
          if (action.doctor_conclusion !== undefined) updates.doctorConclusion = action.doctor_conclusion;
          if (action.start_date !== undefined) updates.startDate = action.start_date;
          if (action.status !== undefined) updates.status = action.status;
          // nextAppointment: null = очистити; date= встановити
          if (action.next_appointment_date !== undefined) {
            updates.nextAppointment = action.next_appointment_date
              ? { date: action.next_appointment_date, time: action.next_appointment_time || '' }
              : null;
          }
          const updated = editHealthCardProgrammatic(action.card_id, updates);
          if (updated) {
            if (currentTab === 'health') renderHealth();
            addInboxChatMsg('agent', `✓ Оновив картку "${updated.name}". ${action.comment || ''}`);
          } else {
            addInboxChatMsg('agent', 'Не знайшов картку. Спробуй ще раз.');
          }
        } else if (action.action === 'delete_health_card') {
          const ok = deleteHealthCardProgrammatic(action.card_id);
          if (ok) {
            if (currentTab === 'health') renderHealth();
            addInboxChatMsg('agent', `🗑️ Картку видалено (7 днів у кошику). ${action.comment || ''}`);
          } else {
            addInboxChatMsg('agent', 'Не знайшов картку для видалення.');
          }
        } else if (action.action === 'add_medication') {
          const med = addMedicationToCard(action.card_id, {
            name: action.med_name,
            dosage: action.dosage,
            schedule: action.schedule,
            courseDuration: action.course_duration,
          });
          if (med) {
            if (currentTab === 'health') renderHealth();
            addInboxChatMsg('agent', `💊 Додав ${med.name}${med.dosage ? ' (' + med.dosage + ')' : ''}. ${action.comment || ''}`);
          } else {
            addInboxChatMsg('agent', 'Не знайшов картку. Створи її спочатку.');
          }
        } else if (action.action === 'edit_medication') {
          const updates = {};
          if (action.med_name !== undefined) updates.name = action.med_name;
          if (action.dosage !== undefined) updates.dosage = action.dosage;
          if (action.schedule !== undefined) updates.schedule = action.schedule;
          if (action.course_duration !== undefined) updates.courseDuration = action.course_duration;
          const med = editMedicationInCard(action.card_id, action.med_id, updates);
          if (med) {
            if (currentTab === 'health') renderHealth();
            addInboxChatMsg('agent', `✓ Оновив ${med.name}. ${action.comment || ''}`);
          } else {
            addInboxChatMsg('agent', 'Не знайшов препарат у картці.');
          }
        } else if (action.action === 'log_medication_dose') {
          const med = logMedicationDose(action.card_id, action.med_name);
          if (med) {
            if (currentTab === 'health') renderHealth();
            addInboxChatMsg('agent', `💊✓ Прийняв ${med.name}. ${action.comment || ''}`);
          } else {
            addInboxChatMsg('agent', 'Не знайшов препарат у картці. Уточни назву.');
          }
        } else if (action.action === 'add_allergy') {
          const added = addAllergy(action.name, action.notes || '');
          if (added) {
            if (currentTab === 'health') renderHealth();
            addInboxChatMsg('agent', `🚨 Додав алергію: ${action.name}. ${action.comment || ''}`);
          } else {
            addInboxChatMsg('agent', `Алергія "${action.name}" вже є у списку.`);
          }
        } else if (action.action === 'delete_allergy') {
          const ok = deleteAllergy(action.allergy_id);
          if (ok) {
            if (currentTab === 'health') renderHealth();
            addInboxChatMsg('agent', `🗑️ Алергію видалено. ${action.comment || ''}`);
          } else {
            addInboxChatMsg('agent', 'Не знайшов алергію для видалення.');
          }
        } else if (action.action === 'add_health_history_entry') {
          const entry = addHealthHistoryEntry(action.card_id, action.entry_type, action.text);
          if (entry) {
            if (currentTab === 'health') renderHealth();
            addInboxChatMsg('agent', `📝 Додав запис у історію. ${action.comment || ''}`);
          } else {
            addInboxChatMsg('agent', 'Не знайшов картку для запису.');
          }
        } else if (action.action === 'create_finance_category') {
          // Фаза 4 (K-02): створити нову категорію
          const existing = findFinCatByName(action.name);
          if (existing) {
            addInboxChatMsg('agent', `Категорія "${action.name}" вже існує у ${existing.type === 'expense' ? 'витратах' : 'доходах'}.`);
          } else {
            const type = action.cat_type === 'income' ? 'income' : 'expense';
            createFinCategory(type, { name: action.name, icon: action.icon, color: action.color, subcategories: action.subcategories });
            if (currentTab === 'finance') renderFinance();
            addInboxChatMsg('agent', `✓ Категорію "${action.name}" (${type === 'expense' ? 'витрата' : 'дохід'}) створено. ${action.comment || ''}`);
          }
        } else if (action.action === 'edit_finance_category') {
          const found = findFinCatByName(action.current_name);
          if (!found) {
            addInboxChatMsg('agent', `Не знайшов категорію "${action.current_name}".`);
          } else {
            const updates = {};
            if (action.new_name) updates.name = action.new_name;
            if (action.icon) updates.icon = action.icon;
            if (action.color) updates.color = action.color;
            if (action.subcategories) updates.subcategories = action.subcategories;
            if (action.archived !== undefined) updates.archived = action.archived;
            updateFinCategory(found.cat.id, updates);
            // Якщо перейменовано — оновити транзакції (перенести з старого імені на нове)
            if (action.new_name && action.new_name !== found.cat.name) {
              const txs = getFinance();
              let changed = 0;
              txs.forEach(t => { if (t.category === found.cat.name) { t.category = action.new_name; changed++; } });
              if (changed > 0) saveFinance(txs);
            }
            if (currentTab === 'finance') renderFinance();
            addInboxChatMsg('agent', `✓ Категорію "${action.current_name}" оновлено. ${action.comment || ''}`);
          }
        } else if (action.action === 'delete_finance_category') {
          const found = findFinCatByName(action.name);
          if (!found) {
            addInboxChatMsg('agent', `Не знайшов категорію "${action.name}".`);
          } else {
            deleteFinCategory(found.cat.id);
            if (currentTab === 'finance') renderFinance();
            addInboxChatMsg('agent', `✓ Категорію "${action.name}" видалено. Старі операції збережено з цим ім'ям. ${action.comment || ''}`);
          }
        } else if (action.action === 'merge_finance_categories') {
          const from = findFinCatByName(action.from_name);
          const to = findFinCatByName(action.to_name);
          if (!from || !to) {
            addInboxChatMsg('agent', `Не знайшов категорії "${action.from_name}" або "${action.to_name}".`);
          } else if (from.type !== to.type) {
            addInboxChatMsg('agent', `"${action.from_name}" і "${action.to_name}" мають різні типи (витрата/дохід) — не можу об'єднати.`);
          } else {
            const res = mergeFinCategories(from.cat.id, to.cat.id);
            if (res.ok) {
              if (currentTab === 'finance') renderFinance();
              addInboxChatMsg('agent', `✓ Об'єднав "${res.from}" → "${res.to}". Перенесено ${res.txsMoved} операцій. ${action.comment || ''}`);
            } else {
              addInboxChatMsg('agent', `Не вдалось об'єднати: ${res.reason}`);
            }
          }
        } else if (action.action === 'add_finance_subcategory') {
          const res = addFinSubcategory(action.category_name, action.subcategory);
          if (!res || !res.ok) {
            addInboxChatMsg('agent', `Не знайшов категорію "${action.category_name}".`);
          } else if (res.alreadyExists) {
            addInboxChatMsg('agent', `Підкатегорія "${action.subcategory}" вже є у "${action.category_name}".`);
          } else {
            if (currentTab === 'finance') renderFinance();
            addInboxChatMsg('agent', `✓ Додав "${action.subcategory}" у "${action.category_name}". ${action.comment || ''}`);
          }
        } else if (processUniversalAction(action, text, addInboxChatMsg)) {
          // edit_event, delete_event, edit_note, edit_task, set_reminder, etc.
        } else {
          // Fallback — показуємо comment якщо є
          const replyText = action.comment || args?.comment || '';
          if (replyText) addInboxChatMsg('agent', replyText);
        }
      }
      // Якщо AI також надіслав текст (follow-up питання) — показуємо
      if (msg.content) {
        const { text: replyText, chips } = _parseContentChips(msg.content);
        if (replyText) addInboxChatMsg('agent', replyText, chips);
      } else if (msg.tool_calls.every(tc => tc.function.name === 'save_memory_fact')) {
        // Якщо AI викликав ТІЛЬКИ save_memory_fact без тексту — показати fallback
        addInboxChatMsg('agent', 'Запам\'ятав ✓');
      }
    } else if (msg.content) {
      // Текстова відповідь без tool calls = reply
      const { text: replyText, chips } = _parseContentChips(msg.content);
      if (replyText) addInboxChatMsg('agent', replyText, chips);
    } else {
      saveOffline(text);
      addInboxChatMsg('agent', t('inbox.chat.saved', '✓ Збережено'));
    }
  } catch(e) {
    console.error('Tool call processing error:', e);
    saveOffline(text);
    addInboxChatMsg('agent', t('inbox.chat.saved', '✓ Збережено'));
  }

  aiLoading = false;
  btn.disabled = false;
  btn.innerHTML = SEND_SVG;
}

// === CLARIFY SYSTEM ===
let clarifyParsed = null;
let clarifyOriginalText = null;

function showClarify(parsed, originalText) {
  clarifyParsed = parsed;
  clarifyOriginalText = originalText;

  document.getElementById('clarify-question').textContent = parsed.question || 'Уточни будь ласка:';
  document.getElementById('clarify-input').value = '';

  const optEl = document.getElementById('clarify-options');
  optEl.innerHTML = (parsed.options || []).map((opt, i) => {
    const isPrimary = i === 0;
    return `<button onclick="selectClarifyOption(${i})" style="width:100%;display:flex;align-items:center;gap:10px;background:${isPrimary ? 'rgba(194,121,10,0.05)' : 'rgba(30,16,64,0.03)'};border:1.5px solid ${isPrimary ? 'rgba(194,121,10,0.2)' : 'rgba(30,16,64,0.08)'};border-radius:13px;padding:12px 14px;font-size:14px;font-weight:600;color:${isPrimary ? '#c2790a' : '#1e1040'};cursor:pointer;text-align:left;font-family:inherit">${escapeHtml(opt.label || '')}</button>`;
  }).join('');

  document.getElementById('clarify-modal').style.display = 'flex';
}

function closeClarify() {
  document.getElementById('clarify-modal').style.display = 'none';
  clarifyParsed = null;
  clarifyOriginalText = null;
}

async function selectClarifyOption(idx) {
  if (!clarifyParsed) return;
  const opt = (clarifyParsed.options || [])[idx];
  if (!opt) return;
  const origText = clarifyOriginalText;
  closeClarify();
  if (opt.action === 'save') await processSaveAction(opt, origText);
  else if (opt.action === 'complete_habit') await processCompleteHabit(opt, origText);
  else if (opt.action === 'complete_task') await processCompleteTask(opt, origText);
}

async function sendClarifyText() {
  const input = document.getElementById('clarify-input');
  const text = input.value.trim();
  if (!text) return;
  const origText = clarifyOriginalText;
  closeClarify();
  const key = localStorage.getItem('nm_gemini_key');
  if (!key) return;
  const fullPrompt = getAIContext() ? `${INBOX_SYSTEM_PROMPT}\n\n${getAIContext()}` : INBOX_SYSTEM_PROMPT;
  const combinedMsg = `Оригінальний запис: "${origText}". Уточнення від користувача: "${text}"`;
  // Tool calling для уточнення
  const msg = await callAIWithTools(fullPrompt, [{ role: 'user', content: combinedMsg }], INBOX_TOOLS, 'inbox-clarify');
  if (msg) {
    try {
      if (msg.tool_calls && msg.tool_calls.length > 0) {
        // Обробляємо ВСІ tool_calls (AI може emit save_memory_fact РАЗОМ з primary action)
        let primaryHandled = false;
        for (const tc of msg.tool_calls) {
          const args = JSON.parse(tc.function.arguments);
          // V3 Фаза 1: strip _reasoning_log (already logged in primary dispatch)
          if (args._reasoning_log) delete args._reasoning_log;
          const action = _toolCallToAction(tc.function.name, args);
          if (!action) continue;
          // Тихий канал: пам'ять — зберігаємо без UI
          if (action.action === 'save_memory_fact') {
            try { addFact({ text: action.fact, category: action.category, ttlDays: action.ttl_days, source: 'inbox' }); } catch {}
            continue;
          }
          if (primaryHandled) continue; // основна дія вже виконана
          if (action.action === 'save') { await processSaveAction(action, combinedMsg); primaryHandled = true; }
          else if (action.action === 'complete_habit') { processCompleteHabit(action, combinedMsg); primaryHandled = true; }
          else if (action.action === 'complete_task') { processCompleteTask(action, combinedMsg); primaryHandled = true; }
          else if (processUniversalAction(action, combinedMsg, addInboxChatMsg)) { primaryHandled = true; }
          else if (action.comment) { addInboxChatMsg('agent', action.comment); primaryHandled = true; }
        }
      }
      // msg.content показуємо ЗАВЖДИ якщо є (і з tool_calls, і без) —
      // AI при save_memory_fact має надіслати "Запам'ятав..."
      if (msg.content) {
        const { text: replyText, chips } = _parseContentChips(msg.content);
        if (replyText) addInboxChatMsg('agent', replyText, chips);
      } else if (!primaryHandled) {
        addInboxChatMsg('agent', 'Запам\'ятав ✓');
      }
    } catch(e) {}
  }
}

// ============================================================
// _detectEventFromTask — кодова детекція подій серед задач
// GPT-4o-mini іноді ігнорує промпт і створює task замість event.
// Шукає паттерни дат: "20го", "20 числа", "в середу", "15 травня"
// + слова-маркери подій: приїзд, зустріч, день народження тощо.
// Повертає { title, date } або null.
// ============================================================
// ============================================================
// _detectEventDate — шукає ТІЛЬКИ дату в тексті (без маркерів)
// Для випадку коли AI вже визначив що це event/подія
// Повертає { title, date } або null
// ============================================================
function _detectEventDate(text) {
  if (!text) return null;
  const t = text.toLowerCase();
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  // Паттерн 1: "20го", "20-го", "20 числа"
  const dayMatch = t.match(/(\d{1,2})\s*(?:-?го|числа)/);
  if (dayMatch) {
    const day = parseInt(dayMatch[1]);
    if (day >= 1 && day <= 31) {
      let m = month;
      if (day < now.getDate()) m = month + 1;
      if (m > 11) { m = 0; }
      const y = m < month ? year + 1 : year;
      const date = `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      return { title: text.replace(/\s*\d{1,2}\s*(?:-?го|числа)\s*/i, ' ').trim(), date };
    }
  }

  // Паттерн 2: "15 травня", "3 січня"
  const monthNames = ['січн','лют','берез','квітн','травн','червн','липн','серпн','вересн','жовтн','листопад','грудн'];
  const monthMatch = t.match(/(\d{1,2})\s+(січн|лют|берез|квітн|травн|червн|липн|серпн|вересн|жовтн|листопад|грудн)\w*/i);
  if (monthMatch) {
    const day = parseInt(monthMatch[1]);
    const mIdx = monthNames.findIndex(m => monthMatch[2].toLowerCase().startsWith(m));
    if (mIdx !== -1 && day >= 1 && day <= 31) {
      const y = (mIdx < month || (mIdx === month && day < now.getDate())) ? year + 1 : year;
      const date = `${y}-${String(mIdx + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      return { title: text.replace(/\s*\d{1,2}\s+(?:січн|лют|берез|квітн|травн|червн|липн|серпн|вересн|жовтн|листопад|грудн)\w*/i, ' ').trim(), date };
    }
  }

  return null;
}

export function _detectEventFromTask(title) {
  if (!title) return null;
  const t = title.toLowerCase();

  // Слова-маркери що це ПОДІЯ а не задача (дія)
  const eventMarkers = /приїзд|приїжд|приліт|прибут|зустріч(?!ай)|візит|прийом|рейс|концерт|виставк|свято|день народження|ювілей|весілля|іспит|екзамен|співбесід/i;
  if (!eventMarkers.test(t)) return null;

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-based

  // Паттерн 1: "20го", "20-го", "20 числа"
  const dayMatch = t.match(/(\d{1,2})\s*(?:-?го|числа)/);
  if (dayMatch) {
    const day = parseInt(dayMatch[1]);
    if (day >= 1 && day <= 31) {
      // Якщо день вже минув цього місяця — беремо наступний
      let m = month;
      if (day < now.getDate()) m = month + 1;
      if (m > 11) { m = 0; }
      const y = m < month ? year + 1 : year;
      const date = `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      return { title: title.replace(/\s*\d{1,2}\s*(?:-?го|числа)\s*/i, ' ').trim(), date };
    }
  }

  // Паттерн 2: "15 травня", "3 січня"
  const monthNames = ['січн','лют','берез','квітн','травн','червн','липн','серпн','вересн','жовтн','листопад','грудн'];
  const monthMatch = t.match(/(\d{1,2})\s+(січн|лют|берез|квітн|травн|червн|липн|серпн|вересн|жовтн|листопад|грудн)\w*/i);
  if (monthMatch) {
    const day = parseInt(monthMatch[1]);
    const mIdx = monthNames.findIndex(m => monthMatch[2].toLowerCase().startsWith(m));
    if (mIdx !== -1 && day >= 1 && day <= 31) {
      const y = (mIdx < month || (mIdx === month && day < now.getDate())) ? year + 1 : year;
      const date = `${y}-${String(mIdx + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      return { title: title.replace(/\s*\d{1,2}\s+(?:січн|лют|берез|квітн|травн|червн|липн|серпн|вересн|жовтн|листопад|грудн)\w*/i, ' ').trim(), date };
    }
  }

  return null;
}

// Виносимо логіку збереження в окрему функцію щоб використовувати і з clarify і з sendToAI
async function processSaveAction(parsed, originalText) {
  const catMap = {'нотатка':'note','задача':'task','звичка':'habit','ідея':'idea','подія':'event'};
  const rawCat = (parsed.category || '').toLowerCase();
  const cat = ['idea','task','habit','note','event'].includes(rawCat) ? rawCat : (catMap[rawCat] || 'note');
  const savedText = parsed.text || originalText;
  const folder = parsed.folder || null;
  const items = getInbox();
  const inboxCardId = Date.now();
  items.unshift({ id: inboxCardId, text: savedText, category: cat, ts: Date.now(), processed: true });
  saveInbox(items);
  renderInbox();

  // 18.04 pvZG1: { type, id, label } — для тост-відкату в кінці функції
  let undoRef = null;

  if (cat === 'task') {
    // Fallback: якщо AI створив task але це схоже на подію — конвертуємо в event
    const taskTitle = parsed.task_title || savedText;
    const eventDetected = _detectEventFromTask(taskTitle);
    if (eventDetected) {
      const ev = { id: Date.now(), title: eventDetected.title || taskTitle, date: eventDetected.date, time: null, priority: parsed.priority || 'normal', createdAt: Date.now() };
      const res = addEventDedup(ev);
      if (!res.added) { addInboxChatMsg('agent', `Така подія "${ev.title}" вже є в календарі.`); return; }
      const dateObj = new Date(eventDetected.date);
      const dayStr = `${dateObj.getDate()} ${['січня','лютого','березня','квітня','травня','червня','липня','серпня','вересня','жовтня','листопада','грудня'][dateObj.getMonth()]}`;
      addInboxChatMsg('agent', `📅 Подію "${ev.title}" додано в календар на ${dayStr}`);
      return;
    }
    const taskId = generateUUID();
    const tasks = getTasks();
    const taskSteps = Array.isArray(parsed.task_steps) && parsed.task_steps.length > 0
      ? parsed.task_steps.map(s => ({ id: Date.now() + Math.random(), text: s, done: false }))
      : [];
    const newTask = { id: taskId, title: taskTitle, desc: savedText !== taskTitle ? savedText : '', steps: taskSteps, status: 'active', createdAt: Date.now() };
    if (parsed.dueDate) newTask.dueDate = parsed.dueDate;
    if (parsed.priority && ['normal','important','critical'].includes(parsed.priority)) newTask.priority = parsed.priority;
    tasks.unshift(newTask);
    saveTasks(tasks);
    if (taskSteps.length === 0) autoGenerateTaskSteps(taskId, taskTitle);
    undoRef = { type: 'task', id: taskId, label: 'задачу' };
  }
  if (cat === 'note' || cat === 'idea') {
    addNoteFromInbox(savedText, cat, folder);
    const allNotes = getNotes();
    if (allNotes[0]) undoRef = { type: 'note', id: allNotes[0].id, label: cat === 'idea' ? 'ідею' : 'нотатку' };
  }
  if (cat === 'habit') {
    const habits = getHabits();
    const exists = habits.some(h => h.name.toLowerCase() === savedText.toLowerCase());
    if (!exists) {
      const txt = savedText.toLowerCase();
      let days;

      // Якщо агент передав days масив — використовуємо його
      if (Array.isArray(parsed.days) && parsed.days.length > 0) {
        days = parsed.days.filter(d => d >= 0 && d <= 6);
      } else {
        // Парсимо з тексту
        days = [0,1,2,3,4,5,6];
        const hasEveryDay = /щодня|кожного дня|кожен день/i.test(txt);
        const hasWeekdays = /будн|пн.*ср.*пт/i.test(txt);
        const hasWeekend = /вихідн|субот.*неділ|сб.*нд/i.test(txt);
        const hasWeekday = /понеділ|вівтор|серед|четвер|п.ятниц|субот|неділ|^пн\b|^вт\b|^ср\b|^чт\b|^пт\b|^сб\b|^нд\b/i.test(txt);
        if (hasEveryDay) { days = [0,1,2,3,4,5,6]; }
        else if (hasWeekdays) { days = [0,1,2,3,4]; }
        else if (hasWeekend) { days = [5,6]; }
        else if (hasWeekday) {
          days = [];
          if (/понеділ|\bпн\b/i.test(txt)) days.push(0);
          if (/вівтор|\bвт\b/i.test(txt)) days.push(1);
          if (/серед|\bср\b/i.test(txt)) days.push(2);
          if (/четвер|\bчт\b/i.test(txt)) days.push(3);
          if (/п.ятниц|\bпт\b/i.test(txt)) days.push(4);
          if (/субот|\bсб\b/i.test(txt)) days.push(5);
          if (/неділ|\bнд\b/i.test(txt)) days.push(6);
          if (days.length === 0) days = [0,1,2,3,4,5,6];
        }
      }

      const habitParts = savedText.split(/[,.]\s*/);
      const habitName = habitParts[0].trim().split(' ').slice(0,5).join(' ');
      const habitDetails = parsed.details || (savedText.length > habitName.length + 2 ? savedText.substring(habitName.length).replace(/^[,.\s]+/,'').trim() : '');

      // Витягуємо кількість разів — з parsed або з тексту
      let targetCount = parseInt(parsed.targetCount) || 1;
      if (targetCount === 1) {
        const countMatch = txt.match(/(\d+)\s*(рази?|раз|разів|склянок|склянки|стакан|кроків|хвилин|разу)/i);
        if (countMatch) targetCount = Math.min(20, Math.max(2, parseInt(countMatch[1])));
      }

      const habitId = Date.now();
      habits.push({ id: habitId, name: habitName, details: habitDetails, emoji: '⭕', days, targetCount, createdAt: habitId });
      saveHabits(habits);
      undoRef = { type: 'habit', id: habitId, label: 'звичку' };
    }
  }
  if (cat === 'event') {
    // Перевіряємо чи є дата → календарна подія (nm_events), інакше → момент дня
    const eventDetected = _detectEventDate(savedText);
    if (eventDetected) {
      // Календарна подія — зберігаємо в nm_events
      const ev = { id: Date.now(), title: eventDetected.title || savedText, date: eventDetected.date, time: null, priority: 'normal', createdAt: Date.now() };
      const res = addEventDedup(ev);
      if (!res.added) {
        addInboxChatMsg('agent', `Така подія "${ev.title}" вже є в календарі.`);
      } else {
        const dateObj = new Date(eventDetected.date);
        const dayStr = `${dateObj.getDate()} ${['січня','лютого','березня','квітня','травня','червня','липня','серпня','вересня','жовтня','листопада','грудня'][dateObj.getMonth()]}`;
        addInboxChatMsg('agent', `📅 Подію "${ev.title}" додано в календар на ${dayStr}`);
      }
    } else {
      // Момент дня — як раніше
      const mood = parsed.mood || (/добре|чудово|супер|відмінно|весело|щасли/i.test(savedText) ? 'positive' :
                   /погано|жахливо|сумно|нудно|важко|втомив/i.test(savedText) ? 'negative' : 'neutral');
      const moments = getMoments();
      const newMoment = { id: Date.now(), text: savedText, mood, ts: Date.now() };
      moments.push(newMoment);
      saveMoments(moments);
      generateMomentSummary(newMoment.id, savedText);
    }
  }
  const catConfirm2 = {
    task: '✅ Задачу створено',
    habit: '🌱 Звичку створено',
    note: '📝 Нотатку збережено',
    idea: '💡 Ідею збережено',
    event: '📅 Подію додано'
  };
  const confirmMsg2 = parsed.comment
    ? `${parsed.comment} ${catConfirm2[cat] ? '/ ' + catConfirm2[cat] : ''}`
    : (catConfirm2[cat] || '✓ Збережено');
  addInboxChatMsg('agent', confirmMsg2);

  // Якщо є уточнення після збереження — показуємо через паузу
  if (parsed.ask_after) {
    setTimeout(() => addInboxChatMsg('agent', parsed.ask_after), 600);
  }

  // 18.04 pvZG1: тост-відкат для task/note/idea/habit.
  // Випадково створив? Один тап "Відмінити" — і запис зникає з відповідної вкладки + Inbox.
  if (undoRef) {
    showUndoToast(`Створено ${undoRef.label} → Відмінити`, () => {
      try {
        if (undoRef.type === 'task') saveTasks(getTasks().filter(t => t.id !== undoRef.id));
        else if (undoRef.type === 'note') saveNotes(getNotes().filter(n => n.id !== undoRef.id));
        else if (undoRef.type === 'habit') saveHabits(getHabits().filter(h => h.id !== undoRef.id));
        saveInbox(getInbox().filter(i => i.id !== inboxCardId));
        renderInbox();
      } catch(e) {}
    });
  }
}


// === COMPLETE HABIT FROM INBOX ===
function processCompleteHabit(parsed, originalText) {
  // Підтримуємо і старий формат (habit_id) і новий (habit_ids масив)
  const ids = parsed.habit_ids || (parsed.habit_id ? [parsed.habit_id] : []);
  if (ids.length === 0) {
    addInboxChatMsg('agent', 'Не зрозумів яку звичку відмітити.');
    return;
  }
  const habits = getHabits();
  const today = new Date().toDateString();
  const log = getHabitLog();
  if (!log[today]) log[today] = {};
  const completed = [];
  ids.forEach(habitId => {
    const habit = habits.find(h => h.id === habitId);
    if (habit) {
      log[today][habit.id] = true;
      completed.push(habit.name);
    }
  });
  if (completed.length === 0) {
    addInboxChatMsg('agent', 'Не знайшов такі звички.');
    return;
  }
  saveHabitLog(log);
  renderProdHabits();
  renderHabits();
  // Зберігаємо в Inbox для історії
  const items = getInbox();
  items.unshift({ id: Date.now(), text: originalText, category: 'habit', ts: Date.now(), processed: true });
  saveInbox(items);
  renderInbox();
  const msg = parsed.comment || (completed.length === 1
    ? `✅ Відмітив звичку "${completed[0]}" як виконану`
    : `✅ Відмітив ${completed.length} звички: ${completed.join(', ')}`);
  addInboxChatMsg('agent', msg);
}

// === COMPLETE TASK FROM INBOX ===
function processCompleteTask(parsed, originalText) {
  // Підтримуємо і старий формат (task_id) і новий (task_ids масив)
  const ids = parsed.task_ids || (parsed.task_id ? [parsed.task_id] : []);
  if (ids.length === 0) {
    addInboxChatMsg('agent', 'Не зрозумів яку задачу закрити.');
    return;
  }
  const tasks = getTasks();
  const completed = [];
  ids.forEach(taskId => {
    const idx = tasks.findIndex(t => t.id === taskId);
    if (idx !== -1) {
      completed.push(tasks[idx].title);
      tasks[idx] = { ...tasks[idx], status: 'done', completedAt: Date.now() };
    }
  });
  if (completed.length === 0) {
    addInboxChatMsg('agent', 'Не знайшов такі задачі.');
    return;
  }
  saveTasks(tasks);
  renderTasks();
  // Зберігаємо в Inbox для історії
  const items = getInbox();
  items.unshift({ id: Date.now(), text: originalText, category: 'task', ts: Date.now(), processed: true });
  saveInbox(items);
  renderInbox();
  const msg = parsed.comment || (completed.length === 1
    ? `✅ Задачу "${completed[0]}" закрито`
    : `✅ Закрив ${completed.length} задачі: ${completed.join(', ')}`);
  addInboxChatMsg('agent', msg);
}



export function getTabbarHeight() {
  const tb = document.getElementById('tab-bar');
  return tb ? tb.offsetHeight : 83;
}


// === WINDOW EXPORTS (HTML handlers only) ===
Object.assign(window, {
  sendToAI, sendClarifyText, closeClarify, selectClarifyOption,
  navigateInboxItem,
});
