#!/usr/bin/env node
// scripts/check-list-detector.js
//
// Контракт-тест детермінованого парсера parseListIntent (src/data/list-detector.js).
// Списки-чеклісти (правило 12): «список + перелік ≥2» → save_list БЕЗ участі AI,
// щоб список НЕ протікав у Задачі (вимога Романа). Тестуємо: (а) розпізнавання
// списків з двокрапкою/нумерацією/рядками, (б) bail-кейси (1 пункт, без тригера,
// нагадування) → null щоб не over-trigger. Pure ESM → import напряму.
//
// Створено: 27.06.2026 v3pexs (потік /byyou — фіча списків в Inbox).

const path = require('path');
const { pathToFileURL } = require('url');

(async () => {
  const mod = await import(pathToFileURL(path.join(__dirname, '..', 'src', 'data', 'list-detector.js')).href);
  const { parseListIntent } = mod;

  let passed = 0;
  const failures = [];
  const ck = (label, cond) => { if (cond) passed++; else failures.push('✗ ' + label); };

  // === Позитив: список з двокрапкою + кома ===
  const l1 = parseListIntent('склади список покупок: молоко, хліб, яйця');
  ck('список покупок: tool=save_list', l1 && l1.tool === 'save_list');
  ck('список покупок: 3 пункти', l1 && Array.isArray(l1.args.items) && l1.args.items.length === 3);
  ck('список покупок: items — рядки', l1 && typeof l1.args.items[0] === 'string');
  ck('список покупок: пункт «молоко»', l1 && l1.args.items[0] === 'молоко');
  ck('список покупок: заголовок не порожній', l1 && l1.args.title && l1.args.title.length >= 2);

  // === Покупки-тригер «купити:» ===
  const l2 = parseListIntent('купити: хліб, масло');
  ck('купити: tool=save_list', l2 && l2.tool === 'save_list');
  ck('купити: 2 пункти', l2 && l2.args.items.length === 2);
  ck('купити: заголовок «Покупки»', l2 && l2.args.title === 'Покупки');

  // === Нумерований перелік через рядки ===
  const l3 = parseListIntent('список справ\n1. подзвонити\n2. оплатити\n3. прибрати');
  ck('нумерований: tool=save_list', l3 && l3.tool === 'save_list');
  ck('нумерований: 3 пункти', l3 && l3.args.items.length === 3);
  ck('нумерований: без номерів у тексті', l3 && !/^\d/.test(l3.args.items[0]));

  // === Маркований перелік «- » ===
  const l4 = parseListIntent('список: - яблука - банани - груші');
  ck('маркований «-»: ≥2 пункти', l4 && l4.args.items.length >= 2);

  // === BAIL-кейси (null → AI/звичайний шлях) ===
  ck('один пункт «список покупок: молоко» → null',
     parseListIntent('список покупок: молоко') === null);
  ck('без тригера «молоко, хліб, яйця» → null',
     parseListIntent('молоко, хліб, яйця') === null);
  ck('звичайна задача «купити молоко» → null',
     parseListIntent('купити молоко') === null);
  ck('нагадування зі словом список → null',
     parseListIntent('нагадай список справ о 18:00') === null);
  ck('список з часом-нагадуванням → null (reminder, не список)',
     parseListIntent('нагадай о 9 ранку список покупок: хліб, молоко') === null);
  ck('порожнє → null', parseListIntent('') === null);
  ck('не-рядок → null', parseListIntent(null) === null);

  if (failures.length > 0) {
    console.error(`\n=== ❌ LIST-DETECTOR СТОРОЖ: ${failures.length} провалів (${passed} ок) ===\n`);
    console.error(failures.join('\n'));
    console.error('\nПарсер parseListIntent (src/data/list-detector.js) змінив поведінку.\nНЕ пушити без фіксу.\n');
    process.exit(1);
  }
  console.log(`✅ list-detector сторож: ${passed}/${passed} тестів (списки + bail проти over-trigger)`);
  process.exit(0);
})().catch(e => {
  console.error('list-detector сторож впав з винятком:', e.message);
  process.exit(1);
});
