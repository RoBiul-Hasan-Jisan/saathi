// Minimal offline support.
// Only PUBLIC card pages (/c/...) and static assets are cached, never logged-in pages,
// because pharmacy devices are shared between many patients.
const CACHE = "saathi-v1";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  const cacheable = url.pathname.startsWith("/c/") || url.pathname.startsWith("/_next/static/") || url.pathname === "/icon.svg";
  if (!cacheable) return;

  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req))
  );
});
