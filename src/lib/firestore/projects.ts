
/**
 * @fileOverview Firestore service layer for Project documents — CipherSuite / Alcyone Secure.
 *
 * All functions operate on the `/projects/{projectId}` collection.
 * No external wrapper functions (addDocument, updateDocument, deleteDocument)
 * — uses the Firebase SDK directly so there are no missing-module errors.
 *
 * Errors are converted to typed AppError subclasses via fromFirebaseError.
 */

import {
  collection,
  doc,
  query,
  where,
  orderBy,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  serverTimestamp,
  type Query,
  type DocumentReference,
  type CollectionReference,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { fromFirebaseError } from "@/firebase/errors";
import type { Project } from "@/lib/types";

// ─── Types ────────────────────────────────────────────────────────────────────

export type CreateProjectData = Omit<
  Project,
  "id" | "createdAt" | "updatedAt" | "riskScore"
>;

export type UpdateProjectData = Partial<
  Omit<Project, "id" | "createdAt" | "updatedAt" | "ownerId" | "riskScore">
>;

// ─── Sub-collections to clean up on project delete ────────────────────────────

const PROJECT_SUB_COLLECTIONS = [
  "findings",
  "evidence",
  "notes",
  "logs",
  "reports",
] as const;

// ─── Ref helpers (exported so hooks can import without re-building paths) ──────

/** `/projects` collection reference. */
export function projectsCol(): CollectionReference {
  return collection(db, "projects");
}

/** DocumentReference for a single project. */
export function projectDocRef(projectId: string): DocumentReference {
  return doc(db, "projects", projectId);
}

/**
 * Real-time query — all projects owned by `userId`, newest first.
 * Use with `useCollection` hook for reactive UI.
 * Requires a composite Firestore index: ownerId ASC + createdAt DESC.
 */
export function getUserProjectsQuery(userId: string): Query {
  return query(
    projectsCol(),
    where("ownerId", "==", userId),
    orderBy("createdAt", "desc")
  );
}

// ─── CREATE ───────────────────────────────────────────────────────────────────

/**
 * Creates a new project document.
 * @returns The generated Firestore document ID.
 * @throws {FirestorePermissionError} if the user lacks write access.
 * @throws {FirestoreOperationError}  for any other Firestore failure.
 */
export async function createProject(data: CreateProjectData): Promise<string> {
  try {
    const ref = await addDoc(projectsCol(), {
      ...data,
      riskScore: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return ref.id;
  } catch (err) {
    throw fromFirebaseError(err, {
      path:        "projects",
      operation:   "create",
      requestData: data as Record<string, unknown>,
    });
  }
}

// ─── READ ─────────────────────────────────────────────────────────────────────

/**
 * One-time fetch of a single project by ID.
 * Prefer `useProject` hook for reactive UI.
 * @throws {FirestoreNotFoundError}   if the document doesn't exist.
 * @throws {FirestorePermissionError} if the user lacks read access.
 */
export async function getProject(projectId: string): Promise<Project> {
  try {
    const snap = await getDoc(projectDocRef(projectId));
    if (!snap.exists()) {
      throw fromFirebaseError(
        { code: "not-found" },
        { path: `projects/${projectId}`, operation: "get" }
      );
    }
    return { id: snap.id, ...snap.data() } as Project;
  } catch (err) {
    throw fromFirebaseError(err, {
      path:      `projects/${projectId}`,
      operation: "get",
    });
  }
}

/**
 * One-time fetch of all projects for a user, newest first.
 * Prefer `getUserProjectsQuery` + `useCollection` for reactive UI.
 * @throws {FirestorePermissionError} if the user lacks read access.
 */
export async function getUserProjects(userId: string): Promise<Project[]> {
  try {
    const snapshot = await getDocs(
      query(
        projectsCol(),
        where("ownerId", "==", userId),
        orderBy("createdAt", "desc")
      )
    );
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Project));
  } catch (err) {
    throw fromFirebaseError(err, {
      path:      "projects",
      operation: "list",
    });
  }
}

// ─── UPDATE ───────────────────────────────────────────────────────────────────

/**
 * Merges partial updates into a project document.
 * Automatically stamps `updatedAt` — do not include it in `data`.
 * @throws {FirestorePermissionError} if the user lacks write access.
 * @throws {FirestoreNotFoundError}   if the project no longer exists.
 */
export async function updateProject(
  projectId: string,
  data:       UpdateProjectData
): Promise<void> {
  try {
    await updateDoc(projectDocRef(projectId), {
      ...data,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    throw fromFirebaseError(err, {
      path:        `projects/${projectId}`,
      operation:   "update",
      requestData: data as Record<string, unknown>,
    });
  }
}

/**
 * Updates only the computed `riskScore` field.
 * Called by `useFindings` after any finding create / update / delete.
 */
export async function updateProjectRiskScore(
  projectId: string,
  riskScore:  number
): Promise<void> {
  try {
    await updateDoc(projectDocRef(projectId), {
      riskScore: Math.min(100, Math.max(0, Math.round(riskScore))),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    throw fromFirebaseError(err, {
      path:      `projects/${projectId}`,
      operation: "update",
    });
  }
}

// ─── DELETE ───────────────────────────────────────────────────────────────────

/**
 * Deletes a project AND all sub-collection documents in a batched write.
 *
 * ⚠️  Firestore does NOT cascade-delete sub-collections automatically.
 *     Without this, orphaned documents accumulate and count against quota.
 *
 * ⚠️  Batch limit is 500 operations. Projects with >490 total sub-docs
 *     across all collections need chunked batches — handled below.
 *
 * Note: Evidence files in Firebase Storage are NOT deleted here.
 *       Call `deleteProjectStorageFiles(projectId)` separately.
 *
 * @throws {FirestorePermissionError} if the user lacks delete access.
 */
export async function deleteProject(projectId: string): Promise<void> {
  try {
    // Collect all sub-collection document refs
    const allRefs: DocumentReference[] = [];

    for (const sub of PROJECT_SUB_COLLECTIONS) {
      const snap = await getDocs(
        collection(db, "projects", projectId, sub)
      );
      snap.docs.forEach((d) => allRefs.push(d.ref));
    }

    // Split into chunks of 499 (leave 1 slot for the project doc itself)
    const CHUNK_SIZE = 499;
    const chunks: DocumentReference[][] = [];
    for (let i = 0; i < allRefs.length; i += CHUNK_SIZE) {
      chunks.push(allRefs.slice(i, i + CHUNK_SIZE));
    }

    // Delete sub-collection chunks first
    for (const chunk of chunks) {
      const batch = writeBatch(db);
      chunk.forEach((ref) => batch.delete(ref));
      await batch.commit();
    }

    // Delete the project document last (separate batch / single delete)
    await deleteDoc(projectDocRef(projectId));

  } catch (err) {
    throw fromFirebaseError(err, {
      path:      `projects/${projectId}`,
      operation: "delete",
    });
  }
}
