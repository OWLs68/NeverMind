// ============================================================
// data/ua-time-parser.js — парсер українських часових виразів
// ============================================================
// Задача: НЕ ПОКЛАДАТИСЬ на AI що передасть `date` параметр у tool_call.
// Замість лоскутів у промптах — code-side система яка парсить текст
// на offset_days від сьогодні. Використовується у add_moment,
// create_event, set_reminder handlers.
//
// Принцип Романа (10.05.2026 64CXo): «виправляти промти це не працює, треба система».
//
// API:
//   parseUaTimeOffset(text) → number | null (днів від сьогодні; -1 для «вчора», +7 для «через тиждень»)
//   resolveDateFromText(text, baseDate=new Date()) → Date | null (точна дата або null)
//
// Покриті тригери:
//   МИНУЛЕ: вчора (-1), позавчора (-2), N днів тому/назад, тиждень тому,
//           N тижнів тому, місяць тому
//   МАЙБУТНЄ: завтра (+1), післязавтра/позавтра (+2), через N днів,
//             через тиждень (+7), через N тижнів, через місяць (+30)
//   АБСОЛЮТНI: «15 травня», «3 червня 2026» (через MONTHS_GENITIVE)
//   ДНІ ТИЖНЯ: «у понеділок/вівторок/...» — найближчий минулий або майбутній
//
// Що НЕ покрито (треба окремий handler):
//   - «о 15:00», «через годину» — це time, не date (для add_moment не критично,
//     для set_reminder — окремий parseUaTimeOfDay)
// ============================================================

// Iдентичний MONTHS_GENITIVE як у src/data/months.js (синхронізований).
// Дублюємо тут щоб уникнути circular import (ua-time-parser → months.js → utils.js).
const MONTHS_GENITIVE = ['січня','лютого','березня','квітня','травня','червня','липня','серпня','вересня','жовтня','листопада','грудня'];
// Дні тижня genitive для «у понеділок» / «в середу». 0=пн, 1=вт, ... 6=нд.
const WEEKDAYS = [
  ['понеділок','понеділка'],
  ['вівторок','вівторка'],
  ['середу','середа','середи'],
  ['четвер','четверга'],
  ["п'ятницю","п'ятниця","п'ятниці","пʼятницю","пʼятниця","пʼятниці"],
  ['суботу','субота','суботи'],
  ['неділю','неділя','неділі']
];

const NUM_MAP = {
  'один': 1, 'два': 2, 'дві': 2, 'три': 3, 'чотири': 4,
  'пять': 5, "п'ять": 5, 'пʼять': 5, 'п’ять': 5,
  'шість': 6, 'сім': 7, 'вісім': 8, 'девять': 9, "дев'ять": 9,
  'десять': 10,
};

function _parseNumber(token) {
  if (!token) return NaN;
  const lower = token.toLowerCase().trim();
  if (NUM_MAP[lower]) return NUM_MAP[lower];
  const n = parseInt(lower, 10);
  return isNaN(n) ? NaN : n;
}

