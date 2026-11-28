"use client";

import { useState, type FormEvent } from "react";
import {
  BeitrittFehler,
  einladungEinloesen,
  kassenBeitritt,
  mitEinladungRegistrieren,
} from "@/lib/veranstalter";

export const eingabeKlasse =
  "min-h-12 w-full rounded-md border border-stone-300 bg-stone-50 px-3 text-stone-900 outline-none focus:border-stone-500";
const knopfKlasse =
  "min-h-12 w-full rounded-md bg-stone-900 px-5 font-medium text-stone-50 hover:bg-stone-800 disabled:opacity-60";

export function fehlerText(err: unknown): string {
  if (err instanceof BeitrittFehler) return err.message;
  const code = (err as { code?: string } | null)?.code;
  switch (code) {
    case "auth/email-already-in-use":
      return "Diesen Benutzernamen gibt es schon - bitte einen anderen wählen.";
    case "auth/weak-password":
      return "Das Passwort muss mindestens 6 Zeichen haben.";
    case "auth/invalid-email":
      return "Dieser Benutzername ist ungültig (bitte ohne Sonderzeichen).";
    case "auth/operation-not-allowed":
    case "auth/admin-restricted-operation":
      return "Diese Anmeldeart ist in Firebase nicht freigeschaltet - bitte den Super-Admin fragen.";
    case "auth/network-request-failed":
    case "unavailable":
      return "Keine Verbindung. Zum Beitreten braucht das Gerät einmal Internet.";
    case "permission-denied":
      return "Das hat nicht geklappt - Code ungültig oder schon benutzt?";
    default:
      return "Das hat nicht geklappt. Bitte nochmal versuchen.";
  }
}

export function KassenCodeFormular() {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);

  async function absenden(event: FormEvent) {
    event.preventDefault();
    setFehler(null);
    setLaeuft(true);
    try {
      // Danach erkennt der AuthContext den neuen Zugang von selbst.
      await kassenBeitritt(code, name);
    } catch (err) {
      console.error(err);
      setFehler(fehlerText(err));
    } finally {
      setLaeuft(false);
    }
  }

  return (
    <form onSubmit={absenden} className="space-y-4">
      <div className="space-y-1">
        <label htmlFor="kassen-code" className="text-sm text-stone-600">
          Kassen-Code
        </label>
        <input
          id="kassen-code"
          type="text"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          placeholder="XXXX-XXXX"
          required
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className={`${eingabeKlasse} font-mono tracking-widest uppercase`}
        />
      </div>
      <div className="space-y-1">
        <label htmlFor="geraet-name" className="text-sm text-stone-600">
          Name für dieses Gerät (optional)
        </label>
        <input
          id="geraet-name"
          type="text"
          maxLength={40}
          placeholder="z. B. Einlass links"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={eingabeKlasse}
        />
      </div>
      {fehler && (
        <p role="alert" className="text-sm text-red-700">
          {fehler}
        </p>
      )}
      <button type="submit" disabled={laeuft} className={knopfKlasse}>
        {laeuft ? "Prüfe…" : "Als Kasse starten"}
      </button>
      <p className="text-xs text-stone-500">
        Das Gerät bleibt danach angemeldet, auch offline. Den Code bekommst du
        vom Admin des Veranstalters.
      </p>
    </form>
  );
}

// mitKonto=false: neues Admin-Konto mit Benutzername + Passwort anlegen.
// mitKonto=true: der schon angemeldete Account löst die Einladung ein.
export function EinladungFormular({
  mitKonto = false,
  vorgabeCode = "",
}: {
  mitKonto?: boolean;
  vorgabeCode?: string;
}) {
  const [code, setCode] = useState(vorgabeCode);
  const [benutzername, setBenutzername] = useState("");
  const [passwort, setPasswort] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);

  async function absenden(event: FormEvent) {
    event.preventDefault();
    setFehler(null);
    setLaeuft(true);
    try {
      if (mitKonto) await einladungEinloesen(code);
      else await mitEinladungRegistrieren(code, benutzername, passwort);
    } catch (err) {
      console.error(err);
      setFehler(fehlerText(err));
    } finally {
      setLaeuft(false);
    }
  }

  return (
    <form onSubmit={absenden} className="space-y-4">
      <div className="space-y-1">
        <label htmlFor="einladung-code" className="text-sm text-stone-600">
          Einladungscode
        </label>
        <input
          id="einladung-code"
          type="text"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          placeholder="XXXX-XXXX"
          required
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className={`${eingabeKlasse} font-mono tracking-widest uppercase`}
        />
      </div>
      {!mitKonto && (
        <>
          <div className="space-y-1">
            <label htmlFor="neu-benutzer" className="text-sm text-stone-600">
              Benutzername (frei wählbar)
            </label>
            <input
              id="neu-benutzer"
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              required
              placeholder="z. B. anna-admin"
              value={benutzername}
              onChange={(e) => setBenutzername(e.target.value)}
              className={eingabeKlasse}
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="neu-passwort" className="text-sm text-stone-600">
              Passwort (mind. 6 Zeichen)
            </label>
            <input
              id="neu-passwort"
              type="password"
              autoComplete="new-password"
              required
              minLength={6}
              value={passwort}
              onChange={(e) => setPasswort(e.target.value)}
              className={eingabeKlasse}
            />
          </div>
        </>
      )}
      {fehler && (
        <p role="alert" className="text-sm text-red-700">
          {fehler}
        </p>
      )}
      <button type="submit" disabled={laeuft} className={knopfKlasse}>
        {laeuft
          ? "Einen Moment…"
          : mitKonto
            ? "Einladung annehmen"
            : "Admin-Konto anlegen"}
      </button>
    </form>
  );
}
