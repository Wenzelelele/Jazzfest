"use client";

import Link from "next/link";
import { NurAdmin } from "@/components/NurAdmin";
import { useMemo, useState } from "react";
import type { Timestamp } from "firebase/firestore";
import { useEvents } from "@/contexts/EventContext";
import { useGaeste } from "@/hooks/useGaeste";
import { formatiereDatum } from "@/lib/events";
import { summiere, type GastMitId } from "@/lib/gaeste";

const INTERVALL_MIN = 15;

interface Ankunft {
  zeit: Date;
  von: string;
}

function sammleAnkuenfte(gaeste: readonly GastMitId[]): Ankunft[] {
  const ergebnis: Ankunft[] = [];
  const hinzu = (
    checkedIn: boolean,
    zeitpunkt: Timestamp | null,
    von: string | null | undefined,
  ) => {
    // Offline-Check-ins haben bis zum Sync noch keinen Server-Zeitstempel
    // (null) - die zählen in den Summen, aber noch nicht im Zeitverlauf.
    if (!checkedIn || !zeitpunkt || typeof zeitpunkt.toDate !== "function") return;
    ergebnis.push({ zeit: zeitpunkt.toDate(), von: von || "unbekannt" });
  };
  for (const gast of gaeste) {
    hinzu(gast.checkedIn, gast.checkedInAt, gast.checkedInBy);
    for (const person of Object.values(gast.begleitung)) {
      hinzu(person.checkedIn, person.checkedInAt, person.checkedInBy);
    }
  }
  return ergebnis.sort((a, b) => a.zeit.getTime() - b.zeit.getTime());
}

function uhr(datum: Date): string {
  return datum.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}

interface Fenster {
  start: Date;
  anzahl: number;
}

function inFenster(ankuenfte: readonly Ankunft[]): Fenster[] {
  if (ankuenfte.length === 0) return [];
  const ms = INTERVALL_MIN * 60 * 1000;
  const erstes = Math.floor(ankuenfte[0].zeit.getTime() / ms) * ms;
  const letztes = Math.floor(ankuenfte[ankuenfte.length - 1].zeit.getTime() / ms) * ms;
  // Obergrenze gegen Ausreißer (z. B. ein Test-Check-in Tage vorher)
  const anzahlFenster = Math.min(Math.round((letztes - erstes) / ms) + 1, 96);
  const startZeit = letztes - (anzahlFenster - 1) * ms;
  const fenster: Fenster[] = Array.from({ length: anzahlFenster }, (_, i) => ({
    start: new Date(startZeit + i * ms),
    anzahl: 0,
  }));
  for (const ankunft of ankuenfte) {
    const index = Math.floor((ankunft.zeit.getTime() - startZeit) / ms);
    if (index >= 0 && index < fenster.length) fenster[index].anzahl += 1;
  }
  return fenster;
}

function Kachel({
  wert,
  label,
  zusatz,
}: {
  wert: string | number;
  label: string;
  zusatz?: string;
}) {
  return (
    <div className="rounded-md border border-stone-200 bg-white p-4">
      <p className="text-3xl font-semibold text-stone-900 tabular-nums">{wert}</p>
      <p className="text-sm text-stone-600">{label}</p>
      {zusatz && <p className="text-xs text-stone-500">{zusatz}</p>}
    </div>
  );
}

