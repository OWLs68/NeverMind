// ============================================================
// followups.js — Live Chat Replies (Фаза 2 мозку OWL)
// ============================================================
// Агент ініціює повідомлення в контекстний чат коли є привід:
//   • Задача висить 3+ дні         → "Що з переїздом? ⏰"
//   • Подія в календарі пройшла    → "Як пройшла консультація? 💬"
//
// Принцип "один мозок на все": follow-up йде у чат тієї вкладки
// яка тематично пов'язана з тригером, не завжди в Inbox.
//
// ОНОВЛЕНО 11.04 (Крок 1 уніфікації):
// Усі hard-блокери (silent phase, API key, global cooldown, activeChatBar)
// тепер перевіряє ЄДИНИЙ Judge Layer — shouldOwlSpeak(trigger, {channel: 'chat-followup'}).
// Тут лишається тільки доменна логіка: які елементи застрягли, які події пройшли,
// per-item cooldowns, генерація тексту і надсилання.
//
// Cooldowns через існуючий nm_owl_cooldowns:
//   followup_global             → 1/год глобально (перевіряється у Judge Layer)
//   followup_stuck_<taskId>     → 24 год per-task (перевіряється тут)
//   followup_event_<eventId>    → 365 днів per-event (≈ одноразово, перевіряється тут)
// ============================================================

import { callAI, addMsgForTab } from '../ai/core.js';
import { getTasks } from '../tabs/tasks.js';
import { getEvents } from '../tabs/calendar.js';
import { owlCdExpired, setOwlCd, shouldOwlSpeak } from './inbox-board.js';

// === КОНСТАНТИ ===
const FOLLOWUP_CHECK_INTERVAL = 5 * 60 * 1000;       // 5 хв — перевірка по таймеру
const FOLLOWUP_DEBOUNCE       = 5 * 1000;            // 5 сек — debounce на nm-data-changed
const STUCK_TASK_DAYS         = 3;
const STUCK_TASK_CD           = 24 * 60 * 60 * 1000; // 24 год per-task
const EVENT_PASSED_CD         = 365 * 24 * 60 * 60 * 1000; // ≈ одноразово per-event

// Куди писати для якого тригера (правило "один мозок")
const TRIGGER_TO_TAB = {
  'stuck-task':    'tasks',
  'event-passed':  'tasks',   // календар зараз живе всередині Продуктивності
};

// Внутрішній стан
let _debounceTimer = null;
let _checkInFlight = false;

// ============================================================
// ОСНОВНИЙ ЦИКЛ
// ============================================================

// Перевіряє всі тригери і надсилає МАКСИМУМ один follow-up за виклик
// (щоб не спамити юзера коли кілька умов виконуються одночасно)
export async function checkFollowups() {
  if (_checkInFlight) return;

  _checkInFlight = true;
  try {
    // Перевіряємо тригери у порядку пріоритету.
    // Детекція (per-item cooldowns) тут, глобальні блокери — у Judge Layer.
    const triggers = [
      _checkStuckTasks,
      _checkPassedEvents,
    ];
    for (const trig of triggers) {
      const hit = trig();
      if (!hit) continue;
      const tab = TRIGGER_TO_TAB[hit.type];

      // Єдиний Judge Layer вирішує — чи можна зараз говорити у цьому каналі
      const judge = shouldOwlSpeak(hit.type, { channel: 'chat-followup', targetTab: tab });
      if (!judge.speak) {
        // Якщо цей тригер заблокований, пробуємо наступний
        // (деякі блокери можуть відрізнятись per-trigger у майбутньому)
        continue;
      }

      await _sendFollowupToChat(tab, hit.type, hit.item);
      return; // один follow-up за виклик
    }
  } finally {
    _checkInFlight = false;
  }
}

// ============================================================
// ТРИГЕРИ
// ============================================================

