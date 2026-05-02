#!/usr/bin/env node
// scripts/check-i18n.js — детектор необгорнутих українських рядків у src/.
//
// План з UG1Fr (29.04.2026, 2 раунди Gemini, 3 баги виправлено).
// Реалізація m4Q1o 29.04.2026.
//
// ТРИ РЕЖИМИ:
//   node scripts/check-i18n.js              # default: порівняти з baseline, exit 1 якщо виросло
//   node scripts/check-i18n.js --update-baseline  # оновити baseline.json (після обгортання)
//   node scripts/check-i18n.js --report <file>    # надрукувати які рядки необгорнуті
//
// ЛОГІКА:
//   1. Прохід по всіх *.js у src/ (окрім whitelist-директорій)
//   2. Видалення коментарів (// і /* */ з підтримкою однорядкових */)
//   3. Виявлення string-літералів ('...', "...", `...`) з кирилицею
//   4. Скіп якщо літерал всередині дозволеного виклику (t, console.*, toLocaleDateString, toLocaleString)
//   5. Підрахунок per-file → порівняння з i18n-baseline.json
//
// WHITELIST з UG1Fr:
//   - Директорії: src/ai/* (AI-промпти), src/owl/* (mixed AI+UI)
//   - Виклики: t(...), console.{log,error,warn,info}(...), toLocaleDateString/String(...)
//   - Коментарі: // ... \n  і  /* ... */ (з обробкою закриття на тому ж рядку)

const fs = require('fs');
const path = require('path');

const SRC_DIR = path.resolve(__dirname, '..', 'src');
const BASELINE_PATH = path.resolve(__dirname, '..', 'i18n-baseline.json');

// === WHITELIST ===
// Директорії що ігноруються повністю (AI-промпти лишаються українськими)
// 'data' — канонічні довідники з fallback-масивами (months.js, notes-categories.js
// тощо). Самі масиви українською — це fallback що замінюється через t() у getter'ах.
const DIR_WHITELIST = ['ai', 'owl', 'data'];

// Виклики у яких літерал НЕ рахується як необгорнутий
// Перевірка: чи передують літералу один з цих pattern'ів (через дужки враховуючи depth)
const CALL_WHITELIST = [
  't',
  'console.log',
  'console.error',
  'console.warn',
  'console.info',
  'console.debug',
  'toLocaleDateString',
  'toLocaleString',
  'toLocaleTimeString',
];

// Регекс кирилиці (українська + загальна слов'янська)
const CYRILLIC_RE = /[Ѐ-ӿԀ-ԯ]/;

// === АЛГОРИТМ ===

function walkJsFiles(dir, files = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // Пропускаємо whitelist-директорії
      const rel = path.relative(SRC_DIR, full).split(path.sep)[0];
      if (DIR_WHITELIST.includes(rel) && path.dirname(full) === SRC_DIR) continue;
      walkJsFiles(full, files);
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      files.push(full);
    }
  }
  return files;
}

// Видаляємо коментарі // і /* */ з обробкою однорядкового /* */
// Зберігаємо рядки і колонки інших токенів (заміна на пробіли)
function stripComments(src) {
  let out = '';
  let i = 0;
  let inSingle = false, inDouble = false, inBacktick = false, esc = false;
  let inLineComment = false, inBlockComment = false;
  while (i < src.length) {
    const c = src[i];
    const next = src[i + 1];
    if (inLineComment) {
      if (c === '\n') { inLineComment = false; out += c; }
      else out += ' ';
      i++; continue;
    }
    if (inBlockComment) {
      if (c === '*' && next === '/') { inBlockComment = false; out += '  '; i += 2; continue; }
      if (c === '\n') out += c;
      else out += ' ';
      i++; continue;
    }
    if (inSingle || inDouble || inBacktick) {
      if (esc) { esc = false; out += c; i++; continue; }
      if (c === '\\') { esc = true; out += c; i++; continue; }
      if (inSingle && c === "'") inSingle = false;
      else if (inDouble && c === '"') inDouble = false;
      else if (inBacktick && c === '`') inBacktick = false;
      out += c; i++; continue;
    }
    // не у коментарі і не у рядку
    if (c === '/' && next === '/') { inLineComment = true; out += '  '; i += 2; continue; }
    if (c === '/' && next === '*') { inBlockComment = true; out += '  '; i += 2; continue; }
    if (c === "'") { inSingle = true; out += c; i++; continue; }
    if (c === '"') { inDouble = true; out += c; i++; continue; }
    if (c === '`') { inBacktick = true; out += c; i++; continue; }
    out += c; i++;
  }
  return out;
}

