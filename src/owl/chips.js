// ============================================================
// chips.js — Центральний модуль чіпів OWL
// Рендер, обробка кліку, fuzzy match, правила промптів
// ============================================================

import { switchTab, showToast, currentTab } from '../core/nav.js';
import { openChatBar, saveChatMsg } from '../ai/core.js';
import { escapeHtml, logRecentAction } from '../core/utils.js';
import { sendToAI, addInboxChatMsg } from '../tabs/inbox.js';
import { sendTasksBarMessage } from '../tabs/habits.js';
import { downgradeBriefingPriority } from './unified-storage.js';
import { renderTabBoard } from './board.js';
import { sendNotesBarMessage, addNotesChatMsg } from '../tabs/notes.js';
import { sendFinanceBarMessage } from '../tabs/finance.js';
import { addFinanceChatMsg } from '../tabs/finance-chat.js';
import { sendEveningBarMessage, addEveningBarMsg } from '../tabs/evening-chat.js';
import { sendMeChatMessage, addMeChatMsg } from '../tabs/me.js';
import { sendHealthBarMessage, addHealthChatMsg } from '../tabs/health.js';
import { sendProjectsBarMessage, addProjectsChatMsg } from '../tabs/projects.js';
import { getTasks, saveTasks, renderTasks } from '../tabs/tasks.js';
import { getHabits, getHabitLog, saveHabitLog, renderHabits, renderProdHabits, getQuitStatus } from '../tabs/habits.js';
import { applyClarifyChoice } from './clarify-guard.js';

// === ВАЛІДНІ ЦІЛІ НАВІГАЦІЇ ===
const VALID_NAV_TARGETS = ['tasks','notes','habits','finance','health','projects','evening','me','inbox'];

// ============================================================
// CHIP_PROMPT_RULES — єдине джерело правил для всіх промптів
// Імпортується в proactive.js, inbox-board.js, ai/core.js
// ============================================================
export const CHIP_PROMPT_RULES = `- G11 (ЗАВЖДИ): chips НІКОЛИ не порожні (мінімум 1, максимум 3). Якщо ставиш юзеру питання — ОБОВ'ЯЗКОВО додай можливі відповіді як чіпи. Не залишай юзера перед порожнім інпутом. Питання без чіпів = баг. Замість "Як пройшла консультація?" → текст "Консультація пройшла — створити задачу з результатами?" + chips: ["Створити", "Не треба"].
- chips — варіанти швидкої ВІДПОВІДІ користувача (не заклики до дії!). Масив об'єктів. Кожен має label (до 3 слів) і action:
  • "nav" — перекидає на вкладку (target: tasks|notes|habits|finance|health|projects|evening|me). Використовуй коли юзер має САМ переглянути/обрати/ввести дані у відповідному розділі. Коли пропонувати nav-чіп:
    - tasks: "Відкрити задачі", "Глянь задачі" — коли є відкриті задачі або мова про продуктивність
    - notes: "Глянь нотатки", "Відкрий нотатки" — коли юзер згадав запис/думку
    - habits: "Мої звички", "Глянь звички" — коли мова про стрік або ритуали
    - finance: "Перевір фінанси", "Бюджет" — коли згадка про витрати, зарплату, категорії
    - health: "Здоров'я", "Записати стан" — коли про сон/енергію/біль/симптоми
    - projects: "Відкрий проект", "Мої проекти" — коли мова про велику мету
    - evening: "Підсумок дня", "Додай момент" — увечері або при рефлексії
    - me: "Моя статистика", "Мій тиждень" — коли огляд паттернів/прогресу за період
  • "chat" — відправляє label у чат як повідомлення. ДВА випадки:
    1) Уточнення/діалог: "Пізніше", "Розкажи більше", "Ні, дякую".
    2) ЗВІТ про виконане — юзер підтверджує що ВЖЕ зробив. СТРОГО дотримуйся ВСІХ правил:
       а) ТІЛЬКИ минулий час ("Подав", "Купив", "Поправ") — НІКОЛИ інфінітив ("подати", "купити") і НІКОЛИ наказ ("подай", "купи")
       б) ОБОВ'ЯЗКОВО символ ✔️ в кінці кожного такого чіпа — без нього система не спрацює
       в) Пиши ГРАМОТНОЮ українською — НЕ суржиком. "Поправ одяг" (НЕ "постирав"), "Помив посуд" (НЕ "помив"), "Прибрав кімнату" (НЕ "убрав")
       г) Чіп = "так, я це зробив". Приклади: "Подав декларацію ✔️", "Купив продукти ✔️", "Поправ одяг ✔️"
- ПОГАНИЙ чіп (ЗАБОРОНЕНО): "Подати декларацію", "Постирати одяг", "Купити продукти" — це накази без ✔️
- ХОРОШИЙ чіп: "Подав декларацію ✔️", "Поправ одяг ✔️", "Купив продукти ✔️" — минулий час + ✔️
- Приклади хороших JSON:
  • Задачі: {"text":"Маєш 3 відкриті задачі — декларація, одяг, продукти","chips":[{"label":"Подав декларацію ✔️","action":"chat"},{"label":"Купив продукти ✔️","action":"chat"},{"label":"Відкрити задачі","action":"nav","target":"tasks"}]}
  • Фінанси: {"text":"Бюджет місяця вже 85% — час звірити витрати","chips":[{"label":"Перевір фінанси","action":"nav","target":"finance"},{"label":"Пізніше","action":"chat"}]}
  • Здоров'я: {"text":"Вже 3 дні не відмічав сон — як спав цієї ночі?","chips":[{"label":"Записати стан","action":"nav","target":"health"},{"label":"Добре ✔️","action":"chat"}]}
  • Проекти: {"text":"Проект 'Хімчистка' без прогресу 5 днів — глянемо куди застряг?","chips":[{"label":"Відкрий проект","action":"nav","target":"projects"},{"label":"Пізніше","action":"chat"}]}
  • Вечір: {"text":"День майже закінчився — як пройшов?","chips":[{"label":"Підсумок дня","action":"nav","target":"evening"},{"label":"Додай момент","action":"nav","target":"evening"}]}
- Якщо нічого конкретного — все одно дай 1-2 загальні чіпи на кшталт ["Пізніше", "Розкажи більше"] (НЕ порожній масив, див. правило G11 вище).
- ТОН чіпів має відповідати твоєму характеру (описаний вище). Coach — прямий і конкретний. Partner — м'який і підтримуючий. Mentor — запитує і направляє.`;

