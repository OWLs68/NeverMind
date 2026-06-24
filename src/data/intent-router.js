// === INTENT ROUTER (G3 myshu 11.05.2026) ===
// Детермінований парсер для явних команд юзера — bypass AI roundtrip.
//
// CLAUDE.md правило 12: «детерміноване → парсер у src/data/, не AI».
// «Додай в розпорядок перегляд фільму в п'ятницю в 20:00» — це 100%
// деретерміноване. AI плутається («які ще блоки?», «фільм з друзями?»),
// бо GPT-4o-mini схильний бути «корисним». Парсер дає однозначний результат
// без галюцинацій + 0ms latency + 0$ cost.
//
// API: parseExplicitIntent(text) → { tool, args } | null
//   - null = не match, передавай AI як раніше
//   - { tool:'save_routine', args:{...} } = готова tool_call, AI не потрібен
//
// Інтегрується у `src/ai/core.js callAIWithTools` ПЕРЕД OpenAI fetch.
//
// Phase 1: save_routine. Phase 2 (myshu 11.05): set_reminder. Phase 3+: save_finance, complete_task.

import { resolveDateFromText } from './ua-time-parser.js';

// === Day-of-week map (узгоджено з save_routine enum) ===
// ⚠️ JS `\b` НЕ працює з кирилицею навіть з прапором `u` (Unicode word boundary
// у Cyrillic context повертає false — перевірено node-side). Тому використовуємо
// explicit `(?:^|[\s,.:;])X(?=[\s,.:;]|$)` патерн.
// Експортуються — єдине джерело правди для кирилично-безпечної межі слова
// у всьому застосунку (core.js selectRelevantTools переюзує замість мертвого \b).
export const BL = '(?:^|[\\s,.:;\\-])';  // ліва межа: початок або whitespace/пунктуація
export const BR = '(?=[\\s,.:;\\-]|$)';  // права межа: whitespace/пунктуація/кінець

const DAY_MAP = [
  [new RegExp(BL + '(?:понеділ\\p{L}*|пн|у\\s+понеділок|по\\s+понеділк\\p{L}*)' + BR, 'iu'), 'mon'],
  [new RegExp(BL + '(?:вівтор\\p{L}*|вт|у\\s+вівторок|по\\s+вівторк\\p{L}*)' + BR, 'iu'), 'tue'],
  [new RegExp(BL + '(?:серед\\p{L}*|ср|у\\s+середу|по\\s+серед\\p{L}*)' + BR, 'iu'), 'wed'],
  [new RegExp(BL + '(?:четвер\\p{L}*|чт|у\\s+четвер|по\\s+четверг\\p{L}*)' + BR, 'iu'), 'thu'],
  [new RegExp(BL + "(?:п['ʼ']?ятниц\\p{L}*|пт|у\\s+п['ʼ']?ятницю|по\\s+п['ʼ']?ятниц\\p{L}*)" + BR, 'iu'), 'fri'],
  [new RegExp(BL + '(?:субот\\p{L}*|сб|у\\s+суботу|по\\s+субот\\p{L}*)' + BR, 'iu'), 'sat'],
  [new RegExp(BL + '(?:неділ\\p{L}*|нд|у\\s+неділю|по\\s+неділ\\p{L}*)' + BR, 'iu'), 'sun'],
];

const DAY_GROUPS = [
  [new RegExp(BL + '(?:будн\\p{L}*|з\\s+пн\\s+по\\s+пт|роб\\p{L}*\\s+дн\\p{L}*)' + BR, 'iu'), ['mon','tue','wed','thu','fri']],
  [new RegExp(BL + '(?:вихідн\\p{L}*|сб[\\s-]+нд|на\\s+вихідних)' + BR, 'iu'), ['sat','sun']],
  [new RegExp(BL + '(?:щодня|кожен\\s+день|кожного\\s+дня|весь\\s+тиждень)' + BR, 'iu'), ['mon','tue','wed','thu','fri','sat','sun']],
];

