// ============================================================
// evening-actions.js — Автосинхронізація дій Вечора через tool calling
// ============================================================
// Фаза 7 Вечора 2.0 (план → docs/EVENING_2.0_PLAN.md).
//
// Коли юзер у чаті Вечора каже "завтра зустріч з Андрієм о 15", OpenAI
// tool calling повертає msg.tool_calls = [{name:'create_event', args:{...}}].
// dispatchEveningTool(name, args) виконує дію НАПРЯМУ через save-функції
// модулів — без side-effect у Inbox (на відміну від inbox.js processSaveAction
// який створює Inbox-картку). Verify Loop повідомлення приходить з msg.content
// (правило промпту EVENING_CHAT_SYSTEM), dispatcher лише виконує + повертає
// { ok: bool, err?: string }.
//
// Підтримує основні tools: save_task, save_note, save_moment, create_event,
// save_finance, save_habit, complete_task, complete_habit, edit_task,
// edit_event, edit_note, edit_habit, delete_task, delete_event, delete_habit,
// set_reminder, save_memory_fact, reopen_task, add_step, update_transaction,
// move_note, restore_deleted.
//
// Здоров'я tools / категорії Фінансів / UI tools — не підключено у Вечорі
// наразі (не пріоритет для вечірнього ритуалу), легко додати пізніше.
// ============================================================

import { getTasks, saveTasks, renderTasks } from './tasks.js';
import { getHabits, saveHabits, getHabitLog, saveHabitLog, renderHabits, renderProdHabits } from './habits.js';
import { getNotes, saveNotes, addNoteFromInbox, renderNotes } from './notes.js';
import { getEvents, saveEvents } from './calendar.js';
import { getFinance, saveFinance, renderFinance } from './finance.js';
import { saveMoments, getMoments } from './evening.js';
import { addFact } from '../ai/memory.js';
import { addToTrash, restoreFromTrash, getTrash } from '../core/trash.js';
import { currentTab } from '../core/nav.js';
import { logRecentAction } from '../core/utils.js';

