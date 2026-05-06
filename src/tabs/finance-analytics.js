// ============================================================
// finance-analytics.js — Аналітика Фінансів (графіки, метрики, benchmark)
// Винесено з finance.js у рефакторингу 17.04.2026 (сесія gHCOh).
// Містить: модалку 📊 Аналітика з 3 режимами графіка, 9 метриками,
// розподілом доходу 50/30/20 з кастомними %.
// ============================================================

import { escapeHtml, t } from '../core/utils.js';
import { logError } from '../core/logger.js';
import { getFinance, formatMoney } from './finance.js';
import { setupModalSwipeClose } from './tasks.js';

// State аналітики
let _analyticsChartMode = 'expenses-weekly'; // 'balance' | 'expenses-weekly' | 'income-vs-expense'
let _analyticsGranularity = 'weekly'; // 'weekly' | 'daily' — спільний для всіх 3 режимів
let _analyticsMiniIdx = [0, 0, 0]; // 3 незалежні блоки міні-метрик
let _analyticsBenchmarkEdit = false; // режим редагування benchmark

function _buildAnalyticsContent(allTxs) {
  const sections = [];
  sections.push(_analyticsChart(allTxs));
  sections.push(_analyticsMiniMetrics(allTxs));
  sections.push(_analyticsBenchmark(allTxs));
  return sections.join('');
}

