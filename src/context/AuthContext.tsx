
"use client";

/**
 * @fileOverview Authentication context for CipherSuite — Alcyone Secure.
 *
 * Handles two auth modes:
 *   1. Firebase Auth  — Google sign-in, real-time Firestore sync
 *   2. Guest mode     — localStorage-backed, zero server dependency
 *
 * Guest data is serialised to localStorage under the key "cs:guest:data".
 * All public guest methods are stable references (useCallback) so they are
 * safe to use in dependency arrays without triggering infinite renders.
 */

import React, {
  createContext, useContext, useEffect,
  useState, useCallback, useMemo, useRef,
} from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import type { Project, Finding, Evidence, Note, LogEntry, Report as ReportType, PersonalNote } from "@/lib/types";

// ─── Storage keys ─────────────────────────────────────────────────────────────

const KEY_IS_GUEST  = "cs:guest";
const KEY_GUEST_DATA = "cs:guest:data";

// ─── Types ────────────────────────────────────────────────────────────────────

/** All data persisted locally for a guest session. */
export interface LocalData {
  projects:      Project[];
  findings:      Record<string, Finding[]>;
  evidence:      Record<string, Evidence[]>;
  notes:         Record<string, Note>;
  logs:          Record<string, Partial<LogEntry>>;
  reports:       Record<string, ReportType[]>;
  personalNotes: PersonalNote[];
}

const EMPTY_LOCAL_DATA: LocalData = {
  projects:      [],
  findings:      {},
  evidence:      {},
  notes:         {},
  logs:          {},
  reports:       {},
  personalNotes: [],
};

export interface AuthContextType {
  // ── Auth state ─────────────────────────────────────────────────────────────
  user:     User | null;
  isGuest:  boolean;
  /** True during the initial auth check — gates the app loading screen. */
  loading:  boolean;

  // ── Auth actions ───────────────────────────────────────────────────────────
  loginAsGuest: () => void;
  logout:       () => Promise<void>;

  // ── Guest data (no-ops for authenticated users) ────────────────────────────
  localData:         LocalData;
  addLocalProject:   (data: Omit<Project, "id" | "createdAt" | "updatedAt" | "riskScore" | "ownerId" | "status">) => Project;
  updateLocalProject:(projectId: string, updates: Partial<Project>) => void;
  deleteLocalProject:(projectId: string) => void;
  getLocalProject:   (id: string) => Project | undefined;

  getLocalFindings:  (projectId: string) => Finding[];
  setLocalFindings:  (projectId: string, findings: Finding[]) => void;

  getLocalEvidence:  (projectId: string) => Evidence[];
  setLocalEvidence:  (projectId: string, evidence: Evidence[]) => void;

  getLocalNote:      (projectId: string) => Note | undefined;
  setLocalNote:      (projectId: string, note: Note) => void;

  getLocalLog:       (projectId: string) => Partial<LogEntry> | undefined;
  setLocalLog:       (projectId: string, log: Partial<LogEntry>) => void;

  getLocalReports:   (projectId: string) => ReportType[];
  setLocalReports:   (projectId: string, reports: ReportType[]) => void;
  
  getLocalPersonalNotes: () => PersonalNote[];
  setLocalPersonalNotes: (notes: PersonalNote[]) => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextType>({
  user:     null,
  isGuest:  false,
  loading:  true,
  loginAsGuest:      () => {},
  logout:            async () => {},
  localData:         EMPTY_LOCAL_DATA,
  addLocalProject:   () => ({} as Project),
  updateLocalProject:() => {},
  deleteLocalProject:() => {},
  getLocalProject:   () => undefined,
  getLocalFindings:  () => [],
  setLocalFindings:  () => {},
  getLocalEvidence:  () => [],
  setLocalEvidence:  () => {},
  getLocalNote:      () => undefined,
  setLocalNote:      () => {},
  getLocalLog:       () => undefined,
  setLocalLog:       () => {},
  getLocalReports:   () => [],
  setLocalReports:   () => {},
  getLocalPersonalNotes: () => [],
  setLocalPersonalNotes: () => {},
});

// ─── Local-storage helpers ────────────────────────────────────────────────────

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

/**
 * Deserialise guest data from localStorage.
 * ISO date strings are revived back to Date objects.
 * Merges with defaults to safely handle data migrations.
 * Returns EMPTY_LOCAL_DATA on any parse error.
 */
function readLocalData(): LocalData {
  if (typeof window === "undefined") return EMPTY_LOCAL_DATA;
  try {
    const raw = localStorage.getItem(KEY_GUEST_DATA);
    if (!raw) return EMPTY_LOCAL_DATA;

    const parsedData = JSON.parse(raw, (_key, value) => {
      if (typeof value === "string" && ISO_DATE_RE.test(value)) {
        return new Date(value);
      }
      return value;
    });

    // Merge with defaults to safely handle migrations where new keys are added.
    return { ...EMPTY_LOCAL_DATA, ...parsedData };
  } catch {
    console.warn("[AuthContext] Failed to parse guest data — resetting.");
    return EMPTY_LOCAL_DATA;
  }
}

function writeLocalData(data: LocalData): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY_GUEST_DATA, JSON.stringify(data));
  } catch (err) {
    console.warn("[AuthContext] localStorage write failed:", err);
  }
}

