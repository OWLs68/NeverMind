// playwright.canary.config.js — конфіг КАНАРЕЙКИ (пост-деплой перевірка прод-сайту).
//
// Відрізняється від основного playwright.config.js:
//   - БЕЗ webServer: ціль — живий GitHub Pages (CANARY_URL), не локальна збірка.
//   - testDir той самий, але matcher бере лише canary.spec.js.
//   - Один браузер (WebKit = двигун Safari, головна платформа Романа) — канарейка
//     має бути швидкою (<1 хв); крос-браузерність покриває основний E2E до деплою.
//
// Запуск: CANARY_URL=https://owls68.github.io/NeverMind/ npx playwright test -c playwright.canary.config.js

const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests/e2e',
  testMatch: /canary\.spec\.js/,
  timeout: 45000,
  retries: process.env.CI ? 2 : 0,
  reporter: [['list']],
  use: {
    baseURL: process.env.CANARY_URL || 'https://owls68.github.io/NeverMind/',
    serviceWorkers: 'block',
    trace: 'on-first-retry',
    // Локальна проба з хмарної сесії Claude: мережа тільки через агент-проксі
    // (HTTPS_PROXY) з власним сертифікатом → проксі + допуск self-signed.
    // У CI (GitHub Actions) CANARY_LOCAL_CHROMIUM не задається → блок неактивний.
    ...(process.env.CANARY_LOCAL_CHROMIUM && process.env.HTTPS_PROXY
      ? { proxy: { server: process.env.HTTPS_PROXY }, ignoreHTTPSErrors: true }
      : {}),
  },
  // CANARY_LOCAL_CHROMIUM=1 — локальна проба з хмарної сесії Claude (там є лише
  // chromium, WebKit ставиться тільки у CI). У CI змінна не задається → WebKit.
  projects: process.env.CANARY_LOCAL_CHROMIUM
    ? [{ name: 'Desktop Chrome', use: { ...devices['Desktop Chrome'] } }]
    : [{ name: 'Mobile Safari', use: { ...devices['iPhone 13'] } }],
});
