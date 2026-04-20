# SESSION_STATE — архів попередніх сесій

## 🔧 Сесія 6GoDe — 8 фіксів якості + Здоров'я 100% + інтерв'ю при створенні картки (19.04.2026)

### Зроблено

**1. Fix `switch_tab` TypeError — коміт `e650c8f`.** Логи з iPhone показали `TypeError: null is not an object (page-${tab}.classList)`. Три шари захисту: `switchTab()` у `nav.js` тепер попереджає і виходить якщо `page-<tab>` не знайдено; `handleUITool('switch_tab')` у `ui-tools.js` перевіряє DOM наперед і повертає "Вкладка недоступна"; визначення tool отримало `strict:true` щоб OpenAI жорсткіше дотримувався enum.

**2. Fix фантомного "sw.js load failed" — коміт `e634b12`.** У `boot.js setupSW()` три виклики `reg.update()` (register, visibilitychange, pageshow) не мали `.catch()` — помилки network падали у `window.unhandledrejection` і логувались 7+ разів на добу. Додав тихі `.catch(() => {})` — шум зник.

**3. Downgrade warn→log — коміт `fc73b8e`.** Три `console.warn` були інформаційними не попередженнями: "stale message detected, forcing generation" (safety net спрацював), "smart fallback" (AI не відповів → показали заготовку), "tab fallback" (те саме для не-inbox). Змінив на `console.log` — журнал діагностики не засмічує попередженнями.

**4. Softer Auto-silence 4.40 — коміт `480604c`.** Діагностика показала спрацювання 3 рази на добу (15+ "ігнорованих" повідомлень). Правило було занадто вузьке: тільки клік чіпа скидав лічильник. Зміни: поріг 5→7 (~70хв пасивного читання), тиша 4→2 год, новий сигнал — listener `nm-data-changed` (будь-який CRUD від юзера скидає лічильник).

**5. Legacy шкал Здоров'я cleanup (3 фази) — коміти `a0344ee` → `3143364` → `36187f1`.** UI шкал 1-10 видалено ще 15.04 (B-31), але код що читав `nm_health_log` залишився у 4 місцях. Прибрав:
- Фаза 1 (`health.js`): `getHealthLog`/`saveHealthLog` експорти, legacy блок у `getHealthContext`, action `log_health` у chat-bar
- Фаза 2 (`proactive.js`): 2 мертві кореляції (сон↔звички, енергія↔задачі), health board контекст з порожніми плейсхолдерами. Кореляції 3 (пізні записи) і 4 (настрій↔витрати) залишив — вони на інших даних.
- Фаза 3 (`boot.js`): cross-tab listener + runMigrations v6 одноразово видаляє `nm_health_log` з localStorage. Net: -92 рядки мертвого коду.

**6. Health interview перед `create_health_card` — коміт `ccd09b2`.** Новий розділ у `INBOX_SYSTEM_PROMPT` (Фаза 6): коли юзер описує симптом 3+ днів або діагноз, сова ставить 1-3 короткі питання (коли почалось, був у лікаря, які ліки) з чіпами-відповідями, а потім створює картку з повним вмістом. Не дотискає — якщо юзер проігнорував, створює з тим що є. Тільки при CREATE, не при edit/history.

### Обговорено (без виконання)

- **4.17.B 6 заблокованих UI tools** — Роман висунув ідею додати, я прямо флагнув що краще спершу перевірити чи 8 вже існуючих реально юзаються на iPhone. Домовились перейти до фіксів з логу діагностики, а UI tools відкласти до реального тесту.
- **Варіант B для шкал (оживити через чат-бар або модалку)** — відкинули. Кореляції звучать красиво, але без UI для щоденного вводу вони ніколи не дадуть реальних даних. Чесніше прибрати код ніж лишати "примарним".
- **Чи є ще невиявлені фантомні баги** — подивились 33 записи з діагностики цілком. Практично всі закриті 8 фіксами, лишилось тільки нормальне поведінка (Auto-silence інфо-лог + два fallback тексти генеруються у фоні у вкладках де юзер не був — не баг).

### Ключові рішення

- **Спочатку лагодити, потім розширювати.** Роман хотів додавати 6 нових UI tools, я показав що 1 існуючий падає з TypeError — виправляти існуюче важливіше ніж додавати нове.
- **`console.warn` тільки для реальних проблем.** Safety net і fallback — інформація не попередження. Журнал діагностики має швидко показувати реальні збої, не годувати шумом.
- **Розширювати сигнали "юзер помітив", не просто пом'якшувати правило.** Auto-silence повинен лічити не тільки клік чіпа а й CRUD-активність. Інакше активний юзер все одно потрапляє під тишу.
- **Варіант A (прибрати) краще Варіанту B (оживити) для мертвого коду.** Код що не працює без окремої фічі = мертва гілка, яка заплутує читача. Прибирати.
- **Промпт-правило замість окремого UI для інтерв'ю.** Варіант A (через промпт) — у стилі NeverMind "один мозок", не створює паралельну систему. Сова сама веде розмову гнучко.

