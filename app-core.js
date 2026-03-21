// ============================================================
// app-core.js — Ядро — вкладки, теми, налаштування, toast, trash, PWA, keyboard, анімації, init
// Функції: switchTab, applyTheme, setupDrumTabbar, openSettings, showToast, addToTrash, setupKeyboardAvoiding, animateTabSwitch, init, bootApp, OWL tab boards
// Залежності: Немає (завантажується першим)
// ============================================================

// === TAB THEMES ===
const TAB_THEMES = {
  inbox: {
    bg: 'linear-gradient(160deg, #f2d978, #ffffff)',
    orb: 'rgba(242,217,120,0.25)',
    tabBg: 'rgb(243,211,94)',
    accent: '#8b6914',
    accent2: '#d4a857',
  },
  tasks: {
    bg: 'linear-gradient(160deg, #fdb87a, #ffd4a8)',
    orb: 'rgba(234,88,12,0.15)',
    tabBg: 'rgb(253,184,122)',
    accent: '#ea580c',
    accent2: '#f97316',
  },
  notes: {
    bg: 'linear-gradient(160deg, #fed7aa, #ffedd5)',
    orb: 'rgba(234,88,12,0.10)',
    tabBg: 'rgb(254,215,170)',
    accent: '#c2620a',
    accent2: '#f97316',
  },
  me: {
    bg: 'linear-gradient(160deg, #a7f3d0, #ecfdf5)',
    orb: 'rgba(22,163,74,0.12)',
    tabBg: 'rgb(167,243,208)',
    accent: '#16a34a',
    accent2: '#22c55e',
  },
  evening: {
    bg: 'linear-gradient(160deg, #818cf8, #c7d2fe)',
    orb: 'rgba(129,140,248,0.20)',
    tabBg: 'rgb(129,140,248)',
    accent: '#4f46e5',
    accent2: '#818cf8',
  },
  finance: {
    bg: 'linear-gradient(160deg, #fcd9bd, #fff7ed)',
    orb: 'rgba(249,115,22,0.12)',
    tabBg: 'rgb(249,155,100)',
    accent: '#c2410c',
    accent2: '#f97316',
  },
};

// === CURRENT STATE ===
let currentTab = 'inbox';

// === SWITCH TAB ===
function switchTab(tab) {
  if (tab === currentTab) return;
  animateTabSwitch(tab);
  currentTab = tab;

  // Закриваємо всі чат-вікна при переключенні
  try { closeAllChatBars(); } catch(e) {}

  // Update pages
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(`page-${tab}`).classList.add('active');

  // Update tab items — drum tabbar
  updateDrumTabbar(tab);

  // Apply theme
  applyTheme(tab);

  // Бари inbox/tasks/me/evening/finance — показуємо/ховаємо і закриваємо вікно чату при переключенні
  ['inbox','tasks','notes','me','evening','finance'].forEach(t => {
    const bar = document.getElementById(t + '-ai-bar');
    if (!bar) return;
    const show = t === tab;
    bar.style.display = show ? 'flex' : 'none';
    // Якщо вкладка стала неактивною — закриваємо вікно чату
    if (!show) {
      const cw = bar.querySelector('.ai-bar-chat-window');
      if (cw) cw.classList.remove('open');
    }
  });

  // Tab-specific render
  if (tab === 'tasks') { renderTasks(); if (currentProdTab === 'habits') renderProdHabits(); updateProdTabCounters(); }
  if (tab === 'notes') { currentNotesFolder = null; renderNotes(); checkAndSuggestFolders(); }
  if (tab === 'me') { renderMe(); renderMeHabitsStats(); }
  if (tab === 'evening') { renderEvening(); }
  if (tab === 'finance') { renderFinance(); }

  // Підказка першого відвідування
  setTimeout(() => showFirstVisitTip(tab), 600);

  // OWL табло для вкладки
  setTimeout(() => { try { tryTabBoardUpdate(tab); } catch(e) {} }, 700);
}

function setupDrumTabbar() {
  const capsule = document.getElementById('drumCapsule');
  const track = document.getElementById('drumTrack');
  if (!capsule || !track) return;

  const TAB_ORDER = ['inbox','tasks','notes','me','evening','finance'];
  let startX = 0, startTime = 0, dragDelta = 0, dragging = false, velocity = 0, lastX = 0, lastTime = 0;
  let currentTranslateX = 0;

  // Відступи щоб крайні вкладки доходили до центру капсули
  function updateEdgePadding() {
    const capsuleW = capsule.offsetWidth;
    const half = Math.floor(capsuleW / 2);
    track.style.paddingLeft = half + 'px';
    track.style.paddingRight = half + 'px';
  }
  updateEdgePadding();
  window.addEventListener('resize', updateEdgePadding);

  // Тап на вкладку — click спрацьовує тільки якщо не було свайпу
  capsule.addEventListener('click', e => {
    const item = e.target.closest('.tab-item[data-tab]');
    if (item && Math.abs(dragDelta) < 8) switchTab(item.dataset.tab);
  });

  function getDrumBounds() {
    const capsuleW = capsule.offsetWidth - 8;
    const trackW = track.scrollWidth;
    return { minX: Math.min(0, capsuleW - trackW), maxX: 0, capsuleW };
  }

  // Визначає яка вкладка зараз по центру капсули
  function getTabAtCenter() {
    const capsuleRect = capsule.getBoundingClientRect();
    const capsuleCenter = capsuleRect.left + capsuleRect.width / 2;
    const items = track.querySelectorAll('.tab-item[data-tab]');
    let closest = null, minDist = Infinity;
    items.forEach(item => {
      const rect = item.getBoundingClientRect();
      const itemCenter = rect.left + rect.width / 2;
      const dist = Math.abs(itemCenter - capsuleCenter);
      if (dist < minDist) { minDist = dist; closest = item; }
    });
    return closest ? closest.dataset.tab : null;
  }

  // Оновлює .active/.near без switchTab (тільки візуал)
  function updateActiveVisual(tab) {
    const activeIdx = TAB_ORDER.indexOf(tab);
    track.querySelectorAll('.tab-item[data-tab]').forEach((item, i) => {
      const diff = Math.abs(i - activeIdx);
      item.classList.remove('active', 'near');
      if (diff === 0) item.classList.add('active');
      else if (diff === 1) item.classList.add('near');
    });
  }

  capsule.addEventListener('touchstart', e => {
    // Читаємо реальну позицію з DOM щоб уникнути ривків
    const mat = new DOMMatrix(getComputedStyle(track).transform);
    currentTranslateX = isNaN(mat.m41) ? (window._drumCurrentX || 0) : mat.m41;
    window._drumCurrentX = currentTranslateX;
    startX = e.touches[0].clientX;
    lastX = startX;
    lastTime = Date.now();
    startTime = lastTime;
    dragDelta = 0;
    velocity = 0;
    dragging = true;
    track.style.transition = 'none';
  }, { passive: true });

  capsule.addEventListener('touchmove', e => {
    if (!dragging) return;
    const x = e.touches[0].clientX;
    const now = Date.now();
    const dt = now - lastTime;
    if (dt > 0) velocity = (x - lastX) / dt;
    lastX = x; lastTime = now;
    dragDelta = x - startX;

    const { minX, maxX } = getDrumBounds();
    let newX = currentTranslateX + dragDelta;
    if (newX > maxX) newX = maxX + (newX - maxX) * 0.25;
    if (newX < minX) newX = minX + (newX - minX) * 0.25;
    track.style.transform = `translateX(${newX}px)`;

    // Оновлюємо візуал активної вкладки під час прокрутки
    const tempX = Math.max(minX, Math.min(maxX, newX));
    const savedX = currentTranslateX;
    currentTranslateX = tempX;
    const centerTab = getTabAtCenter();
    currentTranslateX = savedX;
    if (centerTab) updateActiveVisual(centerTab);
  }, { passive: true });

  capsule.addEventListener('touchend', () => {
    dragging = false;
    const { minX, maxX } = getDrumBounds();

    // Якщо це тап (не свайп) — нічого не робимо, click обробить
    if (Math.abs(dragDelta) < 8) return;

    // Інерція — продовжуємо рух
    const momentum = velocity * 120;
    let newX = Math.max(minX, Math.min(maxX, currentTranslateX + dragDelta + momentum));

    currentTranslateX = newX;
    window._drumCurrentX = newX;
    track.style.transition = 'transform 0.4s cubic-bezier(0.25,0.46,0.45,0.94)';
    track.style.transform = `translateX(${newX}px)`;

    // Визначаємо активну вкладку і перемикаємо
    const centerTab = getTabAtCenter();
    if (centerTab && centerTab !== currentTab) {
      setTimeout(() => switchTab(centerTab), 50);
    }
  }, { passive: true });
}

