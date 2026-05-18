# EU Compliance — Дорожня карта

> **Створено:** JMQuT 17.05.2026. Research brain-Claude на запит Романа (вересень-листопад 2026). Передано у NM-сесію JMQuT.
>
> **Призначення:** єдина точка усіх compliance вимог EU перед публічним beta + платними юзерами. Замінює вузький `docs/AI_ACT_COMPLIANCE.md` як ширший зонтик (AI Act — лише один з ~10 регуляторних шарів).
>
> **Принцип:** соло-розробник з <€2M обороту → багато винятків. Але VAT OSS + Impressum + 14-day withdrawal + DPF — обовʼязкові з ПЕРШОГО € від EU юзера. Без цього — податкові порушення + позови.

---

## 🚨 КРИТИЧНЕ — VAT OSS

Це **податок**, не compliance. З першого € від EU юзера поза Нідерландами — обовʼязково платити VAT країни клієнта (DE 19%, FR 20%, IE 23% тощо). Без цього — податкове порушення.

### 2 варіанти:

1. **Paddle або Lemonsqueezy як merchant of record** — рекомендую для соло-розробника.
   - Беруть VAT на себе, комісія ~5%.
   - 1 день setup → далі нуль турботи.
2. **Реєстрація у OSS через Belastingdienst (NL)**.
   - 2-3 тижні + квартальні звіти.
   - Дешевше, але морока.

### ДIЯ ПЕРЕД першим EU юзером:
Обрати один з двох варіантів. **Без цього не запускатись.**

---

## 🟡 ВИСОКИЙ ПРІОРИТЕТ

### Impressum / Legal Notice (1 год)

Юзери з DE/AT/CH → юристи у DE реально шлють Abmahnung-листи з вимогою €500-2000 за відсутність Impressum. Це не теорія, це індустрія.

**ДIЯ:** сторінка "Legal Notice" з:
- Повне імʼя
- NL адреса (можна KvK)
- KvK номер
- VAT номер
- Email

Лінк у футері всіх сторінок.

### 14-day withdrawal checkbox (2 год)

EU споживач має право повернути гроші 14 днів. **Виняток:** якщо при checkout юзер ставить галочку:

> «Я погоджуюсь почати користування одразу і знаю що втрачаю право на 14-денну відмову.»

→ звільнено. Без галочки — повертати гроші навіть якщо юзер користувався.

**ДIЯ:** checkbox при оплаті + явний текст у Terms of Service. Інакше chargebacks неконтрольовані.

### Privacy Policy з DPF / Schrems II (пів дня)

NM використовує OpenAI (США) і Anthropic (США) — це передача даних поза EU.

**ДIЯ:**
- У privacy policy явно: «Передаємо дані в США через OpenAI та Anthropic, які DPF-certified (EU-US Data Privacy Framework)».
- Підписати DPA (Data Processing Addendum) — OpenAI має, Anthropic має.
- Fallback: SCC Module 2/3 у DPA.

**Увага:** FISA Section 702 закінчується 20.04.2026 — може похитнути DPF. Слідкувати за новинами влітку 2026.

---

## ⚪ СЕРЕДНІЙ ПРІОРИТЕТ (час є, але починати думати)

### Cyber Resilience Act (CRA) — з 11.09.2026

Software попадає під CRA. Обовʼязки:
- 24-годинне звітування серйозних вразливостей
- SBOM (Software Bill of Materials — список залежностей)
- Security updates на термін життя продукту

Повна сила з 11.12.2027.

**ДIЯ:** восени 2026 розібратись, заплановати у ROADMAP, додати vulnerability reporting процес.

### Data Act — право юзера експортувати дані

Потрібна функція експорту усіх даних юзера у JSON/Markdown. Це і так корисна фіча.

**Поточний стан NM:** немає повного експорту.

**ДIЯ до кінця 2026:** додати «Export my data» у Налаштування → JSON file з усім localStorage / Supabase юзера.

### Product Liability Directive (PLD) — з 09.12.2026

Software юридично стає **«product»**. Юзери можуть подавати в суд за збитки від AI-помилок.