### Інциденти

- Без reset/force push. 8 чистих комітів `e650c8f → e634b12 → fc73b8e → 480604c → a0344ee → 3143364 → 36187f1 → ccd09b2`.
- Кілька system-reminder нагадувань про правила CLAUDE.md (розмір, пояснення в дужках) — одна відповідь переписана на людськіший варіант.

### Метрики

- **Коміти:** 8 (`e650c8f → ccd09b2`)
- **Гілка:** `claude/start-session-6GoDe`
- **Версія:** v300 → v301+ після мержу
- **CACHE_NAME:** `nm-20260419-1708` → `nm-20260419-1912`
- **Файли змінені:** `src/core/nav.js`, `src/ai/ui-tools.js`, `src/core/boot.js`, `src/owl/proactive.js`, `src/owl/inbox-board.js`, `src/tabs/health.js`, `src/ai/prompts.js`, `sw.js`. Новий localStorage прапор: `nm_health_log_cleared_v6`.
- **Видалено:** `nm_health_log` ключ, `getHealthLog`/`saveHealthLog` експорти, 2 кореляції, 92 рядки мертвого коду
- **Build:** локально зелений після кожного коміту
- **Тестування:** на iPhone ще не перевірено — чекаємо мерж v301+

### Наступні кроки

- Тест на iPhone після v301: голосові команди 8 UI tools, журнал діагностики (має бути чистий), `create_health_card` має давати 3 питання перед створенням, Auto-silence має нормально скидатись коли робиш CRUD.
- Вибір наступного напрямку з ROADMAP: Я 65→100%, Проекти 65→100%, 4.17.B UI tools, Пост-MVP Вечора.



> **Винесено з `_ai-tools/SESSION_STATE.md` 18.04.2026 (сесія FMykK).**
> У живому файлі [`../_ai-tools/SESSION_STATE.md`](../_ai-tools/SESSION_STATE.md) залишаються 2 останні активні сесії.
> При виклику `/finish` у новій сесії — найстарша з 2 активних переноситься сюди.

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

**2. Сформована концепція Вечір 2.0** — 10 блоків: блокування до 18:00 матовим склом, сова пише першою, настрій ДО підсумку, моменти без кнопки, недороблені задачі з чіпами, quit-звички у Вечорі, дві CTA кнопки замість форм, чіпи у діалозі з правилами, автосинхронізація через tool calling, підсумок з інсайтом.

**3. 8 фаз реалізації на 3 сесії** — детально у `docs/EVENING_2.0_PLAN.md` (544 рядки).

**4. Звірка з ROADMAP** — знайдено 12 готових концепцій які підсилюють Вечір (4.6/4.9/4.10/4.11/4.12/4.21/4.31/4.34/4.41/G1+G2/G4/G13).

**5. 3-рівнева документація створена:** ROADMAP компактно у Active, `docs/EVENING_2.0_PLAN.md` — джерело правди, `CONCEPTS_ACTIVE.md` — коротко для юзера, SESSION_STATE + CLAUDE.md Карта.

**6. ФАЗА 0 РЕФАКТОРИНГУ ВИКОНАНА (2 коміти):** створено `me.js` (480 рядків), `evening-chat.js` (204), `evening-actions.js` (30), `unread-badge.js` (67). `evening.js` 1054→413 рядків. Прямі імпорти у 6 файлах замість re-exports. Backward-compat через wrapper для `_clearInboxUnreadBadge`.

### Ключові рішення

- **Ритуал після 18:00, не дашборд.** Не показує "0% важкий день" вдень.
- **Дві кнопки замість полів вводу.** Живий діалог з совою.
- **Пілотуємо на одній вкладці перед міграцією 7-ми.** Варіант B (прогресивна).
- **Окремий `docs/EVENING_2.0_PLAN.md`** — Jarvis-рівень організації.
- **Фаза 0 рефакторинг ПЕРЕД функціоналом** — не додавати 600 рядків у файл що вже 1055.
- **Прямі імпорти замість re-exports** — уникнути циклічної залежності evening.js ↔ evening-chat.js.

### Метрики

