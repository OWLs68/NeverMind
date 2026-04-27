# NeverMind — Відомі баги

> **Правило ротації:** у файлі зберігаються **всі відкриті** баги + **закриті у 2 останніх активних сесіях** (згідно `_ai-tools/SESSION_STATE.md`).
> При виклику `/finish` у новій сесії — закриті з найстаршої з 2 активних переносяться у [`_archive/BUGS_HISTORY.md`](_archive/BUGS_HISTORY.md).
> Формат ID: **B-XX** — номер, сортуються хронологічно.
> Використання: `/fix B-XX` — скіл Claude прочитає цей файл і знайде опис бага.

---

## 🔴 Критичні (зламана функціональність)

_Немає відкритих критичних багів станом на 27.04.2026 (Aps79)._

---

## 🟡 Середні (є обхідний шлях або рідко трапляється)

_Немає відкритих середніх багів._

---

## 🟢 Дрібні (косметика, не ламає функціонал)

_Немає відкритих дрібних багів._

---

## ✅ Закриті (активні сесії)

_Зберігаються закриті у 2 останніх активних сесіях (Aps79 + xGe1H). Старіші → [`_archive/BUGS_HISTORY.md`](_archive/BUGS_HISTORY.md)._

### Сесія Aps79 (27.04.2026) — 5 багів закрито

| # | Файл | Опис | Як виправлено |
|---|------|------|----------------|
| B-105 | `src/ai/prompts.js` + `src/tabs/habits.js` | Сова видалила «Зареєструватися на Upwirk» замість закрити при «Поміняв номер на склад» | Промпт чату Продуктивності не мав правила про минулий час → модель фузі-матчила «поміняв номер» на «Upwirk реєстрація» через спільний номер → `delete_task`. **FIX:** правило про минулий час у `sendTasksBarMessage` («поміняв/подав/зробив» → `complete_task` на ЯВНУ задачу або текст-питання, НІКОЛИ delete без слова «видали/забудь»). Посилений опис tool `delete_task` у INBOX_TOOLS — поширюється на всі 8 чатів. Коміт `f394b40`. |
| B-106 | `src/tabs/habits.js` (processUniversalAction + sendTasksBarMessage) | Сова замовкла на 3 повідомленнях у чаті Продуктивності, точки `...` назавжди | AI кликав `complete_task`/`complete_habit` через tool_calls. Диспетчер йшов через `_toolCallToUniversalAction` → `processUniversalAction` де ОБРОБНИКА НЕ БУЛО (тільки у fallback text-JSON шляху). Жодного `addMsg` → typing dots не зникали. **FIX 1:** додано `complete_task`/`complete_habit`/`add_step` у `processUniversalAction`. **FIX 2 (safety net):** якщо `dispatchChatToolCalls` повернув false — показати fallback `msg.content` або «Не зрозуміла дію». Гарантує що typing dots завжди зникнуть. Коміт `f394b40`. |
| B-107 | `src/tabs/tasks.js` + `index.html` | Велика синя картка з AI-порадами зверху списку при створенні задачі | Стара фіча `askAIAboutTask` викликалась з `saveTask`, заповнювала блок `tasks-ai-comment` AI-коментарем на 4+ речення. **FIX:** видалено виклик `askAIAboutTask` з `saveTask` + саму функцію + HTML-блок з `index.html`. Імпорти AI-функцій лишено (використовуються в інших місцях). Коміт `f71b0b8`. |
| B-108 | `src/tabs/tasks.js` (5 onclick) + `src/tabs/evening.js` (2 onclick) + handlers | НОВИЙ після xGe1H — тап ✓ рукою на задачі НЕ ПРАЦЮВАВ після UUID-міграції | HTML `onclick="toggleTaskStatus(${t.id})"` з UUID-string давав `onclick="toggleTaskStatus(abc-def-123)"` → JS парсить як арифметику ідентифікаторів `abc - def - 123` → ReferenceError. Тап не доходив до handler. Юзер мусив закривати задачі через AI у чаті. **FIX:** обгортка `'${t.id}'` у одинарні лапки у 5 місцях (taskCardClick, toggleTaskStatus, toggleTaskStep, rescheduleTaskTomorrow/Week) + `String()` typesafety у `toggleTaskStatus/Step/openEditTask/_rescheduleTask` + AI complete_task тепер викликає експортовану `toggleTaskStatus` → 3-фазна анімація закриття як ручний тап. Коміт `2eb9347`. |
| B-80 | `src/tabs/notes.js` + `style.css` | Свайп-видалення папки/нотатки — стрибок чіпів зверху на 50-250мс | При тапі кошика `onDelete` викликав `saveNotes+renderNotes` миттєво → DOM перерисовувався поки swipe-transform на старому wrapEl ще активний → перша папка/нотатка залазила під чіпи OWL-баблу зверху. **FIX:** дзеркало `task-completing` патерну. Новий CSS клас `.swipe-deleting` (opacity:0 + max-height:0 + margin:0 з transition 0.25-0.28s) + хелпер `_animateSwipeRemoval(wrap, doRemove)` у `notes.js` — фіксує поточну висоту inline, додає клас через 30мс, через 310мс виконує save+render+undoToast. Працює і для нотаток і для папок. Коміти `ee2afad`, `f636d49` (syntax fix). |

