#!/usr/bin/env node
// scripts/check-context-guard.js — контракт-тест сторожа контексту /byyou (P4-2).
//
// ЧІПАЄМО РОБОЧИЙ СТОРОЖ → тест обовʼязковий. Перевіряє через синтетичний
// транскрипт (підроблений assistant.usage) що:
//   1. Статус НЕ active → сторож мовчить (exit 0), незалежно від %.
//   2. active + <60% → exit 0, БЕЗ попереджень, прапорець прибрано.
//   3. active + 60-74% → exit 0 (не блокує) + мʼяке попередження ОДИН раз.
//   4. active + 60-74% вдруге → тихо (прапорець тримає, без спаму).
//   5. active + ≥75% → exit 2 (жорсткий блок) + текст «ПОРА ЗУПИНИТИ».
//   6. після падіння <60 → прапорець скинуто (наступний потік знову попередить).
// Створено: 26yz5s 04.07.2026.

const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const HOOK = path.join(ROOT, '.claude', 'hooks', 'byyou-context-guard.sh');
const PLAN = path.join(ROOT, '_ai-tools', 'BYYOU_PLAN.md');
const FLAG = path.join(ROOT, '.claude', 'hooks', '.byyou-handoff-warned');
let failures = 0;
function check(name, ok, extra) {
  console.log(`${ok ? '✓' : '✗'} ${name}${extra ? ' — ' + extra : ''}`);
  if (!ok) failures++;
}

// Синтетичний транскрипт: один assistant turn із заданими токенами (percent = tokens/1M*100).
function makeTranscript(tokens) {
  const f = path.join(os.tmpdir(), `ctxguard-${process.pid}-${tokens}.jsonl`);
  const line = JSON.stringify({ type: 'assistant', message: { role: 'assistant', usage: { input_tokens: tokens } } });
  fs.writeFileSync(f, line + '\n');
  return f;
}
function runHook(transcript) {
  return spawnSync('bash', [HOOK], {
    input: JSON.stringify({ transcript_path: transcript }),
    encoding: 'utf8', cwd: ROOT,
  });
}

// Зберегти реальний стан плану/прапорця, підмінити на час тесту.
const planBackup = fs.existsSync(PLAN) ? fs.readFileSync(PLAN, 'utf8') : null;
const flagExisted = fs.existsSync(FLAG);
if (flagExisted) fs.unlinkSync(FLAG);

function setStatus(active) {
  const body = `**Статус:** ${active ? 'active' : 'done'}\n`;
  fs.writeFileSync(PLAN, body);
}

try {
  const t50 = makeTranscript(500000);   // 50%
  const t65 = makeTranscript(650000);   // 65%
  const t80 = makeTranscript(800000);   // 80%

  // 1. НЕ active → мовчить навіть на 80%
  setStatus(false);
  let r = runHook(t80);
  check('1. не-active → exit 0, тиша', r.status === 0 && !/ЗУПИНИТИ|наближається/.test(r.stderr));

  // 2. active + 50% → exit 0, без попереджень, без прапорця
  setStatus(true);
  if (fs.existsSync(FLAG)) fs.unlinkSync(FLAG);
  r = runHook(t50);
  check('2. active 50% → тиша, прапорця нема', r.status === 0 && !/наближається/.test(r.stderr) && !fs.existsSync(FLAG));

  // 3. active + 65% → exit 0 + мʼяке попередження один раз + прапорець зʼявився
  r = runHook(t65);
  check('3. active 65% → exit 0 + мʼяке попередження + прапорець', r.status === 0 && /наближається/.test(r.stderr) && fs.existsSync(FLAG));

  // 4. active + 65% вдруге → тихо (прапорець тримає)
  r = runHook(t65);
  check('4. active 65% вдруге → тиша (без спаму)', r.status === 0 && !/наближається/.test(r.stderr));

  // 5. active + 80% → exit 2 + жорсткий текст
  r = runHook(t80);
  check('5. active 80% → exit 2 + «ПОРА ЗУПИНИТИ»', r.status === 2 && /ПОРА ЗУПИНИТИ/.test(r.stderr));

  // 6. падіння до 50% → прапорець скинуто
  r = runHook(t50);
  check('6. падіння до 50% → прапорець скинуто', r.status === 0 && !fs.existsSync(FLAG));

  [t50, t65, t80].forEach(f => { try { fs.unlinkSync(f); } catch {} });
} finally {
  // Відновити реальний стан.
  if (planBackup !== null) fs.writeFileSync(PLAN, planBackup); else if (fs.existsSync(PLAN)) fs.unlinkSync(PLAN);
  if (fs.existsSync(FLAG)) fs.unlinkSync(FLAG);
}

if (failures) { console.error(`\n✗ check-context-guard: ${failures} провал(ів)`); process.exit(1); }
console.log('\n✓ check-context-guard: 6/6');
