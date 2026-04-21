import { openChatBar } from '../ai/core.js';
import { renderChips } from './chips.js';
import { getCurrentMessage, getTabMessages, saveTabMessage } from './unified-storage.js';

// === OWL TAB BOARDS (#37) ===
export const OWL_TAB_BOARD_MIN_INTERVAL = 30 * 60 * 1000; // 30 хвилин між оновленнями

// Шар 2 "Один мозок V2" (21.04 rJYkw): tab-specific TS-ключі лишаються для
// Judge Layer таймерів (різний темп оновлень per tab) — це не шкодить єдиному
// сховищу повідомлень.
export function getOwlTabTsKey(tab) { return 'nm_owl_tab_ts_' + tab; }

// Обгортка над unified storage — повертає повідомлення які генерувались для
// конкретної вкладки (для історії, Judge Layer тощо). Для рендеру на табло
// використовуй getCurrentMessage() — воно ЄДИНЕ на всі вкладки.
export function getTabBoardMsgs(tab) {
  return getTabMessages(tab);
}
export function saveTabBoardMsg(tab, newMsg) {
  saveTabMessage(tab, newMsg);
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

// Рендер табло. Шар 2 "Один мозок V2": повідомлення ЄДИНЕ на всіх вкладках —
// береться з unified storage через getCurrentMessage(). При переключенні між
// вкладками юзер бачить ТЕ САМЕ повідомлення (нема мигання "дві різні сови").
// Нове повідомлення зʼявляється лише коли мозок згенерував його (API або fallback).
export function renderTabBoard(tab) {
  const isInbox = tab === 'inbox';
  const board = document.getElementById(isInbox ? 'owl-board' : 'owl-tab-board-' + tab);
  if (!board) return;
  board.style.display = 'block';

  // Єдине повідомлення на всі вкладки
  let msg = getCurrentMessage();
  if (!msg) {
    // Перший запуск — дефолт для поточної вкладки, зберігаємо в unified
    const defaults = { inbox:'Привіт! Напиши що завгодно — я допоможу.', tasks:'Що будемо робити сьогодні?', finance:'Тапни категорію щоб записати витрату.', notes:'Запиши думку або ідею 📝', health:'Як самопочуття?', evening:'Як пройшов день?', me:'Подивимось на тиждень.', projects:'Працюємо над проектами.' };
    const defMsg = { text: defaults[tab] || 'Привіт!', priority:'normal', chips:[], ts: Date.now() };
    msg = saveTabMessage(tab, defMsg);
  }

  // Ініціалізація структури — один раз (inbox вже має HTML в index.html)
  if (!board._owlReady) {
    if (!isInbox) board.innerHTML = _owlTabHTML(tab);
    board._owlReady = true;
    _owlTabStates[tab] = _owlTabStates[tab] || 'speech';
    _owlTabApplyState(tab);
  }

  const tEl = document.getElementById('owl-tab-text-' + tab);
  const cEl = document.getElementById('owl-tab-ctext-' + tab);
  const tmEl = document.getElementById('owl-tab-time-' + tab);

  // Fade-транзиція при зміні тексту (Фаза 3 робить красиво — зараз миттєво).
  // Placeholder: підготуємо структуру яку Фаза 3 замінить на opacity-fade.
  _applyTabText(tEl, msg.text);
  _applyTabText(cEl, msg.text);
  if (tmEl) tmEl.textContent = '';

  const chipsEl = document.getElementById('owl-tab-chips-' + tab);
  if (chipsEl) {
    renderChips(chipsEl, msg.chips || [], tab, { showSpeak: true });
    chipsEl.removeEventListener('scroll', chipsEl._arrowHandler);
    chipsEl._arrowHandler = () => _updateOwlTabChipsArrows(tab);
    chipsEl.addEventListener('scroll', chipsEl._arrowHandler, { passive: true });
    setTimeout(() => _updateOwlTabChipsArrows(tab), 50);
  }
}

// Фаза 3 розширить цю функцію fade-транзицією. Зараз — миттєво.
function _applyTabText(el, text) {
  if (!el) return;
  el.textContent = text;
}

// === WINDOW GLOBALS (HTML handlers only) ===
Object.assign(window, {
  toggleOwlTabChat, owlTabSwipeStart, owlTabSwipeMove, owlTabSwipeEnd,
  scrollOwlTabChips, openChatBar,
});

