import { currentTab, _undoData, _undoToastTimer, setUndoData, setUndoTimer } from './nav.js';
import { generateUUID } from './uuid.js';
import { getInbox, saveInbox, renderInbox } from '../tabs/inbox.js';
import { getTasks, saveTasks, renderTasks } from '../tabs/tasks.js';
import { getNotes, saveNotes, renderNotes } from '../tabs/notes.js';
import { getHabits, saveHabits, renderHabits, renderProdHabits } from '../tabs/habits.js';
import { getFinance, saveFinance, renderFinance } from '../tabs/finance.js';
import { getAllergies, saveAllergies, renderHealth, getHealthCards, saveHealthCards } from '../tabs/health.js';
import { getEvents, saveEvents } from '../tabs/calendar.js';
import { getProjects, saveProjects, renderProjects } from '../tabs/projects.js';

// === TRASH CACHE (кеш видалених — 7 днів) ===
const NM_TRASH_KEY = 'nm_trash';
// OBErR audit fix: export — щоб UI helper'и (nav.js _updateTrashBadge,
// renderTrashList) не дублювали константу (DRY-агент знахідка).
export const TRASH_TTL = 7 * 24 * 60 * 60 * 1000; // 7 днів

export function getTrash() {
  try { return JSON.parse(localStorage.getItem(NM_TRASH_KEY) || '[]'); } catch { return []; }
}
function saveTrash(arr) {
  localStorage.setItem(NM_TRASH_KEY, JSON.stringify(arr));
}

// Додати запис в кеш при видаленні
//
// OBErR 18.05.2026 (Council Pre-mortem): додано unique `id` (UUID) щоб уникнути
// колізії `deletedAt` при batch-delete (Date.now() мс точність — 2 видалення за
// 1 мс отримували один deletedAt → restoreFromTrash(deletedAt) повертав ТIЛЬКИ
// перший; другий залишався у trash назавжди silent). Backward-compat: старі
// записи без id шукаються по deletedAt.
export function addToTrash(type, item, extra) {
  const trash = getTrash();
  // Прибираємо старіші за 7 днів
  const now = Date.now();
  const fresh = trash.filter(t => now - t.deletedAt < TRASH_TTL);
  fresh.push({ id: generateUUID(), type, item, extra: extra || null, deletedAt: now });
  // Максимум 200 записів
  saveTrash(fresh.slice(-200));
}

// Пошук в кеші — для агента
export function searchTrash(query) {
  const trash = getTrash();
  const now = Date.now();
  const q = query.toLowerCase();
  return trash
    .filter(t => now - t.deletedAt < TRASH_TTL)
    .filter(t => {
      const item = t.item;
      const text = (item.text || item.title || item.name || item.category || '').toLowerCase();
      const folder = (item.folder || '').toLowerCase();
      return text.includes(q) || folder.includes(q);
    })
    .sort((a, b) => b.deletedAt - a.deletedAt);
}

