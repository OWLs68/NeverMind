# Стан сесії

> **Правило ротації:** у файлі детально описані **2 останні активні сесії**.
> При виклику `/finish` у новій сесії — найстарша з 2 переноситься у [`_archive/SESSION_STATE_archive.md`](../_archive/SESSION_STATE_archive.md).
> Попередні сесії до uDZmz — в архіві (w3ISi, VJF2M, Vydqm, FMykK, 14zLe, KTQZA, gHCOh, cnTkD, hHIlZ, W6MDn, VAP6z, acZEu, E5O3I, 3229b, 6v2eR, jMR6m).

**Оновлено:** 2026-04-19 (сесія **dIooU** — **Вечір 2.0 MVP ПОВНІСТЮ ВИКОНАНО**: усі 8 фаз у 3 сесіях, 9 комітів від dfb1800 до 83e42a0)

---

## ⚠️ ДЛЯ НОВОГО ЧАТУ — найважливіше

**1. 🎉 ВЕЧІР 2.0 MVP ЗАВЕРШЕНО.** Всі 8 фаз з `docs/EVENING_2.0_PLAN.md` виконано за 3 сесії: QV1n2 (Ф0 рефакторинг), dIooU (Ф1-8 функціонал). Вкладка заблокована матовим склом до 18:00 → о 18:00 тане → сова пише першою у чат з контекстом дня + червона крапка на Надіслати → ритуал (настрій, моменти, недороблені задачі з чіпами [На завтра]/[На тиждень], quit-звички [Тримався 💪]/[Зірвався]) → три CTA "📅 Про завтра" / "📔 Записати день" / "🌙 Закрити день" → AI-чат з tool calling (45 tools) + chips-pills у JSON інлайн + Verify Loop + G13 Brain Dump + Memory Echo + антидублювання → фінальний інсайт (не цифри) + значок "✓ День закрито" + запис факту у `nm_facts` (30 днів).

**2. CACHE_NAME АКТУАЛЬНЕ:** `nm-20260419-1708`.

**3. НАСТУПНИЙ КРОК — ВИБІР ІЗ ROADMAP.** Active виконано. Варіанти:
- **A. 👤 Я 65→100%** (1-2 сесії) — теплова карта 14/30 днів, автопатерни тижня
- **B. 📁 Проекти 65→100%** (2 сесії) — глибоке інтерв'ю 4 питання, стагнація, синк Витрати→Фінанси
- **C. 🏥 Здоров'я Фаза 2+3** (1-2 сесії) — CRUD через Inbox, прибрати legacy шкали
- **D. 4.17.B — 6 заблокованих UI tools** (2-3 сесії) — open_record, filter_tasks тощо
- **E. Пост-MVP Вечора** (див. `docs/EVENING_2.0_PLAN.md` секція "Після MVP") — Ритуал неділі, інтелект-карта дня, розкатка чат-двигуна на інші 7 чатів

**4. AGENT КЕРУЄ UI (4.17)** — 8 UI tools у `src/ai/ui-tools.js`. Довідник → `docs/AI_TOOLS.md`.

**5. НОВИЙ DISPATCHER** — `src/tabs/evening-actions.js::dispatchEveningTool` — 22 tools без Inbox side-effects. Передумова для пілота універсального чат-двигуна (4.10 з ROADMAP).

**6. Файли >250 рядків — skeleton+Edit.** Checkpoint-коміт після КОЖНОЇ логічної фази.

**7. Workflow Романа:** "Роби" → один таск → звіт → пропозиція наступного → чекати.

**8. Тестування:** після 18:00 потрібен real-device тест iPhone — переконатись що матове скло, танення, тригер evening-prompt з червоною крапкою, чіпи у діалозі і CTA кнопки працюють як очікується.

---

## 🔧 Сесія dIooU — Вечір 2.0 MVP виконаний цілком (Ф1-8, 3 сесії функціоналу) (19.04.2026)

### Зроблено

**Фаза 1 (коміт `dfb1800`)** — блокування вкладки до 18:00 матовим склом (backdrop-filter blur(18px) + -webkit- + @supports fallback), анімація .melting (600ms opacity+translateY+blur→0), авто-розмикання о 18:00 і замикання о 23:59 через setInterval 60с + visibilitychange listener. Нові: isEveningLocked(), updateEveningLock() у `evening.js` + overlay `#evening-lock-overlay` у `index.html` + стилі у `style.css`.

**Фаза 2 (коміт `f8d98a9`)** — `getEveningContext()` у `evening.js`: настрій, недороблені задачі з dueDate=today, закриті кроки проектів, звички summary, quit-звички статус, минулі події календаря, витрати дня топ-3. Підключено у `getAIContext()` → сова бачить вечірній зріз у ВСІХ чатах.

**Фаза 3 (коміт `3479344`)** — тригер `_checkEveningPrompt` у `followups.js` (18-23, cooldown 24 год, contentHasContent guard), новий `getEveningPromptSystem()` промпт, TRIGGER_TO_TAB+=`evening-prompt:evening`. У `addEveningBarMsg` для role=agent + closed chat → showUnreadBadge('evening','evening-send-btn'). У `openChatBar` — централізований clearUnreadBadge для БУДЬ-ЯКОЇ вкладки.

