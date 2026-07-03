# NeverMind — Відомі баги

> **Правило ротації:** у файлі зберігаються **всі відкриті** баги + **закриті у 2 останніх активних сесіях** (згідно `_ai-tools/SESSION_STATE.md`).
> При виклику `/finish` у новій сесії — закриті з найстаршої з 2 активних переносяться у [`_archive/BUGS_HISTORY.md`](_archive/BUGS_HISTORY.md).
> Формат ID: **B-XX** — номер, сортуються хронологічно.
> Використання: `/fix B-XX` — скіл Claude прочитає цей файл і знайде опис бага.

---

## 🔴 Критичні (зламана функціональність)

_Немає відкритих критичних багів станом на 07.05.2026 (LfA6w — B-151+B-152+B-153 закрито)._

---

## 🟡 Середні (є обхідний шлях або рідко трапляється)

| B-179 | ~~`src/core/trash.js` + `index.html` Налаштування~~ | ✅ **ЗАКРИТО OBErR 18.05** (`3d85532`) — UI Кошика реалізовано: Settings → «Кошик» з badge counter → #trash-modal зі списком ≤200 items (7-денний TTL), 11 типів icon-mapping, «↻ Відновити» кнопка кожного. Pre-mortem race-fix: openTrashModal скидає _undoData щоб уникнути race з undo-toast. + B-171 фікс по дорозі: trash.js Date.now() collision → `id: generateUUID()` (backward compat через id||deletedAt). |
| B-155 | `src/owl/brain-pulse.js:122-134` `startBrainPulseCycle()` | **Гіпотетичний** (підтверджено LfA6w що зараз викликається 1× з `boot.js:606`). Додає global listener на `nm-data-changed` без guard від повторного виклику. Якщо boot.js випадково викличе двічі (regression) — `_debounceTimer` затиратиметься, але listener-ів буде 2 → подвійні brainPulse запити (2× cost). Профілактичний фікс: idempotency flag. ~10 хв. |
| B-156 | `src/tabs/calendar.js:806-807` event-edit-modal | **Гіпотетичний** (не підтверджено візуально). `<input type="time">` з `flex:0 0 110px` без `min-width:0` всередині flex-row. На iOS Safari intrinsic min-width нативного picker може overflow контейнер у вузьких viewports (iPhone SE 320px). Фікс: додати `min-width:0`. ~5 хв. |
| ~~**B-191**~~ | ~~`scripts/ai-tester.py` fill_input~~ | ✅ **ЗАКРИТО foyz2r 18.06 — МООТ.** Баг подвоєння символів був у browser-harness Хетзнер-тестера (`fill_input`), не в застосунку (реальний iPhone-юзер не подвоював). Hetzner-тестер архівовано (`_archive/hetzner-tester/`), замінено на Playwright у CI → інструмент-джерело бага більше не існує. Новий тестер вводить через нативні Playwright API без цієї вади. |
| ~~**B-197**~~ | ~~`src/tabs/notes.js:458,530` `data-folder`~~ | ✅ **ЗАКРИТО vdlyeg 10.06** (`870b790`). `data-folder` на `.folder-item-wrap` екранувався `escapeJsArg` (JS-string escaper для `onclick`) → свайп читав `wrap.dataset.folder` = JS-екрановане, а у сховищі назва без екранування → папка з апострофом/лапкою не видалялась. 3-й escape-дефект у notes.js поспіль. **Фікс:** `escapeJsArg`→`escapeHtml` у обох точках + прибрано escapeJsArg з import. Правило: `data-*` → завжди escapeHtml (читається через dataset який декодує сутності), ніколи escapeJsArg. node --check + check-imports чисті. |
| ~~**B-192**~~ | ~~`src/core/backup.js` async deletion~~ | ✅ **ЗАКРИТО RQmdC 23.05 — НЕ БАГ застосунку, хибний сигнал старого тесту.** Деталі у секції "✅ Закриті" нижче. |
| B-178 | ~~`src/ai/prompts.js` + chip-payloads + `nm_active_interview`~~ | ✅ **ЗАКРИТО nliW8 13.05** (`240e168` + `d85dde3`) — cross-chat interview handoff Inbox→Health через `addMsgForTab` централізацію. Деталі у секції "✅ Закриті" нижче. |
| **B-198** | `src/ui/modal-overlay-sync.js:112` + `finance-modals.js:135,579` | 🟡 **ВIДКРИТО vdlyeg 10.06** (silent-bug-scout, **верифіковано по коду**). Свайп-закриття фінансових модалок (Нова транзакція / редагування категорії) мертвіє після першої взаємодії. Корінь: `_setupSwipeClose` чіпляє touch-listener на `modal` (виживає) але замикається на `card = modal.querySelector(':scope > div')` (рядок 112). `_refreshTransactionModal`/`_refreshCatEditModal` роблять `modal.innerHTML=...` при кожному тапі типу/категорії/калькулятора → стара card від'єднується, listener рухає відʼєднаний вузол, нова card не зв'язана (re-setup не викликається). Симптом: відкрив транзакцію, тапнув «Витрата» → свайп вниз не закриває (тільки «Скасувати»). **Фікс (кореневий):** у handler шукати card динамічно `modal.querySelector(':scope > div')` замість closure, АБО рефрешити внутрішній контейнер а не весь modal.innerHTML. Спільний swipe-core → ⚠️ smoke на РЕАЛЬНОМУ iPhone обов'язковий. |
| **B-199** | `src/ui/modal-overlay-sync.js:74-82` `_externalizeOverlay` | 🟡 **ВIДКРИТО vdlyeg 10.06** (silent-bug-scout, **гіпотеза — потребує верифікації**). Backdrop-tap (тап повз картку) на динамічних фінансових модалках (fin-tx/date/cat-edit/budget) нібито ігнорується: `_externalizeOverlay` копіює лише `onclick`, а ці модалки мають `data-action="close-backdrop"`+`data-fn` без `onclick` → після виносу overlay тап нікуди. Фікс: переносити і `data-action`/`data-fn` на root. Верифікувати на пристрої. |
| **B-201** | `src/tabs/habits.js:968,1049` | 🟡 **ВIДКРИТО 26yz5s 03.07** (знайдено ESLint no-undef під час оцінки ловця для класу E2E #39, **верифіковано по bundle.js:15643**). Регресія батчу D (різ habits→execute-action.js, 28.06): рядок 968 `export { processUniversalAction } from ...` — це «прокидання» експорту далі, воно НЕ робить функцію доступною всередині самого файлу. Виклик на 1049 (`_processOne`, чат Задач, гілка коли AI відповідає текстовим JSON-блоком замість інструмента) → ReferenceError → ловиться загальним try/catch → юзер бачить «Мережева помилка» замість виконання дії. У bundle всі інші виклики перейменовані на `processUniversalAction2`, а цей лишився голим — на проді з v1082+. Той самий клас що E2E #39 (getFolderColor). **Фікс (1 рядок):** рядок 968 → `import { processUniversalAction } from '../core/execute-action.js'; export { processUniversalAction };` (і локальна доступність, і збереження проброса для 6 інших файлів-імпортерів). |
| ~~**B-200**~~ | ~~`src/tabs/tasks.js:369-374`~~ | ✅ **ЗАКРИТО vdlyeg 10.06** (`d0955e1`). Перевірка показала: «закрив само» вже guarded (`saveTaskChatHistory` no-op при `taskChatId=null`). Реальний баг тонший — крос-задача: закрив A, відкрив B, відповідь A прилітає → засмічувала чат B (taskChatId уже = B). Фікс: захоплюємо `chatIdAtCall = taskChatId` перед callAI, у `.then` `if (taskChatId !== chatIdAtCall) return`. |
_B-160..B-164 закрито у 64CXo 10.05 — див. секцію "✅ Закриті" нижче._

_B-125 закрито у MPVly 05.05 (`4082a0c`) — у списку відкритих був дубль через документаційну дірку, прибрано LfA6w 07.05._
_B-126 закрито у MPVly 05.05 — див. секцію "✅ Закриті" нижче._

---

## 🟢 Дрібні (косметика, не ламає функціонал)

_Немає відкритих дрібних багів станом на 08.05.2026 (PJi7l — B-158 закрито)._

_B-157 закрито у LfA6w 07.05 (`c18c7d1`) — крихкий escape патерн у `notes.js:355` замінено на спільний `escapeJsArg()` помилки усунено разом з B-152._
_B-158 закрито у PJi7l 08.05 — див. секцію "✅ Закриті" нижче._

---

## ✅ Закриті (активні сесії)

_Зберігаються закриті у 2 останніх активних сесіях (gfrvu5 + v3pexs). Старіші перенесено у [`_archive/BUGS_HISTORY.md`](_archive/BUGS_HISTORY.md)._

_Сесія **v3pexs** (27.06.2026) — без B-XX; клас-фікс + фічі через /byyou:_

- **токен-баг `\b`-кирилиця у фільтрі інструментів** (`7a72423`) — regex з `\b` перед кириличним словом НIКОЛИ не матчив → фільтр «звузити tools під намір» мертвий → у кожен запит летіли ВСI інструменти (~30-40% зайвих токенів на схеми). **Фікс:** кирилично-безпечні межі. +`9d5f38b` детект минулого часу (той клас) +`72957cc` `check-cyrillic-boundary` розширено на `\b(`. Класифікатор винесено у `src/data/` з контракт-тестом (`8ab23f9`).
- **момент без локації-підтвердження** (`dadfab0`) — момент з місцем тепер дає «у Моменти (Вечір)».
- **bareNoun без чіпів у no-tool гілці** (`6a53105`+`94b748a`) — одне слово при текстовій відповіді AI давало текст «- [...]» замість клікабельних чіпів. **Фікс:** `shouldClarify` у no-tool гілці 7 чатів + GREETING_STOPLIST проти «Так/Ні/Дякую».

_Сесія **gfrvu5** (20-23.06.2026) — багфікси знайдені контракт-тестами під час дог-фуду /byyou (клас `\b`-кирилиця, не B-XX):_

- **вартовий «момент» мертвий** (`e28249b`) — `/\bмомент/` у `dispatcher-guards.js:32` НIКОЛИ не матчив українське «момент» (у JS `\b` рахує межу лише по латиниці) → `dropEventOnMomentKeyword` мертвий з створення. **Фікс:** `/момент/i`. Знайшов перший контракт-тест `check-guards`.
- **дні тижня `пн/вт…` мертві** (`e28249b`) — `\bпн\b` у `inbox.js:1211,1217-1223` те саме → скорочення днів не матчились (повні слова працювали). **Фікс:** кирилично-безпечна межа `(?<![а-яіїєґ])X(?![а-яіїєґ])`.
- **push-замок не пускав «Деплой»** (`f78ede5`) — мій власний `byyou-push-lock.js` мав `\bдеплой\b` (та сама помилка, іронія). **Фікс:** `/деплой/i` + винесено у `lib/byyou-release.js` під тест `check-byyou-lock`.
- **E2E: update-тур ловив кліки** (`62d0fb7`) — `#slides-tour` на чистому тест-профілі (`nm_seen_update≠v065`, +500мс після boot) перехоплював кліки. **Фікс:** глушити за `__NM_TEST_SEED__` (onboarding.js + helpers).
- **Профілактика:** `check-cyrillic-boundary.js` тепер стереже весь `src/` від рецидиву класу `\b`-кирилиця (pre-push + CI).

_Сесії **7uxlr7** (12.06 quit/час→подія/NM_KEYS) + **vdlyeg** (10.06 SEC-1..4 + B-197) — ротовано v3pexs 27.06 → [`_archive/BUGS_HISTORY.md`](_archive/BUGS_HISTORY.md)._

_Сесії **WML2Z** (B-194/195/196) + **RQmdC** (B-192) — ротовано 7uxlr7 12.06 → [`_archive/BUGS_HISTORY.md`](_archive/BUGS_HISTORY.md)._

_Сесія **Ug2Jw** (20-21.05.2026) — B-193 + B-190 ротовано WML2Z 03.06 → [`_archive/BUGS_HISTORY.md`](_archive/BUGS_HISTORY.md). (B-191 лишається ВІДКРИТИМ — див. таблицю 🟡 вище.)_

_Старіші сесії (Ug2Jw ротовано WML2Z 03.06; HKnlM+DGH6F+e9t3N+nliW8+db0YY ротовано RQmdC 23.05; раніше: dyhJu + 64CXo nliW8 13.05; раніше: PJi7l + LfA6w day1/day2 + MPVly + MPVly-day2 + QDIGl + rC4TO + UvEHE з B-120+B-121, 4xJ7n з B-118+B-119, mUpS8 з B-116, BqTWF з B-115) → [`_archive/BUGS_HISTORY.md`](_archive/BUGS_HISTORY.md)._


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
