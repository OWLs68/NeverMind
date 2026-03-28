# NeverMind — Архітектура системи

## 1. Граф модулів (хто від кого залежить)

```mermaid
graph TD
    HTML[index.html] --> NAV[app-core-nav.js]
    HTML --> SYS[app-core-system.js]
    HTML --> AIC[app-ai-core.js]
    HTML --> CHAT[app-ai-chat.js]
    HTML --> INB[app-inbox.js]
    HTML --> TSK[app-tasks-core.js]
    HTML --> HAB[app-habits.js]
    HTML --> NOT[app-notes.js]
    HTML --> FIN[app-finance.js]
    HTML --> EVE[app-evening-moments.js]
    HTML --> ONB[app-evening-onboarding.js]
    HTML --> HLT[app-health.js]
    HTML --> PRJ[app-projects.js]

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
    A[Юзер пише повідомлення] --> B[sendToAI]
    B --> C[getAIContext]
    C --> D["context = дата + профіль + пам'ять\n+ задачі + звички + inbox сьогодні\n+ фінанси + кошик"]
    D --> E[callAIWithHistory\nGPT-4o-mini]
    E --> F{Парсинг JSON}
    F -->|parse error| G[saveOffline\nзберегти в inbox]
    F -->|ok| H{action.action}

    H -->|save| I[processSaveAction]
    H -->|save_finance| J[processFinanceAction]
    H -->|complete_habit| K[processCompleteHabit]
    H -->|complete_task| L[processCompleteTask]
    H -->|clarify| M[showClarify modal]
    H -->|add_step| N[додати кроки до задачі]
    H -->|create_project| O[новий проект]
    H -->|restore_deleted| P[searchTrash → restore]
    H -->|reply| Q[addInboxChatMsg agent]

    I --> I1{category}
    I1 -->|task| I2[getTasks → saveTasks\nautoGenerateTaskSteps]
    I1 -->|note/idea| I3[addNoteFromInbox\nв папку]
    I1 -->|habit| I4[getHabits → saveHabits]
    I1 -->|event| I5[getMoments → saveMoments\ngenerateMomentSummary]
    I1 -->|all| I6[saveInbox → renderInbox]

    K --> K1[getHabitLog\nоновити count\nsaveHabitLog\nrenderProdHabits]
    L --> L1[getTasks\nstatus=done\nsaveTasks\nrenderTasks]
```

---

## 3. Карта даних (localStorage)

```mermaid
graph LR
    subgraph Inbox
        NI[nm_inbox\narray]
        NCI[nm_chat_inbox\nmax 30 msg]
    end

    subgraph Tasks
        NT[nm_tasks\narray]
        NCT[nm_chat_tasks]
        NTC[nm_task_chat_ID\nпер задачу]
    end

    subgraph Notes
        NN[nm_notes\narray]
        NF[nm_folders_meta\nobject]
        NNT[nm_notes_folders_ts]
    end

    subgraph Habits
        NH[nm_habits2\narray]
        NHL[nm_habit_log2\ndate→id→count]
        NQL[nm_quit_log\nid→streak+relapses]
    end

    subgraph Finance
        NFI[nm_finance\narray]
        NFB[nm_finance_budget]
        NFC[nm_finance_cats]
        NFCO[nm_fin_coach_PERIOD]
    end

    subgraph Health
        NHC[nm_health_cards\narray]
        NHL2[nm_health_log\ndate→energy+sleep+pain]
    end

    subgraph Projects
        NP[nm_projects\narray]
    end

    subgraph Evening
        NM[nm_moments\narray]
        NES[nm_evening_summary]
        NEM[nm_evening_mood\nmood+date]
    end

    subgraph System
        NS[nm_settings]
        NGK[nm_gemini_key]
        NME[nm_memory\n300 слів]
        NMET[nm_memory_ts]
        NAT[nm_active_tabs]
        NTR[nm_trash\nmax200 7днів]
    end

    subgraph OWL
        NOB[nm_owl_board\nmax 3 msg]
        NOBT[nm_owl_board_ts]
        NOBS[nm_owl_board_said\ndate+topics]
        NOTB[nm_owl_tab_TAB\nper-tab msgs]
        NOTBT[nm_owl_tab_ts_TAB]
        NOTBS[nm_owl_tab_said_TAB]
    end
```

