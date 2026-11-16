/**
 * Findings library: reusable writeups for common vulnerabilities.
 *
 * Pick one in the "Add finding" form to pre-fill the title, severity, CVSS,
 * CWE, OWASP category, description, steps, impact and remediation, then edit
 * the details for your target. Severity always matches the CVSS v3.1 band of
 * the score (see severityFromCvss).
 *
 * To add a writeup, append an entry below. Keep wording generic: no client
 * names, hosts or payloads that only work on one system.
 */
import type { FindingSeverity } from "./types";

export interface FindingTemplate {
  title:            string;
  severity:         FindingSeverity;
  /** OWASP Top 10 (2021) category name, used to group the library. */
  category:         string;
  description:      string;
  stepsToReproduce: string;
  impact:           string;
  remediation:      string;
  cvss?:            number;
  cweId?:           string;
  owaspId?:         string;
}

/** CVSS v3.1 qualitative severity rating scale. */
export function severityFromCvss(score: number): FindingSeverity {
  if (score >= 9) return "Critical";
  if (score >= 7) return "High";
  if (score >= 4) return "Medium";
  if (score > 0) return "Low";
  return "Informational";
}

type Entry = Omit<FindingTemplate, "severity"> & { cvss: number };

const A01 = "A01 Broken Access Control";
const A02 = "A02 Cryptographic Failures";
const A03 = "A03 Injection";
const A04 = "A04 Insecure Design";
const A05 = "A05 Security Misconfiguration";
const A06 = "A06 Vulnerable and Outdated Components";
const A07 = "A07 Identification and Authentication Failures";
const A08 = "A08 Software and Data Integrity Failures";
const A10 = "A10 Server-Side Request Forgery";

