# Стан сесії

> **Правило ротації:** у файлі детально описані **2 останні активні сесії**.
> При виклику `/finish` у новій сесії — найстарша з 2 переноситься у [`_archive/SESSION_STATE_archive.md`](../_archive/SESSION_STATE_archive.md).
> Попередні сесії до VJF2M — в архіві (Vydqm, FMykK, 14zLe, KTQZA, gHCOh, cnTkD, hHIlZ, W6MDn, VAP6z, acZEu, E5O3I, 3229b, 6v2eR, jMR6m).

**Оновлено:** 2026-04-19 (сесія **w3ISi** — handoff дизайну сови + базова інтеграція PNG-маскота)

---

## ⚠️ ДЛЯ НОВОГО ЧАТУ — найважливіше

**1. СОВА АНІМОВАНА НА ТАБЛО INBOX (w3ISi)** — PNG-сова з 4 автоматичними станами: alert при новому Inbox board повідомленні (12с), thinking під час AI запиту, error при fail (6с), idle за замовчуванням + постійне покачування 4с. Sprite-sheet анімація greeting (6 кадрів, 1536×256) при boot на 6 секунд (тимчасовий тригер). Код у `src/owl/board.js` (setOwlMascotState), `src/ai/core.js` (hook у _fetchAI), `src/core/boot.js` (auto-trigger). Коміти `53e64fd`, `a35db21`, `ac274fd`.

**2. GREETING КОНФЛІКТУЄ З ALERT** — при boot сова починає махати крилом, але якщо Inbox board одразу показує повідомлення → alert state перебиває greeting через 1-2 сек. Виглядає як "моргання". Треба у наступній сесії: або priority (greeting > alert), або відкласти board update на 10+ сек, або прибрати auto-trigger і підключити умову "перший вхід за день" через `localStorage.nm_last_greet_date`.

**3. PNG-пакет від дизайнера (handoff/) — з питанням прозорості.** 5 файлів переміщено у `assets/owl/`, виглядають прозорими у моєму переглядачі. На скріншоті PWA з iPhone видно шаховий візерунок на бежевому фоні Inbox — я припустив "запечений у PNG", але Роман показав що PNG мають альфа-канал. Невирішено — причина може бути: (а) iOS Safari артефакт, (б) CSS issue, (в) було помилкою моїх очей. **Треба перевірити на телефоні після деплою v259+**. Якщо шаховий зник — значить було тимчасово, все OK.

**4. Роман генерує нові сови через Gemini** — промпт я дав у сесії. 5 станів, прозорий фон, amber/brown палітра. Коли отримає — завантажить заміною у `assets/owl/` на GitHub. Код уже готовий.

**5. AGENT КЕРУЄ UI (4.17)** — 8 UI tools готових у `src/ai/ui-tools.js`. Повний довідник + 6 заблокованих → `docs/AI_TOOLS.md`.

**6. ГОЛОСОВИЙ ВВІД (Web Speech API)** у всіх 8 чат-барах — `src/ui/voice-input.js`, `lang='uk-UA'`, кнопка 🎤 поруч з send-btn.

**7. Файли >250 рядків — skeleton+Edit.** Checkpoint-коміт після КОЖНОЇ логічної фази.

**8. Workflow Романа:** "Роби" → один таск → звіт → пропозиція наступного → чекати підтвердження.

**9. Ти САМ викликаєш скіли за тригер-фразами.** Тригери у `_ai-tools/SKILLS_PLAN.md`.

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

## 🔧 Сесія VJF2M — Голосовий ввід + 4.17 UI Tools Suite + AI_TOOLS.md (18.04.2026)

### Зроблено

