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
import { SWIPE_DELETE_THRESHOLD, applySwipeTrail, clearSwipeTrail } from '../ui/swipe-delete.js';
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

// SVG-бібліотека іконок (inline, 40 якісних). B-56: розширено з 20 до 40.
// Стиль: Lucide/Heroicons — stroke-based, 24×24 viewBox, заокруглені краї.
const FIN_CAT_ICONS = {
  // Базові (Фаза 2)
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
  // Нові (B-56) — +20 до 40 загалом
  pet:           '<circle cx="11" cy="4" r="2"/><circle cx="18" cy="8" r="2"/><circle cx="20" cy="16" r="2"/><circle cx="4" cy="8" r="2"/><path d="M9 10a5 5 0 0 1 5 5v3.5a3.5 3.5 0 0 1-6.8 1.2l-0.9-2.3a3.5 3.5 0 0 1 2.2-4.5z"/>',
  baby:          '<path d="M9 12h.01M15 12h.01M10 16c.5.3 1.2.5 2 .5s1.5-.2 2-.5"/><path d="M19 6.3a9 9 0 0 1 1.8 3.9 2 2 0 0 1 0 3.6 9 9 0 0 1-17.6 0 2 2 0 0 1 0-3.6A9 9 0 0 1 12 3c2 0 3.5 1.1 3.5 2.5s-.9 2.5-2 2.5c-.8 0-1.5-.4-1.5-1"/>',
  gym:           '<path d="M6.5 6.5L17.5 17.5M21 21l-1-1M3 3l1 1M18 22l4-4M2 6l4-4M3 10l7-7M14 21l7-7"/><path d="M7 17L3 21l1 1 4-4M17 7l4-4-1-1-4 4"/>',
  music:         '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
  book:          '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
  camera:        '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>',
  gaming:        '<line x1="6" y1="12" x2="10" y2="12"/><line x1="8" y1="10" x2="8" y2="14"/><line x1="15" y1="13" x2="15.01" y2="13"/><line x1="18" y1="11" x2="18.01" y2="11"/><path d="M17.32 5H6.68a4 4 0 0 0-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.545-.604-6.584-.685-7.258-.007-.05-.011-.1-.017-.151A4 4 0 0 0 17.32 5z"/>',
  bus:           '<path d="M8 6v6m8-6v6m-8 6h.01M16 18h.01M3 10h18M5 17v1a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-1m6 0v1a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-1"/><rect x="3" y="3" width="18" height="15" rx="2"/>',
  flight:        '<path d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.2.6-.6.5-1.1z"/>',
  hotel:         '<rect x="2" y="4" width="20" height="17" rx="2"/><path d="M2 10h20M7 4v4m5-4v4m5-4v4"/>',
  restaurant:    '<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2M7 2v20M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7"/>',
  pharmacy:      '<path d="M12 2v8m-4-4h8"/><path d="M19 14a7 7 0 1 1-14 0 7 7 0 0 1 14 0z"/>',
  doctor:        '<path d="M8 2v4m0 0a3 3 0 0 0 0 6v3a5 5 0 0 0 10 0"/><path d="M18 15a2 2 0 1 1 0-4 2 2 0 0 1 0 4z"/>',
  investment:    '<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>',
  savings:       '<path d="M19 7c1.1 0 2 .9 2 2v3l-2 1v3a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3v-8c0-3.3 2.7-6 6-6h4a3 3 0 0 1 3 3v2h1z"/><circle cx="15" cy="11" r="1"/>',
  tax:           '<circle cx="12" cy="12" r="10"/><line x1="8" y1="16" x2="16" y2="8"/><circle cx="8.5" cy="8.5" r="1.5"/><circle cx="15.5" cy="15.5" r="1.5"/>',
  bill:          '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="13" y2="17"/>',
  alcohol:       '<path d="M8 22h8M12 15v7M6 3l1 12a5 5 0 0 0 10 0l1-12z"/>',
  tech:          '<rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>',
  movies:        '<rect x="2" y="2" width="20" height="20" rx="2"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/><line x1="2" y1="17" x2="7" y2="17"/><line x1="17" y1="17" x2="22" y2="17"/><line x1="17" y1="7" x2="22" y2="7"/>',
  hair:          '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/>',
  charity:       '<path d="M18 8h1a4 4 0 0 1 4 4 4 4 0 0 1-4 4h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/>',
  bank:          '<line x1="3" y1="21" x2="21" y2="21"/><line x1="3" y1="10" x2="21" y2="10"/><polyline points="5 6 12 3 19 6"/><line x1="4" y1="10" x2="4" y2="21"/><line x1="20" y1="10" x2="20" y2="21"/><line x1="8" y1="14" x2="8" y2="17"/><line x1="12" y1="14" x2="12" y2="17"/><line x1="16" y1="14" x2="16" y2="17"/>',
  dumbbell:      '<path d="M6 5v14M18 5v14M6 10h12M6 14h12M3 8v8M21 8v8"/>',
  crown:         '<path d="M2 20h20M3 7l4 5 5-8 5 8 4-5v13H3z"/>',
  briefcase2:    '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/><line x1="2" y1="14" x2="22" y2="14"/>',
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

// ===== CRUD категорій (Фаза 2 крок В + Фаза 4 для агента) =====

// Знайти категорію по id — повертає {cat, type, idx} або null
export function findFinCatById(id) {
  const cats = getFinCats();
  for (const type of ['expense', 'income']) {
    const idx = cats[type].findIndex(c => c.id === id);
    if (idx !== -1) return { cat: cats[type][idx], type, idx };
  }
  return null;
}

// Створити нову категорію
export function createFinCategory(type, data) {
  const cats = getFinCats();
  const list = cats[type] || [];
  const order = list.length;
  const newCat = {
    id: 'cat_' + (data.name || 'new').toLowerCase().replace(/[^\wа-яґєії]/gi, '_').slice(0, 20) + '_' + Date.now().toString(36),
    name: data.name || 'Без назви',
    icon: data.icon || 'other',
    color: data.color || pickRandomCatColor(order),
    subcategories: data.subcategories || [],
    archived: false,
    order,
  };
  list.push(newCat);
  cats[type] = list;
  saveFinCats(cats);
  return newCat;
}

// Оновити категорію по id
export function updateFinCategory(id, data) {
  const found = findFinCatById(id);
  if (!found) return false;
  const cats = getFinCats();
  const cat = cats[found.type][found.idx];
  if (data.name !== undefined) cat.name = data.name;
  if (data.icon !== undefined) cat.icon = data.icon;
  if (data.color !== undefined) cat.color = data.color;
  if (data.subcategories !== undefined) cat.subcategories = data.subcategories;
  if (data.archived !== undefined) cat.archived = data.archived;
  saveFinCats(cats);
  return true;
}

// Видалити категорію
export function deleteFinCategory(id) {
  const found = findFinCatById(id);
  if (!found) return false;
  const cats = getFinCats();
  cats[found.type].splice(found.idx, 1);
  // Перерахувати order
  cats[found.type].forEach((c, i) => c.order = i);
  saveFinCats(cats);
  return true;
}

// Фаза 4 (K-02): merge категорій — переносить транзакції з fromId у toId і видаляє from
export function mergeFinCategories(fromId, toId) {
  const fromCat = findFinCatById(fromId);
  const toCat = findFinCatById(toId);
  if (!fromCat || !toCat) return { ok: false, reason: 'Категорію не знайдено' };
  if (fromCat.type !== toCat.type) return { ok: false, reason: 'Різні типи (expense/income)' };
  // Перейменувати транзакції з fromCat.cat.name на toCat.cat.name
  const txs = getFinance();
  let changed = 0;
  txs.forEach(t => {
    if (t.category === fromCat.cat.name) { t.category = toCat.cat.name; changed++; }
  });
  if (changed > 0) saveFinance(txs);
  // Перенести підкатегорії у to (унікально)
  const toCats = getFinCats();
  const toObj = toCats[toCat.type][toCat.idx];
  const fromObj = toCats[fromCat.type][fromCat.idx];
  fromObj.subcategories.forEach(s => { if (!toObj.subcategories.includes(s)) toObj.subcategories.push(s); });
  // Видалити from
  toCats[fromCat.type].splice(fromCat.idx, 1);
  toCats[fromCat.type].forEach((c, i) => c.order = i);
  saveFinCats(toCats);
  return { ok: true, txsMoved: changed, from: fromCat.cat.name, to: toCat.cat.name };
}

// Фаза 4: додати підкатегорію до існуючої категорії (по ID або назві)
export function addFinSubcategory(catIdOrName, subcatName) {
  const sub = (subcatName || '').trim();
  if (!sub) return false;
  const cats = getFinCats();
  for (const type of ['expense', 'income']) {
    const cat = cats[type].find(c => c.id === catIdOrName || c.name === catIdOrName);
    if (cat) {
      if (cat.subcategories.includes(sub)) return { ok: true, alreadyExists: true };
      cat.subcategories.push(sub);
      saveFinCats(cats);
      return { ok: true };
    }
  }
  return { ok: false, reason: 'Категорію не знайдено' };
}

// Фаза 4: знайти категорію по назві (у будь-якому з типів). Повертає { cat, type, idx } або null
export function findFinCatByName(name) {
  if (!name) return null;
  const cats = getFinCats();
  const lower = name.toLowerCase();
  for (const type of ['expense', 'income']) {
    const idx = cats[type].findIndex(c => c.name.toLowerCase() === lower);
    if (idx !== -1) return { cat: cats[type][idx], type, idx };
  }
  return null;
}

// State
let currentFinTab = 'expense';
let currentFinPeriod = 'month';
let currentFinPeriodOffset = 0; // 0 = поточний, -1 = попередній, +1 = майбутній (Фаза 2 крок Б, свайп місяців)
let _finEditMode = false; // Фаза 2 крок В: режим редагування категорій (олівець у хедері)
let _finEditingCatId = null; // id категорії що зараз редагується у модалці
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
  let gridHtml = '';
  try { gridHtml = _finCatsGrid(allTxs, win); } catch(e) { console.error('[finance] _finCatsGrid error:', e); }
  wrap.innerHTML =
    gridHtml +
    _finDailyInsight(allTxs, win) +
    (allTxs.length > 0 ? _finTxsBlock(allTxs) : _finEmptyTxsHint());

  _attachFinSwipe();
  _attachFinTxSwipeDelete(); // B-37: свайп-видалення транзакцій
  // Async: оновити інсайт дня через AI якщо кеш застарілий
  _refreshFinInsight(allTxs, win);
}

// B-54: свайп-видалення транзакцій.
// Картка свайпається до СЕРЕДИНИ (50% ширини) → за нею градієнт від прозорого до червоного,
// SVG-іконка кошика справа поверх градієнта. Тап на кошик = видалення з undo.
// Свайп вправо >30px = скасування. Кнопка кошика створюється LAZY (тільки під час свайпу).
const SWIPE_OPEN_RATIO = 0.5; // картка зсувається на 50% власної ширини

function _deleteFinTxById(txId) {
  const item = getFinance().find(t => t.id === txId);
  saveFinance(getFinance().filter(t => t.id !== txId));
  if (item) addToTrash('finance', item);
  renderFinance();
  try { localStorage.setItem('nm_owl_tab_ts_finance', '0'); tryBoardUpdate('finance'); } catch(e) {}
  if (item) showUndoToast('Операцію видалено', () => {
    const txs = getFinance(); txs.unshift(item); saveFinance(txs); renderFinance();
  });
}

