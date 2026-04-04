// ============================================================
// app-core-system.js — Trash, PWA, OWL board, ініціалізація
// Залежності: app-core-nav.js
// ============================================================

// === TRASH CACHE (кеш видалених — 7 днів) ===
const NM_TRASH_KEY = 'nm_trash';
const TRASH_TTL = 7 * 24 * 60 * 60 * 1000; // 7 днів

function getTrash() {
  try { return JSON.parse(localStorage.getItem(NM_TRASH_KEY) || '[]'); } catch { return []; }
}
function saveTrash(arr) {
  localStorage.setItem(NM_TRASH_KEY, JSON.stringify(arr));
}

// Додати запис в кеш при видаленні
function addToTrash(type, item, extra) {
  const trash = getTrash();
  // Прибираємо старіші за 7 днів
  const now = Date.now();
  const fresh = trash.filter(t => now - t.deletedAt < TRASH_TTL);
  fresh.push({ type, item, extra: extra || null, deletedAt: now });
  // Максимум 200 записів
  saveTrash(fresh.slice(-200));
}

// Пошук в кеші — для агента
function searchTrash(query) {
  const trash = getTrash();
  const now = Date.now();
  const q = query.toLowerCase();
  return trash
    .filter(t => now - t.deletedAt < TRASH_TTL)
    .filter(t => {
      const item = t.item;
      const text = (item.text || item.title || item.name || item.category || '').toLowerCase();
      const folder = (item.folder || '').toLowerCase();
      return text.includes(q) || folder.includes(q);
    })
    .sort((a, b) => b.deletedAt - a.deletedAt);
}

// Відновити запис з кешу по id
function restoreFromTrash(trashId) {
  const trash = getTrash();
  const entry = trash.find(t => t.deletedAt === trashId);
  if (!entry) return false;
  const { type, item, extra } = entry;
  if (type === 'task') {
    const tasks = getTasks();
    tasks.unshift(item);
    saveTasks(tasks);
    if (currentTab === 'tasks') renderTasks();
  } else if (type === 'note') {
    const notes = getNotes();
    notes.unshift(item);
    saveNotes(notes);
    if (currentTab === 'notes') renderNotes();
  } else if (type === 'habit') {
    const habits = getHabits();
    habits.push(item);
    saveHabits(habits);
    renderHabits(); renderProdHabits();
  } else if (type === 'inbox') {
    const items = getInbox();
    items.unshift(item);
    saveInbox(items);
    if (currentTab === 'inbox') renderInbox();
  } else if (type === 'folder') {
    // extra = масив нотаток папки
    const notes = getNotes();
    (extra || []).forEach(n => notes.push(n));
    saveNotes(notes);
    if (currentTab === 'notes') renderNotes();
  } else if (type === 'finance') {
    const txs = getFinance();
    txs.unshift(item);
    saveFinance(txs);
    if (currentTab === 'finance') renderFinance();
  }
  // Прибираємо з кешу після відновлення
  saveTrash(trash.filter(t => t.deletedAt !== trashId));
  return true;
}

// Очистка кешу — викликається при старті
function cleanupTrash() {
  const trash = getTrash();
  const now = Date.now();
  const fresh = trash.filter(t => now - t.deletedAt < TRASH_TTL);
  if (fresh.length !== trash.length) saveTrash(fresh);
}

function showUndoToast(msg, restoreFn) {
  // Показує toast з кнопкою "Відновити" на 10 секунд
  const el = document.getElementById('toast');
  const msgEl = document.getElementById('toast-msg');
  const btn = document.getElementById('toast-undo-btn');
  msgEl.textContent = msg;
  btn.style.display = 'inline-block';
  _undoData = restoreFn;
  if (_undoToastTimer) clearTimeout(_undoToastTimer);
  el.classList.add('show');
  _undoToastTimer = setTimeout(() => {
    el.classList.remove('show');
    _undoData = null;
  }, 10000);
}

function undoDelete() {
  if (_undoData) {
    _undoData(); // викликаємо функцію відновлення
    _undoData = null;
  }
  if (_undoToastTimer) clearTimeout(_undoToastTimer);
  document.getElementById('toast').classList.remove('show');
}

// === PWA MANIFEST ===
function setupPWA() {
  const manifest = {
    name: 'NeverMind',
    short_name: 'NeverMind',
    start_url: '/',
    display: 'standalone',
    background_color: '#faf9ff',
    theme_color: '#f5f1ff',
    icons: [{
      src: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxOTIgMTkyIj48cmVjdCB3aWR0aD0iMTkyIiBoZWlnaHQ9IjE5MiIgcng9IjM4IiBmaWxsPSIjMWUzYTVmIi8+PGNpcmNsZSBjeD0iNDQiIGN5PSI2NiIgcj0iMTAiIGZpbGw9IndoaXRlIiBvcGFjaXR5PSIwLjIiLz48cGF0aCBkPSJNNDQsNzYgUTM4LDkyIDQwLDExMiIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLXdpZHRoPSI2IiBmaWxsPSJub25lIiBzdHJva2UtbGluZWNhcD0icm91bmQiIG9wYWNpdHk9IjAuMiIvPjxwYXRoIGQ9Ik00Miw5MiBMMjgsMTA4IiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjUiIGZpbGw9Im5vbmUiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgb3BhY2l0eT0iMC4yIi8+PHBhdGggZD0iTTQyLDkyIEw1MiwxMDYiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS13aWR0aD0iNSIgZmlsbD0ibm9uZSIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBvcGFjaXR5PSIwLjIiLz48cGF0aCBkPSJNNDAsMTEyIEwzMiwxMzgiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS13aWR0aD0iNSIgZmlsbD0ibm9uZSIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBvcGFjaXR5PSIwLjIiLz48cGF0aCBkPSJNNDAsMTEyIEw0OCwxMzgiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS13aWR0aD0iNSIgZmlsbD0ibm9uZSIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBvcGFjaXR5PSIwLjIiLz48Y2lyY2xlIGN4PSI5NiIgY3k9IjYyIiByPSIxMCIgZmlsbD0id2hpdGUiIG9wYWNpdHk9IjAuNSIvPjxwYXRoIGQ9Ik05Niw3MiBMOTYsMTE0IiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjYiIGZpbGw9Im5vbmUiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgb3BhY2l0eT0iMC41Ii8+PHBhdGggZD0iTTk2LDkwIEw4MCwxMDQiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS13aWR0aD0iNSIgZmlsbD0ibm9uZSIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBvcGFjaXR5PSIwLjUiLz48cGF0aCBkPSJNOTYsOTAgTDExMiwxMDQiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS13aWR0aD0iNSIgZmlsbD0ibm9uZSIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBvcGFjaXR5PSIwLjUiLz48cGF0aCBkPSJNOTYsMTE0IEw4NiwxNDAiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS13aWR0aD0iNSIgZmlsbD0ibm9uZSIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBvcGFjaXR5PSIwLjUiLz48cGF0aCBkPSJNOTYsMTE0IEwxMDYsMTQwIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjUiIGZpbGw9Im5vbmUiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgb3BhY2l0eT0iMC41Ii8+PGNpcmNsZSBjeD0iMTUwIiBjeT0iNTgiIHI9IjExIiBmaWxsPSIjNjBhNWZhIi8+PHBhdGggZD0iTTE1MCw2OSBMMTUwLDExNiIgc3Ryb2tlPSIjNjBhNWZhIiBzdHJva2Utd2lkdGg9IjYiIGZpbGw9Im5vbmUiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPjxwYXRoIGQ9Ik0xNTAsODYgTDEzMCw2NiIgc3Ryb2tlPSIjNjBhNWZhIiBzdHJva2Utd2lkdGg9IjUiIGZpbGw9Im5vbmUiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPjxwYXRoIGQ9Ik0xNTAsODYgTDE3MCw2NiIgc3Ryb2tlPSIjNjBhNWZhIiBzdHJva2Utd2lkdGg9IjUiIGZpbGw9Im5vbmUiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPjxwYXRoIGQ9Ik0xNTAsMTE2IEwxMzgsMTQyIiBzdHJva2U9IiM2MGE1ZmEiIHN0cm9rZS13aWR0aD0iNSIgZmlsbD0ibm9uZSIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIi8+PHBhdGggZD0iTTE1MCwxMTYgTDE2MiwxNDIiIHN0cm9rZT0iIzYwYTVmYSIgc3Ryb2tlLXdpZHRoPSI1IiBmaWxsPSJub25lIiBzdHJva2UtbGluZWNhcD0icm91bmQiLz48L3N2Zz4=',
      sizes: '192x192',
      type: 'image/svg+xml'
    }]
  };
  const blob = new Blob([JSON.stringify(manifest)], { type: 'application/manifest+json' });
  const link = document.createElement('link');
  link.rel = 'manifest';
  link.href = URL.createObjectURL(blob);
  document.head.appendChild(link);
}

