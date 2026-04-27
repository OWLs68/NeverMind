// ============================================================
// finance-insight.js — Інсайт дня (AI) для вкладки Фінансів
// Винесено з finance.js у рефакторингу 17.04.2026 (сесія gHCOh).
// Одна динамічна картка з AI-обраним фактом замість 3 статичних.
// ============================================================

import { escapeHtml } from '../core/utils.js';
import { getOWLPersonality } from '../ai/core.js';
import { logUsage } from '../core/usage-meter.js';
import { getCurrency, formatMoney, getFinBudget } from './finance.js';

// B-46: кеш 1 год + інвалідація по хешу даних
const FIN_INSIGHT_TTL = 60 * 60 * 1000;

function _finInsightHash(allTxs) {
  const exp = allTxs.filter(t => t.type === 'expense').reduce((s,t) => s+t.amount, 0);
  const inc = allTxs.filter(t => t.type === 'income').reduce((s,t) => s+t.amount, 0);
  const catMap = {};
  allTxs.filter(t => t.type === 'expense').forEach(t => { catMap[t.category] = (catMap[t.category] || 0) + t.amount; });
  const top = Object.entries(catMap).sort((a,b) => b[1]-a[1]).slice(0,3).map(([c,a]) => `${c}:${Math.round(a)}`).join('|');
  return `${allTxs.length}_${Math.round(exp)}_${Math.round(inc)}_${top}`;
}

// Рендер картки. period+offset — для cache-key (різні періоди мають різний інсайт).
export function finDailyInsight(allTxs, period, offset) {
  // Синхронізовано з refreshFinInsight: AI не запускається при <2 транзакціях,
  // тому картка застрягала у "OWL аналізує…" назавжди при 1 транзакції.
  if (allTxs.length < 2) return '';
  const cacheKey = `nm_fin_insight_${period}_${offset}`;
  const cached = localStorage.getItem(cacheKey);
  let text = 'OWL аналізує фінанси…';
  if (cached) { try { text = JSON.parse(cached).text || text; } catch(e) {} }
  return `<div id="fin-insight-card" style="display:flex;align-items:flex-start;gap:10px;background:rgba(255,255,255,0.72);backdrop-filter:blur(16px);border:1.5px solid rgba(255,255,255,0.75);border-radius:16px;padding:12px 14px;margin-bottom:12px">
    <div style="width:28px;height:28px;border-radius:10px;background:rgba(194,65,12,0.1);display:flex;align-items:center;justify-content:center;flex-shrink:0">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c2410c" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
    </div>
    <div style="font-size:13px;font-weight:600;color:#1e1040;line-height:1.5" id="fin-insight-text">${escapeHtml(text)}</div>
  </div>`;
}

// Async: оновлює інсайт через AI якщо кеш застарів. win = {label, from, to}.
export async function refreshFinInsight(allTxs, win, period, offset) {
  if (allTxs.length < 2) return;
  const key = localStorage.getItem('nm_gemini_key');
  if (!key) return;
  const cacheKey = `nm_fin_insight_${period}_${offset}`;
  const currentHash = _finInsightHash(allTxs);
  const cached = localStorage.getItem(cacheKey);
  if (cached) {
    try {
      const c = JSON.parse(cached);
      if (Date.now() - c.ts < FIN_INSIGHT_TTL && c.hash === currentHash) return;
    } catch(e) {}
  }

  const expenses = allTxs.filter(t => t.type === 'expense');
  const incomes = allTxs.filter(t => t.type === 'income');
  const totalExp = expenses.reduce((s, t) => s + t.amount, 0);
  const totalInc = incomes.reduce((s, t) => s + t.amount, 0);
  const catMap = {};
  expenses.forEach(t => { catMap[t.category] = (catMap[t.category] || 0) + t.amount; });
  const topCats = Object.entries(catMap).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const budget = getFinBudget();
  const currency = getCurrency();

  // B-46 + B-72: жорстке правило точності чисел, temperature 0.3
  const prompt = `${getOWLPersonality()}
Ти — фінансовий тренер. Дай ОДНУ коротку конкретну пораду з числами. 1-2 речення, українською.

🚨 ЖОРСТКЕ ПРАВИЛО ТОЧНОСТІ ЧИСЕЛ:
- Якщо використовуєш число — воно МАЄ БУТИ ТОЧНО ТАКИМ ЯК У ДАНИХ НИЖЧЕ.
- НЕ округляй, НЕ додавай, НЕ підсумовуй самостійно (юзер перевіряє арифметику).
- Якщо даєш річну проекцію: число × 12 (без округлень) — порахуй точно.
- Якщо не впевнений у числі — НЕ ПИШИ ЙОГО, дай пораду без конкретної цифри.

ЗАБОРОНЕНО:
- повторювати загальні суми які юзер бачить на екрані ("Витрати склали €X")
- загальні фрази ("стеж за витратами", "плануй бюджет", "розподіляй кошти")
- згадувати "загалом" / "в цілому" / "варто задуматись"
- вигадувати числа яких нема у даних

ОБОВ'ЯЗКОВО: конкретне число З ДАНИХ + конкретна дія або порівняння.

Шаблони (вибери НАЙРЕЛЕВАНТНІШИЙ):
1. Річна проекція: "{Категорія} ${currency}X/міс = ${currency}Y за рік" (X — з даних, Y = X × 12)
2. Відхилення: "На {категорія} {N}x більше ніж на {інша}" (обидва числа з даних)
3. Економія: "Скоротити {категорія} на ${currency}X/тиждень = ${currency}Y за рік" (Y = X × 52)
4. Перевищення ліміту: "Категорія {X} перевищила ліміт на {N%}" (обидва числа з даних)
5. Тренд: "Топ — {X} ${currency}A, наступна {Y} ${currency}B" (обидва з даних)

=== ДАНІ (${win.label}) ===
${topCats.map(([c,a]) => `- ${c}: ${formatMoney(a)}`).join('\n') || '- немає'}
Всього витрат: ${formatMoney(totalExp)}
${budget.total > 0 ? `Бюджет місяця: ${formatMoney(budget.total)} (витрачено ${Math.round(totalExp/budget.total*100)}%)` : ''}
${totalInc > 0 ? `Доходи: ${formatMoney(totalInc)} (заощаджено ${Math.round((totalInc - totalExp) / totalInc * 100)}%)` : ''}`;

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: prompt }], max_tokens: 120, temperature: 0.3 })
    });
    const data = await res.json();
    if (data?.usage) logUsage('finance-insight', data.usage, data.model);
    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text) return;
    localStorage.setItem(cacheKey, JSON.stringify({ text, ts: Date.now(), hash: currentHash }));
    const el = document.getElementById('fin-insight-text');
    if (el) el.textContent = text;
  } catch(e) {}
}
