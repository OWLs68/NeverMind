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
