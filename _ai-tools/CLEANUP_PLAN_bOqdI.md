# 🧹 Cleanup план — спадок bOqdI 02.05.2026

> **Контекст:** сесія `bOqdI` (Council механізм у CLAUDE.md + архівація `COUNCIL_CONCEPT.md` → `_archive/` + 3 фікси evening/health/proactive) запустила Council із 5 агентами для глобального cleanup документації. Знайшли 33+ протиріч і застарілостей. Контекст вичерпався — виконання у новому чаті.
>
> **Реальна версія:** **v553** (live на iPhone, з останнього коміту main `7c1275b chore: deploy v553 · 02.05 15:20`).
>
> **Дія для нового чату:** виконай 9 фаз нижче. Після останньої — видали цей файл (`git rm _ai-tools/CLEANUP_PLAN_bOqdI.md`). План одноразовий.

---

## Фаза 1 — 🚨 Архівація LW3j8 + 6ANWm у SESSION_STATE (борг 3 сесії, ПЕРШОЮ ДІЄЮ)

**Корінь регресії:** правило `/finish` Phase 0 «архівувати найстарший при ≤2 активних» працює тільки коли контекст <75%. На `/finish` контекст вже забитий → правило систематично пропускається. Зафіксована регресія 3 пропуски поспіль: **C8uQD 27.04 → rKQPT 02.05 → bOqdI 02.05** = зараз 4 активних блоки у `SESSION_STATE.md` замість ≤2.

**Дії:**
1. Перенести блоки `LW3j8` + `6ANWm` з `_ai-tools/SESSION_STATE.md` → `_archive/SESSION_STATE_archive.md`
2. У живому файлі замінити `<details>` обгортки цих сесій на 1-рядкові stub-посилання («сесія LW3j8 → див. `_archive/SESSION_STATE_archive.md`»)
3. У `_archive/SESSION_STATE_archive.md` — конвертувати `<details>/<summary>` → `## 🔧 Сесія LW3j8 / ## 🔧 Сесія 6ANWm` заголовки
4. Перевірка: `grep -c "^<details>" _ai-tools/SESSION_STATE.md` → ≤1 (тільки rKQPT якщо bOqdI стає активним зверху)
5. **Профілактика регресії — додано у `.claude/commands/start.md` Крок 2.5** (комітом цієї фази або разом). Тригер на /start (свіжий контекст) замість /finish (забитий).

**Коміт:** `docs(session-state): archive LW3j8/6ANWm + add /start guard`

---

## Фаза 2 — Виправити 4 битих посилання `_ai-tools/COUNCIL_CONCEPT.md` → `_archive/COUNCIL_CONCEPT.md`
**Файли:** `_ai-tools/SESSION_STATE.md` (рядки 33, 56, 66) + `docs/CHANGES.md` (рядок 2779).
**Перевірка:** `grep -rn "_ai-tools/COUNCIL_CONCEPT" .` → 0 збігів (крім самого `_archive/COUNCIL_CONCEPT.md`).
**Коміт:** `docs: fix 4 broken links _ai-tools/COUNCIL_CONCEPT → _archive/`

## Фаза 3 — Записати сесію bOqdI у `docs/CHANGES.md`
**Що:** додати запис після `## 02.05.2026 — сесія rKQPT` за форматом /finish (Council + 3 фікси + Council-cleanup-сесія + список комітів `8cc73af`/`891cee2`/`19e112f`/`25e60da`/`8c3fe8d`/`bdf5ed3`).
**Коміт:** `docs(changes): record session bOqdI`

## Фаза 4 — `SESSION_STATE.md` шапка + ротація (без архівації — вона у Фазі 1)
1. Шапка «Оновлено:» → bOqdI
2. Зняти пріоритет №1 «Створити /council скіл» (рядок 56) — Council вже реалізовано. Узгодити з CLAUDE.md (немає метрик 👍/👎, немає логу).
3. Оновити таблицю «Проект» рядок 218 (v494 → **v553**, гілка `claude/start-session-{нова}`, CACHE `nm-20260502-1235`)
4. Додати блок bOqdI зверху, rKQPT → `<details>`
5. Активних блоків після цього: **2** (bOqdI + rKQPT) — правило ≤2 виконано (LW3j8+6ANWm вже у Фазі 1)
**Коміт:** `docs(session-state): rotate to bOqdI on top + update version v553`

## Фаза 5 — `NEVERMIND_BUGS.md` ротація
1. Винести `LW3j8` + `6ANWm` параграфи → `_archive/BUGS_HISTORY.md`
2. Додати запис `bOqdI` (3 архітектурні прогалини: evening/health/proactive — без B-XX, як архітектурний борг)
3. Лишити `rKQPT` (1 critical: projects.js ReferenceError)
4. Оновити рядок-довідку 30 → «закриті у 2 останніх (bOqdI + rKQPT)»
**Коміт:** `docs(bugs): close bOqdI gaps + rotate archive`

