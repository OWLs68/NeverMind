# /fullaudit — Незалежний глибокий аудит УСЬОГО застосунку

> **Що це:** протилежність `/audit`. `/audit` — легкий self-review свого diff тим самим
> агентом. `/fullaudit` — незалежний системний скан **усього коду** чужими агентами, де
> кожна знахідка проходить крізь окремих агентів-спростувачів. Мета — об'єктивна повна
> картина стану, не підтвердження власної роботи.
> **Створено:** 26yz5s 11.07.2026 (за проектом Романа). Оркестрація через `Workflow`.

**Коли:** перед великим релізом / стратегічним рішенням; коли Роман каже «глибокий аудит»,
«перевір усе», «повний аудит», «дивись по-справжньому широко»; періодично як здоров'я-чек.
**НЕ для:** дрібного diff (там `/audit`). **Аудит лише ЗНАХОДИТЬ — не фіксить** (фікси окремо `/fix`/`/byyou`).

---

## 🔑 Незалежність (головний принцип)

- **Find-агенти** отримують ТІЛЬКИ «просканувати вимір X по всьому коді» + Read/Grep. **Нуль
  контексту** «ми щойно зробили Y» — читають код свіжими очима. Не бачать одне одного.
- **Спростувачі** бачать ТІЛЬКИ одну знахідку (`file:line` + твердження) і завдання «доведи
  що це НЕ реально, перечитавши реальний код». Без автора, без решти знахідок, без рамки «наш
  агент знайшов» (щоб не було ухилу підтверджувати).
- **Спростувач ≠ тип find-агента.** Verify — завжди свіжий `general-purpose`, `effort: high`
  (не слабший за find). Find спеціалізованих вимірів — на наші read-only агенти.

## ⚖️ Поріг виживання — прив'язаний до severity (рішення Романа 11.07)

Кількість спростувачів залежить від ваги знахідки — не роздуваємо однаково дрібне:

| Severity | Спростувачів | Лінзи | Рішення |
|----------|:---:|-------|---------|
| **Critical / High** | 3 | A+B+C | `R≥2` → CONFIRMED · `R=1` (висока впевненість) → «непідтверджено, 2-й погляд» · інакше DISCARDED |
| **Medium** | 2 | B+C | `R=2` → CONFIRMED · `R=1` → «непідтверджено, 2-й погляд» · `R=0` → DISCARDED |
| **Low** | 1 | B | `R=1` → CONFIRMED-LOW · `R=0` → DISCARDED |
| **Cosmetic** | 0 | — | KEEP з явною міткою **`unverified-low`** (довіра find-агенту, чесно позначено — НЕ приховано) |

`R` = скільки спростувачів НЕ змогли спростувати (кажуть «real»). **3 лінзи:**
- **A — репро:** за реальних входів/стану це справді спрацьовує? конкретний сценарій або спростуй.
- **B — код-реальність:** перечитай точний `file:line` — описаний патерн взагалі існує? вже є guard поряд?
- **C — контекст/таймлайн:** є whitelist/міграція/guard в ІНШОМУ місці що знешкоджує? дані що це тригерять взагалі існують? (урок «структурно real, порожньо в даних»).

Урізаємо лише ВАГУ перевірки для дрібного — **покриття 100% незмінне**: усі 14 вимірів, увесь код.

## 📐 14 вимірів (кожен сканує ВВЕСЬ застосунок)

**Базові (8):** 1) правильність/логіка/race/edge · 2) безпека (injection/секрети/доступ до даних)
· 3) цілісність даних/схема (orphaned-звʼязки/дедуп/дрейф міграцій vs код) · 4) продуктивність
(N+1/необмежені цикли/важкі payload) · 5) мертвий код/дублі · 6) архітектурна консистентність
(дрейф патернів) · 7) тиха відмова (мовчазні catch/return) · 8) крос-модульні конфлікти.

