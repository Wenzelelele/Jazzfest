"use client";

import { useEffect } from "react";

// Nur in Produktion registrieren: im Dev-Server würde der Service Worker mit
// Turbopacks Hot-Reload/On-Demand-Kompilierung kollidieren (Assets ändern
// sich ständig, der SW würde veraltete Fassungen aus dem Cache liefern).
//
// Die Build-Kennung hängt als ?v=... an der SW-URL: ändert sie sich (neues
// Deployment), sieht der Browser ein neues Service-Worker-Skript, installiert
// es und der neue SW räumt den Cache der Vorversion weg.
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    const version = encodeURIComponent(
      process.env.NEXT_PUBLIC_BUILD_ID ?? "dev",
    );
    navigator.serviceWorker.register(`/sw.js?v=${version}`).catch((err) => {
      console.error("Service Worker Registrierung fehlgeschlagen:", err);
    });
  }, []);

  return null;
}
