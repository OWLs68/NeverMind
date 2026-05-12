# NeverMind — Відомі баги

> **Правило ротації:** у файлі зберігаються **всі відкриті** баги + **закриті у 2 останніх активних сесіях** (згідно `_ai-tools/SESSION_STATE.md`).
> При виклику `/finish` у новій сесії — закриті з найстаршої з 2 активних переносяться у [`_archive/BUGS_HISTORY.md`](_archive/BUGS_HISTORY.md).
> Формат ID: **B-XX** — номер, сортуються хронологічно.
> Використання: `/fix B-XX` — скіл Claude прочитає цей файл і знайде опис бага.

---

## 🔴 Критичні (зламана функціональність)

_Немає відкритих критичних багів станом на 07.05.2026 (LfA6w — B-151+B-152+B-153 закрито)._

---

## 🟡 Середні (є обхідний шлях або рідко трапляється)

| B-155 | `src/owl/brain-pulse.js:122-134` `startBrainPulseCycle()` | **Гіпотетичний** (підтверджено LfA6w що зараз викликається 1× з `boot.js:606`). Додає global listener на `nm-data-changed` без guard від повторного виклику. Якщо boot.js випадково викличе двічі (regression) — `_debounceTimer` затиратиметься, але listener-ів буде 2 → подвійні brainPulse запити (2× cost). Профілактичний фікс: idempotency flag. ~10 хв. |
| B-156 | `src/tabs/calendar.js:806-807` event-edit-modal | **Гіпотетичний** (не підтверджено візуально). `<input type="time">` з `flex:0 0 110px` без `min-width:0` всередині flex-row. На iOS Safari intrinsic min-width нативного picker може overflow контейнер у вузьких viewports (iPhone SE 320px). Фікс: додати `min-width:0`. ~5 хв. |
_B-160..B-164 закрито у 64CXo 10.05 — див. секцію "✅ Закриті" нижче._

_B-125 закрито у MPVly 05.05 (`4082a0c`) — у списку відкритих був дубль через документаційну дірку, прибрано LfA6w 07.05._
_B-126 закрито у MPVly 05.05 — див. секцію "✅ Закриті" нижче._

---

## 🟢 Дрібні (косметика, не ламає функціонал)

_Немає відкритих дрібних багів станом на 08.05.2026 (PJi7l — B-158 закрито)._

_B-157 закрито у LfA6w 07.05 (`c18c7d1`) — крихкий escape патерн у `notes.js:355` замінено на спільний `escapeJsArg()` помилки усунено разом з B-152._
_B-158 закрито у PJi7l 08.05 — див. секцію "✅ Закриті" нижче._

---

## ✅ Закриті (активні сесії)

_Зберігаються закриті у 2 останніх активних сесіях (db0YY + dyhJu). Старіші (64CXo + PJi7l + LfA6w day2 + MPVly + QDIGl + rC4TO) перенесено у [`_archive/BUGS_HISTORY.md`](_archive/BUGS_HISTORY.md) (TODO: фактична ротація на наступному `/finish`)._

_Сесія **db0YY** (12.05.2026) — B-108 регресія після myshu 7 UUID-міграцій:_
- **B-170 закрито** (`f66acfb`) — **Onclick без лапок навколо UUID** у 17 точках 6 файлів → SyntaxError на тап у v841. Корінь: myshu (11.05) мігрувала Habit/Event/Note/Moment/Finance/Project/InboxItem на UUID-string (v9-v15) але не зробила grep `onclick="fn(${.*\.id})"` після кожної міграції. UUID з дефісами у HTML-атрибуті без лапок парситься як вираз `550e8400 - e29b - ...` → ReferenceError. Точки: inbox.js:317 navigateInboxItem; evening.js:188,194,285,286 (момент open/delete + habit hold/relapse); notes.js:560,564,1324 (openNoteView/openNoteMenu/chat search); projects.js:130,329,345 (project open/timeline/step toggle); calendar.js:168,230,429,486 (4 event-edit рендер-точки); finance.js:259 parseInt(txId)→NaN свайп; finance.js:474,516 (openEditTransaction 2 рендер-точки). **Фікс:** обгорнути `${id}` у одинарні лапки `'${id}'`; для finance.js:259 прибрати parseInt — txId лишається string. Той самий клас бага що B-108 (xGe1H 27.04 для tasks).
- **B-171 закрито** (`2cf5510`) — **Date.now() ID при створенні entities через AI/handler** у 8 точках. Корінь: myshu пройшла boot-міграції готових даних але не оновила точки СТВОРЕННЯ нових entities — мікс типів у localStorage (старі UUID-string + нові number) → strict `find(x => x.id === id)` повертає false → silent fail свайп-видалення/undo. Точки: evening-actions.js:106,140,159 (save_task/save_habit/save_finance); habits.js:1021 (inbox-картка для AI task); core/utils.js:42 (saveOffline → Inbox item); owl/inbox-board.js:1075 (Finance tx через OWL); inbox.js:1274 (inboxCardId AI dispatch); calendar.js:55 (generateWeeklySeries рекурентна копія). **Фікс:** замінити `Date.now()` на `generateUUID()` + додати імпорт у core/utils.js + calendar.js. Лишилось: sub-entity steps (task.steps/project.steps досі Date.now() — окрема сесія) + Health 11+ Date.now() (Сесія 3B-8).

