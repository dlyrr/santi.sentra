import { EventEmitter } from "events";
import { writeFileSync, readFileSync, existsSync } from "fs";
import { join } from "path";
import { getDataFile } from "../../utils/paths";

export type SniperItem = {
  id: number;
  name: string;
  targetId: number;
  purchasePrice: number;
  resaleValue: number;
  profit: number;
  profitPercent: number;
  timestamp: number;
};

export type LimitedItemWatch = {
  itemId: number;
  itemName: string;
  minProfitPercent: number;
  currentRAP: number;
  currentValue: number;
  lastUpdated: number;
  enabled: boolean;
};

export type SniperConfig = {
  minProfit: number;
  maxPurchasePrice: number;
  targetItemIds: number[];
  enabled: boolean;
  pollingIntervalMs: number;
  limitedItemMinProfitPercent: number;
};

export type SniperLogEntry = {
  timestamp: number;
  itemId: number;
  itemName: string;
  action: "purchased" | "monitored" | "skipped" | "error" | "auto-buy";
  profit?: number;
  profitPercent?: number;
  reason?: string;
};

export class SniperService extends EventEmitter {
  private config: SniperConfig = {
    minProfit: 5000,
    maxPurchasePrice: 50000,
    targetItemIds: [],
    enabled: false,
    pollingIntervalMs: 5000,
    limitedItemMinProfitPercent: 15,
  };

  private pollingIntervalId: NodeJS.Timeout | null = null;
  private limitedWatchPollingIntervalId: NodeJS.Timeout | null = null;
  private monitoredItems = new Map<number, SniperItem>();
  private limitedItemWatches = new Map<number, LimitedItemWatch>();
  private purchaseHistory: SniperLogEntry[] = [];
  private configPath = getDataFile("sniper-config.json");
  private limitedWatchlistPath = getDataFile("sniper-limited-watchlist.json");

  constructor() {
    super();
    this.loadConfig();
    this.loadLimitedWatchlist();
  }

  startMonitoring(): void {
    if (this.pollingIntervalId) {
      console.warn("[Sniper] Monitoring already active");
      return;
    }

    if (!this.config.enabled) {
      console.warn("[Sniper] Sniper is disabled");
      return;
    }

    console.log("[Sniper] Starting monitoring...");
    this.emit("monitoring-started");

    this.pollingIntervalId = setInterval(() => {
      this.pollItems();
    }, this.config.pollingIntervalMs);

    this.pollItems();
  }

  stopMonitoring(): void {
    if (this.pollingIntervalId) {
      clearInterval(this.pollingIntervalId);
      this.pollingIntervalId = null;
      console.log("[Sniper] Monitoring stopped");
      this.emit("monitoring-stopped");
    }
    if (this.limitedWatchPollingIntervalId) {
      clearInterval(this.limitedWatchPollingIntervalId);
      this.limitedWatchPollingIntervalId = null;
    }
  }

  async addLimitedItemWatch(
    itemId: number,
    itemName: string,
    minProfitPercent?: number,
  ): Promise<void> {
    try {
      const watch: LimitedItemWatch = {
        itemId,
        itemName,
        minProfitPercent:
          minProfitPercent || this.config.limitedItemMinProfitPercent,
        currentRAP: 0,
        currentValue: 0,
        lastUpdated: Date.now(),
        enabled: true,
      };

      const rap = await this.fetchRolimonsItemRAP(itemId);
      if (rap) {
        watch.currentRAP = rap.rap || 0;
        watch.currentValue = rap.value || 0;
      }

      this.limitedItemWatches.set(itemId, watch);
      this.saveLimitedWatchlist();

      console.log(
        `[Sniper] Added limited item to watch: ${itemName} (ID: ${itemId})`,
      );
      this.emit("limited-item-added", watch);

      if (!this.limitedWatchPollingIntervalId && this.config.enabled) {
        this.startLimitedWatchlistPolling();
      }
    } catch (err) {
      console.error("[Sniper] Failed to add limited item watch:", err);
      throw err;
    }
  }

  removeLimitedItemWatch(itemId: number): void {
    this.limitedItemWatches.delete(itemId);
    this.saveLimitedWatchlist();
    console.log(`[Sniper] Removed limited item from watch: ${itemId}`);
    this.emit("limited-item-removed", itemId);
  }

  private startLimitedWatchlistPolling(): void {
    if (this.limitedWatchPollingIntervalId) {
      return;
    }

    console.log("[Sniper] Starting limited item watchlist polling...");

    this.limitedWatchPollingIntervalId = setInterval(() => {
      this.pollLimitedItems();
    }, 30000);

    this.pollLimitedItems();
  }

