# Стан сесії

> **Правило ротації:** у файлі детально описані **2 останні активні сесії**.
> При виклику `/finish` у новій сесії — найстарша з 2 переноситься у [`_archive/SESSION_STATE_archive.md`](../_archive/SESSION_STATE_archive.md).
> Попередні сесії до w3ISi — в архіві (VJF2M, Vydqm, FMykK, 14zLe, KTQZA, gHCOh, cnTkD, hHIlZ, W6MDn, VAP6z, acZEu, E5O3I, 3229b, 6v2eR, jMR6m).

**Оновлено:** 2026-04-19 (сесія **uDZmz** — priority state-machine + SVG-крило + нові PNG сови)

---

## ⚠️ ДЛЯ НОВОГО ЧАТУ — найважливіше

**1. ПЕРШИЙ КРОК У НАСТУПНІЙ СЕСІЇ — FLIPBOOK-МАХАННЯ.** У `style.css` зараз DEBUG-блок: SVG-крило махає постійно з червоною пунктирною рамкою (`outline: 2px dashed red`). Треба: (а) прибрати debug-блок, (б) прибрати SVG-крило взагалі (`<svg class="owl-wing-overlay">` в index.html + `@keyframes wing-wave-premium` у style.css), (в) замість нього — flipbook: CSS-анімація яка при `[data-state="greeting"]` швидко перемикає `opacity` між `owl-idle.png` і `owl-greeting.png` 3 рази × 150мс, потім залишається idle. Нові PNG вже завантажені правильно (див. пункт 3). Деталі плану в блоці сесії uDZmz "Обговорено".

**2. PRIORITY STATE-MACHINE ГОТОВА** — `setOwlMascotState` у `src/owl/board.js` має `OWL_PRIORITY` (error=100, alert=80, thinking=60, greeting=40, idle=0) + ticket-лічильник + failsafe 30с. Нижчий пріоритет не перебиває вищий. `visibilitychange` → клас `.is-paused` на батьку ставить на паузу всі анімації. Це вирішує w3ISi "моргання" між greeting і alert.

**3. НОВІ PNG СОВИ ЗАВАНТАЖЕНІ:** `owl-idle.png` (спокій) + `owl-greeting.png` (з піднятим крилом) у стилі amber/brown з прозорим фоном. Використай ці два файли для flipbook. Файли `owl-alert.png`, `owl-thinking.png`, `owl-error.png` ще старі ("здивовані") — Роман замінюватиме пізніше.

**4. CACHE_NAME АКТУАЛЬНЕ:** `nm-20260419-0438`. При наступній зміні коду — оновити на нову мітку (`date +"nm-%Y%m%d-%H%M"`).

**5. AGENT КЕРУЄ UI (4.17)** — 8 UI tools готових у `src/ai/ui-tools.js`. Довідник + 6 заблокованих → `docs/AI_TOOLS.md`.

**6. ГОЛОСОВИЙ ВВІД (Web Speech API)** у всіх 8 чат-барах — `src/ui/voice-input.js`, `lang='uk-UA'`.

**7. Файли >250 рядків — skeleton+Edit.** Checkpoint-коміт після КОЖНОЇ логічної фази.

**8. Workflow Романа:** "Роби" → один таск → звіт → пропозиція наступного → чекати підтвердження.

**9. Ти САМ викликаєш скіли за тригер-фразами.** Тригери у `_ai-tools/SKILLS_PLAN.md`.

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

## 🔧 Сесія w3ISi — Handoff дизайну сови + базова інтеграція PNG-маскота (18-19.04.2026)

### Зроблено

**1. Receive handoff з дизайном сови (коміт `3f32b48`)**
- Роман завантажив через GitHub веб пакет у папку `handoff/`: README.md з інструкцією, 4 варіанти коду компонента (Owl.html / Owl.css / Owl.js / OwlReact.jsx), 5 PNG ~1.2 МБ кожна (5 станів: idle/alert/thinking/greeting/error).
- Кольорова палітра дизайну: amber-deep `#8a5208`, active `#c2790a` — співпадає з правилом "без фіолету".
- Перенесено 5 PNG з `handoff/assets/owl/` у `assets/owl/` (робоче місце для PWA).

