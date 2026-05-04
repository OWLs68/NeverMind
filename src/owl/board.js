import { openChatBar } from '../ai/core.js';
import { renderChips } from './chips.js';
import { getCurrentMessage, getTabMessages, getUnifiedBoard, saveTabMessage, downgradeBriefingPriority, downgradeStaleCriticalPriority } from './unified-storage.js';
import { isMessageRelevant } from './board-utils.js';

// === OWL TAB BOARDS (#37) ===
export const OWL_TAB_BOARD_MIN_INTERVAL = 30 * 60 * 1000; // 30 хвилин між оновленнями

// Шар 2 "Один мозок V2" (21.04 rJYkw): tab-specific TS-ключі лишаються для
// Judge Layer таймерів (різний темп оновлень per tab) — це не шкодить єдиному
// сховищу повідомлень.
export function getOwlTabTsKey(tab) { return 'nm_owl_tab_ts_' + tab; }

// Обгортка над unified storage — повертає повідомлення які генерувались для
// конкретної вкладки (для історії, Judge Layer тощо). Для рендеру на табло
// використовуй getCurrentMessage() — воно ЄДИНЕ на всі вкладки.
//
// Pruning Engine (Фаза 2 UVKL1): фільтр isMessageRelevant викидає повідомлення
// з посиланнями на вже-неактивні сутності (закриті задачі, виконані звички тощо).
// Завдяки цьому при nm-data-changed re-render UI старі бабли зникають миттєво.
export function getTabBoardMsgs(tab) {
  return getTabMessages(tab).filter(isMessageRelevant);
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

// Шар 2 "Один мозок V2" Фаза 3 (rJYkw 21.04.2026): ПРИЗМА ВКЛАДКИ + ПРОБІЙ КРИТИЧНИХ.
// Правило: показуємо найсвіжіше повідомлення де (forTab === tab) АБО (priority === 'critical').
// Критичні (нагадування, дедлайни <1год) пробивають фільтр і видно СКРІЗЬ, як push-сповіщення.
// Рядові — тільки на своїй вкладці, щоб на Фінансах не мигало про задачі.
// Якщо для вкладки немає нічого — fallback на глобальне найсвіжіше.
function _pickMessageForTab(tab) {
  // Pruning Engine (Фаза 2 UVKL1): викидаємо повідомлення з посиланнями на
  // неактивні сутності перед вибором. Якщо найсвіжіше критичне посилається
  // на вже-закриту задачу — воно зникає, наступне за пріоритетом виходить наперед.
  // Pruning Engine (Фаза 2 UVKL1) + Phase 11b (RGisY 04.05) — Регресія 3 fix:
  // ЛОКАЛЬНО фільтруємо stale critical (>2 год) ДО будь-якого вибору. Раніше
  // фікс B-117 v1 викликав downgradeBriefingPriority() але читав all[0] зі
  // старим priority у локальній змінній → fallback повертав stale брифінг
  // на іншому табі. Тепер: фільтр first → масив без stale critical →
  // fallback all[0] вже свіжий. Auto-downgrade для майбутніх викликів.
  const CRITICAL_TTL = 2 * 60 * 60 * 1000;
  const now = Date.now();
  let raw = getUnifiedBoard().filter(isMessageRelevant);
  let didDowngrade = false;
  raw.forEach(m => {
    if (m.priority === 'critical' && (now - (m.ts || m.id || 0)) >= CRITICAL_TTL) {
      m.priority = 'normal'; // локальна правка для поточного виклику
      didDowngrade = true;
    }
  });
  if (didDowngrade) {
    // Phase 13 (RGisY 04.05) — Регресія 5 fix: downgradeStaleCriticalPriority
    // покриває ВСІ critical, не тільки 'morning-briefing'. Раніше нагадування,
    // дедлайни і тривоги healthу лишались у storage critical вічно.
    try { downgradeStaleCriticalPriority(CRITICAL_TTL); } catch(e) { console.warn('[board] downgradeStaleCriticalPriority failed', e); }
  }
  if (raw.length === 0) return null;
  // 1. Найсвіжіше критичне (свіже <2 год) пробиває фільтр — Jarvis-пуш.
  if (raw[0].priority === 'critical') return raw[0];
  // 2. Найсвіжіше повідомлення для цієї вкладки
  const tabMsg = raw.find(m => m.forTab === tab);
  if (tabMsg) return tabMsg;
  // 3. Немає для вкладки — покажемо глобальне (краще щось ніж дефолт)
  return raw[0];
}

// Рендер табло з призмою вкладки. При переключенні юзер бачить або своє повідомлення
// (якщо є), або критичне з будь-якої вкладки (якщо щось терміново). Перехід плавний
// через fade 200мс (CSS transition на opacity).
export function renderTabBoard(tab) {
  const isInbox = tab === 'inbox';
  const board = document.getElementById(isInbox ? 'owl-board' : 'owl-tab-board-' + tab);
  if (!board) return;
  board.style.display = 'block';

  let msg = _pickMessageForTab(tab);
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

  _renderSilenceBadge(board, tab);

  const tEl = document.getElementById('owl-tab-text-' + tab);
  const cEl = document.getElementById('owl-tab-ctext-' + tab);
  const tmEl = document.getElementById('owl-tab-time-' + tab);

  // Плавна fade-транзиція при зміні тексту (CSS transition opacity 0.2s)
  _applyTabText(tEl, msg.text);
  _applyTabText(cEl, msg.text);

  // Сірий підпис "N хв тому" якщо повідомлення протухло (>10 хв).
  // Gemini ідея — замість згортання показуємо що думка стара, без мигання UI.
  if (tmEl) {
    const ageMs = Date.now() - (msg.ts || msg.id || 0);
    const ageMin = Math.floor(ageMs / 60000);
    if (ageMin > 10) {
      tmEl.textContent = '• ' + (ageMin < 60 ? ageMin + ' хв тому' : Math.floor(ageMin / 60) + ' год тому');
      tmEl.classList.add('owl-time-stale');
    } else {
      tmEl.textContent = '';
      tmEl.classList.remove('owl-time-stale');
    }
  }

  const chipsEl = document.getElementById('owl-tab-chips-' + tab);
  if (chipsEl) {
    renderChips(chipsEl, msg.chips || [], tab, { showSpeak: true });
    chipsEl.removeEventListener('scroll', chipsEl._arrowHandler);
    chipsEl._arrowHandler = () => _updateOwlTabChipsArrows(tab);
    chipsEl.addEventListener('scroll', chipsEl._arrowHandler, { passive: true });
    setTimeout(() => _updateOwlTabChipsArrows(tab), 50);
  }
}

// Плавна зміна тексту через opacity (CSS transition на .owl-speech-text).
// Перший рендер (порожній textContent) — без fade. Зміни — fade-out 200мс → текст → fade-in 200мс.
// Якщо новий текст = старий, нічого не робимо (уникаємо зайвого мигання).
function _applyTabText(el, text) {
  if (!el) return;
  const current = el.textContent || '';
  if (current === text) return;
  if (current === '') {
    el.textContent = text;
    el.style.opacity = '1';
    return;
  }
  el.style.opacity = '0';
  setTimeout(() => {
    el.textContent = text;
    el.style.opacity = '1';
  }, 200);
}

// === WINDOW GLOBALS (HTML handlers only) ===
Object.assign(window, {
  toggleOwlTabChat, owlTabSwipeStart, owlTabSwipeMove, owlTabSwipeEnd,
  scrollOwlTabChips, openChatBar, cancelOwlSilenceFromBadge,
});

// Silence Engine UI-індикатор (Фаза 1+ UVKL1 30.04 xHQfi):
// Плашка зверху board «🤫 Сова мовчить до HH:MM. Тапни щоб скасувати».
// Видно поки nm_owl_silence_until у майбутньому. Тап — скасовує тишу
// і dispatchEvent nm-data-changed → всі активні таб-board перерендерять.
function _renderSilenceBadge(board, tab) {
  const badgeId = `owl-silence-badge-${tab}`;
  let badge = board.querySelector(`#${badgeId}`);
  const until = parseInt(localStorage.getItem('nm_owl_silence_until') || '0');
  const active = until > Date.now();

  if (!active) {
    if (badge) badge.remove();
    return;
  }

  const endTime = new Date(until).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
  const text = `🤫 Сова мовчить до ${endTime}. Тапни щоб скасувати.`;

  if (!badge) {
    badge = document.createElement('div');
    badge.id = badgeId;
    badge.className = 'owl-silence-badge';
    badge.setAttribute('role', 'button');
    badge.onclick = cancelOwlSilenceFromBadge;
    board.insertAdjacentElement('afterbegin', badge);
  }
  if (badge.textContent !== text) badge.textContent = text;
}

export function cancelOwlSilenceFromBadge() {
  localStorage.removeItem('nm_owl_silence_until');
  try { window.dispatchEvent(new CustomEvent('nm-data-changed', { detail: 'silence' })); } catch {}
}

// Перерендер усіх активних таб-board при зміні тиші (старт/скасування/закінчення)
window.addEventListener('nm-data-changed', (e) => {
  if (e.detail !== 'silence') return;
  ['inbox','tasks','finance','notes','health','evening','me','projects'].forEach(tab => {
    const el = document.getElementById(tab === 'inbox' ? 'owl-board' : 'owl-tab-board-' + tab);
    if (el && el._owlReady) _renderSilenceBadge(el, tab);
  });
});

