// Route-segment config: allow up to 60s for the report generation
// server action (Gemini calls can exceed Vercel's default 10s).
export const maxDuration = 60;

export default function ReportsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
