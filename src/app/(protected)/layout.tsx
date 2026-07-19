"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-zinc-400">Lädt…</p>
      </div>
    );
  }

  if (!user) {
    // Weiterleitung zu /login läuft bereits - hier nichts rendern, damit
    // geschützte Inhalte nicht kurz aufblitzen.
    return null;
  }

  return <>{children}</>;
}
