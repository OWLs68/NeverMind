// ============================================================
// owl/clarify-guard.js — Soft safety net проти AI-галюцинацій типу
// "Відкрив автомийку → create_project з невірною назвою + create_event".
//
// Принцип: перш ніж виконати tool_calls від AI у будь-якому з 8 чатів —
// перевіряємо текст юзера. Якщо це "минулий час + іменник без суми/дати"
// АБО "голий іменник без дієслова і числа" — НЕ виконуємо tool, замість
// показуємо inline-чіпи "Як нотатку / Як момент / Не зберігати". Клік
// чіпа виконує save_note або save_moment локально через диспетчер,
// без round-trip до AI.
//
// Локальна реалізація 4.29 Repair Loop (ROADMAP After Supabase) — поки
// без серверного навчання. Pattern Tracking + Apply — окрема сесія.
// ============================================================

import { t } from '../core/utils.js';
import { dispatchChatToolCalls } from '../ai/tool-dispatcher.js';
import { generateUUID } from '../core/uuid.js';
import { decideClarify } from '../data/clarify-decision.js';

// PAST_VERBS_RE ВИДАЛЕНО v3pexs (мертвий \b-кирилиця; AI-промпт сам класифікує
// «зробив X»; оживлення = тертя проти принципу). DOCTOR chips REMOVED (EU AI Act
// JMQuT 17.05). ЛОГIКА РIШЕННЯ (bareNoun/стоп-лист/команди/suspicious) винесена у
// `src/data/clarify-decision.js` (v3pexs 28.06) — pure, node-тест
// check-clarify-decision.js. Тут лишилась ПРЕЗЕНТАЦIЯ: i18n-питання + чіпи + UUID.

// Перевіряє чи треба показати clarify-чіпи замість виконання tool_calls.
// Повертає null (виконуй як є) або {question, chips} (показати чіпи).
export function shouldClarify(text, toolCalls, tab) {
  const decision = decideClarify(text, toolCalls);
  if (!decision) return null;
  const trimmed = decision.bareNoun;

  // Будуємо чіпи. payload містить tool name + args для локального виконання.
  const question = t('clarify.where_save_noun', '"{text}" — куди це записати?', { text: trimmed });

  // Контекстний 4-й чіп "Створити проект" (rC4TO 04.05) — якщо текст
  // містить бізнес-іменник. Capitalizуємо матч як стартову назву проекту.
  const projectChip = decision.businessNoun ? [{
    label: t('clarify.chip.project', 'Створити проект'),
    action: 'clarify_save',
    target: 'create_project',
    payload: {
      name: decision.businessNoun.charAt(0).toUpperCase() + decision.businessNoun.slice(1).toLowerCase(),
      subtitle: '',
    },
  }] : [];

  const chips = [
    ...projectChip,
    {
      label: t('clarify.chip.note', 'У щоденник'),
      action: 'clarify_save',
      target: 'save_note',
      payload: { text: trimmed, folder: 'Особисте' },
    },
    {
      label: t('clarify.chip.moment', 'Як момент'),
      action: 'clarify_save',
      target: 'save_moment',
      payload: { text: trimmed },
    },
    {
      label: t('clarify.chip.skip', 'Не зберігати'),
      action: 'clarify_save',
      target: 'none',
      payload: {},
    },
  ];

  // Phase 3 Шар 6 (04.05): додаємо стабільний UUID одразу при генерації.
  // Без цього normalizeChips генерує новий UUID при кожному рендері → DOM-id
  // нестабільний між reload, tracking analytics ламається.
  return { question, chips: chips.map(c => ({ ...c, id: generateUUID() })) };
}

// _buildDoctorChips REMOVED (EU AI Act compliance JMQuT 17.05.2026) —
// функція читала nm_health_cards для побудови doctor profile chips → profiling видалено.

// Локальне виконання вибору юзера — без round-trip до AI.
// Викликається з handleChipClick коли action === 'clarify_save'.
export function applyClarifyChoice(target, payload, tab, addMsg) {
  if (target === 'none' || !target) {
    addMsg('agent', t('clarify.skipped', 'Не зберігаю.'));
    return true;
  }

  const fakeToolCall = {
    function: {
      name: target,
      arguments: JSON.stringify(payload || {}),
    },
  };
  const ok = dispatchChatToolCalls([fakeToolCall], addMsg, payload?.text || '');
  if (!ok) {
    addMsg('agent', t('clarify.failed', 'Не вдалося зберегти.'));
  }
  return ok;
}
