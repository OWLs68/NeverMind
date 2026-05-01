#!/usr/bin/env node
// scripts/check-imports.js — guard для забутих імпортів між модулями.
//
// Корінь чому потрібен: у IIFE bundle (esbuild + format:'iife') якщо файл
// викликає `foo()` без явного `import { foo } from '...'` — esbuild не звʼязує
// модулі. При колізії імен функція перейменовується на `foo2`, і виклик `foo()`
// дає `ReferenceError` на проді. Не ловиться лінтером, не ловиться build'ом —
// тільки реальний клік юзера.
//
// Що робить скрипт:
//   1. Збирає всі експорти з src/**/*.js (function/const/let/var/class + reexports).
//   2. Для кожного файлу збирає: імпортовані імена + локальні декларації +
//      параметри top-level функцій + window.* виставлення.
//   3. Знаходить виклики `name(` у коді (поза рядками і коментарями).
//   4. Якщо ім'я викликаної функції — це експорт з ІНШОГО файлу `src/`,
//      а у поточному файлі НЕ імпортовано і НЕ локальне → помилка + exit 1.
//
// Підключений у build.js перед esbuild — деплой падає якщо знайдено забутий import.
// Запуск локально: `node scripts/check-imports.js`. Skip-варіант для екстрених:
// `SKIP_IMPORTS_CHECK=1 node build.js`.

const fs = require('fs');
const path = require('path');

const SRC_DIR = path.join(__dirname, '..', 'src');

function listJs(dir) {
  let out = [];
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, item.name);
    if (item.isDirectory()) out = out.concat(listJs(p));
    else if (item.name.endsWith('.js')) out.push(p);
  }
  return out;
}

