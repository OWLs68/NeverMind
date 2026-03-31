# NeverMind — Дизайн-система

> Живий документ. Оновлюється кожного разу коли затверджується новий вигляд або поведінка компонента.
> Формат кожного компонента: **Опис → Поведінка → CSS-специфікація → HTML-шаблон**
> Корисно: можна взяти шаблон і перенести в інший проект — все задокументовано.

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
Панель що виїжджає знизу екрану. Використовується для: редагування задачі, звички, проекту, моменту, та будь-якого іншого об'єкту. Всі такі вікна виглядають однаково — уніфікований стиль.

### Поведінка
- Відкривається анімацією `translateY(0)` знизу
- Закривається тапом по backdrop або свайпом вниз по панелі (handle зверху — підказка)
- Клавіатура: поле вводу фокусується через `setTimeout 350ms` щоб анімація встигла завершитись перед підняттям клавіатури
- `max-height: 80-85vh` + `overflow-y: auto` — якщо вміст не влізає, панель скролиться всередині
- `env(safe-area-inset-bottom)` в нижньому padding — коректна відстань на iPhone з home indicator

### CSS-специфікація

**Зовнішній контейнер (overlay):**
```css
position: fixed;
inset: 0;
z-index: 200;
display: flex;              /* flex щоб center по горизонталі */
align-items: flex-end;      /* притиснути до низу */
justify-content: center;
padding: 0 16px 16px;       /* 16px зазор від країв екрану */
```

**Backdrop (клік = закрити):**
```css
position: absolute;
inset: 0;
background: rgba(0,0,0,0.35);
backdrop-filter: blur(4px); /* легкий blur всього фону за модалкою */
```

**Панель:**
```css
position: relative;
width: 100%;
max-width: 480px;
background: rgba(255,255,255,0.30);   /* білий 30% — видно крізь нього */
backdrop-filter: blur(32px);           /* сильний blur контенту за панеллю */
-webkit-backdrop-filter: blur(32px);   /* Safari */
border-radius: 24px;
padding: 32px 32px calc(env(safe-area-inset-bottom) + 32px);  /* 32px з усіх сторін */
border: 1.5px solid rgba(255,255,255,0.5);
max-height: 85vh;
overflow-y: auto;
box-sizing: border-box;
z-index: 1;
```

**Handle (риска зверху):**
```css
width: 36px;
height: 4px;
background: rgba(0,0,0,0.12);
border-radius: 2px;
margin: 0 auto 18px;
```

**Поля вводу всередині:**
```css
width: 100%;
box-sizing: border-box;
background: rgba(255,255,255,0.7);
border: 1.5px solid rgba(30,16,64,0.12);
border-radius: 12px;
padding: 12px 14px;
font-size: 16-17px;
color: #1e1040;
outline: none;
```

**Кнопки внизу (завжди два: скасувати + зберегти):**
```css
/* обгортка */
display: flex;
gap: 8px;

/* Скасувати */
flex: 1;
background: rgba(30,16,64,0.06);
border: none;
border-radius: 12px;
padding: 13-14px;
font-size: 16px;
font-weight: 700;
color: rgba(30,16,64,0.5);

/* Зберегти */
flex: 2;
background: linear-gradient(135deg, [акцент-light], [акцент-dark]);
border: none;
border-radius: 12px;
padding: 13-14px;
font-size: 16px;
font-weight: 700;
color: white;
```

### HTML-шаблон

```html
<!-- MODAL: назва -->
<div id="xxx-modal" style="display:none;position:fixed;inset:0;z-index:200;align-items:flex-end;justify-content:center;padding:0 16px 16px">
  <!-- Backdrop -->
  <div onclick="closeXxxModal()" style="position:absolute;inset:0;background:rgba(0,0,0,0.35);backdrop-filter:blur(4px)"></div>
  <!-- Panel -->
  <div style="position:relative;width:100%;max-width:480px;background:rgba(255,255,255,0.30);backdrop-filter:blur(32px);-webkit-backdrop-filter:blur(32px);border-radius:24px;padding:32px 32px calc(env(safe-area-inset-bottom)+32px);z-index:1;max-height:85vh;overflow-y:auto;box-sizing:border-box;border:1.5px solid rgba(255,255,255,0.5);">
    <!-- Handle -->
    <div style="width:36px;height:4px;background:rgba(0,0,0,0.12);border-radius:2px;margin:0 auto 18px"></div>
    <!-- Заголовок + кнопка видалити -->
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
      <div style="font-size:18px;font-weight:700;color:#1e1040">Заголовок</div>
      <button style="background:none;border:none;font-size:13px;font-weight:700;color:#ef4444;cursor:pointer;padding:4px 8px">Видалити</button>
    </div>
    <!-- Поле вводу -->
    <input type="text" style="width:100%;border:1.5px solid rgba(30,16,64,0.12);border-radius:12px;padding:12px 14px;font-size:17px;font-family:inherit;color:#1e1040;outline:none;margin-bottom:10px;box-sizing:border-box;background:rgba(255,255,255,0.7)" placeholder="Текст…">
    <!-- Кнопки -->
    <div style="display:flex;gap:8px;margin-top:4px">
      <button onclick="closeXxxModal()" style="flex:1;background:rgba(30,16,64,0.06);border:none;border-radius:12px;padding:13px;font-size:16px;font-weight:700;color:rgba(30,16,64,0.5);cursor:pointer">Скасувати</button>
      <button onclick="saveXxx()" style="flex:2;background:linear-gradient(135deg,#f97316,#ea580c);border:none;border-radius:12px;padding:13px;font-size:16px;font-weight:700;color:white;cursor:pointer">Зберегти</button>
    </div>
  </div>
</div>
```

### JS: свайп вниз щоб закрити
```javascript
// Викликати після відкриття модалки:
setupModalSwipeClose(
  document.querySelector('#xxx-modal > div:last-child'),
  closeXxxModal
);
// Функція setupModalSwipeClose знаходиться в app-tasks-core.js
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
