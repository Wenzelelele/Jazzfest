"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { zuLoginEmail } from "@/lib/benutzername";
import {
  EinladungFormular,
  KassenCodeFormular,
  eingabeKlasse,
} from "@/components/Beitreten";

function mapAuthError(err: unknown): string {
  const code = (err as { code?: string } | null)?.code;
  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Benutzername oder Passwort ist falsch.";
    case "auth/invalid-email":
      return "Dieser Benutzername ist ungültig (bitte ohne Leer- und Sonderzeichen).";
    case "auth/too-many-requests":
      return "Zu viele Versuche. Bitte kurz warten und erneut probieren.";
    case "auth/network-request-failed":
      return "Keine Verbindung zum Server. War dieses Gerät hier schon einmal angemeldet, bleibt der Zugang trotzdem erhalten.";
    default:
      return "Anmeldung fehlgeschlagen. Bitte erneut versuchen.";
  }
}

type Modus = "anmelden" | "kasse" | "einladung";

const MODI: { wert: Modus; label: string }[] = [
  { wert: "anmelden", label: "Anmelden" },
  { wert: "kasse", label: "Kassen-Code" },
  { wert: "einladung", label: "Einladung" },
];

export default function LoginPage() {
  const { user, loading, rolle, rolleGeladen } = useAuth();
  const router = useRouter();
  const [modus, setModus] = useState<Modus>("anmelden");
  const [einladungCode, setEinladungCode] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Einladungslink: /login?einladung=CODE
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("einladung");
    if (code) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEinladungCode(code);
      setModus("einladung");
    }
  }, []);

  // Weiter zur App, sobald klar ist, wohin. Ein anonymes Gerät ohne Zugang
  // (Kassen-Code wird gerade geprüft) bleibt hier.
  const weiter =
    !loading &&
    user !== null &&
    rolleGeladen &&
    (rolle !== null || !user.isAnonymous);
  useEffect(() => {
    if (weiter) router.replace("/");
  }, [weiter, router]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signInWithEmailAndPassword(auth, zuLoginEmail(email), password);
    } catch (err) {
      setError(mapAuthError(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || weiter) {
    return null;
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
      <div className="w-full max-w-sm space-y-5 rounded-lg border border-stone-200 bg-white p-7 shadow-sm">
        <div className="space-y-1 text-center">
          <h1 className="font-display text-2xl font-semibold tracking-tight text-stone-900">
            Jazzfest Gästeliste
          </h1>
          <p className="text-sm text-stone-500">Zugang für Veranstalter-Teams</p>
        </div>

        <div className="flex gap-1 rounded-md bg-stone-100 p-1" role="group">
          {MODI.map((m) => (
            <button
              key={m.wert}
              type="button"
              onClick={() => setModus(m.wert)}
              aria-pressed={modus === m.wert}
              className={`min-h-10 flex-1 rounded px-2 text-sm ${
                modus === m.wert
                  ? "bg-white font-medium text-stone-900 shadow-sm"
                  : "text-stone-600"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {modus === "anmelden" && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label htmlFor="email" className="text-sm text-stone-600">
                Benutzername
              </label>
              {/* Benutzername ("kasse") oder vollständige E-Mail - siehe
                  lib/benutzername.ts */}
              <input
                id="email"
                type="text"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className={eingabeKlasse}
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="password" className="text-sm text-stone-600">
                Passwort
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className={eingabeKlasse}
              />
            </div>
            {error && (
              <p role="alert" className="text-sm text-red-700">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="min-h-12 w-full rounded-md bg-stone-900 px-5 font-medium text-stone-50 hover:bg-stone-800 disabled:opacity-60"
            >
              {submitting ? "Anmelden…" : "Anmelden"}
            </button>
          </form>
        )}

        {modus === "kasse" && <KassenCodeFormular />}

        {modus === "einladung" && (
          <div className="space-y-3">
            <p className="text-xs text-stone-500">
              Mit einem Einladungscode legst du dein Admin-Konto für einen
              Veranstalter an.
            </p>
            <EinladungFormular key={einladungCode} vorgabeCode={einladungCode} />
          </div>
        )}
      </div>

      <p className="max-w-sm text-center text-xs text-stone-500">
        Gäste anfragen geht ohne Login - über den Link, den du vom
        Veranstalter bekommen hast.
      </p>
    </div>
  );
}
