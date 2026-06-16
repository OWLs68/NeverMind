# AI_TESTER_INTEGRATION.md — контракт NM↔Hetzner

> **Що це:** єдина точка правди для AI-тестувальника. NM-Claude (тут) і Brain-Claude (на Hetzner) спираються на цей файл щоб не розходитись.
>
> **Створено:** 15.05.2026 (сесія e9t3N) після 4 раундів обговорення з brain-Claude.
>
> **Архітектура:** Hetzner сервер + persistent Chrome profile + Python скрипт `ai-tester.py` + GPT-4o-mini для планування команд природною мовою.
>
> **Філософія:** тестер живе як справжній юзер. Має свій профіль Chrome з накопиченими даними. Не торкається даних Романа. Виконує 10 готових сценаріїв + команди з `tester-commands.md`.

---

## 📂 Файли контракту

| Файл | Хто пише | Хто читає |
|------|----------|-----------|
| `_ai-tools/tester-config.json` | NM-Claude (за запитом Романа) | Тестер на Hetzner |
| `_ai-tools/tester-commands.md` | Роман через Claude Code + NM-Claude у `/finish` | Тестер |
| `_ai-tools/tester-status.json` | Тестер після кожного запуску | NM-Claude у `/start` |
| `_ai-tools/tester-log.md` | Тестер | Роман + NM-Claude |
| `_ai-tools/tester-log/YYYY-MM-DD.md` | Тестер (архів старіше 7 днів) | Для розслідувань |
| `_ai-tools/tester-screenshots/*.png` | Тестер (локально, у `.gitignore`) | Тільки на сервері |

---

## 🔄 Життєвий цикл одного запуску тестера

```
1. cron на Hetzner (щогодини) → запускає ai-tester.py
2. ai-tester.py: git pull у /root/nevermind
3. Read _ai-tools/tester-config.json → якщо enabled=false → exit
4. Перевірка розкладу: чи минув інтервал з last_run_utc?
   - schedule_per_day=3 → інтервал 8 годин
   - schedule_per_day=24 → інтервал 1 година
   Якщо ще рано → exit
5. Перевірка бюджету: openai_spent_today_usd < daily_budget_usd?
   Якщо вийшли — пропускаємо LLM-команди, готові сценарії все одно йдуть
6. Виконати готові сценарії (з GROUND_TRUTH нижче)
7. Прочитати tester-commands.md → знайти всі [ ] → виконати через GPT-4o-mini
   планування дій + браузер
8. Update tester-commands.md: [ ] → [x] HH:MM або [!] HH:MM причина
9. Update tester-status.json: last_run_utc, summary, last_failures
10. Append у tester-log.md (за день)
11. git add _ai-tools/ → git commit → git push у claude/ai-tester-{ts}
12. auto-merge-tester.yml merge у main → файли видно у наступному /start
```

---

## 🧪 10 готових сценаріїв (GROUND_TRUTH)

> Виконуються кожен запуск автоматично, без LLM-планування. Hardcoded у `ai-tester.py`.
>
> **Селектори перевірено DGH6F 16.05.2026 проти реального DOM `index.html` v894+.** Якщо щось зламається після refactor — оновити цю секцію.

### 1. Boot health
- Відкрити `https://owls68.github.io/NeverMind`
- Чекати `window.NM_BOOT_DONE === true` (max 5 сек)
- Перевірити: `#owl-board` елемент видно (OWL-табло Inbox, id у `index.html:266`)
- Pass: видно. Fail: timeout або console.error під час boot.

### 2. Navigation 8 tabs
- Tab-bar контейнер: `#tab-bar` (динамічно будується через `rebuildDrumTabbar()` у `nav.js`)
- Tab-кнопки мають `data-tab="X"` (X = inbox/tasks/notes/health/finance/calendar/evening/me/projects)
- Натиснути по черзі: `[data-tab="inbox"]`, `[data-tab="tasks"]`, ...
- Між кожним: чекати 500 мс, перевіряти `console.error` count
- Pass: 0 console.error. Fail: будь-яка помилка.

