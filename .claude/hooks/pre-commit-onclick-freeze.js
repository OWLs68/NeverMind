#!/usr/bin/env node
// pre-commit-onclick-freeze.js — net-rachet проти inline onclick (DGH6F 16.05).
//
// CSP `script-src 'self'` (без 'unsafe-inline') блокує усі inline onclick=.
// NeverMind має 319 onclick станом на DGH6F → Strangler refactor по 16-30 за раз
// мігрує їх на data-action + event delegation (src/core/delegation.js).
//
// Цей hook — захист від РЕГРЕСIЇ під час Strangler: не дозволяє додавати
// чисті НОВI onclick (без відповідного видалення).
//
// Логіка:
//   ADDED = кількість «+onclick=» у diff (виключаючи коментарі `+// ...`)
//   REMOVED = кількість «-onclick=» у diff
//   Якщо ADDED > REMOVED → блок з повідомленням
//
// Чому net (а не абсолютний):
//   Refactor «onclick → data-action» додає `data-action="X"` і видаляє
//   `onclick="X()"`. Hook рахує тільки `onclick=` рядки — позитивне видалення.
//   Через net дозволяємо переписувати без штучних обмежень.
//
// Bypass — не існує. Якщо треба додати onclick (наприклад тимчасово до
// migration handler'а), додай у `.claude/onclick-allow-list.txt` (поки що
// не реалізовано — попроси Голову).

const { execSync } = require('child_process');
const path = require('path');

function readStdin() {
  try { return require('fs').readFileSync(0, 'utf-8'); } catch { return ''; }
}

const input = readStdin();
let toolInput = {};
try { toolInput = JSON.parse(input || '{}'); } catch {}
const cmd = (toolInput.tool_input && toolInput.tool_input.command) || '';

// Спрацьовуємо тільки на git commit
if (!/\bgit\s+commit\b/.test(cmd)) {
  process.exit(0);
}

// Діапазон файлів — JS, HTML
let diff = '';
try {
  diff = execSync(
    "git diff --cached -- '*.js' '*.html'",
    { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 }
  );
} catch {
  process.exit(0); // якщо git недоступний — не блокуємо
}

if (!diff) process.exit(0);

const lines = diff.split('\n');
let added = 0;
let removed = 0;
const addedExamples = [];

for (const line of lines) {
  // Виключаємо diff-meta рядки (+++/---) і коментарі (+// або +  //)
  if (!line) continue;
  if (line.startsWith('+++') || line.startsWith('---')) continue;

  const isAdd = line.startsWith('+');
  const isRm  = line.startsWith('-');
  if (!isAdd && !isRm) continue;

  const body = line.slice(1).trim();
  if (body.startsWith('//')) continue; // коментар у JS
  if (body.startsWith('*')) continue;  // коментар у JSDoc

  if (!/\bonclick=/.test(body)) continue;

  if (isAdd) {
    added++;
    if (addedExamples.length < 3) addedExamples.push(body.slice(0, 100));
  } else {
    removed++;
  }
}

const net = added - removed;
if (net > 0) {
  console.error('🚫 PRE-COMMIT-ONCLICK-FREEZE: чистий приріст inline onclick=' + net + ' (added=' + added + ', removed=' + removed + ').');
  console.error('');
  console.error('   Strangler refactor (DGH6F 16.05): новий onclick = регресія перед strict CSP.');
  console.error('   Використовуй event delegation:');
  console.error('     HTML:  <button data-action="X" data-id="...">…</button>');
  console.error('     JS:    import { reg } from "./core/delegation.js";');
  console.error('            reg("X", (data, el, ev) => handler(data.id));');
  console.error('');
  if (addedExamples.length > 0) {
    console.error('   Приклади доданих рядків:');
    addedExamples.forEach((ex, i) => console.error('     ' + (i + 1) + '. ' + ex));
  }
  console.error('');
  console.error('   Деталі: src/core/delegation.js + ROADMAP Security Hardening BLOCKER #1.');
  process.exit(2);
}

process.exit(0);
