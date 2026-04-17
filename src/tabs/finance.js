// ============================================================
// finance.js — Фінанси — транзакції, бюджет, категорії
// Функції: renderFinance, openAddTransaction, openFinBudgetModal, processFinanceAction, sendFinanceBarMessage
// Залежності: core/nav.js, core/utils.js, core/trash.js, ai/core.js
//
// ФАЗА 1 чистки (15.04.2026 3229b): прибрано _finHeroCard, _finInsightCards,
// _finForecast, _finCoachBlock, _refreshFinCoach, _finWeekChart + benchmark
// текст із _finCatsBlock. Попередньо замінить K-01 (сітка категорій + круг)
// у Фазі 2. Див. ROADMAP.md → Блок 2 → Фінанси.
// ============================================================

import { currentTab, showToast } from '../core/nav.js';
import { escapeHtml } from '../core/utils.js';
import { addToTrash, showUndoToast } from '../core/trash.js';
import { SWIPE_DELETE_THRESHOLD, applySwipeTrail, clearSwipeTrail } from '../ui/swipe-delete.js';
import { getAIContext, getOWLPersonality, openChatBar, safeAgentReply, saveChatMsg } from '../ai/core.js';
import { tryBoardUpdate } from '../owl/proactive.js';
import { getInbox, saveInbox, renderInbox, addInboxChatMsg } from './inbox.js';
import { processUniversalAction } from './habits.js';
import { setupModalSwipeClose } from './tasks.js';
// Фаза 5 (15.04 6v2eR): синк медичних витрат → history картки Здоров'я
import { syncHealthFinanceToHistory } from './health.js';

// Категорії винесено у finance-cats.js (рефакторинг 17.04 gHCOh).
// Імпортуємо те що потрібно локально + re-export для backward compat.
import {
  finCatIcon, FIN_CAT_ICON_NAMES, pickRandomCatColor,
  getFinCats, saveFinCats, findFinCatById,
  createFinCategory, updateFinCategory, deleteFinCategory,
  mergeFinCategories, addFinSubcategory, findFinCatByName,
  moveFinCategory,
} from './finance-cats.js';
import { finDailyInsight, refreshFinInsight } from './finance-insight.js';
// Chat bar винесено у finance-chat.js — re-export для backward compat (ai/core.js, chips.js)
export { addFinanceChatMsg, sendFinanceBarMessage } from './finance-chat.js';

// Re-export щоб інші модулі (habits.js, inbox.js, nav.js, owl/*) працювали БЕЗ змін імпортів.
export {
  finCatIcon, FIN_CAT_ICON_NAMES, pickRandomCatColor,
  getFinCats, saveFinCats, findFinCatById,
  createFinCategory, updateFinCategory, deleteFinCategory,
  mergeFinCategories, addFinSubcategory, findFinCatByName,
  moveFinCategory,
};

// === FINANCE ===


// Storage
export function getFinance() { return JSON.parse(localStorage.getItem('nm_finance') || '[]'); }
export function saveFinance(arr) { localStorage.setItem('nm_finance', JSON.stringify(arr)); window.dispatchEvent(new CustomEvent('nm-data-changed', { detail: 'finance' })); }
export function getFinBudget() { return JSON.parse(localStorage.getItem('nm_finance_budget') || '{"total":0,"categories":{}}'); }
export function saveFinBudget(obj) { localStorage.setItem('nm_finance_budget', JSON.stringify(obj)); }

// Категорії — див. finance-cats.js. Всі exports re-exported зверху файлу.

// ===== STATE + валюта =====

// State
let currentFinTab = 'expense';
let currentFinPeriod = 'month';
let currentFinPeriodOffset = 0; // 0 = поточний, -1 = попередній, +1 = майбутній (Фаза 2 крок Б, свайп місяців)
let _finEditMode = false; // Фаза 2 крок В: режим редагування категорій (олівець у хедері)
// Експортуємо getter/setter — модалки (finance-modals.js) їх викликають через toggleFinEditMode.
export function getFinEditMode() { return _finEditMode; }
export function setFinEditMode(v) { _finEditMode = !!v; renderFinance(); }
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


// Фільтр транзакцій по періоду (legacy: тільки from, для зворотної сумісності з getFinanceContext тощо)
export function getFinPeriodRange(period) {
  return _getFinPeriodWindow(period, 0).from;
}

