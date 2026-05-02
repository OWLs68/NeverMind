# INDEX.md — семантичний індекс "куди йти за чим"

> **Мета:** на старті сесії замість читати 2000+ рядків — читаю INDEX (~150 рядків) + цілюся у потрібну секцію файла через Read з `offset`+`limit`. Економія 60-80% на поглиблених відповідях.
>
> **Створено 20.04.2026** (сесія g05tu, Фаза 4 рефакторингу документації).
>
> **Як оновлювати:** при створенні нового файлу або секції — додати рядок сюди (md-index-reminder.sh хук нагадує).

---

## 🎯 За темами (куди йти коли Роман питає про X)

### Правила і процес роботи

| Питання | Файл / секція |
|---|---|
| Правила взаємодії з Романом (пояснення у дужках, розмір, "Роби") | `CLAUDE.md` ядро (10 поведінкових правил) → деталі у `_ai-tools/RULES_COMMUNICATION.md` |
| Хто Роман, як комунікувати | `РОМАН_ПРОФІЛЬ.md` |
| Глибина відповіді (читай код перед оцінкою) / чек-лісти архітектурних задач / smoke test | `_ai-tools/RULES_WORKFLOW.md` |
| UI-задачі: вигляд замість назв коду / mockup перед кодом | `_ai-tools/RULES_UI.md` + `docs/DESIGN_SYSTEM.md` |
| Великі файли (skeleton+Edit) / checkpoint-коміти / CACHE_NAME bump / i18n / AI tools | `_ai-tools/RULES_TECH.md` |
| Болючі правила з прикладами ❌/✅ (8 шт) | `_ai-tools/HOT_RULES.md` |
| Великі задачі / 5 паралельних поглядів агентів | `CLAUDE.md` секція 🧠 Council |
| Уроки Claude — патерни, анти-патерни, рішення | `lessons.md` |

### Концепція і продукт

| Питання | Файл / секція |
|---|---|
| Базова концепція (один Inbox, мінімум тертя, Jarvis) | `NEVERMIND_LOGIC.md` — "Базова концепція" |
| Принцип "Один мозок на все" | `NEVERMIND_LOGIC.md` → "Архітектурний принцип: ОДИН МОЗОК НА ВСЕ" |
| Концепції окремих вкладок (Finance/Evening/Me/Projects/Health) | `CONCEPTS_ACTIVE.md` |
| Що не можна змінювати без обговорення | `docs/DO_NOT_TOUCH.md` |
| Еволюція концепції (що було → стало) | `NEVERMIND_LOGIC.md` → "Еволюція концепції" |

### План робіт

| Питання | Файл / секція |
|---|---|
| Що робимо зараз / поточний Active | `ROADMAP.md` → "🚀 Active" |
| Що далі по черзі / Блок 2-7 | `ROADMAP.md` → "📋 Next" |
| Ідеї на обговорення | `ROADMAP.md` → "💡 Ideas" |
| Відкинуті варіанти | `ROADMAP.md` → "🚫 Rejected" |
| Що після Supabase | `ROADMAP.md` → "🔒 After Supabase" |
| Що вже зроблено (хронологія) | `ROADMAP_DONE.md` |
| Детальний план Вечора 2.0 | `docs/EVENING_2.0_PLAN.md` |
| Детальний план Фінансів v2 (6 фаз) | `docs/FINANCE_V2_PLAN.md` |
| Поточний рефакторинг документації (g05tu) | `_ai-tools/REFACTOR_PLAN.md` |

### Сесії і баги

| Питання | Файл / секція |
|---|---|
| Поточна версія / гілка / останні сесії | `_ai-tools/SESSION_STATE.md` |
| Деталі конкретної сесії (що робили, коміти) | `docs/CHANGES.md` § за датою |
| Старі сесії (до 6GoDe 19.04) | `_archive/SESSION_STATE_archive.md` |
| Відкриті баги | `NEVERMIND_BUGS.md` → 🔴 / 🟡 / 🟢 |
| Закриті баги за 2 останні сесії | `NEVERMIND_BUGS.md` → "✅ Закриті" |
| Старі закриті баги | `_archive/BUGS_HISTORY.md` |

### Технічна довідка

| Питання | Файл / секція |
|---|---|
| Файлова структура проекту | `docs/FILE_STRUCTURE.md` |
| Як працює деплой (CI, `-X theirs`, cache-bust) | `docs/TECHNICAL_REFERENCE.md` → "Система деплою" |
| Повний список AI tools (31 INBOX + 8 UI + 8 health/mem/cat) | `docs/AI_TOOLS.md` |
| Структури даних (Task, Note, Habit, Transaction тощо) | `docs/TECHNICAL_REFERENCE.md` → "Структури даних" |
| Дані у localStorage (всі ключі) | `docs/TECHNICAL_REFERENCE.md` → "Дані localStorage" |
| Діаграми потоків даних (Inbox flow, OWL тригери) | `docs/ARCHITECTURE.md` |
| Міжмодульні залежності | `docs/TECHNICAL_REFERENCE.md` → "Міжмодульні залежності" |
| Як працює OWL Board (Judge Layer, cooldowns, memory) | `docs/TECHNICAL_REFERENCE.md` → "AI-логіка" + `NEVERMIND_LOGIC.md` → "Принципи OWL" |
| Як працює getAIContext (що передається) | `docs/TECHNICAL_REFERENCE.md` → "AI-логіка" |

