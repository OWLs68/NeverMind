#!/usr/bin/env node
// scripts/check-entity.js
//
// Юніт-сторож конверта сутності (Supabase Фаза 1, Фундамент §1).
// Замикає форму id/user_id/created_at/updated_at/deleted_at/hlc — це «двері в
// один бік», схема не має тихо змінитись між сесіями. Біжить з pre-push-check.js.
//
// stampEntity — чиста функція без I/O, тож імпортуємо tfile:// напряму (ESM).
// generateUUID усередині тягне лише crypto (є у node) — браузер-globals не треба.

const path = require('path');
const { pathToFileURL } = require('url');

(async () => {
  const mod = await import(pathToFileURL(path.join(__dirname, '..', 'src', 'core', 'entity.js')).href);
  const { stampEntity, nowISO } = mod;

  let passed = 0;
  const failures = [];
  const check = (label, cond) => { if (cond) passed++; else failures.push('✗ ' + label); };

  const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  // --- nowISO ---
  check('nowISO → ISO 8601 UTC', ISO_RE.test(nowISO()));

  // --- новий запис: усі поля конверта присутні ---
  const fresh = stampEntity({ text: 'купити хліб', amount: 37 });
  check('новий: дані збережені (text)', fresh.text === 'купити хліб');
  check('новий: дані збережені (amount)', fresh.amount === 37);
  check('новий: id — згенерований uuid', UUID_RE.test(fresh.id));
  check('новий: user_id = null (заглушка до auth)', fresh.user_id === null);
  check('новий: created_at — ISO', ISO_RE.test(fresh.created_at));
  check('новий: updated_at — ISO', ISO_RE.test(fresh.updated_at));
  check('новий: deleted_at = null', fresh.deleted_at === null);
  check('новий: hlc = null (Фаза 1 заглушка)', fresh.hlc === null);
  check('новий: усі 6 полів конверта присутні',
    ['id','user_id','created_at','updated_at','deleted_at','hlc'].every(k => k in fresh));

  // --- збереження існуючих полів ---
  const existing = stampEntity({ id: 'fixed-id-123', created_at: '2020-01-01T00:00:00.000Z', text: 'x' });
  check('існуючий id НЕ перезаписаний', existing.id === 'fixed-id-123');
  check('існуючий created_at НЕ перезаписаний', existing.created_at === '2020-01-01T00:00:00.000Z');

  // --- updated_at ЗАВЖДИ свіжий (не перетирається значенням з rec) ---
  const stale = stampEntity({ updated_at: '2019-01-01T00:00:00.000Z', text: 'x' });
  check('updated_at НЕ перетертий старим з rec', stale.updated_at !== '2019-01-01T00:00:00.000Z');
  check('updated_at свіжий — ISO', ISO_RE.test(stale.updated_at));

  // --- soft-delete tombstone зберігається ---
  const tomb = stampEntity({ id: 'a', deleted_at: '2024-06-01T00:00:00.000Z' });
  check('deleted_at tombstone збережений', tomb.deleted_at === '2024-06-01T00:00:00.000Z');

  // --- user_id/hlc зберігаються коли вже є (backfill / sync-шар) ---
  const synced = stampEntity({ id: 'a', user_id: 'u-1', hlc: '169:0:abc' });
  check('user_id збережений коли заданий', synced.user_id === 'u-1');
  check('hlc збережений коли заданий', synced.hlc === '169:0:abc');

  // --- порожній виклик не падає ---
  const empty = stampEntity();
  check('stampEntity() без аргументів → валідний конверт', UUID_RE.test(empty.id) && empty.deleted_at === null);

  // --- два штампи дають РІЗНІ id (не колізія) ---
  check('два stampEntity → різні id', stampEntity().id !== stampEntity().id);

  if (failures.length > 0) {
    console.error(`\n=== ❌ ENTITY-СТОРОЖ: ${failures.length} провалів (${passed} ок) ===\n`);
    console.error(failures.join('\n'));
    console.error('\nКонверт сутності у src/core/entity.js зламано або форму змінено.');
    console.error('Це «двері в один бік» Supabase-схеми — НЕ пушити без фіксу.\n');
    process.exit(1);
  }
  console.log(`✅ entity-сторож: ${passed}/${passed} тестів пройдено (stampEntity конверт)`);
  process.exit(0);
})().catch(e => {
  console.error('entity-сторож впав з винятком:', e.message);
  process.exit(1);
});
