"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { nutzerRegistrieren, type Rolle } from "@/lib/rollen";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  rolle: Rolle;
  // false, solange das Admin-Dokument noch nicht gelesen ist - damit
  // Admin-Seiten nicht kurz "nicht verfügbar" anzeigen.
  rolleGeladen: boolean;
  istAdmin: boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

interface RollenStand {
  uid: string;
  admin: boolean;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [stand, setStand] = useState<RollenStand | null>(null);

  useEffect(() => {
    // onAuthStateChanged liefert beim Start sofort den aus dem lokalen
    // Speicher wiederhergestellten Nutzer, auch ohne Netzverbindung - dank
    // browserLocalPersistence in lib/firebase.ts bleibt der Login-Status
    // offline erhalten.
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const uid = user?.uid;
  const email = user?.email ?? null;

  useEffect(() => {
    if (!uid) return;
    nutzerRegistrieren(uid, email).catch(console.error);

    // onSnapshot statt getDoc: liegt so auch offline aus dem Cache vor und
    // ändert sich live, wenn ein Admin die Rolle auf der Benutzer-Seite
    // setzt.
    return onSnapshot(
      doc(db, "admins", uid),
      (snapshot) => setStand({ uid, admin: snapshot.exists() }),
      () => setStand({ uid, admin: false }),
    );
  }, [uid, email]);

  const aktuell = stand && stand.uid === uid ? stand : null;
  const istAdmin = aktuell?.admin === true;
  const rolle: Rolle = istAdmin ? "admin" : "kasse";
  const rolleGeladen = aktuell !== null;

  return (
    <AuthContext.Provider
      value={{ user, loading, rolle, rolleGeladen, istAdmin }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth muss innerhalb von AuthProvider verwendet werden");
  }
  return context;
}
