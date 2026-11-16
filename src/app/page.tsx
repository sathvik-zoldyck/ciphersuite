"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import {
  collection, addDoc, onSnapshot, deleteDoc,
  doc, updateDoc, serverTimestamp, query, orderBy, where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import {
  Plus, Shield, Bug, Paperclip, FileBarChart2,
  Trash2,
  Target, Calendar, ChevronRight, Loader2,
  StickyNote, Sparkles, Globe,
  X, AlertTriangle, Building2,
  Search, Grid3x3, List,
} from "lucide-react";
import {
  PROJECT_TYPES, PROJECT_STATUSES,
  type Project, type ProjectType, type ProjectStatus,
} from "@/lib/types";

const TYPE_ICONS: Record<string, React.ReactNode> = {
  "Web Pentest":        <Globe className="w-3.5 h-3.5" />,
  "Mobile Pentest":     <Shield className="w-3.5 h-3.5" />,
  "Network Pentest":    <Target className="w-3.5 h-3.5" />,
  "API Pentest":        <Bug className="w-3.5 h-3.5" />,
  "Infrastructure":     <Building2 className="w-3.5 h-3.5" />,
  "Bug Bounty":         <Sparkles className="w-3.5 h-3.5" />,
  "Cloud Review":       <Globe className="w-3.5 h-3.5" />,
  "Log Analysis":       <FileBarChart2 className="w-3.5 h-3.5" />,
  "Incident Response":  <AlertTriangle className="w-3.5 h-3.5" />,
  "Research":           <Sparkles className="w-3.5 h-3.5" />,
};