**Фаза 4 (коміт `b7e3070`)** — `getEveningChatSystem()` з JSON {text, chips} + таблиця 10 контекстів коли чіпи обов'язкові. Парсер JSON у `sendEveningBarMessage`. Рендер chips-pills під bubble через renderChips(container, chips, 'evening'). CSS `.chat-chips-row + .chat-chip` amber. Fix у `chips.js` sendChipToChat: inputId для evening тепер `evening-bar-input`.

**Фаза 5 (коміт `bc847bb`)** — переробка вмісту `#evening-scroll`. Видалено: #evening-stats-row (3 плитки), "Продуктивність дня" з кільцем 0%, #evening-finance-block, #evening-summary-block, EVENING_SUMMARY_PROMPT, generateEveningSummary, autoEveningSummary, setupAutoEveningSummary, виклик з boot.js. Додано: `renderEveningUndoneTasks()` з чіпами [На завтра]/[На тиждень], `renderEveningQuitHabits()` з [Тримався 💪]/[Зірвався] (після тапу "Тримався" показує "Тримаєшся сьогодні ✓ стрік N дн" без чіпів), локальні `_rescheduleTask(id, daysAhead)`. Emoji настрою 40→44px.

**Фаза 6 (коміт `6a99372`)** — дві CTA в `#evening-scroll` знизу: amber "📅 Поговорити про завтра" + біла "📔 Записати свій день". `openEveningTopic(topic)` — один раз на день/топік через nm_evening_topic_started. Видалено фуллскрін `#evening-dialog` + openEveningDialog/closeEveningDialog/sendDialogMessage як dead code.

**Фаза 7 (коміт `f957e94`)** — повний перехід на OpenAI tool calling (callAIWithTools + INBOX_TOOLS ~45). Новий `src/tabs/evening-actions.js::dispatchEveningTool` — 22 tools (save_task/note/moment/habit, create_event, save_finance, set_reminder, save_memory_fact, complete_task/habit, edit_*, delete_*, reopen_task, add_step, move_note, update_transaction, restore_deleted) БЕЗ Inbox side-effects. Промпт: Verify Loop (4.21), Memory Echo (4.34), G13 Brain Dump, 4.12 антидублювання. Formatчіпів — окремий JSON блок у content (не весь content як JSON). Новий `_parseContentChips(content)`.

**Фаза 8 (коміт `83e42a0`)** — фінальний ритуал закриття дня. `getEveningSummaryPromptV2()` з Episode Summary (4.31) + Mirror Mode (4.41) + Memory Echo (4.34), ЗАБОРОНА цифр-переказів. `generateEveningRitualSummary(addMsg)` + `isEveningClosed()` + `_markEveningClosed(text)` у evening-actions.js (стан у nm_evening_closed {date,ts,summary}, addFact ttlDays:30). Третя темна CTA "🌙 Закрити день" з amber-бордером. Значок "✓ День закрито" у header (evening-day-closed-badge). Listener `nm-evening-closed` → updateEveningClosedBadge у evening.js. Fix: addFact приймав позиційні args, виправлено на об'єкт `{text, category, ttlDays, source}`.

### Ключові рішення

- **Порядок фаз 4→5→6** за плановим (не 5→6→4) — щоб Ф4 підготувала AI-чіпи до часу коли Ф6 CTA preloaded діалог.
- **`add_routine_block` пропущено** — конфлікт зі схемою `nm_routine['mon']` (по дню тижня). Повна реалізація Динамічного розпорядку — окрема фіча у ROADMAP.
- **Окремий dispatcher у evening-actions.js** замість реюзу `processSaveAction` з inbox.js — щоб вечірні дії НЕ засмічували nm_inbox стрічку (Inbox створює картку як side-effect).
- **Блок "OWL · підсумок дня" видалено у Ф5** замість Ф8 — бо Ф3 вже дає совушці ритуальне повідомлення у чат-бар, дві картки одночасно = шум. Роман підтвердив "прибирай".
- **Chips-формат у content як JSON інлайн** (не весь content JSON) — щоб tool_calls + Verify Loop текст + чіпи співіснували без конфлікту парсера.

### Інциденти

- Без reset/force push. 8 чистих комітів `dfb1800 → f8d98a9 → 3479344 → b7e3070 → bc847bb → 6a99372 → f957e94 → 83e42a0`.
- Один Stream idle timeout під час /finish (скрін Романа) — продовжив компактніше.
- Edit-помилка у index.html під час Ф3 (видалив SVG кнопки Надіслати) — одразу виправив наступним edit.
- Видалив коментар `<!-- TAB BAR -->` ненавмисно → відновив.

### Метрики

- **Коміти:** `dfb1800 → ... → 83e42a0` (8 комітів Ф1-8)
- **Гілка:** `claude/start-session-dIooU`
- **Версії:** v291 → v298+ (CI мержить)
- **CACHE_NAME:** `nm-20260419-1708`
- **Нові файли:** немає (всі зміни в існуючих)
- **Змінено:** `index.html`, `style.css`, `sw.js`, `src/core/boot.js`, `src/ai/core.js`, `src/ai/prompts.js`, `src/owl/chips.js`, `src/owl/followups.js`, `src/tabs/evening.js`, `src/tabs/evening-chat.js`, `src/tabs/evening-actions.js` (з заготовки 30 рядків → ~280), `src/ui/unread-badge.js` (фактично використано)
- **Build:** локально зелений після кожної фази

