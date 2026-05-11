'use server';
/**
 * @fileOverview Genkit flow for generating professional security reports.
 *
 * Returns Markdown only. PDF/DOCX conversion happens client-side
 * (see src/lib/export-pdf.ts and src/lib/export-docx.ts) because
 * serverless runtimes (Vercel) cannot run PhantomJS/Chromium reliably
 * and the client already has the rendering libraries.
 *
 * Route-segment maxDuration is set in
 * src/app/projects/[projectId]/reports/layout.tsx.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

// A simplified schema for findings passed to the AI
const FindingSchema = z.object({
  title: z.string(),
  severity: z.string(),
  status: z.string(),
  target: z.string().optional(),
  description: z.string(),
  impact: z.string(),
  stepsToReproduce: z.string(),
  remediation: z.string(),
  cvss: z.number().optional(),
  cweId: z.string().optional(),
  owaspId: z.string().optional(),
});

const ReportGenerationInputSchema = z.object({
  projectName:    z.string(),
  target:         z.string(),
  template:       z.string(),
  sections:       z.string(),
  findings:       z.array(FindingSchema),
  classification: z.string(),
  authorName:     z.string(),
  companyName:    z.string(),
  findingSummary: z.string(),
  findingDetails: z.string(),
  currentDate:    z.string(),
});

export type ReportGenerationInput = z.infer<typeof ReportGenerationInputSchema>;

const ReportGenerationOutputSchema = z.object({
  content: z.string(),
  downloadUrl: z.string().optional(),
  wordCount: z.number(),
});

export type ReportGenerationOutput = z.infer<typeof ReportGenerationOutputSchema>;

// Wrapped result type so the client always receives the real error
// message. Next.js masks thrown server-action errors in production.
export type GenerateReportResult =
  | { ok: true; data: ReportGenerationOutput }
  | { ok: false; error: string };


// NOTE: no output schema — we want raw markdown text. Declaring
// `output.schema: z.string()` makes Genkit force JSON-mode on Gemini,
// which then returns null and fails schema validation.
const reportGenerationPrompt = ai.definePrompt({
  name: 'reportGenerationPrompt',
  input: { schema: ReportGenerationInputSchema },
  prompt: `You are a senior penetration tester and technical writer at {{{companyName}}} producing a professional security assessment report.
Write in formal, authoritative language suitable for delivery to a client.
The report should be formatted in clean Markdown with proper headers, tables, and lists.
Do not include any preamble, explanation, or meta-commentary — output the report document directly.

## Engagement Details
- **Project**: {{{projectName}}}
- **Target**: {{{target}}}
- **Author**: {{{authorName}}}
- **Organisation**: {{{companyName}}}
- **Classification**: {{{classification}}}
- **Date**: {{{currentDate}}}
- **Total Findings**: {{{findings.length}}}

## Sections to Include
{{{sections}}}

## Finding Summary
{{{findingSummary}}}

## Finding Details
{{{findingDetails}}}

Produce the complete report now. Use proper Markdown formatting:
- H1 for the report title
- H2 for major sections
- H3 for individual findings
- Tables for risk matrices and severity breakdowns
- Bold for field labels
- Code blocks for payloads or technical strings

Begin the report with the classification marking "{{{classification}}}" centred at the top.
`,
});


const generateReportFlow = ai.defineFlow(
  {
    name: 'generateReportFlow',
    inputSchema: z.object({
      projectName:    z.string(),
      target:         z.string(),
      template:       z.string(),
      sections:       z.array(z.string()),
      findings:       z.array(FindingSchema),
      classification: z.string(),
      authorName:     z.string(),
      companyName:    z.string(),
      reportId:       z.string(),
      format:         z.enum(['markdown', 'pdf', 'docx']),
      projectId:      z.string(),
    }),
    outputSchema: ReportGenerationOutputSchema,
  },
  async (input) => {
    const { findings } = input;

    const findingSummary = findings.map((f, i) =>
      `${i + 1}. [${f.severity}] ${f.title} — Target: ${f.target ?? "N/A"}, Status: ${f.status}`
    ).join("\n");

    const findingDetails = findings.slice(0, 20).map((f) => `
### ${f.title}
- **Severity**: ${f.severity}${f.cvss ? ` (CVSS ${f.cvss})` : ""}
- **Target**: ${f.target ?? "N/A"}
- **Status**: ${f.status}
${f.cweId   ? `- **CWE**: ${f.cweId}`   : ""}
${f.owaspId ? `- **OWASP**: ${f.owaspId}` : ""}

**Description**: ${f.description ?? "No description provided."}

**Impact**: ${f.impact ?? "No impact statement provided."}

**Steps to Reproduce**: ${f.stepsToReproduce ?? "No steps provided."}

**Remediation**: ${f.remediation ?? "No remediation provided."}
`).join("\n---\n");

    const currentDate = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

    const response = await reportGenerationPrompt({
        ...input,
        findings,
        findingSummary,
        findingDetails,
        currentDate,
        sections: input.sections.join(', '),
    });

    const markdownContent = response.text?.trim();

    if (!markdownContent) {
      throw new Error('AI returned an empty response.');
    }

    const wordCount = markdownContent.split(/\s+/).filter(Boolean).length;

    return { content: markdownContent, wordCount };
  }
);

// Public server action.
// Returns a discriminated result instead of throwing — Next.js masks
// thrown server-action errors in production, so we surface the real
// message via `result.error` so the UI/toast can display it.
export async function generateReport(
    input: Parameters<typeof generateReportFlow>[0]
): Promise<GenerateReportResult> {
    try {
        const data = await generateReportFlow(input);
        return { ok: true, data };
    } catch (err: any) {
        console.error('[generateReport] flow failed:', err);
        const message =
            err?.message ||
            err?.cause?.message ||
            (typeof err === 'string' ? err : 'Unknown error in report generation.');
        return { ok: false, error: message };
    }
}
