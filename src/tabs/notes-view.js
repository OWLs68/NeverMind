// ============================================================
// tabs/notes-view.js — NOTE VIEW MODAL (F2) + note-chat
//
// Винесено з src/tabs/notes.js (v3pexs 28.06, D4 автономного блоку; мапа
// розвідника): notes.js був 1408 рядків (>1200) — модалка перегляду нотатки
// з чатом (302 рядки) — цільний блок з чистими межами. Поведінка 1:1.
// notes.js ре-експортує openNoteView/closeNoteView (strangler) + Object.assign
// window лишився у notes.js (резолвить імпортовані звідси імена).
// activeNoteMenuId — module-var notes.js: запис через сеттер setActiveNoteMenuId
// (прямий запис у імпортовану змінну неможливий у ESM).
// ============================================================

import { t, escapeHtml, parseContentChips } from '../core/utils.js';
import { currentTab } from '../core/nav.js';
import { callAI, getAIContext, getOWLPersonality, openaiFetch, handleChatError } from '../ai/core.js';
import { logUsage } from '../core/usage-meter.js';
import { renderChips } from '../owl/chips.js';
import { makeNote } from '../data/entity-factories.js';
import { findCategoryByFolder } from '../data/notes-categories.js';
import { getNotes, saveNotes, renderNotes, openEditNote, setActiveNoteMenuId, getFolderColor } from './notes.js';


// === NOTE VIEW MODAL (F2) ===
let activeNoteViewId = null;
let noteChatHistory = [];
let noteChatLoading = false;

// getFolderColor ПОВЕРНУТО у notes.js (фікс E2E #39): залежить від констант
// FOLDER_BG/FOLDER_BORDER/DEFAULT_NOTE_FOLDER що живуть там — esbuild лишав
// їх вільними ідентифікаторами → ReferenceError → нотатки не рендерились.

// Getter для notes.js (noteMenuEdit/Delete читають який view відкритий;
// пряме читання чужої module-var після різу = звернення до неіснуючого глобала).
export function getActiveNoteViewId() { return activeNoteViewId; }

export function openNoteView(id) {
  const notes = getNotes();
  const n = notes.find(x => x.id === id);
  if (!n) return;
  activeNoteViewId = id;
  noteChatHistory = [];
  noteChatLoading = false;

  // Колір фону = колір картки нотатки
  const fc = getFolderColor(n.folder);
  const modal = document.getElementById('note-view-modal');
  if (modal) modal.style.background = fc.bg;

  document.getElementById('note-view-folder').textContent = n.folder || t('notes.default_folder', 'Загальне');
  const preview = n.text.length > 50 ? n.text.substring(0, 50) + '…' : n.text;
  document.getElementById('note-view-preview').textContent = preview;

  // contenteditable — встановлюємо текст
  const textEl = document.getElementById('note-view-text');
  if (textEl) textEl.textContent = n.text;

  document.getElementById('note-chat-messages').innerHTML = '';

  // Update lastViewed
  const allNotes = getNotes();
  const idx = allNotes.findIndex(x => x.id === id);
  if (idx !== -1) { allNotes[idx].lastViewed = Date.now(); saveNotes(allNotes); }

  switchNoteViewTab('note');
  modal.style.display = 'flex';
  // Скролимо до початку тексту
  requestAnimationFrame(() => {
    const panel = document.getElementById('note-view-panel-note');
    if (panel) panel.scrollTop = 0;
    const textEl2 = document.getElementById('note-view-text');
    if (textEl2) textEl2.scrollTop = 0;
  });
}

export function closeNoteView() {
  // Зберігаємо перед закриттям
  if (activeNoteViewId) {
    const textEl = document.getElementById('note-view-text');
    if (textEl) {
      const notes = getNotes();
      const idx = notes.findIndex(x => x.id === activeNoteViewId);
      if (idx !== -1 && textEl.textContent !== notes[idx].text) {
        notes[idx].text = textEl.textContent;
        notes[idx].updatedAt = Date.now();
        saveNotes(notes);
        if (currentTab === 'notes') renderNotes();
      }
    }
  }
  document.getElementById('note-view-modal').style.display = 'none';
  activeNoteViewId = null;
  noteChatHistory = [];
}

let _autoSaveNoteTimer = null;
export function autoSaveNoteView() {
  if (!activeNoteViewId) return;
  if (_autoSaveNoteTimer) clearTimeout(_autoSaveNoteTimer);
  _autoSaveNoteTimer = setTimeout(() => {
    const textEl = document.getElementById('note-view-text');
    if (!textEl) return;
    const notes = getNotes();
    const idx = notes.findIndex(x => x.id === activeNoteViewId);
    if (idx !== -1) {
      notes[idx].text = textEl.textContent;
      notes[idx].updatedAt = Date.now();
      saveNotes(notes);
      // Оновлюємо preview в хедері
      const preview = notes[idx].text.length > 50 ? notes[idx].text.substring(0, 50) + '…' : notes[idx].text;
      const prevEl = document.getElementById('note-view-preview');
      if (prevEl) prevEl.textContent = preview;
    }
  }, 800); // зберігаємо через 800мс після зупинки друку
}

