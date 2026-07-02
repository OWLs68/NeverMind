#!/usr/bin/env node
// .claude/hooks/pre-commit-reverser-check.js
//
// PreToolUse hook (запускається ПЕРЕД git commit).
// Перевіряє: КОЖЕН reverser у `src/data/action-reversers.js` повинен мати
// парний `case 'TOOL'` у `processUniversalAction` (src/core/execute-action.js).
// Інакше юзер каже «скасуй» → AI пише «✓» але насправді нічого не скасовано.
//
// КОРІНЬ ЧОМУ ПОТРІБЕН (lessons.md):
// db0YY B-174: save_finance reverser шле {tool:'delete_transaction'} у
// `processUniversalAction`, але `delete_transaction` жив ТIЛЬКИ у
// `tool-dispatcher.js` direct handler. processUniversalAction → return false →
// AI пише «⚠️ Не зміг відмінити». 24+ годин silent fail у проді.
// Дзеркальна B-174 повторювалась для create_health_card, add_allergy у db0YY.
//
// Як працює:
//   1. Grep усіх `tool: 'TYPE'` у REVERSERS object у action-reversers.js.
//   2. Grep `action === 'TYPE'` у processUniversalAction (src/core/execute-action.js).
//   3. Якщо є tool без парного case → блокує коміт.
//
// БЕЗ bypass — silent undo fail = юзер думає що AI скасував, дані залишаються.
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

    // 1. Усі reverser-tools у action-reversers.js
    let reverserTools;
    try {
      reverserTools = execSync(
        `grep -oE "tool: '[a-z_]+'" src/data/action-reversers.js | awk -F"'" '{print $2}' | sort -u`,
        { cwd: repoRoot, encoding: 'utf8' }
      ).trim().split('\n').filter(Boolean);
    } catch { reverserTools = []; }

    // 2. Cases у processUniversalAction (тільки delete_* варто перевіряти —
    //    бо це власне reverse-direction tools що приходять через executeReverse)
    let processCases;
    try {
      processCases = execSync(
        `sed -n '/^export function processUniversalAction/,/^}$/p' src/core/execute-action.js | grep -oE "action === '[a-z_]+'" | awk -F"'" '{print $2}' | sort -u`,
        { cwd: repoRoot, encoding: 'utf8' }
      ).trim().split('\n').filter(Boolean);
    } catch { processCases = []; }

    // 3. Різниця: reverser-tools без парного case
    const missing = reverserTools.filter(t => !processCases.includes(t));

    if (missing.length === 0) process.exit(0);

    console.error('🚫 PRE-COMMIT-REVERSER: Коміт заблоковано — silent undo fail ризик.\n');
    console.error('Reverser-tools що НЕ мають парного case у processUniversalAction (core/execute-action.js):');
    missing.forEach(t => console.error(`   • '${t}'`));
    console.error('\n📋 Юзер каже «скасуй» → executeReverse шле сюди → return false → AI бреше «✓ Скасовано».');
    console.error('\n📋 Що робити:');
    console.error('   1) Відкрити src/core/execute-action.js → функція processUniversalAction');
    console.error('   2) Додати `if (action === \'TYPE\')` для кожного tool зі списку вище');
    console.error('   3) Case має викликати відповідну delete-функцію + addMsg підтвердження\n');
    console.error('   Урок B-174 (db0YY 12.05) — той самий клас повторювався 3 рази підряд.');
    console.error('   Bypass НЕМАЄ — silent undo fail вводить юзера в оману.');
    process.exit(2);
  } catch (e) {
    console.error('[pre-commit-reverser-check] hook crashed:', e.message);
    process.exit(0);
  }
});