// Розпізнає набір днів. Повертає масив enum-кодів або null.
function _extractDays(text) {
  // Спочатку групи (будні/вихідні/щодня) — мають пріоритет
  for (const [re, days] of DAY_GROUPS) {
    if (re.test(text)) return days;
  }
  // Потім окремі дні. Може бути «вт чт сб» — підбираємо всі що знайдено.
  const found = new Set();
  for (const [re, code] of DAY_MAP) {
    if (re.test(text)) found.add(code);
  }
  return found.size > 0 ? Array.from(found) : null;
}

// Видаляє знайдені day-фрази з тексту (для очистки activity).
function _stripDays(text) {
  let out = text;
  for (const [re] of DAY_GROUPS) out = out.replace(re, ' ');
  for (const [re] of DAY_MAP) out = out.replace(re, ' ');
  return out;
}

// === Time extraction ===
// «в 20:00», «о 18:30», «о 7», «в 9 ранку», «о 14»
// Повертає {time:'HH:MM', matched:'<original>'} або null.
// ⚠️ `u` прапор обовʼязковий для всіх patterns з кирилицею — інакше \b ламається.
// Period word ПЕРЕД bare-HH-with-prefix (інакше «о 7 ранку» → 07:00 без бумпу).
// myshu Сесія 2: додано «на» як префікс («постав нагадування на 7 ранку»).
// myshu v2 (smoke gap): додано Pattern 5 — голий «N ранку/вечора/дня/ночі»
// без префіксу. Кейс «Постав нагадування 7 ранку зробити зарядку» — раніше
// бейлило до AI, AI хибно інтерпретував як коригування і робив delete_reminder.
const TIME_PATTERNS = [
  // HH:MM з префіксом «о/у/в/на»
  /(?:^|\s)(?:о|у|в|на)\s+(\d{1,2})[:.](\d{2})(?=\s|$)/iu,
  // Голий HH:MM
  /(?:^|\s)(\d{1,2})[:.](\d{2})(?=\s|$)/u,
  // HH з ранку/вечора/дня/ночі — period word ПЕРЕД бар-HH
  /(?:^|\s)(?:о|у|в|на)\s+(\d{1,2})\s+(ранку|вечора|дня|ночі)(?=\s|$|[.,])/iu,
  // Голий «о HH» / «в HH» / «на HH»
  /(?:^|\s)(?:о|у|в|на)\s+(\d{1,2})(?=\s|$|[.,])/iu,
  // БЕЗ префіксу: голий «N ранку/вечора/дня/ночі» — period word робить це
  // безпечним (не зачіпає «купив каву 50» бо там нема period word).
  /(?:^|\s)(\d{1,2})\s+(ранку|вечора|дня|ночі)(?=\s|$|[.,])/iu,
];

function _extractTime(text) {
  for (const re of TIME_PATTERNS) {
    const m = text.match(re);
    if (!m) continue;
    let h = parseInt(m[1], 10);
    let mm = m[2] && /^\d{2}$/.test(m[2]) ? parseInt(m[2], 10) : 0;
    const periodWord = m[2] && /(ранку|вечора|дня|ночі)/i.test(m[2]) ? m[2].toLowerCase() : null;
    if (periodWord === 'вечора' && h >= 1 && h <= 11) h += 12;
    if (periodWord === 'ночі' && h >= 1 && h <= 4) h += 0; // 1-4 ночі = 01-04
    if (periodWord === 'дня' && h >= 1 && h <= 6) h += 12; // 1-6 дня = 13-18
    if (h < 0 || h > 23 || mm < 0 || mm > 59) continue;
    return {
      time: `${String(h).padStart(2,'0')}:${String(mm).padStart(2,'0')}`,
      matched: m[0],
    };
  }
  return null;
}

function _stripTime(text, matched) {
  return text.replace(matched, ' ');
}

