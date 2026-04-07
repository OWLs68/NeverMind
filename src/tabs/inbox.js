// ============================================================
// app-inbox.js — Inbox — чат, рендер, swipe, sendToAI, processSave, clarify
// Функції: addInboxChatMsg, renderInbox, swipeStart/Move/End, sendToAI, processSaveAction, processCompleteHabit, processCompleteTask, showClarify
// Залежності: app-core.js, app-ai.js
// ============================================================

import { currentTab } from '../core/nav.js';
import { escapeHtml, saveOffline } from '../core/utils.js';
import { addToTrash, getTrash, restoreFromTrash, showUndoToast } from '../core/trash.js';
import { INBOX_SYSTEM_PROMPT, callAI, callAIWithHistory, getAIContext, saveChatMsg, activeChatBar } from '../ai/core.js';
import { handleScheduleAnswer } from '../owl/inbox-board.js';
import { SWIPE_DELETE_THRESHOLD, applySwipeTrail, clearSwipeTrail } from '../ui/swipe-delete.js';
import { getTasks, saveTasks, renderTasks, autoGenerateTaskSteps } from './tasks.js';
import { getEvents, saveEvents } from './calendar.js';
import { getHabits, saveHabits, getHabitLog, saveHabitLog, renderHabits, renderProdHabits, processUniversalAction } from './habits.js';
import { addNoteFromInbox } from './notes.js';
import { getFinance, saveFinance, renderFinance, formatMoney, processFinanceAction } from './finance.js';
import { getMoments, saveMoments, generateMomentSummary } from './evening.js';
import { getProjects, saveProjects, startProjectInboxInterview } from './projects.js';
import { handleSurveyAnswer, maybeAskGuideQuestion, saveGuideTopicAnswer } from './onboarding.js';

// === INBOX CHAT MESSAGES ===
let _inboxTypingEl = null;

export function addInboxChatMsg(role, text) {
  const el = document.getElementById('inbox-chat-messages');
  if (!el) return;

  // Видаляємо typing індикатор якщо є
  if (_inboxTypingEl) { _inboxTypingEl.remove(); _inboxTypingEl = null; }

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
        ? `${mins} хв тому`
        : mins < 1440
        ? `${Math.round(mins/60)} год тому`
        : 'раніше';
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
  el.scrollTop = el.scrollHeight;
  saveChatMsg('inbox', role, text);

  // Якщо агент надіслав повідомлення а чат закритий — показуємо бейдж
  if (role === 'agent') {
    const bar = document.getElementById('inbox-ai-bar');
    const chatWin = bar ? bar.querySelector('.ai-bar-chat-window') : null;
    const isOpen = chatWin && chatWin.classList.contains('open');
    if (!isOpen) _showInboxUnreadBadge();
  }
}

let _inboxUnreadCount = 0;
function _showInboxUnreadBadge() {
  _inboxUnreadCount++;
  let badge = document.getElementById('inbox-chat-badge');
  if (!badge) {
    const sendBtn = document.getElementById('ai-send-btn');
    if (!sendBtn) return;
    badge = document.createElement('div');
    badge.id = 'inbox-chat-badge';
    badge.style.cssText = 'position:absolute;top:-4px;right:-4px;width:16px;height:16px;border-radius:50%;background:#ef4444;color:white;font-size:10px;font-weight:800;display:flex;align-items:center;justify-content:center;pointer-events:none;z-index:10';
    sendBtn.style.position = 'relative';
    sendBtn.appendChild(badge);
  }
  badge.textContent = _inboxUnreadCount > 9 ? '9+' : _inboxUnreadCount;
}

export function _clearInboxUnreadBadge() {
  _inboxUnreadCount = 0;
  const badge = document.getElementById('inbox-chat-badge');
  if (badge) badge.remove();
}

