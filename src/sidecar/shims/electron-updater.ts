/**
 * Stand-in for `electron-updater`.
 *
 * Auto-update is a shell concern, and the shell is now Tauri: signed release
 * artifacts, the update manifest and the install-on-quit step all belong to
 * `tauri-plugin-updater`, which has no Electron equivalent to wrap.
 *
 * This keeps `UpdaterService` loading and its channels answering — the UI's
 * update panel renders "no update available" instead of erroring — while the
 * real implementation moves to the Rust side. It is deliberately inert rather
 * than pretending to update: silently doing nothing under a working-looking API
 * is how users end up stranded on an old build.
 *
 * See MIGRATION.md, "Auto-update", for what replacing this involves.
 */

import { EventEmitter } from "node:events";

export interface UpdateInfo {
  version: string;
  releaseDate?: string;
  releaseNotes?: string | null;
}

export interface ProgressInfo {
  percent: number;
  transferred: number;
  total: number;
  bytesPerSecond: number;
}

class InertAutoUpdater extends EventEmitter {
  logger: unknown = null;
  autoDownload = false;
  autoInstallOnAppQuit = true;
  channel: string | null = null;

  setFeedURL(_options: unknown): void {
    // No feed to set: releases are served through the Tauri updater manifest.
  }

  async checkForUpdates(): Promise<null> {
    // Report "checked, nothing found" so the UI settles rather than spinning.
    this.emit("checking-for-update");
    this.emit("update-not-available", { version: "0.0.0" });
    return null;
  }

  async checkForUpdatesAndNotify(): Promise<null> {
    return this.checkForUpdates();
  }

  async downloadUpdate(): Promise<string[]> {
    const error = new Error(
      "Downloading updates is handled by the Tauri updater, not the sidecar.",
    );
    this.emit("error", error);
    throw error;
  }

  quitAndInstall(_isSilent?: boolean, _isForceRunAfter?: boolean): void {
    throw new Error(
      "quitAndInstall is handled by the Tauri updater, not the sidecar.",
    );
  }
}

export const autoUpdater = new InertAutoUpdater();

export default { autoUpdater };
