"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

// Eine Meldungsleiste für die ganze App: Fehler (z. B. abgelehnte
// Schreibvorgänge) und "Rückgängig"-Hinweise nach Check-in/Check-out. Vorher
// endeten Fehler nur in console.error - am Einlass hätte das niemand bemerkt.

type Meldung =
  | { id: number; art: "fehler"; text: string }
  | { id: number; art: "info"; text: string; rueckgaengig?: () => void };

interface MeldungContextValue {
  zeigeFehler: (text: string, fehler?: unknown) => void;
  zeigeInfo: (text: string, rueckgaengig?: () => void) => void;
  // Hängt eine Fehlermeldung an einen Schreibvorgang, ohne auf ihn zu
  // warten (offline lösen Firestore-Promises erst nach dem Sync auf).
  beobachte: (promise: Promise<unknown>, fehlerText: string) => void;
}

const MeldungContext = createContext<MeldungContextValue | undefined>(
  undefined,
);

const ANZEIGEDAUER_INFO_MS = 5000;
const ANZEIGEDAUER_FEHLER_MS = 8000;

function fehlerBeschreibung(fehler: unknown): string {
  const code =
    typeof fehler === "object" && fehler !== null && "code" in fehler
      ? String((fehler as { code: unknown }).code)
      : "";
  if (code.includes("permission-denied"))
    return "Keine Berechtigung - bitte neu anmelden.";
  if (code.includes("unauthenticated")) return "Nicht angemeldet.";
  if (code.includes("resource-exhausted"))
    return "Firebase-Kontingent erschöpft.";
  return "";
}

export function MeldungProvider({ children }: { children: ReactNode }) {
  const [meldung, setMeldung] = useState<Meldung | null>(null);
  const zaehler = useRef(0);

  const zeigeFehler = useCallback((text: string, fehler?: unknown) => {
    if (fehler !== undefined) console.error(fehler);
    const zusatz = fehlerBeschreibung(fehler);
    zaehler.current += 1;
    setMeldung({
      id: zaehler.current,
      art: "fehler",
      text: zusatz ? `${text} ${zusatz}` : text,
    });
  }, []);

  const zeigeInfo = useCallback((text: string, rueckgaengig?: () => void) => {
    zaehler.current += 1;
    setMeldung({ id: zaehler.current, art: "info", text, rueckgaengig });
  }, []);

  const beobachte = useCallback(
    (promise: Promise<unknown>, fehlerText: string) => {
      promise.catch((fehler) => zeigeFehler(fehlerText, fehler));
    },
    [zeigeFehler],
  );

  useEffect(() => {
    if (!meldung) return;
    const dauer =
      meldung.art === "fehler" ? ANZEIGEDAUER_FEHLER_MS : ANZEIGEDAUER_INFO_MS;
    const timer = setTimeout(() => {
      setMeldung((aktuell) => (aktuell?.id === meldung.id ? null : aktuell));
    }, dauer);
    return () => clearTimeout(timer);
  }, [meldung]);

  return (
    <MeldungContext.Provider value={{ zeigeFehler, zeigeInfo, beobachte }}>
      {children}
      {meldung && (
        <div
          role={meldung.art === "fehler" ? "alert" : "status"}
          className={`fixed bottom-5 left-4 right-24 z-30 mx-auto flex max-w-md items-center gap-3 rounded-lg px-4 py-3 text-sm shadow-lg ${
            meldung.art === "fehler"
              ? "bg-red-700 text-white"
              : "bg-stone-900 text-stone-50"
          }`}
        >
          <span className="flex-1">{meldung.text}</span>
          {meldung.art === "info" && meldung.rueckgaengig && (
            <button
              type="button"
              onClick={() => {
                meldung.rueckgaengig?.();
                setMeldung(null);
              }}
              className="min-h-10 shrink-0 rounded-md px-3 font-semibold text-amber-300 hover:bg-white/10"
            >
              Rückgängig
            </button>
          )}
          <button
            type="button"
            onClick={() => setMeldung(null)}
            aria-label="Meldung schließen"
            className="min-h-10 min-w-8 shrink-0 rounded-md text-lg opacity-70 hover:opacity-100"
          >
            ×
          </button>
        </div>
      )}
    </MeldungContext.Provider>
  );
}

export function useMeldung(): MeldungContextValue {
  const context = useContext(MeldungContext);
  if (context === undefined) {
    throw new Error("useMeldung muss innerhalb von MeldungProvider verwendet werden");
  }
  return context;
}
