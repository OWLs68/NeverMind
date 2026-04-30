# OWL Silence Engine + Pruning Engine — Архітектурний план

> **Створено:** 26.04.2026 (сесія UVKL1) після **2 раундів консультації з Gemini 3 Pro**.
>
> **Мета:** системно (для всіх 8 типів даних і всіх 4 каналів сови) розв'язати дві пов'язані проблеми:
> 1. Stale board — сова повторює «закрий молоко, банан, хліб» попри що юзер уже закрив (B-104 повертається).
> 2. Юзер не має структурного важеля «дай спокій» — лише промптові маркери у `getOWLPersonality` ПРАВИЛО ЕМПАТІЇ, які GPT-4o-mini ігнорує.
>
> **Принцип:** не покладатися на промптові інструкції типу «НЕ нагадуй» (модель їх ігнорує) — а **не давати моделі шансу** через структурне відсікання даних на клієнті.
>
> **Статус:** план готовий, чекає виконання. Стартує з Фази 1.

---

## TL;DR — що буде

**3 фази, ~5 годин сумарно** (можна розбити на 2-3 сесії).

| Фаза | Що робить | Час | Видимий ефект |
|------|-----------|-----|---------------|
| **1. Silence Engine** | Tool `request_quiet(hours)` → пише у `nm_owl_silence_until`. Чек тиші у `shouldOwlSpeak()` блокує всі 4 канали сови одразу. | ~1.5 год | Юзер пише «дай спокій до вечора» → 8 вкладок + Inbox-табло + Brain Pulse мовчать до вказаного часу. У чаті можна питати — сова відповідає, не пропонує нового. |
| **2. Pruning Engine** | Сова при генерації заповнює `entityRefs:[task_123,event_456]` у JSON-схемі (вже є `response_format: json_object`). `isEntityRelevant(ref)` фільтр на клієнті викидає повідомлення про вже-неактивні сутності. Wipe старої історії при rollout. | ~3 год | Юзер тапає ✓ на задачі → старі повідомлення на таблі про неї зникають миттєво (через `nm-data-changed`). Сова навіть не «пам'ятає» що казала про молоко. |
| **3. Розділення Контексту** | У `getAIContext` (для чатів) при активній тиші додається прапорець «не пропонуй нового». Блок `[ФАКТ] Нещодавно ЗАКРИТІ` лишається у чат-контексті, **видаляється з табло-контексту** (`getTabBoardContext`). | ~30 хв | Юзер під час тиші питає «що я зробив?» — сова відповідає конкретно. Але не нав'язує нових дій. |

**Ключовий принцип:** не просити модель «не нагадуй» (вона ігнорує), а **видалити з контексту і історії** все що стосується закритого/архівного. Модель не може процитувати чого не бачить.

---

## Контекст і коріння проблеми

### Що Роман сказав (UVKL1 26.04)

> «Я не бачу щоб агент діставав мене в чаті адже він рідко майже не пише першим в чат. А в табло коли продовжує писати. Я закрию задачі а він в табло про це не знає і далі мене зайобує шо я то і то не зробив».
>
> «Я хочу бачити чітку систему де сова знатиме які завдання я вже виконав і не треба їх згадувати, і які ще не виконав і варто згадати. Сова має розуміти коли прошу не зайобувати з завданнями або звичками. Механізм за допомогою якого сова бачить актуальні або архівні звички та завдання треба продумати якісніше. Адже це стосується і нотаток і подій і інших вкладок».

### Чому R5Ejr-фікс (24.04) недостатній

R5Ejr закрив **B-104** через 2 кроки:
1. Додав `completedAt` у 4 точках де `status='done'` ставилось без часу.
2. Додав блок `[ФАКТ] Нещодавно ЗАКРИТІ задачі (НЕ нагадуй про них, НЕ повторюй з boardHistory)` у `getAIContext()` і `getTabBoardContext('tasks')`.

**Проблема:** GPT-4o-mini маленька модель — **ігнорує негативні правила** («НЕ роби X» → робить X). `boardHistory` (останні 20 повідомлень сови) показується моделі як її власна «пам'ять» — і модель інерційно цитує своє ж старе «закрий молоко».

### Чому архітектура потрібна, а не точкові патчі

