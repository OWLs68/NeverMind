// ============================================================
// finance.js — Фінанси — транзакції, бюджет, категорії
// Функції: renderFinance, openAddTransaction, openFinBudgetModal, processFinanceAction, sendFinanceBarMessage
// Залежності: core/nav.js, core/utils.js, core/trash.js, ai/core.js
//
// ФАЗА 1 чистки (15.04.2026 3229b): прибрано _finHeroCard, _finInsightCards,
// _finForecast, _finCoachBlock, _refreshFinCoach, _finWeekChart + benchmark
// текст із _finCatsBlock. Попередньо замінить K-01 (сітка категорій + круг)
// у Фазі 2. Див. ROADMAP.md → Блок 2 → Фінанси.
// ============================================================

import { currentTab, showToast } from '../core/nav.js';
import { escapeHtml } from '../core/utils.js';
import { addToTrash, showUndoToast } from '../core/trash.js';
import { getAIContext, getOWLPersonality, openChatBar, safeAgentReply, saveChatMsg } from '../ai/core.js';
import { tryBoardUpdate } from '../owl/proactive.js';
import { getInbox, saveInbox, renderInbox, addInboxChatMsg } from './inbox.js';
import { processUniversalAction } from './habits.js';
import { setupModalSwipeClose } from './tasks.js';
// Фаза 5 (15.04 6v2eR): синк медичних витрат → history картки Здоров'я
import { syncHealthFinanceToHistory } from './health.js';

// === FINANCE ===

let _financeTypingEl = null;

// Storage
export function getFinance() { return JSON.parse(localStorage.getItem('nm_finance') || '[]'); }
export function saveFinance(arr) { localStorage.setItem('nm_finance', JSON.stringify(arr)); window.dispatchEvent(new CustomEvent('nm-data-changed', { detail: 'finance' })); }
export function getFinBudget() { return JSON.parse(localStorage.getItem('nm_finance_budget') || '{"total":0,"categories":{}}'); }
export function saveFinBudget(obj) { localStorage.setItem('nm_finance_budget', JSON.stringify(obj)); }

// ===== Категорії (v2 структура, Фаза 2 K-01, 15.04.2026 3229b) =====
// Об'єкт категорії: { id, name, icon, color, subcategories: [], archived, order }

// SVG-бібліотека іконок (inline, 20 базових). Додавати за потребою.
const FIN_CAT_ICONS = {
  food:          '<path d="M3 11h18M5 11V6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v5M5 11v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8"/>',
  car:           '<path d="M5 17a2 2 0 1 0 4 0M15 17a2 2 0 1 0 4 0M3 17h18M5 17V9l2-4h10l2 4v8M7 13h10"/>',
  subscription:  '<path d="M21 12a9 9 0 1 1-3-6.7M21 3v6h-6"/>',
  heart:         '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.8 1-1a5.5 5.5 0 0 0 0-7.8z"/>',
  home:          '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2h-4v-7h-6v7H5a2 2 0 0 1-2-2z"/>',
  shopping:      '<path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0"/>',
  wallet:        '<path d="M20 12V8H6a2 2 0 0 1 0-4h12v4M20 12v4H6a2 2 0 0 0 0 4h12v-4M20 12h-4"/>',
  gift:          '<polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>',
  refund:        '<polyline points="1 4 1 10 7 10"/><path d="M3.5 15a9 9 0 1 0 2.1-9.4L1 10"/>',
  coffee:        '<path d="M18 8h1a4 4 0 0 1 0 8h-1M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8zM6 1v3M10 1v3M14 1v3"/>',
  cigarette:     '<rect x="2" y="11" width="16" height="4"/><path d="M17 8h1v4h-1zM21 8h1v4h-1z"/>',
  fuel:          '<line x1="3" y1="22" x2="15" y2="22"/><line x1="4" y1="9" x2="14" y2="9"/><path d="M14 22V4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v18M14 13h2a2 2 0 0 1 2 2v2a2 2 0 0 0 2 2 2 2 0 0 0 2-2V9l-3-3"/>',
  sport:         '<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20"/>',
  entertainment: '<polygon points="10 8 16 12 10 16 10 8"/><circle cx="12" cy="12" r="10"/>',
  education:     '<path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>',
  travel:        '<path d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.2.6-.6.5-1.1z"/>',
  phone:         '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.1-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.6a2 2 0 0 1-.5 2.1L8 9.6a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.8.3 1.7.5 2.6.6a2 2 0 0 1 1.7 2z"/>',
  grass:         '<path d="M12 22V8M8 18c-1-2-2-4-2-6a6 6 0 0 1 6-6 6 6 0 0 1 6 6c0 2-1 4-2 6"/>',
  anchor:        '<circle cx="12" cy="5" r="3"/><line x1="12" y1="22" x2="12" y2="8"/><path d="M5 12H2a10 10 0 0 0 20 0h-3"/>',
  briefcase:     '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>',
  other:         '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>',
};

// Повертає SVG рядок за назвою іконки (fallback 'other')
export function finCatIcon(name, color = 'currentColor', size = 24) {
  const p = FIN_CAT_ICONS[name] || FIN_CAT_ICONS.other;
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
}

// Список доступних іконок (для picker'а у режимі редагування — Фаза 2 крок Б)
export const FIN_CAT_ICON_NAMES = Object.keys(FIN_CAT_ICONS);

// Пастельна палітра (БЕЗ фіолетового — Роман не любить)
const FIN_CAT_PALETTE = [
  '#f97316', // оранжевий
  '#f59e0b', // бурштиновий
  '#eab308', // жовтий
  '#84cc16', // лайм
  '#22c55e', // зелений
  '#14b8a6', // бірюзовий
  '#06b6d4', // циан
  '#0ea5e9', // блакитний
  '#3b82f6', // синій
  '#ef4444', // червоний
  '#f43f5e', // малиновий
  '#ec4899', // рожевий
  '#78716c', // кам'яний сірий
  '#a16207', // темний бурштин
];

export function pickRandomCatColor(seed) {
  const idx = seed != null ? (seed % FIN_CAT_PALETTE.length) : Math.floor(Math.random() * FIN_CAT_PALETTE.length);
  return FIN_CAT_PALETTE[idx];
}

// Мапа відомих імен → дефолтна іконка (для міграції і створення дефолтних)
const FIN_DEFAULT_ICONS = {
  'Їжа': 'food', 'Їда': 'food',
  'Транспорт': 'car', 'Авто': 'car',
  'Підписки': 'subscription',
  'Здоровʼя': 'heart', "Здоров'я": 'heart', 'Здоровя': 'heart',
  'Житло': 'home',
  'Покупки': 'shopping',
  'Зарплата': 'wallet',
  'Надходження': 'gift',
  'Повернення': 'refund',
  'Інше': 'other',
  'Курево': 'cigarette', 'Сигарети': 'cigarette',
  'Кафе': 'coffee',
  'Паливо': 'fuel', 'Бензин': 'fuel',
  'Спорт': 'sport', 'Спортзал': 'sport',
  'Розваги': 'entertainment', 'Дозвілля': 'entertainment',
  'Освіта': 'education',
  'Подорожі': 'travel',
  'Зв\'язок': 'phone', 'Звязок': 'phone', 'Інтернет': 'phone',
  'Трава': 'grass',
  'Борги': 'anchor',
  'Робота': 'briefcase',
};

// Базові підкатегорії для дефолтних категорій (використовується при міграції і створенні дефолтів)
const FIN_DEFAULT_SUBCATS = {
  'Їжа':       ['Продукти','Ресторан','Кафе','Доставка','Фастфуд'],
  'Транспорт': ['Паливо','Таксі','Парковка','Громадський','Ремонт авто'],
  'Підписки':  ['Стрімінг','Музика','Хмара','Додатки','Ігри'],
  'Здоровʼя':  ['Аптека','Лікар','Спортзал','Аналізи','Косметика'],
  'Житло':     ['Оренда','Комунальні','Інтернет','Ремонт','Меблі'],
  'Покупки':   ['Одяг','Техніка','Книги','Подарунки','Дім'],
};

