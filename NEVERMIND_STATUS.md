# NeverMind — Статус проекту
> На початку кожного чату читай в такому порядку:
> 1. РОМАН_ПРОФІЛЬ.md — хто Роман і як з ним працювати
> 2. Цей файл (STATUS.md) — поточний стан і задачі
> 3. РОМАН_ПРОГРЕС.md — тільки розділ "Останні сесії"
> 4. Потрібний модуль app-*.js — тільки той що стосується задачі

---

## 🚨 ПРАВИЛА (читати першими)

1. **БЕЗ "Роби" — НІЧОГО НЕ ЗМІНЮВАТИ В КОДІ**
2. **ЧИТАЙ КОД ПЕРЕД ЗМІНАМИ** — завжди, навіть якщо здається очевидним
3. **ЗВІРЯЙСЯ З LOGIC.md** — нові ідеї не повинні суперечити концепції
4. **НЕ ГУБИ ФІКСИ** — при кожній зміні перевіряй що попередні фікси збережені
5. **ЧИСТОТА КОДУ** — прибирай старі змінні, дублікати, мертві посилання
6. **ПЕРЕВІРЯЙ СИНТАКСИС** — після JS змін: `node --check файл.js`
7. **МОДУЛЬНА АРХІТЕКТУРА** — index.html + 9 модулів app-*.js. Ліміт: **1200 рядків** — попередити, **1500 рядків** — зупинитись і повідомити
8. **ПОПЕРЕДЖАЙ** — якщо щось важко реалізувати в PWA
9. **ОДИН БАГ ЗА РАЗ** — після виправлення пропонувати наступний
10. **safeAgentReply** — завжди замість прямого addMsg('agent', reply) у всіх барах
11. **ДЕПЛОЙ АВТОМАТИЧНИЙ** — Claude пушить на гілку `claude/...` → GitHub зливає в main → GitHub Pages деплоїть. Жодних ручних дій не потрібно
12. **ОФІЦІЙНИЙ РЕЛІЗ** — перед тим як оголошувати нову версію користувачам: оновити `UPDATE_VERSION` і `UPDATE_SLIDES` в index.html
13. **ПІСЛЯ КОЖНОЇ ЗМІНИ** — оновити STATUS.md (версія, розміри модулів, задачі) і запушити
14. **"не задеплоєно"** = код запушено і працює, але UPDATE_VERSION/UPDATE_SLIDES ще не оновлені → користувачі не побачать слайди нової версії

---

## 📍 Поточний стан

| | |
|--|--|
| **Версія в коді** | v65 (задеплоєно автоматично) |
| **Офіційний реліз** | v33 (UPDATE_VERSION/SLIDES не оновлені з v33) |
| **Хостинг** | owls68.github.io/NeverMind (GitHub Pages) |
| **AI модель** | OpenAI GPT-4o-mini |
| **Агент** | OWL |
| **Останнє** | 3-стейтний чат (closed→A→B), scroll-behind, OWL board на всіх вкладках |

---

## ⚠️ Розміри модулів (актуально на 24.03.2026)

| Модуль | Рядків | Статус |
|--------|--------|--------|
| index.html | 2693 | ⚠️ велике |
| app-core.js | 2033 | 🔴 > 1500 |
| app-evening.js | 1838 | 🔴 > 1500 |
| app-tasks.js | 1698 | 🔴 > 1500 |
| app-ai.js | 1522 | 🔴 > 1500 |
| app-notes.js | 1117 | ✅ |
| app-finance.js | 1108 | ✅ |
| app-inbox.js | 663 | ✅ |
| app-projects.js | 604 | ✅ |
| app-health.js | 445 | ✅ |

> ⚠️ app-core і app-ai значно виросли — рефакторинг після офіційного релізу

---

## 🗂️ Карта модулів

| Задача | Модуль |
|--------|--------|
| Tabs, theme, settings, OWL board, барабан, вибір вкладок | app-core.js |
| callAI, getAIContext, OWL personality, safeAgentReply | app-ai.js |
| Inbox, sendToAI, processSaveAction | app-inbox.js |
| Tasks, habits, processUniversalAction, fuzzy папки | app-tasks.js |
| Notes, folders | app-notes.js |
| Finance, forecast, coach | app-finance.js |
| Evening, Me, moments, slides, onboarding | app-evening.js |
| Health cards, scales, AI bar | app-health.js |
| Projects list/workspace, AI bar | app-projects.js |

---

## 💾 Storage

