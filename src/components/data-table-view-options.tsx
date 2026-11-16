"use client"

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SlidersHorizontal, Check, Eye, EyeOff } from "lucide-react";
import type { Table } from "@tanstack/react-table";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DataTableViewOptionsProps<TData> {
  table: Table<TData>;
  /**
   * Human-readable column label overrides.
   * Falls back to formatted column ID if not provided.
   * e.g. { cweId: "CWE", owaspId: "OWASP", stepsToReproduce: "Steps" }
   */
  columnLabels?: Record<string, string>;
}

// ─── Format column ID → readable label ───────────────────────────────────────

function formatColumnId(id: string): string {
  return id
    .replace(/([A-Z])/g, " $1")
    .replace(/[_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\w/, (c) => c.toUpperCase());
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DataTableViewOptions<TData>({
  table,
  columnLabels = {},
}: DataTableViewOptionsProps<TData>) {
  const [open, setOpen] = useState(false);

  const toggleable = table
    .getAllColumns()
    .filter((col) => typeof col.accessorFn !== "undefined" && col.getCanHide());

  const visibleCount = toggleable.filter((col) => col.getIsVisible()).length;
  const allVisible   = visibleCount === toggleable.length;
  const noneVisible  = visibleCount === 0;

  return (
    <div className="relative">
      {/* Trigger */}
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label="Toggle column visibility"
        className={cn(
          "flex items-center gap-2 h-8 px-3 rounded-lg",
          "border text-[11px] font-sans font-semibold transition-all duration-150",
          open
            ? "bg-slate-800 border-slate-600 text-slate-200"
            : "bg-[#0D0F12] border-slate-800 text-slate-500 hover:border-slate-700 hover:text-slate-300",
        )}
      >
        <SlidersHorizontal className="w-3 h-3" />
        <span>Columns</span>
        {!allVisible && (
          <span className="flex items-center justify-center w-4 h-4 rounded-full bg-violet-500/15 text-violet-400 text-[9px] font-bold">
            {visibleCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />

            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: -4 }}
              animate={{ opacity: 1, scale: 1,    y:  0 }}
              exit={{   opacity: 0, scale: 0.96, y: -4 }}
              transition={{ duration: 0.13, ease: "easeOut" }}
              className={cn(
                "absolute right-0 top-full mt-2 z-50",
                "w-52 bg-[#0A0B0D] border border-slate-800 rounded-xl shadow-2xl shadow-black/60 overflow-hidden",
              )}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-3 py-2.5 border-b border-slate-800/80">
                <span className="text-[9px] font-sans font-bold text-slate-600 uppercase tracking-[0.15em]">
                  Columns
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => table.toggleAllColumnsVisible(true)}
                    disabled={allVisible}
                    className="text-[9px] font-sans text-slate-700 hover:text-violet-400 disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
                  >
                    All
                  </button>
                  <div className="w-px h-2.5 bg-slate-800" />
                  <button
                    onClick={() => table.toggleAllColumnsVisible(false)}
                    disabled={noneVisible}
                    className="text-[9px] font-sans text-slate-700 hover:text-red-400 disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
                  >
                    None
                  </button>
                </div>
              </div>

              {/* Column rows */}
              <div className="py-1 max-h-72 overflow-y-auto scrollbar-thin">
                {toggleable.length === 0 ? (
                  <p className="px-3 py-4 text-[10px] font-sans text-slate-700 text-center">
                    No toggleable columns
                  </p>
                ) : (
                  toggleable.map((col) => {
                    const visible = col.getIsVisible();
                    const label   = columnLabels[col.id] ?? formatColumnId(col.id);

                    return (
                      <button
                        key={col.id}
                        onClick={() => col.toggleVisibility(!visible)}
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-2 text-xs font-sans text-left transition-colors",
                          visible
                            ? "text-slate-300 hover:bg-slate-800/60"
                            : "text-slate-600 hover:bg-slate-800/40",
                        )}
                      >
                        <div className={cn(
                          "w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border transition-all",
                          visible
                            ? "bg-violet-500/15 border-violet-500/30"
                            : "bg-transparent border-slate-700",
                        )}>
                          {visible && <Check className="w-2.5 h-2.5 text-violet-400" />}
                        </div>

                        <span className="flex-1 truncate">{label}</span>

                        <span className={cn("flex-shrink-0 transition-colors", visible ? "text-slate-700" : "text-slate-800")}>
                          {visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>

              {/* Footer */}
              <div className="px-3 py-2 border-t border-slate-800/80">
                <span className="text-[9px] font-sans text-slate-700">
                  {visibleCount} of {toggleable.length} visible
                </span>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}