---

## 🔧 Сесія QV1n2 — Планування Вечір 2.0: концепція + 3-рівнева документація (19.04.2026)

### Зроблено

**1. Стратегічне обговорення концепції Вечора** — Роман показав скрін вкладки Вечір о 14:12 з "0% важкий день", висловив сумнів "чи треба взагалі". Провели повний аудит:
- Проблема 1: вкладка бреше (показує 0% коли день ще триває)
- Проблема 2: дублює "Я" (кружечки, настрій, порівняння)
- Проблема 3: немає ритуалу закриття (dashboard замість емоційної крапки)
- Проблема 4: форми замість розмови з совою
- Проблема 5: `evening.js` 1055 рядків + змішує 2 вкладки (Я + Вечір)

**2. Сформована концепція Вечір 2.0** — 10 блоків:
- Блокування до 18:00 матовим склом + авторозмикання з анімацією танучого скла
- Сова пише першою у чат Вечора з контекстом дня + червона крапка на Надіслати
- Настрій ДО підсумку (5 емодзі, передає тон у промпт)
- Моменти дня без кнопки "+ момент"
- Недороблені задачі з чіпами [На завтра] [На тиждень]
- Quit-звички відмітка у Вечорі (фінальна точка щоденної відмітки)
- Дві великі кнопки 📅 "Поговорити про завтра" і 📔 "Записати свій день" замість форм
- Чіпи у діалозі з правилами коли показувати (таблиця з 10 типів)
- Автосинхронізація через tool calling: один діалог → задача + подія + розпорядок + пам'ять
- Підсумок з інсайтом (Episode Summary 4.31 + Mirror Mode 4.41 + Memory Echo 4.34)

