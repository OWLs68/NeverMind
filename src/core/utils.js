import { getInbox, saveInbox, renderInbox } from '../tabs/inbox.js';
import { getSettings } from './settings.js';
import { generateUUID } from './uuid.js';

export function autoResizeTextarea(el) {
  el.style.height = 'auto';
  const maxH = Math.floor(window.innerHeight * 0.5 - 20);
  el.style.height = Math.min(el.scrollHeight, maxH) + 'px';
  // Оновлюємо висоту чат-вікна якщо воно відкрите
  const bar = el.closest('.ai-bar-new');
  if (bar) {
    const cw = bar.querySelector('.ai-bar-chat-window.open');
    if (cw) updateChatWindowHeight(bar.id.replace('-ai-bar', ''));
  }
}

// Розраховує висоту чат-вікна: від низу board до верху input-box
export function updateChatWindowHeight(tab) {
  const bar = document.getElementById(tab + '-ai-bar');
  if (!bar) return;
  const chatWin = bar.querySelector('.ai-bar-chat-window');
  if (!chatWin) return;
  const inputBox = bar.querySelector('.ai-bar-input-box');
  const inputRect = inputBox ? inputBox.getBoundingClientRect() : null;
  const inputTop = inputRect ? inputRect.top : window.innerHeight - 140;

  // Знаходимо board поточної вкладки
  const boardId = tab === 'inbox' ? 'owl-board' : 'owl-tab-board-' + tab;
  const board = document.getElementById(boardId);
  let topBound = 80; // fallback
  if (board) {
    const br = board.getBoundingClientRect();
    if (br.bottom > 0 && br.bottom < inputTop) topBound = br.bottom + 8;
  }

  const maxH = inputTop - topBound - 8;
  chatWin.style.maxHeight = Math.max(150, maxH) + 'px';
  chatWin.style.height    = Math.max(150, maxH) + 'px';
}

// Офлайн-fallback: зберігає миттєво як нотатку
export function saveOffline(text) {
  const items = getInbox();
  items.unshift({ id: generateUUID(), text, category: 'note', ts: Date.now(), processed: false });
  saveInbox(items);
  renderInbox();

}

export function formatTime(ts) {
  // OBErR audit fix: i18n interpolation pattern узгоджено з nav.js _relativeTime.
  // Раніше: `Math.floor(...) + t('time.minutes_ago', ' хв тому')` — число поза
  // t() через концатенацію. При перекладі на FR/DE (де порядок слів інший:
  // «5 minutes ago» vs «vor 5 Minuten») структура ламається. Тепер
  // t('time.minutes_ago', '{n} хв тому', { n: min }) — взаємозамінне між мовами.
  const diff = Date.now() - ts;
  if (diff < 60000) return t('time.just_now', 'щойно');
  if (diff < 3600000) {
    const min = Math.floor(diff / 60000);
    return t('time.minutes_ago', '{n} хв тому', { n: min });
  }
  if (diff < 86400000) {
    const hr = Math.floor(diff / 3600000);
    return t('time.hours_ago', '{n} год тому', { n: hr });
  }
  return new Date(ts).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' });
}

// Security-аудит vdlyeg (10.06.2026): regex для лапок задано через String.fromCharCode
// (34 подвійна, 39 одинарна) і винесено у module-константи. Причини дві: (1) escapeHtml
// гаряча — не конструювати regex на кожен виклик; (2) без літеральних символів лапок
// у коді — щоб не плутати i18n-детектор (рахує парність лапок у файлі).
const _RE_DQUOTE = new RegExp(String.fromCharCode(34), 'g');
const _RE_SQUOTE = new RegExp(String.fromCharCode(39), 'g');

