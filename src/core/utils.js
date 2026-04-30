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
  if (diff < 60000) return t('time.just_now', 'щойно');
  if (diff < 3600000) return Math.floor(diff / 60000) + t('time.minutes_ago', ' хв тому');
  if (diff < 86400000) return Math.floor(diff / 3600000) + t('time.hours_ago', ' год тому');
  return new Date(ts).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' });
}

export function escapeHtml(s) {
  // B-70 fix (17.04.2026): захист від undefined/null/number/object. Раніше undefined.replace
  // кидав TypeError і ламав цілі блоки рендеру (приклад — _finCatsGrid).
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// Розбиває AI-відповідь на окремі JSON-об'єкти (17.04.2026 сесія 14zLe).
// Причина: AI на запит "видали X, Y, Z, додай A" повертає кілька {...} блоків
// один за одним. Стара логіка з /\{[\s\S]*\}/ жадібно захоплювала все як один
// блок — JSON.parse падав, юзер бачив сирий JSON у чаті.
// Балансує фігурні дужки з урахуванням рядків у лапках (щоб { у value не ламав
// парсер). Повертає масив розпарсених об'єктів. Використовується у всіх chat-
// барах: tasks, habits, evening, health, projects, finance. Inbox на
// tool calling — не потребує цієї утиліти.
export function extractJsonBlocks(text) {
  if (!text) return [];
  const blocks = [];
  let depth = 0, start = -1, inStr = false, esc = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (esc) { esc = false; continue; }
    if (c === '\\' && inStr) { esc = true; continue; }
    if (c === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (c === '{') {
      if (depth === 0) start = i;
      depth++;
    } else if (c === '}') {
      depth--;
      if (depth === 0 && start !== -1) {
        try { blocks.push(JSON.parse(text.slice(start, i + 1))); } catch {}
        start = -1;
      }
    }
  }
  return blocks;
}

// B-87 fix (20.04.2026 NRw8G): парсер content AI-відповіді — витягує перший
// JSON-блок {chips:[...]} і повертає { text, chips } з text БЕЗ JSON частини.
// Використовує depth-tracking (балансує фігурні дужки з урахуванням рядків)
// щоб точно вирізати цілий JSON-блок. Старий жадібно-лазливий регекс
// /\{[\s\S]*?"chips"[\s\S]*?\}/g ріс на першому `}` після "chips" (всередині
// першого чіп-об'єкта) і лишав решту `{...}]}` як сміття у тексті.
export function parseContentChips(content) {
  if (!content || typeof content !== 'string') return { text: content || '', chips: null };
  const ranges = [];
  let depth = 0, start = -1, inStr = false, esc = false;
  for (let i = 0; i < content.length; i++) {
    const c = content[i];
    if (esc) { esc = false; continue; }
    if (c === '\\' && inStr) { esc = true; continue; }
    if (c === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (c === '{') {
      if (depth === 0) start = i;
      depth++;
    } else if (c === '}') {
      depth--;
      if (depth === 0 && start !== -1) { ranges.push([start, i + 1]); start = -1; }
    }
  }
  let chips = null, cutRange = null;
  for (const [s, e] of ranges) {
    try {
      const obj = JSON.parse(content.slice(s, e));
      if (obj && Array.isArray(obj.chips)) { chips = obj.chips; cutRange = [s, e]; break; }
    } catch {}
  }
  if (cutRange) {
    const text = (content.slice(0, cutRange[0]) + content.slice(cutRange[1]))
      .replace(/\s+([,.!?])/g, '$1')
      .replace(/\s{2,}/g, ' ')
      .trim();
    return { text, chips };
  }
  return { text: content.trim(), chips: null };
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

// === i18n заглушка (24.04.2026 nudNp правило, 29.04.2026 m4Q1o реалізація) ===
// Поки повертає fallback (українську). Колись словник у `src/i18n/<lang>.json`
// замінить fallback на переклад. Параметри підставляються через {name}-плейсхолдери:
//   t('greeting', 'Привіт, {name}!', { name: 'Роман' }) → "Привіт, Роман!"
// Використовуємо replaceAll (не RegExp у циклі) — швидше і безпечніше від спецсимволів
// у значеннях. CI-скрипт scripts/check-i18n.js ламає білд якщо новий рядок з кирилицею
// не обгорнутий у t(). AI-промпти у src/ai/* лишаємо українськими (whitelist).
export function t(key, fallback, params) {
  let result = fallback;
  if (params && typeof params === 'object') {
    for (const [k, v] of Object.entries(params)) {
      result = result.replaceAll(`{${k}}`, String(v));
    }
  }
  return result;
}

// Functions called from HTML event handlers
window.autoResizeTextarea = autoResizeTextarea;
