#!/usr/bin/env node
// scripts/check-guards.js
//
// Юніт-сторож гарда «час → подія» (7uxlr7 12.06). Задача з ЯВНИМ часом
// («подзвонити о 12:00») має ставати подією (потрапляє в Календар/Розпорядок),
// не задачею. Замикає: (1) детектор hasExplicitClockTime — щоб не ловив дати
// «15.05» і абстрактні «вранці»; (2) конверсію save_task→create_event з
// захистами (минулий час, кроки, вже-event). Обидва модулі pure (src/data) —
// import напряму.

const path = require('path');
const { pathToFileURL } = require('url');

const tc = (name, args) => ({ function: { name, arguments: JSON.stringify(args) } });
const nameOf = (arr, i) => arr[i].function.name;
const argsOf = (arr, i) => JSON.parse(arr[i].function.arguments);

(async () => {
  const tp = await import(pathToFileURL(path.join(__dirname, '..', 'src', 'data', 'ua-time-parser.js')).href);
  const g = await import(pathToFileURL(path.join(__dirname, '..', 'src', 'data', 'dispatcher-guards.js')).href);
  const { hasExplicitClockTime } = tp;
  const { convertTaskToEventOnTime } = g;

  let passed = 0;
  const failures = [];
  const ck = (label, cond) => { if (cond) passed++; else failures.push('✗ ' + label); };

  // --- hasExplicitClockTime: ЯВНИЙ час ---
  ck('«о 12:00» → явний час', hasExplicitClockTime('подзвонити о 12:00'));
  ck('«12:00» → явний час', hasExplicitClockTime('зустріч 12:00'));
  ck('«о 9 ранку» → явний час', hasExplicitClockTime('подзвонити о 9 ранку'));
  ck('«о 15» → явний час', hasExplicitClockTime('зустріч о 15'));
  // --- hasExplicitClockTime: НЕ час (пастки) ---
  ck('«15.05» (дата) → НЕ час', !hasExplicitClockTime('зустріч 15.05'));
  ck('«15-05» (дата) → НЕ час', !hasExplicitClockTime('подія 15-05'));
  ck('«вранці» (абстрактно) → НЕ час', !hasExplicitClockTime('подзвонити вранці'));
  ck('«ввечері» (абстрактно) → НЕ час', !hasExplicitClockTime('зайти ввечері'));
  ck('без часу → НЕ час', !hasExplicitClockTime('купити хліб'));
  ck('порожнє → НЕ час', !hasExplicitClockTime(''));

  // --- convertTaskToEventOnTime: конверсія ---
  const r1 = convertTaskToEventOnTime([tc('save_task', { title: 'Подзвонити на сервіс', due_date: '2026-06-13', priority: 'normal' })], 'подзвонити на сервіс завтра о 12:00');
  ck('save_task + явний час → create_event', nameOf(r1, 0) === 'create_event');
  ck('конверсія: title збережений', argsOf(r1, 0).title === 'Подзвонити на сервіс');
  ck('конверсія: date з due_date', argsOf(r1, 0).date === '2026-06-13');
  ck('конверсія: time спарсений (12:00)', argsOf(r1, 0).time === '12:00');

  // --- захисти (НЕ конвертувати) ---
  const r2 = convertTaskToEventOnTime([tc('save_task', { title: 'Купити хліб' })], 'купити хліб');
  ck('без часу → лишається save_task', nameOf(r2, 0) === 'save_task');

  const r3 = convertTaskToEventOnTime([tc('save_task', { title: 'Подзвонив', due_date: null })], 'вчора подзвонив о 12:00');
  ck('минулий час → лишається save_task', nameOf(r3, 0) === 'save_task');

  const r4 = convertTaskToEventOnTime([tc('save_task', { title: 'Підготувати звіт', steps: ['зібрати дані', 'написати'] })], 'підготувати звіт о 14:00');
  ck('задача з кроками → лишається save_task', nameOf(r4, 0) === 'save_task');

  const r5 = convertTaskToEventOnTime([tc('create_event', { title: 'Зустріч', date: '2026-06-13', time: '12:00' })], 'зустріч о 12:00');
  ck('AI вже зробив create_event → не чіпаємо', nameOf(r5, 0) === 'create_event');

  const r6 = convertTaskToEventOnTime([tc('save_moment', { text: 'гарно' })], 'гарно було о 12:00');
  ck('немає save_task → масив без змін', nameOf(r6, 0) === 'save_moment');

  if (failures.length > 0) {
    console.error(`\n=== ❌ GUARDS СТОРОЖ: ${failures.length} провалів (${passed} ок) ===\n`);
    console.error(failures.join('\n'));
    console.error('\nГард «час→подія» (dispatcher-guards.js) або детектор (ua-time-parser.js) зламано.\nНЕ пушити без фіксу.\n');
    process.exit(1);
  }
  console.log(`✅ guards сторож: ${passed}/${passed} тестів (час → подія)`);
  process.exit(0);
})().catch(e => {
  console.error('guards сторож впав з винятком:', e.message);
  process.exit(1);
});
