// ============================================================
// app-inbox.js — Inbox — чат, рендер, swipe, sendToAI, processSave, clarify
// Функції: addInboxChatMsg, renderInbox, swipeStart/Move/End, sendToAI, processSaveAction, processCompleteHabit, processCompleteTask, showClarify
// Залежності: app-core.js, app-ai.js
// ============================================================

// === INBOX CHAT MESSAGES ===
let _inboxTypingEl = null;

function addInboxChatMsg(role, text) {
  const el = document.getElementById('inbox-chat-messages');
  if (!el) return;

  // Видаляємо typing індикатор якщо є
  if (_inboxTypingEl) { _inboxTypingEl.remove(); _inboxTypingEl = null; }

  if (role === 'typing') {
    const div = document.createElement('div');
    div.style.cssText = 'display:flex';
    div.innerHTML = `<div style="background:rgba(255,255,255,0.12);border-radius:4px 14px 14px 14px;padding:5px 10px"><div class="ai-typing"><span></span><span></span><span></span></div></div>`;
    el.appendChild(div);
    _inboxTypingEl = div;
    el.scrollTop = el.scrollHeight;
    return;
  }

  // Розділювач часу — якщо юзер пише після паузи >5 хвилин
  if (role === 'user') {
    const now = Date.now();
    const gap = now - _lastUserMsgTs;
    if (_lastUserMsgTs > 0 && gap > 5 * 60 * 1000) {
      const mins = Math.round(gap / 60000);
      const label = mins < 60
        ? `${mins} хв тому`
        : mins < 1440
        ? `${Math.round(mins/60)} год тому`
        : 'раніше';
      const sep = document.createElement('div');
      sep.style.cssText = 'display:flex;align-items:center;gap:8px;margin:6px 0;opacity:0.45';
      sep.innerHTML = `<div style="flex:1;height:1px;background:rgba(255,255,255,0.2)"></div><div style="font-size:11px;color:rgba(255,255,255,0.6);white-space:nowrap;font-weight:500">${label}</div><div style="flex:1;height:1px;background:rgba(255,255,255,0.2)"></div>`;
      el.appendChild(sep);
    }
    _lastUserMsgTs = now;
  }

  const isAgent = role === 'agent';
  const div = document.createElement('div');
  div.style.cssText = `display:flex;${isAgent ? 'gap:8px;align-items:flex-start' : 'justify-content:flex-end'}`;
  if (isAgent) {
    div.innerHTML = `<div style="background:rgba(255,255,255,0.12);color:white;border-radius:4px 14px 14px 14px;padding:8px 12px;font-size:15px;font-weight:500;line-height:1.5;max-width:85%">${escapeHtml(text).replace(/\n/g, "<br>")}</div>`;
  } else {
    div.innerHTML = `<div style="background:rgba(255,255,255,0.88);color:#1e1040;border-radius:14px 4px 14px 14px;padding:8px 12px;font-size:15px;font-weight:500;line-height:1.5;max-width:85%">${escapeHtml(text)}</div>`;
  }
  el.appendChild(div);
  el.scrollTop = el.scrollHeight;
  saveChatMsg('inbox', role, text);
}

