import { getAIContext, getOWLPersonality, restoreChatUI, loadChatMsgs, _isNetworkError, getRecentChatsAcrossTabs } from '../ai/core.js';
import { formatFactsForBoard } from '../ai/memory.js';
import { getRecentActions } from '../core/utils.js';
import { currentTab } from '../core/nav.js';
import { OWL_TAB_BOARD_MIN_INTERVAL, _owlTabApplyState, _owlTabStates, getOwlTabTsKey, getTabBoardMsgs, renderTabBoard, saveTabBoardMsg } from './board.js';
import { getDayPhase, getSchedule, getOwlBoardMessages, saveOwlBoardMessages, setOwlCd, owlCdExpired, renderOwlBoard, shouldOwlSpeak, tryOwlBoardUpdate } from './inbox-board.js';
import { CHIP_PROMPT_RULES, CHIP_JSON_FORMAT, getChipStatsForPrompt } from './chips.js';
import { getTasks } from '../tabs/tasks.js';
import { getHabits, getHabitLog, getHabitPct, getHabitStreak, getQuitStatus } from '../tabs/habits.js';
import { getNotes } from '../tabs/notes.js';
import { getFinance, getFinanceContext, getFinBudget, getFinPeriodRange, formatMoney } from '../tabs/finance.js';
import { getEveningMood } from '../tabs/evening.js';
import { logUsage } from '../core/usage-meter.js';

// Толерантний JSON парсер — якщо звичайний JSON.parse впав, витягує {...} або [...] блок з тексту.
// Страховка на випадок якщо AI все ж поверне звичайний текст з JSON всередині попри response_format.
function _parseJsonTolerant(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const cleaned = raw.replace(/```json|```/g, '').trim();
  try { return JSON.parse(cleaned); } catch {}
  // Спроба витягти {...} блок
  const objMatch = cleaned.match(/\{[\s\S]*\}/);
  if (objMatch) { try { return JSON.parse(objMatch[0]); } catch {} }
  // Спроба витягти [...] блок
  const arrMatch = cleaned.match(/\[[\s\S]*\]/);
  if (arrMatch) { try { return JSON.parse(arrMatch[0]); } catch {} }
  return null;
}

