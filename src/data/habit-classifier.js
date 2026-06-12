// src/data/habit-classifier.js
//
// Детермінований класифікатор типу звички за назвою (CLAUDE.md правило 12 —
// детерміноване → код, не промпт). Живе у src/data/ поруч з ua-time-parser.js:
// це мовна класифікація-логіка (канонічні keyword-стеми), НЕ UI-рядки, тому
// тут українські слова не обгортаються у t() — це матчинг, не текст показу.
//
// Контекст: tool save_habit не має параметра type, тож AI-створені звички без
// цього гарду завжди build. «Кинути курити» має стати quit-челенджем (стрик
// «тримаюсь»), не build-звичкою з відсотками. Гард — backstop у точках
// створення з AI; ручна модалка має явний перемикач і його не чіпає.

import { generateUUID } from '../core/uuid.js';

// startsWith по словах (не includes по підрядку) — щоб «скинути вагу» НЕ
// ловилось як quit через підрядок «кину».
const QUIT_PREFIXES = ['кину', 'кинь', 'покину', 'брос', 'відмов', 'перест', 'позбу', "зав'яз"];
// Negative / зменшувальні форми: «не курити / пити / вживати / їсти» + «менше
// курити / пити …» (зменшення шкідливого = quit-челендж, не build з відсотками).
const QUIT_NEG_RE = /(^|\s)(не|менше)\s+(пал|кур|пи|вжива|їст|жер)/;

export function inferHabitType(name) {
  const n = (name || '').toLowerCase().replace(/['’ʼ]/g, "'");
  if (QUIT_NEG_RE.test(n)) return 'quit';
  const words = n.split(/[\s,.;!?-]+/).filter(Boolean);
  return words.some(w => QUIT_PREFIXES.some(p => w.startsWith(p))) ? 'quit' : 'build';
}

// Фабрика habit-сутності — ЄДИНЕ джерело форми звички. Раніше об'єкт будувався у
// 5 місцях (ручна модалка + 2× create_habit + inbox save_habit + evening) з дрібними
// розбіжностями → quit-баг 7uxlr7 жив у 4 копіях. Тут також закрито Supabase-
// несумісність: id ЗАВЖДИ generateUUID (inbox.js раніше id: Date.now() — колізії +
// не валідний uuid). type через inferHabitType якщо не заданий явно (ручна модалка
// дає свій), emoji за типом якщо не заданий. Це майбутній чокпойнт для stampEntity
// (конверт, Ворота 3 Supabase) — додати тут і він покриє всі точки створення.
export function makeHabit({ name, details = '', days, targetCount = 1, type, emoji } = {}) {
  const habitType = type || inferHabitType(name);
  return {
    id: generateUUID(),
    name,
    details,
    emoji: emoji || (habitType === 'quit' ? '🚫' : '⭕'),
    days: Array.isArray(days) ? days : [0, 1, 2, 3, 4, 5, 6],
    targetCount,
    type: habitType,
    createdAt: Date.now(),
  };
}
