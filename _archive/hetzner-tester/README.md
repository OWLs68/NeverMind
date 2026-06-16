# Hetzner AI-Tester — АРХІВ (з 16.06.2026, сесія foyz2r)

Стара система автотестів, що жила на окремому сервері Hetzner (94.130.25.22):
Python + browser-harness (CDP) + cron 3×/день. Замінена на **Playwright у
GitHub Actions** (`tests/e2e/`, workflow `.github/workflows/e2e.yml`).

## Чому замінили (Council 15.06.2026)

- **Дві системи = борг.** Хетзнер (32 сценарії, 7 disabled) + новий Playwright
  паралельно — ніхто не встигав синхронити. Council одноголосно: одна система.
- **Окремий сервер** — платний, крихкий стек (CDP touch нестабільний),
  PAT-ротація, health-check. Playwright у CI — безкоштовно, без сервера.
- **Гроші на AI-тести.** Хетзнер викликав реальний OpenAI; Playwright підмінює
  відповіді (`tests/e2e/helpers.js` mockAI) → $0.

## Що тут лежить

- `ai-tester.py` — 32 сценарії (список для порту → `tests/e2e/`)
- `health-check.py`, `hetzner-setup.sh`, `setup-cron.sh` — інфраструктура сервера
- `auto-merge-tester.yml` — старий workflow для гілок `claude/ai-tester-*`
- `AI_TESTER_INTEGRATION.md` — контракт NM↔Hetzner
- `TESTER_SCENARIOS_PLAN.md` — план 35 UI-сценаріїв (довідка для нарощення Playwright)
- `HETZNER_TESTER_SETUP.md` — покроковий setup сервера
- `tester-*.json/md` — рантайм-стан (heartbeat, лог, конфіг, черга команд)

## Сервер

Роман вимикає сервер Hetzner вручну (він поза репо). Цей архів — лише код+доки.

## Нова система

- Тести: `tests/e2e/*.spec.js` + фундамент `tests/e2e/helpers.js`
- Запуск: автоматично на кожен push (`e2e.yml`), движки Mobile Safari + Desktop Chrome
- Перевірка результату: NM-Claude через GitHub MCP (Actions → E2E)
