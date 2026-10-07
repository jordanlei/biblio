import {
  GoogleAuthProvider,
  deleteUser,
  onAuthStateChanged,
  reauthenticateWithPopup,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
  type UserCredential
} from "firebase/auth";
import { clearIndexedDbPersistence, getDoc, setDoc, terminate } from "firebase/firestore";
import { computed, ref, watch } from "vue";
import { auth, db, makeGoogleProvider } from "../firebase";
import { userDoc } from "./paths";

export interface UserProfile {
  email: string;
  displayName: string | null;
  photoURL: string | null;
  driveConnected: boolean;
  driveRootFolderId: string | null;
  driveRootFolderName?: string | null;
  onboardingCompleted: boolean;
  /** Display preferences (see services/appearance.ts). */
  appearance?: Partial<import("./appearance").Appearance>;
  createdAt: string;
  updatedAt: string;
}

const user = ref<User | null>(null);
const profile = ref<UserProfile | null>(null);
const ready = ref(false);
let markReady: () => void;
/** Resolves once the first auth state (and that user's profile) is known. The router awaits it. */
export const sessionReady = new Promise<void>((resolve) => (markReady = resolve));

const now = () => new Date().toISOString();

onAuthStateChanged(auth, async (nextUser) => {
  // Load the profile before publishing the user so views never see a signed-in user without a profile.
  try {
    profile.value = nextUser ? await ensureUserProfile(nextUser) : null;
  } catch (error) {
    console.error("Could not load profile", error);
    profile.value = null;
  }
  user.value = nextUser;
  if (!nextUser) clearGoogleAccessToken();
  ready.value = true;
  markReady();
});

async function ensureUserProfile(next: User): Promise<UserProfile> {
  const ref = userDoc(next.uid);
  const snapshot = await getDoc(ref);
  const current = snapshot.exists() ? (snapshot.data() as Partial<UserProfile>) : {};
  const merged: UserProfile = {
    email: next.email ?? current.email ?? "",
    displayName: next.displayName ?? current.displayName ?? null,
    photoURL: next.photoURL ?? current.photoURL ?? null,
    driveConnected: current.driveConnected ?? false,
    driveRootFolderId: current.driveRootFolderId ?? null,
    driveRootFolderName: current.driveRootFolderName ?? null,
    onboardingCompleted: current.onboardingCompleted ?? false,
    ...(current.appearance ? { appearance: current.appearance } : {}),
    createdAt: current.createdAt ?? now(),
    updatedAt: now()
  };
  await setDoc(ref, merged, { merge: true });
  return merged;
}

export async function updateProfile(patch: Partial<UserProfile>) {
  const current = user.value;
  if (!current) return;
  const next = { ...patch, updatedAt: now() };
  await setDoc(userDoc(current.uid), next, { merge: true });
  if (profile.value) profile.value = { ...profile.value, ...next };
}

export function useSession() {
  return {
    user: computed(() => user.value),
    uid: computed(() => user.value?.uid ?? null),
    profile: computed(() => profile.value),
    ready: computed(() => ready.value),
    signedIn: computed(() => Boolean(user.value))
  };
}

export function requireUid(): string {
  if (!user.value) throw new Error("You are signed out.");
  return user.value.uid;
}

/** Sign in, and resolve only once the session (user + profile) is published, so routing can proceed. */
export async function signIn() {
  const result = await signInWithPopup(auth, makeGoogleProvider());
  rememberToken(result);
  await sessionPublished(result.user.uid);
  return result.user;
}

/** Resolves when onAuthStateChanged has finished publishing this user (profile included). */
export function sessionPublished(uid: string) {
  return new Promise<void>((resolve) => {
    const stop = watch(
      user,
      (current) => {
        if (current?.uid !== uid) return;
        queueMicrotask(() => stop());
        resolve();
      },
      { immediate: true }
    );
  });
}

export async function signOut() {
  clearGoogleAccessToken();
  await firebaseSignOut(auth);
  await clearLocalCache();
}

/** Remove the on-device copy of the index (privacy on shared computers), then start fresh. */
export async function clearLocalCache() {
  try {
    await terminate(db);
    await clearIndexedDbPersistence(db);
  } catch {
    // Another tab may still hold the cache; it's cleared when that tab signs out.
  }
  window.location.assign("/login");
}

// --- Google OAuth access token (for Drive) ---------------------------------------------------
// Kept in memory and sessionStorage only, never in Firestore. Google access tokens last ~1 hour;
// caching avoids a consent popup on every Drive action.
const TOKEN_KEY = "bibliograph.googleAccessToken";
const TOKEN_TTL_MS = 50 * 60 * 1000;
let memoryToken: { token: string; expiresAt: number } | null = null;

function rememberToken(result: UserCredential) {
  const token = GoogleAuthProvider.credentialFromResult(result)?.accessToken;
  if (token) rememberAccessToken(token);
}

export function rememberAccessToken(token: string) {
  memoryToken = { token, expiresAt: Date.now() + TOKEN_TTL_MS };
  try {
    sessionStorage.setItem(TOKEN_KEY, JSON.stringify(memoryToken));
  } catch {
    // Storage can be unavailable (private mode); the in-memory copy still works for this tab.
  }
}

function cachedToken(): string | null {
  if (!memoryToken) {
    try {
      memoryToken = JSON.parse(sessionStorage.getItem(TOKEN_KEY) ?? "null");
    } catch {
      memoryToken = null;
    }
  }
  return memoryToken && memoryToken.expiresAt > Date.now() ? memoryToken.token : null;
}

export function clearGoogleAccessToken() {
  memoryToken = null;
  try {
    sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignore
  }
}

export function hasGoogleAccessToken() {
  return Boolean(cachedToken());
}

/**
 * Returns a Drive-capable access token, asking Google again (popup) only when the cached one
 * expired. Background work passes `interactive: false` and gets null instead of a popup, because
 * browsers only allow popups in response to a click.
 */
export async function getGoogleAccessToken(options: { interactive: false }): Promise<string | null>;
export async function getGoogleAccessToken(options?: { interactive?: true }): Promise<string>;
export async function getGoogleAccessToken(options: { interactive?: boolean } = {}): Promise<string | null> {
  const cached = cachedToken();
  if (cached) return cached;
  if (options.interactive === false) return null;
  const current = auth.currentUser;
  const result = current ? await reauthenticateWithPopup(current, makeGoogleProvider()) : await signInWithPopup(auth, makeGoogleProvider());
  rememberToken(result);
  const token = cachedToken();
  if (!token) throw new Error("Google did not grant Drive access.");
  return token;
}

export async function deleteCurrentAuthUser() {
  const current = auth.currentUser;
  if (!current) return;
  try {
    await deleteUser(current);
  } catch {
    await reauthenticateWithPopup(current, makeGoogleProvider());
    await deleteUser(current);
  }
}
