/**
 * CVSS v3.1 base score calculator.
 *
 * Implements the base-score equations from the FIRST CVSS v3.1
 * specification (section 7.1) including the spec's Roundup function.
 * https://www.first.org/cvss/v3.1/specification-document
 */

export type MetricKey = "AV" | "AC" | "PR" | "UI" | "S" | "C" | "I" | "A";
export type CvssVector = Record<MetricKey, string>;

export interface MetricDef {
  key:     MetricKey;
  label:   string;
  options: { value: string; label: string }[];
}

/** Base metrics in the order the vector string lists them. */
export const CVSS_METRICS: MetricDef[] = [
  { key: "AV", label: "Attack vector", options: [
    { value: "N", label: "Network" }, { value: "A", label: "Adjacent" },
    { value: "L", label: "Local" },   { value: "P", label: "Physical" },
  ] },
  { key: "AC", label: "Attack complexity", options: [
    { value: "L", label: "Low" }, { value: "H", label: "High" },
  ] },
  { key: "PR", label: "Privileges required", options: [
    { value: "N", label: "None" }, { value: "L", label: "Low" }, { value: "H", label: "High" },
  ] },
  { key: "UI", label: "User interaction", options: [
    { value: "N", label: "None" }, { value: "R", label: "Required" },
  ] },
  { key: "S", label: "Scope", options: [
    { value: "U", label: "Unchanged" }, { value: "C", label: "Changed" },
  ] },
  { key: "C", label: "Confidentiality", options: [
    { value: "H", label: "High" }, { value: "L", label: "Low" }, { value: "N", label: "None" },
  ] },
  { key: "I", label: "Integrity", options: [
    { value: "H", label: "High" }, { value: "L", label: "Low" }, { value: "N", label: "None" },
  ] },
  { key: "A", label: "Availability", options: [
    { value: "H", label: "High" }, { value: "L", label: "Low" }, { value: "N", label: "None" },
  ] },
];

const KEYS = CVSS_METRICS.map((m) => m.key);

const W = {
  AV: { N: 0.85, A: 0.62, L: 0.55, P: 0.2 } as Record<string, number>,
  AC: { L: 0.77, H: 0.44 } as Record<string, number>,
  UI: { N: 0.85, R: 0.62 } as Record<string, number>,
  CIA: { H: 0.56, L: 0.22, N: 0 } as Record<string, number>,
};

function privilegesRequired(pr: string, scopeChanged: boolean): number {
  if (pr === "N") return 0.85;
  if (pr === "L") return scopeChanged ? 0.68 : 0.62;
  return scopeChanged ? 0.5 : 0.27; // H
}

/** Roundup as defined in CVSS v3.1 Appendix A (avoids floating-point drift). */
export function roundUp(value: number): number {
  const intInput = Math.round(value * 100000);
  if (intInput % 10000 === 0) return intInput / 100000;
  return (Math.floor(intInput / 10000) + 1) / 10;
}

/** Base score (0.0 to 10.0) for a complete vector. */
export function baseScore(v: CvssVector): number {
  const scopeChanged = v.S === "C";
  const iss = 1 - (1 - W.CIA[v.C]) * (1 - W.CIA[v.I]) * (1 - W.CIA[v.A]);
  const impact = scopeChanged
    ? 7.52 * (iss - 0.029) - 3.25 * Math.pow(iss - 0.02, 15)
    : 6.42 * iss;
  const exploitability = 8.22 * W.AV[v.AV] * W.AC[v.AC] * privilegesRequired(v.PR, scopeChanged) * W.UI[v.UI];
  if (impact <= 0) return 0;
  return scopeChanged
    ? roundUp(Math.min(1.08 * (impact + exploitability), 10))
    : roundUp(Math.min(impact + exploitability, 10));
}

/** Parse "CVSS:3.1/AV:N/AC:L/..." (the CVSS:3.x prefix is optional). Returns null if incomplete or invalid. */
export function parseVector(input: string): CvssVector | null {
  const parts = input.trim().replace(/^CVSS:3\.[01]\//i, "").split("/").filter(Boolean);
  const out: Partial<CvssVector> = {};
  for (const part of parts) {
    const [k, val] = part.split(":");
    const def = CVSS_METRICS.find((m) => m.key === k?.toUpperCase());
    if (!def || !def.options.some((o) => o.value === val?.toUpperCase())) return null;
    out[def.key] = val.toUpperCase();
  }
  return KEYS.every((k) => out[k]) ? (out as CvssVector) : null;
}

export function formatVector(v: CvssVector): string {
  return "CVSS:3.1/" + KEYS.map((k) => `${k}:${v[k]}`).join("/");
}

export const DEFAULT_VECTOR: CvssVector = { AV: "N", AC: "L", PR: "N", UI: "N", S: "U", C: "N", I: "N", A: "N" };
