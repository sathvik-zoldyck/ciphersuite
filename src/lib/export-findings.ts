/**
 * Export findings as CSV (for spreadsheets and ticketing imports) or JSON
 * (for backups and other tools). Runs entirely in the browser.
 */
import type { Finding } from "./types";

const CSV_COLUMNS: { header: string; get: (f: Finding) => unknown }[] = [
  { header: "Title",              get: (f) => f.title },
  { header: "Severity",           get: (f) => f.severity },
  { header: "Status",             get: (f) => f.status },
  { header: "CVSS",               get: (f) => f.cvss },
  { header: "CVSS vector",        get: (f) => f.cvssVector },
  { header: "CWE",                get: (f) => f.cweId },
  { header: "OWASP",              get: (f) => f.owaspId },
  { header: "Target",             get: (f) => f.target },
  { header: "Description",        get: (f) => f.description },
  { header: "Steps to reproduce", get: (f) => f.stepsToReproduce },
  { header: "Impact",             get: (f) => f.impact },
  { header: "Remediation",        get: (f) => f.remediation },
  { header: "Created",            get: (f) => toIso(f.createdAt) },
  { header: "Updated",            get: (f) => toIso(f.updatedAt) },
];

function toIso(value: unknown): string {
  if (!value) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  // Firestore Timestamp
  const ts = value as { toDate?: () => Date; seconds?: number };
  if (typeof ts.toDate === "function") return ts.toDate().toISOString();
  if (typeof ts.seconds === "number") return new Date(ts.seconds * 1000).toISOString();
  return "";
}

/**
 * One CSV cell. Quotes per RFC 4180 and neutralises spreadsheet formula
 * injection (CWE-1236): text starting with = + - @ tab or CR is prefixed
 * with an apostrophe so Excel and Sheets treat it as text, not a formula.
 */
export function csvCell(value: unknown): string {
  if (value === undefined || value === null) return "";
  let s = String(value);
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\r\n]/.test(s) || s !== s.trim() ? `"${s.replace(/"/g, '""')}"` : s;
}

export function findingsToCsv(findings: Finding[]): string {
  const rows = [CSV_COLUMNS.map((c) => csvCell(c.header)).join(",")];
  for (const f of findings) rows.push(CSV_COLUMNS.map((c) => csvCell(c.get(f))).join(","));
  // BOM so Excel opens UTF-8 correctly; CRLF line endings per RFC 4180.
  return "﻿" + rows.join("\r\n") + "\r\n";
}

export function findingsToJson(projectName: string, findings: Finding[]): string {
  return JSON.stringify(
    {
      format: "ciphersuite.findings",
      version: 1,
      exportedAt: new Date().toISOString(),
      project: projectName,
      findings: findings.map((f) => ({
        ...f,
        createdAt: toIso(f.createdAt),
        updatedAt: toIso(f.updatedAt),
      })),
    },
    null,
    2,
  );
}

/** Safe file name stem from a project name. */
export function exportFileStem(projectName: string): string {
  const stem = projectName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return `${stem || "project"}-findings-${new Date().toISOString().slice(0, 10)}`;
}

export function downloadText(fileName: string, text: string, mime: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
