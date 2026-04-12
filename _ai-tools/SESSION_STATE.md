# Стан сесії

**Оновлено:** 2026-04-11 (сесія start-session-FPKOV — Крок 1 уніфікація + Крок 2 структурована пам'ять фактів)

---

## Проект

| | |
|--|--|
| **Версія** | v131+ (деплої через auto-merge) |
| **URL** | owls68.github.io/NeverMind |
| **AI модель** | OpenAI GPT-4o-mini з **Tool Calling** (function calling) — SINCE 10.04 |
| **Гілка** | `claude/start-session-FPKOV` |
| **Repo** | **Public** + LICENSE (All Rights Reserved) |

---

## ⚠️ ДЛЯ НОВОГО ЧАТУ — найважливіше

**1. ПРАВИЛО №1:** завжди пояснювати в дужках ВСЕ не-українською — англіцизми, сленг, назви функцій, технічні терміни. Роман вчиться через пояснення. Деталі → `CLAUDE.md` верхня секція "ОБОВ'ЯЗКОВО В КОЖНОМУ ПОВІДОМЛЕННІ".

**2. РОЗМІР ВІДПОВІДЕЙ — СЕРЕДНІЙ.** Не мікро-відмашки, не простирадла. 5-15 рядків для звичайної відповіді. Роман втомлюється читати довгі повідомлення з телефону. Деталі → `CLAUDE.md` секція "📏 РОЗМІР ВІДПОВІДЕЙ".

**3. Без "Роби" від Романа — НЕ змінювати код.** Роман каже "Роби" — і тільки тоді.

**4. ГЛИБИНА ВІДПОВІДІ (додано 12.04).** Коли Роман дає задачу — НЕ відповідай одразу "на пам'ять". СПОЧАТКУ прочитай реальний код всіх залучених файлів, зрозумій залежності, тоді давай оцінку. Краще витратити час на читання ніж дати поверхневу відповідь яку Роман мусить виправляти 2-3 повідомленнями. Деталі → `CLAUDE.md` секція "🧠 Глибина відповіді".

**5. Архітектурний принцип: ОДИН МОЗОК НА ВСЕ.** OWL = єдиний Jarvis. Табло, чати, чіпи — різні вікна одного мозку. **Зміна в одній вкладці = зміна в усіх.** Мозок має працювати на будь-якій комбінації активних вкладок — юзер може не використовувати 5 з 8. Повний план → `FEATURES_ROADMAP.md` секція "🧠 Мозок OWL".

**6. Наступний крок роботи:** ✅ Крок 1 і ✅ Крок 2 ЗРОБЛЕНО 11.04. Далі — **Крок 3: семантичні cooldowns** (AI повертає `topic` поле у JSON; блокуємо теми а не слова; видалити `_extractBannedWords`; 1 сесія). Або тест Кроку 2 на продакшені перед рухом далі. Деталі → секція "Jarvis Architecture — ДО Supabase" нижче.

**7. Бізнес-модель зафіксована (11.04):** freemium — безкоштовна базова версія з мінімальними функціями, підписка для повного функціоналу. **API через хмару Supabase Edge Functions** — користувач НЕ вписує свій OpenAI ключ. Роман тримає спільний ключ на сервері, виклики OpenAI йдуть через Edge Function, ліміти застосовуються за рівнем підписки. Це фундаментальне рішення яке впливає на: (а) що буде в безкоштовній версії vs платній, (б) архітектуру Supabase Edge Functions з першого дня, (в) систему обліку використання (хто скільки запитів зробив).

---

## Що зроблено в сесії 11.04 (start-session-FPKOV)

### ✅ Крок 2 — Структурована пам'ять фактів (архітектурний фікс бага "болить горло")

**Проблема:** `nm_memory` — текстовий абзац ~300 слів без часових міток. AI не розрізняв "хворів минулого місяця" vs "хворіє зараз" → видавав старі факти як актуальні. Попередня сесія виправила латкою ("ПРАВИЛО ЧЕСНОСТІ" у промпті), але корінь лишився.

**Рішення — нова архітектура пам'яті:**

1. **Новий модуль `src/ai/memory.js`** (~280 рядків):
   - Структура факту: `{id, text, category, ts, lastSeen, source, ttl}`
   - 6 категорій: `preferences | health | work | relationships | context | goals` (кожна з кольором/emoji для UI)
   - TTL (time-to-live — скільки днів жити): `null` для постійних (сім'я, алергія), 7-30 днів для тимчасових (симптоми, поточні обставини)
   - CRUD: `getFacts()` (з фільтром TTL), `getFactsRaw()` (без фільтра, для UI), `addFact()` (з bigram-дедуплікацією 75% поріг), `deleteFact()`, `updateFactText()`, `touchFact()`, `cleanupExpiredFacts()`
   - Forматтери: `formatFactsForContext(30)` (для `getAIContext()`, з відносним часом), `formatFactsForBoard(15)` (коротший для промпту табло)
   - Міграція: `isMigrationDone()`, `markMigrationDone()`, `getLegacyMemoryText()`
   - Hard limit 100 фактів (trim за `lastSeen`)

2. **Новий tool `save_memory_fact` у `INBOX_TOOLS`** (стало 26 tools):
   - Параметри: `fact` (3-15 слів від третьої особи), `category`, `ttl_days?`
   - Description інструктує AI: викликати ПАРАЛЕЛЬНО з іншими tools коли юзер згадує факт про себе; НЕ для поточних справ
   - Dispatcher у `src/tabs/inbox.js` (і `sendToAI`, і `sendClarifyText`) — зберігає тихо через `addFact()`, UI-повідомлення приходить через `msg.content` який AI додає параллельно

3. **Переписаний `doRefreshMemory()` у `src/core/nav.js`:**
   - Крок 1: `cleanupExpiredFacts()` — прибирає прострочені
   - Крок 2: одноразова міграція `_migrateLegacyMemoryToFacts()` — на першому запуску передає старий текст у AI через `callAIWithTools` зі `save_memory_fact` tool → AI витягує до 30 фактів з текстового абзацу → `addFact(source: 'migration')`. Прапор `nm_facts_migrated` = '1'
   - Крок 3: фонова екстракція `_backgroundExtractFacts()` — безумовно раз на день аналізує дані за 7 днів (inbox, задачі, нотатки, моменти, чати всіх вкладок), викликає AI з `save_memory_fact` tool + списком вже відомих фактів для дедуплікації, макс 5 нових фактів за виклик. Safety net для джерел що ще не на tool calling

4. **`getAIContext()` у `src/ai/core.js`:**
   - Читає факти через `formatFactsForContext(30)` — групує по категорії з відносним часом ("3 дні тому")
   - Якщо фактів ще немає → fallback на legacy `nm_memory` (поки міграція не пройшла)
   - Інструктує AI не цитувати факти здоров'я/обставин старші ніж день як актуальний стан

5. **UI "Що агент знає про мене" у налаштуваннях:**
   - `renderMemoryCards()` повністю переписаний — групує факти за категорією з кольоровими бейджами, показує відносний час і джерело (Inbox/фон/вручну/міграція), TTL якщо є
   - Inline редагування через `contenteditable` + `onblur → saveMemoryFactEdit(id, text)`
   - Видалення через `deleteMemoryCard(id)` → `deleteFact(id)`
   - Додавання вручну через `addMemoryEntry()` → `addFact(source: 'manual', category: 'context')` (юзер потім може змінити категорію редагуванням)
   - Порожній стан з підказкою

6. **Проактивність (`src/owl/proactive.js`):**
   - Промпт табло тепер читає `formatFactsForBoard(15)` замість `localStorage.getItem('nm_memory')`
   - Fallback на legacy текст для backward compat

7. **Фінанси (`src/tabs/finance.js`):**
   - `hasDebt` детекція тепер читає і нові факти (категорії work/context), і legacy `nm_memory` — комбінує обидва через `.toLowerCase().includes()`

8. **Інфраструктура:**
   - `NM_KEYS.settings` у `boot.js` отримав `nm_facts` і `nm_facts_migrated`
   - `exportData()` у `nav.js` — додано `nm_facts` у бекап JSON

**Архітектурний результат:** корінь бага "болить горло" вирішено. Тепер:
- AI бачить КОЛИ факт записано → сам судить чи досі актуальний
- Тимчасові факти (симптоми) живуть 7-14 днів, далі самі зникають через TTL
- Постійні факти (сім'я, алергія, вподобання) — без TTL, живуть вічно
- Дедуплікація через bigram similarity (перекриття пар символів) — "Любить каву" не створить 5 копій
- Два канали наповнення (real-time Inbox + background daily) забезпечують покриття
- Юзер бачить все що агент знає і може виправляти через UI

**Файли змінено (сесія сумарно, Крок 1 + Крок 2):**
- `src/ai/memory.js` — НОВИЙ, ~280 рядків
- `src/ai/core.js` — імпорт memory, нова секція у getAIContext, новий tool `save_memory_fact`, правило у INBOX_SYSTEM_PROMPT
- `src/tabs/inbox.js` — імпорт `addFact`, converter + dispatcher для `save_memory_fact` (у sendToAI і sendClarifyText, тепер обидва цикли обробляють ВСІ tool_calls паралельно)
- `src/core/nav.js` — повний перепис doRefreshMemory + UI functions renderMemoryCards/addMemoryEntry/deleteMemoryCard/saveMemoryFactEdit, імпорт memory функцій
- `src/owl/proactive.js` — промпт табло через formatFactsForBoard
- `src/owl/inbox-board.js` — Крок 1 (Judge Layer channel-aware)
- `src/owl/followups.js` — Крок 1 (делегація у Judge Layer)
- `src/tabs/finance.js` — hasDebt читає і facts і legacy
- `src/core/boot.js` — NM_KEYS + nm_facts/nm_facts_migrated
- `sw.js` — CACHE_NAME `nm-20260411-1519`
- `FEATURES_ROADMAP.md` — 4.2 позначено зробленим, додано 4.47 (RAG через search_facts) у "Після Supabase"
- `CLAUDE.md` — додано memory.js у таблицю файлів, додано nm_facts/nm_facts_migrated у таблицю даних, оновлено "що AI бачить" секцію
- `_ai-tools/SESSION_STATE.md` — цей запис

**Наступна сесія:**
1. **Тест на продакшені** (рекомендую першим):
   - Перевірити що міграція з `nm_memory` пройшла при першому запуску після деплою — відкрити налаштування → "Що агент знає про мене", має з'явитись структурований список фактів замість плоского тексту
   - Написати в Inbox щось типу "у мене алергія на горіхи" — має тихо викликатись `save_memory_fact`, потім відкрити налаштування → перевірити що факт з'явився
   - Через день — `doRefreshMemory()` автоматично витягне нові факти з активності (фоновий канал)
2. **Крок 3 Semantic cooldowns** — 1 сесія, невелика зміна у промтах табло і cooldown-системі
3. **Крок 4 Negative Memory** — окрема сесія

### ✅ Крок 1 — Уніфікація `followups.js` з `shouldOwlSpeak()`
**Проблема:** Два паралельні "судді" — `shouldOwlSpeak()` у `inbox-board.js` (для табло) і власні hard-блокери у `followups.js` (для chat follow-ups). Дубльована логіка "чи говорити": silent phase, API key, global cooldown, activeChatBar.

**Рішення — channel-aware Judge Layer:**

1. **`src/owl/inbox-board.js`** — `shouldOwlSpeak(trigger, opts = {})`:
   - Новий параметр `opts.channel`: `'board'` (default, backward compat) або `'chat-followup'`
   - Новий параметр `opts.targetTab`: для 'chat-followup' — у яку вкладку йде повідомлення
   - Спільні hard-блокери (API key, silent phase) — у роутері на початку
   - Далі роутинг у приватні функції `_judgeBoard(trigger)` або `_judgeFollowup(trigger, targetTab)`
   - `_judgeBoard` — існуючий код 08.04 БЕЗ змін, тільки винесений у приватну функцію
   - `_judgeFollowup` — нова функція: блокує якщо `activeChatBar === targetTab` або `followup_global` cooldown (1 год) не минув; +5 очок за `stuck-task`/`event-passed`
   - Однаковий `SPEAK_THRESHOLD = 3`, однаковий формат повернення `{speak, score, reason}`

2. **`src/owl/followups.js`** — видалено дубльовані блокери:
   - Видалено: перевірку `getDayPhase() === 'silent'`, `followup_global` cooldown, API key, `activeChatBar === tab`
   - Видалено імпорт `getDayPhase`, `activeChatBar`, константу `FOLLOWUP_GLOBAL_CD`
   - Додано імпорт `shouldOwlSpeak` — тепер це єдиний суддя
   - `checkFollowups()` тепер: детекція тригерів → `shouldOwlSpeak(type, {channel:'chat-followup', targetTab})` → якщо `speak:true` → надсилає
   - Лишилось у файлі: детекція застряглих задач, детекція минулих подій, per-item cooldowns (`followup_stuck_<id>`, `followup_event_<id>`), генерація тексту, надсилання, `_checkInFlight` guard

**Що це дає:**
- Один суддя на обидва канали — немає дублювання
- Прозорість: будь-який майбутній блокер додається в одному місці
- Легше додавати нові канальні тригери (welcome-back-in-chat, after-action) — просто розширити `_judgeFollowup`
- Backward compat: всі існуючі виклики `shouldOwlSpeak(trigger)` без opts продовжують працювати як board-channel

**Файли змінено:**
- `src/owl/inbox-board.js` — `shouldOwlSpeak` роутер + `_judgeBoard` + `_judgeFollowup`
- `src/owl/followups.js` — видалено власні блокери, делегування в Judge Layer
- `sw.js` — CACHE_NAME `nm-20260411-1107`

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

0. ✅ **Документація і синхронізація ROADMAP** — ЗРОБЛЕНО 11.04 (start-session-B29hd). Оновлено FEATURES_ROADMAP (Judge Layer → "зроблено", 4.2 переформульовано на структуровані факти, BroadcastChannel → "зроблено"), CLAUDE.md (localStorage.setItem hack + nm_gemini_key як тимчасове рішення), зафіксовано бізнес-модель.

1. ~~**4.1 Tool Calling**~~ → ✅ ЗРОБЛЕНО 10.04 (25 tools, prompt скорочений у 6-7 разів, 6 багів виправлено аудитом)

2. ~~**Крок 1 — Уніфікація `followups.js` з `shouldOwlSpeak()`**~~ → ✅ ЗРОБЛЕНО 11.04 (start-session-FPKOV). Додано channel-aware routing у `shouldOwlSpeak(trigger, opts)`: `'board'` (default) або `'chat-followup'`. Спільні hard-блокери винесено в роутер, далі делегація у `_judgeBoard` або `_judgeFollowup`. `followups.js` скорочено — тільки доменна логіка (детекція тригерів, per-item cooldowns, генерація, надсилання), усі глобальні блокери делегуються Judge Layer.

3. ~~**Крок 2 — Структурована пам'ять фактів (4.2)**~~ → ✅ ЗРОБЛЕНО 11.04 (start-session-FPKOV). Новий модуль `src/ai/memory.js` з `nm_facts` (структура `{id, text, category, ts, lastSeen, source, ttl}`). Новий tool `save_memory_fact` у `INBOX_TOOLS`. Повністю переписаний `doRefreshMemory()` з одноразовою міграцією legacy `nm_memory` + фоновою екстракцією через tool calling. UI у налаштуваннях показує факти з категоріями/часом/джерелом. Простий варіант (всі факти у getAIContext без фільтрації) — RAG відкладено як Крок 4.47 після Supabase+pgvector. Архітектурно виправляє корінь бага "болить горло". Детально — секція "Що зроблено в сесії 11.04" вище.

4. **Крок 3 — Semantic cooldowns (4.3)** (1 сесія). AI повертає поле `topic` у JSON-відповіді. Блокувати теми (`daily_mood`, `task_reminder`) а не слова. Видалити `_extractBannedWords`. Переписати cooldown-систему щоб блокувала теми. ← **НАСТУПНИЙ (після тесту Кроку 2 на продакшені)**

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
