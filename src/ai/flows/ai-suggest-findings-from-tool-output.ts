'use server';
/**
 * @fileOverview Genkit flow that parses raw security tool output and extracts
 * structured, report-ready vulnerability findings.
 *
 * Supports Nmap, Nessus, Burp Suite, Nikto, Nuclei, OpenVAS, Metasploit,
 * and generic/unknown tool output.
 *
 * Exports:
 *   aiAnalyzeToolOutput(input)    — callable server action
 *   AiAnalyzeToolOutputInput      — input type
 *   AiAnalyzeToolOutputOutput     — output type
 *   SuggestedFinding              — type for a single extracted finding
 */

import { ai } from '@/ai/genkit';
import { z }  from 'genkit';
import { SUPPORTED_TOOLS, type ToolType } from '@/lib/types';

// ─── Input schema ─────────────────────────────────────────────────────────────

const InputSchema = z.object({
  toolType: z
    .enum(SUPPORTED_TOOLS)
    .describe('The tool that produced the output. Used to apply tool-specific parsing heuristics.'),

  toolOutput: z
    .string()
    .min(20, 'Tool output must be at least 20 characters')
    .describe(
      'Raw output from the security tool. Can be XML, JSON, plain text, or any native format. ' +
      'Paste the full output — do not truncate or summarise.'
    ),

  target: z
    .string()
    .optional()
    .describe(
      'The host, IP, URL, or scope being tested. Helps the AI contextualise targets extracted from output. ' +
      'e.g. "192.168.1.0/24", "https://app.example.com"'
    ),

  context: z
    .string()
    .optional()
    .describe(
      'Optional engagement context: environment (prod/dev), industry, compliance scope, known tech stack. ' +
      'e.g. "External pentest, PCI-DSS scope, Nginx 1.18 on Ubuntu 22.04"'
    ),

  maxFindings: z
    .number()
    .int()
    .min(1)
    .max(30)
    .default(15)
    .describe(
      'Maximum number of findings to extract. Use lower values for focused review, ' +
      'higher values for comprehensive Nessus/OpenVAS exports.'
    ),
});

export type AiAnalyzeToolOutputInput = z.infer<typeof InputSchema>;

// ─── Per-finding schema ───────────────────────────────────────────────────────

const SuggestedFindingSchema = z.object({
  title: z
    .string()
    .describe(
      'Professional vulnerability title following the pattern "[Class] in [Component]". ' +
      'e.g. "SSH Weak Cipher Suites Enabled", "Open Redirect in Login Flow"'
    ),

  severity: z
    .enum(['Critical', 'High', 'Medium', 'Low', 'Informational'])
    .describe('CVSS v3.1-aligned severity. Map tool-native ratings to this scale where possible.'),

  cvss: z
    .number()
    .min(0)
    .max(10)
    .optional()
    .describe(
      'CVSS v3.1 base score if the tool provides it, or a reasoned estimate. ' +
      'Omit if there is insufficient information to estimate.'
    ),

  target: z
    .string()
    .describe(
      'The specific affected host, port, endpoint, or component extracted from the tool output. ' +
      'e.g. "192.168.1.5:22", "tcp/443 – Apache 2.4.49", "POST /api/login"'
    ),

  description: z
    .string()
    .describe(
      'Technical description of the vulnerability: what it is, where it exists, and why it is a problem. ' +
      'Include version numbers, service banners, or plugin IDs from the tool output where present.'
    ),

  stepsToReproduce: z
    .string()
    .describe(
      'How to verify or reproduce the finding. For network findings: tool command and expected output. ' +
      'For web findings: request/response or manual verification steps. ' +
      'Format as a numbered list.'
    ),

  impact: z
    .string()
    .describe(
      'Concrete exploitation consequences: what an attacker can achieve, what data is at risk, ' +
      'CIA triad implications. Be specific — avoid generic filler.'
    ),

  remediation: z
    .string()
    .describe(
      'Prioritised remediation steps. Primary fix first, then supporting controls. ' +
      'Include version upgrade targets, specific config changes, or commands where possible. ' +
      'Format as a numbered list.'
    ),

  cweId: z
    .string()
    .optional()
    .describe('Most specific applicable CWE. Format: "CWE-{number}". Omit if genuinely uncertain.'),

  owaspId: z
    .string()
    .optional()
    .describe(
      'OWASP Top 10 2021 category if applicable. ' +
      'One of: A01–A10 with ":2021" suffix. Omit for non-web findings where OWASP does not apply.'
    ),

  pluginId: z
    .string()
    .optional()
    .describe(
      'Tool-native identifier for cross-reference: Nessus plugin ID, Nuclei template ID, CVE, etc. ' +
      'Extract directly from the tool output — do not invent.'
    ),

  cve: z
    .string()
    .optional()
    .describe('CVE identifier if referenced in the tool output. Format: "CVE-YYYY-NNNNN".'),

  confidence: z
    .enum(['High', 'Medium', 'Low'])
    .describe(
      'Confidence that this is a genuine, exploitable finding. ' +
      'High: tool confirmed with proof. Medium: tool flagged but may need manual verification. ' +
      'Low: informational or potential false positive — flag for review.'
    ),
});

