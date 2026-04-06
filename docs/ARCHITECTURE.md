# NeverMind — Архітектура системи

> **Де що шукати:** повна таблиця файлів з відповідальністю → `CLAUDE.md` секція "Файлова структура".
> Цей файл містить **діаграми потоків** (data flow, triggers, memory) які доповнюють текстовий опис.

---

## 1. Граф модулів (збірка)

Проект використовує **ES Modules** з бандлером `esbuild`. Вхідна точка `src/app.js` імпортує всі модулі у правильному порядку (критично для сумісності з iOS). Бандлер генерує `bundle.js` який підключається одним `<script>` тегом в `index.html`.

```mermaid
graph TD
    HTML["index.html<br/>(UI + bundle.js script tag)"]
    BUNDLE["bundle.js<br/>(згенерований esbuild)"]
    APP["src/app.js<br/>(точка входу)"]

    subgraph "Core (ядро)"
        NAV["core/nav.js<br/>(switchTab, теми, settings)"]
        BOOT["core/boot.js<br/>(ініціалізація, PWA, cross-tab sync)"]
        TRASH["core/trash.js<br/>(кошик, 7 днів TTL)"]
        UTILS["core/utils.js<br/>(escapeHtml, formatTime)"]
        LOGGER["core/logger.js<br/>(error logging)"]
    end

    subgraph "AI"
        AICORE["ai/core.js<br/>(getAIContext, callAI, chat storage)"]
    end

    subgraph "OWL (проактивний агент)"
        OWLBOARD["owl/inbox-board.js<br/>(OWL Board Inbox)"]
        OWLTABS["owl/board.js<br/>(OWL Tab Boards)"]
        OWLPROACT["owl/proactive.js<br/>(генерація повідомлень)"]
        OWLCHIPS["owl/chips.js<br/>(renderChips, CHIP_PROMPT_RULES,<br/>fuzzy match, handleChipClick)"]
    end

    subgraph "UI helpers"
        KEYBOARD["ui/keyboard.js<br/>(iOS keyboard hack)"]
        SWIPE["ui/swipe-delete.js<br/>(swipe trail)"]
    end

    subgraph "Tabs (вкладки)"
        INBOX["tabs/inbox.js"]
        TASKS["tabs/tasks.js"]
        HABITS["tabs/habits.js"]
        NOTES["tabs/notes.js"]
        FINANCE["tabs/finance.js"]
        HEALTH["tabs/health.js"]
        PROJECTS["tabs/projects.js"]
        EVENING["tabs/evening.js"]
        ONB["tabs/onboarding.js"]
    end

    HTML --> BUNDLE
    BUNDLE --> APP
    APP --> NAV
    APP --> BOOT
    APP --> AICORE
    APP --> OWLBOARD
    APP --> OWLTABS
    APP --> INBOX
    APP -.->|"та інші<br/>у порядку"| TASKS

    INBOX --> AICORE
    INBOX --> TASKS
    INBOX --> NOTES
    INBOX --> HABITS
    INBOX --> EVENING

    TASKS --> AICORE
    HABITS --> AICORE
    NOTES --> AICORE
    FINANCE --> AICORE
    EVENING --> AICORE
    HEALTH --> AICORE
    PROJECTS --> AICORE

    OWLBOARD --> AICORE
    OWLBOARD --> OWLCHIPS
    OWLTABS --> OWLCHIPS
    OWLPROACT --> AICORE
    OWLPROACT --> OWLCHIPS
    AICORE --> OWLCHIPS
    OWLCHIPS --> TASKS
    OWLCHIPS --> HABITS

    EVENING --> HABITS
    EVENING --> TASKS
    EVENING --> NOTES

    style AICORE fill:#d4e8d8
    style INBOX fill:#fdb87a
    style NAV fill:#e8d5c4
    style BOOT fill:#e8d5c4
```

**Ключове:** `src/ai/core.js` — єдиний мозок. Всі AI-виклики проходять через нього. Кожна вкладка має свій AI bar який викликає `callAI()` з відповідним контекстом з `getAIContext()`.

---

## 2. Flow: Юзер пише в Inbox

