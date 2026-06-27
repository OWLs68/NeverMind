# AI Tools — Довідник інструментів агента

> Єдине місце правди для всіх `INBOX_TOOLS` + майбутніх UI tools.
> При додаванні/зміні tool — оновлювати цей файл.
>
> **Створено 18.04.2026** (сесія VJF2M) — у рамках пункту 4.17 ROADMAP.

---

## 📊 Статус

| Категорія | Готово | В планах |
|-----------|--------|----------|
| CREATE (створення записів) | 7 | — |
| COMPLETE (виконання) | 2 | — |
| EDIT (редагування) | 4 | — |
| DELETE (видалення) | 4 | — |
| ІНШЕ (утиліти) | 7 | — |
| ЗДОРОВ'Я | 9 | — |
| ПАМ'ЯТЬ | 1 | — |
| КАТЕГОРІЇ ФІНАНСІВ | 5 | — |
| **UI TOOLS (4.17)** | **8** | **6** |
| **Разом** | **47** | **6** |

**Джерело реальних definitions:** `src/ai/prompts.js` → `INBOX_TOOLS` (готові) і `src/ai/ui-tools.js` (UI tools, у планах).

---

## 🗂️ Структура довідника

1. **Готові tools** — детальний список усіх 39 існуючих з опис-рядком, параметрами, типовими викликами
2. **UI Tools (4.17)** — 14 нових у планах, з повними definitions і промпт-правилами
3. **Промпт-правила** — як AI розуміє коли викликати tool
4. **Зв'язки** — хто куди диспатчить, де handlers

---

## ✅ Готові tools

### CREATE — створення нових записів (8) + delete_list (v3pexs списки)

| Tool | Коли викликати | Ключові параметри |
|------|----------------|-------------------|
| `save_task` | Дієслово-інфінітив/наказ ("купи", "зробити") | `title`, `text`, `steps[]`, `due_date`, `priority` |
| `save_list` | **(v3pexs)** Список-чекліст — набір САМОСТIЙНИХ пунктів ("склади список покупок: X, Y", "купити: X, Y"). Окрема сутність `nm_lists`, картка-чекліст у стрічці Inbox, **НЕ задача**. Детермінований `list-detector` маршрутизує ще до AI; guard `dropTaskOnList` — бекстоп | `title`, `items[]`, `comment` |
| `delete_list` | **(v3pexs)** Видалити список (undo / явне видалення) | `list_id` |
| `save_note` | Думки, рефлексія, емоції, стан здоров'я БЕЗ терміну | `text`, `folder`, `comment` |
| `save_habit` | Регулярна дія ("щодня", "кожен ранок", "тричі на тиждень") | `name`, `days[]`, `target_count` |
| `save_moment` | Факт що вже стався БЕЗ дати в майбутньому | `text`, `mood`, `comment` |
| `create_event` | Факт що СТАНЕТЬСЯ з датою (приїзд, зустріч) | `title`, `date`, `time`, `priority` |
| `save_finance` | Сума грошей — витрата або дохід | `fin_type`, `amount`, `category`, `subcategory` (опц.), `fin_comment`, `date` (опц.) |
| `create_project` | Масштабна ціль на тижні/місяці | `name`, `subtitle`, `comment` |

### COMPLETE — виконання (2)

| Tool | Коли | Параметри |
|------|------|-----------|
| `complete_task` | Юзер каже що зробив задачу(і) | `task_ids[]` |
| `complete_habit` | Юзер каже що виконав звичку(и) | `habit_ids[]` |

### EDIT — редагування (4)

| Tool | Тригер | Параметри |
|------|--------|-----------|
| `edit_task` | "перенеси задачу", "зміни пріоритет" | `task_id`, `title`, `due_date`, `priority` |
| `edit_habit` | "зміни звичку", "щодня→щотижня" | `habit_id`, `name`, `days[]`, `details` |
| `edit_event` | "перенеси подію на 25", "зміни час" | `event_id`, `date`, `time`, `title` |
| `edit_note` | "зміни нотатку", "переклади у папку" | `note_id`, `text`, `folder` |

### DELETE — видалення (4)

| Tool | Параметри |
|------|-----------|
| `delete_task` | `task_id` |
| `delete_habit` | `habit_id` |
| `delete_event` | `event_id` |
| `delete_folder` | `folder` (назва) |

