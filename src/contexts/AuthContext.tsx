"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { setzeGeraeteName } from "@/lib/gaeste";
import {
  veranstalterRef,
  zugangRef,
  type Rolle,
  type Veranstalter,
  type VeranstalterMitId,
  type Zugang,
} from "@/lib/veranstalter";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  // null = angemeldet, aber (noch) keinem Veranstalter zugeordnet
  rolle: Rolle | null;
  // false, solange Super-Admin-/Zugangs-Dokument noch nicht gelesen sind
  rolleGeladen: boolean;
  istAdmin: boolean;
  istSuperAdmin: boolean;
  zugang: Zugang | null;
  veranstalterId: string | null;
  veranstalter: VeranstalterMitId | null;
  // Nur für Super-Admins: in welchem Veranstalter gearbeitet wird
  waehleVeranstalter: (id: string | null) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const SPEICHER_VERANSTALTER = "jazzfest-veranstalter";

interface Stand {
  uid: string;
  superAdmin?: boolean;
  zugang?: Zugang | null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [stand, setStand] = useState<Stand | null>(null);
  const [gewaehlt, setGewaehlt] = useState<string | null>(null);
  const [veranstalterStand, setVeranstalterStand] = useState<{
    id: string;
    daten: Veranstalter | null;
  } | null>(null);

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setGewaehlt(localStorage.getItem(SPEICHER_VERANSTALTER));
    } catch {
      // ohne Speicher: Auswahl gilt bis zum Neuladen
    }
    // onAuthStateChanged liefert beim Start sofort den aus dem lokalen
    // Speicher wiederhergestellten Nutzer, auch ohne Netzverbindung - dank
    // browserLocalPersistence in lib/firebase.ts bleibt der Login offline
    // erhalten (auch für anonyme Kassen-Geräte).
    return onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });
  }, []);

  const uid = user?.uid;

  useEffect(() => {
    if (!uid) return;
    // onSnapshot statt getDoc: liegt so auch offline aus dem Cache vor und
    // ändert sich live (z. B. wenn ein Admin das Gerät entfernt).
    const setze = (teil: Partial<Stand>) =>
      setStand((alt) => ({ ...(alt?.uid === uid ? alt : {}), uid, ...teil }));
    const ohneAdmin = onSnapshot(
      doc(db, "admins", uid),
      (s) => setze({ superAdmin: s.exists() }),
      () => setze({ superAdmin: false }),
    );
    const ohneZugang = onSnapshot(
      zugangRef(uid),
      (s) => setze({ zugang: s.exists() ? (s.data() as Zugang) : null }),
      () => setze({ zugang: null }),
    );
    return () => {
      ohneAdmin();
      ohneZugang();
    };
  }, [uid]);

  const aktuell = stand && stand.uid === uid ? stand : null;
  const istSuperAdmin = aktuell?.superAdmin === true;
  const zugang = aktuell?.zugang ?? null;
  const rolleGeladen =
    aktuell !== null &&
    aktuell.superAdmin !== undefined &&
    aktuell.zugang !== undefined;
  const veranstalterId = istSuperAdmin
    ? (gewaehlt ?? zugang?.veranstalterId ?? null)
    : (zugang?.veranstalterId ?? null);
  const rolle: Rolle | null =
    istSuperAdmin || zugang?.rolle === "admin"
      ? "admin"
      : zugang
        ? "kasse"
        : null;

  useEffect(() => {
    setzeGeraeteName(zugang?.name ?? null);
  }, [zugang?.name]);

  useEffect(() => {
    if (!veranstalterId) return;
    return onSnapshot(
      veranstalterRef(veranstalterId),
      (s) =>
        setVeranstalterStand({
          id: veranstalterId,
          daten: s.exists() ? (s.data() as Veranstalter) : null,
        }),
      () => setVeranstalterStand({ id: veranstalterId, daten: null }),
    );
  }, [veranstalterId]);

  const veranstalter =
    veranstalterStand &&
    veranstalterStand.id === veranstalterId &&
    veranstalterStand.daten
      ? { id: veranstalterStand.id, ...veranstalterStand.daten }
      : null;

  const waehleVeranstalter = useCallback((id: string | null) => {
    setGewaehlt(id);
    try {
      if (id) localStorage.setItem(SPEICHER_VERANSTALTER, id);
      else localStorage.removeItem(SPEICHER_VERANSTALTER);
    } catch {
      // egal
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        rolle,
        rolleGeladen,
        istAdmin: rolle === "admin",
        istSuperAdmin,
        zugang,
        veranstalterId,
        veranstalter,
        waehleVeranstalter,
      }}
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
