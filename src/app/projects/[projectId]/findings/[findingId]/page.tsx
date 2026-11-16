"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { doc, getDocs, collection, query, where, documentId } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useDoc } from "@/hooks/use-doc";
import { useProject } from "@/hooks/use-project";
import { useCollection } from "@/hooks/use-collection";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";
import { useFindings } from "@/hooks/use-findings";

import {
  ChevronRight, Pencil, Trash2, Hash, FileImage, ShieldAlert,
  Loader2, Link as LinkIcon, Bug, Activity, FileBarChart2
} from "@/components/icons";
import { cn } from "@/lib/utils";
import { SEVERITY_CONFIG, STATUS_CONFIG } from "@/lib/types";
import type { Finding, Evidence, FindingStatus, FindingSeverity } from "@/lib/types";
import type { ActivityLog } from "@/lib/activity-service";

import { FindingForm } from "@/components/findings/FindingForm";
import { StatusBadge, SeverityBadge } from "@/components/findings/SeverityBadge";
import { EvidenceSelectorModal } from "@/components/evidence/EvidenceSelectorModal";

function timeAgo(ts: any): string {
  if (!ts) return "—";
  try {
    const d = ts?.toDate ? ts.toDate() : new Date(ts);
    const diff  = Date.now() - d.getTime();
    const m = Math.floor(diff / 60_000);
    const h = Math.floor(diff / 3_600_000);
    const days = Math.floor(diff / 86_400_000);
    if (m < 1)  return "just now";
    if (m < 60) return `${m}m ago`;
    if (h < 24) return `${h}h ago`;
    return `${days}d ago`;
  } catch {
    return "—";
  }
}

