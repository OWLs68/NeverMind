# NeverMind — Журнал змін

> Кожна сесія Claude повинна додавати сюди запис після завершення роботи.
> Формат: дата, що зроблено, які файли змінено, чи є відкриті проблеми.
> Старіші записи → `_archive/CHANGES_OLD.md`

---

## 2026-04-05 — Gemini workflow + глобальний клінап документації

**Що зроблено:**

**Частина 1 — Gemini інтеграція (попередні коміти цієї сесії):**
- Видалено невдалий експеримент `_ai-tools/gemini-mcp/` (Railway MCP-сервер, 357 рядків Node.js, SSE transport) — причина згортання: засвітився `GEMINI_API_KEY` у чаті → secret scanner Anthropic заблокував сесію. Railway-проект видалений окремо Романом.
- Створено скіл `/gemini` — ручний workflow: Claude збирає контекст (CLAUDE.md + SESSION_STATE + git diff + змінені файли + питання), виводить одним код-блоком з кнопкою Copy, Роман копіює в застосунок Gemini на iPhone (модель Pro), повертає відповідь у чат.
- Оновлено модель у скілі з 2.5 Pro на 3 Pro (актуальна станом на 04.2026).
- **Перший реальний тест скіла** на `src/owl/board.js` + `src/owl/chips.js` — workflow працює. Gemini знайшов 3 цінні моменти + 1 галюцинацію яку Claude заарбітрував.

**Частина 2 — Клінап документації (основа цієї сесії):**

Виявлено що документація застрягла між двома епохами: на етапі 01.04 була реструктуризація docs (CHANGES.md, SESSION_STATE.md, CONCEPTS_ACTIVE.md, FEATURES_ROADMAP.md), після цього — ES-modules рефакторинг коду (app-*.js → src/core/, src/ai/, src/owl/, src/ui/, src/tabs/). **Тільки таблиця файлів у CLAUDE.md оновилась, всі інші docs продовжували посилатись на app-*.js.**

4 коміти клінапу:

1. `docs(bugs): consolidate NEVERMIND_BUGS.md, migrate to src/ paths`
   - Видалено дубль `_ai-tools/NEVERMIND_BUGS.md` (мій випадковий новий файл)
   - `NEVERMIND_BUGS.md` (корінь) — source of truth. 7 старих багів (B-03..B-12) оновлено на `src/` шляхи, позначено "потрібна верифікація" (деякі могли виправитись під час рефакторингу — Роман перевірить у наступній сесії).
   - Додано 3 нові баги знайдені через `/gemini`: **B-13** (🔴 апостроф у `onclick` чіпів, `src/owl/board.js`), **B-14** (🟡 `includes()` false positives, `src/owl/chips.js`), **B-15** (🟢 setTimeout magic number, `src/owl/chips.js`).
   - Секція wontfix з галюцинацією Gemini про `<msg.id>` — урок на майбутнє.
   - `/fix` скіл оновлено: правильний шлях (корінь), новий крок оновлення BUGS після фіксу.

2. `docs(CLAUDE.md): migrate stale refs to src/ + add documentation map`
   - Таблиця "Дані (localStorage)": 19 рядків оновлено (`app-inbox.js` → `src/tabs/inbox.js` тощо).
   - Секція "Що не можна змінювати": `app-core-system.js` → `src/core/boot.js`.
   - "Міжмодульні залежності": переписано діаграму під `src/` структуру з поясненням esbuild збірки.
   - **Нова секція "Карта документації"** — таблиці "Читати коли..." (12 файлів) і "Писати/оновлювати коли..." (11 сценаріїв). Мета: новий чат знаходить потрібне одним лукапом, без запитів "куди писати?".

3. `docs: rewrite START_HERE.md + docs/ARCHITECTURE.md for src/ structure`
   - **`START_HERE.md`** — повністю переписано. Був найкритичнішим застарілим: містив карту з 13 `app-*.js` файлів. Тепер показує справжню `src/` ієрархію (core/ai/owl/ui/tabs). Додано посилання на `/gemini` скіл.
   - **`docs/ARCHITECTURE.md`** — переписано діаграми (mermaid) під `src/` структуру: граф модулів з підгрупами, Inbox flow, storage map, OWL triggers, memory system, tabs integration. Уточнено legacy-назву `nm_gemini_key` (OpenAI ключ).
   - **`NEVERMIND_ARCH.md` → `_archive/NEVERMIND_ARCH.md`** — повністю застарілий дубль `docs/ARCHITECTURE.md` (містив `index.html` з 2600 рядків замість реальних 1475). Перенесено в архів.

4. `docs: update FEATURES_ROADMAP + DESIGN_SYSTEM + changelog entry` (цей коміт)
   - `FEATURES_ROADMAP.md`: 3 посилання `app-ai-chat.js`/`app-ai-core.js`/`app-inbox.js` → `src/owl/*`/`src/ai/core.js`/`src/tabs/inbox.js`.
   - `docs/DESIGN_SYSTEM.md`: `setupModalSwipeClose знаходиться в app-tasks-core.js` → `src/tabs/tasks.js`.
   - Цей запис у `docs/CHANGES.md`.

**Що НЕ чіпалось (свідомо):**
- `src/`, `index.html`, `style.css`, `sw.js`, `bundle.js` — жодних змін у коді
- `CACHE_NAME` — не оновлюємо, бо в PWA кеш не потрапляє нічого з цієї сесії
- `NEVERMIND_LOGIC.md`, `CONCEPTS_ACTIVE.md`, `РОМАН_ПРОФІЛЬ.md` — timeless концептуальні документи, без посилань на код
- `_archive/` — історія не редагується
- Правила процесу, якість виконання, AI-логіка, деплой, OWL концепція у `CLAUDE.md`

**Відкрите на майбутнє:**
- Виправити 3 реальні баги знайдені через `/gemini`: B-13 (критичний, апостроф), B-14 (design smell), B-15 (low pri) — окрема сесія через `/fix B-13`
- Верифікувати 7 старих багів B-03..B-12 проти `src/` — деякі могли бути виправлені під час рефакторингу
- Допрацювати `/gemini` скіл: 5 покращень (import graph, анти-галюцинаційні правила, підключення BUGS.md, повний CLAUDE.md, самооцінка Gemini) — окрема сесія

**Змінені файли:** `NEVERMIND_BUGS.md`, `CLAUDE.md`, `START_HERE.md`, `docs/ARCHITECTURE.md`, `docs/DESIGN_SYSTEM.md`, `docs/CHANGES.md`, `FEATURES_ROADMAP.md`, `.claude/commands/fix.md`, `.claude/commands/gemini.md` (новий), `_ai-tools/SESSION_STATE.md`, `_ai-tools/NEVERMIND_BUGS.md` (видалено), `_archive/NEVERMIND_ARCH.md` (перенесено з кореня), `_ai-tools/gemini-mcp/` (видалено — 5 файлів)

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
