// ============================================================
// app-ai-chat.js — 3-стейтний чат, OWL Board
// Залежності: app-core.js, app-ai-core.js
// ============================================================

import { currentTab, switchTab, showToast } from '../core/nav.js';
import { escapeHtml } from '../core/utils.js';
import { activeChatBar, callOwlChat, closeChatBar, lastChatClosedTs, openChatBar, restoreChatUI, setActiveChatBar } from '../ai/core.js';
import { _owlTabApplyState, _owlTabStates, renderTabBoard } from './board.js';
import { getTabMessages, saveTabMessage, replaceUnified, getUnifiedBoard, getCurrentMessage } from './unified-storage.js';
import { renderChips } from './chips.js';
import { addInboxChatMsg } from '../tabs/inbox.js';
import { getTasks, saveTasks, renderTasks } from '../tabs/tasks.js';
import { getHabits, getHabitLog, renderHabits, renderProdHabits, saveHabitLog } from '../tabs/habits.js';
import { renderNotes, addNoteFromInbox } from '../tabs/notes.js';
import { getFinance, saveFinance, renderFinance, formatMoney, getFinBudget, getFinCats, getFinPeriodRange, saveFinCats } from '../tabs/finance.js';

// === 3-СТЕЙТНА СИСТЕМА ЧАТУ ДЛЯ НЕ-INBOX ВКЛАДОК ===
// Стани: undefined/відсутній = closed | 'a' = compact open | 'b' = full expand
export const _tabChatState = {};

// Висота стану A: комфортна мала висота (без клавіатури – обмежена 320px; з клавіатурою – заповнює вільний простір)
export function _getTabChatAHeight(tab) {
  const bar = document.getElementById(tab + '-ai-bar');
  if (!bar) return 220;
  const inputBox = bar.querySelector('.ai-bar-input-box');
  const inputTop = inputBox ? inputBox.getBoundingClientRect().top : window.innerHeight - 100;
  const boardEl = document.getElementById('owl-tab-board-' + tab);
  const boardBottom = (boardEl && boardEl.getBoundingClientRect().bottom > 0)
    ? boardEl.getBoundingClientRect().bottom + 8
    : 80;
  const kbH = window.visualViewport
    ? Math.max(0, window.innerHeight - window.visualViewport.height) : 0;
  if (kbH > 250) {
    // Клавіатура активна: заповнюємо простір над нею
    return Math.max(150, inputTop - boardBottom - 8);
  }
  // Без клавіатури: компактна висота до 320px
  return Math.max(200, Math.min(320, inputTop - boardBottom - 8));
}

// Висота стану B: від шапки екрана до поля вводу (повний розгорт)
export function _getTabChatBHeight(tab) {
  const bar = document.getElementById(tab + '-ai-bar');
  if (!bar) return 400;
  const inputBox = bar.querySelector('.ai-bar-input-box');
  const inputTop = inputBox ? inputBox.getBoundingClientRect().top : window.innerHeight - 100;
  return Math.max(250, inputTop - 80 - 8);
}

// Відкрити чат у стані A БЕЗ клавіатури (жест свайп вгору від input)
function openChatBarNoKeyboard(tab) {
  if (_tabChatState[tab]) return; // вже відкрито
  // Закриваємо OWL чат якщо відкритий
  try { closeOwlChat(); } catch(e) {}
  // Закриваємо інші бари
  ['inbox','tasks','me','evening','finance','health','projects'].forEach(t => {
    if (t !== tab) closeChatBar(t);
  });
  setActiveChatBar(tab);
  const bar = document.getElementById(tab + '-ai-bar');
  if (!bar) return;
  restoreChatUI(tab);
  const chatWin = bar.querySelector('.ai-bar-chat-window');
  if (!chatWin) return;
  const h = _getTabChatAHeight(tab);
  chatWin.style.height = h + 'px';
  chatWin.style.maxHeight = h + 'px';
  chatWin.classList.add('open');
  _tabChatState[tab] = 'a';
}