// === SERVICE WORKER ===
function setupSW() {
  if (!('serviceWorker' in navigator)) return;

  // Запам'ятовуємо ДО реєстрації — чи вже був активний SW
  // Якщо null — це перший запуск, перезавантаження не потрібне
  const hadController = !!navigator.serviceWorker.controller;
  let _reloading = false;

  const doReload = () => {
    if (_reloading) return;
    _reloading = true;
    // location.replace надійніше ніж reload() в iOS PWA standalone режимі
    window.location.replace(window.location.href);
  };

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // Перезавантажуємо тільки якщо це оновлення (не перший запуск)
    if (!hadController) return;
    doReload();
  });

  // _swReg реєструємо СИНХРОННО щоб visibilitychange/pageshow нижче могли кликати reg.update()
  // навіть якщо вони спрацюють до того як .then() виконається
  let _swReg = null;

  // visibilitychange — iOS PWA "відновлення з фону": JS не перезапускається,
  // тому register().then() вже виконався раніше. Але реєструємо слухач ТУТ (синхронно),
  // щоб він був готовий ще до .then().
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && _swReg) _swReg.update();
  });

  // pageshow з persisted=true — iOS bfcache відновлення (окремий від visibilitychange кейс)
  window.addEventListener('pageshow', e => {
    if (e.persisted && _swReg) _swReg.update();
  });

  navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' })
    .then(reg => {
      _swReg = reg;
      reg.update();

      // Резервний механізм: якщо controllerchange не спрацює —
      // ловимо updatefound → installing → activated → reload
      reg.addEventListener('updatefound', () => {
        const sw = reg.installing;
        if (!sw) return;
        sw.addEventListener('statechange', () => {
          if (sw.state === 'activated' && hadController) doReload();
        });
      });
    })
    .catch(() => {
    // Fallback: мінімальний SW через blob (без кешування)
    const swCode = `
      self.addEventListener('install', e => self.skipWaiting());
      self.addEventListener('activate', e => clients.claim());
      self.addEventListener('fetch', e => e.respondWith(fetch(e.request).catch(() => caches.match(e.request))));
    `;
    const blob = new Blob([swCode], { type: 'application/javascript' });
    navigator.serviceWorker.register(URL.createObjectURL(blob)).catch(() => {});
  });
}

// === СИНХРОНІЗАЦІЯ МІЖ ВКЛАДКАМИ ===
// Механізм 1: storage event — браузер сам сповіщає інші вкладки коли localStorage змінився
// Механізм 2: BroadcastChannel — явна "рація" між вкладками одного сайту
function setupSync() {
  // Карта: ключ localStorage → функція рендеру (тільки для активної вкладки)
  const KEY_RENDER_MAP = {
    'nm_inbox':           () => { if (currentTab === 'inbox') try { renderInbox(); } catch(e) {} },
    'nm_tasks':           () => { if (currentTab === 'tasks') try { renderTasks(); updateProdTabCounters(); } catch(e) {} },
    'nm_habits2':         () => { if (currentTab === 'tasks') try { renderHabits(); renderProdHabits(); } catch(e) {} },
    'nm_habit_log2':      () => {
                            if (currentTab === 'tasks') try { renderHabits(); renderProdHabits(); } catch(e) {}
                            if (currentTab === 'me')    try { renderMe(); renderMeHabitsStats(); } catch(e) {}
                          },
    'nm_notes':           () => { if (currentTab === 'notes') try { renderNotes(); } catch(e) {} },
    'nm_folders_meta':    () => { if (currentTab === 'notes') try { renderNotes(); } catch(e) {} },
    'nm_moments':         () => {
                            if (currentTab === 'me')      try { renderMe(); renderMeHabitsStats(); } catch(e) {}
                            if (currentTab === 'evening') try { renderEvening(); } catch(e) {}
                          },
    'nm_finance':         () => { if (currentTab === 'finance')  try { renderFinance(); } catch(e) {} },
    'nm_finance_budget':  () => { if (currentTab === 'finance')  try { renderFinance(); } catch(e) {} },
    'nm_finance_cats':    () => { if (currentTab === 'finance')  try { renderFinance(); } catch(e) {} },
    'nm_health_cards':    () => { if (currentTab === 'health')   try { renderHealth(); } catch(e) {} },
    'nm_health_log':      () => { if (currentTab === 'health')   try { renderHealth(); } catch(e) {} },
    'nm_projects':        () => { if (currentTab === 'projects') try { renderProjects(); } catch(e) {} },
    'nm_evening_summary': () => { if (currentTab === 'evening')  try { renderEvening(); } catch(e) {} },
    'nm_evening_mood':    () => { if (currentTab === 'evening')  try { renderEvening(); } catch(e) {} },
    'nm_settings':        () => { try { applyTheme(currentTab); } catch(e) {} },
  };

  function handleSyncKey(key) {
    const fn = KEY_RENDER_MAP[key];
    if (fn) fn();
  }

  // --- Механізм 1: storage event ---
  // Спрацьовує автоматично коли ІНША вкладка змінює localStorage
  window.addEventListener('storage', e => {
    if (e.key && e.key.startsWith('nm_')) handleSyncKey(e.key);
  });

  // --- Механізм 2: BroadcastChannel ---
  // Дозволяє поточній вкладці надсилати повідомлення іншим
  let nmChannel = null;
  try {
    nmChannel = new BroadcastChannel('nm_sync');
    nmChannel.onmessage = e => {
      if (e.data?.key) handleSyncKey(e.data.key);
    };
  } catch(e) {}

  // Перехоплюємо localStorage.setItem — при кожному збереженні автоматично
  // сповіщаємо інші вкладки через BroadcastChannel (без зміни кожної функції збереження)
  const _origSetItem = localStorage.setItem.bind(localStorage);
  localStorage.setItem = function(key, value) {
    _origSetItem(key, value);
    if (key.startsWith('nm_') && nmChannel) {
      try { nmChannel.postMessage({ key, ts: Date.now() }); } catch(e) {}
    }
  };
}