export function getTabBoardContext(tab) {
  const parts = [];
  try { const ctx = getAIContext(); if (ctx) parts.push(ctx); } catch(e) {}

  if (tab === 'tasks') {
    const tasks = getTasks();
    const active = tasks.filter(t => t.status === 'active');
    const now = Date.now();
    const stuck = active.filter(t => t.createdAt && (now - t.createdAt) > 3 * 24 * 60 * 60 * 1000);
    if (stuck.length > 0) parts.push(`[ВАЖЛИВО] Задачі без прогресу 3+ дні: ${stuck.map(t => '"' + t.title + '" [task_' + t.id + ']').join(', ')}`);
    parts.push(`Активних задач: ${active.length}, закрито: ${tasks.filter(t => t.status === 'done').length}`);
    if (active.length > 0) {
      parts.push(`Усі активні задачі: ${active.slice(0, 10).map(t => '"' + t.title + '" [task_' + t.id + ']').join(', ')}.`);
    }
    // Блок "Нещодавно ЗАКРИТІ" видалено у Фазі 3 (UVKL1 27.04). Pruning Engine
    // (Фаза 2) уже структурно забезпечує що сова не бачить старих повідомлень
    // про закриті задачі — промптові правила "НЕ нагадуй" небезпечні (модель
    // інерційно цитує сама себе). У чатах блок лишається через getAIContext.
    // Quit звички
    const allHabits = getHabits();
    const quitHabits = allHabits.filter(h => h.type === 'quit');
    if (quitHabits.length > 0) {
      const todayStr = new Date().toISOString().slice(0, 10);
      const quitInfo = quitHabits.map(h => {
        const s = getQuitStatus(h.id);
        const heldToday = s.lastHeld === todayStr;
        return `"${h.name}" [habit_${h.id}]: стрік ${s.streak || 0} дн${heldToday ? ' ✓' : ' (не відмічено сьогодні)'}`;
      });
      parts.push(`Челенджі "Кинути": ${quitInfo.join('; ')}`);
      const notHeld = quitHabits.filter(h => getQuitStatus(h.id).lastHeld !== todayStr);
      if (notHeld.length > 0) parts.push(`[ВАЖЛИВО] Не відмічено сьогодні: ${notHeld.map(h => '"' + h.name + '" [habit_' + h.id + ']').join(', ')}`);
    }
  }

  if (tab === 'notes') {
    const notes = getNotes();
    const byFolder = {};
    notes.forEach(n => { const f = n.folder || 'Загальне'; byFolder[f] = (byFolder[f] || 0) + 1; });
    parts.push(`Нотатки: ${notes.length} записів. Папки: ${Object.entries(byFolder).map(([f, c]) => f + '(' + c + ')').join(', ') || 'немає'}`);
    // Найсвіжіші 5 нотаток з ID — щоб табло могло посилатись на конкретну і відстежувати релевантність
    const recent = notes.slice(0, 5);
    if (recent.length > 0) {
      parts.push(`Останні нотатки: ${recent.map(n => '"' + (n.title || (n.text || '').slice(0,30)) + '" [note_' + n.id + ']').join(', ')}.`);
    }
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
      const streaks = buildHabits.map(h => ({ id: h.id, name: h.name, streak: getHabitStreak(h.id), pct: getHabitPct(h.id) }));
      parts.push(`Звички сьогодні: ${doneToday}/${todayH.length}. Стріки: ${streaks.filter(s => s.streak >= 2).map(s => s.name + ' [habit_' + s.id + ']🔥' + s.streak).join(', ') || 'немає'}`);
      const pendingToday = todayH.filter(h => !log[today]?.[h.id]);
      if (pendingToday.length > 0) {
        parts.push(`Не виконано сьогодні: ${pendingToday.map(h => '"' + h.name + '" [habit_' + h.id + ']').join(', ')}.`);
      }
    }
    if (quitHabits.length > 0) {
      const quitInfo = quitHabits.map(h => {
        const s = getQuitStatus(h.id);
        return `"${h.name}" [habit_${h.id}]: ${s.streak || 0} дн без зривів`;
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
      parts.push(`Карточок здоров'я: ${cards.length}.`);
    } catch(e) {}
  }

  if (tab === 'projects') {
    try {
      const projects = JSON.parse(localStorage.getItem('nm_projects') || '[]');
      const active = projects.filter(p => p.status === 'active');
      const paused = projects.filter(p => p.status === 'paused');
      parts.push(`Проектів активних: ${active.length}, на паузі: ${paused.length}, всього: ${projects.length}.`);
      if (active.length > 0) parts.push(`Активні: ${active.slice(0,5).map(p => '"' + p.name + '" [project_' + p.id + ']').join(', ')}`);
    } catch(e) {}
  }

  return parts.filter(Boolean).join('\n\n');
}

// === ЄДИНИЙ API для збору контексту табло (Фаза 1.1) ===
// Один мозок — одна точка збору контексту для будь-якої вкладки.
// Inbox має свій повний контекст (нагадування, ранковий бриф, вечірній пульс тощо),
// решта вкладок — специфічний + загальний getAIContext().
export function getBoardContext(tab) {
  if (tab === 'inbox') return _getInboxBoardContext();
  return getTabBoardContext(tab);
}

// Повний контекст для Inbox-табло — нагадування, фази дня, ранковий бриф,
// вечірній пульс, задачі з тригерами, звички, quit-челенджі, фінанси, анкетування.
// Перенесено з getOwlBoardContext (inbox-board.js) у межах Фази 1.1.
function _getInboxBoardContext() {
  const now = new Date();
  const todayStr = now.toDateString();
  const hour = now.getHours();
  const min = now.getMinutes();
  const weekDay = now.getDay();
  const phase = getDayPhase();
  const sc = getSchedule();
  const critical = [];
  const important = [];
  const normal = [];

  // Нагадування що настали
  try {
    const reminders = JSON.parse(localStorage.getItem('nm_reminders') || '[]');
    const todayISO = now.toISOString().slice(0, 10);
    const nowTime = `${String(hour).padStart(2,'0')}:${String(min).padStart(2,'0')}`;
    const due = reminders.filter(r => !r.done && r.date === todayISO && r.time <= nowTime);
    if (due.length > 0) {
      due.forEach(r => critical.push(`[КРИТИЧНО] ⏰ НАГАДУВАННЯ (${r.time}): "${r.text}". Скажи це юзеру ЗАРАЗ!`));
      const updated = reminders.map(r => due.find(d => d.id === r.id) ? { ...r, done: true } : r);
      localStorage.setItem('nm_reminders', JSON.stringify(updated));
    }
    const upcoming = reminders.filter(r => !r.done && r.date === todayISO && r.time > nowTime).sort((a, b) => a.time.localeCompare(b.time));
    if (upcoming.length > 0) {
      const next = upcoming[0];
      const [nh, nm] = next.time.split(':').map(Number);
      const minsUntil = nh * 60 + nm - (hour * 60 + min);
      if (minsUntil <= 30) important.push(`[СКОРО] ⏰ Нагадування о ${next.time}: "${next.text}" (через ${minsUntil} хв)`);
    }
  } catch(e) {}

  // Фаза дня — інструкція для агента
  const phaseLabels = {
    morning: `[ФАЗА: РАНОК] Час планування. Фокус: пріоритети на день, мотивація, що найважливіше зробити. Підйом о ${sc.wakeUp}:00, активний день починається о ${sc.workStart}:00.`,
    work:    `[ФАЗА: РОБОТА] Активний час. Фокус: прогрес задач, виконання звичок, поточний стан.`,
    evening: `[ФАЗА: ВЕЧІР] Час підсумків. Фокус: що зроблено, які звички ще не виконані, підготовка до завтра. Робота завершується о ${sc.workEnd}:00.`,
    night:   `[ФАЗА: НІЧ] Тихий час. Тільки критичне — звички які можна ще встигнути виконати. Коротко.`,
  };
  if (phaseLabels[phase]) normal.push(phaseLabels[phase]);

  normal.push(`Зараз ${now.toLocaleTimeString('uk-UA', {hour:'2-digit',minute:'2-digit'})}.`);

  // Задачі
  const tasks = getTasks();
  const activeTasks = tasks.filter(t => t.status === 'active');

  // Блок "Нещодавно ЗАКРИТІ задачі" видалено у Фазі 3 (UVKL1 27.04).
  // Pruning Engine (Фаза 2) уже забезпечує що сова не бачить старих повідомлень
  // про закриті задачі. Чат-контекст getAIContext має блок recentlyClosedTasks
  // окремо — там промптовий "не нагадуй" не потрібен бо чат відповідає на
  // запит юзера (а не ініціативно нагадує).

  // === РАНКОВИЙ БРИФ ===
  if (phase === 'morning' && owlCdExpired('morning_brief_ctx', 3 * 60 * 60 * 1000)) {
    const todayDow = now.getDay();
    const todayHabitsAll = getHabits().filter(h => h.type !== 'quit' && (h.days || [0,1,2,3,4]).includes(todayDow));
    const briefParts = [];
    if (activeTasks.length > 0) briefParts.push(`Задачі на сьогодні: ${activeTasks.slice(0, 5).map(t => '"' + t.title + '" [task_' + t.id + ']').join(', ')}`);
    if (todayHabitsAll.length > 0) briefParts.push(`Звички: ${todayHabitsAll.map(h => h.name + ' [habit_' + h.id + ']').join(', ')}`);
    const quitHabitsAll = getHabits().filter(h => h.type === 'quit');
    if (quitHabitsAll.length > 0) {
      const quitInfo = quitHabitsAll.map(h => { const s = getQuitStatus(h.id); return `"${h.name}" [habit_${h.id}]: ${s.streak || 0} дн`; });
      briefParts.push(`Челенджі: ${quitInfo.join(', ')}`);
    }
    if (briefParts.length > 0) important.push(`[РАНКОВИЙ БРИФ] Зведення на день:\n${briefParts.join('\n')}\nЗгадай що головне сьогодні і мотивуй коротко.`);
  }

  // === ВЕЧІРНІЙ ПУЛЬС ===
  if ((phase === 'evening' || phase === 'night') && owlCdExpired('evening_pulse_ctx', 4 * 60 * 60 * 1000)) {
    const doneTasks = tasks.filter(t => t.status === 'done' && t.updatedAt && Date.now() - t.updatedAt < 24*60*60*1000);
    const todayDow = now.getDay();
    const todayHabitsAll = getHabits().filter(h => h.type !== 'quit' && (h.days || [0,1,2,3,4]).includes(todayDow));
    const todayLogAll = getHabitLog()[todayStr] || {};
    const doneH = todayHabitsAll.filter(h => todayLogAll[h.id]).length;
    const moments = JSON.parse(localStorage.getItem('nm_moments') || '[]');
    const todayMoments = moments.filter(m => new Date(m.ts).toDateString() === todayStr);
    const summary = JSON.parse(localStorage.getItem('nm_evening_summary') || 'null');
    const hasSummary = summary && new Date(summary.date).toDateString() === todayStr;
    const pulseParts = [];
    pulseParts.push(`Задач закрито сьогодні: ${doneTasks.length}`);
    pulseParts.push(`Звичок: ${doneH}/${todayHabitsAll.length}`);
    if (todayMoments.length > 0) pulseParts.push(`Моментів записано: ${todayMoments.length}`);
    if (!hasSummary) pulseParts.push('Підсумок дня ще не записано');
    const eMood = getEveningMood();
    if (eMood) {
      const ml = { bad:'😔 погано', meh:'😐 так собі', ok:'🙂 нормально', good:'😄 добре', fire:'🔥 чудово' };
      pulseParts.push(`Настрій дня (обрав юзер): ${ml[eMood] || eMood}`);
    }
    important.push(`[ВЕЧІРНІЙ ПУЛЬС] Як пройшов день:\n${pulseParts.join('\n')}\nАдаптуй тон під настрій. Запитай юзера як день або підведи підсумок.`);
  }

  // Дедлайн через ~годину
  const urgent = activeTasks.filter(t => {
    const m = t.title.match(/(\d{1,2}):(\d{2})/);
    if (!m) return false;
    const diff = (parseInt(m[1])*60+parseInt(m[2])) - (hour*60+min);
    return diff > 0 && diff <= 65;
  });
  urgent.forEach(t => {
    critical.push(`[КРИТИЧНО] Дедлайн через ~годину: "${t.title}" [task_${t.id}].`);
  });

  // Прострочені задачі (dueDate вчора або раніше) — Smart Boot-up (3.6)
  // Формулювання БЕЗ "де ти був?" — просто що накопичилось.
  const todayISOLocal = now.toISOString().slice(0, 10);
  const overdue = activeTasks.filter(t => t.dueDate && t.dueDate < todayISOLocal);
  if (overdue.length > 0) {
    overdue.slice(0, 3).forEach(t => {
      const days = Math.floor((Date.parse(todayISOLocal) - Date.parse(t.dueDate)) / (24*60*60*1000));
      critical.push(`[ПРОСТРОЧЕНО] Задача "${t.title}" [task_${t.id}] — дедлайн минув ${days === 0 ? 'сьогодні' : days + ' дн тому'}. Запропонуй розбити на кроки, перенести або дропнути. БЕЗ докорів типу "ти не встиг".`);
    });
  }

  // Задача завʼязла 3+ дні
  const stuckDays3 = activeTasks.filter(t => t.createdAt && t.createdAt < Date.now() - 3*24*60*60*1000 && t.createdAt >= Date.now() - 5*24*60*60*1000);
  stuckDays3.forEach(t => {
    important.push(`[ВАЖЛИВО] Задача "${t.title}" [task_${t.id}] відкрита вже 3+ дні.`);
  });

  // Забуті задачі 5+ днів — м'яке питання чи ще актуально
  const forgotten = activeTasks.filter(t => t.createdAt && t.createdAt < Date.now() - 5*24*60*60*1000);
  forgotten.forEach(t => {
    const days = Math.floor((Date.now() - t.createdAt) / (24*60*60*1000));
    important.push(`[ЗАБУТА ЗАДАЧА] "${t.title}" [task_${t.id}] висить ${days} днів. М'яко запитай чи ще актуально — може видалити або переформулювати?`);
  });

  // Прокрастинація — задачі з 3+ переносами дедлайну (3.8)
  // Формулювання БЕЗ пасивної агресії ("ти знову не виконав" ЗАБОРОНЕНО).
  const reshuffled = activeTasks.filter(t => (t.rescheduleCount || 0) >= 3);
  reshuffled.forEach(t => {
    important.push(`[ПРОКРАСТИНАЦІЯ] Задача "${t.title}" [task_${t.id}] переноситься ${t.rescheduleCount}-й раз. Юзеру важко її зрушити — запропонуй або розбити на кроки, або дропнути. Чіпи: "Розбити на кроки" (chat) і "Видалити задачу" (chat). БЕЗ осуду — це не "ти знову не виконав", а "можливо задача занадто велика або не на часі".`);
  });

  if (activeTasks.length > 0) {
    normal.push(`Відкритих задач: ${activeTasks.length}. ${activeTasks.slice(0,3).map(t => '"' + t.title + '" [task_' + t.id + ']').join(', ')}${activeTasks.length>3?' і ще...':''}.`);
  } else {
    normal.push('Всі задачі виконано.');
  }

  // Оптимальний темп (3.13) — 20% від активних якщо юзер не задав ціль.
  // Якщо у пам'яті є факт про комфортний темп — AI побачить його через formatFactsForContext і використає.
  if (activeTasks.length >= 3) {
    const suggested = Math.max(1, Math.round(activeTasks.length * 0.2));
    const doneTodayCount = tasks.filter(t => t.status === 'done' && t.completedAt && (Date.now() - t.completedAt) < 24 * 60 * 60 * 1000).length;
    normal.push(`[ТЕМП] Оптимально сьогодні: ~${suggested} задач (20% від активних). Закрито: ${doneTodayCount}. Якщо у пам'яті є факт про комфортний темп — використовуй його замість 20%-формули.`);
  }

  // Звички
  const habits = getHabits();
  const buildHabits = habits.filter(h => h.type !== 'quit');
  const quitHabits = habits.filter(h => h.type === 'quit');
  const log = getHabitLog();
  const todayLog = log[todayStr] || {};
  const todayHabits = buildHabits.filter(h => h.days.includes(now.getDay()));
  const doneHabits = todayHabits.filter(h => todayLog[h.id]);
  const pendingHabits = todayHabits.filter(h => !todayLog[h.id]);

  // Всі звички виконані
  if (todayHabits.length > 0 && pendingHabits.length === 0) {
    important.push(`[ВАЖЛИВО] Всі ${todayHabits.length} звичок виконано сьогодні!`);
  }

  // Звички з серією під загрозою ввечері
  if ((phase === 'evening' || phase === 'night') && pendingHabits.length > 0) {
    const atRisk = pendingHabits.filter(h => {
      const streak = Object.values(log).filter(d => d[h.id]).length;
      return streak >= 3;
    });
    if (atRisk.length > 0) {
      const details = atRisk.map(h => {
        const streak = Object.values(log).filter(d => d[h.id]).length;
        return `"${h.name}" [habit_${h.id}] (вже ${streak} днів підряд, сьогодні ще не виконано)`;
      });
      critical.push(`[КРИТИЧНО] Звички з серією під загрозою — день закінчується а ти ще не зробив: ${details.join(', ')}.`);
    }
  }

  // Звички не виконані в робочий час або вечір
  if ((phase === 'work' || phase === 'evening') && pendingHabits.length > 0) {
    important.push(`[ВАЖЛИВО] Не виконано звичок: ${pendingHabits.map(h => h.name + ' [habit_' + h.id + ']').join(', ')}.`);
  }

  if (todayHabits.length > 0) {
    normal.push(`Звички сьогодні: ${doneHabits.length}/${todayHabits.length}.`);
  }

  // Quit звички
  if (quitHabits.length > 0) {
    const todayIso = now.toISOString().slice(0, 10);
    const notHeldToday = quitHabits.filter(h => getQuitStatus(h.id).lastHeld !== todayIso);
    if ((phase === 'evening' || phase === 'night') && notHeldToday.length > 0) {
      important.push(`[ВАЖЛИВО] Не відмічено сьогодні (кинути): ${notHeldToday.map(h => '"' + h.name + '" [habit_' + h.id + ']').join(', ')}.`);
    }
    quitHabits.forEach(h => {
      const s = getQuitStatus(h.id);
      const streak = s.streak || 0;
      const milestones = [7, 14, 21, 30, 60, 90];
      if (milestones.includes(streak) && owlCdExpired('quit_milestone_' + h.id + '_' + streak, 24 * 60 * 60 * 1000)) {
        important.push(`[ВАЖЛИВО] ${streak} днів без "${h.name}" [habit_${h.id}]! 🎉`);
      }
    });
    const quitInfo = quitHabits.map(h => `"${h.name}" [habit_${h.id}]: ${(getQuitStatus(h.id).streak||0)} дн`);
    normal.push(`Челенджі: ${quitInfo.join(', ')}.`);
  }

  // Фінанси
  try {
    const budget = getFinBudget();
    if (budget.total > 0) {
      const from = getFinPeriodRange('month');
      const txs = getFinance().filter(t => t.ts >= from && t.type === 'expense');
      const exp = txs.reduce((s,t) => s+t.amount, 0);
      const pct = Math.round(exp/budget.total*100);
      if (exp > budget.total) {
        important.push(`[ВАЖЛИВО] Бюджет перевищено! Витрачено ${formatMoney(exp)} з ${formatMoney(budget.total)} (${pct}%).`);
      } else if (pct >= 80) {
        important.push(`[ВАЖЛИВО] Витрачено ${pct}% місячного бюджету.`);
      } else {
        normal.push(`Бюджет місяця: ${formatMoney(exp)} / ${formatMoney(budget.total)} (${pct}%).`);
      }
      if (txs.length >= 3) {
        const bycat = {};
        txs.forEach(t => { if (!bycat[t.category]) bycat[t.category] = []; bycat[t.category].push(t.amount); });
        const lastTx = txs[0];
        if (lastTx && bycat[lastTx.category] && bycat[lastTx.category].length >= 2) {
          const avg = bycat[lastTx.category].reduce((a,b)=>a+b,0) / bycat[lastTx.category].length;
          if (lastTx.amount > avg * 2.5 && owlCdExpired('unusual_tx_' + lastTx.id, 8 * 60 * 60 * 1000)) {
            important.push(`[ВАЖЛИВО] Незвична витрата: ${formatMoney(lastTx.amount)} на "${lastTx.category}" [transaction_${lastTx.id}] — вище звичного вдвічі.`);
          }
        }
      }
    }
  } catch(e) {}

  // Вечір без підсумку
  if (phase === 'evening' || phase === 'night') {
    const s = JSON.parse(localStorage.getItem('nm_evening_summary') || 'null');
    if (!s || new Date(s.date).toDateString() !== todayStr) {
      important.push('[ВАЖЛИВО] Вечір — підсумок дня ще не записано.');
    }
  }

  // Понеділок — огляд тижня
  if (weekDay === 1 && (phase === 'morning' || phase === 'work')) {
    normal.push('[ТИЖДЕНЬ] Новий тиждень. Огляд планів і відкритих задач.');
  }

  // Пʼятниця — підсумок тижня
  if (weekDay === 5 && phase === 'evening') {
    const doneTasks = tasks.filter(t => t.status === 'done' && t.updatedAt && Date.now() - t.updatedAt < 7*24*60*60*1000);
    normal.push(`[ТИЖДЕНЬ] Кінець тижня. Закрито задач за тиждень: ${doneTasks.length}.`);
  }

  // Активні вкладки — агент цікавиться тільки тим що використовує користувач
  const activeTabs = [];
  if (tasks.length > 0 || getHabits().length > 0) activeTabs.push('Продуктивність (задачі, звички)');
  try { if (getNotes().length > 0) activeTabs.push('Нотатки'); } catch(e) {}
  try { if (getFinance().length > 0) activeTabs.push('Фінанси'); } catch(e) {}
  try { if (JSON.parse(localStorage.getItem('nm_health_cards') || '[]').length > 0) activeTabs.push('Здоров\'я'); } catch(e) {}
  try { if (JSON.parse(localStorage.getItem('nm_projects') || '[]').length > 0) activeTabs.push('Проекти'); } catch(e) {}
  try { if (JSON.parse(localStorage.getItem('nm_moments') || '[]').length > 0) activeTabs.push('Вечір (моменти дня)'); } catch(e) {}
  if (activeTabs.length > 0) {
    normal.push(`[АКТИВНІ ВКЛАДКИ] Користувач використовує: ${activeTabs.join(', ')}. Цікався ТІЛЬКИ цими темами.`);
  }

  // === АНКЕТУВАННЯ — OWL дізнається про користувача ===
  const OWL_Q_KEY = 'nm_owl_questions';
  const OWL_Q_TS_KEY = 'nm_owl_q_ts';
  const OWL_QUESTIONS = [
    { id: 'work', q: 'Чим ти займаєшся? Де працюєш або навчаєшся?' },
    { id: 'goals', q: 'Яка твоя головна ціль зараз — над чим працюєш найбільше?' },
    { id: 'interests', q: 'Що тебе цікавить поза роботою? Хобі, захоплення?' },
    { id: 'motivation', q: 'Що тебе найкраще мотивує — результат, процес чи визнання?' },
    { id: 'routine', q: 'Як виглядає твій типовий день? Коли ти найпродуктивніший?' },
    { id: 'challenges', q: 'Що тобі зараз найважче дається — що хотів би покращити?' },
    { id: 'values', q: 'Що для тебе найважливіше в житті — що ти ніколи не пожертвуєш?' },
    { id: 'relax', q: 'Як ти відпочиваєш? Що допомагає перезарядитись?' },
    { id: 'people', q: 'Хто найважливіші люди навколо тебе? Родина, друзі, партнер?' },
    { id: 'health', q: 'Як у тебе зі здоров\'ям? Є щось що хвилює або над чим працюєш?' },
    { id: 'dreams', q: 'Де ти бачиш себе через рік? Що має змінитись?' },
    { id: 'style', q: 'Як тобі зручніше спілкуватись — коротко і по справі чи розгорнуто з поясненнями?' },
    { id: 'daily_target', q: 'Скільки задач на день — комфортний темп для тебе? Назви число (наприклад: 3, 5, 7). Якщо запам\'ятаю цей факт — враховуватиму у порадах.' },
  ];
  try {
    const asked = JSON.parse(localStorage.getItem(OWL_Q_KEY) || '[]');
    const lastQTs = parseInt(localStorage.getItem(OWL_Q_TS_KEY) || '0');
    const nextQ = OWL_QUESTIONS.find(q => !asked.includes(q.id));
    if (nextQ && (Date.now() - lastQTs) > 24 * 60 * 60 * 1000 && (phase === 'morning' || phase === 'work')) {
      normal.push(`[АНКЕТА] Задай юзеру це питання природно, вплети в розмову (НЕ сухо як в анкеті): "${nextQ.q}". Після цього чіп "Розкажи" з action:"chat". Запам'ятай ID питання: ${nextQ.id}`);
      asked.push(nextQ.id);
      localStorage.setItem(OWL_Q_KEY, JSON.stringify(asked));
      localStorage.setItem(OWL_Q_TS_KEY, Date.now().toString());
    }
  } catch(e) {}

  // Кореляції між вкладками (3.10) — локальний аналіз патернів.
  // Показуємо ТІЛЬКИ коли немає нічого критичного/важливого, максимум 1 патерн.
  // AI має ПИТАТИ, не стверджувати. Cooldown 7 днів на патерн щоб не набридало.
  if (critical.length === 0 && important.length === 0) {
    const correlations = _computeCorrelations();
    for (const c of correlations) {
      if (owlCdExpired('corr_' + c.id, 7 * 24 * 60 * 60 * 1000)) {
        normal.push(`[ПАТЕРН] ${c.text} ПИТАЙ юзера "Можливо пов'язано?" — НЕ стверджуй як факт, дай підтвердити або спростувати. Це спостереження, не діагноз.`);
        setOwlCd('corr_' + c.id);
        break; // максимум один патерн за раз
      }
    }
  }

  return [...critical, ...important, ...normal].join(' ');
}

// Локальний аналіз патернів між вкладками (3.10).
// Повертає масив {id, text} — помічені зв'язки які AI може озвучити як питання.
// Вимоги: мінімум 7 днів даних, різниця середніх > 30% між групами.
function _computeCorrelations() {
  const insights = [];
  try {
    const habitLog = JSON.parse(localStorage.getItem('nm_habit_log2') || '{}');

    // Кореляції "сон↔звички" і "енергія↔задачі" прибрано 19.04.2026 (сесія 6GoDe):
    // UI шкал 1-10 видалено у B-31 (15.04), нових даних немає — кореляції мертві.

    // Кореляція 3: час запису в Inbox ↔ продуктивність наступного дня
    // "Пізні записи" = запис після 22:00. Наступного дня — скільки звичок виконано.
    const inbox = JSON.parse(localStorage.getItem('nm_inbox') || '[]');
    const lateByISO = {};
    inbox.forEach(i => {
      if (!i.ts) return;
      const d = new Date(i.ts);
      if (d.getHours() >= 22) {
        const iso = d.toISOString().slice(0, 10);
        lateByISO[iso] = (lateByISO[iso] || 0) + 1;
      }
    });
    const pairs = [];
    for (let i = 1; i < 14; i++) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - i - 1);
      const today = new Date();
      today.setDate(today.getDate() - i);
      const yesterdayISO = yesterday.toISOString().slice(0, 10);
      const todayStr = today.toDateString();
      const wasLate = !!lateByISO[yesterdayISO];
      const habits = habitLog[todayStr] || {};
      const habitsDone = Object.keys(habits).filter(k => habits[k]).length;
      pairs.push({ wasLate, habitsDone });
    }
    const lateDays = pairs.filter(p => p.wasLate);
    const normalDays = pairs.filter(p => !p.wasLate);
    if (lateDays.length >= 2 && normalDays.length >= 2) {
      const avgLate = lateDays.reduce((s, p) => s + p.habitsDone, 0) / lateDays.length;
      const avgNormal = normalDays.reduce((s, p) => s + p.habitsDone, 0) / normalDays.length;
      const maxv = Math.max(avgLate, avgNormal, 0.5);
      const diff = Math.abs(avgNormal - avgLate) / maxv;
      if (diff > 0.3) {
        insights.push({
          id: 'late_inbox_next_habits',
          text: avgNormal > avgLate
            ? `Після пізніх записів (після 22:00) наступного дня робиш звичок ${avgLate.toFixed(1)}, а після звичайних вечорів — ${avgNormal.toFixed(1)}.`
            : `Після пізніх записів наступного дня звичок навіть більше (${avgLate.toFixed(1)} vs ${avgNormal.toFixed(1)}) — цікаво.`
        });
      }
    }

    // Кореляція 4: настрій (moments.mood) ↔ витрати
    const moments = JSON.parse(localStorage.getItem('nm_moments') || '[]');
    const finance = JSON.parse(localStorage.getItem('nm_finance') || '[]');
    const moodByISO = {};
    moments.forEach(m => {
      if (!m.ts || !m.mood) return;
      const iso = new Date(m.ts).toISOString().slice(0, 10);
      if (!moodByISO[iso]) moodByISO[iso] = { positive: 0, negative: 0, neutral: 0 };
      moodByISO[iso][m.mood] = (moodByISO[iso][m.mood] || 0) + 1;
    });
    const expenseByISO = {};
    finance.filter(t => t.type === 'expense').forEach(t => {
      if (!t.ts) return;
      const iso = new Date(t.ts).toISOString().slice(0, 10);
      expenseByISO[iso] = (expenseByISO[iso] || 0) + (t.amount || 0);
    });
    const negSpend = [];
    const posSpend = [];
    Object.keys(moodByISO).forEach(iso => {
      const m = moodByISO[iso];
      const spend = expenseByISO[iso] || 0;
      if (m.negative > m.positive) negSpend.push(spend);
      else if (m.positive > m.negative) posSpend.push(spend);
    });
    if (negSpend.length >= 2 && posSpend.length >= 2) {
      const avgNeg = negSpend.reduce((s, v) => s + v, 0) / negSpend.length;
      const avgPos = posSpend.reduce((s, v) => s + v, 0) / posSpend.length;
      const maxv = Math.max(avgNeg, avgPos, 1);
      const diff = Math.abs(avgNeg - avgPos) / maxv;
      if (diff > 0.3) {
        insights.push({
          id: 'mood_spending',
          text: avgNeg > avgPos
            ? `В дні з поганим настроєм (за моментами) витрачаєш у середньому ${avgNeg.toFixed(0)}, а в гарні — ${avgPos.toFixed(0)}.`
            : `В дні з гарним настроєм витрачаєш більше (${avgPos.toFixed(0)}) ніж в погані (${avgNeg.toFixed(0)}).`
        });
      }
    }
  } catch(e) {}
  return insights;
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