export type SuggestedFinding = z.infer<typeof SuggestedFindingSchema>;

// ─── Output schema ────────────────────────────────────────────────────────────

const OutputSchema = z.object({
  findings: z
    .array(SuggestedFindingSchema)
    .describe('Extracted findings, ordered Critical → Informational. Empty array if nothing significant found.'),

  toolSummary: z
    .string()
    .describe(
      'Brief summary of what the tool scanned, what was found overall, and any notable context. ' +
      '2–3 sentences. e.g. "Nmap scanned 254 hosts. 3 hosts had exposed RDP. SSH version enumeration identified 2 outdated daemons."'
    ),

  falsePositiveWarnings: z
    .array(z.string())
    .optional()
    .describe(
      'List of plugin IDs or finding titles that may be false positives based on tool output patterns, ' +
      'common scanner noise, or context. Omit if no false positive concerns.'
    ),

  scanCoverage: z
    .enum(['Full', 'Partial', 'Unknown'])
    .describe(
      'Assessment of whether the tool output appears complete. ' +
      'Full: all hosts/paths scanned. Partial: output appears truncated or incomplete. Unknown: cannot determine.'
    ),
});

export type AiAnalyzeToolOutputOutput = z.infer<typeof OutputSchema>;

// ─── Tool-specific parsing guidance ──────────────────────────────────────────

const TOOL_HINTS: Record<ToolType, string> = {
  'Nmap': `
- Extract open ports and services as separate findings where the service itself is the risk (e.g. exposed RDP, Telnet, FTP)
- Note service versions and flag outdated software
- SSL/TLS issues from --script ssl-* scans should become their own findings
- Port 22 open alone is usually Informational; weak SSH config (from nmap scripts) is Medium–High
- SMB signing disabled (smb-security-mode) is a finding; open SMB ports without auth issues are Informational`,

  'Nessus': `
- Use the Nessus severity rating as a strong starting signal but re-calibrate if it seems off
- Include the Nessus Plugin ID in the pluginId field for every finding
- CVSS scores from Nessus output should be used directly
- Distinguish between credentialed scan findings (higher confidence) and remote checks (verify recommended)
- "Plugin Family: General" findings are often Informational — flag confidence accordingly`,

  'Burp Suite': `
- Issue confidence ("Certain", "Firm", "Tentative") maps to High/Medium/Low confidence in our schema
- Include the specific path/parameter from the Burp finding in the target field
- Passive scan findings (e.g. missing headers) are typically Low–Medium
- Active scan confirmed issues (SQLi, XSS, SSRF) are typically High–Critical
- Burp severity maps: High→High, Medium→Medium, Low→Low, Information→Informational`,

  'Nikto': `
- Nikto has a high false-positive rate — default confidence to Medium/Low unless clearly exploitable
- Focus on findings with OSVDB/CVE references — these are higher confidence
- Outdated server software versions are real findings (Medium–High depending on CVEs)
- Missing security headers are Low/Informational
- Directory listings and backup files are Medium`,

  'Nuclei': `
- Template severity maps directly to our schema
- Include the template ID (e.g. "CVE-2021-44228") in pluginId
- "info" severity templates → Informational
- Critical/High nuclei findings are typically high confidence — include CVE if present
- Tech-detection templates are Informational, not findings`,

  'OpenVAS': `
- QoD (Quality of Detection) ≥ 70% → High confidence; 50–69% → Medium; <50% → Low
- Include OID in pluginId field
- Map OpenVAS severity to CVSS score directly
- "Log" and "False Positive" results should be omitted entirely`,

  'Metasploit': `
- Successful exploits are always High/Critical with High confidence — include module name in pluginId
- Auxiliary scan findings (port/service info) are typically Informational–Low
- Include specific exploit module (e.g. "exploit/windows/smb/ms17_010_eternalblue") in description`,

  'OWASP ZAP': `
- Map ZAP risk levels: High→High, Medium→Medium, Low→Low, Informational→Informational
- ZAP confidence ("High", "Medium", "Low", "False Positive") maps directly to our confidence field
- Skip entries with ZAP confidence "False Positive"
- Include CWE IDs from ZAP findings directly in cweId field`,

  'Other': `
- Parse the output format as best you can — identify severity signals from keywords like CRITICAL, HIGH, CVE, CVSS
- When unsure of severity, default to Medium confidence and note the uncertainty in the finding description
- Extract any CVE references, version numbers, and affected components`,
};

