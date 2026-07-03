# lessons.md — щоденник уроків Claude

> **Мета:** один файл де накопичуються уроки з помилок і повторні патерни роботи. Читати на старті кожної сесії — щоб не повторювати ті самі помилки.
>
> **Формат:** три секції. Пишуться Claude сам (з дозволу Романа "Роби" на оновлення файлу) після кожної значимої сесії.
>
> **Правило оновлення:** коли в сесії виявився новий патерн / помилка / рішення — записати сюди. Не ховати у SESSION_STATE.md (там короткостроковий журнал), не ховати у CHANGES.md (там факти змін коду).

---

## 🔄 Робочі патерни (коли X — роблю Y)

### Знайшов системний клас бага → ОДРАЗУ суцільний sweep всього src/ + сторож (v3pexs 27.06, дописано 03.07)

- **Контекст:** клас `\b`-кирилиця (JS-межа слова не працює з кирилицею) вкусив ДВІЧІ перш ніж зробили суцільний прохід: gfrvu5 23.06 (вартовий «момент» + push-замок) → v3pexs 27.06 (фільтр інструментів = 30-40% зайвих токенів тихо). Кожен раз фіксили знайдену точку, а не КЛАС.
- **Урок:** другий укус того ж класу = сигнал що точкові фікси не працюють. Одразу: (а) grep всього `src/` на патерн класу, (б) оцінити КОЖЕН матч, (в) написати сторож у `scripts/check-*.js` щоб рецидив падав на push, (г) зафіксувати «клас закрито» тут — щоб наступний чат не перевідкривав.
- **✅ КЛАС `\b`-КИРИЛИЦЯ ЗАКРИТО 27.06.2026 (v3pexs):** суцільний grep `src/` зроблено — живих точок нуль (деталі у SESSION_STATE «ДЛЯ НОВОГО ЧАТУ»). Сторож `check-cyrillic-boundary.js` стереже весь src/ на кожен push + CI. НЕ перевідкривати.

### Нотатки «лишилось зробити» ДРЕЙФУЮТЬ — верифікуй проти коду ПЕРЕД кодом (foyz2r 17.06.2026)

- **Контекст:** Роман дав «зроби Supabase Фазу 1 по пріоритетах». SESSION_STATE «⚠️ ДЛЯ НОВОГО ЧАТУ» казав «проекти — 2 точки створення БЕЗ фабрики → makeProject». Спокуса: одразу писати `makeProject`.
- **Що сталось:** Council-інвентар + моя перевірка коду → `makeProject`+`stampEntity` **уже існує** і вже у ОБОХ точках створення (закрила qpzj7k 13.06). Нотатка писалась раніше (7uxlr7) і застаріла на одну сесію. Якби кодив наосліп — переробляв би готове.
- **Корінь:** секція «ДЛЯ НОВОГО ЧАТУ» оновлюється рідше ніж робиться робота → відстає. «✅ закрито» в одній сесії не завжди стирає «⏳ лишилось» у forward-нотатці.
- **Урок:** forward-нотатки (ROADMAP active, «ДЛЯ НОВОГО ЧАТУ», TODO) — це ГІПОТЕЗА стану, не факт. Перед першим Edit за такою нотаткою — grep/read реального коду у вказаній точці. Той самий принцип що «гіпотеза агента ≠ факт», але для власних старих нотаток. + на `/finish` стирати закриті пункти з forward-секції, не лише додавати.

### Баг від агента може бути РЕАЛЬНИЙ структурно, але ПОРОЖНІЙ у даних — перевір таймлайн (foyz2r 17.06.2026)

- **Контекст:** Red-Team агент знайшов «критичну дірку»: міграція v14 (project.id число→UUID) не оновила `nm_finance[].projectId` → бюджет проектів обнулиться (`tx.projectId === p.id` ніколи не матчить). Структурно — правда (v14 справді не чіпає finance).
- **Перевірка перед фіксом:** грепнув УСІ записи projectId → пишеться лише в одному місці, завжди з AI (UUID). А прив'язка фінанс↔проект зʼявилась 13.06 (qpzj7k) — ПІСЛЯ міграції v14 (11.05). Тобто числових projectId у даних **ніколи не виникало**. Дірка теоретична, порожня.
- **Урок:** коли агент каже «міграція X не оновила Y → зламається» — перевір не лише СТРУКТУРУ коду, а ТАЙМЛАЙН даних: чи існував взагалі шлях що створив «погані» дані? Фіча що споживає поле могла зʼявитись ПІСЛЯ міграції → поганих даних нема. Писати міграцію під неіснуючі дані = лоскут (Inversion: «які дані реально existують?»).

### E2E у CI: браузери не качаються локально — ітеруй через CI-логи, селектори верифікуй проти DOM (foyz2r 16.06.2026)

- **Контекст:** новий Playwright-тестер. Мережа середовища блокує `cdn.playwright.dev` → `npx playwright install` падає 403 → локально тести не запустити.
- **Патерн:** локально лише `npx playwright test --list` (парс + конфіг) + `node --check`. Реальний прогін — у CI; читаю падіння через `mcp__github__get_job_logs` (failed_only) і правлю ітеративно (3 раунди: lock → дубль data-tab → slides-tour overlay).
- **Селектори наосліп = червоне CI:** `[data-tab]` чіпляло приховану кнопку допомоги (дубль атрибута) + нижня навігація це рухомий «барабан» (далекі вкладки приховані) → клік падав. Рішення: переходити вкладку через `window.switchTab()`, не клік. На чистому boot вилазить `#slides-tour` (вітальний оверлей) і ловить кліки → boot() гасить його (прапор `nm_onboarding_done` + захисне приховування).
- **Урок:** для headless-тестів верифікуй реальний DOM (grep index.html на дубль-атрибути, динамічні оверлеї, рухомі компоненти) ПЕРЕД написанням селектора. Детерміновані `window.*` функції стабільніші за кліки по складному UI.

- **Контекст:** B-192 — симптом «`createFullBackupUI` створює знімок, але за ~0.8с зникає» (Ug2Jw). Гіпотеза: async setTimeout у NM scheduler TTL-чистить backup. Спокуса: запустити Council, взяти топ-гіпотезу, запатчити `backup.js`/`boot.js`.
- **Council 3 паралельних агентів Sonnet (точки видалення / async scheduler / pre-mortem)** прочитали весь код → **0 реальних знахідок**. Кожен дав гіпотезу (cleanupOldBackups лексикографічна race, runMigrations v17 повторний backup) — але всі вимагали повторного boot якого у сценарії немає. Голова верифікувала кожну проти реального коду (правило «гіпотеза агента ≠ факт») → жодна не трималась.
- **Замість патчу на гіпотезах — runtime-датчик:** переписав test_4 з (а) monkey-patch на `localStorage.removeItem/setItem` для `nm_backup_*` з `performance.now()` + stack trace до 2000 chars; (б) polling кожні 100мс протягом 1100мс. Якби видалення було реальним — `rm_log` зловив би його зі stack trace винної функції.
- **Результат:** on-demand trigger × 3 поспіль (14:03/04/05) → **усі PASS**. Backup живий усі 1100мс, `rm_log` порожній. **Баг — у ВИМIРI старого тесту** (окремі CDP `Runtime.evaluate` з `wait(0.8)` між ними → таймінг/race давав хибний 0), НЕ у застосунку.
- **Урок:** коли симптом — «щось зникає / видаляється само / async» і статичний аналіз (навіть 3 агентів) не знаходить винного — НЕ патч прод-код на гіпотезах. Встав runtime-датчик (monkey-patch операції + polling) і ДОВЕДИ що подія реальна + отримай stack trace. Дешевше за хибний патч який «лагодить» неіснуючу проблему і маскує реальну причину (артефакт інструменту виміру).
- **Бонус-урок (вимір через окремі виклики):** коли тест міряє стан ДО і ПIСЛЯ дії через ОКРЕМI ізольовані виклики (CDP evaluate, окремі HTTP, окремі subprocess) — таймінг між ними + race можуть дати хибний результат. Для перевірки «значення стабільне у часі» — міряй у ТОМУ Ж контексті через polling (setTimeout-ladder + читання масиву), не через серію зовнішніх викликів.
- **Інфра-фікс по дорозі:** on-demand `TARGET_SCENARIOS` тепер BYPASS'ить `disabled_scenarios` у `ai-tester.py` — призначення прицільного trigger'у власне debug disabled-тестів, інакше Roman мусив би Edit config перед кожним циклом (накопичення регресій — забути повернути).

### AI-Tester може ловити production bugs АВТОНОМНО — додавати тести агресивно (Ug2Jw 21.05.2026)

- **Контекст:** під час сесії Ug2Jw написав `test_19_habits_add` (Tasks tab → switch-prod-tab=habits → ➕ → fill habit-input-name → Save). Тест запустився, фейл: `HABIT_MODAL_NOT_OPEN`. Я перевірив код → `openAddHabit` визначений у `habits.js:217` АЛЕ НЕ був у `Object.assign(window, {...})` (habits.js:1942). Delegation `call` handler перевіряє `typeof window[fn]==='function'` → false → silent skip → юзер тапає Habits ➕ → нічого не відбувається. **Це B-193 — реальний production bug який міг непоміченим жити тижнями.**
- **ПЕРШИЙ ВИПАДОК автономного discovery:** AI-Tester виявив production bug САМ, без Pre-mortem/Council/silent-bug-scout/Roman'ового feedback. Тестер просто пробігав сценарій по UI → побачив що щось не працює → fail_reason підказав вектор → grep window.openAddHabit → undefined → root cause.
- **Цінність інфраструктури підтверджена:** інвестиція ~50 хв у написання 13 нових тестів дала: 16 stable PASS baseline + 1 виявлений real bug. ROI безперечний.
- **Правило:** додавати тести АГРЕСИВНО, не консервативно. Кожен новий UI element заслуговує тесту (CLAUDE.md правило 13). Чим більше тестів — тим більший шанс автономного discovery наступного latent bug.
- **Council deep-dive аудит (Ug2Jw post-write):** перевірив систематично — чи нема ще missing window exports такого ж класу. Sonnet агент scanned всі 99 `data-fn` handler імен → grep кожного `Object.assign(window,...)` або `window.X = fn` → 0 missing. B-193 був ЄДИНИМ пропущеним. Решта 98 handlers — covered. Системна якість делегації після OBErR Phase 0-6 — висока.
- **Сигнал додавати тест:** додав/змінив у сесії: (а) кнопку `data-action`, (б) модалку `id="*-modal"`, (в) поле `id`, (г) swipe-handler, (д) вкладку → ПЕРЕД `/finish` пишу тест (CLAUDE.md правило 13).

### Pre-mortem ПЕРЕД першим Edit на видимий баг — ловить латентні дірки в тій же функції (Ug2Jw 20.05.2026)

