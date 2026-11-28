"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useState,
  useSyncExternalStore,
  type FormEvent,
  type ReactNode,
} from "react";
import { onSnapshot } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { useMeldung } from "@/contexts/MeldungContext";
import { NurAdmin } from "@/components/NurAdmin";
import { eingabeKlasse } from "@/components/Beitreten";
import {
  ROLLEN_LABEL,
  einladungenVon,
  erstelleEinladung,
  erstelleKassencode,
  formatiereCode,
  kassencodesVon,
  loescheEinladung,
  loescheKassencode,
  loescheVeranstalter,
  zugaengeVon,
  zugangEntfernen,
  type Einladung,
  type Kassencode,
  type ZugangMitId,
} from "@/lib/veranstalter";

const knopfKlein =
  "min-h-10 rounded-md border border-stone-300 px-3 text-xs text-stone-600 hover:bg-stone-100";

function useOrigin() {
  return useSyncExternalStore(
    () => () => {},
    () => window.location.origin,
    () => "",
  );
}

function Abschnitt({
  titel,
  children,
}: {
  titel: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3 rounded-md border border-stone-200 bg-white p-4">
      <h2 className="font-display text-base font-semibold text-stone-900">
        {titel}
      </h2>
      {children}
    </section>
  );
}

function Kopieren({ text, label }: { text: string; label?: string }) {
  const { zeigeInfo, zeigeFehler } = useMeldung();
  return (
    <button
      type="button"
      onClick={() =>
        navigator.clipboard
          ?.writeText(text)
          .then(() => zeigeInfo("Kopiert"))
          .catch(() => zeigeFehler("Kopieren nicht möglich."))
      }
      className="block min-h-12 w-full rounded-md border border-stone-300 bg-stone-50 px-3 text-left font-mono text-sm break-all text-stone-900"
    >
      {label ?? text}
    </button>
  );
}

// Live-Liste einer Abfrage (Codes, Einladungen, Zugänge) des Veranstalters.
function useListe<T>(
  abfrage: ReturnType<typeof zugaengeVon> | null,
  schluessel: string,
) {
  const [stand, setStand] = useState<{ schluessel: string; liste: (T & { id: string })[] }>({
    schluessel: "",
    liste: [],
  });
  const { zeigeFehler } = useMeldung();
  useEffect(() => {
    if (!abfrage) return;
    return onSnapshot(
      abfrage,
      (s) =>
        setStand({
          schluessel,
          liste: s.docs.map((d) => ({ id: d.id, ...(d.data() as T) })),
        }),
      (fehler) => zeigeFehler("Liste konnte nicht geladen werden.", fehler),
    );
    // abfrage hängt nur an schluessel
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schluessel, zeigeFehler]);
  return stand.schluessel === schluessel ? stand.liste : [];
}

