"use client";

import { useEffect } from "react";

// Nur in Produktion registrieren: im Dev-Server würde der Service Worker mit
// Turbopacks Hot-Reload/On-Demand-Kompilierung kollidieren (Assets ändern
// sich ständig, der SW würde veraltete Fassungen aus dem Cache liefern).
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.error("Service Worker Registrierung fehlgeschlagen:", err);
    });
  }, []);

  return null;
}
