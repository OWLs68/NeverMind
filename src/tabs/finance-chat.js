// ============================================================
// finance-chat.js — Chat bar Фінансів (AI бот для фінансів)
// Винесено з finance.js у рефакторингу 17.04.2026 (сесія gHCOh).
// ============================================================

import { escapeHtml, extractJsonBlocks } from '../core/utils.js';
import { addToTrash } from '../core/trash.js';
import { callAIWithTools, getAIContext, getOWLPersonality, openChatBar, safeAgentReply, saveChatMsg, INBOX_TOOLS } from '../ai/core.js';
import { UI_TOOLS_RULES } from '../ai/prompts.js';
import { UI_TOOL_NAMES, handleUITool } from '../ai/ui-tools.js';
import { _toolCallToUniversalAction, processUniversalAction } from './habits.js';
import { tryBoardUpdate } from '../owl/proactive.js';
import { getInbox, saveInbox, renderInbox } from './inbox.js';
import { processUniversalAction } from './habits.js';
import {
  getFinance, saveFinance, renderFinance, formatMoney, getCurrency,
  getFinBudget, saveFinBudget, getFinPeriodRange,
} from './finance.js';
import { getFinCats, createFinCategory } from './finance-cats.js';

let _financeTypingEl = null;
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
  if (!_noSave) { try { openChatBar('finance'); } catch(e) {} }
  const isAgent = role === 'agent';
  const div = document.createElement('div');
  div.style.cssText = `display:flex;${isAgent ? '' : 'justify-content:flex-end'}`;
  div.innerHTML = `<div class="msg-bubble ${isAgent ? 'msg-bubble--agent' : 'msg-bubble--user'}">${escapeHtml(text).replace(/\n/g,'<br>')}</div>`;
  el.appendChild(div);
  el.scrollTop = el.scrollHeight;
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
    if (pct >= 1) addFinanceChatMsg('agent', `⚠️ Загальний бюджет на місяць перевищено. Витрачено ${formatMoney(totalSpent)} з ${formatMoney(budget.total)}.`);
    else if (pct >= 0.8) addFinanceChatMsg('agent', `💡 До ліміту місяця залишилось ${formatMoney(budget.total - totalSpent)}.`);
  }
  const catLimit = budget.categories?.[category];
  if (catLimit > 0) {
    const catSpent = txs.filter(t => t.category === category).reduce((s, t) => s + t.amount, 0);
    const pct = catSpent / catLimit;
    if (pct >= 1) addFinanceChatMsg('agent', `⚠️ Ліміт по "${category}" перевищено: ${formatMoney(catSpent)} з ${formatMoney(catLimit)}.`);
    else if (pct >= 0.8) addFinanceChatMsg('agent', `💡 По "${category}" залишилось ${formatMoney(catLimit - catSpent)}.`);
  }
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
Підказки: Їжа(кава,ресторан,продукти), Транспорт(бензин,таксі,Uber), Підписки(Netflix,Spotify), Здоровʼя(аптека,лікар), Житло(оренда,комуналка), Покупки(одяг,техніка)
Категорії доходів: ${cats.income.join(', ')}
Якщо є сумнів — обирай найближчу категорію, НЕ "Інше".

🔴 ЖОРСТКЕ ПРАВИЛО ВИТРАТ/ДОХОДІВ:
Якщо повідомлення містить ЧИСЛО (суму грошей) + опис товару/категорії/джерела → ЗАВЖДИ викликай save_finance tool.
НЕ switch_tab, НЕ текст-питання, НЕ "чи хочеш записати".
Приклади:
- "50 на каву" → save_finance(fin_type="expense", amount=50, category="Їжа", fin_comment="кава")
- "300 продукти" → save_finance(fin_type="expense", amount=300, category="Їжа", fin_comment="продукти")
- "+3000 зарплата" або "отримав 3000" → save_finance(fin_type="income", amount=3000, category="Зарплата", fin_comment="")
- "120 бензин" → save_finance(fin_type="expense", amount=120, category="Транспорт", fin_comment="бензин")

Для редагування існуючої транзакції — update_transaction tool з її id.
Для CRUD задач/звичок/нотаток/подій/моментів — відповідні tools (save_task, save_habit, save_note, create_event, save_moment, complete_task, edit_*, delete_*).
ЗАДАЧА = дія ЗРОБИТИ → save_task. ПОДІЯ = факт що СТАНЕТЬСЯ → create_event. "Перенеси подію" = edit_event.

ВАЖЛИВО: НЕ вигадуй ліміти, бюджети або плани яких немає в даних вище. Якщо бюджет "не встановлено" — не згадуй перевищення. Тільки реальні цифри.

Fallback JSON (НЕ tool — тільки текстом, для специфічного функціоналу Фінансів):
- Видалити транзакцію: {"action":"delete_transaction","id":1234567890}
- Встановити бюджет: {"action":"set_budget","total":2000,"categories":{"Їжа":400}}
- Створити категорію: {"action":"create_category","type":"expense","name":"Нова категорія"}

