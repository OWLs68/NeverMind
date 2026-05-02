# Рефакторинг документації + «мозок» Claude

> **Статус:** ✅ **ЗАВЕРШЕНО 20.04.2026** (сесія g05tu). 5 фаз зроблено, 5 комітів на гілці `claude/start-session-g05tu`.
> **Попередня точка відкату:** HEAD `e64eb58` (chore: deploy v327 · 20.04 18:22) перед початком рефакторингу.

---

## 📜 Hash'і всіх фаз (для відкату)

| Фаза | Коміт | Опис |
|---|---|---|
| 0 | `d8ecab1` | plan + pre-refactor snapshot at e64eb58 |
| 1 | `f579492` | split CLAUDE/ROADMAP into new docs, shrink SESSION_STATE |
| 2 | `80f9846` | create lessons.md with patterns/anti-patterns/decisions |
| 3 | `90e0f7f` | add 4 automation hooks (CACHE_NAME, INDEX, AI_TOOLS, triggers+Роби) |
| 4 | `004e299` | create _ai-tools/INDEX.md semantic index |
| Фінал | _див. SESSION_STATE_ | update session state + push |

**Повний відкат (потрібен явний "Роби скид" Романа):**
```bash
git reset --hard e64eb58
```

**Безпечний відкат однієї фази:**
```bash
git revert 004e299   # відмінить Фазу 4
git revert 90e0f7f   # відмінить Фазу 3
# ...і т.д.
```

**Повернути один файл у стан ДО:**
```bash
git checkout e64eb58 -- CLAUDE.md
```

---

## 🎯 Мета

1. Навести порядок у документах — **переставити блоки** у правильні файли, **без втрати тексту**.
2. Створити "мозок" Claude — файли які він читає на старті кожного чату щоб зберігати характер, памʼять між сесіями, навігацію у проекті.
3. Додати автоматичні нагадування (хуки) які ловлять типові помилки Claude без витрат на самоперевірку.

**Принцип:** нічого не викидається. Кожен блок тексту **фізично переїжджає** у новий файл. Повернення назад — через `git revert` або `git checkout <hash> -- file`.

---

## 📋 4 фази + фаза 0

### Фаза 0 — Snapshot + план ← **цей коміт**

- [x] HEAD `e64eb58` записаний як точка відкату ДО рефакторингу
- [x] `_ai-tools/REFACTOR_PLAN.md` (цей файл) створено з повним планом
- Коміт: `refactor(phase-0): plan + pre-refactor snapshot at e64eb58`

**Як повернутись до стану ДО рефакторингу (повністю):**
```bash
git reset --hard e64eb58   # ТІЛЬКИ за прямим дозволом Романа (див. CLAUDE.md "Екстрений скид")
# АБО безпечніше — через revert усіх фаз:
git revert <phase-4-hash> <phase-3-hash> <phase-2-hash> <phase-1-hash> <phase-0-hash>
```

---

### Фаза 1 — Рефакторинг документів (1-1.5 сесії)

**Нові файли що створюються:**

| Файл | Зміст | Звідки переноситься |
|---|---|---|
| `ROADMAP_DONE.md` | Завершені Active, Блок 1 малі фікси, аудити 15.04 | `ROADMAP.md` секції `✅ Done`, Блок 1 (повністю закритий), "Результати аудиту 15.04.2026" |
| `docs/FILE_STRUCTURE.md` | Таблиця файлів проекту з відповідальністю | `CLAUDE.md` секція "Файлова структура" |
| `docs/GIT_EMERGENCY.md` | Процедура екстреного скиду + історія v54-v130 | `CLAUDE.md` секція "Екстрений скид" |
| `docs/DO_NOT_TOUCH.md` | Священні корови (що не чіпати без обговорення) | `CLAUDE.md` секція "Що не можна змінювати без обговорення" |
| `docs/FINANCE_V2_PLAN.md` | Фази 1-6 Фінансів v2 + Аналітика | `ROADMAP.md` секція "Фінанси v2" (розгорнуті фази) |

**Зміни в існуючих файлах:**

| Файл | Зараз | Після | Що відбувається |
|---|---|---|---|
| `CLAUDE.md` | 521 | ~300 | Прибираю 5 блоків (див. нові файли вище) + "Плани на розвиток" (→ ROADMAP), "Анімація OWL" (→ ROADMAP `💡 Ideas`), "Архітектурний принцип Один мозок" (→ `NEVERMIND_LOGIC.md`). Лишається: правила процесу + карта документації |
| `ROADMAP.md` | 715 | ~350 | Прибираю завершені Active, Блок 1, аудити, розгорнуті фази Фінансів. Лишається: Active / Next (короткі bullet) / Ideas / Rejected / After Supabase |
| `_ai-tools/SESSION_STATE.md` | 293 | ~80 | Таблиця-однорядковий лог усіх сесій + бриф останньої (детальні описи → `docs/CHANGES.md`) |
| `START_HERE.md` | 114 | ~50 | Тільки точка входу — які 4 файли читати на старті + посилання на карту у CLAUDE.md |
| `NEVERMIND_LOGIC.md` | 56 | ~70 | Додаю секцію "Один мозок на все" (винесено з CLAUDE.md) |

**Коміт:** `refactor(phase-1): split CLAUDE/ROADMAP into new docs, shrink SESSION_STATE`

**Відкат Фази 1 окремо:**
```bash
git revert <phase-1-hash>   # створить новий коміт що відмінить Фазу 1
# або один файл:
git checkout e64eb58 -- CLAUDE.md
```

---

