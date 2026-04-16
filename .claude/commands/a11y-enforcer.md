# /a11y-enforcer — WCAG атрибути перед публічним релізом

Цей скіл активується **перед публічним релізом** NeverMind. Додає aria-labels, роль, фокус-порядок, контраст. **НЕ застосовувати раніше** — зараз єдиний користувач Роман (зрячий, на iPhone), A11y не у пріоритеті за `_ai-tools/SKILLS_PLAN.md`.

---

## ⚠️ Перед виконанням — обов'язкові перевірки

1. **Час активації скіла — тільки перед публічним запуском.** До цього моменту:
   - Активний `🚀 Active` блок з `ROADMAP.md` — Блок 2 концепцій вкладок.
   - Після Supabase — стрес-тест 20-30 юзерів.
   - **Тільки ПІСЛЯ стрес-тесту і успішного результату** — викликати цей скіл.
   
   Якщо зараз Роман просить застосувати до загального релізу — перепитай чи ми вже пройшли стрес-тест.

2. **НЕ ламати існуючі CSS-класи додаючи роль.** Багато елементів у `index.html` використовуються у `.querySelector()` з `src/*.js`:
   - `.owl-chip`, `.tab-item`, `.ai-bar-input-box`, `.page`, `.task-card`
   
   **Перед правкою** — пошук класу у `src/`, щоб не зламати selector. Якщо додаєш `role="button"` до `<div>` — переконайся що існує обробник клавіатури (Enter/Space), інакше semantics бреше.

3. **Target iPhone Safari.** Не вигадуй NVDA/JAWS інтеграції — наш юзер у VoiceOver на iOS. Пріоритет:
   - VoiceOver labels (aria-label, aria-describedby)
   - Dynamic Type (система збільшення шрифтів iOS)
   - iOS Reduce Motion (prefers-reduced-motion)