// B-62 Крок 1: Головний графік з 3 метриками на вибір.
// MPVly-day2 06.05 (B-145): 7 точок + перемикач weekly/daily (спільний для
// всіх 3 режимів). Капітал = лінія (накопичувальний). Витрати/Доходи = bars.
function _analyticsChart(allTxs) {
  const now = new Date();
  const POINTS = 7;
  const isDaily = _analyticsGranularity === 'daily';
  const buckets = [];
  // Будуємо 7 точок (тижнів або днів) з даними
  for (let i = POINTS - 1; i >= 0; i--) {
    const end = new Date(now);
    let start;
    if (isDaily) {
      end.setDate(now.getDate() - i);
      end.setHours(23, 59, 59, 999);
      start = new Date(end);
      start.setHours(0, 0, 0, 0);
    } else {
      end.setDate(now.getDate() - i * 7);
      end.setHours(23, 59, 59, 999);
      start = new Date(end);
      start.setDate(end.getDate() - 6);
      start.setHours(0, 0, 0, 0);
    }
    const exp = allTxs.filter(t => t.type === 'expense' && t.ts >= start.getTime() && t.ts <= end.getTime()).reduce((s, t) => s + t.amount, 0);
    const inc = allTxs.filter(t => t.type === 'income' && t.ts >= start.getTime() && t.ts <= end.getTime()).reduce((s, t) => s + t.amount, 0);
    const label = `${start.getDate()}.${String(start.getMonth() + 1).padStart(2, '0')}`;
    buckets.push({ label, exp, inc, isCurrent: i === 0 });
  }

  // Капітал = накопичувальний баланс на кінець кожної точки
  const balances = [];
  let cumBalance = 0;
  const firstStart = new Date(now);
  if (isDaily) {
    firstStart.setDate(now.getDate() - (POINTS - 1));
  } else {
    firstStart.setDate(now.getDate() - (POINTS - 1) * 7 - 6);
  }
  firstStart.setHours(0, 0, 0, 0);
  allTxs.filter(t => t.ts < firstStart.getTime()).forEach(t => {
    cumBalance += (t.type === 'income' ? t.amount : -t.amount);
  });
  buckets.forEach(b => { cumBalance += b.inc - b.exp; balances.push(cumBalance); });

  const modes = [
    { id: 'balance',          label: t('finstat.chart.balance_label', 'Капітал'),  desc: t('finstat.chart.balance_desc', 'Накопичувальний баланс') },
    { id: 'expenses-weekly',  label: t('finstat.chart.expenses_label', 'Витрати'),  descW: t('finstat.chart.expenses_desc', 'Сума витрат по тижнях'), descD: t('finstat.chart.expenses_desc_d', 'Сума витрат по днях') },
    { id: 'income-vs-expense',label: t('finstat.chart.income_label', 'Доходи'),   desc: t('finstat.chart.income_vs_exp', 'Доходи vs витрати') },
  ];
  const modeToggleHtml = `<div style="display:flex;gap:4px;background:rgba(30,16,64,0.04);border-radius:10px;padding:3px;margin-bottom:8px">
    ${modes.map(m => {
      const active = m.id === _analyticsChartMode;
      return `<button onclick="setAnalyticsChartMode('${m.id}')" style="flex:1;padding:6px;border-radius:8px;border:none;background:${active ? 'white' : 'transparent'};color:${active ? '#c2410c' : 'rgba(30,16,64,0.5)'};font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;box-shadow:${active ? '0 2px 6px rgba(30,16,64,0.08)' : 'none'}">${m.label}</button>`;
    }).join('')}
  </div>`;
  // Перемикач Тижні / Дні — спільний для всіх 3 режимів
  const granToggleHtml = `<div style="display:flex;gap:6px;justify-content:flex-end;margin-bottom:6px">
    <button onclick="setAnalyticsGranularity('weekly')" style="padding:4px 10px;border-radius:7px;border:none;background:${!isDaily ? '#1e1040' : 'rgba(30,16,64,0.06)'};color:${!isDaily ? 'white' : 'rgba(30,16,64,0.5)'};font-size:10px;font-weight:700;cursor:pointer;font-family:inherit">${t('finstat.gran.weekly', 'Тижні')}</button>
    <button onclick="setAnalyticsGranularity('daily')" style="padding:4px 10px;border-radius:7px;border:none;background:${isDaily ? '#1e1040' : 'rgba(30,16,64,0.06)'};color:${isDaily ? 'white' : 'rgba(30,16,64,0.5)'};font-size:10px;font-weight:700;cursor:pointer;font-family:inherit">${t('finstat.gran.daily', 'Дні')}</button>
  </div>`;
  const modeObj = modes.find(m => m.id === _analyticsChartMode) || modes[1];
  const subtitle = _analyticsChartMode === 'expenses-weekly'
    ? (isDaily ? modeObj.descD : modeObj.descW)
    : modeObj.desc;
  const periodLabel = isDaily
    ? t('finstat.chart.days_suffix', '7 днів')
    : t('finstat.chart.weeks_suffix', '7 тижнів');

  let chartHtml = '';
  if (_analyticsChartMode === 'balance') {
    // Капітал — лінія + Y-шкала зліва (B-148)
    const minB = Math.min(0, ...balances);
    const maxB = Math.max(1, ...balances);
    const range = maxB - minB || 1;
    // y range 8..92 у viewBox (8% padding щоб точки r=5 не вилазили)
    const yOf = (b) => 92 - ((b - minB) / range) * 84;
    const pts = balances.map((b, i) => `${(i / (POINTS - 1)) * 400},${yOf(b)}`).join(' ');
    const zeroY = yOf(0);
    const hasNeg = minB < 0;
    const yLabels = hasNeg
      ? `<div>${formatMoney(maxB)}</div><div>0</div><div>${formatMoney(minB)}</div>`
      : `<div>${formatMoney(maxB)}</div><div>${formatMoney(minB)}</div>`;
    chartHtml = `<div style="display:flex;gap:6px;height:100px">
      <div style="display:flex;flex-direction:column;justify-content:space-between;width:50px;font-size:9px;font-weight:600;color:rgba(30,16,64,0.45);text-align:right;padding:6px 0;flex-shrink:0">${yLabels}</div>
      <svg viewBox="0 0 400 100" preserveAspectRatio="none" style="flex:1;height:100px;display:block;border:1px solid rgba(30,16,64,0.10);border-radius:8px;background:rgba(255,255,255,0.4);box-sizing:border-box">
        ${hasNeg ? `<line x1="0" y1="${zeroY}" x2="400" y2="${zeroY}" stroke="rgba(30,16,64,0.12)" stroke-width="1" stroke-dasharray="3,3"/>` : ''}
        <polyline points="${pts}" fill="none" stroke="#0ea5e9" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
        ${balances.map((b, i) => `<circle cx="${(i / (POINTS - 1)) * 400}" cy="${yOf(b)}" r="5" fill="#0ea5e9"/>`).join('')}
      </svg>
    </div>
    <div style="display:flex;gap:2px;margin-top:4px;padding-left:56px">${buckets.map(b => `<div style="flex:1;font-size:9px;font-weight:${b.isCurrent?'700':'500'};color:${b.isCurrent?'#c2410c':'rgba(30,16,64,0.35)'};text-align:center">${b.label}</div>`).join('')}</div>
    <div style="font-size:10px;color:rgba(30,16,64,0.4);margin-top:6px;text-align:center">${t('finstat.chart.current', 'Поточний')}: <span style="color:#0ea5e9;font-weight:700">${formatMoney(cumBalance)}</span></div>`;
  } else if (_analyticsChartMode === 'expenses-weekly') {
    // Витрати — bars (помаранчеві). Рамка ТIЛЬКИ навколо стовпчиків,
    // дати і суми ПIД рамкою (B-147).
    const maxVal = Math.max(1, ...buckets.map(b => b.exp));
    const barsRow = buckets.map(b => {
      const h = b.exp > 0 ? Math.max(4, Math.round(b.exp / maxVal * 90)) : 0;
      const col = b.isCurrent ? '#c2410c' : '#f97316';
      return `<div style="flex:1;display:flex;align-items:flex-end;justify-content:center;min-width:0">
        <div style="width:70%;height:${h}px;background:${col};border-radius:3px 3px 0 0"></div>
      </div>`;
    }).join('');
    const datesRow = buckets.map(b => `<div style="flex:1;font-size:9px;font-weight:${b.isCurrent?'700':'500'};color:${b.isCurrent?'#c2410c':'rgba(30,16,64,0.35)'};text-align:center;min-width:0">${b.label}</div>`).join('');
    const sumsRow = buckets.map(b => `<div style="flex:1;font-size:8px;font-weight:600;color:rgba(30,16,64,0.4);text-align:center;min-width:0">${b.exp > 0 ? formatMoney(b.exp) : ''}</div>`).join('');
    chartHtml = `<div style="display:flex;gap:3px;align-items:flex-end;height:100px;border:1px solid rgba(30,16,64,0.10);border-radius:8px;padding:4px;box-sizing:border-box;background:rgba(255,255,255,0.4)">${barsRow}</div>
    <div style="display:flex;gap:3px;margin-top:4px">${datesRow}</div>
    <div style="display:flex;gap:3px;margin-top:1px">${sumsRow}</div>`;
  } else {
    // Доходи vs Витрати — двоколірні bars з рамкою + дати окремо.
    const maxVal = Math.max(1, ...buckets.map(b => Math.max(b.exp, b.inc)));
    const barsRow = buckets.map(b => {
      const expH = b.exp > 0 ? Math.max(4, Math.round(b.exp / maxVal * 90)) : 0;
      const incH = b.inc > 0 ? Math.max(4, Math.round(b.inc / maxVal * 90)) : 0;
      return `<div style="flex:1;display:flex;gap:2px;align-items:flex-end;min-width:0">
        <div style="flex:1;height:${expH}px;background:#f97316;border-radius:3px 3px 0 0"></div>
        <div style="flex:1;height:${incH}px;background:#16a34a;border-radius:3px 3px 0 0"></div>
      </div>`;
    }).join('');
    const datesRow = buckets.map(b => `<div style="flex:1;font-size:9px;font-weight:${b.isCurrent?'700':'500'};color:${b.isCurrent?'#c2410c':'rgba(30,16,64,0.35)'};text-align:center;min-width:0">${b.label}</div>`).join('');
    chartHtml = `<div style="display:flex;gap:4px;align-items:flex-end;height:100px;border:1px solid rgba(30,16,64,0.10);border-radius:8px;padding:4px;box-sizing:border-box;background:rgba(255,255,255,0.4)">${barsRow}</div>
    <div style="display:flex;gap:4px;margin-top:4px">${datesRow}</div>
    <div style="display:flex;gap:10px;justify-content:center;margin-top:6px">
      <div style="display:flex;align-items:center;gap:4px"><div style="width:8px;height:8px;border-radius:50%;background:#f97316"></div><span style="font-size:10px;font-weight:600;color:rgba(30,16,64,0.4)">${t('finstat.legend.expenses', 'Витрати')}</span></div>
      <div style="display:flex;align-items:center;gap:4px"><div style="width:8px;height:8px;border-radius:50%;background:#16a34a"></div><span style="font-size:10px;font-weight:600;color:rgba(30,16,64,0.4)">${t('finstat.legend.income', 'Доходи')}</span></div>
    </div>`;
  }

  return `<div style="background:white;border-radius:20px;box-shadow:0 2px 12px rgba(30,16,64,0.06);padding:14px;margin-bottom:12px">
    ${modeToggleHtml}
    ${granToggleHtml}
    <div style="font-size:11px;color:rgba(30,16,64,0.4);margin-bottom:8px">${escapeHtml(subtitle)} · ${periodLabel}</div>
    ${chartHtml}
  </div>`;
}
// B-62 Крок 2: 9 метрик у 3 перемиканих міні-блоках.
function _analyticsMiniMetrics(allTxs) {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();
  const prevFrom = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
  const prevTo = from;
  const monthExp = allTxs.filter(t => t.type === 'expense' && t.ts >= from && t.ts < to);
  const monthInc = allTxs.filter(t => t.type === 'income' && t.ts >= from && t.ts < to);
  const prevMonthExp = allTxs.filter(t => t.type === 'expense' && t.ts >= prevFrom && t.ts < prevTo);
  const curExp = monthExp.reduce((s, t) => s + t.amount, 0);
  const prevExp = prevMonthExp.reduce((s, t) => s + t.amount, 0);
  const curInc = monthInc.reduce((s, t) => s + t.amount, 0);
  const daysPassed = Math.max(1, now.getDate());
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

  const catMap = {};
  monthExp.forEach(t => { catMap[t.category] = (catMap[t.category] || 0) + t.amount; });
  const topCats = Object.entries(catMap).sort((a, b) => b[1] - a[1]);

  const amounts = monthExp.map(t => t.amount);
  const avgTx = amounts.length > 0 ? amounts.reduce((s, a) => s + a, 0) / amounts.length : 0;
  const maxTx = amounts.length > 0 ? Math.max(...amounts) : 0;

  const dayMap = {};
  monthExp.forEach(t => {
    const d = new Date(t.ts).toDateString();
    dayMap[d] = (dayMap[d] || 0) + t.amount;
  });
  const dayTotals = Object.values(dayMap);
  const maxDay = dayTotals.length > 0 ? Math.max(...dayTotals) : 0;
  const forecastEnd = daysPassed > 0 ? (curExp / daysPassed) * daysInMonth : 0;

  const metrics = [
    { label: t('finstat.metric.month_exp', 'Витрати місяця'), value: formatMoney(curExp),
      desc: prevExp > 0 ? t('finstat.metric.vs_prev', '{sign}{pct}% vs минулий місяць', { sign: curExp >= prevExp ? '+' : '', pct: Math.round((curExp - prevExp) / prevExp * 100) }) : t('finstat.metric.first_month', 'перший місяць з даними'),
      color: '#c2410c' },
    { label: t('finstat.metric.avg_day', 'В середньому/день'), value: formatMoney(Math.round(curExp / daysPassed)),
      desc: t('finstat.metric.days_of_month', 'за {n} {word} місяця', { n: daysPassed, word: daysPassed === 1 ? t('finstat.word.day1','день') : daysPassed < 5 ? t('finstat.word.day2','дні') : t('finstat.word.day5','днів') }),
      color: '#1e1040' },
    { label: t('finstat.metric.top_cat', 'Топ категорія'), value: topCats.length > 0 ? topCats[0][0] : '—',
      desc: topCats.length > 0 ? t('finstat.metric.top_cat_desc', '{sum} · {pct}% витрат', { sum: formatMoney(topCats[0][1]), pct: Math.round(topCats[0][1] / curExp * 100) }) : t('finstat.metric.no_data', 'немає даних'),
      color: '#c2410c' },
    { label: t('finstat.metric.savings', 'Заощадження'), value: curInc > 0 ? Math.round((curInc - curExp) / curInc * 100) + '%' : '—',
      desc: curInc > 0 ? t('finstat.metric.savings_desc', '{saved} з {inc}', { saved: formatMoney(curInc - curExp), inc: formatMoney(curInc) }) : t('finstat.metric.add_income', 'додай дохід'),
      color: curInc > 0 && curInc > curExp ? '#16a34a' : '#c2410c' },
    { label: t('finstat.metric.ops', 'Операцій'), value: monthExp.length,
      desc: t('finstat.metric.ops_avg', 'середня {sum}', { sum: formatMoney(Math.round(avgTx)) }),
      color: '#0ea5e9' },
    { label: t('finstat.metric.max_day', 'Максимум за день'), value: formatMoney(Math.round(maxDay)),
      desc: dayTotals.length > 0
        ? t('finstat.metric.max_day_desc', 'найдорожчий з {n} активних днів', { n: dayTotals.length })
        : t('finstat.metric.no_data', 'немає даних'),
      color: '#c2410c' },
    { label: t('finstat.metric.max_tx', 'Найбільша операція'), value: formatMoney(Math.round(maxTx)),
      desc: amounts.length > 0
        ? t('finstat.metric.max_tx_desc', 'з {n} операцій', { n: amounts.length })
        : t('finstat.metric.no_data', 'немає даних'),
      color: '#c2410c' },
    { label: t('finstat.metric.forecast', 'Прогноз місяця'), value: formatMoney(Math.round(forecastEnd)),
      desc: t('finstat.metric.forecast_desc', 'за поточним темпом до {date}', { date: `${daysInMonth}.${String(now.getMonth() + 1).padStart(2, '0')}` }),
      color: '#0ea5e9' },
    { label: t('finstat.metric.income', 'Доходи місяця'), value: formatMoney(curInc),
      desc: monthInc.length > 0
        ? t('finstat.metric.income_desc', '{n} надходжень', { n: monthInc.length })
        : t('finstat.metric.income_none', 'доходів не було'),
      color: '#16a34a' },
  ];

  const renderMini = (blockIdx) => {
    const idx = _analyticsMiniIdx[blockIdx] % metrics.length;
    const m = metrics[idx];
    return `<div style="flex:1;background:white;border-radius:14px;box-shadow:0 2px 8px rgba(30,16,64,0.05);padding:10px 8px;text-align:center;min-width:0;display:flex;flex-direction:column;justify-content:space-between">
      <div style="font-size:9px;font-weight:700;color:rgba(30,16,64,0.4);text-transform:uppercase;letter-spacing:0.05em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(m.label)}</div>
      <div style="font-size:${typeof m.value === 'string' && m.value.length > 6 ? '15px' : '19px'};font-weight:900;color:${m.color};line-height:1.1;margin:6px 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(String(m.value))}</div>
      <div style="font-size:9px;color:rgba(30,16,64,0.45);line-height:1.3;min-height:24px">${escapeHtml(m.desc)}</div>
      <div style="display:flex;gap:4px;margin-top:6px">
        <button onclick="shiftAnalyticsMini(${blockIdx}, -1)" aria-label="Попередня" style="flex:1;padding:6px;border-radius:8px;border:none;background:linear-gradient(135deg,#a67c52,#7a4e2d);color:white;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;box-shadow:0 2px 6px rgba(122,78,45,0.25)">‹</button>
        <div style="font-size:9px;color:rgba(30,16,64,0.3);align-self:center">${idx + 1}/${metrics.length}</div>
        <button onclick="shiftAnalyticsMini(${blockIdx}, 1)" aria-label="Наступна" style="flex:1;padding:6px;border-radius:8px;border:none;background:linear-gradient(135deg,#a67c52,#7a4e2d);color:white;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;box-shadow:0 2px 6px rgba(122,78,45,0.25)">›</button>
      </div>
    </div>`;
  };

  return `<div style="display:flex;gap:8px;margin-bottom:12px">
    ${renderMini(0)}${renderMini(1)}${renderMini(2)}
  </div>`;
}
function _getBenchmarkConfig() {
  try {
    const saved = JSON.parse(localStorage.getItem('nm_fin_benchmark') || 'null');
    if (saved && saved.needs && saved.wants && saved.savings) return saved;
  } catch(e) {}
  return {
    needs:   { pct: 50, name: 'Потреби' },
    wants:   { pct: 30, name: 'Бажання' },
    savings: { pct: 20, name: 'Заощадження' },
  };
}