// Свайп вниз по чат-вікну щоб закрити
export function setupChatBarSwipe() {
  ['inbox','tasks','notes','me','evening','finance','health','projects'].forEach(tab => {
    const bar = document.getElementById(tab + '-ai-bar');
    if (!bar) return;
    const chatWin = bar.querySelector('.ai-bar-chat-window');
    const messages = bar.querySelector('.ai-bar-messages');
    if (!chatWin) return;

    // --- Зона A: handle — свайп для згортання/розгортання ---
    // Зона B: messages — нативний скрол, без конфліктів (окремий DOM-елемент)
    const handleEl = chatWin.querySelector('.ai-bar-chat-handle');
    if (!handleEl) return;

    let winStartY = 0, winStartX = 0, winStartVpTop = 0, isDragging = false, startTime = 0;

    handleEl.addEventListener('touchstart', e => {
      winStartY = e.touches[0].clientY;
      winStartX = e.touches[0].clientX;
      winStartVpTop = window.visualViewport ? window.visualViewport.offsetTop : 0;
      startTime = Date.now();
      isDragging = false;
      chatWin.style.transition = 'none';
      chatWin.style.opacity = '1';
      // Фіксуємо поточну висоту як px (потрібно для анімації A↔B)
      if (_tabChatState[tab]) {
        chatWin.style.height = chatWin.offsetHeight + 'px';
      }
      chatWin.style.transform = 'translateY(0)';
    }, { passive: true });

    handleEl.addEventListener('touchmove', e => {
      e.preventDefault(); // handle — тільки свайп, ніякого page scroll
      const vpTop = window.visualViewport ? window.visualViewport.offsetTop : 0;
      const vpDelta = vpTop - winStartVpTop;
      const dy = (e.touches[0].clientY - winStartY) + vpDelta;
      const absDy = Math.abs(dy);
      const dx = Math.abs(e.touches[0].clientX - winStartX);
      const kbOff = !(window.visualViewport && (window.innerHeight - window.visualViewport.height) > 250);
      const state = _tabChatState[tab];

      if (state === 'b') {
        if (!isDragging) {
          if (absDy < 8) return;
          if (dx > absDy * 1.5) return;
          isDragging = true;
        }
        if (dy <= 0) { chatWin.style.transform = 'translateY(0)'; return; }
        chatWin.style.transform = `translateY(${Math.min(dy * 0.7, 140)}px)`;
        chatWin.style.opacity = Math.max(0.7, 1 - dy / 400).toFixed(2);
        return;
      }

      // Стан A: вгору → розгортаємо до B; вниз → закриваємо
      if (!isDragging) {
        if (absDy < 8) return;
        if (dx > absDy * 1.5) return;
        isDragging = true;
      }
      if (dy < 0 && kbOff) {
        const maxH = _getTabChatBHeight(tab);
        const startH = parseFloat(chatWin.style.height) || chatWin.offsetHeight;
        chatWin.style.height = Math.min(maxH, startH - dy) + 'px';
        chatWin.style.transform = 'translateY(0)';
        chatWin.style.opacity = '1';
        return;
      }
      if (dy > 0) {
        chatWin.style.transform = `translateY(${dy}px)`;
        chatWin.style.opacity = Math.max(0, 1 - dy / 280).toFixed(2);
      }
    }, { passive: false });

    const cancelHandler = () => {
      chatWin.style.transition = 'transform 0.28s cubic-bezier(0.32,0.72,0,1), opacity 0.2s ease';
      chatWin.style.transform = 'translateY(0)';
      chatWin.style.opacity = '1';
      setTimeout(() => { chatWin.style.transition = ''; chatWin.style.transform = ''; chatWin.style.opacity = ''; }, 280);
      isDragging = false;
    };
    handleEl.addEventListener('touchcancel', cancelHandler, { passive: true });

    handleEl.addEventListener('touchend', e => {
      const finalDy = e.changedTouches[0].clientY - winStartY;
      const elapsed = Date.now() - startTime;
      const velocity = finalDy / elapsed;
      isDragging = false;
      const kbOffEnd = !(window.visualViewport && (window.innerHeight - window.visualViewport.height) > 250);
      const stateEnd = _tabChatState[tab];

      if (stateEnd === 'b') {
        if (finalDy > 80 || velocity > 0.5) {
          // B → A
          const aH = _getTabChatAHeight(tab);
          _tabChatState[tab] = 'a';
          chatWin.style.transition = 'height 0.32s cubic-bezier(0.32,0.72,0,1), transform 0.28s cubic-bezier(0.32,0.72,0,1), opacity 0.25s ease';
          chatWin.style.height = aH + 'px';
          chatWin.style.maxHeight = aH + 'px';
          chatWin.style.transform = 'translateY(0)';
          chatWin.style.opacity = '1';
          setTimeout(() => chatWin.style.transition = '', 320);
        } else {
          // Пружина назад до B
          const bH = _getTabChatBHeight(tab);
          chatWin.style.transition = 'height 0.28s cubic-bezier(0.32,0.72,0,1), transform 0.28s cubic-bezier(0.32,0.72,0,1), opacity 0.25s ease';
          chatWin.style.height = bH + 'px';
          chatWin.style.transform = 'translateY(0)';
          chatWin.style.opacity = '1';
          setTimeout(() => chatWin.style.transition = '', 280);
        }
        return;
      }

      // Стан A
      if (finalDy < -40 && kbOffEnd) {
        // A → B
        const bH = _getTabChatBHeight(tab);
        _tabChatState[tab] = 'b';
        chatWin.style.transition = 'height 0.38s cubic-bezier(0.3,0.82,0,1)';
        chatWin.style.height = bH + 'px';
        chatWin.style.maxHeight = bH + 'px';
        chatWin.style.transform = '';
        chatWin.style.opacity = '1';
        const msgs = chatWin.querySelector('.ai-bar-messages');
        if (msgs) setTimeout(() => msgs.scrollTop = msgs.scrollHeight, 380);
        setTimeout(() => chatWin.style.transition = '', 380);
      } else if (finalDy > 80 || velocity > 0.5) {
        // A → закрити
        chatWin.style.transition = 'transform 0.28s cubic-bezier(0.32,0.72,0,1), opacity 0.25s ease';
        chatWin.style.transform = 'translateY(110%)';
        chatWin.style.opacity = '0';
        setTimeout(() => {
          closeChatBar(tab);
          chatWin.style.transition = '';
          chatWin.style.transform = '';
          chatWin.style.opacity = '';
        }, 280);
      } else {
        // Пружина назад до A
        const aH = _getTabChatAHeight(tab);
        chatWin.style.transition = 'height 0.28s cubic-bezier(0.32,0.72,0,1), transform 0.28s cubic-bezier(0.32,0.72,0,1), opacity 0.25s ease';
        chatWin.style.height = aH + 'px';
        chatWin.style.transform = 'translateY(0)';
        chatWin.style.opacity = '1';
        setTimeout(() => chatWin.style.transition = '', 280);
      }
    }, { passive: true });

    // Блокуємо тільки небажаний scroll по решті бару (не messages, не textarea)
    bar.addEventListener('touchmove', e => {
      if (messages && messages.contains(e.target)) return;
      const textarea = bar.querySelector('textarea');
      if (textarea && textarea.contains(e.target)) return;
      e.preventDefault();
    }, { passive: false });

    // --- Свайп ВГОРУ від поля вводу → відкрити чат без клавіатури ---
    const inputBox = bar.querySelector('.ai-bar-input-box');
    if (inputBox) {
      let _inStartY = 0, _inSwiping = false;
      inputBox.addEventListener('touchstart', e => {
        _inStartY = e.touches[0].clientY;
        _inSwiping = false;
      }, { passive: true });
      inputBox.addEventListener('touchmove', e => {
        if (_tabChatState[tab]) return; // чат вже відкритий
        const dy = _inStartY - e.touches[0].clientY; // positive = вгору
        if (dy > 20) {
          _inSwiping = true;
          e.preventDefault(); // блокуємо textarea focus через scroll
        }
      }, { passive: false });
      inputBox.addEventListener('touchend', e => {
        if (_inSwiping) {
          _inSwiping = false;
          e.preventDefault(); // блокуємо tap → onfocus → клавіатура
          openChatBarNoKeyboard(tab);
        }
      }, { passive: false });
    }
  });

  // --- Тап поза вікном → закрити (але НЕ свайп) ---
  let docTouchStartY = 0, docTouchStartX = 0;
  document.addEventListener('touchstart', e => {
    docTouchStartY = e.touches[0].clientY;
    docTouchStartX = e.touches[0].clientX;
  }, { passive: true });

  document.addEventListener('touchend', e => {
    if (!activeChatBar) return;
    const bar = document.getElementById(activeChatBar + '-ai-bar');
    if (!bar) return;
    // Якщо дотик всередині бару — нічого (поле, вікно, кнопки)
    if (bar.contains(e.target)) return;
    // Якщо дотик по таббару — нічого
    const tabBar = document.getElementById('tab-bar');
    if (tabBar && tabBar.contains(e.target)) return;
    // Вимірюємо відстань — якщо це свайп (> 10px) → НЕ закриваємо
    const dy = Math.abs(e.changedTouches[0].clientY - docTouchStartY);
    const dx = Math.abs(e.changedTouches[0].clientX - docTouchStartX);
    if (dy > 10 || dx > 10) return; // це скрол карток — не заважаємо
    // Це тап → закриваємо чат (текст у полі НЕ очищуємо)
    closeChatBar(activeChatBar);
  }, { passive: true });
}


