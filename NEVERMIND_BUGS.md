# NeverMind — Відомі баги

> **Правило ротації:** у файлі зберігаються **всі відкриті** баги + **закриті у 2 останніх активних сесіях** (згідно `_ai-tools/SESSION_STATE.md`).
> При виклику `/finish` у новій сесії — закриті з найстаршої з 2 активних переносяться у [`_archive/BUGS_HISTORY.md`](_archive/BUGS_HISTORY.md).
> Формат ID: **B-XX** — номер, сортуються хронологічно.
> Використання: `/fix B-XX` — скіл Claude прочитає цей файл і знайде опис бага.

---

## 🔴 Критичні (зламана функціональність)

_Немає відкритих критичних багів станом на 05.05.2026 (QDIGl)._

---

## 🟡 Середні (є обхідний шлях або рідко трапляється)

| B-125 | `src/ai/prompts.js:252` REMINDER_RULES + `src/ai/tool-dispatcher.js:115` set_reminder | Чіп «Завтра вранці» створює reminder на **сьогодні 09:00** замість завтра 08:00. Юзер тапнув [Завтра вранці] → AI викликав set_reminder без `date` → dispatcher поставив дефолт = сьогодні. Час уже минув на момент створення (22:30 → 09:00 СЬОГОДНІ це -13 годин). Виявлено MPVly 05.05 під час smoke-test після фіксу raw-JSON. Workaround: ввести вручну «завтра в 8 ранку». |
_B-126 закрито у MPVly 05.05 — див. секцію "✅ Закриті" нижче._

---

## 🟢 Дрібні (косметика, не ламає функціонал)

_Немає відкритих дрібних багів._

---

## ✅ Закриті (активні сесії)

_Зберігаються закриті у 2 останніх активних сесіях (MPVly-day2 + MPVly + QDIGl). Старіші (rC4TO з B-122/B-123/B-124) перенесено у [`_archive/BUGS_HISTORY.md`](_archive/BUGS_HISTORY.md) (TODO: ротація на наступному `/finish`)._

