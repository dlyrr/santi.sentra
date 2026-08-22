import { DiscordRPCClient } from "@ryuziii/discord-rpc";
import path from "path";
import * as fs from "fs";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { getDataFile } from "../../utils/paths";
import { gameSessionService, GameSession } from "../games/GameSessionService";
import { storageService } from "../system/StorageService";

const DiscordRPC = require("discord-rpc");

const CLIENT_ID = "1466214661786439863";

export type DiscordStatusMode = "full" | "playing" | "accounts" | "minimal";

export interface DiscordPresenceState {
  isEnabled: boolean;
  isConnected: boolean;
  currentGame: {
    name: string;
    placeId: string;
    thumbnailUrl?: string;
  } | null;
  currentTab: string | null;
  statusMode: DiscordStatusMode;
  customStatusText: string | null;
  accountCount: number;
}

interface DiscordRPCSettings {
  enabled: boolean;
  statusMode?: DiscordStatusMode;
  customStatusText?: string | null;
}

const TAB_DISPLAY: Record<string, { details: string; state: string }> = {
  Accounts: { details: "Managing Accounts", state: "Account Manager" },
  Profile: { details: "Viewing a Profile", state: "Profile Viewer" },
  Friends: { details: "Browsing Friends", state: "Social Hub" },
  Groups: { details: "Exploring Groups", state: "Group Explorer" },
  Games: { details: "Discovering Games", state: "Game Browser" },
  Catalog: { details: "Shopping the Catalog", state: "Catalog Browser" },
  Inventory: { details: "Browsing Inventory", state: "Inventory Viewer" },
  Transactions: {
    details: "Checking Transactions",
    state: "Transaction History",
  },
  Logs: { details: "Reading Logs", state: "Log Viewer" },
  Settings: { details: "Configuring Settings", state: "Settings Panel" },
  Avatar: { details: "Customizing Avatar", state: "Avatar Editor" },
  Install: { details: "Managing Installations", state: "Install Manager" },
  News: { details: "Reading the News", state: "News Feed" },
  AccountSettings: {
    details: "Tweaking Account Settings",
    state: "Account Config",
  },
  Watcher: { details: "Watching Sessions", state: "Session Watcher" },
  Sniper: { details: "Sniping Usernames", state: "Username Sniper" },
  Trades: { details: "Managing Trades", state: "Trade Manager" },
  Analytics: { details: "Viewing Analytics", state: "Analytics Dashboard" },
  Generator: { details: "Generating Accounts", state: "Account Generator" },
  Backups: { details: "Managing Backups", state: "Backup Manager" },
  Market: { details: "Browsing the Market", state: "Market Explorer" },
  Support: { details: "Getting Support", state: "Support Hub" },
  Debug: { details: "Debugging the App", state: "Debug Panel" },
};

class DiscordRPCService {
  private client: DiscordRPCClient | null = null;
  private isEnabled: boolean = false;
  private isConnected: boolean = false;
  private currentGame: DiscordPresenceState["currentGame"] = null;
  private currentTab: string | null = null;
  private statusMode: DiscordStatusMode = "full";
  private customStatusText: string | null = null;
  private startTimestamp: number | null = null;
  private appStartTimestamp: number = Date.now();
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private updateTimeout: NodeJS.Timeout | null = null;
  private settingsPath: string;

  constructor() {
    this.settingsPath = getDataFile("discord-rpc-settings.json");
    this.loadSettings();
    this.subscribeToGameSession();

    if (this.isEnabled) {
      setTimeout(() => {
        this.connect().catch((error) => {
          console.error("[DiscordRPC] Auto-connect failed:", error);
        });
      }, 3000);
    }
  }

  private subscribeToGameSession(): void {
    gameSessionService.on("game-started", (session: GameSession) => {
      this.setCurrentGame({
        name: session.name,
        placeId: session.placeId,
        thumbnailUrl: session.thumbnailUrl,
      });
    });

    gameSessionService.on("game-ended", () => {
      this.clearCurrentGame();
    });
  }

