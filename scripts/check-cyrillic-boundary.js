#!/usr/bin/env node
// scripts/check-cyrillic-boundary.js
//
// PRE-FLIGHT сторож проти класу бага «\b + кирилиця» (gfrvu5: вартовий «момент»,
// дні тижня, push-замок — усі мовчки мертві бо у JS \b рахує межу лише по
// латиниці). Падає якщо у src/*.js знайдено \b впритул до кириличної літери
// у КОДІ (рядки-коментарі пропускаємо — там це легітимні згадки/пояснення).
//
// Правильна межа для кирилиці: lookbehind/ahead (?<![а-яіїєґ])X(?![а-яіїєґ])
// або патерн (?:^|[\s,.:;])X — як у src/data/intent-router.js.

const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'src');
const CYR = 'а-яіїєґА-ЯІЇЄҐ';
const RE_AFTER = new RegExp('\\\\b[' + CYR + ']');   // \b притул до кирилиці
const RE_BEFORE = new RegExp('[' + CYR + ']\\\\b');  // кирилиця притул до \b

function walk(dir, out) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (name.endsWith('.js')) out.push(full);
  }
  return out;
}

const hits = [];
for (const file of walk(SRC, [])) {
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    // Беремо лише КОД до коментаря // (відкидаємо пояснення з \b).
    const code = line.split('//')[0];
    if (RE_AFTER.test(code) || RE_BEFORE.test(code)) {
      hits.push(`${path.relative(path.join(__dirname, '..'), file)}:${i + 1}: ${line.trim().slice(0, 90)}`);
    }
  });
}

if (hits.length > 0) {
  console.error(`\n=== ❌ CYRILLIC-BOUNDARY СТОРОЖ: ${hits.length} знахідок \\b+кирилиця у коді ===\n`);
  console.error(hits.join('\n'));
  console.error('\nУ JS \\b не працює з кирилицею → регекс мовчки не матчить. Заміни на');
  console.error('(?<![а-яіїєґ])X(?![а-яіїєґ]) або (?:^|[\\s,.:;])X. НЕ пушити без фіксу.\n');
  process.exit(1);
}
console.log('✅ cyrillic-boundary сторож: \\b+кирилиця у коді не знайдено');
process.exit(0);
