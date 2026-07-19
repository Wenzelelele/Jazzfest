// Handgeschriebener Service Worker (keine next-pwa-Abhängigkeit) - siehe
// README für die Begründung: next-pwa/Workbox-Plugins klinken sich in die
// Webpack-Konfiguration ein, Next.js 16 nutzt für Build und Dev aber
// standardmäßig Turbopack, das diese Plugin-Hooks nicht ausführt. Ein
// eigener, minimaler Service Worker ist damit robuster als ein Plugin,
// dessen Bundler-Unterstützung hier unsicher ist.
//
// Strategie: Network-first mit Cache-Fallback für alle GET-Anfragen
// derselben Origin. Firebase-Anfragen (Auth/Firestore) werden bewusst NICHT
// abgefangen - deren Offline-Verhalten übernehmen bereits die Firebase-SDKs
// selbst (persistentLocalCache / browserLocalPersistence).

const CACHE_NAME = "jazzfest-shell";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

function istFirebaseHost(hostname) {
  return (
    hostname.endsWith("googleapis.com") ||
    hostname.endsWith("firebaseapp.com") ||
    hostname.endsWith("gstatic.com")
  );
}

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  if (
    event.request.method !== "GET" ||
    url.origin !== self.location.origin ||
    istFirebaseHost(url.hostname)
  ) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((antwort) => {
        if (antwort.ok && antwort.type === "basic") {
          const kopie = antwort.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, kopie));
        }
        return antwort;
      })
      .catch(async () => {
        const treffer = await caches.match(event.request);
        return treffer ?? caches.match("/");
      }),
  );
});
