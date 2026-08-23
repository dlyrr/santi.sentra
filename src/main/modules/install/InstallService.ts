import { shell, app } from "electron";
import fs from "fs";
import path from "path";
import os from "os";
import { spawn } from "child_process";
import { safeFetchText } from "@main/lib/request";
import { fflagsSchema } from "@shared/ipc-schemas/system";
import { deployHistorySchema } from "@shared/ipc-schemas/user";

export interface DetectedInstallation {
  path: string;
  version: string;
  binaryType: "WindowsPlayer" | "WindowsStudio" | "MacPlayer" | "MacStudio";
  exePath: string;
}


interface BinaryTypeConfig {
  blobDir: string;
  aliases: string[];
}

const BINARY_TYPES: Record<string, BinaryTypeConfig> = {
  WindowsPlayer: { blobDir: "/", aliases: ["WindowsPlayer"] },
  WindowsStudio64: { blobDir: "/", aliases: ["Studio64", "WindowsStudio64"] },
  MacPlayer: { blobDir: "/mac/", aliases: ["MacPlayer"] },
  MacStudio: { blobDir: "/mac/", aliases: ["MacStudio"] },
};

const ALIAS_TO_TYPE: Record<string, string> = {};
for (const [typ, obj] of Object.entries(BINARY_TYPES)) {
  for (const alias of obj.aliases) {
    ALIAS_TO_TYPE[alias] = typ;
  }
}

const getClientSettingsPaths = (
  installPath: string,
): { dir: string; file: string } => {
  if (process.platform === "darwin") {
    const dir = path.join(
      os.homedir(),
      "Library",
      "Application Support",
      "Roblox",
      "ClientSettings",
    );
    return { dir, file: path.join(dir, "ClientAppSettings.json") };
  }

  const dir = path.join(installPath, "ClientSettings");
  return { dir, file: path.join(dir, "ClientAppSettings.json") };
};

const readMacBundleVersion = (bundlePath: string): string | null => {
  try {
    const infoPlistPath = path.join(bundlePath, "Contents", "Info.plist");
    if (!fs.existsSync(infoPlistPath)) return null;
    const plist = fs.readFileSync(infoPlistPath, "utf8");
    const match = plist.match(
      /<key>CFBundleShortVersionString<\/key>\s*<string>(?<ver>[^<]+)<\/string>/i,
    );
    return match?.groups?.ver?.trim() || null;
  } catch (e) {
    console.warn(
      "[RobloxInstallService] Failed to read mac bundle version:",
      e,
    );
    return null;
  }
};

/**
 * What is left of the Roblox installer here.
 *
 * Downloading and unpacking a build now happens natively, in the shared
 * roblox-deploy crate that santi.weblauncher also installs from — this file
 * carried a second implementation of it, and the two drifted. What remains is
 * everything that is not the download: launching, FFlags, fonts and cursors,
 * and finding installs that already exist on disk.
 */
export class RobloxInstallService {
  static async launch(installPath: string): Promise<void> {
    if (process.platform === "darwin") {
      let appPath = "";

      if (installPath.endsWith(".app") && fs.existsSync(installPath)) {
        appPath = installPath;
      } else {
        const playerApp = path.join(installPath, "RobloxPlayer.app");
        const studioApp = path.join(installPath, "RobloxStudio.app");

        if (fs.existsSync(playerApp)) {
          appPath = playerApp;
        } else if (fs.existsSync(studioApp)) {
          appPath = studioApp;
        }
      }

      if (!appPath) {
        throw new Error("Could not find Roblox app bundle in " + installPath);
      }

      const child = spawn("open", [appPath], {
        detached: true,
        stdio: "ignore",
      });
      child.unref();
    } else {
      const playerExe = path.join(installPath, "RobloxPlayerBeta.exe");
      const studioExe = path.join(installPath, "RobloxStudioBeta.exe");

      let exePath = "";
      if (fs.existsSync(playerExe)) {
        exePath = playerExe;
      } else if (fs.existsSync(studioExe)) {
        exePath = studioExe;
      } else {
        throw new Error("Could not find executable in " + installPath);
      }

      const child = spawn(exePath, [], {
        detached: true,
        cwd: installPath,
        stdio: "ignore",
      });
      child.unref();
    }
  }

