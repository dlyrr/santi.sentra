import type { LucideIcon } from "lucide-react";
import { TabId } from "@renderer/types";
import {
  Box,
  Eye,
  Gamepad2,
  HardDrive,
  Keyboard,
  Rocket,
  Package,
  Receipt,
  ScrollText,
  Settings as SettingsIcon,
  ShoppingBag,
  User,
  UserCheck,
  UserCog,
  Users,
  UsersRound,
  Target,
  Wand2,
  Compass,
  Wrench,
  MonitorCog,
} from "lucide-react";

export type SidebarSectionId = "account" | "explore" | "tools" | "system";

export interface SidebarTabDefinition {
  id: TabId;
  label: string;
  icon: LucideIcon;
  section: SidebarSectionId;
  /** Locked tabs cannot be hidden from the navigation. */
  locked?: boolean;
}

export interface SidebarSectionDefinition {
  id: SidebarSectionId;
  label: string;
  /**
   * The group's own icon. Fixed, rather than borrowed from whichever tab is
   * open: a heading that renames itself as you navigate is not a heading.
   */
  icon: LucideIcon;
}

/**
 * Section order is the fallback order. The user's saved tab order still wins;
 * sections are laid out by where their first tab appears in that order.
 */
export const SIDEBAR_SECTIONS: SidebarSectionDefinition[] = [
  { id: "account", label: "Account", icon: Users },
  { id: "explore", label: "Explore", icon: Compass },
  { id: "tools", label: "Tools", icon: Wrench },
  { id: "system", label: "System", icon: MonitorCog },
];

export const SIDEBAR_SECTION_MAP: Record<
  SidebarSectionId,
  SidebarSectionDefinition
> = SIDEBAR_SECTIONS.reduce(
  (acc, section) => {
    acc[section.id] = section;
    return acc;
  },
  {} as Record<SidebarSectionId, SidebarSectionDefinition>,
);

export const SIDEBAR_TAB_DEFINITIONS: SidebarTabDefinition[] = [
  { id: "Accounts", label: "Accounts", icon: Users, section: "account" },
  { id: "Profile", label: "Profile", icon: User, section: "account" },
  { id: "Friends", label: "Friends", icon: UserCheck, section: "account" },
  { id: "Groups", label: "Groups", icon: UsersRound, section: "account" },
  { id: "Avatar", label: "Avatar", icon: Box, section: "account" },

  { id: "Games", label: "Games", icon: Gamepad2, section: "explore" },
  { id: "Catalog", label: "Catalog", icon: ShoppingBag, section: "explore" },
  { id: "Inventory", label: "Inventory", icon: Package, section: "explore" },
  {
    id: "Transactions",
    label: "Transactions",
    icon: Receipt,
    section: "explore",
  },

  { id: "Launch", label: "Launch", icon: Rocket, section: "tools" },
  { id: "Install", label: "Install", icon: HardDrive, section: "tools" },
  { id: "Watcher", label: "Watcher", icon: Eye, section: "tools" },
  { id: "Macro", label: "Macro", icon: Keyboard, section: "tools" },
  { id: "Sniper", label: "Sniper", icon: Target, section: "tools" },
  { id: "Generator", label: "Generator", icon: Wand2, section: "tools" },

  { id: "Logs", label: "Logs", icon: ScrollText, section: "system" },
  {
    id: "AccountSettings",
    label: "Roblox Settings",
    icon: UserCog,
    section: "system",
  },
  {
    id: "Settings",
    label: "App Settings",
    icon: SettingsIcon,
    section: "system",
    locked: true,
  },
];

export const SIDEBAR_TAB_DEFINITION_MAP: Record<
  TabId,
  SidebarTabDefinition | undefined
> = SIDEBAR_TAB_DEFINITIONS.reduce(
  (acc, tab) => {
    acc[tab.id] = tab;
    return acc;
  },
  {} as Record<TabId, SidebarTabDefinition | undefined>,
);

/**
 * Buckets an ordered list of tabs into contiguous sections, preserving the
 * caller's ordering. A section appears where its first tab appears, so a user
 * who drags Settings to the top gets the System group at the top.
 */
export interface SidebarTabGroup {
  section: SidebarSectionDefinition;
  tabs: SidebarTabDefinition[];
}

export const groupSidebarTabs = (
  tabs: SidebarTabDefinition[],
): SidebarTabGroup[] => {
  const groups: SidebarTabGroup[] = [];
  const index = new Map<SidebarSectionId, SidebarTabGroup>();

  for (const tab of tabs) {
    let group = index.get(tab.section);
    if (!group) {
      group = { section: SIDEBAR_SECTION_MAP[tab.section], tabs: [] };
      index.set(tab.section, group);
      groups.push(group);
    }
    group.tabs.push(tab);
  }

  return groups;
};