function _analyticsBenchmark(allTxs) {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();
  const curInc = allTxs.filter(t => t.type === 'income' && t.ts >= from && t.ts < to).reduce((s, t) => s + t.amount, 0);
  const curExp = allTxs.filter(t => t.type === 'expense' && t.ts >= from && t.ts < to).reduce((s, t) => s + t.amount, 0);
  const cfg = _getBenchmarkConfig();

  if (curInc <= 0 && !_analyticsBenchmarkEdit) {
    return `<div style="background:white;border-radius:20px;box-shadow:0 2px 12px rgba(30,16,64,0.06);padding:16px;margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <div class="fin-section-label">${t('finstat.bench.title', 'Розподіл доходу')}</div>
        <button onclick="toggleAnalyticsBenchmarkEdit()" aria-label="Редагувати" style="width:28px;height:28px;border-radius:50%;border:none;background:rgba(30,16,64,0.05);color:rgba(30,16,64,0.5);cursor:pointer;font-family:inherit"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg></button>
      </div>
      <div style="font-size:13px;color:rgba(30,16,64,0.45)">${t('finstat.bench.no_income', 'Додай дохід щоб побачити розподіл')}</div>
    </div>`;
  }

  const spent = curExp;
  const saved = Math.max(0, curInc - curExp);
  const needsCats = ['їжа', 'житло', 'транспорт', "здоров'я", 'здоровʼя', 'здоровя'];
  const monthExp = allTxs.filter(t => t.type === 'expense' && t.ts >= from && t.ts < to);
  const needsAmt = monthExp.filter(t => needsCats.includes(t.category.toLowerCase())).reduce((s, t) => s + t.amount, 0);
  const wantsAmt = spent - needsAmt;

  const denom = curInc > 0 ? curInc : 1;
  const needsPct = Math.round(needsAmt / denom * 100);
  const wantsPct = Math.round(wantsAmt / denom * 100);
  const savedPct = Math.round(saved / denom * 100);

  if (_analyticsBenchmarkEdit) {
    const editRow = (key, real, color) => {
      const item = cfg[key];
      return `<div style="margin-bottom:10px">
        <div style="display:flex;gap:6px;align-items:center;margin-bottom:4px">
          <div style="width:10px;height:10px;border-radius:50%;background:${color};flex-shrink:0"></div>
          <input type="text" value="${escapeHtml(item.name)}" oninput="setBenchmarkField('${key}','name',this.value)" style="flex:1;border:1.5px solid rgba(30,16,64,0.12);border-radius:8px;padding:5px 10px;font-size:13px;font-weight:600;font-family:inherit;color:#1e1040;outline:none;background:rgba(255,255,255,0.95)">
          <input type="number" min="0" max="100" value="${item.pct}" oninput="setBenchmarkField('${key}','pct',parseInt(this.value)||0)" style="width:55px;border:1.5px solid rgba(30,16,64,0.12);border-radius:8px;padding:5px 8px;font-size:13px;font-weight:700;font-family:inherit;color:#1e1040;outline:none;text-align:right">
          <span style="font-size:12px;color:rgba(30,16,64,0.4)">%</span>
        </div>
        <div style="font-size:10px;color:rgba(30,16,64,0.4)">фактично: ${real}%</div>
      </div>`;
    };
    const totalPct = cfg.needs.pct + cfg.wants.pct + cfg.savings.pct;
    const sumWarning = totalPct !== 100
      ? `<div style="font-size:11px;color:#c2410c;margin-bottom:8px">${t('finstat.bench.sum_warn', '⚠️ Сума {pct}% — рекомендовано 100%', { pct: totalPct })}</div>`
      : '';
    return `<div style="background:white;border-radius:20px;box-shadow:0 2px 12px rgba(30,16,64,0.06);padding:16px;margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <div class="fin-section-label">${t('finstat.bench.title_edit', 'Розподіл доходу · редагування')}</div>
        <button onclick="toggleAnalyticsBenchmarkEdit()" style="padding:5px 12px;border-radius:10px;border:none;background:#c2410c;color:white;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit">${t('finstat.bench.done_btn', 'Готово')}</button>
      </div>
      ${sumWarning}
      ${editRow('needs', needsPct, '#f97316')}
      ${editRow('wants', wantsPct, '#0ea5e9')}
      ${editRow('savings', savedPct, '#22c55e')}
      <button onclick="resetBenchmarkConfig()" style="width:100%;padding:8px;border-radius:10px;border:1.5px dashed rgba(30,16,64,0.15);background:transparent;color:rgba(30,16,64,0.5);font-size:12px;font-weight:600;cursor:pointer;font-family:inherit">${t('finstat.bench.reset_btn', 'Скинути до 50/30/20')}</button>
    </div>`;
  }

  const bar = (cfgItem, realPct, color) => {
    const target = cfgItem.pct;
    const w = Math.max(2, Math.min(100, realPct));
    const isOver = realPct > target;
    return `<div style="margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;font-size:12px;font-weight:600;margin-bottom:4px">
        <span style="color:#1e1040">${escapeHtml(cfgItem.name)}</span>
        <span style="color:${isOver ? '#c2410c' : color};font-weight:700">${realPct}% <span style="font-weight:400;color:rgba(30,16,64,0.35)">${t('finstat.bench.goal', '(ціль {pct}%)', { pct: target })}</span></span>
      </div>
      <div style="height:8px;background:rgba(30,16,64,0.06);border-radius:4px;overflow:hidden;position:relative">
        <div style="height:100%;width:${w}%;background:${color};border-radius:4px;transition:width 0.5s"></div>
        <div style="position:absolute;top:0;bottom:0;left:${target}%;width:2px;background:rgba(30,16,64,0.25)"></div>
      </div>
    </div>`;
  };

  return `<div style="background:white;border-radius:20px;box-shadow:0 2px 12px rgba(30,16,64,0.06);padding:16px;margin-bottom:12px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
      <div class="fin-section-label">${t('finstat.bench.title', 'Розподіл доходу')}</div>
      <button onclick="toggleAnalyticsBenchmarkEdit()" aria-label="Редагувати" style="width:28px;height:28px;border-radius:50%;border:none;background:rgba(30,16,64,0.05);color:rgba(30,16,64,0.5);cursor:pointer;font-family:inherit"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg></button>
    </div>
    ${bar(cfg.needs, needsPct, '#f97316')}
    ${bar(cfg.wants, wantsPct, '#0ea5e9')}
    ${bar(cfg.savings, savedPct, '#22c55e')}
    <div style="font-size:11px;color:rgba(30,16,64,0.35);margin-top:8px;border-top:1px solid rgba(30,16,64,0.06);padding-top:8px">
      ${escapeHtml(cfg.needs.name)} ${cfg.needs.pct}% · ${escapeHtml(cfg.wants.name)} ${cfg.wants.pct}% · ${escapeHtml(cfg.savings.name)} ${cfg.savings.pct}%. Тап ✎ щоб змінити % або назви.
    </div>
  </div>`;
}
function _refreshAnalyticsContent() {
  const modal = document.getElementById('fin-analytics-modal');
  if (!modal) { logError('log', '[analytics-refresh] NO MODAL', 'finance-analytics'); return; }
  // MPVly-day2 06.05 (B-143): replaced fragile selector `div[style*="overflow-y:auto"]`
  // (браузер нормалізував inline style → "overflow-y: auto" зі space → null match)
  // на стабільний #id. Це РЕАЛЬНИЙ корінь "кнопок не клікається у аналітиці":
  // state змінювався, refresh викликався, але scrollEl=null → if(!scrollEl) return →
  // UI ніколи не оновлювався. Юзер бачив зміни тільки після close+open.
  const scrollEl = document.getElementById('fin-analytics-scroll');
  if (!scrollEl) { logError('log', `[analytics-refresh] NO scrollEl, modal.children=${modal.children.length}`, 'finance-analytics'); return; }
  const prevScroll = scrollEl.scrollTop;
  const activeId = document.activeElement?.id || '';
  const activeSelStart = document.activeElement?.selectionStart;
  // MPVly-day2 06.05 (B-143): на iPhone Safari `scrollEl.innerHTML = ...`
  // НЕ оновлює UI у відкритій модалці (юзер бачив зміни тільки коли
  // закрив+відкрив модалку → stale rebuild). Замість innerHTML робимо
  // replaceChild з cloneNode — це force повний DOM update що iOS Safari
  // не може ігнорувати (виходимо з стейлу composite layer reuse).
  const newScrollEl = scrollEl.cloneNode(false);
  newScrollEl.innerHTML = _buildAnalyticsContent(getFinance());
  scrollEl.parentNode.replaceChild(newScrollEl, scrollEl);
  logError('log', `[analytics-refresh] OK mode=${_analyticsChartMode} idx=[${_analyticsMiniIdx.join(',')}] htmlLen=${newScrollEl.innerHTML.length}`, 'finance-analytics');
  newScrollEl.scrollTop = prevScroll;
  if (activeId) {
    const el = document.getElementById(activeId);
    if (el && typeof el.focus === 'function') {
      el.focus();
      if (el.setSelectionRange && activeSelStart != null) {
        try { el.setSelectionRange(activeSelStart, activeSelStart); } catch(e) {}
      }
    }
  }
}