// === OWL BOARD ===
const OWL_BOARD_SEEN_KEY = 'nm_owl_board_seen'; // які ID вже показано
const OWL_BOARD_TS_KEY = 'nm_owl_board_ts'; // timestamp останньої генерації (inbox-specific)
const OWL_BOARD_INTERVAL = 10 * 60 * 1000; // 10 хв — fallback, основні тригери через події

let _owlBoardMessages = [];
// _owlBoardGenerating видалено — guard тепер у generateBoardMessage (proactive.js)
let _owlBoardTimer = null;

// Обгортка над unified storage — повертає повідомлення згенеровані для Inbox.
// Для рендеру на табло використовуй getCurrentMessage() — воно ЄДИНЕ на всі вкладки
// (Шар 2 "Один мозок V2", 21.04 rJYkw).
export function getOwlBoardMessages() {
  return getTabMessages('inbox');
}
// Backward compat: старі виклики передавали обрізаний масив як "нове сховище".
// Тепер записуємо тільки найсвіжіше (перше) у unified — історія вкладки сама
// накопичується через getTabMessages. Якщо потрібна повна заміна — окрема функція.
export function saveOwlBoardMessages(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return;
  // Найновіше повідомлення — arr[0] (масив відсортований новіші → старіші)
  const latest = arr[0];
  if (!latest || !latest.text) return;
  // Перевірка — чи це вже у сховищі (не плодити дубль при fallback-ретраях)
  const existing = getTabMessages('inbox')[0];
  if (existing && existing.ts === latest.ts && existing.text === latest.text) return;
  saveTabMessage('inbox', latest);
}

// Інвалідація застарілих повідомлень табло з іншого дня.
// Причина: AI пише природно ("завтра", "вчора") — ці слова стають неправдою коли день змінився,
// а кеш табло живе у localStorage без прив'язки до дати. Запускається на старті застосунку.
// Шар 2 (rJYkw 21.04): сховище єдине — перевіряємо тільки msgs[0] (те що видно юзеру).
export function clearStaleBoards() {
  try {
    const today = new Date().toDateString();
    const isStale = (msg) => {
      if (!msg) return false;
      const ts = msg.ts || msg.id;
      if (!ts) return false;
      return new Date(ts).toDateString() !== today;
    };

    const all = getUnifiedBoard();
    if (all.length > 0 && isStale(all[0])) {
      // Видаляємо тільки найсвіжіше зі старого дня — історія лишається
      replaceUnified(all.slice(1));
      localStorage.setItem(OWL_BOARD_TS_KEY, '0');
      // Тab TS keys теж скидаємо щоб Judge Layer знав що новий день
      ['tasks','notes','me','evening','finance','health','projects'].forEach(tab => {
        localStorage.setItem('nm_owl_tab_ts_' + tab, '0');
      });
    }
  } catch(e) {}
}

// === OWL BOARD — повний розумний цикл ===

// === РОЗКЛАД ДНЯ ===
export function getSchedule() {
  const s = JSON.parse(localStorage.getItem('nm_settings') || '{}');
  const sc = s.schedule || {};
  const parseH = (str, def) => {
    if (!str) return def;
    const h = parseInt(str.split(':')[0]);
    return isNaN(h) ? def : h;
  };
  const pickStr = (str, def) => (str && /^\d{1,2}:\d{2}$/.test(str)) ? str : def;
  return {
    wakeUp:    parseH(sc.wakeUp,    7),
    workStart: parseH(sc.workStart, 9),
    workEnd:   parseH(sc.workEnd,   18),
    bedTime:   parseH(sc.bedTime,   23),
    wakeUpStr:    pickStr(sc.wakeUp,    '07:00'),
    workStartStr: pickStr(sc.workStart, '09:00'),
    workEndStr:   pickStr(sc.workEnd,   '18:00'),
    bedTimeStr:   pickStr(sc.bedTime,   '23:00'),
  };
}

// Фази: 'silent' | 'dawn' | 'morning' | 'work' | 'evening' | 'night'
export function getDayPhase() {
  const sc = getSchedule();
  const h = new Date().getHours();
  if (h >= sc.bedTime || h < sc.wakeUp - 2) return 'silent';
  if (h < sc.wakeUp)                         return 'dawn';
  if (h < sc.workStart)                      return 'morning';
  if (h < sc.workEnd)                        return 'work';
  if (h < sc.bedTime - 1)                    return 'evening';
  return 'night';
}

// === COOLDOWN-система (замінює owlAlreadySaid) ===
// nm_owl_cooldowns = { topicKey: lastFiredTimestamp }
const OWL_CD_KEY = 'nm_owl_cooldowns';

function _getOwlCooldowns() {
  try { return JSON.parse(localStorage.getItem(OWL_CD_KEY) || '{}'); } catch { return {}; }
}
export function owlCdExpired(topic, ms) {
  const cd = _getOwlCooldowns();
  return !cd[topic] || (Date.now() - cd[topic]) > ms;
}
export function setOwlCd(topic) {
  const cd = _getOwlCooldowns();
  cd[topic] = Date.now();
  // Чистимо записи старші 48 год
  const cutoff = Date.now() - 48 * 60 * 60 * 1000;
  Object.keys(cd).forEach(k => { if (cd[k] < cutoff) delete cd[k]; });
  localStorage.setItem(OWL_CD_KEY, JSON.stringify(cd));
}

// ============================================================
// JUDGE LAYER — shouldOwlSpeak()
// Єдиний шар що вирішує "чи є що сказати".
// Повертає { speak: bool, score: number, reason: string }
// Замінює старий checkOwlBoardTrigger() з cooldowns.
//
// ОНОВЛЕНО 11.04 (Крок 1 уніфікації):
// Тепер обслуговує ДВА канали через параметр opts.channel:
//   • 'board' (default) — проактивні повідомлення на табло (inbox + вкладки)
//   • 'chat-followup'   — follow-up у контекстний чат вкладки (stuck-task,
//                         event-passed — живуть у src/owl/followups.js)
// Раніше followups.js мав власні hard-блокери (silent, global-cd, api-key,
// activeChatBar) які дублювали Judge Layer. Тепер — один суддя на все.
// ============================================================
const SPEAK_THRESHOLD = 3;
const FOLLOWUP_GLOBAL_CD_MS = 60 * 60 * 1000; // 1 год — антиспам follow-ups
const CHAT_CLOSE_COOLDOWN_MS = 10 * 1000; // 4.5 — 10 сек тиші після закриття чату

