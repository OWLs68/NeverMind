// ============================================================
// app-core-nav.js — Теми, навігація між вкладками, налаштування, памʼять
// ============================================================
import { updateErrorLogBtn } from './logger.js';
import { escapeHtml } from './utils.js';
import { animateTabSwitch, NM_KEYS, applyBoardOverlays } from './boot.js';
import { callAI, closeAllChatBars } from '../ai/core.js';
import { tryTabBoardUpdate } from '../owl/proactive.js';
import { renderEvening, renderMe, renderMeHabitsStats } from '../tabs/evening.js';
import { getFinBudget, renderFinance, saveFinBudget, setCurrency } from '../tabs/finance.js';
import { currentProdTab, renderProdHabits, updateProdTabCounters } from '../tabs/habits.js';
import { renderHealth } from '../tabs/health.js';
import { renderInbox } from '../tabs/inbox.js';
import { checkAndSuggestFolders, currentNotesFolder, getNotes, renderNotes, setCurrentNotesFolder } from '../tabs/notes.js';
import { showFirstVisitTip } from '../tabs/onboarding.js';
import { renderProjects } from '../tabs/projects.js';
import { renderTasks } from '../tabs/tasks.js';

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
export let currentTab = 'inbox';

// === SWITCH TAB ===
export function switchTab(tab) {
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
    if (!show) {
      if (t !== 'inbox') {
        const cw = bar.querySelector('.ai-bar-chat-window');
        if (cw) cw.classList.remove('open');
      }
    }
  });
  // Tab-specific render
  if (tab === 'inbox') { try { renderInbox(); } catch(e) {} }
  if (tab === 'tasks') { renderTasks(); if (currentProdTab === 'habits') renderProdHabits(); updateProdTabCounters(); }
  if (tab === 'notes') { setCurrentNotesFolder(null); renderNotes(); checkAndSuggestFolders(); }
  if (tab === 'me') { renderMe(); renderMeHabitsStats(); }
  if (tab === 'evening') { renderEvening(); }
  if (tab === 'finance') { try { renderFinance(); } catch(e) { console.error('renderFinance error:', e); } }
  if (tab === 'health') { try { renderHealth(); } catch(e) {} }
  if (tab === 'projects') { try { renderProjects(); } catch(e) {} }

  // Підказка першого відвідування
  setTimeout(() => showFirstVisitTip(tab), 600);

  // OWL табло для вкладки
  setTimeout(() => { try { tryTabBoardUpdate(tab); } catch(e) {} }, 700);
  // Оновлюємо висоту overlay після зміни вмісту табло
  if (['me','evening','health','projects','inbox'].includes(tab)) {
    setTimeout(() => { try { applyBoardOverlays(); } catch(e) {} }, 750);
  }
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

export function getActiveTabs() {
  try {
    const saved = JSON.parse(localStorage.getItem('nm_active_tabs') || 'null');
    if (Array.isArray(saved) && saved.length >= 1) return saved;
  } catch(e) {}
  return [...DEFAULT_TABS];
}

export function saveActiveTabs(arr) {
  localStorage.setItem('nm_active_tabs', JSON.stringify(arr));
}

