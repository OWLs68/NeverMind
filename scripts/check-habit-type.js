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
  const { inferHabitType } = mod;

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
