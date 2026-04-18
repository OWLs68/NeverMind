# Owl Mascot — Handoff для Claude Code

5 станів сови з PNG-кросфейдом. Готово до інтеграції у PWA.

## Вміст пакету

```
assets/owl/
  owl-idle.png
  owl-alert.png
  owl-thinking.png
  owl-greeting.png
  owl-error.png
components/
  Owl.html          ← standalone референс-реалізація
  Owl.css           ← виділені стилі
  Owl.js            ← логіка станів (vanilla)
  OwlReact.jsx      ← React-варіант (опціонально)
```

## Швидкий старт (Claude Code інструкція)

> Встав цей блок у промпт для Claude Code:

```
В репо додай мій компонент сови-маскота з 5 станами (idle / alert / thinking / greeting / error).

1. Скопіюй 5 PNG у public/assets/owl/ (або в іншу папку зі статикою, яка є в проєкті).
2. Створи React-компонент <Owl state="idle" message="..."> на базі components/OwlReact.jsx.
3. Пропси:
   - state: 'idle' | 'alert' | 'thinking' | 'greeting' | 'error'
   - message?: string — текст у баблі (якщо не idle)
   - size?: number — ширина в px (default 200)
   - onClick?: () => void
4. Усередині PWA постав <Owl /> на головний екран (де раніше був placeholder).
5. Підключи до існуючого state-machine: якщо є агент — state='thinking' під час запиту,
   'alert' при нових Inbox-подіях, 'greeting' на першому вході, 'error' при fetch-фейлах.
6. Використай naming convention мого CSS (префікс .owl-) щоб не конфліктувало.
7. Зроби кнопку/секцію в DevTools, де розробник може вручну перемикати state для QA.
```

## Стани і семантика

| State     | Коли використовувати                                  | Bubble за замовч.                         |
|-----------|-------------------------------------------------------|-------------------------------------------|
| idle      | Звичайний стан екрану                                 | (прихований)                              |
| alert     | Нова подія в Inbox, нотифікація, CTA                  | "Новий запис у Inbox — глянемо?"          |
| thinking  | LLM/мережевий запит у процесі                         | "Секунду, обдумую…"                       |
| greeting  | Перший вхід у сесію, ранкове вітання                  | "Привіт! Радий тебе бачити"               |
| error     | Помилка запиту, валідації                             | "Ой… щось пішло не так."                  |

## Анімація і accessibility

- Легке покачування `float 4s` — виключається через `prefers-reduced-motion`
- Кросфейд 400ms + scale 500ms між кадрами
- Bubble з'являється через `scaleX` 300ms від лівого краю
- Фрейми: `role="img"` + `aria-label` на контейнері; `aria-live="polite"` на баблі

## Розміри і формати PNG

Поточні: ~1000×1000, ~1-1.4MB кожен. Для PWA бажано:
- Стиснути у WebP / AVIF (`cwebp -q 85` або `squoosh`)
- Додати `@2x` варіант і `srcset` якщо треба retina
- Або згенерувати sprite-sheet (1 файл, 5 кадрів) для економії запитів

Claude Code хай сам обере підхід залежно від build-pipeline проєкту.
