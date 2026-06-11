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
| **B-200** | `src/tabs/tasks.js:369-374` `openTaskChat` | 🟢 **ВIДКРИТО vdlyeg 10.06** (silent-bug-scout, edge-race). Якщо закрити task-chat поки AI відповідає — `el` null (гілка не виконується) але `taskChatHistory.push`+save усе одно пишуть → при повторному відкритті garbage-репліка. Фікс: `if (el && taskChatId)` перед push. Дрібний. |
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

_Зберігаються закриті у 2 останніх активних сесіях (vdlyeg + WML2Z). Старіші (RQmdC + Ug2Jw + раніше) перенесено у [`_archive/BUGS_HISTORY.md`](_archive/BUGS_HISTORY.md). Ротація Ug2Jw виконана WML2Z 03.06 /finish._

_Сесія **vdlyeg** (10.06.2026) — аудит безпеки за бібліотекою Anthropic-Cybersecurity-Skills, 4 кореневі фікси:_

- **SEC-1 escapeHtml + лапки закрито** (`8c2f7fa`) — **XSS-клас через пробій атрибута.** `escapeHtml` (`src/core/utils.js`) екранував лише `& < >`, НЕ лапки. Значення з лапкою всередині `attr="${escapeHtml(x)}"` розривало атрибут і дозволяло підставити обробник події (XSS) у ~25 місцях (chips/finance/health/notes/projects/nav). **Фікс:** escapeHtml тепер екранує подвійну лапку у `&quot;` та одинарну у `&#39;` (regex через String.fromCharCode у module-константах). Один корінь → всі 25 місць. Прибрано дубль-костур chips.js:340. Верифіковано: Council 3 агенти Sonnet (round-trip dataset цілий, нема не-HTML sinks), 8/8 unit, node --check, i18n. «Регресія» finance-modals.js:421/439 від агента — хибнопозитив (перевірено по коду: моя зміна цей кейс виправляє, не ламає).
- **SEC-2 safeHref закрито** (`1370a9c`) — **javascript:-посилання.** `projects.js:393` рендерив `<a href>` з URL ресурсу через escapeHtml — а той не блокує схему, тож `javascript:alert()` виконувався при кліку. **Фікс:** новий `safeHref(url)` у utils.js (дозволяє http/https/mailto/tel + відносні, інакше null; стрипає контрольні символи проти `java⇥script:` обходу) + `rel=noopener`. 16/16 unit.
- **SEC-3 CI command injection закрито** (`be7bd1d`) — `github.ref_name` + workflow_dispatch inputs підставлялись прямо у `run:` shell (метасимволи → виконання у runner з contents:write). **Фікс:** винесено у `env:` блок, у shell беруться як `"$VAR"`. Зачеплено auto-merge.yml (×2), auto-merge-tester.yml (×3), claude-security.yml. YAML валідний 4/4.
- **SEC-4 gitleaks закрито** (`185354e`) — додано `.github/workflows/gitleaks.yml` (secret-scanning, push/PR + щотижневий повний скан). Профілактика перед Supabase. Зараз секретів нема.
- **Відкладено:** ключ OpenAI у localStorage (справжній фікс = Supabase Edge Functions, у плані); CSP (оцінено — strict не готовий через ~20 inline iOS-хаків + Report-Only неможливий на GitHub Pages; готова чернетка meta-CSP у звіті для тесту на реальному iPhone). Нова знахідка → **B-197** (notes.js data-folder escapeJsArg).

_Сесія **WML2Z** (03.06.2026) — 2 баги з телефону + дірка покриття тестера:_