// Головний dispatcher. Приймає OpenAI tool call ім'я + args → виконує дію
// через save-функції модулів. Повертає { ok: true } або { ok: false, err }.
// AI пише Verify Loop текст у msg.content сам (правило промпту).
export function dispatchEveningTool(name, args) {
  try {
    switch (name) {
      // ========== СТВОРЕННЯ ==========
      case 'save_task': {
        const tasks = getTasks();
        const newTask = {
          id: Date.now(),
          title: args.title || args.text || 'Задача',
          desc: (args.text && args.text !== args.title) ? args.text : '',
          steps: Array.isArray(args.steps) ? args.steps.map(s => ({ id: Date.now() + Math.random(), text: s, done: false })) : [],
          status: 'active',
          createdAt: Date.now(),
        };
        if (args.due_date) newTask.dueDate = args.due_date;
        if (args.priority && ['normal','important','critical'].includes(args.priority)) newTask.priority = args.priority;
        tasks.unshift(newTask);
        saveTasks(tasks);
        renderTasks();
        logRecentAction('save_task', newTask.title, 'evening');
        return { ok: true };
      }
      case 'save_note': {
        addNoteFromInbox(args.text || '', 'note', args.folder || 'Щоденник', 'evening');
        if (currentTab === 'notes') renderNotes();
        logRecentAction('save_note', (args.text || '').slice(0, 40), 'evening');
        return { ok: true };
      }
      case 'save_moment': {
        const moments = getMoments();
        moments.push({ id: Date.now(), text: args.text || '', mood: args.mood || 'neutral', ts: Date.now() });
        saveMoments(moments);
        logRecentAction('save_moment', (args.text || '').slice(0, 40), 'evening');
        return { ok: true };
      }
      case 'save_habit': {
        const habits = getHabits();
        habits.unshift({ id: Date.now(), name: args.name, details: args.details || '', days: Array.isArray(args.days) ? args.days : [0,1,2,3,4,5,6], targetCount: args.target_count || 1, type: 'build', createdAt: Date.now() });
        saveHabits(habits);
        renderHabits();
        return { ok: true };
      }
      case 'create_event': {
        const events = getEvents();
        events.unshift({ id: Date.now(), title: args.title || 'Подія', date: args.date, time: args.time || null, priority: args.priority || 'normal', createdAt: Date.now() });
        saveEvents(events);
        logRecentAction('create_event', args.title || '', 'evening');
        return { ok: true };
      }
      case 'save_finance': {
        const txs = getFinance();
        txs.unshift({
          id: Date.now(),
          type: args.fin_type === 'income' ? 'income' : 'expense',
          amount: parseFloat(args.amount) || 0,
          category: args.category || 'Інше',
          comment: args.fin_comment || '',
          ts: args.date ? new Date(args.date + 'T12:00:00').getTime() : Date.now(),
        });
        saveFinance(txs);
        if (currentTab === 'finance') renderFinance();
        return { ok: true };
      }
      case 'set_reminder': {
        // MVP: reminder як подія у календарі. Повна реалізація Динамічного
        // розпорядку + push-нотифікацій — окрема фіча у ROADMAP.
        const events = getEvents();
        const dateISO = args.date || new Date().toISOString().slice(0, 10);
        events.unshift({ id: Date.now(), title: '⏰ ' + (args.text || 'Нагадування'), date: dateISO, time: args.time || null, priority: 'important', createdAt: Date.now() });
        saveEvents(events);
        return { ok: true };
      }
      case 'save_memory_fact': {
        addFact(args.fact || '', args.category || 'context', args.ttl_days || null);
        return { ok: true };
      }

      // ========== ВИКОНАННЯ ==========
      case 'complete_task': {
        const tasks = getTasks();
        const ids = Array.isArray(args.task_ids) ? args.task_ids : [];
        ids.forEach(id => {
          const idx = tasks.findIndex(t => t.id === id);
          if (idx !== -1) {
            tasks[idx] = { ...tasks[idx], status: 'done', completedAt: Date.now(), updatedAt: Date.now() };
          }
        });
        saveTasks(tasks);
        renderTasks();
        return { ok: true };
      }
      case 'complete_habit': {
        const log = getHabitLog();
        const today = new Date().toDateString();
        if (!log[today]) log[today] = {};
        const ids = Array.isArray(args.habit_ids) ? args.habit_ids : [];
        ids.forEach(id => { log[today][id] = (log[today][id] || 0) + 1; });
        saveHabitLog(log);
        renderHabits();
        renderProdHabits();
        return { ok: true };
      }

      // ========== РЕДАГУВАННЯ ==========
      case 'edit_task': {
        const tasks = getTasks();
        const idx = tasks.findIndex(t => t.id === args.task_id);
        if (idx === -1) return { ok: false, err: 'task not found' };
        if (args.title) tasks[idx].title = args.title;
        if (args.due_date) tasks[idx].dueDate = args.due_date;
        if (args.priority) tasks[idx].priority = args.priority;
        tasks[idx].updatedAt = Date.now();
        saveTasks(tasks);
        renderTasks();
        return { ok: true };
      }
      case 'edit_event': {
        const events = getEvents();
        const idx = events.findIndex(e => e.id === args.event_id);
        if (idx === -1) return { ok: false, err: 'event not found' };
        if (args.title) events[idx].title = args.title;
        if (args.date) events[idx].date = args.date;
        if (args.time !== undefined) events[idx].time = args.time;
        if (args.priority) events[idx].priority = args.priority;
        saveEvents(events);
        return { ok: true };
      }
      case 'edit_note': {
        const notes = getNotes();
        const idx = notes.findIndex(n => n.id === args.note_id);
        if (idx === -1) return { ok: false, err: 'note not found' };
        if (args.text) notes[idx].text = args.text;
        if (args.folder) notes[idx].folder = args.folder;
        saveNotes(notes);
        if (currentTab === 'notes') renderNotes();
        return { ok: true };
      }
      case 'edit_habit': {
        const habits = getHabits();
        const idx = habits.findIndex(h => h.id === args.habit_id);
        if (idx === -1) return { ok: false, err: 'habit not found' };
        if (args.name) habits[idx].name = args.name;
        if (Array.isArray(args.days)) habits[idx].days = args.days;
        if (args.details) habits[idx].details = args.details;
        saveHabits(habits);
        renderHabits();
        return { ok: true };
      }
      case 'reopen_task': {
        const tasks = getTasks();
        const idx = tasks.findIndex(t => t.id === args.task_id);
        if (idx === -1) return { ok: false, err: 'task not found' };
        tasks[idx] = { ...tasks[idx], status: 'active', completedAt: null, updatedAt: Date.now() };
        saveTasks(tasks);
        renderTasks();
        return { ok: true };
      }
      case 'add_step': {
        const tasks = getTasks();
        const idx = tasks.findIndex(t => t.id === args.task_id);
        if (idx === -1) return { ok: false, err: 'task not found' };
        if (!Array.isArray(tasks[idx].steps)) tasks[idx].steps = [];
        (args.steps || []).forEach(s => tasks[idx].steps.push({ id: Date.now() + Math.random(), text: s, done: false }));
        saveTasks(tasks);
        renderTasks();
        return { ok: true };
      }
      case 'move_note': {
        const notes = getNotes();
        const q = (args.query || '').toLowerCase();
        const idx = notes.findIndex(n => (n.text || '').toLowerCase().includes(q) || (n.title || '').toLowerCase().includes(q));
        if (idx === -1) return { ok: false, err: 'note not found' };
        notes[idx].folder = args.folder;
        saveNotes(notes);
        if (currentTab === 'notes') renderNotes();
        return { ok: true };
      }
      case 'update_transaction': {
        const txs = getFinance();
        const idx = txs.findIndex(t => t.id === args.id);
        if (idx === -1) return { ok: false, err: 'tx not found' };
        if (args.category) txs[idx].category = args.category;
        if (args.amount) txs[idx].amount = parseFloat(args.amount);
        if (args.comment !== undefined) txs[idx].comment = args.comment;
        saveFinance(txs);
        if (currentTab === 'finance') renderFinance();
        return { ok: true };
      }

      // ========== ВИДАЛЕННЯ ==========
      case 'delete_task': {
        const tasks = getTasks();
        const idx = tasks.findIndex(t => t.id === args.task_id);
        if (idx === -1) return { ok: false, err: 'task not found' };
        addToTrash('task', tasks[idx]);
        tasks.splice(idx, 1);
        saveTasks(tasks);
        renderTasks();
        return { ok: true };
      }
      case 'delete_event': {
        const events = getEvents();
        const idx = events.findIndex(e => e.id === args.event_id);
        if (idx === -1) return { ok: false, err: 'event not found' };
        addToTrash('event', events[idx]);
        events.splice(idx, 1);
        saveEvents(events);
        return { ok: true };
      }
      case 'delete_habit': {
        const habits = getHabits();
        const idx = habits.findIndex(h => h.id === args.habit_id);
        if (idx === -1) return { ok: false, err: 'habit not found' };
        addToTrash('habit', habits[idx]);
        habits.splice(idx, 1);
        saveHabits(habits);
        renderHabits();
        return { ok: true };
      }
      case 'restore_deleted': {
        const q = (args.query || '').trim().toLowerCase();
        const trash = getTrash().filter(t => Date.now() - t.deletedAt < 7 * 24 * 60 * 60 * 1000);
        const filtered = args.type ? trash.filter(t => t.type === args.type) : trash;
        if (q === 'all') {
          filtered.forEach(t => restoreFromTrash(t.deletedAt));
          return { ok: true };
        }
        if (q === 'last') {
          if (filtered.length > 0) restoreFromTrash(filtered[0].deletedAt);
          return { ok: true };
        }
        const hit = filtered.find(t => JSON.stringify(t.data || t).toLowerCase().includes(q));
        if (hit) { restoreFromTrash(hit.deletedAt); return { ok: true }; }
        return { ok: false, err: 'not found in trash' };
      }

      default:
        return { ok: false, err: 'unknown tool: ' + name };
    }
  } catch (e) {
    console.warn('[dispatchEveningTool]', name, e);
    return { ok: false, err: e.message };
  }
}