function _attachFinTxSwipeDelete() {
  const wraps = document.querySelectorAll('.fin-tx-swipe-wrap');
  wraps.forEach(sw => {
    if (sw._swipeBound) return;
    sw._swipeBound = true;
    let startX = 0, startY = 0, dx = 0, locked = false;
    const card = sw.querySelector('.tx-row');
    if (!card) return;

    // LAZY: bin створюється лише коли почався свайп. Прибирається після закриття.
    let bin = null;
    const ensureBin = () => {
      if (bin) return;
      const w = Math.round(sw.offsetWidth * SWIPE_OPEN_RATIO);
      bin = document.createElement('button');
      bin.className = 'fin-tx-bin';
      bin.setAttribute('aria-label', 'Видалити');
      // Градієнт від прозорого зліва → червоний справа. Кошик-іконка по правому краю.
      bin.style.cssText = `position:absolute;right:0;top:0;bottom:0;width:${w}px;display:flex;align-items:center;justify-content:flex-end;padding-right:22px;background:linear-gradient(to right, rgba(239,68,68,0) 0%, rgba(239,68,68,0.95) 75%);border:none;cursor:pointer;z-index:0;font-family:inherit;border-radius:0 10px 10px 0`;
      bin.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';
      bin.addEventListener('click', (e) => {
        e.stopPropagation();
        const txId = parseInt(sw.dataset.txId);
        if (!isNaN(txId)) _deleteFinTxById(txId);
      });
      sw.appendChild(bin);
    };
    const removeBin = () => {
      if (bin && bin.parentNode) bin.parentNode.removeChild(bin);
      bin = null;
    };

    const getOpenOffset = () => -Math.round(sw.offsetWidth * SWIPE_OPEN_RATIO);
    const setOffset = (offset, animate = false) => {
      card.style.transition = animate ? 'transform 0.25s ease' : '';
      card.style.transform = `translateX(${offset}px)`;
    };
    const openSwipe = () => { sw._open = true; ensureBin(); setOffset(getOpenOffset(), true); };
    const closeSwipe = () => {
      sw._open = false;
      setOffset(0, true);
      setTimeout(() => { if (!sw._open) removeBin(); }, 280); // після завершення transition
    };

    // Тап на картку при відкритому свайпі → закриваємо (не відкриваємо редагування)
    card.addEventListener('click', (e) => {
      if (sw._open) { e.stopPropagation(); e.preventDefault(); closeSwipe(); }
    }, true);

    sw.addEventListener('touchstart', (e) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      dx = 0; locked = false;
      card.style.transition = '';
    }, { passive: true });

    sw.addEventListener('touchmove', (e) => {
      if (locked) return;
      const ddx = e.touches[0].clientX - startX;
      const ddy = e.touches[0].clientY - startY;
      if (Math.abs(dx) < 5 && Math.abs(ddy) > Math.abs(ddx)) { locked = true; return; }
      dx = ddx;
      // Перший свайп вліво створює bin (lazy)
      if (dx < 0 && !sw._open && !bin) ensureBin();
      const baseOffset = sw._open ? getOpenOffset() : 0;
      const newOffset = Math.min(0, baseOffset + dx);
      setOffset(newOffset);
    }, { passive: true });

    sw.addEventListener('touchend', () => {
      if (locked) { if (sw._open) openSwipe(); else closeSwipe(); return; }
      // Поріг = 50% від цільового offset (тобто чверть ширини картки)
      const threshold = sw.offsetWidth * SWIPE_OPEN_RATIO * 0.5;
      if (sw._open) {
        if (dx > 30) closeSwipe(); else openSwipe();
      } else {
        if (dx < -threshold) openSwipe(); else closeSwipe();
      }
    }, { passive: true });
  });
}

function _finEmptyTxsHint() {
  return `<div style="background:rgba(255,255,255,0.5);border:1.5px dashed rgba(30,16,64,0.12);border-radius:16px;padding:16px;text-align:center;margin-bottom:12px">
    <div style="font-size:13px;color:rgba(30,16,64,0.45);font-weight:600">У цьому періоді транзакцій немає</div>
    <div style="font-size:11px;color:rgba(30,16,64,0.35);font-weight:500;margin-top:4px">Тапни категорію щоб додати або свайпни ←→ для іншого періоду</div>
  </div>`;
}

// ===== Фаза 5: Динамічна "Інсайт дня" картка =====
// Одна картка з AI-обраним найрелевантнішим фактом (замість 3 статичних карток).
// B-46: кеш скорочено 12 год → 1 год + інвалідація по хешу транзакцій.
// Hash враховує кількість + суми + категорії → будь-яка зміна → перегенерація.
const FIN_INSIGHT_TTL = 60 * 60 * 1000; // 1 год

function _finInsightHash(allTxs) {
  // Компактний хеш стану: кількість + сума експенсів + сума доходів + топ-3 категорії
  // Будь-яка зміна даних → новий хеш → кеш стає невалідним
  const exp = allTxs.filter(t => t.type === 'expense').reduce((s,t) => s+t.amount, 0);
  const inc = allTxs.filter(t => t.type === 'income').reduce((s,t) => s+t.amount, 0);
  const catMap = {};
  allTxs.filter(t => t.type === 'expense').forEach(t => { catMap[t.category] = (catMap[t.category] || 0) + t.amount; });
  const top = Object.entries(catMap).sort((a,b) => b[1]-a[1]).slice(0,3).map(([c,a]) => `${c}:${Math.round(a)}`).join('|');
  return `${allTxs.length}_${Math.round(exp)}_${Math.round(inc)}_${top}`;
}

function _finDailyInsight(allTxs) {
  if (allTxs.length === 0) return '';
  // Кешований текст для поточного періоду+offset
  const cacheKey = `nm_fin_insight_${currentFinPeriod}_${currentFinPeriodOffset}`;
  const cached = localStorage.getItem(cacheKey);
  let text = 'OWL аналізує фінанси…';
  if (cached) { try { text = JSON.parse(cached).text || text; } catch(e) {} }
  return `<div id="fin-insight-card" style="display:flex;align-items:flex-start;gap:10px;background:rgba(255,255,255,0.72);backdrop-filter:blur(16px);border:1.5px solid rgba(255,255,255,0.75);border-radius:16px;padding:12px 14px;margin-bottom:12px">
    <div style="width:28px;height:28px;border-radius:10px;background:rgba(194,65,12,0.1);display:flex;align-items:center;justify-content:center;flex-shrink:0">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c2410c" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
    </div>
    <div style="font-size:13px;font-weight:600;color:#1e1040;line-height:1.5" id="fin-insight-text">${escapeHtml(text)}</div>
  </div>`;
}

async function _refreshFinInsight(allTxs, win) {
  if (allTxs.length < 2) return; // недостатньо даних
  const key = localStorage.getItem('nm_gemini_key');
  if (!key) return;
  const cacheKey = `nm_fin_insight_${currentFinPeriod}_${currentFinPeriodOffset}`;
  const currentHash = _finInsightHash(allTxs);
  const cached = localStorage.getItem(cacheKey);
  // B-46: кеш валідний тільки якщо (а) свіжий (1 год) І (б) хеш даних не змінився
  if (cached) {
    try {
      const c = JSON.parse(cached);
      if (Date.now() - c.ts < FIN_INSIGHT_TTL && c.hash === currentHash) return;
    } catch(e) {}
  }

  const expenses = allTxs.filter(t => t.type === 'expense');
  const incomes = allTxs.filter(t => t.type === 'income');
  const totalExp = expenses.reduce((s, t) => s + t.amount, 0);
  const totalInc = incomes.reduce((s, t) => s + t.amount, 0);
  const catMap = {};
  expenses.forEach(t => { catMap[t.category] = (catMap[t.category] || 0) + t.amount; });
  const topCats = Object.entries(catMap).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const top3 = topCats.slice(0,3).map(([c, a]) => `${c}: ${formatMoney(a)}`).join(', ');
  const budget = getFinBudget();
  const currency = getCurrency();

  // B-46: конкретний промпт з числами, заборона шаблонних фраз
  const prompt = `${getOWLPersonality()}
Ти — фінансовий тренер. Дай ОДНУ коротку конкретну пораду з числами. 1-2 речення, українською.

ЗАБОРОНЕНО:
- повторювати загальні суми які юзер бачить на екрані ("Витрати склали €X")
- загальні фрази ("стеж за витратами", "плануй бюджет", "розподіляй кошти")
- згадувати "загалом" / "в цілому" / "варто задуматись"

ОБОВ'ЯЗКОВО: конкретне число + конкретна дія або порівняння.

Шаблони (вибери НАЙРЕЛЕВАНТНІШИЙ для цих даних):
1. Річна проекція: "{Категорія} ${currency}X/міс = ${currency}Y за рік — це {конкретна ціль}"
2. Відхилення: "На {категорія} в {N}x більше ніж на {інша}"
3. Економія: "Скоротити {категорія} на ${currency}X/тиждень = ${currency}Y за рік"
4. Перевищення ліміту: "Категорія {X} перевищила ліміт на {N%}"
5. Тренд: "Топ-категорія {X} — ${currency}Y, наступна у 2 рази менша"

Дані (${win.label}):
Топ-5 категорій: ${topCats.map(([c,a]) => `${c}=${formatMoney(a)}`).join(', ') || 'немає'}
Всього витрат за період: ${formatMoney(totalExp)}
${budget.total > 0 ? `Бюджет на місяць: ${formatMoney(budget.total)}, витрачено ${formatMoney(totalExp)} (${Math.round(totalExp/budget.total*100)}%)` : 'Бюджет не встановлено'}
${totalInc > 0 ? `Доходи: ${formatMoney(totalInc)}, заощаджено ${Math.round((totalInc - totalExp) / totalInc * 100)}%` : ''}`;

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: prompt }], max_tokens: 120, temperature: 0.7 })
    });
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text) return;
    localStorage.setItem(cacheKey, JSON.stringify({ text, ts: Date.now(), hash: currentHash }));
    const el = document.getElementById('fin-insight-text');
    if (el) el.textContent = text;
  } catch(e) {}
}

// Фаза 2 крок Б: touch-обробники для свайп-гортання періодів
// (Drag-n-drop через long-press прибрано 15.04.2026 — переміщення тепер через
// кнопки ↑/↓ у модалці редагування категорії, див. moveFinCategory)
let _finSwipeAttached = false;
function _attachFinSwipe() {
  if (_finSwipeAttached) return;
  const wrap = document.getElementById('fin-v2-wrap');
  if (!wrap) return;
  let startX = 0, startY = 0, onGrid = false;
  wrap.addEventListener('touchstart', (e) => {
    onGrid = !_finEditMode && !!e.target.closest('#fin-cats-grid-wrap'); // у edit-режимі свайп вимкнено
    if (!onGrid) return;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
  }, { passive: true });
  wrap.addEventListener('touchend', (e) => {
    if (!onGrid) return;
    onGrid = false;
    const dx = e.changedTouches[0].clientX - startX;
    const dy = e.changedTouches[0].clientY - startY;
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
    if (dx < 0) currentFinPeriodOffset++;
    else currentFinPeriodOffset--;
    renderFinance();
  }, { passive: true });
  _finSwipeAttached = true;
}

