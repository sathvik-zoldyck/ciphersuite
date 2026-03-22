'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter, useParams } from 'next/navigation';
import {
  Shield,
  Target,
  Pencil,
  Trash2,
  Paperclip,
  Calendar,
  Hash,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { SeverityBadge, StatusBadge } from './SeverityBadge';
import { SEVERITY_CONFIG } from '@/lib/types';
import type { Finding } from '@/lib/types';
import { format } from 'date-fns';

interface FindingCardProps {
  finding: Finding;
  index: number;
  onEdit: (finding: Finding) => void;
  onDelete: (id: string) => void;
}

export function FindingCard({ finding, index, onEdit, onDelete }: FindingCardProps) {
  const router = useRouter();
  const params = useParams<{ projectId: string }>();
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const cfg = SEVERITY_CONFIG[finding.severity];

  const handleDelete = () => {
    if (deleteConfirm) {
      onDelete(finding.id);
    } else {
      setDeleteConfirm(true);
      setTimeout(() => setDeleteConfirm(false), 3000);
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.04 }}
      className={cn(
        'group relative rounded-lg border bg-[#0D0F12] overflow-hidden',
        'transition-all duration-200 cursor-pointer',
        'hover:border-opacity-80 hover:shadow-lg',
        cfg.border,
        `hover:${cfg.glow}`
      )}
      onClick={() => router.push(`/projects/${params.projectId}/findings/${finding.id}`)}
    >
      {/* Severity stripe on left edge */}
      <div
        className={cn('absolute left-0 top-0 bottom-0 w-0.5', cfg.dot)}
      />

      {/* Card header */}
      <div className="flex items-start gap-4 p-4 pl-5 select-none">
        {/* Severity icon block */}
        <div
          className={cn(
            'flex-shrink-0 w-9 h-9 rounded flex items-center justify-center mt-0.5',
            cfg.bg,
            cfg.border,
            'border'
          )}
        >
          <Shield className={cn('w-4 h-4', cfg.color)} />
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <SeverityBadge severity={finding.severity} size="sm" />
            <StatusBadge status={finding.status} size="sm" />
            {finding.cweId && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono text-slate-500 bg-slate-500/10 border border-slate-500/20">
                <Hash className="w-2.5 h-2.5" />
                {finding.cweId}
              </span>
            )}
            {finding.owaspId && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono text-slate-500 bg-slate-500/10 border border-slate-500/20">
                {finding.owaspId}
              </span>
            )}
          </div>

          <h3 className="text-sm font-semibold text-slate-100 font-mono leading-snug truncate">
            {finding.title}
          </h3>

          <div className="flex items-center gap-4 mt-2">
            <div className="flex items-center gap-1.5">
              <Target className="w-3 h-3 text-slate-600" />
              <span className="text-xs text-slate-500 font-mono truncate max-w-[200px]">
                {finding.target}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3 h-3 text-slate-600" />
              <span className="text-xs text-slate-500 font-mono">
                {format(new Date(finding.createdAt as any), 'MMM d, yyyy')}
              </span>
            </div>
            {finding.evidenceIds && finding.evidenceIds.length > 0 && (
              <div className="flex items-center gap-1.5">
                <Paperclip className="w-3 h-3 text-slate-600" />
                <span className="text-xs text-slate-500 font-mono">
                  {finding.evidenceIds.length} evidence
                </span>
              </div>
            )}
            {finding.cvss !== undefined && (
              <span className="text-xs font-mono text-slate-500">
                CVSS: <span className={cn('font-semibold', cfg.color)}>{finding.cvss.toFixed(1)}</span>
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(finding); }}
            className="p-1.5 rounded text-slate-600 hover:text-cyan-400 hover:bg-cyan-500/10 transition-colors opacity-0 group-hover:opacity-100"
            title="Edit finding"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleDelete(); }}
            className={cn(
              'p-1.5 rounded transition-colors opacity-0 group-hover:opacity-100',
              deleteConfirm
                ? 'text-red-400 bg-red-500/20 opacity-100'
                : 'text-slate-600 hover:text-red-400 hover:bg-red-500/10'
            )}
            title={deleteConfirm ? 'Click again to confirm' : 'Delete finding'}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function DetailSection({
  label,
  content,
  mono = false,
}: {
  label: string;
  content: string;
  mono?: boolean;
}) {
  if (!content) return null;
  return (
    <div>
      <p className="text-[10px] font-mono font-semibold tracking-widest text-slate-600 uppercase mb-2">
        {label}
      </p>
      <div
        className={cn(
          'text-sm text-slate-300 leading-relaxed prose prose-invert prose-sm max-w-none',
          mono && 'font-mono text-xs bg-black/40 rounded p-3 border border-slate-800 whitespace-pre-wrap'
        )}
        dangerouslySetInnerHTML={{ __html: content.replace(/\n/g, '<br />') }}
      />
    </div>
  );
}
