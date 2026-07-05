/* Kendang Pasunanda service worker — manual implementation, no Workbox.
 *
 * Strategy summary:
 *   - Precache: shell HTML, manifest, favicon and font on install.
 *   - Runtime cache "kendang-static": NetworkFirst for JS/CSS bundles (so a
 *     new deploy is picked up online; offline falls back to cache).
 *   - Runtime cache "kendang-audio": CacheFirst for /audio/*.wav (filled on
 *     first playback, persists thereafter).
 *   - Runtime cache "kendang-images": CacheFirst for /icons/*.png and /assets/*.png.
 *   - Never cached: Supabase REST + Auth (so writes fail loudly when offline,
 *     and reads always reflect server truth when online).
 */

const VERSION = 'kp-v3';
const STATIC_CACHE = `kendang-shell-${VERSION}`;
const RUNTIME_STATIC = `kendang-static-${VERSION}`;
const AUDIO_CACHE = 'kendang-audio'; // version-less so audio survives across deploys
const IMAGE_CACHE = 'kendang-images';

const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
  // Default notation pack — laadt bij boot. Het manifest verwijst naar
  // het bijbehorende font, dat door de runtime /fonts/-rule wordt gecached.
  '/packs/neodamina-werner/pack.json',
  // Pack-index voor de pack-selector UI.
  '/packs/index.json',
  // Font van de default notation pack (iets snelle eerste-keer-offline UX).
  '/fonts/NeoDamina%20Werner%20edit.ttf',
  // Default instrument & voice pack manifesten — runtime cache vult overige
  // packs vanzelf, maar deze willen we offline bij eerste install al hebben.
  '/packs/sunda-kendang/pack.json',
  '/packs/sunda-vox-werner/pack.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) =>
      // addAll is atomic — if any single URL fails the install fails.
      // Use individual adds to be tolerant of missing files.
      Promise.all(
        PRECACHE_URLS.map((url) =>
          cache.add(url).catch((err) => {
             
            console.warn('[sw] precache miss:', url, err.message);
          })
        )
      )
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k.startsWith('kendang-') && k.endsWith(`-${VERSION}`) === false && !k.startsWith('kendang-audio') && !k.startsWith('kendang-images'))
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Skip cross-origin Supabase, OAuth, analytics, anything not us.
  if (url.origin !== self.location.origin) return;

  // Never cache Supabase API calls (they go through @supabase/supabase-js which uses fetch).
  if (url.pathname.startsWith('/rest/v1') || url.pathname.startsWith('/auth/v1')) return;

  // Audio samples: cache-first, fill on first request.
  if (url.pathname.startsWith('/audio/') && url.pathname.endsWith('.wav')) {
    event.respondWith(cacheFirst(req, AUDIO_CACHE));
    return;
  }

  // Pack manifesten: cache-first onder STATIC. Klein, mag dood-cachen tot een
  // nieuwe SW-versie binnenkomt — dan wordt STATIC sowieso opgeruimd.
  if (url.pathname.startsWith('/packs/') && url.pathname.endsWith('.json')) {
    event.respondWith(cacheFirst(req, STATIC_CACHE));
    return;
  }

  // Fonts: cache-first, fill on first request (handles encoded paths too).
  if (url.pathname.startsWith('/fonts/') || url.pathname.match(/\.(ttf|otf|woff2?)$/i)) {
    event.respondWith(cacheFirst(req, STATIC_CACHE));
    return;
  }

  // Images and PNG icons: cache-first.
  if (url.pathname.startsWith('/icons/') || url.pathname.match(/\.(png|jpg|jpeg|svg|webp)$/i)) {
    event.respondWith(cacheFirst(req, IMAGE_CACHE));
    return;
  }

  // Vite-built JS/CSS bundles: network-first so deploys are picked up.
  if (url.pathname.startsWith('/assets/') && (url.pathname.endsWith('.js') || url.pathname.endsWith('.css'))) {
    event.respondWith(networkFirst(req, RUNTIME_STATIC));
    return;
  }

  // Navigation requests (the HTML shell): network-first, fall back to cached index.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() => caches.match('/index.html'))
    );
    return;
  }
});

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  // Offline én niet in cache → de fetch faalt vanzelf (de rejectie propageert,
  // SamplePlayer logt het). Geen try/catch nodig die alleen rethrowt.
  const response = await fetch(request);
  if (response && response.ok) {
    cache.put(request, response.clone());
  }
  return response;
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw err;
  }
}

// Allow the page to ask the SW to skip waiting (for instant updates).
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});
