import { escapeHtml } from '../core/utils.js';
import { openChatBar } from '../ai/core.js';
import { owlChipToChat } from './chips.js';
import { getOwlBoardMessages } from './inbox-board.js';

// === OWL TAB BOARDS (#37) ===
export const OWL_TAB_BOARD_MIN_INTERVAL = 30 * 60 * 1000; // 30 хвилин між оновленнями

function getOwlTabBoardKey(tab) { return 'nm_owl_tab_' + tab; }
export function getOwlTabTsKey(tab) { return 'nm_owl_tab_ts_' + tab; }

export function getTabBoardMsgs(tab) {
  try {
    const raw = JSON.parse(localStorage.getItem(getOwlTabBoardKey(tab)) || 'null');
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    return [raw]; // backward compat: старий формат → масив
  } catch { return []; }
}
export function saveTabBoardMsg(tab, newMsg) {
  const msgs = getTabBoardMsgs(tab);
  msgs.unshift(newMsg);          // новий → перший
  if (msgs.length > 30) msgs.length = 30; // максимум 30
  try { localStorage.setItem(getOwlTabBoardKey(tab), JSON.stringify(msgs)); } catch {}
}

// === OWL TAB BOARD — новий стиль (як Інбокс) ===

export const _owlTabStates = {}; // 'speech' | 'collapsed'
const _owlTabSwipes = {};

function _owlTabHTML(tab) {
  const t = tab;
  return `
    <div id="owl-tab-collapsed-${t}" class="owl-collapsed" style="display:none" onclick="toggleOwlTabChat('${t}')">
      <div class="owl-collapsed-avatar">🦉</div>
      <div class="owl-collapsed-text" id="owl-tab-ctext-${t}"></div>
    </div>
    <div id="owl-tab-speech-${t}" class="owl-speech"
         ontouchstart="owlTabSwipeStart(event,'${t}')" ontouchmove="owlTabSwipeMove(event,'${t}')" ontouchend="owlTabSwipeEnd(event,'${t}')">
      <div class="owl-speech-avatar">🦉</div>
      <div class="owl-tab-card">
        <div class="owl-tab-bubble" id="owl-tab-bubble-${t}">
          <div class="owl-speech-text" id="owl-tab-text-${t}"></div>
          <div class="owl-speech-time" id="owl-tab-time-${t}"></div>
        </div>
      </div>
    </div>
    <div class="owl-chips-wrapper" id="owl-tab-chips-wrap-${t}">
      <button class="owl-chips-arrow owl-chips-arrow-left" id="owl-tab-chips-left-${t}" onclick="scrollOwlTabChips('${t}',-1)">‹</button>
      <div id="owl-tab-chips-${t}" class="owl-speech-chips"></div>
      <button class="owl-chips-arrow owl-chips-arrow-right" id="owl-tab-chips-right-${t}" onclick="scrollOwlTabChips('${t}',1)">›</button>
    </div>`;
}

export function _owlTabApplyState(tab) {
  const st = _owlTabStates[tab] || 'speech';
  const collapsed = document.getElementById('owl-tab-collapsed-' + tab);
  const speech    = document.getElementById('owl-tab-speech-' + tab);
  const chipsWrap = document.getElementById('owl-tab-chips-wrap-' + tab);
  if (!speech) return;
  if (collapsed) collapsed.style.display = st === 'collapsed' ? 'flex' : 'none';
  speech.style.display = st === 'collapsed' ? 'none' : 'block';
  if (chipsWrap) chipsWrap.style.display = 'flex';
}

export function toggleOwlTabChat(tab) { _owlTabStates[tab] = 'speech'; _owlTabApplyState(tab); }

export function owlTabSwipeStart(e, tab) {
  _owlTabSwipes[tab] = { y: e.touches[0].clientY, dy: 0 };
}
export function owlTabSwipeMove(e, tab) {
  if (!_owlTabSwipes[tab]) return;
  _owlTabSwipes[tab].dy = e.touches[0].clientY - _owlTabSwipes[tab].y;
}

