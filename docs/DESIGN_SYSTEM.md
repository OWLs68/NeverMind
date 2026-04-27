# NeverMind — Design System (робочий інструмент)

> **Цей документ — робочий інструмент Claude.** Не галерея картинок, а інструкція для UI-задач: «треба змінити X → читай секцію Y → використовуй токен Z».
>
> **Кому корисно:** Claude перед UI-кодом (через скіл `/ux-ui`). Роман — для довідки, але цільова аудиторія = майбутній Claude.
>
> **Принцип:** одна правда у токенах. Якщо HEX/розмір/радіус не у токенах — це **техборг** (секція 7).
>
> **Оновлення:** кожна нова UI-фіча → додається у відповідну секцію. Старі інциденти → секція 8 (анти-патерни).

---

## 📑 Зміст

1. [⚡ Шпаргалка (1 екран)](#-шпаргалка)
2. [🎨 Токени дизайну](#-токени-дизайну)
3. [📦 Шаблони для копі-пасту](#-шаблони-для-копі-пасту)
   - [Glass-модалка (задача, звичка)](#glass-модалка)
   - [Opaque-модалка (момент, проект, нотатка)](#opaque-модалка)
   - [Картка у списку](#картка-у-списку)
   - [Кнопка primary / secondary](#кнопки)
   - [Чіп OWL](#чіп)
   - [Поле вводу](#поле-вводу)
   - [Safe Areas (iPhone notch + home indicator)](#safe-areas)
   - [Haptics (вібрація на дії)](#haptics)
   - [Empty States (порожній список)](#empty-states)
   - [Loading Skeletons (заглушки даних)](#skeletons)
4. [🧩 Компоненти (детальні специфікації)](#-компоненти-детальні-специфікації)
5. [🗺 Вкладки (стандарт картки + акцент)](#-вкладки-стандарт-картки--акцент)
6. [✅ Чекліст перед UI-пушем](#-чекліст-перед-ui-пушем)
7. [⚠️ Техборг (file:line — що виправити)](#%EF%B8%8F-техборг-fileline--що-виправити)
8. [🚫 Анти-патерни (як НЕ робити)](#-анти-патерни-як-не-робити)
9. [📖 Словник (outer/backdrop/glass українською)](#-словник)

---

<a id="-шпаргалка"></a>

## ⚡ Шпаргалка

**Кольори в одному погляді:**
| Роль | Значення | Коли |
|---|---|---|
| Темний текст | `#1e1040` | заголовки, body |
| Бурштин | `#c2790a` | onboarding, нейтральний акцент |
| Помаранч | `#ea580c` | задачі, основні CTA |
| Зелений | `#16a34a` | успіх, звички, чекмарк |
| Червоний | `#ef4444` | помилка, видалення |
| Скляний фон | `rgba(255,255,255,0.30)` + blur 32 | модалки задача/звичка |
| AI-bar / чат | `rgba(15,10,22,0.72)` + blur 16 | темна нижня панель |
| 🚫 Фіолет | будь-який | **ЗАБОРОНЕНИЙ** — Роман не любить |

**Якщо робиш X — йди сюди:**
| Що | Куди |
|---|---|
| Нова модалка (форма редагування) | [Glass-модалка](#glass-модалка) або [Opaque-модалка](#opaque-модалка) |
| Картка у списку | [Картка у списку](#картка-у-списку) |
| Кнопка | [Кнопки](#кнопки) |
| Чіп OWL (швидка дія) | [Чіп OWL](#чіп) |
| Поле вводу/textarea | [Поле вводу](#поле-вводу) |
| Список який буває порожній | [Empty States](#empty-states) |
| Дія потребує тактильного фідбеку | [Haptics](#haptics) |
| Дані вантажаться з мережі (Supabase) | [Loading Skeletons](#skeletons) |
| Модалка торкається краю iPhone | [Safe Areas](#safe-areas) |
| Не знаєш яка вкладка яким акцентом | [🗺 Вкладки](#-вкладки-стандарт-картки--акцент) |
| Перед `git push` UI-зміни | [✅ Чекліст](#-чекліст-перед-ui-пушем) |

**3 жорсткі правила (порушення = баг):**
1. **Padding модалки** — `padding: 0 20px` ставиться на **outer panel** (з `overflow:hidden`), НЕ на scroll-контейнері. Інцидент 01.04 → секція 8.
2. **Фіолет заборонений** — Claude інерційно пропонує, але Роман не любить. Заміна: `#c2790a` (бурштин), `#1e1040` (темний), `rgba(255,255,255,0.X)` (glass).
3. **Перед UI-кодом** — посилайся на існуючий схожий компонент, не вигадуй з нуля. Приклад: «модалка операції як у `src/tabs/finance.js → _renderTransactionModalBody`».

---

<a id="-токени-дизайну"></a>

## 🎨 Токени дизайну

**Принцип:** усі повторювані значення — токени у `:root` або `--var-*` через CSS-змінні. Інлайн-стилі дозволені для одноразових випадків, але **повторення = техборг**.

**Іменування:** англомовні (`--accent-amber`, `--card-radius`). Бо Claude мислить англійською — переклад ламає логіку (висновок Gemini-консультації nudNp 24.04).

### Кольори (поточні + цільові)

```css
:root {
  /* === ОСНОВНІ === */
  --color-bg: linear-gradient(160deg, #f5f0e8, #ffffff, #fff8f0);
  --color-text-primary:   rgba(30, 16, 64, 0.88);
  --color-text-secondary: rgba(30, 16, 64, 0.55);
  --color-text-muted:     rgba(30, 16, 64, 0.40);

  /* === АКЦЕНТИ (семантичні) === */
  --accent-amber:  #c2790a;   /* нейтральне, навчальне (onboarding) */
  --accent-orange: #ea580c;   /* задачі, головні CTA */
  --accent-green:  #16a34a;   /* успіх, звички, чекмарк */
  --accent-red:    #ef4444;   /* помилка, видалення */

  /* === ГРАДІЄНТИ ДЛЯ КНОПОК «ЗБЕРЕГТИ» === */
  --grad-task:    linear-gradient(135deg, #f97316, #ea580c);  /* помаранч (задача) */
  --grad-habit:   linear-gradient(135deg, #4ade80, #16a34a);  /* зелений (звичка) */
  --grad-project: linear-gradient(135deg, #5c4a2a, #3d2e1e);  /* коричневий (проект) */

  /* === GLASS / BLUR === */
  --glass-modal-bg:  rgba(255, 255, 255, 0.30);
  --glass-opaque-bg: rgba(255, 255, 255, 0.88);
  --blur-card:  blur(16px);
  --blur-modal: blur(24px);   /* компроміс між 16 (CSS) і 32 (JS finance) */
  --blur-bar:   blur(16px);   /* AI-bar, чат */

  /* === AI BAR / ЧАТ === */
  --bar-bg: rgba(15, 10, 22, 0.72);

  /* === КАРТКИ === */
  --card-bg:     rgba(255, 255, 255, 0.50);
  --card-border: rgba(255, 255, 255, 0.82);
  --card-shadow: 0 2px 12px rgba(30, 16, 64, 0.06);  /* без фіолету! */
  --card-radius: 18px;
  --card-pad-x:  14px;
  --card-pad-y:  10px;
  --card-gap:    5px;

  /* === МОДАЛКИ === */
  --modal-radius:       18px;  /* стандартні (задача/звичка) */
  --modal-radius-large: 24px;  /* великі (Finance, Cat picker) */
  --modal-border: 1.5px solid rgba(255, 255, 255, 0.5);

  /* === КНОПКИ === */
  --btn-radius: 12px;
  --btn-pad-sm: 8px 12px;     /* малі (фільтри, чіпи) */
  --btn-pad-md: 10px 14px;    /* середні (дії в картці) */
  --btn-pad-lg: 13px 14px;    /* великі (Зберегти/Скасувати у модалці) */

  /* === ШРИФТИ === */
  --font-body:    'Plus Jakarta Sans', sans-serif;
  --font-display: 'Unbounded', sans-serif;

  /* === РОЗМІРИ ТЕКСТУ === */
  --text-xs:   11px;
  --text-sm:   13px;
  --text-base: 14px;
  --text-md:   15px;
  --text-lg:   16px;
  --text-xl:   18px;

  /* === LINE-HEIGHT === */
  --line-tight:   1.4;
  --line-normal:  1.6;
  --line-relaxed: 1.8;   /* нотатки, неспішна читаність */

  /* === АНІМАЦІЇ === */
  --motion-fast:   200ms;
  --motion-normal: 300ms;
  --motion-slow:   500ms;
  --ease-spring:   cubic-bezier(0.34, 1.56, 0.64, 1);
  --ease-smooth:   cubic-bezier(0.4, 0, 0.2, 1);
}
```

### ❌ Заборонені кольори

**Фіолетовий — НЕ використовувати.**

| Чому | Деталі |
|---|---|
| Роман не любить | особиста преференція власника продукту |
| Claude інерційно пропонує | залишок з тренувальних даних — `purple-500`, `indigo-600` за замовчуванням |
| Знайдено 4× у проекті | див. секція 7 [Техборг](#%EF%B8%8F-техборг-fileline--що-виправити) |

**Замість фіолету:**
- `#c2790a` (бурштин) — для нейтрального/навчального
- `#1e1040` (основний темний) — для тексту і темних акцентів
- `rgba(255,255,255,0.X)` — для glass-ефектів

### Стан токенів (поточно vs цільово)

✅ **Вже є у `style.css`:** `--card-bg`, `--card-border`, `--card-shadow` (з фіолетом!), `--card-radius`, `--card-pad-x/y`, `--card-gap`, `--text-primary`, `--text-secondary`, `--active-accent`, `--inbox-bg`, `--font-body`, `--font-display`.

❌ **Ще не існує (треба додати у `style.css` коли черга):** `--accent-amber/orange/green/red`, `--blur-card/modal/bar`, `--modal-radius/-large`, `--btn-radius/pad-sm/md/lg`, `--text-xs/sm/base/md/lg/xl`, `--line-tight/normal/relaxed`, `--motion-fast/normal/slow`.

⚠️ **Конфлікти між поточним і цільовим** — див. секція 7 [Техборг](#%EF%B8%8F-техборг-fileline--що-виправити).

---

<a id="-шаблони-для-копі-пасту"></a>

## 📦 Шаблони для копі-пасту

> **TODO у Коміті 1**: 10 готових блоків коду які копіюємо при створенні нового UI.

<a id="glass-модалка"></a>
### Glass-модалка

**Де використовується:** редагування задачі, звички. Прозоро-біла панель з blur через яку видно фон.

**Аналог у коді:** `src/tabs/tasks.js → openTaskModal()`, `src/tabs/habits.js → openHabitModal()`.

**Ключове правило:** горизонтальний `padding: 0 20px` ставиться на **outer panel** (з `overflow:hidden`), НЕ на scroll-контейнері всередині. Інцидент 01.04 → секція 8.

```html
<!-- MODAL -->
<div id="xxx-modal" style="display:none;position:fixed;inset:0;z-index:200;align-items:flex-end;justify-content:center;padding:0 16px 16px">
  <!-- Backdrop -->
  <div onclick="closeXxxModal()" style="position:absolute;inset:0;background:rgba(0,0,0,0.35);backdrop-filter:blur(4px)"></div>
  <!-- Outer panel: overflow:hidden + padding:0 20px (ГОРИЗОНТАЛЬНИЙ) -->
  <div style="position:relative;width:100%;max-width:480px;background:rgba(255,255,255,0.30);backdrop-filter:blur(32px);-webkit-backdrop-filter:blur(32px);border-radius:24px;overflow:hidden;z-index:1;max-height:85vh;border:1.5px solid rgba(255,255,255,0.5);padding:0 20px;">
    <!-- Scroll: тільки ВЕРТИКАЛЬНИЙ padding + safe-area-inset-bottom -->
    <div style="overflow-y:auto;max-height:85vh;padding:28px 0 calc(env(safe-area-inset-bottom) + 28px);box-sizing:border-box;">
      <!-- Handle -->
      <div style="width:36px;height:4px;background:rgba(0,0,0,0.12);border-radius:2px;margin:0 auto 18px"></div>
      <!-- Заголовок -->
      <div style="font-family:var(--font-display);font-size:18px;font-weight:700;color:#1e1040;margin-bottom:16px">Заголовок</div>
      <!-- Контент / поля вводу -->
      <input type="text" style="..." placeholder="Текст…">
      <!-- Кнопки внизу -->
      <div style="display:flex;gap:8px;margin-top:16px">
        <button onclick="closeXxxModal()" style="flex:1;background:rgba(30,16,64,0.06);border:none;border-radius:12px;padding:13px;font-size:16px;font-weight:700;color:rgba(30,16,64,0.5);cursor:pointer">Скасувати</button>
        <button onclick="saveXxx()" style="flex:2;background:linear-gradient(135deg,#f97316,#ea580c);border:none;border-radius:12px;padding:13px;font-size:16px;font-weight:700;color:white;cursor:pointer">Зберегти</button>
      </div>
    </div>
  </div>
</div>
```

**JS відкриття + свайп закриття:**
```javascript
document.getElementById('xxx-modal').style.display = 'flex';
setupModalSwipeClose(
  document.querySelector('#xxx-modal > div:last-child'),
  closeXxxModal
);
// setupModalSwipeClose у src/tabs/tasks.js
```

**Розрахунок ширини** (приклад для max-width 480px):
- outer panel 480px, padding 0 20px → вміст 480 − 40 = **440px**
- На iPhone (вікно 390-430px) → outer схрипне до 100% мінус `padding:0 16px 16px` overlay → 358-398px → вміст ~318-358px

<a id="opaque-модалка"></a>
### Opaque-модалка

**Де використовується:** проект, момент, нотатка. Майже непрозорий білий фон (`0.88`) — для контенту з більшою кількістю тексту.

**Відмінність від Glass:** `background: rgba(255,255,255,0.88)` замість `0.30`. blur 24px замість 32px. Решта однакова.

```html
<!-- ВІДМІННИЙ РЯДОК (інший background): -->
<div style="...background:rgba(255,255,255,0.88);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);...">
```

<a id="картка-у-списку"></a>
### Картка у списку

**Де використовується:** задача, нотатка, звичка, операція, проект, подія. Кожна вкладка має свій акцент-градієнт.

**Базовий шаблон** (Задача — пастельно-блакитний):
```html
<div class="task-item-wrap" style="position:relative;margin:0 14px var(--card-gap);border-radius:16px">
  <div onclick="taskCardClick('${id}', event)"
    style="background:linear-gradient(135deg,#c6f3fd,#a8ecfb);
           border:1.5px solid rgba(255,255,255,0.4);
           border-radius:16px;
           padding:var(--card-pad-y) var(--card-pad-x);
           box-shadow:0 2px 12px rgba(0,0,0,0.04);
           opacity:${isDone ? '0.5' : '1'};
           cursor:pointer;
           position:relative;z-index:1;
           touch-action:pan-y">
    <!-- Чекбокс + контент -->
  </div>
</div>
```

**Акцентні градієнти за типом:**
| Вкладка | Background | Тип |
|---|---|---|
| Задача | `linear-gradient(135deg,#c6f3fd,#a8ecfb)` | пастельно-блакитний |
| Нотатка | див. `src/tabs/notes.js → renderNotesList` | світло-бежевий |
| Звичка | див. `src/tabs/habits.js` | пастельно-зелений |
| Операція | див. `src/tabs/finance.js` | за категорією |
| Проект | див. `src/tabs/projects.js` | темний коричневий |

**ВАЖЛИВО про onclick з UUID** (B-108 fix Aps79 27.04):
ID задачі — це UUID-string (`abc-def-123`). У HTML атрибуті onclick **обов'язково обгортай у одинарні лапки**: `onclick="fn('${id}')"`, інакше JS парсить як арифметику ідентифікаторів і викидає ReferenceError.

**Свайп-видалення:** використовуй `attachSwipeDelete(wrap, card, onDelete)` з `src/ui/swipe-delete.js`. Для **анімації схлопу перед `renderXxx()`** дзеркаль патерн `_animateSwipeRemoval` з `src/tabs/notes.js` (B-80 fix). Без цього перша картка стрибатиме під чіпи зверху.

<a id="кнопки"></a>
### Кнопки

**Primary (Зберегти, головна дія):**
```html
<button style="flex:2;background:linear-gradient(135deg,#f97316,#ea580c);
               border:none;border-radius:12px;padding:13px;
               font-size:16px;font-weight:700;color:white;cursor:pointer">
  Зберегти
</button>
```

**Secondary (Скасувати, нейтральне):**
```html
<button style="flex:1;background:rgba(30,16,64,0.06);
               border:none;border-radius:12px;padding:13px;
               font-size:16px;font-weight:700;color:rgba(30,16,64,0.5);cursor:pointer">
  Скасувати
</button>
```

**Pill (фільтр/категорія, активний):**
```html
<button style="background:rgba(194,121,10,0.12);color:#5b3d12;
               border:1px solid rgba(194,121,10,0.35);
               border-radius:999px;padding:5px 10px;
               font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">
  На завтра
</button>
```

**Розміри padding** (з токенів):
- `var(--btn-pad-sm)` = `8px 12px` — фільтри, чіпи
- `var(--btn-pad-md)` = `10px 14px` — дії в картці
- `var(--btn-pad-lg)` = `13px 14px` — Зберегти/Скасувати у модалці

**Заборонені кольори у градієнтах:** фіолет (`#7c3aed`, `#a855f7`, `purple-*`, `indigo-*`). Якщо здається що треба «третій акцент» — використовуй `--accent-amber`.

<a id="чіп"></a>
### Чіп OWL

**Де використовується:** swipe-row під OWL-баблом. Швидкі дії (відкрити календар, закрити задачу, додати звичку).

**Аналог у коді:** `src/owl/chips.js → renderChips(container, chips, tab)`.

**Структура:**
```javascript
const chips = [
  { label: 'Відкрити календар', action: 'nav', target: 'calendar' },
  { label: 'Зробив', action: 'chat' },
];
renderChips(chipEl, chips, 'tasks');
```

**Чотири типи `action`:**
| action | Поведінка |
|---|---|
| `chat` | відправляє label у чат-бар поточної вкладки |
| `nav` | переключає на вкладку `target` |
| `tool` | викликає UI-tool через AI-диспетчер |
| `link` | відкриває URL |

**Правила label:** до 3 слів, без крапок у кінці. Не дублюй варіанти.

<a id="поле-вводу"></a>
### Поле вводу

**Standard input/textarea (всередині модалки):**
```html
<input type="text"
  style="width:100%;box-sizing:border-box;
         background:rgba(255,255,255,0.7);
         border:1.5px solid rgba(30,16,64,0.12);
         border-radius:12px;
         padding:12px 14px;
         font-size:17px;font-family:inherit;
         color:#1e1040;outline:none"
  placeholder="Текст…">
```

**Чому `font-size:17px`:** менше → iOS Safari автоматично робить zoom при focus. 17px — мінімум щоб zoom не запускався.

**Рядок списку (наприклад, крок задачі) — той самий фон:**
```html
<div style="display:flex;align-items:center;gap:8px;
            background:rgba(255,255,255,0.7);
            border:1.5px solid rgba(30,16,64,0.12);
            border-radius:10px;
            padding:8px 10px">
  <!-- чекбокс + текст кроку -->
</div>
```

<a id="safe-areas"></a>
### Safe Areas (iPhone notch + home indicator)

**Проблема:** на iPhone X+ зверху «вухо» (notch), знизу — горизонтальна риска (home indicator). Контент може заходити під них → юзер не бачить кнопку «Зберегти» або вона перекрита.

**Рішення:** використовуй `env(safe-area-inset-*)` у CSS. Браузер сам підставить правильне число для конкретного пристрою.

**4 змінні які варто знати:**
- `env(safe-area-inset-top)` — простір під «вухом» (~47px на iPhone 14)
- `env(safe-area-inset-bottom)` — простір над home indicator (~34px)
- `env(safe-area-inset-left)` / `right` — для landscape

**Стандартні місця:**
```css
/* Модалка — нижній padding щоб «Зберегти» не залазив під home indicator */
padding-bottom: calc(env(safe-area-inset-bottom) + 28px);

/* Tab bar внизу — щоб не залазив під home indicator */
padding-bottom: env(safe-area-inset-bottom);

/* Page header зверху — щоб не залазив під «вухо» */
padding-top: calc(env(safe-area-inset-top) + 12px);

/* AI-bar внизу */
padding-bottom: calc(env(safe-area-inset-bottom) + 8px);
```

**Перевірка:** на iPhone 14+ якщо контент НЕ використовує `env(...)` — він **точно** перекритий «вухом» або рискою. На iPhone SE проблем немає (немає notch/indicator).

<a id="haptics"></a>
### Haptics (вібрація на дії)

**Проблема:** користувач не відчуває «зробив» — натиснув кнопку, нічого не дзенькнуло, не зрозуміло чи спрацювало. На iPhone Reminders/Things при тапі ✓ — телефон віддає легкий «тук». У NeverMind зараз немає.

**Рішення:** `navigator.vibrate(ms)` на ключових подіях. Доступно на Android + iOS Safari (з обмеженнями).

**4 базові патерни:**
```javascript
// Success — закриття задачі, додавання моменту, save
navigator.vibrate?.(15);

// Warning — сповіщення, attention
navigator.vibrate?.([20, 50, 20]);

// Error — несправний ввід, відмова
navigator.vibrate?.([50, 30, 50]);

// Swipe-delete trigger — перетинання порогу свайпу
navigator.vibrate?.(10);
```

**Де викликати:**
| Подія | Патерн |
|---|---|
| Завершення задачі/звички (✓) | `vibrate(15)` |
| Save modal | `vibrate(15)` |
| Свайп досягнув threshold для delete | `vibrate(10)` |
| Помилка валідації форми | `vibrate([50,30,50])` |
| Таймер/нагадування спрацювало | `vibrate([20,50,20])` |

**Важливо:** загортай у `?.` — `navigator.vibrate?.(15)`. На desktop і деяких iOS — функції просто немає, без `?.` буде помилка.

**Не зловживай:** не додавай vibrate на КОЖНУ дію (тап картки, відкриття модалки) — це дратує. Тільки на події які юзер **активно ініціював** і де треба підтвердження що **щось важливе сталось**.

**Стан у проекті:** `navigator.vibrate` ще не використовується. Додавати поступово при наступних UI-задачах.

<a id="empty-states"></a>
### Empty States (порожній список)

**Проблема:** список порожній → юзер бачить білу пустоту → думає «застосунок зламався» або «я в неправильному місці».

**Рішення:** замість порожнечі — **дружнє повідомлення** + іконка/емодзі + chip-кнопка з пропозицією дії.

**Структура:**
```html
<div style="text-align:center;padding:60px 32px;color:rgba(30,16,64,0.35)">
  <div style="font-size:48px;margin-bottom:12px">📝</div>
  <div style="font-size:16px;font-weight:600;color:rgba(30,16,64,0.6);margin-bottom:6px">
    Поки немає нотаток
  </div>
  <div style="font-size:14px;line-height:1.5;margin-bottom:20px">
    Натисни «+» зверху або скажи «запам'ятай що...» в Inbox.
  </div>
</div>
```

**Тон копірайту:**
- ✅ «Поки немає нотаток» (тимчасово, юзер додасть)
- ❌ «Список порожній» (констатація факту, неінформативно)
- ✅ «Натисни '+' зверху або скажи 'запам'ятай що...'» (конкретна підказка дії)
- ❌ «Тут будуть твої нотатки» (без дії)

**Стандарт по вкладках:**
| Вкладка | Емодзі | Пропозиція дії |
|---|---|---|
| Задачі | 📋 | «Натисни '+' або скажи 'купити X' в Inbox» |
| Нотатки | 📝 | «Скажи 'запам'ятай що...' в Inbox» |
| Звички | 🎯 | «Створи першу звичку через '+'» |
| Календар | 📅 | «Скажи 'нагадай завтра' в Inbox» |
| Фінанси | 💰 | «Запиши першу витрату — 'купив X на Y євро'» |

<a id="skeletons"></a>
### Loading Skeletons (заглушки даних)

**Проблема:** після Supabase дані вантажаться з мережі (300-1500мс). Якщо показувати порожній екран — здається що нічого не сталось. Якщо `Loading...` — теж не круто.

**Рішення:** **сірі пульсуючі прямокутники** на місці майбутніх карток. Юзер бачить структуру одразу, дані з'являються як заміна.

**CSS pulse:**
```css
.skeleton {
  background: linear-gradient(90deg,
    rgba(30,16,64,0.05) 0%,
    rgba(30,16,64,0.10) 50%,
    rgba(30,16,64,0.05) 100%);
  background-size: 200% 100%;
  animation: skeleton-shimmer 1.4s ease-in-out infinite;
  border-radius: 8px;
}
@keyframes skeleton-shimmer {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

**Скелетна картка задачі (приклад):**
```html
<div style="margin:0 14px var(--card-gap);padding:var(--card-pad-y) var(--card-pad-x);background:rgba(255,255,255,0.5);border:1.5px solid rgba(255,255,255,0.4);border-radius:16px">
  <div style="display:flex;gap:10px;align-items:center">
    <!-- Чекбокс-заглушка -->
    <div class="skeleton" style="width:28px;height:28px;border-radius:8px"></div>
    <!-- Текст-заглушка -->
    <div style="flex:1">
      <div class="skeleton" style="width:70%;height:16px;margin-bottom:6px"></div>
      <div class="skeleton" style="width:45%;height:12px"></div>
    </div>
  </div>
</div>
```

**Скільки скелетів показувати:** 3-5 для списку. Не 1 (виглядає як справжня картка). Не 20 (заповнює екран фейком).

**Коли показувати:**
| Ситуація | Skeleton чи ні |
|---|---|
| Перший вхід, порожнього кешу немає | ✅ Skeleton поки не прийдуть дані |
| Refresh — кеш є, оновлюємо у фоні | ❌ Показуй кеш, а не skeleton |
| Юзер натиснув «оновити» явно | ✅ Skeleton 200мс мінімум |
| Помилка мережі | ❌ Empty state з повідомленням |

**Стан у проекті:** ще не використовується (немає мережевих даних). Додаємо паралельно з Supabase.

---

<a id="-компоненти-детальні-специфікації"></a>

## 🧩 Компоненти (детальні специфікації)

> Ця секція — **глибокі деталі для редагування існуючих компонентів**. Якщо ти створюєш НОВИЙ компонент — використай секцію 3 (шаблон) + цю секцію як довідник.

### Bottom Sheet Modal (повна специфікація)

**Поведінка:**
- Виїжджає знизу екрану
- Закривається тапом по backdrop або свайпом вниз
- `max-height: 85vh` + scroll якщо вміст не влізає
- `env(safe-area-inset-bottom)` у нижньому padding

**Два типи за прозорістю:**
| Тип | Де | background | blur |
|---|---|---|---|
| Glass | задача, звичка | `rgba(255,255,255,0.30)` | 32px |
| Opaque | проект, момент, нотатка | `rgba(255,255,255,0.88)` | 24px |

**Свайп закриття:**
```javascript
import { setupModalSwipeClose } from './tasks.js';
setupModalSwipeClose(panelEl, closeFn);
```
- Тригериться при `dy > 120px` АБО `velocity > 0.5px/ms`
- Анімація поверну до 0 — `transition: transform 0.25s ease`

**Acceptance criteria для нової модалки:**
- [ ] Має `padding: 0 20px` на outer panel (не на scroll-контейнері)
- [ ] Має `padding-bottom: calc(env(safe-area-inset-bottom) + 28px)` на scroll
- [ ] Має handle `width:36px height:4px` зверху
- [ ] Backdrop клікабельний, закриває модалку
- [ ] Свайп вниз закриває
- [ ] Кнопка «Зберегти» — primary градієнт за типом (див. токени)
- [ ] Кнопка «Скасувати» — secondary стиль
- [ ] При відкритті фокус на перше поле через 350мс (для iOS keyboard)

### AI Bar (нижня панель вводу)

**Опис:** фіксована панель внизу кожної вкладки. Поле вводу + кнопка відправки. Над полем — висувне вікно чату (3 стани).

**3 стани чату:**
| Стан | Опис | Як активувати |
|---|---|---|
| Закрито | Тільки input bar, чат схований | — |
| A (compact) | Чат частково (~40% висоти) | Фокус на input або свайп вгору |
| B (full) | Чат на повний екран | Свайп вгору з compact |

**При переключенні вкладок:** стан чату зберігається.
**При відкритті клавіатури:** панель піднімається разом з нею (через `src/ui/keyboard.js`).

**CSS:**
```css
background: rgba(15, 10, 22, 0.72);
backdrop-filter: blur(16px);
```

**Handle:**
```css
/* Чат відкритий */ background: rgba(255, 255, 255, 0.45);
/* Чат закритий */ background: rgba(15, 10, 22, 0.45);  /* CSS ::before на .ai-bar-input-box */
```

### Картка задачі (поведінка кроків)

**Тап по чекбоксу** (рух < 10px):
- Якщо active → done: 3-фазна анімація (галочка → 250мс → схлоп → 620мс → renderTasks)
- Якщо done → active: миттєво (без анімації)

**Свайп або скрол** (рух ≥ 10px):
- Ігнорується, галочка не ставиться

**Свайп вліво:**
- Відкриває кошик через `attachSwipeDelete`
- Тап на кошик → анімація схлопу + видалення + undo toast

**Стан картки:**
| Status | Vision |
|---|---|
| `active` | повний opacity, чорний текст |
| `done` | `opacity: 0.5`, `text-decoration: line-through` |

### Чат-бар вкладки (8 чатів)

**Кожна вкладка має свій чат:**
- Inbox, Задачі, Нотатки, Я, Вечір, Фінанси, Здоров'я, Проекти

**Структура повідомлення:**
- `agent` — лівий бабл, асиметричний `border-radius: 4px 14px 14px 14px`
- `user` — правий бабл, асиметричний `border-radius: 14px 4px 14px 14px`
- `typing` — три анімовані крапки `<div class="ai-typing">`

**Storage:** `nm_chat_{tab}` — масив `{role, content, ts}` до 30 повідомлень.

**Обробка типу `tool_calls`:** через `dispatchChatToolCalls(toolCalls, addMsg, originalText)` у `src/ai/tool-dispatcher.js`. Усі обробники зобов'язані викликати `addMsg(...)` — інакше typing dots залипають назавжди (B-106 інцидент).

---

<a id="-вкладки-стандарт-картки--акцент"></a>

## 🗺 Вкладки (стандарт картки + акцент)

> Кожна з 8 вкладок NeverMind має **свій акцентний колір** (для CTA, активного стану, прогресу) і **свій стандарт картки**. Не змішуй акценти між вкладками — це псує когнітивне відчуття «де я».

| Вкладка | Акцент CTA | Картка (background) | Файл основного коду |
|---|---|---|---|
| **Inbox** | `#c2790a` (бурштин) | `rgba(255,255,255,0.5)` (нейтрал) | `src/tabs/inbox.js` |
| **Задачі** (Продуктивність) | `#ea580c` (помаранч) | `linear-gradient(135deg,#c6f3fd,#a8ecfb)` (блакитний) | `src/tabs/tasks.js` |
| **Звички** (Продуктивність) | `#16a34a` (зелений) | `linear-gradient(135deg,#d4f7c6,#a8e8a0)` (м'ятний) | `src/tabs/habits.js` |
| **Нотатки** | `#c2790a` (бурштин) | світлий бежевий + іконка папки | `src/tabs/notes.js` |
| **Фінанси** | `#ea580c` (помаранч) для дій / зелений для доходів / червоний для витрат | за категорією | `src/tabs/finance.js` |
| **Я** (профіль) | `#c2790a` (бурштин) | нейтральні картки прогресу | `src/tabs/me.js` |
| **Вечір** | темно-фіолетово-синій ALT? — **TODO перевірити** | темний градієнт `linear-gradient(135deg, #1e1040, #2a1860)` | `src/tabs/evening.js` |
| **Здоров'я** | `#16a34a` (зелений) для активних карток / `#ef4444` (червоний) для алергій | світло-сірий | `src/tabs/health.js` |
| **Проекти** | `#5c4a2a` (коричневий земляний) | `linear-gradient(135deg,#e8d5b8,#d4b896)` (пісочний) | `src/tabs/projects.js` |
| **Календар** | `#0d9488` (бірюзовий) — додано rJYkw 21.04 | модалка з пульсацією днів | `src/tabs/calendar.js` |

**Правило при додаванні нової вкладки:**
1. Обирай акцент з палітри `--accent-amber/orange/green/red` АБО специфічний HEX зі затвердженням Романа
2. **НЕ** використовуй фіолет (заборонений)
3. **НЕ** дублюй акцент іншої вкладки якщо це не семантично виправдано
4. Додай рядок у цю таблицю + у токени `--accent-{назва}`

**OWL board кольорування** (овальна картка зверху вкладки):
- `priority: 'normal'` — `rgba(15,10,22,0.72)` (темний)
- `priority: 'urgent'` — `linear-gradient(135deg, #f97316, #ea580c)` (помаранч)
- `priority: 'success'` — `linear-gradient(135deg, #4ade80, #16a34a)` (зелений)

---

<a id="-чекліст-перед-ui-пушем"></a>

## ✅ Чекліст перед UI-пушем

> Перед `git push` будь-якої UI-зміни (модалка / картка / кнопка / колір / лейаут) — пройти всі пункти. Якщо хоч один не виконано — **зупинись**.

**1. Кольори:**
- [ ] Жодного фіолету (`#7c3aed`, `#a855f7`, `purple-*`, `indigo-*`, `rgba(124,58,237,...)`, `rgba(100,70,200,...)`)
- [ ] Акценти — лише з токенів `--accent-amber/orange/green/red` або у виключних випадках з затвердженого списку у секції 5
- [ ] Темний текст — `#1e1040` або `rgba(30,16,64,X)`, не довільні чорні

**2. Модалка:**
- [ ] `padding: 0 20px` на outer panel (з `overflow:hidden`), НЕ на scroll-контейнері
- [ ] `padding-bottom: calc(env(safe-area-inset-bottom) + 28px)` на scroll
- [ ] Handle 36×4 зверху, `margin: 0 auto 18px`
- [ ] Backdrop клікабельний, закриває
- [ ] Свайп вниз через `setupModalSwipeClose`
- [ ] Кнопка «Зберегти» — primary градієнт за типом
- [ ] Border-radius 18 (стандарт) або 24 (великі) — НЕ довільне число

**3. Картка:**
- [ ] `border-radius: 16` або 18 — НЕ довільне
- [ ] `box-shadow: 0 2px 12px rgba(30,16,64,0.06)` (без фіолету у тіні!)
- [ ] `padding: var(--card-pad-y) var(--card-pad-x)` — НЕ hardcoded
- [ ] Якщо у HTML атрибуті onclick передається ID — **обов'язково** `'${id}'` у одинарних лапках (B-108 fix)

**4. Кнопка:**
- [ ] `border-radius: 12` (стандарт) або 999 (pill) — НЕ довільне
- [ ] `padding` з токенів `--btn-pad-sm/md/lg`
- [ ] `font-weight: 700` для primary, `500-600` для secondary
- [ ] Має `cursor: pointer` (для desktop)

**5. Поле вводу:**
- [ ] `font-size: 17px` мінімум (інакше iOS Safari запускає zoom при focus)
- [ ] `box-sizing: border-box`
- [ ] `outline: none`
- [ ] Border `1.5px solid rgba(30,16,64,0.12)`

**6. iPhone safe areas:**
- [ ] Page header має `padding-top: calc(env(safe-area-inset-top) + 12px)` якщо торкається верху
- [ ] Tab bar / AI-bar має `padding-bottom: env(safe-area-inset-bottom)` мінімум
- [ ] Модалка з кнопкою внизу має `+28px` додатково до safe-area

**7. Опис перед кодом (правило CLAUDE.md):**
- [ ] Назвав існуючий схожий компонент-аналог (наприклад «модалка задачі у `src/tabs/tasks.js`»)
- [ ] Описав словами що де розміщене і як взаємодіє
- [ ] Описав ширину/висоту/padding **у числах** («outer 480px, padding 0 20px → вміст 440px»)
- [ ] Якщо новий компонент без аналога — викликав `/mockup` (ASCII-макет)
- [ ] Чекав підтвердження Романа ПЕРЕД кодом

**8. Деплой-гігієна:**
- [ ] CACHE_NAME у `sw.js` оновлено (формат `nm-YYYYMMDD-HHMM`) — обов'язково при будь-якій зміні `style.css` / `index.html` / `src/**`
- [ ] Bundle перебудовано (`node build.js`) і закомічено
- [ ] Якщо змінив тільки `*.md` або `.claude/` скіли — **НЕ** бампати CACHE

---

<a id="%EF%B8%8F-техборг-fileline--що-виправити"></a>

## ⚠️ Техборг (file:line — що виправити)

> Інвентар відхилень від токенів і дизайн-стандартів. **Не код-фікс** — список «треба зробити коли будуть пріоритети». Кожен пункт — `file:line` + опис + рекомендована заміна.

### 🔴 Критичні (порушують правила)

#### 1. Фіолетовий у проекті — 4 місця

**Правило:** фіолет заборонений (Роман не любить, секція 2).

| File:line | Що зараз | На що замінити |
|---|---|---|
| `src/tabs/inbox.js:879` | `#7c3aed` (clarify options) | `#c2790a` (бурштин) |
| `src/owl/onboarding.js:924` | `#7c3aed` (owl mode picker) | `#c2790a` (бурштин) |
| `style.css` `--card-shadow` | `0 4px 20px rgba(100,70,200,0.06)` | `0 2px 12px rgba(30,16,64,0.06)` |
| `src/tabs/habits.js` (картка) | `box-shadow: 0 2px 10px rgba(100,70,200,0.06)` | використати `var(--card-shadow)` після фікс №3 |

**Фікс:** одна сесія — пошук і заміна. ~30 хв роботи. Візуально ефект мінімальний (alpha 0.06 — майже невидимо), але правило важливіше.

#### 2. Border-radius модалок — 4 різних значення

| File | Зараз | Має бути |
|---|---|---|
| `src/tabs/tasks.js` (modal) | 16px | 18px |
| `src/tabs/habits.js` (modal) | 16px | 18px |
| `src/tabs/finance.js` (TX modal) | 24px | 24px (велика) ✓ |
| `src/tabs/finance.js` (Date modal) | 24px | 24px ✓ |
| Cat picker | 22px | 24px |
| `index.html` Splash | 18px | 18px ✓ |

**Фікс:** уніфікувати на 2 токени — `--modal-radius: 18px` (стандарт) і `--modal-radius-large: 24px` (Finance, Cat picker). Підмінити інлайн-значення.

#### 3. Backdrop blur вдвічі різний

| Локація | Зараз | Має бути |
|---|---|---|
| `style.css --card-blur` | 16px ✓ | 16px |
| `src/tabs/finance-modals.js` (TX, Date, Cat picker) | 32px | 24px |
| `index.html` glass modals (інші) | 24-28px | 24px |

**Фікс:** запровадити `--blur-card: 16px` і `--blur-modal: 24px`. Замінити `blur(32px)` у Finance на `var(--blur-modal)`.

#### 4. Box-shadow карток — 5 різних

| Вкладка | Зараз | Має бути |
|---|---|---|
| Tasks | `0 2px 12px rgba(0,0,0,0.04)` | `var(--card-shadow)` |
| Notes | `0 2px 12px rgba(0,0,0,0.05)` | `var(--card-shadow)` |
| Habits | `0 2px 10px rgba(100,70,200,0.06)` 🚨 фіолет | `var(--card-shadow)` |
| Finance | `0 2px 12px rgba(30,16,64,0.06)` ✓ | `var(--card-shadow)` |
| `style.css --card-shadow` | `0 4px 20px rgba(100,70,200,0.06)` 🚨 фіолет | `0 2px 12px rgba(30,16,64,0.06)` |

**Фікс:** один токен `--card-shadow: 0 2px 12px rgba(30,16,64,0.06)` для всіх карток.

### 🟡 Помірні

#### 5. Padding кнопок Фінансів — 5+ значень

`src/tabs/finance.js` + `finance-modals.js` мають `7px 14px`, `10px 12px`, `11px 14px`, `13px 14px`, `14px 0`, `8px`, `13px 14px`. Стандартизувати на `--btn-pad-sm/md/lg`.

#### 6. Font-size без чіткої системи

13 / 13.5 / 14 / 15 для подібних ролей. Виключити 13.5 (єдиний випадок), залишити 13/14/15 з ясними ролями (`--text-sm/base/md`).

#### 7. Border-radius кнопок варіює 6-14px

12px найчастіший (16+ використань у `finance-modals.js`), але не уніфікований. Створити `--btn-radius: 12px`, замінити інлайн.

### 🟢 Дрібні

#### 8. Білий фон — 27 alpha значень

Від 0.06 до 0.97. Скоротити до 5-7 ключових (0.3, 0.5, 0.6, 0.75, 0.9, 0.95).

#### 9. Темна база `rgba(30,16,64,...)` — 20+ варіацій

Замість hardcode — токени `--text-primary` (0.88), `--text-secondary` (0.55), `--text-muted` (0.4), `--text-disabled` (0.25).

#### 10. Line-height без стандарту

1.6 / 1.7 / 1.8 без правил. Запровадити `--line-tight/normal/relaxed`.

#### 11. Transition times занадто близькі

0.15 / 0.2 / 0.25 для схожих дій. Стандартизувати на `--motion-fast: 200ms`, `--motion-normal: 300ms`.

### Як використовувати цю секцію

Коли беремо чергову UI-задачу — **спочатку** перевіряємо чи вона торкається пунктів вище. Якщо так — **попутно фіксимо** (одна правка дешевше ніж окрема сесія). Якщо задача не дотична — НЕ розширюємо scope.

> Сирий інвентар з 30+ HEX і 100+ rgba знаходиться у `_ai-tools/DESIGN_SYSTEM_INVENTORY.md` (буде архівовано після фінального перепису).

---

<a id="-анти-патерни-як-не-робити"></a>

## 🚫 Анти-патерни (як НЕ робити)

> **TODO у Коміті 4**: реальні інциденти проекту — що пробували, чому не спрацювало, що реально вирішило.

---

<a id="-словник"></a>

## 📖 Словник

> **TODO у Коміті 4**: outer, backdrop, glass, scroll-container, handle — українською з прикладами.

---

*Документ у процесі перепису. Сесія Aps79 27.04.2026 — Коміт 1 з 5.*
