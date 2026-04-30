// === UNIVERSAL SWIPE DELETE TRAIL (#32) ===
import { t } from '../core/utils.js';

export const SWIPE_DELETE_THRESHOLD = 90; // єдиний поріг для всіх вкладок

// === SWIPE-OPEN DELETE (B-54 механізм Фінансів, винесений 18.04.2026 14zLe) ===
// Базова логіка видалення карток у застосунку (як glass-стиль модалок).
// Свайп вліво → з'являється кнопка-кошик справа → тап = видалення з undo.
// Свайп вправо при відкритому стані = закриття. Тап на картку при відкритому = закриття.
//
// Використання:
//   attachSwipeDelete(wrapEl, cardEl, onDelete, opts?)
//   - wrapEl: обгортка з position:relative; overflow:hidden
//   - cardEl: картка всередині яка рухатиметься translateX
//   - onDelete: callback викликається коли юзер тапнув кошик
//   - opts.openRatio (0.22 default): пропорція відкриття (від ширини обгортки)
//   - opts.binBgColor: основний колір градієнта кошика (default #ef4444)
//
// HTML-структура:
//   <div class="any-wrap" style="position:relative;overflow:hidden;border-radius:10px">
//     <div class="any-card">...</div>
//   </div>
//
// idempotent: повторні виклики на тому ж wrapEl ігноруються (через _swipeOpenBound).
export function attachSwipeDelete(wrapEl, cardEl, onDelete, opts = {}) {
  if (!wrapEl || !cardEl || wrapEl._swipeOpenBound) return;
  wrapEl._swipeOpenBound = true;
  const openRatio = opts.openRatio || 0.5;
  const binBg = opts.binBgColor || '239,68,68'; // RGB triple для градієнта

  let startX = 0, startY = 0, dx = 0, locked = false;
  let bin = null;

  const ensureBin = () => {
    if (bin) return;
    const w = Math.round(wrapEl.offsetWidth * openRatio);
    bin = document.createElement('button');
    bin.className = 'swipe-open-bin';
    bin.setAttribute('aria-label', t('swipe.delete_button', 'Видалити'));
    bin.style.cssText = `position:absolute;right:0;top:0;bottom:0;width:${w}px;display:flex;align-items:center;justify-content:flex-end;padding-right:22px;background:linear-gradient(to right, rgba(${binBg},0) 0%, rgba(${binBg},0.95) 75%);border:none;cursor:pointer;z-index:0;font-family:inherit;border-radius:0 10px 10px 0`;
    bin.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';
    bin.addEventListener('click', (e) => {
      e.stopPropagation();
      try { onDelete(); } catch(err) { console.error('[swipe-delete] onDelete error:', err); }
    });
    wrapEl.appendChild(bin);
  };

  const removeBin = () => {
    if (bin && bin.parentNode) bin.parentNode.removeChild(bin);
    bin = null;
  };

  const getOpenOffset = () => -Math.round(wrapEl.offsetWidth * openRatio);
  const setOffset = (offset, animate = false) => {
    cardEl.style.transition = animate ? 'transform 0.25s ease' : '';
    cardEl.style.transform = `translateX(${offset}px)`;
  };
  const openSwipe = () => {
    wrapEl._open = true;
    ensureBin();
    if (bin) { bin.style.transition = 'opacity 0.25s ease'; bin.style.opacity = '1'; }
    setOffset(getOpenOffset(), true);
  };
  const closeSwipe = () => {
    wrapEl._open = false;
    if (bin) { bin.style.transition = 'opacity 0.25s ease'; bin.style.opacity = '0'; }
    setOffset(0, true);
    setTimeout(() => { if (!wrapEl._open) removeBin(); }, 280);
  };

  // Тап на картку при відкритому свайпі → закриваємо (не відкриваємо інший action)
  cardEl.addEventListener('click', (e) => {
    if (wrapEl._open) { e.stopPropagation(); e.preventDefault(); closeSwipe(); }
  }, true);

  wrapEl.addEventListener('touchstart', (e) => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    dx = 0; locked = false;
    cardEl.style.transition = '';
  }, { passive: true });

  wrapEl.addEventListener('touchmove', (e) => {
    if (locked) return;
    const ddx = e.touches[0].clientX - startX;
    const ddy = e.touches[0].clientY - startY;
    if (Math.abs(dx) < 5 && Math.abs(ddy) > Math.abs(ddx)) { locked = true; return; }
    dx = ddx;
    if (dx < 0 && !wrapEl._open && !bin) ensureBin();
    const baseOffset = wrapEl._open ? getOpenOffset() : 0;
    const newOffset = Math.min(0, baseOffset + dx);
    setOffset(newOffset);
  }, { passive: true });

  wrapEl.addEventListener('touchend', () => {
    if (locked) { if (wrapEl._open) openSwipe(); else closeSwipe(); return; }
    const threshold = wrapEl.offsetWidth * openRatio * 0.5;
    if (wrapEl._open) {
      if (dx > 30) closeSwipe(); else openSwipe();
    } else {
      if (dx < -threshold) openSwipe(); else closeSwipe();
    }
  }, { passive: true });
}

// Застосовує червоний градієнтний шлейф і рух картки
// el = картка (рухається), wrapEl = wrapper
export function applySwipeTrail(cardEl, wrapEl, dx) {
  if (!cardEl) return;
  cardEl.style.transform = `translateX(${dx}px)`;
  if (!wrapEl) return;

  const progress = Math.min(1, -dx / 160);

  // Знаходимо або створюємо trail div всередині wrapper
  let trail = wrapEl.querySelector('.swipe-trail');
  if (!trail) {
    trail = document.createElement('div');
    trail.className = 'swipe-trail';
    trail.style.cssText = 'position:absolute;top:0;bottom:0;right:0;pointer-events:none;border-radius:inherit;z-index:0';
    wrapEl.appendChild(trail);
  }

  if (progress <= 0) {
    trail.style.background = '';
    trail.style.width = '0';
    return;
  }

  // Ширина шлейфу = скільки відкрилось (картка зсунулась вліво)
  const trailWidth = Math.round(-dx);
  const alpha = (0.2 + progress * 0.8).toFixed(2);
  trail.style.width = trailWidth + 'px';
  trail.style.background = `linear-gradient(to right, transparent 0%, rgba(239,68,68,${alpha}) 100%)`;
}

// Скидає шлейф після відпускання
export function clearSwipeTrail(cardEl, wrapEl) {
  if (cardEl) {
    cardEl.style.transition = 'transform 0.25s ease';
    cardEl.style.transform = 'translateX(0)';
    setTimeout(() => { if (cardEl) cardEl.style.transition = ''; }, 300);
  }
  if (wrapEl) {
    const trail = wrapEl.querySelector('.swipe-trail');
    if (trail) {
      trail.style.transition = 'opacity 0.25s ease';
      trail.style.opacity = '0';
      setTimeout(() => { if (trail) { trail.style.opacity = ''; trail.style.width = '0'; trail.style.background = ''; trail.style.transition = ''; } }, 300);
    }
  }
}

