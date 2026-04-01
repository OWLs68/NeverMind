# NeverMind — Журнал змін

> Кожна сесія Claude повинна додавати сюди запис після завершення роботи.
> Формат: дата, що зроблено, які файли змінено, чи є відкриті проблеми.

---

## 2026-04-01 — B-11/B-12: фікс padding в модалках задачі і звички

**Що зроблено:**
- `index.html` рядки 958, 1129: `padding:28px 48px calc(...)` → `padding:28px 20px calc(...)` в inner wrapper обох модалок
- `sw.js`: CACHE_NAME оновлено до `nm-20260401-0544`

**Змінені файли:** `index.html`, `sw.js`

---

## 2026-04-01 — Фікс deploy pipeline v2: прибрано workflow_run, deploy прямо в auto-merge.yml

**Що зроблено:**
- `.github/workflows/auto-merge.yml`: додано другий job `deploy` (needs: merge). Тепер merge і deploy — один workflow, без крос-workflow тригерів.
- `.github/workflows/deploy.yml`: прибрано `workflow_run` тригер. Залишено тільки `push: main` (резерв для хотфіксів).
- `sw.js`: CACHE_NAME оновлено до `nm-20260401-0448`.
- **Причина зміни:** `workflow_run` ненадійний — GitHub часто пропускає/затримує ці події. Два окремі workflows не гарантують деплой після мержу.

**Змінені файли:** `.github/workflows/auto-merge.yml`, `.github/workflows/deploy.yml`, `sw.js`

---

## 2026-03-31 — Фікс deploy pipeline: GitHub Pages не оновлювався

**Що зроблено:**
- `.github/workflows/deploy.yml`: додано `workflow_run` тригер на завершення `auto-merge.yml`. Причина: GitHub Actions блокує запуск воркфлоу від `GITHUB_TOKEN` пушів (захист від нескінченних петель). `auto-merge.yml` пушив у `main` через `GITHUB_TOKEN` → `deploy.yml` ніколи не отримував push event → GitHub Pages не оновлювалось.
- Додано умову `if: success` щоб не деплоїти при провалі auto-merge.
- Додано `ref: main` в checkout щоб гарантовано взяти найсвіжіший коміт.
- `sw.js`: CACHE_NAME оновлено до `nm-20260331-1846`.

**Змінені файли:** `.github/workflows/deploy.yml`, `sw.js`

---

## 2026-03-31 — B-11/B-12 фінальний фікс: inner wrapper для iOS padding

**Що зроблено:**
- `index.html`: обидві модалки (задача, звичка) — outer panel тепер `overflow:hidden` без padding; inner div `overflow-y:auto` з `padding:28px`. Це вирішує iOS Safari баг де padding ігнорується на `overflow:auto` елементі.
- Також створено `docs/DESIGN_SYSTEM.md` — дизайн-система з описом, поведінкою та HTML-шаблонами компонентів.

**Змінені файли:** `index.html`, `sw.js`, `docs/DESIGN_SYSTEM.md`

---

## 2026-03-31 — Баг B-10: чат авто-розгортається при переключенні на Inbox

**Що зроблено:**
- `app-core-nav.js`: видалено блок `// Inbox чат завжди відкритий` в `switchTab()` — він примусово додавав `open` клас при кожному переключенні на Inbox. Тепер стан чату зберігається як є.

**Чому:** при переключенні з будь-якої вкладки на Inbox чат розгортався на весь екран навіть якщо до цього був закритий.

**Змінені файли:** `app-core-nav.js`, `sw.js`

---

## 2026-03-31 — Баги B-07/B-08 + надійне оновлення iOS PWA

**Що зроблено:**
- `app-tasks-core.js`: B-07 — крок в задачі тепер ставить галочку тільки якщо тач рухнувся < 10px (тап), а не свайп/скрол. Логіка: `ontouchstart` зберігає координати, `ontouchend` порівнює рух
- `app-tasks-core.js`: B-08 — `toggleTaskStep()` тепер повертає `task.status = 'active'` якщо не всі кроки виконані (раніше картка лишалась перекресленою після зняття галочки)
- `app-core-system.js`: iOS PWA оновлення — переписано `setupSW()`: `visibilitychange` і `pageshow` реєструються синхронно (до `.then()`) через `_swReg`; додано `pageshow` для bfcache; `updatefound → statechange → activated` як резервний механізм; `location.replace()` замість `reload()` (надійніше в iOS standalone)

**Чому:** B-07 — свайп по карточці ставив галочку на кроці. B-08 — зняття галочки не відновлювало картку. iOS PWA не оновлювалась після деплою через race condition між `visibilitychange` і `register().then()`.

**Змінені файли:** `app-tasks-core.js`, `app-core-system.js`, `sw.js`

---

## 2026-03-31 — Підготовка до Supabase: NM_KEYS, runMigrations, _fetchAI

