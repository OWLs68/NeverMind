// tests/e2e/contract.spec.js — контракт-тест ПОВНОГО конвеєра «текст → сутність».
//
// Чим відрізняється від check-*.js (юніт): ті тестують детерміновані шматки
// (guards/parser) напряму. Цей — увесь ДРІТ end-to-end: текст в Inbox →
// callAIWithTools → (OpenAI ЗАМОКАНО, віддає tool_call) → dispatch → фабрика →
// localStorage → рендер у вкладці. Тобто «коли AI сказав save_task — система
// реально створює задачу і показує її». OpenAI повністю замокано (mockAI) —
// тест детермінований, дешевий, без мережі.
//
// Локально E2E не ганяється (немає браузерів) — реальний прогін у CI (e2e.yml).
// Розширення (save_finance, save_note, guard-конверсія end-to-end) — наступним
// кроком після першого зеленого CI-базлайну.
//
// Створено: 20.06.2026 gfrvu5 (перший потік /byyou).

const { test, expect, boot, seedState, gotoTab } = require('./helpers');

test('контракт: текст в Inbox + AI tool_call save_task → задача у Tasks + persists', async ({ page }) => {
  const title = 'Контракт задача ' + Date.now();

  // Ключ у сховищі — щоб sendToAI пішов AI-шляхом (без ключа → офлайн-збереження).
  // Сам OpenAI замокано через boot({mockAI}) → детермінований tool_call.
  await seedState(page, { raw: { nm_gemini_key: 'test-key-e2e' } });
  const errors = await boot(page, {
    mockAI: {
      toolCalls: [{
        id: 'tc-task-1',
        type: 'function',
        function: {
          name: 'save_task',
          arguments: JSON.stringify({ _reasoning_log: 'e2e', title, priority: 'normal' }),
        },
      }],
    },
  });

  // Пишемо в Inbox і тиснемо РЕАЛЬНУ кнопку відправки (делегація data-fn=sendToAI).
  await gotoTab(page, 'inbox');
  await page.locator('#inbox-input').fill('купити молоко');
  await page.locator('#ai-send-btn').click();

  // Задача зʼявилась у Tasks — дивимось на ЕКРАН, не у сховище.
  await gotoTab(page, 'tasks');
  await expect(page.locator('#tasks-list').getByText(title)).toBeVisible({ timeout: 10000 });

  // Persistence: після перезавантаження задача лишилась (конвеєр реально записав).
  await page.reload();
  await page.waitForFunction(() => window.NM_BOOT_DONE === true, { timeout: 15000 });
  await gotoTab(page, 'tasks');
  await expect(page.locator('#tasks-list').getByText(title)).toBeVisible();

  expect(errors, `pageerror: ${errors.join(' | ')}`).toHaveLength(0);
});
