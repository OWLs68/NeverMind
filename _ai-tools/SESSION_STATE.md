# Стан сесії

**Оновлено:** 2026-03-31

## Зараз робимо
✅ Виправлено deploy pipeline — GitHub Pages тепер оновлюється після кожного auto-merge.

## Зроблено в цій сесії (31.03.2026)

### Код:
- `.github/workflows/deploy.yml` — додано `workflow_run` тригер. Причина: `GITHUB_TOKEN` пуші не тригерять інші воркфлоу (GitHub обмеження). Auto-merge пушив в main але deploy.yml ніколи не запускався → Pages не оновлювались.
- `sw.js` — CACHE_NAME оновлено до `nm-20260331-1846`

### Статус:
- ✅ deploy pipeline виправлено
- ✅ GitHub Pages тепер деплоїться після кожного auto-merge

## Гілка розробки
`claude/fix-auto-update-PMdxR`

## Поточна версія
v69 (після деплою цієї гілки)
