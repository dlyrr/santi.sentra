import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Package, Loader2, Grid2X2, Grid3X3, User, Users } from "lucide-react";
import { VirtuosoGrid } from "react-virtuoso";
import { SearchInput } from "@renderer/components/UI/inputs/SearchInput";
import { TooltipProvider } from "@renderer/components/UI/display/Tooltip";
import { SkeletonSquareCard } from "@renderer/components/UI/display/SkeletonCard";
import { EmptyState } from "@renderer/components/UI/feedback/EmptyState";
import {
  useInventoryV2,
  useInventoryThumbnails,
  useAccountsManager,
} from "@renderer/hooks/queries";
import { Account } from "@renderer/types";
import PlayerInventorySheet from "./Modals/PlayerInventorySheet";
import InventoryItemContextMenu from "./InventoryItemContextMenu";
import AccessoryDetailsModal from "@renderer/features/avatar/Modals/AccessoryDetailsModal";
import { InventoryFilterSidebar } from "./InventoryFilterSidebar";
import { INVENTORY_CATEGORIES } from "./inventoryCategories";
import {
  useInventorySelectedCategory,
  useSetInventorySelectedCategory,
  useInventorySelectedSubcategory,
  useSetInventorySelectedSubcategory,
  useInventorySortOrder,
  useSetInventorySortOrder,
  useInventorySearchQuery,
  useSetInventorySearchQuery,
  useClearInventoryFilters,
} from "./stores/useInventoryStore";
import {
  useInventoryViewMode,
  useSetInventoryViewMode,
} from "@renderer/stores/useViewPreferencesStore";
import { useSelectedIds } from "@renderer/stores/useSelectionStore";
import {
  useBulkInventory,
  BulkInventoryItem,
} from "@renderer/features/avatar/hooks/useBulkInventory";

interface InventoryItemCardProps {
  item: {
    assetId: number;
    name?: string;
    assetName?: string;
    assetType?: string | number;
    created?: string;
  };
  thumbnailUrl?: string;
  index: number;
  onClick?: () => void;
  onContextMenu?: (
    e: React.MouseEvent,
    item: { assetId: number; name: string; assetType?: string | number },
  ) => void;
  isCompact?: boolean;
}

const InventoryItemCard = ({
  item,
  thumbnailUrl,
  index,
  onClick,
  onContextMenu,
  isCompact = false,
}: InventoryItemCardProps) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const displayName = item.name || item.assetName || "Unknown Item";

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onContextMenu) {
      onContextMenu(e, {
        assetId: item.assetId,
        name: displayName,
        assetType: item.assetType,
      });
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.02, 0.3) }}
      onClick={onClick}
      onContextMenu={handleContextMenu}
      className="group relative flex flex-col bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl overflow-hidden cursor-pointer hover:bg-[var(--color-surface-hover)] hover:border-[var(--color-border-strong)] hover:shadow-[0_18px_40px_rgba(0,0,0,0.35)] hover:-translate-y-1 transition-all duration-300"
    >
      {}
      <div
        className={`w-full relative overflow-hidden bg-[var(--color-surface-muted)] ${isCompact ? "aspect-square p-0" : "aspect-square p-2"}`}
      >
        <div
          className={`w-full h-full relative overflow-hidden bg-[var(--color-surface-hover)] ${isCompact ? "" : "rounded-lg"}`}
        >
          {thumbnailUrl && !imageError ? (
            <>
              {!imageLoaded && (
                <div className="absolute inset-0 bg-[var(--color-surface-hover)]/30 animate-pulse" />
              )}
              <img
                src={thumbnailUrl}
                alt={displayName}
                onLoad={() => setImageLoaded(true)}
                onError={() => {
                  setImageError(true);
                  setImageLoaded(true);
                }}
                className={`w-full h-full object-contain transition-all duration-500 group-hover:scale-110 ${
                  imageLoaded ? "opacity-100" : "opacity-0"
                }`}
                loading="lazy"
              />
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-[var(--color-text-muted)]">
              <Package size={32} />
            </div>
          )}
        </div>
      </div>

      {}
      <div
        className={`flex flex-col gap-1.5 border-t border-[var(--color-border)] bg-[var(--color-surface-strong)] ${isCompact ? "p-2" : "p-3"}`}
      >
        <h3 className="font-medium text-sm text-[var(--color-text-primary)] truncate">
          {displayName}
        </h3>
        {item.created && (
          <p className="text-xs text-[var(--color-text-muted)]">
            {new Date(item.created).toLocaleDateString()}
          </p>
        )}
      </div>
    </motion.div>
  );
};

