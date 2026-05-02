# NeverMind — Відомі баги

> **Правило ротації:** у файлі зберігаються **всі відкриті** баги + **закриті у 2 останніх активних сесіях** (згідно `_ai-tools/SESSION_STATE.md`).
> При виклику `/finish` у новій сесії — закриті з найстаршої з 2 активних переносяться у [`_archive/BUGS_HISTORY.md`](_archive/BUGS_HISTORY.md).
> Формат ID: **B-XX** — номер, сортуються хронологічно.
> Використання: `/fix B-XX` — скіл Claude прочитає цей файл і знайде опис бага.

---

## 🔴 Критичні (зламана функціональність)

| ID | Файл | Симптом | Аналіз |
|---|---|---|---|
| **B-118** | `src/tabs/projects.js:174` (back-link у workspace) | Кнопка «< Проекти» у воркспейсі проекту не працює — тап нічого не робить, юзер залипає всередині картки проекту. iPhone v563, скрін 21:40. | `closeProjectWorkspace` експортована у window (`projects.js:573`), функція тривіальна (`activeProjectId=null; renderProjectsList()`). Корінь скоріше у CSS: back-кнопка без `position:relative; z-index:N`, hit-area тільки 16×16 (svg) + текст без padding. OWL board overlay зверху (з чіпами «Запишу підсумок / Нічого більше / Поговорити» у вечірньому підсумку — з proactive.js) може мати невидимий розширений елемент що перехоплює клік. **Фікс:** `position:relative; z-index:10; padding:8px 4px; margin:-8px -4px 4px -4px` (більша hit-area + гарантований z-index вище за overlay). |
| **B-119** | `src/tabs/inbox.js:96` (`addInboxChatMsg`) | Чіпи clarify-guard ([У щоденник] / [Як момент] / [Не зберігати]) рендеряться у Inbox чаті але візуально обрізаються знизу контейнером. iPhone v563, скрін 21:52. | `el.scrollTop = el.scrollHeight` (рядок 96) виконується СИНХРОННО після `el.appendChild(chipsRow)` (рядок 93). У iOS Safari браузер не встигає порахувати висоту нового chipsRow до scrollTop → скрол ігнорує chips, вони залишаються нижче viewport. **Фікс:** обернути scrollTop у `requestAnimationFrame(() => { el.scrollTop = el.scrollHeight; })` щоб дочекатись layout. Аналогічна проблема може бути в інших 6 чатах з `addNotesChatMsg`, `addHealthChatMsg` тощо — перевірити. |

---

## 🟡 Середні (є обхідний шлях або рідко трапляється)

| ID | Файл | Симптом | Аналіз |
|---|---|---|---|
| **B-117** | `src/owl/proactive.js:1091` (м'який кеш 5хв) + `_pickMessageForTab` + Pruning без entityRefs | Юзер виконав 2/2 звичок (зелені ✓ у вкладці Продуктивність), але сова в табло показує застаріле «Сьогодні не виконано жодну звичку. Активізуйся — 5 присідань або 2 хв розтяжки». Скріншот mUpS8 16:47. Дані оновлені (заголовок «Звички 2 з 2 сьогодні» правильний), застаріле тільки повідомлення сови. | **Знайдено гілки розслідування, не зафіксовано корінь:** (1) `tryTabBoardUpdate` рядок 1091 блокує генерацію якщо latestMsg молодше 5 хв (м'який кеш для економії API); (2) listener `nm-data-changed: habits` рядок 1185 викликає `generateBoardMessage` через 5 сек **повз кеш**, але якщо `_boardGenerating[tab]=true` (рядок 625) — пропускається; (3) Pruning Engine (`isMessageRelevant` у `getTabBoardMsgs`) перевіряє `entityRefs`, а повідомлення «не виконано звичку» не має ref на конкретні `habit_X` → не фільтрується; (4) `_pickMessageForTab` міг обирати критичне повідомлення з історії навіть після генерації нового. **Потребує live debug у DevTools на iPhone:** `localStorage.nm_unified_board` (повний stack повідомлень для tab=tasks) + `_boardGenerating` стан + чи створено новий запис після `complete_habit`. Фікс наосліп = ризик зламати Brain Pulse. **Опції фіксу:** (а) додати `force` параметр у `tryBoardUpdate`, listener викликає з `force:true` для `e.detail !== 'chat'`; (б) розширити `entityRefs` для habit-related повідомлень щоб Pruning ловив; (в) у listener для `habits/tasks/...` детайл — інвалідувати `latestMsg.ts=0` через нову експорт-функцію у `unified-storage.js`. Найбезпечніше — (в). |

