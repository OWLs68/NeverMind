# 🏗️ Architecture Refactor — Sessions 1-8

> **Створено:** 11.05.2026 сесія myshu Session 0 (documentation alignment) після 3 раундів консультацій з GPT + Council 5 агентів.
>
> **Мета:** перенести `intelligence` з prompt-rules у architecture. AI = fuzzy interpreter, Code = truth.
>
> **Контекст:** після 3 місяців розвитку NeverMind накопичилось ~66 AI tools, 4 dispatch-точки, 9 entity types з різними ID-форматами, 28 dispatch-сайтів `nm-data-changed`. Симптоми: AI плутається у класифікації, інколи галюцинує success-text без виклику tool, undo нестабільний у певних чатах. Корінь — не AI, а архітектура.

---

## 🎯 Core принципи

1. **AI ніколи не пише «✓ зроблено»** — це робить ТIЛЬКИ executor після реальної мутації даних.
2. **Один формат канонічної дії** для усіх 4 dispatchers — `{intent, entities, confidence, source_tier}`.
3. **Дії, не стан** — sync і undo через append-only action-log, materialized state перераховується.
4. **Одна точка виконання** — `src/core/execute-action.js`, всі 4 dispatch-шляхи через неї.
5. **12 інтентів замість 66 tools** — дії юзера домен-level, не tool-specific.
6. **Strangler pattern** — поступовий перехід через wrapper-shims, без big-bang.

---

## 📋 8 сесій

### Сесія 1 — AI без success-дублів (30 хв, видимий ефект)
**Файли:** `src/tabs/inbox.js:1045-1052`
**Що:** прибрати silent `saveOffline + "✓ Збережено"` коли AI повертає порожню відповідь або throws. Замість — чесне «Не зрозумів, переформулюй».
**Why first:** найшвидший quick win, видимий юзеру одразу, нульовий ризик регресії.
**Перетин з roadmap:** немає.

