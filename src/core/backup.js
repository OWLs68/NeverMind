// === BACKUP MECHANISM (myshu Сесія 3B 11.05.2026) ===
// Pre-Migration Hardening Підсесія 1 — `nm_backup_v*` механізм.
//
// Призначення: бекап localStorage ПЕРЕД UUID-міграціями (Habits/Notes/Events/Moments
// /Finance/Project/Health/Allergy/InboxItem) та іншими ризикованими змінами схеми.
// При помилці міграції — швидкий rollback одним викликом.
//
// Селективний (не весь localStorage):
//   - Бекапимо ТIЛЬКИ зачеплені ключі (nm_habits2 при habit UUID міграції) —
//     щоб не зайти у quota (localStorage ~5 MB ліміт iPhone Safari).
//   - V8 Tasks UUID міграція робила це ad-hoc — цей модуль уніфікує.
//
// Auto-cleanup: тримаємо тільки 3 останніх backup-and-forget — старі видаляються
// автоматично щоб не лишити мертвий стейт у localStorage.
//
// API:
//   createSelectiveBackup(keys: string[], label: string) → backupKey | null
//   restoreBackup(backupKey: string) → boolean
//   listBackups() → string[]    // відсортовано від найстарішого до нового
//   cleanupOldBackups(keepLast = 3)

const BACKUP_PREFIX = 'nm_backup_';
const MAX_BACKUPS = 3;
// DGH6F 16.05: при restore ключа потрібно скинути відповідні migration flags,
// інакше boot.js runMigrations пропустить v9-v17 (флаг каже «вже зроблено») а
// відновлені дані мають СТАРИЙ формат → mixed state UUID/number → silent fail.
// Список зібрано з grep `setItem.*_migrated_v|_done|_cleared_v` у boot.js (DGH6F).
// ⚠️ ВКЛЮЧАТИ ТIЛЬКИ flags типу «UUID conversion» / «field-value remap» — тобто
// міграції що ІДЕМПОТЕНТНI при повторному виконанні (typeof check guards).
// 🚫 НЕ включати CLEANUP flags (removeItem / wipe) — повторне виконання знищить
// restored дані! Приклад анти-патерна: `nm_health_log_cleared_v6` робить
// `removeItem('nm_health_log')` (boot.js:454-456) — скинути цей flag після
// restore = повторне видалення відновлених даних.
//
// Аудит Council 16.05 (DGH6F): додано v17 steps (зачіпає tasks+projects),
// v9 habit_log2 cross-ref, v16 allergies cross-ref. Видалено помилковий
// 'nm_health_log_cleared_v6' (CLEANUP, не conversion).
const KEY_MIGRATION_FLAGS = {
  'nm_tasks':        ['nm_tasks_uuid_migrated_v8', 'nm_steps_uuid_migrated_v17'],
  'nm_habits2':      ['nm_habits_uuid_migrated_v9'],
  'nm_habit_log2':   ['nm_habits_uuid_migrated_v9'],  // v9 cross-ref: log keys = habit.id
  'nm_events':       ['nm_events_uuid_migrated_v10'],
  'nm_notes':        ['nm_notes_uuid_migrated_v11'],
  'nm_moments':      ['nm_moments_uuid_migrated_v12'],
  'nm_finance':      ['nm_finance_uuid_migrated_v13'],
  'nm_projects':     ['nm_projects_uuid_migrated_v14', 'nm_steps_uuid_migrated_v17'],
  'nm_inbox':        ['nm_inbox_uuid_migrated_v15'],
  'nm_health_cards': ['nm_health_uuid_migrated_v16', 'nm_health_migrated_v2', 'nm_health_status_v2_done'],
  'nm_allergies':    ['nm_health_uuid_migrated_v16'],  // v16 cross-ref: allergies[].id
};
// iPhone Safari ~5 MB, інші ~10 MB. Беремо консервативно 4 MB як «небезпечну зону»
// для пред-перевірки (DGH6F 16.05). Якщо payload + поточні дані > QUOTA_BUDGET →
// quota fail передбачуваний → видаємо явну помилку, не тихо null.
const QUOTA_BUDGET_BYTES = 4 * 1024 * 1024;

// Оцінка займаного місця у localStorage (всі ключі, не тільки nm_*). Розмір
// key+value у chars; UTF-16 = 2 байти/char у Safari, але це апроксимація — точна
// квота специфічна для браузера. Використовується для передперевірки backup quota.
function _estimateUsedBytes() {
  let bytes = 0;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      const v = localStorage.getItem(k);
      bytes += (k.length + (v ? v.length : 0)) * 2;
    }
  } catch {}
  return bytes;
}