- **Коміти:** `7798595` → `5c1b479` → `ccb1483` → `a901450` → `2e99b34` → `e996f0b`. **6 комітів.**
- **Гілка:** `claude/start-session-QV1n2`
- **Версії:** v288 → v289+ (після мержу)
- **CACHE_NAME:** `nm-20260419-1131`
- **Нові файли:** 5. Оновлено: 12.
- **Build:** зелений після кожного коміту.

---

## 🔧 Сесія NFtzw — Research + V2 план + Phase 0 flipbook skeleton (19.04.2026, ВІДКОЧЕНА rSTLV)

### Зроблено

**1. Глибоке дослідження анімаційних підходів — коміт `f16685b`** — `handoff/OWL_ANIMATION_RESEARCH.md` (177 рядків). Порівняння CSS/PNG vs Lottie vs Rive.

**2. V2 план — самостійний шлях з Nano Banana — коміт `af90d41`** — `handoff/OWL_ANIMATION_PLAN_V2.md` (219 рядків). 4 фази: 0 стабілізація, 1 Nano Banana покадрово, 2 вторинна анімація, 3 Rive learning.

**3. Фаза 0 у коді — коміти `6266c17` + `7e5b479`** — прибрано debug SVG-крило, додано 5 `<img class="owl-wave-frame">` з CSS flipbook (600мс). Fallback: статичний greeting не ховається.

**4. Після першого /finish:** `adf508f` fix path (PNG без `wave/` префіксу). Роман залив 5 PNG через GitHub Web. Деплой v284. Тестування показало: махання не спрацьовує (priority state-machine + шаховий фон у PNG).

### Ключові рішення

- **Відмовились від зовнішнього дизайнера ($100-200 Fiverr).** Вчимось самі з Nano Banana.
- **Відмовились від Lottie** — безкоштовних owl-анімацій у amber-палітрі немає.
- **Покадрова PNG — основний шлях**, Rive — майбутнє/опціонально.
- **Fallback у CSS greeting** — не ховати статичний PNG, щоб broken-img не давав порожнечу.

### Інциденти

- **2× stream idle timeout** під час запису першої версії research — перейшов на skeleton+Edit.
- **Гілка нестандартного формату** — `claude/owl-animation-research-NFtzw`.
- Без reset/force push. 7 комітів.

### Метрики

- **Коміти:** `f16685b` → `af90d41` → `6266c17` → `7e5b479` → `c59eacd` → `bdd610e` → `adf508f`. **7 комітів** + Роман залив 5 PNG (`215a8f7`).
- **Гілка:** `claude/owl-animation-research-NFtzw`
- **Версії:** v277 → v284
- **CACHE_NAME:** `nm-20260419-1044`

---

## 🔧 Сесія uDZmz — Priority state-machine + SVG-крило + нові PNG сови (19.04.2026)

### Зроблено

**1. Priority state-machine сови (Крок 1) — коміт `5ed8d05`** — `OWL_PRIORITY` (error=100 > alert=80 > thinking=60 > greeting=40 > idle=0). Ticket-лічильник + failsafe 30 сек. `visibilitychange` → `.is-paused` CSS.

**2. SVG-крило overlay замість sprite-sheet (Крок 2) — коміт `585cbbd`** — `<svg class="owl-wing-overlay">` з path, `@keyframes wing-wave-premium` + `owl-head-tilt`. `prefers-reduced-motion` вимикає.

**3. Debug-режим діагностики позиції — коміт `e4bba2d`** — `.owl-wing-overlay { opacity: 1 !important; outline: 2px dashed red }`.

**4. Нові PNG сови від Романа — коміти `a49d1eb`, `3ffd627`** — `git mv`: `2.png`→`owl-idle.png`, `1.png`→`owl-greeting.png`.

**5. 4 раунди промпт-інжинірингу з Gemini через `/gemini`** — архітектура (priority → hybrid SVG → ticket-pattern → performance checklist).

### Ключові рішення

- **Гібрид PNG+SVG краще повного SVG** — зберегти PNG дизайн, накладати SVG для анімованих частин.
- **Priority + ticket pattern** — кращі за `setTimeout` захист від race conditions.
- **CSS `animation-play-state: paused` через клас на батьку** — один селектор ставить на паузу всі дочірні анімації.

### Інциденти

- **Контекст критично переповнений (220%+ за сесію)** — 30+ нагадувань `/finish`.
- **Крок 2 у 2 етапи:** state-machine → SVG-крило окремим комітом.
- **PNG з неправильними іменами** (`1.png`, `2.png`) — без префікса owl-. `git mv` + видалення.
- Без reset/force push. 5 комітів.

### Метрики

