"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { zuLoginEmail } from "@/lib/benutzername";

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

export default function LoginPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      router.replace("/");
    }
  }, [loading, user, router]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signInWithEmailAndPassword(auth, zuLoginEmail(email), password);
      router.replace("/");
    } catch (err) {
      setError(mapAuthError(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || user) {
    return null;
  }

  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-5 rounded-lg border border-stone-200 bg-white p-7 shadow-sm"
      >
        <div className="space-y-1 text-center">
          <h1 className="font-display text-2xl font-semibold tracking-tight text-stone-900">
            Jazzfest Gästeliste
          </h1>
          <p className="text-sm text-stone-500">Team-Login (Kasse / Admin)</p>
        </div>

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
            placeholder="z. B. kasse"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="min-h-12 w-full rounded-md border border-stone-300 bg-stone-50 px-3 text-stone-900 outline-none focus:border-stone-500"
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
            className="min-h-12 w-full rounded-md border border-stone-300 bg-stone-50 px-3 text-stone-900 outline-none focus:border-stone-500"
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

        <p className="text-center text-xs text-stone-500">
          Gäste anfragen geht ohne Login:{" "}
          <Link href="/gaesteliste" className="underline">
            zur Anfrage-Seite
          </Link>
        </p>
      </form>
    </div>
  );
}
