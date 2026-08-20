import React from "react";
import { cn } from "@renderer/lib/utils";
import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";

export interface EnhancedBadgeProps {
  variant?: "default" | "success" | "error" | "warning" | "info" | "gradient";
  size?: "sm" | "md" | "lg";
  icon?: LucideIcon;
  animated?: boolean;
  pulse?: boolean;
  className?: string;
  children: React.ReactNode;
}

export const EnhancedBadge: React.FC<EnhancedBadgeProps> = ({
  variant = "default",
  size = "md",
  icon: Icon,
  animated = true,
  pulse = false,
  className,
  children,
}) => {
  const variantClasses = {
    default:
      "bg-[var(--color-surface-hover)]/80 text-[var(--color-text-primary)] border border-[var(--color-border-strong)]/50 ring-neutral-600/20",
    success:
      "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 ring-emerald-500/20",
    error:
      "bg-red-500/15 text-red-300 border border-red-500/30 ring-red-500/20",
    warning:
      "bg-amber-500/15 text-amber-300 border border-amber-500/30 ring-amber-500/20",
    info: "bg-blue-500/15 text-blue-300 border border-blue-500/30 ring-blue-500/20",
    gradient:
      "bg-gradient-to-r from-purple-500/20 via-pink-500/20 to-rose-500/20 text-pink-200 border border-pink-500/30",
  };

  const sizeClasses = {
    sm: "px-2 py-1 text-xs",
    md: "px-3 py-1.5 text-sm",
    lg: "px-4 py-2 text-base",
  };

  return (
    <motion.div
      initial={animated ? { opacity: 0, scale: 0.95 } : false}
      animate={animated ? { opacity: 1, scale: 1 } : false}
      transition={{ duration: 0.2 }}
      className={cn(
        "inline-flex items-center gap-2 rounded-full font-medium ring-1",
        "backdrop-blur-sm transition-all duration-200",
        pulse && "animate-pulse",
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
    >
      {Icon && <Icon size={size === "sm" ? 12 : size === "lg" ? 18 : 16} />}
      {children}
    </motion.div>
  );
};

export interface EnhancedCardProps {
  interactive?: boolean;
  hoverable?: boolean;
  gradient?: boolean;
  glowing?: boolean;
  borderAccent?: "primary" | "success" | "warning" | "error" | "none";
  className?: string;
  children: React.ReactNode;
  onClick?: () => void;
}

export const EnhancedCard: React.FC<EnhancedCardProps> = ({
  interactive = false,
  hoverable = false,
  gradient = false,
  glowing = false,
  borderAccent = "none",
  className,
  children,
  onClick,
}) => {
  const borderClasses = {
    primary: "border-l-4 border-l-blue-500/50",
    success: "border-l-4 border-l-emerald-500/50",
    warning: "border-l-4 border-l-amber-500/50",
    error: "border-l-4 border-l-red-500/50",
    none: "",
  };

  return (
    <motion.div
      whileHover={hoverable ? { y: -4 } : undefined}
      className={cn(
        "rounded-xl border bg-[var(--color-surface-muted)]/50 backdrop-blur-sm",
        "border-[var(--color-border)] transition-all duration-200",
        interactive && "cursor-pointer hover:bg-[var(--color-surface-hover)]",
        gradient &&
          "bg-gradient-to-br from-[var(--color-surface)] to-[var(--color-surface-muted)]",
        glowing &&
          "shadow-lg shadow-blue-500/10 hover:shadow-blue-500/20 hover:border-blue-500/30",
        borderClasses[borderAccent],
        className,
      )}
      onClick={onClick}
    >
      {children}
    </motion.div>
  );
};

export interface EnhancedProgressBarProps {
  value: number;
  max?: number;
  color?: "primary" | "success" | "warning" | "error";
  size?: "sm" | "md" | "lg";
  animated?: boolean;
  showLabel?: boolean;
  className?: string;
}

export const EnhancedProgressBar: React.FC<EnhancedProgressBarProps> = ({
  value,
  max = 100,
  color = "primary",
  size = "md",
  animated = true,
  showLabel = false,
  className,
}) => {
  const percentage = Math.min((value / max) * 100, 100);

  const colorClasses = {
    primary: "from-blue-500 to-blue-400",
    success: "from-emerald-500 to-emerald-400",
    warning: "from-amber-500 to-amber-400",
    error: "from-red-500 to-red-400",
  };

  const sizeClasses = {
    sm: "h-1.5",
    md: "h-2",
    lg: "h-3",
  };

  return (
    <div
      className={cn(
        "w-full rounded-full bg-[var(--color-surface-hover)]/50 overflow-hidden",
        className,
      )}
    >
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${percentage}%` }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className={cn(
          "h-full bg-gradient-to-r rounded-full transition-all",
          colorClasses[color],
          sizeClasses[size],
          animated && "shadow-lg shadow-blue-500/50",
        )}
      />
      {showLabel && (
        <div className="text-xs text-[var(--color-text-secondary)] mt-1 text-center">
          {Math.round(percentage)}%
        </div>
      )}
    </div>
  );
};

export const EnhancedSectionHeader: React.FC<{
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  action?: React.ReactNode;
  className?: string;
}> = ({ title, subtitle, icon: Icon, action, className }) => (
  <div className={cn("flex items-start justify-between mb-6", className)}>
    <div className="flex items-center gap-3">
      {Icon && (
        <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
          <Icon className="w-5 h-5 text-blue-400" />
        </div>
      )}
      <div>
        <h2 className="text-2xl font-bold text-[var(--color-text-primary)]">
          {title}
        </h2>
        {subtitle && (
          <p className="text-sm text-[var(--color-text-muted)]">{subtitle}</p>
        )}
      </div>
    </div>
    {action && <div>{action}</div>}
  </div>
);

export const EnhancedStat: React.FC<{
  label: string;
  value: string | number;
  change?: { value: number; trend: "up" | "down" };
  icon?: LucideIcon;
  color?: "primary" | "success" | "warning" | "error";
  className?: string;
}> = ({ label, value, change, icon: Icon, color = "primary", className }) => {
  const colorClasses = {
    primary: "text-blue-400 bg-blue-500/10 border-blue-500/20",
    success: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    warning: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    error: "text-red-400 bg-red-500/10 border-red-500/20",
  };

  return (
    <EnhancedCard gradient hoverable className={className}>
      <div className="p-4 flex flex-col gap-3">
        <div className="flex items-start justify-between">
          <span className="text-sm font-medium text-[var(--color-text-muted)]">
            {label}
          </span>
          {Icon && (
            <div className={cn("p-2 rounded-lg border", colorClasses[color])}>
              <Icon size={16} />
            </div>
          )}
        </div>

        <div className="flex items-end justify-between">
          <div className="text-2xl font-bold text-[var(--color-text-primary)]">
            {value}
          </div>
          {change && (
            <div
              className={cn(
                "text-xs font-semibold",
                change.trend === "up" ? "text-emerald-400" : "text-red-400",
              )}
            >
              {change.trend === "up" ? "↑" : "↓"} {Math.abs(change.value)}%
            </div>
          )}
        </div>
      </div>
    </EnhancedCard>
  );
};

export const EnhancedSkeleton: React.FC<{
  className?: string;
  count?: number;
}> = ({ className, count = 1 }) => (
  <>
    {Array.from({ length: count }).map((_, i) => (
      <motion.div
        key={i}
        animate={{ opacity: [0.5, 0.8, 0.5] }}
        transition={{ duration: 1.5, repeat: Infinity }}
        className={cn(
          "rounded-lg bg-[var(--color-surface-hover)]/50",
          className,
        )}
      />
    ))}
  </>
);

export const AnimatedGradientBackground: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className }) => (
  <div className={cn("relative overflow-hidden", className)}>
    <div
      className="absolute inset-0 -z-10 opacity-30"
      style={{
        backgroundImage:
          "radial-gradient(circle at 20% 50%, rgba(59, 130, 246, 0.2) 0%, transparent 50%)",
        animation: "pulse 8s ease-in-out infinite",
      }}
    />
    <div
      className="absolute inset-0 -z-10 opacity-20"
      style={{
        backgroundImage:
          "radial-gradient(circle at 80% 80%, rgba(168, 85, 247, 0.2) 0%, transparent 50%)",
        animation: "pulse 10s ease-in-out infinite 2s",
      }}
    />
    {children}
  </div>
);
