# Стан сесії

> **Правило ротації:** у файлі детально описані **2 останні активні сесії**.
> При виклику `/finish` у новій сесії — найстарша з 2 переноситься у [`_archive/SESSION_STATE_archive.md`](../_archive/SESSION_STATE_archive.md).
> Попередні сесії до uDZmz — в архіві (w3ISi, VJF2M, Vydqm, FMykK, 14zLe, KTQZA, gHCOh, cnTkD, hHIlZ, W6MDn, VAP6z, acZEu, E5O3I, 3229b, 6v2eR, jMR6m).

**Оновлено:** 2026-04-19 (сесія **rSTLV** — повний відкат маскот-сови до емодзі 🦉)

---

## ⚠️ ДЛЯ НОВОГО ЧАТУ — найважливіше

**1. МАСКОТ-СОВА ВИДАЛЕНА ПОВНІСТЮ.** У сесії rSTLV Роман попросив стерти все з OWL-маскота (sprite/PNG/flipbook/SVG-крило/state-machine) — анімація важка, відкладаємо. Inbox повернуто до простого емодзі 🦉 як на інших вкладках. **Детальний перелік що і звідки видалено + таблиця історичних комітів** → `docs/CHANGES.md` 19.04 (сесія rSTLV).

**2. БІЛЬШЕ НЕМА:** `assets/owl/` (11 PNG), `handoff/` (документи + React/HTML приклади), `.owl-mascot` CSS, `setOwlMascotState` JS, boot auto-trigger greeting, 4 hook у `_fetchAI`.

**3. CACHE_NAME АКТУАЛЬНЕ:** `nm-20260419-1131`. При наступній зміні коду — оновити (`date +"nm-%Y%m%d-%H%M"`).

**4. AGENT КЕРУЄ UI (4.17)** — 8 UI tools у `src/ai/ui-tools.js`. Довідник → `docs/AI_TOOLS.md`.

**5. Файли >250 рядків — skeleton+Edit.** Checkpoint-коміт після КОЖНОЇ логічної фази.

**6. Workflow Романа:** "Роби" → один таск → звіт → пропозиція наступного → чекати.

**7. Ти САМ викликаєш скіли за тригер-фразами.** Тригери у `_ai-tools/SKILLS_PLAN.md`.

**8. Повернення до анімації — лише коли буде якісний художній ассет** (багатошарова SVG або Rive-файл) + ресурс на впровадження. До того — текстовий 🦉 скрізь.

---

## 🔧 Сесія rSTLV — Повний відкат маскот-сови до емодзі 🦉 (19.04.2026)

### Зроблено

**1. Видалення коду маскот-системи — коміт `897bc9a`**
- `index.html:275-287` — блок `.owl-mascot` з 10 `<img>` замінено на простий `<div class="owl-speech-avatar">🦉</div>`
- `style.css:1271-1356` — прибрано ~85 рядків: `.owl-mascot`, `.owl-mascot-frame`, `.owl-wave-frame`, `@keyframes owl-float/owl-head-tilt/owl-wave-1..5`, `.is-paused`, prefers-reduced-motion
- `src/owl/board.js:139-202` — прибрано виклик `setOwlMascotState('alert', 12000)` у `_renderTabBoard` + весь priority state-machine блок (OWL_PRIORITY, ticket, failsafe, visibilitychange listener, window export)
- `src/core/boot.js:398-401` — прибрано `setTimeout` з greeting-тригером (6 сек one-shot)
- `src/ai/core.js _fetchAI` — прибрано 4 виклики `setOwlMascotState` (thinking/error/idle/error) + зовнішній try/catch
- Видалено 11 PNG у `assets/owl/` + вся папка `assets/`
- `sw.js:10` — CACHE_NAME `nm-20260419-1044` → `nm-20260419-1131`

**2. Видалення handoff + оновлення документації — коміт `<наступний>`**
- `handoff/` повністю (README.md, OWL_ANIMATION_PLAN_V2.md, OWL_ANIMATION_RESEARCH.md, components/Owl.html/.js/.jsx/.css)
- `CLAUDE.md` секція "Анімація OWL" скорочена до 2 рядків (статус "відкладено")
- `ROADMAP.md` — два блоки Done 19.04 (NFtzw + uDZmz) замінено на один запис rSTLV
- `docs/CHANGES.md` — детальний аудит-запис з повним переліком того що і звідки видалено + таблиця історичних комітів для відновлення
- `_ai-tools/SESSION_STATE.md` — оновлено заголовок і секцію "Для нового чату"

