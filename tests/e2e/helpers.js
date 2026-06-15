// tests/e2e/helpers.js — спільний фундамент E2E-тестів NeverMind.
//
// 3 ідеї, що роблять тести стабільними й готовими до Supabase (Council 15.06.2026):
//   1. seedState() підставляє стан у localStorage ДО завантаження сторінки
//      (через addInitScript) — тест завжди у відомому стані, не залежить від AI/мережі.
//      Після Supabase зміниться лише шар даних усередині — перевірки UI лишаться.
//   2. boot() за замовчуванням ГЛУШИТЬ усі виклики до api.openai.com (abort) —
//      жоден фоновий AI-запит (proactive/brain-pulse) не висить і не коштує грошей.
//      Тести AI-потоків передають { mockAI: {...} } і отримують детерміновану відповідь.
//   3. Тести дивляться на ЕКРАН (видимість, текст), а не на внутрішні функції —
//      тому міграція на Supabase їх не ламає.
//
// Supabase-шов (на майбутнє): коли boot стане async (pull з Supabase), додамо у
// boot.js перевірку прапора window.__NM_TEST_SEED__ → пропуск remote-pull. Хелпер
// уже ставить цей прапор; код-споживач додамо у Фазі 2 Supabase. Зараз — no-op.

const { test, expect } = require('@playwright/test');

const DEFAULT_TEST_USER_ID = 'test-user-e2e';

// Збирає JS-помилки сторінки — щоб assert'ити «0 падінь».
function trackPageErrors(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message || e)));
  return errors;
}

// Підставляє стан у localStorage ДО завантаження будь-якого скрипта застосунку.
// data: { tasks?, notes?, habits?, finance?, healthCards?, settings?, raw? }
//   raw — об'єкт { 'nm_ключ': значення } для будь-яких інших ключів.
async function seedState(page, data = {}) {
  await page.addInitScript((payload) => {
    try {
      // Прапор для майбутнього Supabase-boot: «дані вже підставлені, не тягни з сервера».
      window.__NM_TEST_SEED__ = true;
      const set = (k, v) => localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
      // Онбординг не плутається під ногами.
      localStorage.setItem('nm_onboarding_done', '1');
      if (payload.tasks) set('nm_tasks', payload.tasks);
      if (payload.notes) set('nm_notes', payload.notes);
      if (payload.habits) set('nm_habits2', payload.habits);
      if (payload.finance) set('nm_finance', payload.finance);
      if (payload.healthCards) set('nm_health_cards', payload.healthCards);
      if (payload.settings) set('nm_settings', payload.settings);
      if (payload.raw && typeof payload.raw === 'object') {
        for (const [k, v] of Object.entries(payload.raw)) set(k, v);
      }
    } catch (e) { /* localStorage недоступний — тест впаде далі сам */ }
  }, data);
}

// Завантажує застосунок, чекає завершення boot. Повертає трекер помилок.
// opts.mockAI: якщо задано — підміняє відповідь OpenAI замість блокування.
//   { content?: рядок, toolCalls?: масив } — мінімальний chat-completion.
async function boot(page, opts = {}) {
  const errors = trackPageErrors(page);

  // За замовчуванням глушимо OpenAI (нічого не висить, $0). Якщо тест хоче
  // підмінити AI — віддаємо детерміновану відповідь.
  if (opts.mockAI) {
    await mockAI(page, opts.mockAI);
  } else {
    await page.route('**/api.openai.com/**', (route) => route.abort());
  }

  await page.goto('/');
  await page.waitForFunction(() => window.NM_BOOT_DONE === true, { timeout: 15000 });
  return errors;
}

// Підміна OpenAI chat/completions детермінованою відповіддю (для AI-потоків).
async function mockAI(page, { content = 'Готово', toolCalls = null } = {}) {
  await page.route('**/api.openai.com/v1/chat/completions', (route) => {
    const message = toolCalls
      ? { role: 'assistant', content: null, tool_calls: toolCalls }
      : { role: 'assistant', content };
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'chatcmpl-e2e-mock',
        object: 'chat.completion',
        model: 'gpt-4o-mini',
        choices: [{ index: 0, message, finish_reason: toolCalls ? 'tool_calls' : 'stop' }],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      }),
    });
  });
}

// Перемикає вкладку через реальний клік по таб-бару.
async function gotoTab(page, tab) {
  await page.locator(`[data-tab="${tab}"]`).first().click();
  await page.waitForTimeout(250);
}

module.exports = {
  test,
  expect,
  trackPageErrors,
  seedState,
  boot,
  mockAI,
  gotoTab,
  DEFAULT_TEST_USER_ID,
};
