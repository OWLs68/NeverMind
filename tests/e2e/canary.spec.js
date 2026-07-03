// tests/e2e/canary.spec.js — 🐤 КАНАРЕЙКА: перевірка ЖИВОГО прод-сайту після деплою.
//
// Відмінність від решти E2E: ціль — https://owls68.github.io/NeverMind/ (GitHub Pages),
// НЕ локальна збірка. Ганяється workflow'ом canary.yml ПІСЛЯ auto-merge деплою.
// Закриває дірку «після публікації ніхто не дивиться на живий сайт» (дослідження
// gstack /canary, сесія 26yz5s 03.07.2026, ADR-004).
//
// Свідомо МІНІМАЛЬНА (антифлак > покриття — глибина вже покрита E2E до деплою):
//   1. Сторінка вантажиться, головний UI (нижня навігація + поле Inbox) видимий.
//   2. Нуль JS-падінь (pageerror) за час завантаження + 3с тиші.
//   3. Бейдж версії показує очікуваний номер (EXPECTED_VERSION з deploy-counter.txt)
//      — тобто Pages віддає СВІЖИЙ деплой, а не закешований старий.
//
// Чистий профіль браузера = шлях нового юзера без API-ключа: застосунок мусить
// завантажитись без помилок і без ключа. Онбординг-тур глушиться прапором
// __NM_TEST_SEED__ (той самий механізм що у helpers.js boot).

const { test, expect } = require('@playwright/test');

test.describe('🐤 Канарейка прод-сайту', () => {
  test('прод вантажиться: UI видно, 0 падінь, версія свіжа', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e.message || e)));

    await page.addInitScript(() => {
      try {
        window.__NM_TEST_SEED__ = true;
        localStorage.setItem('nm_onboarding_done', '1');
      } catch (e) {}
    });

    await page.goto('./', { waitUntil: 'domcontentloaded' });

    // 1. Головний UI: нижня навігація і бейдж версії видимі.
    await expect(page.locator('#deploy-version')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('#tab-bar')).toBeVisible({ timeout: 15000 });

    // 3с тиші — даємо boot-міграціям і першому рендеру відпрацювати.
    await page.waitForTimeout(3000);

    // 2. Нуль JS-падінь.
    expect(errors, 'JS-падіння на проді: ' + errors.join(' | ')).toEqual([]);

    // 3. Версія свіжа (EXPECTED_VERSION передає canary.yml з deploy-counter.txt).
    const expected = process.env.EXPECTED_VERSION;
    if (expected) {
      const badge = await page.locator('#deploy-version').textContent();
      expect(badge, `бейдж "${badge}" не містить очікуваної v${expected} — Pages віддає старий деплой`).toContain('v' + expected);
    }
  });
});
