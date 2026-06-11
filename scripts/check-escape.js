#!/usr/bin/env node
// scripts/check-escape.js
//
// Юніт-сторож escape-класу (сесія 7uxlr7, 11.06.2026).
//
// ІСТОРІЯ КЛАСУ — 4 інциденти одного кореня (екранування тексту юзера в HTML):
//   1) notes.js:186 stored XSS через назву папки (e9t3N 15.05)
//   2) B-157 крихкий escape у notes.js:355 (LfA6w 07.05)
//   3) SEC-1 escapeHtml не екранував лапки → пробій атрибута у ~25 місцях (vdlyeg 10.06)
//   4) B-197 escapeJsArg замість escapeHtml у data-folder → свайп не знаходив
//      папку з апострофом (vdlyeg 10.06)
// Після SEC-1 + B-197 корінь закритий, але разовий тест vdlyeg («8/8 unit»)
// не був закомічений — ніщо не ловило 5-й рецидив. Цей файл — постійний сторож,
// запускається з .claude/hooks/pre-push-check.js на кожен git push.
//
// ЯК ПРАЦЮЄ: src/core/utils.js не можна заімпортувати у Node (його перший import
// тягне inbox.js → весь застосунок з browser-globals). Тому вирізаємо текст
// функцій escapeHtml / safeHref / escapeJsArg (+ module-константи _RE_*) прямо
// з файлу і виконуємо як самодостатній код — тестуємо РЕАЛЬНИЙ код, не копію.
// Якщо функції переименують/приберуть — сторож впаде з чіткою помилкою (це теж сигнал).

const fs = require('fs');
const path = require('path');

const UTILS_PATH = path.join(__dirname, '..', 'src', 'core', 'utils.js');

// === Витяг коду ===

// Вирізає `export function NAME(...) { ... }` з балансом фігурних дужок.
// Достатньо для наших функцій (без дужок у рядкових літералах на межах блоків).
function extractFunction(src, name) {
  const startRe = new RegExp('export function ' + name + '\\s*\\(');
  const m = src.match(startRe);
  if (!m) throw new Error(`extractFunction: «export function ${name}» не знайдено у utils.js — сторож застарів або функцію прибрали`);
  const start = m.index;
  const bodyStart = src.indexOf('{', start);
  let depth = 0;
  for (let i = bodyStart; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') {
      depth--;
      if (depth === 0) return src.slice(start, i + 1).replace(/^export /, '');
    }
  }
  throw new Error(`extractFunction: незбалансовані дужки у ${name}`);
}

// Вирізає module-константи _RE_DQUOTE/_RE_SQUOTE (потрібні escapeHtml)
function extractConsts(src) {
  const lines = src.split('\n').filter(l => /^const _RE_(D|S)QUOTE\s*=/.test(l));
  if (lines.length !== 2) throw new Error('extractConsts: очікував 2 константи _RE_DQUOTE/_RE_SQUOTE, знайдено ' + lines.length);
  return lines.join('\n');
}

const src = fs.readFileSync(UTILS_PATH, 'utf8');
const code = [
  extractConsts(src),
  extractFunction(src, 'escapeHtml'),
  extractFunction(src, 'safeHref'),
  extractFunction(src, 'escapeJsArg'),
  'return { escapeHtml, safeHref, escapeJsArg };',
].join('\n');

const { escapeHtml, safeHref, escapeJsArg } = new Function(code)();

// === Тести ===

let passed = 0;
const failures = [];

function check(label, actual, expected) {
  const ok = typeof expected === 'function' ? expected(actual) : actual === expected;
  if (ok) { passed++; return; }
  failures.push(`✗ ${label}\n    отримано: ${JSON.stringify(actual)}` +
    (typeof expected !== 'function' ? `\n    очікував: ${JSON.stringify(expected)}` : ''));
}

const SQ = String.fromCharCode(39); // апостроф (без літерала — i18n-детектор рахує парність лапок)
const DQ = String.fromCharCode(34); // подвійна лапка