**2. Базова інтеграція PNG-маскота на головному табло (коміт `a58104b`)**
- У `style.css` додано класи `.owl-mascot` (float 4s) + `.owl-mascot-frame` (кросфейд 400мс + scale 500мс) + селектори `[data-state=*] [data-frame=*]` для 5 станів + `prefers-reduced-motion` виняток.
- У `index.html:275` замінено емодзі 🦉 у `.owl-speech-avatar` на контейнер `.owl-mascot` з 5 накладеними `<img>` (по одному на кожний стан). Активний стан — `data-state="idle"` за замовчуванням.
- Інші місця емодзі 🦉 (tab boards, collapsed state, onboarding) — **не чіпав**, Роман просив спочатку тільки головне табло.
- CACHE_NAME bump: `nm-20260418-1610` → `nm-20260418-2212`.

**3. Автоматична зміна станів — alert/thinking/error (коміт `53e64fd`)**
- У `src/owl/board.js` додано `setOwlMascotState(state, autoRevertMs)` — керує `data-state` на `#owl-mascot-main`. Auto-revert у `idle` через вказаний час.
- При показі нового Inbox board повідомлення → `setOwlMascotState('alert', 12000)` — сова "уважно дивиться" 12 секунд.
- У `src/ai/core.js _fetchAI` обгорнуто: `'thinking'` на старті, `'idle'` на успіху, `'error' (6000)` на HTTP або catch помилці.
- `window.setOwlMascotState` доступний для debug з консолі.

**4. Sprite-sheet анімація для greeting — 6 кадрів махання крилом (коміт `a35db21`)**
- У `index.html:282` додано `<div class="owl-mascot-sprite" data-sprite="greeting">` всередині `.owl-mascot`.
- У `style.css` додано `.owl-mascot-sprite` + `@keyframes owl-wave-sprite` — CSS `steps(6)` анімація `background-position` від `0%` до `-600%` за 0.9 сек, цикл.
- `data-state="greeting"` активує сприт + ховає статичну greeting картинку (щоб не двоїлось).
- Boot auto-trigger у `src/core/boot.js`: через 1.5 сек після старту → `setOwlMascotState('greeting', 6000)` (тимчасово для тесту).

**5. Sprite іконки — ітерації розмірів:**
- v1 (коміт `e6200ac`): Роман завантажив через GitHub веб 632×395 PNG — помилка пропорцій (кадр 105×395 — вузький високий, у квадратному контейнері 96×96 сплющувалось). Я переніс файл з кореня у `assets/owl/` (`4d98985`).
- Відкочено auto-trigger (`c056c0d`) до отримання правильного sprite.
- v2 (коміт `ac274fd`): Роман згенерував через Claude Design два варіанти — 576×96 (low-res) і 1536×256 (hi-res). Я обрав hi-res (кадри 256×256 — квадратні, ретіна-ready для iPhone 3×). Встановив як `assets/owl/owl-greeting-sprite.png`, увімкнув назад auto-trigger.

**6. Що ЩЕ НЕ зроблено (для наступної сесії):**
- Greeting конфліктує з alert — board message перебиває 6-секундну анімацію через 1-2 сек. Треба або priority (greeting > alert), або відкласти board на 10+ сек, або окрема test-кнопка.
- Якість анімації слабка — Gemini-згенеровані кадри не цілком консистентні (сова трохи "дихає" між кадрами), видно як моргання а не плавне махання. Production якість — тільки через After Effects (Lottie) або Runway.
- Greeting "перший вхід за день" — замінити auto-trigger на умову (check `localStorage.nm_last_greet_date`).
- 4 інші стани (alert/thinking/error/idle) — все ще статичні PNG. Треба повторити sprite workflow для кожного.
- Заміна 🦉 на інших 5 вкладках + згорнутому стані — не чіпали.
- JS-контролер станів у окремому модулі `src/owl/mascot.js` — не створено, логіка живе у `board.js`.

### Обговорено (без виконання)

