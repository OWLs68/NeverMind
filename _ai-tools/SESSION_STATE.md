# Стан сесії

> **Компактний формат (з 20.04.2026 g05tu):** таблиця всіх активних сесій + бриф поточної. Детальні описи кожної сесії → [`docs/CHANGES.md`](../docs/CHANGES.md) (хронологічний журнал).
>
> Старіші сесії (до 6GoDe 19.04) — в [`_archive/SESSION_STATE_archive.md`](../_archive/SESSION_STATE_archive.md).

**Оновлено:** 2026-04-21 (сесія **rJYkw** — **Шар 2 "Один мозок V2" ЗАВЕРШЕНО (4 фази) + Мінімальне тертя старту (splash 800мс→200мс) + Бірюзовий колір подій (замість фіолету) + AI-дія open_calendar з пульсацією днів з подіями.**).

---

## ⚠️ ДЛЯ НОВОГО ЧАТУ — найважливіше

1. **🧪 iPhone-тест Шару 2 "Один мозок V2" — Фаза 2 і 3.** Сценарії:
   - (а) Зайти в застосунок вперше сьогодні → має бути "ранковий брифінг" з chips до 2-3 вкладок, видимий СКРІЗЬ коли перемикаєшся між вкладками (priority:critical пробиває фільтр).
   - (б) Перейти з Inbox у Фінанси → попереднє повідомлення лишається (немає мигання). Через 3 сек сова може написати нове (якщо є що сказати).
   - (в) Швидко гортати 5 вкладок за 2 сек → сова НЕ робить 5 API-запитів (dwell timer скидається при кожному переході).
   - (г) Повідомлення старше 10 хв показує сірий підпис "5 хв тому" дрібним шрифтом.
   - (д) Критичне нагадування з Inbox має бути видно на ВСІХ вкладках (пробій priority:critical).

2. **🧪 ПОВТОРНИЙ iPhone-тест B-96 v343+** (від сесії Gg3Fy — ще не перевірено). Ввести "Болить горло" при активній картці "Шляпа" — має піти у загальну картку "Здоровʼя", НЕ у "Шляпа". У Нотатках дубля бути НЕ повинно (разовий симптом). Потім: "Вже тиждень болить спина" → і картка, і нотатка (тривалий).

