# Стан сесії

> **Компактний формат (з 20.04.2026 g05tu):** таблиця всіх активних сесій + бриф поточної. Детальні описи кожної сесії → [`docs/CHANGES.md`](../docs/CHANGES.md) (хронологічний журнал).
>
> Старіші сесії (до 6GoDe 19.04) — в [`_archive/SESSION_STATE_archive.md`](../_archive/SESSION_STATE_archive.md).

**Оновлено:** 2026-04-20 (сесія **EWxjG** — **B-93 + B-94 + B-95 закриті у 3 комітах, B-94 другий підхід з history detox**).

---

## ⚠️ ДЛЯ НОВОГО ЧАТУ — найважливіше

1. **✅ B-94/B-95 закриті одним пакетом.** У промпт `src/tabs/health.js` на початок (після "OWL НЕ ЛІКАР") доданий блок "🚫 ЖОРСТКЕ ПРАВИЛО UI-TOOLS У ЗДОРОВ'Ї" — явний список дозволених тригерів UI + явні заборони з прикладами: "Алергія на X" → ТІЛЬКИ `add_allergy`, "Завтра прийом о HH" → ТІЛЬКИ `create_event`, "прийом/лікар" — НЕ тригер `switch_tab`. Правило сумніву: якщо фраза не починається з "відкрий/покажи/перейди/переключись/будь/експортуй" — це CRUD, не UI-tool.

2. **🚨 Залишився 1 баг з iPhone-тесту v325 (🟡 наступний пріоритет):**
   - **B-93 🟡** Чіпи у Inbox chat обрізані знизу (layout) — окрема CSS-правка у `style.css` або `inbox.js _parseContentChips`. Гіпотеза: `.chat-chips-row` рендериться після бульбашки, висота чат-вікна не враховує додатковий рядок; авто-скрол `msgs.scrollTop = scrollHeight` скролить до бульбашки, не до чіпів.

3. **🧠 Після B-93 — "Один мозок V2"** (3-4 сесії, Active у ROADMAP):
   - Шар 1: паритет дій у 8 чатах через повний `INBOX_TOOLS`
   - Шар 2: єдине табло `nm_owl_board_unified` з призмою вкладки
   - Шар 3: спільна історія `nm_owl_conversation` + event `nm-tab-switched`

4. **CACHE_NAME** актуальне: `nm-20260420-2040` (з EWxjG коміт 3). При зміні коду у src/**/*.js, style.css, sw.js, index.html — оновлювати.

5. **Workflow Романа:** "Роби" → один таск → звіт → пропозиція наступного → чекати. Файли >250 рядків — skeleton+Edit, checkpoint-коміт після кожної фази, ≤25 слів між tool calls.

---

## Проект

| Параметр | Значення |
|---|---|
| **Версія** | v335 на проді (після EWxjG очікуємо v336+) |
| **URL** | owls68.github.io/NeverMind |
| **AI модель** | OpenAI GPT-4o-mini з Tool Calling (46 tools: 31 INBOX + 7 UI + 8 health/memory/cat) |
| **Гілка** | `claude/start-session-EWxjG` (B-94/B-95 прoмпт Здоров'я) |
| **CACHE_NAME** | `nm-20260420-2040` |
| **Repo** | Public + LICENSE (All Rights Reserved) |

---

## 🗺️ Куди йде проект

**Дорожня карта:** [`ROADMAP.md`](../ROADMAP.md) — Active / Next / Ideas / Rejected / After Supabase.
**Виконане:** [`ROADMAP_DONE.md`](../ROADMAP_DONE.md).
**Концепції вкладок:** [`CONCEPTS_ACTIVE.md`](../CONCEPTS_ACTIVE.md).

**🚀 Поточний Active:**
- **Фікс B-93** (наступна сесія, ~20-30 хв) — чіпи у Inbox chat обрізані
- **Один мозок V2** (після B-93) — 3-4 сесії

---

## 📋 Журнал сесій (останні)

| ID | Дата | Закрито / Зроблено | Коміти | Гілка | Деталі |
|---|---|---|---|---|---|
| **EWxjG** | 20.04 | B-94/B-95 пакетом: блок "🚫 ЖОРСТКЕ ПРАВИЛО UI-TOOLS У ЗДОРОВ'Ї" на початку промпту `health.js`. Явний whitelist UI-тригерів + явна заборона ("Алергія на X" → add_allergy; "прийом о HH" → create_event). CACHE_NAME bump nm-20260420-1948→2022 | 1 | `claude/start-session-EWxjG` | [CHANGES §20.04-EWxjG](../docs/CHANGES.md) |
| 2Veg1 | 20.04 | Нова apple-touch-icon: сова-логотип (лайн-арт на беж-папері) через base64 у index.html рядок 18. 2 ітерації (перша обрізала ноги через iOS-заокруглення, друга з запасом ~80px — fix). CACHE_NAME bump nm-20260420-1120→1948 | 2 | `claude/start-session-2Veg1` (merged) | [CHANGES §20.04-2Veg1](../docs/CHANGES.md) |
| g05tu | 20.04 | Рефакторинг документації + «мозок» Claude: 5 фаз, 6 комітів, стартове читання 2164→1420 (−34%). Створено lessons.md, INDEX.md, 4 автоматичних хуки, 5 нових винесених файлів | 6 | `claude/start-session-g05tu` (merged) | [CHANGES §20.04-g05tu](../docs/CHANGES.md) |
| NRw8G | 20.04 | B-84..B-92 (9 багів з iPhone v322 тесту), parity `save_memory_fact` у 3 чатах, додано новий Active "Один мозок V2" | 9 | `claude/start-session-NRw8G` (merged) | [CHANGES §20.04-NRw8G](../docs/CHANGES.md) |
| JvzDi | 19.04 | B-81..B-83 (switch_tab промпт, set_theme плацебо прибрано, чіпи у Inbox chat через `_parseContentChips`) | 2 | `claude/start-session-JvzDi` (merged) | [CHANGES §19.04-JvzDi](../docs/CHANGES.md) |
| 6GoDe | 19.04 | 8 фіксів якості + Здоров'я 100% (Фаза 6 інтерв'ю) + legacy шкал cleanup | 8 | `claude/start-session-6GoDe` (merged) | [CHANGES §19.04-6GoDe](../docs/CHANGES.md) |
| dIooU | 19.04 | Вечір 2.0 Фази 1-8 (MVP виконано повністю) | 10+ | merged | [CHANGES §19.04-dIooU](../docs/CHANGES.md) |
| QV1n2 | 19.04 | Вечір 2.0 планування + Фаза 0 рефакторингу evening.js 1054→413 + 4 нові модулі | merged | [CHANGES §19.04-QV1n2](../docs/CHANGES.md) |
| rSTLV | 19.04 | Відкат маскот-сови, повернення до 🦉 емодзі | merged | [CHANGES §19.04-rSTLV](../docs/CHANGES.md) |
| NFtzw | 18.04 | (попередні) | — | [archive](../_archive/SESSION_STATE_archive.md) |
| **попередні** | | dIooU/QV1n2/NFtzw/uDZmz/rSTLV/w3ISi/VJF2M/Vydqm/FMykK/14zLe/KTQZA/gHCOh/cnTkD/hHIlZ/W6MDn/VAP6z/acZEu/E5O3I/3229b/6v2eR/jMR6m | — | — | [archive](../_archive/SESSION_STATE_archive.md) |

