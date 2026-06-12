// src/data/entity-factories.js
//
// Фабрики сутностей — ЄДИНЕ джерело форми для кожного типу запису. Усувають
// дуплікацію створення (та сама подія/задача будувалась у 5-7 місцях з дрібними
// розбіжностями полів) і нормалізують форму під Supabase-колонки. Це також
// майбутні чокпойнти для конверта stampEntity (Ворота 3) — додати штамп тут і
// він покриє всі точки створення.
//
// makeHabit живе у habit-classifier.js (тісно звʼязана з inferHabitType).

import { generateUUID } from '../core/uuid.js';

// Подія календаря (nm_events). Раніше будувалась у 7 місцях (inbox ×3, habits ×2,
// evening ×2) — десь з endTime, десь без → неконсистентна форма. Фабрика завжди дає
// ті самі поля (endTime: null якщо немає — calendar читає ev.endTime||null, тож
// безпечно). recurringId додаємо лише коли заданий (повторювані події у calendar.js
// мають власну loop-логіку з createdAt+i і фабрику не використовують).
export function makeEvent({ title, date, time = null, endTime = null, priority = 'normal', recurringId } = {}) {
  const ev = {
    id: generateUUID(),
    title,
    date,
    time,
    endTime,
    priority,
    createdAt: Date.now(),
  };
  if (recurringId != null) ev.recurringId = recurringId;
  return ev;
}

// Задача (nm_tasks). Раніше будувалась у 5 місцях (manual modal, inbox, 2× habits,
// inbox-board) + умовні dueDate/priority дописувались окремими if'ами після (з різними
// списками валідних priority: inbox мав 'normal', habits — ні; уніфіковано — 'normal' =
// дефолт, результат той самий). steps — масив крок-обʼєктів (під-сутності), передається
// готовим. dueDate/priority додаємо лише коли валідні (форма як була).
export function makeTask({ title, desc = '', steps = [], dueDate, priority } = {}) {
  const task = {
    id: generateUUID(),
    title,
    desc,
    steps: Array.isArray(steps) ? steps : [],
    status: 'active',
    createdAt: Date.now(),
  };
  if (dueDate) task.dueDate = dueDate;
  if (priority && ['normal', 'important', 'critical'].includes(priority)) task.priority = priority;
  return task;
}

// Момент (nm_moments) — короткий запис настрою/думки. Будувався у 3 місцях
// (evening manual, evening-actions, inbox). Поле часу — ts (не createdAt, як у
// інших сутностей — історично).
export function makeMoment({ text = '', mood = 'neutral' } = {}) {
  return {
    id: generateUUID(),
    text,
    mood,
    ts: Date.now(),
  };
}

// Фінансова транзакція (nm_finance). Будувалась у 3 місцях (finance.js createTx,
// finance-modals ручне, inbox-board AI). ⚠️ ts — це ДАТА транзакції (може бути
// минулою через resolveFinanceDate / вибір юзера), НЕ завжди Date.now() — тому
// приймаємо її параметром (дефолт Date.now() якщо не задано). subcategory
// додаємо лише коли є (форма як була).
export function makeFinance({ type, amount, category, comment = '', ts, subcategory } = {}) {
  const tx = {
    id: generateUUID(),
    type,
    amount,
    category,
    comment,
    ts: ts != null ? ts : Date.now(),
  };
  if (subcategory) tx.subcategory = subcategory;
  return tx;
}
