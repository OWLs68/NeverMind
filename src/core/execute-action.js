// ============================================================
// core/execute-action.js — UNIVERSAL ACTION PROCESSOR (один мозок для всіх барів)
//
// Винесено з src/tabs/habits.js (v3pexs 28.06, D1 автономного блоку; мапа
// розвідника). habits.js був 1985 рядків (>1500 = правило розбиття), а цей
// executor — 835 рядків з тісними звʼязками на ВСI сутності — тепер окремий
// модуль (= Architecture Refactor «Сесія 4», план Supabase §7 «інструменти
// відчепити»). habits.js ре-експортує processUniversalAction (strangler) —
// 7 наявних імпортерів працюють без змін.
//
// Циркулярні імпорти core↔tabs — усталений патерн проекту (utils/boot/trash/
// nav так само); безпечно бо виклики не top-level (esbuild hoisting).
// ============================================================

import { currentTab } from './nav.js';
import { t, levenshtein, getReminders, saveReminders } from './utils.js';
import { generateUUID } from './uuid.js';
import { addToTrash, showUndoToast } from './trash.js';
import { makeEvent, makeTask, makeList } from '../data/entity-factories.js';
import { makeHabit } from '../data/habit-classifier.js';
import { resolveDateFromText, parseUaTimeOfDay } from '../data/ua-time-parser.js';
import { monthGenitive } from '../data/months.js';
import { getLists, saveLists } from '../tabs/lists.js';
import { getMoments, saveMoments } from '../tabs/evening.js';
import { getEvents, saveEvents, addEventDedup, getRoutine, saveRoutine } from '../tabs/calendar.js';
import { getInbox, saveInbox, renderInbox, _detectEventFromTask } from '../tabs/inbox.js';
import { getTasks, saveTasks, renderTasks, toggleTaskStatus } from '../tabs/tasks.js';
import { getNotes, saveNotes, renderNotes, addNoteFromInbox, setCurrentNotesFolder, getDirectChildren } from '../tabs/notes.js';
import { getFinance, saveFinance, renderFinance, processFinanceAction } from '../tabs/finance.js';
import { deleteHealthCardProgrammatic, deleteAllergy, deleteMedicationFromCard } from '../tabs/health.js';
import { getHabits, saveHabits, getHabitLog, saveHabitLog, renderHabits, renderProdHabits } from '../tabs/habits.js';