function openTabSelector() {
  const active = getActiveTabs();
  const locked = ['inbox', 'notes'];

  const overlay = document.createElement('div');
  overlay.id = 'tab-selector-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:300;display:flex;align-items:flex-end;justify-content:center;background:rgba(0,0,0,0.3);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px)';

  // Будуємо HTML через конкатенацію (без вкладених template literals)
  var cardsHtml = ALL_TABS_CONFIG.map(function(t) {
    var isActive = active.includes(t.id);
    var isLocked = locked.includes(t.id);
    var borderColor = isActive ? t.accent : 'rgba(30,16,64,0.08)';
    var cardBg = isActive ? t.bg : 'rgba(255,255,255,0.6)';
    var iconBg = isActive ? t.accent : 'rgba(30,16,64,0.06)';
    var iconColor = isActive ? 'white' : 'rgba(30,16,64,0.4)';
    var labelColor = isActive ? t.accent : 'rgba(30,16,64,0.45)';
    var onclickAttr = isLocked ? '' : "toggleTabSelection('" + t.id + "')";
    var checkHtml = isLocked
      ? '<div style="position:absolute;top:10px;right:10px;font-size:10px;font-weight:700;color:rgba(30,16,64,0.3);background:rgba(30,16,64,0.06);padding:2px 7px;border-radius:6px">завжди</div>'
      : '<div id="tab-sel-check-' + t.id + '" style="position:absolute;top:10px;right:10px;width:20px;height:20px;border-radius:6px;border:2px solid ' + (isActive ? t.accent : 'rgba(30,16,64,0.15)') + ';background:' + (isActive ? t.accent : 'transparent') + ';display:flex;align-items:center;justify-content:center;transition:all 0.18s">'
        + (isActive ? '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3.5"><polyline points="20 6 9 17 4 12"/></svg>' : '')
        + '</div>';
    return '<div id="tab-sel-card-' + t.id + '" onclick="' + onclickAttr + '" style="border-radius:18px;padding:14px;background:' + cardBg + ';border:2px solid ' + borderColor + ';cursor:' + (isLocked ? 'default' : 'pointer') + ';transition:all 0.18s;position:relative;-webkit-tap-highlight-color:transparent">'
      + '<div style="width:40px;height:40px;border-radius:12px;background:' + iconBg + ';display:flex;align-items:center;justify-content:center;margin-bottom:8px;color:' + iconColor + ';transition:all 0.18s">' + t.svg + '</div>'
      + '<div style="font-size:14px;font-weight:700;color:' + labelColor + ';line-height:1.2">' + t.label + '</div>'
      + checkHtml + '</div>';
  }).join('');

  overlay.innerHTML = '<div onclick="event.stopPropagation()" id="tab-sel-sheet" style="width:100%;max-width:480px;background:rgba(250,249,255,0.97);backdrop-filter:blur(32px);-webkit-backdrop-filter:blur(32px);border-radius:28px 28px 0 0;padding:0 0 calc(env(safe-area-inset-bottom)+20px);border-top:1.5px solid rgba(255,255,255,0.8);box-shadow:0 -8px 40px rgba(0,0,0,0.15);transform:translateY(100%);transition:transform 0.35s cubic-bezier(0.32,0.72,0,1)">'
    + '<div style="padding:14px 20px 10px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(30,16,64,0.06)">'
    + '<div><div class="modal-handle"></div>'
    + '<div style="font-size:18px;font-weight:800;color:#1e1040">Вкладки</div>'
    + '<div style="font-size:12px;color:rgba(30,16,64,0.38);font-weight:500;margin-top:2px">Вибери що показувати в барабані</div></div>'
    + '<button onclick="applyTabSelection()" style="background:#1e1040;border:none;border-radius:14px;padding:9px 18px;font-size:14px;font-weight:700;color:white;cursor:pointer">Готово</button>'
    + '</div>'
    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:16px 16px 8px">' + cardsHtml + '</div>'
    + '<div style="padding:0 16px 8px">'
    + '<div style="font-size:11px;font-weight:700;color:rgba(30,16,64,0.35);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:8px">Порядок</div>'
    + '<div id="tab-order-list" style="display:flex;flex-direction:row;gap:8px;overflow-x:auto;padding:4px 0 8px;-webkit-overflow-scrolling:touch;scrollbar-width:none"></div>'
    + '<div style="font-size:12px;color:rgba(30,16,64,0.3);font-weight:500;text-align:center">Тапни вкладку → ‹ › для переміщення</div>'
    + '</div></div>';

  overlay.addEventListener('click', e => { if (e.target === overlay) closeTabSelector(); });
  document.body.appendChild(overlay);

  // Анімація входу
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      document.getElementById('tab-sel-sheet').style.transform = 'translateY(0)';
      renderTabOrderList();
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
  // Оновлюємо список порядку
  renderTabOrderList();
}

function applyTabSelection() {
  const tabs = _pendingTabs || getActiveTabs();
  _pendingTabs = null;
  saveActiveTabs(tabs);
  closeTabSelector();
  rebuildDrumTabbar();
  showToast('✓ Вкладки оновлено');
}

let _selectedOrderTab = null;

function closeTabSelector() {
  _pendingTabs = null;
  _selectedOrderTab = null;
  const overlay = document.getElementById('tab-selector-overlay');
  if (overlay) overlay.remove();
}

// === TAB ORDER (#27) ===