function autoResizeTextarea(el) {
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
function updateChatWindowHeight(tab) {
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
function saveOffline(text) {
  const items = getInbox();
  items.unshift({ id: Date.now(), text, category: 'note', ts: Date.now(), processed: false });
  saveInbox(items);
  renderInbox();

}

function formatTime(ts) {
  const diff = Date.now() - ts;
  if (diff < 60000) return 'щойно';
  if (diff < 3600000) return Math.floor(diff / 60000) + ' хв тому';
  if (diff < 86400000) return Math.floor(diff / 3600000) + ' год тому';
  return new Date(ts).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' });
}

function escapeHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
// === KEYBOARD AVOIDING ===
function setupKeyboardAvoiding() {
  if (!window.visualViewport) return;

  const update = () => {
    const vv = window.visualViewport;
    // Правильний розрахунок для iOS: враховуємо offsetTop (скільки зверху зрізано)
    // Не включаємо vv.offsetTop — він збільшується при скролі сторінки
    // і тоді keyboardHeight хибно стає <250, таббар не ховається
    const keyboardHeight = Math.max(0, window.innerHeight - vv.height);
    const aiBar = document.getElementById('inbox-ai-bar');
    const tabBar = document.getElementById('tab-bar');
    const tbH = tabBar ? tabBar.offsetHeight : 83;
    const newBars = ['tasks-ai-bar','notes-ai-bar','me-ai-bar','evening-ai-bar','finance-ai-bar','health-ai-bar','projects-ai-bar'].map(id => document.getElementById(id));

    if (keyboardHeight > 250) { // реальна клавіатура > 250px; менше — це просто Safari ховає свій тулбар під час свайпу
      // Клавіатура відкрита — ховаємо таббар вниз, піднімаємо бар вгору
      if (aiBar) { aiBar.style.bottom = (keyboardHeight + 8) + 'px'; aiBar.style.left = '12px'; aiBar.style.right = '12px'; }
      // Обмежуємо висоту inbox чату щоб не виходив за видиму зону
      // Логіка: chatH = vv.height - barBottom - inputH - safeAreaTop
      const inboxCw = document.getElementById('inbox-chat-window');
      if (inboxCw && inboxCw.classList.contains('open')) {
        // Клавіатура відкрита — стискаємо до A-висоти
        if (typeof _tabChatState !== 'undefined' && _tabChatState['inbox'] === 'b') {
          _tabChatState['inbox'] = 'a';
        }
        const chatH = typeof _getTabChatAHeight === 'function'
          ? _getTabChatAHeight('inbox')
          : Math.max(50, vv.height - (keyboardHeight + 8) - 64 - 60);
        inboxCw.style.height = chatH + 'px';
        inboxCw.style.maxHeight = chatH + 'px';
        const inboxMsgs = document.getElementById('inbox-chat-messages');
        if (inboxMsgs) {
          inboxMsgs.style.maxHeight = Math.max(30, chatH - 20) + 'px';
          setTimeout(() => { inboxMsgs.scrollTop = inboxMsgs.scrollHeight; }, 50);
        }
      }
      // Ховаємо таббар — translateY достатньо великий щоб він пішов за екран
      if (tabBar) { tabBar.style.transform = `translateY(${tbH + keyboardHeight}px)`; tabBar.style.opacity = '0'; tabBar.style.pointerEvents = 'none'; }
      newBars.forEach(b => {
        if (!b || b.style.display === 'none') return;
        b.style.bottom = (keyboardHeight + 8) + 'px';
        // Обмежуємо висоту чат-вікна щоб handle лишався видимим
        // chatH = vv.height - barBottom - inputH - safeAreaTop
        const chatWin = b.querySelector('.ai-bar-chat-window');
        if (chatWin && chatWin.classList.contains('open')) {
          const tab = b.id.replace('-ai-bar', '');
          const state = (typeof _tabChatState !== 'undefined' ? _tabChatState : {})[tab];
          if (state === 'b') {
            // Клавіатура з'явилась поки стан B → авто-колапс до A
            if (typeof _tabChatState !== 'undefined') _tabChatState[tab] = 'a';
            const aH = typeof _getTabChatAHeight === 'function'
              ? _getTabChatAHeight(tab)
              : Math.max(150, vv.height - (keyboardHeight + 8) - 64 - 60);
            chatWin.style.transition = 'height 0.3s cubic-bezier(0.32,0.72,0,1)';
            chatWin.style.height = aH + 'px';
            chatWin.style.maxHeight = aH + 'px';
            setTimeout(() => chatWin.style.transition = '', 300);
          } else {
            const chatH = typeof _getTabChatAHeight === 'function'
              ? _getTabChatAHeight(tab)
              : Math.max(50, vv.height - (keyboardHeight + 8) - 64 - 60);
            chatWin.style.height = chatH + 'px';
            chatWin.style.maxHeight = chatH + 'px';
          }
        }
      });
    } else {
      // Клавіатура закрита — повертаємо все на місце
      if (aiBar) { const h = getTabbarHeight(); aiBar.style.bottom = (h + 4) + 'px'; aiBar.style.left = '4px'; aiBar.style.right = '4px'; }
      // Відновлюємо висоту inbox чату після закриття клавіатури
      const inboxCw = document.getElementById('inbox-chat-window');
      if (inboxCw && inboxCw.classList.contains('open')) {
        try {
          const inboxState = (typeof _tabChatState !== 'undefined' ? _tabChatState : {})['inbox'];
          const calcH = inboxState === 'b' && typeof _getTabChatBHeight === 'function'
            ? _getTabChatBHeight('inbox')
            : (typeof _getTabChatAHeight === 'function' ? _getTabChatAHeight('inbox') : null);
          if (calcH) { inboxCw.style.height = calcH + 'px'; inboxCw.style.maxHeight = calcH + 'px'; }
          else { inboxCw.style.height = ''; inboxCw.style.maxHeight = ''; }
        } catch(e) { inboxCw.style.height = ''; inboxCw.style.maxHeight = ''; }
        const inboxMsgs = document.getElementById('inbox-chat-messages');
        if (inboxMsgs) inboxMsgs.style.maxHeight = '';
      }
      if (tabBar) { tabBar.style.transform = 'translateY(0)'; tabBar.style.opacity = ''; tabBar.style.pointerEvents = ''; }
      newBars.forEach(b => {
        if (!b) return;
        b.style.bottom = (tbH + 4) + 'px';
        const chatWin = b.querySelector('.ai-bar-chat-window');
        if (chatWin && chatWin.classList.contains('open')) {
          const tab = b.id.replace('-ai-bar', '');
          const state = (typeof _tabChatState !== 'undefined' ? _tabChatState : {})[tab];
          if (state === 'b') {
            // Стан B: перераховуємо до повної висоти без клавіатури
            try {
              const bH = typeof _getTabChatBHeight === 'function'
                ? _getTabChatBHeight(tab)
                : null;
              if (bH) {
                chatWin.style.height = bH + 'px';
                chatWin.style.maxHeight = bH + 'px';
              } else { updateChatWindowHeight(tab); }
            } catch(e) {}
          } else if (state === 'a') {
            // Стан A: compact висота без клавіатури (обмежена)
            try {
              const aH = typeof _getTabChatAHeight === 'function'
                ? _getTabChatAHeight(tab)
                : null;
              if (aH) {
                chatWin.style.height = aH + 'px';
                chatWin.style.maxHeight = aH + 'px';
              } else { updateChatWindowHeight(tab); }
            } catch(e) {}
          }
        } else if (chatWin) {
          chatWin.style.height = '';
          chatWin.style.maxHeight = '';
        }
      });
    }
  };

  // iOS іноді надсилає scroll замість resize — слухаємо обидва
  window.visualViewport.addEventListener('resize', update);
  window.visualViewport.addEventListener('scroll', update);

  // Фікс після повернення з фону / розблокування — viewport нестабільний ~600ms
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    // Очищуємо stuck-стани від незавершених gesture (touchcancel міг не спрацювати)
    document.querySelectorAll('.ai-bar-chat-window').forEach(cw => {
      // Скидаємо лише transform/opacity, НЕ height (може бути expanded-стан)
      if (cw.style.transform && cw.style.transform !== 'translateY(0)' && cw.style.transform !== '') {
        cw.style.transition = '';
        cw.style.transform = '';
        cw.style.opacity = '';
      }
    });
    // iOS viewport стабілізується поступово — запускаємо update кілька разів
    setTimeout(update, 80);
    setTimeout(update, 350);
    setTimeout(update, 750);
  });

  // Фікс повторного фокусу: iOS не генерує новий resize якщо viewport вже встановлений
  // Викликаємо update() вручну при кожному фокусі на поле вводу
  document.addEventListener('focusin', e => {
    if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') {
      setTimeout(update, 120);
      setTimeout(update, 400); // другий раз — iOS іноді повільніше показує клавіатуру
    }
  }, { passive: true });

  // При закритті клавіатури через кнопку Готово — iOS не завжди надсилає resize
  document.addEventListener('focusout', e => {
    if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') {
      setTimeout(update, 150);
    }
  }, { passive: true });
}

// === PAGE TRANSITIONS ===
let currentTabForAnim = 'inbox';
function animateTabSwitch(newTab) {
  const oldPage = document.getElementById(`page-${currentTabForAnim}`);
  const newPage = document.getElementById(`page-${newTab}`);
  if (!oldPage || !newPage || oldPage === newPage) {
    currentTabForAnim = newTab;
    return;
  }

  // Плавний fade — без translate щоб не було жорсткого контрасту між кольорами
  newPage.style.transition = 'none';
  newPage.style.opacity = '0';
  newPage.style.visibility = 'visible';

  // Стара — зникає
  oldPage.style.transition = 'opacity 0.18s ease';
  oldPage.style.opacity = '0';

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      newPage.style.transition = 'opacity 0.22s ease';
      newPage.style.opacity = '1';
    });
  });

  setTimeout(() => {
    oldPage.style.transition = '';
    oldPage.style.opacity = '';
    oldPage.style.visibility = '';
    newPage.style.transition = '';
    newPage.style.opacity = '';
  }, 260);

  currentTabForAnim = newTab;
}

// === SETTINGS SWIPE TO CLOSE ===
function setupSettingsSwipe() {
  const panel = document.getElementById('settings-panel-el');
  if (!panel) return;
  let startY = 0, startScrollTop = 0;
  panel.addEventListener('touchstart', e => {
    startY = e.touches[0].clientY;
    startScrollTop = panel.scrollTop;
  }, { passive: true });
  panel.addEventListener('touchend', e => {
    const dy = e.changedTouches[0].clientY - startY;
    // Close only if swiped down >80px AND panel is scrolled to top
    if (dy > 80 && startScrollTop === 0) {
      closeSettings();
    }
  }, { passive: true });
}



// === LOGGER ===
const NM_LOG_KEY = 'nm_error_log';
const NM_LOG_MAX = 200;

