# Стан сесії

**Оновлено:** 2026-03-29 09:59 (Amsterdam)

## Зараз робимо
Автоматична пам'ять між сесіями — Stop hook + правила оновлення SESSION_STATE.md після кожного пушу

## Зроблено в цій сесії
- `app-ai-core.js` — fix B-03: прибрали "ремонт" з прикладів задачі, посилили правило create_project
- `index.html` + `sw.js` — версія v69 · 28.03 22:17
- `~/.claude/stop-hook-git-check.sh` — авто-запис `_ai-tools/LAST_SESSION.md` після кожної сесії (git commit + push)
- `CLAUDE.md` + `START_HERE.md` — нове правило: після кожного пушу оновлювати SESSION_STATE.md
- `_ai-tools/LAST_SESSION.md` — тепер в репо, авто-генерується хуком

## Наступний крок
Продовжити по багах: B-04 (тап на день в календарі не працює)
