# План скілів Claude Code для NeverMind

> Створено 16.04.2026 (сесія W6MDn). Скіл — набір інструкцій у `.claude/commands/<name>.md` що Claude автоматично підтягує за трігер-фразами (trigger — сигнал активації).
>
> **Статус після сесії VAP6z (16.04.2026):** два з 6 скілів вже імплементовані у `.claude/commands/` як початкові версії (✅), решта — у плані.

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

- Розміщення: `.claude/commands/<name>.md` (проект) або `~/.claude/skills/` (глобально)
- Progressive disclosure: description завжди в контексті, body тільки при активації
- Додаткові файли: `reference.md`, `examples.md`, `scripts/*.py|sh`
- Офіційна дока: [code.claude.com/docs/en/skills](https://code.claude.com/docs/en/skills)

---

## 🟢 Пріоритет 1 — робимо найближчим часом

### 1. UX-UI (адаптований під DESIGN_SYSTEM.md)

**Проблема:** Claude робить UI "дефолтним" (білі модалки, не glass) бо "забуває" про дизайн-систему. Приклад — B-43/B-49/B-51/B-55 у сесії W6MDn.

**Трігери:** "модалка", "новий компонент", "стилізувати", "UI", "інтерфейс".

**Що робить:** перед кодом UI — читає `docs/DESIGN_SYSTEM.md`, `style.css`, `index.html` приклади. Блокує: фіолетовий колір, білі модалки, padding не на outer panel.

**Статус:** ⏳ Не реалізовано.

### 2. Prompt Engineer

**Проблема:** 7+ промптів OWL (`INBOX_SYSTEM_PROMPT`, `getOWLPersonality`, промпти табло, finance coach, extract facts) у `src/ai/core.js` і `src/owl/proactive.js`. Тюнінг займає години.

**Трігери:** "OWL не так відповідає", "промпт", "змінити тон", "антигалюцинація".

**Що робить:** єдиний формат промпту — роль → правила → антигалюцинації → приклади → формат виходу. Перед зміною — знаходить промпт, аналізує структуру, показує diff.

**Статус:** ⏳ Не реалізовано.

### 3. iOS Safari PWA Debugger

**Проблема:** iOS-специфіка — bfcache (back-forward cache), SW race (гонки стану сервіс-воркера), keyboard avoiding, localStorage 7-day eviction. Рік дебагу накопичено у `src/core/boot.js` і `src/ui/keyboard.js`.

**Трігери:** "не оновлюється", "зникли дані", "клавіатура закриває поле", "PWA баг", "iOS", "Safari".

**Що робить:** перевіряє код проти чеклисту iOS-проблем. Перевірка пре-фіксу: чи не зламає bfcache, чи не перепише setupKeyboardAvoiding, чи CACHE_NAME оновлено.

**Статус:** ✅ **Початкова версія реалізована** у [`.claude/commands/pwa-ios-fix.md`](../.claude/commands/pwa-ios-fix.md) (сесія VAP6z 16.04.2026). Додано попередження про реальні CSS-класи, заборону чіпати `setupSW`/`localStorage override`, обов'язковий CACHE_NAME bump. Впроваджуємо у наступній сесії.

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

**Статус:** ⏳ Не реалізовано.

---

## 🔴 Пріоритет 3 — перед публічним релізом

### 5. A11y-Enforcer

WCAG-атрибути (Web Content Accessibility Guidelines — стандарти доступності), aria-labels, фокус-порядок, контраст кольорів.

**Коли:** перед публічним запуском (після стрес-тесту 20-30 юзерів). Відкладається — A11y додається у існуючий HTML за 1-2 сесії, не архітектура.

**Статус:** ⏳ Не реалізовано.

---

## 🔵 Пріоритет 4 — Блок 3 ROADMAP

### 6. Gamification-Engine

Прогрес-бари, ачівки, мікро-анімації для стріків і скору.

**Коли:** коли у ROADMAP дійдемо до геймифікації (зараз Блок 2 — концепції вкладок).

**Статус:** ⏳ Не реалізовано.

---

## ❌ Відкинуто

- **Remotion Master** (відео на React) — ми не робимо відео, не React
- **Social Carousel Builder** — NeverMind не маркетинговий продукт

---

## 🦉 Скіл для анімації OWL — окремий трек

### `/owl-motion` — Система анімації OWL-сови

**Рішення:** чистий SVG + CSS keyframes (без Lottie, без Anime.js, без бібліотек). Реалізовано у сесії VAP6z як альтернатива плану через `freshtechbro/claudedesignskills` — **простіше і легше** (без +20KB бібліотеки).

**5 станів:** `idle` (левітація) / `alert` (кивок) / `thinking` (очі) / `error` (опущені крила) / `greeting` (змах крилом).

**Плюс:** анімація розгортання бабла (`scaleX(0)→scaleX(1)` з `transform-origin: left`) — реалізує те що було у плані з сесії 3229b.

**Статус:** ✅ **Початкова версія реалізована** у [`.claude/commands/owl-motion.md`](../.claude/commands/owl-motion.md). Додано попередження: реальна DOM-структура (`#owl-board`/`#owl-tab-board-*`), делегація на `/new-file` для створення JS-модулів, принцип "ОДИН МОЗОК" (не дублювати OWL-архітектуру), CACHE_NAME bump. Впроваджуємо у наступній сесії — потрібна **багатошарова SVG сова** від Романа.

**Варіант 3 (Gemini SVG Creator, `htuzel/gemini-svg-creator`)** — відкладено, об'єднати з B-56 (40 іконок категорій).

Use-cases для Gemini SVG Creator:
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
- [freshtechbro/claudedesignskills](https://github.com/freshtechbro/claudedesignskills) — 22 скіли анімацій (ми **не використовуємо** — перейшли на чистий CSS)
- [htuzel/gemini-svg-creator](https://github.com/htuzel/gemini-svg-creator) — Gemini SVG генерація (варіант 3, відкладено)

---

## 📋 Черговість впровадження (наступна сесія)

1. ✅ `/owl-motion` і `/pwa-ios-fix` — **початкові версії готові**, треба імплементувати у коді (для `/owl-motion` потрібна багатошарова SVG сова)
2. ⏳ Стартувати **Пріоритет 1** — написати `/ux-ui` і `/prompt-engineer` за тим самим патерном з попередженнями
3. ⏳ Далі — анімація OWL у коді (SVG + CSS states + інтеграція з `nm-data-changed`)
4. Supabase Prep — перед першою міграцією
5. A11y — перед публічним релізом
6. Gamification — Блок 3 ROADMAP

---

## ⚠️ Правило написання нових скілів (для кожного нового чата)

**Перед створенням або використанням скіла — self-audit:**

1. Чи є у CLAUDE.md "Що не можна змінювати без обговорення" — пункт що цей скіл торкається?
2. Чи DOM-селектори / CSS-класи / функції які скіл використовує — **реально існують** у коді? (Якщо ні — скіл пише код у порожнечу)
3. Чи скіл **дублює існуючу архітектуру** (OWL модулі, Trash, tabs, boot)? Якщо так — інтегруй, не створюй паралельну.
4. Чи скіл **нагадує про CACHE_NAME** при зміні коду (`index.html` / `style.css` / JS-файли)?
5. Чи скіл **делегує на `/new-file`** при створенні нових JS-модулів у `src/`?

**Якщо знайдено порушення — зупинись і повідом Роману список**, не виконуй скіл самочинно.

Це правило додано у `CLAUDE.md` секція "Процес роботи" 16.04.2026 (W6MDn).
