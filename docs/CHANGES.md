# NeverMind — Журнал змін

> Кожна сесія Claude повинна додавати сюди запис після завершення роботи.
> Формат: дата, що зроблено, які файли змінено, чи є відкриті проблеми.
> Старіші записи → `_archive/CHANGES_OLD.md`

---

## 2026-04-20 — ✅ Шар 1 "Один мозок V2" ЗАВЕРШЕНО: 8 чатів на єдиному dispatcher (Gg3Fy)

**Контекст:** Після сесії EWxjG (2 провали промпт-підходу для B-94/B-95) було встановлено що корінь архітектурний — модель GPT-4o-mini завжди обирає реальну OpenAI-функцію над JSON-у-тексті. Треба мігрувати CRUD у проблемних чатах (Health/Finance/Projects) на повні `INBOX_TOOLS` і забезпечити паритет можливостей у всіх 8 чатах. Роман явно попросив "все має будуватись на принципі Один мозок".

**Зроблено (6 комітів на гілці `claude/start-session-Gg3Fy`, автономна робота вночі):**

**1. ROADMAP.md Шар 3 переписано (коміт `a80fa08`).** Скасовано неправильне формулювання "спільна історія `nm_owl_conversation` + міграція 8 ключів → 1". Повернуто до оригінальної концепції з `_archive/FEATURES_ROADMAP.md` п.1.3: **"чати лишаються окремими для юзера, але мозок бачить ВСІ чати при генерації відповідей"**. Майбутній Шар 3 = розширення `getAIContext()` хвостами чатів (3-5 msg × 8 вкладок), без торкання сховища. Також переписано ризики (прибрано "міграція даних").

**2. Фаза 1 — dispatcher foundation (коміт `ebfab56`).** Створено `src/ai/tool-dispatcher.js` — єдиний модуль-мозок для tool_calls у всіх 8 чатах. Маршрутизація: UI tools → `handleUITool`, health CRUD → прямі хендлери (9 tools), memory/finance-cat → прямі хендлери (6 tools), project-specific → `_handleProjectTool` (додано у Фазі 4), інші CRUD → `processUniversalAction` (лишається у `tabs/habits.js` бо 384 рядки локальних залежностей). Перенесено `dispatchChatToolCalls` і `_toolCallToUniversalAction` з `tabs/habits.js`. Оновлено імпорти у habits.js, me.js, notes.js.

**3. Фаза 2 — Health chat migration (коміт `5563b15`). B-94/B-95 архітектурно зачеплені.** Промпт винесено у `getHealthChatSystem(activeCard)` у `ai/prompts.js` (стиль `getEveningChatSystem`). У `sendHealthBarMessage` замінено `UI_TOOLS` → `INBOX_TOOLS`, прибрано `_processOne` (~100 рядків) + `extractJsonBlocks` + history detox patch. `add_allergy`/`create_event`/`create_health_card` — тепер справжні OpenAI-функції на одному рівні з `set_owl_mode`/`switch_tab`. Функція стиснута 250 → 40 рядків. **Очікується iPhone v340+ підтвердження що B-94/B-95 закриті.**

**4. Фаза 3 — Finance chat migration (коміт `fe5b9e2`).** Додано 2 нові tools у INBOX_TOOLS: `delete_transaction`, `set_finance_budget`. Хендлери у dispatcher. Промпт винесено у `getFinanceChatSystem({currency, budget, txSummary, expenseCats, incomeCats})`. Старі псевдо-actions (`save_expense`/`save_income`/`create_category`) замінені на стандартні (`save_finance` з `fin_type`, `create_finance_category`). `checkFinBudgetWarning` лишається локальним — викликається post-dispatch для `save_finance(expense)`. Функція стиснута 155 → 50 рядків.

**5. Фаза 4 — Projects chat migration (коміт `8307d26`). Шар 1 повністю закритий.** Додано 8 project-specific tools у INBOX_TOOLS: `complete_project_step`, `add_project_step`, `update_project_progress`, `add_project_decision`, `add_project_metric`, `add_project_resource`, `update_project_tempo`, `update_project_risks`. Хендлер `_handleProjectTool` у dispatcher — централізована логіка з автоматичним прогрес-розрахунком. Промпт → `getProjectsChatSystem({activeProject, projectsContext, activeSteps})`. Функція стиснута 215 → 30 рядків.

**6. CACHE_NAME bump + документація (цей коміт).** `nm-20260420-2040` → `nm-20260420-2159`. Оновлено `SESSION_STATE.md` (повний журнал сесії), `NEVERMIND_BUGS.md` (B-94/B-95 → 🟡 очікують iPhone підтвердження), цей `CHANGES.md`.

**Архітектурний підсумок:**
- **До сесії:** 3 паралельні dispatcher-и (Inbox inline, `dispatchEveningTool`, `processUniversalAction`) + 3 чати на `UI_TOOLS` + text-JSON (Health/Finance/Projects) → ~950 рядків дубльованої dispatch-логіки.
- **Після сесії:** єдиний `tool-dispatcher.js` (~370 рядків) + централізовані промпти у `prompts.js`. 8 чатів отримали паритет можливостей.
- **Net delta:** ~610 рядків видалено з 3 мігрованих чатів, ~370 додано у новому dispatcher-модулі + 400 у prompts.js. Bundle size ≈ без змін, але 8 чатів тепер на одному двигуні.

**Критично перевірити на iPhone v340+:**
У чаті Здоровʼя 6 фраз:
1. "Алергія на пил" → `add_allergy` (B-94 fix)
2. "Завтра прийом у лікаря о 10" → `create_event` (B-95 fix)
3. "Болить горло 3 дні" → `add_health_history_entry` або `create_health_card`
4. "Перейди до фінансів" → `switch_tab` (UI tool має все ще працювати)
5. "Переключись на Ментора" → `set_owl_mode`
6. "Запам'ятай що не їм глютен" → `save_memory_fact`

Якщо всі 6 спрацюють → закрити B-94/B-95 у `NEVERMIND_BUGS.md` як ✅ Gg3Fy. Якщо ні → корінь глибше ніж bias моделі, треба сесія дебагу з логами OpenAI-запитів.

**Файли:** створено `src/ai/tool-dispatcher.js`. Змінено `src/ai/prompts.js` (+3 нові функції промптів + 10 нових tools), `src/tabs/habits.js` (−90 рядків), `src/tabs/health.js` (−200 рядків), `src/tabs/finance-chat.js` (−105 рядків), `src/tabs/projects.js` (−185 рядків), `src/tabs/me.js` + `src/tabs/notes.js` (тільки імпорти), `sw.js` (CACHE_NAME), `ROADMAP.md`, `NEVERMIND_BUGS.md`, `_ai-tools/SESSION_STATE.md`, `bundle.js`.

**iPhone v340 тест 21.04 06:21-06:22 — 5/6 фраз ✅:**
- ✅ "Алергія на пил" → `add_allergy` → **B-94 ЗАКРИТО архітектурно**
- ✅ "Завтра прийом у лікаря на 10" → `create_event` на 22.04 10:00 → **B-95 ЗАКРИТО**
- ✅ "Перейди до фінансів" → `switch_tab`
- ✅ "Переключись на Ментора" → `set_owl_mode`
- ✅ "Запам'ятай що не їм глютен" → `save_memory_fact`
- 🟡 "Болить горло" при активній картці "Шляпа" → tool правильний (`add_health_history_entry`), але записало у "Шляпа" замість створити нову картку → виявлено **B-96**.

**B-96 концепція картки Здоровʼя — 3 ітерації (коміти `6f379d9` → `46a067c` → `ea642b0`):**

1. **Ітерація 1 (`6f379d9`) — тематичний матчинг.** Додано у промпт `getHealthChatSystem` правило: якщо активна картка тематично збігається з симптомом — запис у неї, інакше `create_health_card` нова ("Горло" для горла, "Голова" для головного болю). **Роман відкинув:** "Картка має бути здоровʼя. Горло це ж про здоровʼя. Нащо 10 нових папок".

2. **Ітерація 2 (`46a067c`) — загальний журнал.** Концептуально переписано: одна загальна картка "Здоровʼя" = catch-all для всіх разових симптомів. Вузькі картки ("Тиск", "Алергія") — тільки для хронічних станів / діагнозів лікаря / тривалих проблем 3+ днів. Handler `add_health_history_entry` у `tool-dispatcher.js` отримав fallback: якщо `card_id` відсутній або невалідний → шукає картку "Здоровʼя" за назвою, якщо немає — викликає `createHealthCardProgrammatic({name: "Здоровʼя", subtitle: "Загальний журнал"})`. Додано автоматичний дубль у Нотатки папка "Здоровʼя" через `addNoteFromInbox`.

3. **Ітерація 3 (`ea642b0`) — селективний дубль.** Роман: "Дублікат в нотатках чисто для історії. Але важливо щоб це не перетворювалося в архів і історію всього на світі". Автодубль прибрано з handler-а (анти-патерн: спам Нотаток кожним чихом). У промпт додано секцію "ДУБЛЬ У НОТАТКИ" — сова викликає `save_note(folder="Здоровʼя")` ТІЛЬКИ для значущих записів (тривалий симптом 3+ днів, діагноз лікаря, суттєва зміна "стало гірше"/"загострення", явний запит юзера). Разові дрібниці → тільки картка.

**Архітектурний результат B-96:**
- Одна картка "Здоровʼя" за замовчуванням, не замотлошена сітка десятків вузьких папок.
- Нотатки залишаються корисними — тільки значущі записи для перегляду, не спам.
- Сова має чіткі правила у промпті коли створювати нові картки і коли дублювати у Нотатки.

**Файли 3-х додаткових комітів:** `src/ai/prompts.js` (getHealthChatSystem повністю переписаний), `src/ai/tool-dispatcher.js` (handler add_health_history_entry + імпорти), `sw.js` (CACHE_NAME × 3), `bundle.js`, `NEVERMIND_BUGS.md` (B-94/B-95 у закриті, B-96 додано), `_ai-tools/SESSION_STATE.md`.

**Відкрите у новий чат:**
- 🧪 iPhone v343+ тест B-96 — повний сценарій (разовий симптом → тільки картка; тривалий → картка + нотатка).
- 🎯 Шар 2 — єдине табло `nm_owl_board_unified` з призмою вкладки (наступна сесія).
- 🎯 Шар 3 — розширення `getAIContext()` хвостами чатів (після Шару 2).

---

## 2026-04-20 — 🟡 B-93 закритий, B-94/B-95 два провали → архітектурний фікс у новій сесії (EWxjG)

**Контекст:** Сесія починалась з плану закрити 3 баги з iPhone-тесту v325 (B-93, B-94, B-95). B-93 закритий з першого разу (CSS). B-94/B-95 отримали два промпт-підходи — обидва провалились на iPhone. Встановлено що корінь архітектурний — потрібен Шар 1 "Один мозок V2" (CRUD як справжні OpenAI tools у чаті Здоров'я).

**Зроблено (3 коміти на гілці `claude/start-session-EWxjG`):**

**1. B-94/B-95 підхід №1 — промпт-жорсткий блок (коміт `379f13e`).** У промпт `src/tabs/health.js` одразу після "OWL НЕ ЛІКАР" доданий блок "🚫 ЖОРСТКЕ ПРАВИЛО UI-TOOLS У ЗДОРОВ'Ї" з whitelist тригерів навігації + явною забороною: "Алергія на X" → `add_allergy`, "Завтра прийом о HH" → `create_event`. **Результат на iPhone v337:** не спрацювало. "Алергія на пил" → "Характер OWL: Партнер" 3 рази поспіль. "Прийом до лікаря завтра на 14" → так само "Партнер".

**2. B-93 — CSS fade у чат-вікні (коміт `9f80341`).** Чіпи-кнопки у Inbox chat обрізались знизу бо `.ai-bar-messages` мала `mask-image` з прозорою нижньою зоною 16px. Чіпи останнім елементом попадали у fade. Фікс: прибрана нижня точка fade (mask лишається тільки згори), `padding-bottom` 20→28px. Глобально для всіх 8 чатів. Працює з першої спроби.

**3. B-94/B-95 підхід №2 — history detox + прибраний конфлікт (коміт `6fa67e2`).** Глибша діагностика: (а) наприкінці промпту Здоров'я лишався `${UI_TOOLS_RULES}` який дублював/конфліктував з новим блоком — прибрано; (б) коли AI помилково викликав UI-tool, acknowledgement ("Характер OWL: Партнер") писався у `healthBarHistory` → AI бачив паттерн і копіював себе 3 рази поспіль. Додано `healthBarHistory.pop()` після обробки UI-tool — acknowledgement лишається в UI/storage, але не у контексті для AI. **Результат на iPhone v338 (скрін 23:14-23:15):** гірше ніж раніше. "Алергія на пил" → "Фінанси: місяць". "Завтра прийом у лікаря" → 10 викликів `set_owl_mode(mentor)` в одній відповіді моделі.

**Висновок (переосмислення з Романом):** корінь архітектурний. У чаті Здоров'я UI-tools — справжні функції OpenAI, а CRUD (add_allergy/create_event/add_health_history_entry) — JSON у тексті. GPT-4o-mini завжди обирає реальну функцію над текстом-JSON коли обидві опції доступні. Жоден промпт не перепише це. Pre-filter (передавати порожній tools list) — костиль, Роман відкинув.

**Справжнє рішення:** **Один мозок V2 Шар 1** з ROADMAP — мігрувати CRUD чату Здоров'я (і Finance/Projects теж) на повний `INBOX_TOOLS` через OpenAI tool calling. Тоді `add_allergy` і `set_owl_mode` для моделі однорівневі → промпт починає працювати. Виконати у наступній сесії.

**Файли (3 коміти):** `src/tabs/health.js` (+16 рядків блок, прибраний `${UI_TOOLS_RULES}`, додано `healthBarHistory.pop()`, прибраний невикористаний імпорт); `style.css` (`.ai-bar-messages` mask + padding); `sw.js` (CACHE_NAME bump ×3); `bundle.js`; `NEVERMIND_BUGS.md`; `_ai-tools/SESSION_STATE.md`.

**Відкрите у новий чат:**
- 🔴 B-94 і B-95 — повертаю у Критичні. Промпт-підхід не закриває. Наступний чат — Шар 1 "Один мозок V2" для чату Здоров'я.
- ✅ B-93 закритий остаточно (CSS-фікс простий і ізольований).
- Контекст чату 90% → нова сесія з свіжим мозком.

---

## 2026-04-20 — 🎯 9 багів з iPhone-тесту v322 + Один мозок parity (сесія NRw8G)

**Контекст:** Почалось як звичайна сесія — Роман давав iPhone-скріншоти по одному і просив записати кожен баг у NEVERMIND_BUGS.md. Виявлено 9 багів, всі закриті за 8 комітів. Плюс один parity-коміт для "Один мозок" (save_memory_fact у 3 text-JSON чатах).

**Зроблено (9 комітів):**

**1. B-87 — регекс чіпів (коміт `8aebb3a`).** Старий `/\{[\s\S]*?"chips"[\s\S]*?\}/g` жадібно-лазливий: ріс на першому `}` після "chips" всередині чіп-об'єкта → решта `{...}]}` лишалась як сміття у бульбашці. Виніс helper `parseContentChips` у `src/core/utils.js` з depth-tracking (балансує фігурні дужки з урахуванням рядків у лапках). Inbox + evening-chat тепер делегують. Дубляж усунено. JvzDi позначав B-83 закритим — фікс не тестувався локально.

**2. B-90 — темна тема галюцинація (коміт `ffba291`).** Після видалення `set_theme` у JvzDi, AI все одно казав "зроби це у налаштуваннях застосунку" — вигадка. Додав блок "НЕДОСТУПНІ ФУНКЦІЇ" у спільний `UI_TOOLS_RULES`: "темна тема / dark mode / нічний режим / шрифт" → чесна "Поки немає, з'явиться пізніше". Пропагується у всі 8 чатів.

**3. B-92 — модалка Пам'ять свайп (коміт `256330f`).** `openMemoryModal` у `nav.js` не підключав `setupModalSwipeClose`. Додав виклик на внутрішню панель.

**4. B-91 — "Запам'ятай" тригер (коміт `474a1f7`).** Корінь — старий приклад у промпті "алергія на горіхи → save_task (купити безглютенову піцу) + save_memory_fact" активно вчив AI створювати задачі-протилежність. Юзер "Запам'ятай що я не їм глютен" → AI створив задачу "купити безглютенову піцу". Переписав секцію ПАМ'ЯТЬ у `INBOX_SYSTEM_PROMPT`: ЖОРСТКИЙ ТРИГЕР — "Запам'ятай / Запиши що / Знай що + X" → ТІЛЬКИ save_memory_fact, БЕЗ інших tools. Явна заборона галюцинацій: "не їм X" ≠ "купити X-free".

**5. B-84/85/86/88 — Здоров'я чат пакет (коміт `058cd9d`):**
  - **B-85 семантика:** ЖОРСТКИЙ БЛОК переписано — **А) медичне питання** → шаблон "не лікар"; **Б) опис симптому/факту** → `add_health_history_entry` у активну картку або `create_health_card`. Коротке підтвердження без діагнозу.
  - **B-84 алергії:** `add_allergy`/`delete_allergy` у промпт + handlers у `_processOne`.
  - **B-86 події:** жорсткі правила CREATE vs EDIT. "новий прийом" → завжди `create_event`. `edit_event` тільки на явне "перенеси/зміни час". Заборона UI-tools на реченнях про події.
  - **B-88:** мертвий `log_health` прибрано.

**6. B-89 — handle touch-zone (коміт `3b08d2c`).** `.ai-bar-chat-handle` padding 12+10 (~22px) → 20+16 (~40px). Візуал `::after` не змінився. Глобально для всіх 8 чатів.

**7. Parity — save_memory_fact у 3 text-JSON чатах (коміт `9200411`).** Аудит показав: Finance/Health/Projects не мали дії `save_memory_fact`. Додав у промпт + handler у `_processOne` (викликає `addFact`). Тепер "Запам'ятай" працює з будь-якого чату.

**8. CACHE_NAME bump:** `nm-20260419-2027` → `nm-20260420-1120`.

**Обговорено/прийнято:**

- **Helper у utils > локальні копії.** Дубляж 7-рядкового блоку з однаковим багом у 2 файлах — шлях до "фіксимо в N місцях". Виніс один раз.
- **Промпт-семантика > лише handler'и.** Якщо AI не знає коли викликати — handler мертвий. Для Здоров'я переписав і правила, і додав інструменти.
- **save_memory_fact у 3 чатах — parity малою ціною.** Одна дія у кожний чат замість повної міграції на INBOX_TOOLS. 80% value за 20% коду.
- **Handle 40px без зміни візуалу — мінімально-інвазивний UX фікс.**
- **Приклади у промпті важливіше ніж правила.** Старий неякісний приклад "алергія → купити піцу" рікошетив у галюцинацію з новим запитом. Нова секція ПАМ'ЯТЬ має тільки безпечні приклади.

**Файли змінені:**
- `src/core/utils.js` — новий helper `parseContentChips`
- `src/core/nav.js` — swipe close на Memory modal
- `src/ai/prompts.js` — блок НЕДОСТУПНІ ФУНКЦІЇ + переписано ПАМ'ЯТЬ
- `src/tabs/inbox.js` + `src/tabs/evening-chat.js` — делегування на `parseContentChips`
- `src/tabs/health.js` — переписано промпт + 5 нових handlers + save_memory_fact
- `src/tabs/finance-chat.js` + `src/tabs/projects.js` — save_memory_fact
- `style.css` — touch-zone handle 22→40px
- `sw.js` — CACHE_NAME bump
- `NEVERMIND_BUGS.md` — 9 багів у Закритих (секція NRw8G)
- `_ai-tools/SESSION_STATE.md` — секція NRw8G з детальним описом

**iPhone-тест v325 після мержу (той самий день):**
- ✅ switch_tab / open_memory працюють (навігація ОК).
- ❌ B-93 Чіпи обрізані у Inbox chat — видно тільки верхній край (layout issue).
- ❌ B-94 "Алергія на пил" у Здоров'ї → AI викликав `set_owl_mode(Наставник)` замість `add_allergy`.
- ❌ B-95 "Завтра прийом у лікаря на 2" у Здоров'ї → AI викликав `switch_tab(calendar)` замість `create_event`. B-86 фікс не покрив цей UI-tool.
- Усі 3 баги записані у `NEVERMIND_BUGS.md` для наступного чату.

**Обговорено після тесту — концепція "Один мозок V2":** Роман сформулював цілісну архітектуру мозку замість поточних 8+8 ізольованих систем. Три шари: (1) паритет дій у всіх чатах через повний INBOX_TOOLS, (2) одне табло з призмою вкладки замість 8 дубльованих, (3) спільна історія розмов з event tab-switch. Додано у `ROADMAP.md` як новий 🚀 Active (коміт `a7a8993`), заміщує стару "Один мозок #2 A".

**Наступні кроки:**
- B-93/94/95 у новому чаті — 30-60 хв промпт+layout фіксів.
- "Один мозок V2" Шар 1 — паритет дій у 8 чатах (1-2 сесії).
- Шари 2+3 — єдине табло + спільна історія (2 сесії).
- Я 65→100% або Проекти 65→100% з ROADMAP.

---

## 2026-04-19 — 🧭 3 фікси з iPhone-тесту v307 + знайдено "Один мозок" (сесія JvzDi)

**Контекст:** Почалось як продовження 6GoDe — тест на iPhone v307 перевірив всі 8 існуючих UI tools. Знайдено 3 реальні баги і один великий архітектурний запит. 3 баги виправлено за 2 коміти. Великий запит ("Один мозок" — UI tools тільки в Inbox, 7 інших чатів ізольовані) відкладено у наступну сесію через заповнений контекст (~90%) і розмір задачі (~60 хв, 7 файлів).

**Зроблено:**

**1. Жорстке правило `switch_tab` у промпті — коміт `240a0b5`.** iPhone-тест: "Відкрий задачі" у Inbox чаті інтерпретувалось як save_task з title="задачі". Переписав UI TOOLS секцію у `INBOX_SYSTEM_PROMPT` як ЖОРСТКЕ правило з прикладами: повідомлення що починається з "відкрий/покажи/перейди до + назва вкладки" → ЗАВЖДИ switch_tab, НЕ save_task.

**2. Видалено плацебо `set_theme` — коміт `240a0b5` (той самий).** iPhone-тест: "Зроби темну тему" → сова "Темна тема." але нічого не змінилось. Причина: `applyTheme()` у `nav.js` лише фарбує колір таб-бару за поточною вкладкою, глобальної темної теми не існує. Прибрав визначення з `UI_TOOLS`, case з `handleUITool`, рядок з промпту, невикористаний імпорт. 47 tools → 46.

**3. Портовано парсер чіпів `_parseContentChips` у Inbox chat — коміт `0bf3d37`.** iPhone-тест: "Болить горло 2 дні" → сова питає "Коли почалося?" з варіантами текстом у дужках замість кнопок. Health-інтерв'ю промпт (6GoDe) обіцяв чіпи, але Inbox chat не мав парсера JSON блоку `{chips:[...]}`. Портував з evening-chat: розширив `addInboxChatMsg` параметром chips, додав `_parseContentChips` helper, 3 точки показу msg.content тепер парсять і рендерять чіпи як `<div class="chat-chips-row">` під бульбашкою. У промпті: приклад Health-інтерв'ю з JSON + загальне правило ФОРМАТ ЧІПІВ (2-4 чіпи, label до 3 слів, action "chat").

**4. CACHE_NAME bump:** `nm-20260419-1912` → `nm-20260419-1951`.

**Обговорено/прийнято:**

- **Великий архітектурний запит "Один мозок" (Роман):** UI tools підключені тільки в Inbox, 7 інших чатів ізольовані. Треба два рівні: (1) мінімум — UI tools у всі 7 чатів (1 сесія, 60 хв); (2) повний — переробити 7 чатів на повний INBOX_TOOLS (2-3 сесії, пункти 4.9+4.10 ROADMAP). Виведено у `ROADMAP.md` як новий 🚀 Active.
- **Прибрати > додати:** між "додати dark theme зараз" і "прибрати плацебо `set_theme` до того як зробимо" — обрали друге. Плацебо-tool руйнує довіру гірше ніж відсутність фічі.
- **Портувати > винайти:** `_parseContentChips` з evening-chat — перевірений патерн з 8 фаз MVP Вечора. Принцип "один двигун".

**Файли змінені:**
- `src/ai/prompts.js` — UI TOOLS секція жорстке правило, видалено `set_theme`, приклад Health-інтерв'ю з JSON, загальне правило ФОРМАТ ЧІПІВ
- `src/ai/ui-tools.js` — видалено `set_theme` визначення + case + імпорт applyTheme
- `src/tabs/inbox.js` — +`chips` параметр у `addInboxChatMsg`, +`_parseContentChips`, +`renderChips`/`extractJsonBlocks` імпорти, 3 точки msg.content парсять чіпи
- `sw.js` — CACHE_NAME bump

**Метрики:** 2 коміти (`240a0b5` → `0bf3d37`), v307 → v308+ (після мержу), CACHE_NAME `nm-20260419-1951`, build локально зелений.

**Відкриті проблеми:**
- "Один мозок #1 мінімум" — новий 🚀 Active у ROADMAP на наступну сесію
- Глибша проблема — чат Задач замкнений на задачну логіку в промпті ("Болить горло 3 дні" → "Що саме виснажило?") — окрема задача після "Один мозок"

---

## 2026-04-19 — 🌙 Вечір 2.0: планування концепції + Фаза 0 рефакторингу (сесія QV1n2)

**Контекст:** Роман відкрив Вечір о 14:12 і побачив "0% Важкий день" — вкладка демотивує посеред робочого дня. Провели повний аудит (5 проблем) і переробили концепцію на **ритуал закриття дня з OWL** замість dashboard'у з цифрами. Потім виконали Фазу 0 рефакторингу — розбили `evening.js` (1054 рядки, змішував Я + Вечір) на 5 сфокусованих модулів.

**Що зроблено:**

**1. Стратегічне планування (4 коміти документації):**
- Створено `docs/EVENING_2.0_PLAN.md` (544 рядки) — джерело правди для переробки: 10 блоків концепції, 8 фаз на 3 сесії, 3 живі сценарії діалогів, тригери+cooldowns, success metrics, failure modes, перехресні посилання з 14 пунктами ROADMAP
- `ROADMAP.md` — новий блок у 🚀 Active з 8 фазами + посиланням на PLAN; старий блок "Вечір 70→100%" у Блок 2 замінено на пойнтер
- `CONCEPTS_ACTIVE.md` — секція "🌙 Вечір" переписана на v2 (ритуал після 18:00, OWL пише першою, 2 CTA кнопки замість форм, чіпи у діалозі, автосинх)
- `_ai-tools/SESSION_STATE.md` — оновлено "Для нового чату" (Active = Вечір 2.0 Сесія 1) + повний опис QV1n2
- `CLAUDE.md` — додано `docs/EVENING_2.0_PLAN.md` у Карту документації

**2. Фаза 0 рефакторингу `src/tabs/evening.js` (2 коміти):**

*Крок 1 (`2e99b34`)* — винесення вкладки Я:
- Новий `src/tabs/me.js` (480 рядків): `renderMe`, `renderMeActivityChart`, `refreshMeAnalysis`, `renderMeHabitsStats`, `sendMeChatMessage`, `addMeChatMsg`
- `evening.js` 1054 → 587 рядків
- Імпорти оновлено у 5 файлах (nav/boot/habits/chips/core.js) — **прямі імпорти** замість re-exports щоб уникнути циклічних залежностей

*Крок 2 (`e996f0b`)* — чат + універсальний бейдж + заготовка:
- Новий `src/tabs/evening-chat.js` (204 рядки): `sendEveningBarMessage`, `addEveningBarMsg`, `openEveningDialog`, `closeEveningDialog`, `sendDialogMessage`
- Новий `src/ui/unread-badge.js` (67 рядків): універсальна червона крапка — `showUnreadBadge(tab, sendBtnId)` + `clearUnreadBadge(tab)` + `getUnreadCount(tab)` у in-memory Map
- Новий `src/tabs/evening-actions.js` (30 рядків заготовка): пустий `EVENING_TOOL_HANDLERS` для Фази 7
- `evening.js` 587 → 413 рядків
- `inbox.js` — `_showInboxUnreadBadge` замінено на універсальний `showUnreadBadge('inbox', 'ai-send-btn')`; `_clearInboxUnreadBadge` залишено як wrapper над `clearUnreadBadge('inbox')` для backward-compat з `ai/core.js`
- Імпорти `addEveningBarMsg` і `sendEveningBarMessage` перенаправлені з `evening.js` → `evening-chat.js`

