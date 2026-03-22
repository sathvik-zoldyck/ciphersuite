'use server';
/**
 * @fileOverview Genkit flow that generates precise impact statements and
 * prioritised remediation guidance for an existing vulnerability finding.
 *
 * Designed to be called from the FindingForm Sparkles buttons for the
 * Impact and Remediation fields — either together or independently.
 *
 * Exports:
 *   aiGenerateImpactAndRemediation(input)   — callable server action
 *   AiImpactRemediationInput               — input type
 *   AiImpactRemediationOutput              — output type
 */

import { ai } from '@/ai/genkit';
import { z }  from 'genkit';
import type { FindingSeverity } from '@/lib/types';

// ─── Input schema ─────────────────────────────────────────────────────────────

const InputSchema = z.object({
  findingTitle: z
    .string()
    .describe('Title of the vulnerability finding. e.g. "SQL Injection in User Login Endpoint"'),

  description: z
    .string()
    .describe('Technical description of the vulnerability — what it is and where it exists.'),

  target: z
    .string()
    .describe('Affected endpoint, component, or asset. e.g. "POST /api/auth/login"'),

  severity: z
    .enum(['Critical', 'High', 'Medium', 'Low', 'Informational'])
    .describe('Current severity rating — used to calibrate urgency and tone of the output.'),

  stepsToReproduce: z
    .string()
    .optional()
    .describe('Reproduction steps if available. Helps the AI infer exploitation difficulty.'),

  cweId: z
    .string()
    .optional()
    .describe('CWE identifier if known. e.g. "CWE-89". Improves remediation specificity.'),

  owaspId: z
    .string()
    .optional()
    .describe('OWASP Top 10 2021 category if known. e.g. "A03:2021"'),

  context: z
    .string()
    .optional()
    .describe(
      'Engagement context: environment type (prod/dev/staging), industry, compliance requirements. ' +
      'e.g. "PCI-DSS scoped production e-commerce platform"'
    ),

  /** Controls whether to generate one field or both */
  generate: z
    .enum(['both', 'impact', 'remediation'])
    .default('both')
    .describe('Which fields to generate. Use "impact" or "remediation" for targeted Sparkles button calls.'),
});

export type AiImpactRemediationInput = z.infer<typeof InputSchema>;

// ─── Output schema ────────────────────────────────────────────────────────────

const OutputSchema = z.object({
  impact: z
    .string()
    .describe(
      'Concrete impact statement covering CIA triad consequences, exploitability context, ' +
      'and business-level risk. 2–3 focused paragraphs.'
    ),

  remediation: z
    .string()
    .describe(
      'Prioritised remediation guidance. Primary fix first, followed by supporting controls. ' +
      'References OWASP, NIST, or CIS where applicable. Formatted as a numbered list.'
    ),

  remediationEffort: z
    .enum(['Low', 'Medium', 'High'])
    .describe(
      'Estimated implementation effort for the primary remediation. ' +
      'Low: config change or 1-line fix. Medium: code refactor, days. High: architectural change, weeks.'
    ),

  quickWin: z
    .string()
    .optional()
    .describe(
      'A single immediate mitigation that reduces risk while the full fix is implemented. ' +
      'Omit if no meaningful quick win exists (e.g. the only fix is the full fix).'
    ),
});

export type AiImpactRemediationOutput = z.infer<typeof OutputSchema>;

// ─── Prompt ───────────────────────────────────────────────────────────────────

const impactRemediationPrompt = ai.definePrompt({
  name:   'impactRemediationPrompt',
  input:  { schema: InputSchema  },
  output: { schema: OutputSchema },
  prompt: `You are a principal penetration tester and security consultant writing findings for a professional pentest report. Your audience includes both technical leads (who need precise fix guidance) and business stakeholders (who need to understand business risk).

## Finding

**Title**: {{{findingTitle}}}
**Severity**: {{{severity}}}
**Target**: {{{target}}}
{{#if cweId}}**CWE**: {{{cweId}}}{{/if}}
{{#if owaspId}}**OWASP**: {{{owaspId}}}{{/if}}

**Description**:
{{{description}}}

{{#if stepsToReproduce}}
**Steps to Reproduce**:
{{{stepsToReproduce}}}
{{/if}}

{{#if context}}
**Engagement Context**: {{{context}}}
{{/if}}

---

## Instructions

{{#if (eq generate "impact")}}
Generate ONLY the **impact** field. Leave remediation minimal as a placeholder.
{{else if (eq generate "remediation")}}
Generate ONLY the **remediation** field. Leave impact minimal as a placeholder.
{{else}}
Generate both fields fully.
{{/if}}

### Impact
Write 2–3 paragraphs covering:
1. **Technical consequences** — what an attacker can concretely do (read data, escalate privileges, move laterally, etc.)
2. **Business/operational consequences** — data breach, compliance violation, reputational damage, service disruption
3. **Exploitability context** — is this trivially exploitable or does it require prerequisites?

Severity calibration:
- **Critical/High**: Lead with worst-case scenario. Use language that conveys urgency.
- **Medium**: Balanced tone. Acknowledge conditions required for exploitation.
- **Low/Informational**: Measured tone. Acknowledge limited direct impact while noting defence-in-depth value.

Do NOT use vague phrases like "could lead to a data breach" or "may impact security". Be specific about what data, system, or capability is at risk.

### Remediation
Format as a numbered list:
1. **Primary fix** — the definitive code, configuration, or architectural change that eliminates the vulnerability
2–4. **Supporting controls** — additional hardening measures (input validation, WAF rules, security headers, monitoring, etc.)

Requirements:
- Reference specific OWASP guidance, NIST controls, or CIS benchmarks where applicable
- Estimate implementation effort (populate remediationEffort field): Low = config/1-line fix, Medium = code change taking days, High = architectural change taking weeks
- If a meaningful interim mitigation exists (WAF rule, feature flag, rate limiting, etc.), populate the quickWin field
- Use precise technical language: name the library, function, or configuration key where possible

Respond ONLY with valid JSON matching the output schema. No markdown fences, no preamble.`,
});

// ─── Flow ─────────────────────────────────────────────────────────────────────

const aiImpactRemediationFlow = ai.defineFlow(
  {
    name:         'aiImpactRemediationFlow',
    inputSchema:  InputSchema,
    outputSchema: OutputSchema,
  },
  async (input) => {
    const { output } = await impactRemediationPrompt(input);

    if (!output) {
      throw new Error(
        'AI model returned an empty response. ' +
        'Ensure the finding has a title, description, and target before requesting AI assistance.'
      );
    }

    return output;
  }
);

// ─── Public server action ─────────────────────────────────────────────────────

export async function aiGenerateImpactAndRemediation(
  input: AiImpactRemediationInput
): Promise<AiImpactRemediationOutput> {
  return aiImpactRemediationFlow(input);
}