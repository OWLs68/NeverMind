# NeverMind — Дизайн-система

> Живий документ. Оновлюється кожного разу коли затверджується новий вигляд або поведінка компонента.
> Формат кожного компонента: **Опис → Поведінка → CSS-специфікація → HTML-шаблон**
> Корисно: можна взяти шаблон і перенести в інший проект — все задокументовано.

---

## ⚠️ Помилки які були зроблені — читати перед будь-якою зміною модалки

### Проблема: padding на дочірніх елементах не звужував вміст

**Що сталось (01.04.2026):** Роман просив додати горизонтальні відступи всередині модалок задачі і звички. Було зроблено 5+ спроб — жодна не давала видимого результату. Роман чекав і нервував.

**Що пробували і чому не спрацювало:**

| Спроба | Що зроблено | Чому не спрацювало |
|--------|-------------|-------------------|
| 1 | `padding:28px 20px` на `overflow-y:auto` inner wrapper | `overflow-y:auto` з padding — горизонтальний padding ігнорується або не дає ефекту в деяких браузерах/контекстах |
| 2 | `padding:28px 28px` на тому самому wrapper | Та сама причина — зміна числа не вирішує проблему архітектури |
| 3 | Додали окремий `<div>` з `padding:28px 20px` всередині scroll-контейнера | Здавалось правильним, але div мав `box-sizing:border-box` і `width:100%` — зовні не було видно різниці через прозорий фон модалки |
| 4 | Звинувачення iOS Safari | Неправильна діагностика. Проблема відтворювалась в Chrome і на десктопі — значить не браузерний баг |

**Що реально вирішило проблему:**
```css
/* НА OUTER PANEL (той що має overflow:hidden і border-radius): */
padding: 0 20px;

/* scroll container — тільки вертикальний padding: */
padding: 28px 0 calc(env(safe-area-inset-bottom) + 28px);
```

**Чому це працює:** `overflow:hidden` на outer panel фізично не дає дочірнім елементам виходити за межі padding box. Padding на самому outer panel = гарантований відступ з усіх боків.

**Правило на майбутнє:**
> Якщо треба звузити вміст всередині контейнера — padding ставити на **найближчий батьківський елемент з `overflow:hidden`**, а не на дочірні scroll-елементи.
> Якщо padding не дає ефект — перевір чи він стоїть на правильному рівні, а не шукай винних у браузері.

---

## Кольорова палітра

| Роль | CSS-значення | Де |
|------|-------------|-----|
| Фон сторінки | `linear-gradient(160deg,#f5f0e8,#ffffff,#fff8f0)` | body background |
| Основний текст | `#1e1040` | заголовки, input text |
| Другорядний текст | `rgba(30,16,64,0.45)` | підписи, placeholder-like |
| Акцент amber | `#c2790a` | onboarding, посилання |
| Акцент orange | `#ea580c` | задачі, кнопка "Зберегти" |
| Акцент green | `#16a34a` | звички, виконані кроки |
| AI bar / чат | `rgba(15,10,22,0.72)` | input bar, chat window, tab board |

---

## Модальне вікно (Bottom Sheet Modal)

### Опис
Панель що виїжджає знизу екрану. Використовується для: редагування задачі, звички, проекту, моменту, та будь-якого іншого об'єкту.

**Два типи** залежно від прозорості фону:
| Тип | Де | background панелі |
|-----|----|-------------------|
| **Скляний** (glass) | задача, звичка | `rgba(255,255,255,0.30)` + `blur(32px)` |
| **Непрозорий** | проект, момент, нотатка | `rgba(255,255,255,0.88)` + `blur(24px)` |

### Поведінка
- Закривається тапом по backdrop або свайпом вниз
- `max-height: 80-85vh` + scroll — якщо вміст не влізає
- `env(safe-area-inset-bottom)` в нижньому padding — для iPhone з home indicator

### CSS-специфікація (актуальна, скляний тип — задача/звичка)

