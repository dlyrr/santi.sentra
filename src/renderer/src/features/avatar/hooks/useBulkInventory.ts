import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@shared/queryKeys";
import { Account } from "@renderer/types";

const ASSET_TYPE_MAP: Record<number, string> = {
  2: "TShirt",
  8: "Hat",
  11: "Shirt",
  12: "Pants",
  17: "Head",
  18: "Face",
  19: "Gear",
  27: "Torso",
  28: "RightArm",
  29: "LeftArm",
  30: "LeftLeg",
  31: "RightLeg",
  41: "HairAccessory",
  42: "FaceAccessory",
  43: "NeckAccessory",
  44: "ShoulderAccessory",
  45: "FrontAccessory",
  46: "BackAccessory",
  47: "WaistAccessory",
  48: "ClimbAnimation",
  50: "FallAnimation",
  51: "IdleAnimation",
  52: "JumpAnimation",
  53: "RunAnimation",
  54: "SwimAnimation",
  55: "WalkAnimation",
  61: "EmoteAnimation",
  64: "TShirtAccessory",
  65: "ShirtAccessory",
  66: "PantsAccessory",
  67: "JacketAccessory",
  68: "SweaterAccessory",
  69: "ShortsAccessory",
  70: "LeftShoeAccessory",
  71: "RightShoeAccessory",
  72: "DressSkirtAccessory",
  79: "DynamicHead",
};

const mapAssetTypeIds = (ids: number[]): string[] => {
  return ids.map((id) => ASSET_TYPE_MAP[id]).filter(Boolean);
};

export interface BulkInventoryItem {
  id: number;
  name: string;
  type: string;
  imageUrl: string;
  ownershipCount: number;
}

export function useBulkInventory(
  accounts: Account[],
  assetTypeIds: number[],
  options?: { enabled?: boolean },
) {
  const accountIds = accounts
    .map((a) => a.id)
    .sort()
    .join(",");

  const assetTypeKey = [...assetTypeIds].sort((a, b) => a - b).join(",");

  return useQuery({
    queryKey: ["avatar", "bulk-inventory", accountIds, assetTypeKey],
    queryFn: async (): Promise<BulkInventoryItem[]> => {
      const validAccounts = accounts.filter((a) => a.cookie && a.userId);
      if (validAccounts.length === 0) return [];

      const assetTypes = mapAssetTypeIds(assetTypeIds);
      if (assetTypes.length === 0) return [];

      const itemCounts = new Map<number, { count: number; item: any }>();

      for (const acc of validAccounts) {
        try {
          const userId = parseInt(acc.userId!);
          let cursor: string | undefined = undefined;
          let pages = 0;
          const MAX_PAGES = 20;

          do {
            const result = await window.api.getInventoryV2(
              acc.cookie!,
              userId,
              assetTypes,
              cursor,
              100,
              "Desc",
            );

            if (result?.data) {
              result.data.forEach((asset: any) => {
                const id = asset.assetId;
                const current = itemCounts.get(id);
                if (current) {
                  current.count++;
                } else {
                  itemCounts.set(id, { count: 1, item: asset });
                }
              });
            }

            cursor = result?.nextPageCursor ?? undefined;
            pages++;

            await new Promise((r) => setTimeout(r, 250));
          } while (cursor && pages < MAX_PAGES);
        } catch (error) {
          console.error(`Failed to fetch inventory for ${acc.username}`, error);
        }
      }

      if (itemCounts.size === 0) return [];

      const uniqueAssetIds = Array.from(itemCounts.keys());
      let thumbMap = new Map<number, string>();

      try {
        const thumbResponse =
          await window.api.getBatchThumbnails(uniqueAssetIds);
        thumbMap = new Map(
          thumbResponse.data.map((t: any) => [t.targetId, t.imageUrl]),
        );
      } catch (error) {
        console.error("[useBulkInventory] Failed to fetch thumbnails:", error);
      }

      const results: BulkInventoryItem[] = [];
      itemCounts.forEach(({ count, item }) => {
        results.push({
          id: item.assetId,
          name: item.name || item.assetName || item.Name || "Unknown Item",
          type: item.assetType?.name || "Unknown",
          imageUrl: (thumbMap.get(item.assetId) as string) || "",
          ownershipCount: count,
        });
      });

      return results.sort((a, b) => b.ownershipCount - a.ownershipCount);
    },
    enabled:
      accounts.length >= 2 &&
      assetTypeIds.length > 0 &&
      (options?.enabled ?? true),
    staleTime: 60 * 1000,
  });
}
