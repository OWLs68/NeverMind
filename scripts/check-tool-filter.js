#!/usr/bin/env node
// scripts/check-tool-filter.js
//
// Контракт-сторож фільтра інструментів (selectRelevantTools, src/data/tool-filter.js).
// Стереже від рецидиву бага \b-кирилиця (v3pexs): класифікатор мав /\b(кирилиця)/
// → мертвий на укр-тексті → фільтр мовчки слав повний набір щоразу (економія
// токенів = 0). Перевіряємо: (1) кожна категорія МАТЧИТЬ свою укр-фразу; (2) base
// tools завжди у наборі; (3) 0-матч і >4-матч → повний fallback; (4) увімкнення
// фільтра не «зʼїдає» інструмент нижче sanity-порогу.

const path = require('path');
const { pathToFileURL } = require('url');

const tc = (name) => ({ function: { name } });

(async () => {
  const m = await import(pathToFileURL(path.join(__dirname, '..', 'src', 'data', 'tool-filter.js')).href);
  const { selectRelevantTools, TOOL_CATEGORIES, BASE_TOOL_NAMES } = m;

  let passed = 0;
  const failures = [];
  const ck = (label, cond) => { if (cond) passed++; else failures.push('✗ ' + label); };

  // Повний набір tools = усі base + усі категорійні (без дублів) + декілька зайвих.
  const allNames = new Set([...BASE_TOOL_NAMES]);
  for (const cat of Object.values(TOOL_CATEGORIES)) cat.tools.forEach(n => allNames.add(n));
  const fullTools = [...allNames].map(tc);

  // (1) Кожна категорія матчить репрезентативну укр-фразу (інакше \b-регресія).
  const phrases = {
    finance: 'витратив 200 на каву',
    habit: 'додай звичку біг щодня',
    task: 'треба зробити презентацію',
    event: 'зустріч завтра о 10',
    note: 'запиши думку в нотатки',
    project: 'новий проект ремонт квартири',
    moment: 'щойно поїхав на роботу',
    routine: 'мій розпорядок дня',
    trash: 'поверни видалене з кошика',
    memory: 'запамʼятай що я люблю каву',
    ui: 'відкрий фінанси',
  };
  for (const [key, phrase] of Object.entries(phrases)) {
    ck(`категорія «${key}» матчить «${phrase}»`, TOOL_CATEGORIES[key].rx.test(phrase.toLowerCase()));
  }
  ck('усі 11 категорій присутні', Object.keys(TOOL_CATEGORIES).length === 11);

  // (2) Чіткий single-category запит → фільтрує, АЛЕ base tools завжди в наборі.
  const fin = selectRelevantTools('витратив 200 на каву', fullTools);
  const finNames = new Set(fin.map(t => t.function.name));
  ck('finance-запит фільтрує (менше за повний)', fin.length < fullTools.length);
  ck('finance-запит лишає save_finance', finNames.has('save_finance'));
  ck('base tools завжди є (save_task попри finance-запит)', finNames.has('save_task'));
  ck('base tools завжди є (switch_tab)', finNames.has('switch_tab'));
  ck('усі 8 base tools у наборі', [...BASE_TOOL_NAMES].every(n => finNames.has(n)));

  // (3) Немає матчу → повний fallback (не урізаємо наосліп).
  const none = selectRelevantTools('абракадабра щось незрозуміле', fullTools);
  ck('0-матч → повний набір (fallback)', none.length === fullTools.length);

  // (3б) Забагато категорій (>4, амбівалентно) → повний fallback.
  const many = selectRelevantTools('витратив 200 зустріч завтра звичка нотатка проект розпорядок', fullTools);
  ck('>4 матчі → повний набір (fallback)', many.length === fullTools.length);

  // (4) Невалідний ввід → повертає як є (без падіння).
  ck('null text → повертає fullTools', selectRelevantTools(null, fullTools) === fullTools);
  ck('не-масив tools → повертає як є', selectRelevantTools('текст', null) === null);

  if (failures.length > 0) {
    console.error(`\n=== ❌ TOOL-FILTER СТОРОЖ: ${failures.length} провалів (${passed} ок) ===\n`);
    console.error(failures.join('\n'));
    console.error('\nФільтр інструментів зламано. Найімовірніше — \\b-кирилиця у tool-filter.js');
    console.error('(категорія не матчить укр-фразу) → економія токенів мертва. НЕ пушити.\n');
    process.exit(1);
  }
  console.log(`✅ tool-filter сторож: ${passed} перевірок ок (11 категорій живі, base tools + fallback)`);
  process.exit(0);
})();
