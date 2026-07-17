import { getApps, initializeApp } from "firebase/app";
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithEmailAndPassword, signInWithPopup, signOut, type User } from "firebase/auth";

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
};

export const firebaseConfigured = Boolean(config.apiKey && config.projectId && config.appId);
const app = firebaseConfigured ? (getApps()[0] ?? initializeApp(config)) : null;
export const auth = app ? getAuth(app) : null;

if (auth && import.meta.env.VITE_USE_FIREBASE_EMULATORS === "true") {
  connectAuthEmulator(auth, `http://${window.location.hostname}:9099`, { disableWarnings: true });
}

export function observeUser(callback: (user: User | null) => void) {
  if (!auth) return () => undefined;
  return onAuthStateChanged(auth, callback);
}

export async function signInEmail(email: string, password: string) {
  if (!auth) throw new Error("Firebase is not configured yet.");
  return signInWithEmailAndPassword(auth, email, password);
}

export async function signUpEmail(email: string, password: string) {
  if (!auth) throw new Error("Firebase is not configured yet.");
  return createUserWithEmailAndPassword(auth, email, password);
}

export async function signInGoogle() {
  if (!auth) throw new Error("Firebase is not configured yet.");
  return signInWithPopup(auth, new GoogleAuthProvider());
}

export async function logOut() {
  if (auth) await signOut(auth);
}
