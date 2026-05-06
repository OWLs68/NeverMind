// ============================================================
// finance-modals.js — Модалки Фінансів (транзакція, бюджет, категорія, дата)
// Винесено з finance.js у рефакторингу 17.04.2026 (сесія gHCOh).
// Містить: модалку транзакції з калькулятором, datepicker, бюджет, категорію.
// ============================================================

import { showToast } from '../core/nav.js';
import { escapeHtml, t } from '../core/utils.js';
import { addToTrash, showUndoToast } from '../core/trash.js';
import { tryBoardUpdate } from '../owl/proactive.js';
import { setupModalSwipeClose } from './tasks.js';
import {
  getFinance, saveFinance, renderFinance, formatMoney, getCurrency,
  getFinBudget, saveFinBudget, getFinEditMode, setFinEditMode,
} from './finance.js';
import {
  getFinCats, finCatIcon, FIN_CAT_ICON_NAMES,
  pickRandomCatColor, findFinCatById, createFinCategory,
  updateFinCategory, deleteFinCategory, moveFinCategory,
} from './finance-cats.js';

// FIN_CAT_PALETTE потрібна для picker'а — імпортую звідти ж
const FIN_CAT_PALETTE = [
  '#f97316','#f59e0b','#eab308','#84cc16','#22c55e','#14b8a6',
  '#06b6d4','#0ea5e9','#3b82f6','#ef4444','#f43f5e','#ec4899',
  '#78716c','#a16207',
];

// === Модалка транзакції === state
let _finEditId = null;
let _finTxComment = '';
let _finTxCurrentType = 'expense';
let _finTxCategory = '';
let _finTxSubcategory = '';
let _finTxExpression = '';
let _finTxDate = Date.now();

// === Модалка категорії === state
let _finEditingCatId = null;
let _finCatModalDraft = null;
let _catModalIconExpanded = false;
let _catModalColorExpanded = false;

// === Закриття ===
export function closeFinTxModal() { document.getElementById('fin-tx-modal')?.remove(); }
export function closeFinDateModal() { document.getElementById('fin-date-modal')?.remove(); }
export function closeFinBudgetModal() { document.getElementById('fin-budget-modal')?.remove(); }
export function closeCategoryEditModal() {
  document.getElementById('fin-cat-edit-modal')?.remove();
  _finEditingCatId = null;
  _finCatModalDraft = null;
}

// === Калькулятор: безпечний парсер виразів (БЕЗ eval) ===
function _safeFinCalc(expr) {
  if (!expr) return 0;
  const norm = String(expr).replace(/×/g, '*').replace(/÷/g, '/').replace(/,/g, '.').replace(/\s+/g, '');
  const tokens = norm.match(/(\d+\.?\d*|\.\d+|[+\-*/])/g);
  if (!tokens || tokens.length === 0) return 0;
  let nums = [];
  let ops = [];
  let i = 0;
  if (tokens[0] === '-' && tokens.length > 1) {
    nums.push(-parseFloat(tokens[1]));
    i = 2;
  } else {
    nums.push(parseFloat(tokens[0]));
    i = 1;
  }
  while (i < tokens.length) {
    const op = tokens[i];
    const num = parseFloat(tokens[i + 1]);
    if (isNaN(num)) break;
    ops.push(op);
    nums.push(num);
    i += 2;
  }
  for (let j = 0; j < ops.length; j++) {
    if (ops[j] === '*' || ops[j] === '/') {
      const result = ops[j] === '*' ? nums[j] * nums[j + 1] : (nums[j + 1] !== 0 ? nums[j] / nums[j + 1] : 0);
      nums[j] = result;
      nums.splice(j + 1, 1);
      ops.splice(j, 1);
      j--;
    }
  }
  let result = nums[0];
  for (let j = 0; j < ops.length; j++) {
    result = ops[j] === '+' ? result + nums[j + 1] : result - nums[j + 1];
  }
  return Math.round(result * 100) / 100;
}

export function finCalcAppend(token) {
  const last = _finTxExpression.slice(-1);
  const isOp = (c) => '+-*/×÷'.includes(c);
  if (isOp(token) && isOp(last)) {
    _finTxExpression = _finTxExpression.slice(0, -1) + token;
  } else if (token === ',' || token === '.') {
    const lastNum = _finTxExpression.split(/[+\-*/×÷]/).pop();
    if (lastNum.includes(',') || lastNum.includes('.')) return;
    if (!lastNum) _finTxExpression += '0';
    _finTxExpression += ',';
  } else {
    _finTxExpression += token;
  }
  _refreshTransactionModal();
}

export function finCalcBackspace() {
  if (!_finTxExpression) return;
  _finTxExpression = _finTxExpression.slice(0, -1);
  _refreshTransactionModal();
}

export function selectFinTxMainCat(name) {
  _finTxCategory = name;
  _finTxSubcategory = '';
  _refreshTransactionModal();
}

export function setFinTxType(type) {
  _finTxCurrentType = type === 'income' ? 'income' : 'expense';
  _finTxCategory = '';
  _finTxSubcategory = '';
  _refreshTransactionModal();
}

export function selectFinTxSubcat(name) {
  _finTxSubcategory = (_finTxSubcategory === name) ? '' : name;
  _refreshTransactionModal();
}

function _refreshTransactionModal() {
  const modal = document.getElementById('fin-tx-modal');
  if (modal) modal.innerHTML = _renderTransactionModalBody();
}

