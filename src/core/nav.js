// ============================================================
// app-core-nav.js — Теми, навігація між вкладками, налаштування, памʼять
// ============================================================
import { updateErrorLogBtn } from './logger.js';
import { escapeHtml } from './utils.js';
import { animateTabSwitch, NM_KEYS, applyBoardOverlays } from './boot.js';
import { callAI, callAIWithTools, INBOX_TOOLS, closeAllChatBars } from '../ai/core.js';
import {
  addFact,
  cleanupExpiredFacts,
  deleteFact,
  getFactsRaw,
  updateFactText,
  FACT_CATEGORIES,
  relativeTime,
  isMigrationDone,
  markMigrationDone,
  getLegacyMemoryText,
} from '../ai/memory.js';
import { tryBoardUpdate } from '../owl/proactive.js';
import { renderEvening, renderMe, renderMeHabitsStats } from '../tabs/evening.js';
import { getFinBudget, renderFinance, saveFinBudget, setCurrency } from '../tabs/finance.js';
import { currentProdTab, renderProdHabits, updateProdTabCounters } from '../tabs/habits.js';
import { renderHealth } from '../tabs/health.js';
import { renderInbox } from '../tabs/inbox.js';
import { currentNotesFolder, getNotes, renderNotes, setCurrentNotesFolder } from '../tabs/notes.js';
import { showFirstVisitTip } from '../tabs/onboarding.js';
import { renderProjects } from '../tabs/projects.js';
import { renderTasks } from '../tabs/tasks.js';