function AnkunftsDiagramm({ fenster }: { fenster: Fenster[] }) {
  const [gewaehlt, setGewaehlt] = useState<number | null>(null);
  const [alsTabelle, setAlsTabelle] = useState(false);
  const max = Math.max(1, ...fenster.map((f) => f.anzahl));
  const spitze = fenster.reduce(
    (beste, f, i) => (f.anzahl > fenster[beste].anzahl ? i : beste),
    0,
  );
  const anzeige = gewaehlt ?? spitze;
  const bis = (f: Fenster) => new Date(f.start.getTime() + INTERVALL_MIN * 60 * 1000);
  // Nur jede n-te Achsenbeschriftung, damit nichts kollidiert
  const beschriftungAlle = Math.max(1, Math.ceil(fenster.length / 6));

  return (
    <section className="space-y-3 rounded-md border border-stone-200 bg-white p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-base font-semibold text-stone-900">
          Ankünfte pro {INTERVALL_MIN} Minuten
        </h2>
        <button
          type="button"
          onClick={() => setAlsTabelle((t) => !t)}
          className="min-h-10 text-xs text-stone-500 underline"
        >
          {alsTabelle ? "Diagramm" : "Tabelle"}
        </button>
      </div>

      {alsTabelle ? (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-stone-500">
              <th className="py-1 font-normal">Zeitraum</th>
              <th className="py-1 text-right font-normal">Personen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {fenster.map((f) => (
              <tr key={f.start.getTime()}>
                <td className="py-1 text-stone-700">
                  {uhr(f.start)}–{uhr(bis(f))}
                </td>
                <td className="py-1 text-right text-stone-900 tabular-nums">{f.anzahl}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <>
          <p className="text-sm text-stone-600" aria-live="polite">
            <span className="font-semibold text-stone-900 tabular-nums">
              {fenster[anzeige].anzahl}
            </span>{" "}
            Personen {uhr(fenster[anzeige].start)}–{uhr(bis(fenster[anzeige]))}
            {gewaehlt === null && fenster.length > 1 && " (Spitze)"}
          </p>
          <div
            className="flex h-40 items-end gap-0.5 border-b border-stone-300"
            onPointerLeave={() => setGewaehlt(null)}
          >
            {fenster.map((f, i) => (
              <button
                key={f.start.getTime()}
                type="button"
                aria-label={`${uhr(f.start)}: ${f.anzahl} Personen`}
                onPointerEnter={() => setGewaehlt(i)}
                onFocus={() => setGewaehlt(i)}
                onClick={() => setGewaehlt(i)}
                className="flex h-full flex-1 items-end"
              >
                <span
                  className={`block w-full rounded-t ${
                    i === anzeige ? "bg-amber-900" : "bg-amber-700"
                  }`}
                  style={{ height: `${(f.anzahl / max) * 100}%`, minHeight: f.anzahl > 0 ? 2 : 0 }}
                />
              </button>
            ))}
          </div>
          <div className="flex gap-0.5 text-[10px] text-stone-500">
            {fenster.map((f, i) => (
              <span key={f.start.getTime()} className="flex-1 overflow-visible whitespace-nowrap">
                {i % beschriftungAlle === 0 ? uhr(f.start) : ""}
              </span>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function StatistikSeiteInhalt() {
  const { aktivesEvent } = useEvents();
  const gaeste = useGaeste(aktivesEvent?.id);

  const daten = useMemo(() => {
    const gaesteListe = gaeste.filter((g) => g.quelle !== "mitglied");
    const mitglieder = gaeste.filter((g) => g.quelle === "mitglied");
    const summeGaeste = summiere(gaesteListe);
    const summeMitglieder = summiere(mitglieder);
    const ankuenfte = sammleAnkuenfte(gaeste);
    const proAccount = new Map<string, number>();
    for (const a of ankuenfte) proAccount.set(a.von, (proAccount.get(a.von) ?? 0) + 1);
    return {
      summeGaeste,
      summeMitglieder,
      ankuenfte,
      fenster: inFenster(ankuenfte),
      proAccount: [...proAccount.entries()].sort((a, b) => b[1] - a[1]),
    };
  }, [gaeste]);

  const abendkasse = aktivesEvent?.abendkasse ?? 0;
  const { summeGaeste, summeMitglieder } = daten;
  const imSaal = summeGaeste.eingecheckt + summeMitglieder.eingecheckt + abendkasse;
  const gaesteNoShow = summeGaeste.gesamt - summeGaeste.eingecheckt;
  const quote = (teil: number, ganz: number) =>
    ganz > 0 ? `${Math.round((teil / ganz) * 100)} %` : "–";

  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-stone-200 bg-white/95 p-4 backdrop-blur">
        <Link
          href="/"
          className="flex min-h-12 items-center rounded-md px-2 text-sm text-stone-500 hover:bg-stone-100"
        >
          ← Zurück
        </Link>
        <div className="min-w-0">
          <h1 className="font-display text-lg leading-tight font-semibold text-stone-900">
            Statistik
          </h1>
          {aktivesEvent && (
            <p className="truncate text-xs text-stone-500">
              {aktivesEvent.name} · {formatiereDatum(aktivesEvent.datum)}
            </p>
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-lg flex-1 space-y-4 p-4">
        <div className="grid grid-cols-2 gap-3">
          <Kachel wert={imSaal} label="Personen im Saal" zusatz="inkl. Abendkasse" />
          <Kachel wert={abendkasse} label="Abendkasse" />
          <Kachel
            wert={`${summeGaeste.eingecheckt}/${summeGaeste.gesamt}`}
            label="Gästeliste"
            zusatz={`${quote(summeGaeste.eingecheckt, summeGaeste.gesamt)} da · ${gaesteNoShow} fehlen`}
          />
          <Kachel
            wert={`${summeMitglieder.eingecheckt}/${summeMitglieder.gesamt}`}
            label="JIM Mitglieder"
            zusatz={`${quote(summeMitglieder.eingecheckt, summeMitglieder.gesamt)} da`}
          />
        </div>

        {daten.fenster.length > 0 ? (
          <AnkunftsDiagramm fenster={daten.fenster} />
        ) : (
          <p className="rounded-md border border-stone-200 bg-white p-4 text-sm text-stone-500">
            Noch keine Check-ins mit Uhrzeit.
          </p>
        )}

        {daten.ankuenfte.length > 0 && (
          <section className="space-y-2 rounded-md border border-stone-200 bg-white p-4">
            <h2 className="font-display text-base font-semibold text-stone-900">
              Eingecheckt von
            </h2>
            <ul className="divide-y divide-stone-100 text-sm">
              {daten.proAccount.map(([von, anzahl]) => (
                <li key={von} className="flex justify-between gap-3 py-2">
                  <span className="truncate text-stone-700">{von}</span>
                  <span className="text-stone-900 tabular-nums">{anzahl}</span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-stone-500">
              Erster Check-in {uhr(daten.ankuenfte[0].zeit)}, letzter{" "}
              {uhr(daten.ankuenfte[daten.ankuenfte.length - 1].zeit)}.
            </p>
          </section>
        )}
      </main>
    </div>
  );
}

export default function StatistikSeite() {
  return (
    <NurAdmin>
      <StatistikSeiteInhalt />
    </NurAdmin>
  );
}
