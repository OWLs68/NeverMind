// ============================================================
// ai/tool-dispatcher.js — ЄДИНИЙ мозок для tool_calls у всіх 8 чатах
// Створено 20.04.2026 (сесія Gg3Fy) у рамках "Один мозок V2" Шар 1.
// ============================================================
//
// Принцип "Один мозок": коли AI повертає tool_calls у будь-якому чаті
// (Inbox/Tasks/Notes/Me/Evening/Health/Finance/Projects), цей модуль
// маршрутизує їх однаково. Юзер отримує однакові можливості скрізь.
//
// API:
//   dispatchChatToolCalls(toolCalls, addMsg, originalText) → boolean
//     UI tool  → handleUITool (ai/ui-tools.js)
//     Health   → прямі хендлери нижче (викликають функції з tabs/health.js)
//     Memory   → addFact (ai/memory.js)
//     Finance category CRUD → функції з tabs/finance-cats.js
//     Інші CRUD → processUniversalAction (tabs/habits.js)
//
// НЕ обробляємо тут:
//   - clarify (відкриває модалку — Inbox-specific)
//   - create_project (Inbox-specific interview flow)
//   - restore_deleted (Inbox-specific UI вивід)
//   Ці tools залишаються у inbox.js:sendToAI.
// ============================================================

import { UI_TOOL_NAMES, handleUITool } from './ui-tools.js';
import { addFact } from './memory.js';
import { applyAllGuards } from '../data/dispatcher-guards.js';
import { generateUUID } from '../core/uuid.js';
import {
  createHealthCardProgrammatic,
  editHealthCardProgrammatic,
  deleteHealthCardProgrammatic,
  updateHealthCardStatusProgrammatic,
  startHealthInterview,
  addMedicationToCard,
  editMedicationInCard,
  logMedicationDose,
  addAllergy,
  deleteAllergy,
  addHealthHistoryEntry,
  renderHealth,
  getHealthCards,
  HEALTH_STATUS_DEFS,
} from '../tabs/health.js';
import { processUniversalAction } from '../tabs/habits.js';
import { currentTab, switchTab } from '../core/nav.js';
import {
  createFinCategory,
  updateFinCategory,
  deleteFinCategory,
  mergeFinCategories,
  addFinSubcategory,
  findFinCatByName,
} from '../tabs/finance-cats.js';
import {
  getFinance,
  saveFinance,
  getFinBudget,
  saveFinBudget,
  renderFinance,
  formatMoney,
} from '../tabs/finance.js';
import { addToTrash } from '../core/trash.js';
import { getTrash, restoreFromTrash } from '../core/trash.js';
import { getProjects, saveProjects, renderProjects, createProjectProgrammatic, startProjectInboxInterview } from '../tabs/projects.js';
// G3 myshu 11.05 — Universal Undo. Helpers переїхали у action-log.js (single source).
import {
  readLastReversible, markReversed,
  captureSnapshotBefore, capturePostResultId, logAction,
} from '../data/action-log.js';
import { reversible } from '../data/action-reversers.js';
import { executeReverse } from '../data/action-undo.js';

// ===== _toolCallToUniversalAction — мапа tool → action =====
// Перенесено у src/core/action-mapper.js (Сесія 4-mini, db0YY 12.05.2026) як
// pure-модуль для майбутньої Сесії 4 execute-action.js. Тут лишається re-export
// під старим ім'ям для backwards-compat (habits.js коментар + потенційні
// зовнішні імпорти). Strangler — прибрати при cleanup.
import { toolCallToAction as _toolCallToUniversalAction } from '../core/action-mapper.js';
export { _toolCallToUniversalAction };