**Свої 6 (з реальної історії багів NeverMind — `lessons.md`/`NEVERMIND_BUGS`):**
9) **Кирилиця-в-regex** — будь-який regex по укр.тексту (`\b`/межі/класи); сигнатурний клас, кусав 3+ рази.
10) **«Один мозок» — консистентність 8 чатів** (Inbox/Tasks/Notes/Me/Evening/Health/Finance/Projects):
tool/handler/rule діє в одному, в іншому ні; silent-fail делегації (handler не в `window` B-193,
не в `processUniversalAction` B-174, re-export без локального імені B-201).
11) **Escape/XSS-рендер** — `escapeHtml` vs `escapeJsArg` для `data-*`, `innerHTML` з юзер-даними,
`safeHref`, екранування лапок (3× у notes.js).
12) **Supabase-готовність** — `Date.now()` IDs vs UUID, прямий `setItem` vs канонічні сеттери
(Ворота 1), payload `nm-data-changed` {type,action,id} (Ворота 2), конверт `stampEntity` (Ворота 3).
13) **AI-шар tool↔prompt↔schema** — OpenAI Strict-схема тип vs UUID (B-172 тихий пропуск),
суперечності ~30 промптів, `save_*` routing guards, «детерміноване через код, не промпт» (правило 12).
14) **iOS PWA/SW** — `CACHE_NAME` свіжість, bfcache, `backdrop-filter`/`mask-image`/`transform`
composite, `viewport-fit`, rubber-band.

**Маршрутизація find-стадії** на наші read-only агенти (незалежні + заточені): 14→`ios-bug-hunter`,
13→`prompt-engineer-auditor`, 7→`silent-bug-scout`, 12→`supabase-migration-scout`, 5→`dry-violation-finder`.
Решта — `general-purpose`. Спростувачі — завжди свіжий `general-purpose`.

---

## 🚀 Виконання: викликати `Workflow` з цим скриптом

Голова (головна сесія) викликає `Workflow` наведеним скриптом. Скрипт детермінований:
`pipeline(вимір → find)` → всередині `parallel(N спростувачів за severity)`. Після завершення
Workflow **Голова синтезує фінальний звіт** (ранжування + таблиця + секція «що не перевірено») —
Workflow повертає класифіковані знахідки, людський звіт пише Голова.