### 3. Create task → list → reload persistence
- Перейти Tasks: тап на `[data-tab="tasks"]`
- Натиснути «+»: `#prod-add-btn` (button у `page-tasks`)
- Заповнити форму задачі (id інпутів дивись у task-modal у `index.html`)
- Save
- Перевірити: задача у списку (`#tasks-list .task-item-wrap`)
- Reload (`page.reload()`)
- Перевірити: задача ВСЕ ЩЕ у списку
- Pass: збереглась. Fail: зникла після reload.

### 4. Create note + folder
- Перейти Notes: тап на `[data-tab="notes"]`
- Натиснути «+»: `button.icon-btn[onclick*="openAddNote"]` у `#page-notes`
- Модалка: `#note-modal`
  - Ввести текст: `#note-input-text` = «Лорем іпсум»
  - Ввести нову папку: `#note-input-folder` = «Тест {timestamp}»
  - (Папка створюється автоматично у `saveNote()` якщо такої ще нема — окремої кнопки «створити папку» НЕМАЄ. Це продумано: папки родяться через нотатки.)
  - Тап save (кнопка у `#note-modal`)
- Reload
- Перевірити: і папка, і нотатка на місці (folder rendering у `notes-content`)

### 5. Create health card + medication
- Перейти Health: тап на `[data-tab="health"]`
- Натиснути «+»: `button.icon-btn[onclick*="openAddHealthCard"]` у `#page-health`
- Модалка: `#health-card-modal`
  - `#health-card-name` = «Тест картка»
  - `#health-card-subtitle` (опц.) = «Опис»
  - Save (`saveHealthCardFromModal()`)
- Додати препарат у картку: відкрити картку, кнопка додавання препарату → модалка → «Парацетамол 500мг»
- Перевірити: препарат у списку, у timeline запис «Додано»
- Reload → все на місці

### 6. Swipe task left + Undo toast + Restore
- Tasks → знайти першу задачу: `#tasks-list .task-item-wrap:first-child`
- Touch swipe left на `.task-item-wrap` (touchstart → touchmove -200px → touchend)
- Перевірити: toast з'явився — `#toast.show` (CSS клас `.show`)
- Текст у `#toast-msg` = «Задачу видалено»
- Натиснути «Відновити»: `#toast-undo-btn`
- Перевірити: задача знов у списку
- Pass: повна петля. Fail: toast не з'явився АБО restore не повернув задачу.