// === Лейбл дати ===
function _finTxDateLabel(ts) {
  const d = new Date(ts);
  const today = new Date(); today.setHours(0,0,0,0);
  const yest = new Date(today); yest.setDate(today.getDate() - 1);
  const day2 = new Date(today); day2.setDate(today.getDate() - 2);
  const dDate = new Date(d); dDate.setHours(0,0,0,0);
  if (dDate.getTime() === today.getTime()) return t('finance.date.today', 'Сьогодні');
  if (dDate.getTime() === yest.getTime()) return t('finance.date.yesterday', 'Вчора');
  if (dDate.getTime() === day2.getTime()) return t('finance.date.day_before_yesterday', 'Позавчора');
  return d.toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric' });
}

// === Відкриття модалки ===
export function openAddTransaction(prefill = {}) {
  _finEditId = null;
  _finTxComment = prefill.comment || '';
  const type = prefill.type || 'expense';
  _showTransactionModal({ type, amount: prefill.amount || '', category: prefill.category || '', comment: prefill.comment || '', ts: prefill.ts });
}

export function openEditTransaction(id) {
  const txs = getFinance();
  const tx = txs.find(x => x.id === id);
  if (!tx) return;
  _finEditId = id;
  _finTxComment = tx.comment || '';
  _showTransactionModal(tx);
}

