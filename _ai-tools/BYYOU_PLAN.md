# BYYOU_PLAN — активний потік /byyou

> **Що це:** жива оперативна памʼять одного потоку `/byyou`. Переживає обрив чату — `/byyou` без аргументу читає цей файл і продовжує з місця.
> **Чим НЕ є:** не документація і не лог рішень. Довгі «чому» рішення → `docs/adr/`. Хроніка сесії → `_ai-tools/SESSION_STATE.md`.

---

**Статус:** active
**Ціль:** Фіча **Списки в Inbox** — окрема сутність `nm_lists` (НЕ задача). «Склади список: X, Y, Z» → картка-чекліст прямо в стрічці Inbox, нуль слідів у Задачах. Варіант A (рішення Романа). Детермінований маршрут + guard.
**Гілка:** claude/new-session-v3pexs
**Мітка відкату:** byyou-start-lists
**Оновлено:** 2026-06-27

> **Council 5 поглядів (Sonnet) відпрацював** — карта інтеграції з якорями file:line. Ключові міни: `prompts.js:517-518` зараз вчить «список→save_task»; `autoGenerateTaskSteps` (tasks.js:585) ріже назву на кроки — обидві знешкодити. Рішення Романа: окреме `nm_lists`, список ≠ задача.
> **Статуси:** `idle` · `active` (push заблоковано до «деплой») · `paused` · `done`.

---

## Кроки

| # | Крок | Маркер | Статус | Коміт |
|---|------|--------|--------|-------|
| 1 | **Фундамент даних.** `makeList({title,items})` у `entity-factories.js` (stampEntity конверт) + `nm_lists` у реєстр `NM_KEYS` (clearAllData/backup) + новий `src/tabs/lists.js` з `getLists/saveLists` (канонічний сеттер, структурний `nm-data-changed {type:'list',action,id}`). supabase-prep-сумісно. | 🔴→OK(A) | ⬜ | — |
| 2 | **Детермінований детект** `src/data/list-detector.js` (правило 12): тригери «список:», «купити:», перелік через кому/новий рядок/«1.» → `{title, items[]}`. Pure-function + контракт-тест `check-list-detector.js`. | 🟢 | ⬜ | — |
| 3 | **Guard `dropTaskOnList`** у `dispatcher-guards.js` + у ланцюг `applyAllGuards` (після dropTaskOnComplete). Якщо AI видав save_task на список-намір → скидає save_task. Розширити `check-guards`. | 🟢 | ⬜ | — |
| 4 | **DRY-хелпер** `src/ui/checklist.js` `renderChecklist(items, opts)` — винести інлайн-рендер квадратиків з `tasks.js:301-306`, спрямувати tasks на нього (2 споживачі). Перевірити що задачі не зламані. | 🟢 | ⬜ | — |
| 5 | **AI tools** `save_list`+`delete_list` у `INBOX_TOOLS` (`prompts.js`) + **переписати §СПИСОК (517-518 міна)**: список→save_list, задача-з-діями→save_task + рядок у quick-таблицю (507) + заблокувати `autoGenerateTaskSteps` для списків. | 🟡 | ⬜ | — |
| 6 | **Маршрут (єдині точки).** `action-mapper.js` case save_list + синк дубля `inbox.js _toolCallToAction` + `processUniversalAction` create_list/delete_list (habits.js) + action-log POST_RESULT_STORAGE + action-reversers (undo save_list→delete_list). | 🟢 | ⬜ | — |
| 7 | **Рендер у Inbox.** `CAT_META/CAT_DOT_SOLID/CAT_TAG_STYLE` ключ `list` (inbox.js) + гілка картки-чеклісту у `renderInbox` (через renderChecklist) + `attachSwipeDelete`. | 🟢 | ⬜ | — |
| 8 | **Взаємодія.** `toggle-list-item` у `delegation.js` + `window.toggleListItem` у lists.js (тап галочки → persist + re-render + структурний dispatch). | 🟢 | ⬜ | — |
| 9 | **E2E** `tests/e2e/lists.spec.js` (правило 13): список → картка з квадратиками в Inbox, НЕ в Задачах; тап галочки persist; reload виживає. | 🟢 | ⬜ | — |
| 10 | **Pre-flight** (усі check-*.js + node --check + playwright --list) + bump CACHE + реліз-нотатки + iPhone-смоук-лист. | 🟢 | ⬜ | — |

> **Маркери:** 🟢 GO · 🟡 ТВІЙ ХІД (смоук) · 🔴 СТОП. Крок 1 чіпає схему (новий storage-ключ) — Роман схвалив варіант A на брамі, тож проходить.

---

## Зупинки і рішення Романа

| Крок | Питання | Рішення | Дата |
|------|---------|---------|------|
| старт | Сутність списку: окреме `nm_lists` (A) чи inbox-картка-носій (B)? | **A — окреме `nm_lists`** (Supabase-чисто) | 27.06 |
| старт | План 10 кроків — стартуємо? | чекаю ОК | 27.06 |

---

## Де зупинились

**Поточний крок:** 0 — брама старту (план показано, чекаю ОК)
**Причина:** NEW потік (списки в Inbox), Council відпрацював, варіант A обрано.
**Наступна дія:** після ОК — мітка `byyou-start-lists` + крок 1 (фундамент даних). Деплою немає до слова «деплой».