export default function FindingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;
  const findingId = params.findingId as string;
  const { isGuest } = useAuth();
  
  const { project } = useProject(projectId);
  const { deleteFinding, updateFinding } = useFindings(projectId);
  const { data: finding, isLoading: findingLoading } = useDoc<Finding>(
    projectId && findingId && !isGuest ? doc(db, "projects", projectId, "findings", findingId) : null
  );

  const [evidenceItems, setEvidenceItems] = useState<Evidence[]>([]);
  const [evidenceLoading, setEvidenceLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [linkModalOpen, setLinkModalOpen] = useState(false);

  // Fetch linked evidence
  useEffect(() => {
    async function fetchEvidence() {
      if (isGuest) {
        setEvidenceLoading(false);
        return;
      }
      if (!finding?.evidenceIds || finding.evidenceIds.length === 0) {
        setEvidenceItems([]);
        setEvidenceLoading(false);
        return;
      }
      
      try {
        setEvidenceLoading(true);
        // split into chunks of 10 if necessary, but assume <= 10 for simplicity
        const q = query(
          collection(db, "projects", projectId, "evidence"),
          where(documentId(), "in", finding.evidenceIds.slice(0, 10))
        );
        const snap = await getDocs(q);
        const items = snap.docs.map(d => ({ id: d.id, ...d.data() } as Evidence));
        setEvidenceItems(items);
      } catch (err) {
        console.error("Failed to fetch evidence:", err);
      } finally {
        setEvidenceLoading(false);
      }
    }
    fetchEvidence();
  }, [projectId, finding?.evidenceIds, isGuest]);

  // Fetch Activity Logs
  const activityQuery = useMemo(() => {
    if (!projectId || isGuest) return null;
    return query(
      collection(db, "projects", projectId, "activity"),
      where("targetId", "==", findingId)
    );
  }, [projectId, findingId, isGuest]);
  
  const { data: activityData, isLoading: activityLoading } = useCollection<ActivityLog>(activityQuery);
  
  const recentActivity = useMemo(() => {
    if (!activityData) return [];
    return [...activityData]
      .sort((a, b) => {
        const da = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp as any);
        const db = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(b.timestamp as any);
        return db.getTime() - da.getTime();
      })
      .filter(a => a.action.startsWith("finding.status_changed"))
      .slice(0, 5);
  }, [activityData]);

  if (findingLoading) return (
    <div className="flex-1 flex items-center justify-center min-h-0">
      <Loader2 className="w-8 h-8 text-slate-500 animate-spin" />
    </div>
  );

  if (!finding) return (
    <div className="flex flex-col items-center justify-center flex-1 min-h-0">
      <div className="w-12 h-12 rounded-xl bg-slate-800/60 flex items-center justify-center mb-4">
        <Bug className="w-6 h-6 text-slate-500" />
      </div>
      <h3 className="text-lg font-sans font-semibold text-slate-300">Finding Not Found</h3>
      <p className="text-sm font-sans text-slate-500 mt-2">This finding may have been deleted.</p>
    </div>
  );

  const sevCfg = SEVERITY_CONFIG[finding.severity as FindingSeverity];
  const statCfg = STATUS_CONFIG[finding.status as FindingStatus];

  const handleDelete = async () => {
    try {
      if (deleteConfirm) {
        await deleteFinding(findingId);
        router.push(`/projects/${projectId}/findings`);
      } else {
        setDeleteConfirm(true);
        setTimeout(() => setDeleteConfirm(false), 3000);
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to delete finding");
    }
  };

  const mdComponents = {
    h1: ({node, ...props}: any) => <h1 className="text-xl font-bold font-sans text-slate-100 mt-6 mb-4" {...props} />,
    h2: ({node, ...props}: any) => <h2 className="text-lg font-bold font-sans text-slate-200 mt-5 mb-3" {...props} />,
    h3: ({node, ...props}: any) => <h3 className="text-md font-bold font-sans text-slate-300 mt-4 mb-2" {...props} />,
    p:  ({node, ...props}: any) => <p className="mb-4 text-slate-300 leading-relaxed" {...props} />,
    ul: ({node, ...props}: any) => <ul className="list-disc pl-5 mb-4 text-slate-300 space-y-1" {...props} />,
    ol: ({node, ...props}: any) => <ol className="list-decimal pl-5 mb-4 text-slate-300 space-y-1" {...props} />,
    li: ({node, ...props}: any) => <li {...props} />,
    a:  ({node, ...props}: any) => <a className="text-violet-400 hover:text-violet-300 underline underline-offset-2" target="_blank" rel="noopener noreferrer" {...props} />,
    code: ({node, inline, className, children, ...props}: any) => {
      const match = /language-(\w+)/.exec(className || "");
      return !inline ? (
        <pre className="p-4 bg-[#0A0B0D] border border-slate-800 rounded-lg overflow-x-auto mb-4 font-sans text-xs text-slate-300">
          <code className={className} {...props}>{children}</code>
        </pre>
      ) : (
        <code className="px-1.5 py-0.5 bg-slate-800/60 rounded text-amber-300 font-sans text-xs" {...props}>{children}</code>
      );
    },
    blockquote: ({node, ...props}: any) => <blockquote className="border-l-4 border-slate-700 pl-4 italic text-slate-400 mb-4 bg-slate-800/20 py-2 pr-4 rounded-r-lg" {...props} />
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 space-y-5 pb-8 overflow-y-auto scrollbar-thin">
      
      {/* ─── Header Section ────────────────────────────────────────────── */}
      <div className="flex-shrink-0">
        
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-[10px] font-sans text-slate-500 uppercase tracking-wider mb-4">
          <Link href="/" className="hover:text-slate-300 transition-colors">Projects</Link>
          <ChevronRight className="w-3 h-3" />
          <Link href={`/projects/${projectId}`} className="hover:text-slate-300 transition-colors truncate max-w-[120px]">
            {project?.name ?? "Project"}
          </Link>
          <ChevronRight className="w-3 h-3" />
          <Link href={`/projects/${projectId}/findings`} className="hover:text-slate-300 transition-colors">Findings</Link>
          <ChevronRight className="w-3 h-3" />
          <span className="text-slate-400 truncate max-w-[200px]">{finding.title}</span>
        </div>

        <div className="flex items-start justify-between gap-6">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold font-display text-slate-100 flex items-center gap-3">
              {finding.severity === "Critical" && (
                <div className="relative w-3 h-3 flex items-center justify-center flex-shrink-0">
                  <div className={cn("absolute inset-0 rounded-full animate-pulse", sevCfg.dot)} />
                  <div className={cn("absolute inset-0.5 rounded-full", sevCfg.bg)} />
                </div>
              )}
              {finding.title}
            </h1>
            
            <div className="flex items-center gap-3 mt-4">
              <SeverityBadge severity={finding.severity as FindingSeverity} />
              <StatusBadge status={finding.status as FindingStatus} />
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setEditing(true)}
              className="btn-secondary h-9 px-4 gap-2"
            >
              <Pencil className="w-3.5 h-3.5" />
              Edit
            </button>
            <button
              onClick={handleDelete}
              className={cn(
                "btn-icon h-9 px-3 gap-2",
                deleteConfirm ? "bg-red-500/10 border border-red-500/20 text-red-500" : "hover:text-red-400"
              )}
            >
              <Trash2 className="w-4 h-4" />
              {deleteConfirm && <span className="text-xs font-sans font-bold pr-1">Confirm</span>}
            </button>
          </div>
        </div>
      </div>

      {/* ─── Main Content ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-5 flex-shrink-0">
        
        {/* Left Column - Markdown Blocks */}
        <div className="space-y-5">
          <div className="rounded-xl border border-slate-800/60 bg-[#0D0F12] px-6 py-5">
            <h3 className="font-sans text-[10px] text-slate-600 uppercase tracking-wider mb-4 font-bold border-b border-slate-800 pb-2">Description</h3>
            <div className="prose prose-invert prose-sm max-w-none">
               <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
                 {finding.description}
               </ReactMarkdown>
            </div>
          </div>

          <div className="rounded-xl border border-slate-800/60 bg-[#0D0F12] px-6 py-5">
            <h3 className="font-sans text-[10px] text-slate-600 uppercase tracking-wider mb-4 font-bold border-b border-slate-800 pb-2">Steps to Reproduce</h3>
            <div className="prose prose-invert prose-sm max-w-none">
               <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
                 {finding.stepsToReproduce || "*No steps to reproduce provided.*"}
               </ReactMarkdown>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="rounded-xl border border-slate-800/60 bg-[#0D0F12] px-6 py-5">
               <h3 className="font-sans text-[10px] text-slate-600 uppercase tracking-wider mb-4 font-bold border-b border-slate-800 pb-2">Impact</h3>
               <div className="prose prose-invert prose-sm max-w-none">
                 <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
                   {finding.impact || "*No impact analysis provided.*"}
                 </ReactMarkdown>
               </div>
            </div>
            <div className="rounded-xl border border-slate-800/60 bg-[#0D0F12] px-6 py-5">
               <h3 className="font-sans text-[10px] text-slate-600 uppercase tracking-wider mb-4 font-bold border-b border-slate-800 pb-2">Remediation</h3>
               <div className="prose prose-invert prose-sm max-w-none">
                 <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
                   {finding.remediation || "*No remediation plan provided.*"}
                 </ReactMarkdown>
               </div>
            </div>
          </div>
        </div>

        {/* Right Column - Metadata */}
        <div className="space-y-5">
          <div className="rounded-xl border border-slate-800/60 bg-[#0D0F12] px-5 py-4">
            <h3 className="font-sans text-[10px] text-slate-600 uppercase tracking-wider mb-4 font-bold">Metadata</h3>
            <div className="space-y-4">
              <div>
                <span className="text-[10px] font-sans text-slate-600">Target</span>
                <p className="text-sm font-sans text-slate-300 break-all">{finding.target || "N/A"}</p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-[10px] font-sans text-slate-600">CVSS Score</span>
                  <div className="mt-0.5">
                    {finding.cvss !== undefined ? (
                      <span className={cn(
                        "text-sm font-sans font-bold px-2 py-0.5 rounded border bg-opacity-10",
                        finding.cvss >= 9.0 ? "text-red-400 bg-red-500 border-red-500/20" :
                        finding.cvss >= 7.0 ? "text-orange-400 bg-orange-500 border-orange-500/20" :
                        finding.cvss >= 4.0 ? "text-yellow-400 bg-yellow-500 border-yellow-500/20" :
                        "text-slate-400 bg-slate-500 border-slate-500/20"
                      )}>
                        {finding.cvss.toFixed(1)}
                      </span>
                    ) : (
                      <span className="text-sm font-sans text-slate-600">—</span>
                    )}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] font-sans text-slate-600">Created</span>
                  <p className="text-[11px] font-sans text-slate-400 mt-1">{format(new Date(finding.createdAt as any), "MMM d, yyyy")}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-[10px] font-sans text-slate-600">CWE ID</span>
                  <p className="text-xs font-sans text-slate-300 mt-1">
                    {finding.cweId ? (
                      <a href={`https://cwe.mitre.org/data/definitions/${finding.cweId.replace(/\D/g, '')}.html`} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-violet-400 transition-colors">
                        <Hash className="w-3 h-3" /> {finding.cweId}
                      </a>
                    ) : "—"}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] font-sans text-slate-600">OWASP ID</span>
                  <p className="text-xs font-sans text-slate-300 mt-1">{finding.owaspId || "—"}</p>
                </div>
              </div>
              
            </div>
          </div>

          <div className="rounded-xl border border-slate-800/60 bg-[#0D0F12] px-5 py-4">
            <h3 className="font-sans text-[10px] text-slate-600 uppercase tracking-wider mb-3 font-bold">Status History</h3>
            {activityLoading ? (
               <div className="flex justify-center py-4"><Loader2 className="w-4 h-4 text-slate-700 animate-spin" /></div>
            ) : recentActivity.length > 0 ? (
              <div className="space-y-3">
                {recentActivity.map((log) => (
                  <div key={log.id} className="flex items-start gap-3">
                    <div className="w-5 h-5 mt-0.5 rounded bg-slate-800/60 border border-slate-700/50 flex items-center justify-center flex-shrink-0">
                      <Activity className="w-3 h-3 text-slate-400" />
                    </div>
                    <div>
                       <p className="text-[11px] font-sans text-slate-300">
                          Changed to <span className="font-bold text-slate-200">{log.newValue}</span>
                       </p>
                       <p className="text-[10px] font-sans text-slate-500 mt-0.5">{timeAgo(log.timestamp)} by {log.userDisplay}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[10px] font-sans text-slate-600">No status changes recorded.</p>
            )}
          </div>
        </div>
      </div>

      {/* ─── Evidence Section ──────────────────────────────────────────── */}
      <div className="rounded-xl border border-slate-800/60 bg-[#0D0F12] px-6 py-5 flex-shrink-0">
         <div className="flex items-center justify-between mb-4">
           <h3 className="font-sans text-[10px] text-slate-600 uppercase tracking-wider font-bold">Linked Evidence</h3>
           <button onClick={() => setLinkModalOpen(true)} className="btn-secondary h-8 px-3 gap-2">
             <LinkIcon className="w-3.5 h-3.5" />
             Link Evidence
           </button>
         </div>
         
         {evidenceLoading ? (
            <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 text-slate-700 animate-spin" /></div>
         ) : evidenceItems.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
               {evidenceItems.map(item => (
                 <a key={item.id} href={item.storageUrl} target="_blank" rel="noreferrer" className="group rounded-lg border border-slate-800 bg-[#0A0B0D] p-3 flex items-start gap-3 hover:border-violet-500/30 transition-colors">
                   <div className="w-8 h-8 rounded bg-violet-500/10 border border-violet-500/20 flex items-center justify-center flex-shrink-0">
                     <FileImage className="w-4 h-4 text-violet-400" />
                   </div>
                   <div className="flex-1 min-w-0">
                     <p className="text-xs font-sans font-semibold text-slate-300 truncate group-hover:text-violet-400 transition-colors">{item.name}</p>
                     <p className="text-[10px] font-sans text-slate-600 mt-1">{format(new Date(item.uploadedAt as any), "MMM d, yyyy")}</p>
                   </div>
                 </a>
               ))}
            </div>
         ) : (
            <div className="flex flex-col items-center justify-center py-8">
               <FileImage className="w-8 h-8 text-slate-700 mb-3" />
               <p className="text-xs font-sans text-slate-300">No evidence linked</p>
               <p className="text-[10px] font-sans text-slate-500 mt-1">You can attach evidence to this finding on the Evidence page.</p>
            </div>
         )}
      </div>

      {/* Editor Drawer */}
      <FindingForm
        open={editing}
        onClose={() => setEditing(false)}
        onSubmit={async (data) => {
          await updateFinding(findingId, data);
          setEditing(false);
          toast.success("Finding updated");
        }}
        initial={finding}
      />

      <EvidenceSelectorModal
        projectId={projectId}
        finding={finding}
        open={linkModalOpen}
        onClose={() => setLinkModalOpen(false)}
      />

    </div>
  );
}
