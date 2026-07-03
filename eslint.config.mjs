// ESLint-сторож — ТІЛЬКИ правило no-undef (виклик/звертання до неоголошеного
// імені). Ловить клас «переніс функцію між файлами — забув константи/import»:
// E2E #39 (getFolderColor відрізаний від констант) та B-201 (виклик через
// чистий re-export, який НЕ створює локального імені). Статично, до деплою.
//
// Свідомо БЕЗ стилістичних правил — це не лінтер краси, а сторож класу багів
// (принцип «менше = більше»). Запуск: `npx eslint src` (CI: e2e.yml крок
// «Static no-undef»). Скоуп — лише src/ (scripts/ і tests/ — Node-стиль, не
// лінтяться).
import globals from 'globals';

export default [
  {
    files: ['src/**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.browser },
    },
    rules: {
      'no-undef': 'error',
    },
  },
];
