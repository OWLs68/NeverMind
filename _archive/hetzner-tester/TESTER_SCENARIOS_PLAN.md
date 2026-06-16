# План тестових сценаріїв для AI-Tester (35 UI scripted)

> **Сесія Ug2Jw 21.05.2026** — стратегічний план UI-покриття після обговорення з Романом.

---

## 🎯 Мета і scope

**Що покриваємо:** UI behavior — кнопки, модалки, поля вводу, свайпи, persistence через reload.

**Що НЕ покриваємо** (Роман тестує сам):
- Як AI відповідає (тон, точність, OWL поведінка)
- AI tool dispatching (`save_finance`, `add_medication` etc — це AI-flows)
- Зміст AI повідомлень (галюцинації, переплутані категорії)

**Що НЕ покриваємо** (іOS-specific, потребує real device):
- Rubber-band scroll, blur composite, swipe touch quirks
- Share Sheet (PWA standalone)
- bfcache після pageshow

**Що НЕ покриваємо ЗАРАЗ** (буде доступно після Supabase):
- Login / signup / email verify modals
- Multi-device sync
- Offline mode banner
- Sync conflict resolution
- Поточний `nm_backup_*` mechanism (буде замінений Supabase scheduled backups)
- `nm_gemini_key` modal у Settings (ключ переїде на Edge Function)

**Вкладку Projects пропускаємо** — ще доробляється.

---

## ⚖️ Принципи стабільності (без них тести через тиждень flaky)

### 1. UI-first assertions, НЕ storage
**Помилка ❌:** `localStorage.nm_tasks містить "AI-Tester X"` — це впаде після Supabase бо дані переїдуть у БД.

**Правильно ✅:** `у списку задач видно текст "AI-Tester X"` — це працює і зараз і після Supabase, бо DOM той самий.

Виняток: `nm_backup_*` тести — пишемо одразу як deprecated (видалимо після Supabase migration).

### 2. Test isolation — clean start + cleanup
Кожен тест починається з:
- `goto_url + wait(2.0) + inject_error_capture`
- Якщо потрібен seed state — створює мінімум сам (не покладається на попередній тест)

Кожен тест закінчується cleanup'ом створених елементів (видаляє свою задачу/нотатку/транзакцію).

### 3. Retry-2x перед FAIL
Network blip / CDP race conditions нормальні. Тест має `@retry(2)` декоратор у Python — спочатку 2 повторні спроби, потім real FAIL.

### 4. Version pinning у звіті
Кожен тестовий run пише `ai_tester_app_version` (з sw.js CACHE_NAME). Якщо стара cached версія — алерт `STALE_CACHE` перед запуском.

---

## 📋 35 сценаріїв по вкладках

### 🌐 Globals (4)

**test_boot_health** — застосунок відкривається, OWL-табло видно, 0 console.error за 3 сек. _(існує = test_1)_

**test_nav_8_tabs** — тапнути всі 8 вкладок по черзі, кожна перемикається, header змінюється відповідно. _(існує = test_2)_

**test_header_buttons** — header має кнопки: ⚙️ Налаштування (→ модалка), ℹ️ Допомога (→ модалка), пошук (→ input focus). Кожна кнопка реагує на тап.

**test_language_switch** — Settings → Мова → змінити на EN → перевір що UI оновився (заголовок "Tasks" замість "Задачі") → змінити назад на UK.

### ⚙️ Settings (3)

**test_settings_open_close** — тап ⚙️ → модалка з'являється → тап на темний фон → модалка зникає. Те саме на × кнопку.

**test_clear_all_data** — Settings → Видалити всі дані → confirm → reload → перевір що у списках Tasks/Notes/Finance ПУСТО.

**test_legal_pages** — Settings → Юридична інформація → бачиш 3 розділи (Impressum/Privacy/Terms) → кожен відкривається → червоний banner "[PLACEHOLDER]" видно → × закриває.

### 📥 Inbox (4)

**test_inbox_chat_input** — тап у chat-bar → input фокусується → набираю текст → видно у полі → Enter → текст з'являється у списку розмови, поле очищується.

**test_inbox_card_swipe** — створити inbox-картку → свайп вліво по картці → з'являється кнопка "Видалити" → тап → картка зникає з UI.

**test_inbox_owl_swipe** — потягнути OWL-сову вниз ~40 пікселів → з'являється повний chat-bar → потягнути вверх → згортається назад у smol-bar.

**test_inbox_clarify_modal** — створити запис який тригерить clarify (наприклад amount без category) → модалка з опціями з'являється → тап на одну опцію → модалка зникає, запис оновлений.

### ✅ Tasks (5)

**test_tasks_add** — Tasks → ➕ → відкривається модалка з input → набираю "Test task X" → Save → задача з'являється у списку.

**test_tasks_persistence** — створити задачу → reload сторінки → задача все ще у списку (з тим самим текстом).

**test_tasks_edit** — тап на існуючу задачу → відкривається edit-модалка → змінити текст → Save → новий текст видно у списку.

**test_tasks_steps** — створити задачу → додати 3 кроки через ➕ Крок → тап на квадратик кроку → ✓ зелена позначка → тап повторно → ✓ зникає.

**test_tasks_swipe_delete_restore** — свайп вліво по задачі → з'являється "Видалити" → тап → задача зникає → відкрити Settings → Кошик → видно картку видаленої задачі → ↻ Відновити → задача знов у списку Tasks.

### 📝 Notes (4)

**test_notes_add_edit** — Notes → ➕ → відкривається модалка нотатки → набираю заголовок + текст → Save → нотатка у списку.