### Ключові рішення

- **Повне видалення, не половинчасте** — Роман прямо сказав "стерти все нахуй", включно з попутними налаштуваннями (priority state-machine, visibilitychange pause, head-tilt, boot auto-trigger). Все це виросло з маскот-концепту і без маскота — мертвий код.
- **Документація детально збережена** — у `docs/CHANGES.md` таблиця з 13 історичних комітів з інструкцією як відновити будь-який шматок (`git revert`, `git cherry-pick`, `git checkout <hash> -- <path>`). На випадок "раптом щось зламається".
- **Скіл `/owl-motion` НЕ видалено** — лежить у `.claude/commands/` як заготовка на випадок повернення.
- **handoff/ повністю видалено** — це документи для інтеграції React-компоненту сови, мертві без самого маскота.

### Метрики

- **Коміти:** `897bc9a` (код+ассети) + `<наступний>` (handoff+docs). **2 коміти.**
- **Гілка:** `claude/start-session-rSTLV`
- **Версії:** v285 → v286+ (після деплою)
- **CACHE_NAME:** `nm-20260419-1131`
- **Файлів видалено:** 15 (11 PNG + 4 handoff top-level + 4 handoff/components) = 19
- **Файлів змінено:** 6 (index.html, style.css, sw.js, src/owl/board.js, src/core/boot.js, src/ai/core.js)
- **Рядків видалено:** ~650 коду + ~200 документів = **~850 рядків**

### Наступні кроки

- Деплой v286+ → переконатись що Inbox виглядає як інші вкладки (просто 🦉)
- Наступна задача: **Вечір доробка** (варіант A) або **Проекти** (B) — обрати після тесту деплою

---

## 🔧 Сесія NFtzw — Research + V2 план + Phase 0 flipbook skeleton (19.04.2026, ВІДКОЧЕНА rSTLV)

### Зроблено

**1. Глибоке дослідження анімаційних підходів — коміт `f16685b`**
- Файл `handoff/OWL_ANIMATION_RESEARCH.md` (177 рядків). Порівняння CSS/PNG vs Lottie vs Rive + індустріальні джерела (Duolingo перехід з Lottie на Rive, file-size 5MB→50KB, FPS 17→60).
- 3 початкові tier'и: PNG доробка (6/10), Lottie (6/10, не рекомендую), Rive через Fiverr ($100-200, 9/10).

**2. V2 план — самостійний шлях з Nano Banana — коміт `af90d41`**
- Файл `handoff/OWL_ANIMATION_PLAN_V2.md` (219 рядків). Принципи: усе самі, AI-сервіси як інструменти, **покадрова анімація основний шлях**, Rive learning — паралельний трек.
- 4 фази: 0 стабілізація, 1 Nano Banana покадрово (22 кадри на 4 анімації), 2 вторинна анімація завжди (дихання/кліпання), 3 Rive editor learning.
- Base prompt + 8 add-on промптів для кожного кадру махання крилом.

**3. Фаза 0 у коді — коміти `6266c17` + `7e5b479`**
- Прибрано debug SVG-крило з `style.css` (червона дашована рамка + `@keyframes wing-wave-premium`) і `<svg class="owl-wing-overlay">` з `index.html:282-284`.
- Додано 5 `<img class="owl-wave-frame" data-wave="1..5">` у `.owl-mascot` — чекають на `assets/owl/wave/frame-{1..5}.png`.
- CSS `@keyframes owl-wave-1..5` + `steps(1,end)` 600мс — кожен кадр по 120мс, жорсткий стрибок без блендингу.
- Fallback: статичний `owl-greeting.png` не ховається — показується коли wave-PNG відсутні, перекривається коли завантажені (z-index: 2).
- `CACHE_NAME`: `nm-20260419-0438` → `nm-20260419-0918`.

### Обговорено (без виконання)

