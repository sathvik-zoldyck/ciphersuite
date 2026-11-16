
"use client";

import React, { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Copy, Search, Upload, X, ChevronDown, ChevronUp,
  Terminal, Filter, Hash, Zap, CheckCheck,
  AlertTriangle, Info, Activity, FileCode,
} from "@/components/icons";
import { useDoc } from '@/hooks/use-doc';
import { setDocument } from '@/lib/firestore';
import { db } from '@/lib/firebase';
import { doc, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { cn } from "@/lib/utils";
import { splitBySearch, tokenizeLogLine, type LogTokenType } from "@/lib/log-tokens";
import type { LogEntry } from "@/lib/types";

// ─── Debounce ─────────────────────────────────────────────────────────────────

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState<T>(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// ─── Log line classifier ──────────────────────────────────────────────────────

type LineType = "error" | "warning" | "success" | "info" | "request" | "normal";

function classifyLine(line: string): LineType {
  const l = line.toLowerCase();
  if (/(error|fail|denied|critical|fatal|exception|traceback)/i.test(line)) return "error";
  if (/(warn|warning|deprecated|notice)/i.test(line)) return "warning";
  if (/ (2\d{2}) /.test(line) || /(success|ok|accepted)/i.test(line)) return "success";
  if (/(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)/.test(line)) return "request";
  if (/(info|debug|\[i\])/i.test(line)) return "info";
  return "normal";
}

const LINE_TYPE_CONFIG: Record<LineType, { bar: string; rowBg: string; label?: string }> = {
  error:   { bar: "bg-red-500",    rowBg: "bg-red-500/[0.04] hover:bg-red-500/[0.07]",    label: "ERR"  },
  warning: { bar: "bg-yellow-400", rowBg: "bg-yellow-400/[0.04] hover:bg-yellow-400/[0.07]", label: "WRN" },
  success: { bar: "bg-emerald-400",rowBg: "bg-emerald-400/[0.04] hover:bg-emerald-400/[0.07]", label: "OK" },
  request: { bar: "bg-violet-400",   rowBg: "hover:bg-slate-800/40" },
  info:    { bar: "bg-blue-400",   rowBg: "hover:bg-slate-800/40" },
  normal:  { bar: "bg-slate-700",  rowBg: "hover:bg-slate-800/40" },
};

// ─── Syntax highlighter ───────────────────────────────────────────────────────

const TOKEN_CLASS: Record<LogTokenType, string> = {
  timestamp: "text-slate-500",
  ip:        "text-violet-300",
  string:    "text-amber-300/80",
  method:    "text-violet-400 font-semibold",
  status2xx: "text-emerald-400 font-semibold",
  status3xx: "text-blue-400 font-semibold",
  status4xx: "text-red-400 font-semibold",
  status5xx: "text-orange-400 font-semibold",
  error:     "text-red-400 font-semibold",
  warning:   "text-yellow-400",
  path:      "text-slate-400",
  kv:        "text-teal-300",
  text:      "",
};

/**
 * Renders one log line with token colours and search highlights.
 * Everything is a React text node: log content is never parsed as HTML,
 * because logs often contain attacker-controlled input.
 */
function HighlightedLine({ line, search }: { line: string; search: string }) {
  const tokens = useMemo(() => tokenizeLogLine(line), [line]);
  return (
    <span>
      {tokens.map((t, i) => (
        <span key={i} className={TOKEN_CLASS[t.type] || undefined}>
          {splitBySearch(t.text, search).map((part, j) =>
            part.match
              ? <mark key={j} className="bg-yellow-400/30 text-yellow-200 rounded-sm px-0.5">{part.text}</mark>
              : <span key={j}>{part.text}</span>,
          )}
        </span>
      ))}
    </span>
  );
}

// ─── Stats bar ────────────────────────────────────────────────────────────────

function LogStats({ lines }: { lines: string[] }) {
  const stats = useMemo(() => {
    let errors = 0, warnings = 0, requests = 0, successes = 0;
    for (const l of lines) {
      const t = classifyLine(l);
      if (t === "error") errors++;
      else if (t === "warning") warnings++;
      else if (t === "request") requests++;
      else if (t === "success") successes++;
    }
    return { errors, warnings, requests, successes, total: lines.length };
  }, [lines]);

  const items = [
    { label: "Lines",    value: stats.total,    color: "text-slate-400",   icon: <Hash className="w-3 h-3" /> },
    { label: "Errors",   value: stats.errors,   color: "text-red-400",     icon: <AlertTriangle className="w-3 h-3" /> },
    { label: "Warnings", value: stats.warnings, color: "text-yellow-400",  icon: <Zap className="w-3 h-3" /> },
    { label: "Requests", value: stats.requests, color: "text-violet-400",  icon: <Activity className="w-3 h-3" /> },
    { label: "2xx OK",   value: stats.successes,color: "text-emerald-400", icon: <CheckCheck className="w-3 h-3" /> },
  ];

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {items.map(({ label, value, color, icon }) => (
        <div
          key={label}
          className={cn(
            "flex items-center gap-1.5 px-2.5 py-1 rounded border",
            "bg-[#0D0F12] border-slate-800",
            value > 0 && label === "Errors" && "border-red-500/30 bg-red-500/[0.06]",
            value > 0 && label === "Warnings" && "border-yellow-400/20 bg-yellow-400/[0.04]",
          )}
        >
          <span className={cn("flex-shrink-0", color)}>{icon}</span>
          <span className={cn("text-[10px] font-mono font-semibold", value > 0 ? color : "text-slate-600")}>
            {value.toLocaleString()}
          </span>
          <span className="text-[10px] font-mono text-slate-600">{label}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Filter bar ───────────────────────────────────────────────────────────────

type FilterType = "all" | "error" | "warning" | "success" | "request";

const FILTER_OPTIONS: { key: FilterType; label: string; color: string; activeBg: string; activeBorder: string; }[] = [
  { key: "all",     label: "All",      color: "text-slate-400",  activeBg: "bg-slate-700",         activeBorder: "border-slate-500"    },
  { key: "error",   label: "Errors",   color: "text-red-400",    activeBg: "bg-red-500/15",        activeBorder: "border-red-500/50"   },
  { key: "warning", label: "Warnings", color: "text-yellow-400", activeBg: "bg-yellow-400/10",     activeBorder: "border-yellow-400/50"},
  { key: "success", label: "Success",  color: "text-emerald-400",activeBg: "bg-emerald-500/10",    activeBorder: "border-emerald-500/50"},
  { key: "request", label: "Requests", color: "text-violet-400", activeBg: "bg-violet-500/10",     activeBorder: "border-violet-500/50"},
];

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function LogsPage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const { toast } = useToast();
  const { isGuest, getLocalLog, setLocalLog } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  const [content, setContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [showLineNumbers, setShowLineNumbers] = useState(true);
  const [copiedAll, setCopiedAll] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // ── Data fetching ───────────────────────────────────────────────────────────
  const logDocRef = useMemo(
    () => (projectId && !isGuest ? doc(db, `projects/${projectId}/logs`, "main-log") : null),
    [projectId, isGuest]
  );
  const { data: firebaseLog, isLoading } = useDoc(logDocRef);
  const logData = isGuest ? getLocalLog(projectId) : firebaseLog;

  useEffect(() => {
    if (logData?.content !== undefined) setContent(logData.content);
  }, [logData?.content]);

  // ── Save ────────────────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      if (isGuest) {
        const existingLog = getLocalLog(projectId);
        setLocalLog(projectId, {
          id: 'main-log',
          projectId,
          name: 'Main Log',
          content: content,
          createdAt: existingLog?.createdAt ?? new Date(),
          updatedAt: new Date(),
        } as LogEntry);
      } else if (logDocRef) {
        const isCreating = !logData;
        const dataForFirestore: any = {
          content: content,
          updatedAt: serverTimestamp(),
        };
        if (isCreating) {
          dataForFirestore.projectId = projectId;
          dataForFirestore.name = "Main Log";
          dataForFirestore.createdAt = serverTimestamp();
        }
        await setDocument(logDocRef, dataForFirestore, { merge: true });
      }
      toast({ title: "Logs saved", description: "Log data has been saved to the project." });
    } catch {
      toast({ title: "Save failed", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  }, [isSaving, isGuest, content, logDocRef, projectId, setLocalLog, toast, getLocalLog, logData]);

  // ── Copy all ────────────────────────────────────────────────────────────────
  const handleCopyAll = useCallback(() => {
    navigator.clipboard.writeText(content);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  }, [content]);

  // ── File upload ─────────────────────────────────────────────────────────────
  const handleFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setContent((prev) => (prev ? prev + "\n" + text : text));
      toast({ title: `Loaded ${file.name}`, description: `${text.split("\n").length.toLocaleString()} lines added.` });
    };
    reader.readAsText(file);
  }, [toast]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  };

  // Drag-and-drop
  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const onDragLeave = () => setIsDragging(false);
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  // ── Line processing ─────────────────────────────────────────────────────────
  const debouncedSearch = useDebounce(searchTerm, 120);

  const allLines = useMemo(() => content.split("\n"), [content]);

  const processedLines = useMemo(() => {
    return allLines.map((line, i) => ({
      line,
      index: i + 1,
      type: classifyLine(line),
    }));
  }, [allLines]);

  const visibleLines = useMemo(() => {
    let lines = processedLines;
    if (filterType !== "all") {
      lines = lines.filter((l) => l.type === filterType);
    }
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase();
      lines = lines.filter((l) => l.line.toLowerCase().includes(q));
    }
    return lines;
  }, [processedLines, filterType, debouncedSearch]);

  const isEmpty = !content.trim();
  const hasFilters = filterType !== "all" || debouncedSearch.trim();

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div
      className="flex flex-col h-full gap-4"
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept=".log,.txt,.csv,.json,.xml,.out"
        onChange={handleFileInput}
      />

      {/* ── Page header ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
            <Terminal className="w-4 h-4 text-violet-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold font-display text-slate-100 leading-none">Logs</h1>
            <p className="text-[11px] font-mono text-slate-600 mt-0.5">
              {isEmpty ? "No log data loaded" : `${allLines.length.toLocaleString()} lines`}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-600 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search logs..."
              className={cn(
                "h-9 w-52 pl-9 pr-8 bg-[#0D0F12] border border-slate-700/60 rounded-lg",
                "text-xs font-mono text-slate-200 placeholder-slate-700",
                "focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20",
                "transition-colors"
              )}
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-300"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Line numbers toggle */}
          <button
            onClick={() => setShowLineNumbers(!showLineNumbers)}
            title="Toggle line numbers"
            className={cn(
              "h-9 px-3 rounded-lg border text-xs font-mono transition-colors",
              showLineNumbers
                ? "bg-violet-500/10 border-violet-500/30 text-violet-400"
                : "bg-[#0D0F12] border-slate-700/60 text-slate-600 hover:text-slate-400"
            )}
          >
            <Hash className="w-3.5 h-3.5" />
          </button>

          {/* Edit mode toggle */}
          <button
            onClick={() => setIsEditing(!isEditing)}
            className={cn(
              "h-9 px-3 rounded-lg border text-xs font-mono transition-colors",
              isEditing
                ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                : "bg-[#0D0F12] border-slate-700/60 text-slate-600 hover:text-slate-400"
            )}
          >
            <FileCode className="w-3.5 h-3.5" />
          </button>

          {/* Upload file */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="h-9 px-3 flex items-center gap-2 rounded-lg border border-slate-700/60 bg-[#0D0F12] text-xs font-mono text-slate-400 hover:text-slate-200 hover:border-slate-600 transition-colors"
          >
            <Upload className="w-3.5 h-3.5" />
            Upload
          </button>

          {/* Copy all */}
          <button
            onClick={handleCopyAll}
            disabled={isEmpty}
            className={cn(
              "h-9 px-3 flex items-center gap-2 rounded-lg border text-xs font-mono transition-all",
              copiedAll
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                : "bg-[#0D0F12] border-slate-700/60 text-slate-400 hover:text-slate-200 hover:border-slate-600",
              isEmpty && "opacity-40 cursor-not-allowed"
            )}
          >
            {copiedAll ? <CheckCheck className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copiedAll ? "Copied!" : "Copy"}
          </button>

          {/* Save */}
          <button
            onClick={handleSave}
            disabled={isSaving || isEmpty}
            className={cn(
              "h-9 px-4 flex items-center gap-2 rounded-lg text-xs font-mono font-semibold transition-all",
              "bg-violet-500 hover:bg-violet-400 text-white",
              "disabled:opacity-40 disabled:cursor-not-allowed",
              isSaving && "animate-pulse"
            )}
          >
            {isSaving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      {/* ── Stats bar ─────────────────────────────────────────────────── */}
      {!isEmpty && <LogStats lines={allLines} />}

      {/* ── Filter pills ──────────────────────────────────────────────── */}
      {!isEmpty && (
        <div className="flex items-center gap-2">
          <Filter className="w-3 h-3 text-slate-600 flex-shrink-0" />
          {FILTER_OPTIONS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilterType(f.key)}
              className={cn(
                "px-2.5 py-1 text-[10px] font-mono font-semibold rounded border transition-all uppercase tracking-wider",
                filterType === f.key
                  ? `${f.activeBg} ${f.activeBorder} ${f.color}`
                  : "bg-[#0D0F12] border-slate-800 text-slate-600 hover:text-slate-400 hover:border-slate-700"
              )}
            >
              {f.label}
            </button>
          ))}
          {hasFilters && (
            <button
              onClick={() => { setFilterType("all"); setSearchTerm(""); }}
              className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-mono text-slate-600 border border-slate-800 rounded hover:text-slate-400 transition-colors"
            >
              <X className="w-2.5 h-2.5" /> Clear
            </button>
          )}
          {hasFilters && (
            <span className="text-[10px] font-mono text-slate-600 ml-1">
              {visibleLines.length.toLocaleString()} / {allLines.length.toLocaleString()} lines
            </span>
          )}
        </div>
      )}

      {/* ── Log viewer / editor ───────────────────────────────────────── */}
      <div
        className={cn(
          "relative flex-1 min-h-0 rounded-xl border overflow-hidden transition-all",
          isDragging
            ? "border-violet-400/60 bg-violet-500/[0.04] "
            : "border-slate-800 bg-[#0A0B0D]"
        )}
      >
        {/* Drag overlay */}
        {isDragging && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center pointer-events-none">
            <Upload className="w-10 h-10 text-violet-400 mb-3" />
            <p className="text-sm font-mono font-semibold text-violet-400">Drop to load log file</p>
          </div>
        )}

        {/* Loading state */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="space-y-2 w-full max-w-2xl px-8">
              {Array(12).fill(0).map((_, i) => (
                <div key={i} className="flex gap-4 items-center">
                  <div
                    className="h-3 rounded bg-slate-800 animate-pulse flex-shrink-0"
                    style={{ width: 32, animationDelay: `${i * 50}ms` }}
                  />
                  <div
                    className="h-3 rounded bg-slate-800/60 animate-pulse"
                    style={{ width: `${40 + Math.random() * 50}%`, animationDelay: `${i * 50}ms` }}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && isEmpty && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer group"
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="relative mb-6">
              <div className="w-16 h-16 rounded-xl border border-slate-700/60 bg-slate-800/40 flex items-center justify-center group-hover:border-violet-500/40 group-hover:bg-violet-500/[0.04] transition-all">
                <Terminal className="w-8 h-8 text-slate-600 group-hover:text-violet-400 transition-colors" />
              </div>
              {/* Decorative scan lines */}
              <div className="absolute -inset-4 rounded-2xl border border-dashed border-slate-800/60 group-hover:border-violet-500/20 transition-colors" />
            </div>
            <p className="text-sm font-semibold font-display text-slate-400 group-hover:text-slate-200 transition-colors">
              No log data loaded
            </p>
            <p className="text-xs font-mono text-slate-600 mt-1.5 text-center max-w-xs">
              Paste logs below, drag & drop a file, or click to upload
            </p>
            <div className="flex items-center gap-4 mt-5">
              <span className="text-[10px] font-mono text-slate-700 uppercase tracking-wider">
                Supports .log · .txt · .json · .xml · .csv
              </span>
            </div>
          </div>
        )}

        {/* Edit mode — raw textarea */}
        {!isLoading && isEditing && (
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={"Paste raw log data here...\n\nDrag & drop a file or use the Upload button above."}
            className={cn(
              "absolute inset-0 w-full h-full resize-none",
              "bg-transparent text-slate-300 font-mono text-xs leading-5",
              "p-4 pl-5",
              "focus:outline-none",
              "placeholder-slate-800",
              "scrollbar-thin"
            )}
            spellCheck={false}
          />
        )}

        {/* View mode — highlighted lines */}
        {!isLoading && !isEditing && !isEmpty && (
          <div
            ref={viewportRef}
            className="absolute inset-0 overflow-y-auto overflow-x-auto scrollbar-thin"
          >
            {/* No results */}
            {visibleLines.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full">
                <Search className="w-10 h-10 text-slate-800 mb-3" />
                <p className="text-sm font-semibold text-slate-500 font-display">No matching lines</p>
                <p className="text-xs font-mono text-slate-600 mt-1">
                  {searchTerm ? `No results for "${searchTerm}"` : "No lines match the active filter"}
                </p>
              </div>
            )}

            {/* Lines */}
            {visibleLines.length > 0 && (
              <table className="w-full border-collapse">
                <tbody>
                  {visibleLines.map(({ line, index, type }) => {
                    const cfg = LINE_TYPE_CONFIG[type];
                    return (
                      <tr
                        key={index}
                        className={cn(
                          "group transition-colors",
                          cfg.rowBg
                        )}
                      >
                        {/* Severity indicator */}
                        <td className="w-0.5 p-0">
                          <div className={cn("w-0.5 h-full min-h-[20px]", cfg.bar)} />
                        </td>

                        {/* Line number */}
                        {showLineNumbers && (
                          <td className="w-12 py-0.5 pr-3 pl-4 text-right select-none align-top">
                            <span className="text-[10px] font-mono text-slate-700 group-hover:text-slate-500 transition-colors leading-5">
                              {index}
                            </span>
                          </td>
                        )}

                        {/* Type label badge */}
                        <td className="w-8 py-0.5 pr-2 align-top">
                          {cfg.label && (
                            <span
                              className={cn(
                                "text-[8px] font-mono font-bold tracking-wider leading-5",
                                type === "error" && "text-red-500",
                                type === "warning" && "text-yellow-500",
                                type === "success" && "text-emerald-500",
                              )}
                            >
                              {cfg.label}
                            </span>
                          )}
                        </td>

                        {/* Log content */}
                        <td className="py-0.5 pr-6 align-top">
                          <span className="text-xs font-mono text-slate-300 leading-5 break-all whitespace-pre-wrap">
                            <HighlightedLine line={line} search={debouncedSearch} />
                          </span>
                        </td>

                        {/* Copy line button */}
                        <td className="w-8 pr-3 align-top">
                          <button
                            onClick={() => navigator.clipboard.writeText(line)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-slate-700 hover:text-slate-400"
                            title="Copy line"
                          >
                            <Copy className="w-2.5 h-2.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Corner watermark when data is loaded */}
        {!isEmpty && (
          <div className="absolute bottom-3 right-4 text-[10px] font-mono text-slate-800 select-none pointer-events-none">
            CIPHERSUITE · LOG VIEWER
          </div>
        )}
      </div>

      {/* ── Bottom status bar ─────────────────────────────────────────── */}
      {!isEmpty && (
        <div className="flex items-center justify-between text-[10px] font-mono text-slate-700">
          <div className="flex items-center gap-4">
            <span>
              {visibleLines.length.toLocaleString()} lines shown
            </span>
            {hasFilters && (
              <span className="text-violet-600">
                {filterType !== "all" && `filter: ${filterType}`}
                {filterType !== "all" && debouncedSearch && " · "}
                {debouncedSearch && `search: "${debouncedSearch}"`}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {isEditing && <span className="text-amber-600">EDIT MODE</span>}
            <span>{content.length.toLocaleString()} chars</span>
          </div>
        </div>
      )}
    </div>
  );
}