// Головна точка входу. opts: { channel?: 'board'|'chat-followup', targetTab?: string }
// Backward compat: виклики без opts продовжують працювати як board-channel.
export function shouldOwlSpeak(trigger, opts = {}) {
  // === СПІЛЬНІ HARD-БЛОКЕРИ (однакові для обох каналів) ===
  const key = localStorage.getItem('nm_gemini_key');
  if (!key) return { speak: false, score: -1, reason: 'no-api-key' };

  const phase = getDayPhase();
  if (phase === 'silent') return { speak: false, score: -100, reason: 'silent-phase' };

  // Тиша (Фаза 1 OWL Silence Engine UVKL1) — блокує всі 4 канали сови.
  // Ключ nm_owl_silence_until заповнюється або auto-silence (proactive.js: 7 ігнорів → 4 год),
  // або explicit-silence через AI tool request_quiet (юзер: «дай спокій до вечора»).
  try {
    const silenceUntil = parseInt(localStorage.getItem('nm_owl_silence_until') || '0');
    if (silenceUntil > Date.now()) {
      return { speak: false, score: -100, reason: 'silence' };
    }
  } catch (e) {}

  // === РОУТИНГ ЗА КАНАЛОМ ===
  const channel = opts.channel || 'board';
  if (channel === 'chat-followup') {
    return _judgeFollowup(trigger, opts.targetTab);
  }
  return _judgeBoard(trigger, opts.targetTab);
}

// ============================================================
// Канал 'chat-followup' — follow-up у контекстний чат вкладки
// Тригери: 'stuck-task', 'event-passed' (детекція у followups.js)
// ============================================================
function _judgeFollowup(trigger, targetTab) {
  // Не перебивати юзера коли він сидить у цьому ж чаті
  if (activeChatBar && activeChatBar === targetTab) {
    return { speak: false, score: -100, reason: 'active-in-target-chat' };
  }
  // Глобальний антиспам follow-ups — не більше одного на годину
  if (!owlCdExpired('followup_global', FOLLOWUP_GLOBAL_CD_MS)) {
    return { speak: false, score: -100, reason: 'followup-global-cd' };
  }
  // Базове нарахування очок — follow-up тригери мають високий пріоритет
  // (юзер сам створив контекст: задача висить / подія минула)
  let score = 0;
  const reasons = [];
  if (trigger === 'stuck-task')   { score += 5; reasons.push('stuck-task'); }
  if (trigger === 'event-passed') { score += 5; reasons.push('event-passed'); }
  // майбутні канальні тригери (welcome-back-in-chat, after-action) додавати тут
  const speak = score >= SPEAK_THRESHOLD;
  return { speak, score, reason: reasons.join(', ') };
}

