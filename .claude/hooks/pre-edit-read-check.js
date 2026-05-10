#!/usr/bin/env node
// .claude/hooks/pre-edit-read-check.js
//
// PreToolUse hook (запускається ПЕРЕД виконанням Edit).
// Блокує Edit якщо файл НЕ був Read'нутий у поточній сесії.
//
// Реалізує правило з CLAUDE.md/RULES_TECH «Edit вимагає попереднього Read» —
// декларативне правило яке систематично порушується (4 епізоди у BqTWF +
// 3 у 64CXo). Той самий патерн що i18n-білд-фейл (m4Q1o) і pre-push-check
// (oknnM): декларативне правило без хука розкладається.
//
// Логіка:
//   1) Витягує tool_input.file_path з stdin payload.
//   2) Сканує transcript JSONL на наявність Read tool_use з тим самим шляхом
//      У ЦІЙ СЕСІЇ.
//   3) Якщо знайдено — пропускає (exit 0).
//   4) Якщо НЕ знайдено — блокує (exit 2) з повідомленням.
//
// Bypass:
//   - Файл був створений Write у цій сесії (новий файл — Read не потрібен).
//   - Файл був прочитаний через Bash cat / head / tail з тим самим шляхом.
//   - Універсальна фраза «read-bypass: ok» у останніх 5 повідомленнях
//     асистента (для рідкісних false positive — наприклад коли Read зробив
//     sub-агент Council, а Голова робить Edit за його знахідкою).
//
// Створено: 10.05.2026 dyhJu (продовження автоматизації декларативних правил
// після pre-push-check + check-estimate-without-read + check-i18n).

const fs = require('fs');
const path = require('path');

const N_RECENT_MESSAGES = 5; // bypass-фраза шукається у короткому хвості

const UNIVERSAL_BYPASS = /read-bypass:\s*ok/i;

// === Утиліти ===

function normalizePath(p) {
  if (!p) return '';
  // Розгортаємо ~ і відносні шляхи відносно cwd
  let abs = p;
  if (p.startsWith('~/')) abs = path.join(process.env.HOME || '', p.slice(2));
  if (!path.isAbsolute(abs)) abs = path.resolve(process.cwd(), abs);
  return path.normalize(abs);
}

// Збирає всі tool_use блоки з transcript у хронологічному порядку.
function readAllToolUses(transcriptPath) {
  if (!fs.existsSync(transcriptPath)) return [];
  const lines = fs.readFileSync(transcriptPath, 'utf8').split('\n').filter(Boolean);
  const tools = [];
  for (const line of lines) {
    try {
      const entry = JSON.parse(line);
      if (entry.type !== 'assistant' || !entry.message) continue;
      const content = entry.message.content;
      if (!Array.isArray(content)) continue;
      for (const c of content) {
        if (c.type === 'tool_use') tools.push(c);
      }
    } catch {}
  }
  return tools;
}

function readRecentAssistantTexts(transcriptPath, n) {
  if (!fs.existsSync(transcriptPath)) return '';
  const lines = fs.readFileSync(transcriptPath, 'utf8').split('\n').filter(Boolean);
  const texts = [];
  for (let i = lines.length - 1; i >= 0 && texts.length < n; i--) {
    try {
      const entry = JSON.parse(lines[i]);
      if (entry.type !== 'assistant' || !entry.message) continue;
      const c = entry.message.content;
      if (Array.isArray(c)) {
        const t = c.filter(b => b.type === 'text' && b.text).map(b => b.text).join('\n');
        if (t) texts.push(t);
      } else if (typeof c === 'string' && c.length > 0) {
        texts.push(c);
      }
    } catch {}
  }
  return texts.join('\n');
}

// Чи був Read / Write на той самий шлях?
function wasFileTouched(tools, targetAbs) {
  for (const t of tools) {
    if (!t.input) continue;
    if (t.name === 'Read' || t.name === 'Write') {
      const fp = normalizePath(t.input.file_path || '');
      if (fp && fp === targetAbs) return true;
    }
    // Bash cat/head/tail з тим самим шляхом — теж рахуємо як «прочитано»
    if (t.name === 'Bash' && typeof t.input.command === 'string') {
      const cmd = t.input.command;
      // Простий патерн: cat/head/tail/less з абсолютним або відносним шляхом
      const re = /\b(cat|head|tail|less|more)\s+(-\S+\s+)*("([^"]+)"|'([^']+)'|(\S+))/g;
      let m;
      while ((m = re.exec(cmd)) !== null) {
        const raw = m[4] || m[5] || m[6] || '';
        if (!raw) continue;
        const fp = normalizePath(raw);
        if (fp === targetAbs) return true;
      }
    }
  }
  return false;
}

// === MAIN ===

let input = '';
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input || '{}');
    const toolName = data.tool_name || '';

    // Активуємось ЛИШЕ для Edit. Write створює нові файли — там не треба Read.
    if (toolName !== 'Edit') process.exit(0);

    const filePath = data.tool_input && data.tool_input.file_path;
    if (!filePath) process.exit(0);

    const transcriptPath = data.transcript_path;
    if (!transcriptPath) process.exit(0);

    const targetAbs = normalizePath(filePath);
    if (!targetAbs) process.exit(0);

    const tools = readAllToolUses(transcriptPath);
    if (wasFileTouched(tools, targetAbs)) process.exit(0);

    // Універсальний bypass — якщо у останніх повідомленнях є «read-bypass: ok»
    const haystack = readRecentAssistantTexts(transcriptPath, N_RECENT_MESSAGES);
    if (UNIVERSAL_BYPASS.test(haystack)) {
      console.error('\n⚠️  PRE-EDIT: bypass «read-bypass: ok» спрацював для ' + filePath + '. Переконайся що ти знаєш поточний стан файлу.\n');
      process.exit(0);
    }

    // Блокуємо
    console.error('\n=== ⚠️ PRE-EDIT ПЕРЕВІРКА (.claude/hooks/pre-edit-read-check.js) ===\n');
    console.error(
      `🚫 Edit без попереднього Read у цій сесії: ${filePath}\n\n` +
      'Правило з CLAUDE.md / RULES_TECH §3: «Читай код перед змінами. Ніколи на пам\'ять.»\n' +
      'Декларативне правило систематично порушується (4 епізоди у BqTWF + 3 у 64CXo).\n\n' +
      'Що робити:\n' +
      '  1) Викликай Read на цей файл (повністю або потрібний фрагмент через offset/limit).\n' +
      '  2) Перевір що old_string справді існує у файлі.\n' +
      '  3) Повтори Edit.\n\n' +
      'Якщо файл прочитав sub-агент / Council, а ти робиш Edit за його знахідкою — це АНТИПАТЕРН ' +
      '(CLAUDE.md «🔍 ГІПОТЕЗА АГЕНТА ≠ ФАКТ»). Спочатку відкрий файл сам, переконайся що проблема ' +
      'описана агентом реальна, тоді Edit.\n\n' +
      'Якщо це справді false positive (наприклад файл щойно створено через зовнішній процес) — ' +
      'додай фразу «read-bypass: ok» у відповідь і повтори.'
    );
    console.error('\n=== Прочитай файл і повтори Edit. ===\n');
    process.exit(2);
  } catch {
    // Не блокуємо при помилках самого хука
    process.exit(0);
  }
});
