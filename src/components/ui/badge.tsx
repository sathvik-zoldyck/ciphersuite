
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  // Base
  [
    "inline-flex items-center gap-1 rounded-md border",
    "px-2 py-0.5",
    "text-[10px] font-sans font-bold uppercase tracking-wider",
    "transition-colors duration-150",
    "focus:outline-none focus:ring-1 focus:ring-ring",
    "select-none",
  ],
  {
    variants: {
      variant: {
        // Brand / primary action
        default:
          "bg-violet-500/15 border-violet-500/25 text-violet-400 hover:bg-violet-500/20",

        // Secondary / neutral
        secondary:
          "bg-slate-800/60 border-slate-700/60 text-slate-400 hover:bg-slate-800",

        // Success / resolved
        success:
          "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/15",

        // Warning
        warning:
          "bg-amber-500/10 border-amber-500/20 text-amber-400 hover:bg-amber-500/15",

        // Danger / destructive
        destructive:
          "bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/15",

        // Subtle text-only
        outline:
          "bg-transparent border-slate-700/60 text-slate-400 hover:border-slate-600 hover:text-slate-300",

        // Ghost — no border, just tint
        ghost:
          "border-transparent bg-slate-800/40 text-slate-400 hover:bg-slate-800/60",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
