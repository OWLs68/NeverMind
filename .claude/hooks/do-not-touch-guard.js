#!/usr/bin/env node
// .claude/hooks/do-not-touch-guard.js — 🔒 механічний замок на священні файли.
//
// PreToolUse hook (Edit|Write). Закриває дірку «docs/DO_NOT_TOUCH.md тримається
// на чесному слові» (дослідження gstack /freeze-guard, 26yz5s 03.07, ADR-004):
// декларативна заборона без хука розкладається — той самий клас що Edit-без-Read
// (pre-edit-read-check) і push-замок /byyou.
//
// Логіка (свідомо НЕ бюрократія):
//   1) Edit/Write у захищений файл → БЛОК з нагадуванням прочитати відповідну
//      секцію docs/DO_NOT_TOUCH.md.
//   2) Свідомий прохід: асистент пише у відповіді фразу «dnt-ack: <імʼя-файла>»
//      (= «прочитав священну корову, знаю що роблю») і повторює Edit —
//      далі цей файл розблоковано ДО КІНЦЯ СЕСІЇ (фраза лишається у транскрипті).
//   3) Помилка самого хука → пропускаємо (fail-open, не блокуємо роботу).
//
// Захищені файли — ті у яких «кожен рядок коштував годин дебагу» (DO_NOT_TOUCH):
//   src/core/boot.js  — localStorage override + setupSW (iOS quirks)
//   src/app.js        — критичний порядок імпортів
// Список свідомо короткий: замок на все = звикання ігнорувати замок.

const fs = require('fs');
const path = require('path');

const PROTECTED = [
  'src/core/boot.js',
  'src/app.js',
];

function normalizePath(p) {
  if (!p) return '';
  let abs = p;
  if (p.startsWith('~/')) abs = path.join(process.env.HOME || '', p.slice(2));
  if (!path.isAbsolute(abs)) abs = path.resolve(process.cwd(), abs);
  return path.normalize(abs);
}

function readAssistantTexts(transcriptPath) {
  if (!transcriptPath || !fs.existsSync(transcriptPath)) return '';
  const lines = fs.readFileSync(transcriptPath, 'utf8').split('\n').filter(Boolean);
  const texts = [];
  for (const line of lines) {
    try {
      const entry = JSON.parse(line);
      if (entry.type !== 'assistant' || !entry.message) continue;
      const c = entry.message.content;
      if (Array.isArray(c)) {
        for (const b of c) if (b.type === 'text' && b.text) texts.push(b.text);
      } else if (typeof c === 'string') {
        texts.push(c);
      }
    } catch {}
  }
  return texts.join('\n');
}

let input = '';
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input || '{}');
    const toolName = data.tool_name || '';
    if (toolName !== 'Edit' && toolName !== 'Write') process.exit(0);

    const filePath = data.tool_input && data.tool_input.file_path;
    if (!filePath) process.exit(0);

    const targetAbs = normalizePath(filePath);
    const repoRoot = process.cwd();
    const hit = PROTECTED.find(rel => normalizePath(path.join(repoRoot, rel)) === targetAbs);
    if (!hit) process.exit(0);

    const base = path.basename(hit);
    const ackRe = new RegExp('dnt-ack:\\s*' + base.replace('.', '\\.'), 'i');
    const haystack = readAssistantTexts(data.transcript_path);
    if (ackRe.test(haystack)) {
      console.error(`🔓 DNT: ${base} розблоковано у цій сесії (dnt-ack знайдено). Памʼятай ЧОМУ файл священний.`);
      process.exit(0);
    }

    console.error('\n=== 🔒 DO-NOT-TOUCH ЗАМОК (.claude/hooks/do-not-touch-guard.js) ===\n');
    console.error(
      `Файл ${hit} — священна корова (docs/DO_NOT_TOUCH.md): кожен рядок у ньому ` +
      'вирішує конкретну проблему (iOS Safari / порядок імпортів / cross-tab sync).\n\n' +
      'Що зробити ПЕРЕД зміною:\n' +
      `  1) Read docs/DO_NOT_TOUCH.md — знайди секцію про ${base}, зрозумій ЩО саме там не можна ламати.\n` +
      '  2) Переконайся що твоя зміна НЕ зачіпає описані механізми (або що Роман явно попросив саме це).\n' +
      `  3) Напиши у відповіді фразу «dnt-ack: ${base}» і повтори Edit — файл розблокується до кінця сесії.`
    );
    console.error('\n=== Прочитай DO_NOT_TOUCH.md і повтори. ===\n');
    process.exit(2);
  } catch {
    process.exit(0); // fail-open
  }
});
