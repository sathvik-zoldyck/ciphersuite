'use server';

import { aiDraftFinding } from './ai-draft-vulnerability-description';
import { aiGenerateImpactAndRemediation } from './ai-generate-impact-and-remediation';
import { aiAnalyzeToolOutput } from './ai-suggest-findings-from-tool-output';
import { generateReport } from './ai-generate-report';

export {
  aiDraftFinding,
  aiGenerateImpactAndRemediation,
  aiAnalyzeToolOutput,
  generateReport,
};
