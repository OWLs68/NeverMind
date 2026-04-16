# /pwa-ios-fix — Стабільність PWA на iOS Safari

Цей скіл перевіряє і виправляє специфічні баги iOS Safari у NeverMind. Спочатку читає `src/core/boot.js` — доповнює тільки те чого нема.

## Крок 1 — Прочитати boot.js

```bash
# Перевірити що вже є:
grep -n "innerHeight\|pageshow\|overscroll\|touch-action\|vh" src/core/boot.js
```

## Крок 2 — Чеклист виправлень

### 1. Висота екрану (--vh змінна)
iOS рахує `100vh` неправильно коли вилазить клавіатура.

```javascript
// Додати у boot.js якщо нема:
function setupVh() {
  const setVh = () => {
    document.documentElement.style.setProperty('--vh', `${window.innerHeight * 0.01}px`);
  };
  setVh();
  window.addEventListener('resize', setVh);
}
```

```css
/* Використовувати у style.css замість 100vh: */
height: calc(var(--vh, 1vh) * 100);
```

### 2. BFCache — повернення з фону
iPhone кешує сторінку і при поверненні показує старі дані OWL.

```javascript
// Додати у boot.js якщо нема:
window.addEventListener('pageshow', (e) => {
  if (e.persisted) {
    // сторінка відновлена з кешу — оновити стан
    renderTabBoard(currentTab);
    renderInbox();
  }
});
```

### 3. Скрол bounce (гумовий відскок)
```css
/* Додати у style.css якщо нема: */
body { overscroll-behavior: none; }
.tab-content { overscroll-behavior: contain; } /* для вкладок — залишити */
```

### 4. Затримка тапу 300мс
```css
/* Додати у style.css якщо нема: */
button, a, [role="button"], .owl-chip, .tab-item {
  touch-action: manipulation;
}
```

## Крок 3 — Перевірка після змін

1. Відкрити застосунок на iPhone
2. Ввести текст → клавіатура вилізла → перевірити що нічого не перекривається
3. Згорнути застосунок → відкрити → перевірити що OWL показує актуальні дані
4. Потапати по кнопках — затримки не має бути

## Важливо

- НЕ чіпати логіку `setupSW()` у boot.js — кожна строчка там вирішує конкретну iOS-проблему
- НЕ прибирати існуючі iOS фікси навіть якщо вони виглядають "надмірно"
- Після змін — оновити `CACHE_NAME` у sw.js і задеплоїти