**Що зроблено:**
- `app-core-system.js`: додано `NM_KEYS` — центральний реєстр всіх localStorage ключів (розбито на data/settings/chat/cache/patterns)
- `app-core-system.js`: додано `runMigrations()` — запускається в `init()`, добиває `dueDate` і `priority` в старих задачах (потрібно для Календаря)
- `app-core-nav.js`: `clearAllData()` тепер використовує `NM_KEYS` замість хардкодованого списку
- `app-ai-core.js`: витягнуто `_fetchAI()` — HTTP запит до OpenAI в одному місці; `callAI` і `callAIWithHistory` спрощено

**Чому:** підготовка до Supabase — щоб міграція не зламала нічого. Нові ключі тепер достатньо додати в `NM_KEYS.data`. Після Supabase — тільки `_fetchAI` потребує зміни URL.

**Змінені файли:** `app-core-system.js`, `app-core-nav.js`, `app-ai-core.js`, `sw.js`

---

## 2026-03-30 — UI фікси + онбординг редизайн

**Що зроблено:**
- `style.css`: риска в чат-handle → біла; підказка над input коли чат закрито → темна риска `::before`
- `style.css`: уніфіковано кольори input-box і tab-board → `rgba(15,10,22,0.72)` (як чат-вікно)
- `app-core-nav.js`: `clearAllData()` → `reload()` через 800мс; додано `nm_quit_log`, `nm_folders_meta`, `nm_chat_health`, `nm_chat_projects`
- `app-core-system.js`: iOS PWA — `visibilitychange` → `reg.update()` (фікс "відновлення з фону")
- `index.html`: онбординг — фіолетова палітра → тепла кремова. Фон `#f5f0e8`, акцент `#c2790a`, кнопки темні

**Змінені файли:** `style.css`, `app-core-nav.js`, `app-core-system.js`, `index.html`, `sw.js`

---

## 2026-03-29 — Inbox чат 3-стейт + фікс деплою

**Що зроблено:**
- `app-ai-chat.js`, `app-ai-core.js`, `app-core-system.js`: inbox чат переведено на ту саму 3-стейтну систему що й інші вкладки (закрито → A compact → B full). Видалено `inboxChatExpanded`, `inboxCompactH`, `getInboxExpandHeight()` (~150 рядків)
- `.github/workflows/auto-merge.yml`: додано `-X theirs` до merge (вирішення конфліктів на користь feature-гілки). Прибрано sed для sw.js (Claude оновлює CACHE_NAME локально)
- `CLAUDE.md`: додано розділ "Система деплою" з поясненням архітектури CI і причини `-X theirs`
- `app-ai-core.js`: виправлено `openChatBar()` і `closeChatBar()` — inbox тепер обробляється однаково з іншими вкладками

**Змінені файли:** `app-ai-chat.js`, `app-ai-core.js`, `app-core-system.js`, `sw.js`, `.github/workflows/auto-merge.yml`, `CLAUDE.md`, `docs/CHANGES.md`

**Корінь проблеми деплою:** і Claude, і CI модифікували `sw.js` → конфлікт при merge → CI падав тихо. Фікс: `-X theirs` + CI не чіпає sw.js.

---

## 2026-03-29 — Реструктуризація: CSS винесено в style.css

**Що зроблено:**
- Вирізано `<style>` блок (1128 рядків) з `index.html` → новий файл `style.css`
- `index.html` замінено на `<link rel="stylesheet" href="style.css">` (2698 → 1570 рядків)
- `sw.js`: додано `./style.css` в `STATIC_ASSETS`, оновлено `CACHE_NAME` → `nm-20260329-0000`

**Змінені файли:** `style.css` (новий), `index.html`, `sw.js`

**Відкриті задачі:**
- [ ] Варіант Б: SVG іконки → `app-icons.js` (якщо потрібно)

---

## 2026-03-28 — Документація і реструктуризація

**Що зроблено:**
- Створено `CLAUDE.md` — повний контекст проекту для нових сесій
- Створено `docs/ARCHITECTURE.md` — 6 Mermaid-діаграм системи
- Проведено повний аудит проекту (13 JS файлів, SW, index.html)
- Відкочено невдалий рефакторинг `app-db.js` (централізований localStorage) — зламав застосунок через видалення локальних функцій без оновлення викликів
- Відкочено невдалий рефакторинг CSS/іконок — зламав через відсутність нових файлів у SW кеші
- `main` повернуто до стабільного стану `a8ae6cb`

**Змінені файли:** `CLAUDE.md` (новий), `docs/ARCHITECTURE.md` (новий), `docs/CHANGES.md` (новий)

**Відкриті задачі:**
- [ ] Реструктуризація index.html: винести CSS → `style.css`, SVG → `app-icons.js` (з правильним оновленням SW)
- [ ] Перевірити чи нотатки відображаються після відкату (проблема з SW кешем у браузері користувача)

---

## Шаблон для нового запису

```
## YYYY-MM-DD — Короткий опис сесії

**Що зроблено:**
- ...

**Змінені файли:** file1.js, file2.js

**Відкриті задачі:**
- [ ] ...
```