// Повертає offset у днях від сьогодні (від'ємний = минуле, додатний = майбутнє).
// null = тригер не знайдено (нехай caller вирішує fallback на сьогодні).
export function parseUaTimeOffset(text) {
  if (!text || typeof text !== 'string') return null;
  const t = text.toLowerCase();

  // Швидкі поодинокі тригери. БЕЗ \b бо JavaScript \b не word boundary для кирилиці
  // (ловить лише ASCII a-zA-Z0-9_). Substring match достатній — false-positives
  // як «надвечірʼя» не містять цих коренів.
  if (/позавчора/.test(t)) return -2;
  if (/вчора/.test(t)) return -1;
  if (/післязавтра/.test(t) || /позавтра/.test(t)) return 2;
  if (/завтра/.test(t)) return 1;
  if (/сьогодні/.test(t)) return 0;

  // Минуле з кількістю: «N днів тому», «два тижні тому», «місяць тому»
  const past = t.match(/(\d+|один|два|дві|три|чотири|пять|п['ʼ’’]ять|шість|сім|вісім|девять|дев['ʼ’’]ять|десять|тиждень|місяць)\s*(дн[іїя]в?|тижн[іеяь]в?|місяц[ьіяв]?\w*)?\s*(тому|назад)/);
  if (past) {
    const numToken = past[1];
    const unitToken = past[2] || '';
    let n;
    if (numToken === 'тиждень') { n = 7; }
    else if (numToken === 'місяць') { n = 30; }
    else { n = _parseNumber(numToken); }
    if (!isNaN(n)) {
      if (unitToken.startsWith('тижн')) return -n * 7;
      if (unitToken.startsWith('місяц')) return -n * 30;
      // дні або порожній unit (для «тиждень тому» який вже n=7)
      if (numToken === 'тиждень') return -7;
      if (numToken === 'місяць') return -30;
      return -n;
    }
  }

  // Майбутнє: «через N днів», «через тиждень», «через місяць»
  const future = t.match(/через\s+(\d+|один|два|дві|три|чотири|пять|п['ʼ’’]ять|шість|сім|вісім|девять|дев['ʼ’’]ять|десять|тиждень|місяць)\s*(дн[іїя]в?|тижн[іеяь]в?|місяц[ьіяв]?\w*)?/);
  if (future) {
    const numToken = future[1];
    const unitToken = future[2] || '';
    let n;
    if (numToken === 'тиждень') { return 7; }
    if (numToken === 'місяць') { return 30; }
    n = _parseNumber(numToken);
    if (!isNaN(n)) {
      if (unitToken.startsWith('тижн')) return n * 7;
      if (unitToken.startsWith('місяц')) return n * 30;
      return n;
    }
  }

  return null;
}

// Парсить абсолютну дату «15 травня», «3 червня 2026», «1 січня».
// Повертає Date або null.
export function parseAbsoluteDate(text, baseDate = new Date()) {
  if (!text || typeof text !== 'string') return null;
  const t = text.toLowerCase();
  // Шукаємо число + місяць (genitive). Опційно рік 4-цифри.
  const m = t.match(/(\d{1,2})\s+(січня|лютого|березня|квітня|травня|червня|липня|серпня|вересня|жовтня|листопада|грудня)(?:\s+(\d{4}))?/);
  if (!m) return null;
  const day = parseInt(m[1], 10);
  const monthIdx = MONTHS_GENITIVE.indexOf(m[2]);
  const year = m[3] ? parseInt(m[3], 10) : baseDate.getFullYear();
  if (day < 1 || day > 31 || monthIdx === -1) return null;
  const d = new Date(year, monthIdx, day, 12, 0, 0, 0);
  if (isNaN(d.getTime())) return null;
  return d;
}

// Парсить день тижня «у понеділок», «в середу». Повертає offset у днях від
// baseDate. mode='past' або 'future' — куди шукати.
// Якщо baseDate.getDay() === wantedDay → +7 (future) або -7 (past).
export function parseUaWeekday(text, mode = 'future', baseDate = new Date()) {
  if (!text || typeof text !== 'string') return null;
  const t = text.toLowerCase();
  // JS getDay(): 0=Sunday, 1=Mon...6=Sat. Конвертуємо у 0=Mon..6=Sun.
  const todayJsDay = baseDate.getDay();
  const todayMonFirst = (todayJsDay + 6) % 7; // 0=Mon, ..., 6=Sun
  for (let i = 0; i < 7; i++) {
    const forms = WEEKDAYS[i];
    for (const form of forms) {
      if (t.includes(form)) {
        let diff = i - todayMonFirst;
        if (mode === 'future') {
          if (diff <= 0) diff += 7;
        } else {
          if (diff >= 0) diff -= 7;
        }
        return diff;
      }
    }
  }
  return null;
}