function _showTransactionModal(data) {
  _finTxCurrentType = data.type === 'income' ? 'income' : 'expense';
  _finTxCategory = data.category || '';
  _finTxSubcategory = data.subcategory || '';
  _finTxExpression = data.amount ? String(data.amount).replace('.', ',') : '';
  _finTxDate = data.ts || Date.now();

  const existing = document.getElementById('fin-tx-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'fin-tx-modal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:500;display:flex;align-items:flex-end;justify-content:center;padding:0 16px 16px';
  modal.innerHTML = _renderTransactionModalBody();
  document.body.appendChild(modal);
  setupModalSwipeClose(modal.querySelector('div:last-child'), closeFinTxModal);
}

function _renderTransactionModalBody() {
  const cats = getFinCats();
  const isExpense = _finTxCurrentType !== 'income';
  const isEdit = _finEditId !== null;
  const catList = (isExpense ? cats.expense : cats.income).filter(c => !c.archived);
  const matchedCat = catList.find(c => c.name === _finTxCategory);
  const subcats = matchedCat?.subcategories || [];

  let title;
  if (_finTxCategory) {
    title = isEdit
      ? (isExpense
          ? t('finance.tx.edit_expense_with_cat', 'Редагувати: {cat}', { cat: _finTxCategory })
          : t('finance.tx.edit_income_with_cat', 'Редагувати дохід: {cat}', { cat: _finTxCategory }))
      : _finTxCategory;
  } else {
    title = isEdit
      ? (isExpense ? t('finance.tx.edit_expense', 'Редагувати витрату') : t('finance.tx.edit_income', 'Редагувати дохід'))
      : (isExpense ? t('finance.tx.new_expense', 'Нова витрата') : t('finance.tx.new_income', 'Новий дохід'));
  }

  const calcResult = _safeFinCalc(_finTxExpression);
  const displayAmount = _finTxExpression || '0';
  const calcCol = isExpense ? '#c2410c' : '#16a34a';
  const dateLabel = _finTxDateLabel(_finTxDate);

  const showCatPicker = !_finTxCategory || isEdit;
  const catPickerHtml = showCatPicker ? `
    <div id="fntx-cats-wrap" style="margin-bottom:12px">
      <div style="font-size:10px;font-weight:800;color:rgba(30,16,64,0.55);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:8px">${t('finance.tx.category_label', 'Категорія')}</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px">
        ${catList.map(c => {
          const active = c.name === _finTxCategory;
          return `<button onclick="selectFinTxMainCat('${escapeHtml(c.name)}')" style="padding:7px 14px;border-radius:18px;font-size:13.5px;font-weight:800;cursor:pointer;font-family:inherit;border:2px solid ${active ? '#c2410c' : 'rgba(30,16,64,0.12)'};background:${active ? 'rgba(194,65,12,0.14)' : 'white'};color:${active ? '#c2410c' : '#1e1040'}">${escapeHtml(c.name)}</button>`;
        }).join('')}
      </div>
    </div>` : '';

  const subcatsHtml = subcats.length > 0 ? `
    <div style="margin-bottom:12px;padding-left:10px;border-left:2px solid rgba(194,65,12,0.18)">
      <div style="font-size:9px;font-weight:700;color:rgba(30,16,64,0.35);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:5px">${t('finance.tx.subcategory_label', 'Підкатегорія')}</div>
      <div style="display:flex;flex-wrap:wrap;gap:4px">
        ${subcats.map(s => {
          const active = s === _finTxSubcategory;
          return `<button onclick="selectFinTxSubcat('${escapeHtml(s)}')" style="padding:3px 9px;border-radius:12px;font-size:11.5px;font-weight:500;cursor:pointer;font-family:inherit;border:1px solid ${active ? '#c2410c' : 'rgba(30,16,64,0.08)'};background:${active ? 'rgba(194,65,12,0.06)' : 'rgba(30,16,64,0.02)'};color:${active ? '#c2410c' : 'rgba(30,16,64,0.5)'}">${escapeHtml(s)}</button>`;
        }).join('')}
      </div>
    </div>` : '';

  const calcBtn = (label, action, opts = {}) => {
    const bg = opts.bg || 'rgba(30,16,64,0.04)';
    const col = opts.col || '#1e1040';
    const fontSize = opts.fontSize || '20px';
    const fontWeight = opts.fontWeight || '600';
    return `<button onclick="${action}" style="padding:14px 0;border-radius:12px;border:none;background:${bg};color:${col};font-size:${fontSize};font-weight:${fontWeight};cursor:pointer;font-family:inherit;touch-action:manipulation">${label}</button>`;
  };
  const opStyle = { bg: 'rgba(194,65,12,0.06)', col: '#c2410c', fontWeight: '700' };
  const calcGrid = `<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:10px">
    ${calcBtn('7', "finCalcAppend('7')")}
    ${calcBtn('8', "finCalcAppend('8')")}
    ${calcBtn('9', "finCalcAppend('9')")}
    ${calcBtn('÷', "finCalcAppend('÷')", opStyle)}
    ${calcBtn('4', "finCalcAppend('4')")}
    ${calcBtn('5', "finCalcAppend('5')")}
    ${calcBtn('6', "finCalcAppend('6')")}
    ${calcBtn('×', "finCalcAppend('×')", opStyle)}
    ${calcBtn('1', "finCalcAppend('1')")}
    ${calcBtn('2', "finCalcAppend('2')")}
    ${calcBtn('3', "finCalcAppend('3')")}
    ${calcBtn('−', "finCalcAppend('-')", opStyle)}
    ${calcBtn(',', "finCalcAppend(',')")}
    ${calcBtn('0', "finCalcAppend('0')")}
    ${calcBtn('⌫', 'finCalcBackspace()', { bg: 'rgba(239,68,68,0.06)', col: '#dc2626', fontSize: '18px' })}
    ${calcBtn('+', "finCalcAppend('+')", opStyle)}
  </div>`;

  return `<div onclick="closeFinTxModal()" style="position:absolute;inset:0;background:rgba(0,0,0,0.35);backdrop-filter:blur(4px)"></div>
  <div style="position:relative;width:100%;max-width:480px;background:rgba(255,255,255,0.30);backdrop-filter:blur(32px);-webkit-backdrop-filter:blur(32px);border-radius:24px;overflow:hidden;z-index:1;max-height:85vh;border:1.5px solid rgba(255,255,255,0.5);padding:0 20px">
    <div style="overflow-y:auto;max-height:85vh;padding:18px 0 calc(env(safe-area-inset-bottom) + 18px);box-sizing:border-box">
    <div style="width:36px;height:4px;background:rgba(0,0,0,0.12);border-radius:2px;margin:0 auto 14px"></div>
    <div style="font-size:14px;font-weight:800;color:${calcCol};text-align:center;margin-bottom:6px">${escapeHtml(title)}</div>
    ${isEdit ? '' : `<div style="display:flex;gap:6px;margin-bottom:10px;background:rgba(30,16,64,0.06);border-radius:12px;padding:3px">
      <button onclick="setFinTxType('expense')" style="flex:1;padding:8px;border-radius:10px;font-size:13px;font-weight:800;cursor:pointer;font-family:inherit;border:none;background:${isExpense ? 'white' : 'transparent'};color:${isExpense ? '#c2410c' : 'rgba(30,16,64,0.5)'};box-shadow:${isExpense ? '0 2px 6px rgba(30,16,64,0.08)' : 'none'}">${t('finance.tx.toggle_expense', 'Витрата')}</button>
      <button onclick="setFinTxType('income')" style="flex:1;padding:8px;border-radius:10px;font-size:13px;font-weight:800;cursor:pointer;font-family:inherit;border:none;background:${!isExpense ? 'white' : 'transparent'};color:${!isExpense ? '#16a34a' : 'rgba(30,16,64,0.5)'};box-shadow:${!isExpense ? '0 2px 6px rgba(30,16,64,0.08)' : 'none'}">${t('finance.tx.toggle_income', 'Дохід')}</button>
    </div>`}
    <div style="text-align:center;margin-bottom:10px">
      <div style="font-size:32px;font-weight:900;color:${calcCol};line-height:1.1;font-variant-numeric:tabular-nums">${escapeHtml(displayAmount)} ${getCurrency()}</div>
      ${(_finTxExpression && /[+\-*/×÷]/.test(_finTxExpression)) ? `<div style="font-size:13px;color:rgba(30,16,64,0.45);margin-top:4px">= ${formatMoney(calcResult)}</div>` : ''}
    </div>
    ${catPickerHtml}
    ${subcatsHtml}
    <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:rgba(255,255,255,0.5);border:1.5px solid rgba(30,16,64,0.08);border-radius:12px;margin-bottom:10px;cursor:pointer" onclick="openFinDateModal()">
      <div style="display:flex;align-items:center;gap:8px">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(30,16,64,0.5)" stroke-width="2" stroke-linecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        <span style="font-size:13px;font-weight:600;color:#1e1040">${escapeHtml(dateLabel)}</span>
      </div>
      <span style="font-size:11px;color:rgba(30,16,64,0.4);font-weight:600">${t('finance.tx.change_date', 'змінити')}</span>
    </div>
    <input id="fntx-comment" type="text" placeholder="${t('finance.tx.comment_placeholder', 'Нотатка (необовʼязково)')}" value="${escapeHtml(_finTxComment || '')}"
      oninput="_finTxComment = this.value"
      style="width:100%;border:1.5px solid rgba(30,16,64,0.12);border-radius:12px;padding:10px 14px;font-size:14px;font-family:inherit;color:#1e1040;outline:none;margin-bottom:10px;box-sizing:border-box;background:rgba(255,255,255,0.7)">
    ${calcGrid}
    <div style="display:flex;gap:6px">
      ${isEdit ? `<button onclick="deleteFinTransaction()" style="padding:13px 14px;border-radius:12px;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);font-size:13px;font-weight:700;color:#dc2626;cursor:pointer;font-family:inherit;display:flex;align-items:center;gap:6px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>${t('finance.tx.btn_delete', 'Видалити')}</button>` : ''}
      <button onclick="closeFinTxModal()" class="btn-cancel" style="flex:1">${t('common.btn_cancel', 'Скасувати')}</button>
      <button onclick="saveFinTransaction()" class="btn-save-primary" style="flex:1.5">${isEdit ? t('common.btn_save', 'Зберегти') : t('finance.tx.btn_add', '✓ Додати')}</button>
    </div>
    </div>
  </div>`;
}

export function saveFinTransaction() {
  const amount = _safeFinCalc(_finTxExpression);
  if (!amount || amount <= 0) { showToast(t('finance.tx.amount_error', 'Введи суму')); return; }
  if (!_finTxCategory) { showToast(t('finance.tx.category_error', 'Вибери категорію')); return; }
  const txs = getFinance();
  const baseFields = {
    type: _finTxCurrentType,
    amount,
    category: _finTxCategory,
    subcategory: _finTxSubcategory || undefined,
    comment: _finTxComment || '',
    ts: _finTxDate,
  };
  if (_finEditId) {
    const idx = txs.findIndex(x => x.id === _finEditId);
    if (idx !== -1) txs[idx] = { ...txs[idx], ...baseFields };
  } else {
    txs.unshift({ id: Date.now(), ...baseFields });
  }
  saveFinance(txs);
  closeFinTxModal();
  renderFinance();
  _finEditId = null;
  _finTxComment = '';
  try { localStorage.setItem('nm_owl_tab_ts_finance', '0'); tryBoardUpdate('finance'); } catch(e) {}
}

export function deleteFinTransaction() {
  if (!_finEditId) return;
  const item = getFinance().find(tx => tx.id === _finEditId);
  saveFinance(getFinance().filter(tx => tx.id !== _finEditId));
  closeFinTxModal();
  renderFinance();
  try { localStorage.setItem('nm_owl_tab_ts_finance', '0'); tryBoardUpdate('finance'); } catch(e) {}
  if (item) showUndoToast(t('finance.tx.deleted_toast', 'Транзакцію видалено'), () => {
    const txs = getFinance(); txs.unshift(item); saveFinance(txs); renderFinance();
    try { localStorage.setItem('nm_owl_tab_ts_finance', '0'); tryBoardUpdate('finance'); } catch(e) {}
  });
  _finEditId = null;
}

// === Дата picker ===
export function openFinDateModal() {
  const existing = document.getElementById('fin-date-modal');
  if (existing) existing.remove();
  const today = new Date(); today.setHours(0,0,0,0);
  const fmt = (offset) => {
    const d = new Date(today); d.setDate(today.getDate() + offset);
    return d.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' });
  };
  const currentYmd = new Date(_finTxDate).toISOString().slice(0, 10);
  const modal = document.createElement('div');
  modal.id = 'fin-date-modal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:600;display:flex;align-items:flex-end;justify-content:center;padding:0 16px 16px';
  modal.innerHTML = `
    <div onclick="closeFinDateModal()" style="position:absolute;inset:0;background:rgba(0,0,0,0.35);backdrop-filter:blur(4px)"></div>
    <div style="position:relative;width:100%;max-width:420px;background:rgba(255,255,255,0.30);backdrop-filter:blur(32px);-webkit-backdrop-filter:blur(32px);border-radius:24px;overflow:hidden;z-index:1;max-height:80vh;border:1.5px solid rgba(255,255,255,0.5);padding:0 20px">
      <div style="overflow-y:auto;max-height:80vh;padding:28px 0 calc(env(safe-area-inset-bottom) + 28px);box-sizing:border-box">
      <div style="width:36px;height:4px;background:rgba(0,0,0,0.12);border-radius:2px;margin:0 auto 18px"></div>
      <div style="font-family:var(--font-display);font-size:18px;font-weight:700;color:#1e1040;margin-bottom:14px">${t('finance.date.modal_title', 'Дата операції')}</div>
      <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:14px">
        <button onclick="setFinTxDateOffset(0)" style="padding:13px 14px;border-radius:12px;border:1.5px solid rgba(30,16,64,0.12);background:rgba(255,255,255,0.7);font-size:14px;font-weight:600;color:#1e1040;cursor:pointer;font-family:inherit;text-align:left">${t('finance.date.today', 'Сьогодні')} · ${fmt(0)}</button>
        <button onclick="setFinTxDateOffset(-1)" style="padding:13px 14px;border-radius:12px;border:1.5px solid rgba(30,16,64,0.12);background:rgba(255,255,255,0.7);font-size:14px;font-weight:600;color:#1e1040;cursor:pointer;font-family:inherit;text-align:left">${t('finance.date.yesterday', 'Вчора')} · ${fmt(-1)}</button>
        <button onclick="setFinTxDateOffset(-2)" style="padding:13px 14px;border-radius:12px;border:1.5px solid rgba(30,16,64,0.12);background:rgba(255,255,255,0.7);font-size:14px;font-weight:600;color:#1e1040;cursor:pointer;font-family:inherit;text-align:left">${t('finance.date.day_before_yesterday', 'Позавчора')} · ${fmt(-2)}</button>
        <button onclick="setFinTxDateOffset(-7)" style="padding:13px 14px;border-radius:12px;border:1.5px solid rgba(30,16,64,0.12);background:rgba(255,255,255,0.7);font-size:14px;font-weight:600;color:#1e1040;cursor:pointer;font-family:inherit;text-align:left">${t('finance.date.week_ago', 'Тиждень тому')} · ${fmt(-7)}</button>
      </div>
      <div style="font-size:11px;font-weight:700;color:rgba(30,16,64,0.4);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px">${t('finance.date.choose_day', 'Виберіть день')}</div>
      <input id="fin-date-input" type="date" value="${currentYmd}" max="${new Date().toISOString().slice(0,10)}"
        onchange="setFinTxDateFromInput(this.value)"
        style="width:100%;border:1.5px solid rgba(30,16,64,0.12);border-radius:12px;padding:11px 40px 11px 14px;font-size:15px;font-weight:600;font-family:inherit;color:#1e1040;outline:none;margin-bottom:14px;box-sizing:border-box;background:rgba(255,255,255,0.7);text-align:left;-webkit-appearance:none;appearance:none;min-height:44px">
      <button onclick="closeFinDateModal()" class="btn-cancel" style="width:100%">${t('common.close', 'Закрити')}</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  setupModalSwipeClose(modal.querySelector('div:last-child'), closeFinDateModal);
}

export function setFinTxDateOffset(offset) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  d.setHours(12, 0, 0, 0);
  _finTxDate = d.getTime();
  closeFinDateModal();
  _refreshTransactionModal();
}

