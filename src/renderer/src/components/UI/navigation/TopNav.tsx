import React, { useMemo } from "react";
import { Search } from "lucide-react";
import { Account, TabId } from "@renderer/types";
import { TooltipProvider } from "../display/Tooltip";
import { SentraLogo } from "@renderer/components/UI/icons/SentraLogo";
import { useActiveTab } from "../../../stores/useUIStore";
import { useTabTransition } from "@renderer/hooks/useTabTransition";
import {
  getVisibleSidebarTabs,
  sanitizeSidebarHidden,
  sanitizeSidebarOrder,
} from "@shared/navigation";
import {
  groupSidebarTabs,
  SIDEBAR_TAB_DEFINITION_MAP,
  SidebarTabDefinition,
} from "@renderer/constants/sidebarTabs";
import NotificationTray from "../feedback/NotificationTray";
import WindowControls from "./WindowControls";
import TopNavSection from "./TopNavSection";
import { ProfileCard } from "./ProfileCard";

const isMac = window.platform?.isMac ?? false;

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
  const navGroups = useMemo(() => groupSidebarTabs(navTabs), [navTabs]);

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
          aria-label="Primary"
          className="flex-1 flex items-center gap-1 px-2"
          style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
        >
          {navGroups.map((group) => (
            <TopNavSection
              key={group.section.id}
              section={group.section}
              tabs={group.tabs}
              activeTab={activeTab}
              onSelect={setActiveTab}
            />
          ))}
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
