/**
 * @fileOverview Firestore and application error types for CipherSuite — Alcyone Secure.
 *
 * Provides a typed error hierarchy so every throw/catch in the codebase
 * carries structured context rather than bare Error strings.
 *
 * Import from this file when:
 *   - Throwing a Firestore permission/not-found/conflict error from a hook
 *   - Catching errors and branching on error type
 *   - Constructing toast messages or error boundary displays
 */

// ─── Firestore operation types ────────────────────────────────────────────────

/** Every Firestore Security Rules operation that can be denied. */
export type SecurityRuleOperation =
  | "get"
  | "list"
  | "create"
  | "update"
  | "delete";

/** Maps a Firestore operation to a human-readable verb for display. */
const OPERATION_LABELS: Record<SecurityRuleOperation, string> = {
  get:    "read",
  list:   "list",
  create: "create",
  update: "update",
  delete: "delete",
};

// ─── Error context shapes ─────────────────────────────────────────────────────

/** Structured context for a Firestore Security Rules denial. */
export interface SecurityRuleContext {
  /** Full Firestore path, e.g. "projects/abc123/findings/def456" */
  path:       string;
  /** The operation that was denied. */
  operation:  SecurityRuleOperation;
  /**
   * The data payload that was sent with the request.
   * Only present for "create" and "update" operations.
   * Never include credentials or PII here — this context may be logged.
   */
  requestData?: Record<string, unknown>;
  /**
   * The UID of the user whose request was denied.
   * Useful for correlating denials with auth state.
   */
  uid?: string;
}

/** Structured context for a Firestore document-not-found error. */
export interface NotFoundContext {
  /** Full Firestore path that returned no document. */
  path:      string;
  /** The operation that triggered the miss (usually "get"). */
  operation: SecurityRuleOperation;
}

/** Generic structured context for unexpected Firestore errors. */
export interface FirestoreErrorContext {
  path?:      string;
  operation?: SecurityRuleOperation;
  /** The raw Firebase error code, e.g. "unavailable", "resource-exhausted". */
  code?:      string;
}

// ─── Error base class ─────────────────────────────────────────────────────────

/**
 * Base class for all CipherSuite application errors.
 * Extends Error with a `timestamp` so errors can be sorted/deduplicated
 * and an optional `displayMessage` for user-facing toasts.
 */
export abstract class AppError extends Error {
  /** ISO timestamp of when the error was constructed. */
  public readonly timestamp: string = new Date().toISOString();
  /**
   * A short, user-facing message suitable for a toast notification.
   * Falls back to the technical `message` if not provided.
   */
  public readonly displayMessage: string;

  constructor(message: string, displayMessage?: string) {
    super(message);
    // Restore prototype chain — required when extending built-in Error in TS
    Object.setPrototypeOf(this, new.target.prototype);
    this.displayMessage = displayMessage ?? "An unexpected error occurred.";
  }
}

// ─── Specific error classes ───────────────────────────────────────────────────

/**
 * Thrown when Firestore Security Rules deny a request.
 *
 * @example
 * throw new FirestorePermissionError({
 *   path:      `projects/${projectId}/findings`,
 *   operation: "create",
 *   uid:       user.uid,
 * });
 */
export class FirestorePermissionError extends AppError {
  public readonly context: SecurityRuleContext;

  constructor(context: SecurityRuleContext) {
    const op   = OPERATION_LABELS[context.operation];
    const path = context.path;

    const devMessage = [
      "FirestoreError: Missing or insufficient permissions.",
      `  Operation : ${context.operation} (${op})`,
      `  Path      : ${path}`,
      context.uid        ? `  UID       : ${context.uid}` : null,
      context.requestData
        ? `  Payload   : ${JSON.stringify(context.requestData, null, 2)}`
        : null,
    ]
      .filter(Boolean)
      .join("\n");

    const displayMessage =
      `You don't have permission to ${op} this resource. ` +
      `If this is unexpected, check your Firestore Security Rules for path: ${path}`;

    super(devMessage, displayMessage);
    this.name    = "FirestorePermissionError";
    this.context = context;
  }
}

/**
 * Thrown when a Firestore document is expected to exist but does not.
 *
 * @example
 * throw new FirestoreNotFoundError({
 *   path:      `projects/${projectId}`,
 *   operation: "get",
 * });
 */
export class FirestoreNotFoundError extends AppError {
  public readonly context: NotFoundContext;

  constructor(context: NotFoundContext) {
    const devMessage =
      `FirestoreError: Document not found.\n` +
      `  Path      : ${context.path}\n` +
      `  Operation : ${context.operation}`;

    super(devMessage, `The requested resource at "${context.path}" was not found.`);
    this.name    = "FirestoreNotFoundError";
    this.context = context;
  }
}

/**
 * Thrown for unexpected Firestore errors that don't map to permission or not-found.
 * Wraps the original Firebase error for stack trace preservation.
 *
 * @example
 * throw new FirestoreOperationError("unavailable", { path, operation: "list" }, originalErr);
 */
export class FirestoreOperationError extends AppError {
  public readonly context: FirestoreErrorContext;
  public readonly cause:   unknown;

  constructor(code: string, context: FirestoreErrorContext, cause?: unknown) {
    const devMessage =
      `FirestoreError: Operation failed with code "${code}".\n` +
      (context.path      ? `  Path      : ${context.path}\n`      : "") +
      (context.operation ? `  Operation : ${context.operation}\n` : "");

    super(devMessage, `A database error occurred (${code}). Please try again.`);
    this.name    = "FirestoreOperationError";
    this.context = { ...context, code };
    this.cause   = cause;
  }
}

// ─── Type guards ──────────────────────────────────────────────────────────────

export function isPermissionError(err: unknown): err is FirestorePermissionError {
  return err instanceof FirestorePermissionError;
}

export function isNotFoundError(err: unknown): err is FirestoreNotFoundError {
  return err instanceof FirestoreNotFoundError;
}

export function isOperationError(err: unknown): err is FirestoreOperationError {
  return err instanceof FirestoreOperationError;
}

export function isAppError(err: unknown): err is AppError {
  return err instanceof AppError;
}

// ─── Firebase error code → typed error factory ───────────────────────────────

/**
 * Convert a raw Firebase error (from the `catch` block of a Firestore call)
 * into the appropriate typed AppError subclass.
 *
 * @example
 * try {
 *   await getDoc(ref);
 * } catch (err) {
 *   throw fromFirebaseError(err, { path: ref.path, operation: "get" });
 * }
 */
export function fromFirebaseError(
  err: unknown,
  context: FirestoreErrorContext & { uid?: string; requestData?: Record<string, unknown> }
): AppError {
  const code =
    (err as any)?.code ??
    (err as any)?.message ??
    "unknown";

  if (code === "permission-denied" || code === "PERMISSION_DENIED") {
    return new FirestorePermissionError({
      path:        context.path ?? "unknown",
      operation:   context.operation ?? "get",
      uid:         context.uid,
      requestData: context.requestData,
    });
  }

  if (code === "not-found" || code === "NOT_FOUND") {
    return new FirestoreNotFoundError({
      path:      context.path ?? "unknown",
      operation: context.operation ?? "get",
    });
  }

  return new FirestoreOperationError(code, context, err);
}
