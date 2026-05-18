# EU Launch Checklist — для Романа

> **Створено:** OBErR 18.05.2026 (Council Pre-mortem).
>
> **Призначення:** покроковий чек-ліст ЩО зробити ПЕРЕД першим € від EU юзера. Текст у legal-сторінках (Settings → «Юридична інформація» / «Конфіденційність» / «Умови використання») — це **DRAFT**. Без заповнення `[PLACEHOLDER]` токенів публічний реліз небезпечний.
>
> **Контекст:** `docs/EU_COMPLIANCE.md` — повний огляд законодавчих вимог.

---

## 🚨 КРИТИЧНІ кроки (без них НЕ запускатись)

### 1. Обрати VAT-стратегію

Два варіанти, обирай ОДИН:

**Варіант A — Paddle / Lemonsqueezy (рекомендую)**
- Комісія ~5%. Сетап 1 день.
- Беруть VAT на себе → ти не реєструєшся в OSS.
- Беруть 14-day withdrawal на себе → не треба свого checkbox у NeverMind.
- Paddle: paddle.com → Sign up → API key → інтеграція через JS SDK.
- Lemonsqueezy: lemonsqueezy.com → аналогічно.

**Варіант B — OSS реєстрація через Belastingdienst NL**
- Безкоштовно, але 2-3 тижні на реєстрацію + квартальні звіти.
- Сам обчислюєш VAT для кожної країни (DE 19%, FR 20%, IE 23%...).
- Сам платиш у Belastingdienst.
- Потрібен бухгалтер або сервіс типу Quaderno (~€30/міс).

**Рекомендую: Paddle.** Соло-розробник + продукт-фокус → не варто витрачати тижні на податкову бюрократію.

---

### 2. Зареєструватись як підприємець у Нідерландах

- KvK (Chamber of Commerce) — eenmanszaak (ZZP). Онлайн через kvk.nl, €82, ~30 хв + appointment.
- Belastingdienst автоматично видасть VAT номер (BTW) через ~2 тижні.
- Без KvK + VAT — публікувати Impressum без цих номерів **юридично хибно** і провокує Abmahnung.

---

### 3. Заповнити `[PLACEHOLDER]` токени у NeverMind

Файл: `src/core/nav.js` константа `LEGAL_CONTENT` (3 секції: impressum / privacy / terms).

Замінити:
- `[PLACEHOLDER: Повне ім'я]` → твоє повне ім'я як у паспорті
- `[PLACEHOLDER: Адреса, NL]` → твоя бізнес-адреса (KvK адреса дозволена)
- `[PLACEHOLDER: контактний email]` → бізнес-email (НЕ особистий)
- `[PLACEHOLDER: KvK номер]` → 8-значний KvK номер
- `[PLACEHOLDER: VAT номер]` → формат `NL[9 цифр]B[2 цифри]`

**Знайти:** `grep -n "PLACEHOLDER" src/core/nav.js` → 8 точок.

---

### 4. Перевірити DPF статус OpenAI + Anthropic

Перед публікацією — зайти на [dataprivacyframework.gov](https://dataprivacyframework.gov) → пошук "OpenAI" + "Anthropic" → переконатись що **Active** статус.

⚠️ **FISA Section 702** — впливає на DPF. Якщо статус «Pending» або «Inactive» — Privacy Policy text НЕ можна публікувати без правки. Використати fallback: SCC (Standard Contractual Clauses Module 2/3) у DPA.

DPA links:
- OpenAI: openai.com/policies/data-processing-addendum
- Anthropic: anthropic.com/legal/dpa

---

## 🟡 ВИСОКИЙ ПРІОРИТЕТ (1 день роботи разом)

### 5. Якщо Варіант B (OSS) — налаштувати квартальні звіти

- Створити Belastingdienst account: belastingdienst.nl → DigiD або eHerkenning
- Або найняти бухгалтера (€30-100/міс)
- Або сервіс типу Quaderno / Octobat для автоматизації

### 6. Якщо Варіант A (Paddle) — додати checkout flow у NM

Це окрема сесія коду після Supabase. Поки що чекати.

### 7. ePrivacy — окремий checkbox для marketing email

Зараз NM не шле email. Коли підключатимемо (Postmark / Sendgrid):
- Окремий checkbox `[ ] Я погоджуюсь отримувати маркетингові листи`
- НЕ default-checked
- Можливість відписатись 1 кліком

---

## ⚪ СЕРЕДНІЙ ПРІОРИТЕТ (восени 2026)

### 8. CRA (Cyber Resilience Act, 11.09.2026)

- Vulnerability reporting: створити `security@[твій домен]` email (security.txt у root)
- SBOM (Software Bill of Materials): `npm list --all > sbom.txt` (для NeverMind мінімально — тільки esbuild + node-html-parser)
- Security update policy: документувати у Terms

### 9. Data Act (Export my data)

✅ **Зроблено** — Налаштування → «Експортувати JSON» (OBErR 18.05.2026).

### 10. PLD (Product Liability Directive, 09.12.2026)

✅ **Зроблено частково** — Limited liability клаузула у Terms (OBErR draft).
🟡 Insurance — закласти у бюджет коли буде платний оборот €500/міс.

---

## 🟢 НЕ турбуватись (соло, <€2M)

- EAA, NIS2, DSA, AI Code of Practice — мікро-винятки.
- WCAG 2.1 AA — базова гігієна (alt-text, контраст, клавіатурна навігація), але не обов'язкова за EAA для соло.

---

## Швидкий старт (мінімум)

Перед публічним релізом — мінімум 3 дні:

1. **День 1:** KvK реєстрація (online + email подтвердження)
2. **День 2-7:** очікування VAT номера від Belastingdienst (~5-10 робочих днів)
3. **День 8:** заповнити `[PLACEHOLDER]` у nav.js + Paddle setup
4. **День 9:** перевірити DPF status + DPA підписати
5. **День 10:** запуск 🎉

---

## Питання які зараз відкриті

- [ ] Чи хочеш ти зробити landing page `nevermind.app/legal` як зовнішню сторінку (для SEO) чи лишити inline у Settings? Поки що inline — швидше для PWA.
- [ ] Чи буде українська версія legal текстів обов'язковою? (Зараз — лише українська у LEGAL_CONTENT; англійська — після i18n epoch.)
- [ ] Імпорт Privacy Policy у `/.well-known/dpa.json` — для майбутніх AI-агентів (auto-discovery)?

---

## Історія документа

- **OBErR 18.05.2026** — створено NM-Claude після завершення Backup Phase 2 + B-179 + EU Compliance pre-MVP. Council Pre-mortem застеріг від публікації legal-сторінок без заповнення placeholder'ів.
