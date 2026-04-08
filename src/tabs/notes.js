// ============================================================
// app-notes.js — Нотатки, папки, note view, note chat, notes AI bar
// Функції: getNotes, renderNotes, openNoteView, addNoteFromInbox, getFolderIcon, checkAndSuggestFolders, sendNotesBarMessage
// Залежності: app-core.js, app-ai.js
// ============================================================

import { currentTab, showToast } from '../core/nav.js';
import { escapeHtml, formatTime } from '../core/utils.js';
import { addToTrash, showUndoToast } from '../core/trash.js';
import { callAI, getAIContext, getOWLPersonality, openChatBar, safeAgentReply, saveChatMsg } from '../ai/core.js';
import { SWIPE_DELETE_THRESHOLD, applySwipeTrail, clearSwipeTrail } from '../ui/swipe-delete.js';
import { processUniversalAction } from './habits.js';

// === NOTES ===
let editingNoteId = null;
let pendingFolderSuggestion = null;

export function getNotes() { return JSON.parse(localStorage.getItem('nm_notes') || '[]'); }
export function saveNotes(arr) { localStorage.setItem('nm_notes', JSON.stringify(arr)); window.dispatchEvent(new CustomEvent('nm-data-changed', { detail: 'notes' })); }

function getFolders() {
  const notes = getNotes();
  const set = new Set(notes.map(n => n.folder || 'Загальне'));
  return [...set].sort();
}

export function addNoteFromInbox(text, category, folder = null, source = 'inbox') {
  const notes = getNotes();
  const resolvedFolder = folder || (category === 'idea' ? 'Ідеї' : 'Загальне');
  notes.unshift({ id: Date.now(), text, folder: resolvedFolder, source, ts: Date.now(), lastViewed: Date.now() });
  saveNotes(notes);
}

function openAddNote() {
  editingNoteId = null;
  document.getElementById('note-modal-title').textContent = 'Нова нотатка';
  document.getElementById('note-input-text').value = '';
  document.getElementById('note-input-folder').value = '';
  updateFolderSuggestions();
  document.getElementById('note-modal').style.display = 'flex';
  setTimeout(() => { const el = document.getElementById('note-input-text'); el.removeAttribute('readonly'); el.focus(); }, 350);
}

function openEditNote(id) {
  const notes = getNotes();
  const n = notes.find(x => x.id === id);
  if (!n) return;
  editingNoteId = id;
  document.getElementById('note-modal-title').textContent = 'Редагувати нотатку';
  document.getElementById('note-input-text').value = n.text;
  document.getElementById('note-input-folder').value = n.folder || '';
  updateFolderSuggestions();
  document.getElementById('note-modal').style.display = 'flex';
  // Оновлюємо час перегляду
  n.lastViewed = Date.now();
  saveNotes(notes);
}

function closeNoteModal() {
  document.getElementById('note-modal').style.display = 'none';
}

function updateFolderSuggestions() {
  const dl = document.getElementById('folder-suggestions');
  dl.innerHTML = getFolders().map(f => `<option value="${f}">`).join('');
}

function saveNote() {
  const text = document.getElementById('note-input-text').value.trim();
  if (!text) { showToast('Введіть текст нотатки'); return; }
  const folder = document.getElementById('note-input-folder').value.trim() || 'Загальне';
  const notes = getNotes();

  if (editingNoteId) {
    const idx = notes.findIndex(x => x.id === editingNoteId);
    if (idx !== -1) notes[idx] = { ...notes[idx], text, folder, updatedAt: Date.now() };
  } else {
    notes.unshift({ id: Date.now(), text, folder, source: 'manual', ts: Date.now(), lastViewed: Date.now() });
  }
  saveNotes(notes);
  closeNoteModal();
  renderNotes();
  showToast(editingNoteId ? '✓ Нотатку оновлено' : '✓ Нотатку збережено');
}

function deleteNote(id) {
  const notes = getNotes();
  const noteOrigIdx = notes.findIndex(x => x.id === id);
  const item = notes.find(x => x.id === id);
  const predecessorId = noteOrigIdx > 0 ? notes[noteOrigIdx - 1].id : null;
  if (item) addToTrash('note', item);
  saveNotes(notes.filter(x => x.id !== id));
  renderNotes();
  if (item) showUndoToast('Нотатку видалено', () => {
    const n = getNotes();
    let idx;
    if (predecessorId === null) {
      idx = 0;
    } else {
      const predIdx = n.findIndex(x => x.id === predecessorId);
      idx = predIdx !== -1 ? predIdx + 1 : n.length;
    }
    n.splice(idx, 0, item); saveNotes(n); renderNotes();
  });
}

export let currentNotesFolder = null; // null = показуємо папки, string = показуємо записи папки
export function setCurrentNotesFolder(v) { currentNotesFolder = v; }

export function openNotesFolder(folderName) {
  currentNotesFolder = folderName;
  renderNotes();
}

function closeNotesFolder() {
  currentNotesFolder = null;
  renderNotes();
}

