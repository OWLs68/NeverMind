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

// PAST_VERBS_RE ВИДАЛЕНО v3pexs. Мав /\b(дієслова)\b/ — МЕРТВИЙ з народження
// (JS \b не знає кирилиці), тож гілка «минулий час → clarify» НIКОЛИ не діяла.
// Системне рішення (не оживляти): (1) AI-промпт decision-tree давно сам
// класифікує «зробив X» → save_moment/complete; (2) оживити = додати тертя на
// найчастіший тип фрази проти принципу «мінімальне тертя». Видалення = 0 зміни
// поведінки (було мертве) + чесний код. Жива гілка bareNoun (нижче) лишається.

// Голий іменник: 2-30 літер кирилиці без цифр, без розділових знаків крім дефіса/апострофа.
// Приклади: "Хімчистка", "Олег", "Автомийка". НЕ ловить: "Хімчистка 2026", "Купити", "що робити".
const BARE_NOUN_RE = /^[А-ЯҐЄІЇа-яґєії'’\-]{2,30}$/;

// Бізнес-іменники — для чіпа "Створити проект" (rC4TO 04.05). Якщо текст
// містить один з них (минулий час "відкрив автомийку" АБО голий іменник
// "хімчистка") — додаємо 4-й чіп ПЕРЕД стандартним набором [Щоденник/Момент/Не зберігати].
const BUSINESS_NOUN_RE = /(автомий\w*|салон\w*|сайт\w*|магазин\w*|студі\w*|курс\w*|школ\w*|кав['’]ярн\w*|майстерн\w*|бар|ресторан\w*|клуб\w*|спортзал\w*|атель\w*|пекарн\w*|хімчистк\w*|агентств\w*|компані\w*|стартап\w*|бізнес\w*|проект\w*)/i;

// DOCTOR_MENTION_RE + Шар 2 Dynamic chips REMOVED (EU AI Act compliance JMQuT 17.05.2026).
// Раніше при згадці лікаря AI пропонував чіпи з реальних імен лікарів з nm_health_cards
// для add_health_history_entry. Це profiling — AI читав health-картки → видаляємо.
// Тепер «був у дерматолога» → стандартний clarify flow (Щоденник / Момент / Не зберігати).

// Явна команда — пропускаємо guard, AI правий.
// (куп(и|ити)\b → куп(и|ити): хвостовий \b був мертвий (кирилиця), прибрано — підрядок як решта.)
const COMMAND_RE = /(створи|додай|запиши|нагада|постав|зроби|куп(и|ити)|зателефонуй|видали|перенеси|зміни|поміняй|онови)/i;

// Сума з валютою → save_finance, не наша справа.
const HAS_NUMBER_RE = /\d/;

// Tools які guard ловить — створення нової сутності з потенційно неправильним типом.
// NpBmN audit fix #5: додано save_finance + set_reminder, бо AI на «був у
// дерматолога» може видати save_finance як creative hallucination → guard
// мав пропустити. Перевіряємо ВСЕ масив tool_calls (не тільки first), бо
// AI часто видає batch [save_finance, save_note] коли невпевнений.
const SUSPICIOUS_TOOLS = new Set([
  'create_project',
  'create_event',
  'save_task',
  'save_moment',
  'save_note',
  'save_finance',
  'set_reminder',
  'complete_task',
  // add_health_history_entry + create_health_card REMOVED (EU AI Act JMQuT 17.05.2026).
]);

// Перевіряє чи треба показати clarify-чіпи замість виконання tool_calls.
// Повертає null (виконуй як є) або {question, chips} (показати чіпи).
export function shouldClarify(text, toolCalls, tab) {
  if (!Array.isArray(toolCalls) || toolCalls.length === 0) return null;
  if (!text || typeof text !== 'string') return null;
  const trimmed = text.trim();
  if (trimmed.length === 0) return null;

  // Перевіряємо ВСІ tool_calls — якщо хоч один SUSPICIOUS і немає явних
  // індикаторів (число/команда), guard має право втрутитись.
  const hasSuspicious = toolCalls.some(tc => SUSPICIOUS_TOOLS.has(tc?.function?.name));
  if (!hasSuspicious) return null;

  // Явна команда → AI вирішує
  if (COMMAND_RE.test(trimmed)) return null;

  // Наявне число (сума/дата) → AI вирішує (save_finance, create_event)
  if (HAS_NUMBER_RE.test(trimmed)) return null;

  // Шар 2 Dynamic chips для лікарів REMOVED (EU AI Act compliance JMQuT 17.05.2026).

  // Голий іменник (одне слово, неоднозначне «Хімчистка»/«Олег») → уточнюємо.
  // (Гілку «минулий час» видалено — див. PAST_VERBS_RE коментар вище.)
  const isBareNoun = BARE_NOUN_RE.test(trimmed);

  if (!isBareNoun) return null;

  // Будуємо чіпи. payload містить tool name + args для локального виконання.
  const question = t('clarify.where_save_noun', '"{text}" — куди це записати?', { text: trimmed });

  // Контекстний 4-й чіп "Створити проект" (rC4TO 04.05) — якщо текст
  // містить бізнес-іменник. Capitalizуємо матч як стартову назву проекту.
  const businessMatch = trimmed.match(BUSINESS_NOUN_RE);
  const projectChip = businessMatch ? [{
    label: t('clarify.chip.project', 'Створити проект'),
    action: 'clarify_save',
    target: 'create_project',
    payload: {
      name: businessMatch[1].charAt(0).toUpperCase() + businessMatch[1].slice(1).toLowerCase(),
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
