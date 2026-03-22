
"use client";

import { useState, useMemo, useCallback } from "react";
import {
  collection, addDoc, updateDoc, deleteDoc,
  doc, serverTimestamp, query, orderBy, Timestamp, where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useCollection } from "@/hooks/use-collection";
import { useAuth } from "@/context/AuthContext";
import { toast } from "@/hooks/use-toast";
import { fromFirebaseError } from "@/firebase/errors";
import { logActivity } from "@/lib/activity-service";
import type {
  Finding, FindingFormData,
  FindingSeverity, FindingStatus,
} from "@/lib/types";

// ─── Constants ────────────────────────────────────────────────────────────────

/** CVSS-aligned severity weights for risk score calculation. */
const SEVERITY_WEIGHTS: Record<FindingSeverity, number> = {
  Critical:      10,
  High:           7,
  Medium:         4,
  Low:            1,
  Informational:  0,
};

const ALL_SEVERITIES: FindingSeverity[] = [
  "Critical", "High", "Medium", "Low", "Informational",
];

const ALL_STATUSES: FindingStatus[] = [
  "Open", "Fixed", "Verified", "Accepted",
];

// ─── Types ────────────────────────────────────────────────────────────────────

export type SortField     = "createdAt" | "updatedAt" | "severity" | "title" | "status";
export type SortDirection = "asc" | "desc";

export interface FindingFilters {
  search:    string;
  severity:  FindingSeverity | "all";
  status:    FindingStatus   | "all";
  sortBy:    SortField;
  sortDir:   SortDirection;
}

export interface FindingStats {
  /** Risk score 0–100 based on open findings weighted by severity. */
  riskScore:      number;
  /** Per-severity count of open findings only. */
  severityCounts: Record<FindingSeverity, number>;
  /** Per-status count across all findings. */
  statusCounts:   Record<FindingStatus, number>;
  /** Total finding count (all statuses). */
  total:          number;
  /** Open finding count. */
  openCount:      number;
}

