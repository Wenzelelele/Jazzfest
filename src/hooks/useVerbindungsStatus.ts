"use client";

import { useEffect, useState } from "react";
import { onSnapshot } from "firebase/firestore";
import { gaesteCollectionRef } from "@/lib/gaeste";

export type VerbindungsStatus = "offline" | "synchronisiert" | "aktuell";

// Nutzt Firestores eigene Snapshot-Metadaten statt nur navigator.onLine:
// fromCache ist auch dann true, wenn das Gerät zwar Netz hat, Firestore
// aber (noch) keine echte Verbindung zum Server aufbauen konnte - das ist
// die für die Nutzer:innen am Einlass relevantere Aussage als der reine
// Browser-Online-Status.
export function useVerbindungsStatus(): VerbindungsStatus {
  const [online, setOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  const [ausCache, setAusCache] = useState(true);
  const [wartendeSchreibvorgaenge, setWartendeSchreibvorgaenge] =
    useState(false);

  useEffect(() => {
    function setzeOnline() {
      setOnline(true);
    }
    function setzeOffline() {
      setOnline(false);
    }
    window.addEventListener("online", setzeOnline);
    window.addEventListener("offline", setzeOffline);
    return () => {
      window.removeEventListener("online", setzeOnline);
      window.removeEventListener("offline", setzeOffline);
    };
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      gaesteCollectionRef(),
      { includeMetadataChanges: true },
      (snapshot) => {
        setAusCache(snapshot.metadata.fromCache);
        setWartendeSchreibvorgaenge(snapshot.metadata.hasPendingWrites);
      },
    );
    return unsubscribe;
  }, []);

  if (!online || ausCache) return "offline";
  if (wartendeSchreibvorgaenge) return "synchronisiert";
  return "aktuell";
}