```mermaid
flowchart TD
    A[Юзер пише повідомлення] --> B["sendToAI<br/>(відправити до ШІ)"]
    B --> C["getAIContext<br/>(зібрати контекст — що знає агент)"]
    C --> D["context = дата + профіль + пам'ять<br/>+ задачі + звички + inbox сьогодні<br/>+ фінанси + кошик + OWL board msg"]
    D --> E["callAIWithHistory<br/>(виклик GPT-4o-mini з історією розмови)"]
    E --> F{"Парсинг JSON<br/>(розбір відповіді ШІ)"}
    F -->|"parse error"| G["saveOffline<br/>(зберегти без ШІ, просто в inbox)"]
    F -->|ok| H{"action.action<br/>(яка дія?)"}

    H -->|"save"| I["processSaveAction<br/>(обробити збереження)"]
    H -->|"save_finance"| J["processFinanceAction"]
    H -->|"complete_habit"| K["processCompleteHabit"]
    H -->|"complete_task"| L["processCompleteTask"]
    H -->|"clarify"| M["showClarify modal<br/>(показати вибір варіантів)"]
    H -->|"add_step"| N["додати кроки до задачі"]
    H -->|"create_project"| O["новий проект"]
    H -->|"restore_deleted"| P["searchTrash → restoreFromTrash"]
    H -->|"reply"| Q["addInboxChatMsg agent<br/>(показати відповідь агента)"]

    I --> I1{"category<br/>(категорія запису)"}
    I1 -->|"task"| I2["getTasks → saveTasks"]
    I1 -->|"note/idea"| I3["addNoteFromInbox"]
    I1 -->|"habit"| I4["getHabits → saveHabits"]
    I1 -->|"event"| I5["getMoments → saveMoments"]
    I1 -->|all| I6["saveInbox → renderInbox"]
```

---

## 3. Карта даних (localStorage)

> **localStorage** — вбудоване сховище браузера. Ключ → значення. Всі дані застосунку тут.

```mermaid
graph LR
    subgraph "Inbox"
        NI["nm_inbox<br/>(масив записів)"]
        NCI["nm_chat_inbox<br/>(чат макс 30 повід.)"]
    end

    subgraph "Tasks"
        NT["nm_tasks"]
        NCT["nm_chat_tasks"]
        NTC["nm_task_chat_ID<br/>(чат конкретної задачі)"]
    end

    subgraph "Notes"
        NN["nm_notes"]
        NF["nm_folders_meta"]
    end

    subgraph "Habits"
        NH["nm_habits2"]
        NHL["nm_habit_log2"]
        NQL["nm_quit_log<br/>(quit-звички)"]
    end

    subgraph "Finance"
        NFI["nm_finance"]
        NFB["nm_finance_budget"]
        NFC["nm_finance_cats"]
        NFCO["nm_fin_coach_PERIOD<br/>(кеш AI, TTL 24h)"]
    end

    subgraph "Health"
        NHC["nm_health_cards"]
        NHL2["nm_health_log"]
    end

    subgraph "Projects"
        NP["nm_projects"]
    end

    subgraph "Evening / Me"
        NM["nm_moments"]
        NES["nm_evening_summary"]
        NEM["nm_evening_mood"]
    end

    subgraph "System"
        NS["nm_settings"]
        NGK["nm_gemini_key<br/>(насправді OpenAI, legacy-назва)"]
        NME["nm_memory<br/>(AI-профіль, 300 слів)"]
        NAT["nm_active_tabs"]
        NTR["nm_trash<br/>(макс 200, TTL 7 днів)"]
    end

    subgraph "OWL"
        NOB["nm_owl_board<br/>(Inbox табло)"]
        NOBT["nm_owl_board_ts"]
        NOBS["nm_owl_board_said<br/>(антиповтор)"]
        NOTB["nm_owl_tab_TAB<br/>(по вкладках)"]
        NOTBT["nm_owl_tab_ts_TAB"]
    end
```

**Повна таблиця ключів з модулями** → `CLAUDE.md` секція "Дані (localStorage)".

---

## 4. OWL Board — тригери проактивних повідомлень

```mermaid
flowchart TD
    T["tryOwlBoardUpdate<br/>(кожні 3 хв)"] --> CH{"Тихий режим?<br/>23:00-7:00<br/>(ніч — мовчати)"}
    CH -->|так| SKIP[пропустити]
    CH -->|ні| TRG{"Тригер активний?"}

    TRG --> T1[🌅 7-9 ранок → ранковий бриф]
    TRG --> T2[☀️ 13:00 → обідня перевірка]
    TRG --> T3[🌙 20:00 без підсумку → нагадування]
    TRG --> T4[📅 Пн 8-10 → огляд тижня]
    TRG --> T5[📅 Пт 17+ → підсумок тижня]
    TRG --> T6[⏰ Дедлайн задачі < 1 год]
    TRG --> T7[😴 Задача не рухається 3+ дні]
    TRG --> T8[⚡ Звички не виконані після 10:00]
    TRG --> T9[🔥 Стрік під загрозою після 20:00]
    TRG --> T10[🎉 Всі звички виконані]
    TRG --> T11[💰 Бюджет 80%+ витрачено]
    TRG --> T12[💸 Транзакція 2.5x від звичної]

    T1 & T2 & T3 & T4 & T5 & T6 & T7 & T8 & T9 & T10 & T11 & T12 --> GEN["getOwlBoardContext<br/>(пріоритет: critical → important → normal)"]
    GEN --> AI["GPT-4o-mini<br/>(JSON: текст + пріоритет + чіпи)"]
    AI --> SAVE["saveOwlBoardMessages<br/>(макс 3 повідомлення,<br/>старі витісняються)"]
    SAVE --> RENDER["renderOwlBoard<br/>(відмалювати на екрані)"]
```

