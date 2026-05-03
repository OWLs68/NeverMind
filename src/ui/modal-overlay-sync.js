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

function _registerModal(modal) {
  if (!modal || _registered.has(modal)) return;
  _registered.add(modal);

  // Якщо overlay-sibling нема — перевіряємо чи є дитячий, виносимо
  if (!document.getElementById(modal.id + '-overlay')) {
    const child = _findChildOverlay(modal);
    if (child) _externalizeOverlay(modal, child);
  }

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