// Фаза 2 крок Б: вікно з offset для свайп-навігації місяців.
// Повертає {from, to, label}. offset=0 — поточний, -1 — попередній, +1 — наступний.
const _MONTH_NAMES = ['Січень','Лютий','Березень','Квітень','Травень','Червень','Липень','Серпень','Вересень','Жовтень','Листопад','Грудень'];
function _getFinPeriodWindow(period, offset) {
  const now = new Date();
  let from, to, label;
  if (period === 'week') {
    // Поточний тиждень Пн-Нд + offset тижнів
    const dayOfWeek = now.getDay() || 7; // 1-7 (1=Пн, 7=Нд)
    const monday = new Date(now);
    monday.setDate(now.getDate() - (dayOfWeek - 1) + (offset * 7));
    monday.setHours(0,0,0,0);
    const nextMonday = new Date(monday);
    nextMonday.setDate(monday.getDate() + 7);
    from = monday.getTime();
    to = nextMonday.getTime();
    if (offset === 0) label = 'Цей тиждень';
    else if (offset === -1) label = 'Минулий тиждень';
    else if (offset === 1) label = 'Наступний тиждень';
    else label = offset < 0 ? `${-offset} тижнів тому` : `+${offset} тижнів`;
  } else if (period === 'month') {
    const baseMonth = now.getMonth() + offset;
    const start = new Date(now.getFullYear(), baseMonth, 1);
    const end   = new Date(now.getFullYear(), baseMonth + 1, 1);
    from = start.getTime();
    to = end.getTime();
    label = `${_MONTH_NAMES[start.getMonth()]} ${start.getFullYear()}`;
  } else { // 3months
    // Поточний 3-місячний блок: останні 3 місяці включаючи поточний (offset=0)
    const startMonth = now.getMonth() - 2 + (offset * 3);
    const start = new Date(now.getFullYear(), startMonth, 1);
    const end   = new Date(now.getFullYear(), startMonth + 3, 1);
    from = start.getTime();
    to = end.getTime();
    if (offset === 0) label = 'Останні 3 місяці';
    else if (offset === -1) label = 'Попередні 3 місяці';
    else label = offset < 0 ? `${-offset * 3} місяців тому` : `+${offset * 3} місяців`;
  }
  return { from, to, label };
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
  currentFinPeriodOffset = 0; // ресет offset при зміні типу періоду
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

// Фаза 2 крок Б: навігація стрілками (альтернатива свайпу)
function shiftFinPeriod(delta) {
  currentFinPeriodOffset += delta;
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

  // Фаза 2 крок Б: вікно з offset (свайп навігація місяців)
  const win = _getFinPeriodWindow(currentFinPeriod, currentFinPeriodOffset);
  const allTxs = getFinance().filter(t => t.ts >= win.from && t.ts < win.to);

  // Сітка категорій рендериться завжди (навіть якщо порожньо) — щоб юзер міг тапнути категорію
  // і додати першу транзакцію + щоб свайп працював коли немає даних у періоді.
  let gridHtml = '';
  try { gridHtml = _finCatsGrid(allTxs, win); } catch(e) { console.error('[finance] _finCatsGrid error:', e); }
  wrap.innerHTML =
    gridHtml +
    finDailyInsight(allTxs, currentFinPeriod, currentFinPeriodOffset) +
    (allTxs.length > 0 ? _finTxsBlock(allTxs) : _finEmptyTxsHint());

  _attachFinSwipe();
  _attachFinTxSwipeDelete(); // B-37: свайп-видалення транзакцій
  // Async: оновити інсайт дня через AI якщо кеш застарілий
  refreshFinInsight(allTxs, win, currentFinPeriod, currentFinPeriodOffset);
}

// B-54: свайп-видалення транзакцій.
// Картка свайпається до СЕРЕДИНИ (50% ширини) → за нею градієнт від прозорого до червоного,
// SVG-іконка кошика справа поверх градієнта. Тап на кошик = видалення з undo.
// Свайп вправо >30px = скасування. Кнопка кошика створюється LAZY (тільки під час свайпу).
const SWIPE_OPEN_RATIO = 0.5; // картка зсувається на 50% власної ширини

function _deleteFinTxById(txId) {
  const item = getFinance().find(t => t.id === txId);
  saveFinance(getFinance().filter(t => t.id !== txId));
  if (item) addToTrash('finance', item);
  renderFinance();
  try { localStorage.setItem('nm_owl_tab_ts_finance', '0'); tryBoardUpdate('finance'); } catch(e) {}
  if (item) showUndoToast('Операцію видалено', () => {
    const txs = getFinance(); txs.unshift(item); saveFinance(txs); renderFinance();
  });
}

function _attachFinTxSwipeDelete() {
  const wraps = document.querySelectorAll('.fin-tx-swipe-wrap');
  wraps.forEach(sw => {
    if (sw._swipeBound) return;
    sw._swipeBound = true;
    let startX = 0, startY = 0, dx = 0, locked = false;
    const card = sw.querySelector('.tx-row');
    if (!card) return;

    // LAZY: bin створюється лише коли почався свайп. Прибирається після закриття.
    let bin = null;
    const ensureBin = () => {
      if (bin) return;
      const w = Math.round(sw.offsetWidth * SWIPE_OPEN_RATIO);
      bin = document.createElement('button');
      bin.className = 'fin-tx-bin';
      bin.setAttribute('aria-label', 'Видалити');
      // Градієнт від прозорого зліва → червоний справа. Кошик-іконка по правому краю.
      bin.style.cssText = `position:absolute;right:0;top:0;bottom:0;width:${w}px;display:flex;align-items:center;justify-content:flex-end;padding-right:22px;background:linear-gradient(to right, rgba(239,68,68,0) 0%, rgba(239,68,68,0.95) 75%);border:none;cursor:pointer;z-index:0;font-family:inherit;border-radius:0 10px 10px 0`;
      bin.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';
      bin.addEventListener('click', (e) => {
        e.stopPropagation();
        const txId = parseInt(sw.dataset.txId);
        if (!isNaN(txId)) _deleteFinTxById(txId);
      });
      sw.appendChild(bin);
    };
    const removeBin = () => {
      if (bin && bin.parentNode) bin.parentNode.removeChild(bin);
      bin = null;
    };

    const getOpenOffset = () => -Math.round(sw.offsetWidth * SWIPE_OPEN_RATIO);
    const setOffset = (offset, animate = false) => {
      card.style.transition = animate ? 'transform 0.25s ease' : '';
      card.style.transform = `translateX(${offset}px)`;
    };
    const openSwipe = () => { sw._open = true; ensureBin(); setOffset(getOpenOffset(), true); };
    const closeSwipe = () => {
      sw._open = false;
      setOffset(0, true);
      setTimeout(() => { if (!sw._open) removeBin(); }, 280); // після завершення transition
    };

    // Тап на картку при відкритому свайпі → закриваємо (не відкриваємо редагування)
    card.addEventListener('click', (e) => {
      if (sw._open) { e.stopPropagation(); e.preventDefault(); closeSwipe(); }
    }, true);

    sw.addEventListener('touchstart', (e) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      dx = 0; locked = false;
      card.style.transition = '';
    }, { passive: true });

    sw.addEventListener('touchmove', (e) => {
      if (locked) return;
      const ddx = e.touches[0].clientX - startX;
      const ddy = e.touches[0].clientY - startY;
      if (Math.abs(dx) < 5 && Math.abs(ddy) > Math.abs(ddx)) { locked = true; return; }
      dx = ddx;
      // Перший свайп вліво створює bin (lazy)
      if (dx < 0 && !sw._open && !bin) ensureBin();
      const baseOffset = sw._open ? getOpenOffset() : 0;
      const newOffset = Math.min(0, baseOffset + dx);
      setOffset(newOffset);
    }, { passive: true });

    sw.addEventListener('touchend', () => {
      if (locked) { if (sw._open) openSwipe(); else closeSwipe(); return; }
      // Поріг = 50% від цільового offset (тобто чверть ширини картки)
      const threshold = sw.offsetWidth * SWIPE_OPEN_RATIO * 0.5;
      if (sw._open) {
        if (dx > 30) closeSwipe(); else openSwipe();
      } else {
        if (dx < -threshold) openSwipe(); else closeSwipe();
      }
    }, { passive: true });
  });
}

