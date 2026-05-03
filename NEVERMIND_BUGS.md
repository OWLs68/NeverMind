# NeverMind — Відомі баги

> **Правило ротації:** у файлі зберігаються **всі відкриті** баги + **закриті у 2 останніх активних сесіях** (згідно `_ai-tools/SESSION_STATE.md`).
> При виклику `/finish` у новій сесії — закриті з найстаршої з 2 активних переносяться у [`_archive/BUGS_HISTORY.md`](_archive/BUGS_HISTORY.md).
> Формат ID: **B-XX** — номер, сортуються хронологічно.
> Використання: `/fix B-XX` — скіл Claude прочитає цей файл і знайде опис бага.

---

## 🔴 Критичні (зламана функціональність)

_Немає відкритих критичних багів станом на 03.05.2026 (4xJ7n)._

---

## 🟡 Середні (є обхідний шлях або рідко трапляється)

| ID | Файл | Симптом | Аналіз |
|---|---|---|---|
| **B-120** | `src/tabs/health.js` `_showHealthCardModal`/`closeHealthCardModal` + `index.html:1682` модалка | Свайп вниз по затемненому фону за модалкою «Новий стан» Health скролить вкладку Здоров'я під ним. Знайдено MIeXK iPhone v568. | iOS rubber-band scroll: touchmove на blur-overlay не блокує body. Фікс: `document.body.style.overflow='hidden'` при відкритті + повернути при закритті. Розглянути helper `lockBodyScroll/unlockBodyScroll` для всіх модалок (борг). |
| **B-121** | `index.html:1684-1685` модалка `#health-card-modal` + flex поля дат `1714-1727` | Модалка скролиться горизонтально (вправо/вліво — не повинна), поля «Початок» / «Наст. прийом» виходять за flex-контейнери і перекриваються. Знайдено MIeXK iPhone v568. | Inputs з `width:100%; box-sizing:border-box` всередині `flex:1` div без `min-width:0` → flex-child розширюється до natural width → overflow на батька. Фікс: `overflow-x:hidden` на скрол-контейнері (1685) + `min-width:0` на двох flex:1 діви (1715, 1720). |
| **B-117** | `src/owl/proactive.js:1091` (м'який кеш 5хв) + `_pickMessageForTab` + Pruning без entityRefs | Юзер виконав 2/2 звичок (зелені ✓ у вкладці Продуктивність), але сова в табло показує застаріле «Сьогодні не виконано жодну звичку. Активізуйся — 5 присідань або 2 хв розтяжки». Скріншот mUpS8 16:47. Дані оновлені (заголовок «Звички 2 з 2 сьогодні» правильний), застаріле тільки повідомлення сови. | **Знайдено гілки розслідування, не зафіксовано корінь:** (1) `tryTabBoardUpdate` рядок 1091 блокує генерацію якщо latestMsg молодше 5 хв (м'який кеш для економії API); (2) listener `nm-data-changed: habits` рядок 1185 викликає `generateBoardMessage` через 5 сек **повз кеш**, але якщо `_boardGenerating[tab]=true` (рядок 625) — пропускається; (3) Pruning Engine (`isMessageRelevant` у `getTabBoardMsgs`) перевіряє `entityRefs`, а повідомлення «не виконано звичку» не має ref на конкретні `habit_X` → не фільтрується; (4) `_pickMessageForTab` міг обирати критичне повідомлення з історії навіть після генерації нового. **Потребує live debug у DevTools на iPhone:** `localStorage.nm_unified_board` (повний stack повідомлень для tab=tasks) + `_boardGenerating` стан + чи створено новий запис після `complete_habit`. Фікс наосліп = ризик зламати Brain Pulse. **Опції фіксу:** (а) додати `force` параметр у `tryBoardUpdate`, listener викликає з `force:true` для `e.detail !== 'chat'`; (б) розширити `entityRefs` для habit-related повідомлень щоб Pruning ловив; (в) у listener для `habits/tasks/...` детайл — інвалідувати `latestMsg.ts=0` через нову експорт-функцію у `unified-storage.js`. Найбезпечніше — (в). |

