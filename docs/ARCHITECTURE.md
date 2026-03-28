# NeverMind — Архітектура системи

## 1. Граф модулів (хто від кого залежить)

```mermaid
graph TD
    HTML["index.html\n(головна сторінка — весь UI)"]
    NAV["app-core-nav.js\n(навігація — перемикання вкладок, теми, налаштування)"]
    SYS["app-core-system.js\n(система — кошик, PWA, запуск застосунку)"]
    AIC["app-ai-core.js\n(ядро ШІ — виклики API, контекст, чат-пам'ять)"]
    CHAT["app-ai-chat.js\n(OWL Board — проактивні повідомлення агента)"]
    INB["app-inbox.js\n(вхідні — головна вкладка, обробка повідомлень)"]
    TSK["app-tasks-core.js\n(задачі — список, кроки, виконання)"]
    HAB["app-habits.js\n(звички — трекер, стріки, лог виконання)"]
    NOT["app-notes.js\n(нотатки — папки, перегляд, пошук)"]
    FIN["app-finance.js\n(фінанси — витрати, доходи, бюджет)"]
    EVE["app-evening-moments.js\n(вечір + Я — моменти дня, підсумок, скор)"]
    ONB["app-evening-onboarding.js\n(онбординг — перший запуск, гайд, допомога)"]
    HLT["app-health.js\n(здоров'я — карточки, щоденні шкали)"]
    PRJ["app-projects.js\n(проекти — воркспейс, кроки, метрики)"]

    HTML --> NAV
    HTML --> SYS
    HTML --> AIC
    HTML --> CHAT
    HTML --> INB
    HTML --> TSK
    HTML --> HAB
    HTML --> NOT
    HTML --> FIN
    HTML --> EVE
    HTML --> ONB
    HTML --> HLT
    HTML --> PRJ

    INB --> AIC
    INB --> TSK
    INB --> HAB
    INB --> NOT
    INB --> EVE
    INB --> SYS

    CHAT --> AIC
    CHAT --> NAV

    TSK --> AIC
    HAB --> AIC
    NOT --> AIC
    FIN --> AIC
    EVE --> AIC
    HLT --> AIC
    PRJ --> AIC

    EVE --> HAB
    EVE --> TSK
    EVE --> NOT

    HLT --> NOT
    PRJ --> NOT
    PRJ --> TSK

    ONB --> AIC
    ONB --> INB

    style NAV fill:#e8d5c4
    style SYS fill:#e8d5c4
    style AIC fill:#d4e8d8
    style INB fill:#fdb87a
```

---

## 2. Flow: Юзер пише в Inbox

```mermaid
flowchart TD
    A[Юзер пише повідомлення] --> B["sendToAI\n(відправити до ШІ)"]
    B --> C["getAIContext\n(зібрати контекст — що знає агент)"]
    C --> D["context = дата + профіль + пам'ять\n+ задачі + звички + inbox сьогодні\n+ фінанси + кошик"]
    D --> E["callAIWithHistory\n(виклик GPT-4o-mini з histórico розмови)"]
    E --> F{"Парсинг JSON\n(розбір відповіді ШІ)"}
    F -->|"parse error\n(помилка розбору)"| G["saveOffline\n(зберегти без ШІ, просто в inbox)"]
    F -->|ok| H{"action.action\n(яка дія?)"}

    H -->|"save\n(зберегти запис)"| I["processSaveAction\n(обробити збереження)"]
    H -->|"save_finance\n(зберегти фінанси)"| J["processFinanceAction\n(обробити фінансову операцію)"]
    H -->|"complete_habit\n(виконати звичку)"| K["processCompleteHabit\n(відмітити звичку виконаною)"]
    H -->|"complete_task\n(виконати задачу)"| L["processCompleteTask\n(відмітити задачу виконаною)"]
    H -->|"clarify\n(уточнити)"| M["showClarify modal\n(показати вибір варіантів)"]
    H -->|"add_step\n(додати крок)"| N["додати кроки до задачі"]
    H -->|"create_project\n(створити проект)"| O["новий проект"]
    H -->|"restore_deleted\n(відновити видалене)"| P["searchTrash → restore\n(пошук в кошику → відновити)"]
    H -->|"reply\n(просто відповідь)"| Q["addInboxChatMsg agent\n(показати відповідь агента)"]

    I --> I1{"category\n(категорія запису)"}
    I1 -->|"task\n(задача)"| I2["getTasks → saveTasks\n(отримати → зберегти задачі)\nautoGenerateTaskSteps\n(автоматично згенерувати кроки)"]
    I1 -->|"note/idea\n(нотатка або ідея)"| I3["addNoteFromInbox\n(додати нотатку з inbox в папку)"]
    I1 -->|"habit\n(звичка)"| I4["getHabits → saveHabits\n(отримати → зберегти звички)"]
    I1 -->|"event\n(подія/момент)"| I5["getMoments → saveMoments\n(отримати → зберегти моменти)\ngenerateMomentSummary\n(згенерувати AI-підсумок моменту)"]
    I1 -->|all| I6["saveInbox → renderInbox\n(зберегти → перемалювати inbox)"]

    K --> K1["getHabitLog\n(отримати лог звичок)\nоновити count\n(збільшити лічильник)\nsaveHabitLog\n(зберегти лог)\nrenderProdHabits\n(перемалювати звички)"]
    L --> L1["getTasks\n(отримати задачі)\nstatus=done\n(статус = виконано)\nsaveTasks\n(зберегти)\nrenderTasks\n(перемалювати список)"]
```

