'use client';

import { cn } from '@/lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';
import { SEVERITY_CONFIG, STATUS_CONFIG } from '@/lib/types';
import type { FindingSeverity, FindingStatus } from '@/lib/types';

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-md border',
  {
    variants: {
      size: {
        sm: 'px-1.5 py-0.5 text-[9px] font-sans font-bold uppercase tracking-wider',
        md: 'px-2.5 py-1 text-xs font-sans font-semibold uppercase tracking-wider',
      },
    },
    defaultVariants: {
      size: 'md',
    },
  }
);

interface SeverityBadgeProps extends VariantProps<typeof badgeVariants> {
  severity: FindingSeverity;
}

export function SeverityBadge({ severity, size }: SeverityBadgeProps) {
  const cfg = SEVERITY_CONFIG[severity];
  if (!cfg) return null;

  return (
    <div
      className={cn(
        badgeVariants({ size }),
        cfg.bg,
        cfg.color,
        cfg.border,
      )}
    >
      <div className={cn('w-1.5 h-1.5 rounded-full', cfg.dot, severity === 'Critical' && 'animate-pulse')} />
      {cfg.label}
    </div>
  );
}

interface StatusBadgeProps extends VariantProps<typeof badgeVariants> {
  status: FindingStatus;
}

export function StatusBadge({ status, size }: StatusBadgeProps) {
  const cfg = STATUS_CONFIG[status];
  if (!cfg) return null;

  return (
    <div
      className={cn(
        badgeVariants({ size }),
        'capitalize',
        cfg.bg,
        cfg.border,
        cfg.color,
      )}
    >
      <div className={cn('w-1.5 h-1.5 rounded-full', cfg.dot)} />
      {cfg.label}
    </div>
  );
}