const STATUS_STYLES: Record<ProjectStatus, { dot: string; text: string; bg: string; border: string }> = {
  "Active":    { dot: "bg-emerald-400", text: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
  "On Hold":   { dot: "bg-amber-400",   text: "text-amber-400",   bg: "bg-amber-500/10",   border: "border-amber-500/20"   },
  "Completed": { dot: "bg-slate-500",   text: "text-slate-500",   bg: "bg-slate-500/10",   border: "border-slate-500/20"   },
};

function NewProjectDrawer({
  onClose,
  onCreated,
}: {
  onClose:   () => void;
  onCreated: (id: string) => void;
}) {
  const { user, isGuest, addLocalProject } = useAuth();

  const [name,      setName]      = useState("");
  const [type,      setType]      = useState<ProjectType>("Web Pentest");
  const [target,    setTarget]    = useState("");
  const [scope,     setScope]     = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate,   setEndDate]   = useState("");
  const [saving,    setSaving]    = useState(false);
  const [errors,    setErrors]    = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim())   e.name   = "Required";
    if (!target.trim()) e.target = "Required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleCreate = async () => {
    if (!validate()) return;
    setSaving(true);

    try {
      const payload = {
        name:      name.trim(),
        target:    target.trim(),
        scope:     scope.trim(),
        type,
        status:    "Active" as ProjectStatus,
        startDate: startDate ? new Date(startDate) : null,
        endDate:   endDate   ? new Date(endDate)   : null,
      };

      if (isGuest) {
        const proj = addLocalProject(payload as any);
        setSaving(false);
        onCreated(proj.id);
      } else if (user) {
        const ref = await addDoc(collection(db, "projects"), {
          ...payload,
          ownerId:   user.uid,
          riskScore: 0,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        setSaving(false);
        onCreated(ref.id);
      } else {
        setSaving(false);
        toast({ variant: "destructive", title: "Not authenticated", description: "Please sign in to create a project." });
      }
    } catch (err: any) {
      setSaving(false);
      toast({ variant: "destructive", title: "Failed to create project", description: err?.message });
    }
  };

  const field = (key: string) => ({
    error: errors[key],
    onFocus: () => setErrors((p) => { const n = { ...p }; delete n[key]; return n; }),
  });

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
        className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md bg-[#0A0B0D] border-l border-slate-800 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-800 flex-shrink-0">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
            <Plus className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-sans font-bold text-slate-100">New Project</p>
            <p className="text-[10px] font-sans text-slate-600">Create a new engagement workspace</p>
          </div>
          <button onClick={onClose} className="btn-icon h-7 w-7"><X className="w-3.5 h-3.5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin px-6 py-5 space-y-5">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="field-label">Project Name <span className="text-red-500">*</span></label>
              {errors.name && <span className="text-[9px] font-sans text-red-400">{errors.name}</span>}
            </div>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onFocus={field("name").onFocus}
              autoFocus
              maxLength={200}
              placeholder="e.g. AcmeCorp Web Application Pentest"
              className={cn("input-base", errors.name && "border-red-500/40")}
            />
          </div>

          <div>
            <label className="field-label block mb-2">Project Type <span className="text-red-500">*</span></label>
            <div className="grid grid-cols-2 gap-2">
              {PROJECT_TYPES.map((t) => (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  className={cn(
                    "flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left transition-all",
                    type === t
                      ? "bg-cyan-500/[0.08] border-cyan-500/30 text-cyan-300"
                      : "bg-[#0D0F12] border-slate-800/60 text-slate-600 hover:border-slate-700 hover:text-slate-400"
                  )}
                >
                  <span className={cn(type === t ? "text-cyan-400" : "text-slate-700")}>
                    {TYPE_ICONS[t] ?? <Shield className="w-3.5 h-3.5" />}
                  </span>
                  <span className="text-[11px] font-sans font-medium truncate">{t}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="field-label">Target <span className="text-red-500">*</span></label>
              {errors.target && <span className="text-[9px] font-sans text-red-400">{errors.target}</span>}
            </div>
            <input
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              onFocus={field("target").onFocus}
              maxLength={500}
              placeholder="https://target.com or 192.168.1.0/24"
              className={cn("input-base", errors.target && "border-red-500/40")}
            />
          </div>

          <div>
            <label className="field-label block mb-1.5">Scope</label>
            <textarea
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              maxLength={2000}
              rows={3}
              placeholder={"All subdomains of target.com\nExclude: staging.target.com"}
              className="input-base resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label block mb-1.5">Start Date</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="input-base" />
            </div>
            <div>
              <label className="field-label block mb-1.5">End Date</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="input-base" />
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-800 flex items-center justify-between flex-shrink-0">
          <span className="text-[9px] font-sans text-slate-700">* Required fields</span>
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="btn-secondary h-9 px-4">Cancel</button>
            <button onClick={handleCreate} disabled={saving} className="btn-primary h-9 px-5 gap-2 disabled:opacity-50">
              {saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Creating…</> : "Create Project"}
            </button>
          </div>
        </div>
      </motion.div>
    </>
  );
}

function ProjectCard({ project, index }: { project: Project; index: number }) {
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const deleteTimerRef = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const { isGuest, deleteLocalProject } = useAuth();

  const status = STATUS_STYLES[project.status] ?? STATUS_STYLES["Active"];

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirmDelete) {
      clearTimeout(deleteTimerRef.current);
      if (isGuest) {
        deleteLocalProject(project.id);
        toast({ title: "Project deleted." });
      } else {
        try {
          await deleteDoc(doc(db, "projects", project.id));
          toast({ title: "Project deleted." });
        } catch {
          toast({ variant: "destructive", title: "Failed to delete project." });
        }
      }
    } else {
      setConfirmDelete(true);
      deleteTimerRef.current = setTimeout(() => setConfirmDelete(false), 3000);
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.2, delay: index * 0.04 }}
      onClick={() => router.push(`/projects/${project.id}`)}
      className={cn(
        "group relative rounded-xl border border-slate-800/60 bg-[#0D0F12]",
        "cursor-pointer transition-all duration-150",
        "hover:border-slate-700/80 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-black/40",
      )}
    >
      <div className={cn("h-[2px] rounded-t-xl", status.dot)} />

      <div className="px-5 py-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-slate-800/80 border border-slate-700/40 flex items-center justify-center flex-shrink-0 text-slate-500">
              {TYPE_ICONS[project.type] ?? <Shield className="w-3.5 h-3.5" />}
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold font-display text-slate-100 truncate leading-tight">
                {project.name}
              </h3>
              <p className="text-[10px] font-sans text-slate-600 truncate">{project.type}</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={handleDelete}
              className={cn(
                "w-6 h-6 rounded-md flex items-center justify-center transition-all opacity-0 group-hover:opacity-100",
                confirmDelete
                  ? "bg-red-500/15 border border-red-500/20 text-red-400"
                  : "text-slate-700 hover:text-red-400 hover:bg-red-500/10"
              )}
              title={confirmDelete ? "Click again to confirm" : "Delete project"}
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-1.5 mb-3">
          <Target className="w-2.5 h-2.5 text-slate-700 flex-shrink-0" />
          <span className="text-[10px] font-sans text-slate-600 truncate">{project.target}</span>
        </div>

        <div className="flex items-center justify-between">
          <div className={cn(
            "flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[9px] font-sans font-bold uppercase tracking-wider",
            status.bg, status.border, status.text
          )}>
            <span className={cn("w-1 h-1 rounded-full", status.dot,
              project.status === "Active" && "animate-pulse"
            )} />
            {project.status}
          </div>

          <div className="flex items-center gap-1.5">
            <div className="text-right">
              <p className="text-[9px] font-sans text-slate-700 uppercase tracking-wider">Risk</p>
              <p className={cn("text-sm font-sans font-bold leading-none", {
                "text-red-400":     (project.riskScore ?? 0) > 70,
                "text-amber-400":   (project.riskScore ?? 0) > 40,
                "text-emerald-400": (project.riskScore ?? 0) <= 40,
              })}>
                {project.riskScore ?? 0}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-5 py-2.5 border-t border-slate-800/60 flex items-center justify-between">
        <div className="flex items-center gap-3 text-[9px] font-sans text-slate-700">
          {project.startDate && (
            <span className="flex items-center gap-1">
              <Calendar className="w-2.5 h-2.5" />
              {new Date(project.startDate as any).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
            </span>
          )}
        </div>
        <span className="text-[9px] font-sans text-slate-700 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          Open <ChevronRight className="w-3 h-3" />
        </span>
      </div>
    </motion.div>
  );
}

function DualEntryEmptyState({ onNewProject }: { onNewProject: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center flex-1 px-4">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-2xl"
      >
        <div className="text-center mb-10">
          <p className="text-[10px] font-sans text-cyan-500/60 uppercase tracking-[0.2em] mb-3">
            What would you like to do?
          </p>
          <h2 className="text-2xl font-bold font-display text-slate-100">
            Choose your workspace
          </h2>
          <p className="text-sm font-sans text-slate-600 mt-2">
            Start a security engagement or just take notes — no setup required.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <motion.button
            whileHover={{ y: -3 }}
            whileTap={{ scale: 0.98 }}
            onClick={onNewProject}
            className={cn(
              "group relative flex flex-col items-start text-left",
              "p-6 rounded-2xl border border-slate-800/60 bg-[#0D0F12]",
              "hover:border-cyan-500/30 hover:bg-cyan-500/[0.03]",
              "transition-all duration-200 overflow-hidden",
            )}
          >
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
              style={{ background: "radial-gradient(ellipse 60% 40% at 50% 0%, rgba(6,182,212,0.06), transparent)" }} />
            <div className="w-11 h-11 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mb-4">
              <Shield className="w-5 h-5 text-cyan-400" />
            </div>
            <h3 className="text-base font-bold font-display text-slate-100 mb-1">Security Project</h3>
            <p className="text-[11px] font-sans text-slate-600 mb-4 leading-relaxed">
              Pentest workspace with findings tracker, evidence vault, AI report generator, and logs.
            </p>
            <div className="flex flex-wrap gap-1.5 mb-5">
              {["Findings", "Evidence", "Reports", "AI Assist"].map((f) => (
                <span key={f} className="text-[9px] font-sans text-slate-600 bg-slate-800/60 border border-slate-700/40 rounded-full px-2 py-0.5">
                  {f}
                </span>
              ))}
            </div>
            <div className="flex items-center gap-2 text-[11px] font-sans font-bold text-cyan-400 group-hover:gap-3 transition-all">
              <Plus className="w-3.5 h-3.5" />
              New Project
              <ChevronRight className="w-3.5 h-3.5" />
            </div>
          </motion.button>

          <Link href="/notes">
            <motion.div
              whileHover={{ y: -3 }}
              whileTap={{ scale: 0.98 }}
              className={cn(
                "group relative flex flex-col items-start text-left h-full",
                "p-6 rounded-2xl border border-slate-800/60 bg-[#0D0F12]",
                "hover:border-violet-500/30 hover:bg-violet-500/[0.02]",
                "transition-all duration-200 cursor-pointer",
              )}
            >
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                style={{ background: "radial-gradient(ellipse 60% 40% at 50% 0%, rgba(139,92,246,0.06), transparent)" }} />
              <div className="w-11 h-11 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mb-4 relative">
                <StickyNote className="w-5 h-5 text-violet-400" />
              </div>
              <h3 className="text-base font-bold font-display text-slate-100 mb-1">Just Notes</h3>
              <p className="text-[11px] font-sans text-slate-600 mb-4 leading-relaxed">
                Color-coded personal notes with markdown, tags, pins, and self-destruct timers. No project needed.
              </p>
              <div className="flex items-center gap-2 mb-5">
                {["bg-red-500","bg-orange-500","bg-yellow-400","bg-emerald-500","bg-blue-500","bg-purple-500","bg-pink-500"].map((c) => (
                  <div key={c} className={cn("w-3.5 h-3.5 rounded-full", c)} />
                ))}
                <span className="text-[9px] font-sans text-slate-700 ml-1">9 colors</span>
              </div>
              <div className="flex items-center gap-2 text-[11px] font-sans font-bold text-violet-400 group-hover:gap-3 transition-all">
                <StickyNote className="w-3.5 h-3.5" />
                Open Notes
                <ChevronRight className="w-3.5 h-3.5" />
              </div>
            </motion.div>
          </Link>
        </div>

        <p className="text-center text-[10px] font-sans text-slate-800 mt-8">
          CipherSuite · Professional Cybersecurity Workspace · by Alcyone Secure
        </p>
      </motion.div>
    </div>
  );
}

export default function ProjectsDashboard() {
  const router = useRouter();
  const { user, isGuest, localData, loading: authLoading } = useAuth();

  const [firestoreProjects, setFirestoreProjects] = useState<Project[]>([]);
  const [loadingProjects,   setLoadingProjects]   = useState(true);
  const [drawerOpen,        setDrawerOpen]        = useState(false);
  const [search,            setSearch]            = useState("");
  const [statusFilter,      setStatusFilter]      = useState<ProjectStatus | "all">("all");
  const [viewMode,          setViewMode]          = useState<"grid" | "list">("grid");

  useEffect(() => {
    if (authLoading) return;

    if (!user && !isGuest) {
      router.push("/login");
      return;
    }

    if (isGuest) {
      setLoadingProjects(false);
      return;
    }

    if (!user) {
      return;
    }

    const q = query(
      collection(db, "projects"),
      where("ownerId", "==", user.uid)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const projectsFromDb = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Project));
        
        // Sort client-side to avoid needing a composite index
        projectsFromDb.sort((a, b) => {
            const timeA = (a.createdAt as any)?.toDate?.().getTime() ?? new Date(a.createdAt as any).getTime();
            const timeB = (b.createdAt as any)?.toDate?.().getTime() ?? new Date(b.createdAt as any).getTime();
            return timeB - timeA;
        });

        setFirestoreProjects(projectsFromDb);
        setLoadingProjects(false);
      },
      (error) => {
        console.error("Firestore onSnapshot error:", error);
        toast({
          variant: "destructive",
          title: "Failed to load projects",
          description: error.message,
        });
        setLoadingProjects(false);
      }
    );

    return unsub;
  }, [user, isGuest, authLoading]);

  const projects = isGuest ? localData.projects : firestoreProjects;
  const loading  = authLoading || loadingProjects;

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return projects.filter((p) => {
      if (q && !p.name.toLowerCase().includes(q) && !p.target.toLowerCase().includes(q)) return false;
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      return true;
    });
  }, [projects, search, statusFilter]);

  const handleCreated = useCallback((id: string) => {
    setDrawerOpen(false);
    router.push(`/projects/${id}`);
    toast({ title: "Project created" });
  }, [router]);

  return (
    <div className="min-h-screen bg-[#080A0C] flex flex-col">
      <div className="max-w-7xl mx-auto px-5 py-8 w-full flex flex-col flex-1">
        
        <DashboardHeader
          projects={projects}
          isGuest={isGuest}
          onNewProject={() => setDrawerOpen(true)}
        />

        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-48 rounded-xl skeleton" />
            ))}
          </div>
        )}

        {!loading && projects.length === 0 && (
          <DualEntryEmptyState onNewProject={() => setDrawerOpen(true)} />
        )}

        {!loading && projects.length > 0 && (
          <div className="space-y-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h1 className="page-title">Projects</h1>
                <p className="text-[11px] font-sans text-slate-600 mt-0.5">
                  {projects.length} engagement{projects.length !== 1 ? "s" : ""}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative hidden sm:block">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-700 pointer-events-none" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search…"
                    className="h-8 w-40 pl-7 pr-3 rounded-lg border border-slate-800 bg-[#0D0F12] text-[11px] font-sans text-slate-300 placeholder-slate-700 focus:outline-none focus:border-slate-700 transition-colors"
                  />
                </div>

                <div className="flex items-center bg-[#0D0F12] border border-slate-800 rounded-lg p-0.5">
                  {(["all", "Active", "On Hold", "Completed"] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setStatusFilter(s)}
                      className={cn(
                        "px-2.5 py-1.5 rounded-md text-[10px] font-sans transition-colors",
                        statusFilter === s ? "bg-slate-700/80 text-slate-200" : "text-slate-600 hover:text-slate-400"
                      )}
                    >
                      {s === "all" ? "All" : s}
                    </button>
                  ))}
                </div>

                <div className="flex items-center bg-[#0D0F12] border border-slate-800 rounded-lg p-0.5">
                  <button
                    onClick={() => setViewMode("grid")}
                    className={cn("p-1.5 rounded-md transition-colors", viewMode === "grid" ? "bg-slate-700/80 text-slate-200" : "text-slate-600 hover:text-slate-400")}
                  >
                    <Grid3x3 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setViewMode("list")}
                    className={cn("p-1.5 rounded-md transition-colors", viewMode === "list" ? "bg-slate-700/80 text-slate-200" : "text-slate-600 hover:text-slate-400")}
                  >
                    <List className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {filtered.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-sm font-sans text-slate-600">No projects match your filters.</p>
                <button
                  onClick={() => { setSearch(""); setStatusFilter("all"); }}
                  className="mt-2 text-xs font-sans text-cyan-400 hover:text-cyan-300"
                >
                  Clear filters →
                </button>
              </div>
            ) : (
              <motion.div
                layout
                className={cn(
                  viewMode === "grid"
                    ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
                    : "flex flex-col gap-3"
                )}
              >
                <AnimatePresence>
                  {filtered.map((project, i) => (
                    <ProjectCard key={project.id} project={project} index={i} />
                  ))}
                </AnimatePresence>
              </motion.div>
            )}
          </div>
        )}
      </div>

      <AnimatePresence>
        {drawerOpen && (
          <NewProjectDrawer
            onClose={() => setDrawerOpen(false)}
            onCreated={handleCreated}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