---

## 4. OWL Board — тригери проактивних повідомлень

```mermaid
flowchart TD
    T[tryOwlBoardUpdate\nкожні 3 хв] --> CH{Тихий режим?\n23:00-7:00}
    CH -->|так| SKIP[пропустити]
    CH -->|ні| TRG{Тригер активний?}

    TRG --> T1[🌅 7-9 ранок → ранковий бриф]
    TRG --> T2[☀️ 13:00 → обідня перевірка]
    TRG --> T3[🌙 20:00 без підсумку → нагадування]
    TRG --> T4[📅 Пн 8-10 → огляд тижня]
    TRG --> T5[📅 Пт 17+ → підсумок тижня]
    TRG --> T6[⏰ Дедлайн < 1год]
    TRG --> T7[😴 Задача застрягла 3+ дні]
    TRG --> T8[⚡ Звички не виконані після 10:00]
    TRG --> T9[🔥 Стрік під загрозою після 20:00]
    TRG --> T10[🎉 Всі звички виконані]
    TRG --> T11[💰 Бюджет 80%+ витрачено]
    TRG --> T12[💸 Незвична транзакція 2.5x від avg]

    T1 & T2 & T3 & T4 & T5 & T6 & T7 & T8 & T9 & T10 & T11 & T12 --> GEN[getOwlBoardContext\nприоритизація: critical→important→normal]
    GEN --> AI[GPT-4o-mini\nJSON: text + priority + chips]
    AI --> SAVE[saveOwlBoardMessages\nmax 3, sliding window]
    SAVE --> RENDER[renderOwlBoard]
```

---

## 5. Пам'ять агента (Memory System)

```mermaid
flowchart LR
    TRIG[shouldRefreshMemory\n1 раз на день] --> COL[Збір даних]
    COL --> I50[50 останніх\ninbox записів]
    COL --> T8[8 активних\nзадач]
    COL --> N20[20 останніх\nнотаток]
    COL --> PR[Профіль\nкористувача]

    I50 & T8 & N20 & PR --> AI[GPT-4o-mini\n'Сформуй профіль\nmax 300 слів']
    AI --> MEM[nm_memory\nтекстовий профіль]
    MEM --> CTX[getAIContext\nвставляє як 3-й блок]
    CTX --> ALL[всі AI-виклики\nInbox + OWL Board\n+ Tab Bars]
```

---

## 6. Вкладки та їх можливості

```mermaid
graph TD
    APP[NeverMind] --> INB_T[📥 Inbox\nзавжди активна]
    APP --> NOT_T[📝 Нотатки\nзавжди активна]
    APP --> TSK_T[✅ Задачі\nвибіркова]
    APP --> HAB_T[🔥 Звички\nвибіркова]
    APP --> FIN_T[💰 Фінанси\nвибіркова]
    APP --> HLT_T[❤️ Здоров'я\nвибіркова]
    APP --> PRJ_T[🚀 Проекти\nвибіркова]
    APP --> EVE_T[🌙 Вечір + Я\nвибіркова]

    INB_T --> |AI агент| AICORE[GPT-4o-mini\n12 типів дій]
    NOT_T --> |Chat в нотатці| AICORE
    TSK_T --> |AI bar| AICORE
    HAB_T --> |AI bar| AICORE
    FIN_T --> |AI коуч| AICORE
    HLT_T --> |AI bar| AICORE
    PRJ_T --> |AI bar| AICORE
    EVE_T --> |AI рефлексія| AICORE

    AICORE --> MEM_T[nm_memory\nSpільний контекст]
```
