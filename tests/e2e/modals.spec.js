// tests/e2e/modals.spec.js — модалки відкриваються і закриваються без падінь.
// Порт сценаріїв Хетзнера test_7/test_11 (через детерміновані window-функції,
// а не CDP-тач — той був нестабільний і disabled на Хетзнері).

const { test, expect, boot } = require('./helpers');

test('Налаштування — відкриваються і закриваються', async ({ page }) => {
  const errors = await boot(page);
  await page.evaluate(() => window.openSettings());
  await expect(page.locator('#settings-overlay')).toBeVisible();
  await page.evaluate(() => window.closeSettings());
  await expect(page.locator('#settings-overlay')).toBeHidden();
  expect(errors, `pageerror: ${errors.join(' | ')}`).toHaveLength(0);
});

test('Календар — відкривається і закривається', async ({ page }) => {
  const errors = await boot(page);
  await page.evaluate(() => window.openCalendarModal());
  await expect(page.locator('#calendar-modal')).toBeVisible();
  await page.evaluate(() => window.closeCalendarModal());
  await expect(page.locator('#calendar-modal')).toBeHidden();
  expect(errors, `pageerror: ${errors.join(' | ')}`).toHaveLength(0);
});