_Сесія **MPVly-day2** (06.05.2026) — silent-bug-scout 4-pack + i18n 110 рядків + 2 хвости + B-134..136:_
- **B-135 закрито** — Модалка «Памʼять агента» закривається свайпом вниз замість скролити список фактів. Корінь у `src/tabs/tasks.js:72` `setupModalSwipeClose` whitelist — `#memory-cards-list` (контейнер з `overflow-y:auto`, `index.html:1533`) відсутній. `swipeRoot.touchstart` ловив дотик на картках → закривав модалку при swipe-down 80px замість пропустити скрол. Фікс: додано `#memory-cards-list` у whitelist. Знайдено iPhone smoke 06.05 18:27.
- **B-136 закрито** — Кнопка «↻ Оновити через OWL» залишається `disabled` назавжди якщо AI-запит впаде. `refreshMemory` (`nav.js:1093`) виставляв `btn.disabled=true` перед `await doRefreshMemory(true)`, але `btn.disabled=false` був ПІСЛЯ await. Якщо `callAIWithTools` всередині `_migrateLegacyMemoryToFacts` reject'нуло (network error / AI fail / timeout) — exception проходив крізь функцію, кнопка мертва, юзер мусить перезавантажити PWA. Фікс: `try/finally` гарантує відновлення стану кнопки незалежно від результату.
- **B-134 закрито** — AI створював `set_reminder` без явного «нагадай», коли юзер просто говорив про намір («завтра закінчу тумбочку»). Знайдено iPhone smoke-test 06.05 18:08. Корінь у `src/ai/prompts.js`: `REMINDER_RULES:252` дозволяв тригер по МАПІ ЧАСУ ("завтра"/"вранці") навіть БЕЗ явного слова «нагадай» — це суперечило правилу line 250 («нагадай → інтент set_reminder»). Бонус-знахідки prompt-engineer-auditor: (a) `create_event` description не забороняв рефлексії/підсумки → AI робив «Сьогодні був не напряжний день» як **подію** з синьою крапкою у календарі; (b) OWL-міні чат (getOwlChatSystemPrompt:703) НЕ підключає REMINDER_RULES → ще одна точка авто-reminder; (c) G13 BRAIN DUMP (вечірній чат, line 601) міг паралельно створювати reminder через "завтра"-тригер. Фікс: 4 точкові правки у prompts.js — (1) жорстке правило перед МАПОЮ ЧАСУ «set_reminder ТІЛЬКИ за явним словом-тригером», (2) у create_event description заборона на рефлексії/підсумки/опис минулого, (3) у OWL-чаті ПРАВИЛА — заборона auto-set_reminder + create_event для рефлексій, (4) у G13 BRAIN DUMP застереження проти "завтра"-тригер reminder.
- **B-132 закрито** — `nav.js:202` `t`-shadow у `openTabSelector` `ALL_TABS_CONFIG.map(function(t) {...})`. Параметр `t` shadows import `t` з `utils.js` → виклик `t('nav.tabsel.always', 'завжди')` всередині map (line 212) спробував викликати об'єкт ALL_TABS_CONFIG[i] як функцію → **TypeError: t is not a function** при відкритті селектора активних вкладок. Не помічено бо модалка рідко відкривається. Фікс: параметр `function(t)` → `function(cfg)`, всі `t.id`/`t.accent`/`t.bg`/`t.svg` → `cfg.*`. Бонус: `cfg.label` обгорнуто `t('tab.' + cfg.id, cfg.label)` (динамічний ключ). Aux callbacks lines 278/284 теж переіменовано `t => t.id` → `c => c.id` для consistency.
- **B-133 закрито** — `calendar.js:595, 608` `setupModalSwipeClose(routine-panel, closeRoutineModal)` дублювання у `openRoutineFromCalendar` + `openRoutineModal`. `_swipeClose` guard у `tasks.js:63` робить дублі безпечними поки `#routine-panel` статичний у HTML, але fragile при майбутньому refactor (якщо panel пере-створюється у DOM). Фікс: винесено у `_ensureRoutineSwipeClose()` helper, обидва opener виклики йдуть через нього.
- **B-128 закрито** — `drum-col mask-image` композит ламає модалку у backdrop-filter:blur паренті (`style.css:1505-1517`). Той самий клас бага що Settings UvEHE 03.05 — `event-edit-modal` + `health-dt-picker-modal` обидва мають parent `backdrop-filter:blur(32px)+overflow:hidden`. На iOS Safari при scroll барабана дати/часу композитний шар ламався → модалка стискалася. Знайдено `silent-bug-scout` ще до того як Роман натрапив. Фікс: видалено `mask-image` / `-webkit-mask-image` з `.drum-col` — fade-ефект тепер дають border ramp + центральна acent-смуга. Косметичний fade на краях барабана прибрано — прийнятно.
- **B-129 закрито** — `set_reminder` повідомлення не обгорнуто (`habits.js:1452`). `addMsg('agent', \`⏰ Нагадаю о ${time}: "${text}"\`)` — біля `delete_reminder` що повністю обгорнуто (B-126 з MPVly). Фікс: `t('habits.reminder.set.ok', '⏰ Нагадаю о {time}: "{text}"', { time, text })`.
- **B-130 закрито** — `detail:'reminder'` cross-tab sync silent failure (`boot.js:177-187` `DETAIL_TO_KEY`). `set_reminder` і `delete_reminder` диспатчили `nm-data-changed` з `detail:'reminder'`, але мапа не мала `'reminder'` → `handleSyncKey` не викликався → друга вкладка не оновлювалась. Зараз непомітно (1 девайс), стало б видно з Supabase. Фікс: `'reminder': 'nm_reminders'` у мапу.
- **B-131 закрито** — `sendClarifyText` без `aiLoading` guard (`inbox.js:1048`). При відкритому clarify-вікні `aiLoading=false` (бо `aiLoading=false` встановлено перед `showClarify`), а `sendClarifyText` робив повний `callAIWithTools` без re-set → юзер міг спамити Send у головному Inbox і отримати дві паралельні AI-відповіді. **Bonus:** оригінальний код мав `let primaryHandled = false` всередині `if (msg.tool_calls && ...)` блоку але `else if (!primaryHandled)` посилався поза тим scope → ReferenceError-prone. Фікс: `if (aiLoading) return; aiLoading = true; try { ... } finally { aiLoading = false; }` + `let primaryHandled = false` піднято на верх try.
- **i18n обгортка 110 рядків** — `habits.js` (~50 у `processUniversalAction`: create_task, edit_task, delete_task, edit_habit, delete_habit, complete_*, add_step, add_moment, create_habit, create_event, edit_event, delete_event, edit_note, create_folder, delete_folder, move_note, save_finance amount-error, set_reminder time-empty, save_routine + `Пн-Нд` для habit dots + `N% за 30 днів`), `health.js` (~34 рядки `buildHealthExportText`: МЕДИЧНА КАРТКА, АЛЕРГІЇ, АКТИВНІ СТАНИ, ВСІ ПРЕПАРАТИ, ВІЗИТИ ДО ЛІКАРЯ, ЗАВЕРШЕНІ СТАНИ, disclaimer), `nav.js` (~10 — TAB_LABELS для tab-order list + memory source: фон/вручну/стара пам'ять/онбординг), `finance-analytics.js` (~15 — Найбільша операція, Прогноз місяця, Доходи місяця, Розподіл доходу edit + benchmark warnings). Підготовка до Supabase i18n. baseline: 685 → 575 необгорнутих.

_Сесія **MPVly** (05.05.2026) — chip render Inbox + B-125 + B-126 + B-127 + tasks.js shadow + правило Sonnet:_
- **B-127 закрито** — табло Продуктивності показує stale «3 активні задачі: A, B, C» 13 годин після того як юзер виконав одну з них. Корінь подвійний: (1) Pruning Engine `_isStaleHabitGeneralization` ловив тільки звички, для задач analog'у не було → entityRefs порожні + текст з конкретними назвами не фільтрувався; (2) `tryTabBoardUpdate` (proactive.js) не мав 60-хв safety net як `inbox-board.js:1185-1190` → застрягало без force regeneration. Фікс: новий `_isStaleTaskGeneralization` (board-utils.js) парсить назви у лапках з тексту, шукає у nm_tasks → якщо хоч одна status='done' → stale. + safety net 60 хв у tryTabBoardUpdate.
- **Critical t-shadow tasks.js** (`7cd2259`) — `t2 is not a function` при тапі на задачу. 9 shadow точок (const t = tasks.find/.filter(t=>)/.map(t=>)) затіняли імпортовану t() з utils → esbuild у IIFE bundle прив'язав t2 до utils-Object замість функції. Юзер не міг редагувати/створювати задачі. Фікс: rename → task (8 місць) і arr (3 callback).
- **Inbox чіпи raw-JSON закрито** (`63223f2`) — REMINDER_RULES навчав голий масив `[{...}]` замість `{"chips":[...]}`. Парсер `parseContentChips` не розпізнавав → JSON виходив як текст. Фікс: 2 точки відмови (промпт обгортка + парсер fallback на голий масив де всі елементи мають label+action).
- **B-125 закрито** (`4082a0c`) — чіп «Завтра вранці» створював reminder на сьогодні замість завтра (AI не передав `date`, dispatcher ставив дефолт). Фікс REMINDER_RULES: лейбл `[Завтра 08:00]` (явний час) + критичне правило «слово 'завтра' → date=YYYY-MM-DD завтрашня обов'язково».
- **B-126 закрито** (нова tool `delete_reminder`) — при коригуванні часу свіжого reminder («не на 10 а на 9») AI створював дубль. Корінь архітектурний: відсутня tool. Фікс: `delete_reminder(text, time?, date?)` у INBOX_TOOLS + handler у `processUniversalAction` (`habits.js`) з 3-сховищним cleanup (nm_reminders + nm_events + nm_inbox за reminderId) + правило REMINDER_RULES «коригуєш час → 1) delete_reminder старого 2) set_reminder нового».

