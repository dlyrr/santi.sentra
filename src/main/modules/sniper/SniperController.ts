import { ipcMain, BrowserWindow } from "electron";
import { sniperService, SniperConfig } from "./SniperService";
import usernameSniperService from "./UsernameSniper";

const activeSessions = new Map<string, BrowserWindow>();
const sessionListeners = new Map<
  string,
  {
    valid: (data: any) => void;
    taken: (data: any) => void;
    censored: (data: any) => void;
    progress: (data: any) => void;
    completed: (data: any) => void;
    error: (data: any) => void;
  }
>();

function cleanupSessionListeners(sessionId: string): void {
  const listeners = sessionListeners.get(sessionId);
  if (!listeners) return;

  usernameSniperService.removeListener("valid", listeners.valid);
  usernameSniperService.removeListener("taken", listeners.taken);
  usernameSniperService.removeListener("censored", listeners.censored);
  usernameSniperService.removeListener("progress", listeners.progress);
  usernameSniperService.removeListener("completed", listeners.completed);
  usernameSniperService.removeListener("error", listeners.error);
  sessionListeners.delete(sessionId);
}

export function registerSniperHandlers(): void {
  ipcMain.handle("sniper:start-monitoring", () => {
    sniperService.startMonitoring();
    return { success: true };
  });

  ipcMain.handle("sniper:stop-monitoring", () => {
    sniperService.stopMonitoring();
    return { success: true };
  });

  ipcMain.handle(
    "sniper:update-config",
    (_event, config: Partial<SniperConfig>) => {
      sniperService.updateConfig(config);
      return { success: true, config: sniperService.getConfig() };
    },
  );

  ipcMain.handle("sniper:get-config", () => {
    return { success: true, config: sniperService.getConfig() };
  });

  ipcMain.handle("sniper:get-monitored-items", () => {
    return { success: true, items: sniperService.getMonitoredItems() };
  });

  ipcMain.handle("sniper:get-history", (_event, limit?: number) => {
    return { success: true, history: sniperService.getHistory(limit || 100) };
  });

  ipcMain.handle("sniper:clear-history", () => {
    sniperService.clearHistory();
    return { success: true };
  });

  ipcMain.handle("sniper:is-monitoring", () => {
    return { isMonitoring: sniperService.isMonitoring() };
  });

  ipcMain.handle(
    "sniper:calculate-profit",
    (_event, purchasePrice: number, resaleValue: number) => {
      return {
        success: true,
        ...sniperService.calculateProfit(purchasePrice, resaleValue),
      };
    },
  );

  ipcMain.handle(
    "sniper:add-limited-watch",
    async (
      _event,
      itemId: number,
      itemName: string,
      minProfitPercent?: number,
    ) => {
      try {
        await sniperService.addLimitedItemWatch(
          itemId,
          itemName,
          minProfitPercent,
        );
        return {
          success: true,
          watches: sniperService.getLimitedItemWatches(),
        };
      } catch (err) {
        return { success: false, error: String(err) };
      }
    },
  );

  ipcMain.handle("sniper:remove-limited-watch", (_event, itemId: number) => {
    sniperService.removeLimitedItemWatch(itemId);
    return { success: true, watches: sniperService.getLimitedItemWatches() };
  });

  ipcMain.handle("sniper:get-limited-watches", () => {
    return { success: true, watches: sniperService.getLimitedItemWatches() };
  });

  ipcMain.handle(
    "sniper:update-limited-watch",
    (_event, itemId: number, updates: any) => {
      sniperService.updateLimitedItemWatch(itemId, updates);
      return { success: true, watches: sniperService.getLimitedItemWatches() };
    },
  );

  ipcMain.handle(
    "sniper:createSession",
    async (
      _event,
      usernames: string[],
      proxies: string[] = [],
      loopEnabled: boolean = false,
      loopCount: number = 1,
      checkInterval: number = 200,
    ) => {
      try {
        const sessionId = await usernameSniperService.createSession(
          usernames,
          proxies,
          loopEnabled,
          loopCount,
          checkInterval,
        );
        return { success: true, sessionId };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    },
  );

  ipcMain.handle("sniper:getSession", (_event, sessionId: string) => {
    try {
      const session = usernameSniperService.getSession(sessionId);
      if (!session) {
        return { success: false, error: "Session not found" };
      }
      return { success: true, session };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle("sniper:startSniper", async (_event, sessionId: string) => {
    try {
      const senderWindow = BrowserWindow.fromWebContents(_event.sender);
      if (!senderWindow) {
        return { success: false, error: "Window not found" };
      }

      activeSessions.set(sessionId, senderWindow);

      cleanupSessionListeners(sessionId);

      const forward = (channel: string, data: any): void => {
        if (data?.sessionId !== sessionId) return;
        if (
          senderWindow.isDestroyed() ||
          senderWindow.webContents.isDestroyed()
        ) {
          activeSessions.delete(sessionId);
          cleanupSessionListeners(sessionId);
          usernameSniperService.stopSession(sessionId);
          return;
        }
        senderWindow.webContents.send(channel, data);
      };

      const listeners = {
        valid: (data: any) => forward("sniper:valid", data),
        taken: (data: any) => forward("sniper:taken", data),
        censored: (data: any) => forward("sniper:censored", data),
        progress: (data: any) => forward("sniper:progress", data),
        completed: (data: any) => {
          if (data?.sessionId !== sessionId) return;
          forward("sniper:completed", data);
          activeSessions.delete(sessionId);
          cleanupSessionListeners(sessionId);
        },
        error: (data: any) => forward("sniper:error", data),
      };

      sessionListeners.set(sessionId, listeners);

      usernameSniperService.on("valid", listeners.valid);
      usernameSniperService.on("taken", listeners.taken);
      usernameSniperService.on("censored", listeners.censored);
      usernameSniperService.on("progress", listeners.progress);
      usernameSniperService.on("completed", listeners.completed);
      usernameSniperService.on("error", listeners.error);

      senderWindow.once("closed", () => {
        activeSessions.delete(sessionId);
        cleanupSessionListeners(sessionId);
        usernameSniperService.stopSession(sessionId);
      });

      usernameSniperService.startSniper(sessionId).catch((err) => {
        console.error("Sniper error:", err);
      });
      return { success: true };
    } catch (error) {
      activeSessions.delete(sessionId);
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle("sniper:pauseSession", (_event, sessionId: string) => {
    try {
      usernameSniperService.pauseSession(sessionId);
      cleanupSessionListeners(sessionId);
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle("sniper:stopSession", (_event, sessionId: string) => {
    try {
      usernameSniperService.stopSession(sessionId);
      activeSessions.delete(sessionId);
      cleanupSessionListeners(sessionId);
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle("sniper:clearSession", (_event, sessionId: string) => {
    try {
      usernameSniperService.clearSession(sessionId);
      activeSessions.delete(sessionId);
      cleanupSessionListeners(sessionId);
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle("sniper:getValidUsernames", (_event, sessionId: string) => {
    try {
      const usernames = usernameSniperService.getValidUsernames(sessionId);
      return { success: true, usernames };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });
}