// Внутрішній рендер без запису в storage (щоб не дублювати при відновленні)
const CAT_SVG = {
  task:    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2fd0f9" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>',
  idea:    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7a8a00" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 2v2M12 20v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2 12h2M20 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/></svg>',
  note:    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8a6a3a" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
  habit:   '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
  event:   '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
  finance: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c2410c" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M14.31 8l-4.62 8M9.69 8l4.62 8M6 12h2.5M15.5 12H18"/></svg>',
};
const CAT_DOT_BG = {
  task:    'background:rgba(47,208,249,0.2)',
  idea:    'background:rgba(236,247,85,0.3)',
  note:    'background:rgba(180,140,90,0.15)',
  habit:   'background:rgba(22,163,74,0.15)',
  event:   'background:rgba(59,130,246,0.15)',
  finance: 'background:rgba(194,65,12,0.15)',
};
const CAT_TAG_STYLE = {
  task:    'background:rgba(47,208,249,0.2);color:#0a7a97',
  idea:    'background:rgba(245,240,168,0.5);color:#7a6c00',
  note:    'background:rgba(180,140,90,0.2);color:#6a4a1a',
  habit:   'background:rgba(22,163,74,0.15);color:#14532d',
  event:   'background:rgba(59,130,246,0.15);color:#1d4ed8',
  finance: 'background:rgba(194,65,12,0.15);color:#7c2d12',
};
const CAT_META = {
  idea:    { icon: '💡', label: 'Ідея',     dotClass: 'cat-dot-idea',    tagClass: 'cat-idea'    },
  task:    { icon: '📌', label: 'Задача',   dotClass: 'cat-dot-task',    tagClass: 'cat-task'    },
  habit:   { icon: '🌱', label: 'Звичка',   dotClass: 'cat-dot-habit',   tagClass: 'cat-habit'   },
  note:    { icon: '📝', label: 'Нотатка',  dotClass: 'cat-dot-note',    tagClass: 'cat-note'    },
  event:   { icon: '📅', label: 'Подія',    dotClass: 'cat-dot-event',   tagClass: 'cat-event'   },
  finance: { icon: '₴',  label: 'Фінанси',  dotClass: 'cat-dot-finance', tagClass: 'cat-finance' },
};

function getInbox() { return JSON.parse(localStorage.getItem('nm_inbox') || '[]'); }
function saveInbox(arr) { localStorage.setItem('nm_inbox', JSON.stringify(arr)); }


function renderInbox() {
  const items = getInbox();
  const list = document.getElementById('inbox-list');
  const countEl = document.getElementById('inbox-count');

  if (items.length === 0) {
    list.innerHTML = `<div class="inbox-empty">
      <div class="inbox-empty-icon">📥</div>
      <div class="inbox-empty-title">Inbox порожній</div>
      <div class="inbox-empty-sub">Напиши що завгодно — Агент розбереться</div>
    </div>`;
    countEl.style.display = 'none';
    return;
  }
  countEl.style.display = 'inline';
  countEl.textContent = items.length;

  list.innerHTML = items.map(item => {
    const meta = CAT_META[item.category] || CAT_META.note;
    const cardStyles = {
      task:    'background:linear-gradient(135deg,#c6f3fd,#a8ecfb);border-color:rgba(255,255,255,0.4)',
      habit:   'background:linear-gradient(135deg,#bbf7d0,#a7f3c0);border-color:rgba(255,255,255,0.4)',
      note:    'background:linear-gradient(135deg,#f5ede0,#ede0cc);border-color:rgba(255,255,255,0.4)',
      idea:    'background:linear-gradient(135deg,#f5f0a8,#eee97a);border-color:rgba(255,255,255,0.4)',
      event:   'background:linear-gradient(135deg,#bfdbfe,#a5c8fe);border-color:rgba(255,255,255,0.4)',
      finance: 'background:linear-gradient(135deg,#fcd9bd,#fbbf8a);border-color:rgba(255,255,255,0.4)',
    };
    const cardStyle = cardStyles[item.category] || cardStyles.note;
    return `<div class="inbox-item-wrap" id="wrap-${item.id}">
      <div class="inbox-item-delete-bg">🗑️</div>
      <div class="inbox-item" id="item-${item.id}" data-id="${item.id}" data-cat="${item.category}"
           style="${cardStyle}"
           ontouchstart="swipeStart(event,${item.id})"
           ontouchmove="swipeMove(event,${item.id})"
           ontouchend="swipeEnd(event,${item.id})">
        <div class="inbox-item-inner">
          <div class="inbox-item-cat-dot" style="${CAT_DOT_BG[item.category] || CAT_DOT_BG.note}">${CAT_SVG[item.category] || CAT_SVG.note}</div>
          <div class="inbox-item-body">
            <div class="inbox-item-text">${escapeHtml(item.text)}</div>
            <div class="inbox-item-meta">
              <span class="inbox-item-time">${formatTime(item.ts)}</span>
              <span class="inbox-item-tag" style="${CAT_TAG_STYLE[item.category] || CAT_TAG_STYLE.note}">${meta.label}</span>
            </div>
          </div>
        </div>
      </div>
    </div>`;
  }).join('');
}