3. **🧠 Шар 2 "Один мозок V2" ЗАВЕРШЕНО у rJYkw (21.04.2026):**
   - **Фаза 1** (`444d0cd`): `src/owl/unified-storage.js` — єдиний ключ `nm_owl_board_unified`, lazy міграція зі старих 8 ключів, backward compat обгортки.
   - **Фаза 2** (`1a8d9ac`): event `nm-tab-switched` + dwell 3 сек + `tab-switched` тригер у Judge Layer (+1, комбінується) + stale>10m (+1) + один глобальний AbortController + `getRecentChatsAcrossTabs()` (крос-чат пам'ять) + жорстке розмежування proactive/reactive пам'яті у промпті + блок transitionFrom.
   - **Фаза 3** (`2701573`): `_pickMessageForTab` з пробоєм priority:critical + fade 200мс opacity transition + сірий підпис "N хв тому" для протухлих (>10 хв).
   - **Фаза 4** (поточний): tab-specific boosting (health-evening +2, finance-monthend +2, me-monday +2, projects-work +2, evening-dusk +2) + ранковий брифінг з `isBriefing:true` у промпті (мозок сам ставить critical) + документація.
   - Консультація з Gemini дала 3 ітерації — акцепнули priority-critical override, tab-specific boosting, крос-чат пам'ять, жорстке розмежування пам'ятей, AbortController.

4. **📋 Шар 3 "Один мозок V2"** (наступна сесія — якщо потрібно):
   - Уточнити крос-чат блок: зараз беремо 2 останні репліки з будь-якого чату, можна розширити до вкладкових тегів + більше історії.
   - Прив'язати ранковий брифінг до системи chips з `action:switch_tab` — щоб клік по брифінгу вів на вкладку + знижував priority до normal.

5. **🧪 Тест UX-покращень (rJYkw Фази A-D):**
   - (а) Відкриття застосунку — чи швидко (~200мс), без затягнутого жовтого екрану з логотипом
   - (б) Календар: у модалці дні з подіями мають бути **бірюзовими**, не фіолетовими. Кнопка "Зберегти" у редагуванні події теж бірюзова
   - (в) У будь-якому чаті написати "які в мене події?" → сова має відкрити модалку + дні з подіями **пульсують бірюзовим** 8 сек + у чаті текст зі списком
   - (г) Написати "відкрий календар" → просто модалка, без пульсацій

6. **CACHE_NAME** актуальне: `nm-20260421-1938`. При зміні коду у src/**/*.js, style.css, sw.js, index.html — оновлювати.

6. **Workflow Романа:** "Роби" → один таск → звіт → пропозиція наступного → чекати. Файли >250 рядків — skeleton+Edit, checkpoint-коміт після кожної фази, ≤25 слів між tool calls.

---

## Проект

| Параметр | Значення |
|---|---|
| **Версія** | v345+ на проді. Після rJYkw очікується v349+ |
| **URL** | owls68.github.io/NeverMind |
| **AI модель** | OpenAI GPT-4o-mini з Tool Calling (56 tools: 31 INBOX + 7 UI + 8 health/memory/cat + 2 finance + 8 projects) |
| **Гілка** | `claude/start-session-rJYkw` (Шар 2 "Один мозок V2" ЗАВЕРШЕНО — 4 фази, 4 коміти) |
| **CACHE_NAME** | `nm-20260421-1938` |
| **Repo** | Public + LICENSE (All Rights Reserved) |

---

## 🗺️ Куди йде проект

**Дорожня карта:** [`ROADMAP.md`](../ROADMAP.md) — Active / Next / Ideas / Rejected / After Supabase.
**Виконане:** [`ROADMAP_DONE.md`](../ROADMAP_DONE.md).
**Концепції вкладок:** [`CONCEPTS_ACTIVE.md`](../CONCEPTS_ACTIVE.md).

**🚀 Поточний Active:**
- **✅ Шар 1 "Один мозок V2" ЗАВЕРШЕНО (Gg3Fy 20.04)** — всі 8 чатів на INBOX_TOOLS + єдиний dispatcher. B-94/B-95 мають закритися архітектурно (потребує iPhone-тесту v340+).
- **Шар 2 "Єдине табло з призмою"** (наступна сесія) — `nm_owl_tab_*` × 8 → `nm_owl_board_unified` + system-prompt override за вкладкою.
- **Шар 3 "Мозок бачить всі чати"** — розширити `getAIContext()` хвостами чатів з усіх вкладок (без міграції сховища, чати лишаються окремими для юзера).

---

## 📋 Журнал сесій (останні)

| ID | Дата | Закрито / Зроблено | Коміти | Гілка | Деталі |
|---|---|---|---|---|---|
| **rJYkw** | 21.04 | ✅ Шар 2 "Один мозок V2" ЗАВЕРШЕНО (4 фази: unified storage + tab-switched/AbortController/крос-чат + призма+пробій+fade + boosting+брифінг) + UX швидкого старту (splash 800→200мс) + бірюзовий колір подій + AI-дія open_calendar з чіпом "Відкрити календар". 3 ітерації Gemini. 10 комітів. CACHE_NAME nm-20260421-0445→1949 | 10 | `claude/start-session-rJYkw` | [CHANGES §21.04-rJYkw](../docs/CHANGES.md) |
| **Gg3Fy** | 20-21.04 | ✅ Шар 1 "Один мозок V2" ЗАВЕРШЕНО: створено `ai/tool-dispatcher.js`, мігровано Health/Finance/Projects на INBOX_TOOLS, додано 10 нових tools. iPhone v340 тест: 5/6 фраз ✅. **B-94/B-95 закриті.** B-96 (концепція картки Здоровʼя) — 3 ітерації фіксу: тематичний матчинг → загальна картка + автодубль → селективний дубль. 9 комітів. CACHE_NAME nm-20260420-2040→20260421-0445. ROADMAP Шар 3 переписано. | 9 | `claude/start-session-Gg3Fy` | [CHANGES §20-21.04-Gg3Fy](../docs/CHANGES.md) |
| EWxjG | 20.04 | ✅ B-93 (CSS fade чат-вікна, `9f80341`). ❌ B-94/B-95: два промпт-підходи провалились на iPhone (коміти `379f13e`, `6fa67e2`) — треба архітектурний Шар 1. CACHE_NAME nm-20260420-1948→2040 | 3 | `claude/start-session-EWxjG` (merged) | [CHANGES §20.04-EWxjG](../docs/CHANGES.md) |
| 2Veg1 | 20.04 | Нова apple-touch-icon: сова-логотип (лайн-арт на беж-папері) через base64 у index.html рядок 18. 2 ітерації (перша обрізала ноги через iOS-заокруглення, друга з запасом ~80px — fix). CACHE_NAME bump nm-20260420-1120→1948 | 2 | `claude/start-session-2Veg1` (merged) | [CHANGES §20.04-2Veg1](../docs/CHANGES.md) |
| g05tu | 20.04 | Рефакторинг документації + «мозок» Claude: 5 фаз, 6 комітів, стартове читання 2164→1420 (−34%). Створено lessons.md, INDEX.md, 4 автоматичних хуки, 5 нових винесених файлів | 6 | `claude/start-session-g05tu` (merged) | [CHANGES §20.04-g05tu](../docs/CHANGES.md) |
| NRw8G | 20.04 | B-84..B-92 (9 багів з iPhone v322 тесту), parity `save_memory_fact` у 3 чатах, додано новий Active "Один мозок V2" | 9 | `claude/start-session-NRw8G` (merged) | [CHANGES §20.04-NRw8G](../docs/CHANGES.md) |
| JvzDi | 19.04 | B-81..B-83 (switch_tab промпт, set_theme плацебо прибрано, чіпи у Inbox chat через `_parseContentChips`) | 2 | `claude/start-session-JvzDi` (merged) | [CHANGES §19.04-JvzDi](../docs/CHANGES.md) |
| 6GoDe | 19.04 | 8 фіксів якості + Здоров'я 100% (Фаза 6 інтерв'ю) + legacy шкал cleanup | 8 | `claude/start-session-6GoDe` (merged) | [CHANGES §19.04-6GoDe](../docs/CHANGES.md) |
| dIooU | 19.04 | Вечір 2.0 Фази 1-8 (MVP виконано повністю) | 10+ | merged | [CHANGES §19.04-dIooU](../docs/CHANGES.md) |
| QV1n2 | 19.04 | Вечір 2.0 планування + Фаза 0 рефакторингу evening.js 1054→413 + 4 нові модулі | merged | [CHANGES §19.04-QV1n2](../docs/CHANGES.md) |
| rSTLV | 19.04 | Відкат маскот-сови, повернення до 🦉 емодзі | merged | [CHANGES §19.04-rSTLV](../docs/CHANGES.md) |
| NFtzw | 18.04 | (попередні) | — | [archive](../_archive/SESSION_STATE_archive.md) |
| **попередні** | | dIooU/QV1n2/NFtzw/uDZmz/rSTLV/w3ISi/VJF2M/Vydqm/FMykK/14zLe/KTQZA/gHCOh/cnTkD/hHIlZ/W6MDn/VAP6z/acZEu/E5O3I/3229b/6v2eR/jMR6m | — | — | [archive](../_archive/SESSION_STATE_archive.md) |

