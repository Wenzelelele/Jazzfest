"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { EventProvider } from "@/contexts/EventContext";
import { EinladungFormular, KassenCodeFormular } from "@/components/Beitreten";
import { anzeigeName } from "@/lib/benutzername";

function Laedt() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <p className="text-sm text-stone-500">Lädt…</p>
    </div>
  );
}

// Angemeldet, aber keinem Veranstalter zugeordnet (z. B. alter Account,
// oder das Gerät wurde vom Admin entfernt).
function KeinZugang() {
  const { user } = useAuth();
  return (
    <div className="flex flex-1 flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6 rounded-lg border border-stone-200 bg-white p-7 shadow-sm">
        <div className="space-y-1">
          <h1 className="font-display text-xl font-semibold text-stone-900">
            Kein Zugang
          </h1>
          <p className="text-sm text-stone-500">
            {user?.isAnonymous
              ? "Dieses Gerät ist keinem Veranstalter (mehr) zugeordnet."
              : `${anzeigeName(user?.email)} ist keinem Veranstalter zugeordnet.`}{" "}
            Mit einem Code geht es weiter.
          </p>
        </div>
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-stone-800">Als Kasse</h2>
          <KassenCodeFormular />
        </section>
        {!user?.isAnonymous && (
          <section className="space-y-3 border-t border-stone-200 pt-5">
            <h2 className="text-sm font-medium text-stone-800">Als Admin</h2>
            <EinladungFormular mitKonto />
          </section>
        )}
        <button
          type="button"
          onClick={() => signOut(auth)}
          className="text-xs text-stone-500 underline"
        >
          Abmelden
        </button>
      </div>
    </div>
  );
}

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading, rolle, rolleGeladen, istSuperAdmin, veranstalterId } =
    useAuth();
  const router = useRouter();
  const pfad = usePathname();
  const aufVeranstalterSeite = pfad === "/veranstalter";
  const superOhneAuswahl =
    rolleGeladen && istSuperAdmin && !veranstalterId && !aufVeranstalterSeite;

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  // Super-Admin ohne gewählten Veranstalter: erst einen auswählen/anlegen.
  useEffect(() => {
    if (superOhneAuswahl) router.replace("/veranstalter");
  }, [superOhneAuswahl, router]);

  if (loading) return <Laedt />;
  // Weiterleitung zu /login läuft bereits - nichts Geschütztes zeigen.
  if (!user) return null;
  if (!rolleGeladen) return <Laedt />;
  if (rolle === null) return <KeinZugang />;
  if (superOhneAuswahl) return <Laedt />;

  return (
    <EventProvider key={veranstalterId ?? "keiner"}>{children}</EventProvider>
  );
}
