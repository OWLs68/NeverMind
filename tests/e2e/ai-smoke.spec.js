// tests/e2e/ai-smoke.spec.js — 🤖 ЖИВИЙ AI-СМОУК (реальний OpenAI, НЕ мок).
//
// Дірка яку закриває (26yz5s 03.07, ADR-004): усі E2E глушать/мокають OpenAI —
// поведінку ЖИВОГО AI (чи реально «купив каву 50» падає у Фінанси) перевіряли
// тільки руки Романа. Розширено 04.07 (рішення Романа «4 сценарії — мало, треба
// глибше і реалістичніше»): фрази як РЕАЛЬНО пише юзер + варіації того самого
// маршруту + негативна перевірка (емпатія НЕ плодить задачу).
//
// Ганяється workflow ai-smoke.yml — ТІЛЬКИ ручний запуск (Actions → Run workflow),
// коли NM-Claude скаже що варто. Ключ OPENAI_SMOKE_KEY (Secrets). Без ключа — skip.
//
// Принципи: асерт на СУТНІСТЬ на екрані (зʼявилась у вкладці), НЕ на текст AI
// (формулювання недетерміноване, створення сутності — так). Кожен тест незалежний
// (свій boot, чистий профіль). Live-API затримки → щедрий таймаут.

const { test, expect, boot, gotoTab } = require('./helpers');

const HAS_KEY = !!process.env.OPENAI_SMOKE_KEY;
test.skip(!HAS_KEY, 'OPENAI_SMOKE_KEY не заданий — живий AI-смоук ганяється лише у ai-smoke.yml');

test.describe('🤖 Живий AI-смоук', () => {
  test.setTimeout(90000);

  async function say(page, text) {
    await gotoTab(page, 'inbox');
    await page.locator('#inbox-input').fill(text);
    await page.locator('#ai-send-btn').click();
  }

  // === ЗАДАЧІ (реальні фрази, різні формулювання) ===
  test('«треба записатись до стоматолога» → задача', async ({ page }) => {
    const errors = await boot(page, { realAI: true });
    await say(page, 'треба записатись до стоматолога');
    await gotoTab(page, 'tasks');
    await expect(page.locator('#tasks-list').getByText(/стоматолог/i).first()).toBeVisible({ timeout: 30000 });
    expect(errors, errors.join(' | ')).toHaveLength(0);
  });

  test('«не забути забрати посилку з пошти» → задача', async ({ page }) => {
    await boot(page, { realAI: true });
    await say(page, 'не забути забрати посилку з пошти');
    await gotoTab(page, 'tasks');
    await expect(page.locator('#tasks-list').getByText(/посилк/i).first()).toBeVisible({ timeout: 30000 });
  });

  // === ФІНАНСИ (різні дієслова витрати) ===
  test('«купив каву 50» → витрата 50', async ({ page }) => {
    await boot(page, { realAI: true });
    await say(page, 'купив каву 50');
    await gotoTab(page, 'finance');
    await expect(page.locator('.tx-row').filter({ hasText: '50' }).first()).toBeVisible({ timeout: 30000 });
  });

  test('«заправив машину на 200» → витрата 200', async ({ page }) => {
    await boot(page, { realAI: true });
    await say(page, 'заправив машину на 200');
    await gotoTab(page, 'finance');
    await expect(page.locator('.tx-row').filter({ hasText: '200' }).first()).toBeVisible({ timeout: 30000 });
  });

  test('«заплатив 800 за оренду» → витрата 800', async ({ page }) => {
    await boot(page, { realAI: true });
    await say(page, 'заплатив 800 за оренду');
    await gotoTab(page, 'finance');
    await expect(page.locator('.tx-row').filter({ hasText: '800' }).first()).toBeVisible({ timeout: 30000 });
  });

  // === СПИСКИ (різні формулювання, мають дати чекліст в Inbox, НЕ задачу) ===
  test('«склади список покупок: молоко, хліб, яйця» → чекліст в Inbox', async ({ page }) => {
    await boot(page, { realAI: true });
    await say(page, 'склади список покупок: молоко, хліб, яйця');
    await expect(page.locator('#inbox-list').getByText('молоко').first()).toBeVisible({ timeout: 30000 });
    await gotoTab(page, 'tasks');
    await expect(page.locator('#tasks-list').getByText('молоко')).toHaveCount(0);
  });

  test('«треба купити: батарейки, лампочки, скотч» → чекліст в Inbox', async ({ page }) => {
    await boot(page, { realAI: true });
    await say(page, 'треба купити: батарейки, лампочки, скотч');
    await expect(page.locator('#inbox-list').getByText(/батарейк/i).first()).toBeVisible({ timeout: 30000 });
  });

  // === ЗВИЧКА (sub-вкладка Звички) ===
  test('«додай звичку пити воду щодня» → звичка у Звичках', async ({ page }) => {
    await boot(page, { realAI: true });
    await say(page, 'додай звичку пити воду щодня');
    await gotoTab(page, 'tasks');
    await page.evaluate(() => window.switchProdTab && window.switchProdTab('habits'));
    await page.waitForTimeout(400);
    await expect(page.locator('#prod-habits-list').getByText(/вод/i).first()).toBeVisible({ timeout: 30000 });
  });

  // === УТОЧНЕННЯ (одне слово → чіпи; різні слова) ===
  test('одне слово «Хімчистка» → чіпи-уточнення', async ({ page }) => {
    await boot(page, { realAI: true });
    await say(page, 'Хімчистка');
    await expect(page.locator('.owl-chip').first()).toBeVisible({ timeout: 30000 });
  });

  test('одне слово «Спортзал» → чіпи-уточнення', async ({ page }) => {
    await boot(page, { realAI: true });
    await say(page, 'Спортзал');
    await expect(page.locator('.owl-chip').first()).toBeVisible({ timeout: 30000 });
  });

  // === ЕМПАТІЯ (негативна перевірка: НЕ плодити задачу зі скарги на стан) ===
  test('«щось зовсім немає сил сьогодні» → OWL відповідає, але задачу НЕ створює', async ({ page }) => {
    await boot(page, { realAI: true });
    await say(page, 'щось зовсім немає сил сьогодні');
    // OWL має відповісти у чаті (у контейнер зʼявились бульби: юзер + реакція).
    await expect.poll(
      () => page.locator('#inbox-chat-messages > div').count(),
      { timeout: 30000 }
    ).toBeGreaterThanOrEqual(2);
    // …але НЕ перетворити скаргу на стан у задачу (головна поломка емпатії).
    await gotoTab(page, 'tasks');
    await expect(page.locator('.task-item-wrap')).toHaveCount(0);
  });
});
