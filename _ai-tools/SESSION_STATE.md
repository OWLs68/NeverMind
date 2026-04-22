# Стан сесії

> **Компактний формат (з 20.04.2026 g05tu):** таблиця всіх активних сесій + бриф поточної. Детальні описи кожної сесії → [`docs/CHANGES.md`](../docs/CHANGES.md) (хронологічний журнал).
>
> Старіші сесії (до 6GoDe 19.04) — в [`_archive/SESSION_STATE_archive.md`](../_archive/SESSION_STATE_archive.md).

**Оновлено:** 2026-04-22 (сесія **ZJmdF** — **Один мозок V2 ЗАМКНУТО: універсальна червона крапка непрочитаних у 8 вкладках + Brain Pulse engine (9 сигналів, AI сам обирає куди/що писати) + Шар 3 "Мозок бачить всі чати" (крос-чат памʼять 2→5 реплік, 30→60хв + клікабельний брифінг) + REMINDER_RULES спільне для 8 чатів + фікси (цифри календаря, зранку=08:00, захист від дубля).**).

---

## ⚠️ ДЛЯ НОВОГО ЧАТУ — найважливіше

1. **🧪 iPhone-тест Brain Pulse** (ключова нова архітектура ZJmdF). Приклад: створити тестовий бюджет у Фінансах 1000 грн + додати витрату 900 грн → протягом 10-15 хв сова має написати проактивно у чат Фінансів з червоною крапкою на літачку. Застаріла (>3 днів) задача → сова напише у Задачі. Прийом лікаря через 4 год → `priority:critical` у Здоровʼї. Якщо сигналів нема — мозок має МОВЧАТИ (це фіча, не баг).

2. **🧪 iPhone-тест універсальних крапок.** Якщо агент якось напише у закритий чат (Задачі/Нотатки/Я/Фінанси/Здоровʼя/Проекти) — **червона крапка має з'явитися на літачку**. При відкритті чата — крапка зникає. До сесії ZJmdF це працювало тільки в Inbox і Вечорі.

3. **🧪 Тест REMINDER_RULES у будь-якому чаті:** "Нагадай зранку про спортзал" → має бути 08:00 (не 05:00). На "Ок" у відповідь — НЕ має бути другого дублю нагадування. Актуально для 8 чатів однаково.

4. **🧪 Тест Шару 3 (крос-чат памʼять):** у чаті Здоровʼя написати "болить спина" → через 30-45 хв у чаті Фінансів написати про ліки → мозок має пам'ятати першу тему (розширено вікно з 30 хв до 60 хв, 2 реплік до 5).

5. **🧪 Тест клікабельного брифінгу:** ранковий брифінг має priority:critical і видно скрізь. Клік на чіп "Задачі" → переходить + брифінг зникає з інших вкладок (priority стає normal, більше не пробиває фільтр).

6. **📋 Для наступної сесії — пункти у ROADMAP:**
   - **Календар — сортування подій (Варіант A).** Зараз 9 квітня (минуле) зверху, 24 (майбутнє) знизу. Треба: сьогодні → майбутні → минулі. Запит Романа зі скріна.
   - **Чіпи у 6 нових чатах** — `parseContentChips` підключений тільки в Inbox і Вечорі. У Задачах/Нотатках/Я/Фінансах/Здоровʼї/Проектах JSON рендериться як сирий текст. План: винести `addChatMsgWithChips` у `core.js`, замінити 6 add-функцій.

7. **CACHE_NAME** актуальне: `nm-20260422-0414`. При зміні коду у src/**/*.js, style.css, sw.js, index.html — оновлювати.

8. **Workflow Романа:** "Роби" → один таск → звіт → пропозиція наступного → чекати. Файли >250 рядків — skeleton+Edit, checkpoint-коміт після кожної фази, ≤25 слів між tool calls.

---

## Проект

| Параметр | Значення |
|---|---|
| **Версія** | v353+ на проді. Після ZJmdF очікується v354+ |
| **URL** | owls68.github.io/NeverMind |
| **AI модель** | OpenAI GPT-4o-mini з Tool Calling (56 tools INBOX_TOOLS + нове 1 tool BRAIN_TOOLS post_chat_message для мозку) |
| **Гілка** | `claude/start-session-ZJmdF` (Один мозок V2 ЗАМКНУТО — 3 шари + крапки + REMINDER_RULES, 11 комітів) |
| **CACHE_NAME** | `nm-20260422-0414` |
| **Repo** | Public + LICENSE (All Rights Reserved) |

