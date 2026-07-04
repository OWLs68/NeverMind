#!/usr/bin/env node
// scripts/check-review-rules.js — контракт-тест мапи глоб→чекліст (P3, ADR-005).
//
// Перевіряє: (1) глоб-матчер без regex працює на реальних наших шляхах;
// (2) rules.json валідний і всі згадані чеклісти існують файлами;
// (3) security_sensitive матчиться коректно.
// Створено: 26yz5s 04.07.2026.

const fs = require('fs');
const path = require('path');
const { globMatch, resolveChecklists, isSecuritySensitive } = require('./lib/glob-match.js');

const RULES_DIR = path.join(__dirname, '..', '_ai-tools', 'review-rules');
const rules = JSON.parse(fs.readFileSync(path.join(RULES_DIR, 'rules.json'), 'utf8'));
let failures = 0;
function check(name, ok, extra) {
  console.log(`${ok ? '✓' : '✗'} ${name}${extra ? ' — ' + extra : ''}`);
  if (!ok) failures++;
}

// 1. Прямі матчі глобів
check('глоб src/** vs src/ai/core.js', globMatch('src/ai/**', 'src/ai/core.js'));
check('глоб src/**/*.js vs src/tabs/habits.js', globMatch('src/**/*.js', 'src/tabs/habits.js'));
check('глоб .claude/hooks/** vs .claude/hooks/log-event.js', globMatch('.claude/hooks/**', '.claude/hooks/log-event.js'));
check('глоб sw.js точний vs sw.js', globMatch('sw.js', 'sw.js'));
check('глоб * НЕ перетинає / (src/ai/** vs sw.js = false)', !globMatch('src/ai/**', 'sw.js'));
check('глоб .github/workflows/** vs e2e.yml всередині', globMatch('.github/workflows/**', '.github/workflows/e2e.yml'));

// 2. resolveChecklists збирає правильні набори
const cAi = resolveChecklists('src/ai/prompts.js', rules);
check('src/ai/prompts.js → security+js+default', cAi.includes('security.md') && cAi.includes('js.md') && cAi.includes('default.md'), cAi.join(','));
const cHook = resolveChecklists('.claude/hooks/do-not-touch-guard.js', rules);
check('hook → hooks.md+js.md+default', cHook.includes('hooks.md') && cHook.includes('js.md'), cHook.join(','));
const cRender = resolveChecklists('src/tabs/notes.js', rules);
check('src/tabs/notes.js → render.md+js.md', cRender.includes('render.md') && cRender.includes('js.md'), cRender.join(','));

// 3. Усі згадані чеклісти існують файлами
const mentioned = new Set([rules.default]);
rules.rules.forEach(r => r.checklists.forEach(c => mentioned.add(c)));
let allExist = true;
for (const c of mentioned) {
  if (!fs.existsSync(path.join(RULES_DIR, c))) { allExist = false; console.log('  ✗ нема файлу:', c); }
}
check('усі чеклісти з rules.json існують', allExist);

// 4. security_sensitive
check('src/ai/core.js — security-sensitive', isSecuritySensitive('src/ai/core.js', rules));
check('src/data/months.js — НЕ sensitive', !isSecuritySensitive('src/data/months.js', rules));

if (failures) { console.error(`\n✗ check-review-rules: ${failures} провал(ів)`); process.exit(1); }
console.log('\n✓ check-review-rules: усі перевірки пройдено');