// === ROUTINE INTENT ===
// Тригери: «додай в розпорядок», «постав у розпорядок», «створи розпорядок»,
// «у розпорядок: ...», «в розпорядок ...».
// Тригер: «додай/постав/створи/внеси/запиши» + опційно «в/у» + «розпорядок».
// Або просто «у розпорядок: ...» без дієслова.
const ROUTINE_TRIGGER = new RegExp(
  BL + '(?:(?:додай|постав|створ\\p{L}+|внеси|запиши|зроби)\\s+(?:(?:в|у)\\s+)?розпоряд\\p{L}+|(?:в|у)\\s+розпоряд\\p{L}+\\s*:?)',
  'iu'
);

// Дата-специфікатор = ОДНОРАЗОВА подія, НЕ повторюваний розпорядок.
// CLAUDE.md ROUTINE_RULES: «'завтра/післязавтра' БЕЗ 'щотижня' → create_event».
// Якщо ці слова є — парсер ВIДМОВЛЯЄТЬСЯ матчити, дає AI шанс create_event.
const ONE_OFF_DATE_INDICATORS = new RegExp(
  BL + '(?:завтра|післязавтра|сьогодні|вчора|позавчора|\\d{1,2}\\s+(?:січн|лют|берез|квітн|травн|червн|липн|серпн|вересн|жовтн|листопад|грудн)\\p{L}*|\\d{1,2}[.\\/]\\d{1,2})',
  'iu'
);

// АЛЕ — якщо є явне слово «щотижня/постійно/кожен» → це таки routine.
const RECURRING_OVERRIDE = new RegExp(BL + '(?:щотижня|постійно|регулярно|кожен\\s+тиждень)', 'iu');

function _parseRoutineIntent(text) {
  if (!ROUTINE_TRIGGER.test(text)) return null;

  // ВАЖЛИВО: «На завтра 8 вечора в розпорядок» = ОДНОРАЗОВА подія, не routine.
  // CLAUDE.md ROUTINE_RULES — без явного «щотижня/постійно» дата-специфікатор
  // означає create_event. Бейлимо до AI щоб він обрав правильний tool.
  if (ONE_OFF_DATE_INDICATORS.test(text) && !RECURRING_OVERRIDE.test(text)) {
    return null;
  }

  // Прибираємо тригер з тексту
  let rest = text.replace(ROUTINE_TRIGGER, ' ').trim();

  // Знімаємо часовий фрагмент
  const timeInfo = _extractTime(rest);
  if (!timeInfo) return null; // без часу не save_routine
  rest = _stripTime(rest, timeInfo.matched);

  // INVERSION check (myshu pre-mortem): якщо ПIСЛЯ зняття першого часу
  // у тексті ще лишився валідний час — це multi-block («біг 18:00 і йога 7:00»).
  // Парсер не справиться → bail out, дай AI шанс.
  if (_extractTime(rest)) return null;

  // Знімаємо день/дні
  const days = _extractDays(rest);
  if (!days || days.length === 0) return null; // без днів не save_routine
  rest = _stripDays(rest);

  // Решта тексту — activity. Прибираємо stop-слова що залишились.
  let activity = rest
    .replace(/(?:^|\s)(?:в|у|о|на|щоб|до|ранку|вечора|дня|ночі|і|та|також)(?=\s|$)/giu, ' ')
    .replace(/[:\-—]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!activity || activity.length < 2) return null;

  // Нормалізація: lower-case весь activity, потім CAP-першу букву.
  // Запобігає «БІГ» з CAPS-locked повідомлення.
  activity = activity.toLowerCase();
  activity = activity.charAt(0).toUpperCase() + activity.slice(1);

  return {
    tool: 'save_routine',
    args: {
      _reasoning_log: 'Деретермінований парсер intent-router розпізнав явну команду save_routine. Bypass AI.',
      day: days,
      blocks: [{ time: timeInfo.time, activity }],
    },
  };
}

