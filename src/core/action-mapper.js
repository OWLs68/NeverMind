// === ACTION MAPPER (Сесія 4-mini Architecture Refactor — db0YY 12.05.2026) ===
// Pure-функція: tool-call name + args → масив universal-actions для processUniversalAction.
//
// Чому винесено з tool-dispatcher.js:
//   - Pure switch без AI/DOM/storage залежностей — належить data-layer.
//   - Готує грунт для Сесії 4 (execute-action.js) щоб уникнути циклічної
//     залежності execute-action ↔ tool-dispatcher (action-mapper тут — у core/,
//     execute-action теж буде у core/, обидва pure).
//   - Strangler pattern: tool-dispatcher.js далі ре-експортує під старим ім'ям
//     `_toolCallToUniversalAction` щоб НЕ ламати habits.js коментар і потенційні
//     зовнішні імпорти. Можна прибрати при наступному cleanup.
//
// API:
//   toolCallToAction(name, args) → Array<{action, ...args}>
//   Повертає [] якщо tool невідомий (default case).

export function toolCallToAction(name, args) {
  switch (name) {
    case 'save_task':
      return [{ action: 'create_task', title: args.title, desc: args.text, steps: args.steps || [], dueDate: args.due_date, priority: args.priority }];
    case 'save_note':
      return [{ action: 'create_note', text: args.text, folder: args.folder }];
    case 'save_list':
      return [{ action: 'create_list', title: args.title, items: Array.isArray(args.items) ? args.items : [] }];
    case 'delete_list':
      return [{ action: 'delete_list', list_id: args.list_id }];
    case 'save_habit':
      return [{ action: 'create_habit', name: args.name, details: args.details, days: args.days, target_count: args.target_count }];
    case 'save_moment':
      return [{ action: 'add_moment', text: args.text, mood: args.mood, date: args.date }];
    case 'create_event':
      return [{ action: 'create_event', title: args.title, date: args.date, time: args.time || null, priority: args.priority || 'normal' }];
    case 'save_finance':
      return [{ action: 'save_finance', fin_type: args.fin_type, amount: args.amount, category: args.category, subcategory: args.subcategory, fin_comment: args.fin_comment, date: args.date }];
    case 'complete_task': {
      const ids = Array.isArray(args.task_ids) ? args.task_ids : [];
      return ids.map(id => ({ action: 'complete_task', task_id: id }));
    }
    case 'complete_habit': {
      const ids = Array.isArray(args.habit_ids) ? args.habit_ids : [];
      return ids.map(id => ({ action: 'complete_habit', habit_id: id }));
    }
    case 'edit_task':
      return [{ action: 'edit_task', task_id: args.task_id, title: args.title, dueDate: args.due_date, priority: args.priority }];
    case 'edit_habit':
      return [{ action: 'edit_habit', habit_id: args.habit_id, name: args.name, days: args.days, details: args.details }];
    case 'edit_event':
      return [{ action: 'edit_event', event_id: args.event_id, title: args.title, date: args.date, time: args.time, priority: args.priority }];
    case 'edit_note':
      return [{ action: 'edit_note', note_id: args.note_id, text: args.text, folder: args.folder }];
    case 'delete_task':
      return [{ action: 'delete_task', task_id: args.task_id }];
    case 'delete_habit':
      return [{ action: 'delete_habit', habit_id: args.habit_id }];
    case 'delete_project':
      return [{ action: 'delete_project', project_id: args.project_id, project_name: args.project_name }];
    case 'delete_event':
      return [{ action: 'delete_event', event_id: args.event_id }];
    case 'delete_folder':
      return [{ action: 'delete_folder', folder: args.folder }];
    case 'reopen_task':
      return [{ action: 'reopen_task', task_id: args.task_id }];
    case 'add_step': {
      const steps = Array.isArray(args.steps) ? args.steps : [];
      return steps.map(s => ({ action: 'add_step', task_id: args.task_id, step: s }));
    }
    case 'complete_step':
      return [{ action: 'complete_step', task_id: args.task_id, step_text: args.step_text }];
    case 'merge_tasks':
      return [{ action: 'merge_tasks', from_task_id: args.from_task_id, to_task_id: args.to_task_id }];
    case 'move_note':
      return [{ action: 'move_note', query: args.query, folder: args.folder }];
    case 'set_reminder':
      return [{ action: 'set_reminder', time: args.time, text: args.text, date: args.date }];
    case 'delete_reminder':
      return [{ action: 'delete_reminder', text: args.text, time: args.time, date: args.date }];
    case 'save_routine':
      return [{ action: 'save_routine', day: args.day, blocks: args.blocks }];
    case 'show_monthly_summary':
      return [{ action: 'show_monthly_summary', comment: args.comment }];
    default:
      return [];
  }
}
