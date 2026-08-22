import React from "react";
import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";
import { cn } from "@renderer/lib/utils";
import {
  NAV_SPRING,
  navBadge,
  navBadgeTone,
  navIconStroke,
  navIconTone,
  navIndicator,
  navItemBase,
  navItemTone,
} from "./navTokens";

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

/**
 * In-page pill tabs. Shares its indicator, spring and colour tokens with the
 * sidebar and top bar so navigation reads the same everywhere.
 */
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
      role="tablist"
      className={cn(
        "flex items-center gap-0.5 p-1 rounded-lg shrink-0 overflow-x-auto scrollbar-hide",
        "bg-[var(--color-surface-strong)] border border-[var(--color-border-subtle)]",
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
            role="tab"
            aria-selected={isActive}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              navItemBase,
              "h-8 px-3 gap-2 text-[13px] shrink-0",
              navItemTone(isActive),
              tabClassName,
            )}
          >
            {isActive && (
              <motion.span
                layoutId={layoutId}
                className={navIndicator}
                transition={NAV_SPRING}
              />
            )}
            <span className="relative z-10 flex items-center gap-2">
              {Icon && (
                <Icon
                  size={14}
                  strokeWidth={navIconStroke(isActive)}
                  className={navIconTone(isActive)}
                />
              )}
              {tab.label}
              {tab.badge !== undefined && (
                <span className={cn(navBadge, navBadgeTone(tab.badgeVariant))}>
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