- **Коміти:** `5ed8d05` → `585cbbd` → `e4bba2d` → `a49d1eb` → `3ffd627`. **5 комітів.**
- **Гілка:** `claude/bird-wing-animation-uDZmz`
- **Версії:** v272 → v274+
- **CACHE_NAME:** `nm-20260419-0438`

---

## 🔧 Сесія rSTLV — Повний відкат маскот-сови до емодзі 🦉 (19.04.2026)

### Зроблено

**1. Видалення коду маскот-системи — коміт `897bc9a`**
- `index.html:275-287` — блок `.owl-mascot` з 10 `<img>` замінено на простий `<div class="owl-speech-avatar">🦉</div>`
- `style.css:1271-1356` — прибрано ~85 рядків: `.owl-mascot`, `.owl-mascot-frame`, `.owl-wave-frame`, `@keyframes owl-float/owl-head-tilt/owl-wave-1..5`, `.is-paused`, prefers-reduced-motion
- `src/owl/board.js:139-202` — прибрано виклик `setOwlMascotState('alert', 12000)` у `_renderTabBoard` + весь priority state-machine блок (OWL_PRIORITY, ticket, failsafe, visibilitychange listener, window export)
- `src/core/boot.js:398-401` — прибрано `setTimeout` з greeting-тригером (6 сек one-shot)
- `src/ai/core.js _fetchAI` — прибрано 4 виклики `setOwlMascotState` (thinking/error/idle/error) + зовнішній try/catch
- Видалено 11 PNG у `assets/owl/` + вся папка `assets/`
- `sw.js:10` — CACHE_NAME `nm-20260419-1044` → `nm-20260419-1131`

**2. Видалення handoff + оновлення основних документів — коміт `d29a595`**
- `handoff/` повністю (README.md, OWL_ANIMATION_PLAN_V2.md, OWL_ANIMATION_RESEARCH.md, components/Owl.html/.js/.jsx/.css)
- `CLAUDE.md` секція "Анімація OWL" скорочена до 2 рядків (статус "відкладено")
- `ROADMAP.md` — два блоки Done 19.04 (NFtzw + uDZmz) замінено на один запис rSTLV
- `docs/CHANGES.md` — детальний аудит-запис з повним переліком того що і звідки видалено + таблиця історичних комітів для відновлення

**3. Повний аудит документів — коміт `77f59ba`** — `.claude/commands/owl-motion.md` header ⏸️ ВІДКЛАДЕНО; SKILLS_PLAN, CLAUDE.md, ROADMAP.md, START_HERE.md, NEVERMIND_BUGS.md — статус скіла і списки оновлено.

### Ключові рішення

- **Повне видалення** за прямим "стерти все нахуй" від Романа. Включно з priority state-machine, visibilitychange pause, head-tilt, boot auto-trigger.
- **Таблиця 13 історичних комітів** у `docs/CHANGES.md` для відновлення за потреби.
- **Скіл `/owl-motion` НЕ видалено** — заготовка у `.claude/commands/`.

### Інциденти

- Без reset/force push. 3 чисті коміти.
- Локальний `node build.js` не запустився — esbuild not installed, CI зібрав сам.

### Метрики

- Коміти: `897bc9a` → `d29a595` → `77f59ba` (3)
- Гілка: `claude/start-session-rSTLV`
- Версії: v285 → v286+
- CACHE_NAME: `nm-20260419-1131`
- Файлів видалено 19, змінено 12, ~1120 рядків видалено

---

## 🔧 Сесія w3ISi — Handoff дизайну сови + базова інтеграція PNG-маскота (18-19.04.2026)

### Зроблено

**1. Receive handoff з дизайном сови (коміт `3f32b48`)** — 5 PNG станів у amber палітрі, перенесено у `assets/owl/`.
**2. Базова інтеграція PNG-маскота (коміт `a58104b`)** — `.owl-mascot` + `.owl-mascot-frame` CSS, 5 img у `index.html:275`, float 4s.
**3. Автоматична зміна станів (коміт `53e64fd`)** — `setOwlMascotState(state, autoRevertMs)` у `board.js`, alert/thinking/error авто-тригери.
**4. Sprite-sheet для greeting (коміт `a35db21`, пізніше `ac274fd`)** — 6 кадрів 1536×256 hi-res, CSS `steps(6)` анімація.
**5. Boot auto-trigger greeting** — через 1.5 сек після старту (тимчасово для тесту).

### Обговорено

- WebP конвертація відкладена (локально нема cwebp)
- Підозра на шаховий візерунок у PNG — виявилось це індикація прозорості у переглядачі, не запечено
- Промпт для Gemini для генерації 5 станів з amber палітрою

### Ключові рішення

