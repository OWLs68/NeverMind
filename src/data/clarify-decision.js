// === CLARIFY DECISION (v3pexs 28.06.2026) ===
// ЧИСТА логіка рішення «показати clarify-чіпи чи ні» — винесена з
// src/owl/clarify-guard.js (той тягне t()/dispatch/uuid → не запускається у
// node → bareNoun-борг: реального тесту не було, регрес у 7 чатах пройшов би
// тихо). Той самий патерн що tool-filter.js: рішення тут (pure, node-тест
// check-clarify-decision.js), презентація (i18n-чіпи + UUID) — у clarify-guard.
//
// API: decideClarify(text, toolCalls) →
//   null                                  — не втручатись, AI/потік як є
//   { bareNoun, businessNoun|null }       — показати чіпи «куди записати?»
//     bareNoun — trimmed-слово юзера; businessNoun — матч для чіпа «Створити проект».

// Голий іменник: 2-30 літер кирилиці без цифр, без розділових крім дефіса/апострофа.
// "Хімчистка", "Олег" — так; "Хімчистка 2026", "що робити" — ні.
export const BARE_NOUN_RE = /^[А-ЯҐЄІЇа-яґєії'’\-]{2,30}$/;

// Бізнес-іменники — для чіпа "Створити проект" (rC4TO 04.05).
export const BUSINESS_NOUN_RE = /(автомий\w*|салон\w*|сайт\w*|магазин\w*|студі\w*|курс\w*|школ\w*|кав['’]ярн\w*|майстерн\w*|бар|ресторан\w*|клуб\w*|спортзал\w*|атель\w*|пекарн\w*|хімчистк\w*|агентств\w*|компані\w*|стартап\w*|бізнес\w*|проект\w*)/i;

// Явна команда — пропускаємо guard, AI правий.
// (без хвостового \b — мертвий на кирилиці, підрядок як решта.)
export const COMMAND_RE = /(створи|додай|запиши|нагада|постав|зроби|куп(и|ити)|зателефонуй|видали|перенеси|зміни|поміняй|онови)/i;

// Сума/дата → save_finance/create_event, не наша справа.
export const HAS_NUMBER_RE = /\d/;

// Однослівні привітання/згоди/відмови — НЕ записи (v3pexs, ~30-40% коротких реплік).
export const GREETING_STOPLIST = new Set([
  'привіт', 'вітаю', 'дякую', 'дяк', 'окей', 'ок', 'так', 'ні', 'добре', 'гаразд',
  'зрозумів', 'зрозуміла', 'чудово', 'супер', 'класно', 'ясно', 'справді', 'цікаво',
  'можливо', 'ого', 'ніяк', 'бувай', 'пока', 'привіт!', 'дякую!', 'вибач', 'вибачте',
  'агов', 'гей', 'хм', 'ага', 'угу', 'неа', 'аякже',
]);

// Tools-створювачі з потенційно неправильним типом (guard ловить лише їх у tool-режимі).
export const SUSPICIOUS_TOOLS = new Set([
  'create_project',
  'create_event',
  'save_task',
  'save_moment',
  'save_note',
  'save_finance',
  'set_reminder',
  'complete_task',
  // health tools REMOVED (EU AI Act JMQuT 17.05.2026).
]);

export function decideClarify(text, toolCalls) {
  if (!Array.isArray(toolCalls)) return null;
  if (!text || typeof text !== 'string') return null;
  const trimmed = text.trim();
  if (trimmed.length === 0) return null;

  // Два режими (v3pexs): tool-режим — лише якщо хоч один SUSPICIOUS;
  // no-tool режим (AI відповів текстом) — одразу до bareNoun-гілки.
  if (toolCalls.length > 0) {
    const hasSuspicious = toolCalls.some(tc => SUSPICIOUS_TOOLS.has(tc?.function?.name));
    if (!hasSuspicious) return null;
  }

  if (GREETING_STOPLIST.has(trimmed.toLowerCase())) return null;
  if (COMMAND_RE.test(trimmed)) return null;
  if (HAS_NUMBER_RE.test(trimmed)) return null;
  if (!BARE_NOUN_RE.test(trimmed)) return null;

  const businessMatch = trimmed.match(BUSINESS_NOUN_RE);
  return {
    bareNoun: trimmed,
    businessNoun: businessMatch ? businessMatch[1] : null,
  };
}