// === SWIPE TO DELETE ===
const swipeState = {};

function swipeStart(e, id) {
  const t = e.touches[0];
  swipeState[id] = { startX: t.clientX, startY: t.clientY, dx: 0, swiping: false };
}
function swipeMove(e, id) {
  const s = swipeState[id]; if (!s) return;
  const t = e.touches[0];
  const dx = t.clientX - s.startX, dy = t.clientY - s.startY;
  if (!s.swiping && Math.abs(dy) > Math.abs(dx)) return;
  if (!s.swiping && Math.abs(dx) > 8) s.swiping = true;
  if (!s.swiping) return;
  e.preventDefault();
  s.dx = Math.min(0, dx);
  const el = document.getElementById(`item-${id}`);
  const wrap = document.getElementById(`wrap-${id}`);
  applySwipeTrail(el, wrap, s.dx);
}
function swipeEnd(e, id) {
  const s = swipeState[id]; if (!s) return;
  const el = document.getElementById(`item-${id}`);
  const wrap = document.getElementById(`wrap-${id}`);
  if (s.dx < -SWIPE_DELETE_THRESHOLD) {
    if (el) { el.style.transition = 'transform 0.2s ease, opacity 0.2s'; el.style.transform = 'translateX(-110%)'; el.style.opacity = '0'; }
    if (wrap) { wrap.style.transition = 'background 0.2s ease'; wrap.style.background = 'rgba(239,68,68,0.15)'; }
    setTimeout(() => {
      const allItems = getInbox();
      const originalIdx = allItems.findIndex(i => i.id === id);
      const item = allItems.find(i => i.id === id);
      if (item) addToTrash('inbox', item);
      saveInbox(allItems.filter(i => i.id !== id)); renderInbox();
      if (item) showUndoToast('Видалено з Inbox', () => { const items = getInbox(); const idx = Math.min(originalIdx, items.length); items.splice(idx, 0, item); saveInbox(items); renderInbox(); });
    }, 220);
  } else {
    clearSwipeTrail(el, wrap);
  }
  delete swipeState[id];
}

