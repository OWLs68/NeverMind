// modal-overlay-sync.js — автоматична синхронізація overlay з модалкою.
//
// КОНТЕКСТ (UvEHE 03.05): iOS Safari має quirk — backdrop-filter:blur на overlay,
// що є дитиною root-модалки, клипається до transformed composite-region коли
// картка отримує transform:translateY (свайп вниз). Візуально blur «зменшується»
// з усіх боків. Ескпериментально підтверджено: винесення overlay як top-level
// sibling (не дитина модалки) фіксить — overlay має власний composite layer
// прив'язаний до viewport.
//
// Цей модуль автоматично синхронізує display overlay з модалкою через
// MutationObserver. Існуючі open*Modal/close*Modal функції НЕ чіпаємо.
//
// Конвенція: для модалки `#X-modal` — overlay має id `#X-modal-overlay`
// як top-level sibling у index.html.

function syncOverlay(modal) {
  const overlay = document.getElementById(modal.id + '-overlay');
  if (!overlay) return;
  const visible = modal.style.display && modal.style.display !== 'none';
  overlay.style.display = visible ? 'block' : 'none';
}

function initModalOverlaySync() {
  const modals = document.querySelectorAll('[id$="-modal"]');
  modals.forEach(modal => {
    const overlay = document.getElementById(modal.id + '-overlay');
    if (!overlay) return;
    syncOverlay(modal); // початковий стан
    new MutationObserver(() => syncOverlay(modal))
      .observe(modal, { attributes: true, attributeFilter: ['style'] });
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initModalOverlaySync);
} else {
  initModalOverlaySync();
}
