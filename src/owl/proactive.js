import { getAIContext, getOWLPersonality, restoreChatUI } from '../ai/core.js';
import { currentTab } from '../core/nav.js';
import { OWL_TAB_BOARD_MIN_INTERVAL, _owlTabApplyState, _owlTabStates, getOwlTabTsKey, getTabBoardMsgs, renderTabBoard, saveTabBoardMsg } from './board.js';
import { getDayPhase, getOwlBoardContext, getOwlBoardMessages, saveOwlBoardMessages, setOwlCd, renderOwlBoard } from './inbox-board.js';
import { CHIP_PROMPT_RULES, CHIP_JSON_FORMAT } from './chips.js';
import { getTasks } from '../tabs/tasks.js';
import { getHabits, getHabitLog, getHabitPct, getHabitStreak, getQuitStatus } from '../tabs/habits.js';
import { getNotes } from '../tabs/notes.js';
import { getFinance, getFinanceContext } from '../tabs/finance.js';

export function getTabBoardContext(tab) {
  const parts = [];
  try { const ctx = getAIContext(); if (ctx) parts.push(ctx); } catch(e) {}

  if (tab === 'tasks') {
    const tasks = getTasks();
    const active = tasks.filter(t => t.status === 'active');
    const now = Date.now();
    const stuck = active.filter(t => t.createdAt && (now - t.createdAt) > 3 * 24 * 60 * 60 * 1000);
    if (stuck.length > 0) parts.push(`[ВАЖЛИВО] Задачі без прогресу 3+ дні: ${stuck.map(t => '"' + t.title + '"').join(', ')}`);
    parts.push(`Активних задач: ${active.length}, закрито: ${tasks.filter(t => t.status === 'done').length}`);
    // Quit звички
    const allHabits = getHabits();
    const quitHabits = allHabits.filter(h => h.type === 'quit');
    if (quitHabits.length > 0) {
      const todayStr = new Date().toISOString().slice(0, 10);
      const quitInfo = quitHabits.map(h => {
        const s = getQuitStatus(h.id);
        const heldToday = s.lastHeld === todayStr;
        return `"${h.name}": стрік ${s.streak || 0} дн${heldToday ? ' ✓' : ' (не відмічено сьогодні)'}`;
      });
      parts.push(`Челенджі "Кинути": ${quitInfo.join('; ')}`);
      const notHeld = quitHabits.filter(h => getQuitStatus(h.id).lastHeld !== todayStr);
      if (notHeld.length > 0) parts.push(`[ВАЖЛИВО] Не відмічено сьогодні: ${notHeld.map(h => '"' + h.name + '"').join(', ')}`);
    }
  }

  if (tab === 'notes') {
    const notes = getNotes();
    const byFolder = {};
    notes.forEach(n => { const f = n.folder || 'Загальне'; byFolder[f] = (byFolder[f] || 0) + 1; });
    parts.push(`Нотатки: ${notes.length} записів. Папки: ${Object.entries(byFolder).map(([f, c]) => f + '(' + c + ')').join(', ') || 'немає'}`);
  }

  if (tab === 'me') {
    const habits = getHabits();
    const buildHabits = habits.filter(h => h.type !== 'quit');
    const quitHabits = habits.filter(h => h.type === 'quit');
    const log = getHabitLog();
    const today = new Date().toDateString();
    const todayStr = new Date().toISOString().slice(0, 10);
    const todayDow = (new Date().getDay() + 6) % 7;
    const todayH = buildHabits.filter(h => (h.days || [0,1,2,3,4]).includes(todayDow));
    const doneToday = todayH.filter(h => !!log[today]?.[h.id]).length;
    if (buildHabits.length > 0) {
      const streaks = buildHabits.map(h => ({ name: h.name, streak: getHabitStreak(h.id), pct: getHabitPct(h.id) }));
      parts.push(`Звички сьогодні: ${doneToday}/${todayH.length}. Стріки: ${streaks.filter(s => s.streak >= 2).map(s => s.name + '🔥' + s.streak).join(', ') || 'немає'}`);
    }
    if (quitHabits.length > 0) {
      const quitInfo = quitHabits.map(h => {
        const s = getQuitStatus(h.id);
        return `"${h.name}": ${s.streak || 0} дн без зривів`;
      });
      parts.push(`Челенджі: ${quitInfo.join(', ')}`);
    }
    const inbox = JSON.parse(localStorage.getItem('nm_inbox') || '[]');
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    parts.push(`Записів за тиждень: ${inbox.filter(i => i.ts > weekAgo).length}. Задач активних: ${getTasks().filter(t => t.status === 'active').length}`);
  }

  if (tab === 'evening') {
    const moments = JSON.parse(localStorage.getItem('nm_moments') || '[]');
    const todayStr = new Date().toDateString();
    const todayMoments = moments.filter(m => new Date(m.ts).toDateString() === todayStr);
    const summary = JSON.parse(localStorage.getItem('nm_evening_summary') || 'null');
    const hasSummary = summary && new Date(summary.date).toDateString() === todayStr;
    const hour = new Date().getHours();
    parts.push(`Моменти сьогодні: ${todayMoments.length}. Підсумок дня: ${hasSummary ? 'є' : 'ще не записано'}.`);
    if (hour >= 20 && !hasSummary) parts.push('[ВАЖЛИВО] Вечір — підсумок ще не записано.');
    const tasks = getTasks().filter(t => t.status === 'done' && t.updatedAt && Date.now() - t.updatedAt < 24*60*60*1000);
    if (tasks.length > 0) parts.push(`Задач закрито сьогодні: ${tasks.length}`);
  }

  if (tab === 'finance') {
    try { const finCtx = getFinanceContext(); if (finCtx) parts.push(finCtx); } catch(e) {}
  }

  if (tab === 'health') {
    try {
      const cards = JSON.parse(localStorage.getItem('nm_health_cards') || '[]');
      const log = JSON.parse(localStorage.getItem('nm_health_log') || '{}');
      const todayStr = new Date().toISOString().slice(0, 10);
      const todayLog = log[todayStr] || {};
      parts.push(`Карточок здоров'я: ${cards.length}. Сьогодні: енергія ${todayLog.energy || '—'}, сон ${todayLog.sleep || '—'}, біль ${todayLog.pain || '—'}`);
    } catch(e) {}
  }

  if (tab === 'projects') {
    try {
      const projects = JSON.parse(localStorage.getItem('nm_projects') || '[]');
      const active = projects.filter(p => p.status === 'active');
      const paused = projects.filter(p => p.status === 'paused');
      parts.push(`Проектів активних: ${active.length}, на паузі: ${paused.length}, всього: ${projects.length}.`);
      if (active.length > 0) parts.push(`Активні: ${active.slice(0,3).map(p => '"' + p.name + '"').join(', ')}`);
    } catch(e) {}
  }

  return parts.filter(Boolean).join('\n\n');
}

