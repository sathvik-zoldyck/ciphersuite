"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Check, Loader2, Shield } from "lucide-react";
import { writeBatch, doc, arrayUnion, arrayRemove, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useFindings } from "@/hooks/use-findings";
import { logActivity } from "@/lib/activity-service";
import { toast } from "@/hooks/use-toast";
import { SeverityBadge } from "@/components/findings/SeverityBadge";
import type { Evidence, FindingSeverity } from "@/lib/types";

interface FindingSelectorModalProps {
  projectId: string;
  evidence: Evidence;
  open: boolean;
  onClose: () => void;
}

export function FindingSelectorModal({ projectId, evidence, open, onClose }: FindingSelectorModalProps) {
  const { user, isGuest } = useAuth();
  const { findings, isLoading } = useFindings(projectId);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const toggleLink = async (findingId: string, findingTitle: string, isLinked: boolean) => {
    if (isGuest) {
      toast.error("Guest users cannot link evidence.");
      return;
    }

    try {
      setProcessingId(findingId);
      const batch = writeBatch(db);
      
      const findingRef = doc(db, "projects", projectId, "findings", findingId);
      const evidenceRef = doc(db, "projects", projectId, "evidence", evidence.id);

      if (isLinked) {
        // Unlink
        batch.update(findingRef, { evidenceIds: arrayRemove(evidence.id), updatedAt: serverTimestamp() });
        batch.update(evidenceRef, { findingIds: arrayRemove(findingId), updatedAt: serverTimestamp() });
        await batch.commit();

        logActivity(projectId, user, "finding.updated", {
          targetId: findingId,
          targetTitle: findingTitle,
          field: "evidenceIds",
          newValue: `Unlinked evidence: ${evidence.name}`,
        });
        toast.success("Finding unlinked");
      } else {
        // Link
        batch.update(findingRef, { evidenceIds: arrayUnion(evidence.id), updatedAt: serverTimestamp() });
        batch.update(evidenceRef, { findingIds: arrayUnion(findingId), updatedAt: serverTimestamp() });
        await batch.commit();

        logActivity(projectId, user, "finding.updated", {
          targetId: findingId,
          targetTitle: findingTitle,
          field: "evidenceIds",
          newValue: `Linked evidence: ${evidence.name}`,
        });
        toast.success("Finding linked");
      }
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Failed to update link");
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2"
          >
            <div className="flex flex-col rounded-xl border border-slate-800 bg-[#0A0B0D] shadow-2xl shadow-black/60 overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-800/60 px-5 py-4">
                <h2 className="text-sm font-bold font-mono text-slate-200">Select Findings</h2>
                <button onClick={onClose} className="btn-icon h-7 w-7">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-2 max-h-72 overflow-y-auto scrollbar-thin">
                {isLoading ? (
                  <div className="flex justify-center py-6">
                    <Loader2 className="w-5 h-5 animate-spin text-slate-600" />
                  </div>
                ) : findings.length === 0 ? (
                  <div className="text-center py-8">
                    <Shield className="w-8 h-8 text-slate-700 mx-auto justify-center mb-2" />
                    <p className="text-xs font-mono text-slate-400">No findings found</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {findings.map(finding => {
                      const isLinked = evidence.findingIds?.includes(finding.id) || false;
                      const isProcessing = processingId === finding.id;

                      return (
                        <button
                          key={finding.id}
                          onClick={() => toggleLink(finding.id, finding.title, isLinked)}
                          disabled={isProcessing}
                          className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-white/[0.04] transition-colors border border-transparent hover:border-slate-800/60 disabled:opacity-50"
                        >
                          <div className="flex items-center gap-3 min-w-0 pr-4">
                            <SeverityBadge severity={finding.severity as FindingSeverity} size="sm" />
                            <span className="text-sm font-mono text-slate-300 truncate">{finding.title}</span>
                          </div>
                          <div className="flex-shrink-0 flex items-center justify-center w-5 h-5">
                            {isProcessing ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                            ) : isLinked ? (
                              <Check className="w-4 h-4 text-cyan-400" />
                            ) : null}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
