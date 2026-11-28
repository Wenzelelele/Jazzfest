"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useEvents } from "@/contexts/EventContext";
import { useMeldung } from "@/contexts/MeldungContext";
import { useGaeste } from "@/hooks/useGaeste";
import { useWakeLock } from "@/hooks/useWakeLock";
import { abendkasseAendern, formatiereDatum } from "@/lib/events";
import { ladeCsvHerunter } from "@/lib/export";
import {
  gastPasstZurSuche,
  istAngefragt,
  istVollstaendigDa,
  summiere,
} from "@/lib/gaeste";
import { ROLLEN_LABEL } from "@/lib/veranstalter";
import { suchBegriffe } from "@/lib/suche";
import { GastZeile } from "@/components/GastZeile";
import { GastFormular } from "@/components/GastFormular";
import { VerbindungsIndikator } from "@/components/VerbindungsIndikator";
import type { GastMitId } from "@/lib/gaeste";
import { anzeigeName } from "@/lib/benutzername";

type FilterWert = "alle" | "nicht-da" | "schon-da";
type TabWert = "gaeste" | "mitglieder" | "abendkasse";

const FILTER_OPTIONEN: { wert: FilterWert; label: string }[] = [
  { wert: "alle", label: "Alle" },
  { wert: "nicht-da", label: "Noch nicht da" },
  { wert: "schon-da", label: "Schon da" },
];

type FormularStatus =
  { offen: false } | { offen: true; gast?: GastMitId; vorgabeName?: string };

