// modal-overlay-sync.js — автоматична синхронізація overlay з модалкою.
//
// КОНТЕКСТ (UvEHE 03.05): iOS Safari має quirk — backdrop-filter:blur на overlay,
// що є дитиною root-модалки, клипається до transformed composite-region коли
// картка отримує transform:translateY (свайп вниз). Візуально blur «зменшується»
// з усіх боків. Фікс: винести overlay як top-level sibling (НЕ дитина модалки) —
// овray має власний composite layer прив'язаний до viewport.
//
// Цей модуль робить це АВТОМАТИЧНО:
// 1. На init — для статичних модалок з #X-modal-overlay sibling: реєструє
//    MutationObserver на style модалки → display sync.
// 2. На init — якщо модалка має дитячий overlay-div (старий патерн), виносить
//    його як top-level sibling з id #X-modal-overlay.
// 3. body MutationObserver childList — те саме для динамічно створюваних модалок
//    (finance-modals.js, fin-analytics, etc.) — при додаванні нової `[id$="-modal"]`
//    автоматично переробляє її та реєструє sync.
//
// Конвенція: для модалки `#X-modal` — overlay має id `#X-modal-overlay`.

const _registered = new WeakSet();

function syncOverlay(modal) {
  const overlay = document.getElementById(modal.id + '-overlay');
  if (!overlay) return;
  const visible = modal.style.display && modal.style.display !== 'none';
  overlay.style.display = visible ? 'block' : 'none';
}

// Шукає дитячий overlay-div у модалці (старий патерн): position:absolute,
// inset:0, є backdrop-filter або background rgba у стилях.
function _findChildOverlay(modal) {
  for (const child of modal.children) {
    if (child.tagName !== 'DIV') continue;
    const s = child.getAttribute('style') || '';
    const cls = child.className || '';
    const hasBlur = /backdrop-filter\s*:\s*blur/i.test(s) || /modal-backdrop/.test(cls);
    const isAbsolute = /position\s*:\s*absolute/i.test(s);
    const hasInset = /inset\s*:\s*0/i.test(s) || (/top\s*:\s*0/i.test(s) && /left\s*:\s*0/i.test(s));
    if (hasBlur && (isAbsolute || hasInset)) return child;
  }
  return null;
}

// Переносить дитячий overlay як top-level sibling з id #X-overlay.
// Створює fixed-position копію (background+blur), видаляє оригінал.
function _externalizeOverlay(modal, childOverlay) {
  if (!childOverlay) return null;
  const overlayId = modal.id + '-overlay';
  if (document.getElementById(overlayId)) return document.getElementById(overlayId);

  const newOverlay = document.createElement('div');
  newOverlay.id = overlayId;
  // Витягуємо background + blur зі старого, додаємо position:fixed + pointer-events:none
  const oldStyle = childOverlay.getAttribute('style') || '';
  const oldClass = childOverlay.className || '';
  // Якщо клас modal-backdrop — переносимо клас (стилі у CSS)
  if (/modal-backdrop/.test(oldClass)) newOverlay.className = oldClass;
  // Базовий стиль fixed sibling. Background/blur беремо зі старого style або з CSS-класу.
  const zIndex = (parseInt(modal.style.zIndex, 10) || 200) - 1;
  let bg = '', blur = '';
  const bgMatch = oldStyle.match(/background\s*:\s*([^;]+)/i);
  if (bgMatch) bg = `background:${bgMatch[1]};`;
  const blurMatch = oldStyle.match(/backdrop-filter\s*:\s*([^;]+)/i);
  if (blurMatch) blur = `backdrop-filter:${blurMatch[1]};-webkit-backdrop-filter:${blurMatch[1]};`;
  newOverlay.style.cssText = `display:none;position:fixed;inset:0;z-index:${zIndex};${bg}${blur}pointer-events:none`;

  // Click-handler з оригіналу переносимо на root модалки (тапи по фону закривають)
  const onclickAttr = childOverlay.getAttribute('onclick');
  if (onclickAttr && !modal.getAttribute('onclick')) {
    modal.setAttribute('onclick', `if(event.target===this){${onclickAttr}}`);
  }

  // Вставляємо overlay як sibling ПЕРЕД модалкою + видаляємо старий child
  modal.parentNode.insertBefore(newOverlay, modal);
  childOverlay.remove();
  return newOverlay;
}