function checkTabBoardTrigger(tab) {
  if (tab === 'tasks') {
    const tasks = getTasks().filter(t => t.status === 'active');
    if (tasks.length === 0) return false;
    const now = Date.now();
    const stuck = tasks.filter(t => t.createdAt && (now - t.createdAt) > 3 * 24 * 60 * 60 * 1000);
    return stuck.length > 0;
  }
  if (tab === 'notes') return getNotes().length > 0;
  if (tab === 'me') return getHabits().length > 0 || getTasks().length > 0;
  if (tab === 'evening') return true;
  if (tab === 'finance') {
    try { return getFinance().length > 0; } catch { return false; }
  }
  if (tab === 'health') {
    try { return JSON.parse(localStorage.getItem('nm_health_cards') || '[]').length > 0; } catch { return false; }
  }
  if (tab === 'projects') {
    try { return JSON.parse(localStorage.getItem('nm_projects') || '[]').length > 0; } catch { return false; }
  }
  return true;
}

let _boardGenerating = {};

// ============================================================
// generateBoardMessage — ЄДИНА функція генерації повідомлення табло
// Працює для БУДЬ-якої вкладки включно з inbox
// ============================================================
export async function generateBoardMessage(tab) {
  if (_boardGenerating[tab]) return;
  const key = localStorage.getItem('nm_gemini_key');
  if (!key) return;
  _boardGenerating[tab] = true;

  const isInbox = tab === 'inbox';

  // Контекст: inbox має свій збирач, решта — спільний
  const context = isInbox ? getOwlBoardContext() : getTabBoardContext(tab);

  // Історія повідомлень: inbox і вкладки мають різні сховища
  const allMsgs = isInbox ? getOwlBoardMessages() : getTabBoardMsgs(tab);
  const existing = allMsgs[0] || null;
  const recentText = existing ? existing.text : '';
  const recentTexts = allMsgs.slice(0, 5).map(m => m.text).join(' | ');
  const boardHistory = allMsgs.slice(0, 20).map(m => {
    const ago = Date.now() - (m.ts || m.id || 0);
    const hours = Math.floor(ago / 3600000);
    const when = hours < 1 ? 'щойно' : hours < 24 ? hours + ' год тому' : Math.floor(hours / 24) + ' дн тому';
    return `[${when}] ${m.text}`;
  }).join('\n');

  const tabLabels = { inbox: 'Inbox', tasks: 'Продуктивність', notes: 'Нотатки', me: 'Я', evening: 'Вечір', finance: 'Фінанси', health: 'Здоров\'я', projects: 'Проекти' };
  const phase = getDayPhase();
  const timeStr = new Date().toLocaleTimeString('uk-UA', {hour:'2-digit', minute:'2-digit'});
  const phaseInstr = {
    morning: 'Ранок — твоя роль: надихнути і допомогти сфокусуватись на головному.',
    work:    'Робочий час — твоя роль: тримати в курсі прогресу, м\'яко нагадувати про незавершене.',
    evening: 'Вечір — твоя роль: допомогти підбити підсумок дня, не пропустити стріки.',
    night:   'Ніч — говори тільки про критичне. Дуже коротко.',
  };

  const systemPrompt = getOWLPersonality() + `

Зараз: ${timeStr}. ${phaseInstr[phase] || ''}

Ти пишеш КОРОТКЕ проактивне повідомлення для табло${isInbox ? ' в Inbox' : ' у вкладці "' + (tabLabels[tab] || tab) + '"'}. Це НЕ відповідь на запит — це твоя ініціатива.

ТВОЇ ПОПЕРЕДНІ ПОВІДОМЛЕННЯ (пам'ятай що вже казав, будуй діалог, не повторюйся):
${boardHistory || '(ще нічого не казав)'}

ЩО ТИ ЗНАЄШ ПРО КОРИСТУВАЧА (використовуй для персоналізації — чіпи і поради мають враховувати хто ця людина):
${localStorage.getItem('nm_memory') || '(ще не знаю)'}

ПРІОРИТЕТ ПОВІДОМЛЕНЬ:
1. Якщо є [КРИТИЧНО] — пиши ТІЛЬКИ про це. Нічого іншого.
2. Якщо є [ВАЖЛИВО] і немає [КРИТИЧНО] — пиши про перше [ВАЖЛИВО].
3. Якщо є [ФАЗА] але немає критичного/важливого — коротке повідомлення відповідно до фази дня.
4. Інакше — обери найцікавіше зі звичайних даних.

ПРАВИЛА:
- Максимум 2 речення. Коротко і конкретно.
- Говори ЛЮДСЬКОЮ мовою. НЕ використовуй жаргон: "стрік", "streak", "трекер", "прогрес задач". ${isInbox ? 'Замість "стрік під загрозою" кажи "ти вже 5 днів підряд бігав — не зупиняйся, біжи і сьогодні". Замість "3 задачі відкриті" кажи конкретно що це за задачі.' : 'Кажи конкретно і зрозуміло що відбувається — як друг, не як програма.'}
- Використовуй ТІЛЬКИ факти з контексту нижче. НЕ вигадуй ліміти, суми, плани або звички яких немає в даних.
- НЕ повторюй те що вже казав: "${recentTexts || 'нічого'}"
- Відповідай ТІЛЬКИ JSON: ${CHIP_JSON_FORMAT}
${CHIP_PROMPT_RULES}
- Відповідай українською.`;

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Дані: ${context}` }
        ],
        max_tokens: 150,
        temperature: 0.8
      })
    });
    const data = await res.json();
    const reply = data.choices?.[0]?.message?.content?.trim();
    if (!reply) { _boardGenerating[tab] = false; return; }
    const parsed = JSON.parse(reply.replace(/```json|```/g, '').trim());
    if (!parsed.text) { _boardGenerating[tab] = false; return; }

    // Збереження: inbox і вкладки мають різні сховища
    const newMsg = { text: parsed.text, priority: parsed.priority || 'normal', chips: parsed.chips || [], ts: Date.now() };
    if (isInbox) {
      newMsg.id = Date.now();
      const msgs = getOwlBoardMessages();
      msgs.unshift(newMsg);
      saveOwlBoardMessages(msgs.slice(0, 3));
      localStorage.setItem('nm_owl_board_ts', Date.now().toString());
      setOwlCd('phase_pulse');
    } else {
      saveTabBoardMsg(tab, newMsg);
      localStorage.setItem(getOwlTabTsKey(tab), Date.now().toString());
    }

    // Дублюємо проактивне повідомлення в чат-бар
    try {
      const chatKey = 'nm_chat_' + tab;
      const chatMsgs = JSON.parse(localStorage.getItem(chatKey) || '[]');
      chatMsgs.push({ role: 'agent', text: '🦉 ' + parsed.text, ts: Date.now() });
      localStorage.setItem(chatKey, JSON.stringify(chatMsgs));
      restoreChatUI(tab);
    } catch(e) {}

    // Рендер
    if (isInbox) renderOwlBoard();
    else renderTabBoard(tab);
  } catch(e) {}
  _boardGenerating[tab] = false;
}

export function tryTabBoardUpdate(tab) {
  if (tab === 'inbox') return;
  // Скидаємо стан до speech при кожному переключенні вкладки
  if (_owlTabStates[tab] && _owlTabStates[tab] !== 'speech') {
    _owlTabStates[tab] = 'speech';
    _owlTabApplyState(tab);
  }
  renderTabBoard(tab); // завжди показуємо збережені дані
  const hour = new Date().getHours();
  if (hour < 5) return; // тихі години — генерація пропускається
  // Вечірнє табло — "підсумок дня" не має сенсу зранку; генеруємо лише після 12:00
  if (tab === 'evening' && hour < 12) return;
  const lastTs = parseInt(localStorage.getItem(getOwlTabTsKey(tab)) || '0');
  const elapsed = Date.now() - lastTs;
  const isNewDay = lastTs > 0 && new Date(lastTs).toDateString() !== new Date().toDateString();
  const firstTime = lastTs === 0;
  if (firstTime || isNewDay || (elapsed > OWL_TAB_BOARD_MIN_INTERVAL && checkTabBoardTrigger(tab))) {
    generateBoardMessage(tab);
  }
}

// === Єдиний реактивний listener для ВСІХ вкладок (включно з inbox) ===
let _boardUpdateTimer = null;
const BOARD_UPDATE_DELAY = 3000;

window.addEventListener('nm-data-changed', () => {
  if (_boardUpdateTimer) clearTimeout(_boardUpdateTimer);
  _boardUpdateTimer = setTimeout(() => {
    _boardUpdateTimer = null;
    const tab = currentTab || 'inbox';
    const phase = getDayPhase();
    if (phase !== 'silent') generateBoardMessage(tab);
  }, BOARD_UPDATE_DELAY);
});

// No window globals needed — all consumed via imports