// Переміщення категорії на delta позицій (вгору -1 / вниз +1).
// Викликається з модалки редагування — кнопки ↑/↓.
export function moveFinCategory(id, delta) {
  const cats = getFinCats();
  for (const type of ['expense', 'income']) {
    const arr = cats[type];
    const idx = arr.findIndex(c => c.id === id);
    if (idx === -1) continue;
    const newIdx = Math.max(0, Math.min(arr.length - 1, idx + delta));
    if (newIdx === idx) return false;
    const [moved] = arr.splice(idx, 1);
    arr.splice(newIdx, 0, moved);
    arr.forEach((c, i) => c.order = i);
    saveFinCats(cats);
    return true;
  }
  return false;
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
    // У edit-режимі — тап = редагування. У звичайному — тап = додати транзакцію.
    const onClick = _finEditMode
      ? `openCategoryEditModal('${escapeHtml(cat.id)}')`
      : `openAddTransaction({category: '${escapeHtml(cat.name)}', type: '${isExpense ? 'expense' : 'income'}'})`;
    // У edit-режимі кружечок підсвічений (легка border-shimmer) щоб юзер бачив що тап = редагування
    const editStyle = _finEditMode ? 'box-shadow:0 0 0 2px ' + cat.color + '55;' : '';
    return `<div onclick="${onClick}" style="display:flex;flex-direction:column;align-items:center;cursor:pointer;padding:4px 0;min-width:0">
      <div style="font-size:11px;font-weight:600;color:rgba(30,16,64,0.55);margin-bottom:4px;text-align:center;max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(cat.name)}</div>
      <div style="width:48px;height:48px;border-radius:50%;background:${cat.color}20;display:flex;align-items:center;justify-content:center;${editStyle}">
        ${finCatIcon(cat.icon, cat.color, 22)}
      </div>
      <div style="font-size:11px;font-weight:700;color:${sumCol};margin-top:4px">${sumStr}</div>
    </div>`;
  };

  // У edit-режимі — додаткова комірка "+" як остання категорія
  const renderAddCell = () => `<div onclick="openCategoryEditModal('new')" style="display:flex;flex-direction:column;align-items:center;cursor:pointer;padding:4px 0;min-width:0">
    <div style="font-size:11px;font-weight:600;color:rgba(30,16,64,0.4);margin-bottom:4px">Додати</div>
    <div style="width:48px;height:48px;border-radius:50%;background:rgba(194,65,12,0.08);border:2px dashed rgba(194,65,12,0.35);display:flex;align-items:center;justify-content:center">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#c2410c" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
    </div>
    <div style="font-size:11px;font-weight:700;color:rgba(30,16,64,0.25);margin-top:4px">&nbsp;</div>
  </div>`;

  const gridCells = inGrid.map(renderCell).join('') + (_finEditMode && inGrid.length < 12 ? renderAddCell() : '');
  const overflowCells = overflow.map(renderCell).join('') + (_finEditMode && inGrid.length >= 12 ? renderAddCell() : '');

  // Центральний круг-Hero (grid-item, займає колонки 2-3 і ряди 2-3)
  // B-60: товстий donut-chart з кольоровими сегментами по категоріях (пропорційно витратам)
  const heroLabel = isExpense ? 'Витрати' : 'Доходи';
  const heroCol = isExpense ? '#c2410c' : '#16a34a';
  const donutR = 42;
  const donutCirc = 2 * Math.PI * donutR; // ~263.9
  // Рахуємо сегменти: категорії з сумами > 0, відсортовані за сумою desc
  const donutSegs = [];
  if (totalSum > 0) {
    const withSums = sorted.map(c => ({ c, sum: catMap[c.name] || 0 })).filter(s => s.sum > 0).sort((a,b) => b.sum - a.sum);
    let offset = 0;
    withSums.forEach(({ c, sum }) => {
      const pct = sum / totalSum;
      const segLen = pct * donutCirc;
      donutSegs.push({ color: c.color, segLen, offset });
      offset += segLen;
    });
  }
  const donutRings = donutSegs.map(s =>
    `<circle cx="50" cy="50" r="${donutR}" fill="none" stroke="${s.color}" stroke-width="9"
             stroke-dasharray="${s.segLen.toFixed(2)} ${donutCirc.toFixed(2)}"
             stroke-dashoffset="${(-s.offset).toFixed(2)}"
             transform="rotate(-90 50 50)"/>`
  ).join('');
  // Базове сіре кільце (видно якщо totalSum=0 або якщо сегменти не покривають 100%)
  const donutBase = `<circle cx="50" cy="50" r="${donutR}" fill="none" stroke="rgba(30,16,64,0.06)" stroke-width="9"/>`;
  const heroCircle = `<div onclick="toggleFinTabType()" style="grid-column:2/4;grid-row:2/4;position:relative;cursor:pointer;user-select:none;aspect-ratio:1;align-self:center;justify-self:center;width:100%;max-width:170px">
    <svg viewBox="0 0 100 100" style="width:100%;height:100%;display:block;filter:drop-shadow(0 4px 12px rgba(30,16,64,0.08))">
      ${donutBase}${donutRings}
      <circle cx="50" cy="50" r="${donutR - 5}" fill="rgba(255,255,255,0.95)"/>
    </svg>
    <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;pointer-events:none">
      <div style="font-size:10px;font-weight:700;color:rgba(30,16,64,0.45);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:2px">${heroLabel}</div>
      <div style="font-size:20px;font-weight:900;color:${heroCol};line-height:1">${formatMoney(totalSum)}</div>
    </div>
  </div>`;

  // Хедер блоку: у звичайному режимі — стрілки навігації + лейбл + олівець ✎.
  // У edit-режимі — лейбл "Редагування" + кнопка "Готово".
  const isCurrent = currentFinPeriodOffset === 0;
  const headerHtml = _finEditMode
    ? `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;user-select:none">
        <div style="width:32px"></div>
        <div style="display:flex;flex-direction:column;align-items:center;gap:2px;flex:1">
          <div style="font-size:14px;font-weight:800;color:#c2410c">Редагування категорій</div>
          <div style="font-size:10px;font-weight:600;color:rgba(30,16,64,0.4);text-transform:uppercase;letter-spacing:0.06em">тапни щоб редагувати або +</div>
        </div>
        <button onclick="toggleFinEditMode()" aria-label="Готово" style="padding:6px 14px;border-radius:14px;border:none;background:#c2410c;color:white;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">Готово</button>
      </div>`
    : `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;user-select:none">
        <button onclick="shiftFinPeriod(-1)" aria-label="Попередній період" style="width:32px;height:32px;border-radius:50%;border:none;background:rgba(30,16,64,0.05);color:rgba(30,16,64,0.55);font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;font-family:inherit">‹</button>
        <div style="display:flex;flex-direction:column;align-items:center;gap:2px;flex:1">
          <div style="font-size:14px;font-weight:800;color:#1e1040">${escapeHtml(periodLabel)}</div>
          ${!isCurrent ? `<div onclick="shiftFinPeriod(${-currentFinPeriodOffset})" style="font-size:10px;font-weight:700;color:#c2410c;cursor:pointer;text-transform:uppercase;letter-spacing:0.06em">↺ до сьогодні</div>` : `<div style="font-size:10px;font-weight:600;color:rgba(30,16,64,0.3);text-transform:uppercase;letter-spacing:0.06em">свайп ←→ для навігації</div>`}
        </div>
        <div style="display:flex;align-items:center;gap:4px">
          <button onclick="toggleFinEditMode()" aria-label="Редагувати категорії" title="Редагувати категорії" style="width:32px;height:32px;border-radius:50%;border:none;background:rgba(30,16,64,0.05);color:rgba(30,16,64,0.55);cursor:pointer;display:flex;align-items:center;justify-content:center;font-family:inherit">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
          </button>
          <button onclick="shiftFinPeriod(1)" aria-label="Наступний період" style="width:32px;height:32px;border-radius:50%;border:none;background:rgba(30,16,64,0.05);color:rgba(30,16,64,0.55);font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;font-family:inherit">›</button>
        </div>
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
    // B-53: показуємо підкатегорію дрібним текстом після категорії через · розділювач
    const categoryLine = t.subcategory
      ? `<span style="font-weight:700;color:#1e1040">${escapeHtml(t.category)}</span><span style="font-size:11px;font-weight:500;color:rgba(30,16,64,0.4);margin-left:4px">· ${escapeHtml(t.subcategory)}</span>`
      : `<span style="font-weight:700;color:#1e1040">${escapeHtml(t.category)}</span>`;
    // B-37: обгортка для swipe-delete (swipe-wrap → tx-row)
    return `<div class="fin-tx-swipe-wrap" data-tx-id="${t.id}" style="position:relative;overflow:hidden;border-radius:10px">
      <div class="tx-row" onclick="openEditTransaction(${t.id})" style="position:relative;z-index:1;background:#fff">
        <div style="flex:1;min-width:0">
          <div style="font-size:13px">${categoryLine}</div>
          ${t.comment ? `<div style="font-size:11px;color:rgba(30,16,64,0.4);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(t.comment)}</div>` : ''}
        </div>
        <div style="text-align:right;flex-shrink:0">
          <div style="font-size:14px;font-weight:800;color:${isExp?'#c2410c':'#16a34a'}">${isExp?'-':'+'}${formatMoney(t.amount)}</div>
          <div style="font-size:10px;color:rgba(30,16,64,0.35)">${dateStr}</div>
        </div>
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
    // B-53: підкатегорія дрібним текстом поруч
    const categoryLine = t.subcategory
      ? `<span style="font-weight:700;color:#1e1040">${escapeHtml(t.category)}</span><span style="font-size:11px;font-weight:500;color:rgba(30,16,64,0.4);margin-left:4px">· ${escapeHtml(t.subcategory)}</span>`
      : `<span style="font-weight:700;color:#1e1040">${escapeHtml(t.category)}</span>`;
    return `<div class="tx-row" onclick="document.getElementById('fin-all-txs-modal').remove();openEditTransaction(${t.id})">
      <div style="flex:1;min-width:0">
        <div style="font-size:13px">${categoryLine}</div>
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
  _finTxComment = prefill.comment || '';
  const type = prefill.type || (currentFinTab === 'income' ? 'income' : 'expense');
  _showTransactionModal({ type, amount: prefill.amount || '', category: prefill.category || '', comment: prefill.comment || '', ts: prefill.ts });
}

function openEditTransaction(id) {
  const txs = getFinance();
  const t = txs.find(x => x.id === id);
  if (!t) return;
  _finEditId = id;
  _finTxComment = t.comment || '';
  _showTransactionModal(t);
}

// ===== Фаза 3: Модалка транзакції з калькулятором + датапікером =====
// State калькулятора
let _finTxCurrentType = 'expense';
let _finTxCategory = '';      // основна категорія (рядок назви)
let _finTxSubcategory = '';   // обрана підкатегорія (рядок або '')
let _finTxExpression = '';    // вираз калькулятора (наприклад "10+5*2")
let _finTxDate = Date.now();  // обрана дата транзакції (timestamp)

function _showTransactionModal(data) {
  const cats = getFinCats();
  _finTxCurrentType = data.type === 'income' ? 'income' : 'expense';
  _finTxCategory = data.category || '';
  _finTxSubcategory = data.subcategory || '';
  _finTxExpression = data.amount ? String(data.amount) : '';
  _finTxDate = data.ts || Date.now();

  const existing = document.getElementById('fin-tx-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'fin-tx-modal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:500;display:flex;align-items:flex-end;justify-content:center;padding:0 16px 16px';
  modal.innerHTML = _renderTransactionModalBody();
  document.body.appendChild(modal);
  setupModalSwipeClose(modal.querySelector('div:last-child'), closeFinTxModal);
}

function _renderTransactionModalBody() {
  const cats = getFinCats();
  const isExpense = _finTxCurrentType !== 'income';
  const isEdit = _finEditId !== null;
  const catList = (isExpense ? cats.expense : cats.income).filter(c => !c.archived);
  const matchedCat = catList.find(c => c.name === _finTxCategory);
  const subcats = matchedCat?.subcategories || [];

  // Заголовок (B-33: правильна граматика — знахідний відмінок, окремі шаблони)
  let title;
  if (_finTxCategory) {
    title = isEdit
      ? (isExpense ? `Редагувати: ${_finTxCategory}` : `Редагувати дохід: ${_finTxCategory}`)
      : _finTxCategory;
  } else {
    title = isEdit
      ? (isExpense ? 'Редагувати витрату' : 'Редагувати дохід')
      : (isExpense ? 'Нова витрата' : 'Новий дохід');
  }

  // Велика сума з обчисленого виразу
  const calcResult = _safeFinCalc(_finTxExpression);
  const displayAmount = _finTxExpression || '0';
  const calcCol = isExpense ? '#c2410c' : '#16a34a';

  // Лейбл дати
  const dateLabel = _finTxDateLabel(_finTxDate);

  // Категорія (тільки коли НЕ передано — наприклад edit без категорії або з Inbox-pre-fill)
  // B-52: категорії — більші/жирніші (primary), підкатегорії — менші/легші (secondary)
  const showCatPicker = !_finTxCategory || isEdit;
  const catPickerHtml = showCatPicker ? `
    <div id="fntx-cats-wrap" style="margin-bottom:12px">
      <div style="font-size:10px;font-weight:800;color:rgba(30,16,64,0.55);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:8px">Категорія</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px">
        ${catList.map(c => {
          const active = c.name === _finTxCategory;
          return `<button onclick="selectFinTxMainCat('${escapeHtml(c.name)}')" style="padding:7px 14px;border-radius:18px;font-size:13.5px;font-weight:800;cursor:pointer;font-family:inherit;border:2px solid ${active ? '#c2410c' : 'rgba(30,16,64,0.12)'};background:${active ? 'rgba(194,65,12,0.14)' : 'white'};color:${active ? '#c2410c' : '#1e1040'}">${escapeHtml(c.name)}</button>`;
        }).join('')}
      </div>
    </div>` : '';

  // Підкатегорії — чіпи з cat.subcategories. Стиль: менші, легші, з лейблом "Підкатегорія"
  const subcatsHtml = subcats.length > 0 ? `
    <div style="margin-bottom:12px;padding-left:10px;border-left:2px solid rgba(194,65,12,0.18)">
      <div style="font-size:9px;font-weight:700;color:rgba(30,16,64,0.35);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:5px">Підкатегорія</div>
      <div style="display:flex;flex-wrap:wrap;gap:4px">
        ${subcats.map(s => {
          const active = s === _finTxSubcategory;
          return `<button onclick="selectFinTxSubcat('${escapeHtml(s)}')" style="padding:3px 9px;border-radius:12px;font-size:11.5px;font-weight:500;cursor:pointer;font-family:inherit;border:1px solid ${active ? '#c2410c' : 'rgba(30,16,64,0.08)'};background:${active ? 'rgba(194,65,12,0.06)' : 'rgba(30,16,64,0.02)'};color:${active ? '#c2410c' : 'rgba(30,16,64,0.5)'}">${escapeHtml(s)}</button>`;
        }).join('')}
      </div>
    </div>` : '';

  // Калькулятор: 4 ряди × 4 кнопки (числа + операції + ⌫ + 📅)
  const calcBtn = (label, action, opts = {}) => {
    const bg = opts.bg || 'rgba(30,16,64,0.04)';
    const col = opts.col || '#1e1040';
    const fontSize = opts.fontSize || '20px';
    const fontWeight = opts.fontWeight || '600';
    return `<button onclick="${action}" style="padding:14px 0;border-radius:12px;border:none;background:${bg};color:${col};font-size:${fontSize};font-weight:${fontWeight};cursor:pointer;font-family:inherit;touch-action:manipulation">${label}</button>`;
  };
  const opStyle = { bg: 'rgba(194,65,12,0.06)', col: '#c2410c', fontWeight: '700' };
  const calcGrid = `<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:10px">
    ${calcBtn('7', "finCalcAppend('7')")}
    ${calcBtn('8', "finCalcAppend('8')")}
    ${calcBtn('9', "finCalcAppend('9')")}
    ${calcBtn('÷', "finCalcAppend('÷')", opStyle)}
    ${calcBtn('4', "finCalcAppend('4')")}
    ${calcBtn('5', "finCalcAppend('5')")}
    ${calcBtn('6', "finCalcAppend('6')")}
    ${calcBtn('×', "finCalcAppend('×')", opStyle)}
    ${calcBtn('1', "finCalcAppend('1')")}
    ${calcBtn('2', "finCalcAppend('2')")}
    ${calcBtn('3', "finCalcAppend('3')")}
    ${calcBtn('−', "finCalcAppend('-')", opStyle)}
    ${calcBtn(',', "finCalcAppend('.')")}
    ${calcBtn('0', "finCalcAppend('0')")}
    ${calcBtn('⌫', 'finCalcBackspace()', { bg: 'rgba(239,68,68,0.06)', col: '#dc2626', fontSize: '18px' })}
    ${calcBtn('+', "finCalcAppend('+')", opStyle)}
  </div>`;

  // Кнопка "+" для введеня знаку плюс не потрібна окремо у новій логіці — об'єднана у калькулятор
  // Розширення: якщо вираз має операції — показуємо результат

  return `<div onclick="closeFinTxModal()" style="position:absolute;inset:0;background:rgba(0,0,0,0.35);backdrop-filter:blur(4px)"></div>
  <div style="position:relative;width:100%;max-width:480px;background:rgba(255,255,255,0.30);backdrop-filter:blur(32px);-webkit-backdrop-filter:blur(32px);border-radius:24px;overflow:hidden;z-index:1;max-height:85vh;border:1.5px solid rgba(255,255,255,0.5);padding:0 20px">
    <div style="overflow-y:auto;max-height:85vh;padding:18px 0 calc(env(safe-area-inset-bottom)+18px);box-sizing:border-box">
    <div style="width:36px;height:4px;background:rgba(0,0,0,0.12);border-radius:2px;margin:0 auto 14px"></div>

    <!-- Заголовок -->
    <div style="font-size:14px;font-weight:800;color:${calcCol};text-align:center;margin-bottom:6px">${escapeHtml(title)}</div>

    <!-- Велика сума -->
    <div style="text-align:center;margin-bottom:10px">
      <div style="font-size:32px;font-weight:900;color:${calcCol};line-height:1.1;font-variant-numeric:tabular-nums">${escapeHtml(displayAmount)} ${getCurrency()}</div>
      ${(_finTxExpression && /[+\-*/×÷]/.test(_finTxExpression)) ? `<div style="font-size:13px;color:rgba(30,16,64,0.45);margin-top:4px">= ${formatMoney(calcResult)}</div>` : ''}
    </div>

    ${catPickerHtml}
    ${subcatsHtml}

    <!-- Дата -->
    <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:rgba(255,255,255,0.5);border:1.5px solid rgba(30,16,64,0.08);border-radius:12px;margin-bottom:10px;cursor:pointer" onclick="openFinDateModal()">
      <div style="display:flex;align-items:center;gap:8px">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(30,16,64,0.5)" stroke-width="2" stroke-linecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        <span style="font-size:13px;font-weight:600;color:#1e1040">${escapeHtml(dateLabel)}</span>
      </div>
      <span style="font-size:11px;color:rgba(30,16,64,0.4);font-weight:600">змінити</span>
    </div>

    <!-- Нотатка -->
    <input id="fntx-comment" type="text" placeholder="Нотатка (необов'язково)" value="${escapeHtml(_finTxComment || '')}"
      oninput="_finTxComment = this.value"
      style="width:100%;border:1.5px solid rgba(30,16,64,0.12);border-radius:12px;padding:10px 14px;font-size:14px;font-family:inherit;color:#1e1040;outline:none;margin-bottom:10px;box-sizing:border-box;background:rgba(255,255,255,0.7)">

    ${calcGrid}

    <!-- Кнопки дій -->
    <div style="display:flex;gap:6px">
      ${isEdit ? `<button onclick="deleteFinTransaction()" style="padding:13px 14px;border-radius:12px;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);font-size:13px;font-weight:700;color:#dc2626;cursor:pointer;font-family:inherit;display:flex;align-items:center;gap:6px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>Видалити</button>` : ''}
      <button onclick="closeFinTxModal()" class="btn-cancel" style="flex:1">Скасувати</button>
      <button onclick="saveFinTransaction()" class="btn-save-primary" style="flex:1.5">${isEdit ? 'Зберегти' : '✓ Додати'}</button>
    </div>
    </div>
  </div>`;
}

let _finTxComment = '';

function _refreshTransactionModal() {
  const modal = document.getElementById('fin-tx-modal');
  if (modal) modal.innerHTML = _renderTransactionModalBody();
}

// === Калькулятор: безпечний парсер виразів (БЕЗ eval) ===
function _safeFinCalc(expr) {
  if (!expr) return 0;
  // Нормалізуємо: × → *, ÷ → /, , → .
  const norm = String(expr).replace(/×/g, '*').replace(/÷/g, '/').replace(/,/g, '.').replace(/\s+/g, '');
  // Токенізація
  const tokens = norm.match(/(\d+\.?\d*|\.\d+|[+\-*/])/g);
  if (!tokens || tokens.length === 0) return 0;
  // Перевірка валідності — токен 0 має бути числом, не операція (крім -)
  let nums = [];
  let ops = [];
  let i = 0;
  // Підтримка унарного мінуса на початку
  if (tokens[0] === '-' && tokens.length > 1) {
    nums.push(-parseFloat(tokens[1]));
    i = 2;
  } else {
    nums.push(parseFloat(tokens[0]));
    i = 1;
  }
  while (i < tokens.length) {
    const op = tokens[i];
    const num = parseFloat(tokens[i + 1]);
    if (isNaN(num)) break;
    ops.push(op);
    nums.push(num);
    i += 2;
  }
  // Спочатку *, /
  for (let j = 0; j < ops.length; j++) {
    if (ops[j] === '*' || ops[j] === '/') {
      const result = ops[j] === '*' ? nums[j] * nums[j + 1] : (nums[j + 1] !== 0 ? nums[j] / nums[j + 1] : 0);
      nums[j] = result;
      nums.splice(j + 1, 1);
      ops.splice(j, 1);
      j--;
    }
  }
  // Потім +, -
  let result = nums[0];
  for (let j = 0; j < ops.length; j++) {
    result = ops[j] === '+' ? result + nums[j + 1] : result - nums[j + 1];
  }
  return Math.round(result * 100) / 100; // округлення до копійок
}

function finCalcAppend(token) {
  // Заборонити дві операції підряд — заміна попередньої
  const last = _finTxExpression.slice(-1);
  const isOp = (c) => '+-*/×÷'.includes(c);
  if (isOp(token) && isOp(last)) {
    _finTxExpression = _finTxExpression.slice(0, -1) + token;
  } else if (token === '.') {
    // Дробову крапку дозволяти лише раз у поточному числі
    const lastNum = _finTxExpression.split(/[+\-*/×÷]/).pop();
    if (lastNum.includes('.')) return;
    if (!lastNum) _finTxExpression += '0'; // якщо порожньо — додати "0."
    _finTxExpression += token;
  } else {
    _finTxExpression += token;
  }
  _refreshTransactionModal();
}

function finCalcBackspace() {
  if (!_finTxExpression) return;
  _finTxExpression = _finTxExpression.slice(0, -1);
  _refreshTransactionModal();
}

function selectFinTxMainCat(name) {
  _finTxCategory = name;
  _finTxSubcategory = ''; // скидаємо підкатегорію при зміні основної
  _refreshTransactionModal();
}

function selectFinTxSubcat(name) {
  _finTxSubcategory = (_finTxSubcategory === name) ? '' : name; // toggle
  _refreshTransactionModal();
}

// === Дата ===
function _finTxDateLabel(ts) {
  const d = new Date(ts);
  const today = new Date(); today.setHours(0,0,0,0);
  const yest = new Date(today); yest.setDate(today.getDate() - 1);
  const day2 = new Date(today); day2.setDate(today.getDate() - 2);
  const dDate = new Date(d); dDate.setHours(0,0,0,0);
  if (dDate.getTime() === today.getTime()) return 'Сьогодні';
  if (dDate.getTime() === yest.getTime()) return 'Вчора';
  if (dDate.getTime() === day2.getTime()) return 'Позавчора';
  return d.toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric' });
}

function openFinDateModal() {
  const existing = document.getElementById('fin-date-modal');
  if (existing) existing.remove();
  const today = new Date(); today.setHours(0,0,0,0);
  const fmt = (offset) => {
    const d = new Date(today); d.setDate(today.getDate() + offset);
    return d.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' });
  };
  const currentYmd = new Date(_finTxDate).toISOString().slice(0, 10);
  const modal = document.createElement('div');
  modal.id = 'fin-date-modal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:600;display:flex;align-items:flex-end;justify-content:center;padding:0 16px 16px';
  modal.innerHTML = `
    <div onclick="closeFinDateModal()" style="position:absolute;inset:0;background:rgba(0,0,0,0.35);backdrop-filter:blur(4px)"></div>
    <div style="position:relative;width:100%;max-width:420px;background:rgba(255,255,255,0.30);backdrop-filter:blur(32px);-webkit-backdrop-filter:blur(32px);border-radius:24px;overflow:hidden;z-index:1;max-height:80vh;border:1.5px solid rgba(255,255,255,0.5);padding:0 20px">
      <div style="overflow-y:auto;max-height:80vh;padding:28px 0 calc(env(safe-area-inset-bottom)+28px);box-sizing:border-box">
      <div style="width:36px;height:4px;background:rgba(0,0,0,0.12);border-radius:2px;margin:0 auto 18px"></div>
      <div style="font-family:var(--font-display);font-size:18px;font-weight:700;color:#1e1040;margin-bottom:14px">Дата операції</div>
      <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:14px">
        <button onclick="setFinTxDateOffset(0)" style="padding:13px 14px;border-radius:12px;border:1.5px solid rgba(30,16,64,0.12);background:rgba(255,255,255,0.7);font-size:14px;font-weight:600;color:#1e1040;cursor:pointer;font-family:inherit;text-align:left">Сьогодні · ${fmt(0)}</button>
        <button onclick="setFinTxDateOffset(-1)" style="padding:13px 14px;border-radius:12px;border:1.5px solid rgba(30,16,64,0.12);background:rgba(255,255,255,0.7);font-size:14px;font-weight:600;color:#1e1040;cursor:pointer;font-family:inherit;text-align:left">Вчора · ${fmt(-1)}</button>
        <button onclick="setFinTxDateOffset(-2)" style="padding:13px 14px;border-radius:12px;border:1.5px solid rgba(30,16,64,0.12);background:rgba(255,255,255,0.7);font-size:14px;font-weight:600;color:#1e1040;cursor:pointer;font-family:inherit;text-align:left">Позавчора · ${fmt(-2)}</button>
        <button onclick="setFinTxDateOffset(-7)" style="padding:13px 14px;border-radius:12px;border:1.5px solid rgba(30,16,64,0.12);background:rgba(255,255,255,0.7);font-size:14px;font-weight:600;color:#1e1040;cursor:pointer;font-family:inherit;text-align:left">Тиждень тому · ${fmt(-7)}</button>
      </div>
      <div style="font-size:11px;font-weight:700;color:rgba(30,16,64,0.4);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px">Виберіть день</div>
      <!-- B-DATE-CLIP fix: padding-right:40px щоб помістився нативний iOS date indicator -->
      <input id="fin-date-input" type="date" value="${currentYmd}" max="${new Date().toISOString().slice(0,10)}"
        onchange="setFinTxDateFromInput(this.value)"
        style="width:100%;border:1.5px solid rgba(30,16,64,0.12);border-radius:12px;padding:11px 40px 11px 14px;font-size:15px;font-weight:600;font-family:inherit;color:#1e1040;outline:none;margin-bottom:14px;box-sizing:border-box;background:rgba(255,255,255,0.7);text-align:left;-webkit-appearance:none;appearance:none;min-height:44px">
      <button onclick="closeFinDateModal()" class="btn-cancel" style="width:100%">Закрити</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  setupModalSwipeClose(modal.querySelector('div:last-child'), closeFinDateModal);
}

