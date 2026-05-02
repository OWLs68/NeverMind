# /owl-motion — Система анімації OWL-сови (⏸️ ВІДКЛАДЕНО)

> **Стан 19.04.2026 (сесія rSTLV):** маскот-сова видалена з коду повністю. У Inbox повернуто простий емодзі 🦉. Скіл збережено як заготовку.
>
> **Не виконувати** поки Роман не скаже прямо "повертаємо маскот-сову" і не надасть якісний художній ассет (багатошарова SVG або Rive). До того — сова = текстовий 🦉.
>
> **Контекст видалення** → `docs/CHANGES.md` 19.04 секція rSTLV.

Цей скіл генерує або оновлює SVG-структуру і CSS-анімації для OWL-персонажа (сови) у NeverMind.

---

## ⚠️ Перед виконанням — обов'язкові перевірки

1. **Реальна DOM-структура.** Селектори `#owl-container` і `.owl-svg` нижче — **ЗАГОТОВКА для майбутнього SVG**. Реальна структура у проекті інша: `#owl-board` (Inbox табло), `#owl-tab-board-{tab}` (табло вкладок), `.owl-text`, `.owl-speech-chips`. Перед застосуванням:
   - Прочитай `src/owl/board.js` (функція `renderTabBoard` — єдина для ВСІХ вкладок)
   - Прочитай `src/owl/inbox-board.js` (`renderOwlBoard` делегує у `renderTabBoard('inbox')`)
   - Прочитай `index.html` (секція `#owl-board`)
   - **Інтегруй анімацію у існуючу структуру**, не створюй паралельну

2. **Новий JS-файл створювати через `/new-file`.** Якщо треба `src/owl/owl-controller.js` або будь-який інший JS-модуль — виклич скіл `/new-file` (він правильно покладе у папку і додасть import у `src/app.js` у правильному порядку). Не створюй напряму.

3. **Принцип "ОДИН МОЗОК НА ВСЕ"** (CLAUDE.md). Не створюй паралельний `OwlController` — у нас вже є: `inbox-board.js`, `board.js`, `proactive.js`, `chips.js`. Інтегруй з існуючими функціями (`saveTabBoardMsg`, `renderTabBoard`, `_owlTabApplyState`), не дублюй.

4. **Анімація бабла — вже заплановане.** `transform-origin: left center` + `scaleX(0)→scaleX(1)` описано у `CLAUDE.md` → "Плани на розвиток" → "Анімація OWL" (додано 16.04.2026 3229b). Використай цю саму механіку, не вигадуй нову.

5. **CACHE_NAME bump.** Після зміни `index.html` / `style.css` / нового JS-модуля — **обов'язково** оновити `CACHE_NAME` у `sw.js` (формат `nm-YYYYMMDD-HHMM`, команда `date +"nm-%Y%m%d-%H%M"`).

**Якщо хоч одна перевірка знаходить конфлікт з існуючим кодом — зупинись і повідом Роману перед змінами.**

---

## Технічне рішення

SVG + CSS keyframes (кадри анімації). Без Lottie (важкий), без SMIL (застарілий). Працює на iOS Safari.

## Структура яку треба створити/оновити

### HTML (в index.html)
```html
<div id="owl-container" class="owl--idle">
  <svg class="owl-svg"><!-- SVG-персонаж --></svg>
  <div class="owl-bubble"><!-- текст табло --></div>
</div>
```

### CSS стани (в style.css)
```css
/* idle — повільне левітування коли нема повідомлення */
.owl--idle .owl-svg { animation: owlLevitate 3s ease-in-out infinite; }

/* alert — кивок коли з'явилось нове повідомлення */
.owl--alert .owl-svg { animation: owlNod 0.4s ease-in-out; }

/* thinking — анімація очей поки AI думає */
.owl--thinking .owl-svg { animation: owlThink 1s ease-in-out infinite; }

/* error — опущені крила при помилці */
.owl--error .owl-svg { animation: owlDrop 0.3s ease-out; }

/* greeting — змах крилом при вітанні */
.owl--greeting .owl-svg { animation: owlWave 0.6s ease-in-out; }

/* розгортання бабла від сови вправо */
.owl-bubble { transform-origin: left center; }
.owl-bubble.visible { animation: bubbleOpen 0.3s ease-out forwards; }
.owl-bubble.hidden { animation: bubbleClose 0.2s ease-in forwards; }

@keyframes owlLevitate {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-4px); }
}
@keyframes owlNod {
  0% { transform: rotate(0deg); }
  30% { transform: rotate(-8deg); }
  70% { transform: rotate(4deg); }
  100% { transform: rotate(0deg); }
}
@keyframes bubbleOpen {
  from { transform: scaleX(0); opacity: 0; }
  to { transform: scaleX(1); opacity: 1; }
}
@keyframes bubbleClose {
  from { transform: scaleX(1); opacity: 1; }
  to { transform: scaleX(0); opacity: 0; }
}
```

### JS клас OwlController (новий файл src/owl/owl-controller.js)
```javascript
class OwlController {
  constructor() {
    this.container = document.getElementById('owl-container');
    this.bubble = document.querySelector('.owl-bubble');
  }

  setState(mood) {
    // mood: 'idle' | 'alert' | 'thinking' | 'error' | 'greeting'
    this.container.className = `owl--${mood}`;
  }

  showBubble(text) {
    this.bubble.textContent = text;
    this.bubble.classList.add('visible');
    this.bubble.classList.remove('hidden');
    this.setState('alert');
    setTimeout(() => this.setState('idle'), 600);
  }

  hideBubble() {
    this.bubble.classList.add('hidden');
    this.bubble.classList.remove('visible');
  }
}

export const owl = new OwlController();
```

## Як використовувати

```javascript
import { owl } from './owl/owl-controller.js';

owl.showBubble('Нове повідомлення від OWL');  // показати + кивнути
owl.setState('thinking');                       // AI думає
owl.setState('idle');                           // спокій
owl.hideBubble();                               // сховати бабл, сова левітує
```

## Важливо

- `transform-origin: left center` на `.owl-bubble` — бабл розгортається від сови вправо
- SVG-персонаж малює НЕ Claude — окремий AI або Роман. Скіл готує структуру під будь-який SVG
- До появи SVG — анімації застосовуються до placeholder (тимчасовий замінник)
