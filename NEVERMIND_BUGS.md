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
| ~~**B-192**~~ | ~~`src/core/backup.js` async deletion~~ | ✅ **ЗАКРИТО RQmdC 23.05 — НЕ БАГ застосунку, хибний сигнал старого тесту.** Деталі у секції "✅ Закриті" нижче. |
| B-178 | ~~`src/ai/prompts.js` + chip-payloads + `nm_active_interview`~~ | ✅ **ЗАКРИТО nliW8 13.05** (`240e168` + `d85dde3`) — cross-chat interview handoff Inbox→Health через `addMsgForTab` централізацію. Деталі у секції "✅ Закриті" нижче. |
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

_Зберігаються закриті у 2 останніх активних сесіях (RQmdC + Ug2Jw). Старіші (HKnlM + DGH6F + e9t3N + nliW8 + db0YY + раніше) перенесено у [`_archive/BUGS_HISTORY.md`](_archive/BUGS_HISTORY.md). Ротація HKnlM..db0YY виконана RQmdC 23.05 /finish._

_Сесія **RQmdC** (23.05.2026) — B-192 розслідування через runtime trace (НЕ баг застосунку):_

- **B-192 закрито** (`f4a1a70` debug + наступний коміт enable) — **«createFullBackupUI створює backup, але за ~0.8с зникає» виявився ХИБНИМ сигналом старого test_4, а НЕ реальним багом.** Council 3 паралельних агентів Sonnet (точки видалення / async scheduler / pre-mortem) НЕ знайшли винного коду — бо у застосунку видалення немає. Голова верифікувала через runtime замість того щоб патчити backup.js на гіпотезах (правило CLAUDE.md «гіпотеза агента ≠ факт»). **Метод:** переписав test_4 з (а) monkey-patch на `localStorage.removeItem/setItem` для `nm_backup_*` з `performance.now()` timestamp + stack trace до 2000 chars; (б) polling кожні 100мс протягом 1100мс. **Результат:** on-demand trigger запустив test_4 ТРИЧI поспіль (14:03/04/05 UTC) — **усі 3 PASS**. Backup живий протягом усіх 1100мс, `rm_log` порожній (жодного `removeItem(nm_backup_*)` після створення). **Корінь хибного сигналу:** старий test_4 вимірював `keys_af` і `after_keys` через ОКРЕМI CDP `Runtime.evaluate` виклики з `wait(0.8)` між ними — таймінг/race у вимірюванні давав хибний 0, а не реальне видалення. **Фікс:** test_4 переписаний на stability polling (0/500/1000мс) + cleanup після, ENABLED у baseline (23 active). **Системний бонус:** `ai-tester.py` on-demand `TARGET_SCENARIOS` тепер BYPASS'ить `disabled_scenarios` (раніше disabled блокувало навіть прицільний trigger → Roman мусив би Edit config перед кожним debug-циклом). **Урок:** перш ніж патчити прод-код за гіпотезою про «async видалення» — встав runtime-датчик (monkey-patch + polling) і ДОВЕДИ що видалення реальне. 3 агенти × статичний код = 0 знахідок, бо проблема була у вимірі, не у застосунку.

_Сесія **Ug2Jw** (20-21.05.2026) — AI-Tester screenshot unblock + 4 Batch нових сценаріїв + B-193 знайдено через тестер:_

- **B-193 закрито** (`54c2e46`) — **`openAddHabit` НЕ у `window` exports → юзер на Habits subtab тапає ➕ → нічого.** Корінь: HKnlM `b6a3d37` зробив `dataset.fn='openAddHabit'` на `#prod-add-btn` при switch на Habits, АЛЕ забув додати `openAddHabit` у `Object.assign(window, {...})` habits.js:1942. Delegation `call` handler перевіряє `typeof window[fn]==='function'` → false → silent skip → юзер бачить що кнопка ➕ нерактивна. **Знайдено:** test_19_habits_add сам показав `HABIT_MODAL_NOT_OPEN` → grep `window.openAddHabit` → undefined. Це ПЕРШИЙ real production bug який AI-Tester зловив самостійно (не Pre-mortem, не Council, тестер сам). **Фікс:** +1 рядок `openAddHabit,` у window export. CACHE bump nm-20260521-0925.



