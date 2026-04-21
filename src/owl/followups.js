// ============================================================
// followups.js — Evening Prompt (Фаза 3 Вечора 2.0)
// ============================================================
// Агент ініціює вечірнє привітання о 18:00-22:59 коли юзер уже щось
// робив сьогодні (moments/evening context не порожній).
//
// ОНОВЛЕНО 21.04.2026 (сесія ZJmdF, Фаза B "Один мозок" Варіант 2):
// stuck-task і event-passed перенесені у brain-pulse.js + brain-signals.js.
// Там мозок САМ вирішує куди/що писати з ширшого набору сигналів.
// Тут лишається evening-prompt бо він має унікальний промпт
// getEveningPromptSystem() і спеціальний вечірній ритуал.
// Глобальний cooldown followup_global спільний з brain-pulse — дубль
// між двома системами неможливий.
// ============================================================

import { callAI, addMsgForTab, getAIContext } from '../ai/core.js';
import { getEveningContext, getMomentsContext } from '../tabs/evening.js';
import { getEveningPromptSystem } from '../ai/prompts.js';
import { owlCdExpired, setOwlCd, shouldOwlSpeak } from './inbox-board.js';

const FOLLOWUP_CHECK_INTERVAL = 5 * 60 * 1000;       // 5 хв — перевірка по таймеру
const FOLLOWUP_DEBOUNCE       = 5 * 1000;            // 5 сек — debounce на nm-data-changed
const EVENING_PROMPT_CD       = 24 * 60 * 60 * 1000; // 24 год — 1 раз на день

let _debounceTimer = null;
let _checkInFlight = false;

export async function checkFollowups() {
  if (_checkInFlight) return;
  if (typeof document !== 'undefined' && document.hidden) return;

  _checkInFlight = true;
  try {
    const hit = _checkEveningPrompt();
    if (!hit) return;

    const judge = shouldOwlSpeak(hit.type, { channel: 'chat-followup', targetTab: 'evening' });
    if (!judge.speak) return;

    const text = await _generateEveningPrompt();
    if (!text) return;

    addMsgForTab('evening', 'agent', text);
    setOwlCd('followup_global');
    setOwlCd('evening_prompt_daily');
  } finally {
    _checkInFlight = false;
  }
}

// Тригер вечірнього ритуалу: 18:00-22:59, за день ще не писали, є контент дня
function _checkEveningPrompt() {
  const h = new Date().getHours();
  if (h < 18 || h >= 23) return null;
  if (!owlCdExpired('evening_prompt_daily', EVENING_PROMPT_CD)) return null;
  const hasContent = (getMomentsContext() || '').length > 0 || (getEveningContext() || '').length > 0;
  if (!hasContent) return null;
  return { type: 'evening-prompt' };
}

async function _generateEveningPrompt() {
  try {
    const systemPrompt = getEveningPromptSystem() + '\n\n' + getAIContext();
    const reply = await callAI(systemPrompt, 'Привітайся з юзером у чаті Вечора — він щойно відкриє вкладку.');
    if (!reply || typeof reply !== 'string') return null;
    return reply.trim().slice(0, 400);
  } catch (e) {
    console.warn('[followups] evening-prompt generation failed:', e);
    return null;
  }
}

export function startFollowupsCycle() {
  setTimeout(checkFollowups, 30 * 1000);
  setInterval(checkFollowups, FOLLOWUP_CHECK_INTERVAL);
  window.addEventListener('nm-data-changed', () => {
    clearTimeout(_debounceTimer);
    _debounceTimer = setTimeout(checkFollowups, FOLLOWUP_DEBOUNCE);
  });
}
