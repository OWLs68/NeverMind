// ============================================================
// finance-chat.js — Chat bar Фінансів (AI бот для фінансів)
// Винесено з finance.js у рефакторингу 17.04.2026 (сесія gHCOh).
// ============================================================

import { escapeHtml, parseContentChips, t } from '../core/utils.js';
import { callAIWithTools, getAIContext, openChatBar, safeAgentReply, saveChatMsg, INBOX_TOOLS, handleChatError } from '../ai/core.js';
import { getFinanceChatSystem } from '../ai/prompts.js';
import { dispatchChatToolCalls } from '../ai/tool-dispatcher.js';
import { shouldClarify } from '../owl/clarify-guard.js';
import { tryBoardUpdate } from '../owl/proactive.js';
import { renderChips } from '../owl/chips.js';
import {
  getFinance, formatMoney, getCurrency,
  getFinBudget, getFinPeriodRange,
} from './finance.js';
import { getFinCats } from './finance-cats.js';

let _financeTypingEl = null;
let financeBarHistory = [];
let financeBarLoading = false;

export function addFinanceChatMsg(role, text, _noSave = false, chips = null) {
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
  // Чіпи релевантні тільки останньому повідомленню сови — чистимо попередні
  if (role === 'agent') el.querySelectorAll('.chat-chips-row').forEach(n => n.remove());
  if (!_noSave) { try { openChatBar('finance'); } catch(e) {} }
  const isAgent = role === 'agent';
  const div = document.createElement('div');
  div.style.cssText = `display:flex;${isAgent ? '' : 'justify-content:flex-end'}`;
  div.innerHTML = `<div class="msg-bubble ${isAgent ? 'msg-bubble--agent' : 'msg-bubble--user'}">${escapeHtml(text).replace(/\n/g,'<br>')}</div>`;
  el.appendChild(div);
  if (isAgent && Array.isArray(chips) && chips.length > 0) {
    const chipsRow = document.createElement('div');
    chipsRow.className = 'chat-chips-row';
    renderChips(chipsRow, chips, 'finance');
    el.appendChild(chipsRow);
  }
  // B-119 (UvEHE розкочення): rAF щоб iOS Safari порахував висоту chipsRow ДО scrollу.
  el.scrollTop = el.scrollHeight;
  requestAnimationFrame(() => { el.scrollTop = el.scrollHeight; });
  if (role !== 'agent') financeBarHistory.push({ role: 'user', content: text });
  else financeBarHistory.push({ role: 'assistant', content: text });
  if (!_noSave) saveChatMsg('finance', role, text);
}

// Перевірка перевищення бюджету (локальна копія — використовується після save_expense)
function checkFinBudgetWarning(type, category, amount) {
  if (type !== 'expense') return;
  const budget = getFinBudget();
  const from = getFinPeriodRange('month');
  const txs = getFinance().filter(t => t.type === 'expense' && t.ts >= from);
  const totalSpent = txs.reduce((s, t) => s + t.amount, 0);
  if (budget.total > 0) {
    const pct = totalSpent / budget.total;
    if (pct >= 1) addFinanceChatMsg('agent', t('finance.budget_month_exceeded', '⚠️ Загальний бюджет на місяць перевищено. Витрачено {spent} з {total}.', { spent: formatMoney(totalSpent), total: formatMoney(budget.total) }));
    else if (pct >= 0.8) addFinanceChatMsg('agent', t('finance.budget_month_left', '💡 До ліміту місяця залишилось {left}.', { left: formatMoney(budget.total - totalSpent) }));
  }
  const catLimit = budget.categories?.[category];
  if (catLimit > 0) {
    const catSpent = txs.filter(t => t.category === category).reduce((s, t) => s + t.amount, 0);
    const pct = catSpent / catLimit;
    if (pct >= 1) addFinanceChatMsg('agent', t('finance.budget_cat_exceeded', '⚠️ Ліміт по "{cat}" перевищено: {spent} з {limit}.', { cat: category, spent: formatMoney(catSpent), limit: formatMoney(catLimit) }));
    else if (pct >= 0.8) addFinanceChatMsg('agent', t('finance.budget_cat_left', '💡 По "{cat}" залишилось {left}.', { cat: category, left: formatMoney(catLimit - catSpent) }));
  }
}

