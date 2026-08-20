import React, { useMemo } from "react";
import { motion } from "framer-motion";
import {
  Users,
  HardDrive,
  EyeOff,
  Sliders,
  RotateCcw,
  Eye,
  ChevronUp,
  ChevronDown,
  Bell,
  PanelLeft,
} from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Account, Settings, TabId } from "../../../types";
import CustomCheckbox from "../../../components/UI/buttons/CustomCheckbox";
import CustomDropdown, {
  DropdownOption,
} from "../../../components/UI/menus/CustomDropdown";
import {
  BentoCard,
  BentoToggle,
  SectionDivider,
  PageHeader,
} from "./SharedComponents";
import { useInstallations } from "../../install/stores/useInstallationsStore";
import {
  DEFAULT_SIDEBAR_TAB_ORDER,
  LOCKED_SIDEBAR_TABS,
  sanitizeSidebarHidden,
  sanitizeSidebarOrder,
} from "@shared/navigation";
import {
  SIDEBAR_TAB_DEFINITION_MAP,
  SidebarTabDefinition,
} from "../../../constants/sidebarTabs";
import { cn } from "../../../lib/utils";

interface GeneralSettingsTabProps {
  accounts: Account[];
  settings: Settings;
  onUpdateSettings: (newSettings: Partial<Settings>) => void;
}

