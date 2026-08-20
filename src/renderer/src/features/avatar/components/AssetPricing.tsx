import React, { useMemo, useState, useRef } from "react";
import {
  ShoppingCart,
  Check,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
} from "lucide-react";
import { cn } from "@renderer/lib/utils";
import { Button } from "@renderer/components/UI/buttons/Button";
import { RobuxIcon } from "@renderer/components/UI/icons/RobuxIcon";
import { AssetDetails } from "@shared/ipc-schemas/avatar";
import {
  Dialog,
  DialogContent,
  DialogBody,
} from "@renderer/components/UI/dialogs/Dialog";
import { useAccountsManager } from "@renderer/hooks/queries";
import { useSelectedIds } from "@renderer/stores/useSelectionStore";
import { Account } from "@renderer/types";
import {
  catalogPurchaseLimiter,
  executeWithRetry,
  isRateLimitError,
  sleep,
} from "@renderer/lib/rateLimiter";

type PurchaseTargetAccount = Pick<Account, "id" | "userId" | "username"> & {
  cookie: string;
};

const PurchaseConfirmDialog: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  assetName: string;
  price: number | string;
  userBalance?: number | null;
  accountCount?: number;
}> = ({
  isOpen,
  onClose,
  onConfirm,
  assetName,
  price,
  userBalance,
  accountCount = 1,
}) => {
  const numericPrice = typeof price === "number" ? price : 0;
  const hasBalance = userBalance != null;
  const remainingBalance = hasBalance ? userBalance! - numericPrice : null;
  const canAfford = hasBalance ? remainingBalance! >= 0 : true;
  const isBulkPurchase = accountCount > 1;

  return (
    <Dialog isOpen={isOpen} onClose={onClose}>
      <DialogContent className="max-w-sm">
        <DialogBody className="flex flex-col items-center text-center py-6">
          <div className="w-14 h-14 bg-emerald-500/10 rounded-full flex items-center justify-center mb-4">
            <ShoppingCart className="w-7 h-7 text-emerald-500" />
          </div>
          <h2 className="text-xl font-bold text-[var(--color-text-primary)] mb-3">
            Confirm Purchase
          </h2>
          <p className="text-[var(--color-text-secondary)] text-sm leading-relaxed mb-6">
            Are you sure you want to buy{" "}
            <span className="font-semibold text-[var(--color-text-primary)]">
              &quot;{assetName}&quot;
            </span>{" "}
            for{" "}
            <span className="inline-flex items-center gap-1 font-semibold text-emerald-400">
              {typeof price === "number" ? price.toLocaleString() : price}
              {typeof price === "number" && <RobuxIcon className="w-4 h-4" />}
            </span>
            ?
          </p>
          {isBulkPurchase && (
            <div className="w-full bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 mb-6 text-sm text-blue-100">
              Purchasing for {accountCount} selected accounts. Accounts that
              already own it are skipped.
            </div>
          )}
          {hasBalance && typeof price === "number" && (
            <div className="w-full bg-[var(--color-surface-hover)]/50 rounded-lg p-3 mb-6 text-sm">
              <div className="flex justify-between items-center mb-2">
                <span className="text-[var(--color-text-secondary)]">
                  Current Balance
                </span>
                <span className="flex items-center gap-1 text-[var(--color-text-primary)] font-medium">
                  {userBalance!.toLocaleString()}
                  <RobuxIcon className="w-3 h-3" />
                </span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-[var(--color-border-strong)]">
                <span className="text-[var(--color-text-secondary)]">
                  After Purchase
                </span>
                <span
                  className={cn(
                    "flex items-center gap-1 font-medium",
                    remainingBalance! < 0 ? "text-red-400" : "text-emerald-400",
                  )}
                >
                  {remainingBalance!.toLocaleString()}
                  <RobuxIcon className="w-3 h-3" />
                </span>
              </div>
            </div>
          )}
          <div className="flex gap-3 w-full">
            <Button onClick={onClose} variant="outline" className="flex-1">
              Cancel
            </Button>
            <Button
              onClick={onConfirm}
              disabled={!canAfford}
              className={cn(
                "flex-1 text-[var(--color-text-primary)]",
                !canAfford
                  ? "bg-red-600 hover:bg-red-500 cursor-not-allowed opacity-80"
                  : "bg-emerald-600 hover:bg-emerald-500",
              )}
            >
              {!canAfford ? "Insufficient Funds" : "Buy Now"}
            </Button>
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
};

export const PurchaseSuccessDialog: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  assetName: string;
  creatorName: string;
  price: number | string;
  thumbnailUrl: string;
}> = ({ isOpen, onClose, assetName, creatorName, price, thumbnailUrl }) => (
  <Dialog isOpen={isOpen} onClose={onClose}>
    <DialogContent className="max-w-sm">
      <DialogBody className="flex flex-col items-center text-center py-8">
        <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mb-4">
          <CheckCircle2 className="w-10 h-10 text-emerald-500" />
        </div>
        <h2 className="text-2xl font-bold text-[var(--color-text-primary)] mb-6">
          Purchase Complete
        </h2>
        <div className="w-32 h-32 rounded-xl overflow-hidden bg-[var(--color-surface)] border border-[var(--color-border)] mb-4">
          {thumbnailUrl ? (
            <img
              src={thumbnailUrl}
              alt={assetName}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-[var(--color-text-muted)]">
              No Image
            </div>
          )}
        </div>
        <p className="text-[var(--color-text-secondary)] text-base leading-relaxed">
          You have successfully acquired the{" "}
          <span className="font-semibold text-[var(--color-text-primary)]">
            {assetName}
          </span>{" "}
          from{" "}
          <span className="font-semibold text-[var(--color-text-primary)]">
            {creatorName}
          </span>{" "}
          for{" "}
          <span className="inline-flex items-center gap-1 font-semibold text-emerald-400">
            {typeof price === "number" ? price.toLocaleString() : price}
            {typeof price === "number" && <RobuxIcon className="w-4 h-4" />}
          </span>
          .
        </p>
        <Button
          onClick={onClose}
          className="mt-8 bg-emerald-600 hover:bg-emerald-500 text-[var(--color-text-primary)] px-8"
        >
          Done
        </Button>
      </DialogBody>
    </DialogContent>
  </Dialog>
);

