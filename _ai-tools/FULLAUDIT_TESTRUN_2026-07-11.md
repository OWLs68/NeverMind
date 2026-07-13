# /fullaudit — тестовий прогін 11.07.2026 (звіт + знахідки)

> Збережено на всяк випадок. Скіл: `.claude/commands/fullaudit.md`. Run ID `wf_5911135e-aba`.
> **Прогін НЕ завершено штатно** — вичерпано сесійний ліміт підписки на ~92-му агенті.

## Тверді цифри (заради чого був тестовий прогін)
- **92 агенти** (стеля 100 дотримана — не вона вузьке місце), усі `effort: high`.
- **~2,64 млн токенів**, 601 tool-calls, ~49 хв. **≈28,7К токенів/агент.**
- **43 done / 49 error.** Усі 49 error = «You've hit your session limit» — вичерпано вікно підписки.
- 14 find-агентів → **46 знахідок**. Фінал (з бага класифікатора, див. нижче): 10 confirmed, 1 unconfirmed, 3 unverified-low, 32 «discarded».

## 🔴 Вада скрипта (виявлена, ПОЛАГОДЖЕНА 11.07)
**Усі 32 «discarded» мали 0 вердиктів** — їхні verify-агенти впали на ліміті, `agent()` повернув null,
`.filter(Boolean)` викинув → `cantRefute=0` → `classify` дала `discarded`. Тобто **32 знахідки
відкинуто ХИБНО** — їх ніхто не спростовував, верифікація просто не запустилась. Порушено fail-open.
**Фікс:** verify-null → `under-verified` (жива, чесно позначена), не discard. Реально верифіковано
лише ~14 знахідок (до ліміту), решта — сирі find-результати.

## ✅ 10 CONFIRMED (R=3/R=2 — встигло до ліміту)

**🎯 Системний КЛАС (найцінніше) — «порожній fuzzy-fallback → перша сутність»:**
`''.slice(0,6)=''` → `arr.find(x=>x.name...includes(''))===arr[0]` завжди істина, коли AI дав
неіснуючий/галюцинований UUID а name/query undefined (tool-схема передає лише `*_id`):
- `src/core/execute-action.js:228` **delete_habit** (HIGH R=3) — «видали звичку X» з чужим id → мовчки видаляє ПЕРШУ звичку. `delete_task` має guard `nameQ.length>=3` (QDIGl 04.05), `delete_habit` — НІ. Діє в 7 з 8 чатів (Evening — власний безпечний handler).
- `src/core/execute-action.js:168` **edit_task** (MED R=2) — зміни (dueDate/priority) до ПЕРШОЇ задачі.
- `src/core/execute-action.js:144` **edit_habit** (MED R=2) — days/details до ПЕРШОЇ звички.
→ **Системний фікс:** guard `nameQ.length>=3` (або `if(!h) return` без fuzzy) у ВСІХ delete_*/edit_* execute-action. Найвищий пріоритет із знайденого.

**Інші HIGH R=3:**
- `src/core/boot.js:139` + `src/tabs/habits.js:419` + `:744` **perf** — кожне save задачі/звички → повний ре-рендер 7 таб-бордів × N+1 `JSON.parse(localStorage)` (`isEntityRelevant`, `getHabitStreak/Pct/WeekDays` — гетери без кешу). Сотні-тисячі парсів на один тап.
- `src/ai/tool-dispatcher.js:209` **consistency** — `delete_project` маршрутизований лише в Inbox (inbox.js:437); спільний диспетчер 7 чатів мовчки не діє (клас B-174 / «один мозок»).
- `src/tabs/evening-chat.js:211` **consistency** — `dispatchEveningTool` повертає `{ok:false}`, викликач ігнорує → тихий unsupported.
- `src/data/tool-filter.js:27` **tool-filter** — `selectRelevantTools` посилається на неіснуючі імена tools (`add_finance_category`/`rename_finance_category`).
- `src/tabs/me.js:590` **XSS** — `report.monthLabel` у `innerHTML` без `escapeHtml`, значення з AI tool-args (`show_monthly`) → рендер-injection.

## ⚠️ 1 UNCONFIRMED (R=1, вартує 2-го погляду)
- `src/core/execute-action.js:680` **set_reminder** (MED) — суто-часовий запит («нагадай о 8 ранку») будує дату через UTC `toISOString`, можливий зсув від локального часу.

## 🟠 32 «discarded» = НАСПРАВДІ НЕДОВЕРИФІКОВАНІ (verify впав, НЕ спростовано)
Сирі find-знахідки, верифікація не запустилась. НЕ довіряти як підтвердженим, але й не викидати —
повторити верифікацію коли ліміт відновиться. Серед них правдоподібні: orphan-звʼязки
(`execute-action.js`, `projects.js`, `tasks.js`), pattern-drift (`boot.js`, `inbox-feed.js`,
`calendar.js`), ios (`sw.js`, `boot.js`), dry (`finance-chat.js`, `notes.js`), gate3 (`calendar.js`).

## 📌 Уроки (також у lessons.md 11.07)
1. **error ≠ спростування** — агент що впав ≠ знахідка неправдива. Fail-open: verify-null → under-verified.
2. **Токен/сесійний ліміт — справжня стеля**, не кількість агентів. Безпечна стеля разового прогону ≈ 20-30 high, не 100. Великий аудит дробити по сесіях / find→verify окремо / gate на budget.
3. **Повний high-аудит цього застосунку ≈ 2,6М+ токенів = більше одного сесійного вікна.** Планувати багатосесійно.
