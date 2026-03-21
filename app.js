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

// === ME TAB CHAT ===
let meChatHistory = [];

function renderMeHabitsStats() {
  const habits = getHabits();
  const el = document.getElementById('me-habits-stats-list');
  const block = document.getElementById('me-habits-stats');
  if (!el) return;
  if (habits.length === 0) {
    if (block) block.style.display = 'none';
    return;
  }
  if (block) block.style.display = 'block';
  const log = getHabitLog();
  const today = new Date().toDateString();
  const todayDow = (new Date().getDay() + 6) % 7;

  el.innerHTML = habits.map(h => {
    const pct = getHabitPct(h.id);
    const streak = getHabitStreak(h.id);
    const isDoneToday = !!log[today]?.[h.id];
    const isScheduledToday = (h.days || [0,1,2,3,4]).includes(todayDow);
    return `
    <div style="margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
        <span style="font-size:15px;font-weight:600;color:#1e1040">${h.emoji || '⭕'} ${escapeHtml(h.name)}</span>
        <span style="font-size:13px;font-weight:700;color:${pct >= 70 ? '#16a34a' : pct >= 40 ? '#d97706' : '#dc2626'}">${pct}%</span>
      </div>
      <div style="height:5px;background:rgba(30,16,64,0.06);border-radius:3px;margin-bottom:4px">
        <div style="height:100%;width:${pct}%;background:${pct >= 70 ? '#16a34a' : pct >= 40 ? '#d97706' : '#ef4444'};border-radius:3px;transition:width 0.5s"></div>
      </div>
      <div style="font-size:12px;color:rgba(30,16,64,0.4)">${streak >= 2 ? `🔥 ${streak} дні поспіль · ` : ''}за 30 днів${isScheduledToday ? (isDoneToday ? ' · ✅ сьогодні виконано' : ' · ⏳ сьогодні ще не виконано') : ''}</div>
    </div>`;
  }).join('');
}

async function sendMeChatMessage() {
  const input = document.getElementById('me-chat-input');
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  input.style.height = 'auto';
  input.focus(); // утримуємо клавіатуру

  addMeChatMsg('user', text);
  meChatHistory.push({ role: 'user', content: text });

  const loadId = 'me-chat-load-' + Date.now();
  addMeChatMsg('agent', '…', false, loadId);

  const context = getAIContext();
  const stats = getMeStatsContext();
  const systemPrompt = `${getOWLPersonality()} Аналізуєш дані користувача і даєш чесний, корисний зворотній звʼязок. Відповіді — 2-4 речення, конкретно і по ділу. Відповідай українською. НЕ вигадуй факти яких немає в даних.${context ? '\n\n' + context : ''}${stats ? '\n\n' + stats : ''}`;

  const reply = await callAIWithHistory(systemPrompt, [...meChatHistory]);
  const loadEl = document.getElementById(loadId);
  if (loadEl) loadEl.textContent = reply || 'Не вдалося отримати відповідь.';
  if (reply) meChatHistory.push({ role: 'assistant', content: reply });
  if (meChatHistory.length > 20) meChatHistory = meChatHistory.slice(-20);
}

// ===== 15. РОЗШИРЕНИЙ КОНТЕКСТ ШІ =====
function getOWLPersonality() {
  const settings = JSON.parse(localStorage.getItem('nm_settings') || '{}');
  const mode = settings.owl_mode || 'partner';
  const name = settings.name ? settings.name : '';
  const nameStr = name ? `, звертайся до користувача на імʼя "${name}"` : '';

  const personas = {
    coach: `Ти — OWL, особистий агент-тренер в застосунку NeverMind${nameStr}.

ХАРАКТЕР: Ти віриш в людину але не даєш їй розслаблятись. Прямий, конкретний, без зайвих слів. Можеш підколоти якщо людина затягує — але без жорстокості, з повагою. Ніколи не виправдовуєш відмовки. Підштовхуєш до дії тут і зараз. Радієш результатам коротко і по ділу.

СТИЛЬ: Короткі речення. Без вступів і прощань. Без "звісно", "зрозуміло", "чудово". Якщо є проблема — кажеш прямо. Говориш на "ти". Іноді одне влучне слово краще за абзац.

ЗАБОРОНЕНО: лестити, розмазувати, казати "це чудова ідея", виправдовувати бездіяльність, давати довгі пояснення без конкретики.`,

    partner: `Ти — OWL, особистий агент-партнер в застосунку NeverMind${nameStr}.

ХАРАКТЕР: Ти як найкращий друг який завжди поруч — щирий, теплий, людяний. Радієш перемогам разом з людиною, переживаєш коли щось не так. Не осуджуєш і не тиснеш. Можеш пожартувати доречно. Підтримуєш навіть коли справи ідуть погано. Завжди на боці людини.

СТИЛЬ: Природна розмовна мова. Звертаєшся по імені якщо знаєш. Емодзі — помірно, тільки коли доречно. Говориш на "ти". Короткі відповіді але з теплом. Не формально.

ЗАБОРОНЕНО: бути холодним або формальним, читати лекції, осуджувати, бути занадто серйозним коли ситуація легка.`,

    mentor: `Ти — OWL, особистий агент-наставник в застосунку NeverMind${nameStr}.

ХАРАКТЕР: Мудрий і спокійний. Говориш рідше але завжди влучно — не реагуєш на дрібниці. Бачиш патерни і звʼязки які людина сама не помічає. Не даєш готових відповідей якщо людина може знайти їх сама — натомість ставиш правильне питання. Думаєш на крок вперед. Поважаєш автономію людини.

СТИЛЬ: Спокійний тон, без поспіху. Глибина без пафосу. Говориш на "ти". Короткі але змістовні відповіді. Іноді одне влучне питання цінніше за пораду.

ЗАБОРОНЕНО: говорити банальності, поспішати з відповіддю, давати поверхневі поради, бути повчальним або зверхнім.`
  };
  return personas[mode] || personas.partner;
}

function getAIContext() {
  const profile = getProfile();
  const memory = localStorage.getItem('nm_memory') || '';
  const parts = [];

  // === Дата і час ===
  const now = new Date();
  const days = ['неділя','понеділок','вівторок','середа','четвер','п\'ятниця','субота'];
  const months = ['січня','лютого','березня','квітня','травня','червня','липня','серпня','вересня','жовтня','листопада','грудня'];
  const timeStr = now.toLocaleTimeString('uk-UA', {hour:'2-digit', minute:'2-digit'});
  const tzName = Intl.DateTimeFormat().resolvedOptions().timeZone; // напр: Europe/Kiev
  const tzOffset = -now.getTimezoneOffset() / 60; // напр: +2 або +3
  const tzStr = `UTC${tzOffset >= 0 ? '+' : ''}${tzOffset} (${tzName})`;
  const dateStr = `${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}, ${timeStr}, часовий пояс: ${tzStr}`;
  parts.push(`Зараз: ${dateStr}`);

  // === Профіль і памʼять ===
  if (profile) parts.push(`Профіль: ${profile}`);
  if (memory) parts.push(`Що знаю про користувача:\n${memory}`);

  // === Активні задачі (з ID для зіставлення) ===
  const tasks = getTasks().filter(t => t.status === 'active').slice(0, 8);
  if (tasks.length > 0) {
    const taskList = tasks.map(t => {
      const steps = (t.steps || []);
      const doneSteps = steps.filter(s => s.done).length;
      const stepInfo = steps.length > 0 ? ` (${doneSteps}/${steps.length} кроків)` : '';
      return `- [ID:${t.id}] ${t.title}${stepInfo}`;
    }).join('\n');
    parts.push(`Активні задачі (використовуй ID для complete_task):\n${taskList}`);
  }

  // === Звички сьогодні (з ID для зіставлення) ===
  const habits = getHabits();
  const log = getHabitLog();
  const today = now.toDateString();
  if (habits.length > 0) {
    const habitList = habits.map(h => {
      const done = !!log[today]?.[h.id];
      return `- [ID:${h.id}] "${h.name}": ${done ? '✓ виконано' : '✗ не виконано'}`;
    }).join('\n');
    parts.push(`Звички (використовуй ID для complete_habit):\n${habitList}`);
  }

  // === Записи Inbox за сьогодні (останні 8) ===
  const todayInbox = JSON.parse(localStorage.getItem('nm_inbox') || '[]')
    .filter(i => new Date(i.ts).toDateString() === today)
    .slice(0, 8);
  if (todayInbox.length > 0) {
    const inboxList = todayInbox.map(i => `- [${i.category}] ${i.text}`).join('\n');
    parts.push(`Записи сьогодні:\n${inboxList}`);
  }

  // === Фінанси ===
  try {
    const finCtx = getFinanceContext();
    if (finCtx) parts.push(finCtx);
  } catch(e) {}

  return parts.join('\n\n');
}

function getMeStatsContext() {
  // Короткий контекст — не більше 800 символів щоб не ламати JSON-режим
  const tasks = getTasks().filter(t => t.status === 'active').slice(0, 10);
  const habits = getHabits();
  const log = getHabitLog();
  const today = new Date().toDateString();

  const parts = [];
  if (tasks.length > 0) parts.push(`Задачі: ${tasks.map(t => t.title).join(', ')}`);
  if (habits.length > 0) {
    const habitStats = habits.map(h => {
      const doneToday = !!log[today]?.[h.id];
      return `${h.name}(${doneToday ? '✓' : '✗'})`;
    }).join(', ');
    parts.push(`Звички сьогодні: ${habitStats}`);
  }
  return parts.length > 0 ? parts.join('\n') : '';
}


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

// === OpenAI API === (ключ зберігається як nm_gemini_key — стара назва з часів Gemini)
const INBOX_SYSTEM_PROMPT = `Ти — персональний асистент в застосунку NeverMind. 
Користувач надсилає тобі повідомлення — це може бути думка, задача, ідея, звичка, подія, або звіт про виконане.

ГРАМАТИКА: Якщо бачиш очевидну помилку або опечатку — виправляй в полі "text" без питань. Наприклад: "голити в зал" → "ходити в зал", "купити хіб" → "купити хліб".

СПОЧАТКУ перевір: чи повідомлення говорить про ВИКОНАННЯ або ФАКТ того що вже є в списку звичок або задач?
Якщо так — дій відповідно (complete_habit або complete_task), НЕ створюй дублікат.

ЯКЩО повідомлення означає що одна або кілька звичок виконані сьогодні (є в списку "Звички"):
{
  "action": "complete_habit",
  "habit_ids": [123456, 789012],
  "comment": "коротке підтвердження (1 речення)"
}

ЯКЩО повідомлення означає що одна або кілька задач виконані або закриті (є в списку "Активні задачі"):
{
  "action": "complete_task",
  "task_ids": [123456, 789012],
  "comment": "коротке підтвердження (1 речення)"
}

ВАЖЛИВО для complete_task і complete_habit:
- Якщо користувач каже "все готово", "зробив все", "виконав" після того як агент перелічив кілька задач/звичок — передай ВСІ ID з того переліку
- Якщо однозначно йдеться про одну — передай масив з одним елементом
- Завжди масив, навіть якщо один елемент: [123456]

ЯКЩО це новий запис (думка, задача, ідея, нова звичка, подія, нотатка) — відповідай ТІЛЬКИ JSON:
{
  "action": "save",
  "category": "idea|task|habit|note|event",
  "folder": "назва папки українською або null",
  "text": "очищений текст запису",
  "comment": "коротка практична ремарка (1 речення). НЕ хвали запис."
}

ЯКЩО в одному повідомленні є КІЛЬКА РІЗНИХ записів різних типів (наприклад дві звички, задача і нотатка) — відповідай масивом JSON. УВАГА: список однотипних речей через кому (наприклад "список покупок: хліб, молоко") — це ОДНА задача з кроками, не масив окремих задач:
[
  {"action": "save", "category": "habit", "text": "Присідати", ...},
  {"action": "save", "category": "habit", "text": "Планка", ...}
]

ЯКЩО це питання або розмова (не запис і не виконання) — відповідай ТІЛЬКИ JSON:
{
  "action": "reply",
  "comment": "відповідь українською, 2-4 речення. Якщо є список — кожен пункт з нового рядка через \\n"
}

ЯКЩО є сумнів (кілька можливих дій, незрозуміла категорія) — відповідай ТІЛЬКИ JSON:
{
  "action": "clarify",
  "question": "коротке питання українською (1 речення)",
  "options": [
    {"label": "📋 Купити запасне колесо", "action": "save", "category": "task", "text": "Купити запасне колесо", "task_title": "Купити запасне колесо", "task_steps": []},
    {"label": "✅ Виконав звичку X", "action": "complete_habit", "habit_id": 123456}
  ]
}

Правила визначення категорії для action=save:
- task: є конкретна НОВА дія яку треба зробити ("зателефонувати", "купити", "зробити", "відправити")
  - "text" — оригінальний текст (виправ тільки граматику)
  - "task_title" — коротка назва 2-5 слів. ЯКЩО є час/дата — включи у task_title (формат 24г)
  - "task_steps" — масив кроків якщо є список дій. Інакше []
  ВАЖЛИВО — список чи окремі задачі:
  - Якщо є назва списку + елементи ("список покупок: хліб, молоко" або "ремонт: купити фарбу, найняти майстра") — ОДНА задача з кроками
  - Якщо елементи явно різні і незалежні ("зателефонувати Вові, записатися до лікаря") — окремі задачі (масив)
  - Якщо незрозуміло — action: "clarify" з питанням "Це один список чи окремі задачі?"
- habit: НОВА регулярна повторювана дія ("щодня", "кожен ранок", "тричі на тиждень"). "text" — коротка назва 2-4 слова
- event: короткий факт події без емоцій ("поїхав на рибалку", "зустрівся з Вовою"). Якщо є емоції/роздуми — це note
- idea: творча думка, ідея, план, натхнення
- note: рефлексія, думки, емоції, висновки, спостереження, факти, щоденникові записи, стан здоровʼя, що відбувається в житті. ЯКЩО людина описує свій день, стан, ситуацію — це note, НЕ reply.
- finance: витрата або дохід (будь-яка сума грошей). Якщо є сума і контекст витрат/доходу — це finance

ЯКЩО це витрата або дохід (є конкретна сума) — відповідай ТІЛЬКИ JSON:
{
  "action": "save_finance",
  "fin_type": "expense|income",
  "amount": 50,
  "category": "Їжа",
  "fin_comment": "короткий опис БЕЗ суми (1-3 слова, тільки що/де, наприклад: заправка, продукти, кава)"
}

Категорії витрат з прикладами:
- Їжа: кава, ресторан, продукти, супермаркет, обід, вечеря, сніданок, доставка їжі, піца, суші
- Транспорт: бензин, заправка, таксі, Uber, метро, автобус, парковка, авто
- Підписки: Netflix, Spotify, ChatGPT, Apple, Google, додатки, сервіси
- Здоровʼя: аптека, ліки, лікар, спортзал, фітнес, стоматолог
- Житло: оренда, комуналка, інтернет, ремонт, меблі
- Покупки: одяг, техніка, подарунок, магазин, Amazon
- Трава: джоінт, канабіс, трава, диспансер
- Інше: все що не підходить вище
Категорії доходів: Зарплата, Надходження, Повернення, Інше
Якщо є сумнів — обирай найближчу категорію з прикладів, НЕ "Інше".

ЯКЩО користувач просить додати кроки до існуючої задачі — відповідай ТІЛЬКИ JSON:
{
  "action": "add_step",
  "task_id": 123456,
  "steps": ["крок 1", "крок 2"]
}
Використовуй task_id з контексту активних задач.

ЯКЩО користувач ЯВНО просить змінити, виправити, оновити існуючу транзакцію (використовує слова "зміни", "виправ", "оновити", "та сама", "попередня", "та витрата") — відповідай ТІЛЬКИ JSON:
{
  "action": "update_transaction",
  "id": 1234567890,
  "category": "Нова категорія",
  "amount": 18,
  "comment": "новий коментар або пусто"
}
Поля "category", "amount", "comment" — вказуй тільки ті що змінюються. Якщо сума не змінюється — не включай "amount".
Використовуй id з останньої транзакції в контексті. НЕ створюй нову транзакцію.
ВАЖЛИВО: "додай кроки", "додай крок до задачі" — це НЕ update_transaction. Це стосується задач, відповідай як на звичайний запис або reply.

ЯКЩО користувач просить відновити видалений запис, задачу, нотатку, звичку або папку — відповідай ТІЛЬКИ JSON:
{
  "action": "restore_deleted",
  "query": "ключові слова для пошуку (текст або назва запису)"
}
Приклади: "відновити нотатку про машину", "поверни видалену задачу купити хліб", "відновити папку Здоровʼя"

ЯКЩО повідомлення є уточненням, командою або поясненням до попереднього (наприклад: "так", "ні", "видали", "це була помилка") — НЕ зберігай як запис, відповідай:
{
  "action": "reply",
  "comment": "відповідь або підтвердження"
}

Пріоритет: якщо сумнів між event і note — обирай note з папкою "Особисте".

Правила визначення папки (для category=note або idea):
- "Харчування" — їжа, напої, калорії, рецепти
- "Фінанси" — витрати, доходи, ціни, гроші
- "Здоровʼя" — самопочуття, симптоми, ліки, спорт, тренування
- "Робота" — робочі думки, проекти, колеги
- "Навчання" — що вивчаю, книги, курси, інсайти
- "Ідеї" — творчі ідеї (якщо category=idea)
- "Особисте" — стосунки, емоції, особисті думки, все що не підходить в інші папки
- "Подорожі" — місця, маршрути, враження
- Якщо не підходить жодна — використовуй "Особисте", НЕ вигадуй нових папок
- ЗАБОРОНЕНО автоматично використовувати папку "Чернетки" — тільки якщо користувач ЯВНО просить зберегти в чернетки
- Для task/habit/event — folder: null

Правила для clarify:
- ЗАБОРОНЕНО використовувати clarify перед збереженням — спочатку завжди зберігай, потім уточнюй
- Якщо є сумнів між task/note/habit — обирай найімовірніший варіант і зберігай. Додай поле "ask_after":"коротке питання" щоб уточнити після збереження
- clarify використовуй ТІЛЬКИ якщо: 2+ різні типи записів і незрозуміло яким є кожен, АБО незрозуміло чи це нова звичка чи виконання існуючої (тоді clarify доречний бо дія різна)
- Максимум 3 варіанти в options
- label ОБОВʼЯЗКОВО містить реальний конкретний текст варіанту

Приклад save з уточненням:
{"action":"save","category":"task","text":"Зателефонувати Вові","comment":"Задачу збережено.","ask_after":"Це одноразово чи хочеш зробити регулярним?"}

ВАЖЛИВО: відповідай ТІЛЬКИ валідним JSON, без markdown, без тексту поза JSON.
НЕ вигадуй ліміти, бюджети або плани яких немає в контексті. Якщо дані відсутні — не згадуй їх.`;

async function callAI(systemPrompt, userMessage, contextData = {}) {
  const key = localStorage.getItem('nm_gemini_key');
  if (!key) {
    showToast('⚙️ Введіть OpenAI API ключ у налаштуваннях', 3000);
    return null;
  }
  if (location.protocol === 'file:') {
    showToast('⚠️ Відкрий файл через сервер, не file://', 5000);
    return null;
  }
  const context = Object.keys(contextData).length > 0
    ? `\n\nКонтекст:\n${JSON.stringify(contextData, null, 2)}`
    : '';
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage + context }
        ],
        max_tokens: 300,
        temperature: 0.7
      })
    });
    const data = await res.json();
    if (!res.ok) {
      showToast('❌ ' + (data?.error?.message || `Помилка ${res.status}`), 4000);
      return null;
    }
    const text = data.choices?.[0]?.message?.content;
    if (!text) { showToast('❌ Порожня відповідь від Агента', 3000); return null; }
    return text;
  } catch (e) {
    if (e.message === 'Load failed' || e.message.includes('Failed to fetch')) {
      showToast('❌ Мережева помилка. Перевір інтернет', 4000);
    } else {
      showToast('❌ ' + e.message, 4000);
    }
    return null;
  }
}


// === INBOX CHAT MESSAGES ===
let _inboxTypingEl = null;

function addInboxChatMsg(role, text) {
  const el = document.getElementById('inbox-chat-messages');
  if (!el) return;

  // Видаляємо typing індикатор якщо є
  if (_inboxTypingEl) { _inboxTypingEl.remove(); _inboxTypingEl = null; }

  if (role === 'typing') {
    const div = document.createElement('div');
    div.style.cssText = 'display:flex';
    div.innerHTML = `<div style="background:rgba(255,255,255,0.12);border-radius:4px 14px 14px 14px;padding:5px 10px"><div class="ai-typing"><span></span><span></span><span></span></div></div>`;
    el.appendChild(div);
    _inboxTypingEl = div;
    el.scrollTop = el.scrollHeight;
    return;
  }

  // Розділювач часу — якщо юзер пише після паузи >5 хвилин
  if (role === 'user') {
    const now = Date.now();
    const gap = now - _lastUserMsgTs;
    if (_lastUserMsgTs > 0 && gap > 5 * 60 * 1000) {
      const mins = Math.round(gap / 60000);
      const label = mins < 60
        ? `${mins} хв тому`
        : mins < 1440
        ? `${Math.round(mins/60)} год тому`
        : 'раніше';
      const sep = document.createElement('div');
      sep.style.cssText = 'display:flex;align-items:center;gap:8px;margin:6px 0;opacity:0.45';
      sep.innerHTML = `<div style="flex:1;height:1px;background:rgba(255,255,255,0.2)"></div><div style="font-size:11px;color:rgba(255,255,255,0.6);white-space:nowrap;font-weight:500">${label}</div><div style="flex:1;height:1px;background:rgba(255,255,255,0.2)"></div>`;
      el.appendChild(sep);
    }
    _lastUserMsgTs = now;
  }

  const isAgent = role === 'agent';
  const div = document.createElement('div');
  div.style.cssText = `display:flex;${isAgent ? 'gap:8px;align-items:flex-start' : 'justify-content:flex-end'}`;
  if (isAgent) {
    div.innerHTML = `<div style="background:rgba(255,255,255,0.12);color:white;border-radius:4px 14px 14px 14px;padding:8px 12px;font-size:15px;font-weight:500;line-height:1.5;max-width:85%">${escapeHtml(text).replace(/\n/g, "<br>")}</div>`;
  } else {
    div.innerHTML = `<div style="background:rgba(255,255,255,0.88);color:#1e1040;border-radius:14px 4px 14px 14px;padding:8px 12px;font-size:15px;font-weight:500;line-height:1.5;max-width:85%">${escapeHtml(text)}</div>`;
  }
  el.appendChild(div);
  el.scrollTop = el.scrollHeight;
  saveChatMsg('inbox', role, text);
}

// Внутрішній рендер без запису в storage (щоб не дублювати при відновленні)
const CAT_SVG = {
  task:    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2fd0f9" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>',
  idea:    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7a8a00" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 2v2M12 20v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2 12h2M20 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/></svg>',
  note:    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8a6a3a" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
  habit:   '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
  event:   '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
  finance: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c2410c" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M14.31 8l-4.62 8M9.69 8l4.62 8M6 12h2.5M15.5 12H18"/></svg>',
};
const CAT_DOT_BG = {
  task:    'background:rgba(47,208,249,0.2)',
  idea:    'background:rgba(236,247,85,0.3)',
  note:    'background:rgba(180,140,90,0.15)',
  habit:   'background:rgba(22,163,74,0.15)',
  event:   'background:rgba(59,130,246,0.15)',
  finance: 'background:rgba(194,65,12,0.15)',
};
const CAT_TAG_STYLE = {
  task:    'background:rgba(47,208,249,0.2);color:#0a7a97',
  idea:    'background:rgba(245,240,168,0.5);color:#7a6c00',
  note:    'background:rgba(180,140,90,0.2);color:#6a4a1a',
  habit:   'background:rgba(22,163,74,0.15);color:#14532d',
  event:   'background:rgba(59,130,246,0.15);color:#1d4ed8',
  finance: 'background:rgba(194,65,12,0.15);color:#7c2d12',
};
const CAT_META = {
  idea:    { icon: '💡', label: 'Ідея',     dotClass: 'cat-dot-idea',    tagClass: 'cat-idea'    },
  task:    { icon: '📌', label: 'Задача',   dotClass: 'cat-dot-task',    tagClass: 'cat-task'    },
  habit:   { icon: '🌱', label: 'Звичка',   dotClass: 'cat-dot-habit',   tagClass: 'cat-habit'   },
  note:    { icon: '📝', label: 'Нотатка',  dotClass: 'cat-dot-note',    tagClass: 'cat-note'    },
  event:   { icon: '📅', label: 'Подія',    dotClass: 'cat-dot-event',   tagClass: 'cat-event'   },
  finance: { icon: '₴',  label: 'Фінанси',  dotClass: 'cat-dot-finance', tagClass: 'cat-finance' },
};

function getInbox() { return JSON.parse(localStorage.getItem('nm_inbox') || '[]'); }
function saveInbox(arr) { localStorage.setItem('nm_inbox', JSON.stringify(arr)); }

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

function renderInbox() {
  const items = getInbox();
  const list = document.getElementById('inbox-list');
  const countEl = document.getElementById('inbox-count');

  if (items.length === 0) {
    list.innerHTML = `<div class="inbox-empty">
      <div class="inbox-empty-icon">📥</div>
      <div class="inbox-empty-title">Inbox порожній</div>
      <div class="inbox-empty-sub">Напиши що завгодно — Агент розбереться</div>
    </div>`;
    countEl.style.display = 'none';
    return;
  }
  countEl.style.display = 'inline';
  countEl.textContent = items.length;

  list.innerHTML = items.map(item => {
    const meta = CAT_META[item.category] || CAT_META.note;
    const cardStyles = {
      task:    'background:linear-gradient(135deg,#c6f3fd,#a8ecfb);border-color:rgba(255,255,255,0.4)',
      habit:   'background:linear-gradient(135deg,#bbf7d0,#a7f3c0);border-color:rgba(255,255,255,0.4)',
      note:    'background:linear-gradient(135deg,#f5ede0,#ede0cc);border-color:rgba(255,255,255,0.4)',
      idea:    'background:linear-gradient(135deg,#f5f0a8,#eee97a);border-color:rgba(255,255,255,0.4)',
      event:   'background:linear-gradient(135deg,#bfdbfe,#a5c8fe);border-color:rgba(255,255,255,0.4)',
      finance: 'background:linear-gradient(135deg,#fcd9bd,#fbbf8a);border-color:rgba(255,255,255,0.4)',
    };
    const cardStyle = cardStyles[item.category] || cardStyles.note;
    return `<div class="inbox-item-wrap" id="wrap-${item.id}">
      <div class="inbox-item-delete-bg">🗑️</div>
      <div class="inbox-item" id="item-${item.id}" data-id="${item.id}" data-cat="${item.category}"
           style="${cardStyle}"
           ontouchstart="swipeStart(event,${item.id})"
           ontouchmove="swipeMove(event,${item.id})"
           ontouchend="swipeEnd(event,${item.id})">
        <div class="inbox-item-inner">
          <div class="inbox-item-cat-dot" style="${CAT_DOT_BG[item.category] || CAT_DOT_BG.note}">${CAT_SVG[item.category] || CAT_SVG.note}</div>
          <div class="inbox-item-body">
            <div class="inbox-item-text">${escapeHtml(item.text)}</div>
            <div class="inbox-item-meta">
              <span class="inbox-item-time">${formatTime(item.ts)}</span>
              <span class="inbox-item-tag" style="${CAT_TAG_STYLE[item.category] || CAT_TAG_STYLE.note}">${meta.label}</span>
            </div>
          </div>
        </div>
      </div>
    </div>`;
  }).join('');
}

// === SWIPE TO DELETE ===
const swipeState = {};
const SWIPE_THRESHOLD = 250;

function swipeStart(e, id) {
  const t = e.touches[0];
  swipeState[id] = { startX: t.clientX, startY: t.clientY, dx: 0, swiping: false };
}
function swipeMove(e, id) {
  const s = swipeState[id]; if (!s) return;
  const t = e.touches[0];
  const dx = t.clientX - s.startX, dy = t.clientY - s.startY;
  if (!s.swiping && Math.abs(dy) > Math.abs(dx)) return;
  if (!s.swiping && Math.abs(dx) > 8) s.swiping = true;
  if (!s.swiping) return;
  e.preventDefault();
  s.dx = Math.min(0, dx);
  const el = document.getElementById(`item-${id}`);
  if (el) el.style.transform = `translateX(${s.dx}px)`;
  const delBg = el ? el.previousElementSibling : null;
  if (delBg && delBg.classList.contains('inbox-item-delete-bg')) delBg.style.opacity = Math.min(1, -s.dx / 180).toFixed(2);
}
function swipeEnd(e, id) {
  const s = swipeState[id]; if (!s) return;
  const el = document.getElementById(`item-${id}`);
  if (s.dx < -SWIPE_THRESHOLD) {
    if (el) { el.style.transition = 'transform 0.2s ease, opacity 0.2s'; el.style.transform = 'translateX(-110%)'; el.style.opacity = '0'; }
    setTimeout(() => {
      const item = getInbox().find(i => i.id === id);
      if (item) addToTrash('inbox', item);
      saveInbox(getInbox().filter(i => i.id !== id)); renderInbox();
      const originalIdx = getInbox().findIndex(i => i.id === id);
      if (item) showUndoToast('Видалено з Inbox', () => { const items = getInbox(); const idx = Math.min(originalIdx, items.length); items.splice(idx, 0, item); saveInbox(items); renderInbox(); });
    }, 220);
  } else {
    if (el) { el.style.transition = 'transform 0.25s cubic-bezier(0.34,1.56,0.64,1)'; el.style.transform = 'translateX(0)'; setTimeout(() => { if (el) el.style.transition = ''; }, 300); }
    const delBgEnd = el ? el.previousElementSibling : null;
    if (delBgEnd && delBgEnd.classList.contains('inbox-item-delete-bg')) { delBgEnd.style.transition = 'opacity 0.25s'; delBgEnd.style.opacity = '0'; setTimeout(() => { if(delBgEnd) delBgEnd.style.transition = ''; }, 300); }
  }
  delete swipeState[id];
}

