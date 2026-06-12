// src/data/dispatcher-guards.js
//
// Pure functions для нормалізації OpenAI tool_calls (масив виду
// { function: { name, arguments: JSON-string } }) ПЕРЕД диспатчем у handlers.
//
// Призначення: реалізувати принцип «8 чатів = ОДИН мозок» (CLAUDE.md) —
// guards раніше жили inline у `src/tabs/inbox.js`, інші 7 чатів через
// `tool-dispatcher.js dispatchChatToolCalls` НЕ отримували жодного guard'а.
// Тому конверсії `create_event → save_moment` (минулий час), dedupe
// `save_finance+save_task` тощо — працювали ТIЛЬКИ в Inbox-чаті. Класичний
// розрив архітектури.
//
// API контракт:
// - Кожна функція pure: НЕ читає localStorage, НЕ диспатчить події, НЕ кидає.
// - Якщо guard НЕ змінив toolCalls — повертає ТОЙ САМИЙ масив (без alloc).
// - Якщо змінив — повертає НОВИЙ масив (immutable shallow copy).
// - Логування через console.warn з префіксом '[guard]' для debug у DevTools.
//
// Готовність до Supabase (правило 12 CLAUDE.md, 64CXo 10.05): pure functions
// переїдуть у Edge Function без переписування — не залежать від DOM/storage.
//
// Створено: 10.05.2026 dyhJu (G4 Bridge-плану + B-166 фікс одним системним кроком).

import { hasExplicitClockTime, parseUaTimeOfDay } from './ua-time-parser.js';

// === Регекси (приватні) ===

// PAST_INDICATORS — слова часу + plural дієслова -ли + singular -в/-ла.
// Початкова версія з inbox.js 64CXo. Не чіпаємо щоб не зламати поточну поведінку.
const PAST_INDICATORS_RE = /(вчора|позавчора|минулого|тому\s|назад)|\b(гуля|жари|їл|пил|зустрі|сходи|створи|купи|зроби|написа|закінчи|поми|поча|відкри|приготува|пройш|по[бг]ачи|зустрі)(в|ла|ло|ли|вся|лася|лися|лось)\b/i;

const MOMENT_KEYWORD_RE = /\bмомент/i;

// MONEY_RE — число (3, 3.5, 3,5) + грошова одиниця українською/англійською.
// Покриває: «3 євро», «50 ₴», «100грн», «$120», «120 $», «10 eur», «2.5 usd»,
// «1500 гривень», «800 доларів». НЕ ловить голе число «купив 3 хліба» —
// потрібна валюта. Для save_finance B-166: страховка від AI що класифікує
// «купив хліб 3 євро» як save_note.
const MONEY_RE = /(?:[€$₴]\s*\d+(?:[.,]\d+)?)|(?:\d+(?:[.,]\d+)?\s*(?:€|\$|₴|грн|грив(?:ень|ні|ні)?|евр[оa]|євр[оа]|долар(?:ів|и|а)?|euro|usd|eur|uah))/i;

// === Утиліти ===

// Пошук tool_call за іменем функції. Повертає індекс або -1.
function _findIdx(toolCalls, name) {
  for (let i = 0; i < toolCalls.length; i++) {
    if (toolCalls[i]?.function?.name === name) return i;
  }
  return -1;
}

function _has(toolCalls, name) {
  return _findIdx(toolCalls, name) !== -1;
}

// Видалити всі tool_calls з заданим ім'ям. Повертає новий масив АБО той же
// (якщо нічого не змінилось).
function _drop(toolCalls, name) {
  if (!_has(toolCalls, name)) return toolCalls;
  return toolCalls.filter(tc => tc?.function?.name !== name);
}

// === Guards (експортовані) ===

/**
 * Слово «момент» у запиті юзера → жорстка заборона create_event.
 * Юзер каже «це момент» / «запиши момент» — AI зобовʼязаний save_moment.
 * Не критично якщо false-positive («не момент») — AI просто не зробить event.
 *
 * Походження: src/tabs/inbox.js inline guard 64CXo.
 */
export function dropEventOnMomentKeyword(toolCalls, text) {
  if (!Array.isArray(toolCalls) || toolCalls.length === 0) return toolCalls;
  if (!text || !MOMENT_KEYWORD_RE.test(text)) return toolCalls;
  if (!_has(toolCalls, 'create_event')) return toolCalls;
  console.warn('[guard] dropEventOnMomentKeyword: слово «момент» у запиті — викидаю create_event');
  return _drop(toolCalls, 'create_event');
}

/**
 * Минулий час у запиті + AI повертає create_event → конверсія у save_moment.
 * «Вчора жарили», «гуляли під дощем» — це переживання, не майбутня подія.
 * Якщо AI вже додав save_moment — НЕ конвертуємо (уже правильно).
 *
 * Походження: src/tabs/inbox.js inline guard 64CXo (Phase 1.2a Bridge).
 */
