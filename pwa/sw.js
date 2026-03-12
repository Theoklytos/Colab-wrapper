// sw.js — Service Worker for Colab Mobile PWA
// Cache strategy: app-shell cache-first, Google domains fully bypassed

const SHELL_CACHE = 'colab-shell-v1';
const RUNTIME_CACHE = 'colab-runtime-v1';

// All files that make up the app shell — pre-cached on install
const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.json',
  '/styles/tokens.css',
  '/styles/main.css',
  '/styles/animations.css',
  '/src/app.js',
  '/src/session.js',
  '/src/bookmarklet.js',
  '/src/theme.js',
  '/src/install-prompt.js',
  '/colab-css/colab-mobile.css',
  '/colab-css/colab-amoled.css',
  '/colab-css/colab-font.css',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

// Domains to NEVER intercept — caching any Google auth/session response breaks login
const BYPASS_HOSTNAMES = [
  'colab.research.google.com',
  'accounts.google.com',
  'oauth2.googleapis.com',
  'apis.google.com',
  'www.googleapis.com',
  'drive.google.com',
  'lh3.googleusercontent.com',
];

// ----------------------------------------------------------------
// Install: pre-cache the app shell
// ----------------------------------------------------------------
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then(cache => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
      .catch(err => console.error('[SW] Install cache failed:', err))
  );
});

// ----------------------------------------------------------------
// Activate: purge stale caches, claim all clients immediately
// ----------------------------------------------------------------
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key !== SHELL_CACHE && key !== RUNTIME_CACHE)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

// ----------------------------------------------------------------
// Fetch: routing strategy
// ----------------------------------------------------------------
self.addEventListener('fetch', event => {
  const { request } = event;

  // Skip non-HTTP schemes (chrome-extension://, etc.)
  if (!request.url.startsWith('http')) return;

  const url = new URL(request.url);

  // BYPASS: all Google domains — never cache, never intercept
  if (BYPASS_HOSTNAMES.some(h => url.hostname.includes(h))) return;

  // BYPASS: non-GET requests always go to network
  if (request.method !== 'GET') return;

  // App shell assets: cache-first
  const isShellAsset = SHELL_ASSETS.some(asset => {
    const assetPath = asset === '/' ? '/' : asset;
    return url.pathname === assetPath || url.pathname === asset;
  });

  if (isShellAsset) {
    event.respondWith(
      caches.match(request)
        .then(cached => cached || fetchAndCache(request, SHELL_CACHE))
        .catch(() => caches.match('/offline.html'))
    );
    return;
  }

  // Google Fonts: stale-while-revalidate (nice-to-have, not critical)
  if (url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com')) {
    event.respondWith(staleWhileRevalidate(request, RUNTIME_CACHE));
    return;
  }

  // Everything else: network-first, fall back to offline page
  event.respondWith(
    fetch(request)
      .catch(() => caches.match('/offline.html'))
  );
});

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------
async function fetchAndCache(request, cacheName) {
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(cacheName);
    cache.put(request, response.clone());
  }
  return response;
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const networkFetch = fetch(request).then(response => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  }).catch(() => null);
  return cached || await networkFetch;
}

// ----------------------------------------------------------------
// Messages from main thread
// ----------------------------------------------------------------
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data?.type === 'CACHE_BUST') {
    caches.delete(SHELL_CACHE);
  }
});