export function setFinTxDateFromInput(ymd) {
  if (!ymd) return;
  const d = new Date(ymd + 'T12:00:00');
  if (isNaN(d.getTime())) return;
  _finTxDate = d.getTime();
  closeFinDateModal();
  _refreshTransactionModal();
}
// === Модалка бюджету ===
export function openFinBudgetModal() {
  const budget = getFinBudget();
  const cats = getFinCats();
  const existing = document.getElementById('fin-budget-modal');
  if (existing) existing.remove();
  const modal = document.createElement('div');
  modal.id = 'fin-budget-modal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:500;display:flex;align-items:flex-end;justify-content:center';
  modal.innerHTML = `
    <div onclick="closeFinBudgetModal()" class="modal-backdrop"></div>
    <div style="position:relative;width:100%;max-width:480px;background:rgba(255,255,255,0.88);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);border-radius:24px;margin:0 16px 16px;z-index:1;border:1.5px solid rgba(255,255,255,0.6);padding:16px 20px calc(env(safe-area-inset-bottom) + 24px);max-height:80vh;overflow-y:auto;box-sizing:border-box">
      <div class="modal-handle"></div>
      <div class="modal-title">${t('finance.budget.modal_title', 'Бюджет на місяць')}</div>
      <div style="font-size:12px;font-weight:700;color:rgba(30,16,64,0.4);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px">${t('finance.budget.total_limit', 'Загальний ліміт')}</div>
      <input id="finbdg-total" type="number" placeholder="${t('finance.budget.placeholder_total', '€ 0 — без ліміту')}" inputmode="decimal"
        style="width:100%;border:1.5px solid rgba(30,16,64,0.12);border-radius:12px;padding:11px 14px;font-size:17px;font-weight:700;font-family:inherit;color:#1e1040;outline:none;margin-bottom:14px;box-sizing:border-box"
        value="${budget.total || ''}">
      <div style="font-size:12px;font-weight:700;color:rgba(30,16,64,0.4);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px">${t('finance.budget.by_categories', 'По категоріях')}</div>
      <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px">
        ${cats.expense.filter(c => !c.archived).map(cat => `
          <div style="display:flex;align-items:center;gap:10px">
            <div style="font-size:14px;font-weight:600;color:#1e1040;flex:1">${escapeHtml(cat.name)}</div>
            <input type="number" id="finbdg-cat-${escapeHtml(cat.name)}" placeholder="${t('finance.budget.placeholder_cat', 'без ліміту')}" inputmode="decimal"
              style="width:100px;border:1.5px solid rgba(30,16,64,0.1);border-radius:10px;padding:7px 10px;font-size:14px;font-family:inherit;color:#1e1040;outline:none;text-align:right"
              value="${budget.categories?.[cat.name] || ''}">
          </div>`).join('')}
      </div>
      <div style="display:flex;gap:8px">
        <button onclick="closeFinBudgetModal()" class="btn-cancel">${t('common.cancel', 'Скасувати')}</button>
        <button onclick="saveFinBudgetFromModal()" class="btn-save-primary">${t('common.save', 'Зберегти')}</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
}

export function saveFinBudgetFromModal() {
  const cats = getFinCats();
  const total = parseFloat(document.getElementById('finbdg-total')?.value || '0') || 0;
  const categories = {};
  cats.expense.forEach(cat => {
    const val = parseFloat(document.getElementById(`finbdg-cat-${cat.name}`)?.value || '0') || 0;
    if (val > 0) categories[cat.name] = val;
  });
  saveFinBudget({ total, categories });
  closeFinBudgetModal();
  renderFinance();
  try { localStorage.setItem('nm_owl_tab_ts_finance', '0'); tryBoardUpdate('finance'); } catch(e) {}
}
// === Модалка категорії ===
export function toggleFinEditMode() {
  setFinEditMode(!getFinEditMode());
}

export function openCategoryEditModal(catId) {
  _finEditingCatId = catId;
  let draft;
  if (catId === 'new') {
    draft = {
      name: '',
      icon: 'other',
      color: pickRandomCatColor(Date.now() % 14),
      subcategories: [],
      archived: false,
      type: 'expense', // дефолт — користувач може перемкнути у модалці
    };
  } else {
    const found = findFinCatById(catId);
    if (!found) return;
    draft = { ...found.cat, type: found.type, subcategories: [...found.cat.subcategories] };
  }
  _finCatModalDraft = draft;
  _catModalIconExpanded = false;
  _catModalColorExpanded = false;
  const existing = document.getElementById('fin-cat-edit-modal');
  if (existing) existing.remove();
  const modal = document.createElement('div');
  modal.id = 'fin-cat-edit-modal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:600;display:flex;align-items:flex-end;justify-content:center;padding:0 16px 16px';
  modal.innerHTML = _renderCatEditModalBody();
  document.body.appendChild(modal);
  setupModalSwipeClose(modal.querySelector('div:last-child'), closeCategoryEditModal);
}

function _renderCatEditModalBody() {
  const d = _finCatModalDraft;
  const isNew = _finEditingCatId === 'new';
  const chev = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" style="flex-shrink:0"><polyline points="6 9 12 15 18 9"/></svg>`;
  // Два компактних inline-тригери поряд (замість двох повних рядків з inline-grid).
  const iconTrigger = `<button onclick="toggleCatModalIcons()" style="flex:1;display:flex;align-items:center;gap:8px;padding:10px 12px;border-radius:12px;border:1.5px solid rgba(30,16,64,0.08);background:rgba(255,255,255,0.6);cursor:pointer;font-family:inherit;min-width:0">
    <div style="width:32px;height:32px;border-radius:50%;background:${d.color}20;display:flex;align-items:center;justify-content:center;flex-shrink:0">${finCatIcon(d.icon, d.color, 18)}</div>
    <div style="flex:1;text-align:left;min-width:0">
      <div style="font-size:9px;font-weight:700;color:rgba(30,16,64,0.4);text-transform:uppercase;letter-spacing:0.06em">${t('finance.cat.icon_label', 'Іконка')}</div>
      <div style="font-size:12px;font-weight:700;color:#1e1040;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(d.icon)}</div>
    </div>
    <div style="color:rgba(30,16,64,0.45)">${chev}</div>
  </button>`;
  const colorTrigger = `<button onclick="toggleCatModalColors()" style="flex:1;display:flex;align-items:center;gap:8px;padding:10px 12px;border-radius:12px;border:1.5px solid rgba(30,16,64,0.08);background:rgba(255,255,255,0.6);cursor:pointer;font-family:inherit;min-width:0">
    <div style="width:32px;height:32px;border-radius:50%;background:${d.color};border:2px solid rgba(255,255,255,0.8);flex-shrink:0;box-shadow:0 1px 3px rgba(0,0,0,0.08)"></div>
    <div style="flex:1;text-align:left;min-width:0">
      <div style="font-size:9px;font-weight:700;color:rgba(30,16,64,0.4);text-transform:uppercase;letter-spacing:0.06em">${t('finance.cat.color_label', 'Колір')}</div>
      <div style="font-size:12px;font-weight:700;color:#1e1040;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(d.color)}</div>
    </div>
    <div style="color:rgba(30,16,64,0.45)">${chev}</div>
  </button>`;
  // Nested popup — маленька модалка поверх (position:fixed). Тап на backdrop закриває.
  const pickerPopup = (_catModalIconExpanded || _catModalColorExpanded) ? `
    <div onclick="closeCatPicker()" style="position:fixed;inset:0;background:rgba(0,0,0,0.4);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px">
      <div onclick="event.stopPropagation()" style="width:100%;max-width:340px;background:rgba(255,255,255,0.95);backdrop-filter:blur(32px);-webkit-backdrop-filter:blur(32px);border-radius:22px;padding:18px;max-height:70vh;overflow-y:auto;border:1.5px solid rgba(255,255,255,0.6);box-shadow:0 20px 60px rgba(0,0,0,0.18);box-sizing:border-box">
        ${_catModalIconExpanded ? `
          <div style="font-size:15px;font-weight:800;color:#1e1040;text-align:center;margin-bottom:14px">${t('finance.cat.choose_icon', 'Обери іконку')}</div>
          <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px">
            ${FIN_CAT_ICON_NAMES.map(name => {
              const active = name === d.icon;
              return `<button onclick="selectCatModalIcon('${name}')" style="aspect-ratio:1;border-radius:50%;border:2px solid ${active ? d.color : 'rgba(30,16,64,0.08)'};background:${active ? d.color + '20' : 'white'};display:flex;align-items:center;justify-content:center;cursor:pointer;font-family:inherit;padding:0">${finCatIcon(name, active ? d.color : 'rgba(30,16,64,0.55)', 20)}</button>`;
            }).join('')}
          </div>
        ` : ''}
        ${_catModalColorExpanded ? `
          <div style="font-size:15px;font-weight:800;color:#1e1040;text-align:center;margin-bottom:14px">${t('finance.cat.choose_color', 'Обери колір')}</div>
          <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:10px;justify-items:center">
            ${FIN_CAT_PALETTE.map(c => {
              const active = c === d.color;
              return `<button onclick="selectCatModalColor('${c}')" style="width:42px;height:42px;border-radius:50%;border:3px solid ${active ? '#1e1040' : 'transparent'};background:${c};cursor:pointer;font-family:inherit;padding:0"></button>`;
            }).join('')}
          </div>
        ` : ''}
      </div>
    </div>` : '';
  const subcatsHtml = d.subcategories.map((s, i) =>
    `<div style="display:flex;align-items:center;gap:6px">
      <input type="text" value="${escapeHtml(s)}" onchange="updateCatModalSubcat(${i}, this.value)" style="flex:1;border:1.5px solid rgba(30,16,64,0.1);border-radius:8px;padding:6px 10px;font-size:13px;font-family:inherit;color:#1e1040;outline:none;background:rgba(255,255,255,0.7)">
      <button onclick="removeCatModalSubcat(${i})" style="width:28px;height:28px;border-radius:8px;border:none;background:rgba(239,68,68,0.08);color:#dc2626;font-size:14px;cursor:pointer;font-family:inherit">×</button>
    </div>`
  ).join('');

  return `<div onclick="closeCategoryEditModal()" style="position:absolute;inset:0;background:rgba(0,0,0,0.35);backdrop-filter:blur(4px)"></div>
  <div style="position:relative;width:100%;max-width:480px;background:rgba(255,255,255,0.30);backdrop-filter:blur(32px);-webkit-backdrop-filter:blur(32px);border-radius:24px;overflow:hidden;z-index:1;max-height:85vh;border:1.5px solid rgba(255,255,255,0.5);padding:0 20px">
    <div style="overflow-y:auto;max-height:85vh;padding:28px 0 calc(env(safe-area-inset-bottom) + 28px);box-sizing:border-box">
    <div style="width:36px;height:4px;background:rgba(0,0,0,0.12);border-radius:2px;margin:0 auto 18px"></div>
    <div style="font-family:var(--font-display);font-size:18px;font-weight:700;color:#1e1040;margin-bottom:14px">${isNew ? t('finance.cat.new_title', 'Нова категорія') : t('finance.cat.edit_title', 'Редагувати категорію')}</div>
    ${isNew ? `<div style="display:flex;gap:6px;margin-bottom:12px">
      <button onclick="setCatModalType('expense')" style="flex:1;padding:8px;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;border:1.5px solid ${d.type === 'expense' ? '#c2410c' : 'rgba(30,16,64,0.1)'};background:${d.type === 'expense' ? 'rgba(194,65,12,0.08)' : 'white'};color:${d.type === 'expense' ? '#c2410c' : 'rgba(30,16,64,0.4)'}">${t('finance.tx.toggle_expense', 'Витрата')}</button>
      <button onclick="setCatModalType('income')" style="flex:1;padding:8px;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;border:1.5px solid ${d.type === 'income' ? '#16a34a' : 'rgba(30,16,64,0.1)'};background:${d.type === 'income' ? 'rgba(22,163,74,0.08)' : 'white'};color:${d.type === 'income' ? '#16a34a' : 'rgba(30,16,64,0.4)'}">${t('finance.tx.toggle_income', 'Дохід')}</button>
    </div>` : ''}
    <div style="font-size:11px;font-weight:700;color:rgba(30,16,64,0.4);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px">${t('finance.cat.name_label', 'Назва')}</div>
    <input id="cat-modal-name" type="text" value="${escapeHtml(d.name)}" oninput="_finCatModalDraft.name = this.value" placeholder="${t('finance.cat.name_placeholder', 'напр. Подорожі')}"
      style="width:100%;border:1.5px solid rgba(30,16,64,0.12);border-radius:12px;padding:11px 14px;font-size:16px;font-weight:600;font-family:inherit;color:#1e1040;outline:none;margin-bottom:14px;box-sizing:border-box;background:rgba(255,255,255,0.7)">
    <div style="font-size:11px;font-weight:700;color:rgba(30,16,64,0.4);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px">${t('finance.cat.appearance_label', 'Вигляд')}</div>
    <div style="display:flex;gap:8px;margin-bottom:14px">${iconTrigger}${colorTrigger}</div>
    <div style="font-size:11px;font-weight:700;color:rgba(30,16,64,0.4);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px">${t('finance.cat.subcats_label', 'Підкатегорії')}</div>
    <div id="cat-modal-subcats" style="display:flex;flex-direction:column;gap:6px;margin-bottom:8px">${subcatsHtml}</div>
    <button onclick="addCatModalSubcat()" style="width:100%;padding:8px;border-radius:10px;border:1.5px dashed rgba(30,16,64,0.15);background:transparent;color:rgba(30,16,64,0.5);font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;margin-bottom:14px">${t('finance.cat.add_subcat', '+ підкатегорія')}</button>
    ${!isNew ? `<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-top:1px solid rgba(30,16,64,0.06);margin-bottom:8px">
      <div>
        <div style="font-size:13px;font-weight:700;color:#1e1040">${t('finance.cat.archive', 'Архівувати')}</div>
        <div style="font-size:11px;color:rgba(30,16,64,0.45);margin-top:2px">${t('finance.cat.archive_hint', 'Сховати з сітки, дані зберігаються')}</div>
      </div>
      <button onclick="toggleCatModalArchive()" style="width:44px;height:24px;border-radius:14px;border:none;background:${d.archived ? '#c2410c' : 'rgba(30,16,64,0.12)'};position:relative;cursor:pointer;font-family:inherit">
        <div style="width:18px;height:18px;border-radius:50%;background:white;position:absolute;top:3px;${d.archived ? 'right:3px' : 'left:3px'};transition:all 0.2s"></div>
      </button>
    </div>` : ''}
    <div style="display:flex;gap:8px;margin-top:14px">
      ${!isNew ? `<button onclick="deleteCategoryFromModal()" style="padding:13px 16px;border-radius:12px;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);font-size:14px;font-weight:700;color:#dc2626;cursor:pointer;font-family:inherit">${t('common.delete', 'Видалити')}</button>` : ''}
      <button onclick="closeCategoryEditModal()" class="btn-cancel">${t('common.cancel', 'Скасувати')}</button>
      <button onclick="saveCategoryFromModal()" class="btn-save-primary">${isNew ? t('common.create', 'Створити') : t('common.save', 'Зберегти')}</button>
    </div>
    </div>
  </div>
  ${pickerPopup}`;
}