export function escapeHtml(s) {
  // B-70 fix (17.04.2026): захист від undefined/null/number/object. Раніше undefined.replace
  // кидав TypeError і ламав цілі блоки рендеру (приклад — _finCatsGrid).
  // Security-аудит vdlyeg (10.06.2026): додано екранування лапок — подвійної у &quot; та
  // одинарної у &#39;. Без них значення з лапкою всередині HTML-атрибута розривало атрибут
  // і дозволяло підставити обробник події (XSS-клас у ~25 місцях chips/finance/health/notes).
  // Безпечно для всіх контекстів: у тілі сторінки сутності рендеряться як звичайні лапки
  // (юзер бачить нормально), в атрибутах браузер декодує назад при читанні через dataset
  // (round-trip цілий). Для JS-рядка всередині атрибута — окремий escapeJsArg (нижче), не
  // плутати. Порядок важливий: amp першим (інакше подвійне екранування вже-вставлених сутностей).
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(_RE_DQUOTE, '&quot;')
    .replace(_RE_SQUOTE, '&#39;');
}

// Security-аудит vdlyeg (10.06.2026): безпечний href для посилань з URL від юзера/AI.
// escapeHtml сам по собі НЕ блокує небезпечні схеми — `javascript:alert()` у href
// виконається при кліку (XSS). safeHref повертає URL лише якщо схема безпечна, інакше null
// (тоді посилання не рендеримо). Дозволені схеми: http, https, mailto, tel. Дозволені також
// відносні шляхи / anchor / протокол-відносні (//) — там схеми немає, виконання коду неможливе.
// Контрольні символи прибираємо ПЕРЕД перевіркою: браузер ігнорує таб/новий рядок усередині
// схеми, тож `java\tscript:` спрацював би в обхід наївного regex. Повертаємо вже очищений URL.
export function safeHref(url) {
  if (!url || typeof url !== 'string') return null;
  const cleaned = url.trim().replace(/[\u0000-\u001F\u007F]/g, '');
  if (!cleaned) return null;
  const schemeMatch = cleaned.match(/^([a-z][a-z0-9+.-]*):/i);
  if (schemeMatch) {
    const allowed = ['http', 'https', 'mailto', 'tel'];
    if (!allowed.includes(schemeMatch[1].toLowerCase())) return null;
  }
  return cleaned;
}

