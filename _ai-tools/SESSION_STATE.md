# Стан сесії

**Оновлено:** 2026-04-16 (сесія W6MDn — **🛠️ 6 фіксів + план скілів + об'єднання з сесією VAP6z + аудит скілів**)

---

## Проект

| | |
|--|--|
| **Версія** | v40+ (після деплоїв сесії W6MDn) |
| **URL** | owls68.github.io/NeverMind |
| **AI модель** | OpenAI GPT-4o-mini з Tool Calling (31 tools) |
| **Гілка** | `claude/start-session-W6MDn` |
| **CACHE_NAME** | `nm-20260416-2001` |
| **Repo** | Public + LICENSE (All Rights Reserved) |

---

## 🗺️ Куди йде проект

**Дорожня карта — єдине місце:** [`ROADMAP.md`](../ROADMAP.md) у корені репо.

**Поточний Active:** Блок 2 — Концепції вкладок. ✅ Фінанси v2 майже завершені (залишились 🟡/🟢 баги і B-62 Аналітика).

**Нове після W6MDn:** Додано план **Скілів Claude Code** — інструменти самої розробки, не фічі NeverMind → [`_ai-tools/SKILLS_PLAN.md`](SKILLS_PLAN.md).

---

## ⚠️ Для нового чату — що зроблено (сесія W6MDn, 16.04)

### 🛠️ 6 багів закрито

**B-68 — Агент не бачив анкету налаштувань (новий)**
- Корінь: `getAIContext()` (`src/ai/core.js`) читав тільки `nm_routine` (блоки часу), але НЕ читав `nm_settings.schedule` (базовий розклад). Тому OWL у чаті питав "о котрій прокидаєшся" попри те що розклад уже заданий у налаштуваннях.
- Додатково: `getSchedule()` (`src/owl/inbox-board.js`) парсила години без хвилин (`06:30` → `6`) — промпт табло бачив неточно.
- Фікс: (1) новий блок "Розклад дня" у `getAIContext()` з явним правилом "НЕ питай цей розклад". (2) `getSchedule()` повертає додатково `wakeUpStr/workStartStr/workEndStr/bedTimeStr` з точними HH:MM. (3) `proactive.js:726` використовує нові `*Str` поля. (4) `getProfile()` (`src/core/nav.js`) включає currency і language з налаштувань.

**B-69 — Застарілі повідомлення табло OWL зі вчора (новий)**
- Корінь: AI природно пише "завтра/вчора" у повідомленнях табло. Коли день змінюється — ці слова стають неправдою, але кеш `nm_owl_board` і `nm_owl_tab_*` живе у localStorage без прив'язки до дати.
- Приклад: табло Нотаток показувало "Завтра мама приїжджає" а реально приїзд через 8 днів.
- Фікс: нова функція `clearStaleBoards()` у `src/owl/inbox-board.js` — перевіряє `toDateString()` першого (найсвіжішого) повідомлення, якщо не сьогодні — очищує кеш і скидає `*_ts` у 0. Виклик у `bootApp()` перед рендером табло. Наступний рендер показує дефолт, `tryTabBoardUpdate` генерує свіже.
- Рішення Романа: залишити природну мову "завтра/вчора", фіксувати кеш, не промпт.

**B-43 + B-51 — Модалка операції (glass-стиль)**
- B-43/B-51 — одна функція `_renderTransactionModalBody` обслуговує і створення і редагування, тому два баги закриваються одним фіксом.
- Корінь: біле тіло `rgba(255,255,255,0.96)` + горизонтальний і вертикальний padding на одному елементі, немає outer+scroll архітектури.
- Фікс: glass-стиль за `docs/DESIGN_SYSTEM.md` — outer panel `rgba(255,255,255,0.30)` + `blur(32px)` + `overflow:hidden` + `padding:0 20px`, scroll container всередині з `padding:28px 0 calc(env(safe-area-inset-bottom)+28px)`. Overlay тепер з `padding:0 16px 16px`.

**B-49 — Модалка "Дата операції"**
- Той самий glass-патерн. Додано `setupModalSwipeClose` (раніше не було свайпу для закриття).

**B-55 — Модалка редагування категорії**
- Той самий glass-патерн. Input'и назви і підкатегорій отримали `rgba(255,255,255,0.7)` фон для читабельності на glass-тлі.

### 🗂 План скілів Claude Code — новий документ + об'єднання з VAP6z

Створено [`_ai-tools/SKILLS_PLAN.md`](SKILLS_PLAN.md) з детальним планом 6 скілів.

**16.04.2026 пізніше** — паралельний чат (сесія `claude/start-session-VAP6z`) написав два перші скіли і замерджив у main: `.claude/commands/owl-motion.md` (SVG+CSS keyframes анімація сови, без Anime.js) і `.claude/commands/pwa-ios-fix.md` (чеклист iOS). Його версія `SKILLS_PLAN.md` замінила мою на коротку (40 рядків, тільки 2 скіли).

**Об'єднання виконано у W6MDn:**
- Повернуто мій детальний `SKILLS_PLAN.md` (137+ рядків, 6 скілів з пріоритетами)
- Позначено `/owl-motion` і `/pwa-ios-fix` як ✅ "початкова версія реалізована"
- Обидва скіли отримали **попередження зверху** про реальні DOM-селектори, заборону чіпати `setupSW`/`localStorage override`, обов'язковий CACHE_NAME bump, делегацію на `/new-file`
- Рішення: **чистий CSS keyframes краще за Anime.js** (простіше, без 20KB бібліотеки) — прийнято варіант сесії VAP6z
- Додано нове правило у `CLAUDE.md` "Процес роботи" → **"🛡️ Аудит скілів перед створенням або використанням"** (5 перевірок self-audit перед виконанням)

**План 6 скілів:**

| Скіл | Статус | Коли |
|------|--------|------|
| `/owl-motion` анімація сови (SVG+CSS, без Anime.js) | ✅ Початкова версія (від VAP6z) + попередження | Впровадити у наступній сесії — потрібна багатошарова SVG сова |
| `/pwa-ios-fix` iOS Safari чеклист | ✅ Початкова версія (від VAP6z) + попередження | Впровадити у наступній сесії |
| UX-UI (адаптований під DESIGN_SYSTEM.md) | ⏳ Не написано | Пріоритет 1 — наступна сесія |
| Prompt Engineer | ⏳ Не написано | Пріоритет 1 — наступна сесія |
| Supabase Prep (Migration+Perf+retry+offline) | ⏳ Не написано | 🟡 Перед міграцією на Supabase |
| A11y-Enforcer | ⏳ Не написано | 🔴 Перед публічним релізом |
| Gamification-Engine | ⏳ Не написано | 🔵 Блок 3 ROADMAP |

Формат SKILL.md задокументований: YAML-шапка + Markdown тіло (<500 рядків) + supporting files у reference.md/scripts/.

### 🦉 Анімація сови — обрано чистий CSS (від VAP6z)

**Рішення (оновлено після VAP6z):** готова SVG + **чистий CSS keyframes** (без Lottie, без Anime.js, без бібліотек). Скіл `/owl-motion` вже написаний у `.claude/commands/owl-motion.md` (початкова версія). 5 станів: `idle` / `alert` / `thinking` / `error` / `greeting` + анімація бабла (`scaleX(0)→scaleX(1)` з `transform-origin: left`).

**Чому CSS замість Anime.js:** простіше, без +20KB бібліотеки, швидше на iOS, менше залежностей. Оригінальний план (Anime.js через `freshtechbro/claudedesignskills`) **скасовано**.

**Статус впровадження:**
1. ⏳ Роман знаходить багатошарову SVG сову (з окремими path для голови/тіла/крил/очей) на Flaticon / unDraw / iconify / svgrepo
2. ⏳ Claude у наступній сесії викликає `/owl-motion` (читаючи попередження зверху) → інтегрує SVG з реальною DOM-структурою (`#owl-board`, `#owl-tab-board-*`) → створює `src/owl/owl-controller.js` через `/new-file` → пише CSS keyframes → зв'язує з `nm-data-changed` подіями

**Варіант 3 (Gemini SVG Creator)** — відкладено до окремої сесії, об'єднати з B-56 (40 іконок категорій Фінансів). Use-cases: вкладки, empty states, онбординг, ачівки, графіки аналітики, маркетинг.

### 📚 Знайдені ресурси (вивчені цієї сесії)

- [code.claude.com/docs/en/skills](https://code.claude.com/docs/en/skills) — офіційний формат SKILL.md
- [hesreallyhim/awesome-claude-code](https://github.com/hesreallyhim/awesome-claude-code) — офіційний awesome-list
- [sickn33/antigravity-awesome-skills](https://github.com/sickn33/antigravity-awesome-skills) — 1400+ скілів
- [freshtechbro/claudedesignskills](https://github.com/freshtechbro/claudedesignskills) — 22 скіли анімацій (Anime.js, Lottie, Rive, GSAP)
- [htuzel/gemini-svg-creator](https://github.com/htuzel/gemini-svg-creator) — делегація SVG до Gemini 3.1 Pro через MCP

### 🆕 Нові контекстні факти проекту (для будь-якого майбутнього чату)

- **Стрес-тест 20-30 юзерів** після Supabase-міграції запланований Романом
- **Публічний реліз** без жорсткого дедлайну ("роблю щодня скільки можу")
- **A11y не пріоритет зараз** — Роман єдиний користувач, зрячий, на iPhone

### Файли що торкнулись

- `src/ai/core.js` — блок "Розклад дня" у `getAIContext()`
- `src/core/nav.js` — `getProfile()` + currency/language
- `src/owl/inbox-board.js` — розширена `getSchedule()`, нова `clearStaleBoards()`
- `src/owl/proactive.js` — промпт табло використовує HH:MM
- `src/core/boot.js` — виклик `clearStaleBoards()` перед рендером табло
- `src/tabs/finance.js` — переписано 3 модалки у glass-стиль
- `sw.js` — CACHE_NAME багато разів
- `NEVERMIND_BUGS.md` — B-43/B-49/B-51/B-55 + B-68/B-69 → Закриті
- `_ai-tools/SKILLS_PLAN.md` — **новий файл** (детальний план 6 скілів)
- `CLAUDE.md` — секція "Плани на розвиток" + оновлено анімацію OWL
- `ROADMAP.md` — посилання на SKILLS_PLAN.md

---

## 🎯 Наступний крок у новому чаті

**РОМАН СКАЗАВ:** "Наступна сесія впровадить всі скіли" — це головний напрямок для наступного чату.

### Що це означає конкретно

1. **Впровадити `/owl-motion`** (потрібна багатошарова SVG сова від Романа):
   - Прочитати попередження у `.claude/commands/owl-motion.md`
   - Прочитати реальну DOM-структуру (`src/owl/board.js` + `index.html` `#owl-board`)
   - Створити JS-модуль через `/new-file` (НЕ напряму)
   - Інтегрувати з `nm-data-changed` подіями (state transitions)
   - CSS keyframes у `style.css` + SVG у `index.html` + CACHE_NAME bump

2. **Впровадити `/pwa-ios-fix`**:
   - Прочитати попередження у `.claude/commands/pwa-ios-fix.md`
   - Запустити `grep` для перевірки існуючих iOS фіксів у `boot.js`/`style.css`
   - Додати **тільки відсутні** — `--vh` змінна, overscroll, touch-action (якщо ще нема)
   - Тестувати `overscroll-behavior` і `touch-action` щоб не зламати `swipe-delete.js`
   - CACHE_NAME bump

3. **Написати скіли Пріоритету 1 у `.claude/commands/`:**
   - `/ux-ui` — читає `docs/DESIGN_SYSTEM.md` перед UI-кодом, блокує дефолтні модалки
   - `/prompt-engineer` — єдиний формат для 7+ промптів OWL у `src/ai/core.js`

Формат кожного скіла — як `/owl-motion` і `/pwa-ios-fix`: блок `⚠️ Перед виконанням — обов'язкові перевірки` зверху + основне тіло.

### Що чекає на Романа до наступної сесії

1. **Знайти багатошарову SVG сову** (з окремими path для голови/тіла/крил/очей) на одному з ресурсів:
   - [flaticon.com/free-icons/owl](https://www.flaticon.com/free-icons/owl)
   - [undraw.co](https://undraw.co)
   - [iconify.design](https://iconify.design)
   - [svgrepo.com](https://www.svgrepo.com/vectors/owl)

### Інші опції (якщо Роман передумає робити скіли)

- Продовжити закривати баги Фінансів (18 відкритих 🟡/🟢)
- B-62 Аналітика Фінансів — повний редизайн
- Далі по Блоку 2 — Вечір / Я / Проекти

### Відомі технічні проблеми (не вирішені)

1. **⚠️ `finance.js` — 1928 рядків** (>1500, розбити на `finance.js` + `finance-analytics.js` + `finance-cats.js`)
2. **⚠️ Circular dependencies:** `finance.js ↔ inbox.js`, `finance.js ↔ habits.js`
3. **⚠️ ~150 рядків закоментованого коду** по проекту
4. **Tool calling тільки в Inbox** — 4.10 з ROADMAP
5. **Monobank інтеграція** — відкладено до Supabase
6. **Здоров'я ще НЕ тестувалось** — запланувати в наступній тест-сесії

---

## 📦 Попередні сесії

- **acZEu (16.04):** 🛠 B-42+B-63 (один баг зі змінною `sc`) + B-67 (4 фази діагностики)
- **E5O3I (16.04):** ручне тестування Фінансів → знайдено 26 багів B-42..B-67
- **3229b (15-16.04):** повна переробка Фінансів v2 (6 фаз, 20 комітів)
- **6v2eR (15.04):** повна переробка Здоров'я (6 фаз + 5 багів за один день)