**Ключові рішення:**

- **Ритуал після 18:00, не дашборд.** Вкладка блокується матовим склом до 18:00 (вирішує проблему "0% Важкий день" вдень). Автовідновлення о 23:59.
- **Дві кнопки 📅/📔 замість полів вводу.** Живий діалог замість форм — принцип "мінімальне тертя" у найчистішому вигляді.
- **Пілотуємо один чат перед міграцією 7-ми.** Варіант B (прогресивна міграція) проти варіанту A (все одразу). Після стабільного Вечора міграція Tasks/Habits/Notes/Finance/Health/Projects/Я на новий двигун — окремими сесіями.
- **3-рівнева документація.** ROADMAP компактний → `docs/EVENING_2.0_PLAN.md` детальний → `CONCEPTS_ACTIVE.md` для юзерського світу. Jarvis-рівень організації.
- **Окремий файл плану, не все в ROADMAP.** Аналог `docs/AI_TOOLS.md` — джерело правди для великої задачі живе окремо.
- **Прямі імпорти у рефакторингу.** Re-export з evening.js ризикував би циклічною залежністю evening.js ↔ evening-chat.js. Прямі імпорти в 6 файлах — чистіше.

**Інциденти:**

- **Без reset/force push. 6 чистих комітів** прямо у `claude/start-session-QV1n2`.
- **Stop hook на незакоммічений `bundle.js`** після push — вирішено `git checkout -- bundle.js` (bundle локально не комітимо, CI генерує при мержі у main).
- **Edit конфлікт "SECTION:renderMe"** у skeleton `me.js` — два маркери з однаковим префіксом. Вирішено через об'єднаний Edit для двох сусідніх секцій.
- **Контекст дійшов до 90%+** наприкінці — викликали `/finish` у режимі UPDATE щоб підготувати файли до нового чата.

**Обговорено (без виконання):**

- **8 концепцій з ROADMAP** які підсилять Вечір у Фазах 3/7/8 — прописані у PLAN: 4.6 Contextual Personality Shifts (`reflecting`), 4.12 Антидублювання, 4.21 Verify Loop, 4.31 Episode Summary Layer, 4.34 Memory Echo, 4.41 Mirror Mode, G4 Shadowing, G13 Brain Dump
- **Post-MVP фічі** — спецрежим неділі, автомоменти з подій, інтелект-карта дня, голосове слухати підсумок, міграція інших чатів на універсальний двигун
- **Блокери** — Динамічний розпорядок дня (2-3 сесії, 6 відкритих питань дизайну) блокує повну автосинхронізацію у Фазі 7. MVP — простий текстовий блок.

**Файли:**

*Створені (5):*
- `docs/EVENING_2.0_PLAN.md` — 544 рядки
- `src/tabs/me.js` — 480 рядків (винесено з evening.js)
- `src/tabs/evening-chat.js` — 204 рядки (винесено з evening.js)
- `src/tabs/evening-actions.js` — 30 рядків (заготовка Фази 7)
- `src/ui/unread-badge.js` — 67 рядків (винесено з inbox.js)

*Змінені (12):*
- `ROADMAP.md`, `CONCEPTS_ACTIVE.md`, `CLAUDE.md`, `_ai-tools/SESSION_STATE.md` — документація Вечора 2.0
- `src/tabs/evening.js` — 1054 → 413 рядків (core only)
- `src/tabs/inbox.js` — використовує universal unread-badge
- `src/app.js` — додано imports me/evening-chat/evening-actions/unread-badge у правильному порядку
- `src/core/nav.js`, `src/core/boot.js`, `src/ai/core.js`, `src/owl/chips.js`, `src/tabs/habits.js` — імпорти me.js окремо від evening.js

**Метрики:** 6 комітів (`7798595` → `5c1b479` → `ccb1483` → `a901450` → `2e99b34` → `e996f0b`), **v288 на проді** (нові версії згенеруються після мержу в main), CACHE_NAME без змін `nm-20260419-1131` (чекає Фази 1). Гілка `claude/start-session-QV1n2`. Build локальний зелений.

**Наступний крок:** Фази 1-3 Сесії 1 Вечора 2.0 (блокування до 18:00 + getEveningContext + evening-prompt тригер) за окремим "Роби" у новому чаті.

---

## 2026-04-19 — 🗑️ Повний відкат маскот-сови в Inbox до емодзі 🦉 (сесія rSTLV)

### Контекст
Експерименти 18-19.04.2026 (сесії KTQZA → w3ISi → uDZmz → NFtzw) додали PNG-маскот, sprite-sheet, SVG-крило, priority state-machine і 5-frame flipbook махання. Результат на v284/v285 — махання не спрацьовує, запечений шаховий фон у PNG. Роман вирішив: анімація складна, результат не виправдовує часу. Повернути Inbox до простого емодзі 🦉 як у всіх інших вкладках.

### Видалено (ПОВНИЙ ПЕРЕЛІК щоб потім знайти якщо щось зламається)

**1. HTML `index.html:275-287` (13 рядків):**
- Блок `<div class="owl-mascot" id="owl-mascot-main" data-state="idle">` з **10 `<img>`** всередині (5 `.owl-mascot-frame` для idle/alert/thinking/greeting/error + 5 `.owl-wave-frame` для кадрів махання)
- **Замінено на:** простий `<div class="owl-speech-avatar">🦉 ... </div>` (api-dot індикатор залишився)

**2. CSS `style.css:1271-1356` (~85 рядків):**
- `.owl-mascot` (position + `animation: owl-float 4s`)
- `@keyframes owl-float` (колихання -4px)
- `.owl-mascot-frame` (position, opacity, transition)
- Селектори `.owl-mascot[data-state="..."] .owl-mascot-frame[data-frame="..."]` (5 станів)
- `prefers-reduced-motion` правила для маскота (2 блоки)
- `.owl-mascot.is-paused` (pause-animation при PWA у фоні)
- `.owl-mascot[data-state="thinking"] ... animation: owl-head-tilt` + `@keyframes owl-head-tilt` (нахил голови 8°)
- `.owl-wave-frame` (position, opacity, z-index)
- 5 `.owl-mascot[data-state="greeting"] .owl-wave-frame[data-wave="1..5"]` animation rules
- `@keyframes owl-wave-1..5` (по opacity 0/1 з кроком 20%)
- Коментарі "GREETING WAVE FLIPBOOK", "Статичний greeting PNG як fallback"

**3. JS `src/owl/board.js:139-202` (~50 рядків):**
- Рядок 140: `if (tab === 'inbox') setOwlMascotState('alert', 12000);` у `_renderTabBoard` (виклик alert при новому board повідомленні в Inbox)
- Блок 158-202: **вся priority state-machine** — `OWL_PRIORITY = { error: 100, alert: 80, thinking: 60, greeting: 40, idle: 0 }`, функція `setOwlMascotState(state, autoRevertMs)` з ticket-лічильником і failsafe 30с, `visibilitychange` listener (додає/прибирає `.is-paused`), `Object.assign(window, { setOwlMascotState })`

**4. JS `src/core/boot.js:398-401` (4 рядки):**
- `setTimeout(() => { try { window.setOwlMascotState && window.setOwlMascotState('greeting', 6000); } catch {} }, delay + 1500);` — one-shot greeting на 6 сек при старті застосунку

**5. JS `src/ai/core.js` у функції `_fetchAI` (4 try/catch виклики, ~10 рядків):**
- Рядок 338: `setOwlMascotState('thinking')` перед fetch
- Рядок 349: `setOwlMascotState('error', 6000)` при HTTP помилці
- Рядок 354: `setOwlMascotState('idle')` після успішної відповіді
- Рядок 361: `setOwlMascotState('error', 6000)` у catch (re-throw)
- Зовнішній try/catch блок прибрано (fetch throws тепер bubble up напряму)

**6. Файли у `assets/owl/` (11 PNG ~16.4 MB загалом):**
- `owl-idle.png`, `owl-alert.png`, `owl-thinking.png`, `owl-greeting.png`, `owl-error.png` (5 станів, amber/brown палітра від Романа)
- `owl-greeting-sprite.png` (1536×256 sprite 6 кадрів)
- `frame-1.png` … `frame-5.png` (5 кадрів махання, Nano Banana, 8.6 MB)
- **Папка `assets/owl/` видалена повністю, папка `assets/` теж (була порожня)**

**7. Папка `handoff/` (повністю):**
- `handoff/README.md` (опис handoff пакету)
- `handoff/OWL_ANIMATION_PLAN_V2.md` (V2 план — 4 фази Nano Banana, 219 рядків)
- `handoff/OWL_ANIMATION_RESEARCH.md` (Rive vs Lottie vs CSS/PNG, 177 рядків)
- `handoff/components/Owl.html`, `Owl.js`, `OwlReact.jsx`, `Owl.css` (приклади інтеграції)

**8. `sw.js:10` — CACHE_NAME bump:**
- `nm-20260419-1044` → `nm-20260419-1131`

**9. `CLAUDE.md` — секція "Анімація OWL (TODO)" скорочена:**
- Прибрано 4 блоки ("Рішення", "Заблоковано", "Варіант 3 Gemini", "Поведінка сови без бабла")
- Замінено на короткий опис "відкладено" + коли повертатись

**10. `ROADMAP.md` — два блоки секції "Done" 19.04.2026 (NFtzw + uDZmz) замінено на один підсумковий запис rSTLV про видалення**

### Історичні коміти з яких видалявся код (якщо захочеш відновити конкретний шматок)

| Коміт | Що робив | Де можна подивитись |
|-------|----------|---------------------|
| `a58104b` | Базова інтеграція PNG-маскот (idle state, float 4s) | `git show a58104b` |
| `53e64fd` | Автоматична зміна станів alert/thinking/error | `git show 53e64fd` |
| `4d98985` | Перенесено PNG у `assets/owl/` | `git show 4d98985` |
| `ac274fd` | Sprite 1536×256 + boot auto-trigger greeting | `git show ac274fd` |
| `5ed8d05` | Priority state-machine + visibilitychange pause | `git show 5ed8d05` |
| `585cbbd` | SVG-крило overlay + `@keyframes wing-wave-premium` | `git show 585cbbd` |
| `e4bba2d` | Debug червона рамка (вже прибрано у NFtzw) | `git show e4bba2d` |
| `a49d1eb` | Upload: `1.png`, `2.png` → перейменовані | `git show a49d1eb` |
| `3ffd627` | Перейменування: 2→owl-idle, 1→owl-greeting | `git show 3ffd627` |
| `6266c17` | 5-frame flipbook skeleton (wave-frame + @keyframes) | `git show 6266c17` |
| `7e5b479` | Fallback — не ховати статичний greeting при broken wave | `git show 7e5b479` |
| `adf508f` | Fix path: `wave/frame-*` → `frame-*` | `git show adf508f` |
| `215a8f7` | Upload Романа: 5 frame-*.png | `git show 215a8f7` |

### Як відновити якщо раптом треба

1. **Повний відкіт повернути:** `git revert 897bc9a` (цей коміт видалення)
2. **Тільки один коміт повернути:** `git cherry-pick <hash>` з таблиці вище
3. **Конкретний файл з конкретного коміта:** `git checkout <hash> -- <path>`
4. **Переглянути старий стан без змін:** `git show <hash>:<path>`

### Файли які залишились без змін (щоб зекономити час пошуку)

- `src/owl/chips.js`, `src/owl/proactive.js`, `src/owl/inbox-board.js`, `src/owl/followups.js` — ВСІ інші OWL-модулі не зачеплені
- `src/owl/board.js` — тільки прибрано рядок 140 (alert-виклик) і блок 158-202 (state-machine). Функціональність OWL Tab Boards (рендер, свайпи, чіпи) ЗБЕРЕЖЕНА повністю
- `src/ai/core.js` — тільки прибрано 4 виклики `setOwlMascotState` у `_fetchAI`. Вся решта AI-логіки (`callAI`, `callAIWithHistory`, `callAIWithTools`, `callOwlChat`, chat storage, tool calling) НЕ ЗАЧЕПЛЕНА
- `src/core/boot.js` — прибрано тільки один `setTimeout` з greeting-тригером. Вся решта boot-логіки (PWA, cross-tab sync, SW registration, splash) ЗБЕРЕЖЕНА
- Всі 8 вкладок (`tabs/*.js`), ai/prompts/memory/ui-tools, chips logic, trash, calendar — **НЕ ЗАЧЕПЛЕНО**
- Скіл `.claude/commands/owl-motion.md` — НЕ видаляв (лежить у скілах на випадок повернення до анімації)