  private async pollLimitedItems(): Promise<void> {
    try {
      for (const watch of this.limitedItemWatches.values()) {
        if (!watch.enabled) continue;

        const itemData = await this.fetchRolimonsItemRAP(watch.itemId);
        if (!itemData) continue;

        const oldRAP = watch.currentRAP;
        watch.currentRAP = itemData.rap || 0;
        watch.currentValue = itemData.value || 0;
        watch.lastUpdated = Date.now();

        if (oldRAP > 0) {
          const rapChangePercent = ((watch.currentRAP - oldRAP) / oldRAP) * 100;
          console.log(
            `[Sniper] ${watch.itemName}: RAP ${oldRAP} в†’ ${watch.currentRAP} (${rapChangePercent >= 0 ? "+" : ""}${rapChangePercent.toFixed(1)}%)`,
          );
        }

        const acquireCost = watch.currentRAP;
        const resaleValue = watch.currentValue;
        if (acquireCost > 0 && resaleValue > 0) {
          const profitPercent =
            ((resaleValue - acquireCost) / acquireCost) * 100;

          if (profitPercent > watch.minProfitPercent) {
            console.log(
              `[Sniper] LIMITED ITEM OPPORTUNITY: ${watch.itemName} - value ${resaleValue} vs RAP ${acquireCost} = ${profitPercent.toFixed(1)}% margin!`,
            );
            this.addLog({
              timestamp: Date.now(),
              itemId: watch.itemId,
              itemName: watch.itemName,
              action: "auto-buy",
              profitPercent,
              reason: `Resale value ${profitPercent.toFixed(1)}% above RAP`,
            });
            this.emit("limited-item-opportunity", { watch, profitPercent });
          }
        }

        this.saveLimitedWatchlist();
      }
    } catch (err) {
      console.error("[Sniper] Error polling limited items:", err);
    }
  }

  private async fetchRolimonsItemRAP(
    itemId: number,
  ): Promise<{ rap: number; value: number } | null> {
    try {
      const response = await fetch(
        `https://api.rolimons.com/items/v2/itemdetails?ids=${itemId}`,
      );

      if (!response.ok) {
        console.warn(
          `[Sniper] Rolimons API error for item ${itemId}: ${response.status}`,
        );
        return null;
      }

      const data = await response.json();

      if (!data.success || !data.items) {
        console.warn(`[Sniper] Invalid Rolimons response for item ${itemId}`);
        return null;
      }

      const itemData = data.items[itemId.toString()];
      if (!itemData || !Array.isArray(itemData)) {
        console.warn(`[Sniper] No item data for ${itemId}`);
        return null;
      }

      const rap = itemData[2] || 0;
      let value = itemData[3];

      if (value === -1 || value === undefined || value === null) {
        console.log(
          `[Sniper] Value is -1 for item ${itemId}, fetching latest resale price...`,
        );
        try {
          const resaleResponse = await fetch(
            `https://api.roblox.com/marketplace/products/${itemId}/details`,
          );
          if (resaleResponse.ok) {
            const resaleData = await resaleResponse.json();
            if (
              resaleData &&
              resaleData.lowestResalePrice !== null &&
              resaleData.lowestResalePrice !== undefined
            ) {
              value = resaleData.lowestResalePrice;
              console.log(
                `[Sniper] Got lowest resale price for ${itemId}: ${value}`,
              );
            }
          }
        } catch (err) {
          console.warn(
            `[Sniper] Failed to fetch resale price for item ${itemId}:`,
            err,
          );
          value = rap;
        }
      }

      return {
        rap: rap || 0,
        value: value || 0,
      };
    } catch (err) {
      console.warn(
        `[Sniper] Failed to fetch Rolimons data for item ${itemId}:`,
        err,
      );
      return null;
    }
  }

  getLimitedItemWatches(): LimitedItemWatch[] {
    return Array.from(this.limitedItemWatches.values());
  }

  updateLimitedItemWatch(
    itemId: number,
    updates: Partial<LimitedItemWatch>,
  ): void {
    const watch = this.limitedItemWatches.get(itemId);
    if (!watch) return;

    Object.assign(watch, updates);
    this.saveLimitedWatchlist();
    this.emit("limited-item-updated", watch);
  }

  private async pollItems(): Promise<void> {
    try {
      const deals = await this.fetchRolimonsDeals();

      if (!deals || deals.length === 0) {
        return;
      }

      for (const deal of deals) {
        const item: SniperItem = {
          id: deal.item_id,
          name: deal.item_name || `Item ${deal.item_id}`,
          targetId: deal.item_id,
          purchasePrice: deal.price || 0,
          resaleValue: deal.rap || 0,
          profit: 0,
          profitPercent: 0,
          timestamp: Date.now(),
        };

        this.handleItemListing(item);
      }
    } catch (err) {
      console.error("[Sniper] Poll error:", err);
      this.addLog({
        timestamp: Date.now(),
        itemId: 0,
        itemName: "Unknown",
        action: "error",
        reason: String(err),
      });
    }
  }

