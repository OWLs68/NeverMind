// tests/e2e/ai-smoke.spec.js — 🤖 ЖИВИЙ AI-СМОУК (реальний OpenAI, НЕ мок).
//
// Дірка яку закриває (26yz5s 03.07, ADR-004): усі E2E глушать/мокають OpenAI —
// поведінку ЖИВОГО AI (чи реально «купив каву 50» падає у Фінанси) перевіряли
// тільки руки Романа на iPhone. Цей спец ганяє 4 наскрізні сценарії з реальним
// ключем OPENAI_SMOKE_KEY (окремий, ліміт $5/міс) через workflow ai-smoke.yml —
// ручний запуск + неділя. У звичайному E2E (без ключа) — акуратно SKIPPED.
//
// Принципи:
//   - Асерти на ЕКРАН і на СУТНОСТІ (сутність зʼявилась у вкладці), НЕ на текст
//     відповіді AI — формулювання моделі недетерміноване, створення сутності — так.
//   - Сценарії підібрані максимально детерміновані: список ловить code-side
//     детектор ДО AI; bare-noun чіпи — code-side guard; задача і фінанси —
//     найнадійніші патерни промпту («купити X» / «сума+іменник»).
//   - Кожен тест незалежний (свій boot, чистий профіль) — падіння одного не
//     тягне решту; live-API затримки → щедрий таймаут.

const { test, expect, boot, gotoTab } = require('./helpers');

const HAS_KEY = !!process.env.OPENAI_SMOKE_KEY;
test.skip(!HAS_KEY, 'OPENAI_SMOKE_KEY не заданий — живий AI-смоук ганяється лише у ai-smoke.yml');

test.describe('🤖 Живий AI-смоук', () => {
  test.setTimeout(90000);

  async function sendToInbox(page, text) {
    await gotoTab(page, 'inbox');
    await page.locator('#inbox-input').fill(text);
    await page.locator('#ai-send-btn').click();
  }

  test('«купити хліб» → задача зʼявляється у Задачах', async ({ page }) => {
    const errors = await boot(page, { realAI: true });
    await sendToInbox(page, 'купити хліб');
    await gotoTab(page, 'tasks');
    await expect(page.locator('#tasks-list').getByText(/хліб/i).first()).toBeVisible({ timeout: 30000 });
    expect(errors, 'pageerror: ' + errors.join(' | ')).toHaveLength(0);
  });

  test('«купив каву 50» → операція на 50 у Фінансах', async ({ page }) => {
    const errors = await boot(page, { realAI: true });
    await sendToInbox(page, 'купив каву 50');
    await gotoTab(page, 'finance');
    await expect(page.locator('.tx-row').filter({ hasText: '50' }).first()).toBeVisible({ timeout: 30000 });
    expect(errors, 'pageerror: ' + errors.join(' | ')).toHaveLength(0);
  });

  test('«склади список покупок: молоко, хліб, яйця» → картка-чекліст у стрічці, НЕ задача', async ({ page }) => {
    const errors = await boot(page, { realAI: true });
    await sendToInbox(page, 'склади список покупок: молоко, хліб, яйця');
    await expect(page.locator('#inbox-list').getByText('молоко').first()).toBeVisible({ timeout: 30000 });
    await gotoTab(page, 'tasks');
    await expect(page.locator('#tasks-list').getByText('молоко')).toHaveCount(0);
    expect(errors, 'pageerror: ' + errors.join(' | ')).toHaveLength(0);
  });

  test('одне слово «Хімчистка» → клікабельні чіпи-уточнення', async ({ page }) => {
    const errors = await boot(page, { realAI: true });
    await sendToInbox(page, 'Хімчистка');
    await expect(page.locator('.owl-chip').first()).toBeVisible({ timeout: 30000 });
    expect(errors, 'pageerror: ' + errors.join(' | ')).toHaveLength(0);
  });
});
