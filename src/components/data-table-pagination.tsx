"use client";

import {
  ChevronLeft, ChevronRight,
  ChevronsLeft, ChevronsRight,
} from "@/components/icons";
import type { Table } from "@tanstack/react-table";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DataTablePaginationProps<TData> {
  table:       Table<TData>;
  /** Page size options. Defaults to [10, 25, 50, 100]. */
  pageSizes?: number[];
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function NavButton({
  onClick, disabled, label, children,
}: {
  onClick:  () => void;
  disabled: boolean;
  label:    string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={cn(
        "w-7 h-7 rounded-lg flex items-center justify-center",
        "border border-slate-800 bg-[#0D0F12]",
        "text-slate-600 transition-all duration-150",
        "hover:border-slate-700 hover:text-slate-200 hover:bg-slate-800",
        "disabled:opacity-25 disabled:cursor-not-allowed disabled:hover:bg-[#0D0F12]",
        "disabled:hover:border-slate-800 disabled:hover:text-slate-600",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-violet-500/50",
      )}
    >
      <span className="sr-only">{label}</span>
      {children}
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function DataTablePagination<TData>({
  table,
  pageSizes = [10, 25, 50, 100],
}: DataTablePaginationProps<TData>) {
  const { pageIndex, pageSize } = table.getState().pagination;
  const pageCount       = table.getPageCount();
  const currentPage     = pageIndex + 1;
  const totalRows       = table.getFilteredRowModel().rows.length;
  const selectedRows    = table.getFilteredSelectedRowModel().rows.length;
  const firstRowOnPage  = totalRows === 0 ? 0 : pageIndex * pageSize + 1;
  const lastRowOnPage   = Math.min(pageIndex * pageSize + pageSize, totalRows);

  return (
    <div className={cn(
      "flex items-center justify-between",
      "px-4 py-2.5",
      "border-t border-slate-800/60",
      "bg-[#0A0B0D]/60",
    )}>

      {/* ── Left: selection count ──────────────────────────────────── */}
      <div className="flex items-center gap-2 min-w-[140px]">
        {selectedRows > 0 ? (
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-violet-500/10 border border-violet-500/20">
            <div className="w-1 h-1 rounded-full bg-violet-400" />
            <span className="text-[10px] font-sans font-semibold text-violet-400">
              {selectedRows} selected
            </span>
          </div>
        ) : (
          <span className="text-[10px] font-sans text-slate-700">
            {totalRows > 0
              ? `${firstRowOnPage}–${lastRowOnPage} of ${totalRows.toLocaleString()}`
              : "No results"}
          </span>
        )}
      </div>

      {/* ── Center: page info ─────────────────────────────────────── */}
      <div className="flex items-center gap-1 text-[10px] font-sans text-slate-600">
        <span>Page</span>
        <span className="font-semibold text-slate-400">{currentPage}</span>
        <span>of</span>
        <span className="font-semibold text-slate-400">{pageCount}</span>
      </div>

      {/* ── Right: page size + nav ────────────────────────────────── */}
      <div className="flex items-center gap-3 min-w-[140px] justify-end">

        {/* Rows per page */}
        <div className="hidden sm:flex items-center gap-2">
          <span className="text-[10px] font-sans text-slate-700 whitespace-nowrap">
            Rows
          </span>
          <select
            value={pageSize}
            onChange={(e) => table.setPageSize(Number(e.target.value))}
            aria-label="Rows per page"
            className={cn(
              "h-7 px-2 rounded-lg",
              "bg-[#0D0F12] border border-slate-800",
              "text-[10px] font-sans text-slate-400",
              "focus:outline-none focus:border-slate-700",
              "cursor-pointer appearance-none",
              "transition-colors hover:border-slate-700",
            )}
          >
            {pageSizes.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>

        {/* Divider */}
        <div className="hidden sm:block w-px h-4 bg-slate-800" />

        {/* Navigation buttons */}
        <div className="flex items-center gap-1">
          <NavButton
            onClick={() => table.setPageIndex(0)}
            disabled={!table.getCanPreviousPage()}
            label="First page"
          >
            <ChevronsLeft className="w-3.5 h-3.5" />
          </NavButton>

          <NavButton
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            label="Previous page"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </NavButton>

          <NavButton
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            label="Next page"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </NavButton>

          <NavButton
            onClick={() => table.setPageIndex(pageCount - 1)}
            disabled={!table.getCanNextPage()}
            label="Last page"
          >
            <ChevronsRight className="w-3.5 h-3.5" />
          </NavButton>
        </div>
      </div>
    </div>
  );
}