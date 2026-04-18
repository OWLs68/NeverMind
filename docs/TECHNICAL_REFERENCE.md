# NeverMind — Технічна довідка

> **Що це:** технічні деталі що Клод читає за потреби — як працює деплой, AI flow, структури даних у localStorage, міжмодульні залежності.
> **Винесено з `CLAUDE.md` 18.04.2026 (сесія FMykK).** У CLAUDE.md залишаються правила + файлова структура + карта документації.
> **Коли читати:** перед роботою з відповідною частиною коду (наприклад, перед змінами у Inbox flow — розділ "AI-логіка"; перед додаванням нового storage ключа — розділ "Дані localStorage").

---

## 📚 Зміст

1. [Система деплою](#система-деплою) — CI/CD, auto-merge, cache-bust
2. [AI-логіка](#ai-логіка) — Inbox flow, контекст, OWL Board
3. [Дані (localStorage)](#дані-localstorage) — всі ключі з описом
4. [Структури даних](#структури-даних) — JS типи об'єктів
5. [Міжмодульні залежності](#міжмодульні-залежності) — граф імпортів

---

## Система деплою

**Флоу:** Claude пушить у `claude/**` → `auto-merge.yml` мержить у `main`, збирає bundle, деплоїть на GitHub Pages.

**`auto-merge.yml` робить (ОДИН job, послідовно):**
1. `git merge --no-edit -X theirs <feature-branch>` — при конфліктах feature-гілка виграє
2. `sed` оновлює badge в `index.html` (Amsterdam час деплою) + `?v=...` параметри у `<link>` і `<script>` (cache-bust, див. нижче)
3. `npm ci && node build.js` — збирає bundle.js з src/
4. Комітить bundle.js і пушить у `main`
5. Upload artifact + Deploy to GitHub Pages — **в тому ж job**, без race condition

**Чому один job:** раніше deploy був окремим job і міг взяти стару версію main (race condition — стан гонки між push і checkout). Тепер merge → build → push → deploy послідовно в одному job.

**Чому `-X theirs`:** і Claude, і CI змінюють `sw.js` CACHE_NAME → конфлікт → CI падає тихо. `-X theirs` вирішує на користь feature-гілки.

**`concurrency: cancel-in-progress: true`** — якщо новий push приходить поки CI ще працює, попередній CI скасовується. Тому при частих пушах деплоїться тільки останній.

### Cache-bust для style.css і bundle.js (додано 17.04.2026 сесія 14zLe)

**Проблема:** Safari на iOS має два рівні кешу — SW кеш (наш, `CACHE_NAME`) і власний HTTP-кеш браузера. Без cache-bust параметра у URL другий кеш тримає `style.css` і `bundle.js` агресивно — після деплою бейдж версії оновлюється (HTML з `Cache-Control: no-cache`), але стилі і логіка застосунку залишаються старими.

**Рішення:** `index.html` містить `?v=VERSION-YYYYMMDD-HHMM` параметр у `<link href="style.css?v=...">` і `<script src="bundle.js?v=...">`. CI (`auto-merge.yml`) при кожному деплої `sed`'ом замінює цей параметр на свіжу мітку (`v${NEW_VERSION}-$(date +%Y%m%d-%H%M)`). Safari бачить новий URL і завантажує файли свіжими. **Ручне втручання не потрібне — все автоматично.**

**Правила:**
- НЕ видаляти `?v=...` параметри з `index.html` — інакше sed у CI не знайде що замінити і кеш-бастинг зламається.
- Якщо додаєш нове підключення CSS/JS (`<link>` / `<script>`) — додавай `?v=PLACEHOLDER` і додавай відповідний sed у `auto-merge.yml` поруч з існуючими.
- `?v=...` НЕ заміняє `CACHE_NAME` у `sw.js` — це **другий шар** кеш-інвалідації (для HTTP-кешу Safari поверх SW). Обидва потрібні.

---

## AI-логіка

### Inbox flow (з 10.04 — OpenAI Tool Calling)
```
Юзер пише → sendToAI() → getAIContext() → callAIWithTools(prompt, history, INBOX_TOOLS)
→ OpenAI повертає msg.tool_calls[] (гарантовано валідна структура, без JSON.parse)
→ for each tool_call:
    _toolCallToAction(name, args) → старий action format
    → dispatch через існуючі handlers:
       save_task/note/habit/moment → processSaveAction() → inbox + вкладки
       save_finance                → processFinanceAction()
       complete_habit/task         → processCompleteHabit/Task()
       clarify                     → showClarify() → модалка з варіантами
       add_step                    → додати кроки до task
       create_project              → новий проект + startProjectInboxInterview()
       create_event                → inline (nm_events + inbox entry)
       restore_deleted             → searchTrash() → restoreFromTrash()
       save_routine                → inline (nm_routine)
       update_transaction          → inline (зміна fin запису)
       edit_*/delete_*/reopen_task → processUniversalAction() у habits.js
→ msg.content (якщо є) → показується як follow-up повідомлення від агента

Якщо msg.tool_calls немає → msg.content = reply (просто текст)
```

**INBOX_TOOLS** — 31 function definitions у `src/ai/prompts.js` (було у `core.js` до рефакторингу 17.04 14zLe). Описують всі можливі дії з параметрами. AI ОБОВ'ЯЗКОВО вибирає одну чи кілька функцій замість тексту JSON. Промпт скорочений з ~200 до ~30 рядків — він тільки класифікує (task vs event vs project), самі формати у tool definitions.

**Backward compat:** `callAI()`, `callAIWithHistory()`, `callOwlChat()` працюють БЕЗ tools для tab chat bars і proactive.js (вони ще на текстовому форматі).

### AI контекст (getAIContext повертає)
1. Дата/час/день тижня (укр)
2. Профіль користувача (з налаштувань)
3. `nm_facts` — структуровані факти з часовими мітками (формат `formatFactsForContext()`). Заповнюється через tool calling (save_memory_fact у Inbox) + фонова екстракція раз на день (doRefreshMemory). Fallback на legacy `nm_memory` поки не пройшла міграція.
4. Останні 8 активних задач з ID
5. Всі звички з статусом виконання сьогодні
6. Останні 8 записів inbox сьогодні
7. Фінансовий контекст (бюджет, витрати)
8. Кошик (для відновлення видаленого)
9. **Поточне повідомлення OWL на табло** — текст з `nm_owl_board` або `nm_owl_tab_{tab}` + інструкція для AI: "якщо користувач відповідає на це — це відповідь на питання OWL, НЕ нова задача/нотатка"

### OWL Board — концепція взаємодії

**Два канали, один мозок:**
- **Табло (Board)** = ініціатива агента. Read-only. Агент проактивно говорить першим — поради, нагадування, питання. Користувач НЕ друкує в табло.
- **Чат-бар (Chat Bar)** = ініціатива користувача. Поле вводу внизу екрану + вікно чату. Вся взаємодія юзера з агентом — тут.

**Як це працює:**
1. Табло показує проактивне повідомлення з чіпами (швидкі відповіді)
2. Тап на чіп → `owlChipToChat(tab, text)` — два типи:
   - **Навігаційні чіпи** (задачі/звички/підсумки/нотатки/фінанси/здоров'я/проекти) → `switchTab()`
   - **Текстові чіпи** → відкривають чат-бар і відправляють як повідомлення
3. Кнопка "Поговорити" → `openChatBar(tab)` → порожній чат-бар
4. Свайп вниз з speech → `openChatBar(tab)`
5. Проактивні повідомлення дублюються в `nm_chat_{tab}`

**Контекст для AI:** `getAIContext()` включає поточне повідомлення табло → AI розуміє коли юзер відповідає на питання OWL, а не створює нову задачу/нотатку.

**Пам'ять агента:**
- Зберігає до 30 повідомлень табло (Inbox + кожна вкладка)
- При генерації нового — бачить 20 останніх з часом → будує діалог, не повторюється
- `nm_memory` (портрет користувача) передається в промпт табло → персоналізовані чіпи і поради
- Детекція активних вкладок → агент цікавиться тільки тим що використовує користувач

**Технічні деталі:**
- Генерація: кожні 3 хв (`OWL_BOARD_INTERVAL`), активний 7:00-23:00
- Cooldown-система (`nm_owl_cooldowns`) — антиповтор
- `getDayPhase()` + `getSchedule()` — фази дня під розклад користувача
- Рендер: `renderTabBoard(tab)` — єдина функція для ВСІХ вкладок
- 2 стани: `speech` (бабл з текстом) і `collapsed` (згорнутий рядок)
- Мова: людська, без жаргону (стрік, трекер, прогрес заборонені в промпті)

**🦉 Анімація сови (TODO):** планується SVG/Lottie анімацію OWL-персонажа іншою нейромережею (Claude погано генерує анімації). Роман створить окремо, Claude вставить у файли. Ідеї: кивок на нове повідомлення, поворот голови при відповіді, опущені крила при помилці, змах крилом при вітанні.

---

## Дані (localStorage)

_Блок буде заповнений._

---

## Структури даних

_Блок буде заповнений._

---

## Міжмодульні залежності

_Блок буде заповнений._