---

## 🔧 Поточна сесія EWxjG — B-94/B-95 фікс промпту Здоров'я (20.04.2026)

### Мета
Закрити два критичні баги з iPhone-тесту v325:
- **B-94** — "Алергія на пил" у чаті Здоров'я → AI викликав `set_owl_mode(Наставник)` замість `add_allergy`.
- **B-95** — "Завтра прийом у лікаря на 2" у чаті Здоров'я → AI викликав `switch_tab(calendar)` замість `create_event`.

### Корінь проблеми
Архітектура чату Здоров'я (`health.js:1606`) передає у OpenAI два види дій одночасно: UI-tools як справжні API-інструменти (`tools:` параметр) + CRUD (алергії/події/симптоми) як JSON у тексті відповіді (парситься регексом). AI завжди тягне до "справжнього" інструменту коли є хоч натяк на відповідний тригер — бо функції вагоміші за текст. Заборона `🚫 ЗАБОРОНА UI-INST` у промпті знаходилась занадто глибоко (рядок 1585), AI її проскакував.

### Зроблено
**Коміт `[hash]` — пакетний фікс.** Додав блок "🚫 ЖОРСТКЕ ПРАВИЛО UI-TOOLS У ЗДОРОВ'Ї" **одразу після блоку "OWL НЕ ЛІКАР"** (рядок 1551 у `src/tabs/health.js`) — тобто як НАЙВИЩИЙ ПРІОРИТЕТ перед усім іншим контентом промпту. Блок містить:
- **Whitelist UI-тригерів:** тільки явні "відкрий / покажи / перейди до / переключись на Тренера-Партнера-Ментора / будь Y-ом / експортуй медкартку".
- **Чорний список для Здоров'я:** "Алергія на X" → ЗАВЖДИ `add_allergy` (X — алерген, НЕ тригер `set_owl_mode`); "Завтра/сьогодні/у п'ятницю прийом о HH" → ЗАВЖДИ `create_event` ("прийом/лікар" — НЕ тригер `switch_tab`); симптоми → CRUD; ліки → log_medication_dose/save_moment.
- **Правило сумніву:** якщо фраза не починається з явної команди навігації — це CRUD, не UI.

CACHE_NAME bump `nm-20260420-1948` → `nm-20260420-2022`. Збірка `node build.js` пройшла чисто (exit code 0). `bundle.js` оновлений автоматично.

### Інциденти
- `node build.js` не стартував без `esbuild` — довелось встановити локально через `npm install --no-save esbuild`.

### Метрики
- **Коміти:** 1 (код + документація в одному)
- **CACHE_NAME:** `nm-20260420-1948` → `nm-20260420-2022`
- **Гілка:** `claude/start-session-EWxjG`
- **Файли:** `src/tabs/health.js` (+16 рядків у промпт), `sw.js` (CACHE_NAME), `bundle.js` (автозбірка), `NEVERMIND_BUGS.md` (B-94/B-95 → Закриті), `_ai-tools/SESSION_STATE.md` (цей файл)
