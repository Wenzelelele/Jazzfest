"use client";

import { useEffect, useState } from "react";
import { onSnapshot } from "firebase/firestore";
import { useMeldung } from "@/contexts/MeldungContext";
import { gaesteCollectionRef, type Gast, type GastMitId } from "@/lib/gaeste";

export function useGaeste(eventId: string | undefined): GastMitId[] {
  const { zeigeFehler } = useMeldung();
  // Liste zusammen mit ihrer Event-ID speichern: beim Event-Wechsel wird so
  // nie kurz die Liste des vorherigen Events angezeigt.
  const [stand, setStand] = useState<{ eventId: string; liste: GastMitId[] }>(
    { eventId: "", liste: [] },
  );

  useEffect(() => {
    if (!eventId) return;
    const unsubscribe = onSnapshot(
      gaesteCollectionRef(eventId),
      (snapshot) => {
        const liste = snapshot.docs.map((docSnapshot) => ({
          id: docSnapshot.id,
          ...(docSnapshot.data() as Gast),
        }));
        liste.sort((a, b) => a.name.localeCompare(b.name, "de"));
        setStand({ eventId, liste });
      },
      (fehler) => zeigeFehler("Gästeliste konnte nicht geladen werden.", fehler),
    );
    return unsubscribe;
  }, [eventId, zeigeFehler]);

  return eventId && stand.eventId === eventId ? stand.liste : [];
}