**Зовнішній контейнер (overlay):**
```css
position: fixed; inset: 0; z-index: 200;
display: flex; align-items: flex-end; justify-content: center;
padding: 0 16px 16px;   /* відступ від країв екрана */
```

**Backdrop:**
```css
position: absolute; inset: 0;
background: rgba(0,0,0,0.35);
backdrop-filter: blur(4px);
```

**Панель (outer panel):**
```css
position: relative;
width: 100%; max-width: 480px;
background: rgba(255,255,255,0.30);
backdrop-filter: blur(32px); -webkit-backdrop-filter: blur(32px);
border-radius: 24px;
border: 1.5px solid rgba(255,255,255,0.5);
overflow: hidden;          /* ВАЖЛИВО: clip контенту */
padding: 0 20px;           /* горизонтальний відступ — ТІЛЬКИ тут, не на дочірніх */
max-height: 85vh;
z-index: 1;
```

> ⚠️ **Правило:** горизонтальний padding (`0 20px`) ставити на `overflow:hidden` outer panel.
> Padding на `overflow-y:auto` дочірніх елементах не дає ефекту в деяких браузерах.

**Scroll-контейнер (всередині панелі):**
```css
overflow-y: auto;
max-height: 85vh;   /* дублює max-height батька для коректного scroll */
padding: 28px 0 calc(env(safe-area-inset-bottom) + 28px);
box-sizing: border-box;
/* горизонтальний padding — НЕ ставити тут, він вже є на outer panel */
```

**Handle (риска зверху):**
```css
width: 36px; height: 4px;
background: rgba(0,0,0,0.12);
border-radius: 2px;
margin: 0 auto 18px;
```

**Поля вводу (input / textarea):**
```css
width: 100%; box-sizing: border-box;
background: rgba(255,255,255,0.7);
border: 1.5px solid rgba(30,16,64,0.12);
border-radius: 12px;
padding: 12px 14px;
font-size: 16-17px; color: #1e1040; outline: none;
```

**Рядки списків (кроки задачі тощо):**
```css
display: flex; align-items: center; gap: 8px;
background: rgba(255,255,255,0.7);        /* такий самий як поля вводу */
border: 1.5px solid rgba(30,16,64,0.12);
border-radius: 10px;
padding: 8px 10px;
```

**Кнопки внизу:**
```css
/* обгортка */
display: flex; gap: 8-10px;

/* Скасувати (flex:1) */
background: rgba(30,16,64,0.06); border: none;
border-radius: 12px; padding: 13-14px;
font-size: 16px; font-weight: 700; color: rgba(30,16,64,0.5);

/* Зберегти (flex:2) */
background: linear-gradient(135deg, [акцент-light], [акцент-dark]);
border: none; border-radius: 12px; padding: 13-14px;
font-size: 16px; font-weight: 700; color: white;
```

**Акцентні градієнти по типу модалки:**
| Модалка | Зберегти |
|---------|----------|
| Задача | `linear-gradient(135deg,#f97316,#ea580c)` |
| Звичка | `linear-gradient(135deg,#4ade80,#16a34a)` |
| Проект | `linear-gradient(135deg,#5c4a2a,#3d2e1e)` |
| Момент | відповідно до настрою |

### HTML-шаблон (актуальний)

