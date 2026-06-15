// tests/e2e/tasks.spec.js — функціональні UI-перевірки задач.
// Порт сценаріїв Хетзнера test_3 (persistence) + test_15-частина (модалка).

const { test, expect, boot, gotoTab } = require('./helpers');

test('задача — додається, видно у списку, лишається після перезавантаження', async ({ page }) => {
  const errors = await boot(page);
  await gotoTab(page, 'tasks');

  const title = 'E2E задача ' + Date.now();
  await page.evaluate(() => window.openAddTask());
  await expect(page.locator('#task-modal')).toBeVisible();
  // input має readonly/focus-хак для iOS → значення ставимо напряму, потім тиснемо
  // РЕАЛЬНУ кнопку «Зберегти» (через делегацію data-fn=saveTask).
  await page.evaluate((t) => { document.getElementById('task-input-title').value = t; }, title);
  await page.locator('#task-modal [data-fn="saveTask"]').click();

  // Бачимо задачу у списку (дивимось на екран, не у сховище).
  await expect(page.locator('#tasks-list').getByText(title)).toBeVisible();

  // Перезавантаження → задача лишилась (persistence).
  await page.reload();
  await page.waitForFunction(() => window.NM_BOOT_DONE === true, { timeout: 15000 });
  await gotoTab(page, 'tasks');
  await expect(page.locator('#tasks-list').getByText(title)).toBeVisible();

  expect(errors, `pageerror: ${errors.join(' | ')}`).toHaveLength(0);
});

test('модалка задачі — відкривається і закривається кнопкою «Скасувати»', async ({ page }) => {
  await boot(page);
  await gotoTab(page, 'tasks');

  await page.evaluate(() => window.openAddTask());
  await expect(page.locator('#task-modal')).toBeVisible();

  await page.locator('#task-modal [data-fn="closeTaskModal"]').click();
  await expect(page.locator('#task-modal')).toBeHidden();
});
