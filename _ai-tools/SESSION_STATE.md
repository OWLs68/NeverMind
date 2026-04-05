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
- Видалено `_ai-tools/gemini-mcp/` (server.js, package.json, package-lock.json, README.md, .gitignore) — 5 файлів
- Створено `.claude/commands/gemini.md` — новий скіл
- Оновлено модель у скілі з `2.5 Pro` на `3 Pro` (актуальна модель станом на 04.2026)
- **Перший реальний тест скіла `/gemini`** на `src/owl/board.js` + `src/owl/chips.js` — workflow працює: код-блок → копіювання в застосунок Gemini на iPhone → відповідь → повернення в чат → арбітраж Claude
- Створено `_ai-tools/NEVERMIND_BUGS.md` — реєстр багів. Записано 3 знахідки з першого аудиту:
  - **G-01** (HIGH) — апостроф у `onclick` чіпів ламає клік на українських словах з `'`
  - **G-02** (MEDIUM) — `includes()` false positives у навігаційних чіпах
  - **G-03** (LOW) — `setTimeout(100)` у chips.js — тендітна синхронізація
- Оновлено цей SESSION_STATE.md

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