_Сесія **dyhJu** (10.05.2026) — pre-edit-read-check hook + B-165 фікс event sync + B-166 save_finance системний (G4) + B-167 me-chat history helper:_

_Сесія **dyhJu** (10.05.2026) — pre-edit-read-check hook + B-165 фікс event sync + B-166 save_finance системний (G4) + B-167 me-chat history helper:_
- **B-167 закрито** — `me.js:75` пушив у `meChatHistory` `{role:'assistant', content: msg.content}` БЕЗ summary tool_calls. Якщо AI зробив тільки save_finance (порожній content) — у history лишався `assistant: ''` → наступний turn AI бачив порожнє і ПОВТОРЮВАВ дію. Симптом (smoke-test 64CXo Романа): юзер «Купив хліб 3 євро» → ✓ -₴3 → юзер «Вода 2 євро» → batch 2× save_finance: повторив хліб (-₴3) + правильна вода (-₴2). Інші tab-чати (notes-bar/tasks-bar/finance/health/projects) працювали правильно бо handler через `addX-agent` сам пушить text у history (handler text = summary). Inbox — мав inline summary з PJi7l. Тільки `me.js` мав справжню діру. **Фікс системний:** додано `buildAssistantHistoryEntry(msg)` helper у `src/ai/core.js` — будує `{role:'assistant', content}` з summary `[name(key); ...]` якщо tool_calls. Замінено у `me.js:75` + рефакторинг `inbox.js:568-580` на той самий helper (consistency, без зміни поведінки). 1 helper → 2 точки → один мозок на рівні chat-history.
- **B-168 закрито** — Inbox-картки фінансів показували тільки `-₴5 · Їжа` без коментаря (юзер бачив 6 однакових `-₴3 · Їжа` без розрізнення Суп/Банани/Хліб). Корінь у `habits.js:1569`: `inboxText = ... + (comment && comment !== originalText ? ' — ' + comment : '')`. Логіка пропускала comment коли AI ставив `fin_comment === originalText` (типовий кейс «Суп 5 євро» → AI зберігає той самий текст як коментар). Дивна оптимізація щоб уникнути дублювання — фактично прибирала весь контекст. **Фікс:** прибрано `comment !== originalText` обмеження. Тепер картки `-₴5 · Їжа — Суп 5 євро`, як у Фінансах табло. Знайдено iPhone smoke-test Романа.
- **B-169 закрито** — «нагадай зранку випити води» о 20:06 створював reminder на сьогодні 08:00 (у минулому) → reminder зомбі. Корінь у `set_reminder` handler `habits.js:1622`: parser `parseUaTimeOfDay` ставить time=08:00, але `resolveDateFromText` для «зранку» null (нема явного «завтра») → date fallback today. Перевірки на «time у минулому → +1 день» не було. **Фікс:** code-side guard після парсингу time — якщо `date === todayISO && reminderTs <= now` → date += 1 день. Універсально для всіх абстрактних часів («зранку» о 20:00 → завтра 08:00, «після обіду» о 17:00 → завтра 14:00). Знайдено iPhone smoke-test (Розпорядок дня показав block на Нд = сьогодні замість Пн = завтра).
- **B-165 закрито** — `delete_event` (`src/tabs/habits.js:1415-1450`) чистив тільки `nm_events`, **не чистив картку у `nm_inbox`** і `saveEvents()` диспатчила `nm-data-changed` з `detail:'events'` (множ) тоді як `DETAIL_TO_KEY` у `boot.js:177` мала тільки `'event'` (одн) → cross-tab sync silent failure (B-130 для events). Юзер видаляв подію з календаря, картка «Подія» лишалась зомбі у Inbox. Дзеркальний баг до B-126 (`delete_reminder`) + B-130 (`reminder` mismatch). **Фікс:** (1) додано `eventId` field у 4 точки створення event-картки (inbox.js:794 create_event, habits.js:1009 task→event fallback, habits.js:1374 create_event handler, habits.js:1408 edit_event log) — зв'язок для майбутнього cleanup. (2) `delete_event` handler — 3-сховищний cleanup `nm_inbox` filter за `eventId === parsed.event_id` (нові картки) + fallback за `text === title && category === 'event'` (старі без eventId) + `renderInbox()`. (3) `DETAIL_TO_KEY` додано `'events': 'nm_events'` — узгоджено з `saveEvents()` disp. Знайдено через iPhone smoke-test 64CXo Романа. ~30 хв.
- **B-166 закрито системно через G4** — «Купив хліб 3 євро» → save_note замість save_finance (smoke-test 64CXo). Корінь — архітектурний розрив: 5 guards (PAST_INDICATORS, момент-keyword, dedupe save_finance+save_task, dedupe complete+task, dedupe moment+event) жили **inline у `src/tabs/inbox.js`**, інші 7 чатів через `tool-dispatcher.js dispatchChatToolCalls` — **БЕЗ жодного guard'а**. Конверсії працювали тільки в Inbox. Замість латки на 1 чат (анти-патерн) — реалізували **G4 з SESSION_STATE Bridge-плану** (Roman: «фіксити не латками а системно»). **Фікс — 4 фази:** (1) `src/data/dispatcher-guards.js` — 6 pure functions (5 існуючих + НОВИЙ `convertNoteToFinance` з MONEY_RE для B-166) + `applyAllGuards` convenience. Без localStorage-залежностей — переїде у Edge Function без переписування (правило 12 CLAUDE.md). 16/16 smoke-тестів. (2) `tool-dispatcher.js dispatchChatToolCalls` — `applyAllGuards` на самому початку → 7 tab-чатів (tasks/notes/me/health/finance-chat/projects/clarify) отримали ВСI guards. (3) `inbox.js` — 67 рядків inline guards замінено на 1 виклик `applyAllGuards(msg.tool_calls, text)`. 8-й чат на тому ж модулі. (4) `prompts.js` КРОК 5 — додано рядок-перенаправлення «сума з валютою → save_finance», щоб AI правильно класифікував до того як guard спрацює. Принцип «один мозок» вперше реалізовано на рівні guards. ~2 год.

