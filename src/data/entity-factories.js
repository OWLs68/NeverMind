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
