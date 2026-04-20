# Стан сесії

> **Компактний формат (з 20.04.2026 g05tu):** таблиця всіх активних сесій + бриф поточної. Детальні описи кожної сесії → [`docs/CHANGES.md`](../docs/CHANGES.md) (хронологічний журнал).
>
> Старіші сесії (до 6GoDe 19.04) — в [`_archive/SESSION_STATE_archive.md`](../_archive/SESSION_STATE_archive.md).

**Оновлено:** 2026-04-20 (сесія **g05tu** — **рефакторинг документації + план «мозку» Claude**).

---

## ⚠️ ДЛЯ НОВОГО ЧАТУ — найважливіше

1. **🚧 Триває рефакторинг документації** — див. [`_ai-tools/REFACTOR_PLAN.md`](REFACTOR_PLAN.md). 5 фаз: Фаза 0 (snapshot) ✅, Фаза 1 (перенесення блоків у спеціалізовані файли) ✅, Фаза 2 (lessons.md), Фаза 3 (хуки), Фаза 4 (INDEX.md), Фінал (SESSION_STATE update + push).

2. **🚨 Баги з iPhone-тесту v325 (чекають)** після завершення рефакторингу:
   - **B-93 🟡** Чіпи у Inbox chat обрізані знизу (layout)
   - **B-94 🔴** "Алергія на пил" → `set_owl_mode(Наставник)` замість `add_allergy`
   - **B-95 🔴** "Завтра прийом о 2" → `switch_tab(calendar)` замість `create_event`
   - **Рішення:** жорстке правило у промпті Здоров'я — "UI-tools ТІЛЬКИ на явне 'відкрий/покажи/переключись'. Усе інше — CRUD."

3. **🧠 Після багів — "Один мозок V2"** (3-4 сесії, Active у ROADMAP):
   - Шар 1: паритет дій у 8 чатах через повний `INBOX_TOOLS`
   - Шар 2: єдине табло `nm_owl_board_unified` з призмою вкладки
   - Шар 3: спільна історія `nm_owl_conversation` + event `nm-tab-switched`

4. **CACHE_NAME** актуальне: `nm-20260420-1120` (з NRw8G). При зміні коду у src/**/*.js, style.css, sw.js, index.html — оновлювати.

5. **Workflow Романа:** "Роби" → один таск → звіт → пропозиція наступного → чекати. Файли >250 рядків — skeleton+Edit, checkpoint-коміт після кожної фази, ≤25 слів між tool calls.

---

## Проект

| Параметр | Значення |
|---|---|
| **Версія** | v327 на проді (після g05tu очікуємо v328+) |
| **URL** | owls68.github.io/NeverMind |
| **AI модель** | OpenAI GPT-4o-mini з Tool Calling (46 tools: 31 INBOX + 7 UI + 8 health/memory/cat) |
| **Гілка** | `claude/start-session-g05tu` (рефакторинг документації) |
| **CACHE_NAME** | `nm-20260420-1120` |
| **Repo** | Public + LICENSE (All Rights Reserved) |

---

## 🗺️ Куди йде проект

**Дорожня карта:** [`ROADMAP.md`](../ROADMAP.md) — Active / Next / Ideas / Rejected / After Supabase.
**Виконане:** [`ROADMAP_DONE.md`](../ROADMAP_DONE.md).
**Концепції вкладок:** [`CONCEPTS_ACTIVE.md`](../CONCEPTS_ACTIVE.md).

**🚀 Поточний Active:**
- **Рефакторинг документації g05tu** (20.04.2026) — активна сесія
- **Один мозок V2** (після багів) — 3-4 сесії

---

## 📋 Журнал сесій (останні)