### ІНШЕ — утиліти (7)

| Tool | Призначення |
|------|-------------|
| `reopen_task` | Повернути закриту задачу в активні |
| `add_step` | Додати кроки до існуючої задачі |
| `move_note` | Перемістити нотатку в іншу папку |
| `update_transaction` | Змінити суму/категорію транзакції |
| `set_reminder` | "нагадай мені о 18:00 випити пігулку" — ЗАВЖДИ тут, ніколи `save_task` |
| `restore_deleted` | Відновити видалений запис з кошика (`query`, `type`) |
| `save_routine` | Зберегти розпорядок дня для днів тижня |
| `clarify` | Запитати уточнення (тільки коли 2+ типів неоднозначно) |

### ЗДОРОВ'Я — ВИДАЛЕНО (EU AI Act compliance JMQuT 17.05.2026)

🚫 **11 AI-tools видалено** з prompts.js: `create_health_card`, `edit_health_card`, `delete_health_card`, `update_health_card_status`, `add_medication`, `edit_medication`, `delete_medication`, `log_medication_dose`, `add_allergy`, `delete_allergy`, `add_health_history_entry`.

**Чому:** EU AI Act (Annex III) + GDPR Article 9 — AI не повинен приймати рішення про health-стан. Деталі: `docs/AI_ACT_COMPLIANCE.md`.

**Що AI робить тепер з health-фразами:** `save_note(folder='Здоровʼя')` з оригінальним текстом юзера, без створення карток/ліків/алергій. UI CRUD Health-вкладки залишається — юзер сам редагує.

### ПАМ'ЯТЬ (1)

| Tool | Критерії |
|------|----------|
| `save_memory_fact` | СТІЙКИЙ факт про юзера (сім'я/робота/здоров'я/цілі). НЕ для разових емоцій/задач. | `fact` (3-15 слів), `category`, `ttl_days` |

### КАТЕГОРІЇ ФІНАНСІВ — Фаза 4 K-02 (5)

| Tool | Тригер |
|------|--------|
| `create_finance_category` | "додай категорію X", "створи категорію Y як дохід" |
| `edit_finance_category` | "перейменуй X на Y", "зроби Їжу зеленою", "заархівуй" |
| `delete_finance_category` | "видали категорію X" (операції збережуться) |
| `merge_finance_categories` | "об'єднай X і Y" |
| `add_finance_subcategory` | "додай в Їжу підкатегорію Сніданок" |

---

## 🚧 UI Tools (4.17) — 8 реалізовано, 6 заблоковано

> **Статус:** 8 базових готово 18.04.2026 (сесія VJF2M) → `src/ai/ui-tools.js`.
> 6 потребують нової UI-інфраструктури — винесено у підпункти 4.17.B.

### A. Навігація

| Tool | Статус | Юзер каже |
|------|--------|-----------|
| `switch_tab` | ✅ | "покажи календар", "відкрий фінанси" |
| `open_memory` | ✅ | "що ти про мене знаєш" |
| `open_settings` | ✅ | "відкрий налаштування" |
| `open_calendar` | ✅ (rJYkw 21.04) | "які події заплановані" (highlight_events:true) / "відкрий календар" (false) |
| `open_record` | 🚧 блок | Треба API пошуку + highlight |
| `open_trash` | 🚧 блок | Нема UI модалки кошика |

### C. Фільтри/режими

| Tool | Статус | Юзер каже |
|------|--------|-----------|
| `set_finance_period` | ✅ | "за тиждень / місяць / 3 місяці" |
| `open_finance_analytics` | ✅ | "відкрий аналітику" |
| `calendar_jump_to` | 🚧 блок | Треба API навігації стану календаря |
| `filter_tasks` | 🚧 блок | Нема готового фільтра |

### D. Середовище

| Tool | Статус |
|------|--------|
| ~~`set_theme`~~ | ❌ **ВИДАЛЕНО 19.04.2026 (JvzDi)** — плацебо tool. `applyTheme()` лише фарбує таб-бар за поточною вкладкою, глобальної темної теми у застосунку нема. Повернемо коли буде реальна темна тема. |
| `set_owl_mode` | ✅ "Тренер / Партнер / Наставник" |

### E. Операційні

