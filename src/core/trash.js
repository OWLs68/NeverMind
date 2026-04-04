import { currentTab, _undoData, _undoToastTimer, setUndoData, setUndoTimer } from './nav.js';
import { getInbox, saveInbox, renderInbox } from '../tabs/inbox.js';
import { getTasks, saveTasks, renderTasks } from '../tabs/tasks.js';
import { getNotes, saveNotes, renderNotes } from '../tabs/notes.js';
import { getHabits, saveHabits, renderHabits, renderProdHabits } from '../tabs/habits.js';
import { getFinance, saveFinance, renderFinance } from '../tabs/finance.js';

// === TRASH CACHE (кеш видалених — 7 днів) ===
const NM_TRASH_KEY = 'nm_trash';
const TRASH_TTL = 7 * 24 * 60 * 60 * 1000; // 7 днів

export function getTrash() {
  try { return JSON.parse(localStorage.getItem(NM_TRASH_KEY) || '[]'); } catch { return []; }
}
function saveTrash(arr) {
  localStorage.setItem(NM_TRASH_KEY, JSON.stringify(arr));
}

// Додати запис в кеш при видаленні
export function addToTrash(type, item, extra) {
  const trash = getTrash();
  // Прибираємо старіші за 7 днів
  const now = Date.now();
  const fresh = trash.filter(t => now - t.deletedAt < TRASH_TTL);
  fresh.push({ type, item, extra: extra || null, deletedAt: now });
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

// Відновити запис з кешу по id
export function restoreFromTrash(trashId) {
  const trash = getTrash();
  const entry = trash.find(t => t.deletedAt === trashId);
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
  }
  // Прибираємо з кешу після відновлення
  saveTrash(trash.filter(t => t.deletedAt !== trashId));
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