Проблема **не точкова** для табла Задач. Те саме стосується:
- **Звичок** — закрив звичку «не їсти м'ясо», а сова в табло Я нагадує про неї.
- **Подій** — пройшла зустріч, а сова продовжує писати «не забудь».
- **Нотаток** — нотатку видалив, а сова згадує.
- **Активного чату** — юзер пише «дай спокій», сова продовжує тиснути на іншій вкладці через 10 хв (Brain Pulse).

**Системного механізму «що ще актуальне для сови» зараз нема.** Тільки `status: 'active'` vs `'done'` і прохальні промпт-правила.

---

## Архітектура (підсумок 2 раундів Gemini)

**Раунд 1 Gemini** (відповідь на питання про архітектуру):
- Запропонував `nm_owl_state` (новий ключ з TTL+mutedTabs+reason), tool `set_owl_mode`, `entityRefs` у повідомленнях, видалити `recentlyDone` з обох контекстів, **похвалу через Brain Pulse 10 хв cycle**.
- Конкретні приклади коду + сумісність з Supabase.

**Зауваження Claude (Раунд 2)** на основі реального коду:
1. `response_format: json_object` **уже використовується** у `generateBoardMessage` (рядок 781). Питання Regex vs JSON відпало.
2. `set_owl_mode` як tool name **зайнятий** — це перемикання Coach/Partner/Mentor. Треба інше ім'я (`request_quiet`) або розширити (Gemini обрав окремий tool — окей).
3. `nm_owl_silence_until` **уже існує** (auto-silence коли 7 повідомлень проігноровано). Об'єднати — записувати туди explicit-silence теж.
4. `shouldOwlSpeak()` уже централізований Judge Layer — туди додати чек тиші **одним рядком**, не дублювати guards.
5. `setOwlCd('praised_${id}')` краще за `praised: true` прапорець у задачі (не забруднює структуру даних).
6. `getAIContext` подається у **чати** — там «нещодавно закриті» **потрібні** (юзер питає «що я зробив»). Видаляємо лише з **табло-контексту**.
7. Похвала через Brain Pulse 10 хв = пізно, дратує не менше → **скасуємо взагалі** (Роман просив «не зайобувати», не «краще хвалити»).

**Раунд 2 Gemini — фінальні рішення:**
- Окремий tool `request_quiet`, об'єднання у `nm_owl_silence_until`, чек у `shouldOwlSpeak`.
- Похвала **скасована** (Варіант C — Gemini підтвердив: «Роман просив 'не зайобувати', а не 'краще хвалити'»).
- Wipe історії табла при rollout.
- Фільтр-валідатор `isEntityRelevant(ref)` з per-type правилами (для перенесених задач).
- Прапорець «ЮЗЕР ПОПРОСИВ ТИШІ» у системному промпті чатів під час silence — щоб сова відповідала на питання, але не нав'язувала наступного.

---

## Фаза 1 — Silence Engine (~1.5 год) ✅ ВИКОНАНО (C8uQD 27.04 + xHQfi 30.04)

**Статус (30.04 xHQfi):** базова Фаза 1 закрита у C8uQD 27.04 (`request_quiet` tool + handler + silence-чек у `shouldOwlSpeak` + тригер-фрази у `UI_TOOLS_RULES`). У xHQfi 30.04 додано:
- **Tool `cancel_quiet`** — голосова команда «можеш говорити / повертайся / досить мовчати» стирає `nm_owl_silence_until`. Закриває gap «юзер передумав, не може скасувати достроково».
- **UI-плашка `.owl-silence-badge`** зверху board (8 вкладок + Inbox) — «🤫 Сова мовчить до HH:MM. Тапни щоб скасувати». Тап миттєво стирає тишу + перерендерить усі активні табло через `nm-data-changed` listener.
- Коміти xHQfi: `44bf7fe` (cancel_quiet tool), `da057ae` (UI badge + перерендер).

**Мета:** структурний важіль для юзера «дай спокій на N годин» через AI tool. Усі 4 канали сови читають один і той самий ключ `nm_owl_silence_until` через централізований Judge Layer — guard clause не дублюється у кожному модулі.

### Файли і зміни

**1. `src/ai/ui-tools.js` — додати новий tool `request_quiet`**

