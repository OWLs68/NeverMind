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

// Idempotency guard (OBErR Phase 0 — Council Pre-mortem): без нього повторний
// bootApp() (наприклад при iOS bfcache restore чи помилкове ручне виклик)
// додав би другий listener → подвійні дії на кожен тап (deleteMoment ×2).
let _initialized = false;

// Реєструє handler для `data-action="name"`. Викликається з tabs/modules.
// fn signature: (dataset, el, ev) => void. dataset — DOMStringMap з data-* атрибутів.
export function reg(name, fn) {
  if (typeof name !== 'string' || !name) return;
  if (typeof fn !== 'function') return;
  ACTIONS[name] = fn;
}

// Один listener на body. Викликається з boot.js init() ПIСЛЯ DOMContentLoaded.
export function initDelegation() {
  if (_initialized) return;
  if (typeof document === 'undefined') return;
  document.body.addEventListener('click', _handleClick);
  _initialized = true;
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
// close-backdrop — UNIVERSAL для overlay-кліку поза модалкою (OBErR Phase 0).
// Замінює одночасно ДВА antipattern'и:
//   ❌ inline `<div onclick="closeX()">backdrop</div>` + дочірній
//   ❌ `<div onclick="event.stopPropagation()">content</div>` (захист від
//      закриття при кліку всередині — блокує delegation нащадків)
// Замість цього:
//   ✅ `<div data-action="close-backdrop" data-fn="closeX">backdrop</div>`
//   ✅ content БЕЗ stopPropagation, БЕЗ data-action (якщо нема власних кнопок)
//
// Працює бо closest('[data-action]') від реального target піднімається до
// overlay (бо content не має data-action). Якщо клік на самому overlay:
// e.target === el (overlay) → викликаємо fn. Якщо клік на content:
// e.target = content, el = overlay → НЕ викликаємо fn. Якщо content має
// власну кнопку з data-action → closest повертає кнопку (не overlay),
// delegation викликає handler кнопки, close-backdrop не triggered.
reg('close-backdrop', (data, el, e) => {
  if (e.target !== el) return;
  const fn = data.fn;
  if (typeof window === 'undefined' || !fn) return;
  if (typeof window[fn] === 'function') window[fn]();
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
// === Phase 1+ (JMQuT) nav.js actions ===
// toggle-tab-selection — клік на картку вибору вкладки у tab-selector модалці.
reg('toggle-tab-selection', (data) => {
  if (typeof window !== 'undefined' && typeof window.toggleTabSelection === 'function') {
    window.toggleTabSelection(data.tab);
  }
});
// apply-tab-selection — кнопка «Готово» у tab-selector.
reg('apply-tab-selection', () => {
  if (typeof window !== 'undefined' && typeof window.applyTabSelection === 'function') {
    window.applyTabSelection();
  }
});
// move-tab-order — кнопки ‹/› біля рядка вкладки у порядку. data-tab-id + data-dir='-1'/'1'.
// stopPropagation видалено — delegation closest() бере найближчий = button, не батьківський select-tab-order.
reg('move-tab-order', (data) => {
  if (typeof window === 'undefined') return;
  if (typeof window.moveTabOrder !== 'function') return;
  const dir = parseInt(data.dir, 10);
  if (Number.isNaN(dir)) return;
  window.moveTabOrder(data.tabId, dir);
});
// select-tab-order — клік на сам рядок вкладки (всередині drum) → вибір цієї вкладки активною.
reg('select-tab-order', (data) => {
  if (typeof window !== 'undefined' && typeof window.selectTabOrder === 'function') {
    window.selectTabOrder(data.tabId);
  }
});
// delete-memory-card — × на картці памʼяті у Налаштуваннях. data-id = factId (через escapeHtml).
reg('delete-memory-card', (data) => {
  if (!data.id) return;
  if (typeof window !== 'undefined' && typeof window.deleteMemoryCard === 'function') {
    window.deleteMemoryCard(data.id);
  }
});
// close-deploy-info — × у модалці «Інфо про деплой».
reg('close-deploy-info', () => {
  if (typeof window !== 'undefined' && typeof window.closeDeployInfo === 'function') {
    window.closeDeployInfo();
  }
});
// === Phase 1+ (JMQuT) habits.js actions ===
// tap-habit-square — клік на існуючий квадратик у прогрес-стрічці звички.
// data-entity='habit' (Me-tab tapHabitSquareMe) | 'habit-prod' (Prod-tab tapHabitSquare).
// data-idx — позиція квадратика (parseInt). stopPropagation видалено — closest бере найближчий.
reg('tap-habit-square', (data) => {
  if (typeof window === 'undefined') return;
  const idx = parseInt(data.idx, 10);
  if (Number.isNaN(idx) || !data.id) return;
  if (data.entity === 'habit' && typeof window.tapHabitSquareMe === 'function') {
    window.tapHabitSquareMe(data.id, idx);
  } else if (data.entity === 'habit-prod' && typeof window.tapHabitSquare === 'function') {
    window.tapHabitSquare(data.id, idx);
  }
});
// open-edit-habit — клік на картку звички (Me-tab + Prod-tab + quit-habit).
// Сам обробник toggle-entity-done на checkbox блокує bubble через closest().
reg('open-edit-habit', (data) => {
  if (!data.id) return;
  if (typeof window !== 'undefined' && typeof window.openEditHabit === 'function') {
    window.openEditHabit(data.id);
  }
});
// prod-habit-card-click — клік на картку Prod-habit. Як task-card-click (передаємо event).
// Функція сама перевіряє event.target.closest для guard'а (checkbox/squares).
reg('prod-habit-card-click', (data, el, ev) => {
  if (!data.id) return;
  if (typeof window !== 'undefined' && typeof window.prodHabitCardClick === 'function') {
    window.prodHabitCardClick(data.id, ev);
  }
});
// === Phase 1+ (JMQuT) health.js actions — UI CRUD only (AI ізольовано, EU AI Act compliance) ===
// open-add-health-card — кнопка «+ Додати картку» у empty state.
reg('open-add-health-card', () => {
  if (typeof window !== 'undefined' && typeof window.openAddHealthCard === 'function') {
    window.openAddHealthCard();
  }
});
// open-health-card — тап на картку health у списку. data-id = UUID картки.
reg('open-health-card', (data) => {
  if (!data.id) return;
  if (typeof window !== 'undefined' && typeof window.openHealthCard === 'function') {
    window.openHealthCard(data.id);
  }
});
// close-health-card — «← Назад» у workspace картки. JS state reset (activeHealthCardId=null).
reg('close-health-card', () => {
  if (typeof window !== 'undefined' && typeof window.closeHealthCard === 'function') {
    window.closeHealthCard();
  }
});
// open-edit-health-card — кнопка «Ред.» біля картки. data-id.
reg('open-edit-health-card', (data) => {
  if (!data.id) return;
  if (typeof window !== 'undefined' && typeof window.openEditHealthCard === 'function') {
    window.openEditHealthCard(data.id);
  }
});
// set-health-card-status — кнопка статусу у workspace. data-card-id + data-status.
reg('set-health-card-status', (data) => {
  if (!data.cardId || !data.status) return;
  if (typeof window !== 'undefined' && typeof window.setHealthCardStatus === 'function') {
    window.setHealthCardStatus(data.cardId, data.status);
  }
});
// log-health-med-dose — «+ Прийняти» або «✓ Прийняв» (банер missed doses + workspace).
// data-card-id + data-med-id.
reg('log-health-med-dose', (data) => {
  if (!data.cardId || !data.medId) return;
  if (typeof window !== 'undefined' && typeof window.logHealthMedDose === 'function') {
    window.logHealthMedDose(data.cardId, data.medId);
  }
});
// skip-health-med-dose — «Пропущу» у банері missed doses. data-card-id + data-med-id + data-time (scheduledTime).
reg('skip-health-med-dose', (data) => {
  if (!data.cardId || !data.medId) return;
  if (typeof window !== 'undefined' && typeof window.skipHealthMedDose === 'function') {
    window.skipHealthMedDose(data.cardId, data.medId, data.time || '');
  }
});
// open-health-card-note — клік на блок «Нотатки картки» у workspace. data-id = UUID картки.
reg('open-health-card-note', (data) => {
  if (!data.id) return;
  if (typeof window !== 'undefined' && typeof window.openHealthCardNote === 'function') {
    window.openHealthCardNote(data.id);
  }
});
// open-add-allergy — кнопка «+ Додати» алергію (2 точки рендеру).
reg('open-add-allergy', () => {
  if (typeof window !== 'undefined' && typeof window.openAddAllergy === 'function') {
    window.openAddAllergy();
  }
});
// delete-allergy-by-id — × на картці алергії. data-id = UUID алергії.
reg('delete-allergy-by-id', (data) => {
  if (!data.id) return;
  if (typeof window !== 'undefined' && typeof window.deleteAllergyById === 'function') {
    window.deleteAllergyById(data.id);
  }
});
// === Phase 1 (OBErR) finance-analytics.js actions ===
// set-analytics-chart-mode — перемикач 3 режимів графіку (balance / expenses-weekly / income-vs-expense).
// data-mode = id режиму. Fixed strings (не UUID/user input).
reg('set-analytics-chart-mode', (data) => {
  if (!data.mode) return;
  if (typeof window !== 'undefined' && typeof window.setAnalyticsChartMode === 'function') {
    window.setAnalyticsChartMode(data.mode);
  }
});
// set-analytics-granularity — перемикач Тижні / Дні. data-gran="weekly"|"daily".
reg('set-analytics-granularity', (data) => {
  if (!data.gran) return;
  if (typeof window !== 'undefined' && typeof window.setAnalyticsGranularity === 'function') {
    window.setAnalyticsGranularity(data.gran);
  }
});
// shift-analytics-mini — стрілки ‹/› для перемикання міні-блоків аналітики.
// data-block-idx = індекс блоку (число), data-dir = -1/1.
reg('shift-analytics-mini', (data) => {
  if (typeof window === 'undefined') return;
  if (typeof window.shiftAnalyticsMini !== 'function') return;
  const idx = parseInt(data.blockIdx, 10);
  const dir = parseInt(data.dir, 10);
  if (Number.isNaN(idx) || Number.isNaN(dir)) return;
  window.shiftAnalyticsMini(idx, dir);
});
// toggle-analytics-benchmark-edit — олівець «Редагувати» benchmark (50/30/20) +
// кнопка «Готово» у edit-mode (3 точки рендеру, одна action).
reg('toggle-analytics-benchmark-edit', () => {
  if (typeof window !== 'undefined' && typeof window.toggleAnalyticsBenchmarkEdit === 'function') {
    window.toggleAnalyticsBenchmarkEdit();
  }
});
// reset-benchmark-config — «Скинути до 50/30/20» у edit-mode.
reg('reset-benchmark-config', () => {
  if (typeof window !== 'undefined' && typeof window.resetBenchmarkConfig === 'function') {
    window.resetBenchmarkConfig();
  }
});
// === Phase 2 (OBErR) finance-modals.js actions ===
// Транзакція — модалка додавання/редагування.
reg('select-fin-tx-main-cat', (data) => {
  if (!data.name) return;
  if (typeof window !== 'undefined' && typeof window.selectFinTxMainCat === 'function') {
    window.selectFinTxMainCat(data.name);
  }
});
reg('select-fin-tx-subcat', (data) => {
  if (!data.name) return;
  if (typeof window !== 'undefined' && typeof window.selectFinTxSubcat === 'function') {
    window.selectFinTxSubcat(data.name);
  }
});
// fin-calc-append / fin-calc-backspace — кнопки калькулятора (16 шт).
// data-val для append: цифра 0-9, кома, оператори +/-/×/÷.
reg('fin-calc-append', (data) => {
  if (!data.val) return;
  if (typeof window !== 'undefined' && typeof window.finCalcAppend === 'function') {
    window.finCalcAppend(data.val);
  }
});
reg('fin-calc-backspace', () => {
  if (typeof window !== 'undefined' && typeof window.finCalcBackspace === 'function') {
    window.finCalcBackspace();
  }
});
// set-fin-tx-type — Витрата / Дохід toggle у tx-модалці. data-type="expense"|"income".
reg('set-fin-tx-type', (data) => {
  if (!data.type) return;
  if (typeof window !== 'undefined' && typeof window.setFinTxType === 'function') {
    window.setFinTxType(data.type);
  }
});
// open-fin-date-modal — клік на рядок дати у tx-модалці (відкриває picker).
reg('open-fin-date-modal', () => {
  if (typeof window !== 'undefined' && typeof window.openFinDateModal === 'function') {
    window.openFinDateModal();
  }
});
// set-fin-tx-date-offset — пресети «Сьогодні/Вчора/Позавчора/Тиждень тому».
// data-days = 0 / -1 / -2 / -7 (parseInt захист).
reg('set-fin-tx-date-offset', (data) => {
  if (typeof window === 'undefined') return;
  if (typeof window.setFinTxDateOffset !== 'function') return;
  const days = parseInt(data.days, 10);
  if (Number.isNaN(days)) return;
  window.setFinTxDateOffset(days);
});
// close-fin-tx-modal / close-fin-date-modal / close-fin-budget-modal — кнопки
// закриття (НЕ backdrop). Окремі actions від close-backdrop бо це не overlay-клік.
reg('close-fin-tx-modal', () => {
  if (typeof window !== 'undefined' && typeof window.closeFinTxModal === 'function') {
    window.closeFinTxModal();
  }
});
reg('close-fin-date-modal', () => {
  if (typeof window !== 'undefined' && typeof window.closeFinDateModal === 'function') {
    window.closeFinDateModal();
  }
});
reg('close-fin-budget-modal', () => {
  if (typeof window !== 'undefined' && typeof window.closeFinBudgetModal === 'function') {
    window.closeFinBudgetModal();
  }
});
// save/delete для tx + budget.
reg('save-fin-transaction', () => {
  if (typeof window !== 'undefined' && typeof window.saveFinTransaction === 'function') {
    window.saveFinTransaction();
  }
});
reg('delete-fin-transaction', () => {
  if (typeof window !== 'undefined' && typeof window.deleteFinTransaction === 'function') {
    window.deleteFinTransaction();
  }
});
reg('save-fin-budget', () => {
  if (typeof window !== 'undefined' && typeof window.saveFinBudgetFromModal === 'function') {
    window.saveFinBudgetFromModal();
  }
});
// Category Edit Modal: трігери icon/color picker + select + remove subcat.
reg('toggle-cat-modal-icons', () => {
  if (typeof window !== 'undefined' && typeof window.toggleCatModalIcons === 'function') {
    window.toggleCatModalIcons();
  }
});
reg('toggle-cat-modal-colors', () => {
  if (typeof window !== 'undefined' && typeof window.toggleCatModalColors === 'function') {
    window.toggleCatModalColors();
  }
});
reg('select-cat-modal-icon', (data) => {
  if (!data.icon) return;
  if (typeof window !== 'undefined' && typeof window.selectCatModalIcon === 'function') {
    window.selectCatModalIcon(data.icon);
  }
});
reg('select-cat-modal-color', (data) => {
  if (!data.color) return;
  if (typeof window !== 'undefined' && typeof window.selectCatModalColor === 'function') {
    window.selectCatModalColor(data.color);
  }
});
reg('remove-cat-modal-subcat', (data) => {
  if (typeof window === 'undefined') return;
  if (typeof window.removeCatModalSubcat !== 'function') return;
  const idx = parseInt(data.idx, 10);
  if (Number.isNaN(idx)) return;
  window.removeCatModalSubcat(idx);
});
// set-cat-modal-type — Витрата/Дохід у Category Edit Modal. Аналогічно
// set-fin-tx-type, але інша функція (data.type="expense"|"income").
reg('set-cat-modal-type', (data) => {
  if (!data.type) return;
  if (typeof window !== 'undefined' && typeof window.setCatModalType === 'function') {
    window.setCatModalType(data.type);
  }
});
reg('add-cat-modal-subcat', () => {
  if (typeof window !== 'undefined' && typeof window.addCatModalSubcat === 'function') {
    window.addCatModalSubcat();
  }
});
reg('toggle-cat-modal-archive', () => {
  if (typeof window !== 'undefined' && typeof window.toggleCatModalArchive === 'function') {
    window.toggleCatModalArchive();
  }
});
reg('delete-category-from-modal', () => {
  if (typeof window !== 'undefined' && typeof window.deleteCategoryFromModal === 'function') {
    window.deleteCategoryFromModal();
  }
});
reg('close-category-edit-modal', () => {
  if (typeof window !== 'undefined' && typeof window.closeCategoryEditModal === 'function') {
    window.closeCategoryEditModal();
  }
});
reg('save-category-from-modal', () => {
  if (typeof window !== 'undefined' && typeof window.saveCategoryFromModal === 'function') {
    window.saveCategoryFromModal();
  }
});
// === Phase 3 (OBErR) finance.js actions ===
// move-fin-category — стрілки ‹/› переміщення категорії у edit-режимі.
// data-id = UUID категорії, data-dir = -1/1. renderFinance НЕ викликаємо тут —
// saveFinCats() усередині moveFinCategory dispатчить nm-data-changed → auto-render.
// Inline stopPropagation НЕ потрібен (closest бере найближчий = button).
reg('move-fin-category', (data) => {
  if (typeof window === 'undefined') return;
  if (typeof window.moveFinCategory !== 'function') return;
  const dir = parseInt(data.dir, 10);
  if (!data.id || Number.isNaN(dir)) return;
  window.moveFinCategory(data.id, dir);
});
// open-fin-category — тап на cat-tile у звичайному режимі (відкриває
// openAddTransaction з prefilled категорією). data-cat-name + data-cat-type.
reg('open-fin-category', (data) => {
  if (!data.catName) return;
  if (typeof window !== 'undefined' && typeof window.openAddTransaction === 'function') {
    window.openAddTransaction({ category: data.catName, type: data.catType });
  }
});
// open-category-edit-modal — тап на cat-tile у edit-режимі АБО на «+ Додати»
// (data-id="new" для нової). reuse у 2 точках.
reg('open-category-edit-modal', (data) => {
  if (!data.id) return;
  if (typeof window !== 'undefined' && typeof window.openCategoryEditModal === 'function') {
    window.openCategoryEditModal(data.id);
  }
});
// toggle-fin-tab-type — тап на центральний круг (перемикач Витрати/Доходи).
reg('toggle-fin-tab-type', () => {
  if (typeof window !== 'undefined' && typeof window.toggleFinTabType === 'function') {
    window.toggleFinTabType();
  }
});
// toggle-fin-edit-mode — «Готово» у edit-режимі + олівець ✎ у звичайному.
reg('toggle-fin-edit-mode', () => {
  if (typeof window !== 'undefined' && typeof window.toggleFinEditMode === 'function') {
    window.toggleFinEditMode();
  }
});
// shift-fin-period — стрілки ‹/› навігації періоду + текст «↺ до сьогодні»
// (data-dir = -1, 1, або -currentFinPeriodOffset snapshot).
reg('shift-fin-period', (data) => {
  if (typeof window === 'undefined') return;
  if (typeof window.shiftFinPeriod !== 'function') return;
  const dir = parseInt(data.dir, 10);
  if (Number.isNaN(dir)) return;
  window.shiftFinPeriod(dir);
});
// open-add-transaction — кнопки «+ Додати операцію» (empty state) +
// «+ додати» (short). Виклик без аргументів = нова tx без prefill.
reg('open-add-transaction', () => {
  if (typeof window !== 'undefined' && typeof window.openAddTransaction === 'function') {
    window.openAddTransaction();
  }
});
// open-edit-transaction — клік на tx-row (data-id = UUID транзакції).
reg('open-edit-transaction', (data) => {
  if (!data.id) return;
  if (typeof window !== 'undefined' && typeof window.openEditTransaction === 'function') {
    window.openEditTransaction(data.id);
  }
});
// open-all-transactions — кнопка «Всі операції (N)».
reg('open-all-transactions', () => {
  if (typeof window !== 'undefined' && typeof window.openAllTransactions === 'function') {
    window.openAllTransactions();
  }
});
// close-element-by-id — UNIVERSAL для backdrop'ів модалок створених через
// document.body.appendChild (не render-template). Замінює inline
// `onclick="document.getElementById('X').remove()"`. data-target-id = ID без #.
reg('close-element-by-id', (data, el, e) => {
  if (e.target !== el) return; // backdrop guard — клік усередині content не закриває
  if (!data.targetId) return;
  const node = typeof document !== 'undefined' ? document.getElementById(data.targetId) : null;
  if (node && typeof node.remove === 'function') node.remove();
});
// open-edit-transaction-from-all — компаунд: закрити all-transactions модалку
// + відкрити edit-tx (data-id = UUID транзакції). Уникає inline
// `onclick="document.getElementById('fin-all-txs-modal').remove();openEditTransaction(...)"`.
reg('open-edit-transaction-from-all', (data) => {
  if (!data.id) return;
  if (typeof document !== 'undefined') {
    const all = document.getElementById('fin-all-txs-modal');
    if (all && typeof all.remove === 'function') all.remove();
  }
  if (typeof window !== 'undefined' && typeof window.openEditTransaction === 'function') {
    window.openEditTransaction(data.id);
  }
});
