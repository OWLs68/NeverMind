#!/usr/bin/env node
// scripts/check-habit-type.js
//
// Юніт-сторож детермінованої класифікації типу звички (CLAUDE.md правило 12).
// Баг 7uxlr7: «Створи звичку кинути курити» → build замість quit-челенджу
// (save_habit tool не має параметра type, AI-звички завжди build). Гард
// inferHabitType(name) у 4 точках створення з AI. Цей тест замикає набір слів
// щоб quit-розпізнавання не зламалось і не з'явились хибні спрацювання.
//
// habit-classifier.js — чистий data-модуль (без браузер-globals) → import напряму.

const path = require('path');
const { pathToFileURL } = require('url');

(async () => {
  const mod = await import(pathToFileURL(path.join(__dirname, '..', 'src', 'data', 'habit-classifier.js')).href);
  const { inferHabitType, makeHabit } = mod;

  let passed = 0;
  const failures = [];
  const isQuit = (name) => {
    const r = inferHabitType(name);
    if (r === 'quit') passed++; else failures.push(`✗ "${name}" → очікував quit, отримав ${r}`);
  };
  const isBuild = (name) => {
    const r = inferHabitType(name);
    if (r === 'build') passed++; else failures.push(`✗ "${name}" → очікував build, отримав ${r}`);
  };

  // --- QUIT (челендж «тримаюсь») ---
  isQuit('Кинути курити');
  isQuit('кинути палити');
  isQuit('Кину пити');
  isQuit('покинути цукор');
  isQuit('бросити курить');
  isQuit('відмовитися від солодкого');
  isQuit('перестати їсти фастфуд');
  isQuit('позбутися звички гризти нігті');
  isQuit("зав'язати з алкоголем");
  isQuit('не курити');
  isQuit('не пити каву');
  isQuit('не вживати цукор');
  isQuit('менше курити');         // зменшувальна форма (аудит 7uxlr7)
  isQuit('менше пити');

  // --- BUILD (звичайна звичка з %) ---
  isBuild('Бігати');
  isBuild('Пити воду');           // НЕ "не пити" — це build
  isBuild('Скинути вагу');        // містить підрядок "кину" — НЕ має ловитись (startsWith по словах)
  isBuild('Читати книги');
  isBuild('Медитація щоранку');
  isBuild('Робити зарядку');
  isBuild('Вивчати англійську');
  isBuild('');                    // порожнє → build (без падіння)

  // --- makeHabit фабрика (єдине джерело форми звички) ---
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const ck = (label, cond) => { if (cond) passed++; else failures.push('✗ makeHabit: ' + label); };

  const h1 = makeHabit({ name: 'Кинути курити' });
  ck('id — валідний UUID (не Date.now)', UUID_RE.test(h1.id));
  ck('має конверт stampEntity (Ворота 3)', ['id', 'user_id', 'created_at', 'updated_at', 'deleted_at', 'hlc'].every(k => k in h1));
  ck('легасі createdAt поряд з конвертом', typeof h1.createdAt === 'number');
  ck('quit-назва → type quit', h1.type === 'quit');
  ck('quit → emoji 🚫', h1.emoji === '🚫');
  ck('default days = всі 7', Array.isArray(h1.days) && h1.days.length === 7);
  ck('default targetCount = 1', h1.targetCount === 1);
  ck('createdAt — число', typeof h1.createdAt === 'number');

  const h2 = makeHabit({ name: 'Бігати', days: [0, 2, 4], targetCount: 3 });
  ck('build-назва → type build', h2.type === 'build');
  ck('build → emoji ⭕', h2.emoji === '⭕');
  ck('передані days збережені', h2.days.join() === '0,2,4');
  ck('переданий targetCount збережений', h2.targetCount === 3);

  // явний type/emoji (ручна модалка) перекривають інференс
  const h3 = makeHabit({ name: 'Кинути палити', type: 'build', emoji: '🔥' });
  ck('явний type перекриває інференс', h3.type === 'build');
  ck('явний emoji перекриває дефолт', h3.emoji === '🔥');

  // два виклики → різні id (не колізія, на відміну від Date.now)
  ck('два makeHabit → різні id', makeHabit({ name: 'a' }).id !== makeHabit({ name: 'b' }).id);

  if (failures.length > 0) {
    console.error(`\n=== ❌ HABIT-TYPE СТОРОЖ: ${failures.length} провалів (${passed} ок) ===\n`);
    console.error(failures.join('\n'));
    console.error('\ninferHabitType у src/data/habit-classifier.js змінено — quit-класифікація зламана.\nЦе баг 7uxlr7 (кинути курити → build) — НЕ пушити без фіксу.\n');
    process.exit(1);
  }
  console.log(`✅ habit-type сторож: ${passed}/${passed} тестів (quit vs build класифікація)`);
  process.exit(0);
})().catch(e => {
  console.error('habit-type сторож впав з винятком:', e.message);
  process.exit(1);
});
