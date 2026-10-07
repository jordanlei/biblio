import { initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth, GoogleAuthProvider } from "firebase/auth";
import { connectFirestoreEmulator, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";

// This copy's own Firebase project, from bibliograph.config.json (see vite.config.ts and
// docs/SELF_HOSTING.md). VITE_FIREBASE_* variables override single values; local test mode
// (.env.emulator) uses a demo project that exists only in the emulators.
const deployment = __BIBLIOGRAPH_CONFIG__;
const env = import.meta.env;

export const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY ?? deployment?.firebase.apiKey ?? "",
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN ?? deployment?.firebase.authDomain ?? "",
  projectId: env.VITE_FIREBASE_PROJECT_ID ?? deployment?.firebase.projectId ?? "",
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET ?? deployment?.firebase.storageBucket,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? deployment?.firebase.messagingSenderId ?? "",
  appId: env.VITE_FIREBASE_APP_ID ?? deployment?.firebase.appId ?? ""
};

// Google Picker ("Use an existing folder") needs its own browser key: the Firebase key is
// restricted to Firebase services. `npm run setup` creates one limited to the Picker API and to
// the app's own origins, so it's safe to ship.
export const pickerApiKey: string = env.VITE_GOOGLE_PICKER_API_KEY ?? deployment?.pickerApiKey ?? "";

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
// The local cache persists across reloads, so a returning user's library renders from disk at once.
// It is cleared on sign-out (services/session.ts).
export const db = initializeFirestore(app, {
  ignoreUndefinedProperties: true,
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
});

// Local test mode: Auth + Firestore emulators and the mock Drive server (see scripts/dev-drive-server.mjs).
export const usingEmulators = import.meta.env.VITE_USE_EMULATORS === "true";
if (usingEmulators) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
}

export const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";

export function makeGoogleProvider(): GoogleAuthProvider {
  const provider = new GoogleAuthProvider();
  provider.addScope("email");
  provider.addScope("profile");
  // Full Drive access, not drive.file. With drive.file, Google ties each file to the copy of the
  // app that created it, so a library made by one copy (or by hand, or by an older install) would
  // be invisible and read-only to any other copy. Every copy is its owner's own app, and it only
  // ever touches the library folder the owner chose.
  provider.addScope(DRIVE_SCOPE);
  provider.setCustomParameters({ prompt: "select_account" });
  return provider;
}