### Метрики
- **Коміти:** `897bc9a` (код+ассети) → `d29a595` (handoff + основні доки) → `77f59ba` (аудит — позначки ⏸️ на всіх згадках `/owl-motion`). **3 коміти.**
- **Файлів змінено:** 12 (код: index.html, style.css, sw.js, src/owl/board.js, src/core/boot.js, src/ai/core.js + доки: CLAUDE.md, ROADMAP.md, START_HERE.md, SESSION_STATE.md, SKILLS_PLAN.md, NEVERMIND_BUGS.md, .claude/commands/owl-motion.md)
- **Файлів видалено:** 19 (11 PNG у `assets/owl/` + 4 handoff top-level + 4 handoff/components/*)
- **Рядків видалено:** ~650 (код) + ~472 (документація) = **~1120 рядків**
- **CACHE_NAME:** `nm-20260419-1044` → `nm-20260419-1131`

### Відкладено
- **Анімація сови повністю** — повернемось коли буде нормальний художній ассет (багатошарова SVG або Rive). До того — текстовий 🦉 на всьому застосунку.

---

## 2026-04-19 — 🦉 Owl animation Phase 0 + research + V2 plan (сесія NFtzw)

### Контекст
Після сесії uDZmz залишився debug-блок у `style.css` (SVG-крило з червоною пунктирною рамкою, вічне махання). Роман попросив глибоке дослідження інших підходів до анімації + план на ранок. Результат: відмовились від Fiverr-дизайнера ($100-200), обрали самостійний шлях через Nano Banana (Gemini AI image editor зі збереженням персонажа) покадрово. Фаза 0 очищення debug + підготовка 5-frame flipbook skeleton виконана у коді.

### Зроблено

**1. Дослідження анімаційних підходів — `handoff/OWL_ANIMATION_RESEARCH.md` (177 рядків)**
- Порівняння CSS/PNG (5 МБ, стеля 6/10), Lottie (240 КБ, 17 FPS, без state machine), Rive (16 КБ, 60 FPS, 1:1 до нашого priority).
- Індустріальне джерело: Duolingo перейшли з Lottie на Rive саме через такі ж обмеження як у нас.
- 3 початкові tier'и з чесними tradeoff'ами.

**2. V2 план — самостійний шлях — `handoff/OWL_ANIMATION_PLAN_V2.md` (219 рядків)**
- Відмова від Fiverr дизайнера. Принцип: усе самі з AI-сервісами.
- 4 фази: 0 стабілізація → 1 Nano Banana покадрово (22 кадри × 4 анімації) → 2 вторинна анімація завжди → 3 Rive editor learning паралельно.
- Base prompt + 8 add-on промптів + 3 gap-fill.
- Skill tree для Романа і Claude.

**3. Фаза 0 у коді**
- `style.css`: прибрано `.owl-wing-overlay` + debug outline + `@keyframes wing-wave-premium`. Додано `.owl-wave-frame` + `@keyframes owl-wave-1..5` (600мс, `steps(1,end)`).
- `index.html`: прибрано `<svg class="owl-wing-overlay">`, додано 5 `<img data-wave="1..5">` що вказують на `assets/owl/wave/frame-{1..5}.png`.
- Fallback: статичний `owl-greeting.png` не ховається — broken-img wave-PNG не створює порожнечі.
- `sw.js`: `CACHE_NAME nm-20260419-0438` → `nm-20260419-0918`.

**4. Workflow Nano Banana задокументовано**
- Compound degradation проблема: якість падає з кожною послідовною правкою. Рішення — завжди оригінал idle PNG як референс, НЕ чейнити.
- Bg-removal pipeline: `erase.bg` як топ (5000×5000 безкоштовно), відкинуто remove.bg (ріже до 500px), Canva (Pro only), Claude Design (артефакти).
- Промпт-хак "green/black screen" для чистого фону.

### Обговорено (без виконання)

- **Rive learning trek** — паралельний, 3-4 сесії × 45 хв на ноутбуці. Після Nano Banana покадрово — як майбутній upgrade-шлях.
- **5 vs 8 кадрів** — вирішили стартувати з 5 (що вже генерує Роман). Якщо flipbook виглядатиме надто різко — 3 gap-fill промпти у чаті.
- **Секвенційна генерація кадрів** замість сітки — кожен кадр на 1024×1024 замість ~340×340 у мозаїці.

### Ключові рішення

- Відмова від Lottie і зовнішнього дизайнера — Роман прямо попросив "побудуй план де ми самі навчимося і зробимо все самі з допомогою сервісів".
- Покадрова PNG — основний шлях, Rive — майбутнє.
- Fallback у CSS greeting — не ховати статичний PNG, щоб broken-img не давав порожнечу.

### Інциденти

- **2× stream idle timeout** під час першого Write на `OWL_ANIMATION_RESEARCH.md` — перейшов на компактніший (177 рядків) single-Write.
- **Гілка нестандартного формату** — `claude/owl-animation-research-NFtzw` (Claude Code runtime створив під задачу, не `start-session-NFtzw`).
- **Stop hook push** — після Фази 0 наполягав на push. Додав fallback щоб не ризикувати порожнечею greeting на продакшені, пушнув.
- Без reset/force push. 4 коміти чистих + docs коміти.

### Файли

- `handoff/OWL_ANIMATION_RESEARCH.md` — новий, дослідження
- `handoff/OWL_ANIMATION_PLAN_V2.md` — новий, план
- `style.css` — прибрано SVG-крило debug, додано flipbook CSS
- `index.html` — 5 нових `<img>` wave-frames, прибрано `<svg>` крила
- `sw.js` — CACHE_NAME bump
- `assets/owl/wave/` — нова папка (порожня, чекає на 5 PNG)
- `_ai-tools/SESSION_STATE.md` — ротація w3ISi → архів, NFtzw вгорі
- `_archive/SESSION_STATE_archive.md` — додано w3ISi
- `ROADMAP.md` — запис NFtzw у Done
- `docs/CHANGES.md` — цей запис

### Оновлення після першого /finish

- Роман залив 5 PNG через GitHub Web **без `wave/` префіксу** (коміт `215a8f7`) — HTML очікував `assets/owl/wave/frame-*.png`.
- **Швидкий фікс шляху** (коміт `adf508f`): прибрано `wave/` з `<img src>` у `index.html`, PNG тепер у `assets/owl/` разом з іншими `owl-*.png`. CACHE_NAME bump до `nm-20260419-1044`.
- **Деплой v284** на production (12:45) — підтверджено `git fetch`.
- **Тестування на телефоні v284:**
  - ⚠️ **Махання крилом не спрацьовує** — сова залишається idle. Гіпотеза: priority state-machine з uDZmz блокує greeting (alert=80 перебиває boot-тригер greeting=40 який активується через 1.5 сек після старту).
  - ⚠️ **Шахові клітинки ліворуч від сови** — запечений шаховий візерунок у PNG (Nano Banana іноді так малює "прозорість"). Треба erase.bg.

### Метрики

- **Коміти:** `f16685b` → `af90d41` → `6266c17` → `7e5b479` → `c59eacd` → `bdd610e` → `adf508f` (+ коміт Романа `215a8f7`)
- **Гілка:** `claude/owl-animation-research-NFtzw`
- **Версії:** v277 → v284 на production
- **CACHE_NAME:** `nm-20260419-1044`

---

## 2026-04-18 — 📝 Скіл `/finish` + стиснення CLAUDE.md + хук правил (сесія FMykK)

### Контекст
Роман попросив спростити старт нової сесії — прибрати з активних файлів те що застаріло, зменшити час читання `/start`. BUGS (314) і SESSION_STATE (291) виросли через накопичення історії. Додатково — вирішено стиснути CLAUDE.md (657) і додати автоматичне нагадування правил, бо Claude їх систематично порушує у середині сесії.

### Зроблено

**1. Новий скіл `/finish` (`.claude/commands/finish.md`, 220 рядків)**
- Проектний скіл (живе у репо NeverMind, не глобально)
- 8 фаз: збір контексту → SESSION_STATE → BUGS → ROADMAP → CHANGES → умовні оновлення → коміт+пуш → звіт
- Ідемпотентний: CREATE (ротація) vs UPDATE (оновлення без ротації) визначається через наявність блоку сесії у SESSION_STATE.

**2. Ручна ротація документації (перевірка алгоритму скіла)**
- `NEVERMIND_BUGS.md`: 314→75 рядків. Винесено закриті з cnTkD/W6MDn/acZEu/3229b/6v2eR/jMR6m/старіших у `_archive/BUGS_HISTORY.md` (178 рядків). Видалено секцію "Детальні описи через /gemini" для закритих B-13..B-17.
- `_ai-tools/SESSION_STATE.md`: 290→180 рядків. Винесено KTQZA/gHCOh/cnTkD блоки + Safari zombie-SW довідку + список попередніх сесій у `_archive/SESSION_STATE_archive.md` (126 рядків).
- `_ai-tools/SKILLS_PLAN.md` + `START_HERE.md`: додано `/finish`.
- Правила ротації ("останні 2 активні сесії") додано у шапки BUGS і SESSION_STATE — динамічні, не хардкод імен.

**3. Стиснення CLAUDE.md (657→520, -21%)**
- Створено `docs/TECHNICAL_REFERENCE.md` (202 рядки) з 5 технічними розділами: Система деплою + Cache-bust, AI-логіка (Inbox flow/контекст/OWL Board), Дані localStorage (повна таблиця 30+ ключів), Структури даних (8 JS-типів), Міжмодульні залежності.
- У CLAUDE.md на місці кожної секції — короткий блок (2-5 рядків) з посиланням на TECHNICAL_REFERENCE.
- Оновлено посилання у `START_HERE.md`, `docs/ARCHITECTURE.md`, `.claude/commands/supabase-prep.md`.
- **Правила у CLAUDE.md не чіпано** — тільки довідка винесена.

**4. Хук нагадування правил (`UserPromptSubmit`)**
- `.claude/hooks/rules-reminder.sh` — bash скрипт з лічильником + тригер-словами.
- Нагадує 5 ключових правил CLAUDE.md: розмір відповіді (5-15 рядків), UI-мова (вигляд не назви), глибина (читати код перед оцінкою), без "Роби" не чіпати код, великі файли через skeleton+Edit.
- Спрацьовує: (а) кожне 5-те повідомлення (превентивно), (б) при 11 тригер-словах юзера — "простіше", "коротше", "не розумію", "довго", "технічно", "простирадло", "поясни як людині", "кілометров", "не читаю", "коротко", "скороти".
- Лічильник у `.claude/hook-counter` (gitignore — локальний на кожен пристрій).
- Хук закомічений у `.claude/settings.json` поруч з існуючим `SessionStart` і `PostToolUse` → працює у NeverMind на будь-якому пристрої після `git pull`.

### Обговорено (без виконання)

- ROADMAP.md (624 рядки) — не архівуємо, це план майбутнього. Винесення лише історичних секцій дало б ~90 рядків виграшу (15%) — не варто ризиків.
- CONCEPTS_ACTIVE.md (305) — не чіпаємо, це актуальний опис функціоналу.
- Рефакторинг правил CLAUDE.md (42 правила) — потенційний виграш ~60 рядків, ризик заплутати смисли вищий. Правила всі актуальні.

### Ключові рішення

- Назва скіла: `/finish` (обрав Роман).
- Скіл працює **тільки** у репо NeverMind (проектний рівень), не глобально.
- Ротація архівів — тільки при першому виклику у сесії. Перевірка через наявність блоку сесії у SESSION_STATE.
- `/finish` включає Фазу 6 "Умовні оновлення" (CLAUDE.md/CONCEPTS_ACTIVE/ARCHITECTURE/DESIGN_SYSTEM/SKILLS_PLAN/START_HERE) — Роман підтвердив автоматизацію.
- `/obsidian` і `/finish` — різні скіли.
- **CLAUDE.md: винести довідку, лишити правила.** Виграш 137 рядків без ризику для правил.
- **Хук правил = "лічильник + тригери"** замість чистого лічильника. Ловить і забування (превентивно), і порушення (реактивно).
- **Правила CLAUDE.md не рефакторимо** — виграш малий (~60 рядків), ризик заплутати смисли вищий.

### Інциденти

- **Stream idle timeout** 3-4 рази під час написання скіла, TECHNICAL_REFERENCE, хука. Обхід через skeleton+Edit (правило №1). Прогрес не втрачено завдяки checkpoint-комітам (правило №2).
- **Roman feedback — "кілометрові повідомлення".** Нагадав правило розміру. Результат — створено хук що автоматично нагадує правила.
- Без git reset / force push. Всі зміни normal commits.

### Змінені файли

- `.claude/commands/finish.md` (новий, 220 рядків)
- `NEVERMIND_BUGS.md` (314→75)
- `_archive/BUGS_HISTORY.md` (новий, 178)
- `_ai-tools/SESSION_STATE.md` (290→180)
- `_archive/SESSION_STATE_archive.md` (новий, 126)
- `docs/CHANGES.md` (цей запис)
- `_ai-tools/SKILLS_PLAN.md` (додано `/finish`)
- `START_HERE.md` (додано `/finish` у таблицю скілів + оновлено опис CLAUDE.md)
- `CLAUDE.md` (657→520, винесено довідку)
- `docs/TECHNICAL_REFERENCE.md` (новий, 202 рядки)
- `docs/ARCHITECTURE.md` (оновлено посилання)
- `.claude/commands/supabase-prep.md` (оновлено посилання)
- `.claude/hooks/rules-reminder.sh` (новий, 62 рядки)
- `.claude/settings.json` (додано UserPromptSubmit хук)
- `.gitignore` (додано `.claude/hook-counter`)

### Метрики

- **Гілка:** `claude/start-session-FMykK`
- **7 комітів:** da410ba (скіл /finish) → 7f1c0f8 (BUGS) → a22b055 (SESSION_STATE) → 8b40fbd (CHANGES+SKILLS_PLAN+START_HERE) → fc1085b (TECHNICAL_REFERENCE skeleton) → 4880131 (стиснення CLAUDE.md) → 6a169ad (хук правил)
- **Код не чіпано** — тільки документація і конфігурація хуків.
- **CACHE_NAME не мінявся**, деплою не було (PWA не залежить від `.md` і `.claude/`).
- **Сумарний виграш на `/start`:** BUGS -239, SESSION_STATE -110, CLAUDE.md -137 = **~486 рядків менше** при кожному старті. +137 рядків менше у project instructions (CLAUDE.md у контексті завжди).

---

## 2026-04-17 — 🔧 Рефакторинг промптів + свайп Налаштувань + glass-стиль + cache-bust (сесія 14zLe)

### Контекст
Продовження рефакторингу після сесії KTQZA. Під час роботи виявлено ланцюг пов'язаних проблем у Налаштуваннях: свайп закриття поганий → скаргу Романа → виявлення що стиль модалки не збігається з іншими (не glass) → виявлення проблеми з кешем Safari (нові стилі не долітали до телефону).

### Зроблено — 13 логічних блоків

**1. Прибрано дубль B-58 у `NEVERMIND_BUGS.md`** (коміт `eb9174e`)
B-58 стояв і у "🟢 Дрібні", і у "✅ Закриті" — забули видалити з відкритих після фіксу у KTQZA.

**2. Винесення промптів у `src/ai/prompts.js`** (коміт `06458b2`)
- Новий модуль 251 рядок: `getOWLPersonality()`, `INBOX_SYSTEM_PROMPT`, `INBOX_TOOLS` (31 tool), `getOwlChatSystemPrompt(context)`
- `src/ai/core.js` скорочено з 839 → 623 рядки (-216)
- Backward-compat через re-export: 11 файлів що імпортують ці константи з `core.js` працюють без змін
- **Причина:** коли OWL "не так відповідає" — тепер одне місце правки. Передумова для майбутніх характерів (Badg/Rabi).

**3. Нове правило у CLAUDE.md — UI-мова про ВИГЛЯД** (коміт `941cfa9`)
- Додано підправило "🎨 ДЛЯ UI-ЗАДАЧ" у секцію "⚠️ ОБОВ'ЯЗКОВО"
- Анти-приклад з цієї ж сесії (`setupSettingsSwipe`, `translateY`, `indigo-600`, `linear-gradient` без пояснень) → переписано людською мовою
- Правило "один спосіб пояснити" (не дублювати технічну+людську)
- Посилено самоперевірку — 4 питання перед відправкою
- **Причина:** Роман кілька разів за сесію просив "поясни простіше" — правило має запобігти повторенню у майбутніх сесіях.

**4. Виправлено свайп закриття Налаштувань** (коміт `c763879`)
- Вміст обгорнуто у `.settings-scroll` (окремий блок прокрутки)
- `setupSettingsSwipe` у `boot.js` замінено на виклик `setupModalSwipeClose` (та сама функція що у модалках задач/звичок/фінансів)
- `setupModalSwipeClose` доповнено блокуванням свайпу всередині `.settings-scroll` — нативна прокрутка має пріоритет
- **Було:** закривалось тільки якщо екран у верху + нічого не рухалось поки тягнеш пальцем + конфлікт з iPhone свайпом зверху
- **Стало:** свайп завжди працює зі смужки/заголовка, панель їде за пальцем, закривається при >80px вниз

**5. Glass-стиль панелі Налаштувань (як Календар)** (коміт `29aa40e`)
- Відступ від країв екрану 16px (overlay `padding: 0 16px 16px` + `justify-content: center`)
- Скляний фон `rgba(255,255,255,0.30)` + `blur(32px)` замість бежевого градієнта
- Border-radius 24px з усіх сторін (було тільки зверху)
- Тонка біла рамка `1.5px solid rgba(255,255,255,0.5)`
- `max-width: 480px`, `max-height: 85vh`
- Backdrop `rgba(0,0,0,0.35)` замість `rgba(20,10,50,0.35)`
- Вміст не чіпав — картки груп Профіль/OWL/Мова лишились як були

**6. Cache-bust для style.css і bundle.js** (коміти `f555dfb` + цей запис)

**Проблема:** після коміту (5) Роман перезавантажив застосунок на iPhone — бейдж версії оновився (значить SW отримав свіжий index.html), але **стилі лишились старими** (панель щільна бежева як раніше).

**Причина** — Safari має **два рівні кешу:**
  1. Service Worker кеш (наш, керований `CACHE_NAME`) — оновлюється правильно
  2. Власний HTTP-кеш Safari на рівні браузера — неконтрольований, тримає CSS/JS агресивно

**Чому раніше не помічав:**
- Бейдж версії — у `index.html`, йому meta-теги `Cache-Control: no-cache` (з B-79) забороняють кешування → завжди свіжий
- `bundle.js` кешувався теж, але зміни JS переважно непомітні відразу (логіка, не візуал) — юзер не помічав що старий код працює
- `style.css` змінювався рідко — проблема не проявлялась. Сьогоднішня радикальна зміна панелі (бежева → скляна) вперше зробила кеш видимим.

**Рішення (два кроки):**

(а) **Миттєвий фікс** (коміт `f555dfb`) — додано `?v=20260417-2005` до `<link>` і `<script>` у `index.html`. Safari бачить новий URL і завантажує файл свіжим.

(б) **Автоматизація у CI** (цей запис) — `auto-merge.yml` при кожному деплої `sed`'ом замінює `?v=...` на унікальну мітку `vN-YYYYMMDD-HHMM` (поруч із оновленням бейджа). Синхронізовано з `deploy-counter.txt`. При наступних змінах стилів або коду **ручне втручання більше не потрібне**.

**Важливо:** не видаляти `?v=` параметри з `index.html` — інакше sed у CI не знайде що замінити і кеш-бастинг зламається. Якщо додаються нові підключення CSS/JS — додавати `?v=PLACEHOLDER` і додати відповідний sed у `auto-merge.yml`.

**7. Фіолет → бурштин/коричневий у Налаштуваннях** (коміт `65bf917`)
- Іконки Мова/Сповіщення: stroke `#4f46e5` → `#c2790a` (бурштин), фон `rgba(129,140,248,0.18)` → `rgba(242,217,120,0.35)`
- OWL-характер Наставник + Пам'ять агента: stroke `#7c3aed` → `#c2790a`
- Активний OWL-характер (updateOwlModeUI у `nav.js`): border+bg фіолет → бурштин
- Активні pills (`.s-currency-btn.active`, `.s-lang-btn.active`): `#1e1040` → `#5c4a2a` (темно-коричневий)
- Кнопка "Зберегти" у Налаштуваннях (`.settings-panel .btn-primary`): плоский `#1e1040` → градієнт `linear-gradient(135deg,#a67c52,#7a4e2d)` (кавовий лате). Не чіпає `.btn-primary` глобально
- Модалка Пам'яті: кнопка "Оновити через OWL" і "Зберегти" — теж на бурштин/лате

**8. Екстра простір знизу у всіх вкладках** (коміти `c04bc4a` + `f325bfb`)
- `padding-bottom` scroll-контейнерів з `calc(var(--tabbar-h,83px) + 34px)` на `+100px` у 9 місцях: `inbox-list`, `tasks-list`, `prod-page-habits`, `notes-scroll`, `me-content`, `evening-scroll`, `fin-scroll`, `health-scroll`, `projects-scroll`
- Причина: поле вводу ("Агент") висить над таб-баром і додає ~60px висоти — останні картки були сховані за ним, не можна було доскролити

**9. Множинні JSON-дії у чат-барах** (коміти `9dd4687` + `d9c463b` + 5×fix: `0c5fe29`, `1252b0c`, `ab6d6bd`, `861695b`, `53e7837`)
- **Проблема:** коли юзер просив кілька дій одразу ("видали А,Б,В, додай Г"), AI повертав 5 JSON-блоків підряд. Жадібне regex `/\{[\s\S]*\}/` захоплювало все як ОДИН блок — `JSON.parse` падав — юзер бачив сирий JSON у чаті замість виконаних дій.
- **Рішення:** нова утиліта `extractJsonBlocks(text)` у `src/core/utils.js` — балансує фігурні дужки з урахуванням рядків у лапках, повертає масив розпарсених об'єктів.
- **Інтегровано у 6 чат-барів:** Finance (`finance-chat.js`), Tasks (`tasks.js`), Habits/Prod (`habits.js sendTasksBarMessage`), Evening (`evening.js` — 2 місця: Me-chat + Evening-bar), Health (`health.js`), Projects (`projects.js`). Inbox не торкали — там tool calling.
- **Архітектурно:** у кожному файлі обробка одного `parsed` винесена у inner closure `_processOne(parsed)` який повертає true/false. Зовні — цикл `for (const parsed of extractJsonBlocks(reply))`.

**10. Чорні контрастні тіні на Фінансах** (коміти `8911310` → `c2bb546` → `8b28f57` → `d722e13`)
- 4 ітерації по запитах Романа: спочатку чорні замість кольорових (B-61), потім темніші, потім компактніші (менше blur), потім продубльовано на навігацію (‹ ✎ ›).
- Фінальні значення: `box-shadow:0 4px 10px rgba(0,0,0,0.32), 0 2px 4px rgba(0,0,0,0.22)` на категоріях і кнопках навігації + `drop-shadow(0 4px 10px ...) drop-shadow(0 2px 4px ...)` на SVG Hero donut.
- Для Hero donut: перехід з `rgba(30,16,64,X)` (темно-фіолетовий) на чистий чорний — прибрано синюватий відтінок.

**11. Fade зверху списку Налаштувань** (коміти `2f5912c` + `9d14740`)
- `.settings-scroll` отримав `mask-image: linear-gradient(to bottom, transparent 0, black 20px)` + `padding-top: 20px`.
- Перша картка при відкритті повністю видима (fade зона у padding), під час прокрутки картки плавно "розчиняються" у заголовку замість різкого обрізання.

**12. Глобальна анімація натискання** (коміти `9b36914` + `bf9ccc7`)
- CSS правило `button, [onclick] { transition: transform 0.3s ease-out } button:active, [onclick]:active { transform: scale(0.87) }`.
- Застосовується скрізь автоматично: всі кнопки, чіпи OWL, кружечки категорій, стрілки навігації, картки з onclick, s-row'и з onclick.
- Не зачіпає input/textarea/select (немає onclick) і `.drum-col` (барабани вибору часу мають свій transform для свайпу).
- Параметри 87% scale + 0.3с за запитом Романа (помітний, драматичний "клацання" ефект).

**13. Тристаний цикл галочки звичайних звичок** (коміт `4d4f7d1`)
- Звичайна звичка (`target=1`): тап циклює `0 → 1 → 2 → 0` замість `cur+1` без обмежень.
  - 1й тап — зелена (виконано), 2й — жовта (бонус/перевиконання через існуючий механізм `isOver`), 3й — порожня (скасовано).
- Звички з лічильником (`target>1`, наприклад "8 склянок") — старий behavior `cur+1` збережено (не ламати підрахунок підходів).
- Зміни у двох функціях: `toggleHabitToday` (вкладка Я) + `toggleProdHabitToday` (Продуктивність). Кнопка confetti спрацьовує коли `newVal === target`.

**14. Уніфікація свайп-видалення (базова логіка застосунку)** (коміти `724c7ab`, `3f205dd`, `4876d14`, `3887a4c`, `3865545`)
- **Контекст:** Роман визначив як "базову логіку застосунку, як glass-стиль модалок". До сесії в 5 списках (Inbox, Tasks, Notes, Habits, Finance) свайп-видалення працював по-різному — 4 списки через `applySwipeTrail` (миттєве видалення при свайпі >поріг), один (Фінанси) через B-54 механізм з кнопкою-кошиком.
- **Нова утиліта:** `attachSwipeDelete(wrapEl, cardEl, onDelete, opts)` у `src/ui/swipe-delete.js`. Базовий контракт: wrapEl з `position:relative;overflow:hidden`, cardEl рухається `translateX`, свайп вліво → lazy-створена кнопка-кошик справа → тап на кошик = `onDelete()`. Свайп вправо при відкритому = закриття. Тап на картку при відкритому = закриття. openRatio 0.22 default.
- **Інтегровано у 5 списків:**
  - `finance.js`: `_attachFinTxSwipeDelete` (~75 рядків inline B-54 логіки → 8 рядків виклику утиліти)
  - `inbox.js`: видалено swipeStart/Move/End + swipeState + `_inboxSwipedRecently`. Post-render hook у `renderInbox`.
  - `tasks.js`: видалено taskSwipeStart/Move/End + setupTaskSwipeListeners. Нова функція `taskCardClick(id, event)` з guard'ом для `data-task-check` і `data-step-check`. Post-render hook у `renderTasks`.
  - `notes.js`: видалено noteSwipeStart/Move/End + folderSwipeStart/Move/End. Папка отримала клас `.folder-item-wrap` + `data-folder` + onclick `openNotesFolder`. Пост-hook `_attachNotesSwipeDelete()` обробляє і нотатки, і папки. Викликається у 3 місцях.
  - `habits.js`: видалено `_createHabitSwipe` (Me + Prod). Нова функція `prodHabitCardClick(id, event)` з guard'ом для `data-habit-check`. Me-картки зберегли onclick=openEditHabit. Post-render hook у `renderHabits` і `renderProdHabits`.
- **Очищено:** ~25 рядків swipe-state declarations, ~300 рядків старих swipe handlers, window-exports застарілих функцій (habitMeSwipe*, prodHabitSwipe*, noteSwipe*, folderSwipe*, swipeStart/Move/End).
- **Поведінка тепер:** **скрізь однакова** — свайп вліво відкриває панель з кошиком, треба свідомо тапнути щоб видалити. Безпечніше (не видалиш випадково), консистентно (одна ментальна модель).

### Файли змінені за сесію
- **Код:** `src/ai/prompts.js` (новий), `src/ai/core.js`, `src/core/boot.js`, `src/core/utils.js` (extractJsonBlocks), `src/core/nav.js`, `src/ui/swipe-delete.js` (attachSwipeDelete), `src/tabs/inbox.js`, `src/tabs/tasks.js`, `src/tabs/notes.js`, `src/tabs/habits.js`, `src/tabs/finance.js`, `src/tabs/finance-chat.js`, `src/tabs/evening.js`, `src/tabs/health.js`, `src/tabs/projects.js`, `index.html`, `style.css`, `sw.js`
- **CI:** `.github/workflows/auto-merge.yml` (cache-bust sed)
- **Документація:** `CLAUDE.md`, `docs/CHANGES.md`, `_ai-tools/SESSION_STATE.md`, `NEVERMIND_BUGS.md`

### Метрики
- **32 коміти** (`eb9174e` → `3865545`)
- **Діапазон версій:** v199 (на старті) → v205+ (CI ще деплоїть останні свайп-коміти)
- **Рядків видалено:** ~500+ старого swipe-коду у 5 файлах
- **Рядків додано:** ~250+ (прamptи.js новий + attachSwipeDelete + extractJsonBlocks + оновлені інтеграції)
- **Build:** чистий після кожного коміту (`node build.js` exit 0)
- **Tool calls / Stream idle timeout:** 4 обриви під час Write великих файлів — обхід через skeleton+Edit (правило CLAUDE.md дотримано)

### Відкрите на майбутнє
- **B-65** SW load failed — низький пріоритет, одноразова помилка
- **Тестування на телефоні** потребує прогону: свайп-видалення на 5 вкладках, тристаний цикл звичок, анімація натискання, множинні JSON-дії
- **Наступний крок:** Вечір 70→100% / Я 65→100% / Проекти 65→100% / Здоров'я Фаза 2
- **Вторинно:** `src/core/nav.js` = 1236 рядків (трохи більше 1200) — кандидат на майбутнє розбиття (settings / theme / profile / storage)

### Інциденти
Без інцидентів. Жодних `git reset --hard`, `git push --force` або інших руйнівних операцій не було. Усі 32 коміти через стандартний flow: push у `claude/start-session-14zLe` → `auto-merge.yml` merge у main → CI build → deploy. `bundle.js` попадав у `git status` після локального `build.js` — перед кожним комітом `git checkout -- bundle.js` щоб не закомітити (він у `.gitignore`, CI сам генерує).

---

## 2026-04-17 — 🛠 12 багів + UI модалки категорії + фікс zombie-SW Safari (сесія KTQZA)

**Контекст:** після рефакторингу finance.js (gHCOh) Роман тестував у браузері. Знайдено ряд багів (кома на калькуляторі, дубль "Їжа" у донаті, сірі дефолтні категорії, "+додати" без вибору типу, застрягання Safari на v53) + UX-запит на компактніший picker іконок/кольорів у модалці категорії.

**Workflow Романа встановлено у цій сесії:** один таск → звіт → пропозиція наступного → чекати "Роби". Не пакетити кілька задач підряд.

**Закрито 12 багів:**

- **B-44** Кома на калькуляторі ставила крапку → `finCalcAppend(',')` + `.replace('.', ',')` при prefill. `600,50` замість `600.50`.
- **B-50** "Транзакції" → "Операції" у 18 місцях UI + AI-промпти (AI потім переказує юзеру з тим самим терміном).
- **B-57** Переміщення категорії через модалку замінено стрілками `‹ ›` на самому кружечку у edit-режимі ✎. `event.stopPropagation()` щоб не відкривалась модалка. `moveFinCategory` + `renderFinance` у `window`.
- **B-58** Автогенерація підкатегорій обмежена до 3 у 3 місцях `finance-cats.js` + AI-tool description.
- **B-61** Тіні "левітації": `box-shadow: 0 6px 14px ${color}35` кольором категорії + Hero drop-shadow 0.08→0.18.
- **B-75** Дубль "Їжа" у донаті — `dedupe(list)` у `_migrateFinCats` за `name.trim().toLowerCase()` + мерж підкатегорій. Транзакції не потребують міграції (зберігаються рядком `{category:'Їжа'}`).
- **B-76** `formatMoney` показував `€52.20` → `.replace('.', ',')` після `toFixed(2)`. Торкається всіх 11 викликів у проекті.
- **B-77** Кнопка "+додати" тільки створювала витрату — додано toggle Витрата/Дохід зверху модалки транзакції + `setFinTxType`.
- **B-78** Дефолтні категорії отримували сірий `#78716c` (Math.random без seed) → `FIN_DEFAULT_COLORS` словник 30+ виразних кольорів + міграція ремапить сірий у відомих категоріях.
- **B-79** Safari/Chrome non-standalone застрягли на v53 · 07:58 попри PWA v199+. Root cause: ДО B-73 фіксу (07:45 UTC 17.04) SW був cache-first для ВСЬОГО, включно з `sw.js`. iOS Safari перехоплював навіть update check через SW fetch listener → zombie-lock. Фікс: meta-теги `Cache-Control: no-cache` у `<head>` (запобіжник) + ручна інструкція очистити website data (один раз для застрягших).

**UI-поліпшення модалки редагування категорії:**

1. **Іконка + Колір** — компактні inline кнопки поряд (flex:1 кожна) замість двох повних рядків.
2. **Fullscreen popup picker** — тап → `position:fixed` glass 340px з grid 5 колонок + тап по backdrop закриває.
3. Блок "Позиція в сітці" видалено з модалки (стрілки на самій категорії зручніше).

**Перевірено що вже в коді (ROADMAP застарів):**

- `set_reminder` — повністю реалізовано (`habits.js:1270-1307`): `nm_reminders` + `nm_events` + `nm_inbox` + `CAT_META.reminder ⏰`.
- **G9 Page Visibility** — guard `if (document.hidden) return` у 4 точках: `tryOwlBoardUpdate`, `tryTabBoardUpdate`, data-changed listener, `checkFollowups`. Виняток — `_checkReminders` (reminders мусять спрацьовувати).
- Блок 1 "Малі фікси" повністю закритий — список залишків у ROADMAP застарів.

**Метрики:** 12 комітів, `CACHE_NAME: nm-20260417-1903`, версія v199+.

**Файли:** `src/tabs/finance.js`, `src/tabs/finance-cats.js`, `src/tabs/finance-modals.js`, `src/tabs/finance-chat.js`, `src/tabs/inbox.js`, `src/owl/proactive.js`, `src/ai/core.js`, `index.html`, `sw.js`, `NEVERMIND_BUGS.md`.

---

## 2026-04-17 — 🏗️ Робоча архітектура: правила процесу + авто-активація скілів (сесія gHCOh)

**Контекст:** після рефакторингу finance.js виявлена слабка ланка — stream idle timeout обривав відповіді 5+ разів, ледве не призвів до втрати прогресу. Плюс скіли (`/ux-ui`, `/prompt-engineer`, `/pwa-ios-fix` тощо) були написані але Claude їх не активував автоматично. Роман попросив "чітку систему".

**Впроваджено:**

1. **CLAUDE.md секція "🔧 Робочий процес"** — 3 правила проти обривів:
   - №1: Файли >250 рядків → Write скелет з заглушками + Edit блоки по 50-100 рядків
   - №2: Checkpoint-коміт після **кожної** логічної підзадачі (не чекати кінця всіх фаз)
   - №3: ≤25 слів між tool calls (щоб текстова частина не тригерила idle timeout)

2. **SKILLS_PLAN.md переписано з явними тригерами** — замість "коли активувати: UI-задача" тепер **конкретні слова/фрази** які Claude сканує у запитах Романа:
   - Слова `модалка`/`колір`/`фон`/`padding` → `/ux-ui`
   - Слова `промпт`/`галюцинує`/`OWL тон` → `/prompt-engineer`
   - Слова `iOS`/`PWA`/`Safari`/`bfcache` → `/pwa-ios-fix`
   - Слова `рефакторинг`/`розбити файл` → `/refactor-large`
   - Слова `Supabase`/`backend`/`offline` → `/supabase-prep`
   - Claude САМ викликає скіл, не чекає `/команди`.

3. **Новий скіл `/refactor-large`** (`.claude/commands/refactor-large.md`) — формалізує те що робили на дотик у gHCOh. 5 кроків: карта файлу → план фаз → skeleton+Edit → checkpoint-коміти → фінальний аудит. Наступний рефакторинг (наприклад `ai/core.js` 749 рядків) піде за шаблоном.

4. **SessionStart hook у `.claude/settings.json`** — щосесії виводить короткий reminder з правилами процесу + основними тригерами. Ремінь безпеки на випадок якщо Claude не встиг прочитати CLAUDE.md. ~80 токенів на сесію.

**Файли:** `CLAUDE.md`, `_ai-tools/SKILLS_PLAN.md`, `.claude/commands/refactor-large.md` (новий), `.claude/settings.json`, `_ai-tools/SESSION_STATE.md`, `docs/CHANGES.md`.

**Що це дає Роману:** 0 змін у його процесі роботи. Нічого вчити не треба. Він продовжує писати запити як раніше. Різниця — у **надійності** (менше обривів/втрат роботи) і **уважності** (Claude сам згадує чекліст під задачу, замість того щоб Роман нагадував).

**Ризики:** тригер-слова можуть помилково спрацювати (слово "фон" у не-UI контексті). Claude має розуміти контекст. Якщо помилиться — Роман побачить і скаже.

---

## 2026-04-17 — 🔧 Рефакторинг finance.js (сесія gHCOh)

**Контекст:** Роман попросив у кінці cnTkD: _"Файл фінанси занадто великий, все легко ламається"_. План: `_ai-tools/REFACTORING_FINANCE.md` — розбити 2443 рядки на 6 файлів.

**Виконано всі 6 фаз. Результат:**

| Файл | Рядки | Що всередині |
|------|-------|--------------|
| `src/tabs/finance.js` (ядро) | 714 (-71%) | renderFinance, state, getFinanceContext, processFinanceAction, getFinEditMode/setFinEditMode + re-exports |
| `src/tabs/finance-cats.js` | 292 | 41 SVG-іконка, палітра, CRUD категорій, mergeFinCategories, moveFinCategory, міграція v2 |
| `src/tabs/finance-modals.js` | 644 | Модалка транзакції з калькулятором, datepicker, бюджет, категорія |
| `src/tabs/finance-analytics.js` | 382 | Аналітика 📊 з 3 режимами графіка, 9 метрик, benchmark 50/30/20 |
| `src/tabs/finance-insight.js` | 107 | Інсайт дня (AI) з кешем 1год |
| `src/tabs/finance-chat.js` | 190 | Chat bar Фінансів — AI-бот |

**Стратегія backward compat:** `finance.js` робить re-export з `finance-cats.js` і `finance-chat.js` — інші модулі (habits.js, inbox.js, nav.js, owl/*) **не міняли імпортів**. Це важливо бо їх ~7 файлів імпортують з finance.js.

**Циркулярні імпорти контрольовані:** finance.js ↔ finance-cats.js (mergeFinCategories), finance.js ↔ finance-modals.js (getFinEditMode), finance.js ↔ finance-chat.js (renderFinance), finance.js ↔ finance-analytics.js (getFinance). ES modules розв'язують при відкладеному виклику.

**Файли:** `src/tabs/finance*.js` (6 файлів), `src/app.js` (5 нових імпортів), `sw.js` (CACHE_NAME → `nm-20260417-1431`), `CLAUDE.md` (файлова структура), `_ai-tools/SESSION_STATE.md`, `docs/CHANGES.md`.

**Особливості процесу:** Stream idle timeout у Claude Code Web кілька разів обривав довгі відповіді. Перейшов на стратегію "skeleton + дрібні Edit": Write створює файл-скелет з заглушками, Edit додає кожен блок окремо. Завдяки цьому вдалось довести 6 фаз до кінця за одну сесію без втрати прогресу.

**Тестування у браузері — обов'язкове перед деплоєм:** додати/редагувати/видалити транзакцію (свайп), категорія (icon picker, колір, підкатегорії), бюджет, аналітика (3 режими графіка + 9 метрик + benchmark редагування), чат-бар (save_expense), Inbox → finance.

---

## 2026-04-17 — 📦 Підсумок сесії cnTkD + підготовка до рефакторингу finance.js

**Контекст:** кінець сесії cnTkD (~5-6 годин роботи). Роман замовив рефакторинг `finance.js` на наступну сесію бо файл 2443 рядки — "все легко ламається".

**Загальний підсумок сесії:**
- **18 багів закрито** (B-45, B-46, B-47, B-48, B-52, B-53, B-54, B-56, B-59, B-60, B-62, B-64, B-70, B-71, B-72, B-73, B-74 + iOS date input fix)
- **Deploy counter fix** — перехід на `deploy-counter.txt` = 184, стійкий до майбутніх reset
- **PWA iOS update fix** — network-first fetch strategy, SKIP_WAITING, cache-bust
- **Claude-induced incident зафіксовано** — reset 14.04 без дозволу Романа, жорстке правило у CLAUDE.md
- **`/obsidian` скіл переписаний** — обов'язкова секція "Інциденти" для майбутніх розслідувань

**Підготовка до наступного чата:**
- `_ai-tools/REFACTORING_FINANCE.md` — **НОВИЙ**, детальний план розбиття `finance.js` на 6 файлів (категорії, модалки, аналітика, інсайт, chat, ядро). 6 фаз з мітігаціями ризиків
- `_ai-tools/SESSION_STATE.md` — повний перезапис під cnTkD, наступний крок = рефакторинг
- `ROADMAP.md` → "🚀 Active" — **рефакторинг finance.js зверху** + Фінанси v2 позначено стабільними 95%
- `NEVERMIND_BUGS.md` — всі 🔴 і 🟡 порожні, залишились 8 🟢 косметичних

**Git:**
- Сесія cnTkD: коміти 78b99ce → c907325 (15+ комітів)
- Всі зміни мирні (`auto-merge.yml`), **жодних reset/force push у цій сесії**

**Відкриті технічні проблеми:**
1. `finance.js` = 2443 рядки → рефакторинг
2. Circular dependencies `finance.js ↔ inbox.js ↔ habits.js`
3. ~150 рядків закоментованого коду
4. Tool calling тільки в Inbox (4.10 з ROADMAP)
5. Monobank — відкладено до Supabase

**Файли (тільки документація в цьому записі):**
- `_ai-tools/SESSION_STATE.md` — перезапис
- `_ai-tools/REFACTORING_FINANCE.md` — новий
- `ROADMAP.md` — Active блок
- `docs/CHANGES.md` — цей запис

---

## 2026-04-17 — 🔢 Deploy counter reset investigation + перехід на deploy-counter.txt (сесія cnTkD)

**Контекст:** Роман помітив що бейдж у застосунку показує v53 замість очікуваних 100+. При перевірці `_archive/SESSION_STATE_2026-04-13.md` виявилось що на 13.04.2026 версія була **v131+**, а перший деплой після "дірки" — **v3 на 15.04 18:16**. Десь між 13.04 і 15.04 лічильник **скинули**.

**Причина:** попередня логіка у `auto-merge.yml` читала номер версії з `index.html` (з бейджа). Коли хтось робив `git reset --hard` + `git push --force` для відкату зламаного деплою — `index.html` відкочувався у старий стан з низькою версією. Наступний деплой інкрементував від цієї низької цифри замість продовжувати історію.

**Історія подій:**
- Десь до 13.04.2026 → накопичилось ~131+ деплоїв
- **13.04** → 3 продуктивні сесії NeverMind (захист пам'яті OWL, ROADMAP.md, Блок 1 закрито) — штатна робота, нічого не ламалось (підтверджено Obsidian Roma Brain 17.04)
- **14.04** → **Особистий день Романа** — Jameson, пиво, скейтборд, захід сонця. **NeverMind не згадується взагалі** у daily note. Роман у цей день **НЕ просив** Claude робити reset
- **15.04** → перший деплой після reset = **v3** 18:16 (source `claude/start-session-6v2eR`)
- 16.04 12:28 → v22 (перший деплой що зберігся у git history — старіші v1-v21 garbage collected)
- 16.04-17.04 → v22 → v48 → v53
- **17.04 (сесія cnTkD)** → виявлення проблеми + розслідування через Obsidian Roma Brain

**Причина (ідентифіковано Романом 17.04, після перегляду Obsidian):** попередня сесія Claude **додавала скіли без правила "Роби"** — діяла автоматично замість чекати підтвердження. Роман згадує: _"Була сесія де Клод додав два скіла і сам робив без правила Роби. Я зупинив його але він встиг наробити ділов."_ Сам факт reset у daily notes Романа **не зафіксований взагалі** — тобто Claude у тій сесії робив все автоматично без узгодження, включно з `git reset --hard` + `git push --force` ймовірно при зіткненні з merge conflict чи помилкою.

**Зафіксовано як Claude-induced incident.** Це **порушення правила №1 проекту** (`CLAUDE.md`: _"БЕЗ 'Роби' від Романа — не змінювати код"_). Додано **посилене правило** у `CLAUDE.md` секція "Екстрений скид":
- Claude БЕЗ дозволу Романа **не має права** робити `reset --hard` + `force push`, навіть якщо це виглядає найпростішим рішенням
- Замість reset — `git revert` (безпечний, історія цілою) або ручне вирішення merge conflict
- Force push **тільки** за прямим дозволом Романа + з попереднім показом списку комітів що втрачаються

**Фікс — перехід на `deploy-counter.txt`:**
- Новий файл `deploy-counter.txt` у корені repo — абсолютний лічильник деплоїв
- Ініціалізовано значенням **184** (reasonable estimate: 131 до reset + ~53 після = ~184)
- `auto-merge.yml` тепер читає значення з файлу, інкрементує, зберігає назад. Враховує MAX до/після merge (захист від `-X theirs` конфлікту)
- Наступний деплой буде **v185** — і далі коректно зростатиме

**Стійкість до майбутніх reset:**
- `deploy-counter.txt` у repo — якщо reset зробить це саме — лічильник теж скинеться
- **Компенсація:** документований процес у `CLAUDE.md` — при екстреному скиді перед `git push --force` оновити `deploy-counter.txt` вручну значенням `ОСТАННЯ_ВІДОМА_ВЕРСІЯ + 1`
- Альтернатива через `git rev-list --count main` відкинута бо force-push все одно обнуляє

**Файли:**
- `deploy-counter.txt` — новий, значення `184`
- `.github/workflows/auto-merge.yml` — нова логіка читання/запису лічильника
- `CLAUDE.md` — секція "Екстрений скид" розширена попередженням про лічильник
- `NEVERMIND_BUGS.md` — B-73 закрито (PWA не оновлювалось), також повернуто B-74 як задокументований факт
- `docs/CHANGES.md` — цей запис

**B-73 закрито у цій же сесії:** PWA iOS standalone не оновлювалось після деплою. Причина — `fetch` handler у `sw.js` мав cache-first стратегію для нашого коду (HTML/JS/CSS) без перевірки мережі. Фікс: network-first для нашого коду + SKIP_WAITING message handler + cache-bust query `?_v=timestamp` у `doReload`. Файли: `sw.js`, `src/core/boot.js`.

---

## 2026-04-17 — 📚 Приведення документації у порядок після всіх 7 скілів (сесія cnTkD)

**Контекст:** Після сесій VAP6z (`/owl-motion` + `/pwa-ios-fix`) і hHIlZ (`/ux-ui` + `/prompt-engineer` + `/supabase-prep` + `/a11y-enforcer` + `/gamification-engine`) документація залишалась у форматі "план" — писала що скіли "плануються" коли насправді всі 7 вже написані у `.claude/commands/`. Роман попросив привести у порядок.

**Що зроблено:**

- **`_ai-tools/SKILLS_PLAN.md`** — стиснуто з 177 рядків (детальний план з історією обговорень) до ~50 рядків **індексу**: таблиця 7 скілів з колонкою "коли активувати" + формат нового скіла + правило self-audit + відкладене/відкинуте + ресурси. Історія створення скілів — тут у CHANGES.md за сесії VAP6z/W6MDn/hHIlZ.
- **`CLAUDE.md`** → секція "Плани на розвиток":
  - "Анімація OWL" переписана — рішення прийнято (чистий CSS keyframes), статус "заблоковано SVG від Романа"
  - "Скіли Claude Code" переписана — показує фактичний статус 7 скілів з реальними командами `/ux-ui`, `/prompt-engineer` тощо
  - Два дублюючі абзаци про анімацію табло і сову без бабла (рядки 500-502) видалено (злиті в один у новому описі OWL)
- **`START_HERE.md`** → таблиця слеш-команд розширена з 6 до 14 (всі реальні скіли + посилання на індекс у SKILLS_PLAN.md)
- **`ROADMAP.md`** → блок "🛠 Інструменти розробки" оновлено (було "план 6 скілів", тепер "7 скілів написано, далі впровадження")
- **`_ai-tools/SESSION_STATE.md`** — повний перезапис на сесію cnTkD

**Обговорення у сесії (не закомічене у код):**

Роман обрав "Впровадити `/pwa-ios-fix`" → проведено аудит конфліктів перед змінами. Висновок: з 4 пунктів скіла реально корисний **тільки 1** (pageshow rerender після bfcache). Пункт 1 (`--vh`) не потрібен — `100vh` у коді не використовується. Пункт 3 (overscroll-behavior) вже є на `html/body/.page`. Пункт 4 (touch-action: manipulation) небезпечний — конфліктує з `touch-action: pan-y` у задачах/звичках (свайп видалення). Роман перемкнувся на приведення документації, впровадження `/pwa-ios-fix` у код відкладено.

**Файли:**
- `_ai-tools/SKILLS_PLAN.md` — стиснуто
- `CLAUDE.md` — секція "Плани на розвиток"
- `START_HERE.md` — таблиця скілів
- `ROADMAP.md` — блок "Інструменти розробки"
- `_ai-tools/SESSION_STATE.md` — перезапис на cnTkD
- `docs/CHANGES.md` — цей запис

**Код не чіпали. CACHE_NAME не бампали** (документаційні зміни, правило з CLAUDE.md).

**Відкриті проблеми:** 12 🟡 + 8 🟢 багів Фінансів не закрито. Здоров'я Фаза 1+1.5 ще не тестувалось з реальними картками. `/owl-motion` чекає SVG від Романа.

---

## 2026-04-16 — 🛠 6 фіксів + план скілів Claude Code + анімація сови (сесія W6MDn)

**Контекст:** Сесія з 4 блоків роботи: (1) виправлення двох помічених Романом багів (агент не бачить анкету + застаріле табло "завтра"), (2) стилізація 4 модалок Фінансів у glass-стиль, (3) обговорення і планування скілів Claude Code для проекту, (4) вибір підходу для анімації OWL-сови.

**6 багів закрито:**

- **B-68 — Агент не бачив анкету налаштувань (новий).** `getAIContext()` (`src/ai/core.js`) читав `nm_routine` (блоки Календаря), НЕ читав `nm_settings.schedule`. Фікс: блок "Розклад дня" + правило "НЕ питай". Додатково: `getSchedule()` у `src/owl/inbox-board.js` повертає HH:MM рядки, `getProfile()` у `src/core/nav.js` включає currency і language.
- **B-69 — Застарілі повідомлення табло зі вчора (новий).** AI природно пише "завтра/вчора", кеш не скидався при зміні дня → "Завтра мама приїжджає" коли реально через 8 днів. Фікс: `clearStaleBoards()` у `src/owl/inbox-board.js` — при старті перевіряє `toDateString()` першого повідомлення, очищує якщо не сьогодні. Виклик у `bootApp()` перед рендером табло.
- **B-43 + B-51 — Модалка операції (glass-стиль).** Одна функція `_renderTransactionModalBody` обслуговує створення+редагування. Фікс за `docs/DESIGN_SYSTEM.md`: outer panel `rgba(255,255,255,0.30)` + `blur(32px)` + `overflow:hidden` + `padding:0 20px`, scroll container з `padding:28px 0 calc(env(safe-area-inset-bottom)+28px)`.
- **B-49 — Модалка "Дата операції".** Той самий glass-патерн + додано `setupModalSwipeClose`.
- **B-55 — Модалка редагування категорії.** Glass-патерн + input'и з `rgba(255,255,255,0.7)` фоном для читабельності.

**План скілів Claude Code (новий документ):**

Створено [`_ai-tools/SKILLS_PLAN.md`](../_ai-tools/SKILLS_PLAN.md) з 6 скілами за пріоритетами:
- 🟢 UX-UI (адаптований), Prompt Engineer, iOS Safari PWA Debugger — найближчим часом
- 🟡 Supabase Prep (Migration+Perf+retry+offline) — перед Supabase
- 🔴 A11y-Enforcer — перед публічним релізом
- 🔵 Gamification-Engine — Блок 3 ROADMAP

Відкинуто: Remotion Master (ми без React/відео), Social Carousel Builder (не маркетинговий продукт). Формат SKILL.md зафіксовано: YAML frontmatter + Markdown body <500 рядків + supporting files.

**Анімація OWL — обрано варіант 2:**

Готова багатошарова SVG сова (Flaticon/unDraw/iconify/svgrepo) + `freshtechbro/claudedesignskills` плагін скілів (Anime.js рушій). Роман знаходить SVG, Claude пише 5 станів: `idle` / `talking` / `listening` / `error` / `celebration`. Варіант 3 (Gemini SVG Creator) відкладено — об'єднати з B-56 (40 іконок категорій).

**Нові контекстні факти проекту (для будь-якого майбутнього чату):**
- Роман планує стрес-тест з 20-30 юзерами після Supabase
- Публічний реліз без жорсткого дедлайну ("роблю щодня скільки можу")
- A11y не пріоритет зараз — Роман єдиний користувач, зрячий, iPhone

**Файли:**
- `src/ai/core.js` — блок "Розклад дня" у `getAIContext()`
- `src/core/nav.js` — `getProfile()` включає currency/language
- `src/owl/inbox-board.js` — розширена `getSchedule()` + нова `clearStaleBoards()`
- `src/owl/proactive.js` — промпт табло використовує HH:MM
- `src/core/boot.js` — виклик `clearStaleBoards()`
- `src/tabs/finance.js` — 3 модалки переписано у glass
- `sw.js` — CACHE_NAME bumps
- `NEVERMIND_BUGS.md` — 6 багів → Закриті (B-43/B-49/B-51/B-55/B-68/B-69)
- `_ai-tools/SESSION_STATE.md` — повний перезапис на W6MDn
- `_ai-tools/SKILLS_PLAN.md` — **новий файл**
- `CLAUDE.md` — оновлено "Плани на розвиток" (анімація OWL + скіли)
- `ROADMAP.md` — посилання на SKILLS_PLAN.md

**Об'єднання з сесією VAP6z (16.04.2026 пізніше):**

Паралельний чат (`claude/start-session-VAP6z`) написав і замерджив у main два скіли `.claude/commands/owl-motion.md` + `.claude/commands/pwa-ios-fix.md`, переписав мій SKILLS_PLAN.md на короткий.

Об'єднання виконано у W6MDn:
- Повернуто детальний SKILLS_PLAN.md (6 скілів з пріоритетами + use-cases Gemini SVG Creator)
- Позначено `/owl-motion` і `/pwa-ios-fix` як ✅ "початкова версія реалізована"
- Додано **попередження зверху** обох скілів (DOM-селектори, `setupSW`/`localStorage override` заборона, CACHE_NAME bump, делегація `/new-file`)
- Нове правило у CLAUDE.md "Процес роботи" → **"🛡️ Аудит скілів перед створенням або використанням"** (5-пункт self-audit)
- Анімація OWL: замість Anime.js (мій план) прийнято чистий CSS keyframes (VAP6z рішення) — легше, простіше

**РОМАН ВИЗНАЧИВ:** наступна сесія впровадить всі скіли. Деталі → [`_ai-tools/SESSION_STATE.md`](../_ai-tools/SESSION_STATE.md) "Наступний крок".

**Відкриті проблеми:** 18 багів Фінансів не закрито (🟡 B-44, B-46, B-47, B-48, B-52, B-53, B-54, B-56, B-59, B-60, B-62, B-64 + 🟢 B-45, B-50, B-57, B-58, B-61, B-65). Здоров'я ще не тестувалось.

---

## 2026-04-15 — 🩺 Фаза 5 Здоров'я: експорт медкартки + інтеграції (сесія 6v2eR)

**Контекст:** Остання Фаза 5 — завершає переробку вкладки Здоров'я (~100% концепції). Три блоки роботи: медична картка fullscreen для лікаря, синк ліки→задачі і витрати→history, інтеграція з Вечір і Я через промпти.

**Медична картка fullscreen:**
- Нова модалка `#health-export-modal` у `index.html` — повноекранна, зелений header `#1a5c2a`, контент у `<pre>` monospace для читабельності
- Кнопка 🩺 у header Здоров'я (SVG іконка стетоскопа) → `openHealthExport()`
- Функція `buildHealthExportText()` генерує plain-text з секціями:
  - `🚨 АЛЕРГІЇ:` (завжди зверху; якщо немає — `не вказано`)
  - `АКТИВНІ СТАНИ (N):` — для кожної: назва, статус, прогрес, початок курсу, лікар, рекомендації, висновок, наст. прийом, препарати (назва+дозування+графік+курс), останній тренд
  - `ВСІ ПРЕПАРАТИ (N):` — unique по назві, з позначкою якому стану належить
  - `ВІЗИТИ ДО ЛІКАРЯ (за рік, N):` — з усіх карток, сортовано за датою
  - `ЗАВЕРШЕНІ СТАНИ (N):` — коротко (назва + підзаголовок)
  - Футер: "Згенеровано у застосунку NeverMind. Не є медичним документом."
- Кнопка "📋 Скопіювати" — `navigator.clipboard.writeText()` з fallback на `document.execCommand('copy')` для старих браузерів. Відображає "✓ Скопійовано" на 1.5 сек.

**Синк ліки → задачі (`_syncMedicationToTask`):**
- Якщо `med.createTasks === true`, створює задачу у `nm_tasks`:
  - `title`: "Прийняти {назва} {дозування}"
  - `text`: "[{назва картки}] {назва препарату} {дозування} · курс {тривалість}"
  - `steps`: кроки по часам з `schedule[]`
  - `priority`: `important`
  - `sourceMedId`: маркер що задача створена з препарату
- Дубль захист по title (не створює якщо вже є активна задача з тим же title)
- Викликається з `addMedicationToCard` і `createHealthCardProgrammatic`

**Синк витрат → history картки (`syncHealthFinanceToHistory`, експортовано):**
- Викликається з `processFinanceAction` (finance.js) після save_finance при `type==='expense'`
- Логіка detector'а:
  - Фільтр: `category === "Здоров'я"` АБО comment містить маркер (regex `/аптек|ліки|препарат|лікар|аналіз|тест|рецепт/i`)
  - Fuzzy match (нечіткий пошук): перебирає активні картки, шукає чи назва картки або назва якогось препарату згадується у comment
  - Fallback: якщо не знайшло match і активна лише 1 картка — зв'язує з нею
- Записує у `card.history` тип `auto` з текстом "Витрата: {amount}€ — {comment}"

**Інтеграція з Вечір + Я (через promptи):**
- `EVENING_SUMMARY_PROMPT` розширено секцією "ЗДОРОВ'Я у підсумку": згадати пропущені дози (history тип `auto`) БЕЗ моралізаторства; похвалити дисципліну курсу при добрих даних. Згадка опційна — якщо немає особливого, не вигадувати.
- Промпт `renderMeAnalysis` (вкладка Я — тижневий аналіз) розширено: якщо є активні стани — включити коротку строку про дисципліну курсів. Без діагнозів/інтерпретацій.

**Файли:**
- `src/tabs/health.js` — +4 функції (`buildHealthExportText`, `openHealthExport`, `closeHealthExport`, `copyHealthExport`) + `_syncMedicationToTask` + `syncHealthFinanceToHistory` (export). Window exports оновлено.
- `src/tabs/finance.js` — import `syncHealthFinanceToHistory`, виклик у `processFinanceAction` при expense
- `src/tabs/evening.js` — розширено `EVENING_SUMMARY_PROMPT` і `renderMeAnalysis` промпт
- `index.html` — нова модалка `#health-export-modal` + кнопка 🩺 у header Здоров'я
- `sw.js` — CACHE_NAME `nm-20260415-1405` → `nm-20260415-1611`
- `ROADMAP.md` — Фаза 5 → "✅ Виконано", Active секція — **ЗДОРОВ'Я ЗАВЕРШЕНА**, пропонуємо інші вкладки
- `_ai-tools/SESSION_STATE.md` — оновлено з Блоком Е
- `docs/CHANGES.md` — цей запис

**🎉 Вкладка Здоров'я:** ~97% → **~100%**. Всі 6 фаз виконані + 5 багів закриті за одну сесію 6v2eR.

**Наступний крок (на вибір):**
- Перейти на іншу вкладку — Фінанси ~85% або Проекти ~65%
- Блок 1 з `📋 Next`: Retry/fallback для tool calls, винесення промптів у `src/ai/prompts.js`
- Блок 3: Inbox стрічка редизайн, Динамічний розпорядок дня
- Ручне тестування всіх 6 фаз Здоров'я на телефоні перед переходом далі

---

## 2026-04-15 — 👁️ Фаза 4 Здоров'я: супровід OWL (сесія 6v2eR)

**Контекст:** Після Фази 3 (UI переробка) — Фаза 4 робить OWL "активним супутником": проактивні нагадування ліків, моніторинг суперечностей рекомендацій, AI-класифікація тексту у тренд стану. Плюс жорсткий блок "OWL не лікар" у чат-барі Здоров'я.

**Пасивні нагадування ліків:**
- `_getMissedDoses()` — детектор пропущених доз. Перебирає активні картки + `medications[]`. Для кожного `schedule[]` часу `T` перевіряє чи є запис у `log[]` у вікні `[T, T+6h]`. Вікно реакції: `now >= T+15хв` і `now <= T+6год` (після 6 год — слот вже не нагадуємо, безсенсу).
- `_buildMissedDosesBannerHtml()` — жовтий банер зверху `#health-scroll` (під алергіями, перед дисклеймером). Для кожної missed дози: іконка ⏰, назва препарату + дозування + картка + час, кнопка "✓ Прийняв" (→ `logHealthMedDose`) і кнопка "Пропущу" (→ `skipHealthMedDose`).
- `skipHealthMedDose(cardId, medId, scheduledTime)` — пропуск дози: записує у `med.skipped[]` (окремий масив щоб не плутати з реальними прийомами у `log[]`) + у `card.history` запис типу `auto` "Пропустив дозу ...". Skip НЕ позначається як taken — банер просто зникне на сьогодні (skip зафіксовано, але наступного дня повториться).
- `setInterval` 5 хв перерендерує вкладку якщо юзер на ній (`document.hidden` guard щоб не палити ресурси у фоні). Перевіряє `page-health.style.display` щоб не чіпати інші вкладки.

**Моніторинг суперечностей (prompt-правила):**
Нова секція "ЗДОРОВ'Я — МОНІТОРИНГ СУПЕРЕЧНОСТЕЙ" у `INBOX_SYSTEM_PROMPT`:
- Якщо запис юзера суперечить `doctorRecommendations` активної картки (наприклад рек "не пити каву" + "купив лате") → AI ПІСЛЯ primary tool call додає у text content м'яку згадку БЕЗ моралізаторства: "Нагадую: лікар казав зменшити каву." 1 речення. НЕ картає, НЕ забороняє — юзер дорослий.
- Позитивне підкріплення при підтвердженні рекомендації (рек "гуляти 30 хв" + закрита задача "пробіжка 40 хв") → "Дотримуєшся плану." 1 речення.
- Алергії моніторяться аналогічно — `add_health_history_entry` з `entry_type='auto'` або попередження у text content.

**AI-класифікація стану (prompt-правила):**
Нова секція "ЗДОРОВ'Я — КЛАСИФІКАЦІЯ СТАНУ":
- Коли юзер описує стан по існуючій картці ('сьогодні менше свербить', 'знову загострилось', 'майже не помічаю') → AI викликає `add_health_history_entry` з `entry_type='status_change'` і text що ЯВНО містить одне зі слів 'покращення'/'погіршення'/'стабільно'. Це оновлює бейдж "Курс X% · тренд" з Фази 3.
- Приклади у промпті:
  - "сьогодні менше свербить" → text: "Покращення: менше свербить"
  - "загострення після горіхів" → text: "Погіршення: загострення після горіхів"
  - "так само як вчора" → text: "Стабільно: без змін"

**Жорсткий блок "OWL не лікар":**
У системному промпті `sendHealthBarMessage` додано блок з ❌/✅ переліком:
- ❌ ЗАБОРОНЕНО: діагнози, поради препаратів/доз, інтерпретації аналізів, альтернативи призначеному лікуванню
- ✅ ДОЗВОЛЕНО: нагадувати про призначене, помічати патерни, попереджати про суперечності, фіксувати факти у history
- При медичному питанні — шаблонна відповідь: "Я не лікар. Це питання до твого лікаря — не займайся самолікуванням. Запиши питання щоб не забути на прийомі."

**Файли:**
- `src/tabs/health.js` — +3 функції (`_getMissedDoses`, `_buildMissedDosesBannerHtml`, `skipHealthMedDose`) + інтеграція банера у `renderHealthList` + `setInterval` для auto-refresh. Системний промпт `sendHealthBarMessage` посилено блоком "OWL не лікар".
- `src/ai/core.js` — 2 нові секції у `INBOX_SYSTEM_PROMPT` (МОНІТОРИНГ СУПЕРЕЧНОСТЕЙ + КЛАСИФІКАЦІЯ СТАНУ)
- `sw.js` — CACHE_NAME `nm-20260415-1319` → `nm-20260415-1405`
- `ROADMAP.md` — Фаза 4 → "✅ Виконано", Active секція оновлена (Фаза 5 — наступна)
- `_ai-tools/SESSION_STATE.md` — оновлено з Блоком Д
- `docs/CHANGES.md` — цей запис

**Вкладка Здоров'я:** ~92% → ~97%. Лишилась 1 фаза (5: експорт медкартки + синк ліків у задачі + синк витрат у фінанси + інтеграція з Вечір і Я).

**Наступний крок:** Фаза 5 — "Медична картка" fullscreen (кнопка у header → модалка з алергіями, активними станами, ліками, історією візитів, кнопкою "Скопіювати текстом" для лікаря) + синк `createTasks:true` ліків → `nm_tasks` (щоденні задачі "Прийняти {назва}") + синк витрат на ліки → автокатегоризація у Фінансах.

---

## 2026-04-15 — 🎨 Фаза 3 Здоров'я: UI переробка картки (сесія 6v2eR)

**Контекст:** Після Фази 2 (AI tool calling) — UI переробка workspace картки під нову концепцію (`CONCEPTS_ACTIVE.md` секція "🏥 Здоров'я"). Концепція вимагала: timeline історії, ліки з логом прийому, кнопка "Запитати OWL про цей стан", індикатор курсу з трендом.

**Зміни у `renderHealthWorkspace`:**

- **Бейдж "Курс {pct}% · {тренд}"** — додано під progress bar. Тренд читається з останнього `history` запису типу `status_change` (записи AI створює через `add_health_history_entry` з Фази 2). Fuzzy match (нечіткий пошук) на слова "покращ"/"погірш"/"стабіл" → колір зелений/червоний/помаранчевий. Якщо немає `status_change` записів — бейдж показує тільки "Курс X%" без тренду.

- **Кнопка "Запитати OWL про цей стан"** — велика дія-картка зеленого кольору вгорі workspace (між блоком прогресу і препаратами). Тап → `askOwlAboutHealthCard(id)`:
  1. Встановлює `_focusedHealthCardId` (нова state-змінна у `health.js`)
  2. `openChatBar('health')` — відкриває чат-бар Здоров'я
  3. Preload-повідомлення від OWL: "OWL у контексті стану X. Що хочеш дізнатись?"

- **Препарати — повна переробка:** замість статичного "✓ прийнято / 08:00, 20:00" тепер:
  - Заголовок з назвою+дозуванням+курсом+графіком
  - Кнопка "+ Прийняти" (зелена коли `todayDoses < expected`, бліда коли `todayDoses >= expected`). Тап → `logHealthMedDose(cardId, medId)` → `logMedicationDose` helper з Фази 2 → крапка стає зеленою + у Історії з'являється запис `dose_log` 💊 "Прийняв {назва}"
  - Лінія "Сьогодні: ●●○ 2/3" — кольорові крапки за `schedule[]` (зелені = прийняті, сірі = пропущені/попереду), лічильник `X/Y`

- **Блок "Записи лікаря" → повноцінна "Історія"** — замість фільтру тільки `doctor_visit` тепер показує ВСІ типи з `card.history` (перших 15 + лічильник "+ ще N"). Кожен запис: іконка (📝 manual, 💊 dose_log, 📈 status_change, 🩺 doctor_visit, 🤖 auto) + тип-лейбл + дата+час + текст. Сортування — свіжіше зверху.

**Focused-режим чат-бару (preloaded контекст):**
- Нова state-змінна `_focusedHealthCardId` у `health.js`
- Helpers: `setFocusedHealthCard(id)`, `getFocusedHealthCard()`, `clearFocusedHealthCard()` (експортовано)
- `getHealthContext()` додає блок "🎯 ФОКУС РОЗМОВИ — стан X" на ВЕРХ контексту з усіма деталями: статус, прогрес, лікар, рекомендації, висновок, наступний прийом, ліки, останні 5 записів історії
- + правило AI: "ВАЖЛИВО: відповідай ПРО ЦЕЙ СТАН. Якщо новий запис стосується цієї картки — використай add_health_history_entry з card_id:X"
- Auto-clear фокусу через listener `window.addEventListener('nm-chat-closed', e => { if (e.detail === 'health') clearFocusedHealthCard(); })`. Подія `nm-chat-closed` диспатчиться у `core.js closeChatBar()`. Це гарантує що при наступному відкритті чату Здоров'я (без кнопки "Запитати OWL") AI не "тримає" попередній фокус.

**Файли:**
- `src/tabs/health.js` — state `_focusedHealthCardId` + 3 helpers, повний переробок workspace render (бейдж тренду, кнопка OWL, препарати з логом, повна історія), розширення `getHealthContext` (блок ФОКУС), listener `nm-chat-closed`, нові window-exports `askOwlAboutHealthCard`/`logHealthMedDose`
- `sw.js` — CACHE_NAME `nm-20260415-1308` → `nm-20260415-1319`
- `ROADMAP.md` — Фаза 3 → "✅ Виконано", Active секція оновлена (Фаза 4 — наступна)
- `_ai-tools/SESSION_STATE.md` — оновлено
- `docs/CHANGES.md` — цей запис

**Вкладка Здоров'я:** ~80% → ~92%. Лишилось 2 фази (4: супровід OWL — пасивні нагадування ліків + моніторинг суперечностей + класифікація стану, 5: експорт медкартки + push після Supabase).

**Наступний крок:** Фаза 4 — пасивні нагадування ліків (`_checkMedicationDoses` в табло Здоров'я), моніторинг суперечностей рекомендацій ("не пити каву" + витрата на лате → м'яке нагадування), класифікація тексту стану через AI (auto-trigger `add_health_history_entry` з типом `status_change`).

---

## 2026-04-15 — 🤖 Фаза 2 Здоров'я: AI tool calling + 4.12 антидублювання (сесія 6v2eR)

**Контекст:** Після Фази 1.5 (синк з календарем) — реалізована Фаза 2: створення/редагування/видалення карток Здоров'я через Inbox AI з 9 новими tools (інструментами, які OpenAI може викликати замість тексту). Юзер пише природньо ("у мене вже 4 день свербіння на руках") → AI створює картку. Принцип "один мозок" — OWL знає всі картки/алергії і не дублює.

**9 нових tools у `INBOX_TOOLS` (`src/ai/core.js`):**
1. `create_health_card` — нова картка стану + опційно перші препарати/лікар/прийом
2. `edit_health_card` — оновити поля існуючої картки
3. `delete_health_card` — видалити картку (з кошика 7 днів)
4. `add_medication` — додати препарат до картки
5. `edit_medication` — змінити препарат (дозування/графік/курс)
6. `log_medication_dose` — позначити прийом препарату ЗАРАЗ (fuzzy match по назві)
7. `add_allergy` — додати алергію (з 4.12 перевіркою існуючих)
8. `delete_allergy` — видалити алергію за id
9. `add_health_history_entry` — запис у timeline картки (тренд/коментар/візит)

**Prompt-правила (`INBOX_SYSTEM_PROMPT`, нова секція ЗДОРОВ'Я):**
- АЛЕРГІЯ → `add_allergy` + перевірка дублів у контексті 🚨 АЛЕРГІЇ (правило 4.12)
- СИМПТОМ що ТРИВАЄ 3+ дні / ДІАГНОЗ → перевір "Активні стани" → `add_health_history_entry` (якщо є) або `create_health_card` (якщо ні)
- РАЗОВА скарга ('болить голова сьогодні') → `save_moment`/`save_note`, НЕ картка
- ПРИЙОМ ЛІКІВ ('прийняв Омез') → `log_medication_dose` з card_id (якщо у активних картках є цей препарат)
- ЛІКАР ПРОПИСАВ → `add_medication` (існуючий стан) або `create_health_card` (новий)
- ВІЗИТ ДО ЛІКАРЯ → `create_event` (НЕ картка)
- МЕДИЧНІ ПИТАННЯ → текст "я не лікар, звернись до твого лікаря"

**4.12 Антидублювання реалізовано:** `getHealthContext()` у промпті AI віддає `[ID:X]` для карток, `[medID:X]` для медикаментів, `[ID:X]` для алергій. AI ОБОВ'ЯЗКОВО перевіряє контекст перед `create_health_card`/`add_allergy` — якщо схоже вже є, використовує `edit_*` або `add_health_history_entry` замість дублювання.

**Helper-функції з `health.js` (експортовано для inbox.js handlers):**
- `createHealthCardProgrammatic(opts)` — з синком nm_events через `_syncCardAppointmentToEvent`
- `editHealthCardProgrammatic(cardId, updates)` — з синком події якщо `nextAppointment` змінено
- `deleteHealthCardProgrammatic(cardId)` — у кошик + видаляє прив'язану подію
- `addMedicationToCard(cardId, med)`
- `editMedicationInCard(cardId, medId, updates)`
- `logMedicationDose(cardId, medQuery)` — fuzzy match (нечіткий пошук) по назві + автозапис у `history` типу `dose_log`
- `addHealthHistoryEntry(cardId, type, text)` — `manual`/`status_change`/`doctor_visit`/`auto`

**Handlers у `src/tabs/inbox.js`:** 9 нових `else if` блоків у `sendToAI` після `save_memory_fact`. Кожен викликає helper з health.js, оновлює UI (`renderHealth()` якщо активна вкладка), додає user-friendly chat-повідомлення.

**Чат-інтерв'ю при створенні** (3-4 питання) — НЕ реалізовано (перенесено у `💡 Ideas`). Поточна реалізація: AI читає текст і одразу створює картку з усіма зрозумілими полями. `initial_history_text` зберігає сирий текст юзера. Для редагування — модалка "Ред." (B-27).

**Розширення на чат-бари інших вкладок** (Notes/Finance/Health) — НЕ зроблено в цій сесії. Tools поки доступні тільки з Inbox. Чат-бари використовують `INBOX_TOOLS` через `callAIWithTools`, але tools-handlers додані тільки у `inbox.js sendToAI`. Окрема невелика задача.

**Файли:**
- `src/ai/core.js` — +9 tools у INBOX_TOOLS, prompt-правила секція ЗДОРОВ'Я (~13 рядків)
- `src/tabs/health.js` — 7 нових export-helper функцій (~155 рядків)
- `src/tabs/inbox.js` — 9 нових `_toolCallToAction` cases + 9 handlers + import з health.js
- `src/tabs/health.js getHealthContext` — додано `[ID:X]` у алергії і `[medID:X]` у медикаменти (для 4.12)
- `sw.js` — CACHE_NAME `nm-20260415-1254` → `nm-20260415-1308`
- `ROADMAP.md` — Фаза 2 → "✅ Виконано", Active секція оновлена (Фаза 3 — наступна)
- `_ai-tools/SESSION_STATE.md` — оновлено
- `docs/CHANGES.md` — цей запис

**Вкладка Здоров'я:** ~65% → ~80%. Лишилось 3 фази (3: UI переробка карток, 4: супровід OWL пасивні нагадування, 5: експорт медкартки).

**Наступний крок:** Фаза 3 — UI переробка картки (новий блок алергій зверху, картка стану з усіма полями + timeline історії + ліки з логом прийому, чат-бар з preloaded контекстом конкретної картки, індикатор "Курс 71% · покращення").

---

## 2026-04-15 — 🔄 Фаза 1.5 Здоров'я: синк картка ↔ календар (сесія 6v2eR)

**Контекст:** Після закриття 5 багів вкладки Здоров'я (попередній блок цієї ж сесії, див. нижче) — реалізований двосторонній синк (sync — синхронізація) `card.nextAppointment` ↔ `nm_events`. Концептуально: коли юзер виставляє наступний прийом у картці хвороби, він автоматично з'являється у Календарі як подія "Прийом: {назва}". І навпаки — зміни/видалення події у Календарі впливають на картку.

**Архітектура — "lazy housekeeping"** (ліниве прибирання) замість push-нотифікацій між модулями. Це усуває circular dependency (циклічну залежність — модуль A імпортує B, B імпортує A, що ламає бандлер). `calendar.js` повністю незалежний від `health.js` — синк відбувається при кожному відкритті вкладки Здоров'я через 3 lazy-функції.

**Точки інтеграції:**
- **Картка → подія** (eager — одразу при дії юзера): `_syncCardAppointmentToEvent()` у `health.js` — викликається з `saveHealthCardFromModal`. Створює/оновлює подію у `nm_events` з `title: "Прийом: {назва}"`, `priority: 'important'`, `sourceCardId` (id картки-джерела), `archived: false`. Зберігає `eventId` у `card.nextAppointment.eventId`.
- **Видалення картки → видалення події**: `deleteHealthCardFromModal` додає прив'язану подію у `addToTrash('event', ...)` (відновлюється 7 днів через стандартний кошик).
- **Архівація минулих** (lazy у `renderHealth`): `_archivePastAppointments()` — якщо `nextAppointment.date < today`: подія `archived:true` (лишається у Календарі як історія) + у картці `history` запис типу `doctor_visit` ("Прийом відбувся {date} о {time}") + `nextAppointment = null` (звільнення слоту для наступного прийому).
- **Зворотний синк дат** (lazy): `_syncEventDatesToCards()` — якщо подія була змінена у Календарі (нова дата/час через drum picker — барабанний вибірник), оновлює `nextAppointment.date/time` при наступному відкритті Здоров'я.
- **Orphan-detection** (lazy — ловець "осиротілих" зв'язків): `_detectOrphanAppointments()` — якщо `eventId` вказує на видалену подію (юзер видалив у Календарі), прибирає `eventId`. Картка лишається з `nextAppointment` без прив'язки, при наступному save модалкою — створиться нова подія.
- **Реактивація архівованої:** при виставленні нової майбутньої дати у вже archived подію — `archived:false` повертається автоматично.

**Структури даних розширено** (без міграції — нові поля просто `undefined` у старих записах):
- `event` (`nm_events`): додано опційні `sourceCardId` (id картки-джерела), `archived` (boolean — для минулих прийомів-документів)
- `nextAppointment` (всередині картки): додано опційне `eventId` — посилання на пов'язану подію

**Edge case НЕ реалізовано** (свідомий вибір — не блокатор для MVP minimum viable product мінімально життєздатний продукт):
- Конфлікти часу з існуючими подіями ("Перенести?" чіп) — перенесено у `💡 Ideas`

**Файли:**
- `src/tabs/health.js` — додано 4 функції синку, `import getEvents/saveEvents` з calendar.js + `addToTrash` з trash.js. Інтегровано у `saveHealthCardFromModal`, `deleteHealthCardFromModal`, `renderHealth`
- `sw.js` — CACHE_NAME `nm-20260415-1228` → `nm-20260415-1254`
- `ROADMAP.md` — Фаза 1.5 → "✅ Виконано", Active секція оновлена (Фаза 2 — наступна)
- `_ai-tools/SESSION_STATE.md` — оновлено з блоком Б
- `docs/CHANGES.md` — цей запис

**Вкладка Здоров'я:** ~55% → ~65%. Лишилось 4 фази (2: Inbox + tool calling + 4.12, 3: UI переробка станів, 4: супровід OWL, 5: експорт медкартки).

**Наступний крок:** Фаза 2 — створення карток через Inbox + tool calling + 4.12 антидублювання. Tools у `INBOX_TOOLS`: 9 нових (`create_health_card`, `add_medication`, `log_medication_dose`, `add_allergy` тощо). Prompt-правило: детекція симптомів → пропозиція картки. Чат-інтерв'ю при "Так".

---

## 2026-04-15 — 🔧 5 багів Здоров'я перед Фазою 1.5 (сесія 6v2eR)

**Контекст:** Роман тестував Фазу 1 на телефоні і виявив 5 багів у вкладці Здоров'я. Вирішено закрити їх перед переходом до Фази 1.5 (синк картка ↔ календар). Одна сесія — один пуш.

**Закриті баги (всі в `NEVERMIND_BUGS.md` → "✅ Закриті"):**

- **B-27 🔴** — Картка всередині не показувала нові блоки Фази 1 (Лікування/Препарати/Записи лікаря) для нових/старих карток, бо поля порожні і UI редагування не було. **Фікс:** стилізована модалка `health-card-modal` у двох режимах `create`/`edit`. Кнопка "Ред." у заголовку воркспейсу. Поля: назва, опис, лікар, рекомендації, висновок, дата початку, наступний прийом (date+time), препарати (динамічний список з name/dosage/schedule/courseDuration), статус. Повний CRUD, logs медикаментів зберігаються при редагуванні (match по name).
- **B-28 🔴** — Кнопка "Назад" у воркспейсі не реагувала. **Корінь:** `renderHealthWorkspace` перезаписував `#health-scroll.innerHTML` → статичні елементи з index.html зникали → `closeHealthCard → renderHealthList` шукав `#health-cards-list`, отримував `null`, мовчки виходив через `if (!listEl) return`. **Фікс:** `renderHealthList` переписано на повну генерацію `#health-scroll.innerHTML` зсередини (не покладається на статичний DOM). `index.html` — `#health-scroll` тепер пустий контейнер. `_renderAllergiesCard` → `_buildAllergiesCardHtml` (повертає рядок).
- **B-29 🟡** — Блок "Нотатки · {назва}" не перемикав на вкладку Нотатки. **Корінь:** `openNotesFolder` лише міняв стан і рендерив. **Фікс:** wrapper `openHealthNotesFolder` який викликає `switchTab('notes')` + `setTimeout(openNotesFolder, 150)` — як у Проектах.
- **B-30 🟡** — "+" відкривало системний `prompt()`. **Фікс:** модалка B-27 у режимі `create`. Єдина UI точка створення+редагування станів.
- **B-31 🟢** — Legacy шкали 1-10 (Енергія/Сон/Біль) усупереч новій концепції Здоров'я. 3 місця: "САМОПОЧУТТЯ ТИЖНЯ" + "ВІДМІТИТИ СЬОГОДНІ" на головному + "Самопочуття сьогодні" у картці. **Фікс:** видалено функції `_renderHealthWeekBars`, `_renderHealthTodayScales`, `setHealthScale` + відповідні блоки. `nm_health_log` збережено (fallback + дані для Фази 4 класифікації OWL у тренд).

**Файли:**
- `src/tabs/health.js` — велика переробка: новий `renderHealthList`, `_buildAllergiesCardHtml`, модалка (8 нових функцій), `openAddHealthCard` без `prompt()`, видалено 3 legacy функції
- `index.html` — додана модалка `#health-card-modal` (~90 рядків), `#health-scroll` очищено від статичного контенту
- `sw.js` — CACHE_NAME `nm-20260415-1151` → `nm-20260415-1228`
- `NEVERMIND_BUGS.md` — 5 записів у "Закриті"
- `_ai-tools/SESSION_STATE.md` — повне оновлення контексту сесії
- `docs/CHANGES.md` — цей запис

**Наступний крок:** Фаза 1.5 Здоров'я — двосторонній синк `nextAppointment` ↔ `nm_events` з архівацією минулих прийомів. UI редагування дати/часу вже готовий (модалка B-27). Лишилось ~50-80 рядків коду: при save-картки створити/оновити подію, при видаленні — у кошик, при минулій даті — `archived:true` + запис у `history`.

---

## 2026-04-15 — 🏥 Фаза 1 Здоров'я + B-26 фікс UI + видалено "OWL пропонує" + 3 нові правила (сесія jMR6m, 11 комітів)

**Контекст:** Велика сесія — почали з обговорення плану Фази 1 Здоров'я (концепція переписана у попередній сесії Lp0Ym), додали кілька нових правил процесу за запитом Романа, виконали саму Фазу 1, потім Роман помітив UI баг (overlap чіпів на картки Inbox + обрізана кнопка "Поговорити") і фічу "OWL пропонує структуру папок" що завжди повертає той самий текст.

**Що зроблено (3 логічні блоки):**

### А. Фаза 1 Здоров'я (коміти `fab3865` + `418a25b`)

Принцип "один мозок" для здоров'я відновлений — `getHealthContext()` тепер живе у `getAIContext()`. До цього функція існувала, але викликалась тільки у чат-барі Здоров'я → інші вкладки не знали про картки/алергії → пряме порушення концепції.

- Новий ключ `nm_allergies` з простою структурою `{id, name, notes, createdAt}` (без `severity` — розширення у `💡 Ideas` після розмови Романа з другом-алергіком)
- UI: коралова фіксована картка алергій зверху вкладки Здоров'я (`#health-allergies-card`)
- Розширена структура `nm_health_cards`: нові поля `doctor`, `doctorRecommendations`, `doctorConclusion`, `startDate`, `nextAppointment:{date,time}`, `history:[{ts,type,text}]`
- Розширені `medications`: з `{name, dose, time, taken}` у `{id, name, dosage, schedule[], courseDuration, log:[ts], createTasks}`
- Lazy-міграція через прапор `nm_health_migrated_v2` — одноразово при першому читанні: старі `doctorNotes` конвертуються у `history` записи типу `doctor_visit`, старі медикаменти у нову структуру
- `renderHealthWorkspace` оновлено: новий блок "Лікування" (доктор/рекомендації/висновок/прийом), Записи лікаря тепер з `history.filter(type=doctor_visit)`, медикаменти показують відмітку прийому з `log[]` (не `taken`)
- Прибрано дубль-виклик `getHealthContext` у `sendHealthBarMessage` (тепер у `getAIContext` → економія токенів)

**Вкладка Здоров'я виросла ~45% → ~55%.**

### Б. B-26 — UI overlap + обрізана кнопка (коміти `78ac075` + `4b4de88`)

Два pre-existing UI баги експоновані Фазою 1 (ширший AI контекст → іноді довші повідомлення табло → board росте у висоту):
1. `#inbox-scroll` мав `margin-top:-10px` — фіксований overlap що ставав видимим коли board ріс. Фікс: прибрано negative margin, flex layout натурально стискає scroll
2. `.owl-speech-chips` мав `mask-image` linear-gradient fade `14px` на краях — кнопка "Поговорити" виглядала як "пів-кнопки" коли потрапляла у fade-зону. Підтверджено timing-залежністю (re-mount застосунку → "домалювалась"). Фікс: маска `14px → 4px` (естетичне розмиття на самих краях, вмісту не з'їдає). Стрілки `.owl-chips-arrow` залишаються основним індикатором скролу.

### В. Видалено фічу "OWL пропонує структуру папок" у Нотатках (коміт `0b98e33`)

За зворотним зв'язком Романа: _"завжди ніби один і той же текст. І взагалі не розумію нащо це треба"_. Прибрано 78 рядків коду, додано 16 рядків коментарів-пояснень.

- HTML banner `#notes-ai-banner` у `index.html` видалений
- Функції `checkAndSuggestFolders` / `suggestNoteFolders` / `applyFolderSuggestion` + змінна `pendingFolderSuggestion` у `notes.js` видалені
- Імпорт + виклик `checkAndSuggestFolders` у `nav.js` прибрано
- Ключ `'nm_notes_folders_ts'` зі скидання у `boot.js` прибрано (старі дані у юзерів лишаються, не витираємо щоб не вторгатися)

Якщо у майбутньому захочемо — можна повернути як on-demand кнопку у налаштуваннях (краще тригер: ≥ 30 нотаток у "Загальному" замість auto-banner).

### Г. 3 нові/змінені правила процесу у CLAUDE.md

1. **"🗺️ Робота з ROADMAP"** — нова секція. Перед записом нової концепції/фічі у ROADMAP: прочитати поточний стан → проаналізувати залежності → запропонувати конкретне місце з обґрунтуванням → чекати підтвердження. Замість "автоматично нагору". Додано за прямим запитом Романа через реальну проблему: свіжі ідеї автоматично отримували верх плану і потім доводилось рефакторити порядок.
2. **"🔍 Перевірка на внутрішню узгодженість після точкової правки"** — у секції "Якість виконання". Два типи знахідок: (1) семантично те саме поряд → виправляй одразу у тій самій правці; (2) суміжне але поза межами запиту → НЕ виправляй сам, ФЛАГУЙ Роману з конкретним місцем + цитатою + пропозицією. Народилось з конкретного випадку у цій же сесії з `/obsidian` скілом.
3. **Посилене "Сперечайся і пропонуй альтернативи"** — у секції "Процес роботи". Замість 1 речення → 6 підпунктів з прямим дозволом Романа на сильнішу критику ("єбош якщо бачиш що це уместно, не соромся") + guardrail "не нагліти" + критерій корисності. Скіл `/start` нагадувалка синхронізована.

### Скіл /obsidian оновлено

- "Запиши в daily" → "Запиши у brain" (NeverMind-сесії більше не йдуть у daily; brain-Claude класифікує і кладе у `projects/nevermind/nm-YYYY-MM-DD.md`)
- Інструкція Кроку 3 переписана під новий флоу класифікації

### Документація оновлена

- `CLAUDE.md`: 3 нові правила + `nm_allergies` + `nm_health_migrated_v2` у таблиці даних, розширена структура `nm_health_cards`, `nm_health_log` позначено legacy
- `ROADMAP.md`: 5→6 фаз Здоров'я (нова Фаза 1.5), Фаза 1 позначена виконаною, новий пункт 4.12 у Блок 4, нова підсекція у `💡 Ideas` (розширення алергій)
- `CONCEPTS_ACTIVE.md`: уточнено алергії (проста структура Фази 1) і `nextAppointment` (Фаза 1.5 синк + архівація)
- `NEVERMIND_BUGS.md`: B-26 закрито з повним описом
- `_ai-tools/SESSION_STATE.md`: повний переписаний для нового чату

**Файли змінено (вся сесія):** `src/tabs/health.js`, `src/tabs/notes.js`, `src/ai/core.js`, `src/core/nav.js`, `src/core/boot.js`, `index.html`, `style.css`, `sw.js`, `CLAUDE.md`, `ROADMAP.md`, `CONCEPTS_ACTIVE.md`, `NEVERMIND_BUGS.md`, `_ai-tools/SESSION_STATE.md`, `.claude/commands/obsidian.md`, `.claude/commands/start.md`, `docs/CHANGES.md` (цей запис).

**Що далі:** Фаза 1.5 Здоров'я (двосторонній синк `nextAppointment` ↔ `nm_events` з архівацією прийомів) — наступна сесія. Перед нею Роман має ручно протестити Фазу 1 на пристрої (чеклист у `_ai-tools/SESSION_STATE.md`).

---

## 2026-04-13 — 🗺️ Консолідація плану в `ROADMAP.md` (4 коміти)

**Контекст:** План проекту був розкиданий по 3 файлах — `FEATURES_ROADMAP.md` (704 рядки), секція "Відкрите на майбутнє" у `_ai-tools/SESSION_STATE.md` (537 рядків), частково `CONCEPTS_ACTIVE.md`. Новий чат губився де шукати. Попередня сесія (gQ2Hl) залишила пріоритетну задачу на новий чат — консолідувати.

**Що зроблено:**

**Новий `ROADMAP.md`** (232 рядки, у корені репо) — єдине місце правди для плану:
- `🚀 Active` — поточний пріоритет (Блок 1)
- `📋 Next` — 7 послідовних блоків робіт (узгоджено з Романом 13.04):
  1. Малі фікси з великою цінністю (`set_reminder`, 4.5, G9, G11, G12, 4.40)
  2. Концепції вкладок (Фінанси/Вечір/Я/Проекти/Здоров'я доробка + аудит)
  3. Ключові UX-розширення (Inbox редизайн, динамічний розпорядок, G4/G5/G6, голосовий ввід)
  4. Мозок OWL: інструменти AI (4.11, 4.9, 4.10, G13)
  5. Мозок OWL: якість рішень (4.4, 4.20+4.39, 4.6, G1-G3, G10, 4.21)
  6. Довершення (4.7, 4.8, 4.41, 4.43 Фаза A, Геймфікація)
  7. Адаптивність Android + desktop (в кінець)
- `✅ Done` — останні 5 сесій з датами (13.04 до 04-05.04)
- `💡 Ideas` — ідеї для обговорення (Три агенти, Живий OWL, 4.22/4.25-4.36/4.42-4.46, G7/G8/G14)
- `🚫 Rejected` — відхилені з причиною + anti-patterns
- `🔒 After Supabase` — окремий блок (Pattern Detection, Push, voice-first, Belief Graph, Intent Graph, i18n, 4.47 RAG)

**Архівовано** (через `git mv`):
- `FEATURES_ROADMAP.md` → `_archive/FEATURES_ROADMAP.md` — повні обговорення Grok/Gemini/DeepSeek/Perplexity, джерела, дослідження, архітектурні принципи
- `_ai-tools/SESSION_STATE.md` (стара 537-рядкова версія) → `_archive/SESSION_STATE_2026-04-13.md`

**Новий компактний `_ai-tools/SESSION_STATE.md`** (~80 рядків): версія + гілка + посилання на ROADMAP + останні 5 сесій + "Для нового чату — найважливіше" + ключові файли. БЕЗ старої секції "🔥 ПРІОРИТЕТНА ЗАДАЧА" (завдання виконано).

**Оновлено посилання:**
- `.claude/commands/start.md` — крок 6 (читання `FEATURES_ROADMAP.md`) → читання `ROADMAP.md` + пояснення структури. Крок 3 (варіанти) → брати з `ROADMAP.md` `🚀 Active`/`📋 Next` замість "Відкрите на майбутнє" у SESSION_STATE
- `CLAUDE.md` — Карта документації: додано `ROADMAP.md` + `_archive/FEATURES_ROADMAP.md`. Два інших посилання на FEATURES_ROADMAP → ROADMAP. Примітка про "BroadcastChannel cleanup" → тепер посилання на ROADMAP
- `START_HERE.md` — додано `ROADMAP.md` як файл №4 в обов'язкових до читання
- `CONCEPTS_ACTIVE.md` — посилання на roadmap оновлено
- `.claude/commands/deploy.md` — "нові заплановані фічі → ROADMAP.md" замість FEATURES_ROADMAP

**Перевірено через grep:** усі живі (не-архівні) посилання на `FEATURES_ROADMAP.md` тепер або ведуть на `_archive/FEATURES_ROADMAP.md` (історичні деталі), або на новий `ROADMAP.md`. Посилання на `_ai-tools/SESSION_STATE.md` лишились — вказують на новий компактний файл.

**CACHE_NAME НЕ чіпали** — це чисто документаційні зміни (виняток з `CLAUDE.md` правила деплою).

**Файли змінено:** `ROADMAP.md` (new), `_ai-tools/SESSION_STATE.md` (rewrite), `CLAUDE.md`, `START_HERE.md`, `CONCEPTS_ACTIVE.md`, `.claude/commands/start.md`, `.claude/commands/deploy.md`, `docs/CHANGES.md` (цей запис), `_archive/FEATURES_ROADMAP.md` (moved), `_archive/SESSION_STATE_2026-04-13.md` (moved).

**Другий коміт `b7cbe9c` — розширення ROADMAP деталями (після зворотного зв'язку Романа):**

Роман помітив що перша консолідація стиснула ідеї занадто сильно — втратилось авторство (Grok/Gemini/GPT-4o/DeepSeek) і повний контекст. Попросив повернути замітки/описи щоб легше входити в контекст наступних чатів і розуміти чи варто робити пункт коли доходимо до нього.

Повернуто:
- 33 авторські позначки у дужках біля пунктів (Grok, Gemini, GPT-4o, DeepSeek + підкатегорії "Grok розширені", "Gemini G1-G14")
- Складність кожного пункту (тривіальна/мала/середня, кількість сесій)
- Залежності між пунктами (наприклад 4.10 залежить від 4.9)
- Повні описи концепцій у Блоці 2 (База знань OWL для Фінансів: Кійосакі/Рамзі/Бах/Клазон/Хаусел/Талеб/Сеті; Flow для Проектів; відмінність Я vs Вечір)
- 6 відкритих питань дизайну для "Динамічного розпорядку" (щоб не починати без обговорення)
- Ризики Блоку 7 (Android+desktop — регресії iOS, keyboard.js)
- Варіанти реалізації графіки Живого OWL (A/B/C/D — Lottie/Rive/Fiverr/AI-генерація)
- Повна структура "Три агенти" (🦉 OWL Мудрий / 🦡 Badg Друг / 🐰 Rabi Тренер)

Нові секції:
- **🧭 Архітектурні принципи** — Grok + Gemini + CLAUDE.md (керівні принципи для вибору між варіантами)
- **🔬 Дослідження Perplexity** — таблиця 12 фактів про Google Now / Clippy / Cortana / Copilot / ChatGPT з джерелами і впливом на наші рішення
- **🔗 Посилання для глибшого вивчення** — 6 URL для дослідників

Уточнення: у Блоці 2 додано "Календар — доробка (~80%)" (6-та вкладка крім оригінальних 5) бо календар щойно переробили 09.04 і треба потестити drum picker / day schedule / event-edit. Роман підтвердив — залишити.

ROADMAP виріс 232 → 449 рядків. Це стратегічний робочий документ — читається при "що робити далі" або "чи актуально ще". Повний контекст у одному місці важливіший за стислість.

**Порядок 7 блоків і послідовність пунктів всередині — НЕ змінено**, лише додано деталі і 1 новий пункт у Блок 2 (Календар).

**Четвертий коміт `b70d4fd` — 5 запозичень з Instagram добірки скілів:**

Роман надіслав 7 скрінів від artemiy.miller з добіркою Claude Code скілів (Anthropic + community: algorithmic-art, theme-factory, notebookLM-skill, frontend-design, superpowers, agent-core, MassGen). Запитав які фішки можемо взяти в архітектуру. Проаналізував, запропонував 5 запозичень, Роман погодився.

Додано в ROADMAP:
- **Блок 1 (+2 пункти):** Retry/fallback для tool calls (з `agent-core`) — прибирає тихі втрати записів юзера при API-помилках. Винесення промптів у `src/ai/prompts.js` (з `agent-core` папки `промпти/`) — 749 рядків `core.js` розділяються на логіку + промпти, знижує борг
- **Блок 2 (розширено):** Проекти — AI-декомпозиція через новий tool `decompose_project(title, description)` (з `agent-core`) — "хочу хімчистку" → AI автоматично генерує кроки+ризики+задачі. Я — інтелект-карта тижня з вузлами проекти↔звички↔настрій↔здоров'я↔фінанси (з `notebookLM-skill`) замість текстового підсумку
- **Блок 6 (+1):** 5-8 готових тем (Весна/Літо/Осінь/Зима/Океан/Ніч/Кава) — натхнено `theme-factory`, без API витрат
- **After Supabase (+1):** AI-теми за промптом юзера через новий tool `generate_theme(description)` — з WCAG контрастом і забороною фіолету. Диференціатор від Notion/Todoist

**Підсумок сесії EdsNg:** 4 коміти, 11 файлів + ROADMAP двічі розширено. Без змін коду (чисто документація). CACHE_NAME не чіпали.

**Відкриті питання — немає.**

**Для нового чату:** `/start` → читає оновлений `ROADMAP.md` → починає з `🚀 Active` → **Блок 1** (8 пунктів, у SESSION_STATE явно виписано список з посиланням).

---

## 2026-04-11 — 🧠 Стратегія мозку OWL: обговорення з Gemini, синхронізація ROADMAP, бізнес-модель

**Контекст:** Роман підняв питання "ми вигадуємо велосипед який давно вигадали?". Провели 2 ітерації обговорення з Gemini 3 Pro через скіл `/gemini`, зробили аудит реального коду (1 агент Explore), виявили що частина плану вже реалізована, переформулювали стратегію.

**Що зроблено:**

**Коміт 1 — `bf3d4e2` fix: латка бага "болить горло"**
- `src/ai/core.js` `getOWLPersonality()` — нова секція "ПРАВИЛО ЧЕСНОСТІ" (4 пункти: не вигадувати поточний стан, не цитувати історичний профіль як поточність, не казати "видалено" без факту в trash, можна говорити впевнено про реальні дані).
- `src/ai/core.js` `getAIContext()` — `nm_memory` перейменовано з "Що знаю про користувача" на "Довгостроковий профіль (ІСТОРИЧНИЙ, може бути застарілим)".
- `sw.js` CACHE_NAME → `nm-20260411-0548`
- **Це латка**, не виправлення корінної проблеми — правильне рішення у Кроці 2 (структурована пам'ять).

**Коміт 2 — `0cad09a` docs: /start читає FEATURES_ROADMAP**
- `.claude/commands/start.md` — додано обов'язкове читання `FEATURES_ROADMAP.md` + `CONCEPTS_ACTIVE.md` + умовно `РОМАН_ПРОФІЛЬ.md`. Без цього Claude у новій сесії не бачив стратегічний план і починав вигадувати власні рішення.

**Коміт 3 — `8fb777b` docs: правило середній розмір відповідей**
- `CLAUDE.md` — нова секція "📏 РОЗМІР ВІДПОВІДЕЙ" (цільовий розмір 5-15 рядків, пояснення в дужках ≠ розтягнута думка).
- `РОМАН_ПРОФІЛЬ.md` — посилений пункт "Не перевантажувати" з посиланням на CLAUDE.md.
- `.claude/commands/start.md` — перебудовано крок 1: СПОЧАТКУ правила взаємодії, ПОТІМ стан проекту. `РОМАН_ПРОФІЛЬ.md` тепер читається безумовно.

**Обговорення з Gemini — ключові рішення:**
- **Велосипед vs стандарт:** зараз велосипед виправданий (PWA без бекенду), після Supabase — перехід на pgvector/RAG. Assistants API відхилено як суперечне принципу 4.22 Micro-orchestration.
- **SyncEngine (Варіант C / 4.38 Offline-first)** затверджено як шлях міграції на Supabase. localStorage залишається синхронним джерелом істини UI, SyncEngine у фоні пише на Supabase через чергу. Читання — cache-first + тихе оновлення з сервера.
- **4.2 переформульовано** — замість "наративного саммарі" (2 речення) → структуровані факти з timestamps (JSON-список). Причина: Gemini показав що Zep/Mem0 роблять key-value факти, наративне саммарі губить деталі. Об'єднано з 4.16 Core Memory.
- **Бізнес-модель вирішена:** freemium (безкоштовна базова + підписка повна). API через хмару Supabase Edge Functions — юзер НЕ вписує свій OpenAI ключ. Роман тримає спільний ключ на сервері, ліміти за рівнем підписки. Технічний наслідок: `nm_gemini_key` у localStorage тимчасовий, після Supabase переноситься на сервер.
- **RAG через Tool Calling** — новий пункт 4.47 у roadmap. Замість запихати весь контекст у кожен запит — дати AI інструменти `search_notes()`, `get_finances()` щоб він шукав тільки потрібне.

**Аудит коду (Explore агент) виявив:**
- ✅ **Judge Layer ВЖЕ Є** — `shouldOwlSpeak()` у `src/owl/inbox-board.js` (рядки 330-535). Працює по балах (score 0-15+), поріг 3. Пункт 4.19 у roadmap був неправильно записаний як "плани".
- ✅ **BroadcastChannel ВЖЕ Є** — у `src/core/boot.js` (рядки 146-154, функція `setupSync()`). Живе паралельно зі старим `localStorage.setItem` override як двошарова страховка.
- ⚠️ **Дублювання логіки:** `src/owl/followups.js` (Фаза 2 Live Chat Replies, 10.04) має ВЛАСНІ блокери і НЕ викликає `shouldOwlSpeak()`. Порушує принцип "один мозок". Треба уніфікувати → це новий Крок 1 у плані.

**Коміт 4 — docs: синхронізація ROADMAP**
- **`FEATURES_ROADMAP.md`** — додано Judge Layer і BroadcastChannel у "Що мозок вже вміє". Переформульовано 4.2 (структуровані факти замість наративу). 4.19 позначено як ✅ з відкритим завданням уніфікації. 4.20 деталізовано.
- **`CLAUDE.md`** — оновлено секцію про `localStorage.setItem` override (BroadcastChannel вже поруч, не "крихкий самотній hack").
- **`_ai-tools/SESSION_STATE.md`** — новий порядок кроків Jarvis Architecture, секція "ДЛЯ НОВОГО ЧАТУ" оновлена з правилом розміру.

**Коміт 5 (цей) — docs: бізнес-модель freemium зафіксована, GLOSSARY видалено**
- **Бізнес-модель:** freemium (безкоштовна + підписка), API через хмару. Зафіксовано у `FEATURES_ROADMAP.md`, `SESSION_STATE.md`, `CLAUDE.md` (секція `nm_gemini_key`).
- **`docs/GLOSSARY.md` видалено** — Роман вирішив що не треба окремого файлу-словника, він перепитає в Claude якщо зустріне незнайомий термін. Всі посилання на GLOSSARY прибрано з SESSION_STATE.md і CHANGES.md.

**Новий порядок кроків ДО Supabase:**
1. Уніфікація `followups.js` з `shouldOwlSpeak()` (0.5-1 сесія) — наступний крок
2. Структурована пам'ять фактів (1.5-2 сесії) — вирішує корінь бага "горло"
3. Semantic cooldowns — AI повертає `topic` (1 сесія)
4. Negative Memory `nm_negative_rules` (1 сесія)

**Файли змінено:**
- `src/ai/core.js` (коміт 1)
- `sw.js` (коміт 1)
- `.claude/commands/start.md` (коміти 2, 3)
- `CLAUDE.md` (коміт 3 + цей коміт)
- `РОМАН_ПРОФІЛЬ.md` (коміт 3)
- `FEATURES_ROADMAP.md` (цей коміт)
- `_ai-tools/SESSION_STATE.md` (цей коміт)
- `docs/CHANGES.md` (цей запис)

**Відкриті задачі:**
- Баг "горло" залатаний правилом в промпті, архітектурно виправиться у Кроці 2
- Деталізація freemium меж (що у безкоштовній версії, що в підписці) — окреме обговорення ДО Supabase
- SyncEngine деталі — окрема сесія проектування коли дійдемо до Supabase
- Тестування Фази 2 Live Chat Replies (follow-ups у чаті) на продакшені — не протестовано з 10.04

---

## 2026-04-10 — 🎯 4.1 Tool Calling — перехід AI на OpenAI function calling

**Що зроблено:**
- **`src/ai/core.js`**: Додано `INBOX_TOOLS` — 25 визначень функцій (save_task, save_note, save_habit, save_moment, create_event, save_finance, complete_habit/task, create_project, edit_*/delete_*/reopen_task, add_step, move_note, update_transaction, set_reminder, restore_deleted, save_routine, clarify). Додано `callAIWithTools()`. `_fetchAI()` приймає optional tools параметр, повертає message object коли tools передані, content string — коли ні.
- **`src/ai/core.js`**: `INBOX_SYSTEM_PROMPT` скорочено з ~200 рядків до ~30. Прибрано всі описи JSON-форматів, залишено тільки правила класифікації (task vs event vs project, НАГАДАЙ=set_reminder, список vs окремі задачі).
- **`src/tabs/inbox.js`**: Додано `_toolCallToAction()` конвертер. `sendToAI()` переписаний на tool calling dispatch. `sendClarifyText()` теж. Існуючі handlers (processSaveAction, processCompleteHabit, processCompleteTask, processUniversalAction) працюють БЕЗ змін через конвертер.
- **`sw.js`**: CACHE_NAME → `nm-20260410-0325`

