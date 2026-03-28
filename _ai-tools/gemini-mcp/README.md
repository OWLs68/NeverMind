# Gemini MCP Server

Дає Claude Code доступ до Gemini як до вбудованого інструменту.
Коли ти працюєш в Claude Code — він може сам запитати Gemini, порівняти відповіді і дати тобі синтез.

---

## Встановлення (один раз)

### 1. Встанови залежності

```bash
cd _ai-tools/gemini-mcp
npm install
```

### 2. Отримай Gemini API ключ

Іди на https://aistudio.google.com → Get API key → безкоштовно.

### 3. Налаштуй Claude Code

Відкрий або створи файл `~/.claude/settings.json` і додай:

```json
{
  "mcpServers": {
    "gemini": {
      "command": "node",
      "args": ["/ПОВНИЙ/ШЛЯХ/ДО/_ai-tools/gemini-mcp/server.js"],
      "env": {
        "GEMINI_API_KEY": "твій-ключ-тут"
      }
    }
  }
}
```

> Повний шлях — це те що видає команда `pwd` коли ти в папці проекту.
> Наприклад: `/home/user/NeverMind/_ai-tools/gemini-mcp/server.js`

### 4. Перезапусти Claude Code

Просто закрий і відкрий знову термінал з Claude Code.

---

## Як користуватись

Нічого особливого робити не треба — Claude сам вирішує коли звертатись до Gemini.
Але ти можеш явно попросити:

- _"Запитай Gemini як краще зробити X"_
- _"Хочу другу думку від Gemini щодо цього коду"_
- _"Зроби Gemini рев'ю цього файлу"_

Claude запитає Gemini, покаже обидві відповіді і дасть тобі фінальний синтез.

---

## Інструменти

| Інструмент | Що робить |
|------------|-----------|
| `ask_gemini` | Задає питання Gemini, повертає його відповідь |
| `gemini_review_code` | Просить Gemini зробити код-рев'ю |

---

## Структура файлів

```
_ai-tools/
└── gemini-mcp/
    ├── server.js      ← основний сервер
    ├── package.json   ← залежності
    └── README.md      ← ця інструкція
```
