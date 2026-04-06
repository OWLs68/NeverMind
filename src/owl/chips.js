// ============================================================
// chips.js — Центральний модуль чіпів OWL
// Рендер, обробка кліку, fuzzy match, правила промптів
// ============================================================

import { switchTab, showToast } from '../core/nav.js';
import { openChatBar } from '../ai/core.js';
import { escapeHtml } from '../core/utils.js';
import { sendToAI } from '../tabs/inbox.js';
import { sendTasksBarMessage } from '../tabs/habits.js';
import { sendNotesBarMessage } from '../tabs/notes.js';
import { sendFinanceBarMessage } from '../tabs/finance.js';
import { sendEveningBarMessage, sendMeChatMessage } from '../tabs/evening.js';
import { sendHealthBarMessage } from '../tabs/health.js';
import { sendProjectsBarMessage } from '../tabs/projects.js';
import { getTasks, saveTasks, renderTasks } from '../tabs/tasks.js';
import { getHabits, getHabitLog, saveHabitLog, renderHabits, renderProdHabits, getQuitStatus } from '../tabs/habits.js';

// === ВАЛІДНІ ЦІЛІ НАВІГАЦІЇ ===
const VALID_NAV_TARGETS = ['tasks','notes','habits','finance','health','projects','evening','me','inbox'];

// ============================================================
// CHIP_PROMPT_RULES — єдине джерело правил для всіх промптів
// Імпортується в proactive.js, inbox-board.js, ai/core.js
// ============================================================
export const CHIP_PROMPT_RULES = `- chips — варіанти швидкої ВІДПОВІДІ користувача (не заклики до дії!). Масив об'єктів. Кожен має label (до 3 слів) і action:
  • "nav" — перекидає на вкладку (target: tasks|notes|habits|finance|health|projects|evening|me). Використовуй коли юзер має САМ переглянути/обрати.
  • "chat" — відправляє label у чат як повідомлення. ДВА випадки:
    1) Уточнення/діалог: "Пізніше", "Розкажи більше", "Ні, дякую".
    2) ЗВІТ про виконане — ОБОВ'ЯЗКОВО в МИНУЛОМУ ЧАСІ + галочка ✔️ в кінці. Приклади: "Подав декларацію ✔️", "Купив продукти ✔️", "Попрасував одяг ✔️". НЕ пиши інфінітивом ("подати", "купити") і НЕ пиши наказовим способом ("подай", "купи") — чіп це ВІДПОВІДЬ юзера, а не команда.
- Приклад хорошого JSON: {"text":"Маєш 3 відкриті задачі — декларація, одяг, продукти","chips":[{"label":"Подав декларацію ✔️","action":"chat"},{"label":"Купив продукти ✔️","action":"chat"},{"label":"Відкрити задачі","action":"nav","target":"tasks"}]}
- Якщо нічого конкретного — chips: [].`;

export const CHIP_JSON_FORMAT = `{"text":"повідомлення","priority":"critical|important|normal","chips":[{"label":"текст","action":"nav","target":"tasks"},{"label":"текст","action":"chat"}]}`;

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

  const normChips = normalizeChips(chips);
  if (normChips.length === 0 && !options.showSpeak) {
    containerEl.innerHTML = '';
    return;
  }

  const chipsHTML = normChips.map(c => {
    const label = c.label || '';
    const action = c.action === 'nav' ? 'nav' : 'chat';
    const target = c.target || '';
    return `<div class="owl-chip" data-chip-text="${escapeHtml(label)}" data-chip-action="${action}" data-chip-target="${escapeHtml(target)}">${escapeHtml(label)}</div>`;
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
    handleChipClick(tab, text, action, target);
  };
  containerEl.addEventListener('click', containerEl._chipClickHandler);
}

// ============================================================
// handleChipClick — головна логіка обробки кліку на чіп
// ============================================================
export function handleChipClick(tab, text, action, target) {
  // 1. Навігаційний чіп
  if (action === 'nav' && VALID_NAV_TARGETS.includes(target)) {
    switchTab(target);
    showToast('Переходжу до вкладки');
    return;
  }

  // 2. Чіп-звіт з ✔️ — обробити ЛОКАЛЬНО без AI
  if (text.includes('✔️')) {
    const handled = handleCompletionChip(text);
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
function handleCompletionChip(text) {
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
        showToast(`✓ "${task.title}" — виконано`);
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
        showToast(`✓ "${habit.name}" — тримаєшся!`);
        return true;
      } else {
        // Build-звичка — відмітити виконання
        if (!log[today]) log[today] = {};
        log[today][habit.id] = (log[today][habit.id] || 0) + 1;
        saveHabitLog(log);
        renderHabits();
        renderProdHabits();
        showToast(`✓ "${habit.name}" — зараховано`);
        return true;
      }
    }
  }

  return false;
}

// ============================================================
// sendChipToChat — відправляє текст чіпа в чат відповідної вкладки
// Використовує fromChip=true для Inbox, а для інших вкладок
// просто вставляє текст і відправляє (без AI-обробки що створює дублі)
// ============================================================
function sendChipToChat(tab, text) {
  const barTab = tab === 'inbox' ? 'inbox' : (tab || 'inbox');
  openChatBar(barTab);

  const inputId = barTab === 'inbox' ? 'inbox-input' : barTab + '-chat-input';
  const input = document.getElementById(inputId);
  if (input) {
    input.value = text;
    input.dispatchEvent(new Event('input'));
  }

  setTimeout(() => {
    if (barTab === 'inbox') { sendToAI(true); } // fromChip=true
    else if (barTab === 'tasks') { sendTasksBarMessage(); }
    else if (barTab === 'notes') { sendNotesBarMessage(); }
    else if (barTab === 'finance') { sendFinanceBarMessage(); }
    else if (barTab === 'health') { sendHealthBarMessage(); }
    else if (barTab === 'projects') { sendProjectsBarMessage(); }
    else if (barTab === 'me') { sendMeChatMessage(); }
    else if (barTab === 'evening') { sendEveningBarMessage(); }
  }, 100);
}

// === WINDOW GLOBALS (HTML handlers only) ===
// owlChipToChat залишається для зворотної сумісності з можливими inline-handlers
window.owlChipToChat = handleChipClick;