### Фаза 2 — `lessons.md` (0.3 сесії)

Файл **не існує** — створюю новий з трьома секціями:

1. **🔄 Робочі патерни** — "коли задача X → я роблю Y, Z"
2. **❌ Анти-патерни** — "як часто ламаюсь і чому"
3. **📋 Журнал рішень** — "чому обрали варіант A а не B" (щоб не переграти у новому чаті)

Початковий заповнення — 3-5 реальних прикладів з цього проекту (з `SESSION_STATE.md` і `CHANGES.md`). Далі я сам дописую у нових сесіях з "Роби".

**Коміт:** `refactor(phase-2): create lessons.md with patterns/anti-patterns/decisions`

---

### Фаза 3 — Хуки автопілот (0.5 сесії)

**Існує зараз** (не чіпаю):
- `permissions.deny` у `.claude/settings.json` — вже блокує `git push --force`, `git reset --hard`, `rm -rf` ✅
- `SessionStart` hook — нагадує процес + тригери скілів ✅
- `UserPromptSubmit` → `rules-reminder.sh` (кожне 5-те + тригер-слова) ✅
- `UserPromptSubmit` → `context-warning.sh` (80/90% контексту) ✅
- `PostToolUse Edit|Write` → `node --check` для JS синтаксису ✅

**Додаю нових 4:**

| # | Хук | Файл | Що робить |
|---|---|---|---|
| 1 | `PostToolUse` Edit/Write на `src/*`, `*.css`, `sw.js`, `index.html` | `.claude/hooks/cache-name-reminder.sh` | Нагадує оновити `CACHE_NAME` у `sw.js` + дає команду `date` |
| 2 | `PostToolUse` Write на `*.md` | `.claude/hooks/md-index-reminder.sh` | Нагадує додати новий `.md` у `_ai-tools/INDEX.md` і "Карту документації" у `CLAUDE.md` |
| 3 | `PostToolUse` Edit на `src/ai/prompts.js` або `src/ai/ui-tools.js` | `.claude/hooks/ai-tools-sync.sh` | Нагадує оновити `docs/AI_TOOLS.md` |
| 4 | `UserPromptSubmit` — розширення `rules-reminder.sh` новою логікою | `.claude/hooks/skill-triggers.sh` (новий) + `robi-detector.sh` (новий) | Ловить тригери скілів ("модалка", "колір", "PWA", "рефакторинг") і слово "Роби" |

**Коміт:** `refactor(phase-3): add automation hooks (CACHE_NAME, INDEX, AI_TOOLS, triggers, Роби)`

**Тест хуків:** після коміту — зробити тестову зміну у `src/core/utils.js` (додати комент) і перевірити що спрацьовує cache-name-reminder.

---

### Фаза 4 — `_ai-tools/INDEX.md` (0.5 сесії)

Створюю останнім — коли всі файли вже на місцях. Семантичний індекс "куди йти за чим":

```
iOS-баг свайпу → docs/PWA_ISSUES.md §iOS-swipe (якщо такий буде)
Колір модалки → docs/DESIGN_SYSTEM.md §modals
Як працює деплой → docs/TECHNICAL_REFERENCE.md §deploy
Що робили сесія NRw8G → docs/CHANGES.md §20.04-NRw8G
Екстрений скид git → docs/GIT_EMERGENCY.md
Священні корови → docs/DO_NOT_TOUCH.md
Фінанси v2 фази → docs/FINANCE_V2_PLAN.md
OWL промпт → src/ai/prompts.js §getOWLPersonality
...
```

**Коміт:** `refactor(phase-4): create _ai-tools/INDEX.md semantic index`

---

### Фаза 5 (фінал) — SESSION_STATE update + push

- Оновлюю `_ai-tools/SESSION_STATE.md` з результатами рефакторингу (короткий бриф сесії g05tu)
- `git push -u origin claude/start-session-g05tu`
- Перевіряю що auto-merge відбувся і деплой пройшов (v328+)

**Коміт:** `docs(finish g05tu): record refactor results + next steps`

---

## 🔙 Повний довідник відкату

### Сценарій 1: "Все погано, поверни як було"

```bash
git reset --hard e64eb58   # ТІЛЬКИ з явним "Роби скид" Романа
```

### Сценарій 2: "Одна фаза зайва"

```bash
git revert <phase-N-hash>   # створить коміт-відміну, історію збереже
```

### Сценарій 3: "Хочу повернути один файл"

```bash
git checkout e64eb58 -- CLAUDE.md   # повертає ТІЛЬКИ CLAUDE.md у стан ДО
```

### Сценарій 4: "Хочу точково редагувати новий файл"

Просто Edit — кожен новий файл це звичайний текст у git. Повний історій через `git log docs/GIT_EMERGENCY.md`.

---

## ✅ Чеклист після кожної фази

- [ ] Коміт з префіксом `refactor(phase-N):`
- [ ] `wc -l` всіх змінених файлів — щоб бачити чи розмір відповідає плану
- [ ] Git diff — переконатись що нічого не загубилось (видалене з файлу A має бути у файлі B)
- [ ] Оновити TodoWrite статус

---

## 🎯 Очікуваний результат (на старті нового чату)

- На `/start` читаю ~600 рядків замість 2164 (−72%)
- Глибокі відповіді через INDEX → читаю тільки потрібну секцію файлу
- Хуки ловлять CACHE_NAME / INDEX / AI_TOOLS автоматично
- Характер стабільний через `lessons.md` + інʼєкція через хуки

---

_Останнє оновлення: 2026-04-20 (сесія g05tu, фаза 0 start)_
