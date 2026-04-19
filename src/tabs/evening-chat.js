// ============================================================
// evening-chat.js — Чат-бар Вечора + вечірній діалог
// ============================================================
// Винесено з evening.js у сесії QV1n2 (19.04.2026) в рамках Фази 0
// рефакторингу Вечора 2.0 (детальний план → docs/EVENING_2.0_PLAN.md).
//
// Містить:
//   • sendEveningBarMessage() / addEveningBarMsg() — чат-бар Вечора
//   • openEveningDialog() / closeEveningDialog() / sendDialogMessage() — вечірній діалог (фуллскрін)
//
// У Фазах 3-7 Вечора 2.0 цей файл отримає:
//   • Старт-повідомлення від сови о 18:00 (тригер evening-prompt)
//   • Чіпи у діалозі
//   • Tool calling для автосинхронізації
//
// Залежності: core/nav, core/utils, ai/core, tabs/habits (processUniversalAction),
//             tabs/evening (getMoments, getMomentsContext — без циклу).
// ============================================================

import { escapeHtml, extractJsonBlocks } from '../core/utils.js';
import { callAI, callAIWithHistory, getAIContext, getOWLPersonality, openChatBar, safeAgentReply, saveChatMsg } from '../ai/core.js';
import { processUniversalAction } from './habits.js';
import { getMoments } from './evening.js';
import { showUnreadBadge } from '../ui/unread-badge.js';
import { renderChips } from '../owl/chips.js';
import { getEveningChatSystem } from '../ai/prompts.js';

// Typing indicator (локальний стейт для вечірнього чату)
let _eveningTypingEl = null;

// === EVENING DIALOG (фуллскрін модалка) ===
let dialogHistory = [];
let dialogLoading = false;

function openEveningDialog() {
  dialogHistory = [];
  document.getElementById('evening-dialog').style.display = 'flex';
  document.getElementById('dialog-messages').innerHTML = '';
  document.getElementById('dialog-input').value = '';

  const settings = JSON.parse(localStorage.getItem('nm_settings') || '{}');
  const name = settings.name ? `, ${settings.name}` : '';
  addDialogMessage('agent', `Привіт${name}. Розкажи як пройшов день — що вийшло, що ні. Без прикрас.`);
}

function closeEveningDialog() {
  document.getElementById('evening-dialog').style.display = 'none';
}

function addDialogMessage(role, text) {
  const el = document.getElementById('dialog-messages');
  const isAgent = role === 'agent';
  const div = document.createElement('div');
  div.style.cssText = `display:flex;${isAgent ? '' : 'justify-content:flex-end'}`;
  div.innerHTML = `<div style="max-width:80%;background:${isAgent ? 'rgba(237,233,255,0.9)' : '#7c3aed'};color:${isAgent ? '#4c1d95' : 'white'};border-radius:${isAgent ? '4px 16px 16px 16px' : '16px 4px 16px 16px'};padding:10px 13px;font-size:15px;line-height:1.55;font-weight:500">${escapeHtml(text)}</div>`;
  el.appendChild(div);
  el.scrollTop = el.scrollHeight;
  dialogHistory.push({ role: isAgent ? 'assistant' : 'user', content: text });
}

async function sendDialogMessage() {
  if (dialogLoading) return;
  const input = document.getElementById('dialog-input');
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  input.style.height = 'auto';
  addDialogMessage('user', text);
  dialogLoading = true;

  const aiContext = getAIContext();
  const today = new Date().toDateString();
  const moments = getMoments().filter(m => new Date(m.ts).toDateString() === today);
  const systemPrompt = `${getOWLPersonality()} Короткі відповіді (1-3 речення). Конкретно і по ділу. Відповідай українською.${aiContext ? '\n\n' + aiContext : ''}
Контекст дня: ${moments.map(m=>`[${m.mood}] ${m.text}`).join('; ') || 'моменти не додані'}`;

  const key = localStorage.getItem('nm_gemini_key');
  if (!key) { addDialogMessage('agent', 'Введи OpenAI ключ в налаштуваннях.'); dialogLoading = false; return; }

  const messages = [
    { role: 'system', content: systemPrompt },
    ...dialogHistory.slice(-10)
  ];

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({ model: 'gpt-4o-mini', messages, max_tokens: 200, temperature: 0.8 })
    });
    const data = await res.json();
    const reply = data.choices?.[0]?.message?.content;
    if (reply) addDialogMessage('agent', reply);
    else addDialogMessage('agent', 'Щось пішло не так. Спробуй ще раз.');
  } catch {
    addDialogMessage('agent', 'Мережева помилка.');
  }
  dialogLoading = false;
}

// === EVENING AI BAR (чат-бар знизу вкладки) ===
let eveningBarHistory = [];
let eveningBarLoading = false;

function showEveningBarMessages() {
  openChatBar('evening');
}

