#!/usr/bin/env node
// scripts/check-byyou-lock.js
//
// Контракт-тест push-замку /byyou (.claude/hooks/lib/byyou-release.js).
// «Хто стереже сторожів» — урок gfrvu5: замок мав баг \b-кирилиця і не пускав
// «Деплой», бо сам не був покритий тестом. Тепер покритий.

const path = require('path');
const { RELEASE_WORD, isReleaseApproved } = require(path.join(__dirname, '..', '.claude', 'hooks', 'lib', 'byyou-release.js'));

let passed = 0;
const failures = [];
const ck = (label, cond) => { if (cond) passed++; else failures.push('✗ ' + label); };

// --- РЕГРЕСІЯ \b-кирилиця: слово має матчитись українською ---
ck('«Деплой» (з великої) → match', RELEASE_WORD.test('Деплой'));
ck('«деплой» → match', RELEASE_WORD.test('деплой'));
ck('«задеплой зараз» → match', RELEASE_WORD.test('задеплой зараз'));
ck('«окей деплой» → match', RELEASE_WORD.test('окей деплой'));
ck('без слова → НЕ match', !RELEASE_WORD.test('зроби ще тест'));

// --- isReleaseApproved: слово АБО відкрите вікно ---
ck('слово «деплой», вікна нема → дозвол', isReleaseApproved('давай деплой', false) === true);
ck('нема слова, вікна нема → блок', isReleaseApproved('продовжуй', false) === false);
ck('нема слова, АЛЕ вікно відкрите → дозвол (self-correction)', isReleaseApproved('фікс CI', true) === true);
ck('порожній текст, вікна нема → блок', isReleaseApproved('', false) === false);
ck('null текст, вікна нема → блок', isReleaseApproved(null, false) === false);

if (failures.length > 0) {
  console.error(`\n=== ❌ BYYOU-LOCK СТОРОЖ: ${failures.length} провалів (${passed} ок) ===\n`);
  console.error(failures.join('\n'));
  console.error('\nPush-замок (.claude/hooks/lib/byyou-release.js) змінив поведінку. НЕ пушити без фіксу.\n');
  process.exit(1);
}
console.log(`✅ byyou-lock сторож: ${passed}/${passed} тестів (релізне слово + вікно self-correction)`);
process.exit(0);
