import React from 'react';
import { Button } from '@renderer/components/UI/buttons/Button';
import { SearchInput } from '@renderer/components/UI/inputs/SearchInput';
import CustomDropdown, { DropdownOption } from '@renderer/components/UI/menus/CustomDropdown';
import { RefreshCw } from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent } from '@renderer/components/UI/display/Tooltip';

interface GroupsToolbarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  filteredGroupsCount: number;
  onRefresh: () => void;
  isLoading: boolean;
  isFetching: boolean;
}

const filterOptions: DropdownOption[] = [
  { value: 'All', label: 'All Groups' },
];

export const GroupsToolbar: React.FC<GroupsToolbarProps> = ({
  searchQuery,
  onSearchChange,
  filteredGroupsCount,
  onRefresh,
  isLoading,
  isFetching,
}) => {
  return (
    <div className="shrink-0 h-[72px] bg-[var(--color-surface-strong)] border-b border-[var(--color-border)] z-20 flex items-center justify-between px-6">
      <div className="flex items-center gap-4 shrink-0">
        <h1 className="text-xl font-bold text-[var(--color-text-primary)] leading-none">Groups</h1>
        <span className="flex items-center justify-center px-2.5 py-0.5 rounded-md bg-[var(--color-surface-muted)] border border-[var(--color-border)] text-xs font-semibold text-[var(--color-text-muted)]">
          {filteredGroupsCount}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative w-48 lg:w-64">
          <SearchInput
            value={searchQuery}
            onChange={onSearchChange}
            placeholder="Search groups…"
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
              className="h-9 w-9"
            >
              <RefreshCw size={18} className={isLoading || isFetching ? 'animate-spin' : ''} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Refresh Groups</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
};

export default GroupsToolbar;