// Шар 2 "Один мозок V2" Фаза 2 (rJYkw 21.04.2026):
// Один глобальний AbortController — бо "мозок один". Якщо під час генерації
// (наприклад для вкладки Нотатки) прилетів новіший тригер (юзер свайпнув
// на Фінанси) — попередній запит скасовується, результат уже нерелевантний.
let _boardAbortController = null;

// Червона крапка на сові якщо API табло падає
function _updateApiDot() {
  const dot = document.getElementById('owl-api-dot');
  if (!dot) return;
  const err = localStorage.getItem('nm_owl_api_error');
  dot.style.display = err ? 'block' : 'none';
}
// Перевіряємо при старті
setTimeout(_updateApiDot, 3000);

// ============================================================
// _getBannedTopics — збирає теми останніх повідомлень що ще в cooldown (3 год)
// ============================================================
const TOPIC_CD_MS = 3 * 60 * 60 * 1000; // 3 години cooldown на тему

function _getBannedTopics(msgs) {
  if (!msgs || msgs.length === 0) return '';
  const topics = [];
  for (const m of msgs.slice(0, 5)) {
    if (m.topic && !owlCdExpired('topic_' + m.topic, TOPIC_CD_MS)) {
      topics.push(m.topic);
    }
  }
  return topics.join(', ');
}

