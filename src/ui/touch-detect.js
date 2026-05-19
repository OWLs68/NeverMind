// === TOUCH DETECT (OBErR 19.05.2026) ===
// CSP-friendly заміна 8 inline ontouchstart/touchmove/touchend handler'ів
// (swipe-detect + tap-detect з координатними порогами). Дозволяє суворий
// CSP `script-src 'self'` без `unsafe-inline` коли DOM атрибутів onclick/
// ontouchend більше нема у HTML.
//
// === HTML КОНТРАКТ ===
//
// Swipe-detect (для OWL-board вертикального collapse/expand):
//   <div data-swipe-detect
//        data-swipe-action="owl-tab-swipe"
//        data-swipe-tab="inbox"
//        data-swipe-axis="y"           ← опц., default "y"
//        data-swipe-threshold="40">    ← опц., default 40px
//
// Tap-detect (для checkbox/галочок з swipe-vs-tap логікою):
//   <div data-tap-detect
//        data-tap-action="toggle-task-step"
//        data-task-id="${task.id}"
//        data-step-id="${s.id}"
//        data-tap-threshold="10">      ← опц., default 10px
//
// === REGISTRY (окремий від delegation.js ACTIONS) ===
//
// regTouch('action-name', (dataset, delta) => {...})
// — окрема signature бо touch handlers отримують delta (swipe) або тільки
//   dataset (tap). dataset = el.dataset (DOMStringMap, всі data-* як strings).
//
// === iOS QUIRKS ===
//
// 🔴 Pre-mortem #1: passive listeners — preventDefault працює ТIЛЬКИ якщо
//   addEventListener зробив явно {passive:false}. touchstart/touchmove ми
//   ставимо passive:true (browser може скролити вільно — не блокуємо).
//   touchend — passive:false (ghost-click prevention у tap branch).
//
// 🔴 Pre-mortem #2: глобальний preventDefault у touchmove зломить scroll
//   чіпів. Тому НЕ викликаємо preventDefault у touchmove handler — тільки
//   у touchend для tap-detect (де треба заблокувати synthetic click).
//
// 🟡 Pre-mortem #3: idempotency guard `_touchInitialized` — bfcache restore
//   або помилковий повторний bootApp не додасть другий listener.
//
// 🟡 Pre-mortem #4: bubble phase, НЕ capture (touchstart bubbles за дефолтом).
//
// 🟢 Pre-mortem #5: touchend використовує `changedTouches[0]` (палець що
//   щойно піднявся), не `touches[0]` (поточні активні — на touchend завжди []).

const _state = new WeakMap(); // element → {sx, sy, dy, dx}
const TOUCH_ACTIONS = Object.create(null);
let _touchInitialized = false;

export function regTouch(name, fn) {
  if (typeof name !== 'string' || !name) return;
  if (typeof fn !== 'function') return;
  TOUCH_ACTIONS[name] = fn;
}

export function initTouchDetect() {
  if (_touchInitialized) return;
  if (typeof document === 'undefined') return;
  document.body.addEventListener('touchstart', _onStart, { passive: true });
  document.body.addEventListener('touchmove',  _onMove,  { passive: true });
  document.body.addEventListener('touchend',   _onEnd,   { passive: false });
  _touchInitialized = true;
}

function _findTarget(eventTarget) {
  if (!eventTarget || typeof eventTarget.closest !== 'function') return null;
  return eventTarget.closest('[data-swipe-detect], [data-tap-detect]');
}

function _onStart(e) {
  const el = _findTarget(e.target);
  if (!el) return;
  const t = e.touches && e.touches[0];
  if (!t) return;
  _state.set(el, { sx: t.clientX, sy: t.clientY, dx: 0, dy: 0 });
}

function _onMove(e) {
  const el = _findTarget(e.target);
  if (!el) return;
  const s = _state.get(el);
  if (!s) return;
  const t = e.touches && e.touches[0];
  if (!t) return;
  s.dx = t.clientX - s.sx;
  s.dy = t.clientY - s.sy;
  // НЕ preventDefault — Pre-mortem #2: глобальний preventDefault зломив би
  // нативний scroll чіпів і сторінки.
}

function _onEnd(e) {
  const el = _findTarget(e.target);
  if (!el) return;
  const s = _state.get(el);
  if (!s) return;
  _state.delete(el);

  // Pre-mortem #5: touchend має 0 у `touches`, рух пальця тільки у `changedTouches`.
  const ct = e.changedTouches && e.changedTouches[0];
  const dx = ct ? ct.clientX - s.sx : s.dx;
  const dy = ct ? ct.clientY - s.sy : s.dy;

  // SWIPE branch
  if (el.hasAttribute('data-swipe-detect')) {
    const action = el.dataset.swipeAction;
    if (!action) return;
    const axis = el.dataset.swipeAxis || 'y';
    const threshold = parseInt(el.dataset.swipeThreshold, 10) || 40;
    const delta = axis === 'x' ? dx : dy;
    if (Math.abs(delta) < threshold) return; // не swipe — ігноруємо
    const fn = TOUCH_ACTIONS[action];
    if (typeof fn === 'function') {
      try { fn(el.dataset, delta, el); } catch (err) {
        console.error('[touch-detect] swipe «' + action + '» failed:', err);
      }
    }
    return;
  }

  // TAP branch
  if (el.hasAttribute('data-tap-detect')) {
    const action = el.dataset.tapAction;
    if (!action) return;
    const threshold = parseInt(el.dataset.tapThreshold, 10) || 10;
    if (Math.abs(dx) >= threshold || Math.abs(dy) >= threshold) return; // це swipe, не tap
    // Pre-mortem #1: preventDefault у touchend (passive:false) — блокує
    // synthetic click що iOS генерує після touchend. Без цього handler може
    // викликатись двічі через touch + click.
    e.preventDefault();
    const fn = TOUCH_ACTIONS[action];
    if (typeof fn === 'function') {
      try { fn(el.dataset, 0, el); } catch (err) {
        console.error('[touch-detect] tap «' + action + '» failed:', err);
      }
    }
  }
}