// === UNIFIED SEND TO AI ===
let aiLoading = false;
let inboxChatHistory = []; // зберігає останні 6 обмінів
let _lastUserMsgTs = 0; // timestamp останнього повідомлення юзера
const SEND_SVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>`;

function unifiedInputKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendToAI(); }
}

async function callAIWithHistory(systemPrompt, history) {
  const key = localStorage.getItem('nm_gemini_key');
  if (!key) { showToast('⚙️ Введіть OpenAI API ключ у налаштуваннях', 3000); return null; }
  if (location.protocol === 'file:') { showToast('⚠️ Відкрий файл через сервер, не file://', 5000); return null; }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000); // 25 сек таймаут
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'system', content: systemPrompt }, ...history],
        max_tokens: 300,
        temperature: 0.7
      })
    });
    clearTimeout(timeout);
    if (!res.ok) {
      const errText = await res.text();
      console.error('OpenAI error:', res.status, errText);
      return null;
    }
    const data = await res.json();
    const reply = data.choices?.[0]?.message?.content || null;
    return reply;
  } catch(e) {
    clearTimeout(timeout);
    console.error('callAIWithHistory error:', e);
    return null;
  }
}


async function sendToAI() {
  if (aiLoading) return;
  const input = document.getElementById('inbox-input');
  const text = input.value.trim();
  if (!text) return;

  // Перехоплюємо відповідь якщо йде опитування
  addInboxChatMsg('user', text);
  input.value = ''; input.style.height = 'auto';
  input.focus();
  if (handleSurveyAnswer(text)) return;

  const key = localStorage.getItem('nm_gemini_key');

  // Немає ключа або file:// — зберігаємо офлайн миттєво
  if (!key || location.protocol === 'file:') {
    saveOffline(text);
    return;
  }

  aiLoading = true;

  const btn = document.getElementById('ai-send-btn');
  btn.disabled = true;
  btn.innerHTML = '<div class="ai-typing" style="transform:scale(0.65)"><span></span><span></span><span></span></div>';

  // Показуємо typing в чаті
  addInboxChatMsg('typing', '…');

  const aiContext = getAIContext();
  // Додаємо контекст паузи якщо >5 хвилин
  const gapMs = _lastUserMsgTs > 0 ? Date.now() - _lastUserMsgTs : 0;
  const gapContext = gapMs > 5 * 60 * 1000
    ? `\n\n[Увага: між попереднім і цим повідомленням пройшло ${Math.round(gapMs/60000)} хв — це може бути нова незалежна думка, не продовження попереднього. Але НЕ припускай автоматично — просто зберігай як окремий запис без уточнень якщо все зрозуміло.]`
    : '';
  const fullPrompt = aiContext ? `${INBOX_SYSTEM_PROMPT}${gapContext}\n\n${aiContext}` : `${INBOX_SYSTEM_PROMPT}${gapContext}`;
  // Build history for context — but keep it short so JSON format is not broken
  inboxChatHistory.push({ role: 'user', content: text });
  if (inboxChatHistory.length > 24) inboxChatHistory = inboxChatHistory.slice(-24);
  // Передаємо останні 12 повідомлень — достатньо для контексту розмови
  const historySlice = inboxChatHistory.slice(-12);
  const reply = await callAIWithHistory(fullPrompt, historySlice);

  if (reply) {
    try {
      const clean = reply.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(clean);

      // Save assistant reply to history for context
      inboxChatHistory.push({ role: 'assistant', content: reply });

      // Підтримка масиву дій — агент може повернути [{action:...}, {action:...}]
      const actions = Array.isArray(parsed) ? parsed : [parsed];

      for (const action of actions) {
        if (action.action === 'clarify') {
          showClarify(action, text);
          aiLoading = false;
          btn.disabled = false;
          btn.innerHTML = SEND_SVG;
          return;
        }
        if (action.action === 'save') {
          await processSaveAction(action, text);
        } else if (action.action === 'save_finance') {
          processFinanceAction(action, text);
        } else if (action.action === 'update_transaction') {
          const txs = getFinance();
          const idx = txs.findIndex(t => t.id === action.id);
          if (idx !== -1) {
            if (action.category) txs[idx].category = action.category;
            if (action.comment !== undefined) txs[idx].comment = action.comment;
            if (action.amount) txs[idx].amount = parseFloat(action.amount);
            saveFinance(txs);
            if (currentTab === 'finance') renderFinance();
            const updParts = [];
            if (action.category) updParts.push('категорія: ' + txs[idx].category);
            if (action.amount) updParts.push('сума: ' + formatMoney(txs[idx].amount));
            addInboxChatMsg('agent', '✓ Оновлено: ' + (updParts.join(', ') || txs[idx].category));
          } else {
            addInboxChatMsg('agent', 'Не знайшов транзакцію. Спробуй ще раз.');
          }
        } else if (action.action === 'complete_habit') {
          await processCompleteHabit(action, text);
        } else if (action.action === 'complete_task') {
          await processCompleteTask(action, text);
        } else if (action.action === 'add_step') {
          const tasks = getTasks();
          const idx = tasks.findIndex(t => t.id == action.task_id);
          if (idx !== -1) {
            const steps = Array.isArray(action.steps) ? action.steps : (action.step ? [action.step] : []);
            steps.forEach(s => tasks[idx].steps.push({ id: Date.now() + Math.random(), text: s, done: false }));
            saveTasks(tasks);
            renderTasks();
            addInboxChatMsg('agent', `✓ Додано ${steps.length} крок(и) до "${tasks[idx].title}"`);
          } else {
            addInboxChatMsg('agent', 'Не знайшов задачу. Спробуй через вкладку Продуктивність.');
          }
        } else if (action.action === 'restore_deleted') {
          const q = action.query || '';
          const results = searchTrash(q);
          if (results.length === 0) {
            addInboxChatMsg('agent', 'Не знайшов нічого схожого в кеші видалених. Записи зберігаються 7 днів.');
          } else if (results.length === 1) {
            const entry = results[0];
            const label = entry.item.text || entry.item.title || entry.item.name || entry.item.folder || 'запис';
            const typeLabel = { task:'задачу', note:'нотатку', habit:'звичку', inbox:'запис', folder:'папку', finance:'транзакцію' }[entry.type] || 'запис';
            restoreFromTrash(entry.deletedAt);
            addInboxChatMsg('agent', `✓ Відновив ${typeLabel} "${label}"`);
          } else {
            // Кілька результатів — показуємо список
            const list = results.slice(0,5).map((e,i) => {
              const label = e.item.text || e.item.title || e.item.name || e.item.folder || 'запис';
              const typeLabel = { task:'📋', note:'📝', habit:'🌱', inbox:'📥', folder:'📁', finance:'💰' }[e.type] || '•';
              const ago = Math.round((Date.now() - e.deletedAt) / 86400000);
              return `${typeLabel} ${label.substring(0,40)} (${ago === 0 ? 'сьогодні' : ago + ' дн. тому'})`;
            }).join('\n');
            addInboxChatMsg('agent', `Знайшов кілька схожих:\n${list}\n\nУточни який саме відновити.`);
          }
        } else {
          // action === 'reply' — просто відповідь
          const replyText = action.comment || reply;
          addInboxChatMsg('agent', replyText);
        }
      }
    } catch(e) {
      console.error('JSON parse error:', e);
      // Спробуємо витягти clarify з часткового JSON
      try {
        const jsonMatch = (reply||'').match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const p2 = JSON.parse(jsonMatch[0]);
          if (p2.action === 'clarify') {
            showClarify(p2, text);
            aiLoading = false; btn.disabled = false; btn.innerHTML = SEND_SVG;
            return;
          }
        }
      } catch(e2) {}
      saveOffline(text);
      addInboxChatMsg('agent', '✓ Збережено');
    }
  } else {
    saveOffline(text);
    addInboxChatMsg('agent', '📝 Збережено в Inbox. Інтернет недоступний — Агент не визначив категорію. Надішли ще раз коли буде мережа.');
  }

  aiLoading = false;
  btn.disabled = false;
  btn.innerHTML = SEND_SVG;
}

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

// === TASKS ===
let editingTaskId = null;
let tempSteps = [];

function getTasks() { return JSON.parse(localStorage.getItem('nm_tasks') || '[]'); }
function saveTasks(arr) { localStorage.setItem('nm_tasks', JSON.stringify(arr)); }

function openAddTask() {
  editingTaskId = null;
  tempSteps = [];
  document.getElementById('task-modal-title').textContent = 'Нова задача';
  document.getElementById('task-input-title').value = '';
  document.getElementById('task-input-desc').value = '';
  document.getElementById('task-step-input').value = '';
  const delBtn = document.getElementById('task-delete-btn');
  if (delBtn) delBtn.style.display = 'none';
  renderTempSteps();
  document.getElementById('task-modal').style.display = 'flex';
  setupModalSwipeClose(document.querySelector('#task-modal > div:last-child'), closeTaskModal);
  setTimeout(() => { const el = document.getElementById('task-input-title'); el.removeAttribute('readonly'); el.focus(); }, 350);
}

function openEditTask(id) {
  const tasks = getTasks();
  const t = tasks.find(x => x.id === id);
  if (!t) return;
  editingTaskId = id;
  tempSteps = [...(t.steps || [])];
  document.getElementById('task-modal-title').textContent = 'Редагувати задачу';
  document.getElementById('task-input-title').value = t.title;
  document.getElementById('task-input-desc').value = t.desc || '';
  document.getElementById('task-step-input').value = '';
  const delBtn = document.getElementById('task-delete-btn');
  if (delBtn) delBtn.style.display = 'inline-block';
  renderTempSteps();
  document.getElementById('task-modal').style.display = 'flex';
  setupModalSwipeClose(document.querySelector('#task-modal > div:last-child'), closeTaskModal);
}

// === SWIPE DOWN TO CLOSE MODALS ===
function setupModalSwipeClose(contentEl, closeFn) {
  if (!contentEl || contentEl._swipeClose) return;
  contentEl._swipeClose = true;
  let startY = 0, startX = 0, dy = 0;
  contentEl.addEventListener('touchstart', e => {
    startY = e.touches[0].clientY;
    startX = e.touches[0].clientX;
    dy = 0;
    contentEl.style.transition = 'none';
  }, { passive: true });
  contentEl.addEventListener('touchmove', e => {
    dy = e.touches[0].clientY - startY;
    const dx = Math.abs(e.touches[0].clientX - startX);
    if (dy > 0 && dy > dx) {
      contentEl.style.transform = `translateY(${dy}px)`;
    }
  }, { passive: true });
  contentEl.addEventListener('touchend', () => {
    contentEl.style.transition = 'transform 0.25s ease';
    if (dy > 80) {
      contentEl.style.transform = 'translateY(100%)';
      setTimeout(() => { contentEl.style.transform = ''; closeFn(); }, 250);
    } else {
      contentEl.style.transform = '';
    }
    dy = 0;
  }, { passive: true });
}

function closeTaskModal() {
  document.getElementById('task-modal').style.display = 'none';
}

function deleteTaskFromModal() {
  if (!editingTaskId) return;
  const tasks = getTasks();
  const taskOrigIdx = tasks.findIndex(x => x.id === editingTaskId);
  const item = tasks.find(x => x.id === editingTaskId);
  if (item) addToTrash('task', item);
  saveTasks(tasks.filter(x => x.id !== editingTaskId));
  closeTaskModal();
  renderTasks();
  if (item) showUndoToast('Задачу видалено', () => { const t = getTasks(); const idx = Math.min(taskOrigIdx, t.length); t.splice(idx, 0, item); saveTasks(t); renderTasks(); });
}

function addTaskStep() {
  const inp = document.getElementById('task-step-input');
  const val = inp.value.trim();
  if (!val) return;
  tempSteps.push({ id: Date.now(), text: val, done: false });
  inp.value = '';
  renderTempSteps();
  setTimeout(() => { inp.focus(); }, 50);
}

function toggleTempStep(id) {
  const s = tempSteps.find(x => x.id === id);
  if (s) s.done = !s.done;
  renderTempSteps();
}

function removeTempStep(id) {
  tempSteps = tempSteps.filter(x => x.id !== id);
  renderTempSteps();
}

function renderTempSteps() {
  const el = document.getElementById('task-steps-list');
  if (tempSteps.length === 0) { el.innerHTML = ''; return; }
  el.innerHTML = tempSteps.map(s => `
    <div style="display:flex;align-items:center;gap:8px;background:rgba(30,16,64,0.03);border-radius:8px;padding:8px 10px">
      <div onclick="toggleTempStep(${s.id})" style="width:18px;height:18px;border-radius:5px;border:1.5px solid ${s.done ? '#ea580c' : 'rgba(30,16,64,0.2)'};background:rgba(255,255,255,0.6);display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;font-size:12px;color:#ea580c">${s.done ? '✓' : ''}</div>
      <div style="flex:1;font-size:15px;color:#1e1040;${s.done ? 'text-decoration:line-through;opacity:0.4' : ''}">${escapeHtml(s.text)}</div>
      <div onclick="removeTempStep(${s.id})" style="font-size:18px;color:rgba(30,16,64,0.25);cursor:pointer;padding:0 2px">×</div>
    </div>
  `).join('');
}

function saveTask() {
  const title = document.getElementById('task-input-title').value.trim();
  if (!title) { showToast('Введіть назву задачі'); return; }
  const desc = document.getElementById('task-input-desc').value.trim();
  const tasks = getTasks();

  if (editingTaskId) {
    const idx = tasks.findIndex(x => x.id === editingTaskId);
    if (idx !== -1) {
      tasks[idx] = { ...tasks[idx], title, desc, steps: tempSteps, updatedAt: Date.now() };
    }
  } else {
    tasks.unshift({ id: Date.now(), title, desc, steps: tempSteps, status: 'active', createdAt: Date.now() });
  }

  saveTasks(tasks);
  closeTaskModal();
  renderTasks();
  showToast(editingTaskId ? '✓ Задачу оновлено' : '✓ Задачу додано');

  // Тихий AI коментар для нової задачі
  if (!editingTaskId) askAIAboutTask(title, desc, tempSteps);
}

function toggleTaskStep(taskId, stepId) {
  const tasks = getTasks();
  const t = tasks.find(x => x.id === taskId);
  if (!t) return;
  const s = (t.steps || []).find(x => x.id === stepId);
  if (s) s.done = !s.done;

  // Перевіряємо чи всі кроки виконані
  const allDone = t.steps.length > 0 && t.steps.every(x => x.done);
  if (allDone) t.status = 'done';

  saveTasks(tasks);
  renderTasks();
}

function deleteTask(id) {
  const tasks = getTasks();
  const taskOrigIdx = tasks.findIndex(x => x.id === id);
  const item = tasks.find(x => x.id === id);
  if (item) addToTrash('task', item);
  saveTasks(tasks.filter(x => x.id !== id));
  renderTasks();
  if (item) showUndoToast('Задачу видалено', () => { const t = getTasks(); const idx = Math.min(taskOrigIdx, t.length); t.splice(idx, 0, item); saveTasks(t); renderTasks(); });
}

function toggleTaskStatus(id) {
  const tasks = getTasks();
  const t = tasks.find(x => x.id === id);
  if (!t) return;
  t.status = t.status === 'done' ? 'active' : 'done';
  saveTasks(tasks);
  renderTasks();
}

function renderTasks() {
  const tasks = getTasks();
  const list = document.getElementById('tasks-list');
  const empty = document.getElementById('tasks-empty');

  if (tasks.length === 0) {
    list.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  const active = tasks.filter(t => t.status !== 'done');
  const done = tasks.filter(t => t.status === 'done');
  const sorted = [...active, ...done];

  updateProdTabCounters();
  list.innerHTML = sorted.map(t => {
    const steps = t.steps || [];
    const doneCount = steps.filter(s => s.done).length;
    const pct = steps.length > 0 ? Math.round(doneCount / steps.length * 100) : (t.status === 'done' ? 100 : 0);
    const isDone = t.status === 'done';

    return `<div class="task-item-wrap" id="task-wrap-${t.id}" style="position:relative;margin:0 14px 10px;border-radius:16px">
      <div id="task-del-${t.id}" style="position:absolute;right:0;top:0;bottom:0;width:72px;background:linear-gradient(135deg,#ef4444,#dc2626);display:flex;align-items:center;justify-content:center;pointer-events:none;border-radius:16px;opacity:0;transition:opacity 0.15s"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg></div>
      <div id="task-item-${t.id}"
        ontouchstart="taskSwipeStart(event,${t.id})"
        ontouchmove="taskSwipeMove(event,${t.id})"
        ontouchend="taskSwipeEnd(event,${t.id})"
        style="background:linear-gradient(135deg,#c6f3fd,#a8ecfb);border:1.5px solid rgba(255,255,255,0.4);border-radius:16px;padding:14px 14px 12px;box-shadow:0 2px 12px rgba(0,0,0,0.04);opacity:${isDone ? '0.5' : '1'};cursor:pointer;-webkit-tap-highlight-color:transparent;position:relative;z-index:1">
      <div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:${steps.length ? '10px' : '0'}">
        <div data-task-check="1" ontouchend="event.stopPropagation();event.preventDefault();toggleTaskStatus(${t.id})" style="width:28px;height:28px;border-radius:8px;border:2px solid ${isDone ? '#ea580c' : 'rgba(234,88,12,0.3)'};background:rgba(255,255,255,0.78);display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;margin-top:1px;font-size:15px;color:#ea580c;transition:all 0.2s">${isDone ? '✓' : ''}</div>
        <div style="flex:1">
          <div style="font-size:16px;font-weight:700;color:#1e1040;${isDone ? 'text-decoration:line-through;opacity:0.5' : ''};line-height:1.4">${escapeHtml(t.title)}</div>
          ${t.desc ? `<div style="font-size:14px;color:rgba(30,16,64,0.45);margin-top:2px">${escapeHtml(t.desc)}</div>` : ''}
        </div>
      </div>
      ${steps.length > 0 ? `
        <div style="height:3px;background:rgba(0,0,0,0.06);border-radius:3px;overflow:hidden;margin-bottom:8px">
          <div style="height:100%;width:${pct}%;background:linear-gradient(90deg,#f97316,#ea580c);border-radius:3px;transition:width 0.3s"></div>
        </div>
        <div style="display:flex;flex-direction:column;gap:5px;margin-bottom:10px">
          ${steps.map(s => `
            <div data-step-check="1" ontouchend="event.stopPropagation();event.preventDefault();toggleTaskStep(${t.id},${s.id})" style="display:flex;align-items:center;gap:10px;cursor:pointer;padding:4px 0">
              <div style="width:24px;height:24px;border-radius:7px;border:1.5px solid ${s.done ? '#ea580c' : 'rgba(30,16,64,0.18)'};background:rgba(255,255,255,0.6);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:13px;color:#ea580c">${s.done ? '✓' : ''}</div>
              <div style="flex:1;font-size:14px;color:rgba(30,16,64,0.65);${s.done ? 'text-decoration:line-through;opacity:0.4' : ''}">${escapeHtml(s.text)}</div>
            </div>
          `).join('')}
        </div>
      ` : ''}
    </div></div>`;
  }).join('');
}

async function askAIAboutTask(title, desc, steps) {
  const key = localStorage.getItem('nm_gemini_key');
  if (!key) return;
  const aiContext = getAIContext();
  const systemPrompt = `${getOWLPersonality()} Користувач щойно додав задачу. Дай коротку (1-2 речення) реакцію у своєму стилі. Фокус на тому ЯК досягти мети. Якщо задача нечітка — запропонуй перший конкретний крок. Відповідай українською.${aiContext ? '\n\n' + aiContext : ''}`;
  const steps_text = steps.length ? `\nКроки: ${steps.map(s => s.text).join(', ')}` : '';
  const reply = await callAI(systemPrompt, `Задача: ${title}${desc ? '\nОпис: ' + desc : ''}${steps_text}`, {});
  if (!reply) return;
  const commentEl = document.getElementById('tasks-ai-comment');
  if (commentEl) {
    commentEl.textContent = reply;
    commentEl.style.display = 'block';
  }
}

// Відкриваємо задачі при переключенні вкладки — через хук в renderTasks

// === ME TAB ===
function renderMe() {
  const inbox = JSON.parse(localStorage.getItem('nm_inbox') || '[]');
  const tasks = JSON.parse(localStorage.getItem('nm_tasks') || '[]');
  const notes = getNotes();

  // Stats
  document.getElementById('me-stat-inbox').textContent = inbox.length;
  document.getElementById('me-stat-tasks').textContent = tasks.filter(t => t.status !== 'done').length;
  document.getElementById('me-stat-notes').textContent = notes.length;

  // Week grid — активність по дням (inbox записи)
  const weekEl = document.getElementById('me-week-grid');
  const days = ['Пн','Вт','Ср','Чт','Пт','Сб','Нд'];
  const now = new Date();
  const todayDow = (now.getDay() + 6) % 7; // 0=Пн
  weekEl.innerHTML = days.map((d, i) => {
    const daysAgo = todayDow - i;
    const date = new Date(now);
    date.setDate(now.getDate() - daysAgo);
    const dateStr = date.toDateString();
    const count = inbox.filter(item => new Date(item.ts).toDateString() === dateStr).length;
    const future = daysAgo < 0;
    let bg = 'rgba(30,16,64,0.05)', color = 'rgba(30,16,64,0.2)';
    if (!future && count > 0) { bg = count >= 5 ? '#16a34a' : count >= 2 ? 'rgba(22,163,74,0.4)' : 'rgba(22,163,74,0.2)'; color = count >= 5 ? 'white' : '#16a34a'; }
    const isToday = daysAgo === 0;
    return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px">
      <div style="font-size:10px;font-weight:700;color:rgba(30,16,64,0.35)">${d}</div>
      <div style="width:32px;height:32px;border-radius:9px;background:${bg};display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:${color};${isToday ? 'box-shadow:0 0 0 2px rgba(22,163,74,0.4)' : ''}">${future ? '–' : count || '·'}</div>
    </div>`;
  }).join('');

  // Categories breakdown
  const catEl = document.getElementById('me-categories');
  const catCount = {};
  inbox.forEach(i => { catCount[i.category] = (catCount[i.category] || 0) + 1; });
  const total = inbox.length || 1;
  const catColors = { note:'#6366f1', idea:'#f59e0b', task:'#ea580c', habit:'#16a34a', event:'#0ea5e9' };
  const catLabels = { note:'Нотатки', idea:'Ідеї', task:'Задачі', habit:'Звички', event:'Події', finance:'Фінанси' };
  catEl.innerHTML = Object.entries(catCount).sort((a,b) => b[1]-a[1]).map(([cat, cnt]) => {
    const pct = Math.round(cnt / total * 100);
    const color = catColors[cat] || '#888';
    return `<div style="display:flex;align-items:center;gap:8px">
      <div style="font-size:13px;font-weight:700;color:rgba(30,16,64,0.5);width:52px">${catLabels[cat]||cat}</div>
      <div style="flex:1;height:6px;background:rgba(0,0,0,0.05);border-radius:4px;overflow:hidden">
        <div style="height:100%;width:${pct}%;background:${color};border-radius:4px;transition:width 0.6s ease"></div>
      </div>
      <div style="font-size:13px;font-weight:700;color:rgba(30,16,64,0.4);width:28px;text-align:right">${cnt}</div>
    </div>`;
  }).join('') || '<div style="font-size:14px;color:rgba(30,16,64,0.3)">Немає даних</div>';

  // Activity last 14 days
  const actEl = document.getElementById('me-activity');
  const days14 = Array.from({length:14}, (_,i) => {
    const d = new Date(now);
    d.setDate(now.getDate() - (13 - i));
    return d.toDateString();
  });
  const maxAct = Math.max(1, ...days14.map(ds => inbox.filter(i => new Date(i.ts).toDateString() === ds).length));
  actEl.innerHTML = days14.map((ds, i) => {
    const cnt = inbox.filter(item => new Date(item.ts).toDateString() === ds).length;
    const h = Math.max(4, Math.round(cnt / maxAct * 44));
    const isToday = i === 13;
    return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:2px">
      <div style="width:100%;height:${h}px;background:${isToday ? '#16a34a' : 'rgba(22,163,74,0.3)'};border-radius:3px;transition:height 0.5s ease"></div>
    </div>`;
  }).join('');
}

async function refreshMeAnalysis() {
  const btn = document.getElementById('me-refresh-btn');
  const el = document.getElementById('me-ai-analysis');
  btn.textContent = '…';
  btn.disabled = true;
  el.textContent = '…';

  const inbox = JSON.parse(localStorage.getItem('nm_inbox') || '[]');
  const tasks = JSON.parse(localStorage.getItem('nm_tasks') || '[]');
  const notes = getNotes();
  const aiContext = getAIContext();
  const totalRecords = inbox.length + tasks.length + notes.length;

  if (totalRecords < 3) {
    el.textContent = 'Ще замало даних для аналізу. Додай кілька записів в Inbox, створи задачі або нотатки — і я дам тобі корисний аналіз.';
    btn.textContent = '↻';
    btn.disabled = false;
    return;
  }

  const dataNote = totalRecords < 10 ? 'УВАГА: даних мало, не роби глибоких висновків про особистість — просто опиши що бачиш і запропонуй що додати.' : '';
  const systemPrompt = `${getOWLPersonality()} Проаналізуй дані та дай короткий аналіз (3-5 речень) у своєму стилі. Що вдається добре і що можна покращити — конкретно. ${dataNote} Завершуй конкретною порадою. Відповідай українською.${aiContext ? '\n\n' + aiContext : ''}`;

  const userData = `Записів в Inbox: ${inbox.length}
Активних задач: ${tasks.filter(t=>t.status!=='done').length}
Виконаних задач: ${tasks.filter(t=>t.status==='done').length}
Нотаток: ${notes.length}
Останні 10 записів: ${inbox.slice(0,10).map(i=>`[${i.category}] ${i.text}`).join('; ')}`;

  const reply = await callAI(systemPrompt, userData, {});
  el.textContent = reply || 'Не вдалось отримати аналіз. Спробуй ще раз.';
  btn.textContent = '↻';
  btn.disabled = false;

  // Генеруємо 3 поради окремим запитом
  if (reply && totalRecords >= 5) {
    const adviceEl = document.getElementById('me-ai-advice');
    const adviceBlock = document.getElementById('me-advice-block');
    if (adviceEl && adviceBlock) {
      adviceEl.textContent = '…';
      adviceBlock.style.display = 'block';
      const advicePrompt = `${getOWLPersonality()} На основі аналізу дай рівно 3 конкретні, практичні поради для цієї людини. Кожна порада — одне речення, максимально конкретна і дієва. Формат відповіді: "1. [порада]\n2. [порада]\n3. [порада]". Відповідай українською.${aiContext ? '\n\n' + aiContext : ''}`;
      const adviceReply = await callAI(advicePrompt, `Аналіз: ${reply}

Дані: ${userData}`, {});
      if (adviceReply) {
        adviceEl.innerHTML = adviceReply.split('\n').filter(l => l.trim()).map(l => `<div style="margin-bottom:8px">${escapeHtml(l.trim())}</div>`).join('');
      } else {
        adviceBlock.style.display = 'none';
      }
    }
  }
}

// === EVENING TAB ===
let currentMomentMood = 'positive';
let dialogHistory = [];
let dialogLoading = false;

function getMoments() { return JSON.parse(localStorage.getItem('nm_moments') || '[]'); }
function saveMoments(arr) { localStorage.setItem('nm_moments', JSON.stringify(arr)); }

function renderEvening() {
  const moments = getMoments();
  const today = new Date().toDateString();
  const todayMoments = moments.filter(m => new Date(m.ts).toDateString() === today);

  // Додаємо нотатки за сьогодні з nm_notes (без копіювання — читаємо напряму)
  const allNotes = getNotes();
  const todayNotes = allNotes.filter(n => new Date(n.ts || n.createdAt || 0).toDateString() === today);
  // Обʼєднуємо: спочатку події/моменти, потім нотатки — без дублів
  const notesAsItems = todayNotes.map(n => ({
    id: 'note_' + n.id,
    text: n.title || n.text || '',
    mood: 'neutral',
    ts: n.ts || n.createdAt || 0,
    isNote: true,
    folder: n.folder || 'note'
  }));
  const allTodayItems = [...todayMoments, ...notesAsItems]
    .sort((a, b) => (b.ts || 0) - (a.ts || 0));

  // Відновлюємо збережений підсумок
  try {
    const saved = JSON.parse(localStorage.getItem('nm_evening_summary') || 'null');
    if (saved && saved.date === today && saved.text) {
      const el = document.getElementById('evening-summary');
      if (el && el.textContent.includes('Натисни')) el.textContent = saved.text;
    }
  } catch(e) {}

  // Score — based on today's positive vs negative moments
  const pos = todayMoments.filter(m => m.mood === 'positive').length;
  const neg = todayMoments.filter(m => m.mood === 'negative').length;
  const total = todayMoments.length;
  const score = total > 0 ? Math.round((pos / total) * 100) : 0;

  const arc = document.getElementById('evening-ring-arc');
  const pctEl = document.getElementById('evening-ring-pct');
  const descEl = document.getElementById('evening-score-desc');

  if (arc) {
    const offset = 157 - (157 * score / 100);
    setTimeout(() => { arc.style.strokeDashoffset = offset; }, 100);
    pctEl.textContent = score + '%';
    descEl.textContent = total === 0 && todayNotes.length === 0 ? 'Додай моменти дня' :
      score >= 70 ? 'Гарний день 💪' : score >= 40 ? 'Середній день' : 'Важкий день';
  }

  // Moments + Notes list
  const momEl = document.getElementById('evening-moments');
  if (allTodayItems.length === 0) {
    momEl.innerHTML = '<div style="font-size:14px;color:rgba(30,16,64,0.3);text-align:center;padding:8px">Додай моменти свого дня</div>';
  } else {
    const moodColors = { positive:'#16a34a', neutral:'#d97706', negative:'#ef4444' };
    const folderIcons = { note:'📝', idea:'💡', event:'📅' };
    momEl.innerHTML = allTodayItems.map(m => `
      <div style="display:flex;align-items:flex-start;gap:8px;padding:8px 0;border-bottom:1px solid rgba(30,16,64,0.05)">
        <div style="width:8px;height:8px;border-radius:50%;background:${m.isNote ? '#818cf8' : (moodColors[m.mood]||'#888')};margin-top:5px;flex-shrink:0"></div>
        <div style="flex:1;min-width:0">
          <div style="font-size:15px;color:#1e1040;line-height:1.5;font-weight:${m.summary ? '600' : '400'}">${escapeHtml(m.summary || m.text)}${m.isNote ? ' <span style="font-size:11px;color:rgba(30,16,64,0.3)">' + (folderIcons[m.folder] || '📝') + '</span>' : ''}</div>
          ${m.summary ? `<div style="font-size:12px;color:rgba(30,16,64,0.35);line-height:1.4;margin-top:2px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical">${escapeHtml(m.text)}</div>` : ''}
        </div>
        ${!m.isNote ? `<div onclick="deleteMoment(${m.id})" style="font-size:18px;color:rgba(30,16,64,0.2);cursor:pointer">×</div>` : ''}
      </div>
    `).join('');
  }

  // Фінанси сьогодні
  try {
    const todayFinTxs = getFinance().filter(t => new Date(t.ts).toDateString() === today);
    const finBlock = document.getElementById('evening-finance-block');
    const finContent = document.getElementById('evening-finance-content');
    if (finBlock && finContent && todayFinTxs.length > 0) {
      finBlock.style.display = 'block';
      const todayExp = todayFinTxs.filter(t => t.type === 'expense').reduce((s,t) => s+t.amount, 0);
      const todayInc = todayFinTxs.filter(t => t.type === 'income').reduce((s,t) => s+t.amount, 0);
      finContent.innerHTML = todayFinTxs.slice(0,5).map(t =>
        `<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid rgba(194,65,12,0.08);font-size:13px">
          <span style="color:#7c2d12;font-weight:600">${escapeHtml(t.category)}${t.comment ? ' · '+escapeHtml(t.comment) : ''}</span>
          <span style="font-weight:700;color:${t.type==='expense'?'#c2410c':'#16a34a'}">${t.type==='expense'?'-':'+'}${formatMoney(t.amount)}</span>
        </div>`
      ).join('') + (todayExp > 0 || todayInc > 0 ? `<div style="margin-top:6px;font-size:13px;color:rgba(194,65,12,0.6);font-weight:600">${todayExp>0?'Витрати: '+formatMoney(todayExp):''}${todayExp>0&&todayInc>0?' · ':''}${todayInc>0?'Доходи: +'+formatMoney(todayInc):''}</div>` : '');
    } else if (finBlock) {
      finBlock.style.display = 'none';
    }
  } catch(e) {}
}

function openAddMoment() {
  currentMomentMood = 'positive';
  document.getElementById('moment-input-text').value = '';
  updateMoodButtons();
  document.getElementById('moment-modal').style.display = 'flex';
  setTimeout(() => { const el = document.getElementById('moment-input-text'); el.removeAttribute('readonly'); el.focus(); }, 350);
}

function closeMomentModal() {
  document.getElementById('moment-modal').style.display = 'none';
}

function setMomentMood(mood) {
  currentMomentMood = mood;
  updateMoodButtons();
}

function updateMoodButtons() {
  ['positive','neutral','negative'].forEach(m => {
    const btn = document.getElementById('mood-' + m);
    if (!btn) return;
    btn.style.opacity = currentMomentMood === m ? '1' : '0.4';
    btn.style.transform = currentMomentMood === m ? 'scale(1.04)' : 'scale(1)';
  });
}

function saveMoment() {
  const text = document.getElementById('moment-input-text').value.trim();
  if (!text) { showToast('Введіть текст моменту'); return; }
  const moments = getMoments();
  const newMoment = { id: Date.now(), text, mood: currentMomentMood, ts: Date.now() };
  moments.push(newMoment);
  saveMoments(moments);
  closeMomentModal();
  renderEvening();
  showToast('✓ Момент збережено');
  // Генеруємо короткий summary через ШІ (у фоні, не блокує UI)
  generateMomentSummary(newMoment.id, text);
}

async function generateMomentSummary(momentId, text) {
  const key = localStorage.getItem('nm_gemini_key');
  if (!key) return;
  // Не генеруємо для коротких текстів — вони вже короткі
  if (text.length <= 60) return;
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: `Стисни цей момент дня до 1 короткої фрази (максимум 7 слів, без крапки в кінці, українською): "${text}"` }],
        max_tokens: 30, temperature: 0.5
      })
    });
    const data = await res.json();
    const summary = data.choices?.[0]?.message?.content?.trim().replace(/["""]/g, '');
    if (!summary) return;
    // Зберігаємо summary в обʼєкт моменту
    const moments = getMoments();
    const idx = moments.findIndex(m => m.id === momentId);
    if (idx !== -1) {
      moments[idx].summary = summary;
      saveMoments(moments);
      renderEvening(); // оновлюємо UI після отримання summary
    }
  } catch(e) {}
}

function deleteMoment(id) {
  saveMoments(getMoments().filter(m => m.id !== id));
  renderEvening();
}

const EVENING_SUMMARY_PROMPT = `${getOWLPersonality()} Зроби підсумок дня (3-4 речення) у своєму стилі. Звертайся на "ти". Відзнач що сьогодні вдалось. Якщо є що покращити — скажи конкретно. Завершуй думкою на завтра. Відповідай українською.`;

async function generateEveningSummary() {
  const btn = document.getElementById('evening-summary-btn');
  const el = document.getElementById('evening-summary');
  btn.textContent = '…';
  btn.disabled = true;
  el.textContent = '…';

  const today = new Date().toDateString();
  const moments = getMoments().filter(m => new Date(m.ts).toDateString() === today);
  const inbox = JSON.parse(localStorage.getItem('nm_inbox') || '[]').filter(i => new Date(i.ts).toDateString() === today);
  const aiContext = getAIContext();

  const systemPrompt = EVENING_SUMMARY_PROMPT + (aiContext ? `\n\n${aiContext}` : '');

  const dayData = `Моменти дня: ${moments.map(m=>`[${m.mood}] ${m.text}`).join('; ') || 'немає'}
Записи в Inbox за сьогодні: ${inbox.map(i=>`[${i.category}] ${i.text}`).join('; ') || 'немає'}`;

  const reply = await callAI(systemPrompt, dayData, {});
  const text = reply || 'Не вдалось отримати підсумок.';
  el.textContent = text;
  // Зберігаємо підсумок в localStorage — відновиться після перезапуску
  localStorage.setItem('nm_evening_summary', JSON.stringify({ text, date: today }));
  btn.textContent = '↻';
  btn.disabled = false;
}

// === АВТОПІДСУМОК ВЕЧОРА ЩОГОДИНИ ===
async function autoEveningSummary() {
  const key = localStorage.getItem('nm_gemini_key');
  if (!key) return;

  // Перевіряємо чи є взагалі записи за сьогодні
  const today = new Date().toDateString();
  const moments = getMoments().filter(m => new Date(m.ts).toDateString() === today);
  const inbox = JSON.parse(localStorage.getItem('nm_inbox') || '[]').filter(i => new Date(i.ts).toDateString() === today);
  if (moments.length === 0 && inbox.length === 0) return; // нема чого підсумовувати

  // Перевіряємо чи не оновлювали менше ніж 50 хвилин тому
  try {
    const saved = JSON.parse(localStorage.getItem('nm_evening_summary') || 'null');
    if (saved && saved.date === today && saved.autoTs) {
      const elapsed = Date.now() - saved.autoTs;
      if (elapsed < 50 * 60 * 1000) return; // 50 хвилин
    }
  } catch(e) {}

  const aiContext = getAIContext();
  const systemPrompt = EVENING_SUMMARY_PROMPT + (aiContext ? `\n\n${aiContext}` : '');
  const dayData = `Моменти дня: ${moments.map(m=>`[${m.mood}] ${m.text}`).join('; ') || 'немає'}
Записи в Inbox за сьогодні: ${inbox.map(i=>`[${i.category}] ${i.text}`).join('; ') || 'немає'}`;

  try {
    const reply = await callAI(systemPrompt, dayData, {});
    if (!reply) return;
    // Зберігаємо з позначкою autoTs — щоб не запускати занадто часто
    localStorage.setItem('nm_evening_summary', JSON.stringify({ text: reply, date: today, autoTs: Date.now() }));
    // Якщо зараз відкрита вкладка Вечір — оновлюємо UI
    if (currentTab === 'evening') {
      const el = document.getElementById('evening-summary');
      if (el) el.textContent = reply;
    }
  } catch(e) {}
}

function setupAutoEveningSummary() {
  // Перший раз — через 5 хвилин після старту
  setTimeout(() => {
    autoEveningSummary();
    // Далі — кожну годину
    setInterval(autoEveningSummary, 60 * 60 * 1000);
  }, 5 * 60 * 1000);
}

// Evening dialog
function openEveningDialog() {
  dialogHistory = [];
  document.getElementById('evening-dialog').style.display = 'flex';
  document.getElementById('dialog-messages').innerHTML = '';
  document.getElementById('dialog-input').value = '';

  // Перше повідомлення від агента
  const settings = JSON.parse(localStorage.getItem('nm_settings') || '{}');
  const name = settings.name ? `, ${settings.name}` : '';
  addDialogMessage('agent', `Привіт${name}. Розкажи як пройшов день — що вийшло, що ні. Без прикрас.`);
}

function closeEveningDialog() {
  document.getElementById('evening-dialog').style.display = 'none';
}

function addDialogMessage(role, text) {
  const el = document.getElementById('dialog-messages');
  const isAgent = role === 'agent';
  const div = document.createElement('div');
  div.style.cssText = `display:flex;${isAgent ? '' : 'justify-content:flex-end'}`;
  div.innerHTML = `<div style="max-width:80%;background:${isAgent ? 'rgba(237,233,255,0.9)' : '#7c3aed'};color:${isAgent ? '#4c1d95' : 'white'};border-radius:${isAgent ? '4px 16px 16px 16px' : '16px 4px 16px 16px'};padding:10px 13px;font-size:15px;line-height:1.55;font-weight:500">${escapeHtml(text)}</div>`;
  el.appendChild(div);
  el.scrollTop = el.scrollHeight;
  dialogHistory.push({ role: isAgent ? 'assistant' : 'user', content: text });
}

async function sendDialogMessage() {
  if (dialogLoading) return;
  const input = document.getElementById('dialog-input');
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  input.style.height = 'auto';
  addDialogMessage('user', text);
  dialogLoading = true;

  const aiContext = getAIContext();
  const today = new Date().toDateString();
  const moments = getMoments().filter(m => new Date(m.ts).toDateString() === today);
  const systemPrompt = `${getOWLPersonality()} Короткі відповіді (1-3 речення). Конкретно і по ділу. Відповідай українською.${aiContext ? '\n\n' + aiContext : ''}
Контекст дня: ${moments.map(m=>`[${m.mood}] ${m.text}`).join('; ') || 'моменти не додані'}`;

  const key = localStorage.getItem('nm_gemini_key');
  if (!key) { addDialogMessage('agent', 'Введи OpenAI ключ в налаштуваннях.'); dialogLoading = false; return; }

  // Відправляємо всю історію
  const messages = [
    { role: 'system', content: systemPrompt },
    ...dialogHistory.slice(-10) // останні 10 повідомлень
  ];

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({ model: 'gpt-4o-mini', messages, max_tokens: 200, temperature: 0.8 })
    });
    const data = await res.json();
    const reply = data.choices?.[0]?.message?.content;
    if (reply) addDialogMessage('agent', reply);
    else addDialogMessage('agent', 'Щось пішло не так. Спробуй ще раз.');
  } catch {
    addDialogMessage('agent', 'Мережева помилка.');
  }
  dialogLoading = false;
}

// === SLIDES TOUR ===
const UPDATE_VERSION = 'v028'; // змінювати при кожному оновленні зі слайдами

const UPDATE_SLIDES = [
  {
    tag: '🆕 v0.28',
    title: 'NeverMind став зручнішим',
    body: `<p style="font-size:14px;color:rgba(30,16,64,0.58);line-height:1.6;margin-bottom:12px">Великий UX апдейт — навігація, редагування і дизайн стали простішими і логічнішими.</p>
<p style="font-size:14px;color:rgba(30,16,64,0.58);line-height:1.6">Всі твої дані на місці. Просто спробуй — відчуєш різницю.</p>`,
    color: 'linear-gradient(135deg,#f2d978,#f97316)',
  },
  {
    tag: '👆 Тап по картці',
    title: 'Тап — і одразу редагуєш',
    body: `<p style="font-size:14px;color:rgba(30,16,64,0.58);line-height:1.6;margin-bottom:10px">Більше не треба шукати кнопку олівця або три крапки:</p>
<div style="display:flex;flex-direction:column;gap:8px">
  <div style="background:rgba(30,16,64,0.04);border-radius:10px;padding:9px 12px;font-size:13px;color:rgba(30,16,64,0.65)"><b style="color:#1e1040">Тап по картці</b> → відкриває вікно редагування</div>
  <div style="background:rgba(30,16,64,0.04);border-radius:10px;padding:9px 12px;font-size:13px;color:rgba(30,16,64,0.65)"><b style="color:#1e1040">Чекбокс</b> → виконати задачу або звичку</div>
  <div style="background:rgba(30,16,64,0.04);border-radius:10px;padding:9px 12px;font-size:13px;color:rgba(30,16,64,0.65)"><b style="color:#1e1040">Свайп вліво</b> → видалити картку</div>
</div>`,
    color: 'linear-gradient(135deg,#fdb87a,#f97316)',
  },
  {
    tag: '🥁 Новий таббар',
    title: 'Барабан замість рядка',
    body: `<p style="font-size:14px;color:rgba(30,16,64,0.58);line-height:1.6;margin-bottom:10px">Таббар тепер — капсула-барабан:</p>
<div style="display:flex;flex-direction:column;gap:8px">
  <div style="background:rgba(30,16,64,0.04);border-radius:10px;padding:9px 12px;font-size:13px;color:rgba(30,16,64,0.65)"><b style="color:#1e1040">Тягни барабан</b> ← → щоб переключати вкладки</div>
  <div style="background:rgba(30,16,64,0.04);border-radius:10px;padding:9px 12px;font-size:13px;color:rgba(30,16,64,0.65)"><b style="color:#1e1040">Свайп по екрану</b> також перемикає вкладки</div>
  <div style="background:rgba(30,16,64,0.04);border-radius:10px;padding:9px 12px;font-size:13px;color:rgba(30,16,64,0.65)">Задачі і Звички — <b style="color:#1e1040">окремі вкладки</b> в навігації</div>
</div>`,
    color: 'linear-gradient(135deg,#fed7aa,#f97316)',
  },
  {
    tag: '📝 Нотатки',
    title: 'Пиши прямо у вікні нотатки',
    body: `<p style="font-size:14px;color:rgba(30,16,64,0.58);line-height:1.6;margin-bottom:10px">Відкрив нотатку — і одразу можна писати:</p>
<div style="display:flex;flex-direction:column;gap:8px">
  <div style="background:rgba(30,16,64,0.04);border-radius:10px;padding:9px 12px;font-size:13px;color:rgba(30,16,64,0.65)"><b style="color:#1e1040">Тап по тексту</b> → курсор і клавіатура</div>
  <div style="background:rgba(30,16,64,0.04);border-radius:10px;padding:9px 12px;font-size:13px;color:rgba(30,16,64,0.65)"><b style="color:#1e1040">Автозбереження</b> — зміни зберігаються самі</div>
  <div style="background:rgba(30,16,64,0.04);border-radius:10px;padding:9px 12px;font-size:13px;color:rgba(30,16,64,0.65)">Колір вікна = <b style="color:#1e1040">колір папки</b> нотатки</div>
</div>`,
    color: 'linear-gradient(135deg,#a7f3d0,#22c55e)',
  },
  {
    tag: '❓ Довідка',
    title: 'Довідка стала зрозумілішою',
    body: `<p style="font-size:14px;color:rgba(30,16,64,0.58);line-height:1.6;margin-bottom:10px">Натисни <b style="color:#1e1040">?</b> на будь-якій вкладці:</p>
<div style="display:flex;flex-direction:column;gap:8px">
  <div style="background:rgba(30,16,64,0.04);border-radius:10px;padding:9px 12px;font-size:13px;color:rgba(30,16,64,0.65)">Кольоровий хедер — одразу видно про яку вкладку</div>
  <div style="background:rgba(30,16,64,0.04);border-radius:10px;padding:9px 12px;font-size:13px;color:rgba(30,16,64,0.65)">Зрозумілі іконки і живий текст замість технічного</div>
</div>`,
    color: 'linear-gradient(135deg,#818cf8,#4f46e5)',
    isLast: true,
  },
];

const SLIDES = [
  {
    tag: 'Що таке NeverMind',
    title: 'Думки зникають. Записав — забув де.',
    body: `<p style="font-size:14px;color:rgba(30,16,64,0.58);line-height:1.6;margin-bottom:12px">Нічого не виконується бо немає системи.</p>
<p style="font-size:14px;color:rgba(30,16,64,0.58);line-height:1.6">NeverMind — один потік куди скидаєш все що в голові. Пишеш одним рядком — Агент визначає категорію, зберігає куди треба і підтверджує в чаті.</p>`,
    color: 'linear-gradient(135deg,#f2d978,#f97316)',
  },
  {
    tag: 'Inbox',
    title: 'Один рядок — Агент розбирає',
    body: `<div style="display:flex;flex-direction:column;gap:7px">
      <div style="background:rgba(30,16,64,0.04);border-radius:10px;padding:9px 12px;font-size:13px;color:rgba(30,16,64,0.65);line-height:1.5">"купити хліб о 18:00" → <b style="color:#1e1040">задача з часом</b></div>
      <div style="background:rgba(30,16,64,0.04);border-radius:10px;padding:9px 12px;font-size:13px;color:rgba(30,16,64,0.65);line-height:1.5">"бігати щоранку" → <b style="color:#1e1040">звичка в трекері</b></div>
      <div style="background:rgba(30,16,64,0.04);border-radius:10px;padding:9px 12px;font-size:13px;color:rgba(30,16,64,0.65);line-height:1.5">"ідея про автоматизацію" → <b style="color:#1e1040">збережено в Ідеях. Обговори з Агентом</b></div>
      <div style="background:rgba(30,16,64,0.04);border-radius:10px;padding:9px 12px;font-size:13px;color:rgba(30,16,64,0.65);line-height:1.5">"зустрівся з Вовою" → <b style="color:#1e1040">момент у Вечорі</b></div>
    </div>`,
    color: 'linear-gradient(135deg,#f2d978,#f97316)',
  },
  {
    tag: 'Задачі та Звички',
    title: 'Списки і команди Агенту',
    body: `<p style="font-size:13px;color:rgba(30,16,64,0.55);line-height:1.5;margin-bottom:10px">Пиши список одним записом — Агент розібʼє на кроки:</p>
<div style="background:rgba(30,16,64,0.04);border-radius:10px;padding:9px 12px;font-size:13px;color:#1e1040;font-style:italic;margin-bottom:12px">"Зробити ремонт: купити фарбу, найняти майстра, вибрати колір"</div>
<div style="font-size:11px;font-weight:800;color:rgba(30,16,64,0.3);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:7px">Команди Агенту</div>
<div style="display:flex;flex-direction:column;gap:5px">
  <div style="background:rgba(79,70,229,0.07);border-radius:8px;padding:7px 10px;font-size:12px;font-family:monospace;color:#4f46e5;font-weight:600">"додай крок: зателефонувати"</div>
  <div style="background:rgba(79,70,229,0.07);border-radius:8px;padding:7px 10px;font-size:12px;font-family:monospace;color:#4f46e5;font-weight:600">"відміни останній крок"</div>
  <div style="background:rgba(79,70,229,0.07);border-radius:8px;padding:7px 10px;font-size:12px;font-family:monospace;color:#4f46e5;font-weight:600">"які задачі відкриті"</div>
</div>`,
    color: 'linear-gradient(135deg,#fdb87a,#ea580c)',
  },
  {
    tag: 'Вечір',
    title: 'Підсумок дня від Агента',
    body: `<p style="font-size:14px;color:rgba(30,16,64,0.58);line-height:1.6;margin-bottom:12px">Щодня: що зробив, що було цікавого, про що думав. Додавай моменти — Агент бачить весь твій день і дає конкретну пораду на завтра.</p>
<p style="font-size:14px;color:rgba(30,16,64,0.58);line-height:1.6">Записи з Inbox автоматично потрапляють у Вечір.</p>`,
    color: 'linear-gradient(135deg,#818cf8,#4f46e5)',
  },
  {
    tag: 'Вкладка Я',
    title: 'Твоя продуктивність чесно',
    body: `<p style="font-size:14px;color:rgba(30,16,64,0.58);line-height:1.6;margin-bottom:12px">Активність щодня, скільки записів зробив, які звички пропускаєш, де провисаєш.</p>
<p style="font-size:14px;color:rgba(30,16,64,0.58);line-height:1.6">Агент дає чесний аналіз і конкретні поради — без лестощів.</p>`,
    color: 'linear-gradient(135deg,#6ee7b7,#16a34a)',
  },
  {
    tag: 'Фінанси',
    title: 'Облік грошей без таблиць',
    body: `<p style="font-size:14px;color:rgba(30,16,64,0.58);line-height:1.6;margin-bottom:12px">Пиши в Inbox: "витратив 50 на їжу" — Агент сам запише у Фінанси, визначить категорію і стежитиме за бюджетом.</p>
<div style="display:flex;flex-direction:column;gap:6px">
  <div style="background:rgba(30,16,64,0.04);border-radius:10px;padding:8px 12px;font-size:13px;color:rgba(30,16,64,0.65)">"отримав зарплату 3000" → <b style="color:#1e1040">дохід зафіксовано</b></div>
  <div style="background:rgba(30,16,64,0.04);border-radius:10px;padding:8px 12px;font-size:13px;color:rgba(30,16,64,0.65)">"заплатив за Netflix 15" → <b style="color:#1e1040">Підписки</b></div>
  <div style="background:rgba(30,16,64,0.04);border-radius:10px;padding:8px 12px;font-size:13px;color:rgba(30,16,64,0.65)">Перевищив ліміт → <b style="color:#1e1040">Агент попередить</b></div>
</div>`,
    color: 'linear-gradient(135deg,#fcd9bd,#f97316)',
    isLast: true,
  },
];

let currentSlide = 0;

let _slidesIsUpdate = false;

let _slidesFromOnboarding = false;

function openSlidesTour(fromOnboarding = false) {
  _slidesFromOnboarding = fromOnboarding;
  _slidesIsUpdate = false;
  currentSlide = 0;
  const el = document.getElementById('slides-tour');
  el.style.display = 'flex';
  renderSlide();
}

function openUpdateSlides() {
  _slidesFromOnboarding = false;
  _slidesIsUpdate = true;
  currentSlide = 0;
  const el = document.getElementById('slides-tour');
  el.style.display = 'flex';
  renderSlide();
}

function closeSlidesTour(fromOnboarding = false) {
  const el = document.getElementById('slides-tour');
  el.style.opacity = '0';
  el.style.transition = 'opacity 0.3s ease';
  // Зберігаємо що бачили поточне оновлення
  if (_slidesIsUpdate) {
    localStorage.setItem('nm_seen_update', UPDATE_VERSION);
  }
  setTimeout(() => {
    el.style.display = 'none'; el.style.opacity = ''; el.style.transition = '';
    if (fromOnboarding && !localStorage.getItem('nm_survey_done')) {
      startSurvey();
    }
  }, 300);
}

function getCurrentSlides() {
  return _slidesIsUpdate ? UPDATE_SLIDES : SLIDES;
}

function slidesNext() {
  const slides = getCurrentSlides();
  if (currentSlide < slides.length - 1) {
    currentSlide++;
    renderSlide();
  } else {
    closeSlidesTour(_slidesFromOnboarding);
  }
}

function renderSlide() {
  const slides = getCurrentSlides();
  const slide = slides[currentSlide];
  const total = slides.length;

  // Крапки прогресу
  const dotsEl = document.getElementById('slides-dots');
  dotsEl.innerHTML = Array.from({length: total}, (_, i) => {
    const isActive = i === currentSlide;
    const isDone = i < currentSlide;
    const bg = isActive || isDone ? '#f97316' : 'rgba(30,16,64,0.1)';
    const w = isActive ? '24px' : '7px';
    return `<div style="height:4px;width:${w};border-radius:2px;background:${bg};transition:all 0.3s"></div>`;
  }).join('');

  // Контент
  const contentEl = document.getElementById('slides-content');
  contentEl.innerHTML = `
    <div style="display:inline-block;font-size:11px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;padding:3px 10px;border-radius:20px;background:rgba(30,16,64,0.06);color:rgba(30,16,64,0.4);margin-bottom:10px">${slide.tag}</div>
    <div style="font-size:17px;font-weight:800;color:#1e1040;line-height:1.35;margin-bottom:14px">${slide.title}</div>
    ${slide.body}
  `;

  // Кнопка
  const nextBtn = document.getElementById('slides-next-btn');
  nextBtn.textContent = slide.isLast ? 'Почати →' : 'Далі →';
  nextBtn.style.background = slide.color;

  // Пропустити → Закрити на останньому
  const skipBtn = document.getElementById('slides-skip-btn');
  skipBtn.textContent = slide.isLast ? '' : 'Пропустити';
  skipBtn.style.display = slide.isLast ? 'none' : 'block';
}


// === ONBOARDING ===
// === HELP SYSTEM ===
const HELP_CONTENT = {
  inbox: {
    title: 'Inbox',
    subtitle: 'Один потік для всіх думок.',
    color: 'linear-gradient(135deg, #f2d978, #f97316)',
    accent: '#8b6914',
    sections: [
      { title: 'Як писати', items: [
        { icon: 'edit',  title: 'Будь-який текст', desc: 'Пиши як думаєш. Агент сам визначить — це задача, нотатка, звичка чи ідея.' },
        { icon: 'clock', title: 'З часом', desc: '«Зателефонувати завтра о 9» — час автоматично потрапить у заголовок задачі.' },
        { icon: 'list',  title: 'Список одним рядком', desc: '«Ремонт: купити фарбу, найняти майстра» — Агент розбʼє на окремі кроки.' },
      ]},
      { title: 'Жести', items: [
        { icon: 'swipe', title: 'Свайп вліво — видалити', desc: 'Довгий свайп (200px) видаляє запис. Можна відновити через «Відновити».' },
        { icon: 'help',  title: 'Агент уточнить', desc: 'Якщо незрозуміло — зʼявляться варіанти відповіді. Просто вибери.' },
      ]},
      { title: 'Агент', items: [
        { icon: 'chat', title: 'Запитай про свої записи', desc: '«Які задачі відкриті», «що я записував вчора» — Агент знає весь контекст.' },
        { icon: 'idea', title: 'Розвинь ідею', desc: 'Попроси Агента знайти підводні камені або розгорнути думку.' },
      ]},
    ]
  },
  tasks: {
    title: 'Продуктивність',
    subtitle: 'Задачі з кроками і щоденні звички.',
    color: 'linear-gradient(135deg, #fdb87a, #f97316)',
    accent: '#ea580c',
    sections: [
      { title: 'Задачі', items: [
        { icon: 'check',  title: 'Відмічай кроки', desc: 'Тап на чекбокс — відмічає крок. Всі кроки виконані → задача закривається.' },
        { icon: 'list',   title: 'Кроки через Агента', desc: '«Додай кроки до задачі Ремонт: купити фарбу, найняти майстра».' },
        { icon: 'edit',   title: 'Редагувати', desc: 'Тап на назву задачі відкриває редагування.' },
      ]},
      { title: 'Звички', items: [
        { icon: 'habit',    title: 'Щоденний трекер', desc: 'Нова звичка з Inbox одразу зʼявляється тут. Відмічай кожен день — будується стрік.' },
        { icon: 'calendar', title: 'Вибір днів', desc: 'При створенні вкажи конкретні дні тижня — Агент враховує розклад.' },
        { icon: 'swipe',    title: 'Свайп вліво — видалити', desc: 'Довгий свайп видаляє звичку.' },
      ]},
      { title: 'Агент', items: [
        { icon: 'chat', title: 'Керуй голосом', desc: null,
          cmds: ['виконав задачу: назва', 'додай крок: назва', 'відміни крок', 'відмітити звичку'] },
      ]},
    ]
  },
  notes: {
    title: 'Нотатки',
    subtitle: 'Записи автоматично сортуються по папках.',
    color: 'linear-gradient(135deg, #fed7aa, #f97316)',
    accent: '#c2620a',
    sections: [
      { title: 'Навігація', items: [
        { icon: 'folder', title: 'Папки', desc: 'Агент сам визначає папку при збереженні. Тапни на папку щоб побачити записи всередині.' },
        { icon: 'search', title: 'Пошук', desc: 'Шукає по тексту всіх нотаток одразу, незалежно від папки.' },
      ]},
      { title: 'Робота з нотаткою', items: [
        { icon: 'chat',  title: 'Обговори з Агентом', desc: 'Відкрий нотатку — знизу зʼявиться чат. Агент допоможе розвинути думку.' },
        { icon: 'swipe', title: 'Свайп вліво — видалити', desc: 'Довгий свайп видаляє нотатку. Можна відновити.' },
        { icon: 'menu',  title: 'Меню ···', desc: 'Три крапки на нотатці — перемістити в іншу папку, скопіювати.' },
      ]},
    ]
  },
  me: {
    title: 'Я',
    subtitle: 'Твоя активність і чесний аналіз від Агента.',
    color: 'linear-gradient(135deg, #a7f3d0, #22c55e)',
    accent: '#16a34a',
    sections: [
      { title: 'Що тут є', items: [
        { icon: 'grid',  title: 'Активність тижня', desc: 'Кожна клітинка — один день. Чим темніше — більше записів.' },
        { icon: 'stats', title: 'Статистика', desc: 'Кількість записів, активних задач і нотаток одним поглядом.' },
        { icon: 'habit', title: 'Прогрес звичок', desc: 'Відсоток за 30 днів і кількість днів поспіль по кожній звичці.' },
      ]},
      { title: 'Агент-коуч', items: [
        { icon: 'refresh', title: 'Аналіз', desc: 'Натисни ↻ — Агент скаже де ти провисаєш і що вдається добре.' },
        { icon: 'star',    title: '3 поради', desc: 'Конкретні практичні поради на основі твоїх реальних даних.' },
        { icon: 'chat',    title: 'Запитай сам', desc: 'Чат внизу — питай про свою продуктивність, звички, прогрес.' },
      ]},
    ]
  },
  evening: {
    title: 'Вечір',
    subtitle: 'Рефлексія дня і підсумок від Агента.',
    color: 'linear-gradient(135deg, #818cf8, #4f46e5)',
    accent: '#4f46e5',
    sections: [
      { title: 'Моменти дня', items: [
        { icon: 'plus', title: 'Додай момент', desc: 'Що трапилось, що відчував, що думав — кнопка «+ Додати» або через Агента.' },
        { icon: 'mood', title: 'Настрій', desc: 'Позначай кожен момент — позитивний, нейтральний чи негативний.' },
        { icon: 'ring', title: 'Кільце продуктивності', desc: 'Відсоток позитивних моментів за день. Чесна картина твого дня.' },
      ]},
      { title: 'Агент-підсумок', items: [
        { icon: 'refresh', title: 'Підсумок дня', desc: 'Натисни ↻ — Агент бачить всі записи і моменти, дає пораду на завтра.' },
        { icon: 'chat',    title: 'Поговори', desc: 'Чат внизу — обговори день, поділись думками, отримай підтримку.' },
      ]},
      { title: 'Агент', items: [
        { icon: 'chat', title: 'Питання', desc: null,
          cmds: ['що я зробив сьогодні', 'як пройшов тиждень', 'що покращити завтра'] },
      ]},
    ]
  },
  finance: {
    title: 'Фінанси',
    subtitle: 'Облік витрат і доходів без таблиць.',
    color: 'linear-gradient(135deg, #fcd9bd, #f97316)',
    accent: '#c2410c',
    sections: [
      { title: 'Як додавати', items: [
        { icon: 'chat',   title: 'Через Inbox або чат', desc: '«Витратив 50 на їжу» або «отримав зарплату 3000» — Агент сам збереже.' },
        { icon: 'plus',   title: 'Вручну', desc: 'Кнопка «+ Додати» — вибери тип, суму і категорію.' },
      ]},
      { title: 'Бюджет', items: [
        { icon: 'limit',  title: 'Загальний ліміт', desc: 'Натисни ✎ в блоці «Бюджет по категоріях» щоб задати місячний ліміт.' },
        { icon: 'cat',    title: 'Ліміти по категоріях', desc: 'Агент попередить коли витрати наближаються до ліміту.' },
      ]},
      { title: 'Агент', items: [
        { icon: 'wallet', title: 'Запити', desc: null,
          cmds: ['скільки витратив цього тижня', 'де найбільше трачу', 'встанови бюджет 2000 на місяць', 'видали останню витрату'] },
      ]},
    ]
  },
};

const FIRST_VISIT_TIPS = {
  inbox:   { icon: '💡', title: 'Підказка', text: 'Пиши будь-що — задачу, ідею, звичку. Агент сам розбере. Спробуй: "купити хліб о 18:00"' },
  tasks:   { icon: '⚡', title: 'Підказка', text: 'Пиши список одним записом: "Ремонт: купити фарбу, знайти майстра" — Агент розібʼє на кроки' },
  notes:   { icon: '📁', title: 'Підказка', text: 'Нотатки автоматично сортуються по папках. Тапни на папку щоб побачити записи всередині' },
  me:      { icon: '📊', title: 'Підказка', text: 'Натисни ↻ в блоці "Аналіз агента" — отримаєш чесний огляд своєї продуктивності' },
  evening: { icon: '🌙', title: 'Підказка', text: 'Натисни ↻ в "Агент на вечір" — Агент підсумує твій день на основі всіх записів' },
  finance: { icon: '◈',  title: 'Підказка', text: 'Пиши витрати прямо в Inbox: "витратив 50 на їжу" — Агент сам збереже у Фінанси' },
};

let _helpOpen = false;

const HELP_ICONS = {
  edit:    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
  clock:   '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
  list:    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>',
  swipe:   '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>',
  help:    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  chat:    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
  idea:    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><circle cx="12" cy="12" r="4"/></svg>',
  check:   '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
  habit:   '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/><path d="M12 8v4l3 3"/></svg>',
  calendar:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
  folder:  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>',
  search:  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
  menu:    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>',
  grid:    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>',
  stats:   '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>',
  refresh: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>',
  star:    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
  plus:    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
  mood:    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>',
  ring:    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>',
  wallet:  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4z"/></svg>',
  limit:   '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
  cat:     '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>',
};

function openHelp(tab) {
  const data = HELP_CONTENT[tab];
  if (!data) return;

  const panel = document.getElementById('help-drawer-panel');

  // Кольоровий хедер
  const headerEl = document.getElementById('help-drawer-header');
  if (headerEl) {
    headerEl.style.background = data.color;
  }

  document.getElementById('help-drawer-title').textContent = data.title;
  document.getElementById('help-drawer-subtitle').textContent = data.subtitle;

  const contentEl = document.getElementById('help-drawer-content');
  contentEl.innerHTML = data.sections.map(section => `
    <div class="help-section-title">${section.title}</div>
    ${section.items.map(item => `
      <div class="help-item">
        <div class="help-item-icon" style="color:${data.accent}">${HELP_ICONS[item.icon] || ''}</div>
        <div style="flex:1;min-width:0">
          <div class="help-item-title">${item.title}</div>
          ${item.desc ? `<div class="help-item-desc">${item.desc}</div>` : ''}
          ${item.cmds ? `<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:6px">${item.cmds.map(c => `<span class="help-cmd">${c}</span>`).join('')}</div>` : ''}
        </div>
      </div>
    `).join('')}
  `).join('');

  const drawer = document.getElementById('help-drawer');
  drawer.style.display = 'flex';
  requestAnimationFrame(() => {
    document.getElementById('help-drawer-panel').style.transform = 'translateX(0)';
  });
  _helpOpen = true;
}

function closeHelp() {
  const panel = document.getElementById('help-drawer-panel');
  if (panel) {
    panel.style.transition = 'transform 0.24s cubic-bezier(0.32,0.72,0,1)';
    panel.style.transform = 'translateX(100%)';
  }
  setTimeout(() => {
    const drawer = document.getElementById('help-drawer');
    if (drawer) drawer.style.display = 'none';
    if (panel) panel.style.transition = '';
  }, 240);
  _helpOpen = false;
}

// Підказка першого відвідування
function showFirstVisitTip(tab) {
  const key = 'nm_visited_' + tab;
  if (localStorage.getItem(key)) return;
  localStorage.setItem(key, '1');
  const tip = FIRST_VISIT_TIPS[tab];
  if (!tip) return;

  // Видаляємо попередню підказку якщо є
  const prev = document.getElementById('fv-tip');
  if (prev) prev.remove();

  const tipEl = document.createElement('div');
  tipEl.id = 'fv-tip';
  tipEl.className = 'fv-tip';
  // Позиціонуємо над таббаром
  const tbH = document.getElementById('tab-bar')?.offsetHeight || 83;
  tipEl.style.bottom = (tbH + 12) + 'px';
  tipEl.innerHTML = `
    <div class="fv-tip-icon">${tip.icon}</div>
    <div class="fv-tip-body">
      <div class="fv-tip-title">${tip.title}</div>
      <div class="fv-tip-text">${tip.text}</div>
    </div>
    <div class="fv-tip-close" onclick="this.closest('#fv-tip').remove()">✕</div>
  `;
  document.body.appendChild(tipEl);

  // Автозакриття через 6 секунд
  setTimeout(() => { if (document.getElementById('fv-tip') === tipEl) tipEl.remove(); }, 6000);
}


// === SURVEY (після першого онбордингу) ===
const SURVEY_QUESTIONS = [
  'Чим займаєшся? (наприклад: підприємець, студент, програміст, фрілансер…)',
  'Які твої головні цілі зараз? (коротко, 1-2 речення)',
  'Що хочеш тримати під контролем — задачі, звички, ідеї, або все разом?',
];
let surveyAnswers = [];
let surveyStep = 0;
let surveyWaiting = false;

function startSurvey() {
  surveyAnswers = [];
  surveyStep = 0;
  surveyWaiting = false;
  // Переходимо на Inbox
  if (currentTab !== 'inbox') switchTab('inbox');
  // Невелика затримка щоб Inbox відрендерився
  setTimeout(() => {
    addInboxChatMsg('agent', 'Привіт! 👋 Щоб я міг бути кориснішим — розкажи трохи про себе. Це займе хвилину, а я зможу давати конкретніші поради саме для тебе.');
    setTimeout(() => askSurveyQuestion(), 800);
  }, 400);
}

function askSurveyQuestion() {
  if (surveyStep >= SURVEY_QUESTIONS.length) {
    finishSurvey();
    return;
  }
  surveyWaiting = true;
  addInboxChatMsg('agent', SURVEY_QUESTIONS[surveyStep]);
}

// Перехоплюємо відповіді під час опитування
function handleSurveyAnswer(text) {
  if (!surveyWaiting) return false;
  surveyWaiting = false;
  surveyAnswers.push({ q: SURVEY_QUESTIONS[surveyStep], a: text });
  surveyStep++;
  if (surveyStep < SURVEY_QUESTIONS.length) {
    setTimeout(() => askSurveyQuestion(), 400);
  } else {
    setTimeout(() => finishSurvey(), 400);
  }
  return true; // означає що повідомлення перехоплено
}

async function finishSurvey() {
  addInboxChatMsg('agent', 'Дякую! Зараз підготую персональні поради…');
  const key = localStorage.getItem('nm_gemini_key');
  if (!key) {
    addInboxChatMsg('agent', 'Введи API ключ в налаштуваннях — і я збережу все про тебе в памʼять.');
    localStorage.setItem('nm_survey_done', '1');
    return;
  }
  const settings = JSON.parse(localStorage.getItem('nm_settings') || '{}');
  const name = settings.name || 'користувач';
  const answersText = surveyAnswers.map((a, i) => `Питання ${i+1}: ${a.q}\nВідповідь: ${a.a}`).join('\n\n');
  const prompt = `Ти — OWL, агент NeverMind. Користувач ${name} тільки що завершив онбординг і відповів на питання анкети:\n\n${answersText}\n\nЗроби дві речі:\n1. Збережи ключові факти про користувача у форматі короткого резюме (3-5 речень) — це піде в памʼять агента.\n2. Дай 2-3 конкретні поради як використовувати NeverMind саме для цієї людини. Поради мають бути практичними і специфічними.\n\nФормат відповіді — ТІЛЬКИ валідний JSON:\n{"memory": "текст для памʼяті", "advice": "персональні поради 2-3 речення"}`;

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: prompt }], max_tokens: 400, temperature: 0.7 })
    });
    const data = await res.json();
    const reply = data.choices?.[0]?.message?.content?.trim();
    if (reply) {
      try {
        const parsed = JSON.parse(reply.replace(/```json|```/g, '').trim());
        if (parsed.memory) {
          localStorage.setItem('nm_memory', parsed.memory);
          localStorage.setItem('nm_memory_ts', Date.now().toString());
        }
        if (parsed.advice) {
          addInboxChatMsg('agent', parsed.advice);
        }
      } catch(e) {
        addInboxChatMsg('agent', reply);
      }
    }
  } catch(e) {
    addInboxChatMsg('agent', 'Не вдалось зберегти — але твої відповіді я запамʼятав. Спробуй оновити сторінку.');
  }
  localStorage.setItem('nm_survey_done', '1');
}


