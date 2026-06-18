# NeverMind — Файлова структура

> Детальна таблиця файлів з відповідальністю. Перенесено з `CLAUDE.md` 20.04.2026 у рамках рефакторингу документації (сесія g05tu).
>
> Коротка версія файлової структури + порядок імпортів → `START_HERE.md`.

---

## Кореневі файли

| Файл | Відповідальність |
|------|-----------------|
| `index.html` | Весь UI (~1475 рядків). Один `<script src="bundle.js">` |
| `style.css` | Всі стилі (~1130 рядків). Винесено з index.html |
| `sw.js` | Service Worker. **CACHE_NAME треба міняти при кожному деплої** |
| `bundle.js` | Згенерований esbuild з `src/`. **Не комітити** — генерується CI |
| `build.js` | Конфіг esbuild (10 рядків) |
| `package.json` | Залежності: esbuild + @playwright/test (devDep, для E2E) |
| `playwright.config.js` | Конфіг E2E (foyz2r 16.06). Проекти Mobile Safari (WebKit) + Desktop Chrome, `toHaveScreenshot` anti-flaky, webServer python http.server |

---

## Тести (E2E — Playwright у CI, foyz2r 16.06.2026)

Запуск автоматично на кожен push через `.github/workflows/e2e.yml` (безкоштовно). Замінив Hetzner-тестер (→ `_archive/hetzner-tester/`).

| Файл | Відповідальність |
|------|------------------|
| `tests/e2e/helpers.js` | Фундамент: `boot()` (глушить OpenAI=$0, чекає `NM_BOOT_DONE`, гасить онбординг/слайд-тур), `seedState()` (підставляє localStorage через addInitScript + прапор `__NM_TEST_SEED__` під Supabase), `mockAI()` (route-intercept), `gotoTab()` (через `switchTab`) |
| `tests/e2e/smoke.spec.js` | boot + навігація 8 вкладок без падінь |
| `tests/e2e/tasks.spec.js` | додавання задачі + persistence після reload + модалка |
| `tests/e2e/modals.spec.js` | Налаштування + Календар відкр/закр |

---

## `src/` — вихідний код

| Файл | Відповідальність |
|------|-----------------|
| `src/app.js` | Точка входу — імпортує всі модулі |
| `src/core/nav.js` | Глобальний стан (`currentTab`), switchTab, теми, налаштування, пам'ять |
| `src/core/boot.js` | bootApp, PWA setup, cross-tab sync, NM_KEYS, init |
| `src/core/trash.js` | Кошик (7 днів TTL), showUndoToast, undoDelete |
| `src/core/utils.js` | autoResizeTextarea, formatTime, escapeHtml (safe для undefined з B-70; екранує й лапки з vdlyeg), `safeHref` (блокує javascript:-схеми), `extractJsonBlocks`, `parseContentChips`, `escapeJsArg` |
| `src/core/settings.js` | **Канонічний доступ до nm_settings** (7uxlr7 12.06, Supabase Ворота 1). `getSettings()` + `updateSettings(patch)` (shallow-merge). Доменний аксесор для ОДНОГО ключа (як saveTasks для nm_tasks) — НЕ generic db.js. 10 прямих `nm_settings` записів переведено через нього. До Supabase → рядок таблиці user_settings. |
| `src/core/entity.js` | **Конверт сутності stampEntity** (7uxlr7, Supabase Ворота 3, Фундамент §1). ЧИСТА функція-фабрика (не сховище): `stampEntity(rec)` додає `{id-uuid, user_id, created_at, updated_at, deleted_at, hlc}` — однакова форма для всіх майбутніх Supabase-таблиць. `nowISO()`. Застосовується у фабриках `entity-factories.js` + `makeHabit`. |
| `src/core/logger.js` | Error logging, console override, UI панель логу, ring buffer юзер-дій (trackUserAction), автолистенер nm-data-changed, stack trace у записах |
| `src/core/diagnostics.js` | **Діагностична система (B-67 acZEu):** Health Check (9 перевірок стану систем), Smoke Tests (9 авто-тестів), Performance monitor (startup/longtask/fetch monkey-patch). Рендерить 3 блоки у панелі логу. Експорти: runHealthCheck, runSmokeTests, getPerformanceData |
| `src/core/usage-meter.js` | **V3 Фаза 0 (ywA44 28.04):** лічильник витрат OpenAI. PRICING table, `logUsage(module, usageObj)` записує у `nm_usage_log`, `getUsageStats()` агрегує today/thisMonth/projection/byModule, `exportUsageJSON()` копіює у буфер обміну, `renderUsageMeter()` малює блок у Налаштуваннях. Ротація 31 день. Hook у 12 fetch-сайтах (центральний `_fetchAI` + 11 прямих) |
| `src/core/delegation.js` | **Event Delegation registry (DGH6F 16.05 + JMQuT 17.05)** — один listener на `document.body` через `closest('[data-action]')` + handler з registry. Експорт: `reg(name, fn)`, `initDelegation()`. **49 actions** після Phase 1а-1д (DGH6F) + Phase 1+ JMQuT (notes/nav/habits/health). Підготовка до strict CSP `script-src 'self'` без `unsafe-inline`. UUID-immune через `el.dataset.id` (string, не eval) — B-108/B-170 клас неможливий. ⚠️ `data-*` атрибути потребують `escapeHtml()` (НЕ `escapeJsArg`) — JMQuT Pre-mortem знахідка (див. lessons.md). |

