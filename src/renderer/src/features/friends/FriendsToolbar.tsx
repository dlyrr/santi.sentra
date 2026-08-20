import { useMemo } from "react";
import { Button } from "@renderer/components/UI/buttons/Button";
import CustomDropdown, {
  DropdownOption,
} from "@renderer/components/UI/menus/CustomDropdown";
import { Search, UserPlus, Users, RefreshCw, Grid, List } from "lucide-react";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@renderer/components/UI/display/Tooltip";
import { SearchInput } from "@renderer/components/UI/inputs/SearchInput";
import { AccountStatus } from "@renderer/types";

interface FriendsToolbarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  filteredFriendsCount: number;
  selectedCount: number;
  viewMode: "list" | "grid";
  onViewModeToggle: () => void;
  statusFilter: "All" | "Favorites" | "Online" | "InGame";
  onStatusFilterChange: (
    status: "All" | "Favorites" | "Online" | "InGame",
  ) => void;
  onAddFriend: () => void;
  onFriendRequests: () => void;
  onRefresh: () => void;
  isLoading: boolean;
  isFetching: boolean;
}

const statusOptions: DropdownOption[] = [
  { value: "All", label: "All Friends" },
  { value: "Favorites", label: "Favorites" },
  { value: "Online", label: "Online" },
  { value: "InGame", label: "In Game" },
];

export const FriendsToolbar = ({
  searchQuery,
  onSearchChange,
  filteredFriendsCount,
  selectedCount,
  viewMode,
  onViewModeToggle,
  statusFilter,
  onStatusFilterChange,
  onAddFriend,
  onFriendRequests,
  onRefresh,
  isLoading,
  isFetching,
}: FriendsToolbarProps) => {
  return (
    <div className="shrink-0 h-[64px] bg-[var(--color-surface)] border-b border-[var(--color-border)] flex items-center justify-between px-6 gap-4 z-20">
      <div className="flex items-center gap-4 shrink-0">
        <h1 className="text-lg font-bold text-[var(--color-text-primary)] leading-none tracking-tight">
          Friends
        </h1>
        <div className="w-px h-4 bg-[var(--color-border)]" />
        <span className="flex items-center justify-center px-2 py-0.5 rounded-md bg-[var(--color-surface-muted)] border border-[var(--color-border)] text-[11px] font-semibold text-[var(--color-text-muted)]">
          {selectedCount > 0 ? selectedCount : filteredFriendsCount}
        </span>
      </div>

      <div className="flex items-center gap-2 shrink-0 flex-1 justify-end min-w-0">
        <Button
          variant="default"
          onClick={onAddFriend}
          className="gap-2 h-9 px-3 shrink-0"
        >
          <UserPlus size={16} />
          <span className="text-sm font-semibold">Add Friend</span>
        </Button>
        <Button
          variant="secondary"
          onClick={onFriendRequests}
          className="gap-2 h-9 px-3 shrink-0"
        >
          <Users size={16} />
          <span className="text-sm">Requests</span>
        </Button>
        <CustomDropdown
          options={statusOptions}
          value={statusFilter}
          onChange={(v) => onStatusFilterChange(v as any)}
          className="w-36 shrink-0"
        />
        <div className="relative flex-1 max-w-xs">
          <SearchInput
            value={searchQuery}
            onChange={onSearchChange}
            placeholder="Search friends…"
            containerClassName="w-full"
            className="h-9 text-sm bg-[var(--color-surface)] border-[var(--color-border)] focus:border-[var(--accent-color-border)] focus:ring-1 focus:ring-[var(--accent-color-ring)] transition-all placeholder:text-[var(--color-text-muted)]"
          />
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={onRefresh}
              disabled={isLoading || isFetching}
              className="h-9 w-9 shrink-0"
            >
              <RefreshCw
                size={18}
                className={isLoading || isFetching ? "animate-spin" : ""}
              />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Refresh Friends</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={onViewModeToggle}
              className="h-9 w-9 shrink-0"
            >
              {viewMode === "list" ? <Grid size={17} /> : <List size={17} />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {viewMode === "list"
              ? "Switch to Grid View"
              : "Switch to List View"}
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
};

export default FriendsToolbar;