function checkOnboarding() {
  const done = localStorage.getItem('nm_onboarding_done');
  if (!done) {
    // Новий користувач — показуємо онбординг
    document.getElementById('onboarding').style.display = 'block';
    return true;
  }
  // Існуючий користувач — перевіряємо чи бачив оновлення
  const seenUpdate = localStorage.getItem('nm_seen_update');
  if (seenUpdate !== UPDATE_VERSION) {
    setTimeout(() => openUpdateSlides(), 500);
    return false;
  }
  return false;
}

function obNext(step) {
  if (step === 1) {
    const name = document.getElementById('ob-name').value.trim();
    const age = document.getElementById('ob-age').value.trim();
    if (!name) { showToast('Введи імʼя'); return; }
    const settings = JSON.parse(localStorage.getItem('nm_settings') || '{}');
    settings.name = name;
    if (age) settings.age = age;
    localStorage.setItem('nm_settings', JSON.stringify(settings));
    document.getElementById('ob-step-1').style.display = 'none';
    document.getElementById('ob-step-2').style.display = 'block';
  } else if (step === 2) {
    const key = document.getElementById('ob-key').value.trim();
    if (key) localStorage.setItem('nm_gemini_key', key);
    document.getElementById('ob-step-2').style.display = 'none';
    document.getElementById('ob-step-owl').style.display = 'block';
    // Дефолтно вибрати "partner"
    selectOwlMode('partner');
  } else if (step === 'owl') {
    const settings = JSON.parse(localStorage.getItem('nm_settings') || '{}');
    if (!settings.owl_mode) settings.owl_mode = 'partner';
    localStorage.setItem('nm_settings', JSON.stringify(settings));
    document.getElementById('ob-step-owl').style.display = 'none';
    document.getElementById('ob-step-consent').style.display = 'block';
  }
}

