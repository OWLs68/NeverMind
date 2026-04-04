// ============================================================
// app-finance.js — Фінанси — новий дизайн, транзакції, бюджет, AI coach
// Функції: renderFinance, _finHeroCard, _finForecast, _refreshFinCoach, getFinAdaptiveBenchmark, openAddTransaction, openFinBudgetModal, processFinanceAction, sendFinanceBarMessage
// Залежності: app-core.js, app-ai.js
// ============================================================

import { currentTab, showToast } from '../core/nav.js';
import { escapeHtml } from '../core/utils.js';
import { addToTrash, showUndoToast } from '../core/trash.js';
import { getAIContext, getOWLPersonality, openChatBar, safeAgentReply, saveChatMsg } from '../ai/core.js';
import { tryTabBoardUpdate } from '../owl/proactive.js';
import { getInbox, saveInbox, renderInbox, addInboxChatMsg } from './inbox.js';
import { processUniversalAction } from './habits.js';
import { setupModalSwipeClose } from './tasks.js';

// === FINANCE ===

let _financeTypingEl = null;

// Storage
export function getFinance() { return JSON.parse(localStorage.getItem('nm_finance') || '[]'); }
export function saveFinance(arr) { localStorage.setItem('nm_finance', JSON.stringify(arr)); }
export function getFinBudget() { return JSON.parse(localStorage.getItem('nm_finance_budget') || '{"total":0,"categories":{}}'); }
export function saveFinBudget(obj) { localStorage.setItem('nm_finance_budget', JSON.stringify(obj)); }
export function getFinCats() {
  const saved = JSON.parse(localStorage.getItem('nm_finance_cats') || 'null');
  if (saved) return saved;
  return {
    expense: ['Їжа','Транспорт','Підписки','Здоровʼя','Житло','Покупки','Інше'],
    income:  ['Зарплата','Надходження','Повернення','Інше'],
  };
}
export function saveFinCats(obj) { localStorage.setItem('nm_finance_cats', JSON.stringify(obj)); }

// Підкатегорії — показуються після вибору головної
const FIN_SUBCATS = {
  'Їжа':       ['Продукти','Ресторан','Кафе','Доставка','Фастфуд'],
  'Транспорт': ['Паливо','Таксі','Парковка','Громадський','Ремонт авто'],
  'Підписки':  ['Стрімінг','Музика','Хмара','Додатки','Ігри'],
  'Здоровʼя':  ['Аптека','Лікар','Спортзал','Аналізи','Косметика'],
  'Житло':     ['Оренда','Комунальні','Інтернет','Ремонт','Меблі'],
  'Покупки':   ['Одяг','Техніка','Книги','Подарунки','Дім'],
};

// State
let currentFinTab = 'expense';
let currentFinPeriod = 'month';
export function getCurrency() {
  const s = JSON.parse(localStorage.getItem('nm_settings') || '{}');
  return s.currency || '₴';
}

export function setCurrency(symbol) {
  const s = JSON.parse(localStorage.getItem('nm_settings') || '{}');
  s.currency = symbol;
  localStorage.setItem('nm_settings', JSON.stringify(s));
  ['₴','$','€'].forEach(c => {
    const map = {'₴':'uah','$':'usd','€':'eur'};
    const btn = document.getElementById('btn-currency-' + map[c]);
    if (btn) {
      if (c === symbol) btn.classList.add('active');
      else btn.classList.remove('active');
    }
  });
  if (currentTab === 'finance') renderFinance();
}

export function formatMoney(n) {
  return getCurrency() + (Math.abs(n) % 1 === 0 ? Math.abs(n) : Math.abs(n).toFixed(2));
}

// Категорії кольори
const FIN_CAT_COLORS = ['#f97316','#0ea5e9','#a855f7','#22c55e','#ef4444','#eab308','#14b8a6','#f43f5e','#6366f1','#84cc16','#fb923c','#38bdf8'];

function getFinColor(idx) { return FIN_CAT_COLORS[idx % FIN_CAT_COLORS.length]; }

// Фільтр транзакцій по періоду
export function getFinPeriodRange(period) {
  const now = new Date();
  let from;
  if (period === 'week') {
    from = new Date(now); from.setDate(now.getDate() - 6); from.setHours(0,0,0,0);
  } else if (period === 'month') {
    from = new Date(now.getFullYear(), now.getMonth(), 1);
  } else {
    from = new Date(now.getFullYear(), now.getMonth() - 2, 1);
  }
  return from.getTime();
}

function getFilteredTransactions(type, period) {
  const from = getFinPeriodRange(period);
  return getFinance().filter(t => t.type === type && t.ts >= from);
}


// Перемикачі — залишаємо для сумісності, але таб-перемикач прихований новим дизайном
function switchFinTab(tab) {
  currentFinTab = tab;
  renderFinance();
}

function setFinPeriod(period) {
  currentFinPeriod = period;
  ['week','month','3months'].forEach(p => {
    const el = document.getElementById('fin-period-' + p);
    if (!el) return;
    const active = p === period;
    el.style.borderColor = active ? '#c2410c' : 'rgba(194,65,12,0.2)';
    el.style.background = active ? 'rgba(194,65,12,0.1)' : 'rgba(194,65,12,0.05)';
    el.style.color = active ? '#c2410c' : 'rgba(30,16,64,0.5)';
  });
  renderFinance();
}

// === FINANCE v2 — новий дизайн ===

function _hideOldFinBlocks() {
  ['fin-summary-block','fin-cats-block','fin-cat-budgets-block'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  // Старий таб-перемикач Витрати/Доходи/Баланс
  const expTab = document.getElementById('fin-tab-expense');
  if (expTab && expTab.parentElement) expTab.parentElement.style.display = 'none';
  // Старий графік-блок — ховаємо тільки безпосереднього батька fin-chart, НЕ дідуся
  const chartEl = document.getElementById('fin-chart');
  if (chartEl && chartEl.parentElement) chartEl.parentElement.style.display = 'none';
  // Старий блок транзакцій
  const txEl = document.getElementById('fin-transactions');
  if (txEl && txEl.parentElement) txEl.parentElement.style.display = 'none';
  // Старий перемикач періоду
  const periodEl = document.getElementById('fin-period-week');
  if (periodEl && periodEl.parentElement) periodEl.parentElement.style.display = 'none';
}

// Адаптивний бенчмарк на основі контексту користувача
function getFinAdaptiveBenchmark() {
  const settings = JSON.parse(localStorage.getItem('nm_settings') || '{}');
  const memory = (localStorage.getItem('nm_memory') || '').toLowerCase();
  const age = parseInt(settings.age) || 0;
  const hasDebt = memory.includes('борг') || memory.includes('кредит') || memory.includes('позик');
  const from3m = getFinPeriodRange('3months');
  const recentTxs = getFinance().filter(t => t.ts >= from3m);
  const hasFewData = recentTxs.length < 5;

  let needs = 50, wants = 30, savings = 20;
  let note = 'Орієнтовний розподіл (правило 50/30/20)';

  if (hasDebt) {
    needs = 50; wants = 20; savings = 30;
    note = 'Більше на заощадження поки є борги';
  } else if (age >= 35) {
    needs = 45; wants = 25; savings = 30;
    note = 'Рекомендований розподіл для твого віку';
  } else if (age > 0 && age < 25) {
    needs = 50; wants = 30; savings = 20;
    note = 'Стандартний розподіл — ще є час нарощувати';
  }

  if (!hasFewData) {
    const incomes = recentTxs.filter(t => t.type === 'income').reduce((s,t) => s+t.amount, 0) / 3;
    const housing = recentTxs.filter(t => t.category === 'Житло').reduce((s,t) => s+t.amount, 0) / 3;
    if (incomes > 0 && housing / incomes > 0.4) {
      needs = 60; wants = 20; savings = 20;
      note = 'Скориговано — житло забирає більше звичайного';
    }
  }

  return { needs, wants, savings, note };
}

// Головний рендер
export function renderFinance() {
  _hideOldFinBlocks();

  let wrap = document.getElementById('fin-v2-wrap');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.id = 'fin-v2-wrap';
    const scroll = document.getElementById('fin-scroll');
    if (scroll) {
      scroll.insertBefore(wrap, scroll.firstChild);
    } else {
      const anchor = document.getElementById('fin-summary-block');
      if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(wrap, anchor);
    }
  }

  const from = getFinPeriodRange(currentFinPeriod);
  const allTxs = getFinance().filter(t => t.ts >= from);
  const expenses = allTxs.filter(t => t.type === 'expense');
  const incomes = allTxs.filter(t => t.type === 'income');
  const totalExp = expenses.reduce((s,t) => s+t.amount, 0);
  const totalInc = incomes.reduce((s,t) => s+t.amount, 0);
  const savedAmt = Math.max(0, totalInc - totalExp);
  const savedPct = totalInc > 0 ? Math.round(savedAmt / totalInc * 100) : 0;

  if (allTxs.length === 0) {
    wrap.innerHTML = _finEmptyState();
    return;
  }

  wrap.innerHTML =
    _finHeroCard(totalInc, totalExp, savedPct, savedAmt) +
    _finInsightCards(allTxs, totalExp, totalInc) +
    _finForecast(totalExp, totalInc) +
    _finCoachBlock() +
    _finWeekChart() +
    _finCatsBlock(expenses, totalExp) +
    _finTxsBlock(allTxs);

  _refreshFinCoach(totalExp, totalInc, expenses);
}

