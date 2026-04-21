// === UNIFIED OWL BOARD STORAGE ===
// Один мозок V2 · Шар 2 (21.04.2026 rJYkw)
//
// ІДЕЯ: замість 8 окремих ключів (nm_owl_board + nm_owl_tab_{tab} × 7) —
// єдиний масив nm_owl_board_unified. Кожне повідомлення має поле forTab
// (яка вкладка генерувала) і transitionFrom (звідки юзер перейшов).
//
// msgs[0] = ТЕ ЩО БАЧИТЬ юзер на табло ЗАРАЗ, незалежно від активної вкладки.
// Перехід між вкладками НЕ мигає — один і той самий текст лишається.
// Нове повідомлення зʼявляється коли мозок його згенерував (API або локальний fallback).
//
// Backward compat: старі ключі nm_owl_board і nm_owl_tab_* лишаються 2 релізи
// як backup — не видаляємо, тільки не пишемо в них.

const UNIFIED_KEY = 'nm_owl_board_unified';
const UNIFIED_TS_KEY = 'nm_owl_board_unified_ts';
const MIGRATION_FLAG = 'nm_owl_board_migrated_v2';
const MAX_HISTORY = 50;

const ALL_TABS = ['inbox', 'tasks', 'notes', 'me', 'evening', 'finance', 'health', 'projects'];

// === Lazy migration — один раз при першому читанні ===
function _migrateOnce() {
  if (localStorage.getItem(MIGRATION_FLAG)) return;
  try {
    const unified = [];

    // Inbox (старий nm_owl_board — масив)
    try {
      const inboxMsgs = JSON.parse(localStorage.getItem('nm_owl_board') || '[]');
      inboxMsgs.forEach(m => {
        if (m && m.text) unified.push({ ...m, forTab: 'inbox' });
      });
    } catch(e) {}

    // Tab boards (nm_owl_tab_*)
    ALL_TABS.filter(t => t !== 'inbox').forEach(tab => {
      try {
        const raw = JSON.parse(localStorage.getItem('nm_owl_tab_' + tab) || 'null');
        if (!raw) return;
        const arr = Array.isArray(raw) ? raw : [raw];
        arr.forEach(m => { if (m && m.text) unified.push({ ...m, forTab: tab }); });
      } catch(e) {}
    });

    // Сортуємо новіші → старіші за ts
    unified.sort((a, b) => (b.ts || b.id || 0) - (a.ts || a.id || 0));
    const trimmed = unified.slice(0, MAX_HISTORY);
    localStorage.setItem(UNIFIED_KEY, JSON.stringify(trimmed));
    localStorage.setItem(MIGRATION_FLAG, '1');
    console.log('[unified-storage] migrated', trimmed.length, 'messages');
  } catch(e) {
    console.warn('[unified-storage] migration failed:', e?.message);
    // Все одно ставимо флаг — щоб не падати на кожному старті
    try { localStorage.setItem(MIGRATION_FLAG, '1'); } catch(e2) {}
  }
}

// === Core API ===

// Повертає весь масив (новіші → старіші).
export function getUnifiedBoard() {
  _migrateOnce();
  try { return JSON.parse(localStorage.getItem(UNIFIED_KEY) || '[]'); }
  catch { return []; }
}

// Найсвіжіше повідомлення — те що бачить юзер на табло ПРЯМО ЗАРАЗ
// (незалежно від активної вкладки).
export function getCurrentMessage() {
  return getUnifiedBoard()[0] || null;
}

// Повідомлення згенеровані для конкретної вкладки (для історії, антиповтору тощо).
export function getTabMessages(tab) {
  return getUnifiedBoard().filter(m => m.forTab === tab);
}

// Додає нове повідомлення у голову масиву (найсвіжіше).
// msg: { text, topic?, priority?, chips?, ts?, transitionFrom? }
export function saveTabMessage(tab, msg) {
  _migrateOnce();
  const all = getUnifiedBoard();
  const now = Date.now();
  const record = {
    id: msg.id || now,
    ts: msg.ts || now,
    text: msg.text || '',
    topic: msg.topic || '',
    priority: msg.priority || 'normal',
    chips: Array.isArray(msg.chips) ? msg.chips : [],
    forTab: tab,
  };
  if (msg.transitionFrom) record.transitionFrom = msg.transitionFrom;
  all.unshift(record);
  const trimmed = all.slice(0, MAX_HISTORY);
  try {
    localStorage.setItem(UNIFIED_KEY, JSON.stringify(trimmed));
    localStorage.setItem(UNIFIED_TS_KEY, String(now));
  } catch(e) {}
  return record;
}

// Шар 3 (ZJmdF 21.04.2026): знижує priority ранкового брифінгу з 'critical'
// на 'normal' після того як юзер клацнув по чіпу з брифінгу.
// Ідентифікація: topic === 'morning-briefing'.
// Мета: після свідомого переходу брифінг перестає пробивати фільтр priority:critical
// на ВСІХ вкладках — лишається тільки на тій куди юзер зайшов.
// Повертає true якщо щось змінено (щоб викликати re-render).
export function downgradeBriefingPriority() {
  _migrateOnce();
  const all = getUnifiedBoard();
  let changed = false;
  const updated = all.map(m => {
    if (m && m.topic === 'morning-briefing' && m.priority === 'critical') {
      changed = true;
      return { ...m, priority: 'normal' };
    }
    return m;
  });
  if (changed) {
    try { localStorage.setItem(UNIFIED_KEY, JSON.stringify(updated)); } catch(e) {}
  }
  return changed;
}

// Замінити весь масив (використовується рідко — наприклад при clearStaleBoards).
export function replaceUnified(arr) {
  _migrateOnce();
  const trimmed = Array.isArray(arr) ? arr.slice(0, MAX_HISTORY) : [];
  try { localStorage.setItem(UNIFIED_KEY, JSON.stringify(trimmed)); } catch(e) {}
}

// Timestamp останнього запису — для Judge Layer штрафів.
export function getUnifiedTs() {
  try { return parseInt(localStorage.getItem(UNIFIED_TS_KEY) || '0'); }
  catch { return 0; }
}

// === Cross-tab antispam ===
// Останні N тем з УСІХ вкладок — для антиповтору в промпті.
export function getRecentTopicsAllTabs(limit = 8) {
  const msgs = getUnifiedBoard().slice(0, limit);
  return msgs.map(m => ({
    topic: m.topic || '',
    tab: m.forTab,
    ts: m.ts || m.id || 0,
    text: m.text,
  })).filter(x => x.topic || x.text);
}

// Повертає короткий людський опис "нещодавно на вкладках" для промпту.
// Напр. "[5 хв тому · Фінанси] Бюджет 75%  |  [20 хв тому · Нотатки] ..."
export function formatRecentForPrompt(limit = 5) {
  const recent = getUnifiedBoard().slice(0, limit);
  if (recent.length === 0) return '';
  const tabLabels = { inbox: 'Inbox', tasks: 'Продуктивність', notes: 'Нотатки', me: 'Я', evening: 'Вечір', finance: 'Фінанси', health: 'Здоровʼя', projects: 'Проекти' };
  const now = Date.now();
  return recent.map(m => {
    const ago = now - (m.ts || m.id || 0);
    const mins = Math.floor(ago / 60000);
    const when = mins < 1 ? 'щойно' : mins < 60 ? mins + ' хв тому' : Math.floor(mins / 60) + ' год тому';
    const tab = tabLabels[m.forTab] || m.forTab || '?';
    return `[${when} · ${tab}] ${m.text}`;
  }).join('\n');
}