---

## 🔧 Поточна сесія rJYkw — Шар 2 "Один мозок V2" + UX швидкого старту (21.04.2026)

### Мета і результат
Перетворити 8 окремих сов у єдиний мозок з призмою вкладки (Шар 2 дорожньої карти) + прибрати тертя при відкритті застосунку + AI-дія для миттєвого відкриття календаря з подіями. **Підсумок:** ✅ Обидва блоки повністю закриті — Шар 2 (4 фази) + UX (4 фази) + 2 iPhone-фікси. 10 комітів, всі запушені.

### Зроблено (10 комітів)

**Шар 2 "Один мозок V2":**
1. **`444d0cd` — Ф1 Unified storage.** Створено `src/owl/unified-storage.js` — єдиний ключ `nm_owl_board_unified` (масив до 50 повідомлень, кожне з `forTab`). Lazy міграція зі старих 8 ключів. Обгортки `getOwlBoardMessages`/`saveOwlBoardMessages`/`getTabBoardMsgs`/`saveTabBoardMsg` для backward compat.
2. **`1a8d9ac` — Ф2 Tab-switched + крос-чат.** Event `nm-tab-switched` у `switchTab()` + dwell timer 3 сек + `tab-switched` тригер (+1) у Judge Layer + stale>10m (+1) нова градація + один глобальний `_boardAbortController` (скасовує попередній fetch при новому тригері) + `getRecentChatsAcrossTabs()` у `ai/core.js` (2 останні репліки з будь-якого чату за 30 хв) + жорстке розмежування `boardHistory` (proactive) vs `recentChat` (reactive) у системному промпті + блок `[ЗМІНА ФОКУСУ]` для transitionFrom.
3. **`2701573` — Ф3 Призма + fade.** `_pickMessageForTab()` у `board.js` — показуємо `msgs[0]` якщо `forTab===tab` АБО `priority==='critical'` (Jarvis-пуш), інакше — останнє для вкладки. CSS transition opacity 0.2s на `.owl-speech-text`. Функція `_applyTabText` робить fade-out→текст→fade-in 200+200мс. Сірий підпис "N хв тому" (клас `owl-time-stale`) для повідомлень старше 10 хв.
4. **`f2eb4f2` — Ф4 Tab-specific boosting + брифінг.** У `_judgeBoard(trigger, targetTab)` додано бонуси: health-evening streak-risk +2, finance-monthend (≥25 числа) budget-warn +2, me-monday week-start +2, projects-work stuck-tasks +2, evening-dusk no-evening-summary +2. Ранковий брифінг через `options.isBriefing:true` у `generateBoardMessage` — промпт просить `priority:critical` щоб повідомлення було видно скрізь.

