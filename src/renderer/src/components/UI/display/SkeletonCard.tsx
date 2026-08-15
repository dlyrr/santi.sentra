import React from "react";
import Skeleton from "./Skeleton";
import { cn } from "../../../lib/utils";

// ============================================================================
// SkeletonCard - Reusable skeleton card for loading states
// ============================================================================

interface SkeletonCardProps {
  className?: string;
}

/**
 * Friend/User card skeleton - circular avatar with name/status lines
 */
export const SkeletonUserCard: React.FC<
  SkeletonCardProps & {
    variant?: "horizontal" | "vertical";
    showBorder?: boolean;
  }
> = ({ className, variant = "horizontal", showBorder = true }) => {
  if (variant === "vertical") {
    return (
      <div
        className={cn(
          "w-28 flex flex-col items-center gap-2 shrink-0",
          className,
        )}
      >
        <Skeleton className="w-24 h-24 rounded-full" />
        <div className="w-full flex flex-col items-center gap-1">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-3 w-12" />
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center gap-3 p-2 rounded-lg",
        showBorder &&
          "p-4 bg-[var(--color-surface)]/50 border border-[var(--color-border)] rounded-xl",
        className,
      )}
    >
      <Skeleton className="w-10 h-10 rounded-full shrink-0" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-20" />
      </div>
    </div>
  );
};

/**
 * Friend card skeleton with larger avatar (used in FriendsTab grid)
 */
export const SkeletonFriendCard: React.FC<SkeletonCardProps> = ({
  className,
}) => (
  <div
    className={cn(
      "flex items-center p-4 bg-[var(--color-surface)]/50 border border-[var(--color-border)] rounded-xl",
      className,
    )}
  >
    <Skeleton className="w-12 h-12 rounded-full mr-4 shrink-0" />
    <div className="flex-1 space-y-2">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-3 w-24" />
    </div>
  </div>
);

/**
 * Game card skeleton - thumbnail with overlay text and footer stats
 */
export const SkeletonGameCard: React.FC<SkeletonCardProps> = ({
  className,
}) => (
  <div
    className={cn(
      "bg-[var(--color-surface)]/50 border border-[var(--color-border)] rounded-xl overflow-hidden",
      className,
    )}
  >
    <div className="aspect-square w-full relative bg-[var(--color-surface-hover)]">
      <Skeleton className="w-full h-full opacity-20" />
      <div className="absolute bottom-3 left-3 right-3 space-y-2">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
    <div className="p-3 flex items-center justify-between border-t border-[var(--color-border)]">
      <Skeleton className="h-4 w-12" />
      <Skeleton className="h-4 w-12" />
    </div>
  </div>
);

/**
 * Simple square card skeleton - for outfits, badges, collections
 */
export const SkeletonSquareCard: React.FC<
  SkeletonCardProps & {
    showBorder?: boolean;
  }
> = ({ className, showBorder = true }) => (
  <div
    className={cn(
      "aspect-square bg-[var(--color-surface)] rounded-xl overflow-hidden",
      showBorder && "border border-[var(--color-border)]",
      className,
    )}
  >
    <Skeleton className="w-full h-full opacity-20" />
  </div>
);

/**
 * Group card skeleton - square with name and member count
 */
export const SkeletonGroupCard: React.FC<SkeletonCardProps> = ({
  className,
}) => (
  <div
    className={cn("w-28 flex flex-col items-center gap-2 shrink-0", className)}
  >
    <Skeleton className="w-24 h-24 rounded-xl" />
    <div className="w-full flex flex-col items-center gap-1">
      <Skeleton className="h-4 w-20" />
      <Skeleton className="h-3 w-12" />
    </div>
  </div>
);

/**
 * Inventory item skeleton - square with padding
 */
export const SkeletonInventoryCard: React.FC<SkeletonCardProps> = ({
  className,
}) => (
  <div
    className={cn(
      "aspect-square bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl overflow-hidden",
      className,
    )}
  >
    <div className="w-full h-full p-4 flex items-center justify-center">
      <Skeleton className="w-full h-full opacity-20" />
    </div>
  </div>
);

export default {
  SkeletonUserCard,
  SkeletonFriendCard,
  SkeletonGameCard,
  SkeletonSquareCard,
  SkeletonGroupCard,
  SkeletonInventoryCard,
};
