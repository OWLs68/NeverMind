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
//
// Що НЕ покрито (треба окремий handler):
//   - «у понеділок/вівторок» — потребує знання поточного дня тижня
//   - «3 червня», «12 травня» — потребує мапи місяців
//   - «о 15:00», «через годину» — це time, не date
// ============================================================

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

// Повертає точну дату (Date object) на основі тексту, або null.
// baseDate за замовчуванням — сьогодні. Час виставляється на 12:00 щоб уникнути
// timezone-shift на межі доби.
export function resolveDateFromText(text, baseDate = new Date()) {
  const offset = parseUaTimeOffset(text);
  if (offset === null) return null;
  const d = new Date(baseDate);
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + offset);
  return d;
}
