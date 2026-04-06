// ============================================================
// app-ai-chat.js — 3-стейтний чат, OWL Board
// Залежності: app-core.js, app-ai-core.js
// ============================================================

import { currentTab, switchTab, showToast } from '../core/nav.js';
import { escapeHtml } from '../core/utils.js';
import { activeChatBar, callOwlChat, closeChatBar, openChatBar, restoreChatUI, setActiveChatBar } from '../ai/core.js';
import { _owlTabApplyState, _owlTabStates, renderTabBoard } from './board.js';
import { renderChips } from './chips.js';
import { addInboxChatMsg } from '../tabs/inbox.js';
import { getTasks, saveTasks, renderTasks } from '../tabs/tasks.js';
import { getHabits, getHabitLog, getQuitStatus, renderHabits, renderProdHabits, saveHabitLog } from '../tabs/habits.js';
import { getNotes, renderNotes, addNoteFromInbox } from '../tabs/notes.js';
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
const OWL_BOARD_KEY = 'nm_owl_board';       // масив до 3 повідомлень
const OWL_BOARD_SEEN_KEY = 'nm_owl_board_seen'; // які ID вже показано
const OWL_BOARD_TS_KEY = 'nm_owl_board_ts'; // timestamp останньої генерації
const OWL_BOARD_INTERVAL = 3 * 60 * 1000;  // 3 хвилини

let _owlBoardMessages = [];
// _owlBoardGenerating видалено — guard тепер у generateBoardMessage (proactive.js)
let _owlBoardTimer = null;

