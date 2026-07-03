#!/usr/bin/env node
// scripts/check-dnt-guard.js — контракт-тест замка do-not-touch-guard.js.
//
// Ганяє хук як чорну скриньку (stdin JSON → exit code), як check-byyou-lock:
//   1. Edit у звичайний файл → ПРОПУСК (0).
//   2. Edit у src/core/boot.js без ack → БЛОК (2).
//   3. Write у src/app.js без ack → БЛОК (2).
//   4. Edit у boot.js З «dnt-ack: boot.js» у транскрипті → ПРОПУСК (0).
//   5. Битий stdin → ПРОПУСК (0, fail-open — хук не має ламати роботу).
// Створено: 26yz5s 03.07.2026 (потік /byyou «3 дірки + нововведення», ADR-004).

const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const HOOK = path.join(__dirname, '..', '.claude', 'hooks', 'do-not-touch-guard.js');
let failures = 0;

function run(name, stdinObj, expectedExit, rawStdin) {
  const input = rawStdin !== undefined ? rawStdin : JSON.stringify(stdinObj);
  const res = spawnSync('node', [HOOK], { input, encoding: 'utf8', cwd: path.join(__dirname, '..') });
  const ok = res.status === expectedExit;
  console.log(`${ok ? '✓' : '✗'} ${name} (exit ${res.status}, очікував ${expectedExit})`);
  if (!ok) { failures++; if (res.stderr) console.log('  stderr: ' + res.stderr.slice(0, 200)); }
}

// Тимчасовий транскрипт: без ack і з ack.
function makeTranscript(withAck) {
  const f = path.join(os.tmpdir(), 'dnt-test-' + process.pid + (withAck ? '-ack' : '') + '.jsonl');
  const lines = [
    JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: 'звичайна відповідь' }] } }),
  ];
  if (withAck) {
    lines.push(JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: 'Прочитав DO_NOT_TOUCH. dnt-ack: boot.js — зміна не чіпає setupSW.' }] } }));
  }
  fs.writeFileSync(f, lines.join('\n') + '\n');
  return f;
}

const tNoAck = makeTranscript(false);
const tAck = makeTranscript(true);

run('1. Edit звичайного файла → пропуск',
  { tool_name: 'Edit', tool_input: { file_path: 'src/tabs/tasks.js' }, transcript_path: tNoAck }, 0);

run('2. Edit boot.js без ack → блок',
  { tool_name: 'Edit', tool_input: { file_path: 'src/core/boot.js' }, transcript_path: tNoAck }, 2);

run('3. Write app.js без ack → блок',
  { tool_name: 'Write', tool_input: { file_path: 'src/app.js' }, transcript_path: tNoAck }, 2);

run('4. Edit boot.js з dnt-ack у транскрипті → пропуск',
  { tool_name: 'Edit', tool_input: { file_path: 'src/core/boot.js' }, transcript_path: tAck }, 0);

run('5. Битий stdin → fail-open пропуск', null, 0, '{{{не json');

fs.unlinkSync(tNoAck); fs.unlinkSync(tAck);

if (failures) { console.error(`\n✗ check-dnt-guard: ${failures} провал(ів)`); process.exit(1); }
console.log('\n✓ check-dnt-guard: 5/5');
