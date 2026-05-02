// ============================================================
// memory.js — Структурована пам'ять фактів про користувача
// ============================================================
// Замінює legacy `nm_memory` (текстовий абзац 300 слів) на масив
// структурованих фактів з часовими мітками. Вирішує архітектурно
// корінь бага "болить горло" — AI бачить КОЛИ факт записаний
// і сам вирішує чи ще актуальний.
//
// Shape факту:
//   {
//     id:        'fct_<ts>_<rnd>',
//     text:      'Має дочку Марію',
//     category:  'preferences'|'health'|'work'|'relationships'|'context'|'goals',
//     ts:        1728642000000,   // коли створено
//     lastSeen:  1728742000000,   // коли востаннє підтверджено
//     source:    'inbox'|'auto'|'manual'|'migration'|'onboarding',
//     ttl:       number|null,    // днів життя (null = вічно)
//   }
//
// Створення: два канали (принцип "один мозок на все")
//   1. REAL-TIME: Inbox tool calling — AI викликає save_memory_fact коли
//      юзер повідомляє щось важливе про себе
//   2. BACKGROUND: `doRefreshMemory()` раз на день — аналізує дані і чати
//      за останні 7 днів, витягує факти які пропустив real-time
//
// Читання: `formatFactsForContext()` формує секцію для getAIContext —
// групує по категорії з відносним часом ("3 дні тому"). AI сам судить
// актуальність (simple variant, без smart filtering до Супабейс).
// ============================================================

const NM_FACTS_KEY = 'nm_facts';
const NM_FACTS_MIGRATED_KEY = 'nm_facts_migrated';

// Ліміт щоб не розпухало (після Supabase буде pgvector — лімітів не буде)
const MAX_FACTS = 100;

// Категорії з метаданими (label/emoji/color для UI)
export const FACT_CATEGORIES = {
  preferences:   { label: 'Вподобання', emoji: '💭', color: '#c2790a' },
  health:        { label: "Здоров'я",    emoji: '❤️', color: '#dc2626' },
  work:          { label: 'Робота',     emoji: '💼', color: '#2563eb' },
  relationships: { label: 'Стосунки',   emoji: '👥', color: '#7c3aed' },
  context:       { label: 'Контекст',   emoji: '📍', color: '#16a34a' },
  goals:         { label: 'Цілі',       emoji: '🎯', color: '#ea580c' },
};

// Порядок показу у контексті AI (здоров'я зверху бо критичне)
const CATEGORY_ORDER = ['health', 'relationships', 'work', 'goals', 'preferences', 'context'];

// ============================================================
// CRUD
// ============================================================

export function getFacts() {
  try {
    const raw = JSON.parse(localStorage.getItem(NM_FACTS_KEY) || '[]');
    if (!Array.isArray(raw)) return [];
    // Фільтруємо прострочені (за TTL)
    const now = Date.now();
    return raw.filter(f => {
      if (!f || !f.ts) return false;
      if (!f.ttl) return true;
      return (now - f.ts) < f.ttl * 24 * 60 * 60 * 1000;
    });
  } catch {
    return [];
  }
}

