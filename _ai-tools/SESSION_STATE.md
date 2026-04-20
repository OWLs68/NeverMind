# Стан сесії

> **Компактний формат (з 20.04.2026 g05tu):** таблиця всіх активних сесій + бриф поточної. Детальні описи кожної сесії → [`docs/CHANGES.md`](../docs/CHANGES.md) (хронологічний журнал).
>
> Старіші сесії (до 6GoDe 19.04) — в [`_archive/SESSION_STATE_archive.md`](../_archive/SESSION_STATE_archive.md).

**Оновлено:** 2026-04-20 (сесія **EWxjG** — **B-93 закритий (CSS), B-94/B-95 два промпт-підходи провалились, повернуті у 🔴 Критичні — треба архітектурний Шар 1 "Один мозок V2"**).

---

## ⚠️ ДЛЯ НОВОГО ЧАТУ — найважливіше

1. **🎯 Головна задача наступної сесії — Шар 1 "Один мозок V2" для чату Здоров'я.** Мігрувати CRUD дії (`add_allergy` / `delete_allergy` / `create_event` / `edit_event` / `delete_event` / `add_health_history_entry` / `create_health_card` / `edit_health_card` / `add_medication` / `log_medication_dose` / `save_memory_fact`) з поточного text-JSON формату на повноцінні OpenAI Tool Calling (як зараз працює Inbox через `INBOX_TOOLS`). Частина tools вже описана у `src/ai/prompts.js` — перевірити і підключити до `sendHealthBarMessage`. Тоді модель матиме однорідний вибір: `add_allergy` і `set_owl_mode` на одному рівні → промпт "Алергія → add_allergy" почне реально працювати.

2. **🚨 Відкриті критичні баги:** B-94 ("Алергія на пил" → випадковий UI-tool) і B-95 ("Завтра прийом у лікаря" → випадковий UI-tool). В EWxjG два промпт-підходи (коміти `379f13e`, `6fa67e2`) не закрили. Корінь архітектурний — див. запис у `docs/CHANGES.md` §20.04-EWxjG. Вирішуються разом з Шаром 1.

3. **✅ B-93 закритий остаточно** (CSS fade у чат-вікні, коміт `9f80341`). Чіпи-кнопки тепер видно повністю у всіх 8 чатах.

4. **🧠 Контекст "Один мозок V2"** (Active у ROADMAP, 3-4 сесії):
   - **Шар 1 (наступна сесія, стартуємо з Health):** паритет дій у 8 чатах через повний `INBOX_TOOLS`
   - Шар 2: єдине табло `nm_owl_board_unified` з призмою вкладки
   - Шар 3: спільна історія `nm_owl_conversation` + event `nm-tab-switched`

5. **CACHE_NAME** актуальне: `nm-20260420-2040` (з EWxjG коміт 3). При зміні коду у src/**/*.js, style.css, sw.js, index.html — оновлювати.

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
- **Шар 1 "Один мозок V2" — міграція CRUD Health на OpenAI tools** (наступна сесія). Це одночасно закриє B-94/B-95.
- **Шар 2+3 Одного мозку** (після Шару 1) — табло + історія.

---

## 📋 Журнал сесій (останні)

| ID | Дата | Закрито / Зроблено | Коміти | Гілка | Деталі |
|---|---|---|---|---|---|
| **EWxjG** | 20.04 | ✅ B-93 (CSS fade чат-вікна, `9f80341`). ❌ B-94/B-95: два промпт-підходи провалились на iPhone (коміти `379f13e`, `6fa67e2`) — треба архітектурний Шар 1. CACHE_NAME nm-20260420-1948→2040 | 3 | `claude/start-session-EWxjG` | [CHANGES §20.04-EWxjG](../docs/CHANGES.md) |
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

## 🔧 Поточна сесія EWxjG — 3 баги з iPhone-тесту v325 (20.04.2026)

### Мета і результат
Закрити B-93, B-94, B-95. **Підсумок:** B-93 ✅ закрито з першого разу (CSS). B-94/B-95 ❌ два промпт-підходи провалились — встановлено що корінь архітектурний, лишаємо на Шар 1 "Один мозок V2".

### Зроблено (3 коміти)
1. **`379f13e` — B-94/B-95 підхід №1 (промпт).** У `health.js` додано блок "🚫 ЖОРСТКЕ ПРАВИЛО UI-TOOLS У ЗДОРОВ'Ї" на початок промпту з whitelist тригерів + заборонами. **iPhone v337 тест:** не спрацював, "Алергія на пил" → "Характер OWL: Партнер" × 3.
2. **`9f80341` — B-93 (CSS).** Прибрано нижню точку fade у `mask-image` на `.ai-bar-messages` + padding-bottom 20→28. Чіпи видно повністю.
3. **`6fa67e2` — B-94/B-95 підхід №2 (history detox + прибраний конфлікт).** Прибрано дубль `${UI_TOOLS_RULES}` з кінця промпту Здоров'я (конфліктував з новим блоком). Додано `healthBarHistory.pop()` після обробки UI-tool — acknowledgement не потрапляє у контекст AI. **iPhone v338 тест:** гірше — "Алергія на пил" → "Фінанси: місяць"; "Завтра прийом у лікаря" → 10 викликів `set_owl_mode(mentor)` у одній відповіді.

### Переосмислення з Романом
Роман: "Обмежувати інструменти не хочу. Це ж один мозок джарвіс." Потім: "Мені здається ти десь не там шукаєш." Після аналізу — **корінь архітектурний:** у чаті Здоров'я UI-tools це справжні OpenAI функції (`tools:` параметр), а CRUD — JSON у тексті. GPT-4o-mini завжди обирає реальну функцію над текст-JSON. Промпт (будь-який) не перепише цю bias. Pre-filter на клієнті — костиль, відкинули.

### Справжнє рішення (наступна сесія)
Шар 1 "Один мозок V2" — мігрувати CRUD Health chat на повний `INBOX_TOOLS` через OpenAI Tool Calling. Тоді `add_allergy` і `set_owl_mode` на одному рівні для моделі, промпт почне працювати. B-94/B-95 закриються як побічний ефект.

### Метрики
- **Коміти:** 3 (`379f13e` → `9f80341` → `6fa67e2`)
- **CACHE_NAME:** `nm-20260420-1948` → `nm-20260420-2022` → `nm-20260420-2030` → `nm-20260420-2040`
- **Гілка:** `claude/start-session-EWxjG`
- **Статус багів:** B-93 ✅ Закритий, B-94/B-95 🔴 повернуті у Критичні