// B-152 + B-159 fix (LfA6w 07.05.2026): безпечне вкладання у JS-string
// усередині HTML-атрибуту. Покриває кейс `onclick="foo('${escapeJsArg(name)}')"`
// де name може містити: апостроф (`Roman's coffee` → SyntaxError),
// лапки, зворотний слеш, переніс рядка, тег `<>` (через нативний HTML-escape
// далі в onclick стане &lt;&gt; → юзер не знайде запис). Послідовність
// важлива: спершу JS-escape (\\, \', \", \n, \r), потім HTML-escape (&, <, >).
// Розшифрування назад НЕ потрібне — браузер парсить HTML attr → JS string,
// обидва рівні відновлюються правильно.
export function escapeJsArg(s) {
  const str = String(s ?? '');
  // 1. JS-escape: backslash перший (інакше наступні \' стануть \\\')
  const jsEscaped = str
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r');
  // 2. HTML-escape для &, <, > (щоб не зламати атрибут і не виконати XSS)
  return jsEscaped.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Розбиває AI-відповідь на окремі JSON-об'єкти (17.04.2026 сесія 14zLe).
// Причина: AI на запит "видали X, Y, Z, додай A" повертає кілька {...} блоків
// один за одним. Стара логіка з /\{[\s\S]*\}/ жадібно захоплювала все як один
// блок — JSON.parse падав, юзер бачив сирий JSON у чаті.
// Балансує фігурні дужки з урахуванням рядків у лапках (щоб { у value не ламав
// парсер). Повертає масив розпарсених об'єктів. Використовується у всіх chat-
// барах: tasks, habits, evening, health, projects, finance. Inbox на
// tool calling — не потребує цієї утиліти.
export function extractJsonBlocks(text) {
  if (!text) return [];
  const blocks = [];
  let depth = 0, start = -1, inStr = false, esc = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (esc) { esc = false; continue; }
    if (c === '\\' && inStr) { esc = true; continue; }
    if (c === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (c === '{') {
      if (depth === 0) start = i;
      depth++;
    } else if (c === '}') {
      depth--;
      if (depth === 0 && start !== -1) {
        try { blocks.push(JSON.parse(text.slice(start, i + 1))); } catch {}
        start = -1;
      }
    }
  }
  return blocks;
}

// B-87 fix (20.04.2026 NRw8G): парсер content AI-відповіді — витягує перший
// JSON-блок {chips:[...]} і повертає { text, chips } з text БЕЗ JSON частини.
// Використовує depth-tracking (балансує фігурні дужки з урахуванням рядків)
// щоб точно вирізати цілий JSON-блок. Старий жадібно-лазливий регекс
// /\{[\s\S]*?"chips"[\s\S]*?\}/g ріс на першому `}` після "chips" (всередині
// першого чіп-об'єкта) і лишав решту `{...}]}` як сміття у тексті.
export function parseContentChips(content) {
  if (!content || typeof content !== 'string') return { text: content || '', chips: null };
  const ranges = [];
  let depth = 0, start = -1, inStr = false, esc = false;
  for (let i = 0; i < content.length; i++) {
    const c = content[i];
    if (esc) { esc = false; continue; }
    if (c === '\\' && inStr) { esc = true; continue; }
    if (c === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    // Трекаємо і об'єкти {...}, і масиви [...] — голий масив теж валідний chip-формат (захист
    // від промпт-помилок типу REMINDER_RULES до MPVly 05.05, де AI вчили генерувати [{...}] без обгортки).
    if (c === '{' || c === '[') {
      if (depth === 0) start = i;
      depth++;
    } else if (c === '}' || c === ']') {
      depth--;
      if (depth === 0 && start !== -1) { ranges.push([start, i + 1]); start = -1; }
    }
  }
  // WML2Z 03.06 (скрін «Список не список»): AI часом генерує JSON чіпів з зайвими
  // комами (`"steps":null }, },`) — strict JSON.parse кидає, і весь код-блок чіпів
  // вивалюється сирим текстом у бульбашку чату. Fallback: при невдачі strict-парсу
  // прибираємо trailing-коми перед }/] і пробуємо ще раз. Прощаємо помилку AI —
  // юзер бачить кнопки, а не кашу. Lenient-гілка лише при вже-невдалому strict.
  const parseLenient = (str) => {
    try { return JSON.parse(str); } catch {}
    try { return JSON.parse(str.replace(/,(\s*[}\]])/g, '$1')); } catch {}
    return undefined;
  };
  let chips = null, cutRange = null;
  for (const [s, e] of ranges) {
    const obj = parseLenient(content.slice(s, e));
    if (obj === undefined) continue;
    // Формат A: канонічна обгортка {"chips":[...]}.
    if (obj && Array.isArray(obj.chips)) { chips = obj.chips; cutRange = [s, e]; break; }
    // Формат B (fallback): голий масив [{label, action}, ...]. Пройде тільки якщо ВСІ елементи
    // мають label+action — інакше це випадковий масив, не чіпи.
    if (Array.isArray(obj) && obj.length > 0 && obj.every(it => it && typeof it === 'object'
        && typeof it.label === 'string' && typeof it.action === 'string')) {
      chips = obj; cutRange = [s, e]; break;
    }
  }
  if (cutRange) {
    const text = (content.slice(0, cutRange[0]) + content.slice(cutRange[1]))
      .replace(/\s+([,.!?])/g, '$1')
      .replace(/\s{2,}/g, ' ')
      .trim();
    return { text, chips };
  }
  return { text: content.trim(), chips: null };
}

// === Міні-лог останніх дій для крос-контексту OWL ===
const NM_RECENT_ACTIONS_KEY = 'nm_recent_actions';
const NM_RECENT_ACTIONS_MAX = 20;

