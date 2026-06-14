// playwright.config.js — E2E (end-to-end) тести NeverMind у GitHub Actions.
//
// Замінює Hetzner-тестер (v1d9eo): безкоштовний раннер у CI, без окремого сервера.
// Збірка (npm run build → bundle.js) робиться у workflow ПЕРЕД тестами; тут лише
// піднімаємо статику і ганяємо браузер. Прогон видно у GitHub Actions (NM-Claude
// перевіряє через MCP).
//
// serviceWorkers:'block' — щоб старий кеш SW не підсовував стару версію у тест.

const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  expect: { timeout: 7000 },
  retries: process.env.CI ? 2 : 0,   // мережеві блипи/race → 2 повтори перед FAIL
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:4173/',
    serviceWorkers: 'block',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'python3 -m http.server 4173',
    url: 'http://127.0.0.1:4173/index.html',
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
