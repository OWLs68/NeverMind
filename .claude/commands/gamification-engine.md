# /gamification-engine — Прогрес-бари, ачівки, мікро-анімації

Цей скіл активується коли задача у `ROADMAP.md` → **Блок 3** (геймифікація). Стандартизує: прогрес-бари, ачівки, streak-індикатори, мікро-анімації. **НЕ застосовувати до Блока 3** — зараз Блок 2 (концепції вкладок).

---

## ⚠️ Перед виконанням — обов'язкові перевірки

1. **Геймифікація — окрема фаза у `ROADMAP.md`, Блок 3.** Зараз активні:
   - Блок 1 (пам'ять, здоров'я, OWL) — завершено
   - Блок 2 (концепції вкладок — Фінанси / Вечір / Я / Проекти) — **АКТИВНИЙ**
   - Блок 3 (геймифікація) — НЕ почато
   
   Якщо Роман просить геймифікацію до Блока 3 — перепитай чи готові закрити Блок 2 першим.

2. **Заборонені анти-патерни (з ROADMAP.md / _archive/FEATURES_ROADMAP.md).** NeverMind — **не гра**, не Duolingo. Геймифікація тут — **м'які підкріплення**, не змагання. Жорсткі табу:
   - ❌ **Бали / очки / XP** — не заводити. NeverMind не про "нарахування".
   - ❌ **Рейтинги / ліги / порівняння з іншими** — ми персональний агент, не social.
   - ❌ **Push-сповіщення "ти втратив стрік!"** — тиск, руйнує емпатію OWL (правило з `getOWLPersonality()`).
   - ❌ **Таймери зворотного відліку** до наступної ачівки — штучний стрес.
   - ❌ **Модалки "Вітаємо!"** що блокують використання — тільки toast/inline.
   - ❌ **Лічильники у заголовках вкладок** (червоні бейджі з числом) — іOS звичка яку юзери ненавидять.
   
   **Якщо функція у задачі має хоч одне з цього — зупинись і перепитай.**

3. **Стилі анімацій — ЄДИНИЙ стиль з `/owl-motion`.** Не вводити нові бібліотеки (Lottie, Anime.js, GSAP). Чисті CSS keyframes.

4. **Не переписувати існуючі streak-механіки у `src/tabs/habits.js`.** Там уже є `nm_quit_log` зі стріками для quit-звичок і лог виконання для build-звичок. Геймифікація — **візуалізація поверх існуючого**, не паралельна логіка.

5. **Принцип "ОДИН МОЗОК" (CLAUDE.md).** OWL має знати про ачівки — через `nm-data-changed` подію при розблокуванні, щоб OWL міг прокоментувати на табло.

6. **Стиль градієнтів — з `docs/DESIGN_SYSTEM.md`.** orange/green/amber/darkNavy. **НЕ** фіолет (заборонено).

7. **CACHE_NAME bump** після зміни коду.

**Якщо хоч одна перевірка знаходить конфлікт — зупинись і повідом Роману.**

---

## Філософія: що ми робимо і чого НЕ робимо

| Робимо ✅ | НЕ робимо ❌ |
|-----------|--------------|
| Прогрес-бари ("5/7 днів тижня зі звичкою") | Бали / очки / XP |
| Мікро-анімація при закритті задачі (короткий fade + galочка) | Рейтинги, ліги, порівняння з іншими |
| Streak-індикатор поруч зі звичкою ("12 днів поспіль") | Push-сповіщення "ти втратив стрік!" |
| Ачівки як тиха відмітка на вкладці "Я" (без модалки) | Модалки "Вітаємо!" що блокують |
| Денний скор (наш існуючий у `src/tabs/evening.js`) | Штучні таймери до наступної ачівки |
| Тихий emoji/іконка у OWL table при важливих віхах | Червоні бейджі з числом у заголовках |

Ключова концепція: **геймифікація як зворотний зв'язок про прогрес**, не як змагання чи тиск.

