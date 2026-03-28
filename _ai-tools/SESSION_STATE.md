# Стан сесії

**Оновлено:** 2026-03-28

## Зараз робимо
Фінальне тестування Gemini MCP сервера після серії виправлень

## Зроблено в цій сесії
- `_ai-tools/gemini-mcp/server.js` — повністю створено і відлагоджено HTTP MCP сервер для Gemini
- `_ai-tools/gemini-mcp/package.json` — залежності Node.js
- `_ai-tools/gemini-mcp/README.md` — інструкція з деплою на Railway
- `CLAUDE.md` — додано правила: 3-етапний цикл з Gemini, протокол незгоди, журнал рішень, автосейв сесії, авто-оновлення РОМАН_ПРОГРЕС.md
- `_ai-tools/decisions.md` — створено журнал архітектурних рішень
- `_ai-tools/SESSION_STATE.md` — створено (замість SESSION_HANDOFF.md)
- `РОМАН_ПРОГРЕС.md` — оновлено з записом сесії 25-28.03

## Виправлені помилки сервера (хронологія)
1. stdio → HTTP транспорт (для web)
2. SSE → StreamableHTTP (claude.ai/code не підтримує SSE)
3. Додано CORS headers
4. Виправлено порт Railway (8080, не 3000)
5. "Server not initialized" — перейшли на stateless режим
6. gemini-2.0-flash → gemini-1.5-flash (модель недоступна)
7. v1beta → v1 API (1.5-flash потребує v1)
8. systemInstruction → SYSTEM_PROMPT в тілі запиту (v1 не підтримує systemInstruction)

## Наступний крок
Тестування: написати в claude.ai/code:
"використай ask_gemini щоб запитати: чи ти підключений і що ти знаєш про проект NeverMind?"

## Важливий контекст
- Railway деплоїть автоматично при пуші в гілку multi-ai-integration-setup-u3u4x
- Сервер на: nevermind-production.up.railway.app
- Gemini підключено як "Gemini Advisor" в claude.ai/code Settings → MCP Servers
- Гілка розробки: `claude/multi-ai-integration-setup-u3u4x`
- Поточний стабільний коміт: 347aa72