| Tool | Статус |
|------|--------|
| ~~`export_health_card`~~ | 🚫 ВИДАЛЕНО JMQuT 17.05.2026 (EU AI Act). Експорт тільки через UI кнопку у Health-вкладці. |
| `clear_chat` | 🚧 блок (per-chat storage кожного бару) |
| `toggle_owl_board` | 🚧 блок (нема toggle логіки) |

---

## 🧠 Промпт-правила

**Загальні принципи для AI при виборі tool:**

1. **Пріоритет перевірки:** виконання → нагадування → фінанси → дієслово-інфінітив → інше (повна логіка → `INBOX_SYSTEM_PROMPT` у `src/ai/prompts.js`)
2. **Антидублювання (4.12):** перед `create_*` завжди перевіряй контекст на існуючі схожі записи. Якщо є — `edit_*` або додати у history замість створення.
3. **Мінімальне тертя:** якщо юзер описує дію словами — агент виконує її tool'ом. НЕ відкриває порожню форму.
4. **UI tools:** використовуй коли юзер явно каже дію навігації ("покажи", "відкрий", "перейди", "переключись"). Для CRUD даних — звичайні tools.

**Детальні правила per-tool:** → `INBOX_SYSTEM_PROMPT` у `src/ai/prompts.js` рядки 81-153.

---

## 🔗 Зв'язки і диспетчеризація

### Inbox (готово):
- AI повертає `msg.tool_calls[]` → `sendToAI()` у `src/tabs/inbox.js` → `_toolCallToAction()` → handlers (`processSaveAction`, `processFinanceAction`, `processCompleteHabit/Task`, `clarify`, `restore_deleted`, 1 memory handler, 5 finance-cat handlers). Health handlers ВИДАЛЕНО JMQuT 17.05.2026 (EU AI Act).

### Tab chat bars (готово, через текстовий JSON):
- `callAI()` / `callAIWithHistory()` → повертає JSON з полем `action` → `processUniversalAction()` у `src/tabs/habits.js` → диспатч по action name.

### UI Tools (план 4.17):
- Новий модуль `src/ai/ui-tools.js` — масив `UI_TOOLS` + `handleUITool(name, args)` disptacher.
- Імпортується у `src/ai/prompts.js` — додається до `INBOX_TOOLS` як єдиний список для AI.
- Handlers викликають: `switchTab()`, `openModal*()`, `setTheme()`, `setFinPeriod()`, `openFinanceAnalytics()`, `jumpToDate()`, ...

---

## 📝 Історія змін

