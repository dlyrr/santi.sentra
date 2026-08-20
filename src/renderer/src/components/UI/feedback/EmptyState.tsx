import React from "react";
import { motion } from "framer-motion";
import { cn } from "@renderer/lib/utils";

type EmptyStateVariant = "default" | "dashed" | "minimal";

interface EmptyStateProps {
  icon?: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  description?: string;
  action?: React.ReactNode;
  variant?: EmptyStateVariant;
  className?: string;
}

const variantStyles: Record<EmptyStateVariant, string> = {
  default: "p-8 text-center",
  dashed:
    "p-4 text-center bg-[var(--color-surface-muted)] rounded-xl border border-[var(--color-border)] border-dashed",
  minimal: "py-8 text-center",
};

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  action,
  variant = "default",
  className,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={cn(
        "flex flex-col items-center justify-center gap-4 text-[var(--color-text-muted)]",
        variantStyles[variant],
        className,
      )}
    >
      {Icon && (
        <div className="p-5 bg-[var(--color-surface-strong)] rounded-2xl border border-[var(--color-border)] shadow-sm">
          <Icon size={28} className="text-[var(--color-text-muted)]" />
        </div>
      )}
      <div className="text-center max-w-sm">
        <p className="text-base font-semibold text-[var(--color-text-primary)]">
          {title}
        </p>
        {description && (
          <p className="text-sm text-[var(--color-text-muted)] mt-1 leading-relaxed">
            {description}
          </p>
        )}
      </div>
      {action && <div className="mt-2">{action}</div>}
    </motion.div>
  );
};

export const EmptyStateCompact: React.FC<{
  message: string;
  className?: string;
}> = ({ message, className }) => (
  <div
    className={cn(
      "p-4 text-center text-[var(--color-text-muted)] text-sm bg-[var(--color-surface-muted)] rounded-xl border border-[var(--color-border)] border-dashed",
      className,
    )}
  >
    {message}
  </div>
);

export default EmptyState;
