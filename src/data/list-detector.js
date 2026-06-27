// === LIST DETECTOR (v3pexs 27.06.2026) ===
// Детермінований парсер списків-чеклістів — CLAUDE.md правило 12.
//
// «Склади список покупок: молоко, хліб, яйця» — це 100% детерміноване:
// тригер «список» + перелік ≥2 пунктів. AI плутає це з задачею-чеклістом
// (prompts.js вчив «список → save_task»). Парсер дає однозначний save_list,
// AI не вирішує «задача чи список» → нуль протікання у Задачі (вимога Романа).
//
// API: parseListIntent(text) → { tool:'save_list', args:{title, items:[string]} } | null
//   - null = не список, передавай AI як раніше
//   - items — масив РЯДКIВ; {id,done} додає диспатч при збереженні (як task.steps).
//
// Інтегрується у core.js ПЕРЕД OpenAI fetch (поряд з parseExplicitIntent).

import { BL, BR } from './intent-router.js';

// Тригер-слово списку (кирилично-безпечні межі). «переліку/чеклист/чекліст» теж.
const LIST_WORD = new RegExp(BL + '(?:список\\p{L}*|переліку?|перелік|чеклист\\p{L}*|чекліст\\p{L}*)' + BR, 'iu');
// Покупки-тригер з двокрапкою: «купити: …», «треба купити: …».
const SHOPPING_TRIGGER = new RegExp(BL + '(?:купити|купи|придбати|треба\\s+купити|потрібно\\s+купити)\\s*:', 'iu');

// Бейл — це радше нагадування/подія/час (списки таких маркерів не мають).
// Захищає від «нагадай список справ о 18:00» → то reminder, не список.
const NOT_LIST = new RegExp(BL + '(?:нагадай|нагадуванн\\p{L}*|ремайндер|\\d{1,2}[:.]\\d{2}|о\\s+\\d{1,2}\\s+(?:ранку|вечора|дня|ночі))', 'iu');

// Дієслова-створення + тригер-слово прибираються із заголовка.
const TITLE_STRIP_VERB = new RegExp(BL + '(?:склади|створ\\p{L}+|зроби|додай|запиши|новий|нова|потрібен|треба|купити|купи|придбати|потрібно)' + BR, 'giu');
const TITLE_STRIP_WORD = new RegExp(BL + '(?:список\\p{L}*|переліку?|перелік|чеклист\\p{L}*|чекліст\\p{L}*)' + BR, 'giu');

// Заголовок зі шматка ПЕРЕД двокрапкою/першим рядком («склади список покупок» → «Покупок»).
function _extractTitle(before, fallback = 'Список') {
  let s = (before || '')
    .replace(TITLE_STRIP_VERB, ' ')
    .replace(TITLE_STRIP_WORD, ' ')
    .replace(/[:\-—]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!s || s.length < 2) return fallback;
  s = s.toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Розбиває тіло на пункти: нормалізує марковані/нумеровані маркери у роздільник,
// потім ділить по нових рядках / комах / крапках з комою.
function _splitItems(body) {
  return (body || '')
    .replace(/(?:^|\s)\d+[.)]\s+/gu, '\n')      // «1. » «2) »
    .replace(/(?:^|\s)[•·*]\s+/gu, '\n')         // «• » «* »
    .replace(/(?:^|[\n\s])[\-–—]\s+/gu, '\n')    // «- » (дефіс+пробіл, не всередині слова)
    .split(/[\n,;]+/)
    .map(s => s.trim())
    .filter(s => s.length > 0 && s.length <= 100);
}

export function parseListIntent(text) {
  if (!text || typeof text !== 'string') return null;
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (NOT_LIST.test(trimmed)) return null;

  const hasListWord = LIST_WORD.test(trimmed);
  const hasShopping = SHOPPING_TRIGGER.test(trimmed);
  if (!hasListWord && !hasShopping) return null;

  let title;
  let body;
  const colonIdx = trimmed.indexOf(':');
  if (colonIdx !== -1) {
    body = trimmed.slice(colonIdx + 1);
    title = _extractTitle(trimmed.slice(0, colonIdx), hasShopping && !hasListWord ? 'Покупки' : 'Список');
  } else {
    // Без двокрапки — пункти через нові рядки (перший рядок = заголовок).
    const lines = trimmed.split(/\n/);
    if (lines.length < 2) return null;  // один рядок без переліку = не список
    title = _extractTitle(lines[0]);
    body = lines.slice(1).join('\n');
  }

  const items = _splitItems(body);
  if (items.length < 2) return null;  // <2 пунктів = не список (один пункт = нотатка/задача)

  return {
    tool: 'save_list',
    args: {
      _reasoning_log: 'Детермінований list-detector: тригер списку + ≥2 пунктів. Bypass AI — save_list, не save_task.',
      title,
      items,
    },
  };
}

// Експорти для unit-тестів
export const _internals = { _extractTitle, _splitItems, LIST_WORD, SHOPPING_TRIGGER, NOT_LIST };
