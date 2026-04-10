# Стан сесії

**Оновлено:** 2026-04-10 (кінець сесії start-session-HdqBj)

---

## Проект

| | |
|--|--|
| **Версія** | v113+ (деплої через auto-merge) |
| **URL** | owls68.github.io/NeverMind |
| **AI модель** | OpenAI GPT-4o-mini з **Tool Calling** (function calling) — SINCE 10.04 |
| **Гілка** | `claude/start-session-HdqBj` |
| **Repo** | **Public** + LICENSE (All Rights Reserved) |

---

## ⚠️ ДЛЯ НОВОГО ЧАТУ — найважливіше

**1. ПРАВИЛО №1:** завжди пояснювати в дужках ВСЕ не-українською — англіцизми, сленг, назви функцій, технічні терміни. Роман вчиться через пояснення. Деталі → `CLAUDE.md` верхня секція "ОБОВ'ЯЗКОВО В КОЖНОМУ ПОВІДОМЛЕННІ".

**2. Без "Роби" від Романа — НЕ змінювати код.** Роман каже "Роби" — і тільки тоді.

**3. Архітектурний принцип: ОДИН МОЗОК НА ВСЕ.** OWL = єдиний Jarvis. Табло, чати, чіпи — різні вікна одного мозку. **Зміна в одній вкладці = зміна в усіх.** Повний план → `FEATURES_ROADMAP.md` секція "🧠 Мозок OWL".

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

### Живі відповіді Фаза 2 — агент пише в чат сам (ПРІОРИТЕТ)
Агент ініціює повідомлення в чат (не табло):
- Подія пройшла → "Як пройшла консультація?"
- Задача висить 3+ дні → "Що з переїздом?"
- Юзер повернувся після паузи → follow-up
- Після дії → контекстне питання
- Обмеження: max 1/год, cooldown на тип тригера, `nm_owl_followups`

### Jarvis Architecture — ДО Supabase
1. ~~**4.1 Tool Calling**~~ → ✅ ЗРОБЛЕНО 10.04 (25 tools, prompt скорочений у 6-7 разів, 6 багів виправлено аудитом)
2. **4.2 Day State + Nightly Brain Dump** — нічна компресія дня в 3 пункти (1 сесія)
3. **4.3 Семантичні cooldowns** — topic-based антиповтор замість лексичного (1 сесія)
4. **G3 Характери → Judge Layer поріг** — різна поведінка coach/partner/mentor (0.5 сесії)
5. **G1 Тиша = модифікатор** — фікс: тиша без контенту = 0 балів
6. **G2 Burst cooldown** — антиспам при серії задач/звичок
7. **4.20 Negative Memory** — пам'ять що дратує
8. ~~**Мерж розпорядок + календар**~~ → ЗРОБЛЕНО (модалка дня з об'єднаним таймлайном)
9. **G4 Shadowing** — конфлікти розкладу: календар > розпорядок
10. ~~**G5 All-day events**~~ → ЗРОБЛЕНО (зверху таймлайну)
11. **G6 Дедуплікація нагадувань** — linked_event_id

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