// === КАТАЛОГ ІКОНОК ПАПОК (30 іконок) ===
const _S = 'stroke="rgba(30,16,64,0.55)"';
function _ico(path) { return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(30,16,64,0.55)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`; }

const ICON_SVG = {
  folder:   _ico('<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>'),
  note:     _ico('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>'),
  food:     _ico('<path d="M3 2v7c0 1.7 1.3 3 3 3s3-1.3 3-3V2"/><line x1="6" y1="2" x2="6" y2="12"/><path d="M21 2s-2 2-2 7 2 5 2 5"/><path d="M19 14v8"/>'),
  money:    _ico('<circle cx="12" cy="12" r="9"/><path d="M12 6v2m0 8v2"/><path d="M9.5 9.5A2.5 2.5 0 0 1 12 8h.5a2.5 2.5 0 0 1 0 5h-1a2.5 2.5 0 0 0 0 5H12a2.5 2.5 0 0 0 2.5-1.5"/>'),
  heart:    _ico('<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.8 1-1a5.5 5.5 0 0 0 0-7.6z"/>'),
  work:     _ico('<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><line x1="2" y1="13" x2="22" y2="13"/>'),
  book:     _ico('<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>'),
  bulb:     _ico('<circle cx="12" cy="9" r="5"/><path d="M12 14v4"/><path d="M9.5 16.5h5"/><path d="M9.5 18.5h5"/>'),
  person:   _ico('<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>'),
  plane:    _ico('<path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/>'),
  star:     _ico('<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>'),
  home:     _ico('<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>'),
  car:      _ico('<path d="M5 17H3a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1l2-4h10l2 4h1a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-2"/><circle cx="7.5" cy="17" r="2.5"/><circle cx="16.5" cy="17" r="2.5"/>'),
  music:    _ico('<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>'),
  camera:   _ico('<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>'),
  gift:     _ico('<polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><path d="M12 22V7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>'),
  sport:    _ico('<circle cx="12" cy="12" r="10"/><path d="M4.93 4.93l4.24 4.24"/><path d="M14.83 9.17l4.24-4.24"/><path d="M14.83 14.83l4.24 4.24"/><path d="M9.17 14.83l-4.24 4.24"/><circle cx="12" cy="12" r="4"/>'),
  phone:    _ico('<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13 19.79 19.79 0 0 1 1.61 4.4 2 2 0 0 1 3.6 2.21h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6 6l.92-.92a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 17z"/>'),
  lock:     _ico('<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>'),
  globe:    _ico('<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>'),
  map:      _ico('<polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/>'),
  chart:    _ico('<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>'),
  smile:    _ico('<circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/>'),
  coffee:   _ico('<path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/>'),
  leaf:     _ico('<path d="M17 8C8 10 5.9 16.17 3.82 21.34L5.71 22l1-2.3A4.49 4.49 0 0 0 8 20C19 20 22 3 22 3c-1 2-8 3-8 3"/>'),
  zap:      _ico('<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>'),
  target:   _ico('<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>'),
  tool:     _ico('<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>'),
  users:    _ico('<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'),
  sun:      _ico('<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>'),
  shopping: _ico('<path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>'),
};

// Маппінг назва → іконка
const FOLDER_ICON_MAP = {
  'Харчування': 'food', 'Фінанси': 'money', "Здоровʼя": 'heart', 'Здоровя': 'heart',
  'Робота': 'work', 'Навчання': 'book', 'Ідеї': 'bulb', 'Особисте': 'person',
  'Подорожі': 'plane', 'Цілі': 'target', 'Спорт': 'sport', 'Музика': 'music',
  'Дім': 'home', 'Авто': 'car', 'Покупки': 'shopping', 'Люди': 'users',
  'Проекти': 'zap', 'Природа': 'leaf', 'Кава': 'coffee', 'Фото': 'camera',
};

const FOLDER_ICONS = Object.fromEntries(
  Object.entries(FOLDER_ICON_MAP).map(([name, key]) => [name, ICON_SVG[key]])
);
const FOLDER_ICON_DEFAULT = ICON_SVG.note;

// Всі іконки як масив для вибору в модалці
const ALL_FOLDER_ICONS = Object.keys(ICON_SVG);

function getFolderIcon(folder) {
  if (!folder) return FOLDER_ICON_DEFAULT;
  const meta = getFolderMeta(folder);
  if (meta.iconKey && ICON_SVG[meta.iconKey]) return ICON_SVG[meta.iconKey];
  if (FOLDER_ICONS[folder]) return FOLDER_ICONS[folder];
  const normalized = folder.replace(/[ʼ']/g, '').toLowerCase();
  const found = Object.keys(FOLDER_ICONS).find(k => k.replace(/[ʼ']/g, '').toLowerCase() === normalized);
  return found ? FOLDER_ICONS[found] : FOLDER_ICON_DEFAULT;
}

// === FOLDER META — кастомна іконка, колір, закріплення ===
function getFoldersMeta() {
  try { return JSON.parse(localStorage.getItem('nm_folders_meta') || '{}'); } catch { return {}; }
}
function saveFoldersMeta(obj) {
  try { localStorage.setItem('nm_folders_meta', JSON.stringify(obj)); } catch {} }
function getFolderMeta(folder) { return getFoldersMeta()[folder] || {}; }
function setFolderMeta(folder, data) {
  const all = getFoldersMeta();
  all[folder] = { ...(all[folder] || {}), ...data };
  saveFoldersMeta(all);
}

const FOLDER_COLORS = {
  'Харчування': { bg: 'linear-gradient(135deg,#f5ede0,#ede0cc)', border: 'rgba(255,255,255,0.4)', dot: '🥑' },
  'Фінанси':   { bg: 'linear-gradient(135deg,#f5ede0,#ede0cc)', border: 'rgba(255,255,255,0.4)', dot: '💸' },
  "Здоровʼя":  { bg: 'linear-gradient(135deg,#f5ede0,#ede0cc)', border: 'rgba(255,255,255,0.4)', dot: '💪' },
  'Здоровя':   { bg: 'linear-gradient(135deg,#f5ede0,#ede0cc)', border: 'rgba(255,255,255,0.4)', dot: '💪' },
  'Робота':    { bg: 'linear-gradient(135deg,#f5ede0,#ede0cc)', border: 'rgba(255,255,255,0.4)', dot: '🎯' },
  'Навчання':  { bg: 'linear-gradient(135deg,#f5ede0,#ede0cc)', border: 'rgba(255,255,255,0.4)', dot: '🧠' },
  'Ідеї':      { bg: 'linear-gradient(135deg,#f5ede0,#ede0cc)', border: 'rgba(255,255,255,0.4)', dot: '💡' },
  'Особисте':  { bg: 'linear-gradient(135deg,#f5ede0,#ede0cc)', border: 'rgba(255,255,255,0.4)', dot: '⚡' },
  'Подорожі':  { bg: 'linear-gradient(135deg,#f5ede0,#ede0cc)', border: 'rgba(255,255,255,0.4)', dot: '✈️' },
};
const DEFAULT_NOTE_FOLDER = { bg: 'linear-gradient(135deg,#f5ede0,#ede0cc)', border: 'rgba(255,255,255,0.4)', dot: '📝' };

export function renderNotes(searchQuery = '') {
  let notes = getNotes();
  const content = document.getElementById('notes-content');
  const empty = document.getElementById('notes-empty');
  const header = document.getElementById('notes-folder-header');

  if (notes.length === 0) {
    content.innerHTML = '';
    empty.style.display = 'block';
    if (header) header.style.display = 'none';
    return;
  }
  empty.style.display = 'none';

  // Якщо пошук — показуємо всі записи без папок
  if (searchQuery) {
    if (header) header.style.display = 'none';
    const q = searchQuery.toLowerCase();
    notes = notes.filter(n => n.text.toLowerCase().includes(q) || (n.folder || '').toLowerCase().includes(q));
    if (notes.length === 0) {
      content.innerHTML = '<div style="text-align:center;padding:40px 32px;color:rgba(30,16,64,0.35);font-size:15px">Нічого не знайдено</div>';
      return;
    }
    content.innerHTML = renderNotesList(notes);
    return;
  }

  // Рівень 2 — записи в конкретній папці
  if (currentNotesFolder !== null) {
    if (header) {
      const fc = getFolderColor(currentNotesFolder);
      header.style.display = 'flex';
      header.innerHTML = `
        <button onclick="closeNotesFolder()" style="background:none;border:none;cursor:pointer;display:flex;align-items:center;gap:6px;padding:0;font-size:15px;font-weight:700;color:#1e1040">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1e1040" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
          Назад
        </button>
        <span style="display:flex;align-items:center;gap:8px;font-size:16px;font-weight:800;color:#1e1040">${getFolderIcon(currentNotesFolder)} ${escapeHtml(currentNotesFolder)}</span>
        <span style="font-size:13px;font-weight:600;color:rgba(30,16,64,0.4)">${notes.filter(n=>(n.folder||'Загальне')===currentNotesFolder).length}</span>
      `;
    }
    const folderNotes = notes.filter(n => (n.folder || 'Загальне') === currentNotesFolder);
    content.innerHTML = folderNotes.length
      ? '<div style="padding:0 14px 120px">' + renderNotesList(folderNotes) + '</div>'
      : '<div style="text-align:center;padding:40px 32px;color:rgba(30,16,64,0.35);font-size:15px">Папка порожня</div>';
    return;
  }

  // Рівень 1 — список папок
  if (header) header.style.display = 'none';
  const byFolder = {};
  notes.forEach(n => {
    const f = n.folder || 'Загальне';
    if (!byFolder[f]) byFolder[f] = [];
    byFolder[f].push(n);
  });

  // Сортуємо: закріплені зверху, потім за кількістю
  const allMeta = getFoldersMeta();
  const folders = Object.entries(byFolder).sort((a, b) => {
    const pinA = allMeta[a[0]]?.pinned ? 1 : 0;
    const pinB = allMeta[b[0]]?.pinned ? 1 : 0;
    if (pinB !== pinA) return pinB - pinA;
    return b[1].length - a[1].length;
  });

  content.innerHTML = '<div style="padding:0 14px 120px;display:flex;flex-direction:column;gap:10px">' +
    folders.map(([folder, items]) => {
      const meta = getFolderMeta(folder);
      // Колір — з мета або дефолт
      const colorDef = meta.colorKey && FOLDER_COLOR_PALETTE[meta.colorKey]
        ? FOLDER_COLOR_PALETTE[meta.colorKey]
        : null;
      const fc = colorDef ? { bg: colorDef.bg, border: 'rgba(255,255,255,0.5)' } : getFolderColor(folder);
      const preview = items[0].text.length > 60 ? items[0].text.substring(0,60) + '…' : items[0].text;
      const safeFolder = escapeHtml(folder).replace(/'/g, "\\'");
      const key = btoa(unescape(encodeURIComponent(folder))).replace(/[^a-zA-Z0-9]/g, '_');
      const pinBadge = meta.pinned ? '<div style="position:absolute;top:8px;right:8px;font-size:10px;opacity:0.4">📌</div>' : '';
      const desc = meta.desc ? `<div style="font-size:11px;color:rgba(30,16,64,0.38);margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(meta.desc)}</div>` : `<div style="font-size:12px;color:rgba(30,16,64,0.45);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(preview)}</div>`;
      return `<div style="position:relative;border-radius:18px">
        <div id="folder-del-${key}" style="position:absolute;right:0;top:0;bottom:0;width:72px;background:linear-gradient(135deg,#ef4444,#dc2626);display:flex;align-items:center;justify-content:center;pointer-events:none;border-radius:18px;opacity:0;transition:opacity 0.15s"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg></div>
        <div id="folder-item-${key}"
          ontouchstart="folderSwipeStart(event,'${safeFolder}')"
          ontouchmove="folderSwipeMove(event,'${safeFolder}')"
          ontouchend="folderSwipeEnd(event,'${safeFolder}')"
          style="cursor:pointer;border-radius:18px;padding:16px;background:${fc.bg};border:1.5px solid ${fc.border};box-shadow:0 2px 12px rgba(0,0,0,0.05);display:flex;align-items:center;gap:14px;position:relative;z-index:1">
          ${pinBadge}
          <div style="width:48px;height:48px;border-radius:14px;background:rgba(255,255,255,0.4);display:flex;align-items:center;justify-content:center;flex-shrink:0">${getFolderIcon(folder)}</div>
          <div style="flex:1;min-width:0">
            <div style="font-size:16px;font-weight:800;color:#1e1040;margin-bottom:2px">${escapeHtml(folder)}</div>
            ${desc}
          </div>
          <div style="display:flex;flex-direction:column;align-items:center;gap:2px;flex-shrink:0;min-width:44px">
            <div style="font-size:20px;font-weight:900;color:#1e1040;line-height:1">${items.length}</div>
            <div style="font-size:10px;font-weight:600;color:rgba(30,16,64,0.4)">записів</div>
          </div>
          <div ontouchend="event.stopPropagation();event.preventDefault();openFolderEditModal('${safeFolder}')" onclick="event.stopPropagation();openFolderEditModal('${safeFolder}')" style="position:absolute;top:8px;right:8px;padding:6px 8px;cursor:pointer;color:rgba(30,16,64,0.35);font-size:18px;line-height:1;border-radius:8px;-webkit-tap-highlight-color:transparent;min-width:32px;text-align:center">···</div>
        </div>
      </div>`;
    }).join('') + '</div>';
}

function renderNotesList(notes) {
  const now = Date.now();
  return notes.map(n => {
    const fc = getFolderColor(n.folder || 'Загальне');
    const preview = n.text.length > 80 ? n.text.substring(0, 80) + '…' : n.text;
    return `
      <div class="note-item-wrap" id="note-wrap-${n.id}" style="position:relative;border-radius:var(--card-radius);margin-bottom:8px">
        <div id="note-item-${n.id}" class="inbox-item"
          ontouchstart="noteSwipeStart(event,${n.id})"
          ontouchmove="noteSwipeMove(event,${n.id})"
          ontouchend="noteSwipeEnd(event,${n.id})"
          style="cursor:default;padding:12px 13px;width:100%;box-sizing:border-box;background:${fc.bg};border-color:${fc.border};">
          <div onclick="openNoteView(${n.id})" style="cursor:pointer">
            <div style="font-size:15px;line-height:1.55;color:#1e1040;font-weight:500;margin-bottom:5px">${escapeHtml(preview)}</div>
            <div style="display:flex;align-items:center;justify-content:space-between">
              <div style="font-size:12px;color:rgba(30,16,64,0.3)">${formatTime(n.ts)}${n.source === 'inbox' ? ' · з Inbox' : n.source === 'agent' ? ' · через OWL' : ''}</div>
              <div onclick="event.stopPropagation();openNoteMenu(${n.id})" style="padding:4px 8px;cursor:pointer;color:rgba(30,16,64,0.4);font-size:22px;line-height:1;min-width:32px;text-align:center">···</div>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}