// B-59: зберігаємо scrollTop і focus + точкові оновлення
function _refreshCatEditModal() {
  const modal = document.getElementById('fin-cat-edit-modal');
  if (!modal) return;
  const scrollEl = modal.querySelector('div[style*="overflow-y:auto"]');
  const prevScroll = scrollEl ? scrollEl.scrollTop : 0;
  const activeId = document.activeElement?.id || '';
  const activeSelStart = document.activeElement?.selectionStart;
  const activeSelEnd = document.activeElement?.selectionEnd;
  modal.innerHTML = _renderCatEditModalBody();
  const newScroll = modal.querySelector('div[style*="overflow-y:auto"]');
  if (newScroll && prevScroll > 0) newScroll.scrollTop = prevScroll;
  if (activeId) {
    const el = document.getElementById(activeId);
    if (el && typeof el.focus === 'function') {
      el.focus();
      if (el.setSelectionRange && activeSelStart != null) {
        try { el.setSelectionRange(activeSelStart, activeSelEnd); } catch(e) {}
      }
    }
  }
}

function _updateCatModalIconHighlight() {
  const modal = document.getElementById('fin-cat-edit-modal');
  if (!modal) return;
  const d = _finCatModalDraft;
  const btns = modal.querySelectorAll('button[data-cat-icon]');
  btns.forEach(b => {
    const name = b.dataset.catIcon;
    const active = name === d.icon;
    b.style.border = `2px solid ${active ? d.color : 'rgba(30,16,64,0.08)'}`;
    b.style.background = active ? d.color + '20' : 'white';
    const svg = b.querySelector('svg');
    if (svg) svg.setAttribute('stroke', active ? d.color : 'rgba(30,16,64,0.55)');
  });
}
function _updateCatModalColorHighlight() {
  const modal = document.getElementById('fin-cat-edit-modal');
  if (!modal) return;
  const d = _finCatModalDraft;
  const btns = modal.querySelectorAll('button[data-cat-color]');
  btns.forEach(b => {
    const c = b.dataset.catColor;
    const active = c === d.color;
    b.style.border = `3px solid ${active ? '#1e1040' : 'transparent'}`;
  });
  _updateCatModalIconHighlight();
}

