// tests/e2e/lists.spec.js — списки-чеклісти в Inbox (v3pexs).
// Головна вимога Романа: список рендериться карткою-чеклістом у стрічці Inbox
// і НЕ зʼявляється у вкладці Задачі. Тап-тогл галочки — ручний iPhone-смоук
// (touch headless ненадійний, правило 13). Маршрут/детект — контракт-тести.

const { test, expect, boot, seedState, gotoTab } = require('./helpers');

const LIST = {
  id: 'list-e2e-1',
  title: 'Покупки E2E',
  items: [
    { id: 'it-1', text: 'молоко', done: false },
    { id: 'it-2', text: 'хліб', done: false },
    { id: 'it-3', text: 'яйця', done: true },
  ],
  status: 'active',
  createdAt: 1,
  user_id: 'test-user-e2e',
  deleted_at: null,
};
const INBOX_CARD = { id: 'inbox-e2e-1', listId: 'list-e2e-1', text: 'Покупки E2E', category: 'list', ts: 1, processed: true };

test('список — картка-чекліст видно у стрічці Inbox, пункти на екрані', async ({ page }) => {
  await seedState(page, { raw: { nm_lists: [LIST], nm_inbox: [INBOX_CARD] } });
  const errors = await boot(page);
  await gotoTab(page, 'inbox');

  // Заголовок списку + усі пункти видно (дивимось на ЕКРАН).
  await expect(page.locator('#inbox-list').getByText('Покупки E2E')).toBeVisible();
  await expect(page.locator('#inbox-list').getByText('молоко')).toBeVisible();
  await expect(page.locator('#inbox-list').getByText('хліб')).toBeVisible();
  await expect(page.locator('#inbox-list').getByText('яйця')).toBeVisible();

  expect(errors, `pageerror: ${errors.join(' | ')}`).toHaveLength(0);
});

test('список НЕ потрапляє у вкладку Задачі (вимога Романа)', async ({ page }) => {
  await seedState(page, { raw: { nm_lists: [LIST], nm_inbox: [INBOX_CARD] } });
  await boot(page);
  await gotoTab(page, 'tasks');

  // Жодного сліду списку у Задачах.
  await expect(page.locator('#tasks-list').getByText('Покупки E2E')).toHaveCount(0);
  await expect(page.locator('#tasks-list').getByText('молоко')).toHaveCount(0);
});

test('список лишається у Inbox після перезавантаження (persistence)', async ({ page }) => {
  await seedState(page, { raw: { nm_lists: [LIST], nm_inbox: [INBOX_CARD] } });
  await boot(page);
  await gotoTab(page, 'inbox');
  await expect(page.locator('#inbox-list').getByText('молоко')).toBeVisible();

  await page.reload();
  await page.waitForFunction(() => window.NM_BOOT_DONE === true, { timeout: 15000 });
  await gotoTab(page, 'inbox');
  await expect(page.locator('#inbox-list').getByText('молоко')).toBeVisible();
});
