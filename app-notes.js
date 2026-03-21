// ============================================================
// app-notes.js — Нотатки, папки, note view, note chat, notes AI bar
// Функції: getNotes, renderNotes, openNoteView, addNoteFromInbox, getFolderIcon, checkAndSuggestFolders, sendNotesBarMessage
// Залежності: app-core.js, app-ai.js
// ============================================================

// === NOTES ===
let editingNoteId = null;
let pendingFolderSuggestion = null;

function getNotes() { return JSON.parse(localStorage.getItem('nm_notes') || '[]'); }
function saveNotes(arr) { localStorage.setItem('nm_notes', JSON.stringify(arr)); }

function getFolders() {
  const notes = getNotes();
  const set = new Set(notes.map(n => n.folder || 'Загальне'));
  return [...set].sort();
}

function addNoteFromInbox(text, category, folder = null) {
  const notes = getNotes();
  // Папка від агента має пріоритет, інакше fallback
  const resolvedFolder = folder || (category === 'idea' ? 'Ідеї' : 'Загальне');
  notes.unshift({ id: Date.now(), text, folder: resolvedFolder, source: 'inbox', ts: Date.now(), lastViewed: Date.now() });
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
  const item = notes.find(x => x.id === id);
  if (item) addToTrash('note', item);
  saveNotes(notes.filter(x => x.id !== id));
  renderNotes();
  const noteOrigIdx = getNotes().findIndex(x => x.id === id);
  if (item) showUndoToast('Нотатку видалено', () => { const n = getNotes(); const idx = Math.min(noteOrigIdx, n.length); n.splice(idx, 0, item); saveNotes(n); renderNotes(); });
}

let currentNotesFolder = null; // null = показуємо папки, string = показуємо записи папки

function filterNotes() {
  const q = document.getElementById('notes-search').value.trim();
  document.getElementById('notes-search-clear').style.display = q ? 'block' : 'none';
  renderNotes(q);
}

function clearNotesSearch() {
  document.getElementById('notes-search').value = '';
  document.getElementById('notes-search-clear').style.display = 'none';
  renderNotes();
}

function openNotesFolder(folderName) {
  currentNotesFolder = folderName;
  renderNotes();
}

function closeNotesFolder() {
  currentNotesFolder = null;
  renderNotes();
}

