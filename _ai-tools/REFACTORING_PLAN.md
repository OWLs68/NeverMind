# План рефакторингу NeverMind — ES Modules + esbuild

> Цей план написаний Claude який повністю знає поточну кодову базу.
> Новий чат: "Прочитай репо. Потім прочитай `_ai-tools/REFACTORING_PLAN.md`. Роби рефакторинг за планом."

---

## Мета

Перевести проект з 13 глобальних `<script>` тегів на ES Modules з бандлером esbuild. Це вирішує:
- Файли по 100-300 рядків замість 1000-1600
- Явні залежності (import/export) замість "хтось завантажив до мене"
- Порядок `<script>` тегів більше не важливий
- Один компонент ChatBar замість 8 копій
- Мініфікація → швидше завантаження

---

## КРИТИЧНІ ПРАВИЛА

1. **Один крок за раз.** Після кожного кроку — `node --check`, перевірка в браузері, коміт.
2. **НЕ переписувати логіку.** Тільки переносити код між файлами. Жодних "заодно покращимо".
3. **Зворотна сумісність.** Після кожного кроку додаток має працювати як раніше.
4. **sw.js STATIC_ASSETS** — оновлювати при кожному додаванні/видаленні файлу.
5. **index.html** — залишається ОДИН файл (не розбивати на кілька HTML).
6. **Тестувати:** відкрити в браузері → перевірити Inbox, задачі, OWL табло, чат-бар.

---

## Порядок виконання

### Крок 0: Підготовка esbuild

```bash
npm init -y
npm install --save-dev esbuild
```

Створити `build.js`:
```javascript
require('esbuild').buildSync({
  entryPoints: ['src/app.js'],
  bundle: true,
  outfile: 'bundle.js',
  format: 'iife',
  minify: false,  // поки false для дебагу
  sourcemap: true,
});
```

Створити `src/app.js` — точка входу (поки порожній).

Оновити `.github/workflows/auto-merge.yml` — додати крок збірки:
```yaml
- run: node build.js
```

Оновити `sw.js` STATIC_ASSETS — замінити 13 скриптів на один `bundle.js`.

Оновити `index.html` — замінити 13 `<script>` тегів на:
```html
<script src="bundle.js"></script>
```

**Коміт:** "build: esbuild setup, порожній bundle"

---

### Крок 1: Міграція app-core-nav.js → src/core/nav.js

Це ПЕРШИЙ файл бо від нього залежать всі інші.

1. Створити `src/core/nav.js`
2. Скопіювати ВСЕ з `app-core-nav.js`
3. Додати `export` до функцій які кличуть інші модулі:
   - `switchTab`, `showToast`, `applyTheme`, `getProfile`, `getSettings`
   - `currentTab` (як змінну)
4. В `src/app.js` додати: `import './core/nav.js'`
5. Зробити всі export також доступними глобально (перехідний період):
   ```javascript
   // В кінці nav.js — тимчасово, поки всі модулі не мігрують
   window.switchTab = switchTab;
   window.showToast = showToast;
   // і т.д.
   ```
6. Видалити `<script src="app-core-nav.js">` з index.html
7. Видалити `app-core-nav.js`
8. Тест: `node build.js && відкрити в браузері`

**Коміт:** "refactor: app-core-nav → src/core/nav.js (ES module)"

---

### Крок 2: Міграція app-core-system.js → розбити на 4 файли

Це найбільший файл (1408 рядків). Розбити на:

**src/core/boot.js** (~100 рядків):
- `bootApp()`, `setupSW()`, `setupKeyboardAvoiding()`
- PWA install prompt
- Cross-tab sync (`localStorage.setItem` override)

**src/core/trash.js** (~80 рядків):
- `addToTrash()`, `showUndoToast()`, `searchTrash()`, `restoreFromTrash()`
- `cleanOldTrash()`