- **B-194 закрито** (`00b377b`) — **чіпи з кривим JSON вивалюють весь код у бульбашку чату.** Скрін «Список не список»: на «склади список покупок» AI згенерував JSON чіпів із зайвими комами (`"steps":null }, },`) — невалідний JSON. `parseContentChips` (`src/core/utils.js`) робив strict `JSON.parse`, той кидав, чіпи=null → весь блок показувався сирим текстом замість кнопок. **Фікс:** lenient-fallback — при невдачі strict-парсу прибираємо trailing-коми (`/,(\s*[}\]])/`) і парсимо ще раз. Happy-path лишається strict; lenient тільки коли strict уже впав. Один парсер → діє на всі 8 чатів. **Корінь глибший** (не закрито): система покладається на те що AI ідеально складе JSON у вільному тексті — крихко; напрямок на майбутнє — структуровані відповіді OpenAI (tool_calls/JSON mode).
- **B-195 закрито** (`0e24085`) — **табло (OWL board) не оновлюється на вхід у застосунок.** Скрін «370 год тому»: при відкритті табло чекало 45с до першого пульсу, при поверненні з фону — до 10 хв (немає реакції на foreground). `brain-pulse.js` мав тільки cold-start setTimeout(45с) + setInterval(10хв) + `nm-data-changed`, без visibility-тригера; `document.hidden` guard глушив background-тіки. **Фікс:** `visibilitychange` + `pageshow` → debounced `brainPulse` (2с); cold-start 45с→5с. Cooldowns (brain_global 30хв, brain_tab 24год) гасять спам/витрати. Обидва listener для надійності iOS PWA bfcache. **Перевірено:** startBrainPulseCycle викликається 1 раз (boot.js:1367) — listeners не подвоюються; обидва фікси у зібраному bundle.js на origin/main (v1004).
- **B-196 закрито** (`651ab85`) — **test_29 і test_30 ніколи не бігали у cron — тихо випадали з покриття.** Всього 32 сценарії, `max_tests_per_run=30` → `SCENARIOS[:30]` відрізав позиції 31-32 (test_29/test_30). Підтверджено cron-логом 11:01 (23 ran = 30 sliced − 7 disabled, test_29/30 відсутні). Конкретний доказ тези Романа «тестер слабкий — false confidence». **Фікс:** `max_tests_per_run` 30→33 у `tester-config.json`. Заодно прибрано мертвий `--full` mode (docstring + arg + TODO-блок, grep підтвердив 0 інших залишків).

_Сесія **RQmdC** (23.05.2026) — B-192 розслідування через runtime trace (НЕ баг застосунку):_

- **B-192 закрито** (`f4a1a70` debug + наступний коміт enable) — **«createFullBackupUI створює backup, але за ~0.8с зникає» виявився ХИБНИМ сигналом старого test_4, а НЕ реальним багом.** Council 3 паралельних агентів Sonnet (точки видалення / async scheduler / pre-mortem) НЕ знайшли винного коду — бо у застосунку видалення немає. Голова верифікувала через runtime замість того щоб патчити backup.js на гіпотезах (правило CLAUDE.md «гіпотеза агента ≠ факт»). **Метод:** переписав test_4 з (а) monkey-patch на `localStorage.removeItem/setItem` для `nm_backup_*` з `performance.now()` timestamp + stack trace до 2000 chars; (б) polling кожні 100мс протягом 1100мс. **Результат:** on-demand trigger запустив test_4 ТРИЧI поспіль (14:03/04/05 UTC) — **усі 3 PASS**. Backup живий протягом усіх 1100мс, `rm_log` порожній (жодного `removeItem(nm_backup_*)` після створення). **Корінь хибного сигналу:** старий test_4 вимірював `keys_af` і `after_keys` через ОКРЕМI CDP `Runtime.evaluate` виклики з `wait(0.8)` між ними — таймінг/race у вимірюванні давав хибний 0, а не реальне видалення. **Фікс:** test_4 переписаний на stability polling (0/500/1000мс) + cleanup після, ENABLED у baseline (23 active). **Системний бонус:** `ai-tester.py` on-demand `TARGET_SCENARIOS` тепер BYPASS'ить `disabled_scenarios` (раніше disabled блокувало навіть прицільний trigger → Roman мусив би Edit config перед кожним debug-циклом). **Урок:** перш ніж патчити прод-код за гіпотезою про «async видалення» — встав runtime-датчик (monkey-patch + polling) і ДОВЕДИ що видалення реальне. 3 агенти × статичний код = 0 знахідок, бо проблема була у вимірі, не у застосунку.

_Сесія **Ug2Jw** (20-21.05.2026) — B-193 + B-190 ротовано WML2Z 03.06 → [`_archive/BUGS_HISTORY.md`](_archive/BUGS_HISTORY.md). (B-191 лишається ВІДКРИТИМ — див. таблицю 🟡 вище; B-192 закрито RQmdC.)_

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