export function convertPastEventToMoment(toolCalls, text) {
  if (!Array.isArray(toolCalls) || toolCalls.length === 0) return toolCalls;
  if (!text || !PAST_INDICATORS_RE.test(text)) return toolCalls;
  const evtIdx = _findIdx(toolCalls, 'create_event');
  if (evtIdx === -1) return toolCalls;
  if (_has(toolCalls, 'save_moment')) return toolCalls;
  const evtTc = toolCalls[evtIdx];
  let evtArgs = {};
  try { evtArgs = JSON.parse(evtTc.function.arguments || '{}'); }
  catch (e) { console.warn('[guard] convertPastEventToMoment: parse failed', e); return toolCalls; }
  const momentArgs = {
    _reasoning_log: 'Auto-convert create_event to save_moment (past tense indicators in user text)',
    text: evtArgs.title || text,
    mood: 'neutral',
    date: null,
    comment: evtArgs.comment || ''
  };
  const newTc = {
    ...evtTc,
    function: { ...evtTc.function, name: 'save_moment', arguments: JSON.stringify(momentArgs) }
  };
  const out = toolCalls.slice();
  out[evtIdx] = newTc;
  console.warn('[guard] convertPastEventToMoment: minулий час → save_moment');
  return out;
}

/**
 * Явний годинниковий час у запиті + AI повертає save_task → конверсія у
 * create_event. «Подзвонити на сервіс завтра о 12:00» має КОНКРЕТНИЙ час → це
 * запланована подія (показується в Календарі/Розпорядку дня), а не задача
 * (задача має лише дату, без слота часу — тому в розпорядок не потрапляла).
 * Правило 12: детермінований сигнал (явний час) → код, не промпт.
 *
 * Захист від хибних конверсій: НЕ конвертуємо якщо (а) AI вже зробив
 * create_event, (б) минулий час у тексті (це не майбутня подія), (в) задача
 * має кроки (подія їх не має — втратили б дані багатокрокової задачі).
 */
export function convertTaskToEventOnTime(toolCalls, text) {
  if (!Array.isArray(toolCalls) || toolCalls.length === 0) return toolCalls;
  if (!text || !hasExplicitClockTime(text)) return toolCalls;
  if (PAST_INDICATORS_RE.test(text)) return toolCalls;
  if (_has(toolCalls, 'create_event')) return toolCalls;
  const taskIdx = _findIdx(toolCalls, 'save_task');
  if (taskIdx === -1) return toolCalls;
  let taskArgs = {};
  try { taskArgs = JSON.parse(toolCalls[taskIdx].function.arguments || '{}'); }
  catch (e) { console.warn('[guard] convertTaskToEventOnTime: parse failed', e); return toolCalls; }
  // Багатокрокова задача — лишаємо задачею (подія не має steps).
  if (Array.isArray(taskArgs.steps) && taskArgs.steps.length > 0) return toolCalls;
  const eventArgs = {
    _reasoning_log: 'Auto-convert save_task to create_event (explicit clock time in user text -> scheduled event)',
    title: taskArgs.title || text,
    date: taskArgs.due_date || null,        // null → create_event handler спарсить дату з тексту
    time: parseUaTimeOfDay(text) || null,
    end_time: null,
    priority: taskArgs.priority || 'normal',
    comment: taskArgs.comment || ''
  };
  const oldTc = toolCalls[taskIdx];
  const newTc = {
    ...oldTc,
    function: { ...oldTc.function, name: 'create_event', arguments: JSON.stringify(eventArgs) }
  };
  const out = toolCalls.slice();
  out[taskIdx] = newTc;
  console.warn('[guard] convertTaskToEventOnTime: явний час → create_event');
  return out;
}

/**
 * B-166 dyhJu (10.05): сума з валютою у тексті + AI повертає save_note або
 * save_moment → конверсія у save_finance. AI часто сприймає «купив хліб 3 євро»
 * як «опис стану/моменту» (КРОК 5 промпта) і ігнорує КРОК 3 (сума+іменник).
 *
 * Стратегія: парсимо число + валюту, ставимо category='Інше' (юзер виправить
 * у Finance-табло). fin_comment = original text без суми. fin_type='expense'
 * за замовчуванням (95% кейсів). Якщо AI вже додав save_finance — НЕ чіпаємо.
 */