  static async uninstall(installPath: string): Promise<void> {
    if (fs.existsSync(installPath)) {
      await fs.promises.rm(installPath, { recursive: true, force: true });
    }
  }

  static async openFolder(installPath: string): Promise<void> {
    await shell.openPath(installPath);
  }

  static async getFFlags(installPath: string): Promise<Record<string, any>> {
    const { file: clientSettingsPath } = getClientSettingsPaths(installPath);
    try {
      if (!fs.existsSync(clientSettingsPath)) {
        return {};
      }
      const content = await fs.promises.readFile(clientSettingsPath, "utf8");
      const raw = JSON.parse(content);
      return fflagsSchema.parse(raw);
    } catch (e) {
      console.error("Failed to read FFlags", e);
      return {};
    }
  }

  static async setFFlags(
    installPath: string,
    flags: Record<string, any>,
  ): Promise<void> {
    fflagsSchema.parse(flags);

    const { dir: clientSettingsDir, file: clientSettingsPath } =
      getClientSettingsPaths(installPath);
    try {
      if (!fs.existsSync(clientSettingsDir)) {
        await fs.promises.mkdir(clientSettingsDir, { recursive: true });
      }
      await fs.promises.writeFile(
        clientSettingsPath,
        JSON.stringify(flags, null, 4),
        "utf8",
      );
    } catch (e) {
      console.error("Failed to write FFlags", e);
      throw e;
    }
  }

  static async installFont(
    installPath: string,
    fontPath: string,
  ): Promise<void> {
    if (!fs.existsSync(fontPath)) {
      throw new Error("Font file not found: " + fontPath);
    }

    const fontsDir = path.join(installPath, "content", "fonts");
    if (!fs.existsSync(fontsDir)) {
      if (process.platform === "darwin") {
        const macFontsDir = path.join(
          installPath,
          "Contents",
          "Resources",
          "content",
          "fonts",
        );
        if (fs.existsSync(macFontsDir)) {
          await this.replaceFontsInDir(macFontsDir, fontPath);
          return;
        }
      }
      throw new Error("Roblox fonts directory not found in " + installPath);
    }

    await this.replaceFontsInDir(fontsDir, fontPath);
  }

  private static async replaceFontsInDir(
    fontsDir: string,
    sourceFontPath: string,
  ): Promise<void> {
    const targetFonts = [
      "Arial.ttf",
      "SourceSansPro-Regular.ttf",
      "SourceSansPro-Bold.ttf",
      "SourceSansPro-Light.ttf",
      "SourceSansPro-SemiBold.ttf",
    ];

    for (const target of targetFonts) {
      await fs.promises.copyFile(sourceFontPath, path.join(fontsDir, target));
    }
  }

  static async installCursor(
    installPath: string,
    cursorPath: string,
  ): Promise<void> {
    if (!fs.existsSync(cursorPath)) {
      throw new Error("Cursor file not found: " + cursorPath);
    }

    let cursorDir = path.join(
      installPath,
      "content",
      "textures",
      "Cursors",
      "KeyboardMouse",
    );

    if (process.platform === "darwin") {
      const macCursorDir = path.join(
        installPath,
        "Contents",
        "Resources",
        "content",
        "textures",
        "Cursors",
        "KeyboardMouse",
      );
      if (fs.existsSync(macCursorDir)) {
        cursorDir = macCursorDir;
      }
    }

    if (!fs.existsSync(cursorDir)) {
      throw new Error("Roblox cursor directory not found in " + installPath);
    }

    const targets = ["ArrowCursor.png", "ArrowFarCursor.png"];
    for (const target of targets) {
      await fs.promises.copyFile(cursorPath, path.join(cursorDir, target));
    }
  }

