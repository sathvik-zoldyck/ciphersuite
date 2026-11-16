/**
 * @fileOverview Canonical type definitions for CipherSuite — Alcyone Secure.
 *
 * Single source of truth for all domain types, display config, and templates.
 * Import from here — never re-declare types in components or hooks.
 */

import { Timestamp } from "firebase/firestore";

// ─────────────────────────────────────────────────────────────────────────────
// Primitive helpers
// ─────────────────────────────────────────────────────────────────────────────

export type FirestoreDate = Timestamp | Date;

// ─────────────────────────────────────────────────────────────────────────────
// Shared base
// ─────────────────────────────────────────────────────────────────────────────

export interface FirestoreDoc {
  id:        string;
  createdAt: FirestoreDate;
  updatedAt: FirestoreDate;
}

// ─────────────────────────────────────────────────────────────────────────────
// Access control
// ─────────────────────────────────────────────────────────────────────────────

export type MemberRole = "admin" | "viewer";
export type MemberMap  = Record<string, MemberRole>;

// ─────────────────────────────────────────────────────────────────────────────
// Project
// ─────────────────────────────────────────────────────────────────────────────

export type ProjectType =
  | "Web Pentest"
  | "Mobile Pentest"
  | "Network Pentest"
  | "API Pentest"
  | "Infrastructure"
  | "Bug Bounty"
  | "Cloud Review"
  | "Log Analysis"
  | "Incident Response"
  | "Research";

export type ProjectStatus = "Active" | "Completed" | "On Hold";

export const PROJECT_STATUSES: ProjectStatus[] = ["Active", "On Hold", "Completed"];

export const PROJECT_TYPES: ProjectType[] = [
  "Web Pentest", "Mobile Pentest", "Network Pentest", "API Pentest",
  "Infrastructure", "Bug Bounty", "Cloud Review",
  "Log Analysis", "Incident Response", "Research",
];

export interface Project extends FirestoreDoc {
  name:      string;
  target:    string;
  scope:     string;
  type:      ProjectType;
  status:    ProjectStatus;
  ownerId:   string;
  /** Computed 0–100 risk score derived from open findings. Default 0. */
  riskScore: number;
  /** Optional — not all engagements have fixed dates. */
  startDate?: FirestoreDate;
  endDate?:   FirestoreDate;
}

// ─────────────────────────────────────────────────────────────────────────────
// Finding
// ─────────────────────────────────────────────────────────────────────────────

export type FindingSeverity = "Critical" | "High" | "Medium" | "Low" | "Informational";
export type FindingStatus   = "Open" | "Fixed" | "Verified" | "Accepted";
export type SortField       = "createdAt" | "updatedAt" | "severity" | "title" | "status";
export type SortDirection   = "asc" | "desc";

export interface Finding extends FirestoreDoc {
  projectId:        string;
  title:            string;
  severity:         FindingSeverity;
  status:           FindingStatus;
  description:      string;
  stepsToReproduce: string;
  impact:           string;
  remediation:      string;
  /** Affected endpoint, host, or component. */
  target?:          string;
  /** CVSS v3.1 base score (0.0–10.0). */
  cvss?:            number;
  /** e.g. "CWE-89" */
  cweId?:           string;
  /** e.g. "A03:2021" */
  owaspId?:         string;
  evidenceIds?:     string[];
  projectMembers?:  MemberMap;
}

/**
 * Form payload for creating or editing a finding.
 * Excludes all server-managed and relational fields.
 */
export type FindingFormData = Omit<
  Finding,
  "id" | "projectId" | "createdAt" | "updatedAt" | "evidenceIds" | "projectMembers"
>;


// ─────────────────────────────────────────────────────────────────────────────
// Evidence
// ─────────────────────────────────────────────────────────────────────────────

export interface Evidence extends FirestoreDoc {
  projectId:       string;
  name:            string;
  /** Full Firebase Storage path, e.g. "projects/abc/evidence/file.png". */
  storagePath:     string;
  /** Public download URL (populated after upload completes). */
  storageUrl?:     string;
  uploadedAt:      FirestoreDate;
  fileType?:       string;
  /** File size in bytes. */
  fileSize?:       number;
  description?:    string;
  findingIds?:     string[];
  toolOutputId?:   string;
  projectMembers?: MemberMap;
}