interface InventoryTabProps {
  account: Account | null;
}

const InventoryTab = ({ account }: InventoryTabProps) => {
  const selectedIds = useSelectedIds();
  const { accounts = [] } = useAccountsManager();
  const selectedAccounts = useMemo(
    () => accounts.filter((a) => selectedIds.has(a.id)),
    [accounts, selectedIds],
  );
  const isBulkMode = selectedIds.size >= 2;

  const viewMode = useInventoryViewMode();
  const setViewMode = useSetInventoryViewMode();

  const [playerInventorySheet, setPlayerInventorySheet] = useState<{
    userId: number;
    username: string;
  } | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    assetId: number;
    assetName: string;
    assetType?: string | number;
  } | null>(null);
  const [selectedAccessory, setSelectedAccessory] = useState<{
    id: number;
    name: string;
    imageUrl?: string;
  } | null>(null);

  const selectedCategory = useInventorySelectedCategory();
  const setSelectedCategory = useSetInventorySelectedCategory();
  const selectedSubcategory = useInventorySelectedSubcategory();
  const setSelectedSubcategory = useSetInventorySelectedSubcategory();
  const sortOrder = useInventorySortOrder();
  const setSortOrder = useSetInventorySortOrder();
  const searchQuery = useInventorySearchQuery();
  const setSearchQuery = useSetInventorySearchQuery();
  const clearFilters = useClearInventoryFilters();

  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");

  const cookie = account?.cookie;
  const userId = account?.userId ? parseInt(account.userId, 10) : undefined;

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const assetTypes = useMemo(() => {
    if (selectedSubcategory) return selectedSubcategory.assetTypes;
    if (selectedCategory) return selectedCategory.assetTypes;
    const allCategory = INVENTORY_CATEGORIES.find((c) => c.category === "All");
    return (
      allCategory?.assetTypes || [
        "Hat",
        "Shirt",
        "Pants",
        "TShirt",
        "HairAccessory",
        "FaceAccessory",
        "Gear",
      ]
    );
  }, [selectedCategory, selectedSubcategory]);

  const ASSET_TYPE_NAME_TO_ID: Record<string, number> = {
    TShirt: 2,
    Hat: 8,
    Shirt: 11,
    Pants: 12,
    Head: 17,
    Face: 18,
    Gear: 19,
    HairAccessory: 41,
    FaceAccessory: 42,
    NeckAccessory: 43,
    ShoulderAccessory: 44,
    FrontAccessory: 45,
    BackAccessory: 46,
    WaistAccessory: 47,
    EmoteAnimation: 61,
    TShirtAccessory: 64,
    ShirtAccessory: 65,
    PantsAccessory: 66,
    JacketAccessory: 67,
    SweaterAccessory: 68,
    ShortsAccessory: 69,
    DressSkirtAccessory: 72,
  };
  const assetTypeIds = useMemo(
    () => assetTypes.map((t) => ASSET_TYPE_NAME_TO_ID[t]).filter(Boolean),
    [assetTypes],
  );

  const isGamePassCategory = assetTypes.includes("GamePass");
  const isBadgeCategory = assetTypes.includes("Badge");
  const isSpecialCategory = isGamePassCategory || isBadgeCategory;

  const hasActiveFilters = useMemo(() => {
    return selectedCategory !== null || sortOrder !== "Desc";
  }, [selectedCategory, sortOrder]);

  const {
    data,
    isLoading: isSingleLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useInventoryV2({
    cookie,
    userId,
    assetTypes,
    sortOrder,
    limit: 100,
    enabled:
      !isBulkMode &&
      !isSpecialCategory &&
      !!cookie &&
      !!userId &&
      assetTypes.length > 0,
  });

  const { data: bulkData = [], isLoading: isBulkLoading } = useBulkInventory(
    selectedAccounts,
    assetTypeIds,
    { enabled: isBulkMode && !isSpecialCategory && assetTypeIds.length > 0 },
  );

  const [gamePasses, setGamePasses] = useState<
    Array<{ id: number; name: string; type: string; imageUrl: string }>
  >([]);
  const [isLoadingGamePasses, setIsLoadingGamePasses] = useState(false);
  useEffect(() => {
    if (!isGamePassCategory || !cookie || !userId) {
      setGamePasses([]);
      return;
    }

    let cancelled = false;
    setIsLoadingGamePasses(true);
    window.api
      .getInventory(cookie, userId, 34)
      .then((res) => {
        if (cancelled) return;
        const items = (res.data || []).map((item: any) => ({
          id: item.assetId,
          name: item.name || item.assetName || "Unknown",
          type: "GamePass",
          imageUrl: "",
        }));
        setGamePasses(items);
      })
      .catch(() => {
        if (!cancelled) setGamePasses([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingGamePasses(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isGamePassCategory, cookie, userId]);

  const [badges, setBadges] = useState<
    Array<{ id: number; name: string; type: string; imageUrl: string }>
  >([]);
  const [isLoadingBadges, setIsLoadingBadges] = useState(false);
  useEffect(() => {
    if (!isBadgeCategory || !cookie || !userId) {
      setBadges([]);
      return;
    }

    let cancelled = false;
    setIsLoadingBadges(true);
    window.api
      .getPlayerBadges(cookie, userId)
      .then((res: any) => {
        if (cancelled) return;
        const items = (res.data || []).map((badge: any) => ({
          id: badge.id,
          name: badge.name || "Unknown Badge",
          type: "Badge",
          imageUrl: badge.displayIconImageId
            ? `https://thumbnails.roblox.com/v1/badges/icons?badgeIds=${badge.displayIconImageId}&size=150x150&format=Png&isCircular=false`
            : "",
        }));
        setBadges(items);
      })
      .catch(() => {
        if (!cancelled) setBadges([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingBadges(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isBadgeCategory, cookie, userId]);

  const specialItems = isGamePassCategory
    ? gamePasses
    : isBadgeCategory
      ? badges
      : [];
  const isSpecialLoading = isGamePassCategory
    ? isLoadingGamePasses
    : isBadgeCategory
      ? isLoadingBadges
      : false;

  const isLoading = isBulkMode
    ? isBulkLoading
    : isSpecialCategory
      ? isSpecialLoading
      : isSingleLoading;

  const singleItems = useMemo(() => {
    if (isSpecialCategory) {
      const items = specialItems;
      if (!debouncedSearchQuery.trim())
        return items.map((i) => ({
          assetId: i.id,
          name: i.name,
          assetType: i.type,
          created: "",
        }));
      const q = debouncedSearchQuery.toLowerCase();
      return items
        .filter((i) => i.name.toLowerCase().includes(q))
        .map((i) => ({
          assetId: i.id,
          name: i.name,
          assetType: i.type,
          created: "",
        }));
    }
    const allItems = data?.pages.flatMap((page) => page.data) || [];
    if (debouncedSearchQuery.trim()) {
      const query = debouncedSearchQuery.toLowerCase();
      return allItems.filter((item) =>
        (item.name || item.assetName || "").toLowerCase().includes(query),
      );
    }
    return allItems;
  }, [data, debouncedSearchQuery, isSpecialCategory, specialItems]);

  const filteredBulkItems = useMemo(() => {
    if (!debouncedSearchQuery.trim()) return bulkData;
    const query = debouncedSearchQuery.toLowerCase();
    return bulkData.filter((item) => item.name.toLowerCase().includes(query));
  }, [bulkData, debouncedSearchQuery]);

  const assetIds = useMemo(() => {
    if (isBulkMode) return filteredBulkItems.map((i) => i.id);
    return singleItems
      .map((item) => item.assetId)
      .filter((id, index, self) => self.indexOf(id) === index);
  }, [isBulkMode, singleItems, filteredBulkItems]);

  const { thumbnails } = useInventoryThumbnails(assetIds, assetIds.length > 0);

  const loadMoreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 },
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const gridStyle: React.CSSProperties = {
    gridTemplateColumns:
      viewMode === "compact"
        ? "repeat(auto-fill, minmax(140px, 1fr))"
        : "repeat(auto-fill, minmax(200px, 1fr))",
  };

  const handleItemClick = useCallback(
    (item: { assetId: number; name?: string; assetName?: string }) => {
      setSelectedAccessory({
        id: item.assetId,
        name: item.name || item.assetName || "Unknown Item",
        imageUrl: thumbnails[item.assetId],
      });
    },
    [thumbnails],
  );

  const handleContextMenu = useCallback(
    (
      e: React.MouseEvent,
      item: { assetId: number; name: string; assetType?: string | number },
    ) => {
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        assetId: item.assetId,
        assetName: item.name,
        assetType: item.assetType,
      });
    },
    [],
  );

  const handleDownloadObj = useCallback(
    async (assetId: number, assetName: string) => {
      try {
        const result = await (window as any).api.downloadAsset3D(
          assetId,
          "obj",
          assetName,
        );
        if (!result?.success) console.error("Failed to download OBJ");
      } catch (err) {
        console.error("Failed to download OBJ:", err);
      }
    },
    [],
  );

  const handleDownloadTexture = useCallback(
    async (assetId: number, assetName: string) => {
      try {
        const result = await (window as any).api.downloadAsset3D(
          assetId,
          "texture",
          assetName,
        );
        if (!result?.success) console.error("Failed to download texture");
      } catch (err) {
        console.error("Failed to download texture:", err);
      }
    },
    [],
  );

  const handleCopyAssetId = useCallback(async (assetId: number) => {
    try {
      await navigator.clipboard.writeText(String(assetId));
    } catch (err) {
      console.error("Failed to copy asset ID:", err);

      const textArea = document.createElement("textarea");
      textArea.value = String(assetId);
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
    }
  }, []);

  const handleDownloadTemplate = useCallback(
    async (assetId: number, assetName: string) => {
      try {
        const result = await window.api.downloadCatalogTemplate(
          assetId,
          assetName,
          cookie,
        );
        if (!result.success) {
          console.error("Failed to download template:", result.message);
        }
      } catch (err) {
        console.error("Failed to download template:", err);
      }
    },
    [cookie],
  );

  if (!isBulkMode && (!account || !cookie || !userId)) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--color-text-muted)]">
        <div className="text-center">
          <User
            size={48}
            className="mx-auto mb-4 text-[var(--color-text-muted)]"
          />
          <p>Select an account to view inventory</p>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="flex h-full bg-[var(--color-app-bg)]">
        {}
        <InventoryFilterSidebar
          categories={INVENTORY_CATEGORIES}
          selectedCategory={selectedCategory}
          selectedSubcategory={selectedSubcategory}
          onCategoryChange={setSelectedCategory}
          onSubcategoryChange={setSelectedSubcategory}
          sortOrder={sortOrder}
          onSortOrderChange={setSortOrder}
          onClearAll={clearFilters}
          hasActiveFilters={hasActiveFilters}
        />

        <div className="flex-1 flex flex-col min-w-0">
          {}
          <div className="shrink-0 h-[72px] bg-[var(--color-surface-strong)] border-b border-[var(--color-border)] z-20 flex items-center justify-between px-6 gap-4">
            <div className="flex items-center gap-4 flex-1">
              <h1 className="text-xl font-bold text-[var(--color-text-primary)]">
                Inventory
              </h1>
              <span className="flex items-center justify-center px-2.5 py-0.5 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] text-xs font-semibold tracking-tight text-[var(--color-text-secondary)]">
                {selectedSubcategory?.name ||
                  selectedCategory?.name ||
                  "All Items"}
              </span>
              {isBulkMode && (
                <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-xs font-semibold text-blue-400">
                  <Users size={12} />
                  {selectedAccounts.length} accounts
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              {}
              <SearchInput
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Search inventory..."
                containerClassName="w-64"
              />

              <div className="h-6 w-[1px] bg-[var(--color-surface-hover)] mx-1" />

              {}
              <div className="flex bg-[var(--color-surface)] rounded-lg p-1 border border-[var(--color-border)]">
                <button
                  onClick={() => setViewMode("default")}
                  className={`p-1.5 rounded transition-all ${viewMode === "default" ? "bg-[var(--color-surface-hover)] text-[var(--color-text-primary)] shadow-sm" : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"}`}
                  title="Default View"
                >
                  <Grid2X2 size={18} />
                </button>
                <button
                  onClick={() => setViewMode("compact")}
                  className={`p-1.5 rounded transition-all ${viewMode === "compact" ? "bg-[var(--color-surface-hover)] text-[var(--color-text-primary)] shadow-sm" : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"}`}
                  title="Compact View"
                >
                  <Grid3X3 size={18} />
                </button>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto scrollbar-thin bg-[var(--color-app-bg)]">
            <AnimatePresence mode="wait">
              {isLoading &&
              (isBulkMode
                ? filteredBulkItems.length === 0
                : singleItems.length === 0) ? (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="grid gap-4 px-6 pt-8 pb-6"
                  style={gridStyle}
                >
                  {Array.from({ length: 20 }).map((_, i) => (
                    <div
                      key={i}
                      className="bg-[var(--color-surface)]/50 border border-[var(--color-border)] rounded-xl overflow-hidden"
                    >
                      <SkeletonSquareCard showBorder={false} />
                      <div className="p-3 space-y-2">
                        <div className="h-4 bg-[var(--color-surface-hover)] rounded animate-pulse w-3/4" />
                        <div className="h-3 bg-[var(--color-surface-hover)] rounded animate-pulse w-1/2" />
                      </div>
                    </div>
                  ))}
                </motion.div>
              ) : isBulkMode ? (
                filteredBulkItems.length === 0 ? (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.3 }}
                    className="flex items-center justify-center h-full"
                  >
                    <EmptyState
                      icon={Package}
                      title="No items found"
                      description={
                        searchQuery
                          ? "Try adjusting your search"
                          : "No items in this category"
                      }
                      variant="minimal"
                    />
                  </motion.div>
                ) : (
                  <motion.div
                    key="bulk-items"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.3 }}
                    className="h-full"
                  >
                    <VirtuosoGrid
                      totalCount={filteredBulkItems.length}
                      overscan={200}
                      listClassName={`grid gap-4 px-6 pb-6 ${viewMode === "compact" ? "grid-cols-[repeat(auto-fill,minmax(140px,1fr))]" : "grid-cols-[repeat(auto-fill,minmax(200px,1fr))]"}`}
                      itemContent={(index) => {
                        const item = filteredBulkItems[index];
                        return (
                          <div
                            key={item.id}
                            className="relative bg-[var(--color-surface)]/50 border border-[var(--color-border)] rounded-xl overflow-hidden hover:border-[var(--color-border-strong)] transition-colors"
                          >
                            <div className="aspect-square bg-[var(--color-surface)] flex items-center justify-center">
                              {thumbnails[item.id] ? (
                                <img
                                  src={thumbnails[item.id]}
                                  alt={item.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <Package
                                  size={32}
                                  className="text-[var(--color-text-muted)]"
                                />
                              )}
                            </div>
                            <div className="p-3">
                              <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                                {item.name}
                              </p>
                              <p className="text-xs text-[var(--color-text-muted)] truncate">
                                {item.type}
                              </p>
                            </div>

                            <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/70 backdrop-blur-sm rounded-full px-2 py-0.5 text-[10px] font-bold text-blue-300 border border-blue-500/30">
                              <Users size={9} />
                              {item.ownershipCount}/{selectedAccounts.length}
                            </div>
                          </div>
                        );
                      }}
                      components={{ Header: () => <div className="h-8" /> }}
                    />
                  </motion.div>
                )
              ) : singleItems.length === 0 ? (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3 }}
                  className="flex items-center justify-center h-full"
                >
                  <EmptyState
                    icon={Package}
                    title="No items found"
                    description={
                      searchQuery
                        ? "Try adjusting your search"
                        : "No items in this category"
                    }
                    variant="minimal"
                  />
                </motion.div>
              ) : (
                <motion.div
                  key="items"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3 }}
                  className="h-full"
                >
                  <VirtuosoGrid
                    totalCount={singleItems.length}
                    overscan={200}
                    listClassName={`grid gap-4 px-6 pb-6 ${viewMode === "compact" ? "grid-cols-[repeat(auto-fill,minmax(140px,1fr))]" : "grid-cols-[repeat(auto-fill,minmax(200px,1fr))]"}`}
                    itemContent={(index) => {
                      const item = singleItems[index];
                      return (
                        <InventoryItemCard
                          key={`${item.assetId}-${index}`}
                          item={item}
                          thumbnailUrl={thumbnails[item.assetId]}
                          index={index}
                          onClick={() => handleItemClick(item)}
                          onContextMenu={handleContextMenu}
                          isCompact={viewMode === "compact"}
                        />
                      );
                    }}
                    endReached={() => {
                      if (hasNextPage && !isFetchingNextPage) fetchNextPage();
                    }}
                    components={{
                      Header: () => <div className="h-8" />,
                      Footer: () =>
                        isFetchingNextPage ? (
                          <div className="h-20 flex items-center justify-center">
                            <div className="flex items-center gap-2 text-[var(--color-text-muted)]">
                              <Loader2 size={20} className="animate-spin" />
                              <span>Loading more...</span>
                            </div>
                          </div>
                        ) : null,
                    }}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {playerInventorySheet && (
          <PlayerInventorySheet
            isOpen={!!playerInventorySheet}
            onClose={() => setPlayerInventorySheet(null)}
            userId={playerInventorySheet.userId}
            username={playerInventorySheet.username}
            cookie={cookie}
          />
        )}

        <InventoryItemContextMenu
          activeMenu={contextMenu}
          onClose={() => setContextMenu(null)}
          onDownloadObj={handleDownloadObj}
          onDownloadTexture={handleDownloadTexture}
          onDownloadTemplate={handleDownloadTemplate}
          onCopyAssetId={handleCopyAssetId}
        />

        <AccessoryDetailsModal
          isOpen={!!selectedAccessory}
          onClose={() => setSelectedAccessory(null)}
          assetId={selectedAccessory?.id || null}
          account={account}
          initialData={
            selectedAccessory
              ? {
                  name: selectedAccessory.name,
                  imageUrl: selectedAccessory.imageUrl || "",
                }
              : undefined
          }
        />
      </div>
    </TooltipProvider>
  );
};

export default InventoryTab;