```js
export const meta = {
  name: 'fullaudit',
  description: 'Незалежний глибокий аудит усього застосунку NeverMind — 14 вимірів, severity-прив\'язана верифікація спростуванням',
  phases: [
    { title: 'Find', detail: '14 вимірів, кожен сканує весь код свіжим агентом' },
    { title: 'Verify', detail: 'спростувачі за severity (3/2/1/0), 3 лінзи' },
  ],
}

// Виміри. agentType: '' → general-purpose. Спеціалізовані read-only агенти на свої класи.
const DIMENSIONS = [
  { key: 'correctness', title: 'Правильність/логіка', agent: '', prompt: 'Знайди реальні баги логіки, race conditions, необроблені edge cases у ВСЬОМУ src/. Не косметика — реальні поломки поведінки.' },
  { key: 'security', title: 'Безпека', agent: '', prompt: 'Знайди injection, витік секретів (ключ OpenAI у localStorage — нові шляхи), дірки доступу до даних, prompt-injection з юзер-контенту у system-позицію. Читай _ai-tools/review-rules/security.md як профіль загроз.' },
  { key: 'data-integrity', title: 'Цілісність даних/схема', agent: 'supabase-migration-scout', prompt: 'Знайди orphaned-звʼязки між сутностями, зламану дедуп-логіку, дрейф boot-міграцій vs реальний код/дані.' },
  { key: 'performance', title: 'Продуктивність', agent: '', prompt: 'Знайди N+1 читання localStorage у циклах, необмежені цикли, важкі payload у промптах/рендері, зайві повні ре-рендери.' },
  { key: 'dead-code', title: 'Мертвий код/дублі', agent: 'dry-violation-finder', prompt: 'Знайди невикористані функції/експорти, розбіжні копії тієї ж логіки у різних файлах, закоментовані блоки.' },
  { key: 'arch-consistency', title: 'Архітектурна консистентність', agent: '', prompt: 'Знайди дрейф патернів між модулями — де один модуль робить інакше ніж решта (get*/save*, dispatch, фабрики сутностей).' },
  { key: 'silent-failure', title: 'Тиха відмова', agent: 'silent-bug-scout', prompt: 'Знайди мовчазні catch{}/return, ковтання помилок, edge cases що тихо нічого не роблять (delegation handler не в window → silent skip).' },
  { key: 'cross-module', title: 'Крос-модульні конфлікти', agent: '', prompt: 'Знайди зони де різні частини системи торкаються без явної координації — спільний localStorage-ключ, спільна подія nm-data-changed, спільний стан без замка.' },
  { key: 'cyrillic-regex', title: 'Кирилиця-в-regex', agent: '', prompt: 'Знайди БУДЬ-ЯКИЙ regex що торкається українського тексту з ризиком: \\b перед/після кирилиці (не матчить у JS), класи що не покривають і/ї/є/ґ, межі слів. Сигнатурний клас багів — мертві guard\'и. Сканувати весь src/, не лише де сторож стереже.' },
  { key: 'one-brain', title: '«Один мозок» — 8 чатів', agent: '', prompt: 'Перевір консистентність 8 чатів (Inbox/Tasks/Notes/Me/Evening/Health/Finance/Projects): tool/handler/rule що діє в одному чаті але НЕ в іншому. + silent-fail делегації: handler не у window Object.assign (B-193), не у processUniversalAction (B-174), re-export `export {x} from` без локального import (B-201).' },
  { key: 'escape-xss', title: 'Escape/XSS-рендер', agent: '', prompt: 'Знайди escapeJsArg на data-* атрибутах (має бути escapeHtml — B-197), innerHTML з юзер-даними без escape, посилання без safeHref (javascript:/data:), неекрановані лапки що рвуть атрибут.' },
  { key: 'supabase-ready', title: 'Supabase-готовність', agent: 'supabase-migration-scout', prompt: 'Знайди дрейф фундаменту: Date.now() як ID замість generateUUID(), прямий localStorage.setItem замість канонічних сеттерів/фабрик (Ворота 1), сутність без конверта stampEntity (Ворота 3), нестандартний payload nm-data-changed (Ворота 2).' },
  { key: 'ai-layer', title: 'AI tool↔prompt↔schema', agent: 'prompt-engineer-auditor', prompt: 'Знайди розсинхрон: OpenAI Strict-схема тип (integer) vs UUID-string → тихий пропуск виклику (B-172); суперечності між ~30 системними промптами; save_* без code-side guard де мало б бути детерміновано (правило 12); tool-опис що конфліктує з промптом.' },
  { key: 'ios-pwa', title: 'iOS PWA/SW', agent: 'ios-bug-hunter', prompt: 'Знайди iOS/PWA ризики: CACHE_NAME логіка, bfcache, backdrop-filter/mask-image/transform composite-глюки, viewport-fit, rubber-band, стан що персистить між запусками і вішає boot.' },
]

const FINDINGS_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: { findings: { type: 'array', items: {
    type: 'object', additionalProperties: false,
    properties: {
      id: { type: 'string', description: 'напр. correctness-0' },
      file: { type: 'string' }, line: { type: 'integer' },
      severity: { type: 'string', enum: ['critical','high','medium','low','cosmetic'] },
      claim: { type: 'string', description: 'одне речення — що не так' },
      scenario: { type: 'string', description: 'вхід/стан → що ЛАМАЄТЬСЯ, конкретно не абстрактно' },
    }, required: ['id','file','line','severity','claim','scenario'],
  } } }, required: ['findings'],
}

const VERDICT_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    refuted: { type: 'boolean', description: 'true = я ДОВІВ що знахідка НЕ реальна (прямий контрдоказ у коді)' },
    confidence: { type: 'string', enum: ['low','medium','high'] },
    reason: { type: 'string', description: 'конкретний доказ з коду (file:line), не загальні слова' },
  }, required: ['refuted','confidence','reason'],
}

const LENSES = {
  A: 'ЛІНЗА РЕПРО: за реальних входів і стану застосунку ця знахідка справді спрацьовує? Дай конкретний сценарій відтворення АБО доведи що шлях недосяжний.',
  B: 'ЛІНЗА КОД-РЕАЛЬНІСТЬ: відкрий точний file:line і перечитай. Описаний патерн там ВЗАГАЛІ існує? Чи вже є guard/escape/перевірка поряд що це знешкоджує?',
  C: 'ЛІНЗА КОНТЕКСТ/ТАЙМЛАЙН: є whitelist/міграція/guard/детектор в ІНШОМУ місці коду що нейтралізує це? Чи існують взагалі дані/шлях що це тригерять (структурно real ≠ реально досяжно)?',
}

// Стеля агентів — тестовий прогін (рішення Романа 11.07: подивитись реальну
// витрату токенів ПЕРЕД тим як зафіксувати число назавжди). Змінити тут.
const AGENT_CAP = 100
const SEV_RANK = { critical: 0, high: 1, medium: 2, low: 3, cosmetic: 4 }
// Базова квота спростувачів за severity (лінзи). cosmetic=0 → unverified-low (свідомо).
function refuterLenses(sev) {
  if (sev === 'critical' || sev === 'high') return ['A','B','C']
  if (sev === 'medium') return ['B','C']
  if (sev === 'low') return ['B']
  return [] // cosmetic → без верифікації (unverified-low)
}

function classify(sev, cantRefuteVerdicts, total) {
  const R = cantRefuteVerdicts.length
  if (sev === 'critical' || sev === 'high') {
    if (R >= 2) return 'confirmed'
    if (R === 1 && cantRefuteVerdicts[0].confidence === 'high') return 'unconfirmed'
    return 'discarded'
  }
  if (sev === 'medium') {
    if (R === 2) return 'confirmed'
    if (R === 1) return 'unconfirmed'
    return 'discarded'
  }
  // low
  return R === 1 ? 'confirmed-low' : 'discarded'
}

const FIND_PREAMBLE = 'Ти незалежний аудитор коду NeverMind (PWA, ванільний JS, localStorage, ~/home/user/NeverMind). У тебе НЕМАЄ контексту про недавні зміни — читай реальний код свіжими очима через Read/Grep. 🚫 СУВОРА ЗАБОРОНА: Edit/Write/git/будь-які зміни — тільки читання. Кожна знахідка ОБОВʼЯЗКОВО: точний file:line + конкретний сценарій відмови (вхід/стан → що ламається), НЕ абстракція. Severity чесно: critical=зламана функція/витік даних, high=серйозний баг з реальним шляхом, medium=баг з обхідним шляхом/рідкісний, low=дрібне, cosmetic=косметика. Порожній масив findings — валідна відповідь якщо чисто. Вимір: '

const REFUTE_PREAMBLE = 'Ти незалежний спростувач у аудиті коду NeverMind (~/home/user/NeverMind). Тобі дано ОДНУ знахідку. Твоя задача — НЕ підтвердити, а СПРОСТУВАТИ: довести прямим контрдоказом у реальному коді що вона НЕ реальна. Читай код через Read/Grep. 🚫 тільки читання, жодних змін. Правило асиметрії: «не можу перевірити» ≠ «неправда» — refuted=true ТІЛЬКИ за прямим контрдоказом у коді. Якщо контрдоказу нема — refuted=false (знахідка виживає). '

// === ФАЗА 1 — FIND (бар'єр: усі 14 вимірів паралельно, потім план верифікації) ===
// Бар'єр потрібен бо стеля агентів глобальна: щоб розподілити залишок верифікації
// за severity ПО ВСIХ вимірах разом, треба спершу зібрати ВСI знахідки.
phase('Find')
log(`🔍 /fullaudit (тестовий прогін, стеля ${AGENT_CAP} агентів): 14 find + верифікація в залишку.`)

const finds = await parallel(DIMENSIONS.map((d) => () =>
  agent(FIND_PREAMBLE + d.prompt, {
    label: `find:${d.key}`, phase: 'Find', effort: 'high',
    agentType: d.agent || undefined, schema: FINDINGS_SCHEMA,
  }).then((r) => ({ d, findings: (r && r.findings) || [] }))
))

// Плаский список знахідок з прив'язкою до виміру.
const all = []
for (const r of finds.filter(Boolean)) {
  for (const f of r.findings) all.push({ ...f, dimension: r.d.key })
}
log(`📋 Find завершено: ${all.length} знахідок по ${DIMENSIONS.length} вимірах.`)

// === РОЗПОДІЛ ВЕРИФІКАЦІЇ В МЕЖАХ СТЕЛІ ===
// Find уже спожив DIMENSIONS.length агентів (непорушний мінімум). Залишок — на verify.
// Йдемо згори вниз за severity (critical→cosmetic): фінансуємо повну квоту поки вистачає
// бюджету. Не влазить повна квота — ріжемо ЦЮ знахідку у 0 (мітка cap-cut) і всі нижчі
// за нею (вони ще нижчої критичності). cosmetic завжди 0 → unverified-low (свідомо, не cap).
let verifyBudget = AGENT_CAP - DIMENSIONS.length
const sorted = [...all].sort((a, b) => (SEV_RANK[a.severity] ?? 9) - (SEV_RANK[b.severity] ?? 9))
let capCut = 0
let exhausted = false // строгий пріоритет: щойно бюджет не вмістив знахідку — весь ХВIСТ
                       // (усе нижче за severity) теж cap-cut. Інакше пізніша дешева low
                       // профінансувалась би поки вища medium лишилась обрізаною.
const plan = sorted.map((f) => {
  const lenses = refuterLenses(f.severity)
  if (lenses.length === 0) return { f, lenses: [], mark: 'unverified-low' } // cosmetic — свідомо
  if (!exhausted && verifyBudget >= lenses.length) {
    verifyBudget -= lenses.length
    return { f, lenses, mark: null }
  }
  exhausted = true
  capCut++
  return { f, lenses: [], mark: 'cap-cut' } // стеля — недоверифіковано, чесно позначено
})
if (capCut > 0) log(`⚠️ Стеля ${AGENT_CAP}: ${capCut} знахідок (найнижчої критичності) лишились НЕДОВЕРИФІКОВАНІ — буде окремим рядком у звіті.`)

// === ФАЗА 2 — VERIFY (спростувачі за планом, паралельно) ===
phase('Verify')
const audited = await parallel(plan.map((p) => () => {
  if (p.lenses.length === 0) {
    // Без верифікації: cosmetic (свідомо) або cap-cut (через стелю) — обидва чесно позначені.
    return Promise.resolve({ ...p.f, status: p.mark, R: 0, verdicts: [], capCut: p.mark === 'cap-cut' })
  }
  const finding = `Знахідка [${p.f.id}] severity=${p.f.severity}\nФайл: ${p.f.file}:${p.f.line}\nТвердження: ${p.f.claim}\nСценарій: ${p.f.scenario}`
  return parallel(p.lenses.map((L) => () =>
    agent(`${REFUTE_PREAMBLE}\n\n${finding}\n\n${LENSES[L]}`, {
      label: `verify:${p.f.id}:${L}`, phase: 'Verify', effort: 'high', schema: VERDICT_SCHEMA,
    })
  )).then((verdicts) => {
    const valid = verdicts.filter(Boolean)
    const cantRefute = valid.filter((v) => !v.refuted)
    return { ...p.f, status: classify(p.f.severity, cantRefute, p.lenses.length), R: cantRefute.length, verdicts: valid, capCut: false }
  })
}))

const flat = audited.filter(Boolean)
const spent = DIMENSIONS.length + plan.reduce((s, p) => s + p.lenses.length, 0)
log(`✅ Готово: ${flat.length} знахідок, ~${spent} агентів (стеля ${AGENT_CAP}). Недоверифіковано через стелю: ${capCut}.`)
return { findings: flat, dimensions: DIMENSIONS.map((d) => d.key), agentsSpent: spent, agentCap: AGENT_CAP, capCut }
```