- **Розмір PNG ~6 МБ сумарно** — для мобільного багато. README пропонував WebP конвертацію (`cwebp`) — зменшило б у 4 рази. Локально конвертера нема (немає cwebp/ImageMagick/Pillow), перший деплой буде повільнішим але PWA закешує.
- **Підозра на запечений шаховий візерунок у PNG** — на скріншоті iPhone у Inbox видно клітинки поверх бежевого фону. Роман показав що у Finder файли мають "Альфа-канал: Так" — тобто PNG нормальні. Я неправильно інтерпретував візерунок у своєму image-переглядачі (індикація прозорості ≠ запечена текстура). Невирішено: чому на телефоні видно шаховий. Можливі причини: (а) iOS Safari артефакт, (б) CSS issue з PWA кешем, (в) моя помилка читання скріншота. **Треба перевірити ще раз на телефоні після деплою v259+.**
- **Промпт для Gemini для генерації 5 станів** — я видав Роману English-промпт з детальним описом кожного стану (idle/alert/thinking/greeting/error), amber/brown палітрою, вимогою PNG-24 з альфа-каналом, 1024×1024. Роман піде перегенерує у Gemini якщо старі не підійдуть.
- **Instructions на GitHub Web для папок** — Роман вперше клав папки у репо через веб-інтерфейс. Покрокова інструкція: перемкнути гілку, Add file → Upload files, перетягнути папку щоб зберегти структуру. Branch `claude/start-session-w3ISi` створено через `git push -u origin` (Роман дав згоду на push порожньої гілки щоб з'явилась на GitHub).

### Ключові рішення

- **Назва папки `handoff/` (не `_design/`)** — стандартний термін для "передача від дизайну розробнику", зрозуміліше.
- **Перший етап — тільки idle + головне табло.** Роман свідомо обрав мінімальний зріз перед станами, щоб побачити візуально як виглядає перш ніж вкладатись у логіку.
- **Покачування 4с — постійно активне.** Роман сказав "хай шивелиться постійно", паузу робити не будемо.
- **Картинки в корені `assets/owl/`** — PWA Service Worker (`sw.js`) автоматично кешує cache-first (не треба додавати у STATIC_ASSETS).

### Інциденти

- **Гілка `claude/start-session-w3ISi` не існувала на GitHub** при старті — локальна, створена Claude Code runtime. Я запушив `git push -u origin claude/start-session-w3ISi` після згоди Романа (коміт без змін — fast-forward зі стану main `efbaf93`).
- **Помилкова інтерпретація шахового візерунка** — я двічі стверджував "PNG зламані" коли Роман показував скріншоти PNG у своєму переглядачі. Насправді це була лише індикація прозорості у переглядачі (Finder/чат Claude). Треба було одразу запитати "який колір фону за картинкою у твоєму переглядачі?". Вибачився, записав у рішення "перевіряти на кольоровому фоні ПЕРЕД висновками про запечений фон".
- Без reset/force push. 2 коміти чистих.

### Метрики

- **Коміти:** `3f32b48` (handoff) → `a58104b` (integration) → `53e64fd` (auto-states) → `a35db21` (sprite CSS) → `e6200ac` + `4d98985` (broken sprite v1) → `173199f` (boot trigger) → `c056c0d` (revert) → `785ad01` + `ac274fd` (sprite v2 hi-res). **9 комітів.**
- **Гілка:** `claude/start-session-w3ISi`
- **Версії:** v256 → v268+ (після ac274fd)
- **CACHE_NAME:** `nm-20260419-0200`
- **Нові файли:** `assets/owl/owl-greeting-sprite.png` (1536×256, 392 KB), `handoff/` (README + 4 компоненти + 5 оригінальних PNG)
- **Нові папки:** `assets/owl/`, `handoff/`

---

## Проект

| | |
|--|--|
| **Версія** | v274+ (після uDZmz — priority state-machine + SVG-крило debug + нові PNG сови) |
| **URL** | owls68.github.io/NeverMind |
| **AI модель** | OpenAI GPT-4o-mini з Tool Calling (**47 tools:** 31 INBOX + 8 UI + 8 health/memory/cat) |
| **Гілка** | `claude/bird-wing-animation-uDZmz` |
| **CACHE_NAME** | `nm-20260419-0438` |
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
