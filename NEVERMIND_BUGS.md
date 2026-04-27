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

_Зберігаються закриті у 2 останніх активних сесіях (hEtjy + Aps79). hEtjy не закрила багів — лише мета-оновлення документації. Старіші → [`_archive/BUGS_HISTORY.md`](_archive/BUGS_HISTORY.md)._

### Сесія Aps79 (27.04.2026) — 5 багів закрито

| # | Файл | Опис | Як виправлено |
|---|------|------|----------------|
| B-105 | `src/ai/prompts.js` + `src/tabs/habits.js` | Сова видалила «Зареєструватися на Upwirk» замість закрити при «Поміняв номер на склад» | Промпт чату Продуктивності не мав правила про минулий час → модель фузі-матчила «поміняв номер» на «Upwirk реєстрація» через спільний номер → `delete_task`. **FIX:** правило про минулий час у `sendTasksBarMessage` («поміняв/подав/зробив» → `complete_task` на ЯВНУ задачу або текст-питання, НІКОЛИ delete без слова «видали/забудь»). Посилений опис tool `delete_task` у INBOX_TOOLS — поширюється на всі 8 чатів. Коміт `f394b40`. |
| B-106 | `src/tabs/habits.js` (processUniversalAction + sendTasksBarMessage) | Сова замовкла на 3 повідомленнях у чаті Продуктивності, точки `...` назавжди | AI кликав `complete_task`/`complete_habit` через tool_calls. Диспетчер йшов через `_toolCallToUniversalAction` → `processUniversalAction` де ОБРОБНИКА НЕ БУЛО (тільки у fallback text-JSON шляху). Жодного `addMsg` → typing dots не зникали. **FIX 1:** додано `complete_task`/`complete_habit`/`add_step` у `processUniversalAction`. **FIX 2 (safety net):** якщо `dispatchChatToolCalls` повернув false — показати fallback `msg.content` або «Не зрозуміла дію». Гарантує що typing dots завжди зникнуть. Коміт `f394b40`. |
| B-107 | `src/tabs/tasks.js` + `index.html` | Велика синя картка з AI-порадами зверху списку при створенні задачі | Стара фіча `askAIAboutTask` викликалась з `saveTask`, заповнювала блок `tasks-ai-comment` AI-коментарем на 4+ речення. **FIX:** видалено виклик `askAIAboutTask` з `saveTask` + саму функцію + HTML-блок з `index.html`. Імпорти AI-функцій лишено (використовуються в інших місцях). Коміт `f71b0b8`. |
| B-108 | `src/tabs/tasks.js` (5 onclick) + `src/tabs/evening.js` (2 onclick) + handlers | НОВИЙ після xGe1H — тап ✓ рукою на задачі НЕ ПРАЦЮВАВ після UUID-міграції | HTML `onclick="toggleTaskStatus(${t.id})"` з UUID-string давав `onclick="toggleTaskStatus(abc-def-123)"` → JS парсить як арифметику ідентифікаторів `abc - def - 123` → ReferenceError. Тап не доходив до handler. Юзер мусив закривати задачі через AI у чаті. **FIX:** обгортка `'${t.id}'` у одинарні лапки у 5 місцях (taskCardClick, toggleTaskStatus, toggleTaskStep, rescheduleTaskTomorrow/Week) + `String()` typesafety у `toggleTaskStatus/Step/openEditTask/_rescheduleTask` + AI complete_task тепер викликає експортовану `toggleTaskStatus` → 3-фазна анімація закриття як ручний тап. Коміт `2eb9347`. |
| B-80 | `src/tabs/notes.js` + `style.css` | Свайп-видалення папки/нотатки — стрибок чіпів зверху на 50-250мс | При тапі кошика `onDelete` викликав `saveNotes+renderNotes` миттєво → DOM перерисовувався поки swipe-transform на старому wrapEl ще активний → перша папка/нотатка залазила під чіпи OWL-баблу зверху. **FIX:** дзеркало `task-completing` патерну. Новий CSS клас `.swipe-deleting` (opacity:0 + max-height:0 + margin:0 з transition 0.25-0.28s) + хелпер `_animateSwipeRemoval(wrap, doRemove)` у `notes.js` — фіксує поточну висоту inline, додає клас через 30мс, через 310мс виконує save+render+undoToast. Працює і для нотаток і для папок. Коміти `ee2afad`, `f636d49` (syntax fix). |

_Закриті у сесіях C8uQD / UVKL1 / R5Ejr / v2vYo / Gg3Fy / EWxjG / NRw8G / JvzDi / 6GoDe та старіші — у [`_archive/BUGS_HISTORY.md`](_archive/BUGS_HISTORY.md)._

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
