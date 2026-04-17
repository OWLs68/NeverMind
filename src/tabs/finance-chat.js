// ============================================================
// finance-chat.js — Chat bar Фінансів (AI бот для фінансів)
// Винесено з finance.js у рефакторингу 17.04.2026 (сесія gHCOh).
// ============================================================

import { escapeHtml } from '../core/utils.js';
import { addToTrash } from '../core/trash.js';
import { getAIContext, getOWLPersonality, openChatBar, safeAgentReply, saveChatMsg } from '../ai/core.js';
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

Якщо користувач просить змінити категорію або опис існуючої операції — використовуй update_transaction з її id. НЕ створюй нову операцію і НЕ видаляй стару окремо.
ВАЖЛИВО: НЕ вигадуй ліміти, бюджети або плани яких немає в даних вище. Якщо бюджет "не встановлено" — не згадуй перевищення. Тільки реальні цифри.
Також вмієш: створити задачу {"action":"create_task","title":"назва","steps":[]}, звичку {"action":"create_habit","name":"назва","days":[0,1,2,3,4,5,6]}, редагувати звичку {"action":"edit_habit","habit_id":ID,"name":"нова назва","days":[0,1,2,3,4,5,6]}, нотатку {"action":"create_note","text":"текст","folder":null}, заплановану подію {"action":"create_event","title":"назва","date":"YYYY-MM-DD","time":null,"priority":"normal"}, закрити задачу {"action":"complete_task","task_id":ID}, відмітити звичку {"action":"complete_habit","habit_name":"назва"}, редагувати задачу {"action":"edit_task","task_id":ID,"title":"назва","dueDate":"YYYY-MM-DD","priority":"normal|important|critical"}, видалити задачу {"action":"delete_task","task_id":ID}, видалити звичку {"action":"delete_habit","habit_id":ID}, перевідкрити задачу {"action":"reopen_task","task_id":ID}, записати момент дня {"action":"add_moment","text":"текст"}. ЗАДАЧА = дія ЗРОБИТИ. ПОДІЯ = факт що СТАНЕТЬСЯ. "Перенеси подію" = edit_event.
Також: змінити подію {"action":"edit_event","event_id":ID,"date":"YYYY-MM-DD"}, видалити подію {"action":"delete_event","event_id":ID}, змінити нотатку {"action":"edit_note","note_id":ID,"text":"текст"}, розпорядок {"action":"save_routine","day":"mon" або масив,"blocks":[{"time":"07:00","activity":"Підйом"}]}.${aiContext ? '\n\n' + aiContext : ''}`;

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'system', content: FINANCE_BAR_PROMPT }, ...financeBarHistory.slice(-10)], max_tokens: 300, temperature: 0.5 })
    });
    const data = await res.json();
    const reply = data.choices?.[0]?.message?.content?.trim();
    if (!reply) { addFinanceChatMsg('agent', 'Щось пішло не так.'); financeBarLoading = false; return; }

    try {
      const jsonMatch = reply.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : reply);
      if (processUniversalAction(parsed, text, addFinanceChatMsg)) {
        // оброблено універсально
      } else if (parsed.action === 'save_expense' || parsed.action === 'save_income') {
        const type = parsed.action === 'save_expense' ? 'expense' : 'income';
        const amount = parseFloat(parsed.amount);
        const category = parsed.category || 'Інше';
        const comment = parsed.comment || '';
        const ts = Date.now();
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
      } else if (parsed.action === 'delete_transaction') {
        const item = getFinance().find(t => t.id === parsed.id);
        const _item = getFinance().find(t => t.id === parsed.id);
        if (_item) addToTrash('finance', _item);
        saveFinance(getFinance().filter(t => t.id !== parsed.id));
        renderFinance();
        addFinanceChatMsg('agent', `🗑 Видалено: ${item ? item.category + ' ' + formatMoney(item.amount) : 'операцію'}`);
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
        const type = parsed.type === 'income' ? 'income' : 'expense';
        const c = getFinCats();
        const exists = (c[type] || []).some(x => x.name.toLowerCase() === (parsed.name || '').toLowerCase());
        if (!exists) createFinCategory(type, { name: parsed.name });
        renderFinance();
        addFinanceChatMsg('agent', `✓ Категорію "${parsed.name}" ${exists ? 'вже існувала' : 'додано'}`);
      } else {
        safeAgentReply(reply, addFinanceChatMsg);
      }
    } catch {
      safeAgentReply(reply, addFinanceChatMsg);
    }
  } catch { addFinanceChatMsg('agent', 'Мережева помилка.'); }
  financeBarLoading = false;
}

// Window export для inline onclick у HTML
Object.assign(window, { sendFinanceBarMessage });