// === TAB THEMES ===
const TAB_THEMES = {
  inbox: {
    bg: 'linear-gradient(160deg, #fed7aa, #ffedd5)',
    orb: 'rgba(234,88,12,0.10)',
    tabBg: 'rgb(254,215,170)',
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
    bg: 'linear-gradient(160deg, #f5f0e8, #ffffff)',
    orb: 'rgba(220,200,170,0.25)',
    tabBg: 'rgb(220,200,170)',
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
  if (tab === 'notes') { setCurrentNotesFolder(null); renderNotes(); }
  if (tab === 'me') { renderMe(); renderMeHabitsStats(); }
  if (tab === 'evening') { renderEvening(); }
  if (tab === 'finance') { try { renderFinance(); } catch(e) { console.error('renderFinance error:', e); } }
  if (tab === 'health') { try { renderHealth(); } catch(e) {} }
  if (tab === 'projects') { try { renderProjects(); } catch(e) {} }

  // Підказка першого відвідування
  setTimeout(() => showFirstVisitTip(tab), 600);

  // OWL табло для вкладки
  setTimeout(() => { try { tryBoardUpdate(tab); } catch(e) {} }, 700);
  // Оновлюємо висоту overlay після зміни вмісту табло
  if (['me','evening','health','projects','inbox'].includes(tab)) {
    setTimeout(() => { try { applyBoardOverlays(); } catch(e) {} }, 750);
  }
}

// === АКТИВНІ ВКЛАДКИ (вибір через кнопку +) ===
const DEFAULT_TABS = ['inbox','notes'];
const ALL_TABS_CONFIG = [
  { id: 'inbox',    label: 'Inbox',         accent: '#8b6914', bg: 'rgba(254,215,170,0.3)',
    svg: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>' },
  { id: 'tasks',    label: 'Продуктив.',    accent: '#c2410c', bg: 'rgba(253,184,122,0.25)',
    svg: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>' },
  { id: 'notes',    label: 'Нотатки',       accent: '#c2620a', bg: 'rgba(245,240,232,0.9)',
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
      el.style.border = '1.5px solid #c2790a';
      el.style.background = 'rgba(194,121,10,0.07)';
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

// === UI: "Що агент знає про мене" — структуровані факти з категоріями ===
// Рендер групує факти за категорією, показує відносний час, кольорові бейджі.
function renderMemoryCards() {
  const list = document.getElementById('memory-cards-list');
  if (!list) return;

  const facts = getFactsRaw().filter(f => f && f.text); // навіть прострочені показуємо (видно джерело)

  if (!facts.length) {
    list.innerHTML = '<div style="text-align:center;padding:40px 20px;color:rgba(30,16,64,0.3);font-size:15px">Ще порожньо.<br>Напиши кілька записів в Inbox і натисни "Оновити через OWL".<br><br>Або додай факт вручну через поле вище.</div>';
    return;
  }

  // Групуємо по категорії
  const grouped = {};
  facts.forEach(f => {
    const c = f.category || 'context';
    if (!grouped[c]) grouped[c] = [];
    grouped[c].push(f);
  });

  // Порядок відображення — найважливіші категорії зверху
  const order = ['health', 'relationships', 'work', 'goals', 'preferences', 'context'];

  const parts = [];
  for (const cat of order) {
    if (!grouped[cat] || !grouped[cat].length) continue;
    const meta = FACT_CATEGORIES[cat] || { label: cat, emoji: '•', color: '#666' };
    // Заголовок категорії
    parts.push(`<div style="display:flex;align-items:center;gap:8px;margin:14px 2px 6px;padding:0 2px"><span style="font-size:14px">${meta.emoji}</span><span style="font-size:12px;font-weight:700;letter-spacing:0.02em;color:${meta.color};text-transform:uppercase">${meta.label}</span><span style="font-size:11px;color:rgba(30,16,64,0.35);margin-left:auto">${grouped[cat].length}</span></div>`);
    // Сортуємо всередині категорії за свіжістю
    grouped[cat].sort((a, b) => (b.lastSeen || b.ts || 0) - (a.lastSeen || a.ts || 0));
    for (const f of grouped[cat]) {
      const ago = relativeTime(f.ts);
      const ttlNote = f.ttl ? ` · живе ${f.ttl} дн` : '';
      const sourceLabel = {
        inbox: 'Inbox',
        auto: 'фон',
        manual: 'вручну',
        migration: 'стара пам\'ять',
        onboarding: 'онбординг',
      }[f.source] || '';
      const escId = escapeHtml(f.id);
      parts.push(`
        <div data-fact-id="${escId}" style="background:rgba(255,255,255,0.75);border:1.5px solid rgba(255,255,255,0.7);border-radius:14px;padding:12px 14px;display:flex;align-items:flex-start;gap:10px">
          <div style="flex:1;min-width:0">
            <div contenteditable="true" data-fact-edit="${escId}" onblur="saveMemoryFactEdit('${escId}', this.textContent)" style="font-size:15px;color:#1e1040;line-height:1.4;outline:none;word-break:break-word">${escapeHtml(f.text)}</div>
            <div style="font-size:11px;color:rgba(30,16,64,0.4);margin-top:4px">${ago}${sourceLabel ? ' · ' + sourceLabel : ''}${ttlNote}</div>
          </div>
          <button onclick="deleteMemoryCard('${escId}')" style="background:none;border:none;cursor:pointer;color:rgba(30,16,64,0.25);font-size:18px;line-height:1;padding:2px;flex-shrink:0;margin-top:1px">×</button>
        </div>`);
    }
  }

  list.innerHTML = parts.join('');
}

// Додати факт вручну (з поля вводу у модалці)
function addMemoryEntry() {
  const input = document.getElementById('memory-new-input');
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;
  addFact({
    text,
    category: 'context', // за замовчуванням — юзер сам може змінити редагуванням
    source: 'manual',
  });
  input.value = '';
  renderMemoryCards();
  const list = document.getElementById('memory-cards-list');
  if (list) setTimeout(() => { list.scrollTop = list.scrollHeight; }, 50);
}

// Видалити факт за id
function deleteMemoryCard(id) {
  if (!id) return;
  deleteFact(id);
  renderMemoryCards();
}

// Редагування тексту факту inline (contenteditable blur)
function saveMemoryFactEdit(id, newText) {
  if (!id) return;
  const trimmed = (newText || '').trim();
  if (!trimmed) {
    deleteFact(id);
    renderMemoryCards();
    return;
  }
  updateFactText(id, trimmed);
}

// Збереження всіх карток (legacy — викликається старим "Зберегти" кнопкою)
// Тепер inline редагування зберігає себе само через onblur, тож ця функція
// просто перемальовує і показує toast.
function saveMemoryCards() {
  renderMemoryCards();
  const tsEl = document.getElementById('memory-last-updated');
  if (tsEl) tsEl.textContent = 'Збережено щойно';
  showToast('✓ Збережено');
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
  const keys = ['nm_inbox','nm_tasks','nm_notes','nm_moments','nm_settings','nm_memory','nm_facts','nm_habits2','nm_habit_log2','nm_finance','nm_finance_budget','nm_finance_cats','nm_health_cards','nm_health_log','nm_projects','nm_evening_mood'];
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
  if (s.currency) parts.push(`Валюта: ${s.currency}`);
  if (s.language) {
    const langMap = { uk: 'українська', en: 'English', nl: 'Nederlands' };
    parts.push(`Мова: ${langMap[s.language] || s.language}`);
  }
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

// === ПАМ'ЯТЬ (структуровані факти, v3 — 12.04) ===
// Архітектура: масив nm_facts з часовими мітками.
// ЄДИНИЙ канал наповнення: AI викликає save_memory_fact tool коли юзер ПРЯМО
// повідомляє стійкий факт про себе (на будь-якій вкладці з tool calling).
// Фонове "вгадування" (аналіз історії за 7 днів) прибрано 12.04 — генерувало
// сміття (дії як факти, вигадані компліменти). Один мозок, одне правило.
// Перший запуск робить міграцію старого nm_memory (текст → факти).

async function doRefreshMemory(showResult) {
  // 1. Прибираємо прострочені факти
  cleanupExpiredFacts();

  // 2. Перший запуск — міграція старого тексту у факти
  if (!isMigrationDone()) {
    try {
      await _migrateLegacyMemoryToFacts();
    } catch (e) {
      console.warn('[memory] migration failed:', e);
    }
    markMigrationDone();
  }

  localStorage.setItem('nm_memory_ts', Date.now().toString());

  // Оновити UI якщо модалка відкрита
  if (document.getElementById('memory-modal')?.style.display !== 'none') {
    renderMemoryCards();
  }

  const tsEl = document.getElementById('memory-last-updated');
  if (tsEl) {
    const d = new Date();
    tsEl.textContent = `Останнє оновлення: ${d.toLocaleDateString('uk-UA')} о ${d.toLocaleTimeString('uk-UA', {hour:'2-digit',minute:'2-digit'})}`;
  }

  if (showResult) showToast("✓ Пам'ять оновлено");
}

// Одноразова міграція: старий текстовий nm_memory пропускаємо через AI
// з save_memory_fact tool — AI витягує структуровані факти з тексту.
async function _migrateLegacyMemoryToFacts() {
  const legacy = (getLegacyMemoryText() || '').trim();
  if (!legacy || legacy.length < 10) return; // нічого мігрувати

  const saveMemTool = INBOX_TOOLS.find(t => t.function?.name === 'save_memory_fact');
  if (!saveMemTool) return;

  const systemPrompt = `Ти — OWL, агент NeverMind. Зараз ОДНОРАЗОВА МІГРАЦІЯ пам'яті: отримуєш старий текстовий абзац фактів про користувача і маєш витягти з нього СТРУКТУРОВАНІ факти. Для КОЖНОГО факту який знаходиш — виклич tool save_memory_fact.

ПРАВИЛА:
- Максимум 30 фактів. Якщо більше — обери найважливіші.
- НЕ вигадуй нічого чого не видно в тексті.
- Пиши від третьої особи українською: "Має...", "Працює...", "Любить..."
- Постійні факти (сім'я, алергія, вік, стійкі вподобання) — БЕЗ ttl_days.
- Тимчасові факти (поточна робота, локація, симптоми) — з ttl_days 30-90.
- Категорії: preferences (вподобання/звички), health (здоров'я/алергії), work (робота/кар'єра), relationships (сім'я), context (локація/розклад), goals (цілі/плани).
- НЕ повторюй один факт у різних категоріях.`;

  const userContent = `СТАРА ТЕКСТОВА ПАМ'ЯТЬ (кожен рядок — один факт):\n${legacy}`;

  const msg = await callAIWithTools(systemPrompt, [{ role: 'user', content: userContent }], [saveMemTool]);
  if (!msg || !msg.tool_calls || !Array.isArray(msg.tool_calls)) return;

  let added = 0;
  for (const tc of msg.tool_calls) {
    if (tc.function?.name !== 'save_memory_fact') continue;
    try {
      const args = JSON.parse(tc.function.arguments || '{}');
      const f = addFact({
        text: args.fact,
        category: args.category,
        ttlDays: args.ttl_days,
        source: 'migration',
      });
      if (f) added++;
    } catch (e) {
      console.warn('[memory migration] bad fact:', e);
    }
  }
  console.log('[memory] migrated', added, 'facts from legacy nm_memory');
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

// === DEPLOY INFO MODAL ===
// Тап на бейдж версії → показує технічну інформацію про деплой
// (версія, час, коміт hash, гілка) — для діагностики "що зараз на телефоні"
export function showDeployInfo() {
  const badge = document.getElementById('deploy-version');
  if (!badge) return;
  const version = badge.textContent || '';
  const commit  = badge.dataset.commit  || 'local';
  const source  = badge.dataset.source  || 'dev';
  const branch  = badge.dataset.branch  || 'dev';

  // Створюємо модалку через createElement щоб не додавати HTML у index.html
  let modal = document.getElementById('deploy-info-modal');
  if (modal) modal.remove();
  modal = document.createElement('div');
  modal.id = 'deploy-info-modal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:300;background:rgba(30,16,64,0.5);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:0 20px;opacity:0;transition:opacity 0.2s';
  modal.onclick = (e) => { if (e.target === modal) closeDeployInfo(); };

  const repoUrl = 'https://github.com/OWLs68/NeverMind';
  const commitLink = (commit && commit !== 'local') ? `${repoUrl}/commit/${commit}` : null;
  const sourceLink = (source && source !== 'dev')   ? `${repoUrl}/tree/${source}`   : null;

  modal.innerHTML = `
    <div style="background:#fef8ec;border-radius:22px;padding:22px 20px 18px;width:100%;max-width:380px;box-shadow:0 20px 60px rgba(30,16,64,0.3)">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
        <div style="font-size:17px;font-weight:800;color:#1e1040">Інфо про деплой</div>
        <button onclick="closeDeployInfo()" style="background:none;border:none;font-size:22px;line-height:1;color:rgba(30,16,64,0.5);cursor:pointer;padding:4px 8px">×</button>
      </div>
      <div style="display:flex;flex-direction:column;gap:10px;font-size:13px">
        <div style="display:flex;justify-content:space-between;gap:12px;padding:8px 12px;background:rgba(139,105,20,0.08);border-radius:10px">
          <div style="color:rgba(30,16,64,0.55);font-weight:600">Версія</div>
          <div style="color:#1e1040;font-weight:700;font-family:monospace">${version}</div>
        </div>
        <div style="display:flex;justify-content:space-between;gap:12px;padding:8px 12px;background:rgba(139,105,20,0.08);border-radius:10px">
          <div style="color:rgba(30,16,64,0.55);font-weight:600">Коміт</div>
          <div style="color:#1e1040;font-weight:700;font-family:monospace">${commitLink ? `<a href="${commitLink}" target="_blank" rel="noopener" style="color:#c2790a;text-decoration:none">${commit}</a>` : commit}</div>
        </div>
        <div style="display:flex;justify-content:space-between;gap:12px;padding:8px 12px;background:rgba(139,105,20,0.08);border-radius:10px">
          <div style="color:rgba(30,16,64,0.55);font-weight:600">Гілка звідки</div>
          <div style="color:#1e1040;font-weight:700;font-family:monospace;text-align:right;word-break:break-all">${sourceLink ? `<a href="${sourceLink}" target="_blank" rel="noopener" style="color:#c2790a;text-decoration:none">${source}</a>` : source}</div>
        </div>
        <div style="display:flex;justify-content:space-between;gap:12px;padding:8px 12px;background:rgba(139,105,20,0.08);border-radius:10px">
          <div style="color:rgba(30,16,64,0.55);font-weight:600">Гілка у main</div>
          <div style="color:#1e1040;font-weight:700;font-family:monospace">${branch}</div>
        </div>
      </div>
      <div style="margin-top:14px;padding-top:12px;border-top:1px solid rgba(30,16,64,0.08);font-size:11px;color:rgba(30,16,64,0.45);line-height:1.45">
        Якщо бейдж не оновився після пушу — CI ще не доробив. Потягни застосунок вниз за 2 хв.
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  requestAnimationFrame(() => { modal.style.opacity = '1'; });
}

export function closeDeployInfo() {
  const modal = document.getElementById('deploy-info-modal');
  if (!modal) return;
  modal.style.opacity = '0';
  setTimeout(() => modal.remove(), 200);
}

// Functions called from HTML event handlers (onclick, oninput, etc.)
Object.assign(window, {
  switchTab, showToast, closeSettings, openSettings, saveSettings,
  setLanguage, setOwlModeSetting, openTabSelector, openFeedback,
  clearAllData, openMemoryModal, closeMemoryModal, refreshMemory,
  saveMemoryCards, addMemoryEntry, saveMemoryFactEdit, openPrivacyPolicy, openTerms,
  applyTabSelection, selectTabOrder, moveTabOrder,
  deleteMemoryCard, saveFinanceSettings, clearFinanceData, exportData,
  toggleTabSelection, showDeployInfo, closeDeployInfo,
});