export const CHIP_JSON_FORMAT = `{"text":"повідомлення","topic":"коротка_тема_латиницею","priority":"critical|important|normal","chips":[{"label":"текст","action":"nav","target":"tasks"},{"label":"текст","action":"chat"}],"entityRefs":["task_888","habit_42"]}`;

// ============================================================
// normalizeChips — приведення до єдиного формату
// Старі рядки → {label, action:'chat'}. Нові об'єкти → як є.
// ============================================================
export function normalizeChips(chips) {
  if (!Array.isArray(chips)) return [];
  return chips.map(c =>
    typeof c === 'string' ? { label: c, action: 'chat' } : c
  );
}

// ============================================================
// filterStaleChips — прибирає ✔️-чіпи для вже виконаних задач/звичок
// Викликається при кожному рендері щоб "привиди" не залишались
// ============================================================
function filterStaleChips(chips) {
  return chips.filter(c => {
    const label = (c.label || '').trim();
    if (!label.includes('✔️')) return true; // не completion-чіп — залишаємо

    const cleanText = label.replace(/✔️/g, '').trim().toLowerCase();
    if (!cleanText) return false;
    const words = cleanText.split(/\s+/).filter(w => w.length >= 3);
    if (words.length === 0) return true; // не зрозумілий текст — залишаємо
    const stems = words.map(w => w.slice(0, 4));

    // Перевіряємо задачі — якщо знайшли done-збіг, чіп застарів
    const tasks = getTasks();
    for (const t of tasks) {
      if (t.status !== 'done') continue;
      const tWords = t.title.toLowerCase().split(/\s+/).filter(w => w.length >= 3);
      const tStems = tWords.map(w => w.slice(0, 4));
      const matches = stems.filter(s => tStems.some(ts => ts === s));
      if (matches.length >= 1 && matches.length >= stems.length * 0.5) return false;
    }

    // Перевіряємо звички — якщо вже виконана сьогодні, чіп застарів
    const habits = getHabits();
    const today = new Date().toDateString();
    const todayISO = new Date().toISOString().slice(0, 10);
    const log = getHabitLog();
    for (const h of habits) {
      const hWords = h.name.toLowerCase().split(/\s+/).filter(w => w.length >= 3);
      const hStems = hWords.map(w => w.slice(0, 4));
      const matches = stems.filter(s => hStems.some(hs => hs === s));
      if (matches.length >= 1 && matches.length >= stems.length * 0.5) {
        if (h.type === 'quit') {
          const quitLog = JSON.parse(localStorage.getItem('nm_quit_log') || '{}');
          if (quitLog[h.id]?.lastHeld === todayISO) return false;
        } else {
          if (log[today]?.[h.id]) return false;
        }
      }
    }

    return true; // не знайшли збігу з виконаним — залишаємо
  });
}

