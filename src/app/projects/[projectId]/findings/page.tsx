"use client";

import { useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Shield, AlertTriangle, Loader2,
  SortAsc, SortDesc, Bug, Upload,
  Filter, LayoutGrid, List,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useFindings } from "@/hooks/use-findings";
import { FindingCard }    from "@/components/findings/FindingCard";
import { FindingForm }    from "@/components/findings/FindingForm";
import { FindingFilters } from "@/components/findings/FindingFilters";
import { FindingsStats }  from "@/components/findings/FindingsStats";
import { ToolImportDrawer } from "@/components/findings/ToolImportDrawer";
import { SEVERITY_CONFIG, SEVERITIES_ORDERED } from "@/lib/types";
import type { Finding, FindingFormData, SortField } from "@/lib/types";

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ onAdd, onImport }: { onAdd: () => void; onImport: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-24 text-center"
    >
      <div className="w-16 h-16 rounded-2xl border border-dashed border-slate-800 bg-[#0D0F12] flex items-center justify-center mb-6">
        <Shield className="w-7 h-7 text-slate-700" />
      </div>
      <h3 className="text-base font-bold font-display text-slate-300 mb-2">
        No findings yet
      </h3>
      <p className="text-sm font-sans text-slate-600 max-w-xs mb-6 leading-relaxed">
        Start documenting vulnerabilities. Each finding feeds directly into your AI-generated reports.
      </p>
      <div className="flex items-center gap-3">
        <button onClick={onAdd} className="btn-primary h-9 px-5 gap-2">
          <Plus className="w-3.5 h-3.5" />
          Add First Finding
        </button>
        <button
          onClick={onImport}
          className="btn-secondary h-9 px-4 gap-2"
        >
          <Upload className="w-3.5 h-3.5" />
          Import from Tool
        </button>
      </div>
    </motion.div>
  );
}

// ─── No results state ─────────────────────────────────────────────────────────

function NoResults({ onClear }: { onClear: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <Filter className="w-8 h-8 text-slate-700 mb-4" />
      <p className="text-sm font-sans text-slate-500 mb-1">No findings match your filters.</p>
      <p className="text-[11px] font-sans text-slate-700 mb-4">Try adjusting the severity or status filter.</p>
      <button onClick={onClear} className="text-xs font-sans text-cyan-400 hover:text-cyan-300 transition-colors">
        Clear all filters →
      </button>
    </div>
  );
}

// ─── Severity group header ────────────────────────────────────────────────────