// ============================================================
// Канал 'board' — проактивні повідомлення на табло
// Існуюча логіка 08.04 (Judge Layer) — без змін, тільки винесена у приватну функцію.
// ============================================================
function _judgeBoard(trigger, targetTab) {
  // trigger: 'timer' | 'data-changed' | 'welcome-back' | 'new-day' | 'first-time' | 'chat-closed' | 'tab-switched'
  // targetTab: поточна вкладка (для tab-specific boosting тригерів, Шар 2 Фаза 4)

  // Чек тиші винесено вище у shouldOwlSpeak() — щоб блокувати обидва канали
  // (board + chat-followup) одним рядком (Фаза 1 OWL Silence Engine UVKL1).

  let score = 0;
  let reasons = [];

  const now = new Date();
  const todayStr = now.toDateString();
  const hour = now.getHours();
  const min = now.getMinutes();
  // Фаза дня потрібна для тригерів streak/morning/evening/week — була у старій
  // shouldOwlSpeak(), при рефакторингу Крок 1 лишилась у роутері і тут губилась.
  // Регресія: ReferenceError: phase is not defined. Фікс 11.04 — повертаємо.
  const phase = getDayPhase();

  // === ТАЙМЕРИ ===
  const lastAttemptTs = parseInt(localStorage.getItem(OWL_BOARD_TS_KEY) || '0');
  const sinceLastAttempt = Date.now() - lastAttemptTs;
  const msgs = getOwlBoardMessages();
  const lastVisibleTs = msgs[0]?.ts || msgs[0]?.id || 0;
  const sinceLastVisible = Date.now() - lastVisibleTs;

  // === ТРИГЕРИ (плюс) — рахуємо ПЕРЕД блокерами щоб знати чи є критичне ===

  // Перший раз / новий день
  if (trigger === 'first-time' || trigger === 'new-day') {
    score += 5;
    reasons.push(trigger);
  }

  // Повернувся після довгої відсутності
  if (trigger === 'welcome-back') {
    score += 4;
    reasons.push('welcome-back');
  }

  // Перший раз відкрив сьогодні (Smart Boot-up 3.6) — високий пріоритет
  if (trigger === 'first-open-today') {
    score += 5;
    reasons.push('first-open-today');
  }

  // Дані змінились (закрив задачу, відмітив звичку)
  if (trigger === 'data-changed') {
    score += 3;
    reasons.push('data-changed');
  }

  // Закриття чату — час оновити табло
  if (trigger === 'chat-closed') {
    score += 4;
    reasons.push('chat-closed');
  }

  // Шар 2 "Один мозок V2" Фаза 2 (rJYkw 21.04.2026):
  // Перехід між вкладками — невеликий бонус (+1). НЕ гарантовано тригерить
  // генерацію сам по собі — тільки у поєднанні з іншими скорами (stale, data-changed).
  // Тобто юзер гортає вкладки → судить набирається тихо, спрацьовує коли є що сказати.
  if (trigger === 'tab-switched') {
    score += 1;
    reasons.push('tab-switched');
  }

  // Нагадування що настали — КРИТИЧНЕ
  let hasCritical = false;
  try {
    const reminders = JSON.parse(localStorage.getItem('nm_reminders') || '[]');
    const todayISO = now.toISOString().slice(0, 10);
    const nowTime = `${String(hour).padStart(2,'0')}:${String(min).padStart(2,'0')}`;
    const due = reminders.filter(r => !r.done && r.date === todayISO && r.time <= nowTime);
    if (due.length > 0) {
      score += 5;
      reasons.push('reminder-due');
      hasCritical = true;
    }
  } catch(e) {}

  // Дедлайн через ~годину — КРИТИЧНЕ
  const tasks = getTasks().filter(t => t.status !== 'done');
  for (const t of tasks) {
    const m = t.title.match(/(\d{1,2}):(\d{2})/);
    if (m) {
      const diff = (parseInt(m[1]) * 60 + parseInt(m[2])) - (hour * 60 + min);
      if (diff > 0 && diff <= 65) {
        score += 3;
        reasons.push('deadline-soon');
        hasCritical = true;
        break;
      }
    }
  }
  // Дедлайн сьогодні (dueDate)
  const todayISO = now.toISOString().slice(0, 10);
  if (tasks.some(t => t.dueDate === todayISO)) {
    score += 2;
    reasons.push('due-today');
  }

  // === БЛОКЕРИ (мінус) — ПІСЛЯ тригерів ===

  // 4.5 (ROADMAP Блок 1) — Жорсткий блок поки чат відкритий + 10 сек після.
  // Прибирає дратівне "ти пишеш у чаті — і раптом OWL перезаписує табло над чатом".
  // Винятки (пробивають блок):
  //   - hasCritical: нагадування що настало зараз, або дедлайн < 65 хв
  //   - trigger === 'chat-closed': навмисне пробудження табло після закриття чату
  //     (цей тригер приходить через 3 сек з nm-chat-closed — ROADMAP каже +10 сек,
  //      тому все одно перевіряємо cooldown нижче)
  if (!hasCritical && trigger !== 'chat-closed') {
    if (activeChatBar) {
      return { speak: false, score: -100, reason: 'chat-open-block' };
    }
    if (lastChatClosedTs && (Date.now() - lastChatClosedTs) < CHAT_CLOSE_COOLDOWN_MS) {
      return { speak: false, score: -100, reason: 'chat-just-closed-cooldown' };
    }
  } else if (activeChatBar && hasCritical) {
    reasons.push('chat-open(critical-override)');
  }

  // Штраф за нещодавню генерацію
  if (trigger !== 'chat-closed') {
    if (sinceLastAttempt < 5 * 60 * 1000) {
      score -= 4;
      reasons.push('attempt<5m');
    } else if (sinceLastAttempt < 15 * 60 * 1000) {
      score -= 1;
      reasons.push('attempt<15m');
    }
  }

  // Стрік під загрозою ввечері
  if (phase === 'evening' || phase === 'night') {
    const habits = getHabits();
    const log = getHabitLog();
    const todayLog = log[todayStr] || {};
    const atRisk = habits.filter(h => h.days?.includes(now.getDay()) && !todayLog[h.id]);
    if (atRisk.length > 0) {
      score += 3;
      reasons.push('streak-risk');
    }
  }

  // Ранковий брифінг (ще не було сьогодні)
  if ((phase === 'morning' || phase === 'dawn') && owlCdExpired('morning_brief', 3 * 60 * 60 * 1000)) {
    score += 3;
    reasons.push('morning-brief');
  }

  // Бюджет 80%+
  try {
    const budget = getFinBudget();
    if (budget.total > 0) {
      const from = getFinPeriodRange('month');
      const exp = getFinance().filter(t => t.ts >= from && t.type === 'expense').reduce((s, t) => s + t.amount, 0);
      if (exp / budget.total >= 0.8) {
        score += 2;
        reasons.push('budget-warn');
      }
    }
  } catch (e) {}

  // Вечір без підсумку
  if (phase === 'evening' || phase === 'night') {
    const s = JSON.parse(localStorage.getItem('nm_evening_summary') || 'null');
    if (!s || new Date(s.date).toDateString() !== todayStr) {
      score += 2;
      reasons.push('no-evening-summary');
    }
  }

  // Задачі застрягли 3+ дні
  const stuck = tasks.filter(t => t.createdAt && t.createdAt < Date.now() - 3 * 24 * 60 * 60 * 1000);
  if (stuck.length > 0) {
    score += 1;
    reasons.push('stuck-tasks');
  }

  // Понеділок — огляд тижня
  if (now.getDay() === 1 && (phase === 'morning' || phase === 'work') && owlCdExpired('week_start', 6 * 60 * 60 * 1000)) {
    score += 2;
    reasons.push('week-start');
  }
  // П'ятниця — підсумок тижня
  if (now.getDay() === 5 && phase === 'evening' && owlCdExpired('week_end', 6 * 60 * 60 * 1000)) {
    score += 2;
    reasons.push('week-end');
  }

  // === TAB-SPECIFIC BOOSTING (Шар 2 Фаза 4, rJYkw 21.04.2026) ===
  // Тригери отримують додатковий скор залежно від активної вкладки:
  //  • На Здоровʼї ввечері — звички під загрозою критичніші.
  //  • На Фінансах наприкінці місяця — бюджет-попередження важливіші.
  //  • На Я в понеділок вранці — огляд тижня у пріоритеті.
  //  • На Проектах під час робочого дня — застряглі задачі критичніші.
  //  • На Вечорі після заходу сонця — відсутність підсумку критичніша.
  if (targetTab) {
    if (targetTab === 'health' && (phase === 'evening' || phase === 'night')) {
      if (reasons.includes('streak-risk')) { score += 2; reasons.push('health-evening-boost'); }
    }
    if (targetTab === 'finance' && now.getDate() >= 25) {
      if (reasons.includes('budget-warn')) { score += 2; reasons.push('finance-monthend-boost'); }
    }
    if (targetTab === 'me' && now.getDay() === 1 && phase === 'morning') {
      if (reasons.includes('week-start')) { score += 2; reasons.push('me-monday-boost'); }
    }
    if (targetTab === 'projects' && phase === 'work') {
      if (reasons.includes('stuck-tasks')) { score += 2; reasons.push('projects-work-boost'); }
    }
    if (targetTab === 'evening' && (phase === 'evening' || phase === 'night')) {
      if (reasons.includes('no-evening-summary')) { score += 2; reasons.push('evening-dusk-boost'); }
    }
  }

  // Як довго юзер бачить ТЕ САМЕ повідомлення — градуйований бонус.
  // Використовує вік ВИДИМОГО повідомлення, не час останньої спроби генерації.
  // Шар 2 Фаза 2: додано stale>10m (+1) — плавніша градація щоб tab-switched
  // природно спрацьовував на злегка застарілому табло без спаму.
  if (sinceLastVisible > 60 * 60 * 1000) {
    score += 3;
    reasons.push('stale>60m');
  } else if (sinceLastVisible > 30 * 60 * 1000) {
    score += 2;
    reasons.push('stale>30m');
  } else if (sinceLastVisible > 10 * 60 * 1000) {
    score += 1;
    reasons.push('stale>10m');
  }

  const speak = score >= SPEAK_THRESHOLD;
  return { speak, score, reason: reasons.join(', ') };
}

