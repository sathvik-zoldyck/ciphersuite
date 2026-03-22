"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  collection, addDoc, onSnapshot, deleteDoc,
  doc, updateDoc, serverTimestamp, query, orderBy,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useProject } from "@/hooks/use-project";
import { useCollection } from "@/hooks/use-collection";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  FileBarChart2, Plus, Trash2, Download, Eye,
  ChevronRight, Loader2, CheckCircle2, AlertTriangle,
  FileText, Shield, Zap, Copy, Check, X,
  RefreshCw, Clock, BarChart3, Sparkles,
  Lock, Building2, Hash, FileDown,
} from "lucide-react";
import { generateReport as aiGenerateReport } from "@/ai/flows";
import { logActivity } from "@/lib/activity-service";
import { exportReportToPDF } from "@/lib/export-pdf";
import type {
  Report, ReportFormat, ReportTemplate, ReportSection, ReportSectionId,
  FindingSeverity, Finding,
} from "@/lib/types";

// ─── Constants ────────────────────────────────────────────────────────────────

const TEMPLATES: {
  id:       ReportTemplate;
  label:    string;
  desc:     string;
  icon:     React.ReactNode;
  color:    string;
  sections: ReportSectionId[];
}[] = [
  {
    id: "executive", label: "Executive Summary", color: "text-violet-400",
    desc: "High-level overview for C-suite and management. Minimal technical detail.",
    icon: <BarChart3 className="w-4 h-4" />,
    sections: ["executive_summary", "risk_overview", "key_findings"],
  },
  {
    id: "technical", label: "Technical Report", color: "text-cyan-400",
    desc: "Full technical detail for developers and security teams.",
    icon: <FileText className="w-4 h-4" />,
    sections: ["executive_summary", "methodology", "findings", "remediation"],
  },
  {
    id: "full", label: "Full Pentest Report", color: "text-emerald-400",
    desc: "Complete report with scope, methodology, all findings, and appendices.",
    icon: <Shield className="w-4 h-4" />,
    sections: ["cover", "executive_summary", "scope", "methodology", "findings", "evidence", "remediation", "appendix"],
  },
  {
    id: "bugbounty", label: "Bug Bounty Write-up", color: "text-amber-400",
    desc: "Platform-ready write-up format with PoC and impact justification.",
    icon: <Zap className="w-4 h-4" />,
    sections: ["executive_summary", "findings", "evidence", "impact"],
  },
];

const ALL_SECTIONS: ReportSection[] = [
  { id: "cover",             label: "Cover Page",           enabled: true,  desc: "Title, date, target, author"            },
  { id: "executive_summary", label: "Executive Summary",    enabled: true,  desc: "High-level risk overview for leadership" },
  { id: "scope",             label: "Scope & Objectives",   enabled: true,  desc: "Engagement scope and testing boundaries" },
  { id: "methodology",       label: "Methodology",          enabled: true,  desc: "Testing approach and tools used"         },
  { id: "risk_overview",     label: "Risk Overview",        enabled: true,  desc: "Severity distribution and summary"       },
  { id: "key_findings",      label: "Key Findings",         enabled: true,  desc: "Top critical and high vulnerabilities"   },
  { id: "findings",          label: "All Findings",         enabled: true,  desc: "Full finding details with all fields"    },
  { id: "evidence",          label: "Evidence",             enabled: false, desc: "Screenshots and PoC attachments"         },
  { id: "remediation",       label: "Remediation Roadmap",  enabled: true,  desc: "Prioritised fix plan with effort estimates"},
  { id: "impact",            label: "Impact Analysis",      enabled: true,  desc: "Business and technical impact statements" },
  { id: "appendix",          label: "Appendix",             enabled: false, desc: "Tool output, raw scan data, notes"        },
];