---

## 🗺️ Куди йде проект

**Дорожня карта:** [`ROADMAP.md`](../ROADMAP.md) — Active / Next / Ideas / Rejected / After Supabase.
**Виконане:** [`ROADMAP_DONE.md`](../ROADMAP_DONE.md).
**Концепції вкладок:** [`CONCEPTS_ACTIVE.md`](../CONCEPTS_ACTIVE.md).

**🚀 Поточний Active:**
- **✅ Один мозок V2 ЗАМКНУТО** — Шар 1 (Gg3Fy dispatcher) + Шар 2 (rJYkw табло з призмою) + Шар 3 (ZJmdF крос-чат памʼять + клікабельний брифінг). Плюс ZJmdF: універсальні крапки + Brain Pulse engine з 9 сигналами + REMINDER_RULES.
- **Наступні пункти** (у Next):
  - Календар 80→100% — сортування Варіант A + тривалість + рекурентність
  - Чіпи у 6 чатах — `parseContentChips` винести універсально
  - Я 70→100% / Проекти 65→100% / Фінанси v2

---

## 📋 Журнал сесій (останні)

| ID | Дата | Закрито / Зроблено | Коміти | Гілка | Деталі |
|---|---|---|---|---|---|
| **ZJmdF** | 21-22.04 | ✅ Один мозок V2 ЗАМКНУТО: універсальна крапка у 8 вкладках + Brain Pulse engine (9 сигналів, tool `post_chat_message`) + Шар 3 крос-чат памʼять (2→5 реплік, 30→60хв) + клікабельний брифінг (critical→normal при кліку) + REMINDER_RULES у 8 чатах (зранку=08:00, захист від дубля) + фікс читабельності цифр у календарі. 11 комітів. CACHE_NAME nm-20260421-2056→20260422-0414 | 11 | `claude/start-session-ZJmdF` | [CHANGES §22.04-ZJmdF](../docs/CHANGES.md) |
| **rJYkw** | 21.04 | ✅ Шар 2 "Один мозок V2" ЗАВЕРШЕНО (4 фази: unified storage + tab-switched/AbortController/крос-чат + призма+пробій+fade + boosting+брифінг) + UX швидкого старту (splash 800→200мс) + бірюзовий колір подій + AI-дія open_calendar з чіпом "Відкрити календар". 3 ітерації Gemini. 10 комітів. | 10 | `claude/start-session-rJYkw` (merged) | [CHANGES §21.04-rJYkw](../docs/CHANGES.md) |
| Gg3Fy | 20-21.04 | Шар 1 "Один мозок V2" ЗАВЕРШЕНО. Повний опис → [archive](../_archive/SESSION_STATE_archive.md) | 9 | `claude/start-session-Gg3Fy` (merged) | — |
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

## 🔧 Поточна сесія ZJmdF — Один мозок V2 ЗАМКНУТО + універсальні крапки + REMINDER_RULES (21-22.04.2026)

### Мета і результат
Завершити концепцію "Один мозок": (1) сова має можливість писати першою у всі 8 вкладок з візуальним сигналом; (2) мозок сам вирішує куди/що писати на основі живих сигналів з усіх вкладок; (3) мозок пам'ятає розмови з інших чатів; (4) правила (час, захист від дубля) однакові скрізь. **Підсумок:** ✅ все закрито за 11 комітів з чекпоінтами. Без інцидентів.

### Зроблено (11 комітів)

**Фаза A — Універсальна червона крапка:**
1. **`7dc837e`** — `showUnreadBadge` підключено у 6 нових чатах. `addHealthChatMsg`/`addProjectsChatMsg` експортовано. IDs кнопок у index.html для tasks/notes/me/finance/health/projects. `addMsgForTab` викликає бейдж для всіх закритих чатів. `restoreChatUI` знає про health/projects.