- **Compound degradation у Nano Banana** — якість падає з кожною послідовною правкою. Рішення: завжди оригінал idle.png як референс, новий чат для кожного кадру.
- **Bg-removal tools:** `erase.bg` (топ — 5000×5000, безкоштовно, без кредитів), Photoroom (iOS app), Adobe Express. НЕ `remove.bg` (ріже до 500px без платної), НЕ Canva (Pro only), НЕ Claude Design (артефакти).
- **Промпт-хак "green screen":** просити Nano Banana чорний/зелений фон, потім erase.bg чистить ідеально.
- **Gap-fill кадри:** якщо у Романа буде 8 замість 5 — 3 додаткові add-on промпти (wing 15°, 30°, 80% squint transitional) — у чаті.
- **Rive learning — паралельний трек** на ноутбуці (editor не працює на телефоні), 3-4 сесії по 45 хв.

### Ключові рішення

- **Відмовились від зовнішнього дизайнера ($100-200 Fiverr).** Вчимось самі з Nano Banana — Роман прямо попросив "побудуй план де ми самі навчимося і зробимо все самі з допомогою сервісів".
- **Відмовились від Lottie** — безкоштовних owl-анімацій у amber-палітрі немає, ініціатива без реального покращення.
- **Відмовились від SVG-крила overlay** — живе SVG на статичній PNG ріже око (uDZmz підтвердив).
- **Покадрова PNG — основний шлях**, Rive — майбутнє/опціонально.
- **Fallback у CSS greeting** — не ховати статичний PNG, щоб broken-img не давав порожнечу.

### Інциденти

- **2× stream idle timeout** під час запису першої версії `OWL_ANIMATION_RESEARCH.md` — перейшов на skeleton+Edit підхід, третя спроба з компактнішим Write (177 рядків) спрацювала.
- **Гілка нестандартного формату** — `claude/owl-animation-research-NFtzw` замість `claude/start-session-NFtzw` (Claude Code runtime створив під задачу). Суфікс NFtzw використовую як session ID.
- **Stop hook наполягав на push** після Фази 0 — пофіксив через додавання fallback (статичний greeting не ховається при broken wave-PNG), пушнув без ризику порожнечі на продакшені.
- Без reset/force push. 4 коміти чистих.

### Оновлення після першого /finish (повторний виклик)

- **`adf508f` fix path:** Роман залив 5 PNG без `wave/` префіксу у `assets/owl/`. Замість переробки upload — виправлено HTML на `src="assets/owl/frame-{1..5}.png"`. CACHE_NAME bump `nm-20260419-0918` → `nm-20260419-1044`.
- **Роман залив 5 PNG** через GitHub Web (коміт `215a8f7 Add files via upload`).
- **Деплой v284** на `main` (12:45) — підтверджено `git fetch`.
- **ТЕСТУВАННЯ НА ТЕЛЕФОНІ v284:** сова залишається idle, **махання не спрацьовує**. Виявлено дві проблеми:
  1. Priority state-machine блокує greeting (гіпотеза: alert=80 перебиває greeting=40 boot-тригер)
  2. Шахові клітинки ліворуч від сови — запечений шаховий фон у PNG (не прозорість)

### Метрики

- **Коміти:** `f16685b` → `af90d41` → `6266c17` → `7e5b479` → `c59eacd` (docs) → `bdd610e` (docs) → `adf508f` (path fix). **7 комітів сесії** + коміт Романа `215a8f7` з 5 PNG.
- **Гілка:** `claude/owl-animation-research-NFtzw` (нестандартний формат)
- **Версії:** v277 → v284 на production
- **CACHE_NAME:** `nm-20260419-1044`
- **Build:** чистий (локальний `node build.js` зелений)
- **Нові файли:** `handoff/OWL_ANIMATION_RESEARCH.md`, `handoff/OWL_ANIMATION_PLAN_V2.md`, `assets/owl/frame-{1..5}.png` (від Романа)

---

## 🔧 Сесія uDZmz — Priority state-machine + SVG-крило + нові PNG сови (19.04.2026)

### Зроблено

