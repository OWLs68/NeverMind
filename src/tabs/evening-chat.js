// ============================================================
// evening-chat.js — Чат-бар Вечора + вечірній діалог
// ============================================================
// Винесено з evening.js у сесії QV1n2 (19.04.2026) в рамках Фази 0
// рефакторингу Вечора 2.0 (детальний план → docs/EVENING_2.0_PLAN.md).
//
// Містить:
//   • sendEveningBarMessage() / addEveningBarMsg() — чат-бар Вечора
//   • openEveningTopic(topic) — CTA "Поговорити про завтра" / "Записати свій день"
//     (Фаза 6 — preload стартового повідомлення сови з чіпами, 1×/день/топік)
//
// Фаза 7 Вечора 2.0 додасть:
//   • Tool calling для автосинхронізації (задача + подія + розпорядок + пам'ять)
//
// Залежності: core/utils, ai/core, ai/prompts, tabs/habits (processUniversalAction),
//             owl/chips, ui/unread-badge.
// ============================================================

import { escapeHtml, extractJsonBlocks } from '../core/utils.js';
import { callAIWithHistory, getAIContext, openChatBar, safeAgentReply, saveChatMsg } from '../ai/core.js';
import { processUniversalAction } from './habits.js';
import { showUnreadBadge } from '../ui/unread-badge.js';
import { renderChips } from '../owl/chips.js';
import { getEveningChatSystem } from '../ai/prompts.js';

// Typing indicator (локальний стейт для вечірнього чату)
let _eveningTypingEl = null;

// === EVENING TOPIC START (Фаза 6 Вечора 2.0) ===
// CTA-кнопки "Поговорити про завтра" і "Записати свій день" викликають цю функцію.
// Вона відкриває чат-бар Вечора і кладе preload-повідомлення сови з чіпами.
// Один раз на день на топік — повторний тап просто відкриває чат без спаму.
const EVENING_TOPIC_STARTED_KEY = 'nm_evening_topic_started';

async function openEveningTopic(topic) {
  const todayISO = new Date().toISOString().slice(0, 10);
  let started = {};
  try { started = JSON.parse(localStorage.getItem(EVENING_TOPIC_STARTED_KEY) || '{}'); } catch(e) {}
  if (started.date !== todayISO) started = { date: todayISO };

  // Відкриваємо чат-бар знизу
  try { openChatBar('evening'); } catch(e) {}

  if (started[topic]) return; // сценарій вже стартував сьогодні — не дублюємо

  const key = localStorage.getItem('nm_gemini_key');
  if (!key) { addEveningBarMsg('agent', 'Введи OpenAI ключ в налаштуваннях.'); return; }

  addEveningBarMsg('typing', '');

  const topicPrompts = {
    tomorrow: `Юзер щойно тапнув "Поговорити про завтра". У контексті є майбутні події календаря, недороблені задачі, пам'ять. Почни розмову 1-2 реченнями — якщо у контексті є конкретна подія на завтра або важлива недороблена задача, згадай її ("Завтра у тебе вже дзвінок о 15 — що ще?"). Заверши питанням що ще планує на завтра. Додай чіпи типу запису: [Задача] [Подія] [І те й те].`,
    diary: `Юзер щойно тапнув "Записати свій день". У контексті є моменти сьогодні, настрій, закриті задачі/кроки проектів, витрати. Почни 1-2 реченнями — якщо є яскравий момент або паттерн, згадай його ("Бачу ти записав у моментах що важко з маркетингом"). Заверши відкритим питанням як воно. Додай чіпи настрою: [🔥] [😊] [😐] [😕] [😞].`,
  };

  const tp = topicPrompts[topic];
  if (!tp) return;

  const systemPrompt = getEveningChatSystem() + '\n\n' + getAIContext() + '\n\n=== СЦЕНАРІЙ ===\n' + tp;

  try {
    const reply = await callAIWithHistory(systemPrompt, []);
    if (!reply) { addEveningBarMsg('agent', 'Щось пішло не так.'); return; }
    const blocks = extractJsonBlocks(reply);
    let text = null, chips = null;
    for (const parsed of blocks) {
      if (parsed && typeof parsed.text === 'string' && parsed.text.trim()) text = parsed.text.trim();
      if (parsed && Array.isArray(parsed.chips)) chips = parsed.chips;
    }
    if (text) {
      addEveningBarMsg('agent', text, false, chips);
      started[topic] = Date.now();
      localStorage.setItem(EVENING_TOPIC_STARTED_KEY, JSON.stringify(started));
    } else {
      safeAgentReply(reply, addEveningBarMsg);
    }
  } catch { addEveningBarMsg('agent', 'Мережева помилка.'); }
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
  openEveningTopic,
  sendEveningBarMessage,
  showEveningBarMessages,
});
