// Saathi service worker: offline support WITHOUT keeping patient data lying around.
//  - App pages and static files are cached (the pages are empty shells; data is fetched by the app).
//  - API data is NOT cached, with these exceptions that hold no private data or are the family's own copy:
//      the approved library, voice clips, and a card's public page (the take-home QR page).
//  - On logout the app asks this worker to delete the cached public card data (shared devices).

const V = "saathi-v2";
const STATIC = `${V}-static`;
const PAGES = `${V}-pages`;
const API = `${V}-api`;
const AUDIO = `${V}-audio`;
const KEEP = [STATIC, PAGES, API, AUDIO];

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (e) => {
  e.waitUntil(
    (async () => {
      for (const k of await caches.keys()) if (!KEEP.includes(k)) await caches.delete(k);
      await self.clients.claim();
    })()
  );
});

self.addEventListener("message", (e) => {
  if (e.data?.type === "clear-private") e.waitUntil(caches.delete(API));
});

const cacheable = (res) => res && res.ok && res.type === "basic" && !res.redirected;

async function networkFirst(req, cacheName, { fallbackUrl, ignoreSearch } = {}) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(req);
    if (cacheable(res)) cache.put(req, res.clone());
    return res;
  } catch {
    const hit = (await cache.match(req, { ignoreSearch })) || (fallbackUrl && (await caches.match(fallbackUrl)));
    if (hit) return hit;
    throw new Error("offline");
  }
}

async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (cacheable(res)) cache.put(req, res.clone());
  return res;
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  const p = url.pathname;

  if (p.startsWith("/_next/static/") || p === "/icon.svg") return e.respondWith(cacheFirst(req, STATIC));

  if (p.startsWith("/api/")) {
    if (/^\/api\/voices\/[^/]+\/audio$/.test(p)) return e.respondWith(cacheFirst(req, AUDIO));
    if (p === "/api/voices/manifest" || p === "/api/library/active" || /^\/api\/public\/cards\/[^/]+$/.test(p)) {
      return e.respondWith(networkFirst(req, p.startsWith("/api/public") ? API : STATIC));
    }
    return; // everything else: network only, never cached
  }

  if (req.mode === "navigate") {
    return e.respondWith(
      networkFirst(req, PAGES, { fallbackUrl: "/offline.html", ignoreSearch: true }).catch(() => caches.match("/offline.html"))
    );
  }
});

// Cache the offline page up front.
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(PAGES).then((c) => c.add("/offline.html")));
});
