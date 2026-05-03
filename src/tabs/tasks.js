// ============================================================
// app-tasks-core.js — Задачі, task chat, task AI bar
// Залежності: app-core.js, app-ai.js
// ============================================================

import { showToast } from '../core/nav.js';
import { escapeHtml, logRecentAction, extractJsonBlocks, parseContentChips, t } from '../core/utils.js';
import { logUsage } from '../core/usage-meter.js';
import { generateUUID } from '../core/uuid.js';
import { addToTrash, showUndoToast } from '../core/trash.js';
import { callAI, getAIContext, getOWLPersonality, openChatBar, saveChatMsg, handleChatError } from '../ai/core.js';
import { renderChips } from '../owl/chips.js';
import { attachSwipeDelete } from '../ui/swipe-delete.js';
import { updateProdTabCounters, processUniversalAction } from './habits.js';
import { closeNoteView } from './notes.js';

// === TASKS ===
let editingTaskId = null;
let tempSteps = [];

export function getTasks() { return JSON.parse(localStorage.getItem('nm_tasks') || '[]'); }
export function saveTasks(arr) { localStorage.setItem('nm_tasks', JSON.stringify(arr)); window.dispatchEvent(new CustomEvent('nm-data-changed', { detail: 'tasks' })); }


export function openAddTask() {
  editingTaskId = null;
  tempSteps = [];
  document.getElementById('task-modal-title').textContent = t('tasks.modal_new', 'Нова задача');
  document.getElementById('task-input-title').value = '';
  document.getElementById('task-input-desc').value = '';
  document.getElementById('task-step-input').value = '';
  const delBtn = document.getElementById('task-delete-btn');
  if (delBtn) delBtn.style.display = 'none';
  renderTempSteps();
  document.getElementById('task-modal').style.display = 'flex';
  setupModalSwipeClose(document.querySelector('#task-modal > div:last-child'), closeTaskModal);
  setTimeout(() => { const el = document.getElementById('task-input-title'); el.removeAttribute('readonly'); el.focus(); }, 350);
}

function openEditTask(id) {
  const tasks = getTasks();
  const t = tasks.find(x => String(x.id) === String(id));
  if (!t) return;
  editingTaskId = id;
  tempSteps = [...(t.steps || [])];
  document.getElementById('task-modal-title').textContent = t('tasks.modal_edit', 'Редагувати задачу');
  document.getElementById('task-input-title').value = t.title;
  document.getElementById('task-input-desc').value = t.desc || '';
  document.getElementById('task-step-input').value = '';
  const delBtn = document.getElementById('task-delete-btn');
  if (delBtn) delBtn.style.display = 'inline-block';
  renderTempSteps();
  document.getElementById('task-modal').style.display = 'flex';
  setupModalSwipeClose(document.querySelector('#task-modal > div:last-child'), closeTaskModal);
}

// === SWIPE DOWN TO CLOSE MODALS ===
// UvEHE 03.05: touch listeners на parentElement (root модалки) — щоб свайп
// вниз ПО ФОНУ теж закривав модалку, не лише по самій картці. Transform
// застосовуємо до contentEl (картка). Працює тому що картка — єдина
// дитина root після винесення overlay як top-level sibling (Phase 1-4).
export function setupModalSwipeClose(contentEl, closeFn) {
  if (!contentEl || contentEl._swipeClose) return;
  contentEl._swipeClose = true;
  const swipeRoot = contentEl.parentElement || contentEl;
  let startY = 0, startX = 0, dy = 0, _swipeBlocked = false;
  swipeRoot.addEventListener('touchstart', e => {
    // Не перехоплювати свайп на скролюваних/інтерактивних елементах:
    // барабан, чат, прокрутка Налаштувань, input/textarea/select (UvEHE 03.05 sweep —
    // inconsistent з modal-overlay-sync.js _setupSwipeClose; dragging textarea модалки
    // переривав edit замість редагування).
    _swipeBlocked = !!e.target.closest('.drum-col, .drum-item, .settings-scroll, input, textarea, select');
    startY = e.touches[0].clientY;
    startX = e.touches[0].clientX;
    dy = 0;
    if (!_swipeBlocked) contentEl.style.transition = 'none';
  }, { passive: true });
  swipeRoot.addEventListener('touchmove', e => {
    if (_swipeBlocked) return;
    dy = e.touches[0].clientY - startY;
    const dx = Math.abs(e.touches[0].clientX - startX);
    if (dy > 0 && dy > dx) {
      contentEl.style.transform = `translateY(${dy}px)`;
    }
  }, { passive: true });
  swipeRoot.addEventListener('touchend', () => {
    if (_swipeBlocked) { _swipeBlocked = false; return; }
    contentEl.style.transition = 'transform 0.25s ease';
    if (dy > 80) {
      contentEl.style.transform = 'translateY(100%)';
      setTimeout(() => { contentEl.style.transform = ''; closeFn(); }, 250);
    } else {
      contentEl.style.transform = '';
    }
    dy = 0;
  }, { passive: true });
}