function _makeCatObj(name, idx) {
  const safeSlug = name.toLowerCase().replace(/[^\wа-яґєії]/gi, '_').slice(0, 20);
  return {
    id: 'cat_' + safeSlug + '_' + Date.now().toString(36) + idx,
    name,
    icon: FIN_DEFAULT_ICONS[name] || 'other',
    color: pickRandomCatColor(idx),
    subcategories: (FIN_DEFAULT_SUBCATS[name] || []).slice(),
    archived: false,
    order: idx,
  };
}

function _migrateFinCats(saved) {
  // Перший запуск — дефолтний набір об'єктів
  if (!saved) {
    const fresh = {
      expense: ['Їжа','Транспорт','Підписки','Здоровʼя','Житло','Покупки','Інше'].map((n, i) => _makeCatObj(n, i)),
      income:  ['Зарплата','Надходження','Повернення','Інше'].map((n, i) => _makeCatObj(n, i)),
    };
    localStorage.setItem('nm_finance_cats', JSON.stringify(fresh));
    return fresh;
  }
  // Вже нова структура — повертаємо як є
  if (Array.isArray(saved.expense) && saved.expense.length > 0 && typeof saved.expense[0] === 'object' && saved.expense[0].id) {
    return saved;
  }
  // Стара структура (масив рядків) — мігруємо lazy, зберігаємо у localStorage
  const migrated = {
    expense: (saved.expense || []).map((n, i) => typeof n === 'string' ? _makeCatObj(n, i) : n),
    income:  (saved.income  || []).map((n, i) => typeof n === 'string' ? _makeCatObj(n, i) : n),
  };
  localStorage.setItem('nm_finance_cats', JSON.stringify(migrated));
  return migrated;
}

export function getFinCats() {
  const saved = JSON.parse(localStorage.getItem('nm_finance_cats') || 'null');
  return _migrateFinCats(saved);
}
export function saveFinCats(obj) { localStorage.setItem('nm_finance_cats', JSON.stringify(obj)); }

// State
let currentFinTab = 'expense';
let currentFinPeriod = 'month';
let currentFinPeriodOffset = 0; // 0 = поточний, -1 = попередній, +1 = майбутній (Фаза 2 крок Б, свайп місяців)
export function getCurrency() {
  const s = JSON.parse(localStorage.getItem('nm_settings') || '{}');
  return s.currency || '₴';
}

export function setCurrency(symbol) {
  const s = JSON.parse(localStorage.getItem('nm_settings') || '{}');
  s.currency = symbol;
  localStorage.setItem('nm_settings', JSON.stringify(s));
  ['₴','$','€'].forEach(c => {
    const map = {'₴':'uah','$':'usd','€':'eur'};
    const btn = document.getElementById('btn-currency-' + map[c]);
    if (btn) {
      if (c === symbol) btn.classList.add('active');
      else btn.classList.remove('active');
    }
  });
  if (currentTab === 'finance') renderFinance();
}

export function formatMoney(n) {
  return getCurrency() + (Math.abs(n) % 1 === 0 ? Math.abs(n) : Math.abs(n).toFixed(2));
}

// Категорії кольори
const FIN_CAT_COLORS = ['#f97316','#0ea5e9','#a855f7','#22c55e','#ef4444','#eab308','#14b8a6','#f43f5e','#6366f1','#84cc16','#fb923c','#38bdf8'];

function getFinColor(idx) { return FIN_CAT_COLORS[idx % FIN_CAT_COLORS.length]; }

// Фільтр транзакцій по періоду (legacy: тільки from, для зворотної сумісності з getFinanceContext тощо)
export function getFinPeriodRange(period) {
  return _getFinPeriodWindow(period, 0).from;
}

// Фаза 2 крок Б: вікно з offset для свайп-навігації місяців.
// Повертає {from, to, label}. offset=0 — поточний, -1 — попередній, +1 — наступний.
const _MONTH_NAMES = ['Січень','Лютий','Березень','Квітень','Травень','Червень','Липень','Серпень','Вересень','Жовтень','Листопад','Грудень'];
function _getFinPeriodWindow(period, offset) {
  const now = new Date();
  let from, to, label;
  if (period === 'week') {
    // Поточний тиждень Пн-Нд + offset тижнів
    const dayOfWeek = now.getDay() || 7; // 1-7 (1=Пн, 7=Нд)
    const monday = new Date(now);
    monday.setDate(now.getDate() - (dayOfWeek - 1) + (offset * 7));
    monday.setHours(0,0,0,0);
    const nextMonday = new Date(monday);
    nextMonday.setDate(monday.getDate() + 7);
    from = monday.getTime();
    to = nextMonday.getTime();
    if (offset === 0) label = 'Цей тиждень';
    else if (offset === -1) label = 'Минулий тиждень';
    else if (offset === 1) label = 'Наступний тиждень';
    else label = offset < 0 ? `${-offset} тижнів тому` : `+${offset} тижнів`;
  } else if (period === 'month') {
    const baseMonth = now.getMonth() + offset;
    const start = new Date(now.getFullYear(), baseMonth, 1);
    const end   = new Date(now.getFullYear(), baseMonth + 1, 1);
    from = start.getTime();
    to = end.getTime();
    label = `${_MONTH_NAMES[start.getMonth()]} ${start.getFullYear()}`;
  } else { // 3months
    // Поточний 3-місячний блок: останні 3 місяці включаючи поточний (offset=0)
    const startMonth = now.getMonth() - 2 + (offset * 3);
    const start = new Date(now.getFullYear(), startMonth, 1);
    const end   = new Date(now.getFullYear(), startMonth + 3, 1);
    from = start.getTime();
    to = end.getTime();
    if (offset === 0) label = 'Останні 3 місяці';
    else if (offset === -1) label = 'Попередні 3 місяці';
    else label = offset < 0 ? `${-offset * 3} місяців тому` : `+${offset * 3} місяців`;
  }
  return { from, to, label };
}

function getFilteredTransactions(type, period) {
  const from = getFinPeriodRange(period);
  return getFinance().filter(t => t.type === type && t.ts >= from);
}


// Перемикачі — залишаємо для сумісності, але таб-перемикач прихований новим дизайном
function switchFinTab(tab) {
  currentFinTab = tab;
  renderFinance();
}

function setFinPeriod(period) {
  currentFinPeriod = period;
  currentFinPeriodOffset = 0; // ресет offset при зміні типу періоду
  ['week','month','3months'].forEach(p => {
    const el = document.getElementById('fin-period-' + p);
    if (!el) return;
    const active = p === period;
    el.style.borderColor = active ? '#c2410c' : 'rgba(194,65,12,0.2)';
    el.style.background = active ? 'rgba(194,65,12,0.1)' : 'rgba(194,65,12,0.05)';
    el.style.color = active ? '#c2410c' : 'rgba(30,16,64,0.5)';
  });
  renderFinance();
}

// Фаза 2 крок Б: навігація стрілками (альтернатива свайпу)
function shiftFinPeriod(delta) {
  currentFinPeriodOffset += delta;
  renderFinance();
}

// === FINANCE v2 — новий дизайн ===

