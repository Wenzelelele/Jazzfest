"use client";

import { useEffect, useState } from "react";

// Hält den Bildschirm am Einlass wach (Screen Wake Lock API). Der Browser
// gibt den Lock beim Wechsel in den Hintergrund automatisch frei - deshalb
// wird er bei jeder Rückkehr (visibilitychange) neu angefordert. Geräte ohne
// Unterstützung laufen einfach normal weiter.
export function useWakeLock(aktiv: boolean): boolean {
  const [gehalten, setGehalten] = useState(false);

  useEffect(() => {
    if (!aktiv || typeof navigator === "undefined" || !("wakeLock" in navigator)) {
      return;
    }
    let lock: WakeLockSentinel | null = null;
    let beendet = false;

    async function anfordern() {
      if (document.visibilityState !== "visible" || beendet) return;
      try {
        lock = await navigator.wakeLock.request("screen");
        setGehalten(true);
        lock.addEventListener("release", () => setGehalten(false));
      } catch {
        // z. B. Energiesparmodus - kein Fehler, den jemand sehen muss.
        setGehalten(false);
      }
    }

    anfordern();
    document.addEventListener("visibilitychange", anfordern);
    return () => {
      beendet = true;
      document.removeEventListener("visibilitychange", anfordern);
      lock?.release().catch(() => {});
    };
  }, [aktiv]);

  return gehalten;
}
