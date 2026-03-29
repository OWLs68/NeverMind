# Стан сесії

**Оновлено:** 2026-03-29

## Зараз робимо
Сесія завершена. Всі файли оновлено.

## Зроблено в цій сесії (29.03.2026)

### CSS і структура
- `style.css` — винесено весь CSS з `index.html` (1128 рядків)
- `index.html` — замінено `<style>` на `<link href="style.css">`
- `sw.js` — додано `style.css` в `STATIC_ASSETS`

### Inbox чат — 3-стейтна система
- `app-ai-chat.js`, `app-ai-core.js`, `app-core-system.js` — inbox чат тепер працює як усі інші вкладки: закрито → A (compact) → B (full)
- Видалено `inboxChatExpanded`, `inboxCompactH`, `getInboxExpandHeight()` (~150 рядків)
- Видалено старий CSS `#inbox-chat-window { height: auto }` і `#inbox-chat-messages { flex: none }` — вони ламали скрол

### Зони свайпу чат-вікна
- `style.css` — `.ai-bar-chat-handle` тепер full-width ~44px touch-зона, полоска через `::after`
- `app-ai-chat.js` — touch-ліснери перенесено з `chatWin` на `handleEl` (handle = Зона A, messages = Зона B, без конфліктів)
- Видалено `_startedOnMessages` прапорець (більше не потрібен)

### iOS SW auto-update
- `app-core-system.js` — `reg.update()` при кожному відкритті (iOS не оновлювало без цього)
- `app-core-system.js` — `controllerchange → reload()` з `hadController` + `_reloading` захистом

### Система деплою — повний фікс
- `auto-merge.yml` — додано `-X theirs` (вирішення конфліктів sw.js на користь feature-гілки)
- `auto-merge.yml` — додано `concurrency: cancel-in-progress: true`
- CI більше не чіпає `sw.js` — тільки `index.html` badge

### Документація
- `CLAUDE.md` — додано розділ "Система деплою", пояснення `-X theirs`, iOS SW логіки
- `docs/CHANGES.md` — оновлено
- `РОМАН_ПРОГРЕС.md` — оновлено повним записом сесії 29.03

## Поточна гілка
`claude/read-repository-bd3qH`

## Поточна версія
`v69` (badge показує Amsterdam час останнього деплою)

## Наступний крок (для нового чату)
Роман тестує жести і чат на телефоні. Можливі задачі:
- Перевірити чи правильно відкривається чат при фокусі на input після змін
- Можливо: покращити UX тапу по handle (зараз завжди закриває, B → A не через тап)
- Gemini MCP — ще не тестований в цій сесії (відкладено)

## Важливо для нового чату
- Гілка розробки: `claude/read-repository-bd3qH`
- НЕ чіпати логіку `setupSW()` в `app-core-system.js` — кожна частина вирішує конкретну проблему iOS
- При кожному пуші оновлювати `CACHE_NAME` в `sw.js` локально (CI не робить це)
- CI тепер надійний: `-X theirs` вирішує конфлікти, `concurrency` скасовує зайві джоби