// Створює селективний бекап вказаних ключів. label — короткий ідентифікатор
// причини бекапу (напр. 'pre-habit-uuid-v9'). Ts додається у key.
// Повертає key створеного бекапу або null при quota error / порожньому snapshot.
//
// DGH6F 16.05: додано передперевірку quota — якщо payload + existing > 4 MB,
// console.warn з конкретними цифрами замість тихого QuotaExceededError. Це
// блокує silent fail коли user-data займає 4+ MB і backup просто не запишеться.
export function createSelectiveBackup(keys, label) {
  if (!Array.isArray(keys) || keys.length === 0) return null;
  if (!label || typeof label !== 'string') return null;

  const ts = new Date().toISOString();
  // Slug-friendly key: nm_backup_pre-habit-uuid-v9_2026-05-11T20-37
  const safeLabel = label.replace(/[^a-z0-9-]/gi, '-').slice(0, 30);
  const tsSlug = ts.slice(0, 16).replace(':', '-'); // 2026-05-11T20-37
  const backupKey = `${BACKUP_PREFIX}${safeLabel}_${tsSlug}`;

  const snapshot = {};
  let hasData = false;
  for (const k of keys) {
    if (typeof k !== 'string' || !k.startsWith('nm_')) continue;
    if (k.startsWith(BACKUP_PREFIX)) continue; // не бекапимо бекапи
    const v = localStorage.getItem(k);
    if (v !== null) {
      snapshot[k] = v;
      hasData = true;
    }
  }
  if (!hasData) return null; // нічого бекапити

  const payload = JSON.stringify({ ts, label, data: snapshot });
  // Передперевірка quota (DGH6F 16.05): payload+existing у байтах × 2 (UTF-16).
  // Якщо > QUOTA_BUDGET — спершу пробуємо cleanup, потім якщо ще не вмістимось —
  // warn з конкретикою і return null. Без цього юзер бачить тільки тиху відсутність
  // backup'у (createSelectiveBackup → null) і не розуміє чому.
  // Council аудит 16.05: кеш _estimateUsedBytes (1 O(n) виклик початковий + 1
  // після cleanup, замість 3) щоб не блокувати boot на iPhone Safari з повним
  // сховищем.
  const payloadBytes = (backupKey.length + payload.length) * 2;
  const initialUsed = _estimateUsedBytes();
  if (initialUsed + payloadBytes > QUOTA_BUDGET_BYTES) {
    try { cleanupOldBackups(0); } catch {}
    const afterCleanup = _estimateUsedBytes();
    if (afterCleanup + payloadBytes > QUOTA_BUDGET_BYTES) {
      const usedMB = (afterCleanup / 1024 / 1024).toFixed(2);
      const payloadMB = (payloadBytes / 1024 / 1024).toFixed(2);
      console.warn(
        '[backup] QUOTA: skipped «' + label + '» — payload ' + payloadMB + ' MB + ' +
        'existing ' + usedMB + ' MB > 4 MB budget. ' +
        'JSON-export рекомендований замість in-storage backup.'
      );
      return null;
    }
  }

  try {
    localStorage.setItem(backupKey, payload);
    // Cleanup старих backups (тримаємо тільки MAX_BACKUPS)
    try { cleanupOldBackups(MAX_BACKUPS); } catch {}
    return backupKey;
  } catch (e) {
    // QuotaExceededError що проскочив передперевірку (race з іншим write або
    // браузер з меншою квотою) — finальна спроба cleanup + retry.
    try {
      cleanupOldBackups(0); // прибрати всі старі
      localStorage.setItem(backupKey, payload);
      return backupKey;
    } catch {
      console.warn('[backup] quota exceeded після cleanup — backup skipped:', label);
      return null;
    }
  }
}