**src/owl/board.js** (~300 рядків):
- `renderTabBoard()`, `_owlTabHTML()`, `_owlTabApplyState()`
- `toggleOwlTabChat()`, `collapseOwlTabToSpeech()`
- `owlTabSwipeStart/Move/End()`
- `scrollOwlTabChips()`, `_updateOwlTabChipsArrows()`
- `getTabBoardMsgs()`, `saveTabBoardMsg()`, `getTabBoardMsg()`

**src/owl/proactive.js** (~400 рядків):
- `generateTabBoardMessage()`, `tryTabBoardUpdate()`
- `getTabBoardContext()`, `checkTabBoardTrigger()`
- `getTabBoardSaid()`, табличка `tabLabels`

**src/owl/chips.js** (~50 рядків):
- `owlChipToChat()` з навігаційною логікою

**src/ui/swipe-delete.js** (~100 рядків):
- `applySwipeTrail()`, `resetSwipeTrail()`
- `SWIPE_DELETE_THRESHOLD`

**src/ui/keyboard.js** (~50 рядків):
- `setupKeyboardAvoiding()`

Кожен файл: `import` потрібне з інших модулів, `export` свої функції.
Тимчасово: `window.xxx = xxx` для ще не мігрованих модулів.

**Коміт:** "refactor: app-core-system → core/boot + core/trash + owl/* + ui/*"

---

### Крок 3: Міграція app-ai-core.js → src/ai/core.js

- `getAIContext()`, `callAI()`, `callAIWithHistory()`
- `getOWLPersonality()`
- `saveChatMsg()`, `loadChatMsgs()`, `restoreChatUI()`
- `openChatBar()`, `closeChatBar()`
- `CHAT_STORE_KEYS`, `CHAT_STORE_MAX`

**Коміт:** "refactor: app-ai-core → src/ai/core.js"

---

### Крок 4: Міграція app-ai-chat.js → розбити на 2 файли

**src/owl/inbox-board.js** (~500 рядків):
- `generateOwlBoardMessage()`, `getOwlBoardContext()`
- `checkOwlBoardTrigger()`, `owlCdExpired()`, `setOwlCd()`
- `getOwlBoardMessages()`, `saveOwlBoardMessages()`
- `renderOwlBoard()` (тонкий wrapper)
- `getDayPhase()`, `getSchedule()`
- `handleScheduleAnswer()`, `_owlAskScheduleIfNeeded()`

**src/owl/inbox-context.js** (~200 рядків):
- Cooldown система
- Board message history для промпту
- `updateOwlChipsArrows()`, `scrollOwlChips()`

Або якщо файли вийдуть < 400 рядків — можна об'єднати в один `src/owl/inbox-board.js`.

**Коміт:** "refactor: app-ai-chat → src/owl/inbox-board.js"

---

### Крок 5: Міграція вкладок (по одній!)

Кожна вкладка — окремий коміт:

1. `app-inbox.js` → `src/tabs/inbox.js`
2. `app-tasks-core.js` → `src/tabs/tasks.js`
3. `app-habits.js` → `src/tabs/habits.js`
4. `app-notes.js` → `src/tabs/notes.js`
5. `app-finance.js` → `src/tabs/finance.js`
6. `app-health.js` → `src/tabs/health.js`
7. `app-projects.js` → `src/tabs/projects.js`
8. `app-evening-moments.js` → `src/tabs/evening.js`
9. `app-evening-onboarding.js` → `src/tabs/onboarding.js`

Порядок важливий: inbox першим (від нього залежить processSaveAction), tasks другим (getTasks кличуть інші).

**Коміти:** "refactor: app-inbox → src/tabs/inbox.js" і т.д.

---

### Крок 6: Прибрати window.xxx

Після міграції ВСІХ файлів — видалити тимчасові `window.xxx = xxx`.
Замінити на правильні `import` в кожному файлі.

**Коміт:** "refactor: прибрано глобальні window.xxx, тільки ES imports"

---

### Крок 7: Видалити старі файли

- Перевірити що `bundle.js` генерується правильно
- Видалити всі `app-*.js` з кореню
- Оновити `sw.js` STATIC_ASSETS (тільки bundle.js)
- Оновити CLAUDE.md файлову структуру