function closeFinDateModal() {
  document.getElementById('fin-date-modal')?.remove();
}

function setFinTxDateOffset(offset) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  // Зберегти час 12:00 — щоб не плутати з UTC-зсувом
  d.setHours(12, 0, 0, 0);
  _finTxDate = d.getTime();
  closeFinDateModal();
  _refreshTransactionModal();
}

function setFinTxDateFromInput(ymd) {
  if (!ymd) return;
  const d = new Date(ymd + 'T12:00:00');
  if (isNaN(d.getTime())) return;
  _finTxDate = d.getTime();
  closeFinDateModal();
  _refreshTransactionModal();
}

function saveFinTransaction() {
  const amount = _safeFinCalc(_finTxExpression);
  if (!amount || amount <= 0) { showToast('Введи суму'); return; }
  if (!_finTxCategory) { showToast('Вибери категорію'); return; }

  const txs = getFinance();
  const baseFields = {
    type: _finTxCurrentType,
    amount,
    category: _finTxCategory,
    subcategory: _finTxSubcategory || undefined,
    comment: _finTxComment || '',
    ts: _finTxDate,
  };

  if (_finEditId) {
    const idx = txs.findIndex(x => x.id === _finEditId);
    if (idx !== -1) txs[idx] = { ...txs[idx], ...baseFields };
  } else {
    txs.unshift({ id: Date.now(), ...baseFields });
  }
  saveFinance(txs);
  closeFinTxModal();
  renderFinance();
  showToast(_finEditId ? '✓ Оновлено' : `✓ ${_finTxCurrentType === 'expense' ? 'Витрату' : 'Дохід'} додано`);
  _finEditId = null;
  _finTxComment = '';
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

  // Нова категорія — створюємо об'єкт (v2 структура), не рядок
  const catList = type === 'expense' ? cats.expense : cats.income;
  if (!catList.some(c => c.name === category)) {
    createFinCategory(type, { name: category });
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
// B-32 fix: явні маркери [MONTH_TOTAL], [TODAY_TOTAL] щоб AI не вигадував числа
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

  let parts = [`[MONTH_EXPENSES:${formatMoney(totalExp)}] [MONTH_INCOME:${formatMoney(totalInc)}] Фінанси за місяць: витрати ${formatMoney(totalExp)}, доходи ${formatMoney(totalInc)}`];
  if (budget.total > 0) parts.push(`[BUDGET:${formatMoney(budget.total)}] бюджет ${formatMoney(budget.total)}, залишилось ${formatMoney(budget.total - totalExp)}`);
  if (top3) parts.push(`топ категорії: ${top3}`);
  if (todaySum > 0) parts.push(`[TODAY_EXPENSES:${formatMoney(todaySum)}] сьогодні витрачено ${formatMoney(todaySum)}`);
  else parts.push('[TODAY_EXPENSES:0] сьогодні витрат не було');

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
        const amount = parseFloat(parsed.amount);
        const category = parsed.category || 'Інше';
        const comment = parsed.comment || '';
        const ts = Date.now();
        const txs2 = getFinance();
        txs2.unshift({ id: ts, type, amount, category, comment, ts });
        saveFinance(txs2);
        // B-48: створюємо картку у стрічці Inbox (раніше тільки при створенні через Inbox)
        // Це підтримує принцип "одного джерела правди" — будь-яка операція видима у стрічці
        try {
          const items = getInbox();
          const inboxText = `${type === 'expense' ? '-' : '+'}${formatMoney(amount)} · ${category}${comment ? ' — ' + comment : ''}`;
          items.unshift({ id: ts, text: inboxText, category: 'finance', ts, processed: true });
          saveInbox(items);
          renderInbox();
        } catch(e) {}
        renderFinance();
        try { localStorage.setItem('nm_owl_tab_ts_finance', '0'); tryBoardUpdate('finance'); } catch(e) {}
        addFinanceChatMsg('agent', `✓ ${type === 'expense' ? '-' : '+'}${formatMoney(amount)} · ${category}`);
        checkFinBudgetWarning(type, category, amount);
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
        // Фаза 2 v2: використовуємо createFinCategory (об'єктна структура)
        const type = parsed.type === 'income' ? 'income' : 'expense';
        const c = getFinCats();
        const exists = (c[type] || []).some(x => x.name.toLowerCase() === (parsed.name || '').toLowerCase());
        if (!exists) createFinCategory(type, { name: parsed.name });
        renderFinance();
        addFinanceChatMsg('agent', `✓ Категорію "${parsed.name}" ${exists ? 'вже існувала' : 'додано'}`);
      } else {
        safeAgentReply(reply, addFinanceChatMsg);
      }
    } catch {
      safeAgentReply(reply, addFinanceChatMsg);
    }
  } catch { addFinanceChatMsg('agent', 'Мережева помилка.'); }
  financeBarLoading = false;
}


