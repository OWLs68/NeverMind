// ============================================================
// finance-cats.js — Категорії Фінансів (CRUD, іконки, палітра)
// Винесено з finance.js у рефакторингу 17.04.2026 (сесія gHCOh).
// ============================================================

import { getFinance, saveFinance } from './finance.js';
import { t } from '../core/utils.js';

// ===== SVG-бібліотека іконок (41 стиль Lucide/Heroicons, stroke-based) =====
const FIN_CAT_ICONS = {
  // Базові
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
  // B-56: +20 до 40
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

export function finCatIcon(name, color = 'currentColor', size = 24) {
  const p = FIN_CAT_ICONS[name] || FIN_CAT_ICONS.other;
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
}

export const FIN_CAT_ICON_NAMES = Object.keys(FIN_CAT_ICONS);

// ===== Палітра (БЕЗ фіолетового) =====
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
  '#78716c', // камʼяний сірий
  '#a16207', // темний бурштин
];

export function pickRandomCatColor(seed) {
  const idx = seed != null ? (seed % FIN_CAT_PALETTE.length) : Math.floor(Math.random() * FIN_CAT_PALETTE.length);
  return FIN_CAT_PALETTE[idx];
}

// ===== Дефолти =====
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

const FIN_DEFAULT_SUBCATS = {
  'Їжа':       ['Продукти','Ресторан','Кафе','Доставка','Фастфуд'],
  'Транспорт': ['Паливо','Таксі','Парковка','Громадський','Ремонт авто'],
  'Підписки':  ['Стрімінг','Музика','Хмара','Додатки','Ігри'],
  'Здоровʼя':  ['Аптека','Лікар','Спортзал','Аналізи','Косметика'],
  'Житло':     ['Оренда','Комунальні','Інтернет','Ремонт','Меблі'],
  'Покупки':   ['Одяг','Техніка','Книги','Подарунки','Дім'],
};

// B-78: виразні дефолтні кольори для всіх відомих назв (expense+income).
// Коли AI або юзер створюють категорію з відомою назвою — колір береться звідси
// замість випадкового (`pickRandomCatColor` іноді видавав сірий #78716c що виглядає як archived).
const FIN_DEFAULT_COLORS = {
  // Витрати — головні
  'Їжа':        '#f97316', // оранжевий — апетитний
  'Їда':        '#f97316',
  'Транспорт':  '#22c55e', // зелений — рух
  'Авто':       '#22c55e',
  'Підписки':   '#a16207', // темний бурштин — підписний сервіс
  'Здоровʼя':   '#ec4899', // рожевий — серце
  "Здоров'я":   '#ec4899',
  'Здоровя':    '#ec4899',
  'Житло':      '#ef4444', // червоний — дім
  'Покупки':    '#14b8a6', // бірюзовий
  'Інше':       '#78716c', // сірий — єдине допустиме місце сірого (Інше-як-інше)
  // Витрати — типові назви що AI генерує
  'Курево':     '#0ea5e9', // блакитний
  'Сигарети':   '#0ea5e9',
  'Кафе':       '#f59e0b', // бурштиновий
  'Паливо':     '#eab308', // жовтий
  'Бензин':     '#eab308',
  'Спорт':      '#84cc16', // лайм
  'Спортзал':   '#84cc16',
  'Розваги':    '#f43f5e', // малиновий
  'Дозвілля':   '#f43f5e',
  'Освіта':     '#3b82f6', // синій
  'Подорожі':   '#06b6d4', // циан
  'Зв\'язок':   '#6366f1', // індиго
  'Звязок':     '#6366f1',
  'Інтернет':   '#6366f1',
  'Трава':      '#22c55e',
  'Борги':      '#ef4444',
  'Робота':     '#a16207',
  // Доходи
  'Зарплата':   '#22c55e', // зелений — основний дохід
  'Надходження':'#16a34a', // темно-зелений
  'Повернення': '#14b8a6', // бірюзовий
};