function SeverityGroup({
  severity, count, children,
}: {
  severity: string;
  count:    number;
  children: React.ReactNode;
}) {
  const cfg = SEVERITY_CONFIG[severity as keyof typeof SEVERITY_CONFIG];
  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <div className={cn("w-2 h-2 rounded-full flex-shrink-0", cfg.dot)} />
        <span className={cn("text-[10px] font-sans font-bold uppercase tracking-[0.15em]", cfg.color)}>
          {cfg.label}
        </span>
        <span className="text-[10px] font-sans text-slate-600">
          {count} {count === 1 ? "finding" : "findings"}
        </span>
        <div className="flex-1 h-px bg-slate-800/60" />
        {/* Critical findings get a pulsing indicator */}
        {severity === "Critical" && count > 0 && (
          <span className="flex items-center gap-1 text-[9px] font-sans text-red-400/70 uppercase tracking-wider">
            <span className="w-1 h-1 rounded-full bg-red-400 animate-pulse" />
            Urgent
          </span>
        )}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

// ─── Sort button ──────────────────────────────────────────────────────────────

function SortButton({
  label, sortKey, active, dir, onClick,
}: {
  label:   string;
  sortKey: SortField;
  active:  boolean;
  dir:     "asc" | "desc";
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1 text-[11px] font-sans transition-colors",
        active ? "text-cyan-400" : "text-slate-600 hover:text-slate-400"
      )}
    >
      {label}
      {active && (dir === "asc"
        ? <SortAsc  className="w-3 h-3" />
        : <SortDesc className="w-3 h-3" />
      )}
    </button>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function FindingsPage() {
  const params    = useParams();
  const projectId = params.projectId as string;

  const {
    findings, filtered,
    isLoading, error,
    stats, filters,
    setSearch, setSeverity, setStatus,
    setSortBy, setSortDir, clearFilters,
    addFinding, updateFinding, deleteFinding,
  } = useFindings(projectId);

  const [formOpen,    setFormOpen]    = useState(false);
  const [importOpen,  setImportOpen]  = useState(false);
  const [editTarget,  setEditTarget]  = useState<Finding | null>(null);
  const [viewMode,    setViewMode]    = useState<"grouped" | "list">("grouped");

  const openCreate = () => { setEditTarget(null); setFormOpen(true); };
  const openEdit   = (f: Finding) => { setEditTarget(f); setFormOpen(true); };
  const closeForm  = () => { setFormOpen(false); setEditTarget(null); };

  const handleSubmit = async (data: FindingFormData) => {
    if (editTarget) {
      await updateFinding(editTarget.id, data);
    } else {
      await addFinding(data);
    }
    closeForm();
  };

  const toggleSort = (key: SortField) => {
    if (filters.sortBy === key) {
      setSortDir(filters.sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortBy(key);
      setSortDir("desc");
    }
  };

  // Grouped view — only include severities that have matching findings
  const grouped = useMemo(() =>
    SEVERITIES_ORDERED
      .map((sev) => ({ severity: sev, items: filtered.filter((f) => f.severity === sev) }))
      .filter((g) => g.items.length > 0),
    [filtered]
  );

  const showStats   = findings.length > 0;
  const showContent = !isLoading && !error && filtered.length > 0;
  const showEmpty   = !isLoading && !error && findings.length === 0;
  const showNoMatch = !isLoading && !error && findings.length > 0 && filtered.length === 0;

  return (
    <>
      <div className="flex flex-col flex-1 min-h-0 space-y-5">

        {/* ── Page header ──────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4 flex-shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
              <Bug className="w-4 h-4 text-cyan-400" />
            </div>
            <div>
              <h1 className="page-title">Findings</h1>
              <p className="text-[11px] font-sans text-slate-600 mt-0.5">
                Security vulnerabilities and observations
                {!isLoading && findings.length > 0 && (
                  <span className="ml-2 text-slate-700">·</span>
                )}
                {!isLoading && findings.length > 0 && (
                  <span className="ml-2 text-slate-700">{findings.length} total</span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {/* View toggle */}
            <div className="flex items-center bg-[#0D0F12] border border-slate-800 rounded-lg p-0.5">
              <button
                onClick={() => setViewMode("grouped")}
                title="Grouped by severity"
                className={cn(
                  "p-2 rounded-md transition-colors",
                  viewMode === "grouped"
                    ? "bg-slate-700/80 text-slate-200"
                    : "text-slate-600 hover:text-slate-400"
                )}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                title="Flat list"
                className={cn(
                  "p-2 rounded-md transition-colors",
                  viewMode === "list"
                    ? "bg-slate-700/80 text-slate-200"
                    : "text-slate-600 hover:text-slate-400"
                )}
              >
                <List className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Import from tool — Phase 4 entry point */}
            <button
              onClick={() => setImportOpen(true)}
              className="btn-secondary h-9 px-4 gap-2"
            >
              <Upload className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Import</span>
            </button>

            {/* Add finding */}
            <button onClick={openCreate} className="btn-primary h-9 px-4 gap-2">
              <Plus className="w-3.5 h-3.5" />
              Add Finding
            </button>
          </div>
        </div>

        {/* ── Stats ────────────────────────────────────────────────── */}
        <AnimatePresence>
          {showStats && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y:  0 }}
              exit={{   opacity: 0, y: -8 }}
              className="flex-shrink-0"
            >
              <FindingsStats
                findings={findings}
                riskScore={stats.riskScore}
                severityCounts={stats.severityCounts}
                statusCounts={stats.statusCounts}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Filter bar ───────────────────────────────────────────── */}
        <div className="flex-shrink-0">
          <FindingFilters
            searchQuery={filters.search}
            onSearchChange={setSearch}
            severityFilter={filters.severity}
            onSeverityChange={setSeverity}
            statusFilter={filters.status}
            onStatusChange={setStatus}
            counts={stats.severityCounts}
            total={stats.total}
            filtered={filtered.length}
          />
        </div>

        {/* ── Sort bar (list view only) ─────────────────────────────── */}
        <AnimatePresence>
          {viewMode === "list" && filtered.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{   opacity: 0, height: 0 }}
              className="flex items-center gap-5 py-2 px-1 border-b border-slate-800/60 flex-shrink-0"
            >
              <span className="text-[9px] font-sans text-slate-700 uppercase tracking-[0.15em]">
                Sort
              </span>
              {(["severity", "title", "status", "createdAt"] as SortField[]).map((key) => (
                <SortButton
                  key={key}
                  label={key === "createdAt" ? "Date" : key.charAt(0).toUpperCase() + key.slice(1)}
                  sortKey={key}
                  active={filters.sortBy === key}
                  dir={filters.sortDir}
                  onClick={() => toggleSort(key)}
                />
              ))}
              <span className="ml-auto text-[10px] font-sans text-slate-700">
                Showing {filtered.length} of {findings.length}
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Content states ────────────────────────────────────────── */}
        <div className="flex-1 min-h-0">

          {/* Loading */}
          {isLoading && (
            <div className="flex items-center justify-center py-24">
              <div className="flex items-center gap-3 text-slate-600">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm font-sans">Loading findings…</span>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-red-500/[0.07] border border-red-500/20">
              <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-sans font-semibold text-red-400">Failed to load findings</p>
                <p className="text-[11px] font-sans text-red-400/60 mt-0.5">{error}</p>
              </div>
            </div>
          )}

          {/* Empty */}
          {showEmpty && <EmptyState onAdd={openCreate} onImport={() => setImportOpen(true)} />}

          {/* No filter match */}
          {showNoMatch && <NoResults onClear={clearFilters} />}

          {/* Findings */}
          {showContent && (
            viewMode === "list" ? (
              <div className="space-y-2">
                {filtered.map((finding, i) => (
                  <FindingCard
                    key={finding.id}
                    finding={finding}
                    index={i}
                    onEdit={openEdit}
                    onDelete={deleteFinding}
                  />
                ))}
              </div>
            ) : (
              <div className="space-y-7">
                {grouped.map(({ severity, items }) => (
                  <SeverityGroup key={severity} severity={severity} count={items.length}>
                    {items.map((finding, i) => (
                      <FindingCard
                        key={finding.id}
                        finding={finding}
                        index={i}
                        onEdit={openEdit}
                        onDelete={deleteFinding}
                      />
                    ))}
                  </SeverityGroup>
                ))}
              </div>
            )
          )}
        </div>
      </div>

      {/* ── Finding form drawer ───────────────────────────────────── */}
      <FindingForm
        open={formOpen}
        onClose={closeForm}
        onSubmit={handleSubmit}
        initial={editTarget}
      />

      {/*
       * ── Tool Import drawer (Phase 4) ──────────────────────────────
       * Placeholder — replaced with <ToolImportDrawer> in Phase 4.
       */}
      <AnimatePresence>
        {importOpen && (
          <ToolImportDrawer 
            onClose={() => setImportOpen(false)} 
            onImport={async (newFindings) => {
              for (const f of newFindings) {
                await addFinding({
                  title:            f.title,
                  severity:         f.severity,           // already correct type
                  status:           "Open",               // always Open on import
                  description:      f.description ?? "",
                  stepsToReproduce: "",                   // empty, user fills later
                  impact:           "",                   // empty, user fills later
                  remediation:      "",                   // empty, user fills later
                  target:           f.target ?? "",
                  cvss:             f.cvss,
                  cweId:            f.cweId,
                });
              }
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
}
