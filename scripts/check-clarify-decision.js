#!/usr/bin/env node
// scripts/check-clarify-decision.js
//
// Контракт-тест чистої логіки clarify (src/data/clarify-decision.js) —
// закриває борг v3pexs: bareNoun-рішення діє у 7 чатах, але clarify-guard.js
// не запускається у node (browser-імпорти) → реального тесту НЕ було,
// регрес пройшов би тихо (була лише разова емуляція). Тепер — справжній
// сторож на pure-модулі. Pure ESM → import напряму.
//
// Створено: 28.06.2026 v3pexs (автономний блок Fable 5, батч A).

const path = require('path');
const { pathToFileURL } = require('url');

const tc = (name) => ({ function: { name } });

(async () => {
  const mod = await import(pathToFileURL(path.join(__dirname, '..', 'src', 'data', 'clarify-decision.js')).href);
  const { decideClarify, GREETING_STOPLIST, SUSPICIOUS_TOOLS } = mod;

  let passed = 0;
  const failures = [];
  const ck = (label, cond) => { if (cond) passed++; else failures.push('✗ ' + label); };

  // === NO-TOOL режим (AI відповів текстом) — ядро бага який закривали ===
  const d1 = decideClarify('Хімчистка', []);
  ck('«Хімчистка» без tool → чіпи', d1 !== null && d1.bareNoun === 'Хімчистка');
  ck('«Хімчистка» → businessNoun (проект-чіп)', d1 && typeof d1.businessNoun === 'string');
  const d2 = decideClarify('Кафе', []);
  ck('«Кафе» без tool → чіпи', d2 !== null);
  ck('«Кафе» → БЕЗ businessNoun', d2 && d2.businessNoun === null);
  ck('«Олег» (імʼя) → чіпи', decideClarify('Олег', []) !== null);
  ck('trim: «  Дощ  » → чіпи', decideClarify('  Дощ  ', []) !== null && decideClarify('  Дощ  ', []).bareNoun === 'Дощ');

  // === Стоп-лист привітань (false-positive клас ~30-40% реплік) ===
  for (const w of ['Дякую', 'Так', 'Ні', 'Окей', 'привіт', 'Добре', 'Ага']) {
    ck(`«${w}» → null (стоп-лист)`, decideClarify(w, []) === null);
  }
  ck('стоп-лист непорожній і має «так»', GREETING_STOPLIST.has('так'));

  // === Команди/числа/фрази → null ===
  ck('«Купити молоко» (команда) → null', decideClarify('Купити молоко', []) === null);
  ck('«запиши думку» (команда) → null', decideClarify('запиши думку', []) === null);
  ck('«Хімчистка 2026» (число) → null', decideClarify('Хімчистка 2026', []) === null);
  ck('«200» (число) → null', decideClarify('200', []) === null);
  ck('два слова «гарний день» → null', decideClarify('гарний день', []) === null);
  ck('латиниця «Test» → null (не кирилиця)', decideClarify('Test', []) === null);

  // === TOOL-режим: втручання лише на SUSPICIOUS ===
  ck('bareNoun + suspicious save_note → чіпи',
     decideClarify('Хімчистка', [tc('save_note')]) !== null);
  ck('bareNoun + suspicious create_project → чіпи',
     decideClarify('Автомийка', [tc('create_project')]) !== null);
  ck('bareNoun + НЕсуspicious switch_tab → null (не наша справа)',
     decideClarify('Хімчистка', [tc('switch_tab')]) === null);
  ck('bareNoun + save_list (не suspicious) → null',
     decideClarify('Хімчистка', [tc('save_list')]) === null);
  ck('SUSPICIOUS_TOOLS містить save_task', SUSPICIOUS_TOOLS.has('save_task'));

  // === Невалідний ввід ===
  ck('null text → null', decideClarify(null, []) === null);
  ck('порожній text → null', decideClarify('   ', []) === null);
  ck('toolCalls не масив → null', decideClarify('Хімчистка', null) === null);

  if (failures.length > 0) {
    console.error(`\n=== ❌ CLARIFY-DECISION СТОРОЖ: ${failures.length} провалів (${passed} ок) ===\n`);
    console.error(failures.join('\n'));
    console.error('\nЛогіка рішення clarify (src/data/clarify-decision.js) змінила поведінку.\nЦе діє у 7 чатах (bareNoun-чіпи) — НЕ пушити без фіксу.\n');
    process.exit(1);
  }
  console.log(`✅ clarify-decision сторож: ${passed}/${passed} тестів (bareNoun + стоп-лист + tool-режими)`);
  process.exit(0);
})().catch(e => {
  console.error('clarify-decision сторож впав з винятком:', e.message);
  process.exit(1);
});