// getOwlBoardContext перенесено у src/owl/proactive.js як _getInboxBoardContext (Фаза 1.1, 12.04).
// generateOwlBoardMessage видалено — замінено на єдину generateBoardMessage('inbox') у proactive.js

// === OWL MINI-CHAT STATE ===
const OWL_CHAT_KEY = 'nm_owl_chat'; // [{role,text,ts}]
const OWL_CHAT_MAX = 20;
let _owlChatOpen = false;
let _owlChatSending = false;

function getOwlChatHistory() {
  try { return JSON.parse(localStorage.getItem(OWL_CHAT_KEY) || '[]'); } catch { return []; }
}
function saveOwlChatMsg(role, text) {
  const msgs = getOwlChatHistory();
  msgs.push({ role, text, ts: Date.now() });
  if (msgs.length > OWL_CHAT_MAX) msgs.splice(0, msgs.length - OWL_CHAT_MAX);
  localStorage.setItem(OWL_CHAT_KEY, JSON.stringify(msgs));
}

// 3 стани OWL — тепер alias до _owlTabStates['inbox']
let _owlState = 'speech';
function _getOwlState() { return _owlTabStates['inbox'] || _owlState || 'speech'; }

function _owlSetState(state) {
  _owlState = state;
  _owlTabStates['inbox'] = state;
  _owlTabApplyState('inbox');
  _owlChatOpen = (state === 'expanded');
}

// Рендер OWL Board — делегує в уніфікований renderTabBoard('inbox')
export function renderOwlBoard() {
  _owlBoardMessages = getOwlBoardMessages();
  renderTabBoard('inbox');
}

// Розгорнути чат — тепер відкриває чат-бар знизу (табло read-only)
function expandOwlChat() {
  openChatBar('inbox');
}

// Згорнути → speech
function collapseOwlToSpeech() {
  _owlSetState('speech');
}

// Toggle: collapsed ↔ speech (expanded прибрано)
function toggleOwlChat() {
  if (_getOwlState() === 'collapsed') {
    _owlSetState('speech');
  } else {
    _owlSetState('collapsed');
  }
}

// Закрити OWL чат ззовні (з inbox chat)
export function closeOwlChat() {
  if (_getOwlState() === 'expanded') {
    _owlSetState('speech');
  }
}

// Рендер повідомлень чату
function renderOwlChatMessages() {
  const el = document.getElementById('owl-tab-msgs-inbox');
  if (!el) return;

  // Збираємо: останні board-повідомлення (як agent) + owl_chat історія
  const chatHistory = getOwlChatHistory();
  const boardMsgs = getOwlBoardMessages();

  // Якщо чат порожній — показуємо останнє board повідомлення як початок
  if (chatHistory.length === 0 && boardMsgs.length > 0) {
    el.innerHTML = `<div class="owl-msg-agent">${escapeHtml(boardMsgs[0].text)}</div>`;
    return;
  }

  // Показуємо chat history
  let html = '';
  // Спочатку останнє board повідомлення як контекст (якщо його немає в чаті)
  if (boardMsgs.length > 0) {
    const lastBoardText = boardMsgs[0].text;
    const firstChatIsBoard = chatHistory.length > 0 && chatHistory[0].role === 'agent' && chatHistory[0].text === lastBoardText;
    if (!firstChatIsBoard) {
      html += `<div class="owl-msg-agent">${escapeHtml(lastBoardText)}</div>`;
    }
  }
  chatHistory.forEach(m => {
    const cls = m.role === 'user' ? 'owl-msg-user' : 'owl-msg-agent';
    html += `<div class="${cls}">${escapeHtml(m.text)}</div>`;
  });
  el.innerHTML = html;
  el.scrollTop = el.scrollHeight;
}

// Рендер чіпів (через централізований renderChips з chips.js)
function renderOwlChips(boardMsg) {
  const el = document.getElementById('owl-tab-exp-chips-inbox');
  if (!el) return;
  if (!boardMsg || !boardMsg.chips || boardMsg.chips.length === 0) {
    el.innerHTML = '';
    return;
  }
  const VALID = ['tasks','notes','habits','finance','health','projects','evening','me','inbox'];
  renderChips(el, boardMsg.chips, 'inbox', {
    onChipClick: (text, action, target) => {
      // Навігаційні чіпи — переключити вкладку
      if (action === 'nav' && VALID.includes(target)) {
        switchTab(target);
        showToast('Переходжу до вкладки');
        return;
      }
      // Чат-чіпи — через OWL міні-чат (sendOwlReply), а не через inbox sendToAI
      sendOwlReply(text);
    }
  });
}

// Typing індикатор
function showOwlTyping(show) {
  const el = document.getElementById('owl-tab-msgs-inbox');
  if (!el) return;
  const existing = el.querySelector('.owl-typing-wrap');
  if (existing) existing.remove();
  if (show) {
    const div = document.createElement('div');
    div.className = 'owl-msg-agent owl-typing-wrap';
    div.innerHTML = '<div class="owl-typing"><span></span><span></span><span></span></div>';
    el.appendChild(div);
    el.scrollTop = el.scrollHeight;
  }
  const inp = document.getElementById('owl-tab-input-inbox');
  if (inp) inp.disabled = show;
}

// Зелений банер підтвердження
function showOwlConfirm(text) {
  const el = document.getElementById('owl-tab-msgs-inbox');
  if (!el) return;
  const banner = document.createElement('div');
  banner.className = 'owl-confirm-banner';
  banner.textContent = text;
  el.appendChild(banner);
  el.scrollTop = el.scrollHeight;
  setTimeout(() => banner.remove(), 2500);
}