---

## Крок 1 — Визначити тип геймифікаційного елемента

### 1.1 Прогрес-бар

Лінійний індикатор "зроблено X з Y". Використовувати для:
- Кроки задачі (вже є у `.task-card`)
- Тижневий прогрес звички
- Бюджет місяця (вже є у `src/tabs/finance.js`)

**CSS шаблон:**
```css
.progress-track {
  height: 6px;
  background: rgba(30,16,64,0.08);
  border-radius: 3px;
  overflow: hidden;
}
.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #f97316, #ea580c);  /* orange для задач */
  transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
}
```

### 1.2 Streak-індикатор

Число днів поспіль. Існуючий патерн у `src/tabs/habits.js` → `getQuitLog()`.

**Візуал:**
```html
<div class="habit-streak" aria-label="12 днів поспіль">
  <span class="streak-icon">🔥</span>
  <span class="streak-count">12</span>
</div>
```

**Правило:** streak скидається ТІЛЬКИ на фактичний пропуск, не на "день ще не закінчився". Перевір логіку у `habits.js` перед правкою.

### 1.3 Ачівка (тиха)

**НЕ** модалка. Відмітка на вкладці "Я" (`src/tabs/evening.js`) + повідомлення OWL через `nm_owl_board`.

**Структура даних (новий ключ):**
```javascript
// localStorage: nm_achievements
[
  { id: 'habits_7days', name: 'Тиждень без пропуску', unlockedAt: 1713024000000, tab: 'habits' },
  // ...
]
```

**Розблокування:**
```javascript
function unlockAchievement(id, data) {
  const unlocked = JSON.parse(localStorage.getItem('nm_achievements') || '[]');
  if (unlocked.some(a => a.id === id)) return; // вже є — не дублюй
  unlocked.push({ id, ...data, unlockedAt: Date.now() });
  localStorage.setItem('nm_achievements', JSON.stringify(unlocked));
  window.dispatchEvent(new CustomEvent('nm-data-changed', { detail: 'achievement' }));
  // OWL прокоментує через proactive.js — без окремого toast
}
```

### 1.4 Мікро-анімація

Короткий візуальний сигнал (<600ms). Без блокування.

**CSS keyframes — спільний стиль з `/owl-motion`:**
```css
@keyframes taskDone {
  0% { transform: scale(1); }
  50% { transform: scale(1.05); background-color: rgba(34, 197, 94, 0.15); }
  100% { transform: scale(1); }
}
.task-card.just-completed {
  animation: taskDone 0.6s ease-out;
}

@keyframes streakPulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.15); }
}
.habit-streak.pulse {
  animation: streakPulse 0.4s ease-in-out;
}

@media (prefers-reduced-motion: reduce) {
  .task-card.just-completed, .habit-streak.pulse { animation: none !important; }
}
```

### 1.5 Денний скор (існує!)

`src/tabs/evening.js` уже рахує денний скор. **НЕ дублювати логіку** — розширювати існуючу функцію.

---

## Крок 2 — Перелік ачівок (обговорити з Романом ПЕРЕД кодом)

**Приклади, не фінальний список:**

| ID | Назва | Умова | Вкладка |
|----|-------|-------|---------|
| `tasks_50done` | 50 закритих задач | `tasks.filter(done).length >= 50` | Задачі |
| `habits_7days` | Тиждень без пропуску | 7 днів поспіль виконана хоча б 1 звичка | Звички |
| `habits_30days` | Місяць стабільності | 30 днів поспіль | Звички |
| `quit_30days` | Місяць без [X] | Quit-звичка 30 днів | Звички |
| `finance_month_budget` | Місяць у бюджеті | Не перевищив місячний бюджет | Фінанси |
| `notes_100` | 100 думок записано | nm_notes.length >= 100 | Нотатки |
| `moments_30days` | Місяць моментів | 30 днів поспіль записаний хоча б 1 момент | Вечір |
| `projects_first` | Перший закритий проект | Проект зі status='done' | Проекти |