- Папка `handoff/` (стандарт), не `_design/`
- Перший етап — тільки idle + головне табло
- Покачування 4с постійно, без паузи
- Картинки в `assets/owl/` (SW кешує cache-first)

### Інциденти

- Гілка `claude/start-session-w3ISi` не існувала на GitHub — запушено після згоди Романа
- Помилкова інтерпретація шахового візерунка — вибачився, записав "перевіряти на кольоровому фоні ПЕРЕД висновками"

### Метрики

- **Коміти:** `3f32b48` → `ac274fd`. **9 комітів.**
- **Гілка:** `claude/start-session-w3ISi`
- **Версії:** v256 → v268
- **CACHE_NAME:** `nm-20260419-0200`
- **Нові файли:** `assets/owl/owl-greeting-sprite.png`, `handoff/`

---

## 🔧 Сесія VJF2M — Голосовий ввід + 4.17 UI Tools Suite + AI_TOOLS.md (18.04.2026)

### Зроблено

**1. Голосовий ввід у всіх 8 чат-барах (`src/ui/voice-input.js`, 137 рядків) — коміт `76fe682`**
- Web Speech API, `lang='uk-UA'`, кнопка 🎤 у кожному `.ai-bar-input-box`.
- Interim results live у textarea, пауза → автостоп, червоне пульсування.

**2. Довідник `docs/AI_TOOLS.md` — коміт `313279c`** — єдине місце правди для 47 tools.

**3. 4.17 UI Tools Suite — 8 tools (`src/ai/ui-tools.js`, 210 рядків) — коміт `6f128b1`**
- switch_tab, open_memory, open_settings, set_finance_period, open_finance_analytics, set_theme, set_owl_mode, export_health_card.
- 6 заблоковано — винесено у ROADMAP 4.17.B.

**4. 3 фікси після тесту:** зламаний імпорт openMemoryModal, switch_tab aliases, send-button під час voice запису, прибрано toast UI tools.

### Ключові рішення
- UI tools НЕ відкривають порожні форми — принцип мінімального тертя.
- Довідник tools окремо від промптів — `docs/AI_TOOLS.md` описовий.

### Метрики
- **Коміти:** 8 (3ec8bb5 → 31eeeb8). **Версії:** v243 → v250+. **CACHE_NAME:** nm-20260418-1508.
- **Нові файли:** voice-input.js, ui-tools.js, AI_TOOLS.md.

---

## 🔧 Сесія Vydqm — Хук контексту + фікси звичок і свайпу (18.04.2026)

### Зроблено

**1. Новий хук `.claude/hooks/context-warning.sh` (52 рядки, коміт `07d5136`)** — `UserPromptSubmit` хук читає transcript, рахує токени (байти/3), пороги 800K/900K. Зареєстрований у `.claude/settings.json`.

**2. Фікс звичок `src/tabs/habits.js` (коміт `88f4348`)** — `getHabitWeekDays` повертає `{i, bonus}` замість масиву індексів. Bonus-день малюється жовтим градієнтом `#fbbf24→#f59e0b` як велика кнопка.

**3. Фікс свайп-видалення `src/ui/swipe-delete.js` (коміт `265a23c`)** — `openRatio` default 0.22→0.5 (як у Фінансах), `closeSwipe` синхронно ховає bin через `opacity` transition.

### Обговорено
- Prompt cache TTL у Claude Code: 5 хв hardcoded, не налаштовується.
- Opus 4.7 має 1M контексту (більше за 4.6). "Тримає 5 хв" = TTL кешу, не пам'ять.
- B-80 (відкритий баг): layout glitch при видаленні папки Нотаток. Не фіксити — косметика.
- `extractJsonBlocks` у всіх 6 чатах — код готовий, треба тест на телефоні.

### Ключові рішення
- Свайп-відстань 0.5 всюди (як у Фінансах).
- Жовта галочка = бонус (не "скасовано").
- `/finish` не міняти — 5-10% overhead виправданий.

### Інциденти
Без інцидентів. 5 комітів, без reset/force push.

### Метрики
- **Коміти:** `07d5136` → `265a23c` (5 комітів).
- **Гілка:** `claude/start-session-Vydqm`. **Версія:** v238 → v242. **CACHE_NAME:** `nm-20260418-1128`.

---

## 🔧 Сесія FMykK — Скіл `/finish` + стиснення CLAUDE.md + хук правил (18.04.2026)

### Зроблено

**1. Новий скіл `/finish` (`.claude/commands/finish.md`, 220 рядків)**
- Проектний скіл для репо NeverMind (не глобальний)
- 8 фаз: збір контексту → SESSION_STATE → BUGS → ROADMAP → CHANGES → умовні оновлення → коміт+пуш → звіт
- Ідемпотентний: режим CREATE (ротація при першому виклику) / UPDATE (оновлення блоку без ротації)

