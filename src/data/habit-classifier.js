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

// startsWith по словах (не includes по підрядку) — щоб «скинути вагу» НЕ
// ловилось як quit через підрядок «кину».
const QUIT_PREFIXES = ['кину', 'кинь', 'покину', 'брос', 'відмов', 'перест', 'позбу', "зав'яз"];
// Negative-форми: «не курити / пити / вживати / їсти».
const QUIT_NEG_RE = /(^|\s)не\s+(пал|кур|пи|вжива|їст|жер)/;

export function inferHabitType(name) {
  const n = (name || '').toLowerCase().replace(/['’ʼ]/g, "'");
  if (QUIT_NEG_RE.test(n)) return 'quit';
  const words = n.split(/[\s,.;!?-]+/).filter(Boolean);
  return words.some(w => QUIT_PREFIXES.some(p => w.startsWith(p))) ? 'quit' : 'build';
}