---

## 📋 Фінальний звіт (Голова синтезує ПІСЛЯ Workflow)

Workflow повертає `{findings, dimensions, agentsSpent, agentCap, capCut}`. Кожна знахідка має
`status` (`confirmed`/`confirmed-low`/`unconfirmed`/`unverified-low`/`cap-cut`/`discarded`) +
`capCut` (bool). Голова:

1. **Знахідки ранжовані за критичністю** (`confirmed` critical→high→medium→low, потім `confirmed-low`,
   потім `unverified-low`/`cap-cut`). Кожна: `file:line` + severity + **конкретний сценарій відмови**. `discarded` — НЕ показувати (тільки в лічильнику таблиці).
2. **Окрема секція «⚠️ Непідтверджено — вартує другого погляду»** — усі `status:unconfirmed` (рівно 1 спростувач не зміг, висока впевненість). Не викидати мовчки.
3. **Секція «🔵 Неверифіковане дрібне (`unverified-low`)»** — cosmetic без верифікації, чесно позначені (довіра find-агенту).
4. **🚦 ОБОВʼЯЗКОВИЙ РЯДОК про стелю (якщо `capCut > 0`):** «⚠️ N знахідок не доверифіковано через
   стелю агентів (${agentCap})» + перелік цих знахідок (`status:cap-cut`) окремо. **Ховати заборонено** —
   якщо стеля щось обрізала, це видно у звіті явним рядком. Плюс завжди: «Витрачено ~agentsSpent з agentCap агентів» (це і є замір для тестового прогону).
