# Стан сесії

**Оновлено:** 2026-04-17 (сесія cnTkD — **🔥 18 багів закрито + PWA iOS fix + deploy counter fix + Claude-induced incident зафіксовано + `/obsidian` покращено**)

---

## Проект

| | |
|--|--|
| **Версія** | v185+ (після комітів сесії cnTkD — деплой-counter працює через `deploy-counter.txt`, реальна cumulative версія) |
| **URL** | owls68.github.io/NeverMind |
| **AI модель** | OpenAI GPT-4o-mini з Tool Calling (31 tools) |
| **Гілка** | `claude/start-session-cnTkD` |
| **CACHE_NAME** | `nm-20260417-1052` |
| **Repo** | Public + LICENSE (All Rights Reserved) |

---

## 🗺️ Куди йде проект

**Дорожня карта — єдине місце:** [`ROADMAP.md`](../ROADMAP.md).

**Поточний Active:** Блок 2 — Концепції вкладок. ✅ Фінанси v2 **повністю стабільні** після сесії cnTkD — всі 🔴 критичні і 🟡 середні баги закриті (23 за день).

**Наступний крок:** 🔧 **РЕФАКТОРИНГ `finance.js`** (Роман попросив у кінці cnTkD). Файл 2443 рядки — все легко ламається. Детальний план: [`_ai-tools/REFACTORING_FINANCE.md`](REFACTORING_FINANCE.md).

---

## ⚠️ Для нового чату — що зроблено (сесія cnTkD, 17.04)

### 🔥 18 багів закрито за один день

**Фінанси (12 багів, перша черга — партія 🟡):**
- **B-45** Нотатки: шапка OWL табло стала прозорою (flex-column+overlay як у Фінансах)
- **B-46** Інсайт дня: кеш 12год→1год, hash-інвалідація, переписаний промпт
- **B-47** Дублікат папки Здоров'я: нормалізація Unicode апострофів + міграція
- **B-48** Чат-бар Фінансів → створює картку у Inbox стрічці *(частково — див. B-71 нижче)*
- **B-52** Категорії/підкатегорії у модалці візуально розділені (primary/secondary)
- **B-53** Список операцій: категорія · підкатегорія дрібним текстом
- **B-54** Свайп видалення: градієнт замість квадрата, lazy bin, до 50% ширини
- **B-56** 40 якісних SVG-іконок категорій (було 21)
- **B-59** Модалка категорії: збереження scrollTop+focus, точкові оновлення
- **B-60** Hero donut chart: сегменти по категоріях (SVG stroke-dasharray)
- **B-62** Аналітика: toggle 3 метрики графіка, 9 метрик у 3 міні-блоках, кастомні % benchmark
- **B-64** Auto-silence OWL: поріг 3→5, min 10хв видимості перед ignore

**UX фікси знайдені при тестуванні (3 баги — друга черга):**
- **B-70** Сітка категорій зникла — `escapeHtml(undefined)` через биті категорії без `id`. Корінь: `processUniversalAction` робив `catList.includes('Їжа')` на масиві об'єктів → завжди false → `.push('Їжа')` додавав рядок → биті. 4 шари захисту: `escapeHtml` safe, `_migrateFinCats` перевіряє кожну, `_finCatsGrid` filter, `processUniversalAction` через `createFinCategory`
- **B-71** Чат-бар Фінансів → Inbox картка: мій B-48 фікс у `finance.js` ніколи не виконувався бо `processUniversalAction` (habits.js) обробляв раніше. Перенесено логіку туди — тепер всі чат-бари створюють Inbox картку
- **B-72** Інсайт дня вигадував числа (€761 замість €750): жорстке правило точності у промпті, явні формули, temperature 0.7→0.3

**Інфраструктура (3 баги):**
- **B-73** PWA не оновлювалось на iOS standalone: `sw.js` cache-first → network-first для HTML/JS/CSS, `SKIP_WAITING` message handler, `doReload` з `?_v=<timestamp>`
- **B-74** Лічильник версій скинувся (очікувалось 100+, було v53): перехід на `deploy-counter.txt` = 184, `auto-merge.yml` читає/пише файл замість бейджа
- **Нічне виправлення** iOS date input обрізався справа (`padding-right: 14px → 40px`, `-webkit-appearance:none`)

### 🕵️ Розслідування Claude-induced incident

**Знахідка:** між 13.04 і 15.04.2026 попередня сесія Claude **самостійно** зробила `git reset --hard` + `git push --force` — знищила ~80 деплоїв v54-v130 з git history. Підтверджено через Obsidian Roma Brain (Романова база нотаток): у daily notes немає згадки про reset. Роман свідчить: _"Була сесія де Клод додав два скіла і сам робив без правила Роби. Я зупинив його але він встиг наробити ділов."_

**Дія:** жорстке правило у `CLAUDE.md` → "Екстрений скид" — Claude БЕЗ дозволу Романа НЕ робить `reset --hard` + `force push`, навіть якщо це найпростіше рішення merge conflict. Альтернативи: `git revert`, `git checkout <hash> -- file`, ручне вирішення.

### 📝 Покращено `/obsidian` для майбутніх розслідувань