_Сесія **QDIGl** (05.05.2026) — Розпорядок merge + delete_project + B-117 audit fix остаточно + 19 раундів i18n + 4 audit фікси:_
- **B-117 закрито остаточно** (`923ae80` + `9e30379`) — табло звичок stale. **Перша спроба** (`923ae80`): Pruning content fallback у `_isStaleHabitGeneralization` (board-utils.js) + `renderTabBoard` у boot.js listener для habit/task ключів. Сова оновлюється миттєво після complete_habit. **Друга спроба** (audit `9e30379` #2): фікс позитивних повідомлень — раніше умова `doneCount === buildHabits.length` ловила позитивні «3/3 чудово!» → додав `&& isHabitTextNegative` гард. Тепер тільки негативні «не виконано/жодну/активізуйся» викидаються. + audit fix #1 — DOW Mon=0 у proactive.js:982 (5-та точка пропущена при попередньому уніфікуванні): `dow = (getDay()+6)%7`. + audit fix #3 — TTL прострочених mark `done:true` ТІЛЬКИ для expired (>180хв). Раніше done ставилось ДО показу → race condition з AI fetch fail втрачав reminder. + audit fix #5 — `findProjectByName` exact > startsWith > unique-fuzzy (не видалить «Хімчистка-А» при запиті «Хімчистка-Б»).

_Сесія **rC4TO** (04.05.2026) — silent failures фіксовано (chips Phase C + dispatcher) + swipe-delete карток Здоров'я + iOS діагноз правило + Notes render guard:_
- **B-122 закрито** (`8a05ada`) — Health Phase C інтерв'ю чіпи мовчать. Корінь у `src/owl/chips.js:199-204`: (1) whitelist action переписував `health_interview` у `'chat'` → handler ніколи не спрацьовував, (2) `escapeHtml` не кодує `"` → JSON payload ламав HTML-атрибут. Фікс: додано `health_interview` у whitelist + локальний escape `"` → `&quot;` для payloadAttr + `console.warn` у fallback `handleChipClick` для майбутніх silent failures.
- **B-123 закрито** (`431b433`) — `create_project` у Фінансах висне (typing-індикатор крутиться вічно). Корінь у `src/ai/tool-dispatcher.js`: tool навмисно НЕ оброблявся → silent skip → `addMsg` ніколи не викликається → typing висне. Фікс: новий handler `create_project` ПЕРЕД universal loop + універсальний SILENT FAILURE GUARD у кінці `dispatchChatToolCalls` для будь-яких unknown tools.
- **B-124 закрито** (`2f96593`) — вкладка Нотатки порожня попри 30 записів. Корінь з логів діагностики: `items[0].text.length` throws у `renderNotes:333` бо хоч один запис у nm_notes без поля `text`. Один битий запис → throws всередині `.map()` → весь HTML не формується. Фікс: 3 захисти у `notes.js`.

_Старіші сесії (UvEHE з B-120+B-121, 4xJ7n з B-118+B-119, mUpS8 з B-116, BqTWF з B-115) → [`_archive/BUGS_HISTORY.md`](_archive/BUGS_HISTORY.md)._

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
