import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useQueryClient, useQueries } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Users, Clock, User, RefreshCw } from "lucide-react";
import { Virtuoso } from "react-virtuoso";
import { Account } from "@renderer/types";
import { Button } from "@renderer/components/UI/buttons/Button";
import { Input } from "@renderer/components/UI/inputs/Input";
import {
  Avatar,
  AvatarImage,
  AvatarFallback,
} from "@renderer/components/UI/display/Avatar";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@renderer/components/UI/display/Tooltip";
import { EmptyState } from "@renderer/components/UI/feedback/EmptyState";
import { ErrorMessage } from "@renderer/components/UI/feedback/ErrorMessage";
import VerifiedIcon from "@renderer/components/UI/icons/VerifiedIcon";
import { formatNumber } from "@renderer/utils/numberUtils";
import {
  useActiveGroupsTab,
  useSetActiveGroupsTab,
  useSelectedGroupId,
  useSetSelectedGroupId,
  useGroupsSearchQuery,
  useSetGroupsSearchQuery,
} from "./stores/useGroupsStore";
import { useSelectedIds } from "@renderer/stores/useSelectionStore";
import { useAccountsManager } from "@renderer/hooks/queries";
import { queryKeys } from "@shared/queryKeys";
import {
  type GroupMembership,
  type PendingGroupRequest,
} from "./api/useGroups";
import type { ChangeEvent } from "react";
import UniversalProfileModal from "@renderer/components/Modals/UniversalProfileModal";
import { GroupDetailsPanel } from "./components/GroupDetailsPanel";
import AccessoryDetailsModal from "@renderer/features/avatar/Modals/AccessoryDetailsModal";

interface GroupsTabProps {
  selectedAccount: Account | null;
}

interface GroupItemProps {
  group: {
    id: number;
    name: string;
    memberCount?: number;
    hasVerifiedBadge?: boolean;
  };
  role?: {
    name: string;
    rank: number;
  };
  thumbnail?: string;
  isSelected: boolean;
  isPending?: boolean;
  created?: string;
  selectedAccountsCount?: number;
  onClick: () => void;
}

const GroupItem = ({
  group,
  role,
  thumbnail,
  isSelected,
  isPending,
  selectedAccountsCount,
  onClick,
}: GroupItemProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.18 }}
      className="px-2 py-0.5"
    >
      <button
        onClick={onClick}
        className={[
          "relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 text-left group overflow-hidden",
          isSelected
            ? "bg-[rgba(var(--accent-color-rgb),0.12)] border border-[var(--accent-color-border)] shadow-sm"
            : "hover:bg-[var(--color-surface-hover)] border border-transparent",
        ].join(" ")}
      >
        {}
        {isSelected && (
          <span className="absolute left-0 top-3 bottom-3 w-[3px] rounded-r-full bg-[var(--accent-color)] shadow-[0_0_8px_var(--accent-color-glow)]" />
        )}

        {}
        <div className="relative shrink-0">
          <Avatar className="w-10 h-10 rounded-xl border border-[var(--color-border)] group-hover:border-[var(--color-border-strong)] transition-colors">
            <AvatarImage src={thumbnail} alt={group.name} />
            <AvatarFallback className="rounded-xl bg-[var(--color-surface-hover)] text-xs font-bold text-[var(--color-text-secondary)]">
              {group.name.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          {isPending && (
            <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-yellow-500/90 border-2 border-[var(--color-app-bg)] flex items-center justify-center">
              <Clock size={8} className="text-white" />
            </span>
          )}
        </div>

        {}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="font-semibold text-sm text-[var(--color-text-primary)] truncate leading-none">
              {group.name}
            </span>
            {group.hasVerifiedBadge && (
              <VerifiedIcon width={13} height={13} className="shrink-0" />
            )}
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {role && !isPending && (
              <span className="text-[10px] font-medium bg-[var(--color-surface-hover)] border border-[var(--color-border)] rounded-md px-1.5 py-0.5 text-[var(--color-text-muted)] truncate max-w-[100px]">
                {role.name}
              </span>
            )}
            {group.memberCount && (
              <span className="text-[10px] text-[var(--color-text-muted)] flex items-center gap-0.5">
                <Users size={9} />
                {formatNumber(group.memberCount)}
              </span>
            )}
            {selectedAccountsCount && selectedAccountsCount > 1 ? (
              <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-0.5">
                <User size={9} />
                {selectedAccountsCount}
              </span>
            ) : null}
          </div>
        </div>
      </button>
    </motion.div>
  );
};

