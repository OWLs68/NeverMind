// tests/e2e/smoke.spec.js — базові E2E-перевірки NeverMind (boot + навігація).
//
// Використовує спільний фундамент tests/e2e/helpers.js: boot() глушить OpenAI,
// чекає window.NM_BOOT_DONE, збирає JS-помилки сторінки.

const { test, expect, boot, gotoTab } = require('./helpers');

test('boot — застосунок вантажиться, OWL-табло видно, без падінь', async ({ page }) => {
  const errors = await boot(page);
  await expect(page.locator('#owl-board')).toBeVisible();
  expect(errors, `pageerror: ${errors.join(' | ')}`).toHaveLength(0);
});

test('навігація — усі 8 вкладок перемикаються без падінь', async ({ page }) => {
  const errors = await boot(page);
  const tabs = ['inbox', 'tasks', 'notes', 'health', 'finance', 'evening', 'me', 'projects'];
  for (const tab of tabs) {
    await gotoTab(page, tab);
  }
  expect(errors, `pageerror: ${errors.join(' | ')}`).toHaveLength(0);
});
