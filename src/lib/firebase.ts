/**
 * @fileOverview Firebase client SDK — CipherSuite / Alcyone Secure.
 *
 * Config is read from environment variables only.
 * Never commit real values — use .env.local locally.
 *
 * Required vars:
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

// ─── Environment validation ───────────────────────────────────────────────────

const REQUIRED_ENV_VARS = [
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
] as const;

type RequiredEnvVar = typeof REQUIRED_ENV_VARS[number];

function validateEnv(): void {
  const missing = REQUIRED_ENV_VARS.filter(
    (key): key is RequiredEnvVar => !process.env[key]
  );
  if (missing.length > 0) {
    throw new Error(
      `[CipherSuite] Missing Firebase environment variables:\n` +
      missing.map((k) => `  • ${k}`).join("\n") +
      `\n\nCopy .env.example to .env.local and fill in your Firebase project credentials.`
    );
  }
}

// Server-side: validate at startup so misconfigured deployments fail loudly.
// Client-side: Next.js inlines NEXT_PUBLIC_ vars at build time — a missing
// var causes a build failure before this code ever runs in the browser.
if (typeof window === "undefined" && process.env.NODE_ENV !== "test") {
  validateEnv();
}

// ─── Config ───────────────────────────────────────────────────────────────────

// After validation, all values are guaranteed to be strings — safe to assert.
const firebaseConfig = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
  measurementId:     process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

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