**1. Голосовий ввід у всіх 8 чат-барах (`src/ui/voice-input.js`, 137 рядків) — коміт `76fe682`**
- Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`), `lang='uk-UA'`.
- Автоматично додає кнопку 🎤 у кожен `.ai-bar-input-box` при DOMContentLoaded.
- Inbox: активує існуючу `disabled` кнопку. Решта 7: створює нову перед send-btn.
- Interim results → live-оновлення textarea під час запису. Пауза → автостоп (`onend`).
- Червоне пульсування (`.voice-btn.recording` + `@keyframes voice-pulse`).
- Fallback: якщо браузер без підтримки — кнопка не з'являється.

**2. Довідник `docs/AI_TOOLS.md` — коміт `313279c`**
- Єдине місце правди для 47 tools (39 існуючих INBOX_TOOLS + 8 нових UI).
- Категорії: CREATE/COMPLETE/EDIT/DELETE/ІНШЕ/ЗДОРОВ'Я/ПАМ'ЯТЬ/КАТ.ФІНАНСІВ. UI: A/C/D/E.
- Посилання додані у CLAUDE.md (Карта документації + Писати коли), START_HERE.md, `.claude/commands/prompt-engineer.md`.
- Бонус: виправлено rot у `/prompt-engineer` — `src/ai/core.js` → `src/ai/prompts.js` (після винесення промптів 17.04 14zLe).

**3. 4.17 UI Tools Suite — 8 tools (`src/ai/ui-tools.js`, 210 рядків) — коміт `6f128b1`**
- `switch_tab`, `open_memory`, `open_settings`, `set_finance_period`, `open_finance_analytics`, `set_theme`, `set_owl_mode`, `export_health_card`.
- Dispatcher `handleUITool(name, args)` повертає `{text}` для чат-відповіді.
- Імпорт `UI_TOOLS` у `prompts.js` → spread у `INBOX_TOOLS` (єдиний список для AI).
- Нова секція "UI TOOLS" в `INBOX_SYSTEM_PROMPT` з принципом мінімального тертя.
- У `inbox.js` dispatch: `UI_TOOL_NAMES.has(...)` check ДО `_toolCallToAction` → `handleUITool` → `addInboxChatMsg`.
- 6 заблоковано (open_record, open_trash, calendar_jump_to, filter_tasks, clear_chat, toggle_owl_board) — винесено у ROADMAP 4.17.B.

**4. 3 фікси після тесту на живому пристрої:**
- **`b0c41a5`:** зламаний імпорт `openMemoryModal` (є тільки у window). Фікс — виклик через `window.openMemoryModal()`. Причина провалу деплою v247.
- **`ca5981d`:** `switchTab('calendar')` падав бо немає `page-calendar`. Календар — модалка. Додано aliases: `calendar` → `openCalendarModal()`, `habits` → `switchTab('tasks')`.
- **`fcb9306`:** натиск send-btn під час запису → `pendingSendClick=true` + `stopRecording()` → у `onend` через 60мс програмний `sendBtn.click()`. Перехоплення у capture phase з `preventDefault` + `stopImmediate`.
- **`31eeeb8`:** прибрано toast підтвердження UI tools (Роман: "бабл що знизу появляється і зникає"). У чаті Inbox reply лишається.

### Обговорено (без виконання)
- Розширений список UI tools — 14 варіантів (A/B/C/D/E). Роман відкинув Блок B (відкриття порожніх форм створення) через принцип мінімального тертя.
- 6 заблокованих tools — потребують нової інфраструктури (search API, UI модалка кошика, per-chat storage, toggle state), винесено у 4.17.B як окремі підзадачі.
- Структура документа `docs/AI_TOOLS.md` — узгоджено з Романом: робимо єдиний довідник 47 tools з категоризацією + промпт-правилами + зв'язками.

### Ключові рішення
- **4.17 vs 4.15 `switch_tab`:** 4.17 консолідує 4.15 (пункт 4.15 залишений як історична довідка).
- **UI tools НЕ відкривають порожні форми** — принцип мінімального тертя. Агент використовує CRUD tools напряму.
- **Довідник tools окремо від промптів** — `docs/AI_TOOLS.md` описовий (для людей + Claude при читанні), `src/ai/prompts.js` + `src/ai/ui-tools.js` виконавчі.

### Інциденти
- **Деплой v247 провалився** — зламаний імпорт, локального `node build.js` не запускав. Після виправлення (`b0c41a5`) — OK.
- **2 спроби тестування на пристрої** з помилками: "не можу відкрити календар" (AI не бачив tools через старий кеш) і "Не вдалось виконати: switch_tab" (TypeError з `page-calendar`). Обидві виправлено.
- **Без git reset / force push.** Всі 8 комітів — normal.

### Метрики
- **Коміти:** `3ec8bb5` (roadmap) → `76fe682` (voice) → `313279c` (AI_TOOLS.md) → `6f128b1` (UI tools) → `b0c41a5` (fix import) → `ca5981d` (fix switch_tab) → `fcb9306` (voice+send) → `31eeeb8` (remove toast). **8 комітів.**
- **Гілка:** `claude/start-session-VJF2M`
- **Версії:** v243 (перед) → v250+ (після)
- **CACHE_NAME:** `nm-20260418-1508` (останнє оновлення у toast-fix)
- **Build:** чистий після фіксів (локальний `node build.js` зелений)
- **Нові файли:** `src/ui/voice-input.js`, `src/ai/ui-tools.js`, `docs/AI_TOOLS.md`

---

## Проект

| | |
|--|--|
| **Версія** | v268+ (після w3ISi — handoff сови + 4 стани + sprite greeting) |
| **URL** | owls68.github.io/NeverMind |
| **AI модель** | OpenAI GPT-4o-mini з Tool Calling (**47 tools:** 31 INBOX + 8 UI + 8 health/memory/cat) |
| **Гілка** | `claude/start-session-w3ISi` |
| **CACHE_NAME** | `nm-20260419-0200` |
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

Детальні описи FMykK, 14zLe, KTQZA, gHCOh, cnTkD, hHIlZ, W6MDn, VAP6z, acZEu, E5O3I, 3229b, 6v2eR, jMR6m → [`_archive/SESSION_STATE_archive.md`](../_archive/SESSION_STATE_archive.md).
