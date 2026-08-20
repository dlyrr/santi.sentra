import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../../lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border transition-colors",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-[var(--accent-color)] text-[var(--accent-color-foreground)] hover:brightness-110",
        secondary:
          "border-transparent bg-[var(--color-surface-hover)] text-[var(--color-text-primary)] hover:bg-[var(--color-surface-muted)]",
        destructive:
          "border-transparent bg-red-500 text-white hover:bg-red-600",
        outline: "text-[var(--color-text-primary)]",

        Online: "bg-blue-500/10 text-blue-400 border-blue-500/20",
        "In-Game": "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
        "In Studio": "bg-amber-500/10 text-amber-400 border-amber-500/20",
        Offline:
          "bg-[var(--color-surface-hover)] text-[var(--color-text-muted)] border-[var(--color-border)]",
        Banned: "bg-red-500/10 text-red-400 border-red-500/20",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends
    React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