export function selectCatModalIcon(name) { _finCatModalDraft.icon = name; _catModalIconExpanded = false; _refreshCatEditModal(); }
export function selectCatModalColor(c)   { _finCatModalDraft.color = c; _catModalColorExpanded = false; _refreshCatEditModal(); }
export function toggleCatModalIcons()    { _catModalIconExpanded = !_catModalIconExpanded; if (_catModalIconExpanded) _catModalColorExpanded = false; _refreshCatEditModal(); }
export function toggleCatModalColors()   { _catModalColorExpanded = !_catModalColorExpanded; if (_catModalColorExpanded) _catModalIconExpanded = false; _refreshCatEditModal(); }
export function closeCatPicker()         { _catModalIconExpanded = false; _catModalColorExpanded = false; _refreshCatEditModal(); }
export function setCatModalType(t)       { _finCatModalDraft.type = t; _refreshCatEditModal(); }
export function toggleCatModalArchive()  { _finCatModalDraft.archived = !_finCatModalDraft.archived; _refreshCatEditModal(); }
export function addCatModalSubcat()      { _finCatModalDraft.subcategories.push(''); _refreshCatEditModal(); }
export function removeCatModalSubcat(i)  { _finCatModalDraft.subcategories.splice(i, 1); _refreshCatEditModal(); }
export function updateCatModalSubcat(i, v) { _finCatModalDraft.subcategories[i] = v; }