function obSkipKey() {
  document.getElementById('ob-step-2').style.display = 'none';
  document.getElementById('ob-step-owl').style.display = 'block';
  selectOwlMode('partner');
}

function selectOwlMode(mode) {
  const settings = JSON.parse(localStorage.getItem('nm_settings') || '{}');
  settings.owl_mode = mode;
  localStorage.setItem('nm_settings', JSON.stringify(settings));
  ['coach','partner','mentor'].forEach(m => {
    const card = document.getElementById('owl-card-' + m);
    if (!card) return;
    card.style.border = m === mode ? '2px solid #7c3aed' : '2px solid rgba(124,58,237,0.15)';
    card.style.background = m === mode ? 'rgba(124,58,237,0.08)' : 'rgba(255,255,255,0.8)';
  });
}

function obShowWelcome() {
  const settings = JSON.parse(localStorage.getItem('nm_settings') || '{}');
  document.getElementById('ob-welcome-text').textContent = `Привіт, ${settings.name || 'друже'}! 👋`;
  document.getElementById('ob-step-2').style.display = 'none';
  document.getElementById('ob-step-3').style.display = 'block';
}

function obFinish() {
  localStorage.setItem('nm_onboarding_done', '1');
  const ob = document.getElementById('onboarding');
  ob.style.opacity = '0';
  ob.style.transition = 'opacity 0.4s ease';
  setTimeout(() => {
    ob.style.display = 'none';
    // Показуємо тур після онбордингу
    openSlidesTour(true);
  }, 400);
  updateKeyStatus(!!localStorage.getItem('nm_gemini_key'));
}

// === HABITS ===
let editingHabitId = null;

function getHabits() { return JSON.parse(localStorage.getItem('nm_habits2') || '[]'); }
function saveHabits(arr) { localStorage.setItem('nm_habits2', JSON.stringify(arr)); }
function getHabitLog() { return JSON.parse(localStorage.getItem('nm_habit_log2') || '{}'); }
function saveHabitLog(obj) { localStorage.setItem('nm_habit_log2', JSON.stringify(obj)); }

function openEditHabit(id) {
  const habits = getHabits();
  const h = habits.find(x => x.id === id);
  if (!h) return;
  editingHabitId = id;
  document.getElementById('habit-modal-title').textContent = 'Редагувати звичку';
  document.getElementById('habit-input-name').value = h.name;
  // Деталі: якщо немає поля details — спробуй витягти з назви
  let details = h.details || '';
  if (!details && h.name) {
    const parts = h.name.split(/[,]\s*/);
    if (parts.length > 1) {
      details = parts.slice(1).join(', ').trim();
    }
  }
  document.getElementById('habit-input-details').value = details;
  document.getElementById('habit-input-emoji').value = h.emoji || '';
  // Дні: якщо всі 7 активні але назва містить конкретні дні — запропонувати правильні
  let days = h.days || [0,1,2,3,4];
  const nameAndDetails = (h.name + ' ' + details).toLowerCase();
  const hasSpecificDays = /понеділ|вівтор|серед|четвер|п.ятниц|субот|неділ/.test(nameAndDetails);
  if (hasSpecificDays && days.length === 7) {
    days = [];
    if (/понеділ|пн/.test(nameAndDetails)) days.push(0);
    if (/вівтор|вт/.test(nameAndDetails)) days.push(1);
    if (/серед|ср/.test(nameAndDetails)) days.push(2);
    if (/четвер|чт/.test(nameAndDetails)) days.push(3);
    if (/п.ятниц|пт/.test(nameAndDetails)) days.push(4);
    if (/субот|сб/.test(nameAndDetails)) days.push(5);
    if (/неділ|нд/.test(nameAndDetails)) days.push(6);
    if (days.length === 0) days = [0,1,2,3,4];
  }
  document.querySelectorAll('.habit-day-btn').forEach(b => {
    b.classList.toggle('active', days.includes(parseInt(b.dataset.day)));
  });
  document.getElementById('habit-modal').style.display = 'flex';
  document.getElementById('habit-delete-btn').style.display = 'inline-block';
  setupModalSwipeClose(document.querySelector('#habit-modal > div:last-child'), closeHabitModal);
}

function openAddHabit() {
  editingHabitId = null;
  document.getElementById('habit-modal-title').textContent = 'Нова звичка';
  document.getElementById('habit-input-name').value = '';
  document.getElementById('habit-input-details').value = '';
  document.getElementById('habit-input-emoji').value = '';
  document.getElementById('habit-delete-btn').style.display = 'none';
  document.querySelectorAll('.habit-day-btn').forEach(b => {
    b.classList.toggle('active', [0,1,2,3,4].includes(parseInt(b.dataset.day)));
  });
  document.getElementById('habit-modal').style.display = 'flex';
  setupModalSwipeClose(document.querySelector('#habit-modal > div:last-child'), closeHabitModal);
}

function closeHabitModal() {
  document.getElementById('habit-modal').style.display = 'none';
}

// Toggle day button
document.addEventListener('click', e => {
  if (e.target.classList.contains('habit-day-btn')) {
    e.target.classList.toggle('active');
  }
});

function saveHabit() {
  const name = document.getElementById('habit-input-name').value.trim();
  if (!name) { showToast('Введи назву звички'); return; }
  const details = document.getElementById('habit-input-details').value.trim();
  const emoji = document.getElementById('habit-input-emoji').value.trim() || '⭕';
  const days = [...document.querySelectorAll('.habit-day-btn.active')].map(b => parseInt(b.dataset.day));
  const habits = getHabits();

  if (editingHabitId) {
    const idx = habits.findIndex(x => x.id === editingHabitId);
    if (idx !== -1) habits[idx] = { ...habits[idx], name, details, emoji, days };
  } else {
    habits.push({ id: Date.now(), name, details, emoji, days, createdAt: Date.now() });
  }
  saveHabits(habits);
  closeHabitModal();
  renderHabits();
  renderProdHabits(); // оновлюємо список у вкладці Продуктивність
  showToast(editingHabitId ? '✓ Звичку оновлено' : '✓ Звичку додано');
}

function deleteHabit(id) {
  if (!confirm('Видалити звичку?')) return;
  saveHabits(getHabits().filter(h => h.id !== id));
  renderHabits();
  renderProdHabits();
}

function deleteHabitFromModal() {
  if (!editingHabitId) return;
  const id = editingHabitId;
  const item = getHabits().find(h => h.id === id);
  saveHabits(getHabits().filter(h => h.id !== id));
  renderHabits(); renderProdHabits();
  closeHabitModal();
  if (item) showUndoToast('Звичку видалено', () => { const habits = getHabits(); habits.push(item); saveHabits(habits); renderHabits(); renderProdHabits(); });
}

function toggleHabitToday(id) {
  const today = new Date().toDateString();
  const log = getHabitLog();
  if (!log[today]) log[today] = {};
  log[today][id] = !log[today][id];
  saveHabitLog(log);
  renderHabits();
  renderMeHabitsStats(); // оновлюємо статистику одразу після зміни
}

function getHabitStreak(id) {
  const log = getHabitLog();
  const habits = getHabits();
  const h = habits.find(x => x.id === id);
  if (!h) return 0;
  let streak = 0;
  const d = new Date();
  for (let i = 0; i < 60; i++) {
    const ds = d.toDateString();
    const dow = (d.getDay() + 6) % 7;
    if ((h.days || [0,1,2,3,4]).includes(dow)) {
      if (log[ds]?.[id]) streak++;
      else if (i > 0) break;
    }
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

function getHabitPct(id, days30) {
  const log = getHabitLog();
  const habits = getHabits();
  const h = habits.find(x => x.id === id);
  if (!h) return 0;
  let done = 0;
  const plannedDays = h.days || [0,1,2,3,4];
  // Рахуємо скільки запланованих днів було за 30 днів
  const d = new Date();
  let total = 0;
  for (let i = 0; i < 30; i++) {
    const ds = d.toDateString();
    const dow = (d.getDay() + 6) % 7;
    if (plannedDays.includes(dow)) {
      total++;
      if (log[ds]?.[id]) done++; // виконано в запланований день
    } else if (log[ds]?.[id]) {
      done++; // виконано навіть не в запланований день — теж рахуємо
    }
    d.setDate(d.getDate() - 1);
  }
  return total > 0 ? Math.round(done / total * 100) : 0;
}


// Повертає масив індексів днів цього тижня (0=Пн..6=Нд) коли звичка була виконана
function getHabitWeekDays(id) {
  const log = getHabitLog();
  const done = [];
  const today = new Date();
  const todayDow = (today.getDay() + 6) % 7;
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - todayDow);
  weekStart.setHours(0,0,0,0);
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    const ds = d.toDateString();
    if (log[ds]?.[id]) done.push(i);
  }
  return done;
}

function makeHabitDayDots(h, weekDone, todayDow) {
  const labels = ['Пн','Вт','Ср','Чт','Пт','Сб','Нд'];
  return labels.map(function(label, i) {
    const isPlanned = (h.days || [0,1,2,3,4]).includes(i);
    const isDone = weekDone.includes(i);
    const isToday = i === todayDow;
    let bg, border, color;
    if (isDone) { bg = '#16a34a'; border = '#16a34a'; color = 'white'; }
    else if (isPlanned) { bg = 'transparent'; border = 'rgba(30,16,64,0.2)'; color = 'rgba(30,16,64,0.4)'; }
    else { bg = 'transparent'; border = 'rgba(30,16,64,0.08)'; color = 'rgba(30,16,64,0.15)'; }
    const shadow = isToday ? 'box-shadow:0 0 0 2px rgba(22,163,74,0.3);' : '';
    const text = isDone ? '✓' : label.charAt(0);
    return '<div style="width:24px;height:24px;border-radius:50%;background:' + bg + ';border:1.5px solid ' + border + ';display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;color:' + color + ';' + shadow + '">' + text + '</div>';
  }).join('');
}

function renderHabits() {
  const habits = getHabits();
  const el = document.getElementById('me-habits-stats-list');
  const block = document.getElementById('me-habits-stats');
  if (!el) return;
  const log = getHabitLog();
  const today = new Date().toDateString();
  const todayDow = (new Date().getDay() + 6) % 7;

  if (habits.length === 0) {
    el.innerHTML = '<div style="text-align:center;padding:20px 0;color:rgba(30,16,64,0.3);font-size:15px">Додай першу звичку</div>';
    return;
  }

  el.innerHTML = habits.map(function(h) {
    const isDoneToday = !!log[today]?.[h.id];
    const isScheduledToday = (h.days || [0,1,2,3,4]).includes(todayDow);
    const streak = getHabitStreak(h.id);
    const pct = getHabitPct(h.id);
    const weekDone = getHabitWeekDays(h.id);
    const shortName = h.name.split(' ').slice(0,4).join(' ');
    const dayDots = makeHabitDayDots(h, weekDone, todayDow);
    const checkSvg = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
    const checkBtn = isDoneToday
      ? checkSvg.replace('stroke-width', 'stroke="white" stroke-width')
      : checkSvg.replace('stroke-width', 'stroke="rgba(30,16,64,0.25)" stroke-width');
    const btnBorder = isDoneToday ? '#16a34a' : 'rgba(30,16,64,0.15)';
    const btnBg = isDoneToday ? '#16a34a' : 'rgba(30,16,64,0.03)';
    const pctColor = pct > 0 ? '#16a34a' : 'rgba(30,16,64,0.3)';
    const streakHtml = streak >= 2 ? '<span style="font-size:12px;font-weight:700;color:#f59e0b">🔥' + streak + '</span>' : '';

    return '<div style="position:relative;border-radius:14px;margin-bottom:6px">'
      + '<div id="habit-me-del-' + h.id + '" style="position:absolute;right:0;top:0;bottom:0;width:72px;background:linear-gradient(135deg,#ef4444,#dc2626);display:flex;align-items:center;justify-content:center;pointer-events:none;border-radius:14px;opacity:0;transition:opacity 0.15s"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg></div>'
      + '<div id="habit-me-item-' + h.id + '" class="inbox-item" style="padding:10px 12px;cursor:pointer;width:100%;box-sizing:border-box;-webkit-tap-highlight-color:transparent" onclick="openEditHabit(' + h.id + ')"'
        + ' ontouchstart="habitMeSwipeStart(event,' + h.id + ')"'
        + ' ontouchmove="habitMeSwipeMove(event,' + h.id + ')"'
        + ' ontouchend="habitMeSwipeEnd(event,' + h.id + ')">'
        + '<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">'
          + '<div onclick="event.stopPropagation();toggleHabitToday(' + h.id + ')" data-habit-check="1" style="width:36px;height:36px;border-radius:50%;border:2px solid ' + btnBorder + ';background:' + btnBg + ';display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;transition:all 0.2s;-webkit-tap-highlight-color:transparent">'
            + checkBtn
          + '</div>'
          + '<div style="flex:1;min-width:0">'
            + '<div style="display:flex;align-items:center;gap:6px">'
              + '<span style="font-size:15px;font-weight:700;color:#1e1040">' + escapeHtml(shortName) + '</span>'
              + streakHtml
            + '</div>'
            + '<div style="font-size:11px;font-weight:600;color:' + pctColor + ';margin-top:1px">' + pct + '% за 30 днів</div>'
          + '</div>'

        + '</div>'
        + '<div style="display:flex;gap:4px;padding-left:46px">' + dayDots + '</div>'
      + '</div>'
    + '</div>';
  }).join('');
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

// === TASK CHAT ===
let taskChatId = null;
let taskChatHistory = [];
let taskChatLoading = false;

function openTaskChat(id) {
  const tasks = getTasks();
  const t = tasks.find(x => x.id === id);
  if (!t) return;
  taskChatId = id;

  document.getElementById('task-chat-title').textContent = t.title;
  document.getElementById('task-chat-messages').innerHTML = '';
  document.getElementById('task-chat-input').value = '';
  document.getElementById('task-chat-modal').style.display = 'flex';

  // Restore saved chat history
  const savedChat = JSON.parse(localStorage.getItem('nm_task_chat_' + id) || 'null');
  if (savedChat && savedChat.messages && savedChat.messages.length > 0) {
    taskChatHistory = savedChat.history || [];
    savedChat.messages.forEach(m => addTaskChatMsg(m.role, m.text));
    return;
  }

  taskChatHistory = [];
  const steps = (t.steps || []).map(s => `- ${s.text}${s.done ? ' ✓' : ''}`).join('\n');
  const key = localStorage.getItem('nm_gemini_key');
  if (!key) {
    addTaskChatMsg('agent', 'Введи OpenAI ключ в налаштуваннях щоб спілкуватись з Агентом.');
    return;
  }

  addTaskChatMsg('agent', '…', 'task-chat-intro');
  const aiContext = getAIContext();
  const systemPrompt = `${getOWLPersonality()} Допомагаєш реально виконати задачу. НЕ хвали задачу і не кажи що вона "чудова" чи "чітка" — це лестощі. Перше повідомлення: оціни задачу чесно (1 речення) — чи вона конкретна, чи є дедлайн, чи є підводні камені. Потім запитай один конкретний уточнюючий факт або що вже зроблено. Максимум 3 речення. Відповідай українською.${aiContext ? '\n\n' + aiContext : ''}`;
  const taskInfo = `Задача: ${t.title}${t.desc ? '\nОпис: ' + t.desc : ''}${steps ? '\nКроки:\n' + steps : ''}`;

  callAI(systemPrompt, taskInfo, {}).then(reply => {
    const el = document.getElementById('task-chat-intro');
    if (el) el.textContent = reply || 'Розкажи більше про цю задачу.';
    taskChatHistory.push({ role: 'assistant', content: reply || '' });
    saveTaskChatHistory();
  });
}

function saveTaskChatHistory() {
  if (!taskChatId) return;
  const messages = Array.from(document.getElementById('task-chat-messages').children).map(div => {
    const bubble = div.querySelector('div');
    const isAgent = div.style.justifyContent !== 'flex-end';
    return { role: isAgent ? 'agent' : 'user', text: bubble ? bubble.textContent : '' };
  }).filter(m => m.text && m.text !== '…');
  localStorage.setItem('nm_task_chat_' + taskChatId, JSON.stringify({ messages, history: taskChatHistory }));
}

function closeTaskChat() {
  saveTaskChatHistory();
  document.getElementById('task-chat-modal').style.display = 'none';
  taskChatId = null;
  taskChatHistory = [];
}

function addTaskChatMsg(role, text, id = '') {
  const el = document.getElementById('task-chat-messages');
  const isAgent = role === 'agent';
  const div = document.createElement('div');
  div.style.cssText = `display:flex;${isAgent ? '' : 'justify-content:flex-end'}`;
  div.innerHTML = `<div ${id ? `id="${id}"` : ''} style="max-width:82%;background:${isAgent ? 'rgba(255,255,255,0.9)' : '#ea580c'};color:${isAgent ? '#1e1040' : 'white'};border-radius:${isAgent ? '4px 14px 14px 14px' : '14px 4px 14px 14px'};padding:12px 16px;font-size:18px;line-height:1.7;font-weight:${isAgent ? '400' : '500'}">${escapeHtml(text)}</div>`;
  el.appendChild(div);
  el.scrollTop = el.scrollHeight;
  if (role !== 'agent') taskChatHistory.push({ role: 'user', content: text });
}

async function sendTaskChatMessage() {
  if (taskChatLoading) return;
  const input = document.getElementById('task-chat-input');
  const text = input.value.trim();
  if (!text) return;
  const key = localStorage.getItem('nm_gemini_key');
  if (!key) { addTaskChatMsg('agent', 'Введи OpenAI ключ в налаштуваннях.'); return; }

  input.value = '';
  input.style.height = 'auto';
  addTaskChatMsg('user', text);
  taskChatLoading = true;

  const btn = document.getElementById('task-chat-send');
  btn.disabled = true;

  const tasks = getTasks();
  const t = tasks.find(x => x.id === taskChatId);
  const steps = t ? (t.steps || []).map(s => `- ${s.text}${s.done ? ' ✓' : ''}`).join('\n') : '';
  const aiContext = getAIContext();
  const wantsSteps = /додай кроки|створи кроки|розбий на кроки|які кроки|план дій|крок за кроком|додай пункти|пункти|кроки/i.test(text);
  const stepInstruction = wantsSteps ? ' ВАЖЛИВО: користувач просить кроки. Відповідай ТІЛЬКИ валідним JSON і нічим іншим: {"steps":["крок 1","крок 2","крок 3"]}. Жодного тексту до або після JSON.' : '';
  const systemPrompt = `${getOWLPersonality()} Обговорюєш задачу: "${t?.title || ''}". ${t?.desc ? 'Опис: ' + t.desc + '.' : ''} ${steps ? 'Кроки:\n' + steps : ''} Говориш конкретно. Короткі відповіді (2-4 речення). Фокус на наступних конкретних кроках.${stepInstruction} Відповідай українською.${aiContext ? '\n\n' + aiContext : ''}`;

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'system', content: systemPrompt }, ...taskChatHistory.slice(-12)],
        max_tokens: 300,
        temperature: 0.75
      })
    });
    const data = await res.json();
    const reply = data.choices?.[0]?.message?.content;
    if (reply) {
      // Check if reply is JSON with steps
      try {
        const parsed = JSON.parse(reply.trim());
        if (parsed.steps && Array.isArray(parsed.steps) && parsed.steps.length > 0) {
          const allTasks = getTasks();
          const taskIdx = allTasks.findIndex(x => x.id === taskChatId);
          if (taskIdx !== -1) {
            const newSteps = parsed.steps.map(s => ({ id: Date.now() + Math.random(), text: s, done: false }));
            allTasks[taskIdx].steps = [...(allTasks[taskIdx].steps || []), ...newSteps];
            saveTasks(allTasks);
            renderTasks(); // оновлюємо картку одразу
            addTaskChatMsg('agent', `✅ Додав ${parsed.steps.length} кроків до задачі. Перевір картку.`);
          }
        } else {
          addTaskChatMsg('agent', reply);
        }
      } catch {
        addTaskChatMsg('agent', reply);
      }
    }
    else addTaskChatMsg('agent', 'Щось пішло не так. Спробуй ще раз.');
  } catch {
    addTaskChatMsg('agent', 'Мережева помилка.');
  }
  taskChatLoading = false;
  btn.disabled = false;
  saveTaskChatHistory();
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



