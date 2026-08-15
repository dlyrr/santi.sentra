import React from "react";
import { cn } from "../../../lib/utils";

export interface BentoCardProps {
  icon: React.ReactNode;
  iconColor?: string;
  title: string;
  description: string;
  children?: React.ReactNode;
  colSpan?: 1 | 2;
  className?: string;
  disabled?: boolean;
  accent?: "default" | "warning" | "danger";
}

export function BentoCard({
  icon,
  title,
  description,
  children,
  colSpan = 1,
  className,
  disabled,
  accent = "default",
}: BentoCardProps) {
  const borderCls =
    accent === "danger"
      ? "border-red-500/20 hover:border-red-500/40"
      : accent === "warning"
        ? "border-amber-500/20 hover:border-amber-500/40"
        : "border-[var(--color-border)] hover:border-[var(--accent-color)]/40";

  const shimmerCls =
    accent === "danger"
      ? "from-red-500/[0.04]"
      : accent === "warning"
        ? "from-amber-500/[0.04]"
        : "from-[var(--accent-color)]/[0.04]";

  const iconCls =
    accent === "danger"
      ? "text-red-400"
      : accent === "warning"
        ? "text-amber-400"
        : "text-[var(--color-text-secondary)] group-hover:text-[var(--accent-color)]";

  return (
    <div
      className={cn(
        "relative overflow-hidden group rounded-xl border bg-[var(--color-surface)] transition-all duration-300 flex flex-col p-5",
        borderCls,
        colSpan === 2 ? "col-span-2" : "col-span-1",
        disabled && "opacity-50 pointer-events-none",
        className,
      )}
    >
      {/* shimmer */}
      <div
        className={cn(
          "absolute inset-0 bg-gradient-to-br to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none rounded-xl",
          shimmerCls,
        )}
      />

      {/* header */}
      <div className="flex items-center gap-3 mb-4 z-10 relative">
        <div
          className={cn(
            "w-9 h-9 rounded-lg bg-[var(--color-surface-hover)] border border-[var(--color-border)] flex items-center justify-center transition-colors shrink-0",
            iconCls,
          )}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <h4 className="text-sm font-semibold text-[var(--color-text-primary)] leading-none">
            {title}
          </h4>
          <p className="text-xs text-[var(--color-text-muted)] mt-1 leading-snug">
            {description}
          </p>
        </div>
      </div>

      {/* controls */}
      {children && (
        <div className="mt-auto pt-4 border-t border-[var(--color-border)] z-10 relative">
          {children}
        </div>
      )}
    </div>
  );
}
