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

// Створює селективний бекап вказаних ключів. label — короткий ідентифікатор
// причини бекапу (напр. 'pre-habit-uuid-v9'). Ts додається у key.
// Повертає key створеного бекапу або null при quota error / порожньому snapshot.
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
  try {
    localStorage.setItem(backupKey, payload);
    // Cleanup старих backups (тримаємо тільки MAX_BACKUPS)
    try { cleanupOldBackups(MAX_BACKUPS); } catch {}
    return backupKey;
  } catch (e) {
    // QuotaExceededError — спробувати скоротити старі і повторити
    try {
      cleanupOldBackups(0); // прибрати всі старі
      localStorage.setItem(backupKey, payload);
      return backupKey;
    } catch {
      console.warn('[backup] quota exceeded — backup skipped:', label);
      return null;
    }
  }
}

// Відновлює бекап за key. Перезаписує ВСI ключі що були у snapshot.
// Інші ключі (не з snapshot) — не чіпає.
export function restoreBackup(backupKey) {
  if (!backupKey || !backupKey.startsWith(BACKUP_PREFIX)) return false;
  const raw = localStorage.getItem(backupKey);
  if (!raw) return false;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.data !== 'object') return false;
    Object.entries(parsed.data).forEach(([k, v]) => {
      try { localStorage.setItem(k, v); } catch {}
    });
    return true;
  } catch (e) {
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