function _finCatModalPositionInfo() {
  if (_finEditingCatId === 'new' || !_finEditingCatId) return '';
  const found = findFinCatById(_finEditingCatId);
  if (!found) return '';
  const list = getFinCats()[found.type];
  return t('finance.cat.position_info', 'позиція {idx} з {total}', { idx: found.idx + 1, total: list.length });
}

export function moveCatModalUp()   { if (_finEditingCatId && _finEditingCatId !== 'new') { moveFinCategory(_finEditingCatId, -1); _refreshCatEditModal(); renderFinance(); } }
export function moveCatModalDown() { if (_finEditingCatId && _finEditingCatId !== 'new') { moveFinCategory(_finEditingCatId, +1); _refreshCatEditModal(); renderFinance(); } }

export function saveCategoryFromModal() {
  const d = _finCatModalDraft;
  const subs = (d.subcategories || []).map(s => (s || '').trim()).filter(Boolean);
  const name = (d.name || '').trim();
  if (!name) { showToast(t('finance.cat.enter_name', 'Введи назву')); return; }
  if (_finEditingCatId === 'new') {
    createFinCategory(d.type, { name, icon: d.icon, color: d.color, subcategories: subs });
  } else {
    updateFinCategory(_finEditingCatId, { name, icon: d.icon, color: d.color, subcategories: subs, archived: d.archived });
  }
  closeCategoryEditModal();
  renderFinance();
}