// ===== Health handlers =====
// Приймає tool_call name + args, повертає true якщо обробив (і викликав addMsg).
function _handleHealthTool(name, args, addMsg) {
  switch (name) {
    case 'create_health_card': {
      if (!args.name) { addMsg('agent', 'Потрібна назва картки.'); return true; }
      const created = createHealthCardProgrammatic({
        name: args.name,
        subtitle: args.subtitle,
        doctor: args.doctor,
        doctorRecommendations: args.doctor_recommendations,
        doctorConclusion: args.doctor_conclusion,
        startDate: args.start_date,
        nextAppointment: args.next_appointment_date
          ? { date: args.next_appointment_date, time: args.next_appointment_time || '' }
          : null,
        status: args.status,
        initialHistoryEntry: args.initial_history_text,
      });
      if (created) {
        if (currentTab === 'health') renderHealth();
        if (currentTab === 'health') {
          // Юзер уже у Здоров'ї — інтерв'ю одразу у Health-чаті, без redirect-повідомлення
          addMsg('agent', `🏥 Створив картку "${created.name}".`);
        } else {
          // Юзер у іншому чаті — повідомлення-вказівник + інтерв'ю чекає у Health-чаті
          addMsg('agent', `🏥 Створив картку "${created.name}" у Здоровʼї. Пройди коротке опитування там — 3 чіпи виставлять точний статус.`);
        }
        // db0YY: action-log запис для universal undo. Реверс — delete_health_card.
        logAction('create_health_card', args, created.id, null, 'dispatcher');
        setTimeout(() => { try { startHealthInterview(created); } catch(e) {} }, 300);
      } else {
        addMsg('agent', 'Не вдалось створити картку — потрібна назва.');
      }
      return true;
    }
    case 'edit_health_card': {
      const updates = {};
      if (args.name !== undefined) updates.name = args.name;
      if (args.subtitle !== undefined) updates.subtitle = args.subtitle;
      if (args.doctor !== undefined) updates.doctor = args.doctor;
      if (args.doctor_recommendations !== undefined) updates.doctorRecommendations = args.doctor_recommendations;
      if (args.doctor_conclusion !== undefined) updates.doctorConclusion = args.doctor_conclusion;
      if (args.start_date !== undefined) updates.startDate = args.start_date;
      if (args.status !== undefined) updates.status = args.status;
      if (args.next_appointment_date !== undefined) {
        updates.nextAppointment = args.next_appointment_date
          ? { date: args.next_appointment_date, time: args.next_appointment_time || '' }
          : null;
      }
      const updated = editHealthCardProgrammatic(args.card_id, updates);
      if (updated) {
        if (currentTab === 'health') renderHealth();
        addMsg('agent', `✓ Оновив картку "${updated.name}". ${args.comment || ''}`.trim());
      } else {
        addMsg('agent', 'Не знайшов картку для оновлення.');
      }
      return true;
    }
    case 'delete_health_card': {
      const ok = deleteHealthCardProgrammatic(args.card_id);
      if (ok) {
        if (currentTab === 'health') renderHealth();
        addMsg('agent', `🗑️ Картку видалено (7 днів у кошику). ${args.comment || ''}`.trim());
      } else {
        addMsg('agent', 'Не знайшов картку для видалення.');
      }
      return true;
    }
    case 'update_health_card_status': {
      const updated = updateHealthCardStatusProgrammatic(args.card_id, args.status);
      if (updated) {
        if (currentTab === 'health') renderHealth();
        const def = HEALTH_STATUS_DEFS[args.status] || {};
        addMsg('agent', `✓ Статус "${updated.name}": ${def.icon || ''} ${def.label || args.status}. ${args.comment || ''}`.trim());
      } else {
        addMsg('agent', 'Не знайшов картку або невірний статус.');
      }
      return true;
    }
    case 'add_medication': {
      if (!args.card_id || !args.med_name) { addMsg('agent', 'Потрібні картка і назва препарату.'); return true; }
      const med = addMedicationToCard(args.card_id, {
        name: args.med_name,
        dosage: args.dosage,
        schedule: args.schedule,
        courseDuration: args.course_duration,
      });
      if (med) {
        if (currentTab === 'health') renderHealth();
        addMsg('agent', `💊 Додав "${args.med_name}" до картки. ${args.comment || ''}`.trim());
      } else {
        addMsg('agent', 'Не знайшов картку для препарату.');
      }
      return true;
    }
    case 'edit_medication': {
      const updates = {};
      if (args.med_name !== undefined) updates.name = args.med_name;
      if (args.dosage !== undefined) updates.dosage = args.dosage;
      if (args.schedule !== undefined) updates.schedule = args.schedule;
      if (args.course_duration !== undefined) updates.courseDuration = args.course_duration;
      const ok = editMedicationInCard(args.card_id, args.med_id, updates);
      if (ok) {
        if (currentTab === 'health') renderHealth();
        addMsg('agent', `✓ Оновив препарат. ${args.comment || ''}`.trim());
      } else {
        addMsg('agent', 'Не знайшов препарат для оновлення.');
      }
      return true;
    }
    case 'log_medication_dose': {
      const med = logMedicationDose(args.card_id, args.med_name);
      if (med) {
        if (currentTab === 'health') renderHealth();
        addMsg('agent', `✓ Позначив дозу "${med.name}". ${args.comment || ''}`.trim());
      } else {
        addMsg('agent', 'Не знайшов препарат для відмітки.');
      }
      return true;
    }
    case 'add_allergy': {
      if (!args.name) { addMsg('agent', 'Потрібна назва алергену.'); return true; }
      const added = addAllergy(args.name, args.notes || '');
      if (added) {
        if (currentTab === 'health') renderHealth();
        addMsg('agent', `🚨 Додав алергію: ${args.name}. ${args.comment || ''}`.trim());
        // db0YY: action-log для universal undo. Реверс — delete_allergy.
        logAction('add_allergy', args, added.id, null, 'dispatcher');
      } else {
        addMsg('agent', `Алергія "${args.name}" вже у списку.`);
      }
      return true;
    }
    case 'delete_allergy': {
      const ok = deleteAllergy(args.allergy_id);
      if (currentTab === 'health') renderHealth();
      addMsg('agent', ok ? '🗑️ Алергію видалено.' : 'Не знайшов алергію для видалення.');
      return true;
    }
    case 'add_health_history_entry': {
      if (!args.text) { addMsg('agent', 'Потрібен текст запису.'); return true; }
      // Fallback на загальну "Здоровʼя" якщо card_id відсутній або невалідний.
      // Виправлено 21.04 Gg3Fy: Роман не хоче "10 нових папок" — все разове у одну картку.
      // NpBmN audit fix #8: розрізняємо два кейси —
      //   (a) card_id не передано → AI/юзер хоче загальний журнал → тихий fallback
      //   (b) card_id передано АЛЕ картки нема (юзер видалив поки тримав чіп) → попередимо юзера
      let targetCardId = args.card_id;
      let cards = getHealthCards();
      const requestedSpecific = targetCardId != null;
      const cardExists = requestedSpecific && cards.some(c => c.id === targetCardId);
      const isStale = requestedSpecific && !cardExists;
      if (!targetCardId || !cardExists) {
        const general = cards.find(c => c.name === 'Здоровʼя' || c.name === 'Здоровя' || c.name === "Здоров'я");
        if (general) {
          targetCardId = general.id;
        } else {
          const created = createHealthCardProgrammatic({
            name: 'Здоровʼя',
            subtitle: 'Загальний журнал',
          });
          if (created) targetCardId = created.id;
        }
      }
      const entry = addHealthHistoryEntry(targetCardId, args.entry_type || 'manual', args.text);
      if (entry) {
        // Дубль у Нотатки — НЕ автоматично. Сова вирішує сама через окремий save_note
        // коли запис значущий (тривалий симптом, діагноз, важлива зміна). Разові дрібниці
        // → тільки картка, щоб не перетворювати Нотатки на архів кожного чиха.
        if (currentTab === 'health') renderHealth();
        cards = getHealthCards();
        const card = cards.find(c => c.id === targetCardId);
        const cardName = card ? card.name : 'Здоровʼя';
        const prefix = isStale
          ? `⚠️ Картку видалено — записав у "${cardName}":`
          : `📝 Записав у картку "${cardName}":`;
        addMsg('agent', `${prefix} ${args.text}`);
      } else {
        addMsg('agent', 'Не вдалось зберегти запис.');
      }
      return true;
    }
    default:
      return false;
  }
}