export interface UseFindingsReturn {
  /** All findings, normalised (Timestamps → Dates). */
  findings:   Finding[];
  /** Findings after filters + sort applied. */
  filtered:   Finding[];
  stats:      FindingStats;
  isLoading:  boolean;
  error:      string | null;
  filters:    FindingFilters;
  setSearch:      (v: string)            => void;
  setSeverity:    (v: FindingSeverity | "all") => void;
  setStatus:      (v: FindingStatus   | "all") => void;
  setSortBy:      (v: SortField)         => void;
  setSortDir:     (v: SortDirection)     => void;
  clearFilters:   () => void;
  addFinding:     (data: FindingFormData)                => Promise<void>;
  updateFinding:  (id: string, data: Partial<FindingFormData>) => Promise<void>;
  deleteFinding:  (id: string)                           => Promise<void>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normaliseFinding(f: Finding): Finding {
  return {
    ...f,
    createdAt: f.createdAt instanceof Timestamp ? f.createdAt.toDate() : new Date(f.createdAt as any),
    updatedAt: f.updatedAt instanceof Timestamp ? f.updatedAt.toDate() : new Date(f.updatedAt as any),
  };
}

function computeStats(findings: Finding[]): FindingStats {
  const severityCounts = Object.fromEntries(
    ALL_SEVERITIES.map((s) => [s, 0])
  ) as Record<FindingSeverity, number>;

  const statusCounts = Object.fromEntries(
    ALL_STATUSES.map((s) => [s, 0])
  ) as Record<FindingStatus, number>;

  let totalRisk = 0;
  let maxRisk   = 0;
  let openCount = 0;

  for (const f of findings) {
    // Status counts — all findings
    if (f.status in statusCounts) statusCounts[f.status]++;

    // Risk + severity counts — open findings only
    if (f.status === "Open") {
      openCount++;
      severityCounts[f.severity]++;
      totalRisk += SEVERITY_WEIGHTS[f.severity];
      maxRisk   += SEVERITY_WEIGHTS.Critical;
    }
  }

  const riskScore = maxRisk > 0
    ? Math.min(100, Math.round((totalRisk / maxRisk) * 100))
    : 0;

  return {
    riskScore,
    severityCounts,
    statusCounts,
    total:     findings.length,
    openCount,
  };
}

const SEVERITY_ORDER: Record<FindingSeverity, number> = {
  Critical: 0, High: 1, Medium: 2, Low: 3, Informational: 4,
};

const STATUS_ORDER: Record<FindingStatus, number> = {
  Open: 0, Accepted: 1, Verified: 2, Fixed: 3,
};

function sortFindings(
  findings: Finding[],
  sortBy:  SortField,
  sortDir: SortDirection
): Finding[] {
  const dir = sortDir === "asc" ? 1 : -1;

  return [...findings].sort((a, b) => {
    switch (sortBy) {
      case "severity":
        return dir * (SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
      case "status":
        return dir * (STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
      case "title":
        return dir * a.title.localeCompare(b.title);
      case "updatedAt":
        return dir * (
          new Date(a.updatedAt as any).getTime() -
          new Date(b.updatedAt as any).getTime()
        );
      case "createdAt":
      default:
        return dir * (
          new Date(a.createdAt as any).getTime() -
          new Date(b.createdAt as any).getTime()
        );
    }
  });
}

const DEFAULT_FILTERS: FindingFilters = {
  search:  "",
  severity:"all",
  status:  "all",
  sortBy:  "createdAt",
  sortDir: "desc",
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useFindings(projectId: string): UseFindingsReturn {
  const { user, isGuest, getLocalFindings, setLocalFindings, loading: authLoading } = useAuth();

  // ── Filters state ──────────────────────────────────────────────────────────
  const [filters, setFilters] = useState<FindingFilters>(DEFAULT_FILTERS);

  // ── Firebase subscription ──────────────────────────────────────────────────
  const findingsRef = useMemo(() => {
    if (isGuest || !projectId || authLoading || !user) return null;
    // The `ownsProject` security rule handles authorization.
    // Filtering by ownerId here is redundant and requires a composite index.
    return query(
      collection(db, "projects", projectId, "findings"),
      orderBy("createdAt", "desc")
    );
  }, [projectId, isGuest, authLoading, user]);

  const {
    data:      firebaseFindings,
    isLoading: firebaseLoading,
    error:     firestoreError,
  } = useCollection<Finding>(findingsRef);

  // ── Local (guest) findings ─────────────────────────────────────────────────
  const localFindings = useMemo(
    () => getLocalFindings(projectId),
    [projectId, getLocalFindings]
  );

  // ── Normalised findings ────────────────────────────────────────────────────
  const rawFindings = isGuest ? localFindings : (firebaseFindings ?? []);

  const findings = useMemo(
    () => (rawFindings as Finding[]).map(normaliseFinding),
    [rawFindings]
  );

  // ── Filtered + sorted view ─────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const { search, severity, status, sortBy, sortDir } = filters;
    const q = search.toLowerCase();

    const result = findings.filter((f) => {
      if (severity !== "all" && f.severity !== severity) return false;
      if (status   !== "all" && f.status   !== status)   return false;
      if (q && !f.title.toLowerCase().includes(q) &&
              !f.description?.toLowerCase().includes(q)  &&
              !f.target?.toLowerCase().includes(q))      return false;
      return true;
    });

    return sortFindings(result, sortBy, sortDir);
  }, [findings, filters]);

  // ── Stats ──────────────────────────────────────────────────────────────────
  const stats = useMemo(() => computeStats(findings), [findings]);

  // ── CRUD ───────────────────────────────────────────────────────────────────

  const addFinding = useCallback(async (data: FindingFormData): Promise<void> => {
    try {
      let targetId = "";
      if (isGuest) {
        const newFinding: Finding = {
          ...data,
          id:        `guest_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          projectId,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        targetId = newFinding.id;
        setLocalFindings(projectId, [...localFindings, newFinding]);
      } else {
        if (!user) throw new Error("User must be authenticated to add a finding.");
        const docRef = await addDoc(
          collection(db, "projects", projectId, "findings"),
          { ...data, projectId, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }
        );
        targetId = docRef.id;
      }
      
      await logActivity(projectId, user, "finding.created", {
        targetId,
        targetTitle: data.title,
      });

      toast.success("Finding created.");
    } catch (err) {
      const appError = fromFirebaseError(err, { operation: "create" });
      toast.error("Failed to create finding.", appError.displayMessage);
      throw appError;
    }
  }, [isGuest, projectId, localFindings, setLocalFindings, user]);

  const updateFinding = useCallback(
    async (id: string, data: Partial<FindingFormData>): Promise<void> => {
      try {
        const oldFinding = findings.find((f) => f.id === id);

        if (isGuest) {
          setLocalFindings(
            projectId,
            localFindings.map((f) =>
              f.id === id ? { ...f, ...data, updatedAt: new Date() } : f
            ) as Finding[]
          );
        } else {
          await updateDoc(
            doc(db, "projects", projectId, "findings", id),
            { ...data, updatedAt: serverTimestamp() }
          );
        }

        if (oldFinding) {
          if (data.status && data.status !== oldFinding.status) {
            await logActivity(projectId, user, "finding.status_changed", {
              targetId: id,
              targetTitle: oldFinding.title,
              field: "status",
              oldValue: oldFinding.status,
              newValue: data.status,
            });
          } else if (data.severity && data.severity !== oldFinding.severity) {
            await logActivity(projectId, user, "finding.severity_changed", {
              targetId: id,
              targetTitle: oldFinding.title,
              field: "severity",
              oldValue: oldFinding.severity,
              newValue: data.severity,
            });
          } else {
            await logActivity(projectId, user, "finding.updated", {
              targetId: id,
              targetTitle: oldFinding.title,
            });
          }
        }

        toast.success("Finding updated.");
      } catch (err) {
        const appError = fromFirebaseError(err, { operation: "update" });
        toast.error("Failed to update finding.", appError.displayMessage);
        throw appError;
      }
    },
    [isGuest, projectId, localFindings, setLocalFindings, findings, user]
  );

  const deleteFinding = useCallback(async (id: string): Promise<void> => {
    try {
      const oldFinding = findings.find((f) => f.id === id);

      if (isGuest) {
        setLocalFindings(projectId, localFindings.filter((f) => f.id !== id));
      } else {
        await deleteDoc(doc(db, "projects", projectId, "findings", id));
      }

      if (oldFinding) {
        await logActivity(projectId, user, "finding.deleted", {
          targetId: id,
          targetTitle: oldFinding.title,
        });
      }

      toast.success("Finding deleted.");
    } catch (err) {
      const appError = fromFirebaseError(err, { operation: "delete" });
      toast.error("Failed to delete finding.", appError.displayMessage);
      throw appError;
    }
  }, [isGuest, projectId, localFindings, setLocalFindings, findings, user]);

  // ── Filter setters ─────────────────────────────────────────────────────────

  const setSearch    = useCallback((v: string)              => setFilters((p) => ({ ...p, search: v })), []);
  const setSeverity  = useCallback((v: FindingSeverity | "all") => setFilters((p) => ({ ...p, severity: v })), []);
  const setStatus    = useCallback((v: FindingStatus   | "all") => setFilters((p) => ({ ...p, status: v })), []);
  const setSortBy    = useCallback((v: SortField)             => setFilters((p) => ({ ...p, sortBy: v })), []);
  const setSortDir   = useCallback((v: SortDirection)         => setFilters((p) => ({ ...p, sortDir: v })), []);
  const clearFilters = useCallback(()                         => setFilters(DEFAULT_FILTERS), []);

  const isLoading = !isGuest && (firebaseLoading || authLoading);

  return {
    findings,
    filtered,
    stats,
    isLoading,
    error:     firestoreError?.displayMessage ?? null,
    filters,
    setSearch,
    setSeverity,
    setStatus,
    setSortBy,
    setSortDir,
    clearFilters,
    addFinding,
    updateFinding,
    deleteFinding,
  };
}
