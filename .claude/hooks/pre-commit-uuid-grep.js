#!/usr/bin/env node
// .claude/hooks/pre-commit-uuid-grep.js
//
// PreToolUse hook (запускається ПЕРЕД git commit).
// Запускає 4 grep-перевірки з lessons.md UUID-чек-ліста для виявлення
// silent-fail патернів після UUID-міграції.
//
// КОРІНЬ ЧОМУ ПОТРІБЕН (lessons.md):
// myshu 11.05 + db0YY 12.05 + nliW8 13.05 — 3 сесії підряд після кожної
// UUID-міграції залишався пропущений onclick у новому файлі або render-функції.
// Симптом для юзера: тап на кнопку нічого не робить (галочка звички, тап
// картки, swipe-delete) → 26 SyntaxError у production логах v862.
//
// 4 перевірки (з lessons.md §UUID):
//   1. onclick template literal БЕЗ обгортки `'${id}'`
//   2. onclick string concat БЕЗ `\'+id+\'` обгортки
//   3. ontouchend string concat БЕЗ обгортки (для button з double handler)
//   4. parseInt/Number(...dataset.id...) — UUID → NaN
//
// (5-а перевірка — `id: { type: "integer" }` у prompts.js — у окремому хуці
// pre-commit-schema-check.js. Не дублюємо.)
//
// БЕЗ bypass — у юзера тап мовчки не реагує. Це не косметика.
//
// Створено: nliW8 13.05.2026.

const { execSync } = require('child_process');
const path = require('path');

let input = '';
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input || '{}');
    const command = (data.tool_input && data.tool_input.command) || '';

    if (!/\bgit\s+commit\b/.test(command)) process.exit(0);

    const repoRoot = path.join(__dirname, '..', '..');
    const findings = [];

    const checks = [
      {
        name: 'TEMPLATE_LITERAL_UNQUOTED',
        title: 'onclick="...(${obj.id})..." БЕЗ обгортки одинарними лапками',
        consequence: 'UUID починається з цифр + дефіси → SyntaxError "No identifiers allowed after numeric literal" при тапі',
        // Виключаємо те що вже у `'${...}'` (тобто з backtick + квот навколо)
        cmd: `grep -rnE 'onclick="[^"]*\\([^)]*\\$\\{[a-z_]+\\.id\\}' src/ --include="*.js" 2>/dev/null | grep -v "'\\\\\\$" || true`,
      },
      {
        name: 'STRING_CONCAT_UNQUOTED',
        title: "onclick=\"...(' + obj.id + ')...\" БЕЗ зовнішніх лапок",
        consequence: 'Те саме що template literal — UUID без обгортки = SyntaxError',
        cmd: `grep -rnE "onclick=\\"[^\\"]*\\(' \\+ [a-z_]+\\.id \\+ '\\)" src/ --include="*.js" 2>/dev/null | grep -v "\\\\\\\\'" || true`,
      },
      {
        name: 'ONTOUCHEND_CONCAT_UNQUOTED',
        title: "ontouchend=\"...(' + obj.id + ')...\" БЕЗ обгортки (button з double handler)",
        consequence: 'Те саме що onclick — touch handler ламається теж',
        cmd: `grep -rnE "ontouchend=\\"[^\\"]*\\(' \\+ [a-z_]+\\.id \\+ '\\)" src/ --include="*.js" 2>/dev/null | grep -v "\\\\\\\\'" || true`,
      },
      {
        name: 'PARSEINT_DATASET',
        title: 'parseInt/Number(...dataset.id...) — UUID конвертується у NaN',
        consequence: 'find(x => x.id === NaN) → завжди false → silent fail swipe-delete тощо',
        cmd: `grep -rnE '(parseInt|Number)\\([^)]*\\.dataset\\.id' src/ --include="*.js" 2>/dev/null || true`,
      },
    ];

    for (const check of checks) {
      try {
        const out = execSync(check.cmd, { cwd: repoRoot, encoding: 'utf8', shell: '/bin/bash' }).trim();
        if (out) {
          findings.push({ ...check, lines: out.split('\n') });
        }
      } catch {}
    }

    if (findings.length === 0) process.exit(0);

    console.error('🚫 PRE-COMMIT-UUID-GREP: Коміт заблоковано — UUID-міграція не повна.\n');
    findings.forEach(f => {
      console.error(`❌ ${f.name}: ${f.title}`);
      console.error(`   Наслідок: ${f.consequence}\n`);
      console.error('   Точки:');
      f.lines.forEach(l => console.error(`     ${l}`));
      console.error();
    });
    console.error('📋 Що робити:');
    console.error("   TEMPLATE_LITERAL: замінити (${id}) → ('${id}')");
    console.error("   STRING_CONCAT: замінити (' + id + ') → (\\'' + id + '\\'')");
    console.error('   ONTOUCHEND: те саме що STRING_CONCAT');
    console.error('   PARSEINT: видалити parseInt — txId лишається string');
    console.error('\n   Урок B-170 (xGe1H 27.04 + db0YY 12.05 + nliW8 13.05) — повторювалось 3 рази.');
    console.error('   Bypass НЕМАЄ — у юзера тап мовчки не реагує.');
    process.exit(2);
  } catch (e) {
    console.error('[pre-commit-uuid-grep] hook crashed:', e.message);
    process.exit(0);
  }
});
