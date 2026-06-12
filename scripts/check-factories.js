#!/usr/bin/env node
// scripts/check-factories.js
//
// Юніт-сторож фабрик сутностей (src/data/entity-factories.js). Фабрики — єдине
// джерело форми запису + майбутні чокпойнти конверта stampEntity (Ворота 3).
// Замикає форму щоб консолідація не зламалась і поля лишались консистентними
// під Supabase-колонки. entity-factories.js — чистий модуль (uuid), import напряму.

const path = require('path');
const { pathToFileURL } = require('url');

(async () => {
  const mod = await import(pathToFileURL(path.join(__dirname, '..', 'src', 'data', 'entity-factories.js')).href);
  const { makeEvent, makeTask, makeMoment } = mod;

  let passed = 0;
  const failures = [];
  const ck = (label, cond) => { if (cond) passed++; else failures.push('✗ makeEvent: ' + label); };

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  const e1 = makeEvent({ title: 'Зустріч', date: '2026-06-20' });
  ck('id — валідний UUID', UUID_RE.test(e1.id));
  ck('title збережений', e1.title === 'Зустріч');
  ck('date збережений', e1.date === '2026-06-20');
  ck('time дефолт null', e1.time === null);
  ck('endTime дефолт null (нормалізація форми)', e1.endTime === null);
  ck('priority дефолт normal', e1.priority === 'normal');
  ck('createdAt — число', typeof e1.createdAt === 'number');
  ck('recurringId ВІДСУТНІЙ коли не заданий', !('recurringId' in e1));

  const e2 = makeEvent({ title: 'Майстер-клас', date: '2026-07-01', time: '14:00', endTime: '16:00', priority: 'important' });
  ck('time переданий', e2.time === '14:00');
  ck('endTime переданий', e2.endTime === '16:00');
  ck('priority переданий', e2.priority === 'important');

  const e3 = makeEvent({ title: 'Тренування', date: '2026-07-02', recurringId: 'rec-123' });
  ck('recurringId доданий коли заданий', e3.recurringId === 'rec-123');

  ck('два makeEvent → різні id', makeEvent({ title: 'a', date: 'x' }).id !== makeEvent({ title: 'b', date: 'y' }).id);

  // консистентна форма: усі базові поля присутні завжди
  ck('усі базові поля присутні', ['id', 'title', 'date', 'time', 'endTime', 'priority', 'createdAt'].every(k => k in e1));

  // --- makeTask ---
  const tk = (label, cond) => { if (cond) passed++; else failures.push('✗ makeTask: ' + label); };
  const t1 = makeTask({ title: 'Купити хліб' });
  tk('id — UUID', UUID_RE.test(t1.id));
  tk('title збережений', t1.title === 'Купити хліб');
  tk('desc дефолт пустий', t1.desc === '');
  tk('steps дефолт []', Array.isArray(t1.steps) && t1.steps.length === 0);
  tk('status active', t1.status === 'active');
  tk('createdAt число', typeof t1.createdAt === 'number');
  tk('dueDate ВІДСУТНІЙ коли не заданий', !('dueDate' in t1));
  tk('priority ВІДСУТНІЙ коли не заданий', !('priority' in t1));

  const t2 = makeTask({ title: 'Звіт', desc: 'до пятниці', steps: [{ id: 'x', text: 'крок', done: false }], dueDate: '2026-06-20', priority: 'important' });
  tk('desc переданий', t2.desc === 'до пятниці');
  tk('steps передані', t2.steps.length === 1);
  tk('dueDate доданий коли заданий', t2.dueDate === '2026-06-20');
  tk('priority доданий коли валідний', t2.priority === 'important');
  tk('priority normal приймається (уніфікація)', makeTask({ title: 'a', priority: 'normal' }).priority === 'normal');
  tk('priority невалідний — ВІДСУТНІЙ', !('priority' in makeTask({ title: 'a', priority: 'хто' })));

  // --- makeMoment ---
  const mk = (label, cond) => { if (cond) passed++; else failures.push('✗ makeMoment: ' + label); };
  const m1 = makeMoment({ text: 'Гарний ранок', mood: 'happy' });
  mk('id — UUID', UUID_RE.test(m1.id));
  mk('text збережений', m1.text === 'Гарний ранок');
  mk('mood збережений', m1.mood === 'happy');
  mk('ts число (не createdAt)', typeof m1.ts === 'number' && !('createdAt' in m1));
  mk('mood дефолт neutral', makeMoment({ text: 'x' }).mood === 'neutral');

  if (failures.length > 0) {
    console.error(`\n=== ❌ FACTORIES СТОРОЖ: ${failures.length} провалів (${passed} ок) ===\n`);
    console.error(failures.join('\n'));
    console.error('\nmakeEvent у src/data/entity-factories.js змінено — форма події зламана.\nЦе чокпойнт під Supabase-конверт — НЕ пушити без фіксу.\n');
    process.exit(1);
  }
  console.log(`✅ factories сторож: ${passed}/${passed} тестів (makeEvent форма)`);
  process.exit(0);
})().catch(e => {
  console.error('factories сторож впав з винятком:', e.message);
  process.exit(1);
});