// ============================================================
// CHIP TRACKING — навчання через взаємодію з чіпами
// nm_chip_stats = { clicked: [{action,label,ts}], ignored: number }
// ============================================================
const NM_CHIP_STATS_KEY = 'nm_chip_stats';
const CHIP_STATS_MAX_CLICKED = 50;

function _getChipStats() {
  try { return JSON.parse(localStorage.getItem(NM_CHIP_STATS_KEY) || '{"clicked":[],"ignored":0}'); } catch { return { clicked: [], ignored: 0 }; }
}

function trackChipClick(action, label) {
  const stats = _getChipStats();
  stats.clicked.push({ action, label, ts: Date.now() });
  if (stats.clicked.length > CHIP_STATS_MAX_CLICKED) stats.clicked.splice(0, stats.clicked.length - CHIP_STATS_MAX_CLICKED);
  localStorage.setItem(NM_CHIP_STATS_KEY, JSON.stringify(stats));
  // 4.40 Auto-silence: будь-який клік чіпа = юзер реагує. Скидаємо лічильник
  // проігнорованих повідомлень + записуємо ts кліку для перевірки в generateBoardMessage.
  try {
    localStorage.setItem('nm_owl_ignored_msgs', '0');
    localStorage.setItem('nm_owl_last_chip_click_ts', String(Date.now()));
  } catch(e) {}
}

function trackChipsIgnored(count) {
  if (count <= 0) return;
  const stats = _getChipStats();
  stats.ignored += count;
  localStorage.setItem(NM_CHIP_STATS_KEY, JSON.stringify(stats));
}

export function getChipStatsForPrompt() {
  const stats = _getChipStats();
  if (stats.clicked.length === 0 && stats.ignored === 0) return '';
  const recent = stats.clicked.slice(-20);
  const chatClicks = recent.filter(c => c.action === 'chat').length;
  const navClicks = recent.filter(c => c.action === 'nav').length;
  const completionClicks = recent.filter(c => c.label && c.label.includes('✔️')).length;
  return `Статистика чіпів: натиснуто ${stats.clicked.length} (✔️: ${completionClicks}, діалог: ${chatClicks - completionClicks}, навігація: ${navClicks}), проігноровано ${stats.ignored}. ${completionClicks > chatClicks ? 'Юзер частіше підтверджує дії ✔️ ніж веде діалог.' : ''}`;
}

