import { dialog, BrowserWindow } from "electron";
import path from "path";
import { getDataFile } from "../../utils/paths";
import { z } from "zod";
import { handle } from "../core/utils/handle";
import { RobloxInstallService } from "./InstallService";
import { AccountBackupService } from "../backup/BackupService";

/*
    Installing a build is handled natively now, by the shared roblox-deploy
    crate — get-deploy-history, install-roblox-version, verify-roblox-files and
    check-for-updates are all answered before they ever reach this process, so
    registering them here would only be a second implementation waiting to
    drift. What is left is the part that was never about downloading.
*/
export const registerInstallHandlers = (): void => {


  handle(
    "launch-roblox-install",
    z.tuple([z.string()]),
    async (_, installPath) => {
      return RobloxInstallService.launch(installPath);
    },
  );

  handle(
    "uninstall-roblox-version",
    z.tuple([z.string()]),
    async (_, installPath) => {
      return RobloxInstallService.uninstall(installPath);
    },
  );

  handle(
    "open-roblox-folder",
    z.tuple([z.string()]),
    async (_, installPath) => {
      return RobloxInstallService.openFolder(installPath);
    },
  );



  handle("get-fflags", z.tuple([z.string()]), async (_, installPath) => {
    return RobloxInstallService.getFFlags(installPath);
  });

  handle(
    "set-fflags",
    z.tuple([z.string(), z.record(z.string(), z.unknown())]),
    async (_, installPath, flags) => {
      return RobloxInstallService.setFFlags(installPath, flags);
    },
  );

  handle(
    "install-font",
    z.tuple([z.string(), z.string()]),
    async (_, installPath, fontPath) => {
      return RobloxInstallService.installFont(installPath, fontPath);
    },
  );

  handle(
    "install-cursor",
    z.tuple([z.string(), z.string()]),
    async (_, installPath, cursorPath) => {
      return RobloxInstallService.installCursor(installPath, cursorPath);
    },
  );

  handle(
    "set-active-install",
    z.tuple([z.string()]),
    async (_, installPath) => {
      return RobloxInstallService.setActive(installPath);
    },
  );

  handle("remove-active-install", z.tuple([]), async () => {
    return RobloxInstallService.removeActive();
  });

  handle("get-active-install-path", z.tuple([]), async () => {
    return RobloxInstallService.getActiveInstallPath();
  });

  handle("detect-default-installations", z.tuple([]), async () => {
    return RobloxInstallService.detectDefaultInstallations();
  });

  handle(
    "create-backup",
    z.tuple([z.array(z.unknown()), z.string(), z.string().optional()]),
    async (_, accounts, backupPin, savePath) => {
      return AccountBackupService.createBackup(
        accounts,
        backupPin,
        savePath || undefined,
      );
    },
  );

  handle("choose-backup-location", z.tuple([]), async (event) => {
    const ownerWindow = BrowserWindow.fromWebContents(event.sender);
    const defaultName = `sentra-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.bak`;
    const options: Electron.SaveDialogOptions = {
      defaultPath: defaultName,
      filters: [
        { name: "Sentra Backup", extensions: ["bak"] },
        { name: "All Files", extensions: ["*"] },
      ],
    };
    const result = ownerWindow
      ? await dialog.showSaveDialog(ownerWindow, options)
      : await dialog.showSaveDialog(options);
    if (result.canceled || !result.filePath) {
      throw new Error("Save dialog canceled");
    }
    return result.filePath;
  });

  handle(
    "restore-backup",
    z.tuple([z.string(), z.string()]),
    async (_, filepath, backupPin) => {
      return AccountBackupService.restoreBackup(filepath, backupPin);
    },
  );

  handle("select-installation-directory", z.tuple([]), async (event) => {
    const ownerWindow = BrowserWindow.fromWebContents(event.sender);
    const options: Electron.OpenDialogOptions = {
      properties: ["openDirectory"],
    };
    const result = ownerWindow
      ? await dialog.showOpenDialog(ownerWindow, options)
      : await dialog.showOpenDialog(options);
    if (result.canceled || !result.filePaths[0]) {
      throw new Error("Directory selection canceled");
    }
    return result.filePaths[0];
  });

  handle("pick-backup-file", z.tuple([]), async (event) => {
    const ownerWindow = BrowserWindow.fromWebContents(event.sender);
    const options: Electron.OpenDialogOptions = {
      filters: [
        { name: "Sentra Backup", extensions: ["bak"] },
        { name: "All Files", extensions: ["*"] },
      ],
      properties: ["openFile"],
    };

    const result = ownerWindow
      ? await dialog.showOpenDialog(ownerWindow, options)
      : await dialog.showOpenDialog(options);

    if (result.canceled) {
      throw new Error("File selection canceled");
    }

    return result.filePaths[0];
  });
};