function renderTabOrderList() {
  const list = document.getElementById('tab-order-list');
  if (!list) return;
  const tabs = _pendingTabs || getActiveTabs();
  const TAB_LABELS = {
    inbox:'Inbox', tasks:'Продуктив.', notes:'Нотатки', me:'Я',
    evening:'Вечір', finance:'Фінанси', health:"Здоров'я", projects:'Проекти',
  };
  list.innerHTML = tabs.map((id, idx) => {
    const cfg = ALL_TABS_CONFIG.find(t => t.id === id);
    const isSelected = _selectedOrderTab === id;
    const isLocked = id === 'inbox';
    const accent = cfg?.accent || 'rgba(30,16,64,0.2)';
    const bg = cfg?.bg || 'rgba(30,16,64,0.06)';
    const dot = `<div style="width:7px;height:7px;border-radius:50%;background:${accent};flex-shrink:0"></div>`;
    const label = `<span style="font-size:14px;font-weight:${isSelected ? 700 : 600};color:${isSelected ? '#1e1040' : 'rgba(30,16,64,0.6)'};white-space:nowrap">${TAB_LABELS[id] || id}</span>`;
    if (isLocked) {
      return `<div style="display:flex;align-items:center;gap:6px;padding:8px 10px;border-radius:20px;background:rgba(30,16,64,0.04);border:1.5px solid transparent;flex-shrink:0;cursor:default;-webkit-tap-highlight-color:transparent">
        ${dot}${label}
        <span style="font-size:10px;font-weight:700;color:rgba(30,16,64,0.3);background:rgba(30,16,64,0.06);padding:2px 6px;border-radius:6px">перший</span>
      </div>`;
    }
    if (isSelected) {
      const btnBase = 'width:26px;height:26px;border-radius:50%;background:rgba(30,16,64,0.1);border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;-webkit-tap-highlight-color:transparent';
      const leftDisabled = idx <= 1 ? 'opacity:0.25;pointer-events:none;' : '';
      const rightDisabled = idx >= tabs.length - 1 ? 'opacity:0.25;pointer-events:none;' : '';
      return `<div style="display:flex;align-items:center;gap:3px;flex-shrink:0">
        <button onclick="event.stopPropagation();moveTabOrder('${id}',-1)" style="${btnBase};${leftDisabled}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1e1040" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div onclick="selectTabOrder('${id}')" style="display:flex;align-items:center;gap:6px;padding:8px 10px;border-radius:20px;background:${bg};border:1.5px solid ${accent};flex-shrink:0;cursor:pointer;-webkit-tap-highlight-color:transparent">
          ${dot}${label}
        </div>
        <button onclick="event.stopPropagation();moveTabOrder('${id}',1)" style="${btnBase};${rightDisabled}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1e1040" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>`;
    }
    return `<div id="tab-order-row-${id}" onclick="selectTabOrder('${id}')"
      style="display:flex;align-items:center;gap:6px;padding:8px 10px;border-radius:20px;background:rgba(30,16,64,0.04);border:1.5px solid transparent;flex-shrink:0;cursor:pointer;transition:all 0.18s;-webkit-tap-highlight-color:transparent">
      ${dot}${label}
    </div>`;
  }).join('');
}

function selectTabOrder(tabId) {
  if (_selectedOrderTab === tabId) {
    _selectedOrderTab = null; // повторний тап — гасить
  } else {
    _selectedOrderTab = tabId;
  }
  renderTabOrderList();
}

function moveTabOrder(tabId, dir) {
  if (!_pendingTabs) _pendingTabs = [...getActiveTabs()];
  const idx = _pendingTabs.indexOf(tabId);
  if (idx === -1) return;
  const newIdx = idx + dir;
  if (newIdx < 1 || newIdx >= _pendingTabs.length) return; // не можна перемістити перед inbox
  // Swap
  [_pendingTabs[idx], _pendingTabs[newIdx]] = [_pendingTabs[newIdx], _pendingTabs[idx]];
  renderTabOrderList();
}

// Перебудовує барабан відповідно до активних вкладок
function rebuildDrumTabbar() {
  const track = document.getElementById('drumTrack');
  const capsule = document.getElementById('drumCapsule');
  if (!track || !capsule) return;
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

  track.innerHTML = active.map(id =>
    `<div class="tab-item${id === currentTab ? ' active' : ''}" data-tab="${id}">
      <span class="tab-icon">${TAB_ICONS[id] || ''}</span>
      <span class="tab-label">${TAB_LABELS[id] || id}</span>
    </div>`
  ).join('');

  // Padding і центрування після рендеру — rAF гарантує що layout готовий
  requestAnimationFrame(() => {
    const half = Math.floor(capsule.offsetWidth / 2);
    if (half > 0) {
      track.style.paddingLeft = half + 'px';
      track.style.paddingRight = half + 'px';
    }
    window._drumCurrentX = 0;
    track.style.transition = 'none';
    track.style.transform = '';
    updateDrumTabbar(currentTab, true); // без анімації — одразу на місце
  });
}