// ============================================================
// renderChips — малює чіпи в контейнер
// containerEl: DOM-елемент куди вставляти
// chips: масив (сирий, до нормалізації)
// tab: поточна вкладка ('inbox', 'tasks', etc.)
// options: { showSpeak: true/false, onChipClick: function }
//   onChipClick(text, action, target, chipEl) — кастомний обробник (для OWL Inbox chat)
//   showSpeak — чи додавати кнопку "Поговорити" (для tab boards)
// ============================================================
export function renderChips(containerEl, chips, tab, options = {}) {
  if (!containerEl) return;

  // Трекінг: рахуємо чіпи що залишились (не натиснуті) перед перерендером
  const oldChips = containerEl.querySelectorAll('.owl-chip:not(.owl-chip-speak)');
  if (oldChips.length > 0) trackChipsIgnored(oldChips.length);

  // Фільтр nav→currentTab (UVKL1 27.04 C8uQD): nav-чіп який веде на ту вкладку
  // де юзер уже знаходиться — марний (клік нічого не зробить, юзер бачить лише
  // зникнення чіпа без видимого ефекту). Не показуємо такі чіпи взагалі.
  // Динамічно: при переключенні вкладки renderTabBoard викликається через
  // tryBoardUpdate (nav.js:151), і фільтр перераховується на новому currentTab.
  const filteredByTab = normalizeChips(chips).filter(c => {
    if (c.action !== 'nav') return true;
    if (!c.target) return true;
    return c.target !== currentTab;
  });
  const normChips = filterStaleChips(filteredByTab);
  if (normChips.length === 0 && !options.showSpeak) {
    containerEl.innerHTML = '';
    return;
  }

  const chipsHTML = normChips.map(c => {
    const label = c.label || '';
    // 'clarify_save' — новий тип (BqTWF→mUpS8 02.05): локальне виконання save_note/save_moment
    // через payload без round-trip до AI. Запобігає галюцинаціям типу B-115.
    const action = c.action === 'nav' ? 'nav'
                 : c.action === 'clarify_save' ? 'clarify_save'
                 : 'chat';
    const target = c.target || '';
    const payload = c.payload ? JSON.stringify(c.payload) : '';
    return `<div class="owl-chip" data-chip-text="${escapeHtml(label)}" data-chip-action="${action}" data-chip-target="${escapeHtml(target)}" data-chip-payload="${escapeHtml(payload)}">${escapeHtml(label)}</div>`;
  });

  if (options.showSpeak) {
    chipsHTML.push(`<div class="owl-chip owl-chip-speak">Поговорити</div>`);
  }

  containerEl.innerHTML = chipsHTML.join('');
  containerEl.scrollLeft = 0;

  // Делегований click-обробник (один на контейнер, перевішується при кожному рендері)
  if (containerEl._chipClickHandler) {
    containerEl.removeEventListener('click', containerEl._chipClickHandler);
  }
  containerEl._chipClickHandler = (e) => {
    const chipEl = e.target.closest('.owl-chip');
    if (!chipEl) return;

    // Кнопка "Поговорити"
    if (chipEl.classList.contains('owl-chip-speak')) {
      openChatBar(tab === 'me' ? 'me' : tab);
      return;
    }

    const text = chipEl.dataset.chipText || '';
    const action = chipEl.dataset.chipAction;
    const target = chipEl.dataset.chipTarget;
    const payloadRaw = chipEl.dataset.chipPayload || '';

    // Трекінг: записуємо клік
    trackChipClick(action, text);

    // Ховаємо чіп після кліку (до наступної генерації табло)
    chipEl.style.transition = 'opacity 0.2s, transform 0.2s';
    chipEl.style.opacity = '0';
    chipEl.style.transform = 'scale(0.8)';
    setTimeout(() => chipEl.remove(), 200);

    // Кастомний обробник (для OWL Inbox expanded chat)
    if (options.onChipClick) {
      options.onChipClick(text, action, target, chipEl);
      return;
    }

    // Стандартна обробка
    handleChipClick(tab, text, action, target, payloadRaw);
  };
  containerEl.addEventListener('click', containerEl._chipClickHandler);
}

