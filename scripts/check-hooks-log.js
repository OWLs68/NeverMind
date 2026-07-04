#!/usr/bin/env node
// scripts/check-hooks-log.js — контракт-тест журналу хук-подій (P6, ADR-005).
//
// Ганяє log-event.js як чорну скриньку:
//   1. Валідний payload → у лог додано 1 валідний JSON-рядок з event/tool.
//   2. Субагентний payload → рядок має subagent:true.
//   3. Битий stdin → exit 0 (fail-open) і процес не падає.
//   4. Довжелезний рядок у payload → обрізаний (…[cut]), лог лишається валідним JSONL.
// Створено: 26yz5s 04.07.2026.

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const HOOK = path.join(__dirname, '..', '.claude', 'hooks', 'log-event.js');
const LOG = path.join(__dirname, '..', '.claude', 'hooks', 'logs', 'hooks-log.jsonl');
let failures = 0;

function lines() {
  try { return fs.readFileSync(LOG, 'utf8').trim().split('\n').filter(Boolean); }
  catch { return []; }
}
function run(stdin) {
  return spawnSync('node', [HOOK], { input: stdin, encoding: 'utf8' });
}
function check(name, ok, extra) {
  console.log(`${ok ? '✓' : '✗'} ${name}${extra ? ' — ' + extra : ''}`);
  if (!ok) failures++;
}

const before = lines().length;

// 1. Валідний payload
let r = run(JSON.stringify({ hook_event_name: 'PreToolUse', tool_name: 'Edit', session_id: 's-test' }));
let all = lines();
let last = all.length ? JSON.parse(all[all.length - 1]) : {};
check('1. валідний payload → рядок додано', r.status === 0 && all.length === before + 1 && last.event === 'PreToolUse' && last.tool === 'Edit');

// 2. Субагентний payload
r = run(JSON.stringify({ hook_event_name: 'SubagentStart', agent_type: 'general-purpose' }));
all = lines();
last = JSON.parse(all[all.length - 1]);
check('2. субагент → subagent:true', r.status === 0 && last.subagent === true);

// 3. Битий stdin → fail-open
r = run('{{{не json');
check('3. битий stdin → exit 0', r.status === 0);

// 4. Довгий рядок ріжеться, JSONL валідний
r = run(JSON.stringify({ hook_event_name: 'PostToolUse', tool_input: { big: 'x'.repeat(10000) } }));
all = lines();
let parsedOk = true;
try { all.forEach(l => JSON.parse(l)); } catch { parsedOk = false; }
last = JSON.parse(all[all.length - 1]);
check('4. довгий payload обрізано, JSONL валідний', r.status === 0 && parsedOk && JSON.stringify(last).includes('[cut]'));

if (failures) { console.error(`\n✗ check-hooks-log: ${failures} провал(ів)`); process.exit(1); }
console.log('\n✓ check-hooks-log: 4/4');
