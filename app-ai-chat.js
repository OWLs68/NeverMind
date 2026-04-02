// ============================================================
// app-ai-chat.js — 3-стейтний чат, OWL Board
// Залежності: app-core.js, app-ai-core.js
// ============================================================

// === 3-СТЕЙТНА СИСТЕМА ЧАТУ ДЛЯ НЕ-INBOX ВКЛАДОК ===
// Стани: undefined/відсутній = closed | 'a' = compact open | 'b' = full expand
const _tabChatState = {};

// Висота стану A: комфортна мала висота (без клавіатури – обмежена 320px; з клавіатурою – заповнює вільний простір)
function _getTabChatAHeight(tab) {
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
function _getTabChatBHeight(tab) {
  const bar = document.getElementById(tab + '-ai-bar');
  if (!bar) return 400;
  const inputBox = bar.querySelector('.ai-bar-input-box');
  const inputTop = inputBox ? inputBox.getBoundingClientRect().top : window.innerHeight - 100;
  return Math.max(250, inputTop - 80 - 8);
}

// Відкрити чат у стані A БЕЗ клавіатури (жест свайп вгору від input)
function openChatBarNoKeyboard(tab) {
  if (_tabChatState[tab]) return; // вже відкрито
  // Закриваємо інші бари
  ['inbox','tasks','me','evening','finance','health','projects'].forEach(t => {
    if (t !== tab) closeChatBar(t);
  });
  activeChatBar = tab;
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
function setupChatBarSwipe() {
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

let _owlBoardSlide = 0;
let _owlBoardMessages = [];
let _owlBoardGenerating = false;
let _owlBoardTimer = null;

function getOwlBoardMessages() {
  try { return JSON.parse(localStorage.getItem(OWL_BOARD_KEY) || '[]'); } catch { return []; }
}
function saveOwlBoardMessages(arr) {
  localStorage.setItem(OWL_BOARD_KEY, JSON.stringify(arr.slice(-3)));
}

// === OWL BOARD — повний розумний цикл ===

// Ключ для антиповтору — що вже сказали сьогодні
const OWL_BOARD_SAID_KEY = 'nm_owl_board_said'; // {date, topics:[]}

function getOwlBoardSaid() {
  try {
    const s = JSON.parse(localStorage.getItem(OWL_BOARD_SAID_KEY) || '{}');
    if (s.date !== new Date().toDateString()) return { date: new Date().toDateString(), topics: [] };
    return s;
  } catch { return { date: new Date().toDateString(), topics: [] }; }
}
function markOwlBoardSaid(topic) {
  const s = getOwlBoardSaid();
  if (!s.topics.includes(topic)) s.topics.push(topic);
  localStorage.setItem(OWL_BOARD_SAID_KEY, JSON.stringify(s));
}
function owlAlreadySaid(topic) {
  return getOwlBoardSaid().topics.includes(topic);
}

// Перевірка чи є щось важливе — БЕЗ API
function checkOwlBoardTrigger() {
  const key = localStorage.getItem('nm_gemini_key');
  if (!key) return false;

  const now = new Date();
  const todayStr = now.toDateString();
  const hour = now.getHours();
  const min = now.getMinutes();

  // Тихий режим 23:00–7:00
  if (hour < 5) return false;

  // Ранковий огляд 7:00–9:00 — раз за ранок
  if (hour >= 7 && hour <= 9 && !owlAlreadySaid('morning_brief')) return true;

  // Обід 13:00 — статус дня, раз
  if (hour === 13 && min < 30 && !owlAlreadySaid('midday_check')) return true;

  // Вечірній підсумок 20:00 — раз
  if (hour >= 20 && !owlAlreadySaid('evening_prompt')) {
    const s = JSON.parse(localStorage.getItem('nm_evening_summary') || 'null');
    if (!s || new Date(s.date).toDateString() !== todayStr) return true;
  }

  // Понеділок вранці — огляд тижня
  if (now.getDay() === 1 && hour >= 8 && hour <= 10 && !owlAlreadySaid('week_start')) return true;

  // Пʼятниця ввечері — підсумок тижня
  if (now.getDay() === 5 && hour >= 17 && !owlAlreadySaid('week_end')) return true;

  // Дедлайн через ~годину — не повторювати для тієї ж задачі
  const tasks = getTasks().filter(t => t.status !== 'done');
  for (const t of tasks) {
    const m = t.title.match(/(\d{1,2}):(\d{2})/);
    if (m) {
      const diff = (parseInt(m[1])*60+parseInt(m[2])) - (hour*60+min);
      if (diff > 0 && diff <= 65 && !owlAlreadySaid('deadline_' + t.id)) return true;
    }
  }

  // Задача 3+ дні не закривається
  const now3d = Date.now() - 3*24*60*60*1000;
  const stuck = tasks.filter(t => t.createdAt && t.createdAt < now3d && !owlAlreadySaid('stuck_' + t.id));
  if (stuck.length > 0) return true;

  // Звички не виконані після 10:00
  if (hour >= 10) {
    const habits = getHabits();
    const log = getHabitLog();
    const todayLog = log[todayStr] || {};
    const pending = habits.filter(h => h.days.includes(now.getDay()) && !todayLog[h.id]);
    if (pending.length > 0 && !owlAlreadySaid('habits_' + todayStr)) return true;
  }

  // Стрік під загрозою після 20:00
  if (hour >= 20) {
    const habits = getHabits();
    const log = getHabitLog();
    const todayLog = log[todayStr] || {};
    const atRisk = habits.filter(h => h.days.includes(now.getDay()) && !todayLog[h.id]);
    if (atRisk.length > 0 && !owlAlreadySaid('streak_risk_' + todayStr)) return true;
  }

  // Всі звички виконані — привітати раз
  if (hour >= 10) {
    const habits = getHabits();
    const log = getHabitLog();
    const todayLog = log[todayStr] || {};
    const todayH = habits.filter(h => h.days.includes(now.getDay()));
    if (todayH.length > 0 && todayH.every(h => todayLog[h.id]) && !owlAlreadySaid('all_habits_done_' + todayStr)) return true;
  }

  // Бюджет 80%+ витрачено
  try {
    const budget = getFinBudget();
    if (budget.total > 0) {
      const from = getFinPeriodRange('month');
      const exp = getFinance().filter(t => t.ts >= from && t.type === 'expense').reduce((s,t) => s+t.amount, 0);
      const pct = exp / budget.total;
      if (pct >= 0.8 && !owlAlreadySaid('budget_80_' + new Date().toISOString().slice(0,7))) return true;
    }
  } catch(e) {}

  // Порожній день — немає нічого критичного, але треба щось показати
  const lastTs = parseInt(localStorage.getItem(OWL_BOARD_TS_KEY) || '0');
  const sinceLastH = (Date.now() - lastTs) / (60*60*1000);
  if (sinceLastH > 4 && !owlAlreadySaid('quiet_day_' + todayStr)) return true;

  return false;
}

// Будуємо контекст для табло з пріоритетами
function getOwlBoardContext() {
  const now = new Date();
  const todayStr = now.toDateString();
  const hour = now.getHours();
  const min = now.getMinutes();
  const weekDay = now.getDay(); // 0=нд, 1=пн...5=пт
  const critical = [];
  const important = [];
  const normal = [];

  const timeOfDay = hour < 12 ? 'ранок' : hour < 18 ? 'день' : 'вечір';
  normal.push(`Зараз ${timeOfDay}, ${now.toLocaleTimeString('uk-UA', {hour:'2-digit',minute:'2-digit'})}.`);

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
    if (!owlAlreadySaid('deadline_' + t.id)) {
      critical.push(`[КРИТИЧНО] Дедлайн через ~годину: "${t.title}".`);
      markOwlBoardSaid('deadline_' + t.id);
    }
  });

  // Задача завʼязла 3+ дні
  const now3d = Date.now() - 3*24*60*60*1000;
  const stuck = activeTasks.filter(t => t.createdAt && t.createdAt < now3d);
  stuck.forEach(t => {
    if (!owlAlreadySaid('stuck_' + t.id)) {
      important.push(`[ВАЖЛИВО] Задача "${t.title}" відкрита вже 3+ дні.`);
      markOwlBoardSaid('stuck_' + t.id);
    }
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

  // Всі звички виконані — привітати
  if (todayHabits.length > 0 && pendingHabits.length === 0 && !owlAlreadySaid('all_habits_done_' + todayStr)) {
    important.push(`[ВАЖЛИВО] Всі ${todayHabits.length} звичок виконано сьогодні!`);
    markOwlBoardSaid('all_habits_done_' + todayStr);
  }

  // Стрік під загрозою після 20:00
  if (hour >= 20 && pendingHabits.length > 0 && !owlAlreadySaid('streak_risk_' + todayStr)) {
    const atRisk = pendingHabits.filter(h => {
      const allDays = Object.values(log);
      return allDays.filter(d => d[h.id]).length >= 3;
    });
    if (atRisk.length > 0) {
      critical.push(`[КРИТИЧНО] Стрік під загрозою: ${atRisk.map(h=>h.name).join(', ')}.`);
      markOwlBoardSaid('streak_risk_' + todayStr);
    }
  }

  // Звички не виконані після 10:00
  if (hour >= 10 && pendingHabits.length > 0 && !owlAlreadySaid('habits_' + todayStr)) {
    important.push(`[ВАЖЛИВО] Не виконано звичок: ${pendingHabits.map(h=>h.name).join(', ')}.`);
    markOwlBoardSaid('habits_' + todayStr);
  }

  if (todayHabits.length > 0) {
    normal.push(`Звички сьогодні: ${doneHabits.length}/${todayHabits.length}.`);
  }

  // Quit звички — нагадування і стрік
  if (quitHabits.length > 0) {
    const todayIso = now.toISOString().slice(0, 10);
    const notHeldToday = quitHabits.filter(h => getQuitStatus(h.id).lastHeld !== todayIso);
    // Ввечері — нагадати відмітити
    if (hour >= 19 && notHeldToday.length > 0 && !owlAlreadySaid('quit_reminder_' + todayIso)) {
      important.push(`[ВАЖЛИВО] Не відмічено сьогодні (кинути): ${notHeldToday.map(h => '"' + h.name + '"').join(', ')}.`);
      markOwlBoardSaid('quit_reminder_' + todayIso);
    }
    // Великий стрік — відзначити
    quitHabits.forEach(h => {
      const s = getQuitStatus(h.id);
      const streak = s.streak || 0;
      const milestones = [7, 14, 21, 30, 60, 90];
      const hit = milestones.find(m => m === streak);
      if (hit && !owlAlreadySaid('quit_milestone_' + h.id + '_' + streak)) {
        important.push(`[ВАЖЛИВО] ${streak} днів без "${h.name}"! 🎉`);
        markOwlBoardSaid('quit_milestone_' + h.id + '_' + streak);
      }
    });
    const quitInfo = quitHabits.map(h => {
      const s = getQuitStatus(h.id);
      return `"${h.name}": ${s.streak||0} дн`;
    });
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
      const monthKey = new Date().toISOString().slice(0,7);
      if (exp > budget.total) {
        important.push(`[ВАЖЛИВО] Бюджет перевищено! Витрачено ${formatMoney(exp)} з ${formatMoney(budget.total)} (${pct}%).`);
      } else if (pct >= 80 && !owlAlreadySaid('budget_80_' + monthKey)) {
        important.push(`[ВАЖЛИВО] Витрачено ${pct}% місячного бюджету.`);
        markOwlBoardSaid('budget_80_' + monthKey);
      } else {
        normal.push(`Бюджет місяця: ${formatMoney(exp)} / ${formatMoney(budget.total)} (${pct}%).`);
      }

      // Незвична витрата — більше ніж вдвічі від середньої по категорії
      if (txs.length >= 3) {
        const bycat = {};
        txs.forEach(t => { if (!bycat[t.category]) bycat[t.category] = []; bycat[t.category].push(t.amount); });
        const lastTx = txs[0];
        if (lastTx && bycat[lastTx.category] && bycat[lastTx.category].length >= 2) {
          const avg = bycat[lastTx.category].reduce((a,b)=>a+b,0) / bycat[lastTx.category].length;
          if (lastTx.amount > avg * 2.5 && !owlAlreadySaid('unusual_tx_' + lastTx.id)) {
            important.push(`[ВАЖЛИВО] Незвична витрата: ${formatMoney(lastTx.amount)} на "${lastTx.category}" — вище звичного вдвічі.`);
            markOwlBoardSaid('unusual_tx_' + lastTx.id);
          }
        }
      }
    }
  } catch(e) {}

  // Ранковий огляд
  if (hour >= 7 && hour <= 9 && !owlAlreadySaid('morning_brief')) {
    normal.push(`[РАНОК] Початок дня. Налаштуй пріоритети.`);
    markOwlBoardSaid('morning_brief');
  }

  // Середина дня
  if (hour === 13 && min < 30 && !owlAlreadySaid('midday_check')) {
    normal.push(`[ОБІД] Середина дня — як справи?`);
    markOwlBoardSaid('midday_check');
  }

  // Вечір без підсумку
  if (hour >= 20 && !owlAlreadySaid('evening_prompt')) {
    const s = JSON.parse(localStorage.getItem('nm_evening_summary') || 'null');
    if (!s || new Date(s.date).toDateString() !== todayStr) {
      important.push('[ВАЖЛИВО] Вечір — підсумок дня ще не записано.');
      markOwlBoardSaid('evening_prompt');
    }
  }

  // Понеділок — огляд тижня
  if (weekDay === 1 && hour >= 8 && hour <= 10 && !owlAlreadySaid('week_start')) {
    normal.push('[ТИЖДЕНЬ] Новий тиждень. Огляд планів і відкритих задач.');
    markOwlBoardSaid('week_start');
  }

  // Пʼятниця — підсумок тижня
  if (weekDay === 5 && hour >= 17 && !owlAlreadySaid('week_end')) {
    const doneTasks = tasks.filter(t => t.status === 'done' && t.updatedAt && Date.now() - t.updatedAt < 7*24*60*60*1000);
    normal.push(`[ТИЖДЕНЬ] Кінець тижня. Закрито задач за тиждень: ${doneTasks.length}.`);
    markOwlBoardSaid('week_end');
  }

  // Порожній день — немає нічого критичного або важливого
  const lastTs = parseInt(localStorage.getItem(OWL_BOARD_TS_KEY) || '0');
  const sinceLastH = (Date.now() - lastTs) / (60*60*1000);
  if (critical.length === 0 && important.length === 0 && sinceLastH > 4 && !owlAlreadySaid('quiet_day_' + todayStr)) {
    normal.push('[СПОКІЙНИЙ ДЕНЬ] Немає нічого термінового. OWL може сказати щось мотивуюче або поставити коротке питання.');
    markOwlBoardSaid('quiet_day_' + todayStr);
  }

  return [...critical, ...important, ...normal].join(' ');
}

async function generateOwlBoardMessage() {
  if (_owlBoardGenerating) return;
  const key = localStorage.getItem('nm_gemini_key');
  if (!key) return;

  _owlBoardGenerating = true;

  const context = getOwlBoardContext();
  const existing = getOwlBoardMessages();

  // Список того що вже казали — щоб не повторювати
  const recentTexts = existing.map(m => m.text).join(' | ');

  const now = new Date();
  const hour = now.getHours();
  const timeOfDay = hour < 6 ? 'ніч' : hour < 12 ? 'ранок' : hour < 18 ? 'день' : 'вечір';
  const timeStr = now.toLocaleTimeString('uk-UA', {hour:'2-digit', minute:'2-digit'});

  const systemPrompt = getOWLPersonality() + `

Зараз: ${timeStr} (${timeOfDay}). Враховуй час доби у повідомленні.

Ти пишеш КОРОТКЕ проактивне повідомлення для табло в Inbox. Це НЕ відповідь на запит — це твоя ініціатива.

ПРІОРИТЕТ ПОВІДОМЛЕНЬ:
1. Якщо є [КРИТИЧНО] — пиши ТІЛЬКИ про це. Нічого іншого.
2. Якщо є [ВАЖЛИВО] і немає [КРИТИЧНО] — пиши про перше [ВАЖЛИВО].
3. Якщо є [СПОКІЙНИЙ ДЕНЬ] — скажи щось коротке в своєму характері: мотивацію, коротке питання про день, або просте спостереження. БЕЗ згадки задач і звичок якщо їх немає.
4. Інакше — обери найцікавіше зі звичайних даних.

ПРАВИЛА:
- Максимум 2 речення. Коротко і конкретно.
- Використовуй ТІЛЬКИ факти з контексту нижче. НЕ вигадуй ліміти, суми, плани або звички яких немає в даних.
- НЕ повторюй те що вже казав: "${recentTexts || 'нічого'}"
- Відповідай ТІЛЬКИ JSON: {"text":"повідомлення","priority":"critical|important|normal","chips":["чіп1","чіп2"]}
- chips — 2-3 конкретні факти або дії. Максимум 3 слова кожен. Якщо спокійний день — chips можуть бути порожнім масивом [].
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
    if (!reply) { _owlBoardGenerating = false; return; }

    const parsed = JSON.parse(reply.replace(/```json|```/g, '').trim());
    if (!parsed.text) { _owlBoardGenerating = false; return; }

    // Додаємо нове повідомлення, зберігаємо 3 останніх
    const msgs = getOwlBoardMessages();
    msgs.unshift({ id: Date.now(), text: parsed.text, priority: parsed.priority || 'normal', chips: parsed.chips || [] });
    saveOwlBoardMessages(msgs.slice(0, 3));
    localStorage.setItem(OWL_BOARD_TS_KEY, Date.now().toString());

    renderOwlBoard();
  } catch(e) {}
  _owlBoardGenerating = false;
}

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

// Рендер OWL Board — великий блок з аватаром, текстом і чіпами
function renderOwlBoard() {
  const boardMessages = getOwlBoardMessages();
  const board = document.getElementById('owl-board');
  if (!board) return;

  if (boardMessages.length === 0) {
    board.style.display = 'none';
    return;
  }
  board.style.display = 'block';
  _owlBoardMessages = boardMessages;

  const latest = boardMessages[0];

  // Пріоритет — клас на контейнер
  const container = board.querySelector('.owl-board-container');
  if (container) {
    container.classList.remove('owl-priority-critical', 'owl-priority-important');
    if (latest.priority === 'critical') container.classList.add('owl-priority-critical');
    else if (latest.priority === 'important') container.classList.add('owl-priority-important');
  }

  // Текст — повний, читабельний
  const textEl = document.getElementById('owl-board-text');
  if (textEl) textEl.textContent = latest.text;

  // Чіпи — завжди видимі на основному екрані
  const chipsEl = document.getElementById('owl-board-chips');
  if (chipsEl) {
    if (latest.chips && latest.chips.length > 0) {
      chipsEl.innerHTML = latest.chips.map(c => {
        const safe = escapeHtml(c).replace(/'/g, '&#39;');
        return `<div class="owl-chip" onclick="event.stopPropagation();sendOwlReply('${safe}')">${escapeHtml(c)}</div>`;
      }).join('');
    } else {
      chipsEl.innerHTML = '';
    }
  }

  // Якщо чат відкритий — оновити повідомлення і чіпи чату
  if (_owlChatOpen) {
    renderOwlChatMessages();
    renderOwlChips(latest);
  }
}

// Розгорнути / згорнути міні-чат
function toggleOwlChat() {
  _owlChatOpen = !_owlChatOpen;
  const main = document.getElementById('owl-board-main');
  const expanded = document.getElementById('owl-chat-expanded');
  if (!main || !expanded) return;

  if (_owlChatOpen) {
    main.style.display = 'none';
    expanded.style.display = '';
    renderOwlChatMessages();
    const latest = _owlBoardMessages[0];
    renderOwlChips(latest);
    const msgs = document.getElementById('owl-chat-messages');
    if (msgs) setTimeout(() => msgs.scrollTop = msgs.scrollHeight, 50);
  } else {
    main.style.display = '';
    expanded.style.display = 'none';
  }
}

// Рендер повідомлень чату
function renderOwlChatMessages() {
  const el = document.getElementById('owl-chat-messages');
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

// Рендер чіпів
function renderOwlChips(boardMsg) {
  const el = document.getElementById('owl-chat-chips');
  if (!el) return;
  if (!boardMsg || !boardMsg.chips || boardMsg.chips.length === 0) {
    el.innerHTML = '';
    return;
  }
  el.innerHTML = boardMsg.chips.map(c => {
    const safe = escapeHtml(c).replace(/'/g, '&#39;');
    return `<div class="owl-chip" onclick="sendOwlReply('${safe}')">${escapeHtml(c)}</div>`;
  }).join('');
}

// Typing індикатор
function showOwlTyping(show) {
  const el = document.getElementById('owl-chat-messages');
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
  // Блокуємо input
  const inp = document.getElementById('owl-chat-input');
  const btn = document.getElementById('owl-chat-send');
  if (inp) inp.disabled = show;
  if (btn) btn.disabled = show;
}

// Зелений банер підтвердження
function showOwlConfirm(text) {
  const el = document.getElementById('owl-chat-messages');
  if (!el) return;
  const banner = document.createElement('div');
  banner.className = 'owl-confirm-banner';
  banner.textContent = text;
  el.appendChild(banner);
  el.scrollTop = el.scrollHeight;
  setTimeout(() => banner.remove(), 2500);
}

// Відправка відповіді (від чіпа або input)
async function sendOwlReply(text) {
  if (!text || _owlChatSending) return;
  _owlChatSending = true;

  // Додаємо повідомлення юзера
  saveOwlChatMsg('user', text);
  renderOwlChatMessages();

  // Показуємо typing
  showOwlTyping(true);

  // Чіпи прибираємо
  const chipsEl = document.getElementById('owl-chat-chips');
  if (chipsEl) chipsEl.innerHTML = '';

  try {
    const reply = await callOwlChat(text);
    showOwlTyping(false);

    if (reply) {
      // Парсимо відповідь — може бути JSON з action
      let replyText = reply;
      let action = null;
      try {
        const parsed = JSON.parse(reply.replace(/```json|```/g, '').trim());
        if (parsed.text) replyText = parsed.text;
        if (parsed.action) action = parsed.action;
        if (parsed.chips) {
          // Оновлюємо чіпи
          renderOwlChips({ chips: parsed.chips });
        }
      } catch(e) {
        // Не JSON — просто текст
      }

      saveOwlChatMsg('agent', replyText);
      renderOwlChatMessages();

      if (action) {
        showOwlConfirm('Зроблено ✓');
      }
    }
  } catch(e) {
    showOwlTyping(false);
  }

  _owlChatSending = false;
}

// Відправка з input
function sendOwlReplyFromInput() {
  const inp = document.getElementById('owl-chat-input');
  if (!inp || !inp.value.trim()) return;
  const text = inp.value.trim();
  inp.value = '';
  sendOwlReply(text);
}

function dismissOwlBoard() {
  const board = document.getElementById('owl-board');
  if (board) board.style.display = 'none';
}

// Запуск циклу перевірки
function startOwlBoardCycle() {
  // Одразу при відкритті
  tryOwlBoardUpdate();
  // Потім кожні 3 хвилини
  if (_owlBoardTimer) clearInterval(_owlBoardTimer);
  _owlBoardTimer = setInterval(tryOwlBoardUpdate, OWL_BOARD_INTERVAL);
}

function tryOwlBoardUpdate() {
  // Тихий режим 23:00–7:00
  const hour = new Date().getHours();
  if (hour < 5) return;

  // Показуємо що є зараз
  const msgs = getOwlBoardMessages();
  if (msgs.length > 0) renderOwlBoard();

  const lastTs = parseInt(localStorage.getItem(OWL_BOARD_TS_KEY) || '0');
  const elapsed = Date.now() - lastTs;
  const isFirstTime = msgs.length === 0 && lastTs === 0;
  const isNewDay = lastTs > 0 && new Date(lastTs).toDateString() !== new Date().toDateString();

  // Вранці (7-9) — перевіряємо частіше (кожні 2 хв)
  const interval = (hour >= 7 && hour <= 9) ? 2 * 60 * 1000 : OWL_BOARD_INTERVAL;

  const shouldGenerate = isFirstTime || isNewDay || (elapsed > interval && checkOwlBoardTrigger());
  if (shouldGenerate) generateOwlBoardMessage();
}

