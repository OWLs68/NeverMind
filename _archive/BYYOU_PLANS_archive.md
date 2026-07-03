# Архів планів /byyou

> Завершені потоки. Живий план — _ai-tools/BYYOU_PLAN.md.

---

# BYYOU_PLAN — активний потік /byyou

> **Що це:** жива оперативна памʼять одного потоку `/byyou`. Переживає обрив чату — `/byyou` без аргументу читає цей файл і продовжує з місця.
> **Чим НЕ є:** не документація і не лог рішень. Довгі «чому» рішення → `docs/adr/`. Хроніка сесії → `_ai-tools/SESSION_STATE.md`.

---

**Статус:** done
**Ціль:** (А) Закрити 3 системні дірки з дослідження gstack/best-practice (26yz5s 03.07): (1) КАНАРЕЙКА — після деплою ніхто не перевіряє живий сайт; (2) AI-СМОУК — усі E2E глушать OpenAI, поведінку живого AI тестують лише руки Романа; (3) ЗАМОК DO_NOT_TOUCH — священні корови на чесному слові. (Б) НОВОВВЕДЕННЯ у сам /byyou: хмарний смоук у Фазі 3 + верифікатор знахідок Council + пам'ять агентів.
**Гілка:** claude/new-session-26yz5s
**Мітка відкату:** byyou-start-26yz5s (ставиться на Брамі старту)
**Оновлено:** 2026-07-03

> **Модель: Fable 5** (сесія на ній, ≤07.07). Контекст-стоп 75% → handoff через цей файл.
> **Статуси:** `idle` · `active` (push заблоковано до «деплой») · `paused` · `done`.

---

## Кроки (3 блоки; деплой батчами на «деплой»)

### Блок 1 — Канарейка (пост-деплой перевірка прод-сайту)
| # | Крок | Маркер | Статус | Коміт |
|---|------|--------|--------|-------|
| 1 | Прод-URL `https://owls68.github.io/NeverMind/`, доїзд = бейдж vN проти deploy-counter.txt | 🟢 | ✅ | — |
| 2 | `tests/e2e/canary.spec.js` + `playwright.canary.config.js` (WebKit; canary виключено з основного прогону). Селектори звірено з живим prod-HTML. Локальний браузер-прогін неможливий (проксі середовища ріже Chromium — урок foyz2r «верифікуй через CI») | 🟢 | ✅ | 887a077 |
| 3 | `canary.yml`: workflow_run після Auto-merge → пол бейджа до свіжої версії (макс 5 хв) → спец; fail → Issue з міткою canary | 🟢 | ✅ | 81b2b66 |
| 4 | YAML OK + `--list` 22 тести без canary + check-imports; коміт блоку | 🟢 | ✅ | 81b2b66 |

### Блок 2 — AI-смоук (живий OpenAI ключ, за запитом)
| # | Крок | Маркер | Статус | Коміт |
|---|------|--------|--------|-------|
| 5 | РОМАН: окремий OpenAI-ключ з лімітом $5/міс → GitHub Secrets `OPENAI_SMOKE_KEY` (інструкція у реліз-нотатках нижче). Без нього ai-smoke чемно skip | 🟡 | ⏳ ТВІЙ ХІД | |
| 6 | `helpers.js` опція `realAI` (ключ з env; звичайні E2E не зачеплені) | 🟢 | ✅ | f109c08 |
| 7 | `ai-smoke.spec.js` — 4 живі сценарії, асерти на сутності | 🟢 | ✅ | 8f729a6 |
| 8 | `ai-smoke.yml` — ручний запуск + неділя 08:00 UTC | 🟢 | ✅ | 8f729a6 |
| 9 | Перевірки + коміт блоку | 🟢 | ✅ | 8f729a6 |

### Блок 3 — Замок DO_NOT_TOUCH
| # | Крок | Маркер | Статус | Коміт |
|---|------|--------|--------|-------|
| 10 | Хук `do-not-touch-guard.js` (boot.js, app.js; прохід через `dnt-ack: <файл>`) | 🟢 | ✅ | 1cd08ae |
| 11 | Реєстрація у settings.json + `check-dnt-guard.js` 5/5 у pre-push і CI | 🟢 | ✅ | 1cd08ae |
| 12 | ADR-004 + рядок у DO_NOT_TOUCH.md + /qa-explore у SKILLS_PLAN + Sonnet 5 у CLAUDE.md | 🟢 | ✅ | de183f1 |