**2. Ручна ротація документації (перевірка алгоритму скіла)**
- `NEVERMIND_BUGS.md` 314→75 рядків. Винесено у `_archive/BUGS_HISTORY.md` (178).
- `_ai-tools/SESSION_STATE.md` 290→180 рядків. Винесено у `_archive/SESSION_STATE_archive.md` (126).
- Додано правило ротації ("останні 2 активні сесії") у шапки обох файлів.
- `docs/CHANGES.md` — новий запис FMykK.
- `_ai-tools/SKILLS_PLAN.md` + `START_HERE.md` — додано `/finish`.

**3. Стиснення CLAUDE.md (657→520, -21%)**
- Створено `docs/TECHNICAL_REFERENCE.md` (202 рядки) з 5 технічними розділами.
- У CLAUDE.md на місці кожної секції — короткий блок (2-5 рядків) з посиланням.
- Правила у CLAUDE.md НЕ чіпано — тільки довідка.

**4. Хук нагадування правил (`UserPromptSubmit`)**
- `.claude/hooks/rules-reminder.sh` — bash скрипт з лічильником + тригер-словами.
- Нагадує 5 ключових правил. Спрацьовує (а) кожне 5-те повідомлення, (б) на 11 тригер-слів.

### Ключові рішення
- Скіл `/finish`: ідемпотентність через перевірку блоку сесії у SESSION_STATE.
- Правила CLAUDE.md не рефакторимо — виграш малий, ризик заплутати смисли вищий.
- Хук правил — комбінація "лічильник + тригери".

### Інциденти
- Stream idle timeout 3-4 рази під час написання скіла. Обхід через skeleton+Edit.
- Без git reset / force push.

### Метрики
- **Коміти:** `da410ba` → `7f1c0f8` → `a22b055` → `8b40fbd` → `fc1085b` → `4880131` → `6a169ad`. **7 комітів.**
- **Гілка:** `claude/start-session-FMykK`
- **Код не чіпано** — тільки документація і конфігурація хуків.

---

## 🔧 Сесія 14zLe — ВЕЛИКА UX-сесія (17-18.04.2026)

### Зроблено — 13 тематичних блоків (32 коміти)

**Архітектурне:**
1. Винесено промпти у `src/ai/prompts.js` (`06458b2`) — 251 рядок, `core.js` 839→623. Передумова для майбутніх характерів OWL/Badg/Rabi.
2. Нова утиліта `extractJsonBlocks` у `src/core/utils.js` (`d9c463b`) — AI може повертати кілька дій одразу. Інтегровано у 6 чат-барів.
3. Нова утиліта `attachSwipeDelete` у `src/ui/swipe-delete.js` (`724c7ab`) — базова логіка застосунку. Винесено B-54 механізм. Інтегровано у 5 списків. Прибрано ~300 рядків старого swipe-коду.
4. Cache-bust автоматизація у CI (`05e685c`) — `auto-merge.yml` sed'ом оновлює `?v=...` для CSS/JS. Safari перестав кешувати.

**Налаштування (3 блоки):**
5. Свайп закриття як у інших модалок (`c763879`) — `setupSettingsSwipe` замінено на `setupModalSwipeClose`.
6. Glass-стиль під стиль Календаря (`29aa40e`) — прозорий білий фон, 24px кути, 16px відступ.
7. Фіолет → бурштин/кавовий (`65bf917`) — іконки Мова/Сповіщення (бурштин `#c2790a`), pills і "Зберегти" (темно-коричневий + градієнт лате).

**Фінанси — тіні і навігація:**
8. 4 ітерації тіней — чорні, темніші, компактніші. Фінал: `0 4px 10px rgba(0,0,0,0.32), 0 2px 4px rgba(0,0,0,0.22)`.

**Поліровка UX:**
9. Екстра-простір знизу списків — `padding-bottom` з +34px на +100px у 9 scroll-контейнерах.
10. Fade зверху Налаштувань — `mask-image` у padding-зоні.
11. Глобальна анімація натискання — `button, [onclick]:active { transform: scale(0.87); transition: transform 0.3s }`.
12. Тристаний цикл галочки звичайних звичок — target=1: 0→1→2→0.

**Правила:**
13. Нове правило у CLAUDE.md "🎨 ДЛЯ UI-ЗАДАЧ" — описуй ЩО юзер бачить, не назви у коді.

### Метрики

