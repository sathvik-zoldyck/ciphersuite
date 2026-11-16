
"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ShieldAlert, ShieldCheck, AlertTriangle, FileImage,
  Target, Calendar, Clock, Activity, TrendingUp,
  ArrowRight, ChevronRight, Bug, Layers,
  Lock, Zap, BarChart2, Plus, Circle,
  CheckCircle2, XCircle, AlertCircle, FileBarChart2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow } from "date-fns";
import { useProject } from "@/hooks/use-project";
import { useFindings } from "@/hooks/use-findings";
import { useCollection } from "@/hooks/use-collection";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, limit } from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";
import { SEVERITY_CONFIG, STATUS_CONFIG, STATUSES_ORDERED } from "@/lib/types";
import type { Finding, Evidence, FindingStatus } from "@/lib/types";
import { Button } from "@/components/ui/button";
import type { ActivityLog } from "@/lib/activity-service";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toDate(ts: any): Date | null {
  if (!ts) return null;
  try { return ts?.toDate?.() ?? new Date(ts); } catch { return null; }
}

function fmt(ts: any, fallback = "—"): string {
  const d = toDate(ts);
  return d ? format(d, "MMM d, yyyy") : fallback;
}

function timeAgo(ts: any): string {
  const d = toDate(ts);
  if (!d) return "—";
  try { return formatDistanceToNow(d, { addSuffix: true }); } catch { return "—"; }
}

// ─── Risk score calc ──────────────────────────────────────────────────────────

function calcRisk(findings: Finding[]): number {
  const weights = { Critical: 10, High: 7, Medium: 4, Low: 1, Informational: 0 };
  const openFindings = findings.filter(f => f.status === 'Open');
  if (openFindings.length === 0) return 0;
  
  const raw = openFindings.reduce((s, f) => s + (weights[f.severity as keyof typeof weights] ?? 0), 0);
  const max = openFindings.length * 10;
  return Math.min(100, Math.round((raw / max) * 100));
}

function riskLabel(score: number) {
  if (score >= 80) return { label: "CRITICAL RISK", color: "text-red-400",    glow: "rgba(239,68,68,0.4)"    };
  if (score >= 60) return { label: "HIGH RISK",     color: "text-orange-400", glow: "rgba(249,115,22,0.4)"   };
  if (score >= 40) return { label: "MEDIUM RISK",   color: "text-yellow-400", glow: "rgba(234,179,8,0.4)"    };
  if (score >= 20) return { label: "LOW RISK",      color: "text-cyan-400",   glow: "rgba(6,182,212,0.4)"    };
  return               { label: "NONE",             color: "text-slate-500",  glow: "rgba(100,116,139,0.2)"  };
}

// ─── Bone skeleton ────────────────────────────────────────────────────────────

function Bone({ className }: { className?: string }) {
  return <div className={cn("rounded bg-slate-800/80 animate-pulse", className)} />;
}

// ─── SVG Arc Gauge ────────────────────────────────────────────────────────────