// === NOTE SWIPE TO DELETE ===
const noteSwipeState = {};

function noteSwipeStart(e, id) {
  const t = e.touches[0];
  noteSwipeState[id] = { startX: t.clientX, startY: t.clientY, dx: 0, swiping: false };
}
function noteSwipeMove(e, id) {
  const s = noteSwipeState[id]; if (!s) return;
  const t = e.touches[0];
  const dx = t.clientX - s.startX, dy = t.clientY - s.startY;
  if (!s.swiping && Math.abs(dy) > Math.abs(dx)) return;
  if (!s.swiping && Math.abs(dx) > 8) s.swiping = true;
  if (!s.swiping) return;
  e.preventDefault();
  s.dx = Math.min(0, dx);
  const el = document.getElementById(`note-item-${id}`);
  const wrap = document.getElementById(`note-wrap-${id}`);
  applySwipeTrail(el, wrap, s.dx);
}
function noteSwipeEnd(e, id) {
  const s = noteSwipeState[id]; if (!s) return;
  const el = document.getElementById(`note-item-${id}`);
  const wrap = document.getElementById(`note-wrap-${id}`);
  if (s.dx < -SWIPE_DELETE_THRESHOLD) {
    if (el) { el.style.transition = 'transform 0.2s ease, opacity 0.2s'; el.style.transform = 'translateX(-110%)'; el.style.opacity = '0'; }
    setTimeout(() => {
      const allNotes = getNotes();
      const noteSwipeIdx = allNotes.findIndex(x => x.id === id);
      const swipePredecessorId = noteSwipeIdx > 0 ? allNotes[noteSwipeIdx - 1].id : null;
      const item = allNotes.find(x => x.id === id);
      if (item) addToTrash('note', item);
      saveNotes(allNotes.filter(x => x.id !== id)); renderNotes();
      if (item) showUndoToast('Нотатку видалено', () => {
        const notes = getNotes();
        let idx;
        if (swipePredecessorId === null) {
          idx = 0;
        } else {
          const predIdx = notes.findIndex(x => x.id === swipePredecessorId);
          idx = predIdx !== -1 ? predIdx + 1 : notes.length;
        }
        notes.splice(idx, 0, item); saveNotes(notes); renderNotes();
      });
    }, 200);
  } else {
    clearSwipeTrail(el, wrap);
  }
  delete noteSwipeState[id];
}