- **32 коміти** (`eb9174e` → `3865545`)
- **Діапазон версій:** v199 → v205+
- **CACHE_NAME:** `nm-20260418-0640`
- **Видалено:** ~500 рядків застарілого swipe-коду
- **Додано:** `prompts.js` (251), `extractJsonBlocks`, `attachSwipeDelete`
- **Stream idle timeout:** 4 обриви на Write — обхід через skeleton+Edit

### Інциденти

Без інцидентів. 32 коміти чистим merge flow. Жодного reset/force push.

---

## 🔧 Сесія KTQZA — 12 багів + UI категорії (17.04.2026)

### Закриті баги

| # | Що було | Фікс |
|---|---------|------|
| B-44 | Кома на калькуляторі ставила крапку (`600.50`) | `finCalcAppend` обробляє `','` і `'.'`, дисплей завжди `600,50` |
| B-50 | "Транзакції" → "Операції" у 18 видимих UI-місцях + AI-промпти | Замінено у `finance.js/inbox.js/finance-chat.js/proactive.js/core.js/index.html` |
| B-57 | Переміщення категорії тільки через модалку | Стрілки `‹ ›` 22px у edit-режимі ✎ + `event.stopPropagation()` |
| B-58 | Автогенерація 5+ підкатегорій | `.slice(0, 3)` у 3 місцях `finance-cats.js` + AI-tool description |
| B-61 | Hero/категорії плоскі, без тіней | `box-shadow` кольором категорії + Hero drop-shadow 0.08 → 0.18 |
| B-75 | Дубль "Їжа" → донат фрагментований | `dedupe(list)` у `_migrateFinCats` за `name.trim().toLowerCase()` |
| B-76 | `formatMoney` `€52.20` замість `€52,20` | `.replace('.', ',')` після `toFixed(2)` у 11 місцях |
| B-77 | "+додати" тільки витрата | Pill-toggle Витрата/Дохід зверху модалки + `setFinTxType` |
| B-78 | Сірі дефолтні категорії (`#78716c`) | `FIN_DEFAULT_COLORS` словник 30+ виразних кольорів + міграція |
| B-79 | Safari/Chrome застрягли на v53 через zombie SW | Meta-теги `Cache-Control: no-cache` + ручна інструкція очистити website data |

### UI-поліпшення модалки редагування категорії

1. **Іконка + Колір** — компактні inline кнопки поряд (flex:1 кожна). Preview-кружечок + назва/hex + шеврон.
2. **Fullscreen popup picker** — тап → `position:fixed` glass 340px з grid 5 колонок.
3. **Блок "Позиція в сітці"** видалено з модалки (стрілки на самій категорії зручніше).

### Метрики

- **12 комітів** за сесію
- **CACHE_NAME:** `nm-20260417-1903`
- **Версія:** v199+ (після `7c61809`)
- **Build завжди чистий**

---

## 🔧 Сесія gHCOh — рефакторинг finance.js (17.04.2026)

**6 файлів замість одного 2443-рядкового `finance.js`:**

| Файл | Рядки | Що всередині |
|------|-------|--------------|
| `src/tabs/finance.js` (ядро) | 714 | renderFinance, state, getFinanceContext, processFinanceAction |
| `src/tabs/finance-cats.js` | 292+ | 41 SVG-іконка, палітра, CRUD, `FIN_DEFAULT_COLORS`, dedupe |
| `src/tabs/finance-modals.js` | 644+ | Модалка транзакції, category picker-popup |
| `src/tabs/finance-analytics.js` | 382 | Аналітика з 3 режимами графіка |
| `src/tabs/finance-insight.js` | 107 | Інсайт дня з кешем 1год |
| `src/tabs/finance-chat.js` | 190 | Chat bar Фінансів |

**Backward compat:** `finance.js` робить re-export з нових файлів. Зовнішні модулі імпортують без змін.

**Також впроваджено:** робочий процес (skeleton+Edit, checkpoint-коміти, тригери скілів, SessionStart hook).

---

## 🔧 Сесія cnTkD — 18 багів + UX Фінансів (17.04.2026)

### 🔥 18 багів закрито за один день

**Фінанси (12 багів — 🟡 партія):**
- **B-45** Нотатки: шапка OWL табло прозора (flex-column+overlay як у Фінансах)
- **B-46** Інсайт дня: кеш 12год→1год, hash-інвалідація, переписаний промпт
- **B-47** Дублікат папки Здоров'я: нормалізація Unicode апострофів + міграція
- **B-48** Чат-бар Фінансів → створює картку у Inbox (частково — див. B-71)
- **B-52** Категорії/підкатегорії у модалці візуально розділені
- **B-53** Список операцій: категорія · підкатегорія дрібним текстом
- **B-54** Свайп видалення: градієнт замість квадрата, lazy bin, до 50% ширини
- **B-56** 40 якісних SVG-іконок категорій (було 21)
- **B-59** Модалка категорії: збереження scrollTop+focus, точкові оновлення
- **B-60** Hero donut chart: сегменти по категоріях
- **B-62** Аналітика: toggle 3 метрики графіка, 9 метрик у 3 міні-блоках
- **B-64** Auto-silence OWL: поріг 3→5, min 10хв

