# NeverMind — Журнал змін

> Кожна сесія Claude повинна додавати сюди запис після завершення роботи.
> Формат: дата, що зроблено, які файли змінено, чи є відкриті проблеми.
> Старіші записи → `_archive/CHANGES_OLD.md`

---

## 2026-04-13 — 🗺️ Консолідація плану в `ROADMAP.md`

**Контекст:** План проекту був розкиданий по 3 файлах — `FEATURES_ROADMAP.md` (704 рядки), секція "Відкрите на майбутнє" у `_ai-tools/SESSION_STATE.md` (537 рядків), частково `CONCEPTS_ACTIVE.md`. Новий чат губився де шукати. Попередня сесія (gQ2Hl) залишила пріоритетну задачу на новий чат — консолідувати.

**Що зроблено:**

**Новий `ROADMAP.md`** (232 рядки, у корені репо) — єдине місце правди для плану:
- `🚀 Active` — поточний пріоритет (Блок 1)
- `📋 Next` — 7 послідовних блоків робіт (узгоджено з Романом 13.04):
  1. Малі фікси з великою цінністю (`set_reminder`, 4.5, G9, G11, G12, 4.40)
  2. Концепції вкладок (Фінанси/Вечір/Я/Проекти/Здоров'я доробка + аудит)
  3. Ключові UX-розширення (Inbox редизайн, динамічний розпорядок, G4/G5/G6, голосовий ввід)
  4. Мозок OWL: інструменти AI (4.11, 4.9, 4.10, G13)
  5. Мозок OWL: якість рішень (4.4, 4.20+4.39, 4.6, G1-G3, G10, 4.21)
  6. Довершення (4.7, 4.8, 4.41, 4.43 Фаза A, Геймфікація)
  7. Адаптивність Android + desktop (в кінець)
- `✅ Done` — останні 5 сесій з датами (13.04 до 04-05.04)
- `💡 Ideas` — ідеї для обговорення (Три агенти, Живий OWL, 4.22/4.25-4.36/4.42-4.46, G7/G8/G14)
- `🚫 Rejected` — відхилені з причиною + anti-patterns
- `🔒 After Supabase` — окремий блок (Pattern Detection, Push, voice-first, Belief Graph, Intent Graph, i18n, 4.47 RAG)

**Архівовано** (через `git mv`):
- `FEATURES_ROADMAP.md` → `_archive/FEATURES_ROADMAP.md` — повні обговорення Grok/Gemini/DeepSeek/Perplexity, джерела, дослідження, архітектурні принципи
- `_ai-tools/SESSION_STATE.md` (стара 537-рядкова версія) → `_archive/SESSION_STATE_2026-04-13.md`

**Новий компактний `_ai-tools/SESSION_STATE.md`** (~80 рядків): версія + гілка + посилання на ROADMAP + останні 5 сесій + "Для нового чату — найважливіше" + ключові файли. БЕЗ старої секції "🔥 ПРІОРИТЕТНА ЗАДАЧА" (завдання виконано).

**Оновлено посилання:**
- `.claude/commands/start.md` — крок 6 (читання `FEATURES_ROADMAP.md`) → читання `ROADMAP.md` + пояснення структури. Крок 3 (варіанти) → брати з `ROADMAP.md` `🚀 Active`/`📋 Next` замість "Відкрите на майбутнє" у SESSION_STATE
- `CLAUDE.md` — Карта документації: додано `ROADMAP.md` + `_archive/FEATURES_ROADMAP.md`. Два інших посилання на FEATURES_ROADMAP → ROADMAP. Примітка про "BroadcastChannel cleanup" → тепер посилання на ROADMAP
- `START_HERE.md` — додано `ROADMAP.md` як файл №4 в обов'язкових до читання
- `CONCEPTS_ACTIVE.md` — посилання на roadmap оновлено
- `.claude/commands/deploy.md` — "нові заплановані фічі → ROADMAP.md" замість FEATURES_ROADMAP

**Перевірено через grep:** усі живі (не-архівні) посилання на `FEATURES_ROADMAP.md` тепер або ведуть на `_archive/FEATURES_ROADMAP.md` (історичні деталі), або на новий `ROADMAP.md`. Посилання на `_ai-tools/SESSION_STATE.md` лишились — вказують на новий компактний файл.

**CACHE_NAME НЕ чіпали** — це чисто документаційні зміни (виняток з `CLAUDE.md` правила деплою).

**Файли змінено:** `ROADMAP.md` (new), `_ai-tools/SESSION_STATE.md` (rewrite), `CLAUDE.md`, `START_HERE.md`, `CONCEPTS_ACTIVE.md`, `.claude/commands/start.md`, `.claude/commands/deploy.md`, `docs/CHANGES.md` (цей запис), `_archive/FEATURES_ROADMAP.md` (moved), `_archive/SESSION_STATE_2026-04-13.md` (moved).

**Відкриті питання — немає.** Коли читаєш ROADMAP — починай з `🚀 Active`, далі `📋 Next` Блок 1.

---

## 2026-04-11 — 🧠 Стратегія мозку OWL: обговорення з Gemini, синхронізація ROADMAP, бізнес-модель

**Контекст:** Роман підняв питання "ми вигадуємо велосипед який давно вигадали?". Провели 2 ітерації обговорення з Gemini 3 Pro через скіл `/gemini`, зробили аудит реального коду (1 агент Explore), виявили що частина плану вже реалізована, переформулювали стратегію.

**Що зроблено:**

**Коміт 1 — `bf3d4e2` fix: латка бага "болить горло"**
- `src/ai/core.js` `getOWLPersonality()` — нова секція "ПРАВИЛО ЧЕСНОСТІ" (4 пункти: не вигадувати поточний стан, не цитувати історичний профіль як поточність, не казати "видалено" без факту в trash, можна говорити впевнено про реальні дані).
- `src/ai/core.js` `getAIContext()` — `nm_memory` перейменовано з "Що знаю про користувача" на "Довгостроковий профіль (ІСТОРИЧНИЙ, може бути застарілим)".
- `sw.js` CACHE_NAME → `nm-20260411-0548`
- **Це латка**, не виправлення корінної проблеми — правильне рішення у Кроці 2 (структурована пам'ять).

**Коміт 2 — `0cad09a` docs: /start читає FEATURES_ROADMAP**
- `.claude/commands/start.md` — додано обов'язкове читання `FEATURES_ROADMAP.md` + `CONCEPTS_ACTIVE.md` + умовно `РОМАН_ПРОФІЛЬ.md`. Без цього Claude у новій сесії не бачив стратегічний план і починав вигадувати власні рішення.

**Коміт 3 — `8fb777b` docs: правило середній розмір відповідей**
- `CLAUDE.md` — нова секція "📏 РОЗМІР ВІДПОВІДЕЙ" (цільовий розмір 5-15 рядків, пояснення в дужках ≠ розтягнута думка).
- `РОМАН_ПРОФІЛЬ.md` — посилений пункт "Не перевантажувати" з посиланням на CLAUDE.md.
- `.claude/commands/start.md` — перебудовано крок 1: СПОЧАТКУ правила взаємодії, ПОТІМ стан проекту. `РОМАН_ПРОФІЛЬ.md` тепер читається безумовно.

**Обговорення з Gemini — ключові рішення:**
- **Велосипед vs стандарт:** зараз велосипед виправданий (PWA без бекенду), після Supabase — перехід на pgvector/RAG. Assistants API відхилено як суперечне принципу 4.22 Micro-orchestration.
- **SyncEngine (Варіант C / 4.38 Offline-first)** затверджено як шлях міграції на Supabase. localStorage залишається синхронним джерелом істини UI, SyncEngine у фоні пише на Supabase через чергу. Читання — cache-first + тихе оновлення з сервера.
- **4.2 переформульовано** — замість "наративного саммарі" (2 речення) → структуровані факти з timestamps (JSON-список). Причина: Gemini показав що Zep/Mem0 роблять key-value факти, наративне саммарі губить деталі. Об'єднано з 4.16 Core Memory.
- **Бізнес-модель вирішена:** freemium (безкоштовна базова + підписка повна). API через хмару Supabase Edge Functions — юзер НЕ вписує свій OpenAI ключ. Роман тримає спільний ключ на сервері, ліміти за рівнем підписки. Технічний наслідок: `nm_gemini_key` у localStorage тимчасовий, після Supabase переноситься на сервер.
- **RAG через Tool Calling** — новий пункт 4.47 у roadmap. Замість запихати весь контекст у кожен запит — дати AI інструменти `search_notes()`, `get_finances()` щоб він шукав тільки потрібне.

**Аудит коду (Explore агент) виявив:**
- ✅ **Judge Layer ВЖЕ Є** — `shouldOwlSpeak()` у `src/owl/inbox-board.js` (рядки 330-535). Працює по балах (score 0-15+), поріг 3. Пункт 4.19 у roadmap був неправильно записаний як "плани".
- ✅ **BroadcastChannel ВЖЕ Є** — у `src/core/boot.js` (рядки 146-154, функція `setupSync()`). Живе паралельно зі старим `localStorage.setItem` override як двошарова страховка.
- ⚠️ **Дублювання логіки:** `src/owl/followups.js` (Фаза 2 Live Chat Replies, 10.04) має ВЛАСНІ блокери і НЕ викликає `shouldOwlSpeak()`. Порушує принцип "один мозок". Треба уніфікувати → це новий Крок 1 у плані.

**Коміт 4 — docs: синхронізація ROADMAP**
- **`FEATURES_ROADMAP.md`** — додано Judge Layer і BroadcastChannel у "Що мозок вже вміє". Переформульовано 4.2 (структуровані факти замість наративу). 4.19 позначено як ✅ з відкритим завданням уніфікації. 4.20 деталізовано.
- **`CLAUDE.md`** — оновлено секцію про `localStorage.setItem` override (BroadcastChannel вже поруч, не "крихкий самотній hack").
- **`_ai-tools/SESSION_STATE.md`** — новий порядок кроків Jarvis Architecture, секція "ДЛЯ НОВОГО ЧАТУ" оновлена з правилом розміру.

**Коміт 5 (цей) — docs: бізнес-модель freemium зафіксована, GLOSSARY видалено**
- **Бізнес-модель:** freemium (безкоштовна + підписка), API через хмару. Зафіксовано у `FEATURES_ROADMAP.md`, `SESSION_STATE.md`, `CLAUDE.md` (секція `nm_gemini_key`).
- **`docs/GLOSSARY.md` видалено** — Роман вирішив що не треба окремого файлу-словника, він перепитає в Claude якщо зустріне незнайомий термін. Всі посилання на GLOSSARY прибрано з SESSION_STATE.md і CHANGES.md.

**Новий порядок кроків ДО Supabase:**
1. Уніфікація `followups.js` з `shouldOwlSpeak()` (0.5-1 сесія) — наступний крок
2. Структурована пам'ять фактів (1.5-2 сесії) — вирішує корінь бага "горло"
3. Semantic cooldowns — AI повертає `topic` (1 сесія)
4. Negative Memory `nm_negative_rules` (1 сесія)

**Файли змінено:**
- `src/ai/core.js` (коміт 1)
- `sw.js` (коміт 1)
- `.claude/commands/start.md` (коміти 2, 3)
- `CLAUDE.md` (коміт 3 + цей коміт)
- `РОМАН_ПРОФІЛЬ.md` (коміт 3)
- `FEATURES_ROADMAP.md` (цей коміт)
- `_ai-tools/SESSION_STATE.md` (цей коміт)
- `docs/CHANGES.md` (цей запис)

**Відкриті задачі:**
- Баг "горло" залатаний правилом в промпті, архітектурно виправиться у Кроці 2
- Деталізація freemium меж (що у безкоштовній версії, що в підписці) — окреме обговорення ДО Supabase
- SyncEngine деталі — окрема сесія проектування коли дійдемо до Supabase
- Тестування Фази 2 Live Chat Replies (follow-ups у чаті) на продакшені — не протестовано з 10.04

---

## 2026-04-10 — 🎯 4.1 Tool Calling — перехід AI на OpenAI function calling

**Що зроблено:**
- **`src/ai/core.js`**: Додано `INBOX_TOOLS` — 25 визначень функцій (save_task, save_note, save_habit, save_moment, create_event, save_finance, complete_habit/task, create_project, edit_*/delete_*/reopen_task, add_step, move_note, update_transaction, set_reminder, restore_deleted, save_routine, clarify). Додано `callAIWithTools()`. `_fetchAI()` приймає optional tools параметр, повертає message object коли tools передані, content string — коли ні.
- **`src/ai/core.js`**: `INBOX_SYSTEM_PROMPT` скорочено з ~200 рядків до ~30. Прибрано всі описи JSON-форматів, залишено тільки правила класифікації (task vs event vs project, НАГАДАЙ=set_reminder, список vs окремі задачі).
- **`src/tabs/inbox.js`**: Додано `_toolCallToAction()` конвертер. `sendToAI()` переписаний на tool calling dispatch. `sendClarifyText()` теж. Існуючі handlers (processSaveAction, processCompleteHabit, processCompleteTask, processUniversalAction) працюють БЕЗ змін через конвертер.
- **`sw.js`**: CACHE_NAME → `nm-20260410-0325`

**Переваги:**
- AI ніколи не поверне зламаний JSON — OpenAI гарантує валідну структуру
- Promt у 6-7 разів коротший → дешевше в токенах, більше контексту
- AI краще класифікує дії (окремі tools з чіткими описами)
- Backward compat: callAI/callAIWithHistory/callOwlChat працюють для tab chat bars і proactive.js

**Аудит виявив і виправив 6 багів:**
- 🔴 **CRITICAL:** `sendClarifyText` читав `clarifyOriginalText` ПІСЛЯ `closeClarify()` яка обнуляла його → AI отримував `"null"` замість тексту. Це був pre-existing bug і в старому коді — виправлено збереженням у локальну змінну.
- 🟡 `save_habit`: поле `details` губилось у конвертері → детальний опис звички втрачався. Тепер `parsed.details` використовується в processSaveAction якщо є.
- 🟡 `save_moment`: поле `mood` губилось → AI-класифікація настрою замінювалась regex fallback. Тепер `parsed.mood` використовується якщо є.
- 🟡 `edit_event`, `edit_note`, `edit_task`, `edit_habit`: поле `comment` не передавалось через конвертер.
- 🟢 Вкладені об'єкти у `save_routine.blocks` і `clarify.options` без `additionalProperties: false` — не ламає (strict mode вимкнений), але несумісно з майбутнім strict mode.
- 🟢 `callAIWithHistory` імпортувався в inbox.js але не використовувався — прибрано (знайдено першим аудитом).

**Змінені файли:** `src/ai/core.js`, `src/tabs/inbox.js`, `sw.js`, `_ai-tools/SESSION_STATE.md`, `CLAUDE.md`, `docs/CHANGES.md`

**Коміти:** 5 (феншуй-коміти на гілці `claude/start-session-HdqBj`)

**Що треба далі:** 4.2 Day State + Nightly Brain Dump, 4.3 Семантичні cooldowns, G1-G8 виправлення. 4.1 закрито.

---

---

## 2026-04-06 — B-16: Централізація системи чіпів + Roadmap проактивності

**Що зроблено:**

1. **B-16 (частково):** Система чіпів переписана — весь код чіпів зібрано в `src/owl/chips.js`:
   - `renderChips()` — єдина функція рендеру (видалено дублікати з `board.js` і `inbox-board.js`)
   - `CHIP_PROMPT_RULES` — єдиний текст правил для AI промптів (видалено 3 копії)
   - `handleCompletionChip()` — ✔️ чіпи закривають задачі/звички локально через fuzzy match
   - Чіпи зникають після кліку з анімацією
   - Промпт: "чіпи = відповіді юзера, НЕ заклики до дії"

2. **Roadmap:** Нова секція "Розумна проактивність агента" в `FEATURES_ROADMAP.md` — 12 ідей (кореляції, тригери всіх вкладок, ранковий бриф, емпатія, забуті задачі, авто-пам'ять, вивчення слів юзера).

3. **Баги:** B-16 і B-17 додані в `NEVERMIND_BUGS.md` з детальними описами.

**Файли змінено:** `src/owl/chips.js`, `src/owl/board.js`, `src/owl/inbox-board.js`, `src/owl/proactive.js`, `src/ai/core.js`, `sw.js`, `FEATURES_ROADMAP.md`, `NEVERMIND_BUGS.md`

**Відкрите:** B-16 залишок (чіпи-привиди на інших вкладках), B-17 (миттєва реакція табло).

---

## 2026-04-05 — Gemini workflow + глобальний клінап документації

**Що зроблено:**

**Частина 1 — Gemini інтеграція (попередні коміти цієї сесії):**
- Видалено невдалий експеримент `_ai-tools/gemini-mcp/` (Railway MCP-сервер, 357 рядків Node.js, SSE transport) — причина згортання: засвітився `GEMINI_API_KEY` у чаті → secret scanner Anthropic заблокував сесію. Railway-проект видалений окремо Романом.
- Створено скіл `/gemini` — ручний workflow: Claude збирає контекст (CLAUDE.md + SESSION_STATE + git diff + змінені файли + питання), виводить одним код-блоком з кнопкою Copy, Роман копіює в застосунок Gemini на iPhone (модель Pro), повертає відповідь у чат.
- Оновлено модель у скілі з 2.5 Pro на 3 Pro (актуальна станом на 04.2026).
- **Перший реальний тест скіла** на `src/owl/board.js` + `src/owl/chips.js` — workflow працює. Gemini знайшов 3 цінні моменти + 1 галюцинацію яку Claude заарбітрував.

**Частина 2 — Клінап документації (основа цієї сесії):**

Виявлено що документація застрягла між двома епохами: на етапі 01.04 була реструктуризація docs (CHANGES.md, SESSION_STATE.md, CONCEPTS_ACTIVE.md, FEATURES_ROADMAP.md), після цього — ES-modules рефакторинг коду (app-*.js → src/core/, src/ai/, src/owl/, src/ui/, src/tabs/). **Тільки таблиця файлів у CLAUDE.md оновилась, всі інші docs продовжували посилатись на app-*.js.**

4 коміти клінапу:

1. `docs(bugs): consolidate NEVERMIND_BUGS.md, migrate to src/ paths`
   - Видалено дубль `_ai-tools/NEVERMIND_BUGS.md` (мій випадковий новий файл)
   - `NEVERMIND_BUGS.md` (корінь) — source of truth. 7 старих багів (B-03..B-12) оновлено на `src/` шляхи, позначено "потрібна верифікація" (деякі могли виправитись під час рефакторингу — Роман перевірить у наступній сесії).
   - Додано 3 нові баги знайдені через `/gemini`: **B-13** (🔴 апостроф у `onclick` чіпів, `src/owl/board.js`), **B-14** (🟡 `includes()` false positives, `src/owl/chips.js`), **B-15** (🟢 setTimeout magic number, `src/owl/chips.js`).
   - Секція wontfix з галюцинацією Gemini про `<msg.id>` — урок на майбутнє.
   - `/fix` скіл оновлено: правильний шлях (корінь), новий крок оновлення BUGS після фіксу.

2. `docs(CLAUDE.md): migrate stale refs to src/ + add documentation map`
   - Таблиця "Дані (localStorage)": 19 рядків оновлено (`app-inbox.js` → `src/tabs/inbox.js` тощо).
   - Секція "Що не можна змінювати": `app-core-system.js` → `src/core/boot.js`.
   - "Міжмодульні залежності": переписано діаграму під `src/` структуру з поясненням esbuild збірки.
   - **Нова секція "Карта документації"** — таблиці "Читати коли..." (12 файлів) і "Писати/оновлювати коли..." (11 сценаріїв). Мета: новий чат знаходить потрібне одним лукапом, без запитів "куди писати?".

3. `docs: rewrite START_HERE.md + docs/ARCHITECTURE.md for src/ structure`
   - **`START_HERE.md`** — повністю переписано. Був найкритичнішим застарілим: містив карту з 13 `app-*.js` файлів. Тепер показує справжню `src/` ієрархію (core/ai/owl/ui/tabs). Додано посилання на `/gemini` скіл.
   - **`docs/ARCHITECTURE.md`** — переписано діаграми (mermaid) під `src/` структуру: граф модулів з підгрупами, Inbox flow, storage map, OWL triggers, memory system, tabs integration. Уточнено legacy-назву `nm_gemini_key` (OpenAI ключ).
   - **`NEVERMIND_ARCH.md` → `_archive/NEVERMIND_ARCH.md`** — повністю застарілий дубль `docs/ARCHITECTURE.md` (містив `index.html` з 2600 рядків замість реальних 1475). Перенесено в архів.

4. `docs: update FEATURES_ROADMAP + DESIGN_SYSTEM + changelog entry` (цей коміт)
   - `FEATURES_ROADMAP.md`: 3 посилання `app-ai-chat.js`/`app-ai-core.js`/`app-inbox.js` → `src/owl/*`/`src/ai/core.js`/`src/tabs/inbox.js`.
   - `docs/DESIGN_SYSTEM.md`: `setupModalSwipeClose знаходиться в app-tasks-core.js` → `src/tabs/tasks.js`.
   - Цей запис у `docs/CHANGES.md`.

**Що НЕ чіпалось (свідомо):**
- `src/`, `index.html`, `style.css`, `sw.js`, `bundle.js` — жодних змін у коді
- `CACHE_NAME` — не оновлюємо, бо в PWA кеш не потрапляє нічого з цієї сесії
- `NEVERMIND_LOGIC.md`, `CONCEPTS_ACTIVE.md`, `РОМАН_ПРОФІЛЬ.md` — timeless концептуальні документи, без посилань на код
- `_archive/` — історія не редагується
- Правила процесу, якість виконання, AI-логіка, деплой, OWL концепція у `CLAUDE.md`

**Відкрите на майбутнє:**
- Виправити 3 реальні баги знайдені через `/gemini`: B-13 (критичний, апостроф), B-14 (design smell), B-15 (low pri) — окрема сесія через `/fix B-13`
- Верифікувати 7 старих багів B-03..B-12 проти `src/` — деякі могли бути виправлені під час рефакторингу
- Допрацювати `/gemini` скіл: 5 покращень (import graph, анти-галюцинаційні правила, підключення BUGS.md, повний CLAUDE.md, самооцінка Gemini) — окрема сесія

**Частина 3 — Критичний аудит правил (2 додаткові коміти):**

5. `docs: fix remaining app-*.js refs in CLAUDE.md + rewrite /new-file skill` — фінальні залишки `app-*.js`, повний перепис скіла `/new-file` який був небезпечно застарілий (інструктував додавати файли в корінь проекту, реєструвати в `STATIC_ASSETS` і прописувати `<script>` теги — все це ламало б проект зараз).

6. `docs(rules): dedupe and clarify rules, add explanations in all terms` — критичний аудит правил:
   - Видалено 6 дублів між `CLAUDE.md` і `РОМАН_ПРОФІЛЬ.md`.
   - Об'єднано "Сперечайся" + "Пропонуй кращі рішення" в одне правило з акцентом "чесність > ввічливість" і вимогою пояснювати ЧОМУ (Роман вчиться через пояснення).
   - "Mockup перед кодом" переформульовано на "UI — опиши перед кодом" з трьома кроками (посилання на схожий компонент → опис словами → ASCII для нового).
   - Кожен пункт "Що не можна змінювати" переписано з поясненнями в дужках (localStorage.setItem override, circular dependencies, bfcache, setupSW, порядок імпортів, централізована БД-абстракція).
   - "Чеклист аудиту" скорочено до одного речення з посиланням на скіл `/audit`.
   - Додано виняток для `CACHE_NAME`: не міняти при docs-only комітах.
   - Видалено "Прибирати gesture swipe" — не правило, а опис функціональності.
   - Додано секцію "❌ Заборонені кольори" в `docs/DESIGN_SYSTEM.md` з правилом про фіолетовий.

**Частина 4 — Посилення правила "Пояснення в дужках":**

7. (цей коміт) — Роман зауважив що Claude постійно порушує правило №1 протягом сесії. Посилено формулювання:
   - Явний список "коли додавати пояснення" (англіцизми, терміни, сленг, назви функцій)
   - Додано механізм **САМОПЕРЕВІРКИ перед надсиланням** (проскануй текст на англомовні слова без дужок)
   - Пояснено чому критично: Роман підприємець, не розробник, вчиться через пояснення. Без них — не може прийняти рішення.
   - Фінальне уточнення: "Це правило ВАЖЛИВІШЕ за стислість".

**Результат сесії:**
- 10 комітів на гілці, всі запушені
- Документація у повністю узгодженому стані, жодних посилань на застарілу `app-*.js` структуру в активних файлах
- Нова чітка "Карта документації" в `CLAUDE.md` — новий чат знаходить куди писати за один лукап
- Скіл `/gemini` робочий, перший тест успішний (3 реальні баги знайдено)
- 3 нові баги записані для наступної сесії через `/fix B-13/B-14/B-15`
- Правило №1 (пояснення в дужках) посилено з механізмом самоперевірки

**Змінені файли (вся сесія):** `NEVERMIND_BUGS.md`, `CLAUDE.md`, `START_HERE.md`, `РОМАН_ПРОФІЛЬ.md`, `docs/ARCHITECTURE.md`, `docs/DESIGN_SYSTEM.md`, `docs/CHANGES.md`, `FEATURES_ROADMAP.md`, `.claude/commands/fix.md`, `.claude/commands/new-file.md`, `.claude/commands/gemini.md` (новий), `_ai-tools/SESSION_STATE.md`, `_ai-tools/NEVERMIND_BUGS.md` (видалено — був дублем), `_archive/NEVERMIND_ARCH.md` (перенесено з кореня), `_ai-tools/gemini-mcp/` (видалено — 5 файлів експерименту)

---

## 2026-04-01 — Реструктуризація документації

**Що зроблено:**
- `CLAUDE.md` переписано: всі правила з 5 файлів зведено в одне місце + 2 нові правила якості (CSS верифікація, діагностика перед ретраєм)
- `START_HERE.md` спрощено: mandatory reading = SESSION_STATE + BUGS (~80 рядків замість 192)
- `_ai-tools/SESSION_STATE.md` розширено: версія, гілка, останні сесії, відкриті баги
- `_archive/` створено: РОМАН_ПРОГРЕС.md, decisions.md, NEVERMIND_STATUS.md, CHANGES_OLD.md
- `ШПАРГАЛКА_CLAUDE.md` видалено (гайд для Романа, не для Claude)
- `NEVERMIND_LOGIC.md` очищено: тільки концепція + OWL принципи (без правил)
- `CONCEPTS_ACTIVE.md` + `FEATURES_ROADMAP.md` створено (розділено з NEVERMIND_CONCEPTS.md)

**Змінені файли:** `CLAUDE.md`, `START_HERE.md`, `_ai-tools/SESSION_STATE.md`, `NEVERMIND_LOGIC.md`, `CONCEPTS_ACTIVE.md` (новий), `FEATURES_ROADMAP.md` (новий), `_archive/*`

---

## 2026-04-01 — B-11/B-12: фікс padding в модалках + крок фону

**Що зроблено:**
- `index.html` рядок ~957: `padding:0 20px` на outer panel (`overflow:hidden`) модалки задачі
- `index.html` рядок ~1129: `padding:0 20px` на outer panel модалки звички
- `app-tasks-core.js` рядок 116: фон кроків задачі → `rgba(255,255,255,0.7)` з бордером (як поля вводу)
- `docs/DESIGN_SYSTEM.md`: задокументовано структуру модального вікна і ⚠️ типову помилку з padding
- **Ключовий інсайт:** padding треба ставити на outer `overflow:hidden` елемент, не на inner `overflow-y:auto`
- `sw.js`: CACHE_NAME → `nm-20260401-0720`

**Змінені файли:** `index.html`, `app-tasks-core.js`, `docs/DESIGN_SYSTEM.md`, `sw.js`

---

## 2026-04-01 — Фікс deploy pipeline v2: deploy прямо в auto-merge.yml

**Що зроблено:**
- `.github/workflows/auto-merge.yml`: додано job `deploy` (needs: merge). Тепер merge і deploy — один workflow, без крос-workflow тригерів.
- `.github/workflows/deploy.yml`: прибрано `workflow_run` тригер. Залишено тільки `push: main` (резерв для хотфіксів).
- `sw.js`: CACHE_NAME → `nm-20260401-0448`.
- **Причина:** `workflow_run` ненадійний — GitHub часто пропускає/затримує ці події.

**Змінені файли:** `.github/workflows/auto-merge.yml`, `.github/workflows/deploy.yml`, `sw.js`

---

## 2026-03-31 — Deploy pipeline fix: GitHub Pages не оновлювався

**Що зроблено:**
- `.github/workflows/deploy.yml`: додано `workflow_run` тригер на завершення `auto-merge.yml`.
- Додано умову `if: success`, `ref: main` в checkout.
- `sw.js`: CACHE_NAME → `nm-20260331-1846`.

**Змінені файли:** `.github/workflows/deploy.yml`, `sw.js`

---

## 2026-03-31 — B-10: чат авто-розгортається при переключенні на Inbox

**Що зроблено:**
- `app-core-nav.js`: видалено блок `// Inbox чат завжди відкритий` в `switchTab()`. Тепер стан чату зберігається як є.

**Змінені файли:** `app-core-nav.js`, `sw.js`

---

## 2026-03-31 — B-07/B-08 + надійне оновлення iOS PWA

**Що зроблено:**
- `app-tasks-core.js`: B-07 — крок ставить галочку тільки якщо тач рухнувся < 10px (тап, не свайп)
- `app-tasks-core.js`: B-08 — `toggleTaskStep()` повертає `task.status = 'active'` якщо не всі кроки виконані
- `app-core-system.js`: iOS PWA — переписано `setupSW()`: синхронна реєстрація, `pageshow` для bfcache, `location.replace()` замість `reload()`

**Змінені файли:** `app-tasks-core.js`, `app-core-system.js`, `sw.js`

---

## Шаблон для нового запису

```
## YYYY-MM-DD — Короткий опис сесії

**Що зроблено:**
- ...

**Змінені файли:** file1.js, file2.js
```
