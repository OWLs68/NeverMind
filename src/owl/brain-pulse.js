// ============================================================
// brain-pulse.js — Один мозок, проактивні повідомлення у будь-який чат
// ============================================================
// "Один мозок на все" Варіант 2 (ZJmdF 21.04.2026):
// Замість 6 окремих check-функцій (по одній на вкладку) — ОДИН pulse який:
//   1. Збирає всі живі сигнали застосунку (brain-signals.js).
//   2. Перевіряє global cooldown і silent phase (через shouldOwlSpeak).
//   3. Подає сигнали моделі з tool post_chat_message.
//   4. Мозок САМ вирішує: писати? куди? що саме? чи мовчати?
//   5. Якщо tool викликано — диспатч через addMsgForTab (з Фази A бейдж
//      на літачку автоматично зʼявиться).
//
// Cooldowns:
//   brain_global        — 30 хв (спільна з followup_global)
//   brain_tab_<tab>     — 24 год на вкладку (не більше 1 проактивного/добу)
//   brain_<signalKey>   — 24 год per-signal (ставиться у collectBrainSignals)
// ============================================================

import { callAIWithTools, addMsgForTab } from '../ai/core.js';
import { BRAIN_TOOLS, getBrainPulseSystemPrompt } from '../ai/prompts.js';
import { owlCdExpired, setOwlCd, shouldOwlSpeak } from './inbox-board.js';
import { collectBrainSignals } from './brain-signals.js';

const BRAIN_PULSE_INTERVAL = 10 * 60 * 1000;  // 10 хв
const BRAIN_PULSE_DEBOUNCE = 60 * 1000;       // 60 сек — debounce на nm-data-changed
const BRAIN_TAB_CD = 24 * 60 * 60 * 1000;     // 24 год на вкладку

let _pulseInFlight = false;
let _debounceTimer = null;

export async function brainPulse() {
  if (_pulseInFlight) return;
  if (typeof document !== 'undefined' && document.hidden) return;

  _pulseInFlight = true;
  try {
    // Global judge (silent phase + no-api-key + activeChatBar)
    const judge = shouldOwlSpeak('brain-pulse', { channel: 'chat-followup' });
    if (!judge.speak) {
      // 'followup-global-cd' — нормально, чекаємо годину
      // B-99 (v2vYo 24.04): fallback 'unknown' щоб у логах не було пустого 'skip:'
      if (judge.reason !== 'followup-global-cd') {
        console.log('[brain-pulse] skip:', judge.reason || 'unknown');
      }
      return;
    }

    const signals = collectBrainSignals();
    if (signals.length === 0) return;

    // Фільтруємо вкладки з активним tab-cooldown (не спам 2 проактивних на добу)
    const allowedSignals = signals.filter(s => owlCdExpired(`brain_tab_${s.tab}`, BRAIN_TAB_CD));
    if (allowedSignals.length === 0) {
      console.log('[brain-pulse] all tabs on cooldown');
      return;
    }

    const systemPrompt = getBrainPulseSystemPrompt(allowedSignals);
    const history = [{
      role: 'user',
      content: 'Проаналізуй сигнали вище і виклич post_chat_message один раз, або відповідай "skip".'
    }];

    const result = await callAIWithTools(systemPrompt, history, BRAIN_TOOLS);

    if (!result || !result.tool_calls || result.tool_calls.length === 0) {
      console.log('[brain-pulse] model said skip');
      return;
    }

    const call = result.tool_calls[0];
    if (call.function?.name !== 'post_chat_message') {
      console.warn('[brain-pulse] unexpected tool:', call.function?.name);
      return;
    }

    let args;
    try { args = JSON.parse(call.function.arguments || '{}'); }
    catch (e) { console.warn('[brain-pulse] bad tool args:', e); return; }

    const { tab, text, priority, reason } = args;
    if (!tab || !text) return;

    // Вставляємо у чат (автобейдж з Фази A)
    addMsgForTab(tab, 'agent', text);

    // Cooldowns
    setOwlCd('followup_global');      // спільний з followups.js — не спам мозком+followup
    setOwlCd(`brain_tab_${tab}`);     // ця вкладка мовчить 24 год

    // Per-signal cooldown — ставимо для ВСІХ сигналів тієї ж вкладки
    // (мозок вибрав один, інші того ж типу теж "погасилися")
    const relevantSignals = allowedSignals.filter(s => s.tab === tab);
    for (const s of relevantSignals) {
      if (s.cdKey) setOwlCd(s.cdKey);
    }

    console.log(`[brain-pulse] posted to ${tab} (${priority}, reason: ${reason || '?'})`);
  } catch (e) {
    console.warn('[brain-pulse] error:', e);
  } finally {
    _pulseInFlight = false;
  }
}

export function startBrainPulseCycle() {
  // Перший пульс через 45 сек після старту
  setTimeout(brainPulse, 45 * 1000);
  // Далі — кожні 10 хв
  setInterval(brainPulse, BRAIN_PULSE_INTERVAL);
  // Debounce на зміни даних (юзер додав транзакцію → може зʼявився budget-warn)
  if (typeof window !== 'undefined') {
    window.addEventListener('nm-data-changed', () => {
      clearTimeout(_debounceTimer);
      _debounceTimer = setTimeout(brainPulse, BRAIN_PULSE_DEBOUNCE);
    });
  }
}
