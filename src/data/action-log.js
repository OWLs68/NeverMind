// === ACTION LOG (G3 myshu 11.05.2026) ===
// Журнал AI-дій з reverse-instructions для undo.
//
// Призначення: коли юзер каже «відміни / скасуй / верни», AI читає top of log,
// бере поле `reverse` (готова tool_call для протилежної дії) і виконує її.
//
// Архітектура (pure functions, Supabase-ready):
//   - Сховище: localStorage `nm_action_log` (масив, max 50, 7 днів TTL)
//   - UUID id, ISO 8601 ts — узгоджено з DATA_SCHEMA.md цільовим форматом
//   - Поля для майбутньої Supabase міграції: user_id (null зараз) + device_id
//   - schema_version для еволюції args-формату без переписування старих записів
//
// API:
//   appendActionLog({source, tool, args, result, reverse, summary}) — пише запис
//   getActionLog() — масив (десериалізує + cleanup TTL)
//   readLastReversible() — повертає top of log де reversed=false
//   markReversed(id) — позначає запис відміненим
//   getRecent(n) — последние N для UI Кошика
//
// Не зачіпає `nm_trash` (існуючий кеш delete-дій). Два сховища тимчасово.
// Після Supabase обидва переїдуть у єдину табл `agent_actions`.

import { generateUUID } from '../core/uuid.js';
import { reversible, needsSnapshot, getSnapshotStorage, buildReverse, summarize } from './action-reversers.js';

const KEY = 'nm_action_log';
const MAX = 50;
const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 днів — узгоджено з nm_trash
const SCHEMA_VERSION = 1;

// Поточний device_id — генерується один раз, lazy. Готує multi-device sync.
function _getDeviceId() {
  let id = localStorage.getItem('nm_device_id');
  if (!id) {
    id = generateUUID();
    localStorage.setItem('nm_device_id', id);
  }
  return id;
}

// Десериалізація з cleanup TTL і обмеженням розміру (за один прохід).
export function getActionLog() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '[]');
    const cutoff = Date.now() - TTL_MS;
    const fresh = raw.filter(e => {
      const ts = typeof e.ts === 'string' ? new Date(e.ts).getTime() : (e.ts || 0);
      return ts >= cutoff;
    });
    return fresh.slice(-MAX);
  } catch {
    return [];
  }
}

// Пише новий запис. Параметри:
//   source: 'inbox' | 'tasks' | 'me' | 'notes' | 'health' | 'finance' | 'projects' | 'evening' | 'me'
//   tool: назва forward-tool (з G4 трансформацією — actual виконаний tool)
//   args: args з якими виконався tool (post-G4-transform)
//   result: { id?, type?, affected? } — capture новостворених id (для reverser)
//   reverse: { tool, args } — готова reverse-команда (null якщо нереверсиво)
//   summary: 1-фраза для UI Кошика («Купити хліб», «Бігати 18:00 вт/чт/сб»)
export function appendActionLog({ source, tool, args, result, reverse, summary }) {
  const log = getActionLog();
  log.push({
    id: generateUUID(),
    ts: new Date().toISOString(),
    schema_version: SCHEMA_VERSION,
    user_id: null,         // Supabase-ready: auth.uid() після міграції
    device_id: _getDeviceId(),
    source: source || 'unknown',
    tool,
    args: args || {},
    result: result || null,
    reverse: reverse || null,  // null = нереверсиво (інформаційний запис)
    summary: summary || tool,
    reversed: false,
  });
  // Тримаємо тільки MAX останніх
  while (log.length > MAX) log.shift();
  try {
    localStorage.setItem(KEY, JSON.stringify(log));
  } catch (e) {
    // QuotaExceededError: спробувати урізати ще і записати
    console.warn('[action-log] quota exceeded, trimming aggressively', e);
    const trimmed = log.slice(-Math.floor(MAX / 2));
    try { localStorage.setItem(KEY, JSON.stringify(trimmed)); } catch {}
  }
}

// Повертає останній НЕвідмінений запис де є reverse. Null якщо нема що скасовувати.
export function readLastReversible() {
  const log = getActionLog();
  for (let i = log.length - 1; i >= 0; i--) {
    if (!log[i].reversed && log[i].reverse) return log[i];
  }
  return null;
}

