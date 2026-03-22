// ============================================================
// app-core.js — Ядро — вкладки, теми, налаштування, toast, trash, PWA, keyboard, анімації, init
// Функції: switchTab, applyTheme, setupDrumTabbar, openSettings, showToast, addToTrash, setupKeyboardAvoiding, animateTabSwitch, init, bootApp, OWL tab boards
// Залежності: Немає (завантажується першим)
// ============================================================

// === TAB THEMES ===
const TAB_THEMES = {
  inbox: {
    bg: 'linear-gradient(160deg, #f5f0e8, #ffffff)',
    orb: 'rgba(220,200,170,0.25)',
    tabBg: 'rgb(220,200,170)',
    accent: '#5c4a2a',
    accent2: '#8b6914',
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
    bg: 'linear-gradient(160deg, #e8d5c4, #f5ede4)',
    orb: 'rgba(124,74,42,0.12)',
    tabBg: 'rgb(200,160,130)',
    accent: '#7c4a2a',
    accent2: '#c2620a',
  },
  evening: {
    bg: 'linear-gradient(160deg, #1e3350, #3a5a80)',
    orb: 'rgba(30,51,80,0.20)',
    tabBg: 'rgb(25,45,75)',
    accent: '#1e3350',
    accent2: '#3a5a80',
  },
  finance: {
    bg: 'linear-gradient(160deg, #fcd9bd, #fff7ed)',
    orb: 'rgba(249,115,22,0.12)',
    tabBg: 'rgb(249,155,100)',
    accent: '#c2410c',
    accent2: '#f97316',
  },
  health: {
    bg: 'linear-gradient(160deg, #d4e8d8, #edf7ef)',
    orb: 'rgba(26,92,42,0.12)',
    tabBg: 'rgb(26,92,42)',
    accent: '#1a5c2a',
    accent2: '#16a34a',
  },
  projects: {
    bg: 'linear-gradient(160deg, #e8e0d5, #f5f0ea)',
    orb: 'rgba(61,46,30,0.10)',
    tabBg: 'rgb(61,46,30)',
    accent: '#3d2e1e',
    accent2: '#7c5c3a',
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
  ['inbox','tasks','notes','me','evening','finance','health','projects'].forEach(t => {
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
  if (tab === 'finance') { try { renderFinance(); } catch(e) { console.error('renderFinance error:', e); } }
  if (tab === 'health') { try { renderHealth(); } catch(e) {} }
  if (tab === 'projects') { try { renderProjects(); } catch(e) {} }

  // Підказка першого відвідування
  setTimeout(() => showFirstVisitTip(tab), 600);

  // OWL табло для вкладки
  setTimeout(() => { try { tryTabBoardUpdate(tab); } catch(e) {} }, 700);
}

// === АКТИВНІ ВКЛАДКИ (вибір через кнопку +) ===
const DEFAULT_TABS = ['inbox','notes'];
const ALL_TABS_CONFIG = [
  { id: 'inbox',    label: 'Inbox',         accent: '#8b6914', bg: 'rgba(245,240,232,0.9)',
    svg: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>' },
  { id: 'tasks',    label: 'Продуктив.',    accent: '#c2410c', bg: 'rgba(253,184,122,0.25)',
    svg: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>' },
  { id: 'notes',    label: 'Нотатки',       accent: '#c2620a', bg: 'rgba(254,215,170,0.3)',
    svg: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/></svg>' },
  { id: 'me',       label: 'Я',             accent: '#7c4a2a', bg: 'rgba(232,213,196,0.35)',
    svg: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>' },
  { id: 'evening',  label: 'Вечір',         accent: '#1e3350', bg: 'rgba(30,51,80,0.12)',
    svg: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>' },
  { id: 'finance',  label: 'Фінанси',       accent: '#c2410c', bg: 'rgba(252,217,189,0.35)',
    svg: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 3H8a2 2 0 0 0-2 2v2h12V5a2 2 0 0 0-2-2z"/><circle cx="12" cy="14" r="2"/></svg>' },
  { id: 'health',   label: "Здоров'я",      accent: '#1a5c2a', bg: 'rgba(212,232,216,0.4)',
    svg: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>' },
  { id: 'projects', label: 'Проекти',       accent: '#3d2e1e', bg: 'rgba(232,224,213,0.4)',
    svg: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>' },
];

function getActiveTabs() {
  try {
    const saved = JSON.parse(localStorage.getItem('nm_active_tabs') || 'null');
    if (Array.isArray(saved) && saved.length >= 1) return saved;
  } catch(e) {}
  return [...DEFAULT_TABS];
}

function saveActiveTabs(arr) {
  localStorage.setItem('nm_active_tabs', JSON.stringify(arr));
}

function openTabSelector() {
  const active = getActiveTabs();
  const locked = ['inbox', 'notes'];

  const overlay = document.createElement('div');
  overlay.id = 'tab-selector-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:300;display:flex;align-items:flex-end;justify-content:center;background:rgba(0,0,0,0.3);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px)';

  overlay.innerHTML = `
    <div onclick="event.stopPropagation()" id="tab-sel-sheet" style="width:100%;max-width:480px;background:rgba(250,249,255,0.97);backdrop-filter:blur(32px);-webkit-backdrop-filter:blur(32px);border-radius:28px 28px 0 0;padding:0 0 calc(env(safe-area-inset-bottom)+20px);border-top:1.5px solid rgba(255,255,255,0.8);box-shadow:0 -8px 40px rgba(0,0,0,0.15);transform:translateY(100%);transition:transform 0.35s cubic-bezier(0.32,0.72,0,1)">

      <!-- Хедер -->
      <div style="padding:14px 20px 10px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(30,16,64,0.06)">
        <div>
          <div style="width:36px;height:4px;background:rgba(0,0,0,0.1);border-radius:2px;margin:0 auto 14px"></div>
          <div style="font-size:18px;font-weight:800;color:#1e1040">Вкладки</div>
          <div style="font-size:12px;color:rgba(30,16,64,0.38);font-weight:500;margin-top:2px">Вибери що показувати в барабані</div>
        </div>
        <button onclick="applyTabSelection()" style="background:#1e1040;border:none;border-radius:14px;padding:9px 18px;font-size:14px;font-weight:700;color:white;cursor:pointer">Готово</button>
      </div>

      <!-- Сітка вкладок 2×4 -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:16px 16px 8px">
        ${ALL_TABS_CONFIG.map(t => {
          const isActive = active.includes(t.id);
          const isLocked = locked.includes(t.id);
          const borderColor = isActive ? t.accent : 'rgba(30,16,64,0.08)';
          const cardBg = isActive ? t.bg : 'rgba(255,255,255,0.6)';
          return `<div id="tab-sel-card-${t.id}"
            onclick="${isLocked ? '' : `toggleTabSelection('${t.id}')`}"
            style="border-radius:18px;padding:14px;background:${cardBg};border:2px solid ${borderColor};cursor:${isLocked ? 'default' : 'pointer'};transition:all 0.18s;position:relative;-webkit-tap-highlight-color:transparent">
            <!-- Іконка -->
            <div style="width:40px;height:40px;border-radius:12px;background:${isActive ? t.accent : 'rgba(30,16,64,0.06)'};display:flex;align-items:center;justify-content:center;margin-bottom:8px;color:${isActive ? 'white' : 'rgba(30,16,64,0.4)'};transition:all 0.18s">
              ${t.svg}
            </div>
            <!-- Назва -->
            <div style="font-size:14px;font-weight:700;color:${isActive ? t.accent : 'rgba(30,16,64,0.45)'};line-height:1.2">${t.label}</div>
            <!-- Завжди / Чекбокс -->
            ${isLocked
              ? `<div style="position:absolute;top:10px;right:10px;font-size:10px;font-weight:700;color:rgba(30,16,64,0.3);background:rgba(30,16,64,0.06);padding:2px 7px;border-radius:6px">завжди</div>`
              : `<div id="tab-sel-check-${t.id}" style="position:absolute;top:10px;right:10px;width:20px;height:20px;border-radius:6px;border:2px solid ${isActive ? t.accent : 'rgba(30,16,64,0.15)'};background:${isActive ? t.accent : 'transparent'};display:flex;align-items:center;justify-content:center;transition:all 0.18s">
                  ${isActive ? '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3.5"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
                </div>`
            }
          </div>`;
        }).join('')}
      </div>
    </div>`;

  overlay.addEventListener('click', e => { if (e.target === overlay) closeTabSelector(); });
  document.body.appendChild(overlay);

  // Анімація входу
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      document.getElementById('tab-sel-sheet').style.transform = 'translateY(0)';
    });
  });

  // Свайп вниз щоб закрити
  const sheet = document.getElementById('tab-sel-sheet');
  let _sy = 0, _dragging = false;
  sheet.addEventListener('touchstart', e => {
    _sy = e.touches[0].clientY; _dragging = false;
    sheet.style.transition = 'none';
  }, { passive: true });
  sheet.addEventListener('touchmove', e => {
    const dy = e.touches[0].clientY - _sy;
    if (dy > 5) { _dragging = true; sheet.style.transform = `translateY(${dy}px)`; }
  }, { passive: true });
  sheet.addEventListener('touchend', e => {
    const dy = e.changedTouches[0].clientY - _sy;
    sheet.style.transition = 'transform 0.3s cubic-bezier(0.32,0.72,0,1)';
    if (_dragging && dy > 80) { sheet.style.transform = 'translateY(100%)'; setTimeout(closeTabSelector, 300); }
    else { sheet.style.transform = 'translateY(0)'; }
  }, { passive: true });
}

// Тимчасовий стан вибору — зберігаємо в overlay
let _pendingTabs = null;

function toggleTabSelection(tabId) {
  if (!_pendingTabs) _pendingTabs = [...getActiveTabs()];
  const locked = ['inbox', 'notes'];
  if (locked.includes(tabId)) return;

  const idx = _pendingTabs.indexOf(tabId);
  if (idx !== -1) {
    _pendingTabs.splice(idx, 1);
  } else {
    const order = ALL_TABS_CONFIG.map(t => t.id);
    _pendingTabs.push(tabId);
    _pendingTabs.sort((a, b) => order.indexOf(a) - order.indexOf(b));
  }

  const isNowActive = _pendingTabs.includes(tabId);
  const cfg = ALL_TABS_CONFIG.find(t => t.id === tabId);
  if (!cfg) return;

  const card = document.getElementById(`tab-sel-card-${tabId}`);
  const check = document.getElementById(`tab-sel-check-${tabId}`);
  const iconDiv = card ? card.querySelector('div:first-child') : null;
  const labelDiv = card ? card.querySelectorAll('div')[1] : null;

  if (card) {
    card.style.background = isNowActive ? cfg.bg : 'rgba(255,255,255,0.6)';
    card.style.borderColor = isNowActive ? cfg.accent : 'rgba(30,16,64,0.08)';
  }
  if (iconDiv) {
    iconDiv.style.background = isNowActive ? cfg.accent : 'rgba(30,16,64,0.06)';
    iconDiv.style.color = isNowActive ? 'white' : 'rgba(30,16,64,0.4)';
  }
  if (labelDiv) {
    labelDiv.style.color = isNowActive ? cfg.accent : 'rgba(30,16,64,0.45)';
  }
  if (check) {
    check.style.borderColor = isNowActive ? cfg.accent : 'rgba(30,16,64,0.15)';
    check.style.background = isNowActive ? cfg.accent : 'transparent';
    check.innerHTML = isNowActive ? '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3.5"><polyline points="20 6 9 17 4 12"/></svg>' : '';
  }
}

function applyTabSelection() {
  const tabs = _pendingTabs || getActiveTabs();
  _pendingTabs = null;
  saveActiveTabs(tabs);
  closeTabSelector();
  rebuildDrumTabbar();
  showToast('✓ Вкладки оновлено');
}

function closeTabSelector() {
  _pendingTabs = null;
  const overlay = document.getElementById('tab-selector-overlay');
  if (overlay) overlay.remove();
}

// Перебудовує барабан відповідно до активних вкладок
function rebuildDrumTabbar() {
  const track = document.getElementById('drumTrack');
  if (!track) return;
  const active = getActiveTabs();

  const TAB_ICONS = {
    inbox:    '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"></polyline><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"></path></svg>',
    tasks:    '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>',
    notes:    '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line></svg>',
    me:       '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>',
    evening:  '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>',
    finance:  '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 3H8a2 2 0 0 0-2 2v2h12V5a2 2 0 0 0-2-2z"/><circle cx="12" cy="14" r="2"/></svg>',
    health:   '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
    projects: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
  };
  const TAB_LABELS = {
    inbox:'Inbox', tasks:'Продукт.', notes:'Нотатки', me:'Я',
    evening:'Вечір', finance:'Фінанси', health:"Здоров'я", projects:'Проекти',
  };

  track.innerHTML = active.map((id, i) =>
    `<div class="tab-item${id === currentTab ? ' active' : ''}" data-tab="${id}">
      <span class="tab-icon">${TAB_ICONS[id] || ''}</span>
      <span class="tab-label">${TAB_LABELS[id] || id}</span>
    </div>`
  ).join('');

  // Оновлюємо позицію і падінг
  updateDrumTabbar(currentTab);
  // Переоновлюємо edge padding
  const capsule = document.getElementById('drumCapsule');
  if (capsule) {
    const half = Math.floor(capsule.offsetWidth / 2);
    track.style.paddingLeft = half + 'px';
    track.style.paddingRight = half + 'px';
  }
}

function setupDrumTabbar() {
  const capsule = document.getElementById('drumCapsule');
  const track = document.getElementById('drumTrack');
  if (!capsule || !track) return;

  rebuildDrumTabbar();

  let startX = 0, dragDelta = 0, dragging = false;
  let velocity = 0, lastX = 0, lastTime = 0;
  let currentTranslateX = 0;
  let _rafId = null; // для інерційної анімації

  function updateEdgePadding() {
    const half = Math.floor(capsule.offsetWidth / 2);
    track.style.paddingLeft = half + 'px';
    track.style.paddingRight = half + 'px';
  }
  updateEdgePadding();
  window.addEventListener('resize', updateEdgePadding);

  capsule.addEventListener('click', e => {
    const item = e.target.closest('.tab-item[data-tab]');
    if (item && Math.abs(dragDelta) < 8) switchTab(item.dataset.tab);
  });

  function getDrumBounds() {
    const capsuleW = capsule.offsetWidth;
    const trackW = track.scrollWidth;
    return { minX: Math.min(0, capsuleW - trackW), maxX: 0 };
  }

  function getTabAtCenter() {
    const capsuleRect = capsule.getBoundingClientRect();
    const center = capsuleRect.left + capsuleRect.width / 2;
    const items = track.querySelectorAll('.tab-item[data-tab]');
    let closest = null, minDist = Infinity;
    items.forEach(item => {
      const rect = item.getBoundingClientRect();
      const dist = Math.abs(rect.left + rect.width / 2 - center);
      if (dist < minDist) { minDist = dist; closest = item; }
    });
    return closest ? closest.dataset.tab : null;
  }

  function getSnapX(tab) {
    const item = track.querySelector(`.tab-item[data-tab="${tab}"]`);
    if (!item) return currentTranslateX;
    const { minX, maxX } = getDrumBounds();
    const capsuleW = capsule.offsetWidth;
    const itemCenter = item.offsetLeft + item.offsetWidth / 2;
    return Math.max(minX, Math.min(maxX, capsuleW / 2 - itemCenter));
  }

  function updateActiveVisual(tab) {
    const active = getActiveTabs();
    const activeIdx = active.indexOf(tab);
    track.querySelectorAll('.tab-item[data-tab]').forEach((item, i) => {
      const diff = Math.abs(i - activeIdx);
      item.classList.remove('active', 'near');
      if (diff === 0) item.classList.add('active');
      else if (diff === 1) item.classList.add('near');
    });
  }

  function setX(x) {
    track.style.transform = `translateX(${x}px)`;
    currentTranslateX = x;
    window._drumCurrentX = x;
  }

  // Інерційна анімація через requestAnimationFrame
  function runMomentum(vel) {
    if (_rafId) cancelAnimationFrame(_rafId);
    const FRICTION = 0.88;
    const MIN_VEL = 0.5;

    function step() {
      vel *= FRICTION;
      const { minX, maxX } = getDrumBounds();
      let newX = currentTranslateX + vel;

      // Досягли межі — зупиняємось, без відскоку
      if (newX >= maxX) { newX = maxX; vel = 0; }
      if (newX <= minX) { newX = minX; vel = 0; }

      setX(newX);

      const centerTab = getTabAtCenter();
      if (centerTab) updateActiveVisual(centerTab);

      if (Math.abs(vel) > MIN_VEL) {
        _rafId = requestAnimationFrame(step);
      } else {
        _rafId = null;
        // Snap до найближчої вкладки
        const snapTab = getTabAtCenter();
        if (snapTab) {
          const snapX = getSnapX(snapTab);
          track.style.transition = 'transform 0.22s cubic-bezier(0.32,0.72,0,1)';
          setX(snapX);
          setTimeout(() => { track.style.transition = ''; }, 230);
          if (snapTab !== currentTab) switchTab(snapTab);
        }
      }
    }
    _rafId = requestAnimationFrame(step);
  }

  capsule.addEventListener('touchstart', e => {
    // Зупиняємо інерцію якщо є
    if (_rafId) { cancelAnimationFrame(_rafId); _rafId = null; }
    track.style.transition = 'none';

    // Читаємо реальну позицію з DOM
    const mat = new DOMMatrix(getComputedStyle(track).transform);
    currentTranslateX = isNaN(mat.m41) ? (window._drumCurrentX || 0) : mat.m41;
    window._drumCurrentX = currentTranslateX;

    startX = e.touches[0].clientX;
    lastX = startX;
    lastTime = Date.now();
    dragDelta = 0;
    velocity = 0;
    dragging = true;
  }, { passive: true });

  capsule.addEventListener('touchmove', e => {
    if (!dragging) return;
    const x = e.touches[0].clientX;
    const now = Date.now();
    const dt = now - lastTime;
    // Velocity в px/ms — середнє між останніми точками
    if (dt > 0) velocity = velocity * 0.6 + (x - lastX) / dt * 0.4;
    lastX = x;
    lastTime = now;
    dragDelta = x - startX;

    const { minX, maxX } = getDrumBounds();
    let newX = currentTranslateX + (x - startX);

    // Пружна межа — опір на краях
    if (newX > maxX) newX = maxX + (newX - maxX) * 0.25;
    if (newX < minX) newX = minX + (newX - minX) * 0.25;

    track.style.transform = `translateX(${newX}px)`;

    // Оновлюємо startX щоб рух був 1:1 з пальцем
    // НЕ оновлюємо currentTranslateX тут — це робиться через velocity
    const tempX = Math.max(minX, Math.min(maxX, newX));
    const saved = currentTranslateX;
    currentTranslateX = tempX;
    const centerTab = getTabAtCenter();
    currentTranslateX = saved;
    if (centerTab) updateActiveVisual(centerTab);
  }, { passive: true });

  capsule.addEventListener('touchend', e => {
    dragging = false;
    if (Math.abs(dragDelta) < 8) return;

    // Оновлюємо currentTranslateX до реальної позиції
    const mat = new DOMMatrix(getComputedStyle(track).transform);
    currentTranslateX = isNaN(mat.m41) ? currentTranslateX : mat.m41;
    window._drumCurrentX = currentTranslateX;

    // Запускаємо інерцію з поточною швидкістю (px/ms → px/frame при 60fps ≈ 16ms)
    const vel = velocity * 16;
    if (Math.abs(vel) > 1) {
      runMomentum(vel);
    } else {
      // Повільний свайп — snap до найближчої
      const snapTab = getTabAtCenter();
      if (snapTab) {
        const snapX = getSnapX(snapTab);
        track.style.transition = 'transform 0.25s cubic-bezier(0.32,0.72,0,1)';
        setX(snapX);
        setTimeout(() => { track.style.transition = ''; }, 260);
        updateActiveVisual(snapTab);
        if (snapTab !== currentTab) switchTab(snapTab);
      }
    }
  }, { passive: true });
}

function updateDrumTabbar(tab) {
  const active = getActiveTabs();
  const activeIdx = active.indexOf(tab);
  const items = document.querySelectorAll('.tab-item[data-tab]');
  items.forEach((item, i) => {
    const diff = Math.abs(i - activeIdx);
    item.classList.remove('active', 'near');
    if (diff === 0) item.classList.add('active');
    else if (diff === 1) item.classList.add('near');
  });
  // Центруємо активну вкладку в барабані через snapToTab-логіку
  const track = document.getElementById('drumTrack');
  const capsule = document.getElementById('drumCapsule');
  if (!track || !capsule) return;
  const activeItem = document.querySelector('.tab-item.active');
  if (!activeItem) return;
  const capsuleW = capsule.offsetWidth;
  const itemCenter = activeItem.offsetLeft + activeItem.offsetWidth / 2;
  const trackW = track.scrollWidth;
  const minX = Math.min(0, capsuleW - trackW);
  const newX = Math.max(minX, Math.min(0, capsuleW / 2 - itemCenter));
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

  // Темні таббари (вечір, здоров'я, проекти) — іконки і текст білі
  const isDark = ['evening','health','projects'].includes(tab);
  const tabLabels = tabBar ? tabBar.querySelectorAll('.tab-label') : [];
  tabLabels.forEach(s => {
    const isActive = s.closest('.tab-item.active');
    // Активний лейбл — завжди акцентний колір, не чіпаємо
    if (isActive) { s.style.color = ''; return; }
    s.style.color = isDark ? 'rgba(255,255,255,0.5)' : '';
  });
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
  const keys = ['nm_inbox','nm_tasks','nm_notes','nm_moments','nm_settings','nm_memory','nm_habits2','nm_habit_log2','nm_finance','nm_finance_budget','nm_finance_cats','nm_health_cards','nm_health_log','nm_projects','nm_evening_mood'];
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
  const keys = ['nm_inbox','nm_tasks','nm_notes','nm_moments','nm_settings','nm_gemini_key','nm_memory','nm_memory_ts','nm_notes_folders_ts','nm_habits2','nm_habit_log2','nm_onboarding_done','nm_evening_summary','nm_finance','nm_finance_budget','nm_finance_cats','nm_trash','nm_owl_board','nm_owl_board_ts','nm_owl_board_said','nm_error_log','nm_chat_inbox','nm_chat_tasks','nm_chat_notes','nm_chat_me','nm_chat_evening','nm_chat_finance','nm_health_cards','nm_health_log','nm_projects','nm_active_tabs','nm_evening_mood','nm_fin_coach_week','nm_fin_coach_month','nm_fin_coach_3months'];
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
    const newBars = ['tasks-ai-bar','notes-ai-bar','me-ai-bar','evening-ai-bar','finance-ai-bar','health-ai-bar','projects-ai-bar'].map(id => document.getElementById(id));

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
  const oldPage = document.getElementById(`page-${currentTabForAnim}`);
  const newPage = document.getElementById(`page-${newTab}`);
  if (!oldPage || !newPage || oldPage === newPage) {
    currentTabForAnim = newTab;
    return;
  }

  // Плавний fade — без translate щоб не було жорсткого контрасту між кольорами
  newPage.style.transition = 'none';
  newPage.style.opacity = '0';
  newPage.style.visibility = 'visible';

  // Стара — зникає
  oldPage.style.transition = 'opacity 0.18s ease';
  oldPage.style.opacity = '0';

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      newPage.style.transition = 'opacity 0.22s ease';
      newPage.style.opacity = '1';
    });
  });

  setTimeout(() => {
    oldPage.style.transition = '';
    oldPage.style.opacity = '';
    oldPage.style.visibility = '';
    newPage.style.transition = '';
    newPage.style.opacity = '';
  }, 260);

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
  // Вечір — табло завжди активне, не закривається
  if (tab === 'evening') return;
  const el = document.getElementById('owl-tab-board-' + tab);
  if (el) el.style.display = 'none';
}

function renderTabBoard(tab) {
  const msg = getTabBoardMsg(tab);
  const board = document.getElementById('owl-tab-board-' + tab);
  if (!board) return;
  // Вечір — завжди показуємо (навіть якщо немає msg ще)
  if (!msg || !msg.text) {
    if (tab !== 'evening') { board.style.display = 'none'; return; }
    board.style.display = 'block';
    return;
  }
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