**Релевантні файли:** `src/owl/proactive.js` (тригери і генерація), `src/owl/inbox-board.js` (Inbox табло), `src/owl/board.js` (Tab boards).

---

## 5. Пам'ять агента (Memory System)

```mermaid
flowchart LR
    TRIG["shouldRefreshMemory<br/>(1 раз на день)"] --> COL["Збір даних"]
    COL --> I50["50 останніх<br/>inbox записів"]
    COL --> T8["8 активних задач"]
    COL --> N20["20 останніх нотаток"]
    COL --> PR["Профіль<br/>(ім'я, вік з settings)"]

    I50 & T8 & N20 & PR --> AI["GPT-4o-mini<br/>(Сформуй профіль людини,<br/>max 300 слів, патерни)"]
    AI --> MEM["nm_memory<br/>(текстовий профіль)"]
    MEM --> CTX["getAIContext<br/>(3-й блок контексту)"]
    CTX --> ALL["всі AI-виклики<br/>Inbox + OWL Board<br/>+ AI бари вкладок"]
```

**Модуль:** `src/ai/core.js` — функції `getAIContext()`, `shouldRefreshMemory()`, `buildMemoryProfile()`.

---

## 6. Вкладки та AI-інтеграція

```mermaid
graph TD
    APP[NeverMind] --> INB_T["📥 Inbox<br/>(головна, завжди активна)"]
    APP --> NOT_T["📝 Нотатки<br/>(завжди активна)"]
    APP --> TSK_T["✅ Задачі<br/>(вибіркова)"]
    APP --> HAB_T["🔥 Звички<br/>(вибіркова)"]
    APP --> FIN_T["💰 Фінанси<br/>(вибіркова)"]
    APP --> HLT_T["❤️ Здоров'я<br/>(вибіркова)"]
    APP --> PRJ_T["🚀 Проекти<br/>(вибіркова)"]
    APP --> EVE_T["🌙 Вечір + Я<br/>(вибіркова)"]

    INB_T --> |"AI агент<br/>(12 типів дій)"| AICORE["src/ai/core.js<br/>GPT-4o-mini"]
    NOT_T --> |"Chat в нотатці"| AICORE
    TSK_T --> |"AI bar"| AICORE
    HAB_T --> |"AI bar"| AICORE
    FIN_T --> |"AI коуч (кешований)"| AICORE
    HLT_T --> |"AI bar"| AICORE
    PRJ_T --> |"AI bar"| AICORE
    EVE_T --> |"AI рефлексія"| AICORE

    AICORE --> MEM_T["nm_memory<br/>(спільна пам'ять усіх вкладок)"]
```

**Ключовий принцип:** єдиний мозок. Кожна вкладка бачить той самий контекст через `getAIContext()`. Агент не плутається між вкладками — пам'ятає що користувач робив у Фінансах коли пише у Задачі.

---

## Важливі технічні нюанси (чому так зроблено)

- **AI бари поза `.page` div** — `position:fixed` всередині `transform` не працює на iOS Safari
- **`safeAgentReply`** — завжди замість прямого `addMsg('agent', reply)` — перевіряє чи не сирий JSON
- **Вечір не копіює дані** — читає напряму з `nm_notes` і `nm_moments` при рендері (правило: "Копіювати дані між storage — заборонено")
- **SW кеш (`CACHE_NAME`)** — ім'я `nm-YYYYMMDD-HHMM` оновлюється вручну перед пушем. CI **не** чіпає `sw.js`. Правило з `CLAUDE.md`.
- **Порядок імпортів у `src/app.js`** — критичний, повторює порядок старих `<script>` тегів для уникнення циклічних залежностей

---

> Архів старої версії цього файлу (з описом флат-структури `app-*.js` до ES-modules рефакторингу) → `_archive/NEVERMIND_ARCH.md`.