function Menue({ onExport }: { onExport: () => void }) {
  const { istAdmin, istSuperAdmin, rolle, user, zugang, veranstalter, veranstalterId } =
    useAuth();
  const [offen, setOffen] = useState(false);
  const eintrag =
    "flex min-h-12 w-full items-center px-4 text-left text-sm text-stone-700 hover:bg-stone-100";
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOffen((o) => !o)}
        aria-expanded={offen}
        aria-label="Menü"
        className="min-h-12 min-w-12 rounded-md border border-stone-300 text-lg text-stone-600 hover:bg-stone-100"
      >
        ☰
      </button>
      {offen && (
        <>
          <button
            type="button"
            aria-label="Menü schließen"
            className="fixed inset-0 z-20 cursor-default"
            onClick={() => setOffen(false)}
          />
          <div className="absolute right-0 z-30 mt-2 w-56 overflow-hidden rounded-md border border-stone-200 bg-white py-1 shadow-lg">
            <Link href="/events" className={eintrag}>
              {istAdmin ? "Events verwalten" : "Event wählen"}
            </Link>
            {istAdmin && (
              <>
                <Link href="/anfragen" className={eintrag}>
                  Anfragen freigeben
                </Link>
                <Link href="/ansprechpartner" className={eintrag}>
                  Gäste nach Ansprechpartner
                </Link>
                <Link href={`/gaesteliste/${veranstalterId}`} className={eintrag}>
                  Anfrage-Link (öffentlich)
                </Link>
                <Link href="/text-import" className={eintrag}>
                  Gäste aus Text einfügen
                </Link>
                <Link href="/zugaenge" className={eintrag}>
                  Kassen & Zugänge
                </Link>
                <Link href="/statistik" className={eintrag}>
                  Statistik
                </Link>
                <Link href="/import" className={eintrag}>
                  Mitglieder importieren
                </Link>
                <button
                  type="button"
                  className={eintrag}
                  onClick={() => {
                    setOffen(false);
                    onExport();
                  }}
                >
                  Export als CSV
                </button>
              </>
            )}
            {istSuperAdmin && (
              <Link href="/veranstalter" className={eintrag}>
                Veranstalter wechseln / verwalten
              </Link>
            )}
            <p className="truncate border-t border-stone-200 px-4 pt-2 text-xs text-stone-400">
              {veranstalter?.name ?? veranstalterId}
            </p>
            <p className="truncate px-4 pt-1 text-xs text-stone-400">
              {user?.isAnonymous ? zugang?.name : anzeigeName(user?.email)} ·{" "}
              {istSuperAdmin ? "Super-Admin" : rolle ? ROLLEN_LABEL[rolle] : ""}
            </p>
            <button
              type="button"
              className={`${eintrag} text-stone-500`}
              onClick={() => signOut(auth)}
            >
              Abmelden
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function Abendkasse({ eventId, anzahl }: { eventId: string; anzahl: number }) {
  const { beobachte } = useMeldung();
  const aendern = (delta: number) =>
    beobachte(
      abendkasseAendern(eventId, delta),
      "Abendkasse konnte nicht gespeichert werden.",
    );
  return (
    <div className="mx-auto flex max-w-sm flex-col items-center gap-6 p-8 text-center">
      <p className="text-sm text-stone-500">
        Personen ohne Listeneintrag, die an der Abendkasse reingekommen sind.
        Mehrere Geräte können gleichzeitig zählen - auch offline.
      </p>
      <p className="font-display text-7xl font-semibold text-stone-900">
        {anzahl}
      </p>
      <button
        type="button"
        onClick={() => aendern(1)}
        className="min-h-24 w-full rounded-lg bg-stone-900 text-4xl font-semibold text-stone-50 active:bg-stone-700"
      >
        +1
      </button>
      <button
        type="button"
        onClick={() => aendern(-1)}
        disabled={anzahl <= 0}
        className="min-h-12 w-32 rounded-md border border-stone-300 text-lg text-stone-600 disabled:opacity-40"
      >
        −1
      </button>
    </div>
  );
}

export default function Home() {
  const { aktivesEvent, geladen } = useEvents();
  const { istAdmin } = useAuth();
  const eventId = aktivesEvent?.id;
  const alleEintraege = useGaeste(eventId);
  // Angefragte Gäste stehen noch nicht auf der Einlassliste.
  const gaeste = useMemo(
    () => alleEintraege.filter((gast) => !istAngefragt(gast)),
    [alleEintraege],
  );
  const offeneAnfragen = alleEintraege.length - gaeste.length;

  const [tab, setTab] = useState<TabWert>("gaeste");
  const [suche, setSuche] = useState("");
  const [filter, setFilter] = useState<FilterWert>("alle");
  const [formular, setFormular] = useState<FormularStatus>({ offen: false });

  // Bildschirm am Einlass wach halten, solange die Liste offen ist.
  useWakeLock(true);

  const begriffe = useMemo(() => suchBegriffe(suche), [suche]);

  const { listeGaeste, listeMitglieder } = useMemo(
    () => ({
      listeGaeste: gaeste.filter((gast) => gast.quelle !== "mitglied"),
      listeMitglieder: gaeste.filter((gast) => gast.quelle === "mitglied"),
    }),
    [gaeste],
  );

  const summeGaeste = useMemo(() => summiere(listeGaeste), [listeGaeste]);
  const summeMitglieder = useMemo(
    () => summiere(listeMitglieder),
    [listeMitglieder],
  );
  const abendkasse = aktivesEvent?.abendkasse ?? 0;
  const imSaal =
    summeGaeste.eingecheckt + summeMitglieder.eingecheckt + abendkasse;

  const gaesteImTab = tab === "mitglieder" ? listeMitglieder : listeGaeste;
  const andererTab = tab === "mitglieder" ? listeGaeste : listeMitglieder;

  const sichtbareGaeste = useMemo(() => {
    return gaesteImTab.filter((gast) => {
      if (!gastPasstZurSuche(gast, begriffe)) return false;
      if (filter === "schon-da" && !istVollstaendigDa(gast)) return false;
      if (filter === "nicht-da" && istVollstaendigDa(gast)) return false;
      return true;
    });
  }, [gaesteImTab, begriffe, filter]);

  const trefferAndererTab = useMemo(
    () =>
      begriffe.length > 0
        ? andererTab.filter((gast) => gastPasstZurSuche(gast, begriffe)).length
        : 0,
    [andererTab, begriffe],
  );

  const tabs: { wert: TabWert; label: string; zahl: string }[] = [
    {
      wert: "gaeste",
      label: "Gäste",
      zahl: `${summeGaeste.eingecheckt}/${summeGaeste.gesamt}`,
    },
    {
      wert: "mitglieder",
      label: "JIM Mitglieder",
      zahl: `${summeMitglieder.eingecheckt}/${summeMitglieder.gesamt}`,
    },
    { wert: "abendkasse", label: "Abendkasse", zahl: String(abendkasse) },
  ];

  if (geladen && !aktivesEvent) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
        <p className="font-display text-2xl font-semibold text-stone-900">
          Jazzfest
        </p>
        <p className="text-sm text-stone-500">Noch kein Event angelegt.</p>
        {istAdmin ? (
          <Link
            href="/events"
            className="flex min-h-12 items-center rounded-md bg-stone-900 px-5 font-medium text-stone-50"
          >
            Event anlegen
          </Link>
        ) : (
          <p className="text-sm text-stone-500">
            Events legt ein Admin an - sobald eins existiert, erscheint es hier.
          </p>
        )}
        <button
          type="button"
          onClick={() => signOut(auth)}
          className="text-xs text-stone-500 underline"
        >
          Abmelden
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-10 space-y-3 border-b border-stone-200 bg-white/95 p-4 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <Link href="/events" className="min-w-0 flex-1">
            <span className="block truncate font-display text-lg leading-tight font-semibold tracking-tight text-stone-900">
              {aktivesEvent?.name ?? "Jazzfest"}
            </span>
            <span className="flex items-center gap-2 text-xs text-stone-500">
              {aktivesEvent && formatiereDatum(aktivesEvent.datum)}
              <VerbindungsIndikator eventId={eventId} />
            </span>
          </Link>
          <div className="text-right">
            <p className="text-lg leading-tight font-semibold text-stone-900">
              {imSaal}
            </p>
            <p className="text-xs text-stone-500">im Saal</p>
          </div>
          <Menue
            onExport={() =>
              aktivesEvent && ladeCsvHerunter(aktivesEvent, gaeste)
            }
          />
        </div>

        <div className="flex gap-2">
          {tabs.map((option) => (
            <button
              key={option.wert}
              type="button"
              onClick={() => setTab(option.wert)}
              aria-pressed={tab === option.wert}
              className={`flex min-h-12 flex-1 flex-col items-center justify-center rounded-md px-2 text-sm leading-tight font-medium ${
                tab === option.wert
                  ? "bg-stone-900 text-stone-50"
                  : "border border-stone-300 text-stone-600"
              }`}
            >
              <span>{option.label}</span>
              <span
                className={`text-xs font-normal ${
                  tab === option.wert ? "text-stone-300" : "text-stone-400"
                }`}
              >
                {option.zahl}
              </span>
            </button>
          ))}
        </div>

        {istAdmin && offeneAnfragen > 0 && (
          <Link
            href="/anfragen"
            className="flex min-h-12 items-center justify-between rounded-md border border-amber-300 bg-amber-50 px-3 text-sm text-amber-900"
          >
            <span>
              {offeneAnfragen}{" "}
              {offeneAnfragen === 1 ? "Anfrage wartet" : "Anfragen warten"} auf
              Freigabe
            </span>
            <span aria-hidden="true">→</span>
          </Link>
        )}

        {tab !== "abendkasse" && (
          <>
            <input
              type="search"
              inputMode="search"
              placeholder="Name suchen…"
              value={suche}
              onChange={(event) => setSuche(event.target.value)}
              className="min-h-12 w-full rounded-md border border-stone-300 bg-stone-50 px-3 text-stone-900 outline-none focus:border-stone-500"
            />

            <div className="flex gap-2">
              {FILTER_OPTIONEN.map((option) => (
                <button
                  key={option.wert}
                  type="button"
                  onClick={() => setFilter(option.wert)}
                  aria-pressed={filter === option.wert}
                  className={`min-h-12 flex-1 rounded-md px-3 text-sm ${
                    filter === option.wert
                      ? "bg-stone-900 text-stone-50"
                      : "border border-stone-300 text-stone-600"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </>
        )}
      </header>

      {tab === "abendkasse" && eventId ? (
        <main className="flex-1">
          <Abendkasse eventId={eventId} anzahl={abendkasse} />
        </main>
      ) : (
        <main className="flex-1 pb-28">
          <div className="divide-y divide-stone-200">
            {sichtbareGaeste.map((gast) => (
              <GastZeile
                key={gast.id}
                gast={gast}
                suchBegriffe={begriffe}
                onBearbeiten={
                  istAdmin
                    ? (gast) => setFormular({ offen: true, gast })
                    : undefined
                }
              />
            ))}
          </div>

          {sichtbareGaeste.length === 0 && (
            <p className="p-6 text-center text-sm text-stone-500">
              {tab === "gaeste"
                ? "Keine Gäste gefunden."
                : "Keine Mitglieder gefunden."}
            </p>
          )}

          {trefferAndererTab > 0 && (
            <button
              type="button"
              onClick={() =>
                setTab(tab === "mitglieder" ? "gaeste" : "mitglieder")
              }
              className="mx-4 mt-4 block min-h-12 w-[calc(100%-2rem)] rounded-md border border-amber-300 bg-amber-50 px-3 text-sm text-amber-900"
            >
              {trefferAndererTab} Treffer bei{" "}
              {tab === "mitglieder" ? "Gäste" : "JIM Mitglieder"} anzeigen
            </button>
          )}

          {istAdmin && suche.trim().length > 0 && (
            <button
              type="button"
              onClick={() =>
                setFormular({ offen: true, vorgabeName: suche.trim() })
              }
              className="mx-4 mt-3 block min-h-12 w-[calc(100%-2rem)] rounded-md border border-dashed border-stone-400 px-3 text-sm text-stone-700 hover:bg-stone-100"
            >
              „{suche.trim()}&ldquo; als Gast hinzufügen
            </button>
          )}
        </main>
      )}

      {istAdmin && tab === "gaeste" && (
        <div className="fixed right-5 bottom-5 z-10">
          <button
            type="button"
            onClick={() => setFormular({ offen: true, gast: undefined })}
            aria-label="Gast hinzufügen"
            className="flex h-14 w-14 items-center justify-center rounded-full bg-stone-900 text-3xl text-stone-50 shadow-lg hover:bg-stone-800"
          >
            +
          </button>
        </div>
      )}

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
