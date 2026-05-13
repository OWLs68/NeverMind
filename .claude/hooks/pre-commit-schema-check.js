#!/usr/bin/env node
// .claude/hooks/pre-commit-schema-check.js
//
// PreToolUse hook (запускається ПЕРЕД git commit).
// Перевіряє ДВI типові помилки у `src/ai/prompts.js`:
//
// 1. ID-поле має `type: "integer"` (B-172 patten):
//    Після UUID-міграції всі ID — string (з дефісами). Якщо схема каже integer,
//    OpenAI Strict mode відкидає AI-виклики silent — жодної помилки у консолі,
//    юзер каже «видали X» → AI вдає що «✓» але нічого не виконує.
//    db0YY 12.05 — 24+ год у проді silent fail для 28+ точок.
//
// 2. `ЗОБОВ'ЯЗАНИЙ` у description tool параметра (PJi7l B-158 patten):
//    Hard constraint у description змушує AI запитувати юзера замість тихо
//    skip. Урок 08.05 PJi7l — subcategory був «ЗОБОВ'ЯЗАНИЙ» → AI не виконував
//    save_finance → revert через 4 коміти.
//    Правило: hard constraint ТIЛЬКИ коли реально hard (тип/required).
//    Для пом'якшення семантики → «ОПЦІЙНЕ + не питай юзера».
//
// БЕЗ bypass — обидва патерни ламають AI silent у проді.
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
    const errors = [];

    // 1. id-поле з integer
    try {
      const out = execSync(
        `grep -nE '[a-z_]*id[a-z_]*:\\s*\\{\\s*type:\\s*"integer"' src/ai/prompts.js || true`,
        { cwd: repoRoot, encoding: 'utf8' }
      ).trim();
      if (out) {
        errors.push({
          type: 'INTEGER_ID',
          title: 'ID-поле має type: "integer" — після UUID-міграції має бути "string"',
          consequence: 'OpenAI Strict mode silent відкидає AI-виклики. Юзер думає AI працює.',
          lines: out.split('\n'),
        });
      }
    } catch {}

    // 2. ЗОБОВ'ЯЗАНИЙ у description
    try {
      const out = execSync(
        `grep -nE 'ЗОБОВ.{0,2}ЯЗАН' src/ai/prompts.js || true`,
        { cwd: repoRoot, encoding: 'utf8' }
      ).trim();
      if (out) {
        errors.push({
          type: 'HARD_CONSTRAINT',
          title: '«ЗОБОВ\'ЯЗАНИЙ» у tool description — AI ламається на пом\'якшенні',
          consequence: 'AI запитує юзера у content замість тихо skip. PJi7l B-158 → revert.',
          lines: out.split('\n'),
        });
      }
    } catch {}

    if (errors.length === 0) process.exit(0);

    console.error('🚫 PRE-COMMIT-SCHEMA: Коміт заблоковано — типові помилки prompts.js.\n');
    errors.forEach(e => {
      console.error(`❌ ${e.type}: ${e.title}`);
      console.error(`   Наслідок: ${e.consequence}\n`);
      console.error('   Точки:');
      e.lines.forEach(l => console.error(`     ${l}`));
      console.error();
    });
    console.error('📋 Що робити:');
    console.error('   INTEGER_ID: замінити "integer" → "string" для ID-полів');
    console.error('   HARD_CONSTRAINT: переписати «ЗОБОВ\'ЯЗАНИЙ» → «ОПЦІЙНЕ + НЕ питай юзера»\n');
    console.error('   Bypass НЕМАЄ — обидва патерни silent fail у проді.');
    process.exit(2);
  } catch (e) {
    console.error('[pre-commit-schema-check] hook crashed:', e.message);
    process.exit(0);
  }
});
