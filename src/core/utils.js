import { getInbox, saveInbox, renderInbox } from '../tabs/inbox.js';

export function autoResizeTextarea(el) {
  el.style.height = 'auto';
  const maxH = Math.floor(window.innerHeight * 0.5 - 20);
  el.style.height = Math.min(el.scrollHeight, maxH) + 'px';
  // Оновлюємо висоту чат-вікна якщо воно відкрите
  const bar = el.closest('.ai-bar-new');
  if (bar) {
    const cw = bar.querySelector('.ai-bar-chat-window.open');
    if (cw) updateChatWindowHeight(bar.id.replace('-ai-bar', ''));
  }
}

// Розраховує висоту чат-вікна: від низу board до верху input-box
export function updateChatWindowHeight(tab) {
  const bar = document.getElementById(tab + '-ai-bar');
  if (!bar) return;
  const chatWin = bar.querySelector('.ai-bar-chat-window');
  if (!chatWin) return;
  const inputBox = bar.querySelector('.ai-bar-input-box');
  const inputRect = inputBox ? inputBox.getBoundingClientRect() : null;
  const inputTop = inputRect ? inputRect.top : window.innerHeight - 140;

  // Знаходимо board поточної вкладки
  const boardId = tab === 'inbox' ? 'owl-board' : 'owl-tab-board-' + tab;
  const board = document.getElementById(boardId);
  let topBound = 80; // fallback
  if (board) {
    const br = board.getBoundingClientRect();
    if (br.bottom > 0 && br.bottom < inputTop) topBound = br.bottom + 8;
  }

  const maxH = inputTop - topBound - 8;
  chatWin.style.maxHeight = Math.max(150, maxH) + 'px';
  chatWin.style.height    = Math.max(150, maxH) + 'px';
}

// Офлайн-fallback: зберігає миттєво як нотатку
export function saveOffline(text) {
  const items = getInbox();
  items.unshift({ id: Date.now(), text, category: 'note', ts: Date.now(), processed: false });
  saveInbox(items);
  renderInbox();

}

export function formatTime(ts) {
  const diff = Date.now() - ts;
  if (diff < 60000) return 'щойно';
  if (diff < 3600000) return Math.floor(diff / 60000) + ' хв тому';
  if (diff < 86400000) return Math.floor(diff / 3600000) + ' год тому';
  return new Date(ts).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' });
}

export function escapeHtml(s) {
  // B-70 fix (17.04.2026): захист від undefined/null/number/object. Раніше undefined.replace
  // кидав TypeError і ламав цілі блоки рендеру (приклад — _finCatsGrid).
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// === Міні-лог останніх дій для крос-контексту OWL ===
const NM_RECENT_ACTIONS_KEY = 'nm_recent_actions';
const NM_RECENT_ACTIONS_MAX = 20;

export function logRecentAction(action, title, tab) {
  try {
    const actions = JSON.parse(localStorage.getItem(NM_RECENT_ACTIONS_KEY) || '[]');
    actions.push({ action, title, tab, ts: Date.now() });
    if (actions.length > NM_RECENT_ACTIONS_MAX) actions.splice(0, actions.length - NM_RECENT_ACTIONS_MAX);
    localStorage.setItem(NM_RECENT_ACTIONS_KEY, JSON.stringify(actions));
  } catch(e) {}
}

export function getRecentActions() {
  try { return JSON.parse(localStorage.getItem(NM_RECENT_ACTIONS_KEY) || '[]'); } catch { return []; }
}

// Functions called from HTML event handlers
window.autoResizeTextarea = autoResizeTextarea;
