# NeverMind — Контекст для Claude

> Обов'язкове читання → `START_HERE.md`

---

## Що це за проект

Персональний PWA-агент продуктивності. Ключова ідея: **мінімальне тертя** — користувач пише будь-що в Inbox, ШІ (GPT-4o-mini) автоматично визначає тип запису і розподіляє по вкладках.

- Стек: ванільний JS, localStorage, GitHub Pages, без фреймворків і бекенду
- API: OpenAI GPT-4o-mini (ключ зберігається в localStorage `nm_gemini_key`)
- Деплой: автоматичний через GitHub Actions при пуші в feature-гілку `claude/**`
- Мова: Ukrainian (весь UI та AI промпти)

---

## ВСІ ПРАВИЛА (єдине місце)

### Процес роботи
- **БЕЗ "Роби" від Романа — не змінювати код.** Роман каже "Роби" — і тільки тоді.
- **ОДИН баг за раз.** Після виправлення — запропонуй наступний.
- **ЧИТАЙ код перед змінами.** Ніколи "на пам'ять".
- **НІКОЛИ не створювати правила самостійно.** Завжди спочатку запитати Романа. Тільки якщо він дає згоду — створити правило і записати в CLAUDE.md.
- **Сперечайся** — вказуй на слабкі місця ідеї, не погоджуйся заради ввічливості.
- **Mockup перед кодом** — якщо задача про UI, показати макет і отримати підтвердження.

### Якість виконання
- **CSS/layout — описати результат перед пушем:** "outer element Xpx, padding Y з кожного боку → вміст буде X−2Y px". Якщо не можу описати — не пушу.
- **Якщо перша спроба не спрацювала — СТОП.** Перечитати код, зрозуміти ЧОМУ не спрацювало, тільки тоді наступна спроба. Не пробувати варіації без розуміння причини.
- **Не губи попередні фікси** — при кожній зміні перевіряти що попередні виправлення збережені.
- **safeAgentReply** — завжди замість прямого `addMsg('agent', reply)`.
- **Перевіряй синтаксис** — після JS змін: `node --check файл.js`.

### Документація (після кожної зміни)
- **Після КОЖНОЇ зміни** — оновити `_ai-tools/SESSION_STATE.md` і запушити. Не чекати кінця сесії.
- **Після структурних змін** — оновити `CLAUDE.md` (файлова структура, правила, дані).
- **Після змін архітектури** — оновити `docs/ARCHITECTURE.md` (діаграми).
- **При додаванні нових файлів** — обов'язково додати в `STATIC_ASSETS` у `sw.js`.

### Деплой
- **При кожному деплої** — змінити `CACHE_NAME` у `sw.js` (формат: `nm-YYYYMMDD-HHMM`) **локально, перед пушем**. CI не чіпає sw.js. Використовуй `date` в терміналі.
- **При кожному пуші** — НЕ вигадувати час на бейджі. Бейдж встановлює CI автоматично.
- **Якщо деплой не спрацював:** `git commit --allow-empty -m "ci: retrigger" && git push origin <branch>`

### Що не можна змінювати без обговорення
- Ручна категоризація в Inbox (ШІ визначає, не користувач)
- Прибирати чат-бари з вкладок
- Прибирати gesture swipe
- Копіювати дані між storage (тільки агрегація при рендері)
- Розбивати на кілька HTML файлів
- `localStorage.setItem` override в `app-core-system.js` (~207-212) — cross-tab sync
- `app-db.js` або будь-яка централізована БД-абстракція — вже пробували, зламало все
- Локальні функції `getTasks()`, `saveNotes()` і т.д. — інші модулі їх кличуть напряму
- Порядок `<script>` тегів в index.html
- Логіку `setupSW()` в app-core-system.js — кожна частина вирішує конкретну iOS проблему

### Чеклист аудиту (коли Роман каже "перевір роботу")
1. Перечитати всі змінені ділянки
2. `node --check файл.js`
3. Перевірити баланс `<div>` тегів
4. Шукати дублікати функцій
5. Шукати залишки старого коду і мертві змінні
6. Перевірити що промпти агента не суперечать одне одному
7. Перевірити що всі нові обробники зареєстровані
8. Рахувати рядки — попередити >1200, зупинитись >1500

---

## Файлова структура

| Файл | Відповідальність |
|------|-----------------|
| `index.html` | Весь UI (~1570 рядків). 13 `<script>` тегів в кінці |
| `style.css` | Всі стилі (~1130 рядків). Винесено з index.html |
| `sw.js` | Service Worker. **CACHE_NAME треба міняти при кожному деплої** |
| `app-core-nav.js` | Глобальний стан (`currentTab`), switchTab, теми, налаштування, пам'ять |
| `app-core-system.js` | bootApp, кошик (7 днів TTL), OWL Tab Boards, cross-tab sync, PWA setup |
| `app-ai-core.js` | getAIContext(), callAI(), chat storage (6 незалежних чатів), OWL особистість |
| `app-ai-chat.js` | OWL Board (проактивні повідомлення), 3-стейт чат |
| `app-inbox.js` | sendToAI(), processSaveAction(), renderInbox(), swipe delete |
| `app-tasks-core.js` | Задачі (CRUD), кроки задач, task chat |
| `app-habits.js` | Звички + quit-звички, лог виконання, стріки |
| `app-notes.js` | Нотатки, папки, note view з чатом, пошук |
| `app-finance.js` | Фінанси, бюджет, категорії, AI-коуч (кешований) |
| `app-health.js` | Карточки здоров'я, денні шкали (енергія/сон/біль) |
| `app-projects.js` | Проекти, воркспейс, кроки, метрики, темп |
| `app-evening-moments.js` | Моменти дня, вечірній підсумок, "Я" вкладка, денний скор |
| `app-evening-onboarding.js` | Онбординг, слайди, опитування, OWL Guide, help |

