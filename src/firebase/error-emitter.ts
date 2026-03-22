
/**
 * @fileOverview Global typed event emitter for CipherSuite — Alcyone Secure.
 *
 * Provides a zero-dependency, browser-safe event bus for broadcasting
 * application-level errors (Firestore permission denials, network failures,
 * AI quota exhaustion, etc.) from anywhere in the call stack to a single
 * centralised listener — without prop-drilling or context coupling.
 *
 * Usage:
 *   // Emit (e.g. inside a Firestore hook):
 *   errorEmitter.emit("permission-error", { code: "permission-denied", ... });
 *
 *   // Listen (e.g. inside a top-level error boundary component):
 *   useEffect(() => {
 *     const handler = (err: FirestorePermissionError) => toast(err.message);
 *     errorEmitter.on("permission-error", handler);
 *     return () => errorEmitter.off("permission-error", handler);
 *   }, []);
 */

import type { FirestorePermissionError } from "./errors";

// ─── Event map ────────────────────────────────────────────────────────────────

/**
 * All events the emitter can broadcast.
 * Add new event types here — TypeScript will enforce them everywhere.
 */
export type AppErrorEvents = {
  /** Firestore returned PERMISSION_DENIED — user lacks read/write access. */
  "permission-error": (error: FirestorePermissionError) => void;

  /** Firebase / network call failed after all retries. */
  "network-error": (error: { message: string; retryable: boolean }) => void;

  /** AI API quota exhausted or rate-limited. */
  "ai-quota-error": (error: { message: string; retryAfterMs?: number }) => void;

  /** Generic unhandled error surfaced from a hook or server action. */
  "unhandled-error": (error: { message: string; context?: string }) => void;
};

export type AppErrorEventName = keyof AppErrorEvents;
export type AppErrorEventPayload<K extends AppErrorEventName> =
  Parameters<AppErrorEvents[K]>[0];

// ─── Browser-safe typed emitter ───────────────────────────────────────────────

/**
 * Minimal, browser-safe typed event emitter.
 *
 * Does NOT import Node's `EventEmitter` — that module is unavailable in the
 * browser and would either error or significantly bloat the client bundle.
 * Uses a plain `Map<eventName, Set<listener>>` instead.
 */
class TypedEventEmitter<TEvents extends Record<string, (...args: any[]) => void>> {
  private readonly listeners = new Map<
    keyof TEvents,
    Set<(...args: any[]) => void>
  >();

  /**
   * Subscribe to an event. Returns an unsubscribe function for convenience.
   *
   * @example
   * const unsub = errorEmitter.on("permission-error", handleError);
   * // later:
   * unsub();
   */
  on<K extends keyof TEvents>(event: K, listener: TEvents[K]): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);
    return () => this.off(event, listener);
  }

  /** Unsubscribe a previously registered listener. */
  off<K extends keyof TEvents>(event: K, listener: TEvents[K]): void {
    this.listeners.get(event)?.delete(listener);
  }

  /**
   * Subscribe to an event exactly once.
   * The listener is automatically removed after it fires.
   */
  once<K extends keyof TEvents>(event: K, listener: TEvents[K]): () => void {
    const wrapper = (...args: Parameters<TEvents[K]>) => {
      this.off(event, wrapper as TEvents[K]);
      (listener as (...a: any[]) => void)(...args);
    };
    return this.on(event, wrapper as TEvents[K]);
  }

  /** Emit an event, synchronously invoking all registered listeners. */
  emit<K extends keyof TEvents>(
    event: K,
    ...args: Parameters<TEvents[K]>
  ): boolean {
    const handlers = this.listeners.get(event);
    if (!handlers || handlers.size === 0) return false;
    handlers.forEach((fn) => {
      try {
        fn(...args);
      } catch (err) {
        // Prevent one bad listener from silencing others
        console.error(`[errorEmitter] Listener threw for event "${String(event)}":`, err);
      }
    });
    return true;
  }

  /** Remove all listeners for a specific event, or all events if omitted. */
  removeAllListeners(event?: keyof TEvents): void {
    if (event !== undefined) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }

  /** Number of listeners currently registered for a given event. */
  listenerCount(event: keyof TEvents): number {
    return this.listeners.get(event)?.size ?? 0;
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

/**
 * Global error event bus.
 * Import this instance anywhere in the app — it is the single source of truth.
 */
export const errorEmitter = new TypedEventEmitter<AppErrorEvents>();

// ─── Convenience emit helpers ─────────────────────────────────────────────────
// These reduce boilerplate at call sites and add structured logging in dev.

export function emitPermissionError(error: FirestorePermissionError): void {
  if (process.env.NODE_ENV === "development") {
    console.warn("[CipherSuite] Firestore permission denied:", error);
  }
  errorEmitter.emit("permission-error", error);
}

export function emitNetworkError(message: string, retryable = true): void {
  if (process.env.NODE_ENV === "development") {
    console.warn("[CipherSuite] Network error:", message);
  }
  errorEmitter.emit("network-error", { message, retryable });
}

export function emitAiQuotaError(message: string, retryAfterMs?: number): void {
  if (process.env.NODE_ENV === "development") {
    console.warn("[CipherSuite] AI quota error:", message);
  }
  errorEmitter.emit("ai-quota-error", { message, retryAfterMs });
}

export function emitUnhandledError(message: string, context?: string): void {
  if (process.env.NODE_ENV === "development") {
    console.error("[CipherSuite] Unhandled error:", message, context ?? "");
  }
  errorEmitter.emit("unhandled-error", { message, context });
}