---

## 🟢 Дрібні (косметика, не ламає функціонал)

_Немає відкритих дрібних багів._

---

## ✅ Закриті (активні сесії)

_Зберігаються закриті у 2 останніх активних сесіях (BqTWF + mUpS8). Старіші (rKQPT + bOqdI) перенесено у [`_archive/BUGS_HISTORY.md`](_archive/BUGS_HISTORY.md) у mUpS8 02.05.2026 Phase 3._

_Сесія **mUpS8** (02.05.2026) — Universal clarify-guard + Pattern Learning roadmap + B-116. Закрила 1 🟡 bug._

| ID | Файл | Симптом | Корінь + фікс |
|---|---|---|---|
| **B-116** ✅ | `src/tabs/projects.js` (`renderProjectsList`). Знайдено mUpS8 02.05. | Картка проекту не мала способу видалення — ні свайпа, ні кнопки. Функціонал відсутній цілком (grep `attachSwipeDelete\|deleteProject\|delete-btn` дав 0 результатів). | Додано свайп вліво → корзина з 5-сек відкатом (як у Notes/Inbox). Pattern: `<div class="project-card-wrap" data-id="${p.id}">` обгортка, всередині `<div class="card-glass project-card">`. Імпортовано `attachSwipeDelete`, `addToTrash`, `showUndoToast`. Нова функція `_attachProjectsSwipeDelete()` викликається після кожного `renderProjectsList`. Callback: `addToTrash('project', item)` + `saveProjects(filtered)` + `showUndoToast` з restore через `splice` назад на оригінальну позицію. Уніфіковано з 7 іншими вкладками. Коміт `fdf370f`. CACHE bump → `nm-20260502-1900`. |

_Сесія **BqTWF** (02.05.2026) — iPhone smoke-test v556 → знайдено 🔴 **B-115** при пункті 1 чек-ліста. Закрито промпт-фіксом у тій самій сесії._

| ID | Файл | Симптом | Корінь + фікс |
|---|---|---|---|
| **B-115** ✅ | `src/ai/prompts.js` (INBOX_SYSTEM_PROMPT, блок «РОЗРІЗНЕННЯ»). Знайдено BqTWF iPhone v556. | Доконаний факт минулого «**Відкрив автомийку**» → AI створив (1) дубль проекту з НЕПРАВИЛЬНОЮ назвою «Хімчистка» (контекст попереднього інтерв'ю переважив), (2) `create_event` замість `save_note`/`save_moment`. | Корінь: промпт не розрізняв ЧАСОВУ форму. Старий блок 6 рядків → новий 17 рядків з: (1) часовою формою як головним індикатором («МИНУЛЕ → save_moment/save_note, НЕ create_project»), (2) явним правилом для project («ТІЛЬКИ при ЯВНОМУ "створи проект"»), (3) КОНТЕКСТ ІНТЕРВ'Ю → `clarify` з чіпами. CACHE bump → `nm-20260502-1645`. **mUpS8 додав** soft safety net через `src/owl/clarify-guard.js` бо промпт сам по собі ймовірнісний. |

_Старіші сесії (rKQPT + bOqdI + LW3j8 + 6ANWm + Ph8ym) → [`_archive/BUGS_HISTORY.md`](_archive/BUGS_HISTORY.md)._

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