// Відновлює бекап за key. Перезаписує ВСI ключі що були у snapshot.
// Інші ключі (не з snapshot) — не чіпає.
//
// DGH6F 16.05: race lock через window.__nm_restoring + custom event'и
// nm-restore-start / nm-restore-end. Listener'и (OWL scheduler, autosave,
// nm-data-changed) можуть перевіряти `if (window.__nm_restoring) return` щоб
// не перезаписати дані що зараз відновлюються. Без lock'а було можливо:
// restore відновлює nm_inbox → OWL listener тригериться → переписує своєю
// версією → юзер бачить НЕ restore-стан.
export function restoreBackup(backupKey) {
  if (!backupKey || !backupKey.startsWith(BACKUP_PREFIX)) return false;
  const raw = localStorage.getItem(backupKey);
  if (!raw) return false;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.data !== 'object') return false;
    try { window.__nm_restoring = true; } catch {}
    try { window.dispatchEvent(new CustomEvent('nm-restore-start', { detail: { backupKey } })); } catch {}
    try {
      Object.entries(parsed.data).forEach(([k, v]) => {
        try { localStorage.setItem(k, v); } catch {}
        // DGH6F: скинути migration flags для цього ключа щоб runMigrations
        // повторно мігрувала відновлений (старий) формат при наступному boot.
        const flags = KEY_MIGRATION_FLAGS[k];
        if (flags) {
          flags.forEach(flag => {
            try { localStorage.removeItem(flag); } catch {}
          });
        }
      });
      return true;
    } finally {
      try { window.__nm_restoring = false; } catch {}
      try { window.dispatchEvent(new CustomEvent('nm-restore-end', { detail: { backupKey } })); } catch {}
      // DGH6F 16.05: nm-data-changed dispatch ПIСЛЯ зняття __nm_restoring lock
      // щоб UI listener'и перерендерили з restored даними (інакше юзер бачить
      // старі дані до F5). Listener'и з restore-guard'ом тепер дозволять.
      try { window.dispatchEvent(new CustomEvent('nm-data-changed', { detail: 'restore' })); } catch {}
    }
  } catch (e) {
    try { window.__nm_restoring = false; } catch {}
    console.error('[backup] restore failed:', backupKey, e);
    return false;
  }
}

// Список всіх бекапів, відсортовано від найстарішого до нового.
export function listBackups() {
  const result = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(BACKUP_PREFIX)) result.push(k);
  }
  return result.sort(); // ISO timestamp в назві — лексикографічне = хронологічне
}

// Прибирає старі бекапи, залишаючи тільки `keepLast` найновіших.
export function cleanupOldBackups(keepLast = MAX_BACKUPS) {
  const all = listBackups();
  if (all.length <= keepLast) return 0;
  const toRemove = all.slice(0, all.length - keepLast);
  toRemove.forEach(k => {
    try { localStorage.removeItem(k); } catch {}
  });
  return toRemove.length;
}

// Helper для UI — повертає метадані бекапу (ts, label, ключі) без data.
export function getBackupInfo(backupKey) {
  const raw = localStorage.getItem(backupKey);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return {
      key: backupKey,
      ts: parsed.ts,
      label: parsed.label,
      keys: parsed.data ? Object.keys(parsed.data) : [],
      sizeKB: Math.round(raw.length / 1024),
    };
  } catch { return null; }
}

// === OBErR Phase 2 (18.05.2026) ===
// Розширення для повного backup + JSON експорт/імпорт + Restore UI integration.

// Створює ПОВНИЙ backup (всі data + settings ключі з NM_KEYS). Обгортка над
// createSelectiveBackup. Quota check + cleanup автоматично — якщо повна
// data > 4 MB, повертає null → UI має запропонувати JSON export як fallback.
//
// import { NM_KEYS } зробив через runtime require (boot.js імпортує backup
// частково → циклічне import.statement, але runtime читання працює бо
// NM_KEYS — це const export ініціалізований до bootApp).
export function createFullBackup(label) {
  const labelStr = label || 'manual';
  // Запит NM_KEYS через window — глобально доступний після boot. Якщо backup
  // викликається до boot (раннє завантаження) — fallback на мінімальний набір.
  // OBErR audit fix: ВКЛЮЧАЄМО і chat історію (nm.chat — 8 чатів). Раніше
  // restore відновлював дані але видаляв всі розмови → юзер думав що це
  // втрата даних. Chat історія ≤50 повідомлень/чат після truncate — розмір
  // прийнятний. Quota check у createSelectiveBackup захищає від quota fail.
  let keys;
  try {
    const nm = (typeof window !== 'undefined' && window.NM_KEYS) ? window.NM_KEYS : null;
    if (nm && Array.isArray(nm.data) && Array.isArray(nm.settings)) {
      keys = [...nm.data, ...nm.settings, ...(Array.isArray(nm.chat) ? nm.chat : [])];
    } else {
      // Fallback (boot ще не закінчився): мінімальний набір з даних.
      keys = ['nm_inbox','nm_tasks','nm_notes','nm_habits2','nm_finance',
              'nm_health_cards','nm_projects','nm_events','nm_settings'];
    }
  } catch {
    keys = ['nm_inbox','nm_tasks','nm_notes'];
  }
  return createSelectiveBackup(keys, 'full-' + labelStr);
}

