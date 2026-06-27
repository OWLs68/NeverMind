import { applyTheme, autoRefreshMemory, closeSettings, currentTab, setupDrumTabbar, updateKeyStatus } from './nav.js';
import { generateUUID } from './uuid.js';
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
  // PJi7l 08.05: одноразова очистка board кешу для нової версії контексту AI.
  // Старі повідомлення містять «жодна задача не закрита» бо до фіксу AI отримував
  // контекст без сигналу про порожні дані. Чистимо щоб board згенерувалось наново
  // з оновленим getAIContext (core.js: явний сигнал коли habits/tasks=0).
  if (!localStorage.getItem('nm_board_clean_pji7l_done')) {
    [
      'nm_owl_board_unified', 'nm_owl_board_unified_ts',
      'nm_owl_board_migrated_v2',  // інакше _migrateOnce думає що міграція вже виконана і не перезаповнює
      'nm_owl_board', 'nm_owl_board_ts',
      'nm_owl_board_seen', 'nm_chip_payloads',
      'nm_owl_tab_ts_inbox', 'nm_owl_tab_ts_notes', 'nm_owl_tab_ts_me',
      'nm_owl_tab_ts_evening', 'nm_owl_tab_ts_finance', 'nm_owl_tab_ts_health',
      'nm_owl_tab_ts_projects', 'nm_owl_tab_ts_tasks',
    ].forEach(k => localStorage.removeItem(k));
    localStorage.setItem('nm_board_clean_pji7l_done', '1');
    console.log('[boot] PJi7l: cleared board cache + ts + migration flag for fresh AI generation');
  }
  // PJi7l 08.05 повторна міграція (v2): попередня очищала тільки unified, але AI-промпт
  // все одно генерував те саме бо контекст не мав явного сигналу. Зараз дамп ще раз —
  // AI перегенерує з оновленим _getInboxBoardContext (proactive.js: empty-state сигнали).
  if (!localStorage.getItem('nm_board_clean_pji7l_v2_done')) {
    [
      'nm_owl_board_unified', 'nm_owl_board_unified_ts',
      'nm_owl_board_migrated_v2',
      'nm_owl_board', 'nm_owl_board_ts',
      'nm_owl_tab_ts_inbox', 'nm_owl_tab_ts_notes', 'nm_owl_tab_ts_me',
      'nm_owl_tab_ts_evening', 'nm_owl_tab_ts_finance', 'nm_owl_tab_ts_health',
      'nm_owl_tab_ts_projects', 'nm_owl_tab_ts_tasks',
    ].forEach(k => localStorage.removeItem(k));
    localStorage.setItem('nm_board_clean_pji7l_v2_done', '1');
    console.log('[boot] PJi7l-v2: re-cleared board for fresh empty-state-aware generation');
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

  // v9 Habits UUID (myshu 11.05.2026 Architecture Refactor Сесія 3B-1):
  // Habit.id був Date.now() (number). Cross-reference: nm_habit_log2 структура
  // {date: {habit.id: true}} — habit.id nested ключ. Міграція потребує:
  //   1) Backup nm_habits2 + nm_habit_log2 ДО зміни (через nm_backup_v* модуль)
  //   2) habits.forEach: id Date.now() → UUID, зберегти legacy_id
  //   3) Збудувати map old_id → new_id
  //   4) habit_log2: переписати ВСI nested ключі (date level → habit.id level)
  if (!localStorage.getItem('nm_habits_uuid_migrated_v9')) {
    try {
      const habitsRaw = localStorage.getItem('nm_habits2');
      const logRaw = localStorage.getItem('nm_habit_log2');
      if (habitsRaw) {
        // 1. Backup ДО будь-якої мутації (через nm_backup_v* модуль)
        const backupKey = createSelectiveBackup(['nm_habits2', 'nm_habit_log2'], 'pre-habit-uuid-v9');
        if (backupKey) console.log('[boot] v9 habits backup:', backupKey);

        const habits = JSON.parse(habitsRaw);
        if (Array.isArray(habits)) {
          // 2-3. Міграція + збір id-mapping
          const idMap = {}; // old_id (string|number) → new_id (UUID)
          let migrated = 0;
          habits.forEach(h => {
            if (h && typeof h.id === 'number') {
              const oldId = String(h.id);
              const newId = generateUUID();
              h.legacy_id = h.id;
              h.id = newId;
              idMap[oldId] = newId;
              migrated++;
            }
          });

          if (migrated > 0) {
            // 4. habit_log2 — переписуємо nested ключі
            // Структура: {date: {habitId: count|true}, ...}
            if (logRaw) {
              try {
                const log = JSON.parse(logRaw);
                if (log && typeof log === 'object') {
                  let logChanged = false;
                  Object.keys(log).forEach(dateKey => {
                    const dayMap = log[dateKey];
                    if (!dayMap || typeof dayMap !== 'object') return;
                    const newDayMap = {};
                    Object.keys(dayMap).forEach(habitIdKey => {
                      const newKey = idMap[habitIdKey] || habitIdKey;
                      newDayMap[newKey] = dayMap[habitIdKey];
                      if (newKey !== habitIdKey) logChanged = true;
                    });
                    log[dateKey] = newDayMap;
                  });
                  if (logChanged) {
                    localStorage.setItem('nm_habit_log2', JSON.stringify(log));
                  }
                }
              } catch (logErr) {
                console.error('[boot] v9 habit_log2 migration failed:', logErr);
              }
            }
            localStorage.setItem('nm_habits2', JSON.stringify(habits));
            console.log(`[boot] v9 migration: ${migrated} habits migrated to UUID, log keys updated`);
          }
        }
      }
      localStorage.setItem('nm_habits_uuid_migrated_v9', '1');
    } catch (e) {
      console.error('[boot] v9 habits migration failed:', e);
      // Не відновлюємо автоматично — користувач може запустити вручну з nm_backup_*
      // через DevTools якщо щось пішло не так.
    }
  }

  // v10 Events UUID (myshu 11.05.2026 Architecture Refactor Сесія 3B-2):
  // Event.id був Date.now(). Cross-reference: inbox.cards мають field
  // 'eventId' що вказує на event.id. Міграція:
  //   1) Backup nm_events + nm_inbox
  //   2) events.id → UUID, legacy_id
  //   3) Map old_id → new_id
  //   4) inbox: оновити eventId field за map (inbox.id ЛИШАЄТЬСЯ — окрема міграція)
  if (!localStorage.getItem('nm_events_uuid_migrated_v10')) {
    try {
      const eventsRaw = localStorage.getItem('nm_events');
      const inboxRaw = localStorage.getItem('nm_inbox');
      if (eventsRaw) {
        const backupKey = createSelectiveBackup(['nm_events', 'nm_inbox'], 'pre-event-uuid-v10');
        if (backupKey) console.log('[boot] v10 events backup:', backupKey);

        const events = JSON.parse(eventsRaw);
        if (Array.isArray(events)) {
          const idMap = {}; // old_id → new_uuid
          let migrated = 0;
          events.forEach(ev => {
            if (ev && typeof ev.id === 'number') {
              const oldId = String(ev.id);
              const newId = generateUUID();
              ev.legacy_id = ev.id;
              ev.id = newId;
              idMap[oldId] = newId;
              migrated++;
            }
          });

          if (migrated > 0) {
            // Cross-ref update: inbox.eventId за map
            if (inboxRaw) {
              try {
                const inbox = JSON.parse(inboxRaw);
                if (Array.isArray(inbox)) {
                  let updated = 0;
                  inbox.forEach(it => {
                    if (it && it.eventId != null) {
                      const k = String(it.eventId);
                      if (idMap[k]) {
                        it.eventId = idMap[k];
                        updated++;
                      }
                    }
                  });
                  if (updated > 0) {
                    localStorage.setItem('nm_inbox', JSON.stringify(inbox));
                    console.log(`[boot] v10 inbox.eventId updated: ${updated} refs`);
                  }
                }
              } catch (ibErr) {
                console.error('[boot] v10 inbox eventId update failed:', ibErr);
              }
            }
            localStorage.setItem('nm_events', JSON.stringify(events));
            console.log(`[boot] v10 migration: ${migrated} events migrated to UUID`);
          }
        }
      }
      localStorage.setItem('nm_events_uuid_migrated_v10', '1');
    } catch (e) {
      console.error('[boot] v10 events migration failed:', e);
    }
  }

  // v11 Notes UUID (myshu 11.05.2026 Architecture Refactor Сесія 3B-3):
  // Note.id був Date.now(). НЕМАЄ persistent cross-references (folder це
  // текст-поле, не FK). Простіша міграція ніж Events.
  if (!localStorage.getItem('nm_notes_uuid_migrated_v11')) {
    try {
      const notesRaw = localStorage.getItem('nm_notes');
      if (notesRaw) {
        const backupKey = createSelectiveBackup(['nm_notes'], 'pre-note-uuid-v11');
        if (backupKey) console.log('[boot] v11 notes backup:', backupKey);

        const notes = JSON.parse(notesRaw);
        if (Array.isArray(notes)) {
          let migrated = 0;
          notes.forEach(n => {
            if (n && typeof n.id === 'number') {
              n.legacy_id = n.id;
              n.id = generateUUID();
              migrated++;
            }
          });
          if (migrated > 0) {
            localStorage.setItem('nm_notes', JSON.stringify(notes));
            console.log(`[boot] v11 migration: ${migrated} notes migrated to UUID`);
          }
        }
      }
      localStorage.setItem('nm_notes_uuid_migrated_v11', '1');
    } catch (e) {
      console.error('[boot] v11 notes migration failed:', e);
    }
  }

  // v12 Moments UUID (myshu 11.05.2026 Architecture Refactor Сесія 3B-4):
  // Moment.id був Date.now(). НЕМАЄ persistent cross-references.
  if (!localStorage.getItem('nm_moments_uuid_migrated_v12')) {
    try {
      const momentsRaw = localStorage.getItem('nm_moments');
      if (momentsRaw) {
        const backupKey = createSelectiveBackup(['nm_moments'], 'pre-moment-uuid-v12');
        if (backupKey) console.log('[boot] v12 moments backup:', backupKey);
        const moments = JSON.parse(momentsRaw);
        if (Array.isArray(moments)) {
          let migrated = 0;
          moments.forEach(m => {
            if (m && typeof m.id === 'number') {
              m.legacy_id = m.id;
              m.id = generateUUID();
              migrated++;
            }
          });
          if (migrated > 0) {
            localStorage.setItem('nm_moments', JSON.stringify(moments));
            console.log(`[boot] v12 migration: ${migrated} moments → UUID`);
          }
        }
      }
      localStorage.setItem('nm_moments_uuid_migrated_v12', '1');
    } catch (e) {
      console.error('[boot] v12 moments migration failed:', e);
    }
  }

  // v13 Finance txns UUID (myshu 11.05.2026 Architecture Refactor Сесія 3B-5):
  // Transaction.id був Date.now(). НЕМАЄ persistent cross-references
  // (inbox.id finance-card паралельна, без FK).
  if (!localStorage.getItem('nm_finance_uuid_migrated_v13')) {
    try {
      const finRaw = localStorage.getItem('nm_finance');
      if (finRaw) {
        const backupKey = createSelectiveBackup(['nm_finance'], 'pre-finance-uuid-v13');
        if (backupKey) console.log('[boot] v13 finance backup:', backupKey);
        const txs = JSON.parse(finRaw);
        if (Array.isArray(txs)) {
          let migrated = 0;
          txs.forEach(t => {
            if (t && typeof t.id === 'number') {
              t.legacy_id = t.id;
              t.id = generateUUID();
              migrated++;
            }
          });
          if (migrated > 0) {
            localStorage.setItem('nm_finance', JSON.stringify(txs));
            console.log(`[boot] v13 migration: ${migrated} transactions → UUID`);
          }
        }
      }
      localStorage.setItem('nm_finance_uuid_migrated_v13', '1');
    } catch (e) {
      console.error('[boot] v13 finance migration failed:', e);
    }
  }

  // v14 Projects UUID (myshu 11.05.2026 Architecture Refactor Сесія 3B-6):
  // Project.id був Date.now(). Nested steps/decisions/metrics/resources/risks
  // мають власні id — теж Date.now() з deduplication. ТIЛЬКИ top-level
  // project.id мігруємо. Sub-entities — окремо у майбутньому коли стане
  // блокером для Supabase (зараз не блокер).
  if (!localStorage.getItem('nm_projects_uuid_migrated_v14')) {
    try {
      const projRaw = localStorage.getItem('nm_projects');
      if (projRaw) {
        const backupKey = createSelectiveBackup(['nm_projects'], 'pre-project-uuid-v14');
        if (backupKey) console.log('[boot] v14 projects backup:', backupKey);
        const projects = JSON.parse(projRaw);
        if (Array.isArray(projects)) {
          let migrated = 0;
          projects.forEach(p => {
            if (p && typeof p.id === 'number') {
              p.legacy_id = p.id;
              p.id = generateUUID();
              migrated++;
            }
          });
          if (migrated > 0) {
            localStorage.setItem('nm_projects', JSON.stringify(projects));
            console.log(`[boot] v14 migration: ${migrated} projects → UUID`);
          }
        }
      }
      localStorage.setItem('nm_projects_uuid_migrated_v14', '1');
    } catch (e) {
      console.error('[boot] v14 projects migration failed:', e);
    }
  }

  // v15 Inbox cards UUID (myshu 11.05.2026 Architecture Refactor Сесія 3B-7):
  // InboxItem.id був Date.now(). FK cross-refs (eventId, reminderId) уже
  // мігровано у v10 і Сесії 3A. Тепер тільки top-level inbox.id.
  if (!localStorage.getItem('nm_inbox_uuid_migrated_v15')) {
    try {
      const inboxRaw = localStorage.getItem('nm_inbox');
      if (inboxRaw) {
        const backupKey = createSelectiveBackup(['nm_inbox'], 'pre-inbox-uuid-v15');
        if (backupKey) console.log('[boot] v15 inbox backup:', backupKey);
        const items = JSON.parse(inboxRaw);
        if (Array.isArray(items)) {
          let migrated = 0;
          items.forEach(it => {
            if (it && typeof it.id === 'number') {
              it.legacy_id = it.id;
              it.id = generateUUID();
              migrated++;
            }
          });
          if (migrated > 0) {
            localStorage.setItem('nm_inbox', JSON.stringify(items));
            console.log(`[boot] v15 migration: ${migrated} inbox cards → UUID`);
          }
        }
      }
      localStorage.setItem('nm_inbox_uuid_migrated_v15', '1');
    } catch (e) {
      console.error('[boot] v15 inbox migration failed:', e);
    }
  }

  // v16 Health UUID (db0YY 12.05.2026 Architecture Refactor Сесія 3B-8 — фінал UUID-блоку):
  //   - nm_health_cards[].id (top-level) + nested medications[].id
  //   - nm_allergies[].id (top-level, окреме сховище)
  //   - Cross-ref FORWARD: card.nextAppointment.eventId → nm_events[].id
  //       ETAP 1: events.find(e => e.legacy_id === oldId) — старі картки до v10
  //       ETAP 2: events.find(e => e.id === oldId) — нові події після v10 з
  //              Date.now() (Клас 2 баг myshu, тут мігруємо event + cross-ref)
  //   - Cross-ref REVERSE: nm_events[].sourceCardId (число → UUID) через cardIdMap
  //   - Cross-ref TASKS: nm_tasks[].sourceMedId (число → UUID) через medIdMap
  if (!localStorage.getItem('nm_health_uuid_migrated_v16')) {
    try {
      const cardsRaw = localStorage.getItem('nm_health_cards');
      const allergiesRaw = localStorage.getItem('nm_allergies');
      const eventsRaw = localStorage.getItem('nm_events');
      const tasksRaw = localStorage.getItem('nm_tasks');
      if (cardsRaw || allergiesRaw) {
        const backupKey = createSelectiveBackup(
          ['nm_health_cards', 'nm_allergies', 'nm_events', 'nm_tasks'],
          'pre-health-uuid-v16'
        );
        if (backupKey) console.log('[boot] v16 health backup:', backupKey);

        // Зведений medIdMap (oldNumeric → newUUID) для всіх медикаментів
        // у всіх картках. Потрібен для nm_tasks[].sourceMedId оновлення.
        const cardIdMap = {};
        const medIdMap = {};
        let events = null;
        if (eventsRaw) { try { events = JSON.parse(eventsRaw); } catch { events = null; } }

        // --- 1. Cards (top-level) + nested medications ---
        if (cardsRaw) {
          const cards = JSON.parse(cardsRaw);
          if (Array.isArray(cards)) {
            let migratedCards = 0;
            let migratedMeds = 0;
            cards.forEach(card => {
              if (card && typeof card.id === 'number') {
                const oldId = String(card.id);
                const newId = generateUUID();
                card.legacy_id = card.id;
                card.id = newId;
                cardIdMap[oldId] = newId;
                migratedCards++;
              }
              if (Array.isArray(card.medications)) {
                card.medications.forEach(med => {
                  if (med && typeof med.id === 'number') {
                    const oldMedId = String(med.id);
                    const newMedId = generateUUID();
                    med.legacy_id = med.id;
                    med.id = newMedId;
                    medIdMap[oldMedId] = newMedId;
                    migratedMeds++;
                  }
                });
              }
            });

            // --- 2. FORWARD cross-ref: card.nextAppointment.eventId → event UUID ---
            if (Array.isArray(events)) {
              let crossEtap1 = 0, crossEtap2 = 0, crossOrphan = 0;
              cards.forEach(card => {
                const appt = card.nextAppointment;
                if (!appt || typeof appt.eventId !== 'number') return;
                const oldEventId = appt.eventId;
                const legacyStr = String(oldEventId);
                // ETAP 1: подія була мігрована у v10 (має legacy_id)
                const byLegacy = events.find(e => e.legacy_id != null && String(e.legacy_id) === legacyStr);
                if (byLegacy) {
                  appt.eventId = byLegacy.id;
                  crossEtap1++;
                  return;
                }
                // ETAP 2: подія створена ПIСЛЯ v10 з Date.now() (Клас 2 myshu)
                // — досі число у nm_events. Мігруємо її ТУТ + оновлюємо cross-ref.
                const byCurrentId = events.find(e => e.id === oldEventId);
                if (byCurrentId) {
                  const newEventId = generateUUID();
                  byCurrentId.legacy_id = byCurrentId.id;
                  byCurrentId.id = newEventId;
                  appt.eventId = newEventId;
                  crossEtap2++;
                  return;
                }
                // Orphan — подія видалена з Календаря, лишаємо як є
                crossOrphan++;
              });
              if (crossEtap1 + crossEtap2 + crossOrphan > 0) {
                console.log(`[boot] v16 cross-ref forward: ${crossEtap1} via legacy + ${crossEtap2} new-migrated + ${crossOrphan} orphans`);
              }
            }

            // --- 3. REVERSE cross-ref: nm_events[].sourceCardId → UUID ---
            if (Array.isArray(events)) {
              let reverseUpdated = 0;
              events.forEach(ev => {
                if (ev && typeof ev.sourceCardId === 'number') {
                  const oldStr = String(ev.sourceCardId);
                  if (cardIdMap[oldStr]) {
                    ev.sourceCardId = cardIdMap[oldStr];
                    reverseUpdated++;
                  }
                }
              });
              if (reverseUpdated > 0) {
                console.log(`[boot] v16 cross-ref reverse: ${reverseUpdated} event.sourceCardId updated`);
              }
              // Зберегти events (могли змінитись через ETAP 2 + sourceCardId)
              localStorage.setItem('nm_events', JSON.stringify(events));
            }

            localStorage.setItem('nm_health_cards', JSON.stringify(cards));
            console.log(`[boot] v16 migration: ${migratedCards} cards, ${migratedMeds} medications → UUID`);
          }
        }

        // --- 4. Tasks cross-ref: sourceMedId число → UUID ---
        if (tasksRaw && Object.keys(medIdMap).length > 0) {
          try {
            const tasks = JSON.parse(tasksRaw);
            if (Array.isArray(tasks)) {
              let tasksUpdated = 0;
              tasks.forEach(task => {
                if (task && typeof task.sourceMedId === 'number') {
                  const oldStr = String(task.sourceMedId);
                  if (medIdMap[oldStr]) {
                    task.sourceMedId = medIdMap[oldStr];
                    tasksUpdated++;
                  }
                }
              });
              if (tasksUpdated > 0) {
                localStorage.setItem('nm_tasks', JSON.stringify(tasks));
                console.log(`[boot] v16 tasks cross-ref: ${tasksUpdated} task.sourceMedId updated`);
              }
            }
          } catch (taskErr) {
            console.error('[boot] v16 tasks cross-ref failed:', taskErr);
          }
        }

        // --- 5. Allergies (top-level, окреме сховище) ---
        if (allergiesRaw) {
          const allergies = JSON.parse(allergiesRaw);
          if (Array.isArray(allergies)) {
            let migratedAllergies = 0;
            allergies.forEach(a => {
              if (a && typeof a.id === 'number') {
                a.legacy_id = a.id;
                a.id = generateUUID();
                migratedAllergies++;
              }
            });
            if (migratedAllergies > 0) {
              localStorage.setItem('nm_allergies', JSON.stringify(allergies));
              console.log(`[boot] v16 migration: ${migratedAllergies} allergies → UUID`);
            }
          }
        }
      }
      localStorage.setItem('nm_health_uuid_migrated_v16', '1');
    } catch (e) {
      console.error('[boot] v16 health migration failed:', e);
    }
  }

  // v17 Sub-entity steps UUID (db0YY 12.05.2026 Architecture Refactor — фінал UUID-блоку,
  // sub-entity рівень):
  //   - nm_tasks[].steps[].id — Date.now() / Date.now()+Math.random() → UUID
  //   - nm_projects[].steps[].id — те саме
  // Без cross-ref — step.id ніде не зберігається як FK (sourceMedId був на med,
  // не на step). Закриває останній мікс типів — старі задачі/проекти зі step.id
  // числами + нові з UUID → handler-и через String() обгортки уже безпечні,
  // але краще мати чистий UUID-формат.
  if (!localStorage.getItem('nm_steps_uuid_migrated_v17')) {
    try {
      const tasksRaw = localStorage.getItem('nm_tasks');
      const projectsRaw = localStorage.getItem('nm_projects');
      if (tasksRaw || projectsRaw) {
        const backupKey = createSelectiveBackup(
          ['nm_tasks', 'nm_projects'],
          'pre-steps-uuid-v17'
        );
        if (backupKey) console.log('[boot] v17 steps backup:', backupKey);

        // --- 1. Tasks steps ---
        if (tasksRaw) {
          const tasks = JSON.parse(tasksRaw);
          if (Array.isArray(tasks)) {
            let migratedSteps = 0;
            tasks.forEach(task => {
              if (Array.isArray(task.steps)) {
                task.steps.forEach(step => {
                  if (step && typeof step.id === 'number') {
                    step.legacy_id = step.id;
                    step.id = generateUUID();
                    migratedSteps++;
                  }
                });
              }
            });
            if (migratedSteps > 0) {
              localStorage.setItem('nm_tasks', JSON.stringify(tasks));
              console.log(`[boot] v17 migration: ${migratedSteps} task.steps → UUID`);
            }
          }
        }

        // --- 2. Projects steps ---
        if (projectsRaw) {
          const projects = JSON.parse(projectsRaw);
          if (Array.isArray(projects)) {
            let migratedProjSteps = 0;
            projects.forEach(project => {
              if (Array.isArray(project.steps)) {
                project.steps.forEach(step => {
                  if (step && typeof step.id === 'number') {
                    step.legacy_id = step.id;
                    step.id = generateUUID();
                    migratedProjSteps++;
                  }
                });
              }
            });
            if (migratedProjSteps > 0) {
              localStorage.setItem('nm_projects', JSON.stringify(projects));
              console.log(`[boot] v17 migration: ${migratedProjSteps} project.steps → UUID`);
            }
          }
        }
      }
      localStorage.setItem('nm_steps_uuid_migrated_v17', '1');
    } catch (e) {
      console.error('[boot] v17 steps migration failed:', e);
    }
  }

  // v18 (JMQuT 17.05.2026 EU AI Act compliance — Health AI isolation):
  // Видаляє ключі чату Health (nm_chat_health + nm_health_interview_pending)
  // + видаляє факти з nm_facts де category='health' (PHI у AI-памʼяті).
  // UI-дані (nm_health_cards / nm_allergies) НЕ чіпаємо — юзер сам редагує.
  if (!localStorage.getItem('nm_health_ai_isolation_v18')) {
    try {
      let cleaned = 0;
      if (localStorage.getItem('nm_chat_health') !== null) {
        localStorage.removeItem('nm_chat_health'); cleaned++;
      }
      if (localStorage.getItem('nm_health_interview_pending') !== null) {
        localStorage.removeItem('nm_health_interview_pending'); cleaned++;
      }
      // Видалити health-факти з nm_facts
      const factsRaw = localStorage.getItem('nm_facts');
      if (factsRaw) {
        const facts = JSON.parse(factsRaw);
        if (Array.isArray(facts)) {
          const filtered = facts.filter(f => f && f.category !== 'health');
          if (filtered.length < facts.length) {
            localStorage.setItem('nm_facts', JSON.stringify(filtered));
            cleaned += (facts.length - filtered.length);
          }
        }
      }
      // Council JMQuT post-audit fix: видалити старі health tool_calls з історії всіх чатів.
      // Інакше AI бачить їх як приклади у промпті і може намагатись повторити (хоч guard блокує).
      const HEALTH_TOOL_NAMES = new Set([
        'create_health_card','edit_health_card','delete_health_card','update_health_card_status',
        'add_medication','edit_medication','delete_medication','log_medication_dose',
        'add_allergy','delete_allergy','add_health_history_entry','export_health_card'
      ]);
      const CHAT_KEYS_TO_FILTER = ['nm_chat_inbox','nm_chat_tasks','nm_chat_notes','nm_chat_me',
                                  'nm_chat_evening','nm_chat_finance','nm_chat_projects','nm_owl_chat'];
      for (const k of CHAT_KEYS_TO_FILTER) {
        const raw = localStorage.getItem(k);
        if (!raw) continue;
        try {
          const msgs = JSON.parse(raw);
          if (!Array.isArray(msgs)) continue;
          const filtered = msgs.filter(m => {
            if (!m) return false;
            // Видалити tool-result повідомлення з health tools
            if (m.role === 'tool' && m.name && HEALTH_TOOL_NAMES.has(m.name)) return false;
            // Видалити assistant tool_calls з health
            if (Array.isArray(m.tool_calls) && m.tool_calls.some(tc => HEALTH_TOOL_NAMES.has(tc?.function?.name))) {
              return false;
            }
            return true;
          });
          if (filtered.length < msgs.length) {
            localStorage.setItem(k, JSON.stringify(filtered));
            cleaned += (msgs.length - filtered.length);
          }
        } catch {}
      }
      localStorage.setItem('nm_health_ai_isolation_v18', '1');
      if (cleaned > 0) console.log(`[boot] v18 EU AI Act: видалено ${cleaned} health-AI ключів/фактів/tool_calls`);
    } catch (e) {
      console.error('[boot] v18 health AI isolation failed:', e);
    }
  }

  // v9 (03.05.2026 MIeXK Health AI-інтерв'ю): шкала статусів 3 → 6 значень.
  // Старе: active/controlled/done. Нове: acute/treatment/improving/remission/chronic/done.
  // Мапінг: active → treatment (нейтральне «активне лікування»), controlled → remission,
  // done → done. Інтерв'ю після створення картки уточнить точний статус.
  if (!localStorage.getItem('nm_health_status_v2_done')) {
    try {
      const raw = localStorage.getItem('nm_health_cards');
      if (raw) {
        const cards = JSON.parse(raw);
        if (Array.isArray(cards)) {
          const map = { active: 'treatment', controlled: 'remission', done: 'done' };
          let migrated = 0;
          cards.forEach(c => {
            if (map[c.status]) { c.status = map[c.status]; migrated++; }
          });
          if (migrated > 0) {
            localStorage.setItem('nm_health_cards', JSON.stringify(cards));
            console.log(`[boot] v9 migration: ${migrated} health cards migrated to 6-status scale`);
          }
        }
      }
      localStorage.setItem('nm_health_status_v2_done', '1');
    } catch (e) { console.error('[boot] v9 migration failed:', e); }
  }
  // v10 (04.05.2026 RGisY Шар 6 chip-system): chip.id (UUID) + payload externalization +
  // legacy ✔️-чіпи з action='chat' → action='complete'.
  // Бекап per-key (не один великий ключ — quota-safe для iPhone). Транзакційно.
  if (!localStorage.getItem('nm_chips_v10_done')) {
    try {
      const CHAT_KEYS = ['nm_chat_inbox','nm_chat_tasks','nm_chat_notes','nm_chat_me',
                         'nm_chat_evening','nm_chat_finance','nm_chat_health','nm_chat_projects'];
      let backupOk = true;
      CHAT_KEYS.forEach(k => {
        const raw = localStorage.getItem(k);
        if (raw) {
          try { localStorage.setItem(k + '_backup_v10', raw); }
          catch (e) { backupOk = false; }
        }
      });

      const payloadsMap = JSON.parse(localStorage.getItem('nm_chip_payloads') || '{}');
      let chipsTouched = 0, payloadsExtracted = 0, completionsRewired = 0;

      CHAT_KEYS.forEach(k => {
        const raw = localStorage.getItem(k);
        if (!raw) return;
        let msgs;
        try { msgs = JSON.parse(raw); } catch { return; }
        if (!Array.isArray(msgs)) return;
        let dirty = false;
        msgs.forEach(m => {
          if (!Array.isArray(m.chips) || m.chips.length === 0) return;
          m.chips.forEach(c => {
            if (typeof c !== 'object' || !c) return;
            if (!c.id) { c.id = generateUUID(); dirty = true; chipsTouched++; }
            if (c.payload && typeof c.payload === 'object') {
              payloadsMap[c.id] = c.payload;
              c.payloadId = c.id;
              delete c.payload;
              payloadsExtracted++;
              dirty = true;
            }
            if (c.action === 'chat' && typeof c.label === 'string' && c.label.includes('✔️')) {
              c.action = 'complete';
              completionsRewired++;
              dirty = true;
            }
          });
        });
        if (dirty) {
          try { localStorage.setItem(k, JSON.stringify(msgs)); }
          catch (e) { console.warn('[boot] v10: ' + k + ' write failed', e); }
        }
      });

      try { localStorage.setItem('nm_chip_payloads', JSON.stringify(payloadsMap)); }
      catch (e) { console.error('[boot] v10: nm_chip_payloads write failed', e); }

      localStorage.setItem('nm_chips_v10_done', '1');
      localStorage.setItem('nm_chips_v10_done_ts', String(Date.now()));
      console.log(`[boot] v10 migration: chips=${chipsTouched}, payloads=${payloadsExtracted}, completions=${completionsRewired}, backupOk=${backupOk}`);
    } catch (e) {
      console.error('[boot] v10 migration failed:', e);
      // Rollback з per-key бекапів
      ['nm_chat_inbox','nm_chat_tasks','nm_chat_notes','nm_chat_me',
       'nm_chat_evening','nm_chat_finance','nm_chat_health','nm_chat_projects'].forEach(k => {
        const b = localStorage.getItem(k + '_backup_v10');
        if (b) { try { localStorage.setItem(k, b); } catch {} }
      });
    }
  }
  // Phase 9 Шар 6 (RGisY 04.05) — Регресія 3 fix: cleanup v10 backups після 7 днів.
  // Раніше бекапи nm_chat_<tab>_backup_v10 жили вічно (8 ключів × ~5-200KB) →
  // QuotaExceededError на iPhone (lesson UvEHE 03.05 повторювався з v7). Тепер:
  // якщо v10 завершено успішно >7 днів тому — видаляємо бекапи разом з timestamp.
  const v10Done = localStorage.getItem('nm_chips_v10_done');
  let v10DoneTs = +(localStorage.getItem('nm_chips_v10_done_ts') || 0);
  // Phase 9 fallback: legacy юзери що мігрували між Phase 7 (f713667) і
  // Phase 9 (0e280ff) мають v10_done='1' БЕЗ ts. Запускаємо 7-денний таймер
  // зараз — інакше backup-ключі лишились би вічно для цього subset.
  if (v10Done === '1' && v10DoneTs === 0) {
    v10DoneTs = Date.now();
    try { localStorage.setItem('nm_chips_v10_done_ts', String(v10DoneTs)); } catch {}
  }
  if (v10Done === '1' && v10DoneTs > 0 && (Date.now() - v10DoneTs) > 7 * 24 * 60 * 60 * 1000) {
    try {
      ['nm_chat_inbox','nm_chat_tasks','nm_chat_notes','nm_chat_me',
       'nm_chat_evening','nm_chat_finance','nm_chat_health','nm_chat_projects'].forEach(k => {
        localStorage.removeItem(k + '_backup_v10');
      });
      localStorage.removeItem('nm_chips_v10_done_ts'); // одноразовий cleanup
      console.log('[boot] v10 backups cleanup: 8 ключів видалено (>7 днів старі)');
    } catch (e) { console.warn('[boot] v10 backups cleanup failed', e); }
  }
}

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