// Відправка відповіді (від чіпа або input)
export async function sendOwlReply(text) {
  if (!text || _owlChatSending) return;
  _owlChatSending = true;

  // Автоматично відкриваємо чат якщо не expanded
  if (_getOwlState() !== 'expanded') expandOwlChat();

  // Додаємо повідомлення юзера
  saveOwlChatMsg('user', text);
  renderOwlChatMessages();

  // Показуємо typing
  showOwlTyping(true);

  const chipsEl = document.getElementById('owl-tab-exp-chips-inbox');
  if (chipsEl) chipsEl.innerHTML = '';

  try {
    const reply = await callOwlChat(text);
    showOwlTyping(false);

    if (reply) {
      let replyText = reply;
      let action = null;
      try {
        const parsed = JSON.parse(reply.replace(/```json|```/g, '').trim());
        if (parsed.text) replyText = parsed.text;
        if (parsed.action) action = parsed.action;
        if (parsed.chips) {
          renderOwlChips({ chips: parsed.chips });
        }
      } catch(e) {}

      saveOwlChatMsg('agent', replyText);
      renderOwlChatMessages();

      if (action) {
        executeOwlAction(action, text);
      }
    }
  } catch(e) {
    showOwlTyping(false);
  }

  _owlChatSending = false;
}

// Виконання дій з OWL чату (ті самі що в Inbox, але без запису в inbox chat)
function executeOwlAction(action, originalText) {
  if (!action || !action.action) return;
  const act = action.action;

  if (act === 'complete_habit') {
    const ids = action.habit_ids || (action.habit_id ? [action.habit_id] : []);
    if (ids.length === 0) return;
    const habits = getHabits();
    const today = new Date().toDateString();
    const log = getHabitLog();
    if (!log[today]) log[today] = {};
    let done = 0;
    ids.forEach(hid => {
      const h = habits.find(x => x.id === hid);
      if (h) { log[today][h.id] = true; done++; }
    });
    if (done > 0) {
      saveHabitLog(log);
      renderProdHabits();
      renderHabits();
      showOwlConfirm('Звичку зараховано ✓');
    }
    return;
  }

  if (act === 'complete_task') {
    const ids = action.task_ids || (action.task_id ? [action.task_id] : []);
    if (ids.length === 0) return;
    const tasks = getTasks();
    let done = 0;
    ids.forEach(tid => {
      const idx = tasks.findIndex(t => t.id === tid);
      if (idx !== -1) { tasks[idx] = { ...tasks[idx], status: 'done', completedAt: Date.now() }; done++; }
    });
    if (done > 0) {
      saveTasks(tasks);
      renderTasks();
      showOwlConfirm('Задачу закрито ✓');
    }
    return;
  }

  if (act === 'create_task') {
    const title = (action.title || '').trim();
    if (!title) return;
    const steps = Array.isArray(action.steps) ? action.steps.map(s => ({ id: Date.now() + Math.random(), text: s, done: false })) : [];
    const tasks = getTasks();
    tasks.unshift({ id: Date.now(), title, desc: action.desc || '', steps, status: 'active', createdAt: Date.now() });
    saveTasks(tasks);
    if (currentTab === 'tasks') renderTasks();
    showOwlConfirm('Задачу створено ✓');
    return;
  }

  if (act === 'create_note') {
    const noteText = (action.text || originalText || '').trim();
    if (!noteText) return;
    addNoteFromInbox(noteText, 'note', action.folder || null, 'agent');
    if (currentTab === 'notes') renderNotes();
    showOwlConfirm('Нотатку збережено ✓');
    return;
  }

  if (act === 'save_finance') {
    const amount = parseFloat(action.amount) || 0;
    if (amount <= 0) return;
    const type = action.fin_type || 'expense';
    const category = action.category || 'Інше';
    const cats = getFinCats();
    const catList = type === 'expense' ? cats.expense : cats.income;
    if (!catList.includes(category)) { catList.push(category); saveFinCats(cats); }
    const txs = getFinance();
    txs.unshift({ id: Date.now(), type, amount, category, comment: action.comment || originalText, ts: Date.now() });
    saveFinance(txs);
    if (currentTab === 'finance') renderFinance();
    const sign = type === 'expense' ? '-' : '+';
    showOwlConfirm(`${sign}${formatMoney(amount)} · ${category} ✓`);
    return;
  }
}

// === OWL Board Swipe Gesture ===
let _owlSwipe = null;
function owlSwipeStart(e) {
  const msgsEl = document.getElementById('owl-chat-messages');
  if (msgsEl && msgsEl.contains(e.target)) return; // дозволяємо скрол в повідомленнях
  const t = e.touches[0];
  _owlSwipe = { startY: t.clientY, dy: 0, locked: false };
}
function owlSwipeMove(e) {
  if (!_owlSwipe) return;
  _owlSwipe.dy = e.touches[0].clientY - _owlSwipe.startY;
  // Якщо вертикальний свайп >10px — блокуємо скрол карточок
  if (Math.abs(_owlSwipe.dy) > 10) {
    _owlSwipe.locked = true;
    e.preventDefault();
  }
}
function owlSwipeEnd() {
  if (!_owlSwipe) return;
  const dy = _owlSwipe.dy;
  _owlSwipe = null;
  // Свайп вниз: expanded → speech, speech → expanded (розгорнути чат)
  // Свайп вгору: speech → collapsed, expanded → speech
  if (dy < -40) {
    if (_getOwlState() === 'expanded') collapseOwlToSpeech();
    else if (_getOwlState() === 'speech') _owlSetState('collapsed');
  } else if (dy > 40) {
    if (_getOwlState() === 'speech') expandOwlChat();
    else if (_getOwlState() === 'collapsed') _owlSetState('speech');
  }
}

function dismissOwlBoard() {
  const board = document.getElementById('owl-board');
  if (board) board.style.display = 'none';
}

// Перевірка нагадувань кожну хвилину
function _checkReminders() {
  try {
    const reminders = JSON.parse(localStorage.getItem('nm_reminders') || '[]');
    const now = new Date();
    const todayISO = now.toISOString().slice(0, 10);
    const nowTime = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    const due = reminders.filter(r => !r.done && r.date === todayISO && r.time <= nowTime);
    if (due.length > 0) {
      // Дедуплікація: позначаємо due нагадування як "done" одразу,
      // щоб тригер не повторювався щохвилини поки вони активні.
      // `done: true` означає "вже показано", не "виконано користувачем".
      due.forEach(r => { r.done = true; r.firedAt = Date.now(); });
      localStorage.setItem('nm_reminders', JSON.stringify(reminders));
      // Одноразовий тригер оновлення табло
      import('./proactive.js').then(m => m.generateBoardMessage('inbox'));
    }
  } catch(e) {}
}

