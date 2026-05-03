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
| **B-117** | `src/owl/proactive.js:1091` (м'який кеш 5хв) + `_pickMessageForTab` + Pruning без entityRefs | Юзер виконав 2/2 звичок (зелені ✓ у вкладці Продуктивність), але сова в табло показує застаріле «Сьогодні не виконано жодну звичку. Активізуйся — 5 присідань або 2 хв розтяжки». Скріншот mUpS8 16:47. Дані оновлені (заголовок «Звички 2 з 2 сьогодні» правильний), застаріле тільки повідомлення сови. | **Знайдено гілки розслідування, не зафіксовано корінь:** (1) `tryTabBoardUpdate` рядок 1091 блокує генерацію якщо latestMsg молодше 5 хв (м'який кеш для економії API); (2) listener `nm-data-changed: habits` рядок 1185 викликає `generateBoardMessage` через 5 сек **повз кеш**, але якщо `_boardGenerating[tab]=true` (рядок 625) — пропускається; (3) Pruning Engine (`isMessageRelevant` у `getTabBoardMsgs`) перевіряє `entityRefs`, а повідомлення «не виконано звичку» не має ref на конкретні `habit_X` → не фільтрується; (4) `_pickMessageForTab` міг обирати критичне повідомлення з історії навіть після генерації нового. **Потребує live debug у DevTools на iPhone:** `localStorage.nm_unified_board` (повний stack повідомлень для tab=tasks) + `_boardGenerating` стан + чи створено новий запис після `complete_habit`. Фікс наосліп = ризик зламати Brain Pulse. **Опції фіксу:** (а) додати `force` параметр у `tryBoardUpdate`, listener викликає з `force:true` для `e.detail !== 'chat'`; (б) розширити `entityRefs` для habit-related повідомлень щоб Pruning ловив; (в) у listener для `habits/tasks/...` детайл — інвалідувати `latestMsg.ts=0` через нову експорт-функцію у `unified-storage.js`. Найбезпечніше — (в). |

---

## 🟢 Дрібні (косметика, не ламає функціонал)

_Немає відкритих дрібних багів._

---

## ✅ Закриті (активні сесії)

_Зберігаються закриті у 2 останніх активних сесіях (rC4TO + UvEHE). Старіші (MIeXK з 0 багів + iWyjU з 0 багів + 4xJ7n + mUpS8 + BqTWF) перенесено у [`_archive/BUGS_HISTORY.md`](_archive/BUGS_HISTORY.md)._

_Сесія **rC4TO** (04.05.2026) — silent failures фіксовано (chips Phase C + dispatcher) + swipe-delete карток Здоров'я + iOS діагноз правило + Notes render guard:_
- **B-122 закрито** (`8a05ada`) — Health Phase C інтерв'ю чіпи мовчать. Корінь у `src/owl/chips.js:199-204`: (1) whitelist action переписував `health_interview` у `'chat'` → handler ніколи не спрацьовував, (2) `escapeHtml` не кодує `"` → JSON payload ламав HTML-атрибут. Фікс: додано `health_interview` у whitelist + локальний escape `"` → `&quot;` для payloadAttr + `console.warn` у fallback `handleChipClick` для майбутніх silent failures. Юзер підтвердив: «Чіпи працюють».
- **B-123 закрито** (`431b433`) — `create_project` у Фінансах висне (typing-індикатор крутиться вічно). Корінь у `src/ai/tool-dispatcher.js`: tool навмисно НЕ оброблявся (коментар «Inbox-specific interview flow») → silent skip → `addMsg` ніколи не викликається → typing висне. Фікс: новий handler `create_project` ПЕРЕД universal loop (створює проект з будь-якого чату через `createProjectProgrammatic` helper з projects.js + `switchTab('inbox')` + `startProjectInboxInterview`) + універсальний SILENT FAILURE GUARD у кінці `dispatchChatToolCalls` для будь-яких unknown tools.
- **B-124 закрито** (`2f96593`) — вкладка Нотатки порожня попри 30 записів у `nm_notes`. Симптом (Роман v626): порожній екран без empty state, «+» каже «збережено» але список не оновлюється. Корінь з логів діагностики (`bundle.js:8661`): `items[0].text.length` throws у `renderNotes:333` бо хоч один запис у nm_notes без поля `text` (AI через clarify-chip path міг згенерувати save_note з payload без text → `addNoteFromInbox(undefined)` → запис з `text: undefined`). Один битий запис → throws всередині `.map()` → весь HTML не формується → `content.innerHTML` лишається порожнім → empty state не показується (бо `notes.length > 0`). Фікс: 3 захисти у `notes.js` — (1) `addNoteFromInbox` return early якщо text falsy, (2) `renderNotes` фільтрує битих + one-time cleanup `saveNotes(validNotes)` в localStorage, (3) safe-read `items[0]?.text` у preview generation. Юзер підтвердив: «Папки повернулися». Розблоковано всі 5+ папок з 30 нотатками.

_Сесія **UvEHE** (03.05.2026) — фінал модалок (B-120/B-121 + drum-picker + Settings 4-ітерац):_
- **B-120 закрито фінально** — модалка Health стала на calendar-pattern: top-level `#health-card-modal-overlay` як sibling (НЕ дитячий backdrop-div) + onclick на root з `event.target===this`. Окремий swipe-handler на root через `setupModalSwipeClose` (універсальний з `tasks.js`). iOS rubber-band повністю усунуто бо overlay не у transformed-context.
- **B-121 закрито фінально** — заміна native `<input type=date/time>` на власний drum-picker mini-модалку (`#health-dt-picker-modal`) з 3-кол date drum + 2-кол time drum. Native iOS picker більше не відкривається — замість нього стилізована модалка з кроком 5 хв для часу. Роки 1990-2035. Поля-trigger показують форматовану дату «3 трав. 2026» / «09:00». Плюс `_initDrumCol` експортовано з calendar.js для перевикористання.
- **Settings scale-glitch (4 ітерації — без B-номера, регресія)** — модалка візуально стискалась при тапі/скролі всередині. False leads: mask-image, flex layout, nested backdrop-filter, body-lock. **Справжній корінь:** глобальне CSS `style.css:1551`: `[onclick]:active { transform: scale(0.87); }` — settings-overlay має onclick → tap bubbles до root → scale(0.87) на ВСІЙ модалці. Фікс: override `#settings-overlay:active, [id$="-modal"]:active { transform: none }`.
- **deploy-info-modal blur** — переніс blur з самого root на окремий top-level overlay-bg sibling (як calendar).
- **Help-drawer** для всіх 8 вкладок: HELP_CONTENT для health/projects (раніше null → нічого не показувало) + swipe-right на drawer (root) щоб ловити touch на dim теж.

_Старіші сесії (4xJ7n з B-118+B-119, mUpS8 з B-116, BqTWF з B-115, rKQPT + bOqdI + LW3j8 + 6ANWm + Ph8ym) → [`_archive/BUGS_HISTORY.md`](_archive/BUGS_HISTORY.md)._

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