```javascript
{
  type: "function",
  function: {
    name: "request_quiet",
    description: "Вмикає режим тиші, якщо юзер просить не турбувати, дати спокій, відчепитися, не зайобувати, помовчати. Сова мовчить вказану кількість годин — у табло, brain pulse, проактивних повідомленнях. Чат лишається доступним для прямих питань.",
    parameters: {
      type: "object",
      properties: {
        duration_hours: { type: "number", description: "Тривалість тиші у годинах (1-24). За замовчуванням 4." }
      },
      required: ["duration_hours"]
    }
  }
}
```

**2. `src/ai/ui-tools.js` — обробник у `handleUITool` switch:**

```javascript
case 'request_quiet': {
  const hours = Math.max(1, Math.min(24, args.duration_hours || 4));
  const expiresAt = Date.now() + hours * 3600000;
  localStorage.setItem('nm_owl_silence_until', String(expiresAt));
  window.dispatchEvent(new CustomEvent('nm-data-changed', { detail: 'silence' }));
  const endTime = new Date(expiresAt).toLocaleTimeString('uk-UA', {hour:'2-digit', minute:'2-digit'});
  return { text: `🤫 Зрозуміла. Мовчу до ${endTime}. У чаті можеш питати — відповім.` };
}
```

**3. `src/owl/inbox-board.js` — додати чек тиші у `shouldOwlSpeak()` (ОДИН рядок):**

```javascript
export function shouldOwlSpeak(trigger, opts = {}) {
  // === НОВИЙ ЧЕК (Фаза 1 UVKL1) ===
  const silenceUntil = parseInt(localStorage.getItem('nm_owl_silence_until') || '0');
  if (Date.now() < silenceUntil) return { speak: false, reason: 'explicit_silence' };
  // === далі існуюча логіка (silent-phase, activeChatBar, cooldowns) ===
  ...
}
```

**4. Додати `request_quiet` до `UI_TOOL_NAMES`** (Set назв UI-tools у тому ж файлі) — щоб dispatcher маршрутизував через `handleUITool`.

**5. `src/ai/prompts.js` — додати у `UI_TOOLS_RULES`:**

```
- "дай спокій", "не доставай", "відчепись", "не зайобуй", "помовчи", "відчепись на годину" → ЗАВЖДИ request_quiet(duration_hours).
  За замовчуванням 4 години якщо юзер не вказав час. "до вечора" = різниця до 22:00.
  "на годинку" = 1, "на пів дня" = 6, "до завтра" = різниця до завтрашнього 08:00.
```

### Видимий ефект

- Юзер пише у будь-якому чаті: «дай спокій до вечора» → сова: «🤫 Зрозуміла. Мовчу до 22:00.»
- Через 1 хвилину Brain Pulse тригериться → `shouldOwlSpeak()` повертає `{speak:false, reason:'explicit_silence'}` → проактивних повідомлень нема.
- Табло Задач/Я/Фінансів/тощо — нові повідомлення не генеруються до 22:00.
- Юзер відкриває чат Задач, пише «що я закрив сьогодні?» → сова відповідає (чат не блокується silence).

### Чому це не ламає нічого

- `nm_owl_silence_until` уже існує (рядки 815-833 у `proactive.js`) для auto-silence — там логіка авто-встановлення на 2 год коли 7 повідомлень підряд проігноровано.
- Авто-механізм продовжує працювати — просто тепер у той самий ключ можна писати і вручну (через tool).
- Існуючий `_judgeBoard` у `proactive.js:614` уже викликає `shouldOwlSpeak('phase-pulse')` — буде блокуватись новим чеком.
- Brain Pulse у `brain-pulse.js:38` уже викликає `shouldOwlSpeak('brain-pulse')` — теж буде блокуватись.

---

## Фаза 2 — Pruning Engine (~3 год)

**Мета:** старі повідомлення сови про вже-закриті/видалені/перенесені сутності зникають з табла **миттєво** при `nm-data-changed`. Сова при наступній генерації не бачить їх у `boardHistory` — не може процитувати.

### Файли і зміни

**1. `src/owl/proactive.js` — оновити промпт у `generateBoardMessage`** (рядки ~715-760):

Додати у JSON-схему відповіді поле `entityRefs`:

```javascript
const promptAddon = `
Схема відповіді JSON: { text, topic, priority, chips, entityRefs: ["task_123","event_456","habit_42"] }