// Кольори папок — єдине місце визначення
const FOLDER_ICONS = {
  'Харчування': '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(30,16,64,0.55)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 2v7c0 1.7 1.3 3 3 3s3-1.3 3-3V2"/><line x1="6" y1="2" x2="6" y2="12"/><path d="M21 2s-2 2-2 7 2 5 2 5"/><path d="M19 14v8"/></svg>',
  'Фінанси':   '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(30,16,64,0.55)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 6v2m0 8v2"/><path d="M9.5 9.5A2.5 2.5 0 0 1 12 8h.5a2.5 2.5 0 0 1 0 5h-1a2.5 2.5 0 0 0 0 5H12a2.5 2.5 0 0 0 2.5-1.5"/></svg>',
  "Здоровʼя":  '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(30,16,64,0.55)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.8 1-1a5.5 5.5 0 0 0 0-7.6z"/></svg>',
  'Здоровя':   '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(30,16,64,0.55)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.8 1-1a5.5 5.5 0 0 0 0-7.6z"/></svg>',
  'Робота':    '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(30,16,64,0.55)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><line x1="12" y1="12" x2="12" y2="17"/><line x1="9.5" y1="14.5" x2="14.5" y2="14.5"/></svg>',
  'Навчання':  '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(30,16,64,0.55)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>',
  'Ідеї':      '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(30,16,64,0.55)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="9" r="5"/><path d="M12 14v4"/><path d="M9.5 16.5h5"/><path d="M9.5 18.5h5"/></svg>',
  'Особисте':  '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(30,16,64,0.55)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
  'Подорожі':  '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(30,16,64,0.55)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>',
};
const FOLDER_ICON_DEFAULT = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(30,16,64,0.55)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>';
function getFolderIcon(folder) {
  if (FOLDER_ICONS[folder]) return FOLDER_ICONS[folder];
  const normalized = folder.replace(/[ʼ']/g, '').toLowerCase();
  const found = Object.keys(FOLDER_ICONS).find(k => k.replace(/[ʼ']/g, '').toLowerCase() === normalized);
  return found ? FOLDER_ICONS[found] : FOLDER_ICON_DEFAULT;
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

function renderNotes(searchQuery = '') {
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

  const folders = Object.entries(byFolder).sort((a,b) => b[1].length - a[1].length);

  content.innerHTML = '<div style="padding:0 14px 120px;display:flex;flex-direction:column;gap:10px">' +
    folders.map(([folder, items]) => {
      const fc = getFolderColor(folder);
      const preview = items[0].text.length > 60 ? items[0].text.substring(0,60) + '…' : items[0].text;
      const safeFolder = escapeHtml(folder).replace(/'/g, "\\'");
      const key = btoa(unescape(encodeURIComponent(folder))).replace(/[^a-zA-Z0-9]/g, '_');
      return `<div style="position:relative;border-radius:18px">
        <div id="folder-del-${key}" style="position:absolute;right:0;top:0;bottom:0;width:72px;background:linear-gradient(135deg,#ef4444,#dc2626);display:flex;align-items:center;justify-content:center;pointer-events:none;border-radius:18px;opacity:0;transition:opacity 0.15s"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg></div>
        <div id="folder-item-${key}"
          ontouchstart="folderSwipeStart(event,'${safeFolder}')"
          ontouchmove="folderSwipeMove(event,'${safeFolder}')"
          ontouchend="folderSwipeEnd(event,'${safeFolder}')"
          style="cursor:pointer;border-radius:18px;padding:16px;background:${fc.bg};border:1.5px solid ${fc.border};box-shadow:0 2px 12px rgba(0,0,0,0.05);display:flex;align-items:center;gap:14px;position:relative;z-index:1">
          <div style="width:48px;height:48px;border-radius:14px;background:rgba(255,255,255,0.4);display:flex;align-items:center;justify-content:center;flex-shrink:0">${getFolderIcon(folder)}</div>
          <div style="flex:1;min-width:0">
            <div style="font-size:16px;font-weight:800;color:#1e1040;margin-bottom:3px">${escapeHtml(folder)}</div>
            <div style="font-size:12px;color:rgba(30,16,64,0.45);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(preview)}</div>
          </div>
          <div style="display:flex;flex-direction:column;align-items:center;gap:2px;flex-shrink:0">
            <div style="font-size:20px;font-weight:900;color:#1e1040">${items.length}</div>
            <div style="font-size:10px;font-weight:600;color:rgba(30,16,64,0.4)">записів</div>
          </div>
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
        <div id="note-del-${n.id}" class="note-delete-bg" style="position:absolute;right:0;top:0;bottom:0;width:72px;background:linear-gradient(135deg,#ef4444,#dc2626);display:flex;align-items:center;justify-content:center;pointer-events:none;border-radius:var(--card-radius);opacity:0;transition:opacity 0.15s"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg></div>
        <div id="note-item-${n.id}" class="inbox-item"
          ontouchstart="noteSwipeStart(event,${n.id})"
          ontouchmove="noteSwipeMove(event,${n.id})"
          ontouchend="noteSwipeEnd(event,${n.id})"
          style="cursor:default;padding:12px 13px;width:100%;box-sizing:border-box;background:${fc.bg};border-color:${fc.border};">
          <div onclick="openNoteView(${n.id})" style="cursor:pointer">
            <div style="font-size:15px;line-height:1.55;color:#1e1040;font-weight:500;margin-bottom:5px">${escapeHtml(preview)}</div>
            <div style="display:flex;align-items:center;justify-content:space-between">
              <div style="font-size:12px;color:rgba(30,16,64,0.3)">${formatTime(n.ts)}${n.source === 'inbox' ? ' · з Inbox' : ''}</div>
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
const NOTE_SWIPE_THRESHOLD = 250;

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
  if (el) el.style.transform = `translateX(${s.dx}px)`;
  const delBg = document.getElementById('note-del-' + id);
  if (delBg) delBg.style.opacity = Math.min(1, -s.dx / 180).toFixed(2);
}
function noteSwipeEnd(e, id) {
  const s = noteSwipeState[id]; if (!s) return;
  const el = document.getElementById(`note-item-${id}`);
  if (s.dx < -NOTE_SWIPE_THRESHOLD) {
    if (el) {
      el.style.transition = 'transform 0.2s ease, opacity 0.2s';
      el.style.transform = 'translateX(-110%)';
      el.style.opacity = '0';
    }
    setTimeout(() => {
      const allNotes = getNotes();
      const noteSwipeIdx = allNotes.findIndex(x => x.id === id);
      const item = allNotes.find(x => x.id === id);
      if (item) addToTrash('note', item);
      saveNotes(allNotes.filter(x => x.id !== id)); renderNotes();
      if (item) showUndoToast('Нотатку видалено', () => { const notes = getNotes(); const idx = Math.min(noteSwipeIdx, notes.length); notes.splice(idx, 0, item); saveNotes(notes); renderNotes(); });
    }, 200);
  } else {
    if (el) {
      el.style.transition = 'transform 0.3s ease';
      el.style.transform = 'translateX(0)';
      setTimeout(() => { el.style.transition = ''; }, 300);
    }
    const delBgN = document.getElementById('note-del-' + id);
    if (delBgN) { delBgN.style.transition = 'opacity 0.25s'; delBgN.style.opacity = '0'; setTimeout(() => { if(delBgN) delBgN.style.transition = ''; }, 300); }
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
  openEditNote(id);
}
function noteMenuDelete() {
  const id = activeNoteMenuId;
  closeNoteMenu();
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
async function checkAndSuggestFolders() {
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
}

function closeNoteView() {
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
  const systemPrompt = `${getOWLPersonality()} Обговорюєш нотатку користувача. Короткі відповіді (2-4 речення). Допомагаєш розвинути думку, знайти рішення, структурувати ідею. Якщо просять зберегти відповідь — скажи що можна натиснути "Зберегти як нотатку".${aiContext ? '\n\n' + aiContext : ''}`;
  const noteContext = `Нотатка: ${n?.text || ''}`;

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: noteContext },
          ...noteChatHistory.slice(-10)
        ],
        max_tokens: 300,
        temperature: 0.75
      })
    });
    const data = await res.json();
    const reply = data.choices?.[0]?.message?.content;
    if (reply) {
      addNoteChatMsg('agent', reply);
      noteChatHistory.push({ role: 'assistant', content: reply });
      // Show save button if meaningful response
      showSaveAsNoteBtn(reply);
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
const FOLDER_SWIPE_THRESHOLD = 250;

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
  if (el) el.style.transform = 'translateX(' + s.dx + 'px)';
  const delBg = document.getElementById('folder-del-' + key);
  if (delBg) delBg.style.opacity = Math.min(1, -s.dx / 180).toFixed(2);
}
function folderSwipeEnd(e, folder) {
  const key = _folderKey(folder);
  const s = folderSwipeState[key]; if (!s) return;
  const el = document.getElementById('folder-item-' + key);
  if (s.dx < -FOLDER_SWIPE_THRESHOLD) {
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
    if (el) { el.style.transition = 'transform 0.25s ease'; el.style.transform = 'translateX(0)'; setTimeout(() => { if(el) el.style.transition = ''; }, 300); }
    const delBg = document.getElementById('folder-del-' + key);
    if (delBg) { delBg.style.transition = 'opacity 0.25s'; delBg.style.opacity = '0'; setTimeout(() => { if(delBg) delBg.style.transition = ''; }, 300); }
    if (!s.swiping) openNotesFolder(folder);
  }
  delete folderSwipeState[key];
}

// === NOTES AI BAR ===
let notesBarHistory = [];
let notesBarLoading = false;

function addNotesChatMsg(role, text, _noSave = false) {
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
  try { openChatBar('notes'); } catch(e) {}
  const isAgent = role === 'agent';
  const div = document.createElement('div');
  div.style.cssText = `display:flex;${isAgent ? '' : 'justify-content:flex-end'}`;
  div.innerHTML = `<div style="max-width:85%;background:${isAgent ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.88)'};color:${isAgent ? 'white' : '#1e1040'};border-radius:${isAgent ? '4px 12px 12px 12px' : '12px 4px 12px 12px'};padding:8px 11px;font-size:15px;line-height:1.5;font-weight:500">${escapeHtml(text)}</div>`;
  el.appendChild(div);
  el.scrollTop = el.scrollHeight;
  if (role !== 'agent') notesBarHistory.push({ role: 'user', content: text });
  else notesBarHistory.push({ role: 'assistant', content: text });
  if (!_noSave) saveChatMsg('notes', role, text);
}

async function sendNotesBarMessage() {
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
- Створити задачу: {"action":"create_task","title":"назва","steps":[]}
- Зберегти фінанси: {"action":"save_finance","fin_type":"expense або income","amount":число,"category":"категорія","comment":"коментар"}
- Просто відповісти: текст (1-3 речення)
Нотатки: ` + (notes || 'немає') + `
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
      if (!processUniversalAction(parsed, text, addNotesChatMsg)) {
        addNotesChatMsg('agent', reply);
      }
    } catch {
      addNotesChatMsg('agent', reply);
    }
  } catch { addNotesChatMsg('agent', 'Мережева помилка.'); }
  notesBarLoading = false;
}