export const PurchaseErrorDialog: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  errorMessage: string;
}> = ({ isOpen, onClose, errorMessage }) => (
  <Dialog isOpen={isOpen} onClose={onClose}>
    <DialogContent className="max-w-sm">
      <DialogBody className="flex flex-col items-center text-center py-6">
        <div className="w-14 h-14 bg-red-500/10 rounded-full flex items-center justify-center mb-4">
          <XCircle className="w-8 h-8 text-red-500" />
        </div>
        <h2 className="text-xl font-bold text-[var(--color-text-primary)] mb-3">
          Purchase Failed
        </h2>
        <p className="text-[var(--color-text-secondary)] text-sm leading-relaxed mb-6">
          {errorMessage}
        </p>
        <Button onClick={onClose} variant="outline" className="px-8">
          Close
        </Button>
      </DialogBody>
    </DialogContent>
  </Dialog>
);

interface AssetPricingProps {
  details: AssetDetails;
  onPurchaseSuccess?: (details: AssetDetails, price: number | string) => void;
  onPurchaseError?: (error: string) => void;
  cookie?: string;
  userId?: string;
}

export const AssetPricing: React.FC<AssetPricingProps> = ({
  details,
  onPurchaseSuccess,
  onPurchaseError,
  cookie,
  userId,
}) => {
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [purchaseProgress, setPurchaseProgress] = useState<{
    current: number;
    total: number;
    success: number;
    failed: number;
  } | null>(null);

  const { accounts } = useAccountsManager();
  const selectedIds = useSelectedIds();
  const isBulkMode = selectedIds.size > 1;

  const targetAccounts = useMemo<PurchaseTargetAccount[]>(() => {
    if (isBulkMode) {
      return accounts
        .filter(
          (account): account is Account & { cookie: string } =>
            selectedIds.has(account.id) && Boolean(account.cookie),
        )
        .map((account) => ({
          id: account.id,
          userId: account.userId,
          username: account.username,
          cookie: account.cookie,
        }));
    }
    return cookie && userId
      ? [{ cookie, userId, id: userId, username: "You" }]
      : [];
  }, [isBulkMode, accounts, selectedIds, cookie, userId]);

  const [ownedAccounts, setOwnedAccounts] = useState<Set<string>>(new Set());
  const [userBalance, setUserBalance] = useState<number | null>(null);
  const purchaseInProgressRef = useRef(false);

  let displayPrice: string | number = "Off Sale";
  const isLimitedItem = details.isLimited || details.isLimitedUnique;

  if (
    isLimitedItem &&
    details.collectibleLowestResalePrice &&
    details.collectibleLowestResalePrice > 0
  ) {
    displayPrice = details.collectibleLowestResalePrice;
  } else if (details.lowestPrice && details.lowestPrice > 0) {
    displayPrice = details.lowestPrice;
  } else if (details.price != null) {
    if (details.price === 0 && details.isPurchasable && !isLimitedItem) {
      displayPrice = "Free";
    } else if (details.price > 0) {
      displayPrice = details.price;
    } else if (!details.isPurchasable) {
      displayPrice = "Off Sale";
    }
  }

  React.useEffect(() => {
    let isMounted = true;
    const checkStatus = async () => {
      if (targetAccounts.length === 0 || !details.id) return;

      try {
        const ownedSet = new Set<string>();
        await Promise.all(
          targetAccounts.map(async (acc) => {
            try {
              const owned = await window.api.checkAssetOwnership(
                acc.cookie,
                Number(acc.userId || acc.id),
                details.id!,
                "Asset",
              );
              if (owned) ownedSet.add(acc.id);
            } catch (err) {
              console.warn(`Failed ownership check for ${acc.id}:`, err);
            }
          }),
        );
        if (isMounted) setOwnedAccounts(ownedSet);

        if (
          !isBulkMode &&
          !ownedSet.has(targetAccounts[0]?.id) &&
          displayPrice !== "Off Sale"
        ) {
          const stats = await window.api.fetchAccountStats(
            targetAccounts[0].cookie,
          );
          if (isMounted && stats) setUserBalance(stats.robuxBalance);
        }
      } catch (err) {
        console.warn("Failed to check ownership or balance:", err);
      }
    };

    checkStatus();
    return () => {
      isMounted = false;
    };
  }, [targetAccounts, details.id, displayPrice, isBulkMode]);

  const accountsNeedingPurchase = targetAccounts.filter(
    (a) => !ownedAccounts.has(a.id),
  );
  const isFullyOwned =
    accountsNeedingPurchase.length === 0 && targetAccounts.length > 0;
  const totalCost =
    accountsNeedingPurchase.length *
    (typeof displayPrice === "number" ? displayPrice : 0);

  const canPurchase =
    !isFullyOwned &&
    displayPrice !== "Off Sale" &&
    !!details.collectibleItemId &&
    targetAccounts.length > 0;
  const needsLogin = targetAccounts.length === 0 && displayPrice !== "Off Sale";
  const isPurchaseUnavailable = !needsLogin && !canPurchase && !isFullyOwned;

  const handlePurchaseClick = () => {
    if (needsLogin) {
      alert("You must be logged in to purchase this item.");
      return;
    }
    if (!canPurchase) return;
    setShowConfirm(true);
  };

  const handleConfirmPurchase = async () => {
    if (purchaseInProgressRef.current) return;
    if (
      !canPurchase ||
      !details.collectibleItemId ||
      targetAccounts.length === 0
    )
      return;

    purchaseInProgressRef.current = true;
    setShowConfirm(false);
    setIsPurchasing(true);
    try {
      const expectedPrice = typeof displayPrice === "number" ? displayPrice : 0;
      const expectedSellerId = details.creatorTargetId || 0;
      let successCount = 0;
      let lastError = "";
      let currentIdx = 0;
      const purchaseResults: Array<{
        accountId: string;
        success: boolean;
        error?: string;
      }> = [];

      if (isBulkMode) {
        setPurchaseProgress({
          current: 0,
          total: accountsNeedingPurchase.length,
          success: 0,
          failed: 0,
        });
        let currentSuccess = 0;
        let currentFailed = 0;

        for (const acc of accountsNeedingPurchase) {
          try {
            const authCheck = await window.api
              .validateCookie(acc.cookie)
              .catch(() => null);
            if (!authCheck) {
              lastError = "Invalid cookie (Unauthenticated)";
              purchaseResults.push({
                accountId: acc.id,
                success: false,
                error: lastError,
              });
              currentFailed++;
            } else {
              const result = await executeWithRetry(
                catalogPurchaseLimiter,
                async () => {
                  return await window.api.purchaseCatalogItem(
                    acc.cookie,
                    details.collectibleItemId!,
                    expectedPrice,
                    expectedSellerId,
                    details.collectibleProductId || "",
                    acc.userId || acc.id,
                    crypto.randomUUID(),
                  );
                },
                { retryCondition: isRateLimitError },
              );

              if (result.purchased) {
                setOwnedAccounts((prev) => new Set(prev).add(acc.id));
                successCount++;
                currentSuccess++;
                purchaseResults.push({ accountId: acc.id, success: true });
              } else {
                const error =
                  result.errorMessage || result.reason || "Unknown error";
                lastError = error;
                purchaseResults.push({
                  accountId: acc.id,
                  success: false,
                  error,
                });
                currentFailed++;
              }
            }
          } catch (err: any) {
            let errorMsg = err.message || "An error occurred";
            if (errorMsg.includes("429")) errorMsg = "Rate Limited (429)";
            if (errorMsg.includes("403")) errorMsg = "Forbidden (403)";
            lastError = errorMsg;
            purchaseResults.push({
              accountId: acc.id,
              success: false,
              error: errorMsg,
            });
          }
          currentIdx++;
          setPurchaseProgress({
            current: currentIdx,
            total: accountsNeedingPurchase.length,
            success: currentSuccess,
            failed: currentFailed,
          });

          if (currentIdx < accountsNeedingPurchase.length) {
            await sleep(3000);
          }
        }

        if (currentSuccess > 0) {
          onPurchaseSuccess?.(
            details,
            isBulkMode ? currentSuccess * expectedPrice : displayPrice,
          );
        } else if (currentFailed > 0) {
          onPurchaseError?.(
            `Purchase failed for all. Last error: ${lastError}`,
          );
        }
      } else {
        try {
          const result = await executeWithRetry(
            catalogPurchaseLimiter,
            async () => {
              return await window.api.purchaseCatalogItem(
                accountsNeedingPurchase[0].cookie,
                details.collectibleItemId!,
                expectedPrice,
                expectedSellerId,
                details.collectibleProductId || "",
                accountsNeedingPurchase[0].userId ||
                  accountsNeedingPurchase[0].id,
                crypto.randomUUID(),
              );
            },
            { retryCondition: isRateLimitError },
          );

          if (result.purchased) {
            setOwnedAccounts((prev) =>
              new Set(prev).add(accountsNeedingPurchase[0].id),
            );
            successCount++;
          } else {
            lastError = result.errorMessage || result.reason || "Unknown error";
          }
        } catch (err: any) {
          lastError = err.message || "An error occurred";
        }
      }

      if (!isBulkMode) {
        if (successCount > 0) {
          onPurchaseSuccess?.(details, displayPrice);
        } else if (lastError) {
          onPurchaseError?.(lastError);
        }
      }
    } catch (err: any) {
      console.error("Purchase error:", err);
      onPurchaseError?.(err.message || "An error occurred during purchase");
    } finally {
      setIsPurchasing(false);
      purchaseInProgressRef.current = false;
    }
  };

  return (
    <div className="p-4 bg-[var(--color-surface)]/50 border border-[var(--color-border)] rounded-xl flex items-center justify-between relative">
      <div>
        <div className="text-sm text-[var(--color-text-muted)] mb-1">Price</div>
        <div className="text-xl font-bold text-[var(--color-text-primary)] flex items-center gap-1">
          {typeof displayPrice === "number" ? (
            <>
              {displayPrice.toLocaleString()}
              <RobuxIcon className="w-4 h-4 ml-1" />
            </>
          ) : (
            <span
              className={
                displayPrice === "Free"
                  ? "text-[var(--color-text-primary)]"
                  : "text-[var(--color-text-secondary)]"
              }
            >
              {displayPrice}
            </span>
          )}
        </div>
      </div>
      <Button
        disabled={
          isFullyOwned ||
          displayPrice === "Off Sale" ||
          isPurchaseUnavailable ||
          isPurchasing
        }
        onClick={handlePurchaseClick}
        className={cn(
          "min-w-[120px]",
          isFullyOwned
            ? "bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)] cursor-not-allowed hover:bg-[var(--color-surface-hover)]"
            : displayPrice === "Off Sale"
              ? "opacity-50 cursor-not-allowed bg-transparent text-[var(--color-text-secondary)] border-2 border-dashed border-[var(--color-border-strong)] hover:bg-transparent"
              : "bg-emerald-600 hover:bg-emerald-500 text-[var(--color-text-primary)]",
        )}
      >
        {isPurchasing ? (
          <Loader2 size={18} className="mr-2 animate-spin" />
        ) : isFullyOwned ? (
          <span className="flex items-center">
            <span className="mr-2">✓</span>{" "}
            {isBulkMode ? `Owned by All (${targetAccounts.length})` : "Owned"}
          </span>
        ) : needsLogin ? (
          <span className="flex items-center">
            <ShoppingCart size={18} className="mr-2" />
            Log in to purchase
          </span>
        ) : isPurchaseUnavailable ? (
          <span className="flex items-center">
            <ShoppingCart size={18} className="mr-2" />
            Unavailable
          </span>
        ) : (
          <span className="flex items-center flex-col py-1">
            <span className="flex items-center">
              <ShoppingCart size={18} className="mr-2" />
              {isBulkMode
                ? `Buy for All (${accountsNeedingPurchase.length})`
                : "Buy"}
            </span>
            {isBulkMode && ownedAccounts.size > 0 && (
              <span className="text-[10px] text-emerald-200 opacity-80 font-normal">
                {ownedAccounts.size} already own it
              </span>
            )}
          </span>
        )}
      </Button>

      {}
      {isPurchasing && purchaseProgress && isBulkMode && (
        <div className="absolute left-0 right-0 -bottom-[100px] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-4 z-20 shadow-2xl flex flex-col gap-3 min-w-[300px]">
          <div className="flex justify-between items-center">
            <span className="text-sm font-semibold text-[var(--color-text-primary)]">
              Purchasing...
            </span>
            <span className="text-xs text-[var(--color-text-secondary)]">
              {purchaseProgress.current} / {purchaseProgress.total}
            </span>
          </div>

          <div className="w-full bg-[var(--color-surface-hover)] rounded-full h-2 overflow-hidden flex">
            <div
              className="bg-emerald-500 h-full transition-all duration-300"
              style={{
                width: `${(purchaseProgress.success / purchaseProgress.total) * 100}%`,
              }}
            />
            <div
              className="bg-red-500 h-full transition-all duration-300"
              style={{
                width: `${(purchaseProgress.failed / purchaseProgress.total) * 100}%`,
              }}
            />
          </div>

          <div className="flex justify-between text-xs mt-1">
            <div className="flex items-center gap-1.5 text-emerald-400 font-medium">
              <CheckCircle2 size={12} />
              {purchaseProgress.success} Bought
            </div>
            {purchaseProgress.failed > 0 && (
              <div className="flex items-center gap-1.5 text-red-400 font-medium">
                <AlertTriangle size={12} />
                {purchaseProgress.failed} Failed
              </div>
            )}
          </div>

          {purchaseProgress.failed > 0 && (
            <div className="text-[10px] text-[var(--color-text-muted)] bg-[var(--color-app-bg)] p-2 rounded truncate">
              Errors occurred. See console for details.
            </div>
          )}
        </div>
      )}

      {}
      <PurchaseConfirmDialog
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={handleConfirmPurchase}
        assetName={details.name || "Unknown Asset"}
        price={isBulkMode ? totalCost : displayPrice}
        userBalance={userBalance}
        accountCount={isBulkMode ? accountsNeedingPurchase.length : 1}
      />
    </div>
  );
};