// === PRODUCTIVITY INNER TABS ===
let currentProdTab = 'tasks';

function updateProdTabCounters() {
  // Лічильник задач
  const taskCount = getTasks().filter(t => t.status !== 'done').length;
  const taskCountEl = document.getElementById('prod-tab-tasks-count');
  const taskSubEl = document.getElementById('prod-tab-tasks-sub');
  if (taskCountEl) taskCountEl.textContent = taskCount;
  if (taskSubEl) taskSubEl.textContent = taskCount === 1 ? 'активна' : 'активних';

  // Лічильник звичок
  const habits = getHabits();
  const log = getHabitLog();
  const today = new Date().toDateString();
  const todayDow = (new Date().getDay() + 6) % 7;
  const todayHabits = habits.filter(h => (h.days || [0,1,2,3,4]).includes(todayDow));
  const doneToday = todayHabits.filter(h => !!log[today]?.[h.id]).length;
  const habitCountEl = document.getElementById('prod-tab-habits-count');
  const habitSubEl = document.getElementById('prod-tab-habits-sub');
  if (habitCountEl) habitCountEl.textContent = habits.length;
  if (habitSubEl) habitSubEl.textContent = todayHabits.length > 0 ? `${doneToday} з ${todayHabits.length} сьогодні` : 'звичок';
}

function switchProdTab(tab) {
  currentProdTab = tab;
  const isHabits = tab === 'habits';

  // Стилі карток перемикача
  const tabTasks = document.getElementById('prod-tab-tasks');
  const tabHabits = document.getElementById('prod-tab-habits');
  const tasksCount = document.getElementById('prod-tab-tasks-count');
  const tasksTitle = tabTasks ? tabTasks.querySelector('div > div:first-child') : null;
  const habitsCount = document.getElementById('prod-tab-habits-count');
  const habitsTitle = tabHabits ? tabHabits.querySelector('div > div:first-child') : null;

  if (tabTasks) {
    tabTasks.style.background = !isHabits ? 'white' : 'rgba(255,255,255,0.4)';
    tabTasks.style.borderColor = !isHabits ? 'rgba(234,88,12,0.2)' : 'transparent';
    tabTasks.style.boxShadow = !isHabits ? '0 2px 10px rgba(234,88,12,0.1)' : 'none';
  }
  if (tasksCount) tasksCount.style.color = !isHabits ? '#ea580c' : 'rgba(30,16,64,0.3)';
  if (tasksTitle) tasksTitle.style.color = !isHabits ? '#ea580c' : 'rgba(30,16,64,0.3)';

  if (tabHabits) {
    tabHabits.style.background = isHabits ? 'white' : 'rgba(255,255,255,0.4)';
    tabHabits.style.borderColor = isHabits ? 'rgba(22,163,74,0.2)' : 'transparent';
    tabHabits.style.boxShadow = isHabits ? '0 2px 10px rgba(22,163,74,0.1)' : 'none';
  }
  if (habitsCount) habitsCount.style.color = isHabits ? '#16a34a' : 'rgba(30,16,64,0.3)';
  if (habitsTitle) habitsTitle.style.color = isHabits ? '#16a34a' : 'rgba(30,16,64,0.3)';

  document.getElementById('prod-page-tasks').style.display = isHabits ? 'none' : 'block';
  document.getElementById('prod-page-habits').style.display = isHabits ? 'block' : 'none';

  // Update + button action
  const addBtn = document.getElementById('prod-add-btn');
  if (addBtn) addBtn.onclick = isHabits ? openAddHabit : openAddTask;

  updateProdTabCounters();
  if (isHabits) renderProdHabits();
}

function renderProdHabits() {
  updateProdTabCounters();
  const habits = getHabits();
  const el = document.getElementById('prod-habits-list');
  if (!el) return;
  const log = getHabitLog();
  const today = new Date().toDateString();
  const todayDow = (new Date().getDay() + 6) % 7;

  // Update progress bar
  const todayHabits = habits.filter(h => (h.days || [0,1,2,3,4]).includes(todayDow));
  const doneTodayCount = todayHabits.filter(h => !!log[today]?.[h.id]).length;
  const countEl = document.getElementById('habits-today-count');
  const barEl = document.getElementById('habits-today-bar');
  if (countEl) countEl.textContent = `${doneTodayCount} / ${todayHabits.length}`;
  if (barEl) barEl.style.width = todayHabits.length > 0 ? `${Math.round(doneTodayCount/todayHabits.length*100)}%` : '0%';

  if (habits.length === 0) {
    el.innerHTML = '<div style="text-align:center;padding:40px 20px;color:rgba(30,16,64,0.3);font-size:15px">Ще немає звичок<br>Натисни + щоб додати</div>';
    return;
  }

  el.innerHTML = habits.map(h => {
    const isDoneToday = !!log[today]?.[h.id];
    const isScheduledToday = (h.days || [0,1,2,3,4]).includes(todayDow);
    const streak = getHabitStreak(h.id);
    const dayLabels = ['Пн','Вт','Ср','Чт','Пт','Сб','Нд'];

    const weekDone = getHabitWeekDays(h.id);
    const shortName2 = h.name.split(' ').slice(0,4).join(' ');
    const dayDots2 = makeHabitDayDots(h, weekDone, todayDow);
    const pct = getHabitPct(h.id);
    const pctColor2 = pct > 0 ? '#16a34a' : 'rgba(30,16,64,0.3)';
    const streakTxt = streak >= 2 ? '🔥 ' + streak + ' · ' : '';
    const checkSvgProd = isDoneToday
      ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>'
      : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(30,16,64,0.25)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
    const checkBgProd = isDoneToday ? 'background:#16a34a;border:none;' : 'background:rgba(30,16,64,0.03);border:1.5px solid rgba(30,16,64,0.15);';

    // ФІКС: галочка і редагування — окремі незалежні елементи, не вкладені один в одний
    return '<div style="position:relative;border-radius:16px;margin-bottom:10px">'
      + '<div id="prod-habit-del-' + h.id + '" style="position:absolute;right:0;top:0;bottom:0;width:72px;background:linear-gradient(135deg,#ef4444,#dc2626);display:flex;align-items:center;justify-content:center;pointer-events:none;border-radius:16px;opacity:0;transition:opacity 0.15s">'
        + '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>'
      + '</div>'
      + '<div id="prod-habit-item-' + h.id + '" style="background:rgba(255,255,255,0.6);border:1.5px solid rgba(255,255,255,0.85);border-radius:16px;padding:12px 14px;box-shadow:0 2px 10px rgba(100,70,200,0.06);position:relative;will-change:transform;cursor:pointer;-webkit-tap-highlight-color:transparent"'
        + ' ontouchstart="prodHabitSwipeStart(event,' + h.id + ')"'
        + ' ontouchmove="prodHabitSwipeMove(event,' + h.id + ')"'
        + ' ontouchend="prodHabitSwipeEnd(event,' + h.id + ')">'
      + '<div style="display:flex;align-items:center;gap:12px;margin-bottom:8px">'
        + '<div onclick="event.stopPropagation();toggleProdHabitToday(' + h.id + ')" data-habit-check="1" style="width:40px;height:40px;border-radius:12px;flex-shrink:0;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.2s;-webkit-tap-highlight-color:transparent;' + checkBgProd + '">'
          + checkSvgProd
        + '</div>'
        + '<div style="flex:1;min-width:0">'
          + '<div style="font-size:16px;font-weight:700;color:#1e1040;margin-bottom:1px">' + escapeHtml(shortName2) + '</div>'
          + '<div style="font-size:11px;font-weight:600;color:' + pctColor2 + '">' + streakTxt + pct + '% за 30 днів</div>'
        + '</div>'
      + '</div>'
      + '<div style="display:flex;gap:4px;padding-left:52px">' + dayDots2 + '</div>'
      + '</div>'
    + '</div>';
  }).join('');
}

function toggleProdHabitToday(id) {
  const today = new Date().toDateString();
  const log = getHabitLog();
  if (!log[today]) log[today] = {};
  log[today][id] = !log[today][id];
  saveHabitLog(log);
  renderProdHabits(); // оновлюємо тільки вкладку Продуктивність
}

// === TAB SWIPE NAVIGATION ===
// Свайп вправо закриває note-view-modal
(function() {
  let swipeStartX = 0, swipeStartY = 0, swipeStartTime = 0;

  document.addEventListener('touchstart', e => {
    swipeStartX = e.touches[0].clientX;
    swipeStartY = e.touches[0].clientY;
    swipeStartTime = Date.now();
  }, { passive: true });

  document.addEventListener('touchend', e => {
    const noteView = document.getElementById('note-view-modal');
    if (!noteView || noteView.style.display !== 'flex') return;
    const dx = e.changedTouches[0].clientX - swipeStartX;
    const dy = e.changedTouches[0].clientY - swipeStartY;
    const dt = Date.now() - swipeStartTime;
    if (dt > 400) return;
    if (Math.abs(dy) > Math.abs(dx) * 0.7) return;
    if (dx > 60) closeNoteView();
  }, { passive: true });
})();


// === HABIT ME SWIPE TO DELETE ===
const habitMeSwipeState = {};
const HABIT_SWIPE_THRESHOLD = 250;

function habitMeSwipeStart(e, id) {
  const t = e.touches[0];
  habitMeSwipeState[id] = { startX: t.clientX, startY: t.clientY, dx: 0, swiping: false };
}
function habitMeSwipeMove(e, id) {
  const s = habitMeSwipeState[id]; if (!s) return;
  const t = e.touches[0];
  const dx = t.clientX - s.startX, dy = t.clientY - s.startY;
  // Якщо рух більше вертикальний — скасовуємо свайп, даємо скролитись
  if (!s.swiping && Math.abs(dy) > Math.abs(dx)) {
    delete habitMeSwipeState[id];
    return;
  }
  if (!s.swiping && Math.abs(dx) > 8) s.swiping = true;
  if (!s.swiping) return;
  e.preventDefault();
  s.dx = Math.min(0, dx);
  const el = document.getElementById('habit-me-item-' + id);
  if (el) el.style.transform = 'translateX(' + s.dx + 'px)';
  const delBg = document.getElementById('habit-me-del-' + id);
  if (delBg) delBg.style.opacity = Math.min(1, -s.dx / 180).toFixed(2);
}
function habitMeSwipeEnd(e, id) {
  const s = habitMeSwipeState[id]; if (!s) return;
  const el = document.getElementById('habit-me-item-' + id);
  if (s.dx < -HABIT_SWIPE_THRESHOLD) {
    if (el) { el.style.transition = 'transform 0.2s ease, opacity 0.2s'; el.style.transform = 'translateX(-110%)'; el.style.opacity = '0'; }
    setTimeout(() => {
      const allHabits = getHabits();
      const habitOrigIdx = allHabits.findIndex(h => h.id === id);
      const item = allHabits.find(h => h.id === id);
      if (item) addToTrash('habit', item);
      saveHabits(allHabits.filter(h => h.id !== id)); renderHabits(); renderProdHabits();
      if (item) showUndoToast('Звичку видалено', () => { const habits = getHabits(); const idx = Math.min(habitOrigIdx, habits.length); habits.splice(idx, 0, item); saveHabits(habits); renderHabits(); renderProdHabits(); });
    }, 200);
  } else {
    if (el) { el.style.transition = 'transform 0.25s ease'; el.style.transform = 'translateX(0)'; setTimeout(() => { if(el) el.style.transition = ''; }, 300); }
    const delBgMe = document.getElementById('habit-me-del-' + id);
    if (delBgMe) { delBgMe.style.transition = 'opacity 0.25s'; delBgMe.style.opacity = '0'; setTimeout(() => { if(delBgMe) delBgMe.style.transition = ''; }, 300); }
    // Якщо це тап (не свайп) — чекбокс або редагування
    if (!s.swiping) {
      const target = e.changedTouches[0];
      const checkBtn = el ? el.querySelector('[data-habit-check]') : null;
      if (checkBtn) {
        const rect = checkBtn.getBoundingClientRect();
        if (target.clientX >= rect.left && target.clientX <= rect.right &&
            target.clientY >= rect.top && target.clientY <= rect.bottom) {
          toggleHabitToday(id);
        } else {
          openEditHabit(id);
        }
      }
    }
  }
  delete habitMeSwipeState[id];
}


// === PROD HABIT SWIPE TO DELETE ===
const prodHabitSwipeState = {};

function prodHabitSwipeStart(e, id) {
  const t = e.touches[0];
  prodHabitSwipeState[id] = { startX: t.clientX, startY: t.clientY, dx: 0, swiping: false };
}
function prodHabitSwipeMove(e, id) {
  const s = prodHabitSwipeState[id]; if (!s) return;
  const t = e.touches[0];
  const dx = t.clientX - s.startX, dy = t.clientY - s.startY;
  if (!s.swiping && Math.abs(dy) > Math.abs(dx)) { delete prodHabitSwipeState[id]; return; }
  if (!s.swiping && Math.abs(dx) > 8) s.swiping = true;
  if (!s.swiping) return;
  e.preventDefault();
  s.dx = Math.min(0, dx);
  const el = document.getElementById('prod-habit-item-' + id);
  if (el) el.style.transform = 'translateX(' + s.dx + 'px)';
  const delBg = document.getElementById('prod-habit-del-' + id);
  if (delBg) delBg.style.opacity = Math.min(1, -s.dx / 180).toFixed(2);
}
function prodHabitSwipeEnd(e, id) {
  const s = prodHabitSwipeState[id]; if (!s) return;
  const el = document.getElementById('prod-habit-item-' + id);
  if (s.dx < -HABIT_SWIPE_THRESHOLD) {
    if (el) { el.style.transition = 'transform 0.2s ease, opacity 0.2s'; el.style.transform = 'translateX(-110%)'; el.style.opacity = '0'; }
    setTimeout(() => {
      const allHabits = getHabits();
      const habitOrigIdx = allHabits.findIndex(h => h.id === id);
      const item = allHabits.find(h => h.id === id);
      if (item) addToTrash('habit', item);
      saveHabits(allHabits.filter(h => h.id !== id));
      renderHabits(); renderProdHabits();
      if (item) showUndoToast('Звичку видалено', () => { const habits = getHabits(); const idx = Math.min(habitOrigIdx, habits.length); habits.splice(idx, 0, item); saveHabits(habits); renderHabits(); renderProdHabits(); });
    }, 200);
  } else {
    if (el) { el.style.transition = 'transform 0.25s ease'; el.style.transform = 'translateX(0)'; setTimeout(() => { if(el) el.style.transition = ''; }, 300); }
    const delBg2 = document.getElementById('prod-habit-del-' + id);
    if (delBg2) { delBg2.style.transition = 'opacity 0.25s'; delBg2.style.opacity = '0'; setTimeout(() => { if(delBg2) delBg2.style.transition = ''; }, 300); }
    if (!s.swiping) {
      const target = e.changedTouches[0];
      const checkBtn = el ? el.querySelector('[data-habit-check]') : null;
      if (checkBtn) {
        const rect = checkBtn.getBoundingClientRect();
        if (target.clientX >= rect.left && target.clientX <= rect.right &&
            target.clientY >= rect.top && target.clientY <= rect.bottom) {
          toggleProdHabitToday(id);
        } else {
          openEditHabit(id);
        }
      }
    }
  }
  delete prodHabitSwipeState[id];
}

// === TASK SWIPE TO DELETE ===
const taskSwipeState = {};
const TASK_SWIPE_THRESHOLD = 250;

function taskSwipeStart(e, id) {
  const t = e.touches[0];
  taskSwipeState[id] = { startX: t.clientX, startY: t.clientY, dx: 0, swiping: false };
}
function taskSwipeMove(e, id) {
  const s = taskSwipeState[id]; if (!s) return;
  const t = e.touches[0];
  const dx = t.clientX - s.startX, dy = t.clientY - s.startY;
  if (!s.swiping && Math.abs(dy) > Math.abs(dx)) { delete taskSwipeState[id]; return; }
  if (!s.swiping && Math.abs(dx) > 8) s.swiping = true;
  if (!s.swiping) return;
  e.preventDefault();
  s.dx = Math.min(0, dx);
  const el = document.getElementById('task-item-' + id);
  if (el) el.style.transform = 'translateX(' + s.dx + 'px)';
  const delBg = document.getElementById('task-del-' + id);
  if (delBg) delBg.style.opacity = Math.min(1, -s.dx / 180).toFixed(2);
}
function taskSwipeEnd(e, id) {
  const s = taskSwipeState[id]; if (!s) return;
  const el = document.getElementById('task-item-' + id);
  if (s.dx < -TASK_SWIPE_THRESHOLD) {
    if (el) { el.style.transition = 'transform 0.2s ease, opacity 0.2s'; el.style.transform = 'translateX(-110%)'; el.style.opacity = '0'; }
    setTimeout(() => {
      const tasks = getTasks();
      const taskOrigIdx = tasks.findIndex(x => x.id === id);
      const item = tasks.find(x => x.id === id);
      saveTasks(tasks.filter(x => x.id !== id));
      renderTasks();
      if (item) showUndoToast('Задачу видалено', () => { const t = getTasks(); const idx = Math.min(taskOrigIdx, t.length); t.splice(idx, 0, item); saveTasks(t); renderTasks(); });
    }, 200);
  } else {
    if (el) { el.style.transition = 'transform 0.25s ease'; el.style.transform = 'translateX(0)'; setTimeout(() => { if(el) el.style.transition = ''; }, 300); }
    const delBg = document.getElementById('task-del-' + id);
    if (delBg) { delBg.style.transition = 'opacity 0.25s'; delBg.style.opacity = '0'; setTimeout(() => { if(delBg) delBg.style.transition = ''; }, 300); }
    if (!s.swiping && !e.target.closest('[data-task-check],[data-step-check]')) openEditTask(id);
  }
  delete taskSwipeState[id];
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

// === AUTO GENERATE TASK STEPS ===
async function autoGenerateTaskSteps(taskId, title) {
  const key = localStorage.getItem('nm_gemini_key');
  if (!key) return;
  const systemPrompt = `Ти — помічник планування. Отримуєш назву задачі і маєш вирішити чи варто розбивати на кроки.
Якщо задача містить список (через кому, "і", "та") АБО потребує кількох дій — відповідай ТІЛЬКИ JSON: {"steps":["крок 1","крок 2"]}. Максимум 5 кроків. Кожен крок — коротко (2-5 слів).
Якщо задача проста і не потребує кроків (наприклад "зателефонувати мамі") — відповідай ТІЛЬКИ: {"steps":[]}
ТІЛЬКИ валідний JSON, без тексту.`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: title }], max_tokens: 150, temperature: 0.3 })
    });
    clearTimeout(timeout);
    const data = await res.json();
    const reply = data.choices?.[0]?.message?.content?.trim();
    if (!reply) return;
    const parsed = JSON.parse(reply.replace(/```json|```/g, '').trim());
    if (parsed.steps && parsed.steps.length > 0) {
      const allTasks = getTasks();
      const idx = allTasks.findIndex(x => x.id === taskId);
      if (idx !== -1 && allTasks[idx].steps.length === 0) {
        allTasks[idx].steps = parsed.steps.map(s => ({ id: Date.now() + Math.random(), text: s, done: false }));
        saveTasks(allTasks);
        renderTasks();
      }
    }
  } catch(e) { clearTimeout(timeout); }
}


// === CLARIFY SYSTEM ===
let clarifyParsed = null;
let clarifyOriginalText = null;

function showClarify(parsed, originalText) {
  clarifyParsed = parsed;
  clarifyOriginalText = originalText;

  document.getElementById('clarify-question').textContent = parsed.question || 'Уточни будь ласка:';
  document.getElementById('clarify-input').value = '';

  const optEl = document.getElementById('clarify-options');
  optEl.innerHTML = (parsed.options || []).map((opt, i) => {
    const isPrimary = i === 0;
    return `<button onclick="selectClarifyOption(${i})" style="width:100%;display:flex;align-items:center;gap:10px;background:${isPrimary ? 'rgba(124,58,237,0.05)' : 'rgba(30,16,64,0.03)'};border:1.5px solid ${isPrimary ? 'rgba(124,58,237,0.2)' : 'rgba(30,16,64,0.08)'};border-radius:13px;padding:12px 14px;font-size:14px;font-weight:600;color:${isPrimary ? '#7c3aed' : '#1e1040'};cursor:pointer;text-align:left;font-family:inherit">${escapeHtml(opt.label || '')}</button>`;
  }).join('');

  document.getElementById('clarify-modal').style.display = 'flex';
}

function closeClarify() {
  document.getElementById('clarify-modal').style.display = 'none';
  clarifyParsed = null;
  clarifyOriginalText = null;
}

async function selectClarifyOption(idx) {
  if (!clarifyParsed) return;
  const opt = (clarifyParsed.options || [])[idx];
  if (!opt) return;
  const origText = clarifyOriginalText;
  closeClarify();
  if (opt.action === 'save') await processSaveAction(opt, origText);
  else if (opt.action === 'complete_habit') await processCompleteHabit(opt, origText);
  else if (opt.action === 'complete_task') await processCompleteTask(opt, origText);
}

