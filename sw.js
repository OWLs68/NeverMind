// sw.js — NeverMind Service Worker
// Механізм 3: офлайн-кешування статичних файлів застосунку
//
// СТРАТЕГІЯ КЕШУ (B-73 fix 17.04.2026 cnTkD):
//   - Наш код (index.html / bundle.js / style.css) → network-first + cache fallback.
//     Онлайн = завжди свіжа версія, офлайн = з кешу. iOS PWA більше не застрягає на старому.
//   - Інші файли (картинки, fonts) → cache-first як раніше.
//   - SKIP_WAITING повідомлення від клієнта → self.skipWaiting() → controllerchange → reload.

const CACHE_NAME = 'nm-20260503-1410';

// Список файлів які кешуємо при встановленні
const STATIC_ASSETS = [
  './',
  './index.html',
  './style.css',
  './bundle.js',
];

// Встановлення: кешуємо всі статичні файли (cache-bust через timestamp для iOS PWA)
self.addEventListener('install', e => {
  const bust = '?v=' + CACHE_NAME;
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => Promise.all(
        STATIC_ASSETS.map(url =>
          fetch(url + bust, { cache: 'reload' }).then(r => {
            if (!r.ok) throw new Error(url + ' ' + r.status);
            return cache.put(url, r);
          })
        )
      ))
      .then(() => self.skipWaiting())
  );
});

// Активація: видаляємо старі версії кешу
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim()) // беремо контроль над всіма вкладками
  );
});

// B-73: SKIP_WAITING — клієнт просить новий SW активуватись негайно (без чекання всіх закладок).
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// B-73: визначаємо "наш код" — завжди через мережу коли онлайн.
function _isOurCode(url) {
  const p = url.pathname;
  return p === '/' || p.endsWith('/') || p.endsWith('/index.html')
    || p.endsWith('/bundle.js') || p.endsWith('/style.css')
    || p.endsWith('/sw.js') || p.endsWith('/manifest.json');
}

// Обробка запитів: network-first для нашого коду, cache-first для решти
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);

  // Зовнішні запити (Google Fonts, OpenAI API) — тільки мережа
  if (url.origin !== self.location.origin) {
    e.respondWith(
      fetch(e.request).catch(() => new Response('', { status: 503, statusText: 'Offline' }))
    );
    return;
  }

  // B-73: network-first для нашого коду (завжди свіжа версія коли онлайн)
  if (_isOurCode(url)) {
    e.respondWith(
      fetch(e.request).then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone)).catch(() => {});
        }
        return response;
      }).catch(() => caches.match(e.request).then(c => c || caches.match('./index.html')))
    );
    return;
  }

  // Інші файли (картинки, шрифти): cache-first
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone)).catch(() => {});
        }
        return response;
      }).catch(() => caches.match('./index.html'));
    })
  );
});