export function addEveningBarMsg(role, text, _noSave = false, chips = null) {
  const el = document.getElementById('evening-bar-messages');
  if (!el) return;
  if (_eveningTypingEl) { _eveningTypingEl.remove(); _eveningTypingEl = null; }
  if (role === 'typing') {
    const td = document.createElement('div');
    td.style.cssText = 'display:flex';
    td.innerHTML = '<div style="background:rgba(255,255,255,0.12);border-radius:4px 12px 12px 12px;padding:5px 10px"><div class=\"ai-typing\"><span></span><span></span><span></span></div></div>';
    el.appendChild(td);
    _eveningTypingEl = td;
    el.scrollTop = el.scrollHeight;
    return;
  }
  if (!_noSave) { try { openChatBar('evening'); } catch(e) {} }
  const isAgent = role === 'agent';

  // Чищу застарілі чіп-стрічки попередніх повідомлень сови — чіпи релевантні
  // тільки останньому питанню, інакше вдруг юзер тапне старий чіп і плутанина
  if (isAgent) el.querySelectorAll('.chat-chips-row').forEach(n => n.remove());

  const div = document.createElement('div');
  div.style.cssText = `display:flex;${isAgent ? '' : 'justify-content:flex-end'}`;
  div.innerHTML = `<div class="msg-bubble ${isAgent ? 'msg-bubble--agent' : 'msg-bubble--user'}">${escapeHtml(text)}</div>`;
  el.appendChild(div);

  // Чіпи під бульбою сови (Фаза 4 Вечора 2.0) — рендер через спільний chips.js.
  // Клік на чіп кладе label у textarea і викликає sendEveningBarMessage.
  if (isAgent && Array.isArray(chips) && chips.length > 0) {
    const chipsRow = document.createElement('div');
    chipsRow.className = 'chat-chips-row';
    renderChips(chipsRow, chips, 'evening');
    el.appendChild(chipsRow);
  }

  el.scrollTop = el.scrollHeight;
  if (role !== 'agent') eveningBarHistory.push({ role: 'user', content: text });
  else eveningBarHistory.push({ role: 'assistant', content: text });
  if (!_noSave) saveChatMsg('evening', role, text);

  // Червона крапка на кнопці Надіслати — якщо агент написав а чат закритий
  // (типовий кейс: сова поклала evening-prompt о 18:00 а юзер ще не заходив)
  if (role === 'agent') {
    const bar = document.getElementById('evening-ai-bar');
    const chatWin = bar ? bar.querySelector('.ai-bar-chat-window') : null;
    const isOpen = chatWin && chatWin.classList.contains('open');
    if (!isOpen) showUnreadBadge('evening', 'evening-send-btn');
  }
}

export async function sendEveningBarMessage() {
  if (eveningBarLoading) return;
  const input = document.getElementById('evening-bar-input');
  const text = input.value.trim();
  if (!text) return;
  const key = localStorage.getItem('nm_gemini_key');
  if (!key) { addEveningBarMsg('agent', 'Введи OpenAI ключ в налаштуваннях.'); return; }
  input.value = ''; input.style.height = 'auto';
  input.focus();
  addEveningBarMsg('user', text);
  eveningBarLoading = true;
  addEveningBarMsg('typing', '');

  // Новий промпт Фази 4: чіпи у діалозі + контекст через getAIContext
  // (який вже містить getEveningContext з Фази 2 — моменти, задачі, проекти,
  // витрати, настрій, quit-звички). Окремі блоки "моменти/нотатки/inbox" тут
  // більше не потрібні — все у aiContext.
  const systemPrompt = getEveningChatSystem() + '\n\n' + getAIContext();

  try {
    const reply = await callAIWithHistory(systemPrompt, eveningBarHistory.slice(-10));
    if (!reply) { addEveningBarMsg('agent', 'Щось пішло не так.'); eveningBarLoading = false; return; }

    // Розбираємо AI-відповідь: JSON блоки з {text, chips, action} + можливий сирий текст.
    const blocks = extractJsonBlocks(reply);
    let handled = false;
    let lastAgentText = null;
    let lastChips = null;

    for (const parsed of blocks) {
      // Спроба обробити як дію (save_task, complete_habit тощо)
      const actionHandled = processUniversalAction(parsed, text, addEveningBarMsg);
      if (actionHandled) { handled = true; continue; }

      // Блок з текстом + можливими чіпами (типова відповідь з Фази 4)
      if (parsed && typeof parsed.text === 'string' && parsed.text.trim()) {
        lastAgentText = parsed.text.trim();
        if (Array.isArray(parsed.chips)) lastChips = parsed.chips;
        handled = true;
      } else if (parsed && Array.isArray(parsed.chips) && !lastChips) {
        // Рідкий випадок: чіпи без тексту (наприклад після action)
        lastChips = parsed.chips;
      }
    }

    if (lastAgentText) addEveningBarMsg('agent', lastAgentText, false, lastChips);
    else if (!handled) safeAgentReply(reply, addEveningBarMsg);
  } catch { addEveningBarMsg('agent', 'Мережева помилка.'); }
  eveningBarLoading = false;
}

// === WINDOW EXPORTS (HTML handlers only) ===
Object.assign(window, {
  openEveningDialog,
  closeEveningDialog,
  sendDialogMessage,
  sendEveningBarMessage,
  showEveningBarMessages,
});
