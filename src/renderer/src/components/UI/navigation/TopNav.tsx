import React, { useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Menu,
  LogOut,
  ArrowRightLeft,
  Ticket,
  Heart,
  ChevronDown,
} from "lucide-react";
import { Account, TabId } from "@renderer/types";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "../display/Tooltip";
import { SentraLogo } from "@renderer/components/UI/icons/SentraLogo";
import { RobuxIcon } from "@renderer/components/UI/icons/RobuxIcon";
import { SlidingNumber } from "@renderer/components/UI/specialized/SlidingNumber";
import { formatNumber } from "@renderer/utils/numberUtils";
import { useClickOutside } from "../../../hooks/useClickOutside";
import {
  useAccountsManager,
  useAccountStats,
} from "../../../features/auth/api/useAccounts";
import { useActiveTab } from "../../../stores/useUIStore";
import { useTabTransition } from "@renderer/hooks/useTabTransition";
import { cn } from "@renderer/lib/utils";
import {
  getVisibleSidebarTabs,
  sanitizeSidebarHidden,
  sanitizeSidebarOrder,
} from "@shared/navigation";
import {
  SIDEBAR_TAB_DEFINITION_MAP,
  SidebarTabDefinition,
} from "@renderer/constants/sidebarTabs";
import NotificationTray from "../feedback/NotificationTray";
import { ProfileCard } from "./ProfileCard";

const isMac = window.platform?.isMac ?? false;

// ─── Top Nav Item ─────────────────────────────────────────────────────────────
interface TopNavItemProps {
  icon: React.ComponentType<{
    size?: number;
    strokeWidth?: number;
    className?: string;
  }>;
  label: string;
  isActive: boolean;
  onClick: () => void;
}

const TopNavItem = ({
  icon: Icon,
  label,
  isActive,
  onClick,
}: TopNavItemProps) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <button
        onMouseDown={onClick}
        className={cn(
          "relative flex flex-col items-center justify-center h-10 w-10 rounded-xl transition-all duration-200 group",
          isActive
            ? "bg-[var(--accent-color-soft)] text-[var(--color-text-primary)]"
            : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)]",
        )}
        aria-label={label}
      >
        <Icon
          size={17}
          strokeWidth={isActive ? 2.2 : 1.85}
          className={cn(
            "transition-colors duration-200",
            isActive ? "text-[var(--accent-color)]" : "",
          )}
        />
        {/* Active underline indicator */}
        {isActive && (
          <motion.div
            layoutId="topnav-active"
            className="absolute bottom-0 left-1/2 -translate-x-1/2 h-[2.5px] w-5 bg-[var(--accent-color)] rounded-full"
            initial={false}
            transition={{ type: "spring", stiffness: 420, damping: 36 }}
          />
        )}
      </button>
    </TooltipTrigger>
    <TooltipContent side="bottom" sideOffset={6}>
      {label}
    </TooltipContent>
  </Tooltip>
);

// ─── Top Nav ──────────────────────────────────────────────────────────────────
interface TopNavProps {
  selectedAccounts?: Account[];
  primaryAccount?: Account | null;
  selectedAccount: Account | null;
  showProfileCard: boolean;
  privacyMode: boolean;
  tabOrder: TabId[];
  hiddenTabs: TabId[];
  onOpenCommandPalette: () => void;
  onOpenTransactions: () => void;
  onOpenUserProfile: (userId: string) => void;
}

const TopNav = ({
  selectedAccounts = [],
  primaryAccount,
  selectedAccount,
  showProfileCard,
  privacyMode,
  tabOrder,
  hiddenTabs,
  onOpenCommandPalette,
  onOpenTransactions,
  onOpenUserProfile,
}: TopNavProps) => {
  const activeTab = useActiveTab();
  const setActiveTab = useTabTransition();

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
  const navTabs = useMemo(
    () =>
      visibleTabs
        .map((tabId) => SIDEBAR_TAB_DEFINITION_MAP[tabId])
        .filter(Boolean) as SidebarTabDefinition[],
    [visibleTabs],
  );

  const accountForProfile =
    selectedAccounts.length > 0
      ? selectedAccounts[0]
      : selectedAccount || primaryAccount;

  return (
    <TooltipProvider>
      <header
        className="flex-shrink-0 z-30 relative flex items-center bg-[var(--color-surface-strong)] border-b border-[var(--color-border)]"
        style={
          {
            height: isMac ? "72px" : "52px",
            paddingTop: isMac ? "28px" : "0px",
            WebkitAppRegion: "drag",
          } as React.CSSProperties
        }
      >
        {/* Left: Logo */}
        <div
          className="flex items-center gap-2 px-4 shrink-0"
          style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
        >
          <SentraLogo className="h-7 w-7 shrink-0" />
          <span className="font-bold text-base tracking-tight text-[var(--color-text-primary)] hidden sm:block">
            Sentra
          </span>
        </div>

        {/* Separator */}
        <div className="w-px h-5 bg-[var(--color-border)] mx-1" />

        {/* Center: Nav Items */}
        <nav
          className="flex-1 flex items-center gap-0.5 px-2 overflow-x-auto scrollbar-hide"
          style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
        >
          {navTabs.map((tab, index) => {
            const previous = navTabs[index - 1] as
              | SidebarTabDefinition
              | undefined;
            const showSeparator = previous && previous.section !== tab.section;
            return (
              <React.Fragment key={tab.id}>
                {showSeparator && (
                  <div className="w-px h-5 bg-[var(--color-border)] mx-1 shrink-0" />
                )}
                <TopNavItem
                  icon={tab.icon}
                  label={tab.label}
                  isActive={activeTab === tab.id}
                  onClick={() => setActiveTab(tab.id)}
                />
              </React.Fragment>
            );
          })}
        </nav>

        {/* Right: Actions */}
        <div
          className="flex items-center gap-1.5 px-3 shrink-0"
          style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
        >
          {showProfileCard && accountForProfile && (
            <ProfileCard
              account={accountForProfile}
              selectedAccounts={selectedAccounts}
              isCollapsed={true}
              privacyMode={privacyMode}
              onTransactionsClick={onOpenTransactions}
              direction="down"
              variant="topnav"
            />
          )}

          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpenCommandPalette();
            }}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] transition-all"
            title="Search (Ctrl+K)"
          >
            <Search size={17} />
          </button>

          <NotificationTray onOpenUserProfile={onOpenUserProfile} />
        </div>
      </header>
    </TooltipProvider>
  );
};

export default TopNav;
