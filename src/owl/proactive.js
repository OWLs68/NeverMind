import { getAIContext, getOWLPersonality, restoreChatUI, loadChatMsgs } from '../ai/core.js';
import { getRecentActions } from '../core/utils.js';
import { currentTab } from '../core/nav.js';
import { OWL_TAB_BOARD_MIN_INTERVAL, _owlTabApplyState, _owlTabStates, getOwlTabTsKey, getTabBoardMsgs, renderTabBoard, saveTabBoardMsg } from './board.js';
import { getDayPhase, getOwlBoardContext, getOwlBoardMessages, saveOwlBoardMessages, setOwlCd, renderOwlBoard, shouldOwlSpeak } from './inbox-board.js';
import { CHIP_PROMPT_RULES, CHIP_JSON_FORMAT, getChipStatsForPrompt } from './chips.js';
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
// _extractBannedWords — витягує ключові слова з останніх повідомлень
// для явної заборони в промпті (GPT-4o-mini краще реагує на конкретику)
// ============================================================
function _extractBannedWords(msgs) {
  if (!msgs || msgs.length === 0) return '';
  const stopWords = new Set(['що','які','яка','який','яке','для','при','або','але','цей','ця','це','той','та','те','вже','ще','так','ні','не','без','над','під','між','через','коли','тому','якщо','було','буде','має','треба','можна','можеш','сьогодні','вчора','завтра','зараз','потім','добре','гарно','давай','може','ось','там','тут','дуже','всі','все','його','її','вони','тобі','тебе','мені','нас','час','день','дні','раз','ти','він','вона','як']);
  const words = new Set();
  for (const m of msgs) {
    const text = (m.text || '').toLowerCase().replace(/[^\wа-яіїєґ'\s]/g, '');
    for (const w of text.split(/\s+/)) {
      if (w.length >= 4 && !stopWords.has(w)) words.add(w);
    }
  }
  return [...words].slice(0, 15).join(', ');
}

// ============================================================
// _isTooSimilar — перевіряє чи нове повідомлення надто схоже на останні
// Повертає true якщо overlap ключових слів > 60%
// ============================================================
function _isTooSimilar(newText, recentMsgs) {
  if (!recentMsgs || recentMsgs.length === 0) return false;
  const getWords = (t) => {
    const ws = (t || '').toLowerCase().replace(/[^\wа-яіїєґ'\s]/g, '').split(/\s+/).filter(w => w.length >= 4);
    return new Set(ws);
  };
  const newWords = getWords(newText);
  if (newWords.size === 0) return false;
  for (const m of recentMsgs.slice(0, 3)) {
    const oldWords = getWords(m.text);
    if (oldWords.size === 0) continue;
    let overlap = 0;
    for (const w of newWords) { if (oldWords.has(w)) overlap++; }
    if (overlap / newWords.size > 0.6) return true;
  }
  return false;
}

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

  // Останні повідомлення з чату — щоб табло знало що обговорювалось
  const chatMsgs = loadChatMsgs(tab);
  const recentChat = chatMsgs.slice(-30).map(m => {
    const ago = Date.now() - (m.ts || 0);
    const mins = Math.floor(ago / 60000);
    const when = mins < 1 ? 'щойно' : mins < 60 ? mins + ' хв тому' : Math.floor(mins / 60) + ' год тому';
    const who = m.role === 'agent' ? 'агент' : 'юзер';
    return `[${when}] ${who}: ${m.text}`;
  }).join('\n');

  // Крос-контекст: останні дії з ІНШИХ вкладок
  const crossActions = getRecentActions()
    .filter(a => a.tab !== tab && (Date.now() - a.ts) < 30 * 60 * 1000) // тільки за останні 30 хв, з інших вкладок
    .slice(-5)
    .map(a => {
      const mins = Math.floor((Date.now() - a.ts) / 60000);
      const when = mins < 1 ? 'щойно' : mins + ' хв тому';
      return `[${when}] ${a.action}: "${a.title}" (${a.tab})`;
    }).join('\n');

  const tabLabels = { inbox: 'Inbox', tasks: 'Продуктивність', notes: 'Нотатки', me: 'Я', evening: 'Вечір', finance: 'Фінанси', health: 'Здоров\'я', projects: 'Проекти' };
  const phase = getDayPhase();
  const timeStr = new Date().toLocaleTimeString('uk-UA', {hour:'2-digit', minute:'2-digit'});
  const phaseInstr = {
    dawn:    'Ранній ранок — юзер прокинувся раніше звичного. Привітай м\'яко, допоможи почати день.',
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

ОСТАННІ ПОВІДОМЛЕННЯ З ЧАТУ (враховуй що вже обговорювали, не повторюй і не суперечь):
${recentChat || '(чат порожній)'}
${crossActions ? `
НЕЩОДАВНІ ДІЇ НА ІНШИХ ВКЛАДКАХ (враховуй загальний контекст — що відбувається в житті юзера):
${crossActions}` : ''}

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
- НЕ повторюй те що вже казав. ЗАБОРОНЕНІ слова (вже використані в останніх повідомленнях, ОБОВ'ЯЗКОВО обери ІНШУ тему): ${_extractBannedWords(allMsgs.slice(0, 3)) || 'немає'}.
- ЕМПАТІЯ: якщо в чаті або моментах є слова-маркери ("втомився", "не можу", "забив", "погано", "зле", "хворію", "важко", "дістало") — реагуй ВІДПОВІДНО ДО СВОГО ХАРАКТЕРУ: Coach — визнай що важко, але підштовхни зробити хоча б мінімум ("Тяжко? Ок. Але одну дрібницю закрий — потім легше"). Partner — м'яка підтримка, дозволь відпочити ("Відпочинь, задачі почекають"). Mentor — запитай причину, допоможи розібратись ("Що саме виснажило? Може переглянемо пріоритети?").
- Відповідай ТІЛЬКИ JSON: ${CHIP_JSON_FORMAT}
${CHIP_PROMPT_RULES}
${getChipStatsForPrompt() ? '- ' + getChipStatsForPrompt() : ''}
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
    if (!res.ok) {
      const errDetail = `HTTP ${res.status} ${res.statusText}`;
      console.warn('[OWL board] API error:', errDetail);
      localStorage.setItem('nm_owl_api_error', errDetail + ' @ ' + new Date().toLocaleTimeString('uk-UA'));
      _tryLocalFallback(tab);
      _boardGenerating[tab] = false;
      return;
    }
    const data = await res.json();
    const reply = data.choices?.[0]?.message?.content?.trim();
    if (!reply) {
      const errDetail = 'empty reply: ' + JSON.stringify(data?.error || {}).slice(0, 150);
      console.warn('[OWL board]', errDetail);
      localStorage.setItem('nm_owl_api_error', errDetail + ' @ ' + new Date().toLocaleTimeString('uk-UA'));
      _tryLocalFallback(tab);
      _boardGenerating[tab] = false;
      return;
    }
    // Очищуємо помилку — API працює
    localStorage.removeItem('nm_owl_api_error');
    const parsed = JSON.parse(reply.replace(/```json|```/g, '').trim());
    if (!parsed.text) { _boardGenerating[tab] = false; return; }

    // Антиповтор: якщо нове повідомлення надто схоже на останні — відкидаємо
    // Виняток: якщо табло застаріло (30+ хв) — краще схоже нове ніж неправильне старе
    const lastBoardTs = parseInt(localStorage.getItem(isInbox ? 'nm_owl_board_ts' : getOwlTabTsKey(tab)) || '0');
    const boardStale = Date.now() - lastBoardTs > 30 * 60 * 1000;
    if (!boardStale && _isTooSimilar(parsed.text, allMsgs)) {
      console.warn('[OWL board] similar message rejected:', parsed.text?.slice(0, 50));
      _boardGenerating[tab] = false;
      return;
    }

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

    // Рендер
    if (isInbox) renderOwlBoard();
    else renderTabBoard(tab);
  } catch(e) {
    console.warn('[OWL board] generation error:', e?.message || e);
    // Якщо API впав а повідомлення застаріло — показати локальне fallback
    _tryLocalFallback(tab);
  }
  _boardGenerating[tab] = false;
}

// Розумне fallback-повідомлення з РЕАЛЬНИХ даних коли API не працює
function _tryLocalFallback(tab) {
  if (tab !== 'inbox') return;
  const msgs = getOwlBoardMessages();
  const visibleTs = msgs[0]?.ts || 0;
  if (!visibleTs || Date.now() - visibleTs < 30 * 60 * 1000) return;

  const mode = (JSON.parse(localStorage.getItem('nm_settings') || '{}').owl_mode) || 'partner';
  let text = '';
  const chips = [];
  try {
    const tasks = getTasks().filter(t => t.status === 'active');
    const habits = getHabits();
    const todayStr = new Date().toDateString();
    const habitLog = getHabitLog();
    const todayLog = habitLog[todayStr] || {};
    const dow = new Date().getDay();
    const todayHabits = habits.filter(h => h.type !== 'quit' && (h.days || []).includes(dow));
    const doneH = todayHabits.filter(h => todayLog[h.id]);
    const pendingH = todayHabits.filter(h => !todayLog[h.id]);
    const phase = getDayPhase();

    if (tasks.length > 0 && pendingH.length > 0) {
      text = mode === 'coach'
        ? `Є ${tasks.length} задач і ${pendingH.length} звичок. Давай хоча б одну закриємо.`
        : mode === 'mentor'
        ? `${tasks.length} задач і ${pendingH.length} звичок чекають. З чого почнеш?`
        : `У тебе ${tasks.length} задач і ${pendingH.length} звичок на сьогодні. Тримаєшся?`;
      chips.push({ label: 'Задачі', action: 'nav', target: 'tasks' });
      chips.push({ label: 'Звички', action: 'nav', target: 'habits' });
    } else if (tasks.length > 0) {
      const first = tasks[0].title;
      text = mode === 'coach'
        ? `"${first}" — все ще відкрита. Закриваємо?`
        : mode === 'mentor'
        ? `Задача "${first}" чекає. Є план?`
        : `Є задача "${first}". Як з нею справи?`;
      chips.push({ label: 'Задачі', action: 'nav', target: 'tasks' });
    } else if (pendingH.length > 0) {
      const names = pendingH.slice(0, 2).map(h => h.name).join(' і ');
      text = mode === 'coach'
        ? `Ще жодної звички сьогодні. ${names} — давай хоча б одну.`
        : mode === 'mentor'
        ? `${names} — ще не виконано. Що заважає?`
        : `Залишились ${names}. Встигнеш сьогодні?`;
      chips.push({ label: 'Звички', action: 'nav', target: 'habits' });
    } else if (doneH.length > 0 && tasks.length === 0) {
      text = mode === 'coach'
        ? 'Всі звички закриті. Так тримати.'
        : mode === 'mentor'
        ? 'Все зроблено. Вільний час — як використаєш?'
        : 'Всі звички виконано! Красава 💪';
    } else {
      const greetings = {
        coach:   { dawn:'Ранній підйом. Поважаю.', morning:'Ранок. Що на сьогодні?', work:'Робочий час. Що далі?', evening:'Вечір. Як день?', night:'Пізно. Відпочивай.' },
        partner: { dawn:'Рано встав! Гарного ранку.', morning:'Доброго ранку!', work:'Як робочий день?', evening:'Добрий вечір!', night:'Доброї ночі!' },
        mentor:  { dawn:'Ранній ранок. Тихий час для роздумів.', morning:'Новий день. Що важливе сьогодні?', work:'Робочий час. Все за планом?', evening:'Вечір. Що вдалось сьогодні?', night:'Час відпочинку.' },
      };
      text = (greetings[mode] || greetings.partner)[phase] || 'Привіт!';
    }
  } catch(e) { text = 'Привіт!'; }

  const newMsg = { text, priority: 'normal', chips, ts: Date.now(), id: Date.now() };
  const all = getOwlBoardMessages();
  all.unshift(newMsg);
  saveOwlBoardMessages(all.slice(0, 3));
  localStorage.setItem('nm_owl_board_ts', Date.now().toString());
  renderOwlBoard();
  console.warn('[OWL board] smart fallback:', text);
}

// === Контекстні підказки при першому відвідуванні вкладки ===
const NM_FIRST_VISIT_KEY = 'nm_tab_first_visit';
const TAB_HINTS = {
  tasks: 'Тут живуть твої задачі і звички. Напиши мені що треба зробити — я створю задачу з кроками 📋',
  notes: 'Це твої нотатки. Можеш розкладати по папках. Напиши що хочеш запам\'ятати — я збережу 📝',
  finance: 'Тут фінанси. Скажи скільки витратив — я запишу. Можеш встановити місячний бюджет 💰',
  health: 'Тут про здоров\'я. Додавай картки (ліки, симптоми, аналізи) і щоденні шкали (енергія, сон, біль) 🏥',
  projects: 'Тут великі проекти з кроками і метриками. Скажи "новий проект" — я допоможу створити 🚀',
  evening: 'Тут моменти дня і вечірній підсумок. Записуй що важливого сталося — ввечері підведемо підсумки ✨',
  me: 'Це вкладка "Я" — звички, стріки, статистика. Тут бачиш свій прогрес за тиждень і місяць 📊',
  habits: 'Тут твої звички. Відмічай щодня — будуй серії! Можеш додати нову через чат-бар знизу 🌱',
};

function _showFirstVisitHint(tab) {
  if (!TAB_HINTS[tab]) return false;
  try {
    const visited = JSON.parse(localStorage.getItem(NM_FIRST_VISIT_KEY) || '{}');
    if (visited[tab]) return false;
    // Позначаємо як відвідану
    visited[tab] = Date.now();
    localStorage.setItem(NM_FIRST_VISIT_KEY, JSON.stringify(visited));
    // Показуємо підказку на табло
    const newMsg = { text: TAB_HINTS[tab], priority: 'normal', chips: [], ts: Date.now() };
    saveTabBoardMsg(tab, newMsg);
    renderTabBoard(tab);
    return true;
  } catch(e) { return false; }
}

export function tryTabBoardUpdate(tab) {
  if (tab === 'inbox') return;
  // Скидаємо стан до speech при кожному переключенні вкладки
  if (_owlTabStates[tab] && _owlTabStates[tab] !== 'speech') {
    _owlTabStates[tab] = 'speech';
    _owlTabApplyState(tab);
  }
  // Підказка при першому відвідуванні
  if (_showFirstVisitHint(tab)) return;
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
const BOARD_UPDATE_DELAY = 5000;

// Локальні миттєві реакції — без API, показуються одразу
const INSTANT_REACTIONS = {
  complete_task: [
    'Зроблено! Одна менше 💪',
    'Так тримати! ✅',
    'Закрито! Що далі?',
    'Молодець! Рухаємось далі 🎯',
    'Готово! Ще трішки і все чисто',
  ],
  complete_habit: [
    'Є! Звичка на місці 🔥',
    'Зараховано! Продовжуй серію 💪',
    'Молодець! Крок за кроком',
    'Відмічено! Стабільність — сила ✅',
  ],
  hold_quit_habit: [
    'Тримаєшся! Це головне 💪',
    'Ще один день перемоги! 🔥',
    'Красава! Кожен день рахується',
  ],
  add_moment: [
    'Записав момент ✨',
    'Гарно що фіксуєш!',
  ],
};

function _showInstantReaction(tab) {
  const actions = getRecentActions();
  const now = Date.now();
  // Шукаємо дію за останні 3 сек
  const recent = actions.filter(a => (now - a.ts) < 3000).pop();
  if (!recent) return false;

  const reactions = INSTANT_REACTIONS[recent.action];
  if (!reactions) return false;

  const text = reactions[Math.floor(Math.random() * reactions.length)];
  const isInbox = tab === 'inbox';
  const newMsg = { text, priority: 'normal', chips: [], ts: now };

  if (isInbox) {
    newMsg.id = now;
    const msgs = getOwlBoardMessages();
    msgs.unshift(newMsg);
    saveOwlBoardMessages(msgs.slice(0, 3));
    renderOwlBoard();
  } else {
    saveTabBoardMsg(tab, newMsg);
    renderTabBoard(tab);
  }
  return true;
}

window.addEventListener('nm-data-changed', (e) => {
  const tab = currentTab || 'inbox';

  // Миттєва локальна реакція (без API)
  if (e.detail !== 'chat') _showInstantReaction(tab);

  // Чат-повідомлення НЕ тригерять табло напряму — табло оновиться при закритті чату
  if (e.detail === 'chat') return;
  const trigger = 'data-changed';

  // Відкладена AI-генерація — тільки якщо Judge Layer дозволяє
  if (_boardUpdateTimer) clearTimeout(_boardUpdateTimer);
  _boardUpdateTimer = setTimeout(() => {
    _boardUpdateTimer = null;
    const judge = shouldOwlSpeak(trigger);
    if (judge.speak) generateBoardMessage(currentTab || 'inbox');
  }, BOARD_UPDATE_DELAY);
});

// === Chat Closed — табло оновлюється після закриття чату ===
window.addEventListener('nm-chat-closed', () => {
  setTimeout(() => {
    const judge = shouldOwlSpeak('chat-closed');
    if (judge.speak) generateBoardMessage(currentTab || 'inbox');
  }, 3000); // 3 сек затримка після закриття чату
});

// === Welcome Back — привітання при поверненні в додаток ===
const NM_LAST_ACTIVE_KEY = 'nm_last_active';
const WELCOME_BACK_THRESHOLD = 2 * 60 * 60 * 1000; // 2 години

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    localStorage.setItem(NM_LAST_ACTIVE_KEY, Date.now().toString());
  } else if (document.visibilityState === 'visible') {
    const lastActive = parseInt(localStorage.getItem(NM_LAST_ACTIVE_KEY) || '0');
    if (!lastActive) return;
    const away = Date.now() - lastActive;
    if (away > WELCOME_BACK_THRESHOLD) {
      const judge = shouldOwlSpeak('welcome-back');
      if (judge.speak) generateBoardMessage(currentTab || 'inbox');
    }
  }
});

// No window globals needed — all consumed via imports