function updateDrumTabbar(tab) {
  const TAB_ORDER = ['inbox','tasks','notes','me','evening','finance'];
  const activeIdx = TAB_ORDER.indexOf(tab);
  const items = document.querySelectorAll('.tab-item[data-tab]');
  items.forEach((item, i) => {
    const diff = Math.abs(i - activeIdx);
    item.classList.remove('active', 'near');
    if (diff === 0) item.classList.add('active');
    else if (diff === 1) item.classList.add('near');
  });
  // Центруємо активну вкладку в барабані
  const track = document.getElementById('drumTrack');
  const capsule = document.getElementById('drumCapsule');
  if (!track || !capsule) return;
  const activeItem = document.querySelector('.tab-item.active');
  if (!activeItem) return;
  const capsuleW = capsule.offsetWidth - 8;
  const trackW = track.scrollWidth;
  const itemW = activeItem.offsetWidth;
  const itemLeft = activeItem.offsetLeft;
  const scrollTo = itemLeft - (capsuleW / 2) + (itemW / 2);
  const minX = Math.min(0, capsuleW - trackW);
  const newX = -Math.max(0, Math.min(scrollTo, -minX));
  // Синхронізуємо з поточним значенням для вільного скролу
  try { window._drumCurrentX = newX; } catch(e) {}
  track.style.transition = 'transform 0.3s cubic-bezier(0.32,0.72,0,1)';
  track.style.transform = `translateX(${newX}px)`;
}

function applyTheme(tab) {
  const theme = TAB_THEMES[tab];
  const root = document.documentElement;
  const bg = document.getElementById('bg');
  const tabBar = document.getElementById('tab-bar');

  if (bg) bg.style.background = theme.bg;
  if (tabBar) tabBar.style.background = theme.tabBg;
  root.style.setProperty('--active-accent', theme.accent);
  root.style.setProperty('--active-accent2', theme.accent2);

  // Вечір — темний таббар індиго, іконки і текст білі (крім активної вкладки)
  const isDark = tab === 'evening';
  const tabLabels = tabBar ? tabBar.querySelectorAll('.tab-label') : [];
  tabLabels.forEach(s => { s.style.color = isDark ? 'rgba(255,255,255,0.5)' : ''; });
  const tabIcons2 = tabBar ? tabBar.querySelectorAll('.tab-icon') : [];
  tabIcons2.forEach(ic => {
    const isActive = ic.closest('.tab-item.active');
    ic.style.color = isDark && !isActive ? 'rgba(255,255,255,0.5)' : '';
  });
}

// === SETTINGS ===
function openSettings() {
  const overlay = document.getElementById('settings-overlay');
  overlay.classList.add('open');
  try { updateErrorLogBtn(); } catch(e) {}

  const key = localStorage.getItem('nm_gemini_key') || '';
  const settings = JSON.parse(localStorage.getItem('nm_settings') || '{}');
  const memory = localStorage.getItem('nm_memory') || '';
  const memoryTs = localStorage.getItem('nm_memory_ts');

  document.getElementById('input-api-key').value = key;
  document.getElementById('input-name').value = settings.name || '';
  document.getElementById('input-age').value = settings.age || '';
  document.getElementById('input-weight').value = settings.weight || '';
  document.getElementById('input-height').value = settings.height || '';
  document.getElementById('input-profile-notes').value = settings.profileNotes || '';
  document.getElementById('input-memory').value = memory;

  const tsEl = document.getElementById('memory-last-updated');
  if (memoryTs) {
    const d = new Date(parseInt(memoryTs));
    tsEl.textContent = `Останнє оновлення: ${d.toLocaleDateString('uk-UA')} о ${d.toLocaleTimeString('uk-UA', {hour:'2-digit',minute:'2-digit'})}`;
  } else {
    tsEl.textContent = 'Ще не оновлювалась';
  }

  updateKeyStatus(!!key);
  updateOwlModeUI(settings.owl_mode || 'partner');
  setCurrency(settings.currency || '₴');
  // Мова
  const lang = settings.language || 'uk';
  ['uk','en','nl'].forEach(l => {
    const btn = document.getElementById('btn-lang-' + l);
    if (btn) { if (l === lang) btn.classList.add('active'); else btn.classList.remove('active'); }
  });

  // Фінанси
  try {
    const bdg = getFinBudget();
    const finBudgetEl = document.getElementById('input-finance-budget');
    if (finBudgetEl) finBudgetEl.value = bdg.total || '';
  } catch(e) {}
}

function setOwlModeSetting(mode) {
  const settings = JSON.parse(localStorage.getItem('nm_settings') || '{}');
  settings.owl_mode = mode;
  localStorage.setItem('nm_settings', JSON.stringify(settings));
  updateOwlModeUI(mode);
  showToast('Стиль OWL змінено');
}

