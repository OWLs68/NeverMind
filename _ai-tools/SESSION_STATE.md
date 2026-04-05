# Стан сесії

**Оновлено:** 2026-04-05 (investigate-account-block)

---

## Проект

| | |
|--|--|
| **Версія** | v70 |
| **URL** | owls68.github.io/NeverMind |
| **AI модель** | OpenAI GPT-4o-mini |
| **Гілка** | `claude/investigate-account-block-bxmCZ` |

---

## Зараз робимо

**Згортання Gemini MCP експерименту + новий скіл `/gemini`.**

### Що сталось
Роман засвітив `GEMINI_API_KEY` у чаті claude.ai/code — спрацював secret scanner, сесія `01ADwSEQttu5G2s4LUkBrydv` заблокована. Причина витоку — дебаг Railway-деплойменту MCP-сервера `_ai-tools/gemini-mcp/`.

### Рішення
Remote MCP через Railway — занадто складний стек (7 шарів: Railway, Node.js, env vars, SSE transport, Gemini API, MCP client у claude.ai/code, ротація ключів). Кожен шар ламається окремо. Не виправдано для солодевелопера.

**Замість MCP — простий ручний workflow:**
- Скіл `/gemini [питання]` збирає контекст (CLAUDE.md + SESSION_STATE + git diff + повні файли)
- Виводить одним код-блоком у чаті
- Роман копіює → вставляє в https://aistudio.google.com (Gemini 2.5 Pro, 1M контекст)
- Отримує відповідь → повертає в чат → Claude реагує

Нуль інфраструктури, нуль витоків ключів, Роман — арбітр між двома AI.

### Зроблено (ця сесія)

**Частина 1 — Gemini workflow:**
- Видалено `_ai-tools/gemini-mcp/` (5 файлів, -2073 рядки) — невдалий експеримент Railway MCP-сервера
- Створено скіл `.claude/commands/gemini.md` — ручний workflow через копіювання в застосунок
- Оновлено модель у скілі: `2.5 Pro` → `3 Pro` (актуальна станом на 04.2026)
- **Перший реальний тест** на `src/owl/board.js` + `src/owl/chips.js` — workflow працює
- Знайдено 3 реальні баги: **B-13** (🔴 апостроф у `onclick`), **B-14** (🟡 `includes()` false positives), **B-15** (🟢 setTimeout magic)
- Заарбітрована 1 галюцинація Gemini про `<msg.id>`

**Частина 2 — Глобальний клінап документації (4 коміти):**
- Консолідовано `NEVERMIND_BUGS.md` (видалено дубль, оновлено шляхи під `src/`, додано B-13/B-14/B-15)
- `CLAUDE.md`: оновлено 3 секції (дані, міжмодульні залежності, що не можна змінювати) + **нова секція "Карта документації"** з таблицями "куди писати" і "де шукати"
- Переписано `START_HERE.md` — був повністю застарілим (13 `app-*.js` файлів)
- Переписано `docs/ARCHITECTURE.md` — mermaid діаграми під `src/` структуру
- Архівовано `NEVERMIND_ARCH.md` — повний дубль `docs/ARCHITECTURE.md`, застарілий
- Оновлено дрібні посилання у `FEATURES_ROADMAP.md` і `docs/DESIGN_SYSTEM.md`
- `/fix` скіл: правильний шлях до BUGS файлу + новий крок оновлення BUGS після фіксу
- Додано детальний запис у `docs/CHANGES.md`

### Висновки першого тесту `/gemini`
- **Workflow робочий** — код-блок великий, але iPhone Gemini застосунок тримає
- **Gemini ≠ істина** — з 6 знахідок: 2 реальні + 1 дизайн-smell + 1 галюцинація + 2 правильні підтвердження
- **Друга думка має цінність** — B-13 (апостроф) Claude самостійно не помітив у попередніх аудитах

### Відкрите на майбутнє (окремі сесії)