**Переваги:**
- AI ніколи не поверне зламаний JSON — OpenAI гарантує валідну структуру
- Promt у 6-7 разів коротший → дешевше в токенах, більше контексту
- AI краще класифікує дії (окремі tools з чіткими описами)
- Backward compat: callAI/callAIWithHistory/callOwlChat працюють для tab chat bars і proactive.js

**Аудит виявив і виправив 6 багів:**
- 🔴 **CRITICAL:** `sendClarifyText` читав `clarifyOriginalText` ПІСЛЯ `closeClarify()` яка обнуляла його → AI отримував `"null"` замість тексту. Це був pre-existing bug і в старому коді — виправлено збереженням у локальну змінну.
- 🟡 `save_habit`: поле `details` губилось у конвертері → детальний опис звички втрачався. Тепер `parsed.details` використовується в processSaveAction якщо є.
- 🟡 `save_moment`: поле `mood` губилось → AI-класифікація настрою замінювалась regex fallback. Тепер `parsed.mood` використовується якщо є.
- 🟡 `edit_event`, `edit_note`, `edit_task`, `edit_habit`: поле `comment` не передавалось через конвертер.
- 🟢 Вкладені об'єкти у `save_routine.blocks` і `clarify.options` без `additionalProperties: false` — не ламає (strict mode вимкнений), але несумісно з майбутнім strict mode.
- 🟢 `callAIWithHistory` імпортувався в inbox.js але не використовувався — прибрано (знайдено першим аудитом).