// ============================================================
// generateBoardMessage — ЄДИНА функція генерації повідомлення табло
// Працює для БУДЬ-якої вкладки включно з inbox
// ============================================================
export async function generateBoardMessage(tab, options = {}) {
  if (_boardGenerating[tab]) return;
  const key = localStorage.getItem('nm_gemini_key');
  if (!key) {
    // Навіть без API key — показати fallback з реальних даних
    _tryLocalFallback(tab);
    return;
  }
  _boardGenerating[tab] = true;

  // B-98 (v2vYo 24.04): watchdog на випадок коли fetch повисне без помилки
  // або проміс впаде у незворотний стан. Якщо прапорець не скинувся за 60 сек —
  // примусово скидаємо + аборт (щоб наступна генерація не блокувалась).
  // Корінь бага: раніше не було try/finally на все тіло функції; виключення
  // між prompt-збором і fetch (lines 624-745) лишало прапорець `true` назавжди.
  const watchdog = setTimeout(() => {
    if (_boardGenerating[tab]) {
      console.warn('[OWL board] watchdog fired — forcing flag reset for', tab);
      if (_boardAbortController) {
        try { _boardAbortController.abort(); } catch(e) {}
      }
      _boardGenerating[tab] = false;
    }
  }, 60 * 1000);

  try {
  // Шар 2 "Один мозок V2" Фаза 2: скасовуємо попередню генерацію (AbortController)
  // бо мозок один і результат старого запиту вже нерелевантний.
  if (_boardAbortController) {
    try { _boardAbortController.abort(); } catch(e) {}
  }
  _boardAbortController = new AbortController();
  const abortSignal = _boardAbortController.signal;

  const isInbox = tab === 'inbox';
  const transitionFrom = options.transitionFrom || null;
  const isBriefing = !!options.isBriefing;

  // Контекст: inbox має свій збирач, решта — спільний
  const context = getBoardContext(tab);

  // Історія повідомлень: inbox і вкладки мають різні сховища
  // Pruning Engine (Фаза 2 UVKL1): обидва геттери (getOwlBoardMessages,
  // getTabBoardMsgs) уже фільтрують через isMessageRelevant. Тут отримуємо
  // лише "живі" повідомлення — модель не побачить старе "Не забудь молоко"
  // якщо молоко закрите.
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

  // Шар 2 Фаза 2: КРОС-ЧАТОВА пам'ять. Беремо 2 найсвіжіші репліки з БУДЬ-якого
  // чату крім поточного за 30 хв — щоб мозок не "забував" про тему з іншої вкладки
  // (напр. у Inbox обговорювали "болить спина", юзер перейшов на Здоровʼя де чат
  // ще порожній — без цього блоку сова не знала б).
  // Шар 3 (ZJmdF 21.04.2026): розширено 2→5 реплік, 30→60 хв вікно
  const crossChatRecent = getRecentChatsAcrossTabs(tab, 5, 60 * 60 * 1000)
    .map(m => {
      const mins = Math.floor((Date.now() - m.ts) / 60000);
      const when = mins < 1 ? 'щойно' : mins + ' хв тому';
      const who = m.role === 'agent' ? 'агент' : 'юзер';
      return `[Чат ${m.tabLabel} · ${when}] ${who}: ${m.text}`;
    }).join('\n');

  const tabLabels = { inbox: 'Inbox', tasks: 'Продуктивність', notes: 'Нотатки', me: 'Я', evening: 'Вечір', finance: 'Фінанси', health: 'Здоров\'я', projects: 'Проекти' };
  const phase = getDayPhase();
  const sc = getSchedule();
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
${sc ? `РОЗКЛАД ЮЗЕРА: прокидається ${sc.wakeUpStr || '?'}, починає день ${sc.workStartStr || '?'}, завершує роботу ${sc.workEndStr || '?'}, лягає ${sc.bedTimeStr || '?'}. Зараз ${timeStr} → ФАЗА: ${phase.toUpperCase()}.

🚫 phase=work (юзер НА РОБОТІ — фізично не може виконати фізичні вправи на робочому місці) — ЗАБОРОНЕНО пропонувати БУДЬ-ЯКІ ФІЗИЧНІ ВПРАВИ: біг, зал, спорт, присідання, віджимання, розтяжка, прогулянка, "встань і зроби N", "займе всього 2 хв", "пробіжи 5 хв" і подібне. Habit "не виконано сьогодні" про фізичну активність — НЕ нагадуй до workEnd. Скажи нейтрально "Звичка X залишилась на ввечері" АБО просто промовч про неї. Дозволено: розумові/мікро-задачі (записати, подзвонити, відповісти), стан задач/бюджету, події з таймером.
✅ phase=evening (після workEnd) — можна нагадати про звички/спорт.
✅ phase=morning (до workStart) — м'яке привітання, без тиску.
🌙 phase=night — тільки критичне, дуже коротко.

НЕ ПИТАЙ розклад — він уже заданий. Якщо юзер хоче змінити — сам скаже.` : ''}

Ти пишеш КОРОТКЕ проактивне повідомлення для табло${isInbox ? ' в Inbox' : ' у вкладці "' + (tabLabels[tab] || tab) + '"'}. Це НЕ відповідь на запит — це твоя ініціатива.

⚠️ ДВА ТИПИ ПАМʼЯТІ — НЕ ПЛУТАЙ:
• "ПРОАКТИВНА ПАМʼЯТЬ" (boardHistory нижче) — це ТВОЇ ПУБЛІЧНІ СЛОВА на табло, які ти вже говорив. Не повторюй їх, розвивай тему.
• "РЕАКТИВНА ДОВІДКА" (recentChat + crossChatRecent нижче) — це РОЗМОВА з юзером у чаті. Це НЕ твої слова на табло, це контекст. НЕ цитуй чат як свої публічні повідомлення. Ти пишеш НОВЕ публічне повідомлення.

ПРОАКТИВНА ПАМʼЯТЬ — ТВОЇ ПОПЕРЕДНІ ПОВІДОМЛЕННЯ НА ТАБЛО (не повторюйся, будуй діалог):
${boardHistory || '(ще нічого не казав)'}

РЕАКТИВНА ДОВІДКА — РОЗМОВА У ПОТОЧНОМУ ЧАТІ (враховуй щоб не суперечити, але НЕ цитуй як свої слова):
${recentChat || '(чат порожній)'}
${crossChatRecent ? `
РЕАКТИВНА ДОВІДКА — РЕПЛІКИ В ІНШИХ ЧАТАХ (контекст який юзер обговорював деінде):
${crossChatRecent}` : ''}
${crossActions ? `
НЕЩОДАВНІ ДІЇ НА ІНШИХ ВКЛАДКАХ (загальний контекст життя юзера):
${crossActions}` : ''}
${transitionFrom ? `
[ЗМІНА ФОКУСУ]: Юзер щойно перейшов з "${tabLabels[transitionFrom] || transitionFrom}" на "${tabLabels[tab] || tab}".
[ПРАВИЛО]: Якщо тема з "${tabLabels[transitionFrom] || transitionFrom}" логічно повʼязана з поточною вкладкою — плавно звʼяжи однією фразою. Якщо звʼязку немає — ПРОІГНОРУЙ факт переходу і реагуй тільки на стан поточної вкладки. НІКОЛИ не кажи "я бачу ти перейшов" або "добре що зайшов сюди".` : ''}
${isBriefing ? `
[РАНКОВИЙ БРИФІНГ]: Це перший раз коли юзер відкрив застосунок сьогодні.
[ПРАВИЛО]: Дай ОДНЕ глобальне повідомлення-огляд дня (НЕ конкретної вкладки). Постав priority:"critical" — воно буде видне на всіх вкладках. Включи chips до 2-3 найважливіших вкладок де щось чекає. Не вітайся без діла, одразу до суті.` : ''}

ЩО ТИ ЗНАЄШ ПРО КОРИСТУВАЧА (використовуй для персоналізації — чіпи і поради мають враховувати хто ця людина; факти мають часові мітки — якщо по здоров'ю/обставинах бачиш старий факт, НЕ цитуй як поточний стан):
${formatFactsForBoard(15) || localStorage.getItem('nm_memory') || '(ще не знаю)'}

ПРІОРИТЕТ ПОВІДОМЛЕНЬ:
1. Якщо є [КРИТИЧНО] — пиши ТІЛЬКИ про це. Нічого іншого.
2. Якщо є [ВАЖЛИВО] і немає [КРИТИЧНО] — пиши про перше [ВАЖЛИВО].
3. Якщо є [ФАЗА] але немає критичного/важливого — коротке повідомлення відповідно до фази дня.
4. Інакше — обери найцікавіше зі звичайних даних.

SMART BOOT-UP (як писати коли відкривають застосунок):
- ТІЛЬКИ ОДИН фокус на повідомлення. Якщо є і прострочена задача, і незавершені звички — бери найкритичніше, решту залиш на наступну генерацію.
- НЕ вітайся без причини ("Доброго ранку!" без діла — заборонено). Починай одразу з суті.
- ЗАВЖДИ закінчуй чіпами-діями (nav або chat). Порожніх чіпів [] при старті дня уникай — юзер щойно відкрив застосунок, дай йому одразу шлях.
- Пізній старт (вже після workStart+2 год і мало що зроблено) — БЕЗ питання "де ти був?". Скажи: "Ось що накопичилось" і дай варіанти дій.
- Вечірні задачі з часом "23:XX" — запропонуй відкласти: чіп "Сховати до ранку" (chat).

ПРАВИЛА:
- ⚠️ ОДНА ТЕМА НА ПОВІДОМЛЕННЯ. Не зливай 2-3 різні теми ("звички виконано + підсумок не записано + задачі актуальні?") в одне повідомлення. Обери ОДНУ найважливішу — решту відклади на наступну генерацію (через 3 хв сама проявиться).
  ❌ ПОГАНО (3 теми): "Сьогодні виконано всі звички 💪 Але підсумок дня ще не записано. Як пройшов день? Чи актуальні ще ці задачі: '...', '...', '...'? Можливо, варто їх видалити?"
  ✅ ДОБРЕ (1 тема): "Сьогодні всі звички виконано 💪 Як пройшов день — запишемо підсумок?"
  ✅ ДОБРЕ (інша тема, наступна генерація): "5 задач у списку давно — переглянемо що з ними?"
- Максимум 2 речення. Коротко і конкретно.
- Говори ЛЮДСЬКОЮ мовою. НЕ використовуй жаргон: "стрік", "streak", "трекер", "прогрес задач". ${isInbox ? 'Замість "стрік під загрозою" кажи "ти вже 5 днів підряд бігав — не зупиняйся, біжи і сьогодні". Замість "3 задачі відкриті" кажи конкретно що це за задачі.' : 'Кажи конкретно і зрозуміло що відбувається — як друг, не як програма.'}
- Використовуй ТІЛЬКИ факти з контексту нижче. НЕ вигадуй ліміти, суми, плани або звички яких немає в даних.
- НЕ повторюй те що вже казав. ${_getBannedTopics(allMsgs) ? 'ЗАБОРОНЕНІ ТЕМИ (вже обговорені, в cooldown — ОБОВ\'ЯЗКОВО обери ІНШУ тему): ' + _getBannedTopics(allMsgs) + '.' : 'Дивись попередні повідомлення і обирай іншу тему.'}
- Поле "topic" у JSON — коротка назва теми латиницею (наприклад: "daily_habits", "stuck_task", "budget_warning", "morning_greeting", "habit_streak", "project_progress"). Це потрібно для антиповтору.
- Поле "entityRefs" у JSON — масив ID конкретних сутностей про які ти пишеш у text. Формат: "<тип>_<id>" БЕЗ лапок і пробілів. Дозволені типи: task, habit, event, note, project, transaction. ID беруться з контексту вище — там сутності помічені як "Назва" [task_888]. Якщо твоє повідомлення посилається на ці [task_888]/[habit_42] — обов'язково додай їх у entityRefs (наприклад "task_888", "habit_42"). Якщо повідомлення загальне (без конкретних задач/звичок — наприклад "Гарного ранку", "Як справи з тижнем?") — entityRefs має бути порожнім масивом []. НЕ вигадуй ID яких немає у контексті.
- ЕМПАТІЯ: правило реакції на слова-маркери ("втомився", "не можу", "забив" тощо) вже описане у твоєму характері (див. universal правила). Застосовуй його.
- Відповідай ТІЛЬКИ JSON: ${CHIP_JSON_FORMAT}
${CHIP_PROMPT_RULES}
${getChipStatsForPrompt() ? '- ' + getChipStatsForPrompt() : ''}
- Відповідай українською.`;

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      signal: abortSignal,
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Дані: ${context}` }
        ],
        max_tokens: 150,
        temperature: 0.8,
        response_format: { type: "json_object" }
      })
    });
    if (!res.ok) {
      const errDetail = `HTTP ${res.status} ${res.statusText}`;
      console.warn('[OWL board] API error:', errDetail);
      localStorage.setItem('nm_owl_api_error', errDetail + ' @ ' + new Date().toLocaleTimeString('uk-UA'));
      _updateApiDot();
      _tryLocalFallback(tab);
      _boardGenerating[tab] = false;
      return;
    }
    const data = await res.json();
    if (data?.usage) logUsage('owl-board', data.usage, data.model);
    const reply = data.choices?.[0]?.message?.content?.trim();
    if (!reply) {
      const errDetail = 'empty reply: ' + JSON.stringify(data?.error || {}).slice(0, 150);
      console.warn('[OWL board]', errDetail);
      localStorage.setItem('nm_owl_api_error', errDetail + ' @ ' + new Date().toLocaleTimeString('uk-UA'));
      _updateApiDot();
      _tryLocalFallback(tab);
      _boardGenerating[tab] = false;
      return;
    }
    // Очищуємо помилку — API працює
    localStorage.removeItem('nm_owl_api_error');
    _updateApiDot();
    const parsed = _parseJsonTolerant(reply);
    if (!parsed || !parsed.text) { _boardGenerating[tab] = false; return; }

    // 4.40 Auto-silence (ROADMAP Блок 1): перевіряємо чи попереднє повідомлення табло
    // мало шанс бути поміченим юзером (min 10 хв між табло) і чи не було жодного кліку чіпа з моменту його появи.
    // Якщо ні (5 разів поспіль) → 4 год тиші. reminder-due пробиває бо обходить Judge Layer.
    // B-64: раніше поріг 3 + без мін.часу → за 2 хв "вирішував" що ігнорують. Тепер 5 повідомлень
    // і тільки ті що провисіли >10хв рахуються як проігноровані.
    try {
      const MIN_VISIBLE_MS = 10 * 60 * 1000; // 10 хв — мінімум щоб повідомлення вважалось "поміченим"
      const IGNORE_THRESHOLD = 7;            // 5 було агресивно — дає тишу після 50 хв неактивності
      const SILENCE_MS = 2 * 60 * 60 * 1000; // 2 год (було 4) — повертаємо сову швидше якщо правило помилилось
      const lastBoardTs = parseInt(localStorage.getItem('nm_owl_last_board_ts') || '0');
      const lastClickTs = parseInt(localStorage.getItem('nm_owl_last_chip_click_ts') || '0');
      const ageMs = lastBoardTs > 0 ? Date.now() - lastBoardTs : 0;
      // Рахуємо як ignored ТІЛЬКИ якщо попереднє прожило >10хв і не було кліку/активності за цей час
      if (lastBoardTs > 0 && ageMs >= MIN_VISIBLE_MS && lastClickTs < lastBoardTs) {
        const ignored = parseInt(localStorage.getItem('nm_owl_ignored_msgs') || '0') + 1;
        if (ignored >= IGNORE_THRESHOLD) {
          localStorage.setItem('nm_owl_silence_until', String(Date.now() + SILENCE_MS));
          localStorage.setItem('nm_owl_ignored_msgs', '0');
          console.log('[OWL 4.40] Auto-silence 2 год —', IGNORE_THRESHOLD, 'повідомлень поспіль проігноровано');
        } else {
          localStorage.setItem('nm_owl_ignored_msgs', String(ignored));
        }
      }
      localStorage.setItem('nm_owl_last_board_ts', String(Date.now()));
    } catch(e) {}

    // Збереження: inbox і вкладки мають різні сховища
    // Шар 3 (ZJmdF): якщо це ранковий брифінг — примусово ставимо topic для
    // подальшого downgrade priority при кліку на чіп.
    const topicFinal = isBriefing ? 'morning-briefing' : (parsed.topic || '');
    // Pruning Engine (Фаза 2 UVKL1): entityRefs — посилання на конкретні
    // активні сутності у text. При закритті/видаленні сутності повідомлення
    // буде відфільтровано з UI і boardHistory (board-utils.isMessageRelevant).
    const entityRefs = Array.isArray(parsed.entityRefs)
      ? parsed.entityRefs.filter(r => typeof r === 'string' && r.length > 0).slice(0, 10)
      : [];
    const newMsg = { text: parsed.text, topic: topicFinal, priority: parsed.priority || 'normal', chips: parsed.chips || [], entityRefs, ts: Date.now() };
    // Ставимо cooldown на тему щоб не повторювати 3 години
    if (parsed.topic) setOwlCd('topic_' + parsed.topic);
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
    // Шар 2 Фаза 2: AbortError — це нормально (прилетів новіший тригер).
    // ТИХО дропаємо, НЕ показуємо fallback — нова генерація вже в процесі.
    if (e && e.name === 'AbortError') {
      _boardGenerating[tab] = false;
      return;
    }
    // Мережеві помилки (offline, timeout) — тихо, не засмічувати логи
    if (!_isNetworkError(e)) {
      console.warn('[OWL board] generation error:', e?.message || e);
    }
    // Якщо API впав а повідомлення застаріло — показати локальне fallback
    _tryLocalFallback(tab);
  }
  } finally {
    // B-98 (v2vYo 24.04): finally гарантує скидання прапорця у ВСІХ сценаріях
    // (включно з виключенням у prompt-збірці, AbortError, unhandled exception).
    // Раніше ad-hoc резети не покривали exception між _boardGenerating=true і
    // внутрішнім try {} — прапорець залипав назавжди, табло замовкало.
    clearTimeout(watchdog);
    _boardGenerating[tab] = false;
  }
}