// ===== Memory / Finance-category handlers =====
function _handleMemoryOrFinCatTool(name, args, addMsg) {
  switch (name) {
    case 'save_memory_fact': {
      const text = args.fact || args.text;
      if (!text) { addMsg('agent', 'Не зрозумів що запам\'ятати.'); return true; }
      try {
        addFact({ text, category: args.category, ttlDays: args.ttl_days });
        addMsg('agent', 'Запам\'ятав ✓');
      } catch (e) {
        console.warn('[tool-dispatcher save_memory_fact]', e);
        addMsg('agent', 'Не вдалось запам\'ятати.');
      }
      return true;
    }
    case 'create_finance_category': {
      if (!args.name) { addMsg('agent', 'Потрібна назва категорії.'); return true; }
      const type = args.type === 'income' ? 'income' : 'expense';
      const created = createFinCategory(type, {
        name: args.name,
        icon: args.icon,
        color: args.color,
        subcategories: Array.isArray(args.subcategories) ? args.subcategories : [],
      });
      addMsg('agent', `✓ Створив категорію "${created.name}". ${args.comment || ''}`.trim());
      return true;
    }
    case 'edit_finance_category': {
      const cat = findFinCatByName(args.current_name);
      if (!cat) { addMsg('agent', `Не знайшов категорію "${args.current_name}".`); return true; }
      const updates = {};
      if (args.new_name !== undefined) updates.name = args.new_name;
      if (args.icon !== undefined) updates.icon = args.icon;
      if (args.color !== undefined) updates.color = args.color;
      if (args.subcategories !== undefined) updates.subcategories = args.subcategories;
      if (args.archived !== undefined) updates.archived = args.archived;
      updateFinCategory(cat.id, updates);
      addMsg('agent', `✓ Оновив категорію "${updates.name || cat.name}". ${args.comment || ''}`.trim());
      return true;
    }
    case 'delete_finance_category': {
      const cat = findFinCatByName(args.name);
      if (!cat) { addMsg('agent', `Не знайшов категорію "${args.name}".`); return true; }
      deleteFinCategory(cat.id);
      addMsg('agent', `🗑️ Видалив категорію "${cat.name}". ${args.comment || ''}`.trim());
      return true;
    }
    case 'merge_finance_categories': {
      const from = findFinCatByName(args.from_name);
      const to = findFinCatByName(args.to_name);
      if (!from || !to) {
        addMsg('agent', `Не знайшов категорії для обʼєднання (${args.from_name} → ${args.to_name}).`);
        return true;
      }
      mergeFinCategories(from.id, to.id);
      addMsg('agent', `✓ Обʼєднав "${from.name}" у "${to.name}". ${args.comment || ''}`.trim());
      return true;
    }
    case 'add_finance_subcategory': {
      const cat = findFinCatByName(args.category_name);
      if (!cat) { addMsg('agent', `Не знайшов категорію "${args.category_name}".`); return true; }
      addFinSubcategory(cat.id, args.subcategory);
      addMsg('agent', `✓ Додав підкатегорію "${args.subcategory}" у "${cat.name}". ${args.comment || ''}`.trim());
      return true;
    }
    case 'delete_transaction': {
      const txs = getFinance();
      const item = txs.find(t => t.id === args.id);
      if (!item) { addMsg('agent', 'Не знайшов операцію для видалення.'); return true; }
      try { addToTrash('finance', item); } catch(e) {}
      saveFinance(txs.filter(t => t.id !== args.id));
      if (currentTab === 'finance') renderFinance();
      addMsg('agent', `🗑️ Видалив: ${item.category} ${formatMoney(item.amount)}.`);
      return true;
    }
    case 'set_finance_budget': {
      const bdg = getFinBudget();
      if (args.total !== undefined) bdg.total = args.total;
      if (args.categories) {
        if (!bdg.categories) bdg.categories = {};
        Object.assign(bdg.categories, args.categories);
      }
      saveFinBudget(bdg);
      if (currentTab === 'finance') renderFinance();
      const parts = [];
      if (args.total !== undefined) parts.push(`загальний ${formatMoney(args.total)}`);
      if (args.categories) parts.push(Object.entries(args.categories).map(([k, v]) => `${k} ${formatMoney(v)}`).join(', '));
      addMsg('agent', `✓ Бюджет оновлено: ${parts.join('; ')}.`);
      return true;
    }
    default:
      return false;
  }
}