function _finEmptyState() {
  return `<div style="background:rgba(255,255,255,0.72);backdrop-filter:blur(16px);border:1.5px solid rgba(255,255,255,0.75);border-radius:20px;padding:28px 20px;text-align:center;margin-bottom:12px">
    <div style="width:48px;height:48px;border-radius:16px;background:rgba(194,65,12,0.1);display:flex;align-items:center;justify-content:center;margin:0 auto 12px">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#c2410c" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 6v2m0 8v2M9.5 9.5A2.5 2.5 0 0 1 12 8h.5a2.5 2.5 0 0 1 0 5h-1a2.5 2.5 0 0 0 0 5H12a2.5 2.5 0 0 0 2.5-1.5"/></svg>
    </div>
    <div style="font-size:16px;font-weight:800;color:#1e1040;margin-bottom:6px">Поки порожньо</div>
    <div style="font-size:14px;color:rgba(30,16,64,0.45);line-height:1.5;margin-bottom:16px">Додай перші транзакції через Inbox або кнопку нижче</div>
    <button onclick="openAddTransaction()" style="background:linear-gradient(135deg,#f97316,#c2410c);color:white;border:none;border-radius:14px;padding:12px 24px;font-size:15px;font-weight:700;cursor:pointer;font-family:inherit">+ Додати транзакцію</button>
  </div>`;
}

function _finHeroCard(totalInc, totalExp, savedPct, savedAmt) {
  const budget = getFinBudget();
  const periodLabels = { week: 'за тиждень', month: 'цього місяця', '3months': 'за 3 місяці' };
  const periodLbl = periodLabels[currentFinPeriod] || 'за період';

  // Тренд vs попередній аналогічний період
  let trendHtml = '';
  try {
    const periodMs = { week: 7*24*60*60*1000, month: 30*24*60*60*1000, '3months': 90*24*60*60*1000 };
    const pMs = periodMs[currentFinPeriod] || periodMs.month;
    const prevFrom = Date.now() - pMs * 2;
    const prevTo = Date.now() - pMs;
    const prevTxs = getFinance().filter(t => t.ts >= prevFrom && t.ts < prevTo);
    const prevExp = prevTxs.filter(t => t.type === 'expense').reduce((s,t) => s+t.amount, 0);
    const prevInc = prevTxs.filter(t => t.type === 'income').reduce((s,t) => s+t.amount, 0);
    const prevSaved = prevInc > 0 ? Math.round((prevInc - prevExp) / prevInc * 100) : null;
    if (prevSaved !== null) {
      const diff = savedPct - prevSaved;
      const col = diff >= 0 ? '#16a34a' : '#c2410c';
      const bg = diff >= 0 ? 'rgba(22,163,74,0.1)' : 'rgba(194,65,12,0.08)';
      const arrowPts = diff >= 0 ? '18 15 12 9 6 15' : '6 9 12 15 18 9';
      trendHtml = `<div style="display:inline-flex;align-items:center;gap:4px;background:${bg};border-radius:20px;padding:4px 10px;margin-bottom:14px">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="${col}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="${arrowPts}"/></svg>
        <span style="font-size:12px;font-weight:700;color:${col}">${diff>=0?'+':''}${diff}% vs минулий період</span>
      </div>`;
    }
  } catch(e) {}

  // Прогрес-бар бюджету
  let budgetHtml = '';
  if (budget.total > 0) {
    const pct = Math.min(100, Math.round(totalExp / budget.total * 100));
    const remain = budget.total - totalExp;
    const barCol = pct >= 100 ? '#dc2626' : pct >= 80 ? '#f97316' : '#c2410c';
    budgetHtml = `<div style="margin-top:14px">
      <div style="height:5px;background:rgba(30,16,64,0.06);border-radius:6px;overflow:hidden;margin-bottom:5px">
        <div style="height:100%;width:${pct}%;background:linear-gradient(90deg,#f97316,${barCol});border-radius:6px;transition:width 0.5s"></div>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:11px;color:rgba(30,16,64,0.4);font-weight:600">
        <span>${getCurrency()}0</span>
        <span>${pct}% бюджету · ${remain >= 0 ? 'залишилось ' + formatMoney(remain) : 'перевищено на ' + formatMoney(-remain)}</span>
        <span>${formatMoney(budget.total)}</span>
      </div>
    </div>`;
  }

  const savedCol = savedPct >= 20 ? '#16a34a' : savedPct >= 10 ? '#d97706' : '#c2410c';
  return `<div style="background:rgba(255,255,255,0.72);backdrop-filter:blur(16px);border:1.5px solid rgba(255,255,255,0.75);border-radius:24px;padding:18px;margin-bottom:12px">
    <div style="font-size:11px;font-weight:800;color:rgba(30,16,64,0.4);text-transform:uppercase;letter-spacing:0.07em;margin-bottom:4px">Фінансовий результат</div>
    <div style="font-size:44px;font-weight:900;line-height:1;margin-bottom:4px;background:linear-gradient(135deg,#c2410c,#f97316);-webkit-background-clip:text;-webkit-text-fill-color:transparent">${savedPct}%</div>
    <div style="font-size:13px;color:rgba(30,16,64,0.45);font-weight:500;margin-bottom:12px">доходу збережено ${periodLbl}</div>
    ${trendHtml}
    <div style="display:flex;border-top:1px solid rgba(30,16,64,0.06);padding-top:12px">
      <div style="flex:1;text-align:center;border-right:1px solid rgba(30,16,64,0.06)">
        <div style="font-size:15px;font-weight:800;color:#16a34a">+${formatMoney(totalInc)}</div>
        <div style="font-size:11px;color:rgba(30,16,64,0.4);font-weight:600;margin-top:2px">прийшло</div>
      </div>
      <div style="flex:1;text-align:center;border-right:1px solid rgba(30,16,64,0.06)">
        <div style="font-size:15px;font-weight:800;color:#c2410c">-${formatMoney(totalExp)}</div>
        <div style="font-size:11px;color:rgba(30,16,64,0.4);font-weight:600;margin-top:2px">пішло</div>
      </div>
      <div style="flex:1;text-align:center">
        <div style="font-size:15px;font-weight:800;color:${savedCol}">${formatMoney(savedAmt)}</div>
        <div style="font-size:11px;color:rgba(30,16,64,0.4);font-weight:600;margin-top:2px">залишилось</div>
      </div>
    </div>
    ${budgetHtml}
  </div>`;
}