// Внутрішній рендер без запису в storage (щоб не дублювати при відновленні)
const CAT_DOT_BG = {
  task:    'background:rgba(47,208,249,0.2)',
  idea:    'background:rgba(236,247,85,0.3)',
  note:    'background:rgba(180,140,90,0.15)',
  habit:   'background:rgba(22,163,74,0.15)',
  event:   'background:rgba(59,130,246,0.15)',
  finance: 'background:rgba(194,65,12,0.15)',
};
// Solid кольори для 8px крапки в компактній стрічці
const CAT_DOT_SOLID = {
  task:    'background:#2fd0f9',
  idea:    'background:#c4b820',
  note:    'background:#a07850',
  habit:   'background:#16a34a',
  event:   'background:#3b82f6',
  finance: 'background:#c2410c',
};
const CAT_TAG_STYLE = {
  task:    'background:rgba(47,208,249,0.2);color:#0a7a97',
  idea:    'background:rgba(245,240,168,0.5);color:#7a6c00',
  note:    'background:rgba(180,140,90,0.2);color:#6a4a1a',
  habit:   'background:rgba(22,163,74,0.15);color:#14532d',
  event:   'background:rgba(59,130,246,0.15);color:#1d4ed8',
  finance: 'background:rgba(194,65,12,0.15);color:#7c2d12',
};
const CAT_META = {
  idea:    { icon: '💡', label: 'Ідея',     dotClass: 'cat-dot-idea',    tagClass: 'cat-idea'    },
  task:    { icon: '📌', label: 'Задача',   dotClass: 'cat-dot-task',    tagClass: 'cat-task'    },
  habit:   { icon: '🌱', label: 'Звичка',   dotClass: 'cat-dot-habit',   tagClass: 'cat-habit'   },
  note:    { icon: '📝', label: 'Нотатка',  dotClass: 'cat-dot-note',    tagClass: 'cat-note'    },
  event:   { icon: '📅', label: 'Подія',    dotClass: 'cat-dot-event',   tagClass: 'cat-event'   },
  finance: { icon: '₴',  label: 'Фінанси',  dotClass: 'cat-dot-finance', tagClass: 'cat-finance' },
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
  if (diff === 0) return 'СЬОГОДНІ';
  if (diff === 1) return 'ВЧОРА';
  const months = ['СІЧ','ЛЮТ','БЕР','КВІТ','ТРАВ','ЧЕРВ','ЛИП','СЕРП','ВЕР','ЖОВТ','ЛИСТ','ГРУД'];
  return `${d.getDate()} ${months[d.getMonth()]}`;
}

// Тап: розгорнути/згорнути текст картки (блокується після свайпу)
let _inboxSwipedRecently = false;
function toggleInboxExpand(id) {
  if (_inboxSwipedRecently) return;
  const el = document.getElementById('item-' + id);
  if (!el) return;
  el.classList.toggle('inbox-expanded');
}