// ===== Project-specific handlers =====
// Кроки, рішення, метрики, ресурси, темп, ризики — деталі проекту.
function _handleProjectTool(name, args, addMsg) {
  if (!['complete_project_step', 'add_project_step', 'update_project_progress',
        'add_project_decision', 'add_project_metric', 'add_project_resource',
        'update_project_tempo', 'update_project_risks'].includes(name)) return false;

  const projs = getProjects();
  const p = projs.find(x => x.id === args.project_id);
  if (!p) { addMsg('agent', 'Не знайшов проект.'); return true; }

  switch (name) {
    case 'complete_project_step': {
      const step = (p.steps || []).find(s => String(s.id) === String(args.step_id));
      if (!step) { addMsg('agent', 'Не знайшов крок.'); return true; }
      step.done = true;
      step.doneAt = Date.now();
      p.progress = Math.round((p.steps.filter(s => s.done).length / p.steps.length) * 100);
      p.lastActivity = Date.now();
      break;
    }
    case 'add_project_step': {
      if (!args.step) { addMsg('agent', 'Потрібен текст кроку.'); return true; }
      if (!p.steps) p.steps = [];
      p.steps.push({ id: generateUUID(), text: args.step, done: false });
      p.lastActivity = Date.now();
      break;
    }
    case 'update_project_progress': {
      p.progress = Math.min(100, Math.max(0, args.progress || 0));
      p.lastActivity = Date.now();
      break;
    }
    case 'add_project_decision': {
      if (!p.decisions) p.decisions = [];
      p.decisions.unshift({ title: args.title, reason: args.reason || '' });
      break;
    }
    case 'add_project_metric': {
      if (!p.metrics) p.metrics = [];
      p.metrics.push({ label: args.label, value: args.value, color: args.color || '#3d2e1e' });
      break;
    }
    case 'add_project_resource': {
      if (!p.resources) p.resources = [];
      p.resources.push({ type: args.type, title: args.title, url: args.url || '' });
      break;
    }
    case 'update_project_tempo': {
      if (args.tempoNow !== undefined) p.tempoNow = args.tempoNow;
      if (args.tempoMore !== undefined) p.tempoMore = args.tempoMore;
      if (args.tempoIdeal !== undefined) p.tempoIdeal = args.tempoIdeal;
      break;
    }
    case 'update_project_risks': {
      p.risks = args.risks || '';
      break;
    }
  }
  saveProjects(projs);
  if (currentTab === 'projects') renderProjects();

  const labels = {
    complete_project_step: `✅ Крок виконано. Прогрес: ${p.progress}%`,
    add_project_step: `✓ Додав крок: "${args.step}"`,
    update_project_progress: `✓ Прогрес оновлено: ${p.progress}%`,
    add_project_decision: `✓ Рішення записано: "${args.title}"`,
    add_project_metric: `✓ Метрика "${args.label}: ${args.value}" додана`,
    add_project_resource: `✓ Ресурс "${args.title}" додано`,
    update_project_tempo: '✓ Темп оновлено',
    update_project_risks: '✓ Ризики записано',
  };
  addMsg('agent', labels[name] + (args.comment ? ` · ${args.comment}` : ''));
  return true;
}