function KassenCodes({
  veranstalterId,
  geraete,
}: {
  veranstalterId: string;
  geraete: ZugangMitId[];
}) {
  const { beobachte, zeigeInfo, zeigeFehler } = useMeldung();
  const codes = useListe<Kassencode>(
    kassencodesVon(veranstalterId),
    `codes-${veranstalterId}`,
  );
  const [name, setName] = useState("");
  const [loeschen, setLoeschen] = useState<string | null>(null);

  async function anlegen(event: FormEvent) {
    event.preventDefault();
    try {
      await erstelleKassencode(veranstalterId, name);
      setName("");
      zeigeInfo("Kassen-Code angelegt");
    } catch (fehler) {
      zeigeFehler("Code konnte nicht angelegt werden.", fehler);
    }
  }

  return (
    <Abschnitt titel="Kassen-Codes">
      <p className="text-sm text-stone-600">
        Am Einlass-Gerät die App öffnen → „Kassen-Code“ → Code eingeben. Ein
        Code kann für beliebig viele Geräte benutzt werden. Löschen meldet
        alle Geräte dieses Codes ab.
      </p>
      <ul className="space-y-2">
        {codes.map((code) => {
          const anzahl = geraete.filter((g) => g.code === code.id).length;
          return (
            <li
              key={code.id}
              className="space-y-2 rounded-md border border-stone-200 p-3"
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm text-stone-900">{code.name}</span>
                <span className="text-xs text-stone-500">
                  {anzahl} {anzahl === 1 ? "Gerät" : "Geräte"}
                </span>
              </div>
              <Kopieren
                text={formatiereCode(code.id)}
                label={formatiereCode(code.id)}
              />
              {loeschen === code.id ? (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setLoeschen(null)}
                    className={`${knopfKlein} flex-1`}
                  >
                    Abbrechen
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      beobachte(
                        loescheKassencode(veranstalterId, code.id),
                        "Code konnte nicht gelöscht werden.",
                      );
                      setLoeschen(null);
                    }}
                    className="min-h-10 flex-1 rounded-md bg-red-700 text-xs text-white"
                  >
                    Code + {anzahl} {anzahl === 1 ? "Gerät" : "Geräte"} löschen
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setLoeschen(code.id)}
                  className="text-xs text-red-700 underline-offset-2 hover:underline"
                >
                  Löschen…
                </button>
              )}
            </li>
          );
        })}
      </ul>
      <form onSubmit={anlegen} className="flex gap-2">
        <input
          type="text"
          placeholder="Bezeichnung, z. B. Einlass"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={eingabeKlasse}
        />
        <button
          type="submit"
          className="min-h-12 shrink-0 rounded-md bg-stone-900 px-4 text-sm font-medium text-stone-50"
        >
          + Code
        </button>
      </form>
    </Abschnitt>
  );
}

function Zugaenge({ geraete }: { geraete: ZugangMitId[] }) {
  const { user } = useAuth();
  const { beobachte, zeigeInfo } = useMeldung();
  const [entfernen, setEntfernen] = useState<string | null>(null);
  const sortiert = [...geraete].sort(
    (a, b) =>
      a.rolle.localeCompare(b.rolle) || a.name.localeCompare(b.name, "de"),
  );

  return (
    <Abschnitt titel="Admins & Kassen-Geräte">
      {sortiert.length === 0 && (
        <p className="text-sm text-stone-500">Noch niemand.</p>
      )}
      <ul className="divide-y divide-stone-100">
        {sortiert.map((z) => (
          <li key={z.id} className="flex items-center gap-3 py-2">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm text-stone-900">
                {z.name}
                {z.id === user?.uid && (
                  <span className="text-xs text-stone-500"> (du)</span>
                )}
              </span>
              <span className="text-xs text-stone-500">
                {ROLLEN_LABEL[z.rolle]}
              </span>
            </span>
            {z.id !== user?.uid &&
              (entfernen === z.id ? (
                <span className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setEntfernen(null)}
                    className={knopfKlein}
                  >
                    Nein
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      beobachte(
                        zugangEntfernen(z.id),
                        `${z.name} konnte nicht entfernt werden.`,
                      );
                      zeigeInfo(`${z.name} entfernt`);
                      setEntfernen(null);
                    }}
                    className="min-h-10 rounded-md bg-red-700 px-3 text-xs text-white"
                  >
                    Entfernen
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setEntfernen(z.id)}
                  className="text-xs text-red-700 underline-offset-2 hover:underline"
                >
                  Entfernen…
                </button>
              ))}
          </li>
        ))}
      </ul>
    </Abschnitt>
  );
}

