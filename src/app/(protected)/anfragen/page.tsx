"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useEvents } from "@/contexts/EventContext";
import { useMeldung } from "@/contexts/MeldungContext";
import { useGaeste } from "@/hooks/useGaeste";
import { formatiereDatum } from "@/lib/events";
import {
  freigabeZuruecknehmen,
  gaesteFreigeben,
  gastPasstZurSuche,
  istAngefragt,
  loescheGast,
  sortiereBegleitungKeys,
  type GastMitId,
} from "@/lib/gaeste";
import { rollenLabel } from "@/lib/rollen";
import { suchBegriffe } from "@/lib/suche";
import { GastFormular } from "@/components/GastFormular";
import { NurRolle } from "@/components/NurAdmin";
import { VerbindungsIndikator } from "@/components/VerbindungsIndikator";
import { anzeigeName } from "@/lib/benutzername";

type FormularStatus =
  { offen: false } | { offen: true; gast?: GastMitId; vorgabeName?: string };

function begleitungText(gast: GastMitId): string {
  const keys = sortiereBegleitungKeys(gast.begleitung);
  if (keys.length === 0) return "";
  const namen = keys.map((key) => gast.begleitung[key].name).filter(Boolean);
  const unbenannt = keys.length - namen.length;
  const teile = [...namen];
  if (unbenannt > 0) teile.push(`+${unbenannt}`);
  return `mit ${teile.join(", ")}`;
}

function AnfrageZeile({
  gast,
  eventId,
  istAdmin,
  darfBearbeiten,
  onBearbeiten,
}: {
  gast: GastMitId;
  eventId: string;
  istAdmin: boolean;
  darfBearbeiten: boolean;
  onBearbeiten: () => void;
}) {
  const { beobachte, zeigeInfo } = useMeldung();
  const [ablehnenBestaetigen, setAblehnenBestaetigen] = useState(false);
  const personen = 1 + Object.keys(gast.begleitung).length;

  return (
    <li className="space-y-2 p-4">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-stone-900">
            {gast.name}{" "}
            <span className="text-xs text-stone-500">
              ({personen} {personen === 1 ? "Person" : "Personen"})
            </span>
          </p>
          {begleitungText(gast) && (
            <p className="text-sm text-stone-600">{begleitungText(gast)}</p>
          )}
          {gast.notiz && <p className="text-xs text-stone-500">{gast.notiz}</p>}
          <p className="text-xs text-stone-400">
            angefragt von {anzeigeName(gast.angefragtVon)}
          </p>
        </div>
        {darfBearbeiten && (
          <button
            type="button"
            onClick={onBearbeiten}
            aria-label={`${gast.name} bearbeiten`}
            className="min-h-12 min-w-12 shrink-0 rounded-md text-stone-400 hover:bg-stone-100 hover:text-stone-700"
          >
            ✎
          </button>
        )}
      </div>

      {istAdmin &&
        (ablehnenBestaetigen ? (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setAblehnenBestaetigen(false)}
              className="min-h-12 flex-1 rounded-md border border-stone-300 text-sm text-stone-700"
            >
              Abbrechen
            </button>
            <button
              type="button"
              onClick={() => {
                beobachte(
                  loescheGast(eventId, gast.id),
                  `Anfrage ${gast.name} konnte nicht gelöscht werden.`,
                );
                zeigeInfo(`Anfrage ${gast.name} abgelehnt`);
              }}
              className="min-h-12 flex-1 rounded-md bg-red-700 text-sm text-white"
            >
              Wirklich ablehnen
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setAblehnenBestaetigen(true)}
              className="min-h-12 flex-1 rounded-md border border-red-300 text-sm text-red-700"
            >
              Ablehnen
            </button>
            <button
              type="button"
              onClick={() => {
                beobachte(
                  gaesteFreigeben(eventId, [gast.id]),
                  `${gast.name} konnte nicht freigegeben werden.`,
                );
                zeigeInfo(`${gast.name} freigegeben`, () =>
                  beobachte(
                    freigabeZuruecknehmen(eventId, [gast.id]),
                    "Rückgängig fehlgeschlagen.",
                  ),
                );
              }}
              className="min-h-12 flex-[2] rounded-md bg-stone-900 text-sm font-medium text-stone-50"
            >
              Freigeben
            </button>
          </div>
        ))}
    </li>
  );
}

