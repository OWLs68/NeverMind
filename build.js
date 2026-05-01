// === Pre-check: i18n (29.04.2026 m4Q1o) ===
// Ламає білд якщо у src/ зросла кількість необгорнутих українських рядків
// (порівняно з i18n-baseline.json). Деталі → scripts/check-i18n.js.
// Skip-варіант для екстрених деплоїв: SKIP_I18N_CHECK=1 node build.js
if (!process.env.SKIP_I18N_CHECK) {
  const { execSync } = require('child_process');
  try {
    execSync('node scripts/check-i18n.js', { stdio: 'inherit' });
  } catch (e) {
    console.error('\n✗ build перерваний: i18n-перевірка не пройшла.');
    console.error('  Виправ помилки вище АБО запусти SKIP_I18N_CHECK=1 node build.js (тільки для екстрених випадків).');
    process.exit(1);
  }
}

// === Pre-check: imports (01.05.2026 rKQPT) ===
// Ламає білд якщо файл викликає функцію з іншого модуля без явного import.
// У IIFE bundle esbuild перейменовує функцію при колізії (foo→foo2), і виклик
// без import дає ReferenceError на проді. Деталі → scripts/check-imports.js.
// Skip-варіант: SKIP_IMPORTS_CHECK=1 node build.js
if (!process.env.SKIP_IMPORTS_CHECK) {
  const { execSync } = require('child_process');
  try {
    execSync('node scripts/check-imports.js', { stdio: 'inherit' });
  } catch (e) {
    console.error('\n✗ build перерваний: знайдено забуті import.');
    console.error('  Виправ помилки вище АБО запусти SKIP_IMPORTS_CHECK=1 node build.js (тільки для екстрених випадків).');
    process.exit(1);
  }
}

require('esbuild').buildSync({
  entryPoints: ['src/app.js'],
  bundle: true,
  outfile: 'bundle.js',
  format: 'iife',
  minify: false,
  sourcemap: true,
});
