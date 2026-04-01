# NeverMind — Архів змін (до квітня 2026)

---

## 2026-03-31 — Підготовка до Supabase: NM_KEYS, runMigrations, _fetchAI

**Що зроблено:**
- `app-core-system.js`: додано `NM_KEYS` — центральний реєстр всіх localStorage ключів (розбито на data/settings/chat/cache/patterns)
- `app-core-system.js`: додано `runMigrations()` — запускається в `init()`, добиває `dueDate` і `priority` в старих задачах (потрібно для Календаря)
- `app-core-nav.js`: `clearAllData()` тепер використовує `NM_KEYS` замість хардкодованого списку
- `app-ai-core.js`: витягнуто `_fetchAI()` — HTTP запит до OpenAI в одному місці; `callAI` і `callAIWithHistory` спрощено

**Чому:** підготовка до Supabase — щоб міграція не зламала нічого. Нові ключі тепер достатньо додати в `NM_KEYS.data`. Після Supabase — тільки `_fetchAI` потребує зміни URL.

**Змінені файли:** `app-core-system.js`, `app-core-nav.js`, `app-ai-core.js`, `sw.js`

---

## 2026-03-30 — UI фікси + онбординг редизайн

**Що зроблено:**
- `style.css`: риска в чат-handle → біла; підказка над input коли чат закрито → темна риска `::before`
- `style.css`: уніфіковано кольори input-box і tab-board → `rgba(15,10,22,0.72)` (як чат-вікно)
- `app-core-nav.js`: `clearAllData()` → `reload()` через 800мс; додано `nm_quit_log`, `nm_folders_meta`, `nm_chat_health`, `nm_chat_projects`
- `app-core-system.js`: iOS PWA — `visibilitychange` → `reg.update()` (фікс "відновлення з фону")
- `index.html`: онбординг — фіолетова палітра → тепла кремова. Фон `#f5f0e8`, акцент `#c2790a`, кнопки темні

**Змінені файли:** `style.css`, `app-core-nav.js`, `app-core-system.js`, `index.html`, `sw.js`

---

## 2026-03-29 — Inbox чат 3-стейт + фікс деплою

**Що зроблено:**
- `app-ai-chat.js`, `app-ai-core.js`, `app-core-system.js`: inbox чат переведено на ту саму 3-стейтну систему що й інші вкладки (закрито → A compact → B full). Видалено `inboxChatExpanded`, `inboxCompactH`, `getInboxExpandHeight()` (~150 рядків)
- `.github/workflows/auto-merge.yml`: додано `-X theirs` до merge (вирішення конфліктів на користь feature-гілки). Прибрано sed для sw.js (Claude оновлює CACHE_NAME локально)
- `CLAUDE.md`: додано розділ "Система деплою" з поясненням архітектури CI і причини `-X theirs`
- `app-ai-core.js`: виправлено `openChatBar()` і `closeChatBar()` — inbox тепер обробляється однаково з іншими вкладками

**Змінені файли:** `app-ai-chat.js`, `app-ai-core.js`, `app-core-system.js`, `sw.js`, `.github/workflows/auto-merge.yml`, `CLAUDE.md`, `docs/CHANGES.md`

**Корінь проблеми деплою:** і Claude, і CI модифікували `sw.js` → конфлікт при merge → CI падав тихо. Фікс: `-X theirs` + CI не чіпає sw.js.

---

## 2026-03-29 — Реструктуризація: CSS винесено в style.css

**Що зроблено:**
- Вирізано `<style>` блок (1128 рядків) з `index.html` → новий файл `style.css`
- `index.html` замінено на `<link rel="stylesheet" href="style.css">` (2698 → 1570 рядків)
- `sw.js`: додано `./style.css` в `STATIC_ASSETS`, оновлено `CACHE_NAME` → `nm-20260329-0000`

**Змінені файли:** `style.css` (новий), `index.html`, `sw.js`

---

## 2026-03-28 — Документація і реструктуризація

**Що зроблено:**
- Створено `CLAUDE.md` — повний контекст проекту для нових сесій
- Створено `docs/ARCHITECTURE.md` — 6 Mermaid-діаграм системи
- Проведено повний аудит проекту (13 JS файлів, SW, index.html)
- Відкочено невдалий рефакторинг `app-db.js` (централізований localStorage) — зламав застосунок через видалення локальних функцій без оновлення викликів
- Відкочено невдалий рефакторинг CSS/іконок — зламав через відсутність нових файлів у SW кеші
- `main` повернуто до стабільного стану `a8ae6cb`

**Змінені файли:** `CLAUDE.md` (новий), `docs/ARCHITECTURE.md` (новий), `docs/CHANGES.md` (новий)
