// === EVENT DELEGATION (DGH6F 16.05.2026) ===
// Один listener на document.body → дивиться на data-action атрибут найближчого
// клікабельного предка → викликає зареєстрований handler. Альтернатива inline
// onclick — підготовка до strict CSP `script-src 'self'` без 'unsafe-inline'
// (BLOCKER #1 у ROADMAP Security Hardening).
//
// КОНТРАКТ HTML:
//   <button data-action="open-settings">⚙️</button>
//   <button data-action="open-help" data-tab="inbox">?</button>
//   <li data-action="open-task" data-id="550e8400-...">Task</li>
//
// Особливості:
//   - UUID-immune: data-id читається як string через el.dataset.id, без eval'у
//     як було у `onclick="openTask(${id})"` (клас бага B-108/B-170).
//   - closest('[data-action]') — клік на вкладеному елементі знаходить
//     батьківський з data-action.
//   - data-action="" або undefined у registry → silent skip без помилки.
//
// КОНТРАКТ JS:
//   import { reg } from './core/delegation.js';
//   reg('open-task', (data, el, e) => openTask(data.id));
//
// Існуючі delegation patterns у проекті (читати як приклади):
//   - chips.js:356 (closest('.owl-chip'))
//   - nav.js:649 (tab-item drum capsule)
//   - habits.js:239 (document-level)

const ACTIONS = Object.create(null);

// Реєструє handler для `data-action="name"`. Викликається з tabs/modules.
// fn signature: (dataset, el, ev) => void. dataset — DOMStringMap з data-* атрибутів.
export function reg(name, fn) {
  if (typeof name !== 'string' || !name) return;
  if (typeof fn !== 'function') return;
  ACTIONS[name] = fn;
}

// Один listener на body. Викликається з boot.js init() ПIСЛЯ DOMContentLoaded.
export function initDelegation() {
  if (typeof document === 'undefined') return;
  document.body.addEventListener('click', _handleClick);
}

function _handleClick(e) {
  const el = e.target && e.target.closest ? e.target.closest('[data-action]') : null;
  if (!el) return;
  const action = el.dataset.action;
  if (!action) return;
  const fn = ACTIONS[action];
  if (!fn) return; // silent — невідома action ≠ помилка (може бути просто ще не зарегано)
  try {
    fn(el.dataset, el, e);
  } catch (err) {
    console.error('[delegation] action «' + action + '» handler failed:', err);
  }
}

// === Базові header actions (статичні з самого boot, не потребують lazy reg) ===
// Решта реєструються у відповідних tab-модулях коли вони ініціалізуються.
reg('open-settings', () => {
  if (typeof window !== 'undefined' && typeof window.openSettings === 'function') {
    window.openSettings();
  }
});
reg('open-help', (data) => {
  if (typeof window !== 'undefined' && typeof window.openHelp === 'function') {
    window.openHelp(data.tab || 'inbox');
  }
});
// switch-tab — універсальний для будь-якої навігації між 8 вкладками.
// data-tab="projects" / "tasks" / "inbox" etc.
reg('switch-tab', (data) => {
  if (typeof window !== 'undefined' && typeof window.switchTab === 'function') {
    window.switchTab(data.tab);
  }
});