function closeTaskModal() {
  document.getElementById('task-modal').style.display = 'none';
}

function deleteTaskFromModal() {
  if (!editingTaskId) return;
  const tasks = getTasks();
  const taskOrigIdx = tasks.findIndex(x => x.id === editingTaskId);
  const item = tasks.find(x => x.id === editingTaskId);
  if (item) addToTrash('task', item);
  saveTasks(tasks.filter(x => x.id !== editingTaskId));
  closeTaskModal();
  renderTasks();
  if (item) showUndoToast(t('tasks.deleted', 'Задачу видалено'), () => { const t = getTasks(); const idx = Math.min(taskOrigIdx, t.length); t.splice(idx, 0, item); saveTasks(t); renderTasks(); });
}

function addTaskStep() {
  const inp = document.getElementById('task-step-input');
  const val = inp.value.trim();
  if (!val) return;
  tempSteps.push({ id: Date.now(), text: val, done: false });
  inp.value = '';
  renderTempSteps();
  inp.focus();
}

function toggleTempStep(id) {
  const s = tempSteps.find(x => x.id === id);
  if (s) s.done = !s.done;
  renderTempSteps();
}

function removeTempStep(id) {
  tempSteps = tempSteps.filter(x => x.id !== id);
  renderTempSteps();
}

function renderTempSteps() {
  const el = document.getElementById('task-steps-list');
  if (tempSteps.length === 0) { el.innerHTML = ''; return; }
  el.innerHTML = tempSteps.map(s => `
    <div style="display:flex;align-items:center;gap:8px;background:rgba(255,255,255,0.7);border:1.5px solid rgba(30,16,64,0.12);border-radius:10px;padding:8px 10px">
      <div onclick="toggleTempStep(${s.id})" style="width:18px;height:18px;border-radius:5px;border:1.5px solid ${s.done ? '#ea580c' : 'rgba(30,16,64,0.2)'};background:rgba(255,255,255,0.6);display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;font-size:12px;color:#ea580c">${s.done ? '✓' : ''}</div>
      <div style="flex:1;font-size:15px;color:#1e1040;${s.done ? 'text-decoration:line-through;opacity:0.4' : ''}">${escapeHtml(s.text)}</div>
      <div onclick="removeTempStep(${s.id})" style="font-size:18px;color:rgba(30,16,64,0.25);cursor:pointer;padding:0 2px">×</div>
    </div>
  `).join('');
}

function saveTask() {
  const title = document.getElementById('task-input-title').value.trim();
  if (!title) { showToast(t('tasks.title_required', 'Введіть назву задачі')); return; }
  const desc = document.getElementById('task-input-desc').value.trim();
  const tasks = getTasks();

  if (editingTaskId) {
    const idx = tasks.findIndex(x => x.id === editingTaskId);
    if (idx !== -1) {
      tasks[idx] = { ...tasks[idx], title, desc, steps: tempSteps, updatedAt: Date.now() };
    }
  } else {
    tasks.unshift({ id: generateUUID(), title, desc, steps: tempSteps, status: 'active', createdAt: Date.now() });
  }

  saveTasks(tasks);
  closeTaskModal();
  renderTasks();
}