function getErrorLog() {
  try { return JSON.parse(localStorage.getItem(NM_LOG_KEY) || '[]'); } catch { return []; }
}
function saveErrorLog(arr) {
  try { localStorage.setItem(NM_LOG_KEY, JSON.stringify(arr.slice(-NM_LOG_MAX))); } catch {}
}

function logError(type, message, source) {
  const log = getErrorLog();
  log.push({
    ts: Date.now(),
    type,
    msg: String(message).slice(0, 500),
    src: source || '',
    tab: typeof currentTab !== 'undefined' ? currentTab : '?'
  });
  saveErrorLog(log);
  updateErrorLogBtn();
}

// Перехоплюємо JS помилки і promise rejections
window.addEventListener('error', e => {
  logError('error', e.message, (e.filename || '').replace(/.*\//, '') + ':' + e.lineno);
});
window.addEventListener('unhandledrejection', e => {
  logError('promise', e.reason ? (e.reason.message || String(e.reason)) : 'Promise rejected', '');
});

// Перехоплюємо console.log / warn / error
(function() {
  const _log = console.log.bind(console);
  const _warn = console.warn.bind(console);
  const _err = console.error.bind(console);
  console.log = (...a) => { _log(...a); logError('log', a.map(String).join(' '), ''); };
  console.warn = (...a) => { _warn(...a); logError('warn', a.map(String).join(' '), ''); };
  console.error = (...a) => { _err(...a); logError('err', a.map(String).join(' '), ''); };
})();

// Візуальна панель логів
function showErrorLog() {
  const log = getErrorLog();
  const panel = document.getElementById('log-panel');
  const list = document.getElementById('log-panel-list');
  if (!panel || !list) return;

  const typeStyle = {
    error:   { bg: 'rgba(239,68,68,0.15)',   color: '#dc2626' },
    promise: { bg: 'rgba(239,68,68,0.15)',   color: '#dc2626' },
    err:     { bg: 'rgba(239,68,68,0.12)',   color: '#dc2626' },
    warn:    { bg: 'rgba(251,191,36,0.15)',  color: '#b45309' },
    log:     { bg: 'rgba(99,102,241,0.10)',  color: '#4338ca' },
  };

  if (log.length === 0) {
    list.innerHTML = '<div style="text-align:center;padding:48px 20px;color:rgba(30,16,64,0.35);font-size:14px">Лог порожній — помилок не знайдено 👍</div>';
  } else {
    list.innerHTML = [...log].reverse().map(e => {
      const d = new Date(e.ts);
      const time = d.toLocaleTimeString('uk-UA', {hour:'2-digit', minute:'2-digit', second:'2-digit'});
      const date = d.toLocaleDateString('uk-UA', {day:'2-digit', month:'2-digit'});
      const s = typeStyle[e.type] || { bg: 'rgba(30,16,64,0.06)', color: 'rgba(30,16,64,0.5)' };
      return `<div style="padding:10px 14px;border-bottom:1px solid rgba(30,16,64,0.06)">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
          <span style="font-size:10px;font-weight:800;padding:2px 7px;border-radius:6px;background:${s.bg};color:${s.color};text-transform:uppercase">${e.type}</span>
          <span style="font-size:11px;color:rgba(30,16,64,0.35)">${date} ${time}</span>
          <span style="font-size:11px;color:rgba(30,16,64,0.25);margin-left:auto">${e.tab}</span>
        </div>
        <div style="font-size:13px;color:#1e1040;line-height:1.45;word-break:break-all">${e.msg}</div>
        ${e.src ? `<div style="font-size:11px;color:rgba(30,16,64,0.35);margin-top:3px;font-family:monospace">${e.src}</div>` : ''}
      </div>`;
    }).join('');
  }

  const countEl = document.getElementById('log-panel-count');
  if (countEl) countEl.textContent = log.length + ' записів · свіжіші зверху';

  panel.style.display = 'flex';
  requestAnimationFrame(() => panel.style.opacity = '1');
}

function copyLogForClaude() {
  const log = getErrorLog();
  if (!log.length) { showToast('Лог порожній'); return; }
  const lines = log.slice(-50).map(e => {
    const time = new Date(e.ts).toLocaleTimeString('uk-UA', {hour:'2-digit', minute:'2-digit', second:'2-digit'});
    return `[${time}][${e.type}][${e.tab}] ${e.msg}${e.src ? ' @ ' + e.src : ''}`;
  }).join('\n');
  const text = `NeverMind Logs (останні ${Math.min(log.length, 50)} з ${log.length}):\n\`\`\`\n${lines}\n\`\`\``;
  navigator.clipboard?.writeText(text)
    .then(() => showToast('✓ Скопійовано — вставляй в чат з Claude'));
}

function closeLogPanel() {
  const panel = document.getElementById('log-panel');
  if (!panel) return;
  panel.style.opacity = '0';
  setTimeout(() => { panel.style.display = 'none'; }, 250);
}

function copyErrorLog() {
  const log = getErrorLog();
  if (!log.length) { showToast('Лог порожній'); return; }
  const lines = log.map(e => {
    const time = new Date(e.ts).toLocaleString('uk-UA');
    return `[${time}] [${e.type}] [${e.tab}] ${e.msg}${e.src ? ' → ' + e.src : ''}`;
  }).join('\n');
  navigator.clipboard?.writeText('NeverMind Log\n' + '='.repeat(40) + '\n' + lines)
    .then(() => showToast('✓ Лог скопійовано (' + log.length + ' записів)'));
}

function clearErrorLog() {
  localStorage.removeItem(NM_LOG_KEY);
  showToast('✓ Лог очищено');
  updateErrorLogBtn();
  const list = document.getElementById('log-panel-list');
  if (list) list.innerHTML = '<div style="text-align:center;padding:48px 20px;color:rgba(30,16,64,0.35);font-size:14px">Лог порожній — помилок не знайдено 👍</div>';
}

function updateErrorLogBtn() {
  const btn = document.getElementById('error-log-btn');
  if (!btn) return;
  const count = getErrorLog().length;
  btn.textContent = count > 0 ? count : '0';
  btn.style.background = count > 0 ? 'rgba(234,88,12,0.12)' : '';
  btn.style.color = count > 0 ? '#ea580c' : '';
}

// Chip (кнопка табло) → відкрити чат-бар і відправити текст як повідомлення
function owlChipToChat(tab, text) {
  const lower = text.toLowerCase();

  // Чіпи-навігація: переводять на потрібну вкладку замість відправки в AI
  const navMap = [
    { patterns: ['задач', 'закрити задач', 'завершити задач'], tab: 'tasks' },
    { patterns: ['звичк', 'виконати звичк', 'відмітити звичк'], tab: 'tasks' },
    { patterns: ['підсумк', 'підсумок дня', 'записати підсумк'], tab: 'evening' },
    { patterns: ['нотатк', 'записати нотатк'], tab: 'notes' },
    { patterns: ['фінанс', 'витрат', 'бюджет'], tab: 'finance' },
    { patterns: ['здоров', 'самопочутт'], tab: 'health' },
    { patterns: ['проект'], tab: 'projects' },
  ];

  for (const nav of navMap) {
    if (nav.patterns.some(p => lower.includes(p))) {
      switchTab(nav.tab);
      showToast('Переходжу до вкладки');
      return;
    }
  }

  // Решта чіпів — відправляємо як повідомлення в чат-бар
  const barTab = tab === 'inbox' ? 'inbox' : (tab || 'inbox');
  openChatBar(barTab);
  const inputId = barTab === 'inbox' ? 'inbox-input' : barTab + '-chat-input';
  const input = document.getElementById(inputId);
  if (input) {
    input.value = text;
    input.dispatchEvent(new Event('input'));
  }
  setTimeout(() => {
    if (barTab === 'inbox') { if (typeof sendToAI === 'function') sendToAI(); }
    else if (barTab === 'tasks') { if (typeof sendTasksBarMessage === 'function') sendTasksBarMessage(); }
    else if (barTab === 'notes') { if (typeof sendNotesBarMessage === 'function') sendNotesBarMessage(); }
    else if (barTab === 'finance') { if (typeof sendFinanceBarMessage === 'function') sendFinanceBarMessage(); }
    else if (barTab === 'health') { if (typeof sendHealthBarMessage === 'function') sendHealthBarMessage(); }
    else if (barTab === 'projects') { if (typeof sendProjectsBarMessage === 'function') sendProjectsBarMessage(); }
    else if (barTab === 'me') { if (typeof sendMeChatMessage === 'function') sendMeChatMessage(); }
    else if (barTab === 'evening') { if (typeof sendEveningBarMessage === 'function') sendEveningBarMessage(); }
  }, 100);
}

// === OWL TAB BOARDS (#37) ===
const OWL_TAB_BOARD_MIN_INTERVAL = 30 * 60 * 1000; // 30 хвилин між оновленнями

function getOwlTabBoardKey(tab) { return 'nm_owl_tab_' + tab; }
function getOwlTabTsKey(tab) { return 'nm_owl_tab_ts_' + tab; }
function getOwlTabSaidKey(tab) { return 'nm_owl_tab_said_' + tab; }

function getTabBoardMsgs(tab) {
  try {
    const raw = JSON.parse(localStorage.getItem(getOwlTabBoardKey(tab)) || 'null');
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    return [raw]; // backward compat: старий формат → масив
  } catch { return []; }
}
function getTabBoardMsg(tab) {
  const msgs = getTabBoardMsgs(tab);
  return msgs[0] || null;
}
function saveTabBoardMsg(tab, newMsg) {
  const msgs = getTabBoardMsgs(tab);
  msgs.unshift(newMsg);          // новий → перший
  if (msgs.length > 30) msgs.length = 30; // максимум 30
  try { localStorage.setItem(getOwlTabBoardKey(tab), JSON.stringify(msgs)); } catch {}
}

function getTabBoardSaid(tab) {
  const today = new Date().toDateString();
  try {
    const raw = JSON.parse(localStorage.getItem(getOwlTabSaidKey(tab)) || '{}');
    if (raw.date !== today) return {};
    return raw.said || {};
  } catch { return {}; }
}
function markTabBoardSaid(tab, topic) {
  const today = new Date().toDateString();
  const said = getTabBoardSaid(tab);
  said[topic] = true;
  try { localStorage.setItem(getOwlTabSaidKey(tab), JSON.stringify({ date: today, said })); } catch {}
}
function tabAlreadySaid(tab, topic) { return !!getTabBoardSaid(tab)[topic]; }

function dismissTabBoard(tab) {
  // Вечір — табло завжди активне, не закривається
  if (tab === 'evening') return;
  const el = document.getElementById('owl-tab-board-' + tab);
  if (el) el.style.display = 'none';
}

// === OWL TAB BOARD — новий стиль (як Інбокс) ===

const _owlTabStates = {}; // 'speech' | 'collapsed' | 'expanded'
const _owlTabSwipes = {};

const OWL_TAB_EXPANDED_H = 204; // чат + padding-top:29px щоб повідомлення під совою

function _owlTabHTML(tab) {
  const t = tab;
  return `
    <div id="owl-tab-collapsed-${t}" class="owl-collapsed" style="display:none" onclick="toggleOwlTabChat('${t}')">
      <div class="owl-collapsed-avatar">🦉</div>
      <div class="owl-collapsed-text" id="owl-tab-ctext-${t}"></div>
    </div>
    <div id="owl-tab-speech-${t}" class="owl-speech"
         ontouchstart="owlTabSwipeStart(event,'${t}')" ontouchmove="owlTabSwipeMove(event,'${t}')" ontouchend="owlTabSwipeEnd(event,'${t}')">
      <div class="owl-speech-avatar">🦉</div>
      <div class="owl-tab-card">
        <div class="owl-tab-bubble" id="owl-tab-bubble-${t}">
          <div class="owl-speech-text" id="owl-tab-text-${t}"></div>
          <div class="owl-speech-time" id="owl-tab-time-${t}"></div>
        </div>
      </div>
    </div>
    <div class="owl-chips-wrapper" id="owl-tab-chips-wrap-${t}">
      <button class="owl-chips-arrow owl-chips-arrow-left" id="owl-tab-chips-left-${t}" onclick="scrollOwlTabChips('${t}',-1)">‹</button>
      <div id="owl-tab-chips-${t}" class="owl-speech-chips"></div>
      <button class="owl-chips-arrow owl-chips-arrow-right" id="owl-tab-chips-right-${t}" onclick="scrollOwlTabChips('${t}',1)">›</button>
    </div>`;
}

function _owlTabApplyState(tab) {
  const st = _owlTabStates[tab] || 'speech';
  const collapsed = document.getElementById('owl-tab-collapsed-' + tab);
  const speech    = document.getElementById('owl-tab-speech-' + tab);
  const chipsWrap = document.getElementById('owl-tab-chips-wrap-' + tab);
  if (!speech) return;
  if (collapsed) collapsed.style.display = st === 'collapsed' ? 'flex' : 'none';
  speech.style.display = st === 'collapsed' ? 'none' : 'block';
  if (chipsWrap) chipsWrap.style.display = 'flex';
}

function toggleOwlTabChat(tab)      { _owlTabStates[tab] = 'speech';   _owlTabApplyState(tab); }
function collapseOwlTabToSpeech(tab){ _owlTabStates[tab] = 'speech';   _owlTabApplyState(tab); }
// Додати початкове повідомлення сови у чат якщо він пустий
function _seedOwlTabChat(tab) {
  const key = 'nm_owl_tab_chat_' + tab;
  const msgs = JSON.parse(localStorage.getItem(key) || '[]');
  if (msgs.length === 0) {
    const text = (document.getElementById('owl-tab-text-' + tab) || {}).textContent;
    if (text && text.trim()) {
      msgs.push({ role: 'agent', text: text.trim(), ts: Date.now() });
      localStorage.setItem(key, JSON.stringify(msgs));
    }
  }
}

function expandOwlTabChat(tab) {
  // Табло read-only — відкриваємо чат-бар знизу замість expanded стану
  openChatBar(tab === 'inbox' ? 'inbox' : tab);
}

function owlTabSwipeStart(e, tab) {
  _owlTabSwipes[tab] = { y: e.touches[0].clientY, dy: 0 };
}
function owlTabSwipeMove(e, tab) {
  if (!_owlTabSwipes[tab]) return;
  _owlTabSwipes[tab].dy = e.touches[0].clientY - _owlTabSwipes[tab].y;
}

function owlTabSwipeEnd(e, tab) {
  const sw = _owlTabSwipes[tab]; if (!sw) return;
  _owlTabSwipes[tab] = null;
  const dy = sw.dy, st = _owlTabStates[tab] || 'speech';

  if (dy < -40) {
    // Свайп вгору — згорнути табло
    if (st === 'speech') { _owlTabStates[tab] = 'collapsed'; _owlTabApplyState(tab); }
  } else if (dy > 40) {
    // Свайп вниз — розгорнути або відкрити чат-бар
    if (st === 'collapsed') { _owlTabStates[tab] = 'speech'; _owlTabApplyState(tab); }
    else if (st === 'speech') openChatBar(tab === 'inbox' ? 'inbox' : tab);
  }
}

function renderOwlTabMsgs(tab) {
  const el = document.getElementById('owl-tab-msgs-' + tab);
  if (!el) return;
  const msgs = JSON.parse(localStorage.getItem('nm_owl_tab_chat_' + tab) || '[]');
  el.innerHTML = msgs.map(m =>
    `<div class="owl-msg-${m.role === 'user' ? 'user' : 'agent'}">${escapeHtml(m.text)}</div>`
  ).join('');
  el.scrollTop = el.scrollHeight;
}

async function sendOwlTabReply(tab, text) {
  if (tab === 'inbox') { if (typeof sendOwlReply === 'function') sendOwlReply(text); return; }
  expandOwlTabChat(tab);
  const key = 'nm_owl_tab_chat_' + tab;
  const msgs = JSON.parse(localStorage.getItem(key) || '[]');
  msgs.push({ role: 'user', text, ts: Date.now() });
  localStorage.setItem(key, JSON.stringify(msgs));
  renderOwlTabMsgs(tab);
  // Typing indicator (індикатор набору)
  const el = document.getElementById('owl-tab-msgs-' + tab);
  if (el) {
    const d = document.createElement('div');
    d.className = 'owl-msg-agent owl-typing-wrap';
    d.innerHTML = '<div class="owl-typing"><span></span><span></span><span></span></div>';
    el.appendChild(d); el.scrollTop = el.scrollHeight;
  }
  const apiKey = localStorage.getItem('nm_gemini_key');
  if (!apiKey) return;
  try {
    const context = getTabBoardContext(tab);
    const history = msgs.slice(-6).map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.text }));
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'system', content: (typeof getOWLPersonality === 'function' ? getOWLPersonality() : '') + '\n\nКонтекст:\n' + context }, ...history],
        max_tokens: 250, temperature: 0.8
      })
    });
    const data = await res.json();
    const reply = data.choices?.[0]?.message?.content?.trim();
    if (!reply) { renderOwlTabMsgs(tab); return; }
    const all = JSON.parse(localStorage.getItem(key) || '[]');
    all.push({ role: 'agent', text: reply, ts: Date.now() });
    localStorage.setItem(key, JSON.stringify(all));
    renderOwlTabMsgs(tab);
  } catch(e) { renderOwlTabMsgs(tab); }
}

