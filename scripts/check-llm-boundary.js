#!/usr/bin/env node
// scripts/check-llm-boundary.js
//
// Контракт-сторож ЄДИНОГО LLM-кордону (план Supabase §8, v3pexs 28.06):
// РІВНО один файл у src/ має право звертатись до api.openai.com — src/ai/core.js
// (функція openaiFetch). Раніше 15 викликів у 11 файлах → OpenAI→Mastra/Edge
// означало б 15 переписувань; тепер = зміна 1 функції. Цей сторож — замок від
// рецидиву: нове пряме звернення в обхід кордону валить pre-push/CI.

const { execSync } = require('child_process');
const path = require('path');

const ALLOWED = new Set(['src/ai/core.js']);

let out = '';
try {
  out = execSync("grep -rln 'api\\.openai\\.com' src/ --include='*.js'", {
    cwd: path.join(__dirname, '..'), encoding: 'utf8',
  });
} catch (e) {
  // grep exit 1 = нічого не знайдено — теж провал (кордон зник?)
  if (e.status === 1) {
    console.error('❌ LLM-BOUNDARY: api.openai.com не знайдено НIДЕ — кордон openaiFetch зник з core.js?');
    process.exit(1);
  }
  throw e;
}

const files = out.trim().split('\n').filter(Boolean);
const violators = files.filter(f => !ALLOWED.has(f));

if (violators.length > 0) {
  console.error('\n=== ❌ LLM-BOUNDARY СТОРОЖ: пряме звернення до OpenAI в обхід кордону ===\n');
  violators.forEach(f => console.error('  ✗ ' + f));
  console.error('\nУсі LLM-виклики — через openaiFetch (src/ai/core.js). План Supabase §8.\nНЕ пушити без фіксу.\n');
  process.exit(1);
}
if (!files.includes('src/ai/core.js')) {
  console.error('❌ LLM-BOUNDARY: core.js не містить api.openai.com — кордон переїхав? Онови ALLOWED.');
  process.exit(1);
}
console.log('✅ llm-boundary сторож: api.openai.com лише у src/ai/core.js (openaiFetch)');
process.exit(0);