**test_notes_folders** — Notes → 📁 → створити папку "Test Folder" → перемістити нотатку у папку → тап на папку → бачимо тільки нотатки цієї папки.

**test_notes_swipe_delete** — свайп вліво на нотатці → "Видалити" → нотатка зникає → у Кошику видно її → ↻ Відновити.

**test_notes_search** — у пошуковому полі (header) набрати фрагмент тексту нотатки → у списку залишаються тільки нотатки що містять цей фрагмент.

### 👤 Me / Habits (4)

**test_habits_add** — Me → ➕ Звичка → модалка з input + варіанти періодичності → набираю "Біг ранкою" → Save → звичка у списку.

**test_habits_toggle_done** — тап на галочку звички → ✓ зелена позначка з'являється → лічильник днів збільшується.

**test_habits_edit** — тап на картку звички → edit-модалка → змінити назву → Save → нова назва у списку.

**test_habits_prod_tab_switch** — у Tasks tab верхній перемикач "Задачі ↔ Продуктивність" → тап → перемикається на Habits view + кнопка ➕ змінює функцію (від openAddTask на openAddHabit).

### 🌙 Evening (3)

**test_evening_open** — нижня tab-bar → Evening → відкривається daily summary view → видно секції "Що зроблено сьогодні" + "Звички" + "Лог".

**test_evening_write** — у Evening chat-bar набираю текст → Enter → запис з'являється у журналі дня.

**test_evening_quit_habit_hold** — Evening → у списку звичок tap-and-hold (~600мс) на кнопці "Тримаюсь" звички яку кидаю → progress bar заповнюється → release → confirmation.

### 🩺 Health (4)

**test_health_add_card** — Health → ➕ Картка → модалка з input ім'я лікаря/закладу → Save → картка з'являється у списку.

**test_health_add_medication** — відкрити existing картку → ➕ Препарат → модалка з input назви + dosage + frequency → Save → препарат у картці.

**test_health_datetime_picker** — у картці тап на date/time поле → відкривається кастомний DT-picker → обрати дату+час → confirm → значення у формі оновилось.

**test_health_allergies** — Health → 🌿 Алергії → модалка → ➕ → набираю "пилок" → Save → у списку алергій з'являється.

### 💰 Finance (4)

**test_finance_add_tx** — Finance → ➕ → tx-модалка → набираю суму через цифрову клавіатуру → обираю категорію з picker → Save → транзакція у списку.

**test_finance_calc_grid** — у tx-модалці цифрова клавіатура: 1,2,3,4,5,÷,× → видно у полі суми → ⌫ видаляє останній символ → +/- toggle знак.

**test_finance_edit_tx** — тап на існуючу транзакцію → edit-модалка → змінити суму → Save → нова сума у списку.

**test_finance_swipe_delete** — свайп вліво на транзакції → Видалити → транзакція зникає → у Кошику видно її → ↻ Відновити.

---

## 🔁 Maintenance rule — автоматичне дописування тестів

**Тригер:** Коли у сесії Claude додає/змінює UI:
- Нова кнопка з `data-action` у HTML
- Нова модалка з `id="*-modal"` у HTML
- Нове поле вводу з `id` у HTML
- Новий swipe-handler у JS
- Нова вкладка / sub-tab

**Дія перед `/finish`:** Claude автоматично:
1. Пише новий `test_NN_short_name` у `scripts/ai-tester.py` за патерном існуючих
2. Додає опис у цей файл `TESTER_SCENARIOS_PLAN.md`
3. Тригерить on-demand run для верифікації що нове PASS
4. Якщо FAIL — або фікс UI, або виправити тест

**Без цього тести відстануть від UI протягом 2-3 сесій → false confidence → реальні баги проскочать.**

---

## 📦 Після Supabase — додамо 10+ сценаріїв (BACKLOG)

**Auth flow (4):**
- Login modal: email input + send code → code input → 6 цифр → success → main UI
- Logout: Settings → Вийти → confirm → знов login modal
- Email verify: новий signup → лист на email → клік link → verified state
- Password reset: forgot password → email → reset link → нова password modal

**Multi-device sync (3):**
- Open NeverMind на 2 пристроях логіну → створи задачу на A → секунд через 5 видно на B
- Sync conflict: одночасна редагування → resolution UI з 2 варіантами
- Sync status indicator: header показує ✓ Sync OK / ⚠ Sync pending / ✗ Offline

**Offline mode (3):**
- Втрата інтернету → banner "Офлайн" → можна продовжувати працювати локально
- Повернення інтернету → sync queue відправляється → banner зникає → дані синхронізовані
- Failed sync attempt → toast "Не вдалось синхронізувати, спробуємо пізніше"

---

## 📊 Summary

| Категорія | Зараз | Після Supabase | Всього потенційно |
|---|---|---|---|
| Globals | 4 | +0 | 4 |
| Settings | 3 | +1 (logout) | 4 |
| Inbox | 4 | +0 | 4 |
| Tasks | 5 | +0 | 5 |
| Notes | 4 | +0 | 4 |
| Me/Habits | 4 | +0 | 4 |
| Evening | 3 | +0 | 3 |
| Health | 4 | +0 | 4 |
| Finance | 4 | +0 | 4 |
| Auth | 0 | +4 | 4 |
| Sync | 0 | +3 | 3 |
| Offline | 0 | +3 | 3 |
| **Projects** | — | TBD | TBD |
| **TOTAL** | **35** | **+11** | **46+** |

Стабільний baseline на серверу: 4/4 (поточний) → 39/39 після Batch 1+2 → 46+/46+ після Supabase + Projects.