**3. 8 фаз реалізації на 3 сесії** — детально у `docs/EVENING_2.0_PLAN.md`:
- Фаза 0 — рефакторинг `evening.js` (1055→4 модулі) + універсальний бейдж
- Фаза 1 — блокування до 18:00 + анімація
- Фаза 2 — `getEveningContext` + Вечір у `TRIGGER_TO_TAB`
- Фаза 3 — тригер `evening-prompt` + сова першою
- Фаза 4 — чіпи у діалозі
- Фаза 5 — контент ритуалу зверху вниз
- Фаза 6 — дві CTA кнопки з сценарними старт-повідомленнями
- Фаза 7 — tool calling автосинх (задача/подія/розпорядок/нотатка/пам'ять) + G13 Brain Dump + Memory Echo + Verify Loop
- Фаза 8 — фінальний підсумок v2 + видалення старих блоків

**4. Звірка з ROADMAP** — знайдено 12 готових концепцій які підсилюють Вечір і прив'язані у плані:
- Блокери: 4.11 (getAIContext покриття) у Фазі 2, Динамічний розпорядок — MVP без конфлікт-детектора
- Підсилювачі: 4.6 (Contextual Personality Shifts `reflecting`), 4.12 (антидублювання), 4.21 (Verify Loop), 4.31 (Episode Summary), 4.34 (Memory Echo), 4.41 (Mirror Mode), G13 (Brain Dump), G4 (Shadowing), G1+G2 (тиша + burst)
- Пілотування: Вечір 2.0 стає пілотом універсального чат-двигуна для міграції 7 інших чатів (4.9 + 4.10 з ROADMAP)

**5. 3-рівнева документація створена:**
- `ROADMAP.md` — компактно у Active (секція 🚀) з посиланнями на детальний план і перехресними посиланнями на 14 пунктів ROADMAP. Старий блок "Вечір доробка 70→100%" у Блок 2 оновлено на пойнтер до нового плану.
- `docs/EVENING_2.0_PLAN.md` — **новий файл, 544 рядки** (джерело правди): навіщо переробка, 10 блоків концепції, 8 фаз з кроками і комітами, 3 сесії з критеріями готовності, тригери+cooldowns таблиця, 3 живі сценарії діалогів, перехресні посилання з ROADMAP, success metrics, failure modes з мітигацією, пост-MVP план.
- `CONCEPTS_ACTIVE.md` — секція "🌙 Вечір" переписана на v2 коротко для юзерського світу (без технічних деталей). Стара v1 прибрана як "брехлива і дублююча Я".
- `_ai-tools/SESSION_STATE.md` — оновлено "Для нового чату" (Active = Вечір 2.0 Сесія 1) + додано опис QV1n2.
- `CLAUDE.md` — додано `docs/EVENING_2.0_PLAN.md` у Карту документації (секція "Коли читати").

**6. ФАЗА 0 РЕФАКТОРИНГУ ВИКОНАНА (2 коміти після документації):**

**Крок 1 (коміт `2e99b34`) — винесення вкладки Я:**
- Створено `src/tabs/me.js` (480 рядків): `renderMe`, `renderMeActivityChart`, `refreshMeAnalysis`, `renderMeHabitsStats`, `sendMeChatMessage`, `addMeChatMsg`, `showMeChatMessages`, `meChatHistory`
- `src/tabs/evening.js` скорочено з 1054 до 587 рядків (видалено весь Me-блок + Me AI Bar)
- Імпорти оновлено у 5 файлах: `core/nav.js`, `core/boot.js`, `ai/core.js`, `tabs/habits.js`, `owl/chips.js` — **прямі імпорти з `me.js`** замість re-exports (щоб уникнути циклічних залежностей)
- `src/app.js`: додано `import './tabs/me.js'` у правильному порядку
- Build зелений

**Крок 2 (коміт `e996f0b`) — винесення чату + універсальний бейдж + stub actions:**
- Створено `src/tabs/evening-chat.js` (204 рядки): `sendEveningBarMessage`, `addEveningBarMsg`, `openEveningDialog`, `closeEveningDialog`, `sendDialogMessage`, `addDialogMessage`, `showEveningBarMessages`, `_eveningTypingEl`, `eveningBarHistory`, `eveningBarLoading`, `dialogHistory`, `dialogLoading` + власний window.assign
- Створено `src/ui/unread-badge.js` (67 рядків): універсальна червона крапка для будь-якого чату — `showUnreadBadge(tab, sendBtnId)`, `clearUnreadBadge(tab)`, `getUnreadCount(tab)`. Використовує `Map` для in-memory лічильників.
- Створено `src/tabs/evening-actions.js` (30 рядків заготовки): пустий `EVENING_TOOL_HANDLERS` для Фази 7 автосинх
- `src/tabs/evening.js` скорочено з 587 до 413 рядків (видалено evening chat + dialog + непотрібні імпорти)
- `src/tabs/inbox.js` — `_showInboxUnreadBadge` + `_inboxUnreadCount` замінено на universal `showUnreadBadge('inbox', 'ai-send-btn')`. Backward-compat `_clearInboxUnreadBadge` → wrapper над `clearUnreadBadge('inbox')` (щоб `ai/core.js` продовжив працювати)
- Імпорти у `ai/core.js` і `owl/chips.js` перенаправлені з `evening.js` → `evening-chat.js`
- `src/app.js`: додано evening-chat.js, evening-actions.js, unread-badge.js у правильному порядку
- Build зелений

**Підсумок розподілу коду:**
| Файл | Рядків | Зміст |
|------|--------|-------|
| `src/tabs/evening.js` | 413 | Core Вечора (рендер, моменти, настрій, підсумок, moment view) |
| `src/tabs/me.js` | 480 | Повна вкладка Я (тижневий огляд + чат) |
| `src/tabs/evening-chat.js` | 204 | Чат-бар Вечора + фуллскрін діалог |
| `src/tabs/evening-actions.js` | 30 | Заготовка Фази 7 |
| `src/ui/unread-badge.js` | 67 | Універсальна червона крапка |
| **Разом** | **1194** | Було 1054 в одному файлі → 1194 у 5 модулях |

### Ключові рішення

- **Ритуал після 18:00, не дашборд.** Вкладка не показує "0% важкий день" вдень — блокується матовим склом до 18:00.
- **Дві кнопки замість полів вводу.** Живий діалог з совою замість форм. Принцип "мінімальне тертя" у найчистішому вигляді.
- **Чіпи у діалозі з балансом.** Не меню-опитування, не чистий текст — гібрид. Правила у промпті "коли так, коли ні".
- **Пілотуємо на одній вкладці перед міграцією 7-ми.** Варіант B (прогресивна міграція) проти Варіант A (одразу все). Менший ризик, швидший прогрес для юзера.
- **Окремий файл `docs/EVENING_2.0_PLAN.md`** — Jarvis-рівень організації: ROADMAP лишається компактним, деталі живуть окремо. Аналогічно `docs/AI_TOOLS.md`.
- **Фаза 0 рефакторинг ПЕРЕД функціоналом.** Не додавати 600 рядків у файл що вже 1055. Розбити на правильні модулі — потім додавати. Виконано у цій же сесії після планування.
- **Прямі імпорти у кожному файлі замість re-exports.** Варіант з `export { ... } from './me.js'` у evening.js створив би циклічну залежність evening.js ↔ evening-chat.js (бо evening-chat імпортує getMoments з evening.js, а evening.js re-export з evening-chat). Прямі імпорти у 6 залежних файлах — чистіше і без ризику циклу.
- **Backward-compat через wrapper для `_clearInboxUnreadBadge`.** Замість міняти імпорти у `ai/core.js` — залишили у inbox.js тонкий wrapper `_clearInboxUnreadBadge = () => clearUnreadBadge('inbox')`. Один рядок змін у core.js, без caskаду правок.
- **`bundle.js` локально не комітити.** Правило з CLAUDE.md. CI сам генерує при мержі у main. Локальні build — тільки для перевірки "синтаксис не зламаний", результат скидати через `git checkout -- bundle.js` перед push.

### Інциденти

- **Multiple system-reminder на правила CLAUDE.md** — нагадування про розмір відповіді, пояснення в дужках, опис вигляду замість назв. Іноді доводилось переписувати відповіді щоб вкластись у "середній розмір" замість простирадла.
- **TodoWrite reminders** — система періодично нагадувала використати TodoWrite. Використано активно для планування документації і рефакторингу по фазах.
- **Stop hook про незакоммічений `bundle.js`** — після фінального push хук попередив що bundle.js відрізняється. Повернули через `git checkout -- bundle.js`. Це правильна поведінка: bundle.js не комітимо локально, CI згенерує свою версію при мержі у main.
- **Edit конфлікт "SECTION:renderMe"** — `me.js` skeleton мав дубльований маркер через схожі назви (`renderMe` vs `renderMeActivityChart`). Вирішено через спеціфіку контексту (об'єднаний маркер двох сусідніх секцій у одному Edit).
- **Без reset/force push. 6 чистих комітів у `claude/start-session-QV1n2`:** 4 документаційних + 2 рефакторингові.
- **Node_modules не було установлено на старті.** Запустили `npm install esbuild` — вдалось за 1 виклик, build зелений.

### Метрики

- **Коміти:** `7798595` (PLAN) → `5c1b479` (ROADMAP) → `ccb1483` (CONCEPTS) → `a901450` (SESSION_STATE + CLAUDE) → `2e99b34` (refactor me.js) → `e996f0b` (refactor evening-chat + unread-badge + actions stub). **6 комітів.**
- **Гілка:** `claude/start-session-QV1n2`
- **Версія:** v288 на production (від rSTLV). Після мержу цієї гілки у main CI згенерує bundle.js і деплой v289+.
- **CACHE_NAME:** `nm-20260419-1131` (без змін — рефакторинг без UI-зміни, кеш не інвалідовано спеціально — побачимо на проді чи треба буде bump у Фазі 1).
- **Файлів створено:** 5 (`docs/EVENING_2.0_PLAN.md` 544 рядки, `src/tabs/me.js` 480, `src/tabs/evening-chat.js` 204, `src/tabs/evening-actions.js` 30, `src/ui/unread-badge.js` 67).
- **Файлів оновлено:** 9 (`ROADMAP.md`, `CONCEPTS_ACTIVE.md`, `_ai-tools/SESSION_STATE.md`, `CLAUDE.md`, `src/tabs/evening.js` 1054→413, `src/tabs/inbox.js`, `src/app.js`, `src/core/nav.js`, `src/core/boot.js`, `src/ai/core.js`, `src/owl/chips.js`, `src/tabs/habits.js`).
- **Рядків додано/змінено:** ~750 документації + ~1194 у 5 нових модулях (зустрічний рух — 641 рядок видалений з evening.js).
- **Build:** локальний `node build.js` → `bundle.js` 1.22 MB зелений після кожного коміту рефакторингу.

### Наступні кроки

- **Фази 1-3 Сесії 1 Вечора 2.0** (за окремим "Роби"):
  - Фаза 1 — блокування вкладки до 18:00 матовим склом (`backdrop-filter: blur(16px)`, CACHE_NAME bump обов'язковий) + авто-закриття о 23:59 + анімація танучого скла о 18:00
  - Фаза 2 — нова функція `getEveningContext()` у `evening.js` + підключення у `getAIContext()` у `ai/core.js`
  - Фаза 3 — новий тригер `_checkEveningPrompt()` у `followups.js` (вікно 18-22:59, cooldown 24 год) + активація `showUnreadBadge('evening', 'evening-send-btn')` коли сова кладе повідомлення
- Після Сесії 1 — Роман тестує на iPhone: до 18:00 скло з таймером, о 18:00 тане + сова пише перше повідомлення, червона крапка на Надіслати
- Сесії 2-3 — Фази 4-8 (чіпи у діалозі, контент ритуалу, дві CTA кнопки, tool calling автосинх, фінальний підсумок v2 + чистка старого)

---

## 🔧 Сесія NFtzw — Research + V2 план + Phase 0 flipbook skeleton (19.04.2026, ВІДКОЧЕНА rSTLV)

### Зроблено

**1. Глибоке дослідження анімаційних підходів — коміт `f16685b`**
- Файл `handoff/OWL_ANIMATION_RESEARCH.md` (177 рядків). Порівняння CSS/PNG vs Lottie vs Rive + індустріальні джерела (Duolingo перехід з Lottie на Rive, file-size 5MB→50KB, FPS 17→60).
- 3 початкові tier'и: PNG доробка (6/10), Lottie (6/10, не рекомендую), Rive через Fiverr ($100-200, 9/10).

**2. V2 план — самостійний шлях з Nano Banana — коміт `af90d41`**
- Файл `handoff/OWL_ANIMATION_PLAN_V2.md` (219 рядків). Принципи: усе самі, AI-сервіси як інструменти, **покадрова анімація основний шлях**, Rive learning — паралельний трек.
- 4 фази: 0 стабілізація, 1 Nano Banana покадрово (22 кадри на 4 анімації), 2 вторинна анімація завжди (дихання/кліпання), 3 Rive editor learning.
- Base prompt + 8 add-on промптів для кожного кадру махання крилом.

**3. Фаза 0 у коді — коміти `6266c17` + `7e5b479`**
- Прибрано debug SVG-крило з `style.css` (червона дашована рамка + `@keyframes wing-wave-premium`) і `<svg class="owl-wing-overlay">` з `index.html:282-284`.
- Додано 5 `<img class="owl-wave-frame" data-wave="1..5">` у `.owl-mascot` — чекають на `assets/owl/wave/frame-{1..5}.png`.
- CSS `@keyframes owl-wave-1..5` + `steps(1,end)` 600мс — кожен кадр по 120мс, жорсткий стрибок без блендингу.
- Fallback: статичний `owl-greeting.png` не ховається — показується коли wave-PNG відсутні, перекривається коли завантажені (z-index: 2).
- `CACHE_NAME`: `nm-20260419-0438` → `nm-20260419-0918`.

### Обговорено (без виконання)

- **Compound degradation у Nano Banana** — якість падає з кожною послідовною правкою. Рішення: завжди оригінал idle.png як референс, новий чат для кожного кадру.
- **Bg-removal tools:** `erase.bg` (топ — 5000×5000, безкоштовно, без кредитів), Photoroom (iOS app), Adobe Express. НЕ `remove.bg` (ріже до 500px без платної), НЕ Canva (Pro only), НЕ Claude Design (артефакти).
- **Промпт-хак "green screen":** просити Nano Banana чорний/зелений фон, потім erase.bg чистить ідеально.
- **Gap-fill кадри:** якщо у Романа буде 8 замість 5 — 3 додаткові add-on промпти (wing 15°, 30°, 80% squint transitional) — у чаті.
- **Rive learning — паралельний трек** на ноутбуці (editor не працює на телефоні), 3-4 сесії по 45 хв.

### Ключові рішення

- **Відмовились від зовнішнього дизайнера ($100-200 Fiverr).** Вчимось самі з Nano Banana — Роман прямо попросив "побудуй план де ми самі навчимося і зробимо все самі з допомогою сервісів".
- **Відмовились від Lottie** — безкоштовних owl-анімацій у amber-палітрі немає, ініціатива без реального покращення.
- **Відмовились від SVG-крила overlay** — живе SVG на статичній PNG ріже око (uDZmz підтвердив).
- **Покадрова PNG — основний шлях**, Rive — майбутнє/опціонально.
- **Fallback у CSS greeting** — не ховати статичний PNG, щоб broken-img не давав порожнечу.

### Інциденти

- **2× stream idle timeout** під час запису першої версії `OWL_ANIMATION_RESEARCH.md` — перейшов на skeleton+Edit підхід, третя спроба з компактнішим Write (177 рядків) спрацювала.
- **Гілка нестандартного формату** — `claude/owl-animation-research-NFtzw` замість `claude/start-session-NFtzw` (Claude Code runtime створив під задачу). Суфікс NFtzw використовую як session ID.
- **Stop hook наполягав на push** після Фази 0 — пофіксив через додавання fallback (статичний greeting не ховається при broken wave-PNG), пушнув без ризику порожнечі на продакшені.
- Без reset/force push. 4 коміти чистих.

### Оновлення після першого /finish (повторний виклик)

- **`adf508f` fix path:** Роман залив 5 PNG без `wave/` префіксу у `assets/owl/`. Замість переробки upload — виправлено HTML на `src="assets/owl/frame-{1..5}.png"`. CACHE_NAME bump `nm-20260419-0918` → `nm-20260419-1044`.
- **Роман залив 5 PNG** через GitHub Web (коміт `215a8f7 Add files via upload`).
- **Деплой v284** на `main` (12:45) — підтверджено `git fetch`.
- **ТЕСТУВАННЯ НА ТЕЛЕФОНІ v284:** сова залишається idle, **махання не спрацьовує**. Виявлено дві проблеми:
  1. Priority state-machine блокує greeting (гіпотеза: alert=80 перебиває greeting=40 boot-тригер)
  2. Шахові клітинки ліворуч від сови — запечений шаховий фон у PNG (не прозорість)

### Метрики

- **Коміти:** `f16685b` → `af90d41` → `6266c17` → `7e5b479` → `c59eacd` (docs) → `bdd610e` (docs) → `adf508f` (path fix). **7 комітів сесії** + коміт Романа `215a8f7` з 5 PNG.
- **Гілка:** `claude/owl-animation-research-NFtzw` (нестандартний формат)
- **Версії:** v277 → v284 на production
- **CACHE_NAME:** `nm-20260419-1044`
- **Build:** чистий (локальний `node build.js` зелений)
- **Нові файли:** `handoff/OWL_ANIMATION_RESEARCH.md`, `handoff/OWL_ANIMATION_PLAN_V2.md`, `assets/owl/frame-{1..5}.png` (від Романа)

---

## 🔧 Сесія uDZmz — Priority state-machine + SVG-крило + нові PNG сови (19.04.2026)

### Зроблено

**1. Priority state-machine сови (Крок 1) — коміт `5ed8d05`**
- Замінено `setOwlMascotState` у `src/owl/board.js`: додано `OWL_PRIORITY` (error=100 > alert=80 > thinking=60 > greeting=40 > idle=0). Нижчий пріоритет не перебиває вищий — **вирішує w3ISi пункт 2 (greeting↔alert конфлікт)**.
- **Ticket-лічильник `_owlMascotTicket`** + **failsafe 30 сек** для станів без autoRevertMs. Реверт у idle — лише якщо за час таймера не було нового виклику (захист від race condition при швидких переключеннях).
- `visibilitychange` listener додає клас `.is-paused` на `#owl-mascot-main` коли PWA у фоні → CSS `animation-play-state: paused !important` зупиняє всі дочірні анімації. Економія батареї.

**2. SVG-крило overlay замість sprite-sheet (Крок 2) — коміт `585cbbd`**
- Видалено `<div class="owl-mascot-sprite">` з `index.html`, додано `<svg class="owl-wing-overlay" viewBox="0 0 120 120">` з path крила.
- Видалено CSS блок sprite + `@keyframes owl-wave-sprite` + правило ховання greeting frame.
- Додано `@keyframes wing-wave-premium` (безшовний 0%=100%, cubic-bezier easing) + `@keyframes owl-head-tilt` 8° для thinking.
- `prefers-reduced-motion`: SVG-крило і head-tilt вимкнені.

**3. Debug-режим діагностики позиції — коміт `e4bba2d`**
- `.owl-wing-overlay { opacity: 1 !important; animation: infinite; outline: 2px dashed red }` — щоб бачити на телефоні чи SVG рендериться і де. **Тимчасово, прибрати у наступній сесії.**

**4. Нові PNG сови від Романа — коміти `a49d1eb`, `3ffd627`**
- Роман завантажив через GitHub Web 2 нові PNG у стилі amber/brown з прозорим фоном як `1.png` (помах крила) і `2.png` (спокій).
- `git mv`: `2.png`→`owl-idle.png`, `1.png`→`owl-greeting.png` (замінили старі "здивовані").
- `owl-alert.png`, `owl-thinking.png`, `owl-error.png`, `owl-greeting-sprite.png` — **ще старі**, чекають заміни.

**5. 4 раунди промпт-інжинірингу з Gemini через `/gemini`**
- Послідовні запити для архітектури (priority state-machine → hybrid SVG → ticket-pattern → performance checklist).
- Знайдено і виправлено 4 баги у пропозиціях Gemini: `infinite` + auto-revert, `filter: brightness` на iOS, зиґзаг очей не коло, ticket-захист не покривав циклічні стани.

### Обговорено (без виконання)

- **Flipbook-махання для greeting (план на наступну сесію):** прибрати debug, замінити SVG-крило на швидке перемикання `opacity` між `owl-idle.png` і `owl-greeting.png` 3 рази × 150 мс при `data-state="greeting"`. SVG-крило не підходить візуально — живе SVG на статичній PNG-сові ріже око. З новими парою PNG (спокій + з піднятим крилом) flipbook природньо виглядатиме як махання.
- **Заміна решти 3 PNG** (alert/thinking/error) — Роман генеруватиме через Gemini/Claude Design, коли буде час.
- **Claude Design як інструмент handoff** — спробували, але generate обривається помилками. Не підходить для художніх ассетів. Claude з Artifacts кращий.

### Ключові рішення

- **Гібрид PNG+SVG краще повного SVG** — зберегти PNG дизайн, накладати SVG для анімованих частин. АЛЕ для "махання" не працює гарно: контраст живого SVG і статичної PNG-сови ріже око. Перехід на flipbook з PNG — природніше.
- **Priority + ticket pattern** — кращі за `setTimeout` захист від race conditions.
- **Debug через `outline: dashed red`** — швидкий спосіб побачити невидимий елемент на мобільному без DevTools.
- **CSS `animation-play-state: paused` через клас на батьку** — один селектор ставить на паузу всі дочірні анімації.

### Інциденти

- **Контекст критично переповнений (220%+ за сесію)** — 30+ нагадувань `/finish`. Stream-обриви у Gemini → перейшли на копіпаст через AI Studio.
- **Крок 2 у 2 етапи:** спочатку state-machine закомічено і задеплоєно, `git stash pop` → SVG-крило окремим комітом.
- **PNG з неправильними іменами** (`1.png`, `2.png`) — Роман завантажив через GitHub Web без префікса owl-. `git mv` + видалення старих файлів.
- **Без git reset / force push.** Всі 5 комітів нормальні.

### Метрики

- **Коміти:** `5ed8d05` → `585cbbd` → `e4bba2d` → `a49d1eb` → `3ffd627`. **5 комітів.**
- **Гілка:** `claude/bird-wing-animation-uDZmz` (не стандартний `start-session-*` формат — створилась під задачу)
- **Версії:** v272 → v274+ (на момент /finish деплой в процесі)
- **CACHE_NAME:** `nm-20260419-0438`
- **Build:** чистий (локальний `node build.js` зелений)
- **Оновлені файли:** `src/owl/board.js`, `style.css`, `sw.js`, `index.html`, `assets/owl/owl-idle.png`, `assets/owl/owl-greeting.png`

---

## Проект

| | |
|--|--|
| **Версія** | v288 на проді (від rSTLV). Після мержу QV1n2 у main — v289+ з Фазою 0 рефакторингу |
| **URL** | owls68.github.io/NeverMind |
| **AI модель** | OpenAI GPT-4o-mini з Tool Calling (**47 tools:** 31 INBOX + 8 UI + 8 health/memory/cat) |
| **Гілка** | `claude/start-session-QV1n2` (6 комітів, push зелений) |
| **CACHE_NAME** | `nm-20260419-1131` (без змін — чекає Фазу 1 коли буде UI-зміна) |
| **Repo** | Public + LICENSE (All Rights Reserved) |

---

## 🗺️ Куди йде проект

**Дорожня карта — єдине місце:** [`ROADMAP.md`](../ROADMAP.md).

**🚀 Поточний Active:** **Вечір 2.0** — переробка концепції вкладки. 3 сесії, 8 фаз. Детальний план → [`docs/EVENING_2.0_PLAN.md`](../docs/EVENING_2.0_PLAN.md).

---

## 🎯 НАСТУПНИЙ КРОК — Фази 1-3 Сесії 1 Вечора 2.0

**✅ Фаза 0 зроблена** (2 коміти: `2e99b34` + `e996f0b`). Далі:

### Фаза 1 — Блокування до 18:00 + авторозмикання

1. У `src/tabs/evening.js` → `renderEvening()` — перевірка `const hour = new Date().getHours(); const locked = hour < 18;`
2. Якщо заблоковано — overlay з `backdrop-filter: blur(16px)` (з `-webkit-` fallback для iOS), темна сова з амбер-обводкою по центру, напис "Повернись після 18:00", таймер "до розблокування"
3. `setTimeout` на різницю до 18:00 → викликає `renderEvening()` знову з анімацією "скло тане зверху вниз"
4. `setTimeout` на 23:59 → замикає знову до наступного 18:00
5. **CACHE_NAME bump обов'язковий** (команда `date +"nm-%Y%m%d-%H%M"`)
6. Коміт: `feat(evening): lock tab before 18:00 with frosted glass + auto-unlock animation`

### Фаза 2 — getEveningContext + getAIContext інтеграція

1. Нова функція `getEveningContext()` у `evening.js` або `evening-chat.js`: повертає блок для промпта (моменти сьогодні, закриті задачі + проекти, виконані звички, quit-статус, минулі події календаря, настрій, транзакції дня, прийняті/пропущені дози ліків, недороблені задачі з `dueDate === today`, short-term facts)
2. У `src/ai/core.js` → `getAIContext()` — додати виклик `getEveningContext()` у загальний блок контексту
3. Коміт: `feat(evening,ai): evening context aggregator + wire into getAIContext`

### Фаза 3 — Тригер `evening-prompt` + бейдж у Вечорі

1. Нова функція `_checkEveningPrompt()` у `src/owl/followups.js` — перевіряє: `hour >= 18 && hour < 23` + `owlCdExpired('evening_prompt_daily', 24h)` + є контент у дні + `shouldOwlSpeak` дозволяє
2. Додати Вечір у `TRIGGER_TO_TAB`: `'evening-prompt': 'evening'`
3. Генерація тексту через `callAI()` з новим системним промптом (живе у `src/ai/prompts.js`)
4. Додати повідомлення через `addMsgForTab('evening', 'agent', text)` — але також викликати `showUnreadBadge('evening', 'evening-send-btn')` (ID кнопки Надіслати з HTML — треба перевірити)
5. Коли юзер відкриває чат-бар Вечора → `clearUnreadBadge('evening')` у `openChatBar`
6. Коміт: `feat(evening): OWL proactive evening-prompt trigger with unread badge`

### Альтернативні напрямки (якщо Роман змінить пріоритет)
- **A. 📁 Проекти 65→100%** (2 сесії) — глибоке інтерв'ю 4 питання, стагнація-детекція, синк Витрати→Фінанси
- **B. 👤 Я 65→100%** (1-2 сесії) — теплова карта 14/30 днів, автопатерни раз на тиждень
- **C. 🏥 Здоров'я Фаза 2+3** (1-2 сесії) — CRUD через Inbox, прибрати legacy шкали
- **D. 🚧 4.17.B — 6 заблокованих UI tools** (2-3 сесії) — open_record, open_trash, calendar_jump_to, filter_tasks, clear_chat, toggle_owl_board

---

## Відомі технічні проблеми (не вирішені)

1. **B-65** SW load failed — одноразова помилка, не відтворюється. Низький пріоритет.
2. **Tool calling тільки в Inbox** — решта чат-барів на JSON-форматі (але множинні JSON працюють через `extractJsonBlocks`)
3. **`src/core/nav.js` = 1236 рядків** — трохи більше 1200 порогу. Кандидат на розбиття (settings/theme/profile/storage)
4. **Monobank** — відкладено до Supabase
5. **~150 рядків закоментованого коду** по проекту — колись прибрати

---

## 📦 Попередні сесії

Детальні описи VJF2M, Vydqm, FMykK, 14zLe, KTQZA, gHCOh, cnTkD, hHIlZ, W6MDn, VAP6z, acZEu, E5O3I, 3229b, 6v2eR, jMR6m → [`_archive/SESSION_STATE_archive.md`](../_archive/SESSION_STATE_archive.md).
