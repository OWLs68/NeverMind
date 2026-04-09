# Стан сесії

**Оновлено:** 2026-04-09 (кінець сесії start-session-0xaJ3)

---

## Проект

| | |
|--|--|
| **Версія** | v71+ (деплої через auto-merge) |
| **URL** | owls68.github.io/NeverMind |
| **AI модель** | OpenAI GPT-4o-mini (ключ у `localStorage`, назва `nm_gemini_key` — legacy) |
| **Гілка** | `claude/start-session-0xaJ3` |
| **Repo** | **Public** + LICENSE (All Rights Reserved) |

---

## ⚠️ ДЛЯ НОВОГО ЧАТУ — найважливіше

**1. ПРАВИЛО №1:** завжди пояснювати в дужках ВСЕ не-українською — англіцизми, сленг, назви функцій, технічні терміни. Роман вчиться через пояснення. Деталі → `CLAUDE.md` верхня секція "ОБОВ'ЯЗКОВО В КОЖНОМУ ПОВІДОМЛЕННІ".

**2. Без "Роби" від Романа — НЕ змінювати код.** Роман каже "Роби" — і тільки тоді.

**3. Архітектурний принцип: ОДИН МОЗОК НА ВСЕ.** OWL = єдиний Jarvis. Табло, чати, чіпи — різні вікна одного мозку. **Зміна в одній вкладці = зміна в усіх.** Повний план → `FEATURES_ROADMAP.md` секція "🧠 Мозок OWL".

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
1. **4.1 Tool Calling** — перевести API на function calling (2 сесії, найбільший ефект)
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

## Ключові файли (оновлено 09.04)

| Файл | Опис |
|------|------|
| `src/tabs/calendar.js` | nm_events, Calendar modal, **Day schedule modal (об'єднаний таймлайн)**, Events list, "Найближче", Routine modal, **Drum picker (барабан дати/часу)**, Event-edit modal, zoom-анімації, навігаційний стек, **SVG іконка з динамічною датою** |
| `src/owl/proactive.js` | Єдина генерація табло, instant reactions, first-visit hints, **_extractBannedWords антиповтор** (isTooSimilar видалено), local fallback з характером + правильна граматика, API error dot |
| `src/owl/inbox-board.js` | OWL Board: **shouldOwlSpeak() Judge Layer**, getOwlBoardContext, анкетування, вечірній пульс, нагадування (перевірка кожну хв), safety net, chat-closed тригер |
| `src/owl/chips.js` | Центральний модуль чіпів — рендер, клік, fuzzy match ✔️, трекінг, chip context для AI |
| `src/ai/core.js` | getAIContext, callAI, OWL особистість, **"НАГАДАЙ = set_reminder" правило**, правило ЗМІНИТИ=edit |
| `src/tabs/inbox.js` | sendToAI, processSaveAction, save_routine, chip board context, _detectEventFromTask, **min 0.8s typing**, **split reply для create_project** |
| `src/tabs/tasks.js` | Задачі + task chat, **setupModalSwipeClose з drum-col guard** |
| `src/tabs/habits.js` | Звички + processUniversalAction (edit_event, delete_event, edit_note, set_reminder, save_routine), **_splitReply helper**, saveQuitLog з dispatch |
| `src/core/nav.js` | TAB_THEMES, doRefreshMemory |

---

## Попередні сесії

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