### Блок 4 — Нововведення у режим /byyou (з дослідження gstack)
| # | Крок | Маркер | Статус | Коміт |
|---|------|--------|--------|-------|
| 13 | Скіл `/qa-explore` + крок 0 у Фазі 3 byyou.md (хмарний смоук; тільки локальна збірка — зовнішній прод проксі ріже) | 🟢 | ✅ | 043abca |
| 14 | Верифікатор знахідок — Фаза 1 крок 3.5 byyou.md | 🟢 | ✅ | 043abca |
| 15 | Памʼять агентів: `_ai-tools/agent-memory/*.md` (ios-bug-hunter + silent-bug-scout, пише тільки Голова) — нативний frontmatter НЕ юзали свідомо (контроль запису) | 🟢 | ✅ | 043abca |
| 16 | CLAUDE.md Sonnet 5 політика (рішення Романа) + ADR-004 | 🟢 | ✅ | de183f1 |

## Де зупинились
🏁 ЗАВЕРШЕНО 03.07: деплой v1110, канарейка #2 зелена (перший справжній прогін). Auto-merge #1578 впав на боці GitHub Pages («try again later») → самокорекція порожнім комітом → #1579 успіх. Лишився крок 5 (ключ Романа) — поза потоком.

## Реліз-нотатки

**ЩО ЗМІНИЛОСЬ:** 🐤 канарейка перевіряє живий сайт після кожного деплою (fail → Issue) · 🤖 AI-смоук з живим ключем (кнопка + неділя) · 🔒 замок на boot.js/app.js · /byyou: хмарний смоук у Фазі 3 + верифікатор знахідок + памʼять агентів · Sonnet 5 для всіх агентів. `src/` НЕ ЧІПАВСЯ (CACHE_NAME не бампаємо — застосунок той самий).

**ЩО МОЖЕ ЗЛАМАТИСЬ (pre-mortem):** (1) канарейка може флакати на повільному доїзді Pages → закладено пол 5 хв + 2 ретраї; якщо шумітиме — підняти пол до 8 хв. (2) ai-smoke без секрета — навмисно skip, НЕ падає. (3) замок DNT може заблокувати легітимний фікс boot.js — прохід через `dnt-ack`, описано у самому блоці. (4) Новий крок у contract-сторожах CI (check-dnt-guard) — ганяється у чистому runner, шляхи відносні від кореня — перевірено локально.

**ЩО ПЕРЕВІРИТИ (не iPhone — GitHub, 2 хв):** після деплою у Actions зʼявиться прогін «Canary (prod check)» → має бути зелений. Все інше перевіряє CI сам.

**ТВІЙ ХІД для AI-смоуку (коли зручно, з телефону):**
1. platform.openai.com → API keys → Create new secret key (назви `nm-smoke`) → скопіюй.
2. Там же у Billing → Limits → постав місячний ліміт $5.
3. GitHub → репо NeverMind → Settings → Secrets and variables → Actions → New repository secret → імʼя `OPENAI_SMOKE_KEY`, значення — ключ.
4. Скажи мені — я запущу перший прогін і подивлюсь результат.


---

# BYYOU_PLAN — активний потік /byyou

> **Що це:** жива оперативна памʼять одного потоку `/byyou`. Переживає обрив чату — `/byyou` без аргументу читає цей файл і продовжує з місця.
> **Чим НЕ є:** не документація і не лог рішень. Довгі «чому» рішення → `docs/adr/`. Хроніка сесії → `_ai-tools/SESSION_STATE.md`.

---

**Статус:** done
**Ціль:** АВТОНОМНИЙ блок (Fable 5, мандат Романа 28.06 «без моєї участі»): 4 серйозні задачі що верифікуються ПОВНIСТЮ з хмари (node-тести + сторожі + E2E CI). Кожна — крок до Supabase/Mastra. Жодних задач що потребують iPhone-смоуку (Ворота 2 і send_chips свідомо НЕ тут).
**Гілка:** claude/new-session-v3pexs
**Мітка відкату:** byyou-start-autonomy
**Оновлено:** 2026-06-28

