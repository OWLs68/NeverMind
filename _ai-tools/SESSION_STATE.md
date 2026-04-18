# Стан сесії

> **Правило ротації:** у файлі детально описані **2 останні активні сесії**.
> При виклику `/finish` у новій сесії — найстарша з 2 переноситься у [`_archive/SESSION_STATE_archive.md`](../_archive/SESSION_STATE_archive.md).
> Попередні сесії до Vydqm — в архіві (Vydqm, FMykK, 14zLe, KTQZA, gHCOh, cnTkD, hHIlZ, W6MDn, VAP6z, acZEu, E5O3I, 3229b, 6v2eR, jMR6m).

**Оновлено:** 2026-04-18 (сесія **VJF2M** — голосовий ввід + 4.17 UI Tools Suite + AI_TOOLS.md)

---

## ⚠️ ДЛЯ НОВОГО ЧАТУ — найважливіше

**1. AGENT ТЕПЕР КЕРУЄ UI (4.17)** — агент виконує hands-free навігацію/фільтри/налаштування. 8 UI tools готових у `src/ai/ui-tools.js`: `switch_tab`, `open_memory`, `open_settings`, `set_finance_period`, `open_finance_analytics`, `set_theme`, `set_owl_mode`, `export_health_card`. Повний довідник + 6 заблокованих → `docs/AI_TOOLS.md`. Якщо додаєш/міняєш tool — ЗАВЖДИ оновлюй `docs/AI_TOOLS.md` (правило в CLAUDE.md секція "Писати коли").

**2. ГОЛОСОВИЙ ВВІД (Web Speech API) у всіх 8 чат-барах** — `src/ui/voice-input.js`. `lang='uk-UA'`. Кнопка 🎤 поруч з send-btn. Червоне пульсування під час запису. Натискання send-btn під час запису → stop + автовідправка через `pendingSendClick` flag у `onend`.

**3. Перед новим імпортом — ЗАВЖДИ перевір що функція має `export`**, не тільки `Object.assign(window, ...)`. У цій сесії падав деплой v247 бо `openMemoryModal` живе тільки у window, без `export`. Фікс — виклик через `window.fn()`.

**4. `switchTab()` знає ТІЛЬКИ реальні вкладки (inbox/tasks/notes/finance/me/evening/health/projects).** `calendar` і `habits` — НЕ вкладки. Календар = `openCalendarModal()` (модалка), habits = частина вкладки Продуктивність (`switchTab('tasks')`). Якщо будеш додавати нові target у switch_tab — перевір наявність `page-{target}` у index.html.

**5. Файли >250 рядків створюй через skeleton+Edit.** Checkpoint-коміт після КОЖНОЇ логічної підзадачі.

**6. Workflow Романа:** "Роби" → один таск → звіт → пропозиція наступного → чекати підтвердження. Не пакетити кілька задач без підтвердження.

**7. Ти САМ викликаєш скіли за тригер-фразами.** Тригери у `_ai-tools/SKILLS_PLAN.md`.

---

## 🔧 Сесія VJF2M — Голосовий ввід + 4.17 UI Tools Suite + AI_TOOLS.md (18.04.2026)

### Зроблено