**UX швидкого старту + AI-дія Календар:**
5. **`9c515f8` — Фаза A splash 800мс→200мс.** У `boot.js` прибрано `setTimeout(showApp, 300-500мс)` — викликається одразу. Fade скорочено з 400мс до 200мс. Fallback 3с→1с. У style.css прибрано `transform:scale` (економія на composite).
6. **`07af786` — Фаза B бірюзовий колір подій.** Sed замінив фіолет `#6366f1`/`rgba(99,102,241,*)` → бірюзовий `#14b8a6`/`rgba(20,184,166,*)` у `calendar.js` (всі 7 місць: фон, border, крапка, текст, timeline). У `index.html` — time picker у модалці події + кнопка "Зберегти" (градієнт `#2dd4bf`→`#14b8a6`).
7. **`88c35eb` — Фаза C AI-дія open_calendar.** Додано tool `open_calendar(highlight_events:boolean)` у `UI_TOOLS`. Handler викликає `openCalendarModal()` + через 400мс `highlightEventDays()` (після анімації scale). Функція експортована у window. CSS `@keyframes cal-day-event-pulse-anim` — бірюзовий box-shadow pulse 1.5s infinite. Автозупинка через 8 сек. Правило в `UI_TOOLS_RULES`: питання про події → tool + текстова відповідь.
8. **`e1b3ce0` — Фаза D доки.** CACHE_NAME bump, оновлено `docs/AI_TOOLS.md` (нова таблиця A), оновлено `_ai-tools/SESSION_STATE.md`.
9. **`e1880ea` — фікс: модель дала тільки текст.** iPhone v350: "Які в мене події?" → сова відповіла текстом але не викликала `open_calendar`. Причина: формулювання "ОКРІМ виклику tool" gpt-4o-mini читав як "замість". Переписано жорстко: "ЖОРСТКЕ ПРАВИЛО ДВОХ ДІЙ", "ОБОВ'ЯЗКОВО І TOOL І ТЕКСТ ОДНОЧАСНО", з конкретним прикладом tool_call + content.
10. **`b17cd4b` — чіп "Відкрити календар" (мінімальне тертя).** Роман: "не треба писати 'покажи'". Додано обробку особливого `action:"nav", target:"calendar"` у `handleChipClick` (chips.js) — напряму викликає `handleUITool('open_calendar', {highlight_events:true})`. Правило у промпті: при відповіді про події додати chip "Відкрити календар" — тап одразу відкриває модалку з пульсацією.