_Сесія **64CXo** (09-10.05.2026) — Bridge-архітектура + кластер «крок vs задача» + Council 5 агентів (~35 комітів):_
- **B-160 закрито** (`2e6cdc3`) — `src/ai/core.js:99-106` getAIContext тепер показує назви активних кроків («активні: перець, цибуля»). AI більше не плутає крок з задачею.
- **B-161 закрито** (`2e6cdc3`) — `complete_step` доданий як справжній tool у INBOX_TOOLS + case у tool-dispatcher + handler у processUniversalAction. Раніше був тільки text-JSON fallback у habits.js — Inbox-чат писав `[complete_task]` plain text.
- **B-162 закрито** (`2e6cdc3`) — `add_step` handler перевіряє `task.steps.some(s => s.text.toLowerCase() === stepText.toLowerCase())` перед push. Дублі неможливі.
- **B-163 закрито** (`2e6cdc3`) — `merge_tasks` новий tool. Переносить активні кроки з 'from' у 'to' з дедупом, додає назву 'from' як крок 'to', видаляє 'from'. AI тепер правильно обʼєднує задачі замість дублювання через add_step.
- **B-164 закрито** (`2e6cdc3` + auto-fix) — уніфіковано 3 handlers complete_task. inbox.js:1454 і evening-actions.js:176 тепер закривають кроки `forEach(s => s.done = true)` як habits.js. Стан-розрив усунено.
- **6 додаткових з Council аудиту:** profile-builder.js `nm_habit_log2` fix (AI бачив порожні звички весь час), `\n→<br>` уніфіковано у 7 add*ChatMsg, `showUndoToast()` у 3 точках виправлено, chip double-tap lock, BASE_CHAT_RULES уніфікація INBOX, nm_reminders canonical accessors (8 setItem + 10 getItem).
- **Bridge-стратегія (Gemini 3 раунди):** Phase 1.1 Strict mode для 5 топ-tools, Phase 1.2a PAST_INDICATORS guard конверсія create_event→save_moment, Phase 2 ua-time-parser розширено (абсолютні дати + дні тижня), Phase 3 інтеграція parser у 3 handlers.
- **Notes nested folders Щоденник/дейлі (4 фази A-D):** save_moment автодублюється у дейлі-папку «Субота, 9 травня 2026», UI drill-down 2 рівні з recursive swipe-delete, getNotesContext nested-aware.

_Старіші сесії (PJi7l + LfA6w day1/day2 + MPVly + MPVly-day2 + QDIGl + rC4TO + UvEHE з B-120+B-121, 4xJ7n з B-118+B-119, mUpS8 з B-116, BqTWF з B-115) → [`_archive/BUGS_HISTORY.md`](_archive/BUGS_HISTORY.md)._


---

## 📋 wontfix / Галюцинації AI

### "Синтаксична помилка `<msg.id>`" у `board.js:125` (05.04.2026)

Gemini під час аудиту повідомив про "критичну синтаксичну помилку" у `const ago = Date.now() - (msg.ts || msg.id || Date.now());`. Це **галюцинація** — у реальному коді кутових дужок немає, це валідний JS-ланцюжок з `||` fallback.

**Урок:** завжди перевіряти точну цитату Gemini проти реального коду перед виправленням.

---

## 📋 Як додавати новий баг

```markdown
| B-XX | `src/шлях/файл.js:рядок` | Короткий опис | Деталі якщо є |
```

Пріоритети:
- 🔴 **Критичний** — функціональність зламана повністю
- 🟡 **Середній** — є обхідний шлях або рідко трапляється
- 🟢 **Дрібний** — косметика, не заважає роботі

Після виправлення:
1. Перенести рядок у секцію "✅ Закриті (активні сесії)" з датою і ID сесії
2. Додати коротке пояснення як виправлено
3. При виклику `/finish` — старіші сесії автоматично ротуються у `_archive/BUGS_HISTORY.md`