// ─── Prompt ───────────────────────────────────────────────────────────────────

const analyzeToolOutputPrompt = ai.definePrompt({
  name:   'analyzeToolOutputPrompt',
  input:  { schema: InputSchema  },
  output: { schema: OutputSchema },
  prompt: `You are a principal penetration tester with deep expertise in automated security tool output analysis. You convert raw scanner output into structured, actionable vulnerability findings for professional pentest reports.

## Task
Parse the {{{toolType}}} output below and extract all significant security findings. Merge duplicates (same vulnerability on different hosts can be combined with hosts listed in the target field). Order findings Critical → Informational.

## Tool-Specific Guidance for {{{toolType}}}
${TOOL_HINTS['{{toolType}}' as ToolType] ?? TOOL_HINTS['Other']}

{{#if context}}
## Engagement Context
{{{context}}}
{{/if}}

{{#if target}}
## Scan Target
{{{target}}}
{{/if}}

## Output Limits
Return at most {{{maxFindings}}} findings. Prioritise by severity — drop low-value Informational findings if over the limit.

## Quality Rules
- **title**: "[Vulnerability Class] in/on [Component]" — specific, not generic
- **target**: extract exact host:port, URL, or component from the output — do not use the broad scan target
- **description**: include version numbers, plugin IDs, banners, and other raw detail from the output
- **stepsToReproduce**: always include the tool command or request that would reproduce/verify the finding
- **cvss**: use the tool's score directly if provided; otherwise estimate from CVSS v3.1 metrics
- **pluginId/cve**: extract verbatim from tool output — never invent
- **confidence**: be honest — scanner findings that need manual verification are Medium, not High

## Raw Tool Output
\`\`\`
{{{toolOutput}}}
\`\`\`

Respond ONLY with valid JSON matching the output schema. No markdown fences, no preamble.`,
});

// ─── Flow ─────────────────────────────────────────────────────────────────────

const aiAnalyzeToolOutputFlow = ai.defineFlow(
  {
    name:         'aiAnalyzeToolOutputFlow',
    inputSchema:  InputSchema,
    outputSchema: OutputSchema,
  },
  async (input) => {
    const { output } = await analyzeToolOutputPrompt(input);

    if (!output) {
      throw new Error(
        'AI model returned an empty response. ' +
        'Ensure the tool output is not empty and is in a supported format.'
      );
    }

    // Clamp all CVSS scores and sort findings by severity
    const SEVERITY_ORDER: Record<string, number> = {
      Critical: 0, High: 1, Medium: 2, Low: 3, Informational: 4,
    };

    const findings = output.findings
      .map((f) => ({
        ...f,
        cvss: f.cvss !== undefined
          ? Math.min(10, Math.max(0, Math.round(f.cvss * 10) / 10))
          : undefined,
      }))
      .sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 5) - (SEVERITY_ORDER[b.severity] ?? 5));

    return { ...output, findings };
  }
);

// ─── Public server action ─────────────────────────────────────────────────────

export async function aiAnalyzeToolOutput(
  input: AiAnalyzeToolOutputInput
): Promise<AiAnalyzeToolOutputOutput> {
  return aiAnalyzeToolOutputFlow(input);
}
