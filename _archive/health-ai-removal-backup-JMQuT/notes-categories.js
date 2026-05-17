// notes-categories.js — канонічний довідник категорій нотаток.
//
// Створено 01.05.2026 (сесія LW3j8) у рамках i18n рефакторингу notes.js.
// До цього: дві мапи у notes.js (FOLDER_ICON_MAP, FOLDER_COLORS) з
// українськими назвами як ключами — це блокувало переклад на польську,
// бо при зміні мови ключі не збігалися б з тим що AI присвоює як `folder`.
//
// Архітектура:
//   - `id` (англ., канонічний, не для UI) — ключ у словнику
//   - `getCategoryName(id)` повертає поточну українську назву через t()
//   - При перекладі — fallback змінюється у словнику, ID і логіка lookup лишаються
//
// Споживачі (у notes.js):
//   - getFolderIcon(folderName)     — пошук іконки за назвою папки
//   - getFolderColor(folderName)    — пошук фону+емодзі за назвою папки
//   - _autoIconKey(folderName)      — авто-присвоєння іконки при створенні нової папки
//
// AI пише `folder: 'Харчування'` (українською поточної мови) — пошук
// знаходить через getCategoryName('food') === 'Харчування'.

import { t } from '../core/utils.js';

// Канонічний список 20 категорій. Поле `dot` — emoji для кольорової мапи (9 з 20).
export const NOTE_CATEGORIES = [
  { id: 'food',     icon: 'food',     dot: '🥑' },
  { id: 'finance',  icon: 'money',    dot: '💸' },
  { id: 'health',   icon: 'heart',    dot: '💪' },
  { id: 'work',     icon: 'work',     dot: '🎯' },
  { id: 'study',    icon: 'book',     dot: '🧠' },
  { id: 'ideas',    icon: 'bulb',     dot: '💡' },
  { id: 'personal', icon: 'person',   dot: '⚡' },
  { id: 'travel',   icon: 'plane',    dot: '✈️' },
  { id: 'goals',    icon: 'target' },
  { id: 'sport',    icon: 'sport' },
  { id: 'music',    icon: 'music' },
  { id: 'home',     icon: 'home' },
  { id: 'car',      icon: 'car' },
  { id: 'shopping', icon: 'shopping' },
  { id: 'people',   icon: 'users' },
  { id: 'projects', icon: 'zap' },
  { id: 'nature',   icon: 'leaf' },
  { id: 'coffee',   icon: 'coffee' },
  { id: 'photo',    icon: 'camera' },
];

// Назва категорії поточною мовою. При зміні мови — фолбек у t() підмінюється
// зі словника. Зараз словника нема — t() повертає fallback як є.
export function getCategoryName(id) {
  const names = {
    food:     t('notes.cat.food',     'Харчування'),
    finance:  t('notes.cat.finance',  'Фінанси'),
    health:   t('notes.cat.health',   "Здоров'я"),
    work:     t('notes.cat.work',     'Робота'),
    study:    t('notes.cat.study',    'Навчання'),
    ideas:    t('notes.cat.ideas',    'Ідеї'),
    personal: t('notes.cat.personal', 'Особисте'),
    travel:   t('notes.cat.travel',   'Подорожі'),
    goals:    t('notes.cat.goals',    'Цілі'),
    sport:    t('notes.cat.sport',    'Спорт'),
    music:    t('notes.cat.music',    'Музика'),
    home:     t('notes.cat.home',     'Дім'),
    car:      t('notes.cat.car',      'Авто'),
    shopping: t('notes.cat.shopping', 'Покупки'),
    people:   t('notes.cat.people',   'Люди'),
    projects: t('notes.cat.projects', 'Проекти'),
    nature:   t('notes.cat.nature',   'Природа'),
    coffee:   t('notes.cat.coffee',   'Кава'),
    photo:    t('notes.cat.photo',    'Фото'),
  };
  return names[id] || null;
}

// Знайти категорію за назвою папки. Двоступеневий пошук:
//   1) Точне співпадіння (швидкий випадок)
//   2) Нормалізоване (без апострофів, в нижньому регістрі) — покриває
//      legacy дані типу 'Здоровя' (без апострофа) які ще зустрічаються
//      у тестерів. Раніше це робилось дублюванням ключа у мапі.
export function findCategoryByFolder(folderName) {
  if (!folderName) return null;
  const exact = NOTE_CATEGORIES.find(c => getCategoryName(c.id) === folderName);
  if (exact) return exact;
  const norm = folderName.replace(/[ʼ']/g, '').toLowerCase();
  return NOTE_CATEGORIES.find(c => {
    const n = getCategoryName(c.id);
    return n && n.replace(/[ʼ']/g, '').toLowerCase() === norm;
  }) || null;
}