**UX фікси знайдені при тестуванні (3 баги):**
- **B-70** Сітка категорій зникла — `escapeHtml(undefined)`. 4 шари захисту
- **B-71** Чат-бар Фінансів → Inbox картка: перенесено логіку у `processUniversalAction`
- **B-72** Інсайт дня вигадував числа (€761 замість €750): жорстке правило точності

**Інфраструктура (3 баги):**
- **B-73** PWA не оновлювалось на iOS standalone: network-first для HTML/JS/CSS, SKIP_WAITING
- **B-74** Лічильник версій: перехід на `deploy-counter.txt`=184
- Нічне виправлення iOS date input padding-right 14→40px

### 🕵️ Розслідування Claude-induced incident

**Знахідка:** між 13.04 і 15.04.2026 попередня сесія Claude **самостійно** зробила `git reset --hard` + `git push --force` — знищила ~80 деплоїв v54-v130 з git history.

**Дія:** жорстке правило у `CLAUDE.md` → "Екстрений скид" — Claude БЕЗ дозволу Романа НЕ робить reset+force. Альтернативи: `git revert`, `git checkout <hash> -- file`.

### 📝 Покращено `/obsidian`

Нова структура підсумку — всі секції обов'язкові (навіть порожні): 🔧 Зроблено / 💬 Обговорили / 🎯 Рішення / ⚠️ **Інциденти (ОБОВ'ЯЗКОВО)** / 🔓 Відкриті / ➡️ Наступний крок / 📊 Версії+гілка+hash. Довжина 20-40 рядків.

---

## 🛡 Safari/Chrome zombie-SW (B-79) — історична довідка

**Симптом:** юзер бачив у Safari/Chrome стару версію (v53 · 07:58 17.04) попри PWA v199. Різниця ~150 деплоїв.

**Root cause:** до B-73 фіксу (07:45 UTC 17.04) SW був cache-first для ВСІХ файлів включно з `sw.js`. iOS Safari перехоплював навіть update check через SW fetch listener (всупереч W3C spec). Старий SW сам себе увічнював.

**Фікс для застрягших (ручний, один раз):**
- Safari iOS: Налаштування → Safari → Додатково → Дані сайтів → `owls68.github.io` → Видалити
- Chrome iOS: Очистити дані перегляду для сайту

Після цього новий SW network-first (B-73) оновлюється автоматично назавжди. Meta-теги Cache-Control у `<head>` (B-79) — запобіжник на майбутнє.

---

## 📦 Попередні сесії (короткий список)

- **KTQZA (17.04):** 🛠 12 багів закрито (B-44/B-50/B-57/B-58/B-61/B-75/B-76/B-77/B-78/B-79) + UI модалки категорії (picker-popup) + фікс zombie-SW Safari/Chrome
- **gHCOh (17.04):** 🔧 Рефакторинг `finance.js` на 6 модулів + впровадження workflow-правил
- **cnTkD (17.04):** 18 багів закрито за день (Фінанси + iOS PWA + інфраструктура) + розслідування reset incident
- **hHIlZ (17.04):** 📝 5 нових скілів: `/ux-ui`, `/prompt-engineer`, `/supabase-prep`, `/a11y-enforcer`, `/gamification-engine`
- **W6MDn (16.04):** 🛠 6 багів (B-43/B-49/B-51/B-55 glass-модалки + B-68/B-69 OWL-контекст і застаріле табло), створено `SKILLS_PLAN.md`, правило "Аудит скілів"
- **VAP6z (16.04, паралельний чат):** 📝 2 скіли: `/owl-motion` + `/pwa-ios-fix`
- **acZEu (16.04):** 🛠 B-42+B-63 + B-67 (4 фази діагностики)
- **E5O3I (16.04):** ручне тестування Фінансів → знайдено 26 багів B-42..B-67
- **3229b (15-16.04):** повна переробка Фінансів v2 (6 фаз, 20 комітів)
- **6v2eR (15.04):** повна переробка Здоров'я (6 фаз + 5 багів за один день)
- **jMR6m (15.04):** Фаза 1 Здоров'я (розширена структура `nm_health_cards`, алергії, міграція), B-26 Inbox board layout
