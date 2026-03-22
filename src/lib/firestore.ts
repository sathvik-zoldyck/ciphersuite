/**
 * @fileOverview Thin Firestore write helpers with typed error handling.
 * CipherSuite — Alcyone Secure.
 *
 * Wraps addDoc / updateDoc / setDoc / deleteDoc so every write failure
 * is automatically converted to a typed AppError and permission errors
 * are broadcast on the global errorEmitter bus.
 *
 * These are low-level helpers. Prefer the service layer
 * (projects-service.ts, etc.) over calling these directly.
 */

import {
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  type CollectionReference,
  type DocumentReference,
  type DocumentData,
  type SetOptions,
  type WithFieldValue,
  type UpdateData,
} from "firebase/firestore";
import { emitPermissionError } from "@/firebase/error-emitter";
import {
  fromFirebaseError,
  isPermissionError,
  type FirestoreErrorContext,
} from "@/firebase/errors";

// ─── Internal error handler ───────────────────────────────────────────────────

function handleError(err: unknown, context: FirestoreErrorContext & { requestData?: Record<string, unknown> }): never {
  const appError = fromFirebaseError(err, context);
  if (isPermissionError(appError)) {
    emitPermissionError(appError);
  }
  throw appError;
}

// ─── Write helpers ────────────────────────────────────────────────────────────

/**
 * Creates or overwrites a document at the given ref.
 * Pass `{ merge: true }` in options to merge instead of overwrite.
 */
export async function setDocument<T extends DocumentData>(
  docRef:  DocumentReference<T>,
  data:    WithFieldValue<T>,
  options: SetOptions = {}
): Promise<void> {
  try {
    await setDoc(docRef, data, options);
  } catch (err) {
    handleError(err, {
      path:        docRef.path,
      operation:   "create",   // set can be a create OR update depending on merge
      requestData: data as Record<string, unknown>,
    });
  }
}

/**
 * Adds a new document to a collection with a Firestore-generated ID.
 * Returns the new DocumentReference.
 */
export async function addDocument<T extends DocumentData>(
  colRef: CollectionReference<T>,
  data:   WithFieldValue<T>
): Promise<DocumentReference<T>> {
  try {
    return await addDoc(colRef, data);
  } catch (err) {
    handleError(err, {
      path:        colRef.path,
      operation:   "create",
      requestData: data as Record<string, unknown>,
    });
  }
}

/**
 * Merges partial updates into an existing document.
 * Does NOT overwrite fields that are not included in `data`.
 */
export async function updateDocument<T extends DocumentData>(
  docRef: DocumentReference<T>,
  data:   UpdateData<T>
): Promise<void> {
  try {
    await updateDoc(docRef, data);
  } catch (err) {
    handleError(err, {
      path:        docRef.path,
      operation:   "update",
      requestData: data as Record<string, unknown>,
    });
  }
}

/**
 * Permanently deletes a single document.
 * Sub-collections are NOT deleted — use the service layer for cascade deletes.
 */
export async function deleteDocument(docRef: DocumentReference): Promise<void> {
  try {
    await deleteDoc(docRef);
  } catch (err) {
    handleError(err, {
      path:      docRef.path,
      operation: "delete",
    });
  }
}
