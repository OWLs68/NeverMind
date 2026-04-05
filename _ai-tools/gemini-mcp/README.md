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

1. Іди на https://railway.app і зареєструйся
2. **"New Project"** → **"Deploy from GitHub repo"**
3. Вибери репозиторій `NeverMind`
4. Встанови **Root Directory**: `_ai-tools/gemini-mcp`
5. Додай змінні середовища в **Variables**:
   ```
   GEMINI_API_KEY   = твій-ключ-від-google
   AUTH_TOKEN       = miy-secret-123
   ```
6. Railway дасть URL типу: `https://nevermind-production.up.railway.app`

---

### Крок 3 — Підключи до claude.ai/code

1. Відкрий https://claude.ai/code
2. **Settings** → **MCP Servers** → додай новий:
   - **Name**: `Gemini Advisor`
   - **URL**: `https://ТВІЙ-URL.up.railway.app/sse?token=ТВІЙ-AUTH-TOKEN`

Наприклад:
```
https://nevermind-production.up.railway.app/sse?token=miy-secret-123
```

> **Важливо:** URL має закінчуватись на `/sse?token=...` — це SSE транспорт.
> Альтернатива (Streamable HTTP): `/mcp` — але SSE надійніший для claude.ai.

---

## Транспорти

Сервер підтримує **два** MCP транспорти:

| Транспорт | Endpoint | Протокол |
|-----------|----------|----------|
| **SSE** (рекомендовано) | `GET /sse` + `POST /messages` | 2024-11-05 |
| **Streamable HTTP** | `POST /mcp` | 2025-11-25 |

Claude.ai/code використовує SSE. Новіші клієнти можуть використовувати `/mcp`.

---

## Перевірка здоров'я

```
GET /health
→ {"status":"ok","name":"gemini-mcp","version":"2.0.0","transports":["sse","streamable-http"],"activeSessions":0}
```

---

## Файли

```
_ai-tools/gemini-mcp/
├── server.js      ← Dual-transport MCP сервер (SSE + Streamable HTTP)
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
| `PROJECT_CONTEXT` | Ні | Контекст проекту для Gemini |
| `PORT` | Ні | Порт (Railway встановлює автоматично) |