export function convertNoteToFinance(toolCalls, text) {
  if (!Array.isArray(toolCalls) || toolCalls.length === 0) return toolCalls;
  if (!text) return toolCalls;
  const m = text.match(MONEY_RE);
  if (!m) return toolCalls;
  if (_has(toolCalls, 'save_finance')) return toolCalls; // AI правильно зрозумів
  // Шукаємо save_note АБО save_moment — обидва варіанти регресії
  let convertIdx = _findIdx(toolCalls, 'save_note');
  if (convertIdx === -1) convertIdx = _findIdx(toolCalls, 'save_moment');
  if (convertIdx === -1) return toolCalls;
  // Витягуємо число з матчу. Регекс у двох гілках: $50 / 50$ — у обох
  // випадках перше число у matched substring.
  const numMatch = m[0].match(/\d+(?:[.,]\d+)?/);
  if (!numMatch) return toolCalls;
  const amount = parseFloat(numMatch[0].replace(',', '.'));
  if (!Number.isFinite(amount) || amount <= 0) return toolCalls;
  // fin_comment — текст БЕЗ суми (1-3 слова як у промпті save_finance description)
  const cleanText = text.replace(MONEY_RE, '').replace(/\s+/g, ' ').trim() || 'витрата';
  const finArgs = {
    _reasoning_log: 'Auto-convert save_note/save_moment to save_finance (money pattern detected in user text)',
    fin_type: 'expense',
    amount,
    category: 'Інше',
    fin_comment: cleanText.length > 40 ? cleanText.slice(0, 40) : cleanText
  };
  const oldTc = toolCalls[convertIdx];
  const newTc = {
    ...oldTc,
    function: { ...oldTc.function, name: 'save_finance', arguments: JSON.stringify(finArgs) }
  };
  const out = toolCalls.slice();
  out[convertIdx] = newTc;
  console.warn('[guard] convertNoteToFinance: «' + m[0] + '» → save_finance amount=' + amount);
  return out;
}

/**
 * Batch save_finance + save_task → drop save_task. AI у gpt-4o-mini
 * іноді робить дубль для «50 мийка авто»: і витрата, і «купити мийку».
 * Юзер хотів тільки витрату.
 *
 * Походження: src/tabs/inbox.js inline guard LfA6w 08.05 v2.
 */
export function dropTaskOnFinance(toolCalls) {
  if (!Array.isArray(toolCalls) || toolCalls.length === 0) return toolCalls;
  if (!_has(toolCalls, 'save_finance')) return toolCalls;
  if (!_has(toolCalls, 'save_task')) return toolCalls;
  console.warn('[guard] dropTaskOnFinance: save_finance+save_task batch — викидаю save_task');
  return _drop(toolCalls, 'save_task');
}

/**
 * Batch complete_task + save_task → drop save_task. AI на «Купив хліб» при
 * активній задачі «Купити м'ясо» одночасно (а) закривав чужу через fuzzy
 * match, (б) створював нову з минулого часу. complete_task пріоритет.
 *
 * Походження: src/tabs/inbox.js inline guard 64CXo 09.05.
 */
export function dropTaskOnComplete(toolCalls) {
  if (!Array.isArray(toolCalls) || toolCalls.length === 0) return toolCalls;
  if (!_has(toolCalls, 'complete_task')) return toolCalls;
  if (!_has(toolCalls, 'save_task')) return toolCalls;
  console.warn('[guard] dropTaskOnComplete: complete_task+save_task batch — викидаю save_task');
  return _drop(toolCalls, 'save_task');
}

/**
 * Batch save_moment + create_event → drop create_event. AI на «жарили мʼясо»
 * одночасно зберігав момент і створював подію. save_moment пріоритет —
 * минулий час = виконання, не майбутня подія.
 *
 * Походження: src/tabs/inbox.js inline guard 64CXo.
 */
export function dropEventOnMoment(toolCalls) {
  if (!Array.isArray(toolCalls) || toolCalls.length === 0) return toolCalls;
  if (!_has(toolCalls, 'save_moment')) return toolCalls;
  if (!_has(toolCalls, 'create_event')) return toolCalls;
  console.warn('[guard] dropEventOnMoment: save_moment+create_event batch — викидаю create_event');
  return _drop(toolCalls, 'create_event');
}

/**
 * Convenience: всі 6 guards у каноничному порядку.
 *
 * Порядок важливий — кожен guard може створити стан у якому наступний спрацює:
 * - convertPastEventToMoment створює save_moment → dropEventOnMoment чистить дубль
 * - convertNoteToFinance створює save_finance → dropTaskOnFinance чистить save_task
 *
 * Викликати у `tool-dispatcher.js dispatchChatToolCalls` на самому початку
 * (для 7 tab-чатів) і у `inbox.js` (для 8-го Inbox-чату).
 */
export function applyAllGuards(toolCalls, text) {
  if (!Array.isArray(toolCalls) || toolCalls.length === 0) return toolCalls;
  let tc = toolCalls;
  tc = dropEventOnMomentKeyword(tc, text);
  tc = convertPastEventToMoment(tc, text);
  tc = convertNoteToFinance(tc, text);
  tc = dropTaskOnFinance(tc);
  tc = dropTaskOnComplete(tc);
  tc = dropEventOnMoment(tc);
  // Останнім: save_task що ВИЖИВ усі dedup + має явний час → create_event
  // (щоб не конвертувати задачу яку щойно дропнули як finance/complete-дубль).
  tc = convertTaskToEventOnTime(tc, text);
  return tc;
}