function toggleTaskStep(taskId, stepId) {
  const tasks = getTasks();
  const t = tasks.find(x => String(x.id) === String(taskId));
  if (!t) return;
  const s = (t.steps || []).find(x => String(x.id) === String(stepId));
  if (s) s.done = !s.done;

  // Перевіряємо чи всі кроки виконані
  const allDone = t.steps.length > 0 && t.steps.every(x => x.done);
  const wasDone = t.status === 'done';
  const now = Date.now();
  if (allDone && !wasDone) { t.status = 'done'; t.completedAt = now; t.updatedAt = now; }
  else if (!allDone && wasDone) { t.status = 'active'; delete t.completedAt; t.updatedAt = now; }

  saveTasks(tasks);
  renderTasks();
}

function deleteTask(id) {
  const tasks = getTasks();
  const taskOrigIdx = tasks.findIndex(x => x.id === id);
  const item = tasks.find(x => x.id === id);
  if (item) addToTrash('task', item);
  saveTasks(tasks.filter(x => x.id !== id));
  renderTasks();
  if (item) showUndoToast(t('tasks.deleted', 'Задачу видалено'), () => { const t = getTasks(); const idx = Math.min(taskOrigIdx, t.length); t.splice(idx, 0, item); saveTasks(t); renderTasks(); });
}

export function toggleTaskStatus(id) {
  const tasks = getTasks();
  const t = tasks.find(x => String(x.id) === String(id));
  if (!t) return;
  const isCompleting = t.status !== 'done';
  const now = Date.now();

  if (isCompleting) {
    // R5Ejr 24.04: 3-фазна анімація — миттєва галочка → 250мс пауза → сповзання → renderTasks
    const wrap = document.getElementById('task-wrap-' + id);
    const card = document.getElementById('task-item-' + id);
    if (card) {
      const check = card.querySelector('[data-task-check] > div');
      const title = card.querySelector('[style*="font-weight:700"]');
      if (check) { check.style.background = '#16a34a'; check.style.borderColor = '#16a34a'; check.textContent = '✓'; }
      if (title) { title.style.textDecoration = 'line-through'; title.style.opacity = '0.5'; }
    }
    if (wrap) {
      // Фіксуємо висоту щоб max-height transition знав з чого падати до 0
      wrap.style.maxHeight = wrap.offsetHeight + 'px';
      setTimeout(() => { wrap.classList.add('task-completing'); }, 250);
    }
    setTimeout(() => {
      t.status = 'done';
      t.completedAt = now;
      t.updatedAt = now;
      saveTasks(tasks);
      logRecentAction('complete_task', t.title, 'tasks');
      renderTasks();
    }, 620);
    return;
  }

  // Reopen — без анімації
  t.status = 'active';
  delete t.completedAt;
  t.updatedAt = now;
  saveTasks(tasks);
  logRecentAction('reopen_task', t.title, 'tasks');
  renderTasks();
}

