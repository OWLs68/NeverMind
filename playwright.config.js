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
  // Канарейка (canary.spec.js) ганяється ОКРЕМИМ конфігом по живому проду
  // (playwright.canary.config.js) — у локально-збірковому прогоні їй нема чого робити.
  testIgnore: /canary\.spec\.js/,
  timeout: 30000,
  retries: process.env.CI ? 2 : 0,   // мережеві блипи/race → 2 повтори перед FAIL
  reporter: [['list'], ['html', { open: 'never' }]],
  // Знімки-еталони (visual regression): глушимо анімації + дозволяємо мікро-різницю
  // рендеру (антиаліасинг/blur у CI). Еталони генеруються ТІЛЬКИ в CI (Linux) —
  // ніколи локально, інакше шрифти не збігаються (web-розвідка Council 15.06).
  expect: {
    timeout: 7000,
    toHaveScreenshot: {
      animations: 'disabled',
      maxDiffPixelRatio: 0.02,  // до 2% пікселів можуть відрізнятись (blur/шрифти)
      threshold: 0.25,          // толерантність кольору окремого пікселя (0-1)
    },
  },
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
  // Mobile Safari (WebKit) — головна платформа Романа (iPhone), найближче до
  // реального Safari. Desktop Chrome — швидкий крос-чек логіки. Реальні iOS-quirks
  // (rubber-band/backdrop-filter composite) не ловить жоден headless — лишається
  // ручний смоук на айфоні (Council Red Team 15.06).
  projects: [
    { name: 'Mobile Safari', use: { ...devices['iPhone 13'] } },
    { name: 'Desktop Chrome', use: { ...devices['Desktop Chrome'] } },
  ],
});
