/**
 * Single-pass tokenizer for log lines.
 *
 * Returns plain text segments with a token type. The log viewer renders them
 * as React elements, so log content is never interpreted as HTML (logs often
 * come from systems an attacker controls).
 */

export type LogTokenType =
  | "timestamp" | "ip" | "string" | "method"
  | "status2xx" | "status3xx" | "status4xx" | "status5xx"
  | "error" | "warning" | "path" | "kv" | "text";

export interface LogToken {
  type: LogTokenType;
  text: string;
}

// Order matters: at any position the first alternative that matches wins.
const TOKEN_RE = new RegExp(
  [
    String.raw`(?<timestamp>\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)`,
    String.raw`(?<ip>\b\d{1,3}(?:\.\d{1,3}){3}(?::\d+)?\b)`,
    String.raw`(?<string>"[^"\n]{0,120}")`,
    String.raw`(?<method>\b(?:GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS|CONNECT|TRACE)\b)`,
    // A status code follows the quoted request line (access logs) or an
    // HTTP version (response lines), so byte counts like 512 are not colored.
    String.raw`(?<status>(?<=" |HTTP\/\d(?:\.\d)? )[2-5]\d{2}\b)`,
    String.raw`(?<error>\b(?:error|fail(?:ed|ure)?|denied|critical|fatal|exception)\b)`,
    String.raw`(?<warning>\b(?:warn(?:ing)?|deprecated|notice)\b)`,
    String.raw`(?<path>\/[A-Za-z0-9_.~!*'();:@&=+$,/?#\[\]%-]{2,})`,
    String.raw`(?<kv>\b[A-Za-z_][A-Za-z0-9_]*=[^\s,}]+)`,
  ].join("|"),
  "gi",
);

export function tokenizeLogLine(line: string): LogToken[] {
  const out: LogToken[] = [];
  let last = 0;
  const push = (type: LogTokenType, text: string) => {
    if (!text) return;
    const prev = out[out.length - 1];
    if (type === "text" && prev?.type === "text") prev.text += text;
    else out.push({ type, text });
  };

  for (const m of line.matchAll(TOKEN_RE)) {
    const start = m.index ?? 0;
    push("text", line.slice(last, start));
    const g = m.groups ?? {};
    const text = m[0];
    let type: LogTokenType = "text";
    if (g.timestamp) type = "timestamp";
    else if (g.ip) type = "ip";
    else if (g.string) type = "string";
    // Methods only count in upper case ("get" in prose is just a word).
    else if (g.method) type = text === text.toUpperCase() ? "method" : "text";
    else if (g.status) type = `status${text[0]}xx` as LogTokenType;
    else if (g.error) type = "error";
    else if (g.warning) type = "warning";
    else if (g.path) type = "path";
    else if (g.kv) type = "kv";
    push(type, text);
    last = start + text.length;
  }
  push("text", line.slice(last));
  return out;
}

/** Split text around case-insensitive matches of `search` (no regex from user input). */
export function splitBySearch(text: string, search: string): { text: string; match: boolean }[] {
  const q = search.trim().toLowerCase();
  if (!q) return [{ text, match: false }];
  const parts: { text: string; match: boolean }[] = [];
  const lower = text.toLowerCase();
  let i = 0;
  while (i < text.length) {
    const hit = lower.indexOf(q, i);
    if (hit === -1) { parts.push({ text: text.slice(i), match: false }); break; }
    if (hit > i) parts.push({ text: text.slice(i, hit), match: false });
    parts.push({ text: text.slice(hit, hit + q.length), match: true });
    i = hit + q.length;
  }
  return parts;
}
