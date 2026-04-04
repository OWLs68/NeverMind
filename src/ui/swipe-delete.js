// === UNIVERSAL SWIPE DELETE TRAIL (#32) ===
export const SWIPE_DELETE_THRESHOLD = 90; // єдиний поріг для всіх вкладок

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