**1. Голосовий ввід у всіх 8 чат-барах (`src/ui/voice-input.js`, 137 рядків) — коміт `76fe682`**
- Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`), `lang='uk-UA'`.
- Автоматично додає кнопку 🎤 у кожен `.ai-bar-input-box` при DOMContentLoaded.
- Inbox: активує існуючу `disabled` кнопку. Решта 7: створює нову перед send-btn.
- Interim results → live-оновлення textarea під час запису. Пауза → автостоп (`onend`).
- Червоне пульсування (`.voice-btn.recording` + `@keyframes voice-pulse`).
- Fallback: якщо браузер без підтримки — кнопка не з'являється.

**2. Довідник `docs/AI_TOOLS.md` — коміт `313279c`**
- Єдине місце правди для 47 tools (39 існуючих INBOX_TOOLS + 8 нових UI).
- Категорії: CREATE/COMPLETE/EDIT/DELETE/ІНШЕ/ЗДОРОВ'Я/ПАМ'ЯТЬ/КАТ.ФІНАНСІВ. UI: A/C/D/E.
- Посилання додані у CLAUDE.md (Карта документації + Писати коли), START_HERE.md, `.claude/commands/prompt-engineer.md`.
- Бонус: виправлено rot у `/prompt-engineer` — `src/ai/core.js` → `src/ai/prompts.js` (після винесення промптів 17.04 14zLe).

**3. 4.17 UI Tools Suite — 8 tools (`src/ai/ui-tools.js`, 210 рядків) — коміт `6f128b1`**
- `switch_tab`, `open_memory`, `open_settings`, `set_finance_period`, `open_finance_analytics`, `set_theme`, `set_owl_mode`, `export_health_card`.
- Dispatcher `handleUITool(name, args)` повертає `{text}` для чат-відповіді.
- Імпорт `UI_TOOLS` у `prompts.js` → spread у `INBOX_TOOLS` (єдиний список для AI).
- Нова секція "UI TOOLS" в `INBOX_SYSTEM_PROMPT` з принципом мінімального тертя.
- У `inbox.js` dispatch: `UI_TOOL_NAMES.has(...)` check ДО `_toolCallToAction` → `handleUITool` → `addInboxChatMsg`.
- 6 заблоковано (open_record, open_trash, calendar_jump_to, filter_tasks, clear_chat, toggle_owl_board) — винесено у ROADMAP 4.17.B.

**4. 3 фікси після тесту на живому пристрої:**
- **`b0c41a5`:** зламаний імпорт `openMemoryModal` (є тільки у window). Фікс — виклик через `window.openMemoryModal()`. Причина провалу деплою v247.
- **`ca5981d`:** `switchTab('calendar')` падав бо немає `page-calendar`. Календар — модалка. Додано aliases: `calendar` → `openCalendarModal()`, `habits` → `switchTab('tasks')`.
- **`fcb9306`:** натиск send-btn під час запису → `pendingSendClick=true` + `stopRecording()` → у `onend` через 60мс програмний `sendBtn.click()`. Перехоплення у capture phase з `preventDefault` + `stopImmediate`.
- **`31eeeb8`:** прибрано toast підтвердження UI tools (Роман: "бабл що знизу появляється і зникає"). У чаті Inbox reply лишається.

### Обговорено (без виконання)
- Розширений список UI tools — 14 варіантів (A/B/C/D/E). Роман відкинув Блок B (відкриття порожніх форм створення) через принцип мінімального тертя.
- 6 заблокованих tools — потребують нової інфраструктури (search API, UI модалка кошика, per-chat storage, toggle state), винесено у 4.17.B як окремі підзадачі.
- Структура документа `docs/AI_TOOLS.md` — узгоджено з Романом: робимо єдиний довідник 47 tools з категоризацією + промпт-правилами + зв'язками.

### Ключові рішення
- **4.17 vs 4.15 `switch_tab`:** 4.17 консолідує 4.15 (пункт 4.15 залишений як історична довідка).
- **UI tools НЕ відкривають порожні форми** — принцип мінімального тертя. Агент використовує CRUD tools напряму.
- **Довідник tools окремо від промптів** — `docs/AI_TOOLS.md` описовий (для людей + Claude при читанні), `src/ai/prompts.js` + `src/ai/ui-tools.js` виконавчі.

### Інциденти
- **Деплой v247 провалився** — зламаний імпорт, локального `node build.js` не запускав. Після виправлення (`b0c41a5`) — OK.
- **2 спроби тестування на пристрої** з помилками: "не можу відкрити календар" (AI не бачив tools через старий кеш) і "Не вдалось виконати: switch_tab" (TypeError з `page-calendar`). Обидві виправлено.
- **Без git reset / force push.** Всі 8 комітів — normal.

### Метрики
- **Коміти:** `3ec8bb5` (roadmap) → `76fe682` (voice) → `313279c` (AI_TOOLS.md) → `6f128b1` (UI tools) → `b0c41a5` (fix import) → `ca5981d` (fix switch_tab) → `fcb9306` (voice+send) → `31eeeb8` (remove toast). **8 комітів.**
- **Гілка:** `claude/start-session-VJF2M`
- **Версії:** v243 (перед) → v250+ (після)
- **CACHE_NAME:** `nm-20260418-1508` (останнє оновлення у toast-fix)
- **Build:** чистий після фіксів (локальний `node build.js` зелений)
- **Нові файли:** `src/ui/voice-input.js`, `src/ai/ui-tools.js`, `docs/AI_TOOLS.md`

---

## 🔧 Сесія Vydqm — Хук контексту + фікси звичок і свайпу (18.04.2026)

### Зроблено

**1. Новий хук `.claude/hooks/context-warning.sh` (52 рядки, коміт `07d5136`)**
- `UserPromptSubmit` хук — читає `transcript_path` з JSON input, рахує приблизний розмір у токенах (`байти/3`).
- Два пороги: 800K (⚠️ ~80%) і 900K (🚨 ~90%, час на `/finish`).
- Нижче 800K — тихий вихід (мовчить). Вище — показує попередження перед твоїм повідомленням.
- Зареєстрований у `.claude/settings.json` поруч з `rules-reminder.sh`.
- Параметр `BYTES_PER_TOKEN=3` всередині скрипта — калібрується порівнянням з реальним `/context`.
- **Протестовано у живій сесії:** хук спрацював на ~800K токенах — коректно попередив перед auto-compaction.

**2. Фікс звичок `src/tabs/habits.js` (коміт `88f4348`)**
- **Баг:** у ряду днів тижня (П В С Ч П С Н) стан "жовта галочка" (подвійне виконання, cur > target) показувався як звичайна зелена — `getHabitWeekDays` робив truthy check.
- **Фікс:** `getHabitWeekDays(id, target)` повертає `{i, bonus}` замість просто `[i]`. `makeHabitDayDots` для bonus використовує градієнт `#fbbf24→#f59e0b` (той самий що на великій кнопці).
- Семантика жовтої галочки: "виконав двічі за день" (бонус). `_habitDone (cur >= target)` вже коректно рахував обидва стани — стрік і % не чіпав.

