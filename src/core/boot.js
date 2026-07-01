import { applyTheme, autoRefreshMemory, closeSettings, currentTab, setupDrumTabbar, updateKeyStatus } from './nav.js';
import { generateUUID } from './uuid.js';
import { runMigrations } from './migrations.js';
import { createSelectiveBackup } from './backup.js';
import { initDelegation } from './delegation.js';
import { initTouchDetect } from '../ui/touch-detect.js';
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
import { renderCalendar } from '../tabs/calendar.js';

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
    // B-117 fix (QDIGl 04.05): renderTabBoard для всіх вкладок щоб сова
    // оновилася одразу після complete_task/habit на БУДЬ-ЯКІЙ вкладці
    // (раніше тільки 'tasks' → у Notes/Health/Me табло висіло stale).
    // Pruning через isMessageRelevant викине stale msg у наступному _pickMessageForTab.
    // renderTabBoard читає з localStorage, не йде в API → дешево для 7 вкладок.
    'nm_tasks':           () => {
                            if (currentTab === 'tasks') try { renderTasks(); updateProdTabCounters(); } catch(e) {}
                            try { ['tasks','notes','me','evening','finance','health','projects'].forEach(t => renderTabBoard(t)); } catch(e) {}
                          },
    'nm_habits2':         () => {
                            if (currentTab === 'tasks') try { renderHabits(); renderProdHabits(); } catch(e) {}
                            try { ['tasks','notes','me','evening','finance','health','projects'].forEach(t => renderTabBoard(t)); } catch(e) {}
                          },
    'nm_habit_log2':      () => {
                            if (currentTab === 'tasks') try { renderHabits(); renderProdHabits(); } catch(e) {}
                            if (currentTab === 'me')    try { renderMe(); } catch(e) {}
                            try { ['tasks','notes','me','evening','finance','health','projects'].forEach(t => renderTabBoard(t)); } catch(e) {}
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
    'nm_routine':         () => { if (currentTab === 'tasks') try { renderCalendar(); } catch(e) {} },
    'nm_events':          () => { if (currentTab === 'tasks') try { renderCalendar(); } catch(e) {} },
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

  // --- Механізм 1b: nm-data-changed custom event (UvEHE 03.05) ---
  // Спрацьовує у ТІЙ САМІЙ вкладці при saveX() — fix для chip-save через
  // applyClarifyChoice / AI dispatch що раніше не викликали re-render
  // (Роман: «папки пропали після тапу chip Зберегти у щоденник»).
  // Mapping detail → localStorage key для KEY_RENDER_MAP.
  const DETAIL_TO_KEY = {
    'inbox': 'nm_inbox',
    'tasks': 'nm_tasks',
    'habits': 'nm_habits2',
    'notes': 'nm_notes',
    'finance': 'nm_finance',
    'health': 'nm_health_cards',
    'projects': 'nm_projects',
    'evening': 'nm_evening_summary',
    'reminder': 'nm_reminders',
    // B-165 dyhJu 10.05: saveEvents() disp 'events' (множ), мапа очікувала
    // 'event' (одн) — cross-tab sync для подій silent failure до dyhJu.
    // Той самий клас бага що B-130 (reminder mismatch).
    'events': 'nm_events',
    // db0YY 12.05: B-176 fix — save_routine reverser у action-reversers диспатчив
    // 'routine' але мапа не знала → Календар не оновлювався після undo розпорядку.
    'routine': 'nm_routine',
    'allergies': 'nm_health_cards',
  };
  window.addEventListener('nm-data-changed', e => {
    const detail = e.detail;
    if (typeof detail !== 'string') return;
    const key = DETAIL_TO_KEY[detail];
    if (key) handleSyncKey(key);
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
//
// ⚠️ ДОДАВАЄШ НОВИЙ `nm_*` ключ → одразу впиши сюди. Інакше:
//   1. `clearAllData()` у nav.js залишить його після wipe (стара інформація)
//   2. Перед-Supabase backup (`createSelectiveBackup` у backup.js) пропустить
//   3. Boot-time assertion `_assertAllKeysKnown()` у консолі warn'не
//
// Аудит DGH6F 16.05.2026 (Council Pre-mortem знайшов 5 пропущених у data) —
// розширено на 44 ключі через широкий grep констант + literal'ів.
export const NM_KEYS = {
  // Основні дані (→ Supabase таблиці в майбутньому)
  data: ['nm_inbox','nm_tasks','nm_notes','nm_folders_meta','nm_moments',
         'nm_habits2','nm_habit_log2','nm_quit_log','nm_finance',
         'nm_finance_budget','nm_finance_cats','nm_health_cards',
         'nm_health_log','nm_projects','nm_trash',
         // DGH6F 16.05.2026: пропущені у попередньому реєстрі — clearAllData
         // залишала їх після wipe, Supabase backup їх би НЕ включив. Все —
         // юзерські дані: події календаря, нагадування, розпорядок дня,
         // алергії у health-картках, лог дій для undo (7 днів TTL).
         'nm_events','nm_reminders','nm_routine','nm_allergies','nm_action_log',
         // v3pexs 27.06: списки-чеклісти в Inbox (окрема сутність, не задачі).
         'nm_lists'],
  // Налаштування (→ Supabase user_settings)
  settings: ['nm_settings','nm_gemini_key','nm_memory','nm_memory_ts',
              'nm_facts','nm_facts_migrated','nm_voice_mode',
              'nm_active_tabs','nm_onboarding_done','nm_evening_mood',
              'nm_evening_summary',
              // DGH6F 16.05: стан UI / Me-інсайти / interview state / patterns
              'nm_evening_closed','nm_evening_topic_started','nm_tab_first_visit',
              'nm_last_active','nm_last_active_day','nm_survey_done','nm_seen_update',
              'nm_device_id','nm_user_patterns','nm_user_patterns_ts',
              'nm_me_monthly_report','nm_me_monthly_override','nm_me_monthly_show_until',
              'nm_me_weekly_insights',
              // nm_health_interview_pending REMOVED (EU AI Act JMQuT) — видаляється через v18 migration.
              'nm_project_interview_name','nm_project_interview_step',
              'nm_project_interview_answers','nm_project_interview_id',
              'nm_project_interview_lastq'],
  // Чат-историки (→ Supabase chat_messages)
  chat: ['nm_chat_inbox','nm_chat_tasks','nm_chat_notes','nm_chat_me',
         'nm_chat_evening','nm_chat_finance','nm_chat_projects',
         // nm_chat_health REMOVED (EU AI Act compliance JMQuT 17.05.2026) — чату Health немає.
         // Видаляється одноразово через v18 migration.
         // 64CXo: nm_owl_chat — OWL mini-chat у inbox-board, поза 8 tab-чатами.
         // Раніше не входив у clearAllData → стара розмова після wipe.
         'nm_owl_chat'],
  // Кеш/тимчасове (не потребує Supabase) + migration flags
  cache: ['nm_owl_board','nm_owl_board_ts','nm_owl_cooldowns','nm_owl_schedule_asked',
          'nm_owl_schedule_pending','nm_error_log','nm_tts_usage',
          // PJi7l 08.05: unified board storage + chip payloads + seen-IDs
          // Без них після clearAllData табло Inbox/Notes показувало стару інформацію.
          'nm_owl_board_unified','nm_owl_board_unified_ts',
          'nm_owl_board_migrated_v2','nm_chip_payloads','nm_owl_board_seen',
          // DGH6F 16.05: OWL runtime cache (questions, silence, errors, timestamps)
          'nm_owl_api_error','nm_owl_questions','nm_owl_q_ts',
          'nm_owl_ignored_msgs','nm_owl_silence_until',
          'nm_owl_last_board_ts','nm_owl_last_chip_click_ts','nm_owl_board_said',
          // 7uxlr7 12.06: orphan-ключі знайдені assertion'ом у логах Романа —
          // notes folder-ordering timestamp (legacy, більше не пишеться, але
          // лишається у старих сховищах) → cache щоб clearAllData його прибрав.
          'nm_notes_folders_ts',
          // Finance insights cache: динамічний ключ nm_fin_insight_${period}_${offset}
          // (offset 0, -1, -2... — кожен горизонт/місяць окремо) → ПАТЕРН нижче,
          // не точкові ключі. nm_fin_benchmark — окремий, лишається точковим.
          'nm_fin_benchmark',
          // Debug logs (TTL обмежений, не для Supabase)
          'nm_intent_router_log','nm_tool_filter_log','nm_reasoning_log','nm_usage_log',
          // Chip GC + stats + interactive guide cache
          'nm_chip_payloads_lastGC','nm_chip_stats',
          'nm_recent_actions','nm_sync',
          'nm_guide_last_ts','nm_guide_shown_tips','nm_guide_shown_topics',
          'nm_guide_step','nm_guide_waiting_topic',
          // Migration flags (boot.js runMigrations) — у cache щоб clearAllData
          // міг скинути для тестування міграцій з чистого стану.
          'nm_pruning_wipe_v1_done','nm_owl_cache_cleared_v3','nm_owl_silence_reset_v5',
          'nm_health_migrated_v2','nm_health_log_cleared_v6','nm_health_status_v2_done',
          'nm_tasks_uuid_migrated_v8','nm_habits_uuid_migrated_v9',
          'nm_events_uuid_migrated_v10','nm_notes_uuid_migrated_v11',
          'nm_moments_uuid_migrated_v12','nm_finance_uuid_migrated_v13',
          'nm_projects_uuid_migrated_v14','nm_inbox_uuid_migrated_v15',
          'nm_health_uuid_migrated_v16','nm_steps_uuid_migrated_v17',
          'nm_health_ai_isolation_v18',
          'nm_chips_v10_done','nm_chips_v10_done_ts',
          'nm_folders_apostrophe_migrated',
          'nm_board_clean_pji7l_done','nm_board_clean_pji7l_v2_done'],
  // Динамічні патерни (видаляти через startsWith)
  patterns: ['nm_task_chat_', 'nm_visited_', 'nm_owl_tab_',
             // DGH6F 16.05: backup snapshots (backup.js createSelectiveBackup
             // створює ключі типу nm_backup_v{N}_{label}_{timestamp}).
             'nm_backup_',
             // 7uxlr7 12.06: динамічні ключі що раніше випадали з реєстру
             // (assertion-warning у логах Романа).
             // Finance insight кеш: nm_fin_insight_${period}_${offset} — offset
             // 0/-1/-2... безмежний, точкові ключі не покрити.
             'nm_fin_insight_',
             // Tasks UUID-migration backup: nm_tasks_backup_v7 (boot.js:522) +
             // майбутні версії v8.. — транзитний бекап перед міграцією.
             'nm_tasks_backup_'],
};

// Boot-time assertion (DGH6F 16.05.2026): сканує localStorage і console.warn
// якщо знайде `nm_*` ключ що не входить у NM_KEYS. Це профілактика регресії —
// додав новий ключ у код, забув у реєстр → побачу одразу при boot, не через
// тиждень коли почнеться Supabase backup і дані зникнуть.
//
// Не блокує boot. Не падає. Тільки попереджає.
export function _assertAllKeysKnown() {
  try {
    const known = new Set([
      ...NM_KEYS.data, ...NM_KEYS.settings, ...NM_KEYS.chat, ...NM_KEYS.cache,
    ]);
    const patterns = NM_KEYS.patterns;
    const unknown = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith('nm_')) continue;
      if (known.has(k)) continue;
      if (patterns.some(p => k.startsWith(p))) continue;
      unknown.push(k);
    }
    if (unknown.length > 0) {
      console.warn(
        '[NM_KEYS] Знайдено ' + unknown.length + ' nm_* ключ(ів) поза реєстром.\n' +
        'Додай у NM_KEYS у boot.js (data/settings/chat/cache/patterns):\n' +
        unknown.map(k => '  - ' + k).join('\n') + '\n' +
        'Інакше clearAllData() їх не видалить + Supabase backup пропустить.'
      );
    }
  } catch (e) {
    // не блокуємо boot при крашу assertion'а
  }
}

// === SCHEMA MIGRATIONS — ПЕРЕНЕСЕНО (v3pexs 28.06, D3) ===
// runMigrations (18 міграцій, 837 рядків) тепер у src/core/migrations.js.

// === INIT ===
function init() {
  // DGH6F 16.05: runMigrations критичний — silent fail призводив до пропуску
  // схема-міграцій (юзер бачить порожні поля, AI ламається на старому форматі)
  // БЕЗ слідів у логах. Тепер пишемо у nm_error_log + console.error.
  // Прямий запис без import logger.js (циклічна залежність — logger→nav→boot).
  // Council аудит 16.05: захист від recursive quota fail — якщо setItem
  // нового логу падає (квота переповнена), пробуємо обмежити log до 5 записів.
  try { runMigrations(); } catch(e) {
    console.error('[boot] runMigrations failed:', e);
    try {
      const log = JSON.parse(localStorage.getItem('nm_error_log') || '[]');
      const entry = {
        ts: Date.now(),
        type: 'boot-migration-fail',
        msg: String(e?.message || e).slice(0, 500),
        src: 'boot.js:runMigrations',
        tab: '?',
        stack: e?.stack ? String(e.stack).slice(0, 1500) : null,
        actions: [],
      };
      log.push(entry);
      try {
        localStorage.setItem('nm_error_log', JSON.stringify(log.slice(-200)));
      } catch {
        // Quota recursive fail — пробуємо мінімальний log (тільки цей запис)
        try { localStorage.setItem('nm_error_log', JSON.stringify([entry])); } catch {}
      }
    } catch {}
  }
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
  // Phase 7 Шар 6 (04.05): GC nm_chip_payloads (ленива cleanup, раз на 7 днів
  // АБО якщо >500 keys). Окремий tick через setTimeout — не блокує splash.
  setTimeout(() => {
    import('../owl/chips.js').then(m => { try { m._gcChipPayloads && m._gcChipPayloads(); } catch(e) {} });
  }, 5000);
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
  // OBErR 18.05.2026: NM_KEYS у window щоб backup.createFullBackup міг
  // читати єдиний реєстр ключів без circular import (boot ↔ backup).
  try { window.NM_KEYS = NM_KEYS; } catch {}
  // DGH6F 16.05.2026: event delegation listener реєструємо ПЕРЕД showApp щоб
  // header buttons (data-action="open-settings"/"open-help") працювали з
  // першого ж рендеру. ПIСЛЯ init() бо delegation imports nav (через app.js).
  try { initDelegation(); } catch(e) { console.error('delegation init error:', e); }
  // OBErR CSP Phase 2.5 (19.05.2026): touch-detect helper для swipe/tap
  // координатної логіки (owl-tab swipe + task step-check). Окремий init
  // бо різна signature handler'ів (dataset + delta vs dataset).
  try { initTouchDetect(); } catch(e) { console.error('touch-detect init error:', e); }
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
  // DGH6F 16.05.2026: попередження якщо у localStorage є nm_* ключі що не
  // у NM_KEYS реєстрі. Профілактика регресії перед Supabase backup.
  try { _assertAllKeysKnown(); } catch {}
  // AI-тестер (e9t3N 15.05.2026) — milestone «boot завершено». Тестер у Python
  // чекає `window.NM_BOOT_DONE === true` (max 5 сек) щоб переконатись що
  // міграції+init+showApp пройшли без crash. Це Тест 1 з AI_TESTER_INTEGRATION.md.
  try { window.NM_BOOT_DONE = true; } catch {}
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