```html
<!-- MODAL: назва -->
<div id="xxx-modal" style="display:none;position:fixed;inset:0;z-index:200;align-items:flex-end;justify-content:center;padding:0 16px 16px">
  <!-- Backdrop -->
  <div onclick="closeXxxModal()" style="position:absolute;inset:0;background:rgba(0,0,0,0.35);backdrop-filter:blur(4px)"></div>
  <!-- Outer panel: overflow:hidden + padding:0 20px для горизонтальних відступів -->
  <div style="position:relative;width:100%;max-width:480px;background:rgba(255,255,255,0.30);backdrop-filter:blur(32px);-webkit-backdrop-filter:blur(32px);border-radius:24px;overflow:hidden;z-index:1;max-height:85vh;border:1.5px solid rgba(255,255,255,0.5);padding:0 20px;">
    <!-- Scroll container: тільки вертикальний padding -->
    <div style="overflow-y:auto;max-height:85vh;padding:28px 0 calc(env(safe-area-inset-bottom)+28px);box-sizing:border-box;">
      <!-- Handle -->
      <div style="width:36px;height:4px;background:rgba(0,0,0,0.12);border-radius:2px;margin:0 auto 18px"></div>
      <!-- Заголовок + кнопка видалити -->
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
        <div style="font-family:var(--font-display);font-size:18px;font-weight:700;color:#1e1040">Заголовок</div>
        <button style="display:none;background:none;border:none;font-size:13px;font-weight:700;color:#ef4444;cursor:pointer;padding:4px 8px">Видалити</button>
      </div>
      <!-- Поле вводу -->
      <input type="text" style="width:100%;border:1.5px solid rgba(30,16,64,0.12);border-radius:12px;padding:12px 14px;font-size:17px;font-family:inherit;color:#1e1040;outline:none;margin-bottom:10px;box-sizing:border-box;background:rgba(255,255,255,0.7)" placeholder="Текст…">
      <!-- Кнопки -->
      <div style="display:flex;gap:8px">
        <button onclick="closeXxxModal()" style="flex:1;background:rgba(30,16,64,0.06);border:none;border-radius:12px;padding:13px;font-size:16px;font-weight:700;color:rgba(30,16,64,0.5);cursor:pointer">Скасувати</button>
        <button onclick="saveXxx()" style="flex:2;background:linear-gradient(135deg,#f97316,#ea580c);border:none;border-radius:12px;padding:13px;font-size:16px;font-weight:700;color:white;cursor:pointer">Зберегти</button>
      </div>
    </div>
  </div>
</div>
```

### JS: відкриття + свайп
```javascript
// Відкрити:
document.getElementById('xxx-modal').style.display = 'flex';

// Закрити:
document.getElementById('xxx-modal').style.display = 'none';

// Свайп вниз щоб закрити (викликати після відкриття):
setupModalSwipeClose(
  document.querySelector('#xxx-modal > div:last-child'),
  closeXxxModal
);
// setupModalSwipeClose знаходиться в app-tasks-core.js
```

---

## AI Bar (нижня панель вводу)

### Опис
Фіксована панель внизу кожної вкладки. Містить поле вводу тексту + кнопку відправки. Над полем вводу — висувне вікно чату (3 стани).

### Поведінка — 3 стани чату
| Стан | Опис | Як активувати |
|------|------|---------------|
| **Закрито** | Тільки input bar, чат схований | — |
| **A (compact)** | Чат частково відкритий (~40% висоти) | Фокус на input або свайп вгору |
| **B (full)** | Чат на повний екран | Свайп вгору з compact |

- При **переключенні вкладок**: стан чату зберігається (не скидається автоматично)
- При **відкритті клавіатури**: панель піднімається разом з нею

### CSS
```css
background: rgba(15,10,22,0.72);  /* темний напівпрозорий */
backdrop-filter: blur(16px);
```

### Handle (риска)
```css
/* Коли чат відкритий */
background: rgba(255,255,255,0.45);  /* біла */

/* Коли чат закритий — підказка над input */
/* CSS ::before на .ai-bar-input-box */
background: rgba(15,10,22,0.45);     /* темна */
```

---

## Картки задач

### Опис
Картка з заголовком, опційним описом, прогрес-баром і списком кроків. Свайп вліво — видалити.

### Поведінка кроків
- **Тап по чекбоксу** (рух < 10px) → ставить/знімає галочку
- **Свайп або скрол** (рух ≥ 10px) → ігнорується, галочка не ставиться
- Коли **всі кроки виконані** → `task.status = 'done'`, картка тьмяніє, заголовок перекреслюється
- Коли **знята хоча б одна галочка** → `task.status = 'active'`, картка відновлюється

### CSS
```css
background: linear-gradient(135deg, #c6f3fd, #a8ecfb);
border: 1.5px solid rgba(255,255,255,0.4);
border-radius: 16px;
padding: 14px 14px 12px;
```
