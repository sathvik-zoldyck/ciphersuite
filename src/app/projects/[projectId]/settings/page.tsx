"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { doc, updateDoc, deleteDoc, collection, getDocs, serverTimestamp, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useProject } from "@/hooks/use-project";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import {
  Settings, Save, Trash2, AlertTriangle, Shield,
  Globe, CheckCircle2, Loader2, Lock, Building2, Info,
} from "lucide-react";
import {
  PROJECT_TYPES, PROJECT_STATUSES,
  type ProjectType, type ProjectStatus, type Project
} from "@/lib/types";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProjectFormState {
  name:      string;
  target:    string;
  scope:     string;
  type:      ProjectType;
  status:    ProjectStatus;
  startDate: string;
  endDate:   string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toInputDate(value: any): string {
  if (!value) return "";
  try {
    const d = value?.toDate ? value.toDate() : new Date(value);
    return d.toISOString().slice(0, 10);
  } catch {
    return "";
  }
}

function sectionHeader(icon: React.ReactNode, title: string, desc: string) {
  return (
    <div className="flex items-start gap-4">
      <div className="w-9 h-9 rounded-lg bg-slate-800/70 border border-slate-700/60 flex items-center justify-center flex-shrink-0 mt-0.5">
        {icon}
      </div>
      <div>
        <h2 className="text-base font-bold font-display text-slate-100">{title}</h2>
        <p className="text-xs font-sans text-slate-600 mt-0.5">{desc}</p>
      </div>
    </div>
  );
}

// ─── Field components ─────────────────────────────────────────────────────────

function FieldLabel({ label, required, hint }: { label: string; required?: boolean; hint?: string }) {
  return (
    <div className="flex items-center justify-between mb-2">
      <label className="field-label">
        {label}
        {required && <span className="text-red-500/80 ml-1">*</span>}
      </label>
      {hint && <span className="text-[10px] font-sans text-slate-700">{hint}</span>}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const params    = useParams();
  const router    = useRouter();
  const projectId = params.projectId as string;

  const { project, isLoading: projectLoading } = useProject(projectId);
  const { isGuest, updateLocalProject, deleteLocalProject } = useAuth();

  // ── Form state ─────────────────────────────────────────────────────────────
  const [form, setForm]       = useState<ProjectFormState | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);

  // ── Danger zone ────────────────────────────────────────────────────────────
  const [deleteInput,   setDeleteInput]   = useState("");
  const [deleteStep,    setDeleteStep]    = useState<0 | 1 | 2>(0);
  const [deleting,      setDeleting]      = useState(false);
  const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Initialise form from loaded project
  useEffect(() => {
    if (!project || form) return;
    setForm({
      name:      project.name      ?? "",
      target:    project.target    ?? "",
      scope:     project.scope     ?? "",
      type:      project.type      ?? "Web Pentest",
      status:    project.status    ?? "Active",
      startDate: toInputDate(project.startDate),
      endDate:   toInputDate(project.endDate),
    });
  }, [project, form]);

  const set = useCallback(<K extends keyof ProjectFormState>(key: K, value: ProjectFormState[K]) => {
    setForm((prev) => prev ? { ...prev, [key]: value } : prev);
    setIsDirty(true);
    setSaved(false);
  }, []);

  const handleDiscard = useCallback(() => {
    if (!project) return;
    setForm({
        name: project.name ?? "",
        target: project.target ?? "",
        scope: project.scope ?? "",
        type: project.type ?? "Web Pentest",
        status: project.status ?? "Active",
        startDate: toInputDate(project.startDate),
        endDate: toInputDate(project.endDate),
    });
    setIsDirty(false);
  }, [project]);

  // ── Save ───────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!form || !isDirty) return;
    setSaving(true);
    try {
      const payload = {
        name:      form.name.trim(),
        target:    form.target.trim(),
        scope:     form.scope.trim(),
        type:      form.type,
        status:    form.status,
        startDate: form.startDate ? new Date(form.startDate) : null,
        endDate:   form.endDate   ? new Date(form.endDate)   : null,
      };

      if (isGuest) {
        updateLocalProject(projectId, payload as Partial<Project>);
      } else {
        await updateDoc(doc(db, "projects", projectId), {
          ...payload,
          updatedAt: serverTimestamp(),
        });
      }

      setIsDirty(false);
      setSaved(true);
      toast({title:"Project settings saved."});
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      toast({title:"Failed to save.", variant: 'destructive', description: err?.message});
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ─────────────────────────────────────────────────────────────────
  const handleDeleteClick = () => {
    if (deleteStep === 0) {
      setDeleteStep(1);
      deleteTimerRef.current = setTimeout(() => setDeleteStep(0), 15000);
    } else if (deleteStep === 1) {
      setDeleteStep(2);
    }
  };

  const handleConfirmDelete = async () => {
    if (deleteInput !== project?.name) return;
    setDeleting(true);
    try {
      if (isGuest) {
        deleteLocalProject(projectId);
      } else {
        const batch = writeBatch(db);
        const SUB = ["findings", "evidence", "notes", "logs", "reports"] as const;
        for (const sub of SUB) {
          const snap = await getDocs(collection(db, "projects", projectId, sub));
          snap.docs.forEach((d) => batch.delete(d.ref));
        }
        batch.delete(doc(db, "projects", projectId));
        await batch.commit();
      }
      toast({title:"Project deleted."});
      router.push("/");
    } catch (err: any) {
      toast({title:"Failed to delete project.", variant: 'destructive', description: err?.message});
      setDeleting(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  if (projectLoading || !form) {
    return (
      <div className="w-full max-w-4xl mx-auto space-y-8">
        <div className="h-8 w-48 skeleton rounded-lg" />
        <div className="h-64 skeleton rounded-xl" />
        <div className="h-48 skeleton rounded-xl" />
      </div>
    );
  }

  const STATUS_CONFIG: Record<ProjectStatus, { color: string; dot: string }> = {
    "Active":    { color: "text-emerald-400", dot: "bg-emerald-400" },
    "On Hold":   { color: "text-amber-400",   dot: "bg-amber-400"   },
    "Completed": { color: "text-slate-400",   dot: "bg-slate-500"   },
  };

  const canDelete = deleteInput === project?.name;

  return (
    <div className="flex flex-col flex-1 min-h-0 w-full max-w-4xl mx-auto space-y-8">

      {/* ── Page header ──────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-shrink-0">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="text-[11px] font-sans text-slate-600 mt-0.5">
            Project configuration and management
          </p>
        </div>

        {/* Save button */}
        <button
          onClick={handleSave}
          disabled={!isDirty || saving}
          className={cn(
            "flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-sans font-bold",
            "transition-all duration-150 flex-shrink-0",
            isDirty && !saving
              ? "bg-violet-500 hover:bg-violet-400 text-white "
              : "bg-slate-800 text-slate-600 cursor-not-allowed",
          )}
        >
          <AnimatePresence mode="wait">
            {saving ? (
              <motion.div key="saving" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Saving…
              </motion.div>
            ) : saved ? (
              <motion.div key="saved" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex items-center gap-2 text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Saved
              </motion.div>
            ) : (
              <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex items-center gap-2">
                <Save className="w-3.5 h-3.5" />
                Save Changes
              </motion.div>
            )}
          </AnimatePresence>
        </button>
      </div>

      {/* ── Project Details ───────────────────────────────────────────── */}
      <section className="rounded-xl border border-slate-800/60 bg-[#0D0F12] overflow-hidden">
        <div className="p-6">
          {sectionHeader(
            <Settings className="w-4 h-4 text-slate-500" />,
            "Project Details",
            "Core information about this engagement"
          )}

          <div className="space-y-5">
            {/* Name */}
            <div>
              <FieldLabel label="Project Name" required hint={`${form.name.length}/200`} />
              <input
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                maxLength={200}
                className="input-base"
                placeholder="e.g. AcmeCorp Web Application Pentest"
              />
            </div>

            {/* Target */}
            <div>
              <FieldLabel label="Target" required hint="URL, IP, or asset name" />
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-700 pointer-events-none" />
                <input
                  value={form.target}
                  onChange={(e) => set("target", e.target.value)}
                  maxLength={500}
                  className="input-base pl-9"
                  placeholder="https://target.com or 192.168.1.0/24"
                />
              </div>
            </div>

            {/* Scope */}
            <div>
              <FieldLabel label="Scope" hint={`${form.scope.length}/2000`} />
              <textarea
                value={form.scope}
                onChange={(e) => set("scope", e.target.value)}
                maxLength={2000}
                rows={3}
                className="input-base resize-none"
                placeholder="All subdomains of target.com. Exclude: staging.target.com, *.internal.target.com"
              />
            </div>

            {/* Type */}
            <div>
              <FieldLabel label="Project Type" required />
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                {PROJECT_TYPES.map((t) => (
                  <button
                    key={t}
                    onClick={() => set("type", t)}
                    className={cn(
                      "px-3 py-2 rounded-lg border text-left transition-all duration-100",
                      "text-[11px] font-sans font-medium",
                      form.type === t
                        ? "bg-violet-500/[0.08] border-violet-500/30 text-violet-300"
                        : "bg-transparent border-slate-800 text-slate-600 hover:border-slate-700 hover:text-slate-400"
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Status */}
            <div>
              <FieldLabel label="Status" required />
              <div className="flex gap-2">
                {PROJECT_STATUSES.map((s) => {
                  const cfg = STATUS_CONFIG[s];
                  return (
                    <button
                      key={s}
                      onClick={() => set("status", s)}
                      className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-lg border transition-all duration-100",
                        "text-[11px] font-sans font-semibold",
                        form.status === s
                          ? `bg-white/[0.04] border-slate-600 ${cfg.color}`
                          : "bg-transparent border-slate-800 text-slate-600 hover:border-slate-700"
                      )}
                    >
                      <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", cfg.dot)} />
                      {s}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <FieldLabel label="Start Date" />
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => set("startDate", e.target.value)}
                  className="input-base"
                />
              </div>
              <div>
                <FieldLabel label="End Date" />
                <input
                  type="date"
                  value={form.endDate}
                  onChange={(e) => set("endDate", e.target.value)}
                  className="input-base"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer with unsaved indicator */}
        <AnimatePresence>
          {isDirty && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{   opacity: 0, height: 0 }}
              className="border-t border-amber-500/20 bg-amber-500/[0.05] px-6 py-3 flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                <span className="text-[10px] font-sans text-amber-500/80">Unsaved changes</span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleDiscard}
                  className="text-[10px] font-sans text-slate-600 hover:text-slate-400 transition-colors"
                >
                  Discard
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="text-[10px] font-sans text-violet-400 hover:text-violet-300 transition-colors"
                >
                  Save now →
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* ── Project Info (read-only) ──────────────────────────────────── */}
      <section className="rounded-xl border border-slate-800/60 bg-[#0D0F12] p-6">
        {sectionHeader(
          <Info className="w-4 h-4 text-slate-500" />,
          "Project Information",
          "Read-only metadata managed by the system"
        )}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Project ID",   value: projectId },
            { label: "Owner",        value: project?.ownerId ?? "—" },
            { label: "Risk Score",   value: `${project?.riskScore ?? 0} / 100` },
            { label: "Created",      value: project?.createdAt ? new Date(project.createdAt as any).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—" },
          ].map(({ label, value }) => (
            <div key={label} className="p-3 rounded-lg bg-black/30 border border-slate-800/60">
              <p className="field-label mb-1">{label}</p>
              <p className="text-[11px] font-sans text-slate-400 truncate">{value}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Danger Zone ──────────────────────────────────────────────── */}
      <section className="rounded-xl border border-red-500/20 bg-red-500/[0.03] p-6">
        {sectionHeader(
          <AlertTriangle className="w-4 h-4 text-red-400" />,
          "Danger Zone",
          "Irreversible actions — proceed with caution"
        )}

        <div className="flex items-start justify-between gap-6 p-4 rounded-lg bg-black/30 border border-red-500/15">
          <div>
            <p className="text-sm font-sans font-semibold text-red-300/90 mb-1">
              Delete this project
            </p>
            <p className="text-xs font-sans text-red-500/40 leading-relaxed max-w-sm">
              Permanently deletes the project and all associated findings, evidence, notes, logs, and reports.
              This action cannot be undone.
            </p>
          </div>
          <button
            onClick={handleDeleteClick}
            disabled={deleting}
            className={cn(
              "flex items-center gap-2 h-8 px-4 rounded-lg flex-shrink-0",
              "border text-[11px] font-sans font-semibold transition-all duration-150",
              deleteStep > 0
                ? "bg-red-500/15 border-red-500/40 text-red-400 hover:bg-red-500/25"
                : "bg-transparent border-red-500/20 text-red-500/60 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30"
            )}
          >
            <Trash2 className="w-3.5 h-3.5" />
            {deleteStep === 0 ? "Delete Project" : "Are you sure?"}
          </button>
        </div>

        {/* Step 2 confirmation — type name to confirm */}
        <AnimatePresence>
          {deleteStep === 2 && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y:  0 }}
              exit={{   opacity: 0, y: -8 }}
              className="mt-4 p-4 rounded-lg bg-red-500/[0.06] border border-red-500/20 space-y-3"
            >
              <div className="flex items-center gap-2">
                <Lock className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                <p className="text-xs font-sans text-red-400">
                  Type <span className="font-bold text-red-300">"{project?.name}"</span> to confirm deletion
                </p>
              </div>

              <input
                value={deleteInput}
                onChange={(e) => setDeleteInput(e.target.value)}
                placeholder={project?.name}
                autoFocus
                className={cn(
                  "input-base transition-colors",
                  "bg-black/40 border-red-500/30 placeholder:text-red-500/20",
                  "focus:border-red-500/60 focus:ring-red-500/20",
                  deleteInput && !canDelete && "border-red-500/40",
                  canDelete && "border-emerald-500/40",
                )}
              />

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => { setDeleteStep(0); setDeleteInput(""); }}
                  className="h-9 rounded-lg border border-slate-700 bg-transparent text-xs font-sans text-slate-500 hover:text-slate-300 hover:border-slate-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmDelete}
                  disabled={!canDelete || deleting}
                  className={cn(
                    "h-9 rounded-lg text-xs font-sans font-bold transition-all",
                    canDelete && !deleting
                      ? "bg-red-500 hover:bg-red-400 text-white"
                      : "bg-slate-800 text-slate-600 cursor-not-allowed"
                  )}
                >
                  {deleting ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="w-3 h-3 animate-spin" /> Deleting…
                    </span>
                  ) : (
                    "Permanently Delete"
                  )}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────── */}
      <div className="flex items-center justify-center gap-1.5 py-4 flex-shrink-0">
        <Building2 className="w-3 h-3 text-slate-800" />
        <span className="text-[10px] font-sans text-slate-800">
          CipherSuite · Alcyone Secure
        </span>
      </div>
    </div>
  );
}

    