// === NOTE CONTEXT MENU ===
let activeNoteMenuId = null;

function openNoteMenu(id) {
  activeNoteMenuId = id;
  document.getElementById('note-menu').style.display = 'flex';
}
function closeNoteMenu() {
  document.getElementById('note-menu').style.display = 'none';
  activeNoteMenuId = null;
}
function noteMenuEdit() {
  const id = activeNoteMenuId;
  closeNoteMenu();
  // Відкриваємо нотатку і фокусуємо текст для редагування
  if (activeNoteViewId !== id) openNoteView(id);
  setTimeout(() => {
    const textEl = document.getElementById('note-view-text');
    if (textEl) {
      textEl.focus();
      // Переміщуємо курсор в кінець тексту
      const range = document.createRange();
      range.selectNodeContents(textEl);
      range.collapse(false);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    }
  }, 100);
}
function noteMenuDelete() {
  const id = activeNoteMenuId;
  const fromView = activeNoteViewId === id;
  closeNoteMenu();
  if (fromView) closeNoteView();
  deleteNote(id);
}
function noteMenuCopy() {
  const notes = getNotes();
  const n = notes.find(x => x.id === activeNoteMenuId);
  if (!n) return;
  closeNoteMenu();
  if (navigator.clipboard) {
    navigator.clipboard.writeText(n.text).then(() => showToast('✓ Скопійовано'));
  } else {
    showToast('Копіювання недоступне');
  }
}
function noteMenuMove() {
  const id = activeNoteMenuId;
  closeNoteMenu();
  const notes = getNotes();
  const n = notes.find(x => x.id === id);
  if (!n) return;
  const folders = getFolders();
  const current = n.folder || 'Загальне';
  const folderList = folders.filter(f => f !== current);
  if (folderList.length === 0) {
    showToast('Немає інших папок');
    return;
  }
  // Simple prompt for now
  const newFolder = prompt(`Перемістити в папку:\n${folderList.join(', ')}\n\nПоточна: ${current}\nВведіть назву:`, current);
  if (newFolder && newFolder.trim() && newFolder.trim() !== current) {
    const idx = notes.findIndex(x => x.id === id);
    if (idx !== -1) notes[idx].folder = newFolder.trim();
    saveNotes(notes);
    renderNotes();
    showToast(`✓ Переміщено в "${newFolder.trim()}"`);
  }
}
export async function checkAndSuggestFolders() {
  const key = localStorage.getItem('nm_gemini_key');
  if (!key) return;
  const lastTs = localStorage.getItem('nm_notes_folders_ts');
  if (lastTs) {
    const last = new Date(parseInt(lastTs));
    if (last.toDateString() === new Date().toDateString()) return;
  }
  const notes = getNotes();
  if (notes.length < 5) return;
  await suggestNoteFolders();
}

async function suggestNoteFolders() {
  const notes = getNotes();
  if (notes.length === 0) return;
  const sample = notes.slice(0, 40).map(n => `"${n.text.substring(0, 60)}"`).join('\n');
  const systemPrompt = `Ти — організатор нотаток. Проаналізуй записи і запропонуй оптимальну структуру папок (3-6 папок). Відповідай ТІЛЬКИ JSON масивом: [{"folder":"Назва","description":"коротко що сюди входить"}]. Без markdown, без тексту поза JSON. ЗАБОРОНЕНО пропонувати папку "Чернетки".`;
  const reply = await callAI(systemPrompt, `Нотатки:\n${sample}`, {});
  if (!reply) return;
  try {
    const clean = reply.replace(/```json|```/g, '').trim();
    const folders = JSON.parse(clean);
    pendingFolderSuggestion = folders;
    localStorage.setItem('nm_notes_folders_ts', Date.now().toString());
    const banner = document.getElementById('notes-ai-banner');
    const textEl = document.getElementById('notes-ai-text');
    if (banner && textEl) {
      const names = folders.map(f => `📁 ${f.folder} — ${f.description}`).join('\n');
      textEl.textContent = `Пропоную структуру:\n${names}`;
      banner.style.display = 'block';
    }
  } catch { /* ігноруємо */ }
}

function applyFolderSuggestion() {
  if (!pendingFolderSuggestion) return;
  const notes = getNotes();
  let changed = 0;
  notes.forEach(n => {
    if (!n.folder || n.folder === 'Загальне') {
      // Знаходимо найближчу папку по ключовим словам з опису
      for (const f of pendingFolderSuggestion) {
        const keywords = f.description.toLowerCase().split(/[\s,]+/);
        const noteText = n.text.toLowerCase();
        if (keywords.some(kw => kw.length > 3 && noteText.includes(kw))) {
          n.folder = f.folder;
          changed++;
          break;
        }
      }
    }
  });
  saveNotes(notes);
  renderNotes();
  updateFolderSuggestions();
  document.getElementById('notes-ai-banner').style.display = 'none';
  showToast(changed > 0 ? `✓ Розкладено ${changed} нотаток по папках` : '✓ Папки збережено як орієнтир');
}

// === NOTE VIEW MODAL (F2) ===
let activeNoteViewId = null;
let noteChatHistory = [];
let noteChatLoading = false;

