// === ACTION UNDO EXECUTOR (G3 myshu 11.05.2026) ===
// Виконує reverse-інструкцію з action-log запису.
//
// Два режими:
//   - 'tool_call' — викликає processUniversalAction (як ніби AI запитав delete_X)
//   - 'restore_snapshot' — пряма перезапис localStorage + dispatch nm-data-changed
//
// API: executeReverse(reverseInstr, dispatchFn) → boolean (true якщо успіх)
//
// dispatchFn — `processUniversalAction` передається через DI щоб закрити
// циклічну залежність inbox ↔ action-undo ↔ habits ↔ inbox (db0YY 12.05).
// Раніше action-undo робив прямий `import processUniversalAction` — це
// створювало ESM-цикл який міг зависати на iOS Safari cold start (R1 з
// docs/ARCHITECTURE_REFACTOR.md). Тепер action-undo PURE — не залежить
// від tabs/habits, caller передає виконавця.
//
// Виклик з `inbox.js restore_deleted` handler і `tool-dispatcher.js` —
// обидва вже мають `processUniversalAction` у scope.

export function executeReverse(reverse, dispatchFn) {
  if (!reverse || typeof reverse !== 'object') return false;

  if (reverse.type === 'tool_call') {
    if (!reverse.tool) return false;
    if (typeof dispatchFn !== 'function') {
      console.warn('[action-undo] tool_call reverse needs dispatchFn (DI)', reverse);
      return false;
    }
    const action = { action: reverse.tool, ...(reverse.args || {}) };
    // silent — undo не пише власне повідомлення, caller дає summary
    try {
      const noopAddMsg = () => {};
      return !!dispatchFn(action, '', noopAddMsg);
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
