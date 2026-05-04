// ============================================================
// owl/board-utils.js — Pruning Engine helpers (Фаза 2 UVKL1 27.04.2026)
// ============================================================
//
// Призначення: фільтр повідомлень табла від посилань на вже-неактивні
// сутності. Коли юзер закриває задачу / виконує звичку / видаляє нотатку —
// усі повідомлення сови які посилались тільки на ці сутності зникають
// з табла миттєво (через nm-data-changed re-render) і не передаються
// у boardHistory наступної генерації (сова не може процитувати чого
// не бачить).
//
// Архітектурний план: docs/OWL_SILENCE_PRUNING_PLAN.md → Фаза 2.
// ============================================================

import { getTasks } from '../tabs/tasks.js';
import { getHabits, getHabitLog, getQuitStatus } from '../tabs/habits.js';
import { getEvents } from '../tabs/calendar.js';
import { getNotes } from '../tabs/notes.js';

const todayISO = () => new Date().toISOString().slice(0, 10);

// Перевіряє чи посилання на сутність ще "актуальне" для табла.
// ref: рядок типу "task_888", "habit_42", "event_123", "note_55", "project_7", "transaction_xxx".
// Повертає true якщо сутність ще варта згадки сови; false якщо закрита/видалена/неактуальна.
// Невідомий тип → true (не блокуємо щоб не втрачати потенційно корисні повідомлення).
export function isEntityRelevant(ref) {
  if (typeof ref !== 'string') return false;
  const idx = ref.indexOf('_');
  if (idx < 0) return false;
  const type = ref.slice(0, idx);
  const idRaw = ref.slice(idx + 1);
  if (!idRaw) return false;
  // ID може бути числом (Date.now) або рядком (UUID). Зберігаємо обидва шляхи.
  const idNum = Number(idRaw);
  const matchId = (x) => x === idRaw || x === idNum || (idNum && Number(x) === idNum);

  try {
    if (type === 'task') {
      const t = getTasks().find(x => matchId(x.id));
      if (!t) return false; // видалена
      if (t.status !== 'active') return false; // закрита/архів
      // Прострочений dueDate з минулого — не релевантний (сова має нагадати один раз
      // через [ПРОСТРОЧЕНО] контекст, не з історії)
      if (t.dueDate && t.dueDate < todayISO()) return false;
      return true;
    }
    if (type === 'habit') {
      const h = getHabits().find(x => matchId(x.id));
      if (!h) return false;
      if (h.type === 'quit') {
        // Quit-челенджі завжди актуальні поки існують (стрік триває кожен день)
        return true;
      }
      const todayKey = new Date().toDateString();
      const log = getHabitLog();
      const doneToday = !!log[todayKey]?.[h.id];
      return !doneToday; // якщо вже виконана сьогодні — не нагадуй
    }
    if (type === 'event') {
      const e = getEvents().find(x => matchId(x.id));
      if (!e) return false; // видалена
      // Подія минула — не нагадуй (минулі події закриваються через followups.event-passed)
      try {
        const dt = e.time
          ? new Date(`${e.date}T${e.time}`).getTime()
          : new Date(`${e.date}T23:59`).getTime();
        return dt >= Date.now();
      } catch (err) {
        return true; // парсинг впав — лишаємо
      }
    }
    if (type === 'note') {
      return getNotes().some(x => matchId(x.id));
    }
    if (type === 'project') {
      const projects = JSON.parse(localStorage.getItem('nm_projects') || '[]');
      const p = projects.find(x => matchId(x.id));
      if (!p) return false;
      if (p.status && p.status !== 'active') return false;
      const progress = Number(p.progress || 0);
      if (progress >= 100) return false;
      return true;
    }
    if (type === 'transaction') {
      // Транзакції — історичні факти, лишаємо релевантними якщо запис існує
      const txs = JSON.parse(localStorage.getItem('nm_finance') || '[]');
      return txs.some(x => matchId(x.id));
    }
  } catch (e) {
    return true; // помилка читання — не блокуємо
  }
  return true; // невідомий тип — лишаємо (forward compat)
}

// Перевіряє чи повідомлення табла ще "живе".
// msg: запис з unified-storage.
// Повертає true якщо: немає entityRefs (загальне повідомлення), або хоч одне посилання активне.
// false → повідомлення можна викидати з історії і UI.
export function isMessageRelevant(msg) {
  if (!msg) return false;
  if (Array.isArray(msg.entityRefs) && msg.entityRefs.length > 0) {
    return msg.entityRefs.some(isEntityRelevant);
  }
  // B-117 fix (QDIGl 04.05): content-based fallback для habit-повідомлень
  // без entityRefs. Сценарій: AI генерує узагальнення «не виконано жодну
  // звичку — активізуйся» без конкретного [habit_X] → entityRefs=[] →
  // Pruning не фільтрує. Юзер виконує всі звички, але stale-нагадування
  // лишається у табло. Перевіряємо реальний стан habits — якщо всі виконані
  // сьогодні (включно з quit), це повідомлення вже неактуальне.
  if (_isStaleHabitGeneralization(msg)) return false;
  return true;
}

// Детектор stale habit-повідомлень без entityRefs. true → можна викидати.
// Працює для узагальнень типу «не виконано звичок», «активізуйся», «жодну звичку».
// Свідомо вузький — не ловимо позитивні «3/3 виконано» (топ != «не виконано»).
function _isStaleHabitGeneralization(msg) {
  const topic = (msg.topic || '').toLowerCase();
  const text = (msg.text || '').toLowerCase();
  const isHabitTopic = /habit|звич/.test(topic);
  const isHabitTextNegative = /не\s+вико|не\s+відміч|жодн[аоу].*звич|активі[зс]уй|нагада[йю].*звич/.test(text);
  if (!isHabitTopic && !isHabitTextNegative) return false;

  try {
    const habits = getHabits();
    const buildHabits = habits.filter(h => h.type !== 'quit');
    if (buildHabits.length === 0) return false; // нема звичок взагалі — повідомлення не релевантне у будь-якому разі, але не наша справа фільтрувати
    const todayKey = new Date().toDateString();
    const log = getHabitLog();
    const allDoneToday = buildHabits.every(h => !!log[todayKey]?.[h.id]);
    return allDoneToday;
  } catch (e) {
    return false;
  }
}

// Експорт у window для діагностики/ручного тестування з DevTools
try { Object.assign(window, { isEntityRelevant, isMessageRelevant }); } catch {}
