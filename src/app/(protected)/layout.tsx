"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { EventProvider } from "@/contexts/EventContext";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Ohne Login landet man auf der öffentlichen Anfrage-Seite - so reicht
    // es, Bands & Co. einfach den Link zur App zu schicken. Das Team kommt
    // von dort über "Team-Login" zur Anmeldung.
    if (!loading && !user) {
      router.replace("/gaesteliste");
    }
  }, [loading, user, router]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-stone-500">Lädt…</p>
      </div>
    );
  }

  if (!user) {
    // Weiterleitung zu /gaesteliste läuft bereits - hier nichts rendern, damit
    // geschützte Inhalte nicht kurz aufblitzen.
    return null;
  }

  return <EventProvider>{children}</EventProvider>;
}
