"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { onSnapshot } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { useMeldung } from "@/contexts/MeldungContext";
import {
  ROLLEN,
  adminsCollectionRef,
  nutzerCollectionRef,
  rolleSetzen,
  type Nutzer,
  type NutzerMitId,
  type Rolle,
} from "@/lib/rollen";
import { NurAdmin } from "@/components/NurAdmin";
import { BENUTZERNAME_DOMAIN, anzeigeName } from "@/lib/benutzername";

function BenutzerInhalt() {
  const { user } = useAuth();
  const { beobachte, zeigeFehler, zeigeInfo } = useMeldung();
  const [nutzer, setNutzer] = useState<NutzerMitId[]>([]);
  const [adminIds, setAdminIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const ohneNutzer = onSnapshot(
      nutzerCollectionRef(),
      (snapshot) =>
        setNutzer(
          snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as Nutzer) })),
        ),
      (fehler) => zeigeFehler("Benutzer konnten nicht geladen werden.", fehler),
    );
    const ohneAdmins = onSnapshot(
      adminsCollectionRef(),
      (snapshot) => setAdminIds(new Set(snapshot.docs.map((d) => d.id))),
      (fehler) => zeigeFehler("Admins konnten nicht geladen werden.", fehler),
    );
    return () => {
      ohneNutzer();
      ohneAdmins();
    };
  }, [zeigeFehler]);

  // Maßgeblich für Admin ist admins/{uid} (daran hängen die Regeln), für
  // Kasse/Anfrage das Feld rolle.
  const liste = useMemo(
    () =>
      nutzer
        .map((n) => ({
          ...n,
          effektiv: (adminIds.has(n.id)
            ? "admin"
            : n.rolle === "anfrage"
              ? "anfrage"
              : "kasse") as Rolle,
        }))
        .sort((a, b) =>
          anzeigeName(a.email).localeCompare(anzeigeName(b.email), "de"),
        ),
    [nutzer, adminIds],
  );

  function aendern(eintrag: NutzerMitId, rolle: Rolle) {
    beobachte(
      rolleSetzen(eintrag.id, eintrag.email, rolle),
      `Rolle für ${anzeigeName(eintrag.email)} konnte nicht gespeichert werden.`,
    );
    zeigeInfo(
      `${anzeigeName(eintrag.email)} ist jetzt ${ROLLEN.find((r) => r.wert === rolle)?.label}`,
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-stone-200 bg-white/95 p-4 backdrop-blur">
        <Link
          href="/"
          className="flex min-h-12 items-center rounded-md px-2 text-sm text-stone-500 hover:bg-stone-100"
        >
          ← Zurück
        </Link>
        <h1 className="font-display text-lg font-semibold text-stone-900">
          Benutzer & Rollen
        </h1>
      </header>

      <main className="mx-auto w-full max-w-lg flex-1 space-y-4 p-4">
        <div className="space-y-2 rounded-md border border-stone-200 bg-white p-4 text-sm text-stone-600">
          <p>
            Neue Accounts in der Firebase Console unter Authentication → Nutzer
            anlegen. Ohne persönliche E-Mail: als E-Mail{" "}
            <span className="font-mono">name@{BENUTZERNAME_DOMAIN}</span>{" "}
            eintragen (z. B.{" "}
            <span className="font-mono">kasse@{BENUTZERNAME_DOMAIN}</span>) -
            angemeldet wird dann nur mit „kasse“. Accounts erscheinen hier nach
            ihrem ersten Login und sind zunächst <strong>Kasse</strong>.
          </p>
          <ul className="space-y-1 text-xs text-stone-500">
            {ROLLEN.map((r) => (
              <li key={r.wert}>
                <strong className="text-stone-700">{r.label}:</strong>{" "}
                {r.beschreibung}
              </li>
            ))}
          </ul>
        </div>

        <ul className="divide-y divide-stone-200 rounded-md border border-stone-200 bg-white">
          {liste.map((eintrag) => {
            const ichSelbst = eintrag.id === user?.uid;
            return (
              <li key={eintrag.id} className="space-y-2 p-4">
                <p className="truncate text-stone-900">
                  {anzeigeName(eintrag.email)}
                  {ichSelbst && (
                    <span className="text-xs text-stone-500"> (du)</span>
                  )}
                </p>
                <div className="flex gap-2" role="group" aria-label="Rolle">
                  {ROLLEN.map((r) => (
                    <button
                      key={r.wert}
                      type="button"
                      // Sich selbst die Admin-Rolle zu nehmen würde dich
                      // aus der Benutzer-Seite aussperren.
                      disabled={ichSelbst}
                      onClick={() =>
                        eintrag.effektiv !== r.wert && aendern(eintrag, r.wert)
                      }
                      aria-pressed={eintrag.effektiv === r.wert}
                      className={`min-h-12 flex-1 rounded-md px-2 text-sm disabled:cursor-not-allowed ${
                        eintrag.effektiv === r.wert
                          ? "bg-stone-900 text-stone-50"
                          : "border border-stone-300 text-stone-600 disabled:opacity-40"
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </li>
            );
          })}
          {liste.length === 0 && (
            <li className="p-4 text-sm text-stone-500">Noch keine Benutzer.</li>
          )}
        </ul>
      </main>
    </div>
  );
}

export default function BenutzerSeite() {
  return (
    <NurAdmin>
      <BenutzerInhalt />
    </NurAdmin>
  );
}