**Змінені файли:** `src/ai/core.js`, `src/tabs/inbox.js`, `sw.js`, `_ai-tools/SESSION_STATE.md`, `CLAUDE.md`, `docs/CHANGES.md`

**Коміти:** 5 (феншуй-коміти на гілці `claude/start-session-HdqBj`)

**Що треба далі:** 4.2 Day State + Nightly Brain Dump, 4.3 Семантичні cooldowns, G1-G8 виправлення. 4.1 закрито.

---

---

## 2026-04-06 — B-16: Централізація системи чіпів + Roadmap проактивності

**Що зроблено:**

1. **B-16 (частково):** Система чіпів переписана — весь код чіпів зібрано в `src/owl/chips.js`:
   - `renderChips()` — єдина функція рендеру (видалено дублікати з `board.js` і `inbox-board.js`)
   - `CHIP_PROMPT_RULES` — єдиний текст правил для AI промптів (видалено 3 копії)
   - `handleCompletionChip()` — ✔️ чіпи закривають задачі/звички локально через fuzzy match
   - Чіпи зникають після кліку з анімацією
   - Промпт: "чіпи = відповіді юзера, НЕ заклики до дії"

2. **Roadmap:** Нова секція "Розумна проактивність агента" в `FEATURES_ROADMAP.md` — 12 ідей (кореляції, тригери всіх вкладок, ранковий бриф, емпатія, забуті задачі, авто-пам'ять, вивчення слів юзера).

3. **Баги:** B-16 і B-17 додані в `NEVERMIND_BUGS.md` з детальними описами.

**Файли змінено:** `src/owl/chips.js`, `src/owl/board.js`, `src/owl/inbox-board.js`, `src/owl/proactive.js`, `src/ai/core.js`, `sw.js`, `FEATURES_ROADMAP.md`, `NEVERMIND_BUGS.md`

**Відкрите:** B-16 залишок (чіпи-привиди на інших вкладках), B-17 (миттєва реакція табло).

---

## 2026-04-05 — Gemini workflow + глобальний клінап документації

**Що зроблено:**

**Частина 1 — Gemini інтеграція (попередні коміти цієї сесії):**
- Видалено невдалий експеримент `_ai-tools/gemini-mcp/` (Railway MCP-сервер, 357 рядків Node.js, SSE transport) — причина згортання: засвітився `GEMINI_API_KEY` у чаті → secret scanner Anthropic заблокував сесію. Railway-проект видалений окремо Романом.
- Створено скіл `/gemini` — ручний workflow: Claude збирає контекст (CLAUDE.md + SESSION_STATE + git diff + змінені файли + питання), виводить одним код-блоком з кнопкою Copy, Роман копіює в застосунок Gemini на iPhone (модель Pro), повертає відповідь у чат.
- Оновлено модель у скілі з 2.5 Pro на 3 Pro (актуальна станом на 04.2026).
- **Перший реальний тест скіла** на `src/owl/board.js` + `src/owl/chips.js` — workflow працює. Gemini знайшов 3 цінні моменти + 1 галюцинацію яку Claude заарбітрував.

**Частина 2 — Клінап документації (основа цієї сесії):**

Виявлено що документація застрягла між двома епохами: на етапі 01.04 була реструктуризація docs (CHANGES.md, SESSION_STATE.md, CONCEPTS_ACTIVE.md, FEATURES_ROADMAP.md), після цього — ES-modules рефакторинг коду (app-*.js → src/core/, src/ai/, src/owl/, src/ui/, src/tabs/). **Тільки таблиця файлів у CLAUDE.md оновилась, всі інші docs продовжували посилатись на app-*.js.**

4 коміти клінапу:

1. `docs(bugs): consolidate NEVERMIND_BUGS.md, migrate to src/ paths`
   - Видалено дубль `_ai-tools/NEVERMIND_BUGS.md` (мій випадковий новий файл)
   - `NEVERMIND_BUGS.md` (корінь) — source of truth. 7 старих багів (B-03..B-12) оновлено на `src/` шляхи, позначено "потрібна верифікація" (деякі могли виправитись під час рефакторингу — Роман перевірить у наступній сесії).
   - Додано 3 нові баги знайдені через `/gemini`: **B-13** (🔴 апостроф у `onclick` чіпів, `src/owl/board.js`), **B-14** (🟡 `includes()` false positives, `src/owl/chips.js`), **B-15** (🟢 setTimeout magic number, `src/owl/chips.js`).
   - Секція wontfix з галюцинацією Gemini про `<msg.id>` — урок на майбутнє.
   - `/fix` скіл оновлено: правильний шлях (корінь), новий крок оновлення BUGS після фіксу.

2. `docs(CLAUDE.md): migrate stale refs to src/ + add documentation map`
   - Таблиця "Дані (localStorage)": 19 рядків оновлено (`app-inbox.js` → `src/tabs/inbox.js` тощо).
   - Секція "Що не можна змінювати": `app-core-system.js` → `src/core/boot.js`.
   - "Міжмодульні залежності": переписано діаграму під `src/` структуру з поясненням esbuild збірки.
   - **Нова секція "Карта документації"** — таблиці "Читати коли..." (12 файлів) і "Писати/оновлювати коли..." (11 сценаріїв). Мета: новий чат знаходить потрібне одним лукапом, без запитів "куди писати?".

3. `docs: rewrite START_HERE.md + docs/ARCHITECTURE.md for src/ structure`
   - **`START_HERE.md`** — повністю переписано. Був найкритичнішим застарілим: містив карту з 13 `app-*.js` файлів. Тепер показує справжню `src/` ієрархію (core/ai/owl/ui/tabs). Додано посилання на `/gemini` скіл.
   - **`docs/ARCHITECTURE.md`** — переписано діаграми (mermaid) під `src/` структуру: граф модулів з підгрупами, Inbox flow, storage map, OWL triggers, memory system, tabs integration. Уточнено legacy-назву `nm_gemini_key` (OpenAI ключ).
   - **`NEVERMIND_ARCH.md` → `_archive/NEVERMIND_ARCH.md`** — повністю застарілий дубль `docs/ARCHITECTURE.md` (містив `index.html` з 2600 рядків замість реальних 1475). Перенесено в архів.

4. `docs: update FEATURES_ROADMAP + DESIGN_SYSTEM + changelog entry` (цей коміт)
   - `FEATURES_ROADMAP.md`: 3 посилання `app-ai-chat.js`/`app-ai-core.js`/`app-inbox.js` → `src/owl/*`/`src/ai/core.js`/`src/tabs/inbox.js`.
   - `docs/DESIGN_SYSTEM.md`: `setupModalSwipeClose знаходиться в app-tasks-core.js` → `src/tabs/tasks.js`.
   - Цей запис у `docs/CHANGES.md`.

**Що НЕ чіпалось (свідомо):**
- `src/`, `index.html`, `style.css`, `sw.js`, `bundle.js` — жодних змін у коді
- `CACHE_NAME` — не оновлюємо, бо в PWA кеш не потрапляє нічого з цієї сесії
- `NEVERMIND_LOGIC.md`, `CONCEPTS_ACTIVE.md`, `РОМАН_ПРОФІЛЬ.md` — timeless концептуальні документи, без посилань на код
- `_archive/` — історія не редагується
- Правила процесу, якість виконання, AI-логіка, деплой, OWL концепція у `CLAUDE.md`

**Відкрите на майбутнє:**
- Виправити 3 реальні баги знайдені через `/gemini`: B-13 (критичний, апостроф), B-14 (design smell), B-15 (low pri) — окрема сесія через `/fix B-13`
- Верифікувати 7 старих багів B-03..B-12 проти `src/` — деякі могли бути виправлені під час рефакторингу
- Допрацювати `/gemini` скіл: 5 покращень (import graph, анти-галюцинаційні правила, підключення BUGS.md, повний CLAUDE.md, самооцінка Gemini) — окрема сесія

**Частина 3 — Критичний аудит правил (2 додаткові коміти):**

5. `docs: fix remaining app-*.js refs in CLAUDE.md + rewrite /new-file skill` — фінальні залишки `app-*.js`, повний перепис скіла `/new-file` який був небезпечно застарілий (інструктував додавати файли в корінь проекту, реєструвати в `STATIC_ASSETS` і прописувати `<script>` теги — все це ламало б проект зараз).

6. `docs(rules): dedupe and clarify rules, add explanations in all terms` — критичний аудит правил:
   - Видалено 6 дублів між `CLAUDE.md` і `РОМАН_ПРОФІЛЬ.md`.
   - Об'єднано "Сперечайся" + "Пропонуй кращі рішення" в одне правило з акцентом "чесність > ввічливість" і вимогою пояснювати ЧОМУ (Роман вчиться через пояснення).
   - "Mockup перед кодом" переформульовано на "UI — опиши перед кодом" з трьома кроками (посилання на схожий компонент → опис словами → ASCII для нового).
   - Кожен пункт "Що не можна змінювати" переписано з поясненнями в дужках (localStorage.setItem override, circular dependencies, bfcache, setupSW, порядок імпортів, централізована БД-абстракція).
   - "Чеклист аудиту" скорочено до одного речення з посиланням на скіл `/audit`.
   - Додано виняток для `CACHE_NAME`: не міняти при docs-only комітах.
   - Видалено "Прибирати gesture swipe" — не правило, а опис функціональності.
   - Додано секцію "❌ Заборонені кольори" в `docs/DESIGN_SYSTEM.md` з правилом про фіолетовий.

**Частина 4 — Посилення правила "Пояснення в дужках":**

7. (цей коміт) — Роман зауважив що Claude постійно порушує правило №1 протягом сесії. Посилено формулювання:
   - Явний список "коли додавати пояснення" (англіцизми, терміни, сленг, назви функцій)
   - Додано механізм **САМОПЕРЕВІРКИ перед надсиланням** (проскануй текст на англомовні слова без дужок)
   - Пояснено чому критично: Роман підприємець, не розробник, вчиться через пояснення. Без них — не може прийняти рішення.
   - Фінальне уточнення: "Це правило ВАЖЛИВІШЕ за стислість".

**Результат сесії:**
- 10 комітів на гілці, всі запушені
- Документація у повністю узгодженому стані, жодних посилань на застарілу `app-*.js` структуру в активних файлах
- Нова чітка "Карта документації" в `CLAUDE.md` — новий чат знаходить куди писати за один лукап
- Скіл `/gemini` робочий, перший тест успішний (3 реальні баги знайдено)
- 3 нові баги записані для наступної сесії через `/fix B-13/B-14/B-15`
- Правило №1 (пояснення в дужках) посилено з механізмом самоперевірки

**Змінені файли (вся сесія):** `NEVERMIND_BUGS.md`, `CLAUDE.md`, `START_HERE.md`, `РОМАН_ПРОФІЛЬ.md`, `docs/ARCHITECTURE.md`, `docs/DESIGN_SYSTEM.md`, `docs/CHANGES.md`, `FEATURES_ROADMAP.md`, `.claude/commands/fix.md`, `.claude/commands/new-file.md`, `.claude/commands/gemini.md` (новий), `_ai-tools/SESSION_STATE.md`, `_ai-tools/NEVERMIND_BUGS.md` (видалено — був дублем), `_archive/NEVERMIND_ARCH.md` (перенесено з кореня), `_ai-tools/gemini-mcp/` (видалено — 5 файлів експерименту)

---

## 2026-04-01 — Реструктуризація документації

**Що зроблено:**
- `CLAUDE.md` переписано: всі правила з 5 файлів зведено в одне місце + 2 нові правила якості (CSS верифікація, діагностика перед ретраєм)
- `START_HERE.md` спрощено: mandatory reading = SESSION_STATE + BUGS (~80 рядків замість 192)
- `_ai-tools/SESSION_STATE.md` розширено: версія, гілка, останні сесії, відкриті баги
- `_archive/` створено: РОМАН_ПРОГРЕС.md, decisions.md, NEVERMIND_STATUS.md, CHANGES_OLD.md
- `ШПАРГАЛКА_CLAUDE.md` видалено (гайд для Романа, не для Claude)
- `NEVERMIND_LOGIC.md` очищено: тільки концепція + OWL принципи (без правил)
- `CONCEPTS_ACTIVE.md` + `FEATURES_ROADMAP.md` створено (розділено з NEVERMIND_CONCEPTS.md)

**Змінені файли:** `CLAUDE.md`, `START_HERE.md`, `_ai-tools/SESSION_STATE.md`, `NEVERMIND_LOGIC.md`, `CONCEPTS_ACTIVE.md` (новий), `FEATURES_ROADMAP.md` (новий), `_archive/*`

---

## 2026-04-01 — B-11/B-12: фікс padding в модалках + крок фону

**Що зроблено:**
- `index.html` рядок ~957: `padding:0 20px` на outer panel (`overflow:hidden`) модалки задачі
- `index.html` рядок ~1129: `padding:0 20px` на outer panel модалки звички
- `app-tasks-core.js` рядок 116: фон кроків задачі → `rgba(255,255,255,0.7)` з бордером (як поля вводу)
- `docs/DESIGN_SYSTEM.md`: задокументовано структуру модального вікна і ⚠️ типову помилку з padding
- **Ключовий інсайт:** padding треба ставити на outer `overflow:hidden` елемент, не на inner `overflow-y:auto`
- `sw.js`: CACHE_NAME → `nm-20260401-0720`

**Змінені файли:** `index.html`, `app-tasks-core.js`, `docs/DESIGN_SYSTEM.md`, `sw.js`

---

## 2026-04-01 — Фікс deploy pipeline v2: deploy прямо в auto-merge.yml

**Що зроблено:**
- `.github/workflows/auto-merge.yml`: додано job `deploy` (needs: merge). Тепер merge і deploy — один workflow, без крос-workflow тригерів.
- `.github/workflows/deploy.yml`: прибрано `workflow_run` тригер. Залишено тільки `push: main` (резерв для хотфіксів).
- `sw.js`: CACHE_NAME → `nm-20260401-0448`.
- **Причина:** `workflow_run` ненадійний — GitHub часто пропускає/затримує ці події.

**Змінені файли:** `.github/workflows/auto-merge.yml`, `.github/workflows/deploy.yml`, `sw.js`

---

## 2026-03-31 — Deploy pipeline fix: GitHub Pages не оновлювався

**Що зроблено:**
- `.github/workflows/deploy.yml`: додано `workflow_run` тригер на завершення `auto-merge.yml`.
- Додано умову `if: success`, `ref: main` в checkout.
- `sw.js`: CACHE_NAME → `nm-20260331-1846`.

**Змінені файли:** `.github/workflows/deploy.yml`, `sw.js`

---

## 2026-03-31 — B-10: чат авто-розгортається при переключенні на Inbox

**Що зроблено:**
- `app-core-nav.js`: видалено блок `// Inbox чат завжди відкритий` в `switchTab()`. Тепер стан чату зберігається як є.

**Змінені файли:** `app-core-nav.js`, `sw.js`

---

## 2026-03-31 — B-07/B-08 + надійне оновлення iOS PWA

**Що зроблено:**
- `app-tasks-core.js`: B-07 — крок ставить галочку тільки якщо тач рухнувся < 10px (тап, не свайп)
- `app-tasks-core.js`: B-08 — `toggleTaskStep()` повертає `task.status = 'active'` якщо не всі кроки виконані
- `app-core-system.js`: iOS PWA — переписано `setupSW()`: синхронна реєстрація, `pageshow` для bfcache, `location.replace()` замість `reload()`

**Змінені файли:** `app-tasks-core.js`, `app-core-system.js`, `sw.js`

---

## 2026-04-18 — 🪝 Хук контексту + фікси звичок і свайпу (сесія Vydqm)

### Контекст
Роман запитав про prompt cache TTL і контекст Opus 4.7: "правда що 4.7 тримає контекст 5 хв і перечитує?" — пояснено що це плутанина між TTL prompt cache (5 хв hardcoded) і context window (1M у 4.7). Після обговорення виник запит: зробити хук який попереджає коли контекст наближається до ліміту, щоб не пропустити момент auto-compaction.

### Зроблено

**1. Новий хук `.claude/hooks/context-warning.sh` (52 рядки)**
- `UserPromptSubmit` хук: перед кожним повідомленням Романа читає `transcript_path` з JSON input, рахує приблизний розмір у токенах (`байти/3`), попереджає при перевищенні порогу.
- Два рівні попередження:
  - **800K (~80%)** — ⚠️ "час думати про `/finish`"
  - **900K (~90%)** — 🚨 "критично, скоро auto-compaction"
- Нижче 800K — тихий вихід (нічого не показує).
- Параметр `BYTES_PER_TOKEN=3` — калібрується порівнянням з реальним `/context` коли поріг зловиться у живій сесії.
- Smoke-тестовано: при відсутньому transcript тихо виходить з EXIT_OK.

**2. Реєстрація у `.claude/settings.json`**
- Додано другим пунктом у `UserPromptSubmit` масив хуків (поруч з `rules-reminder.sh`).
- Claude Code виконує хуки в одному event послідовно.

### Обговорено (без виконання)

- **Prompt cache TTL у Claude Code:** не налаштовується user-side. 5 хв зашиті у CLI, 1-год кеш — тільки через API напряму (~2x дорожче за write). Висновок: не робити довгих пауз у межах одної задачі.
- **Opus 4.7 vs 4.6 context:** 4.7 має **більше** вікно (1M vs 200K стандартно у 4.6). Публічна плутанина "4.7 тримає 5 хв" описує TTL кешу, не "пам'ять моделі".
- **`/context` vs хук:** команда `/context` — точна (з API), викликається руками; хук — апроксимація (bytes/3), автоматична між повідомленнями. Взаємодоповнюючі.
- **iOS застосунок vs комп для хуків:** не має значення, Claude Code крутиться у контейнері на серверах Anthropic, хуки з `.claude/` репо працюють після `git pull` незалежно від клієнта.

### Ключові рішення

- **Поріг 800K (80%)** — запас ~20 повідомлень до auto-compaction близько 950K.
- **Апроксимація через байти transcript** — компроміс між простотою bash і точністю. Tuning у живій сесії через `/context`.
- **Хук ДОДАЄТЬСЯ до масиву, не замінює** — `rules-reminder` продовжує працювати.

### Файли

- `.claude/hooks/context-warning.sh` — новий (52 рядки)
- `.claude/settings.json` — +4 рядки (реєстрація другого хука у UserPromptSubmit)
- `_ai-tools/SESSION_STATE.md` — ротація (14zLe → архів, Vydqm додано)
- `_archive/SESSION_STATE_archive.md` — додано блок 14zLe
- `NEVERMIND_BUGS.md` — ротація (KTQZA → архів)
- `_archive/BUGS_HISTORY.md` — додано 10 багів KTQZA

### Додатково — фікси після першого /finish

**Фікс звичок (`88f4348` — `src/tabs/habits.js`)**
- Жовта галочка (подвійне виконання) не показувалась у ряду днів тижня — truthy check не розрізняв стани 1 і 2.
- `getHabitWeekDays(id, target)` повертає `{i, bonus}`. `makeHabitDayDots` рендерить жовтий градієнт `#fbbf24→#f59e0b` для bonus.
- Семантика жовтої галочки: "виконав двічі за день" (не "скасовано"). `_habitDone (cur >= target)` вже коректний — стрік і % не чіпали.

**Фікс свайп-видалення (`265a23c` — `src/ui/swipe-delete.js`)**
- Відстань свайпу: `openRatio` default 0.22→0.5. Тепер скрізь (Inbox/Tasks/Notes/Habits/Finance) картка зсувається на півширини як в Операціях.
- Анімація закриття: bin (червоний кошик) тепер отримує `opacity:0` з transition 0.25s ease паралельно з поверненням картки — синхронне зникнення замість різкого DOM-видалення наприкінці.

**B-80 новий баг:** layout glitch при видаленні папки у Нотатках — чіпи OWL-бабла перекриваються першою папкою на ~250мс, потім само-виправляється. Косметика, не фіксили (потрібен дебаг на пристрої).

### Метрики

- **Коміти:** `07d5136` → `265a23c` (5 + docs через /finish).
- **Файли коду:** `.claude/hooks/context-warning.sh` (новий), `src/tabs/habits.js`, `src/ui/swipe-delete.js`, `sw.js` (CACHE_NAME).
- **Файли документації:** SESSION_STATE, BUGS (+ архіви через перший /finish), CHANGES.
- **CACHE_NAME:** `nm-20260418-1128` (оновлено двічі у сесії).

---

## 2026-04-18 — 🎙️ Голосовий ввід + 4.17 UI Tools Suite + AI_TOOLS.md (сесія VJF2M)

**Зроблено:**

**1. Голосовий ввід у всіх 8 чат-барах** (`src/ui/voice-input.js`, 137 рядків, коміт `76fe682`):
- Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`), `lang='uk-UA'`.
- Автоматично додає кнопку 🎤 у кожен `.ai-bar-input-box` при DOMContentLoaded.
- Inbox: активує існуючу `disabled` кнопку. Решта 7 (finance/notes/tasks/me/evening/health/projects): створює нову перед send-btn.
- Interim results → live-оновлення textarea. Пауза → автостоп (`onend`).
- Червоне пульсування `.voice-btn.recording` + `@keyframes voice-pulse`.
- Натискання send-btn під час запису → автоматична зупинка + відправка через `pendingSendClick` flag і програмний клік у `onend` через 60мс (коміт `fcb9306`).
- Fallback: якщо браузер без підтримки SpeechRecognition — кнопка не з'являється.

**2. Довідник `docs/AI_TOOLS.md`** (новий, коміт `313279c`):
- Єдине місце правди для 47 tools (39 існуючих INBOX_TOOLS + 8 нових UI).
- Категорії існуючих: CREATE (7) / COMPLETE (2) / EDIT (4) / DELETE (4) / ІНШЕ (7) / ЗДОРОВ'Я (9) / ПАМ'ЯТЬ (1) / КАТЕГОРІЇ ФІНАНСІВ (5).
- Категорії UI: A. Навігація / C. Фільтри / D. Середовище / E. Операційні.
- Секції: Промпт-правила, Зв'язки/диспетчеризація, Історія змін.
- Посилання на AI_TOOLS.md додані у `CLAUDE.md` (Карта документації "Читати" + "Писати"), `START_HERE.md`, `.claude/commands/prompt-engineer.md`.
- Бонус: виправлено rot у `/prompt-engineer` — старі посилання `src/ai/core.js` → актуальні `src/ai/prompts.js` (після винесення промптів 17.04 14zLe).

**3. 4.17 UI Tools Suite — 8 реалізованих hands-free навігаційних tools** (`src/ai/ui-tools.js`, 210 рядків, коміт `6f128b1`):
- `switch_tab` — перемкнути вкладку ('покажи календар')
- `open_memory` — модалка Пам'яті ('що ти про мене знаєш')
- `open_settings` — модалка Налаштувань
- `set_finance_period` — перемикач тиждень/місяць/3 місяці у Фінансах
- `open_finance_analytics` — екран 📊 (switchTab+openFinAnalytics)
- `set_theme` — light/dark (settings.theme + applyTheme)
- `set_owl_mode` — coach/partner/mentor (settings.owl_mode)
- `export_health_card` — модалка медкартки
- Підключення: `prompts.js` імпортує `UI_TOOLS` і spread-додає до `INBOX_TOOLS`. `INBOX_SYSTEM_PROMPT` — нова секція UI TOOLS з правилами + принцип мінімального тертя (агент НЕ відкриває порожні форми, для CRUD — `save_task`/`save_finance` напряму).
- `inbox.js`: у tool_calls dispatch — `UI_TOOL_NAMES.has(...)` check ПЕРЕД `_toolCallToAction` → `handleUITool(name, args)` → `addInboxChatMsg(reply)`.
- 6 заблокованих (open_record, open_trash, calendar_jump_to, filter_tasks, clear_chat, toggle_owl_board) — винесено у ROADMAP 4.17.B як окремі підзадачі (потребують нової інфраструктури).

**4. 4 post-тест фікси на живому пристрої:**
- **`b0c41a5`:** `openMemoryModal` імпортувався з `core/nav.js` але живе тільки у `window.openMemoryModal`, без `export`. esbuild падав — деплой v247 провалився. Фікс: виклик через `window.openMemoryModal()`.
- **`ca5981d`:** `switchTab('calendar')` падав з TypeError бо `page-calendar` не існує. Календар — модалка, не вкладка. `habits` — частина вкладки Продуктивність. Додано aliases у handleUITool: `calendar` → `window.openCalendarModal()`, `habits` → `switchTab('tasks')`.
- **`fcb9306`:** send-btn під час запису → stop + програмний click (описано вище у п.1).
- **`31eeeb8`:** прибрано toast підтвердження UI tools (Роман: "бабл що знизу появляється і зникає"). У чаті Inbox reply лишається як історія.

**Обговорено/прийнято:**
- Список UI tools — 14 варіантів (A/B/C/D/E). Роман відкинув Блок B (відкриття порожніх форм створення) через принцип мінімального тертя: агент виконує CRUD напряму, не відкриває форми.
- 6 заблокованих tools винесено у 4.17.B (потребують search API, UI модалки кошика, per-chat storage, toggle state).
- Структура документа `docs/AI_TOOLS.md` — єдиний довідник з категоризацією + промпт-правилами + зв'язками (dispatcher у `inbox.js`, handlers у `ui-tools.js`).
- 4.15 `switch_tab` консолідовано у 4.17 (4.15 лишився як історична довідка).

**Ключові рішення:**
- **Принцип мінімального тертя** зафіксовано у 4.17: UI tools НЕ відкривають порожні форми створення.
- **Довідник tools окремо від промптів:** `docs/AI_TOOLS.md` описовий (для людей + Claude при читанні), `src/ai/prompts.js` + `src/ai/ui-tools.js` виконавчі.
- **Workflow "тест на пристрої → фікс → коміт"** дав 3 швидкі цикли: підтверджено що Роман тестує у реальному часі, треба швидко реагувати.

**Інциденти:**
- Деплой v247 провалився через нефіксовий імпорт. Урок: перед комітом з новим імпортом — `node build.js` локально АБО виклик через `window.fn()` (feature-detect).
- Без git reset / force push — усі 8 комітів нормальні.

**Файли:**
- **Нові:** `src/ui/voice-input.js`, `src/ai/ui-tools.js`, `docs/AI_TOOLS.md`.
- **Змінені код:** `src/app.js` (імпорти), `src/ai/prompts.js` (UI_TOOLS spread + промпт-секція), `src/tabs/inbox.js` (dispatch), `style.css` (voice-btn стилі), `sw.js` (CACHE_NAME×4).
- **Змінені документація:** `CLAUDE.md` (AI_TOOLS у Карті), `START_HERE.md`, `ROADMAP.md` (4.17 + 4.17.B + voice ✅), `.claude/commands/prompt-engineer.md` (rot fix + AI_TOOLS посилання).

**Метрики:** 8 комітів (`3ec8bb5` → `76fe682` → `313279c` → `6f128b1` → `b0c41a5` → `ca5981d` → `fcb9306` → `31eeeb8`), **v243 → v250+**, CACHE_NAME `nm-20260418-1508` (4 рази оновлено у сесії).

---

## 2026-04-19 — 🦉 Handoff дизайну сови + базова PNG-інтеграція (сесія w3ISi)

**Що зроблено:**
- Роман через GitHub веб завантажив пакет дизайну у `handoff/`: README.md (інструкція), 4 варіанти коду (Owl.html / Owl.css / Owl.js / OwlReact.jsx), 5 PNG станів (idle/alert/thinking/greeting/error, ~1.2 МБ кожна).
- Перенесено 5 PNG з `handoff/assets/owl/` у `assets/owl/` (робоче місце для PWA кеша).
- У `style.css` додано класи `.owl-mascot` (float 4с) + `.owl-mascot-frame` (кросфейд 400мс між станами) + селектори `[data-state=*]` + `prefers-reduced-motion` виняток.
- У `index.html:275` замінено емодзі 🦉 у `.owl-speech-avatar` (головне табло Inbox) на `.owl-mascot` контейнер з 5 `<img>`. Активний стан — `idle` за замовчуванням.
- Інші місця 🦉 (tab boards, collapsed state, онбординг) — **не чіпав** (Роман просив спочатку тільки головне табло).
- CACHE_NAME bump: `nm-20260418-1610` → `nm-20260418-2212`.

**Обговорено/прийнято:**
- Назва папки `handoff/` (не `_design/`) — стандартний термін у дизайні, зрозуміліший.
- Покачування сови 4с — постійно активне ("хай шивелиться постійно").
- WebP конвертація відкладена — локально немає cwebp/ImageMagick/Pillow, PWA Service Worker кешує PNG cache-first (перше завантаження ~6 МБ, далі швидко).
- Я видав промпт англійською для Gemini щоб Роман міг перегенерувати 5 станів сови з чистим прозорим фоном у разі якщо оригінальні PNG мають проблему.

**Не зроблено (наступна сесія):**
- Автоматична зміна стану маскота: alert (нове Inbox board msg), thinking (AI запит), error (fetch fail), greeting (перший вхід за день).
- Заміна емодзі 🦉 на інших 5 вкладках + згорнутому стані.
- JS-контролер станів `src/owl/mascot.js`.

**Інциденти:**
- Гілка `claude/start-session-w3ISi` не існувала на GitHub при старті (локальна у runtime) — запушена після згоди Романа.
- Двічі помилково стверджував "PNG мають запечений шаховий візерунок" — насправді це була індикація прозорості у переглядачі. Finder підтвердив альфа-канал Так. Невирішене питання: чому на iPhone PWA скріншоті Inbox видно шаховий на бежевому — треба перевірити на телефоні після деплою v259+.

**Файли:**
- `handoff/` нова папка (README.md, components/, assets/owl/*)
- `assets/owl/` 5 PNG (переміщено з handoff)
- `index.html` (заміна емодзі у `.owl-speech-avatar`)
- `style.css` (+44 рядки класів маскота)
- `sw.js` (CACHE_NAME bump)

**Оновлення у другій половині сесії (після першого /finish):**

- Автоматичні стани маскота (коміт `53e64fd`): `setOwlMascotState(state, autoRevertMs)` у `src/owl/board.js`, hook у `src/ai/core.js _fetchAI` (thinking/error). Alert на нове board повідомлення, thinking під час AI запиту, error на fail.
- Sprite-sheet анімація greeting (6 кадрів, коміт `a35db21`): CSS `steps(6)` анімація `background-position` за 0.9 сек.
- Ітерації розміру sprite: v1 (632×395) — пропорції кадрів були 105×395 (вузькі високі), у квадратному контейнері сплющувались. Відкотив auto-trigger (`c056c0d`). Роман згенерував v2 через Claude Design (1536×256, квадратні кадри 256×256, retina-ready), встановив, увімкнув назад (`ac274fd`).
- **Невирішена проблема:** greeting auto-trigger на boot конфліктує з alert (Inbox board повідомлення) — alert перебиває greeting через 1-2 сек, виглядає як "моргання". Наступна сесія: priority або умовний тригер "перший вхід за день".
- Якість анімації — Gemini/AI згенеровані кадри не ідеально послідовні, видно мікро-тремтіння. Production якість — тільки After Effects (Lottie) або Runway.

**Метрики (повні):** 9 комітів (`3f32b48` → `a58104b` → `53e64fd` → `a35db21` → `e6200ac` → `4d98985` → `173199f` → `c056c0d` → `785ad01` → `ac274fd`), **v256 → v268+**, CACHE_NAME `nm-20260418-2212` → `nm-20260419-0200`.

---

## 2026-04-19 — 🦉 Анімація сови: етап 2 — priority state-machine + SVG-крило + нові PNG (сесія uDZmz)

**Що зроблено:**

1. **Priority state-machine сови** (`src/owl/board.js`) — `OWL_PRIORITY` (error=100 > alert=80 > thinking=60 > greeting=40 > idle=0), ticket-лічильник `_owlMascotTicket`, failsafe 30с для циклічних станів. Нижчий пріоритет не перебиває вищий. Вирішує w3ISi конфлікт greeting↔alert. Коміт `5ed8d05`.
2. **`visibilitychange` pause** — клас `.is-paused` на `#owl-mascot-main` + CSS `animation-play-state: paused !important`. Економія батареї у фоні.
3. **SVG-крило overlay** (`index.html` + `style.css`) — видалено sprite-sheet, додано `<svg class="owl-wing-overlay">` + `@keyframes wing-wave-premium` (безшовний, cubic-bezier). Для thinking — нахил голови 8°. Коміт `585cbbd`.
4. **Debug-режим постійного махання** (тимчасово) — `.owl-wing-overlay { opacity: 1 !important; outline: 2px dashed red }`. Для діагностики. Коміт `e4bba2d`. **Прибрати у наступній сесії.**
5. **Заміна PNG сови** — нові `owl-idle.png` (спокій) + `owl-greeting.png` (з піднятим крилом) у стилі amber/brown з прозорим фоном. Коміти `a49d1eb`, `3ffd627`.

**Обговорено/прийнято:**

- **Flipbook-махання (план на наступну сесію):** прибрати debug, замінити SVG-крило на швидке перемикання `opacity` між двома новими PNG 3 рази × 150мс при `data-state="greeting"`. SVG-крило візуально не прижилось на статичному PNG-тілі. Flipbook природніший.
- **Gemini промпт-інжиніринг** через `/gemini` — 4 раунди (priority → hybrid SVG → ticket pattern → performance). Знайдено 4 баги у пропозиціях Gemini і виправлено перед впровадженням.
- **Claude Design для handoff ассетів** — обривається generate, не підходить. Claude з Artifacts кращий.

**Ключові рішення:**

- **Priority + ticket pattern** — захист від race conditions при швидких переключеннях.
- **Debug через `outline: 2px dashed red`** — швидкий спосіб побачити невидимий елемент на мобільному без DevTools.
- **Flipbook з 2 PNG краще sprite-sheet з 6** — синтезує махання через швидке перемикання, без артефактів AI-генерації між кадрами.

**Інциденти:**

- **Контекст 220%+** — 30+ нагадувань `/finish`, stream-обриви у Gemini.
- **Крок 2 в 2 етапи** — `git stash pop` розділив state-machine і SVG-крило.
- **PNG з неправильними іменами** — `git mv` з видаленням старих файлів.
- **Без reset / force push.** 5 комітів normal.

**Файли:**
- `src/owl/board.js` — priority state-machine + visibilitychange
- `style.css` — SVG-крило + wing-wave-premium + head-tilt + is-paused + debug-блок
- `index.html` — заміна sprite-div на SVG-крило
- `sw.js` — CACHE_NAME bumps до `nm-20260419-0438`
- `assets/owl/owl-idle.png` + `assets/owl/owl-greeting.png` — нові PNG

**Метрики:** 5 комітів (`5ed8d05` → `585cbbd` → `e4bba2d` → `a49d1eb` → `3ffd627`), **v272 → v274+**, CACHE_NAME `nm-20260419-0438`. Гілка `claude/bird-wing-animation-uDZmz`.

---

## 2026-04-19 — сесія dIooU — Вечір 2.0 MVP виконаний повністю (Ф1-8)

**Зроблено:**
Усі 8 фаз Вечора 2.0 з `docs/EVENING_2.0_PLAN.md` реалізовано у одній сесії (8 комітів).

- **Ф1 `dfb1800`** блокування матовим склом до 18:00 + анімація .melting + auto-lock о 23:59
- **Ф2 `f8d98a9`** `getEveningContext()` + підключення у getAIContext — сова бачить вечірній зріз у ВСІХ чатах
- **Ф3 `3479344`** тригер `_checkEveningPrompt` у followups + `getEveningPromptSystem` промпт + червона крапка на Надіслати + централізоване clearUnreadBadge у openChatBar
- **Ф4 `b7e3070`** chips у діалозі: `getEveningChatSystem` з JSON {text,chips}, парсер у sendEveningBarMessage, `.chat-chips-row` amber CSS, bugfix `chips.js` evening-bar-input id
- **Ф5 `bc847bb`** переробка вмісту вкладки: видалено кільце/плитки/Фінанси/OWL-підсумок/EVENING_SUMMARY_PROMPT/autoEveningSummary/setupAutoEveningSummary, додано renderEveningUndoneTasks з чіпами На завтра/На тиждень, renderEveningQuitHabits з Тримався/Зірвався
- **Ф6 `6a99372`** дві CTA "📅 Поговорити про завтра" / "📔 Записати свій день" + `openEveningTopic(topic)` 1×/день. Видалено фуллскрін #evening-dialog + dialog-функції як dead code
- **Ф7 `f957e94`** повний перехід на OpenAI tool calling (callAIWithTools+INBOX_TOOLS), новий dispatchEveningTool у `src/tabs/evening-actions.js` (22 tools БЕЗ Inbox side-effects), промпт з Verify Loop + Memory Echo + G13 Brain Dump + 4.12 антидублювання, _parseContentChips
- **Ф8 `83e42a0`** ритуал закриття дня: `getEveningSummaryPromptV2` (Episode Summary + Mirror Mode + Memory Echo, заборона цифр), generateEveningRitualSummary + isEveningClosed + markEveningClosed, третя темна CTA "🌙 Закрити день" з amber-бордером, значок "✓ День закрито" у header через listener nm-evening-closed. Fix addFact позиційних args.

**Обговорено/прийнято:**
- `add_routine_block` пропущено через конфлікт зі схемою `nm_routine['mon']` — повна реалізація Динамічного розпорядку — окрема фіча у ROADMAP.
- Окремий dispatcher у evening-actions.js замість реюзу processSaveAction з inbox.js — щоб вечірні дії не засмічували nm_inbox.
- Блок "OWL · підсумок дня" видалено у Ф5 замість Ф8 — щоб не було дублю з тригером evening-prompt Ф3.
- Chips у content як окремий JSON блок (не весь content JSON) — щоб tool_calls + Verify Loop + chips співіснували.

**Файли:**
- `index.html` — overlay блокування, розмітка нового вмісту, CTA кнопки, значок
- `style.css` — .evening-lock-overlay + melting анімація, .chat-chips-row/.chat-chip
- `sw.js` — CACHE_NAME 1131 → 1708 (5 bump-ів за сесію)
- `src/core/boot.js` — прибрано setupAutoEveningSummary виклик
- `src/ai/core.js` — +getEveningContext імпорт, +clearUnreadBadge універсально у openChatBar
- `src/ai/prompts.js` — +getEveningPromptSystem (Ф3), +getEveningChatSystem (Ф4→Ф7 tool calling), +getEveningSummaryPromptV2 (Ф8)
- `src/owl/followups.js` — +_checkEveningPrompt тригер + evening-prompt у TRIGGER_TO_TAB
- `src/owl/chips.js` — fix sendChipToChat inputId для evening
- `src/tabs/evening.js` — isEveningLocked/updateEveningLock, getEveningContext, renderEveningUndoneTasks, renderEveningQuitHabits, updateEveningClosedBadge, listener
- `src/tabs/evening-chat.js` — переписано на tool calling, openEveningTopic, closeEveningDay, _parseContentChips, showUnreadBadge logic
- `src/tabs/evening-actions.js` — заготовка 30 рядків → повний dispatcher ~280 з 22 tools + generateEveningRitualSummary + isEveningClosed

**Метрики:** 8 комітів (dfb1800...83e42a0), v291→v298+, CACHE_NAME `nm-20260419-1708`

---

## 19.04.2026 — сесія 6GoDe

**Зроблено:**
- **Fix `switch_tab` TypeError (e650c8f).** Три шари захисту: guard у `switchTab()`, DOM-check у `handleUITool`, `strict:true` у function definition. Сова не падає коли вигадає неіснуючу вкладку.
- **Fix фантомних "sw.js load failed" у логах (e634b12).** Додав `.catch()` на 3 виклики `reg.update()` у `setupSW()`. Шум 7+/добу зник.
- **Downgrade 3 console.warn→log (fc73b8e).** stale message, smart fallback, tab fallback — інформаційні події, не попередження.
- **Softer Auto-silence 4.40 (480604c).** Поріг 5→7, тиша 4→2 год, listener `nm-data-changed` скидає лічильник при будь-якому CRUD.
- **Health legacy cleanup (a0344ee + 3143364 + 36187f1).** Прибрано `getHealthLog`/`saveHealthLog`, legacy блок у `getHealthContext`, action `log_health`, 2 мертві кореляції, cross-tab listener, додано міграцію v6. Net: -92 рядки.
- **Health interview перед create_health_card (ccd09b2).** Нове правило у `INBOX_SYSTEM_PROMPT` (Фаза 6): 1-3 питання з чіпами перед створенням нової картки.

**Обговорено/прийнято:**
- 4.17.B 6 заблокованих UI tools — відкладено, спершу перевірити на iPhone чи 8 існуючих юзаються.
- Варіант B для шкал Здоров'я — відкинули: без UI для щоденного вводу кореляції ніколи не дають реальних даних.

**Файли:**
- `src/core/nav.js` — guard у switchTab
- `src/core/boot.js` — .catch() на reg.update() + drop nm_health_log listener + migration v6
- `src/ai/ui-tools.js` — DOM-check у switch_tab + strict:true
- `src/ai/prompts.js` — секція ЗДОРОВ'Я — ІНТЕРВ'Ю при створенні картки (Фаза 6)
- `src/owl/proactive.js` — downgrade warn→log, CRUD listener для 4.40, прибрано 2 кореляції + health board context
- `src/owl/inbox-board.js` — downgrade warn→log stale message
- `src/tabs/health.js` — прибрано getHealthLog/saveHealthLog + legacy блок у getHealthContext + action log_health
- `sw.js` — CACHE_NAME 1708→1912

**Метрики:** 8 комітів (e650c8f...ccd09b2), v300→v301+, CACHE_NAME `nm-20260419-1912`, -92 рядки мертвого коду, +1 localStorage прапор `nm_health_log_cleared_v6`, закрито B-65.

---

## 2026-04-20 — сесія g05tu — рефакторинг документації + «мозок» Claude

**Що зроблено:** 5 фаз рефакторингу документації (6 комітів на гілці `claude/start-session-g05tu`). Навели порядок у доках через переміщення блоків у спеціалізовані файли + створили "мозок" Claude (lessons, INDEX, автоматичні хуки) щоб у новому чаті швидше орієнтуватись. Код проекту НЕ чіпали — тільки `.md` файли і `.claude/`.

**Обговорено/прийнято:**
- Стратегія рефакторингу (не стиснення а переміщення блоків) — Роман чітко сказав: документи це його зовнішня пам'ять проекту, не можна втрачати текст
- Один `lessons.md` замість 3 паралельних журналів (patterns/anti-patterns/decisions) — менше точок підтримки
- INDEX.md робимо останнім коли всі файли вже на місцях — інакше посилання у порожнечу
- Не робити "людський фактор" хуки (детекція "поганий"/"хуйня") — контроль емоцій через хуки = мания контролю
- Реалістична оцінка економії: −26% на старті + JIT-читання через INDEX −60-80% на глибинних відповідях. НЕ 10000× як фентезі-ідея.
- Чесно розібрали ілюзії: "мова у 10000 разів інформативніше" неможлива, "памʼять між чатами" обмежена архітектурою LLM, "сам собі додаю код" = тільки з дозволу Романа

**Файли (створено):**
- `ROADMAP_DONE.md` — виконане з ROADMAP (завершені Active, Блок 1, 6 фаз Здоров'я, хронологія ✅ Done, аудит 15.04)
- `docs/FILE_STRUCTURE.md` — повна таблиця файлів
- `docs/GIT_EMERGENCY.md` — процедура скиду + історія v54-v130
- `docs/DO_NOT_TOUCH.md` — священні корови
- `docs/FINANCE_V2_PLAN.md` — 6 фаз Фінансів v2
- `lessons.md` — щоденник уроків Claude (патерни / анти-патерни / рішення)
- `_ai-tools/INDEX.md` — семантичний індекс "куди йти за чим"
- `_ai-tools/REFACTOR_PLAN.md` — план рефакторингу з hash'ами фаз
- `.claude/hooks/cache-name-reminder.sh`, `md-index-reminder.sh`, `ai-tools-sync.sh`, `skill-triggers.sh`

**Файли (змінено):**
- `CLAUDE.md` 521→416 — прибрано блоки що переїхали (Файлова структура / Плани на розвиток / Архітектурний принцип / Екстрений скид / Що не змінювати), оновлено Карту документації
- `ROADMAP.md` 715→539 — прибрано завершене + фази Здоров'я + фази Фінансів v2 + ✅ Done хронологія
- `_ai-tools/SESSION_STATE.md` 293→103 — компактний формат: таблиця сесій + бриф поточної
- `START_HERE.md` 114→56 — тільки точка входу
- `NEVERMIND_LOGIC.md` 56→85 — додано "Один мозок на все"
- `.claude/settings.json` — підключено 4 нові хуки
- `ROADMAP_DONE.md` — додано рефакторинг g05tu у Завершені Active

**Метрики:** 6 комітів (`d8ecab1` → `13b843d`), CACHE_NAME `nm-20260420-1120` не чіпали (тільки документаційні зміни), стартове читання 2164→1593 рядки (−26%), 7 нових файлів, 0 багів закрито (це був рефакторинг документації).

---

## 2026-04-20 — сесія 2Veg1 — нова apple-touch-icon (сова-логотип NeverMind)

**Що зроблено:** Замінив стару apple-touch-icon (фіолетова сова inline у `index.html` рядок 18) на новий логотип-сову NeverMind — лайн-арт коричневим контуром на беж-папері з ефектом тиснення. Дві ітерації:
1. **Коміт `8a5e79a`** — перша спроба: обрізав `IMG_9966.jpeg` (1024×1024, сова + напис "NEVER MIND") → крoп 430×430 верху з совою → 180×180 PNG → base64. Юзер додав на домашній екран — **ноги сови обрізались** бо крoп був занадто тісний, iOS-заокруглені кути з'їли підставку.
2. **Коміт `0f0dd07`** — фікс: юзер завантажив нову картинку `IMG_9968.jpeg` (сова сама по центру з великим беж-запасом). Крoп 580×580 від (230, 115) → вся сова + ~80px безпечної зони навколо. Ресайз 180×180 PNG, base64 у `index.html`. На скрині юзера видно повну сову з підставкою.

**Обговорено/прийнято:**
- **Варіант А (сова + напис) vs Б (тільки сова)** — обрали Б: iOS системно показує підпис "NeverMind" під іконкою → текст у самій картинці = дублювання + на 60×60 пікселях нечитабельний.
- Іконка лишається інлайн-base64 у `index.html`, не окремий файл — простіше, без додаткових HTTP-запитів.
- Не створювали `manifest.webmanifest` для Android — фокус на iOS де PWA-досвід основний.
- **Нюанс для юзера:** iOS жорстко кешує apple-touch-icon — щоб побачити нову іконку треба видалити стару з домашнього екрану і додати заново через Safari → Share → "На екран «Додому»".

**Інструменти:**
- `sharp` встановлено через `npm install --no-save` (не закомічено у `package.json`) — локальний тимчасовий інструмент для crop+resize.

**Файли (змінено):**
- `index.html` рядок 18 — новий base64 PNG 180×180 (~60KB) замість старого ~35KB
- `sw.js` — `CACHE_NAME` `nm-20260420-1120` → `nm-20260420-1933` → `nm-20260420-1948`

**Файли (видалено):**
- `IMG_9966.jpeg` і `IMG_9968.jpeg` — вихідні картинки прибрані з кореня після обробки

**Метрики:** 2 коміти (`8a5e79a`, `0f0dd07`), версії v330 → v333 (v334+ очікується після auto-merge), CACHE_NAME bumped, 0 багів закрито (це була фіча, не фікс).

---

## Шаблон для нового запису

```
## YYYY-MM-DD — Короткий опис сесії

**Що зроблено:**
- ...

**Змінені файли:** file1.js, file2.js
```

## 21.04.2026 — сесія rJYkw

**Зроблено (10 комітів):**
- Шар 2 "Один мозок V2" — 4 фази:
  - Ф1 (`444d0cd`): `src/owl/unified-storage.js` — єдиний `nm_owl_board_unified` + lazy migration
  - Ф2 (`1a8d9ac`): `nm-tab-switched` event + dwell 3с + AbortController + `getRecentChatsAcrossTabs()` + розмежування proactive/reactive у промпті
  - Ф3 (`2701573`): `_pickMessageForTab` з пробоєм `priority:'critical'` + fade 200мс opacity + сірий підпис "N хв тому"
  - Ф4 (`f2eb4f2`): tab-specific boosting Judge Layer (5 вкладок) + ранковий брифінг через `isBriefing:true`
- UX швидкого старту + Календар — 4 фази + 2 фікси:
  - Ф A (`9c515f8`): splash 800мс→200мс (прибрано delay перед showApp)
  - Ф B (`07af786`): бірюзовий `#14b8a6` замість фіолетового `#6366f1` для подій
  - Ф C (`88c35eb`): tool `open_calendar(highlight_events)` + пульсація `.cal-day-event-pulse` + промпт
  - Ф D (`e1b3ce0`): CACHE_NAME + AI_TOOLS.md
  - Фікс (`e1880ea`): жорсткіше правило "І tool І текст" — модель давала тільки текст
  - Фікс (`b17cd4b`): чіп "Відкрити календар" під відповіддю про події (мінімальне тертя — без другого повідомлення)

**Обговорено/прийнято:**
- 3 ітерації Gemini: акцепнули AbortController, Context Thrashing розмежування, priority-critical override, tab-specific boosting, сірий підпис "N хв тому"
- Відмовились: adaptive UI silence (виглядатиме як баг), адаптивний dwell time (over-engineering)
- Шар 3 "мозок бачить всі чати" — частково зроблено через `getRecentChatsAcrossTabs()`

**Файли:**
- Нові: `src/owl/unified-storage.js`
- Оновлено: `src/owl/board.js`, `src/owl/inbox-board.js`, `src/owl/proactive.js`, `src/owl/chips.js`, `src/ai/core.js`, `src/ai/ui-tools.js`, `src/ai/prompts.js`, `src/core/nav.js`, `src/core/boot.js`, `src/core/diagnostics.js`, `src/tabs/inbox.js`, `src/tabs/calendar.js`, `style.css`, `index.html`, `sw.js`
- Документи: `_ai-tools/SESSION_STATE.md`, `ROADMAP.md`, `docs/AI_TOOLS.md`

**Метрики:** 10 комітів, v345 → v351+, CACHE_NAME `nm-20260421-1949`

---

## 22.04.2026 — сесія ZJmdF

**Зроблено:**
- Фаза A: універсальна червона крапка непрочитаних у всіх 8 вкладках (не тільки Inbox+Evening як було). IDs кнопок у HTML, експорт `addHealthChatMsg`/`addProjectsChatMsg`, хук у `addMsgForTab`
- Фаза B "Один мозок" Варіант 2: новий `brain-signals.js` (264 рядки) з 9 типами сигналів (stuck-task/event-passed/event-upcoming/budget-warn/budget-overflow/appointment-soon/streak-risk/project-stuck/weekly-review); новий `brain-pulse.js` (117 рядків) з tool `post_chat_message` — мозок сам обирає куди/що/чи писати. Інтеграція через `startBrainPulseCycle()` у boot.js. `followups.js` стиснуто 218→80 рядків (тільки evening-prompt).
- Шар 3 "Мозок бачить всі чати": `getRecentChatsAcrossTabs` розширено 2→5 реплік, 30→60хв вікно. Нова `downgradeBriefingPriority()` у unified-storage — клік на чіп брифінгу знижує priority critical→normal.
- Фікс: цифри днів з подіями у Календарі стали темно-фіолетовими (замість бірюзових на бірюзовому — зливалися)
- Фікс: розуміння часу "зранку=08:00" (не 05:00) + захист від дубля на "Ок" у чаті Я
- REMINDER_RULES спільна константа у 8 чатах за принципом "Один мозок = однакові можливості"

**Обговорено/прийнято:**
- Варіант 2 "один мозок" замість 6 окремих check-функцій
- REMINDER_RULES винесено у спільну константу (пряма вимога Романа)
- Колір #1e1040 — насправді темно-фіолетовий, не "темно-сірий" як у доках. Глобальну заміну відклали.

**Для наступної сесії (у ROADMAP):**
- Календар — сортування подій Варіант A (сьогодні → майбутні → минулі)
- Чіпи у 6 нових чатах — `addChatMsgWithChips` універсальна функція

**Файли:**
- Нові: `src/owl/brain-signals.js`, `src/owl/brain-pulse.js`
- Оновлено: `src/ai/core.js`, `src/ai/prompts.js`, `src/owl/chips.js`, `src/owl/followups.js`, `src/owl/proactive.js`, `src/owl/unified-storage.js`, `src/core/boot.js`, `src/app.js`, `src/tabs/me.js`, `src/tabs/notes.js`, `src/tabs/habits.js`, `src/tabs/health.js`, `src/tabs/projects.js`, `src/tabs/calendar.js`, `index.html`, `sw.js`
- Документи: `ROADMAP.md`

**Метрики:** 11 комітів, CACHE_NAME `nm-20260421-1949` → `nm-20260422-0414`, гілка `claude/start-session-ZJmdF`

---

## 22.04.2026 — сесія L67Xf

**Зроблено (UX):**
- Чіпи у 6 нових чатах (Задачі/Нотатки/Я/Фінанси/Здоровʼя/Проекти): `parseContentChips` підключений скрізь, `renderChips` малює кнопки-варіанти під бульбою сови. Було: JSON `{chips:[...]}` рендерився як сирий текст. 2 коміти (`3d83464` Фінанси+Здоровʼя, `1262859` решта 4).
- Сортування «Події · місяць» у Календарі (Варіант A узгоджено ZJmdF): сьогодні → майбутні за зростанням → минулі за спаданням. Було: 9 квітня (минуле) зверху, 24 (майбутнє) знизу. Коміт `7f142b2`.
- Фікс Інсайту дня Фінансів: картка не застрягає на «OWL аналізує…» при рівно 1 транзакції у періоді. Поріг у `finDailyInsight` синхронізовано з `refreshFinInsight` (≥2). Коміт `1d62a01`.

**Зроблено (стратегічні документи):**
- `test-checklist.html` (новий) — мобільна сторінка з 13 блоків тестів для друга Романа. Кнопка «Копіювати весь чеклист» → текст у буфер. Коміт `3f6cc9f`.
- ROADMAP Active: новий блок «🧪 Test Sprint» (блокує нові фічі), новий блок «🧠 OWL Reasoning V3» (8 фаз до Supabase + 2 після). After Supabase: 4.48 Profile Builder → Edge Function + 4.49 Anti-Pattern Engine (`gpt-5-pro thinking`). Коміт `b86eb9f`, переструктуровано у `546ad55`.
- `docs/AGENT_INTELLIGENCE_SCALE.md` (новий, ідея Романа) — шкала 0-100% з 10 категоріями, поточно ~20%, стеля ROADMAP 45-48%. 6 правил чесності. Секція економіки: підписка $10-12, поточна вартість $4/міс, оптимізована $2/міс. Коміт `00ab29d` + `546ad55`.

**Обговорено/прийнято:**
- OWL Reasoning V3 — 3 ітерації консультації з Gemini (самооцінки 6→4→9). Діагноз «Context Segmentation Failure». Прийнято: `_reasoning_log` як обов'язковий параметр у 56 tools (single-pass reasoning без agent loop), typed cooldowns per-тип, `is_silent`+`micro_insight` через чіпи, 4 тригери `nm_agent_corrections` (Quick Delete, Undo Toast, Quick Edit, Verbal Negation), USER_STATE + правила тиші для Brain Pulse, Dynamic Tool Loading проти Context Window Bloat.
- Порядок фаз V3: 0 (Usage Meter — реальні дані перед рішеннями) → 1 (`_reasoning_log` закриває B-97) → 1.5 (Dynamic Tool Loading — економіка) → 3 (лог корекцій) → 4 (cooldowns + чіпи) → 2 (Brain Pulse USER_STATE, рішення про частоту після даних) → 5 (характер) → 6 (Lazy Profile Builder).
- Економіка узгоджена: підписка-стеля $10-12/міс. Voice Realtime НЕ викидаємо з плану, але ймовірно pay-per-use add-on. Brain Pulse 3хв→10хв економить $2.20/міс — рішення після даних з Usage Meter.
- Шкала розумності: оновлювати після кожної Active-фази, чесно без прикрашання. V3 до Supabase дає +7.3% (20→27%), все включно з Supabase-фічами = 45-48%.

**Баги:**
- **B-97 🔴 відкрито** — агент у чаті Задач відмовляється викликати `delete_event` з причиною «це подія, не задача». Діагноз Gemini: Context Segmentation Failure. Фікс через V3 Фаза 1.

**Файли:**
- Нові: `test-checklist.html`, `docs/AGENT_INTELLIGENCE_SCALE.md`
- Видалено: `gemini-reasoning-v3.html` (дублікат промптів з чату)
- Оновлено (код): `src/tabs/finance-chat.js`, `src/tabs/health.js`, `src/tabs/projects.js`, `src/tabs/tasks.js`, `src/tabs/notes.js`, `src/tabs/me.js`, `src/tabs/calendar.js`, `src/tabs/finance-insight.js`, `sw.js`, `bundle.js`
- Оновлено (документи): `ROADMAP.md`, `NEVERMIND_BUGS.md`, `CLAUDE.md`, `_ai-tools/SESSION_STATE.md`

**Метрики:** 8 комітів (`3d83464` → `546ad55`), CACHE_NAME `nm-20260422-0414` → `nm-20260422-0639`, гілка `claude/start-session-L67Xf`

---

## 24.04.2026 — сесія 8bSsE

**Формат:** сесія обговорення і діагностики. Код не чіпали.

**Зроблено:**
- Проаналізовано дві iPhone-діагностики: друг на v368 (22.04) і Роман на v370 (24.04).
- Зафіксовано 2 нові баги у `NEVERMIND_BUGS.md`: B-98 (🔴 критичний) і B-99 (🟡 середній).
- Побудована розширена шпаргалка для великого тесту — 8 блоків (базові системи, Inbox, 8 чатів, вкладки, OWL ініціатива, Кошик/памʼять, стрес-тести, форма звіту).
- Розʼяснено Роману архітектурне обмеження: Brain Pulse фізично не може працювати у фоні iPhone PWA (iOS заморожує вкладку), фонове мислення можливе тільки після Supabase + Edge Functions + push.
- SESSION_STATE ротація: rJYkw блок винесено у `_archive/SESSION_STATE_archive.md`.

**Обговорено/прийнято:**
- **B-98 пріоритетніший за V3** — ламає ключову фічу (ініціативу сови), всі тести проактивності без цього фальшиві.
- **Test Sprint активний режим** — Роман виділяє 1-2 дні суто для тестів за розширеною шпаргалкою перед V3.
- **Регрес табла** — на v368 у друга табло оновлювалось (4 API за день), на v370 у Романа — 0 API-запитів попри 5+ тригерів. Значить залипання з'явилось у v369-370 або ZJmdF (`_boardAbortController` або stream-таймаут).

**Обговорено БЕЗ прийняття рішення (чекає Романа):**
- **Правило «кнопка копіювати у довгих списках»** — Роман попросив запам'ятати щоб коли Claude дає списки/шпаргалки/промпти для Gemini — завжди з HTML-кнопкою «Копіювати» (як `test-checklist.html`). 4 варіанти реалізації: (А) правило у CLAUDE.md, (Б) скіл `/copyable-list`, (В) `UserPromptSubmit` хук з тригерами, (Г) комбінація А+В. Чекає вибір.

**Баги:**
- **B-98 🔴 відкрито** — залиплий прапорець OWL табло. Файл `src/owl/board.js`. Фікс: `try/finally` + watchdog-timeout 60 сек.
- **B-99 🟡 відкрито** — `[brain-pulse] skip:` без причини у логах. Файл `src/owl/brain-pulse.js`. Фікс: fallback reason у логгері.

**Файли (тільки документи):**
- Оновлено: `_ai-tools/SESSION_STATE.md`, `_archive/SESSION_STATE_archive.md`, `NEVERMIND_BUGS.md`, `docs/CHANGES.md`
- Код НЕ чіпали.

**Метрики:** 0 фіче-комітів, 3-4 документ-коміти, CACHE_NAME не змінювалось (`nm-20260422-0639`), гілка `claude/start-session-8bSsE`

---

## 24.04.2026 — сесія v2vYo

**Зроблено (код, 3 баги закриті):**
- **B-98** 🔴 OWL табло не оновлювалось 8+ год — обгорнуто `generateBoardMessage` у `try/finally` + додано watchdog `setTimeout(60s)` який примусово скидає `_boardGenerating` прапорець і робить abort. Коміт `5b25374`.
- **B-97** 🔴 Context Segmentation Failure — новий `GLOBAL_TOOLS_RULE` у `prompts.js` (інструменти глобальні у всіх 8 чатах + явний фузі-матч паттерн для `delete_event` з ID з aiContext). Підключено у чат Задач. Коміт `9e065a1`.
- **B-99** 🟡 `[brain-pulse] skip:` порожня причина — додано fallback `judge.reason || 'unknown'`. Коміт `5b25374`. **Підтверджено закритим** на v376 (діагностика показала «skip: unknown»).
- CACHE_NAME `nm-20260422-0639` → `nm-20260424-0715`.

**Зафіксовано 4 нові відкриті баги:**
- **B-100** 🟡 (емпатія — «не доставай / відчепись» ігнорується), **B-101** 🟢 (туманне «Щось пішло не так»), **B-102** 🟡 (табло не реагує на настрій, потребує V3 Фази 2), **B-103** 🔴 (дублі подій у календарі — 5 call-sites без dedup helper).

**Документація:**
- **ROADMAP.md After Supabase — нова секція БЕЗПЕКА (23 пункти).** За ідеєю статті про Jessie Davis ($18k рахунок від Google Cloud через плейн-текст API-ключ у Cloud Run). Блок A приватність даних юзерів (RLS, шифрування медицини, GDPR), блок B захист клієнта (CSP, санітизація DOM), блок C процеси (npm audit, 2FA, branch protection) + попередні 9 пунктів про API-ключ / rate limit / kill switch. Записано Романом за прямим запитом. Коміти `82ed9ef`, `429c9e4`.

**Скіли:**
- `/obsidian` **видалений**, логіка перенесена у `/finish` як обовʼязкова Фаза 9. Роман тепер закриває сесію однією командою і одразу отримує обсідіан-блок для копіювання у RoamBrain. Коміт `95a31c2`.

**Файли:**
- Код: `src/owl/proactive.js`, `src/owl/brain-pulse.js`, `src/ai/prompts.js`, `src/tabs/habits.js`, `sw.js`, `bundle.js`
- Документація: `_ai-tools/SESSION_STATE.md`, `NEVERMIND_BUGS.md`, `ROADMAP.md`, `docs/CHANGES.md`
- Скіли: `.claude/commands/finish.md` (додана Фаза 9), `.claude/commands/obsidian.md` (видалено)

**Метрики:** 10 комітів (`5b25374` → `95a31c2`), CACHE_NAME `nm-20260424-0715`, гілка `claude/start-session-v2vYo`, build чистий.

---

## 24.04.2026 — сесія R5Ejr

**Зроблено (9 комітів):**

**1DAY analysis (обговорення → документ):**
- **`262d15c`** — розбір 8 функцій застосунку 1DAY. Прийнято 3: **місячний AI-звіт** у Блок 2 ROADMAP `Я 70→100%` (картка «Підсумок місяця» 1-го числа), **річний AI-звіт** у `💡 Ideas` (30-31 грудня), **План vs Факт** у `docs/EVENING_2.0_PLAN.md` секція «Після MVP». Відкинуто 2: тайм-трекінг по годинах і фіксацію відволікань (суперечать філософії мінімального тертя, автотрекінг з PWA неможливий).

**Stale OWL board fix — B-104 (коренева причина, не табло):**
- **`3e3892a`** — сова казала «закрий 3 задачі: X, Y, Z» попри що юзер їх уже закрив тапом ✓. Діагностика показала що фікс B-98 (watchdog прапорця) не допомагав бо генерація УСПІШНО йшла — але з поганим контекстом. Корінь: у 4 з 8 місць `status='done'` ставилось без `completedAt` (tasks.js:171/192, habits.js:1373/1383). `getAIContext` фільтрує «Нещодавно ЗАКРИТІ» по `t.completedAt` і ці задачі пропадали. Плюс `getTabBoardContext('tasks')` не мав блоку «Нещодавно закриті» (тільки Inbox мав). Фікс: у всіх 4 місцях тепер `completedAt+updatedAt`, при reopen `completedAt` видаляється. Додано явний блок у tab-контекст.

**UI-pass Продуктивності (4 checkpoint-коміти):**
- **`44ae873`** — CSS-токени `--card-gap:5px`, `--card-pad-y:10px`, `--card-pad-x:14px` у `:root`. Inbox-картка з 8px→10px. Sticky header спершу «матове скло». Перемикач прод-вкладок: активна біла БЕЗ тіні з яскравою помаранчевою обводкою, неактивні напівпрозорі з тінню як у Фінансах.
- **`1964853`** — Задачі: висота через токени, 3-фазна анімація закриття (галочка миттєво → 250мс пауза → CSS клас `task-completing` з translateY+scale+opacity+max-height transition 350мс → renderTasks). Hit-area 44×44 через обгортку padding:8px margin:-8px.
- **`f01d4ac`** — Звички (build+quit), Нотатки (картки+папки) — margin/padding через токени.
- **`83d30ab`** — `.card-glass` (Здоров'я + Проекти) — один CSS клас на обидві вкладки.
- **`75cc6d9`** — CACHE_NAME bump `nm-20260424-1858`.

**Фідбек юзера після скріна — прибрано всі помаранчеві фони:**
- **`d3deda1`** — матове скло приховувало картки. Прибрано `background+backdrop-filter` зовнішнього sticky + `linear-gradient(#fdb87a...)` блоку перемикача + `background: transparent` для `#page-tasks .page-header`. Sticky тепер тільки `position+z-index` — картки проходять повністю видимо за ним. CACHE_NAME `nm-20260424-1905`.

**Сортування виконаних:**
- **`6cf8a96`** — `renderTasks` сортує виконані за `completedAt ↓`. Щойно закрита зверху секції done. CACHE_NAME `nm-20260424-1906`.

**Файли:**
- Код: `src/tabs/tasks.js`, `src/tabs/habits.js`, `src/tabs/notes.js`, `src/owl/proactive.js`, `index.html`, `style.css`, `sw.js`
- Документація: `ROADMAP.md`, `docs/EVENING_2.0_PLAN.md`, `_ai-tools/SESSION_STATE.md`, `_archive/SESSION_STATE_archive.md`, `NEVERMIND_BUGS.md`, `_archive/BUGS_HISTORY.md`, `docs/CHANGES.md`

**Обговорено без виконання:**
- Транзакції Фінансів і моменти Вечора — стрічкові списки з `border-bottom`, не картки. Роман погодився не чіпати.
- Діагностика з iPhone Романа на v377 показала `skip:` без причини — але це до фіксу B-99 (v377 = c77eb04 мерж тільки BUGS.md; фікс у v378+). Треба верифікувати після v390+ деплою R5Ejr.

**Метрики:** 9 комітів (`262d15c` → `6cf8a96`), CACHE_NAME `nm-20260424-0715` → `nm-20260424-1906`, гілка `claude/start-session-R5Ejr`, build локально не запускався (esbuild не встановлено — CI зробить).

---

## 24.04.2026 — сесія jEWcj (перервана — обговорення без "Роби")

**Що зроблено:**
- Обговорено підхід до повного перепису `docs/DESIGN_SYSTEM.md`. Роман запросив документувати реальний стан коду (кольори, типографіка, відступи, тіні, кути, анімації, модалки, кнопки, іконки, конфлікти)
- Claude запропонував перший план (інженерний з ASCII-мокапами кожного компонента) → Роман зупинив «ти трохи тіряєшся, важливіше щоб все було нам корисно в подальшій роботі»
- Переосмислено: документ = **робочий інструмент для Claude** при UI-задачах, не галерея. Фінальна структура з 9 секцій (Шпаргалка / Токени / Шаблони копі-пасту / Компоненти / Вкладки / Чекліст / Борг / Анти-патерни / Словник)
- Підготовлено 3-фазний план виконання (3 агенти паралельно → аналіз конфліктів → skeleton+Edit). Не виконано — Роман НЕ сказав «Роби»

**Часткова зміна скіла `/gemini` (коміт `e47ea1e` WIP):**
- Роман нагадав правило CLAUDE.md «Довгі списки/шпаргалки/промпти → ЗАВЖДИ через HTML з кнопкою Копіювати». Claude порушив — вивів запропонований промпт для Gemini у чат маркдауном
- Роман попросив: «Виправ заодно скіл щоб давав кнопку копіювати. Просто сюда в чат закинь. Не треба ніяких html»
- Claude почав правити скіл `.claude/commands/gemini.md`. Встиг: переписати секцію «Як це працює (концепція)» (markdown → HTML-файл з копі-кнопкою на проді) + додати виняток «якщо Роман каже "закинь у чат" — inline markdown»
- НЕ встиг: перевести Крок 3 (`## Крок 3 — Сформувати і вивести промпт`) на створення HTML-файлу + оновити Крок 4 (інструкція Роману) + додати HTML-шаблон у скіл
- Роман перервав і запустив `/finish` щоб переключитись в інший чат

**Обговорено без виконання:**
- Токени англійською (`--accent-amber`) чи українською — не підтверджено. Claude рекомендував англійською
- Борг у тому ж файлі чи окремий `DESIGN_SYSTEM_DEBT.md` — не підтверджено. Claude рекомендував секцією
- Шаблони з інлайн-стилями vs CSS-класами — документуємо як є, примітка про техборг

**Інциденти:**
- Порушення CLAUDE.md правила про HTML-копі-кнопки для довгих промптів. Визнано і виправлено по ходу
- WIP-стан скіла `/gemini` — концепція говорить про HTML, Кроки 3-4 досі про markdown. Коміт має чіткий message з переліком незробленого щоб новий чат міг докрутити

**Файли змінено:**
- `.claude/commands/gemini.md` — часткова правка (+6/-3 рядки)
- `_ai-tools/SESSION_STATE.md` — ротація L67Xf у архів + додано блок jEWcj
- `_archive/SESSION_STATE_archive.md` — додано блок L67Xf
- `docs/CHANGES.md` — цей запис

**Метрики:** 1 WIP-коміт (`e47ea1e`) + 2 /finish-коміти, CACHE_NAME не змінювався (`nm-20260424-1906`), гілка `claude/document-design-system-jEWcj`, код застосунку не чіпали, build не запускали.

---

## 24.04.2026 — сесія nudNp (3 раунди Gemini + спрощення правил + план стандартизацій)

**Що зроблено:**
- Скасовано правило CLAUDE.md про HTML-файли для довгих списків — тепер код-блок у чаті з нативною кнопкою Copy у Claude Code Web. Виняток для друга-тестувальника теж скасовано (Роман: «я копіюю і кидаю в телеграм»). Видалено `test-checklist.html` (312 рядків).
- Переписаний скіл `/gemini` — код-блок у чаті замість HTML-файла. Новий контекст: `CLAUDE.md` + `docs/DO_NOT_TOUCH.md` + `lessons.md` + остання сесія SESSION_STATE + git diff + новий блок «Контекст обговорення у чаті». Прибрано `РОМАН_ПРОФІЛЬ.md` і `NEVERMIND_BUGS.md` (рішення Романа).
- Пункт 4.32 ROADMAP — Voice Realtime API замінено на Whisper+GPT-4o-mini+TTS (Gemini: Realtime $0.06-0.24/хв = $50-100/міс на юзера, не покривається підпискою $10-12/міс). Затримка 1-2 сек прийнятна для агента продуктивності.
- Нове правило CLAUDE.md `t('key', 'fallback')` — обгортати ВСІ нові user-facing рядки. Заглушка для майбутньої англійської локалізації. Тільки для нового коду; існуючі 8 вкладок переписуємо разом з реальним перекладом (одною фокусованою сесією 3-4 години).
- Новий Active-блок у ROADMAP «Pre-Migration Hardening» — 3 підсесії стандартизацій перед Supabase: DATA_SCHEMA + Migration Engine → DESIGN_SYSTEM (9 секцій + Safe Areas + Haptics + Empty States + Skeletons) → Events unify + `t()` функція.
- Пункт 4.17 ROADMAP — додано попередження про витік API-ключа через DevTools + цитата Романа про довірених тестерів.
- Пункт i18n у After Supabase — переписано як МАСТ-ХЕВ пріоритет (Роман підтвердив), один фокусований 3-4 сесійний блок (не поступово).
- Нові пункти у After Supabase: App Store IAP (30% Apple комісія ламає $10-12 економіку при переході на нативний); PWA Retention через агресивний «Add to Home Screen» промпт (90% iOS відтоку без A2HS за оцінкою Gemini).

**Обговорено/прийнято:**
- 3 раунди консультації Gemini 3 Pro: первинна оцінка → самокритика з конкретними прикладами коду → друга самокритика з фінансовими розрахунками. Прийняті всі основні пропозиції: токени англомовні, борг секцією у DESIGN_SYSTEM, Safe Areas + Haptics, Empty States + Skeletons, DATA_SCHEMA перед DESIGN_SYSTEM, Migration Engine з бекапом, Voice через Whisper+TTS.
- Відхилено: «шаблони тільки CSS-класи» (масштаб inline-стилів — окремий рефакторинг 2-3 сесії); Headless refactor окремо (Gemini сам визнав ідеалізмом — Supabase змусить пофайлово); A11y зараз (класична помилка правильної інженерії без Product-Market Fit); обгортання існуючих текстів у `t()` зараз (величезний diff без миттєвої користі).
- Філософська дискусія про природу довгих списків і де їх читати. Роман: «нахуя мені по якихось силках переходити». Перейшли від HTML-файлів-на-проді до код-блоків у чаті. Видалено `test-checklist.html` бо Роман — посередник для друга, не друг сам.

**Файли:**
- `CLAUDE.md` — переписане правило довгих списків (HTML→код-блок), нове правило `t()`, скасовано виняток для test-checklist.html
- `ROADMAP.md` — новий Active-блок «Pre-Migration Hardening», переписаний пункт 4.32 Voice (Realtime→Whisper+TTS), оновлене посилання у економіці V3, попередження у 4.17, переписана i18n маст-хев, нові пункти App Store IAP і PWA A2HS
- `_ai-tools/SESSION_STATE.md` — оновлена секція «Для нового чату» з рішеннями 3 раундів + детальний блок nudNp + рядок у журналі сесій
- `.claude/commands/gemini.md` — переписаний скіл (код-блок у чаті, новий блок «Контекст обговорення», скорочений SESSION_STATE до останньої сесії, додано DO_NOT_TOUCH і lessons.md)
- `test-checklist.html` — ВИДАЛЕНО (312 рядків, перенесено у код-блок у чаті)
- `docs/CHANGES.md` — цей запис

**Метрики:** 8 комітів (`f2591a2` → `a22405d`), CACHE_NAME не змінювався (`nm-20260424-1906`, документаційна сесія), гілка `claude/start-session-nudNp`, код застосунку не чіпали, build не запускали. Версія застосунку лишається v389 (від попередньої R5Ejr).