export function renderTasks() {
  const tasks = getTasks();
  const list = document.getElementById('tasks-list');
  const empty = document.getElementById('tasks-empty');

  if (tasks.length === 0) {
    list.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  const active = tasks.filter(t => t.status !== 'done');
  // R5Ejr 24.04: виконані — найсвіжіше закриті ЗВЕРХУ (сортування за completedAt ↓)
  const done = tasks.filter(t => t.status === 'done')
    .sort((a, b) => (b.completedAt || b.updatedAt || 0) - (a.completedAt || a.updatedAt || 0));
  const sorted = [...active, ...done];

  updateProdTabCounters();
  list.innerHTML = sorted.map(t => {
    const steps = t.steps || [];
    const doneCount = steps.filter(s => s.done).length;
    const pct = steps.length > 0 ? Math.round(doneCount / steps.length * 100) : (t.status === 'done' ? 100 : 0);
    const isDone = t.status === 'done';

    return `<div class="task-item-wrap" id="task-wrap-${t.id}" style="position:relative;margin:0 14px var(--card-gap);border-radius:16px">
      <div id="task-item-${t.id}" onclick="taskCardClick('${t.id}', event)"
        style="background:linear-gradient(135deg,#c6f3fd,#a8ecfb);border:1.5px solid rgba(255,255,255,0.4);border-radius:16px;padding:var(--card-pad-y) var(--card-pad-x);box-shadow:0 2px 12px rgba(0,0,0,0.04);opacity:${isDone ? '0.5' : '1'};cursor:pointer;-webkit-tap-highlight-color:transparent;position:relative;z-index:1;touch-action:pan-y">
      <div style="display:flex;align-items:flex-start;gap:6px;margin-bottom:${steps.length ? '8px' : '0'}">
        <div data-task-check="1" ontouchend="event.preventDefault();event.stopPropagation();toggleTaskStatus('${t.id}')" style="padding:8px;margin:-8px -4px -8px -8px;display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;-webkit-tap-highlight-color:transparent">
          <div style="width:28px;height:28px;border-radius:8px;border:2px solid ${isDone ? '#16a34a' : 'rgba(234,88,12,0.3)'};background:${isDone ? '#16a34a' : 'rgba(255,255,255,0.78)'};display:flex;align-items:center;justify-content:center;font-size:15px;color:white;transition:all 0.2s">${isDone ? '✓' : ''}</div>
        </div>
        <div style="flex:1">
          <div style="font-size:16px;font-weight:700;color:#1e1040;${isDone ? 'text-decoration:line-through;opacity:0.5' : ''};line-height:1.4">${escapeHtml(t.title)}</div>
          ${t.desc ? `<div style="font-size:14px;color:rgba(30,16,64,0.45);margin-top:2px">${escapeHtml(t.desc)}</div>` : ''}
        </div>
      </div>
      ${steps.length > 0 ? `
        <div style="height:3px;background:rgba(0,0,0,0.06);border-radius:3px;overflow:hidden;margin-bottom:8px">
          <div style="height:100%;width:${pct}%;background:linear-gradient(90deg,#f97316,#ea580c);border-radius:3px;transition:width 0.3s"></div>
        </div>
        <div style="display:flex;flex-direction:column;gap:5px;margin-bottom:10px">
          ${steps.map(s => `
            <div data-step-check="1" ontouchstart="this._sx=event.touches[0].clientX;this._sy=event.touches[0].clientY" ontouchend="if(Math.abs(event.changedTouches[0].clientX-(this._sx||0))<10&&Math.abs(event.changedTouches[0].clientY-(this._sy||0))<10){event.preventDefault();toggleTaskStep('${t.id}',${s.id})}" style="display:flex;align-items:center;gap:10px;cursor:pointer;padding:4px 0">
              <div style="width:24px;height:24px;border-radius:7px;border:1.5px solid ${s.done ? '#ea580c' : 'rgba(30,16,64,0.18)'};background:rgba(255,255,255,0.6);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:13px;color:#ea580c">${s.done ? '✓' : ''}</div>
              <div style="flex:1;font-size:14px;color:rgba(30,16,64,0.65);${s.done ? 'text-decoration:line-through;opacity:0.4' : ''}">${escapeHtml(s.text)}</div>
            </div>
          `).join('')}
        </div>
      ` : ''}
    </div></div>`;
  }).join('');
  // Підключаємо B-54 свайп-видалення (винесено у спільну утиліту 18.04 14zLe)
  document.querySelectorAll('#tasks-list .task-item-wrap').forEach(wrap => {
    const card = wrap.querySelector('[id^="task-item-"]');
    if (!card) return;
    const id = card.id.replace('task-item-', '');
    attachSwipeDelete(wrap, card, () => {
      const tasks = getTasks();
      const taskOrigIdx = tasks.findIndex(x => String(x.id) === id);
      const item = tasks.find(x => String(x.id) === id);
      if (item) addToTrash('task', item);
      saveTasks(tasks.filter(x => String(x.id) !== id));
      renderTasks();
      if (item) showUndoToast(t('tasks.deleted', 'Задачу видалено'), () => {
        const t = getTasks();
        const idx = Math.min(taskOrigIdx, t.length);
        t.splice(idx, 0, item);
        saveTasks(t);
        renderTasks();
      });
    });
  });
}

// Тап на картку задачі — відкрити редагування. Чекбокс задачі і кроки
// мають свої handlers через data-* атрибути — не відкривають edit.
function taskCardClick(id, event) {
  if (event.target.closest('[data-task-check],[data-step-check]')) return;
  openEditTask(id);
}

// Відкриваємо задачі при переключенні вкладки — через хук в renderTasks


// === TASK CHAT ===
let taskChatId = null;
let taskChatHistory = [];
let taskChatLoading = false;

function openTaskChat(id) {
  const tasks = getTasks();
  const t = tasks.find(x => x.id === id);
  if (!t) return;
  taskChatId = id;

  document.getElementById('task-chat-title').textContent = t.title;
  document.getElementById('task-chat-messages').innerHTML = '';
  document.getElementById('task-chat-input').value = '';
  document.getElementById('task-chat-modal').style.display = 'flex';

  // Restore saved chat history
  const savedChat = JSON.parse(localStorage.getItem('nm_task_chat_' + id) || 'null');
  if (savedChat && savedChat.messages && savedChat.messages.length > 0) {
    taskChatHistory = savedChat.history || [];
    savedChat.messages.forEach(m => addTaskChatMsg(m.role, m.text));
    return;
  }

  taskChatHistory = [];
  const steps = (t.steps || []).map(s => `- ${s.text}${s.done ? ' ✓' : ''}`).join('\n');
  const key = localStorage.getItem('nm_gemini_key');
  if (!key) {
    addTaskChatMsg('agent', t('tasks.no_api_key_chat', 'Введи OpenAI ключ в налаштуваннях щоб спілкуватись з Агентом.'));
    return;
  }

  addTaskChatMsg('agent', '…', 'task-chat-intro');
  const aiContext = getAIContext();
  const systemPrompt = `${getOWLPersonality()} Допомагаєш реально виконати задачу. НЕ хвали задачу і не кажи що вона "чудова" чи "чітка" — це лестощі. Перше повідомлення: оціни задачу чесно (1 речення) — чи вона конкретна, чи є дедлайн, чи є підводні камені. Потім запитай один конкретний уточнюючий факт або що вже зроблено. Максимум 3 речення. Відповідай українською.${aiContext ? '\n\n' + aiContext : ''}`;
  const taskInfo = `Задача: ${t.title}${t.desc ? '\nОпис: ' + t.desc : ''}${steps ? '\nКроки:\n' + steps : ''}`;

  callAI(systemPrompt, taskInfo, {}, 'tasks-background').then(reply => {
    const el = document.getElementById('task-chat-intro');
    if (el) el.textContent = reply || t('tasks.tell_more', 'Розкажи більше про цю задачу.');
    taskChatHistory.push({ role: 'assistant', content: reply || '' });
    saveTaskChatHistory();
  });
}

function saveTaskChatHistory() {
  if (!taskChatId) return;
  const messages = Array.from(document.getElementById('task-chat-messages').children).map(div => {
    const bubble = div.querySelector('div');
    const isAgent = div.style.justifyContent !== 'flex-end';
    return { role: isAgent ? 'agent' : 'user', text: bubble ? bubble.textContent : '' };
  }).filter(m => m.text && m.text !== '…');
  localStorage.setItem('nm_task_chat_' + taskChatId, JSON.stringify({ messages, history: taskChatHistory }));
}

function closeTaskChat() {
  saveTaskChatHistory();
  document.getElementById('task-chat-modal').style.display = 'none';
  taskChatId = null;
  taskChatHistory = [];
}

function addTaskChatMsg(role, text, id = '', chips = null) {
  const el = document.getElementById('task-chat-messages');
  const isAgent = role === 'agent';
  if (isAgent) el.querySelectorAll('.chat-chips-row').forEach(n => n.remove());
  const div = document.createElement('div');
  div.style.cssText = `display:flex;${isAgent ? '' : 'justify-content:flex-end'}`;
  div.innerHTML = `<div ${id ? `id="${id}"` : ''} style="max-width:82%;background:${isAgent ? 'rgba(255,255,255,0.9)' : '#ea580c'};color:${isAgent ? '#1e1040' : 'white'};border-radius:${isAgent ? '4px 14px 14px 14px' : '14px 4px 14px 14px'};padding:12px 16px;font-size:18px;line-height:1.7;font-weight:${isAgent ? '400' : '500'}">${escapeHtml(text)}</div>`;
  el.appendChild(div);
  if (isAgent && Array.isArray(chips) && chips.length > 0) {
    const chipsRow = document.createElement('div');
    chipsRow.className = 'chat-chips-row';
    renderChips(chipsRow, chips, 'tasks');
    el.appendChild(chipsRow);
  }
  el.scrollTop = el.scrollHeight;
  if (role !== 'agent') taskChatHistory.push({ role: 'user', content: text });
}

async function sendTaskChatMessage() {
  if (taskChatLoading) return;
  const input = document.getElementById('task-chat-input');
  const text = input.value.trim();
  if (!text) return;
  const key = localStorage.getItem('nm_gemini_key');
  if (!key) { addTaskChatMsg('agent', t('common.no_api_key', 'Введи OpenAI ключ в налаштуваннях.')); return; }

  input.value = '';
  input.style.height = 'auto';
  addTaskChatMsg('user', text);
  taskChatLoading = true;

  const btn = document.getElementById('task-chat-send');
  btn.disabled = true;

  const tasks = getTasks();
  const t = tasks.find(x => x.id === taskChatId);
  const steps = t ? (t.steps || []).map(s => `- ${s.text}${s.done ? ' ✓' : ''}`).join('\n') : '';
  const aiContext = getAIContext();
  const wantsSteps = /додай кроки|створи кроки|розбий на кроки|які кроки|план дій|крок за кроком|додай пункти|пункти|кроки/i.test(text);
  const stepInstruction = wantsSteps ? ' ВАЖЛИВО: користувач просить кроки. Відповідай ТІЛЬКИ валідним JSON і нічим іншим: {"steps":["крок 1","крок 2","крок 3"]}. Жодного тексту до або після JSON.' : '';
  const systemPrompt = `${getOWLPersonality()} Обговорюєш задачу: "${t?.title || ''}". ${t?.desc ? 'Опис: ' + t.desc + '.' : ''} ${steps ? 'Кроки:\n' + steps : ''} Говориш конкретно. Короткі відповіді (2-4 речення). Фокус на наступних конкретних кроках.${stepInstruction}
Якщо юзер просить кроки — {"steps":["крок 1","крок 2"]}
Якщо юзер просить щось НЕ про цю задачу (нова задача, подія, нотатка, звичка, витрата) — відповідай відповідним JSON:
- Задача: {"action":"create_task","title":"назва","steps":[]}
- Звичка: {"action":"create_habit","name":"назва","days":[0,1,2,3,4,5,6]}
- Редагувати звичку: {"action":"edit_habit","habit_id":ID,"name":"нова назва","days":[0,1,2,3,4,5,6]}
- Закрити задачу: {"action":"complete_task","task_id":ID}
- Відмітити звичку: {"action":"complete_habit","habit_name":"назва"}
- Редагувати задачу: {"action":"edit_task","task_id":ID,"title":"назва","dueDate":"YYYY-MM-DD","priority":"normal|important|critical"}
- Видалити задачу: {"action":"delete_task","task_id":ID}
- Видалити звичку: {"action":"delete_habit","habit_id":ID}
- Перевідкрити задачу: {"action":"reopen_task","task_id":ID}
- Записати момент дня: {"action":"add_moment","text":"що сталося"}
- Нотатка: {"action":"create_note","text":"текст","folder":null}
- Витрата: {"action":"save_finance","fin_type":"expense","amount":число,"category":"категорія","comment":"текст"}
- Подія з датою: {"action":"create_event","title":"назва","date":"YYYY-MM-DD","time":null,"priority":"normal"}
- Змінити подію: {"action":"edit_event","event_id":ID,"date":"YYYY-MM-DD"} (тільки поля що міняються)
- Видалити подію: {"action":"delete_event","event_id":ID}
- Змінити нотатку: {"action":"edit_note","note_id":ID,"text":"новий текст"}
- Розпорядок: {"action":"save_routine","day":"mon" або ["mon","tue","wed","thu","fri"],"blocks":[{"time":"07:00","activity":"Підйом"}]}
ЗАДАЧА = дія яку ТИ маєш ЗРОБИТИ (купити, подзвонити). ПОДІЯ = факт що СТАНЕТЬСЯ (приїзд, зустріч, день народження). "Мама приїжає 20го" = create_event НЕ task! "Перенеси мамин приїзд на 24" = edit_event.
Інакше — звичайний текст українською.${aiContext ? '\n\n' + aiContext : ''}`;

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'system', content: systemPrompt }, ...taskChatHistory.slice(-12)],
        max_tokens: 300,
        temperature: 0.75
      })
    });
    const data = await res.json();
    if (data?.usage) logUsage('tasks-ai', data.usage, data.model);
    const rawReply = data.choices?.[0]?.message?.content;
    // Виділяємо блок {chips:[...]} окремо щоб він не плутався з action-JSON
    const { text: reply, chips: extractedChips } = parseContentChips(rawReply || '');
    if (reply) {
      // Check if reply is JSON with steps
      try {
        const parsed = JSON.parse(reply.trim());
        if (parsed.steps && Array.isArray(parsed.steps) && parsed.steps.length > 0) {
          const allTasks = getTasks();
          const taskIdx = allTasks.findIndex(x => x.id === taskChatId);
          if (taskIdx !== -1) {
            const newSteps = parsed.steps.map(s => ({ id: Date.now() + Math.random(), text: s, done: false }));
            allTasks[taskIdx].steps = [...(allTasks[taskIdx].steps || []), ...newSteps];
            saveTasks(allTasks);
            renderTasks();
            addTaskChatMsg('agent', t('tasks.steps_added', '✅ Додав {n} кроків до задачі. Перевір картку.', { n: parsed.steps.length }));
          }
        } else if (parsed.action) {
          if (!processUniversalAction(parsed, text, addTaskChatMsg)) {
            addTaskChatMsg('agent', reply, '', extractedChips);
          }
        } else {
          addTaskChatMsg('agent', reply, '', extractedChips);
        }
      } catch {
        // Якщо reply містить кілька JSON дій підряд або JSON з оточуючим текстом —
        // розбиваємо на окремі блоки і обробляємо кожен (множинні дії в одному chat).
        const blocks = extractJsonBlocks(reply);
        let handled = false;
        for (const p of blocks) {
          if (p.steps && Array.isArray(p.steps) && p.steps.length > 0) {
            const allTasks = getTasks();
            const taskIdx = allTasks.findIndex(x => x.id === taskChatId);
            if (taskIdx !== -1) {
              const newSteps = p.steps.map(s => ({ id: Date.now() + Math.random(), text: s, done: false }));
              allTasks[taskIdx].steps = [...(allTasks[taskIdx].steps || []), ...newSteps];
              saveTasks(allTasks);
              renderTasks();
              addTaskChatMsg('agent', t('tasks.steps_added', '✅ Додав {n} кроків до задачі. Перевір картку.', { n: p.steps.length }));
              handled = true;
            }
          } else if (p.action && processUniversalAction(p, text, addTaskChatMsg)) {
            handled = true;
          }
        }
        if (!handled) addTaskChatMsg('agent', reply, '', extractedChips);
      }
    }
    else handleChatError(addTaskChatMsg);
  } catch {
    addTaskChatMsg('agent', t('common.network_error', 'Мережева помилка.'));
  }
  taskChatLoading = false;
  btn.disabled = false;
  saveTaskChatHistory();
}