export function logRecentAction(action, title, tab) {
  try {
    const actions = JSON.parse(localStorage.getItem(NM_RECENT_ACTIONS_KEY) || '[]');
    actions.push({ action, title, tab, ts: Date.now() });
    if (actions.length > NM_RECENT_ACTIONS_MAX) actions.splice(0, actions.length - NM_RECENT_ACTIONS_MAX);
    localStorage.setItem(NM_RECENT_ACTIONS_KEY, JSON.stringify(actions));
  } catch(e) {}
}

export function getRecentActions() {
  try { return JSON.parse(localStorage.getItem(NM_RECENT_ACTIONS_KEY) || '[]'); } catch { return []; }
}

// === i18n заглушка (24.04.2026 nudNp правило, 29.04.2026 m4Q1o реалізація) ===
// Поки повертає fallback (українську). Колись словник у `src/i18n/<lang>.json`
// замінить fallback на переклад. Параметри підставляються через {name}-плейсхолдери:
//   t('greeting', 'Привіт, {name}!', { name: 'Роман' }) → "Привіт, Роман!"
// Використовуємо replaceAll (не RegExp у циклі) — швидше і безпечніше від спецсимволів
// у значеннях. CI-скрипт scripts/check-i18n.js ламає білд якщо новий рядок з кирилицею
// не обгорнутий у t(). AI-промпти у src/ai/* лишаємо українськими (whitelist).
// Активна мова UI (qpzj7k forward-looking): єдине джерело для голосу OWL і
// майбутнього словника i18n. Зараз дефолт 'uk'; коли додамо англійську —
// nm_settings.lang='en' і все (TTS + переклади) перемкнеться автоматично.
export function getLang() {
  try { return (getSettings().lang) || 'uk'; }
  catch (e) { return 'uk'; }
}

export function t(key, fallback, params) {
  let result = fallback;
  if (params && typeof params === 'object') {
    for (const [k, v] of Object.entries(params)) {
      result = result.replaceAll(`{${k}}`, String(v));
    }
  }
  return result;
}

// Levenshtein distance — для fuzzy match (B-126 follow-up MPVly 05.05).
// Кейс: юзер сказав "поприбирати", AI зберіг "поприбрати" (опечатка) → юзер
// повторює правильно → delete_reminder з .includes() не знаходить (ні одне
// не substring іншого), створюється дубль. Levenshtein ловить такі пари
// як distance=1 (одна вставка/видалення/заміна літери).
export function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a || !b) return (a || b).length;
  const al = a.length, bl = b.length;
  if (Math.abs(al - bl) > Math.max(al, bl)) return Math.max(al, bl);
  const prev = new Array(al + 1);
  for (let i = 0; i <= al; i++) prev[i] = i;
  for (let j = 1; j <= bl; j++) {
    let curr = j;
    for (let i = 1; i <= al; i++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const next = Math.min(prev[i] + 1, curr + 1, prev[i - 1] + cost);
      prev[i - 1] = curr;
      curr = next;
    }
    prev[al] = curr;
  }
  return prev[al];
}

// 64CXo: canonical reminders accessors. Раніше 8 точок setItem('nm_reminders')
// напряму без диспатчу — OWL не дізнавався про нові/видалені reminder'и
// одразу. Тепер saveReminders() диспатчить detail:'reminder' (мапа є у
// boot.js DETAIL_TO_KEY → handleSyncKey('nm_reminders') → cross-tab sync).
export function getReminders() {
  try { return JSON.parse(localStorage.getItem('nm_reminders') || '[]'); }
  catch { return []; }
}
export function saveReminders(arr) {
  localStorage.setItem('nm_reminders', JSON.stringify(arr));
  window.dispatchEvent(new CustomEvent('nm-data-changed', { detail: 'reminder' }));
}

// Functions called from HTML event handlers
window.autoResizeTextarea = autoResizeTextarea;
