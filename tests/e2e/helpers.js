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
  // opts.realAI (26yz5s 03.07, AI-смоук): ЖИВИЙ OpenAI — ключ береться з env
  // OPENAI_SMOKE_KEY (окремий, з лімітом $5/міс) і сіється у сховище ДО boot;
  // виклики до api.openai.com НЕ глушаться. Використовує ТІЛЬКИ ai-smoke.spec.js
  // через окремий workflow — звичайні E2E цей шлях не зачіпає.
  if (opts.realAI) {
    const key = process.env.OPENAI_SMOKE_KEY;
    if (!key) throw new Error('realAI: env OPENAI_SMOKE_KEY порожній — нема ключа для живого AI-смоуку');
    await page.addInitScript((k) => {
      try { localStorage.setItem('nm_gemini_key', k); } catch (e) {}
    }, key);
  } else if (opts.mockAI) {
    await mockAI(page, opts.mockAI);
  } else {
    await page.route('**/api.openai.com/**', (route) => route.abort());
  }

  // Вимикаємо онбординг ДО завантаження — інакше на чистому старті він
  // запускає вітальний слайд-тур (#slides-tour), який оверлеєм перекриває
  // кліки у модалках і валить тести (CI 15.06).
  await page.addInitScript(() => {
    try {
      localStorage.setItem('nm_onboarding_done', '1');
      // Прапор глушить і update-тур (#slides-tour), чий оверлей перехоплював
      // кліки. Ставимо завжди (навіть без seedState) — інакше golden-journey падав.
      window.__NM_TEST_SEED__ = true;
    } catch (e) {}
  });

  await page.goto('/');
  await page.waitForFunction(() => window.NM_BOOT_DONE === true, { timeout: 15000 });

  // Захисно: якщо вітальний оверлей усе ж зʼявився — прибрати, щоб не ловив кліки.
  await page.evaluate(() => {
    try { window.closeSlidesTour && window.closeSlidesTour(); } catch (e) {}
    const tour = document.getElementById('slides-tour');
    if (tour) tour.style.display = 'none';
    const ob = document.getElementById('onboarding');
    if (ob) ob.style.display = 'none';
  });
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

// Перемикає вкладку через справжню функцію переходу switchTab() — те саме, що
// викликає тап по нижній навігації. НЕ клікаємо по data-tab напряму: (1) нижня
// навігація — рухомий «барабан», далекі вкладки приховані translateX → клік падає
// по таймауту; (2) data-tab є і на прихованій кнопці допомоги поза навігацією.
// switchTab — детерміновано, незалежно від положення барабана (CI 15.06).
async function gotoTab(page, tab) {
  await page.evaluate((t) => window.switchTab(t), tab);
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