// Знаходить усі string-літерали з позиціями (start, end, content, lineNum, type)
// Дублює логіку парсингу — але працює з результатом stripComments (де коментарі = пробіли)
function findStringLiterals(src) {
  const literals = [];
  let i = 0;
  let line = 1;
  let inSingle = false, inDouble = false, inBacktick = false, esc = false;
  let start = -1, startLine = -1;
  while (i < src.length) {
    const c = src[i];
    if (c === '\n' && !esc) line++;
    if (esc) { esc = false; i++; continue; }
    if (inSingle || inDouble || inBacktick) {
      if (c === '\\') { esc = true; i++; continue; }
      if (inSingle && c === "'") {
        literals.push({ start, end: i + 1, content: src.slice(start + 1, i), line: startLine, type: "'" });
        inSingle = false; start = -1;
      } else if (inDouble && c === '"') {
        literals.push({ start, end: i + 1, content: src.slice(start + 1, i), line: startLine, type: '"' });
        inDouble = false; start = -1;
      } else if (inBacktick && c === '`') {
        literals.push({ start, end: i + 1, content: src.slice(start + 1, i), line: startLine, type: '`' });
        inBacktick = false; start = -1;
      }
      i++; continue;
    }
    if (c === "'") { inSingle = true; start = i; startLine = line; }
    else if (c === '"') { inDouble = true; start = i; startLine = line; }
    else if (c === '`') { inBacktick = true; start = i; startLine = line; }
    i++;
  }
  return literals;
}

// Перевіряє чи літерал на позиції pos знаходиться всередині дозволеного виклику.
// Рухаємося назад від pos, рахуємо дужки. Коли depth повертається до -1 (вийшли
// з обгорткової дужки), читаємо ім'я виклику перед нею.
function isInsideAllowedCall(src, pos) {
  let depth = 0;
  let i = pos - 1;
  while (i >= 0) {
    const c = src[i];
    if (c === ')') depth++;
    else if (c === '(') {
      if (depth === 0) {
        // Виходимо з виклику. Перед '(' має бути ім'я функції.
        let j = i - 1;
        while (j >= 0 && /\s/.test(src[j])) j--;
        // Читаємо ім'я (літери, цифри, крапка для console.log, $, _)
        let nameEnd = j + 1;
        while (j >= 0 && /[A-Za-z0-9_.$]/.test(src[j])) j--;
        const name = src.slice(j + 1, nameEnd);
        if (CALL_WHITELIST.includes(name)) return true;
        // Не у whitelist — продовжуємо нагору, бо може бути зовнішній виклик
        // Приклад: foo(t('a', 'b')) — для 'b' внутрішній '(' це t, treba пропустити foo
        // Тут ми вже знайшли t як батько → return true вище.
        // Якщо ім'я НЕ у whitelist — це означає батьківський виклик типу foo(...).
        // Літерал може бути аргументом foo, не t. Рухаємося далі вверх.
        i = j;
        continue;
      }
      depth--;
    }
    i--;
  }
  return false;
}

// Для backtick-літералів вирізаємо ${...} блоки (balanced) — кирилиця всередині
// інтерполяцій уже могла бути обгорнута у t() і не рахується як «гола».
// Виправляє false-positive: `Привіт ${t('name', 'юзер')}` без зміни → 0 кирилиці поза ${}.
function stripInterpolations(content) {
  let out = ''; let i = 0;
  while (i < content.length) {
    if (content[i] === '$' && content[i + 1] === '{') {
      let depth = 1; i += 2;
      while (i < content.length && depth > 0) {
        if (content[i] === '{') depth++;
        else if (content[i] === '}') depth--;
        i++;
      }
      continue;
    }
    out += content[i++];
  }
  return out;
}

// Аналізує файл, повертає масив unwrapped-літералів.
function analyzeFile(absPath) {
  const src = fs.readFileSync(absPath, 'utf8');
  const stripped = stripComments(src);
  const literals = findStringLiterals(stripped);
  const unwrapped = [];
  for (const lit of literals) {
    const check = lit.type === '`' ? stripInterpolations(lit.content) : lit.content;
    if (!CYRILLIC_RE.test(check)) continue;
    if (isInsideAllowedCall(stripped, lit.start)) continue;
    unwrapped.push({
      line: lit.line,
      type: lit.type,
      content: lit.content.length > 80 ? lit.content.slice(0, 77) + '...' : lit.content,
    });
  }
  return unwrapped;
}

// Будує { 'src/path/file.js': count, ... } по всіх файлах
function buildCounts() {
  const files = walkJsFiles(SRC_DIR);
  const counts = {};
  const details = {};
  for (const f of files) {
    const rel = path.relative(path.resolve(__dirname, '..'), f).replaceAll(path.sep, '/');
    const unwrapped = analyzeFile(f);
    if (unwrapped.length > 0) {
      counts[rel] = unwrapped.length;
      details[rel] = unwrapped;
    }
  }
  return { counts, details };
}

