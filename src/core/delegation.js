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
// close-parent — універсальний для кнопок-закриття tip/модалок які раніше
// робили `this.closest(selector).remove()` у inline onclick. У delegation
// `this` був би document.body, тому використовуємо el (другий параметр) +
// data-parent="#fv-tip" як CSS selector.
reg('close-parent', (data, el) => {
  const sel = data.parent;
  if (!sel || !el || typeof el.closest !== 'function') return;
  const parent = el.closest(sel);
  if (parent && typeof parent.remove === 'function') parent.remove();
});
// open-calendar — обгортка для window.openCalendarModal() (calendar.js export).
reg('open-calendar', () => {
  if (typeof window !== 'undefined' && typeof window.openCalendarModal === 'function') {
    window.openCalendarModal();
  }
});
// navigate-inbox-item — клік на картку у Inbox-стрічці. data-id уже на
// .inbox-item елементі (rendering inbox.js:316). Функція сама читає
// data-cat через getElementById всередині — нам тут тільки передати id.
reg('navigate-inbox-item', (data) => {
  if (!data.id) return;
  if (typeof window !== 'undefined' && typeof window.navigateInboxItem === 'function') {
    window.navigateInboxItem(data.id);
  }
});
// select-clarify-option — клік на опцію у clarify-модалці. data.idx —
// рядок ('0','1',...), треба явний parseInt (Pre-mortem 🔴 захист — без
// нього `clarifyParsed.options[idx]` могло б повести себе ненадійно).
reg('select-clarify-option', (data) => {
  if (typeof window !== 'undefined' && typeof window.selectClarifyOption === 'function') {
    const idx = parseInt(data.idx, 10);
    if (!Number.isNaN(idx)) window.selectClarifyOption(idx);
  }
});
// === Phase 1в-a (tasks.js) actions ===
// toggle-temp-step — checkbox для тимчасового крока у edit-модалці задачі.
reg('toggle-temp-step', (data) => {
  if (typeof window !== 'undefined' && typeof window.toggleTempStep === 'function') {
    window.toggleTempStep(data.id);
  }
});
// remove-temp-step — × кнопка для видалення тимчасового крока.
reg('remove-temp-step', (data) => {
  if (typeof window !== 'undefined' && typeof window.removeTempStep === 'function') {
    window.removeTempStep(data.id);
  }
});
// task-card-click — тап на картку задачі (відкриває edit). Передаємо event
// бо taskCardClick використовує event.target.closest для guard'а — не
// відкриває edit якщо клік був на checkbox задачі/крока.
reg('task-card-click', (data, el, ev) => {
  if (typeof window !== 'undefined' && typeof window.taskCardClick === 'function') {
    window.taskCardClick(data.id, ev);
  }
});
// toggle-entity-done — UNIVERSAL action для checkbox'ів «зроблено/не зроблено»
// на різних entity (task, habit, prod-habit). DRY Scanner пораду: ця action
// заміняє 8 inline handler'ів (2 у tasks.js + 6 у habits.js). Майбутній
// rollout: коли мігруємо habits.js — НЕ створюємо ще actions, використовуємо
// цей з data-entity="habit" / "habit-prod".
//
// Phase 1в-prep CSS `touch-action: manipulation` на [data-task-check] +
// [data-step-check] забезпечує fast-tap БЕЗ JS preventDefault — тому не
// потрібно дублювати preventDefault/stopPropagation у handler.
//
// stopPropagation теж не потрібен: delegation listener читає
// `closest('[data-action]')` ОДИН раз — task-card-click на батьківському НЕ
// triggered (closest повертає найближчий checkbox).
//
// ⚠️ ПРИ МIГРАЦIЇ habits.js: прибрати inline `event.stopPropagation()` зі
// старих onclick — у delegation він не потрібен і викликає подвійне
// спрацювання при змішаному стані (inline + data-action).
reg('toggle-entity-done', (data) => {
  if (typeof window === 'undefined') return;
  const entity = data.entity;
  const id = data.id;
  if (!entity || !id) return;
  const fnMap = {
    'task':       window.toggleTaskStatus,
    'habit':      window.toggleHabitToday,
    'habit-prod': window.toggleProdHabitToday,
  };
  const fn = fnMap[entity];
  if (typeof fn === 'function') fn(id);
});
// === Phase 1+ board.js actions ===
// toggle-owl-collapsed — клік на згорнутий OWL у tab-чаті щоб розгорнути.
reg('toggle-owl-collapsed', (data) => {
  if (typeof window !== 'undefined' && typeof window.toggleOwlTabChat === 'function') {
    window.toggleOwlTabChat(data.tab);
  }
});
// scroll-owl-chips — стрілки ‹/› для прокрутки горизонтальних chips у board.
// data-dir = '-1' (left) або '1' (right). parseInt захист бо рядок.
reg('scroll-owl-chips', (data) => {
  if (typeof window !== 'undefined' && typeof window.scrollOwlTabChips === 'function') {
    const dir = parseInt(data.dir, 10);
    if (!Number.isNaN(dir)) window.scrollOwlTabChips(data.tab, dir);
  }
});
// === Phase 1+ evening.js actions ===
// open-moment-view — тап на moment-картку (відкриває view модалку).
reg('open-moment-view', (data) => {
  if (typeof window !== 'undefined' && typeof window.openMomentView === 'function') {
    window.openMomentView(data.id);
  }
});
// delete-moment — × кнопка на moment-картці. Раніше було inline stopPropagation
// щоб не тригерити батьківський openMomentView. У delegation НЕ потрібно:
// closest('[data-action]') повертає найближчий = ×, open-moment-view на
// батьківському НЕ triggered (delegation один listener на body).
reg('delete-moment', (data) => {
  if (typeof window !== 'undefined' && typeof window.deleteMoment === 'function') {
    window.deleteMoment(data.id);
  }
});
// reschedule-task — UNIVERSAL для двох кнопок «На завтра» / «На тиждень».
// data-days="1" → tomorrow, data-days="7" → week. parseInt захист.
reg('reschedule-task', (data) => {
  if (typeof window === 'undefined') return;
  const days = parseInt(data.days, 10);
  if (days === 1 && typeof window.rescheduleTaskTomorrow === 'function') {
    window.rescheduleTaskTomorrow(data.id);
  } else if (days === 7 && typeof window.rescheduleTaskWeek === 'function') {
    window.rescheduleTaskWeek(data.id);
  }
});
// hold-quit-habit — «утримався» кнопка у quit-habit картці evening. Функція
// у habits.js (cross-file), доступна через window.X. renderEvening() викликали
// інлайн після — переносимо у handler.
reg('hold-quit-habit', (data) => {
  if (typeof window === 'undefined') return;
  if (typeof window.holdQuitHabit === 'function') window.holdQuitHabit(data.id);
  if (typeof window.renderEvening === 'function') window.renderEvening();
});
// confirm-quit-relapse — «зірвався» кнопка. setTimeout 50ms перед renderEvening
// зберігаємо (можливо потрібен для UI-flush стану confirmQuitRelapse).
reg('confirm-quit-relapse', (data) => {
  if (typeof window === 'undefined') return;
  if (typeof window.confirmQuitRelapse === 'function') window.confirmQuitRelapse(data.id);
  if (typeof window.renderEvening === 'function') setTimeout(window.renderEvening, 50);
});
// === Phase 1д projects.js actions ===
// open-project — тап на картку проєкту (відкриває workspace з steps + notes).
reg('open-project', (data) => {
  if (!data.id) return;
  if (typeof window !== 'undefined' && typeof window.openProjectWorkspace === 'function') {
    window.openProjectWorkspace(data.id);
  }
});
// close-project-workspace — кнопка «← Назад» у workspace. JS state reset
// (activeProjectId=null), не DOM-remove — тому не reuse close-parent.
reg('close-project-workspace', () => {
  if (typeof window !== 'undefined' && typeof window.closeProjectWorkspace === 'function') {
    window.closeProjectWorkspace();
  }
});
// toggle-project-timeline — «розгорнути ↓» / «згорнути ↑» історія проєкту.
reg('toggle-project-timeline', (data) => {
  if (!data.id) return;
  if (typeof window !== 'undefined' && typeof window.toggleProjectTimeline === 'function') {
    window.toggleProjectTimeline(data.id);
  }
});
// toggle-project-step — checkbox крока проєкту. Council Pre-mortem 🔴:
// _syncProjectStepToTasks (projects.js:436) має fuzzy match (substring 15
// chars) що може закрити ЧУЖУ задачу — це pre-existing баг ДО delegation,
// не блокує цей рефакторинг.
reg('toggle-project-step', (data) => {
  if (typeof window !== 'undefined' && typeof window.toggleProjectStep === 'function') {
    window.toggleProjectStep(data.projectId, data.stepId);
  }
});
// open-notes-folder — cross-tab navigation з projects → notes з папкою.
// Інкапсулює switchTab + setTimeout(150) для openNotesFolder. 150ms потрібен
// щоб Notes-вкладка зрендерилась перед спробою відкрити папку (notes.js:233
// має `if (!listEl) return` — без затримки фолдер не знайдеться).
reg('open-notes-folder', (data) => {
  if (typeof window === 'undefined') return;
  if (typeof window.switchTab === 'function') window.switchTab('notes');
  if (typeof window.openNotesFolder === 'function') {
    setTimeout(() => window.openNotesFolder(data.folder), 150);
  }
});
// === Phase 1+ (JMQuT) notes.js actions ===
// open-notes-folder-local — INTRA-tab версія (юзер вже на Notes). Без switchTab
// + setTimeout — миттєвий рендер. Розрізнення з open-notes-folder вище: cross-tab
// версія має 150ms лаг бо чекає на рендер вкладки.
reg('open-notes-folder-local', (data) => {
  if (typeof window !== 'undefined' && typeof window.openNotesFolder === 'function') {
    window.openNotesFolder(data.folder);
  }
});
// close-notes-folder — кнопка «← Назад» з folder-view. JS state reset
// (currentNotesFolder=parent|null + renderNotes()), не DOM-remove.
reg('close-notes-folder', () => {
  if (typeof window !== 'undefined' && typeof window.closeNotesFolder === 'function') {
    window.closeNotesFolder();
  }
});
// open-folder-edit-modal — ··· на картці папки (відкриває модалку редагування).
// Inline `event.stopPropagation()` ВИДАЛЕНО при міграції: delegation closest()
// бере найближчий data-action = цей ···, батьківський open-notes-folder-local
// НЕ triggered (один listener на body — той самий патерн що delete-moment).
reg('open-folder-edit-modal', (data) => {
  if (typeof window !== 'undefined' && typeof window.openFolderEditModal === 'function') {
    window.openFolderEditModal(data.folder);
  }
});
// open-note — тап на тіло нотатки → openNoteView. UUID-immune (data-id string).
reg('open-note', (data) => {
  if (!data.id) return;
  if (typeof window !== 'undefined' && typeof window.openNoteView === 'function') {
    window.openNoteView(data.id);
  }
});
// open-note-menu — ··· на нотатці. stopPropagation НЕ потрібен (closest бере
// найближчий = ···, не батьківський open-note).
reg('open-note-menu', (data) => {
  if (!data.id) return;
  if (typeof window !== 'undefined' && typeof window.openNoteMenu === 'function') {
    window.openNoteMenu(data.id);
  }
});
// select-folder-icon — picker іконки у folder-edit-modal. data-icon = ключ з ALL_FOLDER_ICONS.
reg('select-folder-icon', (data) => {
  if (typeof window !== 'undefined' && typeof window.selectFolderIcon === 'function') {
    window.selectFolderIcon(data.icon);
  }
});
// select-folder-color — picker кольору. data-color = ключ з FOLDER_COLOR_PALETTE.
reg('select-folder-color', (data) => {
  if (typeof window !== 'undefined' && typeof window.selectFolderColor === 'function') {
    window.selectFolderColor(data.color);
  }
});
// open-note-from-search — chat-bubble результат пошуку: 2 виклики поспіль.
// addNotesChatMsg показує empty user-message (візуально «це твій запит»), потім openNoteView.
reg('open-note-from-search', (data) => {
  if (!data.id) return;
  if (typeof window === 'undefined') return;
  if (typeof window.addNotesChatMsg === 'function') window.addNotesChatMsg('user', '');
  if (typeof window.openNoteView === 'function') window.openNoteView(data.id);
});