| Ключ | Що зберігає |
|------|-------------|
| nm_inbox | Записи Inbox |
| nm_tasks | Задачі |
| nm_notes | Нотатки (source: inbox/agent/manual) |
| nm_moments | Моменти дня |
| nm_habits2 | Звички (targetCount для множинного) |
| nm_habit_log2 | Журнал виконання (число, не bool) |
| nm_settings | Профіль, мова, валюта, owl_mode |
| nm_gemini_key | OpenAI API ключ |
| nm_memory / nm_memory_ts | Памʼять агента |
| nm_onboarding_done | Флаг онбордингу |
| nm_evening_summary | Підсумок вечора |
| nm_evening_mood | Настрій дня |
| nm_finance | Транзакції |
| nm_finance_budget | Бюджет |
| nm_finance_cats | Категорії |
| nm_health_cards | Картки здоров'я |
| nm_health_log | Щоденний лог шкал |
| nm_projects | Проекти |
| nm_active_tabs | Активні вкладки барабана |
| nm_trash | Кеш видалених (7 днів) |
| nm_owl_board / nm_owl_board_ts / nm_owl_board_said / nm_owl_board_seen | OWL табло |
| nm_chat_{tab} | Чати вкладок — Health/Projects НЕ зберігаються |
| nm_task_chat_{id} | Чат окремої задачі |
| nm_fin_coach_{period} | Порада OWL, TTL 24 год |
| nm_error_log | JS помилки |
| nm_folders_meta | Метадані папок нотаток |
| nm_notes_folders_ts | Timestamp оновлення папок |
| nm_quit_log | Лог зривів звичок |
| nm_seen_update | Версія слайдів що вже бачив |
| nm_survey_done | Флаг завершення опитування |
| nm_guide_step / nm_guide_shown_tips / nm_guide_shown_topics / nm_guide_last_ts / nm_guide_waiting_topic | Онбординг-гід |
| nm_project_interview_step / nm_project_interview_name | Стан інтервʼю проекту |

---

## 📋 Наступні кроки

| Пріоритет | Задача |
|-----------|--------|
| 🔴 | **РЕЛІЗ** — оновити UPDATE_VERSION і UPDATE_SLIDES в index.html (зараз на v33) |
| 🔴 | **БАГ** app-notes.js:85 — undo повертає нотатку в кінець замість оригінальної позиції |
| 🔴 | Supabase Етап 1 — хмара, авторизація |
| 🔴 | Supabase Етап 2 — Push-сповіщення, активний агент |
| 🟡 | **БАГ** app-inbox.js:316,632 — `==` замість `===` при порівнянні task_id |
| 🟡 | Баг #11 — агент робить задачу замість проекту |
| 🟡 | Баг #24 — тап на день в календарі |
| 🟡 | Баг #25 — картки обрізаються при скролі |
| 🟡 | Баг #26 — поле вводу без blur/fade |
| 🟡 | Рефакторинг > 1500 рядків (app-core, app-ai, app-evening, app-tasks) |
| 🟡 | Геймфікація — рівні, бали, бейджі |
| 🟡 | Правові сторінки (Privacy Policy + ToS) |
| 💤 | Голос, Vision, iOS, Apple Watch |

---

## 📜 Історія сесій (останні)

### Сесія 44 (24.03.2026) — реструктуризація документів
Створено РОМАН_ПРОФІЛЬ.md. РОМАН_ПРОГРЕС.md скорочено (архів таблицею + останні сесії). STATUS.md актуалізовано: виправлено правила, розміри модулів, поняття деплою.

### Сесії 41-43 (23-24.03.2026) — OWL Board + чат + жести (v40→v65)
OWL board на всіх вкладках постійно. Scroll-behind ефект. Єдина логіка 3-слайдового табло. 3-стейтне чат-вікно (closed→A→B) з gesture-навігацією. iOS-like свайпи в Inbox. Тихі години 0-5.

### Сесія 40 (23.03.2026) — повний переспис барабана (v34→v40)
Барабан переписано з нуля. snapXFor через getBoundingClientRect. Межі = крайні вкладки по центру. Гумова межа. Тап на будь-яку вкладку переключає.

### Сесія 37-38 (22-23.03.2026) — патч + аудит (v31→v34)
~25 багів. Множинні звички. safeAgentReply. delete_folder/move_note з fuzzy Левенштейном. Аудит документів і storage ключів.

### Сесії 33-36 (21.03.2026) — великий UI + нові вкладки (v29→v31)
Нові вкладки: Вечір, Я, Здоров'я, Проекти. Барабан з кнопкою +. OWL Tab Boards. Концепції всіх вкладок. Модуляризація app.js → 9 файлів.

---

## ⚖️ Юридична нотатка
- Зроблено: екран згоди, дисклеймери, рядки Privacy/Terms
- До публічного запуску: Privacy Policy + Terms (юрист), ФОП (Дія)
- Патент: не потрібен — захист через виконання і торгову марку