**Виправлення багів:**
- `/fix B-13` — апостроф у `onclick` чіпів (критичний, бо б'є по українських словах з `'`)
- `/fix B-14` — `includes()` false positives (рефакторинг чіпів з явним `action` типом)
- `/fix B-15` — `setTimeout(100)` (тільки в рамках рефакторингу `openChatBar`)
- Верифікація B-03..B-12 проти `src/` — деякі могли виправитись під час рефакторингу

**Покращення скіла `/gemini`** (5 пунктів, окрема сесія):
1. Автоматичний збір імпорт-графа (давати Gemini не один файл, а підсистему)
2. Анти-галюцинаційні інструкції в промпті (дослівна цитата рядка коду)
3. Підключення `NEVERMIND_BUGS.md` в контекст (не повторювати відомі)
4. Повний `CLAUDE.md` замість урізаного (через запис промпту у файл щоб обійти output-ліміт Claude)
5. Самооцінка впевненості Gemini в кінці відповіді

### Висновки першого тесту `/gemini`
- **Workflow робочий** — код-блок великий, але iPhone Gemini застосунок тримає
- **Gemini ≠ істина** — з 6 знахідок: 2 реальні + 1 дизайн-smell + 1 галюцинація + 2 правильні підтвердження
- **Друга думка має цінність** — G-01 (апостроф) Claude самостійно не помітив у попередніх аудитах
- **Покращення скіла на майбутнє** (TODO, нова сесія):
  1. Автоматичний збір імпорт-графа (давати Gemini не один файл, а підсистему)
  2. Анти-галюцинаційні інструкції в промпті (вимагати точну цитату рядка)
  3. Підключення `NEVERMIND_BUGS.md` в контекст (не повторювати відомі)
  4. Повний `CLAUDE.md` замість урізаного (через запис промпту у файл щоб обійти output-ліміт Claude)
  5. Самооцінка впевненості Gemini в кінці відповіді

### Що Роман робить сам (поза репо)
- Видалив старий `GEMINI_API_KEY` на aistudio.google.com ✅
- Видаляє Railway-проект `humorous-gentleness` (сервіс `NeverMind`)
- Видаляє MCP-конектор з `claude.ai/code` → Settings → Connectors

---

## Попередня сесія (05.04 — inline стилі → CSS)

**Винесення inline стилів з JS у CSS-класи** — основна робота завершена.

---

## Остання сесія (05.04 — inline стилі → CSS)

### Що зроблено

**Створено 17 нових CSS-класів у style.css:**

Shared components (спільні компоненти):
- `.card-glass` — матова картка (background + border + border-radius:16px)
- `.card-glass-blur` — матова картка з backdrop-filter:blur (border-radius:20px)
- `.section-label` — заголовок секції (uppercase, 10px, letter-spacing:0.06em)
- `.fin-section-label` — заголовок фінансової секції (letter-spacing:0.07em)
- `.msg-bubble` + `.msg-bubble--agent` + `.msg-bubble--user` — бульбашки чату
- `.icon-circle` — іконка в колі (flex center, border-radius:9px)
- `.modal-backdrop` — фон модалки (overlay + blur)
- `.modal-handle` — ручка модалки (36x4px bar)
- `.modal-title` — заголовок модалки (17px, 800 weight)
- `.btn-cancel` — кнопка скасування
- `.btn-save-primary` — кнопка збереження (gradient)
- `.tx-row` — рядок транза��ції

Onboarding (онбординг):
- `.ob-list`, `.ob-item`, `.ob-icon-lg`, `.ob-icon`, `.ob-text`
- `.ob-example`, `.ob-desc`, `.ob-tag`, `.ob-slide-title`

### Файли змінено

| Файл | Було inline | Стало | Зменшення |
|------|----------:|------:|----------:|
| onboarding.js | 101 | 6 | −95 |
| finance.js | 148 | 120 | −28 |
| health.js | 74 | 65 | −9 |
| projects.js | 92 | 84 | −8 |
| tasks.js | — | — | −1 (msg-bubble) |
| evening.js | — | — | −2 (msg-bubble) |
| notes.js | — | — | −1 (msg-bubble) |
| nav.js | — | — | −1 (modal-handle) |
| **style.css** | — | +17 класів | +8 рядків |

**Загалом: ~145 inline стилів замінено на CSS-класи**

### Що залишилось (не винесено)

Решта inline стилів (~480) мають **динам��чні значення** (`${color}`, `${pct}%`, умовні стилі) — їх неможливо винести в статичний CSS без JS-логіки. Це прийнятний залишок.

---

## Файлова структура

| Файл | Рядки | Опис |
|------|------:|------|
| src/core/nav.js | 1069 | Навігація, теми, налаштування, пам'ять |
| src/core/boot.js | 378 | bootApp, PWA, cross-tab sync, init |
| src/core/trash.js | 123 | Кошик 7 днів, undo |
| src/core/utils.js | 61 | autoResize, formatTime, escapeHtml |
| src/core/logger.js | 136 | Error logging, console override |
| src/ai/core.js | 650 | AI контекст, callAI, чат, OWL особистість |
| src/owl/inbox-board.js | 1100 | OWL Board Inbox, ChatBar swipe |
| src/owl/board.js | 157 | OWL Tab Boards рендер |
| src/owl/proactive.js | 248 | Генерація проактивних повідомлень |
| src/owl/chips.js | 56 | owlChipToChat — навігація/текст |
| src/ui/keyboard.js | 165 | iOS keyboard avoiding |
| src/ui/swipe-delete.js | 51 | Swipe trail для видалення |
| src/tabs/inbox.js | 741 | Inbox + AI обробка |
| src/tabs/tasks.js | 566 | Задачі CRUD + чат |
| src/tabs/habits.js | 1191 | Звички build/quit |
| src/tabs/notes.js | 1162 | Нотатки, папки, пошук |
| src/tabs/finance.js | 1133 | Фінанси, бюджет, AI-коуч |
| src/tabs/evening.js | 978 | Моменти, підсумок, "Я" |
| src/tabs/onboarding.js | 954 | Онбординг, help, slides |
| src/tabs/health.js | 457 | Здоров'я, карточки |
| src/tabs/projects.js | 620 | Проекти, воркспейс |
| src/app.js | 35 | Entry point — імпорти |
| **style.css** | **1352** | **Всі стилі (+17 JS-extracted класів)** |

**Збірка:** `node build.js` → bundle.js (esbuild IIFE)

---

## Попередні сесії

- **05.04** — Inline стилі → CSS: 17 нових класів, ~145 inline стилів замінено в 8 файлах.
- **04.04 (6)** — Прибирання мусору: 2 мертві функції, 12 typeof guards, swipe-дублікати (−68 рядків), узгоджено AI промпти.
- **04.04 (5)** — ES Modules рефакторинг: 22 модулі import/export, 162 window handlers, аудит, очистка мертвого коду.
- **04.04 (4)** — Repo audit: handleScheduleAnswer TTL, людська мова, чіпи-навігація, пам'ять 30 повідомлень.
- **04.04 (3)** — Концептуальний редизайн: табло read-only, чіпи через чат-бар, owlChipToChat.
- **04.04 (2)** — OWL Board: аудит + inbox рефактор = структура вкладок.
- **03.04 (2)** — OWL Board: getDayPhase + getSchedule, Cooldown-система.
- **03.04** — settings.json хуки, 5 скілів, правило пояснень.
- **02.04** — Inbox стрічка: компактні картки. OWL Board: міні-чат.
- **01.04** — Реструктуризація доків. B-11/B-12.
- **31.03** — B-07/B-08/B-10. Deploy pipeline v2.

---

## Відкриті баги

- B-04/B-09 — тап на день в календарі не працює
- B-05 — картки обрізаються при скролі
- B-06 — поле вводу без blur/fade ефекту

---

## Наступне

1. ~~Inline ��тилі → CSS~~ ✓ зроблено
2. Баги B-04/B-09, B-05, B-06
3. Закріплені картки нагадувань
