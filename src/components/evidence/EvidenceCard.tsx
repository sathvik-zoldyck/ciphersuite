"use client";

import { useState, useRef, useMemo } from "react";
import { motion } from "framer-motion";
import {
  FileText, FileJson, FileCode, Terminal,
  Image as ImageIcon, FileArchive, FileSearch,
  Trash2, Download, Copy, Check, ExternalLink, Bug, Loader2
} from "@/components/icons";
import { cn, formatBytes } from "@/lib/utils";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { collection, query, where, documentId } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useCollection } from "@/hooks/use-collection";
import { SeverityBadge } from "@/components/findings/SeverityBadge";
import { FindingSelectorModal } from "./FindingSelectorModal";
import type { Evidence, Finding, FindingSeverity } from "@/lib/types";

// ─── File type config ─────────────────────────────────────────────────────────

interface FileTypeConfig {
  icon:   React.ReactNode;
  label:  string;
  color:  string;   // Tailwind text class
  bg:     string;   // Tailwind bg class
  stripe: string;   // Top accent stripe
}

function getFileConfig(name: string, mimeType?: string): FileTypeConfig {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";

  const IMAGE_EXTS = ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp"];
  const CODE_EXTS  = ["xml", "html", "htm", "js", "ts", "py", "rb", "php", "cs"];
  const LOG_EXTS   = ["log", "txt", "out"];
  const DATA_EXTS  = ["json", "yaml", "yml", "toml", "csv"];
  const ARCH_EXTS  = ["zip", "tar", "gz", "7z", "rar"];

  if (IMAGE_EXTS.includes(ext)) return {
    icon:   <ImageIcon className="w-5 h-5" />,
    label:  "Image",
    color:  "text-violet-400",
    bg:     "bg-violet-500/10",
    stripe: "bg-violet-500",
  };
  if (ext === "pdf") return {
    icon:   <FileText className="w-5 h-5" />,
    label:  "PDF",
    color:  "text-red-400",
    bg:     "bg-red-500/10",
    stripe: "bg-red-500",
  };
  if (DATA_EXTS.includes(ext)) return {
    icon:   <FileJson className="w-5 h-5" />,
    label:  ext.toUpperCase(),
    color:  "text-amber-400",
    bg:     "bg-amber-500/10",
    stripe: "bg-amber-500",
  };
  if (CODE_EXTS.includes(ext)) return {
    icon:   <FileCode className="w-5 h-5" />,
    label:  ext.toUpperCase(),
    color:  "text-violet-400",
    bg:     "bg-violet-500/10",
    stripe: "bg-violet-500",
  };
  if (LOG_EXTS.includes(ext)) return {
    icon:   <Terminal className="w-5 h-5" />,
    label:  "Log",
    color:  "text-emerald-400",
    bg:     "bg-emerald-500/10",
    stripe: "bg-emerald-500",
  };
  if (ARCH_EXTS.includes(ext)) return {
    icon:   <FileArchive className="w-5 h-5" />,
    label:  "Archive",
    color:  "text-orange-400",
    bg:     "bg-orange-500/10",
    stripe: "bg-orange-500",
  };

  return {
    icon:   <FileSearch className="w-5 h-5" />,
    label:  ext.toUpperCase() || "File",
    color:  "text-slate-400",
    bg:     "bg-slate-500/10",
    stripe: "bg-slate-600",
  };
}

// ─── Popover Logic ────────────────────────────────────────────────────────────

