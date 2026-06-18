// src/core/entity.js
//
// Конверт сутності (Supabase-міграція, Фаза 1 — Фундамент §1 у
// docs/SUPABASE_MIGRATION_PLAN.md). Це головна «двері в один бік»: форма
// id/user_id/created_at/updated_at/deleted_at/hlc має бути однакова для ВСІХ
// таблиць з дня 1, інакше sync зламається на живих юзерах.
//
// 🚫 ЦЕ НЕ СХОВИЩЕ. stampEntity — ЧИСТА функція-фабрика: нічого не читає і не
//    пише у localStorage. Заборона централізованої db.js-абстракції (CLAUDE.md
//    hard law + /supabase-prep) стосується ОБГОРТОК запису, не цієї фабрики.
//    Кожна вкладка застосовує stampEntity сама у власному create-шляху — рівно
//    так само як вже застосовує generateUUID. Жодного спільного шару запису.
//
// 📌 ВІДКРИТІ РІШЕННЯ (свідомо лишені на потім, не блокують Фазу 1):
//    - id: НОВІ записи — uuid v7 (час-сортований, кращий Postgres-індекс; foyz2r
//      17.06). Старі живі записи — v4, лишаються валідними поряд (format той самий,
//      ніде не сортуємо за id → змішування безпечне). Дефер «v7 разом із Supabase»
//      скасовано: розриву формату нема, а раніше = більша частка v7 до sync.
//    - hlc: Фаза 1 лишає null. Справжній Hybrid Logical Clock проштампує sync-шар
//      Фази 2 (план §SYNC). Поле існує з дня 1 щоб схема не змінювалась пізніше.
//    - user_id: null до auth. Backfill реальним id ПЕРЕД enable RLS (план §2).

import { generateUUID } from './uuid.js';

// ISO 8601 у UTC — єдиний формат часу для конверта (не Date.now() мілісекунди).
export function nowISO() {
  return new Date().toISOString();
}

// stampEntity(rec) → той самий запис + гарантовані поля конверта.
// - id:         збережений якщо є, інакше новий uuid
// - created_at: збережений якщо є, інакше зараз (не перетирати — запис народжується раз)
// - updated_at: ЗАВЖДИ зараз (кожен штамп = мутація)
// - deleted_at: збережений (для soft-delete tombstone), інакше null
// - user_id:    збережений, інакше null (заглушка до auth)
// - hlc:        збережений, інакше null (проштампує sync-шар Фази 2)
//
// Порядок важливий: дані запису (...rec) ПЕРШИМИ, поля конверта ПІСЛЯ — щоб
// updated_at не можна було випадково перетерти старим значенням з rec.
export function stampEntity(rec = {}) {
  const ts = nowISO();
  return {
    ...rec,
    id: rec.id ?? generateUUID(),
    user_id: rec.user_id ?? null,
    created_at: rec.created_at ?? ts,
    updated_at: ts,
    deleted_at: rec.deleted_at ?? null,
    hlc: rec.hlc ?? null,
  };
}