function AnfragenInhalt() {
  const { aktivesEvent, geladen } = useEvents();
  const { user, rolle, istAdmin } = useAuth();
  const { beobachte, zeigeInfo } = useMeldung();
  const eventId = aktivesEvent?.id;
  const alle = useGaeste(eventId);
  const [formular, setFormular] = useState<FormularStatus>({ offen: false });
  const [suche, setSuche] = useState("");

  const anfragen = useMemo(() => alle.filter(istAngefragt), [alle]);
  const freigegeben = useMemo(
    () => alle.filter((gast) => !istAngefragt(gast)),
    [alle],
  );
  const begriffe = useMemo(() => suchBegriffe(suche), [suche]);
  const trefferListe = useMemo(() => {
    if (begriffe.length === 0) {
      return freigegeben.filter((gast) => gast.quelle !== "mitglied");
    }
    return freigegeben.filter((gast) => gastPasstZurSuche(gast, begriffe));
  }, [freigegeben, begriffe]);

  const anzahlPersonenAnfragen = anfragen.reduce(
    (summe, gast) => summe + 1 + Object.keys(gast.begleitung).length,
    0,
  );

  function alleFreigeben() {
    if (!eventId || anfragen.length === 0) return;
    const ids = anfragen.map((gast) => gast.id);
    beobachte(
      gaesteFreigeben(eventId, ids),
      "Freigabe konnte nicht gespeichert werden.",
    );
    zeigeInfo(
      `${ids.length} ${ids.length === 1 ? "Anfrage" : "Anfragen"} freigegeben`,
      () =>
        beobachte(
          freigabeZuruecknehmen(eventId, ids),
          "Rückgängig fehlgeschlagen.",
        ),
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-stone-200 bg-white/95 p-4 backdrop-blur">
        {istAdmin && (
          <Link
            href="/"
            className="flex min-h-12 items-center rounded-md px-2 text-sm text-stone-500 hover:bg-stone-100"
          >
            ← Zurück
          </Link>
        )}
        <Link href="/events" className="min-w-0 flex-1">
          <span className="block font-display text-lg leading-tight font-semibold text-stone-900">
            Anfragen
          </span>
          <span className="flex items-center gap-2 truncate text-xs text-stone-500">
            {aktivesEvent
              ? `${aktivesEvent.name} · ${formatiereDatum(aktivesEvent.datum)}`
              : "Kein Event"}
            <VerbindungsIndikator eventId={eventId} />
          </span>
        </Link>
        {!istAdmin && (
          <button
            type="button"
            onClick={() => signOut(auth)}
            className="min-h-12 rounded-md border border-stone-300 px-3 text-xs text-stone-600 hover:bg-stone-100"
          >
            Abmelden
          </button>
        )}
      </header>

      <main className="mx-auto w-full max-w-lg flex-1 space-y-4 p-4 pb-28">
        {geladen && !aktivesEvent && (
          <p className="text-sm text-stone-600">
            Noch kein Event angelegt - Anfragen sind möglich, sobald ein Admin
            ein Event angelegt hat.
          </p>
        )}

        {!istAdmin && (
          <p className="text-xs text-stone-500">
            Angemeldet als {anzeigeName(user?.email)} · {rollenLabel(rolle)}.
            Eingetragene Gäste sind zuerst nur angefragt und stehen erst nach
            der Freigabe durch einen Admin auf der Einlassliste.{" "}
            <Link href="/events" className="underline">
              Event wechseln
            </Link>
          </p>
        )}

        {aktivesEvent && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setFormular({ offen: true })}
              className="min-h-12 flex-1 rounded-md bg-stone-900 px-3 text-sm font-medium text-stone-50"
            >
              {istAdmin ? "+ Gast hinzufügen" : "+ Gast anfragen"}
            </button>
            <Link
              href="/text-import"
              className="flex min-h-12 flex-1 items-center justify-center rounded-md border border-stone-300 px-3 text-sm text-stone-700 hover:bg-stone-100"
            >
              Aus Text einfügen
            </Link>
          </div>
        )}

        <section className="rounded-md border border-stone-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 p-4">
            <h2 className="font-display text-base font-semibold text-stone-900">
              Offene Anfragen{" "}
              <span className="font-sans text-sm font-normal text-stone-500">
                {anfragen.length} ({anzahlPersonenAnfragen} Personen)
              </span>
            </h2>
            {istAdmin && anfragen.length > 0 && (
              <button
                type="button"
                onClick={alleFreigeben}
                className="min-h-12 rounded-md bg-amber-800 px-4 text-sm font-semibold text-amber-50"
              >
                Alle {anfragen.length} freigeben
              </button>
            )}
          </div>
          {anfragen.length === 0 ? (
            <p className="p-4 text-sm text-stone-500">
              Keine offenen Anfragen.
            </p>
          ) : (
            <ul className="divide-y divide-stone-200">
              {anfragen.map((gast) => (
                <AnfrageZeile
                  key={gast.id}
                  gast={gast}
                  eventId={eventId!}
                  istAdmin={istAdmin}
                  darfBearbeiten={
                    istAdmin || gast.angefragtVon === (user?.email ?? null)
                  }
                  onBearbeiten={() => setFormular({ offen: true, gast })}
                />
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-3 rounded-md border border-stone-200 bg-white p-4">
          <h2 className="font-display text-base font-semibold text-stone-900">
            Schon auf der Liste{" "}
            <span className="font-sans text-sm font-normal text-stone-500">
              {freigegeben.length}
            </span>
          </h2>
          <input
            type="search"
            inputMode="search"
            placeholder="Prüfen, ob jemand schon drauf ist…"
            value={suche}
            onChange={(e) => setSuche(e.target.value)}
            className="min-h-12 w-full rounded-md border border-stone-300 bg-stone-50 px-3 text-stone-900 outline-none focus:border-stone-500"
          />
          {trefferListe.length === 0 ? (
            <p className="text-sm text-stone-500">
              {begriffe.length > 0
                ? "Nicht auf der Liste."
                : "Noch keine freigegebenen Gäste."}
            </p>
          ) : (
            <ul className="divide-y divide-stone-100 text-sm">
              {trefferListe.map((gast) => (
                <li key={gast.id} className="flex justify-between gap-3 py-2">
                  <span className="text-stone-800">
                    {gast.name}
                    {begleitungText(gast) && (
                      <span className="text-stone-500">
                        {" "}
                        {begleitungText(gast)}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 text-xs text-stone-400">
                    {gast.quelle === "mitglied" ? "JIM Mitglied" : "Gast"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>

      {formular.offen && (
        <GastFormular
          gast={formular.gast}
          vorgabeName={formular.vorgabeName}
          onClose={() => setFormular({ offen: false })}
        />
      )}
    </div>
  );
}

export default function AnfragenSeite() {
  return (
    <NurRolle erlaubt={["anfrage", "admin"]}>
      <AnfragenInhalt />
    </NurRolle>
  );
}