function ArcGauge({ score }: { score: number }) {
  const r = 52;
  const cx = 70; const cy = 70;
  const startAngle = -210;
  const sweep = 240;
  const angleToRad = (a: number) => (a * Math.PI) / 180;
  const ptOnArc = (angle: number) => ({
    x: cx + r * Math.cos(angleToRad(angle)),
    y: cy + r * Math.sin(angleToRad(angle)),
  });

  const arcPath = (from: number, to: number, rx = r) => {
    const s = ptOnArc(from);
    const e = { x: cx + rx * Math.cos(angleToRad(to)), y: cy + rx * Math.sin(angleToRad(to)) };
    const large = Math.abs(to - from) > 180 ? 1 : 0;
    return `M ${s.x} ${s.y} A ${rx} ${rx} 0 ${large} 1 ${e.x} ${e.y}`;
  };

  const s1 = { x: cx + r * Math.cos(angleToRad(startAngle)), y: cy + r * Math.sin(angleToRad(startAngle)) };
  const endAngle = startAngle + sweep;
  const e1 = { x: cx + r * Math.cos(angleToRad(endAngle)), y: cy + r * Math.sin(angleToRad(endAngle)) };
  const large = sweep > 180 ? 1 : 0;
  const trackD = `M ${s1.x} ${s1.y} A ${r} ${r} 0 ${large} 1 ${e1.x} ${e1.y}`;

  const progressAngle = startAngle + (sweep * score) / 100;
  const pe = { x: cx + r * Math.cos(angleToRad(progressAngle)), y: cy + r * Math.sin(angleToRad(progressAngle)) };
  const plarge = (sweep * score) / 100 > 180 ? 1 : 0;
  const progressD = score > 0
    ? `M ${s1.x} ${s1.y} A ${r} ${r} 0 ${plarge} 1 ${pe.x} ${pe.y}`
    : "";

  const rl = riskLabel(score);

  const sevColors: Record<string, string> = {
    Critical: "#ef4444", High: "#f97316", Medium: "#eab308",
    Low: "#06b6d4", Informational: "#64748b",
  };
  const scoreColor = score >= 80 ? sevColors.Critical : score >= 60 ? sevColors.High : score >= 40 ? sevColors.Medium : score >= 20 ? sevColors.Low : "#334155";

  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        <svg width="140" height="120" viewBox="0 0 140 120" className="overflow-visible">
          {/* Glow filter */}
          <defs>
            <filter id="arcGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="coloredBlur" />
              <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>

          {/* Track */}
          <path d={trackD} fill="none" stroke="rgba(148,163,184,0.1)" strokeWidth="8" strokeLinecap="round" />

          {/* Tick marks */}
          {[0, 25, 50, 75, 100].map((pct) => {
            const a = startAngle + (sweep * pct) / 100;
            const inner = 44; const outer = 50;
            const ix = cx + inner * Math.cos(angleToRad(a));
            const iy = cy + inner * Math.sin(angleToRad(a));
            const ox = cx + outer * Math.cos(angleToRad(a));
            const oy = cy + outer * Math.sin(angleToRad(a));
            return <line key={pct} x1={ix} y1={iy} x2={ox} y2={oy} stroke="rgba(148,163,184,0.2)" strokeWidth="1.5" strokeLinecap="round" />;
          })}

          {/* Progress arc */}
          {progressD && (
            <path
              d={progressD}
              fill="none"
              stroke={scoreColor}
              strokeWidth="8"
              strokeLinecap="round"
              filter="url(#arcGlow)"
              style={{ transition: "stroke-dashoffset 1s ease-out" }}
            />
          )}

          {/* Needle dot */}
          {score > 0 && (
            <circle
              cx={pe.x} cy={pe.y} r="5"
              fill={scoreColor}
              filter="url(#arcGlow)"
            />
          )}

          {/* Center value */}
          <text x={cx} y={cy - 4} textAnchor="middle" fill="white" fontSize="22" fontWeight="700" fontFamily="'JetBrains Mono', monospace">
            {score}
          </text>
          <text x={cx} y={cy + 14} textAnchor="middle" fill="#475569" fontSize="9" fontFamily="'JetBrains Mono', monospace">
            / 100
          </text>
        </svg>
      </div>

      <div className={cn(
        "mt-1 px-3 py-1 rounded-full border text-[9px] font-mono font-bold tracking-[0.15em] uppercase",
        score >= 80 ? "bg-red-500/10 border-red-500/25 text-red-400"
        : score >= 60 ? "bg-orange-500/10 border-orange-500/25 text-orange-400"
        : score >= 40 ? "bg-yellow-500/10 border-yellow-500/25 text-yellow-400"
        : score >= 20 ? "bg-cyan-500/10 border-cyan-500/25 text-cyan-400"
        : "bg-slate-800/60 border-slate-700/40 text-slate-600"
      )}>
        {rl.label}
      </div>
    </div>
  );
}

