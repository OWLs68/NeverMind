# Стан сесії

**Оновлено:** 2026-04-09 (кінець сесії find-phase-4-rA8je)

---

## Проект

| | |
|--|--|
| **Версія** | v71+ (деплої через auto-merge) |
| **URL** | owls68.github.io/NeverMind |
| **AI модель** | OpenAI GPT-4o-mini (ключ у `localStorage`, назва `nm_gemini_key` — legacy) |
| **Гілка** | `claude/find-phase-4-rA8je` |
| **Repo** | **Public** + LICENSE (All Rights Reserved) |

---

## ⚠️ ДЛЯ НОВОГО ЧАТУ — найважливіше

**1. ПРАВИЛО №1:** завжди пояснювати в дужках ВСЕ не-українською — англіцизми, сленг, назви функцій, технічні терміни. Роман вчиться через пояснення. Деталі → `CLAUDE.md` верхня секція "ОБОВ'ЯЗКОВО В КОЖНОМУ ПОВІДОМЛЕННІ".

**2. Без "Роби" від Романа — НЕ змінювати код.** Роман каже "Роби" — і тільки тоді.

**3. Архітектурний принцип: ОДИН МОЗОК НА ВСЕ.** OWL = єдиний Jarvis. Табло, чати, чіпи — різні вікна одного мозку. **Зміна в одній вкладці = зміна в усіх.** Повний план → `FEATURES_ROADMAP.md` секція "🧠 Мозок OWL".

---

## Що зроблено в сесії 08-09.04 (find-phase-4-rA8je)

### Judge Layer + Relevance Scoring (4.4 + 4.19) — РЕАЛІЗОВАНО
- `shouldOwlSpeak()` — єдина функція-суддя з балами доречності
- Пріоритети чат vs табло: чат відкритий = -10, критичне пробиває
- `chat-closed` тригер — табло оновлюється через 3 сек після закриття чату
- Safety net: stale board > 60 хв = примусова генерація
- Local fallback з характером OWL (coach/partner/mentor) коли API падає
- Червона крапка на сові при помилках API

### Розпорядок дня — НОВА ФІЧА
- `nm_routine` в localStorage: {default:[], mon:[], sat:[]}
- Модалка 🕐 біля 📅 з таймлайном, вкладки днів Пн-Нд
- Inline форма додавання (input type=time, не prompt)
- AI бачить розклад всіх днів + [НАСТУПНЕ ЗА РОЗКЛАДОМ]
- save_routine action: створити, копіювати (масив днів), змінити, видалити
- Працює з усіх чат-барів

### Нагадування — НОВА ФІЧА
- `set_reminder` action → `nm_reminders` в localStorage
- Перевірка кожну хвилину, показ на табло як [КРИТИЧНО]
- Працює з усіх чат-барів

### Повне редагування через чат
- Нові actions: edit_event, delete_event, edit_note
- Додано в промпти ВСІХ 8 чат-барів (tasks/notes/finance/health/evening/projects/me/inbox)
- Правило "ЗМІНИТИ = edit, НЕ create"

### Баг-фікси
- B-15: setTimeout(100) → double requestAnimationFrame
- Dawn phase: інструкція для фази світанку в промпті
- saveQuitLog: додано dispatch nm-data-changed (quit-звички сповіщають OWL)
- Finance date: "вчора/позавчора" парсинг дати транзакцій
- CI: auto-increment version (v69→v70→v71...)
- Chip context: чіпи передають повідомлення табло в AI
- Non-inbox tabs: bypass Judge Layer для data-changed

### Документація
- G1-G8 ідеї Gemini записані в FEATURES_ROADMAP.md
- Рішення: тільки сова з 3 характерами, без інших тварин

---

## Що зроблено в сесії 07.04 (start-session-2VlSR)

