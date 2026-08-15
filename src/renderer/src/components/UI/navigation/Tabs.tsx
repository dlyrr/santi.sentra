import React from "react";
import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";
import { cn } from "@renderer/lib/utils";

export interface Tab {
  id: string;
  label: string;
  icon?: LucideIcon;
  badge?: string | number;
  badgeVariant?: "default" | "warning" | "success" | "error";
  hidden?: boolean;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  layoutId?: string;
  className?: string;
  tabClassName?: string;
  actions?: React.ReactNode;
}

const getBadgeClasses = (variant: Tab["badgeVariant"] = "default") => {
  switch (variant) {
    case "warning":
      return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
    case "success":
      return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
    case "error":
      return "bg-red-500/20 text-red-400 border-red-500/30";
    default:
      return "bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)]";
  }
};

export const Tabs: React.FC<TabsProps> = ({
  tabs,
  activeTab,
  onTabChange,
  layoutId = "tabIndicator",
  className,
  tabClassName,
  actions,
}) => {
  const visibleTabs = tabs.filter((tab) => !tab.hidden);

  return (
    <div
      className={cn(
        "flex items-center gap-1 p-1 bg-[var(--color-surface-strong)] rounded-lg shrink-0 overflow-x-auto scrollbar-hide",
        className,
      )}
    >
      {visibleTabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;

        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            className={cn(
              "relative px-3 py-1.5 text-sm font-medium transition-colors flex items-center justify-center gap-2 rounded-md",
              isActive
                ? "text-[var(--color-text-primary)]"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]",
              tabClassName,
            )}
          >
            {isActive && (
              <motion.div
                layoutId={layoutId}
                className="absolute inset-0 bg-[var(--color-surface)] rounded-md shadow-sm border border-[var(--color-border-subtle)]"
                transition={{ type: "spring", bounce: 0, duration: 0.3 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-2">
              {Icon && <Icon size={14} />}
              {tab.label}
              {tab.badge !== undefined && (
                <span
                  className={cn(
                    "text-[10px] px-1.5 py-0.5 rounded-full border",
                    getBadgeClasses(tab.badgeVariant),
                  )}
                >
                  {tab.badge}
                </span>
              )}
            </span>
          </button>
        );
      })}
      {actions && (
        <div className="flex items-center border-l border-[var(--color-border)] ml-1 pl-2 shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
};

export default Tabs;