const ENTRIES: Record<string, Entry> = {
  // ── A01 Broken Access Control ─────────────────────────────────────────────
  "broken-access-control": {
    title: "Insecure Direct Object Reference (IDOR)", category: A01, cvss: 8.1,
    cweId: "CWE-639", owaspId: "A01:2021",
    description: "The application uses a user-controllable identifier (numeric ID, UUID or filename) to fetch a resource without checking that the signed-in user is allowed to access that specific object.",
    stepsToReproduce: "1. Sign in as User A and capture a request that contains a resource ID.\n2. Sign in as User B in a separate session.\n3. Replay User A's request with User B's session.\n4. Confirm User B can read, change or delete User A's resource.",
    impact: "Any user can read or modify other users' data by changing or guessing identifiers. If administrative objects are reachable the same way, this becomes vertical privilege escalation.",
    remediation: "1. Check ownership or permission on the server for every object access.\n2. Derive the owner from the session, never from the request body or URL.\n3. Centralise authorisation checks so new endpoints cannot skip them.\n4. Log and alert on repeated authorisation failures.",
  },
  "privilege-escalation": {
    title: "Vertical Privilege Escalation", category: A01, cvss: 8.8,
    cweId: "CWE-269", owaspId: "A01:2021",
    description: "Administrative functions are protected only in the user interface. The underlying API endpoints accept requests from ordinary users.",
    stepsToReproduce: "1. As an administrator, capture a request to an admin-only endpoint.\n2. Replay the request with a standard user's session token.\n3. Confirm the action succeeds.",
    impact: "A standard user can perform administrative actions such as creating users, changing roles or reading all tenant data.",
    remediation: "1. Enforce role checks on the server for every privileged endpoint.\n2. Deny by default and grant per role.\n3. Add automated tests that call admin endpoints as a standard user and expect 403.",
  },
  "open-redirect": {
    title: "Open Redirect", category: A01, cvss: 4.7,
    cweId: "CWE-601", owaspId: "A01:2021",
    description: "A redirect parameter accepts arbitrary destinations, so a link on the trusted domain can send users to any external site.",
    stepsToReproduce: "1. Find a redirect parameter such as ?next=, ?returnUrl= or ?redirect=.\n2. Set it to an external URL, for example ?next=https://example.org\n3. Follow the link and confirm the browser lands on the external site.",
    impact: "Attackers can lend the trusted domain's credibility to phishing links and, in OAuth flows, may be able to leak authorisation codes.",
    remediation: "1. Redirect only to relative paths or to an allowlist of destinations.\n2. Reject absolute and protocol-relative URLs (//host).\n3. For OAuth, register exact redirect URIs.",
  },
  "csrf": {
    title: "Cross-Site Request Forgery (CSRF)", category: A01, cvss: 6.5,
    cweId: "CWE-352", owaspId: "A01:2021",
    description: "A state-changing request relies only on the browser's cookies for authentication and has no anti-CSRF token or SameSite protection, so another site can trigger it on the user's behalf.",
    stepsToReproduce: "1. Capture a state-changing request (for example, change email).\n2. Build an HTML page that auto-submits the same request to the target.\n3. Open the page in a browser that is signed in to the target.\n4. Confirm the change was applied.",
    impact: "An attacker can make signed-in users change their email or password, transfer funds or perform other actions without their knowledge.",
    remediation: "1. Require a per-session anti-CSRF token on all state-changing requests.\n2. Set session cookies with SameSite=Lax or Strict.\n3. Re-authenticate users for sensitive actions such as changing credentials.",
  },

  // ── A02 Cryptographic Failures ────────────────────────────────────────────
  "sensitive-data-exposure": {
    title: "Sensitive Data Exposure in API Responses", category: A02, cvss: 7.5,
    cweId: "CWE-200", owaspId: "A02:2021",
    description: "API responses include sensitive fields (credentials, tokens, personal data or internal configuration) that the client does not need and that are not shown in the interface.",
    stepsToReproduce: "1. Intercept API responses with a proxy.\n2. Compare the returned fields with what the interface displays.\n3. Note any secrets, password hashes, tokens or personal data in the raw response.",
    impact: "Exposed secrets allow account takeover or access to third-party services. Exposed personal data creates regulatory liability (for example GDPR or India's DPDP Act).",
    remediation: "1. Return only the fields each client role needs (response DTOs or field allowlists).\n2. Never send password hashes or secrets to clients.\n3. Review responses as part of code review.",
  },
  "weak-tls": {
    title: "Weak TLS Configuration", category: A02, cvss: 5.9,
    cweId: "CWE-326", owaspId: "A02:2021",
    description: "The server supports deprecated protocols (TLS 1.0/1.1) or weak cipher suites.",
    stepsToReproduce: "1. Run: nmap --script ssl-enum-ciphers -p 443 <host>\n   or testssl.sh <host>\n2. Note enabled legacy protocols and ciphers graded weak.",
    impact: "A network attacker in a privileged position may be able to downgrade or decrypt traffic.",
    remediation: "1. Allow TLS 1.2 and 1.3 only.\n2. Use AEAD cipher suites with forward secrecy.\n3. Enable HSTS once HTTPS is enforced everywhere.",
  },

  // ── A03 Injection ─────────────────────────────────────────────────────────
  "sql-injection": {
    title: "SQL Injection", category: A03, cvss: 9.8,
    cweId: "CWE-89", owaspId: "A03:2021",
    description: "User input is concatenated into a SQL query, so it is interpreted as SQL syntax rather than data.",
    stepsToReproduce: "1. Send a single quote (') in the target parameter and observe a database error or changed response.\n2. Send ' OR '1'='1 and observe extra rows.\n3. Confirm with a UNION-based or time-based payload.",
    impact: "An attacker can read, change or delete database records and, depending on the database and its privileges, run operating system commands on the database host.",
    remediation: "1. Use parameterised queries or prepared statements for every query.\n2. Validate input against expected formats.\n3. Run the application with a least-privilege database account.",
  },
  "xss-stored": {
    title: "Stored Cross-Site Scripting (XSS)", category: A03, cvss: 8.8,
    cweId: "CWE-79", owaspId: "A03:2021",
    description: "User input is stored and later rendered into pages without output encoding, so a script runs in the browser of every user who views it.",
    stepsToReproduce: "1. Find an input that is stored and shown to other users.\n2. Submit: <img src=x onerror=alert(document.domain)>\n3. Open the page that renders it and confirm the script runs.",
    impact: "Scripts run in victims' sessions: session theft, actions on their behalf, credential capture and defacement, with no further attacker interaction.",
    remediation: "1. Encode output for its context (HTML, attribute, JavaScript, URL).\n2. Sanitise rich text with a maintained allowlist sanitiser.\n3. Add a Content-Security-Policy that blocks inline scripts.\n4. Set HttpOnly on session cookies.",
  },
  "xss-reflected": {
    title: "Reflected Cross-Site Scripting (XSS)", category: A03, cvss: 6.1,
    cweId: "CWE-79", owaspId: "A03:2021",
    description: "A request parameter is echoed into the response without encoding, so a crafted link runs a script in the victim's browser.",
    stepsToReproduce: "1. Find a parameter that is reflected in the response.\n2. Request ?q=<svg onload=alert(document.domain)>\n3. Confirm the script runs and the payload is not encoded in the page source.",
    impact: "Anyone who opens the crafted link can have their session hijacked or be shown attacker-controlled content on the trusted domain.",
    remediation: "1. Encode all reflected values for their output context.\n2. Add a Content-Security-Policy that blocks inline scripts.\n3. Validate parameters against expected formats.",
  },
  "command-injection": {
    title: "OS Command Injection", category: A03, cvss: 9.8,
    cweId: "CWE-78", owaspId: "A03:2021",
    description: "User input is passed to a system shell command without escaping, so additional commands can be appended.",
    stepsToReproduce: "1. Find a feature that runs a system tool (ping, DNS lookup, file conversion).\n2. Append ;id or $(id) to the input.\n3. Confirm the command output appears, or confirm blind execution with a time delay (;sleep 5).",
    impact: "Remote code execution on the server with the privileges of the application process.",
    remediation: "1. Use library APIs instead of shelling out.\n2. If a process must be started, pass arguments as an array with no shell.\n3. Validate input against a strict allowlist.\n4. Run the service with minimal privileges.",
  },
  "path-traversal": {
    title: "Path Traversal", category: A01, cvss: 7.5,
    cweId: "CWE-22", owaspId: "A01:2021",
    description: "A file name or path from the request is joined to a base directory without normalisation, so ../ sequences reach files outside it.",
    stepsToReproduce: "1. Find a parameter that names a file (?file=report.pdf).\n2. Request ?file=../../../../etc/passwd (or ..\\..\\windows\\win.ini).\n3. Confirm the file contents are returned.",
    impact: "Attackers can read configuration files, source code and credentials stored on the server.",
    remediation: "1. Map user choices to server-side IDs instead of accepting paths.\n2. Resolve the final path and verify it is inside the allowed directory.\n3. Run the service with read access only to what it needs.",
  },
  "xxe": {
    title: "XML External Entity (XXE) Injection", category: A05, cvss: 8.2,
    cweId: "CWE-611", owaspId: "A05:2021",
    description: "The XML parser resolves external entities in user-supplied XML.",
    stepsToReproduce: "1. Find an endpoint that accepts XML (or SVG/DOCX uploads).\n2. Send a document with <!DOCTYPE x [<!ENTITY e SYSTEM \"file:///etc/hostname\">]> and reference &e; in a field.\n3. Confirm the file contents appear in the response, or use an out-of-band entity for blind XXE.",
    impact: "File disclosure from the server, SSRF to internal services and, with some parsers, denial of service.",
    remediation: "1. Disable DTDs and external entity resolution in the XML parser.\n2. Prefer JSON where possible.\n3. Keep XML libraries up to date.",
  },

  // ── A04 Insecure Design ───────────────────────────────────────────────────
  "missing-rate-limit": {
    title: "Missing Rate Limiting on Authentication", category: A07, cvss: 5.3,
    cweId: "CWE-307", owaspId: "A07:2021",
    description: "The login, OTP or password reset endpoint accepts unlimited attempts with no throttling, lockout or CAPTCHA.",
    stepsToReproduce: "1. Send 100+ failed login attempts for one account within a minute (for example with Burp Intruder).\n2. Confirm no 429 responses, delays or lockout occur.",
    impact: "Credential stuffing and brute force attacks become practical, and OTP codes can be guessed.",
    remediation: "1. Rate limit per account and per IP with increasing delays.\n2. Lock or challenge after repeated failures.\n3. Expire OTPs after a few attempts.",
  },
  "mass-assignment": {
    title: "Mass Assignment", category: A08, cvss: 8.1,
    cweId: "CWE-915", owaspId: "A08:2021",
    description: "The API binds request JSON directly to a data model, so clients can set fields they should not control, such as role or isAdmin.",
    stepsToReproduce: "1. Capture a profile update request.\n2. Add \"role\":\"admin\" (or a similar privileged field) to the body.\n3. Confirm the field was saved.",
    impact: "Users can grant themselves privileges or change protected attributes such as account balance or verification status.",
    remediation: "1. Bind only an explicit allowlist of writable fields.\n2. Use separate input and storage models.\n3. Reject unknown fields.",
  },

  // ── A05 Security Misconfiguration ─────────────────────────────────────────
  "security-misconfiguration": {
    title: "Exposed Debug or Admin Interface", category: A05, cvss: 5.3,
    cweId: "CWE-16", owaspId: "A05:2021",
    description: "A debug, monitoring or administrative interface (for example /actuator, /debug or a database console) is reachable from the internet.",
    stepsToReproduce: "1. Browse or brute force common paths (/actuator, /debug, /admin, /api-docs).\n2. Confirm the interface responds without authentication.",
    impact: "Depending on the interface, attackers can read configuration and secrets, dump memory or change application state.",
    remediation: "1. Disable debug features in production.\n2. Restrict admin interfaces to internal networks or VPN.\n3. Require authentication on all management endpoints.",
  },
  "cors-misconfiguration": {
    title: "Permissive CORS Policy", category: A05, cvss: 6.5,
    cweId: "CWE-942", owaspId: "A05:2021",
    description: "The API reflects any Origin in Access-Control-Allow-Origin and also sends Access-Control-Allow-Credentials: true.",
    stepsToReproduce: "1. Send an authenticated request with Origin: https://example.org\n2. Confirm the response echoes that origin and allows credentials.",
    impact: "Any website a signed-in user visits can read their data from the API.",
    remediation: "1. Allow only a fixed list of trusted origins.\n2. Never combine a wildcard or reflected origin with credentials.",
  },
  "missing-security-headers": {
    title: "Missing HTTP Security Headers", category: A05, cvss: 3.1,
    cweId: "CWE-693", owaspId: "A05:2021",
    description: "Responses do not set headers such as Strict-Transport-Security, Content-Security-Policy, X-Content-Type-Options and Referrer-Policy.",
    stepsToReproduce: "1. Run: curl -sI https://<host>\n2. Note which security headers are absent.",
    impact: "The browser's built-in defences against downgrade, MIME sniffing, framing and script injection are not enabled.",
    remediation: "Set Strict-Transport-Security, a Content-Security-Policy, X-Content-Type-Options: nosniff, Referrer-Policy and frame-ancestors (or X-Frame-Options) at the web server or CDN.",
  },
  "clickjacking": {
    title: "Clickjacking", category: A05, cvss: 4.3,
    cweId: "CWE-1021", owaspId: "A05:2021",
    description: "Sensitive pages can be loaded inside an iframe on another site.",
    stepsToReproduce: "1. Create a page containing <iframe src=\"https://<host>/settings\">.\n2. Confirm the page renders inside the frame.",
    impact: "Users can be tricked into clicking hidden buttons, for example to change settings or approve actions.",
    remediation: "Send Content-Security-Policy: frame-ancestors 'self' (and X-Frame-Options: DENY for older browsers).",
  },
  "verbose-errors": {
    title: "Verbose Error Messages", category: A05, cvss: 5.3,
    cweId: "CWE-209", owaspId: "A05:2021",
    description: "Unhandled errors return stack traces, framework versions, file paths or SQL statements.",
    stepsToReproduce: "1. Send malformed input (invalid JSON, wrong types, very long strings).\n2. Inspect the error response.",
    impact: "Attackers learn the technology stack and internal structure, which speeds up further attacks.",
    remediation: "Return generic error messages in production and log details on the server only.",
  },
  "subdomain-takeover": {
    title: "Subdomain Takeover", category: A05, cvss: 8.2,
    cweId: "CWE-350", owaspId: "A05:2021",
    description: "A DNS record (usually a CNAME) points to a third-party service resource that no longer exists and can be claimed by anyone.",
    stepsToReproduce: "1. Enumerate subdomains and resolve their CNAMEs.\n2. Find one pointing to an unclaimed resource (for example an S3 bucket or GitHub Pages site).\n3. Confirm the provider's 'not found' fingerprint. Claim it only if in scope.",
    impact: "An attacker can serve content on the organisation's domain: phishing, cookie theft for parent-domain cookies and bypass of CSP or CORS allowlists.",
    remediation: "1. Remove DNS records when deprovisioning services.\n2. Monitor DNS for dangling records.",
  },

  // ── A06 Vulnerable and Outdated Components ────────────────────────────────
  "outdated-components": {
    title: "Outdated Component with Known Vulnerabilities", category: A06, cvss: 7.5,
    cweId: "CWE-1104", owaspId: "A06:2021",
    description: "The application uses a library, framework or server version with published vulnerabilities (CVEs).",
    stepsToReproduce: "1. Identify the component and version (headers, banners, JavaScript files or dependency manifests).\n2. Match it against public advisories (NVD, GitHub Security Advisories).\n3. Confirm the vulnerable code path is reachable where possible.",
    impact: "Depends on the CVE; ranges from information disclosure to remote code execution.",
    remediation: "1. Upgrade to a supported, patched version.\n2. Track dependencies with automated alerts (for example Dependabot).\n3. Remove unused components.",
  },

  // ── A07 Identification and Authentication Failures ────────────────────────
  "weak-password-policy": {
    title: "Weak Password Policy", category: A07, cvss: 5.3,
    cweId: "CWE-521", owaspId: "A07:2021",
    description: "Accounts can be created with short or common passwords such as 123456 or password.",
    stepsToReproduce: "1. Register or change a password to a short or common value.\n2. Confirm it is accepted.",
    impact: "Accounts are easy to compromise through guessing and credential stuffing.",
    remediation: "1. Require at least 8 characters (NIST SP 800-63B) and check against a breached-password list.\n2. Offer multi-factor authentication.",
  },
  "jwt-validation": {
    title: "JWT Signature Not Verified", category: A07, cvss: 9.1,
    cweId: "CWE-347", owaspId: "A07:2021",
    description: "The API accepts JSON Web Tokens with alg set to none, signed with a guessable secret, or with the algorithm switched from RS256 to HS256.",
    stepsToReproduce: "1. Decode a valid token.\n2. Change the payload (for example the sub or role claim) and set alg to none, or re-sign with a common secret.\n3. Send the forged token and confirm it is accepted.",
    impact: "Attackers can forge tokens for any user, including administrators.",
    remediation: "1. Pin the expected algorithm in the verifier.\n2. Use long random secrets or asymmetric keys.\n3. Validate exp, iss and aud claims.",
  },
  "cookie-flags": {
    title: "Session Cookie Missing Security Flags", category: A07, cvss: 4.3,
    cweId: "CWE-614", owaspId: "A07:2021",
    description: "The session cookie is set without Secure, HttpOnly or SameSite.",
    stepsToReproduce: "1. Sign in and inspect the Set-Cookie header.\n2. Note which flags are missing.",
    impact: "The session can leak over plain HTTP, be read by injected scripts, or be sent on cross-site requests.",
    remediation: "Set Secure, HttpOnly and SameSite=Lax (or Strict) on session cookies.",
  },

  // ── A08 Software and Data Integrity Failures ──────────────────────────────
  "insecure-deserialization": {
    title: "Insecure Deserialization", category: A08, cvss: 9.8,
    cweId: "CWE-502", owaspId: "A08:2021",
    description: "The application deserialises untrusted data with a format that can instantiate arbitrary types (Java serialization, .NET BinaryFormatter, Python pickle, PHP unserialize).",
    stepsToReproduce: "1. Find serialised data in cookies, parameters or request bodies.\n2. Replace it with a gadget-chain payload (for example from ysoserial) that triggers an out-of-band callback.\n3. Confirm the callback.",
    impact: "Remote code execution on the server.",
    remediation: "1. Do not deserialise untrusted data with native serialisers.\n2. Use data-only formats such as JSON with strict schemas.\n3. Sign serialised data that must round-trip through clients.",
  },
  "unrestricted-file-upload": {
    title: "Unrestricted File Upload", category: A04, cvss: 8.8,
    cweId: "CWE-434", owaspId: "A04:2021",
    description: "The upload feature accepts any file type and stores it where it can be executed or served from the application's origin.",
    stepsToReproduce: "1. Upload a file with a server-side script extension (.php, .jsp, .aspx) or an HTML/SVG file containing script.\n2. Browse to the uploaded file and confirm it executes or renders.",
    impact: "Remote code execution on the server, or stored XSS on the application's origin.",
    remediation: "1. Allowlist extensions and check content type and magic bytes.\n2. Store uploads outside the web root or on a separate domain.\n3. Rename files and serve them with Content-Disposition: attachment.",
  },

  // ── A10 Server-Side Request Forgery ───────────────────────────────────────
  "ssrf": {
    title: "Server-Side Request Forgery (SSRF)", category: A10, cvss: 8.6,
    cweId: "CWE-918", owaspId: "A10:2021",
    description: "A URL supplied by the user is fetched by the server, including internal addresses that are not reachable from the internet.",
    stepsToReproduce: "1. Find a feature that fetches a URL (webhooks, image import, PDF rendering).\n2. Submit http://169.254.169.254/latest/meta-data/ or http://127.0.0.1:<port>/\n3. Confirm internal data in the response, or an out-of-band callback for blind SSRF.",
    impact: "Attackers can reach internal services and cloud metadata endpoints, often obtaining cloud credentials.",
    remediation: "1. Allowlist destination hosts.\n2. Block private, loopback and link-local ranges after DNS resolution.\n3. Require IMDSv2 on AWS.\n4. Do not follow redirects, or re-check each hop.",
  },
};

export const FINDING_TEMPLATES: Record<string, FindingTemplate> = Object.fromEntries(
  Object.entries(ENTRIES).map(([key, e]) => [key, { ...e, severity: severityFromCvss(e.cvss) }]),
);

export const TEMPLATE_KEYS = Object.keys(FINDING_TEMPLATES);

/** Library grouped by OWASP category, in category order. */
export function groupedTemplates(): { category: string; items: [string, FindingTemplate][] }[] {
  const groups = new Map<string, [string, FindingTemplate][]>();
  for (const entry of Object.entries(FINDING_TEMPLATES)) {
    const list = groups.get(entry[1].category) ?? [];
    list.push(entry);
    groups.set(entry[1].category, list);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([category, items]) => ({ category, items }));
}
