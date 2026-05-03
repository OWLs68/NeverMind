#!/usr/bin/env node
// .claude/hooks/pre-commit-i18n.js
//
// PreToolUse hook (запускається ПЕРЕД виконанням Bash команди).
// Активний лише для команд `git commit`. Запускає `node scripts/check-i18n.js`
// і блокує коміт якщо кількість необгорнутих українських рядків зросла
// проти baseline.
//
// БЕЗ bypass-фрази — за прямим запитом Романа (UvEHE 03.05):
// «головне щоб ти його навмисне не обходив». Тобто Claude НЕ може просто
// додати «pre-commit: ok» у повідомлення і пройти. Якщо рядок справді треба
// у whitelist (промпт AI / коментар) — додати до WHITELIST у scripts/check-i18n.js
// або оновити baseline через `node scripts/check-i18n.js --update-baseline`.
//
// Створено: 03.05.2026 UvEHE.

const { execSync } = require('child_process');
const path = require('path');

let input = '';
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input || '{}');
    const command = (data.tool_input && data.tool_input.command) || '';

    // Активуємось ЛИШЕ на git commit — інші Bash команди пропускаємо
    if (!/\bgit\s+commit\b/.test(command)) process.exit(0);

    const repoRoot = path.join(__dirname, '..', '..');

    // Запускаємо check-i18n.js, ловимо exit code
    try {
      execSync('node scripts/check-i18n.js', {
        cwd: repoRoot,
        stdio: 'pipe', // не виводимо output напряму, ловимо для свого формату
      });
      // exit 0 від check-i18n → все чисто → дозволяємо коміт
      process.exit(0);
    } catch (e) {
      // check-i18n.js повернув non-zero → блокуємо коміт
      const output = (e.stdout?.toString() || '') + (e.stderr?.toString() || '');
      console.error('🚫 PRE-COMMIT-I18N: Коміт заблоковано — необгорнуті UI рядки.\n');
      console.error(output);
      console.error('\n📋 Що робити:');
      console.error('   1) Обгорнути нові UI-рядки у t(\'key\', \'fallback\')');
      console.error('   2) Якщо рядок не для UI (промпт / лог) — додати у WHITELIST');
      console.error('   3) Якщо обгорнув і число зменшилось — оновити baseline:');
      console.error('      node scripts/check-i18n.js --update-baseline\n');
      console.error('   Bypass НЕМАЄ — за прямим запитом Романа.');
      process.exit(2); // exit 2 блокує tool у Claude Code
    }
  } catch (err) {
    // Помилка парсингу stdin / іншого — пропускаємо щоб не зламати legitimate коміти
    process.exit(0);
  }
});