// === TAB SWIPE NAVIGATION ===
// Свайп вправо закриває note-view-modal
(function() {
  let swipeStartX = 0, swipeStartY = 0, swipeStartTime = 0;

  document.addEventListener('touchstart', e => {
    swipeStartX = e.touches[0].clientX;
    swipeStartY = e.touches[0].clientY;
    swipeStartTime = Date.now();
  }, { passive: true });

  document.addEventListener('touchend', e => {
    const noteView = document.getElementById('note-view-modal');
    if (!noteView || noteView.style.display !== 'flex') return;
    const dx = e.changedTouches[0].clientX - swipeStartX;
    const dy = e.changedTouches[0].clientY - swipeStartY;
    const dt = Date.now() - swipeStartTime;
    if (dt > 400) return;
    if (Math.abs(dy) > Math.abs(dx) * 0.7) return;
    if (dx > 60) closeNoteView();
  }, { passive: true });
})();



// === TASK SWIPE TO DELETE ===
// Свайп-видалення тепер через спільну утиліту attachSwipeDelete
// (підключається у renderTasks). Тап на картку — taskCardClick (теж там).

// === AUTO GENERATE TASK STEPS ===
export async function autoGenerateTaskSteps(taskId, title) {
  const key = localStorage.getItem('nm_gemini_key');
  if (!key) return;
  const systemPrompt = `Ти — помічник планування. Отримуєш назву задачі і маєш вирішити чи варто розбивати на кроки.
Якщо задача містить список (через кому, "і", "та") АБО потребує кількох дій — відповідай ТІЛЬКИ JSON: {"steps":["крок 1","крок 2"]}. Максимум 5 кроків. Кожен крок — коротко (2-5 слів).
Якщо задача проста і не потребує кроків (наприклад "зателефонувати мамі") — відповідай ТІЛЬКИ: {"steps":[]}
ТІЛЬКИ валідний JSON, без тексту.`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: title }], max_tokens: 150, temperature: 0.3 })
    });
    clearTimeout(timeout);
    const data = await res.json();
    if (data?.usage) logUsage('tasks-ai', data.usage, data.model);
    const reply = data.choices?.[0]?.message?.content?.trim();
    if (!reply) return;
    const parsed = JSON.parse(reply.replace(/```json|```/g, '').trim());
    if (parsed.steps && parsed.steps.length > 0) {
      const allTasks = getTasks();
      const idx = allTasks.findIndex(x => x.id === taskId);
      if (idx !== -1 && allTasks[idx].steps.length === 0) {
        allTasks[idx].steps = parsed.steps.map(s => ({ id: Date.now() + Math.random(), text: s, done: false }));
        saveTasks(allTasks);
        renderTasks();
      }
    }
  } catch(e) { clearTimeout(timeout); }
}