  private loadSettings(): void {
    try {
      if (existsSync(this.settingsPath)) {
        const data = readFileSync(this.settingsPath, "utf-8");
        const settings: DiscordRPCSettings = JSON.parse(data);
        this.isEnabled = settings.enabled ?? true;

        const raw = settings.statusMode as string;
        if (raw === "detailed") this.statusMode = "full";
        else if (raw === "game-only") this.statusMode = "playing";
        else if (raw === "idle") this.statusMode = "minimal";
        else if (raw === "stealth") this.statusMode = "minimal";
        else if (["full", "playing", "accounts", "minimal"].includes(raw)) {
          this.statusMode = raw as DiscordStatusMode;
        } else {
          this.statusMode = "full";
        }
        this.customStatusText = settings.customStatusText ?? null;
      } else {
        this.isEnabled = true;
        this.statusMode = "full";
        this.customStatusText = null;
      }
    } catch (error) {
      console.error("[DiscordRPC] Failed to load settings:", error);
      this.isEnabled = true;
      this.statusMode = "full";
      this.customStatusText = null;
    }
  }

  private saveSettings(): void {
    try {
      const dir = path.dirname(this.settingsPath);
      if (!existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const settings: DiscordRPCSettings = {
        enabled: this.isEnabled,
        statusMode: this.statusMode,
        customStatusText: this.customStatusText,
      };
      writeFileSync(this.settingsPath, JSON.stringify(settings, null, 2));
    } catch (error) {
      console.error("[DiscordRPC] Failed to save settings:", error);
    }
  }

  async enable(): Promise<boolean> {
    if (this.isEnabled && this.isConnected) return true;
    this.isEnabled = true;
    this.saveSettings();
    try {
      await this.connect();
      return true;
    } catch (error) {
      console.error("[DiscordRPC] Failed to enable:", error);
      this.isEnabled = false;
      this.saveSettings();
      return false;
    }
  }

  async disable(): Promise<void> {
    this.isEnabled = false;
    this.saveSettings();
    this.currentGame = null;
    this.currentTab = null;
    this.startTimestamp = null;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.updateTimeout) {
      clearTimeout(this.updateTimeout);
      this.updateTimeout = null;
    }
    await this.disconnect();
    this.currentGame = null;
    this.currentTab = null;
  }