// Повертає точну дату (Date object) на основі тексту, або null.
// baseDate за замовчуванням — сьогодні. Час виставляється на 12:00 щоб уникнути
// timezone-shift на межі доби. mode для weekday: 'past' для save_moment,
// 'future' для create_event/set_reminder.
export function resolveDateFromText(text, baseDate = new Date(), mode = 'past') {
  // 1. Спершу абсолютна дата (найточніша)
  const absolute = parseAbsoluteDate(text, baseDate);
  if (absolute) return absolute;
  // 2. Відносний offset (вчора/завтра/N днів тому)
  const offset = parseUaTimeOffset(text);
  if (offset !== null) {
    const d = new Date(baseDate);
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() + offset);
    return d;
  }
  // 3. День тижня (потребує context — past чи future)
  const wdOffset = parseUaWeekday(text, mode, baseDate);
  if (wdOffset !== null) {
    const d = new Date(baseDate);
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() + wdOffset);
    return d;
  }
  return null;
}

// === parseUaTimeOfDay (G2 dyhJu 10.05) ===
//
// Парсить часи доби у формат 'HH:MM'. Покриває:
//   АБСТРАКТНI: зранку/вранці (08:00), опівдні (12:00), вдень (13:00),
//               після обіду (14:00), ввечері (18:00), пізно ввечері (21:00),
//               перед сном (22:00), вночі (00:00), опівночі (00:00)
//   КОНКРЕТНI: «о 15:00», «о 9-30», «15:00», «9.30», «о 9 ранку» (09:00),
//              «о 7 вечора» (19:00)
//   ВIДНОСНI: «через годину» (now+60хв), «через 30 хв» (now+30хв),
//             «через пів години» (now+30хв), «через 2 години» (now+120хв)
//
// Повертає 'HH:MM' або null. baseDate потрібен лише для «через N» —
// інакше можна не передавати.
//
// Призначення: G2 Bridge-плану з 64CXo SESSION_STATE — code-side fallback
// у set_reminder handler коли AI не передав явний `time` параметр. Раніше
// AI бачив лише декларативну МАПУ ЧАСУ у prompts.js (дублювалась у двох
// місцях, ще й розходилась) — лоскутний підхід. Тепер детермінований
// парсер у `src/data/`, переїде у Edge Function без переписування.
//
// Принцип Романа (правило 12 CLAUDE.md, 64CXo): «детерміноване → парсер,
// не промпт».

// Абстрактна мапа часів доби. Пріоритет — за специфічністю (довші ключі
// перевіряємо перед коротшими щоб «після обіду» не матчилось як «обід»).
const TIME_OF_DAY_MAP = [
  // Найдовші тригери — перші
  { re: /перед\s+сном/, time: '22:00' },
  { re: /пізно\s+(в?в?ечері|ввечері)/, time: '21:00' },
  { re: /після\s+обіду/, time: '14:00' },
  // Конкретні слова
  { re: /опівночі/, time: '00:00' },
  { re: /опівдні/, time: '12:00' },
  { re: /(?:^|\s)(зранку|вранці|ранком)(?:\s|$)/, time: '08:00' },
  { re: /(?:^|\s)(в?в?ечері|ввечері|увечері|надвечір)(?:\s|$)/, time: '18:00' },
  { re: /(?:^|\s)(вночі|нічю|ніччю)(?:\s|$)/, time: '00:00' },
  { re: /(?:^|\s)(вдень|удень)(?:\s|$)/, time: '13:00' },
  { re: /(?:^|\s)(в?обід|обідом)(?:\s|$)/, time: '13:00' },
];

// Конкретний формат часу: «15:00», «9-30», «9.30», «о 15:00», «о 9», «о 9 ранку».
// Опційний «о» спереду + 1-2 цифри + опційно :- або «.» + 2 цифри.
// + опційні модифікатори «ранку/вечора» для 12-год формату.
const EXPLICIT_TIME_RE = /(?:^|\s|[оО]\s+)(\d{1,2})[:.\-](\d{2})(?:\s|$)/;
const HOUR_ONLY_RE = /(?:^|\s)[оО]\s+(\d{1,2})(?:\s+(ранку|вечора|дня|ночі))?(?:\s|$)/;