// Відновити запис з кешу по id.
// OBErR 18.05.2026: шукає по `id` (UUID, нові записи) АБО `deletedAt`
// (legacy без id). Це дозволяє Кошик UI використовувати UUID без втрати
// сумісності з undo-toast'ом який все ще передає deletedAt.
export function restoreFromTrash(trashId) {
  const trash = getTrash();
  const entry = trash.find(t => t.id === trashId || t.deletedAt === trashId);
  if (!entry) return false;
  const { type, item, extra } = entry;
  if (type === 'task') {
    const tasks = getTasks();
    tasks.unshift(item);
    saveTasks(tasks);
    if (currentTab === 'tasks') renderTasks();
  } else if (type === 'note') {
    const notes = getNotes();
    notes.unshift(item);
    saveNotes(notes);
    if (currentTab === 'notes') renderNotes();
  } else if (type === 'habit') {
    const habits = getHabits();
    habits.push(item);
    saveHabits(habits);
    renderHabits(); renderProdHabits();
  } else if (type === 'inbox') {
    const items = getInbox();
    items.unshift(item);
    saveInbox(items);
    if (currentTab === 'inbox') renderInbox();
  } else if (type === 'folder') {
    // extra = масив нотаток папки
    const notes = getNotes();
    (extra || []).forEach(n => notes.push(n));
    saveNotes(notes);
    if (currentTab === 'notes') renderNotes();
  } else if (type === 'finance') {
    const txs = getFinance();
    txs.unshift(item);
    saveFinance(txs);
    if (currentTab === 'finance') renderFinance();
  } else if (type === 'allergy') {
    // db0YY 12.05: повернути алергію у nm_allergies. Раніше тип не підтримувався,
    // тому navigate «відміни видалення алергії» не міг повернути запис.
    const allergies = getAllergies();
    // Уникнути дублікату по назві (case-insensitive) як у addAllergy
    if (!allergies.some(a => a.name.toLowerCase() === item.name.toLowerCase())) {
      allergies.push(item);
      saveAllergies(allergies);
    }
    if (currentTab === 'health') renderHealth();
  } else if (type === 'event') {
    // db0YY 12.05: подія повертається у nm_events. Раніше addToTrash('event')
    // викликався з 6 точок (calendar / evening-actions / health 4) але restore
    // тихо ігнорував — універсальний undo не повертав події.
    const events = getEvents();
    events.push(item);
    saveEvents(events);
    // calendar render — через nm-data-changed listener у boot.js
  } else if (type === 'project') {
    // db0YY 12.05: проект повертається у nm_projects. Раніше addToTrash('project')
    // викликався з 2 точок (projects.js delete + AI delete_project) але restore
    // тихо ігнорував — undo для проектів не працював.
    const projects = getProjects();
    projects.unshift(item);
    saveProjects(projects);
    if (currentTab === 'projects') renderProjects();
  } else if (type === 'health_card') {
    // db0YY 12.05: B-175 fix — health картка повертається у nm_health_cards.
    // deleteHealthCardProgrammatic (health.js:382) кидає addToTrash('health_card'),
    // але до цього коміту restoreFromTrash тихо ігнорував — return true без даних.
    const cards = getHealthCards();
    cards.unshift(item);
    saveHealthCards(cards);
    if (currentTab === 'health') renderHealth();
  } else if (type === 'medication') {
    // nliW8 13.05: повертаємо препарат у відповідну health-картку.
    // item структура: { cardId, med } — записує deleteMedicationFromCard (health.js).
    // Якщо картка була теж видалена і не відновлена — нічого не робимо (silent skip).
    const cards = getHealthCards();
    const cIdx = cards.findIndex(c => c.id === item.cardId);
    if (cIdx !== -1) {
      if (!Array.isArray(cards[cIdx].medications)) cards[cIdx].medications = [];
      cards[cIdx].medications.push(item.med);
      saveHealthCards(cards);
      if (currentTab === 'health') renderHealth();
    }
  }
  // Прибираємо з кешу після відновлення. OBErR: фільтр по id ТА deletedAt
  // (той самий entry зі знайденого вище — обидва критерії гарантують exact match).
  saveTrash(trash.filter(t => t !== entry));
  return true;
}

// Очистка кешу — викликається при старті
export function cleanupTrash() {
  const trash = getTrash();
  const now = Date.now();
  const fresh = trash.filter(t => now - t.deletedAt < TRASH_TTL);
  if (fresh.length !== trash.length) saveTrash(fresh);
}

export function showUndoToast(msg, restoreFn) {
  // Показує toast з кнопкою "Відновити" на 10 секунд
  const el = document.getElementById('toast');
  const msgEl = document.getElementById('toast-msg');
  const btn = document.getElementById('toast-undo-btn');
  msgEl.textContent = msg;
  btn.style.display = 'inline-block';
  setUndoData(restoreFn);
  if (_undoToastTimer) clearTimeout(_undoToastTimer);
  el.classList.add('show');
  setUndoTimer(setTimeout(() => {
    el.classList.remove('show');
    setUndoData(null);
  }, 10000));
}

export function undoDelete() {
  if (_undoData) {
    _undoData(); // викликаємо функцію відновлення
    setUndoData(null);
  }
  if (_undoToastTimer) clearTimeout(_undoToastTimer);
  document.getElementById('toast').classList.remove('show');
}

// Functions called from HTML event handlers
window.undoDelete = undoDelete;
