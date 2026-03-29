# NeverMind — Контекст для Claude

## Обов'язково прочитати на початку кожної сесії

1. Цей файл (`CLAUDE.md`) — архітектура, правила, структура даних
2. `docs/CHANGES.md` — що змінювалось в попередніх сесіях
3. `_ai-tools/SESSION_STATE.md` — стан попередньої сесії (якщо є)

> `docs/ARCHITECTURE.md` — візуальні Mermaid-діаграми **для користувача**, Claude не читає

---

## Обов'язкове правило: вести РОМАН_ПРОГРЕС.md

`РОМАН_ПРОГРЕС.md` — особистий журнал прогресу Романа. Веди його автоматично.

### Коли оновлювати:
- **В кінці сесії** — коли зроблено щось значуще (нова функція, виправлено баги, архітектурне рішення)
- **При завершенні великої задачі** — навіть якщо сесія ще триває
- **Коли Роман каже "запиши" або "оновити прогрес"** — одразу

### Як оновлювати:
1. Прочитай поточний файл щоб знайти останній запис і не дублювати
2. Якщо поточна дата = дата останнього запису → **допиши** в існуючий запис
3. Якщо нова дата → **додай новий блок** за шаблоном:

```markdown
## 📅 [дата] — [коротка назва сесії] — v[версія]

**Контекст:** [одне речення про що була сесія]

### Що зроблено:
- [список конкретних змін з назвами файлів]

### Ключове рішення:
[одне речення — найважливіший висновок або рішення сесії]
```

4. Якщо записів більше 5 — перемісти найстаріший в таблицю Архіву одним рядком
5. Зроби git commit і push

---

## Правила для Claude (виконувати завжди)

- **Після кожної зміни коду** — оновити `docs/CHANGES.md`: додати запис з датою, що змінено і чому
- **Після структурних змін** — оновити `CLAUDE.md` (файлова структура, правила, дані)
- **Після змін архітектури** — оновити `docs/ARCHITECTURE.md` (діаграми)
- **При додаванні нових файлів** — обов'язково додати в `STATIC_ASSETS` у `sw.js`
- **При кожному деплої** — змінити `CACHE_NAME` у `sw.js` (формат: `nm-YYYYMMDD-HHMM`) **локально, перед пушем** — CI не чіпає sw.js
- **При кожному пуші в main** — повідомити Роману що має з'явитись на лічильнику: `v[версія] · ДД.ММ ГГ:ХХ` (Amsterdam час деплою)

---

## Що це за проект

Персональний PWA-агент продуктивності. Ключова ідея: **мінімальне тертя** — користувач пише будь-що в Inbox, ШІ (GPT-4o-mini) автоматично визначає тип запису і розподіляє по вкладках.

- Стек: ванільний JS, localStorage, GitHub Pages, без фреймворків і бекенду
- API: OpenAI GPT-4o-mini (ключ зберігається в localStorage `nm_gemini_key`)
- Деплой: автоматичний через GitHub Actions при пуші в feature-гілку `claude/**`
- Мова: Ukrainian (весь UI та AI промпти)

---

## Файлова структура (що де живе)

| Файл | Відповідальність |
|------|-----------------|
| `index.html` | Весь UI (168KB). Стилі вбудовані. 13 `<script>` тегів в кінці |
| `sw.js` | Service Worker. **CACHE_NAME треба міняти при кожному деплої** |
| `app-core-nav.js` | Глобальний стан (`currentTab`), switchTab, теми, налаштування, пам'ять |
| `app-core-system.js` | bootApp, кошик (7 днів TTL), OWL Tab Boards, cross-tab sync, PWA setup |
| `app-ai-core.js` | getAIContext(), callAI(), chat storage (6 незалежних чатів), OWL особистість |
| `app-ai-chat.js` | OWL Board (проактивні повідомлення), 3-стейт чат |
| `app-inbox.js` | sendToAI(), processSaveAction(), renderInbox(), swipe delete |
| `app-tasks-core.js` | Задачі (CRUD), кроки задач, task chat |
| `app-habits.js` | Звички + quit-звички, лог виконання, стріки, processUniversalAction() |
| `app-notes.js` | Нотатки, папки, note view з чатом, пошук, addNoteFromInbox() |
| `app-finance.js` | Фінанси, бюджет, категорії, AI-коуч (кешований) |
| `app-health.js` | Карточки здоров'я, денні шкали (енергія/сон/біль) |
| `app-projects.js` | Проекти, воркспейс, кроки, метрики, темп |
| `app-evening-moments.js` | Моменти дня, вечірній підсумок, "Я" вкладка, денний скор |
| `app-evening-onboarding.js` | Онбординг, слайди, опитування, OWL Guide, help |

**Порядок завантаження критичний** — скрипти залежать один від одного в порядку як вони в index.html.

---

## Система деплою (як це працює)

**Флоу:** Claude пушить у `claude/read-repository-bd3qH` → `auto-merge.yml` мержить у `main` → `deploy.yml` деплоїть на GitHub Pages.

**`auto-merge.yml` робить:**
1. `git merge --no-edit -X theirs <feature-branch>` — при конфліктах feature-гілка виграє
2. `sed` оновлює badge в `index.html` (Amsterdam час деплою)
3. Комітить і пушить у `main`

