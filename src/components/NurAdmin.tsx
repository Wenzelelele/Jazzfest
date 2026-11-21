"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";

// Blendet Admin-Seiten für normale Accounts aus. Die eigentliche Sperre
// liegt in firestore.rules - das hier ist nur die passende Oberfläche.
export function NurAdmin({ children }: { children: ReactNode }) {
  const { istAdmin } = useAuth();
  if (istAdmin) return <>{children}</>;
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <p className="text-stone-900">Dieser Bereich ist nur für Admins.</p>
      <Link
        href="/"
        className="flex min-h-12 items-center rounded-md bg-stone-900 px-5 font-medium text-stone-50"
      >
        Zur Gästeliste
      </Link>
    </div>
  );
}
