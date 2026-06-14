// tests/e2e/smoke.spec.js — базові E2E-перевірки NeverMind (Крок 1).
//
// Селектори взято з наявного Hetzner-тестера (scripts/ai-tester.py): boot прапор
// window.NM_BOOT_DONE, #owl-board, [data-tab="..."], #prod-add-btn, #task-input-title.
// Навігація клікається через evaluate (як click_sel у старому тестері) — не падає
// якщо елемент тимчасово неактивний, перевіряємо саме відсутність крашів.

const { test, expect } = require('@playwright/test');

function trackPageErrors(page) {
  const errors = [];
  page.on('pageerror', e => errors.push(String(e.message || e)));
  return errors;
}

async function boot(page) {
  await page.goto('/');
  await page.waitForFunction(() => window.NM_BOOT_DONE === true, { timeout: 15000 });
}

test('boot — застосунок вантажиться, OWL-табло видно, без падінь', async ({ page }) => {
  const errors = trackPageErrors(page);
  await boot(page);
  await expect(page.locator('#owl-board')).toBeVisible();
  expect(errors, `pageerror: ${errors.join(' | ')}`).toHaveLength(0);
});

test('навігація — усі 8 вкладок перемикаються без падінь', async ({ page }) => {
  const errors = trackPageErrors(page);
  await boot(page);
  const tabs = ['inbox', 'tasks', 'notes', 'health', 'finance', 'evening', 'me', 'projects'];
  for (const tab of tabs) {
    await page.evaluate((t) => document.querySelector(`[data-tab="${t}"]`)?.click(), tab);
    await page.waitForTimeout(300);
  }
  expect(errors, `pageerror: ${errors.join(' | ')}`).toHaveLength(0);
});

// TODO (Крок 2): інтеракційні тести (додавання задачі/нотатки, свайп-видалення,
// модалки, Проекти) — портувати по одному з трейсами. Сценарій «➕ задача» на
// Hetzner був disabled через нюанс видимості #prod-add-btn — вивчити окремо, не наздогад.
