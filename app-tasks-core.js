// ============================================================
// app-tasks-core.js — Задачі, task chat, task AI bar
// Залежності: app-core.js, app-ai.js
// ============================================================

// === TASKS ===
let editingTaskId = null;
let tempSteps = [];

function getTasks() { return JSON.parse(localStorage.getItem('nm_tasks') || '[]'); }
function saveTasks(arr) { localStorage.setItem('nm_tasks', JSON.stringify(arr)); }

function openAddTask() {
  editingTaskId = null;
  tempSteps = [];
  document.getElementById('task-modal-title').textContent = 'Нова задача';
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
  const t = tasks.find(x => x.id === id);
  if (!t) return;
  editingTaskId = id;
  tempSteps = [...(t.steps || [])];
  document.getElementById('task-modal-title').textContent = 'Редагувати задачу';
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
function setupModalSwipeClose(contentEl, closeFn) {
  if (!contentEl || contentEl._swipeClose) return;
  contentEl._swipeClose = true;
  let startY = 0, startX = 0, dy = 0;
  contentEl.addEventListener('touchstart', e => {
    startY = e.touches[0].clientY;
    startX = e.touches[0].clientX;
    dy = 0;
    contentEl.style.transition = 'none';
  }, { passive: true });
  contentEl.addEventListener('touchmove', e => {
    dy = e.touches[0].clientY - startY;
    const dx = Math.abs(e.touches[0].clientX - startX);
    if (dy > 0 && dy > dx) {
      contentEl.style.transform = `translateY(${dy}px)`;
    }
  }, { passive: true });
  contentEl.addEventListener('touchend', () => {
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
  if (item) showUndoToast('Задачу видалено', () => { const t = getTasks(); const idx = Math.min(taskOrigIdx, t.length); t.splice(idx, 0, item); saveTasks(t); renderTasks(); });
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
  if (!title) { showToast('Введіть назву задачі'); return; }
  const desc = document.getElementById('task-input-desc').value.trim();
  const tasks = getTasks();

  if (editingTaskId) {
    const idx = tasks.findIndex(x => x.id === editingTaskId);
    if (idx !== -1) {
      tasks[idx] = { ...tasks[idx], title, desc, steps: tempSteps, updatedAt: Date.now() };
    }
  } else {
    tasks.unshift({ id: Date.now(), title, desc, steps: tempSteps, status: 'active', createdAt: Date.now() });
  }

  saveTasks(tasks);
  closeTaskModal();
  renderTasks();
  showToast(editingTaskId ? '✓ Задачу оновлено' : '✓ Задачу додано');

  // Тихий AI коментар для нової задачі
  if (!editingTaskId) askAIAboutTask(title, desc, tempSteps);
}

function toggleTaskStep(taskId, stepId) {
  const tasks = getTasks();
  const t = tasks.find(x => x.id === taskId);
  if (!t) return;
  const s = (t.steps || []).find(x => x.id === stepId);
  if (s) s.done = !s.done;

  // Перевіряємо чи всі кроки виконані
  const allDone = t.steps.length > 0 && t.steps.every(x => x.done);
  if (allDone) t.status = 'done';
  else if (t.status === 'done') t.status = 'active';

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
  if (item) showUndoToast('Задачу видалено', () => { const t = getTasks(); const idx = Math.min(taskOrigIdx, t.length); t.splice(idx, 0, item); saveTasks(t); renderTasks(); });
}

function toggleTaskStatus(id) {
  const tasks = getTasks();
  const t = tasks.find(x => x.id === id);
  if (!t) return;
  t.status = t.status === 'done' ? 'active' : 'done';
  saveTasks(tasks);
  renderTasks();
}

function renderTasks() {
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
  const done = tasks.filter(t => t.status === 'done');
  const sorted = [...active, ...done];

  updateProdTabCounters();
  list.innerHTML = sorted.map(t => {
    const steps = t.steps || [];
    const doneCount = steps.filter(s => s.done).length;
    const pct = steps.length > 0 ? Math.round(doneCount / steps.length * 100) : (t.status === 'done' ? 100 : 0);
    const isDone = t.status === 'done';

    return `<div class="task-item-wrap" id="task-wrap-${t.id}" style="position:relative;margin:0 14px 10px;border-radius:16px">
      <div id="task-item-${t.id}"
        style="background:linear-gradient(135deg,#c6f3fd,#a8ecfb);border:1.5px solid rgba(255,255,255,0.4);border-radius:16px;padding:14px 14px 12px;box-shadow:0 2px 12px rgba(0,0,0,0.04);opacity:${isDone ? '0.5' : '1'};cursor:pointer;-webkit-tap-highlight-color:transparent;position:relative;z-index:1;touch-action:pan-y">
      <div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:${steps.length ? '10px' : '0'}">
        <div data-task-check="1" ontouchend="event.preventDefault();toggleTaskStatus(${t.id})" style="width:28px;height:28px;border-radius:8px;border:2px solid ${isDone ? '#16a34a' : 'rgba(234,88,12,0.3)'};background:${isDone ? '#16a34a' : 'rgba(255,255,255,0.78)'};display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;margin-top:1px;font-size:15px;color:white;transition:all 0.2s">${isDone ? '✓' : ''}</div>
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
            <div data-step-check="1" ontouchstart="this._sx=event.touches[0].clientX;this._sy=event.touches[0].clientY" ontouchend="if(Math.abs(event.changedTouches[0].clientX-(this._sx||0))<10&&Math.abs(event.changedTouches[0].clientY-(this._sy||0))<10){event.preventDefault();toggleTaskStep(${t.id},${s.id})}" style="display:flex;align-items:center;gap:10px;cursor:pointer;padding:4px 0">
              <div style="width:24px;height:24px;border-radius:7px;border:1.5px solid ${s.done ? '#ea580c' : 'rgba(30,16,64,0.18)'};background:rgba(255,255,255,0.6);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:13px;color:#ea580c">${s.done ? '✓' : ''}</div>
              <div style="flex:1;font-size:14px;color:rgba(30,16,64,0.65);${s.done ? 'text-decoration:line-through;opacity:0.4' : ''}">${escapeHtml(s.text)}</div>
            </div>
          `).join('')}
        </div>
      ` : ''}
    </div></div>`;
  }).join('');
  // Прикріплюємо non-passive touch listeners для свайп-видалення (iOS сумісність)
  setupTaskSwipeListeners();
}

function setupTaskSwipeListeners() {
  const tasks = getTasks();
  tasks.forEach(t => {
    const el = document.getElementById('task-item-' + t.id);
    if (!el || el._swipeAttached) return;
    el._swipeAttached = true;
    el.addEventListener('touchstart', e => taskSwipeStart(e, t.id), { passive: true });
    el.addEventListener('touchmove', e => taskSwipeMove(e, t.id), { passive: false });
    el.addEventListener('touchend', e => taskSwipeEnd(e, t.id), { passive: false });
  });
}

async function askAIAboutTask(title, desc, steps) {
  const key = localStorage.getItem('nm_gemini_key');
  if (!key) return;
  const aiContext = getAIContext();
  const systemPrompt = `${getOWLPersonality()} Користувач щойно додав задачу. Дай коротку (1-2 речення) реакцію у своєму стилі. Фокус на тому ЯК досягти мети. Якщо задача нечітка — запропонуй перший конкретний крок. Відповідай українською.${aiContext ? '\n\n' + aiContext : ''}`;
  const steps_text = steps.length ? `\nКроки: ${steps.map(s => s.text).join(', ')}` : '';
  const reply = await callAI(systemPrompt, `Задача: ${title}${desc ? '\nОпис: ' + desc : ''}${steps_text}`, {});
  if (!reply) return;
  const commentEl = document.getElementById('tasks-ai-comment');
  if (commentEl) {
    commentEl.textContent = reply;
    commentEl.style.display = 'block';
  }
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
    addTaskChatMsg('agent', 'Введи OpenAI ключ в налаштуваннях щоб спілкуватись з Агентом.');
    return;
  }

  addTaskChatMsg('agent', '…', 'task-chat-intro');
  const aiContext = getAIContext();
  const systemPrompt = `${getOWLPersonality()} Допомагаєш реально виконати задачу. НЕ хвали задачу і не кажи що вона "чудова" чи "чітка" — це лестощі. Перше повідомлення: оціни задачу чесно (1 речення) — чи вона конкретна, чи є дедлайн, чи є підводні камені. Потім запитай один конкретний уточнюючий факт або що вже зроблено. Максимум 3 речення. Відповідай українською.${aiContext ? '\n\n' + aiContext : ''}`;
  const taskInfo = `Задача: ${t.title}${t.desc ? '\nОпис: ' + t.desc : ''}${steps ? '\nКроки:\n' + steps : ''}`;

  callAI(systemPrompt, taskInfo, {}).then(reply => {
    const el = document.getElementById('task-chat-intro');
    if (el) el.textContent = reply || 'Розкажи більше про цю задачу.';
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

function addTaskChatMsg(role, text, id = '') {
  const el = document.getElementById('task-chat-messages');
  const isAgent = role === 'agent';
  const div = document.createElement('div');
  div.style.cssText = `display:flex;${isAgent ? '' : 'justify-content:flex-end'}`;
  div.innerHTML = `<div ${id ? `id="${id}"` : ''} style="max-width:82%;background:${isAgent ? 'rgba(255,255,255,0.9)' : '#ea580c'};color:${isAgent ? '#1e1040' : 'white'};border-radius:${isAgent ? '4px 14px 14px 14px' : '14px 4px 14px 14px'};padding:12px 16px;font-size:18px;line-height:1.7;font-weight:${isAgent ? '400' : '500'}">${escapeHtml(text)}</div>`;
  el.appendChild(div);
  el.scrollTop = el.scrollHeight;
  if (role !== 'agent') taskChatHistory.push({ role: 'user', content: text });
}

async function sendTaskChatMessage() {
  if (taskChatLoading) return;
  const input = document.getElementById('task-chat-input');
  const text = input.value.trim();
  if (!text) return;
  const key = localStorage.getItem('nm_gemini_key');
  if (!key) { addTaskChatMsg('agent', 'Введи OpenAI ключ в налаштуваннях.'); return; }

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
  const systemPrompt = `${getOWLPersonality()} Обговорюєш задачу: "${t?.title || ''}". ${t?.desc ? 'Опис: ' + t.desc + '.' : ''} ${steps ? 'Кроки:\n' + steps : ''} Говориш конкретно. Короткі відповіді (2-4 речення). Фокус на наступних конкретних кроках.${stepInstruction} Відповідай українською.${aiContext ? '\n\n' + aiContext : ''}`;

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
    const reply = data.choices?.[0]?.message?.content;
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
            renderTasks(); // оновлюємо картку одразу
            addTaskChatMsg('agent', `✅ Додав ${parsed.steps.length} кроків до задачі. Перевір картку.`);
          }
        } else {
          addTaskChatMsg('agent', reply);
        }
      } catch {
        addTaskChatMsg('agent', reply);
      }
    }
    else addTaskChatMsg('agent', 'Щось пішло не так. Спробуй ще раз.');
  } catch {
    addTaskChatMsg('agent', 'Мережева помилка.');
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
const taskSwipeState = {};

function taskSwipeStart(e, id) {
  const t = e.touches[0];
  taskSwipeState[id] = { startX: t.clientX, startY: t.clientY, dx: 0, swiping: false };
}
function taskSwipeMove(e, id) {
  const s = taskSwipeState[id]; if (!s) return;
  const t = e.touches[0];
  const dx = t.clientX - s.startX, dy = t.clientY - s.startY;
  if (!s.swiping && Math.abs(dy) > Math.abs(dx)) { delete taskSwipeState[id]; return; }
  if (!s.swiping && Math.abs(dx) > 8) s.swiping = true;
  if (!s.swiping) return;
  if (s.dx <= 0) e.preventDefault();
  s.dx = Math.min(0, dx);
  const el = document.getElementById('task-item-' + id);
  const wrap = document.getElementById('task-wrap-' + id);
  applySwipeTrail(el, wrap, s.dx);
}
function taskSwipeEnd(e, id) {
  const s = taskSwipeState[id]; if (!s) return;
  const el = document.getElementById('task-item-' + id);
  const wrap = document.getElementById('task-wrap-' + id);
  if (s.dx < -SWIPE_DELETE_THRESHOLD) {
    if (el) { el.style.transition = 'transform 0.2s ease, opacity 0.2s'; el.style.transform = 'translateX(-110%)'; el.style.opacity = '0'; }
    setTimeout(() => {
      const tasks = getTasks();
      const taskOrigIdx = tasks.findIndex(x => x.id === id);
      const item = tasks.find(x => x.id === id);
      if (item) addToTrash('task', item);
      saveTasks(tasks.filter(x => x.id !== id));
      renderTasks();
      if (item) showUndoToast('Задачу видалено', () => { const t = getTasks(); const idx = Math.min(taskOrigIdx, t.length); t.splice(idx, 0, item); saveTasks(t); renderTasks(); });
    }, 200);
  } else {
    clearSwipeTrail(el, wrap);
    if (!s.swiping && !e.target.closest('[data-task-check],[data-step-check]')) openEditTask(id);
  }
  delete taskSwipeState[id];
}

// === AUTO GENERATE TASK STEPS ===
async function autoGenerateTaskSteps(taskId, title) {
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


let taskBarLoading = false;
let taskBarHistory = [];

function showTasksChatMessages() {
  openChatBar('tasks');
}

let _taskTypingEl = null;
let _financeTypingEl = null;
let _eveningTypingEl = null;
let _notesTypingEl = null;

function addTaskBarMsg(role, text, _noSave = false) {
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
  try { openChatBar('tasks'); } catch(e) {}
  const isAgent = role === 'agent';
  const div = document.createElement('div');
  div.style.cssText = `display:flex;${isAgent ? '' : 'justify-content:flex-end'}`;
  div.innerHTML = `<div style="max-width:85%;background:${isAgent ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.88)'};color:${isAgent ? 'white' : '#1e1040'};border-radius:${isAgent ? '4px 12px 12px 12px' : '12px 4px 12px 12px'};padding:8px 12px;font-size:15px;line-height:1.5;font-weight:500">${escapeHtml(text)}</div>`;
  el.appendChild(div);
  el.scrollTop = el.scrollHeight;
  if (role !== 'agent') taskBarHistory.push({ role: 'user', content: text });
  else taskBarHistory.push({ role: 'assistant', content: text });
  if (!_noSave) saveChatMsg('tasks', role, text);
}