// ─── Metric card ──────────────────────────────────────────────────────────────

interface MetricProps {
  label: string;
  value: number | string;
  sub: string;
  icon: React.ReactNode;
  accentColor: string;
  borderColor: string;
  bgColor: string;
  pulse?: boolean;
  delay?: number;
  isLoading?: boolean;
  onClick?: () => void;
}

function MetricCard({ label, value, sub, icon, accentColor, borderColor, bgColor, pulse, delay = 0, isLoading, onClick }: MetricProps) {
  const [visible, setVisible] = useState(false);
  useEffect(() => { const t = setTimeout(() => setVisible(true), delay); return () => clearTimeout(t); }, [delay]);

  if (isLoading) return (
    <div className="rounded-xl border border-slate-800 bg-[#0D0F12] p-5">
      <Bone className="h-3 w-20 mb-4" /><Bone className="h-8 w-12 mb-2" /><Bone className="h-2.5 w-28" />
    </div>
  );

  return (
    <div
      onClick={onClick}
      className={cn(
        "group relative rounded-xl border bg-[#0D0F12] overflow-hidden transition-all duration-300",
        "border-slate-800 hover:border-slate-700",
        onClick && "cursor-pointer hover:translate-y-[-1px]",
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
      )}
    >
      {/* Left severity stripe */}
      <div className={cn("absolute left-0 top-0 bottom-0 w-[3px]", accentColor.replace("text-", "bg-"))} />

      {/* Ambient hover glow */}
      <div
        className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{ background: `radial-gradient(ellipse 70% 60% at 0% 50%, ${bgColor.includes("red") ? "rgba(239,68,68,0.05)" : bgColor.includes("orange") ? "rgba(249,115,22,0.05)" : bgColor.includes("cyan") ? "rgba(6,182,212,0.05)" : "rgba(148,163,184,0.03)"}, transparent)` }}
      />

      <div className="pl-6 pr-5 py-5">
        {/* Top row */}
        <div className="flex items-center justify-between mb-4">
          <span className={cn("text-[10px] font-mono font-semibold uppercase tracking-[0.15em]", accentColor)}>{label}</span>
          <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center", bgColor, borderColor.replace("border-", "border "))}>
            <span className={cn("", accentColor)}>{icon}</span>
          </div>
        </div>

        {/* Value */}
        <div className="flex items-end gap-2 mb-1.5">
          <span className={cn(
            "text-4xl font-bold font-mono leading-none transition-colors",
            Number(value) > 0 ? "text-slate-100" : "text-slate-700"
          )}>
            {value}
          </span>
          {pulse && Number(value) > 0 && (
            <div className="mb-1.5">
              <div className={cn("w-2 h-2 rounded-full animate-pulse", accentColor.replace("text-", "bg-"))} />
            </div>
          )}
        </div>

        {/* Sub */}
        <p className="text-[11px] font-mono text-slate-600">{sub}</p>
      </div>
    </div>
  );
}

// ─── Severity breakdown bars ──────────────────────────────────────────────────