export function getOwlBoardMessages() {
  try { return JSON.parse(localStorage.getItem(OWL_BOARD_KEY) || '[]'); } catch { return []; }
}
export function saveOwlBoardMessages(arr) {
  localStorage.setItem(OWL_BOARD_KEY, JSON.stringify(arr.slice(-30)));
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
  return {
    wakeUp:    parseH(sc.wakeUp,    7),
    workStart: parseH(sc.workStart, 9),
    workEnd:   parseH(sc.workEnd,   18),
    bedTime:   parseH(sc.bedTime,   23),
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
function owlCdExpired(topic, ms) {
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

// Перевірка чи є щось важливе — БЕЗ API
function checkOwlBoardTrigger() {
  const key = localStorage.getItem('nm_gemini_key');
  if (!key) return false;

  const phase = getDayPhase();
  if (phase === 'silent' || phase === 'dawn') return false;

  const now = new Date();
  const todayStr = now.toDateString();
  const hour = now.getHours();
  const min  = now.getMinutes();
  const sc   = getSchedule();

  // Регулярний пульс — мінімум кожні 45 хв незалежно від теми
  if (owlCdExpired('phase_pulse', 45 * 60 * 1000)) return true;

  // КРИТИЧНІ — короткі cooldown, можуть повторитись
  const tasks = getTasks().filter(t => t.status !== 'done');

  // Дедлайн через ~годину (30 хв cooldown — може повторно попередити)
  for (const t of tasks) {
    const m = t.title.match(/(\d{1,2}):(\d{2})/);
    if (m) {
      const diff = (parseInt(m[1])*60+parseInt(m[2])) - (hour*60+min);
      if (diff > 0 && diff <= 65 && owlCdExpired('deadline_' + t.id, 30 * 60 * 1000)) return true;
    }
  }

  // Стрік під загрозою ввечері (1 год cooldown)
  if (phase === 'evening' || phase === 'night') {
    const habits = getHabits();
    const log = getHabitLog();
    const todayLog = log[todayStr] || {};
    const atRisk = habits.filter(h => h.days.includes(now.getDay()) && !todayLog[h.id]);
    if (atRisk.length > 0 && owlCdExpired('streak_risk', 60 * 60 * 1000)) return true;
  }

  // ВАЖЛИВІ — середні cooldown

  // Задача застрягла 3+ дні (6 год cooldown)
  const stuck = tasks.filter(t => t.createdAt && t.createdAt < Date.now() - 3*24*60*60*1000);
  if (stuck.length > 0 && owlCdExpired('stuck_tasks', 6 * 60 * 60 * 1000)) return true;

  // Звички не виконані (3 год cooldown, тільки в робочий час і вечір)
  if (phase === 'work' || phase === 'evening') {
    const habits = getHabits();
    const log = getHabitLog();
    const todayLog = log[todayStr] || {};
    const pending = habits.filter(h => h.days.includes(now.getDay()) && !todayLog[h.id]);
    if (pending.length > 0 && owlCdExpired('habits_check', 3 * 60 * 60 * 1000)) return true;
  }

  // Всі звички виконані — привітати (8 год cooldown)
  if (phase === 'work' || phase === 'evening') {
    const habits = getHabits();
    const log = getHabitLog();
    const todayLog = log[todayStr] || {};
    const todayH = habits.filter(h => h.days.includes(now.getDay()));
    if (todayH.length > 0 && todayH.every(h => todayLog[h.id]) && owlCdExpired('habits_done', 8 * 60 * 60 * 1000)) return true;
  }

  // Бюджет 80%+ (4 год cooldown)
  try {
    const budget = getFinBudget();
    if (budget.total > 0) {
      const from = getFinPeriodRange('month');
      const exp = getFinance().filter(t => t.ts >= from && t.type === 'expense').reduce((s,t) => s+t.amount, 0);
      if (exp / budget.total >= 0.8 && owlCdExpired('budget_warn', 4 * 60 * 60 * 1000)) return true;
    }
  } catch(e) {}

  // Вечір без підсумку (4 год cooldown)
  if (phase === 'evening' || phase === 'night') {
    const s = JSON.parse(localStorage.getItem('nm_evening_summary') || 'null');
    if ((!s || new Date(s.date).toDateString() !== todayStr) && owlCdExpired('evening_prompt', 4 * 60 * 60 * 1000)) return true;
  }

  // Ранковий брифінг (3 год cooldown)
  if (phase === 'morning' && owlCdExpired('morning_brief', 3 * 60 * 60 * 1000)) return true;

  // Понеділок — огляд тижня (6 год cooldown)
  if (now.getDay() === 1 && (phase === 'morning' || phase === 'work') && owlCdExpired('week_start', 6 * 60 * 60 * 1000)) return true;

  // Пʼятниця — підсумок тижня (6 год cooldown)
  if (now.getDay() === 5 && phase === 'evening' && owlCdExpired('week_end', 6 * 60 * 60 * 1000)) return true;

  return false;
}

// Будуємо контекст для табло з пріоритетами
export function getOwlBoardContext() {
  const now = new Date();
  const todayStr = now.toDateString();
  const hour = now.getHours();
  const min = now.getMinutes();
  const weekDay = now.getDay();
  const phase = getDayPhase();
  const sc = getSchedule();
  const critical = [];
  const important = [];
  const normal = [];

  // Фаза дня — інструкція для агента
  const phaseLabels = {
    morning: `[ФАЗА: РАНОК] Час планування. Фокус: пріоритети на день, мотивація, що найважливіше зробити. Підйом о ${sc.wakeUp}:00, активний день починається о ${sc.workStart}:00.`,
    work:    `[ФАЗА: РОБОТА] Активний час. Фокус: прогрес задач, виконання звичок, поточний стан.`,
    evening: `[ФАЗА: ВЕЧІР] Час підсумків. Фокус: що зроблено, які звички ще не виконані, підготовка до завтра. Робота завершується о ${sc.workEnd}:00.`,
    night:   `[ФАЗА: НІЧ] Тихий час. Тільки критичне — звички які можна ще встигнути виконати. Коротко.`,
  };
  if (phaseLabels[phase]) normal.push(phaseLabels[phase]);

  normal.push(`Зараз ${now.toLocaleTimeString('uk-UA', {hour:'2-digit',minute:'2-digit'})}.`);

  // Задачі
  const tasks = getTasks();
  const activeTasks = tasks.filter(t => t.status !== 'done');

  // Дедлайн через ~годину
  const urgent = activeTasks.filter(t => {
    const m = t.title.match(/(\d{1,2}):(\d{2})/);
    if (!m) return false;
    const diff = (parseInt(m[1])*60+parseInt(m[2])) - (hour*60+min);
    return diff > 0 && diff <= 65;
  });
  urgent.forEach(t => {
    critical.push(`[КРИТИЧНО] Дедлайн через ~годину: "${t.title}".`);
  });

  // Задача завʼязла 3+ дні
  const stuck = activeTasks.filter(t => t.createdAt && t.createdAt < Date.now() - 3*24*60*60*1000);
  stuck.forEach(t => {
    important.push(`[ВАЖЛИВО] Задача "${t.title}" відкрита вже 3+ дні.`);
  });

  if (activeTasks.length > 0) {
    normal.push(`Відкритих задач: ${activeTasks.length}. ${activeTasks.slice(0,3).map(t=>t.title).join(', ')}${activeTasks.length>3?' і ще...':''}.`);
  } else {
    normal.push('Всі задачі виконано.');
  }

  // Звички
  const habits = getHabits();
  const buildHabits = habits.filter(h => h.type !== 'quit');
  const quitHabits = habits.filter(h => h.type === 'quit');
  const log = getHabitLog();
  const todayLog = log[todayStr] || {};
  const todayHabits = buildHabits.filter(h => h.days.includes(now.getDay()));
  const doneHabits = todayHabits.filter(h => todayLog[h.id]);
  const pendingHabits = todayHabits.filter(h => !todayLog[h.id]);

  // Всі звички виконані
  if (todayHabits.length > 0 && pendingHabits.length === 0) {
    important.push(`[ВАЖЛИВО] Всі ${todayHabits.length} звичок виконано сьогодні!`);
  }

  // Звички з серією під загрозою ввечері
  if ((phase === 'evening' || phase === 'night') && pendingHabits.length > 0) {
    const atRisk = pendingHabits.filter(h => {
      const streak = Object.values(log).filter(d => d[h.id]).length;
      return streak >= 3;
    });
    if (atRisk.length > 0) {
      const details = atRisk.map(h => {
        const streak = Object.values(log).filter(d => d[h.id]).length;
        return `"${h.name}" (вже ${streak} днів підряд, сьогодні ще не виконано)`;
      });
      critical.push(`[КРИТИЧНО] Звички з серією під загрозою — день закінчується а ти ще не зробив: ${details.join(', ')}.`);
    }
  }

  // Звички не виконані в робочий час або вечір
  if ((phase === 'work' || phase === 'evening') && pendingHabits.length > 0) {
    important.push(`[ВАЖЛИВО] Не виконано звичок: ${pendingHabits.map(h=>h.name).join(', ')}.`);
  }

  if (todayHabits.length > 0) {
    normal.push(`Звички сьогодні: ${doneHabits.length}/${todayHabits.length}.`);
  }

  // Quit звички
  if (quitHabits.length > 0) {
    const todayIso = now.toISOString().slice(0, 10);
    const notHeldToday = quitHabits.filter(h => getQuitStatus(h.id).lastHeld !== todayIso);
    if ((phase === 'evening' || phase === 'night') && notHeldToday.length > 0) {
      important.push(`[ВАЖЛИВО] Не відмічено сьогодні (кинути): ${notHeldToday.map(h => '"' + h.name + '"').join(', ')}.`);
    }
    quitHabits.forEach(h => {
      const s = getQuitStatus(h.id);
      const streak = s.streak || 0;
      const milestones = [7, 14, 21, 30, 60, 90];
      if (milestones.includes(streak) && owlCdExpired('quit_milestone_' + h.id + '_' + streak, 24 * 60 * 60 * 1000)) {
        important.push(`[ВАЖЛИВО] ${streak} днів без "${h.name}"! 🎉`);
      }
    });
    const quitInfo = quitHabits.map(h => `"${h.name}": ${(getQuitStatus(h.id).streak||0)} дн`);
    normal.push(`Челенджі: ${quitInfo.join(', ')}.`);
  }

  // Фінанси
  try {
    const budget = getFinBudget();
    if (budget.total > 0) {
      const from = getFinPeriodRange('month');
      const txs = getFinance().filter(t => t.ts >= from && t.type === 'expense');
      const exp = txs.reduce((s,t) => s+t.amount, 0);
      const pct = Math.round(exp/budget.total*100);
      if (exp > budget.total) {
        important.push(`[ВАЖЛИВО] Бюджет перевищено! Витрачено ${formatMoney(exp)} з ${formatMoney(budget.total)} (${pct}%).`);
      } else if (pct >= 80) {
        important.push(`[ВАЖЛИВО] Витрачено ${pct}% місячного бюджету.`);
      } else {
        normal.push(`Бюджет місяця: ${formatMoney(exp)} / ${formatMoney(budget.total)} (${pct}%).`);
      }
      if (txs.length >= 3) {
        const bycat = {};
        txs.forEach(t => { if (!bycat[t.category]) bycat[t.category] = []; bycat[t.category].push(t.amount); });
        const lastTx = txs[0];
        if (lastTx && bycat[lastTx.category] && bycat[lastTx.category].length >= 2) {
          const avg = bycat[lastTx.category].reduce((a,b)=>a+b,0) / bycat[lastTx.category].length;
          if (lastTx.amount > avg * 2.5 && owlCdExpired('unusual_tx_' + lastTx.id, 8 * 60 * 60 * 1000)) {
            important.push(`[ВАЖЛИВО] Незвична витрата: ${formatMoney(lastTx.amount)} на "${lastTx.category}" — вище звичного вдвічі.`);
          }
        }
      }
    }
  } catch(e) {}

  // Вечір без підсумку
  if (phase === 'evening' || phase === 'night') {
    const s = JSON.parse(localStorage.getItem('nm_evening_summary') || 'null');
    if (!s || new Date(s.date).toDateString() !== todayStr) {
      important.push('[ВАЖЛИВО] Вечір — підсумок дня ще не записано.');
    }
  }

  // Понеділок — огляд тижня
  if (weekDay === 1 && (phase === 'morning' || phase === 'work')) {
    normal.push('[ТИЖДЕНЬ] Новий тиждень. Огляд планів і відкритих задач.');
  }

  // Пʼятниця — підсумок тижня
  if (weekDay === 5 && phase === 'evening') {
    const doneTasks = tasks.filter(t => t.status === 'done' && t.updatedAt && Date.now() - t.updatedAt < 7*24*60*60*1000);
    normal.push(`[ТИЖДЕНЬ] Кінець тижня. Закрито задач за тиждень: ${doneTasks.length}.`);
  }

  // Активні вкладки — агент цікавиться тільки тим що використовує користувач
  const activeTabs = [];
  if (tasks.length > 0 || getHabits().length > 0) activeTabs.push('Продуктивність (задачі, звички)');
  try { if (getNotes().length > 0) activeTabs.push('Нотатки'); } catch(e) {}
  try { if (getFinance().length > 0) activeTabs.push('Фінанси'); } catch(e) {}
  try { if (JSON.parse(localStorage.getItem('nm_health_cards') || '[]').length > 0) activeTabs.push('Здоров\'я'); } catch(e) {}
  try { if (JSON.parse(localStorage.getItem('nm_projects') || '[]').length > 0) activeTabs.push('Проекти'); } catch(e) {}
  try { if (JSON.parse(localStorage.getItem('nm_moments') || '[]').length > 0) activeTabs.push('Вечір (моменти дня)'); } catch(e) {}
  if (activeTabs.length > 0) {
    normal.push(`[АКТИВНІ ВКЛАДКИ] Користувач використовує: ${activeTabs.join(', ')}. Цікався ТІЛЬКИ цими темами.`);
  }

  return [...critical, ...important, ...normal].join(' ');
}

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

// Відправка з input
export function sendOwlReplyFromInput() {
  const inp = document.getElementById('owl-tab-input-inbox');
  if (!inp || !inp.value.trim()) return;
  const text = inp.value.trim();
  inp.value = '';
  sendOwlReply(text);
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

// Запуск циклу перевірки
export function startOwlBoardCycle() {
  // Одноразовий запит розкладу якщо не заповнено
  _owlAskScheduleIfNeeded();
  // Одразу при відкритті
  tryOwlBoardUpdate();
  // Потім кожні 3 хвилини
  if (_owlBoardTimer) clearInterval(_owlBoardTimer);
  _owlBoardTimer = setInterval(tryOwlBoardUpdate, OWL_BOARD_INTERVAL);
}

function tryOwlBoardUpdate() {
  const phase = getDayPhase();
  if (phase === 'silent') return;

  // Показуємо що є зараз
  const msgs = getOwlBoardMessages();
  if (msgs.length > 0) renderOwlBoard();

  const lastTs = parseInt(localStorage.getItem(OWL_BOARD_TS_KEY) || '0');
  const isFirstTime = msgs.length === 0 && lastTs === 0;
  const isNewDay = lastTs > 0 && new Date(lastTs).toDateString() !== new Date().toDateString();

  const shouldGenerate = isFirstTime || isNewDay || checkOwlBoardTrigger();
  if (shouldGenerate) {
    // Викликаємо єдину генерацію через lazy import щоб уникнути circular dependency
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
