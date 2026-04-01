# START HERE — Точка входу для кожного нового чату

> Читай цей файл першим.

---

## ⚡ Обов'язкові файли (читати завжди)

| # | Файл | Що дає |
|---|------|--------|
| 1 | `_ai-tools/SESSION_STATE.md` | Версія, гілка, що робимо, останні сесії |
| 2 | `NEVERMIND_BUGS.md` | Всі відкриті баги з пріоритетами |

**Всі правила → `CLAUDE.md`**

---

## 📂 Ситуаційні файли (читати тільки якщо потрібно)

| Файл | Коли читати |
|------|-------------|
| `РОМАН_ПРОФІЛЬ.md` | Перша сесія або давно не працювали разом |
| `NEVERMIND_ARCH.md` | Зміни архітектури, модулів або storage |
| `CONCEPTS_ACTIVE.md` | Питання про реалізовану концепцію вкладки (Finance, Evening, Me...) |
| `FEATURES_ROADMAP.md` | Питання про заплановані фічі (Calendar, Voice, OWL...) |
| `NEVERMIND_LOGIC.md` | Базова концепція, OWL принципи |
| Конкретний `app-*.js` | Завжди перед змінами в цьому модулі |

---

## 🚀 Як працює деплой

```
Claude пушить → claude/...
  → auto-merge.yml зливає в main (-X theirs)
  → GitHub Actions деплоїть на GitHub Pages
  → owls68.github.io/NeverMind (2-3 хв)
```

CI оновлює бейдж в index.html автоматично. **Не вигадувати час вручну.**

---

## 📁 Карта файлів проекту

```
index.html              — HTML (~1570 рядків)
style.css               — Стилі (~1130 рядків)
app-core-nav.js         — Навігація, вкладки, теми
app-core-system.js      — Trash, PWA, ініціалізація, OWL board
app-ai-core.js          — OpenAI API, getAIContext, chat storage
app-ai-chat.js          — Чат UI, 3-стейтне вікно
app-inbox.js            — Inbox, sendToAI, processSaveAction
app-tasks-core.js       — Задачі, task chat
app-habits.js           — Звички (build + quit)
app-notes.js            — Нотатки, папки
app-finance.js          — Фінанси, коуч
app-evening-moments.js  — Вкладки Я і Вечір
app-evening-onboarding.js — Онбординг, слайди
app-health.js           — Здоров'я
app-projects.js         — Проекти, workspace
sw.js                   — Service Worker (кеш, офлайн)
```

---

## 💬 Перша репліка після читання

> "Прочитав. [Найкритичніший баг з BUGS.md]. Що сьогодні робимо?"
