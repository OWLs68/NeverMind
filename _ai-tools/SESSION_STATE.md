# Стан сесії

**Оновлено:** 2026-04-11 (сесія start-session-B29hd — стратегія з Gemini + синхронізація документації)

---

## Проект

| | |
|--|--|
| **Версія** | v126+ (деплої через auto-merge) |
| **URL** | owls68.github.io/NeverMind |
| **AI модель** | OpenAI GPT-4o-mini з **Tool Calling** (function calling) — SINCE 10.04 |
| **Гілка** | `claude/start-session-B29hd` |
| **Repo** | **Public** + LICENSE (All Rights Reserved) |

---

## ⚠️ ДЛЯ НОВОГО ЧАТУ — найважливіше

**1. ПРАВИЛО №1:** завжди пояснювати в дужках ВСЕ не-українською — англіцизми, сленг, назви функцій, технічні терміни. Роман вчиться через пояснення. Деталі → `CLAUDE.md` верхня секція "ОБОВ'ЯЗКОВО В КОЖНОМУ ПОВІДОМЛЕННІ".

**2. РОЗМІР ВІДПОВІДЕЙ — СЕРЕДНІЙ.** Не мікро-відмашки, не простирадла. 5-15 рядків для звичайної відповіді. Роман втомлюється читати довгі повідомлення з телефону. Деталі → `CLAUDE.md` секція "📏 РОЗМІР ВІДПОВІДЕЙ".

**3. Без "Роби" від Романа — НЕ змінювати код.** Роман каже "Роби" — і тільки тоді.

**4. Архітектурний принцип: ОДИН МОЗОК НА ВСЕ.** OWL = єдиний Jarvis. Табло, чати, чіпи — різні вікна одного мозку. **Зміна в одній вкладці = зміна в усіх.** Мозок має працювати на будь-якій комбінації активних вкладок — юзер може не використовувати 5 з 8. Повний план → `FEATURES_ROADMAP.md` секція "🧠 Мозок OWL".

**5. Наступний крок роботи:** уніфікація `src/owl/followups.js` з `shouldOwlSpeak()` — обидва канали (табло + chat follow-ups) мають ходити через один Judge Layer. Деталі → секція "Jarvis Architecture — ДО Supabase" нижче.

**6. Бізнес-модель зафіксована (11.04):** freemium — безкоштовна базова версія з мінімальними функціями, підписка для повного функціоналу. **API через хмару Supabase Edge Functions** — користувач НЕ вписує свій OpenAI ключ. Роман тримає спільний ключ на сервері, виклики OpenAI йдуть через Edge Function, ліміти застосовуються за рівнем підписки. Це фундаментальне рішення яке впливає на: (а) що буде в безкоштовній версії vs платній, (б) архітектуру Supabase Edge Functions з першого дня, (в) систему обліку використання (хто скільки запитів зробив).

---

## Що зроблено в сесії 11.04 (start-session-B29hd)

### 🐛 Латка бага "болить горло" (коміт `bf3d4e2`)
**Проблема:** OWL на табло Продуктивності писав "Болить горло? Це не привід пропускати біг" — вигадав симптом якого юзер сьогодні не згадував. Брав зі старих даних (`nm_memory`, `recentChat` або `crossActions`) як актуальний факт. У tab chat на "відкрий нотатку про горло" казав "видалено, відновити?" хоча нотатка не видалялась (бо `getAIContext()` не містить нотаток).

