import { WatcherSession, SessionStatus, LaunchConfig } from "./types";
import { randomUUID } from "crypto";

export class SessionManager {
  private sessions: Map<string, WatcherSession> = new Map();
  private sessionsByPid: Map<number, string> = new Map();
  private sessionsByAccountId: Map<string, string> = new Map();

  createSession(
    accountId: string,
    username: string,
    userId: string,
    pid: number,
    placeId: number,
    logFile: string,
    launchConfig?: LaunchConfig,
    jobId?: string,
    friendId?: string,
    displayName?: string,
    avatarUrl?: string,
  ): WatcherSession {
    const existingSession = this.getSessionByAccountId(accountId);
    if (existingSession) {
      console.warn(
        `[SessionManager] Existing session for account ${accountId} found; removing stale session before creating a new one.`,
      );
      this.removeSession(existingSession.id);
    }

    const sessionId = randomUUID();

    const session: WatcherSession = {
      id: sessionId,
      accountId,
      username,
      displayName: displayName || username,
      userId,
      avatarUrl,
      placeId,
      jobId,
      friendId,
      pid,
      logFile,
      lastLogSize: 0,
      lastUpdate: Date.now(),
      lastStartTime: Date.now(),
      ramCleanupFailureCount: 0,
      status: "running",
      restartCount: 0,
      restartAttempts: 0,
      lastRestartTime: undefined,
      launchConfig,
    };

    this.sessions.set(sessionId, session);
    this.sessionsByPid.set(pid, sessionId);
    this.sessionsByAccountId.set(accountId, sessionId);

    return session;
  }

  getSessionById(sessionId: string): WatcherSession | undefined {
    return this.sessions.get(sessionId);
  }

  getSessionByPid(pid: number): WatcherSession | undefined {
    const sessionId = this.sessionsByPid.get(pid);
    return sessionId ? this.sessions.get(sessionId) : undefined;
  }

  getSessionByAccountId(accountId: string): WatcherSession | undefined {
    const sessionId = this.sessionsByAccountId.get(accountId);
    return sessionId ? this.sessions.get(sessionId) : undefined;
  }

  getAllSessions(): WatcherSession[] {
    return Array.from(this.sessions.values());
  }

  updateSessionStatus(sessionId: string, status: SessionStatus): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.status = status;
      session.lastUpdate = Date.now();

      if (status === "crashed") {
        session.lastCrashTime = Date.now();
      }
    }
  }

  updateLastRestartTime(sessionId: string, timestamp: number): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastRestartTime = timestamp;
      session.lastUpdate = Date.now();
    }
  }

  updateLastStartTime(sessionId: string, timestamp?: number): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastStartTime = timestamp || Date.now();
      session.lastUpdate = Date.now();
    }
  }

  updateLogSize(sessionId: string, newSize: number): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastLogSize = newSize;
      session.lastUpdate = Date.now();
    }
  }

  incrementRestartCount(sessionId: string): number {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.restartCount++;
      return session.restartCount;
    }
    return 0;
  }

  incrementRestartAttempts(sessionId: string): number {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.restartAttempts++;
      return session.restartAttempts;
    }
    return 0;
  }

  resetRestartAttempts(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.restartAttempts = 0;
    }
  }

  updateLastCrashReason(sessionId: string, reason: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastCrashReason = reason;
      session.lastCrashTime = Date.now();
      session.lastUpdate = Date.now();
    }
  }

  updateSessionPid(sessionId: string, newPid: number): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      this.sessionsByPid.delete(session.pid);

      session.pid = newPid;

      this.sessionsByPid.set(newPid, sessionId);
    }
  }

  updateSessionLogFile(sessionId: string, logFile: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.logFile = logFile;
      session.lastLogSize = 0;
      session.lastUpdate = Date.now();
    }
  }

  removeSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      this.sessionsByPid.delete(session.pid);
      const currentAccountSessionId = this.sessionsByAccountId.get(
        session.accountId,
      );
      if (currentAccountSessionId === sessionId) {
        this.sessionsByAccountId.delete(session.accountId);
      }
      this.sessions.delete(sessionId);
    }
  }

  removeSessionByPid(pid: number): void {
    const sessionId = this.sessionsByPid.get(pid);
    if (sessionId) {
      this.removeSession(sessionId);
    }
  }

  removeSessionByAccountId(accountId: string): void {
    const sessionId = this.sessionsByAccountId.get(accountId);
    if (sessionId) {
      this.removeSession(sessionId);
    }
  }

  clearAllSessions(): void {
    this.sessions.clear();
    this.sessionsByPid.clear();
    this.sessionsByAccountId.clear();
  }

  getSessionCount(): number {
    return this.sessions.size;
  }

  hasSessionForAccount(accountId: string): boolean {
    return this.sessionsByAccountId.has(accountId);
  }
}

export const sessionManager = new SessionManager();
