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
import { getFocusedHealthCard } from '../tabs/health.js';

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

// Лікарські згадки — Шар 2 Dynamic chips (NpBmN 04.05). Якщо текст містить
// згадку медспеціаліста або візит до лікарні — підтягуємо реальних лікарів з
// nm_health_cards.doctor + 1 «Інший лікар» замість стандартного [Щоденник/Момент/Не зберігати].
// Покриваємо ~15 спеціальностей + загальні терміни.
const DOCTOR_MENTION_RE = /(лікар\w*|стомат\w*|дантист\w*|дерматолог\w*|кардіолог\w*|терапевт\w*|хірург\w*|невролог\w*|невропатолог\w*|окуліст\w*|офтальмолог\w*|гінеколог\w*|уролог\w*|ортопед\w*|ендокринолог\w*|психіатр\w*|психотерапевт\w*|педіатр\w*|алерголог\w*|онколог\w*|гастроентеролог\w*|лор|клінік\w*|лікарн\w*|поліклінік\w*|медцентр\w*|шпиталь\w*)/i;

// Явна команда — пропускаємо guard, AI правий.
const COMMAND_RE = /(створи|додай|запиши|нагада|постав|зроби|купи|зателефонуй|видали|перенеси|зміни|поміняй|онови)/i;

// Сума з валютою → save_finance, не наша справа.
const HAS_NUMBER_RE = /\d/;

// Tools які guard ловить — створення нової сутності з потенційно неправильним типом.
// NpBmN audit fix #5: додано set_reminder як creative hallucination ризик
// («був у дерматолога» → set_reminder без слова «нагадай»). Перевіряємо
// ВЕСЬ масив tool_calls (не тільки first), бо AI часто видає batch
// [save_X, save_note] коли невпевнений.
// NpBmN audit fix #H: save_finance НЕ додаємо — усі legitimate save_finance
// мають число → HAS_NUMBER завжди cuts → у SUSPICIOUS це мертвий патерн.
const SUSPICIOUS_TOOLS = new Set([
  'create_project',
  'create_event',
  'save_task',
  'save_moment',
  'save_note',
  'add_health_history_entry',
  'create_health_card',
  'set_reminder',
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

  // NpBmN audit fix #A: якщо ми у Health-чаті І є FOCUSED картка з непорожнім
  // doctor — пропускаємо guard. Юзер уже у конкретному контексті, AI робить
  // add_health_history_entry безпосередньо у фокусовану картку (промпт-блок 244).
  if (tab === 'health') {
    try {
      const focusedId = getFocusedHealthCard();
      if (focusedId) {
        const cards = JSON.parse(localStorage.getItem('nm_health_cards') || '[]');
        const focused = cards.find(c => c.id === focusedId);
        if (focused && (focused.doctor || '').trim()) return null;
      }
    } catch (e) { /* fallthrough */ }
  }

  // NpBmN audit fix #D: DOCTOR_MENTION_RE check ПЕРЕД HAS_NUMBER — інакше
  // «зустрів терапевта 200» (адреса/час/будь-яка цифра) cut'ило doctor chips.
  // Лікар-контекст завжди важливіший за число у тексті.
  if (DOCTOR_MENTION_RE.test(trimmed)) {
    const doctorChips = _buildDoctorChips(trimmed);
    if (doctorChips) return doctorChips;
    // Якщо лікарів у картках нема — провалюємось у стандартний flow нижче.
  }

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

// Шар 2: збирає чіпи з реальних лікарів у картках Здоров'я. Читає
// localStorage напряму щоб уникнути circular import (health.js → clarify-guard.js).
// Повертає {question, chips} або null якщо немає жодного непорожнього doctor.
function _buildDoctorChips(text) {
  let cards = [];
  try { cards = JSON.parse(localStorage.getItem('nm_health_cards') || '[]'); }
  catch (e) { return null; }
  if (!Array.isArray(cards) || cards.length === 0) return null;

  // Унікальні непорожні doctor → беремо до 3 найсвіжіших карток.
  const seen = new Set();
  const doctors = [];
  for (const c of cards) {
    const d = (c.doctor || '').trim();
    if (!d || seen.has(d.toLowerCase())) continue;
    seen.add(d.toLowerCase());
    doctors.push({ name: d, cardId: c.id, cardName: c.name });
    if (doctors.length >= 3) break;
  }
  if (doctors.length === 0) return null;

  const question = t('clarify.where_save_doctor', '"{text}" — до якого лікаря записати?', { text });
  const chips = doctors.map(d => ({
    label: d.name.length > 24 ? d.name.slice(0, 24) + '…' : d.name,
    action: 'clarify_save',
    target: 'add_health_history_entry',
    payload: {
      card_id: d.cardId,
      entry_type: 'doctor_visit',
      text,
    },
  }));
  chips.push({
    label: t('clarify.chip.other_doctor', 'Інший лікар'),
    action: 'clarify_save',
    target: 'save_moment',
    payload: { text },
  });
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
