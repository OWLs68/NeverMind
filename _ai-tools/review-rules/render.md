# Чекліст рендер-шляхів (усе що будує HTML)

- **escapeHtml на ВСЕ юзерське** що потрапляє у розмітку. Кейс B-197/клас: для `data-*` атрибутів — ЗАВЖДИ escapeHtml, НІКОЛИ escapeJsArg (dataset декодує сутності).
- **`\n` → `<br>` ПІСЛЯ escape**, не до.
- **Посилання — тільки через safeHref** (блок javascript:/data:).
- **onclick заборонено** — тільки data-action/data-fn делегація (onclick-freeze сторож).
- **modal.innerHTML=... відʼєднує touch-listener'и** від старих вузлів (B-198) — re-setup або точковий рефреш контейнера.
- **backdrop-filter + mask-image на iOS** композитяться криво — уникати комбінації (B-128).
