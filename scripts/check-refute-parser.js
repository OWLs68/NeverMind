#!/usr/bin/env node
// scripts/check-refute-parser.js — контракт-тест парсера фактчекера (P1, ADR-005).
//
// Сценарій з погодженого плану: 3 знахідки (правдива / прямо спростовна / неперевірна)
// → відсіяна РІВНО спростовна. Плюс перевірка FAIL-OPEN на всіх формах збою.
// Це тест ПАРСЕРА (детермінований). Сам LLM-протокол — недетермінований, тому
// «3 синтетичні знахідки» тут = фіксовані ID у відповіді, не живий виклик.

const { applyRefutation, extractIdArray } = require('./lib/refute-parser.js');
let failures = 0;
function check(name, ok, extra) {
  console.log(`${ok ? '✓' : '✗'} ${name}${extra ? ' — ' + extra : ''}`);
  if (!ok) failures++;
}

const findings = [
  { id: 'c-0', title: 'правдива' },
  { id: 'c-1', title: 'прямо спростовна diff-ом' },
  { id: 'c-2', title: 'неперевірна (context поза diff)' },
];

// 1. Фактчекер спростував рівно c-1 → лишились c-0 і c-2
let r = applyRefutation(findings, '```json\n["c-1"]\n```');
check('1. відсіяно рівно спростовну c-1', !r.failOpen && r.kept.length === 2 && r.kept.every(f => f.id !== 'c-1') && r.refutedIds.join() === 'c-1');

// 2. Порожній масив (нічого не спростовано) → всі живі
r = applyRefutation(findings, '[]');
check('2. порожній масив → всі 3 живі', !r.failOpen && r.kept.length === 3);

// 3. Голий масив без code-fence
r = applyRefutation(findings, '["c-0","c-2"]');
check('3. голий масив без fence → лишилась c-1', !r.failOpen && r.kept.length === 1 && r.kept[0].id === 'c-1');

// 4. FAIL-OPEN: битий JSON → всі живі
r = applyRefutation(findings, 'спростовано: c-1, c-2 (без валідного JSON)');
check('4. fail-open на битому JSON → всі 3 живі', r.failOpen && r.kept.length === 3);

// 5. FAIL-OPEN: невідомий ID у відповіді → недовіра, всі живі
r = applyRefutation(findings, '["c-1","c-99"]');
check('5. fail-open на невідомому ID → всі 3 живі', r.failOpen && r.kept.length === 3);

// 6. FAIL-OPEN: не масив рядків (масив чисел)
r = applyRefutation(findings, '[0,1]');
check('6. fail-open на масиві чисел → всі 3 живі', r.failOpen && r.kept.length === 3);

// 7. FAIL-OPEN: порожня/undefined відповідь
r = applyRefutation(findings, '');
check('7. fail-open на порожній відповіді', r.failOpen && r.kept.length === 3);

// 8. extractIdArray з зайвим текстом навколо fence
check('8. extract з тексту навколо json-fence', JSON.stringify(extractIdArray('Ось результат:\n```json\n["c-0"]\n```\nвсе')) === '["c-0"]');

if (failures) { console.error(`\n✗ check-refute-parser: ${failures} провал(ів)`); process.exit(1); }
console.log('\n✓ check-refute-parser: 8/8');