| Дата | Сесія | Зміна |
|------|-------|-------|
| 12.06.2026 | qpzj7k | **`set_project_budget` — новий project-tool.** Закриває розрив (Council-аудит вкладки Проекти): з 8 project-tools був відсутній бюджет → секція «Бюджет проекту» лишалась мертвою для нових проектів. Параметри: `project_id`, `total` (плановий бюджет), `item_name`+`item_amount` (планова стаття). Фактичні витрати — НЕ через цей tool (рахуються з Фінансів за тегом проекту, Фаза 3). Handler у `tool-dispatcher.js` `_handleProjectTool`. Project-tools: 8 → **9.** |
| 12.06.2026 | qpzj7k | **`set_project_brief` — новий project-tool.** OWL зберігає РОЗУМІННЯ проекту (що це, ціль, контекст) у поле `p.brief` перш ніж радити. Блок «Про проект» у воркспейсі; поради (план/бюджет/ризики) розблоковуються лише коли brief є. Project-tools: 9 → **10.** Поля `brief`/`images` додано у `makeProject`. |
| 12.06.2026 | qpzj7k | **`save_finance` +опційний `project_id`** (Фаза 3 інтеграції). Дозволяє тегнути витрату/дохід до проекту (тільки коли стосується активного проекту, ID з контексту). Фактичні витрати проекту агрегуються з Фінансів за цим тегом → бюджет проекту показує реальний spent без дублювання суми. Поле `projectId` додано у `makeFinance` (опційне). Additive — Supabase-friendly FK. |
| 17.05.2026 | JMQuT | 🚨 **EU AI Act Health Isolation — видалено 11 health AI-tools + 1 UI tool (`export_health_card`).** Загалом: -12 tools. AI більше НЕ створює медкартки/ліки/алергії. UI Health-вкладка повністю функціональна (юзер сам редагує). Деталі: `docs/AI_ACT_COMPLIANCE.md`. |
| 18.04.2026 | VJF2M | Створено документ. 39 готових tools + 14 у планах (4.17). |
| 18.04.2026 | VJF2M | Реалізовано 8 з 14 UI Tools (`src/ai/ui-tools.js`): switch_tab, open_memory, open_settings, set_finance_period, open_finance_analytics, set_theme, set_owl_mode, export_health_card. 6 заблокованих (open_record/open_trash/calendar_jump_to/filter_tasks/clear_chat/toggle_owl_board) — винесено у підпункти 4.17.B (потребують нової інфраструктури). **Загалом 47 tools живих.** |
| 19.04.2026 | JvzDi | **Видалено `set_theme`** — плацебо tool без реальної темної теми у застосунку. UI tools: 8 → **7 живих.** Загалом: 47 → **46 tools.** Також посилено правило `switch_tab` у промпті (ЖОРСТКЕ правило "відкрий X → switch_tab, НЕ save_task") і додано загальне правило ФОРМАТ ЧІПІВ для Inbox chat (чіпи як JSON блок у content, парсер `_parseContentChips` портовано з evening-chat). |
| 19.04.2026 | 6GoDe | **`switch_tab` — три шари захисту** від TypeError (guard у `switchTab()` у `nav.js`, DOM-check у `handleUITool`, `strict:true` у definition). **Фаза 6 Здоров'я — інтерв'ю перед `create_health_card`:** нове правило у `INBOX_SYSTEM_PROMPT` що сова питає 1-3 короткі питання з чіпами (коли почалось, був у лікаря, які ліки) перед створенням нової картки. НЕ допитується при edit/history_entry. |
| 03.05.2026 | MIeXK | **Health 6-шкала + `update_health_card_status` (Phase B Health AI-інтерв'ю).** Шкала статусів картки 3 → 6: `acute/treatment/improving/remission/chronic/done`. Старий enum `["active","controlled","done"]` у `create_health_card` + `edit_health_card` оновлено до 6 значень. Новий точковий tool `update_health_card_status(card_id, status, comment)` — для голосової зміни статусу і агрегатора AI-інтерв'ю. Handler у `tool-dispatcher.js` (чат-бари вкладок) + `inbox.js` (Inbox AI). Helper-функція `updateHealthCardStatusProgrammatic()` експортована з `health.js` (синк прогресу + автозапис у `history.status_change`). Загалом: ~60 tools (+1). Міграція legacy: `active → treatment`, `controlled → remission` через `runMigrations` v9. |
| 11.05.2026 | myshu | **G3 Universal Undo + restore_deleted query='last'.** Новий tool `restore_deleted` працює у 2 режимах: `query='last'` — universal undo останньої AI-дії з action-log; `query='all'+type` — групове відновлення з кошика. Поточно reversible 6 tools: save_task / save_finance / save_habit / create_event / set_reminder / save_routine. Тригер-фрази «відміни/скасуй/верни» БЕЗ іменника. UNDO_RULES додано у BASE_CHAT_RULES (всі 8 чатів). |
| 12.05.2026 | db0YY | **B-172 КРИТИЧНА — `type:"integer"` → `type:"string"` для всіх 28+ ID-полів схем tools.** myshu UUID-міграції зробили ID-поля UUID-string, але schemas tools у `prompts.js` лишились `integer` → OpenAI Strict mode silent відкидав AI-виклики delete/edit/update для 7 entity типів. Зачеплено: project_id (9), step_id (1), habit_id (3 + habit_ids array), event_id (2), note_id (1), card_id (7), med_id (1), allergy_id (1), transaction id (2). Tasks myshu виправила правильно (task_id уже string), решту 7 типів забула. **B-177:** для 3 delete-tools (delete_event/delete_health_card/delete_allergy) додано повні descriptions «UUID X з контексту [ID:xxxx-xxxx]. НЕ вигадуй — копіюй точно». **B-173:** AI prompts examples з числовими ID `event_id:123/456` замінено на UUID-формат у `GLOBAL_TOOLS_RULE`. **medID→ID** уніфіковано (health.js:1708). **Universal undo coverage:** додано `create_health_card` + `add_allergy` reversers (action-reversers.js), 3 нових cases у processUniversalAction (delete_transaction/delete_health_card/delete_allergy) щоб undo через DI справді працював. |