const GroupsTab = ({ selectedAccount }: GroupsTabProps) => {
  const activeTab = useActiveGroupsTab();
  const setActiveTab = useSetActiveGroupsTab();
  const selectedGroupId = useSelectedGroupId();
  const setSelectedGroupId = useSetSelectedGroupId();
  const searchQuery = useGroupsSearchQuery();
  const setSearchQuery = useSetGroupsSearchQuery();

  const [profileUserId, setProfileUserId] = useState<number | null>(null);
  const [selectedStoreItem, setSelectedStoreItem] = useState<{
    id: number;
    name: string;
    imageUrl?: string;
  } | null>(null);

  const selectedIds = useSelectedIds();
  const { accounts } = useAccountsManager();
  const targetAccounts = useMemo(() => {
    if (selectedIds.size > 0) {
      return accounts.filter((a) => selectedIds.has(a.id) && a.cookie);
    }
    return selectedAccount && selectedAccount.cookie ? [selectedAccount] : [];
  }, [selectedAccount, selectedIds, accounts]);
  const [sidebarWidth, setSidebarWidth] = useState(320);
  const [isResizing, setIsResizing] = useState(false);
  const sidebarWidthRef = useRef(sidebarWidth);
  const MIN_SIDEBAR_WIDTH = 240;
  const MAX_SIDEBAR_WIDTH = 480;
  const sidebarRef = useRef<HTMLDivElement | null>(null);
  const resizeOriginRef = useRef(0);

  const clampWidth = (width: number) =>
    Math.min(Math.max(width, MIN_SIDEBAR_WIDTH), MAX_SIDEBAR_WIDTH);

  useEffect(() => {
    sidebarWidthRef.current = sidebarWidth;
  }, [sidebarWidth]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("groupsSidebarWidth");
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!Number.isNaN(parsed)) {
          setSidebarWidth(clampWidth(parsed));
        }
      }
    } catch (error) {
      console.error("Failed to load groups sidebar width", error);
    }
  }, []);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (event: MouseEvent) => {
      const newWidth = clampWidth(event.clientX - resizeOriginRef.current);
      setSidebarWidth(newWidth);
      sidebarWidthRef.current = newWidth;
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      try {
        window.localStorage.setItem(
          "groupsSidebarWidth",
          sidebarWidthRef.current.toString(),
        );
      } catch (error) {
        console.error("Failed to save groups sidebar width", error);
      }
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing]);

  const userId = selectedAccount?.userId
    ? parseInt(selectedAccount.userId, 10)
    : null;

  const joinedQueries = useQueries({
    queries: targetAccounts.map((acc) => ({
      queryKey: queryKeys.groups.userGroups(
        acc.userId ? parseInt(acc.userId) : 0,
      ),
      queryFn: async (): Promise<GroupMembership[]> => {
        const uid = acc.userId ? parseInt(acc.userId) : null;
        if (!uid) return [];
        const groups = await window.api.getUserGroupsFull(uid);
        if (groups.length === 0) return [];
        const groupIds = groups.map((g: any) => g.group.id);
        const thumbnails = await window.api.getGroupThumbnails(groupIds);
        return groups.map((g: any) => ({
          ...g,
          thumbnail: thumbnails[g.group.id] || "",
        }));
      },
      staleTime: 60 * 1000,
    })),
  });

  const pendingQueries = useQueries({
    queries: targetAccounts.map((acc) => ({
      queryKey: queryKeys.groups.pending(acc.id),
      queryFn: async (): Promise<PendingGroupRequest[]> => {
        if (!acc.cookie) return [];
        const pending = await window.api.getPendingGroupRequests(acc.cookie);
        if (pending.length === 0) return [];
        const groupIds = pending.map((g: any) => g.group.id);
        const thumbnails = await window.api.getGroupThumbnails(groupIds);
        return pending.map((g: any) => ({
          ...g,
          thumbnail: thumbnails[g.group.id] || "",
        }));
      },
      staleTime: 30 * 1000,
    })),
  });

  const joinedGroups = useMemo(() => {
    const all = joinedQueries.flatMap((q) => q.data || []);
    const unique = new Map<
      number,
      GroupMembership & { selectedAccountsCount?: number }
    >();
    const counts = new Map<number, number>();

    all.forEach((g) => {
      counts.set(g.group.id, (counts.get(g.group.id) || 0) + 1);
      if (!unique.has(g.group.id)) {
        unique.set(g.group.id, g);
      }
    });

    return Array.from(unique.values()).map((g) => ({
      ...g,
      selectedAccountsCount: counts.get(g.group.id),
    }));
  }, [joinedQueries]);

  const pendingGroups = useMemo(() => {
    const all = pendingQueries.flatMap((q) => q.data || []);
    const unique = new Map<
      number,
      PendingGroupRequest & { selectedAccountsCount?: number }
    >();
    const counts = new Map<number, number>();

    all.forEach((g) => {
      counts.set(g.group.id, (counts.get(g.group.id) || 0) + 1);
      if (!unique.has(g.group.id)) {
        unique.set(g.group.id, g);
      }
    });

    return Array.from(unique.values()).map((g) => ({
      ...g,
      selectedAccountsCount: counts.get(g.group.id),
    }));
  }, [pendingQueries]);

  const pendingAccountMap = useMemo(() => {
    const map = new Map<number, Account[]>();
    targetAccounts.forEach((acc, idx) => {
      const data = pendingQueries[idx]?.data || [];
      (data as PendingGroupRequest[]).forEach((p) => {
        const gId = p.group?.id;
        if (!gId) return;
        const arr = map.get(gId) || [];
        arr.push(acc);
        map.set(gId, arr);
      });
    });
    return map;
  }, [pendingQueries, targetAccounts]);

  const joinedLoading = joinedQueries.some((q) => q.isLoading);
  const pendingLoading = pendingQueries.some((q) => q.isLoading);
  const joinedFetching = joinedQueries.some((q) => q.isFetching);
  const pendingFetching = pendingQueries.some((q) => q.isFetching);
  const joinedError = joinedQueries.some((q) => q.error);
  const pendingError = pendingQueries.some((q) => q.error);

  const filteredJoinedGroups = useMemo(() => {
    if (!searchQuery.trim()) return joinedGroups;
    const query = searchQuery.toLowerCase();
    return joinedGroups.filter(
      (g: GroupMembership) =>
        g.group.name.toLowerCase().includes(query) ||
        g.role.name.toLowerCase().includes(query),
    );
  }, [joinedGroups, searchQuery]);

  const filteredPendingGroups = useMemo(() => {
    if (!searchQuery.trim()) return pendingGroups;
    const query = searchQuery.toLowerCase();
    return pendingGroups.filter((g: PendingGroupRequest) =>
      g.group.name.toLowerCase().includes(query),
    );
  }, [pendingGroups, searchQuery]);

  const displayGroups =
    activeTab === "joined" ? filteredJoinedGroups : filteredPendingGroups;
  const isLoading = activeTab === "joined" ? joinedLoading : pendingLoading;
  const isFetching = activeTab === "joined" ? joinedFetching : pendingFetching;
  const error = activeTab === "joined" ? joinedError : pendingError;

  const selectedGroupMembership = useMemo(() => {
    if (activeTab !== "joined" || !selectedGroupId) return null;
    return joinedGroups.find((g) => g.group.id === selectedGroupId);
  }, [activeTab, selectedGroupId, joinedGroups]);

  const handleRefresh = () => {
    if (activeTab === "joined") {
      joinedQueries.forEach((q) => q.refetch());
    } else {
      pendingQueries.forEach((q) => q.refetch());
    }
  };

  useEffect(() => {
    if (!isLoading && displayGroups.length > 0 && !selectedGroupId) {
      setSelectedGroupId(displayGroups[0].group.id);
    }
  }, [isLoading, displayGroups, selectedGroupId, setSelectedGroupId]);

  useEffect(() => {
    setSelectedGroupId(null);
    setSearchQuery("");
  }, [activeTab, setSelectedGroupId, setSearchQuery]);

  return (
    <TooltipProvider>
      <div
        className="flex flex-col h-full"
        style={{ background: "var(--color-app-bg)" }}
      >
        {}
        <div className="shrink-0 px-6 pt-5 pb-4 border-b border-[var(--color-border)] bg-[var(--color-surface-strong)]">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-[var(--color-text-primary)] leading-none">
                Groups
              </h1>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                {joinedGroups.length > 0
                  ? `${joinedGroups.length} joined`
                  : "Select an account to view groups"}
                {pendingGroups.length > 0 &&
                  ` · ${pendingGroups.length} pending`}
              </p>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleRefresh}
                  disabled={isLoading || isFetching || !selectedAccount}
                  className="h-10 w-10"
                >
                  <RefreshCw
                    size={15}
                    className={isLoading || isFetching ? "animate-spin" : ""}
                  />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Refresh Groups</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {}
        {targetAccounts.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <EmptyState
              icon={Users}
              title="No Accounts Selected"
              description="Select one or more accounts to view their groups."
            />
          </div>
        ) : (
          <div className="flex-1 flex min-h-0">
            {}
            <div
              ref={sidebarRef}
              className={`relative flex flex-col shrink-0 border-r border-[var(--color-border)] ${!isResizing ? "transition-[width] duration-150 ease-in-out" : ""}`}
              style={{
                width: `${sidebarWidth}px`,
                background: "var(--color-surface)",
              }}
            >
              {}
              <div className="flex items-center gap-1.5 px-3 py-3 border-b border-[var(--color-border)]">
                {[
                  {
                    id: "joined",
                    label: "Joined",
                    count: filteredJoinedGroups.length,
                  },
                  {
                    id: "pending",
                    label: "Pending",
                    count: filteredPendingGroups.length,
                  },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as "joined" | "pending")}
                    className={[
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200",
                      activeTab === tab.id
                        ? "bg-[var(--accent-color)] text-[var(--accent-color-foreground)] shadow-sm"
                        : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)]",
                    ].join(" ")}
                  >
                    {tab.label}
                    {tab.count > 0 && (
                      <span
                        className={[
                          "px-1.5 py-0.5 rounded-md text-[10px] font-bold",
                          activeTab === tab.id
                            ? "bg-[var(--accent-color-foreground)]/20 text-[var(--accent-color-foreground)]"
                            : "bg-[var(--color-surface-hover)] text-[var(--color-text-muted)]",
                        ].join(" ")}
                      >
                        {tab.count}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {}
              <div className="px-3 py-2 border-b border-[var(--color-border)]">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search
                      size={13}
                      className="text-[var(--color-text-muted)]"
                    />
                  </div>
                  <Input
                    type="text"
                    placeholder="Search groups…"
                    value={searchQuery}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      setSearchQuery(e.target.value)
                    }
                    className="pl-8 h-10 text-xs rounded-lg"
                  />
                </div>
              </div>

              {}
              <div className="flex-1 overflow-hidden py-1.5">
                <AnimatePresence mode="wait">
                  {isLoading ? (
                    <div className="space-y-0.5 px-2 py-1">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <div
                          key={i}
                          className="flex items-center gap-3 px-3 py-2.5"
                        >
                          <div className="w-10 h-10 rounded-xl bg-[var(--color-surface-hover)] animate-pulse" />
                          <div className="flex-1 space-y-1.5">
                            <div className="h-3.5 w-28 bg-[var(--color-surface-hover)] rounded-md animate-pulse" />
                            <div className="h-2.5 w-16 bg-[var(--color-surface-hover)] rounded-md animate-pulse" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : error ? (
                    <div className="p-4">
                      <ErrorMessage
                        message="There was an error communicating with Roblox."
                        onRetry={handleRefresh}
                      />
                    </div>
                  ) : displayGroups.length === 0 ? (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex flex-col items-center justify-center h-full text-center p-6"
                    >
                      <div className="w-12 h-12 rounded-2xl bg-[var(--color-surface-hover)] border border-[var(--color-border)] flex items-center justify-center mb-3">
                        <Users
                          size={20}
                          className="text-[var(--color-text-muted)]"
                        />
                      </div>
                      <p className="text-sm font-medium text-[var(--color-text-secondary)]">
                        {searchQuery
                          ? "No matches"
                          : activeTab === "joined"
                            ? "No groups joined"
                            : "No pending requests"}
                      </p>
                      <p className="text-xs text-[var(--color-text-muted)] mt-1">
                        {searchQuery ? "Try a different search term" : ""}
                      </p>
                    </motion.div>
                  ) : (
                    <Virtuoso
                      data={
                        displayGroups as (
                          | GroupMembership
                          | PendingGroupRequest
                        )[]
                      }
                      overscan={200}
                      itemContent={(_index, item) => {
                        if (activeTab === "joined") {
                          const joinedItem = item as GroupMembership & {
                            selectedAccountsCount?: number;
                          };
                          return (
                            <GroupItem
                              key={joinedItem.group.id}
                              group={joinedItem.group}
                              role={joinedItem.role}
                              thumbnail={joinedItem.thumbnail}
                              isSelected={
                                selectedGroupId === joinedItem.group.id
                              }
                              selectedAccountsCount={
                                joinedItem.selectedAccountsCount
                              }
                              onClick={() =>
                                setSelectedGroupId(joinedItem.group.id)
                              }
                            />
                          );
                        } else {
                          const pendingItem = item as PendingGroupRequest & {
                            selectedAccountsCount?: number;
                          };
                          return (
                            <GroupItem
                              key={pendingItem.group.id}
                              group={pendingItem.group}
                              thumbnail={pendingItem.thumbnail}
                              isSelected={
                                selectedGroupId === pendingItem.group.id
                              }
                              isPending
                              created={pendingItem.created}
                              selectedAccountsCount={
                                pendingItem.selectedAccountsCount
                              }
                              onClick={() =>
                                setSelectedGroupId(pendingItem.group.id)
                              }
                            />
                          );
                        }
                      }}
                    />
                  )}
                </AnimatePresence>
              </div>

              {}
              <div
                className="absolute top-0 right-0 h-full cursor-col-resize z-20"
                style={{
                  right: "-2px",
                  width: "4px",
                  background: isResizing
                    ? "rgba(var(--accent-color-rgb),0.4)"
                    : "transparent",
                }}
                onMouseDown={() => {
                  const left =
                    sidebarRef.current?.getBoundingClientRect().left ?? 0;
                  resizeOriginRef.current = left;
                  setIsResizing(true);
                }}
              >
                <div className="absolute inset-0 hover:bg-[var(--accent-color)]/20 transition-colors" />
              </div>
            </div>

            {}
            <GroupDetailsPanel
              groupId={selectedGroupId}
              selectedAccount={selectedAccount}
              pendingAccounts={
                selectedGroupId !== null
                  ? (pendingAccountMap.get(selectedGroupId) ?? [])
                  : []
              }
              isPending={activeTab === "pending"}
              userRole={selectedGroupMembership?.role}
              onViewProfile={(userId) => setProfileUserId(userId)}
              onStoreItemSelect={(item) => setSelectedStoreItem(item)}
            />
          </div>
        )}
      </div>

      <UniversalProfileModal
        isOpen={!!profileUserId}
        onClose={() => setProfileUserId(null)}
        userId={profileUserId}
        selectedAccount={selectedAccount}
        initialData={null}
      />

      <AccessoryDetailsModal
        isOpen={!!selectedStoreItem}
        onClose={() => setSelectedStoreItem(null)}
        assetId={selectedStoreItem?.id || null}
        account={selectedAccount}
        initialData={
          selectedStoreItem
            ? {
                name: selectedStoreItem.name,
                imageUrl: selectedStoreItem.imageUrl || "",
              }
            : undefined
        }
      />
    </TooltipProvider>
  );
};

export default GroupsTab;
