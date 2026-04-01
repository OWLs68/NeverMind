# NeverMind — Журнал змін

> Кожна сесія Claude повинна додавати сюди запис після завершення роботи.
> Формат: дата, що зроблено, які файли змінено, чи є відкриті проблеми.
> Старіші записи → `_archive/CHANGES_OLD.md`

---

## 2026-04-01 — Реструктуризація документації

**Що зроблено:**
- `CLAUDE.md` переписано: всі правила з 5 файлів зведено в одне місце + 2 нові правила якості (CSS верифікація, діагностика перед ретраєм)
- `START_HERE.md` спрощено: mandatory reading = SESSION_STATE + BUGS (~80 рядків замість 192)
- `_ai-tools/SESSION_STATE.md` розширено: версія, гілка, останні сесії, відкриті баги
- `_archive/` створено: РОМАН_ПРОГРЕС.md, decisions.md, NEVERMIND_STATUS.md, CHANGES_OLD.md
- `ШПАРГАЛКА_CLAUDE.md` видалено (гайд для Романа, не для Claude)
- `NEVERMIND_LOGIC.md` очищено: тільки концепція + OWL принципи (без правил)
- `CONCEPTS_ACTIVE.md` + `FEATURES_ROADMAP.md` створено (розділено з NEVERMIND_CONCEPTS.md)

**Змінені файли:** `CLAUDE.md`, `START_HERE.md`, `_ai-tools/SESSION_STATE.md`, `NEVERMIND_LOGIC.md`, `CONCEPTS_ACTIVE.md` (новий), `FEATURES_ROADMAP.md` (новий), `_archive/*`

---

## 2026-04-01 — B-11/B-12: фікс padding в модалках + крок фону

**Що зроблено:**
- `index.html` рядок ~957: `padding:0 20px` на outer panel (`overflow:hidden`) модалки задачі
- `index.html` рядок ~1129: `padding:0 20px` на outer panel модалки звички
- `app-tasks-core.js` рядок 116: фон кроків задачі → `rgba(255,255,255,0.7)` з бордером (як поля вводу)
- `docs/DESIGN_SYSTEM.md`: задокументовано структуру модального вікна і ⚠️ типову помилку з padding
- **Ключовий інсайт:** padding треба ставити на outer `overflow:hidden` елемент, не на inner `overflow-y:auto`
- `sw.js`: CACHE_NAME → `nm-20260401-0720`

**Змінені файли:** `index.html`, `app-tasks-core.js`, `docs/DESIGN_SYSTEM.md`, `sw.js`

---

## 2026-04-01 — Фікс deploy pipeline v2: deploy прямо в auto-merge.yml

**Що зроблено:**
- `.github/workflows/auto-merge.yml`: додано job `deploy` (needs: merge). Тепер merge і deploy — один workflow, без крос-workflow тригерів.
- `.github/workflows/deploy.yml`: прибрано `workflow_run` тригер. Залишено тільки `push: main` (резерв для хотфіксів).
- `sw.js`: CACHE_NAME → `nm-20260401-0448`.
- **Причина:** `workflow_run` ненадійний — GitHub часто пропускає/затримує ці події.

**Змінені файли:** `.github/workflows/auto-merge.yml`, `.github/workflows/deploy.yml`, `sw.js`

---

## 2026-03-31 — Deploy pipeline fix: GitHub Pages не оновлювався

**Що зроблено:**
- `.github/workflows/deploy.yml`: додано `workflow_run` тригер на завершення `auto-merge.yml`.
- Додано умову `if: success`, `ref: main` в checkout.
- `sw.js`: CACHE_NAME → `nm-20260331-1846`.

**Змінені файли:** `.github/workflows/deploy.yml`, `sw.js`

---

## 2026-03-31 — B-10: чат авто-розгортається при переключенні на Inbox

**Що зроблено:**
- `app-core-nav.js`: видалено блок `// Inbox чат завжди відкритий` в `switchTab()`. Тепер стан чату зберігається як є.

**Змінені файли:** `app-core-nav.js`, `sw.js`

---

## 2026-03-31 — B-07/B-08 + надійне оновлення iOS PWA

**Що зроблено:**
- `app-tasks-core.js`: B-07 — крок ставить галочку тільки якщо тач рухнувся < 10px (тап, не свайп)
- `app-tasks-core.js`: B-08 — `toggleTaskStep()` повертає `task.status = 'active'` якщо не всі кроки виконані
- `app-core-system.js`: iOS PWA — переписано `setupSW()`: синхронна реєстрація, `pageshow` для bfcache, `location.replace()` замість `reload()`

**Змінені файли:** `app-tasks-core.js`, `app-core-system.js`, `sw.js`

---

## Шаблон для нового запису

```
## YYYY-MM-DD — Короткий опис сесії

**Що зроблено:**
- ...

**Змінені файли:** file1.js, file2.js
```