function _finInsightCards(allTxs, totalExp, totalInc) {
  // Картка 1: зміна витрат vs попередній період
  let expChangePct = null;
  try {
    const periodMs = { week: 7*24*60*60*1000, month: 30*24*60*60*1000, '3months': 90*24*60*60*1000 };
    const pMs = periodMs[currentFinPeriod] || periodMs.month;
    const prevFrom = Date.now() - pMs * 2;
    const prevTo = Date.now() - pMs;
    const prevExp = getFinance().filter(t => t.ts >= prevFrom && t.ts < prevTo && t.type === 'expense').reduce((s,t) => s+t.amount, 0);
    if (prevExp > 0 && totalExp > 0) expChangePct = Math.round((totalExp - prevExp) / prevExp * 100);
  } catch(e) {}

  const c1col = expChangePct !== null ? (expChangePct <= 0 ? '#16a34a' : '#c2410c') : 'rgba(30,16,64,0.4)';
  const c1bg = expChangePct !== null ? (expChangePct <= 0 ? 'rgba(22,163,74,0.1)' : 'rgba(194,65,12,0.1)') : 'rgba(30,16,64,0.06)';
  const c1pts = expChangePct !== null && expChangePct <= 0 ? '22 17 13 8 8 13 2 7' : '2 17 13 8 8 13 22 7';
  const c1v = expChangePct !== null ? `${expChangePct > 0 ? '+' : ''}${expChangePct}%` : '—';

  // Картка 2: % заощаджень
  const savedPct = totalInc > 0 ? Math.round((totalInc - totalExp) / totalInc * 100) : 0;
  const c2col = savedPct >= 20 ? '#16a34a' : savedPct >= 10 ? '#d97706' : '#c2410c';
  const c2bg = savedPct >= 20 ? 'rgba(22,163,74,0.1)' : savedPct >= 10 ? 'rgba(217,119,6,0.1)' : 'rgba(194,65,12,0.1)';

  // Картка 3: середні витрати на день
  const daysPassed = currentFinPeriod === 'week' ? 7 : currentFinPeriod === 'month' ? new Date().getDate() : 90;
  const avgDay = daysPassed > 0 ? Math.round(totalExp / daysPassed) : 0;
  const budget = getFinBudget();
  const daysInPeriod = currentFinPeriod === 'week' ? 7 : currentFinPeriod === 'month' ? 30 : 90;
  const normDay = budget.total > 0 ? Math.round(budget.total / daysInPeriod) : 0;

  const card = (iconSvg, iconBg, val, valCol, lbl) =>
    `<div style="flex:1;background:rgba(255,255,255,0.72);backdrop-filter:blur(16px);border:1.5px solid rgba(255,255,255,0.75);border-radius:16px;padding:12px 8px;text-align:center">
      <div style="width:28px;height:28px;border-radius:9px;background:${iconBg};display:flex;align-items:center;justify-content:center;margin:0 auto 6px">${iconSvg}</div>
      <div style="font-size:15px;font-weight:900;color:${valCol};margin-bottom:3px">${val}</div>
      <div style="font-size:10px;font-weight:700;color:rgba(30,16,64,0.4);line-height:1.3">${lbl}</div>
    </div>`;

  return `<div style="display:flex;gap:8px;margin-bottom:12px">
    ${card(`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${c1col}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="${c1pts}"/><polyline points="${expChangePct !== null && expChangePct <= 0 ? '16 17 22 17 22 11' : '16 7 22 7 22 13'}"/></svg>`, c1bg, c1v, c1col, 'витрати<br>vs минулий')}
    ${card(`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${c2col}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 6v2m0 8v2M9.5 9.5A2.5 2.5 0 0 1 12 8h.5a2.5 2.5 0 0 1 0 5h-1a2.5 2.5 0 0 0 0 5H12a2.5 2.5 0 0 0 2.5-1.5"/></svg>`, c2bg, savedPct + '%', c2col, 'заощаджень<br>від доходу')}
    ${card('<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>', 'rgba(99,102,241,0.1)', formatMoney(avgDay), '#6366f1', normDay > 0 ? 'в день<br>норма ' + formatMoney(normDay) : 'в день<br>середнє')}
  </div>`;
}

function _finForecast(totalExp, totalInc) {
  if (currentFinPeriod !== 'month') return '';
  const now = new Date();
  const daysPassed = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth()+1, 0).getDate();
  const daysLeft = daysInMonth - daysPassed;
  if (daysPassed < 5) return '';
  if (totalExp === 0) return '';

  const rate = totalExp / daysPassed;
  const proj  = Math.round(totalExp + rate * daysLeft);
  const proj2 = Math.round(totalExp + rate * 0.75 * daysLeft);
  const proj3 = Math.round(totalExp + rate * 0.55 * daysLeft);

  const budget = getFinBudget();

  // Немає ні доходу ні бюджету — показуємо підказку
  if (totalInc === 0 && budget.total === 0) {
    return `<div style="background:rgba(255,255,255,0.72);border:1.5px solid rgba(255,255,255,0.75);border-radius:20px;padding:13px 16px;margin-bottom:12px">
      <div style="font-size:11px;font-weight:800;color:rgba(30,16,64,0.4);text-transform:uppercase;letter-spacing:0.07em;margin-bottom:8px">Прогноз</div>
      <div style="font-size:13px;color:rgba(30,16,64,0.5);font-weight:600">Додай дохід або встанови бюджет — OWL порахує скільки залишиться</div>
    </div>`;
  }

  // Є дохід — показуємо залишок
  const showBalance = totalInc > 0;

  // Попередження
  let warnHtml = '';
  if (budget.total > 0 && proj > budget.total) {
    warnHtml = `<div style="display:flex;align-items:flex-start;gap:6px;background:rgba(249,115,22,0.08);border:1px solid rgba(249,115,22,0.2);border-radius:10px;padding:9px 10px;margin-top:10px">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#c2410c" stroke-width="2.5" stroke-linecap="round" style="flex-shrink:0;margin-top:1px"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
      <span style="font-size:12px;color:#c2410c;font-weight:600;line-height:1.4">При поточному темпі перевищиш бюджет на ${formatMoney(proj - budget.total)}</span>
    </div>`;
  } else if (showBalance && Math.max(0, totalInc - proj) < totalInc * 0.1) {
    warnHtml = `<div style="display:flex;align-items:flex-start;gap:6px;background:rgba(249,115,22,0.08);border:1px solid rgba(249,115,22,0.2);border-radius:10px;padding:9px 10px;margin-top:10px">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#c2410c" stroke-width="2.5" stroke-linecap="round" style="flex-shrink:0;margin-top:1px"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
      <span style="font-size:12px;color:#c2410c;font-weight:600;line-height:1.4">При поточному темпі залишишся з ${formatMoney(Math.max(0, totalInc - proj))} — менше фінансової подушки</span>
    </div>`;
  }

  const sc = (iconSvg, iconBg, val, valCol, lbl, good = false) =>
    `<div style="flex:1;border-radius:12px;padding:10px 8px;text-align:center;background:${good ? 'rgba(22,163,74,0.06)' : 'rgba(30,16,64,0.03)'};border:1px solid ${good ? 'rgba(22,163,74,0.2)' : 'rgba(30,16,64,0.06)'}">
      <div style="width:28px;height:28px;border-radius:8px;background:${iconBg};display:flex;align-items:center;justify-content:center;margin:0 auto 5px">${iconSvg}</div>
      <div style="font-size:13px;font-weight:800;color:${valCol};margin-bottom:2px">${val}</div>
      <div style="font-size:10px;font-weight:600;color:rgba(30,16,64,0.4);line-height:1.3">${lbl}</div>
    </div>`;

  if (showBalance) {
    // З доходом — показуємо залишок
    const v1 = formatMoney(Math.max(0, totalInc - proj));
    const v2 = formatMoney(Math.max(0, totalInc - proj2));
    const v3 = formatMoney(Math.max(0, totalInc - proj3));
    return `<div style="background:rgba(255,255,255,0.72);backdrop-filter:blur(16px);border:1.5px solid rgba(255,255,255,0.75);border-radius:20px;padding:14px 16px;margin-bottom:12px">
      <div style="font-size:11px;font-weight:800;color:rgba(30,16,64,0.4);text-transform:uppercase;letter-spacing:0.07em;margin-bottom:12px">Прогноз · залишок до кінця місяця</div>
      <div style="display:flex;gap:6px">
        ${sc('<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(30,16,64,0.45)" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>', 'rgba(30,16,64,0.06)', v1, '#1e1040', 'зараз')}
        ${sc('<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(30,16,64,0.45)" stroke-width="2.5" stroke-linecap="round"><circle cx="6" cy="6" r="3"/><circle cx="18" cy="18" r="3"/><line x1="20" y1="4" x2="4" y2="20"/></svg>', 'rgba(30,16,64,0.06)', v2, '#d97706', '-25% витрат')}
        ${sc('<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>', 'rgba(22,163,74,0.1)', v3, '#16a34a', 'оптимально', true)}
      </div>
      ${warnHtml}
    </div>`;
  } else {
    // Тільки бюджет — показуємо прогноз витрат відносно бюджету
    const budgetTotal = budget.total;
    const v1 = formatMoney(proj);
    const pctOfBudget = Math.round(proj / budgetTotal * 100);
    const overColor = proj > budgetTotal ? '#c2410c' : '#16a34a';
    return `<div style="background:rgba(255,255,255,0.72);backdrop-filter:blur(16px);border:1.5px solid rgba(255,255,255,0.75);border-radius:20px;padding:14px 16px;margin-bottom:12px">
      <div style="font-size:11px;font-weight:800;color:rgba(30,16,64,0.4);text-transform:uppercase;letter-spacing:0.07em;margin-bottom:10px">Прогноз витрат на місяць</div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <div>
          <div style="font-size:22px;font-weight:900;color:${overColor}">${v1}</div>
          <div style="font-size:11px;color:rgba(30,16,64,0.4);font-weight:600;margin-top:2px">при поточному темпі · бюджет ${formatMoney(budgetTotal)}</div>
        </div>
        <div style="font-size:28px;font-weight:900;color:${overColor}">${pctOfBudget}%</div>
      </div>
      <div style="height:5px;background:rgba(30,16,64,0.07);border-radius:3px;overflow:hidden">
        <div style="height:100%;width:${Math.min(pctOfBudget,100)}%;background:${overColor};border-radius:3px;transition:width 0.5s"></div>
      </div>
      ${warnHtml}
    </div>`;
  }
}

function _finCoachBlock() {
  const cached = localStorage.getItem('nm_fin_coach_' + currentFinPeriod);
  let coachText = 'OWL аналізує твої витрати…';
  if (cached) { try { coachText = JSON.parse(cached).text || coachText; } catch(e) {} }
  return `<div id="fin-coach-block" style="background:rgba(12,6,28,0.78);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border:1px solid rgba(255,255,255,0.08);border-radius:18px;padding:13px 15px;margin-bottom:12px">
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px">
      <div style="width:6px;height:6px;border-radius:50%;background:#fbbf24;flex-shrink:0"></div>
      <div style="font-size:10px;font-weight:800;color:rgba(255,255,255,0.35);text-transform:uppercase;letter-spacing:0.1em">OWL · порада</div>
    </div>
    <div id="fin-coach-text" style="font-size:13px;font-weight:600;color:white;line-height:1.6">${escapeHtml(coachText)}</div>
  </div>`;
}

async function _refreshFinCoach(totalExp, totalInc, expenses) {
  const key = localStorage.getItem('nm_gemini_key');
  if (!key) return;
  const cacheKey = 'nm_fin_coach_' + currentFinPeriod;
  const cached = localStorage.getItem(cacheKey);
  if (cached) {
    try { if (Date.now() - JSON.parse(cached).ts < 24*60*60*1000) return; } catch(e) {}
  }
  const catMap = {};
  expenses.forEach(t => { catMap[t.category] = (catMap[t.category] || 0) + t.amount; });
  const top3 = Object.entries(catMap).sort((a,b) => b[1]-a[1]).slice(0,3).map(([c,a]) => `${c}: ${formatMoney(a)}`).join(', ');
  const savedPct = totalInc > 0 ? Math.round((totalInc - totalExp) / totalInc * 100) : 0;
  const aiContext = getAIContext();
  const prompt = `${getOWLPersonality()}

Дай ОДНУ конкретну фінансову пораду. ОБОВ'ЯЗКОВО з реальними числами з даних нижче.
Формат: "Бачу: [факт з числами]. Означає: [що це значить]. Зробити: [конкретна дія і результат в числах]."
Максимум 3 речення. Тільки українською.

Дані: витрати ${formatMoney(totalExp)}, доходи ${formatMoney(totalInc)}, заощаджено ${savedPct}%.
Топ категорії: ${top3 || 'немає даних'}.${aiContext ? '\n\n' + aiContext : ''}`;

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: prompt }], max_tokens: 130, temperature: 0.6 })
    });
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text) return;
    localStorage.setItem(cacheKey, JSON.stringify({ text, ts: Date.now() }));
    const el = document.getElementById('fin-coach-text');
    if (el) el.textContent = text;
  } catch(e) {}
}

function _finWeekChart() {
  // Завжди показуємо поточний тиждень Пн–Нд
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Нд, 1=Пн, ...
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);

  const DAY_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];
  const allTxs = getFinance();
  const groups = DAY_LABELS.map((label, i) => {
    const d = new Date(monday); d.setDate(monday.getDate() + i);
    const nextD = new Date(d); nextD.setDate(d.getDate() + 1);
    const from = d.getTime(), to = nextD.getTime();
    return {
      label,
      isToday: d.toDateString() === now.toDateString(),
      isFuture: d > now,
      exp: allTxs.filter(t => t.type === 'expense' && t.ts >= from && t.ts < to).reduce((s,t) => s+t.amount, 0),
      inc: allTxs.filter(t => t.type === 'income'  && t.ts >= from && t.ts < to).reduce((s,t) => s+t.amount, 0),
    };
  });

  const maxVal = Math.max(1, ...groups.map(g => Math.max(g.exp, g.inc)));
  const bars = groups.map(g => {
    const expH = g.exp > 0 ? Math.max(4, Math.round(g.exp / maxVal * 52)) : 0;
    const incH = g.inc > 0 ? Math.max(4, Math.round(g.inc / maxVal * 52)) : 0;
    const opacity = g.isFuture ? '0.25' : '1';
    const labelCol = g.isToday ? '#c2410c' : 'rgba(30,16,64,0.35)';
    const labelW = g.isToday ? '700' : '600';
    return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:0">
      <div style="flex:1;width:100%;display:flex;gap:2px;align-items:flex-end">
        <div style="flex:1;height:${expH}px;background:#f97316;border-radius:3px 3px 0 0;opacity:${opacity}${g.exp===0?';visibility:hidden':''}"></div>
        <div style="flex:1;height:${incH}px;background:#16a34a;border-radius:3px 3px 0 0;opacity:${opacity}${g.inc===0?';visibility:hidden':''}"></div>
      </div>
      <div style="font-size:10px;font-weight:${labelW};color:${labelCol};margin-top:4px;letter-spacing:0.01em">${g.label}</div>
    </div>`;
  }).join('');

  return `<div style="background:rgba(255,255,255,0.72);backdrop-filter:blur(16px);border:1.5px solid rgba(255,255,255,0.75);border-radius:20px;padding:14px 16px;margin-bottom:12px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
      <div style="font-size:11px;font-weight:800;color:rgba(30,16,64,0.4);text-transform:uppercase;letter-spacing:0.07em">За тиждень</div>
      <div style="display:flex;gap:10px">
        <div style="display:flex;align-items:center;gap:4px"><div style="width:8px;height:8px;border-radius:50%;background:#f97316"></div><span style="font-size:11px;font-weight:700;color:rgba(30,16,64,0.4)">Витрати</span></div>
        <div style="display:flex;align-items:center;gap:4px"><div style="width:8px;height:8px;border-radius:50%;background:#16a34a"></div><span style="font-size:11px;font-weight:700;color:rgba(30,16,64,0.4)">Доходи</span></div>
      </div>
    </div>
    <div style="display:flex;gap:4px;align-items:flex-end;height:72px">${bars}</div>
  </div>`;
}

