# Стан сесії

**Оновлено:** 2026-04-04 14:24

---

## Проект

| | |
|--|--|
| **Версія** | v69 |
| **URL** | owls68.github.io/NeverMind |
| **AI модель** | OpenAI GPT-4o-mini |
| **Гілка** | `claude/review-agent-communication-RoZF9` |

---

## Зараз робимо

OWL Board: повний редизайн Inbox + всіх вкладок. Фіксуємо баги.

---

## Остання сесія (04.04)

### OWL Board — Inbox
- `owl-board` перенесено в `inbox-fixed-top` (не прокручується зі списком)
- Позиціювання: `margin-top: 0` на board, `margin-top: 11px` на chips-wrapper, `margin-top: -10px` на inbox-scroll
- Кнопки: `border: none`, тінь `0 2px 7px rgba(0,0,0,0.32)`, padding всередині `owl-speech-chips` щоб iOS не обрізав тінь
- Кнопка "Поговорити": бурштиновий `rgba(194,100,10,0.90)` (не фіолетовий)
- Тінь під ногами сови: `::after` радіальний градієнт

### OWL Board — Логіка
- Cooldown-система (`nm_owl_cooldowns`) замість `owlAlreadySaid` (раз на добу)
- `getDayPhase()` + `getSchedule()` — фази дня під розклад користувача
- UI розкладу в налаштуваннях (4 time-поля: підйом / початок роботи / кінець / сон)
- Питання онбордингу #6 → парсинг розкладу
- `handleScheduleAnswer()` перехоплює відповідь в Inbox

### OWL Board — всі вкладки (Tasks, Notes, Finance, Me, Evening, Health, Projects)
- Замінено компактні слайдери → той самий стиль що Inbox (велика сова + бабл + чіпи)
- HTML: 7 порожніх контейнерів, структура будується JS динамічно
- Нові функції в `app-core-system.js`: `_owlTabHTML`, `_owlTabApplyState`, `toggleOwlTabChat`, `expandOwlTabChat`, `collapseOwlTabToSpeech`, `owlTabSwipe*`, `sendOwlTabReply`, `sendOwlTabReplyFromInput`, `renderOwlTabMsgs`
- Стани: `speech` → `collapsed` (свайп вгору) / `expanded` (свайп вниз або "Поговорити")
- Чат в expanded: зберігається в `nm_owl_tab_chat_{tab}`, викликає GPT з контекстом вкладки

### Аудит та фікси (04.04 14:24)
- Аудит: `<div>` баланс ✅, синтаксис ✅, дублікати ✅
- Фікс: `owlTabSwipeMove` — `e.preventDefault()` перенесено всередину умов → scroll у чаті тепер не блокується
- Фікс: `tabLabels` — додано `health` і `projects` (раніше AI отримував `undefined`)
- Фікс: `getTabBoardContext` — додано специфічний контекст для `health` і `projects`
- Фікс: `checkTabBoardTrigger` — додано перевірку даних для `health` і `projects`
- Мертвий код: `getTabBoardSaid`, `markTabBoardSaid`, `tabAlreadySaid`, `dismissTabBoard` — не викликаються, але залишені

---

## Попередні сесії

- **03.04 (2)** — OWL Board: `getDayPhase()` + `getSchedule()`. Cooldown-система.
- **03.04** — settings.json хуки, 5 скілів, правило пояснень в дужках. SVG → 🦉. OWL Board UI.
- **02.04** — Inbox стрічка: компактні картки, датові сепаратори. OWL Board: міні-чат.
- **01.04** — Реструктуризація доків. B-11/B-12.
- **31.03** — B-07/B-08/B-10. Deploy pipeline v2.

---

## Відкриті баги

- **B-03** — ~~агент створює задачу замість проекту~~ → **FIXED 04.04**: промпт в `app-ai-core.js` — додано явну заборону `save` якщо є тригер проекту
- B-04/B-09 — тап на день в календарі не працює
- B-05 — картки обрізаються при скролі
- B-06 — поле вводу без blur/fade ефекту

---

## Наступне

- Баги B-04/B-09, B-05, B-06
- Закріплені картки нагадувань (потребує dueDate, Calendar)