// ===== dispatchChatToolCalls — головний маршрутизатор =====
export function dispatchChatToolCalls(toolCalls, addMsg, originalText) {
  if (!Array.isArray(toolCalls) || toolCalls.length === 0) return false;
  // dyhJu 10.05 G4: pure-function guards (PAST_INDICATORS, момент-keyword,
  // dedupe save_finance+save_task, dedupe complete+save_task, dedupe
  // save_moment+create_event, B-166 convertNoteToFinance). Раніше ці guards
  // жили inline у inbox.js — тут diff лікує розрив «один мозок» для 7
  // tab-чатів (tasks/notes/me/health/finance-chat/projects/clarify).
  toolCalls = applyAllGuards(toolCalls, originalText);
  if (toolCalls.length === 0) return false;
  let any = false;
  for (const tc of toolCalls) {
    let args = {};
    try { args = JSON.parse(tc.function.arguments || '{}'); } catch(e) {}
    const name = tc.function.name;

    // V3 Фаза 1: _reasoning_log — обов'язкове поле для zero-shot CoT (chain-of-thought).
    // Модель пише думки ПЕРЕД параметрами — токени-роздуми покращують вибір tool.
    // Dispatcher НЕ передає це поле у handler (службове). Логуємо для діагностики.
    if (args._reasoning_log) {
      try {
        const log = JSON.parse(localStorage.getItem('nm_reasoning_log') || '[]');
        log.unshift({ ts: Date.now(), tool: name, reasoning: String(args._reasoning_log).slice(0, 400) });
        localStorage.setItem('nm_reasoning_log', JSON.stringify(log.slice(0, 50)));
      } catch {}
      delete args._reasoning_log;
    }

    // 1. UI tools — навігація/фільтри/налаштування
    if (UI_TOOL_NAMES.has(name)) {
      const res = handleUITool(name, args);
      if (res && res.text) addMsg('agent', res.text);
      any = true;
      continue;
    }

    // 2. Health CRUD — прямі хендлери
    if (_handleHealthTool(name, args, addMsg)) { any = true; continue; }

    // 3. Memory / Finance categories — прямі хендлери
    if (_handleMemoryOrFinCatTool(name, args, addMsg)) { any = true; continue; }

    // 4. Project-specific CRUD (кроки, рішення, метрики, ресурси, темп, ризики)
    if (_handleProjectTool(name, args, addMsg)) { any = true; continue; }

    // 4.4. show_monthly_summary (QDIGl 04.05) — універсальний для всіх 8 чатів
    // (Один мозок). 2 режими:
    //   А. Без month → bypass dayOfMonth>4 і показуємо стандартний звіт
    //      попереднього місяця з кешу. override=null.
    //   Б. З month=YYYY-MM → AI вже згенерував oneliner на основі контексту,
    //      зберігаємо як override JSON. Через годину auto-expire → стандарт.
    if (name === 'show_monthly_summary') {
      const override = args.month ? {
        month: args.month,
        monthLabel: args.month_label || args.month,
        oneliner: args.oneliner || '',
      } : null;
      import('../tabs/me.js').then(m => {
        if (m.showMonthlyReportTemporarily) m.showMonthlyReportTemporarily(60 * 60 * 1000, override);
        switchTab('me');
        setTimeout(() => { try { m.renderMe?.(); } catch(e) {} }, 200);
      }).catch(e => console.warn('[dispatcher] show_monthly_summary load failed', e));
      addMsg('agent', args.comment || '📆 Підсумок місяця у вкладці «Я» (зникне через годину).');
      any = true;
      continue;
    }

    // 4.4.5. restore_deleted (G3 myshu 11.05) — universal undo з БУДЬ-ЯКОГО чату.
    // Раніше handler жив тільки у inbox.js → у Tasks/Notes/Me/etc. dispatcher
    // викликав silent fallback "⚠️ Не зміг виконати". Тепер працює у всіх 7
    // tab-чатах через dispatcher (один мозок). Inbox має свою копію бо
    // використовує addInboxChatMsg з UI-чіпами для disambig (query!='last').
    if (name === 'restore_deleted') {
      const q = (args.query || '').trim();
      const typeFilter = args.type || null;
      if (q === 'last') {
        // myshu 11.05 v2: action-log ЗАВЖДИ має пріоритет коли є reversible запис.
        // Раніше: брали новіше з action-log або trash → trash з нещодавно видаленої
        // події перемагав timestamp save_routine → юзер казав «Відміни», бот
        // ВIДНОВЛЮВАВ видалене замість скасовувати останню дію. Тепер чітко:
        // «Відміни» = скасуй останню AI-дію. Trash — fallback тільки коли log порожній.
        const lastAction = typeFilter ? null : readLastReversible();
        if (lastAction) {
          const ok = executeReverse(lastAction.reverse, processUniversalAction);
          if (ok) {
            markReversed(lastAction.id);
            addMsg('agent', `✅ Відмінив: ${lastAction.summary}`);
          } else {
            addMsg('agent', `⚠️ Не зміг відмінити "${lastAction.summary}" — запис, можливо, вже змінений.`);
          }
        } else {
          // Fallback: action-log порожній → беремо з trash (відновлення видаленого).
          const trash = getTrash().filter(t => Date.now() - t.deletedAt < 7 * 24 * 60 * 60 * 1000);
          const filtered = typeFilter ? trash.filter(t => t.type === typeFilter) : trash;
          const lastTrash = filtered.sort((a, b) => b.deletedAt - a.deletedAt)[0];
          if (lastTrash) {
            const itemLabel = lastTrash.item.text || lastTrash.item.title || lastTrash.item.name || lastTrash.item.folder || 'запис';
            restoreFromTrash(lastTrash.deletedAt);
            addMsg('agent', `✅ Відновив "${itemLabel}"`);
          } else {
            addMsg('agent', 'Нічого скасовувати — журнал і кошик порожні.');
          }
        }
      } else {
        // 'all' або keyword-пошук — у не-Inbox чатах перенаправляємо у Inbox
        // (бо там UI-чіпи для disambig). KISS: підтримуємо тільки 'last' тут.
        addMsg('agent', 'Для відновлення за пошуком — напиши у Inbox.');
      }
      any = true;
      continue;
    }

    // 4.5. create_project — раніше тільки Inbox (rC4TO 04.05): тепер з будь-якого
    // чату. Без цього у Finance/Notes/etc. dispatcher silent skip → typing висне.
    if (name === 'create_project') {
      const projectName = args.name || originalText || 'Без назви';
      const newProject = createProjectProgrammatic(projectName, args.subtitle || '');
      addMsg('agent', `✅ Проект "${newProject.name}" створено`);
      // Якщо юзер не у Inbox — переходимо туди, щоб interview-flow з AI запустився у Inbox-чаті.
      if (currentTab !== 'inbox') {
        setTimeout(() => { try { switchTab('inbox'); } catch(e) {} }, 400);
      }
      setTimeout(() => { try { startProjectInboxInterview(newProject.name, newProject.subtitle); } catch(e) {} }, 700);
      any = true;
      continue;
    }

    // 5. Решта CRUD через universal action.
    // G3 myshu 11.05: ДО виклику handler — захоплюємо snapshot для деструктивних
    // tools (save_routine). ПIСЛЯ успіху — пишемо action log з reverse instr.
    // Для post-hoc capture ID нових сутностей (save_task → id у tasks[0])
    // використовується storage-read у capturePostResultId (Phase 1D).
    const snapshotBefore = captureSnapshotBefore(name, args);
    const acts = _toolCallToUniversalAction(name, args);
    let universalHandled = false;
    for (const a of acts) {
      if (processUniversalAction(a, originalText, addMsg)) { any = true; universalHandled = true; }
    }
    if (universalHandled) {
      // G3 myshu 11.05: action-log запис. 2 шляхи:
      //   - snapshot-based (save_routine): reverse = restore_snapshot
      //   - ID-based (save_task/save_finance/save_habit/create_event): reverse =
      //     tool_call delete_X(id). ID капчимо з storage[0] або storage[len-1].
      //   - set_reminder: reverse через text fuzzy (без ID)
      if (snapshotBefore != null) {
        logAction(name, args, null, snapshotBefore, 'dispatcher');
      } else if (reversible(name)) {
        const resultId = capturePostResultId(name);
        logAction(name, args, resultId, null, 'dispatcher');
      }
    }

    // 6. SILENT FALLBACK GUARD (rC4TO 04.05) — якщо tool НЕ оброблений жодним з шарів,
    // typing-індикатор у chat-handler'ах висне вічно (бо прибирається при наступному addMsg).
    // Той самий патерн що з chips silent failure (8a05ada). Завжди вставляти повідомлення.
    if (acts.length === 0 || !universalHandled) {
      console.warn('[tool-dispatcher] Unknown tool — silent failure prevented:', name, args);
      addMsg('agent', `⚠️ Не зміг виконати "${name}". Спробуй переформулювати або в Inbox.`);
      any = true;
    }
  }
  return any;
}