// --- escapeHtml: пробій атрибута (клас SEC-1 / B-197) ---
check('escapeHtml: апостроф → &#39; (B-197 свайп папки)',
  escapeHtml(`пам${SQ}ять`), 'пам&#39;ять');
check('escapeHtml: подвійна лапка → &quot; (SEC-1 пробій атрибута)',
  escapeHtml(DQ + ' onmouseover=' + DQ + 'alert(1)'), '&quot; onmouseover=&quot;alert(1)');
check('escapeHtml: вивід не містить сирих лапок взагалі',
  escapeHtml(SQ + DQ), v => !v.includes(SQ) && !v.includes(DQ));
check('escapeHtml: тег і амперсанд',
  escapeHtml('<img src=x onerror=alert(1)> & co'), '&lt;img src=x onerror=alert(1)&gt; &amp; co');
check('escapeHtml: amp-first — вже-екрановане не псується подвійно',
  escapeHtml('&lt;'), '&amp;lt;');
check('escapeHtml: null/undefined → порожній рядок (B-70)',
  escapeHtml(null) + escapeHtml(undefined), '');

// round-trip: browser dataset декодує сутності назад — назва папки має повернутись 1:1
// (саме цей контракт зламав B-197: escapeJsArg dataset НЕ декодує)
const decodeEntities = s => s
  .replace(/&quot;/g, DQ).replace(/&#39;/g, SQ)
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const trickyFolder = `Рома${SQ}s ${DQ}спецпапка${DQ} <#1> & юа`;
check('escapeHtml: round-trip через decode = оригінал (контракт data-*)',
  decodeEntities(escapeHtml(trickyFolder)), trickyFolder);

// --- safeHref: небезпечні схеми (клас SEC-2) ---
check('safeHref: javascript: → null', safeHref('javascript:alert(1)'), null);
check('safeHref: JAVASCRIPT: (регістр) → null', safeHref('JaVaScRiPt:alert(1)'), null);
check('safeHref: java\\tscript: (контрольний символ в обхід) → null',
  safeHref('java\tscript:alert(1)'), null);
check('safeHref: data: → null', safeHref('data:text/html,<script>1</script>'), null);
check('safeHref: vbscript: → null', safeHref('vbscript:msgbox'), null);
check('safeHref: https — ок', safeHref('https://example.com/a?b=1'), 'https://example.com/a?b=1');
check('safeHref: mailto — ок', safeHref('mailto:roma@example.com'), 'mailto:roma@example.com');
check('safeHref: tel — ок', safeHref('tel:+380501112233'), 'tel:+380501112233');
check('safeHref: відносний шлях — ок', safeHref('/notes/123'), '/notes/123');
check('safeHref: anchor — ок', safeHref('#section'), '#section');
check('safeHref: порожнє/null → null', safeHref('') ?? safeHref(null) ?? safeHref('   '), null);

// --- escapeJsArg: вкладання у JS-рядок в атрибуті (B-152/B-159) ---
check('escapeJsArg: апостроф екранований бекслешем',
  escapeJsArg(`Roman${SQ}s`), 'Roman\\' + SQ + 's');
check('escapeJsArg: backslash-first — вхідний \\' + SQ + ' не стає потрійним',
  escapeJsArg('\\' + SQ), '\\\\\\' + SQ);
check('escapeJsArg: теги → &lt;&gt; (не виконуються в атрибуті)',
  escapeJsArg('<b>&'), '&lt;b&gt;&amp;');

// === Підсумок ===

if (failures.length > 0) {
  console.error(`\n=== ❌ ESCAPE-СТОРОЖ: ${failures.length} провалів (${passed} ок) ===\n`);
  console.error(failures.join('\n'));
  console.error('\nescapeHtml/safeHref/escapeJsArg у src/core/utils.js зламано або контракт змінено.');
  console.error('Це 4-разовий клас багів (notes.js XSS → B-157 → SEC-1 → B-197) — НЕ пушити без фіксу.\n');
  process.exit(1);
}
console.log(`✅ escape-сторож: ${passed}/${passed} тестів пройдено (escapeHtml + safeHref + escapeJsArg)`);
process.exit(0);