  static async setActive(installPath: string): Promise<void> {
    if (process.platform === "darwin") {
      console.log(
        "[RobloxInstallService] setActive is not supported on macOS - using system Roblox",
      );
      return;
    }

    const playerExe = path.join(installPath, "RobloxPlayerBeta.exe");
    if (!fs.existsSync(playerExe)) {
      throw new Error("RobloxPlayerBeta.exe not found in " + installPath);
    }

    const cmds = [
      [
        "add",
        "HKCU\\Software\\Classes\\roblox-player",
        "/ve",
        "/t",
        "REG_SZ",
        "/d",
        "URL: Roblox Protocol",
        "/f",
      ],
      [
        "add",
        "HKCU\\Software\\Classes\\roblox-player",
        "/v",
        "URL Protocol",
        "/t",
        "REG_SZ",
        "/d",
        "",
        "/f",
      ],
      [
        "add",
        "HKCU\\Software\\Classes\\roblox-player\\DefaultIcon",
        "/ve",
        "/t",
        "REG_SZ",
        "/d",
        `${playerExe},0`,
        "/f",
      ],
      [
        "add",
        "HKCU\\Software\\Classes\\roblox-player\\shell\\open\\command",
        "/ve",
        "/t",
        "REG_SZ",
        "/d",
        `"${playerExe}" "%1"`,
        "/f",
      ],
    ];

    for (const args of cmds) {
      await new Promise<void>((resolve, reject) => {
        const child = spawn("reg", args, {
          stdio: "ignore",
          windowsHide: true,
        });
        child.on("close", (code) => {
          if (code === 0) resolve();
          else reject(new Error(`reg command failed with code ${code}`));
        });
        child.on("error", reject);
      });
    }
  }

  static async removeActive(): Promise<void> {
    if (process.platform === "darwin") {
      return;
    }

    const keyPath = "HKCU\\Software\\Classes\\roblox-player";

    return new Promise<void>((resolve) => {
      const child = spawn("reg", ["delete", keyPath, "/f"], {
        stdio: "ignore",
        windowsHide: true,
      });
      child.on("close", (code) => {
        if (code !== 0) {
          console.warn(
            `[RobloxInstallService] Registry delete exited with code ${code}`,
          );
        }
        resolve();
      });
      child.on("error", (err) => {
        console.error("Failed to delete registry key", err);
        resolve();
      });
    });
  }

  static async getActiveInstallPath(): Promise<string | null> {
    if (process.platform === "darwin") {
      return null;
    }

    return new Promise((resolve) => {
      const child = spawn(
        "reg",
        ["query", "HKCU\\Software\\Classes\\roblox-player\\DefaultIcon", "/ve"],
        { windowsHide: true },
      );
      let stdout = "";

      child.stdout.on("data", (data) => {
        stdout += data.toString();
      });

      child.on("close", (code) => {
        if (code !== 0) {
          resolve(null);
          return;
        }

        const match = stdout.match(/REG_SZ\s+([^\r\n]+),0/);
        if (match && match[1]) {
          const exePath = match[1].trim();

          resolve(path.dirname(exePath));
        } else {
          resolve(null);
        }
      });

      child.on("error", (err) => {
        console.error("[RobloxInstallService] Registry query error:", err);
        resolve(null);
      });
    });
  }

