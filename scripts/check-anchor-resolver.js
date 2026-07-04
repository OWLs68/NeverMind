#!/usr/bin/env node
// scripts/check-anchor-resolver.js — контракт-тест резолвера якорів (P2, ADR-005).
//
// Детермінований, 10 кейсів: збіг у новій стороні diff, у старій, ковзним вікном
// по файлу, кирилиця (клас \b неможливий), пропуск порожніх рядків, не-знайдено,
// порожній вхід, багаторядковий сніпет, нормалізація +/-, вибір нової сторони над старою.
// Створено: 26yz5s 04.07.2026.

const { resolveAnchor, normalizeLine, splitAndNormalize } = require('./resolve-anchor.js');
let failures = 0;
function check(name, ok, extra) {
  console.log(`${ok ? '✓' : '✗'} ${name}${extra ? ' — ' + extra : ''}`);
  if (!ok) failures++;
}

// Синтетичний diff: додано рядок 'const y = 2;' після 'const x = 1;'
const diff1 = [
  '@@ -1,2 +1,3 @@',
  ' const x = 1;',
  '+const y = 2;',
  ' const z = 3;',
].join('\n');

// 1. Збіг доданого рядка на новій стороні → новий номер
let r = resolveAnchor({ existingCode: 'const y = 2;', diff: diff1 });
check('1. added-рядок на новій стороні (line 2)', r && r.source === 'hunk-new' && r.startLine === 2, r && `${r.startLine}/${r.source}`);

// 2. Контекст-рядок присутній на обох сторонах — знаходиться на новій першою
r = resolveAnchor({ existingCode: 'const x = 1;', diff: diff1 });
check('2. context-рядок → нова сторона line 1', r && r.startLine === 1 && r.source === 'hunk-new');

// 3. Видалений рядок — тільки на старій стороні
const diff3 = ['@@ -1,2 +1,1 @@', ' keep();', '-removeMe();'].join('\n');
r = resolveAnchor({ existingCode: 'removeMe();', diff: diff3 });
check('3. deleted-рядок → стара сторона', r && r.source === 'hunk-old' && r.startLine === 2, r && `${r.startLine}/${r.source}`);

// 4. Кирилиця у сніпеті (клас \b неможливий — має просто знайтись)
const diff4 = ['@@ -1,1 +1,2 @@', ' let a = 1;', "+showToast('Привіт світе');"].join('\n');
r = resolveAnchor({ existingCode: "showToast('Привіт світе');", diff: diff4 });
check('4. кириличний сніпет знаходиться', r && r.startLine === 2, r && `${r.startLine}`);

// 5. Ковзне вікно по повному файлу (сніпету нема у diff-hunk)
const fileContent = 'line1\nline2\nfunction foo() {\n  return 42;\n}\nline6';
r = resolveAnchor({ existingCode: 'function foo() {\n  return 42;\n}', diff: '', newFileContent: fileContent });
check('5. багаторядковий збіг у файлі (line 3-5)', r && r.source === 'file' && r.startLine === 3 && r.endLine === 5, r && `${r.startLine}-${r.endLine}`);

// 6. Порожні рядки у файлі пропускаються (сусідні непорожні = послідовні)
const fileBlank = 'a();\n\n\nb();\nc();';
r = resolveAnchor({ existingCode: 'a();\nb();', diff: '', newFileContent: fileBlank });
check('6. порожні рядки пропущено (a→b поспіль)', r && r.startLine === 1 && r.endLine === 4, r && `${r.startLine}-${r.endLine}`);

// 7. Не знайдено → null (НЕ вгадувати)
r = resolveAnchor({ existingCode: 'nonexistent();', diff: diff1, newFileContent: fileContent });
check('7. не знайдено → null', r === null);

// 8. Порожній existing_code → null
r = resolveAnchor({ existingCode: '', diff: diff1 });
check('8. порожній сніпет → null', r === null);

// 9. Нормалізація зрізає +/- і пробіли
check('9. normalizeLine зрізає + і пробіли', normalizeLine('  +  const x = 1;  ') === 'const x = 1;', normalizeLine('  +  const x = 1;  '));

// 10. splitAndNormalize викидає порожні
check('10. splitAndNormalize без порожніх', JSON.stringify(splitAndNormalize('a;\n\n  \nb;')) === '["a;","b;"]');

if (failures) { console.error(`\n✗ check-anchor-resolver: ${failures} провал(ів)`); process.exit(1); }
console.log('\n✓ check-anchor-resolver: 10/10');
