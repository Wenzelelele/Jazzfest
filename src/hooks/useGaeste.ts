"use client";

import { useEffect, useState } from "react";
import { onSnapshot } from "firebase/firestore";
import { gaesteCollectionRef, type Gast, type GastMitId } from "@/lib/gaeste";

export function useGaeste(): GastMitId[] {
  const [gaeste, setGaeste] = useState<GastMitId[]>([]);

  useEffect(() => {
    const unsubscribe = onSnapshot(gaesteCollectionRef(), (snapshot) => {
      const liste = snapshot.docs.map((docSnapshot) => ({
        id: docSnapshot.id,
        ...(docSnapshot.data() as Gast),
      }));
      liste.sort((a, b) => a.name.localeCompare(b.name, "de"));
      setGaeste(liste);
    });
    return unsubscribe;
  }, []);

  return gaeste;
}