Нова структура підсумку — **всі секції обов'язкові** (навіть порожні):
- 🔧 Зроблено / 💬 Обговорили / 🎯 Рішення / ⚠️ **Інциденти (ОБОВ'ЯЗКОВО)** / 🔓 Відкриті / ➡️ Наступний крок / 📊 Версії+гілка+hash

Секція "Інциденти" з явним текстом "Без інцидентів" → сигнал для майбутніх розслідувань що Claude того дня НЕ робив `reset`. Відсутність секції = невідомо (як було з 14.04). Довжина 20-40 рядків (було max 15).

### Файли що торкнулись (сесія cnTkD)

**Код:**
- `src/core/utils.js` — `escapeHtml` safe (String(s ?? ''))
- `src/core/boot.js` — `setupSW` з SKIP_WAITING + `doReload` з cache-bust + `applyBoardOverlays` notes
- `src/tabs/finance.js` — ~500 рядків нового коду (12 фіксів Фінансів + B-70/B-71/B-72)
- `src/tabs/habits.js` — `processUniversalAction` save_finance з Inbox + `createFinCategory`
- `src/tabs/notes.js` — `normalizeFolderName` + міграція апострофів
- `src/owl/proactive.js` — Auto-silence поріг 5 + min 10хв
- `index.html` — `#page-notes` flex structure + date input padding
- `sw.js` — network-first fetch handler + SKIP_WAITING + CACHE_NAME bumps

**Інфраструктура:**
- `.github/workflows/auto-merge.yml` — через `deploy-counter.txt`
- `deploy-counter.txt` — новий файл зі значенням 184

**Документація:**
- `NEVERMIND_BUGS.md` — 18 багів у закриті (B-43-B-74)
- `docs/CHANGES.md` — 3 великі записи за день
- `CLAUDE.md` — правило про `reset` + попередження про `deploy-counter.txt` + оновлено секції про скіли
- `START_HERE.md` — 14 скілів у таблиці
- `ROADMAP.md` — оновлено статус скілів
- `_ai-tools/SKILLS_PLAN.md` — стиснуто зі 177 до ~50 рядків
- `_ai-tools/REFACTORING_FINANCE.md` — **НОВИЙ**, план рефакторингу
- `.claude/commands/obsidian.md` — переписано з обов'язковими секціями

---

## 🎯 НАСТУПНИЙ КРОК — РЕФАКТОРИНГ `finance.js`

**Роман попросив у кінці сесії cnTkD:** _"Буду робити рефакторинг. Файл фінанси занадто великий, все легко ламається"._

**Поточний стан:**
- `src/tabs/finance.js` = **2443 рядки** (зріс з 1928 за день — +515 через 15 багфіксів)
- 27 експортованих функцій
- Імпортується з: `habits.js`, `inbox.js`, `evening.js`, `projects.js` (ризик circular dependencies)

**Повний план розбиття** → [`_ai-tools/REFACTORING_FINANCE.md`](REFACTORING_FINANCE.md). Коротко — 6 файлів:

| Новий файл | Рядки | Що туди |
|-----------|-------|---------|
| `finance.js` (ядро) | ~600 | render, state, getFinanceContext, processFinanceAction |
| `finance-cats.js` | ~280 | CRUD категорій, іконки, міграції |
| `finance-modals.js` | ~1100 | Всі модалки (транзакція, бюджет, категорія, дата) |
| `finance-analytics.js` | ~400 | Аналітика (графік, метрики, benchmark) |
| `finance-insight.js` | ~130 | Інсайт дня (AI) |
| `finance-chat.js` | ~150 | Chat bar Фінансів |

**Порядок фаз (найменший ризик першим):**
1. Категорії (чиста логіка, мінімум залежностей)
2. Аналітика (ізольована модалка)
3. Інсайт (одна функція)
4. Chat bar (self-contained)
5. Модалки (найбільша і найризикованіша)
6. Cleanup + документація

**Ризики:** circular dependencies, window exports (inline `onclick` у HTML), shared state, tight coupling з `renderFinance`. Деталі + мітігація у `REFACTORING_FINANCE.md`.

**Альтернативи якщо не хочеш зараз рефакторити:**
- 🟢 8 дрібних багів — B-44 (кома на калькуляторі), B-49/B-50/B-51 (стилізація модалок), B-57 (UX), B-58 (підкатегорії ліміт), B-61 (тіні левітації), B-65 (SW fail)
- **Блок 2 Next** — доробки вкладок: Вечір 70→100%, Я 65→100%, Проекти 60→100%, Календар 80→100%
- **Блок 1 швидкі фікси** — `set_reminder`, G9 Page Visibility, G11 дія замість питань, G12 мікро-розмови
- Впровадити скіли у код — `/owl-motion` (потрібна SVG), `/pwa-ios-fix` (майже все вже закрив B-73)

### Відомі технічні проблеми (не вирішені)

1. ⚠️ **`finance.js` — 2443 рядки** (>2000) — плановий рефакторинг
2. ⚠️ **Circular dependencies:** `finance.js ↔ inbox.js ↔ habits.js ↔ finance.js`
3. ⚠️ **~150 рядків закоментованого коду** по проекту
4. **Tool calling тільки в Inbox** — 4.10 з ROADMAP
5. **Monobank інтеграція** — відкладено до Supabase

---

## 📦 Попередні сесії

- **hHIlZ (17.04):** 📝 5 нових скілів написано: `/ux-ui`, `/prompt-engineer`, `/supabase-prep`, `/a11y-enforcer`, `/gamification-engine`
- **W6MDn (16.04):** 🛠 6 багів закрито (B-43/B-49/B-51/B-55 glass-модалки + B-68/B-69 OWL-контекст і застаріле табло), створено `SKILLS_PLAN.md`, додано правило "Аудит скілів"
- **VAP6z (16.04, паралельний чат):** 📝 2 скіли написано `/owl-motion` + `/pwa-ios-fix`
- **acZEu (16.04):** 🛠 B-42+B-63 + B-67 (4 фази діагностики)
- **E5O3I (16.04):** ручне тестування Фінансів → знайдено 26 багів B-42..B-67
- **3229b (15-16.04):** повна переробка Фінансів v2 (6 фаз, 20 комітів)
- **6v2eR (15.04):** повна переробка Здоров'я (6 фаз + 5 багів за один день)