async function sendClarifyText() {
  const input = document.getElementById('clarify-input');
  const text = input.value.trim();
  if (!text) return;
  closeClarify();
  // Відправляємо уточнення назад в ШІ разом з оригінальним текстом
  const key = localStorage.getItem('nm_gemini_key');
  if (!key) return;
  const fullPrompt = getAIContext() ? `${INBOX_SYSTEM_PROMPT}\n\n${getAIContext()}` : INBOX_SYSTEM_PROMPT;
  const combinedMsg = `Оригінальний запис: "${clarifyOriginalText}". Уточнення від користувача: "${text}"`;
  clarifyOriginalText = null;
  clarifyParsed = null;
  const reply = await callAI(fullPrompt, combinedMsg, {});
  if (reply) {
    try {
      const parsed = JSON.parse(reply.replace(/\`\`\`json|\`\`\`/g, '').trim());
      if (parsed.action === 'save') await processSaveAction(parsed, combinedMsg);
      else if (parsed.action === 'complete_habit') processCompleteHabit(parsed, combinedMsg);
      else if (parsed.action === 'complete_task') processCompleteTask(parsed, combinedMsg);
      else if (parsed.action === 'reply') addInboxChatMsg('agent', parsed.comment || reply);
    } catch(e) {}
  }
}

// Виносимо логіку збереження в окрему функцію щоб використовувати і з clarify і з sendToAI
async function processSaveAction(parsed, originalText) {
  const catMap = {'нотатка':'note','задача':'task','звичка':'habit','ідея':'idea','подія':'event'};
  const rawCat = (parsed.category || '').toLowerCase();
  const cat = ['idea','task','habit','note','event'].includes(rawCat) ? rawCat : (catMap[rawCat] || 'note');
  const savedText = parsed.text || originalText;
  const folder = parsed.folder || null;
  const items = getInbox();
  items.unshift({ id: Date.now(), text: savedText, category: cat, ts: Date.now(), processed: true });
  saveInbox(items);
  renderInbox();

  if (cat === 'task') {
    const taskId = Date.now();
    const tasks = getTasks();
    const taskTitle = parsed.task_title || savedText;
    const taskSteps = Array.isArray(parsed.task_steps) && parsed.task_steps.length > 0
      ? parsed.task_steps.map(s => ({ id: Date.now() + Math.random(), text: s, done: false }))
      : [];
    tasks.unshift({ id: taskId, title: taskTitle, desc: savedText !== taskTitle ? savedText : '', steps: taskSteps, status: 'active', createdAt: taskId });
    saveTasks(tasks);
    if (taskSteps.length === 0) autoGenerateTaskSteps(taskId, taskTitle);
  }
  if (cat === 'note' || cat === 'idea') addNoteFromInbox(savedText, cat, folder);
  if (cat === 'habit') {
    const habits = getHabits();
    const exists = habits.some(h => h.name.toLowerCase() === savedText.toLowerCase());
    if (!exists) {
      const txt = savedText.toLowerCase();
      let days = [0,1,2,3,4,5,6];
      const hasEveryDay = /щодня|кожного дня|кожен день/i.test(txt);
      const hasWeekdays = /будн|пн.*ср.*пт/i.test(txt);
      const hasWeekend = /вихідн|субот.*неділ|сб.*нд/i.test(txt);
      const hasWeekday = /понеділ|вівтор|серед|четвер|п.ятниц|субот|неділ/i.test(txt);
      if (hasEveryDay) { days = [0,1,2,3,4,5,6]; }
      else if (hasWeekdays) { days = [0,1,2,3,4]; }
      else if (hasWeekend) { days = [5,6]; }
      else if (hasWeekday) {
        days = [];
        if (/понеділ|пн/i.test(txt)) days.push(0);
        if (/вівтор|вт/i.test(txt)) days.push(1);
        if (/серед|ср/i.test(txt)) days.push(2);
        if (/четвер|чт/i.test(txt)) days.push(3);
        if (/п.ятниц|пт/i.test(txt)) days.push(4);
        if (/субот|сб/i.test(txt)) days.push(5);
        if (/неділ|нд/i.test(txt)) days.push(6);
        if (days.length === 0) days = [0,1,2,3,4,5,6];
      }
      const habitParts = savedText.split(/[,.]\s*/);
      const habitName = habitParts[0].trim().split(' ').slice(0,5).join(' ');
      const habitDetails = savedText.length > habitName.length + 2 ? savedText.substring(habitName.length).replace(/^[,.\s]+/,'').trim() : '';
      habits.push({ id: Date.now(), name: habitName, details: habitDetails, emoji: '⭕', days, createdAt: Date.now() });
      saveHabits(habits);
    }
  }
  if (cat === 'event') {
    const mood = /добре|чудово|супер|відмінно|весело|щасли/i.test(savedText) ? 'positive' :
                 /погано|жахливо|сумно|нудно|важко|втомив/i.test(savedText) ? 'negative' : 'neutral';
    const moments = getMoments();
    const newMoment = { id: Date.now(), text: savedText, mood, ts: Date.now() };
    moments.push(newMoment);
    saveMoments(moments);
    generateMomentSummary(newMoment.id, savedText);
  }
  const catConfirm2 = {
    task: '✅ Задачу створено',
    habit: '🌱 Звичку створено',
    note: '📝 Нотатку збережено',
    idea: '💡 Ідею збережено',
    event: '📅 Подію додано'
  };
  const confirmMsg2 = parsed.comment
    ? `${parsed.comment} ${catConfirm2[cat] ? '/ ' + catConfirm2[cat] : ''}`
    : (catConfirm2[cat] || '✓ Збережено');
  addInboxChatMsg('agent', confirmMsg2);

  // Якщо є уточнення після збереження — показуємо через паузу
  if (parsed.ask_after) {
    setTimeout(() => addInboxChatMsg('agent', parsed.ask_after), 600);
  }
}


// === COMPLETE HABIT FROM INBOX ===
function processCompleteHabit(parsed, originalText) {
  // Підтримуємо і старий формат (habit_id) і новий (habit_ids масив)
  const ids = parsed.habit_ids || (parsed.habit_id ? [parsed.habit_id] : []);
  if (ids.length === 0) {
    addInboxChatMsg('agent', 'Не зрозумів яку звичку відмітити.');
    return;
  }
  const habits = getHabits();
  const today = new Date().toDateString();
  const log = getHabitLog();
  if (!log[today]) log[today] = {};
  const completed = [];
  ids.forEach(habitId => {
    const habit = habits.find(h => h.id == habitId);
    if (habit) {
      log[today][habit.id] = true;
      completed.push(habit.name);
    }
  });
  if (completed.length === 0) {
    addInboxChatMsg('agent', 'Не знайшов такі звички.');
    return;
  }
  saveHabitLog(log);
  renderProdHabits();
  renderHabits();
  // Зберігаємо в Inbox для історії
  const items = getInbox();
  items.unshift({ id: Date.now(), text: originalText, category: 'habit', ts: Date.now(), processed: true });
  saveInbox(items);
  renderInbox();
  const msg = parsed.comment || (completed.length === 1
    ? `✅ Відмітив звичку "${completed[0]}" як виконану`
    : `✅ Відмітив ${completed.length} звички: ${completed.join(', ')}`);
  addInboxChatMsg('agent', msg);
}

// === COMPLETE TASK FROM INBOX ===
function processCompleteTask(parsed, originalText) {
  // Підтримуємо і старий формат (task_id) і новий (task_ids масив)
  const ids = parsed.task_ids || (parsed.task_id ? [parsed.task_id] : []);
  if (ids.length === 0) {
    addInboxChatMsg('agent', 'Не зрозумів яку задачу закрити.');
    return;
  }
  const tasks = getTasks();
  const completed = [];
  ids.forEach(taskId => {
    const idx = tasks.findIndex(t => t.id == taskId);
    if (idx !== -1) {
      completed.push(tasks[idx].title);
      tasks[idx] = { ...tasks[idx], status: 'done', completedAt: Date.now() };
    }
  });
  if (completed.length === 0) {
    addInboxChatMsg('agent', 'Не знайшов такі задачі.');
    return;
  }
  saveTasks(tasks);
  renderTasks();
  // Зберігаємо в Inbox для історії
  const items = getInbox();
  items.unshift({ id: Date.now(), text: originalText, category: 'task', ts: Date.now(), processed: true });
  saveInbox(items);
  renderInbox();
  const msg = parsed.comment || (completed.length === 1
    ? `✅ Задачу "${completed[0]}" закрито`
    : `✅ Закрив ${completed.length} задачі: ${completed.join(', ')}`);
  addInboxChatMsg('agent', msg);
}



let activeChatBar = null;

function getTabbarHeight() {
  const tb = document.getElementById('tab-bar');
  return tb ? tb.offsetHeight : 83;
}

// === CHAT STORAGE — зберігає чати по вкладках ===
const CHAT_STORE_MAX = 30; // максимум повідомлень на вкладку
const CHAT_STORE_KEYS = {
  inbox:   'nm_chat_inbox',
  tasks:   'nm_chat_tasks',
  notes:   'nm_chat_notes',
  me:      'nm_chat_me',
  evening: 'nm_chat_evening',
  finance: 'nm_chat_finance',
};

function saveChatMsg(tab, role, text) {
  if (role === 'typing') return;
  const key = CHAT_STORE_KEYS[tab];
  if (!key) return;
  try {
    const msgs = JSON.parse(localStorage.getItem(key) || '[]');
    msgs.push({ role, text, ts: Date.now() });
    if (msgs.length > CHAT_STORE_MAX) msgs.splice(0, msgs.length - CHAT_STORE_MAX);
    localStorage.setItem(key, JSON.stringify(msgs));
  } catch(e) {}
}

function loadChatMsgs(tab) {
  const key = CHAT_STORE_KEYS[tab];
  if (!key) return [];
  try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; }
}

function restoreChatUI(tab) {
  const containerMap = {
    inbox:   'inbox-chat-messages',
    tasks:   'tasks-chat-messages',
    notes:   'notes-chat-messages',
    me:      'me-chat-messages',
    evening: 'evening-bar-messages',
    finance: 'finance-chat-messages',
  };
  const addMsgMap = {
    tasks:   (r,t) => addTaskBarMsg(r,t,true),
    notes:   (r,t) => addNotesChatMsg(r,t,true),
    me:      (r,t) => addMeChatMsg(r,t,true),
    evening: (r,t) => addEveningBarMsg(r,t,true),
    finance: (r,t) => addFinanceChatMsg(r,t,true),
  };
  const containerId = containerMap[tab];
  if (!containerId) return;
  const el = document.getElementById(containerId);
  if (!el || el.children.length > 0) return; // вже є повідомлення
  const msgs = loadChatMsgs(tab);
  if (msgs.length === 0) return;
  // Додаємо розділювач "Попередня розмова"
  const sep = document.createElement('div');
  sep.style.cssText = 'display:flex;align-items:center;gap:8px;margin:4px 0 8px;opacity:0.4';
  sep.innerHTML = `<div style="flex:1;height:1px;background:rgba(255,255,255,0.2)"></div><div style="font-size:10px;color:rgba(255,255,255,0.6);white-space:nowrap;font-weight:600;text-transform:uppercase;letter-spacing:0.06em">Попередня розмова</div><div style="flex:1;height:1px;background:rgba(255,255,255,0.2)"></div>`;
  el.appendChild(sep);
  // Рендеримо збережені повідомлення без повторного запису в storage
  if (tab === 'inbox') {
    msgs.forEach(m => _renderInboxChatMsg(m.role, m.text, el));
  } else if (addMsgMap[tab]) {
    msgs.forEach(m => addMsgMap[tab](m.role, m.text));
  }
}

// Внутрішній рендер без запису в storage (щоб не дублювати при відновленні)
function _renderInboxChatMsg(role, text, el) {
  const isAgent = role === 'agent';
  const div = document.createElement('div');
  div.style.cssText = `display:flex;${isAgent ? 'gap:8px;align-items:flex-start' : 'justify-content:flex-end'}`;
  if (isAgent) {
    div.innerHTML = `<div style="background:rgba(255,255,255,0.12);color:white;border-radius:4px 14px 14px 14px;padding:8px 12px;font-size:15px;font-weight:500;line-height:1.5;max-width:85%">${escapeHtml(text).replace(/\n/g,'<br>')}</div>`;
  } else {
    div.innerHTML = `<div style="background:rgba(255,255,255,0.88);color:#1e1040;border-radius:14px 4px 14px 14px;padding:8px 12px;font-size:15px;font-weight:500;line-height:1.5;max-width:85%">${escapeHtml(text)}</div>`;
  }
  el.appendChild(div);
  el.scrollTop = el.scrollHeight;
}

function openChatBar(tab) {
  if (activeChatBar === tab) return;

  // Закриваємо інші бари БЕЗ blur — щоб не скинути фокус з поточного поля
  ['tasks','me','evening','finance'].forEach(t => {
    if (t === tab) return;
    const b = document.getElementById(t + '-ai-bar');
    if (!b) return;
    const cw = b.querySelector('.ai-bar-chat-window');
    if (cw) cw.classList.remove('open');
    const inputs = b.querySelectorAll('input, textarea');
    inputs.forEach(i => i.blur());
  });

  activeChatBar = tab;

  const bar = document.getElementById(tab + '-ai-bar');
  if (!bar) return;

  // Відновлюємо попередній чат якщо вікно порожнє
  restoreChatUI(tab);

  const chatWin = bar.querySelector('.ai-bar-chat-window');
  if (chatWin) requestAnimationFrame(() => { chatWin.classList.add('open'); });
}

function closeChatBar(tab) {
  const bar = document.getElementById(tab + '-ai-bar');
  if (!bar) return;

  const chatWin = bar.querySelector('.ai-bar-chat-window');
  if (chatWin) chatWin.classList.remove('open');

  // Знімаємо фокус але НЕ очищуємо текст — користувач може повернутись
  const inputs = bar.querySelectorAll('input, textarea');
  inputs.forEach(i => i.blur());

  activeChatBar = null;
}

function toggleChatBar(tab) {
  if (activeChatBar === tab) {
    closeChatBar(tab);
  } else {
    openChatBar(tab);
  }
}

function closeAllChatBars(resetActive = true) {
  ['inbox','tasks','notes','me','evening','finance'].forEach(t => {
    const bar = document.getElementById(t + '-ai-bar');
    if (!bar) return;
    const chatWin = bar.querySelector('.ai-bar-chat-window');
    if (chatWin) chatWin.classList.remove('open');
    const inputs = bar.querySelectorAll('input, textarea');
    inputs.forEach(i => i.blur());
  });
  if (resetActive) activeChatBar = null;
}

// Свайп вниз по чат-вікну щоб закрити
function setupChatBarSwipe() {
  ['inbox','tasks','notes','me','evening','finance'].forEach(tab => {
    const bar = document.getElementById(tab + '-ai-bar');
    if (!bar) return;
    const chatWin = bar.querySelector('.ai-bar-chat-window');
    const messages = bar.querySelector('.ai-bar-messages');
    if (!chatWin) return;

    // --- Gesture-driven свайп по чат-вікну ---
    let winStartY = 0, winStartX = 0, winStartVpTop = 0, isDragging = false, startTime = 0;

    chatWin.addEventListener('touchstart', e => {
      if (messages && messages.contains(e.target)) return;
      winStartY = e.touches[0].clientY;
      winStartX = e.touches[0].clientX;
      // Запамʼятовуємо позицію viewport — компенсуємо iOS scroll при клавіатурі
      winStartVpTop = window.visualViewport ? window.visualViewport.offsetTop : 0;
      startTime = Date.now();
      isDragging = false;
      chatWin.style.transition = 'none';
      chatWin.style.opacity = '1';
    }, { passive: true });

    chatWin.addEventListener('touchmove', e => {
      if (messages && messages.contains(e.target)) return;
      // Враховуємо зміщення viewport (коли клавіатура відкрита iOS скролить viewport)
      const vpTop = window.visualViewport ? window.visualViewport.offsetTop : 0;
      const vpDelta = vpTop - winStartVpTop;
      const dy = (e.touches[0].clientY - winStartY) + vpDelta;
      if (isDragging) {
        if (dy <= 0) { chatWin.style.transform = 'translateY(0)'; return; }
        chatWin.style.transform = `translateY(${dy}px)`;
        chatWin.style.opacity = Math.max(0, 1 - dy / 300).toFixed(2);
        return;
      }
      const dx = Math.abs(e.touches[0].clientX - winStartX);
      if (dy <= 0) return;
      if (dx > dy * 1.5) return;
      isDragging = true;
      chatWin.style.transform = `translateY(${dy}px)`;
      chatWin.style.opacity = Math.max(0, 1 - dy / 300).toFixed(2);
    }, { passive: true });

    chatWin.addEventListener('touchend', e => {
      if (!isDragging) {
        // Це був тап — повертаємо в початковий стан
        chatWin.style.transition = '';
        chatWin.style.transform = '';
        chatWin.style.opacity = '';
        return;
      }
      const dy = e.changedTouches[0].clientY - winStartY;
      const elapsed = Date.now() - startTime;
      const velocity = dy / elapsed; // px/ms
      // Вмикаємо transition назад
      chatWin.style.transition = 'transform 0.28s cubic-bezier(0.32,0.72,0,1), opacity 0.25s ease';
      // Закриваємо якщо: пройшли > 80px АБО швидкість > 0.5px/ms
      if (dy > 80 || velocity > 0.5) {
        chatWin.style.transform = 'translateY(110%)';
        chatWin.style.opacity = '0';
        setTimeout(() => {
          closeChatBar(tab);
          chatWin.style.transition = '';
          chatWin.style.transform = '';
          chatWin.style.opacity = '';
        }, 280);
      } else {
        // Повертаємо назад (пружина)
        chatWin.style.transform = 'translateY(0)';
        chatWin.style.opacity = '1';
        setTimeout(() => {
          chatWin.style.transition = '';
          chatWin.style.transform = '';
          chatWin.style.opacity = '';
        }, 280);
      }
      isDragging = false;
    }, { passive: true });

    // --- Блок: бар не рухається при скролі сторінки ---
    // Блокуємо тільки коли вікно чату ВІДКРИТЕ
    bar.addEventListener('touchmove', e => {
      // Якщо вікно закрите — пропускаємо все наскрізь
      if (!chatWin.classList.contains('open')) return;
      // Вікно відкрите — дозволяємо скрол повідомлень і поля
      if (messages && messages.contains(e.target)) return;
      const textarea = bar.querySelector('textarea');
      if (textarea && textarea.contains(e.target)) return;
      e.preventDefault();
    }, { passive: false });
  });

  // --- Тап поза вікном → закрити (але НЕ свайп) ---
  let docTouchStartY = 0, docTouchStartX = 0;
  document.addEventListener('touchstart', e => {
    docTouchStartY = e.touches[0].clientY;
    docTouchStartX = e.touches[0].clientX;
  }, { passive: true });

  document.addEventListener('touchend', e => {
    if (!activeChatBar) return;
    const bar = document.getElementById(activeChatBar + '-ai-bar');
    if (!bar) return;
    // Якщо дотик всередині бару — нічого (поле, вікно, кнопки)
    if (bar.contains(e.target)) return;
    // Якщо дотик по таббару — нічого
    const tabBar = document.getElementById('tab-bar');
    if (tabBar && tabBar.contains(e.target)) return;
    // Вимірюємо відстань — якщо це свайп (> 10px) → НЕ закриваємо
    const dy = Math.abs(e.changedTouches[0].clientY - docTouchStartY);
    const dx = Math.abs(e.changedTouches[0].clientX - docTouchStartX);
    if (dy > 10 || dx > 10) return; // це скрол карток — не заважаємо
    // Це тап → закриваємо чат (текст у полі НЕ очищуємо)
    closeChatBar(activeChatBar);
  }, { passive: true });
}


let taskBarLoading = false;
let taskBarHistory = [];

function showTasksChatMessages() {
  openChatBar('tasks');
}

let _taskTypingEl = null;
let _financeTypingEl = null;
let _eveningTypingEl = null;
let _notesTypingEl = null;

function addTaskBarMsg(role, text, _noSave = false) {
  const el = document.getElementById('tasks-chat-messages');
  if (!el) return;
  if (_taskTypingEl) { _taskTypingEl.remove(); _taskTypingEl = null; }
  if (role === 'typing') {
    const td = document.createElement('div');
    td.style.cssText = 'display:flex';
    td.innerHTML = '<div style="background:rgba(255,255,255,0.12);border-radius:4px 12px 12px 12px;padding:5px 10px"><div class=\"ai-typing\"><span></span><span></span><span></span></div></div>';
    el.appendChild(td);
    _taskTypingEl = td;
    el.scrollTop = el.scrollHeight;
    return;
  }
  try { openChatBar('tasks'); } catch(e) {}
  const isAgent = role === 'agent';
  const div = document.createElement('div');
  div.style.cssText = `display:flex;${isAgent ? '' : 'justify-content:flex-end'}`;
  div.innerHTML = `<div style="max-width:85%;background:${isAgent ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.88)'};color:${isAgent ? 'white' : '#1e1040'};border-radius:${isAgent ? '4px 12px 12px 12px' : '12px 4px 12px 12px'};padding:8px 12px;font-size:15px;line-height:1.5;font-weight:500">${escapeHtml(text)}</div>`;
  el.appendChild(div);
  el.scrollTop = el.scrollHeight;
  if (role !== 'agent') taskBarHistory.push({ role: 'user', content: text });
  if (!_noSave) saveChatMsg('tasks', role, text);
}

// === UNIVERSAL ACTION PROCESSOR — один мозок для всіх барів ===
function processUniversalAction(parsed, originalText, addMsg) {
  const action = parsed.action;

  if (action === 'create_task') {
    const title = (parsed.title || '').trim();
    if (!title) return false;
    const steps = Array.isArray(parsed.steps) ? parsed.steps.map(s => ({ id: Date.now() + Math.random(), text: s, done: false })) : [];
    const tasks = getTasks();
    tasks.unshift({ id: Date.now(), title, desc: parsed.desc || '', steps, status: 'active', createdAt: Date.now() });
    saveTasks(tasks);
    if (currentTab === 'tasks') renderTasks();
    addMsg('agent', '✅ Задачу "' + title + '" створено');
    if (parsed.ask_after) setTimeout(() => addMsg('agent', parsed.ask_after), 600);
    return true;
  }

  if (action === 'create_habit') {
    const name = (parsed.name || '').trim();
    if (!name) return false;
    const habits = getHabits();
    habits.push({ id: Date.now(), name, details: parsed.details || '', emoji: '⭕', days: parsed.days || [0,1,2,3,4,5,6], createdAt: Date.now() });
    saveHabits(habits);
    renderProdHabits(); renderHabits();
    addMsg('agent', '🌱 Звичку "' + name + '" створено');
    if (parsed.ask_after) setTimeout(() => addMsg('agent', parsed.ask_after), 600);
    return true;
  }

  if (action === 'create_note') {
    addNoteFromInbox(parsed.text, 'note', parsed.folder || null);
    if (currentTab === 'notes') renderNotes();
    addMsg('agent', '✓ Нотатку збережено' + (parsed.folder ? ' в папку "' + parsed.folder + '"' : ''));
    if (parsed.ask_after) setTimeout(() => addMsg('agent', parsed.ask_after), 600);
    return true;
  }

  if (action === 'save_finance' || action === 'save_expense' || action === 'save_income') {
    const type = action === 'save_income' ? 'income' : (parsed.fin_type || 'expense');
    const amount = parseFloat(parsed.amount) || 0;
    if (!amount || amount <= 0) { addMsg('agent', 'Не вдалось розпізнати суму.'); return true; }
    const category = parsed.category || 'Інше';
    const cats = getFinCats();
    const catList = type === 'expense' ? cats.expense : cats.income;
    if (!catList.includes(category)) { catList.push(category); saveFinCats(cats); }
    const txs = getFinance();
    txs.unshift({ id: Date.now(), type, amount, category, comment: parsed.comment || originalText, ts: Date.now() });
    saveFinance(txs);
    if (currentTab === 'finance') renderFinance();
    addMsg('agent', '✓ ' + (type === 'expense' ? '-' : '+') + formatMoney(amount) + ' · ' + category);
    return true;
  }

  return false;
}


async function sendTasksBarMessage() {
  if (taskBarLoading) return;
  const input = document.getElementById('tasks-chat-input');
  const text = input.value.trim();
  if (!text) return;
  const key = localStorage.getItem('nm_gemini_key');
  if (!key) { addTaskBarMsg('agent', 'Введи OpenAI ключ в налаштуваннях.'); return; }

  input.value = '';
  input.style.height = 'auto';
  addTaskBarMsg('user', text);
  taskBarLoading = true;
  addTaskBarMsg('typing', '');

  const tasks = getTasks().filter(t => t.status !== 'done');
  const tasksSummary = tasks.map(t => {
    const steps = (t.steps || []).map(s => '  - ' + s.text + (s.done ? ' [✓]' : '')).join('\n');
    return 'Задача ID:' + t.id + ' "' + t.title + '"' + (steps ? '\nКроки:\n' + steps : '');
  }).join('\n\n');

  const habits = getHabits();
  const log = getHabitLog();
  const today = new Date().toDateString();
  const habitsSummary = habits.map(h => {
    const done = !!log[today]?.[h.id];
    return h.name + (done ? ' [виконано сьогодні]' : ' [не виконано сьогодні]');
  }).join(', ');

  const aiContext = getAIContext();
  const systemPrompt = getOWLPersonality() + '\n\n'
    + 'ЗАДАЧІ:\n' + (tasksSummary || 'Немає активних задач') + '\n\n'
    + (habitsSummary ? 'ЗВИЧКИ СЬОГОДНІ:\n' + habitsSummary + '\n\n' : '')
    + 'Ти можеш:\n'
    + '1. Відповідати на питання про задачі та звички\n'
    + '2. Виконав крок — JSON: {"action":"complete_step","task_id":ID,"step_text":"текст"}\n'
    + '3. Виконав задачу — JSON: {"action":"complete_task","task_id":ID}\n'
    + '4. Виконав звичку — JSON: {"action":"complete_habit","habit_name":"назва"}\n'
    + '5. Створити звичку — JSON: {"action":"create_habit","name":"назва","days":[0,1,2,3,4,5,6]}\n'
    + '6. Створити задачу — JSON: {"action":"create_task","title":"назва","steps":[]}\n'
    + '7. Додати крок — JSON: {"action":"add_step","task_id":ID,"step":"текст"}\n'
    + '8. Скасувати крок — JSON: {"action":"undo_step","task_id":ID,"step_text":"текст"}\n'
    + '9. Створити нотатку — JSON: {"action":"create_note","text":"текст","folder":null}\n'
    + '10. Зберегти витрату — JSON: {"action":"save_finance","fin_type":"expense","amount":число,"category":"категорія","comment":"текст"}\n'
    + '11. Зберегти дохід — JSON: {"action":"save_finance","fin_type":"income","amount":число,"category":"категорія","comment":"текст"}\n'
    + 'Якщо незрозуміло — запитай. ТІЛЬКИ чистий JSON без markdown. Інакше — текст українською 1-2 речення.\nНЕ вигадуй дані яких немає: ліміти, плани, звички чи задачі яких немає в списку вище.'
    + (aiContext ? '\n\n' + aiContext : '');

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'system', content: systemPrompt }, ...taskBarHistory.slice(-8), { role: 'user', content: text }],
        max_tokens: 200, temperature: 0.5
      })
    });
    const data = await res.json();
    const reply = data.choices?.[0]?.message?.content?.trim();
    if (!reply) { addTaskBarMsg('agent', 'Щось пішло не так.'); taskBarLoading = false; return; }

    // Спробуємо розпарсити JSON дію
    try {
      // Шукаємо JSON навіть якщо є текст перед ним
      const jsonMatch = reply.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? jsonMatch[0] : reply.replace(/```json|```/g,'').trim();
      const parsed = JSON.parse(jsonStr);

      // Спочатку пробуємо універсальні дії (нотатки, фінанси, задачі, звички)
      if (processUniversalAction(parsed, text, addTaskBarMsg)) {
        // оброблено
      } else if (parsed.action === 'complete_step') {
        const allTasks = getTasks();
        const t = allTasks.find(x => x.id === parsed.task_id);
        if (t) {
          const step = t.steps.find(s => s.text.toLowerCase().includes(parsed.step_text.toLowerCase().substring(0,10)));
          if (step) {
            step.done = true;
            // Якщо всі кроки виконані або немає кроків — виконати задачу
            if (t.steps.every(s => s.done)) t.status = 'done';
            saveTasks(allTasks); renderTasks();
            addTaskBarMsg('agent', `✅ Відмітив "${step.text}" як виконано`);
          } else { addTaskBarMsg('agent', 'Не знайшов такий крок. Уточни будь ласка.'); }
        }
      } else if (parsed.action === 'complete_task') {
        const allTasks = getTasks();
        const t = allTasks.find(x => x.id === parsed.task_id);
        if (t) { t.status = 'done'; t.steps.forEach(s => s.done = true); saveTasks(allTasks); renderTasks(); addTaskBarMsg('agent', `✅ Задачу "${t.title}" виконано!`); }
      } else if (parsed.action === 'add_step') {
        const allTasks = getTasks();
        const t = allTasks.find(x => x.id === parsed.task_id);
        if (t) { t.steps.push({ id: Date.now(), text: parsed.step, done: false }); saveTasks(allTasks); renderTasks(); addTaskBarMsg('agent', '✅ Додав крок "' + parsed.step + '"'); }
      } else if (parsed.action === 'complete_habit') {
        const habits = getHabits();
        const h = habits.find(x => x.name.toLowerCase().includes((parsed.habit_name || '').toLowerCase().substring(0,6)));
        if (h) {
          const todayStr = new Date().toDateString();
          const log = getHabitLog();
          if (!log[todayStr]) log[todayStr] = {};
          log[todayStr][h.id] = true;
          saveHabitLog(log);
          renderProdHabits();
          renderHabits();
          addTaskBarMsg('agent', '✅ Відмітив звичку "' + h.name + '" як виконану сьогодні');
        } else { addTaskBarMsg('agent', reply); }
      } else if (parsed.action === 'create_habit') {
        const habits = getHabits();
        const name = (parsed.name || '').trim();
        if (name) {
          const days = parsed.days || [0,1,2,3,4,5,6];
          habits.push({ id: Date.now(), name, details: parsed.details || '', emoji: '⭕', days, createdAt: Date.now() });
          saveHabits(habits);
          renderProdHabits(); renderHabits();
          addTaskBarMsg('agent', '🌱 Звичку "' + name + '" створено!');
        }
      } else if (parsed.action === 'create_task') {
        const tasks = getTasks();
        const title = (parsed.title || '').trim();
        if (title) {
          const steps = Array.isArray(parsed.steps) ? parsed.steps.map(s => ({ id: Date.now() + Math.random(), text: s, done: false })) : [];
          tasks.unshift({ id: Date.now(), title, desc: parsed.desc || '', steps, status: 'active', createdAt: Date.now() });
          saveTasks(tasks); renderTasks();
          addTaskBarMsg('agent', '✅ Задачу "' + title + '" створено!');
        }
      } else if (parsed.action === 'undo_step') {
        const allTasks = getTasks();
        const t = allTasks.find(x => x.id === parsed.task_id);
        if (t) {
          const step = t.steps.find(s => s.text.toLowerCase().includes((parsed.step_text || '').toLowerCase().substring(0,10)));
          if (step) {
            step.done = false;
            if (t.status === 'done') t.status = 'active';
            saveTasks(allTasks); renderTasks();
            addTaskBarMsg('agent', `↩️ Скасував виконання "${step.text}"`);
          } else { addTaskBarMsg('agent', 'Не знайшов такий крок. Уточни будь ласка.'); }
        }
      } else { addTaskBarMsg('agent', reply); }
    } catch { addTaskBarMsg('agent', reply); }

    taskBarHistory.push({ role: 'assistant', content: reply });
  } catch { addTaskBarMsg('agent', 'Мережева помилка.'); }
  taskBarLoading = false;
}

// === ME AI BAR ===
let meBarLoading = false;

function showMeChatMessages() {
  openChatBar('me');
}

function addMeChatMsg(role, text, _noSave = false, id = '') {
  const el = document.getElementById('me-chat-messages');
  if (!el) return;
  try { openChatBar('me'); } catch(e) {}
  const isAgent = role === 'agent';
  const div = document.createElement('div');
  div.style.cssText = `display:flex;${isAgent ? '' : 'justify-content:flex-end'}`;
  div.innerHTML = `<div ${id ? `id="${id}"` : ''} style="max-width:85%;background:${isAgent ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.88)'};color:${isAgent ? 'white' : '#1e1040'};border-radius:${isAgent ? '4px 12px 12px 12px' : '12px 4px 12px 12px'};padding:8px 12px;font-size:15px;line-height:1.5;font-weight:500">${escapeHtml(text)}</div>`;
  el.appendChild(div);
  el.scrollTop = el.scrollHeight;
  if (!_noSave) saveChatMsg('me', role, text);
}

// === FINANCE ===

// Storage
function getFinance() { return JSON.parse(localStorage.getItem('nm_finance') || '[]'); }
function saveFinance(arr) { localStorage.setItem('nm_finance', JSON.stringify(arr)); }
function getFinBudget() { return JSON.parse(localStorage.getItem('nm_finance_budget') || '{"total":0,"categories":{}}'); }
function saveFinBudget(obj) { localStorage.setItem('nm_finance_budget', JSON.stringify(obj)); }
function getFinCats() {
  const saved = JSON.parse(localStorage.getItem('nm_finance_cats') || 'null');
  if (saved) return saved;
  return {
    expense: ['Їжа','Транспорт','Підписки','Здоровʼя','Житло','Покупки','Трава','Інше'],
    income:  ['Зарплата','Надходження','Повернення','Інше'],
  };
}
function saveFinCats(obj) { localStorage.setItem('nm_finance_cats', JSON.stringify(obj)); }

// Підкатегорії — показуються після вибору головної
const FIN_SUBCATS = {
  'Їжа':       ['Продукти','Ресторан','Кафе','Доставка','Фастфуд'],
  'Транспорт': ['Паливо','Таксі','Парковка','Громадський','Ремонт авто'],
  'Підписки':  ['Стрімінг','Музика','Хмара','Додатки','Ігри'],
  'Здоровʼя':  ['Аптека','Лікар','Спортзал','Аналізи','Косметика'],
  'Житло':     ['Оренда','Комунальні','Інтернет','Ремонт','Меблі'],
  'Покупки':   ['Одяг','Техніка','Книги','Подарунки','Дім'],
  'Трава':     ['Кальян','Диспенсарі','Квіти','Дорого','Онлайн'],
};

// State
let currentFinTab = 'expense';
let currentFinPeriod = 'month';
function getCurrency() {
  const s = JSON.parse(localStorage.getItem('nm_settings') || '{}');
  return s.currency || '₴';
}

function setCurrency(symbol) {
  const s = JSON.parse(localStorage.getItem('nm_settings') || '{}');
  s.currency = symbol;
  localStorage.setItem('nm_settings', JSON.stringify(s));
  ['₴','$','€'].forEach(c => {
    const map = {'₴':'uah','$':'usd','€':'eur'};
    const btn = document.getElementById('btn-currency-' + map[c]);
    if (btn) {
      if (c === symbol) btn.classList.add('active');
      else btn.classList.remove('active');
    }
  });
  if (currentTab === 'finance') renderFinance();
}

function formatMoney(n) {
  return getCurrency() + (Math.abs(n) % 1 === 0 ? Math.abs(n) : Math.abs(n).toFixed(2));
}

// Категорії кольори
const FIN_CAT_COLORS = ['#f97316','#0ea5e9','#a855f7','#22c55e','#ef4444','#eab308','#14b8a6','#f43f5e','#6366f1','#84cc16','#fb923c','#38bdf8'];

function getFinColor(idx) { return FIN_CAT_COLORS[idx % FIN_CAT_COLORS.length]; }

// Фільтр транзакцій по періоду
function getFinPeriodRange(period) {
  const now = new Date();
  let from;
  if (period === 'week') {
    from = new Date(now); from.setDate(now.getDate() - 6); from.setHours(0,0,0,0);
  } else if (period === 'month') {
    from = new Date(now.getFullYear(), now.getMonth(), 1);
  } else {
    from = new Date(now.getFullYear(), now.getMonth() - 2, 1);
  }
  return from.getTime();
}

function getFilteredTransactions(type, period) {
  const from = getFinPeriodRange(period);
  return getFinance().filter(t => t.type === type && t.ts >= from);
}


// Перемикачі
function switchFinTab(tab) {
  currentFinTab = tab;
  ['expense','income','balance'].forEach(t => {
    const el = document.getElementById('fin-tab-' + t);
    if (!el) return;
    const active = t === tab;
    el.style.background = active ? 'white' : '';
    el.style.color = active ? (tab === 'expense' ? '#c2410c' : tab === 'income' ? '#16a34a' : '#4f46e5') : 'rgba(30,16,64,0.4)';
    el.style.boxShadow = active ? '0 2px 8px rgba(0,0,0,0.08)' : '';
  });
  renderFinance();
}

function setFinPeriod(period) {
  currentFinPeriod = period;
  ['week','month','3months'].forEach(p => {
    const el = document.getElementById('fin-period-' + p);
    if (!el) return;
    const active = p === period;
    el.style.borderColor = active ? '#c2410c' : 'rgba(194,65,12,0.2)';
    el.style.background = active ? 'rgba(194,65,12,0.1)' : 'rgba(194,65,12,0.05)';
    el.style.color = active ? '#c2410c' : 'rgba(30,16,64,0.5)';
  });
  renderFinance();
}

// Головний рендер
function renderFinance() {
  if (currentFinTab === 'balance') {
    renderFinBalance();
  } else {
    renderFinMain(currentFinTab);
  }
}

function renderFinMain(type) {
  const txs = getFilteredTransactions(type, currentFinPeriod);
  const total = txs.reduce((s, t) => s + t.amount, 0);
  const budget = getFinBudget();
  const isExpense = type === 'expense';

  // Зведення
  const periodLabels = { week: 'за тиждень', month: 'за місяць', '3months': 'за 3 місяці' };
  const typeLabel = isExpense ? 'Витрати' : 'Доходи';
  document.getElementById('fin-summary-label').textContent = `${typeLabel} ${periodLabels[currentFinPeriod]}`;
  document.getElementById('fin-total').textContent = formatMoney(total);
  document.getElementById('fin-total').style.color = isExpense ? '#7c2d12' : '#14532d';

  // Бюджет (тільки для витрат і місяця)
  const budgetEl = document.getElementById('fin-budget-label');
  const budgetRemainEl = document.getElementById('fin-budget-remain');
  const budgetBarWrap = document.getElementById('fin-budget-bar-wrap');
  const budgetBar = document.getElementById('fin-budget-bar');
  if (isExpense && currentFinPeriod === 'month' && budget.total > 0) {
    const remain = budget.total - total;
    budgetEl.textContent = `Бюджет: ${formatMoney(budget.total)}`;
    budgetRemainEl.textContent = remain >= 0 ? `Залишилось ${formatMoney(remain)}` : `Перевищено на ${formatMoney(-remain)}`;
    budgetRemainEl.style.color = remain >= 0 ? '#c2410c' : '#dc2626';
    budgetBarWrap.style.display = 'block';
    const pct = Math.min(100, Math.round(total / budget.total * 100));
    budgetBar.style.width = pct + '%';
    budgetBar.style.background = pct >= 100 ? '#dc2626' : pct >= 80 ? '#f97316' : '#c2410c';
  } else {
    budgetEl.textContent = '';
    budgetRemainEl.textContent = '';
    budgetBarWrap.style.display = 'none';
  }

  // Графік по днях
  renderFinChart(txs, type);

  // По категоріях
  const catsBlock = document.getElementById('fin-cats-block');
  const catBudgetsBlock = document.getElementById('fin-cat-budgets-block');
  catsBlock.style.display = 'block';
  catBudgetsBlock.style.display = isExpense ? 'block' : 'none';
  renderFinCategories(txs, type);
  if (isExpense) renderFinCatBudgets(txs);

  // Список транзакцій
  renderFinTransactions(txs);
}

function renderFinBalance() {
  const from = getFinPeriodRange(currentFinPeriod);
  const allTxs = getFinance().filter(t => t.ts >= from);
  const income = allTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expense = allTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const balance = income - expense;

  const periodLabels = { week: 'за тиждень', month: 'за місяць', '3months': 'за 3 місяці' };
  document.getElementById('fin-summary-label').textContent = `Баланс ${periodLabels[currentFinPeriod]}`;
  document.getElementById('fin-total').textContent = (balance >= 0 ? '+' : '') + (balance % 1 === 0 ? balance : balance.toFixed(2)) + CURRENCY;
  document.getElementById('fin-total').style.color = balance >= 0 ? '#14532d' : '#7c2d12';
  document.getElementById('fin-budget-label').textContent = `Доходи: +${formatMoney(income)}`;
  document.getElementById('fin-budget-remain').textContent = `Витрати: -${formatMoney(expense)}`;
  document.getElementById('fin-budget-remain').style.color = '#c2410c';
  document.getElementById('fin-budget-bar-wrap').style.display = 'none';

  // Графік balance по днях
  renderFinChart(allTxs, 'balance');
  document.getElementById('fin-cats-block').style.display = 'none';
  document.getElementById('fin-cat-budgets-block').style.display = 'none';
  renderFinTransactions(allTxs);
}

function renderFinChart(txs, type) {
  const chartEl = document.getElementById('fin-chart');
  const labelEl = document.getElementById('fin-chart-label');
  const days = currentFinPeriod === 'week' ? 7 : currentFinPeriod === 'month' ? 30 : 90;
  const now = new Date();

  // Групуємо по дням
  const byDay = {};
  for (let i = 0; i < days; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() - (days - 1 - i));
    byDay[d.toDateString()] = 0;
  }
  txs.forEach(t => {
    const ds = new Date(t.ts).toDateString();
    if (ds in byDay) byDay[ds] += t.amount;
  });

  const vals = Object.values(byDay);
  const maxVal = Math.max(1, ...vals);
  const barColor = type === 'income' ? '#16a34a' : type === 'balance' ? '#6366f1' : '#f97316';
  const labelMap = { expense: 'Витрати по днях', income: 'Доходи по днях', balance: 'Баланс по днях' };
  labelEl.textContent = labelMap[type] || '';

  const showEvery = days > 30 ? 10 : days > 14 ? 5 : 1;
  chartEl.innerHTML = vals.map((v, i) => {
    const h = Math.max(3, Math.round(v / maxVal * 60));
    const isToday = i === days - 1;
    return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:2px">
      <div style="width:100%;height:${h}px;background:${isToday ? barColor : barColor + '88'};border-radius:3px 3px 0 0"></div>
    </div>`;
  }).join('');
}

function renderFinCategories(txs, type) {
  const catEl = document.getElementById('fin-categories');
  const total = txs.reduce((s, t) => s + t.amount, 0) || 1;
  const catMap = {};
  txs.forEach(t => { catMap[t.category] = (catMap[t.category] || 0) + t.amount; });
  const sorted = Object.entries(catMap).sort((a, b) => b[1] - a[1]);
  if (sorted.length === 0) {
    catEl.innerHTML = '<div style="font-size:14px;color:rgba(30,16,64,0.3);text-align:center;padding:8px">Немає даних</div>';
    return;
  }
  catEl.innerHTML = sorted.map(([cat, amt], i) => {
    const pct = Math.round(amt / total * 100);
    const color = getFinColor(i);
    return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
      <div style="width:10px;height:10px;border-radius:50%;background:${color};flex-shrink:0"></div>
      <div style="font-size:13px;font-weight:700;color:rgba(30,16,64,0.6);min-width:80px">${escapeHtml(cat)}</div>
      <div style="flex:1;height:6px;background:rgba(0,0,0,0.05);border-radius:3px;overflow:hidden">
        <div style="height:100%;width:${pct}%;background:${color};border-radius:3px;transition:width 0.5s"></div>
      </div>
      <div style="font-size:13px;font-weight:700;color:rgba(30,16,64,0.5);min-width:52px;text-align:right">${formatMoney(amt)}</div>
    </div>`;
  }).join('');
}

function renderFinCatBudgets(txs) {
  const el = document.getElementById('fin-cat-budgets');
  const budget = getFinBudget();
  const cats = getFinCats();
  const catMap = {};
  txs.forEach(t => { catMap[t.category] = (catMap[t.category] || 0) + t.amount; });

  if (!budget.categories || Object.keys(budget.categories).length === 0) {
    el.innerHTML = '<div style="font-size:13px;color:rgba(30,16,64,0.35);text-align:center;padding:4px">Ліміти не встановлені. Натисни ✎ щоб задати.</div>';
    return;
  }
  el.innerHTML = Object.entries(budget.categories).map(([cat, limit]) => {
    if (!limit) return '';
    const spent = catMap[cat] || 0;
    const pct = Math.min(100, Math.round(spent / limit * 100));
    const color = pct >= 100 ? '#dc2626' : pct >= 80 ? '#f97316' : '#16a34a';
    const remain = limit - spent;
    return `<div style="margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px">
        <span style="font-size:13px;font-weight:700;color:#1e1040">${escapeHtml(cat)}</span>
        <span style="font-size:12px;font-weight:600;color:${color}">${remain >= 0 ? `залишилось ${formatMoney(remain)}` : `перевищено на ${formatMoney(-remain)}`}</span>
      </div>
      <div style="height:5px;background:rgba(0,0,0,0.06);border-radius:3px;overflow:hidden">
        <div style="height:100%;width:${pct}%;background:${color};border-radius:3px;transition:width 0.5s"></div>
      </div>
      <div style="font-size:11px;color:rgba(30,16,64,0.35);margin-top:2px">${formatMoney(spent)} з ${formatMoney(limit)}</div>
    </div>`;
  }).filter(Boolean).join('');
}

function renderFinTransactions(txs) {
  const el = document.getElementById('fin-transactions');
  if (txs.length === 0) {
    el.innerHTML = '<div style="font-size:14px;color:rgba(30,16,64,0.3);text-align:center;padding:12px">Немає транзакцій за цей період</div>';
    return;
  }
  const sorted = [...txs].sort((a, b) => b.ts - a.ts).slice(0, 50);
  el.innerHTML = sorted.map(t => {
    const isExpense = t.type === 'expense';
    const sign = isExpense ? '-' : '+';
    const color = isExpense ? '#c2410c' : '#16a34a';
    const date = new Date(t.ts);
    const dateStr = date.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' });
    return `<div style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid rgba(30,16,64,0.05)" onclick="openEditTransaction(${t.id})">
      <div style="flex:1;min-width:0">
        <div style="font-size:14px;font-weight:600;color:#1e1040">${escapeHtml(t.category)}</div>
        ${t.comment ? `<div style="font-size:12px;color:rgba(30,16,64,0.4);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(t.comment)}</div>` : ''}
      </div>
      <div style="text-align:right;flex-shrink:0">
        <div style="font-size:15px;font-weight:800;color:${color}">${sign}${formatMoney(t.amount)}</div>
        <div style="font-size:11px;color:rgba(30,16,64,0.35)">${dateStr}</div>
      </div>
    </div>`;
  }).join('');
}

// Додавання транзакції вручну
let _finEditId = null;

function openAddTransaction(prefill = {}) {
  _finEditId = null;
  const cats = getFinCats();
  const type = prefill.type || (currentFinTab === 'income' ? 'income' : 'expense');
  _showTransactionModal({ type, amount: prefill.amount || '', category: prefill.category || '', comment: prefill.comment || '' });
}

function openEditTransaction(id) {
  const txs = getFinance();
  const t = txs.find(x => x.id === id);
  if (!t) return;
  _finEditId = id;
  _showTransactionModal(t);
}

function _showTransactionModal(data) {
  const cats = getFinCats();
  const isExpense = data.type !== 'income';
  const catList = isExpense ? cats.expense : cats.income;

  const existing = document.getElementById('fin-tx-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'fin-tx-modal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:500;display:flex;align-items:flex-end;justify-content:center';
  modal.innerHTML = `
    <div onclick="closeFinTxModal()" style="position:absolute;inset:0;background:rgba(10,5,30,0.35);backdrop-filter:blur(2px)"></div>
    <div style="position:relative;width:100%;max-width:480px;background:rgba(255,255,255,0.88);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);border-radius:24px;margin:0 16px 16px;z-index:1;border:1.5px solid rgba(255,255,255,0.6);padding:16px 20px calc(env(safe-area-inset-bottom)+24px);box-sizing:border-box">
      <div style="width:36px;height:4px;background:rgba(0,0,0,0.1);border-radius:2px;margin:0 auto 14px"></div>
      <div style="font-size:17px;font-weight:800;color:#1e1040;margin-bottom:14px">${_finEditId ? 'Редагувати' : 'Нова'} ${isExpense ? 'витрата' : 'дохід'}</div>

      <!-- Тип -->
      <div style="display:flex;gap:6px;margin-bottom:12px">
        <button id="fntx-btn-expense" onclick="toggleFinTxType('expense')" style="flex:1;padding:8px;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;border:1.5px solid ${isExpense ? '#c2410c' : 'rgba(30,16,64,0.1)'};background:${isExpense ? 'rgba(194,65,12,0.08)' : 'white'};color:${isExpense ? '#c2410c' : 'rgba(30,16,64,0.4)'}">Витрата</button>
        <button id="fntx-btn-income" onclick="toggleFinTxType('income')" style="flex:1;padding:8px;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;border:1.5px solid ${!isExpense ? '#16a34a' : 'rgba(30,16,64,0.1)'};background:${!isExpense ? 'rgba(22,163,74,0.08)' : 'white'};color:${!isExpense ? '#16a34a' : 'rgba(30,16,64,0.4)'}">Дохід</button>
      </div>

      <!-- Сума -->
      <input id="fntx-amount" type="number" placeholder="Сума (€)" inputmode="decimal"
        style="width:100%;border:1.5px solid rgba(30,16,64,0.12);border-radius:12px;padding:12px 14px;font-size:20px;font-weight:700;font-family:inherit;color:#1e1040;outline:none;margin-bottom:10px;box-sizing:border-box"
        value="${data.amount || ''}">

      <!-- Категорія -->
      <div id="fntx-cats-wrap" style="margin-bottom:10px">
        <div style="font-size:12px;font-weight:700;color:rgba(30,16,64,0.4);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px">Категорія</div>
        <div id="fntx-cats" style="display:flex;flex-wrap:wrap;gap:6px">
          ${catList.map(c => `<button onclick="selectFinTxCat('${escapeHtml(c)}')" id="fntx-cat-${escapeHtml(c)}" style="padding:6px 12px;border-radius:20px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;border:1.5px solid ${c === data.category ? '#c2410c' : 'rgba(30,16,64,0.1)'};background:${c === data.category ? 'rgba(194,65,12,0.08)' : 'white'};color:${c === data.category ? '#c2410c' : 'rgba(30,16,64,0.5)'}">${escapeHtml(c)}</button>`).join('')}
        </div>
        <input id="fntx-cat-custom" type="text" placeholder="або своя категорія…"
          style="width:100%;border:1.5px solid rgba(30,16,64,0.1);border-radius:10px;padding:8px 12px;font-size:14px;font-family:inherit;color:#1e1040;outline:none;margin-top:8px;box-sizing:border-box"
          value="${catList.includes(data.category) ? '' : (data.category || '')}">
      </div>

      <!-- Коментар -->
      <input id="fntx-comment" type="text" placeholder="Коментар (необовʼязково)"
        style="width:100%;border:1.5px solid rgba(30,16,64,0.1);border-radius:12px;padding:10px 14px;font-size:15px;font-family:inherit;color:#1e1040;outline:none;margin-bottom:14px;box-sizing:border-box"
        value="${data.comment || ''}">

      <div style="display:flex;gap:8px">
        ${_finEditId ? `<button onclick="deleteFinTransaction()" style="padding:13px 16px;border-radius:12px;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);font-size:15px;font-weight:700;color:#dc2626;cursor:pointer;font-family:inherit">🗑</button>` : ''}
        <button onclick="closeFinTxModal()" style="flex:1;padding:13px;border-radius:12px;background:rgba(30,16,64,0.06);border:none;font-size:15px;font-weight:700;color:rgba(30,16,64,0.5);cursor:pointer;font-family:inherit">Скасувати</button>
        <button onclick="saveFinTransaction()" style="flex:2;padding:13px;border-radius:12px;background:linear-gradient(135deg,#f97316,#c2410c);border:none;font-size:15px;font-weight:700;color:white;cursor:pointer;font-family:inherit">Зберегти</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  setupModalSwipeClose(modal.querySelector('div:last-child'), closeFinTxModal);
  // Якщо категорія вже вибрана — показуємо підкатегорії
  if (data.category && catList.includes(data.category)) {
    setTimeout(() => selectFinTxCat(data.category), 50);
  }
  setTimeout(() => { document.getElementById('fntx-amount')?.focus(); }, 300);
  _finTxCurrentType = isExpense ? 'expense' : 'income';
  _finTxSelectedCat = data.category || '';
}

let _finTxCurrentType = 'expense';
let _finTxSelectedCat = '';

function toggleFinTxType(type) {
  _finTxCurrentType = type;
  const isExpense = type === 'expense';
  const cats = getFinCats();
  const catList = isExpense ? cats.expense : cats.income;

  const btnE = document.getElementById('fntx-btn-expense');
  const btnI = document.getElementById('fntx-btn-income');
  if (btnE) { btnE.style.borderColor = isExpense ? '#c2410c' : 'rgba(30,16,64,0.1)'; btnE.style.background = isExpense ? 'rgba(194,65,12,0.08)' : 'white'; btnE.style.color = isExpense ? '#c2410c' : 'rgba(30,16,64,0.4)'; }
  if (btnI) { btnI.style.borderColor = !isExpense ? '#16a34a' : 'rgba(30,16,64,0.1)'; btnI.style.background = !isExpense ? 'rgba(22,163,74,0.08)' : 'white'; btnI.style.color = !isExpense ? '#16a34a' : 'rgba(30,16,64,0.4)'; }

  _finTxSelectedCat = '';
  const catsEl = document.getElementById('fntx-cats');
  if (catsEl) catsEl.innerHTML = catList.map(c => `<button onclick="selectFinTxCat('${escapeHtml(c)}')" id="fntx-cat-${escapeHtml(c)}" style="padding:6px 12px;border-radius:20px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;border:1.5px solid rgba(30,16,64,0.1);background:white;color:rgba(30,16,64,0.5)">${escapeHtml(c)}</button>`).join('');
}

function selectFinTxCat(cat) {
  // Якщо це підкатегорія — просто зберігаємо
  const cats = getFinCats();
  const catList = _finTxCurrentType === 'expense' ? cats.expense : cats.income;
  const isSubcat = !catList.includes(cat);

  if (isSubcat) {
    _finTxSelectedCat = cat;
    // Підсвічуємо підкатегорію
    const subEl = document.getElementById('fntx-subcats');
    if (subEl) subEl.querySelectorAll('button').forEach(btn => {
      const active = btn.textContent === cat;
      btn.style.borderColor = active ? '#c2410c' : 'rgba(30,16,64,0.08)';
      btn.style.background = active ? 'rgba(194,65,12,0.08)' : 'rgba(30,16,64,0.03)';
      btn.style.color = active ? '#c2410c' : 'rgba(30,16,64,0.45)';
    });
    const customInput = document.getElementById('fntx-cat-custom');
    if (customInput) customInput.value = '';
    return;
  }

  _finTxSelectedCat = cat;

  // Підсвічуємо головну категорію
  const catsEl = document.getElementById('fntx-cats');
  if (catsEl) catsEl.querySelectorAll('button').forEach(btn => {
    const active = btn.textContent === cat;
    btn.style.borderColor = active ? '#c2410c' : 'rgba(30,16,64,0.1)';
    btn.style.background = active ? 'rgba(194,65,12,0.08)' : 'white';
    btn.style.color = active ? '#c2410c' : 'rgba(30,16,64,0.5)';
  });

  // Показуємо підкатегорії якщо є
  const subcats = FIN_SUBCATS[cat];
  let subEl = document.getElementById('fntx-subcats');
  if (subcats && subcats.length > 0) {
    if (!subEl) {
      subEl = document.createElement('div');
      subEl.id = 'fntx-subcats';
      subEl.style.cssText = 'display:flex;flex-wrap:wrap;gap:5px;margin-top:8px;padding-top:8px;border-top:1px solid rgba(30,16,64,0.06)';
      const catsWrapper = document.getElementById('fntx-cats-wrap');
      if (catsWrapper) catsWrapper.appendChild(subEl);
      else catsEl?.parentNode?.insertBefore(subEl, catsEl?.nextSibling);
    }
    subEl.innerHTML = subcats.map(s =>
      `<button onclick="selectFinTxCat('${escapeHtml(s)}')" style="padding:5px 11px;border-radius:16px;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;border:1.5px solid rgba(30,16,64,0.08);background:rgba(30,16,64,0.03);color:rgba(30,16,64,0.45);transition:all 0.15s">${escapeHtml(s)}</button>`
    ).join('');
    subEl.style.display = 'flex';
  } else if (subEl) {
    subEl.style.display = 'none';
  }

  const customInput = document.getElementById('fntx-cat-custom');
  if (customInput) customInput.value = '';
}

function saveFinTransaction() {
  const amountRaw = parseFloat(document.getElementById('fntx-amount')?.value || '0');
  if (!amountRaw || amountRaw <= 0) { showToast('Введи суму'); return; }

  const customCat = document.getElementById('fntx-cat-custom')?.value.trim();
  const category = customCat || _finTxSelectedCat;
  if (!category) { showToast('Вибери категорію'); return; }

  const comment = document.getElementById('fntx-comment')?.value.trim() || '';
  const txs = getFinance();

  // Перевіряємо чи нова категорія
  const cats = getFinCats();
  const catList = _finTxCurrentType === 'expense' ? cats.expense : cats.income;
  if (customCat && !catList.includes(customCat)) {
    cats[_finTxCurrentType].push(customCat);
    saveFinCats(cats);
  }

  if (_finEditId) {
    const idx = txs.findIndex(x => x.id === _finEditId);
    if (idx !== -1) txs[idx] = { ...txs[idx], amount: amountRaw, category, comment, type: _finTxCurrentType };
  } else {
    txs.unshift({ id: Date.now(), type: _finTxCurrentType, amount: amountRaw, category, comment, ts: Date.now() });
  }
  saveFinance(txs);
  closeFinTxModal();
  renderFinance();
  showToast(_finEditId ? '✓ Оновлено' : `✓ ${_finTxCurrentType === 'expense' ? 'Витрату' : 'Дохід'} збережено`);
  _finEditId = null;
}

function deleteFinTransaction() {
  if (!_finEditId) return;
  const item = getFinance().find(t => t.id === _finEditId);
  saveFinance(getFinance().filter(t => t.id !== _finEditId));
  closeFinTxModal();
  renderFinance();
  if (item) showUndoToast('Транзакцію видалено', () => {
    const txs = getFinance(); txs.unshift(item); saveFinance(txs); renderFinance();
  });
  _finEditId = null;
}

function closeFinTxModal() {
  document.getElementById('fin-tx-modal')?.remove();
}

// Модал бюджету
function openFinBudgetModal() {
  const budget = getFinBudget();
  const cats = getFinCats();

  const existing = document.getElementById('fin-budget-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'fin-budget-modal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:500;display:flex;align-items:flex-end;justify-content:center';
  modal.innerHTML = `
    <div onclick="closeFinBudgetModal()" style="position:absolute;inset:0;background:rgba(10,5,30,0.35);backdrop-filter:blur(2px)"></div>
    <div style="position:relative;width:100%;max-width:480px;background:rgba(255,255,255,0.88);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);border-radius:24px;margin:0 16px 16px;z-index:1;border:1.5px solid rgba(255,255,255,0.6);padding:16px 20px calc(env(safe-area-inset-bottom)+24px);max-height:80vh;overflow-y:auto;box-sizing:border-box">
      <div style="width:36px;height:4px;background:rgba(0,0,0,0.1);border-radius:2px;margin:0 auto 14px"></div>
      <div style="font-size:17px;font-weight:800;color:#1e1040;margin-bottom:14px">Бюджет на місяць</div>

      <div style="font-size:12px;font-weight:700;color:rgba(30,16,64,0.4);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px">Загальний ліміт</div>
      <input id="finbdg-total" type="number" placeholder="€ 0 — без ліміту" inputmode="decimal"
        style="width:100%;border:1.5px solid rgba(30,16,64,0.12);border-radius:12px;padding:11px 14px;font-size:17px;font-weight:700;font-family:inherit;color:#1e1040;outline:none;margin-bottom:14px;box-sizing:border-box"
        value="${budget.total || ''}">

      <div style="font-size:12px;font-weight:700;color:rgba(30,16,64,0.4);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px">По категоріях</div>
      <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px">
        ${cats.expense.map(cat => `
          <div style="display:flex;align-items:center;gap:10px">
            <div style="font-size:14px;font-weight:600;color:#1e1040;flex:1">${escapeHtml(cat)}</div>
            <input type="number" id="finbdg-cat-${escapeHtml(cat)}" placeholder="без ліміту" inputmode="decimal"
              style="width:100px;border:1.5px solid rgba(30,16,64,0.1);border-radius:10px;padding:7px 10px;font-size:14px;font-family:inherit;color:#1e1040;outline:none;text-align:right"
              value="${budget.categories?.[cat] || ''}">
          </div>`).join('')}
      </div>

      <div style="display:flex;gap:8px">
        <button onclick="closeFinBudgetModal()" style="flex:1;padding:13px;border-radius:12px;background:rgba(30,16,64,0.06);border:none;font-size:15px;font-weight:700;color:rgba(30,16,64,0.5);cursor:pointer;font-family:inherit">Скасувати</button>
        <button onclick="saveFinBudgetFromModal()" style="flex:2;padding:13px;border-radius:12px;background:linear-gradient(135deg,#f97316,#c2410c);border:none;font-size:15px;font-weight:700;color:white;cursor:pointer;font-family:inherit">Зберегти</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
}

function saveFinBudgetFromModal() {
  const cats = getFinCats();
  const total = parseFloat(document.getElementById('finbdg-total')?.value || '0') || 0;
  const categories = {};
  cats.expense.forEach(cat => {
    const val = parseFloat(document.getElementById(`finbdg-cat-${cat}`)?.value || '0') || 0;
    if (val > 0) categories[cat] = val;
  });
  saveFinBudget({ total, categories });
  closeFinBudgetModal();
  renderFinance();
  showToast('✓ Бюджет збережено');
}

function closeFinBudgetModal() {
  document.getElementById('fin-budget-modal')?.remove();
}

// Обробка фінансів з Inbox
function processFinanceAction(parsed, originalText) {
  const cats = getFinCats();
  const type = parsed.fin_type || 'expense';
  const amount = parseFloat(parsed.amount) || 0;
  const category = parsed.category || (type === 'expense' ? 'Інше' : 'Інше');
  const comment = parsed.comment || originalText;

  if (!amount || amount <= 0) {
    addInboxChatMsg('agent', 'Не вдалось розпізнати суму. Спробуй написати чіткіше: "витратив 50 на їжу"');
    return;
  }

  // Нова категорія — зберігаємо без запиту (агент вже підтвердив)
  const catList = type === 'expense' ? cats.expense : cats.income;
  if (!catList.includes(category)) {
    catList.push(category);
    saveFinCats(cats);
  }

  const txs = getFinance();
  txs.unshift({ id: Date.now(), type, amount, category, comment, ts: Date.now() });
  saveFinance(txs);

  // Зберігаємо в Inbox для історії
  const items = getInbox();
  items.unshift({ id: Date.now(), text: originalText, category: 'finance', ts: Date.now(), processed: true });
  saveInbox(items);
  renderInbox();

  if (currentTab === 'finance') renderFinance();

  const sign = type === 'expense' ? '-' : '+';
  const typeLabel = type === 'expense' ? 'витрату' : 'дохід';
  addInboxChatMsg('agent', `${sign}${formatMoney(amount)} · ${category}${parsed.fin_comment ? ' — ' + parsed.fin_comment : ''}`);

  // Попередження про перевищення бюджету
  checkFinBudgetWarning(type, category, amount);
}

function checkFinBudgetWarning(type, category, amount) {
  if (type !== 'expense') return;
  const budget = getFinBudget();
  const from = getFinPeriodRange('month');
  const txs = getFinance().filter(t => t.type === 'expense' && t.ts >= from);
  const totalSpent = txs.reduce((s, t) => s + t.amount, 0);

  // Загальний ліміт
  if (budget.total > 0) {
    const pct = totalSpent / budget.total;
    if (pct >= 1) addInboxChatMsg('agent', `⚠️ Загальний бюджет на місяць перевищено. Витрачено ${formatMoney(totalSpent)} з ${formatMoney(budget.total)}.`);
    else if (pct >= 0.8) addInboxChatMsg('agent', `💡 До ліміту місяця залишилось ${formatMoney(budget.total - totalSpent)}.`);
  }

  // Категорійний ліміт
  const catLimit = budget.categories?.[category];
  if (catLimit > 0) {
    const catSpent = txs.filter(t => t.category === category).reduce((s, t) => s + t.amount, 0);
    const pct = catSpent / catLimit;
    if (pct >= 1) addInboxChatMsg('agent', `⚠️ Ліміт по "${category}" перевищено: ${formatMoney(catSpent)} з ${formatMoney(catLimit)}.`);
    else if (pct >= 0.8) addInboxChatMsg('agent', `💡 По "${category}" залишилось ${formatMoney(catLimit - catSpent)}.`);
  }
}

// Finance контекст для getAIContext
function getFinanceContext() {
  const today = new Date().toDateString();
  const from = getFinPeriodRange('month');
  const txs = getFinance().filter(t => t.ts >= from);
  if (txs.length === 0) return '';

  const expenses = txs.filter(t => t.type === 'expense');
  const incomes = txs.filter(t => t.type === 'income');
  const totalExp = expenses.reduce((s, t) => s + t.amount, 0);
  const totalInc = incomes.reduce((s, t) => s + t.amount, 0);
  const budget = getFinBudget();

  const catMap = {};
  expenses.forEach(t => { catMap[t.category] = (catMap[t.category] || 0) + t.amount; });
  const top3 = Object.entries(catMap).sort((a,b) => b[1]-a[1]).slice(0,3).map(([c,a]) => `${c}: ${formatMoney(a)}`).join(', ');

  const todayTxs = txs.filter(t => new Date(t.ts).toDateString() === today);
  const todaySum = todayTxs.filter(t => t.type === 'expense').reduce((s,t) => s+t.amount, 0);

  let parts = [`Фінанси (місяць): витрати ${formatMoney(totalExp)}, доходи ${formatMoney(totalInc)}`];
  if (budget.total > 0) parts.push(`бюджет ${formatMoney(budget.total)}, залишилось ${formatMoney(budget.total - totalExp)}`);
  if (top3) parts.push(`топ категорії: ${top3}`);
  if (todaySum > 0) parts.push(`сьогодні витрачено ${formatMoney(todaySum)}`);

  // Останні 5 транзакцій з ID — для update_transaction з Inbox
  const recentTxs = txs.slice(0, 5).map(t => `[ID:${t.id}] ${t.type === 'expense' ? '-' : '+'}${t.amount}${getCurrency()} ${t.category}${t.comment ? ' ('+t.comment+')' : ''}`).join('; ');
  if (recentTxs) parts.push(`Останні транзакції (використовуй ID для update_transaction): ${recentTxs}`);

  return parts.join('\n');
}

// === FINANCE AI BAR ===
let financeBarHistory = [];
let financeBarLoading = false;

function addFinanceChatMsg(role, text, _noSave = false) {
  const el = document.getElementById('finance-chat-messages');
  if (!el) return;
  if (_financeTypingEl) { _financeTypingEl.remove(); _financeTypingEl = null; }
  if (role === 'typing') {
    const td = document.createElement('div');
    td.style.cssText = 'display:flex';
    td.innerHTML = '<div style="background:rgba(255,255,255,0.12);border-radius:4px 12px 12px 12px;padding:5px 10px"><div class=\"ai-typing\"><span></span><span></span><span></span></div></div>';
    el.appendChild(td);
    _financeTypingEl = td;
    el.scrollTop = el.scrollHeight;
    return;
  }
  try { openChatBar('finance'); } catch(e) {}
  const isAgent = role === 'agent';
  const div = document.createElement('div');
  div.style.cssText = `display:flex;${isAgent ? '' : 'justify-content:flex-end'}`;
  div.innerHTML = `<div style="max-width:85%;background:${isAgent ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.88)'};color:${isAgent ? 'white' : '#1e1040'};border-radius:${isAgent ? '4px 12px 12px 12px' : '12px 4px 12px 12px'};padding:8px 12px;font-size:15px;line-height:1.5;font-weight:500">${escapeHtml(text).replace(/\n/g,'<br>')}</div>`;
  el.appendChild(div);
  el.scrollTop = el.scrollHeight;
  if (role !== 'agent') financeBarHistory.push({ role: 'user', content: text });
  else financeBarHistory.push({ role: 'assistant', content: text });
  if (!_noSave) saveChatMsg('finance', role, text);
}

async function sendFinanceBarMessage() {
  if (financeBarLoading) return;
  const input = document.getElementById('finance-bar-input');
  const text = input.value.trim();
  if (!text) return;
  const key = localStorage.getItem('nm_gemini_key');
  if (!key) { addFinanceChatMsg('agent', 'Введи OpenAI ключ в налаштуваннях.'); return; }
  input.value = ''; input.style.height = 'auto';
  input.focus();
  addFinanceChatMsg('user', text);
  financeBarLoading = true;
  addFinanceChatMsg('typing', '');

  const from = getFinPeriodRange('month');
  const txs = getFinance().filter(t => t.ts >= from);
  const budget = getFinBudget();
  const cats = getFinCats();
  const aiContext = getAIContext();

  const FINANCE_BAR_PROMPT = `${getOWLPersonality()} Ти допомагаєш з фінансами. Відповіді — 1-3 речення, конкретно.
Валюта: ${getCurrency()}. Поточний місяць.
Транзакції (до 20 останніх): ${txs.slice(0,20).map(t=>`[${t.type}] ${t.category} ${t.amount}${getCurrency()} ${t.comment||''}`).join('; ') || 'немає'}
Загальний бюджет: ${budget.total ? budget.total+getCurrency() : 'не встановлено'}
Категорії витрат: ${cats.expense.join(', ')}
Приклади: Їжа(кава,ресторан,продукти), Транспорт(бензин,таксі,Uber), Підписки(Netflix,Spotify), Здоровʼя(аптека,лікар), Житло(оренда,комуналка), Покупки(одяг,техніка), Трава(джоінт,канабіс)
Категорії доходів: ${cats.income.join(', ')}
Якщо є сумнів — обирай найближчу категорію, НЕ "Інше".

Ти можеш виконувати дії через JSON (відповідай ТІЛЬКИ JSON якщо потрібна дія):
{"action":"save_expense","amount":50,"category":"Їжа","comment":"продукти"}
{"action":"save_income","amount":3000,"category":"Зарплата","comment":""}
{"action":"delete_transaction","id":1234567890}
{"action":"update_transaction","id":1234567890,"category":"Транспорт","comment":"заправка"}
{"action":"set_budget","total":2000,"categories":{"Їжа":400}}
{"action":"create_category","type":"expense","name":"Нова категорія"}

Якщо користувач просить змінити категорію або опис існуючої транзакції — використовуй update_transaction з її id. НЕ створюй нову транзакцію і НЕ видаляй стару окремо.
ВАЖЛИВО: НЕ вигадуй ліміти, бюджети або плани яких немає в даних вище. Якщо бюджет "не встановлено" — не згадуй перевищення. Тільки реальні цифри.
Також вмієш: створити задачу {"action":"create_task","title":"назва","steps":[]}, звичку {"action":"create_habit","name":"назва","days":[0,1,2,3,4,5,6]}, нотатку {"action":"create_note","text":"текст","folder":null}.${aiContext ? '\n\n' + aiContext : ''}`;

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'system', content: FINANCE_BAR_PROMPT }, ...financeBarHistory.slice(-10)], max_tokens: 300, temperature: 0.5 })
    });
    const data = await res.json();
    const reply = data.choices?.[0]?.message?.content?.trim();
    if (!reply) { addFinanceChatMsg('agent', 'Щось пішло не так.'); financeBarLoading = false; return; }

    // Спробуємо JSON дію
    try {
      const jsonMatch = reply.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : reply);
      if (processUniversalAction(parsed, text, addFinanceChatMsg)) {
        // оброблено універсально
      } else if (parsed.action === 'save_expense' || parsed.action === 'save_income') {
        const type = parsed.action === 'save_expense' ? 'expense' : 'income';
        const txs2 = getFinance();
        txs2.unshift({ id: Date.now(), type, amount: parseFloat(parsed.amount), category: parsed.category || 'Інше', comment: parsed.comment || '', ts: Date.now() });
        saveFinance(txs2);
        renderFinance();
        addFinanceChatMsg('agent', `✓ ${type === 'expense' ? '-' : '+'}${formatMoney(parsed.amount)} · ${parsed.category}`);
        checkFinBudgetWarning(type, parsed.category, parseFloat(parsed.amount));
      } else if (parsed.action === 'delete_transaction') {
        const item = getFinance().find(t => t.id === parsed.id);
        const _item = getFinance().find(t => t.id === parsed.id);
      if (_item) addToTrash('finance', _item);
      saveFinance(getFinance().filter(t => t.id !== parsed.id));
        renderFinance();
        addFinanceChatMsg('agent', `🗑 Видалено: ${item ? item.category + ' ' + formatMoney(item.amount) : 'транзакцію'}`);
      } else if (parsed.action === 'update_transaction') {
        const txs2 = getFinance();
        const idx = txs2.findIndex(t => t.id === parsed.id);
        if (idx !== -1) {
          if (parsed.category) txs2[idx].category = parsed.category;
          if (parsed.comment !== undefined) txs2[idx].comment = parsed.comment;
          if (parsed.amount) txs2[idx].amount = parseFloat(parsed.amount);
          saveFinance(txs2);
          renderFinance();
          addFinanceChatMsg('agent', `✓ Оновлено: ${txs2[idx].category} ${formatMoney(txs2[idx].amount)}`);
        } else {
          addFinanceChatMsg('agent', 'Транзакцію не знайдено.');
        }
      } else if (parsed.action === 'set_budget') {
        const bdg = getFinBudget();
        if (parsed.total) bdg.total = parsed.total;
        if (parsed.categories) Object.assign(bdg.categories, parsed.categories);
        saveFinBudget(bdg);
        renderFinance();
        addFinanceChatMsg('agent', '✓ Бюджет оновлено');
      } else if (parsed.action === 'create_category') {
        const c = getFinCats();
        const list = parsed.type === 'income' ? c.income : c.expense;
        if (!list.includes(parsed.name)) { list.push(parsed.name); saveFinCats(c); }
        renderFinance();
        addFinanceChatMsg('agent', `✓ Категорію "${parsed.name}" додано`);
      } else {
        addFinanceChatMsg('agent', reply);
      }
    } catch {
      addFinanceChatMsg('agent', reply);
    }
  } catch { addFinanceChatMsg('agent', 'Мережева помилка.'); }
  financeBarLoading = false;
}

// === EVENING AI BAR ===
let eveningBarHistory = [];
let eveningBarLoading = false;

function showEveningBarMessages() {
  openChatBar('evening');
}

function addEveningBarMsg(role, text, _noSave = false) {
  const el = document.getElementById('evening-bar-messages');
  if (!el) return;
  if (_eveningTypingEl) { _eveningTypingEl.remove(); _eveningTypingEl = null; }
  if (role === 'typing') {
    const td = document.createElement('div');
    td.style.cssText = 'display:flex';
    td.innerHTML = '<div style="background:rgba(255,255,255,0.12);border-radius:4px 12px 12px 12px;padding:5px 10px"><div class=\"ai-typing\"><span></span><span></span><span></span></div></div>';
    el.appendChild(td);
    _eveningTypingEl = td;
    el.scrollTop = el.scrollHeight;
    return;
  }
  try { openChatBar('evening'); } catch(e) {}
  const isAgent = role === 'agent';
  const div = document.createElement('div');
  div.style.cssText = `display:flex;${isAgent ? '' : 'justify-content:flex-end'}`;
  div.innerHTML = `<div style="max-width:85%;background:${isAgent ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.88)'};color:${isAgent ? 'white' : '#1e1040'};border-radius:${isAgent ? '4px 12px 12px 12px' : '12px 4px 12px 12px'};padding:8px 11px;font-size:13px;line-height:1.5;font-weight:500">${escapeHtml(text)}</div>`;
  el.appendChild(div);
  el.scrollTop = el.scrollHeight;
  if (role !== 'agent') eveningBarHistory.push({ role: 'user', content: text });
  if (!_noSave) saveChatMsg('evening', role, text);
}

async function sendEveningBarMessage() {
  if (eveningBarLoading) return;
  const input = document.getElementById('evening-bar-input');
  const text = input.value.trim();
  if (!text) return;
  const key = localStorage.getItem('nm_gemini_key');
  if (!key) { addEveningBarMsg('agent', 'Введи OpenAI ключ в налаштуваннях.'); return; }
  input.value = ''; input.style.height = 'auto';
  input.focus(); // утримуємо клавіатуру
  addEveningBarMsg('user', text);
  eveningBarLoading = true;
  addEveningBarMsg('typing', '');

  const today = new Date().toDateString();
  const moments = getMoments().filter(m => new Date(m.ts).toDateString() === today);
  const inbox = JSON.parse(localStorage.getItem('nm_inbox') || '[]').filter(i => new Date(i.ts).toDateString() === today);
  const todayNotes = JSON.parse(localStorage.getItem('nm_notes') || '[]').filter(n => new Date(n.ts || n.createdAt || 0).toDateString() === today);
  const aiContext = getAIContext();
  const systemPrompt = `${getOWLPersonality()} Короткі відповіді (1-3 речення).
Моменти дня: ${moments.map(m=>`[${m.mood}] ${m.text}`).join('; ') || 'не додані'}.
Нотатки сьогодні: ${todayNotes.map(n=>n.title||n.text||'').join('; ') || 'немає'}.
Всі записи: ${inbox.map(i=>`[${i.category}] ${i.text}`).join('; ') || 'немає'}.
Якщо треба зберегти запис — відповідай JSON:
- Нотатка: {"action":"create_note","text":"текст","folder":null}
- Задача: {"action":"create_task","title":"назва","steps":[]}
- Звичка: {"action":"create_habit","name":"назва","days":[0,1,2,3,4,5,6]}
- Витрата: {"action":"save_finance","fin_type":"expense","amount":число,"category":"категорія","comment":"текст"}
- Дохід: {"action":"save_finance","fin_type":"income","amount":число,"category":"категорія","comment":"текст"}
Інакше — текст українською 1-3 речення.
НЕ вигадуй ліміти, плани або факти яких немає в даних вище.${aiContext ? '\n\n' + aiContext : ''}`;

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'system', content: systemPrompt }, ...eveningBarHistory.slice(-10)], max_tokens: 300, temperature: 0.8 })
    });
    const data = await res.json();
    const reply = data.choices?.[0]?.message?.content?.trim();
    if (!reply) { addEveningBarMsg('agent', 'Щось пішло не так.'); eveningBarLoading = false; return; }

    try {
      const jsonMatch = reply.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : reply.replace(/```json|```/g,'').trim());
      if (!processUniversalAction(parsed, text, addEveningBarMsg)) {
        addEveningBarMsg('agent', reply);
      }
    } catch {
      addEveningBarMsg('agent', reply);
    }
    eveningBarHistory.push({ role: 'assistant', content: reply });
  } catch { addEveningBarMsg('agent', 'Мережева помилка.'); }
  eveningBarLoading = false;
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
  div.innerHTML = `<div style="max-width:85%;background:${isAgent ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.88)'};color:${isAgent ? 'white' : '#1e1040'};border-radius:${isAgent ? '4px 12px 12px 12px' : '12px 4px 12px 12px'};padding:8px 11px;font-size:13px;line-height:1.5;font-weight:500">${escapeHtml(text)}</div>`;
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

// === OWL BOARD ===
const OWL_BOARD_KEY = 'nm_owl_board';       // масив до 3 повідомлень
const OWL_BOARD_SEEN_KEY = 'nm_owl_board_seen'; // які ID вже показано
const OWL_BOARD_TS_KEY = 'nm_owl_board_ts'; // timestamp останньої генерації
const OWL_BOARD_INTERVAL = 3 * 60 * 1000;  // 3 хвилини

let _owlBoardSlide = 0;
let _owlBoardMessages = [];
let _owlBoardGenerating = false;
let _owlBoardTimer = null;

function getOwlBoardMessages() {
  try { return JSON.parse(localStorage.getItem(OWL_BOARD_KEY) || '[]'); } catch { return []; }
}
function saveOwlBoardMessages(arr) {
  localStorage.setItem(OWL_BOARD_KEY, JSON.stringify(arr.slice(-3)));
}

// === OWL BOARD — повний розумний цикл ===

// Ключ для антиповтору — що вже сказали сьогодні
const OWL_BOARD_SAID_KEY = 'nm_owl_board_said'; // {date, topics:[]}

function getOwlBoardSaid() {
  try {
    const s = JSON.parse(localStorage.getItem(OWL_BOARD_SAID_KEY) || '{}');
    if (s.date !== new Date().toDateString()) return { date: new Date().toDateString(), topics: [] };
    return s;
  } catch { return { date: new Date().toDateString(), topics: [] }; }
}
function markOwlBoardSaid(topic) {
  const s = getOwlBoardSaid();
  if (!s.topics.includes(topic)) s.topics.push(topic);
  localStorage.setItem(OWL_BOARD_SAID_KEY, JSON.stringify(s));
}
function owlAlreadySaid(topic) {
  return getOwlBoardSaid().topics.includes(topic);
}

// Перевірка чи є щось важливе — БЕЗ API
function checkOwlBoardTrigger() {
  const key = localStorage.getItem('nm_gemini_key');
  if (!key) return false;

  const now = new Date();
  const todayStr = now.toDateString();
  const hour = now.getHours();
  const min = now.getMinutes();

  // Тихий режим 23:00–7:00
  if (hour >= 23 || hour < 7) return false;

  // Ранковий огляд 7:00–9:00 — раз за ранок
  if (hour >= 7 && hour <= 9 && !owlAlreadySaid('morning_brief')) return true;

  // Обід 13:00 — статус дня, раз
  if (hour === 13 && min < 30 && !owlAlreadySaid('midday_check')) return true;

  // Вечірній підсумок 20:00 — раз
  if (hour >= 20 && !owlAlreadySaid('evening_prompt')) {
    const s = JSON.parse(localStorage.getItem('nm_evening_summary') || 'null');
    if (!s || new Date(s.date).toDateString() !== todayStr) return true;
  }

  // Понеділок вранці — огляд тижня
  if (now.getDay() === 1 && hour >= 8 && hour <= 10 && !owlAlreadySaid('week_start')) return true;

  // Пʼятниця ввечері — підсумок тижня
  if (now.getDay() === 5 && hour >= 17 && !owlAlreadySaid('week_end')) return true;

  // Дедлайн через ~годину — не повторювати для тієї ж задачі
  const tasks = getTasks().filter(t => t.status !== 'done');
  for (const t of tasks) {
    const m = t.title.match(/(\d{1,2}):(\d{2})/);
    if (m) {
      const diff = (parseInt(m[1])*60+parseInt(m[2])) - (hour*60+min);
      if (diff > 0 && diff <= 65 && !owlAlreadySaid('deadline_' + t.id)) return true;
    }
  }

  // Задача 3+ дні не закривається
  const now3d = Date.now() - 3*24*60*60*1000;
  const stuck = tasks.filter(t => t.createdAt && t.createdAt < now3d && !owlAlreadySaid('stuck_' + t.id));
  if (stuck.length > 0) return true;

  // Звички не виконані після 10:00
  if (hour >= 10) {
    const habits = getHabits();
    const log = getHabitLog();
    const todayLog = log[todayStr] || {};
    const pending = habits.filter(h => h.days.includes(now.getDay()) && !todayLog[h.id]);
    if (pending.length > 0 && !owlAlreadySaid('habits_' + todayStr)) return true;
  }

  // Стрік під загрозою після 20:00
  if (hour >= 20) {
    const habits = getHabits();
    const log = getHabitLog();
    const todayLog = log[todayStr] || {};
    const atRisk = habits.filter(h => h.days.includes(now.getDay()) && !todayLog[h.id]);
    if (atRisk.length > 0 && !owlAlreadySaid('streak_risk_' + todayStr)) return true;
  }

  // Всі звички виконані — привітати раз
  if (hour >= 10) {
    const habits = getHabits();
    const log = getHabitLog();
    const todayLog = log[todayStr] || {};
    const todayH = habits.filter(h => h.days.includes(now.getDay()));
    if (todayH.length > 0 && todayH.every(h => todayLog[h.id]) && !owlAlreadySaid('all_habits_done_' + todayStr)) return true;
  }

  // Бюджет 80%+ витрачено
  try {
    const budget = getFinBudget();
    if (budget.total > 0) {
      const from = getFinPeriodRange('month');
      const exp = getFinance().filter(t => t.ts >= from && t.type === 'expense').reduce((s,t) => s+t.amount, 0);
      const pct = exp / budget.total;
      if (pct >= 0.8 && !owlAlreadySaid('budget_80_' + new Date().toISOString().slice(0,7))) return true;
    }
  } catch(e) {}

  // Порожній день — немає нічого критичного, але треба щось показати
  const lastTs = parseInt(localStorage.getItem(OWL_BOARD_TS_KEY) || '0');
  const sinceLastH = (Date.now() - lastTs) / (60*60*1000);
  if (sinceLastH > 4 && !owlAlreadySaid('quiet_day_' + todayStr)) return true;

  return false;
}

// Будуємо контекст для табло з пріоритетами
function getOwlBoardContext() {
  const now = new Date();
  const todayStr = now.toDateString();
  const hour = now.getHours();
  const min = now.getMinutes();
  const weekDay = now.getDay(); // 0=нд, 1=пн...5=пт
  const critical = [];
  const important = [];
  const normal = [];

  const timeOfDay = hour < 12 ? 'ранок' : hour < 18 ? 'день' : 'вечір';
  normal.push(`Зараз ${timeOfDay}, ${now.toLocaleTimeString('uk-UA', {hour:'2-digit',minute:'2-digit'})}.`);

  // Задачі
  const tasks = getTasks();
  const activeTasks = tasks.filter(t => t.status !== 'done');

  // Дедлайн через ~годину
  const urgent = activeTasks.filter(t => {
    const m = t.title.match(/(\d{1,2}):(\d{2})/);
    if (!m) return false;
    const diff = (parseInt(m[1])*60+parseInt(m[2])) - (hour*60+min);
    return diff > 0 && diff <= 65;
  });
  urgent.forEach(t => {
    if (!owlAlreadySaid('deadline_' + t.id)) {
      critical.push(`[КРИТИЧНО] Дедлайн через ~годину: "${t.title}".`);
      markOwlBoardSaid('deadline_' + t.id);
    }
  });

  // Задача завʼязла 3+ дні
  const now3d = Date.now() - 3*24*60*60*1000;
  const stuck = activeTasks.filter(t => t.createdAt && t.createdAt < now3d);
  stuck.forEach(t => {
    if (!owlAlreadySaid('stuck_' + t.id)) {
      important.push(`[ВАЖЛИВО] Задача "${t.title}" відкрита вже 3+ дні.`);
      markOwlBoardSaid('stuck_' + t.id);
    }
  });

  if (activeTasks.length > 0) {
    normal.push(`Відкритих задач: ${activeTasks.length}. ${activeTasks.slice(0,3).map(t=>t.title).join(', ')}${activeTasks.length>3?' і ще...':''}.`);
  } else {
    normal.push('Всі задачі виконано.');
  }

  // Звички
  const habits = getHabits();
  const log = getHabitLog();
  const todayLog = log[todayStr] || {};
  const todayHabits = habits.filter(h => h.days.includes(now.getDay()));
  const doneHabits = todayHabits.filter(h => todayLog[h.id]);
  const pendingHabits = todayHabits.filter(h => !todayLog[h.id]);

  // Всі звички виконані — привітати
  if (todayHabits.length > 0 && pendingHabits.length === 0 && !owlAlreadySaid('all_habits_done_' + todayStr)) {
    important.push(`[ВАЖЛИВО] Всі ${todayHabits.length} звичок виконано сьогодні!`);
    markOwlBoardSaid('all_habits_done_' + todayStr);
  }

  // Стрік під загрозою після 20:00
  if (hour >= 20 && pendingHabits.length > 0 && !owlAlreadySaid('streak_risk_' + todayStr)) {
    const atRisk = pendingHabits.filter(h => {
      const allDays = Object.values(log);
      return allDays.filter(d => d[h.id]).length >= 3;
    });
    if (atRisk.length > 0) {
      critical.push(`[КРИТИЧНО] Стрік під загрозою: ${atRisk.map(h=>h.name).join(', ')}.`);
      markOwlBoardSaid('streak_risk_' + todayStr);
    }
  }

  // Звички не виконані після 10:00
  if (hour >= 10 && pendingHabits.length > 0 && !owlAlreadySaid('habits_' + todayStr)) {
    important.push(`[ВАЖЛИВО] Не виконано звичок: ${pendingHabits.map(h=>h.name).join(', ')}.`);
    markOwlBoardSaid('habits_' + todayStr);
  }

  if (todayHabits.length > 0) {
    normal.push(`Звички сьогодні: ${doneHabits.length}/${todayHabits.length}.`);
  }

  // Фінанси
  try {
    const budget = getFinBudget();
    if (budget.total > 0) {
      const from = getFinPeriodRange('month');
      const txs = getFinance().filter(t => t.ts >= from && t.type === 'expense');
      const exp = txs.reduce((s,t) => s+t.amount, 0);
      const pct = Math.round(exp/budget.total*100);
      const monthKey = new Date().toISOString().slice(0,7);
      if (exp > budget.total) {
        important.push(`[ВАЖЛИВО] Бюджет перевищено! Витрачено ${formatMoney(exp)} з ${formatMoney(budget.total)} (${pct}%).`);
      } else if (pct >= 80 && !owlAlreadySaid('budget_80_' + monthKey)) {
        important.push(`[ВАЖЛИВО] Витрачено ${pct}% місячного бюджету.`);
        markOwlBoardSaid('budget_80_' + monthKey);
      } else {
        normal.push(`Бюджет місяця: ${formatMoney(exp)} / ${formatMoney(budget.total)} (${pct}%).`);
      }

      // Незвична витрата — більше ніж вдвічі від середньої по категорії
      if (txs.length >= 3) {
        const bycat = {};
        txs.forEach(t => { if (!bycat[t.category]) bycat[t.category] = []; bycat[t.category].push(t.amount); });
        const lastTx = txs[0];
        if (lastTx && bycat[lastTx.category] && bycat[lastTx.category].length >= 2) {
          const avg = bycat[lastTx.category].reduce((a,b)=>a+b,0) / bycat[lastTx.category].length;
          if (lastTx.amount > avg * 2.5 && !owlAlreadySaid('unusual_tx_' + lastTx.id)) {
            important.push(`[ВАЖЛИВО] Незвична витрата: ${formatMoney(lastTx.amount)} на "${lastTx.category}" — вище звичного вдвічі.`);
            markOwlBoardSaid('unusual_tx_' + lastTx.id);
          }
        }
      }
    }
  } catch(e) {}

  // Ранковий огляд
  if (hour >= 7 && hour <= 9 && !owlAlreadySaid('morning_brief')) {
    normal.push(`[РАНОК] Початок дня. Налаштуй пріоритети.`);
    markOwlBoardSaid('morning_brief');
  }

  // Середина дня
  if (hour === 13 && min < 30 && !owlAlreadySaid('midday_check')) {
    normal.push(`[ОБІД] Середина дня — як справи?`);
    markOwlBoardSaid('midday_check');
  }

  // Вечір без підсумку
  if (hour >= 20 && !owlAlreadySaid('evening_prompt')) {
    const s = JSON.parse(localStorage.getItem('nm_evening_summary') || 'null');
    if (!s || new Date(s.date).toDateString() !== todayStr) {
      important.push('[ВАЖЛИВО] Вечір — підсумок дня ще не записано.');
      markOwlBoardSaid('evening_prompt');
    }
  }

  // Понеділок — огляд тижня
  if (weekDay === 1 && hour >= 8 && hour <= 10 && !owlAlreadySaid('week_start')) {
    normal.push('[ТИЖДЕНЬ] Новий тиждень. Огляд планів і відкритих задач.');
    markOwlBoardSaid('week_start');
  }

  // Пʼятниця — підсумок тижня
  if (weekDay === 5 && hour >= 17 && !owlAlreadySaid('week_end')) {
    const doneTasks = tasks.filter(t => t.status === 'done' && t.updatedAt && Date.now() - t.updatedAt < 7*24*60*60*1000);
    normal.push(`[ТИЖДЕНЬ] Кінець тижня. Закрито задач за тиждень: ${doneTasks.length}.`);
    markOwlBoardSaid('week_end');
  }

  // Порожній день — немає нічого критичного або важливого
  const lastTs = parseInt(localStorage.getItem(OWL_BOARD_TS_KEY) || '0');
  const sinceLastH = (Date.now() - lastTs) / (60*60*1000);
  if (critical.length === 0 && important.length === 0 && sinceLastH > 4 && !owlAlreadySaid('quiet_day_' + todayStr)) {
    normal.push('[СПОКІЙНИЙ ДЕНЬ] Немає нічого термінового. OWL може сказати щось мотивуюче або поставити коротке питання.');
    markOwlBoardSaid('quiet_day_' + todayStr);
  }

  return [...critical, ...important, ...normal].join(' ');
}

async function generateOwlBoardMessage() {
  if (_owlBoardGenerating) return;
  const key = localStorage.getItem('nm_gemini_key');
  if (!key) return;

  _owlBoardGenerating = true;

  const context = getOwlBoardContext();
  const existing = getOwlBoardMessages();

  // Список того що вже казали — щоб не повторювати
  const recentTexts = existing.map(m => m.text).join(' | ');

  const systemPrompt = getOWLPersonality() + `

Ти пишеш КОРОТКЕ проактивне повідомлення для табло в Inbox. Це НЕ відповідь на запит — це твоя ініціатива.

ПРІОРИТЕТ ПОВІДОМЛЕНЬ:
1. Якщо є [КРИТИЧНО] — пиши ТІЛЬКИ про це. Нічого іншого.
2. Якщо є [ВАЖЛИВО] і немає [КРИТИЧНО] — пиши про перше [ВАЖЛИВО].
3. Якщо є [СПОКІЙНИЙ ДЕНЬ] — скажи щось коротке в своєму характері: мотивацію, коротке питання про день, або просте спостереження. БЕЗ згадки задач і звичок якщо їх немає.
4. Інакше — обери найцікавіше зі звичайних даних.

ПРАВИЛА:
- Максимум 2 речення. Коротко і конкретно.
- Використовуй ТІЛЬКИ факти з контексту нижче. НЕ вигадуй ліміти, суми, плани або звички яких немає в даних.
- НЕ повторюй те що вже казав: "${recentTexts || 'нічого'}"
- Відповідай ТІЛЬКИ JSON: {"text":"повідомлення","priority":"critical|important|normal","chips":["чіп1","чіп2"]}
- chips — 2-3 конкретні факти або дії. Максимум 3 слова кожен. Якщо спокійний день — chips можуть бути порожнім масивом [].
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
    if (!reply) { _owlBoardGenerating = false; return; }

    const parsed = JSON.parse(reply.replace(/```json|```/g, '').trim());
    if (!parsed.text) { _owlBoardGenerating = false; return; }

    // Додаємо нове повідомлення, зберігаємо 3 останніх
    const msgs = getOwlBoardMessages();
    msgs.unshift({ id: Date.now(), text: parsed.text, priority: parsed.priority || 'normal', chips: parsed.chips || [] });
    saveOwlBoardMessages(msgs.slice(0, 3));
    localStorage.setItem(OWL_BOARD_TS_KEY, Date.now().toString());

    renderOwlBoard();
  } catch(e) {}
  _owlBoardGenerating = false;
}

function renderOwlBoard() {
  const messages = getOwlBoardMessages();
  const board = document.getElementById('owl-board');
  if (!board) return;

  if (messages.length === 0) {
    board.style.display = 'none';
    return;
  }

  board.style.display = 'block';
  _owlBoardMessages = messages;
  if (_owlBoardSlide >= messages.length) _owlBoardSlide = 0;

  // Рендер слайдів
  const track = document.getElementById('owl-board-track');
  if (track) {
    track.innerHTML = messages.map((m, i) => {
      const priorityDot = m.priority === 'critical'
        ? '<div style="width:6px;height:6px;border-radius:50%;background:#ef4444;flex-shrink:0;margin-top:5px;box-shadow:0 0 6px rgba(239,68,68,0.7)"></div>'
        : m.priority === 'important'
        ? '<div style="width:6px;height:6px;border-radius:50%;background:#f59e0b;flex-shrink:0;margin-top:5px"></div>'
        : '';
      return `
        <div style="min-width:100%;box-sizing:border-box">
          <div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:7px">
            ${priorityDot}
            <div style="font-size:13px;font-weight:600;color:white;line-height:1.5;flex:1">${escapeHtml(m.text)}</div>
          </div>
          ${m.chips && m.chips.length > 0 ? `<div style="display:flex;gap:5px;flex-wrap:wrap">${m.chips.map(c=>`<div style="font-size:10px;font-weight:700;padding:3px 8px;border-radius:20px;background:rgba(255,255,255,0.1);color:rgba(255,255,255,0.75);border:1px solid rgba(255,255,255,0.15)">${escapeHtml(c)}</div>`).join('')}</div>` : ''}
        </div>`;
    }).join('');
    track.style.transform = `translateX(-${_owlBoardSlide * 100}%)`;
  }

  // Крапки
  const dots = document.getElementById('owl-board-dots');
  if (dots && messages.length > 1) {
    dots.style.display = 'flex';
    dots.innerHTML = messages.map((_, i) => {
      const active = i === _owlBoardSlide;
      return `<div onclick="owlBoardGoTo(${i})" style="height:4px;width:${active?'12px':'4px'};border-radius:2px;background:${active?'rgba(255,255,255,0.7)':'rgba(255,255,255,0.2)'};transition:all 0.3s;cursor:pointer"></div>`;
    }).join('');
  } else if (dots) {
    dots.style.display = 'none';
  }

  // Свайп на слайдері
  setupOwlBoardSwipe();
}

function owlBoardGoTo(idx) {
  _owlBoardSlide = idx;
  const track = document.getElementById('owl-board-track');
  if (track) track.style.transform = `translateX(-${idx * 100}%)`;
  renderOwlBoard();
}

function dismissOwlBoard() {
  const board = document.getElementById('owl-board');
  if (board) board.style.display = 'none';
}

let _owlSwipeStartX = 0;
function setupOwlBoardSwipe() {
  const slider = document.getElementById('owl-board-slider');
  if (!slider || slider._owlSwipe) return;
  slider._owlSwipe = true;
  let _owlStartX = 0, _owlStartY = 0;
  slider.addEventListener('touchstart', e => {
    _owlStartX = e.touches[0].clientX;
    _owlStartY = e.touches[0].clientY;
    e.stopPropagation();
  }, { passive: false });
  slider.addEventListener('touchmove', e => {
    const dx = Math.abs(e.touches[0].clientX - _owlStartX);
    const dy = Math.abs(e.touches[0].clientY - _owlStartY);
    if (dx > dy) e.stopPropagation();
  }, { passive: false });
  slider.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - _owlStartX;
    e.stopPropagation();
    const msgs = getOwlBoardMessages();
    if (dx < -40 && _owlBoardSlide < msgs.length - 1) owlBoardGoTo(_owlBoardSlide + 1);
    else if (dx > 40 && _owlBoardSlide > 0) owlBoardGoTo(_owlBoardSlide - 1);
  }, { passive: false });
}

// Запуск циклу перевірки
function startOwlBoardCycle() {
  // Одразу при відкритті
  tryOwlBoardUpdate();
  // Потім кожні 3 хвилини
  if (_owlBoardTimer) clearInterval(_owlBoardTimer);
  _owlBoardTimer = setInterval(tryOwlBoardUpdate, OWL_BOARD_INTERVAL);
}

function tryOwlBoardUpdate() {
  // Тихий режим 23:00–7:00
  const hour = new Date().getHours();
  if (hour >= 23 || hour < 7) return;

  // Показуємо що є зараз
  const msgs = getOwlBoardMessages();
  if (msgs.length > 0) renderOwlBoard();

  const lastTs = parseInt(localStorage.getItem(OWL_BOARD_TS_KEY) || '0');
  const elapsed = Date.now() - lastTs;
  const isFirstTime = msgs.length === 0 && lastTs === 0;
  const isNewDay = lastTs > 0 && new Date(lastTs).toDateString() !== new Date().toDateString();

  // Вранці (7-9) — перевіряємо частіше (кожні 2 хв)
  const interval = (hour >= 7 && hour <= 9) ? 2 * 60 * 1000 : OWL_BOARD_INTERVAL;

  const shouldGenerate = isFirstTime || isNewDay || (elapsed > interval && checkOwlBoardTrigger());
  if (shouldGenerate) generateOwlBoardMessage();
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
    if (stuck.length > 0) return true;
    return true;
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