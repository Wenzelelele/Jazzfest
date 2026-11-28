"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getDocs } from "firebase/firestore";
import { veranstalterCollectionRef } from "@/lib/veranstalter";

// Alter Link ohne Veranstalter: gibt es nur einen Veranstalter, direkt
// dorthin weiterleiten (damit früher verschickte Links weiter gehen),
// sonst auf den eigenen Link des Veranstalters verweisen.
export default function GaestelisteOhneVeranstalter() {
  const router = useRouter();
  const [mehrere, setMehrere] = useState(false);

  useEffect(() => {
    getDocs(veranstalterCollectionRef())
      .then((s) => {
        if (s.size === 1) router.replace(`/gaesteliste/${s.docs[0].id}`);
        else setMehrere(true);
      })
      .catch(() => setMehrere(true));
  }, [router]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      {mehrere ? (
        <>
          <p className="text-stone-900">
            Bitte den Anfrage-Link deines Veranstalters verwenden.
          </p>
          <p className="text-sm text-stone-500">
            Er sieht so aus: …/gaesteliste/name-des-veranstalters
          </p>
          <Link href="/login" className="text-xs text-stone-400 underline">
            Team-Login
          </Link>
        </>
      ) : (
        <p className="text-sm text-stone-500">Lädt…</p>
      )}
    </div>
  );
}