export function renderInbox() {
  const items = getInbox();
  const list = document.getElementById('inbox-list');
  const countEl = document.getElementById('inbox-count');

  if (items.length === 0) {
    list.innerHTML = `<div class="inbox-empty">
      <div class="inbox-empty-icon">📥</div>
      <div class="inbox-empty-title">Inbox порожній</div>
      <div class="inbox-empty-sub">Напиши що завгодно — Агент розбереться</div>
    </div>`;
    countEl.style.display = 'none';
    return;
  }
  countEl.style.display = 'inline';
  countEl.textContent = items.length;

  let html = '';
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

    html += `<div class="inbox-item-wrap" id="wrap-${item.id}">
      <div class="inbox-item" id="item-${item.id}" data-id="${item.id}" data-cat="${item.category}"
           ontouchstart="swipeStart(event,${item.id})"
           ontouchmove="swipeMove(event,${item.id})"
           ontouchend="swipeEnd(event,${item.id})"
           onclick="toggleInboxExpand(${item.id})">
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
}

// === SWIPE TO DELETE ===
const swipeState = {};

function swipeStart(e, id) {
  const t = e.touches[0];
  swipeState[id] = { startX: t.clientX, startY: t.clientY, dx: 0, swiping: false };
}
function swipeMove(e, id) {
  const s = swipeState[id]; if (!s) return;
  const t = e.touches[0];
  const dx = t.clientX - s.startX, dy = t.clientY - s.startY;
  if (!s.swiping && Math.abs(dy) > Math.abs(dx)) return;
  if (!s.swiping && Math.abs(dx) > 8) s.swiping = true;
  if (!s.swiping) return;
  e.preventDefault();
  s.dx = Math.min(0, dx);
  const el = document.getElementById(`item-${id}`);
  const wrap = document.getElementById(`wrap-${id}`);
  applySwipeTrail(el, wrap, s.dx);
}
function swipeEnd(e, id) {
  const s = swipeState[id]; if (!s) return;
  if (s.swiping) { _inboxSwipedRecently = true; setTimeout(() => _inboxSwipedRecently = false, 50); }
  const el = document.getElementById(`item-${id}`);
  const wrap = document.getElementById(`wrap-${id}`);
  if (s.dx < -SWIPE_DELETE_THRESHOLD) {
    if (el) { el.style.transition = 'transform 0.2s ease, opacity 0.2s'; el.style.transform = 'translateX(-110%)'; el.style.opacity = '0'; }
    if (wrap) { wrap.style.transition = 'background 0.2s ease'; wrap.style.background = 'rgba(239,68,68,0.15)'; }
    setTimeout(() => {
      const allItems = getInbox();
      const originalIdx = allItems.findIndex(i => i.id === id);
      const item = allItems.find(i => i.id === id);
      if (item) addToTrash('inbox', item);
      saveInbox(allItems.filter(i => i.id !== id)); renderInbox();
      if (item) showUndoToast('Видалено з Inbox', () => { const items = getInbox(); const idx = Math.min(originalIdx, items.length); items.splice(idx, 0, item); saveInbox(items); renderInbox(); });
    }, 220);
  } else {
    clearSwipeTrail(el, wrap);
  }
  delete swipeState[id];
}

// === UNIFIED SEND TO AI ===
let aiLoading = false;
let inboxChatHistory = []; // зберігає останні 6 обмінів
let _lastUserMsgTs = 0; // timestamp останнього повідомлення юзера
const SEND_SVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>`;

function unifiedInputKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendToAI(); }
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
    ? `\n\n[Увага: між попереднім і цим повідомленням пройшло ${Math.round(gapMs/60000)} хв — це може бути нова незалежна думка, не продовження попереднього. Але НЕ припускай автоматично — просто зберігай як окремий запис без уточнень якщо все зрозуміло.]`
    : '';
  const fullPrompt = aiContext ? `${INBOX_SYSTEM_PROMPT}${gapContext}\n\n${aiContext}` : `${INBOX_SYSTEM_PROMPT}${gapContext}`;
  // Build history for context — but keep it short so JSON format is not broken
  inboxChatHistory.push({ role: 'user', content: text });
  if (inboxChatHistory.length > 24) inboxChatHistory = inboxChatHistory.slice(-24);
  // Передаємо останні 12 повідомлень — достатньо для контексту розмови
  const historySlice = inboxChatHistory.slice(-12);
  const reply = await callAIWithHistory(fullPrompt, historySlice);

  if (reply) {
    try {
      const clean = reply.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(clean);

      // Save assistant reply to history for context
      inboxChatHistory.push({ role: 'assistant', content: reply });

      // Підтримка масиву дій — агент може повернути [{action:...}, {action:...}]
      const actions = Array.isArray(parsed) ? parsed : [parsed];

      for (const action of actions) {
        if (action.action === 'clarify') {
          showClarify(action, text);
          aiLoading = false;
          btn.disabled = false;
          btn.innerHTML = SEND_SVG;
          return;
        }
        if (action.action === 'save') {
          if (fromChip) {
            // Чіп-клік не створює нових записів у Inbox — це відповідь на табло, не нова задача
            addInboxChatMsg('agent', 'Окей, записав у чат як відповідь.');
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
            addInboxChatMsg('agent', 'Не знайшов транзакцію. Спробуй ще раз.');
          }
        } else if (action.action === 'complete_habit') {
          await processCompleteHabit(action, text);
        } else if (action.action === 'complete_task') {
          await processCompleteTask(action, text);
        } else if (action.action === 'add_step') {
          const tasks = getTasks();
          const idx = tasks.findIndex(t => t.id === action.task_id);
          if (idx !== -1) {
            const steps = Array.isArray(action.steps) ? action.steps : (action.step ? [action.step] : []);
            steps.forEach(s => tasks[idx].steps.push({ id: Date.now() + Math.random(), text: s, done: false }));
            saveTasks(tasks);
            renderTasks();
            addInboxChatMsg('agent', `✓ Додано ${steps.length} крок(и) до "${tasks[idx].title}"`);
          } else {
            addInboxChatMsg('agent', 'Не знайшов задачу. Спробуй через вкладку Продуктивність.');
          }
        } else if (action.action === 'create_project' && !fromChip) {
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
          const ev = { id: Date.now(), title: action.title || 'Подія', date: action.date, time: action.time || null, priority: action.priority || 'normal', createdAt: Date.now() };
          const events = getEvents();
          events.unshift(ev);
          saveEvents(events);
          const items = getInbox(); items.unshift({ id: Date.now() + 1, text: ev.title, category: 'event', ts: Date.now(), processed: true }); saveInbox(items); renderInbox();
          const dateObj = new Date(action.date);
          const dayStr = `${dateObj.getDate()} ${['січня','лютого','березня','квітня','травня','червня','липня','серпня','вересня','жовтня','листопада','грудня'][dateObj.getMonth()]}`;
          addInboxChatMsg('agent', `📅 Подію "${ev.title}" додано в календар на ${dayStr}${action.time ? ' о ' + action.time : ''}`);
        } else if (action.action === 'restore_deleted') {
          const q = (action.query || '').trim();
          const typeFilter = action.type || null;
          const trash = getTrash().filter(t => Date.now() - t.deletedAt < 7 * 24 * 60 * 60 * 1000);
          const typeLabel = { task:'задачу', note:'нотатку', habit:'звичку', inbox:'запис', folder:'папку', finance:'транзакцію' };
          const typeIcon = { task:'📋', note:'📝', habit:'🌱', inbox:'📥', folder:'📁', finance:'💰' };

          // Фільтруємо по типу якщо вказано
          const filtered = typeFilter ? trash.filter(t => t.type === typeFilter) : trash;

          if (q === 'all') {
            // Відновити всі (або всі певного типу)
            if (filtered.length === 0) {
              addInboxChatMsg('agent', 'Кеш видалених порожній. Записи зберігаються 7 днів.');
            } else {
              filtered.forEach(t => restoreFromTrash(t.deletedAt));
              const label = typeFilter ? (typeLabel[typeFilter] + 'и/ки') : 'записів';
              addInboxChatMsg('agent', `✅ Відновив ${filtered.length} ${label}`);
            }
          } else if (q === 'last') {
            // Відновити останній видалений (або останній певного типу)
            const last = filtered.sort((a, b) => b.deletedAt - a.deletedAt)[0];
            if (!last) {
              addInboxChatMsg('agent', 'Нічого не знайшов в кеші видалених.');
            } else {
              const itemLabel = last.item.text || last.item.title || last.item.name || last.item.folder || 'запис';
              restoreFromTrash(last.deletedAt);
              addInboxChatMsg('agent', `✅ Відновив ${typeLabel[last.type] || 'запис'} "${itemLabel}"`);
            }
          } else {
            // Пошук по ключових словах
            const words = q.toLowerCase().split(/[\s,]+/).filter(Boolean);
            const results = filtered.filter(t => {
              const text = (t.item.text || t.item.title || t.item.name || t.item.folder || '').toLowerCase();
              return words.some(w => text.includes(w));
            }).sort((a, b) => b.deletedAt - a.deletedAt);

            if (results.length === 0) {
              addInboxChatMsg('agent', 'Не знайшов нічого схожого в кеші видалених. Записи зберігаються 7 днів.');
            } else if (results.length === 1) {
              const entry = results[0];
              const itemLabel = entry.item.text || entry.item.title || entry.item.name || entry.item.folder || 'запис';
              restoreFromTrash(entry.deletedAt);
              addInboxChatMsg('agent', `✅ Відновив ${typeLabel[entry.type] || 'запис'} "${itemLabel}"`);
            } else if (results.length <= 5) {
              // Кілька — відновлюємо всі що підходять
              results.forEach(t => restoreFromTrash(t.deletedAt));
              const labels = results.map(e => `${typeIcon[e.type] || '•'} ${(e.item.text || e.item.title || e.item.name || '').substring(0, 35)}`).join('\n');
              addInboxChatMsg('agent', `✅ Відновив ${results.length} записи:\n${labels}`);
            } else {
              // Забагато результатів — показуємо і просимо уточнити
              const list = results.slice(0, 5).map(e => {
                const lbl = (e.item.text || e.item.title || e.item.name || e.item.folder || 'запис').substring(0, 40);
                const ago = Math.round((Date.now() - e.deletedAt) / 86400000);
                return `${typeIcon[e.type] || '•'} ${lbl} (${ago === 0 ? 'сьогодні' : ago + ' дн. тому'})`;
              }).join('\n');
              addInboxChatMsg('agent', `Знайшов ${results.length} схожих. Ось перші 5:\n${list}\n\nУточни який саме, або скажи "відновити всі".`);
            }
          }
        } else if (processUniversalAction(action, text, addInboxChatMsg)) {
          // delete_folder, move_note, create_task, create_note тощо
        } else {
          // action === 'reply' — просто відповідь
          const replyText = action.comment || reply;
          addInboxChatMsg('agent', replyText);
        }
      }
    } catch(e) {
      console.error('JSON parse error:', e);
      // Спробуємо витягти clarify з часткового JSON
      try {
        const jsonMatch = (reply||'').match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const p2 = JSON.parse(jsonMatch[0]);
          if (p2.action === 'clarify') {
            showClarify(p2, text);
            aiLoading = false; btn.disabled = false; btn.innerHTML = SEND_SVG;
            return;
          }
        }
      } catch(e2) {}
      saveOffline(text);
      addInboxChatMsg('agent', '✓ Збережено');
    }
  } else {
    saveOffline(text);
    addInboxChatMsg('agent', '📝 Збережено в Inbox. Інтернет недоступний — Агент не визначив категорію. Надішли ще раз коли буде мережа.');
  }

  aiLoading = false;
  btn.disabled = false;
  btn.innerHTML = SEND_SVG;
  // Органічне питання провідника (25% шанс, не частіше 3 хв)
  try { maybeAskGuideQuestion(); } catch(e) {}
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
    return `<button onclick="selectClarifyOption(${i})" style="width:100%;display:flex;align-items:center;gap:10px;background:${isPrimary ? 'rgba(124,58,237,0.05)' : 'rgba(30,16,64,0.03)'};border:1.5px solid ${isPrimary ? 'rgba(124,58,237,0.2)' : 'rgba(30,16,64,0.08)'};border-radius:13px;padding:12px 14px;font-size:14px;font-weight:600;color:${isPrimary ? '#7c3aed' : '#1e1040'};cursor:pointer;text-align:left;font-family:inherit">${escapeHtml(opt.label || '')}</button>`;
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
  closeClarify();
  // Відправляємо уточнення назад в ШІ разом з оригінальним текстом
  const key = localStorage.getItem('nm_gemini_key');
  if (!key) return;
  const fullPrompt = getAIContext() ? `${INBOX_SYSTEM_PROMPT}\n\n${getAIContext()}` : INBOX_SYSTEM_PROMPT;
  const combinedMsg = `Оригінальний запис: "${clarifyOriginalText}". Уточнення від користувача: "${text}"`;
  clarifyOriginalText = null;
  clarifyParsed = null;
  const reply = await callAI(fullPrompt, combinedMsg, {});
  if (reply) {
    try {
      const parsed = JSON.parse(reply.replace(/\`\`\`json|\`\`\`/g, '').trim());
      if (parsed.action === 'save') await processSaveAction(parsed, combinedMsg);
      else if (parsed.action === 'complete_habit') processCompleteHabit(parsed, combinedMsg);
      else if (parsed.action === 'complete_task') processCompleteTask(parsed, combinedMsg);
      else if (parsed.action === 'reply') addInboxChatMsg('agent', parsed.comment || reply);
    } catch(e) {}
  }
}

// Виносимо логіку збереження в окрему функцію щоб використовувати і з clarify і з sendToAI
async function processSaveAction(parsed, originalText) {
  const catMap = {'нотатка':'note','задача':'task','звичка':'habit','ідея':'idea','подія':'event'};
  const rawCat = (parsed.category || '').toLowerCase();
  const cat = ['idea','task','habit','note','event'].includes(rawCat) ? rawCat : (catMap[rawCat] || 'note');
  const savedText = parsed.text || originalText;
  const folder = parsed.folder || null;
  const items = getInbox();
  items.unshift({ id: Date.now(), text: savedText, category: cat, ts: Date.now(), processed: true });
  saveInbox(items);
  renderInbox();

  if (cat === 'task') {
    const taskId = Date.now();
    const tasks = getTasks();
    const taskTitle = parsed.task_title || savedText;
    const taskSteps = Array.isArray(parsed.task_steps) && parsed.task_steps.length > 0
      ? parsed.task_steps.map(s => ({ id: Date.now() + Math.random(), text: s, done: false }))
      : [];
    const newTask = { id: taskId, title: taskTitle, desc: savedText !== taskTitle ? savedText : '', steps: taskSteps, status: 'active', createdAt: taskId };
    if (parsed.dueDate) newTask.dueDate = parsed.dueDate;
    if (parsed.priority && ['normal','important','critical'].includes(parsed.priority)) newTask.priority = parsed.priority;
    tasks.unshift(newTask);
    saveTasks(tasks);
    if (taskSteps.length === 0) autoGenerateTaskSteps(taskId, taskTitle);
  }
  if (cat === 'note' || cat === 'idea') addNoteFromInbox(savedText, cat, folder);
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
      const habitDetails = savedText.length > habitName.length + 2 ? savedText.substring(habitName.length).replace(/^[,.\s]+/,'').trim() : '';

      // Витягуємо кількість разів — з parsed або з тексту
      let targetCount = parseInt(parsed.targetCount) || 1;
      if (targetCount === 1) {
        const countMatch = txt.match(/(\d+)\s*(рази?|раз|разів|склянок|склянки|стакан|кроків|хвилин|разу)/i);
        if (countMatch) targetCount = Math.min(20, Math.max(2, parseInt(countMatch[1])));
      }

      habits.push({ id: Date.now(), name: habitName, details: habitDetails, emoji: '⭕', days, targetCount, createdAt: Date.now() });
      saveHabits(habits);
    }
  }
  if (cat === 'event') {
    const mood = /добре|чудово|супер|відмінно|весело|щасли/i.test(savedText) ? 'positive' :
                 /погано|жахливо|сумно|нудно|важко|втомив/i.test(savedText) ? 'negative' : 'neutral';
    const moments = getMoments();
    const newMoment = { id: Date.now(), text: savedText, mood, ts: Date.now() };
    moments.push(newMoment);
    saveMoments(moments);
    generateMomentSummary(newMoment.id, savedText);
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
  toggleInboxExpand, swipeStart, swipeMove, swipeEnd,
});
