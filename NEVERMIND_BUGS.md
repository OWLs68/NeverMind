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
| **B-191** | `scripts/ai-tester.py` fill_input або NM oninput delegation | 🟡 **ВIДКРИТО Ug2Jw 21.05.** `browser-harness fill_input(selector, text)` ПОДВОЮЄ кожен char у NM textarea: `'AI-Tester'` → `'AAII--TTeesstteerr'` (підтверджено run 04:35:10). Може bh API bug АБО NM oninput delegation подвійно реєструється АБО iOS focus-hack `ontouchend="this.focus()"`. Workaround у тестера: JS-direct `el.value=X;dispatchEvent('input')`. Реальний iPhone юзер не подвоює — не блокер. Потребує grep `[data-on-input]` listeners. |
| ~~**B-197**~~ | ~~`src/tabs/notes.js:458,530` `data-folder`~~ | ✅ **ЗАКРИТО vdlyeg 10.06** (`870b790`). `data-folder` на `.folder-item-wrap` екранувався `escapeJsArg` (JS-string escaper для `onclick`) → свайп читав `wrap.dataset.folder` = JS-екрановане, а у сховищі назва без екранування → папка з апострофом/лапкою не видалялась. 3-й escape-дефект у notes.js поспіль. **Фікс:** `escapeJsArg`→`escapeHtml` у обох точках + прибрано escapeJsArg з import. Правило: `data-*` → завжди escapeHtml (читається через dataset який декодує сутності), ніколи escapeJsArg. node --check + check-imports чисті. |
| ~~**B-192**~~ | ~~`src/core/backup.js` async deletion~~ | ✅ **ЗАКРИТО RQmdC 23.05 — НЕ БАГ застосунку, хибний сигнал старого тесту.** Деталі у секції "✅ Закриті" нижче. |
| B-178 | ~~`src/ai/prompts.js` + chip-payloads + `nm_active_interview`~~ | ✅ **ЗАКРИТО nliW8 13.05** (`240e168` + `d85dde3`) — cross-chat interview handoff Inbox→Health через `addMsgForTab` централізацію. Деталі у секції "✅ Закриті" нижче. |
| **B-198** | `src/ui/modal-overlay-sync.js:112` + `finance-modals.js:135,579` | 🟡 **ВIДКРИТО vdlyeg 10.06** (silent-bug-scout, **верифіковано по коду**). Свайп-закриття фінансових модалок (Нова транзакція / редагування категорії) мертвіє після першої взаємодії. Корінь: `_setupSwipeClose` чіпляє touch-listener на `modal` (виживає) але замикається на `card = modal.querySelector(':scope > div')` (рядок 112). `_refreshTransactionModal`/`_refreshCatEditModal` роблять `modal.innerHTML=...` при кожному тапі типу/категорії/калькулятора → стара card від'єднується, listener рухає відʼєднаний вузол, нова card не зв'язана (re-setup не викликається). Симптом: відкрив транзакцію, тапнув «Витрата» → свайп вниз не закриває (тільки «Скасувати»). **Фікс (кореневий):** у handler шукати card динамічно `modal.querySelector(':scope > div')` замість closure, АБО рефрешити внутрішній контейнер а не весь modal.innerHTML. Спільний swipe-core → ⚠️ smoke на РЕАЛЬНОМУ iPhone обов'язковий. |
| **B-199** | `src/ui/modal-overlay-sync.js:74-82` `_externalizeOverlay` | 🟡 **ВIДКРИТО vdlyeg 10.06** (silent-bug-scout, **гіпотеза — потребує верифікації**). Backdrop-tap (тап повз картку) на динамічних фінансових модалках (fin-tx/date/cat-edit/budget) нібито ігнорується: `_externalizeOverlay` копіює лише `onclick`, а ці модалки мають `data-action="close-backdrop"`+`data-fn` без `onclick` → після виносу overlay тап нікуди. Фікс: переносити і `data-action`/`data-fn` на root. Верифікувати на пристрої. |
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

_Зберігаються закриті у 2 останніх активних сесіях (vdlyeg + 7uxlr7). Старіші (WML2Z + RQmdC + Ug2Jw + раніше) перенесено у [`_archive/BUGS_HISTORY.md`](_archive/BUGS_HISTORY.md). Ротація WML2Z+RQmdC виконана 7uxlr7 12.06 /finish._

