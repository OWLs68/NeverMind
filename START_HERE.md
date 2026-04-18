# START HERE — Точка входу для кожного нового чату

> Читай цей файл першим у кожній новій сесії.

---

## ⚡ Обов'язкові файли (читати ЗАВЖДИ на старті)

| # | Файл | Що дає |
|---|------|--------|
| 1 | `CLAUDE.md` | Правила процесу, файлова структура, **Карта документації**. Технічні деталі (AI-логіка, Дані, Деплой) → `docs/TECHNICAL_REFERENCE.md` |
| 2 | `_ai-tools/SESSION_STATE.md` | Поточна версія, гілка, що робили в останніх сесіях |
| 3 | `NEVERMIND_BUGS.md` | Відкриті баги з пріоритетами (🔴 критичні зверху) |
| 4 | `ROADMAP.md` | Дорожня карта — Active / Next (7 блоків) / Done / Ideas / Rejected / After Supabase |

**Інші файли** — читай тільки коли потрібно. Карта в `CLAUDE.md` → секція "Карта документації".

---

## 📁 Файлова структура проекту (коротко)

Проект використовує **ES Modules** збірка якими робиться через `esbuild` у `bundle.js`.

```
index.html              — Весь UI (~1475 рядків). Один <script src="bundle.js">
style.css               — Всі стилі (~1130 рядків)
sw.js                   — Service Worker (кеш PWA, CACHE_NAME міняти при деплої)
bundle.js               — Згенерований esbuild'ом (НЕ комітити, CI генерує)
build.js                — Конфіг esbuild (10 рядків)

src/                    — Вихідний код (модулі)
├── app.js              — Точка входу, імпортує всі модулі у правильному порядку
├── core/
│   ├── nav.js          — switchTab, теми, налаштування, пам'ять
│   ├── boot.js         — Ініціалізація, PWA, cross-tab sync
│   ├── trash.js        — Кошик (7 днів TTL)
│   ├── utils.js        — autoResizeTextarea, formatTime, escapeHtml
│   └── logger.js       — Error logging
├── ai/
│   └── core.js         — getAIContext, callAI, chat storage, OWL особистість
├── owl/
│   ├── inbox-board.js  — OWL Board Inbox, проактивні повідомлення
│   ├── board.js        — OWL Tab Boards (рендер + свайпи для всіх вкладок)
│   ├── proactive.js    — Генерація проактивних повідомлень
│   └── chips.js        — Центральний модуль чіпів (рендер, клік, fuzzy match, промпт-правила)
├── ui/
│   ├── keyboard.js     — setupKeyboardAvoiding (iOS hack)
│   └── swipe-delete.js — Swipe trail для видалення
└── tabs/
    ├── inbox.js        — sendToAI, processSaveAction, renderInbox
    ├── tasks.js        — Задачі, task chat
    ├── habits.js       — Звички + quit-звички
    ├── notes.js        — Нотатки, папки
    ├── finance.js      — Фінанси, AI-коуч
    ├── health.js       — Картки здоров'я
    ├── projects.js     — Проекти, workspace
    ├── evening.js      — Моменти, вечірній підсумок, "Я" вкладка
    └── onboarding.js   — Онбординг, слайди, OWL Guide
```

**Повна таблиця файлів з відповідальністю** → `CLAUDE.md` секція "Файлова структура".

---

## 🚀 Як працює деплой

```
Claude пушить → claude/** гілка
  → auto-merge.yml зливає в main (-X theirs)
  → esbuild збирає bundle.js з src/
  → GitHub Actions деплоїть на GitHub Pages
  → owls68.github.io/NeverMind (2-3 хв)
```

**CI оновлює бейдж в `index.html` автоматично.** Не вигадувати час вручну.
**CACHE_NAME у `sw.js`** оновлювати **вручну локально** перед пушем (формат: `nm-YYYYMMDD-HHMM`).

---

## 🎯 Слеш-команди (скіли)

Всі скіли живуть у `.claude/commands/*.md`. Повний індекс з пріоритетами активації → [`_ai-tools/SKILLS_PLAN.md`](_ai-tools/SKILLS_PLAN.md).

**Базові (завжди доступні):**

| Команда | Що робить |
|---------|-----------|
| `/start` | Швидкий старт нової сесії — читає обов'язкові файли і дає зріз стану |
| `/finish` | **Оновлення документації перед новим чатом** — ротує BUGS + SESSION_STATE (останні 2 сесії), оновлює ROADMAP/CHANGES/SKILLS_PLAN/START_HERE. Ідемпотентний |
| `/audit` | Повна перевірка роботи — 8 пунктів |
| `/fix B-XX` | Структурований баг-фікс за ID з `NEVERMIND_BUGS.md` |
| `/deploy` | Деплой перевірка і публікація |
| `/mockup` | ASCII макет UI перед кодом |
| `/new-file` | Додавання нового JS файлу (з правильною папкою + імпортом у `app.js`) |
| `/obsidian` | Підсумок сесії для другого мозку (Roman's brain) |
| `/gemini` | Запит другої думки від Gemini (ручний workflow через копіювання) |

**Спеціалізовані (написані 16-17.04.2026):**

| Команда | Коли активувати |
|---------|-----------------|
| `/ux-ui` | UI-задача (модалка / новий компонент / стилізація) |
| `/prompt-engineer` | Зміна промптів OWL (тон / антигалюцинації) |
| `/pwa-ios-fix` | iOS Safari баги (bfcache / SW / keyboard / overscroll) |
| `/owl-motion` | Анімація сови (заблоковано — потрібна SVG від Романа) |
| `/supabase-prep` | Перед першою міграцією на Supabase |
| `/a11y-enforcer` | Перед публічним релізом (після стрес-тесту) |
| `/gamification-engine` | Коли ROADMAP дійде до Блока 3 |

---

## 💬 Перша репліка після читання

> "Прочитав. [Найкритичніший баг з `NEVERMIND_BUGS.md` якщо є]. Що сьогодні робимо?"
