
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  // Base
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap",
    "font-sans font-semibold transition-all duration-150",
    "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan-500/50",
    "disabled:pointer-events-none disabled:opacity-40",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0",
  ],
  {
    variants: {
      variant: {
        // Primary — cyan, used for main CTA
        default:
          "bg-cyan-500 hover:bg-cyan-400 text-black shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/30 hover:scale-[1.01] active:scale-[0.98]",

        // Danger — red, used for destructive actions
        destructive:
          "bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/25 hover:border-red-500/40",

        // Secondary — dark filled
        secondary:
          "bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-slate-600",

        // Outline — transparent with border
        outline:
          "border border-slate-700/60 bg-transparent hover:bg-slate-800/60 hover:border-slate-600 text-slate-400 hover:text-slate-200",

        // Ghost — no border, minimal
        ghost:
          "bg-transparent hover:bg-white/[0.05] text-slate-500 hover:text-slate-200",

        // Link — text only
        link:
          "bg-transparent text-cyan-400 underline-offset-4 hover:underline hover:text-cyan-300 p-0 h-auto",
      },
      size: {
        default: "h-9 px-4 rounded-lg text-sm",
        sm:      "h-7 px-3 rounded-lg text-xs",
        lg:      "h-11 px-6 rounded-xl text-sm",
        icon:    "h-9 w-9 rounded-lg",
        "icon-sm":"h-7 w-7 rounded-md",
      },
    },
    defaultVariants: {
      variant: "default",
      size:    "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