### Консультація з Gemini (3 ітерації)
- Ітерація 1: поверхнева (не знала про `getAIContext`, `getRecentActions`). Після першого промпту.
- Ітерація 2: вже враховує контекст. Прийняли: AbortController один глобальний, правило "НІКОЛИ не кажи я бачу ти перейшов", Context Thrashing пастка (розмежування пам'ятей).
- Ітерація 3: самооцінка 7/10. Прийняли: priority-critical override (моя ідея), tab-specific boosting (моя ідея), сірий підпис "N хв тому" замість згортання. Gemini оцінив "priority-critical + tab-specific boosting разом" як найбільший Jarvis-feel за мінімум роботи.

### Обговорено (без виконання)
- Шар 3 "мозок бачить всі чати" — частково зроблено через `getRecentChatsAcrossTabs()` (2 репліки). Розширення до 3-5 з тегами — у майбутній сесії.
- Відмовились від adaptive UI silence (opacity 0.5) — виглядатиме як баг.
- Відмовились від адаптивного dwell time (0-10 сек) — over-engineering.
- Chips action:"switch_tab" уже було реалізовано як `target:"calendar"` спеціальний випадок — проблема тільки в тому що AI рідко використовує це (треба агресивніший промпт).

### Ключові рішення
- Вирішили: msgs[0] показувати ТІЛЬКИ якщо forTab збігається, критичні пробивають фільтр. Оригінальне "одне повідомлення всюди" — занадто радикально (Gemini вказав на проблему з UX).
- Вирішили: tab-switched НЕ окремий тригер а модифікатор Judge Layer (+1) який комбінується з stale/data-changed.
- Вирішили: бірюзовий `#14b8a6` (teal-500) як замінник фіолетового `#6366f1` для подій — Роман не любить фіолет.
- Вирішили: замість "юзер пише друге повідомлення покажи" → чіп під відповіддю про події з миттєвим відкриттям.

### Інциденти
- Без інцидентів. 10 комітів з checkpoint-ами після кожної фази, без reset/force push.

### Метрики
- **Коміти:** 10 (`444d0cd` → ... → `b17cd4b`)
- **Версії:** v345 → v351+
- **CACHE_NAME:** `nm-20260421-0445` → `nm-20260421-1949`
- **Build:** чистий (0 попереджень)
- **Гілка:** `claude/start-session-rJYkw`
- **Статус багів:** B-96 все ще очікує повторного iPhone-тесту (ще не перевіряли з Gg3Fy)

---

## 🔧 Попередня сесія Gg3Fy — Шар 1 "Один мозок V2" (20.04.2026, автономна робота вночі)

### Мета і результат
Мігрувати всі 8 чатів на єдиний dispatcher + `INBOX_TOOLS`, щоб закрити B-94/B-95 архітектурно. **Підсумок:** ✅ Шар 1 повністю закритий у 4 фази з checkpoint-комітами. B-94/B-95 очікують iPhone-тест v340+ для остаточного закриття.

### Зроблено (6 комітів)

1. **`a80fa08` — ROADMAP.md Шар 3 переписано.** Скасовано неправильне формулювання ("спільна історія `nm_owl_conversation` з міграцією сховища"). Повернуто до оригінальної концепції з `_archive/FEATURES_ROADMAP.md` п.1.3: "чати окремі для юзера, мозок бачить ВСІ чати при генерації відповідей". Майбутній Шар 3 = просто розширення `getAIContext()` хвостами чатів.

2. **`ebfab56` — Фаза 1: dispatcher foundation.** Створено `src/ai/tool-dispatcher.js` — єдиний модуль-мозок для tool_calls у 8 чатах. Має маршрутизацію UI → health CRUD → memory/finance-cat → project-specific → universal actions. Перенесено `dispatchChatToolCalls` і `_toolCallToUniversalAction` з `tabs/habits.js`. Додано прямі хендлери для 9 health tools + 5 finance-category tools + save_memory_fact. Оновлено імпорти у habits.js, me.js, notes.js.

3. **`5563b15` — Фаза 2: Health chat migration.** Промпт винесено у `getHealthChatSystem(activeCard)` у `ai/prompts.js`. `sendHealthBarMessage` переписано: `UI_TOOLS` → `INBOX_TOOLS`, `_processOne` + `extractJsonBlocks` + history detox прибрано. Функція стиснута 250 → 40 рядків. `add_allergy`/`create_event`/`create_health_card` тепер реальні OpenAI-функції на одному рівні з `set_owl_mode`/`switch_tab` — модель GPT-4o-mini більше не має bias "справжня функція над текст-JSON".

4. **`fe5b9e2` — Фаза 3: Finance chat migration.** Додано 2 нові tools у INBOX_TOOLS: `delete_transaction`, `set_finance_budget`. Хендлери у dispatcher. Промпт винесено у `getFinanceChatSystem({currency, budget, txSummary, expenseCats, incomeCats})`. `sendFinanceBarMessage` стиснуто 155 → 50 рядків. `checkFinBudgetWarning` лишається локальним (викликається post-dispatch для `save_finance(expense)`).

5. **`8307d26` — Фаза 4: Projects chat migration.** Додано 8 project-specific tools у INBOX_TOOLS: `complete_project_step`, `add_project_step`, `update_project_progress`, `add_project_decision`, `add_project_metric`, `add_project_resource`, `update_project_tempo`, `update_project_risks`. Хендлер `_handleProjectTool` у dispatcher — централізована логіка з прогрес-розрахунком. Промпт → `getProjectsChatSystem({activeProject, projectsContext, activeSteps})`. Функція стиснута 215 → 30 рядків.

6. **CACHE_NAME bump + документація** (цей коміт) — `nm-20260420-2040` → `nm-20260420-2159`. Оновлено SESSION_STATE.md, NEVERMIND_BUGS.md (B-94/B-95 → очікують iPhone тест), ROADMAP.md.

### Архітектурний підсумок
- **До сесії:** 3 паралельні dispatcher-и (Inbox inline, `dispatchEveningTool` у evening-actions, `processUniversalAction` у habits) + 3 чати на `UI_TOOLS` + text-JSON (Health/Finance/Projects) → у сумі **~950 рядків дубльованої dispatch-логіки**.
- **Після сесії:** єдиний `tool-dispatcher.js` (~370 рядків) + `processUniversalAction` лишається як core (не мігрований — 384 рядки, тісні локальні залежності). 8 чатів використовують однакову маршрутизацію.
- **Net delta:** ~610 рядків видалено з 3 мігрованих чатів, ~370 доданих у новому модулі + 400 у prompts.js. Приблизно **нуль змін у bundle size**, але 8 чатів мають ідентичний набір можливостей.

### Що потребує iPhone-тесту
6 фраз у чаті Здоровʼя на v340+:
1. "Алергія на пил" → має викликати `add_allergy` (B-94 fix)
2. "Завтра прийом у лікаря о 10" → `create_event` (B-95 fix)
3. "Болить горло 3 дні" → `add_health_history_entry` (якщо є активна картка) або `create_health_card`
4. "Перейди до фінансів" → `switch_tab` (UI tool має все ще працювати)
5. "Переключись на Ментора" → `set_owl_mode`
6. "Запам'ятай що не їм глютен" → `save_memory_fact`

Якщо всі 6 спрацюють — закрити B-94/B-95 у `NEVERMIND_BUGS.md`.

### Метрики
- **Коміти:** 9 (`a80fa08` → `ebfab56` → `5563b15` → `fe5b9e2` → `8307d26` → `a33d1af` → `6f379d9` → `46a067c` → `ea642b0`)
- **CACHE_NAME:** `nm-20260420-2040` → `nm-20260421-0445`
- **Гілка:** `claude/start-session-Gg3Fy`
- **Статус багів:** B-94 ✅ B-95 ✅ закриті (iPhone v340 тест). B-96 (тематичний матчинг + концепція загальної картки) — 3 ітерації фіксу, потребує фінального iPhone v343+ тесту.

### Додано після першого /finish (оновлено 21.04 UPDATE)
- **`6f379d9` — B-96 перша ітерація (тематичний матчинг).** Виявлено що "Болить горло" при активній картці "Шляпа" записує у неправильну картку. Промпт-фікс додав правило тематичного матчингу з 4 прикладами. Роман відкинув концепцію — "нащо 10 нових папок".
- **`46a067c` — B-96 друга ітерація (загальна картка).** Переписано на концепцію "загальний журнал Здоровʼя". Default: всі разові симптоми у одну картку "Здоровʼя" (створити якщо немає). Окремі картки тільки для хронічних/діагнозів. Handler `add_health_history_entry` має fallback: якщо card_id невалідний → шукає/створює картку "Здоровʼя". Додано автоматичний дубль у Нотатки папка "Здоровʼя".
- **`ea642b0` — B-96 третя ітерація (селективний дубль).** Роман: "Дублікат в нотатках чисто для історії. Але важливо щоб це не перетворювалося в архів і історію всього на світі". Автодубль прибрано з handler-а. У промпт додано правило: `save_note(folder="Здоровʼя")` ТІЛЬКИ для значущих записів (тривалі 3+ днів, діагнози, суттєві зміни, явний запит юзера). Разові дрібниці ("болить голова", "температура 37") → тільки картка.

### Концепція Здоровʼя — уточнена (21.04 Gg3Fy)
- **Одна загальна картка "Здоровʼя"** = catch-all журнал для разових симптомів.
- **Окремі вузькі картки** (Тиск, Алергія, Спина) — тільки для хронічних станів або діагнозів лікаря.
- **Нотатки у папці "Здоровʼя"** = селективно, тільки значущі записи варті перегляду пізніше. Не архів кожного чиха.
