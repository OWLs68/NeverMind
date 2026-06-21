// tests/e2e/golden-journey.spec.js — «золотий шлях»: ОДИН довгий наскрізний
// сценарій через кілька екранів. Ловить те, що кнопкові тести не бачать —
// баги МІЖ екранами (принцип «8 чатів = один мозок»: дані створені в одному
// місці мають жити при переході в інші + після перезавантаження).
//
// Сценарій: створити задачу → створити нотатку → пройтись усіма вкладками →
// перезавантажити → переконатись що і задача, і нотатка на місці → 0 падінь.
//
// Локально E2E не ганяється (браузери недоступні) — реальний прогін у CI.
//
// Створено: 20.06.2026 gfrvu5 (перший потік /byyou).

const { test, expect, boot, gotoTab } = require('./helpers');

test('золотий шлях: задача + нотатка переживають перехід екранами і reload', async ({ page }) => {
  const errors = await boot(page);

  const taskTitle = 'GJ задача ' + Date.now();
  const noteText = 'GJ нотатка ' + Date.now();

  // --- Екран 1: створити задачу у Tasks ---
  await gotoTab(page, 'tasks');
  await page.evaluate(() => window.openAddTask());
  await expect(page.locator('#task-modal')).toBeVisible();
  await page.evaluate((t) => { document.getElementById('task-input-title').value = t; }, taskTitle);
  await page.locator('#task-modal [data-fn="saveTask"]').click();
  await expect(page.locator('#tasks-list').getByText(taskTitle)).toBeVisible();

  // --- Екран 2: створити нотатку у Notes ---
  await gotoTab(page, 'notes');
  await page.evaluate(() => window.openAddNote());
  await expect(page.locator('#note-modal')).toBeVisible();
  await page.evaluate((txt) => {
    document.getElementById('note-input-folder').value = 'Тест';
    document.getElementById('note-input-text').value = txt;
  }, noteText);
  await page.locator('#note-modal [data-fn="saveNote"]').click();
  await expect(page.locator('#notes-content').getByText(noteText)).toBeVisible();

  // --- Прохід усіма вкладками (міжекранні переходи не мають нічого ламати) ---
  for (const tab of ['inbox', 'health', 'finance', 'evening', 'me', 'projects', 'tasks']) {
    await gotoTab(page, tab);
  }

  // --- Перезавантаження: обидві сутності лишились (persistence через екрани) ---
  await page.reload();
  await page.waitForFunction(() => window.NM_BOOT_DONE === true, { timeout: 15000 });

  await gotoTab(page, 'tasks');
  await expect(page.locator('#tasks-list').getByText(taskTitle)).toBeVisible();

  await gotoTab(page, 'notes');
  await expect(page.locator('#notes-content').getByText(noteText)).toBeVisible();

  // Жодного падіння JS за весь шлях.
  expect(errors, `pageerror: ${errors.join(' | ')}`).toHaveLength(0);
});
