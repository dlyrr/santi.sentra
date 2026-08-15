import React from 'react';
import { Button } from '@renderer/components/UI/buttons/Button';
import { SearchInput } from '@renderer/components/UI/inputs/SearchInput';
import CustomDropdown, { DropdownOption } from '@renderer/components/UI/menus/CustomDropdown';
import { Play, Grid3X3, Grid2X2, Search, X, ArrowUpDown, ArrowDownUp } from 'lucide-react';
import { cn } from '@renderer/lib/utils';
import { Tooltip, TooltipTrigger, TooltipContent } from '@renderer/components/UI/display/Tooltip';

interface CatalogToolbarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  sortType: string;
  setSortType: (value: string) => void;
  viewMode: 'default' | 'compact';
  setViewMode: (value: 'default' | 'compact') => void;
  isBulkMode: boolean;
  appliedMinPrice?: number | undefined;
  appliedMaxPrice?: number | undefined;
  appliedCreatorName?: string | undefined;
  hasActiveFilters: boolean;
}

export const CatalogToolbar: React.FC<CatalogToolbarProps> = ({
  searchQuery,
  onSearchChange,
  sortType,
  setSortType,
  viewMode,
  setViewMode,
  isBulkMode,
  appliedMinPrice,
  appliedMaxPrice,
  appliedCreatorName,
  hasActiveFilters,
}) => {
  const SORT_OPTIONS: DropdownOption[] = [
    { value: '0', label: 'Relevance', icon: <ArrowUpDown size={12} /> },
    { value: '1', label: 'Most Favorited', icon: <ArrowDownUp size={12} /> },
    { value: '2', label: 'Bestselling', icon: <Play size={12} /> },
    { value: '3', label: 'Recently Published', icon: <ArrowUpDown size={12} /> },
    { value: '4', label: 'Price (High to Low)', icon: <ArrowDownUp size={12} /> },
    { value: '5', label: 'Price (Low to High)', icon: <ArrowUpDown size={12} /> },
  ];

  return (
    <div className="shrink-0 h-[72px] bg-[var(--color-surface-strong)] border-b border-[var(--color-border)] z-20 flex items-center justify-between px-6">
      <div className="flex items-center gap-4 flex-1">
        <h1 className="text-xl font-bold text-[var(--color-text-primary)] flex items-center gap-2">
          Catalog
          {isBulkMode && (
            <span className="bg-blue-600/20 text-blue-400 text-xs px-2 py-1 rounded-md border border-blue-500/30 font-medium uppercase tracking-wider">
              Bulk Mode
            </span>
          )}
        </h1>
      </div>

      <div className="flex items-center gap-3 flex-1 justify-end min-w-0">
        {/* Search */}
        <div className="relative w-[200px]">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search size={16} className="text-[var(--color-text-muted)]" />
          </div>
          <SearchInput
            value={searchQuery}
            onChange={onSearchChange}
            placeholder="Search catalog…"
            containerClassName="w-full"
            className="h-10 text-base bg-[var(--color-surface)] border-[var(--color-border)] focus:border-[var(--accent-color-border)] focus:ring-1 focus:ring-[var(--accent-color-ring)] transition-all placeholder:text-[var(--color-text-muted)]"
          />
        </div>

        {/* Sort dropdown */}
        <CustomDropdown
          options={SORT_OPTIONS}
          value={sortType}
          onChange={setSortType}
          placeholder="Sort By"
          className="w-44"
        />

        {/* View mode toggle */}
        <div className="flex items-center gap-2 rounded-lg p-1 border border-[var(--color-border)]">
          <button
            onClick={() => setViewMode('default')}
            aria-label="Toggle default view"
            className={`p-1.5 rounded transition-all focus-visible:ring-2 focus-visible:ring-[var(--accent-color-ring)] ${viewMode === 'default' ? 'bg-[var(--color-surface-hover)] text-[var(--color-text-primary)] shadow-sm' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'}`}
            title="Default View"
          >
            <Grid2X2 size={16} />
          </button>
          <button
            onClick={() => setViewMode('compact')}
            aria-label="Toggle compact view"
            className={`p-1.5 rounded transition-all focus-visible:ring-2 focus-visible:ring-[var(--accent-color-ring)] ${viewMode === 'compact' ? 'bg-[var(--color-surface-hover)] text-[var(--color-text-primary)] shadow-sm' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'}`}
            title="Compact View"
          >
            <Grid3X3 size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default CatalogToolbar;