// Розумне fallback-повідомлення з РЕАЛЬНИХ даних коли API не працює
// B-41 fix: працює на ВСІХ вкладках (не тільки inbox). Для finance — фінансові дані.
function _tryLocalFallback(tab) {
  // Для tab-boards (не inbox) — окрема логіка
  if (tab !== 'inbox') {
    _tryTabLocalFallback(tab);
    return;
  }
  const msgs = getOwlBoardMessages();
  const visibleTs = msgs[0]?.ts || 0;
  // Якщо кеш порожній (visibleTs=0) — ДОЗВОЛИТИ генерацію (не блокувати).
  // Блокуємо тільки якщо є свіже повідомлення (менше 30 хв).
  if (visibleTs > 0 && Date.now() - visibleTs < 30 * 60 * 1000) return;

  const mode = (JSON.parse(localStorage.getItem('nm_settings') || '{}').owl_mode) || 'partner';
  let text = '';
  const chips = [];
  // Відмінювання: 1 задача, 2 задачі, 5 задач
  const _pl = (n, one, few, many) => {
    const abs = Math.abs(n) % 100;
    const last = abs % 10;
    if (abs > 10 && abs < 20) return `${n} ${many}`;
    if (last === 1) return `${n} ${one}`;
    if (last >= 2 && last <= 4) return `${n} ${few}`;
    return `${n} ${many}`;
  };
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
    const tStr = _pl(tasks.length, 'задача', 'задачі', 'задач');
    const hStr = _pl(pendingH.length, 'звичка', 'звички', 'звичок');

    if (tasks.length > 0 && pendingH.length > 0) {
      text = mode === 'coach'
        ? `${tStr} і ${hStr}. Що заважає закрити?`
        : mode === 'mentor'
        ? `Є ${tStr} і ${hStr}. Давай хоча б одну закриємо.`
        : `У тебе ${tStr} і ${hStr} на сьогодні. Тримаєшся?`;
      chips.push({ label: 'Задачі', action: 'nav', target: 'tasks' });
      chips.push({ label: 'Звички', action: 'nav', target: 'habits' });
    } else if (tasks.length > 0) {
      const first = tasks[0].title;
      text = mode === 'coach'
        ? `"${first}" — все ще відкрита. Що заважає?`
        : mode === 'mentor'
        ? `Задача "${first}" чекає. Може варто почати з неї?`
        : `Є задача "${first}". Як з нею справи?`;
      chips.push({ label: 'Задачі', action: 'nav', target: 'tasks' });
    } else if (pendingH.length > 0) {
      const names = pendingH.slice(0, 2).map(h => h.name).join(' і ');
      text = mode === 'coach'
        ? `${names} — ще не виконано. Що заважає?`
        : mode === 'mentor'
        ? `Ще жодної звички сьогодні. ${names} — давай хоча б одну.`
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
  // НЕ оновлюємо nm_owl_board_ts — fallback не рахується як повноцінна генерація,
  // інакше Judge Layer штрафує наступну спробу API
  renderOwlBoard();
  console.log('[OWL board] smart fallback:', text);
}

// B-41: fallback для tab-boards (finance, tasks, health тощо)
function _tryTabLocalFallback(tab) {
  const msgs = getTabBoardMsgs(tab);
  const visibleTs = msgs[0]?.ts || 0;
  if (visibleTs > 0 && Date.now() - visibleTs < 30 * 60 * 1000) return;
  let text = '';
  const chips = [];
  try {
    if (tab === 'finance') {
      const txs = getFinance();
      const from = getFinPeriodRange('month');
      const monthTxs = txs.filter(t => t.ts >= from);
      const exp = monthTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
      const inc = monthTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
      if (monthTxs.length === 0) {
        text = 'Цього місяця операцій ще немає. Додай першу витрату!';
      } else {
        text = `За місяць: витрати ${formatMoney(exp)}, доходи ${formatMoney(inc)}.${inc > 0 ? ` Збережено ${Math.round((inc - exp) / inc * 100)}%.` : ''}`;
      }
    } else if (tab === 'tasks') {
      const tasks = getTasks().filter(t => t.status === 'active');
      text = tasks.length > 0 ? `${tasks.length} активних задач. Що будемо закривати?` : 'Немає активних задач. Вільний день!';
    } else if (tab === 'health') {
      text = 'Як самопочуття сьогодні?';
    } else if (tab === 'notes') {
      text = 'Запиши думку або ідею — я збережу у нотатки 📝';
    } else if (tab === 'evening' || tab === 'me') {
      text = 'Як пройшов день? Є що записати?';
    } else if (tab === 'projects') {
      text = 'Працюємо над проектами. Що нового?';
    } else {
      text = 'Привіт! Напиши або тапни "Поговорити" 💬';
    }
  } catch(e) { text = 'Чим можу допомогти?'; }
  if (!text) return;
  const newMsg = { text, priority: 'normal', chips, ts: Date.now(), id: Date.now() };
  saveTabBoardMsg(tab, newMsg);
  renderTabBoard(tab);
  console.log(`[OWL ${tab} board] tab fallback:`, text);
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
  // G9 — Page Visibility: вкладка прихована → не генерувати (API економія)
  if (typeof document !== 'undefined' && document.hidden) return;
  const hour = new Date().getHours();
  if (hour < 5) return; // тихі години — генерація пропускається
  // Вечірнє табло — "підсумок дня" не має сенсу зранку; генеруємо лише після 12:00
  if (tab === 'evening' && hour < 12) return;
  // М'який кеш (UVKL1 27.04 баланс актуальність↔економія): якщо для цієї вкладки
  // вже є повідомлення молодше 5 хв — не питаємо нового. Pruning Engine (Фаза 2)
  // миттєво забирає неактуальне з табла без API, тож кеш гарантовано «живий».
  const tabMsgs = getTabBoardMsgs(tab);
  const latestMsg = tabMsgs[0];
  const latestAge = latestMsg ? (Date.now() - (latestMsg.ts || latestMsg.id || 0)) : Infinity;
  if (latestAge < 5 * 60 * 1000) return;
  const lastTs = parseInt(localStorage.getItem(getOwlTabTsKey(tab)) || '0');
  const elapsed = Date.now() - lastTs;
  const isNewDay = lastTs > 0 && new Date(lastTs).toDateString() !== new Date().toDateString();
  const firstTime = lastTs === 0;
  if (firstTime || isNewDay || (elapsed > OWL_TAB_BOARD_MIN_INTERVAL && checkTabBoardTrigger(tab))) {
    generateBoardMessage(tab);
  }
}

// === ЄДИНИЙ API для оновлення табло будь-якої вкладки (Фаза 1.1) ===
// Wrapper над tryOwlBoardUpdate (inbox) і tryTabBoardUpdate (решта).
// Один мозок — одна точка входу для всіх викликачів (nav, finance, boot).
export function tryBoardUpdate(tab) {
  if (tab === 'inbox') return tryOwlBoardUpdate();
  return tryTabBoardUpdate(tab);
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
  // 4.40 — Reset ignored counter на будь-яку зміну даних (включно з 'chat').
  // Раніше це був окремий listener — об'єднано щоб не дублювати реєстрацію.
  try {
    localStorage.setItem('nm_owl_ignored_msgs', '0');
    localStorage.setItem('nm_owl_last_chip_click_ts', String(Date.now()));
  } catch(_) {}

  const tab = currentTab || 'inbox';

  // Миттєва локальна реакція (без API)
  if (e.detail !== 'chat') _showInstantReaction(tab);

  // Чат-повідомлення НЕ тригерять табло напряму — табло оновиться при закритті чату
  if (e.detail === 'chat') return;
  const trigger = 'data-changed';

  // Відкладена AI-генерація
  if (_boardUpdateTimer) clearTimeout(_boardUpdateTimer);
  _boardUpdateTimer = setTimeout(() => {
    _boardUpdateTimer = null;
    // G9 — Page Visibility: вкладка прихована (юзер пішов за час BOARD_UPDATE_DELAY)
    // → не генерувати
    if (typeof document !== 'undefined' && document.hidden) return;
    const curTab = currentTab || 'inbox';
    if (curTab === 'inbox') {
      // Inbox — через Judge Layer
      const judge = shouldOwlSpeak(trigger);
      if (judge.speak) generateBoardMessage('inbox');
    } else {
      // Інші вкладки — генерація напряму (Judge Layer inbox-specific)
      generateBoardMessage(curTab);
    }
  }, BOARD_UPDATE_DELAY);
});