function _finEmptyTxsHint() {
  return `<div style="background:rgba(255,255,255,0.5);border:1.5px dashed rgba(30,16,64,0.12);border-radius:16px;padding:16px;text-align:center;margin-bottom:12px">
    <div style="font-size:13px;color:rgba(30,16,64,0.45);font-weight:600">У цьому періоді транзакцій немає</div>
    <div style="font-size:11px;color:rgba(30,16,64,0.35);font-weight:500;margin-top:4px">Тапни категорію щоб додати або свайпни ←→ для іншого періоду</div>
  </div>`;
}


// Фаза 2 крок Б: touch-обробники для свайп-гортання періодів
// (Drag-n-drop через long-press прибрано 15.04.2026 — переміщення тепер через
// кнопки ↑/↓ у модалці редагування категорії, див. moveFinCategory)
let _finSwipeAttached = false;
function _attachFinSwipe() {
  if (_finSwipeAttached) return;
  const wrap = document.getElementById('fin-v2-wrap');
  if (!wrap) return;
  let startX = 0, startY = 0, onGrid = false;
  wrap.addEventListener('touchstart', (e) => {
    onGrid = !_finEditMode && !!e.target.closest('#fin-cats-grid-wrap'); // у edit-режимі свайп вимкнено
    if (!onGrid) return;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
  }, { passive: true });
  wrap.addEventListener('touchend', (e) => {
    if (!onGrid) return;
    onGrid = false;
    const dx = e.changedTouches[0].clientX - startX;
    const dy = e.changedTouches[0].clientY - startY;
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
    if (dx < 0) currentFinPeriodOffset++;
    else currentFinPeriodOffset--;
    renderFinance();
  }, { passive: true });
  _finSwipeAttached = true;
}


