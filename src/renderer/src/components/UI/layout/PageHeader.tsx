import React from "react";
import { cn } from "../../../lib/utils";

export interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  description,
  icon,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn("flex items-center justify-between z-20 shrink-0", className)}>
      <div className="flex items-center gap-3">
        {icon && (
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-surface-hover)] border border-[var(--color-border)] text-[var(--accent-color)] shadow-sm shrink-0">
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight text-[var(--color-text-primary)] leading-tight truncate">
            {title}
          </h1>
          {description && (
            <p className="text-xs font-medium text-[var(--color-text-muted)] mt-0.5 truncate">
              {description}
            </p>
          )}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}
