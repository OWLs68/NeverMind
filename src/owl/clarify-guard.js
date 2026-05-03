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

// 20 типових українських дієслів минулого часу + ший/жив/ела/ала закінчення.
// Не лінгвістично-точний морфологічний аналізатор — список покриває ~90%.
// Якщо пропустить нове дієслово — fallback на промпт-інструкцію (вже є).
const PAST_VERBS_RE = /\b(відкрив|купив|зробив|написав|зателефонував|з[’']їв|сходив|помив|поправ|виправ|запустив|створив|закінчив|почав|поставив|віддав|отримав|продав|замовив|скачав|встановив|подивився|прочитав|випив|забув|знайшов|вивчив|відремонтував|посадив|зустрів|приготував|зварив|спік|закрив|відкупив|оновив|вилікував)\b/i;

// Голий іменник: 2-30 літер кирилиці без цифр, без розділових знаків крім дефіса/апострофа.
// Приклади: "Хімчистка", "Олег", "Автомийка". НЕ ловить: "Хімчистка 2026", "Купити", "що робити".
const BARE_NOUN_RE = /^[А-ЯҐЄІЇа-яґєії'’\- ]{2,30}$/;

// Бізнес-іменники — для чіпа "Створити проект" (rC4TO 04.05). Якщо текст
// містить один з них (минулий час "відкрив автомийку" АБО голий іменник
// "хімчистка") — додаємо 4-й чіп ПЕРЕД стандартним набором [Щоденник/Момент/Не зберігати].
const BUSINESS_NOUN_RE = /(автомий\w*|салон\w*|сайт\w*|магазин\w*|студі\w*|курс\w*|школ\w*|кав['’]ярн\w*|майстерн\w*|бар|ресторан\w*|клуб\w*|спортзал\w*|атель\w*|пекарн\w*|хімчистк\w*|агентств\w*|компані\w*|стартап\w*|бізнес\w*|проект\w*)/i;

// Явна команда — пропускаємо guard, AI правий.
const COMMAND_RE = /(створи|додай|запиши|нагада|постав|зроби|купи|зателефонуй|видали|перенеси|зміни|поміняй|онови)/i;

// Сума з валютою → save_finance, не наша справа.
const HAS_NUMBER_RE = /\d/;

// Tools які guard ловить — створення нової сутності з потенційно неправильним типом.
const SUSPICIOUS_TOOLS = new Set([
  'create_project',
  'create_event',
  'save_task',
  'save_moment',
  'save_note',
]);

// Перевіряє чи треба показати clarify-чіпи замість виконання tool_calls.
// Повертає null (виконуй як є) або {question, chips} (показати чіпи).
export function shouldClarify(text, toolCalls, tab) {
  if (!Array.isArray(toolCalls) || toolCalls.length === 0) return null;
  if (!text || typeof text !== 'string') return null;
  const trimmed = text.trim();
  if (trimmed.length === 0) return null;

  const firstName = toolCalls[0]?.function?.name;
  if (!SUSPICIOUS_TOOLS.has(firstName)) return null;

  // Явна команда → AI вирішує
  if (COMMAND_RE.test(trimmed)) return null;

  // Наявне число (сума/дата) → AI вирішує (save_finance, create_event)
  if (HAS_NUMBER_RE.test(trimmed)) return null;

  // Минулий час + 2+ слова АБО голий іменник
  const isPastTense = PAST_VERBS_RE.test(trimmed);
  const isBareNoun = BARE_NOUN_RE.test(trimmed) && !PAST_VERBS_RE.test(trimmed);

  if (!isPastTense && !isBareNoun) return null;

  // Будуємо чіпи. payload містить tool name + args для локального виконання.
  const question = isBareNoun
    ? t('clarify.where_save_noun', '"{text}" — куди це записати?', { text: trimmed })
    : t('clarify.where_save_past', '"{text}" — куди це записати?', { text: trimmed });

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

  return { question, chips };
}

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
