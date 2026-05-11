// === ACTION UNDO EXECUTOR (G3 myshu 11.05.2026) ===
// Виконує reverse-інструкцію з action-log запису.
//
// Два режими:
//   - 'tool_call' — викликає processUniversalAction (як ніби AI запитав delete_X)
//   - 'restore_snapshot' — пряма перезапис localStorage + dispatch nm-data-changed
//
// API: executeReverse(reverseInstr) → boolean (true якщо успіх)
//
// Виклик з `inbox.js restore_deleted` handler (Phase 1E) — коли юзер каже
// «відміни останню дію» і top of action-log новіший за top of nm_trash.

import { processUniversalAction } from '../tabs/habits.js';

export function executeReverse(reverse) {
  if (!reverse || typeof reverse !== 'object') return false;

  if (reverse.type === 'tool_call') {
    if (!reverse.tool) return false;
    const action = { action: reverse.tool, ...(reverse.args || {}) };
    // silent — undo не пише власне повідомлення, caller дає summary
    try {
      const noopAddMsg = () => {};
      return !!processUniversalAction(action, '', noopAddMsg);
    } catch (e) {
      console.warn('[action-undo] tool_call reverse failed', reverse, e);
      return false;
    }
  }

  if (reverse.type === 'restore_snapshot') {
    if (!reverse.storage || !reverse.value) return false;
    try {
      const current = JSON.parse(localStorage.getItem(reverse.storage) || '{}');
      // Object.assign — мерж знімка у поточний стан. Для arrays (типу nm_tasks)
      // це НЕ працюватиме (поточний дизайн знімків — лише keyed-objects типу
      // nm_routine{tue:[],thu:[]}). Phase 2 розширить на array-snapshots.
      if (Array.isArray(current) || Array.isArray(reverse.value)) {
        // Phase 2 — повний array overwrite
        localStorage.setItem(reverse.storage, JSON.stringify(reverse.value));
      } else {
        Object.assign(current, reverse.value);
        localStorage.setItem(reverse.storage, JSON.stringify(current));
      }
      // Dispatch для cross-tab re-render (canonical pattern для NeverMind)
      window.dispatchEvent(new CustomEvent('nm-data-changed', {
        detail: reverse.detail || reverse.storage
      }));
      return true;
    } catch (e) {
      console.warn('[action-undo] snapshot reverse failed', reverse, e);
      return false;
    }
  }

  return false;
}