// === Chat Closed — табло оновлюється після закриття чату ===
window.addEventListener('nm-chat-closed', () => {
  setTimeout(() => {
    const judge = shouldOwlSpeak('chat-closed');
    if (judge.speak) generateBoardMessage(currentTab || 'inbox');
  }, 3000); // 3 сек затримка після закриття чату
});

// === Tab Switched (UVKL1 27.04 баланс актуальність↔економія) ===
// Раніше тут був другий тригер генерації через 3 сек dwell з transitionFrom.
// Прибрано: tryBoardUpdate (через 100мс у nav.switchTab) уже сам вирішує чи
// потрібен API через м'який кеш 5 хв + 30 хв guard. Дублювання тут призводило
// до подвійних запитів і марних витрат токенів. transitionFrom втратили —
// плавний перехід темою лишається через крос-чат пам'ять у звичайних промптах.
// Лишаємо порожній listener для майбутнього розширення / діагностики.

// === Welcome Back + Smart Boot-up (3.6) — тригери при поверненні в додаток ===
const NM_LAST_ACTIVE_KEY = 'nm_last_active';
const NM_LAST_ACTIVE_DAY_KEY = 'nm_last_active_day';
const WELCOME_BACK_THRESHOLD = 2 * 60 * 60 * 1000; // 2 години

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    localStorage.setItem(NM_LAST_ACTIVE_KEY, Date.now().toString());
    localStorage.setItem(NM_LAST_ACTIVE_DAY_KEY, new Date().toISOString().slice(0, 10));
  } else if (document.visibilityState === 'visible') {
    // Smart Boot-up: перший раз відкривається сьогодні → окремий тригер
    const todayISO = new Date().toISOString().slice(0, 10);
    const lastActiveDay = localStorage.getItem(NM_LAST_ACTIVE_DAY_KEY) || '';
    const isFirstOpenToday = lastActiveDay && lastActiveDay !== todayISO;
    if (isFirstOpenToday) {
      localStorage.setItem(NM_LAST_ACTIVE_DAY_KEY, todayISO);
      const judge = shouldOwlSpeak('first-open-today');
      // Шар 2 Фаза 4: ранковий брифінг позначаємо як глобальний —
      // мозок поставить priority:'critical' і завдяки пробою на рендері
      // це повідомлення буде видно на ВСІХ вкладках як iOS push.
      if (judge.speak) generateBoardMessage(currentTab || 'inbox', { isBriefing: true });
      return; // не дублюємо welcome-back
    }
    // Welcome Back — повернувся після довгої паузи в межах одного дня
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
