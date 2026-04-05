# Стан сесії

**Оновлено:** 2026-04-05 (кінець сесії investigate-account-block)

---

## Проект

| | |
|--|--|
| **Версія** | v70 |
| **URL** | owls68.github.io/NeverMind |
| **AI модель** | OpenAI GPT-4o-mini (ключ у `localStorage`, назва `nm_gemini_key` — legacy) |
| **Гілка** | `claude/investigate-account-block-bxmCZ` (готова до авто-мержу) |

---

## ⚠️ ДЛЯ НОВОГО ЧАТУ — найважливіше

**1. ПРАВИЛО №1:** завжди пояснювати в дужках ВСЕ не-українською — англіцизми, сленг, назви функцій, технічні терміни. Роман вчиться через пояснення. Деталі → `CLAUDE.md` верхня секція "ОБОВ'ЯЗКОВО В КОЖНОМУ ПОВІДОМЛЕННІ". Claude у минулій сесії постійно це порушував — не повторюй.

**2. Скіл `/gemini` працює.** Ручний workflow копіювання в застосунок Gemini на iPhone. Використовується для другої думки при аудиті коду або архітектурних питаннях. Покращення скіла (5 пунктів) — у backlog нижче.

**3. Документація в чистому стані.** Усі посилання `app-*.js` → `src/` оновлені. Нова секція "Карта документації" в `CLAUDE.md` — там куди писати що.

**4. 3 нові баги чекають на виправлення** — B-13 (🔴 критичний, апостроф у `onclick`), B-14, B-15. Деталі в `NEVERMIND_BUGS.md`. Команда: `/fix B-13` тощо.

---

## Що було зроблено в сесії 05.04 (investigate-account-block)

### Контекст: чому почалась сесія
Попередня сесія `01ADwSEQttu5G2s4LUkBrydv` була заблокована secret scanner'ом Anthropic — Роман засвітив `GEMINI_API_KEY` у чаті коли дебажив Railway-деплоймент MCP-сервера `_ai-tools/gemini-mcp/`. Нова сесія (ця) вирішила як рухатись далі.

### 10 комітів (усі запушені)

1. `ebdf2ad` — видалення Gemini MCP експерименту (`_ai-tools/gemini-mcp/` з 5 файлів) + створення скіла `/gemini` з ручним workflow
2. `e37a338` — оновлення моделі Gemini 2.5 → 3 Pro у скілі
3. `e237427` — запис знахідок Gemini в `_ai-tools/NEVERMIND_BUGS.md` (випадковий дубль)
4. `70a3170` — **консолідація BUGS**: видалено дубль в `_ai-tools/`, старі баги (B-03..B-12) переведено на `src/` шляхи, додано B-13/B-14/B-15 від Gemini
5. `33be5df` — **CLAUDE.md частина 1**: 3 секції `app-*.js` → `src/` + нова секція "Карта документації"
6. `a3f2dd8` — **START_HERE.md переписано** + `docs/ARCHITECTURE.md` оновлено + `NEVERMIND_ARCH.md` заархівовано
7. `91b1fff` — дрібні посилання (`FEATURES_ROADMAP.md`, `docs/DESIGN_SYSTEM.md`) + запис у `docs/CHANGES.md`
8. `71334c4` — фінальна чистка залишків (`CLAUDE.md` `app-db.js` + повний перепис скіла `/new-file` який був повністю застарілим)
9. `7c3b009` — **критичний аудит правил**: видалено 6 дублів між `CLAUDE.md` і `РОМАН_ПРОФІЛЬ.md`, об'єднано "Сперечайся + Пропонуй кращі рішення", переформульовано Mockup → "UI опиши перед кодом", кожне правило "Що не можна змінювати" розгорнуто з поясненнями в дужках, додано заборону фіолетового в `docs/DESIGN_SYSTEM.md`, виняток для `CACHE_NAME` при docs-only комітах
10. (цей коміт) — посилення правила "Пояснення в дужках" з SAMPLE-перевіркою перед відправкою + фінальний апдейт `SESSION_STATE.md` і `docs/CHANGES.md`