function _hideOldFinBlocks() {
  ['fin-summary-block','fin-cats-block','fin-cat-budgets-block'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  // Старий таб-перемикач Витрати/Доходи/Баланс
  const expTab = document.getElementById('fin-tab-expense');
  if (expTab && expTab.parentElement) expTab.parentElement.style.display = 'none';
  // Старий графік-блок — ховаємо тільки безпосереднього батька fin-chart, НЕ дідуся
  const chartEl = document.getElementById('fin-chart');
  if (chartEl && chartEl.parentElement) chartEl.parentElement.style.display = 'none';
  // Старий блок транзакцій
  const txEl = document.getElementById('fin-transactions');
  if (txEl && txEl.parentElement) txEl.parentElement.style.display = 'none';
  // Старий перемикач періоду
  const periodEl = document.getElementById('fin-period-week');
  if (periodEl && periodEl.parentElement) periodEl.parentElement.style.display = 'none';
}

// Головний рендер
export function renderFinance() {
  _hideOldFinBlocks();

  let wrap = document.getElementById('fin-v2-wrap');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.id = 'fin-v2-wrap';
    const scroll = document.getElementById('fin-scroll');
    if (scroll) {
      scroll.insertBefore(wrap, scroll.firstChild);
    } else {
      const anchor = document.getElementById('fin-summary-block');
      if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(wrap, anchor);
    }
  }

  // Фаза 2 крок Б: вікно з offset (свайп навігація місяців)
  const win = _getFinPeriodWindow(currentFinPeriod, currentFinPeriodOffset);
  const allTxs = getFinance().filter(t => t.ts >= win.from && t.ts < win.to);

  // Сітка категорій рендериться завжди (навіть якщо порожньо) — щоб юзер міг тапнути категорію
  // і додати першу транзакцію + щоб свайп працював коли немає даних у періоді.
  wrap.innerHTML =
    _finCatsGrid(allTxs, win) +
    (allTxs.length > 0 ? _finTxsBlock(allTxs) : _finEmptyTxsHint());

  _attachFinSwipe();
}

function _finEmptyTxsHint() {
  return `<div style="background:rgba(255,255,255,0.5);border:1.5px dashed rgba(30,16,64,0.12);border-radius:16px;padding:16px;text-align:center;margin-bottom:12px">
    <div style="font-size:13px;color:rgba(30,16,64,0.45);font-weight:600">У цьому періоді транзакцій немає</div>
    <div style="font-size:11px;color:rgba(30,16,64,0.35);font-weight:500;margin-top:4px">Тапни категорію щоб додати або свайпни ←→ для іншого періоду</div>
  </div>`;
}

// Фаза 2 крок Б: touch-обробники для свайп-гортання періодів
let _finSwipeAttached = false;
function _attachFinSwipe() {
  if (_finSwipeAttached) return;
  const wrap = document.getElementById('fin-v2-wrap');
  if (!wrap) return;
  let startX = 0, startY = 0, onGrid = false;
  wrap.addEventListener('touchstart', (e) => {
    onGrid = !!e.target.closest('#fin-cats-grid-wrap');
    if (!onGrid) return;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
  }, { passive: true });
  wrap.addEventListener('touchend', (e) => {
    if (!onGrid) return;
    onGrid = false;
    const dx = e.changedTouches[0].clientX - startX;
    const dy = e.changedTouches[0].clientY - startY;
    // Поріг 50px по X, |dx| > |dy| × 1.2 — щоб не плутати з вертикальним скролом
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
    if (dx < 0) currentFinPeriodOffset++; // свайп вліво → майбутнє
    else currentFinPeriodOffset--;        // свайп вправо → минуле
    renderFinance();
  }, { passive: true });
  _finSwipeAttached = true;
}