  static async launchWithProtocol(
    installPath: string,
    protocolUrl: string,
    options: { no3d?: boolean } = {},
  ): Promise<void> {
    const normalizedPath = installPath?.trim();
    console.log(
      `[InstallService] launchWithProtocol called with path: "${normalizedPath}"`,
    );

    if (process.platform === "darwin") {
      console.log(`[InstallService] macOS detected, using 'open' command`);
      const openArgs: string[] = [];

      if (normalizedPath && fs.existsSync(normalizedPath)) {
        let appPath = normalizedPath.endsWith(".app") ? normalizedPath : "";

        if (!appPath) {
          const playerApp = path.join(normalizedPath, "RobloxPlayer.app");
          const studioApp = path.join(normalizedPath, "RobloxStudio.app");
          const legacyApp = path.join(normalizedPath, "Roblox.app");

          if (fs.existsSync(playerApp)) appPath = playerApp;
          else if (fs.existsSync(studioApp)) appPath = studioApp;
          else if (fs.existsSync(legacyApp)) appPath = legacyApp;
        }

        if (appPath && fs.existsSync(appPath)) {
          console.log(`[InstallService] Using macOS app: ${appPath}`);
          openArgs.push("-a", appPath);
        }
      }

      openArgs.push(protocolUrl);

      const child = spawn("open", openArgs, {
        detached: true,
        stdio: "ignore",
      });
      child.unref();
      console.log(`[InstallService] ✅ macOS spawn executed`);
      return;
    }

    if (!normalizedPath) {
      console.log(
        `[InstallService] No install path provided, using shell.openExternal`,
      );
      try {
        await shell.openExternal(protocolUrl);
        console.log(`[InstallService] ✅ shell.openExternal succeeded`);
        return;
      } catch (err) {
        console.error(`[InstallService] shell.openExternal failed:`, err);
        throw new Error(`Failed to open protocol: ${err}`);
      }
    }

    if (!fs.existsSync(normalizedPath)) {
      console.warn(
        `[InstallService] Install path does not exist: "${normalizedPath}", falling back to shell.openExternal`,
      );
      try {
        await shell.openExternal(protocolUrl);
        console.log(
          `[InstallService] ✅ shell.openExternal succeeded (fallback)`,
        );
        return;
      } catch (err) {
        console.error(
          `[InstallService] shell.openExternal fallback failed:`,
          err,
        );
        throw new Error(
          `Install path invalid and protocol fallback failed: ${err}`,
        );
      }
    }

    const candidateExeNames = [
      "RobloxPlayerBeta.exe",
      "RobloxPlayer.exe",
      "Bloxstrap.exe",
      "RobloxApp.exe",
    ];

    let playerExe: string | null =
      candidateExeNames
        .map((name) => path.join(normalizedPath, name))
        .find((candidate) => {
          const exists = fs.existsSync(candidate);
          if (exists)
            console.log(`[InstallService] Found executable: ${candidate}`);
          return exists;
        }) ?? null;

    if (!playerExe) {
      console.log(
        `[InstallService] No standard executables found, searching directory...`,
      );
      const files = fs.readdirSync(normalizedPath);
      const anyExe = files.find(
        (file) =>
          file.toLowerCase().endsWith(".exe") &&
          (file.toLowerCase().includes("player") ||
            file.toLowerCase().includes("roblox")),
      );
      if (anyExe) {
        playerExe = path.join(normalizedPath, anyExe);
        console.log(`[InstallService] Found fallback executable: ${playerExe}`);
      }
    }

    if (!playerExe) {
      console.error(
        `[InstallService] No Roblox executable found in "${normalizedPath}", trying protocol fallback`,
      );
      try {
        await shell.openExternal(protocolUrl);
        console.log(
          `[InstallService] ✅ shell.openExternal succeeded (no exe fallback)`,
        );
        return;
      } catch (err) {
        console.error(`[InstallService] Protocol fallback also failed:`, err);
        throw new Error(
          `No executable found in ${normalizedPath} and protocol fallback failed: ${err}`,
        );
      }
    }

    const args = options.no3d ? ["-no3d", protocolUrl] : [protocolUrl];
    console.log(
      `[InstallService] Spawning: "${playerExe}" with${options.no3d ? " -no3d and" : ""} protocol URL`,
    );
    const child = spawn(playerExe, args, {
      detached: true,
      cwd: normalizedPath,
      stdio: "ignore",
    });

    child.on("error", (err) => {
      console.error(`[InstallService] ❌ Spawn error for "${playerExe}":`, err);
    });

    child.unref();
    console.log(`[InstallService] ✅ Process spawn succeeded`);
  }