function getFolderColor(folder) {
  if (!folder) return DEFAULT_NOTE_FOLDER;
  // Пряме співпадіння
  if (FOLDER_COLORS[folder]) return FOLDER_COLORS[folder];
  // Нечутливе до апострофа (ʼ vs ' vs без)
  const normalized = folder.replace(/[ʼ']/g, '').toLowerCase();
  const found = Object.keys(FOLDER_COLORS).find(k => k.replace(/[ʼ']/g, '').toLowerCase() === normalized);
  return found ? FOLDER_COLORS[found] : DEFAULT_NOTE_FOLDER;
}

function openNoteView(id) {
  const notes = getNotes();
  const n = notes.find(x => x.id === id);
  if (!n) return;
  activeNoteViewId = id;
  noteChatHistory = [];
  noteChatLoading = false;

  // Колір фону = колір картки нотатки
  const fc = getFolderColor(n.folder);
  const modal = document.getElementById('note-view-modal');
  if (modal) modal.style.background = fc.bg;

  document.getElementById('note-view-folder').textContent = n.folder || 'Загальне';
  const preview = n.text.length > 50 ? n.text.substring(0, 50) + '…' : n.text;
  document.getElementById('note-view-preview').textContent = preview;

  // contenteditable — встановлюємо текст
  const textEl = document.getElementById('note-view-text');
  if (textEl) textEl.textContent = n.text;

  document.getElementById('note-chat-messages').innerHTML = '';

  // Update lastViewed
  const allNotes = getNotes();
  const idx = allNotes.findIndex(x => x.id === id);
  if (idx !== -1) { allNotes[idx].lastViewed = Date.now(); saveNotes(allNotes); }

  switchNoteViewTab('note');
  modal.style.display = 'flex';
  // Скролимо до початку тексту
  requestAnimationFrame(() => {
    const panel = document.getElementById('note-view-panel-note');
    if (panel) panel.scrollTop = 0;
    const textEl2 = document.getElementById('note-view-text');
    if (textEl2) textEl2.scrollTop = 0;
  });
}

export function closeNoteView() {
  // Зберігаємо перед закриттям
  if (activeNoteViewId) {
    const textEl = document.getElementById('note-view-text');
    if (textEl) {
      const notes = getNotes();
      const idx = notes.findIndex(x => x.id === activeNoteViewId);
      if (idx !== -1 && textEl.textContent !== notes[idx].text) {
        notes[idx].text = textEl.textContent;
        notes[idx].updatedAt = Date.now();
        saveNotes(notes);
        if (currentTab === 'notes') renderNotes();
      }
    }
  }
  document.getElementById('note-view-modal').style.display = 'none';
  activeNoteViewId = null;
  noteChatHistory = [];
}

let _autoSaveNoteTimer = null;
function autoSaveNoteView() {
  if (!activeNoteViewId) return;
  if (_autoSaveNoteTimer) clearTimeout(_autoSaveNoteTimer);
  _autoSaveNoteTimer = setTimeout(() => {
    const textEl = document.getElementById('note-view-text');
    if (!textEl) return;
    const notes = getNotes();
    const idx = notes.findIndex(x => x.id === activeNoteViewId);
    if (idx !== -1) {
      notes[idx].text = textEl.textContent;
      notes[idx].updatedAt = Date.now();
      saveNotes(notes);
      // Оновлюємо preview в хедері
      const preview = notes[idx].text.length > 50 ? notes[idx].text.substring(0, 50) + '…' : notes[idx].text;
      const prevEl = document.getElementById('note-view-preview');
      if (prevEl) prevEl.textContent = preview;
    }
  }, 800); // зберігаємо через 800мс після зупинки друку
}

function openNoteViewMenu() {
  if (!activeNoteViewId) return;
  const notes = getNotes();
  const n = notes.find(x => x.id === activeNoteViewId);
  if (!n) return;
  // Використовуємо існуюче меню нотаток
  activeNoteMenuId = activeNoteViewId;
  document.getElementById('note-menu').style.display = 'flex';
}

function openEditNoteFromView() {
  const id = activeNoteViewId;
  closeNoteView();
  openEditNote(id);
}

function switchNoteViewTab(tab) {
  const notePanel = document.getElementById('note-view-panel-note');
  const chatPanel = document.getElementById('note-view-panel-chat');
  const inputArea = document.getElementById('note-chat-input-area');
  const tabNote = document.getElementById('note-view-tab-note');
  const tabChat = document.getElementById('note-view-tab-chat');

  if (tab === 'note') {
    notePanel.style.display = 'block';
    chatPanel.style.display = 'none';
    inputArea.style.display = 'none';
    tabNote.style.color = '#c2620a';
    tabNote.style.borderBottomColor = '#c2620a';
    tabChat.style.color = 'rgba(30,16,64,0.4)';
    tabChat.style.borderBottomColor = 'transparent';
  } else {
    notePanel.style.display = 'none';
    chatPanel.style.display = 'flex';
    chatPanel.style.flexDirection = 'column';
    inputArea.style.display = 'flex';
    tabNote.style.color = 'rgba(30,16,64,0.4)';
    tabNote.style.borderBottomColor = 'transparent';
    tabChat.style.color = '#c2620a';
    tabChat.style.borderBottomColor = '#c2620a';

    // Auto-greet if first open
    if (noteChatHistory.length === 0) {
      const notes = getNotes();
      const n = notes.find(x => x.id === activeNoteViewId);
      if (n) initNoteChatGreeting(n);
    }
  }
}

async function initNoteChatGreeting(note) {
  const key = localStorage.getItem('nm_gemini_key');
  if (!key) {
    addNoteChatMsg('agent', 'Введи OpenAI ключ в налаштуваннях щоб спілкуватись з агентом.');
    return;
  }
  const aiContext = getAIContext();
  const systemPrompt = `${getOWLPersonality()} Тебе попросили поговорити про конкретну нотатку. Прочитай її і скажи коротко (1-2 речення): що це за нотатка і як ти можеш допомогти з нею. Відповідай українською.${aiContext ? '\n\n' + aiContext : ''}`;
  const greeting = await callAI(systemPrompt, `Нотатка: ${note.text}`, {});
  if (greeting) addNoteChatMsg('agent', greeting);
}

function addNoteChatMsg(role, text) {
  const el = document.getElementById('note-chat-messages');
  const isAgent = role === 'agent';
  const div = document.createElement('div');
  div.style.cssText = `display:flex;${isAgent ? '' : 'justify-content:flex-end'}`;
  div.innerHTML = `<div style="max-width:82%;background:${isAgent ? 'rgba(255,255,255,0.9)' : '#4f46e5'};color:${isAgent ? '#1e1040' : 'white'};border-radius:${isAgent ? '4px 14px 14px 14px' : '14px 4px 14px 14px'};padding:12px 16px;font-size:18px;line-height:1.7;font-weight:${isAgent ? '400' : '500'}">${escapeHtml(text)}</div>`;
  el.appendChild(div);
  el.scrollTop = el.scrollHeight;
  if (role !== 'agent') noteChatHistory.push({ role: 'user', content: text });
}

async function sendNoteChatMessage() {
  if (noteChatLoading) return;
  const input = document.getElementById('note-chat-input');
  const text = input.value.trim();
  if (!text) return;
  const key = localStorage.getItem('nm_gemini_key');
  if (!key) { addNoteChatMsg('agent', 'Введи OpenAI ключ в налаштуваннях.'); return; }

  input.value = '';
  input.style.height = 'auto';
  addNoteChatMsg('user', text);
  noteChatLoading = true;

  const btn = document.getElementById('note-chat-send');
  btn.disabled = true;

  const notes = getNotes();
  const n = notes.find(x => x.id === activeNoteViewId);
  const aiContext = getAIContext();
  const currentText = n?.text || '';

  const systemPrompt = `${getOWLPersonality()} Ти асистент для роботи з нотаткою користувача.

Поточний текст нотатки:
---
${currentText}
---

Ти можеш:
1. Відповідати на питання про нотатку — звичайний текст
2. Оновлювати нотатку — якщо просять написати, доповнити, змінити, структурувати, додати список тощо

Якщо потрібно ОНОВИТИ нотатку — відповідай ТІЛЬКИ JSON:
{"action":"update_note","text":"повний новий текст нотатки"}

Якщо просто відповідаєш — відповідай звичайним текстом (2-4 речення).
НЕ використовуй JSON якщо тільки обговорюєш або пояснюєш.
${aiContext ? '\n\n' + aiContext : ''}`;

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          ...noteChatHistory.slice(-10),
          { role: 'user', content: text }
        ],
        max_tokens: 800,
        temperature: 0.7
      })
    });
    const data = await res.json();
    const reply = data.choices?.[0]?.message?.content;
    if (reply) {
      noteChatHistory.push({ role: 'user', content: text });
      noteChatHistory.push({ role: 'assistant', content: reply });
      // Перевіряємо чи це JSON з update_note
      try {
        const clean = reply.replace(/^```json\s*|```\s*$/g, '').trim();
        const parsed = JSON.parse(clean);
        if (parsed.action === 'update_note' && parsed.text) {
          // Оновлюємо нотатку
          const allNotes = getNotes();
          const idx = allNotes.findIndex(x => x.id === activeNoteViewId);
          if (idx !== -1) {
            allNotes[idx].text = parsed.text;
            allNotes[idx].updatedAt = Date.now();
            saveNotes(allNotes);
            // Оновлюємо відображення в редакторі
            const textEl = document.getElementById('note-view-text');
            if (textEl) textEl.textContent = parsed.text;
            renderNotes();
            addNoteChatMsg('agent', '✓ Нотатку оновлено.');
          } else {
            addNoteChatMsg('agent', 'Не вдалося знайти нотатку.');
          }
        } else {
          addNoteChatMsg('agent', reply);
          showSaveAsNoteBtn(reply);
        }
      } catch {
        addNoteChatMsg('agent', reply);
        showSaveAsNoteBtn(reply);
      }
    } else {
      addNoteChatMsg('agent', 'Щось пішло не так. Спробуй ще раз.');
    }
  } catch {
    addNoteChatMsg('agent', 'Мережева помилка.');
  }
  noteChatLoading = false;
  btn.disabled = false;
}

