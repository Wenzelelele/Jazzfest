"use client";

import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";
import { useEvents } from "@/contexts/EventContext";
import { useMeldung } from "@/contexts/MeldungContext";
import { useGaeste } from "@/hooks/useGaeste";
import { formatiereDatum } from "@/lib/events";
import {
  freigabeZuruecknehmen,
  gaesteFreigeben,
  gastPasstZurSuche,
  gesamtPersonen,
  gruppiereNachAnsprechpartner,
  istAngefragt,
  begleitungText,
  loescheGast,
  type AnsprechpartnerGruppe,
  type GastMitId,
} from "@/lib/gaeste";
import { suchBegriffe } from "@/lib/suche";
import { GastFormular } from "@/components/GastFormular";
import { NurAdmin } from "@/components/NurAdmin";
import { VerbindungsIndikator } from "@/components/VerbindungsIndikator";
import { anzeigeName } from "@/lib/benutzername";

type FormularStatus = { offen: false } | { offen: true; gast?: GastMitId };

function personenText(anzahl: number): string {
  return `${anzahl} ${anzahl === 1 ? "Person" : "Personen"}`;
}

function AnfrageZeile({
  gast,
  eventId,
  onBearbeiten,
}: {
  gast: GastMitId;
  eventId: string;
  onBearbeiten: () => void;
}) {
  const { beobachte, zeigeInfo } = useMeldung();
  const [ablehnenBestaetigen, setAblehnenBestaetigen] = useState(false);
  const personen = gesamtPersonen(gast);

  return (
    <li className="space-y-2 p-4">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-stone-900">
            {gast.name}{" "}
            <span className="text-xs text-stone-500">
              ({personenText(personen)})
            </span>
          </p>
          {begleitungText(gast) && (
            <p className="text-sm text-stone-600">{begleitungText(gast)}</p>
          )}
          {gast.notiz && (
            <p className="text-xs text-stone-500">„{gast.notiz}&ldquo;</p>
          )}
          {gast.angefragtVon && (
            <p className="text-xs text-stone-400">
              eingetragen von {anzeigeName(gast.angefragtVon)}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onBearbeiten}
          aria-label={`${gast.name} bearbeiten`}
          className="min-h-12 min-w-12 shrink-0 rounded-md text-stone-400 hover:bg-stone-100 hover:text-stone-700"
        >
          ✎
        </button>
      </div>

      {ablehnenBestaetigen ? (
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
      )}
    </li>
  );
}

function AnfrageGruppe({
  gruppe,
  eventId,
  onBearbeiten,
  onAlleFreigeben,
}: {
  gruppe: AnsprechpartnerGruppe;
  eventId: string;
  onBearbeiten: (gast: GastMitId) => void;
  onAlleFreigeben: (ids: string[], label: string) => void;
}) {
  const anfragen = gruppe.gaeste.filter(istAngefragt);
  const label = gruppe.name || "Ohne Ansprechpartner";
  return (
    <section className="rounded-md border border-stone-200 bg-white">
      <div className="space-y-2 border-b border-stone-200 bg-stone-50 p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="font-display text-base font-semibold text-stone-900">
            {gruppe.name ? `über ${gruppe.name}` : label}
          </h3>
          <span className="text-sm text-stone-600">
            {anfragen.length} {anfragen.length === 1 ? "Anfrage" : "Anfragen"}{" "}
            · {personenText(gruppe.angefragt.personen)}
          </span>
        </div>
        <p className="text-xs text-stone-500">
          {gruppe.freigegeben.personen > 0 ? (
            <>
              Schon auf der Liste:{" "}
              <strong className="text-stone-700">
                {personenText(gruppe.freigegeben.personen)}
              </strong>{" "}
              ({gruppe.gaeste
                .filter((g) => !istAngefragt(g))
                .map((g) => g.name)
                .join(", ")}
              )
            </>
          ) : (
            "Bisher niemand über diesen Ansprechpartner auf der Liste."
          )}
        </p>
        {anfragen.length > 1 && (
          <button
            type="button"
            onClick={() =>
              onAlleFreigeben(
                anfragen.map((g) => g.id),
                gruppe.name ? `von ${gruppe.name}` : "ohne Ansprechpartner",
              )
            }
            className="min-h-12 w-full rounded-md border border-amber-700 px-3 text-sm font-medium text-amber-900 hover:bg-amber-50"
          >
            Alle {anfragen.length} {gruppe.name ? `von ${gruppe.name}` : ""}{" "}
            freigeben
          </button>
        )}
      </div>
      <ul className="divide-y divide-stone-200">
        {anfragen.map((gast) => (
          <AnfrageZeile
            key={gast.id}
            gast={gast}
            eventId={eventId}
            onBearbeiten={() => onBearbeiten(gast)}
          />
        ))}
      </ul>
    </section>
  );
}

function AnfrageLink() {
  const { zeigeInfo, zeigeFehler } = useMeldung();
  // Origin erst im Browser bekannt - useSyncExternalStore vermeidet einen
  // Hydration-Unterschied zwischen Server- und Client-Render.
  const origin = useSyncExternalStore(
    () => () => {},
    () => window.location.origin,
    () => "",
  );
  const link = `${origin}/gaesteliste`;
  return (
    <div className="space-y-2 rounded-md border border-stone-200 bg-white p-4 text-sm text-stone-600">
      <p>
        Diesen Link an Bands & Co. schicken - dort wählt man das Event und
        fragt Gäste an, ganz ohne Login:
      </p>
      <button
        type="button"
        onClick={() =>
          navigator.clipboard
            ?.writeText(link)
            .then(() => zeigeInfo("Link kopiert"))
            .catch(() => zeigeFehler("Kopieren nicht möglich."))
        }
        className="block min-h-12 w-full rounded-md border border-stone-300 bg-stone-50 px-3 text-left font-mono text-xs break-all text-stone-900"
      >
        {link}
      </button>
    </div>
  );
}

function AnfragenInhalt() {
  const { aktivesEvent, geladen } = useEvents();
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
  // Nur Ansprechpartner mit offenen Anfragen - der Rest steht auf der
  // Seite "Nach Ansprechpartner".
  const gruppen = useMemo(
    () =>
      gruppiereNachAnsprechpartner(alle).filter(
        (gruppe) => gruppe.angefragt.eintraege > 0,
      ),
    [alle],
  );
  const begriffe = useMemo(() => suchBegriffe(suche), [suche]);
  const trefferListe = useMemo(() => {
    if (begriffe.length === 0) return [];
    return freigegeben.filter((gast) => gastPasstZurSuche(gast, begriffe));
  }, [freigegeben, begriffe]);

  const anzahlPersonenAnfragen = anfragen.reduce(
    (summe, gast) => summe + gesamtPersonen(gast),
    0,
  );

  function freigeben(ids: string[], label: string) {
    if (!eventId || ids.length === 0) return;
    beobachte(
      gaesteFreigeben(eventId, ids),
      "Freigabe konnte nicht gespeichert werden.",
    );
    zeigeInfo(
      `${ids.length} ${ids.length === 1 ? "Anfrage" : "Anfragen"} ${label} freigegeben`,
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
        <Link
          href="/"
          className="flex min-h-12 items-center rounded-md px-2 text-sm text-stone-500 hover:bg-stone-100"
        >
          ← Zurück
        </Link>
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
      </header>

      <main className="mx-auto w-full max-w-lg flex-1 space-y-4 p-4 pb-28">
        {geladen && !aktivesEvent && (
          <p className="text-sm text-stone-600">Noch kein Event angelegt.</p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-base font-semibold text-stone-900">
            Offene Anfragen{" "}
            <span className="font-sans text-sm font-normal text-stone-500">
              {anfragen.length} ({personenText(anzahlPersonenAnfragen)})
            </span>
          </h2>
          {anfragen.length > 0 && (
            <button
              type="button"
              onClick={() =>
                freigeben(
                  anfragen.map((gast) => gast.id),
                  "",
                )
              }
              className="min-h-12 rounded-md bg-amber-800 px-4 text-sm font-semibold text-amber-50"
            >
              Alle {anfragen.length} freigeben
            </button>
          )}
        </div>

        {anfragen.length === 0 && (
          <p className="rounded-md border border-stone-200 bg-white p-4 text-sm text-stone-500">
            Keine offenen Anfragen.
          </p>
        )}

        {eventId &&
          gruppen.map((gruppe) => (
            <AnfrageGruppe
              key={gruppe.schluessel}
              gruppe={gruppe}
              eventId={eventId}
              onBearbeiten={(gast) => setFormular({ offen: true, gast })}
              onAlleFreigeben={freigeben}
            />
          ))}

        <Link
          href="/ansprechpartner"
          className="flex min-h-12 items-center justify-between rounded-md border border-stone-300 bg-white px-4 text-sm text-stone-700 hover:bg-stone-100"
        >
          <span>Alle Gäste nach Ansprechpartner</span>
          <span aria-hidden="true">→</span>
        </Link>

        <section className="space-y-3 rounded-md border border-stone-200 bg-white p-4">
          <h2 className="font-display text-base font-semibold text-stone-900">
            Schon auf der Liste?{" "}
            <span className="font-sans text-sm font-normal text-stone-500">
              {freigegeben.length} Einträge
            </span>
          </h2>
          <input
            type="search"
            inputMode="search"
            placeholder="Name prüfen…"
            value={suche}
            onChange={(e) => setSuche(e.target.value)}
            className="min-h-12 w-full rounded-md border border-stone-300 bg-stone-50 px-3 text-stone-900 outline-none focus:border-stone-500"
          />
          {begriffe.length > 0 &&
            (trefferListe.length === 0 ? (
              <p className="text-sm text-stone-500">Nicht auf der Liste.</p>
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
                      {gast.quelle === "mitglied"
                        ? "JIM Mitglied"
                        : gast.ansprechpartner
                          ? `über ${gast.ansprechpartner}`
                          : "Gast"}
                    </span>
                  </li>
                ))}
              </ul>
            ))}
        </section>

        <AnfrageLink />
      </main>

      {formular.offen && (
        <GastFormular
          gast={formular.gast}
          onClose={() => setFormular({ offen: false })}
        />
      )}
    </div>
  );
}

export default function AnfragenSeite() {
  return (
    <NurAdmin>
      <AnfragenInhalt />
    </NurAdmin>
  );
}