### AI модулі

| Файл | Відповідальність |
|------|-----------------|
| `src/ai/core.js` | **AI-логіка (~623 рядки після рефакторингу 17.04 14zLe):** getAIContext(), callAI(), chat storage (6 незалежних чатів), _fetchAI(), HTTP-wrappers (callAIWithHistory, callAIWithTools, callOwlChat), open/closeChatBar. Re-exports з `prompts.js` для backward-compat |
| `src/ai/prompts.js` | **Промпти OWL (17.04 14zLe):** `getOWLPersonality()` (3 характери coach/partner/mentor + universal правила), `INBOX_SYSTEM_PROMPT` (класифікатор Inbox), `INBOX_TOOLS` (31 function definition), `getOwlChatSystemPrompt(context)` для callOwlChat. **Коли OWL "не так відповідає" — правити ТУТ**, не в core.js. Передумова для майбутніх характерів (Badg/Rabi) |
| `src/ai/memory.js` | **Структурована пам'ять фактів** — `nm_facts` з часовими мітками (11.04). CRUD, дедуплікація, TTL, категорії (preferences/health/work/relationships/context/goals), formatFactsForContext/Board, міграція legacy nm_memory |
| `src/ai/ui-tools.js` | **UI Tools (4.17, 18.04 VJF2M; розширено xHQfi 30.04 cancel_quiet):** 10 hands-free навігаційних tools: `switch_tab`, `open_memory`, `open_settings`, `set_finance_period`, `open_finance_analytics`, `set_theme`, `set_owl_mode`, `export_health_card`, `request_quiet`, `cancel_quiet`. Масив `UI_TOOLS` + `UI_TOOL_NAMES` (Set) + `handleUITool(name, args)` dispatcher. Імпортується у `prompts.js` (spread у INBOX_TOOLS) і `inbox.js` (dispatch). Повний довідник → `docs/AI_TOOLS.md`. |
| `src/ai/profile-builder.js` | **Lazy Profile Builder (Фаза 6 OWL Reasoning V3, xHQfi 30.04):** ~150 рядків. Фоновий збір 5-7 довгострокових тенденцій раз на 24 год через `requestIdleCallback`. localStorage: `nm_user_patterns`, `nm_user_patterns_ts`. Інжект `[ДОВГОСТРОКОВІ ПАТЕРНИ]` у `getAIContext()`. До Supabase клієнтсько → пізніше Edge Function cron (Фаза 7). |

### OWL модулі

| Файл | Відповідальність |
|------|-----------------|
| `src/owl/inbox-board.js` | OWL Board Inbox (проактивні повідомлення), ChatBar swipe AB-стан |
| `src/owl/board.js` | OWL Tab Boards (рендер + свайпи для ВСІХ вкладок включно з inbox) |
| `src/owl/proactive.js` | Генерація проактивних повідомлень, getTabBoardContext |
| `src/owl/followups.js` | **Live Chat Replies** — follow-up повідомлення агента у контекстний чат (stuck-task, event-passed), 5 хв таймер + nm-data-changed |
| `src/owl/chips.js` | **Центральний модуль чіпів** — renderChips(), handleChipClick(), fuzzy match ✔️, CHIP_PROMPT_RULES |

### UI модулі

| Файл | Відповідальність |
|------|-----------------|
| `src/ui/keyboard.js` | setupKeyboardAvoiding (iOS-specific) |
| `src/ui/swipe-delete.js` | **Базова логіка свайп-видалення** (як glass-стиль модалок): `attachSwipeDelete(wrapEl, cardEl, onDelete, opts)` — свайп вліво → кнопка-кошик справа → тап=видалення. Використовується у Inbox/Tasks/Notes/Habits/Finance. |
| `src/ui/voice-input.js` | **Голосовий ввід у всіх 8 чат-барах (18.04 VJF2M)** — Web Speech API з `lang='uk-UA'`. Автоматично додає кнопку 🎤 перед send-btn у кожному `.ai-bar-input-box` при DOMContentLoaded. Interim results → live-текст у textarea. Натискання send-btn під час запису → автостоп + програмна відправка через `pendingSendClick` + `onend` delay 60мс. Fallback: якщо `SpeechRecognition` недоступний — кнопка не з'являється. |
| `src/ui/unread-badge.js` | **Універсальний бейдж непрочитаних** (QV1n2 19.04). Червона крапка з лічильником, винесено з inbox.js на Фазі 0 рефакторингу Вечора 2.0. Використовується у Inbox, Вечорі, готово до решти чатів. |

