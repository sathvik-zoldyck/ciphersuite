import { test } from "node:test";
import assert from "node:assert/strict";
import { splitBySearch, tokenizeLogLine } from "../log-tokens";

const join = (line: string) => tokenizeLogLine(line).map((t) => t.text).join("");
const types = (line: string) => tokenizeLogLine(line).filter((t) => t.type !== "text").map((t) => `${t.type}:${t.text}`);

test("tokens always reassemble to the original line", () => {
  const lines = [
    '203.0.113.7 - - [12/Nov/2026:10:14:02 +0000] "GET /api/v2/orders?q=1%27 HTTP/1.1" 200 48211',
    "2026-11-12T10:15:44Z ERROR auth failed for user=admin from 198.51.100.23:5222",
    "",
    "plain text with no tokens",
  ];
  for (const l of lines) assert.equal(join(l), l);
});

test("HTML in a log line stays text (no markup is produced)", () => {
  const evil = '<img src=x onerror="alert(document.cookie)"><script>alert(1)</script>';
  const tokens = tokenizeLogLine(evil);
  assert.equal(tokens.map((t) => t.text).join(""), evil);
  // The tokenizer only returns strings; nothing contains generated markup.
  assert.ok(tokens.every((t) => !t.text.includes("class=")));
});

test("recognises common access-log parts", () => {
  const t = types('203.0.113.7 "GET /api/v2/orders HTTP/1.1" 404 512');
  assert.deepEqual(t, ["ip:203.0.113.7", 'string:"GET /api/v2/orders HTTP/1.1"', "status4xx:404"]);
});

test("status codes after an HTTP version are recognised; bare numbers are not", () => {
  assert.deepEqual(types("HTTP/1.1 503 Service Unavailable"), ["path:/1.1", "status5xx:503"]);
  assert.deepEqual(types("took 250 ms"), []);
});

test("recognises timestamps, levels, methods and key=value", () => {
  const t = types("2026-11-12 10:15:44 WARNING POST /login user=alice");
  assert.deepEqual(t, [
    "timestamp:2026-11-12 10:15:44", "warning:WARNING", "method:POST", "path:/login", "kv:user=alice",
  ]);
});

test("lower-case words that look like methods are not highlighted", () => {
  assert.deepEqual(types("we get the token"), []);
});

test("splitBySearch matches case-insensitively and treats input literally", () => {
  assert.deepEqual(splitBySearch("Error at ERROR", "error"), [
    { text: "Error", match: true }, { text: " at ", match: false }, { text: "ERROR", match: true },
  ]);
  assert.deepEqual(splitBySearch("a.b", ".*"), [{ text: "a.b", match: false }]);
  assert.deepEqual(splitBySearch("abc", ""), [{ text: "abc", match: false }]);
});