function updateOwlModeUI(mode) {
  ['coach','partner','mentor'].forEach(m => {
    const el = document.getElementById('set-owl-' + m);
    if (!el) return;
    if (m === mode) {
      el.style.border = '1.5px solid #7c3aed';
      el.style.background = 'rgba(124,58,237,0.07)';
    } else {
      el.style.border = '1.5px solid rgba(30,16,64,0.08)';
      el.style.background = 'rgba(255,255,255,0.5)';
    }
  });
}

function closeSettings() {
  // Save memory edits before closing
  const memory = document.getElementById('input-memory').value;
  localStorage.setItem('nm_memory', memory);
  document.getElementById('settings-overlay').classList.remove('open');
}

function setLanguage(lang) {
  const s = JSON.parse(localStorage.getItem('nm_settings') || '{}');
  s.language = lang;
  localStorage.setItem('nm_settings', JSON.stringify(s));
  ['uk','en','nl'].forEach(l => {
    const btn = document.getElementById('btn-lang-' + l);
    if (btn) {
      if (l === lang) btn.classList.add('active');
      else btn.classList.remove('active');
    }
  });
  showToast(lang === 'uk' ? 'Мова: Українська' : lang === 'en' ? 'Language: English' : 'Taal: Nederlands');
}

function openMemoryModal() {
  const modal = document.getElementById('memory-modal');
  modal.style.display = 'flex';
  renderMemoryCards();
}

function closeMemoryModal() {
  document.getElementById('memory-modal').style.display = 'none';
}

function renderMemoryCards() {
  const raw = localStorage.getItem('nm_memory') || '';
  const list = document.getElementById('memory-cards-list');
  const entries = raw.split('\n').map(s => s.trim()).filter(Boolean);
  if (!entries.length) {
    list.innerHTML = '<div style="text-align:center;padding:40px 20px;color:rgba(30,16,64,0.3);font-size:15px">Ще порожньо.<br>Напиши кілька записів в Inbox і натисни "Оновити через OWL".</div>';
    return;
  }
  list.innerHTML = entries.map((entry, i) => `
    <div id="memory-card-${i}" style="background:rgba(255,255,255,0.75);border:1.5px solid rgba(255,255,255,0.7);border-radius:14px;padding:12px 14px;display:flex;align-items:flex-start;gap:10px">
      <div contenteditable="true" id="memory-entry-${i}" style="flex:1;font-size:15px;color:#1e1040;line-height:1.5;outline:none;min-width:0;word-break:break-word" onblur="saveMemoryCards()">${escapeHtml(entry)}</div>
      <button onclick="deleteMemoryCard(${i})" style="background:none;border:none;cursor:pointer;color:rgba(30,16,64,0.25);font-size:18px;line-height:1;padding:2px;flex-shrink:0;margin-top:1px">×</button>
    </div>`).join('');
}

function addMemoryEntry() {
  const input = document.getElementById('memory-new-input');
  const text = input.value.trim();
  if (!text) return;
  const raw = localStorage.getItem('nm_memory') || '';
  const entries = raw.split('\n').map(s => s.trim()).filter(Boolean);
  entries.push(text);
  localStorage.setItem('nm_memory', entries.join('\n'));
  input.value = '';
  renderMemoryCards();
  // scroll to bottom
  const list = document.getElementById('memory-cards-list');
  if (list) setTimeout(() => { list.scrollTop = list.scrollHeight; }, 50);
}

function deleteMemoryCard(idx) {
  const raw = localStorage.getItem('nm_memory') || '';
  const entries = raw.split('\n').map(s => s.trim()).filter(Boolean);
  entries.splice(idx, 1);
  localStorage.setItem('nm_memory', entries.join('\n'));
  renderMemoryCards();
}

function saveMemoryCards() {
  const list = document.getElementById('memory-cards-list');
  if (!list) return;
  const divs = list.querySelectorAll('[id^="memory-entry-"]');
  const entries = Array.from(divs).map(d => d.textContent.trim()).filter(Boolean);
  const text = entries.join('\n');
  localStorage.setItem('nm_memory', text);
  // sync hidden field
  const hidden = document.getElementById('input-memory');
  if (hidden) hidden.value = text;
  // update timestamp label
  const tsEl = document.getElementById('memory-last-updated');
  if (tsEl) tsEl.textContent = 'Збережено щойно';
}

function openPrivacyPolicy() {
  showToast('Конфіденційність — незабаром');
}

function openTerms() {
  showToast('Умови використання — незабаром');
}

function openFeedback() {
  showToast('Написати автору — незабаром');
}

function updateKeyStatus(hasKey) {
  const el = document.getElementById('key-status');
  if (hasKey) {
    el.className = 'key-status has-key';
    el.textContent = '✓ API ключ збережено';
  } else {
    el.className = 'key-status no-key';
    el.textContent = '⚠️ Ключ не встановлено';
  }
}

function saveSettings() {
  const key = document.getElementById('input-api-key').value.trim();
  const name = document.getElementById('input-name').value.trim();
  const age = document.getElementById('input-age').value.trim();
  const weight = document.getElementById('input-weight').value.trim();
  const height = document.getElementById('input-height').value.trim();
  const profileNotes = document.getElementById('input-profile-notes').value.trim();
  const memory = document.getElementById('input-memory').value.trim();

  if (key) localStorage.setItem('nm_gemini_key', key);
  else localStorage.removeItem('nm_gemini_key');

  const settings = JSON.parse(localStorage.getItem('nm_settings') || '{}');
  Object.assign(settings, { name, age, weight, height, profileNotes });
  localStorage.setItem('nm_settings', JSON.stringify(settings));

  if (memory) localStorage.setItem('nm_memory', memory);

  updateKeyStatus(!!key);
  showToast('✓ Збережено');
  setTimeout(() => document.getElementById('settings-overlay').classList.remove('open'), 600);
}