### Сесія 2 — Парсер expansion (2-3 год)
**Файли:** `src/data/intent-router.js`
**Що:** додати парсери для `set_reminder`, `save_finance`, `complete_task`, `complete_step`. Bypasses AI у ~70% повідомлень.
**Why second:** ловить найбільше user-facing глюків («AI перепитує»). Чистий додаток у pure module — нуль ризику ламання.
**Перетин з roadmap:** ✅ замінює Dynamic AI-driven chips Шар 5 (Multi-step інтерв'ю — частково покривається парсером).

### Сесія 3 — UUID + reminderId arithmetic ✅ ЗАВЕРШЕНА (myshu 11.05 + db0YY 12.05)
**Файли:** `src/core/boot.js` (runMigrations v9-v16), `src/tabs/habits.js` (reminderId UUID), 35+ Date.now() точок у 10 entity types
**Зроблено:**
- ✅ 3A reminderId arithmetic (myshu `4012759`) — UUID замість `+1/+2`
- ✅ 3B-1..3B-7 (myshu): Habit v9 / Event v10 / Note v11 / Moment+Finance v12+v13 / Project+InboxItem v14+v15 з cross-ref update (habit_log2 keys, inbox.cards.eventId, inbox cards eventId/reminderId)
- ✅ 3B-8 (db0YY `552aa00`): Health v16 — nm_health_cards[].id + nested medications[].id + nm_allergies[].id з cross-ref FORWARD (card.nextAppointment.eventId через legacy_id ETAP 1 → new event UUID або ETAP 2 для подій створених після v10 з Date.now), REVERSE (event.sourceCardId), TASKS (task.sourceMedId через зведений medIdMap)
- ✅ Регресія Класу 1 + 2 виправлена db0YY (`f66acfb` + `2cf5510`): 18+8 onclick/Date.now() точок у inbox/evening/notes/projects/calendar/finance/utils/owl/habits створювалися з мікс типів — обгорнуто `'${id}'` + замінено create-points на generateUUID()

**Залишковий борг (окрема малa сесія):** sub-entity steps — `task.steps[].id` + `project.steps[].id` досі Date.now(). Поки `toggleProjectStep('${p.id}',${s.id})` не обгортає step.id у onclick (бо число) — працює. Коли мігруємо steps на UUID — пройти 3-grep чек-ліст з `lessons.md` (urok db0YY).

**Перетин з roadmap:** ✅ закриває Pre-Migration Hardening Підсесія 1 (UUID-міграція всіх типів). UUID coverage 10/10 entities.

### Сесія 4 — Один executor (`src/core/execute-action.js`)
**Файли:** новий `src/core/execute-action.js`
**Що:** pure-функція `executeAction(canonicalAction) → {success, result, error}`. Поки тонкий wrapper над `processUniversalAction` + handlers. Інтегрувати у 4 dispatch-точки: `tool-dispatcher.js`, `inbox.js sendToAI`, `evening-actions.js dispatchEveningTool`, `finance.js processFinanceAction`.
**⚠️ Critical:** імпортує ТIЛЬКИ з `src/data/*` та `src/core/*` (НЕ з `tabs/*` або `ai/*`). `processUniversalAction` передається через dependency injection — інакше циклічна залежність execute-action ↔ habits ↔ ai/core зависає iOS cold start.
**Перетин з roadmap:** немає (новий шар).

### Сесія 5 — Canonical action format (12 intents)
**Файли:** `src/data/action-schema.js` (новий), `src/ai/prompts.js` (tools → intents map), `src/core/execute-action.js`
**Що:** замість 66 tools — 12 канонічних інтентів через OpenAI structured outputs (`strict: true`):
- `create_item` (task / note / habit / project / health_card)
- `update_item` / `complete_item` / `delete_item`
- `create_reminder` / `create_schedule_block` / `create_recurring_routine`
- `save_note` / `save_memory`
- `log_expense` / `log_health` / `log_journal`
- `undo_action` (replaces реверс-логіку — undo = просто новий action)

Tools стають execution adapters: intent → tool resolver всередині execute-action.
**Перетин з roadmap:** немає.

### Сесія 6 — Action-log coverage скрізь
**Файли:** `src/data/action-log.js` (canonical helpers integration), `src/tabs/inbox.js`, `src/tabs/evening-actions.js`, `src/tabs/finance.js`
**Що:** зараз action-log пишеться тільки для 2-3 tools через 3 dispatch-точки. Розширити:
- ВСI reversible tools у 4 точках (save_task / save_note / save_habit / save_moment / save_finance)
- Canonical save helpers (`saveTasks`, `saveNotes`, etc) теж викликають `appendActionLog` — це закриває audit-gap для UI-modal-driven редагувань (Agent E знахідка)
- Додати reverser для save_note + save_moment (зараз їх нема у `action-reversers.js`)
**Перетин з roadmap:** ✅ закриває OWL V3 Фаза 3 (`nm_agent_corrections`) — Roman відклав з причини «без Supabase = дані у вакуумі», але після цієї сесії дані будуть корисні одразу для undo.

### Сесія 7 — Структурований `nm-data-changed` payload ⚠️
**Файли:** 28 dispatch-сайтів + 8 listeners
**Що:** замість `detail: 'string'` → `detail: {type, action, id, ts}`. Через strangler-shim:
- Helper `emitDataChanged(type, action, id?)` пише і старий format і новий
- 8 listeners мігрувати по одному (не паралельно — інакше дублі через `followups.js` 5s debounce + `brain-pulse.js` 60s debounce)
- Стара зворотна сумісність (`if (typeof detail === 'string')` гілка) лишається 2-3 сесії
**Перетин з roadmap:** ✅ закриває Pre-Migration Hardening Підсесія 3 (37 call-sites уніфікація — насправді 28 за свіжим аудитом).

### Сесія 8 — `nm_habit_log2` ISO + `user_id` placeholder
**Файли:** `src/core/boot.js` (v18 migration), всі creation-точки сутностей
**Що:**
- `nm_habit_log2` ключі `toDateString()` → `YYYY-MM-DD` (timezone-safe для cross-device sync)
- Додати `user_id: null` поле у всіх нових сутностях при створенні — Supabase RLS placeholder
- Очистити `DATA_SCHEMA.md` — оновити Task на UUID, додати action-log як 9-й тип, поновити список ключів
**Перетин з roadmap:** ✅ закриває Pre-Migration Hardening — все що блокувало Supabase auth.

---

## 🚨 ТОП-5 ризиків (з Council pre-mortem)

### R1. Циклічні залежності (Agent B)
`execute-action.js` → `habits.js processUniversalAction` → `ai/core.js` → `habits.js getHabits` = cold-start hang на iOS Safari.
**Mitigation:** execute-action.js НЕ імпортує з `tabs/` або `ai/`. Тільки `src/data/*` і `src/core/*`. processUniversalAction передається через DI (як параметр).

### R2. `reminderId + 1` / `+2` арифметика (Agent B)
При UUID-міграції `uuid_string + 1` = `NaN` або конкатенація. 3 сховища reminders/events/inbox перестають знаходити одне одного при видаленні нагадування.
**Mitigation:** ПЕРЕД Сесією 3 UUID — окремий коміт що замінює арифметику на іменоване поле `reminderId` (вже частково є).

### R3. `check-chat-uniformity.js` блокує build (Agent B)
Сесія 9 (dispatcher collapse) зачіпає 8 файлів. `INBOX_TOOLS` має 56 tools (не 31 як у коментарі). При скороченні до 12 інтентів — `selectRelevantTools` і ALLOWLIST у `check-chat-uniformity.js` треба синхронно оновлювати.
**Mitigation:** при кожному коміті — `node build.js` локально. Dispatcher collapse розбити на 2-3 сесії.

### R4. Event bus подвоїть тригери (Agent B)
8 listeners на `nm-data-changed` — `followups.js` debounce 5с, `brain-pulse.js` debounce 60с. Якщо паралельно з `emit('task.updated')` лишити старий `dispatchEvent('nm-data-changed')` — debounce-таймери скинуться двічі → OWL пише дублі.
**Mitigation:** Strangler pattern — мігрувати listener за listener, ніколи не паралельно. Старий event тримати під feature-flag що згортається після останнього migrated listener.

### R5. Audit gap для UI-modal-driven edits (Agent E)
Canonical `saveTasks/saveNotes/saveFinance` не викликають `appendActionLog`. Modal-driven редагування (`finance-modals.js`, swipe-delete) — поза логом. Для Supabase event-sourcing це критично.
**Mitigation:** Сесія 6 — інтегрувати `appendActionLog` ПОРУЧ з кожним canonical save helper. Не окрема функція — прямо у `saveTasks()`, `saveFinance()` тощо.

---

## 📊 Метрики поточної реальності (з Council audit)

| Метрика | Значення |
|---|---|
| AI tools | **66** (56 data + 10 UI) |
| Dispatch-точок | **4** (`tool-dispatcher`, `inbox.sendToAI`, `evening-actions.dispatchEveningTool`, `finance.processFinanceAction`) |
| Entity types з UUID | **1 з 10** (Tasks тільки) |
| Entity types з Date.now() | 9 (Habit, Note, Event, Finance, Moment, Project, HealthCard, Allergy, InboxItem) |
| Прямих `localStorage.setItem` поза canonical | **128 точок** (з 168) |
| `nm-data-changed` dispatch | 28 точок |
| `nm-data-changed` listeners | 8 точок |
| Pure `src/data/` модулі | 7 з 9 (`action-log` + `action-reversers` — НЕ pure, бо це storage layer) |
| Зареєстровані reversers у action-reversers.js | 6 з 9 reversible-pairs |

---

## ❌ Відкладено після цього блоку

- **Storage adapter** (cleanup 128 не-канонічних setItem) — Сесія 6 покриє ~60% через canonical helpers. Решта — після Supabase міграції одна таблиця за раз.
- **Dispatcher collapse 3→1** — Agent C каже 2-3 сесії, не одна. 8 файлів одночасно. Робимо ПIСЛЯ Сесії 5 коли canonical schema стабільна.
- **Event bus як повна заміна `nm-data-changed`** — поступово через strangler у Сесії 7. Повна заміна — після Supabase Realtime інтеграції.
- **Embedding router (semantic similarity)** — після зборuсу 2-3 місяців telemetry з реальних повідомлень. Спочатку треба dataset.
- **Local LLM (WebLLM)** — після 50+ юзерів. Зараз overkill.
- **Окрема telemetry-сесія** — буде природно після Сесії 6 (action-log і є telemetry).

---

## 🔗 Перетин з існуючими треками ROADMAP

| Існуючий трек у ROADMAP | Закривається сесією |
|---|---|
| Pre-Migration Hardening Підсесія 1 (UUID решти типів) | Сесія 3 |
| Pre-Migration Hardening Підсесія 3 (nm-data-changed уніфікація) | Сесія 7 |
| Один мозок V2 Шар 3 (мозок бачить всі чати) | Частково Сесії 4-5 (canonical action як єдина мова) |
| OWL Reasoning V3 Фаза 3 (`nm_agent_corrections`) | Сесія 6 (action-log expansion) |
| Dynamic AI-driven chips Шар 5 (Multi-step інтерв'ю FSM) | Частково Сесія 2 (парсер як regex-first router) |

---

## 🎯 Старт

**Перший крок зараз:** Сесія 1 (AI без success-дублів, 30 хв) — quick win, видимий ефект, нульовий ризик.

**Або:** Сесія 2 (парсер expansion) — 2-3 год, ловить найбільше user-facing глюків.

**Або:** Сесія 3 (UUID + reminderId fix) — 3-4 год, блокер для всього іншого.

Roman вирішує порядок.

---

## 📜 Источник плану

- 3 раунди консультацій з GPT (зведено у цій сесії — myshu Session 0)
- Council 5 паралельних агентів (Sonnet) — verification поточної реальності проти плану
- CLAUDE.md правило 12 — «детерміноване → парсер у src/data/, не AI»
- Архітектурні принципи з `ROADMAP.md` секція 🧭 («один мозок», pure functions, Supabase-ready)