export function deleteCategoryFromModal() {
  if (_finEditingCatId === 'new') return;
  if (!confirm(t('finance.cat.delete_confirm', 'Видалити категорію? Транзакції збережуться, але без візуального кружечка.'))) return;
  deleteFinCategory(_finEditingCatId);
  closeCategoryEditModal();
  renderFinance();
}

// === Window exports (HTML inline onclick) ===
Object.assign(window, {
  openAddTransaction, openEditTransaction, closeFinTxModal,
  saveFinTransaction, deleteFinTransaction,
  finCalcAppend, finCalcBackspace,
  selectFinTxMainCat, selectFinTxSubcat, setFinTxType,
  openFinDateModal, closeFinDateModal, setFinTxDateOffset, setFinTxDateFromInput,
  openFinBudgetModal, saveFinBudgetFromModal, closeFinBudgetModal,
  toggleFinEditMode, openCategoryEditModal, closeCategoryEditModal,
  saveCategoryFromModal, deleteCategoryFromModal,
  selectCatModalIcon, selectCatModalColor, toggleCatModalIcons, toggleCatModalColors, closeCatPicker, setCatModalType, toggleCatModalArchive,
  addCatModalSubcat, removeCatModalSubcat, updateCatModalSubcat,
  moveCatModalUp, moveCatModalDown,
});
// _finTxComment мусить бути доступний з inline oninput
Object.defineProperty(window, '_finTxComment', {
  get() { return _finTxComment; },
  set(v) { _finTxComment = v; },
  configurable: true,
});
Object.defineProperty(window, '_finCatModalDraft', {
  get() { return _finCatModalDraft; },
  set(v) { _finCatModalDraft = v; },
  configurable: true,
});