**3. Фікс базової логіки свайп-видалення `src/ui/swipe-delete.js` (коміт `265a23c`)**
- **Баг 1:** відстань свайпу різна — Фінанси 50% (SWIPE_OPEN_RATIO=0.5), решта 22% (default). Роман хотів як у Фінансах всюди.
- **Фікс 1:** `openRatio` default змінено 0.22→0.5. Тепер Inbox/Tasks/Notes/Habits теж їдуть на півширини.
- **Баг 2:** анімація закриття — червоний bin різко зникав в DOM через `setTimeout(280)` після руху картки. Видно вузьку червону смужку яка не тане.
- **Фікс 2:** `closeSwipe` ставить `bin.style.opacity=0` з transition 0.25s — синхронно з рухом картки.

**4. `/finish` виконано двічі у сесії (CREATE + UPDATE)**
- CREATE (перший): ротація 14zLe→архів, KTQZA закриті→архів, запис у CHANGES.
- UPDATE (цей): дописано фікси #2 і #3.

### Обговорено (без виконання)

- **Prompt cache TTL у Claude Code:** не налаштовується user-side. Стандарт 5 хв hardcoded, 1-год кеш тільки через API напряму (~2x дорожче). Висновок: не робити довгих пауз щоб не платити за перерахунок.
- **Opus 4.7 vs 4.6 context window:** 4.7 має БІЛЬШИЙ контекст (1M vs 200K стандартно у 4.6). Публічна плутанина "4.7 тримає 5 хв" описує TTL кешу, не "пам'ять моделі".
- **Команда `/context`** — показує точне використання вікна з розбивкою (system/tools/project/messages/free).
- **iOS застосунок vs комп для хуків:** не має значення. Claude Code крутиться у контейнері на серверах Anthropic, хуки з `.claude/` — працюють незалежно від клієнта.
- **Чи скіл `/finish` робить зайве:** Роман помітив 4 пункти overhead. Після аналізу: 2 з 4 — підстраховка від stream timeout (правильно), 2 — чиста неефективність. Реальний overhead ~5-10%. Роман вирішив нічого не міняти.
- **B-80 (новий відкритий баг):** тимчасовий layout glitch при видаленні папки у Нотатках через свайп. Чіпи під OWL-баблом на частку секунди перекриваються папкою, потім само-виправляється. Гіпотеза: layout race між анімацією закриття свайпу + renderNotes. Косметика, не ламає функціонал. Вирішено не фіксити, записати у BUGS як 🟢.
- **Перевірка множинних дій у чат-барах:** `extractJsonBlocks` підключено у всіх 6 чатах (tasks/habits/evening/health/projects/finance) — код готовий, Роман має перевірити на телефоні конкретними промптами.

### Ключові рішення

