"use client";

import { useMemo } from "react";
import { doc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useDoc } from "@/hooks/use-doc";
import { useAuth } from "@/context/AuthContext";
import type { Project, FirestoreDate } from "@/lib/types";

// ─── Date normalisation ───────────────────────────────────────────────────────

/** Converts any timestamp-like value to a `Date`. Returns `null` if unparseable. */
function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Timestamp)  return value.toDate();
  if (value instanceof Date)       return isNaN(value.getTime()) ? null : value;
  const parsed = new Date(value as string | number);
  return isNaN(parsed.getTime()) ? null : parsed;
}

/** Converts a FirestoreDate field to a plain Date, falling back to `new Date(0)` if unparseable. */
function toDateSafe(v: FirestoreDate | undefined): Date {
  return toDate(v) ?? new Date(0);
}

/**
 * Normalises all FirestoreDate fields on a raw Project document
 * to plain JS `Date` objects for consistent downstream usage.
 */
function normaliseProject(raw: Project): Project {
  return {
    ...raw,
    createdAt: toDateSafe(raw.createdAt),
    updatedAt: toDateSafe(raw.updatedAt),
    // startDate and endDate are optional — preserve undefined if not set
    startDate: raw.startDate !== undefined ? toDateSafe(raw.startDate) : undefined,
    endDate:   raw.endDate   !== undefined ? toDateSafe(raw.endDate)   : undefined,
  };
}

// ─── Return type ──────────────────────────────────────────────────────────────

export interface UseProjectResult {
  /** The normalised project, or `null` while loading / not found. */
  project:   Project | null;
  /** True while the auth check or Firestore request is in-flight. */
  isLoading: boolean;
  /** User-facing error message if Firestore threw; otherwise `null`. */
  error:     string | null;
  /**
   * True when loading is complete, no error occurred, and the document
   * does not exist. Covers both Firestore missing docs and invalid guest IDs.
   * Use this to render a "Project not found" page rather than a blank screen.
   */
  notFound:  boolean;
  /**
   * Re-attach the Firestore subscription (e.g. after a permission error
   * that was subsequently resolved). No-op in guest mode.
   */
  refetch:   () => void;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useProject(projectId: string): UseProjectResult {
  const {
    isGuest,
    getLocalProject,
    localData,
    loading: authLoading,
  } = useAuth();

  // Construct the Firestore ref only when:
  //   1. We have a projectId
  //   2. We're not in guest mode
  //   3. Auth state has resolved (avoids a permission-denied before uid is known)
  //   4. The ID doesn't look like a guest-generated ID (belt-and-suspenders)
  const projectRef = useMemo(
    () =>
      projectId && !isGuest && !authLoading && !projectId.startsWith("guest_")
        ? doc(db, "projects", projectId)
        : null,
    [projectId, isGuest, authLoading]
  );

  const {
    data:      firestoreProject,
    isLoading: firestoreLoading,
    error:     firestoreError,
    notFound:  docNotFound,
    refetch,
  } = useDoc<Project>(projectRef);

  // Re-derive whenever the guest store mutates (add / edit / delete project).
  // Including localData.projects in deps ensures reactivity without
  // subscribing to the entire localData object.
  const localProject = useMemo(
    () => (isGuest && projectId ? (getLocalProject(projectId) ?? null) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isGuest, projectId, getLocalProject, localData.projects]
  );

  // Normalise timestamps to plain Dates
  const project = useMemo<Project | null>(() => {
    const raw = isGuest ? localProject : firestoreProject;
    return raw ? normaliseProject(raw) : null;
  }, [isGuest, localProject, firestoreProject]);

  // Guest notFound: auth is ready, we're in guest mode, ID is truthy,
  // but no matching project exists in local storage.
  const guestNotFound = isGuest && !authLoading && !!projectId && localProject === null;

  return {
    project,
    isLoading: authLoading || (!isGuest && firestoreLoading),
    error:     firestoreError?.displayMessage ?? null,
    notFound:  isGuest ? guestNotFound : docNotFound,
    refetch,
  };
}
