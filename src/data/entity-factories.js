// src/data/entity-factories.js
//
// Фабрики сутностей — ЄДИНЕ джерело форми для кожного типу запису. Усувають
// дуплікацію створення (та сама подія/задача будувалась у 5-7 місцях з дрібними
// розбіжностями полів) і нормалізують форму під Supabase-колонки. Це також
// майбутні чокпойнти для конверта stampEntity (Ворота 3) — додати штамп тут і
// він покриє всі точки створення.
//
// makeHabit живе у habit-classifier.js (тісно звʼязана з inferHabitType).

import { stampEntity } from '../core/entity.js';

// Подія календаря (nm_events). Раніше будувалась у 7 місцях (inbox ×3, habits ×2,
// evening ×2) — десь з endTime, десь без → неконсистентна форма. Фабрика завжди дає
// ті самі поля (endTime: null якщо немає — calendar читає ev.endTime||null, тож
// безпечно). recurringId додаємо лише коли заданий (повторювані події у calendar.js
// мають власну loop-логіку з createdAt+i і фабрику не використовують).
export function makeEvent({ title, date, time = null, endTime = null, priority = 'normal', recurringId } = {}) {
  const ev = {
    title,
    date,
    time,
    endTime,
    priority,
    createdAt: Date.now(),
  };
  if (recurringId != null) ev.recurringId = recurringId;
  return stampEntity(ev);
}

// Задача (nm_tasks). Раніше будувалась у 5 місцях (manual modal, inbox, 2× habits,
// inbox-board) + умовні dueDate/priority дописувались окремими if'ами після (з різними
// списками валідних priority: inbox мав 'normal', habits — ні; уніфіковано — 'normal' =
// дефолт, результат той самий). steps — масив крок-обʼєктів (під-сутності), передається
// готовим. dueDate/priority додаємо лише коли валідні (форма як була).
export function makeTask({ title, desc = '', steps = [], dueDate, priority } = {}) {
  const task = {
    title,
    desc,
    steps: Array.isArray(steps) ? steps : [],
    status: 'active',
    createdAt: Date.now(),
  };
  if (dueDate) task.dueDate = dueDate;
  if (priority && ['normal', 'important', 'critical'].includes(priority)) task.priority = priority;
  return stampEntity(task);
}

// Момент (nm_moments) — короткий запис настрою/думки. Будувався у 3 місцях
// (evening manual, evening-actions, inbox). Поле часу — ts (не createdAt, як у
// інших сутностей — історично).
export function makeMoment({ text = '', mood = 'neutral' } = {}) {
  return stampEntity({
    text,
    mood,
    ts: Date.now(),
  });
}

// Проект (nm_projects). Будувався у 2 місцях (projects.js createProjectProgrammatic
// AI-шлях + saveNewProject ручна модалка) — форма була ідентична, скопійована.
// Вкладені структури (steps/budget/metrics/decisions/resources) — під-сутності,
// народжуються порожніми; їх власний конверт — окрема задача (як health 3B-8).
export function makeProject({ name, subtitle = '' } = {}) {
  return stampEntity({
    name,
    subtitle,
    brief: '',          // що це за проект — суть/ціль/контекст (OWL розуміє ПЕРШ ніж радити)
    targetAudience: '', // для кого / хто користувач-клієнт (вимір 2 повноти)
    currentStage: '',   // на якому етапі, що вже є (вимір 3 повноти)
    deadline: null,     // дедлайн або горизонт (вимір 5 повноти)
    images: [],         // про запас під Supabase Storage (зараз не зберігаємо самі фото — памʼять iOS)
    progress: 0,
    steps: [],
    budget: { total: 0, spent: 0, items: [] },
    metrics: [],
    decisions: [],
    resources: [],
    risks: '',
    tempoNow: '?',
    tempoMore: '?',
    tempoIdeal: '?',
    notesPreview: '',
    lastActivity: Date.now(),
    createdAt: Date.now(),
  });
}

// Фінансова транзакція (nm_finance). Будувалась у 3 місцях (finance.js createTx,
// finance-modals ручне, inbox-board AI). ⚠️ ts — це ДАТА транзакції (може бути
// минулою через resolveFinanceDate / вибір юзера), НЕ завжди Date.now() — тому
// приймаємо її параметром (дефолт Date.now() якщо не задано). subcategory
// додаємо лише коли є (форма як була).
export function makeFinance({ type, amount, category, comment = '', ts, subcategory, projectId } = {}) {
  const tx = {
    type,
    amount,
    category,
    comment,
    ts: ts != null ? ts : Date.now(),
  };
  if (subcategory) tx.subcategory = subcategory;
  // Опційний тег проекту (Фаза 3 інтеграції): фактичні витрати проекту
  // агрегуються з Фінансів за цим полем — без дублювання суми у двох місцях.
  if (projectId) tx.projectId = projectId;
  return stampEntity(tx);
}

// Список (nm_lists) — окрема легка сутність-чекліст (v3pexs, варіант A). НЕ задача:
// живе у стрічці Inbox як картка-чекліст, нуль слідів у nm_tasks. items — масив
// під-сутностей {id, text, done} (та сама форма що task.steps — реюз renderChecklist).
// items НЕ штампуються власним конвертом (як task.steps/project.steps зараз) — лише
// список верхнього рівня через stampEntity. Якщо list_items стануть окремою Supabase-
// таблицею у майбутньому — додати stampEntity на кожен item (окрема міграція).
export function makeList({ title = '', items = [] } = {}) {
  return stampEntity({
    title,
    items: Array.isArray(items) ? items : [],
    status: 'active',
    createdAt: Date.now(),
  });
}