export function openNoteViewMenu() {
  if (!activeNoteViewId) return;
  const notes = getNotes();
  const n = notes.find(x => x.id === activeNoteViewId);
  if (!n) return;
  // Використовуємо існуюче меню нотаток
  setActiveNoteMenuId(activeNoteViewId);
  document.getElementById('note-menu').style.display = 'flex';
}

export function openEditNoteFromView() {
  const id = activeNoteViewId;
  closeNoteView();
  openEditNote(id);
}

export function switchNoteViewTab(tab) {
  const notePanel = document.getElementById('note-view-panel-note');
  const chatPanel = document.getElementById('note-view-panel-chat');
  const inputArea = document.getElementById('note-chat-input-area');
  const tabNote = document.getElementById('note-view-tab-note');
  const tabChat = document.getElementById('note-view-tab-chat');

  if (tab === 'note') {
    notePanel.style.display = 'block';
    chatPanel.style.display = 'none';
    inputArea.style.display = 'none';
    tabNote.style.color = '#c2620a';
    tabNote.style.borderBottomColor = '#c2620a';
    tabChat.style.color = 'rgba(30,16,64,0.4)';
    tabChat.style.borderBottomColor = 'transparent';
  } else {
    notePanel.style.display = 'none';
    chatPanel.style.display = 'flex';
    chatPanel.style.flexDirection = 'column';
    inputArea.style.display = 'flex';
    tabNote.style.color = 'rgba(30,16,64,0.4)';
    tabNote.style.borderBottomColor = 'transparent';
    tabChat.style.color = '#c2620a';
    tabChat.style.borderBottomColor = '#c2620a';

    // Auto-greet if first open
    if (noteChatHistory.length === 0) {
      const notes = getNotes();
      const n = notes.find(x => x.id === activeNoteViewId);
      if (n) initNoteChatGreeting(n);
    }
  }
}

export async function initNoteChatGreeting(note) {
  const key = localStorage.getItem('nm_gemini_key');
  if (!key) {
    addNoteChatMsg('agent', t('notes.chat.no_key_greeting', 'Введи OpenAI ключ в налаштуваннях щоб спілкуватись з агентом.'));
    return;
  }
  const aiContext = getAIContext();
  const systemPrompt = `${getOWLPersonality()} Тебе попросили поговорити про конкретну нотатку. Прочитай її і скажи коротко (1-2 речення): що це за нотатка і як ти можеш допомогти з нею. Відповідай українською.${aiContext ? '\n\n' + aiContext : ''}`;
  const greeting = await callAI(systemPrompt, `Нотатка: ${note.text}`, {}, 'notes-greeting');
  if (greeting) addNoteChatMsg('agent', greeting);
}

export function addNoteChatMsg(role, text, chips = null) {
  // MPVly 05.05 — інлайн-парсинг чіпів (один мозок).
  if (role === 'agent' && (!chips || chips.length === 0) && text) {
    const _p = parseContentChips(text);
    if (_p.chips) { text = _p.text; chips = _p.chips; }
  }
  const el = document.getElementById('note-chat-messages');
  const isAgent = role === 'agent';
  if (isAgent) el.querySelectorAll('.chat-chips-row').forEach(n => n.remove());
  const div = document.createElement('div');
  div.style.cssText = `display:flex;${isAgent ? '' : 'justify-content:flex-end'}`;
  div.innerHTML = `<div style="max-width:82%;background:${isAgent ? 'rgba(255,255,255,0.9)' : '#4f46e5'};color:${isAgent ? '#1e1040' : 'white'};border-radius:${isAgent ? '4px 14px 14px 14px' : '14px 4px 14px 14px'};padding:12px 16px;font-size:18px;line-height:1.7;font-weight:${isAgent ? '400' : '500'}">${escapeHtml(text).replace(/\n/g,'<br>')}</div>`;
  el.appendChild(div);
  if (isAgent && Array.isArray(chips) && chips.length > 0) {
    const chipsRow = document.createElement('div');
    chipsRow.className = 'chat-chips-row';
    renderChips(chipsRow, chips, 'notes');
    el.appendChild(chipsRow);
  }
  el.scrollTop = el.scrollHeight;
  if (role !== 'agent') noteChatHistory.push({ role: 'user', content: text });
}

