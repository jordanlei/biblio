import { GoogleAuthProvider, signInWithCredential } from "firebase/auth";
import { auth } from "../firebase";
import { rememberAccessToken, sessionPublished } from "./session";

/**
 * Local test mode only (loaded when VITE_USE_EMULATORS=true). Lets automated tests sign in without
 * driving the Auth emulator's popup widget, which is unreliable under test runners. The emulator
 * accepts an unsigned JSON ID token for Google; the mock Drive accepts any bearer token.
 */
export function installEmulatorHooks() {
  Object.assign(window, {
    __bibliographTestSignIn: async (email: string, name = "Test Researcher") => {
      const idToken = JSON.stringify({ sub: `test-${email}`, email, email_verified: true, name });
      const result = await signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
      rememberAccessToken("mock-drive-token");
      await sessionPublished(result.user.uid);
    }
  });
}
