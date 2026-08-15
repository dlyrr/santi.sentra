import React from 'react';
import { Button } from '@renderer/components/UI/buttons/Button';
import { SearchInput } from '@renderer/components/UI/inputs/SearchInput';
import { cn } from '@renderer/lib/utils';
import { Calendar, ChevronDown, RefreshCw, Search } from 'lucide-react';
import type { TransactionTimeFrame, TransactionTypeEnum } from '@shared/ipc-schemas/transactions';

interface TransactionSortOption {
  value: string;
  label: string;
}

interface TransactionsToolbarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  timeFrame: TransactionTimeFrame;
  onTimeFrameChange: (value: TransactionTimeFrame) => void;
  selectedType: TransactionTypeEnum | 'all';
  onTransactionTypeChange: (value: TransactionTypeEnum | 'all') => void;
  totalCount?: number;
  isLoading?: boolean;
  transactionTypeLabels: Record<TransactionTypeEnum | 'all', string>;
  onRefresh: () => void;
}

const TIME_FRAME_OPTIONS: TransactionSortOption[] = [
  { value: 'Day', label: 'Today' },
  { value: 'Week', label: 'This Week' },
  { value: 'Month', label: 'This Month' },
  { value: 'Year', label: 'This Year' },
];

export const TransactionsToolbar: React.FC<TransactionsToolbarProps> = ({
  searchQuery,
  onSearchChange,
  timeFrame,
  onTimeFrameChange,
  selectedType,
  onTransactionTypeChange,
  totalCount,
  isLoading,
  transactionTypeLabels,
  onRefresh,
}) => {
  const TRANSACTION_TYPE_OPTIONS: TransactionSortOption[] = [
    { value: 'all', label: 'All Transactions' },
    { value: 'Purchase', label: 'Purchases' },
    { value: 'Sale', label: 'Sales' },
    { value: 'TradeRobux', label: 'Trade Robux' },
    { value: 'PremiumStipend', label: 'Premium Stipends' },
    { value: 'AdSpend', label: 'Ad Spend' },
    { value: 'DevEx', label: 'DevEx' },
  ];

  return (
    <div className="shrink-0 h-[72px] bg-[var(--color-surface-strong)] border-b border-[var(--color-border)] z-20 flex items-center justify-between px-6">
      <div className="flex items-center gap-4 shrink-0">
        <h1 className="text-xl font-bold text-[var(--color-text-primary)] leading-none">
          Transactions
        </h1>
        <ArrowRightLeft size={22} className="text-[var(--color-text-secondary)]" />
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
            placeholder="Search transactions…"
            containerClassName="w-full"
            className="h-10 text-base bg-[var(--color-surface)] border-[var(--color-border)] focus:border-[var(--accent-color-border)] focus:ring-1 focus:ring-[var(--accent-color-ring)] transition-all placeholder:text-[var(--color-text-muted)]"
          />
        </div>

        {/* Time Frame Dropdown */}
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              // The actual dropdown logic will be handled by the parent component
              // This is just a placeholder button for styling consistency
            }}
            className={cn(
              "flex items-center gap-2 px-3 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:border-[var(--color-border-strong)] transition-colors",
              timeFrame === 'Day'
                ? "bg-[rgba(var(--accent-color-rgb),0.1)] border-[rgba(var(--accent-color-rgb),0.3)] text-[var(--accent-color)]"
                : ""
            )}
            aria-label="Select time frame"
          >
            <Calendar size={14} className="text-[var(--color-text-muted)]" />
            <span className="font-medium text-sm">
              {timeFrame || 'This Month'}
            </span>
            <ChevronDown size={12} className="text-[var(--color-text-muted)] transition-transform" />
          </button>
        </div>

        {/* Transaction Type Dropdown */}
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              // The actual dropdown logic will be handled by the parent component
              // This is just a placeholder button for styling consistency
            }}
            className={cn(
              "flex items-center gap-2 px-3 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:border-[var(--color-border-strong)] transition-colors min-w-[140px]",
              selectedType === 'all'
                ? "bg-[rgba(var(--accent-color-rgb),0.1)] border-[rgba(var(--accent-color-rgb),0.3)] text-[var(--accent-color)]"
                : ""
            )}
            aria-label="Select transaction type"
          >
            <span className="flex-1 text-left">{transactionTypeLabels[selectedType] || 'All'}</span>
            <ChevronDown size={12} className="text-[var(--color-text-muted)] transition-transform" />
          </button>
        </div>

        {/* Summary stats and refresh */}
        <div className="flex items-center gap-2">
          {totalCount !== undefined && !isLoading && (
            <span className="text-sm text-[var(--color-text-muted)]">
              {totalCount > 0 ? `${totalCount} ` : ''}transactions
            </span>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={onRefresh}
            className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
          >
            <RefreshCw size={16} />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default TransactionsToolbar;

// Icon component for TransactionsToolbar
const ArrowRightLeft = ({ size, className }: { size?: number; className?: string }) => (
  <svg
    width={size || 22}
    height={size || 22}
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v4" />
    <polygon points="9 9 12 12 9 15" />
    <path d="M15 9l3-3v4" />
    <path d="M15 15v4" />
    <path d="M21 15h-4" />
  </svg>
);