  static async detectDefaultInstallations(): Promise<DetectedInstallation[]> {
    const detected: DetectedInstallation[] = [];

    try {
      console.log(
        `[InstallService] detectDefaultInstallations called on ${process.platform}`,
      );
      if (process.platform === "darwin") {
        const possiblePaths = [
          "/Applications/Roblox.app",
          path.join(os.homedir(), "Applications", "Roblox.app"),
        ];

        for (const robloxAppPath of possiblePaths) {
          if (fs.existsSync(robloxAppPath)) {
            const version = readMacBundleVersion(robloxAppPath) || "system";
            const execPath = path.join(
              robloxAppPath,
              "Contents",
              "MacOS",
              "RobloxPlayer",
            );
            detected.push({
              path: robloxAppPath,
              version,
              binaryType: "MacPlayer",
              exePath: execPath,
            });
            break;
          }
        }
        return detected;
      }

      const robloxVersionsPath = path.join(
        os.homedir(),
        "AppData",
        "Local",
        "Roblox",
        "Versions",
      );

      console.log(
        `[InstallService] Checking Roblox versions path: "${robloxVersionsPath}"`,
      );

      if (!fs.existsSync(robloxVersionsPath)) {
        console.warn(
          `[InstallService] ⚠️ Roblox versions directory not found at "${robloxVersionsPath}"`,
        );
        return detected;
      }

      const entries = await fs.promises.readdir(robloxVersionsPath, {
        withFileTypes: true,
      });

      console.log(
        `[InstallService] Found ${entries.length} entries in Roblox versions directory`,
      );

      for (const entry of entries) {
        if (!entry.isDirectory() || !entry.name.startsWith("version-")) {
          console.log(
            `[InstallService] Skipping non-version entry: "${entry.name}"`,
          );
          continue;
        }

        const versionDir = path.join(robloxVersionsPath, entry.name);
        const versionHash = entry.name.replace("version-", "");

        const playerExe = path.join(versionDir, "RobloxPlayerBeta.exe");
        console.log(
          `[InstallService] Checking for player exe at: "${playerExe}"`,
        );
        if (fs.existsSync(playerExe)) {
          console.log(
            `[InstallService] ✅ Found Roblox Player at: "${playerExe}"`,
          );
          detected.push({
            path: versionDir,
            version: versionHash,
            binaryType: "WindowsPlayer",
            exePath: playerExe,
          });
          continue;
        }

        const studioExe = path.join(versionDir, "RobloxStudioBeta.exe");
        if (fs.existsSync(studioExe)) {
          detected.push({
            path: versionDir,
            version: versionHash,
            binaryType: "WindowsStudio",
            exePath: studioExe,
          });
        }
      }
    } catch (e) {
      console.error(
        "[InstallService] Failed to detect default installations:",
        e,
      );
    }

    detected.sort((a, b) => {
      if (a.binaryType === "WindowsPlayer" && b.binaryType !== "WindowsPlayer")
        return -1;
      if (a.binaryType !== "WindowsPlayer" && b.binaryType === "WindowsPlayer")
        return 1;
      if (a.binaryType === "MacPlayer" && b.binaryType !== "MacPlayer")
        return -1;
      if (a.binaryType !== "MacPlayer" && b.binaryType === "MacPlayer")
        return 1;
      return 0;
    });

    console.log(
      `[InstallService] detectDefaultInstallations returning ${detected.length} installations (sorted by type)`,
      detected.map((d) => `${d.binaryType}:${d.version}`).join(", "),
    );
    return detected;
  }
}