### Стан документації ПІСЛЯ сесії

**Чисто і узгоджено:**
- ✅ `START_HERE.md` — правильна `src/` ієрархія, посилання на `/gemini`
- ✅ `CLAUDE.md` — секція "Карта документації" + правила без дублів + пояснення в дужках посилені
- ✅ `NEVERMIND_BUGS.md` — єдиний source of truth, 7 старих B-XX з `src/` шляхами + 3 нові від Gemini
- ✅ `docs/ARCHITECTURE.md` — mermaid діаграми під `src/` структуру
- ✅ `docs/DESIGN_SYSTEM.md` — додано заборону фіолетового
- ✅ `РОМАН_ПРОФІЛЬ.md` — тільки про Романа як людину, без дублікатів правил
- ✅ `.claude/commands/new-file.md` — переписано під `src/` ES-modules workflow (був небезпечно застарілий)
- ✅ `.claude/commands/fix.md` — правильний шлях до `NEVERMIND_BUGS.md`
- ✅ `.claude/commands/gemini.md` — новий скіл, модель Gemini 3 Pro, інструкції з копіювання

**Заархівовано:** `NEVERMIND_ARCH.md` → `_archive/` (повний дубль `docs/ARCHITECTURE.md`, застарілий).

---

## Перший реальний тест скіла `/gemini` (додатковий бонус)

Тест пройшов на `src/owl/board.js` + `src/owl/chips.js`. Gemini 3 Pro у застосунку на iPhone знайшов:

- **B-13** 🔴 — апостроф у `onclick` чіпів ламає клік на українських словах з `'` (п'ять, м'ясо, сім'я)
- **B-14** 🟡 — `includes()` у `owlChipToChat` дає false positives у навігаційних чіпах
- **B-15** 🟢 — `setTimeout(100)` у chips.js — тендітна синхронізація
- **Галюцинація (wontfix)** — "синтаксична помилка `<msg.id>`" якої в коді немає. Claude заарбітрував, урок: перевіряти точну цитату Gemini перед виправленням.

Висновки: workflow робочий, Gemini дає цінність, але **не можна вірити наосліп** — Claude як арбітр обов'язковий.

---

## Відкрите на майбутнє (для нових сесій)

### 🔴 Виправлення багів

```
/fix B-13   — апостроф у onclick (КРИТИЧНО — ламає українські слова)
/fix B-14   — includes() false positives (рефакторинг чіпів)
/fix B-15   — setTimeout magic number (низький пріоритет)
```

Також верифікація старих B-03..B-12 — деякі могли бути виправлені під час ES-modules рефакторингу, треба перевіряти кожен окремо проти реального коду в `src/`.

### 🔧 Покращення скіла `/gemini` (5 пунктів, окрема сесія)

1. **Автоматичний збір імпорт-графа** — коли аудит торкається файлу X, скіл автоматично додає файли з яких X імпортує. Дає Gemini контекст суміжних функцій.
2. **Анти-галюцинаційні інструкції** — у промпті до Gemini вимагати дослівну цитату рядка коду з файлу + розділяти знахідки на `[ПІДТВЕРДЖЕНО]` / `[ПІДОЗРА]` / `[СПОСТЕРЕЖЕННЯ]`.
3. **Підключення `NEVERMIND_BUGS.md`** в контекст Gemini — щоб не повторював відомі баги.
4. **Повний `CLAUDE.md`** замість урізаного. Якщо не влізає в output-ліміт Claude — писати промпт у файл `_ai-tools/gemini-prompt-tmp.md` і давати Роману raw GitHub URL для копіювання.
5. **Самооцінка Gemini** в кінці відповіді — % впевненості + яких файлів бракувало для точнішої відповіді.

### Що Роман зробив поза репо (підтверджено)
- ✅ Видалив засвічений `GEMINI_API_KEY` на aistudio.google.com
- ✅ Видалив Railway-проект `humorous-gentleness`
- ✅ Видалив MCP-конектор з `claude.ai/code` → Settings → Connectors

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
