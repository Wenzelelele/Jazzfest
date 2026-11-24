"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useEvents } from "@/contexts/EventContext";
import { useGaeste } from "@/hooks/useGaeste";
import { formatiereDatum } from "@/lib/events";
import {
  begleitungText,
  eingecheckePersonen,
  gesamtPersonen,
  gruppiereNachAnsprechpartner,
  istAngefragt,
  type AnsprechpartnerGruppe,
} from "@/lib/gaeste";
import { NurAdmin } from "@/components/NurAdmin";
import { VerbindungsIndikator } from "@/components/VerbindungsIndikator";

// Wer hat wie viele Leute auf die Liste gebracht? Pro Ansprechpartner (Band,
// Musiker, ...) alle Gäste mit Personenzahl, Freigabe-Status und wie viele
// davon schon da sind.

function Gruppe({ gruppe }: { gruppe: AnsprechpartnerGruppe }) {
  const [offen, setOffen] = useState(false);
  const { freigegeben, angefragt } = gruppe;
  return (
    <li>
      <button
        type="button"
        onClick={() => setOffen((o) => !o)}
        aria-expanded={offen}
        className="flex min-h-16 w-full items-center gap-3 p-4 text-left hover:bg-stone-50"
      >
        <span className="text-stone-400">{offen ? "▾" : "▸"}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium text-stone-900">
            {gruppe.name || "Ohne Ansprechpartner"}
          </span>
          <span className="block text-xs text-stone-500">
            {freigegeben.eintraege}{" "}
            {freigegeben.eintraege === 1 ? "Eintrag" : "Einträge"} auf der
            Liste · {freigegeben.da} da
            {angefragt.personen > 0 && (
              <span className="text-amber-800">
                {" "}
                · {angefragt.personen} angefragt
              </span>
            )}
          </span>
        </span>
        <span className="text-right">
          <span className="block text-lg leading-tight font-semibold text-stone-900">
            {freigegeben.personen}
          </span>
          <span className="block text-xs text-stone-500">Personen</span>
        </span>
      </button>
      {offen && (
        <ul className="divide-y divide-stone-100 bg-stone-50 px-4 pb-2 pl-10 text-sm">
          {gruppe.gaeste.map((gast) => (
            <li key={gast.id} className="flex justify-between gap-3 py-2">
              <span className="text-stone-800">
                {gast.name}
                {begleitungText(gast) && (
                  <span className="text-stone-500"> {begleitungText(gast)}</span>
                )}
              </span>
              <span className="shrink-0 text-xs">
                {istAngefragt(gast) ? (
                  <span className="text-amber-800">angefragt</span>
                ) : (
                  <span className="text-stone-500">
                    {eingecheckePersonen(gast)}/{gesamtPersonen(gast)} da
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function AnsprechpartnerInhalt() {
  const { aktivesEvent } = useEvents();
  const eventId = aktivesEvent?.id;
  const gaeste = useGaeste(eventId);

  // Meiste Personen zuerst, "ohne Ansprechpartner" ans Ende.
  const gruppen = useMemo(
    () =>
      gruppiereNachAnsprechpartner(gaeste).sort((a, b) => {
        if (!a.name !== !b.name) return a.name ? -1 : 1;
        return (
          b.freigegeben.personen +
          b.angefragt.personen -
          (a.freigegeben.personen + a.angefragt.personen)
        );
      }),
    [gaeste],
  );
  const summe = gruppen.reduce(
    (s, g) => ({
      personen: s.personen + g.freigegeben.personen,
      da: s.da + g.freigegeben.da,
    }),
    { personen: 0, da: 0 },
  );

  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-stone-200 bg-white/95 p-4 backdrop-blur">
        <Link
          href="/"
          className="flex min-h-12 items-center rounded-md px-2 text-sm text-stone-500 hover:bg-stone-100"
        >
          ← Zurück
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-lg leading-tight font-semibold text-stone-900">
            Nach Ansprechpartner
          </h1>
          <span className="flex items-center gap-2 truncate text-xs text-stone-500">
            {aktivesEvent
              ? `${aktivesEvent.name} · ${formatiereDatum(aktivesEvent.datum)}`
              : "Kein Event"}
            <VerbindungsIndikator eventId={eventId} />
          </span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-lg flex-1 space-y-4 p-4">
        <p className="text-sm text-stone-600">
          Gäste (ohne JIM Mitglieder) gruppiert danach, über wen sie auf die
          Liste kommen. Zahl rechts = freigegebene Personen inkl. Begleitung.
          Insgesamt <strong>{summe.personen}</strong> Personen, davon{" "}
          <strong>{summe.da}</strong> da.
        </p>
        {gruppen.length === 0 ? (
          <p className="text-sm text-stone-500">Noch keine Gäste.</p>
        ) : (
          <ul className="divide-y divide-stone-200 rounded-md border border-stone-200 bg-white">
            {gruppen.map((gruppe) => (
              <Gruppe key={gruppe.schluessel} gruppe={gruppe} />
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}

export default function AnsprechpartnerSeite() {
  return (
    <NurAdmin>
      <AnsprechpartnerInhalt />
    </NurAdmin>
  );
}