export async function sendNoteChatMessage() {
  if (noteChatLoading) return;
  const input = document.getElementById('note-chat-input');
  const text = input.value.trim();
  if (!text) return;
  const key = localStorage.getItem('nm_gemini_key');
  if (!key) { addNoteChatMsg('agent', t('notes.chat.no_key', 'Введи OpenAI ключ в налаштуваннях.')); return; }

  input.value = '';
  input.style.height = 'auto';
  addNoteChatMsg('user', text);
  noteChatLoading = true;

  const btn = document.getElementById('note-chat-send');
  btn.disabled = true;

  const notes = getNotes();
  const n = notes.find(x => x.id === activeNoteViewId);
  const aiContext = getAIContext();
  const currentText = n?.text || '';

  const systemPrompt = `${getOWLPersonality()} Ти асистент для роботи з нотаткою користувача.

Поточний текст нотатки:
---
${currentText}
---

Ти можеш:
1. Відповідати на питання про нотатку — звичайний текст
2. Оновлювати нотатку — якщо просять написати, доповнити, змінити, структурувати, додати список тощо

Якщо потрібно ОНОВИТИ нотатку — відповідай ТІЛЬКИ JSON:
{"action":"update_note","text":"повний новий текст нотатки"}

Якщо просто відповідаєш — відповідай звичайним текстом (2-4 речення).
НЕ використовуй JSON якщо тільки обговорюєш або пояснюєш.
${aiContext ? '\n\n' + aiContext : ''}`;

  try {
    const res = await openaiFetch('chat/completions', {
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          ...noteChatHistory.slice(-10),
          { role: 'user', content: text }
        ],
        max_tokens: 800,
        temperature: 0.7
      });
    const data = await res.json();
    if (data?.usage) logUsage('notes-ai', data.usage, data.model);
    const rawReply = data.choices?.[0]?.message?.content;
    const { text: reply, chips: extractedChips } = parseContentChips(rawReply || '');
    if (reply) {
      noteChatHistory.push({ role: 'user', content: text });
      noteChatHistory.push({ role: 'assistant', content: reply });
      // Перевіряємо чи це JSON з update_note
      try {
        const clean = reply.replace(/^```json\s*|```\s*$/g, '').trim();
        const parsed = JSON.parse(clean);
        if (parsed.action === 'update_note' && parsed.text) {
          // Оновлюємо нотатку
          const allNotes = getNotes();
          const idx = allNotes.findIndex(x => x.id === activeNoteViewId);
          if (idx !== -1) {
            allNotes[idx].text = parsed.text;
            allNotes[idx].updatedAt = Date.now();
            saveNotes(allNotes);
            // Оновлюємо відображення в редакторі
            const textEl = document.getElementById('note-view-text');
            if (textEl) textEl.textContent = parsed.text;
            renderNotes();
            addNoteChatMsg('agent', t('notes.chat.updated', '✓ Нотатку оновлено.'));
          } else {
            addNoteChatMsg('agent', t('notes.chat.not_found', 'Не вдалося знайти нотатку.'));
          }
        } else {
          addNoteChatMsg('agent', reply, extractedChips);
          showSaveAsNoteBtn(reply);
        }
      } catch {
        addNoteChatMsg('agent', reply, extractedChips);
        showSaveAsNoteBtn(reply);
      }
    } else {
      handleChatError(addNoteChatMsg);
    }
  } catch {
    addNoteChatMsg('agent', t('common.network_error', 'Мережева помилка.'));
  }
  noteChatLoading = false;
  btn.disabled = false;
}

// Зберігаємо текст у closure — безпечно для будь-яких символів
let _pendingAgentNote = '';

export function showSaveAsNoteBtn(replyText) {
  const el = document.getElementById('note-chat-messages');
  const old = document.getElementById('note-chat-save-btn');
  if (old) old.remove();
  _pendingAgentNote = replyText;
  const btn = document.createElement('div');
  btn.id = 'note-chat-save-btn';
  btn.style.cssText = 'display:flex;justify-content:flex-end;margin-top:-4px';
  const button = document.createElement('button');
  button.textContent = t('notes.chat.save_as_note', '+ Зберегти як нотатку');
  button.style.cssText = 'background:rgba(79,70,229,0.1);border:1px solid rgba(79,70,229,0.2);border-radius:8px;padding:5px 12px;font-size:13px;font-weight:700;color:#4f46e5;cursor:pointer';
  button.addEventListener('click', () => saveAgentResponseAsNote(_pendingAgentNote));
  btn.appendChild(button);
  el.appendChild(btn);
  el.scrollTop = el.scrollHeight;
}

export function saveAgentResponseAsNote(text) {
  const notes = getNotes();
  const originalNote = notes.find(x => x.id === activeNoteViewId);
  const folder = originalNote?.folder || t('notes.default_folder', 'Загальне');
  notes.unshift(makeNote({ text: text, folder, source: 'ai' }));
  saveNotes(notes);
  renderNotes();
  document.getElementById('note-chat-save-btn')?.remove();
  _pendingAgentNote = '';
}