## Фаза 6 — `ROADMAP.md` синк
1. Підсесії 1+2 (`✅ ВИКОНАНО`) винести з `🚀 Active` → `ROADMAP_DONE.md`
2. У Підсесії 3 додати «✅ 3 прогалини закриті у bOqdI (`19e112f`/`25e60da`/`8c3fe8d`); ⚠️ payload-уніфікація 37 call-sites лишається ВІДКРИТА»
3. **iPhone smoke-test v553+** підняти з ⚠️ ФЛАГНУТО → `🚀 Active` як окремий блок (борг 14+ сесій, блокер для нових фіч)
4. Один мозок V2 Шар 3 → DONE (Стратег: SESSION_STATE підтверджує)
5. Council механізм → ROADMAP_DONE як інфраструктура
**Коміт:** `docs(roadmap): sync bOqdI + promote smoke-test`

## Фаза 7 — Дрібні фікси (один коміт, всі правки)
1. `.claude/commands/start.md:24` — «швидкий діалог» → «сигнали болю Роми»
2. `START_HERE.md:51` — прибрати `/obsidian` (об'єднано у `/finish` Фаза 9, файлу нема)
3. `_ai-tools/INDEX.md:169` — те саме `/obsidian`
4. `_ai-tools/SKILLS_PLAN.md:7` — «7 скілів написані» → «16 скілів написані (станом на 02.05.2026 bOqdI)»
5. `_ai-tools/INDEX.md:170-176` — додати 6 пропущених хуків (`pre-push-check`, `pre-commit-testing-log`, `check-estimate-without-read`, `lesson-reminder`, `i18n-reminder`, `start-self-test`)
6. `_ai-tools/RULES_TECH.md:45` — «47 tools» → «60 tools (станом на EhxzJ 30.04)»
7. `_ai-tools/INDEX.md:189` — «CLAUDE.md 94 рядки» → видалити точну цифру або оновити «118+»
8. `CLAUDE.md:70` — «Активний план рефакторингу» → «Архівний план g05tu (для довідки)»
9. Додати у `INDEX.md` рядок: «Великі задачі / 5 поглядів → CLAUDE.md секція 🧠 Council»
**Коміт:** `docs: fix 9 outdated references after bOqdI`

## Фаза 8 — Архівувати мертві файли з `_ai-tools/`
**`git mv` у `_archive/`:**
- `_ai-tools/REFACTOR_PLAN.md` (✅ завершено g05tu 20.04)
- `_ai-tools/REFACTORING_PLAN.md` (історичний)
- `_ai-tools/REFACTORING_FINANCE.md` (історичний)
- `_ai-tools/SUSPICIOUS_NOTES_Ph8ym.md` (тимчасовий, інфо у SESSION_STATE)
- `docs/OWL_SILENCE_PRUNING_PLAN.md` (✅ завершено xHQfi 30.04)

**Перевір перед архівацією:**
- `_ai-tools/BUGS_VERIFICATION.md` — створений qG4fj 25.04 для B-100..B-103. Якщо ці баги досі відкриті — лишити; якщо закриті — архів.
- `.claude/commands/owl-motion.md` — Оптиміст пропонує видалити, я НЕ роблю без явного «так» Романа. **Запитати перед діею.**
**Коміт:** `chore: archive 4 completed plans + verify BUGS_VERIFICATION status`

## Фаза 9 — `lessons.md` урок + push
**Урок 1:** «Council overengineering — 4 ітерації Gemini для простої ідеї». Перша версія була правильна, кожна ітерація додавала бюрократії яку довелось викинути. Принцип «менше = більше» підтверджений архівом.
**Урок 2 (новий, з цієї регресії):** «Правило `/finish` Phase 0 — архівацію перенесено на `/start` Крок 2.5 бо на `/finish` контекст вже забитий. Корінь — правило працює тільки коли контекст <75%. Тригер на свіжий контекст замість забитого.»
**Не забути:** CACHE_NAME bump НЕ потрібен (всі фази 1-9 — docs-only, `*.md`).
**Кінцеве:** `git push -u origin claude/start-session-{нова}` + видалити цей файл-план.
**Коміт:** `docs(lessons): bOqdI — Council overengineering + /finish→/start archival fix`

---

## Конфлікти між агентами (рішення прийняти у новому чаті)

1. **Об'єднати `RULES_COMMUNICATION` + `RULES_UI`?** Оптиміст: дублі 60 рядків. Моя позиція bOqdI: окремою сесією, не зараз (радикальна правка).
2. **Видалити `.claude/commands/owl-motion.md`?** Оптиміст: видалити (13+ днів відкладено + маскот видалено rSTLV). Моя позиція: запитати Романа.
3. **Council у HOT_RULES як 9-те правило?** Виконавець: додати. Моя позиція bOqdI: тільки у INDEX (HOT_RULES = 8 болючих, Council не «болюче правило» а механізм).

## Що звірити з агентами повторно (3 верифікатора впали у rate limit `resets 1:10pm UTC`)

- Чи `BUGS_VERIFICATION.md` ще актуальний (баги B-100..B-103 досі відкриті чи закриті?)
- Точний список «мертвих» файлів у `_archive/` (на швидкий ls — підозрілі: `NEVERMIND_ARCH.md`, `NEVERMIND_STATUS.md`, `decisions.md`, `РОМАН_ПРОГРЕС.md`, `CHANGES_OLD.md`, `SESSION_STATE_2026-04-13.md`)
- Чи план фази 4 (апдейт SESSION_STATE з 4 окремими діями) реально виконати одним комітом — можливо розбити на 4a+4b