---

## 🟢 Дрібні (косметика, не ламає функціонал)

_Немає відкритих дрібних багів._

---

## ✅ Закриті (активні сесії)

_Зберігаються закриті у 2 останніх активних сесіях (4xJ7n + mUpS8). Старіші (BqTWF) перенесено у [`_archive/BUGS_HISTORY.md`](_archive/BUGS_HISTORY.md) у 4xJ7n 03.05.2026 Phase 3._

_Сесія **4xJ7n** (03.05.2026) — iPhone smoke-test v563+: знайдено + закрито 2 🔴 bugs (B-118 + B-119), UI-фікс Health-модалки._

| ID | Файл | Симптом | Корінь + фікс |
|---|---|---|---|
| **B-118** ✅ | `index.html:174` (back-link у workspace проекту). Знайдено 4xJ7n iPhone v563 21:40. | Кнопка «< Проекти» у workspace не працює — тап нічого не робить, юзер залипає у картці проекту. | `closeProjectWorkspace` експортована OK і функція тривіальна. Корінь у CSS: back-кнопка без `position:relative; z-index:N`, hit-area тільки 16×16 (svg) + текст. OWL board overlay перехоплював клік. Фікс: `position:relative; z-index:10; padding:8px 4px; margin:-8px -4px 4px -4px` (44px hit-area Apple HIG без зсуву layout). Коміт `59067ce`. CACHE bump → `nm-20260502-2200`. |
| **B-119** ✅ | `src/tabs/inbox.js:96` (`addInboxChatMsg`). Знайдено 4xJ7n iPhone v563 21:52. | Чіпи clarify-guard ([У щоденник]/[Як момент]/[Не зберігати]) рендеряться у Inbox чаті але візуально обрізаються знизу контейнером — видно тільки верхівку. | `el.scrollTop = el.scrollHeight` синхронно після `el.appendChild(chipsRow)`. iOS Safari не встигає порахувати висоту нового chipsRow до scrollTop. Фікс: подвійний scrollTop (sync + `requestAnimationFrame(() => { el.scrollTop = el.scrollHeight })`) — рекомендований патерн для iOS. Аналогічну регресію може мати 6 інших чатів — окремо перевірити. Коміт `0b4ed28`. |

_Сесія **mUpS8** (02.05.2026) — Universal clarify-guard + Pattern Learning roadmap + B-116. Закрила 1 🟡 bug._

| ID | Файл | Симптом | Корінь + фікс |
|---|---|---|---|
| **B-116** ✅ | `src/tabs/projects.js` (`renderProjectsList`). Знайдено mUpS8 02.05. | Картка проекту не мала способу видалення — ні свайпа, ні кнопки. Функціонал відсутній цілком (grep `attachSwipeDelete\|deleteProject\|delete-btn` дав 0 результатів). | Додано свайп вліво → корзина з 5-сек відкатом (як у Notes/Inbox). Pattern: `<div class="project-card-wrap" data-id="${p.id}">` обгортка, всередині `<div class="card-glass project-card">`. Імпортовано `attachSwipeDelete`, `addToTrash`, `showUndoToast`. Нова функція `_attachProjectsSwipeDelete()` викликається після кожного `renderProjectsList`. Callback: `addToTrash('project', item)` + `saveProjects(filtered)` + `showUndoToast` з restore через `splice` назад на оригінальну позицію. Уніфіковано з 7 іншими вкладками. Коміт `fdf370f`. CACHE bump → `nm-20260502-1900`. |

_Старіші сесії (BqTWF з B-115, rKQPT + bOqdI + LW3j8 + 6ANWm + Ph8ym) → [`_archive/BUGS_HISTORY.md`](_archive/BUGS_HISTORY.md)._

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