_Сесія **7uxlr7** (12.06.2026) — Supabase Фаза 1 + багфікси (знайдені+виправлені цієї сесії, не B-XX):_

- **quit-звичка закрито** (`d8713a9`) — «кинути курити» через чат → був build замість quit-челенджу. Корінь: tool `save_habit` без параметра `type` → AI не міг позначити quit. **Фікс:** `inferHabitType()` (`src/data/habit-classifier.js`, правило 12 — детермінований класифікатор) у 4 точках створення. +«менше курити» (`0ec333d` аудит).
- **час→подія закрито** (`605321f`) — «подзвонити о 12:00» → був задачею, не потрапляв у Розпорядок дня (задача має лише дату, без слота). **Фікс:** гард `convertTaskToEventOnTime` (`dispatcher-guards.js`, усі 8 чатів) + `hasExplicitClockTime()` строгий детектор (не ловить дати «15.05»). Захисти: минулий час / кроки / вже-подія.
- **NM_KEYS закрито** (`fc063f3`) — 5 orphan-ключів поза реєстром → `clearAllData`/Supabase-backup пропускали. **Фікс:** патерни `nm_fin_insight_`, `nm_tasks_backup_` + 2 точкові.
- **closeSettings зайвий regen закрито** (`0ec333d`, silent-bug-scout) — закриття Налаштувань щоразу слало подію `'memory'` → `proactive.js` регенерував OWL-табло (зайвий OpenAI). **Фікс:** писати пам'ять лише якщо змінилась.

_Сесія **vdlyeg** (10.06.2026) — аудит безпеки за бібліотекою Anthropic-Cybersecurity-Skills, 4 кореневі фікси:_

- **SEC-1 escapeHtml + лапки закрито** (`8c2f7fa`) — **XSS-клас через пробій атрибута.** `escapeHtml` (`src/core/utils.js`) екранував лише `& < >`, НЕ лапки. Значення з лапкою всередині `attr="${escapeHtml(x)}"` розривало атрибут і дозволяло підставити обробник події (XSS) у ~25 місцях (chips/finance/health/notes/projects/nav). **Фікс:** escapeHtml тепер екранує подвійну лапку у `&quot;` та одинарну у `&#39;` (regex через String.fromCharCode у module-константах). Один корінь → всі 25 місць. Прибрано дубль-костур chips.js:340. Верифіковано: Council 3 агенти Sonnet (round-trip dataset цілий, нема не-HTML sinks), 8/8 unit, node --check, i18n. «Регресія» finance-modals.js:421/439 від агента — хибнопозитив (перевірено по коду: моя зміна цей кейс виправляє, не ламає).
- **SEC-2 safeHref закрито** (`1370a9c`) — **javascript:-посилання.** `projects.js:393` рендерив `<a href>` з URL ресурсу через escapeHtml — а той не блокує схему, тож `javascript:alert()` виконувався при кліку. **Фікс:** новий `safeHref(url)` у utils.js (дозволяє http/https/mailto/tel + відносні, інакше null; стрипає контрольні символи проти `java⇥script:` обходу) + `rel=noopener`. 16/16 unit.
- **SEC-3 CI command injection закрито** (`be7bd1d`) — `github.ref_name` + workflow_dispatch inputs підставлялись прямо у `run:` shell (метасимволи → виконання у runner з contents:write). **Фікс:** винесено у `env:` блок, у shell беруться як `"$VAR"`. Зачеплено auto-merge.yml (×2), auto-merge-tester.yml (×3), claude-security.yml. YAML валідний 4/4.
- **SEC-4 gitleaks закрито** (`185354e`) — додано `.github/workflows/gitleaks.yml` (secret-scanning, push/PR + щотижневий повний скан). Профілактика перед Supabase. Зараз секретів нема.
- **Відкладено:** ключ OpenAI у localStorage (справжній фікс = Supabase Edge Functions, у плані); CSP (оцінено — strict не готовий через ~20 inline iOS-хаків + Report-Only неможливий на GitHub Pages; готова чернетка meta-CSP у звіті для тесту на реальному iPhone). Нова знахідка → **B-197** (notes.js data-folder escapeJsArg).

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
