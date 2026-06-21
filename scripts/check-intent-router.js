#!/usr/bin/env node
// scripts/check-intent-router.js
//
// Контракт-тест детермінованого парсера parseExplicitIntent (src/data/intent-router.js).
// Це «мислення» fast-path: явні команди юзера → готова tool_call БЕЗ OpenAI
// (правило 12 CLAUDE.md). Тестуємо що (а) розпорядок/нагадування розпізнаються
// правильно, (б) bail-кейси повертають null (одноразова дата, без часу, мульти-час)
// — щоб AI отримав свій шанс. Pure ESM-модуль → import напряму, без моку.
//
// Створено: 20.06.2026 gfrvu5 (перший потік /byyou — контракт-тести).

const path = require('path');
const { pathToFileURL } = require('url');

(async () => {
  const mod = await import(pathToFileURL(path.join(__dirname, '..', 'src', 'data', 'intent-router.js')).href);
  const { parseExplicitIntent } = mod;

  let passed = 0;
  const failures = [];
  const ck = (label, cond) => { if (cond) passed++; else failures.push('✗ ' + label); };

  // === save_routine: явна команда розпорядку ===
  const r1 = parseExplicitIntent('додай в розпорядок біг у понеділок о 7:00');
  ck('розпорядок: tool=save_routine', r1 && r1.tool === 'save_routine');
  ck('розпорядок: день=mon', r1 && Array.isArray(r1.args.day) && r1.args.day.includes('mon'));
  ck('розпорядок: час 07:00', r1 && r1.args.blocks[0].time === '07:00');
  ck('розпорядок: activity=Біг (capitalize)', r1 && r1.args.blocks[0].activity === 'Біг');

  const r2 = parseExplicitIntent('додай в розпорядок зарядка щодня о 7:00');
  ck('розпорядок: «щодня» → 7 днів', r2 && r2.args.day.length === 7);

  // === set_reminder: явна команда нагадування ===
  const m1 = parseExplicitIntent('нагадай купити квитки завтра о 18:00');
  ck('нагадування: tool=set_reminder', m1 && m1.tool === 'set_reminder');
  ck('нагадування: час 18:00', m1 && m1.args.time === '18:00');
  ck('нагадування: text=Купити квитки', m1 && m1.args.text === 'Купити квитки');
  ck('нагадування: дата ISO (завтра)', m1 && /^\d{4}-\d{2}-\d{2}$/.test(m1.args.date || ''));

  const m2 = parseExplicitIntent('нагадай подзвонити мамі о 9 ранку');
  ck('нагадування: «о 9 ранку» → 09:00', m2 && m2.args.time === '09:00');

  // === BAIL-кейси (повертають null → AI вирішує) ===
  ck('одноразова дата «завтра» без «щотижня» → null (AI зробить event)',
     parseExplicitIntent('додай в розпорядок зустріч завтра о 8:00') === null);
  ck('розпорядок без часу → null',
     parseExplicitIntent('додай в розпорядок біг у понеділок') === null);
  ck('мульти-час (2 блоки) → null',
     parseExplicitIntent('додай в розпорядок біг о 7:00 і йога о 8:00') === null);
  ck('нагадування без часу → null',
     parseExplicitIntent('нагадай купити хліб') === null);
  ck('звичайний текст → null', parseExplicitIntent('купити молоко') === null);
  ck('порожнє → null', parseExplicitIntent('') === null);
  ck('не-рядок → null', parseExplicitIntent(null) === null);

  if (failures.length > 0) {
    console.error(`\n=== ❌ INTENT-ROUTER СТОРОЖ: ${failures.length} провалів (${passed} ок) ===\n`);
    console.error(failures.join('\n'));
    console.error('\nПарсер parseExplicitIntent (src/data/intent-router.js) змінив поведінку.\nНЕ пушити без фіксу.\n');
    process.exit(1);
  }
  console.log(`✅ intent-router сторож: ${passed}/${passed} тестів (розпорядок + нагадування + bail)`);
  process.exit(0);
})().catch(e => {
  console.error('intent-router сторож впав з винятком:', e.message);
  process.exit(1);
});
