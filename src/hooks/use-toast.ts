"use client";

/**
 * @fileOverview Global toast system for CipherSuite — Alcyone Secure.
 *
 * Architecture: module-level state + listeners pattern (no React context).
 * This means `toast()` can be called from anywhere — hooks, server actions,
 * event handlers — without needing access to the component tree.
 *
 * Usage:
 *   import { toast } from "@/hooks/use-toast";
 *   toast.success("Finding saved.");
 *   toast.error("Permission denied.");
 *   toast({ title: "Custom", description: "With full control." });
 */

import * as React from "react";
import type { ToastActionElement, ToastProps } from "@/components/ui/toast";

// ─── Config ───────────────────────────────────────────────────────────────────

/** Maximum toasts visible at once. */
const TOAST_LIMIT = 3;

/**
 * How long (ms) to wait after a toast closes before removing it from state.
 * Needs to be long enough for the exit animation to complete (~300ms).
 * The original value of 1,000,000ms (16+ minutes) was a bug.
 */
const TOAST_REMOVE_DELAY_MS = 400;

/**
 * Default auto-dismiss duration per variant (ms).
 * `null` = do not auto-dismiss (user must close manually).
 */
const VARIANT_DURATION: Record<ToastVariant, number | null> = {
  default:     4000,
  success:     3000,
  error:       null,   // errors stay until dismissed — user must acknowledge
  warning:     5000,
  destructive: null,
};

// ─── Types ────────────────────────────────────────────────────────────────────

export type ToastVariant = "default" | "success" | "error" | "warning" | "destructive";

export type ToasterToast = ToastProps & {
  id:           string;
  title?:       React.ReactNode;
  description?: React.ReactNode;
  action?:      ToastActionElement;
  variant?:     ToastVariant;
  /** Auto-dismiss after this many ms. Pass `null` to disable. */
  duration?:    number | null;
};

export type ToastInput = Omit<ToasterToast, "id">;

export interface ToastHandle {
  id:      string;
  dismiss: () => void;
  update:  (props: Partial<ToasterToast>) => void;
}

// ─── State ────────────────────────────────────────────────────────────────────

interface State {
  toasts: ToasterToast[];
}

type Action =
  | { type: "ADD_TOAST";     toast: ToasterToast       }
  | { type: "UPDATE_TOAST";  toast: Partial<ToasterToast> & { id: string } }
  | { type: "DISMISS_TOAST"; toastId?: string          }
  | { type: "REMOVE_TOAST";  toastId?: string          };

// ─── Reducer ──────────────────────────────────────────────────────────────────

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "ADD_TOAST":
      return {
        ...state,
        toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT),
      };

    case "UPDATE_TOAST":
      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === action.toast.id ? { ...t, ...action.toast } : t
        ),
      };

    case "DISMISS_TOAST":
      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === action.toastId || action.toastId === undefined
            ? { ...t, open: false }
            : t
        ),
      };

    case "REMOVE_TOAST":
      return {
        ...state,
        toasts:
          action.toastId === undefined
            ? []
            : state.toasts.filter((t) => t.id !== action.toastId),
      };
  }
}

// ─── Module-level store ───────────────────────────────────────────────────────

type Listener = (state: State) => void;

let   memoryState: State     = { toasts: [] };
const listeners:   Listener[] = [];
const removeTimers = new Map<string, ReturnType<typeof setTimeout>>();
const dismissTimers = new Map<string, ReturnType<typeof setTimeout>>();

function dispatch(action: Action): void {
  memoryState = reducer(memoryState, action);
  listeners.forEach((l) => l(memoryState));
}

function scheduleRemove(toastId: string): void {
  if (removeTimers.has(toastId)) return;
  const t = setTimeout(() => {
    removeTimers.delete(toastId);
    dispatch({ type: "REMOVE_TOAST", toastId });
  }, TOAST_REMOVE_DELAY_MS);
  removeTimers.set(toastId, t);
}

