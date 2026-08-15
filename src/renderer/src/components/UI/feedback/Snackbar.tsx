import React, { useCallback, useEffect, useState } from "react";
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from "lucide-react";

export type SnackbarType = "success" | "error" | "info" | "warning";

export interface SnackbarProps {
  id: string;
  message: string;
  type: SnackbarType;
  duration?: number;
  onClose: (id: string) => void;
}

const TYPE_CONFIG: Record<
  SnackbarType,
  {
    icon: React.ReactNode;
    containerClass: string;
    barColor: string;
  }
> = {
  success: {
    icon: <CheckCircle size={17} className="text-emerald-400 shrink-0" />,
    containerClass:
      "bg-[var(--color-surface)]/90 backdrop-blur-md border-emerald-500/25 shadow-[0_12px_40px_rgba(0,0,0,0.5),inset_0_0_0_1px_rgba(52,211,153,0.1)]",
    barColor: "bg-emerald-500",
  },
  error: {
    icon: <AlertCircle size={17} className="text-red-400 shrink-0" />,
    containerClass:
      "bg-[var(--color-surface)]/90 backdrop-blur-md border-red-500/25 shadow-[0_12px_40px_rgba(0,0,0,0.5),inset_0_0_0_1px_rgba(239,68,68,0.1)]",
    barColor: "bg-red-500",
  },
  warning: {
    icon: <AlertTriangle size={17} className="text-amber-400 shrink-0" />,
    containerClass:
      "bg-[var(--color-surface)]/90 backdrop-blur-md border-amber-500/25 shadow-[0_12px_40px_rgba(0,0,0,0.5),inset_0_0_0_1px_rgba(245,158,11,0.1)]",
    barColor: "bg-amber-500",
  },
  info: {
    icon: <Info size={17} className="text-[var(--accent-color)] shrink-0" />,
    containerClass:
      "bg-[var(--color-surface)]/90 backdrop-blur-md border-[var(--accent-color-border)] shadow-[0_12px_40px_rgba(0,0,0,0.5),inset_0_0_0_1px_var(--accent-color-ring)]",
    barColor: "bg-[var(--accent-color)]",
  },
};

const Snackbar: React.FC<SnackbarProps> = ({
  id,
  message,
  type,
  duration = 5000,
  onClose,
}) => {
  const [isVisible, setIsVisible] = useState(false);

  const handleClose = useCallback(() => {
    setIsVisible(false);
    setTimeout(() => onClose(id), 300);
  }, [id, onClose]);

  useEffect(() => {
    requestAnimationFrame(() => setIsVisible(true));

    if (duration <= 0) {
      return;
    }

    const timer = setTimeout(() => {
      handleClose();
    }, duration);
    return () => clearTimeout(timer);
  }, [duration, handleClose]);

  const config = TYPE_CONFIG[type];

  return (
    <div
      className={[
        "relative flex items-start gap-3 px-4 py-3 rounded-xl border overflow-hidden",
        "min-w-[320px] max-w-[420px]",
        "transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
        config.containerClass,
        isVisible
          ? "translate-y-0 opacity-100 scale-100"
          : "translate-y-4 opacity-0 scale-95",
      ].join(" ")}
      role="alert"
    >
      {/* Icon */}
      <div className="mt-0.5">{config.icon}</div>

      {/* Message */}
      <p className="text-sm font-medium flex-1 text-[var(--color-text-secondary)] leading-snug">
        {message}
      </p>

      {/* Close button */}
      <button
        onClick={handleClose}
        className="pressable mt-0.5 shrink-0 p-1 rounded-md hover:bg-[var(--color-surface-hover)] transition-colors"
        aria-label="Close notification"
      >
        <X
          size={14}
          className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
        />
      </button>

      {/* Progress bar — shrinks from full width to zero over duration */}
      {duration > 0 && (
        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[var(--color-border)]">
          <div
            className={["h-full origin-left", config.barColor].join(" ")}
            style={{
              animation: `progress-shrink ${duration}ms linear forwards`,
            }}
          />
        </div>
      )}
    </div>
  );
};

export default Snackbar;
