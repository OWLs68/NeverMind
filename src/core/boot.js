import { applyTheme, autoRefreshMemory, closeSettings, currentTab, setupDrumTabbar, updateKeyStatus } from './nav.js';
import { generateUUID } from './uuid.js';
import { cleanupTrash } from './trash.js';
import { restoreChatUI } from '../ai/core.js';
import { renderTabBoard } from '../owl/board.js';
import { renderOwlBoard, setupChatBarSwipe, startOwlBoardCycle, clearStaleBoards } from '../owl/inbox-board.js';
import { startFollowupsCycle } from '../owl/followups.js';
import { startBrainPulseCycle } from '../owl/brain-pulse.js';
import { setupKeyboardAvoiding } from '../ui/keyboard.js';
import { renderInbox } from '../tabs/inbox.js';
import { renderTasks, setupModalSwipeClose } from '../tabs/tasks.js';
import { renderHabits, renderProdHabits, updateProdTabCounters } from '../tabs/habits.js';
import { renderNotes } from '../tabs/notes.js';
import { renderFinance } from '../tabs/finance.js';
import { renderEvening } from '../tabs/evening.js';
import { renderMe } from '../tabs/me.js';
import { checkOnboarding, showFirstVisitTip } from '../tabs/onboarding.js';
import { renderHealth } from '../tabs/health.js';
import { renderProjects } from '../tabs/projects.js';

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

  // B-73 fix: iOS PWA standalone іноді не пробиває кеш page. Додаємо cache-bust query
  // щоб URL змінився і браузер не взяв з pages cache.
  const doReload = () => {
    if (_reloading) return;
    _reloading = true;
    const url = new URL(window.location.href);
    url.searchParams.set('_v', Date.now());
    window.location.replace(url.toString());
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
    if (document.visibilityState === 'visible' && _swReg) _swReg.update().catch(() => {});
  });

  // pageshow з persisted=true — iOS bfcache відновлення (окремий від visibilitychange кейс)
  window.addEventListener('pageshow', e => {
    if (e.persisted && _swReg) _swReg.update().catch(() => {});
  });

  navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' })
    .then(reg => {
      _swReg = reg;
      reg.update().catch(() => {});

      // B-73: якщо вже є waiting SW (попередня сесія не активувала) — форсуємо skipWaiting
      if (reg.waiting && navigator.serviceWorker.controller) {
        reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      }

      // updatefound → installing → installed → (SKIP_WAITING) → activated → controllerchange → reload
      reg.addEventListener('updatefound', () => {
        const sw = reg.installing;
        if (!sw) return;
        sw.addEventListener('statechange', () => {
          // B-73: щойно новий SW installed і є старий controller → просимо активуватись зараз
          // (не чекаємо природного переходу який iOS PWA іноді пропускає)
          if (sw.state === 'installed' && navigator.serviceWorker.controller) {
            sw.postMessage({ type: 'SKIP_WAITING' });
          }
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
                            if (currentTab === 'me')    try { renderMe(); } catch(e) {}
                          },
    'nm_notes':           () => { if (currentTab === 'notes') try { renderNotes(); } catch(e) {} },
    'nm_folders_meta':    () => { if (currentTab === 'notes') try { renderNotes(); } catch(e) {} },
    'nm_moments':         () => {
                            if (currentTab === 'me')      try { renderMe(); } catch(e) {}
                            if (currentTab === 'evening') try { renderEvening(); } catch(e) {}
                          },
    'nm_finance':         () => { if (currentTab === 'finance')  try { renderFinance(); } catch(e) {} },
    'nm_finance_budget':  () => { if (currentTab === 'finance')  try { renderFinance(); } catch(e) {} },
    'nm_finance_cats':    () => { if (currentTab === 'finance')  try { renderFinance(); } catch(e) {} },
    'nm_health_cards':    () => { if (currentTab === 'health')   try { renderHealth(); } catch(e) {} },
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

// === PAGE TRANSITIONS ===
let currentTabForAnim = 'inbox';
export function animateTabSwitch(newTab) {
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
// Використовує той самий механізм що й модалки задач/звичок —
// панель їде за пальцем, закривається при свайпі >80px.
// Свайп блокується коли починається всередині .settings-scroll —
// там нативна прокрутка має пріоритет. Зверху (handle, заголовок, версія)
// свайп завжди працює — незалежно від того скільки прокрутив.
function setupSettingsSwipe() {
  const panel = document.getElementById('settings-panel-el');
  if (!panel) return;
  setupModalSwipeClose(panel, closeSettings);
}

export function applyBoardOverlays() {
  const configs = [
    { fixedId: 'me-fixed-top',       scrollId: 'me-content' },
    { fixedId: 'evening-fixed-top',  scrollId: 'evening-scroll' },
    { fixedId: 'health-fixed-top',   scrollId: 'health-scroll' },
    { fixedId: 'projects-fixed-top', scrollId: 'projects-scroll' },
    { fixedId: 'inbox-fixed-top',    scrollId: 'inbox-scroll' },
    { fixedId: 'fin-fixed-top',      scrollId: 'fin-scroll' },
    { fixedId: 'notes-fixed-top',    scrollId: 'notes-scroll' },
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
export const NM_KEYS = {
  // Основні дані (→ Supabase таблиці в майбутньому)
  data: ['nm_inbox','nm_tasks','nm_notes','nm_folders_meta','nm_moments',
         'nm_habits2','nm_habit_log2','nm_quit_log','nm_finance',
         'nm_finance_budget','nm_finance_cats','nm_health_cards',
         'nm_health_log','nm_projects','nm_trash'],
  // Налаштування (→ Supabase user_settings)
  settings: ['nm_settings','nm_gemini_key','nm_memory','nm_memory_ts',
              'nm_facts','nm_facts_migrated',
              'nm_active_tabs','nm_onboarding_done','nm_evening_mood',
              'nm_evening_summary'],
  // Чат-историки (→ Supabase chat_messages)
  chat: ['nm_chat_inbox','nm_chat_tasks','nm_chat_notes','nm_chat_me',
         'nm_chat_evening','nm_chat_finance','nm_chat_health','nm_chat_projects'],
  // Кеш/тимчасове (не потребує Supabase)
  cache: ['nm_owl_board','nm_owl_board_ts','nm_owl_cooldowns','nm_owl_schedule_asked',
          'nm_owl_schedule_pending','nm_error_log'],
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
  // v2 (Фаза 1 Фінансів, 15.04.2026): прибрати застарілі ключі кешу OWL-коуча
  // Блок прибрано з вкладки у переробці концепції v2, кеш-ключі більше не використовуються.
  ['nm_fin_coach_week','nm_fin_coach_month','nm_fin_coach_3months'].forEach(k => {
    localStorage.removeItem(k);
  });
  // v3 (B-32 Фаза 6, 16.04.2026): одноразове очищення кешу OWL-табло
  // щоб прибрати галюциновані повідомлення (€824 на їжу при €58 реальних).
  // getFinanceContext тепер має явні маркери [MONTH_EXPENSES], [TODAY_EXPENSES].
  if (!localStorage.getItem('nm_owl_cache_cleared_v3')) {
    ['nm_owl_board','nm_owl_tab_finance','nm_owl_tab_tasks','nm_owl_tab_notes',
     'nm_owl_tab_health','nm_owl_tab_projects','nm_owl_tab_evening','nm_owl_tab_me',
     'nm_owl_board_ts',
     // Скидаємо Auto-silence щоб OWL заговорив одразу після очищення кешу
     'nm_owl_silence_until','nm_owl_ignored_msgs','nm_owl_last_board_ts','nm_owl_last_chip_click_ts'
    ].forEach(k => localStorage.removeItem(k));
    localStorage.setItem('nm_owl_cache_cleared_v3', '1');
  }
  // v4 (16.04.2026): очистити кеш інсайту фінансів (промпт змінився — потрібна re-generation)
  ['nm_fin_insight_week_0','nm_fin_insight_month_0','nm_fin_insight_3months_0'].forEach(k => localStorage.removeItem(k));
  // v5 (16.04.2026): скинути Auto-silence OWL — табло зникло бо v3 очистив кеш але НЕ скинув silence.
  // OWL замовк і нового не генерує → порожнє табло на всіх вкладках.
  if (!localStorage.getItem('nm_owl_silence_reset_v5')) {
    ['nm_owl_silence_until','nm_owl_ignored_msgs','nm_owl_last_board_ts','nm_owl_last_chip_click_ts'].forEach(k => localStorage.removeItem(k));
    localStorage.setItem('nm_owl_silence_reset_v5', '1');
  }
  // v6 (19.04.2026 сесія 6GoDe): прибрати legacy nm_health_log — UI шкал 1-10
  // видалено 15.04 (B-31), дані вже не записуються і код що їх читав видалений.
  if (!localStorage.getItem('nm_health_log_cleared_v6')) {
    localStorage.removeItem('nm_health_log');
    localStorage.setItem('nm_health_log_cleared_v6', '1');
  }
  // v7 (27.04.2026 UVKL1 Pruning Engine Фаза 2): одноразовий wipe історії табла.
  // Старі повідомлення сови не мають поля entityRefs — вони не фільтруються
  // isMessageRelevant і будуть «застряглі» в історії боксі назавжди.
  // Wipe чистить unified storage щоб сова почала з нуля з правильною моделлю.
  // Видимий ефект: табло порожнє ~30 сек поки сова не згенерує перше нове
  // повідомлення (з entityRefs) — далі нормальний потік.
  if (!localStorage.getItem('nm_pruning_wipe_v1_done')) {
    ['nm_owl_board_unified','nm_owl_board_unified_ts',
     'nm_owl_board','nm_owl_board_ts',
     // Тригерні TS-ключі вкладок — щоб Judge Layer не вирішив що
     // «тільки що генерували, мовчимо ще 30 хв»
     'nm_owl_tab_ts_inbox','nm_owl_tab_ts_tasks','nm_owl_tab_ts_notes',
     'nm_owl_tab_ts_me','nm_owl_tab_ts_evening','nm_owl_tab_ts_finance',
     'nm_owl_tab_ts_health','nm_owl_tab_ts_projects'
    ].forEach(k => localStorage.removeItem(k));
    localStorage.setItem('nm_pruning_wipe_v1_done', '1');
    console.log('[boot] Pruning Engine v1: wiped legacy board history (no entityRefs)');
  }
  // v8 (27.04.2026 xGe1H Pre-Migration Hardening Підсесія 1B): Task.id Date.now() → UUID.
  // Пілот UUID-міграції перед Supabase. Supabase primary key очікує UUID, не number.
  // Бекап nm_tasks у nm_tasks_backup_v7 — на випадок rollback. Перевіряє typeof
  // щоб не повторно мігрувати рядкові ID. Не чіпає steps[].id (окрема міграція v9+).
  if (!localStorage.getItem('nm_tasks_uuid_migrated_v8')) {
    try {
      const tasksRaw = localStorage.getItem('nm_tasks');
      if (tasksRaw) {
        // Бекап тільки nm_tasks (не весь localStorage — щоб не вилетіти у quota)
        localStorage.setItem('nm_tasks_backup_v7', tasksRaw);
        const tasks = JSON.parse(tasksRaw);
        if (Array.isArray(tasks)) {
          let migrated = 0;
          tasks.forEach(t => {
            if (typeof t.id === 'number') {
              t.legacy_id = t.id;
              t.id = generateUUID();
              migrated++;
            }
          });
          if (migrated > 0) {
            localStorage.setItem('nm_tasks', JSON.stringify(tasks));
            console.log(`[boot] v8 migration: ${migrated} tasks migrated to UUID`);
          }
        }
      }
      localStorage.setItem('nm_tasks_uuid_migrated_v8', '1');
    } catch (e) {
      console.error('[boot] v8 migration failed:', e);
      // Rollback з бекапу якщо щось зламалось
      const backup = localStorage.getItem('nm_tasks_backup_v7');
      if (backup) {
        try { localStorage.setItem('nm_tasks', backup); } catch(_) {}
      }
    }
  }
  // v9: нові міграції додавати тут
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
  // Інвалідація табло зі вчора і раніше (AI пише "завтра/вчора" — стають неправдою при зміні дня)
  try { clearStaleBoards(); } catch(e) {}
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
  // setupAutoEveningSummary() видалено у Фазі 5 Вечора 2.0 — сова пише першою
  // у чат о 18:00 через тригер evening-prompt (src/owl/followups.js). Щогодинний
  // автопідсумок у картці став дублем і зайвим шумом.
  try { cleanupTrash(); } catch(e) {}
  // Показуємо кешований OWL Board одразу (без затримки).
  // Шар 2 "Один мозок V2" (rJYkw 21.04): unified storage + міграція старих ключів
  // виконуються автоматично при першому читанні.
  try {
    const _unified = JSON.parse(localStorage.getItem('nm_owl_board_unified') || '[]');
    const _legacy = JSON.parse(localStorage.getItem('nm_owl_board') || '[]');
    if (_unified.length > 0 || _legacy.length > 0) renderOwlBoard();
  } catch(e) {}
  // Цикл генерації нових повідомлень — з невеликою затримкою
  setTimeout(() => { try { startOwlBoardCycle(); } catch(e) {} }, 2000);
  // Live chat replies (Фаза 2 OWL-мозку) — follow-up повідомлення у контекстний чат
  setTimeout(() => { try { startFollowupsCycle(); } catch(e) {} }, 3000);
  // Brain Pulse (ZJmdF Фаза B — Один мозок на все): проактивні повідомлення
  // у чат будь-якої вкладки на основі живих сигналів. Мозок сам обирає куди/що.
  setTimeout(() => { try { startBrainPulseCycle(); } catch(e) {} }, 4000);
}

function showApp() {
  const splash = document.getElementById('splash');
  if (splash) {
    splash.classList.add('hide');
    setTimeout(() => splash.classList.add('gone'), 200);
  }
  try { checkOnboarding(); } catch(e) {}
}

// === SPLASH → APP ===
// Мінімальне тертя (rJYkw 21.04.2026): прибрана затримка 300-500мс перед showApp.
// Застосунок показується одразу після init(). Splash fade 200мс + знищення DOM.
// Загалом юзер чекає ~200мс замість 700-900мс раніше.
function bootApp() {
  try { init(); } catch(e) { console.error('init error:', e); }
  // Показуємо одразу — без delay
  showApp();
  // Фаза 6 OWL V3 (xHQfi 30.04): фоновий збір довгострокових патернів через
  // requestIdleCallback. Працює раз на 24 год коли пристрій простоює — не
  // блокує UI. Сам всередині перевіряє чи треба оновлювати.
  try {
    if (typeof window.buildProfileIfStale === 'function') {
      window.buildProfileIfStale();
    }
  } catch {}
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootApp);
} else {
  // Already loaded (e.g. Chrome with cached page)
  bootApp();
}

// Fallback: якщо bootApp не встиг з якоїсь причини — ховаємо splash через 1с.
// (раніше було 3с, але тепер showApp викликається одразу — fallback лишається
// тільки як безпека на випадок краху init()).
setTimeout(() => {
  const splash = document.getElementById('splash');
  if (splash && !splash.classList.contains('gone')) {
    splash.classList.add('hide');
    setTimeout(() => splash.classList.add('gone'), 200);
  }
}, 1000);