// Сітка категорій з кругом-Hero посередині.
// Layout: 4 колонки × 4 ряди. Круг = grid-item що займає колонки 2-3 і ряди 2-3 (центр).
// Інші категорії автоматично обтікають круг (grid auto-flow).
// Помістяться 8 категорій навколо круга (4 у ряді 1 + 1+1 у рядах 2-3 + 4 у ряді 4 = 12)
// Зачекайте: 4 + 2 + 2 + 4 = 12. Правильно. Додаткові — у overflow-ряди знизу.
function _finCatsGrid(allTxs, win) {
  const cats = getFinCats();
  const isExpense = currentFinTab === 'expense';
  const catList = (isExpense ? cats.expense : cats.income).filter(c => !c.archived);
  const txs = allTxs.filter(t => t.type === (isExpense ? 'expense' : 'income'));
  const totalSum = txs.reduce((s, t) => s + t.amount, 0);
  const periodLabel = win?.label || '';

  // Сума по кожній категорії
  const catMap = {};
  txs.forEach(t => { catMap[t.category] = (catMap[t.category] || 0) + t.amount; });

  // Сортуємо: за полем .order (з міграції)
  const sorted = [...catList].sort((a, b) => (a.order || 0) - (b.order || 0));

  // Перші 12 категорій ідуть у grid-сітку 4×4 з кругом 2×2 у центрі.
  // Решта — у overflow-ряд знизу.
  const inGrid = sorted.slice(0, 12);
  const overflow = sorted.slice(12);

  const renderCell = (cat) => {
    const sum = catMap[cat.name] || 0;
    const sumStr = sum > 0 ? formatMoney(sum) : '0 ' + getCurrency();
    const sumCol = sum > 0 ? cat.color : 'rgba(30,16,64,0.25)';
    return `<div onclick="openAddTransaction({category: '${escapeHtml(cat.name)}', type: '${isExpense ? 'expense' : 'income'}'})" style="display:flex;flex-direction:column;align-items:center;cursor:pointer;padding:4px 0;min-width:0">
      <div style="font-size:11px;font-weight:600;color:rgba(30,16,64,0.55);margin-bottom:4px;text-align:center;max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(cat.name)}</div>
      <div style="width:48px;height:48px;border-radius:50%;background:${cat.color}20;display:flex;align-items:center;justify-content:center">
        ${finCatIcon(cat.icon, cat.color, 22)}
      </div>
      <div style="font-size:11px;font-weight:700;color:${sumCol};margin-top:4px">${sumStr}</div>
    </div>`;
  };

  const gridCells = inGrid.map(renderCell).join('');
  const overflowCells = overflow.map(renderCell).join('');

  // Центральний круг-Hero (grid-item, займає колонки 2-3 і ряди 2-3)
  const heroLabel = isExpense ? 'Витрати' : 'Доходи';
  const heroCol = isExpense ? '#c2410c' : '#16a34a';
  const heroCircle = `<div onclick="toggleFinTabType()" style="grid-column:2/4;grid-row:2/4;display:flex;flex-direction:column;align-items:center;justify-content:center;border-radius:50%;background:rgba(255,255,255,0.85);border:3px solid ${heroCol}22;cursor:pointer;box-shadow:0 4px 16px rgba(30,16,64,0.06);user-select:none;aspect-ratio:1;align-self:center;justify-self:center;width:100%;max-width:170px">
    <div style="font-size:11px;font-weight:700;color:rgba(30,16,64,0.4);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px">${heroLabel}</div>
    <div style="font-size:24px;font-weight:900;color:${heroCol};line-height:1">${formatMoney(totalSum)}</div>
  </div>`;

  // Хедер блоку: стрілки навігації + лейбл періоду (Фаза 2 крок Б)
  const isCurrent = currentFinPeriodOffset === 0;
  const headerHtml = `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;user-select:none">
    <button onclick="shiftFinPeriod(-1)" aria-label="Попередній період" style="width:32px;height:32px;border-radius:50%;border:none;background:rgba(30,16,64,0.05);color:rgba(30,16,64,0.55);font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;font-family:inherit">‹</button>
    <div style="display:flex;flex-direction:column;align-items:center;gap:2px;flex:1">
      <div style="font-size:14px;font-weight:800;color:#1e1040">${escapeHtml(periodLabel)}</div>
      ${!isCurrent ? `<div onclick="shiftFinPeriod(${-currentFinPeriodOffset})" style="font-size:10px;font-weight:700;color:#c2410c;cursor:pointer;text-transform:uppercase;letter-spacing:0.06em">↺ до сьогодні</div>` : `<div style="font-size:10px;font-weight:600;color:rgba(30,16,64,0.3);text-transform:uppercase;letter-spacing:0.06em">свайп ←→ для навігації</div>`}
    </div>
    <button onclick="shiftFinPeriod(1)" aria-label="Наступний період" style="width:32px;height:32px;border-radius:50%;border:none;background:rgba(30,16,64,0.05);color:rgba(30,16,64,0.55);font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;font-family:inherit">›</button>
  </div>`;

  // Круг ПЕРШИМ у DOM щоб grid знав про зайняті 2×2 і обтікав ним.
  // grid-auto-flow:dense додатково дозволяє заповнити дірки якщо є.
  return `<div id="fin-cats-grid-wrap" class="card-glass-blur" style="padding:14px;margin-bottom:12px">
    ${headerHtml}
    <div style="display:grid;grid-template-columns:repeat(4,1fr);grid-template-rows:repeat(4,1fr);gap:10px;grid-auto-flow:row dense">
      ${heroCircle}
      ${gridCells}
    </div>
    ${overflow.length > 0 ? `<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:14px">${overflowCells}</div>` : ''}
  </div>`;
}

// Перемикач Витрати ⇄ Доходи (тап на круг)
function toggleFinTabType() {
  currentFinTab = currentFinTab === 'expense' ? 'income' : 'expense';
  renderFinance();
}

function _finEmptyState() {
  return `<div style="background:rgba(255,255,255,0.72);backdrop-filter:blur(16px);border:1.5px solid rgba(255,255,255,0.75);border-radius:20px;padding:28px 20px;text-align:center;margin-bottom:12px">
    <div style="width:48px;height:48px;border-radius:16px;background:rgba(194,65,12,0.1);display:flex;align-items:center;justify-content:center;margin:0 auto 12px">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#c2410c" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 6v2m0 8v2M9.5 9.5A2.5 2.5 0 0 1 12 8h.5a2.5 2.5 0 0 1 0 5h-1a2.5 2.5 0 0 0 0 5H12a2.5 2.5 0 0 0 2.5-1.5"/></svg>
    </div>
    <div style="font-size:16px;font-weight:800;color:#1e1040;margin-bottom:6px">Поки порожньо</div>
    <div style="font-size:14px;color:rgba(30,16,64,0.45);line-height:1.5;margin-bottom:16px">Додай перші транзакції через Inbox або кнопку нижче</div>
    <button onclick="openAddTransaction()" style="background:linear-gradient(135deg,#f97316,#c2410c);color:white;border:none;border-radius:14px;padding:12px 24px;font-size:15px;font-weight:700;cursor:pointer;font-family:inherit">+ Додати транзакцію</button>
  </div>`;
}

function _finTxsBlock(allTxs) {
  const sorted = [...allTxs].sort((a,b) => b.ts-a.ts).slice(0, 8);
  const rows = sorted.map(t => {
    const isExp = t.type === 'expense';
    const dateStr = new Date(t.ts).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' });
    return `<div class="tx-row" onclick="openEditTransaction(${t.id})">
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:700;color:#1e1040">${escapeHtml(t.category)}</div>
        ${t.comment ? `<div style="font-size:11px;color:rgba(30,16,64,0.4);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(t.comment)}</div>` : ''}
      </div>
      <div style="text-align:right;flex-shrink:0">
        <div style="font-size:14px;font-weight:800;color:${isExp?'#c2410c':'#16a34a'}">${isExp?'-':'+'}${formatMoney(t.amount)}</div>
        <div style="font-size:10px;color:rgba(30,16,64,0.35)">${dateStr}</div>
      </div>
    </div>`;
  }).join('');

  const moreBtn = allTxs.length > 8
    ? `<div onclick="openAllTransactions()" style="text-align:center;margin-top:10px;font-size:13px;font-weight:700;color:#c2410c;cursor:pointer">Всі транзакції (${allTxs.length}) <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#c2410c" stroke-width="2.5" stroke-linecap="round" style="vertical-align:middle"><polyline points="9 18 15 12 9 6"/></svg></div>`
    : '';

  return `<div class="card-glass-blur">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
      <div class="fin-section-label">Останні транзакції</div>
      <button onclick="openAddTransaction()" style="background:rgba(194,65,12,0.08);border:none;border-radius:8px;padding:4px 10px;font-size:12px;font-weight:700;color:#c2410c;cursor:pointer;font-family:inherit">+ додати</button>
    </div>
    ${rows || '<div style="font-size:13px;color:rgba(30,16,64,0.3);text-align:center;padding:8px">Немає транзакцій за цей період</div>'}
    ${moreBtn}
  </div>`;
}

function openAllTransactions() {
  const from = getFinPeriodRange(currentFinPeriod);
  const allTxs = getFinance().filter(t => t.ts >= from).sort((a,b) => b.ts-a.ts);
  const existing = document.getElementById('fin-all-txs-modal');
  if (existing) existing.remove();
  const modal = document.createElement('div');
  modal.id = 'fin-all-txs-modal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:500;display:flex;align-items:flex-end;justify-content:center';
  const rows = allTxs.map(t => {
    const isExp = t.type === 'expense';
    const dateStr = new Date(t.ts).toLocaleDateString('uk-UA', { day:'numeric', month:'short' });
    return `<div class="tx-row" onclick="document.getElementById('fin-all-txs-modal').remove();openEditTransaction(${t.id})">
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:700;color:#1e1040">${escapeHtml(t.category)}</div>
        ${t.comment ? `<div style="font-size:11px;color:rgba(30,16,64,0.4)">${escapeHtml(t.comment)}</div>` : ''}
      </div>
      <div style="text-align:right;flex-shrink:0">
        <div style="font-size:14px;font-weight:800;color:${isExp?'#c2410c':'#16a34a'}">${isExp?'-':'+'}${formatMoney(t.amount)}</div>
        <div style="font-size:10px;color:rgba(30,16,64,0.35)">${dateStr}</div>
      </div>
    </div>`;
  }).join('');
  modal.innerHTML = `
    <div onclick="document.getElementById('fin-all-txs-modal').remove()" class="modal-backdrop"></div>
    <div style="position:relative;width:100%;max-width:480px;background:rgba(255,255,255,0.95);backdrop-filter:blur(24px);border-radius:24px;margin:0 16px 16px;z-index:1;padding:16px 16px calc(env(safe-area-inset-bottom)+16px);max-height:80vh;overflow-y:auto;box-sizing:border-box">
      <div class="modal-handle"></div>
      <div style="font-size:16px;font-weight:800;color:#1e1040;margin-bottom:12px">Всі транзакції (${allTxs.length})</div>
      ${rows || '<div style="font-size:14px;color:rgba(30,16,64,0.3);text-align:center;padding:16px">Немає транзакцій</div>'}
    </div>`;
  document.body.appendChild(modal);
}

// Додавання транзакції вручну
let _finEditId = null;

function openAddTransaction(prefill = {}) {
  _finEditId = null;
  const cats = getFinCats();
  const type = prefill.type || (currentFinTab === 'income' ? 'income' : 'expense');
  _showTransactionModal({ type, amount: prefill.amount || '', category: prefill.category || '', comment: prefill.comment || '' });
}

function openEditTransaction(id) {
  const txs = getFinance();
  const t = txs.find(x => x.id === id);
  if (!t) return;
  _finEditId = id;
  _showTransactionModal(t);
}