function scheduleDismiss(toastId: string, duration: number): void {
  if (dismissTimers.has(toastId)) return;
  const t = setTimeout(() => {
    dismissTimers.delete(toastId);
    dispatch({ type: "DISMISS_TOAST", toastId });
    scheduleRemove(toastId);
  }, duration);
  dismissTimers.set(toastId, t);
}

function cancelTimers(toastId: string): void {
  const dt = dismissTimers.get(toastId);
  if (dt) { clearTimeout(dt); dismissTimers.delete(toastId); }
  const rt = removeTimers.get(toastId);
  if (rt) { clearTimeout(rt); removeTimers.delete(toastId); }
}

// ─── ID generator ─────────────────────────────────────────────────────────────

function genId(): string {
  // Use crypto.randomUUID when available (modern browsers + Node 19+),
  // fall back to a timestamp+random string for older environments.
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// ─── Core toast function ──────────────────────────────────────────────────────

function createToast(input: ToastInput): ToastHandle {
  const id      = genId();
  const variant = input.variant ?? "default";
  const duration =
    input.duration !== undefined
      ? input.duration
      : VARIANT_DURATION[variant];

  const dismiss = () => {
    cancelTimers(id);
    dispatch({ type: "DISMISS_TOAST", toastId: id });
    scheduleRemove(id);
  };

  const update = (props: Partial<ToasterToast>) =>
    dispatch({ type: "UPDATE_TOAST", toast: { ...props, id } });

  dispatch({
    type: "ADD_TOAST",
    toast: {
      ...input,
      id,
      variant,
      open: true,
      onOpenChange: (open) => {
        if (!open) dismiss();
      },
    },
  });

  // Schedule auto-dismiss if the variant has a duration
  if (duration !== null && duration > 0) {
    scheduleDismiss(id, duration);
  }

  return { id, dismiss, update };
}

// ─── Variant helpers ──────────────────────────────────────────────────────────

/**
 * Call `toast(input)` for full control, or use the variant shortcuts:
 *
 * @example
 * toast("Finding saved.");
 * toast.success("Evidence uploaded.");
 * toast.error("Permission denied.", "Check your Firestore rules.");
 * toast.warning("Unsaved changes.");
 */
function toast(input: ToastInput | string): ToastHandle {
  if (typeof input === "string") {
    return createToast({ title: input });
  }
  return createToast(input);
}

toast.success = (title: string, description?: string): ToastHandle =>
  createToast({ title, description, variant: "success" });

toast.error = (title: string, description?: string): ToastHandle =>
  createToast({ title, description, variant: "error" });

toast.warning = (title: string, description?: string): ToastHandle =>
  createToast({ title, description, variant: "warning" });

toast.destructive = (title: string, description?: string): ToastHandle =>
  createToast({ title, description, variant: "destructive" });

toast.dismiss = (toastId?: string): void => {
  if (toastId) {
    cancelTimers(toastId);
    dispatch({ type: "DISMISS_TOAST", toastId });
    scheduleRemove(toastId);
  } else {
    memoryState.toasts.forEach((t) => cancelTimers(t.id));
    dispatch({ type: "DISMISS_TOAST" });
  }
};

toast.dismissAll = (): void => toast.dismiss();

// ─── Hook ─────────────────────────────────────────────────────────────────────

export interface UseToastReturn {
  toasts:  ToasterToast[];
  toast:   typeof toast;
  dismiss: typeof toast.dismiss;
}

export function useToast(): UseToastReturn {
  const [state, setState] = React.useState<State>(memoryState);

  React.useEffect(() => {
    // Register listener on mount; remove on unmount.
    // The original had `[state]` in the deps array, which re-registered
    // the listener on every state change — O(n) listener registrations
    // per toast update, leaking memory on every render.
    // Correct deps: [] — register once, clean up on unmount.
    listeners.push(setState);
    return () => {
      const index = listeners.indexOf(setState);
      if (index > -1) listeners.splice(index, 1);
    };
  }, []); // ← empty array is intentional and correct

  return {
    toasts:  state.toasts,
    toast,
    dismiss: toast.dismiss,
  };
}

export { toast };
