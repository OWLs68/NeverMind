// ============================================================
// core/migrations.js — SCHEMA MIGRATIONS (one-time імпорт старих даних)
//
// Винесено з src/core/boot.js (v3pexs 28.06, D3 автономного блоку): boot.js був
// 1450 рядків (>1200), а 18 boot-міграцій — цільний блок 837 рядків з одним
// викликом (init → runMigrations). План Supabase: ці міграції лишаються ЛИШЕ
// для one-time імпорту localStorage → далі реальні SQL-міграції з 1 дня.
// Поведінка 1:1 — байт-у-байт перенос.
// ============================================================

import { generateUUID } from './uuid.js';
import { createSelectiveBackup } from './backup.js';

// === SCHEMA MIGRATIONS — "добиває" відсутні поля в старих даних ===
export function runMigrations() {
  // v1: dueDate + priority для tasks (потрібні для Календаря)
  const tasks = JSON.parse(localStorage.getItem('nm_tasks') || '[]');
  let changed = false;
  tasks.forEach(t => {
    if (t.dueDate === undefined) { t.dueDate = null; changed = true; }
    if (t.priority === undefined) { t.priority = 'normal'; changed = true; }
  });
  if (changed) localStorage.setItem('nm_tasks', JSON.stringify(tasks));
  // v2 (Фаза 1 Фінансів, 15.04.2026): прибрати застарілі ключі кешу OWL-коуча
  // Блок прибрано з вкладки у переробці концепції v2, кеш-ключі більше не використовуються.
  ['nm_fin_coach_week','nm_fin_coach_month','nm_fin_coach_3months'].forEach(k => {
    localStorage.removeItem(k);
  });
  // v3 (B-32 Фаза 6, 16.04.2026): одноразове очищення кешу OWL-табло
  // щоб прибрати галюциновані повідомлення (€824 на їжу при €58 реальних).
  // getFinanceContext тепер має явні маркери [MONTH_EXPENSES], [TODAY_EXPENSES].
  if (!localStorage.getItem('nm_owl_cache_cleared_v3')) {
    ['nm_owl_board','nm_owl_tab_finance','nm_owl_tab_tasks','nm_owl_tab_notes',
     'nm_owl_tab_health','nm_owl_tab_projects','nm_owl_tab_evening','nm_owl_tab_me',
     'nm_owl_board_ts',
     // Скидаємо Auto-silence щоб OWL заговорив одразу після очищення кешу
     'nm_owl_silence_until','nm_owl_ignored_msgs','nm_owl_last_board_ts','nm_owl_last_chip_click_ts'
    ].forEach(k => localStorage.removeItem(k));
    localStorage.setItem('nm_owl_cache_cleared_v3', '1');
  }
  // v4 (16.04.2026): очистити кеш інсайту фінансів (промпт змінився — потрібна re-generation)
  ['nm_fin_insight_week_0','nm_fin_insight_month_0','nm_fin_insight_3months_0'].forEach(k => localStorage.removeItem(k));
  // v5 (16.04.2026): скинути Auto-silence OWL — табло зникло бо v3 очистив кеш але НЕ скинув silence.
  // OWL замовк і нового не генерує → порожнє табло на всіх вкладках.
  if (!localStorage.getItem('nm_owl_silence_reset_v5')) {
    ['nm_owl_silence_until','nm_owl_ignored_msgs','nm_owl_last_board_ts','nm_owl_last_chip_click_ts'].forEach(k => localStorage.removeItem(k));
    localStorage.setItem('nm_owl_silence_reset_v5', '1');
  }
  // v6 (19.04.2026 сесія 6GoDe): прибрати legacy nm_health_log — UI шкал 1-10
  // видалено 15.04 (B-31), дані вже не записуються і код що їх читав видалений.
  if (!localStorage.getItem('nm_health_log_cleared_v6')) {
    localStorage.removeItem('nm_health_log');
    localStorage.setItem('nm_health_log_cleared_v6', '1');
  }
  // v7 (27.04.2026 UVKL1 Pruning Engine Фаза 2): одноразовий wipe історії табла.
  // Старі повідомлення сови не мають поля entityRefs — вони не фільтруються
  // isMessageRelevant і будуть «застряглі» в історії боксі назавжди.
  // Wipe чистить unified storage щоб сова почала з нуля з правильною моделлю.
  // Видимий ефект: табло порожнє ~30 сек поки сова не згенерує перше нове
  // повідомлення (з entityRefs) — далі нормальний потік.
  if (!localStorage.getItem('nm_pruning_wipe_v1_done')) {
    ['nm_owl_board_unified','nm_owl_board_unified_ts',
     'nm_owl_board','nm_owl_board_ts',
     // Тригерні TS-ключі вкладок — щоб Judge Layer не вирішив що
     // «тільки що генерували, мовчимо ще 30 хв»
     'nm_owl_tab_ts_inbox','nm_owl_tab_ts_tasks','nm_owl_tab_ts_notes',
     'nm_owl_tab_ts_me','nm_owl_tab_ts_evening','nm_owl_tab_ts_finance',
     'nm_owl_tab_ts_health','nm_owl_tab_ts_projects'
    ].forEach(k => localStorage.removeItem(k));
    localStorage.setItem('nm_pruning_wipe_v1_done', '1');
    console.log('[boot] Pruning Engine v1: wiped legacy board history (no entityRefs)');
  }
  // PJi7l 08.05: одноразова очистка board кешу для нової версії контексту AI.
  // Старі повідомлення містять «жодна задача не закрита» бо до фіксу AI отримував
  // контекст без сигналу про порожні дані. Чистимо щоб board згенерувалось наново
  // з оновленим getAIContext (core.js: явний сигнал коли habits/tasks=0).
  if (!localStorage.getItem('nm_board_clean_pji7l_done')) {
    [
      'nm_owl_board_unified', 'nm_owl_board_unified_ts',
      'nm_owl_board_migrated_v2',  // інакше _migrateOnce думає що міграція вже виконана і не перезаповнює
      'nm_owl_board', 'nm_owl_board_ts',
      'nm_owl_board_seen', 'nm_chip_payloads',
      'nm_owl_tab_ts_inbox', 'nm_owl_tab_ts_notes', 'nm_owl_tab_ts_me',
      'nm_owl_tab_ts_evening', 'nm_owl_tab_ts_finance', 'nm_owl_tab_ts_health',
      'nm_owl_tab_ts_projects', 'nm_owl_tab_ts_tasks',
    ].forEach(k => localStorage.removeItem(k));
    localStorage.setItem('nm_board_clean_pji7l_done', '1');
    console.log('[boot] PJi7l: cleared board cache + ts + migration flag for fresh AI generation');
  }
  // PJi7l 08.05 повторна міграція (v2): попередня очищала тільки unified, але AI-промпт
  // все одно генерував те саме бо контекст не мав явного сигналу. Зараз дамп ще раз —
  // AI перегенерує з оновленим _getInboxBoardContext (proactive.js: empty-state сигнали).
  if (!localStorage.getItem('nm_board_clean_pji7l_v2_done')) {
    [
      'nm_owl_board_unified', 'nm_owl_board_unified_ts',
      'nm_owl_board_migrated_v2',
      'nm_owl_board', 'nm_owl_board_ts',
      'nm_owl_tab_ts_inbox', 'nm_owl_tab_ts_notes', 'nm_owl_tab_ts_me',
      'nm_owl_tab_ts_evening', 'nm_owl_tab_ts_finance', 'nm_owl_tab_ts_health',
      'nm_owl_tab_ts_projects', 'nm_owl_tab_ts_tasks',
    ].forEach(k => localStorage.removeItem(k));
    localStorage.setItem('nm_board_clean_pji7l_v2_done', '1');
    console.log('[boot] PJi7l-v2: re-cleared board for fresh empty-state-aware generation');
  }
  // v8 (27.04.2026 xGe1H Pre-Migration Hardening Підсесія 1B): Task.id Date.now() → UUID.
  // Пілот UUID-міграції перед Supabase. Supabase primary key очікує UUID, не number.
  // Бекап nm_tasks у nm_tasks_backup_v7 — на випадок rollback. Перевіряє typeof
  // щоб не повторно мігрувати рядкові ID. Не чіпає steps[].id (окрема міграція v9+).
  if (!localStorage.getItem('nm_tasks_uuid_migrated_v8')) {
    try {
      const tasksRaw = localStorage.getItem('nm_tasks');
      if (tasksRaw) {
        // Бекап тільки nm_tasks (не весь localStorage — щоб не вилетіти у quota)
        localStorage.setItem('nm_tasks_backup_v7', tasksRaw);
        const tasks = JSON.parse(tasksRaw);
        if (Array.isArray(tasks)) {
          let migrated = 0;
          tasks.forEach(t => {
            if (typeof t.id === 'number') {
              t.legacy_id = t.id;
              t.id = generateUUID();
              migrated++;
            }
          });
          if (migrated > 0) {
            localStorage.setItem('nm_tasks', JSON.stringify(tasks));
            console.log(`[boot] v8 migration: ${migrated} tasks migrated to UUID`);
          }
        }
      }
      localStorage.setItem('nm_tasks_uuid_migrated_v8', '1');
    } catch (e) {
      console.error('[boot] v8 migration failed:', e);
      // Rollback з бекапу якщо щось зламалось
      const backup = localStorage.getItem('nm_tasks_backup_v7');
      if (backup) {
        try { localStorage.setItem('nm_tasks', backup); } catch(_) {}
      }
    }
  }

  // v9 Habits UUID (myshu 11.05.2026 Architecture Refactor Сесія 3B-1):
  // Habit.id був Date.now() (number). Cross-reference: nm_habit_log2 структура
  // {date: {habit.id: true}} — habit.id nested ключ. Міграція потребує:
  //   1) Backup nm_habits2 + nm_habit_log2 ДО зміни (через nm_backup_v* модуль)
  //   2) habits.forEach: id Date.now() → UUID, зберегти legacy_id
  //   3) Збудувати map old_id → new_id
  //   4) habit_log2: переписати ВСI nested ключі (date level → habit.id level)
  if (!localStorage.getItem('nm_habits_uuid_migrated_v9')) {
    try {
      const habitsRaw = localStorage.getItem('nm_habits2');
      const logRaw = localStorage.getItem('nm_habit_log2');
      if (habitsRaw) {
        // 1. Backup ДО будь-якої мутації (через nm_backup_v* модуль)
        const backupKey = createSelectiveBackup(['nm_habits2', 'nm_habit_log2'], 'pre-habit-uuid-v9');
        if (backupKey) console.log('[boot] v9 habits backup:', backupKey);

        const habits = JSON.parse(habitsRaw);
        if (Array.isArray(habits)) {
          // 2-3. Міграція + збір id-mapping
          const idMap = {}; // old_id (string|number) → new_id (UUID)
          let migrated = 0;
          habits.forEach(h => {
            if (h && typeof h.id === 'number') {
              const oldId = String(h.id);
              const newId = generateUUID();
              h.legacy_id = h.id;
              h.id = newId;
              idMap[oldId] = newId;
              migrated++;
            }
          });

          if (migrated > 0) {
            // 4. habit_log2 — переписуємо nested ключі
            // Структура: {date: {habitId: count|true}, ...}
            if (logRaw) {
              try {
                const log = JSON.parse(logRaw);
                if (log && typeof log === 'object') {
                  let logChanged = false;
                  Object.keys(log).forEach(dateKey => {
                    const dayMap = log[dateKey];
                    if (!dayMap || typeof dayMap !== 'object') return;
                    const newDayMap = {};
                    Object.keys(dayMap).forEach(habitIdKey => {
                      const newKey = idMap[habitIdKey] || habitIdKey;
                      newDayMap[newKey] = dayMap[habitIdKey];
                      if (newKey !== habitIdKey) logChanged = true;
                    });
                    log[dateKey] = newDayMap;
                  });
                  if (logChanged) {
                    localStorage.setItem('nm_habit_log2', JSON.stringify(log));
                  }
                }
              } catch (logErr) {
                console.error('[boot] v9 habit_log2 migration failed:', logErr);
              }
            }
            localStorage.setItem('nm_habits2', JSON.stringify(habits));
            console.log(`[boot] v9 migration: ${migrated} habits migrated to UUID, log keys updated`);
          }
        }
      }
      localStorage.setItem('nm_habits_uuid_migrated_v9', '1');
    } catch (e) {
      console.error('[boot] v9 habits migration failed:', e);
      // Не відновлюємо автоматично — користувач може запустити вручну з nm_backup_*
      // через DevTools якщо щось пішло не так.
    }
  }

  // v10 Events UUID (myshu 11.05.2026 Architecture Refactor Сесія 3B-2):
  // Event.id був Date.now(). Cross-reference: inbox.cards мають field
  // 'eventId' що вказує на event.id. Міграція:
  //   1) Backup nm_events + nm_inbox
  //   2) events.id → UUID, legacy_id
  //   3) Map old_id → new_id
  //   4) inbox: оновити eventId field за map (inbox.id ЛИШАЄТЬСЯ — окрема міграція)
  if (!localStorage.getItem('nm_events_uuid_migrated_v10')) {
    try {
      const eventsRaw = localStorage.getItem('nm_events');
      const inboxRaw = localStorage.getItem('nm_inbox');
      if (eventsRaw) {
        const backupKey = createSelectiveBackup(['nm_events', 'nm_inbox'], 'pre-event-uuid-v10');
        if (backupKey) console.log('[boot] v10 events backup:', backupKey);

        const events = JSON.parse(eventsRaw);
        if (Array.isArray(events)) {
          const idMap = {}; // old_id → new_uuid
          let migrated = 0;
          events.forEach(ev => {
            if (ev && typeof ev.id === 'number') {
              const oldId = String(ev.id);
              const newId = generateUUID();
              ev.legacy_id = ev.id;
              ev.id = newId;
              idMap[oldId] = newId;
              migrated++;
            }
          });

          if (migrated > 0) {
            // Cross-ref update: inbox.eventId за map
            if (inboxRaw) {
              try {
                const inbox = JSON.parse(inboxRaw);
                if (Array.isArray(inbox)) {
                  let updated = 0;
                  inbox.forEach(it => {
                    if (it && it.eventId != null) {
                      const k = String(it.eventId);
                      if (idMap[k]) {
                        it.eventId = idMap[k];
                        updated++;
                      }
                    }
                  });
                  if (updated > 0) {
                    localStorage.setItem('nm_inbox', JSON.stringify(inbox));
                    console.log(`[boot] v10 inbox.eventId updated: ${updated} refs`);
                  }
                }
              } catch (ibErr) {
                console.error('[boot] v10 inbox eventId update failed:', ibErr);
              }
            }
            localStorage.setItem('nm_events', JSON.stringify(events));
            console.log(`[boot] v10 migration: ${migrated} events migrated to UUID`);
          }
        }
      }
      localStorage.setItem('nm_events_uuid_migrated_v10', '1');
    } catch (e) {
      console.error('[boot] v10 events migration failed:', e);
    }
  }

  // v11 Notes UUID (myshu 11.05.2026 Architecture Refactor Сесія 3B-3):
  // Note.id був Date.now(). НЕМАЄ persistent cross-references (folder це
  // текст-поле, не FK). Простіша міграція ніж Events.
  if (!localStorage.getItem('nm_notes_uuid_migrated_v11')) {
    try {
      const notesRaw = localStorage.getItem('nm_notes');
      if (notesRaw) {
        const backupKey = createSelectiveBackup(['nm_notes'], 'pre-note-uuid-v11');
        if (backupKey) console.log('[boot] v11 notes backup:', backupKey);

        const notes = JSON.parse(notesRaw);
        if (Array.isArray(notes)) {
          let migrated = 0;
          notes.forEach(n => {
            if (n && typeof n.id === 'number') {
              n.legacy_id = n.id;
              n.id = generateUUID();
              migrated++;
            }
          });
          if (migrated > 0) {
            localStorage.setItem('nm_notes', JSON.stringify(notes));
            console.log(`[boot] v11 migration: ${migrated} notes migrated to UUID`);
          }
        }
      }
      localStorage.setItem('nm_notes_uuid_migrated_v11', '1');
    } catch (e) {
      console.error('[boot] v11 notes migration failed:', e);
    }
  }

  // v12 Moments UUID (myshu 11.05.2026 Architecture Refactor Сесія 3B-4):
  // Moment.id був Date.now(). НЕМАЄ persistent cross-references.
  if (!localStorage.getItem('nm_moments_uuid_migrated_v12')) {
    try {
      const momentsRaw = localStorage.getItem('nm_moments');
      if (momentsRaw) {
        const backupKey = createSelectiveBackup(['nm_moments'], 'pre-moment-uuid-v12');
        if (backupKey) console.log('[boot] v12 moments backup:', backupKey);
        const moments = JSON.parse(momentsRaw);
        if (Array.isArray(moments)) {
          let migrated = 0;
          moments.forEach(m => {
            if (m && typeof m.id === 'number') {
              m.legacy_id = m.id;
              m.id = generateUUID();
              migrated++;
            }
          });
          if (migrated > 0) {
            localStorage.setItem('nm_moments', JSON.stringify(moments));
            console.log(`[boot] v12 migration: ${migrated} moments → UUID`);
          }
        }
      }
      localStorage.setItem('nm_moments_uuid_migrated_v12', '1');
    } catch (e) {
      console.error('[boot] v12 moments migration failed:', e);
    }
  }

  // v13 Finance txns UUID (myshu 11.05.2026 Architecture Refactor Сесія 3B-5):
  // Transaction.id був Date.now(). НЕМАЄ persistent cross-references
  // (inbox.id finance-card паралельна, без FK).
  if (!localStorage.getItem('nm_finance_uuid_migrated_v13')) {
    try {
      const finRaw = localStorage.getItem('nm_finance');
      if (finRaw) {
        const backupKey = createSelectiveBackup(['nm_finance'], 'pre-finance-uuid-v13');
        if (backupKey) console.log('[boot] v13 finance backup:', backupKey);
        const txs = JSON.parse(finRaw);
        if (Array.isArray(txs)) {
          let migrated = 0;
          txs.forEach(t => {
            if (t && typeof t.id === 'number') {
              t.legacy_id = t.id;
              t.id = generateUUID();
              migrated++;
            }
          });
          if (migrated > 0) {
            localStorage.setItem('nm_finance', JSON.stringify(txs));
            console.log(`[boot] v13 migration: ${migrated} transactions → UUID`);
          }
        }
      }
      localStorage.setItem('nm_finance_uuid_migrated_v13', '1');
    } catch (e) {
      console.error('[boot] v13 finance migration failed:', e);
    }
  }

  // v14 Projects UUID (myshu 11.05.2026 Architecture Refactor Сесія 3B-6):
  // Project.id був Date.now(). Nested steps/decisions/metrics/resources/risks
  // мають власні id — теж Date.now() з deduplication. ТIЛЬКИ top-level
  // project.id мігруємо. Sub-entities — окремо у майбутньому коли стане
  // блокером для Supabase (зараз не блокер).
  if (!localStorage.getItem('nm_projects_uuid_migrated_v14')) {
    try {
      const projRaw = localStorage.getItem('nm_projects');
      if (projRaw) {
        const backupKey = createSelectiveBackup(['nm_projects'], 'pre-project-uuid-v14');
        if (backupKey) console.log('[boot] v14 projects backup:', backupKey);
        const projects = JSON.parse(projRaw);
        if (Array.isArray(projects)) {
          let migrated = 0;
          projects.forEach(p => {
            if (p && typeof p.id === 'number') {
              p.legacy_id = p.id;
              p.id = generateUUID();
              migrated++;
            }
          });
          if (migrated > 0) {
            localStorage.setItem('nm_projects', JSON.stringify(projects));
            console.log(`[boot] v14 migration: ${migrated} projects → UUID`);
          }
        }
      }
      localStorage.setItem('nm_projects_uuid_migrated_v14', '1');
    } catch (e) {
      console.error('[boot] v14 projects migration failed:', e);
    }
  }

  // v15 Inbox cards UUID (myshu 11.05.2026 Architecture Refactor Сесія 3B-7):
  // InboxItem.id був Date.now(). FK cross-refs (eventId, reminderId) уже
  // мігровано у v10 і Сесії 3A. Тепер тільки top-level inbox.id.
  if (!localStorage.getItem('nm_inbox_uuid_migrated_v15')) {
    try {
      const inboxRaw = localStorage.getItem('nm_inbox');
      if (inboxRaw) {
        const backupKey = createSelectiveBackup(['nm_inbox'], 'pre-inbox-uuid-v15');
        if (backupKey) console.log('[boot] v15 inbox backup:', backupKey);
        const items = JSON.parse(inboxRaw);
        if (Array.isArray(items)) {
          let migrated = 0;
          items.forEach(it => {
            if (it && typeof it.id === 'number') {
              it.legacy_id = it.id;
              it.id = generateUUID();
              migrated++;
            }
          });
          if (migrated > 0) {
            localStorage.setItem('nm_inbox', JSON.stringify(items));
            console.log(`[boot] v15 migration: ${migrated} inbox cards → UUID`);
          }
        }
      }
      localStorage.setItem('nm_inbox_uuid_migrated_v15', '1');
    } catch (e) {
      console.error('[boot] v15 inbox migration failed:', e);
    }
  }

  // v16 Health UUID (db0YY 12.05.2026 Architecture Refactor Сесія 3B-8 — фінал UUID-блоку):
  //   - nm_health_cards[].id (top-level) + nested medications[].id
  //   - nm_allergies[].id (top-level, окреме сховище)
  //   - Cross-ref FORWARD: card.nextAppointment.eventId → nm_events[].id
  //       ETAP 1: events.find(e => e.legacy_id === oldId) — старі картки до v10
  //       ETAP 2: events.find(e => e.id === oldId) — нові події після v10 з
  //              Date.now() (Клас 2 баг myshu, тут мігруємо event + cross-ref)
  //   - Cross-ref REVERSE: nm_events[].sourceCardId (число → UUID) через cardIdMap
  //   - Cross-ref TASKS: nm_tasks[].sourceMedId (число → UUID) через medIdMap
  if (!localStorage.getItem('nm_health_uuid_migrated_v16')) {
    try {
      const cardsRaw = localStorage.getItem('nm_health_cards');
      const allergiesRaw = localStorage.getItem('nm_allergies');
      const eventsRaw = localStorage.getItem('nm_events');
      const tasksRaw = localStorage.getItem('nm_tasks');
      if (cardsRaw || allergiesRaw) {
        const backupKey = createSelectiveBackup(
          ['nm_health_cards', 'nm_allergies', 'nm_events', 'nm_tasks'],
          'pre-health-uuid-v16'
        );
        if (backupKey) console.log('[boot] v16 health backup:', backupKey);

        // Зведений medIdMap (oldNumeric → newUUID) для всіх медикаментів
        // у всіх картках. Потрібен для nm_tasks[].sourceMedId оновлення.
        const cardIdMap = {};
        const medIdMap = {};
        let events = null;
        if (eventsRaw) { try { events = JSON.parse(eventsRaw); } catch { events = null; } }

        // --- 1. Cards (top-level) + nested medications ---
        if (cardsRaw) {
          const cards = JSON.parse(cardsRaw);
          if (Array.isArray(cards)) {
            let migratedCards = 0;
            let migratedMeds = 0;
            cards.forEach(card => {
              if (card && typeof card.id === 'number') {
                const oldId = String(card.id);
                const newId = generateUUID();
                card.legacy_id = card.id;
                card.id = newId;
                cardIdMap[oldId] = newId;
                migratedCards++;
              }
              if (Array.isArray(card.medications)) {
                card.medications.forEach(med => {
                  if (med && typeof med.id === 'number') {
                    const oldMedId = String(med.id);
                    const newMedId = generateUUID();
                    med.legacy_id = med.id;
                    med.id = newMedId;
                    medIdMap[oldMedId] = newMedId;
                    migratedMeds++;
                  }
                });
              }
            });

            // --- 2. FORWARD cross-ref: card.nextAppointment.eventId → event UUID ---
            if (Array.isArray(events)) {
              let crossEtap1 = 0, crossEtap2 = 0, crossOrphan = 0;
              cards.forEach(card => {
                const appt = card.nextAppointment;
                if (!appt || typeof appt.eventId !== 'number') return;
                const oldEventId = appt.eventId;
                const legacyStr = String(oldEventId);
                // ETAP 1: подія була мігрована у v10 (має legacy_id)
                const byLegacy = events.find(e => e.legacy_id != null && String(e.legacy_id) === legacyStr);
                if (byLegacy) {
                  appt.eventId = byLegacy.id;
                  crossEtap1++;
                  return;
                }
                // ETAP 2: подія створена ПIСЛЯ v10 з Date.now() (Клас 2 myshu)
                // — досі число у nm_events. Мігруємо її ТУТ + оновлюємо cross-ref.
                const byCurrentId = events.find(e => e.id === oldEventId);
                if (byCurrentId) {
                  const newEventId = generateUUID();
                  byCurrentId.legacy_id = byCurrentId.id;
                  byCurrentId.id = newEventId;
                  appt.eventId = newEventId;
                  crossEtap2++;
                  return;
                }
                // Orphan — подія видалена з Календаря, лишаємо як є
                crossOrphan++;
              });
              if (crossEtap1 + crossEtap2 + crossOrphan > 0) {
                console.log(`[boot] v16 cross-ref forward: ${crossEtap1} via legacy + ${crossEtap2} new-migrated + ${crossOrphan} orphans`);
              }
            }

            // --- 3. REVERSE cross-ref: nm_events[].sourceCardId → UUID ---
            if (Array.isArray(events)) {
              let reverseUpdated = 0;
              events.forEach(ev => {
                if (ev && typeof ev.sourceCardId === 'number') {
                  const oldStr = String(ev.sourceCardId);
                  if (cardIdMap[oldStr]) {
                    ev.sourceCardId = cardIdMap[oldStr];
                    reverseUpdated++;
                  }
                }
              });
              if (reverseUpdated > 0) {
                console.log(`[boot] v16 cross-ref reverse: ${reverseUpdated} event.sourceCardId updated`);
              }
              // Зберегти events (могли змінитись через ETAP 2 + sourceCardId)
              localStorage.setItem('nm_events', JSON.stringify(events));
            }

            localStorage.setItem('nm_health_cards', JSON.stringify(cards));
            console.log(`[boot] v16 migration: ${migratedCards} cards, ${migratedMeds} medications → UUID`);
          }
        }

        // --- 4. Tasks cross-ref: sourceMedId число → UUID ---
        if (tasksRaw && Object.keys(medIdMap).length > 0) {
          try {
            const tasks = JSON.parse(tasksRaw);
            if (Array.isArray(tasks)) {
              let tasksUpdated = 0;
              tasks.forEach(task => {
                if (task && typeof task.sourceMedId === 'number') {
                  const oldStr = String(task.sourceMedId);
                  if (medIdMap[oldStr]) {
                    task.sourceMedId = medIdMap[oldStr];
                    tasksUpdated++;
                  }
                }
              });
              if (tasksUpdated > 0) {
                localStorage.setItem('nm_tasks', JSON.stringify(tasks));
                console.log(`[boot] v16 tasks cross-ref: ${tasksUpdated} task.sourceMedId updated`);
              }
            }
          } catch (taskErr) {
            console.error('[boot] v16 tasks cross-ref failed:', taskErr);
          }
        }

        // --- 5. Allergies (top-level, окреме сховище) ---
        if (allergiesRaw) {
          const allergies = JSON.parse(allergiesRaw);
          if (Array.isArray(allergies)) {
            let migratedAllergies = 0;
            allergies.forEach(a => {
              if (a && typeof a.id === 'number') {
                a.legacy_id = a.id;
                a.id = generateUUID();
                migratedAllergies++;
              }
            });
            if (migratedAllergies > 0) {
              localStorage.setItem('nm_allergies', JSON.stringify(allergies));
              console.log(`[boot] v16 migration: ${migratedAllergies} allergies → UUID`);
            }
          }
        }
      }
      localStorage.setItem('nm_health_uuid_migrated_v16', '1');
    } catch (e) {
      console.error('[boot] v16 health migration failed:', e);
    }
  }

  // v17 Sub-entity steps UUID (db0YY 12.05.2026 Architecture Refactor — фінал UUID-блоку,
  // sub-entity рівень):
  //   - nm_tasks[].steps[].id — Date.now() / Date.now()+Math.random() → UUID
  //   - nm_projects[].steps[].id — те саме
  // Без cross-ref — step.id ніде не зберігається як FK (sourceMedId був на med,
  // не на step). Закриває останній мікс типів — старі задачі/проекти зі step.id
  // числами + нові з UUID → handler-и через String() обгортки уже безпечні,
  // але краще мати чистий UUID-формат.
  if (!localStorage.getItem('nm_steps_uuid_migrated_v17')) {
    try {
      const tasksRaw = localStorage.getItem('nm_tasks');
      const projectsRaw = localStorage.getItem('nm_projects');
      if (tasksRaw || projectsRaw) {
        const backupKey = createSelectiveBackup(
          ['nm_tasks', 'nm_projects'],
          'pre-steps-uuid-v17'
        );
        if (backupKey) console.log('[boot] v17 steps backup:', backupKey);

        // --- 1. Tasks steps ---
        if (tasksRaw) {
          const tasks = JSON.parse(tasksRaw);
          if (Array.isArray(tasks)) {
            let migratedSteps = 0;
            tasks.forEach(task => {
              if (Array.isArray(task.steps)) {
                task.steps.forEach(step => {
                  if (step && typeof step.id === 'number') {
                    step.legacy_id = step.id;
                    step.id = generateUUID();
                    migratedSteps++;
                  }
                });
              }
            });
            if (migratedSteps > 0) {
              localStorage.setItem('nm_tasks', JSON.stringify(tasks));
              console.log(`[boot] v17 migration: ${migratedSteps} task.steps → UUID`);
            }
          }
        }

        // --- 2. Projects steps ---
        if (projectsRaw) {
          const projects = JSON.parse(projectsRaw);
          if (Array.isArray(projects)) {
            let migratedProjSteps = 0;
            projects.forEach(project => {
              if (Array.isArray(project.steps)) {
                project.steps.forEach(step => {
                  if (step && typeof step.id === 'number') {
                    step.legacy_id = step.id;
                    step.id = generateUUID();
                    migratedProjSteps++;
                  }
                });
              }
            });
            if (migratedProjSteps > 0) {
              localStorage.setItem('nm_projects', JSON.stringify(projects));
              console.log(`[boot] v17 migration: ${migratedProjSteps} project.steps → UUID`);
            }
          }
        }
      }
      localStorage.setItem('nm_steps_uuid_migrated_v17', '1');
    } catch (e) {
      console.error('[boot] v17 steps migration failed:', e);
    }
  }

  // v18 (JMQuT 17.05.2026 EU AI Act compliance — Health AI isolation):
  // Видаляє ключі чату Health (nm_chat_health + nm_health_interview_pending)
  // + видаляє факти з nm_facts де category='health' (PHI у AI-памʼяті).
  // UI-дані (nm_health_cards / nm_allergies) НЕ чіпаємо — юзер сам редагує.
  if (!localStorage.getItem('nm_health_ai_isolation_v18')) {
    try {
      let cleaned = 0;
      if (localStorage.getItem('nm_chat_health') !== null) {
        localStorage.removeItem('nm_chat_health'); cleaned++;
      }
      if (localStorage.getItem('nm_health_interview_pending') !== null) {
        localStorage.removeItem('nm_health_interview_pending'); cleaned++;
      }
      // Видалити health-факти з nm_facts
      const factsRaw = localStorage.getItem('nm_facts');
      if (factsRaw) {
        const facts = JSON.parse(factsRaw);
        if (Array.isArray(facts)) {
          const filtered = facts.filter(f => f && f.category !== 'health');
          if (filtered.length < facts.length) {
            localStorage.setItem('nm_facts', JSON.stringify(filtered));
            cleaned += (facts.length - filtered.length);
          }
        }
      }
      // Council JMQuT post-audit fix: видалити старі health tool_calls з історії всіх чатів.
      // Інакше AI бачить їх як приклади у промпті і може намагатись повторити (хоч guard блокує).
      const HEALTH_TOOL_NAMES = new Set([
        'create_health_card','edit_health_card','delete_health_card','update_health_card_status',
        'add_medication','edit_medication','delete_medication','log_medication_dose',
        'add_allergy','delete_allergy','add_health_history_entry','export_health_card'
      ]);
      const CHAT_KEYS_TO_FILTER = ['nm_chat_inbox','nm_chat_tasks','nm_chat_notes','nm_chat_me',
                                  'nm_chat_evening','nm_chat_finance','nm_chat_projects','nm_owl_chat'];
      for (const k of CHAT_KEYS_TO_FILTER) {
        const raw = localStorage.getItem(k);
        if (!raw) continue;
        try {
          const msgs = JSON.parse(raw);
          if (!Array.isArray(msgs)) continue;
          const filtered = msgs.filter(m => {
            if (!m) return false;
            // Видалити tool-result повідомлення з health tools
            if (m.role === 'tool' && m.name && HEALTH_TOOL_NAMES.has(m.name)) return false;
            // Видалити assistant tool_calls з health
            if (Array.isArray(m.tool_calls) && m.tool_calls.some(tc => HEALTH_TOOL_NAMES.has(tc?.function?.name))) {
              return false;
            }
            return true;
          });
          if (filtered.length < msgs.length) {
            localStorage.setItem(k, JSON.stringify(filtered));
            cleaned += (msgs.length - filtered.length);
          }
        } catch {}
      }
      localStorage.setItem('nm_health_ai_isolation_v18', '1');
      if (cleaned > 0) console.log(`[boot] v18 EU AI Act: видалено ${cleaned} health-AI ключів/фактів/tool_calls`);
    } catch (e) {
      console.error('[boot] v18 health AI isolation failed:', e);
    }
  }

  // v9 (03.05.2026 MIeXK Health AI-інтерв'ю): шкала статусів 3 → 6 значень.
  // Старе: active/controlled/done. Нове: acute/treatment/improving/remission/chronic/done.
  // Мапінг: active → treatment (нейтральне «активне лікування»), controlled → remission,
  // done → done. Інтерв'ю після створення картки уточнить точний статус.
  if (!localStorage.getItem('nm_health_status_v2_done')) {
    try {
      const raw = localStorage.getItem('nm_health_cards');
      if (raw) {
        const cards = JSON.parse(raw);
        if (Array.isArray(cards)) {
          const map = { active: 'treatment', controlled: 'remission', done: 'done' };
          let migrated = 0;
          cards.forEach(c => {
            if (map[c.status]) { c.status = map[c.status]; migrated++; }
          });
          if (migrated > 0) {
            localStorage.setItem('nm_health_cards', JSON.stringify(cards));
            console.log(`[boot] v9 migration: ${migrated} health cards migrated to 6-status scale`);
          }
        }
      }
      localStorage.setItem('nm_health_status_v2_done', '1');
    } catch (e) { console.error('[boot] v9 migration failed:', e); }
  }
  // v10 (04.05.2026 RGisY Шар 6 chip-system): chip.id (UUID) + payload externalization +
  // legacy ✔️-чіпи з action='chat' → action='complete'.
  // Бекап per-key (не один великий ключ — quota-safe для iPhone). Транзакційно.
  if (!localStorage.getItem('nm_chips_v10_done')) {
    try {
      const CHAT_KEYS = ['nm_chat_inbox','nm_chat_tasks','nm_chat_notes','nm_chat_me',
                         'nm_chat_evening','nm_chat_finance','nm_chat_health','nm_chat_projects'];
      let backupOk = true;
      CHAT_KEYS.forEach(k => {
        const raw = localStorage.getItem(k);
        if (raw) {
          try { localStorage.setItem(k + '_backup_v10', raw); }
          catch (e) { backupOk = false; }
        }
      });

      const payloadsMap = JSON.parse(localStorage.getItem('nm_chip_payloads') || '{}');
      let chipsTouched = 0, payloadsExtracted = 0, completionsRewired = 0;

      CHAT_KEYS.forEach(k => {
        const raw = localStorage.getItem(k);
        if (!raw) return;
        let msgs;
        try { msgs = JSON.parse(raw); } catch { return; }
        if (!Array.isArray(msgs)) return;
        let dirty = false;
        msgs.forEach(m => {
          if (!Array.isArray(m.chips) || m.chips.length === 0) return;
          m.chips.forEach(c => {
            if (typeof c !== 'object' || !c) return;
            if (!c.id) { c.id = generateUUID(); dirty = true; chipsTouched++; }
            if (c.payload && typeof c.payload === 'object') {
              payloadsMap[c.id] = c.payload;
              c.payloadId = c.id;
              delete c.payload;
              payloadsExtracted++;
              dirty = true;
            }
            if (c.action === 'chat' && typeof c.label === 'string' && c.label.includes('✔️')) {
              c.action = 'complete';
              completionsRewired++;
              dirty = true;
            }
          });
        });
        if (dirty) {
          try { localStorage.setItem(k, JSON.stringify(msgs)); }
          catch (e) { console.warn('[boot] v10: ' + k + ' write failed', e); }
        }
      });

      try { localStorage.setItem('nm_chip_payloads', JSON.stringify(payloadsMap)); }
      catch (e) { console.error('[boot] v10: nm_chip_payloads write failed', e); }

      localStorage.setItem('nm_chips_v10_done', '1');
      localStorage.setItem('nm_chips_v10_done_ts', String(Date.now()));
      console.log(`[boot] v10 migration: chips=${chipsTouched}, payloads=${payloadsExtracted}, completions=${completionsRewired}, backupOk=${backupOk}`);
    } catch (e) {
      console.error('[boot] v10 migration failed:', e);
      // Rollback з per-key бекапів
      ['nm_chat_inbox','nm_chat_tasks','nm_chat_notes','nm_chat_me',
       'nm_chat_evening','nm_chat_finance','nm_chat_health','nm_chat_projects'].forEach(k => {
        const b = localStorage.getItem(k + '_backup_v10');
        if (b) { try { localStorage.setItem(k, b); } catch {} }
      });
    }
  }
  // Phase 9 Шар 6 (RGisY 04.05) — Регресія 3 fix: cleanup v10 backups після 7 днів.
  // Раніше бекапи nm_chat_<tab>_backup_v10 жили вічно (8 ключів × ~5-200KB) →
  // QuotaExceededError на iPhone (lesson UvEHE 03.05 повторювався з v7). Тепер:
  // якщо v10 завершено успішно >7 днів тому — видаляємо бекапи разом з timestamp.
  const v10Done = localStorage.getItem('nm_chips_v10_done');
  let v10DoneTs = +(localStorage.getItem('nm_chips_v10_done_ts') || 0);
  // Phase 9 fallback: legacy юзери що мігрували між Phase 7 (f713667) і
  // Phase 9 (0e280ff) мають v10_done='1' БЕЗ ts. Запускаємо 7-денний таймер
  // зараз — інакше backup-ключі лишились би вічно для цього subset.
  if (v10Done === '1' && v10DoneTs === 0) {
    v10DoneTs = Date.now();
    try { localStorage.setItem('nm_chips_v10_done_ts', String(v10DoneTs)); } catch {}
  }
  if (v10Done === '1' && v10DoneTs > 0 && (Date.now() - v10DoneTs) > 7 * 24 * 60 * 60 * 1000) {
    try {
      ['nm_chat_inbox','nm_chat_tasks','nm_chat_notes','nm_chat_me',
       'nm_chat_evening','nm_chat_finance','nm_chat_health','nm_chat_projects'].forEach(k => {
        localStorage.removeItem(k + '_backup_v10');
      });
      localStorage.removeItem('nm_chips_v10_done_ts'); // одноразовий cleanup
      console.log('[boot] v10 backups cleanup: 8 ключів видалено (>7 днів старі)');
    } catch (e) { console.warn('[boot] v10 backups cleanup failed', e); }
  }
}
