const CACHE_NAME = 'bilingual-radio-v2.7.0';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
  '/favicon.ico',
  '/icon.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    }).catch((err) => {
      console.warn('[SW] Precache failed:', err);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Deleting old cache key:', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('message', (event) => {
  if (event.data && (event.data.type === 'SKIP_WAITING' || event.data.type === 'PURGE_CACHE')) {
    self.skipWaiting();
    caches.keys().then((keys) => {
      keys.forEach((key) => caches.delete(key));
    });
  }
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith('http')) return;

  const url = new URL(event.request.url);

  // NEVER cache API requests, Vite dev scripts, modules, or HMR requests
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/@') ||
    url.pathname.startsWith('/src/') ||
    url.pathname.startsWith('/node_modules/') ||
    url.search.includes('t=') ||
    url.search.includes('import') ||
    url.pathname.endsWith('.tsx') ||
    url.pathname.endsWith('.ts')
  ) {
    return;
  }

  const isNavigation =
    event.request.mode === 'navigate' ||
    url.pathname === '/' ||
    url.pathname.endsWith('.html');

  // Instant offline navigation strategy: serve cached HTML immediately when offline or on network failure
  if (isNavigation) {
    event.respondWith(
      (async () => {
        // If device is offline, return cached page immediately
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          const cachedPage =
            (await caches.match(event.request, { ignoreSearch: true })) ||
            (await caches.match('/')) ||
            (await caches.match('/index.html'));
          if (cachedPage) return cachedPage;
        }

        // Fetch fresh page from network first without artificial timeout
        try {
          const networkResponse = await fetch(event.request);
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            const cache = await caches.open(CACHE_NAME);
            cache.put(event.request, responseToCache);
            return networkResponse;
          }
        } catch (e) {
          console.warn('[SW] Navigation network fetch failed. Falling back to offline cache.', e);
        }

        const fallbackPage =
          (await caches.match(event.request, { ignoreSearch: true })) ||
          (await caches.match('/')) ||
          (await caches.match('/index.html'));

        return fallbackPage || fetch(event.request);
      })()
    );
    return;
  }

  // Stale-While-Revalidate & Cache-First strategy for JS, CSS, fonts, and assets
  event.respondWith(
    (async () => {
      const cachedResponse = await caches.match(event.request, { ignoreSearch: true });

      // If offline, return cached response immediately
      if (typeof navigator !== 'undefined' && !navigator.onLine && cachedResponse) {
        return cachedResponse;
      }

      // Revalidate in background if online
      const fetchPromise = fetch(event.request)
        .then(async (networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const responseToCache = networkResponse.clone();
            const cache = await caches.open(CACHE_NAME);
            cache.put(event.request, responseToCache);
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })()
  );
});