- **Поріг попередження хука 800K (80%)** — запас ~20 повідомлень до auto-compaction.
- **Апроксимація через байти transcript** — компроміс bash і точності, калібрується через `/context`.
- **Жовта галочка семантично = бонус** (не "скасовано") — у ряду днів тижня має показуватись ідентично лівій великій кнопці (жовтий градієнт).
- **Свайп-відстань 0.5 всюди** — Роман обрав як у Фінансах (не навпаки). Кошик зроблений великим і помітним.
- **B-80 не фіксити зараз** — косметичний, розслідувати треба на пристрої, ціна дії важча за проблему.
- **`/finish` не міняти** — 5-10% overhead, і він виправданий захистом від stream idle timeout.

### Інциденти

Без інцидентів. 5 чистих комітів. Без reset/force push. Без падінь CI.

### Метрики

- **Коміти:** `07d5136` → `265a23c` (5 feature+fix + docs через /finish).
- **Гілка:** `claude/start-session-Vydqm`
- **Версія:** v238 перед сесією; після `88f4348` і `265a23c` буде деплой (v239+/v240+).
- **CACHE_NAME:** `nm-20260418-1128` (останнє оновлення у фіксі свайпу).
- **Build:** node --check пройшов (esbuild не доступний локально, CI збере).

---


## Проект

| | |
|--|--|
| **Версія** | v250+ (після 8 комітів VJF2M — голос + UI tools + фікси) |
| **URL** | owls68.github.io/NeverMind |
| **AI модель** | OpenAI GPT-4o-mini з Tool Calling (**47 tools:** 31 INBOX + 8 UI + 8 health/memory/cat) |
| **Гілка** | `claude/start-session-VJF2M` |
| **CACHE_NAME** | `nm-20260418-1508` (з toast-fix) |
| **Repo** | Public + LICENSE (All Rights Reserved) |

---

## 🗺️ Куди йде проект

**Дорожня карта — єдине місце:** [`ROADMAP.md`](../ROADMAP.md).

**Поточний Active:** Блок 2 — Концепції вкладок. Все з 🚀 Active попередніх сесій закрито.

---

## 🎯 НАСТУПНИЙ КРОК — ВАРІАНТИ

**A. 🌙 Вечір — доробка** (70→100%, 1-2 сесії) — **РЕКОМЕНДУЮ**
- Кільце продуктивності дня, підсумок OWL після 18:00, настрій-емодзі, моменти дня
- Один файл (`evening.js`), видима цінність, легкий

**B. 📁 Проекти — доробка** (65→100%, 2 сесії)
- Глибоке інтерв'ю 4 питання, стагнація-детекція, синк Витрати→Фінанси
- Поле `status` відсутнє у коді (треба додати)

**C. 👤 Я — доробка** (65→100%, 1-2 сесії)
- Теплова карта 14/30 днів, автопатерни раз на тиждень, огляд тижня

**D. 🏥 Здоров'я Фаза 2+3** (55→80%, 1-2 сесії)
- Фаза 2: CRUD карток через Inbox + чат-бари
- Фаза 3: переробка UI (прибрати legacy шкали)

**E. 🚧 4.17.B — 6 заблокованих UI tools** (2-3 сесії)
- `open_record` (search+highlight API), `open_trash` (UI модалка кошика)
- `calendar_jump_to` (навігація стану), `filter_tasks` (фільтр у Tasks)
- `clear_chat` (per-chat), `toggle_owl_board` (toggle state)

**F. 4.11 `getAIContext` повне покриття** (1 сесія)
- Перевірити чи OWL бачить ВСІ типи даних (проекти, моменти, події, здоров'я)
- Блокуючий пункт для якісніших tool calls

---

## Відомі технічні проблеми (не вирішені)

1. **B-65** SW load failed — одноразова помилка, не відтворюється. Низький пріоритет.
2. **Tool calling тільки в Inbox** — решта чат-барів на JSON-форматі (але множинні JSON працюють через `extractJsonBlocks`)
3. **`src/core/nav.js` = 1236 рядків** — трохи більше 1200 порогу. Кандидат на розбиття (settings/theme/profile/storage)
4. **Monobank** — відкладено до Supabase
5. **~150 рядків закоментованого коду** по проекту — колись прибрати

---

## 📦 Попередні сесії

Детальні описи FMykK, 14zLe, KTQZA, gHCOh, cnTkD, hHIlZ, W6MDn, VAP6z, acZEu, E5O3I, 3229b, 6v2eR, jMR6m → [`_archive/SESSION_STATE_archive.md`](../_archive/SESSION_STATE_archive.md).