function _finCatsBlock(expenses, totalExp) {
  if (expenses.length === 0) return '';
  const benchmark = getFinAdaptiveBenchmark();
  const catMap = {};
  expenses.forEach(t => { catMap[t.category] = (catMap[t.category] || 0) + t.amount; });
  const sorted = Object.entries(catMap).sort((a,b) => b[1]-a[1]);
  const maxAmt = sorted[0]?.[1] || 1;
  const budget = getFinBudget();

  const rows = sorted.map(([cat, amt]) => {
    const barPct = Math.round(amt / maxAmt * 100);
    const catLimit = budget.categories?.[cat];
    let dotCol = 'rgba(30,16,64,0.25)';
    if (catLimit > 0) {
      const r = amt / catLimit;
      dotCol = r >= 1 ? '#ef4444' : r >= 0.8 ? '#f59e0b' : '#16a34a';
    }
    return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
      <div style="width:8px;height:8px;border-radius:50%;background:${dotCol};flex-shrink:0"></div>
      <div style="font-size:13px;font-weight:700;color:rgba(30,16,64,0.65);min-width:72px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(cat)}</div>
      <div style="flex:1;height:5px;background:rgba(30,16,64,0.06);border-radius:3px;overflow:hidden">
        <div style="height:100%;width:${barPct}%;background:${dotCol};border-radius:3px;transition:width 0.5s"></div>
      </div>
      <div style="font-size:12px;font-weight:700;color:rgba(30,16,64,0.5);min-width:52px;text-align:right">${formatMoney(amt)}</div>
    </div>`;
  }).join('');

  return `<div style="background:rgba(255,255,255,0.72);backdrop-filter:blur(16px);border:1.5px solid rgba(255,255,255,0.75);border-radius:20px;padding:14px 16px;margin-bottom:12px">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
      <div style="font-size:11px;font-weight:800;color:rgba(30,16,64,0.4);text-transform:uppercase;letter-spacing:0.07em">Категорії витрат</div>
      <button onclick="openFinBudgetModal()" style="font-size:12px;font-weight:700;color:#c2410c;background:rgba(194,65,12,0.08);border:none;border-radius:8px;padding:4px 10px;cursor:pointer;font-family:inherit">Ліміти ✎</button>
    </div>
    ${rows}
    <div style="padding-top:8px;border-top:1px solid rgba(30,16,64,0.06);font-size:11px;color:rgba(30,16,64,0.35);font-weight:600">${benchmark.note}</div>
  </div>`;
}

function _finTxsBlock(allTxs) {
  const sorted = [...allTxs].sort((a,b) => b.ts-a.ts).slice(0, 8);
  const rows = sorted.map(t => {
    const isExp = t.type === 'expense';
    const dateStr = new Date(t.ts).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' });
    return `<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid rgba(30,16,64,0.05);cursor:pointer" onclick="openEditTransaction(${t.id})">
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:700;color:#1e1040">${escapeHtml(t.category)}</div>
        ${t.comment ? `<div style="font-size:11px;color:rgba(30,16,64,0.4);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(t.comment)}</div>` : ''}
      </div>
      <div style="text-align:right;flex-shrink:0">
        <div style="font-size:14px;font-weight:800;color:${isExp?'#c2410c':'#16a34a'}">${isExp?'-':'+'}${formatMoney(t.amount)}</div>
        <div style="font-size:10px;color:rgba(30,16,64,0.35)">${dateStr}</div>
      </div>
    </div>`;
  }).join('');

  const moreBtn = allTxs.length > 8
    ? `<div onclick="openAllTransactions()" style="text-align:center;margin-top:10px;font-size:13px;font-weight:700;color:#c2410c;cursor:pointer">Всі транзакції (${allTxs.length}) <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#c2410c" stroke-width="2.5" stroke-linecap="round" style="vertical-align:middle"><polyline points="9 18 15 12 9 6"/></svg></div>`
    : '';

  return `<div style="background:rgba(255,255,255,0.72);backdrop-filter:blur(16px);border:1.5px solid rgba(255,255,255,0.75);border-radius:20px;padding:14px 16px;margin-bottom:12px">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
      <div style="font-size:11px;font-weight:800;color:rgba(30,16,64,0.4);text-transform:uppercase;letter-spacing:0.07em">Останні транзакції</div>
      <button onclick="openAddTransaction()" style="background:rgba(194,65,12,0.08);border:none;border-radius:8px;padding:4px 10px;font-size:12px;font-weight:700;color:#c2410c;cursor:pointer;font-family:inherit">+ додати</button>
    </div>
    ${rows || '<div style="font-size:13px;color:rgba(30,16,64,0.3);text-align:center;padding:8px">Немає транзакцій за цей період</div>'}
    ${moreBtn}
  </div>`;
}

function openAllTransactions() {
  const from = getFinPeriodRange(currentFinPeriod);
  const allTxs = getFinance().filter(t => t.ts >= from).sort((a,b) => b.ts-a.ts);
  const existing = document.getElementById('fin-all-txs-modal');
  if (existing) existing.remove();
  const modal = document.createElement('div');
  modal.id = 'fin-all-txs-modal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:500;display:flex;align-items:flex-end;justify-content:center';
  const rows = allTxs.map(t => {
    const isExp = t.type === 'expense';
    const dateStr = new Date(t.ts).toLocaleDateString('uk-UA', { day:'numeric', month:'short' });
    return `<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid rgba(30,16,64,0.05);cursor:pointer" onclick="document.getElementById('fin-all-txs-modal').remove();openEditTransaction(${t.id})">
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:700;color:#1e1040">${escapeHtml(t.category)}</div>
        ${t.comment ? `<div style="font-size:11px;color:rgba(30,16,64,0.4)">${escapeHtml(t.comment)}</div>` : ''}
      </div>
      <div style="text-align:right;flex-shrink:0">
        <div style="font-size:14px;font-weight:800;color:${isExp?'#c2410c':'#16a34a'}">${isExp?'-':'+'}${formatMoney(t.amount)}</div>
        <div style="font-size:10px;color:rgba(30,16,64,0.35)">${dateStr}</div>
      </div>
    </div>`;
  }).join('');
  modal.innerHTML = `
    <div onclick="document.getElementById('fin-all-txs-modal').remove()" style="position:absolute;inset:0;background:rgba(10,5,30,0.35);backdrop-filter:blur(2px)"></div>
    <div style="position:relative;width:100%;max-width:480px;background:rgba(255,255,255,0.95);backdrop-filter:blur(24px);border-radius:24px;margin:0 16px 16px;z-index:1;padding:16px 16px calc(env(safe-area-inset-bottom)+16px);max-height:80vh;overflow-y:auto;box-sizing:border-box">
      <div style="width:36px;height:4px;background:rgba(0,0,0,0.1);border-radius:2px;margin:0 auto 14px"></div>
      <div style="font-size:16px;font-weight:800;color:#1e1040;margin-bottom:12px">Всі транзакції (${allTxs.length})</div>
      ${rows || '<div style="font-size:14px;color:rgba(30,16,64,0.3);text-align:center;padding:16px">Немає транзакцій</div>'}
    </div>`;
  document.body.appendChild(modal);
}

// Додавання транзакції вручну
let _finEditId = null;

function openAddTransaction(prefill = {}) {
  _finEditId = null;
  const cats = getFinCats();
  const type = prefill.type || (currentFinTab === 'income' ? 'income' : 'expense');
  _showTransactionModal({ type, amount: prefill.amount || '', category: prefill.category || '', comment: prefill.comment || '' });
}

function openEditTransaction(id) {
  const txs = getFinance();
  const t = txs.find(x => x.id === id);
  if (!t) return;
  _finEditId = id;
  _showTransactionModal(t);
}

function _showTransactionModal(data) {
  const cats = getFinCats();
  const isExpense = data.type !== 'income';
  const catList = isExpense ? cats.expense : cats.income;

  const existing = document.getElementById('fin-tx-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'fin-tx-modal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:500;display:flex;align-items:flex-end;justify-content:center';
  modal.innerHTML = `
    <div onclick="closeFinTxModal()" style="position:absolute;inset:0;background:rgba(10,5,30,0.35);backdrop-filter:blur(2px)"></div>
    <div style="position:relative;width:100%;max-width:480px;background:rgba(255,255,255,0.88);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);border-radius:24px;margin:0 16px 16px;z-index:1;border:1.5px solid rgba(255,255,255,0.6);padding:16px 20px calc(env(safe-area-inset-bottom)+24px);box-sizing:border-box">
      <div style="width:36px;height:4px;background:rgba(0,0,0,0.1);border-radius:2px;margin:0 auto 14px"></div>
      <div style="font-size:17px;font-weight:800;color:#1e1040;margin-bottom:14px">${_finEditId ? 'Редагувати' : 'Нова'} ${isExpense ? 'витрата' : 'дохід'}</div>

      <!-- Тип -->
      <div style="display:flex;gap:6px;margin-bottom:12px">
        <button id="fntx-btn-expense" onclick="toggleFinTxType('expense')" style="flex:1;padding:8px;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;border:1.5px solid ${isExpense ? '#c2410c' : 'rgba(30,16,64,0.1)'};background:${isExpense ? 'rgba(194,65,12,0.08)' : 'white'};color:${isExpense ? '#c2410c' : 'rgba(30,16,64,0.4)'}">Витрата</button>
        <button id="fntx-btn-income" onclick="toggleFinTxType('income')" style="flex:1;padding:8px;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;border:1.5px solid ${!isExpense ? '#16a34a' : 'rgba(30,16,64,0.1)'};background:${!isExpense ? 'rgba(22,163,74,0.08)' : 'white'};color:${!isExpense ? '#16a34a' : 'rgba(30,16,64,0.4)'}">Дохід</button>
      </div>

      <!-- Сума -->
      <input id="fntx-amount" type="number" placeholder="Сума (€)" inputmode="decimal"
        style="width:100%;border:1.5px solid rgba(30,16,64,0.12);border-radius:12px;padding:12px 14px;font-size:20px;font-weight:700;font-family:inherit;color:#1e1040;outline:none;margin-bottom:10px;box-sizing:border-box"
        value="${data.amount || ''}">

      <!-- Категорія -->
      <div id="fntx-cats-wrap" style="margin-bottom:10px">
        <div style="font-size:12px;font-weight:700;color:rgba(30,16,64,0.4);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px">Категорія</div>
        <div id="fntx-cats" style="display:flex;flex-wrap:wrap;gap:6px">
          ${catList.map(c => `<button onclick="selectFinTxCat('${escapeHtml(c)}')" id="fntx-cat-${escapeHtml(c)}" style="padding:6px 12px;border-radius:20px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;border:1.5px solid ${c === data.category ? '#c2410c' : 'rgba(30,16,64,0.1)'};background:${c === data.category ? 'rgba(194,65,12,0.08)' : 'white'};color:${c === data.category ? '#c2410c' : 'rgba(30,16,64,0.5)'}">${escapeHtml(c)}</button>`).join('')}
        </div>
        <input id="fntx-cat-custom" type="text" placeholder="або своя категорія…"
          style="width:100%;border:1.5px solid rgba(30,16,64,0.1);border-radius:10px;padding:8px 12px;font-size:14px;font-family:inherit;color:#1e1040;outline:none;margin-top:8px;box-sizing:border-box"
          value="${catList.includes(data.category) ? '' : (data.category || '')}">
      </div>

      <!-- Коментар -->
      <input id="fntx-comment" type="text" placeholder="Коментар (необовʼязково)"
        style="width:100%;border:1.5px solid rgba(30,16,64,0.1);border-radius:12px;padding:10px 14px;font-size:15px;font-family:inherit;color:#1e1040;outline:none;margin-bottom:14px;box-sizing:border-box"
        value="${data.comment || ''}">

      <div style="display:flex;gap:8px">
        ${_finEditId ? `<button onclick="deleteFinTransaction()" style="padding:13px 16px;border-radius:12px;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);font-size:15px;font-weight:700;color:#dc2626;cursor:pointer;font-family:inherit">🗑</button>` : ''}
        <button onclick="closeFinTxModal()" style="flex:1;padding:13px;border-radius:12px;background:rgba(30,16,64,0.06);border:none;font-size:15px;font-weight:700;color:rgba(30,16,64,0.5);cursor:pointer;font-family:inherit">Скасувати</button>
        <button onclick="saveFinTransaction()" style="flex:2;padding:13px;border-radius:12px;background:linear-gradient(135deg,#f97316,#c2410c);border:none;font-size:15px;font-weight:700;color:white;cursor:pointer;font-family:inherit">Зберегти</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  setupModalSwipeClose(modal.querySelector('div:last-child'), closeFinTxModal);
  // Якщо категорія вже вибрана — показуємо підкатегорії
  if (data.category && catList.includes(data.category)) {
    setTimeout(() => selectFinTxCat(data.category), 50);
  }
  setTimeout(() => { document.getElementById('fntx-amount')?.focus(); }, 300);
  _finTxCurrentType = isExpense ? 'expense' : 'income';
  _finTxSelectedCat = data.category || '';
}

let _finTxCurrentType = 'expense';
let _finTxSelectedCat = '';

function toggleFinTxType(type) {
  _finTxCurrentType = type;
  const isExpense = type === 'expense';
  const cats = getFinCats();
  const catList = isExpense ? cats.expense : cats.income;

  const btnE = document.getElementById('fntx-btn-expense');
  const btnI = document.getElementById('fntx-btn-income');
  if (btnE) { btnE.style.borderColor = isExpense ? '#c2410c' : 'rgba(30,16,64,0.1)'; btnE.style.background = isExpense ? 'rgba(194,65,12,0.08)' : 'white'; btnE.style.color = isExpense ? '#c2410c' : 'rgba(30,16,64,0.4)'; }
  if (btnI) { btnI.style.borderColor = !isExpense ? '#16a34a' : 'rgba(30,16,64,0.1)'; btnI.style.background = !isExpense ? 'rgba(22,163,74,0.08)' : 'white'; btnI.style.color = !isExpense ? '#16a34a' : 'rgba(30,16,64,0.4)'; }

  _finTxSelectedCat = '';
  const catsEl = document.getElementById('fntx-cats');
  if (catsEl) catsEl.innerHTML = catList.map(c => `<button onclick="selectFinTxCat('${escapeHtml(c)}')" id="fntx-cat-${escapeHtml(c)}" style="padding:6px 12px;border-radius:20px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;border:1.5px solid rgba(30,16,64,0.1);background:white;color:rgba(30,16,64,0.5)">${escapeHtml(c)}</button>`).join('');
}

function selectFinTxCat(cat) {
  // Якщо це підкатегорія — просто зберігаємо
  const cats = getFinCats();
  const catList = _finTxCurrentType === 'expense' ? cats.expense : cats.income;
  const isSubcat = !catList.includes(cat);

  if (isSubcat) {
    _finTxSelectedCat = cat;
    // Підсвічуємо підкатегорію
    const subEl = document.getElementById('fntx-subcats');
    if (subEl) subEl.querySelectorAll('button').forEach(btn => {
      const active = btn.textContent === cat;
      btn.style.borderColor = active ? '#c2410c' : 'rgba(30,16,64,0.08)';
      btn.style.background = active ? 'rgba(194,65,12,0.08)' : 'rgba(30,16,64,0.03)';
      btn.style.color = active ? '#c2410c' : 'rgba(30,16,64,0.45)';
    });
    const customInput = document.getElementById('fntx-cat-custom');
    if (customInput) customInput.value = '';
    return;
  }

  _finTxSelectedCat = cat;

  // Підсвічуємо головну категорію
  const catsEl = document.getElementById('fntx-cats');
  if (catsEl) catsEl.querySelectorAll('button').forEach(btn => {
    const active = btn.textContent === cat;
    btn.style.borderColor = active ? '#c2410c' : 'rgba(30,16,64,0.1)';
    btn.style.background = active ? 'rgba(194,65,12,0.08)' : 'white';
    btn.style.color = active ? '#c2410c' : 'rgba(30,16,64,0.5)';
  });

  // Показуємо підкатегорії якщо є
  const subcats = FIN_SUBCATS[cat];
  let subEl = document.getElementById('fntx-subcats');
  if (subcats && subcats.length > 0) {
    if (!subEl) {
      subEl = document.createElement('div');
      subEl.id = 'fntx-subcats';
      subEl.style.cssText = 'display:flex;flex-wrap:wrap;gap:5px;margin-top:8px;padding-top:8px;border-top:1px solid rgba(30,16,64,0.06)';
      const catsWrapper = document.getElementById('fntx-cats-wrap');
      if (catsWrapper) catsWrapper.appendChild(subEl);
      else catsEl?.parentNode?.insertBefore(subEl, catsEl?.nextSibling);
    }
    subEl.innerHTML = subcats.map(s =>
      `<button onclick="selectFinTxCat('${escapeHtml(s)}')" style="padding:5px 11px;border-radius:16px;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;border:1.5px solid rgba(30,16,64,0.08);background:rgba(30,16,64,0.03);color:rgba(30,16,64,0.45);transition:all 0.15s">${escapeHtml(s)}</button>`
    ).join('');
    subEl.style.display = 'flex';
  } else if (subEl) {
    subEl.style.display = 'none';
  }

  const customInput = document.getElementById('fntx-cat-custom');
  if (customInput) customInput.value = '';
}

function saveFinTransaction() {
  const amountRaw = parseFloat(document.getElementById('fntx-amount')?.value || '0');
  if (!amountRaw || amountRaw <= 0) { showToast('Введи суму'); return; }

  const customCat = document.getElementById('fntx-cat-custom')?.value.trim();
  const category = customCat || _finTxSelectedCat;
  if (!category) { showToast('Вибери категорію'); return; }

  const comment = document.getElementById('fntx-comment')?.value.trim() || '';
  const txs = getFinance();

  // Перевіряємо чи нова категорія
  const cats = getFinCats();
  const catList = _finTxCurrentType === 'expense' ? cats.expense : cats.income;
  if (customCat && !catList.includes(customCat)) {
    cats[_finTxCurrentType].push(customCat);
    saveFinCats(cats);
  }

  if (_finEditId) {
    const idx = txs.findIndex(x => x.id === _finEditId);
    if (idx !== -1) txs[idx] = { ...txs[idx], amount: amountRaw, category, comment, type: _finTxCurrentType };
  } else {
    txs.unshift({ id: Date.now(), type: _finTxCurrentType, amount: amountRaw, category, comment, ts: Date.now() });
  }
  saveFinance(txs);
  closeFinTxModal();
  renderFinance();
  showToast(_finEditId ? '✓ Оновлено' : `✓ ${_finTxCurrentType === 'expense' ? 'Витрату' : 'Дохід'} збережено`);
  _finEditId = null;
  try { localStorage.setItem('nm_owl_tab_ts_finance', '0'); tryTabBoardUpdate('finance'); } catch(e) {}
}

function deleteFinTransaction() {
  if (!_finEditId) return;
  const item = getFinance().find(t => t.id === _finEditId);
  saveFinance(getFinance().filter(t => t.id !== _finEditId));
  closeFinTxModal();
  renderFinance();
  try { localStorage.setItem('nm_owl_tab_ts_finance', '0'); tryTabBoardUpdate('finance'); } catch(e) {}
  if (item) showUndoToast('Транзакцію видалено', () => {
    const txs = getFinance(); txs.unshift(item); saveFinance(txs); renderFinance();
    try { localStorage.setItem('nm_owl_tab_ts_finance', '0'); tryTabBoardUpdate('finance'); } catch(e) {}
  });
  _finEditId = null;
}

function closeFinTxModal() {
  document.getElementById('fin-tx-modal')?.remove();
}

// Модал бюджету
function openFinBudgetModal() {
  const budget = getFinBudget();
  const cats = getFinCats();

  const existing = document.getElementById('fin-budget-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'fin-budget-modal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:500;display:flex;align-items:flex-end;justify-content:center';
  modal.innerHTML = `
    <div onclick="closeFinBudgetModal()" style="position:absolute;inset:0;background:rgba(10,5,30,0.35);backdrop-filter:blur(2px)"></div>
    <div style="position:relative;width:100%;max-width:480px;background:rgba(255,255,255,0.88);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);border-radius:24px;margin:0 16px 16px;z-index:1;border:1.5px solid rgba(255,255,255,0.6);padding:16px 20px calc(env(safe-area-inset-bottom)+24px);max-height:80vh;overflow-y:auto;box-sizing:border-box">
      <div style="width:36px;height:4px;background:rgba(0,0,0,0.1);border-radius:2px;margin:0 auto 14px"></div>
      <div style="font-size:17px;font-weight:800;color:#1e1040;margin-bottom:14px">Бюджет на місяць</div>

      <div style="font-size:12px;font-weight:700;color:rgba(30,16,64,0.4);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px">Загальний ліміт</div>
      <input id="finbdg-total" type="number" placeholder="€ 0 — без ліміту" inputmode="decimal"
        style="width:100%;border:1.5px solid rgba(30,16,64,0.12);border-radius:12px;padding:11px 14px;font-size:17px;font-weight:700;font-family:inherit;color:#1e1040;outline:none;margin-bottom:14px;box-sizing:border-box"
        value="${budget.total || ''}">

      <div style="font-size:12px;font-weight:700;color:rgba(30,16,64,0.4);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px">По категоріях</div>
      <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px">
        ${cats.expense.map(cat => `
          <div style="display:flex;align-items:center;gap:10px">
            <div style="font-size:14px;font-weight:600;color:#1e1040;flex:1">${escapeHtml(cat)}</div>
            <input type="number" id="finbdg-cat-${escapeHtml(cat)}" placeholder="без ліміту" inputmode="decimal"
              style="width:100px;border:1.5px solid rgba(30,16,64,0.1);border-radius:10px;padding:7px 10px;font-size:14px;font-family:inherit;color:#1e1040;outline:none;text-align:right"
              value="${budget.categories?.[cat] || ''}">
          </div>`).join('')}
      </div>

      <div style="display:flex;gap:8px">
        <button onclick="closeFinBudgetModal()" style="flex:1;padding:13px;border-radius:12px;background:rgba(30,16,64,0.06);border:none;font-size:15px;font-weight:700;color:rgba(30,16,64,0.5);cursor:pointer;font-family:inherit">Скасувати</button>
        <button onclick="saveFinBudgetFromModal()" style="flex:2;padding:13px;border-radius:12px;background:linear-gradient(135deg,#f97316,#c2410c);border:none;font-size:15px;font-weight:700;color:white;cursor:pointer;font-family:inherit">Зберегти</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
}

function saveFinBudgetFromModal() {
  const cats = getFinCats();
  const total = parseFloat(document.getElementById('finbdg-total')?.value || '0') || 0;
  const categories = {};
  cats.expense.forEach(cat => {
    const val = parseFloat(document.getElementById(`finbdg-cat-${cat}`)?.value || '0') || 0;
    if (val > 0) categories[cat] = val;
  });
  saveFinBudget({ total, categories });
  closeFinBudgetModal();
  renderFinance();
  showToast('✓ Бюджет збережено');
  try { localStorage.setItem('nm_owl_tab_ts_finance', '0'); tryTabBoardUpdate('finance'); } catch(e) {}
}

function closeFinBudgetModal() {
  document.getElementById('fin-budget-modal')?.remove();
}

// Обробка фінансів з Inbox
export function processFinanceAction(parsed, originalText) {
  const cats = getFinCats();
  const type = parsed.fin_type || 'expense';
  const amount = parseFloat(parsed.amount) || 0;
  const category = parsed.category || (type === 'expense' ? 'Інше' : 'Інше');
  const comment = parsed.comment || originalText;

  if (!amount || amount <= 0) {
    addInboxChatMsg('agent', 'Не вдалось розпізнати суму. Спробуй написати чіткіше: "витратив 50 на їжу"');
    return;
  }

  // Нова категорія — зберігаємо без запиту (агент вже підтвердив)
  const catList = type === 'expense' ? cats.expense : cats.income;
  if (!catList.includes(category)) {
    catList.push(category);
    saveFinCats(cats);
  }

  const txs = getFinance();
  txs.unshift({ id: Date.now(), type, amount, category, comment, ts: Date.now() });
  saveFinance(txs);

  // Зберігаємо в Inbox для історії
  const items = getInbox();
  items.unshift({ id: Date.now(), text: originalText, category: 'finance', ts: Date.now(), processed: true });
  saveInbox(items);
  renderInbox();

  if (currentTab === 'finance') renderFinance();

  const sign = type === 'expense' ? '-' : '+';
  const typeLabel = type === 'expense' ? 'витрату' : 'дохід';
  addInboxChatMsg('agent', `${sign}${formatMoney(amount)} · ${category}${parsed.fin_comment ? ' — ' + parsed.fin_comment : ''}`);

  // Попередження про перевищення бюджету
  checkFinBudgetWarning(type, category, amount);
}

function checkFinBudgetWarning(type, category, amount) {
  if (type !== 'expense') return;
  const budget = getFinBudget();
  const from = getFinPeriodRange('month');
  const txs = getFinance().filter(t => t.type === 'expense' && t.ts >= from);
  const totalSpent = txs.reduce((s, t) => s + t.amount, 0);

  // Загальний ліміт
  if (budget.total > 0) {
    const pct = totalSpent / budget.total;
    if (pct >= 1) addInboxChatMsg('agent', `⚠️ Загальний бюджет на місяць перевищено. Витрачено ${formatMoney(totalSpent)} з ${formatMoney(budget.total)}.`);
    else if (pct >= 0.8) addInboxChatMsg('agent', `💡 До ліміту місяця залишилось ${formatMoney(budget.total - totalSpent)}.`);
  }

  // Категорійний ліміт
  const catLimit = budget.categories?.[category];
  if (catLimit > 0) {
    const catSpent = txs.filter(t => t.category === category).reduce((s, t) => s + t.amount, 0);
    const pct = catSpent / catLimit;
    if (pct >= 1) addInboxChatMsg('agent', `⚠️ Ліміт по "${category}" перевищено: ${formatMoney(catSpent)} з ${formatMoney(catLimit)}.`);
    else if (pct >= 0.8) addInboxChatMsg('agent', `💡 По "${category}" залишилось ${formatMoney(catLimit - catSpent)}.`);
  }
}

// Finance контекст для getAIContext
export function getFinanceContext() {
  const today = new Date().toDateString();
  const from = getFinPeriodRange('month');
  const txs = getFinance().filter(t => t.ts >= from);
  if (txs.length === 0) return '';

  const expenses = txs.filter(t => t.type === 'expense');
  const incomes = txs.filter(t => t.type === 'income');
  const totalExp = expenses.reduce((s, t) => s + t.amount, 0);
  const totalInc = incomes.reduce((s, t) => s + t.amount, 0);
  const budget = getFinBudget();

  const catMap = {};
  expenses.forEach(t => { catMap[t.category] = (catMap[t.category] || 0) + t.amount; });
  const top3 = Object.entries(catMap).sort((a,b) => b[1]-a[1]).slice(0,3).map(([c,a]) => `${c}: ${formatMoney(a)}`).join(', ');

  const todayTxs = txs.filter(t => new Date(t.ts).toDateString() === today);
  const todaySum = todayTxs.filter(t => t.type === 'expense').reduce((s,t) => s+t.amount, 0);

  let parts = [`Фінанси (місяць): витрати ${formatMoney(totalExp)}, доходи ${formatMoney(totalInc)}`];
  if (budget.total > 0) parts.push(`бюджет ${formatMoney(budget.total)}, залишилось ${formatMoney(budget.total - totalExp)}`);
  if (top3) parts.push(`топ категорії: ${top3}`);
  if (todaySum > 0) parts.push(`сьогодні витрачено ${formatMoney(todaySum)}`);

  // Останні 5 транзакцій з ID — для update_transaction з Inbox
  const recentTxs = txs.slice(0, 5).map(t => `[ID:${t.id}] ${t.type === 'expense' ? '-' : '+'}${t.amount}${getCurrency()} ${t.category}${t.comment ? ' ('+t.comment+')' : ''}`).join('; ');
  if (recentTxs) parts.push(`Останні транзакції (використовуй ID для update_transaction): ${recentTxs}`);

  return parts.join('\n');
}

// === FINANCE AI BAR ===
let financeBarHistory = [];
let financeBarLoading = false;

export function addFinanceChatMsg(role, text, _noSave = false) {
  const el = document.getElementById('finance-chat-messages');
  if (!el) return;
  if (_financeTypingEl) { _financeTypingEl.remove(); _financeTypingEl = null; }
  if (role === 'typing') {
    const td = document.createElement('div');
    td.style.cssText = 'display:flex';
    td.innerHTML = '<div style="background:rgba(255,255,255,0.12);border-radius:4px 12px 12px 12px;padding:5px 10px"><div class=\"ai-typing\"><span></span><span></span><span></span></div></div>';
    el.appendChild(td);
    _financeTypingEl = td;
    el.scrollTop = el.scrollHeight;
    return;
  }
  try { openChatBar('finance'); } catch(e) {}
  const isAgent = role === 'agent';
  const div = document.createElement('div');
  div.style.cssText = `display:flex;${isAgent ? '' : 'justify-content:flex-end'}`;
  div.innerHTML = `<div style="max-width:85%;background:${isAgent ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.88)'};color:${isAgent ? 'white' : '#1e1040'};border-radius:${isAgent ? '4px 12px 12px 12px' : '12px 4px 12px 12px'};padding:8px 12px;font-size:15px;line-height:1.5;font-weight:500">${escapeHtml(text).replace(/\n/g,'<br>')}</div>`;
  el.appendChild(div);
  el.scrollTop = el.scrollHeight;
  if (role !== 'agent') financeBarHistory.push({ role: 'user', content: text });
  else financeBarHistory.push({ role: 'assistant', content: text });
  if (!_noSave) saveChatMsg('finance', role, text);
}

export async function sendFinanceBarMessage() {
  if (financeBarLoading) return;
  const input = document.getElementById('finance-bar-input');
  const text = input.value.trim();
  if (!text) return;
  const key = localStorage.getItem('nm_gemini_key');
  if (!key) { addFinanceChatMsg('agent', 'Введи OpenAI ключ в налаштуваннях.'); return; }
  input.value = ''; input.style.height = 'auto';
  input.focus();
  addFinanceChatMsg('user', text);
  financeBarLoading = true;
  addFinanceChatMsg('typing', '');

  const from = getFinPeriodRange('month');
  const txs = getFinance().filter(t => t.ts >= from);
  const budget = getFinBudget();
  const cats = getFinCats();
  const aiContext = getAIContext();

  const FINANCE_BAR_PROMPT = `${getOWLPersonality()} Ти допомагаєш з фінансами. Відповіді — 1-3 речення, конкретно.
Валюта: ${getCurrency()}. Поточний місяць.
Транзакції (до 20 останніх): ${txs.slice(0,20).map(t=>`[${t.type}] ${t.category} ${t.amount}${getCurrency()} ${t.comment||''}`).join('; ') || 'немає'}
Загальний бюджет: ${budget.total ? budget.total+getCurrency() : 'не встановлено'}
Категорії витрат: ${cats.expense.join(', ')}
Приклади: Їжа(кава,ресторан,продукти), Транспорт(бензин,таксі,Uber), Підписки(Netflix,Spotify), Здоровʼя(аптека,лікар), Житло(оренда,комуналка), Покупки(одяг,техніка)
Категорії доходів: ${cats.income.join(', ')}
Якщо є сумнів — обирай найближчу категорію, НЕ "Інше".

Ти можеш виконувати дії через JSON (відповідай ТІЛЬКИ JSON якщо потрібна дія):
{"action":"save_expense","amount":50,"category":"Їжа","comment":"продукти"}
{"action":"save_income","amount":3000,"category":"Зарплата","comment":""}
{"action":"delete_transaction","id":1234567890}
{"action":"update_transaction","id":1234567890,"category":"Транспорт","comment":"заправка"}
{"action":"set_budget","total":2000,"categories":{"Їжа":400}}
{"action":"create_category","type":"expense","name":"Нова категорія"}

Якщо користувач просить змінити категорію або опис існуючої транзакції — використовуй update_transaction з її id. НЕ створюй нову транзакцію і НЕ видаляй стару окремо.
ВАЖЛИВО: НЕ вигадуй ліміти, бюджети або плани яких немає в даних вище. Якщо бюджет "не встановлено" — не згадуй перевищення. Тільки реальні цифри.
Також вмієш: створити задачу {"action":"create_task","title":"назва","steps":[]}, звичку {"action":"create_habit","name":"назва","days":[0,1,2,3,4,5,6]}, нотатку {"action":"create_note","text":"текст","folder":null}.${aiContext ? '\n\n' + aiContext : ''}`;

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'system', content: FINANCE_BAR_PROMPT }, ...financeBarHistory.slice(-10)], max_tokens: 300, temperature: 0.5 })
    });
    const data = await res.json();
    const reply = data.choices?.[0]?.message?.content?.trim();
    if (!reply) { addFinanceChatMsg('agent', 'Щось пішло не так.'); financeBarLoading = false; return; }

    // Спробуємо JSON дію
    try {
      const jsonMatch = reply.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : reply);
      if (processUniversalAction(parsed, text, addFinanceChatMsg)) {
        // оброблено універсально
      } else if (parsed.action === 'save_expense' || parsed.action === 'save_income') {
        const type = parsed.action === 'save_expense' ? 'expense' : 'income';
        const txs2 = getFinance();
        txs2.unshift({ id: Date.now(), type, amount: parseFloat(parsed.amount), category: parsed.category || 'Інше', comment: parsed.comment || '', ts: Date.now() });
        saveFinance(txs2);
        renderFinance();
        try { localStorage.setItem('nm_owl_tab_ts_finance', '0'); tryTabBoardUpdate('finance'); } catch(e) {}
        addFinanceChatMsg('agent', `✓ ${type === 'expense' ? '-' : '+'}${formatMoney(parsed.amount)} · ${parsed.category}`);
        checkFinBudgetWarning(type, parsed.category, parseFloat(parsed.amount));
      } else if (parsed.action === 'delete_transaction') {
        const item = getFinance().find(t => t.id === parsed.id);
        const _item = getFinance().find(t => t.id === parsed.id);
      if (_item) addToTrash('finance', _item);
      saveFinance(getFinance().filter(t => t.id !== parsed.id));
        renderFinance();
        addFinanceChatMsg('agent', `🗑 Видалено: ${item ? item.category + ' ' + formatMoney(item.amount) : 'транзакцію'}`);
      } else if (parsed.action === 'update_transaction') {
        const txs2 = getFinance();
        const idx = txs2.findIndex(t => t.id === parsed.id);
        if (idx !== -1) {
          if (parsed.category) txs2[idx].category = parsed.category;
          if (parsed.comment !== undefined) txs2[idx].comment = parsed.comment;
          if (parsed.amount) txs2[idx].amount = parseFloat(parsed.amount);
          saveFinance(txs2);
          renderFinance();
          addFinanceChatMsg('agent', `✓ Оновлено: ${txs2[idx].category} ${formatMoney(txs2[idx].amount)}`);
        } else {
          addFinanceChatMsg('agent', 'Транзакцію не знайдено.');
        }
      } else if (parsed.action === 'set_budget') {
        const bdg = getFinBudget();
        if (parsed.total) bdg.total = parsed.total;
        if (parsed.categories) Object.assign(bdg.categories, parsed.categories);
        saveFinBudget(bdg);
        renderFinance();
        addFinanceChatMsg('agent', '✓ Бюджет оновлено');
      } else if (parsed.action === 'create_category') {
        const c = getFinCats();
        const list = parsed.type === 'income' ? c.income : c.expense;
        if (!list.includes(parsed.name)) { list.push(parsed.name); saveFinCats(c); }
        renderFinance();
        addFinanceChatMsg('agent', `✓ Категорію "${parsed.name}" додано`);
      } else {
        safeAgentReply(reply, addFinanceChatMsg);
      }
    } catch {
      safeAgentReply(reply, addFinanceChatMsg);
    }
  } catch { addFinanceChatMsg('agent', 'Мережева помилка.'); }
  financeBarLoading = false;
}


// === WINDOW EXPORTS (HTML handlers only) ===
Object.assign(window, {
  openAddTransaction, setCurrency, setFinPeriod, switchFinTab,
  sendFinanceBarMessage, openFinBudgetModal,
  openEditTransaction, closeFinTxModal, toggleFinTxType,
  selectFinTxCat, saveFinTransaction, deleteFinTransaction,
  closeFinBudgetModal, saveFinBudgetFromModal, openAllTransactions,
});