function exportData() {
  const data = {};
  const keys = ['nm_inbox','nm_tasks','nm_notes','nm_moments','nm_settings','nm_memory','nm_habits2','nm_habit_log2','nm_finance','nm_finance_budget','nm_finance_cats'];
  keys.forEach(k => {
    const v = localStorage.getItem(k);
    if (v) data[k] = JSON.parse(v);
  });

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `nevermind-backup-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('📤 Дані експортовано');
}

function clearAllData() {
  if (!confirm('Видалити всі дані NeverMind? Цю дію не можна відмінити.')) return;
  const keys = ['nm_inbox','nm_tasks','nm_notes','nm_moments','nm_settings','nm_gemini_key','nm_memory','nm_memory_ts','nm_notes_folders_ts','nm_habits2','nm_habit_log2','nm_onboarding_done','nm_evening_summary','nm_finance','nm_finance_budget','nm_finance_cats','nm_trash','nm_owl_board','nm_owl_board_ts','nm_owl_board_said','nm_error_log','nm_chat_inbox','nm_chat_tasks','nm_chat_notes','nm_chat_me','nm_chat_evening','nm_chat_finance'];
  keys.forEach(k => localStorage.removeItem(k));
  Object.keys(localStorage).filter(k => k.startsWith('nm_task_chat_') || k.startsWith('nm_visited_') || k.startsWith('nm_owl_tab_')).forEach(k => localStorage.removeItem(k));
  showToast('🗑️ Всі дані видалено');
  closeSettings();
}

function saveFinanceSettings() {
  const budget = parseFloat(document.getElementById('input-finance-budget')?.value || '0') || 0;
  const bdg = getFinBudget();
  bdg.total = budget;
  saveFinBudget(bdg);
  showToast('✓ Бюджет збережено');
}

function clearFinanceData() {
  if (!confirm('Видалити всі фінансові дані?')) return;
  localStorage.removeItem('nm_finance');
  localStorage.removeItem('nm_finance_budget');
  localStorage.removeItem('nm_finance_cats');
  if (currentTab === 'finance') renderFinance();
  showToast('🗑️ Фінансові дані видалено');
}

// === MEMORY SYSTEM ===
function getProfile() {
  const s = JSON.parse(localStorage.getItem('nm_settings') || '{}');
  const parts = [];
  if (s.name) parts.push(`Імʼя: ${s.name}`);
  if (s.age) parts.push(`Вік: ${s.age}`);
  if (s.weight) parts.push(`Вага: ${s.weight} кг`);
  if (s.height) parts.push(`Зріст: ${s.height} см`);
  if (s.profileNotes) parts.push(`Про себе: ${s.profileNotes}`);
  return parts.join(', ');
}

function shouldRefreshMemory() {
  const lastTs = localStorage.getItem('nm_memory_ts');
  if (!lastTs) return true;
  const last = new Date(parseInt(lastTs));
  const now = new Date();
  return last.toDateString() !== now.toDateString();
}

async function autoRefreshMemory() {
  const key = localStorage.getItem('nm_gemini_key');
  if (!key) return;
  if (!shouldRefreshMemory()) return;
  const inbox = JSON.parse(localStorage.getItem('nm_inbox') || '[]');
  if (inbox.length < 3) return; // недостатньо даних
  await doRefreshMemory(false);
}

async function refreshMemory() {
  const btn = document.getElementById('memory-refresh-btn');
  if (btn) { btn.textContent = '…'; btn.disabled = true; }
  await doRefreshMemory(true);
  if (btn) { btn.textContent = '↻ Оновити через OWL'; btn.disabled = false; }
  // якщо вікно памʼяті відкрите — перемалювати картки
  if (document.getElementById('memory-modal')?.style.display !== 'none') {
    renderMemoryCards();
  }
}

async function doRefreshMemory(showResult) {
  const inbox = JSON.parse(localStorage.getItem('nm_inbox') || '[]');
  const tasks = JSON.parse(localStorage.getItem('nm_tasks') || '[]');
  const notes = getNotes();
  const profile = getProfile();

  const recentInbox = inbox.slice(-50).map(i => `[${i.category}] ${i.text}`).join('\n');
  const tasksList = tasks.map(t => `${t.title} (${t.status})`).join('\n');
  // Передаємо нотатки — помічаємо оновлені
  const notesList = notes.slice(-20).map(n => `[${n.folder||'Загальне'}]${n.updatedAt ? ' (оновлено)' : ''} ${n.text.substring(0,80)}`).join('\n');

  const systemPrompt = `Ти — OWL, агент NeverMind. Сформуй короткий профіль людини на основі її записів. ОБОВЯЗКОВО звертайся до неї на "ти" в тексті профілю. Визнач патерни поведінки, звички, цілі. Чесно але з повагою — без зайвого негативу. Відповідай ТІЛЬКИ текстом профілю, без вступів. Максимум 300 слів.`;

  const userMsg = `Профіль користувача: ${profile || 'не заповнено'}

Останні записи в Inbox:
${recentInbox || 'порожньо'}

Активні задачі:
${tasksList || 'немає'}

Нотатки:
${notesList || 'немає'}

Сформуй актуальний профіль користувача.`;

  const result = await callAI(systemPrompt, userMsg, {});
  if (!result) return;

  localStorage.setItem('nm_memory', result);
  localStorage.setItem('nm_memory_ts', Date.now().toString());

  // Оновити поле якщо відкрите
  const memEl = document.getElementById('input-memory');
  if (memEl) memEl.value = result;

  const tsEl = document.getElementById('memory-last-updated');
  if (tsEl) {
    const d = new Date();
    tsEl.textContent = `Останнє оновлення: ${d.toLocaleDateString('uk-UA')} о ${d.toLocaleTimeString('uk-UA', {hour:'2-digit',minute:'2-digit'})}`;
  }

  if (showResult) showToast('✓ Пам\'ять оновлено');
}

// Додаємо профіль і памʼять до кожного AI запиту

let _undoToastTimer = null;
let _undoData = null; // { type, item, restore }

function showToast(msg, duration = 2000) {
  const el = document.getElementById('toast');
  const msgEl = document.getElementById('toast-msg');
  const btn = document.getElementById('toast-undo-btn');
  msgEl.textContent = msg;
  btn.style.display = 'none';
  if (_undoToastTimer) clearTimeout(_undoToastTimer);
  el.classList.add('show');
  _undoToastTimer = setTimeout(() => el.classList.remove('show'), duration);
}

// === TRASH CACHE (кеш видалених — 7 днів) ===
const NM_TRASH_KEY = 'nm_trash';
const TRASH_TTL = 7 * 24 * 60 * 60 * 1000; // 7 днів

function getTrash() {
  try { return JSON.parse(localStorage.getItem(NM_TRASH_KEY) || '[]'); } catch { return []; }
}
function saveTrash(arr) {
  localStorage.setItem(NM_TRASH_KEY, JSON.stringify(arr));
}

// Додати запис в кеш при видаленні
function addToTrash(type, item, extra) {
  const trash = getTrash();
  // Прибираємо старіші за 7 днів
  const now = Date.now();
  const fresh = trash.filter(t => now - t.deletedAt < TRASH_TTL);
  fresh.push({ type, item, extra: extra || null, deletedAt: now });
  // Максимум 200 записів
  saveTrash(fresh.slice(-200));
}

// Пошук в кеші — для агента
function searchTrash(query) {
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
function restoreFromTrash(trashId) {
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
function cleanupTrash() {
  const trash = getTrash();
  const now = Date.now();
  const fresh = trash.filter(t => now - t.deletedAt < TRASH_TTL);
  if (fresh.length !== trash.length) saveTrash(fresh);
}

function showUndoToast(msg, restoreFn) {
  // Показує toast з кнопкою "Відновити" на 10 секунд
  const el = document.getElementById('toast');
  const msgEl = document.getElementById('toast-msg');
  const btn = document.getElementById('toast-undo-btn');
  msgEl.textContent = msg;
  btn.style.display = 'inline-block';
  _undoData = restoreFn;
  if (_undoToastTimer) clearTimeout(_undoToastTimer);
  el.classList.add('show');
  _undoToastTimer = setTimeout(() => {
    el.classList.remove('show');
    _undoData = null;
  }, 10000);
}

function undoDelete() {
  if (_undoData) {
    _undoData(); // викликаємо функцію відновлення
    _undoData = null;
  }
  if (_undoToastTimer) clearTimeout(_undoToastTimer);
  document.getElementById('toast').classList.remove('show');
}

// === PWA MANIFEST ===
function setupPWA() {
  const manifest = {
    name: 'NeverMind',
    short_name: 'NeverMind',
    start_url: '/',
    display: 'standalone',
    background_color: '#faf9ff',
    theme_color: '#f5f1ff',
    icons: [{
      src: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxOTIgMTkyIj48cmVjdCB3aWR0aD0iMTkyIiBoZWlnaHQ9IjE5MiIgcng9IjM4IiBmaWxsPSIjMWUzYTVmIi8+PGNpcmNsZSBjeD0iNDQiIGN5PSI2NiIgcj0iMTAiIGZpbGw9IndoaXRlIiBvcGFjaXR5PSIwLjIiLz48cGF0aCBkPSJNNDQsNzYgUTM4LDkyIDQwLDExMiIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLXdpZHRoPSI2IiBmaWxsPSJub25lIiBzdHJva2UtbGluZWNhcD0icm91bmQiIG9wYWNpdHk9IjAuMiIvPjxwYXRoIGQ9Ik00Miw5MiBMMjgsMTA4IiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjUiIGZpbGw9Im5vbmUiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgb3BhY2l0eT0iMC4yIi8+PHBhdGggZD0iTTQyLDkyIEw1MiwxMDYiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS13aWR0aD0iNSIgZmlsbD0ibm9uZSIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBvcGFjaXR5PSIwLjIiLz48cGF0aCBkPSJNNDAsMTEyIEwzMiwxMzgiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS13aWR0aD0iNSIgZmlsbD0ibm9uZSIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBvcGFjaXR5PSIwLjIiLz48cGF0aCBkPSJNNDAsMTEyIEw0OCwxMzgiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS13aWR0aD0iNSIgZmlsbD0ibm9uZSIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBvcGFjaXR5PSIwLjIiLz48Y2lyY2xlIGN4PSI5NiIgY3k9IjYyIiByPSIxMCIgZmlsbD0id2hpdGUiIG9wYWNpdHk9IjAuNSIvPjxwYXRoIGQ9Ik05Niw3MiBMOTYsMTE0IiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjYiIGZpbGw9Im5vbmUiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgb3BhY2l0eT0iMC41Ii8+PHBhdGggZD0iTTk2LDkwIEw4MCwxMDQiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS13aWR0aD0iNSIgZmlsbD0ibm9uZSIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBvcGFjaXR5PSIwLjUiLz48cGF0aCBkPSJNOTYsOTAgTDExMiwxMDQiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS13aWR0aD0iNSIgZmlsbD0ibm9uZSIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBvcGFjaXR5PSIwLjUiLz48cGF0aCBkPSJNOTYsMTE0IEw4NiwxNDAiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS13aWR0aD0iNSIgZmlsbD0ibm9uZSIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBvcGFjaXR5PSIwLjUiLz48cGF0aCBkPSJNOTYsMTE0IEwxMDYsMTQwIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjUiIGZpbGw9Im5vbmUiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgb3BhY2l0eT0iMC41Ii8+PGNpcmNsZSBjeD0iMTUwIiBjeT0iNTgiIHI9IjExIiBmaWxsPSIjNjBhNWZhIi8+PHBhdGggZD0iTTE1MCw2OSBMMTUwLDExNiIgc3Ryb2tlPSIjNjBhNWZhIiBzdHJva2Utd2lkdGg9IjYiIGZpbGw9Im5vbmUiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPjxwYXRoIGQ9Ik0xNTAsODYgTDEzMCw2NiIgc3Ryb2tlPSIjNjBhNWZhIiBzdHJva2Utd2lkdGg9IjUiIGZpbGw9Im5vbmUiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPjxwYXRoIGQ9Ik0xNTAsODYgTDE3MCw2NiIgc3Ryb2tlPSIjNjBhNWZhIiBzdHJva2Utd2lkdGg9IjUiIGZpbGw9Im5vbmUiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPjxwYXRoIGQ9Ik0xNTAsMTE2IEwxMzgsMTQyIiBzdHJva2U9IiM2MGE1ZmEiIHN0cm9rZS13aWR0aD0iNSIgZmlsbD0ibm9uZSIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIi8+PHBhdGggZD0iTTE1MCwxMTYgTDE2MiwxNDIiIHN0cm9rZT0iIzYwYTVmYSIgc3Ryb2tlLXdpZHRoPSI1IiBmaWxsPSJub25lIiBzdHJva2UtbGluZWNhcD0icm91bmQiLz48L3N2Zz4=',
      sizes: '192x192',
      type: 'image/svg+xml'
    }]
  };
  const blob = new Blob([JSON.stringify(manifest)], { type: 'application/manifest+json' });
  const link = document.createElement('link');
  link.rel = 'manifest';
  link.href = URL.createObjectURL(blob);
  document.head.appendChild(link);
}

// === SERVICE WORKER ===
function setupSW() {
  if (!('serviceWorker' in navigator)) return;
  const swCode = `
    self.addEventListener('install', e => self.skipWaiting());
    self.addEventListener('activate', e => clients.claim());
    self.addEventListener('fetch', e => e.respondWith(fetch(e.request).catch(() => caches.match(e.request))));
  `;
  const blob = new Blob([swCode], { type: 'application/javascript' });
  navigator.serviceWorker.register(URL.createObjectURL(blob)).catch(() => {});
}

function autoResizeTextarea(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 120) + 'px';
}

// Офлайн-fallback: зберігає миттєво як нотатку
function saveOffline(text) {
  const items = getInbox();
  items.unshift({ id: Date.now(), text, category: 'note', ts: Date.now(), processed: false });
  saveInbox(items);
  renderInbox();

}

function formatTime(ts) {
  const diff = Date.now() - ts;
  if (diff < 60000) return 'щойно';
  if (diff < 3600000) return Math.floor(diff / 60000) + ' хв тому';
  if (diff < 86400000) return Math.floor(diff / 3600000) + ' год тому';
  return new Date(ts).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' });
}

function escapeHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
// === KEYBOARD AVOIDING ===
function setupKeyboardAvoiding() {
  if (!window.visualViewport) return;

  const update = () => {
    const vv = window.visualViewport;
    // Правильний розрахунок для iOS: враховуємо offsetTop (скільки зверху зрізано)
    const keyboardHeight = Math.max(0, window.innerHeight - vv.offsetTop - vv.height);
    const aiBar = document.getElementById('inbox-ai-bar');
    const tabBar = document.getElementById('tab-bar');
    const tbH = tabBar ? tabBar.offsetHeight : 83;
    const newBars = ['tasks-ai-bar','notes-ai-bar','me-ai-bar','evening-ai-bar','finance-ai-bar'].map(id => document.getElementById(id));

    if (keyboardHeight > 250) { // реальна клавіатура > 250px; менше — це просто Safari ховає свій тулбар під час свайпу
      // Клавіатура відкрита — ховаємо таббар вниз, піднімаємо бар вгору
      if (aiBar) { aiBar.style.bottom = (keyboardHeight + 8) + 'px'; aiBar.style.left = '12px'; aiBar.style.right = '12px'; }
      // Ховаємо таббар — translateY достатньо великий щоб він пішов за екран
      if (tabBar) { tabBar.style.transform = `translateY(${tbH + keyboardHeight}px)`; tabBar.style.opacity = '0'; tabBar.style.pointerEvents = 'none'; }
      newBars.forEach(b => {
        if (!b || b.style.display === 'none') return;
        b.style.bottom = (keyboardHeight + 8) + 'px';
        // Якщо чат-вікно відкрите — обмежуємо його висоту щоб вміщалось на екрані
        const chatWin = b.querySelector('.ai-bar-chat-window');
        if (chatWin && chatWin.classList.contains('open')) {
          const availH = vv.height - keyboardHeight - 120; // 120 = поле вводу + відступи
          chatWin.style.maxHeight = Math.max(140, availH) + 'px';
        }
      });
    } else {
      // Клавіатура закрита — повертаємо все на місце
      if (aiBar) { const h = getTabbarHeight(); aiBar.style.bottom = (h + 4) + 'px'; aiBar.style.left = '4px'; aiBar.style.right = '4px'; }
      if (tabBar) { tabBar.style.transform = 'translateY(0)'; tabBar.style.opacity = ''; tabBar.style.pointerEvents = ''; }
      newBars.forEach(b => {
        if (!b) return;
        b.style.bottom = (tbH + 4) + 'px';
        // Повертаємо висоту чат-вікна
        const chatWin = b.querySelector('.ai-bar-chat-window');
        if (chatWin) chatWin.style.maxHeight = '';
      });
    }
  };

  // iOS іноді надсилає scroll замість resize — слухаємо обидва
  window.visualViewport.addEventListener('resize', update);
  window.visualViewport.addEventListener('scroll', update);

  // Фікс після розблокування телефону — viewport скидається
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') setTimeout(update, 300);
  });

  // Фікс повторного фокусу: iOS не генерує новий resize якщо viewport вже встановлений
  // Викликаємо update() вручну при кожному фокусі на поле вводу
  document.addEventListener('focusin', e => {
    if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') {
      setTimeout(update, 120);
      setTimeout(update, 400); // другий раз — iOS іноді повільніше показує клавіатуру
    }
  }, { passive: true });

  // При закритті клавіатури через кнопку Готово — iOS не завжди надсилає resize
  document.addEventListener('focusout', e => {
    if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') {
      setTimeout(update, 150);
    }
  }, { passive: true });
}

// === PAGE TRANSITIONS ===
let currentTabForAnim = 'inbox';
function animateTabSwitch(newTab) {
  const TAB_ORDER = ['inbox','tasks','notes','me','evening','finance'];
  const oldPage = document.getElementById(`page-${currentTabForAnim}`);
  const newPage = document.getElementById(`page-${newTab}`);
  if (!oldPage || !newPage || oldPage === newPage) {
    currentTabForAnim = newTab;
    return;
  }

  const oldIdx = TAB_ORDER.indexOf(currentTabForAnim);
  const newIdx = TAB_ORDER.indexOf(newTab);
  const goRight = newIdx > oldIdx;

  // Стартова позиція нової вкладки
  newPage.style.transition = 'none';
  newPage.style.transform = goRight ? 'translateX(28px)' : 'translateX(-28px)';
  newPage.style.opacity = '0';
  newPage.style.visibility = 'visible';

  // Вихід старої
  oldPage.style.transition = 'opacity 0.22s ease, transform 0.22s ease';
  oldPage.style.transform = goRight ? 'translateX(-28px)' : 'translateX(28px)';
  oldPage.style.opacity = '0';

  // Вхід нової — наступний кадр
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      newPage.style.transition = 'opacity 0.25s ease, transform 0.25s cubic-bezier(0.25,0.46,0.45,0.94)';
      newPage.style.transform = 'translateX(0)';
      newPage.style.opacity = '1';
    });
  });

  // Прибираємо inline стилі після завершення
  setTimeout(() => {
    oldPage.style.transition = '';
    oldPage.style.transform = '';
    oldPage.style.opacity = '';
    oldPage.style.visibility = '';
    newPage.style.transition = '';
    newPage.style.transform = '';
    newPage.style.opacity = '';
  }, 280);

  currentTabForAnim = newTab;
}

// === SETTINGS SWIPE TO CLOSE ===
function setupSettingsSwipe() {
  const panel = document.getElementById('settings-panel-el');
  if (!panel) return;
  let startY = 0, startScrollTop = 0;
  panel.addEventListener('touchstart', e => {
    startY = e.touches[0].clientY;
    startScrollTop = panel.scrollTop;
  }, { passive: true });
  panel.addEventListener('touchend', e => {
    const dy = e.changedTouches[0].clientY - startY;
    // Close only if swiped down >80px AND panel is scrolled to top
    if (dy > 80 && startScrollTop === 0) {
      closeSettings();
    }
  }, { passive: true });
}



// === ERROR LOGGER ===
const NM_LOG_KEY = 'nm_error_log';
const NM_LOG_MAX = 100; // максимум записів

function getErrorLog() {
  try { return JSON.parse(localStorage.getItem(NM_LOG_KEY) || '[]'); } catch { return []; }
}
function saveErrorLog(arr) {
  try { localStorage.setItem(NM_LOG_KEY, JSON.stringify(arr.slice(-NM_LOG_MAX))); } catch {}
}

function logError(type, message, source) {
  const log = getErrorLog();
  const entry = {
    ts: Date.now(),
    type,
    msg: message,
    src: source || '',
    tab: typeof currentTab !== 'undefined' ? currentTab : '?'
  };
  log.push(entry);
  saveErrorLog(log);
}

// Перехоплюємо всі JS помилки
window.addEventListener('error', e => {
  logError('error', e.message, (e.filename || '').replace(/.*\//, '') + ':' + e.lineno);
});

// Перехоплюємо unhandled promise rejections
window.addEventListener('unhandledrejection', e => {
  const msg = e.reason ? (e.reason.message || String(e.reason)) : 'Promise rejected';
  logError('promise', msg, '');
});

function copyErrorLog() {
  const log = getErrorLog();
  if (log.length === 0) {
    showToast('Лог порожній — помилок не знайдено 👍');
    return;
  }
  const lines = log.map(e => {
    const d = new Date(e.ts);
    const time = d.toLocaleDateString('uk-UA') + ' ' + d.toLocaleTimeString('uk-UA', {hour:'2-digit',minute:'2-digit',second:'2-digit'});
    return '[' + time + '] [' + e.type + '] [' + e.tab + '] ' + e.msg + (e.src ? ' → ' + e.src : '');
  }).join('\n');
  const text = 'NeverMind Error Log (' + log.length + ' записів)\n' + '='.repeat(40) + '\n' + lines;
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(() => showToast('✓ Лог скопійовано (' + log.length + ' помилок)'));
  } else {
    showToast('Копіювання недоступне');
  }
}

function clearErrorLog() {
  localStorage.removeItem(NM_LOG_KEY);
  showToast('✓ Лог очищено');
  // Оновлюємо кнопку
  const btn = document.getElementById('error-log-btn');
  if (btn) btn.textContent = '🪲 Лог помилок (0)';
}

function updateErrorLogBtn() {
  const btn = document.getElementById('error-log-btn');
  if (!btn) return;
  const count = getErrorLog().length;
  btn.textContent = count > 0 ? '🪲 Лог помилок (' + count + ')' : '🪲 Лог помилок (0)';
  btn.style.borderColor = count > 0 ? 'rgba(234,88,12,0.3)' : '';
  btn.style.color = count > 0 ? '#ea580c' : '';
}

// === OWL TAB BOARDS (#37) ===
const OWL_TAB_BOARD_MIN_INTERVAL = 30 * 60 * 1000; // 30 хвилин між оновленнями

function getOwlTabBoardKey(tab) { return 'nm_owl_tab_' + tab; }
function getOwlTabTsKey(tab) { return 'nm_owl_tab_ts_' + tab; }
function getOwlTabSaidKey(tab) { return 'nm_owl_tab_said_' + tab; }

function getTabBoardMsg(tab) {
  try { return JSON.parse(localStorage.getItem(getOwlTabBoardKey(tab)) || 'null'); } catch { return null; }
}
function saveTabBoardMsg(tab, msg) {
  try { localStorage.setItem(getOwlTabBoardKey(tab), JSON.stringify(msg)); } catch {} }

function getTabBoardSaid(tab) {
  const today = new Date().toDateString();
  try {
    const raw = JSON.parse(localStorage.getItem(getOwlTabSaidKey(tab)) || '{}');
    if (raw.date !== today) return {};
    return raw.said || {};
  } catch { return {}; }
}
function markTabBoardSaid(tab, topic) {
  const today = new Date().toDateString();
  const said = getTabBoardSaid(tab);
  said[topic] = true;
  try { localStorage.setItem(getOwlTabSaidKey(tab), JSON.stringify({ date: today, said })); } catch {}
}
function tabAlreadySaid(tab, topic) { return !!getTabBoardSaid(tab)[topic]; }

function dismissTabBoard(tab) {
  const el = document.getElementById('owl-tab-board-' + tab);
  if (el) el.style.display = 'none';
}

function renderTabBoard(tab) {
  const msg = getTabBoardMsg(tab);
  const board = document.getElementById('owl-tab-board-' + tab);
  if (!board) return;
  if (!msg || !msg.text) { board.style.display = 'none'; return; }
  board.style.display = 'block';

  const pulse = document.getElementById('owl-tab-pulse-' + tab);
  if (pulse) {
    pulse.style.background = msg.priority === 'critical' ? '#ef4444' : msg.priority === 'important' ? '#f59e0b' : '#fbbf24';
    pulse.style.boxShadow = msg.priority === 'critical' ? '0 0 6px rgba(239,68,68,0.7)' : '';
  }
  const textEl = document.getElementById('owl-tab-text-' + tab);
  if (textEl) textEl.textContent = msg.text;
  const chipsEl = document.getElementById('owl-tab-chips-' + tab);
  if (chipsEl) {
    if (msg.chips && msg.chips.length > 0) {
      chipsEl.style.display = 'flex';
      chipsEl.innerHTML = msg.chips.map(c => `<div style="font-size:10px;font-weight:700;padding:3px 8px;border-radius:20px;background:rgba(255,255,255,0.1);color:rgba(255,255,255,0.75);border:1px solid rgba(255,255,255,0.15)">${escapeHtml(c)}</div>`).join('');
    } else {
      chipsEl.style.display = 'none';
    }
  }
}

function getTabBoardContext(tab) {
  const parts = [];
  try { const ctx = getAIContext(); if (ctx) parts.push(ctx); } catch(e) {}

  if (tab === 'tasks') {
    const tasks = getTasks();
    const active = tasks.filter(t => t.status === 'active');
    const now = Date.now();
    const stuck = active.filter(t => t.createdAt && (now - t.createdAt) > 3 * 24 * 60 * 60 * 1000);
    if (stuck.length > 0) parts.push(`[ВАЖЛИВО] Задачі без прогресу 3+ дні: ${stuck.map(t => '"' + t.title + '"').join(', ')}`);
    parts.push(`Активних задач: ${active.length}, закрито: ${tasks.filter(t => t.status === 'done').length}`);
  }

  if (tab === 'notes') {
    const notes = getNotes();
    const byFolder = {};
    notes.forEach(n => { const f = n.folder || 'Загальне'; byFolder[f] = (byFolder[f] || 0) + 1; });
    parts.push(`Нотатки: ${notes.length} записів. Папки: ${Object.entries(byFolder).map(([f, c]) => f + '(' + c + ')').join(', ') || 'немає'}`);
  }

  if (tab === 'me') {
    const habits = getHabits();
    const log = getHabitLog();
    const today = new Date().toDateString();
    const todayDow = (new Date().getDay() + 6) % 7;
    const todayH = habits.filter(h => (h.days || [0,1,2,3,4]).includes(todayDow));
    const doneToday = todayH.filter(h => !!log[today]?.[h.id]).length;
    if (habits.length > 0) {
      const streaks = habits.map(h => ({ name: h.name, streak: getHabitStreak(h.id), pct: getHabitPct(h.id) }));
      parts.push(`Звички сьогодні: ${doneToday}/${todayH.length}. Стріки: ${streaks.filter(s => s.streak >= 2).map(s => s.name + '🔥' + s.streak).join(', ') || 'немає'}`);
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
  return true;
}

let _tabBoardGenerating = {};

async function generateTabBoardMessage(tab) {
  if (_tabBoardGenerating[tab]) return;
  const key = localStorage.getItem('nm_gemini_key');
  if (!key) return;
  _tabBoardGenerating[tab] = true;

  const context = getTabBoardContext(tab);
  const tabLabels = { tasks: 'Продуктивність', notes: 'Нотатки', me: 'Я', evening: 'Вечір', finance: 'Фінанси' };
  const existing = getTabBoardMsg(tab);
  const recentText = existing ? existing.text : '';

  const systemPrompt = getOWLPersonality() + `

Ти пишеш КОРОТКЕ проактивне повідомлення для табло у вкладці "${tabLabels[tab] || tab}". Це НЕ відповідь на запит — це твоя ініціатива.

ПРАВИЛА:
- Максимум 2 речення. Коротко і конкретно про цю вкладку.
- Використовуй ТІЛЬКИ факти з контексту нижче. НЕ вигадуй ліміти і дані яких немає.
- НЕ повторюй нещодавнє: "${recentText || 'нічого'}"
- Відповідай ТІЛЬКИ JSON: {"text":"повідомлення","priority":"critical|important|normal","chips":["чіп1","чіп2"]}
- chips — 2-3 конкретні факти або дії. Максимум 3 слова кожен. Якщо нічого — [].
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
        max_tokens: 120,
        temperature: 0.75
      })
    });
    const data = await res.json();
    const reply = data.choices?.[0]?.message?.content?.trim();
    if (!reply) { _tabBoardGenerating[tab] = false; return; }
    const parsed = JSON.parse(reply.replace(/```json|```/g, '').trim());
    if (!parsed.text) { _tabBoardGenerating[tab] = false; return; }
    saveTabBoardMsg(tab, { text: parsed.text, priority: parsed.priority || 'normal', chips: parsed.chips || [], ts: Date.now() });
    localStorage.setItem(getOwlTabTsKey(tab), Date.now().toString());
    renderTabBoard(tab);
  } catch(e) {}
  _tabBoardGenerating[tab] = false;
}