// 3D drum: застосовує perspective+rotateY до кожної вкладки відповідно до її позиції
function applyDrum3D(items, capsule) {
  const cc = capsule.getBoundingClientRect();
  const capsuleCenter = cc.left + cc.width / 2;
  const DRUM_RADIUS = 190; // px — менше = більша кривизна диска
  items.forEach(item => {
    const ir = item.getBoundingClientRect();
    const offset = (ir.left + ir.width / 2) - capsuleCenter;
    const angle = Math.atan2(offset, DRUM_RADIUS) * (180 / Math.PI);
    const scale = item.classList.contains('active') ? 1.10
      : item.classList.contains('near') ? 0.97
      : item.classList.contains('far')  ? 0.93 : 0.87;
    item.style.transform = `perspective(500px) rotateY(${angle.toFixed(1)}deg) scale(${scale})`;
  });
}

export function setupDrumTabbar() {
  const capsule = document.getElementById('drumCapsule');
  const track = document.getElementById('drumTrack');
  if (!capsule || !track) return;

  rebuildDrumTabbar();

  // Оновлюємо padding при зміні розміру
  window.addEventListener('resize', () => {
    requestAnimationFrame(() => {
      const half = Math.floor(capsule.offsetWidth / 2);
      if (half > 0) {
        track.style.paddingLeft = half + 'px';
        track.style.paddingRight = half + 'px';
      }
      updateDrumTabbar(currentTab, true); // при resize — без анімації
    });
  });

  let tx = 0;         // поточний translateX
  let startX = 0;     // clientX на початку дотику
  let startTX = 0;    // tx на початку дотику
  let isDragging = false;
  let velocity = 0;   // px/ms
  let lastX = 0, lastTime = 0;
  let rafId = null;

  // Встановлює translateX і синхронізує window
  function setTX(x) {
    track.style.transform = `translateX(${x}px)`;
    tx = x;
    window._drumCurrentX = x;
  }

  // Snap-позиція для item: скільки потрібно перемістити щоб він опинився по центру.
  // Математично cancels out tx — результат завжди статичний незалежно від поточної позиції.
  function snapXFor(item) {
    const cc = capsule.getBoundingClientRect();
    const ic = item.getBoundingClientRect();
    return tx + (cc.left + cc.width / 2) - (ic.left + ic.width / 2);
  }

  // Межі: перша вкладка по центру = maxX, остання = minX
  function getBounds() {
    const items = track.querySelectorAll('.tab-item[data-tab]');
    if (!items.length) return { minX: tx, maxX: tx };
    return {
      maxX: snapXFor(items[0]),
      minX: snapXFor(items[items.length - 1])
    };
  }

  // Item найближчий до центру капсули
  function itemAtCenter() {
    const cc = capsule.getBoundingClientRect();
    const center = cc.left + cc.width / 2;
    let best = null, bestD = Infinity;
    track.querySelectorAll('.tab-item[data-tab]').forEach(item => {
      const r = item.getBoundingClientRect();
      const d = Math.abs(r.left + r.width / 2 - center);
      if (d < bestD) { bestD = d; best = item; }
    });
    return best;
  }

  // Оновлює класи active/near/far і 3D-трансформ для ефекту диска-барабана
  function updateVisuals(centerItem) {
    const items = [...track.querySelectorAll('.tab-item[data-tab]')];
    const idx = centerItem ? items.indexOf(centerItem) : -1;
    items.forEach((item, i) => {
      const d = Math.abs(i - idx);
      item.classList.toggle('active', d === 0);
      item.classList.toggle('near', d === 1);
      item.classList.toggle('far', d === 2);
    });
    applyDrum3D(items, capsule);
  }

  // Перехід до конкретного item
  function snapToItem(item, animated) {
    if (animated === undefined) animated = true;
    const x = snapXFor(item);
    if (animated) {
      track.style.transition = 'transform 0.25s cubic-bezier(0.32,0.72,0,1)';
      setTX(x);
      // RAF-петля: оновлюємо 3D-трансформи під час CSS-анімації треку
      const endTime = Date.now() + 270;
      (function tick() {
        updateVisuals(item);
        if (Date.now() < endTime) requestAnimationFrame(tick);
        else track.style.transition = '';
      })();
    } else {
      track.style.transition = '';
      setTX(x);
    }
    updateVisuals(item);
    if (item.dataset.tab !== currentTab) {
      window._drumSuppressReposition = true;
      switchTab(item.dataset.tab);
      window._drumSuppressReposition = false;
    }
  }

  // Snap до найближчої вкладки
  function doSnap() {
    const item = itemAtCenter();
    if (item) snapToItem(item);
  }

  // Інерційна прокрутка після відпускання
  function runMomentum(vel) {
    if (rafId) cancelAnimationFrame(rafId);
    const FRICTION = 0.88;
    const MIN_VEL = 0.5;
    function step() {
      vel *= FRICTION;
      const { minX, maxX } = getBounds();
      let nx = tx + vel;
      // Зупинка на межах без відскоку
      if (nx > maxX) { nx = maxX; vel = 0; }
      if (nx < minX) { nx = minX; vel = 0; }
      setTX(nx);
      updateVisuals(itemAtCenter());
      if (Math.abs(vel) > MIN_VEL) {
        rafId = requestAnimationFrame(step);
      } else {
        rafId = null;
        doSnap();
      }
    }
    rafId = requestAnimationFrame(step);
  }

  capsule.addEventListener('touchstart', e => {
    capsule.classList.add('drum-dragging');
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    track.style.transition = 'none';
    // Читаємо реальну позицію з DOM (може бути mid-transition)
    const mat = new DOMMatrix(getComputedStyle(track).transform);
    tx = isNaN(mat.m41) ? (window._drumCurrentX || 0) : mat.m41;
    window._drumCurrentX = tx;
    startTX = tx;
    startX = e.touches[0].clientX;
    lastX = startX;
    lastTime = Date.now();
    velocity = 0;
    isDragging = true;
  }, { passive: true });

  capsule.addEventListener('touchmove', e => {
    if (!isDragging) return;
    const x = e.touches[0].clientX;
    const now = Date.now();
    const dt = now - lastTime;
    // Зважена середня швидкість (px/ms)
    if (dt > 0) velocity = velocity * 0.6 + (x - lastX) / dt * 0.4;
    lastX = x;
    lastTime = now;
    const { minX, maxX } = getBounds();
    let nx = startTX + (x - startX);
    // Гумова межа на краях
    if (nx > maxX) nx = maxX + (nx - maxX) * 0.25;
    if (nx < minX) nx = minX + (nx - minX) * 0.25;
    setTX(nx);
    updateVisuals(itemAtCenter());
  }, { passive: true });

  capsule.addEventListener('touchend', () => {
    capsule.classList.remove('drum-dragging');
    if (!isDragging) return;
    isDragging = false;
    if (Math.abs(tx - startTX) < 5) return;
    const mat = new DOMMatrix(getComputedStyle(track).transform);
    tx = isNaN(mat.m41) ? tx : mat.m41;
    window._drumCurrentX = tx;
    const vel = velocity * 16; // px/ms → px/frame @ 60fps
    if (Math.abs(vel) > 1) {
      runMomentum(vel);
    } else {
      doSnap();
    }
  }, { passive: true });

  // Тап на будь-яку вкладку → переключити
  capsule.addEventListener('click', e => {
    const item = e.target.closest('.tab-item[data-tab]');
    if (!item || Math.abs(tx - startTX) > 8) return;
    snapToItem(item);
  });
}

