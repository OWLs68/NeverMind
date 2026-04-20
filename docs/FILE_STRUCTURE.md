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
| `package.json` | Одна залежність: esbuild |

---

## `src/` — вихідний код

| Файл | Відповідальність |
|------|-----------------|
| `src/app.js` | Точка входу — імпортує всі модулі |
| `src/core/nav.js` | Глобальний стан (`currentTab`), switchTab, теми, налаштування, пам'ять |
| `src/core/boot.js` | bootApp, PWA setup, cross-tab sync, NM_KEYS, init |
| `src/core/trash.js` | Кошик (7 днів TTL), showUndoToast, undoDelete |
| `src/core/utils.js` | autoResizeTextarea, formatTime, escapeHtml (safe для undefined з B-70), `extractJsonBlocks` (розбивка AI-відповіді на окремі JSON-об'єкти — для множинних дій у чат-барах, 17.04 14zLe), `parseContentChips` (помічник для парсингу чіпів з AI-відповіді, 20.04 NRw8G) |
| `src/core/logger.js` | Error logging, console override, UI панель логу, ring buffer юзер-дій (trackUserAction), автолистенер nm-data-changed, stack trace у записах |
| `src/core/diagnostics.js` | **Діагностична система (B-67 acZEu):** Health Check (9 перевірок стану систем), Smoke Tests (9 авто-тестів), Performance monitor (startup/longtask/fetch monkey-patch). Рендерить 3 блоки у панелі логу. Експорти: runHealthCheck, runSmokeTests, getPerformanceData |

### AI модулі

| Файл | Відповідальність |
|------|-----------------|
| `src/ai/core.js` | **AI-логіка (~623 рядки після рефакторингу 17.04 14zLe):** getAIContext(), callAI(), chat storage (6 незалежних чатів), _fetchAI(), HTTP-wrappers (callAIWithHistory, callAIWithTools, callOwlChat), open/closeChatBar. Re-exports з `prompts.js` для backward-compat |
| `src/ai/prompts.js` | **Промпти OWL (17.04 14zLe):** `getOWLPersonality()` (3 характери coach/partner/mentor + universal правила), `INBOX_SYSTEM_PROMPT` (класифікатор Inbox), `INBOX_TOOLS` (31 function definition), `getOwlChatSystemPrompt(context)` для callOwlChat. **Коли OWL "не так відповідає" — правити ТУТ**, не в core.js. Передумова для майбутніх характерів (Badg/Rabi) |
| `src/ai/memory.js` | **Структурована пам'ять фактів** — `nm_facts` з часовими мітками (11.04). CRUD, дедуплікація, TTL, категорії (preferences/health/work/relationships/context/goals), formatFactsForContext/Board, міграція legacy nm_memory |
| `src/ai/ui-tools.js` | **UI Tools (4.17, 18.04 VJF2M)** — 8 hands-free навігаційних tools: `switch_tab` (з aliases calendar→модалка, habits→tasks), `open_memory`, `open_settings`, `set_finance_period`, `open_finance_analytics`, `set_theme`, `set_owl_mode`, `export_health_card`. Масив `UI_TOOLS` + `UI_TOOL_NAMES` (Set) + `handleUITool(name, args)` dispatcher. Імпортується у `prompts.js` (spread у INBOX_TOOLS) і `inbox.js` (dispatch). Повний довідник → `docs/AI_TOOLS.md`. |

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

---

## Збірка

**Команда:** `node build.js` → `src/app.js` → `bundle.js` (esbuild, IIFE формат).

**Порядок імпортів у `src/app.js`** — критичний, відповідає порядку оригінальних `<script>` тегів. Зміна порядку = потенційні circular dependencies (циклічні залежності: модуль A імпортує B, а B імпортує A — JS не знає з чого починати).

**При додаванні нових JS-файлів** — використовуй скіл `/new-file` (повний workflow там, включно з правильною папкою у `src/` та імпортом у `src/app.js`).
