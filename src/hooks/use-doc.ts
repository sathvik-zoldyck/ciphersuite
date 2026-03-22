"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  onSnapshot,
  type DocumentReference,
  type DocumentData,
  type FirestoreError,
  type DocumentSnapshot,
} from "firebase/firestore";
import { emitPermissionError } from "@/firebase/error-emitter";
import { fromFirebaseError, isPermissionError, type AppError } from "@/firebase/errors";
import type { WithId } from "./use-collection";

// ─── Types ────────────────────────────────────────────────────────────────────

export type FirestoreDocRef =
  | DocumentReference<any, any>
  | null
  | undefined;

export interface UseDocResult<T> {
  /** The document data with its ID, or `null` while loading or not found. */
  data:       WithId<T> | null;
  /** True on the first load before any snapshot has arrived. */
  isLoading:  boolean;
  /** Typed AppError if the subscription failed; otherwise null. */
  error:      AppError | null;
  /**
   * True when loading is complete, no error occurred, and the document
   * does not exist in Firestore. Distinguishes "missing" from "loading".
   */
  notFound:   boolean;
  /** Manually re-trigger the subscription (useful after a recoverable error). */
  refetch:    () => void;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Subscribe to a single Firestore document in real-time.
 *
 * Features:
 * - SSR-safe: initialises in loading state, resolves client-side
 * - `notFound` flag distinguishes deleted/missing docs from loading
 * - `refetch` to manually re-attach after a recoverable error
 * - Mount-guard prevents setState after component unmount
 * - Emits permission errors to the global `errorEmitter` bus
 * - Full TypeScript inference — pass a typed DocumentReference<T>
 *   and `data` is `WithId<T>`
 *
 * **IMPORTANT**: The `docRef` argument must be a stable reference.
 * Wrap construction in `useMemo` at the call site.
 *
 * @example
 * const projectRef = useMemo(
 *   () => doc(db, "projects", projectId),
 *   [projectId]
 * );
 * const { data: project, isLoading, notFound } = useDoc<Project>(projectRef);
 *
 * if (notFound) return <ProjectNotFound />;
 */
export function useDoc<T = DocumentData>(
  docRef: FirestoreDocRef,
): UseDocResult<T> {
  const [data,      setData]      = useState<WithId<T> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error,     setError]     = useState<AppError | null>(null);
  const [notFound,  setNotFound]  = useState(false);

  const [retryCount, setRetryCount] = useState(0);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const refetch = useCallback(() => setRetryCount((c) => c + 1), []);

  useEffect(() => {
    // Reset all state on query change to prevent stale-data flash
    setData(null);
    setError(null);
    setNotFound(false);
    setIsLoading(true);

    if (!docRef) {
      setIsLoading(false);
      return;
    }

    const unsubscribe = onSnapshot(
      docRef as DocumentReference<DocumentData>,

      (snapshot: DocumentSnapshot<DocumentData>) => {
        if (!mountedRef.current) return;

        if (snapshot.exists()) {
          setData({ ...(snapshot.data() as T), id: snapshot.id });
          setNotFound(false);
        } else {
          setData(null);
          setNotFound(true);
        }

        setError(null);
        setIsLoading(false);
      },

      (firestoreError: FirestoreError) => {
        if (!mountedRef.current) return;

        const appError = fromFirebaseError(firestoreError, {
          path:      (docRef as DocumentReference<DocumentData>).path,
          operation: "get",
          code:      firestoreError.code,
        });

        if (isPermissionError(appError)) {
          emitPermissionError(appError);
        }

        setError(appError);
        setData(null);
        setNotFound(false);
        setIsLoading(false);
      }
    );

    return unsubscribe;
    // retryCount is a deliberate re-subscription trigger, not a missing dep
  }, [docRef, retryCount]); // eslint-disable-line react-hooks/exhaustive-deps

  return { data, isLoading, error, notFound, refetch };
}
