# NeverMind — DATA_SCHEMA

> **Створено:** нічна сесія qG4fj 25.04.2026 (Підсесія 1 стандартизацій перед Supabase, Фаза 1 — інвентаризація без коду).
>
> **Мета:** єдине джерело правди про структури даних. Зараз — щоб бачити різнобій. Потім — щоб мігрувати на Supabase без втрат.
>
> **Метод:** автоматичний агент прочитав РЕАЛЬНИЙ код 8 вкладок + всі модулі OWL/AI/core. Не довіряли застарілим описам у `TECHNICAL_REFERENCE.md`.

---

## 📑 Зміст

1. [Огляд проблеми](#огляд-проблеми)
2. [8 основних типів даних](#8-основних-типів-даних) — Task / Note / Habit / Transaction / Project / Event / Moment / TrashItem
3. [Повний список localStorage ключів](#повний-список-localstorage-ключів) — 60+ ключів за категоріями
4. [Конфлікти і червоні прапори](#конфлікти-і-червоні-прапори) — що зламається при міграції
5. [Цільовий формат після Supabase](#цільовий-формат-після-supabase)
6. [План міграції](#план-міграції) — Migration Engine, бекапи, версіонування

---

## Огляд проблеми

### Як це працює зараз

NeverMind зберігає всі дані у `localStorage` — **60+ ключів** під префіксом `nm_*`. Кожен модуль вирішує сам як зберігати — звідси різнобій:

- **ID** — всюди `Date.now()` (число у мілісекундах). Дві колізії: (а) два об'єкти створені в одну мілісекунду отримають однаковий ID; (б) Supabase очікує UUID.
- **Дати** — **4 формати одночасно**: число `Date.now()`, ISO рядок `YYYY-MM-DD`, локальний `toDateString()` («Wed Apr 24 2026»), текст `HH:MM`. Між форматами не порівнюються без приведення.
- **Назви полів** — `ts` vs `createdAt` vs `lastActivity` означають одне й те саме у різних типах. Біль при JOIN-запитах у Supabase.
- **Legacy поля** — `priority`, `dueDate`, `subcategory`, `updatedAt` додавались поступово. Старі юзери не мають цих полів — `undefined` буде ламати тип-чекінг.
- **API-ключ OpenAI у localStorage** — `nm_gemini_key`. Видно з DevTools, експортується разом з даними. Критично виправити при міграції на бекенд.

### Чому це зараз працює

Тому що **один юзер на одному пристрої**. localStorage — це Map<string, string>, без типів, без констрейнтів. JavaScript ігнорує `undefined` поля. Поки не треба JOIN між таблицями — різнобій непомітний.

### Чому це зламається на Supabase

- **Жорстка схема таблиць** — кожне поле має тип. `null` ≠ `undefined` ≠ відсутнє поле.
- **Foreign keys** — Project посилається на Note через текстове ім'я папки (`name`). Це поламається коли папки переіменують.
- **UUID primary keys** — стандарт Supabase. Перетворити `Date.now()` → UUID = одноразова міграція.
- **Real-time sync** — потребує детального payload у івентах змін (зараз `nm-data-changed` шле тільки рядок `'tasks'`).

---

## 8 основних типів даних

### 1. Task — `src/tabs/tasks.js:150` (`saveTask`)

| Поле | Тип | Як заповнюється | Опційне | Примітка |
|---|---|---|---|---|
| `id` | number | `Date.now()` | ні | 🚨 потребує UUID |
| `title` | string | вхідний параметр | ні | |
| `desc` | string | вхідний параметр | так | |
| `steps` | array of `{id, text, done}` | масив об'єктів | так | |
| `status` | `'active' \| 'done'` | enum | ні | |
| `createdAt` | number ms | `Date.now()` | ні | 🚨 потребує ISO 8601 |
| `updatedAt` | number ms | `Date.now()` | так | додається тільки при редагуванні |
| `completedAt` | number ms | `Date.now()` | так | при `status='done'` |
| `dueDate` | string `YYYY-MM-DD` | ISO рядок | так | legacy для календаря |
| `priority` | `'normal' \| 'important' \| 'critical'` | enum | так | legacy для AI |

**Step (вкладений):** `{id: Date.now() | Date.now()+Math.random(), text, done}` — `id` мішаний формат щоб уникнути колізій.

**Червоні прапори:** `createdAt/updatedAt/completedAt` у мс vs `dueDate` у ISO — несумісні без приведення. Старі задачі не мають `priority/dueDate`.

---

### 2. Note — `src/tabs/notes.js:140` (`saveNote`)

| Поле | Тип | Як заповнюється | Опційне |
|---|---|---|---|
| `id` | number | `Date.now()` | ні |
| `text` | string | вхідний параметр | ні |
| `folder` | string | або `'Загальне'` | ні |
| `source` | `'manual' \| 'inbox' \| 'routine'` | enum | так (legacy) |
| `ts` | number ms | `Date.now()` | ні |
| `updatedAt` | number ms | `Date.now()` | так |
| `lastViewed` | number ms | `Date.now()` | так (legacy) |

**Червоні прапори:** 3 часові поля (`ts`, `updatedAt`, `lastViewed`) — несумісні з рештою (де `createdAt/updatedAt`). `folder` — текстовий ключ, нормалізація апострофів через `normalizeFolderName`.

---

### 3. Habit — `src/tabs/habits.js:252` (`saveHabit`)

| Поле | Тип | Опційне |
|---|---|---|
| `id` | number `Date.now()` | ні |
| `name` | string | ні |
| `details` | string | так |
| `emoji` | string (default `'⭕'` для build, `'🚫'` для quit) | так |
| `days` | `[0..6]` (0=Пн, 6=Нд) | ні |
| `targetCount` | number (default 1) | ні |
| `type` | `'build' \| 'quit'` | ні |
| `createdAt` | number ms | так (legacy, не у всіх) |

**Допоміжні структури:**
- `nm_quit_log` — `{[habitId]: {streak, longestStreak, relapses[], lastHeld, freedomDays}}` (дати у ISO `YYYY-MM-DD`)
- `nm_habit_log2` — `{[toDateString()]: {[habitId]: count}}` (🚨 ключ — локальний рядок «Wed Apr 24 2026», непортативно)

**Червоні прапори:** `nm_habit_log2` ключі у форматі `toDateString()` — залежить від системного часового поясу. На Supabase треба ISO.

---

### 4. Transaction — `src/tabs/finance-modals.js:313` (`saveFinTransaction`)

| Поле | Тип | Опційне |
|---|---|---|
| `id` | number `Date.now()` | ні |
| `type` | `'expense' \| 'income'` | ні |
| `amount` | number | ні |
| `category` | string (назва) | ні |
| `subcategory` | string | так (legacy B-53) |
| `comment` | string | так |
| `ts` | number ms або обрана дата | ні |

**Окремо `nm_finance_cats`:** `{expense: Cat[], income: Cat[]}` де `Cat = {id, name, icon, color, order, archived}`. ID категорій — UUID-подібні рядки (несумісно з Transaction.id як числом).

**Червоні прапори:** валюта зберігається у `nm_settings`, не у транзакції — при міграції втратиться якщо юзер змінив. `ts` як число vs date picker у ISO — несумісно.

---

### 5. Project — `src/tabs/projects.js:349` (`saveNewProject`)

| Поле | Тип | Опційне |
|---|---|---|
| `id` | number `Date.now()` | ні |
| `name` | string | ні |
| `subtitle` | string | так |
| `steps` | `[{id, text, done, doneAt}]` | так |
| `progress` | number (0-100) | так |
| `budget` | `{total, spent, items}` | так |
| `metrics` | array | так |
| `decisions`, `risks`, `resources` | AI-генеровані | так |
| `lastActivity` | number ms | так |
| `tempo`, `tempoNow`, `tempoMore`, `tempoIdeal` | string | так |
| `notesPreview` | string | так |

**Червоні прапори:** зв'язок з нотатками через `name` як ключ — поламається при перейменуванні папки. Багато AI-полів додавались поступово — старі проекти не мають половини.

---

### 6. Event — `src/tabs/calendar.js` + створюється у 6 місцях (B-103)

| Поле | Тип | Опційне |
|---|---|---|
| `id` | number `Date.now()` | ні |
| `title` | string | ні |
| `date` | string `YYYY-MM-DD` | ні |
| `time` | string `HH:MM` | так |
| `priority` | `'normal' \| 'important' \| 'critical'` | так (legacy) |

**Червоні прапори:** жодного dedup helper — це і є B-103. Створення розкидано по `inbox.js`, `habits.js` (3 місця), `evening-actions.js` (2 місця).

---

### 7. Moment — `src/tabs/evening.js` (`saveMoment`)

| Поле | Тип | Опційне |
|---|---|---|
| `id` | number `Date.now()` | ні |
| `text` | string | ні |
| `mood` | `'positive' \| 'neutral' \| 'negative'` | ні |
| `ts` | number ms | ні |
| `summary` | string (AI-згенерований) | так |

---

### 8. TrashItem — `src/core/trash.js`

| Поле | Тип |
|---|---|
| `type` | `'task' \| 'note' \| 'habit' \| 'inbox' \| 'folder' \| 'finance'` |
| `item` | оригінальний об'єкт (копія) |
| `extra` | додаткові дані (для folder — масив нотаток) |
| `deletedAt` | number ms |

**TTL:** 7 днів (`604800000` мс), макс 200 записів.

**Червоні прапори:** немає окремого `id` — відновлення працює через `deletedAt` як ключ. На Supabase треба окрему таблицю `trash` з UUID.

---

## Повний список localStorage ключів

### Дані (основні)

| Ключ | Тип | Модуль | Призначення |
|---|---|---|---|
| `nm_tasks` | JSON `Task[]` | tasks.js | Задачі |
| `nm_notes` | JSON `Note[]` | notes.js | Нотатки |
| `nm_habits2` | JSON `Habit[]` | habits.js | Звички (build + quit) |
| `nm_habit_log2` | JSON `{[toDateString()]: {[habitId]: count}}` | habits.js | Виконання звичок |
| `nm_quit_log` | JSON `{[habitId]: QuitStatus}` | habits.js | Quit-звички, стріки |
| `nm_finance` | JSON `Transaction[]` | finance.js | Фінансові операції |
| `nm_finance_cats` | JSON `{expense, income}` | finance-cats.js | Категорії |
| `nm_finance_budget` | JSON `{total, categories}` | finance.js | Бюджет 50/30/20 |
| `nm_events` | JSON `Event[]` | calendar.js | Події |
| `nm_moments` | JSON `Moment[]` | evening.js | Моменти дня |
| `nm_projects` | JSON `Project[]` | projects.js | Проекти |
| `nm_health_cards` | JSON `Card[]` | health.js | Медичні картки |
| `nm_inbox` | JSON `InboxItem[]` | inbox.js | Inbox |
| `nm_trash` | JSON `TrashItem[]` | trash.js | Кошик (TTL 7 днів) |

### AI-контекст

| Ключ | Тип | Модуль | Призначення |
|---|---|---|---|
| `nm_facts` | JSON `Fact[]` | memory.js | Факти про юзера (структуровані) |
| `nm_memory` | string | memory.js | Вільна памʼять OWL |
| `nm_memory_ts` | string (число) | memory.js | Час останнього оновлення памʼяті |

### Чати (8 вкладок + персональні)

| Ключ | Тип | Призначення |
|---|---|---|
| `nm_chat_inbox` | JSON `{messages, history}` | Чат Inbox |
| `nm_chat_tasks` | JSON | Чат Продуктивності |
| `nm_chat_notes` | JSON | Чат Нотаток |
| `nm_chat_health` | JSON | Чат Здоровʼя |
| `nm_chat_me` | JSON | Чат «Я» |
| `nm_chat_projects` | JSON | Чат Проектів |
| `nm_chat_finance` | JSON | Чат Фінансів |
| `nm_chat_evening` | JSON | Чат Вечора |
| `nm_task_chat_[taskId]` | JSON | Персональний чат конкретної задачі |

### Вечір

| Ключ | Призначення |
|---|---|
| `nm_evening_mood` | Настрій дня (`bad`/`meh`/`ok`/`good`/`fire`) |
| `nm_evening_summary` | AI-підсумок (legacy) |
| `nm_evening_closed` | `{closed_at, locked}` |
| `nm_evening_topic_started` | `{[topicKey]: timestamp}` |

### OWL (AI агент)

| Ключ | Призначення | Notes |
|---|---|---|
| `nm_owl_board` | Legacy старі повідомлення | deprecated |
| `nm_owl_board_unified` | Уніфіковані повідомлення (Шар 2) | поточний |
| `nm_owl_board_ts` | Час останньої спроби запиту | ms |
| `nm_owl_last_board_ts` | Час останнього отриманого повідомлення | ms |
| `nm_owl_tab_[tab]` | Повідомлення вкладки | deprecated v2 |
| `nm_owl_tab_ts_[tab]` | Час оновлення вкладки | ms |
| `nm_owl_ignored_msgs` | Лічильник проігнорованих | counter |
| `nm_owl_silence_until` | До коли OWL мовчить | ms |
| `nm_owl_questions` | Черга питань | array |
| `nm_owl_cooldowns` | `{[type]: timestamp}` | per-type |
| `nm_owl_api_error` | Останній API-error | text + ts |
| `nm_owl_cache_cleared_v3` | Migration flag | `'1'` |
| `nm_owl_silence_reset_v5` | Migration flag | `'1'` |
| `nm_owl_board_migrated_v2` | Migration flag | `'1'` |

### Налаштування і API

| Ключ | Призначення | 🚨 Risk |
|---|---|---|
| `nm_settings` | `{currency, owl_mode, theme, ...}` | |
| `nm_active_tabs` | Активні вкладки при завантаженні | legacy |
| `nm_routine` | Розпорядок дня `{[day]: blocks[]}` | |
| `nm_gemini_key` | OpenAI API ключ | 🔴 SECURITY: видно з DevTools |

### Onboarding / гайд

| Ключ | Призначення |
|---|---|
| `nm_guide_step` | Поточний крок |
| `nm_guide_waiting_topic` | Тема яка очікує відповіді |
| `nm_guide_shown_topics` | Показані теми |
| `nm_guide_shown_tips` | Показані tips |
| `nm_guide_last_ts` | Час останньої взаємодії |
| `nm_survey_done` | Опитування пройдено (`'1'`) |
| `nm_onboarding_done` | Onboarding завершено (`'1'`) |
| `nm_tab_first_visit` | `{[tabName]: timestamp}` |
| `nm_seen_update` | Поточна версія (для update banner) |

### Інше

| Ключ | Призначення |
|---|---|
| `nm_reminders` | Нагадування `Reminder[]` |
| `nm_project_interview_name` | Тимчасово під час інтервʼю |
| `nm_project_interview_step` | Крок інтервʼю |
| `nm_folders_meta` | `{[folder]: {icon, color, pinned}}` |
| `nm_folders_apostrophe_migrated` | Migration flag апострофів |
| `nm_health_log_cleared_v6` | Migration flag |
| `nm_health_migrated_v2` | Migration flag |
| `nm_facts_migrated` | Migration flag памʼяті |
| `nm_fin_benchmark` | Бенчмарк витрат (deprecated) |
| `nm_fin_coach_week` / `_month` / `_3months` | AI-коачинг кеш |
| `nm_fin_insight_week_0` / `_month_0` / `_3months_0` | Інсайти кеш |
| `nm_chip_stats` | Статистика чіпів |
| `nm_chip_payloads` | Phase 3 Шар 6 (RGisY 04.05): map `{chipId: payload}` для denormalized chip-payload (раніше було inline у chat_log[].chips[].payload). Quota-safe (Council Critic Р7). chip.id === payloadId (1:1). |
| `nm_chip_payloads_lastGC` | Phase 7 Шар 6: timestamp останнього `_gcChipPayloads` запуску. GC раз на 7 днів АБО якщо >500 keys. |
| `nm_chips_v10_done` | Phase 7 Шар 6: прапор v10 міграції (chip.id UUID + payload externalization + ✔️→complete для legacy). |
| `nm_chat_<tab>_backup_v10` | Per-key бекап перед v10 міграцією (8 ключів). Quota-safe (per-key замість одного великого `nm_backup_v10`). |
| `_nm_quota_warned` | Phase 5 Шар 6 (in-memory window-flag, НЕ localStorage): один toast-warning на сесію при QuotaExceededError у saveChatMsg. |
| `nm_error_log` | Помилки `Error[]` |
| `nm_last_active` | Час останньої активності (ms) |
| `nm_last_active_day` | День (ISO `YYYY-MM-DD`) |
| `nm_visited_[tabName]` | Чи відвідав вкладку (`'1'`) |
| `nm_sync` | Для BroadcastChannel між вкладками |

---

## Конфлікти і червоні прапори

### 🔴 Критичні (зламають Supabase-міграцію)

**1. ID format — `Date.now()` всюди**
- 7 з 8 типів використовують `Date.now()` як `id` (Task, Note, Habit, Transaction, Event, Project, Moment)
- Колізія: 2 створення в одну мс = однаковий ID
- Supabase: primary key очікує UUID
- TrashItem не має `id` взагалі — використовує `deletedAt` як ключ
- FinCategory має UUID-подібні рядкові ID — несумісно з рештою

**Дія при міграції:** `crypto.randomUUID()` для всіх нових об'єктів + перетворення існуючих (по одному типу за крок).

**2. Date format — 4 формати одночасно**

| Формат | Де | Приклад |
|---|---|---|
| number ms | Task.createdAt, Note.ts, Transaction.ts, Project.lastActivity, Moment.ts, TrashItem.deletedAt | `1745524800000` |
| ISO `YYYY-MM-DD` | Event.date, Task.dueDate, Quit-Habit.lastHeld, Quit-Habit.relapses[] | `'2026-04-25'` |
| `toDateString()` | nm_habit_log2 ключі | `'Wed Apr 24 2026'` 🚨 непортативно |
| `HH:MM` text | Event.time | `'14:30'` |

**Дія при міграції:** все на ISO 8601 з UTC (`new Date().toISOString()` → `'2026-04-25T14:30:00.000Z'`).

**3. Поле `nm_gemini_key` — OpenAI API ключ у localStorage**
- Видно через DevTools Application → Local Storage
- Експорт даних включить ключ
- **При міграції:** ключ переноситься на бекенд (Supabase Edge Function), юзер його взагалі не бачить — пункт 4.17 ROADMAP

### 🟡 Середні (некомфортно, але мігрують)

**4. Поля що означають одне й те саме мають різні назви**

| Концепт | Task | Note | Transaction | Event | Project | Moment | TrashItem |
|---|---|---|---|---|---|---|---|
| Створено | `createdAt` | `ts` | `ts` | (нема) | (нема) | `ts` | (нема) |
| Оновлено | `updatedAt` | `updatedAt` | (нема) | (нема) | `lastActivity` | (нема) | (нема) |
| Завершено/видалено | `completedAt` | (нема) | (нема) | (нема) | (нема) | (нема) | `deletedAt` |

**Дія при міграції:** єдина схема `{created_at, updated_at, deleted_at?}` для всіх таблиць.

**5. Legacy поля які можуть бути undefined у старих юзерів**

| Тип | Legacy поля |
|---|---|
| Task | `dueDate`, `priority`, `updatedAt`, `completedAt` |
| Note | `source`, `updatedAt`, `lastViewed` |
| Habit | `createdAt` |
| Transaction | `subcategory` |
| Event | `priority`, `id` (іноді не явно) |
| Project | більшість метрик/AI-полів |

**Дія при міграції:** дефолти у Supabase (`DEFAULT NULL`) + backfill старих об'єктів через міграційний скрипт.

**6. Дублювання даних**

- `nm_owl_board` (legacy) + `nm_owl_board_unified` (поточний) — старі юзери можуть мати обидва
- `nm_health_log` (legacy, deprecated) — потенційно існує у юзерів які не пройшли v6 cleanup
- `nm_fin_benchmark` (deprecated)

**Дія:** при міграції — ігнорувати legacy ключі, переносити тільки актуальні.

### 🟢 Дрібні

**7. `nm-data-changed` payload — тільки рядок типу**

```javascript
window.dispatchEvent(new CustomEvent('nm-data-changed', { detail: 'tasks' }));
```

Зараз — просто `'tasks'` / `'notes'` / etc. Real-time sync на Supabase потребує знати **що саме змінилось** (`{type, action, id, timestamp}`). Це Підсесія 3 за планом nudNp.

**8. FinCategory.id — UUID-подібні рядки vs Transaction.id як `Date.now()`**

Категорія посилається з транзакції через `category` (текстове ім'я). Якщо переіменувати категорію — старі транзакції загубляться.

**Дія:** на Supabase — foreign key з UUID, Transaction.category_id → FinCategory.id.

---

## Цільовий формат після Supabase

### Принципи цільової схеми

- **ID:** UUID v4 (`crypto.randomUUID()`) — `'a3f5b1c2-...'` рядок
- **Дати:** ISO 8601 з UTC — `'2026-04-25T14:30:00.000Z'`
- **Часові поля:** єдиний набір `{created_at, updated_at?, deleted_at?}` — без `ts`/`lastActivity`/`completedAt` — стандарт для всіх таблиць
- **Foreign keys:** Project.note_folder_id → Note.folder_id (а не текстове ім'я), Transaction.category_id → FinCategory.id
- **Soft delete:** замість фізичного видалення — `deleted_at` + 7 днів grace period (зараз робить TrashItem окремо, на Supabase — поле в кожній таблиці)
- **Enum** як Postgres `CHECK` constraint, не як рядок: `status IN ('active', 'done')`

### Цільова схема — приклад Task

```typescript
type Task = {
  id: string;              // UUID
  user_id: string;         // FK → auth.users
  title: string;
  desc: string | null;
  status: 'active' | 'done';
  priority: 'normal' | 'important' | 'critical';
  due_date: string | null; // ISO date 'YYYY-MM-DD'
  steps: { id: string, text: string, done: boolean }[];
  created_at: string;      // ISO timestamp
  updated_at: string | null;
  completed_at: string | null;
  deleted_at: string | null;
};
```

Аналогічно — для Note, Habit, Transaction, Project, Event, Moment. TrashItem зникає як окремий тип — `deleted_at` поле у кожній таблиці заміняє його роль.

### Не переносимо на Supabase

Це залишається у localStorage (швидкий локальний кеш):
- `nm_evening_topic_started` — тимчасовий стан
- `nm_owl_*` (cooldowns, silence_until, ignored_msgs) — runtime-стан проактивності
- `nm_guide_*` — onboarding прогрес (один раз пройшов і забув)
- `nm_visited_*`, `nm_tab_first_visit` — UI-флаги першого візиту
- `nm_seen_update` — версія для update-banner
- Migration flags — `nm_*_migrated_*`, `nm_*_cleared_*`
- `nm_chip_stats` — статистика UX, не критично
- `nm_error_log` — клієнтський лог
- `nm_*_coach_*`, `nm_*_insight_*` — кеш AI-обчислень

---

## План міграції

### Філософія Migration Engine

Зараз робимо **локальну** міграцію — `Date.now()` → UUID, `number ms` → ISO. Юзер відкриває застосунок → код у `boot.js` бачить що `nm_db_version` менше за target → робить **бекап усього localStorage** під ключем `nm_backup_v0` → перетворює дані → бампить версію.

Ризик: якщо щось пішло не так — юзер втратить дані. Тому **бекап обов'язковий** — у разі помилки Migration Engine відновлює зі snapshot.

### Архітектура (приклад коду від Gemini, готовий)

```javascript
// src/core/boot.js (нова функція)
function runMigrations() {
  const currentVer = parseInt(localStorage.getItem('nm_db_version') || '0');
  const targetVer = 1;
  if (currentVer >= targetVer) return;
  
  // Бекап перед будь-якою зміною
  const backup = JSON.stringify(localStorage);
  localStorage.setItem(`nm_backup_v${currentVer}`, backup);
  
  try {
    if (currentVer < 1) {
      // Пілот: Task.id → UUID
      let tasks = JSON.parse(localStorage.getItem('nm_tasks') || '[]');
      tasks = tasks.map(t => ({ ...t, id: t.id || crypto.randomUUID() }));
      // Якщо id уже UUID-рядок — лишаємо. Якщо число — переробляємо у UUID.
      tasks = tasks.map(t => 
        typeof t.id === 'number' 
          ? { ...t, legacy_id: t.id, id: crypto.randomUUID() } 
          : t
      );
      localStorage.setItem('nm_tasks', JSON.stringify(tasks));
    }
    localStorage.setItem('nm_db_version', targetVer.toString());
  } catch (error) {
    console.error('[migration] failed, rolling back:', error);
    // Відновлення з бекапу
    const restored = JSON.parse(backup);
    Object.keys(restored).forEach(k => localStorage.setItem(k, restored[k]));
  }
}
```

### План виконання (наступна сесія)

1. **Підсесія 1A — Migration Engine + version tracking**
   - Додати `runMigrations()` у `src/core/boot.js` перед `initApp()`
   - Бекап-механізм + try/catch + rollback
   - Ключ `nm_db_version` (стартує з 0, наступний — 1)
   - Логування у `nm_error_log` якщо помилка

2. **Підсесія 1B — Пілот-міграція Task.id**
   - У `runMigrations()` блок `if (currentVer < 1)` — Task `Date.now()` → UUID
   - Зберігаємо `legacy_id` як копію старого ID — для зворотної сумісності 1-2 версії
   - Тестування: 5+ задач у юзера → міграція → перевірка що всі задачі видно і можна редагувати

3. **Майбутні версії 2+**
   - v2: Note.id → UUID + перейменування `ts` → `created_at`
   - v3: Habit.id → UUID + `nm_habit_log2` ключі з `toDateString()` → ISO
   - v4: Transaction.id → UUID + `ts` → ISO
   - v5: Event/Project/Moment id → UUID
   - v6: TrashItem міграція в окремі soft-delete поля
   - vN: фінальна сінк зі Supabase

### Що робимо ЗАРАЗ (нічна сесія qG4fj)

**Тільки документація.** Цей файл — Фаза 1 Підсесії 1.

**НЕ робимо вночі без Романа:**
- Migration Engine код у `boot.js` — чіпає продакшн дані тестерів
- Будь-яку міграцію — тільки під контролем
- Бамп `CACHE_NAME` — не потрібен (документ, не код)

**Робимо вранці разом з Романом:**
- Імплементація `runMigrations()`
- Пілот Task.id → UUID
- Тестування на iPhone