**CI НЕ чіпає `sw.js`** — тому Claude **зобов'язаний** оновити `CACHE_NAME` локально перед кожним пушем.

**Чому `-X theirs`:** і Claude, і CI змінюють `sw.js` → при звичайному merge виникає конфлікт → CI падає тихо → деплой не відбувається. `-X theirs` вирішує конфлікт автоматично на користь feature-гілки.

**Якщо деплой не спрацював:** зроби порожній пуш: `git commit --allow-empty -m "ci: retrigger" && git push origin <branch>`

---

## Критичні правила (ЗАВЖДИ дотримуватись)

1. **НЕ ЧІПАТИ** `localStorage.setItem` override в `app-core-system.js` (рядки ~207-212) — це cross-tab sync інфраструктура
2. **Міняти `CACHE_NAME`** в `sw.js` при кожному деплої (формат: `nm-YYYYMMDD-HHMM`)
3. **Не додавати** `app-db.js` або будь-яку централізовану БД-абстракцію — вже пробували, зламало все
4. **НЕ видаляти** локальні функції `getTasks()`, `saveNotes()` і т.д. з модулів — інші модулі їх кличуть напряму
5. **Порядок скриптів** в index.html — не міняти без потреби
6. **Не рефакторити агресивно** — краще точкові зміни в одному файлі

---

## AI-логіка (як думає агент)

### Inbox flow (головний)
```
Юзер пише → sendToAI() → getAIContext() → callAIWithHistory() → JSON відповідь
→ switch(action.action):
  'save'            → processSaveAction() → в inbox + по вкладках (task/note/habit/event)
  'save_finance'    → processFinanceAction()
  'complete_habit'  → processCompleteHabit() → оновити лог, renderProdHabits
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

### OWL Board (проактивні повідомлення)
- Генерується кожні 3 хвилини (`OWL_BOARD_INTERVAL`)
- Тайм-зони активності: 7:00-23:00
- Тригери: ранковий бриф, обідня перевірка, дедлайни, стріки, бюджет і т.д.
- Зберігає "що вже казав сьогодні" щоб не повторюватись (`nm_owl_board_said`)
- Tab-specific OWL boards — окрема система в `app-core-system.js`

---

## Дані (localStorage)

### По модулях
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
| `nm_evening_mood` | `{mood, date}` | app-core-nav.js |
| `nm_trash` | `[]` max 200, 7 днів TTL | app-core-system.js |
| `nm_settings` | `{}` | app-core-nav.js |
| `nm_gemini_key` | string | app-core-nav.js |
| `nm_memory` | string (300 слів) | app-core-nav.js |
| `nm_memory_ts` | timestamp | app-core-nav.js |
| `nm_active_tabs` | `[]` | app-core-nav.js |

### Динамічні ключі
- `nm_chat_inbox/tasks/notes/me/evening/finance` — чат-histórico по вкладках (max 30 msg)
- `nm_task_chat_{id}` — чат для конкретної задачі
- `nm_owl_tab_{tab}` — OWL board повідомлення по вкладці
- `nm_owl_tab_ts_{tab}` — timestamp останньої генерації
- `nm_owl_tab_said_{tab}` — теми що вже обговорені
- `nm_fin_coach_{period}` — кешований фін-аналіз

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

// HealthCard
{ id, name, subtitle, status, progress:0-100, medications:[{name,dose,time,taken}], doctorNotes:[{date,doctor,text}] }

// Project
{ id, name, subtitle, status:'idea'|'active'|'paused'|'done', progress, steps:[{id,text,done}], decisions:[{title,reason}], metrics:[{label,value,color}], tempoNow, tempoMore, tempoIdeal }

// Moment
{ id, text, mood:'positive'|'neutral'|'negative', ts, summary? }

// TrashItem
{ type:'task'|'note'|'habit'|'inbox'|'folder'|'finance', item, extra, deletedAt }
```

---

## Міжмодульні залежності (хто кого кличе)

```
app-core-nav ←─── всі модулі (switchTab, showToast, applyTheme)
app-core-system ←── всі модулі (addToTrash, showUndoToast)
app-ai-core ←──── всі AI-модулі (callAI, getAIContext, saveChatMsg)

app-inbox ──→ processSaveAction ──→ addNoteFromInbox (notes)
                                 ──→ getTasks/saveTasks (tasks-core)
                                 ──→ getHabits/saveHabits (habits)
                                 ──→ getMoments/saveMoments (evening)
```

---

## Відомі крихкі місця

- `app-ai-core.js` (позиція 3) викликає `getTasks()` з `app-tasks-core.js` (позиція 6) — безпечно бо лише в рантаймі, але fragile
- Реєстрація SW відбувається всередині `setupSW()` в app-core-system.js — якщо щось зламається при ініціалізації, PWA не буде офлайн-ready
- `CACHE_NAME` хардкодований — треба оновлювати вручну

---

## Поточний стан

- Гілка `main` = продакшн (GitHub Pages)
- Стабільний коміт: `a8ae6cb` (27.03 07:24) — до будь-яких рефакторингів
- Автодеплой: CI створює deploy-коміт після кожного пушу в main
- Якщо щось зламалось: `git reset --hard <hash>` + `git push --force origin HEAD:main`