const CLASSIFICATION_OPTIONS = [
  { value: "CONFIDENTIAL",          color: "text-red-400",    bg: "bg-red-500/10",    border: "border-red-500/20"    },
  { value: "RESTRICTED",            color: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/20" },
  { value: "FOR INTERNAL USE ONLY", color: "text-amber-400",  bg: "bg-amber-500/10",  border: "border-amber-500/20"  },
  { value: "UNCLASSIFIED",          color: "text-slate-400",  bg: "bg-slate-500/10",  border: "border-slate-500/20"  },
];

// ─── Utility ──────────────────────────────────────────────────────────────────

function downloadText(content: string, filename: string, mime = "text/plain") {
  const blob = new Blob([content], { type: mime });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function formatRelativeTime(ts: any): string {
  if (!ts) return "—";
  try {
    const date = ts?.toDate ? ts.toDate() : new Date(ts);
    const diff  = Date.now() - date.getTime();
    const m = Math.floor(diff / 60_000);
    const h = Math.floor(diff / 3_600_000);
    const d = Math.floor(diff / 86_400_000);
    if (m < 1)  return "just now";
    if (m < 60) return `${m}m ago`;
    if (h < 24) return `${h}h ago`;
    return `${d}d ago`;
  } catch {
    return "—";
  }
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ icon, title, value, color, index }: {
  icon:  React.ReactNode;
  title: string;
  value: number;
  color: string;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="rounded-xl border border-slate-800/60 bg-[#0D0F12] px-4 py-3"
    >
      <div className={cn("flex items-center gap-2 mb-1.5", color)}>
        {icon}
        <span className="text-[9px] font-mono font-bold uppercase tracking-[0.12em] text-slate-600">
          {title}
        </span>
      </div>
      <p className="text-2xl font-mono font-bold text-slate-100">{value}</p>
    </motion.div>
  );
}

// ─── Report card ──────────────────────────────────────────────────────────────

function ReportCard({ report, onView, onDelete }: {
  report:   Report;
  onView:   (r: Report) => void;
  onDelete: (id: string) => void;
}) {
  const [confirm, setConfirm] = useState(false);
  const [copying, setCopying] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const tmpl = TEMPLATES.find((t) => t.id === report.template);

  const handleDelete = () => {
    if (confirm) { clearTimeout(timerRef.current); onDelete(report.id); }
    else {
      setConfirm(true);
      timerRef.current = setTimeout(() => setConfirm(false), 3000);
    }
  };

  const handleCopy = async () => {
    if (!report.content) return;
    await navigator.clipboard.writeText(report.content);
    setCopying(true); setTimeout(() => setCopying(false), 2000);
  };

  const handleDownload = async () => {
    if (report.format === "pdf" && report.content) {
      setDownloading(true);
      try {
        await exportReportToPDF(report.title, report.content);
        toast.success("PDF downloaded.");
      } catch (e: any) {
        console.error(e);
        toast.error("PDF export failed.");
      } finally {
        setDownloading(false);
      }
      return;
    }

    if(report.downloadUrl) {
        window.open(report.downloadUrl, '_blank');
        return;
    }
    if (!report.content) return;
    const name = `${report.title.replace(/\s+/g, "-").toLowerCase()}.md`;
    downloadText(report.content, name, "text/markdown");
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      className={cn(
        "rounded-xl border bg-[#0D0F12] transition-colors duration-150",
        report.status === "generating" ? "border-slate-700/60" :
        report.status === "failed"     ? "border-red-500/20"   :
                                         "border-slate-800/60 hover:border-slate-700/60",
      )}
    >
      <div className="flex items-center gap-4 px-5 py-4">
        {/* Icon */}
        <div className={cn(
          "w-9 h-9 rounded-lg border flex items-center justify-center flex-shrink-0",
          report.status === "generating" ? "bg-slate-800 border-slate-700" :
          report.status === "failed"     ? "bg-red-500/10 border-red-500/20" :
                                           `bg-slate-900 border-slate-800 ${tmpl?.color ?? ""}`
        )}>
          {report.status === "generating" ? <Loader2 className="w-4 h-4 text-slate-500 animate-spin" /> :
           report.status === "failed"     ? <AlertTriangle className="w-4 h-4 text-red-400" /> :
           tmpl?.icon}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <p className="text-sm font-mono font-semibold text-slate-200 truncate">{report.title}</p>
            {report.status === "ready" && (
              <span className="flex items-center gap-1 text-[9px] font-mono font-bold text-emerald-500 uppercase tracking-wider">
                <CheckCircle2 className="w-2.5 h-2.5" /> Ready
              </span>
            )}
            {report.status === "generating" && (
              <span className="text-[9px] font-mono text-slate-600 uppercase tracking-wider">Generating…</span>
            )}
            {report.status === "failed" && (
              <span className="text-[9px] font-mono text-red-500 uppercase tracking-wider">Failed</span>
            )}
          </div>
          <div className="flex items-center gap-3 text-[10px] font-mono text-slate-600 flex-wrap">
            <span>{tmpl?.label}</span>
            <span>·</span>
            <span>{report.findingCount} finding{report.findingCount !== 1 ? "s" : ""}</span>
            {report.wordCount && <><span>·</span><span>~{report.wordCount.toLocaleString()} words</span></>}
            <span>·</span>
            <span className="flex items-center gap-1">
              <Clock className="w-2.5 h-2.5" />
              {formatRelativeTime(report.createdAt)}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {report.status === "ready" && (
            <>
              <button onClick={() => onView(report)} className="btn-icon h-7 w-7" title="View">
                <Eye className="w-3.5 h-3.5" />
              </button>
              <button onClick={handleCopy} className="btn-icon h-7 w-7" title="Copy markdown">
                {copying ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
              <button 
                onClick={handleDownload} 
                className="btn-icon h-7 w-7" 
                title={`Download .${report.format}`}
                disabled={downloading}
              >
                {downloading ? (
                  <Loader2 className="w-3.5 h-3.5 text-cyan-400 animate-spin" />
                ) : (
                  <FileDown className="w-3.5 h-3.5" />
                )}
              </button>
            </>
          )}
          <button
            onClick={handleDelete}
            title={confirm ? "Click again to confirm" : "Delete"}
            className={cn(
              "btn-icon h-7 w-7",
              confirm && "bg-red-500/10 border border-red-500/20 text-red-400"
            )}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Error message */}
      {report.status === "failed" && report.error && (
        <div className="px-5 pb-4">
          <p className="text-[10px] font-mono text-red-400/70 bg-red-500/5 rounded-lg px-3 py-2 border border-red-500/15">
            {report.error}
          </p>
        </div>
      )}
    </motion.div>
  );
}

// ─── Report viewer ────────────────────────────────────────────────────────────

function ReportViewer({ report, onClose }: { report: Report; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(report.content ?? "");
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    downloadText(
      report.content ?? "",
      `${report.title.replace(/\s+/g, "-").toLowerCase()}.md`,
      "text/markdown"
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex"
      onClick={onClose}
    >
      <motion.div
        initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
        className="ml-auto w-full max-w-4xl h-full bg-[#080A0C] border-l border-slate-800 flex flex-col"
      >
        <div className="flex items-center gap-4 px-6 py-4 border-b border-slate-800 flex-shrink-0">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-mono font-semibold text-slate-200 truncate">{report.title}</p>
            <p className="text-[10px] font-mono text-slate-600 mt-0.5">
              {TEMPLATES.find((t) => t.id === report.template)?.label} · Markdown
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleCopy}    className="btn-icon h-7 w-7">
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
            <button onClick={handleDownload} className="btn-icon h-7 w-7" title="Download .md">
              <Download className="w-3.5 h-3.5" />
            </button>
            <div className="w-px h-4 bg-slate-800" />
            <button onClick={onClose} className="btn-icon h-7 w-7">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-thin px-6 py-6">
          <pre className="whitespace-pre-wrap font-mono text-[12px] text-slate-300 leading-relaxed">
            {report.content}
          </pre>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── New report drawer ────────────────────────────────────────────────────────

function NewReportDrawer({
  projectId, projectName, target, findings, onClose,
  onReportCreated, onReportUpdated,
}: {
  projectId:        string;
  projectName:      string;
  target:           string;
  findings:         any[];
  onClose:          () => void;
  onReportCreated:  (report: Report) => void;
  onReportUpdated:  (id: string, updates: Partial<Report>) => void;
}) {
  const { user, isGuest } = useAuth();

  const [step,           setStep]           = useState<1 | 2>(1);
  const [template,       setTemplate]       = useState<ReportTemplate>("full");
  const [sections,       setSections]       = useState<ReportSection[]>(ALL_SECTIONS);
  const [title,          setTitle]          = useState(`${projectName} — Security Assessment`);
  const [classification, setClassification] = useState("CONFIDENTIAL");
  const [companyName,    setCompanyName]    = useState("Alcyone Secure");
  const [authorName,     setAuthorName]     = useState(user?.displayName ?? "Security Analyst");
  const [generating,     setGenerating]     = useState(false);
  const [format,         setFormat]         = useState<ReportFormat>("markdown");

  const handleTemplateChange = (t: ReportTemplate) => {
    setTemplate(t);
    const tmpl = TEMPLATES.find((x) => x.id === t);
    setSections((prev) => prev.map((s) => ({ ...s, enabled: tmpl?.sections.includes(s.id as ReportSectionId) ?? false })));
  };

  const toggleSection = (id: string) =>
    setSections((prev) => prev.map((s) => s.id === id ? { ...s, enabled: !s.enabled } : s));

  const enabledSections = sections.filter((s) => s.enabled).map((s) => s.id);

  const handleGenerate = async () => {
    setGenerating(true);
    const reportTitle = title.trim() || `${projectName} Report`;

    // Optimistically create the report doc with status "generating"
    const base: Omit<Report, "id"> = {
      projectId,
      title: reportTitle,
      template,
      format: format,
      status: "generating",
      sections: enabledSections,
      findingCount: findings.length,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    let reportId: string;

    if (isGuest) {
      reportId = `guest_report_${Date.now()}`;
      onReportCreated({ ...base, id: reportId });
    } else {
      const ref = await addDoc(
        collection(db, "projects", projectId, "reports"),
        { ...base, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }
      );
      reportId = ref.id;
    }
    
    // We don't call onReportCreated for authenticated users here,
    // because the `useCollection` hook will pick up the new doc in real-time.

    await logActivity(projectId, user, "report.generated", {
      targetId: reportId,
      targetTitle: reportTitle,
    });

    onClose();
    toast({ title: "Report generation started.", description: "The AI is generating your report. This may take a moment." });

    try {
      const result = await aiGenerateReport({
          projectId, reportId,
          projectName, target, template, format,
          sections: enabledSections, findings, classification, authorName, companyName,
      });

      const updates   = { status: "ready" as const, content: result.content, wordCount: result.wordCount, downloadUrl: result.downloadUrl };

      if (!isGuest) {
        await updateDoc(doc(db, "projects", projectId, "reports", reportId), {
          ...updates, updatedAt: serverTimestamp(),
        });
      }
      onReportUpdated(reportId, updates);
      toast({ title: "Report ready.", description: `~${result.wordCount.toLocaleString()} words generated.` });

    } catch (err: any) {
      console.error("Report generation failed:", err);
      const errorMsg   = err?.message ?? "Unknown error during generation.";
      const updates = { status: "failed" as const, error: errorMsg };

      if (!isGuest) {
        await updateDoc(doc(db, "projects", projectId, "reports", reportId), {
          ...updates, updatedAt: serverTimestamp(),
        }).catch(() => {});
      }
      onReportUpdated(reportId, updates);
      toast({ variant: 'destructive', title: "Report generation failed.", description: errorMsg });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 26, stiffness: 280 }}
        className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-lg bg-[#0A0B0D] border-l border-slate-800 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-800 flex-shrink-0">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
            <FileBarChart2 className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-mono font-bold text-slate-100">New Report</p>
            <p className="text-[10px] font-mono text-slate-600">
              Step {step} of 2 — {step === 1 ? "Template" : "Details & Sections"}
            </p>
          </div>
          <button onClick={onClose} className="btn-icon h-7 w-7"><X className="w-3.5 h-3.5" /></button>
        </div>

        {/* Progress bar */}
        <div className="h-px bg-slate-800 flex-shrink-0">
          <motion.div
            className="h-full bg-cyan-500/60"
            animate={{ width: step === 1 ? "50%" : "100%" }}
            transition={{ duration: 0.3 }}
          />
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto scrollbar-thin px-6 py-5">
          <AnimatePresence mode="wait">
            {step === 1 ? (
              <motion.div key="step1" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} className="space-y-6">
                {/* Template picker */}
                <div className="space-y-2">
                  <p className="section-label">Template</p>
                  <div className="space-y-2">
                    {TEMPLATES.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => handleTemplateChange(t.id)}
                        className={cn(
                          "w-full flex items-center gap-4 px-4 py-3.5 rounded-xl border text-left transition-all",
                          template === t.id
                            ? "bg-cyan-500/[0.06] border-cyan-500/25"
                            : "bg-[#0D0F12] border-slate-800/60 hover:border-slate-700"
                        )}
                      >
                        <div className={cn(
                          "w-9 h-9 rounded-lg border flex items-center justify-center flex-shrink-0",
                          template === t.id ? `bg-slate-900 border-slate-700 ${t.color}` : "bg-slate-900 border-slate-800 text-slate-700"
                        )}>{t.icon}</div>
                        <div className="flex-1 min-w-0">
                          <p className={cn("text-xs font-mono font-semibold", template === t.id ? "text-slate-100" : "text-slate-400")}>{t.label}</p>
                          <p className="text-[10px] font-mono text-slate-600 mt-0.5">{t.desc}</p>
                        </div>
                        <div className={cn("w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0", template === t.id ? "bg-cyan-500 border-cyan-500" : "border-slate-700")}>
                          {template === t.id && <Check className="w-2.5 h-2.5 text-black" />}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Format */}
                <div className="space-y-2">
                  <p className="section-label">Output Format</p>
                  <div className="grid grid-cols-3 gap-2">
                    {(["markdown", "pdf", "docx"] as ReportFormat[]).map((f) => {
                      return (
                        <button
                          key={f}
                          onClick={() => setFormat(f)}
                          className={cn(
                            "flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl border",
                            format === f ? "bg-cyan-500/[0.06] border-cyan-500/25" : "bg-[#0D0F12] border-slate-800 text-slate-600 hover:border-slate-700"
                          )}
                        >
                          <FileText className={cn("w-4 h-4", format === f ? "text-cyan-400" : "text-slate-700")} />
                          <span className="text-[10px] font-mono font-semibold text-slate-400 uppercase">{f}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div key="step2" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} className="space-y-6">
                {/* Details */}
                <div className="space-y-3">
                  <p className="section-label">Report Details</p>
                  <div className="space-y-1.5">
                    <label className="field-label">Report Title</label>
                    <input value={title} onChange={(e) => setTitle(e.target.value)} className="input-base" placeholder="e.g. AcmeCorp Web App Security Assessment" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="field-label">Author</label>
                      <input value={authorName} onChange={(e) => setAuthorName(e.target.value)} className="input-base" placeholder="Security Analyst" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="field-label">Organisation</label>
                      <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="input-base" placeholder="Alcyone Secure" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="field-label">Classification</label>
                    <div className="grid grid-cols-2 gap-2">
                      {CLASSIFICATION_OPTIONS.map((c) => (
                        <button
                          key={c.value}
                          onClick={() => setClassification(c.value)}
                          className={cn(
                            "flex items-center gap-2 px-3 py-2 rounded-lg border text-left transition-all",
                            classification === c.value
                              ? `${c.bg} ${c.border} ${c.color}`
                              : "bg-[#0D0F12] border-slate-800 text-slate-600 hover:border-slate-700"
                          )}
                        >
                          <Hash className="w-2.5 h-2.5 flex-shrink-0" />
                          <span className="text-[9px] font-mono font-bold uppercase tracking-wider truncate">{c.value}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Sections */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="section-label">Sections</p>
                    <span className="text-[10px] font-mono text-slate-600">{enabledSections.length} selected</span>
                  </div>
                  <div className="space-y-1">
                    {sections.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => toggleSection(s.id)}
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all text-left",
                          s.enabled ? "bg-cyan-500/[0.04] border-cyan-500/15" : "bg-transparent border-slate-800/40 hover:border-slate-700/60"
                        )}
                      >
                        <div className={cn("w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border", s.enabled ? "bg-cyan-500/15 border-cyan-500/30" : "border-slate-700")}>
                          {s.enabled && <Check className="w-2.5 h-2.5 text-cyan-400" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={cn("text-xs font-mono", s.enabled ? "text-slate-200" : "text-slate-600")}>{s.label}</p>
                          <p className="text-[10px] font-mono text-slate-700">{s.desc}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Findings count pill */}
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-900/60 border border-slate-800/60">
                  <BarChart3 className="w-4 h-4 text-slate-600 flex-shrink-0" />
                  <p className="text-[11px] font-mono text-slate-500">
                    <span className="text-slate-300 font-semibold">{findings.length}</span>{" "}
                    finding{findings.length !== 1 ? "s" : ""} will be included
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 flex items-center gap-3 flex-shrink-0">
          {step === 1 ? (
            <>
              <button onClick={onClose} className="btn-secondary flex-1 h-9">Cancel</button>
              <button onClick={() => setStep(2)} className="btn-primary flex-1 h-9 gap-2">
                Next <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setStep(1)} className="btn-secondary flex-1 h-9">Back</button>
              <button
                onClick={handleGenerate}
                disabled={generating || enabledSections.length === 0}
                className="btn-primary flex-1 h-9 gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {generating
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating…</>
                  : <><Sparkles className="w-3.5 h-3.5" /> Generate</>
                }
              </button>
            </>
          )}
        </div>
      </motion.div>
    </>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const params    = useParams();
  const projectId = params.projectId as string;

  const { user, isGuest, loading: authLoading, getLocalReports, setLocalReports } = useAuth();
  const { project } = useProject(projectId);

  // Firestore real-time subscription for authenticated users
  const reportsRef = useMemo(() =>
    projectId && !isGuest && !authLoading
      ? query(collection(db, "projects", projectId, "reports"), orderBy("createdAt", "desc"))
      : null,
    [projectId, isGuest, authLoading]
  );

  const { data: firestoreReports, isLoading: reportsLoading } = useCollection<Report>(reportsRef);

  const localReports = useMemo(() => getLocalReports(projectId), [getLocalReports, projectId]);
  const reports = isGuest ? localReports : (firestoreReports ?? []);
  const loading  = !isGuest && (reportsLoading || authLoading);

  const [findings,   setFindings]   = useState<Finding[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [viewReport, setViewReport] = useState<Report | null>(null);

  // Subscribe to findings for stats and report generation
  useEffect(() => {
    if (!projectId || authLoading) return;
    const q = isGuest ? getLocalReports(projectId) : collection(db, "projects", projectId, "findings");
    if(isGuest) {
      // For guest, we can't get findings, so we'll just have an empty array
      setFindings([]);
      return;
    }

    const unsub = onSnapshot(
      q as any, // Cast needed because guest path is different
      (snap: any) => setFindings(snap.docs.map((d: any) => ({ id: d.id, ...d.data() } as Finding)))
    );
    return unsub;
  }, [projectId, isGuest, authLoading, getLocalReports]);

  const handleDelete = async (id: string) => {
    const reportToDelete = reports.find((r) => r.id === id);
    if (isGuest) {
      setLocalReports(projectId, localReports.filter((r) => r.id !== id));
    } else {
      await deleteDoc(doc(db, "projects", projectId, "reports", id));
    }
    await logActivity(projectId, user, "report.deleted", {
      targetId: id,
      targetTitle: reportToDelete?.title,
    });
    toast({ variant: "destructive", title: "Report deleted" });
  };

  // Callback from drawer when the optimistic report doc is created
  const handleReportCreated = useCallback((report: Report) => {
      const currentReports = getLocalReports(projectId);
      setLocalReports(projectId, [report, ...currentReports]);
  }, [projectId, getLocalReports, setLocalReports]);

  // Callback from drawer when the report status changes (ready/failed)
  const handleReportUpdated = useCallback((id: string, updates: Partial<Report>) => {
    setLocalReports(projectId, getLocalReports(projectId).map((r: any) => r.id === id ? {...r, ...updates} : r));
  }, [projectId, setLocalReports]);

  // Merged view: local optimistic + firestore (avoid duplicates)
  const displayReports = useMemo(() => {
    if (isGuest) return localReports;
    const firestoreIds = new Set((firestoreReports ?? []).map((r) => r.id));
    const optimistic   = localReports.filter((r) => !firestoreIds.has(r.id));
    return [...optimistic, ...(firestoreReports ?? [])].sort((a,b) => new Date(b.createdAt as any).getTime() - new Date(a.createdAt as any).getTime());
  }, [isGuest, localReports, firestoreReports]);

  const sevCounts = findings.reduce((acc, f) => {
    acc[f.severity as FindingSeverity] = (acc[f.severity as FindingSeverity] ?? 0) + 1;
    return acc;
  }, {} as Record<FindingSeverity, number>);

  const readyCount      = displayReports.filter((r) => r.status === "ready").length;
  const generatingCount = displayReports.filter((r) => r.status === "generating").length;

  return (
    <div className="flex flex-col flex-1 min-h-0 space-y-6">

      {/* ── Header ───────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-shrink-0">
        <div>
          <h1 className="page-title">Reports</h1>
          <p className="text-[11px] font-mono text-slate-600 mt-0.5">
            AI-generated professional reports from your findings
          </p>
        </div>
        <button onClick={() => setDrawerOpen(true)} className="btn-primary h-9 px-4 gap-2 flex-shrink-0">
          <Plus className="w-3.5 h-3.5" />
          New Report
        </button>
      </div>

      {/* ── Stats ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 flex-shrink-0">
        <StatCard index={0} color="text-slate-400"   icon={<FileBarChart2 className="w-3.5 h-3.5" />} title="Total Reports" value={displayReports.length} />
        <StatCard index={1} color="text-emerald-400" icon={<CheckCircle2  className="w-3.5 h-3.5" />} title="Ready"         value={readyCount} />
        <StatCard index={2} color="text-cyan-400"    icon={<RefreshCw className={cn("w-3.5 h-3.5", generatingCount > 0 && "animate-spin")} />} title="Generating" value={generatingCount} />
        <StatCard index={3} color="text-slate-400"   icon={<Shield        className="w-3.5 h-3.5" />} title="Findings"      value={findings.length} />
      </div>

      {/* ── Severity breakdown ───────────────────────────────────────── */}
      {findings.length > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-slate-800/40 bg-[#0D0F12]/60 flex-shrink-0 flex-wrap">
          <span className="text-[9px] font-mono text-slate-700 uppercase tracking-widest">Finding Breakdown</span>
          {(["Critical","High","Medium","Low","Informational"] as FindingSeverity[])
            .filter((s) => (sevCounts[s] ?? 0) > 0)
            .map((s) => {
              const colors: Record<FindingSeverity, string> = {
                Critical: "text-red-400 bg-red-500/10 border-red-500/20",
                High: "text-orange-400 bg-orange-500/10 border-orange-500/20",
                Medium: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
                Low: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
                Informational: "text-slate-400 bg-slate-500/10 border-slate-500/20",
              };
              return (
                <div key={s} className={cn("flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[10px] font-mono font-bold", colors[s])}>
                  <span>{sevCounts[s]}</span>
                  <span className="opacity-70">{s}</span>
                </div>
              );
            })}
        </div>
      )}

      {/* ── Report list ───────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0">
        {loading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => <div key={i} className="h-20 rounded-xl skeleton" />)}
          </div>
        ) : displayReports.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-2xl border border-dashed border-slate-800 bg-[#0D0F12] flex items-center justify-center mb-6">
              <FileBarChart2 className="w-7 h-7 text-slate-700" />
            </div>
            <h3 className="text-base font-bold font-display text-slate-300 mb-2">No Reports Yet</h3>
            <p className="text-sm font-mono text-slate-600 max-w-xs mb-6 leading-relaxed">
              Generate a professional report from your findings. AI will compile everything into a structured, client-ready document.
            </p>
            <button onClick={() => setDrawerOpen(true)} className="btn-primary h-9 px-5 gap-2">
              <Sparkles className="w-3.5 h-3.5" />
              Generate First Report
            </button>
            {findings.length === 0 && (
              <p className="text-[10px] font-mono text-amber-500/50 mt-4 flex items-center gap-1.5">
                <AlertTriangle className="w-3 h-3" />
                Add findings first to generate a meaningful report.
              </p>
            )}
          </div>
        ) : (
          <motion.div layout className="space-y-3">
            <AnimatePresence>
              {displayReports.map((r) => (
                <ReportCard key={r.id} report={r} onView={setViewReport} onDelete={handleDelete} />
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </div>

      {/* ── Footer ───────────────────────────────────────────────────── */}
      <div className="flex items-center justify-center gap-1.5 flex-shrink-0 pb-1">
        <Building2 className="w-2.5 h-2.5 text-slate-800" />
        <span className="text-[9px] font-mono text-slate-800">
          Reports generated by CipherSuite — Alcyone Secure
        </span>
      </div>

      {/* ── Drawer ────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {drawerOpen && project && (
          <NewReportDrawer
            projectId={projectId}
            projectName={project.name ?? "Project"}
            target={project.target ?? "Target"}
            findings={findings}
            onClose={() => setDrawerOpen(false)}
            onReportCreated={handleReportCreated}
            onReportUpdated={handleReportUpdated}
          />
        )}
      </AnimatePresence>

      {/* ── Viewer ────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {viewReport && (
          <ReportViewer report={viewReport} onClose={() => setViewReport(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}
