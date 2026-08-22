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
import {
  NAV_SPRING,
  navIconStroke,
  navIconTone,
  navIndicator,
  navItemBase,
  navItemTone,
} from "./navTokens";
import NotificationTray from "../feedback/NotificationTray";
import WindowControls from "./WindowControls";
import { ProfileCard } from "./ProfileCard";

const isMac = window.platform?.isMac ?? false;

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
        type="button"
        onMouseDown={onClick}
        aria-label={label}
        aria-current={isActive ? "page" : undefined}
        className={cn(
          navItemBase,
          "justify-center h-9 w-9 shrink-0",
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
        <Icon
          size={17}
          strokeWidth={navIconStroke(isActive)}
          className={cn("relative z-10", navIconTone(isActive))}
        />
      </button>
    </TooltipTrigger>
    <TooltipContent side="bottom" sideOffset={6}>
      {label}
    </TooltipContent>
  </Tooltip>
);

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
        data-tauri-drag-region
        className="flex-shrink-0 z-30 relative flex items-center bg-[var(--color-surface-strong)] border-b border-[var(--color-border)]"
        style={
          {
            height: isMac ? "72px" : "52px",
            paddingTop: isMac ? "28px" : "0px",
            WebkitAppRegion: "drag",
          } as React.CSSProperties
        }
      >
        {}
        <div
          className="flex items-center gap-2 px-4 shrink-0"
          style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
        >
          <SentraLogo className="h-7 w-7 shrink-0" />
          <span className="font-bold text-base tracking-tight text-[var(--color-text-primary)] hidden sm:block">
            Sentra
          </span>
        </div>

        {}
        <div className="w-px h-5 bg-[var(--color-border)] mx-1" />

        {}
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

        {}
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

        {/* Tauri has no titleBarOverlay, so the caption buttons are ours. */}
        <WindowControls className="self-stretch" />
      </header>
    </TooltipProvider>
  );
};

export default TopNav;
