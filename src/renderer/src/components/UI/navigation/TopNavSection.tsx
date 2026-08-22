import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { TabId } from "@renderer/types";
import type {
  SidebarSectionDefinition,
  SidebarTabDefinition,
} from "@renderer/constants/sidebarTabs";
import { cn } from "@renderer/lib/utils";
import { useClickOutside } from "../../../hooks/useClickOutside";
import {
  NAV_EASE,
  NAV_SPRING,
  navIconStroke,
  navIconTone,
  navIndicator,
  navItemBase,
  navItemTone,
} from "./navTokens";

interface TopNavSectionProps {
  section: SidebarSectionDefinition;
  tabs: SidebarTabDefinition[];
  activeTab: TabId;
  onSelect: (tab: TabId) => void;
}

/**
 * One section of the top bar.
 *
 * The top bar used to be every tab at once as bare icons — seventeen glyphs
 * with no labels, in a row that scrolled sideways with a hidden scrollbar, so
 * tabs could sit off screen with nothing to say so. Sections collapse that to
 * four buttons that always fit, and give the icons their labels back.
 *
 * The section holding the active tab shows that tab instead of its own name, so
 * the bar still answers "where am I?" at a glance.
 */
export const TopNavSection = ({
  section,
  tabs,
  activeTab,
  onSelect,
}: TopNavSectionProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useClickOutside(containerRef, () => setIsOpen(false));

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen]);

  const isActive = tabs.some((tab) => tab.id === activeTab);

  // A section the user has narrowed to a single tab does not need a menu.
  const isSingle = tabs.length === 1;

  const handleTrigger = () => {
    if (isSingle) {
      onSelect(tabs[0].id);
      return;
    }
    setIsOpen((open) => !open);
  };

  // The group always shows its own name and icon. Swapping in the open tab's
  // label made the bar look like it was renaming itself as you moved around;
  // the active state is carried by the indicator and the accent instead.
  const TriggerIcon = section.icon;
  const triggerLabel = section.label;

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        onClick={handleTrigger}
        aria-haspopup={isSingle ? undefined : "menu"}
        aria-expanded={isSingle ? undefined : isOpen}
        aria-current={isActive ? "page" : undefined}
        className={cn(
          navItemBase,
          "h-9 px-2.5 gap-2 text-[13px]",
          navItemTone(isActive),
        )}
      >
        {isActive && (
          <motion.span
            layoutId="topnav-active"
            className={navIndicator}
            initial={false}
            transition={NAV_SPRING}
          />
        )}

        <span className="relative z-10 flex items-center gap-2">
          {TriggerIcon && (
            <TriggerIcon
              size={16}
              strokeWidth={navIconStroke(isActive)}
              className={navIconTone(isActive)}
            />
          )}
          <span className="whitespace-nowrap">{triggerLabel}</span>
          {!isSingle && (
            <ChevronDown
              size={12}
              strokeWidth={2.4}
              className={cn(
                "opacity-50 transition-transform duration-200",
                isOpen && "rotate-180",
              )}
            />
          )}
        </span>
      </button>

      <AnimatePresence>
        {isOpen && !isSingle && (
          <motion.div
            role="menu"
            aria-label={section.label}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.14, ease: NAV_EASE }}
            className={cn(
              "absolute left-0 top-[calc(100%+6px)] z-50 min-w-[190px] p-1",
              "rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]",
              "shadow-[0_12px_32px_rgba(0,0,0,0.35)]",
            )}
          >
            <div className="px-2 pt-1 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
              {section.label}
            </div>
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const selected = tab.id === activeTab;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onSelect(tab.id);
                    setIsOpen(false);
                  }}
                  className={cn(
                    "w-full flex items-center gap-2.5 h-8 px-2 rounded-lg text-[13px] font-medium",
                    "transition-colors duration-150 outline-none",
                    selected
                      ? "bg-[var(--accent-color-soft)] text-[var(--color-text-primary)]"
                      : "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)] focus-visible:bg-[var(--color-surface-hover)]",
                  )}
                >
                  <Icon
                    size={15}
                    strokeWidth={navIconStroke(selected)}
                    className={navIconTone(selected)}
                  />
                  <span className="whitespace-nowrap">{tab.label}</span>
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TopNavSection;