**Фікс:** У `src/ai/core.js` `getOWLPersonality()` додано секцію "ПРАВИЛО ЧЕСНОСТІ":
- НЕ стверджувати про поточний стан (здоров'я/настрій) без актуальних даних за сьогодні
- `nm_memory` — ТІЛЬКИ для стилю, НЕ для поточного стану
- НЕ казати "видалено" якщо не бачиш у `nm_trash`

У `getAIContext()` перейменовано `nm_memory` з "Що знаю про користувача" на "Довгостроковий профіль (ІСТОРИЧНИЙ, може бути застарілим)".

Це **латка** — правильне рішення у Кроці 2 (структурована пам'ять фактів з timestamps).

### 📏 Правило "середній розмір відповідей" + /start читає правила (коміти `0cad09a`, `8fb777b`)
- `CLAUDE.md` — нова секція "📏 РОЗМІР ВІДПОВІДЕЙ" (5-15 рядків для звичайної відповіді, пояснення в дужках ≠ розтягнута думка)
- `РОМАН_ПРОФІЛЬ.md` — посилений пункт "Не перевантажувати"
- `.claude/commands/start.md` — перебудовано крок 1: СПОЧАТКУ правила взаємодії (CLAUDE.md + РОМАН_ПРОФІЛЬ.md), ПОТІМ стан проекту (SESSION_STATE, BUGS, FEATURES_ROADMAP). `/start` тепер обов'язково читає FEATURES_ROADMAP.md — без цього Claude вигадує "власні" рішення які не відповідають плану.

### 🧠 Стратегічне обговорення з Gemini 3 Pro (2 ітерації)
Роман підняв питання "ми вигадуємо велосипед?". Два промти для Gemini через скіл `/gemini`. Результати:

**Головні висновки:**
- Велосипед ЗАРАЗ виправданий (PWA без бекенду), після Supabase — йти в стандарт (pgvector, RAG)
- **Assistants API** — НЕ наш шлях (суперечить принципу 4.22 Micro-orchestration — багато дешевих рішень на 4o-mini)
- **OpenAI Assistants API** відхилено
- **SyncEngine (Варіант C / 4.38 Offline-first)** затверджено як шлях міграції на Supabase — localStorage синхронний, у фоні поштар відправляє на сервер
- **4.2 переформульовано** — структуровані факти з timestamps (не наративне саммарі) — щоб не губити дрібні факти як це роблять Zep/Mem0
- **BYOK vs Підписка** — критичне бізнес-питання ДО Supabase (не вирішено, відкладено)
- **RAG через Tool Calling** — новий пункт roadmap, розвантажить контекст при масштабі
- **BroadcastChannel** вже використовується у коді, не треба робити з нуля
- **Judge Layer** вже реалізований як `shouldOwlSpeak()`, не треба робити з нуля
- **Необхідна уніфікація** `followups.js` з `shouldOwlSpeak()` — дублювання логіки "чи говорити"

### 💰 Бізнес-модель зафіксована
**Рішення Романа (11.04):**
- **Freemium:** безкоштовна версія з мінімальними функціями + підписка для повного функціоналу
- **API через хмару:** користувач НЕ вписує свій OpenAI ключ. Роман тримає спільний ключ на сервері Supabase, виклики OpenAI йдуть через Edge Function, ліміти за рівнем підписки
- **Технічний наслідок:** `nm_gemini_key` у localStorage — тимчасове рішення. Після Supabase — ключ на сервері, користувач ніколи його не бачить. В CLAUDE.md оновлено статус цього ключа.

### 📚 Документація і синхронізація ROADMAP
- `FEATURES_ROADMAP.md` — додано Judge Layer і BroadcastChannel у "зроблено", переформульовано 4.2 (структуровані факти), уточнено 4.19 і 4.20, зафіксовано бізнес-модель
- `CLAUDE.md` — оновлено секцію про `localStorage.setItem` hack (BroadcastChannel вже поруч), оновлено статус `nm_gemini_key` як тимчасового рішення до Supabase
- `SESSION_STATE.md` (цей файл) — новий порядок Jarvis Architecture, підсумок сесії, бізнес-модель у секції "Для нового чату"

---

## Що зроблено в сесії 10.04 (start-session-BOJ9T)

### 🐛 Фікс класифікації інбоксу — дії не ставали нотатками
**Проблема:** "Купити мусорні пакети" / "Це задача" → AI класифікував як `save_note` замість `save_task`. Працювало тільки якщо в тексті був час ("ввечері попрати").

**3 зміни у `src/ai/core.js`:**
1. **`INBOX_SYSTEM_PROMPT`** — додано жорстке правило №4: дієслово дії (купити, зробити, написати, зателефонувати, попрати...) → ЗАВЖДИ `save_task`, без винятків. Додано правило метаінструкцій: "це задача/нотатка/звичка" → створити відповідний тип.
2. **`save_note` tool description** — прибрано слово "факти" яке розмивало межу з `save_task`. Тепер явно: "ТІЛЬКИ думки, рефлексія, емоції", "НЕ для дій які треба зробити".
3. **`_fetchAI` temperature параметр** — додано, `callAIWithTools` передає 0.2 (класифікація має бути стабільною). Для інших викликів (chat bars, proactive) — дефолт 0.7, backward compat.

### 🧠 Фаза 2 OWL-мозку: Live Chat Replies
**Концепція:** Агент сам ініціює повідомлення у контекстний чат коли є привід. Принцип "один мозок на все" — follow-up йде у чат тієї вкладки яка тематично пов'язана з тригером, не завжди в Inbox.

**Новий файл `src/owl/followups.js`** (~170 рядків):
- `checkFollowups()` — головна функція перевірки тригерів, надсилає МАКСИМУМ один follow-up за виклик
- `_checkStuckTasks()` — задачі старші 3 днів, cooldown 24 год per-task
- `_checkPassedEvents()` — події з часом що пройшли 30+ хв тому і ≤ 24 год тому, cooldown 365 днів per-event (≈ одноразово)
- `_sendFollowupToChat(tab, type, item)` — генерація тексту через `callAI()` + вставка в чат
- `_generateFollowupText(type, item)` — компактні промпти для кожного типу, 1 речення, emoji доречно
- `startFollowupsCycle()` — перша перевірка через 30 сек, далі кожні 5 хв + `nm-data-changed` listener з debounce 5 сек

**Блокери (щоб не спамити):**
- `silent phase` (нічний час) → skip
- Глобальний cooldown `followup_global` 1 год → skip
- Немає API ключа → skip
- `activeChatBar === tab` (юзер активно в цьому чаті) → skip
- `_checkInFlight` flag проти race conditions

**Trigger→tab map (правило "один мозок"):**
- `stuck-task` → `tasks` (Продуктивність)
- `event-passed` → `tasks` (календар живе там же)

**Новий диспатчер у `src/ai/core.js` — `addMsgForTab(tab, role, text)`:**
- Для inbox — викликає `addInboxChatMsg` (бейдж непрочитаного автоматично)
- Для інших — зберігає через `saveChatMsg` + рендерить у DOM ТІЛЬКИ якщо `el.dataset.restored` (юзер уже відкривав бар у сесії)
- НЕ відкриває чат-бар автоматично (respekt Роману — заборонено насильно відкривати бари)
- Використовує існуючі `addTaskBarMsg`, `addNotesChatMsg`, `addMeChatMsg`, `addEveningBarMsg`, `addFinanceChatMsg` з `_noSave=true`

**Cooldown-система:** використовується існуючий `nm_owl_cooldowns` (НЕ створено новий ключ):
- `followup_global` (глобальний)
- `followup_stuck_<taskId>` (per-task)
- `followup_event_<eventId>` (per-event)
- `owlCdExpired()` тепер експортована з `inbox-board.js` (раніше була приватна)

**Що НЕ в цій фазі** (відкладено за рішенням Романа):
- `welcome-back` у чат — після тестування базових тригерів
- `after-action` тригер — найскладніший, окрема фаза
- Крапки/бейджі на tab bar для інших вкладок — окрема фіча

**Файли змінено:**
- `src/ai/core.js` — `_fetchAI` temperature + `callAIWithTools` 0.2 + `INBOX_SYSTEM_PROMPT` + `save_note` desc + `addMsgForTab` + імпорт `addInboxChatMsg`
- `src/owl/inbox-board.js` — `export` для `owlCdExpired`
- `src/owl/followups.js` — новий файл
- `src/app.js` — імпорт followups
- `src/core/boot.js` — виклик `startFollowupsCycle()` через 3 сек

---

## Що зроблено в сесії 10.04 (start-session-HdqBj)

### 🎯 4.1 Tool Calling — ПОВНИЙ ПЕРЕХІД НА FUNCTION CALLING
Найбільша архітектурна зміна AI-інтеграції. Замість тексту з JSON — OpenAI function calling (виклик функцій з гарантовано валідною структурою).

**Що змінилось у `src/ai/core.js`:**
- Додано `INBOX_TOOLS` — 25 визначень функцій (save_task, save_note, save_habit, save_moment, create_event, save_finance, complete_habit, complete_task, create_project, edit_task/habit/event/note, delete_task/habit/event/folder, reopen_task, add_step, move_note, update_transaction, set_reminder, restore_deleted, save_routine, clarify)
- `_fetchAI()` приймає опційний параметр `tools`. Повертає повний message object коли tools передані, або `content` string — коли ні (backward compat для tab chat bars)
- Додано `callAIWithTools(systemPrompt, history, tools)` — нова public функція для tool calling mode
- **`INBOX_SYSTEM_PROMPT` скорочено з ~200 рядків до ~30.** Прибрано всі описи JSON-форматів (тепер це в tool definitions), залишено тільки правила класифікації (task vs event vs project, розрізнення nagаdaй=set_reminder, список vs окремі задачі)

**Що змінилось у `src/tabs/inbox.js`:**
- Додано `_toolCallToAction(name, args)` — конвертер: перетворює tool_call → старий action format. Це дозволяє використовувати існуючі handlers (processSaveAction, processCompleteHabit, processCompleteTask, processUniversalAction) БЕЗ змін — вони протестовані і працюють
- `sendToAI()` повністю переписаний: викликає `callAIWithTools(fullPrompt, historySlice, INBOX_TOOLS)`, ітерує по `msg.tool_calls`, конвертує через `_toolCallToAction`, dispatch через існуючий if/else ланцюг
- Якщо AI повертає `msg.content` разом з tool_calls — показує як follow-up повідомлення (замінює старий `ask_after` pattern)
- `sendClarifyText()` теж на tool calling
- Прибрано імпорт `callAIWithHistory` (більше не використовується в inbox)

**Переваги нового підходу:**
1. AI ніколи не поверне зламаний JSON — OpenAI гарантує валідну структуру
2. Promt у 6-7 разів коротший → більше контексту, дешевше в токенах
3. AI краще класифікує дії (окремі tools з чіткими описами замість "інтерпретації тексту")
4. Масиви дій обробляються натівно через `msg.tool_calls` array
5. Backward compat: `callAI()`, `callAIWithHistory()`, `callOwlChat()` працюють для інших модулів (tab chat bars, proactive.js)

**Аудит виявив і виправив 6 багів:**
- 🔴 **CRITICAL:** `sendClarifyText` читав `clarifyOriginalText` ПІСЛЯ `closeClarify()` яка обнуляла його → AI отримував `"null"` замість тексту уточнення. **Це був pre-existing bug і в старому коді**, тепер виправлено збереженням у локальну змінну до виклику `closeClarify()`
- 🟡 `save_habit`: поле `details` губилось у конвертері → детальний опис звички втрачався
- 🟡 `save_moment`: поле `mood` губилось → AI-класифікація настрою замінювалась regex fallback (гіршої якості). Тепер `parsed.mood` використовується якщо є
- 🟡 `edit_event`, `edit_note`, `edit_task`, `edit_habit`: поле `comment` не передавалось через конвертер
- 🟢 Вкладені об'єкти у `save_routine.blocks` і `clarify.options` без `additionalProperties: false` — зараз не ламає (strict mode не увімкнено), але несумісно з майбутнім strict mode

**Коміти сесії:**
1. `feat: tool calling infrastructure — INBOX_TOOLS, callAIWithTools, compact prompt`
2. `feat: sendToAI + sendClarifyText switched to tool calling`
3. `chore: update CACHE_NAME for tool calling deploy`
4. `cleanup: remove unused callAIWithHistory import from inbox.js`
5. `fix: 6 bugs found by deep audit of tool calling migration`

---

## Що зроблено в сесії 09.04 (start-session-0xaJ3)

### Баг-фікси: B-23, B-24, B-25 — ВСІ КРИТИЧНІ ЗАКРИТІ
- **B-23** — табло Inbox показувало fallback замість AI. Видалено `_isTooSimilar()` (подвійний антиповтор блокував все), виправлено граматику fallback ("1 задач" → "1 задача"), fallback більше не оновлює `nm_owl_board_ts`
- **B-24** — "нагадай ввечері" створювало задачу замість нагадування. Додано правило "НАГАДАЙ = ЗАВЖДИ set_reminder" + маркери часу (вранці=08:00, ввечері=18:00) в INBOX_SYSTEM_PROMPT, Notes, Health промпти
- **B-25** — тап на подію в календарі не працював. Створено event-edit modal (модалка редагування події: назва, дата, час, пріоритет, видалити)

### Аудит промптів AI
- Notes і Health chat bars — додано `set_reminder` (було пропущено)
- Знайдено 2 мертві функції: `toggleChatBar`, `sendOwlReplyFromInput`
- habits.js 1401 рядків — наближається до ліміту 1500

### Календар — повна переробка
- **Модалка розкладу дня** — тап на дату відкриває модалку з об'єднаним таймлайном (routine blocks + events + tasks)
- **All-day events** — події без часу показуються зверху як "весь день"
- **Тап на routine block** → routine modal з навігаційним стеком (закриття → повернення в calendar)
- **Тап на event** → event-edit modal
- **"Події місяць"** перенесені під сітку календаря (було перекриття)
- **Підсвітка вибраного дня** — помаранчева рамка + анімація тапу scale(0.88)
- **Zoom-анімація** — всі 3 модалки (calendar, routine, day schedule) з zoom in/out з центру
- **Кастомний drum picker (барабан)** для дати і часу в event-edit modal замість нативних input
  - Дата: День | Місяць (Січ-Гру) | Рік
  - Час: Години (00-23) | Хвилини (крок 5)
  - CSS scroll-snap, gradient fade, індіго лінії виділення
  - Свайп по барабану не закриває модалку (guard в setupModalSwipeClose)

### Іконки кнопок
- Задачі/Звички — flex 0.8 (на 20% вужчі)
- Календар — SVG іконка з **динамічним числом** (актуальна дата, оновлюється щохвилини)
- Розпорядок — SVG листок з рядками і годинником у куточку
- Обидві кнопки — 54px (було 44px)

### Живі відповіді агента (Фаза 1)
- `save_routine` на кілька днів — проміжне повідомлення "Копіюю..." → пауза 1.5 сек → "Готово!"
- `create_project` — "Створюю проект..." перед створенням
- Typing indicator тримається мінімум 0.8 сек (не зникає миттєво)
- `_splitReply` helper у processUniversalAction

---

## 🔴 Що треба зробити далі

### Живі відповіді Фаза 2 — агент пише в чат сам
**Статус:** Фаза 2.0 ЗРОБЛЕНО 10.04 (2 тригери: stuck-task, event-passed). Треба тестувати на продакшені.

**Відкрите у Фазі 2.1 (після тесту):**
- `welcome-back` у чат (зараз тільки на табло) — follow-up при поверненні після паузи 2+ год
- `after-action` тригер — контекстне питання після дії
- Крапки/бейджі на tab bar щоб юзер бачив нові повідомлення з будь-якої вкладки (зараз бачить тільки коли зайде у Продуктивність)
- Потенційно: розширити trigger→tab map на інші вкладки (habit-streak, budget-warn, mood-check, note-reminder)

### Jarvis Architecture — ДО Supabase

**⚠️ ОНОВЛЕНО 11.04 після обговорення з Gemini 3 Pro + аудиту коду.** Детальне обговорення стратегії, аналіз "велосипед vs стандарт" — див. `docs/CHANGES.md` запис від 11.04.

**Виявлено при аудиті 11.04:**
- ✅ **Judge Layer (4.19) ВЖЕ РЕАЛІЗОВАНО** як `shouldOwlSpeak()` у `src/owl/inbox-board.js` (рядки 330-535). Не треба робити з нуля.
- ✅ **BroadcastChannel cross-tab sync ВЖЕ Є** у `src/core/boot.js` (рядки 146-154). Живе паралельно зі старим `localStorage.setItem` override.

**Новий порядок кроків (затверджено 11.04):**

0. ✅ **Документація і синхронізація ROADMAP** — ЗРОБЛЕНО 11.04 у цій сесії. Оновлено FEATURES_ROADMAP (Judge Layer → "зроблено", 4.2 переформульовано на структуровані факти, BroadcastChannel → "зроблено"), CLAUDE.md (localStorage.setItem hack + nm_gemini_key як тимчасове рішення), зафіксовано бізнес-модель.

1. ~~**4.1 Tool Calling**~~ → ✅ ЗРОБЛЕНО 10.04 (25 tools, prompt скорочений у 6-7 разів, 6 багів виправлено аудитом)

2. **Крок 1 — Уніфікація `followups.js` з `shouldOwlSpeak()`** (0.5-1 сесія). Зараз `src/owl/followups.js` (Live Chat Replies, 10.04) має ВЛАСНІ блокери (глобальний cooldown, активний чат, silent phase) і НЕ викликає Judge Layer. Переписати щоб обидва канали (табло + follow-ups) ходили через один `shouldOwlSpeak()`. Вирішує дублювання логіки "чи говорити".

3. **Крок 2 — Структурована пам'ять фактів (4.2 переформульовано)** (1.5-2 сесії). Замість тексту `nm_memory` — список фактів з timestamps. Новий tool `save_memory_fact(що, коли, категорія)`. Переписати `doRefreshMemory()`. Міграція існуючого тексту. **Вирішує корінь бага "болить горло" архітектурно.**

4. **Крок 3 — Semantic cooldowns (4.3)** (1 сесія). AI повертає поле `topic` у JSON-відповіді. Блокувати теми (`daily_mood`, `task_reminder`) а не слова. Видалити `_extractBannedWords`. Переписати cooldown-систему щоб блокувала теми.

5. **Крок 4 — Negative Memory (4.20)** (1 сесія). Новий ключ `nm_negative_rules` з правилами "що дратує". Логіка авто-додавання (ігнорування 3+ разів → правило). UI кнопка "не нагадуй мені про це" на повідомленнях OWL. Передача правил у `getAIContext()`.

**Відкладено на окреме обговорення:**
- **SyncEngine архітектура** — як саме реалізувати offline-first sync (Варіант C за Gemini) коли прийде час Supabase. Окрема сесія проектування.
- **Деталізація freemium меж** — що саме у безкоштовній версії (скільки запитів AI на день? які вкладки доступні? базовий OWL без проактивності?), що у підписці (повний Jarvis, Pattern Detection, Push тощо). Потрібно визначити ДО Supabase. Впливає на UI онбордингу, Edge Functions rate limiting, систему обліку використання.
- **RAG через Tool Calling** (4.47 новий пункт) — замість запихати весь getAIContext у кожен запит, дати AI інструменти `search_notes()`, `get_user_finances()` щоб він шукав тільки потрібне. Розвантажує контекст. Після Крок 4.
- **BroadcastChannel cleanup** — зняти `localStorage.setItem` override після перевірки що BroadcastChannel покриває всі кейси. Низький пріоритет — працює як є.

**Старі пункти що залишаються в roadmap:**
- **G1 Тиша = модифікатор** — уточнення Judge Layer (тиша без контенту = 0 балів)
- **G2 Burst cooldown** — антиспам при серії задач/звичок
- **G4 Shadowing** — конфлікти розкладу (календар > розпорядок)
- **G6 Дедуплікація нагадувань** — linked_event_id
- ~~**Мерж розпорядок + календар**~~ → ЗРОБЛЕНО (модалка дня з об'єднаним таймлайном)
- ~~**G5 All-day events**~~ → ЗРОБЛЕНО (зверху таймлайну)

### Після Supabase
- **Supabase** — хмарна БД, синхронізація, акаунти
- **Push-сповіщення**
- **G7 Focus Mode** — режим глибокої роботи
- **G8 speechSynthesis** — голос для критичних дедлайнів
- **i18n** — дві мови

---

## Ключові файли (оновлено 10.04)

| Файл | Опис |
|------|------|
| `src/tabs/calendar.js` | nm_events, Calendar modal, Day schedule modal (об'єднаний таймлайн), Events list, "Найближче", Routine modal, Drum picker (барабан дати/часу), Event-edit modal, zoom-анімації, навігаційний стек, SVG іконка з динамічною датою |
| `src/owl/proactive.js` | Єдина генерація табло, instant reactions, first-visit hints, _extractBannedWords антиповтор, local fallback з характером + правильна граматика, API error dot |
| `src/owl/inbox-board.js` | OWL Board: shouldOwlSpeak() Judge Layer, getOwlBoardContext, анкетування, вечірній пульс, нагадування (перевірка кожну хв), safety net, chat-closed тригер |
| `src/owl/chips.js` | Центральний модуль чіпів — рендер, клік, fuzzy match ✔️, трекінг, chip context для AI |
| `src/ai/core.js` | getAIContext, callAI, callAIWithHistory, **callAIWithTools (NEW 10.04)**, **INBOX_TOOLS 25 function definitions (NEW 10.04)**, **INBOX_SYSTEM_PROMPT скорочений ~200→~30 рядків (10.04)**, OWL особистість, правило ЗМІНИТИ=edit |
| `src/tabs/inbox.js` | **sendToAI() на tool calling (10.04)**, **_toolCallToAction() конвертер (10.04)**, processSaveAction (подовжений: parsed.mood, parsed.details), save_routine, chip board context, _detectEventFromTask, min 0.8s typing, split reply для create_project |
| `src/tabs/tasks.js` | Задачі + task chat, **setupModalSwipeClose з drum-col guard** |
| `src/tabs/habits.js` | Звички + processUniversalAction (edit_event, delete_event, edit_note, set_reminder, save_routine), **_splitReply helper**, saveQuitLog з dispatch |
| `src/core/nav.js` | TAB_THEMES, doRefreshMemory |

---

## Попередні сесії

- **10.04** — 🎯 **4.1 Tool Calling зроблено.** Перехід AI з текстового JSON на OpenAI function calling. 25 tools, prompt скорочений ~200→~30 рядків. `callAIWithTools()` нова функція, `_toolCallToAction()` конвертер. Backward compat для tab chat bars. Глибокий аудит виявив і виправив 6 багів (1 critical: sendClarifyText pre-existing null bug; 4 medium: втрачені details/mood/comment поля; 1 low: nested additionalProperties).
- **09.04** — B-23/B-24/B-25 закриті. Календар переробка: day schedule modal, об'єднаний таймлайн routine+events, all-day events, drum picker, event-edit modal, zoom-анімації, SVG іконки з динамічною датою. Живі відповіді Фаза 1: split replies, min typing delay. Аудит промптів: set_reminder додано в Notes/Health.
- **08-09.04** — Judge Layer (shouldOwlSpeak), Relevance Scoring, chat/board priorities, розпорядок дня (🕐 модалка), нагадування (set_reminder), edit_event/delete_event/edit_note, повне редагування з усіх чат-барів, B-15/dawn/quit dispatch/finance date/CI auto-increment. Gemini review → G1-G8 записані. Рішення: тільки сова з 3 характерами.
- **07.04 (2)** — B-20/B-21/B-22 закриті. Calendar Фази 4-5. Instant reactions. Анкетування. First-visit hints. Єдиний мозок (всі промпти синхронізовані). Фікс event vs момент. i18n записано в roadmap.
- **07.04** — B-18/B-19 закриті, Calendar modal + nm_events, один мозок (всі чати = universal action), динамічний скор, верифікація 6 багів, LICENSE/README, CI фікс. Нові: B-20/B-21/B-22.
- **06.04 (2)** — Мозок OWL Фази 1-3: єдина генерація, синхронізація табло↔чат, Welcome Back, крос-контекст, трекінг чіпів, insights, емпатія, ранковий бриф. B-16/B-17 закриті.
- **06.04** — B-16: централізація чіпів в chips.js, fuzzy match ✔️, промпт "чіпи = відповіді". Roadmap: 12 ідей проактивності.
- **05.04** — Inline стилі → CSS: 17 нових класів, ~145 inline стилів замінено.
- **05.04** — Gemini audit: B-13/B-14/B-15, видалення MCP експерименту, скіл `/gemini`.
- **04.04 (6)** — Прибирання мусору: 2 мертві функції, 12 typeof guards (−68 рядків).
- **04.04 (5)** — ES Modules рефакторинг: 22 модулі, 162 window handlers.
- **04.04 (4)** — Repo audit: handleScheduleAnswer TTL, людська мова, чіпи-навігація.
- **04.04 (3)** — Табло read-only, чіпи через чат-бар, owlChipToChat.