// === UNIFIED SEND TO AI ===
let aiLoading = false;
let inboxChatHistory = []; // зберігає останні 6 обмінів
let _lastUserMsgTs = 0; // timestamp останнього повідомлення юзера
const SEND_SVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>`;

function unifiedInputKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendToAI(); }
}

async function sendToAI() {
  if (aiLoading) return;
  const input = document.getElementById('inbox-input');
  const text = input.value.trim();
  if (!text) return;

  // Перехоплюємо відповідь якщо йде опитування
  addInboxChatMsg('user', text);
  input.value = ''; input.style.height = 'auto';
  input.focus();
  // Зберігаємо відповідь якщо OWL чекав відповідь по темі провідника
  try { saveGuideTopicAnswer(text); } catch(e) {}
  if (handleSurveyAnswer(text)) return;

  const key = localStorage.getItem('nm_gemini_key');

  // Немає ключа або file:// — зберігаємо офлайн миттєво
  if (!key || location.protocol === 'file:') {
    saveOffline(text);
    return;
  }

  aiLoading = true;

  const btn = document.getElementById('ai-send-btn');
  btn.disabled = true;
  btn.innerHTML = '<div class="ai-typing" style="transform:scale(0.65)"><span></span><span></span><span></span></div>';

  // Показуємо typing в чаті
  addInboxChatMsg('typing', '…');

  const aiContext = getAIContext();
  // Додаємо контекст паузи якщо >5 хвилин
  const gapMs = _lastUserMsgTs > 0 ? Date.now() - _lastUserMsgTs : 0;
  const gapContext = gapMs > 5 * 60 * 1000
    ? `\n\n[Увага: між попереднім і цим повідомленням пройшло ${Math.round(gapMs/60000)} хв — це може бути нова незалежна думка, не продовження попереднього. Але НЕ припускай автоматично — просто зберігай як окремий запис без уточнень якщо все зрозуміло.]`
    : '';
  const fullPrompt = aiContext ? `${INBOX_SYSTEM_PROMPT}${gapContext}\n\n${aiContext}` : `${INBOX_SYSTEM_PROMPT}${gapContext}`;
  // Build history for context — but keep it short so JSON format is not broken
  inboxChatHistory.push({ role: 'user', content: text });
  if (inboxChatHistory.length > 24) inboxChatHistory = inboxChatHistory.slice(-24);
  // Передаємо останні 12 повідомлень — достатньо для контексту розмови
  const historySlice = inboxChatHistory.slice(-12);
  const reply = await callAIWithHistory(fullPrompt, historySlice);

  if (reply) {
    try {
      const clean = reply.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(clean);

      // Save assistant reply to history for context
      inboxChatHistory.push({ role: 'assistant', content: reply });

      // Підтримка масиву дій — агент може повернути [{action:...}, {action:...}]
      const actions = Array.isArray(parsed) ? parsed : [parsed];

      for (const action of actions) {
        if (action.action === 'clarify') {
          showClarify(action, text);
          aiLoading = false;
          btn.disabled = false;
          btn.innerHTML = SEND_SVG;
          return;
        }
        if (action.action === 'save') {
          await processSaveAction(action, text);
        } else if (action.action === 'save_finance') {
          processFinanceAction(action, text);
        } else if (action.action === 'update_transaction') {
          const txs = getFinance();
          const idx = txs.findIndex(t => t.id === action.id);
          if (idx !== -1) {
            if (action.category) txs[idx].category = action.category;
            if (action.comment !== undefined) txs[idx].comment = action.comment;
            if (action.amount) txs[idx].amount = parseFloat(action.amount);
            saveFinance(txs);
            if (currentTab === 'finance') renderFinance();
            const updParts = [];
            if (action.category) updParts.push('категорія: ' + txs[idx].category);
            if (action.amount) updParts.push('сума: ' + formatMoney(txs[idx].amount));
            addInboxChatMsg('agent', '✓ Оновлено: ' + (updParts.join(', ') || txs[idx].category));
          } else {
            addInboxChatMsg('agent', 'Не знайшов транзакцію. Спробуй ще раз.');
          }
        } else if (action.action === 'complete_habit') {
          await processCompleteHabit(action, text);
        } else if (action.action === 'complete_task') {
          await processCompleteTask(action, text);
        } else if (action.action === 'add_step') {
          const tasks = getTasks();
          const idx = tasks.findIndex(t => t.id == action.task_id);
          if (idx !== -1) {
            const steps = Array.isArray(action.steps) ? action.steps : (action.step ? [action.step] : []);
            steps.forEach(s => tasks[idx].steps.push({ id: Date.now() + Math.random(), text: s, done: false }));
            saveTasks(tasks);
            renderTasks();
            addInboxChatMsg('agent', `✓ Додано ${steps.length} крок(и) до "${tasks[idx].title}"`);
          } else {
            addInboxChatMsg('agent', 'Не знайшов задачу. Спробуй через вкладку Продуктивність.');
          }
        } else if (action.action === 'restore_deleted') {
          const q = (action.query || '').trim();
          const typeFilter = action.type || null;
          const trash = getTrash().filter(t => Date.now() - t.deletedAt < 7 * 24 * 60 * 60 * 1000);
          const typeLabel = { task:'задачу', note:'нотатку', habit:'звичку', inbox:'запис', folder:'папку', finance:'транзакцію' };
          const typeIcon = { task:'📋', note:'📝', habit:'🌱', inbox:'📥', folder:'📁', finance:'💰' };

          // Фільтруємо по типу якщо вказано
          const filtered = typeFilter ? trash.filter(t => t.type === typeFilter) : trash;

          if (q === 'all') {
            // Відновити всі (або всі певного типу)
            if (filtered.length === 0) {
              addInboxChatMsg('agent', 'Кеш видалених порожній. Записи зберігаються 7 днів.');
            } else {
              filtered.forEach(t => restoreFromTrash(t.deletedAt));
              const label = typeFilter ? (typeLabel[typeFilter] + 'и/ки') : 'записів';
              addInboxChatMsg('agent', `✅ Відновив ${filtered.length} ${label}`);
            }
          } else if (q === 'last') {
            // Відновити останній видалений (або останній певного типу)
            const last = filtered.sort((a, b) => b.deletedAt - a.deletedAt)[0];
            if (!last) {
              addInboxChatMsg('agent', 'Нічого не знайшов в кеші видалених.');
            } else {
              const itemLabel = last.item.text || last.item.title || last.item.name || last.item.folder || 'запис';
              restoreFromTrash(last.deletedAt);
              addInboxChatMsg('agent', `✅ Відновив ${typeLabel[last.type] || 'запис'} "${itemLabel}"`);
            }
          } else {
            // Пошук по ключових словах
            const words = q.toLowerCase().split(/[\s,]+/).filter(Boolean);
            const results = filtered.filter(t => {
              const text = (t.item.text || t.item.title || t.item.name || t.item.folder || '').toLowerCase();
              return words.some(w => text.includes(w));
            }).sort((a, b) => b.deletedAt - a.deletedAt);

            if (results.length === 0) {
              addInboxChatMsg('agent', 'Не знайшов нічого схожого в кеші видалених. Записи зберігаються 7 днів.');
            } else if (results.length === 1) {
              const entry = results[0];
              const itemLabel = entry.item.text || entry.item.title || entry.item.name || entry.item.folder || 'запис';
              restoreFromTrash(entry.deletedAt);
              addInboxChatMsg('agent', `✅ Відновив ${typeLabel[entry.type] || 'запис'} "${itemLabel}"`);
            } else if (results.length <= 5) {
              // Кілька — відновлюємо всі що підходять
              results.forEach(t => restoreFromTrash(t.deletedAt));
              const labels = results.map(e => `${typeIcon[e.type] || '•'} ${(e.item.text || e.item.title || e.item.name || '').substring(0, 35)}`).join('\n');
              addInboxChatMsg('agent', `✅ Відновив ${results.length} записи:\n${labels}`);
            } else {
              // Забагато результатів — показуємо і просимо уточнити
              const list = results.slice(0, 5).map(e => {
                const lbl = (e.item.text || e.item.title || e.item.name || e.item.folder || 'запис').substring(0, 40);
                const ago = Math.round((Date.now() - e.deletedAt) / 86400000);
                return `${typeIcon[e.type] || '•'} ${lbl} (${ago === 0 ? 'сьогодні' : ago + ' дн. тому'})`;
              }).join('\n');
              addInboxChatMsg('agent', `Знайшов ${results.length} схожих. Ось перші 5:\n${list}\n\nУточни який саме, або скажи "відновити всі".`);
            }
          }
        } else if (processUniversalAction(action, text, addInboxChatMsg)) {
          // delete_folder, move_note, create_task, create_note тощо
        } else {
          // action === 'reply' — просто відповідь
          const replyText = action.comment || reply;
          addInboxChatMsg('agent', replyText);
        }
      }
    } catch(e) {
      console.error('JSON parse error:', e);
      // Спробуємо витягти clarify з часткового JSON
      try {
        const jsonMatch = (reply||'').match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const p2 = JSON.parse(jsonMatch[0]);
          if (p2.action === 'clarify') {
            showClarify(p2, text);
            aiLoading = false; btn.disabled = false; btn.innerHTML = SEND_SVG;
            return;
          }
        }
      } catch(e2) {}
      saveOffline(text);
      addInboxChatMsg('agent', '✓ Збережено');
    }
  } else {
    saveOffline(text);
    addInboxChatMsg('agent', '📝 Збережено в Inbox. Інтернет недоступний — Агент не визначив категорію. Надішли ще раз коли буде мережа.');
  }

  aiLoading = false;
  btn.disabled = false;
  btn.innerHTML = SEND_SVG;
  // Органічне питання провідника (25% шанс, не частіше 3 хв)
  try { maybeAskGuideQuestion(); } catch(e) {}
}

// === CLARIFY SYSTEM ===
let clarifyParsed = null;
let clarifyOriginalText = null;

function showClarify(parsed, originalText) {
  clarifyParsed = parsed;
  clarifyOriginalText = originalText;

  document.getElementById('clarify-question').textContent = parsed.question || 'Уточни будь ласка:';
  document.getElementById('clarify-input').value = '';

  const optEl = document.getElementById('clarify-options');
  optEl.innerHTML = (parsed.options || []).map((opt, i) => {
    const isPrimary = i === 0;
    return `<button onclick="selectClarifyOption(${i})" style="width:100%;display:flex;align-items:center;gap:10px;background:${isPrimary ? 'rgba(124,58,237,0.05)' : 'rgba(30,16,64,0.03)'};border:1.5px solid ${isPrimary ? 'rgba(124,58,237,0.2)' : 'rgba(30,16,64,0.08)'};border-radius:13px;padding:12px 14px;font-size:14px;font-weight:600;color:${isPrimary ? '#7c3aed' : '#1e1040'};cursor:pointer;text-align:left;font-family:inherit">${escapeHtml(opt.label || '')}</button>`;
  }).join('');

  document.getElementById('clarify-modal').style.display = 'flex';
}

function closeClarify() {
  document.getElementById('clarify-modal').style.display = 'none';
  clarifyParsed = null;
  clarifyOriginalText = null;
}

async function selectClarifyOption(idx) {
  if (!clarifyParsed) return;
  const opt = (clarifyParsed.options || [])[idx];
  if (!opt) return;
  const origText = clarifyOriginalText;
  closeClarify();
  if (opt.action === 'save') await processSaveAction(opt, origText);
  else if (opt.action === 'complete_habit') await processCompleteHabit(opt, origText);
  else if (opt.action === 'complete_task') await processCompleteTask(opt, origText);
}

async function sendClarifyText() {
  const input = document.getElementById('clarify-input');
  const text = input.value.trim();
  if (!text) return;
  closeClarify();
  // Відправляємо уточнення назад в ШІ разом з оригінальним текстом
  const key = localStorage.getItem('nm_gemini_key');
  if (!key) return;
  const fullPrompt = getAIContext() ? `${INBOX_SYSTEM_PROMPT}\n\n${getAIContext()}` : INBOX_SYSTEM_PROMPT;
  const combinedMsg = `Оригінальний запис: "${clarifyOriginalText}". Уточнення від користувача: "${text}"`;
  clarifyOriginalText = null;
  clarifyParsed = null;
  const reply = await callAI(fullPrompt, combinedMsg, {});
  if (reply) {
    try {
      const parsed = JSON.parse(reply.replace(/\`\`\`json|\`\`\`/g, '').trim());
      if (parsed.action === 'save') await processSaveAction(parsed, combinedMsg);
      else if (parsed.action === 'complete_habit') processCompleteHabit(parsed, combinedMsg);
      else if (parsed.action === 'complete_task') processCompleteTask(parsed, combinedMsg);
      else if (parsed.action === 'reply') addInboxChatMsg('agent', parsed.comment || reply);
    } catch(e) {}
  }
}

// Виносимо логіку збереження в окрему функцію щоб використовувати і з clarify і з sendToAI
async function processSaveAction(parsed, originalText) {
  const catMap = {'нотатка':'note','задача':'task','звичка':'habit','ідея':'idea','подія':'event'};
  const rawCat = (parsed.category || '').toLowerCase();
  const cat = ['idea','task','habit','note','event'].includes(rawCat) ? rawCat : (catMap[rawCat] || 'note');
  const savedText = parsed.text || originalText;
  const folder = parsed.folder || null;
  const items = getInbox();
  items.unshift({ id: Date.now(), text: savedText, category: cat, ts: Date.now(), processed: true });
  saveInbox(items);
  renderInbox();

  if (cat === 'task') {
    const taskId = Date.now();
    const tasks = getTasks();
    const taskTitle = parsed.task_title || savedText;
    const taskSteps = Array.isArray(parsed.task_steps) && parsed.task_steps.length > 0
      ? parsed.task_steps.map(s => ({ id: Date.now() + Math.random(), text: s, done: false }))
      : [];
    tasks.unshift({ id: taskId, title: taskTitle, desc: savedText !== taskTitle ? savedText : '', steps: taskSteps, status: 'active', createdAt: taskId });
    saveTasks(tasks);
    if (taskSteps.length === 0) autoGenerateTaskSteps(taskId, taskTitle);
  }
  if (cat === 'note' || cat === 'idea') addNoteFromInbox(savedText, cat, folder);
  if (cat === 'habit') {
    const habits = getHabits();
    const exists = habits.some(h => h.name.toLowerCase() === savedText.toLowerCase());
    if (!exists) {
      const txt = savedText.toLowerCase();
      let days;

      // Якщо агент передав days масив — використовуємо його
      if (Array.isArray(parsed.days) && parsed.days.length > 0) {
        days = parsed.days.filter(d => d >= 0 && d <= 6);
      } else {
        // Парсимо з тексту
        days = [0,1,2,3,4,5,6];
        const hasEveryDay = /щодня|кожного дня|кожен день/i.test(txt);
        const hasWeekdays = /будн|пн.*ср.*пт/i.test(txt);
        const hasWeekend = /вихідн|субот.*неділ|сб.*нд/i.test(txt);
        const hasWeekday = /понеділ|вівтор|серед|четвер|п.ятниц|субот|неділ|^пн\b|^вт\b|^ср\b|^чт\b|^пт\b|^сб\b|^нд\b/i.test(txt);
        if (hasEveryDay) { days = [0,1,2,3,4,5,6]; }
        else if (hasWeekdays) { days = [0,1,2,3,4]; }
        else if (hasWeekend) { days = [5,6]; }
        else if (hasWeekday) {
          days = [];
          if (/понеділ|\bпн\b/i.test(txt)) days.push(0);
          if (/вівтор|\bвт\b/i.test(txt)) days.push(1);
          if (/серед|\bср\b/i.test(txt)) days.push(2);
          if (/четвер|\bчт\b/i.test(txt)) days.push(3);
          if (/п.ятниц|\bпт\b/i.test(txt)) days.push(4);
          if (/субот|\bсб\b/i.test(txt)) days.push(5);
          if (/неділ|\bнд\b/i.test(txt)) days.push(6);
          if (days.length === 0) days = [0,1,2,3,4,5,6];
        }
      }

      const habitParts = savedText.split(/[,.]\s*/);
      const habitName = habitParts[0].trim().split(' ').slice(0,5).join(' ');
      const habitDetails = savedText.length > habitName.length + 2 ? savedText.substring(habitName.length).replace(/^[,.\s]+/,'').trim() : '';

      // Витягуємо кількість разів — з parsed або з тексту
      let targetCount = parseInt(parsed.targetCount) || 1;
      if (targetCount === 1) {
        const countMatch = txt.match(/(\d+)\s*(рази?|раз|разів|склянок|склянки|стакан|кроків|хвилин|разу)/i);
        if (countMatch) targetCount = Math.min(20, Math.max(2, parseInt(countMatch[1])));
      }

      habits.push({ id: Date.now(), name: habitName, details: habitDetails, emoji: '⭕', days, targetCount, createdAt: Date.now() });
      saveHabits(habits);
    }
  }
  if (cat === 'event') {
    const mood = /добре|чудово|супер|відмінно|весело|щасли/i.test(savedText) ? 'positive' :
                 /погано|жахливо|сумно|нудно|важко|втомив/i.test(savedText) ? 'negative' : 'neutral';
    const moments = getMoments();
    const newMoment = { id: Date.now(), text: savedText, mood, ts: Date.now() };
    moments.push(newMoment);
    saveMoments(moments);
    generateMomentSummary(newMoment.id, savedText);
  }
  const catConfirm2 = {
    task: '✅ Задачу створено',
    habit: '🌱 Звичку створено',
    note: '📝 Нотатку збережено',
    idea: '💡 Ідею збережено',
    event: '📅 Подію додано'
  };
  const confirmMsg2 = parsed.comment
    ? `${parsed.comment} ${catConfirm2[cat] ? '/ ' + catConfirm2[cat] : ''}`
    : (catConfirm2[cat] || '✓ Збережено');
  addInboxChatMsg('agent', confirmMsg2);

  // Якщо є уточнення після збереження — показуємо через паузу
  if (parsed.ask_after) {
    setTimeout(() => addInboxChatMsg('agent', parsed.ask_after), 600);
  }
}


// === COMPLETE HABIT FROM INBOX ===
function processCompleteHabit(parsed, originalText) {
  // Підтримуємо і старий формат (habit_id) і новий (habit_ids масив)
  const ids = parsed.habit_ids || (parsed.habit_id ? [parsed.habit_id] : []);
  if (ids.length === 0) {
    addInboxChatMsg('agent', 'Не зрозумів яку звичку відмітити.');
    return;
  }
  const habits = getHabits();
  const today = new Date().toDateString();
  const log = getHabitLog();
  if (!log[today]) log[today] = {};
  const completed = [];
  ids.forEach(habitId => {
    const habit = habits.find(h => h.id == habitId);
    if (habit) {
      log[today][habit.id] = true;
      completed.push(habit.name);
    }
  });
  if (completed.length === 0) {
    addInboxChatMsg('agent', 'Не знайшов такі звички.');
    return;
  }
  saveHabitLog(log);
  renderProdHabits();
  renderHabits();
  // Зберігаємо в Inbox для історії
  const items = getInbox();
  items.unshift({ id: Date.now(), text: originalText, category: 'habit', ts: Date.now(), processed: true });
  saveInbox(items);
  renderInbox();
  const msg = parsed.comment || (completed.length === 1
    ? `✅ Відмітив звичку "${completed[0]}" як виконану`
    : `✅ Відмітив ${completed.length} звички: ${completed.join(', ')}`);
  addInboxChatMsg('agent', msg);
}

// === COMPLETE TASK FROM INBOX ===
function processCompleteTask(parsed, originalText) {
  // Підтримуємо і старий формат (task_id) і новий (task_ids масив)
  const ids = parsed.task_ids || (parsed.task_id ? [parsed.task_id] : []);
  if (ids.length === 0) {
    addInboxChatMsg('agent', 'Не зрозумів яку задачу закрити.');
    return;
  }
  const tasks = getTasks();
  const completed = [];
  ids.forEach(taskId => {
    const idx = tasks.findIndex(t => t.id == taskId);
    if (idx !== -1) {
      completed.push(tasks[idx].title);
      tasks[idx] = { ...tasks[idx], status: 'done', completedAt: Date.now() };
    }
  });
  if (completed.length === 0) {
    addInboxChatMsg('agent', 'Не знайшов такі задачі.');
    return;
  }
  saveTasks(tasks);
  renderTasks();
  // Зберігаємо в Inbox для історії
  const items = getInbox();
  items.unshift({ id: Date.now(), text: originalText, category: 'task', ts: Date.now(), processed: true });
  saveInbox(items);
  renderInbox();
  const msg = parsed.comment || (completed.length === 1
    ? `✅ Задачу "${completed[0]}" закрито`
    : `✅ Закрив ${completed.length} задачі: ${completed.join(', ')}`);
  addInboxChatMsg('agent', msg);
}



let activeChatBar = null;

function getTabbarHeight() {
  const tb = document.getElementById('tab-bar');
  return tb ? tb.offsetHeight : 83;
}

