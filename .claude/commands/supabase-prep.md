# /supabase-prep — Підготовка до Supabase (міграції + performance + retry + offline + error handling)

Цей скіл активується коли задача торкається **міграції даних**, **мережі**, **продуктивності** або **підготовки до переходу з localStorage на Supabase**. Об'єднує 5 зон (Migration Guardian + Performance + Retry + Offline Queue + Error Handling) бо вони зв'язані одним сценарієм "дані втрачаються / повільно / не синхронізуються".

---

## ⚠️ Перед виконанням — обов'язкові перевірки

1. **Міграція даних — ЗАБОРОНЕНО переписувати наосліп.** Дані користувача у localStorage — **єдине джерело правди**, якщо зламати — нема бекапу. Перед будь-якою міграцією:
   - Прочитай існуючі патерни у проекті:
     - `src/tabs/health.js` → `_migrateHealthCard()` + `getHealthCards()` (рядки 19-75) — прапорець `nm_health_migrated_v2` + lazy migration при першому читанні.
     - `src/tabs/finance.js` → `_migrateFinCats()` (рядки 142-163) — детекція формату (масив рядків vs масив об'єктів) + in-place migration у getFinCats().
     - `src/core/nav.js` → `_migrateLegacyMemoryToFacts()` (рядки 1104-1145) — одноразова міграція текст → структура через tool calling.
   - **Ніколи не видаляй старий ключ localStorage після міграції** — залишай як fallback (приклад: `nm_memory` живе поруч з `nm_facts`).

2. **Централізована БД-абстракція (`db.js`) — ЗАБОРОНЕНА.** Жорсткий закон з `CLAUDE.md`: "вже пробували у старій флат-структурі — зламало все одразу". Кожна вкладка працює з localStorage напряму через власні `get*()` / `save*()`. **Не намагайся створити обгортку "для зручності переходу на Supabase".**

3. **`localStorage.setItem` override у `src/core/boot.js` — не чіпати.** Це наша кастомна версія що дублює запис у BroadcastChannel для cross-tab sync. Поруч живе `BroadcastChannel('nm_sync')` як fallback. Зняття override — окрема задача у ROADMAP ("BroadcastChannel cleanup"), НЕ у цій сесії.

4. **B-67 Performance monitor вже існує.** `src/core/diagnostics.js` — startup/longtask/fetch monkey-patch, рендерить у панелі логу. Перед додаванням нових метрик — прочитай що вже вимірюється (`getPerformanceData()`, `runHealthCheck()`, `runSmokeTests()`). Не дублюй.

5. **CACHE_NAME bump** після будь-якої зміни коду.

6. **Тестування міграції — ОБОВ'ЯЗКОВЕ на 3 стани localStorage:**
   - (а) Порожній localStorage (новий юзер)
   - (б) Повний localStorage у старому форматі
   - (в) Повний localStorage у новому форматі (міграція вже пройшла — не має повторювати)
   
   **Якщо не можеш симулювати всі 3 — повідом Роману список кейсів для ручної перевірки.**

7. **НЕ підключати `@supabase/supabase-js` у цій сесії без явного дозволу Романа.** Цей скіл — про ПІДГОТОВКУ до Supabase, не про саму міграцію. Реальна Supabase-міграція — окремий масштабний план, не робити раптово.

**Якщо задача зачіпає дані користувача — зупинись і повідом Роману план ДО будь-яких змін.**

---

## Зона 1 — Міграції (Migration Guardian)

### Стандартний патерн міграції (копіювати з `src/tabs/health.js:61-75`)

```javascript
const MIGRATION_FLAG = 'nm_<name>_migrated_v<N>';

export function get<Data>() {
  const raw = JSON.parse(localStorage.getItem('nm_<name>') || '[]');
  if (raw.length === 0) return raw;
  if (localStorage.getItem(MIGRATION_FLAG) === '1') return raw;
  
  // Одноразова міграція
  let anyChanged = false;
  const result = raw.map(item => {
    const { item: migrated, changed } = _migrateItem(item);
    if (changed) anyChanged = true;
    return migrated;
  });
  if (anyChanged) localStorage.setItem('nm_<name>', JSON.stringify(result));
  localStorage.setItem(MIGRATION_FLAG, '1');
  return result;
}

function _migrateItem(item) {
  let changed = false;
  // 1. Додати нові поля з дефолтами
  if (item.newField === undefined) { item.newField = ''; changed = true; }
  // 2. Конвертувати старі структури у нові
  if (Array.isArray(item.oldNotes) && item.oldNotes.length > 0) {
    item.newNotes = item.oldNotes.map(n => ({ ts: n.date ? new Date(n.date).getTime() : Date.now(), text: n.text }));
    delete item.oldNotes;
    changed = true;
  }
  return { item, changed };
}
```

### Чек-ліст міграції (пройти перед пушем)

- [ ] Є прапорець `nm_<name>_migrated_v<N>` (з номером версії)
- [ ] Міграція відбувається **lazy при першому читанні**, не в bootApp (не гальмуємо старт)
- [ ] Старий ключ **НЕ видаляється** (fallback)
- [ ] Вхідні типи перевірені (`Array.isArray`, `typeof === 'object'`)
- [ ] Порожній localStorage → `return []` БЕЗ запису прапорця (запиши тільки після реальної міграції)
- [ ] `changed` trackається щоб не писати у localStorage якщо нічого не змінилось
- [ ] `window.dispatchEvent(new CustomEvent('nm-data-changed', { detail: '<тип>' }))` після save (OWL мозок)

### Оновити таблицю у CLAUDE.md

Після нової міграції — додати рядок у CLAUDE.md → секція "Дані (localStorage)" з новим прапорцем `nm_X_migrated_vN`.

---

## Зона 2 — Performance (розширення B-67)

### Існуючі метрики у `src/core/diagnostics.js`

- **Startup time** — від `DOMContentLoaded` до першого рендеру
- **Long tasks** — через `PerformanceObserver` (50ms+ блокування)
- **Fetch monkey-patch** — час всіх AI-викликів

### Нові метрики що можна додавати (коли потрібно)

- **localStorage size** — `JSON.stringify(localStorage).length / 1024` KB (ліміт iOS Safari ~5MB)
- **Повільні запити** (>3s AI або fetch) — попередження у `runHealthCheck()`
- **Кількість fetch за 1 хв** — rate limiting warning
- **Alerting у панелі логу** — якщо Health Check завалив 2+ перевірки

**Перед додаванням метрики** — обґрунтувати Роману навіщо (у числах: "зараз localStorage 3.2MB з 5MB ліміту, треба попередити коли >4MB").

---

## Зона 3 — Retry з exponential backoff

### Стандартний патерн (для AI-викликів і майбутніх Supabase-запитів)

```javascript
async function withRetry(fn, maxAttempts = 3, baseDelay = 1000) {
  let lastError;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e;
      // НЕ retry для 4xx клієнтських помилок (крім 408/429)
      if (e.status && e.status >= 400 && e.status < 500 && e.status !== 408 && e.status !== 429) {
        throw e;
      }
      if (attempt < maxAttempts - 1) {
        const delay = baseDelay * Math.pow(2, attempt); // 1с / 2с / 4с
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  throw lastError;
}

// Використання:
const reply = await withRetry(() => callAI(systemPrompt, userMessage));
```

### Де застосовувати

- `src/ai/core.js` → `callAI`, `callAIWithTools` (зараз без retry)
- Майбутні Supabase RPC виклики
- **НЕ** для локальних operations (localStorage/DOM — retry не допоможе)

### Важливо

- Retry тільки на **ідемпотентних** операціях (GET, PUT з тим самим payload). POST з створенням — НЕ retry (можна створити дублікат).
- Показати юзеру toast "Мережа повільна, повторюю спробу..." тільки після 1-ї невдачі (не одразу).

---

## Зона 4 — Offline Queue

### Мінімальний патерн

```javascript
const QUEUE_KEY = 'nm_offline_queue';

function enqueueOperation(op) {
  const queue = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
  queue.push({ id: Date.now(), ...op, ts: Date.now() });
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

async function flushQueue() {
  if (!navigator.onLine) return;
  const queue = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
  const remaining = [];
  for (const op of queue) {
    try {
      await executeOperation(op);
    } catch (e) {
      remaining.push(op);
    }
  }
  localStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));
}

window.addEventListener('online', flushQueue);
```

### Що ставити у чергу

- Supabase POST/PATCH коли offline
- AI виклики коли немає мережі (з дегредацією — показати юзеру "AI недоступний, спробуй пізніше")

### Що НЕ ставити у чергу

- Локальні operations у localStorage — вони вже "offline-first"
- Unique operations без ідемпотентного ключа (можуть виконатись двічі при flush)

---

## Зона 5 — Error Handling

### Єдиний toast для помилок

Додати у `src/core/nav.js` якщо нема:

```javascript
export function showErrorToast(message, detail = null) {
  showToast(`❗ ${message}`, 'error');
  if (detail && window.logError) window.logError(detail);
}
```

### Використання у callAI

```javascript
try {
  const reply = await withRetry(() => callAI(...));
  return reply;
} catch (e) {
  showErrorToast('AI зараз недоступний', e);
  return null;
}
```

### Правила

- Юзер НЕ має бачити технічних деталей у toast ("TypeError: undefined"). Тільки "AI зараз недоступний", "Не вдалось зберегти", "Мережа повільна".
- Всі помилки → `src/core/logger.js` (панель логу) для діагностики.
- Без `catch` — `unhandledrejection` вже слухає `src/core/logger.js` (перевір що не зламано).

---

## Чек-ліст перед пушем (пройти всі)

- [ ] Міграція тестована на порожньому + заповненому localStorage
- [ ] Прапорець `nm_*_migrated_v*` встановлюється тільки після успішної міграції
- [ ] Старий ключ зберігається як fallback
- [ ] Таблиця у CLAUDE.md оновлена (новий прапорець + опис)
- [ ] Retry тільки на ідемпотентних операціях
- [ ] Toast помилок — людська мова, без технічних деталей
- [ ] Performance метрики узгоджені з B-67 (не дублюють)
- [ ] CACHE_NAME bump у sw.js
- [ ] `nm-data-changed` подія dispatched після save

## Важливо

- **Supabase migration — окрема масштабна задача**, не робити разом з іншими фічами. Спочатку скіл готує інфраструктуру (retry/queue/migrations pattern), сама міграція — окрема сесія.
- **localStorage на iOS Safari еvіцтиться через 7 днів неактивності** — це одна з ключових причин переходу на Supabase. Документ це у логах якщо трапиться у юзера.
- **Не додавати `indexedDB` як проміжний рівень** — ускладнення без користі, перейдемо одразу на Supabase.
- **Тестування на iPhone** — єдиний валідний критерій що міграція спрацювала у продакшені. Симуляція у Chrome DevTools — тільки перший рівень.