  async destroy(): Promise<void> {
    if (this.client) this.client.removeAllListeners();
    gameSessionService.removeAllListeners("game-started");
    gameSessionService.removeAllListeners("game-ended");
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.updateTimeout) {
      clearTimeout(this.updateTimeout);
      this.updateTimeout = null;
    }
    await this.disable();
  }

  private async connect(): Promise<void> {
    if (this.client) await this.disconnect();
    this.client = new DiscordRPC.Client({ transport: "ipc" });

    this.client.on("ready", () => {
      console.log("[DiscordRPC] Connected to Discord");
      this.isConnected = true;
      this.updatePresence();
    });

    this.client.on("disconnected", () => {
      console.log("[DiscordRPC] Disconnected from Discord");
      this.isConnected = false;
      this.scheduleReconnect();
    });

    this.client.on("error", (error: Error & { code?: string }) => {
      console.error("[DiscordRPC] Error:", error);
      this.isConnected = false;
      this.scheduleReconnect();
    });

    try {
      await this.client.login({ clientId: CLIENT_ID });
    } catch (error: any) {
      console.error("[DiscordRPC] Connection failed:", error);
      this.isConnected = false;
      throw error;
    }
  }

  private async disconnect(): Promise<void> {
    if (this.client) {
      try {
        await this.client.clearActivity();
        this.client.destroy();
      } catch (error) {
        console.error("[DiscordRPC] Disconnect error:", error);
      }
      this.client = null;
    }
    this.isConnected = false;
  }

  private scheduleReconnect(): void {
    if (!this.isEnabled || this.reconnectTimeout) return;
    this.reconnectTimeout = setTimeout(async () => {
      this.reconnectTimeout = null;
      if (this.isEnabled && !this.isConnected) {
        console.log("[DiscordRPC] Attempting to reconnect...");
        try {
          await this.connect();
        } catch (error) {
          console.error("[DiscordRPC] Reconnection failed:", error);
          this.scheduleReconnect();
        }
      }
    }, 10000);
  }

  setCurrentTab(tabId: string | null): void {
    this.currentTab = tabId;
    if (!this.currentGame) this.updatePresence();
  }

  setStatusMode(mode: DiscordStatusMode): void {
    this.statusMode = mode;
    this.saveSettings();
    this.updatePresence();
  }

  setCustomStatusText(text: string | null): void {
    this.customStatusText = text && text.trim().length > 0 ? text.trim() : null;
    this.saveSettings();
    this.updatePresence();
  }

  private setCurrentGame(game: {
    name: string;
    placeId: string;
    thumbnailUrl?: string;
  }): void {
    this.currentGame = game;
    this.startTimestamp = Date.now();
    console.log("[DiscordRPC] Now playing:", game.name);
    this.updatePresence();
  }

  private clearCurrentGame(): void {
    if (this.currentGame) {
      console.log("[DiscordRPC] Clearing game activity");
      this.currentGame = null;
      this.startTimestamp = null;
      this.updatePresence();
    }
  }

  private updatePresence(): void {
    if (!this.client || !this.isConnected || !this.isEnabled) return;
    if (this.updateTimeout) clearTimeout(this.updateTimeout);
    this.updateTimeout = setTimeout(() => {
      this.updateTimeout = null;
      this.doUpdatePresence();
    }, 500);
  }

  private async doUpdatePresence(): Promise<void> {
    if (!this.client || !this.isConnected || !this.isEnabled) return;

    try {
      const accountCount = storageService.getAccounts()?.length || 0;

      if (this.currentGame) {
        const gameName = this.currentGame.name;

        let details: string;
        let state: string;

        if (this.customStatusText) {
          details = this.customStatusText;
          state = gameName;
        } else if (this.statusMode === "accounts") {
          details =
            accountCount === 1
              ? "Playing with 1 account"
              : `Playing with ${accountCount} accounts`;
          state = gameName;
        } else if (this.statusMode === "minimal") {
          details = "In a Roblox game";
          state = gameName;
        } else {
          details = gameName;
          state =
            accountCount > 1
              ? `Running ${accountCount} accounts`
              : "Launched with Sentra";
        }

        const activity: any = {
          details,
          state,
          startTimestamp: this.startTimestamp ?? Date.now(),

          largeImageKey: this.currentGame.thumbnailUrl || "sentra_icon",
          largeImageText: gameName,
          smallImageKey: "sentra_icon",
          smallImageText: "santi.manager",
          buttons: [
            {
              label: "View Game Page",
              url: `https://www.roblox.com/games/${this.currentGame.placeId}`,
            },
          ],
        };

        console.log("[DiscordRPC] Setting game activity:", gameName);
        await this.client.setActivity(activity);
      } else {
        let details: string;
        let state: string;

        if (this.customStatusText) {
          details = this.customStatusText;
          state =
            accountCount > 0 ? `${accountCount} accounts loaded` : "santi.manager";
        } else if (this.statusMode === "accounts") {
          details =
            accountCount === 1
              ? "Managing 1 account"
              : `Managing ${accountCount} accounts`;
          state = "Roblox Account Manager";
        } else if (this.statusMode === "minimal") {
          details = "santi.manager";
          state = "Roblox Multi-Tool";
        } else if (this.statusMode === "playing") {
          details = "In the Launcher";
          state =
            accountCount > 0 ? `${accountCount} accounts loaded` : "santi.manager";
        } else {
          const tabInfo = this.currentTab ? TAB_DISPLAY[this.currentTab] : null;
          details = tabInfo?.details ?? "In the Launcher";
          state = tabInfo?.state ?? "santi.manager";
        }

        const activity: any = {
          details,
          state,
          startTimestamp: this.appStartTimestamp,
          largeImageKey: "sentra_icon",
          largeImageText: "santi.manager",
        };

        await this.client.setActivity(activity);
      }
    } catch (error) {
      console.error("[DiscordRPC] Failed to update presence:", error);
    }
  }

  getState(): DiscordPresenceState {
    const accountCount = storageService.getAccounts()?.length || 0;
    return {
      isEnabled: this.isEnabled,
      isConnected: this.isConnected,
      currentGame: this.currentGame,
      currentTab: this.currentTab,
      statusMode: this.statusMode,
      customStatusText: this.customStatusText,
      accountCount,
    };
  }

  getIsEnabled(): boolean {
    return this.isEnabled;
  }
  getStatusMode(): DiscordStatusMode {
    return this.statusMode;
  }
  getCustomStatusText(): string | null {
    return this.customStatusText;
  }
}

export const discordRPCService = new DiscordRPCService();
