// Handgeschriebener Service Worker (keine next-pwa-Abhängigkeit) - siehe
// README für die Begründung: next-pwa/Workbox-Plugins klinken sich in die
// Webpack-Konfiguration ein, Next.js 16 nutzt für Build und Dev aber
// standardmäßig Turbopack, das diese Plugin-Hooks nicht ausführt. Ein
// eigener, minimaler Service Worker ist damit robuster als ein Plugin,
// dessen Bundler-Unterstützung hier unsicher ist.
//
// Firebase-Anfragen (Auth/Firestore) werden bewusst NICHT abgefangen - deren
// Offline-Verhalten übernehmen bereits die Firebase-SDKs selbst
// (persistentLocalCache / browserLocalPersistence).
//
// Strategien:
// - /_next/static/*: cache-first. Die Dateien sind gehasht und ändern sich
//   nie, ein Netzaufruf wäre reine Wartezeit.
// - Alles andere (Seiten, RSC-Payloads, Manifest, Icons): network-first mit
//   Timeout. Am Einlass ist das Netz oft "halb da" (schwaches WLAN,
//   überlastetes Mobilfunknetz) - ohne Timeout hinge der App-Start, bis der
//   Browser die Anfrage von selbst aufgibt. Nach TIMEOUT_MS gewinnt der Cache.

const VERSION = new URL(self.location.href).searchParams.get("v") || "dev";
const CACHE_PREFIX = "jazzfest-";
const CACHE_NAME = `${CACHE_PREFIX}${VERSION}`;
const TIMEOUT_MS = 2500;

// Alle Seiten vorab cachen: sonst wären z. B. /text-import oder /statistik
// offline nur verfügbar, wenn man sie vorher zufällig einmal online
// geöffnet hat.
const SEITEN = [
  "/",
  "/gaesteliste",
  "/login",
  "/events",
  "/statistik",
  "/import",
  "/text-import",
  "/anfragen",
  "/ansprechpartner",
  "/zugaenge",
  "/veranstalter",
];
const WEITERE_DATEIEN = [
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-512.png",
  "/icons/apple-touch-icon.png",
];

// Findet die von einer HTML-Seite referenzierten Build-Dateien (JS-Chunks,
// CSS, Fonts), damit die Seite offline nicht nur als leeres Gerüst startet.
const STATIC_MUSTER = /(?:src|href)="(\/_next\/static\/[^"]+)"/g;

async function precache() {
  const cache = await caches.open(CACHE_NAME);

  const seitenErgebnisse = await Promise.allSettled(
    SEITEN.map(async (pfad) => {
      const antwort = await fetch(pfad, { cache: "reload" });
      if (!antwort.ok) throw new Error(`${pfad}: ${antwort.status}`);
      const html = await antwort.clone().text();
      await cache.put(pfad, antwort);
      return [...html.matchAll(STATIC_MUSTER)].map((treffer) =>
        treffer[1].replace(/&amp;/g, "&"),
      );
    }),
  );

  const staticUrls = new Set();
  for (const ergebnis of seitenErgebnisse) {
    if (ergebnis.status === "fulfilled") {
      for (const url of ergebnis.value) staticUrls.add(url);
    }
  }

  // Einzelne Fehlschläge (z. B. eine Seite, die es in diesem Build noch
  // nicht gibt) dürfen die Installation nicht scheitern lassen.
  await Promise.allSettled(
    [...WEITERE_DATEIEN, ...staticUrls].map((url) => cache.add(url)),
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(precache().finally(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const namen = await caches.keys();
      await Promise.all(
        namen
          .filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
          .map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  );
});

function istFirebaseHost(hostname) {
  return (
    hostname.endsWith("googleapis.com") ||
    hostname.endsWith("firebaseapp.com") ||
    hostname.endsWith("gstatic.com")
  );
}

function inCacheLegen(request, antwort) {
  if (antwort.ok && antwort.type === "basic") {
    const kopie = antwort.clone();
    caches.open(CACHE_NAME).then((cache) => cache.put(request, kopie));
  }
}

async function cacheFirst(request) {
  const treffer = await caches.match(request);
  if (treffer) return treffer;
  const antwort = await fetch(request);
  inCacheLegen(request, antwort);
  return antwort;
}

// Startet den Netzaufruf und wartet höchstens TIMEOUT_MS darauf. Der
// Netzaufruf läuft nach dem Timeout weiter und aktualisiert den Cache, wenn
// er doch noch antwortet - die nächste Öffnung bekommt dann die frische
// Fassung.
async function networkFirst(event, fallback) {
  const request = event.request;
  const netz = fetch(request).then((antwort) => {
    inCacheLegen(request, antwort);
    return antwort;
  });
  event.waitUntil(netz.catch(() => undefined));

  const zeitUeberschritten = new Promise((resolve) =>
    setTimeout(() => resolve(null), TIMEOUT_MS),
  );

  try {
    const antwort = await Promise.race([netz, zeitUeberschritten]);
    if (antwort) return antwort;
  } catch {
    // Netzfehler - weiter mit Cache.
  }

  // ignoreSearch nur für Seitenaufrufe: eine RSC-Anfrage (?_rsc=...) darf
  // nicht das HTML derselben Route bekommen.
  const treffer = await caches.match(request, {
    ignoreSearch: request.mode === "navigate",
  });
  if (treffer) return treffer;

  const spaeterFallback = await fallback();
  if (spaeterFallback) return spaeterFallback;

  // Weder Cache noch Fallback: auf die (evtl. langsame) Netzantwort warten,
  // statt sofort aufzugeben.
  try {
    return await netz;
  } catch {
    return Response.error();
  }
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

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(event.request));
    return;
  }

  if (event.request.mode === "navigate") {
    // Unbekannte Seite offline: die Hauptseite ausliefern, der clientseitige
    // Router übernimmt von dort.
    event.respondWith(networkFirst(event, () => caches.match("/")));
    return;
  }

  // Sonstiges, inkl. RSC-Requests (?_rsc=...): ohne Cache-Treffer
  // Response.error(), dann fällt Next auf eine harte Navigation zurück, die
  // wiederum aus dem Seiten-Cache bedient wird.
  event.respondWith(networkFirst(event, async () => null));
});
