# NEVERMIND — Архітектура і технічна карта

> Читай коли: задача стосується архітектури, нової функції, storage або де що знаходиться.

---

## 📦 Модулі — що де знаходиться

| Модуль | Рядків | Що всередині |
|--------|--------|--------------|
| `index.html` | ~2600 | Весь HTML + CSS. Модальні вікна, вкладки, барабан |
| `app-core-nav.js` | 1027 | Навігація між вкладками, барабан-таббар, theme, settings UI |
| `app-core-system.js` | 1082 | Ініціалізація, Trash (7 днів), PWA install, OWL board, error logger |
| `app-ai-core.js` | 589 | `callAI()`, `getAIContext()`, OWL personality, `safeAgentReply`, chat storage |
| `app-ai-chat.js` | 946 | 3-стейтне чат-вікно (closed→A→B), inbox chat UI, gesture-навігація |
| `app-inbox.js` | 663 | Inbox рендер, `sendToAI()`, `processSaveAction()` |
| `app-tasks-core.js` | 544 | Задачі CRUD, task chat, AI bar задач, `processUniversalAction` |
| `app-habits.js` | 1213 | Build-звички, quit-звички (freedomDays, лампа, тренд), AI bar |
| `app-notes.js` | 1117 | Нотатки, папки, fuzzy search, AI bar |
| `app-finance.js` | 1113 | Транзакції, графіки, прогноз, коуч, ліміти категорій |
| `app-evening-moments.js` | 960 | Вкладки Я і Вечір, моменти, AI бари, активність-кільця |
| `app-evening-onboarding.js` | 920 | Онбординг, слайди оновлень, UPDATE_VERSION/SLIDES |
| `app-health.js` | 445 | Картки здоров'я, шкали, AI bar |
| `app-projects.js` | 604 | Проекти, workspace, interview-flow, AI bar |
| `sw.js` | 78 | Service Worker: кеш (ім'я генерується при деплої), офлайн |

**Ліміт:** 1200 рядків — попередити. 1500 рядків — зупинитись і повідомити.

---

## 📂 Порядок завантаження скриптів (з index.html)

```
app-core-nav.js
app-core-system.js
app-ai-core.js
app-ai-chat.js
app-inbox.js
app-tasks-core.js
app-habits.js
app-notes.js
app-finance.js
app-evening-moments.js
app-evening-onboarding.js
app-health.js
app-projects.js
```

---

## 💾 Storage — всі ключі

| Ключ | Що зберігає | Модуль |
|------|-------------|--------|
| `nm_inbox` | Записи Inbox | app-inbox |
| `nm_tasks` | Задачі зі статусами і кроками | app-tasks-core |
| `nm_notes` | Нотатки з папками | app-notes |
| `nm_folders_meta` | Метадані папок нотаток | app-notes |
| `nm_notes_folders_ts` | Timestamp оновлення папок | app-notes |
| `nm_moments` | Моменти дня (містить `summary`) | app-evening-moments |
| `nm_habits2` | Звички (targetCount для множинного) | app-habits |
| `nm_habit_log2` | Журнал виконання звичок (число, не bool) | app-habits |
| `nm_quit_log` | Лог quit-звичок (streak, freedomDays, relapses[]) | app-habits |
| `nm_settings` | Профіль, мова, валюта, owl_mode | app-core-nav |
| `nm_gemini_key` | OpenAI API ключ | app-ai-core |
| `nm_memory` / `nm_memory_ts` | Пам'ять агента | app-ai-core |
| `nm_onboarding_done` | Флаг завершення онбордингу | app-evening-onboarding |
| `nm_evening_summary` | Підсумок вечора | app-evening-moments |
| `nm_evening_mood` | Настрій дня | app-evening-moments |
| `nm_finance` | Транзакції | app-finance |
| `nm_finance_budget` | Бюджет по категоріях | app-finance |
| `nm_finance_cats` | Категорії фінансів | app-finance |
| `nm_health_cards` | Картки здоров'я | app-health |
| `nm_health_log` | Щоденний лог шкал | app-health |
| `nm_projects` | Проекти | app-projects |
| `nm_project_interview_step` / `nm_project_interview_name` | Стан interview-flow | app-projects |
| `nm_active_tabs` | Активні вкладки барабана | app-core-nav |
| `nm_trash` | Кеш видалених (7 днів, макс 200) | app-core-system |
| `nm_error_log` | JS помилки | app-core-system |
| `nm_owl_board` / `nm_owl_board_ts` / `nm_owl_board_said` / `nm_owl_board_seen` | OWL табло Inbox | app-core-system |
| `nm_owl_tab_{tab}` / `nm_owl_tab_ts_{tab}` / `nm_owl_tab_said_{tab}` | OWL табло вкладок | app-core-system |
| `nm_chat_{tab}` | Чати вкладок (макс 30 повід.) Health/Projects — НЕ зберігаються | app-ai-core |
| `nm_task_chat_{id}` | Чат окремої задачі | app-tasks-core |
| `nm_fin_coach_{period}` | Порада OWL фінанси, TTL 24 год | app-finance |
| `nm_seen_update` | Версія слайдів що вже бачив | app-evening-onboarding |
| `nm_survey_done` | Флаг завершення опитування | app-evening-onboarding |
| `nm_guide_step` / `nm_guide_shown_tips` / `nm_guide_shown_topics` / `nm_guide_last_ts` / `nm_guide_waiting_topic` | Онбординг-гід | app-evening-onboarding |

---

## 🔄 Потік даних Inbox

```
Користувач пише в Inbox
    → sendToAI()
    → getAIContext() — збирає весь контекст
    → callAI() — OpenAI GPT-4o-mini
    → processSaveAction() або processUniversalAction()
    → Зберігає в storage
    → Рендерить у відповідній вкладці
```

---

## ⚠️ Важливі технічні нюанси

- **AI бари поза `.page` div** — `position:fixed` всередині `transform` не працює на iOS Safari
- **safeAgentReply** — завжди замість прямого `addMsg('agent', reply)` — перевіряє чи не сирий JSON
- **Вечір не копіює дані** — читає напряму з `nm_notes` і `nm_moments` при рендері
- **SW кеш** — ім'я `nm-YYYYMMDD-HHMM` генерується в `deploy.yml` при кожному деплої
