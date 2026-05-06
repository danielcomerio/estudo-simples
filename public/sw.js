/* Estudo Simples — Service Worker
 *
 * Estratégia minimalista, conservadora:
 *  - Network-first pra HTML/JSON (rotas SPA + API)
 *  - Stale-while-revalidate pra _next/static/*
 *  - Cache-first pra ícones e manifest
 *
 * Não cacheia chamadas a /api/* nem a Supabase (auth/data fresca).
 * Quando offline: serve a última versão cacheada da rota; se nunca
 * acessou, mostra fallback minimalista.
 */

const CACHE_VERSION = 'es-v1';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

const STATIC_ASSETS = [
  '/',
  '/icon.svg',
  '/manifest.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(STATIC_ASSETS).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((n) => n !== STATIC_CACHE && n !== RUNTIME_CACHE)
            .map((n) => caches.delete(n))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Não toca em chamadas externas (Supabase, Stripe, IAs)
  if (url.origin !== self.location.origin) return;

  // Não cacheia API routes — sempre fresh
  if (url.pathname.startsWith('/api/')) return;

  // Não cacheia rotas autenticadas — pode vazar dados entre tabs/users
  if (url.pathname.startsWith('/auth/')) return;

  // Stale-while-revalidate pra assets do Next
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(staleWhileRevalidate(req, RUNTIME_CACHE));
    return;
  }

  // Cache-first pra ícone e manifest
  if (url.pathname === '/icon.svg' || url.pathname === '/manifest.json') {
    event.respondWith(cacheFirst(req, STATIC_CACHE));
    return;
  }

  // Network-first pra HTML / JSON / qualquer outra coisa same-origin
  event.respondWith(networkFirst(req, RUNTIME_CACHE));
});

async function cacheFirst(req, cacheName) {
  const cached = await caches.match(req);
  if (cached) return cached;
  try {
    const res = await fetch(req);
    if (res.ok) {
      const cache = await caches.open(cacheName);
      cache.put(req, res.clone()).catch(() => {});
    }
    return res;
  } catch {
    return new Response('Offline', { status: 503 });
  }
}

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  const fetchPromise = fetch(req)
    .then((res) => {
      if (res.ok) cache.put(req, res.clone()).catch(() => {});
      return res;
    })
    .catch(() => cached);
  return cached || fetchPromise;
}

async function networkFirst(req, cacheName) {
  try {
    const res = await fetch(req);
    if (res.ok) {
      const cache = await caches.open(cacheName);
      cache.put(req, res.clone()).catch(() => {});
    }
    return res;
  } catch {
    const cached = await caches.match(req);
    if (cached) return cached;
    // Fallback pro shell se for navegação
    if (req.mode === 'navigate') {
      const shell = await caches.match('/');
      if (shell) return shell;
    }
    return new Response('Offline', { status: 503 });
  }
}

// Permite que a app peça pra atualizar imediatamente
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