> **Модель: Fable 5** (крок 0.3 — до 07.07). Контекст-стоп 75% → handoff у новий чат через цей файл (`/byyou` продовжить).
> **Статуси:** `idle` · `active` (push заблоковано до «деплой») · `paused` · `done`.

---

## Кроки (4 батчі за пріоритетом; кожен = локальні коміти, деплой батчами на «деплой» або в кінці)

| # | Крок | Маркер | Статус | Коміт |
|---|------|--------|--------|-------|
| A1 | **bareNoun-логіка → src/data/clarify-decision.js** (pure, guard = презентація). Поведінка 1:1. | 🟢 | ✅ | 0b4fed7 |
| A2 | **Сторож check-clarify-decision** — 28/28 реальних node-тестів + CI. Борг закрито. | 🟢 | ✅ | 0a96ac2 |
| B | **LLM-кордон openaiFetch:** 15 викликів (14 chat + 1 TTS) в 11 файлах → 1 функція у core.js (сирий Response, обробка у споживачів = 1:1). Зловлено+повернуто втрачений signal у autoGenerateTaskSteps. Сторож check-llm-boundary + CI. | 🟢 | ✅ | 0869719 |
| C | **nm_settings read-path:** 12 прямих читань у 9 файлах → getSettings() + сторож check-settings-boundary + CI. | 🟢 | ✅ | 09ad7c5 |
| D1 | **habits.js 1985→1157:** processUniversalAction+хелпери → `core/execute-action.js` (867). Strangler — 7 імпортерів без змін. Хук reverser-check оновлено на новий шлях. | 🟢 | ✅ | 6c63b83 |
| D2 | **inbox.js 1459→1150:** стрічка (мапи категорій+getInbox/saveInbox+toggleListItem+renderInbox) → `tabs/inbox-feed.js` (337). Односторонній, не циклічний. | 🟢 | ✅ | 8323813 |

| D3 | **boot.js 1450→616:** runMigrations (837) → `core/migrations.js` (851). | 🟢 | ✅ | c339e7a |
| D4 | **notes.js 1408→1109:** note-view модалка+чат → `tabs/notes-view.js` (324). Сеттер setActiveNoteMenuId (ESM module-var). | 🟢 | ✅ | 5351150 |
| E | **Pre-flight 15/15 сторожів** + bump CACHE + реліз-нотатки. | 🟢 | ✅ | — |

> **D-правила («розбий ПРАВИЛЬНО», мандат Романа):** /refactor-large скіл · різати по ЗВ'ЯЗНОСТІ (цілісний блок з мінімумом перехресних імпортів), не по рядках · re-export для зворотної сумісності де треба · нуль зміни поведінки · E2E після кожного файлу · ~1 файл = 1 деплой-батч (самокорекція CI між ними). D-батчі великі — handoff у нові чати через цей файл очікуваний і нормальний.

> **Маркери:** 🟢 GO — все автономне. Правила: кожен батч = чистий рефактор БЕЗ зміни поведінки (параметри/промпти/temperature 1:1); node --check + сторожі після кожного кроку; checkpoint-коміт після кожної фази; E2E після пушу.