**Коміт:** "cleanup: видалено старі app-*.js, оновлено документацію"

---

### Крок 8 (опціонально): Компонент ChatBar

Зараз кожна вкладка має свій чат-бар з дублюванням HTML і JS.
Створити `src/ui/chat-bar.js`:

```javascript
export function createChatBar({ tab, placeholder, onSend }) {
  // Генерує HTML чат-бару
  // Обробники: відкрити, закрити, відправити
  // Відновлення історії
}
```

Замінити 8 дублікатів в index.html на виклики `createChatBar()`.
Це зменшить index.html на ~200-300 рядків.

---

### Крок 9 (опціонально): HTML шаблони вкладок

Замінити статичний HTML вкладок на JS-генерацію:

```javascript
export function renderTabShell({ id, title, hasBoard }) {
  return `<div id="tab-${id}" class="tab-content">
    ${hasBoard ? `<div id="owl-tab-board-${id}"></div>` : ''}
    <div id="${id}-scroll" class="tab-scroll"></div>
  </div>`;
}
```

Це зменшить index.html з ~1600 до ~600 рядків.

---

## Фінальна структура

```
NeverMind/
  index.html          (~600 рядків — каркас + стилі inline)
  style.css           (~1300 рядків — без змін поки)
  bundle.js           (генерується esbuild)
  bundle.js.map       (source map для дебагу)
  sw.js               (service worker)
  build.js            (конфіг esbuild — 10 рядків)
  package.json        (одна залежність: esbuild)
  src/
    app.js            — точка входу, імпортує все
    core/
      nav.js          (~300) — switchTab, теми, settings
      boot.js         (~100) — PWA, cross-tab sync
      trash.js        (~80)  — кошик
      storage.js      (~50)  — localStorage helpers
    ai/
      core.js         (~300) — callAI, getAIContext, chat storage
    owl/
      board.js        (~300) — рендер, свайпи, стани
      proactive.js    (~400) — генерація, cooldowns, контекст
      chips.js        (~50)  — owlChipToChat, навігація
      inbox-board.js  (~500) — OWL Inbox специфіка
    tabs/
      inbox.js        (~400) — sendToAI, processSaveAction
      tasks.js        (~350) — CRUD, кроки, чат
      habits.js       (~500) — build + quit, стріки
      notes.js        (~450) — нотатки, папки, чат
      finance.js      (~450) — фінанси, бюджет, коуч
      health.js       (~250) — здоров'я
      projects.js     (~350) — проекти, воркспейс
      evening.js      (~400) — моменти, підсумок
      onboarding.js   (~400) — онбординг, guide
    ui/
      chat-bar.js     (~150) — один компонент для всіх вкладок
      swipe-delete.js (~100) — swipe to delete
      keyboard.js     (~50)  — keyboard avoiding
```

---

## Оцінка ризиків

| Ризик | Ймовірність | Що робити |
|-------|-------------|-----------|
| Зламається порядок ініціалізації | Висока | `window.xxx` як перехідний крок (Крок 6 прибирає) |
| esbuild не підтримує щось | Низька | esbuild підтримує 99% ES2020+ |
| Service Worker кешує старий код | Середня | Змінювати CACHE_NAME при кожному кроці |
| GitHub Actions не збирає | Низька | Додати `npm ci && node build.js` перед деплоєм |
| iOS Safari баги з modules | Нульова | esbuild генерує звичайний JS, не ES modules |

---

## Що НЕ змінюється

- `localStorage` структура даних — без змін
- `sw.js` логіка — без змін (тільки STATIC_ASSETS)
- `style.css` — без змін (рефактор стилів — окрема задача)
- `index.html` базова розмітка — без змін (кроки 8-9 опціональні)
- AI промпти — без змін
- Вся бізнес-логіка — без змін, тільки переміщення між файлами

---

## Перший рядок для нового чата

```
Прочитай репо. Потім прочитай _ai-tools/REFACTORING_PLAN.md і виконуй рефакторинг за планом, по одному кроку за раз. Після кожного кроку — коміт і перевірка.
```
