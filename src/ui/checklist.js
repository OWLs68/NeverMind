// ============================================================
// checklist.js — спільний рендер чеклісту (прогрес-бар + квадратики)
//
// Винесено з tasks.js (v3pexs) щоб задачі (task.steps) і списки (list.items)
// ділили ОДИН рендер — DRY, запобігає розходженню вигляду галочок між фічами.
// Параметризується через opts: який data-action на тап + назви id-атрибутів.
//
// Форма елемента: { id, text, done }. Повертає HTML-рядок (порожній якщо нема items).
// ============================================================

import { escapeHtml } from '../core/utils.js';

// items — масив {id, text, done}. opts:
//   tapAction  — data-tap-action для рядка (toggle-task-step / toggle-list-item)
//   entityAttr — назва атрибута сутності-власника (data-task-id / data-list-id)
//   entityId   — значення id власника
//   itemAttr   — назва атрибута пункту (data-step-id / data-item-id)
export function renderChecklist(items, opts = {}) {
  const {
    tapAction = 'toggle-list-item',
    entityAttr = 'data-list-id',
    entityId = '',
    itemAttr = 'data-item-id',
  } = opts;
  const list = Array.isArray(items) ? items : [];
  if (list.length === 0) return '';
  const doneCount = list.filter(s => s.done).length;
  const pct = Math.round(doneCount / list.length * 100);
  return `
    <div style="height:3px;background:rgba(0,0,0,0.06);border-radius:3px;overflow:hidden;margin-bottom:8px">
      <div style="height:100%;width:${pct}%;background:linear-gradient(90deg,#f97316,#ea580c);border-radius:3px;transition:width 0.3s"></div>
    </div>
    <div style="display:flex;flex-direction:column;gap:5px;margin-bottom:10px">
      ${list.map(s => `
        <div data-step-check="1" data-tap-detect data-tap-action="${tapAction}" ${entityAttr}="${entityId}" ${itemAttr}="${s.id}" style="display:flex;align-items:center;gap:10px;cursor:pointer;padding:4px 0">
          <div style="width:24px;height:24px;border-radius:7px;border:1.5px solid ${s.done ? '#ea580c' : 'rgba(30,16,64,0.18)'};background:rgba(255,255,255,0.6);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:13px;color:#ea580c">${s.done ? '✓' : ''}</div>
          <div style="flex:1;font-size:14px;color:rgba(30,16,64,0.65);${s.done ? 'text-decoration:line-through;opacity:0.4' : ''}">${escapeHtml(s.text)}</div>
        </div>
      `).join('')}
    </div>`;
}