function sendOwlTabReplyFromInput(tab) {
  if (tab === 'inbox') { if (typeof sendOwlReplyFromInput === 'function') sendOwlReplyFromInput(); return; }
  const input = document.getElementById('owl-tab-input-' + tab);
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  sendOwlTabReply(tab, text);
}

function _updateOwlTabChipsArrows(tab) {
  const el    = document.getElementById('owl-tab-chips-' + tab);
  const left  = document.getElementById('owl-tab-chips-left-' + tab);
  const right = document.getElementById('owl-tab-chips-right-' + tab);
  if (!el || !left || !right) return;
  left.classList.toggle('visible', el.scrollLeft > 4);
  right.classList.toggle('visible', el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
}

function scrollOwlTabChips(tab, dir) {
  const el = document.getElementById('owl-tab-chips-' + tab);
  if (!el) return;
  el.scrollBy({ left: dir * 130, behavior: 'smooth' });
  setTimeout(() => _updateOwlTabChipsArrows(tab), 250);
}

function renderTabBoard(tab) {
  const isInbox = tab === 'inbox';
  const msgs = isInbox ? (typeof getOwlBoardMessages === 'function' ? getOwlBoardMessages() : []) : getTabBoardMsgs(tab);
  const board = document.getElementById(isInbox ? 'owl-board' : 'owl-tab-board-' + tab);
  if (!board) return;
  if (!msgs.length) { board.style.display = 'none'; return; }
  board.style.display = 'block';

  // Ініціалізація структури — один раз (inbox вже має HTML в index.html)
  if (!board._owlReady) {
    if (!isInbox) board.innerHTML = _owlTabHTML(tab);
    board._owlReady = true;
    _owlTabStates[tab] = _owlTabStates[tab] || 'speech';
    _owlTabApplyState(tab);
  }

  const msg = msgs[0];
  const ago = Date.now() - (msg.ts || msg.id || Date.now());
  const mins = Math.floor(ago / 60000);
  const timeStr = mins < 1 ? 'щойно' : mins < 60 ? mins + ' хв' : Math.floor(mins / 60) + ' год';

  const tEl = document.getElementById('owl-tab-text-' + tab);
  const cEl = document.getElementById('owl-tab-ctext-' + tab);
  const tmEl = document.getElementById('owl-tab-time-' + tab);
  if (tEl) tEl.textContent = msg.text;
  if (cEl) cEl.textContent = msg.text;
  if (tmEl) tmEl.textContent = timeStr;

  const chipsEl = document.getElementById('owl-tab-chips-' + tab);
  const chipsHTML = (msg.chips || []).map(c => {
    const s = escapeHtml(c).replace(/'/g, '&#39;');
    return `<div class="owl-chip" onclick="owlChipToChat('${tab}','${s}')">${escapeHtml(c)}</div>`;
  });
  if (chipsEl) {
    const barTab = tab === 'me' ? 'me' : tab;
    const speechChips = [...chipsHTML, `<div class="owl-chip owl-chip-speak" onclick="openChatBar('${barTab}')">Поговорити</div>`];
    chipsEl.innerHTML = speechChips.join('');
    chipsEl.scrollLeft = 0;
    chipsEl.removeEventListener('scroll', chipsEl._arrowHandler);
    chipsEl._arrowHandler = () => _updateOwlTabChipsArrows(tab);
    chipsEl.addEventListener('scroll', chipsEl._arrowHandler, { passive: true });
    setTimeout(() => _updateOwlTabChipsArrows(tab), 50);
  }
}

function getTabBoardContext(tab) {
  const parts = [];
  try { const ctx = getAIContext(); if (ctx) parts.push(ctx); } catch(e) {}

  if (tab === 'tasks') {
    const tasks = getTasks();
    const active = tasks.filter(t => t.status === 'active');
    const now = Date.now();
    const stuck = active.filter(t => t.createdAt && (now - t.createdAt) > 3 * 24 * 60 * 60 * 1000);
    if (stuck.length > 0) parts.push(`[ВАЖЛИВО] Задачі без прогресу 3+ дні: ${stuck.map(t => '"' + t.title + '"').join(', ')}`);
    parts.push(`Активних задач: ${active.length}, закрито: ${tasks.filter(t => t.status === 'done').length}`);
    // Quit звички
    const allHabits = getHabits();
    const quitHabits = allHabits.filter(h => h.type === 'quit');
    if (quitHabits.length > 0) {
      const todayStr = new Date().toISOString().slice(0, 10);
      const quitInfo = quitHabits.map(h => {
        const s = getQuitStatus(h.id);
        const heldToday = s.lastHeld === todayStr;
        return `"${h.name}": стрік ${s.streak || 0} дн${heldToday ? ' ✓' : ' (не відмічено сьогодні)'}`;
      });
      parts.push(`Челенджі "Кинути": ${quitInfo.join('; ')}`);
      const notHeld = quitHabits.filter(h => getQuitStatus(h.id).lastHeld !== todayStr);
      if (notHeld.length > 0) parts.push(`[ВАЖЛИВО] Не відмічено сьогодні: ${notHeld.map(h => '"' + h.name + '"').join(', ')}`);
    }
  }

  if (tab === 'notes') {
    const notes = getNotes();
    const byFolder = {};
    notes.forEach(n => { const f = n.folder || 'Загальне'; byFolder[f] = (byFolder[f] || 0) + 1; });
    parts.push(`Нотатки: ${notes.length} записів. Папки: ${Object.entries(byFolder).map(([f, c]) => f + '(' + c + ')').join(', ') || 'немає'}`);
  }

  if (tab === 'me') {
    const habits = getHabits();
    const buildHabits = habits.filter(h => h.type !== 'quit');
    const quitHabits = habits.filter(h => h.type === 'quit');
    const log = getHabitLog();
    const today = new Date().toDateString();
    const todayStr = new Date().toISOString().slice(0, 10);
    const todayDow = (new Date().getDay() + 6) % 7;
    const todayH = buildHabits.filter(h => (h.days || [0,1,2,3,4]).includes(todayDow));
    const doneToday = todayH.filter(h => !!log[today]?.[h.id]).length;
    if (buildHabits.length > 0) {
      const streaks = buildHabits.map(h => ({ name: h.name, streak: getHabitStreak(h.id), pct: getHabitPct(h.id) }));
      parts.push(`Звички сьогодні: ${doneToday}/${todayH.length}. Стріки: ${streaks.filter(s => s.streak >= 2).map(s => s.name + '🔥' + s.streak).join(', ') || 'немає'}`);
    }
    if (quitHabits.length > 0) {
      const quitInfo = quitHabits.map(h => {
        const s = getQuitStatus(h.id);
        return `"${h.name}": ${s.streak || 0} дн без зривів`;
      });
      parts.push(`Челенджі: ${quitInfo.join(', ')}`);
    }
    const inbox = JSON.parse(localStorage.getItem('nm_inbox') || '[]');
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    parts.push(`Записів за тиждень: ${inbox.filter(i => i.ts > weekAgo).length}. Задач активних: ${getTasks().filter(t => t.status === 'active').length}`);
  }

  if (tab === 'evening') {
    const moments = JSON.parse(localStorage.getItem('nm_moments') || '[]');
    const todayStr = new Date().toDateString();
    const todayMoments = moments.filter(m => new Date(m.ts).toDateString() === todayStr);
    const summary = JSON.parse(localStorage.getItem('nm_evening_summary') || 'null');
    const hasSummary = summary && new Date(summary.date).toDateString() === todayStr;
    const hour = new Date().getHours();
    parts.push(`Моменти сьогодні: ${todayMoments.length}. Підсумок дня: ${hasSummary ? 'є' : 'ще не записано'}.`);
    if (hour >= 20 && !hasSummary) parts.push('[ВАЖЛИВО] Вечір — підсумок ще не записано.');
    const tasks = getTasks().filter(t => t.status === 'done' && t.updatedAt && Date.now() - t.updatedAt < 24*60*60*1000);
    if (tasks.length > 0) parts.push(`Задач закрито сьогодні: ${tasks.length}`);
  }

  if (tab === 'finance') {
    try { const finCtx = getFinanceContext(); if (finCtx) parts.push(finCtx); } catch(e) {}
  }

  if (tab === 'health') {
    try {
      const cards = JSON.parse(localStorage.getItem('nm_health_cards') || '[]');
      const log = JSON.parse(localStorage.getItem('nm_health_log') || '{}');
      const todayStr = new Date().toISOString().slice(0, 10);
      const todayLog = log[todayStr] || {};
      parts.push(`Карточок здоров'я: ${cards.length}. Сьогодні: енергія ${todayLog.energy || '—'}, сон ${todayLog.sleep || '—'}, біль ${todayLog.pain || '—'}`);
    } catch(e) {}
  }

  if (tab === 'projects') {
    try {
      const projects = JSON.parse(localStorage.getItem('nm_projects') || '[]');
      const active = projects.filter(p => p.status === 'active');
      const paused = projects.filter(p => p.status === 'paused');
      parts.push(`Проектів активних: ${active.length}, на паузі: ${paused.length}, всього: ${projects.length}.`);
      if (active.length > 0) parts.push(`Активні: ${active.slice(0,3).map(p => '"' + p.name + '"').join(', ')}`);
    } catch(e) {}
  }

  return parts.filter(Boolean).join('\n\n');
}

function checkTabBoardTrigger(tab) {
  if (tab === 'tasks') {
    const tasks = getTasks().filter(t => t.status === 'active');
    if (tasks.length === 0) return false;
    const now = Date.now();
    const stuck = tasks.filter(t => t.createdAt && (now - t.createdAt) > 3 * 24 * 60 * 60 * 1000);
    return stuck.length > 0;
  }
  if (tab === 'notes') return getNotes().length > 0;
  if (tab === 'me') return getHabits().length > 0 || getTasks().length > 0;
  if (tab === 'evening') return true;
  if (tab === 'finance') {
    try { return getFinance().length > 0; } catch { return false; }
  }
  if (tab === 'health') {
    try { return JSON.parse(localStorage.getItem('nm_health_cards') || '[]').length > 0; } catch { return false; }
  }
  if (tab === 'projects') {
    try { return JSON.parse(localStorage.getItem('nm_projects') || '[]').length > 0; } catch { return false; }
  }
  return true;
}

let _tabBoardGenerating = {};

async function generateTabBoardMessage(tab) {
  if (_tabBoardGenerating[tab]) return;
  const key = localStorage.getItem('nm_gemini_key');
  if (!key) return;
  _tabBoardGenerating[tab] = true;

  const context = getTabBoardContext(tab);
  const tabLabels = { tasks: 'Продуктивність', notes: 'Нотатки', me: 'Я', evening: 'Вечір', finance: 'Фінанси', health: 'Здоров\'я', projects: 'Проекти' };
  const allMsgs = getTabBoardMsgs(tab);
  const existing = allMsgs[0] || null;
  const recentText = existing ? existing.text : '';
  // Історія повідомлень для контексту (до 20 останніх)
  const tabHistory = allMsgs.slice(0, 20).map(m => {
    const ago = Date.now() - (m.ts || 0);
    const hours = Math.floor(ago / 3600000);
    const when = hours < 1 ? 'щойно' : hours < 24 ? hours + ' год тому' : Math.floor(hours / 24) + ' дн тому';
    return `[${when}] ${m.text}`;
  }).join('\n');

  const _now = new Date();
  const _hour = _now.getHours();
  const _timeOfDay = _hour < 6 ? 'ніч' : _hour < 12 ? 'ранок' : _hour < 18 ? 'день' : 'вечір';
  const _timeStr = _now.toLocaleTimeString('uk-UA', {hour:'2-digit', minute:'2-digit'});

  const systemPrompt = getOWLPersonality() + `

Зараз: ${_timeStr} (${_timeOfDay}). Враховуй час доби у повідомленні.

Ти пишеш КОРОТКЕ проактивне повідомлення для табло у вкладці "${tabLabels[tab] || tab}". Це НЕ відповідь на запит — це твоя ініціатива.

ТВОЇ ПОПЕРЕДНІ ПОВІДОМЛЕННЯ (пам'ятай що вже казав, будуй діалог, не повторюйся):
${tabHistory || '(ще нічого не казав)'}

ЩО ТИ ЗНАЄШ ПРО КОРИСТУВАЧА:
${localStorage.getItem('nm_memory') || '(ще не знаю)'}

ПРАВИЛА:
- Максимум 2 речення. Коротко і конкретно про цю вкладку.
- Говори ЛЮДСЬКОЮ мовою. НЕ використовуй жаргон: "стрік", "streak", "трекер", "прогрес". Кажи конкретно і зрозуміло що відбувається — як друг, не як програма.
- Використовуй ТІЛЬКИ факти з контексту нижче. НЕ вигадуй ліміти і дані яких немає.
- НЕ повторюй нещодавнє: "${recentText || 'нічого'}"
- Відповідай ТІЛЬКИ JSON: {"text":"повідомлення","priority":"critical|important|normal","chips":["чіп1","чіп2"]}
- chips — кнопки швидких дій. ТІЛЬКИ дії що прямо стосуються твого повідомлення. НЕ додавай випадкові дії які не згадуються в тексті. Максимум 3 слова кожен. Якщо нічого конкретного — [].
- Відповідай українською.`;

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Дані: ${context}` }
        ],
        max_tokens: 150,
        temperature: 0.8
      })
    });
    const data = await res.json();
    const reply = data.choices?.[0]?.message?.content?.trim();
    if (!reply) { _tabBoardGenerating[tab] = false; return; }
    const parsed = JSON.parse(reply.replace(/```json|```/g, '').trim());
    if (!parsed.text) { _tabBoardGenerating[tab] = false; return; }
    saveTabBoardMsg(tab, { text: parsed.text, priority: parsed.priority || 'normal', chips: parsed.chips || [], ts: Date.now() });
    localStorage.setItem(getOwlTabTsKey(tab), Date.now().toString());
    // Дублюємо проактивне повідомлення в чат-бар поточної вкладки
    try {
      const chatTab = tab;
      const chatKey = 'nm_chat_' + chatTab;
      const chatMsgs = JSON.parse(localStorage.getItem(chatKey) || '[]');
      chatMsgs.push({ role: 'agent', text: '🦉 ' + parsed.text, ts: Date.now() });
      localStorage.setItem(chatKey, JSON.stringify(chatMsgs));
      if (typeof restoreChatUI === 'function') restoreChatUI(chatTab);
    } catch(e) {}
    renderTabBoard(tab);
  } catch(e) {}
  _tabBoardGenerating[tab] = false;
}

function tryTabBoardUpdate(tab) {
  if (tab === 'inbox') return;
  // Скидаємо стан до speech при кожному переключенні вкладки
  if (_owlTabStates[tab] && _owlTabStates[tab] !== 'speech') {
    _owlTabStates[tab] = 'speech';
    _owlTabApplyState(tab);
  }
  renderTabBoard(tab); // завжди показуємо збережені дані
  const hour = new Date().getHours();
  if (hour < 5) return; // тихі години — генерація пропускається
  // Вечірнє табло — "підсумок дня" не має сенсу зранку; генеруємо лише після 12:00
  if (tab === 'evening' && hour < 12) return;
  const lastTs = parseInt(localStorage.getItem(getOwlTabTsKey(tab)) || '0');
  const elapsed = Date.now() - lastTs;
  const isNewDay = lastTs > 0 && new Date(lastTs).toDateString() !== new Date().toDateString();
  const firstTime = lastTs === 0;
  if (firstTime || isNewDay || (elapsed > OWL_TAB_BOARD_MIN_INTERVAL && checkTabBoardTrigger(tab))) {
    generateTabBoardMessage(tab);
  }
}

// === UNIVERSAL SWIPE DELETE TRAIL (#32) ===
const SWIPE_DELETE_THRESHOLD = 90; // єдиний поріг для всіх вкладок

// Застосовує червоний градієнтний шлейф і рух картки
// el = картка (рухається), wrapEl = wrapper
function applySwipeTrail(cardEl, wrapEl, dx) {
  if (!cardEl) return;
  cardEl.style.transform = `translateX(${dx}px)`;
  if (!wrapEl) return;

  const progress = Math.min(1, -dx / 160);

  // Знаходимо або створюємо trail div всередині wrapper
  let trail = wrapEl.querySelector('.swipe-trail');
  if (!trail) {
    trail = document.createElement('div');
    trail.className = 'swipe-trail';
    trail.style.cssText = 'position:absolute;top:0;bottom:0;right:0;pointer-events:none;border-radius:inherit;z-index:0';
    wrapEl.appendChild(trail);
  }

  if (progress <= 0) {
    trail.style.background = '';
    trail.style.width = '0';
    return;
  }

  // Ширина шлейфу = скільки відкрилось (картка зсунулась вліво)
  const trailWidth = Math.round(-dx);
  const alpha = (0.2 + progress * 0.8).toFixed(2);
  trail.style.width = trailWidth + 'px';
  trail.style.background = `linear-gradient(to right, transparent 0%, rgba(239,68,68,${alpha}) 100%)`;
}

// Скидає шлейф після відпускання
function clearSwipeTrail(cardEl, wrapEl) {
  if (cardEl) {
    cardEl.style.transition = 'transform 0.25s ease';
    cardEl.style.transform = 'translateX(0)';
    setTimeout(() => { if (cardEl) cardEl.style.transition = ''; }, 300);
  }
  if (wrapEl) {
    const trail = wrapEl.querySelector('.swipe-trail');
    if (trail) {
      trail.style.transition = 'opacity 0.25s ease';
      trail.style.opacity = '0';
      setTimeout(() => { if (trail) { trail.style.opacity = ''; trail.style.width = '0'; trail.style.background = ''; trail.style.transition = ''; } }, 300);
    }
  }
}

// === BOARD OVERLAY: фіксований хедер стає абсолютним оверлеєм, контент скролиться за ним ===
function applyBoardOverlays() {
  const configs = [
    { fixedId: 'me-fixed-top',       scrollId: 'me-content' },
    { fixedId: 'evening-fixed-top',  scrollId: 'evening-scroll' },
    { fixedId: 'health-fixed-top',   scrollId: 'health-scroll' },
    { fixedId: 'projects-fixed-top', scrollId: 'projects-scroll' },
    { fixedId: 'inbox-fixed-top',    scrollId: 'inbox-scroll' },
    { fixedId: 'fin-fixed-top',      scrollId: 'fin-scroll' },
  ];
  configs.forEach(({ fixedId, scrollId }) => {
    const fixed = document.getElementById(fixedId);
    const scroll = document.getElementById(scrollId);
    if (!fixed || !scroll) return;
    // Хедер стає абсолютним — виходить з flex-flow, overlay поверх скролу
    fixed.style.position = 'absolute';
    fixed.style.top = '0';
    fixed.style.left = '0';
    fixed.style.right = '0';
    fixed.style.zIndex = '5';
    fixed.style.pointerEvents = 'none';
    // Дочірні елементи хедера перехоплюють дотики (кнопки, табло)
    [...fixed.children].forEach(c => { c.style.pointerEvents = 'all'; });
    // Скрол розтягується на всю сторінку, padding-top = висота хедера + 14px відступ
    const h = fixed.offsetHeight;
    scroll.style.paddingTop = (h + 14) + 'px';
  });
}

// === CENTRAL KEY REGISTRY (єдине джерело правди для localStorage) ===
const NM_KEYS = {
  // Основні дані (→ Supabase таблиці в майбутньому)
  data: ['nm_inbox','nm_tasks','nm_notes','nm_folders_meta','nm_moments',
         'nm_habits2','nm_habit_log2','nm_quit_log','nm_finance',
         'nm_finance_budget','nm_finance_cats','nm_health_cards',
         'nm_health_log','nm_projects','nm_trash'],
  // Налаштування (→ Supabase user_settings)
  settings: ['nm_settings','nm_gemini_key','nm_memory','nm_memory_ts',
              'nm_active_tabs','nm_onboarding_done','nm_evening_mood',
              'nm_evening_summary','nm_notes_folders_ts'],
  // Чат-историки (→ Supabase chat_messages)
  chat: ['nm_chat_inbox','nm_chat_tasks','nm_chat_notes','nm_chat_me',
         'nm_chat_evening','nm_chat_finance','nm_chat_health','nm_chat_projects'],
  // Кеш/тимчасове (не потребує Supabase)
  cache: ['nm_owl_board','nm_owl_board_ts','nm_owl_cooldowns','nm_owl_schedule_asked',
          'nm_owl_schedule_pending','nm_error_log',
          'nm_fin_coach_week','nm_fin_coach_month','nm_fin_coach_3months'],
  // Динамічні патерни (видаляти через startsWith)
  patterns: ['nm_task_chat_', 'nm_visited_', 'nm_owl_tab_'],
};

// === SCHEMA MIGRATIONS — "добиває" відсутні поля в старих даних ===
function runMigrations() {
  // v1: dueDate + priority для tasks (потрібні для Календаря)
  const tasks = JSON.parse(localStorage.getItem('nm_tasks') || '[]');
  let changed = false;
  tasks.forEach(t => {
    if (t.dueDate === undefined) { t.dueDate = null; changed = true; }
    if (t.priority === undefined) { t.priority = 'normal'; changed = true; }
  });
  if (changed) localStorage.setItem('nm_tasks', JSON.stringify(tasks));
  // v2: нові міграції додавати тут
}

// === INIT ===
function init() {
  try { runMigrations(); } catch(e) {}
  try { setupPWA(); } catch(e) {}
  try { setupSW(); } catch(e) {}
  try { setupSync(); } catch(e) {}
  try { setupKeyboardAvoiding(); } catch(e) {}
  try { setupChatBarSwipe(); } catch(e) {}
  try { setupDrumTabbar(); } catch(e) {}
  try { setupSettingsSwipe(); } catch(e) {}
  // Me chat enter key
  // me-chat-input Enter handled via onkeydown in HTML
  try { applyTheme('inbox'); } catch(e) {}
  // Встановлюємо CSS змінну висоти таббару — після рендеру через rAF
  try {
    const tb = document.getElementById('tab-bar');
    if (tb) {
      const setTabbarH = () => {
        const h = tb.offsetHeight;
        if (h > 0) document.documentElement.style.setProperty('--tabbar-h', h + 'px');
      };
      // Перший раз — одразу
      requestAnimationFrame(() => requestAnimationFrame(setTabbarH));
      // Другий раз — після шрифтів
      if (document.fonts) document.fonts.ready.then(() => requestAnimationFrame(setTabbarH));
      // Третій раз — через 500ms як fallback
      setTimeout(setTabbarH, 500);
      // Оновлюємо при зміні орієнтації
      window.addEventListener('resize', setTabbarH, { passive: true });
    }
  } catch(e) {}
  // Force inbox tab active on every load
  try {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('page-inbox').classList.add('active');
    document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
    document.querySelector('.tab-item[data-tab="inbox"]').classList.add('active');
  } catch(e) {}
  try { updateKeyStatus(!!localStorage.getItem('nm_gemini_key')); } catch(e) {}
  try { renderInbox(); } catch(e) {}
  // Рендеримо всі табло одразу — показуємо збережені дані без очікування switchTab
  try { ['tasks','notes','me','evening','finance','health','projects'].forEach(t => renderTabBoard(t)); } catch(e) {}
  // Відновлюємо чат Inbox якщо є збережені повідомлення
  try { restoreChatUI('inbox'); } catch(e) {}
  // Показуємо inbox bar одразу — він тепер керується як tasks/me/evening
  try {
    const inboxBar = document.getElementById('inbox-ai-bar');
    if (inboxBar) inboxBar.style.display = 'flex';
  } catch(e) {}
  try { setTimeout(() => showFirstVisitTip('inbox'), 1500); } catch(e) {}
  // Хедери стають overlay над контентом (ефект скролу під табло)
  try { requestAnimationFrame(() => requestAnimationFrame(applyBoardOverlays)); } catch(e) {}
  try { setTimeout(applyBoardOverlays, 500); } catch(e) {}
  setTimeout(() => { try { autoRefreshMemory(); } catch(e) {} }, 3000);
  try { setupAutoEveningSummary(); } catch(e) {}
  try { cleanupTrash(); } catch(e) {}
  // Показуємо кешований OWL Board одразу (без затримки)
  try { const _msgs = JSON.parse(localStorage.getItem('nm_owl_board') || '[]'); if (_msgs.length > 0) renderOwlBoard(); } catch(e) {}
  // Цикл генерації нових повідомлень — з невеликою затримкою
  setTimeout(() => { try { startOwlBoardCycle(); } catch(e) {} }, 2000);
}

function showApp() {
  const splash = document.getElementById('splash');
  if (splash) {
    splash.classList.add('hide');
    setTimeout(() => splash.classList.add('gone'), 400);
  }
  try { checkOnboarding(); } catch(e) {}
}

// === SPLASH → APP ===
function bootApp() {
  try { init(); } catch(e) { console.error('init error:', e); }
  // Show app after brief splash — use both timer and readyState check
  const delay = document.readyState === 'complete' ? 300 : 500;
  setTimeout(showApp, delay);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootApp);
} else {
  // Already loaded (e.g. Chrome with cached page)
  bootApp();
}

// Fallback: force hide splash after 3s no matter what
setTimeout(() => {
  const splash = document.getElementById('splash');
  if (splash && !splash.classList.contains('gone')) {
    splash.classList.add('hide');
    setTimeout(() => splash.classList.add('gone'), 600);
  }
}, 3000);