---

## 3. Карта даних (localStorage)

> **localStorage** — це вбудоване сховище браузера. Як таблиця: ключ → значення. Всі дані застосунку тут.

```mermaid
graph LR
    subgraph "Inbox (вхідні)"
        NI["nm_inbox\n(масив записів inbox)"]
        NCI["nm_chat_inbox\n(история чату, макс 30 повід.)"]
    end

    subgraph "Tasks (задачі)"
        NT["nm_tasks\n(масив задач)"]
        NCT["nm_chat_tasks\n(чат у вкладці Задачі)"]
        NTC["nm_task_chat_ID\n(чат для конкретної задачі)"]
    end

    subgraph "Notes (нотатки)"
        NN["nm_notes\n(масив нотаток)"]
        NF["nm_folders_meta\n(метадані папок — колір, іконка)"]
        NNT["nm_notes_folders_ts\n(коли востаннє AI пропонував папки)"]
    end

    subgraph "Habits (звички)"
        NH["nm_habits2\n(масив звичок)"]
        NHL["nm_habit_log2\n(лог: дата → id → кількість)"]
        NQL["nm_quit_log\n(quit-звички: стрік + зриви)"]
    end

    subgraph "Finance (фінанси)"
        NFI["nm_finance\n(масив транзакцій)"]
        NFB["nm_finance_budget\n(бюджет: ліміт + по категоріях)"]
        NFC["nm_finance_cats\n(категорії витрат і доходів)"]
        NFCO["nm_fin_coach_PERIOD\n(кеш AI-аналізу за період)"]
    end

    subgraph "Health (здоров'я)"
        NHC["nm_health_cards\n(карточки захворювань/станів)"]
        NHL2["nm_health_log\n(дата → енергія + сон + біль)"]
    end

    subgraph "Projects (проекти)"
        NP["nm_projects\n(масив проектів з кроками і метриками)"]
    end

    subgraph "Evening (вечір)"
        NM["nm_moments\n(моменти дня)"]
        NES["nm_evening_summary\n(AI-підсумок дня)"]
        NEM["nm_evening_mood\n(настрій + дата)"]
    end

    subgraph "System (система)"
        NS["nm_settings\n(налаштування: ім'я, вік, мова)"]
        NGK["nm_gemini_key\n(API ключ OpenAI)"]
        NME["nm_memory\n(AI-профіль користувача, 300 слів)"]
        NMET["nm_memory_ts\n(коли оновлено пам'ять)"]
        NAT["nm_active_tabs\n(які вкладки активні)"]
        NTR["nm_trash\n(кошик: макс 200, живе 7 днів)"]
    end

    subgraph "OWL (проактивний агент)"
        NOB["nm_owl_board\n(повідомлення на головній, макс 3)"]
        NOBT["nm_owl_board_ts\n(коли востаннє згенеровано)"]
        NOBS["nm_owl_board_said\n(теми що вже сказав сьогодні)"]
        NOTB["nm_owl_tab_TAB\n(повідомлення по кожній вкладці)"]
        NOTBT["nm_owl_tab_ts_TAB\n(timestamp генерації по вкладці)"]
        NOTBS["nm_owl_tab_said_TAB\n(теми по вкладці що вже сказав)"]
    end
```

---

## 4. OWL Board — тригери проактивних повідомлень