5. **Підсумкова таблиця:** вимір → знайдено / підтверджено / непідтверджено / спростовано / неверифіковано / cap-cut.
6. **Обов'язкова секція «🚧 Що НЕ перевірено цього разу»** — недосяжне з хмари: реальні значення
   localStorage юзера, жива поведінка OpenAI на проді, справжній рендер/тач на iPhone, реальні
   обсяги usage; + будь-який вимір що find-агент сам позначив неповним. **Мовчазне «все чисто»
   без цієї секції — заборонено.**
7. **Аудит лише ЗНАХОДИТЬ.** Голова НЕ робить Edit. Фікси — окремо через `/fix` (по одному)
   або `/byyou` (пакетом), кожен верифікований проти коду перед зміною.

> **Тестовий прогін (11.07):** стеля `AGENT_CAP=100` — щоб побачити реальну витрату токенів
> ПЕРЕД тим як зафіксувати число назавжди. Після прогону — глянути `agentsSpent` і токен-звіт
> Workflow, тоді вирішити фінальну стелю. `AGENT_CAP` — одна константа у скрипті.

## Анти-патерни
- ❌ Голова передає find/verify-агентам контекст «ми щойно зробили X» — вбиває незалежність.
- ❌ Verify слабший за find (`effort` нижчий) — спростування має бути щонайменше таким же сильним.
- ❌ Тихо викинути `R=1` високої впевненості — має піти у «непідтверджено».
- ❌ Фіксити під час аудиту — аудит тільки знаходить.
- ❌ Звіт без секції «що не перевірено».