ПОЛЕ entityRefs (важливо):
- Якщо твоє повідомлення посилається на конкретні задачі/звички/події/нотатки/проекти — обов'язково перерахуй їхні ID у форматі "<тип>_<id>".
- Типи: task, habit, event, note, project, transaction, healthcard.
- Якщо повідомлення загальне ("Гарного дня!", "Що далі?") — entityRefs: [].
- Беремо ID з контексту "Активні задачі" / "Звички сьогодні" / "Найближчі події" вище.
`;
```

**2. `src/owl/board-utils.js` — НОВИЙ ФАЙЛ або секція в `proactive.js` — функція-валідатор:**

```javascript
import { getTasks } from '../tabs/tasks.js';
import { getHabits, getHabitLog } from '../tabs/habits.js';
import { getEvents } from '../tabs/calendar.js';
import { getNotes } from '../tabs/notes.js';
import { getProjects } from '../tabs/projects.js';

const todayStr = () => new Date().toISOString().slice(0, 10);

export function isEntityRelevant(ref) {
  if (typeof ref !== 'string') return false;
  const idx = ref.indexOf('_');
  if (idx < 0) return false;
  const type = ref.slice(0, idx);
  const id = parseInt(ref.slice(idx + 1));
  if (!id) return false;

  if (type === 'task') {
    const t = getTasks().find(x => x.id === id);
    return !!(t && t.status === 'active' && (!t.dueDate || t.dueDate >= todayStr()));
  }
  if (type === 'habit') {
    const h = getHabits().find(x => x.id === id);
    if (!h) return false;
    const today = new Date().toDateString();
    const done = !!getHabitLog()[today]?.[id];
    return !done; // нерелевантна якщо вже виконана сьогодні
  }
  if (type === 'event') {
    const e = getEvents().find(x => x.id === id);
    if (!e) return false; // видалена
    const dt = e.time ? new Date(`${e.date}T${e.time}`).getTime() : new Date(`${e.date}T23:59`).getTime();
    return dt >= Date.now(); // не пройшла
  }
  if (type === 'note') return getNotes().some(x => x.id === id);
  if (type === 'project') {
    const p = getProjects().find(x => x.id === id);
    return !!(p && p.status === 'active' && (p.progress || 0) < 100);
  }
  return true; // невідомий тип — не блокуємо
}
```

**3. `src/owl/proactive.js` — фільтр перед поданням `boardHistory` у промпт** (рядки ~659-664):

```javascript
import { isEntityRelevant } from './board-utils.js';

// БУЛО: const boardHistory = allMsgs.slice(0, 20).map(...)
// СТАЄ: фільтр перед map
const filteredMsgs = allMsgs.filter(m => {
  if (!m.entityRefs || m.entityRefs.length === 0) return true; // загальне повідомлення — лишаємо
  return m.entityRefs.some(isEntityRelevant); // хоч одна сутність актуальна — лишаємо
});
const boardHistory = filteredMsgs.slice(0, 20).map(m => { /* як раніше */ });
```

**4. `src/owl/board.js` — фільтр для UI** — `getTabBoardMsgs(tab)` фільтрує повідомлення які стали неактуальними. Тоді при rerender (на `nm-data-changed`) старе зникне.

```javascript
import { isEntityRelevant } from './board-utils.js';

export function getTabBoardMsgs(tab) {
  const msgs = getTabMessages(tab);
  return msgs.filter(m => {
    if (!m.entityRefs || m.entityRefs.length === 0) return true;
    return m.entityRefs.some(isEntityRelevant);
  });
}
```

**5. `src/owl/proactive.js` — зберігати `entityRefs` у новому повідомленні** (рядок ~840):

```javascript
const newMsg = {
  text: parsed.text,
  topic: topicFinal,
  priority: parsed.priority || 'normal',
  chips: parsed.chips || [],
  entityRefs: Array.isArray(parsed.entityRefs) ? parsed.entityRefs : [], // НОВЕ
  ts: Date.now()
};
```

**6. `src/core/boot.js` — одноразовий wipe історії при першому запуску нової версії:**

```javascript
// Wipe boardHistory cache — старі повідомлення без entityRefs не fit нову модель
const WIPE_FLAG = 'nm_pruning_wipe_v1_done';
if (!localStorage.getItem(WIPE_FLAG)) {
  localStorage.removeItem('nm_owl_unified');     // tab boards
  localStorage.removeItem('nm_owl_board');       // inbox board (perevirити точну назву)
  localStorage.setItem(WIPE_FLAG, '1');
  console.log('[boot] OWL board history wiped for Pruning Engine v1');
}
```