function updateDrumTabbar(tab, skipAnimation) {
  // Якщо викликано з snapToItem — позиція вже виставлена, не перезаписувати
  if (window._drumSuppressReposition) return;
  const track = document.getElementById('drumTrack');
  const capsule = document.getElementById('drumCapsule');
  if (!track || !capsule) return;
  const items = [...track.querySelectorAll('.tab-item[data-tab]')];
  const activeItem = track.querySelector(`.tab-item[data-tab="${tab}"]`);
  if (!activeItem) return;
  const idx = items.indexOf(activeItem);
  items.forEach((item, i) => {
    const d = Math.abs(i - idx);
    item.classList.toggle('active', d === 0);
    item.classList.toggle('near', d === 1);
    item.classList.toggle('far', d === 2);
  });
  // Центруємо активну вкладку через BoundingClientRect
  const cur = window._drumCurrentX || 0;
  const cc = capsule.getBoundingClientRect();
  const ic = activeItem.getBoundingClientRect();
  const nx = cur + (cc.left + cc.width / 2) - (ic.left + ic.width / 2);
  window._drumCurrentX = nx;
  if (skipAnimation) {
    // Під час ініціалізації — одразу на місце, без анімації
    track.style.transition = 'none';
    track.style.transform = `translateX(${nx}px)`;
    requestAnimationFrame(() => {
      applyDrum3D([...track.querySelectorAll('.tab-item[data-tab]')], capsule);
      track.style.transition = ''; // повертаємо CSS transition для наступних свайпів
    });
  } else {
    track.style.transition = 'transform 0.3s cubic-bezier(0.32,0.72,0,1)';
    track.style.transform = `translateX(${nx}px)`;
    // RAF-петля: оновлюємо 3D-трансформи під час CSS-анімації
    const endTime = Date.now() + 340;
    (function tick() {
      applyDrum3D([...track.querySelectorAll('.tab-item[data-tab]')], capsule);
      if (Date.now() < endTime) requestAnimationFrame(tick);
    })();
  }
}

