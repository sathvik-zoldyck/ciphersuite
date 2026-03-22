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

export interface FindingTemplate {
  title:            string;
  severity:         FindingSeverity;
  description:      string;
  stepsToReproduce: string;
  impact:           string;
  remediation:      string;
  cvss?:            number;
  cweId?:           string;
  owaspId?:         string;
}

export const FINDING_TEMPLATES: Record<string, FindingTemplate> = {
  "sql-injection": {
    title: "SQL Injection", severity: "High", cvss: 9.8,
    cweId: "CWE-89", owaspId: "A03:2021",
    description: "A SQL injection vulnerability allows an attacker to interfere with the queries an application makes to its database. User-supplied input is interpreted as SQL syntax rather than data, allowing arbitrary query manipulation.",
    stepsToReproduce: "1. Navigate to the vulnerable endpoint.\n2. Insert a single quote (') into the target parameter — observe a database error or anomalous response.\n3. Submit the payload: ' OR '1'='1\n4. Confirm with a UNION-based or time-based blind payload to enumerate data.",
    impact: "An attacker can gain unauthorised read access to sensitive database records, modify or delete data, execute administration operations (DROP TABLE, xp_cmdshell), and in some configurations execute OS-level commands on the database host.",
    remediation: "1. Use parameterised queries (prepared statements) for all database interactions.\n2. Apply strict server-side input validation and allowlist expected formats.\n3. Grant the database account minimum required privileges — no DBA rights.\n4. Deploy a Web Application Firewall (WAF) as a secondary control.\n5. Audit all dynamic query constructions in the codebase.",
  },
  "xss-stored": {
    title: "Stored Cross-Site Scripting (XSS)", severity: "High", cvss: 8.8,
    cweId: "CWE-79", owaspId: "A03:2021",
    description: "Stored XSS occurs when an application persists unsanitised user input and later renders it in HTML responses without encoding. The malicious script executes in every victim's browser that views the affected page.",
    stepsToReproduce: "1. Identify an input field whose value is stored and later rendered in a response.\n2. Submit the payload: <script>alert(document.domain)</script>\n3. Navigate to the page that renders the stored value.\n4. Confirm script execution. Replace alert() with document.cookie exfiltration to demonstrate impact.",
    impact: "Attackers can execute arbitrary JavaScript in victims' browsers, steal session cookies, capture keystrokes, perform CSRF actions on behalf of victims, and deface the application. Because the payload is stored, every user who views the page is affected without further attacker interaction.",
    remediation: "1. Apply context-aware output encoding (HTML entity, JavaScript, URL) to all dynamic content.\n2. Validate and sanitize all user-supplied input server-side before storage.\n3. Implement a strict Content Security Policy (CSP) that blocks inline script execution.\n4. Set the HttpOnly and Secure flags on session cookies.",
  },
  "xss-reflected": {
    title: "Reflected Cross-Site Scripting (XSS)", severity: "Medium", cvss: 6.1,
    cweId: "CWE-79", owaspId: "A03:2021",
    description: "Reflected XSS occurs when user-supplied input is immediately returned in an HTTP response without proper encoding. Exploitation requires a victim to click a crafted URL containing the malicious payload.",
    stepsToReproduce: "1. Identify a URL parameter whose value is reflected in the HTML response.\n2. Craft a URL with the payload: ?param=<script>alert(document.domain)</script>\n3. Open the crafted URL in a browser and confirm script execution.\n4. Verify the payload is not encoded in the response source.",
    impact: "An attacker can hijack the session of any user who clicks the malicious link, perform actions on their behalf, steal credentials, and redirect victims to phishing pages.",
    remediation: "1. HTML-encode all user-controlled values reflected in responses.\n2. Set the X-XSS-Protection: 1; mode=block header for older browsers.\n3. Implement a Content Security Policy to prevent inline script execution.\n4. Validate that redirect destinations are within the expected domain.",
  },
  "broken-access-control": {
    title: "Insecure Direct Object Reference (IDOR)", severity: "Critical", cvss: 9.1,
    cweId: "CWE-639", owaspId: "A01:2021",
    description: "Insecure Direct Object References occur when an application uses a user-controllable value (numeric ID, UUID, filename) to access a resource without verifying the requesting user is authorised to access that specific object.",
    stepsToReproduce: "1. Authenticate as User A and capture a request containing a resource ID.\n2. Authenticate as User B in a separate session.\n3. Replay User A's request using User B's session token, replacing the ID as needed.\n4. Confirm User B can read, modify, or delete User A's resource.",
    impact: "Attackers can access, modify, or delete any other user's data by iterating or guessing object references. In severe cases this allows horizontal privilege escalation across all accounts or vertical escalation to admin-owned resources.",
    remediation: "1. Enforce server-side ownership checks on every resource access.\n2. Use indirect reference maps that map user-specific tokens to internal IDs.\n3. Implement attribute-based access control (ABAC) or RBAC consistently.\n4. Log and alert on access control failures.",
  },
  "sensitive-data-exposure": {
    title: "Sensitive Data Exposure", severity: "High", cvss: 7.5,
    cweId: "CWE-200", owaspId: "A02:2021",
    description: "The application exposes sensitive information — credentials, PII, internal configuration, or cryptographic material — to unauthorised parties through insecure transmission, weak encryption, verbose error messages, or excessive API responses.",
    stepsToReproduce: "1. Intercept API responses and examine all fields returned, including those not rendered in the UI.\n2. Review error responses for stack traces, internal paths, or configuration details.\n3. Check browser DevTools (localStorage, sessionStorage, cookies) for sensitive values.\n4. Confirm sensitive data is transmitted over HTTP or with weak TLS configuration.",
    impact: "Exposed credentials enable immediate account takeover. PII exposure creates regulatory liability (GDPR, HIPAA). Internal configuration disclosure aids further attacks.",
    remediation: "1. Encrypt all sensitive data at rest and in transit using TLS 1.2+ with strong cipher suites.\n2. Disable verbose error messages in production; log errors server-side only.\n3. Apply response filtering — return only fields the client is authorised to see.\n4. Audit data flows to ensure sensitive values are not unnecessarily logged or cached.",
  },
  "security-misconfiguration": {
    title: "Security Misconfiguration", severity: "Medium", cvss: 5.3,
    cweId: "CWE-16", owaspId: "A05:2021",
    description: "The application stack contains a security misconfiguration — default credentials, enabled debug features, overly permissive CORS policy, unnecessary services, or missing security headers — that increases the attack surface.",
    stepsToReproduce: "1. Probe the target with default credentials (admin/admin, root/root, etc.).\n2. Inspect response headers for missing security headers (HSTS, CSP, X-Frame-Options).\n3. Check for enabled debug endpoints (/debug, /actuator, /api-docs, /_/info).\n4. Test CORS by sending a request with Origin: https://evil.com and observing the response.",
    impact: "Depending on the specific misconfiguration, an attacker may gain unauthorised system access, extract sensitive data, perform cross-origin attacks, or use the weakness as a pivot point.",
    remediation: "1. Implement a repeatable hardening process across all environments.\n2. Disable all unnecessary features, accounts, services, and debug endpoints.\n3. Apply security headers: HSTS, CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy.\n4. Restrict CORS to known, trusted origins.\n5. Automate configuration scanning in CI/CD pipelines.",
  },
  "ssrf": {
    title: "Server-Side Request Forgery (SSRF)", severity: "High", cvss: 8.6,
    cweId: "CWE-918", owaspId: "A10:2021",
    description: "An SSRF vulnerability allows attackers to induce the server-side application to make HTTP requests to an arbitrary domain or IP of their choosing, including internal infrastructure not accessible from the internet.",
    stepsToReproduce: "1. Identify a parameter that accepts a URL (webhook, image fetch, file import, etc.).\n2. Submit: http://169.254.169.254/latest/meta-data/ (AWS IMDSv1)\n3. Observe whether the server returns internal data in the response.\n4. Attempt internal service discovery: http://localhost:8080, http://10.0.0.1",
    impact: "Attackers can probe internal services, read cloud metadata endpoints to extract IAM credentials (critical on AWS/GCP/Azure), access internal APIs, and potentially pivot to internal hosts.",
    remediation: "1. Validate all user-supplied URLs against a strict allowlist of permitted domains.\n2. Block requests to private IP ranges (RFC 1918), loopback, and cloud metadata endpoints.\n3. Disable HTTP redirections or validate the final destination URL after each redirect.\n4. Require IMDSv2 (token-based) on AWS EC2 to mitigate metadata theft.",
  },
  "open-redirect": {
    title: "Open Redirect", severity: "Low", cvss: 4.7,
    cweId: "CWE-601", owaspId: "A01:2021",
    description: "The application accepts a user-controlled parameter to specify a redirect destination and does not validate that the destination is within the intended domain, allowing redirection to arbitrary external URLs.",
    stepsToReproduce: "1. Identify a URL containing a redirect parameter (e.g. ?next=, ?returnUrl=, ?redirect=).\n2. Replace the value with an external URL: ?next=https://evil.com\n3. Follow the link and confirm the browser redirects to the attacker-controlled domain.\n4. Confirm the trusted domain appears in the initial URL (phishing chain intact).",
    impact: "Attackers can use the trusted domain as a springboard for phishing and credential harvesting. Victims see the legitimate domain before being redirected, lending the attack credibility.",
    remediation: "1. Avoid using user-controlled parameters for redirect destinations entirely.\n2. If redirects are necessary, validate against a server-side allowlist of permitted destinations.\n3. Reject parameters that contain absolute URLs or protocol-relative URLs (//evil.com).\n4. Show a warning interstitial page when leaving the application domain.",
  },
};

export const TEMPLATE_KEYS = Object.keys(FINDING_TEMPLATES);

    