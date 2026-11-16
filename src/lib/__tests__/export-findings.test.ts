import { test } from "node:test";
import assert from "node:assert/strict";
import { csvCell, exportFileStem, findingsToCsv, findingsToJson } from "../export-findings";
import type { Finding } from "../types";

const finding = (over: Partial<Finding> = {}): Finding => ({
  id: "f1", projectId: "p1", title: "SQL injection", severity: "Critical", status: "Open",
  description: "Line one\nline two", stepsToReproduce: "1. Send ' OR 1=1", impact: "Data loss",
  remediation: "Use \"prepared\" statements", cvss: 9.8, cweId: "CWE-89",
  createdAt: new Date("2026-11-01T10:00:00Z"), updatedAt: new Date("2026-11-02T10:00:00Z"),
  ...over,
} as Finding);

test("csvCell quotes commas, quotes and newlines", () => {
  assert.equal(csvCell("plain"), "plain");
  assert.equal(csvCell("a,b"), '"a,b"');
  assert.equal(csvCell('say "hi"'), '"say ""hi"""');
  assert.equal(csvCell("a\nb"), '"a\nb"');
  assert.equal(csvCell(undefined), "");
  assert.equal(csvCell(9.8), "9.8");
});

test("csvCell neutralises spreadsheet formula injection", () => {
  assert.equal(csvCell("=HYPERLINK(\"http://x\")"), '"\'=HYPERLINK(""http://x"")"');
  assert.equal(csvCell("+1+1"), "'+1+1");
  assert.equal(csvCell("-2"), "'-2");
  assert.equal(csvCell("@SUM(A1)"), "'@SUM(A1)");
  // Numbers are not strings, so a negative number stays a number.
  assert.equal(csvCell(-2), "-2");
});

test("findingsToCsv writes a header and one row per finding", () => {
  const csv = findingsToCsv([finding(), finding({ id: "f2", title: "XSS" })]);
  assert.ok(csv.startsWith("﻿Title,Severity,Status,CVSS"));
  const lines = csv.slice(1).split("\r\n").filter(Boolean);
  // header + 2 findings; the description's newline stays inside quotes
  assert.equal(csv.match(/\r\n/g)?.length, 3);
  assert.ok(lines[1].startsWith("SQL injection,Critical,Open,9.8"));
  assert.ok(csv.includes("2026-11-01T10:00:00.000Z"));
});

test("findingsToJson is versioned and serialises dates", () => {
  const parsed = JSON.parse(findingsToJson("Acme", [finding()]));
  assert.equal(parsed.format, "ciphersuite.findings");
  assert.equal(parsed.version, 1);
  assert.equal(parsed.project, "Acme");
  assert.equal(parsed.findings[0].createdAt, "2026-11-01T10:00:00.000Z");
});

test("exportFileStem makes a safe file name", () => {
  assert.match(exportFileStem("Acme Corp / Web App!"), /^acme-corp-web-app-findings-\d{4}-\d{2}-\d{2}$/);
  assert.match(exportFileStem("***"), /^project-findings-/);
});