// === UNIVERSAL ACTION PROCESSOR — один мозок для всіх барів ===
// Fuzzy пошук папки — знаходить найближчу по назві з урахуванням опечаток
function _fuzzyFindFolder(query, folders) {
  if (!query || !folders.length) return null;
  const q = query.toLowerCase().replace(/[ʼ']/g, '');
  // 1. Точний збіг
  const exact = folders.find(f => f.toLowerCase() === query.toLowerCase());
  if (exact) return exact;
  // 2. Містить рядок
  const contains = folders.find(f => f.toLowerCase().includes(q) || q.includes(f.toLowerCase()));
  if (contains) return contains;
  // 3. Відстань Левенштейна
  let best = null, bestDist = Infinity;
  folders.forEach(f => {
    const d = _levenshtein(q, f.toLowerCase().replace(/[ʼ']/g, ''));
    if (d < bestDist) { bestDist = d; best = f; }
  });
  // Приймаємо якщо відстань <= 3 або <= 40% довжини слова
  return (bestDist <= 3 || bestDist <= Math.floor(q.length * 0.4)) ? best : null;
}

function _levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({length: m+1}, (_, i) => Array.from({length: n+1}, (_, j) => i === 0 ? j : j === 0 ? i : 0));
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1] : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
  return dp[m][n];
}

// ============================================================
// Перенесено 20.04.2026 Gg3Fy ("Один мозок V2" Шар 1):
// - _toolCallToUniversalAction і dispatchChatToolCalls → src/ai/tool-dispatcher.js
// - processUniversalAction залишається тут (384 рядки, тісні локальні залежності)
// ============================================================
export function processUniversalAction(parsed, originalText, addMsg) {
  const action = parsed.action;

  // Розбита відповідь: проміжне повідомлення → пауза → результат
  const _splitReply = (thinking, doWork) => {
    addMsg('agent', thinking);
    setTimeout(() => doWork(), 1200 + Math.random() * 800);
  };

  if (action === 'create_task') {
    const title = (parsed.title || '').trim();
    if (!title) return false;
    // Fallback: якщо AI створив task але це схоже на подію — конвертуємо в event
    const eventDetected = _detectEventFromTask(title);
    if (eventDetected) {
      const ev = makeEvent({ title: eventDetected.title || title, date: eventDetected.date, time: null, priority: parsed.priority || 'normal' });
      const res = addEventDedup(ev);
      if (!res.added) { addMsg('agent', t('habits.event.dup', 'Така подія "{title}" вже є в календарі.', { title: ev.title })); return true; }
      const dateObj = new Date(eventDetected.date);
      const dayStr = `${dateObj.getDate()} ${monthGenitive(dateObj.getMonth())}`;
      const items = getInbox(); items.unshift({ id: generateUUID(), eventId: ev.id, text: title, category: 'event', ts: Date.now(), processed: true }); saveInbox(items);
      addMsg('agent', t('habits.event.added', '📅 Подію "{title}" додано на {date}', { title: ev.title, date: dayStr }));
      return true;
    }
    const steps = Array.isArray(parsed.steps) ? parsed.steps.map(s => ({ id: generateUUID(), text: s, done: false })) : [];
    const newTask = makeTask({ title, desc: parsed.desc || '', steps, dueDate: parsed.dueDate, priority: parsed.priority });
    const tasks = getTasks();
    tasks.unshift(newTask);
    saveTasks(tasks);
    if (currentTab === 'tasks') renderTasks();
    const items = getInbox(); items.unshift({ id: generateUUID(), text: title, category: 'task', ts: Date.now(), processed: true }); saveInbox(items);
    addMsg('agent', t('habits.task.created', '✅ Задачу "{title}" створено', { title }));
    if (parsed.ask_after) setTimeout(() => addMsg('agent', parsed.ask_after), 600);
    return true;
  }

  // Список-чекліст (v3pexs) — окрема сутність nm_lists + картка в стрічці Inbox.
  // НЕ задача: жодного запису у nm_tasks.
  if (action === 'create_list') {
    const title = (parsed.title || t('lists.untitled', 'Список')).trim();
    const items = (Array.isArray(parsed.items) ? parsed.items : [])
      .map(s => (typeof s === 'string' ? s : (s && s.text ? String(s.text) : '')).trim())
      .filter(Boolean)
      .map(text => ({ id: generateUUID(), text, done: false }));
    if (items.length === 0) return false;
    const list = makeList({ title, items });
    const lists = getLists();
    lists.unshift(list);
    saveLists(lists);
    const inbox = getInbox();
    inbox.unshift({ id: generateUUID(), listId: list.id, text: title, category: 'list', ts: Date.now(), processed: true });
    saveInbox(inbox);
    if (currentTab === 'inbox') renderInbox();
    addMsg('agent', t('lists.created', '📝 Список "{title}" ({n}) — у стрічці Inbox', { title, n: items.length }));
    return true;
  }

  if (action === 'delete_list') {
    const lists = getLists();
    const idx = lists.findIndex(l => String(l.id) === String(parsed.list_id));
    if (idx === -1) { addMsg('agent', t('lists.not_found', 'Список не знайдено.')); return true; }
    const removed = lists[idx];
    lists.splice(idx, 1);
    saveLists(lists);
    saveInbox(getInbox().filter(i => String(i.listId) !== String(parsed.list_id)));
    if (currentTab === 'inbox') renderInbox();
    addMsg('agent', t('lists.deleted', '🗑 Список "{title}" видалено', { title: removed.title || '' }));
    return true;
  }

  if (action === 'edit_habit') {
    const habits = getHabits();
    const h = habits.find(x => x.id === parsed.habit_id);
    if (!h) {
      // Fuzzy match по назві
      const nameQ = (parsed.name || parsed.habit_name || '').toLowerCase();
      const found = habits.find(x => x.name.toLowerCase().includes(nameQ.slice(0, 6)));
      if (!found) { addMsg('agent', t('habits.err.habit_not_found', 'Не знайшов цю звичку.')); return true; }
      if (parsed.name) found.name = parsed.name;
      if (parsed.days) found.days = parsed.days;
      if (parsed.details !== undefined) found.details = parsed.details;
      saveHabits(habits);
      renderProdHabits(); renderHabits();
      addMsg('agent', t('habits.habit.updated', '✏️ Звичку "{name}" оновлено', { name: found.name }));
      return true;
    }
    if (parsed.name) h.name = parsed.name;
    if (parsed.days) h.days = parsed.days;
    if (parsed.details !== undefined) h.details = parsed.details;
    saveHabits(habits);
    renderProdHabits(); renderHabits();
    addMsg('agent', t('habits.habit.updated', '✏️ Звичку "{name}" оновлено', { name: h.name }));
    return true;
  }

  if (action === 'edit_task') {
    const tasks = getTasks();
    const task = tasks.find(x => String(x.id) === String(parsed.task_id));
    if (!task) {
      const nameQ = (parsed.title || '').toLowerCase();
      const found = tasks.find(x => x.title.toLowerCase().includes(nameQ.slice(0, 8)));
      if (!found) { addMsg('agent', t('habits.err.task_not_found_short', 'Не знайшов цю задачу.')); return true; }
      if (parsed.title) found.title = parsed.title;
      if (parsed.dueDate && parsed.dueDate !== found.dueDate) {
        if (found.dueDate) found.rescheduleCount = (found.rescheduleCount || 0) + 1;
        found.dueDate = parsed.dueDate;
        found.updatedAt = Date.now();
      }
      if (parsed.priority && ['normal','important','critical'].includes(parsed.priority)) found.priority = parsed.priority;
      saveTasks(tasks);
      if (currentTab === 'tasks') renderTasks();
      addMsg('agent', t('habits.task.updated', '✏️ Задачу "{title}" оновлено', { title: found.title }));
      return true;
    }
    if (parsed.title) task.title = parsed.title;
    if (parsed.dueDate && parsed.dueDate !== task.dueDate) {
      if (task.dueDate) task.rescheduleCount = (task.rescheduleCount || 0) + 1;
      task.dueDate = parsed.dueDate;
      task.updatedAt = Date.now();
    }
    if (parsed.priority && ['normal','important','critical'].includes(parsed.priority)) task.priority = parsed.priority;
    saveTasks(tasks);
    if (currentTab === 'tasks') renderTasks();
    addMsg('agent', t('habits.task.updated', '✏️ Задачу "{title}" оновлено', { title: task.title }));
    return true;
  }

  if (action === 'delete_task') {
    const tasks = getTasks();
    let target = tasks.find(x => String(x.id) === String(parsed.task_id));
    if (!target) {
      const nameQ = (parsed.title || parsed.query || '').toLowerCase().trim();
      // QDIGl 04.05 SAFETY: пустий nameQ (AI забув title) → .includes('')=true
      // → видаляли ПЕРШУ активну задачу при будь-якому невідомому task_id.
      // Це був корінь «видали проект Х» → видалена випадкова задача. Тепер
      // короткий query (<3 літери) → відмова + повідомлення юзеру.
      if (nameQ.length >= 3) {
        target = tasks.find(x => x.title.toLowerCase().includes(nameQ.slice(0, 8)));
      }
    }
    if (!target) { addMsg('agent', t('habits.err.task_not_found', 'Не знайшов цю задачу. Уточни назву.')); return true; }
    addToTrash('task', target, null);
    const remaining = tasks.filter(x => x.id !== target.id);
    saveTasks(remaining);
    if (currentTab === 'tasks') renderTasks();
    addMsg('agent', t('habits.task.deleted', '🗑️ Задачу "{title}" видалено', { title: target.title }));
    // 64CXo: showUndoToast() без msg/restoreFn → toast «undefined», кнопка «Відновити» нічого не робила.
    showUndoToast(t('habits.toast.task_deleted', 'Задачу "{title}" видалено', { title: target.title }), () => {
      const cur = getTasks();
      cur.push(target);
      saveTasks(cur);
      if (currentTab === 'tasks') renderTasks();
    });
    return true;
  }

  if (action === 'delete_habit') {
    const habits = getHabits();
    const h = habits.find(x => x.id === parsed.habit_id);
    const nameQ = (parsed.name || parsed.query || '').toLowerCase();
    const target = h || habits.find(x => x.name.toLowerCase().includes(nameQ.slice(0, 6)));
    if (!target) { addMsg('agent', t('habits.err.habit_not_found', 'Не знайшов цю звичку.')); return true; }
    addToTrash('habit', target, null);
    const remaining = habits.filter(x => x.id !== target.id);
    saveHabits(remaining);
    renderProdHabits(); renderHabits();
    addMsg('agent', t('habits.habit.deleted', '🗑️ Звичку "{name}" видалено', { name: target.name }));
    // 64CXo: showUndoToast() без аргументів → toast «undefined».
    showUndoToast(t('habits.toast.habit_deleted', 'Звичку "{name}" видалено', { name: target.name }), () => {
      const cur = getHabits();
      cur.push(target);
      saveHabits(cur);
      renderProdHabits(); renderHabits();
    });
    return true;
  }

  if (action === 'reopen_task') {
    const tasks = getTasks();
    const task = tasks.find(x => String(x.id) === String(parsed.task_id) && x.status === 'done');
    const nameQ = (parsed.title || parsed.query || '').toLowerCase();
    const target = task || tasks.find(x => x.status === 'done' && x.title.toLowerCase().includes(nameQ.slice(0, 8)));
    if (!target) { addMsg('agent', t('habits.err.closed_task_not_found', 'Не знайшов закриту задачу з такою назвою.')); return true; }
    target.status = 'active';
    delete target.completedAt;
    saveTasks(tasks);
    if (currentTab === 'tasks') renderTasks();
    addMsg('agent', t('habits.task.reopened', '🔄 Задачу "{title}" перевідкрито', { title: target.title }));
    return true;
  }

  // B-106 fix (Aps79 27.04): complete_task/complete_habit/add_step тепер у processUniversalAction.
  // Раніше були тільки у fallback text-JSON шляху sendTasksBarMessage — коли AI кликав через
  // tool_calls, dispatchChatToolCalls йшов сюди і не знаходив обробник → жодного addMsg → точки
  // друку висіли назавжди.
  if (action === 'complete_task') {
    const tasks = getTasks();
    const task = tasks.find(x => String(x.id) === String(parsed.task_id));
    if (!task) { addMsg('agent', t('habits.err.task_not_found_by_id', 'Не знайшов задачу з таким ID.')); return true; }
    if (task.status === 'done') { addMsg('agent', t('habits.task.already_done', 'Задача "{title}" вже закрита.', { title: task.title })); return true; }
    // 64CXo B-160 guard: AI міг зматчити task через назву коли юзер закрив КРОК.
    // Перевіряємо чи user-message містить текст активного кроку — якщо так, закриваємо
    // тільки цей крок, не цілу задачу. Юзер каже «Купив перець» при «Купити перець,
    // цибулю, ківі» з 7 кроками → закрити крок «перець», не всю задачу.
    if (Array.isArray(task.steps) && task.steps.length > 0 && originalText) {
      const userMsg = originalText.toLowerCase();
      const matchStep = task.steps.find(s => !s.done && s.text && userMsg.includes(s.text.toLowerCase().replace(/^купити\s+/, '').slice(0, 6)));
      if (matchStep && task.steps.some(s => !s.done && s !== matchStep)) {
        matchStep.done = true;
        if (task.steps.every(s => s.done)) {
          task.status = 'done';
          task.completedAt = Date.now();
        }
        task.updatedAt = Date.now();
        saveTasks(tasks);
        if (currentTab === 'tasks') renderTasks();
        addMsg('agent', t('habits.step.closed', '✓ Крок «{step}» закрито', { step: matchStep.text }));
        return true;
      }
    }
    addMsg('agent', t('habits.task.done', '✅ Задачу "{title}" виконано!', { title: task.title }));
    // Викликаємо ту саму 3-фазну анімацію що й при ручному тапі ✓:
    // галочка → 250мс пауза → сповзання картки → save+render через 620мс.
    if (currentTab === 'tasks') {
      toggleTaskStatus(task.id);
    } else {
      // Не на вкладці Задач — анімувати нема де, просто зберігаємо статус.
      task.status = 'done';
      task.completedAt = Date.now();
      task.updatedAt = Date.now();
      if (Array.isArray(task.steps)) task.steps.forEach(s => s.done = true);
      saveTasks(tasks);
    }
    return true;
  }

  if (action === 'complete_habit') {
    const habits = getHabits();
    let h = habits.find(x => String(x.id) === String(parsed.habit_id));
    if (!h && parsed.habit_name) {
      const q = parsed.habit_name.toLowerCase();
      h = habits.find(x => x.name.toLowerCase().includes(q.slice(0, 6)));
    }
    if (!h) { addMsg('agent', t('habits.err.habit_not_found_short', 'Не знайшов звичку.')); return true; }
    const todayStr = new Date().toDateString();
    const log = getHabitLog();
    if (!log[todayStr]) log[todayStr] = {};
    log[todayStr][h.id] = true;
    saveHabitLog(log);
    renderProdHabits();
    renderHabits();
    addMsg('agent', t('habits.habit.marked_today', '✅ Відмітив звичку "{name}" як виконану сьогодні', { name: h.name }));
    return true;
  }

  // 64CXo B-161: complete_step як універсальна action (через tool у prompts.js
  // + case у tool-dispatcher.js). Раніше працювало тільки як text-JSON у Tasks-чаті
  // → у Inbox AI писав «[complete_task]» plain text бо tool недосяжний.
  if (action === 'complete_step') {
    const tasks = getTasks();
    const task = tasks.find(x => String(x.id) === String(parsed.task_id));
    if (!task) { addMsg('agent', t('habits.err.task_not_found_short', 'Не знайшов задачу.')); return true; }
    if (!Array.isArray(task.steps) || task.steps.length === 0) {
      addMsg('agent', t('habits.step.no_steps', 'У задачі «{title}» немає кроків.', { title: task.title })); return true;
    }
    const q = (parsed.step_text || '').toLowerCase().trim();
    // 64CXo regression-hunter: без guard порожній q → ''.includes('') = true → закривав
    // перший-ліпший активний крок. Тепер вимагаємо мінімум 2 символи для match.
    if (q.length < 2) { addMsg('agent', t('habits.step.empty_text', 'Уточни який саме крок закрити.')); return true; }
    const qSlice = q.slice(0, 8);
    const step = task.steps.find(s => {
      if (s.done) return false;
      const sLow = s.text.toLowerCase();
      // Захист від false-match на занадто коротких словах: вимагаємо щоб slice
      // мав мінімум 3 символи І щоб збіг був не у 1-1 нерелевантному слові.
      return (sLow.length >= 3 && sLow.includes(qSlice) && qSlice.length >= 3) ||
             (q.length >= 3 && q.includes(sLow.slice(0, Math.min(8, sLow.length))) && sLow.length >= 3);
    });
    if (!step) { addMsg('agent', t('habits.step.not_found', 'Не знайшов активний крок «{step}» у задачі «{title}».', { step: parsed.step_text, title: task.title })); return true; }
    step.done = true;
    if (task.steps.every(s => s.done)) {
      task.status = 'done';
      task.completedAt = Date.now();
    }
    task.updatedAt = Date.now();
    saveTasks(tasks);
    if (currentTab === 'tasks') renderTasks();
    const allDone = task.steps.every(s => s.done);
    addMsg('agent', allDone
      ? t('habits.step.last_done', '✅ Останній крок «{step}» закрито — задачу «{title}» виконано!', { step: step.text, title: task.title })
      : t('habits.step.closed', '✓ Крок «{step}» закрито', { step: step.text }));
    return true;
  }

  // 64CXo B-163: merge_tasks — об'єднання двох задач у одну. Кроки з 'from' переходять
  // у 'to' (з дедупом), назва 'from' стає кроком, 'from' видаляється.
  if (action === 'merge_tasks') {
    const tasks = getTasks();
    const from = tasks.find(x => String(x.id) === String(parsed.from_task_id));
    const to = tasks.find(x => String(x.id) === String(parsed.to_task_id));
    if (!from || !to) { addMsg('agent', t('habits.merge.not_found', 'Не знайшов одну з задач для об\'єднання.')); return true; }
    if (from.id === to.id) { addMsg('agent', t('habits.merge.same', 'Не можу об\'єднати задачу з самою собою.')); return true; }
    if (!Array.isArray(to.steps)) to.steps = [];
    if (!Array.isArray(from.steps)) from.steps = [];
    let added = 0;
    from.steps.filter(s => !s.done).forEach(s => {
      if (!to.steps.some(ts => ts.text.toLowerCase() === s.text.toLowerCase())) {
        to.steps.push({ id: generateUUID(), text: s.text, done: false });
        added++;
      }
    });
    if (!to.steps.some(ts => ts.text.toLowerCase() === from.title.toLowerCase())) {
      to.steps.push({ id: generateUUID(), text: from.title, done: false });
      added++;
    }
    const idx = tasks.findIndex(x => String(x.id) === String(from.id));
    if (idx !== -1) tasks.splice(idx, 1);
    to.updatedAt = Date.now();
    saveTasks(tasks);
    if (currentTab === 'tasks') renderTasks();
    addMsg('agent', t('habits.merge.done', '✅ Об\'єднав «{from}» з «{to}» (+{n} кроків)', { from: from.title, to: to.title, n: added }));
    return true;
  }

  if (action === 'add_step') {
    const tasks = getTasks();
    const task = tasks.find(x => String(x.id) === String(parsed.task_id));
    if (!task) { addMsg('agent', t('habits.err.task_for_step', 'Не знайшов задачу для додавання кроку.')); return true; }
    const stepText = (parsed.step || '').trim();
    if (!stepText) { addMsg('agent', t('habits.err.step_empty', 'Не вказано текст кроку.')); return true; }
    if (!Array.isArray(task.steps)) task.steps = [];
    // 64CXo B-162: дедуп — пропускаємо якщо такий крок (нечутливо до регістру) вже є.
    // На «Об'єднай дві останні» AI робив add_step з 4 рядками, з них 3 вже були → дублі.
    if (task.steps.some(s => s.text.toLowerCase() === stepText.toLowerCase())) {
      addMsg('agent', t('habits.step.dup', 'Крок «{step}» вже є — пропускаю', { step: stepText }));
      return true;
    }
    task.steps.push({ id: generateUUID(), text: stepText, done: false });
    task.updatedAt = Date.now();
    saveTasks(tasks);
    if (currentTab === 'tasks') renderTasks();
    addMsg('agent', t('habits.step.added', '✅ Додав крок "{step}"', { step: stepText }));
    return true;
  }

  if (action === 'add_moment') {
    const text = (parsed.text || '').trim();
    if (!text) return false;
    const mood = /добре|чудово|супер|відмінно|весело|щасли|круто|кайф/i.test(text) ? 'positive' :
                 /погано|жахливо|сумно|нудно|важко|втомив|зле|дістало/i.test(text) ? 'negative' : 'neutral';
    // 64CXo: парсимо date якщо AI передав («вчора» → YYYY-MM-DD). Phase B hook
    // використовує ts для дейлі-папки — так момент про вчора йде у вчорашню папку.
    let momentTs = Date.now();
    if (parsed.date && /^\d{4}-\d{2}-\d{2}$/.test(parsed.date)) {
      const parsedDate = new Date(parsed.date + 'T12:00:00');
      if (!isNaN(parsedDate.getTime())) momentTs = parsedDate.getTime();
    } else {
      // 64CXo: code-side fallback через ua-time-parser. AI часто не передає
      // date навіть з явним промптом → парсимо «вчора»/«тиждень тому»/etc
      // з originalText юзера + text моменту.
      const resolved = resolveDateFromText((originalText || '') + ' ' + text);
      if (resolved) momentTs = resolved.getTime();
    }
    const moments = getMoments();
    moments.push({ id: generateUUID(), text, mood, ts: momentTs });
    saveMoments(moments);
    addMsg('agent', t('habits.moment.added', '✨ Момент записано'));
    return true;
  }

  if (action === 'create_habit') {
    const name = (parsed.name || '').trim();
    if (!name) return false;
    const habits = getHabits();
    habits.push(makeHabit({ name, details: parsed.details || '', days: parsed.days }));
    saveHabits(habits);
    renderProdHabits(); renderHabits();
    addMsg('agent', t('habits.habit.created', '🌱 Звичку "{name}" створено', { name }));
    if (parsed.ask_after) setTimeout(() => addMsg('agent', parsed.ask_after), 600);
    return true;
  }

  if (action === 'create_note') {
    addNoteFromInbox(parsed.text, 'note', parsed.folder || null, 'agent');
    if (currentTab === 'notes') renderNotes();
    addMsg('agent', parsed.folder
      ? t('habits.note.saved_to', '✓ Нотатку збережено в папку "{folder}"', { folder: parsed.folder })
      : t('habits.note.saved', '✓ Нотатку збережено'));
    if (parsed.ask_after) setTimeout(() => addMsg('agent', parsed.ask_after), 600);
    return true;
  }

  if (action === 'create_event') {
    const title = (parsed.title || '').trim();
    if (!title) return false;
    // 64CXo Phase 3: code-side date resolve via ua-time-parser. AI with strict
    // mode may pass date=null for abstract expressions — parser handles them.
    let resolvedDate = parsed.date;
    if (!resolvedDate || !/^\d{4}-\d{2}-\d{2}$/.test(resolvedDate)) {
      const d = resolveDateFromText(originalText || title, new Date(), 'future');
      if (d) {
        resolvedDate = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      }
    }
    if (!resolvedDate) return false;
    let endTime = parsed.end_time || null;
    if (!parsed.time) endTime = null;
    if (endTime && parsed.time && endTime <= parsed.time) endTime = null;
    let conflict = null;
    if (parsed.time) {
      conflict = getEvents().find(e => e.date === resolvedDate && e.time === parsed.time && e.title !== title);
    }
    const ev = makeEvent({ title, date: resolvedDate, time: parsed.time || null, endTime, priority: parsed.priority || 'normal' });
    const res = addEventDedup(ev);
    if (!res.added) { addMsg('agent', t('habits.event.dup', 'Така подія "{title}" вже є в календарі.', { title })); return true; }
    const dateObj = new Date(resolvedDate);
    const dayStr = `${dateObj.getDate()} ${monthGenitive(dateObj.getMonth())}`;
    const items = getInbox(); items.unshift({ id: generateUUID(), eventId: ev.id, text: title, category: 'event', ts: Date.now(), processed: true }); saveInbox(items);
    const timeStr = parsed.time ? ` о ${parsed.time}${endTime ? '–' + endTime : ''}` : '';
    const warn = conflict ? '\n' + t('habits.event.conflict', '⚠️ На цей час уже є "{title}". Лишити обидві чи перенести?', { title: conflict.title }) : '';
    addMsg('agent', t('habits.event.added_full', '📅 Подію "{title}" додано на {date}{time}{warn}', { title, date: dayStr, time: timeStr, warn }));
    return true;
  }

  if (action === 'edit_event') {
    const events = getEvents();
    const idx = events.findIndex(e => e.id === parsed.event_id);
    if (idx === -1) { addMsg('agent', t('habits.err.event_for_edit', 'Не знайшов подію для редагування.')); return true; }
    if (parsed.date) events[idx].date = parsed.date;
    if (parsed.time !== undefined) events[idx].time = parsed.time || null;
    if (parsed.end_time !== undefined) {
      // Порожній рядок — юзер просить прибрати тривалість
      const newEnd = parsed.end_time || null;
      const startT = events[idx].time;
      events[idx].endTime = (newEnd && startT && newEnd > startT) ? newEnd : null;
    }
    // Якщо стартовий час прибрано — тривалість теж зникає
    if (parsed.time === null || parsed.time === '') events[idx].endTime = null;
    if (parsed.title) events[idx].title = parsed.title;
    if (parsed.priority) events[idx].priority = parsed.priority;
    saveEvents(events);
    const dateObj = new Date(events[idx].date);
    const dayStr = `${dateObj.getDate()} ${monthGenitive(dateObj.getMonth())}`;
    const tm = events[idx].time;
    const et = events[idx].endTime;
    const timeStr = tm ? ` о ${tm}${et ? '–' + et : ''}` : '';
    const editText = t('habits.event.edited', '✏️ Змінено: "{title}" → {date}{time}', { title: events[idx].title, date: dayStr, time: timeStr });
    addMsg('agent', editText);
    // Карточка в Inbox стрічку щоб юзер бачив що було змінено
    try {
      const inbox = getInbox();
      inbox.unshift({ id: generateUUID(), eventId: events[idx].id, text: editText, type: 'edit', category: 'event', ts: Date.now() });
      saveInbox(inbox);
      if (typeof renderInbox === 'function') renderInbox();
    } catch(e) {}
    return true;
  }

  if (action === 'delete_event') {
    const events = getEvents();
    const idx = events.findIndex(e => e.id === parsed.event_id);
    if (idx === -1) { addMsg('agent', t('habits.err.event_not_found', 'Не знайшов подію.')); return true; }
    const title = events[idx].title;
    const removed = events[idx];
    const eventId = removed.id;
    addToTrash('event', removed);
    events.splice(idx, 1);
    saveEvents(events);
    // B-165 dyhJu 10.05: Cleanup nm_inbox — видаляємо event-картку, інакше
    // вона лишається зомбі у Inbox після видалення з календаря (юзер бачить
    // картку «Подія» якої вже немає). Дзеркальне до B-126 delete_reminder.
    // Match за eventId (нові картки після dyhJu) АБО fallback за text+category
    // (старі картки до dyhJu без eventId field).
    try {
      const inbox = getInbox();
      const inboxRest = inbox.filter(it => {
        const matchById = it.eventId === eventId;
        const matchByText = !it.eventId && it.category === 'event' && it.text === title;
        return !(matchById || matchByText);
      });
      if (inboxRest.length !== inbox.length) saveInbox(inboxRest);
    } catch(e) {}
    try { renderInbox(); } catch(e) {}
    addMsg('agent', t('habits.event.deleted', '🗑 Подію "{title}" видалено', { title }));
    // 64CXo: showUndoToast('event', title) — другий arg був рядок назви, не функція restore.
    // При кліку «Відновити» — TypeError. Виправлено на правильну сигнатуру.
    showUndoToast(t('habits.toast.event_deleted', 'Подію "{title}" видалено', { title }), () => {
      const cur = getEvents();
      cur.push(removed);
      saveEvents(cur);
    });
    return true;
  }

  if (action === 'edit_note') {
    const notes = getNotes();
    const idx = notes.findIndex(n => n.id === parsed.note_id);
    if (idx === -1) { addMsg('agent', t('habits.err.note_not_found', 'Не знайшов нотатку.')); return true; }
    if (parsed.text) notes[idx].text = parsed.text;
    if (parsed.folder) notes[idx].folder = parsed.folder;
    notes[idx].updatedAt = Date.now();
    saveNotes(notes);
    addMsg('agent', parsed.folder
      ? t('habits.note.updated_folder', '✓ Нотатку оновлено → папка "{folder}"', { folder: parsed.folder })
      : t('habits.note.updated', '✓ Нотатку оновлено'));
    return true;
  }

  if (action === 'create_folder') {
    const folderName = (parsed.folder || '').trim();
    if (!folderName) return false;
    // Папка "існує" якщо є хоч одна нотатка з такою назвою
    const notes = getNotes();
    const exists = notes.some(n => (n.folder || 'Загальне') === folderName);
    if (exists) {
      addMsg('agent', t('habits.folder.exists', 'Папка "{folder}" вже є.', { folder: folderName }));
    } else {
      // Створюємо папку через додавання порожньої нотатки-заглушки яку одразу прибираємо
      // Правильний спосіб — просто кажемо юзеру що папка з'явиться при першій нотатці
      addMsg('agent', t('habits.folder.created_hint', 'Папка "{folder}" створена. Напиши нотатку і я покладу її туди.', { folder: folderName }));
    }
    return true;
  }

  if (action === 'delete_folder') {
    const targetName = (parsed.folder || '').trim();
    if (!targetName) return false;
    const notes = getNotes();
    const folders = [...new Set(notes.map(n => n.folder || 'Загальне'))];
    // Fuzzy match — знаходимо найближчу папку
    const matched = _fuzzyFindFolder(targetName, folders);
    if (!matched) {
      addMsg('agent', t('habits.folder.not_found', 'Папку "{folder}" не знайшов. Доступні: {list}', { folder: targetName, list: folders.join(', ') }));
      return true;
    }
    // 64CXo Фаза D: recursive — якщо папка має дочірніх, видаляємо їх теж.
    // Узгоджено з swipe-delete у notes.js (Фаза C).
    const childNames = getDirectChildren(matched);
    const toDeleteSet = new Set([matched, ...childNames]);
    const toDelete = notes.filter(n => toDeleteSet.has(n.folder || 'Загальне'));
    toDelete.forEach(n => addToTrash('folder', n, null));
    const remaining = notes.filter(n => !toDeleteSet.has(n.folder || 'Загальне'));
    saveNotes(remaining);
    if (currentTab === 'notes') { setCurrentNotesFolder(null); renderNotes(); }
    const childInfo = childNames.length > 0 ? t('habits.folder.deleted_children', ' + {n} підпапок', { n: childNames.length }) : '';
    addMsg('agent', t('habits.folder.deleted', '✓ Папку "{folder}" видалено ({n} нотаток)', { folder: matched, n: toDelete.length }) + childInfo);
    return true;
  }

  if (action === 'move_note') {
    const noteQuery = (parsed.query || parsed.text || '').toLowerCase().trim();
    const targetFolder = (parsed.folder || '').trim();
    if (!noteQuery || !targetFolder) return false;
    const notes = getNotes();
    const folders = [...new Set(notes.map(n => n.folder || 'Загальне'))];
    const resolvedFolder = _fuzzyFindFolder(targetFolder, folders) || targetFolder;
    // Знаходимо нотатку по тексту
    const idx = notes.findIndex(n => n.text.toLowerCase().includes(noteQuery));
    if (idx === -1) {
      addMsg('agent', t('habits.note.not_found_q', 'Нотатку "{q}" не знайшов.', { q: noteQuery }));
      return true;
    }
    const oldFolder = notes[idx].folder || 'Загальне';
    // Видаляємо зі старої папки
    const oldIdx = notes.findIndex(n => n.id === notes[idx].id && (n.folder || 'Загальне') === oldFolder && n !== notes[idx]);
    notes[idx] = { ...notes[idx], folder: resolvedFolder, updatedAt: Date.now() };
    saveNotes(notes);
    if (currentTab === 'notes') renderNotes();
    addMsg('agent', t('habits.note.moved', '✓ Нотатку переміщено з "{from}" до "{to}"', { from: oldFolder, to: resolvedFolder }));
    return true;
  }

  if (action === 'save_finance' || action === 'save_expense' || action === 'save_income') {
    // Phase 2 nliW8 13.05: уніфіковано через processFinanceAction (finance.js).
    // Раніше тут був 50-рядковий дубль з активними розбіжностями (auto-create
    // вигаданих категорій, Date.now() ID, відсутні syncHealth + budget + logAction +
    // chip-діалог). Тепер один мозок для всіх 7 non-Inbox чатів — handler приймає
    // addMsg як 3-й параметр (DI), повідомлення йде у поточний чат.
    // save_income → forced fin_type='income' через нормалізацію args.
    const normalizedParsed = action === 'save_income' ? { ...parsed, fin_type: 'income' } : parsed;
    processFinanceAction(normalizedParsed, originalText, addMsg);
    return true;
  }

  if (action === 'save_routine') {
    const blocks = (parsed.blocks || []).map(b => ({ time: b.time, activity: b.activity }));
    const days = Array.isArray(parsed.day) ? parsed.day : [parsed.day || 'default'];
    if (days.length > 1) {
      _splitReply(t('habits.routine.copying', 'Копіюю розпорядок на {n} днів...', { n: days.length }), () => {
        const routine = getRoutine();
        days.forEach(d => { routine[d] = [...blocks]; });
        saveRoutine(routine);
        addMsg('agent', t('habits.routine.done_multi', '🕐 Готово! Розпорядок на {n} дн. ({blocks} блоків)', { n: days.length, blocks: blocks.length }));
      });
    } else {
      const routine = getRoutine();
      days.forEach(d => { routine[d] = [...blocks]; });
      saveRoutine(routine);
      addMsg('agent', t('habits.routine.saved', '🕐 Розпорядок збережено ({blocks} блоків)', { blocks: blocks.length }));
    }
    return true;
  }

  if (action === 'set_reminder') {
    const text = parsed.text || 'Нагадування';
    // 64CXo Phase 3: code-side date resolve via ua-time-parser, mode='future'.
    let date = parsed.date;
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      const d = resolveDateFromText(originalText || text, new Date(), 'future');
      if (d) {
        date = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      } else {
        date = new Date().toISOString().slice(0, 10);
      }
    }
    // dyhJu G2: parseUaTimeOfDay як fallback коли AI не передав явний `time`.
    // Покриває «зранку»→08:00, «через годину»→now+60, «о 15:00»→15:00 тощо.
    // Якщо парсер теж null — питаємо юзера.
    let time = parsed.time;
    if (!time) {
      const parsedTime = parseUaTimeOfDay(originalText || text, new Date());
      if (parsedTime) time = parsedTime;
    }
    if (!time) { addMsg('agent', t('habits.err.reminder_time', 'Вкажи час нагадування.')); return true; }
    // B-169 dyhJu 10.05: guard «date=today + time у минулому → +1 день».
    // Юзер каже «нагадай зранку» о 20:00 → parser ставить time=08:00, date=today
    // (нема явного слова «завтра» у тексті). Reminder на 08:00 СЬОГОДНI = у
    // минулому → spawn'иться одразу або не спрацює зовсім. Логіка: «зранку»
    // вже не сьогодні якщо ранок минув — переносимо на завтра.
    {
      const now = new Date();
      const todayISO = now.toISOString().slice(0, 10);
      if (date === todayISO && time) {
        const [hh, mm] = time.split(':').map(n => parseInt(n, 10));
        if (Number.isFinite(hh) && Number.isFinite(mm)) {
          const reminderTs = new Date(now);
          reminderTs.setHours(hh, mm, 0, 0);
          if (reminderTs.getTime() <= now.getTime()) {
            const tomorrow = new Date(now);
            tomorrow.setDate(tomorrow.getDate() + 1);
            date = tomorrow.toISOString().slice(0, 10);
          }
        }
      }
    }
    // myshu Сесія 3: UUID замість Date.now()+1/+2 арифметики. Раніше:
    //   reminderId = Date.now()
    //   event.id = reminderId + 1   ← числова арифметика
    //   inbox.id = reminderId + 2   ← числова арифметика
    // Проблема: коли reminderId стане UUID-рядок, +1 = конкатенація («uuid1»),
    // 3 сховища (nm_reminders/nm_events/nm_inbox) перестали б знаходити одне
    // одного. Тепер: КОЖЕН запис має свій UUID, зв'язок через окреме поле
    // `reminderId` (primary key для cross-storage cleanup).
    const reminderId = generateUUID();
    // 1. nm_reminders — для тригера спливаючого попередження
    const reminders = getReminders();
    reminders.push({ id: reminderId, time, text, date, done: false });
    saveReminders(reminders);
    // 2. nm_events — щоб було видно у календарі і модалці "Розпорядок дня"
    addEventDedup({
      id: generateUUID(),
      title: text,
      date,
      time,
      priority: 'normal',
      createdAt: Date.now(),
      source: 'reminder',
      reminderId
    });
    // 3. nm_inbox — картка у стрічку з категорією "Нагадування" (⏰).
    // QDIGl 04.05: reminderId поле додано для синхронного видалення —
    // свайп картки прибирає nm_reminders + nm_events за тим же ID.
    const items = getInbox();
    items.unshift({
      id: generateUUID(),
      reminderId: reminderId,
      text: `${time} — ${text}`,
      category: 'reminder',
      ts: Date.now(),
      processed: true
    });
    saveInbox(items);
    try { renderInbox(); } catch(e) {}
    window.dispatchEvent(new CustomEvent('nm-data-changed', { detail: 'reminder' }));
    addMsg('agent', t('habits.reminder.set.ok', '⏰ Нагадаю о {time}: "{text}"', { time, text }));
    return true;
  }

  if (action === 'delete_reminder') {
    // B-126 fix MPVly 05.05: AI викликає при коригуванні часу свіжого reminder.
    // Шукаємо у nm_reminders за text (нечіткий) + опційно time/date для уточнення.
    // Cleanup трисховищний: nm_reminders + nm_events (за reminderId) + nm_inbox (за reminderId).
    const qText = (parsed.text || '').trim().toLowerCase();
    const qTime = parsed.time || null;
    const qDate = parsed.date || null;
    if (!qText && !qTime && !qDate) { addMsg('agent', t('habits.reminder.del.unclear', 'Не зрозумів яке нагадування видалити.')); return true; }

    const reminders = getReminders();
    // MPVly 05.05 follow-up: 3-рівневий fuzzy match для опечаток.
    // 1) substring (швидко) → 2) Levenshtein ≤2 для слів ≥5 літер (опечатки) →
    // 3) ні те, ні те — пропускаємо.
    // Кейс: AI зберіг "поприбрати" (опечатка), юзер каже "поприбирати" — distance=1.
    const _textMatch = (rText) => {
      if (!qText) return true;
      if (rText.includes(qText) || qText.includes(rText)) return true;
      if (qText.length >= 5 && rText.length >= 5) {
        const dist = levenshtein(qText, rText);
        if (dist <= 2) return true;
      }
      return false;
    };
    const idx = reminders.findIndex(r => {
      const rText = (r.text || '').toLowerCase();
      const tMatch = _textMatch(rText);
      const timeMatch = !qTime || r.time === qTime;
      const dateMatch = !qDate || r.date === qDate;
      return tMatch && timeMatch && dateMatch;
    });
    if (idx === -1) {
      const atTime = qTime ? t('habits.reminder.del.at_time', ' на {time}', { time: qTime }) : '';
      addMsg('agent', t('habits.reminder.del.not_found', 'Не знайшов нагадування "{text}"{atTime}.', { text: parsed.text || '', atTime }));
      return true;
    }

    const removed = reminders[idx];
    const reminderId = removed.id;
    reminders.splice(idx, 1);
    saveReminders(reminders);

    // nm_events — видаляємо event пов'язаний з reminder (id+1 або поле reminderId)
    try {
      const events = getEvents();
      const eventsRest = events.filter(e => e.reminderId !== reminderId && e.id !== reminderId + 1);
      // 64CXo: saveEvents() замість прямого setItem — диспатч nm-data-changed
      // потрібний для board re-render, інакше OWL не дізнається що подія зникла.
      if (eventsRest.length !== events.length) saveEvents(eventsRest);
    } catch(e) {}

    // nm_inbox — видаляємо картку (id+2 або поле reminderId)
    try {
      const inbox = getInbox();
      const inboxRest = inbox.filter(it => it.reminderId !== reminderId && it.id !== reminderId + 2);
      if (inboxRest.length !== inbox.length) saveInbox(inboxRest);
    } catch(e) {}

    try { renderInbox(); } catch(e) {}
    window.dispatchEvent(new CustomEvent('nm-data-changed', { detail: 'reminder' }));
    addMsg('agent', t('habits.reminder.del.ok', '🗑️ Видалив нагадування "{text}" о {time}.', { text: removed.text, time: removed.time }));
    return true;
  }

  // db0YY 12.05: B-174 fix — undo cases для tools що раніше жили ТIЛЬКИ у
  // tool-dispatcher.js direct handlers. action-undo через DI кличе сюди →
  // ці cases дозволяють universal undo для save_finance / create_health_card /
  // add_allergy не падати silent false.

  if (action === 'delete_transaction') {
    const txId = parsed.id;
    if (!txId) { addMsg('agent', t('habits.tx.del.no_id', 'Не зрозумів яку транзакцію видалити.')); return true; }
    const txs = getFinance();
    const idx = txs.findIndex(t => String(t.id) === String(txId));
    if (idx === -1) { addMsg('agent', t('habits.tx.del.not_found', 'Не знайшов транзакцію.')); return true; }
    const removed = txs[idx];
    txs.splice(idx, 1);
    saveFinance(txs);
    try { addToTrash('finance', removed); } catch(e) {}
    if (currentTab === 'finance') renderFinance();
    addMsg('agent', t('habits.tx.del.ok', '🗑️ Видалив транзакцію.'));
    return true;
  }

  if (action === 'delete_health_card') {
    if (!parsed.card_id) { addMsg('agent', t('habits.health_card.del.no_id', 'Не зрозумів яку картку видалити.')); return true; }
    const ok = deleteHealthCardProgrammatic(parsed.card_id);
    if (ok) addMsg('agent', t('habits.health_card.del.ok', '🗑️ Картку видалено.'));
    else addMsg('agent', t('habits.health_card.del.not_found', 'Не знайшов картку.'));
    return true;
  }

  if (action === 'delete_allergy') {
    if (!parsed.allergy_id) { addMsg('agent', t('habits.allergy.del.no_id', 'Не зрозумів яку алергію видалити.')); return true; }
    const ok = deleteAllergy(parsed.allergy_id);
    if (ok) addMsg('agent', t('habits.allergy.del.ok', '🗑️ Алергію видалено.'));
    else addMsg('agent', t('habits.allergy.del.not_found', 'Не знайшов алергію.'));
    return true;
  }

  if (action === 'delete_medication') {
    // nliW8 13.05: case у processUniversalAction обов'язковий для DI flow undo
    // (executeReverse шле сюди через action-undo.js, не у tool-dispatcher direct).
    // Урок B-174 — без цього case reverser add_medication → silent fail.
    if (!parsed.card_id || !parsed.med_id) { addMsg('agent', t('habits.medication.del.no_id', 'Не зрозумів який препарат видалити.')); return true; }
    const ok = deleteMedicationFromCard(parsed.card_id, parsed.med_id);
    if (ok) addMsg('agent', t('habits.medication.del.ok', '🗑️ Препарат видалено.'));
    else addMsg('agent', t('habits.medication.del.not_found', 'Не знайшов препарат.'));
    return true;
  }

  return false;
}
