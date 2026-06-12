# NeverMind — Історія закритих багів (архів)

## Ротовано 7uxlr7 12.06.2026 — сесії WML2Z + RQmdC

_Сесія **WML2Z** (03.06.2026):_

- **B-194 закрито** (`00b377b`) — **чіпи з кривим JSON вивалюють весь код у бульбашку чату.** «склади список покупок» → AI згенерував JSON чіпів із зайвими комами → strict `JSON.parse` кидав → сирий текст замість кнопок. **Фікс:** lenient-fallback у `parseContentChips` (прибрати trailing-коми, парсити ще раз). Happy-path strict. Корінь глибший (структуровані відповіді OpenAI) — не закрито.
- **B-195 закрито** (`0e24085`) — **табло не оновлюється на вхід.** Чекало 45с / 10хв, без visibility-тригера. **Фікс:** `visibilitychange`+`pageshow` → debounced brainPulse, cold-start 45→5с, cooldowns гасять спам.
- **B-196 закрито** (`651ab85`) — **test_29/30 ніколи не бігали у cron** (max_tests_per_run=30 < 32 сценаріїв). **Фікс:** 30→33 + прибрано мертвий `--full`.

_Сесія **RQmdC** (23.05.2026):_

- **B-192 закрито** (`f4a1a70`) — **«backup зникає за 0.8с» = ХИБНИЙ сигнал старого test_4, НЕ баг.** Council 3 агенти не знайшли винного коду (видалення немає). Голова верифікувала через runtime (monkey-patch removeItem/setItem + polling 1100мс) → 3×PASS, rm_log порожній. Корінь: старий test_4 вимірював через окремі CDP-виклики з wait(0.8) — race у вимірі. **Фікс:** test_4 на stability polling. **Урок:** runtime-датчик ДОВОДИТЬ перш ніж патчити прод за гіпотезою.

## Ротовано WML2Z 03.06.2026 — сесія Ug2Jw

- **B-193 закрито** (`54c2e46`) — **`openAddHabit` НЕ у `window` exports → юзер на Habits subtab тапає ➕ → нічого.** Корінь: HKnlM `b6a3d37` зробив `dataset.fn='openAddHabit'` на `#prod-add-btn` при switch на Habits, АЛЕ забув додати `openAddHabit` у `Object.assign(window, {...})` habits.js:1942. Delegation `call` handler перевіряє `typeof window[fn]==='function'` → false → silent skip. **Знайдено:** test_19_habits_add сам показав `HABIT_MODAL_NOT_OPEN`. ПЕРШИЙ real production bug який AI-Tester зловив самостійно. **Фікс:** +1 рядок `openAddHabit,` у window export.
- **B-190 закрито** (`e993aa7`) — **AI-Tester `screenshot()` ніколи не зберігав скріни — кожен fail приховував причину.** 3 латентні дірки в одній функції `screenshot()`: (1) `take_screenshot` не існує (реальна `capture_screenshot`), (2) `path!r` = PosixPath літерал без pathlib у daemon, (3) `capture_screenshot()` нічого не друкує → `bh()` raise на empty stdout. **Фікс:** `capture_screenshot(str(path))` + явний `print(_json.dumps({}))` + truncate error 120 chars. Урок: 1 видимий баг приховує 2 латентні — Pre-mortem ПЕРЕД Edit розкрив.

## Ротовано RQmdC 23.05.2026 — сесії HKnlM + DGH6F + e9t3N + nliW8 + db0YY

_Сесія **HKnlM** (19-20.05.2026) — AI-Tester Hetzner deploy + Council 4 паралельних агентів Sonnet (Implementer/Pre-mortem/silent-bug-scout/doc-consistency). 7 commits. 13 проблем знайдено, всі закриті:_

