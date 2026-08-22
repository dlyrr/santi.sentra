import React from "react";
import { ChevronDown } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@renderer/lib/utils";
import { NAV_EASE, navSectionLabel } from "./navTokens";

interface SidebarSectionProps {
  label: string;
  /** Collapsed rail mode: no headings, just a hairline between groups. */
  isRail: boolean;
  isOpen: boolean;
  onToggle: () => void;
  /** True when a tab inside this group is the active tab. */
  containsActive: boolean;
  /** Suppresses the expand/collapse animation while the sidebar resizes. */
  disableAnimation?: boolean;
  showDivider: boolean;
  children: React.ReactNode;
}

export const SidebarSection = ({
  label,
  isRail,
  isOpen,
  onToggle,
  containsActive,
  disableAnimation = false,
  showDivider,
  children,
}: SidebarSectionProps) => {
  if (isRail) {
    return (
      <div className="py-0.5">
        {showDivider && (
          <div className="my-2 mx-4 border-t border-[var(--color-border)]" />
        )}
        {children}
      </div>
    );
  }

  return (
    <div className="pb-1">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className={cn(
          "group w-[calc(100%-16px)] mx-2 mt-3 mb-1 px-2.5 h-6 flex items-center gap-1.5 rounded-md",
          "transition-colors duration-200 hover:bg-[var(--color-surface-hover)]",
        )}
      >
        <ChevronDown
          size={11}
          strokeWidth={2.5}
          className={cn(
            "shrink-0 text-[var(--color-text-muted)] transition-transform duration-200",
            "opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
            isOpen ? "rotate-0" : "-rotate-90 opacity-100",
          )}
        />
        <span
          className={cn(
            navSectionLabel,
            "transition-colors duration-200 group-hover:text-[var(--color-text-secondary)]",
          )}
        >
          {label}
        </span>
        {/* When a group is collapsed but holds the active tab, keep a trace of it. */}
        {!isOpen && containsActive && (
          <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[var(--accent-color)]" />
        )}
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            key="content"
            initial={disableAnimation ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: NAV_EASE }}
            className="overflow-hidden"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SidebarSection;