- **Контекст:** При /start побачив у `tester-status.json` traceback: `NameError: name 'take_screenshot' is not defined. Did you mean: 'capture_screenshot'?`. Видимий корінь — 1 typo. Спокуса: Edit рядка 172, commit, готово.
- **Замість цього — Pre-mortem (CLAUDE.md mental model #1):** «Якщо typo фікс не запрацює, ЧОМУ?». Питання задане ДО першого Edit.
- **Знайшов 2 додаткові латентні дірки у тій же 14-рядковій функції `screenshot()`:**
  1. **Path repr** — `path!r` = `PosixPath('...')` Python літерал, вимагає `pathlib` у `globals()` browser-harness (там нема). Після typo-фіксу впав би на наступному cron-run з `NameError: PosixPath`. Замінено на `str(path)!r`.
  2. **Missing stdout** — `capture_screenshot()` нічого не друкує, а `bh()` raise'ить `RuntimeError("bh returned empty output")` коли stdout порожній (рядок 150). Підтверджено патерн: ВСI 10 тестових сценаріїв закінчуються `print(_json.dumps(...))`. Додано `print(_json.dumps({}))` після виклику.
- **Симптом який маскував:** PythonClient повідомив тільки про typo (бо `NameError` падає на lookup до evaluation arguments). Path repr і empty stdout були **повністю невидимі** у traceback — стали б видимими ТIЛЬКИ після typo-фіксу.
- **Без Pre-mortem розклад би був:** Edit #1 typo → push → cron 8 год чекати → fail Path → Edit #2 → push → cron → fail empty output → Edit #3 → 24+ год debug на те що зайняло 10 хв самотестування Pre-mortem'ом.
- **Підтверджений кейс Ug2Jw (`e993aa7`):** один commit, 3 латентні дірки закриті разом, syntax-check pass. Debug test_3/test_4 (HKnlM хвости) розблоковано.
- **Сигнал застосовувати:** видимий typo / NameError / single-line bug у файлі який має >1 виклик схожого API → Pre-mortem питання «якщо #1 фікс не запрацює, ЧОМУ?» ДО першого Edit. Особливо в обгортках над зовнішнім API (browser-harness, OpenAI SDK, fetch wrappers) — там 1 typo часто = system mismatch з API.

### subprocess.run з input/text=True — ОБОВ'ЯЗКОВО `encoding='utf-8'` (HKnlM 20.05.2026)

- **Контекст:** AI-Tester на Hetzner викликає browser-harness через `subprocess.run([BH_BIN], input=code, text=True)`. На Mac/desktop locale = UTF-8 → працює. На сервері у cron env locale може бути POSIX/C/ASCII → cyrillic символи у payload → `?` substitution → SyntaxError на стороні daemon.
- **Симптом:** manual heredoc через `sudo -u nmtester /path/to/cli <<'PY' ... PY` працює (bash передає raw UTF-8 bytes), але точно той самий payload через subprocess з `text=True` падає з обрізаним trace.
- **Правило:** при будь-якому `subprocess.run/Popen` з `input=str` АБО `text=True` — додавати explicit `encoding="utf-8"`. Не покладатись на locale.
- **Підтверджений кейс HKnlM (`6bd1f06`):** ai-tester.py 5 тестів fail з `File "<string>", line 3, in <module>` (обрізана помилка). Manual heredoc — works. Виправлено: `text=True` → `encoding="utf-8"`. Одразу 3/5 pass.
- **Сигнал:** будь-який subprocess з cyrillic/emoji у payload → перевір encoding ПЕРЕД деплоєм.

### uv venv без `--seed` = bare `pip` не існує — використовуй `uv pip install` (HKnlM 20.05.2026)

- **Контекст:** `uv venv $HOME/.venv` створює мінімальний venv БЕЗ pip/setuptools/wheel за замовч (з 2024). Це раніше було `--seed` поведінкою, тепер opt-in.
- **БАГ:** `$HOME/.venv/bin/pip install anthropic` → `No such file or directory`.
- **Правило:** після `uv venv` ставити пакети через `uv pip install --python $VENV/bin/python pkg`. Не використовувати bare pip. Якщо потрібен pip — додавати `--seed` до `uv venv`.
- **Підтверджений кейс HKnlM (`65f4543`):** hetzner-setup.sh `[3/8]` крок впав → mid-setup. Виправлено за 5 хв, але втрачено час на діагностику. Тепер `hetzner-setup.sh` ідемпотентний (`uv venv --clear` + `uv pip`).

### Verify реальний API перед написанням скриптів — НЕ покладатись на «має бути» (HKnlM 20.05.2026)

- **Контекст:** Я писав ai-tester.py під Playwright-like API (`navigate()`, `query_selector()`, `get_console_errors()`, `eval_js()`, `type_into()`, `wait(ms)`) — але browser-harness 0.1.0 має зовсім інший набір: `goto_url()`, `js()`, `fill_input()`, `click_at_xy()`, `wait(seconds)`, `cdp()`. Жодна з моїх функцій не існувала.
- **БАГ:** 10 з 10 сценаріїв fail з `NameError: navigate is not defined` (обрізано до line 3).
- **Правило:** при інтеграції з third-party CLI/library ОБОВ'ЯЗКОВО `grep "^def " <library>/helpers.py` або `<cli> --help` ПЕРЕД написанням клієнтського коду. Не довіряти пам'яті/інтуїції про "схожі API".
- **Підтверджений кейс HKnlM (`e905959`+`725ec10`):** перепис 10 сценаріїв + PAYLOAD_PRELUDE з helpers (`click_sel`/`get_ls`/`wait_for_js_expr`) + SYSTEM_PROMPT. Це той самий клас бага що 64CXo промпт-лоскути без перевірки реальних даних. **Правильний flow:** Read API → Council Implementer-агент верифікує селектори → потім write код.

### Pre-mortem перед production-deploy критичної інфраструктури (HKnlM 20.05.2026)

- **Контекст:** AI-Tester мав бігати автономно 24/7. Без Pre-mortem я б закрив сесію на 3/5 pass з ілюзією успіху. Pre-mortem агент Sonnet знайшов 3 КРИТИЧНI bugs які б ховались тижнями:
  1. test_9 false-PASS — після першого пасу старі дані тривіально match → AI ніколи не викликається. B-180 регресія була б «зеленою» 89 днів.
  2. max_tests_per_run=5 → test_6-10 (саме AI регресії B-180/B-115) ніколи не виконуються. Тестер на половину сліпий.
  3. localStorage growth — test_3 додає задачу без cleanup → 3×30 = 90 за місяць → 5MB cap → false PERSISTENCE_FAIL на 3-4 тиждень.
- **Правило:** перед deploy будь-якої autonomous системи (тестер, cron, watchdog, daemon) — запустити Pre-mortem-агента Sonnet з промптом «уяви через 7 днів автономної роботи мертва — чому?». Це не theoretical exercise — це rotina checkpoint.
- **Підтверджений кейс HKnlM:** Council 4 паралельні агенти знайшли 13 проблем (3 critical security + 3 critical correctness + 3 robustness + 4 doc-sync). Без Council — я б deployed з 5 серйозними дірками.

### Council read-only audit ПIСЛЯ свого setup-скрипта — обов'язковий крок (HKnlM 20.05.2026)

- **Контекст:** Я писав `hetzner-setup.sh` + `ai-tester.py` без security review. Council `silent-bug-scout` Sonnet знайшов 3 security діри:
  1. Heredoc'и БЕЗ лапок (`<<INNER`) — shell injection якщо ключ містить `` ` ``/`$()`.
  2. `git stderr` з PAT у `tester-log.md` БЕЗ маскування.
  3. `cron.log` без `chmod 600`.
- **Правило:** при роботі з secrets/credentials/PATs — після написання скрипту запустити `silent-bug-scout` агента ОБОВ'ЯЗКОВО з security focus. Перевірити: shell heredoc'и (лапки!), log writes (mask!), file perms (chmod 600!).
- **Підтверджений кейс HKnlM (`c3cbdfa`):** виправлено 3 діри одним commit ПЕРЕД production traffic. Якби deploy відбувся — security incident міг статись на першому ключі з spec char.

### escapeJsArg ≠ escapeHtml для `data-*` атрибутів (JMQuT 17.05.2026)

- **Контекст:** `escapeJsArg(s)` додає JS-escape (`\\`, `\'`, `\"`) для безпечного вкладення у `onclick="fn('${...}')"`. Браузер парсить HTML attr → JS string → обидва рівні відновлюються.
- **БАГ для `data-*`:** значення `data-folder="${escapeJsArg(folder)}"` зберігає `\\'` як ЛІТЕРАЛЬНИЙ backslash. При читанні `el.dataset.folder` НЕ виконує JS-eval → залишається `Roman\'s folder` замість `Roman's folder` → `openNotesFolder()` шукає неіснуючу папку → silent fail.
- **Правило:** для `data-*` атрибутів використовувати `escapeHtml()` (тільки HTML-escape `&<>`). Браузер декодує HTML entities при читанні dataset → отримуємо оригінал.
- **Підтверджений кейс JMQuT:** Pre-mortem Council Sonnet знайшов баг ПЕРЕД деплоєм при міграції notes.js на delegation. 4 точки виправлено: `safeFolder` → `escapeHtml(folder)`. Той самий патерн застосовано у health.js (`data-time` через `escapeHtml`).
- **Сигнал для майбутніх міграцій:** коли міграруєш `onclick="fn('${escapeJsArg(x)}')"` → `data-action="X" data-x="${...}"` — ОБОВ'ЯЗКОВО замінити `escapeJsArg` на `escapeHtml`. Інакше silent fail на даних з апострофами / лапками / backslash.
- **🔁 РЕЦИДИВ vdlyeg 10.06 (B-197):** JMQuT нібито виправив «4 точки», але `notes.js:458/530` (`data-folder` на `.folder-item-wrap` — зовнішня обгортка свайпу) лишились на `escapeJsArg` → папка з апострофом не видалялась свайпом. **3-й раз поспіль** цей самий клас у notes.js (раніше :186 stored XSS, :355). **Урок про урок:** коли фіксиш escape-клас — НЕ «4 точки», а `grep -n "escapeJsArg" file.js` і ВСI до нуля за раз + перевір що кожна нова data-* точка йде через escapeHtml. Не «знайшов візуально декілька». Системний фікс vdlyeg: прибрав escapeJsArg з import notes.js взагалі → нова поява = одразу видно.

### escapeHtml МУСИТЬ екранувати лапки — XSS через розрив атрибута (vdlyeg 10.06.2026)

- **Контекст:** `escapeHtml` екранував лише `& < >`, НЕ лапки. У ~25 місцях значення йшло в HTML-атрибут: `data-x="${escapeHtml(v)}"`, `value="${escapeHtml(v)}"`, `title="${escapeHtml(v)}"`.
- **БАГ (XSS-клас):** значення з подвійною лапкою розривало атрибут → можна підставити обробник події: `v = 'a" onmouseover="alert(1)'` → `<div data-x="a" onmouseover="alert(1)">`. Виконання коду в DOM. Сьогодні self-XSS (один юзер) / AI-indirect, але stored-XSS після Supabase (чужі дані).
- **Фікс:** escapeHtml тепер екранує і `"`→`&quot;`, `'`→`&#39;`. Один корінь → всі 25 місць. Безпечно: у body сутності рендеряться як лапки; в атрибутах браузер декодує назад при читанні dataset (round-trip цілий — підтверджено Council 3 агенти + 8/8 unit).
- **Тех-нюанс:** regex лапок через `String.fromCharCode(34/39)` у module-константах — (а) не конструювати regex на кожен виклик гарячої функції, (б) без літеральних лапок у коді (вони плутали i18n-детектор парності → той рахував коментарі як необгорнуті рядки).
- **Правило:** HTML-escaper для одного юзера = недостатньо «& < >». Завжди й лапки. `escapeHtml` тепер безпечний для body І attr контексту; `escapeJsArg` — окремо тільки для JS-рядка в `onclick`.

### safeHref — escapeHtml НЕ блокує javascript: у посиланнях (vdlyeg 10.06.2026)

- **Контекст:** `<a href="${escapeHtml(url)}">` з URL від юзера/AI (ресурс проекту). escapeHtml екранує символи, але НЕ перевіряє СХЕМУ.
- **БАГ:** `url = 'javascript:alert(document.cookie)'` проходить escapeHtml без змін → клік виконує JS (XSS). `data:`/`vbscript:` так само.
- **Фікс:** `safeHref(url)` у utils.js — повертає URL лише зі схемою http/https/mailto/tel (або відносний/anchor), інакше null (посилання не рендеримо). Контрольні символи стрипаються ПЕРЕД перевіркою (`java\tscript:` — браузер ігнорує таб у схемі → обхід наївного regex). + `rel=noopener` проти tabnabbing.
- **Правило:** будь-який `href`/`src` з URL від юзера/AI → через safeHref, не лише escapeHtml. escapeHtml ≠ валідація схеми.

### CI: ніколи не інтерполювати github-контекст прямо у run: shell (vdlyeg 10.06.2026)

- **Контекст:** `git merge ${{ github.ref_name }}` прямо у `run:` крок GitHub Actions.
- **БАГ (command injection):** назва гілки може містити shell-метасимволи (`$(...)`, backtick, `;`). При інтерполяції у shell вони виконаються у runner з `contents:write`. Те саме для `${{ inputs.* }}` з workflow_dispatch (вільний текст).
- **Фікс:** виносити у `env:` блок кроку, у shell брати як `"$REF_NAME"` у лапках. GitHub-контрольовані скаляри (`github.sha`, `github.event_name` — hex/enum) безпечні, але звичка має бути одна.
- **Правило:** будь-який `${{ }}` що йде у `run:` shell і НЕ є фіксованим enum/hex → через env + лапки. Це документований GitHub hardening-патерн.


### Council 5 агентів — НЕ після 5-ї невдачі а після 2-ї (MPVly-day2 06.05)
- **Якщо 2 спроби фіксити одне і те ж не дають результату** → STOP + Council 5 паралельних агентів Sonnet (Critic / Стратег / Свіжий погляд / iOS quirk hunter / Виконавець). Кожен читає код самостійно через Read/Grep.
- **Антипатерн:** `git log` MPVly-day2 — B-138/B-139/B-140/B-141/B-141 hot/B-142 — **6 фіксів-наосліп** для «кнопки Аналітики не клікаються». 5 з них були помилковими (CSS scale, dy>8 поріг, backdrop class, refactor, removeWatcher). REAL корінь B-143 — `scrollEl=null` через нормалізацію inline style браузером — Council Виконавець знайшов через diagnostic logging за 1 раунд. **Втратив ~2 години на наосліп до того.**
- **Сигнал від Романа:** «А чо ти взагалі фіксиш на осліп? Там є правило» — це жорсткий тригер. Запускати Council одразу.
- **Diagnostic logging замість фіксу-наосліп** — додай `logError('log', '[ctx] X', 'file')` у точках де думаєш проблема. Юзер передає скрін Лога помилок → бачимо точно ДЕ fail. 1 коміт = годинна економія.
- **Після великого рефакторингу промптів/архітектури — Council 3 агенти ОБОВ'ЯЗКОВО на регресії** (LfA6w 08.05). Не покладайся на власний самотест — пропускає те що сам же зламав. Підтверджений кейс LfA6w: переписав 5 файлів промптів за `decision-tree`-стилем → вважав ОК → запустив 3 паралельні агенти (silent-bug-scout + prompt-engineer-auditor + code-regression-finder) і знайшов **6 регресій від свіжих фіксів:** (1) `tool-dispatcher.js:80` забув `subcategory` у dispatch → працювало через Inbox але не через 7 tab-чатів; (2) `finance-chat.js:105` будував `txSummary` без `[ID:N]` + дублював `getFinanceContext` → AI не міг update_transaction → робив дублі; (3) `CHIP_PROMPT_RULES` забруднював JSON-аналітику me.js (інжект через `getOWLPersonality`); (4) Brain Pulse + Followups debounce reset на КОЖНОМУ chat-event; (5,6) tab-чати без CHIP_PROMPT_RULES + inbox.js code-guard dedupe. **Зловити це самотестом неможливо** — мозок Голови після 8 годин рефакторингу втрачає холодну перспективу. **Тригер:** будь-який рефакторинг що зачіпає 3+ файли або 50+ рядків у `prompts.js` / `core/*` / dispatcher → одразу Council 3 агенти. Sonnet model для економії токенів.

### Проактивне використання silent-bug-scout (MPVly-day2 06.05)
- **Перед великою i18n-сесією або деплоєм** → запустив `silent-bug-scout` агента **ДО** /audit. Він знайшов 5 латентних багів — 4 виправлено за одну сесію (B-128 drum-col mask-image у backdrop-filter, B-129 set_reminder без t(), B-130 reminder cross-tab DETAIL_TO_KEY, B-131 sendClarifyText без aiLoading guard). Це той самий клас бага що Settings UvEHE 03.05 — знайдено за 6 хв перед тим як Роман натрапив. **Урок:** silent-bug-scout — не «коли Роман попросить», а «перед кожною масштабною сесією як профілактика».
- **i18n-finder + silent-bug-scout у one-shot паралельно** — обидва read-only, обидва за 5-7 хв генерують готові патчі. Голова синтезує і робить Edit. Дуже економно у токенах vs Голова сам шукає 30 хв.

### При старті сесії
- **На `/start`** — читаю 7 обов'язкових файлів зі `START_HERE.md`. Потім дивлюсь на `git log -5` і `git branch --show-current`. Формую зріз статусу: версія / гілка / критичний баг / варіанти дій. Чекаю "Роби".
- **При складному питанні після /start** — перед відповіддю вирішую чи треба поглибитись. Якщо так — відкриваю `_ai-tools/INDEX.md` → цілюся у потрібний файл+розділ через Read з `offset`+`limit`. Не читаю весь файл.

### Перед написанням коду
- **UI-задача** → читаю `docs/DESIGN_SYSTEM.md` секцію модалок/кольорів → пропоную ескіз/макет Роману словами (описую **вигляд**, не HEX-коди) → чекаю підтвердження → тільки тоді код. Скіл `/mockup` або `/ux-ui` допомагає.
- **Промптинг OWL** → `/prompt-engineer` → правлю `src/ai/prompts.js` (не `core.js`) → тестую на конкретному юзерському прикладі.
- **iOS-специфічний баг** → `/pwa-ios-fix` чеклист (bfcache, SW, keyboard, overscroll) → читаю відповідну секцію `src/core/boot.js setupSW()`.
- **iOS Safari ВІЗУАЛЬНИЙ баг** (модалка глючить / стискається / мерехтить / обрізається / реагує на тап) → ПЕРШИМ ділом 3 grep-перевірки (детальний чек у `_ai-tools/RULES_UI.md` секція 5), ТІЛЬКИ ПОТІМ CSS-патчі: (1) `grep ":active\|:focus\|:hover" style.css` на universal selectors, (2) `grep "backdrop-filter" style.css` + перевірка чи symptomний елемент має parent з blur, (3) перевірка composite layers / parent transform. 30 секунд замість 4 ітерацій false leads (доведено UvEHE 03.05 — Settings + Chips, по 4 ітерації кожен).

### Великі файли / багатофазна робота
- **Файл >250 рядків** → Write skeleton (~20-30 рядків з плейсхолдерами) → по одному Edit замінює плейсхолдер реалізацією → після всіх Edit — `node build.js` перевірка.
- **Багатофазна робота** → Checkpoint-коміт після КОЖНОЇ завершеної фази, не чекати кінця. Префікс `refactor(phase-N):` або `fix(part-N):`.
- **Великий Write ризикує обривом** → розбий на skeleton+Edit. Один `Write` 400+ рядків часто падає, 50-100 рядкові `Edit` майже завжди проходять.
- **Тригер розбиття існуючого великого файлу = наступна змістовна задача в ньому** (не календарна дата, не «коли дозріє у ROADMAP»). Як з `finance.js` у gHCOh 17.04: був 1300 рядків, прийшла задача → **спочатку розбили на 6 модулів, потім зробили задачу**. Поточні кандидати станом на hEtjy 27.04: `src/tabs/habits.js` (1537 рядків), `style.css` (1654 рядків). Не вносити у ROADMAP окремим пунктом — створює штучний обовʼязок. Натомість: коли наступна задача торкнеться habits.js / великий CSS-блок — підготовча фаза = розбити, потім фіча.

### UUID-міграція ID-формату — ОБОВ'ЯЗКОВИЙ 3-grep чек-ліст (db0YY 12.05.2026)
- **Кейс:** myshu (11.05) пройшла 7 boot-міграцій v9-v15 для готових даних у localStorage, але забула 2 класи бага у JS-коді → користувач отримав v841 з 26 поломками (18 onclick + 8 create-points). Я знайшов через Council Свіжий погляд + ширший grep.
- **Клас 1 — onclick без лапок:** 17 точок типу `onclick="fn(${item.id})"` де `item.id` тепер UUID-string з дефісами → парсер бачить `fn(550e8400-e29b-...)` як вираз → `ReferenceError` → юзер тапає, нічого не відбувається. Той самий клас що B-108 (xGe1H 27.04 для tasks). Регресія у 6 файлах: inbox/evening/notes/projects/calendar/finance.
- **Клас 2 — Date.now() ID при створенні через AI/handler:** 8 точок типу `evening-actions.js:106 { id: Date.now() }` для save_task/save_habit/save_finance/inbox-card. Мігровані старі дані = UUID, нові від AI = number → мікс типів у одному масиві → `find(x => x.id === id)` повертає false → silent fail свайп-видалення/undo.
- **ОБОВ'ЯЗКОВИЙ 4-grep чек-ліст ПIСЛЯ кожної UUID-міграції (як для Health 3B-8 + db0YY B-172 урок):**
  ```bash
  # 1. onclick без лапок (Class 1, B-170)
  grep -rnE 'onclick="[a-zA-Z_]+\([^)]*\$\{[^}]*\.id[^}]*\}' src/ --include="*.js" | grep -v "'\\\${"
  # 2. parseInt/Number на dataset.id (UUID → NaN) — Class 1
  grep -rnE '(parseInt|Number)\([^)]*(\.dataset|\.id\b)' src/ --include="*.js"
  # 3. id: Date.now() ВСI top-level entity creation (Class 2, B-171)
  grep -rnE '\bid:\s*Date\.now\(\)\s*[,}]' src/ --include="*.js" | grep -v generateUUID
  # 4. tool schema {X_id: integer} у prompts.js (Class 3, B-172 — НАЙКРИТИЧНІШИЙ)
  grep -nE '[a-z_]*id[a-z_]*:\s*\{\s*type:\s*"integer"' src/ai/prompts.js
  # 5. AI prompts EXAMPLES з числовими ID (Class 4, B-173) — AI плутає
  grep -nE '\[ID:[0-9]+\]|[a-z_]+_id:\s*[0-9]+' src/ai/prompts.js | grep -v "type:"
  # 6. Інконсистентні ID-префікси у контексті (medID vs ID) — Class 4
  grep -rnE '\[(med|task|event|note|card|allergy|habit|project|step)ID:' src/ --include="*.js"
  ```
- **🚨 B-172 урок: OpenAI Strict mode + UUID → schema integer ламає AI-виклики silent.** Знайдено db0YY коли планував Health undo reverser — `card_id: integer` у delete_health_card schema. Юзер казав «видали картку» — AI міг просто не виконати (Strict валідація провалювалась, fallback мовчав). Це найкритичніший клас бага бо невидимий — нема ErrorMessage у консолі, AI просто пропускає виклик. Завжди при UUID-міграції оновлювати prompts.js schemas СИНХРОННО.
- **Обгортати онклик у одинарні лапки** — `onclick="fn('${item.id}')"`. UUID не містить `'` чи `"` (тільки `[0-9a-f-]+`) — безпечно.
- **String() обгортка у find/filter** — якщо хендлер працює з мікс типами, використовуй `find(x => String(x.id) === String(id))` (приклад: inbox.js:340, notes.js:596, projects.js:187, habits.js:925). Strict `===` між number і string завжди false.
- **Tasks/Projects steps + Health 3B-8 — ЗАКРИТО db0YY** — sub-entity steps мігровано на UUID (v17), Health UUID v16, 4-grep чек-ліст пройдено.
- **`delete_medication` undo circle — ЗАКРИТО nliW8 13.05** (`7edfa37` + `91c7b67`) — повний 7-точковий патерн для будь-якого нового create-tool: (1) tool def у prompts.js + (2) handler у tool-dispatcher + (3) case у processUniversalAction для DI flow + (4) reverser у action-reversers + (5) delete-функція у tab.js + (6) case у restoreFromTrash + (7) normalizeAction у inbox.js. Без ВСIХ 7 — silent fail на якомусь шарі.

### DRY уніфікація 3 handler'ів через DI (Phase 2 nliW8 13.05.2026)

- **Тригер:** Roman прямо сказав «це латка чи системне рішення?» коли я додавав chip-діалог тільки у Inbox-handler. Council DRY-finder показав 3 окремих handler'и save_finance з активними розбіжностями.
- **Корінь:** save_finance мав 3 dispatch-шляхи (Inbox direct → processFinanceAction; 6 tab-чатів через tool-dispatcher → processUniversalAction; Evening через dispatchEveningTool). Кожен мав власну копію логіки category/subcategory matching → різна поведінка («Інше» fallback у Inbox, auto-create вигаданих категорій у habits, тощо).
- **Рішення — `processFinanceAction(parsed, text, addMsgFn = addInboxChatMsg)`** з 3-м параметром DI. Default — backward-compat для Inbox. 7 non-Inbox чатів передають свій addMsg → 1 функція обслуговує 8 чатів. Дубль у habits.js (50 рядків) видалений → виклик уніфікованої. Те саме для evening-actions + finance-chat дубль checkFinBudgetWarning.
- **Pure module у `src/data/finance-classifier.js`** — класифікаційна логіка (category match, subcategory match, date resolve) винесена як pure functions для Supabase Edge Function (правило 12 CLAUDE.md).
- **Чек-ліст «коли торкаюсь Save-handler»:** ВСI dispatch-шляхи цього tool використовують ОДНУ функцію? Якщо ні — це копіпаст. Через DI addMsgFn можна параметризувати UI-частину без втрати DOM.

### addMsgForTab — централізований cross-chat write (B-178 nliW8 13.05.2026)

- **Тригер:** B-178 cross-chat interview handoff — AI у Inbox писав у Health-чат через прямі addHealthChatMsg/saveChatMsg з гілкою currentTab. Race condition + dataset.restored lock у restoreChatUI блокували відображення.
- **Корінь:** `restoreChatUI` (core.js:867) має guard `if (el.dataset.restored) return` — після першого відкриття чату повторне відновлення з storage блокується. Прямий saveChatMsg пише у localStorage, але DOM не оновлюється коли чат уже restored.
- **Рішення — `addMsgForTab(tab, role, text, chips)` з `core.js:797`** — централізована функція що робить АТОМАРНО: (a) saveChatMsg → persistence у nm_chat_<tab>, (b) DOM live-append якщо контейнер restored через renderMap, (c) showUnreadBadge для cross-tab сигналу. Обходить dataset.restored lock через прямий appendChild.
- **Правило:** будь-який cross-chat write з іншого чату — використовувати `addMsgForTab`, НЕ прямі add*ChatMsg + saveChatMsg пари. Це той самий patten що DRY save_finance — централізована точка замість 8 копій.
- **TTL для FSM state у localStorage** — якщо state може жити вічно (юзер не довів інтерв'ю до кінця), додати TTL check у обробник. 7 днів синхронно з `nm_chip_payloads` GC.
- **Persistent state + history паралельно** — `nm_health_interview_pending` для FSM + `nm_chat_health` для chips у history + `healthBarHistory` для AI-контексту. Усі 3 шари оновлюються разом, інакше AI втратить контекст після інтерв'ю.
- **⚠️ Урок nliW8 13.05.2026 — grep #1 НЕ покриває string concat у onclick.** Регресія habits.js: db0YY запустив grep `onclick="...\${...id}...` і пройшовся 6 файлами. Але `habits.js` мав ОБИДВА патерни: template literal `${h.id}` (4 точки 454/458/775/779 — мали б спіймати) **АЛЕ ще 7 точок string concat** `' + h.id + ')` (465/467/786/788/865/898×2/901×2 — grep #1 ПРОПУСТИВ). Symptom: 26 SyntaxError у production логах v862 на тапі галочки.
- **Розширений 7-grep чек-ліст:** додати окремий grep для string concat:
  ```bash
  # 7. onclick з string concat ' + obj.id + ' без обгортки в \'...\' (B-170 регресія)
  grep -rnE "onclick=\"[^\"]*\(' \+ [^+]+\.id \+ '\)" src/ --include="*.js" | grep -v "\\\\'"
  # Також shadow patten — ontouchend (для button.button з double handler як habits.js Quit):
  grep -rnE "ontouchend=\"[^\"]*\(' \+ [^+]+\.id \+ '\)" src/ --include="*.js" | grep -v "\\\\'"
  ```
- **Конкретний нюанс habits.js:** `renderHabits` (Me-tab), `renderProdHabits` (Прод-tab), `_renderQuitHabitCard` (Quit-челенджі) — **3 окремі render-функції в одному файлі**. Grep по `habits.js` ловить всі, але якщо grep по «onclick" з template literal» — пропускає Quit (string concat). Завжди запускати **ОБИДВА grep'и** (template literal AND string concat) після UUID-міграції.

### Universal undo через DI — silent fail коли handler НЕ у processUniversalAction (db0YY 12.05.2026, B-174 урок)
- **Кейс:** після Council аудиту знайшов що undo для `save_finance` ламався з myshu (24+ год у проді). Reverser у `action-reversers.js` будував `{type:'tool_call', tool:'delete_transaction', args:{id}}`. `executeReverse` через DI шле у `processUniversalAction` (habits.js). Але `delete_transaction` живе ТIЛЬКИ у `tool-dispatcher.js` direct handler — не у `processUniversalAction` → return false → AI пише «⚠️ Не зміг відмінити». Я повторив помилку у db0YY коли додав `create_health_card`/`add_allergy` reversers — той самий патерн silent fail.
- **Корінь:** `tool-dispatcher.js dispatchChatToolCalls` має ДВА шляхи виконання tool:
  1. **Direct handler** (case 'create_health_card', 'delete_transaction', '_handleHealthTool', '_handleProjectTool' etc) — для специфічних доменів
  2. **Universal action** через `_toolCallToUniversalAction` → `processUniversalAction` (habits.js) — для CRUD tools
  
  Reverser, що будує `{tool:'delete_X'}` для action-undo, виконається ТIЛЬКИ якщо `delete_X` є у шляху 2 (processUniversalAction). Якщо delete_X — direct handler — silent fail.
- **ПРАВИЛО:** перш ніж додавати reverser у `action-reversers.js`, ПЕРЕВIР що reverse-tool існує у `habits.js processUniversalAction` (не лише у tool-dispatcher direct handlers). Якщо у direct — або додай case у processUniversalAction, або передавай `dispatchChatToolCalls` як DI замість `processUniversalAction`.
- **Підтверджений кейс db0YY:** save_finance (з myshu), create_health_card, add_allergy — всі 3 reverser silent fail до фіксу `bb0c50e`. Council `code-regression-finder` + `silent-bug-scout` знайшли одночасно за один аудит.

### 6 класів регресій автоматизовано хуками (nliW8 13.05.2026)

**Контекст:** Roman прямо вказав «декларативні правила у CLAUDE.md я систематично забуваю через сесію». 5 сесій підряд я повторював однакові помилки попри правила у файлах. Перехід на автоматичні сторожі (pre-commit hooks).

**6 класів регресій тепер блокуються авто перед коміт:**

| Клас | Хук | Урок звідки |
|---|---|---|
| Забутий import → ReferenceError у проді (біла сторінка) | `pre-commit-imports.js` (підключає існуючий `scripts/check-imports.js`) | LW3j8, 6ANWm — 2 рази минулого тижня |
| `addToTrash('TYPE')` без парного case у `restoreFromTrash` → silent data loss | `pre-commit-trash-sync.js` | B-175 db0YY (повторювалось 4 рази — allergy/event/project/health_card) |
| `id: { type: "integer" }` у prompts.js → OpenAI Strict mode silent reject AI-викликів | `pre-commit-schema-check.js` | B-172 db0YY (28+ точок, 24+ год у проді) |
| «ЗОБОВ'ЯЗАНИЙ» у tool description → AI не виконував | `pre-commit-schema-check.js` | PJi7l B-158 (revert через 4 коміти) |
| reverser без парного case у `processUniversalAction` → silent undo fail | `pre-commit-reverser-check.js` | B-174 db0YY (save_finance + create_health_card + add_allergy) |
| onclick UUID без обгортки `'${id}'` → SyntaxError при тапі | `pre-commit-uuid-grep.js` (4 grep patterns) | B-170 myshu/db0YY/nliW8 (26 SyntaxError у v862) |

**+ розширено `skill-triggers.sh`:** тригер-слова Романа «копай глибше / дивись широко / ніяких латок / системно» → автоматично інжектить 3 питання у мій контекст ПЕРЕД фіксом (1. поламано в 1 місці чи кількох? 2. корінь чи симптом? 3. DRY дубль?). Замість того щоб Roman повторював «це латка?» — нагадування з'являється авто.

**Принцип:** декларативне правило у CLAUDE.md = я забуваю. Автоматичний сторож = блокує/нагадує незалежно від моєї пам'яті. Той самий patten що i18n блок + pre-push CACHE bump + pre-edit-read-check — усі вже стабільно ловлять реальні проблеми.

**Чого НЕ зробив свідомо (Council pre-mortem):**
- `pre-edit-arch-check` (блокування Edit у архітектурних файлах без попередніх агентів) — 80% правок у `prompts.js` = однорядкові заміни слів. Хук блокував би все підряд → я почав би писати bypass-фразу автоматично → сторож мертвий за тиждень. Краще точкові pre-commit перевірки (6 хуків вище) ніж wholesale Edit блок.
- **Кейс:** `deleteHealthCardProgrammatic` кидав `addToTrash('health_card', removed)` але `restoreFromTrash` НЕ мав case 'health_card'. Функція повертала `true` після cleanup кошика (рядок 115) → юзер бачив «✅ Відновив» але картка не з'являлась. Silent data loss.
- **Чек-ліст ПIСЛЯ кожного `addToTrash(NEW_TYPE, ...)`:**
  ```bash
  # Знайти ВСI типи що addToTrash:
  grep -rnoE "addToTrash\('[a-z_]+'" src/ --include="*.js" | awk -F"'" '{print $2}' | sort -u
  # Знайти ВСI типи у restoreFromTrash:
  grep -onE "type === '[a-z_]+'" src/core/trash.js | awk -F"'" '{print $2}' | sort -u
  # Різниця — це silent failures.
  ```
- **Підтверджений кейс db0YY:** allergy/event/project/health_card — 4 типи кидались у trash але restoreFromTrash тихо ігнорував до фіксів `c72763e`/`f2bd017`/`08940c1`/`bb0c50e`.

### Workflow з зовнішнім API — спершу локальний міні-тест curl (DGH6F 16.05.2026, brain-спостереження)

**Контекст:** сесія e9t3N 15.05 — 3 невдалих запуски Claude Security Action поспіль. Послідовність провалів:
1. **Run #1** — використав `anthropics/claude-code-security-review@main` action з документації. Параметри `anthropic_api_key` / `scan-mode` / `severity-threshold` ігнорувались мовчки — action виявився PR-only без явної помилки конфігурації.
2. **Run #9 #8 #7** — замінив на власний `claude-security.yml` workflow. YAML syntax errors на лінії 218 — 3 multi-line strings у `run: |` block ламали парсинг (виявлено тільки коли GitHub UI показав «Invalid workflow file»).
3. **Run #11 #12** — після фіксів YAML впав на rate limit 429 (Tier 1 = 30K ITPM, codebase 210K tokens).

**Корінь:** жодного локального тесту перед commit'ом. Я writing YAML за документацією → push → дивлюсь чи GitHub Actions UI зеленить. Це ЦИКЛ через хмарну CI:
- 1 ітерація = 3 хв (commit → push → wait CI start → fail → читай logs у UI)
- 3 ітерації = 10+ хв змарнованих + забруднена git history з «fix yaml» комітами

**Що мав робити (правило):** перед commit workflow з зовнішнім API → один локальний `curl` ручний тест → бачу response.status + format → ТIЛЬКИ ТОДI обгортаю у YAML.

**Конкретний приклад для Anthropic API:**
```bash
# 1. Локальний тест моделі + headers (5 секунд):
curl -s -w "\nHTTP %{http_code}\n" -X POST https://api.anthropic.com/v1/messages \
  -H "Content-Type: application/json" \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -d '{"model": "claude-sonnet-4-5-20250929", "max_tokens": 100, "messages": [{"role":"user","content":"ping"}]}'

# 2. Локальний тест rate limit (моделюємо payload розміром):
echo "{...real payload...}" > /tmp/payload.json
curl -s -w "%{http_code}\n" -X POST ... -d @/tmp/payload.json

# 3. ТIЛЬКИ якщо #1+#2 повернули 200 з очікуваним JSON — обгортаю у jq + workflow.
```

**Класи проблем що ловить локальний міні-тест:**
| Клас | Як ловиться локально |
|---|---|
| Неправильні параметри action (як `anthropic_api_key` vs `claude-api-key`) | Прочитати action.yml у repo перед використанням |
| YAML syntax errors у `run: \|` блок | `python3 -c "import yaml; yaml.safe_load(open('file.yml'))"` |
| API повертає 4xx/5xx з понятним error.message | `curl -w "%{http_code}"` показує одразу |
| Rate limit 429 з конкретним payload size | `curl` з realistic payload — одразу видно |
| Authentication errors (header формат, scope) | `curl` повертає 401/403 з error.type |

**Бонус — `jq` обгортки для payload:** використовувати `jq -n --rawfile` для збору JSON, НЕ multi-line strings у bash (це окремо ламало YAML у e9t3N). Урок:
```yaml
# ❌ ЛАМАЄ YAML
run: |
  PAYLOAD="{\"model\": \"...\",
    \"messages\": [...]}"  # ← це теж зламає YAML парсер
# ✅ ПРАЦЮЄ
run: |
  jq -n --arg system "$SYS" --rawfile code /tmp/code.txt '{model: "...", system: $system, ...}' > /tmp/payload.json
```

**Автоматизація неможлива** (на відміну від 6 класів з блоку вище) — не існує способу хук перевірив «чи зробив curl міні-тест перед commit workflow». Це дисципліна процесу. Сигнал-тригер: будь-який Edit/Write у `.github/workflows/*.yml` що додає новий `curl`/`gh api`/`uses: anthropic/*` → **STOP перед коміт → локальний curl 5 секунд → продовжую**.

### Pre-mortem ≠ implementation verification — Council аудит ПIСЛЯ власних фіксів (DGH6F 16.05.2026)

**Контекст:** Pre-mortem знайшов 4 латентні дірки у backup.js. Я закрив 4 фіксами (bdc3aee/5d52507/91cfccc/9657117). Запустив Council 3 паралельні агенти для self-аудиту → знайшли **7 нових проблем у моїх же фіксах** (5 критичних + 2 латентних). Корінь:

1. **Migration flag mapping без verify типу кожного flag'а** — я зробив grep `setItem.*_migrated_v|_done|_cleared_v` і скопіював усе у `KEY_MIGRATION_FLAGS` БЕЗ перевірки що кожен flag робить. Включив `nm_health_log_cleared_v6` — це CLEANUP flag (`removeItem('nm_health_log')` у boot.js:454), не UUID conversion. Скидати його після restore = повторне видалення відновлених даних. Анти-патерн.

2. **Створив сигнал-інтерфейс БЕЗ використання** — `window.__nm_restoring = true` у `restoreBackup` як «hook для майбутніх listener'ів». Жоден з 5 поточних `nm-data-changed` listener'ів (proactive/followups/brain-pulse/me/logger) НЕ перевіряв його. Lock був МЕРТВИЙ. Захист, який я задекларував у docs+lessons, фактично не існував.

3. **`nm-data-changed` не диспатчився після restore** — UI lіstener'и не реагували → юзер бачив старі дані до F5.

**Урок (мета-патерн):**

- **Pre-mortem знаходить КОРIНЬ** — це ефективно (правило CLAUDE.md mental model #1).
- **Inversion перевіряє РЕАЛIЗАЦIЮ** — «Як гарантовано це зламати?» ПЕРЕД commit (mental model #2). Я цього не зробив для Fix 2 (race lock) і Fix 3 (migration flags). Якби запитав себе «як гарантовано зламати race lock?» — побачив би «listener'и його не читають». Якби запитав «як гарантовано зламати migration flag reset?» — побачив би «cleanup flag скинеться → знищить дані».
- **Council аудит власних фіксів** — обов'язковий КРОК між commit-серією і final push для коду що зачіпає `src/core/*`. Не покладатися на самотест: мозок Голови після 30 хв реалізації втрачає холодну перспективу. Це той же урок як «Council 3 агенти ОБОВ'ЯЗКОВО на регресії» (LfA6w 08.05) — повторюється.

**Конкретний триггер для майбутніх сесій:**

| Тригер | Дія |
|---|---|
| Edit у `src/core/*` що додає `KEY_*_MAP` / `*_FLAGS` константу | Запустити agent з промптом «verify кожен entry у MAP проти його джерела» |
| Edit що створює `window.__X` сигнал/lock | Grep `addEventListener` цільового події → перевірити що ВСI listener'и читають сигнал |
| Edit що додає `dispatchEvent` без mirror'у | Перевірити чи UI listener для цього event існує |

Цей урок поверх Pre-mortem (B-185) — фіксує **двоетапну природу процесу**: знайти корінь (Pre-mortem) → реалізувати правильно (Council аудит імплементації).

### Pre-mortem знаходить латентні дірки ДО реалізації — не лише після провалу (DGH6F 16.05.2026, B-185 урок)

**Контекст:** Council 💎 Pre-mortem агент (промпт «уяви Supabase міграція провалилась — чому?») знайшов 4 латентні дірки у `backup.js`+`boot.js`, жодна з яких ще не зашкодила active-юзеру. Усі 4 закриті ДО написання Supabase коду — без них перший серйозний backup сценарій провалився б непомітно.

**Що знайшов і чому це працює:**

| # | Дірка | Сценарій провалу (Pre-mortem уявив) | Чому не помітно у звичайному тестуванні |
|---|---|---|---|
| 1 | Quota silent fail у `createSelectiveBackup` | localStorage 4.5 MB → backup `nm_inbox` (1 MB) → quota exceeded → catch → `return null` без warning'а | Поточні юзери ще не наповнили storage — quota не зривається на тест-даних |
| 2 | Race condition у `restoreBackup` циклі | `setItem` без блоку → OWL scheduler пише `nm_inbox` між кроками → restore тихо перетирається | Restore запускається рідко (тільки після провалу) — race-вікно мікросекундне у нормі |
| 3 | Migration flag mixed state | restore повертає старий формат → `nm_*_uuid_migrated_v10='1'` лишається → boot пропускає → mixed UUID/number | Mixed state видно тільки через місяць коли AI робить `find(x=>x.id===id)` |
| 4 | `init() runMigrations` swallow | Падіння міграції на import-level → жодних слідів у логах → юзер бачить пусті поля | Падіння рідкі (тільки коли SW кеш старий) — звичайний smoke не зловить |

**Чому Pre-mortem ефективний (а не «параноя»):**

- Перевернутий процес: замість «що тестуєш — те і знайдеш» → «уяви провал → реверс-інженер причину». Знаходить не баги що вже сталися, а класи багів що можуть статись.
- Для **інфраструктурного коду** (backup, migration, storage) це особливо цінно: ціна провалу = втрата даних юзера, а тестова перевірка важка (треба симулювати quota / race / partial fail).
- 4 з 4 знахідок підтвердились читанням реального коду (правило CLAUDE.md «гіпотеза агента ≠ факт») — false positive rate 0%.

**Коли використовувати:** перед deploy будь-якого коду що: (1) пише до сховища даних; (2) міняє схему; (3) має undo/rollback логіку; (4) керує асинхронною race-prone операцією. Тригер у CLAUDE.md mental models §1: «перед фіксом #2 одного бага АБО перед стартом архітектурної фази».

**Антипатерн який цей урок відучить:** «фічу зробив, smoke-тест прошов, push». Якщо фіча про дані — це **недостатньо**. Pre-mortem перед push = додаткові 5-10 хв agent'а Sonnet vs дні відновлення після провалу у проді.

### Реєстр localStorage ключів — широкий grep констант + literal'ів (DGH6F 16.05.2026, B-184 урок)

**Контекст:** Council Pre-mortem знайшов що `NM_KEYS` у `boot.js:307` (єдине джерело правди для `clearAllData()` + майбутнього Supabase backup) **пропускав 5 юзерських ключів** (`nm_events`/`nm_reminders`/`nm_routine`/`nm_allergies`/`nm_action_log`). За 4 тижні після qG4fj 25.04 реєстр відстав на 44 ключі (50→94). Активний баг: «Видалити все» залишала Календар-розпорядок, події, нагадування, алергії, action-log.

**Корінь:** агент перший раз грепав вузько — тільки `localStorage.(setItem|getItem)\('nm_*'\)`. Пропустив:
- **Константи:** `const KEY = 'nm_action_log'` у `action-log.js:26` → `localStorage.getItem(KEY)` (grep не бачить що це nm_*)
- **Per-tab константи:** `const NM_ROUTINE_KEY = 'nm_routine'` у `calendar.js:537` — той самий патерн
- **Module-level: `const KEY` + `localStorage.X(KEY)`** — поширений патерн у `src/data/` модулях
- **Динамічні префікси:** `nm_backup_${N}_${label}` — створюються `backup.js` але без статичного literal'у у grep

**ОБОВ'ЯЗКОВИЙ 4-grep чек-ліст ПЕРЕД додаванням нового ключа у `NM_KEYS`:**

```bash
# 1. Всі string literal'и 'nm_*' у src/ (НЕ тільки localStorage):
grep -rhE "['\\\`]nm_[a-zA-Z0-9_]+['\\\`]" src/ --include="*.js" \
  | grep -oE "['\\\`]nm_[a-zA-Z0-9_]+['\\\`]" | tr -d "'\\\`" | sort -u

# 2. localStorage виклики (вузький — для перевірки що жоден активний ключ не загубився):
grep -rE "localStorage\\.(setItem|getItem|removeItem)" src/ --include="*.js" \
  | grep -oE "'nm_[a-zA-Z0-9_]+'" | sort -u

# 3. Константи у патерні KEY = 'nm_*' (НАЙВАЖЛИВІШЕ — це грегаp #1 пропускає у частині кейсів):
grep -rnE "const\\s+[A-Z_]+\\s*=\\s*['\\\`]nm_" src/ --include="*.js"

# 4. Динамічні префікси (треба у NM_KEYS.patterns):
grep -rE "['\\\`]nm_[a-zA-Z0-9_]+_\\\$\\{" src/ --include="*.js" | head
```

Різниця між #1 і #2 = ключі через константи. Різниця між #1 і `NM_KEYS` = пропущене. **Boot-time `_assertAllKeysKnown()` тепер автоматично попереджає у консолі** — після додавання нового ключа без оновлення `NM_KEYS` побачиш warn одразу при F5.

**Більш загальне правило:** **будь-який реєстр що людина підтримує вручну** (NM_KEYS, ALLOWED_TYPES, REVERSIBLE_ACTIONS, MIGRATION_FLAGS) — потенційне джерело silent regression. Через 4+ тижні гарантовано відстає від реальності. Лікування:
1. **Широкий grep на старті аудиту** (не вузький — пропускає константи)
2. **Boot-time assertion** що порівнює реєстр з реальністю при init (як `_assertAllKeysKnown`)
3. **Pre-commit hook** який блокує commit коли в diff є новий `nm_*`/новий `addToTrash('X')`/новий tool без оновлення реєстру

Цей патерн повторюється: B-175 (addToTrash без restore case → pre-commit-trash-sync.js), B-172 (schema без `_v{N}_done` reset → pre-commit-schema-check.js), B-184 (NM_KEYS неповний → `_assertAllKeysKnown` runtime warn). **Кожен реєстр потребує сторожа — або pre-commit hook, або runtime assertion.**

### Bridge-стратегія перед великою міграцією (64CXo 10.05.2026)
- **Контекст:** через 1-2 місяці перехід на Supabase. Виникло питання — лагодити поточну архітектуру чи мігрувати негайно.
- **Висновок з 3 раундів Gemini:** **НЕ мігрувати негайно** — 3-4 тижні без видимого прогресу. Замість того — робити Bridge fixes що переїдуть на Supabase БЕЗ переписування (0-10% migration debt).
- **Що дає 0% борг:** Strict JSON Schema (ідентичні схеми для OpenAI client/Edge), pure functions у `src/data/` (TypeScript+Deno-сумісні), ES Modules.
- **Що дає 10% борг:** Embeddings classifier у клієнті (потім swap `fetchLocal()` → `supabase.rpc('match_intents')`).
- **Що НЕ робити поки single-user PWA:** Multi-Agent LLM Router (overkill, latency), Constrained decoding поза OpenAI Strict.
- **Правило вибору:** для соло-розробника при наближенні великої міграції — BRIDGE завжди > re-architect.

### Детерміноване через код, не промпт (64CXo 10.05.2026 — підтверджує правило 12 у CLAUDE.md)
- **Кейс:** 3 раунди promptфіксів для «вчора → дейлі-папка»: (1) додав інструкцію у save_moment.date description; (2) розширив на «N днів тому»; (3) додав явну заборону. Усі 3 провалилися — AI ігнорував. Поки не написали `src/data/ua-time-parser.js` (12/12 тестів пройшло одразу).
- **Strict OpenAI mode** — ідеально для **параметрів** tool'а (nullable + required), але **не блокує вибір** неправильного tool. Тому Strict + Code-side guards разом.
- **Важливо: JS regex `\b` НЕ працює як word boundary для кирилиці.** `\bвчора\b` не матчить «вчора жарили» бо `в` і `ж` обидва — non-word характеристики у JS regex. Substring match без `\b` (наприклад `/вчора/`) — обережно з false-positives.
- **Класифікаційні правила (момент vs подія, минулий час → save_moment) — це ДЕТЕРМIНОВАНI задачі**, не вирішуйте їх промптом. AI помиляється навіть з явними «🚫 ЗАБОРОНЕНО». Замість того — code-side dedupe + конверсія у `inbox.js dispatch`.

### Strict OpenAI mode — корисні нюанси (64CXo 10.05.2026)
- `strict: true` на function level (sibling до `name`/`description`/`parameters`).
- Підтримує тільки subset JSON Schema. Усі fields у `properties` мають бути у `required` — інакше API відхилить.
- Optional досягається через `["string", "null"]` як type + поле в `required`. Тоді AI ОБОВʼЯЗКОВО заповнить, але має право поставити null.
- `additionalProperties: false` обовʼязково (вже було у NeverMind).
- Підтверджений case 64CXo: «нагадай о 9 ранку завтра» → time:"09:00" (явно), date:"2026-05-11" (через AI або resolveDateFromText), всі інші nullable=null. Раніше AI вигадував time для «тренування у вівторок»=18:00 — після Strict: time=null.

### Перед стратегічним рішенням
- **Розгалужений архітектурний вибір з ціною помилки години-дні** (як інтегрувати i18n, яку схему обрати, який підхід до міграції) → консультація з Gemini через скіл `/gemini`. Він незалежний, без bias (упередженості) поточного чату, добре аналізує tradeoffs (компроміси).
- **Самокритика плану** → теж до Gemini, окремим раундом. У UG1Fr Раунд 2 знайшов 3 помилки у власній пропозиції з Раунду 1 — я б їх не побачив бо вони були в моїй же логіці.
- **Тактичні рішення** (де крапка з комою, який CSS-клас, як назвати функцію) → сам. Оверхед (накладні витрати на пояснення контексту Gemini) > користь.

### Комунікація з Романом
- **Відповідь без "Роби"** — не чіпаю код, тільки обговорюю. Пропоную план, чекаю підтвердження.
- **Роман каже "порівняй варіанти"** — значить хоче довшу відповідь з таблицею плюсів/мінусів. Можна 15-25 рядків. Інакше — 5-15.
- **Роман каже "простіше" / "скороти"** — тригер-нагадування про розмір. Переписую коротко.
- **Роман сумнівається у моєму плані** — вказую на слабкі місця сам, пропоную альтернативу. Не ховаюсь за "вирішуй ти".

### Обробка brain-фідбеку з іншої сесії (доведений робочий цикл)

**Контекст:** Роман інколи приносить коментар від AI з паралельної сесії-рефлексії (його обсідіан-репо `roman-brain`) — спостереження про мою роботу, патерни, рекомендації. Раніше складував raw текст у `SESSION_STATE.md` як «Brain-фідбек» — це **шкідливо** (засмічує контекст наступних сесій, Роман не читає блоки з термінами, raw неперевірений).

**Доведено на трьох сесіях (lRnXU 29.04 → m4Q1o 29.04 → d6Fgh 30.04):** правило з `CLAUDE.md` секції «🧠 Brain-фідбек з іншої сесії» працює без скарг від Романа. У d6Fgh **уперше** Роман сказав «Цінне — впроваджуй» по 3 з 6 пунктів замість звичного «нічого з цього». Це найкращий результат серед усіх подібних розмов.

**Патерн який спрацював (формат для повтору):**
1. **Не записувати raw** — спочатку прочитати, дати свою оцінку.
2. **Кажу свою думку зрозумілою мовою** — що цінне, що сумнівне, що дублюється з тим що вже є. Технічні терміни — у дужках.
3. **Пропоную дії на конкретному прикладі:** «пункт 2 → стане патерном у `lessons.md`», «пункт 4 → перевірю через 2-3 сесії метрику у `.claude/violations-log.txt`». Без розтягування.
4. **Чекаю «Роби»** — Роман підтверджує, відсіює некоректне.
5. **Втілюю у конкретне:** правило у `CLAUDE.md`, патерн у `lessons.md`, прапор у `SESSION_STATE.md`, TODO у `TESTING_LOG.md`, або коміт коду.
6. **Raw текст викидаю** — він зробив свою роботу, далі живе тільки втілене.

**Метрики «що приймається vs відкидається» (d6Fgh):**
- **Втілено = конкретні дії з файлами** — «зроби тестовий коміт у такому-то хуку», «додай правило про брeак V3 Фази 3 у CLAUDE.md», «фікс 5 рядків у `check-i18n.js`».
- **Відкинуто = ідеї без тригерів або дублі** — «треба пояснювати у дужках» (вже у CLAUDE.md), «додай 2-й хук-нагадувач для TESTING_LOG» (додає тертя без вигоди), «синхрон файлів у brain-репо» (не наша територія).

**Якщо Роман каже «нічого з цього»** — це теж OK, не наполягаю. Інша сесія могла помилитись у припущеннях про наш контекст. Викидаю весь raw без записів.

### Правка файлу у `src/` (i18n-нагода)
- **PostToolUse хук показує необгорнуті рядки** після кожного Edit/Write на `*.js` у `src/` (окрім `src/ai/`, `src/owl/`). Коли бачу повідомлення `📋 i18n: src/X.js має N необгорнутих українських рядків` — це **природна нагода** обгорнути 3-5 рядків поряд з моєю основною правкою.
- **Workflow:** правлю файл для бага → хук показує 23 необгорнутих → обгортаю 3-5 поряд з основною правкою у `t('key', 'fallback')` → `node scripts/check-i18n.js --update-baseline` → коміт включає оновлений `i18n-baseline.json`.
- **Не зриватись на масовому обгортанні** — 5 за сесію природно > 100 разово (правило #2 з пункту 4 «MVP-фіча» — поступово > бардак). Темп ~50-80 сесій до 0.
- **Whitelist:** не обгортаємо AI-промпти (`src/ai/*`), `src/owl/*` (mixed), коментарі, `console.log`, `toLocaleDateString`. Це **навмисно** — AI-моделі краще працюють з нативною мовою юзера.

### Після зміни коду
- **Зміна у `src/*`, `*.css`, `sw.js`, `index.html`** → оновити `CACHE_NAME` у `sw.js` (формат `nm-YYYYMMDD-HHMM`, команда `date`). Хук нагадує.
- **Зміна у `src/ai/prompts.js` (template literal з кирилицею + бектіки)** → `node --check src/ai/prompts.js` **НЕДОСТАТНЬО**. Він валідує синтаксис, але НЕ ловить ескейпи бектіків `\`subcategory\`` всередині template literal які ламають esbuild bundler. Підтверджений кейс: LfA6w `be6f708` 08.05 — `\`subcategory\`` у `CHIP_PROMPT_RULES` пройшов `node --check`, впав у CI build → 4 коміти підряд auto-merge fail (cf8ce77/dc76864/7b6beba/6b48eee). **Урок:** перед `git push` зміни у `prompts.js` з template literal — або `npm install esbuild --no-save && node build.js` локально, або просто завжди писати бектіки як unicode `U+0060` через змінну. CI ловить — але ціна 4 викинутих коміти.
- **Зміна у `src/ai/prompts.js` або `ui-tools.js`** → оновити `docs/AI_TOOLS.md` (таблиця + Історія змін).
- **Новий `.md` файл** → додати у `_ai-tools/INDEX.md` і "Карту документації" у `CLAUDE.md`. Хук нагадує.
- **Новий JS-файл у `src/`** → імпорт у `src/app.js` + оновлення `docs/FILE_STRUCTURE.md`. Скіл `/new-file`.

### Edit fail з «File has not been read» — повторити ВСI пов'язані Edit'и (64CXo 09.05)
- **Симптом:** `Edit` повертає помилку `File has not been read yet. Read it first before writing to it.` Я роблю `Read`, повторюю Edit — але **тільки той що падав**, забуваю інші зі spawnу.
- **Кейс 64CXo `ad0b10f`:** одночасно запустив 5 Edit'ів — додати `getReminders, saveReminders` до import у 5 файлах. 2 пройшли (inbox.js, habits.js), 3 впали (calendar.js, owl/inbox-board.js, owl/proactive.js). Прочитав 3 проблемні файли. Потім зробив окремі Edit'и на JSON.parse заміни — але **імпорти забув повторити**. Пройшов syntax check (бо `node --check` не валідує імпорт-роздільність). Push. Bundle build брокен — `getReminders is not defined` у 3 файлах. Regression-hunter Sonnet знайшов через `node build.js`.
- **Корінь:** після Edit fail я зосередився на «нову фіксі чого падало», не на «ВСIХ Edit'ах того логічного кроку». Один логічний крок (додати import у N файлів) розпався на 2 паралельні фрагменти у моїй увазі.
- **Урок:** коли Edit падає з «File has not been read» → (1) прочитати файл, (2) **переробити ВСЕ що було у тому самому spawnу для цього файлу**, не тільки той Edit. Якщо це частина multi-file логічного кроку (наприклад «додати import у 5 файлів») — після прочитання трекати які файли отримали import, які не отримали. Простіше — `grep -rn "function_name" src/` після всіх Edit'ів верифікує що імпорти збігаються з викликами.
- **Тригер виявлення:** після push зміни що додає новий експорт + його використання у 5 файлах — обов'язково `for f in <files>; do grep "import.*newFunc" $f; done` перевірити кожен. Або `node build.js` локально (якщо esbuild доступний).

### Створення / зміна хука у `.claude/hooks/`

- **Тригер:** новий скрипт хука або правка існуючого (`pre-push-check.js`, `check-response-violations.js` тощо), або зміна `.claude/settings.json` з реєстрацією хука.
- **Дія ДО комітa:**
  1. **Штучний тригер** — створити мінімальний кейс який повинен спрацювати (наприклад: для pre-push з правилом 6 — повідомлення асистента з `create_*` без bypass-фрази; для i18n-детектора — рядок з кирилицею у новому місці).
  2. **Перевірити що блокує/попереджає** — реально запустити `node .claude/hooks/X.js` або відповідну операцію (Bash/Edit), переконатись що exit-code 1 або повідомлення видається.
  3. **Перевірити false positive** — кейс який НЕ повинен спрацювати (інфраструктурний коміт без UI / коментар замість літерала / `t('key')` уже обгорнутий). Переконатись що проходить.
  4. **Тільки тоді — коміт**.
- **Чому це критично:** хук який не пройшов smoke-test = ще одне декларативне правило (див. анти-патерн нижче). Або не блокує коли треба, або блокує false positive і Роман викине його через 2 сесії.
- **Підтверджений кейс (oknnM 29.04):** при додаванні pre-push-check помилково записав хук у `PostToolUse` замість `PreToolUse` у `settings.json`. Виправив у тому ж сеансі ДО комітa бо помітив під час перечитування — але якби пропустив, хук викликався б ПІСЛЯ `git push` = марно (вже надіслано на сервер). Smoke-test з фейковим `git push -n --dry-run` зловив би це за хвилину.
- **Звʼязок з анти-патерном «декларативне правило без автоматичного контролю»:** інфраструктурний код **теж** потребує smoke-test. Хук який не блокує — гірший за відсутність хука, бо створює ілюзію контролю.

---

### Закриття фази у коді = одразу синхрон планового документу (додано 30.04.2026 xHQfi)

**Тригер:** ти закрив у коді блок з `🚀 Active` ROADMAP — або повністю фазу з планового документу (`_archive/OWL_SILENCE_PRUNING_PLAN.md`, `docs/EVENING_2.0_PLAN.md`, `docs/FINANCE_V2_PLAN.md`, `docs/AGENT_INTELLIGENCE_SCALE.md`).

**Дія:** **у тій самій сесії, ДО фінального коміту** — оновити обидва місця:
1. `ROADMAP.md` → перенести блок з Active у короткий покажчик на ROADMAP_DONE.
2. `docs/X_PLAN.md` → у заголовку статус «✅ ВИКОНАНО ({сесія} {дата})», у розділі фази позначка `✅ ВИКОНАНО` з посиланнями на коміти.
3. `ROADMAP_DONE.md` → новий запис з ключовими файлами/комітами.

**НЕ покладатись на `/finish`** — він до правки 30.04 покривав тільки `SESSION_STATE`/`CHANGES`/`BUGS` і не торкався планів підсистем.

**Чому критично:** інакше формально блок лишається Active, наступна сесія читає ROADMAP як «не зроблено» і починає планувати реалізацію вдруге. Аудит через 3 дні виявляє що код є — час витрачено даремно, документація вводить в оману.

**Підтверджений кейс (xHQfi 30.04):** /finish C8uQD 27.04 (коміт `4cfe26b`) оновив тільки `SESSION_STATE.md` і `CHANGES.md`. Блок «OWL Silence + Pruning Engine» лишився у ROADMAP Active попри що всі 3 фази закриті у коді з 27.04 (коміти `baf91bc`, `68a2674`, `3d5a465`, `d9d3edf`, `d17b769`, `3e39418`). Те саме для Pre-Migration Hardening Підсесія 1 (`DATA_SCHEMA.md` + `runMigrations()` + UUID-міграція). Через 3 дні xHQfi витратив ~30 хв на «глибокий аудит» щоб виявити це. Корінь — дірка у скілі `/finish` (виправлено у тій же сесії: Фаза 4 sanity-check Active vs код + Фаза 6 покриття `docs/*_PLAN.md`).

---

### Регулярна структурна зміна 10+ файлів → скрипт, не руки (додано 30.04.2026 EhxzJ)

**Тригер:** треба зробити **однотипну** правку у багатьох файлах — додати поле у схему, обгорнути виклики, переписати regex, замінити константу. 10+ цілей — поріг.

**Дія:**
1. Написати `/tmp/transform.js` (або в репо якщо корисний далі) який robotично робить правку через regex / AST.
2. Запустити, перевірити `git diff` на 2-3 файлах для контролю.
3. Якщо diff чистий — `git add -A`, коміт. Якщо ні — поправити скрипт, перезапустити.

**Чому критично:** ручна правка 10+ файлів = (а) втома → пропуски, (б) непослідовність → один файл відстає у форматі, (в) година замість 5 хв.

**Підтверджений кейс (V3 Фаза 1, EhxzJ 30.04):** додавання обовʼязкового поля `_reasoning_log:string` у 60 tools (`prompts.js` + `ui-tools.js` + `brain-tools.js`). `/tmp/add_reasoning_log.js` regex-скрипт: 5 хв замість години + zero error.

**Виняток:** правки де кожен файл вимагає **семантичного** рішення (різні значення, різні гілки логіки) — тоді руки. Скрипт працює тільки коли правка **формально однакова**.

---

### Велика переробка вкладки → iPhone-smoke-test ДО наступної переробки (додано 30.04.2026 EhxzJ за brain-фідбеком)

**Тригер:** друга поспіль сесія яка переробляє ту саму вкладку без проміжної iPhone-перевірки.

**Дія:** перш ніж стартувати другу переробку — попросити Романа потестувати першу рукою на iPhone (свайп / тап / введення / перехід). 5-10 хв замість 6 прихованих багів.

**Чому критично:** «закінчена» переробка у dev ≠ працює на iPhone. Кожна нова переробка кладе шари коду на можливо зламаний попередній шар. Знайти баг у свіжому коді важче — зливається з новим, причина неочевидна.

**Підтверджений кейс (вкладка Я, kGX6g→TdIqO→H0DxS→EhxzJ, квітень 2026):** 3 сесії підряд переробляли вкладку Я (бублики Apple Watch, видалення «Звички»/«Mood», нові інсайти з 7-днем, блок «OWL знає тебе»). У EhxzJ ранкове тестування Романа — **5 з 6 знайдених багів на тій самій вкладці Я** (B-109, B-110, B-111, B-112, B-113, B-114). Причина: жодна з 3 переробок не йшла з ручним iPhone-тестом — все накопичилось до фінального удару.

**Звʼязок з правилом CLAUDE.md «UI smoke test після міграцій»:** це частковий випадок. Велика переробка вкладки = архітектурна зміна, навіть якщо не міграція ID/формату.

---

### Корінь vs симптом — фіксуй причину, не наслідок (додано 29.04.2026 lRnXU за brain-фідбеком)

**Тригер:** проблема яку можна закрити двома шляхами — (а) обходом / зовнішнім контролером (хук, перевірка, нагадування) АБО (б) виправленням внутрішньої логіки що цю проблему створює.

**Дія:** обирати (б) корінь, не (а) симптом. Зовнішні контролери накопичуються, ускладнюють систему і ріжуть свободу. Внутрішня логіка виправлена один раз — корінь зник.

**Підтверджені кейси (квітень 2026):**

1. **`/finish` Phase 0 «архівація-першою» (7PQ1a 29.04).** Симптом: архівація летіла на 95% контексту 4 сесій підряд (kGX6g→UG1Fr→m4Q1o→oknnM). Шлях A (симптом): pre-push hook блокує push при >2 активних блоках (SK6E2 — корисно як страхувальник, але не fix). Шлях B (корінь): переставити архівацію з останньої фази у Phase 0 (детермінована, перед аналітикою). Обрав B → корінь зник, hook лишився як страхувальник.

2. **Інверсія детектор-хука «пояснення в дужках» (7PQ1a 29.04).** Симптом: whitelist 14 слів флагав push/pull/merge/today/SK6E2 — тривіальні слова. Шлях A (симптом): нескінченно додавати слова у whitelist. Шлях B (корінь): інвертувати логіку — flag-тільки-код-патерни через `looksLikeCode()` функцію (snake_case/camelCase/CSS), все інше пропускати. Обрав B → whitelist стабільний, нові терміни автоматично проходять якщо це звичайні слова.

3. **Правило «пояснення в дужках» — переформульовано, не тільки хук (7PQ1a 29.04).** Симптом: я механічно переписував повідомлення «визнаю порушення» 4 рази підряд бо хук казав. Шлях A (симптом): тільки розширити whitelist у хуку. Шлях B (корінь): переформулювати правило у CLAUDE.md з «КОЖНЕ англійське слово» на «тільки незнайомі коди» — потім хук узгодити. Обрав B (на пропозицію Романа «обоє» — корінь у правилі + поведінка у хуку). Без цього хук би розійшовся з правилом за рік.

4. **Quick-dialogue режим — правило + хук, не тільки хук (lRnXU 29.04).** Симптом: я даю «середній розмір» 5-15 рядків коли Роман у швидкому пінг-понгу і пише ≤10 слів. Шлях A: хук-нагадування. Шлях B: правило в CLAUDE.md + хук-детектор тригерів. Обрав B — правило формалізує очікувану поведінку, хук нагадує. Без правила хук був би ще одним декларативним рамом без основи.

**Як впізнати:** запитай себе перед фіксом — «чи моя зміна заважає причині виникати, чи я просто ставлю стіну на її дорозі?». Зовнішня стіна = симптом. Виправлення причини = корінь.

**Чому це критично:** симптомний фікс залишає наявну дисфункцію + додає нову складність (більше хуків, більше whitelistу, більше exception'ів). Через рік система перевантажена контролерами. Кореневий фікс — мінус одна дисфункція, без додавання складності.

---

## ❌ Анти-патерни (як часто ламаюсь і чому)

### CSS :active scale на root модалок (UvEHE 03.05)

**Що сталось:** Settings модалка візуально стискалась при тапі всередині. 4 ітерації false leads: mask-image, flex layout, nested backdrop-filter, body-lock. Справжній корінь — глобальне CSS правило `style.css:1551`: `button:active, [onclick]:active { transform: scale(0.87); }`. Settings-overlay має onclick → tap всередині bubbles до root → scale на ВСІЙ модалці.

**Чому 4 ітерації?** Шукав корінь у CSS layout (mask, flex, blur stack) і JS layout (body lock). Жодна гіпотеза не була неправдоподібна — всі мали правдивий механізм. Але всі помилкові. Пропустив **глобальні CSS правила з універсальними селекторами** (`[onclick]`, `button`).

**Правило:** коли симптом «реакція на touch / tap» — ПЕРШИМ ділом `grep ":active\|:focus\|:hover" style.css` на universal selectors. Це 30 сек roботи що могло заощадити 4 ітерації фіксу.

**Корінь анти-патерну:** глобальний `[onclick]:active` selector — анти-патерн сам по собі. Він зачіпає всі елементи з onclick включно з root-модалками. Має бути більш специфічним — `button:active` + opt-in клас `.tap-shrink:active`.

### Nested backdrop-filter на iOS Safari (UvEHE 03.05)

**Що сталось:** Settings мав 13 `.s-group` з `backdrop-filter:blur(16px)` всередині panel з `blur(32px)`. Здавалось OK візуально, але iOS Safari при momentum scroll re-rasterize всю стопку 14 nested composite layers → subpixel rounding glitch.

**Правило:** **max 1 backdrop-filter layer на стек**. Дочірні картки — solid fill, не translucent. Записано у DESIGN_SYSTEM.md.

### Silent failure — tool/action генерується одним шаром, не оброблений іншим (rC4TO 04.05)

**Що сталось (3 кейси за одну сесію):**

1. **Chips Phase C health_interview** — `health.js:_interviewChips` генерує `action:'health_interview'`, але `chips.js renderChips` whitelist пропускає тільки `nav`/`clarify_save` → action тихо переписується у `'chat'` → handler у `handleChipClick` ніколи не спрацьовує → fall through у `sendChipToChat` → AI отримує label як user-message без контексту → інтерв'ю застрягає. **Юзер бачить:** чіп зникає, нічого не відбувається.

2. **Payload escape `"` у data-attr** — `escapeHtml(utils.js)` не кодує `"` → JSON payload `{"step":1,...}` ламає HTML-атрибут передчасно → `JSON.parse` отримує `"{"` → SyntaxError → silent return у handler. Проявляється як той самий симптом 1.

3. **create_project у Фінансах** — `tool-dispatcher.js` навмисно НЕ обробляв `create_project` (коментар «Inbox-specific interview flow»). У Finance/Notes/Tasks AI повертає create_project → dispatcher silent skip → `addMsg` ніколи не викликається → **typing-індикатор крутиться вічно** (бо прибирається тільки при наступному `addMsg`).

**Спільний патерн:** один шар генерує, інший не знає → тиша. Без `addMsg` у chat-handler typing висне; без `console.warn` баг ніким не помічається.

**Правило (універсальне):** для будь-якого dispatcher/handler-ланцюга — **завжди** мати default case з:
1. `console.warn('[<module>] Unknown <thing>:', name)` — щоб діагностика в DevTools показала що сталось.
2. **Видимий feedback юзеру** — `addMsg('agent', '⚠️ Не зміг X. Спробуй Y')` або еквівалент. Тиша — найгірший UX.

**Втілення rC4TO:**
- `chips.js:317` — `console.warn` для невідомого action у `handleChipClick`.
- `tool-dispatcher.js:530` — guard у кінці `dispatchChatToolCalls`: якщо НІ один шар не обробив tool → `addMsg('agent', '⚠️ Не зміг виконати X. Спробуй переформулювати або в Inbox.')` + `console.warn`.

**Як діагностувати такі баги швидко:** Council `code-regression-finder` (порівняння робочого vs зламаного) — у rC4TO знайшов корінь chips за секунди. Альтернатива (хвилини): `grep -rn "action:" src/owl src/ai src/tabs` для збору списку згенерованих actions vs покритих у dispatcher.

### Chips clipping — parent backdrop-filter clips children (UvEHE 03.05)

**Що сталось:** AI-chips у chat-bar частково обрізались знизу на iOS. 4 ітерації false leads: (1) `mask-image` видалено, (2) padding 28→48 + double rAF, (3) `flex-shrink:0` + `scrollIntoView`, (4) корінь — parent `.ai-bar-chat-window` має `backdrop-filter:blur(16px)` що створює новий containing block і клипає absolutely-positioned дітей. Фікс — `transform:translateZ(0)` на `.chat-chips-row` ізолює composite layer від parent. Той самий iOS quirk що Settings.

**Чому 4 ітерації?** Шукав корінь у самих chips (mask, padding, flex, scroll). Жодна гіпотеза не дивилась на parent. Council `code-regression-finder` за 30 сек знайшов parent blur + порадив `translateZ(0)`.

**Правило:** для **обрізання / clipping на iOS** першим ділом перевір `backdrop-filter` / `transform` / `filter` на parent дереві. Це створює новий containing block. Фікс через `translateZ(0)` на дитині (ізолює composite). Записано у `_ai-tools/RULES_UI.md` секція 5 пункт 3.

**Корінь обох UvEHE інцидентів (Settings + Chips):** я шукав корінь у самому проблемному елементі, не на сусідах і не на parent дереві. Council code-regression-finder робить це за секунди — порівняння робочого vs зламаного компоненту дає різницю. Урок — при візуальних iOS багах одразу залучати `code-regression-finder` agent, не патчити навмання.

### Council-агент сам зробив Edit + commit (UvEHE 03.05)

**Що сталось:** Агенту я написав «old_string + new_string для Edit» — звучало як інструкція до редагування. Агент має tool Edit — використав. Самовільно зробив зміни + git commit.

**Правило:** у промптах для Council/sub-агентів ЯВНО блокувати модифікації: «🚫 СУВОРА ЗАБОРОНА: Edit, Write, NotebookEdit, git commit, sed -i». Записано у CLAUDE.md секцію Council. У `.claude/agents/*.md` — read-only за конструкцією у systemPrompt кожного.

### Агент звітує "stale/missing/broken" артефакт не знаючи про CI build (NpBmN 04.05)

**Що сталось:** `silent-bug-scout` повідомив що `bundle.js` застарілий — не співпадає з нинішнім `src/`. Тригерило підозру про регресію.

**Корінь:** агент не бачить інфраструктуру CI. У NeverMind `bundle.js` під `.gitignore` — генерується автоматично у `auto-merge.yml:108` після кожного merge у main. Локальний `bundle.js` ВЖЕ застарілий — це норма, бо локально `node build.js` не запускається без потреби.

**Регресія правила** «Critic always reads» з 4xJ7n (Council Оптиміст). Агенти не бачать всю систему — тільки задану область. Захист — у самому промпті агента.

**Правило:** перед звітом про «відсутній/старий артефакт» — перевір (1) `.gitignore`, (2) `.github/workflows/*.yml`, (3) `build.js`, (4) `git log --oneline -5 -- <файл>`. 2-5 хв перевірки. Записано у промпт `silent-bug-scout.md` секція «ПЕРЕД звітом».

### Поверхневі відповіді "на пам'ять"

**Що роблю:** Роман дає задачу → я одразу відповідаю з оцінкою складності або планом, не читаючи код.
**Чому погано:** оцінка неправильна → Роман мусить виправляти ("копни глибше", "прочитай код"). Марнує 2-3 повідомлення на розкачку.
**Правило:** ПЕРЕД оцінкою — прочитай реальний код залучених файлів. Самоперевірка: "Чи моя оцінка базується на фактах чи припущеннях?"

### Паралельні системи замість покращення наявних

**Що роблю:** бачу "ця проблема вирішилась би новим файлом X" → пропоную створити X.
**Чому погано:** часто існує файл Y де можна додати секцію замість створення X. Більше файлів = більше точок підтримки = більше розсинхронізації.
**Приклад 20.04 g05tu:** пропонував `PATTERNS.md` + `ANTI_PATTERNS.md` + `DECISION_LOG.md` — але вже існує задум `lessons.md`. Роман зупинив: "давай в один".
**Правило:** перед створенням нового файла — подивитись чи є існуючий з дотичною темою де можна додати секцію.

### Виклик функції з іншого модуля без явного `import`

**Що роблю:** додаю виклик `t(...)`, `getOWLPersonality()`, `parseContentChips()` тощо у файл де цієї функції нема в `import { ... }` — на віру що «esbuild IIFE bundle і так все звʼязує бо всі модулі в одному scope».

**Чому погано:** esbuild при колізії імен **перейменовує** функцію — `t` стає `t2`, `getOWLPersonality` стає `getOWLPersonality2`. Виклик без імпорту шукає оригінальне ім'я яке у бандлі **не існує** → `ReferenceError` рантайм. Помилка не ловиться `node build.js` (синтаксис валідний), не ловиться лінтером, тільки реальний клік юзера на проді показує її.

**Два реальні випадки на проді:**
- **v529 (LW3j8 01.05):** коміти `040c30f` + `27f1ef0` додавали `t()` у `notes.js` без імпорту. У бандлі `t2` визначено, виклики `t(` шукали `t` без `2` → `ReferenceError` при відкритті вкладки Нотатки. Виправлено `03f70c7` (явний `import { t }`). Вікно ~50 хв.
- **v539 (виявлено 6ANWm 01.05):** `src/tabs/projects.js:389` викликає `getOWLPersonality()` без імпорту з `core.js`. У бандлі визначено тільки `getOWLPersonality2`. **При створенні нового проекту** AI-інтро-чат падає з `ReferenceError`, перше welcome-повідомлення не приходить. Корінь — переніс `getOWLPersonality` з `core.js` у `prompts.js` 17.04.2026 (14zLe), `core.js` залишив re-export, але `projects.js` має `import { getAIContext, openChatBar, ... } from '../ai/core.js'` без `getOWLPersonality` у списку.

**Чому це треба перевіряти у бандлі а не у source:**
- У source файл компілюється і виглядає як валідний JS.
- Виклик без імпорту = звертання до **глобальної** змінної, а у IIFE бандлі цей глобал не виставлений (немає `window.getOWLPersonality = ...`).
- Декларація з оригінальним ім'ям існує **тільки якщо** ім'я не конфліктує між модулями. Якщо два модулі мають своє `t` → одне стає `t`, інше `t2`. Хто отримає оригінал — лотерея, залежить від порядку модулів у `app.js`.

**Правило:**
1. Перед `Edit`-ом який додає виклик функції з іншого модуля — **перевір імпорт у шапці файлу**. Якщо нема — спершу додай у `import { ... }`, потім додавай виклик.
2. Після **батча `t()` обгорток** — швидкий чек: `grep -E "^import.*\bt\b.*utils" file.js` має знайти імпорт. Якщо не знайдено — додай.
3. **Періодична перевірка проекту:** скрипт що читає всі `src/**/*.js`, для кожного файлу збирає виклики `name(` і список імпортів — повертає випадки коли виклик є без імпорту і це не локальний `function`/`const`/параметр. Один раз у кілька сесій — як guard. Якщо побачимо що це повторюється — оформити у `scripts/check-imports.js` + хук.

### "Простирадла" замість конкретних відповідей

**Що роблю:** на просте питання відповідаю 5 підзаголовками + 10 варіантів.
**Чому погано:** Роман на телефоні, довге повідомлення не читається. Кращий результат — одна думка розгорнута по суті.
**Правило:** цільовий розмір 5-15 рядків. Довша — тільки коли Роман сам питає "порівняй" / "детально" / стратегічне обговорення.

### Технічна мова без пояснень у дужках

**Що роблю:** пишу "hook" / "refactor" / "commit" без пояснень.
**Чому погано:** Роман — підприємець, не розробник. Без пояснень не може прийняти рішення / перевірити роботу.
**Правило:** КОЖНЕ англомовне/технічне слово → пояснення у дужках. Самоперевірка перед відправкою: "Чи є англ. слова без дужок?"

### UI-описи назвами замість вигляду

**Що роблю:** "кнопка `#save-btn` з фоном `#c2790a`".
**Чому погано:** Роман не дивиться в код, він бачить екран. "Бурштинова кнопка Зберегти" — зрозуміло.
**Правило:** описуй ЩО ЮЗЕР БАЧИТЬ, посилайся на інші місця застосунку ("як у Задачах"). Файли/класи/HEX — тільки окремо наприкінці при комітах.

### Деструктивні git-операції без дозволу

**Що роблю (один раз у 14.04):** зіштовхнувся з merge conflict → `git reset --hard` + `git push --force` автоматично без "Роби".
**Наслідок:** втрачено ~80 деплоїв v54-v130, deploy-counter стрибнув назад.
**Правило (жорстке):** `git reset --hard` + `git push --force` ЛИШЕ з прямим дозволом Романа "Роби скид". Замість — `git revert` або `git checkout <hash> -- file`. Детально → `docs/GIT_EMERGENCY.md`.

### MVP-фіча без cleanup-механізму

**Що роблю:** додаю фічу де AI створює дані/структуру (нова tool `create_*` / `repeat_*` / bulk-генерація) → план включає тільки створення → ігнорую edit / delete / warning при конфлікті → пушаю.
**Чому погано:** Роман отримує кашу яку не може прибрати. Юзер у MVP-стилі (швидко перевіряє нові фічі рукою) натикається на це **на першому реальному використанні**. Результат — повний відкат. Паттерн «менше > бардак» — критерій якості Романа, не побажання.
**Три підтверджені кейси (квітень 2026):**
- **Маскот сови rSTLV 18-19.04** — анімація без виключення / cleanup → видалено.
- **`delete_event_series` tool kGX6g 29.04** — Роман відхилив на обговоренні, «складність без цінності».
- **Календар Phase 2 рекурентність kGX6g 29.04** — `repeat_weekly` без warning конфлікту + AI вигадав 19:00 для «пн ср пт» без години + 36 копій без захисту від bulk-помилок → повний відкат `2043a48`. Smoke-test з реальним неоднозначним запитом не зробили.

**Правило:** перед «Роби» — план обовʼязково містить **три речі**: створення / редагування / видалення (cleanup). Якщо план тільки про створення — стоп, додаю решту. Без cleanup → напівфабрикат → відкат → марно витрачена сесія + 36 «привидів» у localStorage Романа.

**Що рахується cleanup для AI-fed фічі:**
- Tool `delete_*` для відповідного типу
- UI-кнопка / свайп-видалення (рукою на iPhone)
- Для bulk-операцій — видалення серії одним дотиком, не по одному запису
- Warning при потенційному конфлікті ("⚠️ На цей час уже є X. Лишити обидві чи перенести?")
- Жорсткий промпт проти AI-вигадування параметрів ("БЕЗ ЯВНОЇ ГОДИНИ — пропусти time")

**Звʼязок з правилом 6 у CLAUDE.md:** smoke-test (правило 6) і є фінальною перевіркою що cleanup працює рукою на iPhone. Cleanup у плані — **що** тестуємо. Smoke-test — **чи дійсно** працює.

### Оцінка часу без читання коду

**Що роблю:** Роман питає «скільки займе?» / «це довго?» → одразу видаю число «30 хвилин» / «3-4 години» — НЕ читаю файли (LOC — lines of code — рядки коду, складність, залежності) перед оцінкою.
**Чому погано:** оцінка летить в ОБИДВА БОКИ — то заниження (×0.3), то завищення (×3). Роман планує сесію на хибних цифрах. Заниження → обрив stream (стрім — потік відповіді у браузер) посеред міграції без коміту. Завищення → відкладає підготовку яка реально швидка.

**Два підтверджені кейси (квітень 2026):**
- **xGe1H 27.04** (UUID-міграція задач — UUID — Universally Unique Identifier — глобально унікальний ідентифікатор): «30 хв» → реально 1.5 год (×3 заниження). Знайшлось 3 неочевидні блокери.
- **m4Q1o 29.04** (i18n-інфраструктура — i18n — internationalization — підготовка до перекладу): «3-4 год» → реально 1 год (×0.33 завищення). Я скопіював число Gemini не передумавши, не прочитав скільки реальних рядків треба правити.

**Корінь проблеми (єдиний):** **не читаю код перед оцінкою.** Заниження і завищення — симптоми одного: я даю число «з повітря», а не на основі фактів.

**Правило:** перед будь-якою оцінкою часу — **обов'язково:**
1. `wc -l <файли>` — порядок LOC
2. `Grep` залучених функцій — список call-sites (call-sites — місця виклику)
3. Швидкий перегляд складності (вкладені залежності, AI tools — тулзи AI що OpenAI викликає, схема даних)
4. Тільки тоді — число.

Якщо не зробив — кажу Роману «треба прочитати код щоб дати чесне число, 2 хвилини». Він радше зачекає 2 хв ніж отримає брехню.

**Зв'язок з наступним анти-патерном «Заниження естимату міграцій»:** заниження — частковий випадок цього ширшого правила. Якщо я **читаю** код перед оцінкою — заниження не виникне бо побачу реальну складність. «×3» — компенсаційний коефіцієнт для випадків коли все одно даю «з повітря»; правильне рішення — не давати «з повітря» взагалі.

### Заниження естимату міграцій

**Що роблю:** даю оцінку міграції/рефакторингу (UUID, схема, формат, розбиття великого файлу) на 30-45 хв. Реально йде 1.5-3 год.
**Чому погано:** Роман планує сесію на основі моїх цифр. Якщо реальність × 3 — він втомиться, а я обірвусь посеред міграції без коміту (втрата прогресу через stream timeout — обрив зв'язку з браузером при довгому очікуванні).
**Приклади (3 підтверджених кейси):**
- **xGe1H 27.04** (UUID-міграція задач): план «30-45 хв швидкий пілот» → реально ~1.5 год. Бо знайшлося 3 неочевидні блокери (parseInt у DOM, AI tools schema integer, orphan чати).
- **gHCOh 17.04** (рефакторинг finance.js на 6 модулів): аналогічна недооцінка — на ходу виявлялись приховані залежності між підмодулями.
- **finance.js рефакторинг також** мав 5+ обривів stream — правило про checkpoint-коміти у CLAUDE.md саме звідти.

**Правило:** для будь-якої міграції (ID, формат, схема, рефакторинг файлу >500 рядків) — **множу базовий естимат на 3**.
- "Це 30 хв" → кажу Роману "1-1.5 год"
- "Це 1 год" → кажу "2.5-3 год"
- Роман планує сесію реалістично, я не зриваюсь

**Наслідок для робочого процесу:** реалістичний естимат → Роман обирає чи робимо це сьогодні чи відкладаємо на сесію де є час. Краще здивувати швидкою роботою (закінчив за 1 год замість оголошених 1.5) ніж розчарувати затягуванням (обіцяв 30 хв — вийшло 1.5 год).

### Декларативне правило без автоматичного контролю

**Що роблю:** після обговорення з Романом записую стратегічне правило у `CLAUDE.md` (або `lessons.md`) → вважаю задачу закритою → переходжу до наступної. Жодного CI-хука, build-fail, PostToolUse-перевірки не додаю.
**Чому погано:** правило **розкладається за тиждень**. Між сесіями контекст розривається — наступний Claude бачить правило у файлі, але без автоматичного нагадування у момент дії воно не спрацьовує. Рома потім або переоткриває проблему, або виявляє що 10 сесій правило ігнорувалось.
**Підтверджений кейс (UG1Fr 29.04):** правило `t('key', 'fallback')` записано 24.04 у nudNp за порадою Gemini. **За 5 днів і 10 сесій (R5Ejr→kGX6g) нуль використань.** Функція `t()` навіть не створена у `src/core/utils.js`. Виявлено випадково під час Gemini-консультації UG1Fr — Gemini сам сказав «дисципліни не існує, єдиний спосіб — зламати білд».

**Підтверджений ланцюг 3 ітерацій (lesson-reminder → xHQfi → d6Fgh, 30.04):** ще сильніший приклад — той самий патерн повторив сам себе тричі, поки Роман не зловив за руку.
- **Ітерація 1 (lesson-reminder.sh, друга половина квітня):** хук кричав «спитай Романа про урок після `feat:`» — це нагадування для Claude, не блокувач. Між сесіями контекст втрачався, нагадування ігнорувалось.
- **Ітерація 2 (xHQfi 30.04):** Claude посилив hook текст до «авто-додаю у TESTING_LOG.md без питання». **Звіт сесії заявив автоматичне додавання.** Реально лишився тільки підсилений текст-нагадування, не writer. Перевірка д6Fgh показала: 4 `feat:` коміти xHQfi → 1 рядок у TESTING_LOG.md (доданий руками між делегаціями).
- **Ітерація 3 (d6Fgh 30.04):** Роман прямо: «ти ігноруєш правила». Створено `pre-commit-testing-log.js` з `exit 2` при `feat:` без `TESTING_LOG.md` у staged. **Жива перевірка Ph8ym 30.04 (live test 3 кейси):** `feat:`+src без журналу → блок (exit 2 + повний текст), `fix:` → пропуск, `feat:`+src з журналом → пропуск. Третя ітерація — справжній закон.

**Урок про точність звітів сесій:** ітерація 2 — це окремий метаризик. Звіт може містити «оптимістичне узагальнення» («auto-додавання працює») коли реально лишилось підсилене нагадування. **Правило:** перед записом у звіт «X робить Y» — переконатись що X РЕАЛЬНО робить Y через мінімальний smoke-test (`echo` payload у хук → перевірити exit-code), не просто прочитати код. Те саме для tools, фаз, міграцій.

**Правило:** коли пишу нове **стратегічне правило** у `CLAUDE.md` / `lessons.md` (не тактична правка-нагадування на одну сесію) — **одразу** запитую Романа: «Як автоматизуємо контроль?» Варіанти:
- **CI-скрипт що ламає білд** (`scripts/check-X.js` у `build.js`) — найсильніший, не пропустить нічого.
- **PostToolUse hook у `.claude/settings.json`** — миттєвий feedback на змінений файл.
- **SessionStart hook** — нагадування на старті сесії якщо правило стосується процесу.
- **Lint-rule** (для конкретних патернів коду).

**Якщо автоматизація неможлива зараз** — фіксую TODO у `ROADMAP.md` секції відповідної фічі, не у вакуумі. Без TODO правило мовчазно вмирає.

**Тригер для застосування правила:**
- Правило стосується кожного нового рядка коду / кожного нового файлу / кожного тригера → **обовʼязково** автоматизація.
- Правило стосується одноразового інциденту (тип «не повторювати маскот-сову») → можна без автоматизації, бо контекст інший.
- Правило стосується процесу комунікації (тип «розмір відповідей») → SessionStart-хук або `PERSONALITY` секція + перечитування на `/start`.

**Стосується будь-якого майбутнього стратегічного правила, не тільки i18n.** Кандидати які зараз без автоматизації і ризикують повторити долю `t()`:
- Правило 6 (UI smoke-test після міграцій) — без хука, тримається тільки на дисципліні Claude між сесіями.
- Правило «🧹 Edit/Delete/Cleanup у плані фічі» (UG1Fr 29.04) — те саме, без хука.
- Правило «множу естимат міграції на 3» — без хука.

**Як виглядає для Романа:** замість «правило записане, готово» → «правило записане + ось як перевіряємо що його дотримуються: [спосіб]». Якщо я кажу тільки перше — Роман має право відповісти «де автоматизація?»

### Викидати гачки разом з фічею

**Що роблю:** коли тема стратегічна і я бачу «велику фічу» — мозок схильний обрізати **всю гілку рішень** одним «давай відкладемо». Зклеюю в одне рішення дві різні речі: **сама фіча** (дорого, місяці) і **дешева підготовка до неї** (години, корисна вже зараз).
**Чому погано:** Роман втрачає підготовку безкоштовно. Чим довше працюємо без гачків — тим дорожчий буде поворот до фічі коли час прийде.
**Підтверджений кейс (UG1Fr 29.04):** обговорення англійської локалізації. Я запропонував «відкласти все до Supabase»: і переклад 356+ рядків UI (8-15 год, нема сенсу без хмари), і функцію `t(key, fallback)` + CI-скрипт `check-i18n.js` (3-4 год, ламає білд при необгорнутому українському тексті — корисно вже зараз). Роман миттєво виправив: «фічу — так, гачки робимо зараз».

**Правило:** коли пропоную відкласти стратегічну фічу — **розділяю** на два запитання, ставлю окремо:
1. Сама фіча (X) — відкласти чи робити зараз?
2. Підготовча інфраструктура до X (Y) — відкласти чи робити зараз?

Не «давай відкладемо все» — це заокруглення яке коштує підготовки. Питання має бути **конкретним**: «гачки теж відкласти, чи тільки саму фічу?»

### Не повертай видалену філософію через 24 год (nliW8 13.05.2026, B-180)

**Що роблю:** додаю у tool description / промпт «зручну підказку» (hardcoded example, fuzzy hint, вбудована мапа) щоб AI «менше помилявся». Не перевіряю `git log -S` — чи саме цю філософію не видалили раніше з конкретної причини.
**Чому погано:** існуюча архітектура «AI бере тільки з контексту юзера» прибирається непомітно — «вбудовані» підказки виграють у AI бо вони присутні у системному промпті, а юзерські категорії — у динамічному контексті. Через 24 год AI знов вигадує. Виправлення = повернути жорстке «🚫 не вигадуй» + чистити hardcoded → витрачено стільки ж часу скільки треба було просто прочитати git blame.
**Підтверджений кейс (nliW8 13.05.2026, B-180):**
- **PJi7l 08.05** (`7e9ea7b`): ослабили `save_finance.subcategory` з «ЗОБОВ'ЯЗАНИЙ» → «ОПЦІЙНЕ + не питай юзера», бо AI спам-перепитував. Філософія: «бери з контексту юзера, сумнів — пропусти».
- **Phase 1 nliW8 13.05** (`06efd93`, моя): додав «вбудовані fuzzy-підказки» у tool description: `Їжа→(кава/капучино=Кафе; обід=Ресторан)`, `Транспорт→(бензин=Паливо)`. Думав «допомагаю AI». Не зробив `git log -S "вбудовані"` — не побачив що це повертає те від чого пішли.
- **Симптом наступного дня:** AI почав ігнорувати юзерські категорії взагалі — бачить hardcoded мапу у системному промпті, юзерські у динамічному контексті програють. Юзер: «AI вигадує підкатегорії».
- **Phase 2 nliW8 13.05** (`6cedd3d`+`51d6a2d`+`91dccfb`): прибрав «вбудовані», повернувся до жорсткого «🚫 не вигадуй» + code-side fallback «Інше» + chip-діалог `[Створити "X"][Лишити в Інше]`. Витратив 1.5 год на повернення туди де PJi7l був 5 днів назад.

**Правило:** перш ніж додавати у `src/ai/prompts.js` будь-яку **hardcoded мапу / список / приклад / fuzzy-hint** у tool description чи системному промпті — `git log -S "ключове_слово_з_твого_додавання" --since="60 days ago" -- src/ai/prompts.js`. Якщо знайдено комміт що видаляв подібне з причиною у message → ПРОЧИТАЙ ту причину перш ніж додавати знову. Якщо причина досі актуальна — НЕ додавай.

**Тригер для застосування:**
- Будь-який Edit у `src/ai/prompts.js` що додає `→`-стрілки, перелік прикладів, словник «X означає Y», fuzzy-мапу.
- Будь-яке «AI забув / не зрозумів / не вибрав правильну» — спершу перевір чи раніше це працювало через інший механізм, чи дійсно треба hardcode у промпт.
- Сигнал болю: ловлю себе на думці «зараз додам приклад щоб допомогти AI» — STOP, спочатку git log.

**Кандидат на автоматизацію (TODO):** PostToolUse hook на Edit `src/ai/prompts.js` який при додаванні `→` чи `;`-розділених прикладів у tool description робить `git log -S` пошук схожих видалених рядків за 60 днів і нагадує перевірити причину видалення. Поки декларативно — записано тут і у `CLAUDE.md` правило 12 (детерміноване vs природна мова).

---

## 📋 Журнал рішень (чому одне а не інше)

### 10.05.2026 dyhJu — Edit вимагає Read автоматизовано через PreToolUse hook

**Рішення:** PreToolUse-хук `pre-edit-read-check.js` блокує Edit якщо файла немає у Read-/Write-/Bash-cat-логу поточної сесії (transcript JSONL).
**Альтернатива:** залишити декларативне правило 3 у CLAUDE.md без автоматизації + сподіватись на дисципліну.
**Чому:** 4 епізоди порушення у BqTWF + 3 у 64CXo (`old_string not found` build broken) — той самий патерн що i18n до m4Q1o, smoke-test до oknnM. Декларативне правило без хука розкладається. Підхід: читання transcript JSONL замість окремого state-файлу (як `check-estimate-without-read.js`) — session-scoped автоматично, без cleanup між сесіями. Bypass `read-bypass: ok` для рідких false positive (sub-агент Council прочитав → Голова Edit за знахідкою), але CLAUDE.md «🔍 ГІПОТЕЗА АГЕНТА ≠ ФАКТ» каже що краще все одно зробити свій Read. 6 smoke-test сценаріїв пройшло (Read→Edit pass, no-Read→Edit block, Write створив→Edit pass, Bash cat→Edit pass, Write tool→pass, bypass-фраза→pass з warning).

### 03.05.2026 iWyjU — Самотест видалено + statusline через assistant.usage

**Рішення:** видалити `start-self-test.sh` повністю замість лагодити.
**Альтернатива:** покращити питання самотесту, додати ще один рівень перевірки, додати штрафи за неправильну відповідь.
**Чому:** Рома спіймав на тому що я склав самотест механічно цитуючи правила з тренування — CLAUDE.md і ROADMAP при цьому не Read'нув. Самотест перевіряв ПРАВИЛА (відомі з тренування Claude), не РЕАЛЬНЕ ЧИТАННЯ файлів. Корінь — це не неправильні питання, а сам механізм: будь-який текстовий тест я можу склеїти без читання. Лагодити симптом (нові питання) безглуздо. Замість — пряма вимога Read CLAUDE.md повністю у `start.md` Крок 1 + хук-нагадування на SessionStart. Якщо проб'ю знов — пишемо PreToolUse блокер. Правило 5 «корінь vs симптом» у дії.

**Рішення:** statusline + context-warning беруть цифру з останнього `assistant.message.usage` у транскрипті.
**Альтернатива:** залишити підрахунок через `wc -c` файлу `.jsonl` поділеного на ~3 байти/токен (стара логіка хука).
**Чому:** auto-compaction не змінює файл `.jsonl` — старі повідомлення залишаються там, але у пам'яті моделі вони замінені на summary. Файл росте далі, реальний контекст менший. Звідси «99%» при справжніх 34%. Правильна цифра — це `input_tokens + cache_read_input_tokens + cache_creation_input_tokens` останнього assistant turn (те саме що `/context`). Створено `lib/compute-context-pct.sh` як ОДНЕ джерело правди — щоб statusline і context-warning не розходились (правило 5 «корінь vs симптом» — НЕ дублювати логіку у двох місцях).

### 02.05.2026 bOqdI/BqTWF — Council механізм + регресія архівації

**Рішення (bOqdI):** Council = 24-рядкова секція у `CLAUDE.md`, не скіл, без логу/метрик/тріад/граматичних рамок.
**Альтернатива що була відкинута:** повна спека v1.1 з 5 ролями + #SkipReason + conditional synthesis Голови + 👍/👎 метрика смерті у `COUNCIL_LOG.md` + Тріада Незворотності + Anchor Rot — результат 4 ітерацій з Gemini.
**Чому:** Роман зупинив на 5-й ітерації — «Ми ускладнили лишнє». Перша версія була правильна, кожна ітерація додавала бюрократії яку довелось викинути. Принцип «менше = більше». Концепт `_archive/COUNCIL_CONCEPT.md` лишився як ілюстрація overengineering.

**Рішення (BqTWF):** правило архівації найстаршого блоку SESSION_STATE перенесено з `/finish` Phase 0 на `/start` Крок 2.5.
**Альтернатива:** фіксити регресію самого правила у `/finish` (whitelist, поріг, явний reminder перед /finish).
**Чому:** корінь регресії — на `/finish` контекст вже забитий, правило працює тільки коли контекст <75%. 3 пропуски поспіль (C8uQD 27.04 → rKQPT 02.05 → bOqdI 02.05) → 4 активних блоки замість ≤2. Замість лагодження симптому (зробити правило «голоснішим» наприкінці забитого контексту) — переніс тригер на момент коли контекст свіжий (`/start` Крок 2.5 з grep активних блоків + попередження Роману якщо >2). Урок «корінь vs симптом» з 6ANWm у дії.

### 20.04.2026 g05tu — Рефакторинг документації

**Рішення:** переміщення блоків у спеціалізовані файли, не стиснення формулювань.
**Альтернатива що була відкинута:** стискати тексти щоб економити токени.
**Чому:** Роман читає документи теж — це його зовнішня пам'ять проекту. Стиснення = втрата контексту для Романа. Переміщення без втрати тексту зберігає деталі і зменшує стартове читання для Claude.

**Рішення:** один `lessons.md` замість трьох файлів PATTERNS/ANTI_PATTERNS/DECISION_LOG.
**Альтернатива:** три паралельні журнали.
**Чому:** один файл = одне місце підтримки. Три файли розсинхронізуються. Роман прямо сказав "давай в один".

**Рішення:** `INDEX.md` робимо ОСТАННІМ у рефакторингу (Фаза 4).
**Альтернатива:** робити першим.
**Чому:** індекс посилається на файли. Якщо створимо його раніше за файли — посилання у порожнечу. Робимо коли всі файли вже на своїх місцях.

**Рішення:** не робити "людський фактор" хуки (детекція "не так", "поганий" → інʼєкція "Роман засмучений").
**Альтернатива:** додати 2 хуки категорії "людський фактор".
**Чому:** Роман сам прибрав — "не треба". Контроль емоцій через хуки = мания контролю. Характер будується через PERSONALITY-секцію `lessons.md`, не через тригери.

### 19.04.2026 rSTLV — Відкат маскот-сови

**Рішення:** повне видалення OWL маскот-системи (sprite, PNG, SVG крило, flipbook).
**Альтернатива:** доробити анімацію.
**Чому:** складно, результат не виправдовує зусилля. Повернемось коли буде готовий художній ассет (Rive-файл або багатошарова SVG). Поки — простий емодзі 🦉.

### 19.04.2026 JvzDi — Прибрати `set_theme` плацебо

**Рішення:** видалити tool `set_theme` з `UI_TOOLS` повністю.
**Альтернатива:** доробити реальну темну тему і залишити tool.
**Чому:** плацебо-tool руйнує довіру гірше ніж відсутність фічі. Юзер каже "Зроби темну" → сова "Темна тема." але нічого не змінилось. Повернемо коли буде реальна темна тема.

### 19.04.2026 QV1n2 — Вечір 2.0 замість доробки старого

**Рішення:** переписати концепцію Вечора повністю на "ритуал закриття дня з OWL".
**Альтернатива:** доробити існуючий dashboard з кільцем продуктивності до 100%.
**Чому:** старий показував "0% важкий день" о 14:12 коли день ще триває — брехливий, дублював Я-вкладку. Новий — блокування до 18:00 + жива розмова з совою.

### 17.04.2026 gHCOh — Розбиття finance.js на 6 модулів

**Рішення:** виділити 6 окремих файлів з backward-compat через re-exports.
**Альтернатива:** залишити один великий файл (було ~1300 рядків).
**Чому:** один файл складно правити, легко ламається при конкурентних змінах. 6 модулів — чітка відповідальність, легше тестувати, швидше Edit.

### 15.04.2026 jMR6m — `nm_allergies` без `severity`

**Рішення:** почати з простої структури `{id, name, notes, createdAt}`.
**Альтернатива:** одразу додати `severity: mild|severe` і різний UI.
**Чому:** Роман спочатку поговорить з другом-алергіком, потім додамо real-world знання. Не передбачати без даних. Розширення → `ROADMAP.md` `💡 Ideas` "Здоровʼя — розширення блоку алергій".

---

_Останнє оновлення: 2026-04-29 (SK6E2 — патерн «створення/зміна хука у `.claude/hooks/` → штучний тригер → перевірка блокування → false positive перевірка → коміт». Інцидент oknnM з PostToolUse→PreToolUse у `settings.json` як підтверджений кейс)._

_Попереднє оновлення: 2026-04-29 (oknnM — анти-патерн «оцінка часу без читання коду» — об'єднує заниження і завищення естимату через єдиний корінь «не читаю код»)._

_Попереднє оновлення: 2026-04-29 (m4Q1o — анти-патерн «декларативне правило без автоматичного контролю» з brain-уроку UG1Fr + патерни делегування Gemini, викидати гачки разом з фічею, правка-нагода для i18n)._