function EvidenceFindingsPopover({ evidence }: { evidence: Evidence }) {
  const [modalOpen, setModalOpen] = useState(false);
  
  const q = useMemo(() => {
    if (!evidence.findingIds || evidence.findingIds.length === 0) return null;
    return query(
      collection(db, "projects", evidence.projectId, "findings"),
      where(documentId(), "in", evidence.findingIds.slice(0, 10))
    );
  }, [evidence.findingIds, evidence.projectId]);

  const { data: findings, isLoading } = useCollection<Finding>(q);
  const count = evidence.findingIds?.length || 0;

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <Popover>
        <PopoverTrigger asChild>
          <button className="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-500/10 border border-slate-500/20 text-[10px] font-sans font-bold text-slate-300 hover:bg-slate-500/20 hover:text-white transition-colors">
            <Bug className="w-3 h-3 text-violet-400" />
            {count} {count === 1 ? "finding" : "findings"}
          </button>
        </PopoverTrigger>
        <PopoverContent 
          className="w-72 p-4 bg-[#0A0B0D] border border-slate-800 shadow-2xl shadow-black/80 rounded-xl z-50 overflow-hidden" 
          sideOffset={8}
        >
          <div className="space-y-4">
            <h4 className="text-[10px] font-sans font-bold text-slate-500 uppercase tracking-wider pl-1">
              Linked Findings
            </h4>
            
            {isLoading ? (
               <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 text-slate-600 animate-spin" /></div>
            ) : (!findings || findings.length === 0) ? (
               <p className="text-xs font-sans text-slate-500 text-center py-2">No findings linked to this evidence yet.</p>
            ) : (
               <div className="space-y-1.5 max-h-48 overflow-y-auto scrollbar-thin pr-1">
                 {findings.map(f => (
                   <div key={f.id} className="flex items-start gap-2.5 p-2 rounded-lg bg-white/[0.02] border border-transparent hover:border-slate-800/60 transition-colors">
                     <div className="mt-0.5"><SeverityBadge severity={f.severity as FindingSeverity} size="sm" /></div>
                     <span className="text-xs font-sans text-slate-300 leading-snug">{f.title}</span>
                   </div>
                 ))}
               </div>
            )}
            
            <button
               onClick={() => setModalOpen(true)}
               className="w-full btn-secondary h-8 px-3 text-xs"
            >
              Link Finding
            </button>
          </div>
        </PopoverContent>
      </Popover>

      <FindingSelectorModal
        projectId={evidence.projectId}
        evidence={evidence}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface EvidenceCardProps {
  evidence:     Evidence;
  view?:        "grid" | "list";
  index?:       number;
  onDelete?:    (id: string) => void;
  onCopyPath?:  (path: string) => void;
}

// ─── Card ─────────────────────────────────────────────────────────────────────

export function EvidenceCard({
  evidence, view = "grid", index = 0, onDelete, onCopyPath,
}: EvidenceCardProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [copied,        setCopied]        = useState(false);
  const deleteTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const cfg = getFileConfig(evidence.name, evidence.fileType);

  const isImage = ["png","jpg","jpeg","gif","webp","svg","bmp"].includes(
    evidence.name.split(".").pop()?.toLowerCase() ?? ""
  );

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirmDelete) {
      clearTimeout(deleteTimer.current);
      onDelete?.(evidence.id);
    } else {
      setConfirmDelete(true);
      deleteTimer.current = setTimeout(() => setConfirmDelete(false), 3000);
    }
  };

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(evidence.storagePath);
    onCopyPath?.(evidence.storagePath);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── List view ───────────────────────────────────────────────────────────────
  if (view === "list") {
    return (
      <motion.div
        initial={{ opacity: 0, x: -6 }}
        animate={{ opacity: 1, x:  0 }}
        transition={{ delay: index * 0.03 }}
        className="group flex items-center justify-between gap-4 px-4 py-3 rounded-xl border border-slate-800/60 bg-[#0D0F12] hover:border-slate-700/60 transition-all"
      >
        <div className="flex items-center gap-4 flex-1 min-w-0">
          {/* Icon */}
          <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0", cfg.bg, cfg.color)}>
            {cfg.icon}
          </div>

          {/* Name + meta */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-sans font-medium text-slate-200 truncate" title={evidence.name}>
              {evidence.name}
            </p>
            <div className="flex items-center gap-3 mt-0.5 text-[10px] font-sans text-slate-600">
              <span className={cn("font-bold uppercase", cfg.color)}>{cfg.label}</span>
              {evidence.fileSize && <span>{formatBytes(evidence.fileSize)}</span>}
              {evidence.uploadedAt && (
                <span>
                  {new Date(
                    (evidence.uploadedAt as any)?.toDate
                      ? (evidence.uploadedAt as any).toDate()
                      : evidence.uploadedAt
                  ).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Findings Badge & Actions */}
        <div className="flex items-center gap-4 flex-shrink-0">
          <EvidenceFindingsPopover evidence={evidence} />
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {evidence.storageUrl && (
              <a
                href={evidence.storageUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="btn-icon h-7 w-7"
                title="Open file"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
            <button onClick={handleCopy} className="btn-icon h-7 w-7" title="Copy storage path">
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
            {onDelete && (
              <button
                onClick={handleDelete}
                className={cn("btn-icon h-7 w-7", confirmDelete && "bg-red-500/10 border border-red-500/20 text-red-400")}
                title={confirmDelete ? "Click again to confirm" : "Delete"}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </motion.div>
    );
  }

  // ── Grid view ───────────────────────────────────────────────────────────────
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.04 }}
      className="group relative rounded-xl border border-slate-800/60 bg-[#0D0F12] overflow-visible hover:border-slate-700/60 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-black/40 transition-all duration-150 cursor-pointer flex flex-col"
    >
      {/* Top accent stripe */}
      <div className={cn("h-[3px] w-full flex-shrink-0 rounded-t-xl", cfg.stripe)} />

      {/* Preview area */}
      <div className="aspect-[4/3] flex items-center justify-center relative overflow-hidden bg-black/20">
        {isImage && evidence.storageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={evidence.storageUrl}
            alt={evidence.name}
            className="w-full h-full object-cover"
            onError={(e) => {
              // Fall back to icon if image fails to load
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          <div className={cn(
            "w-14 h-14 rounded-2xl flex items-center justify-center",
            cfg.bg, cfg.color,
          )}>
            {cfg.icon}
          </div>
        )}

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
          {evidence.storageUrl && (
            <a
              href={evidence.storageUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="w-8 h-8 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
              title="Open"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
          <button
            onClick={handleCopy}
            className="w-8 h-8 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
            title="Copy path"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
          {onDelete && (
            <button
              onClick={handleDelete}
              className={cn(
                "w-8 h-8 rounded-lg border flex items-center justify-center transition-colors",
                confirmDelete
                  ? "bg-red-500/30 border-red-500/50 text-red-300"
                  : "bg-white/10 border-white/20 text-white hover:bg-red-500/20 hover:border-red-500/40 hover:text-red-300"
              )}
              title={confirmDelete ? "Click again to confirm" : "Delete"}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="px-3 pb-3 pt-2.5 flex-1 flex flex-col justify-between">
        <div>
          <p className="text-[11px] font-sans font-medium text-slate-300 truncate mb-1.5" title={evidence.name}>
            {evidence.name}
          </p>
          <div className="flex items-center justify-between">
            <span className={cn("text-[10px] font-sans font-bold uppercase", cfg.color)}>
              {cfg.label}
            </span>
            {evidence.fileSize && (
              <span className="text-[10px] font-sans text-slate-700">
                {formatBytes(evidence.fileSize)}
              </span>
            )}
          </div>
        </div>
        <div className="mt-3 flex items-center border-t border-slate-800/60 pt-2.5">
          <EvidenceFindingsPopover evidence={evidence} />
        </div>
      </div>
    </motion.div>
  );
}