// Отримати ВСІ факти без фільтра (включно з простроченими) — для settings UI
export function getFactsRaw() {
  try {
    const raw = JSON.parse(localStorage.getItem(NM_FACTS_KEY) || '[]');
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function _saveFacts(facts) {
  // Hard limit — видаляємо найстаріші за ts коли більше 100
  let trimmed = facts;
  if (trimmed.length > MAX_FACTS) {
    trimmed = [...trimmed].sort((a, b) => (b.lastSeen || b.ts) - (a.lastSeen || a.ts)).slice(0, MAX_FACTS);
  }
  localStorage.setItem(NM_FACTS_KEY, JSON.stringify(trimmed));
}

// Список патернів які НЕ є фактами — захисний фільтр від "вгадування" AI.
// Блокує: дії/задачі переказані як факти, вигадані компліменти, тавтологію.
// Пояснення — див. save_memory_fact description у src/ai/core.js.
const REJECT_PATTERNS = [
  // Дії переказані як стійкі факти (юзер зробив щось раз → AI вигадав "займається")
  /^займа(є|ю)шся\s/i,       // "Займаєшся пранням одягу"
  /^вимика(є|ю)ш\s/i,        // "Вимикаєш світло в кімнаті"
  /^вмика(є|ю)ш\s/i,
  /^склада(є|ю)ш\s(списк|план)/i, // "Складаєш списки справ" — тавтологія
  /^пере(пи)?ш\s.*одя?г/i,   // "Переш одяг"
  /^пра(ну|є|ю)ш\s/i,
  // Вигадані позитивні риси / суб'єктивні прикметники
  /^відкрит(ий|а)\s/i,        // "Відкритий до нових ідей"
  /^креативн(ий|а)/i,
  /^цілеспрямован(ий|а)/i,
  /^старанн(ий|а)/i,
  /^наполегл?ив(ий|а)/i,
  /^мудр(ий|а)/i,
  /^добр(ий|а)\s/i,
  /^розумн(ий|а)/i,
  /проявля(є|ю)ш\s/i,         // "Проявляєш креативність"
  /прагне(ш)?\s(підтримув|зроб|досягт)/i, // "Прагнеш підтримувати організованість"
];

// Повертає причину відхилення або null якщо факт валідний.
function _rejectReason(text) {
  const trimmed = (text || '').trim();
  if (!trimmed) return 'empty';
  // Занадто короткий або занадто довгий
  if (trimmed.length < 6) return 'too_short';
  if (trimmed.length > 200) return 'too_long';
  // Один з заборонених патернів
  for (const rx of REJECT_PATTERNS) {
    if (rx.test(trimmed)) return `pattern:${rx.source}`;
  }
  // Надто абстрактно: 1-2 слова без конкретики
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length < 2) return 'too_few_words';
  return null;
}

// Додати новий факт з дедуплікацією.
// Якщо вже є дуже схожий (тої ж категорії) — оновлюємо lastSeen, повертаємо його.
// Інакше — створюємо новий.
// Захисний фільтр: відхиляє дії/задачі переказані як факти і вигадані компліменти.
export function addFact({ text, category, ttlDays, source = 'auto' }) {
  if (!text || typeof text !== 'string') return null;
  text = text.trim();
  if (text.length < 3 || text.length > 200) return null;

  // Код-фільтр — захист від "вгадування" AI
  const reject = _rejectReason(text);
  if (reject) {
    console.log('[memory] rejected fact:', reject, '—', text);
    return null;
  }

  if (!category || !FACT_CATEGORIES[category]) category = 'context';

  const facts = getFactsRaw();
  const textLower = text.toLowerCase();

  // Dedup: знаходимо схожий факт у тій самій категорії
  const existingIdx = facts.findIndex(f => {
    if (!f || f.category !== category) return false;
    const fLower = (f.text || '').toLowerCase().trim();
    if (fLower === textLower) return true;
    // Bigram overlap > 75% — схожий факт
    return _textSimilarity(fLower, textLower) > 0.75;
  });

  if (existingIdx !== -1) {
    facts[existingIdx].lastSeen = Date.now();
    // Якщо ttl не був заданий, а тепер заданий — приймаємо новий TTL
    if (ttlDays && !facts[existingIdx].ttl) facts[existingIdx].ttl = ttlDays;
    _saveFacts(facts);
    return facts[existingIdx];
  }

  const newFact = {
    id: `fct_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    text,
    category,
    ts: Date.now(),
    lastSeen: Date.now(),
    source,
    ttl: (typeof ttlDays === 'number' && ttlDays > 0) ? ttlDays : null,
  };
  facts.push(newFact);
  _saveFacts(facts);
  return newFact;
}

export function deleteFact(id) {
  const facts = getFactsRaw();
  _saveFacts(facts.filter(f => f.id !== id));
}

export function updateFactText(id, newText) {
  const facts = getFactsRaw();
  const idx = facts.findIndex(f => f.id === id);
  if (idx === -1) return false;
  const trimmed = (newText || '').trim();
  if (trimmed.length < 3 || trimmed.length > 200) return false;
  facts[idx].text = trimmed;
  facts[idx].lastSeen = Date.now();
  _saveFacts(facts);
  return true;
}

// "Підтвердити" факт — bump lastSeen (коли свіжі дані підтверджують що досі актуально)
export function touchFact(id) {
  const facts = getFactsRaw();
  const idx = facts.findIndex(f => f.id === id);
  if (idx === -1) return;
  facts[idx].lastSeen = Date.now();
  _saveFacts(facts);
}

// Очистити прострочені факти (викликається з doRefreshMemory)
export function cleanupExpiredFacts() {
  const all = getFactsRaw();
  const now = Date.now();
  const alive = all.filter(f => {
    if (!f || !f.ts) return false;
    if (!f.ttl) return true;
    return (now - f.ts) < f.ttl * 24 * 60 * 60 * 1000;
  });
  if (alive.length !== all.length) {
    _saveFacts(alive);
  }
  return all.length - alive.length;
}

// ============================================================
// AI CONTEXT FORMATTER
// ============================================================

// Форматує факти для getAIContext() — простий варіант без RAG.
// Всі живі факти (до maxFacts штук) групуються по категорії з відносним часом.
// AI сам судить актуальність (прямо проінструктовано у секції "ПРАВИЛО ЧЕСНОСТІ").
export function formatFactsForContext(maxFacts = 30) {
  const facts = getFacts();
  if (facts.length === 0) return '';

  // Сортуємо за свіжістю (lastSeen) — найсвіжіші зверху
  const sorted = [...facts].sort((a, b) => (b.lastSeen || b.ts) - (a.lastSeen || a.ts)).slice(0, maxFacts);

  // Групуємо по категорії
  const grouped = {};
  sorted.forEach(f => {
    if (!grouped[f.category]) grouped[f.category] = [];
    grouped[f.category].push(f);
  });

  const lines = [];
  for (const cat of CATEGORY_ORDER) {
    if (!grouped[cat]) continue;
    const catLabel = FACT_CATEGORIES[cat]?.label || cat;
    grouped[cat].forEach(f => {
      const ago = _relativeTime(f.ts);
      lines.push(`- [${catLabel}] ${f.text} (${ago})`);
    });
  }
  if (lines.length === 0) return '';

  return `Факти про користувача (зафіксовано в різний час — використовуй для стилю і довгострокового профілю; якщо по здоров'ю/обставинах бачиш старий факт — НЕ цитуй як поточний стан). ВАЖЛИВО: це факти про КОРИСТУВАЧА, не про тебе. Коли переказуєш — кажи "ти", "у тебе", "твій". НІКОЛИ не кажи "я", "мій", "у мене" від імені користувача:\n${lines.join('\n')}`;
}

// Коротший формат для табло (менше токенів у промті)
export function formatFactsForBoard(maxFacts = 15) {
  const facts = getFacts();
  if (facts.length === 0) return '(ще не знаю)';
  const sorted = [...facts].sort((a, b) => (b.lastSeen || b.ts) - (a.lastSeen || a.ts)).slice(0, maxFacts);
  return sorted.map(f => `- ${f.text}`).join('\n');
}

// ============================================================
// RELATIVE TIME
// ============================================================

function _relativeTime(ts) {
  if (!ts) return '—';
  const diff = Date.now() - ts;
  const day = 24 * 60 * 60 * 1000;
  const days = Math.floor(diff / day);
  if (days === 0) return 'сьогодні';
  if (days === 1) return 'вчора';
  if (days < 7) return `${days} дн. тому`;
  if (days < 30) return `${Math.floor(days / 7)} тиж. тому`;
  if (days < 365) return `${Math.floor(days / 30)} міс. тому`;
  return `${Math.floor(days / 365)} р. тому`;
}

export { _relativeTime as relativeTime };

// ============================================================
// TEXT SIMILARITY (для дедуплікації)
// ============================================================

// Проста bigram similarity — перетин пар символів ділиться на розмір більшої множини.
// Достатньо щоб відловити "Любить каву" vs "любить каву вранці" як схожі.
function _textSimilarity(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const grams = s => {
    const set = new Set();
    for (let i = 0; i < s.length - 1; i++) set.add(s.slice(i, i + 2));
    return set;
  };
  const ga = grams(a);
  const gb = grams(b);
  if (!ga.size || !gb.size) return 0;
  let common = 0;
  ga.forEach(g => { if (gb.has(g)) common++; });
  return common / Math.max(ga.size, gb.size);
}

// ============================================================
// LEGACY MIGRATION (одноразово — з текстового nm_memory у факти)
// ============================================================

export function isMigrationDone() {
  return localStorage.getItem(NM_FACTS_MIGRATED_KEY) === '1';
}

export function markMigrationDone() {
  localStorage.setItem(NM_FACTS_MIGRATED_KEY, '1');
}

export function getLegacyMemoryText() {
  return localStorage.getItem('nm_memory') || '';
}
