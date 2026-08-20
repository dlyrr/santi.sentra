import React from "react";
import CustomCheckbox from "../../../components/UI/buttons/CustomCheckbox";
import { cn } from "../../../lib/utils";

export const Section: React.FC<{
  title: string;
  description?: string;
  children: React.ReactNode;
}> = ({ title, description, children }) => (
  <div className="space-y-4">
    <div>
      <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-1">
        {title}
      </h3>
      {description && (
        <p className="text-sm text-[var(--color-text-secondary)]">
          {description}
        </p>
      )}
    </div>
    <div className="space-y-4">{children}</div>
  </div>
);

export const SettingsCard: React.FC<{
  title: string;
  description?: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, description, icon, actions, children }) => (
  <div className="p-4 bg-[var(--color-surface-strong)] rounded-[var(--radius-xl)] border border-[var(--color-border)]/50 hover:border-[var(--color-border-strong)]/50 transition-colors space-y-3 [--card-radius:var(--radius-xl)] [--card-gap:0.5rem] [--control-radius:calc(var(--card-radius)_-_var(--card-gap))]">
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        {icon && (
          <div className="p-2 rounded-lg bg-[var(--accent-color)]/10 text-[var(--accent-color)]">
            {icon}
          </div>
        )}
        <div>
          <h4 className="text-sm font-medium text-[var(--color-text-primary)]">
            {title}
          </h4>
          {description && (
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
              {description}
            </p>
          )}
        </div>
      </div>
      {actions}
    </div>
    <div className="space-y-3">{children}</div>
  </div>
);

export const ToggleRow: React.FC<{
  title: string;
  description: React.ReactNode;
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  icon?: React.ReactNode;
  hint?: React.ReactNode;
}> = ({ title, description, checked, onChange, disabled, icon, hint }) => (
  <div className="flex items-start gap-3 p-4 bg-[var(--color-surface-muted)] rounded-[var(--control-radius)] border border-[var(--color-border)]/50 hover:border-[var(--color-border-strong)]/50 transition-colors">
    <div className="mt-1">
      <CustomCheckbox
        checked={checked}
        onChange={onChange}
        disabled={disabled}
      />
    </div>
    <div className="space-y-1">
      <div className="flex items-center gap-2 text-sm font-medium text-[var(--color-text-secondary)]">
        {icon}
        <span>{title}</span>
      </div>
      <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
        {description}
      </p>
      {hint}
    </div>
  </div>
);

export function SectionDivider({ label }: { label: string }) {
  return (
    <div className="col-span-2 flex items-center gap-3 pt-4 pb-1">
      <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--color-text-muted)] whitespace-nowrap">
        {label}
      </span>
      <div className="flex-1 h-px bg-[var(--color-border)]" />
    </div>
  );
}

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
      {}
      <div
        className={cn(
          "absolute inset-0 bg-gradient-to-br to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none rounded-xl",
          shimmerCls,
        )}
      />

      {}
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

      {}
      {children && (
        <div className="mt-auto pt-4 border-t border-[var(--color-border)] z-10 relative">
          {children}
        </div>
      )}
    </div>
  );
}

export function BentoToggle({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      {label && (
        <span className="text-xs text-[var(--color-text-secondary)]">
          {label}
        </span>
      )}
      <button
        onClick={onChange}
        disabled={disabled}
        aria-checked={checked}
        role="switch"
        className={cn(
          "relative w-11 h-6 rounded-full border transition-all duration-300 disabled:opacity-50 cursor-pointer",
          checked
            ? "bg-[var(--accent-color)] border-[var(--accent-color)]"
            : "bg-[var(--color-surface-hover)] border-[var(--color-border)]",
        )}
      >
        <div
          className={cn(
            "absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-300",
            checked ? "translate-x-5" : "translate-x-0",
          )}
        />
      </button>
    </div>
  );
}

export function PageHeader({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-4 col-span-2 flex items-center gap-4">
      <h2 className="text-lg font-bold text-[var(--color-text-primary)] tracking-tight">
        {title}
      </h2>
      {description && (
        <>
          <div className="w-px h-4 bg-[var(--color-border)]" />
          <p className="text-sm font-medium text-[var(--color-text-muted)]">
            {description}
          </p>
        </>
      )}
    </div>
  );
}