// Видалити коментарі + рядкові літерали (грубо — щоб виклики у промптах не ловились як справжні)
function stripCodeNoise(txt) {
  // Видаляємо line comments
  let s = txt.replace(/\/\/[^\n]*/g, '');
  // Видаляємо block comments
  s = s.replace(/\/\*[\s\S]*?\*\//g, '');
  // Видаляємо template literals (можуть мати ${...} але всередині рядка `name(` теж може бути)
  s = s.replace(/`(?:[^`\\$]|\\[\s\S]|\$(?!\{)|\$\{[^}]*\})*`/g, '``');
  // Видаляємо single-quoted strings
  s = s.replace(/'(?:[^'\\\n]|\\.)*'/g, "''");
  // Видаляємо double-quoted strings
  s = s.replace(/"(?:[^"\\\n]|\\.)*"/g, '""');
  return s;
}

function getExports(txt) {
  const out = new Set();
  let m;
  // export function foo / export const foo / export class Foo
  const re1 = /^\s*export\s+(?:async\s+)?(?:function\*?|const|let|var|class)\s+([a-zA-Z_$][\w$]*)/gm;
  while ((m = re1.exec(txt))) out.add(m[1]);
  // export { foo, bar as baz }
  const re2 = /^\s*export\s*\{([^}]+)\}/gm;
  while ((m = re2.exec(txt))) {
    m[1].split(',').forEach(n => {
      const parts = n.trim().split(/\s+as\s+/);
      const name = (parts[1] || parts[0]).trim();
      if (name && /^[a-zA-Z_$][\w$]*$/.test(name)) out.add(name);
    });
  }
  return out;
}

function getImportedNames(txt) {
  const names = new Set();
  let m;
  // import { foo, bar as baz } from '...'  (включно з багатолінійними)
  const re1 = /import\s+(?:[\w$*,\s]+,\s*)?\{([^}]+)\}\s*from\s*['"][^'"]+['"]/g;
  while ((m = re1.exec(txt))) {
    m[1].split(',').forEach(n => {
      const parts = n.trim().split(/\s+as\s+/);
      const name = (parts[1] || parts[0]).trim();
      if (name && /^[a-zA-Z_$][\w$]*$/.test(name)) names.add(name);
    });
  }
  // import foo from '...'  (default)
  const re2 = /import\s+([a-zA-Z_$][\w$]*)\s*(?:,\s*\{[^}]+\})?\s*from\s*['"][^'"]+['"]/g;
  while ((m = re2.exec(txt))) names.add(m[1]);
  // import * as foo from '...'
  const re3 = /import\s+\*\s+as\s+([a-zA-Z_$][\w$]*)\s+from/g;
  while ((m = re3.exec(txt))) names.add(m[1]);
  return names;
}

function getLocalDeclarations(txt) {
  const names = new Set();
  let m;
  // function foo / async function foo / class Foo
  const re1 = /(?:^|\n|;)\s*(?:export\s+)?(?:async\s+)?(?:function\*?|class)\s+([a-zA-Z_$][\w$]*)/g;
  while ((m = re1.exec(txt))) names.add(m[1]);
  // const foo / let foo / var foo  (грубо — захоплює і параметри деструктуризації)
  const re2 = /(?:^|\n|;)\s*(?:export\s+)?(?:const|let|var)\s+([a-zA-Z_$][\w$]*)/g;
  while ((m = re2.exec(txt))) names.add(m[1]);
  // Параметри top-level функцій (грубо — будь-яка `function name(a, b, c)`)
  const reParams = /function\s*\*?\s*[a-zA-Z_$]?[\w$]*\s*\(([^)]*)\)/g;
  while ((m = reParams.exec(txt))) {
    m[1].split(',').forEach(p => {
      const name = p.trim().split('=')[0].trim().replace(/^\.\.\./, '');
      if (name && /^[a-zA-Z_$][\w$]*$/.test(name)) names.add(name);
    });
  }
  // Arrow function params (a, b) =>
  const reArrow = /\(([^()]*)\)\s*=>/g;
  while ((m = reArrow.exec(txt))) {
    m[1].split(',').forEach(p => {
      const name = p.trim().split('=')[0].trim().replace(/^\.\.\./, '');
      if (name && /^[a-zA-Z_$][\w$]*$/.test(name)) names.add(name);
    });
  }
  // window.foo = ...
  const reWin = /window\.([a-zA-Z_$][\w$]*)\s*=/g;
  while ((m = reWin.exec(txt))) names.add(m[1]);
  return names;
}

function main() {
  const files = listJs(SRC_DIR);
  // 1. Збір всіх експортів — щоб знати що є «справжнім» експортом з якогось файлу
  const allExportedNames = new Set();
  for (const f of files) {
    const txt = fs.readFileSync(f, 'utf8');
    for (const name of getExports(txt)) allExportedNames.add(name);
  }

  const issues = [];
  for (const f of files) {
    const txt = fs.readFileSync(f, 'utf8');
    const code = stripCodeNoise(txt);
    const imported = getImportedNames(txt);
    const localDecl = getLocalDeclarations(code);
    const ownExports = getExports(txt);

    // Виклики `name(` поза коментарями і рядками
    const callRe = /(?:^|[^\w$.])([a-zA-Z_$][\w$]*)\s*\(/g;
    let m;
    const seen = new Set();
    while ((m = callRe.exec(code))) {
      const name = m[1];
      if (seen.has(name)) continue;
      seen.add(name);
      if (name.length <= 1) continue;
      if (imported.has(name)) continue;
      if (localDecl.has(name)) continue;
      if (ownExports.has(name)) continue;
      // Зарезервоване слово / built-in
      if (!allExportedNames.has(name)) continue;
      // Це експорт з ІНШОГО файлу `src/` — а у нас імпорту нема
      // Знайдемо у якому файлі експортовано (для повідомлення)
      let source = '?';
      for (const otherF of files) {
        if (otherF === f) continue;
        if (getExports(fs.readFileSync(otherF, 'utf8')).has(name)) {
          source = path.relative(path.join(__dirname, '..'), otherF);
          break;
        }
      }
      // Знайдемо рядок виклику в оригінальному файлі
      const lineRe = new RegExp(`(?:^|[^\\w$.])${name}\\s*\\(`);
      const lines = txt.split('\n');
      let lineNum = '?';
      for (let i = 0; i < lines.length; i++) {
        if (lineRe.test(lines[i])) { lineNum = i + 1; break; }
      }
      issues.push({
        file: path.relative(path.join(__dirname, '..'), f),
        name,
        source,
        line: lineNum,
      });
    }
  }

  if (issues.length === 0) {
    console.log('✓ check-imports: усі виклики мають явний import.');
    process.exit(0);
  }

  console.error(`\n✗ check-imports: знайдено ${issues.length} виклик(ів) функції з іншого модуля без import:\n`);
  for (const i of issues) {
    console.error(`  ${i.file}:${i.line}  →  ${i.name}() (експорт з ${i.source})`);
  }
  console.error(`\n  Виправлення: додати ${issues.length === 1 ? "ім'я" : 'імена'} у import { ... } з відповідного файлу.`);
  console.error(`  Skip-варіант (для екстрених деплоїв): SKIP_IMPORTS_CHECK=1 node build.js\n`);
  process.exit(1);
}

main();