function loadBaseline() {
  if (!fs.existsSync(BASELINE_PATH)) return null;
  try { return JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8')); }
  catch (e) {
    console.error('✗ i18n-baseline.json пошкоджено:', e.message);
    process.exit(1);
  }
}

function saveBaseline(counts) {
  const sorted = {};
  for (const k of Object.keys(counts).sort()) sorted[k] = counts[k];
  fs.writeFileSync(BASELINE_PATH, JSON.stringify(sorted, null, 2) + '\n');
}

// === MODES ===

function modeUpdateBaseline() {
  const { counts } = buildCounts();
  saveBaseline(counts);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const fileCount = Object.keys(counts).length;
  console.log(`✓ i18n-baseline.json оновлено: ${total} необгорнутих рядків у ${fileCount} файлах.`);
}

function modeReport(targetFile) {
  // Нормалізуємо шлях
  const abs = path.resolve(targetFile);
  if (!fs.existsSync(abs)) {
    console.error(`✗ файл не існує: ${targetFile}`);
    process.exit(1);
  }
  if (!abs.endsWith('.js') || !abs.startsWith(SRC_DIR)) {
    // Файл не у src/ або не .js — нічого не звітуємо (тиха відсутність)
    return;
  }
  // Перевірка на whitelist-директорії
  const rel = path.relative(SRC_DIR, abs).split(path.sep)[0];
  if (DIR_WHITELIST.includes(rel)) return;
  const unwrapped = analyzeFile(abs);
  if (unwrapped.length === 0) {
    console.log(`✓ i18n: ${path.relative(path.resolve(__dirname, '..'), abs)} — всі українські рядки обгорнуті у t().`);
    return;
  }
  const relPath = path.relative(path.resolve(__dirname, '..'), abs).replaceAll(path.sep, '/');
  console.log(`📋 i18n: ${relPath} має ${unwrapped.length} необгорнутих українських рядків.`);
  console.log(`   Обгорни кілька поки правиш цей файл (поряд з твоєю правкою):`);
  const preview = unwrapped.slice(0, 5);
  for (const u of preview) {
    console.log(`   ${relPath}:${u.line}  ${u.type}${u.content}${u.type}`);
  }
  if (unwrapped.length > 5) console.log(`   ... ще ${unwrapped.length - 5}`);
  console.log(`   Після обгортання: node scripts/check-i18n.js --update-baseline`);
}

function modeCheck() {
  const { counts } = buildCounts();
  const baseline = loadBaseline();
  if (!baseline) {
    console.error('✗ i18n-baseline.json відсутній. Спочатку запусти: node scripts/check-i18n.js --update-baseline');
    process.exit(1);
  }
  const errors = [];
  const decreased = [];
  // Перевірка зростання
  for (const file of Object.keys(counts)) {
    const current = counts[file];
    const base = baseline[file] || 0;
    if (current > base) {
      errors.push({ file, current, base, diff: current - base });
    } else if (current < base) {
      decreased.push({ file, current, base, diff: base - current });
    }
  }
  // Перевірка нових файлів (поява у counts але не у baseline)
  // Уже покрита логікою вище (base = 0 → будь-яке current > 0 = error)
  if (errors.length > 0) {
    console.error('✗ i18n: зросла кількість необгорнутих українських рядків:');
    for (const e of errors) {
      console.error(`   ${e.file}: ${e.base} → ${e.current} (+${e.diff})`);
    }
    console.error('');
    console.error('Можливі причини:');
    console.error('  1) Додав новий рядок без обгортання у t(\'key\', \'fallback\').');
    console.error('  2) Свідомо хочеш збільшити (напр. розгорнув новий розділ).');
    console.error('     Тоді: оберни новий код у t() ТАК САМО як існуючий — або,');
    console.error('     якщо це AI-промпт/системний рядок — додай у whitelist у scripts/check-i18n.js.');
    console.error('');
    console.error('Деталі: node scripts/check-i18n.js --report <file>');
    process.exit(1);
  }
  if (decreased.length > 0) {
    const totalRemoved = decreased.reduce((a, b) => a + b.diff, 0);
    console.log(`✓ i18n: ${totalRemoved} рядків обгорнуто (у ${decreased.length} файлах). Не забудь:`);
    console.log('  node scripts/check-i18n.js --update-baseline');
  } else {
    console.log('✓ i18n: без змін у необгорнутих рядках.');
  }
}

// === ENTRY ===

const args = process.argv.slice(2);
if (args[0] === '--update-baseline' || args[0] === '--init') {
  modeUpdateBaseline();
} else if (args[0] === '--report') {
  if (!args[1]) {
    console.error('Використання: node scripts/check-i18n.js --report <file>');
    process.exit(1);
  }
  modeReport(args[1]);
} else if (args.length === 0) {
  modeCheck();
} else {
  console.error('Невідомий аргумент:', args[0]);
  console.error('Доступні: --update-baseline | --report <file> | (без аргументів — перевірка)');
  process.exit(1);
}
