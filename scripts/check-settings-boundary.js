#!/usr/bin/env node
// scripts/check-settings-boundary.js
//
// Контракт-сторож read-path налаштувань (v3pexs 28.06, борг зі звірки Supabase):
// nm_settings читається ЛИШЕ через getSettings() у src/core/settings.js.
// Раніше 12 місць робили прямий JSON.parse(localStorage.getItem('nm_settings'))
// → при Supabase довелося б міняти 12 точок замість 1. Сторож — замок від рецидиву.

const { execSync } = require('child_process');
const path = require('path');

const ALLOWED = new Set(['src/core/settings.js']);

let out = '';
try {
  out = execSync("grep -rln \"localStorage.getItem('nm_settings')\" src/ --include='*.js'", {
    cwd: path.join(__dirname, '..'), encoding: 'utf8',
  });
} catch (e) {
  if (e.status === 1) {
    console.error('❌ SETTINGS-BOUNDARY: nm_settings не читається ніде — getSettings зник?');
    process.exit(1);
  }
  throw e;
}

const files = out.trim().split('\n').filter(Boolean);
const violators = files.filter(f => !ALLOWED.has(f));
if (violators.length > 0) {
  console.error('\n=== ❌ SETTINGS-BOUNDARY СТОРОЖ: пряме читання nm_settings в обхід getSettings() ===\n');
  violators.forEach(f => console.error('  ✗ ' + f));
  console.error('\nЧитання налаштувань — лише getSettings() (src/core/settings.js). НЕ пушити без фіксу.\n');
  process.exit(1);
}
console.log('✅ settings-boundary сторож: nm_settings читається лише у src/core/settings.js');
process.exit(0);
