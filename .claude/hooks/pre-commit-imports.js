#!/usr/bin/env node
// .claude/hooks/pre-commit-imports.js
//
// PreToolUse hook (запускається ПЕРЕД git commit).
// Запускає `node scripts/check-imports.js` і блокує коміт якщо знайдено
// забуті імпорти у `src/**/*.js`.
//
// КОРІНЬ ЧОМУ ПОТРІБЕН (lessons.md):
// IIFE-bundle (esbuild format:'iife') не лінкує модулі, якщо файл викликає
// `foo()` без явного `import`. При колізії імен функція стає `foo2`, виклик
// `foo()` → ReferenceError у проді. Не ловиться лінтером, не ловиться build'ом
// якщо CI не падає — тільки реальний клік юзера.
//
// check-imports.js уже підключений у build.js, але CI це після push. Цей
// hook ловить РАНІШЕ — на pre-commit. Якщо я забув import — комміт блокується
// до того як код потрапить на сервер.
//
// БЕЗ bypass-фрази — забутий імпорт = біла сторінка у юзера. Це не косметика.
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

    // Активуємось ЛИШЕ на git commit
    if (!/\bgit\s+commit\b/.test(command)) process.exit(0);

    const repoRoot = path.join(__dirname, '..', '..');

    try {
      execSync('node scripts/check-imports.js', {
        cwd: repoRoot,
        stdio: 'pipe',
      });
      process.exit(0); // exit 0 → все чисто → дозволяємо коміт
    } catch (e) {
      const output = (e.stdout?.toString() || '') + (e.stderr?.toString() || '');
      console.error('🚫 PRE-COMMIT-IMPORTS: Коміт заблоковано — забутий імпорт у src/.\n');
      console.error(output);
      console.error('\n📋 Що робити:');
      console.error('   1) Додати import у файл де викликається функція');
      console.error('   2) Перевірити правопис назви функції');
      console.error('   3) Якщо це false positive — фіксити scripts/check-imports.js whitelist\n');
      console.error('   Bypass НЕМАЄ — забутий імпорт = біла сторінка у юзера.');
      process.exit(2);
    }
  } catch (e) {
    console.error('[pre-commit-imports] hook crashed:', e.message);
    process.exit(0); // не блокуємо при крашу хука
  }
});