// Автоочищення старих нагадувань — видаляє записи старші 7 днів
// Запускається один раз при старті застосунку
function _cleanupOldReminders() {
  try {
    const reminders = JSON.parse(localStorage.getItem('nm_reminders') || '[]');
    if (reminders.length === 0) return;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 7);
    const cutoffISO = cutoffDate.toISOString().slice(0, 10);
    const fresh = reminders.filter(r => r.date >= cutoffISO);
    if (fresh.length < reminders.length) {
      localStorage.setItem('nm_reminders', JSON.stringify(fresh));
    }
  } catch(e) {}
}

// Запуск циклу перевірки
export function startOwlBoardCycle() {
  // Одноразовий запит розкладу якщо не заповнено
  _owlAskScheduleIfNeeded();
  // Разове автоочищення старих нагадувань (>7 днів)
  _cleanupOldReminders();
  // Одразу при відкритті
  tryOwlBoardUpdate();
  // Перевірка нагадувань кожну хвилину
  setInterval(_checkReminders, 60 * 1000);
  // Потім кожні 10 хвилин (fallback — основні тригери через події)
  if (_owlBoardTimer) clearInterval(_owlBoardTimer);
  _owlBoardTimer = setInterval(tryOwlBoardUpdate, OWL_BOARD_INTERVAL);
}

export function tryOwlBoardUpdate() {
  const msgs = getOwlBoardMessages();
  if (msgs.length > 0) renderOwlBoard();

  // Якщо кеш порожній — примусово генерувати одразу (наприклад після очищення міграцією)
  if (msgs.length === 0) {
    import('./proactive.js').then(m => m.generateBoardMessage('inbox'));
    return;
  }

  // G9 (ROADMAP Блок 1) — Page Visibility: коли вкладка прихована,
  // не генерувати ніяких табло (юзер не побачить, API палиться даремно).
  // Виняток лише reminder-due — він іде через _checkReminders, не сюди.
  if (typeof document !== 'undefined' && document.hidden) return;

  const phase = getDayPhase();
  if (phase === 'silent') return;

  // SAFETY NET: якщо повідомлення на табло > 60 хв — примусова генерація
  const visibleTs = msgs[0]?.ts || msgs[0]?.id || 0;
  if (visibleTs && Date.now() - visibleTs > 60 * 60 * 1000) {
    console.log('[OWL board] stale message detected, forcing generation');
    import('./proactive.js').then(m => m.generateBoardMessage('inbox'));
    return;
  }

  // Judge Layer вирішує чи генерувати нове
  const lastTs = parseInt(localStorage.getItem(OWL_BOARD_TS_KEY) || '0');
  const isFirstTime = msgs.length === 0 && lastTs === 0;
  const isNewDay = lastTs > 0 && new Date(lastTs).toDateString() !== new Date().toDateString();

  const trigger = isFirstTime ? 'first-time' : isNewDay ? 'new-day' : 'timer';
  const judge = shouldOwlSpeak(trigger);
  if (judge.speak) {
    import('./proactive.js').then(m => m.generateBoardMessage('inbox'));
  }
}

// Одноразово запитує розклад якщо не заповнено
function _owlAskScheduleIfNeeded() {
  if (localStorage.getItem('nm_owl_schedule_asked')) return;
  const s = JSON.parse(localStorage.getItem('nm_settings') || '{}');
  if (s.schedule && s.schedule.wakeUp) return; // вже заповнено
  localStorage.setItem('nm_owl_schedule_asked', '1');
  localStorage.setItem('nm_owl_schedule_pending', String(Date.now()));
  // Затримка 10 сек щоб не перебивати завантаження
  setTimeout(() => {
    try {
      addInboxChatMsg('agent', 'Щоб краще підлаштовуватись під твій ритм — скажи приблизно: о котрій прокидаєшся, починаєш і завершуєш активний день, і лягаєш спати? (наприклад: встаю 7, працюю 9–18, сплю о 23)');
    } catch(e) {}
  }, 10000);
}

// Перехоплення відповіді на питання розкладу в Inbox
export function handleScheduleAnswer(text) {
  const pending = localStorage.getItem('nm_owl_schedule_pending');
  if (!pending) return false;
  // TTL 1 година — якщо питання задане давно, ігноруємо
  const pendingTs = parseInt(pending);
  if (!isNaN(pendingTs) && Date.now() - pendingTs > 3600000) {
    localStorage.removeItem('nm_owl_schedule_pending');
    return false;
  }
  let found = 0;
  const parseH = (patterns, def) => {
    for (const re of patterns) {
      const m = text.match(re);
      if (m) { const h = parseInt(m[1]); if (!isNaN(h) && h >= 0 && h <= 23) { found++; return `${String(h).padStart(2,'0')}:00`; } }
    }
    return def;
  };
  const schedule = {
    wakeUp:    parseH([/встаю\s*о?\s*(\d{1,2})/i, /прокидаюсь\s*о?\s*(\d{1,2})/i, /підйом\s*о?\s*(\d{1,2})/i], '07:00'),
    workStart: parseH([/працюю\s*з\s*(\d{1,2})/i, /починаю\s*о?\s*(\d{1,2})/i, /роботу?\s*з\s*(\d{1,2})/i, /з\s*(\d{1,2})\s*[-–до]/i], '09:00'),
    workEnd:   parseH([/до\s*(\d{1,2})\b/i, /закінчую\s*о?\s*(\d{1,2})/i, /[-–]\s*(\d{1,2})\b/i], '18:00'),
    bedTime:   parseH([/сплю\s*о?\s*(\d{1,2})/i, /лягаю\s*о?\s*(\d{1,2})/i, /о\s*(\d{1,2})\s*спати/i], '23:00'),
  };
  // Якщо жодного часу не знайдено — не перехоплюємо, пускаємо далі до AI
  if (found === 0) return false;
  localStorage.removeItem('nm_owl_schedule_pending');
  const s = JSON.parse(localStorage.getItem('nm_settings') || '{}');
  s.schedule = schedule;
  localStorage.setItem('nm_settings', JSON.stringify(s));
  try {
    addInboxChatMsg('agent', `Розклад збережено: підйом ${schedule.wakeUp}, робота ${schedule.workStart}–${schedule.workEnd}, спати ${schedule.bedTime}. Можеш змінити в Налаштуваннях.`);
  } catch(e) {}
  return true;
}

// Debounce listener видалено — єдиний listener тепер у proactive.js

// === WINDOW GLOBALS (HTML handlers only) ===
window.sendOwlReply = sendOwlReply;