// Повертає { type, item } або null
function _checkStuckTasks() {
  const cutoff = Date.now() - STUCK_TASK_DAYS * 24 * 60 * 60 * 1000;
  const tasks = getTasks()
    .filter(t => t.status === 'active')
    .filter(t => t.createdAt && t.createdAt < cutoff)
    .filter(t => owlCdExpired(`followup_stuck_${t.id}`, STUCK_TASK_CD))
    .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)); // найстарша перша
  if (tasks.length === 0) return null;
  return { type: 'stuck-task', item: tasks[0] };
}

// Повертає { type, item } або null
function _checkPassedEvents() {
  const now = Date.now();
  const events = getEvents()
    .filter(ev => ev.time) // без часу — не знаємо коли "пройшла"
    .filter(ev => {
      // Парсимо дату+час у локальний Date
      const [h, m] = ev.time.split(':').map(Number);
      if (isNaN(h) || isNaN(m)) return false;
      const [y, mo, d] = ev.date.split('-').map(Number);
      if (isNaN(y) || isNaN(mo) || isNaN(d)) return false;
      const evDate = new Date(y, mo - 1, d, h, m);
      // Подія пройшла щонайменше 30 хв тому (дати їй скінчитись)
      return (now - evDate.getTime()) > 30 * 60 * 1000 && (now - evDate.getTime()) < 24 * 60 * 60 * 1000;
    })
    .filter(ev => owlCdExpired(`followup_event_${ev.id}`, EVENT_PASSED_CD))
    .sort((a, b) => (b.id || 0) - (a.id || 0)); // свіжіші перші
  if (events.length === 0) return null;
  return { type: 'event-passed', item: events[0] };
}

// ============================================================
// ГЕНЕРАЦІЯ + НАДСИЛАННЯ
// ============================================================

async function _sendFollowupToChat(tab, type, item) {
  const text = await _generateFollowupText(type, item);
  if (!text) return;

  // Вставляємо у чат через диспатчер (core.js)
  addMsgForTab(tab, 'agent', text);

  // Ставимо cooldowns
  setOwlCd('followup_global');
  if (type === 'stuck-task') setOwlCd(`followup_stuck_${item.id}`);
  if (type === 'event-passed') setOwlCd(`followup_event_${item.id}`);
}

async function _generateFollowupText(type, item) {
  const prompts = {
    'stuck-task': {
      system: `Ти — OWL, персональний агент. Пишеш юзеру у чат бо бачиш що його задача висить уже більше 3 днів. Задача: "${item.title}". Напиши КОРОТКЕ людяне повідомлення 1 речення — м'яко спитай що з нею, без тиску і моралі. Можеш додати одне доречне emoji (⏰ або подібне) якщо пасує. Не вигадуй деталей яких не знаєш.`,
      user: 'Напиши повідомлення'
    },
    'event-passed': {
      system: `Ти — OWL, персональний агент. Пишеш юзеру у чат бо бачиш що у нього була запланована подія "${item.title}" і вона щойно пройшла. Напиши КОРОТКЕ людяне повідомлення 1 речення — щиро спитай як воно пройшло. Можеш додати одне доречне emoji (💬 або подібне). Без зайвих фраз.`,
      user: 'Напиши повідомлення'
    },
  };
  const p = prompts[type];
  if (!p) return null;
  try {
    const reply = await callAI(p.system, p.user);
    if (!reply || typeof reply !== 'string') return null;
    // Захист: обрізаємо до 240 символів щоб ненароком не вилив великий текст
    return reply.trim().slice(0, 240);
  } catch (e) {
    console.warn('[followups] generation failed:', e);
    return null;
  }
}

// ============================================================
// ІНТЕГРАЦІЯ — таймер + listeners
// ============================================================

export function startFollowupsCycle() {
  // Перша перевірка через 30 сек після старту (дати застосунку прогрітись)
  setTimeout(checkFollowups, 30 * 1000);
  // Далі — кожні 5 хв
  setInterval(checkFollowups, FOLLOWUP_CHECK_INTERVAL);
  // Також реагуємо на зміни даних (юзер закрив задачу → може з'явилась нова умова)
  window.addEventListener('nm-data-changed', () => {
    clearTimeout(_debounceTimer);
    _debounceTimer = setTimeout(checkFollowups, FOLLOWUP_DEBOUNCE);
  });
}