// === Публічне API ===
export function openFinAnalytics() {
  const existing = document.getElementById('fin-analytics-modal');
  if (existing) existing.remove();
  const existingOverlay = document.getElementById('fin-analytics-modal-overlay');
  if (existingOverlay) existingOverlay.remove();

  // MPVly-day2 06.05 (B-141): overlay створюємо ЯВНО як top-level sibling,
  // НЕ як .modal-backdrop child всередині modal. Раніше .modal-backdrop child
  // не виносився авто-санітайзером (CSS-клас vs inline style mismatch у
  // _findChildOverlay) → лишався з backdrop-filter БЕЗ pointer-events:none →
  // iOS Safari composite захоплював всі тачі. Тепер pattern як event-edit-modal.
  const overlay = document.createElement('div');
  overlay.id = 'fin-analytics-modal-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:499;background:rgba(10,5,30,0.35);backdrop-filter:blur(2px);-webkit-backdrop-filter:blur(2px);pointer-events:none';
  document.body.appendChild(overlay);

  const modal = document.createElement('div');
  modal.id = 'fin-analytics-modal';
  modal.setAttribute('onclick', 'if(event.target===this)closeFinAnalytics()');
  modal.style.cssText = 'position:fixed;inset:0;z-index:500;display:flex;align-items:flex-end;justify-content:center';
  const allTxs = getFinance();
  const content = _buildAnalyticsContent(allTxs);
  modal.innerHTML = `
    <div style="position:relative;width:100%;max-width:480px;background:rgba(255,255,255,0.30);backdrop-filter:blur(32px);-webkit-backdrop-filter:blur(32px);border-radius:24px 24px 0 0;z-index:1;max-height:92vh;display:flex;flex-direction:column;overflow:hidden;border:1.5px solid rgba(255,255,255,0.5);box-shadow:0 -4px 24px rgba(30,16,64,0.1);animation:slideUp 0.3s ease-out forwards;pointer-events:auto">
      <div class="modal-handle" style="margin:8px auto"></div>
      <div style="padding:0 16px 8px;text-align:center">
        <div style="font-size:17px;font-weight:800;color:#1e1040">📊 ${t('finstat.title', 'Аналітика')}</div>
      </div>
      <div id="fin-analytics-scroll" style="flex:1;overflow-y:auto;padding:0 14px calc(env(safe-area-inset-bottom,0px) + 16px)">
        ${content}
      </div>
    </div>`;
  document.body.appendChild(modal);
  // MPVly-day2 06.05 (B-146): swipe-close ТIЛЬКИ від полоски (.modal-handle).
  // По кнопках/контенту тач не ловиться → click event працює.
  const card = modal.querySelector(':scope > div');
  if (card) setupModalSwipeClose(card, closeFinAnalytics, { handleOnly: true });
}

