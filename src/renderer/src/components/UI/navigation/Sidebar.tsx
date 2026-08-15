import React, { useMemo } from "react";
import { Menu, ChevronLeft, Search } from "lucide-react";
import { Account, TabId } from "@renderer/types";
import SidebarItem from "./SidebarItem";
import { Button } from "../buttons/Button";
import {
  TooltipProvider,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "../display/Tooltip";
import { motion } from "framer-motion";
import {
  useActiveTab,
  useSidebarCollapsed,
  useToggleSidebarCollapsed,
} from "../../../stores/useUIStore";
import { useCommandPaletteStore } from "../../../features/command-palette/stores/useCommandPaletteStore";
import { useTabTransition } from "@renderer/hooks/useTabTransition";
import { SentraLogo } from "@renderer/components/UI/icons/SentraLogo";
import {
  getVisibleSidebarTabs,
  sanitizeSidebarHidden,
  sanitizeSidebarOrder,
} from "@shared/navigation";
import {
  SidebarTabDefinition,
  SIDEBAR_TAB_DEFINITION_MAP,
} from "@renderer/constants/sidebarTabs";
import { ProfileCard } from "./ProfileCard";

interface SidebarProps {
  sidebarWidth: number;
  isResizing: boolean;
  sidebarRef: React.RefObject<HTMLElement | null>;
  onResizeStart: () => void;
  selectedAccounts?: Account[];
  primaryAccount?: Account | null;
  selectedAccount: Account | null;
  showProfileCard: boolean;
  privacyMode: boolean;
  tabOrder: TabId[];
  hiddenTabs: TabId[];
}

const isMac = window.platform?.isMac ?? false;

const Sidebar = ({
  sidebarWidth,
  isResizing,
  sidebarRef,
  onResizeStart,
  selectedAccounts = [],
  primaryAccount,
  selectedAccount,
  showProfileCard,
  privacyMode,
  tabOrder,
  hiddenTabs,
}: SidebarProps) => {
  // Using individual selectors for optimized re-renders
  const activeTab = useActiveTab();
  const setActiveTab = useTabTransition();
  const isSidebarCollapsed = useSidebarCollapsed();
  const toggleSidebarCollapsed = useToggleSidebarCollapsed();
  const openCommandPalette = useCommandPaletteStore((s) => s.open);

  const normalizedOrder = useMemo(
    () => sanitizeSidebarOrder(tabOrder),
    [tabOrder],
  );
  const normalizedHiddenTabs = useMemo(
    () => sanitizeSidebarHidden(hiddenTabs),
    [hiddenTabs],
  );
  const visibleTabs = useMemo(
    () => getVisibleSidebarTabs(normalizedOrder, normalizedHiddenTabs),
    [normalizedHiddenTabs, normalizedOrder],
  );
  const sidebarTabs = useMemo(
    () =>
      visibleTabs
        .map((tabId) => SIDEBAR_TAB_DEFINITION_MAP[tabId])
        .filter(Boolean) as SidebarTabDefinition[],
    [visibleTabs],
  );

  return (
    <TooltipProvider>
      <motion.aside
        ref={sidebarRef}
        style={{ width: isSidebarCollapsed ? "72px" : `${sidebarWidth}px` }}
        className={`flex flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)] z-30 relative ${
          isSidebarCollapsed ? "min-w-[72px]" : ""
        } ${!isResizing ? "transition-[width] duration-300 ease-in-out" : ""}`}
      >
        {/* Sidebar Header - extra top padding on macOS for traffic lights */}
        <div
          className={`flex items-center shrink-0 bg-[var(--color-surface)] transition-all duration-300 relative ${
            isSidebarCollapsed
              ? "justify-center px-0"
              : "justify-center px-0"
          }`}
          style={{
            height: isMac ? "72px" : "72px",
            paddingTop: isMac ? "28px" : "0px",
          }}
        >
          <div
            className={`font-bold text-2xl tracking-tight text-[var(--color-text-primary)] transition-all duration-200 flex items-center justify-center gap-2 ${
              isSidebarCollapsed
                ? "opacity-0 w-0 overflow-hidden"
                : "opacity-100 w-auto"
            }`}
          >
            <SentraLogo className="h-10 w-10 shrink-0" />
            <span>Sentra</span>
          </div>
          {!isMac && (
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleSidebarCollapsed}
              className="absolute right-3 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)]"
            >
              {isSidebarCollapsed ? (
                <Menu size={20} />
              ) : (
                <ChevronLeft size={20} />
              )}
            </Button>
          )}
        </div>

        {/* Global Search Trigger */}
        <div className="px-3 pb-2 pt-4">
          <button
            onClick={openCommandPalette}
            className={`w-full flex items-center justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] text-[var(--color-text-muted)] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)] transition-all px-3 h-10 ${
              isSidebarCollapsed ? "justify-center px-0" : ""
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Search size={16} />
              {!isSidebarCollapsed && (
                <span className="text-sm font-medium">Search</span>
              )}
            </div>
            {!isSidebarCollapsed && (
              <div className="flex items-center gap-0.5 opacity-60">
                <kbd className="px-1.5 py-0.5 text-[10px] font-sans bg-[var(--color-surface)] border border-[var(--color-border)] rounded shadow-sm text-[var(--color-text-secondary)]">
                  ⌘
                </kbd>
                <kbd className="px-1.5 py-0.5 text-[10px] font-sans bg-[var(--color-surface)] border border-[var(--color-border)] rounded shadow-sm text-[var(--color-text-secondary)]">
                  K
                </kbd>
              </div>
            )}
          </button>
        </div>

        {/* Nav Items */}
        <div className="flex-1 overflow-y-auto scrollbar-hide">
          <nav>
            {sidebarTabs.map((tab, index) => {
              const previous = sidebarTabs[index - 1] as
                | SidebarTabDefinition
                | undefined;
              const showSeparator =
                previous && previous.section !== tab.section;

              return (
                <React.Fragment key={tab.id}>
                  {showSeparator && (
                    <div className="my-2 mx-3 border-t border-[var(--color-border)]" />
                  )}
                  <SidebarItem
                    icon={tab.icon}
                    label={tab.label}
                    isActive={activeTab === tab.id}
                    isCollapsed={isSidebarCollapsed}
                    onClick={() => setActiveTab(tab.id)}
                    disableLayoutAnimation={isResizing || isSidebarCollapsed}
                  />
                </React.Fragment>
              );
            })}
          </nav>
        </div>

        {/* Bottom Profile Card */}
        {(selectedAccount || primaryAccount) && showProfileCard && (
          <div className="border-t border-[var(--color-border)] shrink-0 bg-[var(--color-surface)] relative">
            <ProfileCard
              account={
                selectedAccounts.length > 0
                  ? selectedAccounts[0]
                  : selectedAccount || primaryAccount!
              }
              selectedAccounts={selectedAccounts}
              isCollapsed={isSidebarCollapsed}
              privacyMode={privacyMode}
              onTransactionsClick={() => setActiveTab("Transactions")}
            />
          </div>
        )}

        {/* Resize Handle */}
        {!isSidebarCollapsed && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                onMouseDown={onResizeStart}
                className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:w-1.5 transition-all z-40"
                style={{
                  background: isResizing ? "rgb(115, 115, 115)" : "transparent",
                  right: "-2px",
                  width: "4px",
                }}
              >
                <div className="absolute inset-0 hover:bg-[var(--color-border-subtle)] transition-colors" />
              </div>
            </TooltipTrigger>
            <TooltipContent>Drag to resize</TooltipContent>
          </Tooltip>
        )}
      </motion.aside>
    </TooltipProvider>
  );
};

export default Sidebar;