export let taskBarLoading = false;
export function setTaskBarLoading(v) { taskBarLoading = v; }
export let taskBarHistory = [];

function showTasksChatMessages() {
  openChatBar('tasks');
}

let _taskTypingEl = null;

export function addTaskBarMsg(role, text, _noSave = false) {
  const el = document.getElementById('tasks-chat-messages');
  if (!el) return;
  if (_taskTypingEl) { _taskTypingEl.remove(); _taskTypingEl = null; }
  if (role === 'typing') {
    const td = document.createElement('div');
    td.style.cssText = 'display:flex';
    td.innerHTML = '<div style="background:rgba(255,255,255,0.12);border-radius:4px 12px 12px 12px;padding:5px 10px"><div class=\"ai-typing\"><span></span><span></span><span></span></div></div>';
    el.appendChild(td);
    _taskTypingEl = td;
    el.scrollTop = el.scrollHeight;
    return;
  }
  if (!_noSave) { try { openChatBar('tasks'); } catch(e) {} }
  const isAgent = role === 'agent';
  const div = document.createElement('div');
  div.style.cssText = `display:flex;${isAgent ? '' : 'justify-content:flex-end'}`;
  div.innerHTML = `<div class="msg-bubble ${isAgent ? 'msg-bubble--agent' : 'msg-bubble--user'}">${escapeHtml(text)}</div>`;
  el.appendChild(div);
  el.scrollTop = el.scrollHeight;
  if (role !== 'agent') taskBarHistory.push({ role: 'user', content: text });
  else taskBarHistory.push({ role: 'assistant', content: text });
  if (!_noSave) saveChatMsg('tasks', role, text);
}


// === WINDOW EXPORTS (HTML handlers only) ===
Object.assign(window, {
  openAddTask, saveTask, closeTaskModal, deleteTaskFromModal,
  addTaskStep, toggleTempStep, removeTempStep, closeTaskChat,
  sendTaskChatMessage, toggleTaskStatus, toggleTaskStep,
  taskCardClick,
});
