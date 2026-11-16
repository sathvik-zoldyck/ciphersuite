"use client";

import React, { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Upload, FileTerminal, Loader2, CheckSquare,
  Square, Search, CheckCircle2, ShieldAlert,
  ChevronLeft, Zap, AlertTriangle,
} from "@/components/icons";
import { cn } from "@/lib/utils";
import { SUPPORTED_TOOLS, type ToolType } from "@/lib/types";
import { summarizeXMLOutput } from "@/lib/parsers/parse-tool-output";
import { aiAnalyzeToolOutput, type SuggestedFinding } from "@/ai/flows/ai-suggest-findings-from-tool-output";
import { toast } from "@/hooks/use-toast";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  onClose:  () => void;
  onImport: (findings: SuggestedFinding[]) => Promise<void>;
}

// ─── Severity badge config ────────────────────────────────────────────────────

const SEV: Record<string, string> = {
  Critical:      "bg-red-500/10 border-red-500/25 text-red-400",
  High:          "bg-orange-500/10 border-orange-500/25 text-orange-400",
  Medium:        "bg-yellow-500/10 border-yellow-500/25 text-yellow-400",
  Low:           "bg-cyan-500/10 border-cyan-500/25 text-cyan-400",
  Informational: "bg-slate-500/10 border-slate-500/25 text-slate-400",
};

// ─── Tool grid layout — first 6 in 2-col, rest in 3-col ──────────────────────

const PRIMARY_TOOLS   = SUPPORTED_TOOLS.slice(0, 6) as ToolType[];
const SECONDARY_TOOLS = SUPPORTED_TOOLS.slice(6)    as ToolType[];

// ─── Component ────────────────────────────────────────────────────────────────