function tryTabBoardUpdate(tab) {
  if (tab === 'inbox') return;
  const hour = new Date().getHours();
  if (hour >= 23 || hour < 7) return;
  renderTabBoard(tab);
  const lastTs = parseInt(localStorage.getItem(getOwlTabTsKey(tab)) || '0');
  const elapsed = Date.now() - lastTs;
  const isNewDay = lastTs > 0 && new Date(lastTs).toDateString() !== new Date().toDateString();
  const firstTime = lastTs === 0;
  if (firstTime || isNewDay || (elapsed > OWL_TAB_BOARD_MIN_INTERVAL && checkTabBoardTrigger(tab))) {
    generateTabBoardMessage(tab);
  }
}

// === INIT ===
function init() {
  try { setupPWA(); } catch(e) {}
  try { setupSW(); } catch(e) {}
  try { setupKeyboardAvoiding(); } catch(e) {}
  try { setupChatBarSwipe(); } catch(e) {}
  try { setupDrumTabbar(); } catch(e) {}
  try { setupSettingsSwipe(); } catch(e) {}
  // Me chat enter key
  // me-chat-input Enter handled via onkeydown in HTML
  try { applyTheme('inbox'); } catch(e) {}
  // Встановлюємо CSS змінну висоти таббару — після рендеру через rAF
  try {
    const tb = document.getElementById('tab-bar');
    if (tb) {
      const setTabbarH = () => {
        const h = tb.offsetHeight;
        if (h > 0) document.documentElement.style.setProperty('--tabbar-h', h + 'px');
      };
      // Перший раз — одразу
      requestAnimationFrame(() => requestAnimationFrame(setTabbarH));
      // Другий раз — після шрифтів
      if (document.fonts) document.fonts.ready.then(() => requestAnimationFrame(setTabbarH));
      // Третій раз — через 500ms як fallback
      setTimeout(setTabbarH, 500);
      // Оновлюємо при зміні орієнтації
      window.addEventListener('resize', setTabbarH, { passive: true });
    }
  } catch(e) {}
  // Force inbox tab active on every load
  try {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('page-inbox').classList.add('active');
    document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
    document.querySelector('.tab-item[data-tab="inbox"]').classList.add('active');
  } catch(e) {}
  try { updateKeyStatus(!!localStorage.getItem('nm_gemini_key')); } catch(e) {}
  try { renderInbox(); } catch(e) {}
  // Відновлюємо чат Inbox якщо є збережені повідомлення
  try { restoreChatUI('inbox'); } catch(e) {}
  // Показуємо inbox bar одразу — він тепер керується як tasks/me/evening
  try {
    const inboxBar = document.getElementById('inbox-ai-bar');
    if (inboxBar) inboxBar.style.display = 'flex';
  } catch(e) {}
  try { setTimeout(() => showFirstVisitTip('inbox'), 1500); } catch(e) {}
  setTimeout(() => { try { autoRefreshMemory(); } catch(e) {} }, 3000);
  try { setupAutoEveningSummary(); } catch(e) {}
  try { cleanupTrash(); } catch(e) {}
  setTimeout(() => { try { startOwlBoardCycle(); } catch(e) {} }, 4000);
}

function showApp() {
  const splash = document.getElementById('splash');
  if (splash) {
    splash.classList.add('hide');
    setTimeout(() => splash.classList.add('gone'), 600);
  }
  try { checkOnboarding(); } catch(e) {}
}

// === SPLASH → APP ===
function bootApp() {
  try { init(); } catch(e) { console.error('init error:', e); }
  // Show app after brief splash — use both timer and readyState check
  const delay = document.readyState === 'complete' ? 800 : 1200;
  setTimeout(showApp, delay);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootApp);
} else {
  // Already loaded (e.g. Chrome with cached page)
  bootApp();
}

// Fallback: force hide splash after 3s no matter what
setTimeout(() => {
  const splash = document.getElementById('splash');
  if (splash && !splash.classList.contains('gone')) {
    splash.classList.add('hide');
    setTimeout(() => splash.classList.add('gone'), 600);
  }
}, 3000);