function Einladungen({ veranstalterId }: { veranstalterId: string }) {
  const origin = useOrigin();
  const { beobachte, zeigeFehler } = useMeldung();
  const offen = useListe<Einladung>(
    einladungenVon(veranstalterId),
    `einladungen-${veranstalterId}`,
  ).filter((e) => !e.benutztVon);

  return (
    <Abschnitt titel="Admin einladen">
      <p className="text-sm text-stone-600">
        Jede Einladung gilt einmal: Wer den Link öffnet, legt sich ein eigenes
        Admin-Konto (Benutzername + Passwort) für diesen Veranstalter an.
      </p>
      <ul className="space-y-2">
        {offen.map((e) => (
          <li key={e.id} className="space-y-2 rounded-md border border-stone-200 p-3">
            <Kopieren
              text={`${origin}/login?einladung=${e.id}`}
              label={`${origin}/login?einladung=${formatiereCode(e.id)}`}
            />
            <button
              type="button"
              onClick={() =>
                beobachte(loescheEinladung(e.id), "Löschen fehlgeschlagen.")
              }
              className="text-xs text-red-700 underline-offset-2 hover:underline"
            >
              Einladung zurückziehen
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() =>
          erstelleEinladung(veranstalterId).catch((fehler) =>
            zeigeFehler("Einladung konnte nicht angelegt werden.", fehler),
          )
        }
        className="min-h-12 w-full rounded-md border border-stone-300 text-sm text-stone-700 hover:bg-stone-100"
      >
        + Neue Einladung
      </button>
    </Abschnitt>
  );
}

function Loeschen({ veranstalterId, name }: { veranstalterId: string; name: string }) {
  const { user, istSuperAdmin, waehleVeranstalter } = useAuth();
  const { zeigeFehler, zeigeInfo } = useMeldung();
  const router = useRouter();
  const [eingabe, setEingabe] = useState("");
  const [laeuft, setLaeuft] = useState(false);

  async function loeschen() {
    setLaeuft(true);
    try {
      await loescheVeranstalter(veranstalterId, user?.uid);
      zeigeInfo(`${name} wurde gelöscht.`);
      if (istSuperAdmin) {
        waehleVeranstalter(null);
        router.replace("/veranstalter");
      }
    } catch (fehler) {
      zeigeFehler("Löschen fehlgeschlagen - bitte online nochmal versuchen.", fehler);
      setLaeuft(false);
    }
  }

  return (
    <section className="space-y-3 rounded-md border border-red-300 bg-red-50 p-4">
      <h2 className="font-display text-base font-semibold text-red-900">
        Veranstalter löschen
      </h2>
      <p className="text-sm text-red-900">
        Löscht <strong>alles</strong> von {name}: alle Events, Gäste,
        Mitglieder, Check-ins, Kassen-Codes und Zugänge. Das kann nicht
        rückgängig gemacht werden. Zum Bestätigen den Namen eintippen:
      </p>
      <input
        type="text"
        value={eingabe}
        onChange={(e) => setEingabe(e.target.value)}
        placeholder={name}
        className={eingabeKlasse}
      />
      <button
        type="button"
        disabled={eingabe.trim() !== name.trim() || laeuft}
        onClick={loeschen}
        className="min-h-12 w-full rounded-md bg-red-700 font-medium text-white disabled:opacity-40"
      >
        {laeuft ? "Wird gelöscht…" : "Endgültig löschen"}
      </button>
    </section>
  );
}

function ZugaengeInhalt() {
  const { veranstalterId, veranstalter } = useAuth();
  const origin = useOrigin();
  const geraete = useListe<ZugangMitId>(
    veranstalterId ? zugaengeVon(veranstalterId) : null,
    `zugaenge-${veranstalterId}`,
  );
  if (!veranstalterId) return null;
  const name = veranstalter?.name ?? veranstalterId;

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
            Kassen & Zugänge
          </h1>
          <p className="truncate text-xs text-stone-500">{name}</p>
        </div>
      </header>

      <main className="mx-auto w-full max-w-lg flex-1 space-y-4 p-4">
        <Abschnitt titel="Öffentlicher Anfrage-Link">
          <p className="text-sm text-stone-600">
            An Bands & Co. schicken - dort werden ohne Login Gäste für eure
            Events angefragt.
          </p>
          <Kopieren text={`${origin}/gaesteliste/${veranstalterId}`} />
        </Abschnitt>
        <KassenCodes veranstalterId={veranstalterId} geraete={geraete} />
        <Zugaenge geraete={geraete} />
        <Einladungen veranstalterId={veranstalterId} />
        <Loeschen veranstalterId={veranstalterId} name={name} />
      </main>
    </div>
  );
}

export default function ZugaengeSeite() {
  return (
    <NurAdmin>
      <ZugaengeInhalt />
    </NurAdmin>
  );
}