### Tabs

| Файл | Відповідальність |
|------|-----------------|
| `src/tabs/inbox.js` | sendToAI(), processSaveAction(), renderInbox(), swipe delete |
| `src/tabs/tasks.js` | Задачі (CRUD), кроки задач, task chat, setupModalSwipeClose (з drum-col guard) |
| `src/tabs/habits.js` | Звички + quit-звички, лог виконання, стріки, processUniversalAction (_splitReply) |
| `src/tabs/notes.js` | Нотатки, папки, note view з чатом, пошук |
| `src/tabs/finance.js` | Фінанси — ядро (~700 рядків після рефакторингу 17.04 gHCOh): renderFinance, state, getFinanceContext, processFinanceAction, getFinEditMode/setFinEditMode. Re-exports з 5 модулів для backward compat |
| `src/tabs/finance-cats.js` | Категорії Фінансів — CRUD, 41 SVG-іконка, палітра 14 кольорів, міграція v2, mergeFinCategories, moveFinCategory |
| `src/tabs/finance-modals.js` | Модалки Фінансів — транзакція з калькулятором, datepicker, бюджет, категорія (icon/color picker, subcategories) |
| `src/tabs/finance-analytics.js` | Аналітика 📊 — 3 режими графіка (Капітал/Витрати/Доходи), 9 метрик у 3 міні-блоках, 50/30/20 benchmark з кастомними % |
| `src/tabs/finance-insight.js` | Інсайт дня (AI) — кеш 1год + hash-інвалідація, жорсткі правила точності чисел, temperature 0.3 |
| `src/tabs/finance-chat.js` | Chat bar Фінансів — AI-бот для фінансових команд (save_expense/income/delete/update/budget/category) |
| `src/tabs/health.js` | Карточки здоров'я, денні шкали (енергія/сон/біль) |
| `src/tabs/projects.js` | Проекти, воркспейс, кроки, метрики, темп |
| `src/tabs/calendar.js` | Календар, події (nm_events), блок "Найближче", Calendar/Routine/Day-schedule модалки, Event-edit modal з drum picker, zoom-анімації, навігаційний стек, SVG іконка з динамічною датою |
| `src/tabs/evening.js` | Вечір 2.0 — core рендер вкладки (~413 рядків після Фази 0 рефакторингу QV1n2 19.04). Матове скло до 18:00, контент ритуалу, дві CTA кнопки |
| `src/tabs/evening-chat.js` | Чат-бар Вечора + фуллскрін діалог (204 рядки) — винесено у Фазі 0 |
| `src/tabs/evening-actions.js` | Заготовка для Фази 7 tool calling автосинхронізації Вечора (30 рядків) |
| `src/tabs/me.js` | Вкладка Я (~480 рядків) — винесено з `evening.js` у Фазі 0. Огляд тижня, теплова карта, патерни OWL |
| `src/tabs/onboarding.js` | Онбординг, слайди, опитування, OWL Guide, help |

### Дані (data)