export function closeFinAnalytics() {
  document.getElementById('fin-analytics-modal')?.remove();
  document.getElementById('fin-analytics-modal-overlay')?.remove();
}

// === Обробники ===
export function setAnalyticsChartMode(mode) { logError('log', `[analytics-click] setAnalyticsChartMode(${mode})`, 'finance-analytics'); _analyticsChartMode = mode; _refreshAnalyticsContent(); }
export function setAnalyticsGranularity(g) { _analyticsGranularity = g; _refreshAnalyticsContent(); }
export function shiftAnalyticsMini(blockIdx, delta) {
  logError('log', `[analytics-click] shiftAnalyticsMini(${blockIdx}, ${delta})`, 'finance-analytics');
  _analyticsMiniIdx[blockIdx] = (_analyticsMiniIdx[blockIdx] + delta + 999) % 9;
  _refreshAnalyticsContent();
}
export function toggleAnalyticsBenchmarkEdit() { logError('log', `[analytics-click] toggleAnalyticsBenchmarkEdit`, 'finance-analytics'); _analyticsBenchmarkEdit = !_analyticsBenchmarkEdit; _refreshAnalyticsContent(); }
export function setBenchmarkField(key, field, value) {
  const cfg = _getBenchmarkConfig();
  if (!cfg[key]) return;
  cfg[key][field] = value;
  localStorage.setItem('nm_fin_benchmark', JSON.stringify(cfg));
}
export function resetBenchmarkConfig() {
  localStorage.removeItem('nm_fin_benchmark');
  _refreshAnalyticsContent();
}

// === Window exports (для inline onclick у HTML) ===
Object.assign(window, {
  openFinAnalytics, closeFinAnalytics,
  setAnalyticsChartMode, setAnalyticsGranularity, shiftAnalyticsMini, toggleAnalyticsBenchmarkEdit,
  setBenchmarkField, resetBenchmarkConfig,
});