**Фаза B — Brain Pulse (один мозок, 9 сигналів):**
2. **`149ce00`** — B.1: `src/owl/brain-signals.js` (264 рядки). `collectBrainSignals()` збирає 9 типів: stuck-task, event-passed, event-upcoming, budget-warn/overflow, appointment-soon, streak-risk, project-stuck, weekly-review.
3. **`7e10b62`** — B.2: `src/owl/brain-pulse.js` engine. `BRAIN_TOOLS.post_chat_message` у prompts.js. `getBrainPulseSystemPrompt(signals)` з правилами "краще мовчати ніж спам". CHAT_STORE_KEYS додано health+projects.
4. **`7165fda`** — B.3: інтеграція. `startBrainPulseCycle()` через 4 сек у boot.js. `followups.js` рефактор 218→80 рядків (тільки evening-prompt залишився, інші сигнали йдуть через Brain Pulse). Спільний `followup_global` cooldown — дублі неможливі.

**Шар 3 — Мозок бачить всі чати:**
5. **`e479278`** — Блок 1: `getRecentChatsAcrossTabs` 2→5 реплік, 30→60хв вікно.
6. **`973bb60`** — Блок 2: клік на чіп брифінгу знижує priority critical→normal. Нова `downgradeBriefingPriority()` у unified-storage. У proactive.js при isBriefing — примусово topic='morning-briefing'. У chips.js `handleChipClick` — виклик downgrade + renderTabBoard перед switchTab.

**Фікси і полірування:**
7. **`8109dd4`** — календар: цифри днів з подіями стали темно-фіолетовими (замість бірюзових на бірюзовому — зливалися), border трохи темніше.
8. **`3f9ea78`** — фікс розуміння часу: "зранку=08:00" не 05:00 + захист від дубля на "Ок" (тільки чат Я).
9. **`f863f46`** — REMINDER_RULES спільна константа у `prompts.js`, підключено у всі 8 чатів (Inbox/Evening/Projects/Finance/Health через функції-промпти + Me/Notes/Tasks через import). Точка правди — одна.
10. **`d7c03b4`** — ROADMAP оновлено: сортування подій у Календарі + чіпи у 6 чатах.
11. **`1dede1f`** — ROADMAP уточнення: сортування — Варіант A узгоджено з Романом.

### Обговорено (без виконання — у ROADMAP)
- **Сортування списку "Події · місяць"** — Варіант A (сьогодні → майбутні → минулі). Запит Романа зі скріна.
- **Чіпи у 6 нових чатах** — JSON чіпа рендериться як сирий текст, бо `parseContentChips` підключений тільки в Inbox+Evening. Винести `addChatMsgWithChips` у core.js.
- **Колір #1e1040** — насправді темно-фіолетовий (RGB 30,16,64), а в документації названий "темно-сірий". Використовується як основний текст у всьому застосунку. Роман сказав не чіпати поки — занадто глобальна зміна.

### Ключові рішення
- **Варіант 2 "один мозок"** замість 6 окремих check-функцій (Роман обрав явно). BrainPulse — єдиний Judge Layer, 9 сигналів в один масив, AI сам обирає.
- **REMINDER_RULES винесено у спільну константу** за прямим запитом Романа "правила/взаємодії робити у всіх вкладках — один мозок".
- **followups.js стиснуто** до evening-prompt only — stuck-task і event-passed тепер через BrainPulse. Спільний `followup_global` cooldown гарантує що дубля не буде.
- **Календар: зліва темний текст на блідому бірюзовому** (не білий на насиченому) — для консистентності з іншими днями. Сьогодні (помаранчевий з білою цифрою) лишається виділеним №1.

### Інциденти
- Без інцидентів. 11 комітів з чекпоінтами після кожної фази. Без reset/force push. Stream idle timeout під час фінішу — не вплинуло на код.

### Метрики
- **Коміти:** 11 (`7dc837e` → ... → `1dede1f`)
- **CACHE_NAME:** `nm-20260421-1949` → `nm-20260422-0414`
- **Гілка:** `claude/start-session-ZJmdF`
- **Build:** чистий (0 попереджень)
- **Нові файли:** `src/owl/brain-signals.js` (264 рядки), `src/owl/brain-pulse.js` (117 рядків)
- **REMINDER_RULES** — 1 константа → 8 чатів використовують її (єдина точка правди для нагадувань)

---

## 🔧 Попередня сесія rJYkw — Шар 2 "Один мозок V2" + UX швидкого старту (21.04.2026)

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