// Зберігаємо текст у closure — безпечно для будь-яких символів
let _pendingAgentNote = '';

function showSaveAsNoteBtn(replyText) {
  const el = document.getElementById('note-chat-messages');
  const old = document.getElementById('note-chat-save-btn');
  if (old) old.remove();
  _pendingAgentNote = replyText;
  const btn = document.createElement('div');
  btn.id = 'note-chat-save-btn';
  btn.style.cssText = 'display:flex;justify-content:flex-end;margin-top:-4px';
  const button = document.createElement('button');
  button.textContent = '+ Зберегти як нотатку';
  button.style.cssText = 'background:rgba(79,70,229,0.1);border:1px solid rgba(79,70,229,0.2);border-radius:8px;padding:5px 12px;font-size:13px;font-weight:700;color:#4f46e5;cursor:pointer';
  button.addEventListener('click', () => saveAgentResponseAsNote(_pendingAgentNote));
  btn.appendChild(button);
  el.appendChild(btn);
  el.scrollTop = el.scrollHeight;
}

function saveAgentResponseAsNote(text) {
  const notes = getNotes();
  const originalNote = notes.find(x => x.id === activeNoteViewId);
  const folder = originalNote?.folder || 'Загальне';
  notes.unshift({ id: Date.now(), text: text, folder, source: 'ai', ts: Date.now(), lastViewed: Date.now() });
  saveNotes(notes);
  renderNotes();
  showToast('✓ Збережено як нотатку');
  document.getElementById('note-chat-save-btn')?.remove();
  _pendingAgentNote = '';
}


// === FOLDER SWIPE TO DELETE ===
const folderSwipeState = {};

function _folderKey(folder) {
  return btoa(unescape(encodeURIComponent(folder))).replace(/[^a-zA-Z0-9]/g, '_');
}
function folderSwipeStart(e, folder) {
  const t = e.touches[0];
  const key = _folderKey(folder);
  folderSwipeState[key] = { startX: t.clientX, startY: t.clientY, dx: 0, swiping: false, folder };
}
function folderSwipeMove(e, folder) {
  const key = _folderKey(folder);
  const s = folderSwipeState[key]; if (!s) return;
  const t = e.touches[0];
  const dx = t.clientX - s.startX, dy = t.clientY - s.startY;
  if (!s.swiping && Math.abs(dy) > Math.abs(dx)) { delete folderSwipeState[key]; return; }
  if (!s.swiping && Math.abs(dx) > 8) s.swiping = true;
  if (!s.swiping) return;
  e.preventDefault();
  s.dx = Math.min(0, dx);
  const el = document.getElementById('folder-item-' + key);
  const wrap = el ? el.parentElement : null;
  applySwipeTrail(el, wrap, s.dx);
}
function folderSwipeEnd(e, folder) {
  const key = _folderKey(folder);
  const s = folderSwipeState[key]; if (!s) return;
  const el = document.getElementById('folder-item-' + key);
  const wrap = el ? el.parentElement : null;
  if (s.dx < -SWIPE_DELETE_THRESHOLD) {
    if (el) { el.style.transition = 'transform 0.2s ease, opacity 0.2s'; el.style.transform = 'translateX(-110%)'; el.style.opacity = '0'; }
    setTimeout(() => {
      const notes = getNotes();
      const folderNotes = notes.filter(n => (n.folder || 'Загальне') === folder);
      const remaining = notes.filter(n => (n.folder || 'Загальне') !== folder);
      if (folderNotes.length > 0) addToTrash('folder', { folder }, folderNotes);
      saveNotes(remaining);
      renderNotes();
      if (folderNotes.length > 0) showUndoToast('Папку "' + folder + '" видалено (' + folderNotes.length + ')', () => {
        const n = getNotes();
        folderNotes.forEach(note => n.push(note));
        saveNotes(n);
        renderNotes();
      });
    }, 200);
  } else {
    clearSwipeTrail(el, wrap);
    if (!s.swiping) openNotesFolder(folder);
  }
  delete folderSwipeState[key];
}

// === FOLDER EDIT MODAL (#20) ===
let _editingFolder = null;

function openFolderEditModal(folder) {
  _editingFolder = folder;
  const meta = getFolderMeta(folder);

  // Встановлюємо поточні значення
  const nameEl = document.getElementById('folder-edit-name');
  const descEl = document.getElementById('folder-edit-desc');
  const pinEl = document.getElementById('folder-edit-pin');
  if (nameEl) nameEl.value = folder;
  if (descEl) descEl.value = meta.desc || '';
  if (pinEl) pinEl.checked = !!meta.pinned;

  // Рендеримо сітку іконок
  renderFolderIconGrid(meta.iconKey || _autoIconKey(folder));

  // Рендеримо кольори
  renderFolderColorGrid(meta.colorKey || 'default');

  const modal = document.getElementById('folder-edit-modal');
  if (modal) modal.style.display = 'flex';
}

function closeFolderEditModal() {
  const modal = document.getElementById('folder-edit-modal');
  if (modal) modal.style.display = 'none';
  _editingFolder = null;
}

