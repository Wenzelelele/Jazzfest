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

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  // Admin = Dokument admins/{uid} existiert (siehe firestore.rules). Die
  // Regeln setzen das serverseitig durch, hier steuert es nur die Anzeige.
  istAdmin: boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [adminFuer, setAdminFuer] = useState<string | null>(null);

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
  useEffect(() => {
    if (!uid) return;
    // onSnapshot statt getDoc: der Admin-Status liegt so auch offline aus
    // dem Cache vor und aktualisiert sich live, sobald das Dokument in der
    // Console angelegt wird.
    const unsubscribe = onSnapshot(
      doc(db, "admins", uid),
      (snapshot) => setAdminFuer(snapshot.exists() ? uid : null),
      () => setAdminFuer(null),
    );
    return unsubscribe;
  }, [uid]);

  const istAdmin = uid !== undefined && adminFuer === uid;

  return (
    <AuthContext.Provider value={{ user, loading, istAdmin }}>
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
