#!/usr/bin/env node
// .claude/hooks/pre-commit-trash-sync.js
//
// PreToolUse hook (запускається ПЕРЕД git commit).
// Перевіряє: КОЖЕН `addToTrash('TYPE', ...)` у src/ повинен мати парний
// `case 'TYPE'` у `restoreFromTrash` (src/core/trash.js). Інакше юзер тапає
// «Відновити X» → нічого не відбувається → дані зникають назавжди.
//
// КОРІНЬ ЧОМУ ПОТРІБЕН (lessons.md):
// db0YY B-175: deleteHealthCardProgrammatic кидав addToTrash('health_card')
// але restoreFromTrash НЕ мав case 'health_card'. Юзер бачив «✅ Відновив» але
// картка не з'являлась. Silent data loss. Той самий клас повторювався 4 рази
// (allergy/event/project/health_card).
//
// Як працює:
//   1. Grep усіх addToTrash('TYPE', ...) у src/ — збирає унікальні TYPE.
//   2. Grep `type === 'TYPE'` у src/core/trash.js — збирає cases у restoreFromTrash.
//   3. Якщо є TYPE без парного case → блокує коміт.
//
// БЕЗ bypass — silent data loss = втрата даних реального юзера у проді.
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

    // 1. Усі типи що пишуться у кошик
    let addTypes;
    try {
      addTypes = execSync(
        `grep -rnoE "addToTrash\\('[a-z_]+'" src/ --include="*.js" | awk -F"'" '{print $2}' | sort -u`,
        { cwd: repoRoot, encoding: 'utf8' }
      ).trim().split('\n').filter(Boolean);
    } catch { addTypes = []; }

    // 2. Усі типи що відновлюються
    let restoreTypes;
    try {
      restoreTypes = execSync(
        `grep -onE "type === '[a-z_]+'" src/core/trash.js | awk -F"'" '{print $2}' | sort -u`,
        { cwd: repoRoot, encoding: 'utf8' }
      ).trim().split('\n').filter(Boolean);
    } catch { restoreTypes = []; }

    // 3. Різниця: типи без парного case
    const missing = addTypes.filter(t => !restoreTypes.includes(t));

    if (missing.length === 0) process.exit(0);

    console.error('🚫 PRE-COMMIT-TRASH-SYNC: Коміт заблоковано — silent data loss ризик.\n');
    console.error(`Типи що пишуть у кошик БЕЗ парного case у restoreFromTrash:`);
    missing.forEach(t => console.error(`   • '${t}'`));
    console.error('\n📋 Юзер тапає «Відновити» → нічого не повертається → дані зникають назавжди.');
    console.error('\n📋 Що робити:');
    console.error('   1) Відкрити src/core/trash.js → функція restoreFromTrash');
    console.error('   2) Додати `case \'TYPE\'` для кожного типу зі списку вище');
    console.error('   3) case має push елемент назад у правильне localStorage сховище\n');
    console.error('   Bypass НЕМАЄ — silent data loss = втрата даних реального юзера.');
    process.exit(2);
  } catch (e) {
    console.error('[pre-commit-trash-sync] hook crashed:', e.message);
    process.exit(0);
  }
});