// ============================================================
// handleChipClick — головна логіка обробки кліку на чіп
// payloadRaw — JSON-строка з payload для action='clarify_save' (опціонально)
// ============================================================
export function handleChipClick(tab, text, action, target, payloadRaw) {
  // 0. Clarify-чіп (mUpS8 02.05) — локальне виконання вибору юзера
  // через save_note/save_moment без round-trip до AI. Запобігає B-115.
  if (action === 'clarify_save') {
    let payload = {};
    try { payload = payloadRaw ? JSON.parse(payloadRaw) : {}; } catch {}
    handleClarifySaveChip(tab, target, payload);
    return;
  }

  // Спеціальний target:'calendar' → відкриваємо модалку календаря + пульсація
  // (rJYkw 21.04.2026). Календар не є вкладкою — це модалка, тому окремо.
  if (action === 'nav' && target === 'calendar') {
    if (typeof window.handleUITool === 'function') {
      window.handleUITool('open_calendar', { highlight_events: true });
    } else if (typeof window.openCalendarModal === 'function') {
      window.openCalendarModal();
      if (typeof window.highlightEventDays === 'function') {
        setTimeout(() => window.highlightEventDays(), 400);
      }
    }
    return;
  }

  // 1. Навігаційний чіп — B-40 fix: ігнорувати якщо юзер вже на цільовій вкладці
  if (action === 'nav' && VALID_NAV_TARGETS.includes(target)) {
    if (target === currentTab) return; // вже на цій вкладці — не переходити
    // Шар 3 (ZJmdF 21.04.2026): клік по чіпу навігації → брифінг стає "спожитим"
    // (priority critical → normal). Без цього брифінг переслідує юзера на
    // всіх вкладках бо пробиває фільтр priority:critical у _pickMessageForTab.
    const downgraded = downgradeBriefingPriority();
    switchTab(target);
    // Re-render табло цільової вкладки з новим priority
    if (downgraded) {
      try { renderTabBoard(target); } catch(e) {}
    }
    return;
  }

  // 2. Чіп-звіт з ✔️ — обробити ЛОКАЛЬНО без AI
  if (text.includes('✔️')) {
    const handled = handleCompletionChip(text, tab);
    if (handled) return;
    // Якщо fuzzy match не знайшов нічого — відправити в чат як звичайний текст
  }

  // 3. Чат-чіп — відправити в чат відповідної вкладки
  sendChipToChat(tab, text);
}

// ============================================================
// handleCompletionChip — локальне закриття задачі/звички по тексту чіпа
// Без виклику AI! Fuzzy match по перших 4 літерах кожного слова.
// Повертає true якщо знайшов і закрив.
// ============================================================
function handleCompletionChip(text, tab) {
  // Прибираємо ✔️ і зайві символи
  const cleanText = text.replace(/✔️/g, '').trim().toLowerCase();
  if (!cleanText) return false;

  // Отримуємо слова з тексту чіпа (без коротких, мінімум 3 літери)
  const chipWords = cleanText.split(/\s+/).filter(w => w.length >= 3);
  if (chipWords.length === 0) return false;

  // Стеми (перші 4 літери) — для нечіткого порівняння
  const chipStems = chipWords.map(w => w.slice(0, 4));

  // --- Перевіряємо задачі ---
  const tasks = getTasks();
  const activeTasks = tasks.filter(t => t.status === 'active');

  for (const task of activeTasks) {
    const taskWords = task.title.toLowerCase().split(/\s+/).filter(w => w.length >= 3);
    const taskStems = taskWords.map(w => w.slice(0, 4));

    // Рахуємо скільки стемів чіпа збіглися з стемами задачі
    const matches = chipStems.filter(cs => taskStems.some(ts => ts === cs));
    // Потрібно щоб збіглося хоча б половина слів чіпа І хоча б 1 слово
    if (matches.length >= 1 && matches.length >= chipStems.length * 0.5) {
      const idx = tasks.findIndex(t => t.id === task.id);
      if (idx !== -1) {
        tasks[idx] = { ...tasks[idx], status: 'done', completedAt: Date.now(), updatedAt: Date.now() };
        saveTasks(tasks);
        renderTasks();
        const msg = `✓ "${task.title}" — виконано`;
        showToast(msg);
        saveChatMsg(tab || 'inbox', 'agent', '🦉 ' + msg);
        logRecentAction('complete_task', task.title, tab || 'inbox');
        return true;
      }
    }
  }

  // --- Перевіряємо звички ---
  const habits = getHabits();
  const today = new Date().toDateString();
  const todayISO = new Date().toISOString().slice(0, 10);
  const log = getHabitLog();

  for (const habit of habits) {
    const habitWords = habit.name.toLowerCase().split(/\s+/).filter(w => w.length >= 3);
    const habitStems = habitWords.map(w => w.slice(0, 4));

    const matches = chipStems.filter(cs => habitStems.some(hs => hs === cs));
    if (matches.length >= 1 && matches.length >= chipStems.length * 0.5) {
      if (habit.type === 'quit') {
        // Quit-звичка — відмітити "тримаюсь"
        const quitLog = JSON.parse(localStorage.getItem('nm_quit_log') || '{}');
        if (!quitLog[habit.id]) quitLog[habit.id] = { streak: 0, relapses: [] };
        quitLog[habit.id].lastHeld = todayISO;
        if (!quitLog[habit.id].streakStart) quitLog[habit.id].streakStart = todayISO;
        localStorage.setItem('nm_quit_log', JSON.stringify(quitLog));
        renderHabits();
        renderProdHabits();
        const msg = `✓ "${habit.name}" — тримаєшся!`;
        showToast(msg);
        saveChatMsg(tab || 'inbox', 'agent', '🦉 ' + msg);
        logRecentAction('hold_quit_habit', habit.name, tab || 'inbox');
        return true;
      } else {
        // Build-звичка — відмітити виконання
        if (!log[today]) log[today] = {};
        log[today][habit.id] = (log[today][habit.id] || 0) + 1;
        saveHabitLog(log);
        renderHabits();
        renderProdHabits();
        const msg = `✓ "${habit.name}" — зараховано`;
        showToast(msg);
        saveChatMsg(tab || 'inbox', 'agent', '🦉 ' + msg);
        logRecentAction('complete_habit', habit.name, tab || 'inbox');
        return true;
      }
    }
  }

  return false;
}

