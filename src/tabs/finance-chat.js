// ============================================================
// finance-chat.js — Chat bar Фінансів (AI бот для фінансів)
// Винесено з finance.js у рефакторингу 17.04.2026 (сесія gHCOh).
// ============================================================

import { escapeHtml, parseContentChips, t } from '../core/utils.js';
import { callAIWithTools, getAIContext, openChatBar, safeAgentReply, saveChatMsg, INBOX_TOOLS, handleChatError } from '../ai/core.js';
import { getFinanceChatSystem } from '../ai/prompts.js';
import { dispatchChatToolCalls } from '../ai/tool-dispatcher.js';
import { shouldClarify } from '../owl/clarify-guard.js';
import { invalidateFinanceBoard } from '../owl/proactive.js';
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
  // MPVly 05.05 — інлайн-парсинг чіпів (один мозок).
  if (role === 'agent' && (!chips || chips.length === 0) && text) {
    const _p = parseContentChips(text);
    if (_p.chips) { text = _p.text; chips = _p.chips; }
  }
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
    // B-119 + UvEHE chips clipping fix: scrollIntoView надійніше за scrollTop+rAF
    // на iOS Safari — браузер сам рахує реальний layout після append.
    requestAnimationFrame(() => chipsRow.scrollIntoView({ block: 'end', inline: 'nearest' }));
  }
  el.scrollTop = el.scrollHeight;
  requestAnimationFrame(() => { el.scrollTop = el.scrollHeight; });
  if (role !== 'agent') financeBarHistory.push({ role: 'user', content: text });
  else financeBarHistory.push({ role: 'assistant', content: text });
  // 64CXo: cap 20 — memory leak fix.
  if (financeBarHistory.length > 20) financeBarHistory = financeBarHistory.slice(-20);
  if (!_noSave) saveChatMsg('finance', role, text, chips);
}

// Phase 2 nliW8 13.05: дубль checkFinBudgetWarning видалено — тепер
// уніфікований у processFinanceAction → addMsg=addFinanceChatMsg (через DI).
// Той самий мозок для всіх 8 чатів.

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
  // LfA6w 07.05: txSummary прибрано — getAIContext() вже містить getFinanceContext
  // з ID транзакцій. Раніше дублював без ID → AI не міг update_transaction({id})
  // → робив дублі через save_finance або clarify spam на «За водафон».
  const systemPrompt = getFinanceChatSystem({
    currency,
    budget,
    txSummary: '',
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
      // Phase 2 nliW8 13.05: budget warning ВЖЕ всередині processFinanceAction
      // через DI addMsg=addFinanceChatMsg — інлайн дубль видалено.
      // Залишається owl-board signal для save_finance.
      for (const tc of msg.tool_calls) {
        if (tc.function.name === 'save_finance') {
          invalidateFinanceBoard();
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