export function owlTabSwipeEnd(e, tab) {
  const sw = _owlTabSwipes[tab]; if (!sw) return;
  _owlTabSwipes[tab] = null;
  const dy = sw.dy, st = _owlTabStates[tab] || 'speech';

  if (dy < -40) {
    // Свайп вгору — згорнути табло
    if (st === 'speech') { _owlTabStates[tab] = 'collapsed'; _owlTabApplyState(tab); }
  } else if (dy > 40) {
    // Свайп вниз — розгорнути або відкрити чат-бар
    if (st === 'collapsed') { _owlTabStates[tab] = 'speech'; _owlTabApplyState(tab); }
    else if (st === 'speech') openChatBar(tab === 'inbox' ? 'inbox' : tab);
  }
}

export function _updateOwlTabChipsArrows(tab) {
  const el    = document.getElementById('owl-tab-chips-' + tab);
  const left  = document.getElementById('owl-tab-chips-left-' + tab);
  const right = document.getElementById('owl-tab-chips-right-' + tab);
  if (!el || !left || !right) return;
  left.classList.toggle('visible', el.scrollLeft > 4);
  right.classList.toggle('visible', el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
}

export function scrollOwlTabChips(tab, dir) {
  const el = document.getElementById('owl-tab-chips-' + tab);
  if (!el) return;
  el.scrollBy({ left: dir * 130, behavior: 'smooth' });
  setTimeout(() => _updateOwlTabChipsArrows(tab), 250);
}

export function renderTabBoard(tab) {
  const isInbox = tab === 'inbox';
  const msgs = isInbox ? (typeof getOwlBoardMessages === 'function' ? getOwlBoardMessages() : []) : getTabBoardMsgs(tab);
  const board = document.getElementById(isInbox ? 'owl-board' : 'owl-tab-board-' + tab);
  if (!board) return;
  if (!msgs.length) { board.style.display = 'none'; return; }
  board.style.display = 'block';

  // Ініціалізація структури — один раз (inbox вже має HTML в index.html)
  if (!board._owlReady) {
    if (!isInbox) board.innerHTML = _owlTabHTML(tab);
    board._owlReady = true;
    _owlTabStates[tab] = _owlTabStates[tab] || 'speech';
    _owlTabApplyState(tab);
  }

  const msg = msgs[0];
  const ago = Date.now() - (msg.ts || msg.id || Date.now());
  const mins = Math.floor(ago / 60000);
  const timeStr = mins < 1 ? 'щойно' : mins < 60 ? mins + ' хв' : Math.floor(mins / 60) + ' год';

  const tEl = document.getElementById('owl-tab-text-' + tab);
  const cEl = document.getElementById('owl-tab-ctext-' + tab);
  const tmEl = document.getElementById('owl-tab-time-' + tab);
  if (tEl) tEl.textContent = msg.text;
  if (cEl) cEl.textContent = msg.text;
  if (tmEl) tmEl.textContent = timeStr;

  const chipsEl = document.getElementById('owl-tab-chips-' + tab);
  const chipsHTML = (msg.chips || []).map(c => {
    const s = escapeHtml(c).replace(/'/g, '&#39;');
    return `<div class="owl-chip" onclick="owlChipToChat('${tab}','${s}')">${escapeHtml(c)}</div>`;
  });
  if (chipsEl) {
    const barTab = tab === 'me' ? 'me' : tab;
    const speechChips = [...chipsHTML, `<div class="owl-chip owl-chip-speak" onclick="openChatBar('${barTab}')">Поговорити</div>`];
    chipsEl.innerHTML = speechChips.join('');
    chipsEl.scrollLeft = 0;
    chipsEl.removeEventListener('scroll', chipsEl._arrowHandler);
    chipsEl._arrowHandler = () => _updateOwlTabChipsArrows(tab);
    chipsEl.addEventListener('scroll', chipsEl._arrowHandler, { passive: true });
    setTimeout(() => _updateOwlTabChipsArrows(tab), 50);
  }
}

// === WINDOW GLOBALS (HTML handlers only) ===
Object.assign(window, {
  toggleOwlTabChat, owlTabSwipeStart, owlTabSwipeMove, owlTabSwipeEnd,
  scrollOwlTabChips, owlChipToChat, openChatBar,
});