// ===== Фаза 2 крок В: модалка редагування категорії =====

function toggleFinEditMode() {
  _finEditMode = !_finEditMode;
  renderFinance();
}

// Тимчасові поля що збираються поки модалка відкрита (до save)
let _finCatModalDraft = null;

function openCategoryEditModal(catId) {
  _finEditingCatId = catId;
  let draft;
  if (catId === 'new') {
    // Нова категорія — починаємо з порожнього + дефолтів
    draft = {
      name: '',
      icon: 'other',
      color: pickRandomCatColor(Date.now() % 14),
      subcategories: [],
      archived: false,
      type: currentFinTab === 'income' ? 'income' : 'expense',
    };
  } else {
    const found = findFinCatById(catId);
    if (!found) return;
    draft = { ...found.cat, type: found.type, subcategories: [...found.cat.subcategories] };
  }
  _finCatModalDraft = draft;

  const existing = document.getElementById('fin-cat-edit-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'fin-cat-edit-modal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:600;display:flex;align-items:flex-end;justify-content:center;padding:0 16px 16px';
  modal.innerHTML = _renderCatEditModalBody();
  document.body.appendChild(modal);
  setupModalSwipeClose(modal.querySelector('div:last-child'), closeCategoryEditModal);
}

function _renderCatEditModalBody() {
  const d = _finCatModalDraft;
  const isNew = _finEditingCatId === 'new';
  const iconsHtml = FIN_CAT_ICON_NAMES.map(name => {
    const active = name === d.icon;
    // B-59: data-cat-icon дозволяє точкове оновлення без re-render
    return `<button data-cat-icon="${name}" onclick="selectCatModalIcon('${name}')" style="width:42px;height:42px;border-radius:50%;border:2px solid ${active ? d.color : 'rgba(30,16,64,0.08)'};background:${active ? d.color + '20' : 'white'};display:flex;align-items:center;justify-content:center;cursor:pointer;font-family:inherit;padding:0">${finCatIcon(name, active ? d.color : 'rgba(30,16,64,0.55)', 20)}</button>`;
  }).join('');
  const colorsHtml = FIN_CAT_PALETTE.map(c => {
    const active = c === d.color;
    // B-59: data-cat-color дозволяє точкове оновлення без re-render
    return `<button data-cat-color="${c}" onclick="selectCatModalColor('${c}')" style="width:32px;height:32px;border-radius:50%;border:3px solid ${active ? '#1e1040' : 'transparent'};background:${c};cursor:pointer;font-family:inherit;padding:0"></button>`;
  }).join('');
  const subcatsHtml = d.subcategories.map((s, i) =>
    `<div style="display:flex;align-items:center;gap:6px">
      <input type="text" value="${escapeHtml(s)}" onchange="updateCatModalSubcat(${i}, this.value)" style="flex:1;border:1.5px solid rgba(30,16,64,0.1);border-radius:8px;padding:6px 10px;font-size:13px;font-family:inherit;color:#1e1040;outline:none;background:rgba(255,255,255,0.7)">
      <button onclick="removeCatModalSubcat(${i})" style="width:28px;height:28px;border-radius:8px;border:none;background:rgba(239,68,68,0.08);color:#dc2626;font-size:14px;cursor:pointer;font-family:inherit">×</button>
    </div>`
  ).join('');

  return `<div onclick="closeCategoryEditModal()" style="position:absolute;inset:0;background:rgba(0,0,0,0.35);backdrop-filter:blur(4px)"></div>
  <div style="position:relative;width:100%;max-width:480px;background:rgba(255,255,255,0.30);backdrop-filter:blur(32px);-webkit-backdrop-filter:blur(32px);border-radius:24px;overflow:hidden;z-index:1;max-height:85vh;border:1.5px solid rgba(255,255,255,0.5);padding:0 20px">
    <div style="overflow-y:auto;max-height:85vh;padding:28px 0 calc(env(safe-area-inset-bottom)+28px);box-sizing:border-box">
    <div style="width:36px;height:4px;background:rgba(0,0,0,0.12);border-radius:2px;margin:0 auto 18px"></div>
    <div style="font-family:var(--font-display);font-size:18px;font-weight:700;color:#1e1040;margin-bottom:14px">${isNew ? 'Нова категорія' : 'Редагувати категорію'}</div>

    <!-- Тип (тільки для нової — для існуючої не міняємо щоб не плутати транзакції) -->
    ${isNew ? `<div style="display:flex;gap:6px;margin-bottom:12px">
      <button onclick="setCatModalType('expense')" style="flex:1;padding:8px;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;border:1.5px solid ${d.type === 'expense' ? '#c2410c' : 'rgba(30,16,64,0.1)'};background:${d.type === 'expense' ? 'rgba(194,65,12,0.08)' : 'white'};color:${d.type === 'expense' ? '#c2410c' : 'rgba(30,16,64,0.4)'}">Витрата</button>
      <button onclick="setCatModalType('income')" style="flex:1;padding:8px;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;border:1.5px solid ${d.type === 'income' ? '#16a34a' : 'rgba(30,16,64,0.1)'};background:${d.type === 'income' ? 'rgba(22,163,74,0.08)' : 'white'};color:${d.type === 'income' ? '#16a34a' : 'rgba(30,16,64,0.4)'}">Дохід</button>
    </div>` : ''}

    <!-- Назва -->
    <div style="font-size:11px;font-weight:700;color:rgba(30,16,64,0.4);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px">Назва</div>
    <input id="cat-modal-name" type="text" value="${escapeHtml(d.name)}" oninput="_finCatModalDraft.name = this.value" placeholder="напр. Подорожі"
      style="width:100%;border:1.5px solid rgba(30,16,64,0.12);border-radius:12px;padding:11px 14px;font-size:16px;font-weight:600;font-family:inherit;color:#1e1040;outline:none;margin-bottom:14px;box-sizing:border-box;background:rgba(255,255,255,0.7)">

    <!-- Іконка -->
    <div style="font-size:11px;font-weight:700;color:rgba(30,16,64,0.4);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px">Іконка</div>
    <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:6px;margin-bottom:14px">${iconsHtml}</div>

    <!-- Колір -->
    <div style="font-size:11px;font-weight:700;color:rgba(30,16,64,0.4);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px">Колір</div>
    <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px">${colorsHtml}</div>

    <!-- Підкатегорії -->
    <div style="font-size:11px;font-weight:700;color:rgba(30,16,64,0.4);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px">Підкатегорії</div>
    <div id="cat-modal-subcats" style="display:flex;flex-direction:column;gap:6px;margin-bottom:8px">${subcatsHtml}</div>
    <button onclick="addCatModalSubcat()" style="width:100%;padding:8px;border-radius:10px;border:1.5px dashed rgba(30,16,64,0.15);background:transparent;color:rgba(30,16,64,0.5);font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;margin-bottom:14px">+ підкатегорія</button>

    <!-- Переміщення (тільки для існуючих) -->
    ${!isNew ? `<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-top:1px solid rgba(30,16,64,0.06)">
      <div>
        <div style="font-size:13px;font-weight:700;color:#1e1040">Позиція в сітці</div>
        <div style="font-size:11px;color:rgba(30,16,64,0.45);margin-top:2px">${(_finCatModalPositionInfo() || '')}</div>
      </div>
      <div style="display:flex;gap:6px">
        <button onclick="moveCatModalUp()" aria-label="Вгору" style="width:34px;height:34px;border-radius:10px;border:none;background:rgba(30,16,64,0.06);color:rgba(30,16,64,0.65);cursor:pointer;font-family:inherit;display:flex;align-items:center;justify-content:center"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="18 15 12 9 6 15"/></svg></button>
        <button onclick="moveCatModalDown()" aria-label="Вниз" style="width:34px;height:34px;border-radius:10px;border:none;background:rgba(30,16,64,0.06);color:rgba(30,16,64,0.65);cursor:pointer;font-family:inherit;display:flex;align-items:center;justify-content:center"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="6 9 12 15 18 9"/></svg></button>
      </div>
    </div>` : ''}

    <!-- Архівувати (toggle) -->
    ${!isNew ? `<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-top:1px solid rgba(30,16,64,0.06);margin-bottom:8px">
      <div>
        <div style="font-size:13px;font-weight:700;color:#1e1040">Архівувати</div>
        <div style="font-size:11px;color:rgba(30,16,64,0.45);margin-top:2px">Сховати з сітки, дані зберігаються</div>
      </div>
      <button onclick="toggleCatModalArchive()" style="width:44px;height:24px;border-radius:14px;border:none;background:${d.archived ? '#c2410c' : 'rgba(30,16,64,0.12)'};position:relative;cursor:pointer;font-family:inherit">
        <div style="width:18px;height:18px;border-radius:50%;background:white;position:absolute;top:3px;${d.archived ? 'right:3px' : 'left:3px'};transition:all 0.2s"></div>
      </button>
    </div>` : ''}

    <!-- Кнопки -->
    <div style="display:flex;gap:8px;margin-top:14px">
      ${!isNew ? `<button onclick="deleteCategoryFromModal()" style="padding:13px 16px;border-radius:12px;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);font-size:14px;font-weight:700;color:#dc2626;cursor:pointer;font-family:inherit">Видалити</button>` : ''}
      <button onclick="closeCategoryEditModal()" class="btn-cancel">Скасувати</button>
      <button onclick="saveCategoryFromModal()" class="btn-save-primary">${isNew ? 'Створити' : 'Зберегти'}</button>
    </div>
    </div>
  </div>`;
}

// B-59: зберігаємо scrollTop і focus перед re-render + точкові оновлення для частих дій
// (колір / іконка / видалення підкатегорії — без re-render всієї модалки)
function _refreshCatEditModal(options = {}) {
  const modal = document.getElementById('fin-cat-edit-modal');
  if (!modal) return;
  const scrollEl = modal.querySelector('div[style*="overflow-y:auto"]');
  const prevScroll = scrollEl ? scrollEl.scrollTop : 0;
  const activeId = document.activeElement?.id || '';
  const activeSelStart = document.activeElement?.selectionStart;
  const activeSelEnd = document.activeElement?.selectionEnd;
  modal.innerHTML = _renderCatEditModalBody();
  // Відновлюємо scrollTop
  const newScroll = modal.querySelector('div[style*="overflow-y:auto"]');
  if (newScroll && prevScroll > 0) newScroll.scrollTop = prevScroll;
  // Відновлюємо focus на тому ж полі
  if (activeId) {
    const el = document.getElementById(activeId);
    if (el && typeof el.focus === 'function') {
      el.focus();
      if (el.setSelectionRange && activeSelStart != null) {
        try { el.setSelectionRange(activeSelStart, activeSelEnd); } catch(e) {}
      }
    }
  }
}

// Точкові updates — міняють тільки стилі існуючих кнопок, без re-render (B-59)
function _updateCatModalIconHighlight() {
  const modal = document.getElementById('fin-cat-edit-modal');
  if (!modal) return;
  const d = _finCatModalDraft;
  const btns = modal.querySelectorAll('button[data-cat-icon]');
  btns.forEach(b => {
    const name = b.dataset.catIcon;
    const active = name === d.icon;
    b.style.border = `2px solid ${active ? d.color : 'rgba(30,16,64,0.08)'}`;
    b.style.background = active ? d.color + '20' : 'white';
    const svg = b.querySelector('svg');
    if (svg) svg.setAttribute('stroke', active ? d.color : 'rgba(30,16,64,0.55)');
  });
}
function _updateCatModalColorHighlight() {
  const modal = document.getElementById('fin-cat-edit-modal');
  if (!modal) return;
  const d = _finCatModalDraft;
  const btns = modal.querySelectorAll('button[data-cat-color]');
  btns.forEach(b => {
    const c = b.dataset.catColor;
    const active = c === d.color;
    b.style.border = `3px solid ${active ? '#1e1040' : 'transparent'}`;
  });
  // Іконки теж оновлюємо — вони підсвічуються активним кольором
  _updateCatModalIconHighlight();
}

function selectCatModalIcon(name) { _finCatModalDraft.icon = name; _updateCatModalIconHighlight(); }
function selectCatModalColor(c)   { _finCatModalDraft.color = c; _updateCatModalColorHighlight(); }
function setCatModalType(t)       { _finCatModalDraft.type = t; _refreshCatEditModal(); }
function toggleCatModalArchive()  { _finCatModalDraft.archived = !_finCatModalDraft.archived; _refreshCatEditModal(); }
function addCatModalSubcat()      { _finCatModalDraft.subcategories.push(''); _refreshCatEditModal(); }
function removeCatModalSubcat(i)  { _finCatModalDraft.subcategories.splice(i, 1); _refreshCatEditModal(); }
function updateCatModalSubcat(i, v) { _finCatModalDraft.subcategories[i] = v; }

// Підпис позиції у сітці (для модалки) — "позиція 3 з 8"
function _finCatModalPositionInfo() {
  if (_finEditingCatId === 'new' || !_finEditingCatId) return '';
  const found = findFinCatById(_finEditingCatId);
  if (!found) return '';
  const list = getFinCats()[found.type];
  return `позиція ${found.idx + 1} з ${list.length}`;
}

function moveCatModalUp()   { if (_finEditingCatId && _finEditingCatId !== 'new') { moveFinCategory(_finEditingCatId, -1); _refreshCatEditModal(); renderFinance(); } }
function moveCatModalDown() { if (_finEditingCatId && _finEditingCatId !== 'new') { moveFinCategory(_finEditingCatId, +1); _refreshCatEditModal(); renderFinance(); } }

function saveCategoryFromModal() {
  const d = _finCatModalDraft;
  // Прибрати порожні підкатегорії
  const subs = (d.subcategories || []).map(s => (s || '').trim()).filter(Boolean);
  const name = (d.name || '').trim();
  if (!name) { showToast('Введи назву'); return; }

  if (_finEditingCatId === 'new') {
    createFinCategory(d.type, { name, icon: d.icon, color: d.color, subcategories: subs });
    showToast('✓ Категорію створено');
  } else {
    updateFinCategory(_finEditingCatId, { name, icon: d.icon, color: d.color, subcategories: subs, archived: d.archived });
    showToast('✓ Збережено');
  }
  closeCategoryEditModal();
  renderFinance();
}

function deleteCategoryFromModal() {
  if (_finEditingCatId === 'new') return;
  if (!confirm('Видалити категорію? Транзакції збережуться, але без візуального кружечка.')) return;
  deleteFinCategory(_finEditingCatId);
  closeCategoryEditModal();
  renderFinance();
  showToast('✓ Видалено');
}

function closeCategoryEditModal() {
  document.getElementById('fin-cat-edit-modal')?.remove();
  _finEditingCatId = null;
  _finCatModalDraft = null;
}

// ===== Аналітика (окремий fullscreen екран) =====

function openFinAnalytics() {
  const existing = document.getElementById('fin-analytics-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'fin-analytics-modal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:500;display:flex;align-items:flex-end;justify-content:center';

  // Дані
  const allTxs = getFinance();
  const content = _buildAnalyticsContent(allTxs);

  modal.innerHTML = `
    <div onclick="closeFinAnalytics()" class="modal-backdrop"></div>
    <div style="position:relative;width:100%;max-width:480px;background:white;border-radius:24px 24px 0 0;z-index:1;max-height:92vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 -4px 24px rgba(30,16,64,0.1);animation:slideUp 0.3s ease-out">
      <div class="modal-handle" style="margin:8px auto"></div>
      <div style="padding:0 16px 8px;text-align:center">
        <div style="font-size:17px;font-weight:800;color:#1e1040">📊 Аналітика</div>
      </div>
      <div style="flex:1;overflow-y:auto;padding:0 14px calc(env(safe-area-inset-bottom,0px) + 16px)">
        ${content}
      </div>
    </div>`;
  document.body.appendChild(modal);
  setupModalSwipeClose(modal.querySelector('div:nth-child(2)'), closeFinAnalytics);
}

function closeFinAnalytics() {
  document.getElementById('fin-analytics-modal')?.remove();
}

// B-62: State аналітики (режим графіка + індекси міні-метрик)
let _analyticsChartMode = 'expenses-weekly'; // 'balance' | 'expenses-weekly' | 'income-vs-expense'
let _analyticsMiniIdx = [0, 0, 0]; // 3 незалежні блоки, кожен у своєму індексі метрики
let _analyticsBenchmarkEdit = false; // режим редагування benchmark (кастомні %)

function _buildAnalyticsContent(allTxs) {
  const sections = [];
  sections.push(_analyticsChart(allTxs));
  sections.push(_analyticsMiniMetrics(allTxs));
  sections.push(_analyticsBenchmark(allTxs));
  return sections.join('');
}

// B-62 Крок 1: Головний графік з 3 метриками на вибір.
// Toggle-перемикач над графіком: Капітал / Витрати по тижнях / Доходи vs Витрати
function _analyticsChart(allTxs) {
  const now = new Date();
  const WEEKS = 8;
  const weeks = [];
  for (let w = WEEKS - 1; w >= 0; w--) {
    const weekEnd = new Date(now);
    weekEnd.setDate(now.getDate() - w * 7);
    weekEnd.setHours(23, 59, 59, 999);
    const weekStart = new Date(weekEnd);
    weekStart.setDate(weekEnd.getDate() - 6);
    weekStart.setHours(0, 0, 0, 0);
    const exp = allTxs.filter(t => t.type === 'expense' && t.ts >= weekStart.getTime() && t.ts <= weekEnd.getTime()).reduce((s, t) => s + t.amount, 0);
    const inc = allTxs.filter(t => t.type === 'income' && t.ts >= weekStart.getTime() && t.ts <= weekEnd.getTime()).reduce((s, t) => s + t.amount, 0);
    const label = `${weekStart.getDate()}.${String(weekStart.getMonth() + 1).padStart(2, '0')}`;
    weeks.push({ label, exp, inc, isCurrent: w === 0 });
  }

  // Капітал = накопичувальний баланс (сума доходів мінус витрат на цей тиждень від всіх часів)
  const balances = [];
  let cumBalance = 0;
  // Початкове значення — сума всіх операцій до найраннішого тижня
  const firstWeekStart = new Date(now);
  firstWeekStart.setDate(now.getDate() - (WEEKS - 1) * 7 - 6);
  firstWeekStart.setHours(0, 0, 0, 0);
  allTxs.filter(t => t.ts < firstWeekStart.getTime()).forEach(t => {
    cumBalance += (t.type === 'income' ? t.amount : -t.amount);
  });
  weeks.forEach(w => { cumBalance += w.inc - w.exp; balances.push(cumBalance); });

  // Toggle кнопки
  const modes = [
    { id: 'balance',          label: 'Капітал',  desc: 'Накопичувальний баланс' },
    { id: 'expenses-weekly',  label: 'Витрати',  desc: 'Сума витрат по тижнях' },
    { id: 'income-vs-expense',label: 'Доходи',   desc: 'Доходи vs витрати' },
  ];
  const toggleHtml = `<div style="display:flex;gap:4px;background:rgba(30,16,64,0.04);border-radius:10px;padding:3px;margin-bottom:10px">
    ${modes.map(m => {
      const active = m.id === _analyticsChartMode;
      return `<button onclick="setAnalyticsChartMode('${m.id}')" style="flex:1;padding:6px;border-radius:8px;border:none;background:${active ? 'white' : 'transparent'};color:${active ? '#c2410c' : 'rgba(30,16,64,0.5)'};font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;box-shadow:${active ? '0 2px 6px rgba(30,16,64,0.08)' : 'none'}">${m.label}</button>`;
    }).join('')}
  </div>`;
  const modeObj = modes.find(m => m.id === _analyticsChartMode) || modes[1];

  // Рендер графіка залежно від режиму
  let chartHtml = '';
  if (_analyticsChartMode === 'balance') {
    // Лінія балансу (polyline)
    const minB = Math.min(0, ...balances);
    const maxB = Math.max(1, ...balances);
    const range = maxB - minB || 1;
    const pts = balances.map((b, i) => {
      const x = (i / (WEEKS - 1)) * 100;
      const y = 100 - ((b - minB) / range) * 100;
      return `${x},${y}`;
    }).join(' ');
    const zeroY = 100 - ((0 - minB) / range) * 100;
    chartHtml = `<svg viewBox="0 0 100 100" preserveAspectRatio="none" style="width:100%;height:100px;display:block">
      <line x1="0" y1="${zeroY}" x2="100" y2="${zeroY}" stroke="rgba(30,16,64,0.12)" stroke-width="0.3" stroke-dasharray="1,1"/>
      <polyline points="${pts}" fill="none" stroke="#0ea5e9" stroke-width="0.8" stroke-linecap="round" stroke-linejoin="round"/>
      ${balances.map((b, i) => {
        const x = (i / (WEEKS - 1)) * 100;
        const y = 100 - ((b - minB) / range) * 100;
        return `<circle cx="${x}" cy="${y}" r="1.2" fill="#0ea5e9"/>`;
      }).join('')}
    </svg>
    <div style="display:flex;gap:2px;margin-top:4px">${weeks.map(w => `<div style="flex:1;font-size:9px;font-weight:${w.isCurrent?'700':'500'};color:${w.isCurrent?'#c2410c':'rgba(30,16,64,0.35)'};text-align:center">${w.label}</div>`).join('')}</div>
    <div style="font-size:10px;color:rgba(30,16,64,0.4);margin-top:6px;text-align:center">Поточний: <span style="color:#0ea5e9;font-weight:700">${formatMoney(cumBalance)}</span></div>`;
  } else if (_analyticsChartMode === 'expenses-weekly') {
    const maxVal = Math.max(1, ...weeks.map(w => w.exp));
    const barsHtml = weeks.map(w => {
      const h = w.exp > 0 ? Math.max(4, Math.round(w.exp / maxVal * 80)) : 0;
      const col = w.isCurrent ? '#c2410c' : '#f97316';
      return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;min-width:0">
        <div style="flex:1;width:100%;display:flex;align-items:flex-end;justify-content:center">
          <div style="width:70%;height:${h}px;background:${col};border-radius:3px 3px 0 0"></div>
        </div>
        <div style="font-size:9px;font-weight:${w.isCurrent?'700':'500'};color:${w.isCurrent?'#c2410c':'rgba(30,16,64,0.35)'};margin-top:4px">${w.label}</div>
        ${w.exp > 0 ? `<div style="font-size:8px;font-weight:600;color:rgba(30,16,64,0.4);margin-top:1px">${formatMoney(w.exp)}</div>` : ''}
      </div>`;
    }).join('');
    chartHtml = `<div style="display:flex;gap:3px;align-items:flex-end;height:100px">${barsHtml}</div>`;
  } else {
    // income-vs-expense — двоколірні бари як було
    const maxVal = Math.max(1, ...weeks.map(w => Math.max(w.exp, w.inc)));
    const barsHtml = weeks.map(w => {
      const expH = w.exp > 0 ? Math.max(4, Math.round(w.exp / maxVal * 80)) : 0;
      const incH = w.inc > 0 ? Math.max(4, Math.round(w.inc / maxVal * 80)) : 0;
      return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:0;min-width:0">
        <div style="flex:1;width:100%;display:flex;gap:2px;align-items:flex-end">
          <div style="flex:1;height:${expH}px;background:#f97316;border-radius:3px 3px 0 0"></div>
          <div style="flex:1;height:${incH}px;background:#16a34a;border-radius:3px 3px 0 0"></div>
        </div>
        <div style="font-size:9px;font-weight:${w.isCurrent?'700':'500'};color:${w.isCurrent?'#c2410c':'rgba(30,16,64,0.35)'};margin-top:4px">${w.label}</div>
      </div>`;
    }).join('');
    chartHtml = `<div style="display:flex;gap:4px;align-items:flex-end;height:100px">${barsHtml}</div>
    <div style="display:flex;gap:10px;justify-content:center;margin-top:6px">
      <div style="display:flex;align-items:center;gap:4px"><div style="width:8px;height:8px;border-radius:50%;background:#f97316"></div><span style="font-size:10px;font-weight:600;color:rgba(30,16,64,0.4)">Витрати</span></div>
      <div style="display:flex;align-items:center;gap:4px"><div style="width:8px;height:8px;border-radius:50%;background:#16a34a"></div><span style="font-size:10px;font-weight:600;color:rgba(30,16,64,0.4)">Доходи</span></div>
    </div>`;
  }

  return `<div style="background:white;border-radius:20px;box-shadow:0 2px 12px rgba(30,16,64,0.06);padding:14px;margin-bottom:12px">
    ${toggleHtml}
    <div style="font-size:11px;color:rgba(30,16,64,0.4);margin-bottom:8px">${escapeHtml(modeObj.desc)} · 8 тижнів</div>
    ${chartHtml}
  </div>`;
}

// B-62 Крок 2: 9 метрик у 3 перемиканих міні-блоках.
// Кожен блок має стрілки ‹ › для перемикання метрики. Коротка назва + велике число + опис.
function _analyticsMiniMetrics(allTxs) {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();
  const prevFrom = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
  const prevTo = from;
  const monthExp = allTxs.filter(t => t.type === 'expense' && t.ts >= from && t.ts < to);
  const monthInc = allTxs.filter(t => t.type === 'income' && t.ts >= from && t.ts < to);
  const prevMonthExp = allTxs.filter(t => t.type === 'expense' && t.ts >= prevFrom && t.ts < prevTo);
  const curExp = monthExp.reduce((s, t) => s + t.amount, 0);
  const prevExp = prevMonthExp.reduce((s, t) => s + t.amount, 0);
  const curInc = monthInc.reduce((s, t) => s + t.amount, 0);
  const daysPassed = Math.max(1, now.getDate());
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

  // Топ категорія
  const catMap = {};
  monthExp.forEach(t => { catMap[t.category] = (catMap[t.category] || 0) + t.amount; });
  const topCats = Object.entries(catMap).sort((a, b) => b[1] - a[1]);

  // Середній чек + діапазон
  const amounts = monthExp.map(t => t.amount);
  const avgTx = amounts.length > 0 ? amounts.reduce((s, a) => s + a, 0) / amounts.length : 0;
  const maxTx = amounts.length > 0 ? Math.max(...amounts) : 0;

  // Витрати по днях
  const dayMap = {};
  monthExp.forEach(t => {
    const d = new Date(t.ts).toDateString();
    dayMap[d] = (dayMap[d] || 0) + t.amount;
  });
  const dayTotals = Object.values(dayMap);
  const maxDay = dayTotals.length > 0 ? Math.max(...dayTotals) : 0;

  // Прогноз до кінця місяця: поточний темп × днів у місяці
  const forecastEnd = daysPassed > 0 ? (curExp / daysPassed) * daysInMonth : 0;

  const metrics = [
    {
      label: 'Витрати місяця', value: formatMoney(curExp),
      desc: prevExp > 0 ? `${curExp >= prevExp ? '+' : ''}${Math.round((curExp - prevExp) / prevExp * 100)}% vs минулий місяць` : 'перший місяць з даними',
      color: '#c2410c',
    },
    {
      label: 'В середньому/день', value: formatMoney(Math.round(curExp / daysPassed)),
      desc: `за ${daysPassed} ${daysPassed === 1 ? 'день' : daysPassed < 5 ? 'дні' : 'днів'} місяця`,
      color: '#1e1040',
    },
    {
      label: 'Топ категорія', value: topCats.length > 0 ? topCats[0][0] : '—',
      desc: topCats.length > 0 ? `${formatMoney(topCats[0][1])} · ${Math.round(topCats[0][1] / curExp * 100)}% витрат` : 'немає даних',
      color: '#c2410c',
    },
    {
      label: 'Заощадження', value: curInc > 0 ? Math.round((curInc - curExp) / curInc * 100) + '%' : '—',
      desc: curInc > 0 ? `${formatMoney(curInc - curExp)} з ${formatMoney(curInc)}` : 'додай дохід',
      color: curInc > 0 && curInc > curExp ? '#16a34a' : '#c2410c',
    },
    {
      label: 'Операцій', value: monthExp.length,
      desc: `середня ${formatMoney(Math.round(avgTx))}`,
      color: '#0ea5e9',
    },
    {
      label: 'Максимум за день', value: formatMoney(Math.round(maxDay)),
      desc: dayTotals.length > 0 ? `найдорожчий з ${dayTotals.length} активних днів` : 'немає даних',
      color: '#c2410c',
    },
    {
      label: 'Найбільша операція', value: formatMoney(Math.round(maxTx)),
      desc: amounts.length > 0 ? `з ${amounts.length} операцій` : 'немає даних',
      color: '#c2410c',
    },
    {
      label: 'Прогноз місяця', value: formatMoney(Math.round(forecastEnd)),
      desc: `за поточним темпом до ${daysInMonth}.${String(now.getMonth() + 1).padStart(2, '0')}`,
      color: '#0ea5e9',
    },
    {
      label: 'Доходи місяця', value: formatMoney(curInc),
      desc: monthInc.length > 0 ? `${monthInc.length} надходжень` : 'доходів не було',
      color: '#16a34a',
    },
  ];

  const renderMini = (blockIdx) => {
    const idx = _analyticsMiniIdx[blockIdx] % metrics.length;
    const m = metrics[idx];
    return `<div style="flex:1;background:white;border-radius:14px;box-shadow:0 2px 8px rgba(30,16,64,0.05);padding:10px 8px;text-align:center;min-width:0;display:flex;flex-direction:column;justify-content:space-between">
      <div style="font-size:9px;font-weight:700;color:rgba(30,16,64,0.4);text-transform:uppercase;letter-spacing:0.05em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(m.label)}</div>
      <div style="font-size:${typeof m.value === 'string' && m.value.length > 6 ? '15px' : '19px'};font-weight:900;color:${m.color};line-height:1.1;margin:6px 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(String(m.value))}</div>
      <div style="font-size:9px;color:rgba(30,16,64,0.45);line-height:1.3;min-height:24px">${escapeHtml(m.desc)}</div>
      <div style="display:flex;gap:4px;margin-top:6px">
        <button onclick="shiftAnalyticsMini(${blockIdx}, -1)" aria-label="Попередня" style="flex:1;padding:3px;border-radius:6px;border:none;background:rgba(30,16,64,0.05);color:rgba(30,16,64,0.5);font-size:10px;cursor:pointer;font-family:inherit">‹</button>
        <div style="font-size:9px;color:rgba(30,16,64,0.3);align-self:center">${idx + 1}/${metrics.length}</div>
        <button onclick="shiftAnalyticsMini(${blockIdx}, 1)" aria-label="Наступна" style="flex:1;padding:3px;border-radius:6px;border:none;background:rgba(30,16,64,0.05);color:rgba(30,16,64,0.5);font-size:10px;cursor:pointer;font-family:inherit">›</button>
      </div>
    </div>`;
  };

  return `<div style="display:flex;gap:8px;margin-bottom:12px">
    ${renderMini(0)}${renderMini(1)}${renderMini(2)}
  </div>`;
}

// Крок 3: 3 інсайт-картки (legacy, не використовуємо після B-62 — залишаємо для сумісності)
function _analyticsInsightCards(allTxs) {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();
  const prevFrom = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
  const prevTo = from;

  const curExp = allTxs.filter(t => t.type === 'expense' && t.ts >= from && t.ts < to).reduce((s, t) => s + t.amount, 0);
  const prevExp = allTxs.filter(t => t.type === 'expense' && t.ts >= prevFrom && t.ts < prevTo).reduce((s, t) => s + t.amount, 0);
  const curInc = allTxs.filter(t => t.type === 'income' && t.ts >= from && t.ts < to).reduce((s, t) => s + t.amount, 0);

  // Картка 1: витрати vs минулий місяць
  let card1;
  if (prevExp > 0 && curExp > 0) {
    const pct = Math.round((curExp - prevExp) / prevExp * 100);
    const col = pct <= 0 ? '#16a34a' : '#c2410c';
    const arrow = pct <= 0 ? '↓' : '↑';
    card1 = `<div style="font-size:24px;font-weight:900;color:${col}">${pct > 0 ? '+' : ''}${pct}%</div>
      <div style="font-size:12px;color:rgba(30,16,64,0.5);margin-top:4px">витрати vs минулий місяць</div>
      <div style="font-size:11px;color:rgba(30,16,64,0.35);margin-top:2px">${arrow} ${formatMoney(curExp)} vs ${formatMoney(prevExp)}</div>`;
  } else {
    card1 = `<div style="font-size:18px;font-weight:800;color:rgba(30,16,64,0.3)">—</div>
      <div style="font-size:12px;color:rgba(30,16,64,0.4);margin-top:4px">витрати vs минулий</div>
      <div style="font-size:11px;color:rgba(30,16,64,0.35);margin-top:2px">недостатньо даних</div>`;
  }

  // Картка 2: топ-категорія + % від витрат
  const catMap = {};
  allTxs.filter(t => t.type === 'expense' && t.ts >= from && t.ts < to).forEach(t => { catMap[t.category] = (catMap[t.category] || 0) + t.amount; });
  const topCats = Object.entries(catMap).sort((a, b) => b[1] - a[1]);
  let card2;
  if (topCats.length > 0 && curExp > 0) {
    const [topName, topAmt] = topCats[0];
    const topPct = Math.round(topAmt / curExp * 100);
    card2 = `<div style="font-size:24px;font-weight:900;color:#c2410c">${topPct}%</div>
      <div style="font-size:12px;color:rgba(30,16,64,0.5);margin-top:4px">${escapeHtml(topName)}</div>
      <div style="font-size:11px;color:rgba(30,16,64,0.35);margin-top:2px">${formatMoney(topAmt)} · топ-категорія</div>`;
  } else {
    card2 = `<div style="font-size:18px;font-weight:800;color:rgba(30,16,64,0.3)">—</div>
      <div style="font-size:12px;color:rgba(30,16,64,0.4);margin-top:4px">топ-категорія</div>`;
  }

  // Картка 3: середній день
  const daysPassed = Math.max(1, now.getDate());
  const avgDay = Math.round(curExp / daysPassed);
  const savedPct = curInc > 0 ? Math.round((curInc - curExp) / curInc * 100) : 0;
  const savedCol = savedPct >= 20 ? '#16a34a' : savedPct >= 10 ? '#d97706' : '#c2410c';
  const card3 = `<div style="font-size:24px;font-weight:900;color:#1e1040">${formatMoney(avgDay)}</div>
    <div style="font-size:12px;color:rgba(30,16,64,0.5);margin-top:4px">в день (середнє)</div>
    <div style="font-size:11px;color:${savedCol};font-weight:700;margin-top:2px">${curInc > 0 ? 'Заощаджено ' + savedPct + '%' : ''}</div>`;

  const cardStyle = 'flex:1;background:white;border-radius:16px;box-shadow:0 2px 12px rgba(30,16,64,0.06);padding:14px 10px;text-align:center';
  return `<div style="display:flex;gap:8px;margin-bottom:12px">
    <div style="${cardStyle}">${card1}</div>
    <div style="${cardStyle}">${card2}</div>
    <div style="${cardStyle}">${card3}</div>
  </div>`;
}

// Крок 4: 50/30/20 benchmark з кастомними % і назвами (B-62).
// Кнопка ✎ у хедері → режим редагування (input'и для % і назв).
// Збереження у localStorage key 'nm_fin_benchmark' = { needs:{pct,name}, wants:{pct,name}, savings:{pct,name} }
function _getBenchmarkConfig() {
  try {
    const saved = JSON.parse(localStorage.getItem('nm_fin_benchmark') || 'null');
    if (saved && saved.needs && saved.wants && saved.savings) return saved;
  } catch(e) {}
  return {
    needs:   { pct: 50, name: 'Потреби' },
    wants:   { pct: 30, name: 'Бажання' },
    savings: { pct: 20, name: 'Заощадження' },
  };
}

function _analyticsBenchmark(allTxs) {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();
  const curInc = allTxs.filter(t => t.type === 'income' && t.ts >= from && t.ts < to).reduce((s, t) => s + t.amount, 0);
  const curExp = allTxs.filter(t => t.type === 'expense' && t.ts >= from && t.ts < to).reduce((s, t) => s + t.amount, 0);
  const cfg = _getBenchmarkConfig();

  if (curInc <= 0 && !_analyticsBenchmarkEdit) {
    return `<div style="background:white;border-radius:20px;box-shadow:0 2px 12px rgba(30,16,64,0.06);padding:16px;margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <div class="fin-section-label">Розподіл доходу</div>
        <button onclick="toggleAnalyticsBenchmarkEdit()" aria-label="Редагувати" style="width:28px;height:28px;border-radius:50%;border:none;background:rgba(30,16,64,0.05);color:rgba(30,16,64,0.5);cursor:pointer;font-family:inherit"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg></button>
      </div>
      <div style="font-size:13px;color:rgba(30,16,64,0.45)">Додай дохід щоб побачити розподіл</div>
    </div>`;
  }

  const spent = curExp;
  const saved = Math.max(0, curInc - curExp);

  // Категоризація витрат: потреби (Їжа, Житло, Транспорт, Здоров'я) vs бажання (решта)
  const needsCats = ['їжа', 'житло', 'транспорт', "здоров'я", 'здоровʼя', 'здоровя'];
  const monthExp = allTxs.filter(t => t.type === 'expense' && t.ts >= from && t.ts < to);
  const needsAmt = monthExp.filter(t => needsCats.includes(t.category.toLowerCase())).reduce((s, t) => s + t.amount, 0);
  const wantsAmt = spent - needsAmt;

  const denom = curInc > 0 ? curInc : 1;
  const needsPct = Math.round(needsAmt / denom * 100);
  const wantsPct = Math.round(wantsAmt / denom * 100);
  const savedPct = Math.round(saved / denom * 100);

  // Режим редагування: input'и для кастомних % і назв
  if (_analyticsBenchmarkEdit) {
    const editRow = (key, real, color) => {
      const item = cfg[key];
      return `<div style="margin-bottom:10px">
        <div style="display:flex;gap:6px;align-items:center;margin-bottom:4px">
          <div style="width:10px;height:10px;border-radius:50%;background:${color};flex-shrink:0"></div>
          <input type="text" value="${escapeHtml(item.name)}" oninput="setBenchmarkField('${key}','name',this.value)" style="flex:1;border:1.5px solid rgba(30,16,64,0.12);border-radius:8px;padding:5px 10px;font-size:13px;font-weight:600;font-family:inherit;color:#1e1040;outline:none;background:rgba(255,255,255,0.95)">
          <input type="number" min="0" max="100" value="${item.pct}" oninput="setBenchmarkField('${key}','pct',parseInt(this.value)||0)" style="width:55px;border:1.5px solid rgba(30,16,64,0.12);border-radius:8px;padding:5px 8px;font-size:13px;font-weight:700;font-family:inherit;color:#1e1040;outline:none;text-align:right">
          <span style="font-size:12px;color:rgba(30,16,64,0.4)">%</span>
        </div>
        <div style="font-size:10px;color:rgba(30,16,64,0.4)">фактично: ${real}%</div>
      </div>`;
    };
    const totalPct = cfg.needs.pct + cfg.wants.pct + cfg.savings.pct;
    const sumWarning = totalPct !== 100 ? `<div style="font-size:11px;color:#c2410c;margin-bottom:8px">⚠️ Сума ${totalPct}% — рекомендовано 100%</div>` : '';
    return `<div style="background:white;border-radius:20px;box-shadow:0 2px 12px rgba(30,16,64,0.06);padding:16px;margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <div class="fin-section-label">Розподіл доходу · редагування</div>
        <button onclick="toggleAnalyticsBenchmarkEdit()" style="padding:5px 12px;border-radius:10px;border:none;background:#c2410c;color:white;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit">Готово</button>
      </div>
      ${sumWarning}
      ${editRow('needs', needsPct, '#f97316')}
      ${editRow('wants', wantsPct, '#0ea5e9')}
      ${editRow('savings', savedPct, '#22c55e')}
      <button onclick="resetBenchmarkConfig()" style="width:100%;padding:8px;border-radius:10px;border:1.5px dashed rgba(30,16,64,0.15);background:transparent;color:rgba(30,16,64,0.5);font-size:12px;font-weight:600;cursor:pointer;font-family:inherit">Скинути до 50/30/20</button>
    </div>`;
  }

  // Звичайний режим (перегляд)
  const bar = (cfgItem, realPct, color) => {
    const target = cfgItem.pct;
    const w = Math.max(2, Math.min(100, realPct));
    const isOver = realPct > target;
    return `<div style="margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;font-size:12px;font-weight:600;margin-bottom:4px">
        <span style="color:#1e1040">${escapeHtml(cfgItem.name)}</span>
        <span style="color:${isOver ? '#c2410c' : color};font-weight:700">${realPct}% <span style="font-weight:400;color:rgba(30,16,64,0.35)">(ціль ${target}%)</span></span>
      </div>
      <div style="height:8px;background:rgba(30,16,64,0.06);border-radius:4px;overflow:hidden;position:relative">
        <div style="height:100%;width:${w}%;background:${color};border-radius:4px;transition:width 0.5s"></div>
        <div style="position:absolute;top:0;bottom:0;left:${target}%;width:2px;background:rgba(30,16,64,0.25)"></div>
      </div>
    </div>`;
  };

  return `<div style="background:white;border-radius:20px;box-shadow:0 2px 12px rgba(30,16,64,0.06);padding:16px;margin-bottom:12px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
      <div class="fin-section-label">Розподіл доходу</div>
      <button onclick="toggleAnalyticsBenchmarkEdit()" aria-label="Редагувати" style="width:28px;height:28px;border-radius:50%;border:none;background:rgba(30,16,64,0.05);color:rgba(30,16,64,0.5);cursor:pointer;font-family:inherit"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg></button>
    </div>
    ${bar(cfg.needs, needsPct, '#f97316')}
    ${bar(cfg.wants, wantsPct, '#0ea5e9')}
    ${bar(cfg.savings, savedPct, '#22c55e')}
    <div style="font-size:11px;color:rgba(30,16,64,0.35);margin-top:8px;border-top:1px solid rgba(30,16,64,0.06);padding-top:8px">
      ${escapeHtml(cfg.needs.name)} ${cfg.needs.pct}% · ${escapeHtml(cfg.wants.name)} ${cfg.wants.pct}% · ${escapeHtml(cfg.savings.name)} ${cfg.savings.pct}%. Тап ✎ щоб змінити % або назви.
    </div>
  </div>`;
}

// B-62 обробники
function setAnalyticsChartMode(mode) { _analyticsChartMode = mode; _refreshAnalyticsContent(); }
function shiftAnalyticsMini(blockIdx, delta) {
  _analyticsMiniIdx[blockIdx] = (_analyticsMiniIdx[blockIdx] + delta + 999) % 9;
  _refreshAnalyticsContent();
}
function toggleAnalyticsBenchmarkEdit() { _analyticsBenchmarkEdit = !_analyticsBenchmarkEdit; _refreshAnalyticsContent(); }
function setBenchmarkField(key, field, value) {
  const cfg = _getBenchmarkConfig();
  if (!cfg[key]) return;
  cfg[key][field] = value;
  localStorage.setItem('nm_fin_benchmark', JSON.stringify(cfg));
  // Не рендеримо зараз — користувач пише, перерендер лише коли вийде з edit
}
function resetBenchmarkConfig() {
  localStorage.removeItem('nm_fin_benchmark');
  _refreshAnalyticsContent();
}
function _refreshAnalyticsContent() {
  const modal = document.getElementById('fin-analytics-modal');
  if (!modal) return;
  const scrollEl = modal.querySelector('div[style*="overflow-y:auto"]');
  if (!scrollEl) return;
  const prevScroll = scrollEl.scrollTop;
  const activeId = document.activeElement?.id || '';
  const activeSelStart = document.activeElement?.selectionStart;
  scrollEl.innerHTML = _buildAnalyticsContent(getFinance());
  scrollEl.scrollTop = prevScroll;
  if (activeId) {
    const el = document.getElementById(activeId);
    if (el && typeof el.focus === 'function') {
      el.focus();
      if (el.setSelectionRange && activeSelStart != null) {
        try { el.setSelectionRange(activeSelStart, activeSelStart); } catch(e) {}
      }
    }
  }
}

// === WINDOW EXPORTS (HTML handlers only) ===
Object.assign(window, {
  openAddTransaction, setCurrency, setFinPeriod, switchFinTab,
  sendFinanceBarMessage, openFinBudgetModal,
  openEditTransaction, closeFinTxModal,
  saveFinTransaction, deleteFinTransaction,
  closeFinBudgetModal, saveFinBudgetFromModal, openAllTransactions,
  toggleFinTabType, // Фаза 2 (K-01): тап на круг = перемикач Витрати⇄Доходи
  shiftFinPeriod,   // Фаза 2 крок Б: стрілки навігації періоду
  // Фаза 2 крок В: режим редагування + модалка категорії
  toggleFinEditMode, openCategoryEditModal, closeCategoryEditModal,
  saveCategoryFromModal, deleteCategoryFromModal,
  selectCatModalIcon, selectCatModalColor, setCatModalType, toggleCatModalArchive,
  addCatModalSubcat, removeCatModalSubcat, updateCatModalSubcat,
  moveCatModalUp, moveCatModalDown, // переміщення категорій (замість drag)
  // Фаза 3: модалка транзакції з калькулятором
  finCalcAppend, finCalcBackspace,
  selectFinTxMainCat, selectFinTxSubcat,
  openFinDateModal, closeFinDateModal, setFinTxDateOffset, setFinTxDateFromInput,
  // Аналітика
  openFinAnalytics, closeFinAnalytics,
  // B-62 Аналітика v2: режим графіка, міні-метрики, benchmark edit
  setAnalyticsChartMode, shiftAnalyticsMini, toggleAnalyticsBenchmarkEdit,
  setBenchmarkField, resetBenchmarkConfig,
});
// _finTxComment мусить бути доступний з inline oninput
Object.defineProperty(window, '_finTxComment', {
  get() { return _finTxComment; },
  set(v) { _finTxComment = v; },
  configurable: true,
});
// Експортуємо drafт у window для inline oninput у модалці
Object.defineProperty(window, '_finCatModalDraft', {
  get() { return _finCatModalDraft; },
  set(v) { _finCatModalDraft = v; },
  configurable: true,
});