// Сітка категорій з кругом-Hero посередині.
// Layout: 4 колонки × 4 ряди. Круг = grid-item що займає колонки 2-3 і ряди 2-3 (центр).
// Інші категорії автоматично обтікають круг (grid auto-flow).
// Помістяться 8 категорій навколо круга (4 у ряді 1 + 1+1 у рядах 2-3 + 4 у ряді 4 = 12)
// Зачекайте: 4 + 2 + 2 + 4 = 12. Правильно. Додаткові — у overflow-ряди знизу.
function _finCatsGrid(allTxs, win) {
  const cats = getFinCats();
  const isExpense = currentFinTab === 'expense';
  // B-70 fix: фільтруємо биті категорії (без id/name) — захист на випадок якщо _migrateFinCats
  // не дістало всіх (наприклад AI створив неповний об'єкт після міграції).
  const catList = (isExpense ? cats.expense : cats.income)
    .filter(c => c && c.id && c.name && !c.archived);
  const txs = allTxs.filter(t => t.type === (isExpense ? 'expense' : 'income'));
  const totalSum = txs.reduce((s, t) => s + t.amount, 0);
  const periodLabel = win?.label || '';

  // Сума по кожній категорії
  const catMap = {};
  txs.forEach(t => { catMap[t.category] = (catMap[t.category] || 0) + t.amount; });

  // Сортуємо: за полем .order (з міграції)
  const sorted = [...catList].sort((a, b) => (a.order || 0) - (b.order || 0));

  // Перші 12 категорій ідуть у grid-сітку 4×4 з кругом 2×2 у центрі.
  // Решта — у overflow-ряд знизу.
  const inGrid = sorted.slice(0, 12);
  const overflow = sorted.slice(12);

  const renderCell = (cat) => {
    const sum = catMap[cat.name] || 0;
    const sumStr = sum > 0 ? formatMoney(sum) : '0 ' + getCurrency();
    const sumCol = sum > 0 ? cat.color : 'rgba(30,16,64,0.25)';
    // У edit-режимі — тап = редагування. У звичайному — тап = додати транзакцію.
    const onClick = _finEditMode
      ? `openCategoryEditModal('${escapeHtml(cat.id)}')`
      : `openAddTransaction({category: '${escapeHtml(cat.name)}', type: '${isExpense ? 'expense' : 'income'}'})`;
    // У edit-режимі кружечок підсвічений (легка border-shimmer) щоб юзер бачив що тап = редагування
    const editStyle = _finEditMode ? 'box-shadow:0 0 0 2px ' + cat.color + '55;' : '';
    return `<div onclick="${onClick}" style="display:flex;flex-direction:column;align-items:center;cursor:pointer;padding:4px 0;min-width:0">
      <div style="font-size:11px;font-weight:600;color:rgba(30,16,64,0.55);margin-bottom:4px;text-align:center;max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(cat.name)}</div>
      <div style="width:48px;height:48px;border-radius:50%;background:${cat.color}20;display:flex;align-items:center;justify-content:center;${editStyle}">
        ${finCatIcon(cat.icon, cat.color, 22)}
      </div>
      <div style="font-size:11px;font-weight:700;color:${sumCol};margin-top:4px">${sumStr}</div>
    </div>`;
  };

  // У edit-режимі — додаткова комірка "+" як остання категорія
  const renderAddCell = () => `<div onclick="openCategoryEditModal('new')" style="display:flex;flex-direction:column;align-items:center;cursor:pointer;padding:4px 0;min-width:0">
    <div style="font-size:11px;font-weight:600;color:rgba(30,16,64,0.4);margin-bottom:4px">Додати</div>
    <div style="width:48px;height:48px;border-radius:50%;background:rgba(194,65,12,0.08);border:2px dashed rgba(194,65,12,0.35);display:flex;align-items:center;justify-content:center">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#c2410c" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
    </div>
    <div style="font-size:11px;font-weight:700;color:rgba(30,16,64,0.25);margin-top:4px">&nbsp;</div>
  </div>`;

  const gridCells = inGrid.map(renderCell).join('') + (_finEditMode && inGrid.length < 12 ? renderAddCell() : '');
  const overflowCells = overflow.map(renderCell).join('') + (_finEditMode && inGrid.length >= 12 ? renderAddCell() : '');

  // Центральний круг-Hero (grid-item, займає колонки 2-3 і ряди 2-3)
  // B-60: товстий donut-chart з кольоровими сегментами по категоріях (пропорційно витратам)
  const heroLabel = isExpense ? 'Витрати' : 'Доходи';
  const heroCol = isExpense ? '#c2410c' : '#16a34a';
  const donutR = 42;
  const donutCirc = 2 * Math.PI * donutR; // ~263.9
  // Рахуємо сегменти: категорії з сумами > 0, відсортовані за сумою desc
  const donutSegs = [];
  if (totalSum > 0) {
    const withSums = sorted.map(c => ({ c, sum: catMap[c.name] || 0 })).filter(s => s.sum > 0).sort((a,b) => b.sum - a.sum);
    let offset = 0;
    withSums.forEach(({ c, sum }) => {
      const pct = sum / totalSum;
      const segLen = pct * donutCirc;
      donutSegs.push({ color: c.color, segLen, offset });
      offset += segLen;
    });
  }
  const donutRings = donutSegs.map(s =>
    `<circle cx="50" cy="50" r="${donutR}" fill="none" stroke="${s.color}" stroke-width="9"
             stroke-dasharray="${s.segLen.toFixed(2)} ${donutCirc.toFixed(2)}"
             stroke-dashoffset="${(-s.offset).toFixed(2)}"
             transform="rotate(-90 50 50)"/>`
  ).join('');
  // Базове сіре кільце (видно якщо totalSum=0 або якщо сегменти не покривають 100%)
  const donutBase = `<circle cx="50" cy="50" r="${donutR}" fill="none" stroke="rgba(30,16,64,0.06)" stroke-width="9"/>`;
  const heroCircle = `<div onclick="toggleFinTabType()" style="grid-column:2/4;grid-row:2/4;position:relative;cursor:pointer;user-select:none;aspect-ratio:1;align-self:center;justify-self:center;width:100%;max-width:170px">
    <svg viewBox="0 0 100 100" style="width:100%;height:100%;display:block;filter:drop-shadow(0 4px 12px rgba(30,16,64,0.08))">
      ${donutBase}${donutRings}
      <circle cx="50" cy="50" r="${donutR - 5}" fill="rgba(255,255,255,0.95)"/>
    </svg>
    <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;pointer-events:none">
      <div style="font-size:10px;font-weight:700;color:rgba(30,16,64,0.45);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:2px">${heroLabel}</div>
      <div style="font-size:20px;font-weight:900;color:${heroCol};line-height:1">${formatMoney(totalSum)}</div>
    </div>
  </div>`;

  // Хедер блоку: у звичайному режимі — стрілки навігації + лейбл + олівець ✎.
  // У edit-режимі — лейбл "Редагування" + кнопка "Готово".
  const isCurrent = currentFinPeriodOffset === 0;
  const headerHtml = _finEditMode
    ? `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;user-select:none">
        <div style="width:32px"></div>
        <div style="display:flex;flex-direction:column;align-items:center;gap:2px;flex:1">
          <div style="font-size:14px;font-weight:800;color:#c2410c">Редагування категорій</div>
          <div style="font-size:10px;font-weight:600;color:rgba(30,16,64,0.4);text-transform:uppercase;letter-spacing:0.06em">тапни щоб редагувати або +</div>
        </div>
        <button onclick="toggleFinEditMode()" aria-label="Готово" style="padding:6px 14px;border-radius:14px;border:none;background:#c2410c;color:white;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">Готово</button>
      </div>`
    : `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;user-select:none">
        <button onclick="shiftFinPeriod(-1)" aria-label="Попередній період" style="width:32px;height:32px;border-radius:50%;border:none;background:rgba(30,16,64,0.05);color:rgba(30,16,64,0.55);font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;font-family:inherit">‹</button>
        <div style="display:flex;flex-direction:column;align-items:center;gap:2px;flex:1">
          <div style="font-size:14px;font-weight:800;color:#1e1040">${escapeHtml(periodLabel)}</div>
          ${!isCurrent ? `<div onclick="shiftFinPeriod(${-currentFinPeriodOffset})" style="font-size:10px;font-weight:700;color:#c2410c;cursor:pointer;text-transform:uppercase;letter-spacing:0.06em">↺ до сьогодні</div>` : `<div style="font-size:10px;font-weight:600;color:rgba(30,16,64,0.3);text-transform:uppercase;letter-spacing:0.06em">свайп ←→ для навігації</div>`}
        </div>
        <div style="display:flex;align-items:center;gap:4px">
          <button onclick="toggleFinEditMode()" aria-label="Редагувати категорії" title="Редагувати категорії" style="width:32px;height:32px;border-radius:50%;border:none;background:rgba(30,16,64,0.05);color:rgba(30,16,64,0.55);cursor:pointer;display:flex;align-items:center;justify-content:center;font-family:inherit">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
          </button>
          <button onclick="shiftFinPeriod(1)" aria-label="Наступний період" style="width:32px;height:32px;border-radius:50%;border:none;background:rgba(30,16,64,0.05);color:rgba(30,16,64,0.55);font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;font-family:inherit">›</button>
        </div>
      </div>`;

  // Круг ПЕРШИМ у DOM щоб grid знав про зайняті 2×2 і обтікав ним.
  // grid-auto-flow:dense додатково дозволяє заповнити дірки якщо є.
  return `<div id="fin-cats-grid-wrap" class="card-glass-blur" style="padding:14px;margin-bottom:12px">
    ${headerHtml}
    <div style="display:grid;grid-template-columns:repeat(4,1fr);grid-template-rows:repeat(4,1fr);gap:10px;grid-auto-flow:row dense">
      ${heroCircle}
      ${gridCells}
    </div>
    ${overflow.length > 0 ? `<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:14px">${overflowCells}</div>` : ''}
  </div>`;
}

// Перемикач Витрати ⇄ Доходи (тап на круг)
function toggleFinTabType() {
  currentFinTab = currentFinTab === 'expense' ? 'income' : 'expense';
  renderFinance();
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

function _finTxsBlock(allTxs) {
  const sorted = [...allTxs].sort((a,b) => b.ts-a.ts).slice(0, 8);
  const rows = sorted.map(t => {
    const isExp = t.type === 'expense';
    const dateStr = new Date(t.ts).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' });
    // B-53: показуємо підкатегорію дрібним текстом після категорії через · розділювач
    const categoryLine = t.subcategory
      ? `<span style="font-weight:700;color:#1e1040">${escapeHtml(t.category)}</span><span style="font-size:11px;font-weight:500;color:rgba(30,16,64,0.4);margin-left:4px">· ${escapeHtml(t.subcategory)}</span>`
      : `<span style="font-weight:700;color:#1e1040">${escapeHtml(t.category)}</span>`;
    // B-37: обгортка для swipe-delete (swipe-wrap → tx-row)
    return `<div class="fin-tx-swipe-wrap" data-tx-id="${t.id}" style="position:relative;overflow:hidden;border-radius:10px">
      <div class="tx-row" onclick="openEditTransaction(${t.id})" style="position:relative;z-index:1;background:#fff">
        <div style="flex:1;min-width:0">
          <div style="font-size:13px">${categoryLine}</div>
          ${t.comment ? `<div style="font-size:11px;color:rgba(30,16,64,0.4);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(t.comment)}</div>` : ''}
        </div>
        <div style="text-align:right;flex-shrink:0">
          <div style="font-size:14px;font-weight:800;color:${isExp?'#c2410c':'#16a34a'}">${isExp?'-':'+'}${formatMoney(t.amount)}</div>
          <div style="font-size:10px;color:rgba(30,16,64,0.35)">${dateStr}</div>
        </div>
      </div>
    </div>`;
  }).join('');

  const moreBtn = allTxs.length > 8
    ? `<div onclick="openAllTransactions()" style="text-align:center;margin-top:10px;font-size:13px;font-weight:700;color:#c2410c;cursor:pointer">Всі транзакції (${allTxs.length}) <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#c2410c" stroke-width="2.5" stroke-linecap="round" style="vertical-align:middle"><polyline points="9 18 15 12 9 6"/></svg></div>`
    : '';

  return `<div class="card-glass-blur">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
      <div class="fin-section-label">Останні транзакції</div>
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
    // B-53: підкатегорія дрібним текстом поруч
    const categoryLine = t.subcategory
      ? `<span style="font-weight:700;color:#1e1040">${escapeHtml(t.category)}</span><span style="font-size:11px;font-weight:500;color:rgba(30,16,64,0.4);margin-left:4px">· ${escapeHtml(t.subcategory)}</span>`
      : `<span style="font-weight:700;color:#1e1040">${escapeHtml(t.category)}</span>`;
    return `<div class="tx-row" onclick="document.getElementById('fin-all-txs-modal').remove();openEditTransaction(${t.id})">
      <div style="flex:1;min-width:0">
        <div style="font-size:13px">${categoryLine}</div>
        ${t.comment ? `<div style="font-size:11px;color:rgba(30,16,64,0.4)">${escapeHtml(t.comment)}</div>` : ''}
      </div>
      <div style="text-align:right;flex-shrink:0">
        <div style="font-size:14px;font-weight:800;color:${isExp?'#c2410c':'#16a34a'}">${isExp?'-':'+'}${formatMoney(t.amount)}</div>
        <div style="font-size:10px;color:rgba(30,16,64,0.35)">${dateStr}</div>
      </div>
    </div>`;
  }).join('');
  modal.innerHTML = `
    <div onclick="document.getElementById('fin-all-txs-modal').remove()" class="modal-backdrop"></div>
    <div style="position:relative;width:100%;max-width:480px;background:rgba(255,255,255,0.95);backdrop-filter:blur(24px);border-radius:24px;margin:0 16px 16px;z-index:1;padding:16px 16px calc(env(safe-area-inset-bottom)+16px);max-height:80vh;overflow-y:auto;box-sizing:border-box">
      <div class="modal-handle"></div>
      <div style="font-size:16px;font-weight:800;color:#1e1040;margin-bottom:12px">Всі транзакції (${allTxs.length})</div>
      ${rows || '<div style="font-size:14px;color:rgba(30,16,64,0.3);text-align:center;padding:16px">Немає транзакцій</div>'}
    </div>`;
  document.body.appendChild(modal);
}



// === processFinanceAction (з Inbox) і getFinanceContext (для AI) ===

// Визначення дати транзакції: AI date → "вчора/позавчора" → Date.now()
export function _resolveFinanceDate(aiDate, text) {
  if (aiDate) {
    const d = new Date(aiDate + 'T12:00:00');
    if (!isNaN(d.getTime())) return d.getTime();
  }
  const lower = (text || '').toLowerCase();
  const now = new Date();
  if (/\bвчора\b/.test(lower)) {
    now.setDate(now.getDate() - 1);
    now.setHours(20, 0, 0, 0);
    return now.getTime();
  }
  if (/\bпозавчора\b/.test(lower)) {
    now.setDate(now.getDate() - 2);
    now.setHours(20, 0, 0, 0);
    return now.getTime();
  }
  return Date.now();
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

  const catList = type === 'expense' ? cats.expense : cats.income;
  if (!catList.some(c => c.name === category)) {
    createFinCategory(type, { name: category });
  }

  const ts = _resolveFinanceDate(parsed.date, originalText);

  const txs = getFinance();
  txs.unshift({ id: Date.now(), type, amount, category, comment, ts });
  saveFinance(txs);

  const items = getInbox();
  items.unshift({ id: Date.now(), text: originalText, category: 'finance', ts, processed: true });
  saveInbox(items);
  renderInbox();

  if (currentTab === 'finance') renderFinance();

  // Фаза 5 (15.04 6v2eR): синк медичних витрат
  if (type === 'expense') {
    try { syncHealthFinanceToHistory(amount, category, comment); } catch (e) {}
  }

  addInboxChatMsg('agent', `${type === 'expense' ? '-' : '+'}${formatMoney(amount)} · ${category}${parsed.fin_comment ? ' — ' + parsed.fin_comment : ''}`);

  checkFinBudgetWarning(type, category, amount);
}

function checkFinBudgetWarning(type, category, amount) {
  if (type !== 'expense') return;
  const budget = getFinBudget();
  const from = getFinPeriodRange('month');
  const txs = getFinance().filter(t => t.type === 'expense' && t.ts >= from);
  const totalSpent = txs.reduce((s, t) => s + t.amount, 0);
  if (budget.total > 0) {
    const pct = totalSpent / budget.total;
    if (pct >= 1) addInboxChatMsg('agent', `⚠️ Загальний бюджет на місяць перевищено. Витрачено ${formatMoney(totalSpent)} з ${formatMoney(budget.total)}.`);
    else if (pct >= 0.8) addInboxChatMsg('agent', `💡 До ліміту місяця залишилось ${formatMoney(budget.total - totalSpent)}.`);
  }
  const catLimit = budget.categories?.[category];
  if (catLimit > 0) {
    const catSpent = txs.filter(t => t.category === category).reduce((s, t) => s + t.amount, 0);
    const pct = catSpent / catLimit;
    if (pct >= 1) addInboxChatMsg('agent', `⚠️ Ліміт по "${category}" перевищено: ${formatMoney(catSpent)} з ${formatMoney(catLimit)}.`);
    else if (pct >= 0.8) addInboxChatMsg('agent', `💡 По "${category}" залишилось ${formatMoney(catLimit - catSpent)}.`);
  }
}

// B-32 fix: явні маркери [MONTH_TOTAL], [TODAY_TOTAL] щоб AI не вигадував числа
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

  let parts = [`[MONTH_EXPENSES:${formatMoney(totalExp)}] [MONTH_INCOME:${formatMoney(totalInc)}] Фінанси за місяць: витрати ${formatMoney(totalExp)}, доходи ${formatMoney(totalInc)}`];
  if (budget.total > 0) parts.push(`[BUDGET:${formatMoney(budget.total)}] бюджет ${formatMoney(budget.total)}, залишилось ${formatMoney(budget.total - totalExp)}`);
  if (top3) parts.push(`топ категорії: ${top3}`);
  if (todaySum > 0) parts.push(`[TODAY_EXPENSES:${formatMoney(todaySum)}] сьогодні витрачено ${formatMoney(todaySum)}`);
  else parts.push('[TODAY_EXPENSES:0] сьогодні витрат не було');

  const recentTxs = txs.slice(0, 5).map(t => `[ID:${t.id}] ${t.type === 'expense' ? '-' : '+'}${t.amount}${getCurrency()} ${t.category}${t.comment ? ' ('+t.comment+')' : ''}`).join('; ');
  if (recentTxs) parts.push(`Останні транзакції (використовуй ID для update_transaction): ${recentTxs}`);

  return parts.join('\n');
}

// === WINDOW EXPORTS (HTML handlers only) ===
// Більшість функцій модалок експортує finance-modals.js (її власний Object.assign).
// finance-analytics.js робить те саме для аналітики.
// Тут — тільки те що залишилось у ядрі (нав, перемикачі періоду, перегляд всіх транзакцій).
Object.assign(window, {
  setCurrency, setFinPeriod, switchFinTab, openAllTransactions,
  toggleFinTabType, // тап на круг = перемикач Витрати⇄Доходи
  shiftFinPeriod,   // стрілки навігації періоду
});