### 7. Delete health card → Trash → Restore
- Health → видалити «Тест картка» (свайп по картці)
- **⚠️ UI Кошика у Налаштуваннях НЕ ІСНУЄ (B-179 відкритий)** — `restoreFromTrash` працює тільки через AI-чат.
- Метод поки що: відкрити Inbox (`[data-tab="inbox"]`) → у `#inbox-input` ввести «відновити останню видалену картку» → send → чекати AI відповідь → перевірити що картка з'явилась у Health.
- TODO: коли B-179 закрито (UI кошика з'явиться у Налаштуваннях) — переписати на реальний тап у модалці.

### 8. Toggle task done state
- Tasks → перша задача → тап на checkbox: `#task-item-{id} [data-task-check]` (атрибут уже існує у `tasks.js:276`)
- Перевірити: checkbox зеленіє (`background: #16a34a`) + текст закреслюється (`text-decoration: line-through`)
- Reload
- Перевірити: збереглась як done (`task.status === 'done'` у `localStorage.nm_tasks`)
- Знов тап → повертається у not-done state

### 9. Inbox AI: «купив каву 50»
- Inbox: `[data-tab="inbox"]`
- `#inbox-input` (textarea) ← ввести «купив каву 50»
- Натиснути send (кнопка у `inbox` action area)
- Чекати AI відповідь (max 10 сек) — спостерігати за `#owl-board` (новий повідомлення-bubble)
- Перевірити у `localStorage.nm_finance` транзакцію з:
  - amount: 50
  - category: «Їжа»
  - subcategory: НЕ вигадана (або «Кафе» з whitelist, або порожнє)
- Fail: AI вигадав підкатегорію (B-180 регресія)

### 10. Inbox AI: «Зустріч з Андрієм 17 травня»
- Inbox: `[data-tab="inbox"]` → `#inbox-input` ← «Зустріч з Андрієм 17 травня» → send
- Чекати AI
- Перевірити у `localStorage.nm_events` (НЕ `nm_tasks`, НЕ `nm_notes`)
- Fail: AI зробив save_task або save_note (B-115 регресія)

---

## ⚙️ Контракт `tester-config.json`

Поля:
- `enabled` (bool): глобальний switch
- `schedule_per_day` (int): 2, 3, 6, 12, 24
- `behavior_when_idle` (str): `wait` | `smoke` | `full`
- `max_tests_per_run` (int): обмеження для одного запуску
- `max_openai_requests_per_run` (int): hard cap retry
- `daily_budget_usd` (float): hard cap витрат
- `max_retries` (int): повтори при failed selector
- `ai_model` (str): «gpt-4o-mini» (стартово)
- `viewport`: `{width, height}` — розмір браузера
- `version_pinned` (str|null): для регресій

---

## 📝 Контракт `tester-commands.md`

**Формат рядка:**
```
- [ ] Команда природною мовою (опційно ID для трекінгу)
- [x] HH:MM Команда виконана
- [!] HH:MM Команда — причина чому не вдалось
```

**Приклад:**
```
- [ ] Перевір що Кошик відкривається з 50 видаленими задачами
- [x] 03:15 Створи 5 задач і свайпни 3 з них по черзі
- [!] 03:20 Перевір синхронізацію 2 пристроїв — потребує Supabase
```

**Правила тестера:**
- Виконувати від найновіших до найстарших
- Не повторювати `[x]` і `[!]` — пропускати
- Якщо команда незрозуміла → `[!]` з причиною
- Старіші 7 днів `[x]/[!]` → переносити у `_ai-tools/tester-log/`

---

## 📊 Контракт `tester-status.json`

Ключові поля:
- `last_run_utc` — heartbeat. NM-Claude у `/start` перевіряє: якщо > 12 год → кричить.
- `summary` — лічильники за день
- `last_failures` — масив max 5 свіжих фейлів з **локальним шляхом** до скріна (НЕ base64)
- Перезаписується щозапуск — репо не пухне

**🛡️ ВАЖЛИВЕ ПРАВИЛО БЕЗПЕКИ (e9t3N 15.05.2026):**

`screenshot_path` — це **локальний шлях НА СЕРВЕРІ HETZNER** (наприклад `/home/nmtester/screenshots/test-1-2026-05-15-0300.png`). НЕ base64. НЕ потрапляє у git.

**Чому:** скрін Health-картки = PHI (GDPR Article 9 Special Category). Скрін Finance = financial PII. У public GitHub репо ці дані = GDPR порушення.

**Як Роман дивиться скріни при дебагу:** SSH у Hetzner → `ls /home/nmtester/screenshots/` → копіює потрібний через scp/sftp. Або налаштувати окремий захищений endpoint (Basic Auth) у майбутньому.

**Захист:** workflow `auto-merge-tester.yml` має guard який блокує merge якщо знайде `"screenshot_b64": "..."` у JSON (не null). Це другий рівень захисту на випадок помилки тестерського скрипта.

**Чого тестер НЕ робить:**
- ❌ НЕ зберігає скрін як base64 у JSON
- ❌ НЕ комітить файли скрінів у `_ai-tools/tester-screenshots/` (вони у `.gitignore`)
- ❌ НЕ пушить скрін через окремі канали (email, Telegram) — sensitive дані не виходять з сервера

---

## 🔐 Безпека (контракт для Brain-Claude на сервері)

1. **CDP localhost only:** `chrome --remote-debugging-address=127.0.0.1` (не 0.0.0.0)
2. **Окремий OpenAI ключ** для тестера з `monthly_budget_cap: 5 USD` через OpenAI dashboard
3. **Fine-grained PAT** для git push: scope `contents:write` тільки для `claude/ai-tester-*`. Якщо токен крадуть — не зможуть push у main.
4. **Whitelist у Python:** перед `git add` — перевірка що всі файли під `_ai-tools/`. Workflow `auto-merge-tester.yml` робить це теж як другий рівень захисту.
5. **Hard limits з config:** Python поважає `max_openai_requests_per_run`, `daily_budget_usd`, `max_retries`. Без exception.

---

## 🤝 Інтеграція з NM-скілами

### `/start` (NM-Claude робить на старті сесії):

1. Read `_ai-tools/tester-status.json`
2. Перевірити `last_run_utc`:
   - Якщо null → «Тестер не запускався (Фаза 1 ще йде)»
   - Якщо > 12 год → **«⚠️ Тестер мертвий: останній запуск {N} год тому. Перевір сервер»**
   - Інакше → «Тестер: останній запуск {N} хв/год тому, {N} pass / {N} fail»
3. Read `last_failures`. Для кожного:
   - Чи це новий баг? (немає у NEVERMIND_BUGS і немає у `tester-log` старіше 24 год)
   - Якщо так → додати у NEVERMIND_BUGS з префіксом `AI-T:` (наприклад «AI-T:1 — Boot health: console.error при відкритті»)
   - Якщо знайдено вже → не дублювати, інкремент у нотатці
4. У звіті Роману: «AI-тестер з останньої сесії: X запусків, Y нових фейлів, Z закритих»

### `/finish` (NM-Claude робить у кінці сесії, нова Фаза 3.5):

Між Фазою 3 (NEVERMIND_BUGS) і Фазою 4 (ROADMAP):

1. Для КОЖНОЇ зміни коду у сесії — згенерувати регресійний тест як команду
2. Дописати у `_ai-tools/tester-commands.md` як `[ ]` з префіксом «Регресія {XXXXX}:»
3. Приклад: якщо у сесії закрили B-180 (save_finance вигадування підкатегорій) → додати «Регресія e9t3N: Inbox "купив каву 50" → перевір що subcategory не вигадана»
4. Checkpoint-коміт: `docs(testing): add regression tests session {XXXXX}`

---

## 🚀 Майбутні фази

### Фаза 2 (через 1-2 тижні якщо MVP стабільний):
- LLM-планування для команд природною мовою (через GPT-4o-mini)
- Дедуплікація багів (один баг = один запис у BUGS)
- Restart Chrome автоматично через 50 запусків (memory leaks)
- Ротація `tester-log.md` старіше 7 днів у архів

### Фаза 3 (після Фази 2):
- non-root user `nmtester` на Hetzner
- fail2ban, key-only SSH
- systemd service замість cron
- Browser Use як движок exploration (`bu-30b-a3b-preview` модель $0.20/$2.00 за 1M tokens)

### Фаза Supabase (червень-липень):
- Login step у початок ai-tester.py (email/password Supabase auth)
- Видалити інжект OpenAI ключа (ключ на сервері тепер)
- Multi-device sync тест: 2 Chrome instances в один account

---

## 📚 Історія рішень

- **Раунд 1 (план Brain):** Hetzner + Python + GPT. NM-Council знайшов 5 BLOCKER.
- **Раунд 2:** Council помилково підтримав Hetzner, не побачив overlap з хуками.
- **Раунд 3:** Я (NM-Claude) переоцінив на GitHub Actions + Playwright ($0). Помилка — це не «помічник» Романа.
- **Раунд 4 (фінал):** Hetzner + persistent profile + config-driven через Claude. Це справжній «помічник з накопиченим станом», не просто smoke-test.

Деталі рішень → у roman-brain `projects/nevermind-ai-tester.md` (повний brief за 15.05.2026).