**Перед імплементацією:** Роман обирає з цього списку або пропонує свій. Повний список НЕ робити одразу — ризик "галереї досягнень" що ніхто не розблокує.

## Крок 3 — Перевірка розблокування

Додати до `unlockAchievement` у кожній save-функції де умова може спрацювати:

```javascript
// у src/tabs/tasks.js після saveTasks:
function checkTaskAchievements() {
  const tasks = getTasks();
  const doneCount = tasks.filter(t => t.status === 'done').length;
  if (doneCount >= 50) unlockAchievement('tasks_50done', { tab: 'tasks', count: doneCount });
}

saveTasks(arr) {
  localStorage.setItem('nm_tasks', JSON.stringify(arr));
  window.dispatchEvent(new CustomEvent('nm-data-changed', { detail: 'tasks' }));
  checkTaskAchievements();  // ← тут
}
```

**Принцип:** перевірка локальна у save-функції, не глобальний listener. Так уникаємо "скрізь однієї великої функції розблокування".

## Крок 4 — UI ачівок на вкладці "Я"

Розширити `src/tabs/evening.js` (секція "Я"):

```html
<div class="achievements-grid" role="list" aria-label="Досягнення">
  <!-- Розблоковані -->
  <div class="achievement-card unlocked" role="listitem">
    <div class="achievement-icon">🔥</div>
    <div class="achievement-name">Тиждень без пропуску</div>
    <div class="achievement-date">Розблоковано 12 квітня</div>
  </div>
  <!-- Заблоковані (передпоказ) -->
  <div class="achievement-card locked" role="listitem">
    <div class="achievement-icon" aria-hidden="true">🔒</div>
    <div class="achievement-name">Місяць стабільності</div>
    <div class="achievement-progress">14 / 30 днів</div>
  </div>
</div>
```

**CSS:**
```css
.achievement-card.unlocked { opacity: 1; }
.achievement-card.locked { opacity: 0.4; filter: grayscale(1); }
```

## Крок 5 — OWL коментує розблокування

Додати у `src/owl/proactive.js` обробник події `nm-data-changed` з `detail: 'achievement'`. Генерує коротке повідомлення табло:

```javascript
// Приклад генерації:
"Тиждень без пропуску — тихо радію за тебе."
// (partner persona — тепло і коротко, БЕЗ фанфар і emoji-спаму)
```

**НЕ** робити окремий `showToast('Ачівка розблокована!')` — тільки OWL табло.

## Чек-ліст перед пушем

- [ ] Жодного балу / очок / XP у коді
- [ ] Жодного рейтингу / порівняння з іншими
- [ ] Немає блокуючої модалки "Вітаємо!"
- [ ] prefers-reduced-motion вимикає анімації
- [ ] Ачівки не дублюються при повторному виклику `unlockAchievement`
- [ ] OWL дізнається про розблокування через `nm-data-changed`
- [ ] CSS градієнти — тільки з палітри (`#c2790a`, `#f97316→#ea580c`, `#4ade80→#16a34a`, `#5c4a2a→#3d2e1e`)
- [ ] **Жодного фіолетового**
- [ ] CACHE_NAME bump

## Важливо

- **Геймифікація не замінює емпатію.** OWL все одно має реагувати емпатично якщо юзер виснажений (правило з `getOWLPersonality()`) — ачівка в цей момент НЕ повідомляється.
- **Юзер може вимкнути ачівки** — додати `nm_settings.achievements_enabled = false` опцію на вкладці "Я". Дефолт `true`, але Роман має мати вимикач.
- **Накопичувальний ефект** важливіший за окремі ачівки. Денний скор + тижневий прогрес > "100 ачівок у галереї".
- Не конкуруємо з Notion/Todoist/Habitica — наша сила у OWL-агенті як другий мозок, не у геймифікації.