```mermaid
flowchart TD
    T["tryOwlBoardUpdate\n(перевірити чи потрібно генерувати)\nкожні 3 хв"] --> CH{"Тихий режим?\n23:00-7:00\n(ніч — мовчати)"}
    CH -->|так| SKIP[пропустити]
    CH -->|ні| TRG{"Тригер активний?\n(яка подія спрацювала)"}

    TRG --> T1[🌅 7-9 ранок → ранковий бриф]
    TRG --> T2[☀️ 13:00 → обідня перевірка]
    TRG --> T3[🌙 20:00 без підсумку → нагадування]
    TRG --> T4[📅 Пн 8-10 → огляд тижня]
    TRG --> T5[📅 Пт 17+ → підсумок тижня]
    TRG --> T6[⏰ Дедлайн задачі < 1 год]
    TRG --> T7[😴 Задача не рухається 3+ дні]
    TRG --> T8[⚡ Звички не виконані після 10:00]
    TRG --> T9[🔥 Стрік під загрозою після 20:00]
    TRG --> T10[🎉 Всі звички виконані сьогодні]
    TRG --> T11[💰 Бюджет 80%+ витрачено]
    TRG --> T12[💸 Транзакція в 2.5x більша за звичну]

    T1 & T2 & T3 & T4 & T5 & T6 & T7 & T8 & T9 & T10 & T11 & T12 --> GEN["getOwlBoardContext\n(зібрати контекст + пріоритизувати:\ncritical → important → normal)"]
    GEN --> AI["GPT-4o-mini\n(генерує JSON: текст + пріоритет + кнопки)"]
    AI --> SAVE["saveOwlBoardMessages\n(зберегти, макс 3 повідомлення,\nстарі витісняються новими)"]
    SAVE --> RENDER["renderOwlBoard\n(відмалювати карусель на екрані)"]
```

---

## 5. Пам'ять агента (Memory System)

```mermaid
flowchart LR
    TRIG["shouldRefreshMemory\n(перевірити чи потрібно оновити)\n1 раз на день"] --> COL["Збір даних\n(зібрати інформацію про юзера)"]
    COL --> I50["50 останніх\ninbox записів\n(що писав сьогодні і раніше)"]
    COL --> T8["8 активних\nзадач\n(що робить зараз)"]
    COL --> N20["20 останніх\nнотаток\n(що думає і планує)"]
    COL --> PR["Профіль\nкористувача\n(ім'я, вік — з налаштувань)"]

    I50 & T8 & N20 & PR --> AI["GPT-4o-mini\n(прохання: 'Сформуй профіль людини,\nmax 300 слів, виявити патерни')"]
    AI --> MEM["nm_memory\n(текстовий профіль — хто ця людина,\nщо їй важливо, які звички)"]
    MEM --> CTX["getAIContext\n(збірник контексту для ШІ —\nвставляє пам'ять як 3-й блок)"]
    CTX --> ALL["всі AI-виклики\nInbox агент + OWL Board\n+ AI бари у вкладках"]
```

---

## 6. Вкладки та їх можливості

```mermaid
graph TD
    APP[NeverMind] --> INB_T["📥 Inbox\n(вхідні — головна вкладка)\nзавжди активна"]
    APP --> NOT_T["📝 Нотатки\n(notes — записи по папках)\nзавжди активна"]
    APP --> TSK_T["✅ Задачі\n(tasks — список справ)\nвибіркова"]
    APP --> HAB_T["🔥 Звички\n(habits — щоденний трекер)\nвибіркова"]
    APP --> FIN_T["💰 Фінанси\n(finance — витрати і доходи)\nвибіркова"]
    APP --> HLT_T["❤️ Здоров'я\n(health — стани і шкали)\nвибіркова"]
    APP --> PRJ_T["🚀 Проекти\n(projects — планування)\nвибіркова"]
    APP --> EVE_T["🌙 Вечір + Я\n(evening + me — підсумок і статистика)\nвибіркова"]

    INB_T --> |"AI агент\n(12 типів дій)"| AICORE["GPT-4o-mini\n(єдиний мозок)"]
    NOT_T --> |"Chat в нотатці\n(розмова про конкретну нотатку)"| AICORE
    TSK_T --> |"AI bar\n(панель чату у вкладці)"| AICORE
    HAB_T --> |"AI bar"| AICORE
    FIN_T --> |"AI коуч\n(аналіз витрат, поради)"| AICORE
    HLT_T --> |"AI bar"| AICORE
    PRJ_T --> |"AI bar"| AICORE
    EVE_T --> |"AI рефлексія\n(аналіз дня, підсумок)"| AICORE

    AICORE --> MEM_T["nm_memory\n(спільна пам'ять —\nагент знає контекст у всіх вкладках)"]
```