- **B-192 ВIДКРИТО** — **`createFullBackupUI` створює backup synchronously, але через ~0.8 сек ВIН ЗНИКАЄ.** Підтверджено через inline-копію `createSelectiveBackup` логіки у тестері: `b4_call=0 → af_call=1` (синхронно після `window.createFullBackupUI()` бекап у LS), але потім `keys_a=0` через wait(0.8). NM-grep всіх `removeItem` callsites НЕ знайшов автоматичних видалень `nm_backup_*` поза `backup.js` (тільки `clearAllData` нав'язує юзера). Залишається гіпотеза: async setTimeout у NM scheduler/listener у `src/owl/` чи `src/core/` що чистить backup'и за timestamp/TTL. **Тимчасовий workaround:** test_4 у `disabled_scenarios`. **Знайдено:** Council Sonnet (createFullBackupUI flow audit) + 5 раундів debug-payload через on-demand trigger. **Скріни на сервері:** `/home/nmtester/screenshots/test-4-backup-create-2026-05-21-04-46-13.png` (потрібен Roman SSH `scp` для перегляду toast text).
- **B-191 ВIДКРИТО** — **`browser-harness fill_input(selector, text)` ПОДВОЮЄ кожен char у NM textarea.** Підтверджено run 04:35:10: `fill_input('#task-input-title', 'AI-Tester 20260521-043502')` → input.value = `'AAII--TTeesstteerr  2200226600552211--004433550022'`. Корінь може бути: (а) browser-harness bug — keyDown+keyUp двічі диспатчиться, (б) NM oninput delegation handler через `[data-on-input]` глобальний listener реєструє двічі, (в) iOS keyboard hack `ontouchend=this.focus()` тригерить додатковий input event. **Workaround:** test_3 використовує JS-direct `el.value = X; dispatchEvent('input')` (PASS після цього). Реальний iOS юзер не помітить бо typing manual char-by-char, а не keyboard-replay. **Потребує:** глибший grep oninput listeners + перевірка `[data-on-input]` flow. Не блокер для звичайного юзера.
- **B-190 закрито** (`e993aa7`) — **AI-Tester `screenshot()` ніколи не зберігав скріни — кожен fail приховував свою причину.** Симптом (HKnlM 20.05): `tester-status.json last_failures[].screenshot_path = "[screenshot failed: bh exit 1: ... NameError: name 'take_screenshot' is not defined. Did you mean: 'capture_screenshot'?]"` — приховано засмічувало JSON 500+ char Python traceback'ами замість шляху. Debug test_3/test_4 (HKnlM хвости) був заблокований — без скрінів неможливо побачити чому saveTask мовчить / createFullBackup повертає 0. **Корінь — 3 латентні дірки в одній функції `screenshot()` (ai-tester.py:162-175):** (1) `bh(f"take_screenshot({path!r})")` — функції з такою назвою у browser-harness API не існує, реальна `capture_screenshot(path, full=False)` (підтверджено коментарем рядка 85 і docstring рядка 779 того ж файлу); (2) `path!r` = `PosixPath('...')` як Python літерал — вимагає `pathlib` у `globals()` browser-harness daemon (там його нема); (3) `capture_screenshot()` нічого не друкує у stdout, а `bh()` raise'є `RuntimeError("bh returned empty output")` коли stdout порожній — потрібен явний `print(_json.dumps({}))` після виклику. Підтверджено патерн ВСI 10 тестових сценаріїв закінчуються `print(_json.dumps(...))` через цю саму вимогу. **Знайдено:** typo побачив сам у traceback'у tester-status.json при /start; інші 2 дірки розкрив Pre-mortem ПЕРЕД Edit (правило CLAUDE.md mental models #1) — питання «якщо typo фікс не запрацює, ЧОМУ?». **Фікс:** `bh(f"capture_screenshot({str(path)!r})\nprint(_json.dumps({{}}))")` + bonus truncate error до 120 chars першого рядка (JSON не повинен містити 500-char traceback'и). **Урок:** 1 видимий баг приховує 2 латентні — без Pre-mortem я б полагодив typo, наступний cron-run упав би на Path repr, ще доба debug.

_Старіші сесії (HKnlM+DGH6F+e9t3N+nliW8+db0YY ротовано RQmdC 23.05; раніше: dyhJu + 64CXo nliW8 13.05; раніше: PJi7l + LfA6w day1/day2 + MPVly + MPVly-day2 + QDIGl + rC4TO + UvEHE з B-120+B-121, 4xJ7n з B-118+B-119, mUpS8 з B-116, BqTWF з B-115) → [`_archive/BUGS_HISTORY.md`](_archive/BUGS_HISTORY.md)._


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