${UI_TOOLS_RULES}${aiContext ? '\n\n' + aiContext : ''}`;

  try {
    // "Один мозок #2 A": INBOX_TOOLS — повний CRUD + UI.
    // Локальний dispatch — update_transaction має кастомний handler (інакше processUniversalAction його не знає).
    const msg = await callAIWithTools(FINANCE_BAR_PROMPT, financeBarHistory.slice(-10), INBOX_TOOLS);

    if (msg && Array.isArray(msg.tool_calls) && msg.tool_calls.length > 0) {
      for (const tc of msg.tool_calls) {
        let args = {};
        try { args = JSON.parse(tc.function.arguments || '{}'); } catch(e) {}
        // UI tool
        if (UI_TOOL_NAMES.has(tc.function.name)) {
          const res = handleUITool(tc.function.name, args);
          if (res && res.text) addFinanceChatMsg('agent', res.text);
          continue;
        }
        // update_transaction — локальний handler Фінансів (не в processUniversalAction)
        if (tc.function.name === 'update_transaction') {
          const txs2 = getFinance();
          const idx = txs2.findIndex(t => t.id === args.id);
          if (idx !== -1) {
            if (args.category) txs2[idx].category = args.category;
            if (args.comment !== undefined) txs2[idx].comment = args.comment;
            if (args.amount) txs2[idx].amount = parseFloat(args.amount);
            saveFinance(txs2);
            renderFinance();
            addFinanceChatMsg('agent', `✓ Оновлено: ${txs2[idx].category} ${formatMoney(txs2[idx].amount)}`);
          } else {
            addFinanceChatMsg('agent', 'Транзакцію не знайдено.');
          }
          continue;
        }
        // CRUD через universal action
        const acts = _toolCallToUniversalAction(tc.function.name, args);
        for (const a of acts) processUniversalAction(a, text, addFinanceChatMsg);
      }
      financeBarLoading = false;
      return;
    }

    const reply = msg && msg.content ? msg.content.trim() : '';
    if (!reply) { addFinanceChatMsg('agent', 'Щось пішло не так.'); financeBarLoading = false; return; }

    // Обробка одного JSON блоку. Повертає true якщо оброблено, false якщо невідомий action.
    const _processOne = (parsed) => {
      if (processUniversalAction(parsed, text, addFinanceChatMsg)) return true;
      if (parsed.action === 'save_expense' || parsed.action === 'save_income') {
        const type = parsed.action === 'save_expense' ? 'expense' : 'income';
        const amount = parseFloat(parsed.amount);
        const category = parsed.category || 'Інше';
        const comment = parsed.comment || '';
        const ts = Date.now() + Math.floor(Math.random() * 1000); // унікальний id при множинних операціях
        const txs2 = getFinance();
        txs2.unshift({ id: ts, type, amount, category, comment, ts });
        saveFinance(txs2);
        // B-48: створюємо картку у стрічці Inbox
        try {
          const items = getInbox();
          const inboxText = `${type === 'expense' ? '-' : '+'}${formatMoney(amount)} · ${category}${comment ? ' — ' + comment : ''}`;
          items.unshift({ id: ts, text: inboxText, category: 'finance', ts, processed: true });
          saveInbox(items);
          renderInbox();
        } catch(e) {}
        renderFinance();
        try { localStorage.setItem('nm_owl_tab_ts_finance', '0'); tryBoardUpdate('finance'); } catch(e) {}
        addFinanceChatMsg('agent', `✓ ${type === 'expense' ? '-' : '+'}${formatMoney(amount)} · ${category}`);
        checkFinBudgetWarning(type, category, amount);
        return true;
      }
      if (parsed.action === 'delete_transaction') {
        const item = getFinance().find(t => t.id === parsed.id);
        if (item) addToTrash('finance', item);
        saveFinance(getFinance().filter(t => t.id !== parsed.id));
        renderFinance();
        addFinanceChatMsg('agent', `🗑 Видалено: ${item ? item.category + ' ' + formatMoney(item.amount) : 'операцію'}`);
        return true;
      }
      if (parsed.action === 'update_transaction') {
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
        return true;
      }
      if (parsed.action === 'set_budget') {
        const bdg = getFinBudget();
        if (parsed.total) bdg.total = parsed.total;
        if (parsed.categories) Object.assign(bdg.categories, parsed.categories);
        saveFinBudget(bdg);
        renderFinance();
        addFinanceChatMsg('agent', '✓ Бюджет оновлено');
        return true;
      }
      if (parsed.action === 'create_category') {
        const type = parsed.type === 'income' ? 'income' : 'expense';
        const c = getFinCats();
        const exists = (c[type] || []).some(x => x.name.toLowerCase() === (parsed.name || '').toLowerCase());
        if (!exists) createFinCategory(type, { name: parsed.name });
        renderFinance();
        addFinanceChatMsg('agent', `✓ Категорію "${parsed.name}" ${exists ? 'вже існувала' : 'додано'}`);
        return true;
      }
      return false;
    };

    // Витягуємо всі JSON-блоки з відповіді (може бути кілька — "видали А,Б,В, додай Г").
    // Якщо блоків немає або жоден не вдалось обробити — показуємо reply як текст.
    const blocks = extractJsonBlocks(reply);
    let handled = false;
    for (const parsed of blocks) {
      if (_processOne(parsed)) handled = true;
    }
    if (!handled) safeAgentReply(reply, addFinanceChatMsg);
  } catch { addFinanceChatMsg('agent', 'Мережева помилка.'); }
  financeBarLoading = false;
}

// Window export для inline onclick у HTML
Object.assign(window, { sendFinanceBarMessage });