### B-20, B-21, B-22 — всі закриті
- **B-20** — табло тепер реагує на відповіді юзера в чаті (`saveChatMsg` dispatch'ає `nm-data-changed` при `role=user`)
- **B-21** — антиповтор контенту табло: `_extractBannedWords()` + `_isTooSimilar()` (overlap >60% = відкидає)
- **B-22** — кодова детекція подій: `_detectEventFromTask()` (regex fallback), `_detectEventDate()`, + `create_event` додано в промпт чат-бару Продуктивність

### Calendar Фази 4-5
- **Фаза 4** — Закріплені картки найближчих подій/дедлайнів зверху Inbox (7 днів, макс 3)
- Тап на будь-яку inbox-картку → навігація (task→tasks, habit→habits, event→calendar, note→notes, finance→finance)
- Events list modal — нова модалка зверху з подіями/дедлайнами на місяць (при тапі на 📅 в Продуктивність)
- **Фаза 5** — `getAIContext()` включає найближчі події та дедлайни (7 днів) з міткою [ВАЖЛИВО]

### Миттєві реакції табло
- При complete_task/complete_habit/hold_quit/add_moment — локальне привітання БЕЗ API (0 сек)
- 5 варіантів на тип дії, рандомний вибір
- Через 5 сек — AI генерує нове повідомлення з іншою темою

### Нещодавно закриті задачі в контексті AI
- `getAIContext()` показує задачі закриті за 24 години з міткою [ФАКТ]
- AI не сперечається з юзером ("ти не відмітив декларацію" — більше не буде)

### Анкетування OWL
- 12 питань (робота, цілі, інтереси, мотивація, розпорядок, здоров'я, мрії тощо)
- 1 питання на день, вранці/вдень
- `nm_owl_questions` — трекінг заданих, `nm_owl_q_ts` — час

### Контекстні підказки при першому відвідуванні вкладки
- 8 вкладок з підказками (локально, без API)
- `nm_tab_first_visit` — трекінг відвіданих

### Єдиний мозок — синхронізація всіх промптів
- Додано в ВСІ чат-бари: `edit_habit`, `complete_task`, `complete_habit`, правило task vs event
- Me Chat — додано actions + обробку JSON (раніше мав 0 actions)

### Фікс: категорія event з датою → calendar, без дати → момент
- `processSaveAction`: коли AI каже `event` + regex знаходить дату → `nm_events` (календар)
- Без дати → `nm_moments` (момент дня, як раніше)

### Документація
- i18n (дві мови) записано в `FEATURES_ROADMAP.md` — після Supabase

### 5 нових actions (дій) для єдиного мозку
- **edit_task** — змінити назву/дедлайн/пріоритет задачі (fuzzy match)
- **delete_task** / **delete_habit** — видалити через чат (+ undo toast)
- **add_moment** — додати момент дня з будь-якої вкладки
- **reopen_task** — перевідкрити закриту задачу
- Всі 5 додані в processUniversalAction + промпти ВСІХ 8 чат-барів

### CI фікс
- Deploy job об'єднано з merge job — один job без race condition
- cache-bust `?v=CACHE_NAME` у sw.js для iOS PWA

### Jarvis Architecture — повний план (мозковий штурм з 5 AI + дослідження)
- **46 пунктів** записані в `FEATURES_ROADMAP.md` секція "Фаза 4: Jarvis Architecture"
- **Claude** (10): Day State, Relevance Scoring, Contextual Personality, instant reactions, Pattern Detection
- **Gemini** (7): семантичні cooldowns, Tool Calling, Context Bloat fix
- **GPT-4o** (15): Judge Layer, Conversation OS, Belief Graph, Mission Lock, Attention Budget, Repair Loop, Negative Memory, Episode Summary, Voice-first
- **Grok** (11): Micro-mood Sensor, Memory Echo, Override Memory ("відчепись"), Auto-silence, Mirror Mode, Ghost Presence, Fast Path/Deep Path, Life Threading, "уважніший а не розумніший"
- **DeepSeek** (3 прийнято, 3 відхилено): Event Sourcing, CSS-анімація, ембеддинг-антиповтор. Відхилено: робо-стиль мови, видалення табло, видалення чіпів
- **Perplexity** (12 фактів): Google Now +41% помилок, max 1-2 nudges/год, Tool Calls швидші за strict-JSON, "AI silence" дослідження
- Живий OWL: 8 станів анімації + мікро-переходи (сова біжить на місце коли бабл з'являється)

---

## 🔴 Що треба зробити далі

### Jarvis Architecture — ДО Supabase (пріоритет)
1. **4.1 Tool Calling** — перевести API на function calling (2 сесії, найбільший ефект)
2. **4.2 Day State + Nightly Brain Dump** — нічна компресія дня в 3 пункти (1 сесія)
3. **4.3 Семантичні cooldowns** — topic-based антиповтор замість лексичного (1 сесія)
4. **G3 Характери → Judge Layer поріг** — різна поведінка coach/partner/mentor (0.5 сесії)
5. **G1 Тиша = модифікатор** — фікс: тиша без контенту = 0 балів (0.25 сесії)
6. **G2 Burst cooldown** — антиспам при серії задач/звичок
7. **4.20 Negative Memory** — пам'ять що дратує
8. **Мерж розпорядок + календар** — події підтягуються в таймлайн (1 сесія)
9. **G4 Shadowing** — конфлікти розкладу: календар > розпорядок
10. **G5 All-day events** — "Фокус дня" зверху таймлайну
11. **G6 Дедуплікація нагадувань** — linked_event_id

### ✅ Зроблено (ця сесія)
- ~~4.4 Relevance Scoring~~ → shouldOwlSpeak()
- ~~4.19 Judge Layer~~ → єдина функція-суддя
- ~~4.5 Блокування табло поки чат відкритий~~ → пріоритети + chat-closed
- ~~B-15~~ → double rAF
- Розпорядок дня, нагадування, edit_event/note, CI auto-increment

### Після Supabase
- **Supabase** — хмарна БД, синхронізація, акаунти
- **Push-сповіщення**
- **G7 Focus Mode** — режим глибокої роботи
- **G8 speechSynthesis** — голос для критичних дедлайнів
- **i18n** — дві мови

---

## Ключові файли (оновлено)

| Файл | Опис |
|------|------|
| `src/tabs/calendar.js` | nm_events, Calendar modal, Events list modal, блок "Найближче" |
| `src/owl/proactive.js` | Єдина генерація табло, instant reactions, first-visit hints, антиповтор контенту |
| `src/owl/chips.js` | Центральний модуль чіпів — рендер, клік, fuzzy match ✔️, трекінг |
| `src/owl/inbox-board.js` | OWL Board: тригери, cooldowns, getOwlBoardContext, анкетування, вечірній пульс |
| `src/ai/core.js` | getAIContext (+ recently done, upcoming events), callAI, OWL особистість |
| `src/tabs/inbox.js` | sendToAI, processSaveAction, _detectEventFromTask, _detectEventDate, navigateInboxItem, _renderUpcoming |
| `src/tabs/tasks.js` | Задачі + task chat (з processUniversalAction + edit_habit) |
| `src/tabs/habits.js` | Звички + processUniversalAction (edit_habit, create_event, complete_*, тощо) |
| `src/core/nav.js` | TAB_THEMES, doRefreshMemory |

---

## Попередні сесії

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