### UI і дизайн

| Питання | Файл / секція |
|---|---|
| Кольори, палітра, стилі модалок | `docs/DESIGN_SYSTEM.md` (перепис Aps79 27.04 — 9 секцій з якорями) |
| Шпаргалка дизайну (1 екран) | `docs/DESIGN_SYSTEM.md` → секція 1 "⚡ Шпаргалка" |
| Готові шаблони коду (модалка/картка/чіп/Safe Areas/Haptics) | `docs/DESIGN_SYSTEM.md` → секція 3 "📦 Шаблони для копі-пасту" |
| Чекліст перед UI-пушем | `docs/DESIGN_SYSTEM.md` → секція 6 |
| Техборг UI (фіолет 4×, конфлікти радіусів/blur/тіней) | `docs/DESIGN_SYSTEM.md` → секція 7 |
| Інциденти UI (padding 01.04, UUID-onclick xGe1H, мовчанка диспетчера Aps79) | `docs/DESIGN_SYSTEM.md` → секція 8 "🚫 Анти-патерни" |
| Словник термінів (outer/backdrop/glass/safe-area/skeleton) | `docs/DESIGN_SYSTEM.md` → секція 9 |
| Свайп-видалення (attachSwipeDelete) | `src/ui/swipe-delete.js` + `docs/DO_NOT_TOUCH.md` |
| Голосовий ввід у чатах | `src/ui/voice-input.js` |
| Іконки фінансів (SVG-набір 41 іконки) | `src/tabs/finance-cats.js` |

### Git і аварійні процедури

| Питання | Файл / секція |
|---|---|
| Екстрений скид (reset --hard + force push) | `docs/GIT_EMERGENCY.md` |
| Історія інциденту v54-v130 | `docs/GIT_EMERGENCY.md` → "Історія події" |
| Відкат рефакторингу g05tu | `docs/GIT_EMERGENCY.md` → "Відкат рефакторингу документації" + `_ai-tools/REFACTOR_PLAN.md` |

### Скіли Claude Code

| Питання | Файл / секція |
|---|---|
| Список скілів з тригер-правилами | `_ai-tools/SKILLS_PLAN.md` |
| UI-задача (модалка/колір/дизайн) | Скіл `/ux-ui` + `docs/DESIGN_SYSTEM.md` |
| Промпт OWL / галюцинації | Скіл `/prompt-engineer` + `src/ai/prompts.js` |
| iOS/PWA баги (bfcache/SW/keyboard) | Скіл `/pwa-ios-fix` + `src/core/boot.js setupSW()` |
| Рефакторинг великих файлів (>500 рядків) | Скіл `/refactor-large` |
| Supabase / offline / міграції | Скіл `/supabase-prep` |
| Повна перевірка роботи | Скіл `/audit` |
| Виправити конкретний баг | Скіл `/fix B-XX` |
| Додати новий JS-модуль | Скіл `/new-file` |
| Швидкий старт сесії | Скіл `/start` |
| Оновлення документації перед новим чатом | Скіл `/finish` |

---

## 📁 За файлами (що знайдеш у кожному)

### Корінь

- `CLAUDE.md` — правила процесу + карта документації
- `START_HERE.md` — точка входу сесії
- `РОМАН_ПРОФІЛЬ.md` — хто Роман і як з ним працювати
- `ROADMAP.md` — дорожня карта (Active/Next/Ideas/Rejected/AfterSupabase)
- `ROADMAP_DONE.md` — виконане (історія)
- `NEVERMIND_BUGS.md` — відкриті і недавно закриті баги
- `NEVERMIND_LOGIC.md` — концепція + "Один мозок"
- `CONCEPTS_ACTIVE.md` — концепції вкладок
- `lessons.md` — уроки Claude (патерни / анти-патерни / рішення)
- `index.html` + `style.css` + `sw.js` + `bundle.js` — продакшен-код
- `build.js` + `package.json` — збірка

### `docs/`

- `AI_TOOLS.md` — довідник tools (JSON-definitions, промпт-правила, історія змін)
- `ARCHITECTURE.md` — діаграми потоків даних
- `CHANGES.md` — хронологічний журнал усіх сесій з комітами
- `DESIGN_SYSTEM.md` — стилі, кольори, модалки, помилки
- `DO_NOT_TOUCH.md` — священні корови (не чіпати без обговорення)
- `EVENING_2.0_PLAN.md` — план Вечора 2.0 (8 фаз)
- `FILE_STRUCTURE.md` — таблиця всіх файлів з відповідальністю
- `FINANCE_V2_PLAN.md` — план Фінансів v2 (6 фаз + Аналітика)
- `GIT_EMERGENCY.md` — процедура скиду + історія v54-v130
- `TECHNICAL_REFERENCE.md` — деплой / AI-логіка / дані / структури / залежності