// ============================================================
// handleClarifySaveChip — обробка кліку на чіп clarify_save (mUpS8 02.05).
// Локально виконує save_note/save_moment/(none) у потрібному чаті без AI.
// Запобігає B-115 — навіть якщо AI вгадало неправильно, юзер одним тапом
// скеровує запис куди треба.
// ============================================================
const _CLARIFY_ADDMSG = {
  inbox:    (role, text) => addInboxChatMsg(role, text),
  notes:    (role, text) => addNotesChatMsg(role, text),
  health:   (role, text) => addHealthChatMsg(role, text),
  finance:  (role, text) => addFinanceChatMsg(role, text),
  evening:  (role, text) => addEveningBarMsg(role, text),
  projects: (role, text) => addProjectsChatMsg(role, text),
  me:       (role, text) => addMeChatMsg(role, text),
};

function handleClarifySaveChip(tab, target, payload) {
  const addMsg = _CLARIFY_ADDMSG[tab] || _CLARIFY_ADDMSG.inbox;
  applyClarifyChoice(target, payload, tab, addMsg);
}

// ============================================================
// sendChipToChat — відправляє текст чіпа в чат відповідної вкладки
// Використовує fromChip=true для Inbox, а для інших вкладок
// просто вставляє текст і відправляє (без AI-обробки що створює дублі)
// ============================================================
function sendChipToChat(tab, text) {
  const barTab = tab === 'inbox' ? 'inbox' : (tab || 'inbox');
  openChatBar(barTab);

  // evening-чат-бар має textarea id="evening-bar-input" (не evening-chat-input).
  // Решта вкладок — <tab>-chat-input. Inbox — inbox-input.
  const inputId = barTab === 'inbox' ? 'inbox-input'
                 : barTab === 'evening' ? 'evening-bar-input'
                 : barTab + '-chat-input';
  const input = document.getElementById(inputId);
  if (input) {
    input.value = text;
    input.dispatchEvent(new Event('input'));
  }

  // Подвійний rAF гарантує що openChatBar's requestAnimationFrame вже виконався
  requestAnimationFrame(() => requestAnimationFrame(() => {
    if (barTab === 'inbox') { sendToAI(true); } // fromChip=true
    else if (barTab === 'tasks') { sendTasksBarMessage(); }
    else if (barTab === 'notes') { sendNotesBarMessage(); }
    else if (barTab === 'finance') { sendFinanceBarMessage(); }
    else if (barTab === 'health') { sendHealthBarMessage(); }
    else if (barTab === 'projects') { sendProjectsBarMessage(); }
    else if (barTab === 'me') { sendMeChatMessage(); }
    else if (barTab === 'evening') { sendEveningBarMessage(); }
  }));
}

// === WINDOW GLOBALS (HTML handlers only) ===
// owlChipToChat залишається для зворотної сумісності з можливими inline-handlers
window.owlChipToChat = handleChipClick;