**1. Priority state-machine сови (Крок 1) — коміт `5ed8d05`**
- Замінено `setOwlMascotState` у `src/owl/board.js`: додано `OWL_PRIORITY` (error=100 > alert=80 > thinking=60 > greeting=40 > idle=0). Нижчий пріоритет не перебиває вищий — **вирішує w3ISi пункт 2 (greeting↔alert конфлікт)**.
- **Ticket-лічильник `_owlMascotTicket`** + **failsafe 30 сек** для станів без autoRevertMs. Реверт у idle — лише якщо за час таймера не було нового виклику (захист від race condition при швидких переключеннях).
- `visibilitychange` listener додає клас `.is-paused` на `#owl-mascot-main` коли PWA у фоні → CSS `animation-play-state: paused !important` зупиняє всі дочірні анімації. Економія батареї.

**2. SVG-крило overlay замість sprite-sheet (Крок 2) — коміт `585cbbd`**
- Видалено `<div class="owl-mascot-sprite">` з `index.html`, додано `<svg class="owl-wing-overlay" viewBox="0 0 120 120">` з path крила.
- Видалено CSS блок sprite + `@keyframes owl-wave-sprite` + правило ховання greeting frame.
- Додано `@keyframes wing-wave-premium` (безшовний 0%=100%, cubic-bezier easing) + `@keyframes owl-head-tilt` 8° для thinking.
- `prefers-reduced-motion`: SVG-крило і head-tilt вимкнені.

**3. Debug-режим діагностики позиції — коміт `e4bba2d`**
- `.owl-wing-overlay { opacity: 1 !important; animation: infinite; outline: 2px dashed red }` — щоб бачити на телефоні чи SVG рендериться і де. **Тимчасово, прибрати у наступній сесії.**

**4. Нові PNG сови від Романа — коміти `a49d1eb`, `3ffd627`**
- Роман завантажив через GitHub Web 2 нові PNG у стилі amber/brown з прозорим фоном як `1.png` (помах крила) і `2.png` (спокій).
- `git mv`: `2.png`→`owl-idle.png`, `1.png`→`owl-greeting.png` (замінили старі "здивовані").
- `owl-alert.png`, `owl-thinking.png`, `owl-error.png`, `owl-greeting-sprite.png` — **ще старі**, чекають заміни.

**5. 4 раунди промпт-інжинірингу з Gemini через `/gemini`**
- Послідовні запити для архітектури (priority state-machine → hybrid SVG → ticket-pattern → performance checklist).
- Знайдено і виправлено 4 баги у пропозиціях Gemini: `infinite` + auto-revert, `filter: brightness` на iOS, зиґзаг очей не коло, ticket-захист не покривав циклічні стани.

### Обговорено (без виконання)

- **Flipbook-махання для greeting (план на наступну сесію):** прибрати debug, замінити SVG-крило на швидке перемикання `opacity` між `owl-idle.png` і `owl-greeting.png` 3 рази × 150 мс при `data-state="greeting"`. SVG-крило не підходить візуально — живе SVG на статичній PNG-сові ріже око. З новими парою PNG (спокій + з піднятим крилом) flipbook природньо виглядатиме як махання.
- **Заміна решти 3 PNG** (alert/thinking/error) — Роман генеруватиме через Gemini/Claude Design, коли буде час.
- **Claude Design як інструмент handoff** — спробували, але generate обривається помилками. Не підходить для художніх ассетів. Claude з Artifacts кращий.

### Ключові рішення

- **Гібрид PNG+SVG краще повного SVG** — зберегти PNG дизайн, накладати SVG для анімованих частин. АЛЕ для "махання" не працює гарно: контраст живого SVG і статичної PNG-сови ріже око. Перехід на flipbook з PNG — природніше.
- **Priority + ticket pattern** — кращі за `setTimeout` захист від race conditions.
- **Debug через `outline: dashed red`** — швидкий спосіб побачити невидимий елемент на мобільному без DevTools.
- **CSS `animation-play-state: paused` через клас на батьку** — один селектор ставить на паузу всі дочірні анімації.

### Інциденти

- **Контекст критично переповнений (220%+ за сесію)** — 30+ нагадувань `/finish`. Stream-обриви у Gemini → перейшли на копіпаст через AI Studio.
- **Крок 2 у 2 етапи:** спочатку state-machine закомічено і задеплоєно, `git stash pop` → SVG-крило окремим комітом.
- **PNG з неправильними іменами** (`1.png`, `2.png`) — Роман завантажив через GitHub Web без префікса owl-. `git mv` + видалення старих файлів.
- **Без git reset / force push.** Всі 5 комітів нормальні.

