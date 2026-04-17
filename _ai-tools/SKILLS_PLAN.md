# Скіли Claude Code — індекс і коли активувати

> Скіл — інструкція у `.claude/commands/<name>.md` яка активується за трігер-фразами або командою `/<name>`. Це інструменти **розробки**, не фічі NeverMind.
>
> **Статус 17.04.2026 (сесія cnTkD):** всі 7 скілів **написані**. Наступний етап — впровадження їх інструкцій у код за пріоритетами нижче.

---

## 7 скілів — коли активувати

| Скіл | Файл | Коли активувати | Пріоритет |
|------|------|-----------------|-----------|
| `/ux-ui` | `.claude/commands/ux-ui.md` | Будь-яка UI-задача (модалка / новий компонент / стилізація). Читає `docs/DESIGN_SYSTEM.md`, блокує фіолет, білі модалки, padding не на outer panel | 🟢 активний |
| `/prompt-engineer` | `.claude/commands/prompt-engineer.md` | Зміна промптів OWL (тон, антигалюцинації). Карта 12 промптів у коді + єдиний шаблон Роль→Контекст→Правила→Антигал→Приклади→Формат | 🟢 активний |
| `/pwa-ios-fix` | `.claude/commands/pwa-ios-fix.md` | iOS Safari баги (bfcache / SW / keyboard / overscroll). Перевіряє що вже є у `boot.js`, додає тільки відсутнє | 🟢 активний |
| `/owl-motion` | `.claude/commands/owl-motion.md` | Впровадження анімації сови. Блокується: потрібна багатошарова SVG від Романа (Flaticon/unDraw/svgrepo). 5 станів idle/alert/thinking/error/greeting, чистий CSS keyframes без бібліотек | 🟢 заблокований SVG |
| `/supabase-prep` | `.claude/commands/supabase-prep.md` | Перед першою міграцією на Supabase — патерн міграції, retry/exponential backoff, offline queue, error handling | 🟡 перед Supabase |
| `/a11y-enforcer` | `.claude/commands/a11y-enforcer.md` | Перед публічним релізом (після стрес-тесту 20-30 юзерів) — WCAG 2.1 AA, aria-labels, VoiceOver | 🔴 перед релізом |
| `/gamification-engine` | `.claude/commands/gamification-engine.md` | Блок 3 ROADMAP — прогрес-бари / streak / тихі ачівки / мікро-анімації. Табу: бали/XP, рейтинги, блокуючі "Вітаємо!" | 🔵 Блок 3 |

---

## Формат нового скіла

Якщо пишеш новий скіл — дивись приклади у `.claude/commands/*.md`. Загальний патерн:

1. **Блок зверху** `⚠️ Перед виконанням — обов'язкові перевірки` (5 пунктів self-audit — див. `CLAUDE.md` правило "🛡️ Аудит скілів")
2. **Основне тіло** — що робить скіл, крок за кроком
3. **Трігер-фрази** — коли активувати (для авто-підтягування)
4. <500 рядків. Великі довідники виносити у `reference.md`

**Self-audit перед створенням:** перевірити що DOM-селектори / CSS-класи / функції реально існують у коді; скіл не дублює архітектуру; нагадує про CACHE_NAME bump; делегує на `/new-file` при створенні JS-модулів у `src/`.

---

## Відкладено / відкинуто

- **Gemini SVG Creator** (`htuzel/gemini-svg-creator`) — відкладено, об'єднати з B-56 (40 іконок категорій Фінансів). Use-cases: іконки, empty states, онбординг, ачівки, графіки
- **Anime.js / Lottie / Rive** для анімації OWL — **відкинуто** на користь чистого CSS keyframes (без +20KB бібліотеки)
- **Remotion Master** (відео на React), **Social Carousel** (маркетинг) — не наш продукт

---

## Ресурси

- [code.claude.com/docs/en/skills](https://code.claude.com/docs/en/skills) — офіційна дока формату SKILL.md
- [hesreallyhim/awesome-claude-code](https://github.com/hesreallyhim/awesome-claude-code) — awesome-list
- [sickn33/antigravity-awesome-skills](https://github.com/sickn33/antigravity-awesome-skills) — 1400+ готових скілів