**ДIЯ:**
- Limited liability клаузула у ToS — обмеження відповідальності
- Insurance — на майбутнє, коли буде платний оборот

**Звʼязок:** рішення прибрати AI з Health-вкладки (JMQuT 17.05.2026, див. `docs/AI_ACT_COMPLIANCE.md`) додатково знижує цей ризик. Гарне рішення з ретроспективи.

### ePrivacy — крім cookies (пів дня)

Окремий явний consent на marketing email (не закопувати у загальні ToS). Tracking pixels у листах теж під consent. CNIL у вересні 2025 оштрафував Google на €325M частково за tracking pixels.

**ДIЯ:**
- Окремий checkbox для marketing emails при реєстрації
- НЕ використовувати tracking pixels у транзакційних листах (або з consent)

---

## 🟢 НЕ СТОСУЄТЬСЯ (поки соло, <€2M обороту)

| Регуляція | Чому не торкається |
|-----------|-------------------|
| **EAA (European Accessibility Act)** | Мікро-виняток (<10 чол І <€2M). Але WCAG 2.1 AA робити все одно (alt-text, контраст, клавіатурна навігація — базова гігієна). |
| **NIS2 Directive** | Мікро- і малий виняток. Не торкається соло SaaS. |
| **DSA (Digital Services Act)** | NM особистий, юзери не публікують контент один одному. Якщо додаси share-функції / спільноту → попадає. Зараз — ні. |
| **AI Code of Practice 2025** | Стосується **провайдерів** GPAI (OpenAI, Anthropic), не deployer-ів. NM просто deployer → не торкається. |

---

## Звʼязок з вже відомими блокерами ROADMAP

Перед EU MVP:

| # | Блок | Стан |
|---|------|------|
| 1 | Security Hardening | 🚀 Active (DGH6F: 40 onclick → delegation; JMQuT: ще 44 onclick). Залишок ~241 onclick. |
| 2 | Health AI Isolation (AI Act) | ✅ Завершено JMQuT 17.05.2026 (`docs/AI_ACT_COMPLIANCE.md`) |
| 3 | GDPR / Cookies | ⚪ Не релевантне (NM не використовує трекери) |
| 4 | **VAT OSS** | 🆕 КРИТИЧНЕ перед першим EU юзером |
| 5 | **Impressum + 14-day withdrawal + DPF/Schrems II** | 🆕 Мінімум 1 день роботи разом |
| 6 | **CRA + Data Act + PLD** | 🆕 До кінця 2026 |

---

## TL;DR пріоритети для NM

1. **VAT OSS** — критично перед першим EU платним юзером. Paddle/Lemonsqueezy = найпростіший шлях.
2. **Impressum + 14-day withdrawal + DPF/Schrems II** — 1 день роботи всього. Прибирає 80% юридичних ризиків.
3. **Data Export функція** — закласти у roadmap до 2026 (CRA + Data Act).
4. **CRA** — стежити за гайдами восени 2026.
5. **Решта (EAA, NIS2, DSA, AI Code of Practice)** — соло-розробнику з <€2M можна не паритись.

---

## Джерела (brain-Claude перевірив у вересні-листопаді 2026)

- EU VAT OSS for SaaS 2026 — dodopayments.com
- EAA Exemptions — webyes.com
- NIS2 SaaS Compliance 2026 — outlex.ai
- DSA для SaaS — ypog.law
- ePrivacy 2026 — getmailbird.com
- EU-US AI transfers 2026 — notraced.com
- OpenAI DPA — openai.com/policies/data-processing-addendum
- Consumer Rights Directive — eur-lex.europa.eu
- Impressum legal guide — clym.io
- GPAI Code of Practice — digital-strategy.ec.europa.eu
- EU compliance 2026-2027 — nortal.com
- Cyber Resilience Act — digital-strategy.ec.europa.eu

---

## Історія документа

- **JMQuT 17.05.2026** — створено NM-Claude на запит Романа. Research brain-Claude передано у NM. AI Act compliance (Health Isolation) вже виконано як підмножина.
