import React from 'react';
import { Button } from '@renderer/components/UI/buttons/Button';
import { SearchInput } from '@renderer/components/UI/inputs/SearchInput';
import CustomDropdown, { DropdownOption } from '@renderer/components/UI/menus/CustomDropdown';
import { Tooltip, TooltipTrigger, TooltipContent } from '@renderer/components/UI/display/Tooltip';
import { AnimatePresence, motion } from 'framer-motion';
import { RefreshCw, Play, SlidersHorizontal, ChevronDown, Check, X, Search } from 'lucide-react';
import { cn } from '@renderer/lib/utils';

interface SortOption {
  token: string;
  name: string;
}

interface GamesToolbarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  selectedGameCount: number;
  isSearchMode: boolean;
  onLaunch: () => void;
  sortOptions?: SortOption[];
  selectedSortId?: string | null;
  onSortChange?: (value: string) => void;
  filterOpen?: boolean;
  onToggleFilter?: () => void;
}

export const GamesToolbar: React.FC<GamesToolbarProps> = ({
  searchQuery,
  onSearchChange,
  selectedGameCount,
  isSearchMode,
  onLaunch,
  sortOptions = [],
  selectedSortId,
  onSortChange,
  filterOpen,
  onToggleFilter,
}) => {
  const [localFilterOpen, setLocalFilterOpen] = React.useState(false);
  const isFilterOpen = filterOpen ?? localFilterOpen;
  const toggleFilter = onToggleFilter ?? (() => setLocalFilterOpen(!localFilterOpen));

  const sortDropdownOptions: DropdownOption[] = sortOptions.length > 0
    ? sortOptions.map(opt => ({
        value: opt.token,
        label: opt.name.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]/gu, '').trim()
      }))
    : [
    { value: 'recommended', label: 'Recommended' },
    { value: 'popular', label: 'Popular' },
    { value: 'trending', label: 'Trending' },
  ];

  const handleSortChange = (value: string) => {
    onSortChange?.(value);
    if (filterOpen !== undefined || onToggleFilter !== undefined) {
      setLocalFilterOpen(false);
    }
  };

  const currentSortLabel = sortDropdownOptions.find(o => o.value === selectedSortId)?.label || sortDropdownOptions[0]?.label;

  return (
    <div className="shrink-0 h-[72px] bg-[var(--color-surface-strong)] border-b border-[var(--color-border)] z-20 flex items-center justify-between px-6">
      <div className="flex items-center gap-4 shrink-0">
        <h1 className="text-xl font-bold text-[var(--color-text-primary)] leading-none">Games</h1>
      </div>

      <div className="flex items-center gap-3 flex-1 justify-end min-w-0">
        {/* Launch button */}
        {selectedGameCount > 0 && (
          <Button
            variant="default"
            size="default"
            onClick={onLaunch}
            className="gap-2 h-9 px-3 shrink-0 bg-[rgba(var(--accent-color-rgb),0.95)] hover:bg-[var(--accent-color-muted)] text-[var(--accent-color-foreground)] border-[var(--accent-color-border)] rounded-md"
          >
            <Play size={15} fill="currentColor" />
            Launch {selectedGameCount}
          </Button>
        )}

        {/* Search */}
        <div className="relative w-[200px]">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search size={16} className="text-[var(--color-text-muted)]" />
          </div>
          <SearchInput
            value={searchQuery}
            onChange={onSearchChange}
            placeholder="Search games…"
            containerClassName="w-full"
            className="h-10 text-base bg-[var(--color-surface)] border-[var(--color-border)] focus:border-[var(--accent-color-border)] focus:ring-1 focus:ring-[var(--accent-color-ring)] transition-all placeholder:text-[var(--color-text-muted)]"
          />
        </div>

        {/* Sort dropdown with categories */}
        <div className="relative shrink-0">
          <Button
            variant="outline"
            className={cn(
              "gap-2 border-[var(--color-border)] shadow-sm transition-all",
              isFilterOpen
                ? "bg-[rgba(var(--accent-color-rgb),0.1)] border-[rgba(var(--accent-color-rgb),0.3)] text-[var(--accent-color)]"
                : "bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)]"
            )}
            onClick={toggleFilter}
          >
            <SlidersHorizontal size={14} className={selectedSortId ? "text-[var(--accent-color)]" : "text-[var(--color-text-secondary)]"} />
            <span className="font-semibold text-sm">
              {currentSortLabel || "Sort"}
            </span>
            <ChevronDown size={14} className={cn("text-[var(--color-text-muted)] transition-transform duration-200", isFilterOpen && "rotate-180")} />
          </Button>

          <AnimatePresence>
            {isFilterOpen && sortOptions.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="absolute right-0 top-full mt-3 w-[240px] bg-[var(--color-surface)]/95 backdrop-blur-xl border border-[var(--color-border)] rounded-xl shadow-[0_15px_50px_-10px_rgba(0,0,0.4)] z-50 overflow-hidden ring-1 ring-[var(--accent-color-ring)]"
              >
                <div className="p-3 border-b border-[var(--color-border)]/50 flex items-center justify-between bg-gradient-to-br from-[var(--color-surface-hover)]/30 to-transparent">
                  <div>
                    <h3 className="text-base font-bold text-[var(--color-text-primary)] leading-none mb-1">Sort Categories</h3>
                    <p className="text-sm text-[var(--color-text-muted)]">Select a sort method</p>
                  </div>
                  <button
                    onClick={() => {
                      toggleFilter();
                      if (filterOpen !== undefined) setLocalFilterOpen(false);
                    }}
                    className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] p-2 rounded-lg hover:bg-[var(--color-surface-strong)] transition-colors border border-transparent hover:border-[var(--color-border)]"
                  >
                    <X size={18} />
                  </button>
                </div>
                <div className="p-2 max-h-[400px] overflow-y-auto scrollbar-thin">
                  {sortDropdownOptions.map((opt, index) => {
                    const isSelected = selectedSortId === opt.value;
                    return (
                      <button
                        key={opt.value}
                        onClick={() => {
                          handleSortChange(opt.value);
                          toggleFilter();
                        }}
                        className={cn(
                          "flex items-center gap-3 px-3 py-3 rounded-lg text-left transition-all duration-200 w-full",
                          isSelected
                            ? "bg-[var(--accent-color)]/10 border border-[var(--accent-color)]/20 text-[var(--color-text-primary)]"
                            : "hover:bg-[var(--color-surface-hover)] border border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                        )}
                      >
                        <div className={cn(
                          "w-2 h-2 rounded-full transition-all duration-300 flex-shrink-0",
                          isSelected ? "bg-[var(--accent-color)] shadow-[0_0_10px_var(--accent-color)]" : "bg-[var(--color-border-strong)]"
                        )} />
                        <span className={cn("text-base break-words flex-1 min-w-0", isSelected ? "font-semibold" : "font-medium")}>{opt.label}</span>
                        {isSelected && <Check size={18} className="shrink-0 text-[var(--accent-color)]" />}
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default GamesToolbar;