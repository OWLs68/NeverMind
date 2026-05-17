#!/usr/bin/env node
// .claude/hooks/pre-commit-screenshot.js
//
// PreToolUse hook (запускається ПЕРЕД git commit).
// Блокує коміт якщо у staged JSON знайдено `"screenshot_b64": "..."` з НЕ-null
// значенням. Це другий рівень захисту до workflow guard у auto-merge-tester.yml.
//
// КОРІНЬ ЧОМУ ПОТРІБЕН (Security аудит e9t3N 15.05.2026):
// AI-тестер на Hetzner робить скріни у failures. Скрін Health-картки = PHI
// (GDPR Article 9). Скрін Finance = financial PII. У public GitHub репо це
// GDPR порушення. Контракт каже: screenshot ЗБЕРIГАЄТЬСЯ як локальний шлях
// на сервері (`screenshot_path`), НЕ base64 у git.
//
// Захист на двох рівнях:
// 1. workflow `auto-merge-tester.yml:58` — блокує merge у main якщо знайде
// 2. ЦЕЙ hook (local pre-commit) — ловить РАНІШЕ, до push'у
//
// Без bypass — base64 PHI у git = GDPR Article 32 violation.
//
// Створено: DGH6F 16.05.2026.

const { execSync } = require('child_process');

let input = '';
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input || '{}');
    const command = (data.tool_input && data.tool_input.command) || '';

    // Активуємось ЛИШЕ на git commit
    if (!/\bgit\s+commit\b/.test(command)) process.exit(0);

    // Перевіряємо staged JSON файли (тільки JSON — там може жити base64)
    let stagedFiles = '';
    try {
      stagedFiles = execSync('git diff --cached --name-only --diff-filter=ACM', {
        encoding: 'utf8'
      });
    } catch {
      process.exit(0); // не зміг прочитати staged — пропускаємо, не блокуємо
    }

    const jsonFiles = stagedFiles
      .split('\n')
      .map(f => f.trim())
      .filter(f => f.endsWith('.json'));

    if (jsonFiles.length === 0) process.exit(0);

    // Шукаємо у staged-вміст (НЕ у working tree — щоб не ловити локальні зміни що не у коміті)
    const violations = [];
    for (const file of jsonFiles) {
      let content = '';
      try {
        content = execSync(`git show :${file}`, { encoding: 'utf8' });
      } catch {
        continue;
      }
      // Шукаємо "screenshot_b64": "..." (не null, не порожній)
      // Дозволяємо "screenshot_b64": null і "screenshot_b64": ""
      const matches = content.match(/"screenshot_b64"\s*:\s*"[^"]+"/g);
      if (matches && matches.length > 0) {
        violations.push({ file, count: matches.length });
      }
    }

    if (violations.length === 0) process.exit(0);

    console.error('🚫 PRE-COMMIT-SCREENSHOT: Коміт заблоковано — base64 скрін у JSON.\n');
    for (const v of violations) {
      console.error(`   ❌ ${v.file} — ${v.count} раз(и) "screenshot_b64" зі значенням`);
    }
    console.error('\n⚠️  GDPR Article 9: PHI (Health скрін) у public репо = порушення.');
    console.error('   AI-тестер ЗОБОВ\'ЯЗАНИЙ зберігати тільки `screenshot_path` (локальний');
    console.error('   шлях НА СЕРВЕРІ Hetzner). Base64 у git → потенційний витік даних юзерів.');
    console.error('\n📋 Що робити:');
    console.error('   1) Замінити "screenshot_b64": "...base64..." → "screenshot_path": "/home/nmtester/..."');
    console.error('   2) Або встановити "screenshot_b64": null якщо скрін не потрібен');
    console.error('   3) Перевірити чи у `.gitignore` є `_ai-tools/tester-screenshots/*.png`');
    console.error('\n   Bypass НЕМАЄ — це другий рівень захисту після workflow guard.');
    console.error('   Деталі: docs/SECURITY.md + _ai-tools/AI_TESTER_INTEGRATION.md.\n');
    process.exit(2);
  } catch (e) {
    console.error('[pre-commit-screenshot] hook crashed:', e.message);
    process.exit(0); // не блокуємо при крашу хука
  }
});