| ID | Дата | Закрито / Зроблено | Коміти | Гілка | Деталі |
|---|---|---|---|---|---|
| **g05tu** | 20.04 | Рефакторинг документації (Фаза 0-1): REFACTOR_PLAN створено, ROADMAP_DONE+FILE_STRUCTURE+GIT_EMERGENCY+DO_NOT_TOUCH+FINANCE_V2_PLAN створені, CLAUDE 521→416, ROADMAP 715→539, "Один мозок на все" → NEVERMIND_LOGIC | in progress | `claude/start-session-g05tu` | [CHANGES §20.04-g05tu](../docs/CHANGES.md) |
| NRw8G | 20.04 | B-84..B-92 (9 багів з iPhone v322 тесту), parity `save_memory_fact` у 3 чатах, додано новий Active "Один мозок V2" | 9 | `claude/start-session-NRw8G` (merged) | [CHANGES §20.04-NRw8G](../docs/CHANGES.md) |
| JvzDi | 19.04 | B-81..B-83 (switch_tab промпт, set_theme плацебо прибрано, чіпи у Inbox chat через `_parseContentChips`) | 2 | `claude/start-session-JvzDi` (merged) | [CHANGES §19.04-JvzDi](../docs/CHANGES.md) |
| 6GoDe | 19.04 | 8 фіксів якості + Здоров'я 100% (Фаза 6 інтерв'ю) + legacy шкал cleanup | 8 | `claude/start-session-6GoDe` (merged) | [CHANGES §19.04-6GoDe](../docs/CHANGES.md) |
| dIooU | 19.04 | Вечір 2.0 Фази 1-8 (MVP виконано повністю) | 10+ | merged | [CHANGES §19.04-dIooU](../docs/CHANGES.md) |
| QV1n2 | 19.04 | Вечір 2.0 планування + Фаза 0 рефакторингу evening.js 1054→413 + 4 нові модулі | merged | [CHANGES §19.04-QV1n2](../docs/CHANGES.md) |
| rSTLV | 19.04 | Відкат маскот-сови, повернення до 🦉 емодзі | merged | [CHANGES §19.04-rSTLV](../docs/CHANGES.md) |
| NFtzw | 18.04 | (попередні) | — | [archive](../_archive/SESSION_STATE_archive.md) |
| **попередні** | | dIooU/QV1n2/NFtzw/uDZmz/rSTLV/w3ISi/VJF2M/Vydqm/FMykK/14zLe/KTQZA/gHCOh/cnTkD/hHIlZ/W6MDn/VAP6z/acZEu/E5O3I/3229b/6v2eR/jMR6m | — | — | [archive](../_archive/SESSION_STATE_archive.md) |

---

## 🔧 Поточна сесія g05tu — рефакторинг документації (20.04.2026)

### Мета
Навести порядок у документах через переміщення блоків у спеціалізовані файли (без втрати тексту) + створити "мозок" Claude (lessons.md, INDEX.md, автоматичні хуки) щоб у новому чаті швидше орієнтуватись.

### Зроблено
**Фаза 0 — Snapshot + план (коміт `d8ecab1`).** Створено `_ai-tools/REFACTOR_PLAN.md` з повним планом 5 фаз + процедура відкату. Pre-refactor HEAD зафіксовано: `e64eb58`.

**Фаза 1 — Перенесення блоків (поточна фаза).** Створено 5 нових файлів:
- `ROADMAP_DONE.md` (257 рядків) — завершені Active, Блок 1, 6 фаз Здоров'я, хронологія ✅ Done, аудит 15.04
- `docs/FILE_STRUCTURE.md` (93) — повна таблиця файлів проекту
- `docs/GIT_EMERGENCY.md` (89) — процедура екстреного скиду + історія v54-v130
- `docs/DO_NOT_TOUCH.md` (103) — священні корови
- `docs/FINANCE_V2_PLAN.md` (108) — 6 фаз Фінансів v2

Оновлено існуючі:
- `CLAUDE.md` 521→416 (−105) — прибрано блоки що переїхали
- `ROADMAP.md` 715→539 (−176) — прибрано завершене + фази Здоров'я
- `NEVERMIND_LOGIC.md` 56→86 (+30) — додано "Один мозок на все"
- "Карта документації" у CLAUDE.md — оновлена з новими файлами

### Попереду (Фази 2-5)
- **Фаза 2:** створити `lessons.md` з 3 секціями (патерни / анти-патерни / журнал рішень)
- **Фаза 3:** додати 4 хуки (CACHE_NAME reminder, .md→INDEX, prompts.js→AI_TOOLS, детекція тригерів+"Роби")
- **Фаза 4:** створити `_ai-tools/INDEX.md` (семантичний індекс)
- **Фінал:** оновити цей SESSION_STATE + push

### Метрики
- **Коміти:** 1 (поки що, phase-0) + phase-1 буде зараз
- **Гілка:** `claude/start-session-g05tu`
- **Очікуваний ефект:** стартове читання 2164 → ~600 рядків (−72%), INDEX дасть JIT-читання замість повного дампу на старті