### `_ai-tools/`

- `SESSION_STATE.md` — поточна версія, гілка, журнал сесій (бриф), "найважливіше для нового чату"
- `SKILLS_PLAN.md` — список скілів з тригер-правилами
- `INDEX.md` *(цей файл)* — семантичний індекс
- `REFACTOR_PLAN.md` — план рефакторингу документації (g05tu)
- `REFACTORING_PLAN.md` + `REFACTORING_FINANCE.md` — історичні плани (ES-modules + finance.js)

### `src/`

- `app.js` — точка входу (порядок імпортів критичний)
- `core/` — nav, boot, trash, utils (`extractJsonBlocks`, `parseContentChips`), logger, diagnostics
- `ai/` — core (`getAIContext`, `_fetchAI`), prompts (OWL personality, INBOX_TOOLS), memory (`nm_facts`), ui-tools (8 UI tools)
- `owl/` — inbox-board (OWL Board Inbox), board (Tab Boards), proactive, followups (Live Chat Replies), chips
- `ui/` — keyboard (iOS), swipe-delete (`attachSwipeDelete` базова), voice-input (Web Speech), unread-badge
- `tabs/` — 8 вкладок + підмодулі: inbox, tasks, habits, notes, finance (6 модулів), health, projects, calendar, evening (4 модулі), me, onboarding

### `_archive/`

- `FEATURES_ROADMAP.md` — повна історична версія плану (обговорення Grok/Gemini/DeepSeek)
- `SESSION_STATE_archive.md` — детальні описи старих сесій (до 6GoDe)
- `BUGS_HISTORY.md` — закриті баги зі старих сесій

### `.claude/`

- `commands/` — всі скіли (`/ux-ui`, `/prompt-engineer`, `/pwa-ios-fix`, `/refactor-large`, `/supabase-prep`, `/audit`, `/fix`, `/new-file`, `/start`, `/finish`, `/deploy`, `/mockup`, `/gemini`, `/a11y-enforcer`, `/gamification-engine`)
- `hooks/` — автоматичні нагадування:
  - `rules-reminder.sh` — нагадує правила CLAUDE.md тільки на сигнали болю Романа («простіше / коротше / не розумію»). Спрощено 6ANWm 01.05 — раніше було ще «кожне 5-те повідомлення» (це створювало шум коли все нормально).
  - `context-warning.sh` — попередження при 80/90% контексту
  - `cache-name-reminder.sh` — CACHE_NAME bump при зміні src/*
  - `md-index-reminder.sh` — додати новий .md у INDEX
  - `ai-tools-sync.sh` — оновити AI_TOOLS.md при зміні промптів
  - `skill-triggers.sh` — детектор ключових слів скілів + "Роби"
  - `pre-push-check.js` — pre-push guard (блокує без CACHE bump при правці src/, ламається i18n білд)
  - `pre-commit-testing-log.js` — блокує `feat:` коміти що чіпають src/ без `TESTING_LOG.md` у staged
  - `check-estimate-without-read.js` — попереджає коли я даю оцінку часу/складності без Read коду
  - `lesson-reminder.sh` — показує `lessons.md` пункти при відкритті файлу що згадується в уроках
  - `i18n-reminder.sh` — PostToolUse hook: показує необгорнуті рядки у файлі який щойно правив
  - `start-self-test.sh` — на `/start` показує 3 питання про найболючіші правила (свої слова, не цитати)
- `settings.json` — конфіг хуків + permissions (deny git reset --hard, push --force, rm -rf)

---

## 🔍 Як використовувати INDEX (для Claude)

1. **Роман питає про X** → дивлюсь у "За темами" секцію → знаходжу файл+секцію.
2. **Читаю потрібну секцію** через `Read(file_path, offset=N, limit=50)` — не весь файл.
3. **Якщо питання нове** → шукаю суміжну тему ("колір модалки" = `DESIGN_SYSTEM.md`).
4. **Якщо не знайшов** → тільки тоді повне читання файлу через Read без offset.

**Приклад економії:**
- Було: Роман питає про свайп закриття модалки → читаю весь `CLAUDE.md` (118 рядків — 94 з 6ANWm 01.05 + 24 секція Council у bOqdI 02.05) + `docs/DESIGN_SYSTEM.md` (930 рядків) = 1048.
- З INDEX: "свайп" → `src/ui/swipe-delete.js` + `docs/DO_NOT_TOUCH.md` → читаю два файли по 50 рядків = 100.

**Економія 88%.**

---

_Останнє оновлення: 2026-04-20 (створено g05tu, Фаза 4). При додаванні нового .md файлу — `md-index-reminder.sh` нагадує оновити цей індекс._
