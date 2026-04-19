# Стан сесії

> **Правило ротації:** у файлі детально описані **2 останні активні сесії**.
> При виклику `/finish` у новій сесії — найстарша з 2 переноситься у [`_archive/SESSION_STATE_archive.md`](../_archive/SESSION_STATE_archive.md).
> Попередні сесії до uDZmz — в архіві (w3ISi, VJF2M, Vydqm, FMykK, 14zLe, KTQZA, gHCOh, cnTkD, hHIlZ, W6MDn, VAP6z, acZEu, E5O3I, 3229b, 6v2eR, jMR6m).

**Оновлено:** 2026-04-19 (сесія **NFtzw** — research + V2 plan + Phase 0 flipbook skeleton)

---

## ⚠️ ДЛЯ НОВОГО ЧАТУ — найважливіше

**1. ЧЕКАЄМО 5 PNG ВІД РОМАНА у `assets/owl/wave/`.** Кадри махання крилом для flipbook greeting — `frame-1.png` (idle, крило вниз) ... `frame-5.png` (крило 100°, усміх). Роман генерує через Nano Banana покадрово. HTML і CSS вже готові — як тільки PNG будуть залиті у гілку через GitHub Web, flipbook сам оживе при наступному деплої. **Fallback:** поки немає PNG — показується статичний `owl-greeting.png` (як було).

**2. NANO BANANA WORKFLOW задокументовано** у `handoff/OWL_ANIMATION_PLAN_V2.md` (план + 4 фази + skill tree) і `handoff/OWL_ANIMATION_RESEARCH.md` (дослідження Rive vs Lottie vs CSS/PNG). Критичний нюанс: **compound degradation** у Nano Banana — завжди новий чат + оригінальна idle PNG як референс для кожного кадру, НЕ чейнити.

**3. BG-REMOVAL PIPELINE:** `erase.bg` (безкоштовно, до 5000×5000, без кредитів). Промпт Nano Banana просить чорний фон — потім erase.bg зрізає.

**4. PRIORITY STATE-MACHINE ГОТОВА** — `setOwlMascotState` у `src/owl/board.js` (error=100 > alert=80 > thinking=60 > greeting=40 > idle=0) + ticket + failsafe 30с. `visibilitychange` ставить на паузу у фоні.

**5. CACHE_NAME АКТУАЛЬНЕ:** `nm-20260419-0918`. При наступній зміні коду — оновити (`date +"nm-%Y%m%d-%H%M"`).

**6. AGENT КЕРУЄ UI (4.17)** — 8 UI tools у `src/ai/ui-tools.js`. Довідник → `docs/AI_TOOLS.md`.

**7. Файли >250 рядків — skeleton+Edit.** Checkpoint-коміт після КОЖНОЇ логічної фази.

**8. Workflow Романа:** "Роби" → один таск → звіт → пропозиція наступного → чекати.

**9. Ти САМ викликаєш скіли за тригер-фразами.** Тригери у `_ai-tools/SKILLS_PLAN.md`.

---

## 🔧 Сесія NFtzw — Research + V2 план + Phase 0 flipbook skeleton (19.04.2026)

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

### Метрики

- **Коміти:** `f16685b` (research) → `af90d41` (V2 plan) → `6266c17` (Phase 0 code) → `7e5b479` (fallback fix). **4 коміти.**
- **Гілка:** `claude/owl-animation-research-NFtzw` (нестандартний формат)
- **Версії:** v277 (на момент /finish деплой ще не запущений — новий деплой v278+ піде від docs-комітів)
- **CACHE_NAME:** `nm-20260419-0918`
- **Build:** чистий (локальний `node build.js` зелений)
- **Нові файли:** `handoff/OWL_ANIMATION_RESEARCH.md`, `handoff/OWL_ANIMATION_PLAN_V2.md`
- **Нова папка:** `assets/owl/wave/` (порожня, чекає на 5 PNG)

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
| **Версія** | v277+ (після NFtzw — research + V2 plan + Phase 0 flipbook skeleton) |
| **URL** | owls68.github.io/NeverMind |
| **AI модель** | OpenAI GPT-4o-mini з Tool Calling (**47 tools:** 31 INBOX + 8 UI + 8 health/memory/cat) |
| **Гілка** | `claude/owl-animation-research-NFtzw` |
| **CACHE_NAME** | `nm-20260419-0918` |
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
