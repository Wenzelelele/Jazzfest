import { getApps, initializeApp, type FirebaseOptions } from "firebase/app";
import {
  browserLocalPersistence,
  getAuth,
  initializeAuth,
  type Auth,
} from "firebase/auth";
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from "firebase/firestore";

const firebaseConfig: FirebaseOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = getApps().length > 0 ? getApps()[0]! : initializeApp(firebaseConfig);

// initializeAuth (statt getAuth) erlaubt uns, explizit browserLocalPersistence
// zu setzen: der Login-Status muss auch ohne Netzverbindung erhalten bleiben.
let auth: Auth;
try {
  auth = initializeAuth(app, {
    persistence: browserLocalPersistence,
  });
} catch {
  // initializeAuth wirft, wenn Auth für diese App bereits initialisiert wurde
  // (z. B. durch Hot-Reload in der Entwicklung) - dann reicht getAuth().
  auth = getAuth(app);
}

// persistentLocalCache + persistentMultipleTabManager: Firestore funktioniert
// vollständig offline und mehrere geöffnete Tabs teilen sich denselben Cache.
let db: Firestore;
try {
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager(),
    }),
  });
} catch {
  // initializeFirestore wirft, wenn Firestore für diese App bereits
  // initialisiert wurde (z. B. durch Hot-Reload in der Entwicklung).
  db = getFirestore(app);
}

export { app, auth, db };
