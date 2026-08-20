import { EventEmitter } from "events";
import { ProcessMonitor } from "../watcher/ProcessMonitor";
import { RobloxGameService } from "./GameService";
import { storageService } from "../system/StorageService";

const POLL_INTERVAL = 1000;
const POLL_START_DELAY = 15000;

export interface GameSession {
  placeId: string;
  name: string;
  thumbnailUrl?: string;
  startedAt: number;
}

export interface GameSessionEvents {
  "game-started": (session: GameSession) => void;
  "game-ended": (session: GameSession) => void;
}

class GameSessionService extends EventEmitter {
  private currentSession: GameSession | null = null;
  private pollingInterval: NodeJS.Timeout | null = null;
  private pollingTimeout: NodeJS.Timeout | null = null;

  private pollGeneration = 0;

  getCurrentSession(): GameSession | null {
    return this.currentSession;
  }

  async startSession(placeId: string | number): Promise<void> {
    const placeIdStr = String(placeId);

    let name = `Game ${placeIdStr}`;
    let thumbnailUrl: string | undefined;

    try {
      const accounts = storageService.getAccounts();
      const accountWithCookie = accounts.find(
        (acc) => acc.cookie && acc.cookie.length > 0,
      );
      const cookie = accountWithCookie ? accountWithCookie.cookie : undefined;

      const games = await RobloxGameService.getGamesByPlaceIds(
        [placeIdStr],
        cookie,
      );
      if (games && games.length > 0) {
        name = games[0].name;
        const universeId = parseInt(games[0].universeId);
        try {
          thumbnailUrl =
            (await RobloxGameService.getGameIconThumbnail(universeId)) ??
            undefined;
        } catch {}
      }
    } catch (error) {
      console.error("[GameSession] Failed to fetch game details:", error);
    }

    this.currentSession = {
      placeId: placeIdStr,
      name,
      thumbnailUrl,
      startedAt: Date.now(),
    };

    console.log("[GameSession] Started:", name);
    this.emit("game-started", this.currentSession);
    this.startPolling();
  }

  endSession(): void {
    if (this.currentSession) {
      console.log("[GameSession] Ended:", this.currentSession.name);
      this.emit("game-ended", this.currentSession);
      this.currentSession = null;
    }
    this.stopPolling();
  }

  private async getRobloxProcessCount(): Promise<number> {
    try {
      const robloxSettings = storageService.getRobloxSettings();
      const useFullList = !!robloxSettings.headlessModeEnabled;
      const pids = useFullList
        ? await ProcessMonitor.getRobloxProcessPids()
        : await ProcessMonitor.getInteractiveRobloxProcessPids();
      return pids.length;
    } catch {
      return 0;
    }
  }

  private startPolling(): void {
    this.stopPolling();
    const generation = ++this.pollGeneration;

    this.pollingTimeout = setTimeout(() => {
      if (!this.currentSession || generation !== this.pollGeneration) return;

      const pollLoop = async () => {
        if (!this.currentSession || generation !== this.pollGeneration) return;

        try {
          const count = await this.getRobloxProcessCount();

          if (generation !== this.pollGeneration) return;
          if (count === 0) {
            this.endSession();
            return;
          }
        } catch (error) {
          console.error("[GameSession] Polling error:", error);
        }

        if (this.currentSession && generation === this.pollGeneration) {
          this.pollingTimeout = setTimeout(pollLoop, POLL_INTERVAL);
        }
      };

      pollLoop();
    }, POLL_START_DELAY);
  }

  private stopPolling(): void {
    this.pollGeneration++;
    if (this.pollingTimeout) {
      clearTimeout(this.pollingTimeout);
      this.pollingTimeout = null;
    }
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  destroy(): void {
    this.stopPolling();
    this.currentSession = null;
  }
}

export const gameSessionService = new GameSessionService();