// Універсальний swipe-to-close для модалок. Не реєструється якщо tasks.js
// setupModalSwipeClose вже додав свій (прапорець contentEl._swipeClose).
// УВАГА: ТІЛЬКИ для bottom-sheet (align-items:flex-end) — повноекранні
// модалки (note-view, task-chat, health-export) НЕ повинні мати swipe-close
// бо там transform тягне шапку вниз.
function _setupSwipeClose(modal) {
  const style = modal.getAttribute('style') || '';
  if (!/align-items\s*:\s*flex-end/i.test(style)) return; // не bottom-sheet
  // Шукаємо картку (єдину non-overlay дитину) — після _externalizeOverlay
  // overlay винесений, тож children[0] зазвичай це картка.
  const card = modal.querySelector(':scope > div');
  if (!card || card._swipeClose) return; // tasks.js вже зареєстрував
  card._swipeClose = true;
  let startY = 0, startX = 0, dy = 0, blocked = false;
  modal.addEventListener('touchstart', e => {
    blocked = !!e.target.closest('.drum-col, .drum-item, .settings-scroll, input, textarea, select');
    startY = e.touches[0].clientY;
    startX = e.touches[0].clientX;
    dy = 0;
    if (!blocked) card.style.transition = 'none';
  }, { passive: true });
  modal.addEventListener('touchmove', e => {
    if (blocked) return;
    dy = e.touches[0].clientY - startY;
    const dx = Math.abs(e.touches[0].clientX - startX);
    if (dy > 0 && dy > dx) {
      card.style.transform = `translateY(${dy}px)`;
    }
  }, { passive: true });
  modal.addEventListener('touchend', () => {
    if (blocked) { blocked = false; return; }
    card.style.transition = 'transform 0.25s ease';
    if (dy > 80) {
      card.style.transform = 'translateY(100%)';
      setTimeout(() => {
        card.style.transform = '';
        // Симуляція click на root з target=root → спрацьовує onclick="if(event.target===this){closeXxx()}"
        modal.click();
      }, 250);
    } else {
      card.style.transform = '';
    }
    dy = 0;
  }, { passive: true });
}

function _registerModal(modal) {
  if (!modal || _registered.has(modal)) return;
  _registered.add(modal);

  // Якщо overlay-sibling нема — перевіряємо чи є дитячий, виносимо
  if (!document.getElementById(modal.id + '-overlay')) {
    const child = _findChildOverlay(modal);
    if (child) _externalizeOverlay(modal, child);
  }

  // Універсальний swipe-close (якщо tasks.js не зареєстрував)
  _setupSwipeClose(modal);

  syncOverlay(modal); // початковий стан
  new MutationObserver(() => syncOverlay(modal))
    .observe(modal, { attributes: true, attributeFilter: ['style'] });
}

function initModalOverlaySync() {
  // 1) Усі існуючі модалки
  document.querySelectorAll('[id$="-modal"]').forEach(_registerModal);

  // 2) Динамічно додані модалки (finance-modals.js, fin-analytics, etc.)
  new MutationObserver(records => {
    for (const r of records) {
      r.addedNodes.forEach(node => {
        if (node.nodeType !== 1) return; // Element only
        if (node.id && node.id.endsWith('-modal')) {
          _registerModal(node);
        } else {
          // Можливо контейнер з модалкою всередині
          if (node.querySelectorAll) {
            node.querySelectorAll('[id$="-modal"]').forEach(_registerModal);
          }
        }
      });
    }
  }).observe(document.body, { childList: true, subtree: false });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initModalOverlaySync);
} else {
  initModalOverlaySync();
}