// Експортує backup у JSON-файл (download). iOS PWA fallback через
// navigator.share (Pre-mortem Council OBErR: <a download> ігнорується у
// standalone-mode на iOS Safari — файл відкривається у новій вкладці без
// download). На iOS PWA: navigator.share({ files: [File] }) → Share Sheet →
// «Save to Files». На desktop / Chrome Android: звичайний download anchor.
//
// OBErR audit fix: повертає Promise<'download' | 'share' | 'cancelled' | 'error'>
// замість sync return. Раніше: caller бачив 'share' одразу після виклику
// navigator.share без await → toast «📤 Файл — у Share Sheet» показувався
// навіть коли юзер cancel'нув share → втрата backup без попередження.
// Тепер: чекаємо resolve/reject, AbortError → 'cancelled' (mute), інші → 'error'.
export async function downloadBackupAsJson(backupKey, filename) {
  const raw = localStorage.getItem(backupKey);
  if (!raw) return 'error';
  const name = filename || ('nm-backup-' + backupKey.replace(/^nm_backup_/, '') + '.json');
  try {
    const blob = new Blob([raw], { type: 'application/json' });
    const isIosPwa = /iP(hone|ad|od)/.test(navigator.userAgent || '') &&
                     (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
    if (isIosPwa && typeof navigator.share === 'function' && typeof File === 'function') {
      const file = new File([blob], name, { type: 'application/json' });
      // Pre-mortem #1: canShare feature-detect (iOS 15+) щоб поглянути що файлова
      // share не буде відхилена браузером (iPhone 12 iOS 14 має navigator.share
      // але не files). Якщо false — fall through до <a download> fallback.
      const canShareFiles = typeof navigator.canShare === 'function'
        ? navigator.canShare({ files: [file] }) : true;
      if (canShareFiles) {
        try {
          await navigator.share({ files: [file], title: 'NeverMind backup' });
          return 'share';
        } catch (e) {
          // AbortError — юзер cancel'нув Share Sheet, не помилка
          if (e && e.name === 'AbortError') return 'cancelled';
          // Інші помилки — fall through до <a download>
        }
      }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      try { document.body.removeChild(a); } catch {}
      try { URL.revokeObjectURL(url); } catch {}
    }, 500);
    return 'download';
  } catch (e) {
    console.error('[backup] downloadBackupAsJson failed:', e);
    return 'error';
  }
}

// Імпорт JSON-файлу як backup. Валідує структуру (ts/label/data) і записує у
// nm_backup_* з префіксом 'imported-'. Не виконує restore автоматично — юзер
// після імпорту бачить новий backup у списку і вирішує сам.
//
// jsonText — рядок з вмістом файлу.
// Returns: backupKey | null.
export function importBackupJson(jsonText) {
  if (typeof jsonText !== 'string' || jsonText.length === 0) return null;
  try {
    const parsed = JSON.parse(jsonText);
    if (!parsed || typeof parsed !== 'object') return null;

    // Підтримуємо 2 формати:
    // (а) Native backup format: { ts, label, data: { ...keys } }
    // (б) Legacy exportData format (nav.js:1019): { nm_inbox: [...], ... }
    //     Загортаємо у native format.
    let snapshot, sourceLabel, sourceTs;
    if (parsed.data && typeof parsed.data === 'object') {
      // Native format
      snapshot = parsed.data;
      sourceLabel = (typeof parsed.label === 'string' ? parsed.label : 'unknown');
      sourceTs = (typeof parsed.ts === 'string' ? parsed.ts : new Date().toISOString());
    } else {
      // Legacy: object з nm_* ключами напряму
      const keys = Object.keys(parsed).filter(k => k.startsWith('nm_') && !k.startsWith(BACKUP_PREFIX));
      if (keys.length === 0) return null;
      snapshot = {};
      keys.forEach(k => {
        const v = parsed[k];
        snapshot[k] = typeof v === 'string' ? v : JSON.stringify(v);
      });
      sourceLabel = 'legacy-export';
      sourceTs = new Date().toISOString();
    }

    const ts = new Date().toISOString();
    const tsSlug = ts.slice(0, 16).replace(':', '-');
    const safeLabel = ('imported-' + sourceLabel).replace(/[^a-z0-9-]/gi, '-').slice(0, 30);
    const backupKey = BACKUP_PREFIX + safeLabel + '_' + tsSlug;
    const payload = JSON.stringify({ ts: sourceTs, label: 'imported: ' + sourceLabel, data: snapshot });
    localStorage.setItem(backupKey, payload);
    cleanupOldBackups(MAX_BACKUPS);
    return backupKey;
  } catch (e) {
    console.warn('[backup] importBackupJson failed:', e);
    return null;
  }
}