// ─────────────────────────────────────────────────────────────────────────────
// Note color
//
// Shared by both project Notes and PersonalNotes.
// Labels are security-vocabulary aligned so color means the same thing
// everywhere in the app.
// ─────────────────────────────────────────────────────────────────────────────

export type NoteColor =
  | "default"   // neutral
  | "red"       // Critical
  | "orange"    // Important
  | "yellow"    // Note / Warning
  | "green"     // Done / Safe
  | "teal"      // Research
  | "blue"      // Info
  | "purple"    // Personal
  | "pink";     // Idea

// ─────────────────────────────────────────────────────────────────────────────
// Project note  (subcollection: /projects/{id}/notes/{id})
// ─────────────────────────────────────────────────────────────────────────────

export interface Note extends FirestoreDoc {
  projectId: string;
  title:     string;
  content:   string;
  color?:    NoteColor;
}

// ─────────────────────────────────────────────────────────────────────────────
// Personal note  (subcollection: /users/{uid}/personal_notes/{id})
//
// Background images are stored in localStorage under cs:note-bg:{id}
// and are NEVER written to Firestore — no field for them here.
// Local-only notes are stored in localStorage under cs:personal-notes
// and are also never written to Firestore.
// ─────────────────────────────────────────────────────────────────────────────

export interface PersonalNote extends FirestoreDoc {
  ownerId: string;
  title:      string;
  content:    string;
  color:      NoteColor;
  tags:       string[];
  isPinned:   boolean;
  /**
   * When true the note is stored in localStorage only and never synced
   * to Firestore, even for authenticated users.
   */
  localOnly:  boolean;
  isArchived?: boolean;
  isTrashed?: boolean;
  /**
   * Unix millisecond timestamp. When Date.now() >= destructAt the note
   * is automatically deleted on the next page load.
   * null = no timer set.
   */
  destructAt: number | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Log
// ─────────────────────────────────────────────────────────────────────────────

export interface LogEntry extends FirestoreDoc {
  projectId: string;
  name:      string;
  content:   string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Report
// ─────────────────────────────────────────────────────────────────────────────

export type ReportFormat   = "markdown" | "pdf" | "docx";
export type ReportStatus   = "generating" | "ready" | "failed";
export type ReportTemplate = "executive" | "technical" | "full" | "bugbounty";

export type ReportSectionId =
  | "cover"
  | "executive_summary"
  | "scope"
  | "methodology"
  | "risk_overview"
  | "key_findings"
  | "findings"
  | "evidence"
  | "remediation"
  | "impact"
  | "appendix";

export interface ReportSection {
  id:      ReportSectionId;
  label:   string;
  enabled: boolean;
  desc:    string;
}

export interface Report extends FirestoreDoc {
  projectId:    string;
  title:        string;
  template:     ReportTemplate;
  format:       ReportFormat;
  status:       ReportStatus;
  sections:     string[];
  findingCount: number;
  wordCount?:   number;
  content?:     string;
  error?:       string;
  downloadUrl?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tool import (Phase 4)
// ─────────────────────────────────────────────────────────────────────────────

export const SUPPORTED_TOOLS = [
  "Nmap",
  "Nessus",
  "Burp Suite",
  "Nikto",
  "Nuclei",
  "OpenVAS",
  "Metasploit",
  "OWASP ZAP",
  "Other",
] as const;

export type ToolType = (typeof SUPPORTED_TOOLS)[number];

// ─────────────────────────────────────────────────────────────────────────────
// Utility generics
// ─────────────────────────────────────────────────────────────────────────────

/** Strip Firestore metadata for new document creation payloads. */
export type CreatePayload<T extends FirestoreDoc> =
  Omit<T, "id" | "createdAt" | "updatedAt">;

/** Partial update — id required for the update call, all other fields optional. */
export type UpdatePayload<T extends FirestoreDoc> =
  Partial<Omit<T, "id">> & { id: string };

/** Document data T enriched with its Firestore document ID. */
export type WithId<T> = T & { id: string };

// ─────────────────────────────────────────────────────────────────────────────
// Severity config
// ─────────────────────────────────────────────────────────────────────────────

export interface SeverityConfig {
  label:  string;
  color:  string;
  dot:    string;
  bg:     string;
  border: string;
  glow:   string;
  ring:   string;
  order:  number;
}

export const SEVERITY_CONFIG: Record<FindingSeverity, SeverityConfig> = {
  Critical:      { label: "Critical",      color: "text-red-400",    dot: "bg-red-400",    bg: "bg-red-500/10",    border: "border-red-500/30",    glow: "shadow-red-500/30",    ring: "ring-red-500/50",    order: 1 },
  High:          { label: "High",          color: "text-orange-400", dot: "bg-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/30", glow: "shadow-orange-500/30", ring: "ring-orange-500/50", order: 2 },
  Medium:        { label: "Medium",        color: "text-yellow-400", dot: "bg-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/30", glow: "shadow-yellow-500/30", ring: "ring-yellow-500/50", order: 3 },
  Low:           { label: "Low",           color: "text-cyan-400",   dot: "bg-cyan-400",   bg: "bg-cyan-500/10",   border: "border-cyan-500/30",   glow: "shadow-cyan-500/30",   ring: "ring-cyan-500/50",   order: 4 },
  Informational: { label: "Informational", color: "text-slate-400",  dot: "bg-slate-400",  bg: "bg-slate-500/10",  border: "border-slate-500/30",  glow: "shadow-slate-500/30",  ring: "ring-slate-500/50",  order: 5 },
};

export const SEVERITIES_ORDERED: FindingSeverity[] =
  (Object.keys(SEVERITY_CONFIG) as FindingSeverity[])
    .sort((a, b) => SEVERITY_CONFIG[a].order - SEVERITY_CONFIG[b].order);

// ─────────────────────────────────────────────────────────────────────────────
// Status config
// ─────────────────────────────────────────────────────────────────────────────

export interface StatusConfig {
  label:  string;
  color:  string;
  bg:     string;
  border: string;
  dot:    string;
}

export const STATUS_CONFIG: Record<FindingStatus, StatusConfig> = {
  Open:     { label: "Open",     color: "text-red-400",     bg: "bg-red-500/10",     border: "border-red-500/25",     dot: "bg-red-400"     },
  Fixed:    { label: "Fixed",    color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/25", dot: "bg-emerald-400" },
  Verified: { label: "Verified", color: "text-cyan-400",    bg: "bg-cyan-500/10",    border: "border-cyan-500/25",    dot: "bg-cyan-400"    },
  Accepted: { label: "Accepted", color: "text-amber-400",   bg: "bg-amber-500/10",   border: "border-amber-500/25",   dot: "bg-amber-400"   },
};

/** Statuses in logical lifecycle order: triage → resolution. */
export const STATUSES_ORDERED: FindingStatus[] = ["Open", "Accepted", "Verified", "Fixed"];

// ─────────────────────────────────────────────────────────────────────────────
// OWASP Top 10 (2021)
// ─────────────────────────────────────────────────────────────────────────────

export interface OwaspCategory {
  id:    string;
  label: string;
  short: string;
}

export const OWASP_CATEGORIES: OwaspCategory[] = [
  { id: "A01:2021", label: "A01:2021 - Broken Access Control",                      short: "Broken Access Control"     },
  { id: "A02:2021", label: "A02:2021 - Cryptographic Failures",                     short: "Cryptographic Failures"    },
  { id: "A03:2021", label: "A03:2021 - Injection",                                  short: "Injection"                 },
  { id: "A04:2021", label: "A04:2021 - Insecure Design",                            short: "Insecure Design"           },
  { id: "A05:2021", label: "A05:2021 - Security Misconfiguration",                  short: "Security Misconfiguration" },
  { id: "A06:2021", label: "A06:2021 - Vulnerable and Outdated Components",         short: "Outdated Components"       },
  { id: "A07:2021", label: "A07:2021 - Identification and Authentication Failures", short: "Auth Failures"             },
  { id: "A08:2021", label: "A08:2021 - Software and Data Integrity Failures",       short: "Integrity Failures"        },
  { id: "A09:2021", label: "A09:2021 - Security Logging and Monitoring Failures",   short: "Logging Failures"          },
  { id: "A10:2021", label: "A10:2021 - Server-Side Request Forgery (SSRF)",         short: "SSRF"                      },
];

// ─────────────────────────────────────────────────────────────────────────────
// Finding templates
// ─────────────────────────────────────────────────────────────────────────────

// The findings library lives in ./finding-library.ts.
export { FINDING_TEMPLATES, TEMPLATE_KEYS, severityFromCvss } from "./finding-library";
export type { FindingTemplate } from "./finding-library";

    