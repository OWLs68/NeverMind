// === ACTION REVERSERS (G3 myshu 11.05.2026) ===
// Pure builders: forward tool + args + result + snapshot_before → reverse instruction.
//
// 2 типи reverse (обидва обробляє undo handler):
//
//   Type A — tool_call reverse (для added-only tools: save_task, save_finance...)
//     { type:'tool_call', tool:'delete_task', args:{task_id:'<id>'} }
//     Виконання: dispatcher викликає processUniversalAction({action:tool, ...args})
//
//   Type B — snapshot restore (для destructive replace: save_routine, edit_X...)
//     { type:'restore_snapshot', storage:'nm_routine', value:{tue:[...], thu:[...]} }
//     Виконання: Object.assign існуючого storage + dispatch nm-data-changed
//
// Reverser приймає ТIЛЬКИ (args, result, snapshot_before) — без зовнішніх залежностей.
// Це робить модуль готовим до переїзду у Supabase Edge Function без переписування
// (CLAUDE.md правило 12 + Стратег Council).
//
// REVERSIBILITY:
//   reversible() — true якщо для цього tool є reverser
//   needsSnapshot() — true якщо reverser потребує snapshot_before (для capture у dispatcher)
//   buildReverse() — повертає reverse instruction або null

// Map: forward tool → reverser builder fn (args, result, snapshot) → reverse instr
const REVERSERS = {
  // === Type A: tool_call reverse (additive tools) ===

  save_task: (args, result) => result?.id
    ? { type: 'tool_call', tool: 'delete_task', args: { task_id: String(result.id) } }
    : null,

  save_list: (args, result) => result?.id
    ? { type: 'tool_call', tool: 'delete_list', args: { list_id: String(result.id) } }
    : null,

  save_finance: (args, result) => result?.id != null
    ? { type: 'tool_call', tool: 'delete_transaction', args: { id: result.id } }
    : null,

  save_habit: (args, result) => result?.id != null
    ? { type: 'tool_call', tool: 'delete_habit', args: { habit_id: result.id } }
    : null,

  create_event: (args, result) => result?.id != null
    ? { type: 'tool_call', tool: 'delete_event', args: { event_id: result.id } }
    : null,

  set_reminder: (args, result) => args?.text
    ? { type: 'tool_call', tool: 'delete_reminder', args: { text: args.text, time: args.time, date: args.date } }
    : null,

  // Health reversers ВИДАЛЕНО (EU AI Act compliance JMQuT 17.05.2026) —
  // create_health_card / add_allergy / add_medication більше не існують як AI tools.

  // === Type B: snapshot restore (destructive replace tools) ===

  save_routine: (args, result, snapshot) => snapshot
    ? { type: 'restore_snapshot', storage: 'nm_routine', value: snapshot, detail: 'routine' }
    : null,

  // edit_* — будуть додані у Phase 2 (потребують повного snapshot задачі/події)
};

// Які tools потребують snapshot для reverse (capture у dispatcher ДО виконання).
const NEEDS_SNAPSHOT = new Set([
  'save_routine',
  // 'edit_task', 'edit_event', 'edit_habit' — Phase 2
]);

// Які storage-keys треба знімати для snapshot (для NEEDS_SNAPSHOT tools).
// Reverser сам знає звідки читати — мапа тут для dispatcher щоб знати ЩО captureати.
const SNAPSHOT_STORAGE = {
  save_routine: 'nm_routine',
  // edit_task: 'nm_tasks', edit_event: 'nm_events', edit_habit: 'nm_habits2'
};

export function reversible(tool) {
  return tool in REVERSERS;
}

export function needsSnapshot(tool) {
  return NEEDS_SNAPSHOT.has(tool);
}

export function getSnapshotStorage(tool) {
  return SNAPSHOT_STORAGE[tool] || null;
}

// Будує reverse instruction. Повертає null якщо нереверсиво або бракує даних.
export function buildReverse(tool, args, result, snapshotBefore) {
  const builder = REVERSERS[tool];
  if (!builder) return null;
  try {
    return builder(args, result, snapshotBefore);
  } catch (e) {
    console.warn('[action-reversers] builder error for', tool, e);
    return null;
  }
}

// Гарне ім'я операції для UI Кошика. Юзер бачить «Купити хліб» а не «save_task».
export function summarize(tool, args) {
  switch (tool) {
    case 'save_task':     return `Задача: ${args?.title || args?.text || '?'}`;
    case 'save_finance':  return `${args?.fin_type === 'income' ? '+' : '−'}${args?.amount || '?'} ${args?.category || ''} ${args?.fin_comment || ''}`.trim();
    case 'save_habit':    return `Звичка: ${args?.name || '?'}`;
    case 'create_event':  return `Подія: ${args?.title || '?'}${args?.date ? ' · ' + args.date : ''}`;
    case 'set_reminder':  return `Нагадування: ${args?.text || '?'}${args?.time ? ' о ' + args.time : ''}`;
    case 'save_routine':  {
      const days = Array.isArray(args?.day) ? args.day.join('/') : '?';
      const firstBlock = args?.blocks?.[0];
      const blockDesc = firstBlock ? `${firstBlock.time} ${firstBlock.activity}` : '?';
      const total = args?.blocks?.length || 0;
      return `Розпорядок: ${blockDesc}${total > 1 ? ` +${total - 1}` : ''} (${days})`;
    }
    default: return tool;
  }
}
