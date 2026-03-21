// ============================================================
// app-tasks.js — Задачі, звички, productivity bar, task chat, task AI bar
// Функції: getTasks, renderTasks, saveTask, toggleTaskStatus, getHabits, renderHabits, renderProdHabits, sendTasksBarMessage, processUniversalAction, openTaskChat
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
  setTimeout(() => { inp.focus(); }, 50);
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
    <div style="display:flex;align-items:center;gap:8px;background:rgba(30,16,64,0.03);border-radius:8px;padding:8px 10px">
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
      <div id="task-del-${t.id}" style="position:absolute;right:0;top:0;bottom:0;width:72px;background:linear-gradient(135deg,#ef4444,#dc2626);display:flex;align-items:center;justify-content:center;pointer-events:none;border-radius:16px;opacity:0;transition:opacity 0.15s"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg></div>
      <div id="task-item-${t.id}"
        ontouchstart="taskSwipeStart(event,${t.id})"
        ontouchmove="taskSwipeMove(event,${t.id})"
        ontouchend="taskSwipeEnd(event,${t.id})"
        style="background:linear-gradient(135deg,#c6f3fd,#a8ecfb);border:1.5px solid rgba(255,255,255,0.4);border-radius:16px;padding:14px 14px 12px;box-shadow:0 2px 12px rgba(0,0,0,0.04);opacity:${isDone ? '0.5' : '1'};cursor:pointer;-webkit-tap-highlight-color:transparent;position:relative;z-index:1">
      <div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:${steps.length ? '10px' : '0'}">
        <div data-task-check="1" ontouchend="event.stopPropagation();event.preventDefault();toggleTaskStatus(${t.id})" style="width:28px;height:28px;border-radius:8px;border:2px solid ${isDone ? '#ea580c' : 'rgba(234,88,12,0.3)'};background:rgba(255,255,255,0.78);display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;margin-top:1px;font-size:15px;color:#ea580c;transition:all 0.2s">${isDone ? '✓' : ''}</div>
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
            <div data-step-check="1" ontouchend="event.stopPropagation();event.preventDefault();toggleTaskStep(${t.id},${s.id})" style="display:flex;align-items:center;gap:10px;cursor:pointer;padding:4px 0">
              <div style="width:24px;height:24px;border-radius:7px;border:1.5px solid ${s.done ? '#ea580c' : 'rgba(30,16,64,0.18)'};background:rgba(255,255,255,0.6);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:13px;color:#ea580c">${s.done ? '✓' : ''}</div>
              <div style="flex:1;font-size:14px;color:rgba(30,16,64,0.65);${s.done ? 'text-decoration:line-through;opacity:0.4' : ''}">${escapeHtml(s.text)}</div>
            </div>
          `).join('')}
        </div>
      ` : ''}
    </div></div>`;
  }).join('');
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

// === HABITS ===
let editingHabitId = null;

function getHabits() { return JSON.parse(localStorage.getItem('nm_habits2') || '[]'); }
function saveHabits(arr) { localStorage.setItem('nm_habits2', JSON.stringify(arr)); }
function getHabitLog() { return JSON.parse(localStorage.getItem('nm_habit_log2') || '{}'); }
function saveHabitLog(obj) { localStorage.setItem('nm_habit_log2', JSON.stringify(obj)); }

function openEditHabit(id) {
  const habits = getHabits();
  const h = habits.find(x => x.id === id);
  if (!h) return;
  editingHabitId = id;
  document.getElementById('habit-modal-title').textContent = 'Редагувати звичку';
  document.getElementById('habit-input-name').value = h.name;
  // Деталі: якщо немає поля details — спробуй витягти з назви
  let details = h.details || '';
  if (!details && h.name) {
    const parts = h.name.split(/[,]\s*/);
    if (parts.length > 1) {
      details = parts.slice(1).join(', ').trim();
    }
  }
  document.getElementById('habit-input-details').value = details;
  document.getElementById('habit-input-emoji').value = h.emoji || '';
  // Дні: якщо всі 7 активні але назва містить конкретні дні — запропонувати правильні
  let days = h.days || [0,1,2,3,4];
  const nameAndDetails = (h.name + ' ' + details).toLowerCase();
  const hasSpecificDays = /понеділ|вівтор|серед|четвер|п.ятниц|субот|неділ/.test(nameAndDetails);
  if (hasSpecificDays && days.length === 7) {
    days = [];
    if (/понеділ|пн/.test(nameAndDetails)) days.push(0);
    if (/вівтор|вт/.test(nameAndDetails)) days.push(1);
    if (/серед|ср/.test(nameAndDetails)) days.push(2);
    if (/четвер|чт/.test(nameAndDetails)) days.push(3);
    if (/п.ятниц|пт/.test(nameAndDetails)) days.push(4);
    if (/субот|сб/.test(nameAndDetails)) days.push(5);
    if (/неділ|нд/.test(nameAndDetails)) days.push(6);
    if (days.length === 0) days = [0,1,2,3,4];
  }
  document.querySelectorAll('.habit-day-btn').forEach(b => {
    b.classList.toggle('active', days.includes(parseInt(b.dataset.day)));
  });
  document.getElementById('habit-modal').style.display = 'flex';
  document.getElementById('habit-delete-btn').style.display = 'inline-block';
  setupModalSwipeClose(document.querySelector('#habit-modal > div:last-child'), closeHabitModal);
}

function openAddHabit() {
  editingHabitId = null;
  document.getElementById('habit-modal-title').textContent = 'Нова звичка';
  document.getElementById('habit-input-name').value = '';
  document.getElementById('habit-input-details').value = '';
  document.getElementById('habit-input-emoji').value = '';
  document.getElementById('habit-delete-btn').style.display = 'none';
  document.querySelectorAll('.habit-day-btn').forEach(b => {
    b.classList.toggle('active', [0,1,2,3,4].includes(parseInt(b.dataset.day)));
  });
  document.getElementById('habit-modal').style.display = 'flex';
  setupModalSwipeClose(document.querySelector('#habit-modal > div:last-child'), closeHabitModal);
}

function closeHabitModal() {
  document.getElementById('habit-modal').style.display = 'none';
}

// Toggle day button
document.addEventListener('click', e => {
  if (e.target.classList.contains('habit-day-btn')) {
    e.target.classList.toggle('active');
  }
});

function saveHabit() {
  const name = document.getElementById('habit-input-name').value.trim();
  if (!name) { showToast('Введи назву звички'); return; }
  const details = document.getElementById('habit-input-details').value.trim();
  const emoji = document.getElementById('habit-input-emoji').value.trim() || '⭕';
  const days = [...document.querySelectorAll('.habit-day-btn.active')].map(b => parseInt(b.dataset.day));
  const habits = getHabits();

  if (editingHabitId) {
    const idx = habits.findIndex(x => x.id === editingHabitId);
    if (idx !== -1) habits[idx] = { ...habits[idx], name, details, emoji, days };
  } else {
    habits.push({ id: Date.now(), name, details, emoji, days, createdAt: Date.now() });
  }
  saveHabits(habits);
  closeHabitModal();
  renderHabits();
  renderProdHabits(); // оновлюємо список у вкладці Продуктивність
  showToast(editingHabitId ? '✓ Звичку оновлено' : '✓ Звичку додано');
}

function deleteHabit(id) {
  if (!confirm('Видалити звичку?')) return;
  saveHabits(getHabits().filter(h => h.id !== id));
  renderHabits();
  renderProdHabits();
}

function deleteHabitFromModal() {
  if (!editingHabitId) return;
  const id = editingHabitId;
  const item = getHabits().find(h => h.id === id);
  saveHabits(getHabits().filter(h => h.id !== id));
  renderHabits(); renderProdHabits();
  closeHabitModal();
  if (item) showUndoToast('Звичку видалено', () => { const habits = getHabits(); habits.push(item); saveHabits(habits); renderHabits(); renderProdHabits(); });
}

function toggleHabitToday(id) {
  const today = new Date().toDateString();
  const log = getHabitLog();
  if (!log[today]) log[today] = {};
  log[today][id] = !log[today][id];
  saveHabitLog(log);
  renderHabits();
  renderMeHabitsStats(); // оновлюємо статистику одразу після зміни
}

function getHabitStreak(id) {
  const log = getHabitLog();
  const habits = getHabits();
  const h = habits.find(x => x.id === id);
  if (!h) return 0;
  let streak = 0;
  const d = new Date();
  for (let i = 0; i < 60; i++) {
    const ds = d.toDateString();
    const dow = (d.getDay() + 6) % 7;
    if ((h.days || [0,1,2,3,4]).includes(dow)) {
      if (log[ds]?.[id]) streak++;
      else if (i > 0) break;
    }
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

function getHabitPct(id, days30) {
  const log = getHabitLog();
  const habits = getHabits();
  const h = habits.find(x => x.id === id);
  if (!h) return 0;
  let done = 0;
  const plannedDays = h.days || [0,1,2,3,4];
  // Рахуємо скільки запланованих днів було за 30 днів
  const d = new Date();
  let total = 0;
  for (let i = 0; i < 30; i++) {
    const ds = d.toDateString();
    const dow = (d.getDay() + 6) % 7;
    if (plannedDays.includes(dow)) {
      total++;
      if (log[ds]?.[id]) done++; // виконано в запланований день
    } else if (log[ds]?.[id]) {
      done++; // виконано навіть не в запланований день — теж рахуємо
    }
    d.setDate(d.getDate() - 1);
  }
  return total > 0 ? Math.round(done / total * 100) : 0;
}


// Повертає масив індексів днів цього тижня (0=Пн..6=Нд) коли звичка була виконана
function getHabitWeekDays(id) {
  const log = getHabitLog();
  const done = [];
  const today = new Date();
  const todayDow = (today.getDay() + 6) % 7;
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - todayDow);
  weekStart.setHours(0,0,0,0);
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    const ds = d.toDateString();
    if (log[ds]?.[id]) done.push(i);
  }
  return done;
}

function makeHabitDayDots(h, weekDone, todayDow) {
  const labels = ['Пн','Вт','Ср','Чт','Пт','Сб','Нд'];
  return labels.map(function(label, i) {
    const isPlanned = (h.days || [0,1,2,3,4]).includes(i);
    const isDone = weekDone.includes(i);
    const isToday = i === todayDow;
    let bg, border, color;
    if (isDone) { bg = '#16a34a'; border = '#16a34a'; color = 'white'; }
    else if (isPlanned) { bg = 'transparent'; border = 'rgba(30,16,64,0.2)'; color = 'rgba(30,16,64,0.4)'; }
    else { bg = 'transparent'; border = 'rgba(30,16,64,0.08)'; color = 'rgba(30,16,64,0.15)'; }
    const shadow = isToday ? 'box-shadow:0 0 0 2px rgba(22,163,74,0.3);' : '';
    const text = isDone ? '✓' : label.charAt(0);
    return '<div style="width:24px;height:24px;border-radius:50%;background:' + bg + ';border:1.5px solid ' + border + ';display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;color:' + color + ';' + shadow + '">' + text + '</div>';
  }).join('');
}

function renderHabits() {
  const habits = getHabits();
  const el = document.getElementById('me-habits-stats-list');
  const block = document.getElementById('me-habits-stats');
  if (!el) return;
  const log = getHabitLog();
  const today = new Date().toDateString();
  const todayDow = (new Date().getDay() + 6) % 7;

  if (habits.length === 0) {
    el.innerHTML = '<div style="text-align:center;padding:20px 0;color:rgba(30,16,64,0.3);font-size:15px">Додай першу звичку</div>';
    return;
  }

  el.innerHTML = habits.map(function(h) {
    const isDoneToday = !!log[today]?.[h.id];
    const isScheduledToday = (h.days || [0,1,2,3,4]).includes(todayDow);
    const streak = getHabitStreak(h.id);
    const pct = getHabitPct(h.id);
    const weekDone = getHabitWeekDays(h.id);
    const shortName = h.name.split(' ').slice(0,4).join(' ');
    const dayDots = makeHabitDayDots(h, weekDone, todayDow);
    const checkSvg = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
    const checkBtn = isDoneToday
      ? checkSvg.replace('stroke-width', 'stroke="white" stroke-width')
      : checkSvg.replace('stroke-width', 'stroke="rgba(30,16,64,0.25)" stroke-width');
    const btnBorder = isDoneToday ? '#16a34a' : 'rgba(30,16,64,0.15)';
    const btnBg = isDoneToday ? '#16a34a' : 'rgba(30,16,64,0.03)';
    const pctColor = pct > 0 ? '#16a34a' : 'rgba(30,16,64,0.3)';
    const streakHtml = streak >= 2 ? '<span style="font-size:12px;font-weight:700;color:#f59e0b">🔥' + streak + '</span>' : '';

    return '<div style="position:relative;border-radius:14px;margin-bottom:6px">'
      + '<div id="habit-me-del-' + h.id + '" style="position:absolute;right:0;top:0;bottom:0;width:72px;background:linear-gradient(135deg,#ef4444,#dc2626);display:flex;align-items:center;justify-content:center;pointer-events:none;border-radius:14px;opacity:0;transition:opacity 0.15s"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg></div>'
      + '<div id="habit-me-item-' + h.id + '" class="inbox-item" style="padding:10px 12px;cursor:pointer;width:100%;box-sizing:border-box;-webkit-tap-highlight-color:transparent" onclick="openEditHabit(' + h.id + ')"'
        + ' ontouchstart="habitMeSwipeStart(event,' + h.id + ')"'
        + ' ontouchmove="habitMeSwipeMove(event,' + h.id + ')"'
        + ' ontouchend="habitMeSwipeEnd(event,' + h.id + ')">'
        + '<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">'
          + '<div onclick="event.stopPropagation();toggleHabitToday(' + h.id + ')" data-habit-check="1" style="width:36px;height:36px;border-radius:50%;border:2px solid ' + btnBorder + ';background:' + btnBg + ';display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;transition:all 0.2s;-webkit-tap-highlight-color:transparent">'
            + checkBtn
          + '</div>'
          + '<div style="flex:1;min-width:0">'
            + '<div style="display:flex;align-items:center;gap:6px">'
              + '<span style="font-size:15px;font-weight:700;color:#1e1040">' + escapeHtml(shortName) + '</span>'
              + streakHtml
            + '</div>'
            + '<div style="font-size:11px;font-weight:600;color:' + pctColor + ';margin-top:1px">' + pct + '% за 30 днів</div>'
          + '</div>'

        + '</div>'
        + '<div style="display:flex;gap:4px;padding-left:46px">' + dayDots + '</div>'
      + '</div>'
    + '</div>';
  }).join('');
}


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


// === PRODUCTIVITY INNER TABS ===
let currentProdTab = 'tasks';

function updateProdTabCounters() {
  // Лічильник задач
  const taskCount = getTasks().filter(t => t.status !== 'done').length;
  const taskCountEl = document.getElementById('prod-tab-tasks-count');
  const taskSubEl = document.getElementById('prod-tab-tasks-sub');
  if (taskCountEl) taskCountEl.textContent = taskCount;
  if (taskSubEl) taskSubEl.textContent = taskCount === 1 ? 'активна' : 'активних';

  // Лічильник звичок
  const habits = getHabits();
  const log = getHabitLog();
  const today = new Date().toDateString();
  const todayDow = (new Date().getDay() + 6) % 7;
  const todayHabits = habits.filter(h => (h.days || [0,1,2,3,4]).includes(todayDow));
  const doneToday = todayHabits.filter(h => !!log[today]?.[h.id]).length;
  const habitCountEl = document.getElementById('prod-tab-habits-count');
  const habitSubEl = document.getElementById('prod-tab-habits-sub');
  if (habitCountEl) habitCountEl.textContent = habits.length;
  if (habitSubEl) habitSubEl.textContent = todayHabits.length > 0 ? `${doneToday} з ${todayHabits.length} сьогодні` : 'звичок';
}

function switchProdTab(tab) {
  currentProdTab = tab;
  const isHabits = tab === 'habits';

  // Стилі карток перемикача
  const tabTasks = document.getElementById('prod-tab-tasks');
  const tabHabits = document.getElementById('prod-tab-habits');
  const tasksCount = document.getElementById('prod-tab-tasks-count');
  const tasksTitle = tabTasks ? tabTasks.querySelector('div > div:first-child') : null;
  const habitsCount = document.getElementById('prod-tab-habits-count');
  const habitsTitle = tabHabits ? tabHabits.querySelector('div > div:first-child') : null;

  if (tabTasks) {
    tabTasks.style.background = !isHabits ? 'white' : 'rgba(255,255,255,0.4)';
    tabTasks.style.borderColor = !isHabits ? 'rgba(234,88,12,0.2)' : 'transparent';
    tabTasks.style.boxShadow = !isHabits ? '0 2px 10px rgba(234,88,12,0.1)' : 'none';
  }
  if (tasksCount) tasksCount.style.color = !isHabits ? '#ea580c' : 'rgba(30,16,64,0.3)';
  if (tasksTitle) tasksTitle.style.color = !isHabits ? '#ea580c' : 'rgba(30,16,64,0.3)';

  if (tabHabits) {
    tabHabits.style.background = isHabits ? 'white' : 'rgba(255,255,255,0.4)';
    tabHabits.style.borderColor = isHabits ? 'rgba(22,163,74,0.2)' : 'transparent';
    tabHabits.style.boxShadow = isHabits ? '0 2px 10px rgba(22,163,74,0.1)' : 'none';
  }
  if (habitsCount) habitsCount.style.color = isHabits ? '#16a34a' : 'rgba(30,16,64,0.3)';
  if (habitsTitle) habitsTitle.style.color = isHabits ? '#16a34a' : 'rgba(30,16,64,0.3)';

  document.getElementById('prod-page-tasks').style.display = isHabits ? 'none' : 'block';
  document.getElementById('prod-page-habits').style.display = isHabits ? 'block' : 'none';

  // Update + button action
  const addBtn = document.getElementById('prod-add-btn');
  if (addBtn) addBtn.onclick = isHabits ? openAddHabit : openAddTask;

  updateProdTabCounters();
  if (isHabits) renderProdHabits();
}

function renderProdHabits() {
  updateProdTabCounters();
  const habits = getHabits();
  const el = document.getElementById('prod-habits-list');
  if (!el) return;
  const log = getHabitLog();
  const today = new Date().toDateString();
  const todayDow = (new Date().getDay() + 6) % 7;

  // Update progress bar
  const todayHabits = habits.filter(h => (h.days || [0,1,2,3,4]).includes(todayDow));
  const doneTodayCount = todayHabits.filter(h => !!log[today]?.[h.id]).length;
  const countEl = document.getElementById('habits-today-count');
  const barEl = document.getElementById('habits-today-bar');
  if (countEl) countEl.textContent = `${doneTodayCount} / ${todayHabits.length}`;
  if (barEl) barEl.style.width = todayHabits.length > 0 ? `${Math.round(doneTodayCount/todayHabits.length*100)}%` : '0%';

  if (habits.length === 0) {
    el.innerHTML = '<div style="text-align:center;padding:40px 20px;color:rgba(30,16,64,0.3);font-size:15px">Ще немає звичок<br>Натисни + щоб додати</div>';
    return;
  }

  el.innerHTML = habits.map(h => {
    const isDoneToday = !!log[today]?.[h.id];
    const isScheduledToday = (h.days || [0,1,2,3,4]).includes(todayDow);
    const streak = getHabitStreak(h.id);
    const dayLabels = ['Пн','Вт','Ср','Чт','Пт','Сб','Нд'];

    const weekDone = getHabitWeekDays(h.id);
    const shortName2 = h.name.split(' ').slice(0,4).join(' ');
    const dayDots2 = makeHabitDayDots(h, weekDone, todayDow);
    const pct = getHabitPct(h.id);
    const pctColor2 = pct > 0 ? '#16a34a' : 'rgba(30,16,64,0.3)';
    const streakTxt = streak >= 2 ? '🔥 ' + streak + ' · ' : '';
    const checkSvgProd = isDoneToday
      ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>'
      : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(30,16,64,0.25)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
    const checkBgProd = isDoneToday ? 'background:#16a34a;border:none;' : 'background:rgba(30,16,64,0.03);border:1.5px solid rgba(30,16,64,0.15);';

    // ФІКС: галочка і редагування — окремі незалежні елементи, не вкладені один в одний
    return '<div style="position:relative;border-radius:16px;margin-bottom:10px">'
      + '<div id="prod-habit-del-' + h.id + '" style="position:absolute;right:0;top:0;bottom:0;width:72px;background:linear-gradient(135deg,#ef4444,#dc2626);display:flex;align-items:center;justify-content:center;pointer-events:none;border-radius:16px;opacity:0;transition:opacity 0.15s">'
        + '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>'
      + '</div>'
      + '<div id="prod-habit-item-' + h.id + '" style="background:rgba(255,255,255,0.6);border:1.5px solid rgba(255,255,255,0.85);border-radius:16px;padding:12px 14px;box-shadow:0 2px 10px rgba(100,70,200,0.06);position:relative;will-change:transform;cursor:pointer;-webkit-tap-highlight-color:transparent"'
        + ' ontouchstart="prodHabitSwipeStart(event,' + h.id + ')"'
        + ' ontouchmove="prodHabitSwipeMove(event,' + h.id + ')"'
        + ' ontouchend="prodHabitSwipeEnd(event,' + h.id + ')">'
      + '<div style="display:flex;align-items:center;gap:12px;margin-bottom:8px">'
        + '<div onclick="event.stopPropagation();toggleProdHabitToday(' + h.id + ')" data-habit-check="1" style="width:40px;height:40px;border-radius:12px;flex-shrink:0;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.2s;-webkit-tap-highlight-color:transparent;' + checkBgProd + '">'
          + checkSvgProd
        + '</div>'
        + '<div style="flex:1;min-width:0">'
          + '<div style="font-size:16px;font-weight:700;color:#1e1040;margin-bottom:1px">' + escapeHtml(shortName2) + '</div>'
          + '<div style="font-size:11px;font-weight:600;color:' + pctColor2 + '">' + streakTxt + pct + '% за 30 днів</div>'
        + '</div>'
      + '</div>'
      + '<div style="display:flex;gap:4px;padding-left:52px">' + dayDots2 + '</div>'
      + '</div>'
    + '</div>';
  }).join('');
}

function toggleProdHabitToday(id) {
  const today = new Date().toDateString();
  const log = getHabitLog();
  if (!log[today]) log[today] = {};
  log[today][id] = !log[today][id];
  saveHabitLog(log);
  renderProdHabits(); // оновлюємо тільки вкладку Продуктивність
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


// === HABIT ME SWIPE TO DELETE ===
const habitMeSwipeState = {};
const HABIT_SWIPE_THRESHOLD = 250;

function habitMeSwipeStart(e, id) {
  const t = e.touches[0];
  habitMeSwipeState[id] = { startX: t.clientX, startY: t.clientY, dx: 0, swiping: false };
}
function habitMeSwipeMove(e, id) {
  const s = habitMeSwipeState[id]; if (!s) return;
  const t = e.touches[0];
  const dx = t.clientX - s.startX, dy = t.clientY - s.startY;
  // Якщо рух більше вертикальний — скасовуємо свайп, даємо скролитись
  if (!s.swiping && Math.abs(dy) > Math.abs(dx)) {
    delete habitMeSwipeState[id];
    return;
  }
  if (!s.swiping && Math.abs(dx) > 8) s.swiping = true;
  if (!s.swiping) return;
  e.preventDefault();
  s.dx = Math.min(0, dx);
  const el = document.getElementById('habit-me-item-' + id);
  if (el) el.style.transform = 'translateX(' + s.dx + 'px)';
  const delBg = document.getElementById('habit-me-del-' + id);
  if (delBg) delBg.style.opacity = Math.min(1, -s.dx / 180).toFixed(2);
}
function habitMeSwipeEnd(e, id) {
  const s = habitMeSwipeState[id]; if (!s) return;
  const el = document.getElementById('habit-me-item-' + id);
  if (s.dx < -HABIT_SWIPE_THRESHOLD) {
    if (el) { el.style.transition = 'transform 0.2s ease, opacity 0.2s'; el.style.transform = 'translateX(-110%)'; el.style.opacity = '0'; }
    setTimeout(() => {
      const allHabits = getHabits();
      const habitOrigIdx = allHabits.findIndex(h => h.id === id);
      const item = allHabits.find(h => h.id === id);
      if (item) addToTrash('habit', item);
      saveHabits(allHabits.filter(h => h.id !== id)); renderHabits(); renderProdHabits();
      if (item) showUndoToast('Звичку видалено', () => { const habits = getHabits(); const idx = Math.min(habitOrigIdx, habits.length); habits.splice(idx, 0, item); saveHabits(habits); renderHabits(); renderProdHabits(); });
    }, 200);
  } else {
    if (el) { el.style.transition = 'transform 0.25s ease'; el.style.transform = 'translateX(0)'; setTimeout(() => { if(el) el.style.transition = ''; }, 300); }
    const delBgMe = document.getElementById('habit-me-del-' + id);
    if (delBgMe) { delBgMe.style.transition = 'opacity 0.25s'; delBgMe.style.opacity = '0'; setTimeout(() => { if(delBgMe) delBgMe.style.transition = ''; }, 300); }
    // Якщо це тап (не свайп) — чекбокс або редагування
    if (!s.swiping) {
      const target = e.changedTouches[0];
      const checkBtn = el ? el.querySelector('[data-habit-check]') : null;
      if (checkBtn) {
        const rect = checkBtn.getBoundingClientRect();
        if (target.clientX >= rect.left && target.clientX <= rect.right &&
            target.clientY >= rect.top && target.clientY <= rect.bottom) {
          toggleHabitToday(id);
        } else {
          openEditHabit(id);
        }
      }
    }
  }
  delete habitMeSwipeState[id];
}


// === PROD HABIT SWIPE TO DELETE ===
const prodHabitSwipeState = {};

function prodHabitSwipeStart(e, id) {
  const t = e.touches[0];
  prodHabitSwipeState[id] = { startX: t.clientX, startY: t.clientY, dx: 0, swiping: false };
}
function prodHabitSwipeMove(e, id) {
  const s = prodHabitSwipeState[id]; if (!s) return;
  const t = e.touches[0];
  const dx = t.clientX - s.startX, dy = t.clientY - s.startY;
  if (!s.swiping && Math.abs(dy) > Math.abs(dx)) { delete prodHabitSwipeState[id]; return; }
  if (!s.swiping && Math.abs(dx) > 8) s.swiping = true;
  if (!s.swiping) return;
  e.preventDefault();
  s.dx = Math.min(0, dx);
  const el = document.getElementById('prod-habit-item-' + id);
  if (el) el.style.transform = 'translateX(' + s.dx + 'px)';
  const delBg = document.getElementById('prod-habit-del-' + id);
  if (delBg) delBg.style.opacity = Math.min(1, -s.dx / 180).toFixed(2);
}
function prodHabitSwipeEnd(e, id) {
  const s = prodHabitSwipeState[id]; if (!s) return;
  const el = document.getElementById('prod-habit-item-' + id);
  if (s.dx < -HABIT_SWIPE_THRESHOLD) {
    if (el) { el.style.transition = 'transform 0.2s ease, opacity 0.2s'; el.style.transform = 'translateX(-110%)'; el.style.opacity = '0'; }
    setTimeout(() => {
      const allHabits = getHabits();
      const habitOrigIdx = allHabits.findIndex(h => h.id === id);
      const item = allHabits.find(h => h.id === id);
      if (item) addToTrash('habit', item);
      saveHabits(allHabits.filter(h => h.id !== id));
      renderHabits(); renderProdHabits();
      if (item) showUndoToast('Звичку видалено', () => { const habits = getHabits(); const idx = Math.min(habitOrigIdx, habits.length); habits.splice(idx, 0, item); saveHabits(habits); renderHabits(); renderProdHabits(); });
    }, 200);
  } else {
    if (el) { el.style.transition = 'transform 0.25s ease'; el.style.transform = 'translateX(0)'; setTimeout(() => { if(el) el.style.transition = ''; }, 300); }
    const delBg2 = document.getElementById('prod-habit-del-' + id);
    if (delBg2) { delBg2.style.transition = 'opacity 0.25s'; delBg2.style.opacity = '0'; setTimeout(() => { if(delBg2) delBg2.style.transition = ''; }, 300); }
    if (!s.swiping) {
      const target = e.changedTouches[0];
      const checkBtn = el ? el.querySelector('[data-habit-check]') : null;
      if (checkBtn) {
        const rect = checkBtn.getBoundingClientRect();
        if (target.clientX >= rect.left && target.clientX <= rect.right &&
            target.clientY >= rect.top && target.clientY <= rect.bottom) {
          toggleProdHabitToday(id);
        } else {
          openEditHabit(id);
        }
      }
    }
  }
  delete prodHabitSwipeState[id];
}

// === TASK SWIPE TO DELETE ===
const taskSwipeState = {};
const TASK_SWIPE_THRESHOLD = 250;

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
  e.preventDefault();
  s.dx = Math.min(0, dx);
  const el = document.getElementById('task-item-' + id);
  if (el) el.style.transform = 'translateX(' + s.dx + 'px)';
  const delBg = document.getElementById('task-del-' + id);
  if (delBg) delBg.style.opacity = Math.min(1, -s.dx / 180).toFixed(2);
}
function taskSwipeEnd(e, id) {
  const s = taskSwipeState[id]; if (!s) return;
  const el = document.getElementById('task-item-' + id);
  if (s.dx < -TASK_SWIPE_THRESHOLD) {
    if (el) { el.style.transition = 'transform 0.2s ease, opacity 0.2s'; el.style.transform = 'translateX(-110%)'; el.style.opacity = '0'; }
    setTimeout(() => {
      const tasks = getTasks();
      const taskOrigIdx = tasks.findIndex(x => x.id === id);
      const item = tasks.find(x => x.id === id);
      saveTasks(tasks.filter(x => x.id !== id));
      renderTasks();
      if (item) showUndoToast('Задачу видалено', () => { const t = getTasks(); const idx = Math.min(taskOrigIdx, t.length); t.splice(idx, 0, item); saveTasks(t); renderTasks(); });
    }, 200);
  } else {
    if (el) { el.style.transition = 'transform 0.25s ease'; el.style.transform = 'translateX(0)'; setTimeout(() => { if(el) el.style.transition = ''; }, 300); }
    const delBg = document.getElementById('task-del-' + id);
    if (delBg) { delBg.style.transition = 'opacity 0.25s'; delBg.style.opacity = '0'; setTimeout(() => { if(delBg) delBg.style.transition = ''; }, 300); }
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

// === UNIVERSAL ACTION PROCESSOR — один мозок для всіх барів ===
function processUniversalAction(parsed, originalText, addMsg) {
  const action = parsed.action;

  if (action === 'create_task') {
    const title = (parsed.title || '').trim();
    if (!title) return false;
    const steps = Array.isArray(parsed.steps) ? parsed.steps.map(s => ({ id: Date.now() + Math.random(), text: s, done: false })) : [];
    const tasks = getTasks();
    tasks.unshift({ id: Date.now(), title, desc: parsed.desc || '', steps, status: 'active', createdAt: Date.now() });
    saveTasks(tasks);
    if (currentTab === 'tasks') renderTasks();
    addMsg('agent', '✅ Задачу "' + title + '" створено');
    if (parsed.ask_after) setTimeout(() => addMsg('agent', parsed.ask_after), 600);
    return true;
  }

  if (action === 'create_habit') {
    const name = (parsed.name || '').trim();
    if (!name) return false;
    const habits = getHabits();
    habits.push({ id: Date.now(), name, details: parsed.details || '', emoji: '⭕', days: parsed.days || [0,1,2,3,4,5,6], createdAt: Date.now() });
    saveHabits(habits);
    renderProdHabits(); renderHabits();
    addMsg('agent', '🌱 Звичку "' + name + '" створено');
    if (parsed.ask_after) setTimeout(() => addMsg('agent', parsed.ask_after), 600);
    return true;
  }

  if (action === 'create_note') {
    addNoteFromInbox(parsed.text, 'note', parsed.folder || null);
    if (currentTab === 'notes') renderNotes();
    addMsg('agent', '✓ Нотатку збережено' + (parsed.folder ? ' в папку "' + parsed.folder + '"' : ''));
    if (parsed.ask_after) setTimeout(() => addMsg('agent', parsed.ask_after), 600);
    return true;
  }

  if (action === 'save_finance' || action === 'save_expense' || action === 'save_income') {
    const type = action === 'save_income' ? 'income' : (parsed.fin_type || 'expense');
    const amount = parseFloat(parsed.amount) || 0;
    if (!amount || amount <= 0) { addMsg('agent', 'Не вдалось розпізнати суму.'); return true; }
    const category = parsed.category || 'Інше';
    const cats = getFinCats();
    const catList = type === 'expense' ? cats.expense : cats.income;
    if (!catList.includes(category)) { catList.push(category); saveFinCats(cats); }
    const txs = getFinance();
    txs.unshift({ id: Date.now(), type, amount, category, comment: parsed.comment || originalText, ts: Date.now() });
    saveFinance(txs);
    if (currentTab === 'finance') renderFinance();
    addMsg('agent', '✓ ' + (type === 'expense' ? '-' : '+') + formatMoney(amount) + ' · ' + category);
    return true;
  }

  return false;
}


async function sendTasksBarMessage() {
  if (taskBarLoading) return;
  const input = document.getElementById('tasks-chat-input');
  const text = input.value.trim();
  if (!text) return;
  const key = localStorage.getItem('nm_gemini_key');
  if (!key) { addTaskBarMsg('agent', 'Введи OpenAI ключ в налаштуваннях.'); return; }

  input.value = '';
  input.style.height = 'auto';
  addTaskBarMsg('user', text);
  taskBarLoading = true;
  addTaskBarMsg('typing', '');

  const tasks = getTasks().filter(t => t.status !== 'done');
  const tasksSummary = tasks.map(t => {
    const steps = (t.steps || []).map(s => '  - ' + s.text + (s.done ? ' [✓]' : '')).join('\n');
    return 'Задача ID:' + t.id + ' "' + t.title + '"' + (steps ? '\nКроки:\n' + steps : '');
  }).join('\n\n');

  const habits = getHabits();
  const log = getHabitLog();
  const today = new Date().toDateString();
  const habitsSummary = habits.map(h => {
    const done = !!log[today]?.[h.id];
    return h.name + (done ? ' [виконано сьогодні]' : ' [не виконано сьогодні]');
  }).join(', ');

  const aiContext = getAIContext();
  const systemPrompt = getOWLPersonality() + '\n\n'
    + 'ЗАДАЧІ:\n' + (tasksSummary || 'Немає активних задач') + '\n\n'
    + (habitsSummary ? 'ЗВИЧКИ СЬОГОДНІ:\n' + habitsSummary + '\n\n' : '')
    + 'Ти можеш:\n'
    + '1. Відповідати на питання про задачі та звички\n'
    + '2. Виконав крок — JSON: {"action":"complete_step","task_id":ID,"step_text":"текст"}\n'
    + '3. Виконав задачу — JSON: {"action":"complete_task","task_id":ID}\n'
    + '4. Виконав звичку — JSON: {"action":"complete_habit","habit_name":"назва"}\n'
    + '5. Створити звичку — JSON: {"action":"create_habit","name":"назва","days":[0,1,2,3,4,5,6]}\n'
    + '6. Створити задачу — JSON: {"action":"create_task","title":"назва","steps":[]}\n'
    + '7. Додати крок — JSON: {"action":"add_step","task_id":ID,"step":"текст"}\n'
    + '8. Скасувати крок — JSON: {"action":"undo_step","task_id":ID,"step_text":"текст"}\n'
    + '9. Створити нотатку — JSON: {"action":"create_note","text":"текст","folder":null}\n'
    + '10. Зберегти витрату — JSON: {"action":"save_finance","fin_type":"expense","amount":число,"category":"категорія","comment":"текст"}\n'
    + '11. Зберегти дохід — JSON: {"action":"save_finance","fin_type":"income","amount":число,"category":"категорія","comment":"текст"}\n'
    + 'Якщо незрозуміло — запитай. ТІЛЬКИ чистий JSON без markdown. Інакше — текст українською 1-2 речення.\nНЕ вигадуй дані яких немає: ліміти, плани, звички чи задачі яких немає в списку вище.'
    + (aiContext ? '\n\n' + aiContext : '');

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'system', content: systemPrompt }, ...taskBarHistory.slice(-8), { role: 'user', content: text }],
        max_tokens: 200, temperature: 0.5
      })
    });
    const data = await res.json();
    const reply = data.choices?.[0]?.message?.content?.trim();
    if (!reply) { addTaskBarMsg('agent', 'Щось пішло не так.'); taskBarLoading = false; return; }

    // Спробуємо розпарсити JSON дію
    try {
      // Шукаємо JSON навіть якщо є текст перед ним
      const jsonMatch = reply.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? jsonMatch[0] : reply.replace(/```json|```/g,'').trim();
      const parsed = JSON.parse(jsonStr);

      // Спочатку пробуємо універсальні дії (нотатки, фінанси, задачі, звички)
      if (processUniversalAction(parsed, text, addTaskBarMsg)) {
        // оброблено
      } else if (parsed.action === 'complete_step') {
        const allTasks = getTasks();
        const t = allTasks.find(x => x.id === parsed.task_id);
        if (t) {
          const step = t.steps.find(s => s.text.toLowerCase().includes(parsed.step_text.toLowerCase().substring(0,10)));
          if (step) {
            step.done = true;
            // Якщо всі кроки виконані або немає кроків — виконати задачу
            if (t.steps.every(s => s.done)) t.status = 'done';
            saveTasks(allTasks); renderTasks();
            addTaskBarMsg('agent', `✅ Відмітив "${step.text}" як виконано`);
          } else { addTaskBarMsg('agent', 'Не знайшов такий крок. Уточни будь ласка.'); }
        }
      } else if (parsed.action === 'complete_task') {
        const allTasks = getTasks();
        const t = allTasks.find(x => x.id === parsed.task_id);
        if (t) { t.status = 'done'; t.steps.forEach(s => s.done = true); saveTasks(allTasks); renderTasks(); addTaskBarMsg('agent', `✅ Задачу "${t.title}" виконано!`); }
      } else if (parsed.action === 'add_step') {
        const allTasks = getTasks();
        const t = allTasks.find(x => x.id === parsed.task_id);
        if (t) { t.steps.push({ id: Date.now(), text: parsed.step, done: false }); saveTasks(allTasks); renderTasks(); addTaskBarMsg('agent', '✅ Додав крок "' + parsed.step + '"'); }
      } else if (parsed.action === 'complete_habit') {
        const habits = getHabits();
        const h = habits.find(x => x.name.toLowerCase().includes((parsed.habit_name || '').toLowerCase().substring(0,6)));
        if (h) {
          const todayStr = new Date().toDateString();
          const log = getHabitLog();
          if (!log[todayStr]) log[todayStr] = {};
          log[todayStr][h.id] = true;
          saveHabitLog(log);
          renderProdHabits();
          renderHabits();
          addTaskBarMsg('agent', '✅ Відмітив звичку "' + h.name + '" як виконану сьогодні');
        } else { addTaskBarMsg('agent', reply); }
      } else if (parsed.action === 'create_habit') {
        const habits = getHabits();
        const name = (parsed.name || '').trim();
        if (name) {
          const days = parsed.days || [0,1,2,3,4,5,6];
          habits.push({ id: Date.now(), name, details: parsed.details || '', emoji: '⭕', days, createdAt: Date.now() });
          saveHabits(habits);
          renderProdHabits(); renderHabits();
          addTaskBarMsg('agent', '🌱 Звичку "' + name + '" створено!');
        }
      } else if (parsed.action === 'create_task') {
        const tasks = getTasks();
        const title = (parsed.title || '').trim();
        if (title) {
          const steps = Array.isArray(parsed.steps) ? parsed.steps.map(s => ({ id: Date.now() + Math.random(), text: s, done: false })) : [];
          tasks.unshift({ id: Date.now(), title, desc: parsed.desc || '', steps, status: 'active', createdAt: Date.now() });
          saveTasks(tasks); renderTasks();
          addTaskBarMsg('agent', '✅ Задачу "' + title + '" створено!');
        }
      } else if (parsed.action === 'undo_step') {
        const allTasks = getTasks();
        const t = allTasks.find(x => x.id === parsed.task_id);
        if (t) {
          const step = t.steps.find(s => s.text.toLowerCase().includes((parsed.step_text || '').toLowerCase().substring(0,10)));
          if (step) {
            step.done = false;
            if (t.status === 'done') t.status = 'active';
            saveTasks(allTasks); renderTasks();
            addTaskBarMsg('agent', `↩️ Скасував виконання "${step.text}"`);
          } else { addTaskBarMsg('agent', 'Не знайшов такий крок. Уточни будь ласка.'); }
        }
      } else { addTaskBarMsg('agent', reply); }
    } catch { addTaskBarMsg('agent', reply); }
  } catch { addTaskBarMsg('agent', 'Мережева помилка.'); }
  taskBarLoading = false;
}

