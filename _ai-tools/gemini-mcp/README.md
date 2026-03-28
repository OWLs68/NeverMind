# Gemini MCP Server

Віддалений MCP сервер який дає Claude Code доступ до Gemini.
Працює з **будь-якого пристрою** — комп'ютер, телефон, браузер.

---

## Як це виглядає в роботі

```
Ти пишеш запит в claude.ai/code
  → Claude думає
  → Якщо потрібна друга думка — викликає Gemini
  → Gemini відповідає
  → Claude порівнює обидві відповіді
  → Ти отримуєш синтез двох AI
```

---

## Встановлення

### Крок 1 — Отримай ключі

**Gemini API ключ** (безкоштовно):
1. Іди на https://aistudio.google.com
2. Натисни "Get API key"
3. Скопіюй ключ

**AUTH_TOKEN** — придумай будь-який рядок, наприклад: `miy-secret-123`
(це захист щоб ніхто інший не міг використовувати твій сервер)

---

### Крок 2 — Задеплой на Railway (безкоштовно)

**Railway** — найпростіший хостинг для Node.js. Безкоштовний план дає $5/місяць кредитів, цього вистачить.

1. Іди на https://railway.app і зареєструйся (можна через GitHub)

2. Натисни **"New Project"** → **"Deploy from GitHub repo"**

3. Вибери репозиторій `NeverMind`

4. Railway запитає налаштування. Встанови **Root Directory**: `_ai-tools/gemini-mcp`

5. Після деплою іди в **Variables** і додай:
   ```
   GEMINI_API_KEY   = твій-ключ-від-google
   AUTH_TOKEN       = miy-secret-123
   PROJECT_CONTEXT  = див. нижче
   ```

6. Railway дасть тобі URL типу: `https://gemini-mcp-production-xxxx.up.railway.app`

---

### Крок 3 — Підключи до claude.ai/code

1. Відкрий https://claude.ai/code
2. Іди в **Settings** → **MCP Servers** (або шукай "Integrations")
3. Додай новий сервер:
   - **URL**: `https://твій-url.railway.app/sse?token=miy-secret-123`
   - **Name**: `Gemini Advisor`

4. Збережи — і готово! Працює на всіх пристроях.

---

## Як користуватись

Просто проси Claude звернутись до Gemini:

- _"Запитай Gemini як краще реалізувати цю функцію"_
- _"Хочу другу думку від Gemini щодо цієї архітектури"_
- _"Зроби Gemini рев'ю цього коду"_

Claude сам вирішує коли варто консультуватись з Gemini, або ти можеш попросити явно.

---

## Файли

```
_ai-tools/
└── gemini-mcp/
    ├── server.js      ← HTTP/SSE MCP сервер
    ├── package.json   ← залежності Node.js
    ├── .gitignore     ← ігнорує node_modules
    └── README.md      ← ця інструкція
```

---

## Змінні середовища

| Змінна | Обов'язково | Опис |
|--------|-------------|------|
| `GEMINI_API_KEY` | Так | Ключ від Google AI Studio |
| `AUTH_TOKEN` | Рекомендовано | Захист сервера від чужого доступу |
| `PROJECT_CONTEXT` | Рекомендовано | Контекст проекту для Gemini (див. нижче) |
| `PORT` | Ні | Порт (Railway встановлює автоматично) |

### Що вставити в PROJECT_CONTEXT

Це текст який Gemini отримує як постійний контекст — він завжди знатиме про що проект.
Скопіюй це значення в Railway Variables:

```
NeverMind PWA. Ванільний JS, localStorage, GitHub Pages, без фреймворків і бекенду. 13 JS модулів: app-core-nav.js (стан, switchTab), app-core-system.js (boot, кошик), app-ai-core.js (callAI, getAIContext), app-inbox.js (sendToAI), app-tasks-core.js, app-habits.js, app-notes.js, app-finance.js, app-health.js, app-projects.js, app-evening-moments.js, app-evening-onboarding.js, app-ai-chat.js. Критично: не чіпати localStorage.setItem override в app-core-system.js, не додавати централізовану БД, не видаляти локальні getTasks/saveNotes функції, порядок скриптів в index.html важливий.
```
