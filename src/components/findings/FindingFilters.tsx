'use client';

import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FindingSeverity, FindingStatus } from '@/lib/types';
import { SEVERITY_CONFIG, STATUSES_ORDERED } from '@/lib/types';

interface FindingFiltersProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  severityFilter: FindingSeverity | 'all';
  onSeverityChange: (severity: FindingSeverity | 'all') => void;
  statusFilter: FindingStatus | 'all';
  onStatusChange: (status: FindingStatus | 'all') => void;
  counts: Record<FindingSeverity, number>;
  total: number;
  filtered: number;
}

export function FindingFilters({
  searchQuery, onSearchChange,
  severityFilter, onSeverityChange,
  statusFilter, onStatusChange,
  counts, total, filtered
}: FindingFiltersProps) {
  const severityOptions: (FindingSeverity | 'all')[] = ['all', 'Critical', 'High', 'Medium', 'Low', 'Informational'];

  return (
    <div className="bg-[#0D0F12]/60 border border-slate-800/50 rounded-lg p-3 flex items-center gap-3 flex-wrap">
      {/* Search Input */}
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-600 pointer-events-none" />
        <input
          type="text"
          placeholder="Search by title or target..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full h-9 bg-[#0A0B0C]/50 pl-9 pr-3 text-sm font-sans placeholder:text-slate-600 focus:outline-none border border-slate-700/60 focus:border-cyan-500/50 rounded-md"
        />
      </div>

      <div className="h-6 w-px bg-slate-800" />

      {/* Severity Filter */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-sans text-slate-500 uppercase tracking-widest">Severity:</span>
        <div className="flex items-center bg-[#0A0B0C] border border-slate-700/60 rounded-md p-0.5">
          {severityOptions.map((sev) => (
            <button
              key={sev}
              onClick={() => onSeverityChange(sev)}
              className={cn(
                'px-2.5 py-1 text-[10px] font-sans rounded transition-colors flex items-center gap-1.5',
                severityFilter === sev
                  ? 'bg-slate-700 text-slate-200'
                  : 'text-slate-500 hover:text-slate-300'
              )}
            >
              {sev === 'all' ? 'All' : (
                <>
                  <div className={cn('w-1.5 h-1.5 rounded-full', SEVERITY_CONFIG[sev]?.dot)} />
                  {SEVERITY_CONFIG[sev]?.label}
                </>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Status Filter */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-sans text-slate-500 uppercase tracking-widest">Status:</span>
        <div className="flex items-center bg-[#0A0B0C] border border-slate-700/60 rounded-md p-0.5">
          {(['all', ...STATUSES_ORDERED] as (FindingStatus | 'all')[]).map((stat) => (
            <button
              key={stat}
              onClick={() => onStatusChange(stat)}
              className={cn(
                'px-2.5 py-1 text-[10px] font-sans rounded transition-colors capitalize',
                statusFilter === stat
                  ? 'bg-slate-700 text-slate-200'
                  : 'text-slate-500 hover:text-slate-300'
              )}
            >
              {stat}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-grow" />

      {/* Results Count */}
      <p className="text-[10px] font-sans text-slate-600">
        Showing <span className="font-bold text-slate-400">{filtered}</span> of <span className="font-bold text-slate-400">{total}</span>
      </p>

      {(searchQuery || severityFilter !== 'all' || statusFilter !== 'all') && (
        <button
          onClick={() => { onSearchChange(''); onSeverityChange('all'); onStatusChange('all'); }}
          className="flex items-center gap-1.5 text-[10px] font-sans text-slate-600 hover:text-red-400 transition-colors"
        >
          <X className="w-2.5 h-2.5" />
          Clear
        </button>
      )}
    </div>
  );
}