### Видимий ефект

- Юзер тапає ✓ на задачі «Купити молоко» → `saveTasks` → `nm-data-changed` → UI rerender → `getTabBoardMsgs` фільтрує → повідомлення «Не забудь молоко» (з `entityRefs: ['task_888']`) **зникає з табла за секунду**.
- Сова через 5-10 хв генерує нове повідомлення → у `boardHistory` старого «Не забудь молоко» **немає** (відфільтровано) → не цитує себе.
- Видалена подія / виконана звичка / завершений проект — те саме.

---

## Фаза 3 — Розділення Контексту (~30 хв)

**Мета:** під час тиші (Фаза 1) чат лишається доступний — юзер питає, сова відповідає. **Але** сова **не нав'язує наступних дій**. Плюс блок «Нещодавно ЗАКРИТІ» лишається у чат-контексті але прибирається з табло-контексту (щоб не провокувати галюцинації).

### Файли і зміни

**1. `src/ai/core.js` — `getAIContext()` (~рядок 200):**

```javascript
// === Прапорець тиші (Фаза 3 UVKL1) ===
const silenceUntil = parseInt(localStorage.getItem('nm_owl_silence_until') || '0');
if (Date.now() < silenceUntil) {
  const endTime = new Date(silenceUntil).toLocaleTimeString('uk-UA', {hour:'2-digit', minute:'2-digit'});
  parts.push(`[ВАЖЛИВО — ТИША] Юзер попросив не турбувати до ${endTime}. Відповідай прямо на ПИТАННЯ юзера, але НЕ пропонуй нових задач, нагадувань, дій. Не питай "що далі". Якщо юзер запитав про факти ("що я зробив?") — відповідай конкретно. Якщо юзер просто щось коментує — підтверди коротко без пропозицій.`);
}
```

Блок `[ФАКТ] Нещодавно ЗАКРИТІ задачі` (рядок 95) **ЗАЛИШАЄТЬСЯ** — потрібен у чатах для відповідей «що я закрив».

**2. `src/owl/proactive.js` — `getTabBoardContext()` (~рядки 41-45):**

```javascript
// БУЛО:
const recentlyDone = tasks.filter(t => t.status === 'done' && ...).slice(0, 5);
if (recentlyDone.length > 0) {
  parts.push(`[ФАКТ] Нещодавно ЗАКРИТІ задачі (вже виконані, НЕ нагадуй про них, НЕ повторюй зі свого boardHistory): ...`);
}

// СТАЄ: повністю видалити цей блок з getTabBoardContext.
// Pruning Engine (Фаза 2) вже забезпечує що сова не бачить старих повідомлень про закриті задачі.
// Промптові правила «НЕ нагадуй» — не потрібні, модель просто не знає назв.
```

### Видимий ефект

- Юзер під час тиші у чаті Задач: «що я зробив сьогодні?» → сова: «Закрив 3 задачі: Купити молоко, Зустріч з Андрієм, Лист клієнту.» **БЕЗ** «А тепер давай зробимо X».
- Юзер у звичайному режимі (без тиші): «що далі?» → сова пропонує наступну дію (без змін поведінки).

---

## Перевірка — 3 реальні сценарії

### Сценарій 1 — Закрив 3 задачі за 10 секунд (14:00)

| Час | Що бачить юзер на таблі Задач |
|-----|------------------------------|
| 14:00:00 | «Не забудь молоко, банан, хліб» (старе повідомлення сови) |
| 14:00:05 | Тапнув ✓ на «Купити молоко». `nm-data-changed` → `getTabBoardMsgs` фільтр. Повідомлення містить `entityRefs:['task_888','task_889','task_890']` — `task_888` стало неактуальним, але `task_889/890` ще активні → лишається. |
| 14:00:10 | Тапнув ✓ на «Купити банан». Тепер тільки `task_890` активне → лишається. |
| 14:00:15 | Тапнув ✓ на «Купити хліб». Усі 3 entityRefs неактуальні → повідомлення **зникає з табла**. |
| 14:00:30 | Через 30 секунд — табло порожнє (або fallback «Все по плану»). |
| 14:05:00 | Brain Pulse тригериться → нова генерація → у `boardHistory` старого «Не забудь молоко» нема (відфільтровано) → сова **не цитує** його. |
| 14:30:00 / 15:00:00 | Тиші ще нема — сова може згенерувати нове проактивне на іншу тему (стрік звички, наступна задача). Без згадки про молоко/банан/хліб. |

