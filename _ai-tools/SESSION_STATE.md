# Стан сесії

**Оновлено:** 2026-04-01

## Зараз робимо
✅ B-11/B-12 виправлено — padding 48px → 20px в task-modal і habit-modal.

## Зроблено в цій сесії (01.04.2026)

### Код:
- `.github/workflows/auto-merge.yml` — додано job `deploy` (needs: merge). Merge і deploy — один workflow без крос-workflow тригерів.
- `.github/workflows/deploy.yml` — прибрано `workflow_run`. Залишено тільки `push: main` для хотфіксів.
- `sw.js` — CACHE_NAME оновлено до `nm-20260401-0448`

### Причина:
`workflow_run` ненадійний — GitHub пропускає/затримує ці події. Два окремі workflows не гарантують деплой після мержу. Рішення: все в одному файлі.

### Статус:
- ✅ deploy pipeline v2 запушено, чекаємо підтвердження від Романа що оновлення видно

## Гілка розробки
`claude/fix-auto-update-PMdxR`

## Відкриті баги
- B-03, B-04/B-09, B-05, B-06 — ще не виправлено

## Наступне
- Перевірити що B-11/B-12 видно на prod після деплою