// "Зламаний" сірий який pickRandomCatColor видавав випадково для відомих категорій.
// Міграція: якщо у відомій категорії цей колір — замінюємо на FIN_DEFAULT_COLORS.
const FIN_BROKEN_DEFAULT_COLOR = '#78716c';

// ===== CRUD =====
function _makeCatObj(name, idx) {
  const safeSlug = name.toLowerCase().replace(/[^\wа-яґєії]/gi, '_').slice(0, 20);
  return {
    id: 'cat_' + safeSlug + '_' + Date.now().toString(36) + idx,
    name,
    icon: FIN_DEFAULT_ICONS[name] || 'other',
    color: FIN_DEFAULT_COLORS[name] || pickRandomCatColor(idx),
    // B-58: автогенерація — максимум 3 підкатегорії, решту юзер додасть сам.
    subcategories: (FIN_DEFAULT_SUBCATS[name] || []).slice(0, 3),
    archived: false,
    order: idx,
  };
}

function _migrateFinCats(saved) {
  if (!saved) {
    const fresh = {
      expense: ['Їжа','Транспорт','Підписки','Здоровʼя','Житло','Покупки','Інше'].map((n, i) => _makeCatObj(n, i)),
      income:  ['Зарплата','Надходження','Повернення','Інше'].map((n, i) => _makeCatObj(n, i)),
    };
    localStorage.setItem('nm_finance_cats', JSON.stringify(fresh));
    return fresh;
  }
  // B-70 fix (17.04): перевіряємо КОЖЕН елемент, не тільки перший.
  // B-78 fix (17.04 KTQZA): ремап "зламаного" сірого у відомих категорій +
  // дефолтна іконка/підкатегорії для відомих назв якщо порожні.
  const normalize = (list, startIdx) => (list || []).map((c, i) => {
    if (typeof c === 'string') return _makeCatObj(c, startIdx + i);
    if (!c || typeof c !== 'object') return _makeCatObj(t('fincat.fallback.unknown', 'Невідомо'), startIdx + i);
    if (!c.id || !c.name) return _makeCatObj(c.name || t('fincat.fallback.no_name', 'Без назви'), startIdx + i);
    const known = FIN_DEFAULT_COLORS[c.name];
    if (!c.icon || c.icon === 'other') c.icon = FIN_DEFAULT_ICONS[c.name] || c.icon || 'other';
    if (!c.color) c.color = known || pickRandomCatColor(i);
    // Ремап зламаного сірого: якщо категорія з відомою назвою має #78716c (не "Інше" — там сірий легальний) — замінити.
    else if (c.color.toLowerCase() === FIN_BROKEN_DEFAULT_COLOR && known && known !== FIN_BROKEN_DEFAULT_COLOR) c.color = known;
    if (!Array.isArray(c.subcategories)) c.subcategories = [];
    // B-58: автогенерація — максимум 3 підкатегорії.
    if (c.subcategories.length === 0 && FIN_DEFAULT_SUBCATS[c.name]) c.subcategories = FIN_DEFAULT_SUBCATS[c.name].slice(0, 3);
    if (typeof c.archived !== 'boolean') c.archived = false;
    if (typeof c.order !== 'number') c.order = i;
    return c;
  });
  // B-75 fix (17.04 KTQZA): дедуп дублікатів за назвою (case-insensitive).
  // Історична проблема — якщо є дві "Їжа" → донат малює два сегменти з тим самим sum
  // (catMap групує по name), переповнення кола → "фрагментація".
  const dedupe = (list) => {
    const seen = new Map();
    for (const c of list) {
      const key = String(c.name || '').trim().toLowerCase();
      if (!key) continue;
      if (!seen.has(key)) {
        seen.set(key, c);
      } else {
        // Дубль — мержимо підкатегорії у першу, першу залишаємо.
        const first = seen.get(key);
        const firstSubs = Array.isArray(first.subcategories) ? first.subcategories : [];
        const dupSubs = Array.isArray(c.subcategories) ? c.subcategories : [];
        const mergedSubs = [...firstSubs];
        dupSubs.forEach(s => { if (!mergedSubs.includes(s)) mergedSubs.push(s); });
        first.subcategories = mergedSubs;
      }
    }
    return Array.from(seen.values());
  };
  const migrated = {
    expense: dedupe(normalize(saved.expense, 0)),
    income:  dedupe(normalize(saved.income, 1000)),
  };
  const needsSave = JSON.stringify(saved) !== JSON.stringify(migrated);
  if (needsSave) localStorage.setItem('nm_finance_cats', JSON.stringify(migrated));
  return migrated;
}