### Сценарій 2 — Юзер пише «дай спокій до вечора» о 16:00

1. **16:00:00** — Юзер у чаті Задач: «дай спокій до вечора».
2. Модель розпізнає → tool `request_quiet(duration_hours: 6)` (різниця до 22:00).
3. `nm_owl_silence_until` = 16:00 + 6 год = 22:00.
4. Чат-відповідь сови: «🤫 Зрозуміла. Мовчу до 22:00. У чаті можеш питати — відповім.»
5. `nm-data-changed` → переходи на інші вкладки → `_judgeBoard` спрацьовує → `shouldOwlSpeak()` повертає `{speak:false, reason:'explicit_silence'}` → нових повідомлень на табло нема.
6. **16:10** — Brain Pulse тригериться (10 хв cycle). У `brainPulse()` перший рядок — `shouldOwlSpeak('brain-pulse')` → `{speak:false, reason:'explicit_silence'}` → проактивних повідомлень нема.
7. **17:00** Юзер відкриває Inbox → старі табло-повідомлення лишаються (Pruning не чіпає) → нових нема → тиша.
8. **22:00:01** — `Date.now() >= silenceUntil` → наступний тригер `shouldOwlSpeak()` повертає звичайне `{speak:true}` → сова повертається до проактивних повідомлень.

### Сценарій 3 — Питання «що я зробив» під час тиші о 18:00