export function ToolImportDrawer({ onClose, onImport }: Props) {
  const [file,            setFile]            = useState<File | null>(null);
  const [tool,            setTool]            = useState<ToolType>("Nmap");
  const [isProcessing,    setIsProcessing]    = useState(false);
  const [findings,        setFindings]        = useState<SuggestedFinding[] | null>(null);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [isImporting,     setIsImporting]     = useState(false);
  const [isDragging,      setIsDragging]      = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── File handlers ──────────────────────────────────────────────────────────

  const acceptFile = useCallback((f: File) => {
    setFile(f);
    setFindings(null);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) acceptFile(e.target.files[0]);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files?.[0]) acceptFile(e.dataTransfer.files[0]);
  };

  // ── Process ────────────────────────────────────────────────────────────────

  const handleProcess = async () => {
    if (!file) return;
    setIsProcessing(true);
    try {
      const text    = await file.text();
      const summary = summarizeXMLOutput(tool, text);
      const result  = await aiAnalyzeToolOutput({ toolType: tool, toolOutput: summary, maxFindings: 30 });

      if (result?.findings) {
        setFindings(result.findings);
        setSelectedIndices(new Set(result.findings.map((_, i) => i)));
        toast({
          title: "Analysis complete",
          description: `Found ${result.findings.length} issue${result.findings.length !== 1 ? "s" : ""}.`
        });
      }
    } catch (err: any) {
      console.error(err);
      toast({ variant: "destructive", title: "Failed to analyze tool output.", description: err?.message });
    } finally {
      setIsProcessing(false);
    }
  };

  // ── Import ─────────────────────────────────────────────────────────────────

  const handleImport = async () => {
    if (!findings) return;
    const toImport = findings.filter((_, i) => selectedIndices.has(i));
    if (!toImport.length) return;

    setIsImporting(true);
    try {
      await onImport(toImport);
      toast({
        title: "Import Successful",
        description: `${toImport.length} finding${toImport.length !== 1 ? "s" : ""} imported.`,
      });
      onClose();
    } catch (err: any) {
      console.error(err);
      toast({ variant: "destructive", title: "Import failed.", description: err?.message });
    } finally {
      setIsImporting(false);
    }
  };

  // ── Selection helpers ──────────────────────────────────────────────────────

  const toggleSelect = (i: number) => {
    const next = new Set(selectedIndices);
    next.has(i) ? next.delete(i) : next.add(i);
    setSelectedIndices(next);
  };

  const toggleAll = () => {
    if (!findings) return;
    setSelectedIndices(
      selectedIndices.size === findings.length
        ? new Set()
        : new Set(findings.map((_, i) => i))
    );
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-40 bg-black/65 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <motion.div
        initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 300 }}
        className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-[520px] bg-[#0A0B0D] border-l border-slate-800 flex flex-col shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Top accent line */}
        <div className="h-[2px] flex-shrink-0 bg-gradient-to-r from-transparent via-violet-500/60 to-transparent" />

        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-800 flex-shrink-0 bg-[#0D0F12]">
          <div className="w-8 h-8 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center flex-shrink-0">
            <Zap className="w-4 h-4 text-violet-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold font-display text-slate-100">Import Tool Output</h2>
              <span className="text-[10px] font-sans font-bold text-violet-500/70 bg-violet-500/10 border border-violet-500/15 px-1.5 py-0.5 rounded uppercase tracking-wider">
                AI
              </span>
            </div>
            <p className="text-[10px] font-sans text-slate-600 mt-0.5">
              Parse Nmap · Nessus · Burp Suite scans into structured findings
            </p>
          </div>
          <button onClick={onClose} className="btn-icon h-7 w-7 flex-shrink-0">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Progress indicator */}
        <div className="flex items-center gap-0 flex-shrink-0 border-b border-slate-800/60">
          {[
            { label: "Select Tool",     active: !findings },
            { label: "Upload & Scan",   active: !findings },
            { label: "Review & Import", active: !!findings },
          ].map((step, i) => (
            <div
              key={i}
              className={cn(
                "flex-1 py-1.5 text-center text-[10px] font-sans font-bold uppercase tracking-[0.12em] transition-colors border-b-2",
                step.active && i < 2 && !findings
                  ? "text-violet-400 border-violet-500/50"
                  : findings && i === 2
                  ? "text-violet-400 border-violet-500/50"
                  : "text-slate-700 border-transparent"
              )}
            >
              {i + 1}. {step.label}
            </div>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto scrollbar-thin px-6 py-5">
          <AnimatePresence mode="wait">

            {/* ── Upload step ── */}
            {!findings && (
              <motion.div
                key="upload"
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                {/* Tool selector */}
                <div>
                  <p className="section-label mb-3">Security Tool</p>
                  <div className="grid grid-cols-2 gap-2">
                    {PRIMARY_TOOLS.map(t => (
                      <ToolButton key={t} tool={t} selected={tool === t} onClick={() => setTool(t)} />
                    ))}
                  </div>
                  {SECONDARY_TOOLS.length > 0 && (
                    <div className="grid grid-cols-3 gap-2 mt-2">
                      {SECONDARY_TOOLS.map(t => (
                        <ToolButton key={t} tool={t} selected={tool === t} onClick={() => setTool(t)} compact />
                      ))}
                    </div>
                  )}
                </div>

                {/* File upload */}
                <div>
                  <p className="section-label mb-3">Scan File</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xml,.json,.csv,.txt,.nessus"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    className={cn(
                      "relative flex flex-col items-center justify-center rounded-xl border-2 cursor-pointer transition-all duration-200 py-10",
                      isDragging
                        ? "border-violet-500/60 bg-violet-500/[0.06] scale-[1.01]"
                        : file
                        ? "border-violet-500/30 bg-violet-500/[0.04]"
                        : "border-dashed border-slate-800 hover:border-slate-700 hover:bg-white/[0.02]"
                    )}
                  >
                    {file ? (
                      <>
                        <div className="w-10 h-10 rounded-xl bg-violet-500/15 border border-violet-500/25 flex items-center justify-center mb-3">
                          <CheckCircle2 className="w-5 h-5 text-violet-400" />
                        </div>
                        <p className="text-sm font-sans font-bold text-violet-300 max-w-[260px] truncate px-4 text-center">
                          {file.name}
                        </p>
                        <p className="text-[10px] font-sans text-violet-500/50 mt-1 uppercase tracking-wider">
                          {(file.size / 1024).toFixed(1)} KB · Click to change
                        </p>
                      </>
                    ) : (
                      <>
                        <div className="w-11 h-11 rounded-xl bg-slate-800/80 flex items-center justify-center mb-3">
                          <Upload className="w-5 h-5 text-slate-500" />
                        </div>
                        <p className="text-sm font-sans font-semibold text-slate-400 mb-2">
                          {isDragging ? "Drop it!" : "Drop file or click to browse"}
                        </p>
                        <div className="flex items-center gap-2">
                          {["XML", "JSON", "CSV", "TXT", ".nessus"].map(ext => (
                            <span key={ext} className="text-[10px] font-sans text-slate-600 bg-slate-800/60 border border-slate-700/40 px-1.5 py-0.5 rounded">
                              {ext}
                            </span>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Tip */}
                {tool === "Burp Suite" && (
                  <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-xl bg-amber-500/[0.06] border border-amber-500/15">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500/70 flex-shrink-0 mt-0.5" />
                    <p className="text-[10px] font-sans text-amber-500/60 leading-relaxed">
                      Export from Burp Suite: Target → Issues → Right-click → Report issues → XML format.
                    </p>
                  </div>
                )}
                {tool === "Nessus" && (
                  <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-xl bg-amber-500/[0.06] border border-amber-500/15">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500/70 flex-shrink-0 mt-0.5" />
                    <p className="text-[10px] font-sans text-amber-500/60 leading-relaxed">
                      Export from Nessus: Scan → Export → Nessus format (.nessus XML).
                    </p>
                  </div>
                )}
              </motion.div>
            )}

            {/* ── Review step ── */}
            {findings && (
              <motion.div
                key="review"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 12 }}
                transition={{ duration: 0.2 }}
                className="space-y-3"
              >
                {/* Summary bar */}
                <div className="flex items-center justify-between sticky top-0 bg-[#0A0B0D] py-2 z-10">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="w-3.5 h-3.5 text-violet-400" />
                    <span className="text-[11px] font-sans font-bold text-slate-300">
                      {findings.length} issue{findings.length !== 1 ? "s" : ""} found
                    </span>
                    <span className="text-[10px] font-sans text-slate-600">
                      · {selectedIndices.size} selected
                    </span>
                  </div>
                  <button
                    onClick={toggleAll}
                    className="text-[10px] font-sans font-bold text-violet-400 hover:text-violet-300 border border-violet-500/20 bg-violet-500/[0.05] hover:bg-violet-500/10 px-2.5 py-1 rounded transition-colors uppercase tracking-wider"
                  >
                    {selectedIndices.size === findings.length ? "None" : "All"}
                  </button>
                </div>

                {/* Empty state */}
                {findings.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-slate-800 rounded-xl">
                    <CheckCircle2 className="w-8 h-8 text-slate-700 mb-3" />
                    <p className="text-sm font-sans text-slate-500">No significant issues detected.</p>
                    <p className="text-[10px] font-sans text-slate-700 mt-1">Try a different file or tool type.</p>
                  </div>
                )}

                {/* Finding cards */}
                <div className="space-y-2 pb-2">
                  {findings.map((f, i) => {
                    const selected = selectedIndices.has(i);
                    return (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.025, duration: 0.15 }}
                        onClick={() => toggleSelect(i)}
                        className={cn(
                          "relative flex gap-3 p-3.5 rounded-xl border cursor-pointer transition-all duration-150 overflow-hidden",
                          selected
                            ? "bg-violet-500/[0.05] border-violet-500/25"
                            : "bg-[#0D0F12] border-slate-800/60 hover:border-slate-700/60"
                        )}
                      >
                        {/* Left accent stripe */}
                        {selected && (
                          <div className="absolute left-0 top-0 bottom-0 w-[2.5px] bg-violet-500 rounded-l-xl" />
                        )}

                        {/* Checkbox */}
                        <div className="mt-0.5 flex-shrink-0">
                          {selected
                            ? <CheckSquare className="w-4 h-4 text-violet-400" />
                            : <Square className="w-4 h-4 text-slate-600" />
                          }
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-1.5">
                            <h4 className={cn(
                              "text-[12px] font-bold leading-snug",
                              selected ? "text-slate-100" : "text-slate-300"
                            )}>
                              {f.title}
                            </h4>
                            <span className={cn(
                              "flex-shrink-0 px-1.5 py-0.5 rounded text-[8px] font-sans font-bold tracking-wider uppercase border",
                              SEV[f.severity] ?? SEV.Informational
                            )}>
                              {f.severity}
                            </span>
                          </div>

                          {/* Meta row */}
                          <div className="flex items-center gap-3 mb-1.5 text-[10px] font-sans text-slate-600">
                            {f.target && (
                              <span className="truncate max-w-[160px]">
                                <span className="text-slate-700">→ </span>{f.target}
                              </span>
                            )}
                            {f.cvss && (
                              <span className={cn(
                                "font-bold",
                                f.cvss >= 9 ? "text-red-400" :
                                f.cvss >= 7 ? "text-orange-400" :
                                f.cvss >= 4 ? "text-yellow-400" : "text-slate-500"
                              )}>
                                CVSS {f.cvss}
                              </span>
                            )}
                            {f.cweId && <span>{f.cweId}</span>}
                          </div>

                          <p className="text-[11px] font-sans text-slate-500 leading-relaxed line-clamp-2">
                            {f.description}
                          </p>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 px-6 py-4 border-t border-slate-800 flex-shrink-0 bg-[#0D0F12]">
          {!findings ? (
            <>
              <button onClick={onClose} className="btn-secondary h-9 px-4">
                Cancel
              </button>
              <button
                onClick={handleProcess}
                disabled={!file || isProcessing}
                className={cn(
                  "flex-1 h-9 rounded-lg font-sans font-bold text-[11px] flex items-center justify-center gap-2 transition-all",
                  file && !isProcessing
                    ? "bg-violet-500 hover:bg-violet-400 text-white "
                    : "bg-slate-800/60 text-slate-600 cursor-not-allowed"
                )}
              >
                {isProcessing
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Analyzing…</>
                  : <><Search className="w-3.5 h-3.5" />Analyze with AI</>
                }
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setFindings(null)}
                className="btn-secondary h-9 px-4 gap-2"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Back
              </button>
              <button
                onClick={handleImport}
                disabled={isImporting || selectedIndices.size === 0}
                className="flex-1 h-9 btn-primary gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isImporting
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Importing…</>
                  : <>Import {selectedIndices.size} Finding{selectedIndices.size !== 1 ? "s" : ""}</>
                }
              </button>
            </>
          )}
        </div>
      </motion.div>
    </>
  );
}

// ─── Tool button sub-component ────────────────────────────────────────────────

function ToolButton({
  tool, selected, onClick, compact = false,
}: {
  tool:     ToolType;
  selected: boolean;
  onClick:  () => void;
  compact?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 rounded-xl border text-left transition-all duration-150",
        compact ? "px-3 py-2 justify-center text-[10px]" : "px-3 py-2.5 text-[11px]",
        "font-sans",
        selected
          ? "bg-violet-500/10 border-violet-500/30 text-violet-300 shadow-[0_0_12px_rgba(139, 92, 246,0.08)]"
          : "bg-[#0D0F12] border-slate-800/60 text-slate-500 hover:border-slate-700 hover:text-slate-300"
      )}
    >
      <FileTerminal className={cn("flex-shrink-0", compact ? "w-3 h-3" : "w-3.5 h-3.5", selected ? "text-violet-400" : "text-slate-600")} />
      {tool}
    </button>
  );
}