function _showTransactionModal(data) {
  const cats = getFinCats();
  const isExpense = data.type !== 'income';
  const catList = isExpense ? cats.expense : cats.income;

  const existing = document.getElementById('fin-tx-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'fin-tx-modal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:500;display:flex;align-items:flex-end;justify-content:center';
  modal.innerHTML = `
    <div onclick="closeFinTxModal()" class="modal-backdrop"></div>
    <div style="position:relative;width:100%;max-width:480px;background:rgba(255,255,255,0.88);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);border-radius:24px;margin:0 16px 16px;z-index:1;border:1.5px solid rgba(255,255,255,0.6);padding:16px 20px calc(env(safe-area-inset-bottom)+24px);box-sizing:border-box">
      <div class="modal-handle"></div>
      <div class="modal-title">${_finEditId ? 'Редагувати' : 'Нова'} ${isExpense ? 'витрата' : 'дохід'}</div>

      <!-- Тип -->
      <div style="display:flex;gap:6px;margin-bottom:12px">
        <button id="fntx-btn-expense" onclick="toggleFinTxType('expense')" style="flex:1;padding:8px;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;border:1.5px solid ${isExpense ? '#c2410c' : 'rgba(30,16,64,0.1)'};background:${isExpense ? 'rgba(194,65,12,0.08)' : 'white'};color:${isExpense ? '#c2410c' : 'rgba(30,16,64,0.4)'}">Витрата</button>
        <button id="fntx-btn-income" onclick="toggleFinTxType('income')" style="flex:1;padding:8px;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;border:1.5px solid ${!isExpense ? '#16a34a' : 'rgba(30,16,64,0.1)'};background:${!isExpense ? 'rgba(22,163,74,0.08)' : 'white'};color:${!isExpense ? '#16a34a' : 'rgba(30,16,64,0.4)'}">Дохід</button>
      </div>

      <!-- Сума -->
      <input id="fntx-amount" type="number" placeholder="Сума (€)" inputmode="decimal"
        style="width:100%;border:1.5px solid rgba(30,16,64,0.12);border-radius:12px;padding:12px 14px;font-size:20px;font-weight:700;font-family:inherit;color:#1e1040;outline:none;margin-bottom:10px;box-sizing:border-box"
        value="${data.amount || ''}">

      <!-- Категорія -->
      <div id="fntx-cats-wrap" style="margin-bottom:10px">
        <div style="font-size:12px;font-weight:700;color:rgba(30,16,64,0.4);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px">Категорія</div>
        <div id="fntx-cats" style="display:flex;flex-wrap:wrap;gap:6px">
          ${catList.filter(c => !c.archived).map(c => {
            const active = c.name === data.category;
            return `<button onclick="selectFinTxCat('${escapeHtml(c.name)}')" id="fntx-cat-${escapeHtml(c.name)}" style="padding:6px 12px;border-radius:20px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;border:1.5px solid ${active ? '#c2410c' : 'rgba(30,16,64,0.1)'};background:${active ? 'rgba(194,65,12,0.08)' : 'white'};color:${active ? '#c2410c' : 'rgba(30,16,64,0.5)'}">${escapeHtml(c.name)}</button>`;
          }).join('')}
        </div>
        <input id="fntx-cat-custom" type="text" placeholder="або своя категорія…"
          style="width:100%;border:1.5px solid rgba(30,16,64,0.1);border-radius:10px;padding:8px 12px;font-size:14px;font-family:inherit;color:#1e1040;outline:none;margin-top:8px;box-sizing:border-box"
          value="${catList.some(c => c.name === data.category) ? '' : (data.category || '')}">
      </div>

      <!-- Коментар -->
      <input id="fntx-comment" type="text" placeholder="Коментар (необовʼязково)"
        style="width:100%;border:1.5px solid rgba(30,16,64,0.1);border-radius:12px;padding:10px 14px;font-size:15px;font-family:inherit;color:#1e1040;outline:none;margin-bottom:14px;box-sizing:border-box"
        value="${data.comment || ''}">

      <div style="display:flex;gap:8px">
        ${_finEditId ? `<button onclick="deleteFinTransaction()" style="padding:13px 16px;border-radius:12px;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);font-size:15px;font-weight:700;color:#dc2626;cursor:pointer;font-family:inherit">🗑</button>` : ''}
        <button onclick="closeFinTxModal()" class="btn-cancel">Скасувати</button>
        <button onclick="saveFinTransaction()" class="btn-save-primary">Зберегти</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  setupModalSwipeClose(modal.querySelector('div:last-child'), closeFinTxModal);
  // Якщо категорія вже вибрана — показуємо підкатегорії
  if (data.category && catList.some(c => c.name === data.category)) {
    setTimeout(() => selectFinTxCat(data.category), 50);
  }
  setTimeout(() => { document.getElementById('fntx-amount')?.focus(); }, 300);
  _finTxCurrentType = isExpense ? 'expense' : 'income';
  _finTxSelectedCat = data.category || '';
}

let _finTxCurrentType = 'expense';
let _finTxSelectedCat = '';

function toggleFinTxType(type) {
  _finTxCurrentType = type;
  const isExpense = type === 'expense';
  const cats = getFinCats();
  const catList = isExpense ? cats.expense : cats.income;

  const btnE = document.getElementById('fntx-btn-expense');
  const btnI = document.getElementById('fntx-btn-income');
  if (btnE) { btnE.style.borderColor = isExpense ? '#c2410c' : 'rgba(30,16,64,0.1)'; btnE.style.background = isExpense ? 'rgba(194,65,12,0.08)' : 'white'; btnE.style.color = isExpense ? '#c2410c' : 'rgba(30,16,64,0.4)'; }
  if (btnI) { btnI.style.borderColor = !isExpense ? '#16a34a' : 'rgba(30,16,64,0.1)'; btnI.style.background = !isExpense ? 'rgba(22,163,74,0.08)' : 'white'; btnI.style.color = !isExpense ? '#16a34a' : 'rgba(30,16,64,0.4)'; }

  _finTxSelectedCat = '';
  const catsEl = document.getElementById('fntx-cats');
  if (catsEl) catsEl.innerHTML = catList.filter(c => !c.archived).map(c =>
    `<button onclick="selectFinTxCat('${escapeHtml(c.name)}')" id="fntx-cat-${escapeHtml(c.name)}" style="padding:6px 12px;border-radius:20px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;border:1.5px solid rgba(30,16,64,0.1);background:white;color:rgba(30,16,64,0.5)">${escapeHtml(c.name)}</button>`
  ).join('');
}

function selectFinTxCat(cat) {
  // Якщо це підкатегорія — просто зберігаємо
  const cats = getFinCats();
  const catList = _finTxCurrentType === 'expense' ? cats.expense : cats.income;
  const matchedCat = catList.find(c => c.name === cat);
  const isSubcat = !matchedCat;

  if (isSubcat) {
    _finTxSelectedCat = cat;
    // Підсвічуємо підкатегорію
    const subEl = document.getElementById('fntx-subcats');
    if (subEl) subEl.querySelectorAll('button').forEach(btn => {
      const active = btn.textContent === cat;
      btn.style.borderColor = active ? '#c2410c' : 'rgba(30,16,64,0.08)';
      btn.style.background = active ? 'rgba(194,65,12,0.08)' : 'rgba(30,16,64,0.03)';
      btn.style.color = active ? '#c2410c' : 'rgba(30,16,64,0.45)';
    });
    const customInput = document.getElementById('fntx-cat-custom');
    if (customInput) customInput.value = '';
    return;
  }

  _finTxSelectedCat = cat;

  // Підсвічуємо головну категорію
  const catsEl = document.getElementById('fntx-cats');
  if (catsEl) catsEl.querySelectorAll('button').forEach(btn => {
    const active = btn.textContent === cat;
    btn.style.borderColor = active ? '#c2410c' : 'rgba(30,16,64,0.1)';
    btn.style.background = active ? 'rgba(194,65,12,0.08)' : 'white';
    btn.style.color = active ? '#c2410c' : 'rgba(30,16,64,0.5)';
  });

  // Показуємо підкатегорії якщо є (з самої категорії-об'єкта, v2 структура)
  const subcats = matchedCat?.subcategories || [];
  let subEl = document.getElementById('fntx-subcats');
  if (subcats.length > 0) {
    if (!subEl) {
      subEl = document.createElement('div');
      subEl.id = 'fntx-subcats';
      subEl.style.cssText = 'display:flex;flex-wrap:wrap;gap:5px;margin-top:8px;padding-top:8px;border-top:1px solid rgba(30,16,64,0.06)';
      const catsWrapper = document.getElementById('fntx-cats-wrap');
      if (catsWrapper) catsWrapper.appendChild(subEl);
      else catsEl?.parentNode?.insertBefore(subEl, catsEl?.nextSibling);
    }
    subEl.innerHTML = subcats.map(s =>
      `<button onclick="selectFinTxCat('${escapeHtml(s)}')" style="padding:5px 11px;border-radius:16px;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;border:1.5px solid rgba(30,16,64,0.08);background:rgba(30,16,64,0.03);color:rgba(30,16,64,0.45);transition:all 0.15s">${escapeHtml(s)}</button>`
    ).join('');
    subEl.style.display = 'flex';
  } else if (subEl) {
    subEl.style.display = 'none';
  }

  const customInput = document.getElementById('fntx-cat-custom');
  if (customInput) customInput.value = '';
}

function saveFinTransaction() {
  const amountRaw = parseFloat(document.getElementById('fntx-amount')?.value || '0');
  if (!amountRaw || amountRaw <= 0) { showToast('Введи суму'); return; }

  const customCat = document.getElementById('fntx-cat-custom')?.value.trim();
  const category = customCat || _finTxSelectedCat;
  if (!category) { showToast('Вибери категорію'); return; }

  const comment = document.getElementById('fntx-comment')?.value.trim() || '';
  const txs = getFinance();

  // Перевіряємо чи нова категорія
  const cats = getFinCats();
  const catList = _finTxCurrentType === 'expense' ? cats.expense : cats.income;
  if (customCat && !catList.includes(customCat)) {
    cats[_finTxCurrentType].push(customCat);
    saveFinCats(cats);
  }

  if (_finEditId) {
    const idx = txs.findIndex(x => x.id === _finEditId);
    if (idx !== -1) txs[idx] = { ...txs[idx], amount: amountRaw, category, comment, type: _finTxCurrentType };
  } else {
    txs.unshift({ id: Date.now(), type: _finTxCurrentType, amount: amountRaw, category, comment, ts: Date.now() });
  }
  saveFinance(txs);
  closeFinTxModal();
  renderFinance();
  showToast(_finEditId ? '✓ Оновлено' : `✓ ${_finTxCurrentType === 'expense' ? 'Витрату' : 'Дохід'} збережено`);
  _finEditId = null;
  try { localStorage.setItem('nm_owl_tab_ts_finance', '0'); tryBoardUpdate('finance'); } catch(e) {}
}

function deleteFinTransaction() {
  if (!_finEditId) return;
  const item = getFinance().find(t => t.id === _finEditId);
  saveFinance(getFinance().filter(t => t.id !== _finEditId));
  closeFinTxModal();
  renderFinance();
  try { localStorage.setItem('nm_owl_tab_ts_finance', '0'); tryBoardUpdate('finance'); } catch(e) {}
  if (item) showUndoToast('Транзакцію видалено', () => {
    const txs = getFinance(); txs.unshift(item); saveFinance(txs); renderFinance();
    try { localStorage.setItem('nm_owl_tab_ts_finance', '0'); tryBoardUpdate('finance'); } catch(e) {}
  });
  _finEditId = null;
}

function closeFinTxModal() {
  document.getElementById('fin-tx-modal')?.remove();
}

// Модал бюджету
function openFinBudgetModal() {
  const budget = getFinBudget();
  const cats = getFinCats();

  const existing = document.getElementById('fin-budget-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'fin-budget-modal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:500;display:flex;align-items:flex-end;justify-content:center';
  modal.innerHTML = `
    <div onclick="closeFinBudgetModal()" class="modal-backdrop"></div>
    <div style="position:relative;width:100%;max-width:480px;background:rgba(255,255,255,0.88);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);border-radius:24px;margin:0 16px 16px;z-index:1;border:1.5px solid rgba(255,255,255,0.6);padding:16px 20px calc(env(safe-area-inset-bottom)+24px);max-height:80vh;overflow-y:auto;box-sizing:border-box">
      <div class="modal-handle"></div>
      <div class="modal-title">Бюджет на місяць</div>

      <div style="font-size:12px;font-weight:700;color:rgba(30,16,64,0.4);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px">Загальний ліміт</div>
      <input id="finbdg-total" type="number" placeholder="€ 0 — без ліміту" inputmode="decimal"
        style="width:100%;border:1.5px solid rgba(30,16,64,0.12);border-radius:12px;padding:11px 14px;font-size:17px;font-weight:700;font-family:inherit;color:#1e1040;outline:none;margin-bottom:14px;box-sizing:border-box"
        value="${budget.total || ''}">

      <div style="font-size:12px;font-weight:700;color:rgba(30,16,64,0.4);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px">По категоріях</div>
      <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px">
        ${cats.expense.filter(c => !c.archived).map(cat => `
          <div style="display:flex;align-items:center;gap:10px">
            <div style="font-size:14px;font-weight:600;color:#1e1040;flex:1">${escapeHtml(cat.name)}</div>
            <input type="number" id="finbdg-cat-${escapeHtml(cat.name)}" placeholder="без ліміту" inputmode="decimal"
              style="width:100px;border:1.5px solid rgba(30,16,64,0.1);border-radius:10px;padding:7px 10px;font-size:14px;font-family:inherit;color:#1e1040;outline:none;text-align:right"
              value="${budget.categories?.[cat.name] || ''}">
          </div>`).join('')}
      </div>

      <div style="display:flex;gap:8px">
        <button onclick="closeFinBudgetModal()" class="btn-cancel">Скасувати</button>
        <button onclick="saveFinBudgetFromModal()" class="btn-save-primary">Зберегти</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
}

function saveFinBudgetFromModal() {
  const cats = getFinCats();
  const total = parseFloat(document.getElementById('finbdg-total')?.value || '0') || 0;
  const categories = {};
  cats.expense.forEach(cat => {
    const val = parseFloat(document.getElementById(`finbdg-cat-${cat.name}`)?.value || '0') || 0;
    if (val > 0) categories[cat.name] = val;
  });
  saveFinBudget({ total, categories });
  closeFinBudgetModal();
  renderFinance();
  showToast('✓ Бюджет збережено');
  try { localStorage.setItem('nm_owl_tab_ts_finance', '0'); tryBoardUpdate('finance'); } catch(e) {}
}

function closeFinBudgetModal() {
  document.getElementById('fin-budget-modal')?.remove();
}

// Визначення дати транзакції: AI date → "вчора/позавчора" → Date.now()
export function _resolveFinanceDate(aiDate, text) {
  // 1. AI повернув дату у форматі YYYY-MM-DD
  if (aiDate) {
    const d = new Date(aiDate + 'T12:00:00');
    if (!isNaN(d.getTime())) return d.getTime();
  }
  // 2. Fallback: шукаємо "вчора/позавчора" у тексті
  const lower = (text || '').toLowerCase();
  const now = new Date();
  if (/\bвчора\b/.test(lower)) {
    now.setDate(now.getDate() - 1);
    now.setHours(20, 0, 0, 0);
    return now.getTime();
  }
  if (/\bпозавчора\b/.test(lower)) {
    now.setDate(now.getDate() - 2);
    now.setHours(20, 0, 0, 0);
    return now.getTime();
  }
  // 3. Нічого не знайшли — поточний час
  return Date.now();
}

// Обробка фінансів з Inbox
export function processFinanceAction(parsed, originalText) {
  const cats = getFinCats();
  const type = parsed.fin_type || 'expense';
  const amount = parseFloat(parsed.amount) || 0;
  const category = parsed.category || (type === 'expense' ? 'Інше' : 'Інше');
  const comment = parsed.comment || originalText;

  if (!amount || amount <= 0) {
    addInboxChatMsg('agent', 'Не вдалось розпізнати суму. Спробуй написати чіткіше: "витратив 50 на їжу"');
    return;
  }

  // Нова категорія — зберігаємо без запиту (агент вже підтвердив)
  const catList = type === 'expense' ? cats.expense : cats.income;
  if (!catList.includes(category)) {
    catList.push(category);
    saveFinCats(cats);
  }

  // Визначення дати: AI date → fallback "вчора/позавчора" → поточний час
  const ts = _resolveFinanceDate(parsed.date, originalText);

  const txs = getFinance();
  txs.unshift({ id: Date.now(), type, amount, category, comment, ts });
  saveFinance(txs);

  // Зберігаємо в Inbox для історії
  const items = getInbox();
  items.unshift({ id: Date.now(), text: originalText, category: 'finance', ts, processed: true });
  saveInbox(items);
  renderInbox();

  if (currentTab === 'finance') renderFinance();

  // Фаза 5 (15.04 6v2eR): синк медичних витрат → history активної картки Здоров'я
  // (якщо category="Здоров'я" або comment згадує аптека/ліки/лікар/препарат/аналіз)
  if (type === 'expense') {
    try { syncHealthFinanceToHistory(amount, category, comment); } catch (e) {}
  }

  const sign = type === 'expense' ? '-' : '+';
  const typeLabel = type === 'expense' ? 'витрату' : 'дохід';
  addInboxChatMsg('agent', `${sign}${formatMoney(amount)} · ${category}${parsed.fin_comment ? ' — ' + parsed.fin_comment : ''}`);

  // Попередження про перевищення бюджету
  checkFinBudgetWarning(type, category, amount);
}

function checkFinBudgetWarning(type, category, amount) {
  if (type !== 'expense') return;
  const budget = getFinBudget();
  const from = getFinPeriodRange('month');
  const txs = getFinance().filter(t => t.type === 'expense' && t.ts >= from);
  const totalSpent = txs.reduce((s, t) => s + t.amount, 0);

  // Загальний ліміт
  if (budget.total > 0) {
    const pct = totalSpent / budget.total;
    if (pct >= 1) addInboxChatMsg('agent', `⚠️ Загальний бюджет на місяць перевищено. Витрачено ${formatMoney(totalSpent)} з ${formatMoney(budget.total)}.`);
    else if (pct >= 0.8) addInboxChatMsg('agent', `💡 До ліміту місяця залишилось ${formatMoney(budget.total - totalSpent)}.`);
  }

  // Категорійний ліміт
  const catLimit = budget.categories?.[category];
  if (catLimit > 0) {
    const catSpent = txs.filter(t => t.category === category).reduce((s, t) => s + t.amount, 0);
    const pct = catSpent / catLimit;
    if (pct >= 1) addInboxChatMsg('agent', `⚠️ Ліміт по "${category}" перевищено: ${formatMoney(catSpent)} з ${formatMoney(catLimit)}.`);
    else if (pct >= 0.8) addInboxChatMsg('agent', `💡 По "${category}" залишилось ${formatMoney(catLimit - catSpent)}.`);
  }
}

// Finance контекст для getAIContext
export function getFinanceContext() {
  const today = new Date().toDateString();
  const from = getFinPeriodRange('month');
  const txs = getFinance().filter(t => t.ts >= from);
  if (txs.length === 0) return '';

  const expenses = txs.filter(t => t.type === 'expense');
  const incomes = txs.filter(t => t.type === 'income');
  const totalExp = expenses.reduce((s, t) => s + t.amount, 0);
  const totalInc = incomes.reduce((s, t) => s + t.amount, 0);
  const budget = getFinBudget();

  const catMap = {};
  expenses.forEach(t => { catMap[t.category] = (catMap[t.category] || 0) + t.amount; });
  const top3 = Object.entries(catMap).sort((a,b) => b[1]-a[1]).slice(0,3).map(([c,a]) => `${c}: ${formatMoney(a)}`).join(', ');

  const todayTxs = txs.filter(t => new Date(t.ts).toDateString() === today);
  const todaySum = todayTxs.filter(t => t.type === 'expense').reduce((s,t) => s+t.amount, 0);

  let parts = [`Фінанси (місяць): витрати ${formatMoney(totalExp)}, доходи ${formatMoney(totalInc)}`];
  if (budget.total > 0) parts.push(`бюджет ${formatMoney(budget.total)}, залишилось ${formatMoney(budget.total - totalExp)}`);
  if (top3) parts.push(`топ категорії: ${top3}`);
  if (todaySum > 0) parts.push(`сьогодні витрачено ${formatMoney(todaySum)}`);

  // Останні 5 транзакцій з ID — для update_transaction з Inbox
  const recentTxs = txs.slice(0, 5).map(t => `[ID:${t.id}] ${t.type === 'expense' ? '-' : '+'}${t.amount}${getCurrency()} ${t.category}${t.comment ? ' ('+t.comment+')' : ''}`).join('; ');
  if (recentTxs) parts.push(`Останні транзакції (використовуй ID для update_transaction): ${recentTxs}`);

  return parts.join('\n');
}

// === FINANCE AI BAR ===
let financeBarHistory = [];
let financeBarLoading = false;

export function addFinanceChatMsg(role, text, _noSave = false) {
  const el = document.getElementById('finance-chat-messages');
  if (!el) return;
  if (_financeTypingEl) { _financeTypingEl.remove(); _financeTypingEl = null; }
  if (role === 'typing') {
    const td = document.createElement('div');
    td.style.cssText = 'display:flex';
    td.innerHTML = '<div style="background:rgba(255,255,255,0.12);border-radius:4px 12px 12px 12px;padding:5px 10px"><div class=\"ai-typing\"><span></span><span></span><span></span></div></div>';
    el.appendChild(td);
    _financeTypingEl = td;
    el.scrollTop = el.scrollHeight;
    return;
  }
  if (!_noSave) { try { openChatBar('finance'); } catch(e) {} }
  const isAgent = role === 'agent';
  const div = document.createElement('div');
  div.style.cssText = `display:flex;${isAgent ? '' : 'justify-content:flex-end'}`;
  div.innerHTML = `<div class="msg-bubble ${isAgent ? 'msg-bubble--agent' : 'msg-bubble--user'}">${escapeHtml(text).replace(/\n/g,'<br>')}</div>`;
  el.appendChild(div);
  el.scrollTop = el.scrollHeight;
  if (role !== 'agent') financeBarHistory.push({ role: 'user', content: text });
  else financeBarHistory.push({ role: 'assistant', content: text });
  if (!_noSave) saveChatMsg('finance', role, text);
}

export async function sendFinanceBarMessage() {
  if (financeBarLoading) return;
  const input = document.getElementById('finance-bar-input');
  const text = input.value.trim();
  if (!text) return;
  const key = localStorage.getItem('nm_gemini_key');
  if (!key) { addFinanceChatMsg('agent', 'Введи OpenAI ключ в налаштуваннях.'); return; }
  input.value = ''; input.style.height = 'auto';
  input.focus();
  addFinanceChatMsg('user', text);
  financeBarLoading = true;
  addFinanceChatMsg('typing', '');

  const from = getFinPeriodRange('month');
  const txs = getFinance().filter(t => t.ts >= from);
  const budget = getFinBudget();
  const cats = getFinCats();
  const aiContext = getAIContext();

  const FINANCE_BAR_PROMPT = `${getOWLPersonality()} Ти допомагаєш з фінансами. Відповіді — 1-3 речення, конкретно.
Валюта: ${getCurrency()}. Поточний місяць.
Транзакції (до 20 останніх): ${txs.slice(0,20).map(t=>`[${t.type}] ${t.category} ${t.amount}${getCurrency()} ${t.comment||''}`).join('; ') || 'немає'}
Загальний бюджет: ${budget.total ? budget.total+getCurrency() : 'не встановлено'}
Категорії витрат: ${cats.expense.join(', ')}
Приклади: Їжа(кава,ресторан,продукти), Транспорт(бензин,таксі,Uber), Підписки(Netflix,Spotify), Здоровʼя(аптека,лікар), Житло(оренда,комуналка), Покупки(одяг,техніка)
Категорії доходів: ${cats.income.join(', ')}
Якщо є сумнів — обирай найближчу категорію, НЕ "Інше".

Ти можеш виконувати дії через JSON (відповідай ТІЛЬКИ JSON якщо потрібна дія):
{"action":"save_expense","amount":50,"category":"Їжа","comment":"продукти"}
{"action":"save_income","amount":3000,"category":"Зарплата","comment":""}
{"action":"delete_transaction","id":1234567890}
{"action":"update_transaction","id":1234567890,"category":"Транспорт","comment":"заправка"}
{"action":"set_budget","total":2000,"categories":{"Їжа":400}}
{"action":"create_category","type":"expense","name":"Нова категорія"}

Якщо користувач просить змінити категорію або опис існуючої транзакції — використовуй update_transaction з її id. НЕ створюй нову транзакцію і НЕ видаляй стару окремо.
ВАЖЛИВО: НЕ вигадуй ліміти, бюджети або плани яких немає в даних вище. Якщо бюджет "не встановлено" — не згадуй перевищення. Тільки реальні цифри.
Також вмієш: створити задачу {"action":"create_task","title":"назва","steps":[]}, звичку {"action":"create_habit","name":"назва","days":[0,1,2,3,4,5,6]}, редагувати звичку {"action":"edit_habit","habit_id":ID,"name":"нова назва","days":[0,1,2,3,4,5,6]}, нотатку {"action":"create_note","text":"текст","folder":null}, заплановану подію {"action":"create_event","title":"назва","date":"YYYY-MM-DD","time":null,"priority":"normal"}, закрити задачу {"action":"complete_task","task_id":ID}, відмітити звичку {"action":"complete_habit","habit_name":"назва"}, редагувати задачу {"action":"edit_task","task_id":ID,"title":"назва","dueDate":"YYYY-MM-DD","priority":"normal|important|critical"}, видалити задачу {"action":"delete_task","task_id":ID}, видалити звичку {"action":"delete_habit","habit_id":ID}, перевідкрити задачу {"action":"reopen_task","task_id":ID}, записати момент дня {"action":"add_moment","text":"текст"}. ЗАДАЧА = дія ЗРОБИТИ. ПОДІЯ = факт що СТАНЕТЬСЯ. "Перенеси подію" = edit_event.
Також: змінити подію {"action":"edit_event","event_id":ID,"date":"YYYY-MM-DD"}, видалити подію {"action":"delete_event","event_id":ID}, змінити нотатку {"action":"edit_note","note_id":ID,"text":"текст"}, розпорядок {"action":"save_routine","day":"mon" або масив,"blocks":[{"time":"07:00","activity":"Підйом"}]}.${aiContext ? '\n\n' + aiContext : ''}`;

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'system', content: FINANCE_BAR_PROMPT }, ...financeBarHistory.slice(-10)], max_tokens: 300, temperature: 0.5 })
    });
    const data = await res.json();
    const reply = data.choices?.[0]?.message?.content?.trim();
    if (!reply) { addFinanceChatMsg('agent', 'Щось пішло не так.'); financeBarLoading = false; return; }

    // Спробуємо JSON дію
    try {
      const jsonMatch = reply.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : reply);
      if (processUniversalAction(parsed, text, addFinanceChatMsg)) {
        // оброблено універсально
      } else if (parsed.action === 'save_expense' || parsed.action === 'save_income') {
        const type = parsed.action === 'save_expense' ? 'expense' : 'income';
        const txs2 = getFinance();
        txs2.unshift({ id: Date.now(), type, amount: parseFloat(parsed.amount), category: parsed.category || 'Інше', comment: parsed.comment || '', ts: Date.now() });
        saveFinance(txs2);
        renderFinance();
        try { localStorage.setItem('nm_owl_tab_ts_finance', '0'); tryBoardUpdate('finance'); } catch(e) {}
        addFinanceChatMsg('agent', `✓ ${type === 'expense' ? '-' : '+'}${formatMoney(parsed.amount)} · ${parsed.category}`);
        checkFinBudgetWarning(type, parsed.category, parseFloat(parsed.amount));
      } else if (parsed.action === 'delete_transaction') {
        const item = getFinance().find(t => t.id === parsed.id);
        const _item = getFinance().find(t => t.id === parsed.id);
      if (_item) addToTrash('finance', _item);
      saveFinance(getFinance().filter(t => t.id !== parsed.id));
        renderFinance();
        addFinanceChatMsg('agent', `🗑 Видалено: ${item ? item.category + ' ' + formatMoney(item.amount) : 'транзакцію'}`);
      } else if (parsed.action === 'update_transaction') {
        const txs2 = getFinance();
        const idx = txs2.findIndex(t => t.id === parsed.id);
        if (idx !== -1) {
          if (parsed.category) txs2[idx].category = parsed.category;
          if (parsed.comment !== undefined) txs2[idx].comment = parsed.comment;
          if (parsed.amount) txs2[idx].amount = parseFloat(parsed.amount);
          saveFinance(txs2);
          renderFinance();
          addFinanceChatMsg('agent', `✓ Оновлено: ${txs2[idx].category} ${formatMoney(txs2[idx].amount)}`);
        } else {
          addFinanceChatMsg('agent', 'Транзакцію не знайдено.');
        }
      } else if (parsed.action === 'set_budget') {
        const bdg = getFinBudget();
        if (parsed.total) bdg.total = parsed.total;
        if (parsed.categories) Object.assign(bdg.categories, parsed.categories);
        saveFinBudget(bdg);
        renderFinance();
        addFinanceChatMsg('agent', '✓ Бюджет оновлено');
      } else if (parsed.action === 'create_category') {
        const c = getFinCats();
        const list = parsed.type === 'income' ? c.income : c.expense;
        if (!list.includes(parsed.name)) { list.push(parsed.name); saveFinCats(c); }
        renderFinance();
        addFinanceChatMsg('agent', `✓ Категорію "${parsed.name}" додано`);
      } else {
        safeAgentReply(reply, addFinanceChatMsg);
      }
    } catch {
      safeAgentReply(reply, addFinanceChatMsg);
    }
  } catch { addFinanceChatMsg('agent', 'Мережева помилка.'); }
  financeBarLoading = false;
}


// === WINDOW EXPORTS (HTML handlers only) ===
Object.assign(window, {
  openAddTransaction, setCurrency, setFinPeriod, switchFinTab,
  sendFinanceBarMessage, openFinBudgetModal,
  openEditTransaction, closeFinTxModal, toggleFinTxType,
  selectFinTxCat, saveFinTransaction, deleteFinTransaction,
  closeFinBudgetModal, saveFinBudgetFromModal, openAllTransactions,
  toggleFinTabType, // Фаза 2 (K-01): тап на круг = перемикач Витрати⇄Доходи
  shiftFinPeriod,   // Фаза 2 крок Б: стрілки навігації періоду
});