// === REMINDER INTENT (myshu 11.05 Сесія 2) ===
// Тригери: «нагадай», «напомни», «постав нагадування», «постав ремайндер».
// Опційно «мені»/«мене». Обовʼязково час (інакше REMINDER_RULES каже AI
// перепитувати — пускаємо AI вирішувати). Дата опційна (null = сьогодні).
const REMINDER_TRIGGER = new RegExp(
  BL + '(?:нагадай|напомни|постав\\s+нагадуванн\\p{L}*|постав\\s+ремайндер|нагадат\\p{L}*)(?:\\s+мені|\\s+мене)?',
  'iu'
);

// Слова-стоп для cleanup після зняття тригера/часу/дати з тексту нагадування.
// 'ранку/вечора/дня/ночі' — period-suffix часу (бо TIME_PATTERN ловить «о 9 ранку»
// як одне ціле, але після _stripTime лишається фраза).
const REMINDER_STOP_WORDS = /(?:^|\s)(?:в|у|о|на|щоб|про|щодо|треба|потрібно|ранку|вечора|дня|ночі)(?=\s|$)/giu;

// Регекс для зняття дати-фрагменту з тексту після parseAbsoluteDate/parseUaTimeOffset.
const DATE_STRIP_RE = /(?:^|[\s,.:;\-])(?:завтра|післязавтра|сьогодні|вчора|позавчора|у\s+понеділок|у\s+вівторок|у\s+середу|у\s+четвер|у\s+п['ʼ']?ятницю|у\s+суботу|у\s+неділю|по\s+понеділк\p{L}*|\d{1,2}\s+(?:січн|лют|берез|квітн|травн|червн|липн|серпн|вересн|жовтн|листопад|грудн)\p{L}*|\d{1,2}[.\/]\d{1,2})(?=[\s,.:;\-]|$)/giu;

function _parseReminderIntent(text) {
  if (!REMINDER_TRIGGER.test(text)) return null;

  // Прибираємо тригер
  let rest = text.replace(REMINDER_TRIGGER, ' ').trim();
  if (!rest) return null;

  // Витягуємо час. БЕЗ часу — null (REMINDER_RULES у промпті каже AI запитати).
  const timeInfo = _extractTime(rest);
  if (!timeInfo) return null;
  let time = timeInfo.time;
  rest = _stripTime(rest, timeInfo.matched);

  // Multi-time check — як у routine. Кілька часів = AI вирішує.
  if (_extractTime(rest)) return null;

  // Витягуємо дату через ua-time-parser (resolveDateFromText)
  let dateISO = null;
  const dateObj = resolveDateFromText(rest, new Date(), 'future');
  if (dateObj) {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const d = String(dateObj.getDate()).padStart(2, '0');
    dateISO = `${y}-${m}-${d}`;
    rest = rest.replace(DATE_STRIP_RE, ' ');
  }

  // Решта — text нагадування. Прибираємо stop-слова.
  let reminderText = rest
    .replace(REMINDER_STOP_WORDS, ' ')
    .replace(/[:\-—]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!reminderText || reminderText.length < 2) return null;

  // Нормалізація capitalize
  reminderText = reminderText.toLowerCase();
  reminderText = reminderText.charAt(0).toUpperCase() + reminderText.slice(1);

  return {
    tool: 'set_reminder',
    args: {
      _reasoning_log: 'Деретермінований парсер intent-router розпізнав явну команду set_reminder. Bypass AI.',
      text: reminderText,
      time,
      date: dateISO,
    },
  };
}

// === ROUTER ENTRY POINT ===
export function parseExplicitIntent(text) {
  if (!text || typeof text !== 'string') return null;
  const trimmed = text.trim();
  if (!trimmed) return null;

  // 1. save_routine (Phase 1)
  const routine = _parseRoutineIntent(trimmed);
  if (routine) return routine;

  // 2. set_reminder (Phase 2)
  const reminder = _parseReminderIntent(trimmed);
  if (reminder) return reminder;

  return null;
}

// Експорти для unit-tests / Phase 2 розширення
export const _internals = {
  _extractDays,
  _extractTime,
  _stripDays,
  _stripTime,
  _parseRoutineIntent,
  _parseReminderIntent,
};
