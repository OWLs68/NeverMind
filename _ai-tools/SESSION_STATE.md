# Стан сесії

**Оновлено:** 2026-04-04 22:10

---

## Проект

| | |
|--|--|
| **Версія** | v70 |
| **URL** | owls68.github.io/NeverMind |
| **AI модель** | OpenAI GPT-4o-mini |
| **Гілка** | `claude/remove-dead-functions-ftmCH` |

---

## Зараз робимо

**Прибирання мусору після ES Modules рефакторингу** — пункти 1-3 з аудиту завершені.

---

## Остання сесія (04.04, шоста частина — прибирання мусору)

### Що зроблено (пункти 1-3 з аудиту мусору)

**1. Видалено 2 мертві функції** (inbox-board.js):
- `updateOwlChipsArrows()` і `scrollOwlChips()` — одно-рядкові обгортки, 0 викликів
- Прибрано зайві імпорти `_updateOwlTabChipsArrows`, `scrollOwlTabChips`

**2. Прибрано 12 зайвих typeof перевірок** (5 файлів):
- keyboard.js (7), inbox-board.js (2), proactive.js (1), board.js (1), projects.js (1)
- Після ES Modules всі функції гарантовано визначені через import/export

**3. Об'єднано дублікати swipe в habits.js** (−44 рядки):
- Створено `_createHabitSwipe(stateObj, prefix, toggleFn)` — фабрика обробників
- `habitMeSwipe*` і `prodHabitSwipe*` — тонкі обгортки над єдиною реалізацією
- habits.js: 1235 → 1191 рядків (під поріг 1200)

### Що залишилось доробити

**4. Промпти AI — 3 неузгодженості:**
- chips: inbox-board.js "враховуй що знаєш" vs proactive.js "НЕ додавай випадкові"
- Пріоритизація є тільки в inbox-board.js, не в proactive.js
- ~30 рядків дублювання між промптами

**5. Inline стилі (не критично, окремий рефакторинг):**
- border-radius:12px повторюється 47 разів
- display:flex;align-items:center — 40+ разів
- Файл finance.js — 161 рядок inline HTML/стилів

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
| src/owl/proactive.js | 234 | Генерація проактивних повідомлень |
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

**Збірка:** `node build.js` → bundle.js (11044 рядків, esbuild IIFE)

---

## Попередні сесії

- **04.04 (6)** — Прибирання мусору: видалено 2 мертві функції, 12 typeof guards, об'єднано swipe-дублікати (−68 рядків).
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

1. ~~Прибирання мусору (пункти 1-3)~~ ✓ зроблено
2. Прибирання мусору (пункти 4-5 — промпти AI, inline стилі)
3. Баги B-04/B-09, B-05, B-06
3. Закріплені картки нагадувань