**📋 МАПА D1 (розвідник Sonnet 28.06 — різати ЗА нею, без повторної розвідки):**
- **Блок:** habits.js рядки 963-1797 → `src/core/execute-action.js`. Коментар «384 рядки» на 996 — застарілий, ігнорувати.
- **Використані залежності** (переносити імпорти): makeEvent/makeTask/makeList (entity-factories), makeHabit (habit-classifier), getLists/saveLists (lists), addToTrash/showUndoToast (trash), resolveDateFromText/parseUaTimeOfDay (ua-time-parser), getMoments/saveMoments (evening), getEvents/saveEvents/addEventDedup/getRoutine/saveRoutine (calendar), getInbox/saveInbox/renderInbox/_detectEventFromTask (inbox), getTasks/saveTasks/renderTasks/toggleTaskStatus (tasks), getNotes/saveNotes/renderNotes/addNoteFromInbox/setCurrentNotesFolder/getDirectChildren (notes), getFinance/saveFinance/renderFinance/processFinanceAction (finance), deleteHealthCardProgrammatic/deleteAllergy/deleteMedicationFromCard (health), monthGenitive (months), t/levenshtein/getReminders/saveReminders (utils), generateUUID (uuid), currentTab (nav) + з habits.js: getHabits/saveHabits/getHabitLog/saveHabitLog/renderHabits/renderProdHabits (уже export?- перевірити).
- **7 імпортерів оновити:** tool-dispatcher.js:31, inbox.js:26, tasks.js:16, notes.js:20, finance.js:23, me.js:25, habits.js сам (1878). evening-chat — лише коментар (перевірити).
- **Шар безпечний:** core→tabs прецеденти є (utils/boot/trash/nav), циркулярність habits↔inbox/tasks/notes вже існує і працює (виклики не top-level). esbuild hoisting resolve — після різу `node build.js` перевірити.
- **window-exports НЕ зачеплені** (1978-1985 — інші функції).
- **Після D1 habits ≈1155 (<1200)** — опційний другий різ: `sendTasksBarMessage` 1800-1974 → tasks.js (→~980) або quit-блок 39-142 → habits-quit.js.
- **DRY-борг помічено:** локальний `_levenshtein` дублює `levenshtein` з utils — НЕ блокер, окремо.


---

## Чому ці 4 (для брами)

- **A** — закриває борг тесту у 7 чатах (регрес bareNoun зараз пройшов би тихо).
- **B** — план §8: «12 місць дзвонять напряму» → після зведення OpenAI→Mastra/Edge = зміна 1 файлу. Найцінніший крок до Фази 2/4.
- **C** — план-борг read-path: 11 точок → 1 (Supabase-міграція спрощується).
- **D** — аудит: habits.js 1988 (>1500 = розбиття) + план §7 «інструменти відчепити». Один executor замість розкиданих handlers.

**НЕ в блоці (чесно, потребують Романа):** Ворота 2 (табло-нагляд), send_chips (AI-поведінка + смоук), Supabase Фаза 2 (створення проекту = акаунт Романа), iOS-баги B-198/199.

---

## Зупинки і рішення Романа

| Крок | Питання | Рішення | Дата |
|------|---------|---------|------|
| старт | Автономний блок без смоуків Романа | **«Склади блок і запусти» — мандат** | 28.06 |

---

## Реліз-нотатки батчу A+B+C (перед «деплой»)

**ЩО ЗМІНИЛОСЬ (усе — невидимі рефактори, поведінка 1:1):**
- Логіка bareNoun-чіпів тепер під справжнім тестом (28/28) — регрес у 7 чатах більше не пройде тихо.
- УСI звернення до OpenAI (15 місць в 11 файлах) зведено через одну функцію — заміна OpenAI→Mastra/Edge стане зміною 1 файлу (план §8).
- Читання налаштувань — через одну точку (12 → 1) — Supabase-міграція налаштувань = 1 файл.
- +3 нові сторожі у pre-push/CI (разом 13) — замки від рецидивів.

**ЩО МОЖЕ ЗЛАМАТИСЬ (pre-mortem):**
- Механічна заміна fetch → кордон: body байт-у-байт, звірено очима + один втрачений signal зловлено і повернуто. E2E покриє.
- getSettings() додає try/catch якого у 2-3 місцях не було — це лише БЕЗПЕЧНІШЕ (повертає {} замість крешу).
- TTS (voice-output) тепер бере ключ сам — параметр key у _genOpenAI став неактивним (сигнатура не мінялась).

**СМОУК (мінімальний, без Романа — E2E у CI):** чат відповідає · табло генерується · фінанс-інсайт · онбординг-опитник. Усе покрито E2E/mockAI.

---

## Де зупинились

**Поточний крок:** ПОТIК ЗАВЕРШЕНО. A+B+C (E2E #38) + D 4/4 розрізи (E2E #40 після 1 раунду самокорекції — фікс getFolderColor/getter, відтворено ЛОКАЛЬНИМ chromium). Все у проді.
**Наступна дія:** нема — потік done. Наступні великі: send_chips / Ворота 2 / Supabase Фаза 2 (усі потребують Романа).