| Файл | Що робить |
|------|-----------|
| `src/data/notes-categories.js` | **Канонічний довідник 19 категорій нотаток** (LW3j8 01.05). Англ ID + назва через `t()` для локалізації + `findCategoryByFolder(name)` з нормалізацією апострофів (legacy `Здоровя` без апострофа теж знаходиться). Замінив дві старі мапи з українськими ключами у `notes.js`. Підготовка до перекладу на польську/німецьку. Споживачі: `getFolderIcon`, `getFolderColor`, `_autoIconKey` у `notes.js`. |
| `src/data/ua-time-parser.js` | **Pure-function парсер часових виразів** (64CXo 09.05, розширено dyhJu 11.05). Експорт: `parseUaTimeOffset`, `parseAbsoluteDate`, `parseUaWeekday`, `resolveDateFromText`, `parseUaTimeOfDay` (HH:MM), **`hasExplicitClockTime(text)`** (7uxlr7 — строгий детектор ЯВНОГО годинникового часу для guard «час→подія»; не ловить дати «15.05» і абстрактні «вранці»). Споживачі: handlers у `habits.js` + `dispatcher-guards.js`. |
| `src/data/dispatcher-guards.js` | **7 pure-function guards для tool_calls** (dyhJu G4 11.05; +convertTaskToEventOnTime 7uxlr7 12.06). Експорт: `dropEventOnMomentKeyword`, `convertPastEventToMoment`, `convertNoteToFinance`, `dropTaskOnFinance`, `dropTaskOnComplete`, `dropEventOnMoment`, **`convertTaskToEventOnTime`** (save_task з ЯВНИМ часом «о 12:00» → create_event, щоб потрапляло в Розпорядок дня; захисти: минулий час/кроки/вже-подія) + `applyAllGuards`. У `tool-dispatcher.js` (8 чатів). «8 чатів = один мозок». |
| `src/data/entity-factories.js` | **Фабрики сутностей** (7uxlr7 12.06, Supabase Ворота 1+3). Єдине джерело форми + чокпойнт конверта. `makeEvent`, `makeTask`, `makeMoment`, `makeFinance` — кожна загорнута у `stampEntity`. 18 точок створення подій/задач/моментів/фінансів → 4 фабрики. (`makeHabit` живе у `habit-classifier.js` — звʼязана з inferHabitType.) |
| `src/data/habit-classifier.js` | **Класифікатор + фабрика звичок** (7uxlr7). `inferHabitType(name)` (правило 12 — «кинути/менше курити» → quit, детермінований), `makeHabit({...})` (5 точок створення → 1, конверт stampEntity, id UUID). |
| `src/data/action-log.js` | **Журнал AI-дій (G3 myshu 11.05)** — `nm_action_log` для universal undo. Експорт: `appendActionLog`, `getActionLog` (TTL 7д), `readLastReversible`, `markReversed`, `getRecent`, `clearActionLog`, `withActionLog` (wrapper для inline dispatchers). UUID id, ISO ts, user_id placeholder, device_id (з nm_device_id), schema_version=1. Supabase-ready. Споживачі: `tool-dispatcher.js`, `inbox.js`, `evening-actions.js`, `finance.js processFinanceAction`. |
| `src/data/action-reversers.js` | **Pure builders reverse-instructions (G3 myshu 11.05)** — мапа forward tool → reverse instruction. 2 типи: `tool_call` (save_X→delete_X by id) і `restore_snapshot` (save_routine→знімок nm_routine). Покриває 6 reversible tools. Експорт: `reversible`, `needsSnapshot`, `getSnapshotStorage`, `buildReverse`, `summarize`. |
| `src/data/action-undo.js` | **Виконавець reverse-інструкції (G3 myshu 11.05)** — `executeReverse(reverse)` робить `tool_call` через `processUniversalAction` АБО `restore_snapshot` через Object.assign(storage, value) + dispatch nm-data-changed. Викликається з restore_deleted(query='last') handlers. |
| `src/data/intent-router.js` | **Детермінований парсер явних команд (myshu 11.05)** — bypass AI roundtrip. `parseExplicitIntent(text)` → `{tool, args}` або null. Phase 1: save_routine. Phase 2: set_reminder (через `resolveDateFromText` з ua-time-parser). TIME_PATTERNS 5 варіантів (включно «N ранку без префіксу»). Інтегровано у `src/ai/core.js callAIWithTools` ПЕРЕД OpenAI fetch — 0ms latency, $0 cost для матчу. CLAUDE.md правило 12 у дії. |
| `src/core/backup.js` | **nm_backup_v* механізм (myshu 11.05)** — селективний бекап localStorage ПЕРЕД UUID-міграціями (Pre-Migration Hardening). Експорт: `createSelectiveBackup(keys, label)`, `restoreBackup`, `listBackups`, `cleanupOldBackups` (тримає 3 останніх). Auto-cleanup при quota. Використовується у `boot.js runMigrations()` v9-v17. |
| `src/core/action-mapper.js` | **Pure switch tool→universal-action (Сесія 4-mini, db0YY 12.05)** — винесено з `tool-dispatcher.js` як підготовка для майбутньої Сесії 4 execute-action.js. ZERO залежностей від ai/ tabs/ data/. Експорт: `toolCallToAction(name, args)`. tool-dispatcher.js re-exports під старим ім'ям `_toolCallToUniversalAction` для backwards-compat. |

---

## Збірка

**Команда:** `node build.js` → `src/app.js` → `bundle.js` (esbuild, IIFE формат).

**Порядок імпортів у `src/app.js`** — критичний, відповідає порядку оригінальних `<script>` тегів. Зміна порядку = потенційні circular dependencies (циклічні залежності: модуль A імпортує B, а B імпортує A — JS не знає з чого починати).

**При додаванні нових JS-файлів** — використовуй скіл `/new-file` (повний workflow там, включно з правильною папкою у `src/` та імпортом у `src/app.js`).
