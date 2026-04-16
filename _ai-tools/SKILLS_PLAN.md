# План скілів Claude Code для NeverMind

> Створено 16.04.2026 (сесія W6MDn). Скіл — набір інструкцій у `.claude/skills/<name>/SKILL.md` що Claude автоматично підтягує за трігер-фразами.

---

## Формат SKILL.md (офіційний)

```yaml
---
name: skill-name                  # kebab-case, до 64 символів
description: Коли використовувати + трігер-фрази (до 1536 симв)
allowed-tools: Read Grep Edit     # опційно — без запиту дозволу
disable-model-invocation: true    # опційно — тільки юзер викликає
---

Інструкції Markdown (<500 рядків, далі — у reference.md)
```

- Розміщення: `.claude/skills/<name>/SKILL.md` (проект) або `~/.claude/skills/` (глобально)
- Progressive disclosure: description завжди в контексті, body тільки при активації
- Додаткові файли: `reference.md`, `examples.md`, `scripts/*.py|sh`
- Офіційна дока: [code.claude.com/docs/en/skills](https://code.claude.com/docs/en/skills)

---

## 🟢 Пріоритет 1 — робимо найближчим часом

### 1. UX-UI (адаптований під DESIGN_SYSTEM.md)

**Проблема:** Claude робить UI "дефолтним" (білі модалки, не glass) бо "забуває" про дизайн-систему. Приклад — B-43/B-49/B-51/B-55 у цій сесії.

**Трігери:** "модалка", "новий компонент", "стилізувати", "UI", "інтерфейс".

**Що робить:** перед кодом UI — читає `docs/DESIGN_SYSTEM.md`, `style.css`, `index.html` приклади. Блокує: фіолетовий колір, білі модалки, padding не на outer panel.

### 2. Prompt Engineer

**Проблема:** 7+ промптів OWL (`INBOX_SYSTEM_PROMPT`, `getOWLPersonality`, промпти табло, finance coach, extract facts) у `src/ai/core.js` і `src/owl/proactive.js`. Тюнінг займає години.

**Трігери:** "OWL не так відповідає", "промпт", "змінити тон", "антигалюцинація".

**Що робить:** єдиний формат промпту — роль → правила → антигалюцинації → приклади → формат виходу. Перед зміною — знаходить промпт, аналізує структуру, показує diff.

### 3. iOS Safari PWA Debugger

**Проблема:** iOS-специфіка — bfcache, SW race, keyboard avoiding, localStorage 7-day eviction. Рік дебагу накопичено у `src/core/boot.js` і `src/ui/keyboard.js`.

**Трігери:** "не оновлюється", "зникли дані", "клавіатура закриває поле", "PWA баг", "iOS", "Safari".

**Що робить:** перевіряє код проти чеклисту iOS-проблем. Перевірка пре-фіксу: чи не зламає bfcache, чи не перепише setupKeyboardAvoiding, чи CACHE_NAME оновлено.

---

## 🟡 Пріоритет 2 — перед Supabase

### 4. Supabase Prep (об'єднаний)

Об'єднує Migration Guardian + Performance + retry/fallback + offline queue + error handling.

**Включає:**
- **Міграції:** чек прапорця → трансформація → тест на порожньому + заповненому localStorage → новий прапорець. Зараз 3 міграції (`nm_finance_cats_v2`, `nm_facts`, `nm_health_v2`) писались з нуля ризикуючи даними.
- **Performance:** розширення Ф4 моніторингу з B-67 — ліміти на кількість fetch, повільні запити, alerting у панелі логу.
- **Retry:** 3 спроби з exponential backoff (1с/2с/4с) + offline queue у localStorage.
- **Error handling:** єдиний toast при збою + запис у logger.

**Коли:** коли Роман почне міграцію на Supabase.

---

## 🔴 Пріоритет 3 — перед публічним релізом

### 5. A11y-Enforcer

WCAG-атрибути, aria-labels, фокус-порядок, контраст кольорів.

**Коли:** перед публічним запуском (після стрес-тесту 20-30 юзерів). Відкладається — A11y додається у існуючий HTML за 1-2 сесії, не архітектура.

---

## 🔵 Пріоритет 4 — Блок 3 ROADMAP

### 6. Gamification-Engine

Прогрес-бари, ачівки, мікро-анімації для стріків і скору.

**Коли:** коли у ROADMAP дійдемо до геймифікації (зараз Блок 2 — концепції вкладок).

---

## ❌ Відкинуто

- **Remotion Master** (відео на React) — ми не робимо відео, не React
- **Social Carousel Builder** — NeverMind не маркетинговий продукт

---

## 🦉 Скіл для анімації OWL — окремий трек

**Обрано варіант 2:** готова SVG + `freshtechbro/claudedesignskills` (Anime.js рушій).

**Кроки:**
1. Роман знаходить багатошарову SVG сову (Flaticon/unDraw/iconify/svgrepo) — окремі path для голови/тіла/крил/очей
2. Claude встановлює `freshtechbro/claudedesignskills` плагін
3. Пише 5 станів: `idle` / `talking` / `listening` / `error` / `celebration`
4. Інтегрує у `nm-data-changed` події

**Варіант 3 (Gemini SVG Creator, `htuzel/gemini-svg-creator`)** — відкладено, об'єднати з B-56 (40 іконок категорій). Use-cases:
- B-56 іконки категорій Фінансів
- Іконки вкладок
- Empty states ілюстрації
- Онбординг слайди
- Ачівки/медалі (Блок 3)
- Графіки Аналітики (B-62)
- Маркетинг для публічного релізу

Налаштування: Gemini API ключ + MCP-конфіг + клонування репо у `.claude/skills/`, ~30 хв.

---

## 📚 Зовнішні ресурси

- [code.claude.com/docs/en/skills](https://code.claude.com/docs/en/skills) — офіційна дока
- [hesreallyhim/awesome-claude-code](https://github.com/hesreallyhim/awesome-claude-code) — офіційний awesome-list
- [sickn33/antigravity-awesome-skills](https://github.com/sickn33/antigravity-awesome-skills) — 1400+ скілів
- [freshtechbro/claudedesignskills](https://github.com/freshtechbro/claudedesignskills) — 22 скіли анімацій
- [htuzel/gemini-svg-creator](https://github.com/htuzel/gemini-svg-creator) — Gemini SVG генерація

---

## 📋 Черговість впровадження

1. Роман вирішує коли стартуємо Пріоритет 1 (UX-UI + Prompt Engineer + iOS Debugger — можна одразу всі три)
2. Паралельно — анімація OWL (коли Роман знайде SVG сову)
3. Supabase Prep — перед першою міграцією
4. A11y — перед публічним релізом
5. Gamification — Блок 3 ROADMAP
