import { test } from "node:test";
import assert from "node:assert/strict";
import { baseScore, formatVector, parseVector, roundUp } from "../cvss";
import { severityFromCvss } from "../finding-library";

// Expected scores checked against the FIRST CVSS v3.1 calculator.
const CASES: [string, number][] = [
  ["CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H", 9.8],
  ["CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:H", 10.0],
  ["CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:C/C:L/I:L/A:N", 6.1],
  ["CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:N", 8.1],
  ["CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N", 7.5],
  ["CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:N/A:N", 5.3],
  ["CVSS:3.1/AV:L/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:H", 7.8],
  ["CVSS:3.1/AV:P/AC:H/PR:H/UI:R/S:U/C:L/I:N/A:N", 1.6],
  ["CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:N", 0],
];

for (const [vector, expected] of CASES) {
  test(`base score ${vector} = ${expected}`, () => {
    const v = parseVector(vector);
    assert.ok(v, "vector should parse");
    assert.equal(baseScore(v), expected);
  });
}

test("parseVector accepts vectors without the CVSS:3.1 prefix", () => {
  assert.ok(parseVector("AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H"));
});

test("parseVector rejects incomplete or invalid vectors", () => {
  assert.equal(parseVector("CVSS:3.1/AV:N/AC:L"), null);
  assert.equal(parseVector("CVSS:3.1/AV:X/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H"), null);
  assert.equal(parseVector("not a vector"), null);
});

test("formatVector round-trips", () => {
  const s = "CVSS:3.1/AV:A/AC:H/PR:L/UI:R/S:C/C:L/I:H/A:N";
  assert.equal(formatVector(parseVector(s)!), s);
});

test("roundUp follows the spec, not naive ceil", () => {
  assert.equal(roundUp(4.0), 4.0);
  assert.equal(roundUp(4.02), 4.1);
  assert.equal(roundUp(4.000001), 4.0);
});

test("severityFromCvss uses the v3.1 rating bands", () => {
  assert.equal(severityFromCvss(9.0), "Critical");
  assert.equal(severityFromCvss(8.9), "High");
  assert.equal(severityFromCvss(7.0), "High");
  assert.equal(severityFromCvss(6.9), "Medium");
  assert.equal(severityFromCvss(4.0), "Medium");
  assert.equal(severityFromCvss(3.9), "Low");
  assert.equal(severityFromCvss(0), "Informational");
});