4. **Контраст кольорів за `docs/DESIGN_SYSTEM.md`.** Перевіряти проти існуючої палітри (#1e1040 на білому, amber `#c2790a`). **НЕ** пропонувати нові кольори "для кращого контрасту" — це ламає дизайн-систему. Якщо існуючий колір не проходить WCAG AA — обговори з Романом.

5. **Не змінювати поведінку** — A11y додається **поверх** існуючого UI, не переписує. Якщо скіл вимагає поведінкову зміну (наприклад, "додати фокус-індикатор на tap-елемент") — спочатку погоди з Романом.

6. **CACHE_NAME bump** обов'язковий після зміни `index.html` / `style.css` / JS.

**Якщо не впевнений який рівень A11y застосовувати (AA vs AAA) — WCAG 2.1 AA за замовчуванням (найчастіший стандарт для публічних веб-додатків).**

---

## Крок 1 — Аудит існуючого коду

```bash
# Чи є aria-атрибути взагалі
grep -rn "aria-" index.html src/ | head -20

# Чи є semantic elements (не тільки div)
grep -cn "<button\|<nav\|<main\|<section" index.html

# prefers-reduced-motion у CSS
grep -n "prefers-reduced-motion" style.css
```

Якщо щось з цього дає 0 — проблема системна, треба план на 2-3 сесії, не точковий фікс.

## Крок 2 — Пріоритетний чек-ліст (WCAG 2.1 AA)

### 🔴 Критичне (ламає користування у VoiceOver)

- [ ] Кожна іконка-кнопка має `aria-label` (без тексту кнопка "мовчить")
  ```html
  <button aria-label="Видалити задачу" onclick="...">🗑</button>
  ```
- [ ] Навігаційні вкладки (tab-items) мають `role="tab"` + `aria-selected` + обгортка `role="tablist"`
- [ ] Модалки мають `role="dialog"` + `aria-labelledby` + `aria-modal="true"` + trap focus всередині
- [ ] Чіпи OWL мають `role="button"` (бо `<div onclick>`) + keyboard handler (Enter/Space) + `tabindex="0"`
- [ ] Input'и мають `<label>` або `aria-label` (placeholder НЕ замінює label)

### 🟡 Важливе

- [ ] Фокус-індикатор видимий (`:focus-visible { outline: 2px solid #c2790a; }`)
- [ ] Контраст тексту ≥ 4.5:1 (основний текст `#1e1040` на білому = 14.8:1 ✅)
- [ ] Контраст тексту ≥ 3:1 для крупного тексту (18px+ bold або 24px+)
- [ ] `lang="uk"` у `<html>` (бо весь UI українською)
- [ ] prefers-reduced-motion — вимикає анімації OWL і модалок:
  ```css
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
  }
  ```

### 🟢 Бажане

- [ ] Heading hierarchy (h1 → h2 → h3 без стрибків)
- [ ] Skip link ("Перейти до основного вмісту") — для screen reader
- [ ] `aria-live="polite"` на OWL board — щоб VoiceOver оголошував нові повідомлення
- [ ] `aria-busy="true"` під час AI-запиту

## Крок 3 — Патерни додавання A11y до існуючих компонентів

### 3.1 Модалка (bottom sheet)

```html
<div id="task-modal" role="dialog" aria-labelledby="task-modal-title" aria-modal="true" style="...">
  <!-- Backdrop -->
  <div aria-hidden="true" onclick="closeTaskModal()" style="..."></div>
  <!-- Panel -->
  <div style="...">
    <div id="task-modal-title" style="...">Редагувати задачу</div>
    <!-- ... -->
  </div>
</div>
```

JS: при відкритті модалки — зафіксувати фокус на першому input, при закритті — повернути на елемент що відкрив.

### 3.2 OWL чіп (зараз `<div onclick>`)

```html
<div class="owl-chip" 
     role="button" 
     tabindex="0" 
     aria-label="Показати задачі на сьогодні"
     onclick="handleChipClick(...)"
     onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();handleChipClick(...)}">
  Сьогодні
</div>
```

Або краще — міграція на `<button>` через `src/owl/chips.js` → `renderChips()`.

### 3.3 Tab navigation (нижня панель)

```html
<nav role="tablist" aria-label="Головне меню">
  <button role="tab" aria-selected="true" aria-controls="inbox-page" class="tab-item">Inbox</button>
  <button role="tab" aria-selected="false" aria-controls="tasks-page" class="tab-item">Задачі</button>
  <!-- ... -->
</nav>
```

### 3.4 OWL Board (live region)

```html
<div id="owl-board" aria-live="polite" aria-atomic="true" role="status">
  <!-- текст табло — VoiceOver оголошує зміни -->
</div>
```

**УВАГА:** `aria-live` на табло може заспамити VoiceOver якщо OWL генерує часто. Обмежити через `aria-live="polite"` (чекає паузи) + не оновлювати якщо текст не змінився.

## Крок 4 — Тест на iPhone з VoiceOver

1. Увімкнути VoiceOver (Settings → Accessibility → VoiceOver)
2. Відкрити NeverMind
3. Свайпом вправо проходити всі елементи підряд
4. Перевірити:
   - [ ] Кожен інтерактивний елемент озвучується
   - [ ] Назва кнопки зрозуміла без візуалу ("Видалити" а не "Кнопка")
   - [ ] Модалка відкривається → фокус всередині → VoiceOver читає заголовок
   - [ ] Модалка закривається → фокус повертається
   - [ ] Нове повідомлення OWL — VoiceOver оголошує (якщо `aria-live`)
5. Протестувати Dynamic Type — збільшити шрифт до 200% у налаштуваннях iOS. Не має ламати лейаут.

## Крок 5 — Автотест через axe-core (опційно)

```html
<!-- Для dev-режиму: -->
<script src="https://cdn.jsdelivr.net/npm/axe-core@4/axe.min.js"></script>
<script>
  axe.run().then(results => console.table(results.violations));
</script>
```

Запустити з консолі браузера — отримати список WCAG порушень.

## Чек-ліст перед пушем

- [ ] Кожна правка A11y — точкова, не переписує семантику
- [ ] Ніякий `querySelector` з `src/*.js` не зламано (пошук зроблено)
- [ ] Контраст кольорів не змінився (перевірка проти DESIGN_SYSTEM.md)
- [ ] prefers-reduced-motion додано у CSS
- [ ] `lang="uk"` у `<html>`
- [ ] Тест з VoiceOver на iPhone пройдений (якщо критичні зміни)
- [ ] CACHE_NAME bump

## Антипатерни

- ❌ `role="button"` на `<div>` БЕЗ keyboard handler — семантика бреше
- ❌ `aria-label` що дублює видимий текст ("Зберегти" → `aria-label="Зберегти"`)
- ❌ `tabindex="-1"` на видимому елементі — VoiceOver його не знайде
- ❌ `aria-hidden="true"` на інтерактивному елементі — блокує взаємодію
- ❌ `outline: none` без заміни `:focus-visible` — клавіатурні юзери втрачають орієнтацію

## Важливо

- **Перед публічним релізом — додати до CLAUDE.md** секцію про підтримку VoiceOver і prefers-reduced-motion.
- **Пам'ятай:** Роман зрячий і на iPhone. Тестувати A11y у продакшені Роман сам не зможе (нема Screen Reader UX-досвіду). Треба знайти тестера або спертись на автотести + axe-core.
- **A11y — це не "косметика"**, а юридична вимога у деяких юрисдикціях (EU Accessibility Act з 2025). Якщо публічний реліз — **обов'язково** WCAG 2.1 AA.
- Не плутати "A11y для VoiceOver" з "A11y для клавіатури" — iOS-фокус, але не забувати про Tab-навігацію на desktop якщо буде веб-версія.
