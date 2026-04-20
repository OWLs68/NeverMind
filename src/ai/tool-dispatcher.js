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
import {
  createHealthCardProgrammatic,
  editHealthCardProgrammatic,
  deleteHealthCardProgrammatic,
  addMedicationToCard,
  editMedicationInCard,
  logMedicationDose,
  addAllergy,
  deleteAllergy,
  addHealthHistoryEntry,
  renderHealth,
  getHealthCards,
} from '../tabs/health.js';
import { processUniversalAction } from '../tabs/habits.js';
import { currentTab } from '../core/nav.js';
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

// ===== _toolCallToUniversalAction — мапа tool → action =====
// Покриває CRUD tools які обробляються через processUniversalAction.
// Health/memory/finance-cat — обробляються окремо у dispatchChatToolCalls.
export function _toolCallToUniversalAction(name, args) {
  switch (name) {
    case 'save_task':
      return [{ action: 'create_task', title: args.title, desc: args.text, steps: args.steps || [], dueDate: args.due_date, priority: args.priority }];
    case 'save_note':
      return [{ action: 'create_note', text: args.text, folder: args.folder }];
    case 'save_habit':
      return [{ action: 'create_habit', name: args.name, details: args.details, days: args.days, target_count: args.target_count }];
    case 'save_moment':
      return [{ action: 'add_moment', text: args.text, mood: args.mood }];
    case 'create_event':
      return [{ action: 'create_event', title: args.title, date: args.date, time: args.time || null, priority: args.priority || 'normal' }];
    case 'save_finance':
      return [{ action: 'save_finance', fin_type: args.fin_type, amount: args.amount, category: args.category, fin_comment: args.fin_comment, date: args.date }];
    case 'complete_task': {
      const ids = Array.isArray(args.task_ids) ? args.task_ids : [];
      return ids.map(id => ({ action: 'complete_task', task_id: id }));
    }
    case 'complete_habit': {
      const ids = Array.isArray(args.habit_ids) ? args.habit_ids : [];
      return ids.map(id => ({ action: 'complete_habit', habit_id: id }));
    }
    case 'edit_task':
      return [{ action: 'edit_task', task_id: args.task_id, title: args.title, dueDate: args.due_date, priority: args.priority }];
    case 'edit_habit':
      return [{ action: 'edit_habit', habit_id: args.habit_id, name: args.name, days: args.days, details: args.details }];
    case 'edit_event':
      return [{ action: 'edit_event', event_id: args.event_id, title: args.title, date: args.date, time: args.time, priority: args.priority }];
    case 'edit_note':
      return [{ action: 'edit_note', note_id: args.note_id, text: args.text, folder: args.folder }];
    case 'delete_task':
      return [{ action: 'delete_task', task_id: args.task_id }];
    case 'delete_habit':
      return [{ action: 'delete_habit', habit_id: args.habit_id }];
    case 'delete_event':
      return [{ action: 'delete_event', event_id: args.event_id }];
    case 'delete_folder':
      return [{ action: 'delete_folder', folder: args.folder }];
    case 'reopen_task':
      return [{ action: 'reopen_task', task_id: args.task_id }];
    case 'add_step': {
      const steps = Array.isArray(args.steps) ? args.steps : [];
      return steps.map(s => ({ action: 'add_step', task_id: args.task_id, step: s }));
    }
    case 'move_note':
      return [{ action: 'move_note', query: args.query, folder: args.folder }];
    case 'set_reminder':
      return [{ action: 'set_reminder', time: args.time, text: args.text, date: args.date }];
    case 'save_routine':
      return [{ action: 'save_routine', day: args.day, blocks: args.blocks }];
    default:
      return [];
  }
}

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
        addMsg('agent', `🏥 Створив картку "${created.name}". ${args.comment || ''}`.trim());
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
      if (!args.card_id || !args.text) { addMsg('agent', 'Потрібна картка і текст запису.'); return true; }
      const entry = addHealthHistoryEntry(args.card_id, args.entry_type || 'manual', args.text);
      if (entry) {
        if (currentTab === 'health') renderHealth();
        const cards = getHealthCards();
        const card = cards.find(c => c.id === args.card_id);
        addMsg('agent', `📝 Записав у картку "${card ? card.name : '—'}": ${args.text}`);
      } else {
        addMsg('agent', 'Не знайшов картку для запису.');
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

// ===== dispatchChatToolCalls — головний маршрутизатор =====
export function dispatchChatToolCalls(toolCalls, addMsg, originalText) {
  if (!Array.isArray(toolCalls) || toolCalls.length === 0) return false;
  let any = false;
  for (const tc of toolCalls) {
    let args = {};
    try { args = JSON.parse(tc.function.arguments || '{}'); } catch(e) {}
    const name = tc.function.name;

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

    // 4. Решта CRUD через universal action
    const acts = _toolCallToUniversalAction(name, args);
    for (const a of acts) {
      if (processUniversalAction(a, originalText, addMsg)) any = true;
    }
  }
  return any;
}
