"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { rollenLabel, type Rolle } from "@/lib/rollen";

// Blendet Seiten für Rollen aus, die sie nicht nutzen sollen (Kasse sieht
// nur die Einlassliste). Bei Events
// und Mitglieder-Import sperren zusätzlich die Firestore-Regeln, sonst ist
// das reine Oberfläche.
export function NurRolle({
  erlaubt,
  children,
}: {
  erlaubt: Rolle[];
  children: ReactNode;
}) {
  const { rolle, rolleGeladen } = useAuth();
  if (!rolleGeladen) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-stone-500">Lädt…</p>
      </div>
    );
  }
  if (erlaubt.includes(rolle)) return <>{children}</>;
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <p className="text-stone-900">
        Dieser Bereich ist für die Rolle „{rollenLabel(rolle)}&ldquo; nicht
        verfügbar.
      </p>
      <Link
        href="/"
        className="flex min-h-12 items-center rounded-md bg-stone-900 px-5 font-medium text-stone-50"
      >
        Zur Startseite
      </Link>
    </div>
  );
}

export function NurAdmin({ children }: { children: ReactNode }) {
  return <NurRolle erlaubt={["admin"]}>{children}</NurRolle>;
}