- **B-189 закрито** (`535f33c`) — **PAT expiration silent fail.** GitHub fine-grained PAT має 90-day TTL. Без monitoring tester мовчки переставав пушити звіти через 90 днів — Роман міг помітити тільки коли tester-status.json не оновлювався 5 днів. **Знайдено:** Pre-mortem агент Sonnet (7-day autonomous failure analysis). **Фікс:** `hetzner-setup.sh` додає `PAT_CREATED_UTC=YYYY-MM-DD` у .env; ai-tester.py `_collect_warnings()` рахує remaining days; якщо ≤15д — warning у `tester-status.warnings[]`; NM-Claude бачить при /start.
- **B-188 закрито** (`250d84f`) — **AI-Tester test_9 false-PASS.** `wait_for_js_expr('finance.some(x=>x.amount===50)')` після першого PASS finance вже містить запис → True миттєво на старих даних → AI взагалі не викликається → тест завжди зеленіє навіть якщо Anthropic ключ мертвий. B-180 регресія була б «зеленою» 89 днів. **Знайдено:** Pre-mortem агент Sonnet (CRITICAL #1). **Фікс:** before_finance + порівняння IDs → match = ДОДАНИЙ запис. Cleanup доданого запису у кінці тесту. Дзеркальна логіка у test_10 (для tasks/events).
- **B-187 закрито** (`c3cbdfa`) — **🚨 КРИТИЧНА: Shell injection + secrets leak у AI-Tester scripts.** 3 діри одночасно: (1) heredoc'и `<<INNER`, `<<ENV` у `hetzner-setup.sh` БЕЗ лапок → `${PAT}`/`${ANTHROPIC_KEY}` через bash substitution → injection якщо ключ містить `` ` ``/`$()`/`\`; (2) git stderr з `x-access-token:TOKEN@github.com` записувався у `tester-log.md` + `cron.log` БЕЗ маскування; (3) `cron.log` без `chmod 600`. **Знайдено:** silent-bug-scout Sonnet (всі 3 на одному audit). **Фікс:** single-quoted heredoc'и + env передача; Python heredoc для .env з newline check; новий `_mask_secrets()` regex (PAT/ghp/sk-ant); chmod 600 на cron.log + повторно після rotation.
- **B-186 закрито** (`250d84f`) — **AI-Tester test-3 + test-4 selector regression.** test-3: `wait(0.3)` після кліку `#prod-add-btn` ловив input у readonly state — `openAddTask` (tasks.js:37) має `setTimeout(350мс)` перед знятям readonly. test-4: `createFullBackupUI` на `<div data-action="call">` — overlay анімація могла не завершитись за wait(0.5). **Знайдено:** Implementer Sonnet (точні рядки index.html). **Фікс:** test-3 wait(0.3)→(0.5) + unique_title з timestamp щоб уникнути false-pass з минулих запусків + cleanup. test-4 wait_for_element для overlay + before/after delta замість абсолютного count. Бонус: `max_tests_per_run` 5→10 (Pre-mortem CRITICAL #2: test_6-10 ніколи не виконувались, B-180/B-115 AI регресії були поза контролем).

_Сесія **DGH6F** (16.05.2026) — Pre-Supabase hardening, NM_KEYS audit + Backup механізм + Event Delegation Phase 1а-1д через Council 13 агентів Sonnet:_

- **B-186 закрито** (`85eb0e8`) — **Council post-Phase 1 аудит знайшов 2 неочевидні проблеми у мoix же Event Delegation фіксах: (1) CSS feedback регресія, (2) pre-existing renderEvening window-export missing.** **#1 КРИТИЧНА UX:** правило `[onclick]:active { transform: scale(0.87) }` (style.css:1557) працювало для 26 мігрованих елементів. Після переходу на `data-action` ці елементи втратили inline `onclick` → CSS selector не матчить → тап БЕЗ тактильного feedback. Юзер натискає кнопку — нічого не «втискається» візуально. **Фікс:** додано `[data-action]` поруч з `[onclick]` у обох правилах (transition + :active) + override-виключення для модалок (B-142 урок). **#2 PRE-EXISTING (викрив, не створив):** `renderEvening` не у `Object.assign(window, ...)` у evening.js:508. Старий `onclick="holdQuitHabit('X');renderEvening()"` теж не працював у IIFE bundle (ESM exports не глобальні). Мій delegation handler викликав `window.renderEvening` що undefined → typeof guard saved from crash але re-render не виконувався → юзер бачив старий стан до F5. **Фікс:** додано renderEvening у Object.assign. **Знайдено:** Council 2 паралельні агенти Sonnet (Regression Hunter + Cross-file Consistency) після завершення Phase 1а-1д. Урок: «Pre-mortem знаходить КОРIНЬ; Inversion перевіряє РЕАЛIЗАЦIЮ; Council аудит власних фіксів — обов'язковий КРОК для `src/core/*` після серії змін» — записано у lessons.md.

- **B-185 закрито** (`bdc3aee` + `5d52507` + `91cfccc` + `9657117`) — **Backup механізм 4 латентні дірки (Council Pre-mortem).** Жодна не зашкодила активно — це профілактика ДО першого Supabase backup (де ціна провалу = втрата юзерських даних без можливості відновлення). **Дірка 1 — Quota silent fail:** `createSelectiveBackup` тихо повертав null коли localStorage переповнений (iPhone Safari ~5 MB ліміт). Юзер міг почати ризиковану міграцію БЕЗ backup і не дізнатись — тільки після провалу. **Фікс:** `_estimateUsedBytes()` передперевірка (key+value)×2 UTF-16 → якщо payload+existing > 4 MB → cleanup + retry, потім явний `console.warn` з конкретикою (MB payload + MB existing). **Дірка 2 — Race condition restore:** `restoreBackup` робив `setItem` у циклі без блоку → OWL scheduler / `nm-data-changed` listener міг писати між кроками → restore тихо перетирався. **Фікс:** `window.__nm_restoring = true` + `CustomEvent('nm-restore-start')` / `('nm-restore-end')` у try/finally. **Дірка 3 — Migration flag mixed state:** restore перезаписував тільки snapshot-ключі але НЕ скидав `nm_*_uuid_migrated_v{8..17}` → наступний boot пропускав міграцію відновлених старих даних → mixed UUID/number → silent fail у `find(x => x.id === id)`. **Фікс:** константа `KEY_MIGRATION_FLAGS` (зібрана grep'ом по boot.js) → при restore ключа видалити відповідні флаги. **Дірка 4 — `init() runMigrations` swallow:** `try{runMigrations()}catch(e){}` порожній catch у `boot.js:1195` ковтав помилки → юзер бачив пусті поля БЕЗ слідів у логах. **Фікс:** прямий запис у `nm_error_log` (формат сумісний з logger.js, без import-циклу boot↔logger) + `console.error`. CACHE bump `nm-20260516-1930`. **Знайдено:** Council 💎 Pre-mortem агент Sonnet (промпт «уяви Supabase міграція провалилась, backup не врятував — чому?»). Голова верифікувала всі 4 через читання реального коду (правило CLAUDE.md «гіпотеза агента ≠ факт»).

- **B-184 закрито** (`56f4d41`) — **`clearAllData()` залишала 5 ключів юзерських даних + 38 інших поза реєстром `NM_KEYS`.** Симптом: юзер натискає «Видалити все» у Налаштуваннях → 5 типів даних мовчки лишались у localStorage (`nm_events` — події календаря, `nm_reminders` — нагадування, `nm_routine` — розпорядок дня, `nm_allergies` — алергії у Health картках, `nm_action_log` — лог дій для undo). При наступному boot вони відновлювали стару інформацію (Календар показував старі події, OWL пам'ятав видалені алергії як «у тебе алергія на X»). Корінь: `NM_KEYS` у `boot.js:307` — єдине джерело правди для `clearAllData()` (`nav.js:1039`) — підтримувалося вручну при додаванні нових ключів. За 4 тижні після qG4fj 25.04 реєстр відстав від реальності на 44 ключі (50→94 після фіксу). Той самий ризик загрожував би першому Supabase backup (`createSelectiveBackup` теж бере з `NM_KEYS`). **Фікс:** широкий grep `'nm_*'` literal'ів + констант (`KEY = 'nm_*'`) знайшов 137 унікальних ключів → класифіковано і додано: data +5, settings +14, cache +24, patterns +1. + Boot-time assertion `_assertAllKeysKnown()` сканує localStorage у кінці `bootApp()` і console.warn якщо знайде nm_* поза реєстром → автоматичне попередження майбутніх регресій. + `docs/DATA_SCHEMA.md` шапка оновлена з посиланням на `NM_KEYS` як джерело правди. **Знайдено:** Council 💎 Pre-mortem агент Sonnet (промпт «уяви що Supabase міграція провалилась — чому?»). Голова верифікувала гіпотезу через grep (правило CLAUDE.md «гіпотеза агента ≠ факт»). **Урок у lessons.md:** «Реєстр локального сховища → широкий grep константи + literal'и, не тільки `localStorage.getItem('nm_*')` — пропустить ключі через `const KEY = 'nm_*'`».

_Сесія **e9t3N** (15-16.05.2026) — AI-тестер інфраструктура (NM-сторона) + Security Hardening Council 5 агентів. Тільки 1 баг закритий у коді (XSS), решта — інфраструктура + документація:_

- **B-183 закрито** (`3aa1569`) — **Stored XSS у `notes.js:186` (Council Security аудит знайшов).** `dl.innerHTML = getFolders().map(f => \`<option value="${f}">\`)` — `f` (назва папки) без `escapeHtml()`. Юзер міг створити папку з payload `"><img src=x onerror=alert(1)>` → виконання при кожному завантаженні NeverMind (stored XSS). Зараз ризик низький (single-user), але після Supabase з multi-device sync — один скомпрометований юзер міг би заразити інших через синхронізовану назву папки. **Фікс:** `escapeHtml(f)` у template literal (escapeHtml helper уже імпортувався). **Знайдено:** XSS/Injection Council-агент Sonnet (1 з 5 паралельних). Інші 4 знайдені у документації: відсутній CSP (HIGH), OpenAI ключ у localStorage (HIGH — план Edge Function під час Supabase), AI-тестер скрін з PHI у public repo (CRITICAL — виправлено контракт), tester як root на Hetzner (CRITICAL — Brain фіксить у Фазі 3).

_Сесія **nliW8** (13.05.2026) — 4 фази: B-170 регресія + B-180/181/182 + UI bubbles + Phase 2 уніфікація save_finance + Пункт 3 delete_medication + Пункт 4 B-178 cross-chat handoff. 20+ комітів. Council 13 агентів Sonnet:_

- **B-178 закрито** (`240e168` + `d85dde3`) — **Cross-chat interview handoff Inbox→Health через addMsgForTab централізацію.** Симптом: AI у Inbox каже «Створи картку лікаря» → юзер на Health бачив червону крапку але порожній чат. Корінь 1: `startHealthInterview` обходив `addMsgForTab` (core.js:797) — 5 пар прямих `addHealthChatMsg/saveChatMsg` з гілкою currentTab → race condition + DOM `dataset.restored` lock у `restoreChatUI`. Корінь 2: stale chips старих карток (state перезаписав → юзер тапає старий чіп → застосовувалось до НОВОЇ картки). **Фікс:** заміна 5 пар на 1 виклик `addMsgForTab('health', ...)` яка робить persistence + DOM live-append + unread badge. + cardId guard у chip payload (R7). + TTL 7 днів для stale state (R5 audit fix). + healthBarHistory.push у всі 4 точки (F1 audit fix — AI бачить контекст інтерв'ю). **Знайдено:** Council 3 агенти Sonnet (architecture map + history persistence + pre-mortem) + аудит-агент після коміту.
- **B-undo-circle закрито** (`7edfa37` + `91c7b67`) — **delete_medication tool + повний undo circle для add_medication.** До цього коміту add_medication логував у action-log (B-182 fix), але reversible('add_medication')=false → AI у undo flow silent skip. Дзеркальна B-174 (тільки direct handler) + дзеркальна B-175 (addToTrash без restore case). **Фікс — 7 точок** (системний, не латка): (1) `health.js deleteMedicationFromCard` + orphan task cleanup через sourceMedId; (2) `trash.js case 'medication'` restore у відповідну картку; (3) `prompts.js delete_medication` tool def Strict mode required[4]; (4) `tool-dispatcher.js case 'delete_medication'` direct handler + import; (5) `habits.js processUniversalAction case` для DI flow (ключове — урок B-174); (6) `action-reversers.js add_medication → delete_medication` reverser; (7) `inbox.js normalizeAction` + logAction для Inbox-чат flow. **Знайдено:** Council 3 агенти Sonnet (architecture map + undo pipeline holes + health.js patterns) + аудит-агент знайшов 2 додаткових: orphan task у nm_tasks (createTasks:true) + Inbox flow без logAction.
- **B-finance-unification закрито** (`261d710` + `01de0c6` + `9cafb46` + `6eaeeb8` + `aaf5a94`) — **Phase 2 уніфікація save_finance через DI addMsgFn — 1 source of truth для 8 чатів.** До цього save_finance оброблявся у 3 окремих місцях з ДУБЛЬОВАНОЮ логікою: `finance.js processFinanceAction` (Inbox), `habits.js processUniversalAction:1530-1581` (6 tab-чатів), `evening-actions.js:155` (Evening). Активні розбіжності: auto-create вигаданих категорій у habits.js (регресія від nliW8 13.05 fix у finance.js), Date.now() ID замість UUID, відсутні `syncHealthFinanceToHistory` + `checkFinBudgetWarning` + `logAction` у 7 чатах → undo не працював, health-sync не відбувався, budget warning тільки у Inbox. **Фікс — 5 кроків** (повне системне рішення): (0) `update_transaction` handler у `tool-dispatcher.js` — закрив silent fail у 7 чатах; (1) новий `src/data/finance-classifier.js` — pure module з `classifyCategory` + `classifySubcategory` + `resolveFinanceDate` + `OTHER_CATEGORY` константа (готовий до Supabase Edge Function без переписування); (2) параметризація `processFinanceAction(parsed, text, addMsgFn=addInboxChatMsg)` + `checkFinBudgetWarning(..., addMsgFn)` — DI з default backward-compat; (3) видалення 50-рядкового дубля з `habits.js processUniversalAction:1530` → виклик `processFinanceAction`; (4) `evening-actions.js` → `processFinanceAction` + видалення локального дубля `checkFinBudgetWarning` у `finance-chat.js:68` + прибрано подвійний budget warning виклик (134). **Знайдено:** Council 4 агенти Sonnet (architecture mapper + risk-finder + DRY finder + Supabase scout).
- **B-finance-AI-categories закрито** (`6cedd3d` + `51d6a2d` + `91dccfb`) — **AI вигадував категорії/підкатегорії; нинішня architectura "брати тільки з юзерських" не працювала.** Корінь — 3 проблеми: (1) `getFinanceContext` повертав '' при 0 транзакцій → AI не бачив юзерських категорій взагалі; (2) показувались тільки категорії з непорожніми subs → AI не знав про «Покупки» без sub; (3) моя свіжа B-180 регресія: додав «вбудовані підказки кава=Кафе» у subcategory description → AI ігнорував список юзера. **Фікс:** (а) `getFinanceContext` показує юзерські категорії ЗАВЖДИ + ВСI неархівні (з sub і без); (b) `subcategory` description — жорстке «🚫 ЗАБОРОНЕНО вигадувати»; (c) `category` description те саме; (d) code-side guard у `processFinanceAction` — якщо AI вигадав → fallback на «Інше» (raніше `createFinCategory` плодив вигадані); (e) chip-діалог «[Створити "X"] [Лишити в Інше]» коли AI вигадав → AI робить `create_finance_category` + `update_transaction` (move) у batch.
- **B-finance-ui-bubbles закрито** (`7c0a659`) — **візуальна ієрархія category/subcategory як bubbles** щоб коментар не виглядав дублем коли тексти збігалися («Кафе» / «Кафе»). Solid pill для category (фон+темний текст), outlined pill для subcategory (рамка). 2 точки рендеру.
- **B-182 закрито** (`14c91c8`) — **add_medication пропускав logAction → undo silent skip.** `case 'add_medication'` у `tool-dispatcher.js:162-176` має early-return перед головним dispatcher-loop logAction (рядки 587-590). Явний `logAction` як у `create_health_card:111` і `add_allergy:210` ПРОПУСТИЛИ. Симптом: юзер каже «скасуй» після «лікар прописав ібупрофен» → AI бачить порожній action-log → fallback на trash (там теж нічого) → мовчазне «нема що скасовувати». Ліки залишаються у картці. **Дзеркальна діра до B-174 (db0YY 12.05)** — той самий патерн «early-return обходить logAction». **Знайдено:** silent-bug-scout Council-агент (Sonnet). **Фікс:** + `logAction('add_medication', args, med.id, null, 'dispatcher');` після успішного `addMedicationToCard`. Закрив повний undo circle разом з `delete_medication` tool (вище).
- **B-181 закрито** (`06efd93`) — **add_medication без health-картки → AI fallback на save_memory_fact.** Симптом (smoke-test 13.05): «Приймаю парацетамол» у порожньому Здоров'ї → AI: «Не знайшов препарат у картці. Уточни назву.» → «Запиши шо приймаю» → AI зробив `save_memory_fact(category=health)` → «Запам'ятав ✓». Юзер не зрозумів куди записав. Корінь: tool description `add_medication` не вказував що робити коли немає cards → AI шукав найпростіший fallback. **Фікс:** оновлено tool description «БЕЗ карток — НЕ викликай add_medication і НЕ роби save_memory_fact. Спочатку create_health_card, потім add_medication у batch tool_calls» + правило в INBOX_SYSTEM_PROMPT для гілки «лікар прописав X / приймаю X». **Знайдено:** prompt-engineer-auditor Council-агент.
- **B-180 закрито** (`06efd93` → `6cedd3d` повний фікс) — **save_finance.subcategory/category вигадування.** Початково регресія від PJi7l `7e9ea7b` (08.05) — ослабили з «ЗОБОВ'ЯЗАНИЙ» → «ОПЦІЙНЕ + не питай юзера». Моя свіжа B-180 (`06efd93`) додала «вбудовані підказки» — це порушило принцип «брати тільки юзерські». Повний фікс через 3-рівневий захист: код-side у `processFinanceAction` + жорсткі промпт-rule + clarify chip-діалог. Деталі у B-finance-AI-categories вище.
- **B-179 створено** (відкритий) — UI Кошика відсутній — тільки backend (`nm_trash` + 11 типів restore після nliW8). Деталі у секції 🟡 Середні. Окрема сесія/блок ROADMAP.
- **B-170 РЕГРЕСІЯ часткова** (`3547c2c`) — db0YY 12.05 закрив B-170 у 17 точках 6 файлів (inbox/evening/notes/projects/calendar/finance), але **пропустив `src/tabs/habits.js` (3 рендер-функції)**: `renderHabits` Me-tab (4 точки 454/458/465/467), `renderProdHabits` Продукт-tab (4 точки 775/779/786/788), `_renderQuitHabitCard` (5 точок 865/898/901 — onclick+ontouchend подвійні). 26 SyntaxError у production логах v862 (`No identifiers allowed directly after numeric literal` ×22+×4). Юзер тапає галочку звички → нічого не відбувається. **Корінь:** db0YY 6-grep чек-ліст з `lessons.md` не охопив habits.js (окремий render-шлях). **Фікс:** 10 Edit'ів — обгортка `'${h.id}'` / `\\'' + h.id + '\\''` для template literal і string concat. **Урок у lessons.md:** додано «renderProdHabits/renderHabits/_renderQuitHabitCard — окремі render-шляхи у habits.js, повторити grep вручну». **Знайдено:** Council 4 агенти (Sonnet) — code-regression-finder локалізував + silent-bug-scout підтвердив 26× SyntaxError у логах.
- **B-182 закрито** (`14c91c8`) — **add_medication пропускав logAction → undo silent skip.** `case 'add_medication'` у `tool-dispatcher.js:162-176` має early-return перед головним dispatcher-loop logAction (рядки 587-590). Явний `logAction` як у `create_health_card:111` і `add_allergy:210` ПРОПУСТИЛИ. Симптом: юзер каже «скасуй» після «лікар прописав ібупрофен» → AI бачить порожній action-log → fallback на trash (там теж нічого) → мовчазне «нема що скасовувати». Ліки залишаються у картці. **Дзеркальна діра до B-174 (db0YY 12.05)** — той самий патерн «early-return обходить logAction». **Знайдено:** silent-bug-scout Council-агент (Sonnet). **Фікс:** + `logAction('add_medication', args, med.id, null, 'dispatcher');` після успішного `addMedicationToCard`. Reverser `delete_medication` поки не реалізовано — TODO для майбутнього tool.
- **B-181 закрито** (`06efd93`) — **add_medication без health-картки → AI fallback на save_memory_fact.** Симптом (smoke-test 13.05): «Приймаю парацетамол» у порожньому Здоров'ї → AI: «Не знайшов препарат у картці. Уточни назву.» → «Запиши шо приймаю» → AI зробив `save_memory_fact(category=health)` → «Запам'ятав ✓». Юзер не зрозумів куди записав. Корінь: tool description `add_medication` не вказував що робити коли немає cards → AI шукав найпростіший fallback. **Фікс:** оновлено tool description «БЕЗ карток — НЕ викликай add_medication і НЕ роби save_memory_fact. Спочатку create_health_card, потім add_medication у batch tool_calls» + правило в INBOX_SYSTEM_PROMPT для гілки «лікар прописав X / приймаю X». **Знайдено:** prompt-engineer-auditor Council-агент.
- **B-180 закрито** (`06efd93`) — **save_finance.subcategory mute-fall — AI пропускав підкатегорію для очевидних матчів.** Регресія від PJi7l `7e9ea7b` (08.05) — ослабили з «ЗОБОВ'ЯЗАНИЙ» → «ОПЦІЙНЕ + не питай юзера» щоб AI перестав спам-перепитувати. Побічний ефект: AI почав пропускати subcategory взагалі, навіть «кава→Кафе» (smoke-test 13.05 «Купив каву 3 євро» → Їжа без Кафе). **Фікс:** додано вбудовані fuzzy-підказки у tool description: Їжа→(кава/капучино=Кафе; хліб/молоко=Продукти; обід=Ресторан), Транспорт→(бензин=Паливо; таксі=Таксі), Підписки→(назва сервісу). Принцип: «однозначний матч — заповни; сумнів — пропусти, не питай юзера».
- **B-170 РЕГРЕСІЯ часткова** (`3547c2c`) — db0YY 12.05 закрив B-170 у 17 точках 6 файлів (inbox/evening/notes/projects/calendar/finance), але **пропустив `src/tabs/habits.js` (3 рендер-функції)**: `renderHabits` Me-tab (4 точки 454/458/465/467), `renderProdHabits` Продукт-tab (4 точки 775/779/786/788), `_renderQuitHabitCard` (5 точок 865/898/901 — onclick+ontouchend подвійні). 26 SyntaxError у production логах v862 (`No identifiers allowed directly after numeric literal` ×22+×4). Юзер тапає галочку звички → нічого не відбувається. **Корінь:** db0YY 6-grep чек-ліст з `lessons.md` не охопив habits.js (окремий render-шлях). **Фікс:** 10 Edit'ів — обгортка `'${h.id}'` / `\\'' + h.id + '\\''` для template literal і string concat. **Урок у lessons.md:** додано «renderProdHabits/renderHabits/_renderQuitHabitCard — окремі render-шляхи у habits.js, повторити grep вручну». **Знайдено:** Council 4 агенти (Sonnet) — code-regression-finder локалізував + silent-bug-scout підтвердив 26× SyntaxError у логах.

_Сесія **db0YY** (12.05.2026) — B-108 регресія після myshu 7 UUID-міграцій + Health 3B-8 + steps + integer→string schemas + cycle DI + AI prompts examples + universal undo coverage:_
- **B-177 закрито** (`b7b9e74`) — **AI prompts для 3 delete-tools мали слабкі/відсутні descriptions для ID-полів.** Корінь (prompt-engineer-auditor): `delete_event.event_id` БЕЗ description, `delete_health_card.card_id` БЕЗ description, `delete_allergy.allergy_id` лише «ID алергії з контексту» без UUID-уточнення → AI міг вигадати ID за назвою у Strict mode. **Фікс:** всі 3 — «UUID X з контексту (формат [ID:xxxx-xxxx]). НЕ вигадуй — копіюй точно.»
- **B-176 закрито** (`b7b9e74`) — **save_routine undo не оновлював Календар** (pre-existing з myshu 11.05). Корінь (silent-bug-scout): `action-reversers.js:59` диспатчив `nm-data-changed detail:'routine'`, але `DETAIL_TO_KEY` у `boot.js:178-192` не мав запису → `handleSyncKey` тихо повертав. localStorage відкочувався правильно, але Календар показував старий розпорядок до наступного переходу вкладки. **Фікс:** + `'routine': 'nm_routine'` + `'allergies': 'nm_health_cards'` у DETAIL_TO_KEY; + 2 рендер-точки у KEY_RENDER_MAP (nm_routine, nm_events → renderCalendar); `renderCalendar` тепер `export` (раніше локальна у calendar.js:259).
- **B-175 закрито** (`bb0c50e`) — **restoreFromTrash НЕ мав case `'health_card'`** хоча `deleteHealthCardProgrammatic` (health.js:382) кидав `addToTrash('health_card', removed)`. У db0YY я додав allergy/event/project але ПРОПУСТИВ health_card. Симптом: юзер відновлює видалену картку з кошика → `return true` без даних, картка не з'являється. Silent data loss. **Знайдено:** silent-bug-scout (КРИТИЧНО #1). **Фікс:** + case `'health_card'` у `trash.js` з імпортом `getHealthCards/saveHealthCards` (saveHealthCards експортовано) + renderHealth.
- **B-174 закрито** (`bb0c50e`) — **🚨 КРИТИЧНА: undo для save_finance/create_health_card/add_allergy тихо повертав false.** `processUniversalAction` у `habits.js` НЕ мав cases `delete_transaction`/`delete_health_card`/`delete_allergy` — ці tools жили ТIЛЬКИ у `tool-dispatcher.js` direct handlers. `action-undo.js executeReverse` через DI передавав `processUniversalAction` → шле `{action:'delete_X',...}` → return false → AI пише «⚠️ Не зміг відмінити». `save_finance` undo ламався з **myshu (24+ год у проді)** — reverser існував з myshu але delete_transaction никогда не виконувався. Я додав ще 2 reverser у db0YY (create_health_card, add_allergy) з тим самим патерном. **Знайдено:** code-regression-finder + silent-bug-scout одночасно. **Фікс:** додано 3 cases у `processUniversalAction`: delete_transaction (з addToTrash('finance') + renderFinance), delete_health_card (deleteHealthCardProgrammatic), delete_allergy (deleteAllergy). Імпорти `{deleteHealthCardProgrammatic, deleteAllergy}` додано у habits.js.
- **B-173 закрито** (`9b5e25d`) — **AI prompts examples з числовими ID + medID inconsistency**. Корінь: `GLOBAL_TOOLS_RULE` у `prompts.js:233-234` показував AI приклади `event_id:123`/`event_id:456` з ери Date.now() ID. Після UUID-міграції AI отримує у контексті `[ID:550e8400-...]` але приклад каже передавати число. У Strict mode AI міг плутатись між «приклад» (число) і «реальність» (UUID-string). Окремо: `health.js:1708` показувало `[medID:${m.id}]` — інконсистентний префікс щодо решти 9 context-показувачів (всі решта `[ID:...]`). **Фікс:** приклади на справжні UUID + явна підказка «копіюй точно як є». `medID` уніфіковано на `ID`. **Як знайдено:** Голова делегував Council 3 агентів для Сесії 4 верифікації + сам широко прогрепав prompts після їх рекомендації «відкласти Сесію 4». Це 4-й клас бага myshu UUID-міграцій (B-170/B-171/B-172/B-173).
- **B-172 закрито** (`506d49f`) — **🚨 КРИТИЧНА: tool schemas `type: "integer"` для ID-полів** → OpenAI Strict mode відкидав AI-виклики для всіх UUID-entity (7 типів). Юзер каже «видали картку», «зміни задачу», «оновити статус» — AI міг не виконати (silent fallback). 28+ точок у `prompts.js` для: project_id (9), step_id (1), habit_id (3+habit_ids array), event_id (2), note_id (1), card_id (7), med_id (1), allergy_id (1), transaction id (2). Tasks `task_id` myshu виправила правильно (8 точок string), решту 7 типів — забула. **Фікс:** заміна `type: "integer"` → `type: "string"` для всіх ID-полів через Edit replace_all. Не зачепило target_count / progress / ttl_days / days[] — це не ID. Знайдено db0YY коли планував Health undo reverser — побачив `card_id: integer` у delete_health_card schema.
- **B-170 закрито** (`f66acfb`) — **Onclick без лапок навколо UUID** у 17 точках 6 файлів → SyntaxError на тап у v841. Корінь: myshu (11.05) мігрувала Habit/Event/Note/Moment/Finance/Project/InboxItem на UUID-string (v9-v15) але не зробила grep `onclick="fn(${.*\.id})"` після кожної міграції. UUID з дефісами у HTML-атрибуті без лапок парситься як вираз `550e8400 - e29b - ...` → ReferenceError. Точки: inbox.js:317 navigateInboxItem; evening.js:188,194,285,286 (момент open/delete + habit hold/relapse); notes.js:560,564,1324 (openNoteView/openNoteMenu/chat search); projects.js:130,329,345 (project open/timeline/step toggle); calendar.js:168,230,429,486 (4 event-edit рендер-точки); finance.js:259 parseInt(txId)→NaN свайп; finance.js:474,516 (openEditTransaction 2 рендер-точки). **Фікс:** обгорнути `${id}` у одинарні лапки `'${id}'`; для finance.js:259 прибрати parseInt — txId лишається string. Той самий клас бага що B-108 (xGe1H 27.04 для tasks).
- **B-171 закрито** (`2cf5510`) — **Date.now() ID при створенні entities через AI/handler** у 8 точках. Корінь: myshu пройшла boot-міграції готових даних але не оновила точки СТВОРЕННЯ нових entities — мікс типів у localStorage (старі UUID-string + нові number) → strict `find(x => x.id === id)` повертає false → silent fail свайп-видалення/undo. Точки: evening-actions.js:106,140,159 (save_task/save_habit/save_finance); habits.js:1021 (inbox-картка для AI task); core/utils.js:42 (saveOffline → Inbox item); owl/inbox-board.js:1075 (Finance tx через OWL); inbox.js:1274 (inboxCardId AI dispatch); calendar.js:55 (generateWeeklySeries рекурентна копія). **Фікс:** замінити `Date.now()` на `generateUUID()` + додати імпорт у core/utils.js + calendar.js. Лишилось: sub-entity steps (task.steps/project.steps досі Date.now() — окрема сесія) + Health 11+ Date.now() (Сесія 3B-8).


---

> **Винесено з `NEVERMIND_BUGS.md` 18.04.2026 (сесія FMykK).**
> У живому файлі [`../NEVERMIND_BUGS.md`](../NEVERMIND_BUGS.md) залишаються відкриті баги + закриті у 2 останніх активних сесіях (згідно `_ai-tools/SESSION_STATE.md`).
> При виклику `/finish` у новій сесії — закриті з найстаршої з 2 активних переносяться сюди.

---

## ✅ Закриті баги (хронологічно, нові зверху)

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
_Сесія **PJi7l** (08.05.2026) — хвости LfA6w: 2 уроки у lessons.md + B-158 фікс:_
- **B-158 закрито** — `src/tabs/health.js:113` (addAllergy) + `:1524` (newCard) — `id: Date.now()` без `Math.random()` суфіксу. Ризик ID колізії при batch tool_calls. Фікс: уніфіковано до `+ Math.floor(Math.random()*1000)`.

_Сесія **LfA6w day2** (07-08.05.2026) — 33 коміти, decision-tree рефакторинг промптів через 3 ітерації Gemini + 5 Sonnet агентів, subcategory у save_finance, контекстні чіпи Phase A+Б, mental models у CLAUDE.md:_
- **6 регресій від свіжих фіксів** (без B-номерів) — tool-dispatcher.js:80 subcategory, finance-chat.js:105 txSummary без [ID:N], CHIP_PROMPT_RULES забруднював JSON-аналітику me.js, Brain Pulse debounce reset на КОЖНОМУ event, Tab-чати без CHIP_PROMPT_RULES, inbox.js code-guard dedupe save_finance+save_task.
- **Apostrophe-нормалізація finance category** (`7790a42`+`48c24e7`) — `_normCat = s => s.replace(/[ʼ’`]/g, "'").toLowerCase()` у processFinanceAction + processUniversalAction + matchSubcategoryFromComment.
- **Build break бектіки у CHIP_PROMPT_RULES** (`be6f708`) — `\`subcategory\`` template literal ламав esbuild. Auto-merge впав 4 коміти підряд. Урок: **node build.js обов'язково для template literal**.
- **action='complete' guard у normalizeChips** (`8669924`) — code-side safety net.
- **Інше:** Скрол у нотатках, стрілки переміщення категорій, Phase A+Б контекстні чіпи, перша особа правило.

_Сесія **LfA6w day1** (07.05.2026) — нічний silent-bug-scout аудит знайшов 9 багів, 5 закрито:_
- **B-151** (`2ab1a71`) — memory.js _saveFacts() не диспатчив nm-data-changed. Регресія Один-Мозок-V2.
- **B-152** (`c18c7d1`) — escapeHtml не екранує апостроф. `Roman's coffee` ламав onclick. Фікс: новий `escapeJsArg(s)` у utils.js. 10 точок у 5 файлах.
- **B-153** (`2ab1a71`) — дублює B-151 для saveInbox().
- **B-154** (`735b525`) — JSON.parse без try/catch у batch-tool_calls. Фікс: try/catch + continue.
- **B-157 + B-159** разом з B-152 — крихкі escape патерни.

_Сесія **MPVly-day2** (06.05.2026) — 23 баги, Council 5 агентів, Аналітика redesign, календар SVG icons:_
- **B-150** — Календарна модалка кольори/SVG icons + 6px кольорова крапка-індикатор.
- **B-149** — memory-modal swipe `data-skip-auto-swipe`.
- **B-143 (REAL корінь Аналітики)** — `_refreshAnalyticsContent` substring match `"overflow-y:auto"` ламався норм-стилем браузера. Фікс: id + getElementById + cloneNode. **6 попередніх фіксів B-138..B-142 лishали симптом.** Урок Council 5 агентів.
- **B-135, B-136, B-142, B-141, B-140, B-139, B-138, B-137, B-134, B-132, B-133, B-128, B-129, B-130, B-131** — iOS Safari quirks серія (composite layer, button:active scale, animation forwards, backdrop, swipe threshold, ID conflict, REMINDER_RULES, t-shadow, swipeClose, drum-col mask-image, t() обгортки, DETAIL_TO_KEY reminder, aiLoading guard).
- **i18n 110 рядків** — habits.js, health.js, nav.js, finance-analytics.js. Baseline 685 → 575.

_Сесія **MPVly** (05.05.2026) — chip render Inbox + B-125 + B-126 + B-127 + tasks.js shadow:_
- **B-127** — табло Продуктивності stale 13 год. Новий `_isStaleTaskGeneralization` + 60хв safety net.
- **Critical t-shadow tasks.js** (`7cd2259`) — `t2 is not a function`. 9 shadow точок. Фікс: rename → task.
- **Inbox чіпи raw-JSON** (`63223f2`) — REMINDER_RULES + parser fallback.
- **B-125** (`4082a0c`) — чіп «Завтра вранці» → reminder на сьогодні. Фікс REMINDER_RULES.
- **B-126** — нова tool `delete_reminder` + 3-сховищний cleanup.

_Сесія **QDIGl** (05.05.2026) — Розпорядок merge + delete_project + B-117 audit fix + 19 раундів i18n:_
- **B-117 закрито остаточно** (`923ae80` + `9e30379`) — табло звичок stale. Pruning content fallback + isHabitTextNegative + DOW Mon=0 + TTL прострочених + findProjectByName.

_Сесія **rC4TO** (04.05.2026) — silent failures fixedo + swipe-delete карток Здоров'я + iOS правило + Notes render guard:_
- **B-122** (`8a05ada`) — Health Phase C інтерв'ю чіпи мовчать. chips.js whitelist + escape `"`.
- **B-123** (`431b433`) — `create_project` у Фінансах висне. Handler + універсальний SILENT FAILURE GUARD.
- **B-124** (`2f96593`) — вкладка Нотатки порожня. 3 захисти у notes.js.


### Сесія UvEHE (03.05.2026) — фінал модалок + drum-picker + Settings 4-ітерац

| ID | Файл | Симптом | Корінь + фікс |
|---|---|---|---|
| **B-120** ✅ | `index.html` `#health-card-modal` | iOS rubber-band у модалці Health картки. | Calendar-pattern: top-level `#health-card-modal-overlay` як sibling (НЕ дитячий backdrop-div) + onclick на root з `event.target===this`. Окремий swipe-handler на root через `setupModalSwipeClose`. iOS rubber-band усунуто бо overlay не у transformed-context. |
| **B-121** ✅ | `index.html` Health картка | Native iOS picker для дати/часу — горизонтальний scroll + перекриття. | Заміна на власний drum-picker mini-модалку (`#health-dt-picker-modal`) з 3-кол date drum + 2-кол time drum. Native iOS picker більше не відкривається. Поля-trigger показують форматовану дату «3 трав. 2026» / «09:00». `_initDrumCol` експортовано з calendar.js. |

### Сесія 4xJ7n (03.05.2026) — iPhone smoke-test + B-118/B-119 фікси

| ID | Файл | Симптом | Корінь + фікс |
|---|---|---|---|
| **B-118** ✅ | `index.html:174` (back-link у workspace проекту). Знайдено 4xJ7n iPhone v563 21:40. | Кнопка «< Проекти» у workspace не працює — тап нічого не робить, юзер залипає у картці проекту. | `closeProjectWorkspace` експортована OK і функція тривіальна. Корінь у CSS: back-кнопка без `position:relative; z-index:N`, hit-area тільки 16×16 (svg) + текст. OWL board overlay перехоплював клік. Фікс: `position:relative; z-index:10; padding:8px 4px; margin:-8px -4px 4px -4px` (44px hit-area Apple HIG без зсуву layout). Коміт `59067ce`. CACHE bump → `nm-20260502-2200`. |
| **B-119** ✅ | `src/tabs/inbox.js:96` (`addInboxChatMsg`). Знайдено 4xJ7n iPhone v563 21:52. | Чіпи clarify-guard ([У щоденник]/[Як момент]/[Не зберігати]) рендеряться у Inbox чаті але візуально обрізаються знизу контейнером — видно тільки верхівку. | `el.scrollTop = el.scrollHeight` синхронно після `el.appendChild(chipsRow)`. iOS Safari не встигає порахувати висоту нового chipsRow до scrollTop. Фікс: подвійний scrollTop (sync + `requestAnimationFrame(() => { el.scrollTop = el.scrollHeight })`) — рекомендований патерн для iOS. Аналогічну регресію може мати 6 інших чатів — окремо перевірити. Коміт `0b4ed28`. |

### Сесія mUpS8 (02.05.2026) — Universal clarify-guard + Pattern Learning roadmap + B-116

| ID | Файл | Симптом | Корінь + фікс |
|---|---|---|---|
| **B-116** ✅ | `src/tabs/projects.js` (`renderProjectsList`). Знайдено mUpS8 02.05. | Картка проекту не мала способу видалення — ні свайпа, ні кнопки. Функціонал відсутній цілком (grep `attachSwipeDelete\|deleteProject\|delete-btn` дав 0 результатів). | Додано свайп вліво → корзина з 5-сек відкатом (як у Notes/Inbox). Pattern: `<div class="project-card-wrap" data-id="${p.id}">` обгортка, всередині `<div class="card-glass project-card">`. Імпортовано `attachSwipeDelete`, `addToTrash`, `showUndoToast`. Нова функція `_attachProjectsSwipeDelete()` викликається після кожного `renderProjectsList`. Callback: `addToTrash('project', item)` + `saveProjects(filtered)` + `showUndoToast` з restore через `splice` назад на оригінальну позицію. Уніфіковано з 7 іншими вкладками. Коміт `fdf370f`. CACHE bump → `nm-20260502-1900`. |

### Сесія bOqdI (02.05.2026) — Council механізм + 3 архітектурні фікси

Конкретні B-XX баги не закривала. **3 архітектурні борги без B-XX закриті** (знайшов перший Council 5 агентів):
- `evening.js / _rescheduleTask` (`19e112f`) — пряма запис `nm_tasks` через `localStorage.setItem` обходив канон `saveTasks()`.
- `health.js / _syncMedicationToTask` (`25e60da`) — те саме + видалено застарілий коментар «lazy-import щоб уникнути циклічних залежностей» (у IIFE bundle циклу не існує).
- `proactive.js` (`8c3fe8d`) — два окремі `addEventListener('nm-data-changed')` об'єднано в один. Гігієна перед Pre-Migration Підсесією 3.

### Сесія rKQPT (02.05.2026) — i18n міграція + 2 critical fixes + Council чернетка

**Закрила 1 critical bug:** `projects.js` ReferenceError при створенні нового проекту (`e64cf28`). Корінь: функція `getOWLPersonality` перенесена з `core.js` у `prompts.js` 17.04, у `projects.js` import не оновили → esbuild перейменував на `getOWLPersonality2` через колізію → ReferenceError. Створено `scripts/check-imports.js` як guard (інтегрований у `build.js`). Виправлено дефект самого guard (пропускав `t()` через `if (name.length<=1) continue;`).


_Сесія **6ANWm** (01.05.2026) — інфраструктурна. CLAUDE.md 561→94 + 4 RULES_*.md + видалено 2 шумних хуки (`quick-dialogue-detector.sh` + `check-response-violations.js`). Конкретні B-XX баги не закривала. 1 підозра (Stop-хук дублів `exit 2`) — корінь у архітектурі Stop-хуків (не можуть скасувати вже відправлене повідомлення), вирішено видаленням, не лагодженням. Винесено з NEVERMIND_BUGS.md у BqTWF 02.05.2026 Phase 5._

_Сесія **LW3j8** (01.05.2026) — інфраструктурна. HOT_RULES + самотест-хук після `/start` + i18n обгортки `finance-modals.js` (24) + `notes.js` (30) + рефакторинг категорій папок нотаток (`src/data/notes-categories.js`). Конкретні B-XX баги не закривала. 2 підозри: (1) lazy `t()` без явного імпорту в `notes.js` працював через esbuild IIFE bundle (виправлено явним імпортом у `03f70c7`); (2) ризик legacy папок без апострофа (`Здоровя`) — потребує iPhone smoke-test. Винесено з NEVERMIND_BUGS.md у BqTWF 02.05.2026 Phase 5._

_Сесія **Ph8ym** (30.04.2026) — інфраструктурна сесія: фікс детектора i18n + 41 обгортка UI у 3 файлах + урок про точність звітів + сторожове правило для V3 Фази 3 + жива перевірка pre-commit-testing-log хука. Конкретні B-XX баги не закривала. Знайдено 1 нову підозру (детектор i18n плутається з regex-літералами що містять лапки) — нотатки у `_ai-tools/SUSPICIOUS_NOTES_Ph8ym.md`, не оформлено як B-XX за рішенням Романа («лишити для наступної сесії»). Винесено з NEVERMIND_BUGS.md у /finish 6ANWm 01.05.2026._

### Сесія EhxzJ (30.04.2026) — фікс-сесія, 6 OWL-багів закрито + B-97

⚠️ Окрім B-109..B-114, у EhxzJ також закрито **B-97 «Прийом у лікаря відміни»** (раніше відкритий 🔴) — через V3 Фаза 1 (`_reasoning_log` обовʼязковий у 60 tools = zero-shot CoT, модель змушена явно подумати ПЕРЕД дією, що ламає Context Segmentation Failure у tab-chats).

- **B-114 🟡** — у звіті «Глибокий звіт» AI плутав закриті задачі і виконані звички. У `_buildWindowContext` (`src/tabs/me.js`) додано чіткіші лейбли блоків з 🎯/✅/📥. У промпті додано блок «РОЗРІЗНЕННЯ СУТНОСТЕЙ». Bump `INSIGHTS_VERSION` 4→5.
- **B-110 🔴** — OWL табло кидало 3 теми в одне повідомлення. У промпті `proactive.js` додано жорстке правило «ОДНА ТЕМА на повідомлення».
- **B-111 🔴** — табло нагадувало про події о 19:00 коли вже 23:40. У `getAIContext` (`src/ai/core.js`) додано `isPassedToday()` — минулі сьогодні події ідуть у окремий блок `[ФАКТ] Сьогодні вже МИНУЛІ`.
- **B-109 🟡** — OWL табло займало пів-екрану. У `style.css`: аватар 96→76px, font 88→68, padding-left 104→84, додано `-webkit-line-clamp:4`.
- **B-112 🟡** — у звіті AI писав «14%». Замінено на `${done} з ${scheduled} днів`. Bump `INSIGHTS_VERSION` 3→4.
- **B-113 🟡** — блок «OWL знає тебе» не реагував на зміни. Listener `nm-data-changed` у `me.js` з debounce 5 сек.

### Сесія H0DxS (29.04.2026) — фікс-сесія, 4 коміти

Тижневий зріз звичок у `getAIContext` (`4fc534f`) — корінь «OWL знає тебе каже жодної звички за тиждень» при 3/4 виконаних сьогодні. Старий контекст давав звичкам тільки СЬОГОДНІ. Додано блок `[РЕАЛЬНІ ДАНІ ЗА 7 ДНІВ]` з done/scheduled на кожну звичку. Bump `INSIGHTS_VERSION` 2→3. Правило «ЗОВНІШНІ ФАКТИ» у `getOWLPersonality()` проти галюцинацій (`886559b`) — корінь AI вигадав сюжет фільму «Кіллхаус» якого не знає. «Відкрий звички» з чату Я → підтаб Звички (`6bc5d5b`) — закрито баг lRnXU. Блок «🦉 OWL знає тебе» — білий фон 0.85 + темніша рамка + тінь. Видалено онбординг-модалку (`1049c0f`). Деталі → `SESSION_STATE_archive.md`.

### Сесія TdIqO (29.04.2026) — 0 багів закрито

Повна переробка вкладки «Я»: 2 progress-кільця замість 4 графіків, тиждень-картки 7 днів зі шкалою заповнення, toast матове скло + зелена «Відновити», видалено ~25 ✓-підтверджень дій. Уніфікація базових кольорів сутностей по Inbox (Подія `#3b82f6`, Задача `#2fd0f9`, Звичка `#16a34a`). Багів NeverMind не закрила. Деталі → `_archive/SESSION_STATE_archive.md`.

### Сесія Aps79 (27.04.2026) — 5 багів закрито

| # | Файл | Опис | Як виправлено |
|---|------|------|----------------|
| B-105 | `src/ai/prompts.js` + `src/tabs/habits.js` | Сова видалила «Зареєструватися на Upwirk» замість закрити при «Поміняв номер на склад» | Промпт чату Продуктивності не мав правила про минулий час → модель фузі-матчила «поміняв номер» на «Upwirk реєстрація» через спільний номер → `delete_task`. **FIX:** правило про минулий час у `sendTasksBarMessage` («поміняв/подав/зробив» → `complete_task` на ЯВНУ задачу або текст-питання, НІКОЛИ delete без слова «видали/забудь»). Посилений опис tool `delete_task` у INBOX_TOOLS — поширюється на всі 8 чатів. Коміт `f394b40`. |
| B-106 | `src/tabs/habits.js` (processUniversalAction + sendTasksBarMessage) | Сова замовкла на 3 повідомленнях у чаті Продуктивності, точки `...` назавжди | AI кликав `complete_task`/`complete_habit` через tool_calls. Диспетчер йшов через `_toolCallToUniversalAction` → `processUniversalAction` де ОБРОБНИКА НЕ БУЛО (тільки у fallback text-JSON шляху). Жодного `addMsg` → typing dots не зникали. **FIX 1:** додано `complete_task`/`complete_habit`/`add_step` у `processUniversalAction`. **FIX 2 (safety net):** якщо `dispatchChatToolCalls` повернув false — показати fallback `msg.content` або «Не зрозуміла дію». Гарантує що typing dots завжди зникнуть. Коміт `f394b40`. |
| B-107 | `src/tabs/tasks.js` + `index.html` | Велика синя картка з AI-порадами зверху списку при створенні задачі | Стара фіча `askAIAboutTask` викликалась з `saveTask`, заповнювала блок `tasks-ai-comment` AI-коментарем на 4+ речення. **FIX:** видалено виклик `askAIAboutTask` з `saveTask` + саму функцію + HTML-блок з `index.html`. Імпорти AI-функцій лишено (використовуються в інших місцях). Коміт `f71b0b8`. |
| B-108 | `src/tabs/tasks.js` (5 onclick) + `src/tabs/evening.js` (2 onclick) + handlers | НОВИЙ після xGe1H — тап ✓ рукою на задачі НЕ ПРАЦЮВАВ після UUID-міграції | HTML `onclick="toggleTaskStatus(${t.id})"` з UUID-string давав `onclick="toggleTaskStatus(abc-def-123)"` → JS парсить як арифметику ідентифікаторів `abc - def - 123` → ReferenceError. Тап не доходив до handler. Юзер мусив закривати задачі через AI у чаті. **FIX:** обгортка `'${t.id}'` у одинарні лапки у 5 місцях (taskCardClick, toggleTaskStatus, toggleTaskStep, rescheduleTaskTomorrow/Week) + `String()` typesafety у `toggleTaskStatus/Step/openEditTask/_rescheduleTask` + AI complete_task тепер викликає експортовану `toggleTaskStatus` → 3-фазна анімація закриття як ручний тап. Коміт `2eb9347`. |
| B-80 | `src/tabs/notes.js` + `style.css` | Свайп-видалення папки/нотатки — стрибок чіпів зверху на 50-250мс | При тапі кошика `onDelete` викликав `saveNotes+renderNotes` миттєво → DOM перерисовувався поки swipe-transform на старому wrapEl ще активний → перша папка/нотатка залазила під чіпи OWL-баблу зверху. **FIX:** дзеркало `task-completing` патерну. Новий CSS клас `.swipe-deleting` (opacity:0 + max-height:0 + margin:0 з transition 0.25-0.28s) + хелпер `_animateSwipeRemoval(wrap, doRemove)` у `notes.js` — фіксує поточну висоту inline, додає клас через 30мс, через 310мс виконує save+render+undoToast. Працює і для нотаток і для папок. Коміти `ee2afad`, `f636d49` (syntax fix). |

---

### Сесія C8uQD (27.04.2026) — OWL Silence + Pruning Engine 3 фази

| # | Файл | Опис | Як виправлено |
|---|------|------|----------------|
| B-100 | `src/ai/ui-tools.js` (новий tool) + `src/owl/inbox-board.js` (`shouldOwlSpeak`) + `src/ai/prompts.js` (UI_TOOLS_RULES) + `src/ai/core.js` (getAIContext silence flag) | Сова не реагує на пряме «відступи» — iPhone 22-23.04 скрін: юзер написав «Не доставай з задачами» → сова відповіла «Давай зосередимось на вечері. Що ще можу запропонувати?». | **Закрито структурно через Silence Engine (Фази 1+3):** Замість додавання нових промптових тригер-слів («не доставай / відчепись» — модель інерційно ігнорує) — введено AI-tool `request_quiet(duration_hours)` який пише `nm_owl_silence_until` у localStorage. Чек тиші у `shouldOwlSpeak()` блокує всі 4 канали сови. Фаза 3 додала `[ВАЖЛИВО — РЕЖИМ ТИШІ]` у `getAIContext()`. Виявлено v2vYo 24.04, фікс C8uQD 27.04. Коміти `044bc7f`, `d89ef79`, `baf91bc`. |
| B-102 | `src/owl/inbox-board.js` (`shouldOwlSpeak`) + `src/ai/ui-tools.js` (`request_quiet` handler) | Табло не реагує на настрій у чаті — юзер у чаті пише «не доставай», сова продовжує показувати проактивні пропозиції. | **Закрито через Silence Engine Фаза 1.** Не треба новий тип сигналу — просто mute усієї системи через `nm_owl_silence_until`. Виявлено v2vYo 24.04, фікс C8uQD 27.04. Коміт `044bc7f`. |

### Сесія UVKL1 (26.04.2026)

| # | Файл | Опис | Як виправлено |
|---|------|------|----------------|
| B-103 | `src/tabs/calendar.js` (helper) + 8 call-sites: `inbox.js` (4 місця), `habits.js` (3 місця), `evening-actions.js` (2 місця) | Дублікати подій у Календарі. AI повертав 2 `create_event` tool_calls в одній відповіді → дві однакові події. | Створено `addEventDedup(ev)` у `calendar.js` — перевіряє чи вже є подія з тією ж датою+часом+назвою за останні 60 сек. При дублі чат-бар повідомляє «Така подія вже є в календарі». Виявлено v2vYo 24.04, фікс UVKL1 26.04. |
| B-101 | `src/ai/core.js` (helper) + 9 call-sites: `evening-chat.js` (2), `finance-chat.js`, `habits.js`, `health.js`, `notes.js` (2), `projects.js`, `tasks.js` | Туманне «Щось пішло не так» на будь-яку помилку запиту — юзер не знав, повторювати чи це баг. | Створено `handleChatError(addMsg)` у `core.js`. Якщо `navigator.onLine === false` → «📡 Мережа не відповіла…». Інакше → «Щось пішло не так. Спробуй ще раз.» Виявлено v2vYo 24.04, фікс UVKL1 26.04. |

### Сесія R5Ejr (24.04.2026)

| # | Файл | Опис | Як виправлено |
|---|------|------|----------------|
| B-104 | `src/tabs/tasks.js` + `src/tabs/habits.js` + `src/owl/proactive.js` | Stale OWL board на вкладці Задач — сова повторювала «закрий 3 задачі: X, Y, Z» попри те що юзер щойно їх закрив тапом ✓. | **2 причини:** (1) у 4 з 8 місць `status='done'` ставилось БЕЗ `completedAt`. (2) У `getTabBoardContext('tasks')` не було блоку «Нещодавно закриті». Усі 4 місця тепер ставлять `completedAt+updatedAt` при 'done'. Коміт `3e3892a`. |

### Сесія v2vYo (24.04.2026)

| # | Файл | Опис | Як виправлено |
|---|------|------|----------------|
| B-97 | `src/ai/prompts.js` (+ `src/tabs/habits.js`) | Чат Задач відмовляв «це подія, а не задача» на «Прийом у лікаря відміни» попри наявність `delete_event` у `INBOX_TOOLS` | Доданий `GLOBAL_TOOLS_RULE` — спільний блок «інструменти глобальні у всіх 8 чатах». Глибший архітектурний фікс — через V3 Фазу 1 (`_reasoning_log`). Коміт `9e065a1`. |
| B-98 | `src/owl/proactive.js` (`generateBoardMessage`) | OWL табло не оновлювалось 8+ годин попри 5+ тригерів. Прапорець `_boardGenerating[tab]` залипав `true`. | Обгорнуто все тіло функції у `try { ... } finally { _boardGenerating[tab] = false; }` + watchdog `setTimeout(60s)`. Коміт `5b25374`. |
| B-99 | `src/owl/brain-pulse.js:42` | У логах `[brain-pulse] skip:` іноді з пустою причиною. | Fallback `judge.reason \|\| 'unknown'`. Коміт `5b25374`. |

### Сесія Gg3Fy (20-21.04.2026)
- **B-94** `src/tabs/health.js` + `src/ai/prompts.js` — "Алергія на пил" → UI-tool замість `add_allergy`. Архітектурна міграція Health chat з text-JSON → `INBOX_TOOLS`. Коміт `5563b15`.
- **B-95** `src/tabs/health.js` — "Завтра прийом у лікаря на 2" → UI-tool замість `create_event`. Те саме що B-94.
- **B-96** `src/ai/prompts.js` getHealthChatSystem — опис симптому писав у активну картку з іншою темою. Додано правило тематичного матчингу з 4 прикладами.

### Сесія EWxjG (20.04.2026)
- **B-93** `style.css` — чіпи у Inbox chat обрізані знизу через mask-image. Прибрано нижню точку fade + padding-bottom 20→28px.

### Сесія NRw8G (20.04.2026)
- **B-84..B-92** — 9 багів з iPhone v322 тесту: алергія/симптом/прийом у Health (B-84/85/86), parseContentChips регекс (B-87), мертва log_health (B-88), свайп чат-handle тонкий (B-89), темна тема галюцинація (B-90), "не їм X" → задача "купити X-free" (B-91), Memory модалка без свайпа (B-92). Коміти `058cd9d`, `8aebb3a`, `3b08d2c`, `ffba291`, `474a1f7`, `256330f`. Додатково `9200411` — save_memory_fact у Health/Finance/Projects.

### Сесія JvzDi (19.04.2026)
- **B-81** `src/ai/prompts.js` — "Відкрий задачі" → save_task замість switch_tab. Жорстке правило UI TOOLS. Коміт `240a0b5`.
- **B-82** `src/ai/ui-tools.js` — плацебо `set_theme` без реального ефекту. Прибрано визначення і handler.
- **B-83** `src/tabs/inbox.js` — чіпи у Health-інтерв'ю як текст замість кнопок. Портовано `_parseContentChips` з evening-chat. Коміт `0bf3d37`.

### Сесія 6GoDe (19.04.2026)
- **B-65** `src/core/boot.js` — "SW load failed" у логах 7+ разів на добу через `reg.update()` без `.catch()`. Додано тихі `.catch(() => {})`. Коміт `e634b12`.

---


| # | Коли | Опис |
|---|------|------|
| B-58 | 17.04.2026 (KTQZA) | **Автогенерація підкатегорій обмежена до 3.** Раніше дефолти у `FIN_DEFAULT_SUBCATS` містили по 5 на категорію — всі автоматично створювались. Фікс у 3 місцях `finance-cats.js`: `_makeCatObj` `.slice(0, 3)`, `normalize` у міграції доставляє до 3, `createFinCategory` бере до 3. Опис AI-tool оновлено. |
| B-57 | 17.04.2026 (KTQZA) | **Стрілки переміщення категорій у edit-режимі.** Було: блок "Позиція в сітці" у модалці. Стало: у edit-режимі ✎ на кожному кружечку 22px кнопки `‹ ›` ліворуч/праворуч → `moveFinCategory(id, ±1)`. `event.stopPropagation()` щоб не відкривалась модалка. |
| B-61 | 17.04.2026 (KTQZA) | **Тіні "левітації" на Hero кругу і кружечках категорій.** Hero donut — `drop-shadow` 2 шари, 0.18 alpha. Кружечки — `box-shadow` кольором самої категорії + outline у edit-режимі. |
| B-79 | 17.04.2026 (KTQZA) | **Safari/Chrome non-standalone застрягали на v53** попри PWA v193+. Корінь: деплой до B-73 фіксу мав cache-first SW → Safari кешував `sw.js` → zombie-lock. Фікс: meta-теги `Cache-Control: no-cache` у `<head>` + ручна інструкція очистити website data. |
| B-78 | 17.04.2026 (KTQZA) | **Дефолтні категорії отримували сірий `#78716c`.** `FIN_DEFAULT_COLORS` словник виразних кольорів для 30+ назв. `_makeCatObj`/`createFinCategory` пріоритизують дефолт. Міграція ремапить сірий на дефолтний. |
| B-75 | 17.04.2026 (KTQZA) | **Донат фрагментований + дубль "Їжа".** `catMap` у `renderFinance` групує за NAME — кожен дубль отримував sum. `dedupe(list)` у `_migrateFinCats` за `name.trim().toLowerCase()`, мерж підкатегорій. |
| B-76 | 17.04.2026 (KTQZA) | **`formatMoney` показував крапку** (`€52.20` замість `€52,20`). `.replace('.', ',')` після `toFixed(2)` у 11 місцях. |
| B-77 | 17.04.2026 (KTQZA) | **Кнопка "+додати" завжди створювала витрату.** Toggle "Витрата / Дохід" (pill-style) у модалці при створенні. Нова `setFinTxType(type)` скидає категорію при перемиканні. |
| B-44 | 17.04.2026 (KTQZA) | **Кома на калькуляторі ставила крапку** (`600.50`). `finCalcAppend` обробляє `','` і `'.'`, дисплей завжди `600,50`. При редагуванні `_finTxExpression = String(data.amount).replace('.', ',')`. |
| B-50 | 17.04.2026 (KTQZA) | **"Транзакції" → "Операції" у 18 видимих UI-місцях + AI-промпти.** Замінено у `finance.js/inbox.js/finance-chat.js/proactive.js/core.js/index.html` + 3 tool descriptions. Коментарі коду не чіпано. |
| B-70 | 17.04.2026 (cnTkD) | **Сітка категорій + Hero donut зникли з вкладки Фінанси.** `escapeHtml(undefined)` через биті категорії без `id`. Корінь: `processUniversalAction` робив `catList.includes('Їжа')` на масиві об'єктів → завжди false → `.push('Їжа')` додавав рядок → биті. 4 шари захисту: `escapeHtml` safe, `_migrateFinCats` перевіряє кожну, `_finCatsGrid` filter, `processUniversalAction` через `createFinCategory`. |
| B-71 | 17.04.2026 (cnTkD) | **Чат-бар Фінансів не створював картку в Inbox.** B-48 фікс у `finance.js` ніколи не виконувався бо `processUniversalAction` (habits.js) обробляв раніше. Перенесено логіку туди — тепер всі чат-бари створюють Inbox картку. |
| B-72 | 17.04.2026 (cnTkD) | **Інсайт дня вигадував числа** (€761 замість €750). Жорстке правило точності у промпті, явні формули, temperature 0.7→0.3. |
| B-73 | 17.04.2026 (cnTkD) | **PWA не оновлювалось на iOS standalone.** `sw.js` cache-first → network-first для HTML/JS/CSS, `SKIP_WAITING` message handler, `doReload` з `?_v=<timestamp>`. |
| B-74 | 17.04.2026 (cnTkD) | **Лічильник версій скинувся** (очікувалось 100+, було v53). Перехід на `deploy-counter.txt`=184, `auto-merge.yml` читає/пише файл замість бейджа. |
| B-45 | 17.04.2026 (cnTkD) | **Нотатки: шапка OWL табло не прозора.** Переписано `#page-notes` на flex-column + `applyBoardOverlays`. |
| B-46 | 17.04.2026 (cnTkD) | **Інсайт дня не оновлювався + шаблонний контент.** Кеш 12 год → 1 год, hash-інвалідація, переписаний промпт, 5 конкретних шаблонів. |
| B-47 | 17.04.2026 (cnTkD) | **Дублікат папки "Здоров'я".** AI створював різні варіанти апострофів (U+0027, U+02BC, U+2019). `normalizeFolderName()` + міграція. |
| B-48 | 17.04.2026 (cnTkD) | **Операція через чат-бар Фінансів не створювала картку в Inbox.** Додано створення запису у `nm_inbox` (частково — див. B-71). |
| B-52 | 17.04.2026 (cnTkD) | **Категорії і підкатегорії у модалці однакові.** Розділено візуально: primary/secondary через padding, font-weight, border. |
| B-53 | 17.04.2026 (cnTkD) | **Список операцій без підкатегорії.** Додано рендер `t.subcategory` після категорії через `·` розділювач. |
| B-54 | 17.04.2026 (cnTkD) | **Свайп видалення операцій — переробка механіки.** Свайп >135px → зупинка на -80px + кнопка кошика. Винесено у `attachSwipeDelete` у 14zLe. |
| B-56 | 17.04.2026 (cnTkD) | **40 якісних SVG-іконок категорій** (було 21). Lucide/Heroicons stroke-based. |
| B-59 | 17.04.2026 (cnTkD) | **Модалка редагування категорії скролила на початок.** Збереження scrollTop+focus+selectionRange, точкові оновлення через `data-cat-color`/`data-cat-icon`. |
| B-60 | 17.04.2026 (cnTkD) | **Круг Hero — товстий donut chart з сегментами по категоріях.** SVG donut з `stroke-dasharray`, кольори з категорій. |
| B-62 | 17.04.2026 (cnTkD) | **Аналітика Фінансів — повний редизайн.** 3 режими графіка (Капітал/Витрати/Доходи), 9 метрик у 3 міні-блоках, 50/30/20 benchmark з кастомними %. |
| B-64 | 17.04.2026 (cnTkD) | **OWL Auto-silence надто агресивний.** Поріг 3→5, `MIN_VISIBLE_MS=10хв`. |
| B-68 | 16.04.2026 (W6MDn) | **Агент не бачив анкету налаштувань.** `getAIContext()` не читав `nm_settings.schedule`. Додано блок "Розклад дня (з налаштувань)" + `getSchedule()` повертає HH:MM рядки. |
| B-69 | 16.04.2026 (W6MDn) | **Застарілі повідомлення табло OWL зі вчора.** `clearStaleBoards()` перевіряє `toDateString()`, очищує кеш при зміні дати. |
| B-43+B-51 | 16.04.2026 (W6MDn) | **Модалка операції — біле тіло + неправильна padding-архітектура.** Переписано за DESIGN_SYSTEM: outer panel з `overflow:hidden` + padding horizontal only, scroll з padding vertical. |
| B-49 | 16.04.2026 (W6MDn) | **Модалка "Дата операції" — біле тіло.** Той самий glass-патерн як B-43 + `setupModalSwipeClose`. |
| B-55 | 16.04.2026 (W6MDn) | **Модалка редагування категорії — біле тіло.** Glass-патерн. Input'и отримали `rgba(255,255,255,0.7)` фон. |
| B-67 | 16.04.2026 (acZEu) | **Система автодіагностики — 4 фази за одну сесію.** `src/core/diagnostics.js`: Error Boundary + ring buffer, Health Check (9 перевірок), Smoke Tests (9 авто-тестів), Performance monitor. |
| B-42+B-63 | 16.04.2026 (acZEu) | **Один баг, не два.** У `generateBoardMessage()` `sc` без оголошення — ReferenceError. Прапорець `_boardGenerating[tab] = true` ніколи не скидався → табло застрягало. Фікс: `const sc = getSchedule()`. |
| B-32 | 16.04.2026 (3229b) | OWL галюцинував "€824 на їжу" при реальних €58. Маркери `[MONTH_EXPENSES:€X]`, `[TODAY_EXPENSES:0]` + міграція v3. |
| B-33 | 16.04.2026 (3229b) | Граматика заголовка "Редагувати витрата". Повністю переписана модалка — окремі шаблони expense/income. |
| B-34 | 16.04.2026 (3229b) | Немає вибору дати транзакції. Датапікер (Сьогодні/Вчора/Позавчора/Тиждень тому + date input). |
| B-35 | 16.04.2026 (3229b) | "Або своя категорія" input усередині блоку категорій. Прибрано, категорія передається з сітки. |
| B-36 | 16.04.2026 (3229b) | Кнопка 🗑 без підпису. "Видалити" з SVG-іконкою + текст. |
| B-37 | 16.04.2026 (3229b) | Транзакція не видалялась свайпом. Touch handlers на `.fin-tx-swipe-wrap`. |
| B-40 | 16.04.2026 (3229b) | Nav-чіп "Перевір фінанси" на вкладці Фінансів. `if (target === currentTab) return`. |
| B-41 | 16.04.2026 (3229b) | Smart fallback на Фінансах казав про звички. `_tryTabLocalFallback` з релевантним текстом по вкладках. |
| B-27 | 15.04.2026 (6v2eR) | Картка Здоров'я без блоків Фази 1. Стилізована модалка `health-card-modal` у 2 режимах (create/edit) + кнопка "Ред." у воркспейсі. |
| B-28 | 15.04.2026 (6v2eR) | Кнопка "Назад" у воркспейсі Здоров'я не реагувала. `renderHealthList` переписано на повну генерацію `#health-scroll.innerHTML`. |
| B-29 | 15.04.2026 (6v2eR) | Блок "Нотатки" у картці Здоров'я не відкривав папку. `openHealthNotesFolder` з `switchTab('notes')` + `setTimeout(openNotesFolder, 150)`. |
| B-30 | 15.04.2026 (6v2eR) | "+" у Здоров'ї відкривало системний `prompt()` браузера. Модалка з B-27 у create-режимі. |
| B-31 | 15.04.2026 (6v2eR) | Legacy шкали 1-10 (Енергія/Сон/Біль) всупереч новій концепції. Прибрано у 3 місцях. |
| B-26 | 15.04.2026 (jMR6m) | Pre-existing Inbox board layout проблеми: `#inbox-scroll` `margin-top:-10px` + `.owl-speech-chips mask-image` 14px. Прибрано overlap, зменшено маску до 4px. |
| B-25 | 09.04.2026 | Тап на подію в календарі не працював. Модалка редагування події у 3 місцях (список місяця, день, "Найближче"). |
| B-24 | 09.04.2026 | "Нагадай ввечері" створювало задачу замість нагадування. Правило "НАГАДАЙ = set_reminder" + маркери часу в Inbox/Notes/Health промптах. |
| B-23 | 09.04.2026 | Табло Inbox показувало fallback замість AI. Видалено `_isTooSimilar()`, виправлено граматику fallback, fallback не оновлює `nm_owl_board_ts`. |
| B-15 | 08.04.2026 | `setTimeout(100)` у `sendChipToChat` замінено на подвійний `requestAnimationFrame`. |
| B-22 | 07.04.2026 | AI плутав подію з задачею. `_detectEventFromTask()` — regex-детекція слів-маркерів + паттернів дат. |
| B-21 | 07.04.2026 | Табло маловаріативне. `_extractBannedWords()` + `_isTooSimilar()` (пізніше видалено у B-23). |
| B-20 | 07.04.2026 | Табло не реагувало на відповіді в чаті. Dispatch `nm-data-changed` з `'chat'` у `saveChatMsg()`. |
| B-09 | 06.04.2026 | Міні-календар прибрано. Повноцінна Calendar modal у Продуктивність з місячним виглядом, маркерами, dueDate/priority. |
| B-03 | 06.04.2026 | Верифікація: `create_project` работает. Не відтворюється. |
| B-04 | 06.04.2026 | Верифікація: календаря в `nav.js` немає. N/A. |
| B-05 | 06.04.2026 | Верифікація: `overflow-x:auto` є. Не відтворюється. |
| B-06 | 06.04.2026 | Верифікація: поле вводу Inbox працює коректно. |
| B-11 | 06.04.2026 | Верифікація: модалка звичок має правильний padding. Виправлено 31.03. |
| B-12 | 06.04.2026 | Верифікація: модалка задач аналогічно B-11. Виправлено 31.03. |
| B-19 | 06.04.2026 | Смайлик настрою не впливав на скор і OWL. Скор = чисто об'єктивний, настрій окремо у prompt. Динамічна формула, doneAt на кроках проектів. |
| B-18 | 06.04.2026 | Тап на момент не відкривав повний текст. Модалка `moment-view-modal` + `openMomentView()`. |
| B-17 | 06.04.2026 | Табло не оновлювалось миттєво. Event-система `nm-data-changed` — save-функції dispatch'ать, debounce-listeners тригерять через 3 сек. |
| B-16 | 06.04.2026 | Чіпи-привиди: ✔️-чіпи залишались після ручного закриття. `filterStaleChips()` з fuzzy match. |
| — | 05.04.2026 | Оновлення табло відкривало чат-бар. `add*BarMsg` guard `if (!_noSave)` у 5 файлах. |
| B-13 | 05.04.2026 | Апостроф у `onclick` чіпів ламав клік. `data-chip-text` + делегований click у `board.js`/`inbox-board.js`. |
| B-14 | 05.04.2026 | `includes()` у `navMap` false positives. Типізовані чіпи `{label, action:'nav'\|'chat', target?}`. |
| B-14 (старий) | 03.04.2026 | Task chat показував сирий JSON. Заборонено action-формат + fallback. |
| B-07 | 31.03.2026 | Свайп по кроках задачі ставив галочку. Тільки тап < 10px. |
| B-08 | 31.03.2026 | Зняття галочки з кроку не відновлювало картку. Виправлено. |
| B-10 | 31.03.2026 | При переході на Inbox чат відкривався на весь екран. Видалено авто-відкриття. |
| B-01 | 26.03.2026 | Undo нотатки повертала в кінець. Виправлено через predecessor ID. |
| B-02 | 26.03.2026 | `==` замість `===` при порівнянні habit_id. Виправлено. |
| — | 31.03.2026 | GitHub Pages не оновлювався — `GITHUB_TOKEN` блокує `deploy.yml`. Деплой у `auto-merge.yml`. |
| — | 25.03.2026 | SW кеш `nm-v1` ніколи не скидався. |
| — | 25.03.2026 | Мітка деплою в Inbox була захардкоджена. |
| — | 25.03.2026 | Quit-звички: один зрив обнуляв весь прогрес. |

> ⚠️ Примітка: старий `B-14` (Task chat JSON) і новий `B-14` (`includes()` в chips.js) — різні баги, той самий ID повторно використаний.

---

## 📋 Детальні описи закритих багів (історичні /gemini аудити)

> Зберігається як історія рішень — корисно якщо схожий баг повернеться або потрібен контекст.

### B-13 — Апостроф у `onclick` чіпів ламає клік

**Файл:** `src/owl/board.js:137-140` (і `src/owl/inbox-board.js`)
**Знайдено:** 2026-04-05, Gemini 3 Pro

У `renderTabBoard()` чіпи рендерились з інлайн `onclick` що містить текст чіпа:
```javascript
const s = escapeHtml(c).replace(/'/g, '&#39;');
return `<div class="owl-chip" onclick="owlChipToChat('${tab}','${s}')">${escapeHtml(c)}</div>`;
```

Спроба екранування апострофа через `&#39;` не працювала — HTML-парсер декодує entity назад у `'` ПЕРЕД тим як JS-парсер побачить атрибут. Ламало клік на українських словах з `'` (п'ять, м'ясо, сім'я, здоров'я).

**Рішення:** перенесено текст у `data-*` атрибути + один делегований обробник:
```javascript
chipsEl.addEventListener('click', (e) => {
  const chip = e.target.closest('.owl-chip');
  if (!chip) return;
  owlChipToChat(chip.dataset.chipTab, chip.dataset.chipText);
});
```

---

### B-14 — `includes()` в chips.js дає false positives

**Файл:** `src/owl/chips.js:26-33`

`owlChipToChat()` розрізняв навігаційні/текстові чіпи через `includes()`. Будь-який чіп що **містить** підрядок `"задач"` перекидав на вкладку замість чату ("обговорити задачі" — користувач очікував чат, отримував навігацію).

**Рішення:** типізація чіпів у відповіді AI: `{label, action:'nav'|'chat', target?}`. Оновлено промпти у `proactive.js`/`inbox-board.js`, рендер пише `data-chip-action`/`data-chip-target`, `chips.js` розгалужує по action.

---

### B-15 — `setTimeout(100)` у chips.js

**Файл:** `src/owl/chips.js:43-52`

Після `openChatBar(barTab)` відправка робилась через жорсткий `setTimeout(..., 100)` — магічне число без гарантій. На повільному iPhone могло не вистачити.

**Рішення:** замінено на подвійний `requestAnimationFrame()` — прив'язано до рендер-циклу браузера. Працює надійно на будь-якій швидкості пристрою.

---

### B-16 — Система чіпів порушена (концептуально + технічно)

**Файли:** `proactive.js`, `inbox-board.js`, `chips.js`, `inbox.js`

Головна проблема: чіпи = швидкі ВІДПОВІДІ юзера агенту. НЕ заклики до дії. AI не дотримувався. 5 підпроблем:

1. AI генерував чіпи-імперативи ("Купи продукти" замість "Купив продукти ✔️")
2. Клік на чіп викликав AI → AI робив дію (дублікат картки)
3. Чіпи-привиди після ручного закриття задачі
4. Орфографія AI ("постараю одяг")
5. `fromChip` працював тільки для Inbox

**Рішення:**
- Промпти переформульовано: чіпи = варіанти відповіді, не команди
- ✔️ чіпи обробляються ЛОКАЛЬНО через fuzzy match (перші 4 літери слова) + тост
- Чат-чіпи → `fromChip=true` для ВСІХ вкладок
- Навігаційні залишились `action='nav'`

---

### B-17 — Табло не оновлюється миттєво

**Файли:** `proactive.js`, `inbox-board.js`, всі `tabs/*.js`

Табло оновлювалось тільки за таймером (3 хв) і при переключенні вкладок. Юзер закрив задачу — табло мовчить 3 хв.

**Рішення:** event-система `nm-data-changed` з debounce 3 сек:
1. Save-функції dispatch'ать `window.dispatchEvent(new CustomEvent('nm-data-changed', { detail: 'тип' }))`
2. Listeners у `proactive.js`/`inbox-board.js` чекають 3 сек і генерують нове повідомлення
3. Debounce захищає від спаму

---

## 📋 wontfix / Галюцинації AI (архів)

### "Синтаксична помилка `<msg.id>`" у `board.js:125` (05.04.2026)

Gemini під час аудиту повідомив про "критичну синтаксичну помилку" у конструкції:
```javascript
const ago = Date.now() - (msg.ts || msg.id || Date.now());
```
Стверджуючи що там є `<msg.id>` з кутовими дужками. **Це галюцинація** — у реальному коді дужок немає.

**Урок:** завжди перевіряти точну цитату Gemini проти реального коду перед виправленням.