### Сесія C8uQD (27.04.2026) — OWL Silence + Pruning Engine 3 фази

| # | Файл | Опис | Як виправлено |
|---|------|------|----------------|
| B-100 | `src/ai/ui-tools.js` (новий tool) + `src/owl/inbox-board.js` (`shouldOwlSpeak`) + `src/ai/prompts.js` (UI_TOOLS_RULES) + `src/ai/core.js` (getAIContext silence flag) | Сова не реагує на пряме «відступи» — iPhone 22-23.04 скрін: юзер написав «Не доставай з задачами» → сова відповіла «Давай зосередимось на вечері. Що ще можу запропонувати?». | **Закрито структурно через Silence Engine (Фази 1+3):** Замість додавання нових промптових тригер-слів («не доставай / відчепись» — модель інерційно ігнорує) — введено AI-tool `request_quiet(duration_hours)` який пише `nm_owl_silence_until` у localStorage. Чек тиші у `shouldOwlSpeak()` блокує всі 4 канали сови (Inbox-табло, табла вкладок, Brain Pulse, chat-followup). 11 тригер-фраз у `UI_TOOLS_RULES` мапляться на tool-call (юзер каже → модель викликає tool → ключ записаний → guard блокує). Фаза 3 додала `[ВАЖЛИВО — РЕЖИМ ТИШІ]` у `getAIContext()` — у промпт всіх 8 чатів — який забороняє пропонувати нові дії під час тиші, лишаючи відповіді на прямі питання. Виявлено v2vYo 24.04, фікс C8uQD 27.04. Коміти `044bc7f`, `d89ef79`, `baf91bc`. |
| B-102 | `src/owl/inbox-board.js` (`shouldOwlSpeak`) + `src/ai/ui-tools.js` (`request_quiet` handler) | Табло не реагує на настрій у чаті — юзер у чаті пише «не доставай», сова продовжує показувати проактивні пропозиції про задачі і звички. | **Закрито структурно через Silence Engine (Фаза 1):** Замість додавання USER_STATE сигналу у Brain Pulse (V3 Фаза 2 з ROADMAP — складніший підхід) — Silence Engine вирішує проблему вище за рівнем. Коли юзер пише «дай спокій» → tool `request_quiet` → `nm_owl_silence_until` → перший рядок `shouldOwlSpeak()` повертає `{speak: false, reason: 'silence'}` ДО того як Brain Pulse дійде до збору сигналів. Не треба новий тип сигналу — просто mute усієї системи. USER_STATE як окрема концепція може повернутись пізніше для тонших нюансів («втомився» без прямого «дай спокій»), але прямий запит тепер обробляється архітектурно. Виявлено v2vYo 24.04, фікс C8uQD 27.04. Коміт `044bc7f`. |

### Сесія UVKL1 (26.04.2026)

| # | Файл | Опис | Як виправлено |
|---|------|------|----------------|
| B-103 | `src/tabs/calendar.js` (helper) + 8 call-sites: `inbox.js` (4 місця), `habits.js` (3 місця), `evening-actions.js` (2 місця) | Дублікати подій у Календарі. AI повертав 2 `create_event` tool_calls в одній відповіді → дві однакові події. | Створено `addEventDedup(ev)` у `calendar.js` — перевіряє чи вже є подія з тією ж датою+часом+назвою за останні 60 сек, якщо так — повертає `{added:false, existing}` і не додає другу. Замінено всі прямі `events.unshift(); saveEvents();` на `addEventDedup(ev)`. **Знайдено 8 місць замість 6** як писалось у `BUGS_VERIFICATION.md` — додатково 2 у `inbox.js` (`processSaveAction` fallback + категорія 'event'). При дублі чат-бар повідомляє «Така подія вже є в календарі». Виявлено v2vYo 24.04, фікс UVKL1 26.04. |
| B-101 | `src/ai/core.js` (helper) + 9 call-sites: `evening-chat.js` (2), `finance-chat.js`, `habits.js`, `health.js`, `notes.js` (2), `projects.js`, `tasks.js` | Туманне «Щось пішло не так» на будь-яку помилку запиту — юзер не знав, повторювати чи це баг. | Створено `handleChatError(addMsg)` у `core.js`. Якщо `navigator.onLine === false` → «📡 Мережа не відповіла. Перевір інтернет і повтори повідомлення.» Інакше → «Щось пішло не так. Спробуй ще раз.» (явна пропозиція дії). Замінено у 9 місцях прямий `addMsg('agent', 'Щось пішло не так.')` на helper. **Свідомий компроміс зі плану `BUGS_VERIFICATION.md`:** початковий план мав чіп-кнопку «Повторити» — пропущено бо 9 чатів мають різні сигнатури `addMsg(...)`, єдиний чіп-action = окрема архітектурна задача. Текст-пропозиція дії дає 80% UX без ризику. Виявлено v2vYo 24.04, фікс UVKL1 26.04. |