export function getFinCats() {
  const saved = JSON.parse(localStorage.getItem('nm_finance_cats') || 'null');
  return _migrateFinCats(saved);
}
export function saveFinCats(obj) { localStorage.setItem('nm_finance_cats', JSON.stringify(obj)); }

export function findFinCatById(id) {
  const cats = getFinCats();
  for (const type of ['expense', 'income']) {
    const idx = cats[type].findIndex(c => c.id === id);
    if (idx !== -1) return { cat: cats[type][idx], type, idx };
  }
  return null;
}

export function createFinCategory(type, data) {
  const cats = getFinCats();
  const list = cats[type] || [];
  const order = list.length;
  const newCat = {
    id: 'cat_' + (data.name || 'new').toLowerCase().replace(/[^\wа-яґєії]/gi, '_').slice(0, 20) + '_' + Date.now().toString(36),
    name: data.name || t('fincat.fallback.no_name', 'Без назви'),
    icon: data.icon || FIN_DEFAULT_ICONS[data.name] || 'other',
    color: data.color || FIN_DEFAULT_COLORS[data.name] || pickRandomCatColor(order),
    // B-58: якщо юзер/AI задав явно — беремо як є (до 3 максимум); якщо нема — дефолтні обмежені до 3.
    subcategories: data.subcategories && data.subcategories.length ? data.subcategories.slice(0, 3) : (FIN_DEFAULT_SUBCATS[data.name] || []).slice(0, 3),
    archived: false,
    order,
  };
  list.push(newCat);
  cats[type] = list;
  saveFinCats(cats);
  return newCat;
}

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

export function deleteFinCategory(id) {
  const found = findFinCatById(id);
  if (!found) return false;
  const cats = getFinCats();
  cats[found.type].splice(found.idx, 1);
  cats[found.type].forEach((c, i) => c.order = i);
  saveFinCats(cats);
  return true;
}

// Merge: переносить транзакції з fromId у toId і видаляє from.
// Circular import getFinance/saveFinance з finance.js — ОК, виклик не на старті модуля.
export function mergeFinCategories(fromId, toId) {
  const fromCat = findFinCatById(fromId);
  const toCat = findFinCatById(toId);
  if (!fromCat || !toCat) return { ok: false, reason: t('fincat.err.cat_not_found', 'Категорію не знайдено') };
  if (fromCat.type !== toCat.type) return { ok: false, reason: t('fincat.err.diff_types', 'Різні типи (expense/income)') };
  const txs = getFinance();
  let changed = 0;
  txs.forEach(t => {
    if (t.category === fromCat.cat.name) { t.category = toCat.cat.name; changed++; }
  });
  if (changed > 0) saveFinance(txs);
  const toCats = getFinCats();
  const toObj = toCats[toCat.type][toCat.idx];
  const fromObj = toCats[fromCat.type][fromCat.idx];
  fromObj.subcategories.forEach(s => { if (!toObj.subcategories.includes(s)) toObj.subcategories.push(s); });
  toCats[fromCat.type].splice(fromCat.idx, 1);
  toCats[fromCat.type].forEach((c, i) => c.order = i);
  saveFinCats(toCats);
  return { ok: true, txsMoved: changed, from: fromCat.cat.name, to: toCat.cat.name };
}

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
  return { ok: false, reason: t('fincat.err.cat_not_found', 'Категорію не знайдено') };
}

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