export const GeneralSettingsTab: React.FC<GeneralSettingsTabProps> = ({
  accounts,
  settings,
  onUpdateSettings,
}) => {
  const installations = useInstallations();

  const sidebarTabOrder = useMemo(
    () => sanitizeSidebarOrder(settings.sidebarTabOrder),
    [settings.sidebarTabOrder],
  );
  const sidebarHiddenTabs = useMemo(
    () => sanitizeSidebarHidden(settings.sidebarHiddenTabs),
    [settings.sidebarHiddenTabs],
  );
  const sidebarTabs = useMemo(
    () =>
      sidebarTabOrder
        .map((tabId) => SIDEBAR_TAB_DEFINITION_MAP[tabId])
        .filter(Boolean) as SidebarTabDefinition[],
    [sidebarTabOrder],
  );
  const hiddenSidebarTabsSet = useMemo(
    () => new Set(sidebarHiddenTabs),
    [sidebarHiddenTabs],
  );

  const accountOptions: DropdownOption[] = [
    { value: "", label: "None" },
    ...accounts.map((account) => ({
      value: account.id,
      label: account.displayName,
      labelNode: settings.privacyMode ? (
        <span style={{ filter: "blur(16px)" }}>{account.displayName}</span>
      ) : undefined,
      subLabel: `@${account.username}`,
      subLabelNode: settings.privacyMode ? (
        <span style={{ filter: "blur(16px)" }}>@{account.username}</span>
      ) : undefined,
    })),
  ];

  const installationOptions: DropdownOption[] = [
    { value: "", label: "System Default" },
    ...installations.map((inst) => ({
      value: inst.path,
      label: inst.name,
      subLabel: inst.version.substring(0, 15) + "...",
    })),
  ];

  const { data: discordRPCState, refetch: refetchDiscordRPC } = useQuery({
    queryKey: ["discordRPCState"],
    queryFn: () => window.api.getDiscordRPCState(),
    staleTime: 5000,
  });

  const discordRPCEnabled = discordRPCState?.isEnabled ?? false;

  const toggleDiscordRPC = useMutation({
    mutationFn: async (enable: boolean) => {
      if (enable) {
        await window.api.enableDiscordRPC();
      } else {
        await window.api.disableDiscordRPC();
      }
    },
    onSuccess: () => {
      refetchDiscordRPC();
    },
  });

  const updateDiscordMode = useMutation({
    mutationFn: async (mode: "full" | "playing" | "accounts" | "minimal") => {
      await window.api.setDiscordRPCStatusMode(mode);
    },
    onSuccess: () => refetchDiscordRPC(),
  });

  const updateDiscordText = useMutation({
    mutationFn: async (text: string | null) => {
      await window.api.setDiscordRPCCustomText(text);
    },
    onSuccess: () => refetchDiscordRPC(),
  });

  const handlePrimaryAccountChange = (value: string) => {
    onUpdateSettings({ primaryAccountId: value === "" ? null : value });
  };

  const handleDefaultInstallChange = (value: string) => {
    onUpdateSettings({
      defaultInstallationPath: value === "" ? undefined : value,
    });
  };

  const handleToggleTabVisibility = (tabId: TabId) => {
    if (LOCKED_SIDEBAR_TABS.includes(tabId)) return;
    const nextHidden = hiddenSidebarTabsSet.has(tabId)
      ? sidebarHiddenTabs.filter((id) => id !== tabId)
      : [...sidebarHiddenTabs, tabId];
    onUpdateSettings({ sidebarHiddenTabs: nextHidden });
  };

  const handleMoveTab = (tabId: TabId, direction: number) => {
    const currentIndex = sidebarTabOrder.indexOf(tabId);
    if (currentIndex === -1) return;
    const targetIndex = currentIndex + direction;
    if (targetIndex < 0 || targetIndex >= sidebarTabOrder.length) return;
    const nextOrder = [...sidebarTabOrder];
    const [moved] = nextOrder.splice(currentIndex, 1);
    nextOrder.splice(targetIndex, 0, moved);
    onUpdateSettings({ sidebarTabOrder: nextOrder });
  };

  const handleResetNavigation = () => {
    onUpdateSettings({
      sidebarTabOrder: DEFAULT_SIDEBAR_TAB_ORDER,
      sidebarHiddenTabs: [],
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="pb-10"
    >
      <div className="grid grid-cols-2 gap-4">
        <PageHeader
          title="General"
          description="Configure your account preferences and application defaults."
        />

        <SectionDivider label="Accounts & Launch" />

        {}
        <BentoCard
          icon={<Users size={16} />}
          title="Primary Account"
          description="Auto-selected when the app starts."
        >
          <CustomDropdown
            options={accountOptions}
            value={settings.primaryAccountId || ""}
            onChange={handlePrimaryAccountChange}
            placeholder="Select primary account"
          />
        </BentoCard>

        {}
        <BentoCard
          icon={<HardDrive size={16} />}
          title="Default Installation"
          description="Which Roblox client to launch games with."
        >
          <CustomDropdown
            options={installationOptions}
            value={settings.defaultInstallationPath || ""}
            onChange={handleDefaultInstallChange}
            placeholder="Select installation"
          />
        </BentoCard>

        <SectionDivider label="Privacy & Integrations" />

        <BentoCard
          icon={<EyeOff size={16} />}
          title="Privacy Mode"
          description="Blur account names and avatars for streaming."
        >
          <BentoToggle
            checked={settings.privacyMode}
            onChange={() =>
              onUpdateSettings({ privacyMode: !settings.privacyMode })
            }
            label={settings.privacyMode ? "Enabled" : "Disabled"}
          />
        </BentoCard>

        {}
        <div className="col-span-2 relative overflow-hidden group rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--accent-color)]/40 transition-all duration-300 flex flex-col p-5">
          <div className="absolute inset-0 bg-gradient-to-br from-[var(--accent-color)]/[0.04] to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none rounded-xl" />
          <div className="flex items-center justify-between z-10 relative">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-[var(--color-surface-hover)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-secondary)] group-hover:text-[var(--accent-color)] transition-colors shrink-0">
                <Bell size={16} />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-[var(--color-text-primary)] leading-none">
                  Discord Rich Presence
                </h4>
                <p className="text-xs text-[var(--color-text-muted)] mt-1">
                  Show your activity in Discord status.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-[var(--color-text-secondary)]">
                {toggleDiscordRPC.isPending
                  ? discordRPCEnabled
                    ? "Disabling…"
                    : "Connecting…"
                  : discordRPCEnabled
                    ? "Connected"
                    : "Disconnected"}
              </span>
              <BentoToggle
                checked={discordRPCEnabled}
                onChange={() => toggleDiscordRPC.mutate(!discordRPCEnabled)}
                disabled={toggleDiscordRPC.isPending}
              />
            </div>
          </div>

          {discordRPCEnabled && discordRPCState && (
            <motion.div
              initial={{ height: 0, opacity: 0, marginTop: 0 }}
              animate={{ height: "auto", opacity: 1, marginTop: 16 }}
              className="z-10 relative border-t border-[var(--color-border)] pt-4 flex gap-4"
            >
              <div className="flex-1 flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-[var(--color-text-secondary)]">
                  Presence Mode
                </label>
                <CustomDropdown
                  options={[
                    {
                      value: "full",
                      label: "Detailed",
                      subLabel: "Game, Accounts, Tab",
                    },
                    {
                      value: "playing",
                      label: "Playing Only",
                      subLabel: "Only shows game activity",
                    },
                    {
                      value: "accounts",
                      label: "Accounts Only",
                      subLabel: "Only shows account count",
                    },
                    {
                      value: "minimal",
                      label: "Minimal",
                      subLabel: "Just shows 'Sentra'",
                    },
                  ]}
                  value={discordRPCState.statusMode || "full"}
                  onChange={(v) => updateDiscordMode.mutate(v as any)}
                  placeholder="Select mode"
                />
              </div>
              <div className="flex-1 flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-[var(--color-text-secondary)]">
                  Custom Details
                </label>
                <input
                  type="text"
                  maxLength={128}
                  placeholder="e.g. Managing 50 accounts"
                  defaultValue={discordRPCState.customStatusText || ""}
                  onBlur={(e) => {
                    const val = e.target.value.trim();
                    updateDiscordText.mutate(val === "" ? null : val);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.currentTarget.blur();
                  }}
                  className="w-full bg-[var(--color-surface-hover)] border border-[var(--color-border)] rounded-md px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--accent-color)] transition-colors h-[34px]"
                />
              </div>
            </motion.div>
          )}
        </div>

        <SectionDivider label="Navigation" />

        <BentoCard
          icon={<Users size={16} />}
          title="Sidebar Profile Card"
          description="Show quick profile in the sidebar."
        >
          <BentoToggle
            checked={settings.showSidebarProfileCard}
            onChange={() =>
              onUpdateSettings({
                showSidebarProfileCard: !settings.showSidebarProfileCard,
              })
            }
            label={settings.showSidebarProfileCard ? "Visible" : "Hidden"}
          />
        </BentoCard>

        {}
        <div className="col-span-2 relative overflow-hidden group rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--accent-color)]/40 transition-all duration-300 flex flex-col p-5">
          <div className="absolute inset-0 bg-gradient-to-br from-[var(--accent-color)]/[0.04] to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none rounded-xl" />
          <div className="flex items-center justify-between mb-4 z-10 relative">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-[var(--color-surface-hover)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-secondary)] group-hover:text-[var(--accent-color)] transition-colors shrink-0">
                <PanelLeft size={16} />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-[var(--color-text-primary)] leading-none">
                  Sidebar Tabs
                </h4>
                <p className="text-xs text-[var(--color-text-muted)] mt-1">
                  Hide and reorder tabs to match your workflow.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleResetNavigation}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-hover)] transition-colors"
            >
              <RotateCcw size={12} />
              Reset
            </button>
          </div>
          <div className="pt-4 border-t border-[var(--color-border)] z-10 relative">
            <div className="space-y-2 max-h-[280px] overflow-y-auto styled-scrollbar -mr-1 pr-1">
              {sidebarTabs.map((tab, index) => {
                const isHidden = hiddenSidebarTabsSet.has(tab.id);
                const isLocked = LOCKED_SIDEBAR_TABS.includes(tab.id);
                const Icon = tab.icon;
                return (
                  <div
                    key={tab.id}
                    className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-hover)]"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <CustomCheckbox
                        checked={!isHidden || isLocked}
                        disabled={isLocked}
                        onChange={() => handleToggleTabVisibility(tab.id)}
                      />
                      <Icon
                        size={15}
                        className="text-[var(--color-text-secondary)] flex-shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-[var(--color-text-primary)]">
                          {tab.label}
                        </div>
                        <div className="flex items-center gap-1 text-[11px] text-[var(--color-text-muted)]">
                          {isLocked ? (
                            <span className="text-[var(--accent-color)] font-medium">
                              Always visible
                            </span>
                          ) : isHidden ? (
                            <>
                              <EyeOff size={11} />
                              Hidden
                            </>
                          ) : (
                            <>
                              <Eye size={11} />
                              Visible
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => handleMoveTab(tab.id, -1)}
                        disabled={index === 0}
                        className="p-1.5 rounded-md border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-muted)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        aria-label={`Move ${tab.label} up`}
                      >
                        <ChevronUp size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveTab(tab.id, 1)}
                        disabled={index === sidebarTabs.length - 1}
                        className="p-1.5 rounded-md border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-muted)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        aria-label={`Move ${tab.label} down`}
                      >
                        <ChevronDown size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
