// usage-meter.js — V3 Фаза 0: лічильник витрат OpenAI
//
// Мета: дати тестерам і Роману реальні дані про витрати OpenAI замість
// оцінок «приблизно $4/міс». Усі рішення про частоту Brain Pulse,
// Dynamic Tool Loading, тариф підписки мають базуватись на цифрах.
//
// Архітектура:
//   - 12 fetch-сайтів дзвонять `logUsage(module, usageObj)` після `await res.json()`.
//   - Запис у `nm_usage_log` (масив об'єктів `{ts, module, model, prompt_tokens, completion_tokens, cost_usd}`).
//   - Ротація: тримаємо лише записи last 31 день (для PWA на iOS квота ~5MB критична).
//   - `getUsageStats()` повертає агрегати: today/thisMonth/projection/byModule.
//   - `exportUsageJSON()` копіює сирий лог у буфер обміну (для порівняння Роман+друг).

const STORAGE_KEY = 'nm_usage_log';
const RETENTION_DAYS = 31;

// === PRICING ===
// Ціни OpenAI ($/1M токенів, актуально на 04.2026). Якщо зміняться — оновити тут.
// Майбутні моделі (whisper-1, tts-1, gpt-4o) додаємо коли реально почнемо використовувати.
const PRICING = {
  'gpt-4o-mini': { input: 0.150, output: 0.600 },
  'gpt-4o':      { input: 2.500, output: 10.000 },
};

function _calcCost(model, prompt_tokens, completion_tokens) {
  const p = PRICING[model] || PRICING['gpt-4o-mini'];
  const inputCost = (prompt_tokens / 1_000_000) * p.input;
  const outputCost = (completion_tokens / 1_000_000) * p.output;
  return Number((inputCost + outputCost).toFixed(6));
}

function _readLog() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function _writeLog(arr) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
  } catch (e) {
    // Квота переповнена — викидаємо half найстаріших і пробуємо ще раз
    console.warn('usage-meter: localStorage quota, trimming half', e);
    const half = arr.slice(Math.floor(arr.length / 2));
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(half)); } catch {}
  }
}

// === ROTATION ===
// Викликається при кожному записі — викидає старші за 31 день.
// Дешева операція бо log сортований за ts (записи додаються в кінець).
function _rotate(arr) {
  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  let firstFreshIdx = 0;
  while (firstFreshIdx < arr.length && arr[firstFreshIdx].ts < cutoff) firstFreshIdx++;
  return firstFreshIdx > 0 ? arr.slice(firstFreshIdx) : arr;
}

// === API ===

// logUsage — головна точка запису. Викликається з 12 fetch-сайтів.
// `module` — рядок-ідентифікатор: 'inbox', 'brain-pulse', 'tasks-bar' тощо.
// `usageObj` — поле `usage` з відповіді OpenAI: {prompt_tokens, completion_tokens, total_tokens}.
// `model` — опційно (default 'gpt-4o-mini', бо 99% викликів зараз ця модель).
export function logUsage(module, usageObj, model = 'gpt-4o-mini') {
  if (!usageObj || typeof usageObj.prompt_tokens !== 'number') return;
  const entry = {
    ts: Date.now(),
    module: module || 'unknown',
    model,
    prompt_tokens: usageObj.prompt_tokens,
    completion_tokens: usageObj.completion_tokens || 0,
    cost_usd: _calcCost(model, usageObj.prompt_tokens, usageObj.completion_tokens || 0),
  };
  const log = _rotate(_readLog());
  log.push(entry);
  _writeLog(log);
  try {
    window.dispatchEvent(new CustomEvent('nm-usage-updated', { detail: entry }));
  } catch {}
}

// getUsageStats — агрегати для UI Налаштувань.
// Повертає: {today: {cost, calls, byModule}, thisMonth: {...}, projection, totalCalls}.
export function getUsageStats() {
  const log = _readLog();
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

  const aggregate = (entries) => {
    const byModule = {};
    let cost = 0, calls = 0;
    for (const e of entries) {
      cost += e.cost_usd || 0;
      calls += 1;
      byModule[e.module] = (byModule[e.module] || 0) + (e.cost_usd || 0);
    }
    return { cost: Number(cost.toFixed(4)), calls, byModule };
  };

  const today = aggregate(log.filter(e => e.ts >= startOfToday));
  const thisMonth = aggregate(log.filter(e => e.ts >= startOfMonth));

  // Прогноз кінця місяця: лінійна екстраполяція thisMonth.cost / днів пройшло × днів у місяці.
  // При <3 днях даних прогноз ненадійний — повертаємо null.
  const dayOfMonth = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  let projection = null;
  if (dayOfMonth >= 3 && thisMonth.cost > 0) {
    projection = Number(((thisMonth.cost / dayOfMonth) * daysInMonth).toFixed(2));
  }

  return {
    today,
    thisMonth,
    projection,
    totalCalls: log.length,
    daysInLog: log.length > 0 ? Math.ceil((Date.now() - log[0].ts) / (24 * 60 * 60 * 1000)) : 0,
  };
}

// exportUsageJSON — копіює сирий лог у буфер обміну.
// Safari iOS вимагає user gesture (виклик з кнопки) — інакше тихо ламається.
export async function exportUsageJSON() {
  const log = _readLog();
  const json = JSON.stringify({
    exported_at: new Date().toISOString(),
    retention_days: RETENTION_DAYS,
    pricing: PRICING,
    entries: log,
  }, null, 2);
  try {
    await navigator.clipboard.writeText(json);
    return { ok: true, bytes: json.length, calls: log.length };
  } catch (e) {
    console.error('exportUsageJSON failed:', e);
    return { ok: false, error: e.message };
  }
}

// clearUsageLog — очищення (для дебагу/перезапуску тестування).
export function clearUsageLog() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new CustomEvent('nm-usage-updated', { detail: null }));
    return true;
  } catch {
    return false;
  }
}

// Window-exports для виклику з HTML onclick (кнопки у Налаштуваннях).
if (typeof window !== 'undefined') {
  window.exportUsageJSON = exportUsageJSON;
  window.clearUsageLog = clearUsageLog;
  window.getUsageStats = getUsageStats;
}