### Сесія R5Ejr (24.04.2026)

| # | Файл | Опис | Як виправлено |
|---|------|------|----------------|
| B-104 | `src/tabs/tasks.js` + `src/tabs/habits.js` + `src/owl/proactive.js` | Stale OWL board на вкладці Задач — сова повторювала «закрий 3 задачі: X, Y, Z» попри те що юзер щойно їх закрив тапом ✓. Фікс B-98 (watchdog прапорця) НЕ допомагав — генерація проходила успішно, але з поганим контекстом. | **2 причини:** (1) у 4 з 8 місць де `status='done'` ставилось БЕЗ `completedAt` (tasks.js:171 toggleTaskStep, tasks.js:192 toggleTaskStatus, habits.js:1373 AI complete_step, habits.js:1383 AI complete_task) — `getAIContext` блок «Нещодавно ЗАКРИТІ задачі» фільтрує по `t.completedAt` і їх пропускав. (2) У `getTabBoardContext('tasks')` не було блоку «Нещодавно закриті» (тільки у `_getInboxBoardContext`). Фікс: усі 4 місця тепер ставлять `completedAt+updatedAt` при 'done', видаляють `completedAt` при reopen. Додано блок «Нещодавно ЗАКРИТІ задачі (НЕ повторюй з boardHistory)» у tab-контекст. Коміт `3e3892a`. |

### Сесія v2vYo (24.04.2026)

| # | Файл | Опис | Як виправлено |
|---|------|------|----------------|
| B-97 | `src/ai/prompts.js` (+ `src/tabs/habits.js`) | Чат Задач відмовляв «це подія, а не задача» на «Прийом у лікаря відміни» попри наявність `delete_event` у `INBOX_TOOLS` | Доданий `GLOBAL_TOOLS_RULE` — спільний блок «інструменти глобальні у всіх 8 чатах» + явний фузі-матч паттерн на скасування події («Прийом у лікаря відміни» + у контексті `[ID:123] "Прийом у лікаря"` → `delete_event(123)`). Підключений у чаті Задач (`habits.js` перед `REMINDER_RULES`). Готовий до пропаганди у 7 інших чатів якщо на iPhone спрацює. Глибший архітектурний фікс (Gemini-діагноз: Context Segmentation Failure) — через V3 Фазу 1 (`_reasoning_log`). Коміт `9e065a1`. |
| B-98 | `src/owl/proactive.js` (`generateBoardMessage`) | OWL табло не оновлювалось 8+ годин попри 5+ тригерів `[OWL board] stale message detected, forcing generation`. Прапорець `_boardGenerating[tab]` залипав `true` бо не було `try/finally` на все тіло функції — виключення у prompt-збірці (lines 624-745) або hung fetch без помилки лишали прапорець назавжди | Обгорнуто все тіло функції у `try { ... } finally { clearTimeout(watchdog); _boardGenerating[tab] = false; }` + додано watchdog `setTimeout(60s)` який примусово скидає прапорець і робить `abort()` якщо прапорець висить >60 сек. Коміт `5b25374`. |
| B-99 | `src/owl/brain-pulse.js:42` | У логах `[brain-pulse] skip:` іноді з пустою причиною після двокрапки — заважало діагностиці | Додано fallback `judge.reason \|\| 'unknown'` у `console.log`. Коміт `5b25374`. |

_Закриті у сесіях Gg3Fy / EWxjG / NRw8G / JvzDi / 6GoDe та старіші — у [`_archive/BUGS_HISTORY.md`](_archive/BUGS_HISTORY.md)._

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