### Метрики

- **Коміти:** `5ed8d05` → `585cbbd` → `e4bba2d` → `a49d1eb` → `3ffd627`. **5 комітів.**
- **Гілка:** `claude/bird-wing-animation-uDZmz` (не стандартний `start-session-*` формат — створилась під задачу)
- **Версії:** v272 → v274+ (на момент /finish деплой в процесі)
- **CACHE_NAME:** `nm-20260419-0438`
- **Build:** чистий (локальний `node build.js` зелений)
- **Оновлені файли:** `src/owl/board.js`, `style.css`, `sw.js`, `index.html`, `assets/owl/owl-idle.png`, `assets/owl/owl-greeting.png`

---

## Проект

| | |
|--|--|
| **Версія** | v284 (після NFtzw + 5 PNG Романа — махання НЕ спрацьовує, треба фікс priority) |
| **URL** | owls68.github.io/NeverMind |
| **AI модель** | OpenAI GPT-4o-mini з Tool Calling (**47 tools:** 31 INBOX + 8 UI + 8 health/memory/cat) |
| **Гілка** | `claude/owl-animation-research-NFtzw` |
| **CACHE_NAME** | `nm-20260419-1044` |
| **Repo** | Public + LICENSE (All Rights Reserved) |

---

## 🗺️ Куди йде проект

**Дорожня карта — єдине місце:** [`ROADMAP.md`](../ROADMAP.md).

**Поточний Active:** Блок 2 — Концепції вкладок. Все з 🚀 Active попередніх сесій закрито.

---

## 🎯 НАСТУПНИЙ КРОК — ВАРІАНТИ

**A. 🌙 Вечір — доробка** (70→100%, 1-2 сесії) — **РЕКОМЕНДУЮ**
- Кільце продуктивності дня, підсумок OWL після 18:00, настрій-емодзі, моменти дня
- Один файл (`evening.js`), видима цінність, легкий

**B. 📁 Проекти — доробка** (65→100%, 2 сесії)
- Глибоке інтерв'ю 4 питання, стагнація-детекція, синк Витрати→Фінанси
- Поле `status` відсутнє у коді (треба додати)

**C. 👤 Я — доробка** (65→100%, 1-2 сесії)
- Теплова карта 14/30 днів, автопатерни раз на тиждень, огляд тижня

**D. 🏥 Здоров'я Фаза 2+3** (55→80%, 1-2 сесії)
- Фаза 2: CRUD карток через Inbox + чат-бари
- Фаза 3: переробка UI (прибрати legacy шкали)

**E. 🚧 4.17.B — 6 заблокованих UI tools** (2-3 сесії)
- `open_record` (search+highlight API), `open_trash` (UI модалка кошика)
- `calendar_jump_to` (навігація стану), `filter_tasks` (фільтр у Tasks)
- `clear_chat` (per-chat), `toggle_owl_board` (toggle state)

**F. 4.11 `getAIContext` повне покриття** (1 сесія)
- Перевірити чи OWL бачить ВСІ типи даних (проекти, моменти, події, здоров'я)
- Блокуючий пункт для якісніших tool calls

---

## Відомі технічні проблеми (не вирішені)

1. **B-65** SW load failed — одноразова помилка, не відтворюється. Низький пріоритет.
2. **Tool calling тільки в Inbox** — решта чат-барів на JSON-форматі (але множинні JSON працюють через `extractJsonBlocks`)
3. **`src/core/nav.js` = 1236 рядків** — трохи більше 1200 порогу. Кандидат на розбиття (settings/theme/profile/storage)
4. **Monobank** — відкладено до Supabase
5. **~150 рядків закоментованого коду** по проекту — колись прибрати

---

## 📦 Попередні сесії

Детальні описи VJF2M, Vydqm, FMykK, 14zLe, KTQZA, gHCOh, cnTkD, hHIlZ, W6MDn, VAP6z, acZEu, E5O3I, 3229b, 6v2eR, jMR6m → [`_archive/SESSION_STATE_archive.md`](../_archive/SESSION_STATE_archive.md).