function SeverityBars({ findings, isLoading }: { findings: Finding[]; isLoading: boolean }) {
  const [animated, setAnimated] = useState(false);
  useEffect(() => { const t = setTimeout(() => setAnimated(true), 400); return () => clearTimeout(t); }, []);

  const counts = useMemo(() => {
    const c: Record<string, number> = { Critical: 0, High: 0, Medium: 0, Low: 0, Informational: 0 };
    findings.forEach((f) => { if (f.severity in c) c[f.severity]++; });
    return c;
  }, [findings]);

  const total = findings.length;
  const SEVS_ORDER = ["Critical", "High", "Medium", "Low", "Informational"] as const;

  if (isLoading) return (
    <div className="space-y-3">
      {SEVS_ORDER.map((s) => <Bone key={s} className="h-8 w-full" />)}
    </div>
  );

  return (
    <div className="space-y-2.5">
      {SEVS_ORDER.map((sev, i) => {
        const count = counts[sev];
        const pct = total > 0 ? (count / total) * 100 : 0;
        const cfg = SEVERITY_CONFIG[sev];
        return (
          <div key={sev} className="flex items-center gap-3">
            {/* Label */}
            <div className="w-24 flex items-center gap-2 flex-shrink-0">
              <div className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", cfg.dot)} />
              <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">{sev.slice(0, 4)}</span>
            </div>

            {/* Bar track */}
            <div className="flex-1 h-5 bg-slate-800/60 rounded-md overflow-hidden relative">
              <div
                className={cn("h-full rounded-md transition-all duration-700 ease-out", cfg.dot)}
                style={{
                  width: animated ? `${Math.max(pct, count > 0 ? 3 : 0)}%` : "0%",
                  transitionDelay: `${i * 80}ms`,
                  opacity: count > 0 ? 1 : 0.15,
                }}
              />
              {count === 0 && (
                <div className="absolute inset-0 flex items-center px-3">
                  <div className="w-full h-px bg-slate-800" />
                </div>
              )}
            </div>

            {/* Count */}
            <div className="w-8 text-right flex-shrink-0">
              <span className={cn(
                "text-xs font-mono font-bold",
                count > 0 ? cfg.color : "text-slate-800"
              )}>
                {count}
              </span>
            </div>

            {/* Pct */}
            <div className="w-10 text-right flex-shrink-0">
              <span className="text-[10px] font-mono text-slate-700">
                {total > 0 ? `${Math.round(pct)}%` : "—"}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Status donut / breakdown ─────────────────────────────────────────────────

function StatusBreakdown({ findings, isLoading }: { findings: Finding[]; isLoading: boolean }) {
  const counts = useMemo(() => {
    const c = Object.fromEntries(
      STATUSES_ORDERED.map(s => [s, 0])
    ) as Record<FindingStatus, number>;
    findings.forEach((f) => {
      if (f.status in c) {
        c[f.status]++;
      }
    });
    return c;
  }, [findings]);

  const total = findings.length;
  const fixed = (counts.Fixed || 0) + (counts.Verified || 0);
  const pct = total > 0 ? Math.round((fixed / total) * 100) : 0;

  if (isLoading) return <Bone className="h-32 w-full" />;

  return (
    <div className="space-y-3">
      {/* Remediation rate */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-mono text-slate-600 uppercase tracking-wider">Remediation Rate</span>
        <span className={cn(
          "text-xs font-mono font-bold px-2 py-0.5 rounded-full",
          pct >= 80 ? "text-emerald-400 bg-emerald-500/10" : pct >= 50 ? "text-cyan-400 bg-cyan-500/10" : "text-slate-500 bg-slate-800/60"
        )}>
          {pct}%
        </span>
      </div>

      {/* Thin progress bar */}
      <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden mb-4">
        <div
          className="h-full bg-emerald-500 rounded-full transition-all duration-700 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Status rows */}
      <div className="grid grid-cols-2 gap-2">
        {STATUSES_ORDERED.map((s) => {
          const cfg = STATUS_CONFIG[s];
          const count = counts[s];
          return (
            <div key={s} className={cn("flex items-center justify-between px-3 py-2 rounded-lg border", cfg.bg, "border-transparent")}>
              <div className="flex items-center gap-2">
                <div className={cn("w-1.5 h-1.5 rounded-full", cfg.dot)} />
                <span className="text-[10px] font-mono text-slate-400">{cfg.label}</span>
              </div>
              <span className={cn("text-xs font-mono font-bold", count > 0 ? cfg.color : "text-slate-700")}>
                {count}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Activity feed ────────────────────────────────────────────────────────────

function ActivityFeed({ projectId }: { projectId: string }) {
  const { isGuest } = useAuth();
  
  const queryRef = useMemo(() => {
    if (!projectId || isGuest) return null;
    return query(
      collection(db, "projects", projectId, "activity"),
      orderBy("timestamp", "desc"),
      limit(10)
    );
  }, [projectId, isGuest]);

  const { data: activities, isLoading: fbLoading } = useCollection<ActivityLog>(queryRef);
  const items = isGuest ? [] : (activities ?? []);
  const isLoading = !isGuest && fbLoading;

  if (isLoading) return (
    <div className="space-y-3">
      {Array(4).fill(0).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Bone className="w-6 h-6 rounded-full flex-shrink-0" />
          <div className="flex-1"><Bone className="h-2.5 w-3/4 mb-1.5" /><Bone className="h-2 w-1/3" /></div>
        </div>
      ))}
    </div>
  );

  if (items.length === 0) return (
    <div className="flex flex-col items-center justify-center py-8">
      <div className="w-10 h-10 rounded-xl bg-slate-800/60 border border-slate-700/40 flex items-center justify-center mb-3">
        <Activity className="w-5 h-5 text-slate-700" />
      </div>
      <p className="text-xs font-mono text-slate-700">No activity yet</p>
    </div>
  );

  const getIcon = (action: string) => {
    if (action.startsWith("finding")) return <Bug className="w-3.5 h-3.5 text-red-500" />;
    if (action.startsWith("evidence")) return <FileImage className="w-3.5 h-3.5 text-cyan-500" />;
    if (action.startsWith("report")) return <FileBarChart2 className="w-3.5 h-3.5 text-violet-500" />;
    return <Activity className="w-3.5 h-3.5 text-slate-500" />;
  };

  const getActionLabel = (item: ActivityLog) => {
    switch (item.action) {
      case "finding.created": return "Finding created";
      case "finding.updated": return "Finding updated";
      case "finding.deleted": return "Finding deleted";
      case "finding.status_changed": return `Status changed: ${item.oldValue} → ${item.newValue}`;
      case "finding.severity_changed": return `Severity changed: ${item.oldValue} → ${item.newValue}`;
      case "evidence.uploaded": return "Evidence uploaded";
      case "evidence.deleted": return "Evidence deleted";
      case "report.generated": return "Report generated";
      case "report.deleted": return "Report deleted";
      default: return "Activity recorded";
    }
  };

  return (
    <div className="space-y-1">
      {items.map((item, i) => (
        <div
          key={item.id}
          className="group flex items-start gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-800/40 transition-colors cursor-default"
          style={{ animationDelay: `${i * 50}ms` }}
        >
          <div className="w-7 h-7 mt-0.5 rounded-full flex items-center justify-center flex-shrink-0 bg-slate-800">
            {getIcon(item.action)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-[11px] font-mono font-semibold text-slate-300 truncate">{getActionLabel(item)}</span>
              <span className="text-[10px] font-mono text-slate-600 flex-shrink-0">{timeAgo(item.timestamp)}</span>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] font-mono">
              <span className="text-slate-500 font-semibold truncate max-w-[80px]">{item.userDisplay}</span>
              <span className="text-slate-700 flex-shrink-0">·</span>
              <span className="text-slate-600 truncate">{item.targetTitle ?? (item.targetId ? item.targetId.slice(0, 8) : "")}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Engagement summary ───────────────────────────────────────────────────────

function SummaryRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-slate-800/80 last:border-0">
      <div className="flex items-center gap-2.5 w-24 flex-shrink-0">
        <span className="text-slate-700">{icon}</span>
        <span className="text-[10px] font-mono font-semibold text-slate-600 uppercase tracking-wider">{label}</span>
      </div>
      <span className="text-xs font-mono text-slate-300 flex-1 text-right truncate">{value}</span>
    </div>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionLabel({ icon, label, action }: { icon: React.ReactNode; label: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <span className="text-slate-600">{icon}</span>
        <span className="text-[10px] font-mono font-semibold text-slate-500 uppercase tracking-[0.15em]">{label}</span>
      </div>
      {action}
    </div>
  );
}

// ─── Main Dashboard Page ──────────────────────────────────────────────────────

export default function DashboardPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;
  const { isGuest } = useAuth();

  // Data
  const { project, isLoading: projectLoading, notFound } = useProject(projectId);
  const { findings, isLoading: findingsLoading } = useFindings(projectId);

  const evidenceQuery = useMemo(() => {
    if (!projectId || isGuest) return null;
    return query(
      collection(db, `projects/${projectId}/evidence`),
      orderBy("uploadedAt", "desc"), limit(10)
    );
  }, [projectId, isGuest]);
  const { data: evidenceData, isLoading: evidenceLoading } = useCollection<Evidence>(evidenceQuery);
  const evidence = isGuest ? [] : (evidenceData ?? []);

  const isLoading = projectLoading || findingsLoading;
  const riskScore = useMemo(() => calcRisk(findings), [findings]);

  const openCount     = useMemo(() => findings.filter((f) => f.status === "Open").length, [findings]);
  const criticalCount = useMemo(() => findings.filter((f) => f.severity === "Critical" && f.status === "Open").length, [findings]);
  const fixedCount    = useMemo(() => findings.filter((f) => ["Fixed","Verified"].includes(f.status)).length, [findings]);
  const remediationPct = findings.length > 0 ? Math.round((fixedCount / findings.length) * 100) : 0;

  const isActive = useMemo(() => {
    const d = toDate(project?.endDate);
    return d ? d > new Date() : true;
  }, [project]);

  // Page mounted animation
  const [mounted, setMounted] = useState(false);
  useEffect(() => { const t = setTimeout(() => setMounted(true), 50); return () => clearTimeout(t); }, []);

  if (notFound) {
    return (
        <div className="flex flex-col items-center justify-center h-full text-center">
            <AlertTriangle className="w-16 h-16 text-amber-500/50 mb-4" />
            <h2 className="text-2xl font-bold font-display text-slate-200 mb-2">Project Not Found</h2>
            <p className="text-sm font-mono text-slate-600 leading-relaxed mb-6 max-w-xs mx-auto">
                The project you are looking for does not exist or you do not have permission to view it.
            </p>
            <Button onClick={() => router.push('/')}>
                Back to All Projects
            </Button>
        </div>
    )
  }

  return (
    <div className={cn(
      "space-y-6 transition-all duration-500",
      mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
    )}>

      {/* ── Page header ──────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <h1 className="text-xl font-bold font-display text-slate-100 tracking-tight">Dashboard</h1>
            {!isLoading && (
              <div className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[9px] font-mono font-bold uppercase tracking-wider",
                isActive
                  ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                  : "bg-slate-800 border-slate-700 text-slate-600"
              )}>
                <div className={cn("w-1 h-1 rounded-full", isActive ? "bg-emerald-400 animate-pulse" : "bg-slate-600")} />
                {isActive ? "Active" : "Closed"}
              </div>
            )}
          </div>
          <p className="text-xs font-mono text-slate-600">
            {isLoading ? "Loading…" : `Security posture overview · ${findings.length} finding${findings.length !== 1 ? "s" : ""} documented`}
          </p>
        </div>

        {/* Quick actions */}
        <div className="flex items-center gap-2">
          {remediationPct > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.06]">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-xs font-mono text-emerald-400 font-semibold">{remediationPct}% remediated</span>
            </div>
          )}
          <button
            onClick={() => router.push(`/projects/${projectId}/findings`)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-mono font-bold transition-all shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/30 hover:scale-[1.01] active:scale-[0.99]"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Finding
          </button>
        </div>
      </div>

      {/* ── Metric cards ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          isLoading={isLoading}
          label="Total Findings"
          value={findings.length}
          sub="All identified issues"
          icon={<Layers className="w-3.5 h-3.5" />}
          accentColor="text-slate-400"
          borderColor="border-slate-700/40"
          bgColor="bg-slate-800/60"
          delay={0}
          onClick={() => router.push(`/projects/${projectId}/findings`)}
        />
        <MetricCard
          isLoading={isLoading}
          label="Open Findings"
          value={openCount}
          sub="Awaiting remediation"
          icon={<AlertTriangle className="w-3.5 h-3.5" />}
          accentColor="text-orange-400"
          borderColor="border-orange-500/25"
          bgColor="bg-orange-500/10"
          pulse
          delay={60}
          onClick={() => router.push(`/projects/${projectId}/findings`)}
        />
        <MetricCard
          isLoading={isLoading}
          label="Critical Open"
          value={criticalCount}
          sub="Urgent priority issues"
          icon={<ShieldAlert className="w-3.5 h-3.5" />}
          accentColor="text-red-400"
          borderColor="border-red-500/25"
          bgColor="bg-red-500/10"
          pulse
          delay={120}
          onClick={() => router.push(`/projects/${projectId}/findings?severity=Critical`)}
        />
        <MetricCard
          isLoading={isLoading}
          label="Evidence"
          value={evidence.length}
          sub="Collected artifacts"
          icon={<FileImage className="w-3.5 h-3.5" />}
          accentColor="text-cyan-400"
          borderColor="border-cyan-500/25"
          bgColor="bg-cyan-500/10"
          delay={180}
          onClick={() => router.push(`/projects/${projectId}/evidence`)}
        />
      </div>

      {/* ── Main content: two columns ──────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-5">

        {/* ── Left column ──────────────────────────────────────────── */}
        <div className="space-y-5">

          {/* Findings by Severity */}
          <div className="rounded-xl border border-slate-800 bg-[#0D0F12] p-6">
            <SectionLabel
              icon={<BarChart2 className="w-3.5 h-3.5" />}
              label="Findings by Severity"
              action={
                !isLoading && findings.length > 0 ? (
                  <button
                    onClick={() => router.push(`/projects/${projectId}/findings`)}
                    className="flex items-center gap-1 text-[10px] font-mono text-cyan-400/70 hover:text-cyan-400 transition-colors"
                  >
                    View all <ArrowRight className="w-2.5 h-2.5" />
                  </button>
                ) : null
              }
            />
            <SeverityBars findings={findings} isLoading={isLoading} />
          </div>

          {/* Status + Recent activity row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">

            {/* Status breakdown */}
            <div className="rounded-xl border border-slate-800 bg-[#0D0F12] p-6">
              <SectionLabel icon={<CheckCircle2 className="w-3.5 h-3.5" />} label="Status Breakdown" />
              <StatusBreakdown findings={findings} isLoading={isLoading} />
            </div>

            {/* Recent activity */}
            <div className="rounded-xl border border-slate-800 bg-[#0D0F12] p-6">
              <SectionLabel
                icon={<Activity className="w-3.5 h-3.5" />}
                label="Recent Activity"
              />
              <ActivityFeed projectId={projectId} />
            </div>
          </div>
        </div>

        {/* ── Right column ─────────────────────────────────────────── */}
        <div className="space-y-5">

          {/* Risk Score */}
          <div className="rounded-xl border border-slate-800 bg-[#0D0F12] p-6">
            <SectionLabel icon={<ShieldAlert className="w-3.5 h-3.5" />} label="Risk Score" />

            {isLoading ? (
              <div className="flex flex-col items-center gap-3 py-4">
                <Bone className="w-32 h-32 rounded-full" />
                <Bone className="h-5 w-24" />
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <ArcGauge score={riskScore} />

                {/* Mini severity bars */}
                {findings.length > 0 && (
                  <div className="mt-5 w-full space-y-2 border-t border-slate-800 pt-4">
                    {(["Critical", "High", "Medium"] as const).map((sev) => {
                      const count = findings.filter((f) => f.severity === sev && f.status === 'Open').length;
                      const openTotal = findings.filter(f => f.status === 'Open').length;
                      const pct = openTotal > 0 ? (count / openTotal) * 100 : 0;
                      const cfg = SEVERITY_CONFIG[sev];
                      if (count === 0) return null;
                      return (
                        <div key={sev} className="flex items-center gap-2">
                          <div className={cn("w-1 h-1 rounded-full flex-shrink-0", cfg.dot)} />
                          <span className="text-[10px] font-mono text-slate-600 w-16">{sev}</span>
                          <div className="flex-1 h-1 bg-slate-800 rounded-full overflow-hidden">
                            <div className={cn("h-full rounded-full", cfg.dot)} style={{ width: `${pct}%` }} />
                          </div>
                          <span className={cn("text-[10px] font-mono font-bold w-4 text-right", cfg.color)}>{count}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Engagement info */}
          <div className="rounded-xl border border-slate-800 bg-[#0D0F12] p-6">
            <SectionLabel
              icon={<Target className="w-3.5 h-3.5" />}
              label="Engagement"
              action={
                isActive ? (
                  <div className="flex items-center gap-1.5 text-[9px] font-mono font-bold uppercase text-emerald-400">
                    <div className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
                    Active
                  </div>
                ) : (
                  <span className="text-[9px] font-mono text-slate-600 uppercase">Closed</span>
                )
              }
            />

            {isLoading ? (
              <div className="space-y-3">
                {Array(4).fill(0).map((_, i) => <Bone key={i} className="h-9 w-full" />)}
              </div>
            ) : project ? (
              <div>
                <SummaryRow icon={<Target className="w-3 h-3" />}     label="Target" value={project.target ?? "—"} />
                <SummaryRow icon={<Zap className="w-3 h-3" />}        label="Type"   value={project.type ?? "—"} />
                <SummaryRow icon={<Calendar className="w-3 h-3" />}   label="Start"  value={fmt(project.startDate)} />
                <SummaryRow icon={<Clock className="w-3 h-3" />}      label="End"    value={fmt(project.endDate)} />
              </div>
            ) : (
              <p className="text-xs font-mono text-slate-700 text-center py-4">No project data</p>
            )}
          </div>

          {/* Quick nav */}
          <div className="rounded-xl border border-slate-800 bg-[#0D0F12] p-5">
            <SectionLabel icon={<Layers className="w-3.5 h-3.5" />} label="Quick Navigation" />
            <div className="space-y-1">
              {[
                { label: "Findings",    path: "findings", icon: <Bug      className="w-3.5 h-3.5" />, color: "text-red-400",    count: findings.length },
                { label: "Evidence",    path: "evidence", icon: <FileImage className="w-3.5 h-3.5"/>, color: "text-cyan-400",   count: evidence.length },
                { label: "Notes",       path: "notes",    icon: <Lock     className="w-3.5 h-3.5" />, color: "text-violet-400", count: null },
                { label: "Logs",        path: "logs",     icon: <Activity className="w-3.5 h-3.5" />, color: "text-amber-400",  count: null },
              ].map((item) => (
                <button
                  key={item.path}
                  onClick={() => router.push(`/projects/${projectId}/${item.path}`)}
                  className="group w-full flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-slate-800/60 transition-colors text-left"
                >
                  <div className="flex items-center gap-2.5">
                    <span className={cn("transition-colors", item.color)}>{item.icon}</span>
                    <span className="text-xs font-mono text-slate-400 group-hover:text-slate-200 transition-colors">{item.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {item.count !== null && (
                      <span className="text-[10px] font-mono text-slate-700">{item.count}</span>
                    )}
                    <ChevronRight className="w-3 h-3 text-slate-700 group-hover:text-slate-400 group-hover:translate-x-0.5 transition-all" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

    