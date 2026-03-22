
"use client";

import React, {
  useState, useMemo, useRef, useCallback, useEffect,
} from "react";
import { useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileImage, Grid3x3, List, Upload, Search, X,
  Filter, FolderOpen, HardDriveUpload, Plus,
  CheckCheck, SortAsc, Image as ImageIcon,
  FileText, Terminal, Archive, AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { collection, serverTimestamp, doc } from "firebase/firestore";
import { db, storage } from "@/lib/firebase";
import { useCollection } from "@/hooks/use-collection";
import { addDocument, deleteDocument } from "@/lib/firestore";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { EvidenceCard } from "@/components/evidence/EvidenceCard";
import type { Evidence } from "@/lib/types";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";
import { logActivity } from "@/lib/activity-service";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const EXT_TYPES = {
  image:    ["png", "jpg", "jpeg", "gif", "webp", "svg"],
  document: ["txt", "pdf", "csv", "md"],
  code:     ["json", "xml", "html", "js", "ts", "py", "sh"],
  log:      ["log"],
  archive:  ["zip", "tar", "gz", "rar"],
} as const;

type FilterType = "all" | keyof typeof EXT_TYPES;

function getExt(name: string) {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

function getTypeCategory(name: string): keyof typeof EXT_TYPES | null {
  const ext = getExt(name);
  for (const [cat, exts] of Object.entries(EXT_TYPES)) {
    if ((exts as readonly string[]).includes(ext)) return cat as keyof typeof EXT_TYPES;
  }
  return null;
}

function toDate(ts: any): Date | null {
  if (!ts) return null;
  try { return ts?.toDate?.() ?? new Date(ts); } catch { return null; }
}

// ─── Filter config ────────────────────────────────────────────────────────────

const FILTER_CFG: Record<FilterType, { label: string; icon: React.ReactNode; color: string }> = {
  all:      { label: "All",       icon: <Grid3x3   className="w-3 h-3" />, color: "text-slate-400"   },
  image:    { label: "Images",    icon: <ImageIcon  className="w-3 h-3" />, color: "text-violet-400"  },
  document: { label: "Documents", icon: <FileText   className="w-3 h-3" />, color: "text-cyan-400"    },
  code:     { label: "Code",      icon: <FileText   className="w-3 h-3" />, color: "text-amber-400"   },
  log:      { label: "Logs",      icon: <Terminal   className="w-3 h-3" />, color: "text-emerald-400" },
  archive:  { label: "Archives",  icon: <Archive    className="w-3 h-3" />, color: "text-orange-400"  },
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Bone({ className }: { className?: string }) {
  return <div className={cn("rounded bg-slate-800/80 animate-pulse", className)} />;
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ isDragging, onClick }: { isDragging: boolean; onClick: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border-2 border-dashed transition-all duration-200 py-20 px-8 cursor-pointer",
        isDragging
          ? "border-cyan-500/60 bg-cyan-500/[0.05] scale-[1.01]"
          : "border-slate-800 hover:border-slate-700 hover:bg-slate-800/20"
      )}
      onClick={onClick}
    >
      <div className="relative mb-6">
        <div className={cn(
          "w-20 h-20 rounded-2xl flex items-center justify-center transition-all duration-200",
          isDragging
            ? "bg-cyan-500/15 border border-cyan-500/30"
            : "bg-[#0D0F12] border border-slate-800"
        )}>
          <HardDriveUpload className={cn(
            "w-9 h-9 transition-colors duration-200",
            isDragging ? "text-cyan-400" : "text-slate-700"
          )} />
        </div>
        {/* Pulsing ring */}
        <div className={cn(
          "absolute -inset-3 rounded-3xl border animate-pulse transition-colors",
          isDragging ? "border-cyan-500/30" : "border-slate-800"
        )} />
      </div>

      <h3 className={cn(
        "text-base font-bold font-display mb-1.5 transition-colors",
        isDragging ? "text-cyan-300" : "text-slate-300"
      )}>
        {isDragging ? "Drop files here" : "Drop files or click to upload"}
      </h3>
      <p className="text-xs font-mono text-slate-600 text-center max-w-xs leading-relaxed">
        Screenshots, logs, JSON responses, Burp exports,<br />
        Nessus reports, text files — any evidence file
      </p>

      {!isDragging && (
        <div className="mt-6 flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-500 text-black text-xs font-mono font-bold shadow-lg shadow-cyan-500/20">
          <Plus className="w-3.5 h-3.5" />
          Upload Evidence
        </div>
      )}

      {/* Type chips */}
      <div className="mt-6 flex items-center gap-2 flex-wrap justify-center">
        {["PNG", "JPG", "LOG", "JSON", "XML", "PDF", "TXT"].map((t) => (
          <span key={t} className="text-[9px] font-mono text-slate-700 border border-slate-800 rounded px-1.5 py-0.5 uppercase tracking-wider">
            {t}
          </span>
        ))}
      </div>
    </motion.div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function EvidencePage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const { toast } = useToast();
  const { user, isGuest, getLocalEvidence, setLocalEvidence } = useAuth();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef  = useRef<HTMLDivElement>(null);

  const [view,       setView]       = useState<"grid" | "list">("grid");
  const [search,     setSearch]     = useState("");
  const [typeFilter, setTypeFilter] = useState<FilterType>("all");
  const [sort,       setSort]       = useState<"newest" | "oldest" | "name">("newest");
  const [dragging,   setDragging]   = useState(false);
  const [mounted,    setMounted]    = useState(false);

  useEffect(() => { setTimeout(() => setMounted(true), 60); }, []);

  // ── Data fetching ───────────────────────────────────────────────────────
  const colRef = useMemo(
    () => (projectId && !isGuest ? collection(db, `projects/${projectId}/evidence`) : null),
    [projectId, isGuest]
  );
  const { data: fbEvidence, isLoading: fbLoading } = useCollection<Evidence>(colRef);
  const localEvidence = useMemo(() => getLocalEvidence(projectId), [projectId, getLocalEvidence]);

  const allEvidence: Evidence[] = isGuest ? localEvidence : (fbEvidence ?? []);
  const isLoading = !isGuest && fbLoading;

  // ── Actions ─────────────────────────────────────────────────────────────

  const handleCopyPath = useCallback((path: string) => {
    navigator.clipboard.writeText(path);
    toast({
      title: "Path Copied",
      description: path,
    });
  }, [toast]);

  const handleDelete = useCallback((id: string) => {
    const evidenceToDelete = allEvidence.find(e => e.id === id);
    if (isGuest) {
      if (evidenceToDelete?.storageUrl?.startsWith('blob:')) {
          URL.revokeObjectURL(evidenceToDelete.storageUrl);
      }
      setLocalEvidence(projectId, allEvidence.filter(e => e.id !== id));
       toast({
        variant: 'destructive',
        title: 'Evidence Deleted',
        description: 'The evidence file record has been removed.',
      });
      return;
    }

    const docRef = doc(db, `projects/${projectId}/evidence`, id);
    deleteDocument(docRef)
      .then(() => {
        logActivity(projectId, user, "evidence.deleted", {
            targetId: id,
            targetTitle: evidenceToDelete?.name,
        });
        toast({
            variant: 'destructive',
            title: 'Evidence Deleted',
            description: 'The evidence file record has been removed.',
        });
      })
      .catch(serverError => {
          if (serverError.code === 'permission-denied') {
              const permissionError = new FirestorePermissionError({
                  path: docRef.path,
                  operation: 'delete',
              });
              errorEmitter.emit('permission-error', permissionError);
          } else {
              console.error("Failed to delete evidence:", serverError);
              toast({
                  variant: 'destructive',
                  title: 'Error',
                  description: serverError.message || 'Failed to delete evidence.',
              });
          }
      });
  }, [isGuest, projectId, allEvidence, setLocalEvidence, toast]);


  const handleUpload = useCallback(async (files: File[]) => {
    if (!files.length) return;

    if (isGuest) {
      const newEvidence = files.map(file => {
        const objectUrl = URL.createObjectURL(file);
        const now = new Date();
        const entry: Evidence = {
          id: `guest_${Date.now()}_${Math.random()}`,
          projectId,
          name: file.name,
          storagePath: `local/${file.name}`,
          storageUrl: objectUrl,
          fileType: file.type,
          fileSize: file.size,
          createdAt: now,
          updatedAt: now,
          uploadedAt: now,
        };
        return entry;
      });
      setLocalEvidence(projectId, [...localEvidence, ...newEvidence]);
      toast({
        title: "Evidence recorded",
        description: `${files.length} file(s) recorded locally for this session.`,
      });
      return;
    }

    // Firebase user upload
    toast({
      title: 'Uploading files...',
      description: `Uploading ${files.length} file(s). Please wait.`,
    });

    try {
      const uploadPromises = files.map(async (file) => {
        const storageRef = ref(storage, `evidence/${projectId}/${Date.now()}_${file.name}`);
        const snapshot = await uploadBytes(storageRef, file);
        const downloadURL = await getDownloadURL(snapshot.ref);

        if (colRef) {
          const docData = {
            projectId,
            name: file.name,
            storagePath: snapshot.ref.fullPath,
            storageUrl: downloadURL,
            fileType: file.type,
            fileSize: file.size,
            uploadedAt: serverTimestamp(),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          };
          addDocument(colRef, docData).then((ref) => {
            logActivity(projectId, user, "evidence.uploaded", {
              targetId: ref?.id,
              targetTitle: file.name,
            });
          }).catch(serverError => {
            if (serverError.code === 'permission-denied') {
              const permissionError = new FirestorePermissionError({
                path: colRef.path,
                operation: 'create',
                requestData: docData,
              });
              errorEmitter.emit('permission-error', permissionError);
            } else {
               console.error("Firestore write failed:", serverError);
            }
          });
        }
      });

      await Promise.all(uploadPromises);

      toast({
        title: 'Upload complete',
        description: `${files.length} file(s) successfully uploaded.`,
      });
    } catch (error) {
      console.error("Upload failed:", error);
      toast({
        variant: "destructive",
        title: "Upload Failed",
        description: "An error occurred while uploading files. Please check the console.",
      });
    }
  }, [projectId, isGuest, localEvidence, setLocalEvidence, colRef, toast]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) handleUpload(Array.from(e.target.files));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ── Drag & drop ────────────────────────────────────────────────────────
  const handleDragEnter = (e: React.DragEvent) => { e.preventDefault(); setDragging(true);  };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setDragging(false); };
  const handleDragOver  = (e: React.DragEvent) => { e.preventDefault(); };
  const handleDrop      = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length) handleUpload(files);
  };

  // ── Filtered + sorted evidence ─────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = [...allEvidence];

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((e) => e.name?.toLowerCase().includes(q));
    }

    if (typeFilter !== "all") {
      list = list.filter((e) => getTypeCategory(e.name ?? "") === typeFilter);
    }

    list.sort((a, b) => {
      if (sort === "name")    return (a.name ?? "").localeCompare(b.name ?? "");
      const at = toDate((a as any).uploadedAt ?? (a as any).createdAt)?.getTime() ?? 0;
      const bt = toDate((b as any).uploadedAt ?? (b as any).createdAt)?.getTime() ?? 0;
      return sort === "newest" ? bt - at : at - bt;
    });

    return list;
  }, [allEvidence, search, typeFilter, sort]);

  // Per-type counts for filter pills
  const typeCounts = useMemo(() => {
    const c: Record<FilterType, number> = { all: allEvidence.length, image: 0, document: 0, code: 0, log: 0, archive: 0 };
    allEvidence.forEach((e) => {
      const cat = getTypeCategory(e.name ?? "");
      if (cat) c[cat]++;
    });
    return c;
  }, [allEvidence]);

  const hasEvidence  = allEvidence.length > 0;
  const hasFilters   = search || typeFilter !== "all";

  return (
    <div
      ref={dropZoneRef}
      className={cn(
        "flex flex-col gap-5 min-h-full transition-all duration-300",
        mounted ? "opacity-100" : "opacity-0"
      )}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleFileChange}
        className="hidden"
        accept="*/*"
      />

      {/* Drag overlay */}
      <AnimatePresence>
        {dragging && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center"
            style={{ background: "rgba(8,10,12,0.85)" }}
          >
            <div className="flex flex-col items-center gap-4">
              <div className="w-24 h-24 rounded-3xl bg-cyan-500/15 border-2 border-cyan-500/40 flex items-center justify-center">
                <HardDriveUpload className="w-12 h-12 text-cyan-400" />
              </div>
              <p className="text-lg font-bold font-display text-cyan-300">Drop files to upload</p>
              <p className="text-xs font-mono text-slate-500">Release to add evidence to this project</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
            <FileImage className="w-4 h-4 text-violet-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold font-display text-slate-100 leading-none">Evidence</h1>
            {!isLoading && (
              <p className="text-[11px] font-mono text-slate-600 mt-0.5">
                {hasEvidence ? `${allEvidence.length} artifact${allEvidence.length !== 1 ? "s" : ""} collected` : "No evidence yet"}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex items-center bg-[#0D0F12] border border-slate-700/60 rounded-lg p-1 gap-0.5">
            {(["grid", "list"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn(
                  "p-2 rounded transition-colors",
                  view === v ? "bg-slate-700 text-slate-200" : "text-slate-600 hover:text-slate-400"
                )}
              >
                {v === "grid" ? <Grid3x3 className="w-3.5 h-3.5" /> : <List className="w-3.5 h-3.5" />}
              </button>
            ))}
          </div>

          {/* Upload button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-mono font-bold transition-all shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/30 hover:scale-[1.01] active:scale-[0.99]"
          >
            <Upload className="w-3.5 h-3.5" />
            Upload
          </button>
        </div>
      </div>

      {/* ── Loading ─────────────────────────────────────────────────────── */}
      {isLoading && (
        <div className={cn(
          "grid gap-4",
          view === "grid" ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5" : "grid-cols-1"
        )}>
          {Array(10).fill(0).map((_, i) => (
            <div key={i} className="rounded-xl border border-slate-800 bg-[#0D0F12] p-5" style={{ animationDelay: `${i * 50}ms` }}>
              {view === "grid" ? (
                <>
                  <Bone className="w-14 h-14 rounded-xl mx-auto mb-4" />
                  <Bone className="h-3 w-3/4 mx-auto mb-2" />
                  <Bone className="h-2 w-1/2 mx-auto" />
                </>
              ) : (
                <div className="flex items-center gap-4">
                  <Bone className="w-9 h-9 rounded-lg flex-shrink-0" />
                  <div className="flex-1"><Bone className="h-3 w-1/2 mb-2" /><Bone className="h-2 w-1/3" /></div>
                  <Bone className="h-5 w-12 rounded-full" />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Empty state ─────────────────────────────────────────────────── */}
      {!isLoading && !hasEvidence && (
        <EmptyState isDragging={dragging} onClick={() => fileInputRef.current?.click()} />
      )}

      {/* ── Evidence list ────────────────────────────────────────────────── */}
      {!isLoading && hasEvidence && (
        <>
          {/* Filter + search bar */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Search */}
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-600 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search evidence…"
                className="w-full pl-9 pr-8 h-9 bg-[#0D0F12] border border-slate-700/60 rounded-lg text-xs font-mono text-slate-200 placeholder-slate-700 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-colors"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-300 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Type filter pills */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <Filter className="w-3 h-3 text-slate-700 flex-shrink-0" />
              {(Object.keys(FILTER_CFG) as FilterType[]).map((t) => {
                const cfg = FILTER_CFG[t];
                const count = typeCounts[t];
                if (t !== "all" && count === 0) return null;
                return (
                  <button
                    key={t}
                    onClick={() => setTypeFilter(t)}
                    className={cn(
                      "flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[10px] font-mono transition-all",
                      typeFilter === t
                        ? `bg-slate-700 border-slate-500 text-slate-200`
                        : `border-slate-800 text-slate-600 hover:text-slate-400 hover:border-slate-700`
                    )}
                  >
                    <span className={typeFilter === t ? "text-slate-300" : cfg.color}>{cfg.icon}</span>
                    {cfg.label}
                    <span className={cn(
                      "text-[9px] font-bold",
                      typeFilter === t ? "text-slate-400" : "text-slate-700"
                    )}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Sort */}
            <div className="flex items-center bg-[#0D0F12] border border-slate-700/60 rounded-lg p-1 gap-0.5 ml-auto">
              <SortAsc className="w-3 h-3 text-slate-700 ml-1.5" />
              {(["newest", "oldest", "name"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setSort(s)}
                  className={cn(
                    "px-2.5 py-1 text-[10px] font-mono font-semibold uppercase tracking-wider rounded transition-colors",
                    sort === s ? "bg-slate-700 text-slate-200" : "text-slate-600 hover:text-slate-400"
                  )}
                >
                  {s}
                </button>
              ))}
            </div>

            {/* Clear + count */}
            {hasFilters && (
              <>
                <button
                  onClick={() => { setSearch(""); setTypeFilter("all"); }}
                  className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-mono text-slate-600 border border-slate-800 rounded-lg hover:text-slate-400 transition-colors"
                >
                  <X className="w-2.5 h-2.5" /> Clear
                </button>
                <span className="text-[10px] font-mono text-slate-600">
                  {filtered.length} / {allEvidence.length}
                </span>
              </>
            )}
          </div>

          {/* No results */}
          {filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 rounded-xl border border-dashed border-slate-800">
              <Search className="w-10 h-10 text-slate-800 mb-3" />
              <p className="text-sm font-display text-slate-500 font-bold">No matching files</p>
              <button
                onClick={() => { setSearch(""); setTypeFilter("all"); }}
                className="mt-3 text-xs font-mono text-cyan-400 hover:underline"
              >
                Clear filters
              </button>
            </div>
          )}

          {/* Grid view */}
          {filtered.length > 0 && view === "grid" && (
            <div
              className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
              onDrop={handleDrop}
              onDragOver={handleDragOver}
            >
              <AnimatePresence>
                {filtered.map((item, i) => (
                  <EvidenceCard 
                    key={item.id} 
                    evidence={item} 
                    view="grid" 
                    index={i} 
                    onDelete={handleDelete}
                    onCopyPath={handleCopyPath}
                  />
                ))}
              </AnimatePresence>

              {/* Upload tile */}
              <motion.button
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                onClick={() => fileInputRef.current?.click()}
                className="group rounded-xl border-2 border-dashed border-slate-800 hover:border-cyan-500/30 hover:bg-cyan-500/[0.03] transition-all duration-200 flex flex-col items-center justify-center gap-2.5 min-h-[140px] cursor-pointer"
              >
                <div className="w-10 h-10 rounded-xl border border-slate-700 bg-slate-800/60 flex items-center justify-center group-hover:border-cyan-500/40 group-hover:bg-cyan-500/10 transition-all">
                  <Plus className="w-5 h-5 text-slate-600 group-hover:text-cyan-400 transition-colors" />
                </div>
                <span className="text-[10px] font-mono text-slate-700 group-hover:text-cyan-400 transition-colors font-semibold uppercase tracking-wider">
                  Upload More
                </span>
              </motion.button>
            </div>
          )}

          {/* List view */}
          {filtered.length > 0 && view === "list" && (
            <div className="rounded-xl border border-slate-800 bg-[#0D0F12] overflow-hidden">
              {/* List header */}
              <div className="flex items-center gap-4 px-4 py-2.5 border-b border-slate-800 bg-[#0A0B0D]">
                <div className="w-9 flex-shrink-0" />
                <span className="text-[9px] font-mono font-bold text-slate-600 uppercase tracking-widest flex-1">File Name</span>
                <span className="text-[9px] font-mono font-bold text-slate-600 uppercase tracking-widest w-16 hidden sm:block">Type</span>
                <span className="text-[9px] font-mono font-bold text-slate-600 uppercase tracking-widest w-24 text-right hidden sm:block">Uploaded</span>
                <div className="w-14 flex-shrink-0" />
              </div>

              <div className="divide-y divide-slate-800/60">
                <AnimatePresence>
                  {filtered.map((item, i) => (
                    <EvidenceCard 
                      key={item.id} 
                      evidence={item} 
                      view="list" 
                      index={i} 
                      onDelete={handleDelete}
                      onCopyPath={handleCopyPath}
                    />
                  ))}
                </AnimatePresence>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