function _autoIconKey(folder) {
  const norm = folder.replace(/[ʼ']/g, '').toLowerCase();
  const match = Object.entries(FOLDER_ICON_MAP).find(([name]) =>
    name.replace(/[ʼ']/g, '').toLowerCase() === norm
  );
  return match ? match[1] : 'folder';
}

let _selectedIconKey = 'folder';
let _selectedColorKey = 'default';

function renderFolderIconGrid(activeKey) {
  _selectedIconKey = activeKey;
  const grid = document.getElementById('folder-icon-grid');
  if (!grid) return;
  grid.innerHTML = ALL_FOLDER_ICONS.map(key => {
    const isActive = key === activeKey;
    return `<div onclick="selectFolderIcon('${key}')" id="ficon-${key}" style="width:44px;height:44px;border-radius:12px;display:flex;align-items:center;justify-content:center;cursor:pointer;background:${isActive ? 'rgba(30,16,64,0.1)' : 'rgba(30,16,64,0.03)'};border:1.5px solid ${isActive ? 'rgba(30,16,64,0.25)' : 'transparent'};transition:all 0.15s">
      ${ICON_SVG[key]}
    </div>`;
  }).join('');
}

function selectFolderIcon(key) {
  _selectedIconKey = key;
  document.querySelectorAll('[id^="ficon-"]').forEach(el => {
    const k = el.id.replace('ficon-', '');
    const isActive = k === key;
    el.style.background = isActive ? 'rgba(30,16,64,0.1)' : 'rgba(30,16,64,0.03)';
    el.style.border = `1.5px solid ${isActive ? 'rgba(30,16,64,0.25)' : 'transparent'}`;
  });
}

const FOLDER_COLOR_PALETTE = {
  default: { bg: 'linear-gradient(135deg,#f5ede0,#ede0cc)', label: 'Пісок' },
  blue:    { bg: 'linear-gradient(135deg,#dbeafe,#bfdbfe)', label: 'Блакитний' },
  green:   { bg: 'linear-gradient(135deg,#d1fae5,#a7f3d0)', label: 'Зелений' },
  yellow:  { bg: 'linear-gradient(135deg,#fef9c3,#fef08a)', label: 'Жовтий' },
  pink:    { bg: 'linear-gradient(135deg,#fce7f3,#fbcfe8)', label: 'Рожевий' },
  purple:  { bg: 'linear-gradient(135deg,#ede9fe,#ddd6fe)', label: 'Фіолетовий' },
  orange:  { bg: 'linear-gradient(135deg,#ffedd5,#fed7aa)', label: 'Оранжевий' },
  gray:    { bg: 'linear-gradient(135deg,#f3f4f6,#e5e7eb)', label: 'Сірий' },
};

function renderFolderColorGrid(activeKey) {
  _selectedColorKey = activeKey;
  const grid = document.getElementById('folder-color-grid');
  if (!grid) return;
  grid.innerHTML = Object.entries(FOLDER_COLOR_PALETTE).map(([key, val]) => {
    const isActive = key === activeKey;
    return `<div onclick="selectFolderColor('${key}')" id="fcolor-${key}" title="${val.label}" style="width:36px;height:36px;border-radius:10px;cursor:pointer;background:${val.bg};border:2.5px solid ${isActive ? 'rgba(30,16,64,0.4)' : 'transparent'};transition:all 0.15s"></div>`;
  }).join('');
}

function selectFolderColor(key) {
  _selectedColorKey = key;
  document.querySelectorAll('[id^="fcolor-"]').forEach(el => {
    const k = el.id.replace('fcolor-', '');
    el.style.border = `2.5px solid ${k === key ? 'rgba(30,16,64,0.4)' : 'transparent'}`;
  });
}

function saveFolderEdit() {
  if (!_editingFolder) return;
  const nameEl = document.getElementById('folder-edit-name');
  const descEl = document.getElementById('folder-edit-desc');
  const pinEl = document.getElementById('folder-edit-pin');
  const newName = (nameEl?.value || '').trim() || _editingFolder;
  const desc = descEl?.value || '';
  const pinned = !!pinEl?.checked;

  // Перевіряємо ліміт закріплених (макс 5)
  if (pinned) {
    const meta = getFoldersMeta();
    const pinnedCount = Object.values(meta).filter(m => m.pinned).length;
    const wasAlreadyPinned = getFolderMeta(_editingFolder).pinned;
    if (!wasAlreadyPinned && pinnedCount >= 5) {
      showToast('Максимум 5 закріплених папок');
      return;
    }
  }

  // Перейменування — оновлюємо всі нотатки
  if (newName !== _editingFolder) {
    const notes = getNotes();
    notes.forEach(n => { if ((n.folder || 'Загальне') === _editingFolder) n.folder = newName; });
    saveNotes(notes);
    // Переносимо мету
    const allMeta = getFoldersMeta();
    if (allMeta[_editingFolder]) {
      allMeta[newName] = allMeta[_editingFolder];
      delete allMeta[_editingFolder];
      saveFoldersMeta(allMeta);
    }
  }

  setFolderMeta(newName, { iconKey: _selectedIconKey, colorKey: _selectedColorKey, desc, pinned });
  closeFolderEditModal();
  renderNotes();
  showToast('✓ Папку оновлено');
}

// === NOTES AI BAR ===
let _notesTypingEl = null;
let notesBarHistory = [];
let notesBarLoading = false;

export function addNotesChatMsg(role, text, _noSave = false) {
  const el = document.getElementById('notes-chat-messages');
  if (!el) return;
  if (_notesTypingEl) { _notesTypingEl.remove(); _notesTypingEl = null; }
  if (role === 'typing') {
    const td = document.createElement('div');
    td.style.cssText = 'display:flex';
    td.innerHTML = '<div style="background:rgba(255,255,255,0.12);border-radius:4px 12px 12px 12px;padding:5px 10px"><div class=\"ai-typing\"><span></span><span></span><span></span></div></div>';
    el.appendChild(td);
    _notesTypingEl = td;
    el.scrollTop = el.scrollHeight;
    return;
  }
  if (!_noSave) { try { openChatBar('notes'); } catch(e) {} }
  const isAgent = role === 'agent';
  const div = document.createElement('div');
  div.style.cssText = `display:flex;${isAgent ? '' : 'justify-content:flex-end'}`;
  div.innerHTML = `<div class="msg-bubble ${isAgent ? 'msg-bubble--agent' : 'msg-bubble--user'}">${escapeHtml(text)}</div>`;
  el.appendChild(div);
  el.scrollTop = el.scrollHeight;
  if (role !== 'agent') notesBarHistory.push({ role: 'user', content: text });
  else notesBarHistory.push({ role: 'assistant', content: text });
  if (!_noSave) saveChatMsg('notes', role, text);
}

export async function sendNotesBarMessage() {
  if (notesBarLoading) return;
  const input = document.getElementById('notes-bar-input');
  const text = input.value.trim();
  if (!text) return;
  const key = localStorage.getItem('nm_gemini_key');
  if (!key) { addNotesChatMsg('agent', 'Введи OpenAI ключ в налаштуваннях.'); return; }
  input.value = ''; input.style.height = 'auto';
  input.focus();
  addNotesChatMsg('user', text);
  notesBarLoading = true;
  addNotesChatMsg('typing', '');

  const notes = getNotes().slice(0, 20).map(n => `[${n.folder||'Загальне'}] ${n.text.substring(0,60)}`).join('; ');
  const aiContext = getAIContext();
  const systemPrompt = getOWLPersonality() + ` Ти допомагаєш у вкладці Нотатки. Відповідай JSON для дій:
- Створити нотатку: {"action":"create_note","text":"текст","folder":"папка або null"}
- Видалити папку: {"action":"delete_folder","folder":"назва папки"}
- Перемістити нотатку: {"action":"move_note","query":"частина тексту нотатки","folder":"нова папка"}
- Знайти нотатки по запиту: {"action":"search_notes","query":"ключові слова"}
- Відкрити папку: {"action":"open_folder","folder":"назва папки"}
- Відкрити нотатку: {"action":"open_note","query":"частина тексту нотатки"}
- Створити задачу: {"action":"create_task","title":"назва","steps":[]}
- Створити звичку: {"action":"create_habit","name":"назва","days":[0,1,2,3,4,5,6]}
- Редагувати звичку: {"action":"edit_habit","habit_id":ID,"name":"нова назва","days":[0,1,2,3,4,5,6]} — якщо юзер каже змінити існуючу звичку
- Закрити задачу: {"action":"complete_task","task_id":ID}
- Відмітити звичку: {"action":"complete_habit","habit_name":"назва"}
- Редагувати задачу: {"action":"edit_task","task_id":ID,"title":"нова назва","dueDate":"YYYY-MM-DD","priority":"normal|important|critical"}
- Видалити задачу: {"action":"delete_task","task_id":ID}
- Видалити звичку: {"action":"delete_habit","habit_id":ID}
- Перевідкрити задачу: {"action":"reopen_task","task_id":ID}
- Записати момент дня: {"action":"add_moment","text":"що сталося"}
- Зберегти фінанси: {"action":"save_finance","fin_type":"expense або income","amount":число,"category":"категорія","comment":"коментар"}
- Запланована подія: {"action":"create_event","title":"назва","date":"YYYY-MM-DD","time":null,"priority":"normal"}
- Змінити подію: {"action":"edit_event","event_id":ID,"date":"YYYY-MM-DD"}
- Видалити подію: {"action":"delete_event","event_id":ID}
- Змінити нотатку: {"action":"edit_note","note_id":ID,"text":"новий текст","folder":"папка"}
- Розпорядок: {"action":"save_routine","day":"mon" або ["mon","tue","wed","thu","fri"],"blocks":[{"time":"07:00","activity":"Підйом"}]}
ЗАДАЧА = дія яку ТИ маєш ЗРОБИТИ. ПОДІЯ = факт що СТАНЕТЬСЯ. "Перенеси подію на 24" = edit_event.
- Просто відповісти: текст (1-3 речення)
ВАЖЛИВО: для open_folder — fuzzy match назви, для search_notes — шукай по тексту нотаток.
Наявні папки: ${[...new Set(getNotes().map(n => n.folder || 'Загальне'))].join(', ') || 'немає'}
НЕ вигадуй дані яких немає в контексті.` + (aiContext ? ('\n\n' + aiContext) : '');

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'system', content: systemPrompt }, ...notesBarHistory.slice(-8)], max_tokens: 300, temperature: 0.7 })
    });
    const data = await res.json();
    const reply = data.choices?.[0]?.message?.content?.trim();
    if (!reply) { addNotesChatMsg('agent', 'Щось пішло не так.'); notesBarLoading = false; return; }

    try {
      const parsed = JSON.parse(reply.replace(/```json|```/g, '').trim());

      // Дії специфічні для нотаток
      if (parsed.action === 'search_notes') {
        const q = (parsed.query || '').toLowerCase();
        const results = getNotes().filter(n =>
          n.text.toLowerCase().includes(q) ||
          (n.folder || '').toLowerCase().includes(q)
        ).slice(0, 5);
        if (results.length === 0) {
          addNotesChatMsg('agent', `Нічого не знайдено по запиту "${parsed.query}".`);
        } else {
          addNotesChatMsg('agent', `Знайдено ${results.length}:`);
          results.forEach(n => {
            const preview = n.text.length > 60 ? n.text.substring(0, 60) + '…' : n.text;
            const el = document.getElementById('notes-chat-messages');
            if (!el) return;
            const div = document.createElement('div');
            div.style.cssText = 'display:flex';
            div.innerHTML = `<div onclick="addNotesChatMsg('user','');openNoteView(${n.id})" style="max-width:85%;background:rgba(255,255,255,0.12);color:white;border-radius:4px 12px 12px 12px;padding:8px 11px;font-size:14px;line-height:1.5;font-weight:500;cursor:pointer;border:1px solid rgba(255,255,255,0.15)">
              <div style="font-size:10px;font-weight:700;color:rgba(255,255,255,0.45);margin-bottom:3px">${escapeHtml(n.folder || 'Загальне')}</div>
              ${escapeHtml(preview)}
            </div>`;
            el.appendChild(div);
            el.scrollTop = el.scrollHeight;
          });
        }
        notesBarLoading = false;
        return;
      }

      if (parsed.action === 'open_folder') {
        const target = (parsed.folder || '').toLowerCase().replace(/[ʼ']/g, '');
        const folders = [...new Set(getNotes().map(n => n.folder || 'Загальне'))];
        const match = folders.find(f =>
          f.toLowerCase().replace(/[ʼ']/g, '').includes(target) ||
          target.includes(f.toLowerCase().replace(/[ʼ']/g, ''))
        );
        if (match) {
          openNotesFolder(match);
          addNotesChatMsg('agent', `Відкрив папку "${match}".`);
        } else {
          addNotesChatMsg('agent', `Папку "${parsed.folder}" не знайдено. Доступні: ${folders.join(', ')}.`);
        }
        notesBarLoading = false;
        return;
      }

      if (parsed.action === 'open_note') {
        const q = (parsed.query || '').toLowerCase();
        const note = getNotes().find(n => n.text.toLowerCase().includes(q));
        if (note) {
          // Відкриваємо папку і потім нотатку
          currentNotesFolder = note.folder || 'Загальне';
          renderNotes();
          setTimeout(() => openNoteView(note.id), 100);
          addNotesChatMsg('agent', `Відкрив нотатку.`);
        } else {
          addNotesChatMsg('agent', `Нотатку не знайдено.`);
        }
        notesBarLoading = false;
        return;
      }

      if (!processUniversalAction(parsed, text, addNotesChatMsg)) {
        safeAgentReply(reply, addNotesChatMsg);
      }
    } catch {
      safeAgentReply(reply, addNotesChatMsg);
    }
  } catch { addNotesChatMsg('agent', 'Мережева помилка.'); }
  notesBarLoading = false;
}


// === WINDOW EXPORTS (HTML handlers only) ===
Object.assign(window, {
  openAddNote, saveNote, closeNoteModal, openNoteView, closeNoteView,
  switchNoteViewTab, openNoteViewMenu, closeNoteMenu,
  noteMenuCopy, noteMenuEdit, noteMenuDelete, noteMenuMove,
  saveFolderEdit, closeFolderEditModal, applyFolderSuggestion,
  sendNoteChatMessage, sendNotesBarMessage,
  openNotesFolder, closeNotesFolder, openFolderEditModal,
  selectFolderIcon, selectFolderColor,
  folderSwipeStart, folderSwipeMove, folderSwipeEnd,
  noteSwipeStart, noteSwipeMove, noteSwipeEnd,
  addNotesChatMsg, autoSaveNoteView, openNoteMenu,
});
