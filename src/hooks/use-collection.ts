"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  onSnapshot,
  type Query,
  type DocumentData,
  type FirestoreError,
  type QuerySnapshot,
  type CollectionReference,
} from "firebase/firestore";
import { emitPermissionError } from "@/firebase/error-emitter";
import { fromFirebaseError, isPermissionError, type AppError } from "@/firebase/errors";

// ─── Types ────────────────────────────────────────────────────────────────────

/** Document data T enriched with its Firestore document ID. */
export type WithId<T> = T & { id: string };

export type FirestoreQueryRef =
  | CollectionReference<any, any>
  | Query<any, any>
  | null
  | undefined;

export interface UseCollectionResult<T> {
  /** The subscribed documents, or `null` while loading. */
  data:       WithId<T>[] | null;
  /** True on the first load before any snapshot has arrived. */
  isLoading:  boolean;
  /** Typed AppError if the subscription failed; otherwise null. */
  error:      AppError | null;
  /** True once loaded with zero documents (distinguishes "empty" from "loading"). */
  isEmpty:    boolean;
  /** Total document count in the current snapshot. */
  count:      number;
  /** Manually re-trigger the subscription (useful after a recoverable error). */
  refetch:    () => void;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Subscribe to a Firestore collection or query in real-time.
 *
 * Features:
 * - SSR-safe: returns loading state on the server
 * - Stable state reset on query change (prevents stale data flash)
 * - `isEmpty` flag distinguishes "no docs" from "still loading"
 * - `count` for quick badge/stat rendering without `.length` checks
 * - `refetch` to manually re-attach after a recoverable error
 * - Emits permission errors to the global `errorEmitter` bus
 * - Full TypeScript inference — pass a typed CollectionReference<T>
 *   and `data` is `WithId<T>[]`
 *
 * **IMPORTANT**: The `query` argument must be a stable reference.
 * Wrap it in `useMemo` at the call site to avoid infinite re-subscriptions.
 *
 * @example
 * const findingsRef = useMemo(
 *   () => query(
 *     collection(db, "projects", projectId, "findings"),
 *     orderBy("createdAt", "desc")
 *   ),
 *   [projectId]
 * );
 * const { data: findings, isLoading, isEmpty } = useCollection<Finding>(findingsRef);
 */
export function useCollection<T = DocumentData>(
  queryRef: FirestoreQueryRef,
): UseCollectionResult<T> {
  const [data,      setData]      = useState<WithId<T>[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error,     setError]     = useState<AppError | null>(null);

  // Incrementing this value forces a re-subscription — used by refetch()
  const [retryCount, setRetryCount] = useState(0);

  // Track mount state to avoid setState calls after unmount
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const refetch = useCallback(() => setRetryCount((c) => c + 1), []);

  useEffect(() => {
    // Reset to loading state whenever the query or refetch token changes
    setData(null);
    setError(null);
    setIsLoading(true);

    if (!queryRef) {
      setIsLoading(false);
      return;
    }

    const unsubscribe = onSnapshot(
      // Cast is safe: CollectionReference<T> and Query<T> both extend Query<DocumentData>
      queryRef as Query<DocumentData>,

      (snapshot: QuerySnapshot<DocumentData>) => {
        if (!mountedRef.current) return;

        const docs = snapshot.docs.map((doc) => ({
          ...(doc.data() as T),
          id: doc.id,
        })) as WithId<T>[];

        setData(docs);
        setError(null);
        setIsLoading(false);
      },

      (firestoreError: FirestoreError) => {
        if (!mountedRef.current) return;

        // Infer the collection path for error context — best-effort,
        // since Query doesn't expose .path but CollectionReference does.
        const path =
          (queryRef as CollectionReference<DocumentData>).path ??
          "(query — path unavailable)";

        const appError = fromFirebaseError(firestoreError, {
          path,
          operation: "list",
          code:      firestoreError.code,
        });

        if (isPermissionError(appError)) {
          emitPermissionError(appError);
        }

        setError(appError);
        setData(null);
        setIsLoading(false);
      }
    );

    return unsubscribe;
    // retryCount is intentionally included so refetch() re-runs this effect
  }, [queryRef, retryCount]); // eslint-disable-line react-hooks/exhaustive-deps

  const isEmpty = !isLoading && !error && data !== null && data.length === 0;
  const count   = data?.length ?? 0;

  return { data, isLoading, error, isEmpty, count, refetch };
}