// Позначає запис як відмінений (щоб undo не зробив дубль).
export function markReversed(id) {
  const log = getActionLog();
  const idx = log.findIndex(e => e.id === id);
  if (idx < 0) return false;
  log[idx].reversed = true;
  log[idx].reversedAt = new Date().toISOString();
  try {
    localStorage.setItem(KEY, JSON.stringify(log));
    return true;
  } catch {
    return false;
  }
}

// Останні N записів для UI Кошика (Налаштування). Включає reversed теж — щоб
// юзер бачив історію. Сортовано від нових до старих.
export function getRecent(n = 30) {
  return getActionLog().slice(-n).reverse();
}

// Очистка — для clearAllData() у settings.
export function clearActionLog() {
  localStorage.removeItem(KEY);
}

// ============================================================
// === HELPERS для dispatcher / inbox / evening-actions integration ===
// ============================================================
// Pure functions — викликаються з 3 dispatch-точок (Verifier P0-1):
// tool-dispatcher.js, inbox.js, evening-actions.js. Тут бо action-log.js —
// pure data модуль без AI/UI залежностей.

// Pre-call snapshot capture для destructive tools (save_routine, edit_*).
// Знімає тільки зачеплені поля (для save_routine — лише args.day, не весь nm_routine).
export function captureSnapshotBefore(name, args) {
  if (!needsSnapshot(name)) return null;
  const key = getSnapshotStorage(name);
  if (!key) return null;
  try {
    const full = JSON.parse(localStorage.getItem(key) || '{}');
    if (name === 'save_routine' && Array.isArray(args.day)) {
      const subset = {};
      args.day.forEach(d => { subset[d] = Array.isArray(full[d]) ? [...full[d]] : []; });
      return subset;
    }
    return full;
  } catch { return null; }
}

// Post-hoc capture ID нової сутності з localStorage (для tools що unshift/push).
const POST_ID_POSITIONS = {
  save_task:    { key: 'nm_tasks',    pos: 'first' },
  save_list:    { key: 'nm_lists',    pos: 'first' },
  save_finance: { key: 'nm_finance',  pos: 'first' },
  save_habit:   { key: 'nm_habits2',  pos: 'last' },
  create_event: { key: 'nm_events',   pos: 'last' },
};
export function capturePostResultId(name) {
  const spec = POST_ID_POSITIONS[name];
  if (!spec) return null;
  try {
    const arr = JSON.parse(localStorage.getItem(spec.key) || '[]');
    if (!Array.isArray(arr) || arr.length === 0) return null;
    const item = spec.pos === 'first' ? arr[0] : arr[arr.length - 1];
    return item?.id != null ? item.id : null;
  } catch { return null; }
}

// Post-call: пише запис у action-log якщо reverse можна побудувати.
// resultId опційний (None для snapshot-based reverses типу save_routine).
export function logAction(name, args, resultId, snapshotBefore, source) {
  if (!reversible(name)) return;
  const reverse = buildReverse(name, args, resultId != null ? { id: resultId } : null, snapshotBefore);
  if (!reverse) return;
  appendActionLog({
    source: source || 'dispatcher',
    tool: name,
    args,
    result: resultId != null ? { id: resultId } : null,
    reverse,
    summary: summarize(name, args),
  });
}

// Wrapper «один мозок» — capture snapshot ДО мутації, виконує fn(), пише
// action-log ПIСЛЯ. Один рядок інтеграції у кожному save-handler 3 dispatchers
// (tool-dispatcher.js, inbox.js, evening-actions.js).
//
// Використання:
//   withActionLog('save_finance', { fin_type, amount, ... }, () => {
//     txs.unshift(newTx); saveFinance(txs);
//   }, 'inbox');
//
// Безпечно для не-reversible tools: просто викличе fn() без логування.
// Якщо fn() throws — лог НЕ пишеться (catch on caller side).
export function withActionLog(name, args, mutateFn, source) {
  if (!reversible(name)) return mutateFn();
  const snap = captureSnapshotBefore(name, args);
  const result = mutateFn();
  if (snap != null) {
    logAction(name, args, null, snap, source);
  } else {
    const resultId = capturePostResultId(name);
    logAction(name, args, resultId, null, source);
  }
  return result;
}
