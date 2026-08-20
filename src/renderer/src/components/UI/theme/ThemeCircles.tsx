import React, { useMemo } from "react";
import { cn } from "@renderer/lib/utils";

export interface ThemeCirclesProps {
  size?: "sm" | "md" | "lg" | "xl";
  gap?: "tight" | "normal" | "loose";
  accentColor?: "primary" | "success" | "error" | "warning" | "custom";
  customColor?: string;
  animated?: boolean;
  onClick?: () => void;
  className?: string;
  showLabel?: boolean;
  label?: string;
}

const sizeMap = {
  sm: "w-6 h-6",
  md: "w-8 h-8",
  lg: "w-12 h-12",
  xl: "w-16 h-16",
};

const gapMap = {
  tight: "gap-1",
  normal: "gap-2",
  loose: "gap-4",
};

const accentColorMap = {
  primary: "from-blue-500 to-blue-400",
  success: "from-emerald-500 to-emerald-400",
  error: "from-red-500 to-red-400",
  warning: "from-amber-500 to-amber-400",
  custom: "from-purple-500 to-purple-400",
};

export const ThemeCircles: React.FC<ThemeCirclesProps> = ({
  size = "md",
  gap = "normal",
  accentColor = "primary",
  customColor,
  animated = true,
  onClick,
  className,
  showLabel = false,
  label = "Theme",
}) => {
  const circleGradient = useMemo(() => {
    if (accentColor === "custom" && customColor) {
      return customColor;
    }
    return accentColorMap[accentColor];
  }, [accentColor, customColor]);

  return (
    <div
      className={cn("flex flex-col items-center", className)}
      onClick={onClick}
    >
      <div className={cn("flex items-center", gapMap[gap])}>
        {}
        <div
          className={cn(
            sizeMap[size],
            "rounded-full bg-gradient-to-br shadow-lg transition-transform duration-300",
            circleGradient,
            animated && "hover:scale-110 cursor-pointer",
            "ring-2 ring-offset-2 ring-offset-neutral-900 ring-opacity-50",
            accentColor === "primary"
              ? "ring-blue-500/30"
              : accentColor === "success"
                ? "ring-emerald-500/30"
                : accentColor === "error"
                  ? "ring-red-500/30"
                  : accentColor === "warning"
                    ? "ring-amber-500/30"
                    : "ring-purple-500/30",
          )}
          style={{
            animation: animated
              ? "pulse-subtle 2s ease-in-out infinite"
              : "none",
          }}
        />

        {}
        <div
          className={cn(
            sizeMap[size],
            "rounded-full bg-gradient-to-br shadow-lg transition-transform duration-300",
            circleGradient,
            animated && "hover:scale-110 cursor-pointer",
            "ring-2 ring-offset-2 ring-offset-neutral-900 ring-opacity-50",
            accentColor === "primary"
              ? "ring-blue-500/30"
              : accentColor === "success"
                ? "ring-emerald-500/30"
                : accentColor === "error"
                  ? "ring-red-500/30"
                  : accentColor === "warning"
                    ? "ring-amber-500/30"
                    : "ring-purple-500/30",
          )}
          style={{
            animation: animated
              ? "pulse-subtle 2s ease-in-out infinite 0.3s"
              : "none",
          }}
        />
      </div>

      {showLabel && (
        <span className="mt-2 text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider">
          {label}
        </span>
      )}

      <style>{`
        @keyframes pulse-subtle {
          0%, 100% {
            opacity: 1;
            box-shadow: 0 0 0 0 rgba(255, 255, 255, 0.1);
          }
          50% {
            opacity: 0.8;
            box-shadow: 0 0 0 4px rgba(255, 255, 255, 0.05);
          }
        }
      `}</style>
    </div>
  );
};

export interface ThemeOption {
  id: string;
  label: string;
  color: string;
  gradientColor: string;
}

export const ThemeCirclesGrid: React.FC<{
  options: ThemeOption[];
  selected?: string;
  onSelect?: (themeId: string) => void;
  size?: "sm" | "md" | "lg";
  gap?: "tight" | "normal" | "loose";
  animated?: boolean;
  className?: string;
}> = ({
  options,
  selected,
  onSelect,
  size = "md",
  gap = "normal",
  animated = true,
  className,
}) => {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-center",
        gapMap[gap],
        className,
      )}
    >
      {options.map((option) => (
        <div
          key={option.id}
          className={cn(
            "flex flex-col items-center transition-all duration-200",
            selected === option.id
              ? "scale-110"
              : "opacity-70 hover:opacity-100",
            "cursor-pointer",
          )}
          onClick={() => onSelect?.(option.id)}
        >
          <div className={cn("flex items-center", gapMap[gap])}>
            {}
            <div
              className={cn(
                sizeMap[size],
                "rounded-full shadow-lg transition-transform duration-300",
                "ring-2 ring-offset-2 ring-offset-neutral-900 ring-opacity-50",
                selected === option.id
                  ? "ring-2 ring-[var(--color-text-primary)]"
                  : "ring-neutral-700",
              )}
              style={{
                background: `linear-gradient(135deg, ${option.color} 0%, ${option.gradientColor} 100%)`,
                animation: animated
                  ? "pulse-subtle 2s ease-in-out infinite"
                  : "none",
              }}
            />

            {}
            <div
              className={cn(
                sizeMap[size],
                "rounded-full shadow-lg transition-transform duration-300",
                "ring-2 ring-offset-2 ring-offset-neutral-900 ring-opacity-50",
                selected === option.id
                  ? "ring-2 ring-[var(--color-text-primary)]"
                  : "ring-neutral-700",
              )}
              style={{
                background: `linear-gradient(135deg, ${option.color} 0%, ${option.gradientColor} 100%)`,
                animation: animated
                  ? "pulse-subtle 2s ease-in-out infinite 0.3s"
                  : "none",
              }}
            />
          </div>

          <span className="mt-2 text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider">
            {option.label}
          </span>
        </div>
      ))}

      <style>{`
        @keyframes pulse-subtle {
          0%, 100% {
            opacity: 1;
            box-shadow: 0 0 0 0 rgba(255, 255, 255, 0.1);
          }
          50% {
            opacity: 0.8;
            box-shadow: 0 0 0 4px rgba(255, 255, 255, 0.05);
          }
        }
      `}</style>
    </div>
  );
};

export const DEFAULT_THEME_CIRCLES: ThemeOption[] = [
  {
    id: "neutral",
    label: "Neutral",
    color: "#9ca3af",
    gradientColor: "#6b7280",
  },
  {
    id: "cool",
    label: "Cool",
    color: "#3b82f6",
    gradientColor: "#1d4ed8",
  },
  {
    id: "warm",
    label: "Warm",
    color: "#f97316",
    gradientColor: "#ea580c",
  },
  {
    id: "forest",
    label: "Forest",
    color: "#10b981",
    gradientColor: "#059669",
  },
  {
    id: "twilight",
    label: "Twilight",
    color: "#a855f7",
    gradientColor: "#7c3aed",
  },
];
