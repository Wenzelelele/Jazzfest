"use client";

import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";

export default function Home() {
  const { user } = useAuth();

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <p className="text-zinc-400">Angemeldet als {user?.email}</p>
      <p className="text-sm text-zinc-500">
        Die Gästeliste kommt in Phase 4.
      </p>
      <button
        type="button"
        onClick={() => signOut(auth)}
        className="min-h-12 rounded-md border border-zinc-700 px-5 text-sm text-zinc-200 hover:bg-zinc-800"
      >
        Abmelden
      </button>
    </div>
  );
}
