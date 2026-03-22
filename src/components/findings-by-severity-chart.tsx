"use client";

import {
  Bar, BarChart, Cell, ResponsiveContainer,
  XAxis, YAxis, Tooltip, type TooltipProps,
} from "recharts";
import { SEVERITY_CONFIG } from "@/lib/types";
import type { Finding, FindingSeverity } from "@/lib/types";

// ─── Types ────────────────────────────────────────────────────────────────────

interface FindingsBySeverityChartProps {
  findings: Finding[];
}

// ─── Data ─────────────────────────────────────────────────────────────────────

// Severity → raw CSS color values (Recharts doesn't read Tailwind classes)
const SEVERITY_FILL: Record<FindingSeverity, string> = {
  Critical:      "rgb(248 113 113)",   // red-400
  High:          "rgb(251 146  60)",   // orange-400
  Medium:        "rgb(250 204  21)",   // yellow-400
  Low:           "rgb(  6 182 212)",   // cyan-400
  Informational: "rgb(148 163 184)",   // slate-400
};

const SEVERITY_ORDER: FindingSeverity[] = [
  "Critical", "High", "Medium", "Low", "Informational",
];

// ─── Custom tooltip ───────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;

  const count    = payload[0]?.value ?? 0;
  const severity = label as FindingSeverity;
  const fill     = SEVERITY_FILL[severity] ?? SEVERITY_FILL.Informational;

  return (
    <div className="bg-[#0A0B0D] border border-slate-800 rounded-xl px-3 py-2.5 shadow-2xl shadow-black/60">
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: fill }} />
        <span className="text-[11px] font-mono font-semibold text-slate-200">{severity}</span>
      </div>
      <p className="text-[10px] font-mono text-slate-500 mt-0.5">
        <span className="text-slate-200 font-bold text-sm">{count}</span>{" "}
        finding{count !== 1 ? "s" : ""}
      </p>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function FindingsBySeverityChart({
  findings,
}: FindingsBySeverityChartProps) {
  const data = SEVERITY_ORDER.map((severity) => ({
    name:  severity,
    // Short label for X axis in collapsed/small views
    short: severity === "Informational" ? "Info" : severity,
    total: findings.filter((f) => f.severity === severity).length,
  }));

  const hasData = data.some((d) => d.total > 0);

  if (!hasData) {
    return (
      <div className="flex items-center justify-center h-[200px]">
        <p className="text-[11px] font-mono text-slate-700">No findings to display</p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart
        data={data}
        margin={{ top: 4, right: 8, left: -24, bottom: 0 }}
        barCategoryGap="30%"
      >
        <XAxis
          dataKey="short"
          tick={{ fill: "rgb(100 116 139)", fontSize: 10, fontFamily: "monospace" }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fill: "rgb(100 116 139)", fontSize: 10, fontFamily: "monospace" }}
          tickLine={false}
          axisLine={false}
          width={28}
        />
        <Tooltip
          cursor={{ fill: "rgba(255,255,255,0.03)", radius: 6 }}
          content={<CustomTooltip />}
        />
        {/*
         * Bar uses Cell to apply per-bar colors.
         * Without Cell, all bars would share the same fill.
         * The fill prop on Bar is ignored when Cell is used.
         */}
        <Bar dataKey="total" radius={[4, 4, 0, 0]}>
          {data.map((entry) => (
            <Cell
              key={entry.name}
              fill={SEVERITY_FILL[entry.name as FindingSeverity]}
              fillOpacity={entry.total === 0 ? 0.15 : 0.85}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