// Строгий детектор ЯВНОГО годинникового часу — для guard «час → подія»
// (dispatcher-guards.js). Навмисно ВУЖЧИЙ за EXPLICIT_TIME_RE: матчимо лише
//   - з двокрапкою: «12:00», «9:30» — дати так НЕ пишуть (дати — крапка/слеш/дефіс),
//   - з «о» спереду: «о 12», «о 9 ранку», «о 12:00».
// НЕ матчимо «15.05»/«15-05» (це дати — інакше «подзвонити 15.05» хибно стало б
// подією о 15:05) і абстрактні «вранці/ввечері» (Роман: «КОНКРЕТНИЙ час → подія»).
const EXPLICIT_CLOCK_RE = /(?:^|\s)\d{1,2}:\d{2}(?:\s|$)|(?:^|\s)[оО]\s+\d{1,2}(?::\d{2})?(?:\s+(?:ранку|вечора|дня|ночі))?(?:\s|$)/;

export function hasExplicitClockTime(text) {
  if (!text || typeof text !== 'string') return false;
  return EXPLICIT_CLOCK_RE.test(text.toLowerCase());
}


// Відносний час: «через годину», «через 30 хв», «через пів години».
// Через 1.5 години не покриваємо — рідкісне.
const RELATIVE_HOURS_RE = /через\s+(?:(\d+|пів)\s+)?годин[ауи]?/;
const RELATIVE_MINUTES_RE = /через\s+(\d+)\s*(?:хвилин[ауи]?|хв)/;
const RELATIVE_HALF_HOUR_RE = /через\s+пів\s+години|через\s+півгодини/;

function _pad2(n) { return String(n).padStart(2, '0'); }

function _formatTime(h, m) {
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return _pad2(h) + ':' + _pad2(m);
}

function _addMinutes(baseDate, minutes) {
  const d = new Date(baseDate);
  d.setMinutes(d.getMinutes() + minutes);
  return _formatTime(d.getHours(), d.getMinutes());
}

export function parseUaTimeOfDay(text, baseDate = new Date()) {
  if (!text || typeof text !== 'string') return null;
  const t = text.toLowerCase();

  // 1. ВIДНОСНI часи (пріоритет — точніші за абстрактні)
  if (RELATIVE_HALF_HOUR_RE.test(t)) {
    return _addMinutes(baseDate, 30);
  }
  const relMin = t.match(RELATIVE_MINUTES_RE);
  if (relMin) {
    const n = parseInt(relMin[1], 10);
    if (!isNaN(n) && n > 0 && n < 24 * 60) return _addMinutes(baseDate, n);
  }
  const relHr = t.match(RELATIVE_HOURS_RE);
  if (relHr) {
    const numToken = relHr[1];
    let n;
    if (!numToken) n = 1;             // «через годину»
    else if (numToken === 'пів') n = 0.5;
    else { n = parseInt(numToken, 10); if (isNaN(n)) n = null; }
    if (n !== null && n > 0 && n < 24) return _addMinutes(baseDate, Math.round(n * 60));
  }

  // 2. КОНКРЕТНI часи (HH:MM, HH-MM, HH.MM)
  const explicit = t.match(EXPLICIT_TIME_RE);
  if (explicit) {
    const h = parseInt(explicit[1], 10);
    const m = parseInt(explicit[2], 10);
    return _formatTime(h, m);
  }
  const hourOnly = t.match(HOUR_ONLY_RE);
  if (hourOnly) {
    let h = parseInt(hourOnly[1], 10);
    const period = hourOnly[2];
    if (!isNaN(h)) {
      // 12-год → 24-год конверсія: «о 9 вечора» = 21, «о 7 вечора» = 19.
      // «дня» → лишаємо як є (9 = 09:00). «ночі» → 0-3 ночі лишаємо, 11 ночі = 23.
      if (period === 'вечора' && h < 12) h += 12;
      else if (period === 'дня' && h < 6) h += 12;  // «о 3 дня» = 15
      // ранку/ночі лишаємо як є (зазвичай AM)
      return _formatTime(h, 0);
    }
  }

  // 3. АБСТРАКТНI часи доби (мапа)
  for (const entry of TIME_OF_DAY_MAP) {
    if (entry.re.test(t)) return entry.time;
  }

  return null;
}

