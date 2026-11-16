/**
 * @fileOverview Firebase client SDK — CipherSuite / Alcyone Secure.
 *
 * Config is read from environment variables only.
 * Never commit real values — use .env.local locally.
 * Without these variables the app runs in guest-only mode.
 *
 * Variables:
 *   NEXT_PUBLIC_FIREBASE_API_KEY
 *   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
 *   NEXT_PUBLIC_FIREBASE_PROJECT_ID
 *   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
 *   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
 *   NEXT_PUBLIC_FIREBASE_APP_ID
 */

import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// ─── Config ───────────────────────────────────────────────────────────────────
//
// Each NEXT_PUBLIC_ variable is referenced literally so Next.js can inline it
// into the browser bundle (dynamic process.env[key] lookups are not inlined).

const envConfig = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId:     process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

/**
 * True when a Firebase project is configured in .env.local. Without it the
 * app still runs: guest mode works fully in the browser, and sign-in is
 * hidden until a project is added.
 */
export const isFirebaseConfigured = Boolean(
  envConfig.apiKey && envConfig.authDomain && envConfig.projectId &&
  envConfig.storageBucket && envConfig.messagingSenderId && envConfig.appId,
);

// Inert placeholder used only when no project is configured, so the SDK can
// initialise. Nothing is sent anywhere until someone signs in, which the UI
// does not offer in this state.
const placeholderConfig = {
  apiKey:            "guest-mode-no-firebase-project",
  authDomain:        "localhost",
  projectId:         "ciphersuite-guest",
  storageBucket:     "ciphersuite-guest.appspot.com",
  messagingSenderId: "000000000000",
  appId:             "1:000000000000:web:0000000000000000",
};

if (!isFirebaseConfigured && typeof window === "undefined") {
  console.info(
    "[CipherSuite] No Firebase project configured: running in guest-only mode. " +
    "Copy .env.example to .env.local and add your Firebase web config to enable accounts.",
  );
}

const firebaseConfig = isFirebaseConfigured ? envConfig : placeholderConfig;

// ─── App singleton ────────────────────────────────────────────────────────────

/**
 * Single Firebase app instance shared across the entire application.
 * The getApps() guard prevents re-initialisation during Next.js HMR.
 */
const app: FirebaseApp = getApps().length
  ? getApp()
  : initializeApp(firebaseConfig);

// ─── Service exports ──────────────────────────────────────────────────────────

export const auth    = getAuth(app);
export const db      = getFirestore(app);
export const storage = getStorage(app);

// ─── Google Auth provider ─────────────────────────────────────────────────────

export const googleProvider = new GoogleAuthProvider();

// Email + profile scopes ensure displayName and photoURL are populated
// immediately after sign-in without a separate profile API call.
googleProvider.addScope("email");
googleProvider.addScope("profile");

// Force the account chooser on every sign-in so security professionals
// can switch between work/personal Google accounts without signing out first.
googleProvider.setCustomParameters({ prompt: "select_account" });
