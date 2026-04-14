# Стан сесії

**Оновлено:** 2026-04-13 (сесія PBybp — **Блок 1 повністю закритий**)

---

## Проект

| | |
|--|--|
| **Версія** | v165+ (деплої через auto-merge) |
| **URL** | owls68.github.io/NeverMind |
| **AI модель** | OpenAI GPT-4o-mini з **Tool Calling** (26 tools) |
| **Гілка** | `claude/start-session-PBybp` |
| **Repo** | Public + LICENSE (All Rights Reserved) |

---

## 🗺️ Куди йде проект

**Дорожня карта — єдине місце:** [`ROADMAP.md`](../ROADMAP.md) у корені репо.

**Поточний Active:** Блок 2 — Концепції вкладок (core UX). Стартує з аудиту стану 5 вкладок (Фінанси/Вечір/Я/Проекти/Здоров'я/Календар) — прочитати код + порівняти з `CONCEPTS_ACTIVE.md`, дати статус по кожній (~30 хв).

---

## Останні сесії

- **13.04 (EdsNg)** — **консолідація плану** у `ROADMAP.md` (3 коміти):
  1. `d0412d9` — створено `ROADMAP.md` (232 рядки), архівовано `FEATURES_ROADMAP.md` + старий `SESSION_STATE.md`, оновлено посилання у 5 файлах
  2. `b7cbe9c` — розширення: автори біля пунктів (Grok/Gemini/GPT-4o/DeepSeek), складність, повні описи, 6 відкритих питань для "Динамічного розпорядку", ризики Блоку 7, нові секції (🧭 Архітектурні принципи, 🔬 Perplexity дослідження, 🔗 Посилання). ROADMAP виріс 232→449 рядків — стратегічний документ з повним контекстом. У Блок 2 додано "Календар — доробка (~80%)" (6-та вкладка на доробці)
  3. `[TBD]` — додано 5 запозичень з добірки скілів (`agent-core`, `notebookLM-skill`, `theme-factory`): retry для tool calls + promts.js в Блок 1, AI-декомпозиція Проектів + інтелект-карта тижня у Я в Блок 2, готові теми в Блок 6, AI-теми за промптом в After Supabase
- **13.04 (gQ2Hl)** — Фаза 1.1 (об'єднання табло), 1.2 (чат бачить історію табло), 3.6 (Smart Boot-up), 3.7 (емпатія), 3.8 (прокрастинація), 3.10 (кореляції), 3.11 (навігаційні чіпи), 3.13 (OWL питає темп), `fix(memory)` захист від сміття
- **12.04 (YbLTH)** — 4.3 Semantic cooldowns, правило перспективи, fallback "Запам'ятав ✓", правило "глибина відповіді" в CLAUDE.md
- **11.04 (FPKOV + B29hd)** — Крок 1 уніфікація Judge Layer, Крок 2 Структурована пам'ять фактів (`nm_facts`), бізнес-модель freemium зафіксовано
- **10.04** — 4.1 Tool Calling (25 tools), Live Chat Replies Фаза 2.0
- **09.04** — B-23/B-24/B-25 закриті, Календар повна переробка

---

## ⚠️ Для нового чату — найважливіше

1. **ПРАВИЛО №1** — пояснення в дужках ВСЕ не-українською. Деталі → `CLAUDE.md` секція "ОБОВ'ЯЗКОВО В КОЖНОМУ ПОВІДОМЛЕННІ"
2. **РОЗМІР ВІДПОВІДЕЙ** — середній (5-15 рядків). Не простирадла.
3. **Без "Роби" — код не чіпати.**
4. **ГЛИБИНА ВІДПОВІДІ** — читай код перед оцінкою, не "на пам'ять". Урок з PBybp: пункт `set_reminder` у ROADMAP виглядав як TODO, а насправді вже був зроблений у коміті `f1ab11f` з 10.04 — прочитав код і зрозумів це замість того щоб реалізовувати з нуля.
5. **ОДИН МОЗОК НА ВСЕ** — OWL = єдиний Jarvis. Повний план → `ROADMAP.md`
6. **Бізнес-модель (11.04)** — freemium + API на сервері Supabase Edge Functions (не BYOK)

---

## 🆕 Нові ключі localStorage (після сесії PBybp)

| Ключ | Тип | Призначення | Модуль |
|------|-----|-------------|--------|
| `nm_owl_silence_until` | string (ts) | 4.40 Auto-silence — до якого часу OWL мовчить | `proactive.js`, `inbox-board.js` |
| `nm_owl_ignored_msgs` | string (count) | Лічильник проігнорованих повідомлень поспіль | `proactive.js`, `chips.js` |
| `nm_owl_last_board_ts` | string (ts) | Таймстемп останнього згенерованого повідомлення табло | `proactive.js` |
| `nm_owl_last_chip_click_ts` | string (ts) | Таймстемп останнього кліку будь-якого чіпа | `chips.js` |

Повну таблицю всіх ключів → `CLAUDE.md` секція "Дані (localStorage)".

---

## Ключові файли (швидке нагадування)

| Файл | Опис |
|------|------|
| `src/ai/core.js` | `getAIContext`, `callAI`, `callAIWithTools`, 26 `INBOX_TOOLS`, OWL особистість. **+13.04:** `lastChatClosedTs` для 4.5, правило G12 у `universal`, `callOwlChat` історія 4 обміни |
| `src/ai/memory.js` | Структурована пам'ять фактів (`nm_facts`) — CRUD, TTL, міграція |
| `src/owl/inbox-board.js` | Judge Layer (`shouldOwlSpeak`). **+13.04:** guard 4.40 на початку `_judgeBoard`, жорсткий блок чат-4.5, `document.hidden` guard у `tryOwlBoardUpdate` |
| `src/owl/proactive.js` | Генерація табло, `getBoardContext`. **+13.04:** детектор 4.40 у `generateBoardMessage`, `document.hidden` guards у `tryTabBoardUpdate` + data-changed listener |
| `src/owl/followups.js` | Live Chat Replies. **+13.04:** `document.hidden` guard на початку `checkFollowups` |
| `src/owl/chips.js` | Центральний модуль чіпів. **+13.04:** `trackChipClick` скидає 4.40 counter + записує click ts; CHIP_PROMPT_RULES починається з правила G11 |
| `src/tabs/inbox.js` | `sendToAI`, tool calling. **+13.04:** `navigateInboxItem` обробляє reminder (→ Calendar modal), `_renderUpcoming` розрізнює іконки |
| `src/tabs/calendar.js` | `nm_events`, Calendar/Routine/Day-schedule модалки |

Повна таблиця файлів → `CLAUDE.md` секція "Файлова структура".
