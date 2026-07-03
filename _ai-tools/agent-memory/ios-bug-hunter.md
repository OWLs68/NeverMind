# Памʼять ios-bug-hunter (між сесіями)

> Пише ТІЛЬКИ Голова (агент read-only) — після ПІДТВЕРДЖЕНОЇ знахідки/спростування.
> Агент читає цей файл ПЕРШИМ — щоб не перевідкривати відоме і бити у перевірені точки.

## Підтверджені класи знахідок
- `\b` у regex не матчить кирилицю (JS) — клас закрито v3pexs 27.06, сторож check-cyrillic-boundary.
- `escapeJsArg` ≠ `escapeHtml` для data-* атрибутів (3 рецидиви у notes.js) — data-* завжди escapeHtml.
- `modal.innerHTML=...` відʼєднує card від touch-listener свайпу (B-198, swipe-core) — ще ВІДКРИТО.
- backdrop-filter + mask-image на iOS композитяться криво (B-128 drum-col) — уникати комбінації.

## Хибні сліди (не повторювати)
- «brain_tab_X → info-bucket» (PJi7l) — реальний корінь був у _FOLLOWUP_TRIGGER_TYPE дефолті.