function clearGuestStorage(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY_IS_GUEST);
  localStorage.removeItem(KEY_GUEST_DATA);
}


// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  const [user,      setUser]      = useState<User | null>(null);
  const [isGuest,   setIsGuest]   = useState(false);
  const [loading,   setLoading]   = useState(true);
  const [localData, setLocalData] = useState<LocalData>(EMPTY_LOCAL_DATA);

  /**
   * Atomically update in-memory state AND localStorage in a single call.
   * Accepts either a new data object or an updater function (same API as setState).
   */
  const updateLocalData = useCallback(
    (update: LocalData | ((prev: LocalData) => LocalData)) => {
      setLocalData((prev) => {
        const next = typeof update === "function" ? update(prev) : update;
        writeLocalData(next);
        return next;
      });
    },
    []
  );

  // ── Bootstrap auth state ─────────────────────────────────────────────────

  useEffect(() => {
    // SSR guard: window is not available during server render
    if (typeof window === "undefined") return;

    const isGuestSession = localStorage.getItem(KEY_IS_GUEST) === "true";

    if (isGuestSession) {
      setLocalData(readLocalData());
      setIsGuest(true);
      setLoading(false);
      return;
    }

    // Real Firebase auth
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setIsGuest(false);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  // ── Auth actions ─────────────────────────────────────────────────────────

  const loginAsGuest = useCallback(() => {
    clearGuestStorage();
    localStorage.setItem(KEY_IS_GUEST, "true");
    setIsGuest(true);
    setUser(null);
    setLocalData(EMPTY_LOCAL_DATA);
  }, []);

  const logout = useCallback(async () => {
    try {
      if (!isGuest) await signOut(auth);
    } catch (err) {
      console.error("[AuthContext] Sign-out error:", err);
    } finally {
      clearGuestStorage();
      setUser(null);
      setIsGuest(false);
      setLocalData(EMPTY_LOCAL_DATA);
      router.push("/login");
    }
  }, [isGuest, router]);

  // ── Guest project methods ─────────────────────────────────────────────────

  const addLocalProject = useCallback(
    (data: Omit<Project, "id" | "createdAt" | "updatedAt" | "riskScore" | "ownerId" | "status">): Project => {
      const newProject: Project = {
        ...data,
        id:        `guest_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        ownerId:   "guest",
        status:    "Active",
        riskScore: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      updateLocalData((prev) => ({
        ...prev,
        projects: [...prev.projects, newProject],
      }));
      return newProject;
    },
    [updateLocalData]
  );

  const updateLocalProject = useCallback(
    (projectId: string, updates: Partial<Project>) => {
      updateLocalData((prev) => ({
        ...prev,
        projects: prev.projects.map((p) =>
          p.id === projectId
            ? { ...p, ...updates, updatedAt: new Date() }
            : p
        ),
      }));
    },
    [updateLocalData]
  );

  const deleteLocalProject = useCallback(
    (projectId: string) => {
      updateLocalData((prev) => {
        // Destructure out the project's sub-collections
        const { [projectId]: _f, ...findings } = prev.findings;
        const { [projectId]: _e, ...evidence } = prev.evidence;
        const { [projectId]: _n, ...notes    } = prev.notes;
        const { [projectId]: _l, ...logs     } = prev.logs;
        const { [projectId]: _r, ...reports  } = prev.reports;
        return {
          projects: prev.projects.filter((p) => p.id !== projectId),
          findings,
          evidence,
          notes,
          logs,
          reports,
          personalNotes: prev.personalNotes,
        };
      });
    },
    [updateLocalData]
  );

  // These read from localData directly — stable via useCallback with localData dep,
  // but exposed as plain functions (not memoized) to keep the API surface light.
  // Consumers that need reactivity should read from localData directly.
  const getLocalProject   = useCallback((id: string) =>
    localData.projects.find((p) => p.id === id),
    [localData.projects]
  );

  // ── Guest findings ────────────────────────────────────────────────────────

  const getLocalFindings = useCallback(
    (projectId: string): Finding[] => localData.findings[projectId] ?? [],
    [localData.findings]
  );

  const setLocalFindings = useCallback(
    (projectId: string, findings: Finding[]) => {
      updateLocalData((prev) => ({
        ...prev,
        findings: { ...prev.findings, [projectId]: findings },
      }));
    },
    [updateLocalData]
  );

  // ── Guest evidence ────────────────────────────────────────────────────────

  const getLocalEvidence = useCallback(
    (projectId: string): Evidence[] => localData.evidence[projectId] ?? [],
    [localData.evidence]
  );

  const setLocalEvidence = useCallback(
    (projectId: string, evidence: Evidence[]) => {
      updateLocalData((prev) => ({
        ...prev,
        evidence: { ...prev.evidence, [projectId]: evidence },
      }));
    },
    [updateLocalData]
  );

  // ── Guest notes ───────────────────────────────────────────────────────────

  const getLocalNote = useCallback(
    (projectId: string): Note | undefined => localData.notes[projectId],
    [localData.notes]
  );

  const setLocalNote = useCallback(
    (projectId: string, note: Note) => {
      updateLocalData((prev) => ({
        ...prev,
        notes: { ...prev.notes, [projectId]: note },
      }));
    },
    [updateLocalData]
  );
  
  // ── Guest PERSONAL notes ───────────────────────────────────────────────────

  const getLocalPersonalNotes = useCallback(
    (): PersonalNote[] => localData.personalNotes ?? [],
    [localData.personalNotes]
  );
  
  const setLocalPersonalNotes = useCallback(
    (notes: PersonalNote[]) => {
       updateLocalData((prev) => ({ ...prev, personalNotes: notes }));
    },
    [updateLocalData]
  );

  // ── Guest logs ────────────────────────────────────────────────────────────

  const getLocalLog = useCallback(
    (projectId: string): Partial<LogEntry> | undefined => localData.logs[projectId],
    [localData.logs]
  );

  const setLocalLog = useCallback(
    (projectId: string, log: Partial<LogEntry>) => {
      updateLocalData((prev) => ({
        ...prev,
        logs: { ...prev.logs, [projectId]: log },
      }));
    },
    [updateLocalData]
  );
  
  // ── Guest reports ─────────────────────────────────────────────────────────

  const getLocalReports = useCallback(
    (projectId: string): ReportType[] => localData.reports[projectId] ?? [],
    [localData.reports]
  );

  const setLocalReports = useCallback(
    (projectId: string, reports: ReportType[]) => {
      updateLocalData((prev) => ({
        ...prev,
        reports: { ...prev.reports, [projectId]: reports },
      }));
    },
    [updateLocalData]
  );

  // ── Context value (memoised to prevent unnecessary re-renders) ────────────

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      isGuest,
      loading,
      loginAsGuest,
      logout,
      localData,
      addLocalProject,
      updateLocalProject,
      deleteLocalProject,
      getLocalProject,
      getLocalFindings,
      setLocalFindings,
      getLocalEvidence,
      setLocalEvidence,
      getLocalNote,
      setLocalNote,
      getLocalLog,
      setLocalLog,
      getLocalReports,
      setLocalReports,
      getLocalPersonalNotes,
      setLocalPersonalNotes,
    }),
    [
      user, isGuest, loading,
      loginAsGuest, logout,
      localData,
      addLocalProject, updateLocalProject, deleteLocalProject, getLocalProject,
      getLocalFindings, setLocalFindings,
      getLocalEvidence, setLocalEvidence,
      getLocalNote, setLocalNote,
      getLocalLog, setLocalLog,
      getLocalReports, setLocalReports,
      getLocalPersonalNotes, setLocalPersonalNotes,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("[useAuth] must be used inside <AuthProvider>.");
  }
  return ctx;
}

/**
 * Convenience hook — returns only guest data and its mutators.
 * Useful in guest-mode-only components to avoid destructuring the full context.
 */
export function useLocalData() {
  const {
    localData,
    addLocalProject, updateLocalProject, deleteLocalProject, getLocalProject,
    getLocalFindings, setLocalFindings,
    getLocalEvidence, setLocalEvidence,
    getLocalNote, setLocalNote,
    getLocalLog, setLocalLog,
    getLocalReports, setLocalReports,
    getLocalPersonalNotes, setLocalPersonalNotes,
  } = useAuth();

  return {
    localData,
    addLocalProject, updateLocalProject, deleteLocalProject, getLocalProject,
    getLocalFindings, setLocalFindings,
    getLocalEvidence, setLocalEvidence,
    getLocalNote, setLocalNote,
    getLocalLog, setLocalLog,
    getLocalReports, setLocalReports,
    getLocalPersonalNotes, setLocalPersonalNotes,
  };
}