  private async fetchRolimonsDeals(): Promise<any[]> {
    try {
      const response = await fetch(
        "https://api.rolimons.com/market/v1/dealactivity",
      );

      if (!response.ok) {
        throw new Error(`Rolimons API error: ${response.statusText}`);
      }

      const data = await response.json();

      if (!Array.isArray(data) || data.length === 0) {
        return [];
      }

      const deals = data.slice(0, 10).map((deal: any[]) => ({
        item_id: deal[0],
        timestamp: deal[1],
        seller_id: deal[2],
        price: deal[3],
        rap: deal[4],
      }));

      return deals;
    } catch (err) {
      console.warn("[Sniper] Failed to fetch Rolimons deals:", err);
      return [];
    }
  }

  private handleItemListing(item: SniperItem): void {
    const { profit, profitPercent } = this.calculateProfit(
      item.purchasePrice,
      item.resaleValue,
    );

    item.profit = profit;
    item.profitPercent = profitPercent;

    if (this.shouldBuy(item)) {
      console.log(
        `[Sniper] BUY OPPORTUNITY: ${item.name} - Profit: ${profit} (${profitPercent.toFixed(1)}%)`,
      );

      this.executeBuy(item);
    } else {
      this.addLog({
        timestamp: Date.now(),
        itemId: item.id,
        itemName: item.name,
        action: "monitored",
        profit: profit,
      });
    }

    this.monitoredItems.set(item.id, item);
  }

  shouldBuy(item: SniperItem): boolean {
    if (item.purchasePrice <= 0) {
      return false;
    }

    if (item.purchasePrice > this.config.maxPurchasePrice) {
      return false;
    }

    if (item.profit < this.config.minProfit) {
      return false;
    }

    return true;
  }

  private executeBuy(item: SniperItem): void {
    console.log(`[Sniper] Executing purchase for item ${item.id}...`);

    this.addLog({
      timestamp: Date.now(),
      itemId: item.id,
      itemName: item.name,
      action: "purchased",
      profit: item.profit,
    });

    this.emit("purchase-executed", item);
  }

  private addLog(entry: SniperLogEntry): void {
    this.purchaseHistory.push(entry);

    const MAX_HISTORY = 1000;
    if (this.purchaseHistory.length > MAX_HISTORY) {
      this.purchaseHistory.splice(0, this.purchaseHistory.length - MAX_HISTORY);
    }
    this.emit("log-entry", entry);
  }

  updateConfig(config: Partial<SniperConfig>): void {
    this.config = { ...this.config, ...config };
    this.saveConfig();
    console.log("[Sniper] Config updated:", this.config);
    this.emit("config-updated", this.config);
  }

  getConfig(): SniperConfig {
    return { ...this.config };
  }

  getHistory(limit: number = 100): SniperLogEntry[] {
    return this.purchaseHistory.slice(-limit);
  }

  clearHistory(): void {
    this.purchaseHistory = [];
    console.log("[Sniper] History cleared");
  }

  getMonitoredItems(): SniperItem[] {
    return Array.from(this.monitoredItems.values());
  }

  private saveConfig(): void {
    try {
      writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
    } catch (err) {
      console.error("[Sniper] Failed to save config:", err);
    }
  }

  private loadConfig(): void {
    try {
      if (existsSync(this.configPath)) {
        const data = readFileSync(this.configPath, "utf-8");
        const loaded = JSON.parse(data);
        this.config = { ...this.config, ...loaded };
        console.log("[Sniper] Config loaded");
      }
    } catch (err) {
      console.error("[Sniper] Failed to load config:", err);
    }
  }

  private saveLimitedWatchlist(): void {
    try {
      const watches = Array.from(this.limitedItemWatches.values());
      writeFileSync(
        this.limitedWatchlistPath,
        JSON.stringify(watches, null, 2),
      );
    } catch (err) {
      console.error("[Sniper] Failed to save limited watchlist:", err);
    }
  }

  private loadLimitedWatchlist(): void {
    try {
      if (existsSync(this.limitedWatchlistPath)) {
        const data = readFileSync(this.limitedWatchlistPath, "utf-8");
        const watches = JSON.parse(data) as LimitedItemWatch[];
        for (const watch of watches) {
          this.limitedItemWatches.set(watch.itemId, watch);
        }
        console.log(`[Sniper] Loaded ${watches.length} limited item watches`);
      }
    } catch (err) {
      console.error("[Sniper] Failed to load limited watchlist:", err);
    }
  }

  calculateProfit(
    purchasePrice: number,
    resaleValue: number,
  ): { profit: number; profitPercent: number } {
    const profit = resaleValue - purchasePrice;
    const profitPercent =
      purchasePrice > 0 ? (profit / purchasePrice) * 100 : 0;

    return { profit, profitPercent };
  }

  isMonitoring(): boolean {
    return this.pollingIntervalId !== null;
  }
}

export const sniperService = new SniperService();
