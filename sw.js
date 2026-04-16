// sw.js — NeverMind Service Worker
// Механізм 3: офлайн-кешування статичних файлів застосунку
//
// Як це працює:
//   1. При першому відвідуванні — завантажуємо і кешуємо всі файли
//   2. При наступних відвідуваннях — спочатку з кешу (миттєво), потім з мережі
//   3. Якщо немає інтернету — все одно відкривається з кешу
//   4. При оновленні версії — старий кеш автоматично видаляється

const CACHE_NAME = 'nm-20260416-1627';

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

// Обробка запитів: cache-first для наших файлів, network для решти
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

  // Наші файли: спочатку кеш, якщо немає — мережа + зберегти в кеш
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        }
        return response;
      }).catch(() => caches.match('./index.html')); // fallback на головну сторінку
    })
  );
});