1. **18:00** Тиша ще активна (до 22:00). Юзер у чаті Задач: «що я сьогодні зробив?».
2. Чат **НЕ блокується** silence (це прямий запит юзера, не проактивна ініціатива). `sendTaskBarMessage` запускає `callAIWithTools`.
3. `getAIContext()` збирає контекст:
   - Активні задачі (з ID).
   - Блок `[ФАКТ] Нещодавно ЗАКРИТІ задачі` — **залишається** у Фазі 3 (видалили лише з табло-контексту).
   - **НОВИЙ** блок `[ВАЖЛИВО — ТИША] Юзер попросив не турбувати до 22:00. Відповідай прямо на ПИТАННЯ, не пропонуй нових задач».
4. Модель отримує контекст → відповідає: «Закрив 3 задачі: Купити молоко, Зустріч з Андрієм, Лист клієнту. Гарного вечора! 🌙».
5. **БЕЗ** «А тепер зроби X» / «Не забудь Y» / «Що далі?». Бо у промпті прапорець тиші явно забороняє.

---

## Що відкинули (і чому)

### ❌ Промптові інструкції «НЕ нагадуй про закриті»

**Чому відкинули:** GPT-4o-mini ігнорує негативні правила. R5Ejr фікс це довів — `[ФАКТ] Нещодавно ЗАКРИТІ ... НЕ повторюй зі свого boardHistory` не спрацьовує бо модель інерційно цитує себе. Системне рішення — забрати дані з контексту, не просити.

### ❌ Сильніше формулювання промпту («ЦІ ВЖЕ ЗАКРИТО. Юзер ЗЛИТЬСЯ якщо ти повториш»)

**Чому відкинули:** Роман прямо сказав: «Не промтом пояснювати що разу а автоматизувати все кодом щоб працювало стабільно». Промптові посилення = неекономно по токенах + ненадійно на маленькій моделі.

### ❌ Видалити `[ФАКТ] Нещодавно ЗАКРИТІ` з `getAIContext` (для чатів)

**Чому відкинули (Раунд 2 Gemini):** `getAIContext` подається у промпти **8 чатів**. У чаті юзер може спитати «скільки я закрив?» / «що зробив сьогодні?» — модель має знати. Видаляємо лише з табло-контексту (`getTabBoardContext`).

### ❌ Похвала за закриті задачі через Brain Pulse 10 хв cycle

**Чому відкинули (Раунд 2 Gemini, Варіант C):** Роман просив «не зайобувати», не «краще хвалити». Похвала через 10 хв = юзер забув що закрив = нерелевантно. Додаткова генерація = ризик галюцинації + витрати API. Якщо буде потрібна — окремий план «Real-time Praise Engine».

### ❌ `set_owl_mode` як новий tool для тиші

**Чому відкинули:** ім'я зайняте (це перемикання Coach/Partner/Mentor). Окремий tool `request_quiet` — концептуально чистіше (характер ≠ тиша).

### ❌ Складна структура `nm_owl_state` з `mode/mutedTabs/reason`

**Чому відкинули (Раунд 2 Gemini):** `nm_owl_silence_until` уже існує (auto-silence). Достатньо одного timestamp ключа. Складна структура — over-engineering без потреби.

### ❌ Regex `[ID:xxx]` парсинг тексту відповіді сови

**Чому відкинули (Раунд 2 Gemini):** `response_format: { type: "json_object" }` уже використовується у `generateBoardMessage`. Просто розширюємо JSON-схему полем `entityRefs:[...]` — стабільніше за regex.

### ❌ `praised: true` прапорець у задачі

**Чому відкинули (Раунд 2 Gemini):** забруднює доменну структуру даних. `nm_owl_cooldowns` уже існує — `setOwlCd('praised_${id}')` чистіше. Втім, оскільки похвала скасована (Варіант C), цей механізм не потрібен.

---

## Сумісність з Supabase

- **`nm_owl_silence_until`** ідеально лягає у таблицю `user_settings` (одна колонка `silence_until: timestamptz`) з RLS `auth.uid() = user_id`. Edge Function читає одну строку на старті pulse — швидко.
- **`entityRefs`** лягає у JSONB колонку у таблиці `board_messages` (`entity_refs: jsonb`). SQL запит `SELECT * FROM board_messages WHERE entity_refs @> '["task_123"]'` дозволяє швидко знаходити повідомлення про конкретну сутність (для cleanup при `DELETE` задачі через trigger).
- **`isEntityRelevant()`** на клієнті залишається — Supabase не знає бізнес-логіки актуальності (dueDate, виконано сьогодні тощо). Можна паралельно мати SQL VIEW `relevant_entities` як оптимізацію — але клієнтська перевірка все одно потрібна для миттєвого UI-фільтру при `nm-data-changed`.
- **Trigger при DELETE сутності** автоматично прибирає повідомлення табла які посилаються тільки на цю сутність — менше JS-логіки, чистіша БД.
- Перехід без переробки: міняємо джерело даних з `localStorage.getItem('nm_owl_silence_until')` на API-запит до `user_settings`. Логіка `shouldOwlSpeak` не змінюється.

---

## Що НЕ робимо у цьому плані

- **B-100 (часткове доповнення промпту з тригер-словами «не доставай»)** — застаріле. Фаза 1 робить це структурно через `request_quiet`. B-100 закриваємо разом з Фазою 1.
- **B-102 (USER_STATE сигнал у Brain Pulse з 9-м типом)** — застаріле. Brain Pulse уже отримує блокування через `shouldOwlSpeak('brain-pulse')` → `explicit_silence`. Окремий сигнал не потрібен. B-102 закриваємо разом з Фазою 1.
- **Real-time похвала за закриті задачі** — скасована (Варіант C). Може повернутись окремим планом якщо Роман попросить.
- **Розширення `entityRefs` на чат-повідомлення сови** — поки що тільки повідомлення табла. Чати лишаються як є (інша архітектура історії).
- **Auto-detect маркерів «втомився» / «не можу» у моментах** для авто-`request_quiet` — окрема ідея, не у цьому плані.
- **UI-індикатор тиші на таблі** («🤫 Сова мовчить до 22:00. Натисни щоб скасувати») — корисно, але після Фази 1 — окремою UI-задачею.

---

## Порядок виконання і коміти

### Рекомендований порядок

**Сесія A — Фаза 1 (Silence Engine):**
- Видимий приріст одразу. Тестується очевидно: написав «дай спокій» → перевірив що Brain Pulse тиху годину пропустив. Низький ризик зламати щось.
- Коміти (рекомендовано):
  1. `feat(silence): add request_quiet tool + handler`
  2. `feat(silence): add silence check in shouldOwlSpeak Judge Layer`
  3. `feat(silence): add UI_TOOLS_RULES trigger phrases for quiet mode`
  4. `chore: bump CACHE_NAME for Phase 1 silence engine`

**Сесія B — Фаза 2 (Pruning Engine):**
- Більший ризик (зміна структури повідомлень + wipe історії). Робити окремою сесією.
- Чекпоінт-коміти:
  1. `feat(pruning): add isEntityRelevant validator`
  2. `feat(pruning): add entityRefs to board generation prompt + JSON schema`
  3. `feat(pruning): filter board history by entity relevance`
  4. `feat(pruning): one-time wipe of legacy board cache on rollout`
  5. `chore: bump CACHE_NAME for Phase 2 pruning engine`

**Сесія C — Фаза 3 (Розділення Контексту):**
- Найкоротша. Можна додати кінцем Сесії B.
- Коміти:
  1. `feat(silence): add silence flag to chat AIContext`
  2. `refactor(board): remove recentlyDone from tab board context (now handled by Pruning)`
  3. `chore: bump CACHE_NAME for Phase 3`

### Чого НЕ робити

- **Не робити всі 3 фази одним комітом** — обрив на якій-небудь точці = втрачені попередні фази. Skeleton+Edit для нових файлів, по фазі коміт.
- **Не оновлювати CACHE_NAME до фактичного завершення фази** — інакше юзер отримає недоробку.
- **Не чіпати `getOwlBoardMessages` (Inbox)** у Фазі 2 без окремого тестування — Inbox-табло має складнішу логіку (priority, briefing). Розпочати з tab boards (`nm_owl_unified`), потім поширити.

---

## Посилання

### Дотичні документи

- [`ROADMAP.md`](../ROADMAP.md) — секція `🚀 Active` має блок «OWL Silence + Pruning Engine» з посиланням сюди.
- [`NEVERMIND_BUGS.md`](../NEVERMIND_BUGS.md) — B-100 і B-102 закриваються разом з Фазою 1 (структурно покривають свої сценарії).
- [`docs/CHANGES.md`](CHANGES.md) — запис сесії UVKL1 26.04.2026 (де народилась ця архітектура).
- [`_ai-tools/SESSION_STATE.md`](../_ai-tools/SESSION_STATE.md) — секція «ДЛЯ НОВОГО ЧАТУ» згадує план як перший пункт після поточних B-103/B-101.

### Файли коду які чіпаємо у плані

- `src/ai/ui-tools.js` — новий tool `request_quiet` + handler.
- `src/ai/prompts.js` — додати тригер-фрази у `UI_TOOLS_RULES` + оновити промпт `generateBoardMessage` (новий ключ JSON `entityRefs`).
- `src/ai/core.js` — `getAIContext()` додає прапорець тиші у промпт чатів (Фаза 3).
- `src/owl/inbox-board.js` — `shouldOwlSpeak()` отримує перший рядок `if (silenceUntil > Date.now()) return {speak:false}`.
- `src/owl/proactive.js` — `getTabBoardContext()` видаляє блок `recentlyDone` (Фаза 3). `generateBoardMessage` оновлює промпт+зберігання `entityRefs`. Фільтр `boardHistory` (Фаза 2).
- `src/owl/board.js` — `getTabBoardMsgs()` фільтр через `isEntityRelevant`.
- `src/owl/board-utils.js` — НОВИЙ ФАЙЛ з `isEntityRelevant()` (або секція в `proactive.js` без нового файлу — на вибір при імплементації).
- `src/core/boot.js` — одноразовий wipe історії при rollout.

### Ключі localStorage у плані

| Ключ | Існує? | Роль |
|------|--------|------|
| `nm_owl_silence_until` | ✅ існує (auto-silence) | Об'єднати з explicit-silence через `request_quiet` |
| `nm_owl_unified` | ✅ існує | Wipe одноразово, потім зберігаємо повідомлення з полем `entityRefs` |
| `nm_pruning_wipe_v1_done` | ❌ новий | Прапорець що wipe вже виконано (щоб не повторно) |
| `nm_owl_cooldowns` | ✅ існує | Не чіпаємо у цьому плані (зайдемо лише при потребі похвали) |

### Зовнішні джерела

- 2 раунди консультації з Gemini 3 Pro (26.04.2026) — повні промпти+відповіді у чаті сесії UVKL1, не у репо. Ключові висновки інтегровані у цей документ.
