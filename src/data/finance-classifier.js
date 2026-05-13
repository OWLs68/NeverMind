// src/data/finance-classifier.js
//
// Pure functions для класифікації save_finance вводу — спільні для трьох
// dispatch-шляхів (Inbox → finance.js, 6 tab-чатів → habits.js, Evening →
// evening-actions.js). До nliW8 Phase 2 ці три шляхи мали ДУБЛЬОВАНУ
// логіку з активними розбіжностями (auto-create вигаданих категорій
// у habits.js, відсутні syncHealth + budget у habits.js, Date.now() ID).
//
// API контракт (правило 12 CLAUDE.md, готує до Supabase Edge Function):
// - Усі функції pure: НЕ читають localStorage, НЕ диспатчать події, НЕ
//   викликають DOM/render. Приймають дані як параметри, повертають дані.
// - Готовність до Supabase: ці функції переїдуть у Edge Function БЕЗ
//   переписування — клієнт надсилає (parsed, catList, now), сервер
//   повертає {category, aiSuggested, ...}. Той самий patten що
//   `dispatcher-guards.js` + `ua-time-parser.js`.
//
// Створено: nliW8 13.05.2026 (Phase 2 рефакторинг save_finance).

import { matchSubcategoryFromComment } from './finance-subcat-keywords.js';
import { resolveDateFromText } from './ua-time-parser.js';

// === Утиліти ===

/**
 * Нормалізація для порівняння категорій: апостроф-варіанти + lowercase + trim.
 * AI може повернути «Здоров'я» (straight) або «Здоровʼя» (curly) — обидва
 * мають матчити юзерську категорію незалежно від форми (B-47 клас).
 */
export const normalizeCategoryName = (s) =>
  String(s || '').replace(/[ʼ’`]/g, "'").toLowerCase().trim();

// === Класифікатори ===

/**
 * Зіставити AI-категорію з юзерським списком.
 *
 * Якщо знайшов матч → повертає юзерську форму назви (саме як зберігав юзер).
 * Якщо не знайшов → повертає 'Інше' + `aiSuggested` з оригіналом для
 * chip-діалогу («Створити X / Лишити в Інше»).
 *
 * @param {string} parsedCategory - категорія яку повернув AI у tool_call
 * @param {Array<{name, archived?, subcategories?}>} catList - юзерські категорії з nm_finance_cats (експенс або інком)
 * @returns {{ category: string, aiSuggested: string|null }}
 */
export function classifyCategory(parsedCategory, catList) {
  const safeList = Array.isArray(catList) ? catList : [];
  const raw = String(parsedCategory || '').trim();
  if (!raw) {
    return { category: 'Інше', aiSuggested: null };
  }
  const matched = safeList.find(c => normalizeCategoryName(c.name) === normalizeCategoryName(raw));
  if (matched) {
    return { category: matched.name, aiSuggested: null };
  }
  // AI вигадав категорію — fallback на «Інше», запам'ятовуємо для chip-діалогу.
  return { category: 'Інше', aiSuggested: raw };
}

/**
 * Зіставити AI-підкатегорію з юзерським списком.
 *
 * Алгоритм:
 * 1. Якщо AI передав sub і вона матчиться у validSubs → юзерська форма.
 * 2. Якщо AI передав sub але не матчиться → aiSuggested = оригінал, subcategory = ''.
 * 3. Якщо AI НЕ передав sub → keyword-match з comment проти validSubs (fallback).
 *
 * @param {string} parsedSub - підкатегорія яку повернув AI
 * @param {Array<string>} validSubs - підкатегорії юзерської категорії
 * @param {string} comment - текст для keyword fallback
 * @returns {{ subcategory: string, aiSuggested: string|null }}
 */
export function classifySubcategory(parsedSub, validSubs, comment) {
  const safeSubs = Array.isArray(validSubs) ? validSubs : [];
  const raw = String(parsedSub || '').trim();

  if (raw) {
    const matched = safeSubs.find(s => normalizeCategoryName(s) === normalizeCategoryName(raw));
    if (matched) return { subcategory: matched, aiSuggested: null };
    // AI вигадав sub — fallback пустий, запам'ятовуємо для chip-діалогу.
    return { subcategory: '', aiSuggested: raw };
  }

  // AI не передав sub — пробуємо keyword fallback з comment.
  if (comment && safeSubs.length > 0) {
    const fromComment = matchSubcategoryFromComment(comment, safeSubs);
    if (fromComment) return { subcategory: fromComment, aiSuggested: null };
  }

  return { subcategory: '', aiSuggested: null };
}

/**
 * Розв'язати timestamp транзакції з AI-дати або тексту.
 *
 * Пріоритет:
 * 1. AI явно передав date (YYYY-MM-DD) → 12:00 у цей день.
 * 2. ua-time-parser знаходить часовий маркер у тексті («вчора», «3 дні тому») → 20:00.
 * 3. Fallback на now (зараз).
 *
 * @param {string|null} aiDate - YYYY-MM-DD або порожнє
 * @param {string} text - оригінальний текст юзера
 * @param {number} now - timestamp ms (Date.now() від caller'а — щоб функція була pure)
 * @returns {number} timestamp ms
 */
export function resolveFinanceDate(aiDate, text, now) {
  if (aiDate) {
    const d = new Date(aiDate + 'T12:00:00');
    if (!isNaN(d.getTime())) return d.getTime();
  }
  const resolved = resolveDateFromText(text || '', new Date(now), 'past');
  if (resolved) {
    resolved.setHours(20, 0, 0, 0);
    return resolved.getTime();
  }
  return now;
}
