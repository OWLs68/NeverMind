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
  const {
    convertTaskToEventOnTime,
    dropEventOnMomentKeyword,
    convertPastEventToMoment,
    convertNoteToFinance,
    dropTaskOnFinance,
    dropTaskOnComplete,
    dropEventOnMoment,
    dropTaskOnList,
    applyAllGuards,
  } = g;

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

  // --- dropEventOnMomentKeyword: слово «момент» → геть create_event ---
  const k1 = dropEventOnMomentKeyword([tc('create_event', { title: 'Х' })], 'запиши момент про каву');
  ck('«момент» + create_event → видалено', !k1.some(t => t.function.name === 'create_event'));
  const k2 = dropEventOnMomentKeyword([tc('create_event', { title: 'Х' })], 'зустріч завтра');
  ck('без «момент» → create_event лишається', nameOf(k2, 0) === 'create_event');

  // --- convertPastEventToMoment: минулий час + create_event → save_moment ---
  const p1 = convertPastEventToMoment([tc('create_event', { title: 'Жарили мʼясо' })], 'вчора жарили мʼясо');
  ck('минулий час + event → save_moment', nameOf(p1, 0) === 'save_moment');
  ck('конверсія moment: text збережений', argsOf(p1, 0).text === 'Жарили мʼясо');
  const p2 = convertPastEventToMoment([tc('create_event', { title: 'Х' }), tc('save_moment', { text: 'y' })], 'вчора гуляли');
  ck('вже є save_moment → event не чіпаємо', nameOf(p2, 0) === 'create_event');
  const p3 = convertPastEventToMoment([tc('create_event', { title: 'Х' })], 'зустріч завтра о 10');
  ck('майбутнє → event лишається', nameOf(p3, 0) === 'create_event');

  // --- convertNoteToFinance: сума+валюта + note/moment → save_finance ---
  const f1 = convertNoteToFinance([tc('save_note', { content: 'хліб' })], 'купив хліб 3 євро');
  ck('гроші + save_note → save_finance', nameOf(f1, 0) === 'save_finance');
  ck('конверсія finance: amount=3', argsOf(f1, 0).amount === 3);
  const f2 = convertNoteToFinance([tc('save_note', { content: 'x' }), tc('save_finance', { amount: 5 })], 'кава 5 грн');
  ck('вже є save_finance → note не чіпаємо', nameOf(f2, 0) === 'save_note');
  const f3 = convertNoteToFinance([tc('save_note', { content: 'думка' })], 'просто думка без грошей');
  ck('без грошей → save_note лишається', nameOf(f3, 0) === 'save_note');

  // --- dropTaskOnFinance / dropTaskOnComplete / dropEventOnMoment (dedupe) ---
  const d1 = dropTaskOnFinance([tc('save_finance', { amount: 50 }), tc('save_task', { title: 'мийка' })]);
  ck('finance+task → лишається тільки finance', d1.length === 1 && nameOf(d1, 0) === 'save_finance');
  const d1b = dropTaskOnFinance([tc('save_task', { title: 'x' })]);
  ck('лише task → не чіпаємо', nameOf(d1b, 0) === 'save_task');
  const d2 = dropTaskOnComplete([tc('complete_task', { title: 'мʼясо' }), tc('save_task', { title: 'хліб' })]);
  ck('complete+task → лишається complete', d2.length === 1 && nameOf(d2, 0) === 'complete_task');
  const d3 = dropEventOnMoment([tc('save_moment', { text: 'жарили' }), tc('create_event', { title: 'x' })]);
  ck('moment+event → лишається moment', d3.length === 1 && nameOf(d3, 0) === 'save_moment');

  // --- dropTaskOnList: список ≠ задача (vдимога Романа) ---
  const dl1 = dropTaskOnList([tc('save_list', { title: 'Покупки' }), tc('save_task', { title: 'купити' })], 'склади список покупок: молоко, хліб');
  ck('list+task batch → лишається list', dl1.length === 1 && nameOf(dl1, 0) === 'save_list');
  const dl2 = dropTaskOnList([tc('save_task', { title: 'Список покупок' })], 'склади список покупок: молоко, хліб, яйця');
  ck('лише task + текст=список → конверт у save_list', nameOf(dl2, 0) === 'save_list');
  ck('конверт: items з детектора (3)', Array.isArray(argsOf(dl2, 0).items) && argsOf(dl2, 0).items.length === 3);
  const dl3 = dropTaskOnList([tc('save_task', { title: 'Купити хліб' })], 'купити хліб');
  ck('звичайна задача (не список) → лишається save_task', nameOf(dl3, 0) === 'save_task');

  // --- applyAllGuards: порядок (один guard готує стан для наступного) ---
  const a1 = applyAllGuards([tc('save_note', { content: 'хліб' }), tc('save_task', { title: 'хліб' })], 'купив хліб 3 євро');
  ck('ланцюг: note→finance, далі task дропнуто', a1.length === 1 && nameOf(a1, 0) === 'save_finance');
  const a3 = applyAllGuards([tc('save_task', { title: 'Список' })], 'склади список покупок: молоко, хліб, яйця');
  ck('ланцюг: текст=список → save_list (не задача)', a3.length === 1 && nameOf(a3, 0) === 'save_list');
  const a2 = applyAllGuards([tc('create_event', { title: 'Жарили' })], 'вчора жарили мʼясо');
  ck('ланцюг: past event→moment, дубль-event чисто', a2.length === 1 && nameOf(a2, 0) === 'save_moment');

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