export async function sendFinanceBarMessage() {
  if (financeBarLoading) return;
  const input = document.getElementById('finance-bar-input');
  const text = input.value.trim();
  if (!text) return;
  const key = localStorage.getItem('nm_gemini_key');
  if (!key) { addFinanceChatMsg('agent', t('common.no_api_key', 'Введи OpenAI ключ в налаштуваннях.')); return; }
  input.value = ''; input.style.height = 'auto';
  input.focus();
  addFinanceChatMsg('user', text);
  financeBarLoading = true;
  addFinanceChatMsg('typing', '');

  // Фаза 3 "Один мозок V2" (20.04 Gg3Fy): Finance chat на INBOX_TOOLS + dispatcher.
  const from = getFinPeriodRange('month');
  const txs = getFinance().filter(t => t.ts >= from);
  const budget = getFinBudget();
  const cats = getFinCats();
  const currency = getCurrency();
  const txSummary = txs.slice(0, 20).map(t => `[${t.type}] ${t.category} ${t.amount}${currency} ${t.comment || ''}`).join('; ');
  const systemPrompt = getFinanceChatSystem({
    currency,
    budget,
    txSummary,
    expenseCats: (cats.expense || []).map(c => c.name || c).join(', '),
    incomeCats: (cats.income || []).map(c => c.name || c).join(', '),
  }) + (getAIContext() ? '\n\n' + getAIContext() : '');

  try {
    const msg = await callAIWithTools(systemPrompt, financeBarHistory.slice(-10), INBOX_TOOLS, 'finance-bar');

    if (msg && Array.isArray(msg.tool_calls) && msg.tool_calls.length > 0) {
      const guard = shouldClarify(text, msg.tool_calls, 'finance');
      if (guard) {
        addFinanceChatMsg('agent', guard.question, false, guard.chips);
        financeBarLoading = false;
        return;
      }
      dispatchChatToolCalls(msg.tool_calls, addFinanceChatMsg, text);
      // Budget warning після save_finance (Finance-specific реакція — залишається у чаті).
      for (const tc of msg.tool_calls) {
        if (tc.function.name === 'save_finance') {
          try {
            const a = JSON.parse(tc.function.arguments || '{}');
            if (a.fin_type === 'expense') checkFinBudgetWarning('expense', a.category, a.amount);
          } catch (e) {}
          try { localStorage.setItem('nm_owl_tab_ts_finance', '0'); tryBoardUpdate('finance'); } catch(e) {}
        }
      }
      // Verify Loop: показуємо msg.content якщо AI дав.
      if (msg.content) {
        const { text: replyText, chips } = parseContentChips(msg.content);
        if (replyText) addFinanceChatMsg('agent', replyText, false, chips);
      }
      financeBarLoading = false;
      return;
    }

    const reply = msg && msg.content ? msg.content.trim() : '';
    if (!reply) { handleChatError(addFinanceChatMsg); financeBarLoading = false; return; }
    const { text: replyText, chips } = parseContentChips(reply);
    if (replyText) {
      const looksLikeJson = (replyText.startsWith('{') && replyText.endsWith('}')) || (replyText.startsWith('[') && replyText.endsWith(']'));
      if (looksLikeJson) { try { JSON.parse(replyText); addFinanceChatMsg('agent', t('common.done_check', 'Зроблено ✓')); } catch { addFinanceChatMsg('agent', replyText, false, chips); } }
      else addFinanceChatMsg('agent', replyText, false, chips);
    }
  } catch { addFinanceChatMsg('agent', t('common.network_error', 'Мережева помилка.')); }
  financeBarLoading = false;
}

// Window export для inline onclick у HTML
Object.assign(window, { sendFinanceBarMessage });
