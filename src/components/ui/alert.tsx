
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const alertVariants = cva(
  // Base — shared across all variants
  [
    "relative w-full rounded-xl border px-4 py-3.5 overflow-hidden",
    "text-sm font-sans",
    // Icon positioning
    "[&>svg~*]:pl-7",
    "[&>svg+div]:translate-y-[-1px]",
    "[&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:h-4 [&>svg]:w-4",
  ],
  {
    variants: {
      variant: {
        default:
          "bg-slate-800/40 border-slate-700/60 text-slate-300 [&>svg]:text-slate-400",

        info:
          "bg-violet-500/[0.07] border-violet-500/20 text-violet-300 [&>svg]:text-violet-400",

        success:
          "bg-emerald-500/[0.07] border-emerald-500/20 text-emerald-300 [&>svg]:text-emerald-400",

        warning:
          "bg-amber-500/[0.07] border-amber-500/20 text-amber-300 [&>svg]:text-amber-400",

        destructive:
          "bg-red-500/[0.07] border-red-500/20 text-red-300 [&>svg]:text-red-400",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

// Left accent stripe per variant
const stripeVariants: Record<string, string> = {
  default:     "bg-slate-600",
  info:        "bg-cyan-500",
  success:     "bg-emerald-500",
  warning:     "bg-amber-500",
  destructive: "bg-red-500",
};

export interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {}

const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant = "default", children, ...props }, ref) => (
    <div
      ref={ref}
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    >
      {/* Left accent stripe */}
      <div
        className={cn(
          "absolute left-0 top-0 bottom-0 w-[3px]",
          stripeVariants[variant ?? "default"]
        )}
      />
      <div className="pl-[3px]">{children}</div>
    </div>
  )
);
Alert.displayName = "Alert";

const AlertTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h5
    ref={ref}
    className={cn("mb-1 font-bold font-display text-sm leading-none tracking-tight", className)}
    {...props}
  />
));
AlertTitle.displayName = "AlertTitle";

const AlertDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-[12px] font-sans leading-relaxed opacity-80 [&_p]:leading-relaxed", className)}
    {...props}
  />
));
AlertDescription.displayName = "AlertDescription";

export { Alert, AlertTitle, AlertDescription };