export function applyTheme(tab) {
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
export function openSettings() {
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

  // Розклад дня
  const sc = settings.schedule || {};
  const wakeEl   = document.getElementById('input-wake-up');
  const wstartEl = document.getElementById('input-work-start');
  const wendEl   = document.getElementById('input-work-end');
  const bedEl    = document.getElementById('input-bed-time');
  if (wakeEl)   wakeEl.value   = sc.wakeUp    || '07:00';
  if (wstartEl) wstartEl.value = sc.workStart || '09:00';
  if (wendEl)   wendEl.value   = sc.workEnd   || '18:00';
  if (bedEl)    bedEl.value    = sc.bedTime   || '23:00';

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

export function closeSettings() {
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

export function updateKeyStatus(hasKey) {
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
  const wakeEl   = document.getElementById('input-wake-up');
  const wstartEl = document.getElementById('input-work-start');
  const wendEl   = document.getElementById('input-work-end');
  const bedEl    = document.getElementById('input-bed-time');
  const schedule = {
    wakeUp:    wakeEl   ? (wakeEl.value   || '07:00') : (settings.schedule?.wakeUp    || '07:00'),
    workStart: wstartEl ? (wstartEl.value || '09:00') : (settings.schedule?.workStart || '09:00'),
    workEnd:   wendEl   ? (wendEl.value   || '18:00') : (settings.schedule?.workEnd   || '18:00'),
    bedTime:   bedEl    ? (bedEl.value    || '23:00') : (settings.schedule?.bedTime   || '23:00'),
  };
  Object.assign(settings, { name, age, weight, height, profileNotes, schedule });
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
  // NM_KEYS визначено в app-core-system.js — єдине джерело правди
  const allKeys = [...NM_KEYS.data, ...NM_KEYS.settings, ...NM_KEYS.chat, ...NM_KEYS.cache];
  allKeys.forEach(k => localStorage.removeItem(k));
  NM_KEYS.patterns.forEach(p =>
    Object.keys(localStorage).filter(k => k.startsWith(p)).forEach(k => localStorage.removeItem(k))
  );
  showToast('🗑️ Всі дані видалено');
  setTimeout(() => window.location.reload(), 800);
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
export function getProfile() {
  const s = JSON.parse(localStorage.getItem('nm_settings') || '{}');
  const parts = [];
  if (s.name) parts.push(`Імʼя: ${s.name}`);
  if (s.age) parts.push(`Вік: ${s.age}`);
  if (s.weight) parts.push(`Вага: ${s.weight} кг`);
  if (s.height) parts.push(`Зріст: ${s.height} см`);
  if (s.profileNotes) parts.push(`Про себе: ${s.profileNotes}`);
  return parts.join(', ');
}

export function shouldRefreshMemory() {
  const lastTs = localStorage.getItem('nm_memory_ts');
  if (!lastTs) return true;
  const last = new Date(parseInt(lastTs));
  const now = new Date();
  return last.toDateString() !== now.toDateString(); // раз на день
}

export async function autoRefreshMemory() {
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
  const existingMemory = localStorage.getItem('nm_memory') || '';

  const recentInbox = inbox.slice(-50).map(i => `[${i.category}] ${i.text}`).join('\n');
  const tasksList = tasks.map(t => `${t.title} (${t.status})`).join('\n');
  const notesList = notes.slice(-20).map(n => `[${n.folder||'Загальне'}]${n.updatedAt ? ' (оновлено)' : ''} ${n.text.substring(0,80)}`).join('\n');

  // Збираємо чати для витягування фактів
  const chatTabs = ['inbox','tasks','notes','me','evening','finance','health','projects'];
  const recentChats = chatTabs.map(t => {
    try {
      const msgs = JSON.parse(localStorage.getItem('nm_chat_' + t) || '[]');
      return msgs.slice(-10).map(m => `[${t}/${m.role}] ${m.text}`).join('\n');
    } catch { return ''; }
  }).filter(Boolean).join('\n');

  const systemPrompt = `Ти — OWL, агент NeverMind. Проаналізуй записи і чати користувача і витягни КОНКРЕТНІ ФАКТИ про людину.

ПОТОЧНА ПАМ'ЯТЬ (що ми вже знаємо):
${existingMemory || '(порожньо)'}

ПРАВИЛА:
- Поверни ТІЛЬКИ НОВІ факти яких ще НЕМАЄ у поточній пам'яті
- Кожен факт — окремий рядок, коротко і конкретно (5-15 слів)
- Факти: звички, цілі, вподобання, розпорядок, що не любить, робота, здоров'я, фінанси
- Пиши як коротку замітку: "Прокидається о 7:00", "Збирає на авто", "Не любить бігати зранку"
- Максимум 5 нових фактів за раз (тільки найважливіші)
- Якщо нових фактів немає — поверни ПУСТО
- НЕ повторюй те що вже в пам'яті. НЕ вигадуй. Тільки з реальних записів.
- Відповідай українською.`;

  const userMsg = `Профіль: ${profile || 'не заповнено'}

Останні записи Inbox:
${recentInbox || 'порожньо'}

Задачі:
${tasksList || 'немає'}

Нотатки:
${notesList || 'немає'}

Останні чати:
${recentChats || 'немає'}`;

  const result = await callAI(systemPrompt, userMsg, {});
  if (!result || result.trim() === 'ПУСТО' || result.trim().length < 5) {
    localStorage.setItem('nm_memory_ts', Date.now().toString());
    return;
  }

  // Додаємо нові факти до існуючих (не перезаписуємо)
  const existingEntries = existingMemory.split('\n').map(s => s.trim()).filter(Boolean);
  const newEntries = result.split('\n').map(s => s.replace(/^[-•*]\s*/, '').trim()).filter(Boolean);
  const combined = [...existingEntries, ...newEntries];
  // Ліміт 50 записів — прибираємо найстаріші
  if (combined.length > 50) combined.splice(0, combined.length - 50);
  localStorage.setItem('nm_memory', combined.join('\n'));
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

export let _undoToastTimer = null;
export let _undoData = null; // { type, item, restore }
export function setUndoTimer(v) { _undoToastTimer = v; }
export function setUndoData(v) { _undoData = v; }

export function showToast(msg, duration = 2000) {
  const el = document.getElementById('toast');
  const msgEl = document.getElementById('toast-msg');
  const btn = document.getElementById('toast-undo-btn');
  msgEl.textContent = msg;
  btn.style.display = 'none';
  if (_undoToastTimer) clearTimeout(_undoToastTimer);
  el.classList.add('show');
  _undoToastTimer = setTimeout(() => el.classList.remove('show'), duration);
}

// Functions called from HTML event handlers (onclick, oninput, etc.)
Object.assign(window, {
  switchTab, showToast, closeSettings, openSettings, saveSettings,
  setLanguage, setOwlModeSetting, openTabSelector, openFeedback,
  clearAllData, openMemoryModal, closeMemoryModal, refreshMemory,
  saveMemoryCards, addMemoryEntry, openPrivacyPolicy, openTerms,
  applyTabSelection, selectTabOrder, moveTabOrder,
  deleteMemoryCard, saveFinanceSettings, clearFinanceData, exportData,
  toggleTabSelection,
});
