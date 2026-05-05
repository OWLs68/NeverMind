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

_Зберігаються закриті у 2 останніх активних сесіях (QDIGl + rC4TO). Старіші (UvEHE з B-120/B-121, MIeXK, iWyjU, 4xJ7n, mUpS8, BqTWF) перенесено у [`_archive/BUGS_HISTORY.md`](_archive/BUGS_HISTORY.md)._

_Сесія **MPVly** (05.05.2026) — chip render Inbox + B-125 + B-126 + правило Sonnet:_
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