**Порядок завантаження критичний** — скрипти залежать один від одного в порядку як вони в index.html.

---

## Система деплою

**Флоу:** Claude пушить у `claude/**` → `auto-merge.yml` мержить у `main` і одразу деплоїть на GitHub Pages.

**`auto-merge.yml` робить:**
1. `git merge --no-edit -X theirs <feature-branch>` — при конфліктах feature-гілка виграє
2. `sed` оновлює badge в `index.html` (Amsterdam час деплою)
3. Комітить і пушить у `main`
4. Деплоїть на GitHub Pages

**Чому `-X theirs`:** і Claude, і CI змінюють `sw.js` CACHE_NAME → конфлікт → CI падає тихо. `-X theirs` вирішує на користь feature-гілки.

**Чому НЕ два воркфлоу:** GitHub блокує `deploy.yml` якщо `auto-merge.yml` пушить через `GITHUB_TOKEN`. Тому деплой прямо в `auto-merge.yml`.

---

## AI-логіка

### Inbox flow
```
Юзер пише → sendToAI() → getAIContext() → callAIWithHistory() → JSON відповідь
→ switch(action.action):
  'save'            → processSaveAction() → inbox + вкладки (task/note/habit/event)
  'save_finance'    → processFinanceAction()
  'complete_habit'  → processCompleteHabit()
  'complete_task'   → processCompleteTask() → task.status='done'
  'clarify'         → showClarify() → модалка з варіантами
  'add_step'        → додати кроки до task
  'create_project'  → новий проект + startProjectInboxInterview()
  'restore_deleted' → searchTrash() → restoreFromTrash()
  'reply'           → просто повідомлення
```

### AI контекст (getAIContext повертає)
1. Дата/час/день тижня (укр)
2. Профіль користувача (з налаштувань)
3. `nm_memory` — AI-генерований профіль (оновлюється раз на день)
4. Останні 8 активних задач з ID
5. Всі звички з статусом виконання сьогодні
6. Останні 8 записів inbox сьогодні
7. Фінансовий контекст (бюджет, витрати)
8. Кошик (для відновлення видаленого)

### OWL Board
- Генерується кожні 3 хвилини (`OWL_BOARD_INTERVAL`), активний 7:00-23:00
- Зберігає "що вже казав сьогодні" (`nm_owl_board_said`) — антиповтор

---

## Дані (localStorage)

| Ключ | Тип | Модуль |
|------|-----|--------|
| `nm_inbox` | `[]` | app-inbox.js |
| `nm_tasks` | `[]` | app-tasks-core.js |
| `nm_notes` | `[]` | app-notes.js |
| `nm_folders_meta` | `{}` | app-notes.js |
| `nm_habits2` | `[]` | app-habits.js |
| `nm_habit_log2` | `{date: {id: count}}` | app-habits.js |
| `nm_quit_log` | `{id: {streak, relapses}}` | app-habits.js |
| `nm_finance` | `[]` | app-finance.js |
| `nm_finance_budget` | `{total, categories}` | app-finance.js |
| `nm_finance_cats` | `{expense:[], income:[]}` | app-finance.js |
| `nm_health_cards` | `[]` | app-health.js |
| `nm_health_log` | `{date: {energy, sleep, pain}}` | app-health.js |
| `nm_projects` | `[]` | app-projects.js |
| `nm_moments` | `[]` | app-evening-moments.js |
| `nm_evening_summary` | `{text, date}` | app-evening-moments.js |
| `nm_trash` | `[]` max 200, 7 днів TTL | app-core-system.js |
| `nm_settings` | `{}` | app-core-nav.js |
| `nm_gemini_key` | string | app-core-nav.js |
| `nm_memory` | string (300 слів) | app-core-nav.js |

**Динамічні:** `nm_chat_{tab}`, `nm_task_chat_{id}`, `nm_owl_tab_{tab}`, `nm_fin_coach_{period}`

---

## Структури даних

```javascript
// Task
{ id, title, status:'active'|'done', steps:[{id,text,done}], createdAt, completedAt? }
// Note
{ id, text, folder, source:'inbox'|'manual'|'ai', ts, lastViewed, updatedAt? }
// Habit
{ id, name, details, emoji, days:[0-6], targetCount, type:'build'|'quit', createdAt }
// Transaction
{ id, type:'expense'|'income', amount, category, comment, ts }
// Project
{ id, name, subtitle, status:'idea'|'active'|'paused'|'done', progress, steps, decisions, metrics, tempoNow, tempoMore, tempoIdeal }
// Moment
{ id, text, mood:'positive'|'neutral'|'negative', ts, summary? }
// TrashItem
{ type:'task'|'note'|'habit'|'inbox'|'folder'|'finance', item, extra, deletedAt }
```

---

## Міжмодульні залежності

```
app-core-nav ←─── всі модулі (switchTab, showToast, applyTheme)
app-core-system ←── всі модулі (addToTrash, showUndoToast)
app-ai-core ←──── всі AI-модулі (callAI, getAIContext, saveChatMsg)
app-inbox ──→ processSaveAction ──→ notes / tasks-core / habits / evening
```

⚠️ `app-ai-core.js` (позиція 3) викликає `getTasks()` з `app-tasks-core.js` (позиція 6) — безпечно в рантаймі, але fragile.

---

## Екстрений скид

```bash
git reset --hard <hash> && git push --force origin HEAD:main
# Стабільний коміт до рефакторингів: a8ae6cb (27.03 07:24)
```
