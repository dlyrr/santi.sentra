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

const AWS_MIRROR = "https://setup-aws.rbxcdn.com";
const DEPLOY_HISTORY_URL_WINDOWS = "https://setup.rbxcdn.com/DeployHistory.txt";
const DEPLOY_HISTORY_URL_MAC = "https://setup.rbxcdn.com/mac/DeployHistory.txt";

const EXTRACT_ROOTS: Record<string, Record<string, string>> = {
  player: {
    "RobloxApp.zip": "",
    "redist.zip": "",
    "shaders.zip": "shaders/",
    "ssl.zip": "ssl/",
    "WebView2.zip": "",
    "WebView2RuntimeInstaller.zip": "WebView2RuntimeInstaller/",
    "content-avatar.zip": "content/avatar/",
    "content-configs.zip": "content/configs/",
    "content-fonts.zip": "content/fonts/",
    "content-sky.zip": "content/sky/",
    "content-sounds.zip": "content/sounds/",
    "content-textures2.zip": "content/textures/",
    "content-models.zip": "content/models/",
    "content-platform-fonts.zip": "PlatformContent/pc/fonts/",
    "content-platform-dictionaries.zip":
      "PlatformContent/pc/shared_compression_dictionaries/",
    "content-terrain.zip": "PlatformContent/pc/terrain/",
    "content-textures3.zip": "PlatformContent/pc/textures/",
    "extracontent-luapackages.zip": "ExtraContent/LuaPackages/",
    "extracontent-translations.zip": "ExtraContent/translations/",
    "extracontent-models.zip": "ExtraContent/models/",
    "extracontent-textures.zip": "ExtraContent/textures/",
    "extracontent-places.zip": "ExtraContent/places/",
  },
  studio: {
    "RobloxStudio.zip": "",
    "RibbonConfig.zip": "RibbonConfig/",
    "redist.zip": "",
    "Libraries.zip": "",
    "LibrariesQt5.zip": "",
    "WebView2.zip": "",
    "WebView2RuntimeInstaller.zip": "",
    "shaders.zip": "shaders/",
    "ssl.zip": "ssl/",
    "Qml.zip": "Qml/",
    "Plugins.zip": "Plugins/",
    "StudioFonts.zip": "StudioFonts/",
    "BuiltInPlugins.zip": "BuiltInPlugins/",
    "ApplicationConfig.zip": "ApplicationConfig/",
    "BuiltInStandalonePlugins.zip": "BuiltInStandalonePlugins/",
    "content-qt_translations.zip": "content/qt_translations/",
    "content-sky.zip": "content/sky/",
    "content-fonts.zip": "content/fonts/",
    "content-avatar.zip": "content/avatar/",
    "content-models.zip": "content/models/",
    "content-sounds.zip": "content/sounds/",
    "content-configs.zip": "content/configs/",
    "content-api-docs.zip": "content/api_docs/",
    "content-textures2.zip": "content/textures/",
    "content-studio_svg_textures.zip": "content/studio_svg_textures/",
    "content-platform-fonts.zip": "PlatformContent/pc/fonts/",
    "content-platform-dictionaries.zip":
      "PlatformContent/pc/shared_compression_dictionaries/",
    "content-terrain.zip": "PlatformContent/pc/terrain/",
    "content-textures3.zip": "PlatformContent/pc/textures/",
    "extracontent-translations.zip": "ExtraContent/translations/",
    "extracontent-luapackages.zip": "ExtraContent/LuaPackages/",
    "extracontent-textures.zip": "ExtraContent/textures/",
    "extracontent-scripts.zip": "ExtraContent/scripts/",
    "extracontent-models.zip": "ExtraContent/models/",
  },
};

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

export class RobloxInstallService {
  private static historyCache: Record<string, string[]> | null = null;
  private static lastHistoryFetch = 0;
  private static readonly CACHE_DURATION = 1000 * 60 * 15;
  private static installationStartTime = 0;

  static async getDeployHistory(
    forceRefresh = false,
  ): Promise<Record<string, string[]>> {
    const now = Date.now();
    if (
      !forceRefresh &&
      this.historyCache &&
      now - this.lastHistoryFetch < this.CACHE_DURATION
    ) {
      return this.historyCache;
    }

    try {
      const types = Object.keys(BINARY_TYPES);
      const results: Record<string, string[]> = {};
      const CHANNELS = ["live", "zflag"];

      await Promise.all(
        types.map(async (typ) => {
          results[typ] = [];
          for (const channel of CHANNELS) {
            try {
              const url = `https://clientsettings.roblox.com/v2/client-version/${typ}/channel/${channel}`;
              const res = await safeFetchText(url);
              const json = JSON.parse(res);

              let hash = json.clientVersionUpload;
              if (hash && hash.startsWith("version-")) {
                hash = hash.replace("version-", "");
              }
              if (hash && !results[typ].includes(hash)) {
                results[typ].push(hash);
              }
            } catch (e) {}
          }
        }),
      );

      const validatedHistory = deployHistorySchema.parse(results);

      this.historyCache = validatedHistory;
      this.lastHistoryFetch = now;

      return validatedHistory;
    } catch (e) {
      console.error("[RobloxInstallService] Failed to fetch deploy history", e);
      return this.historyCache || {};
    }
  }

  static async downloadAndInstall(
    binaryType: string,
    version: string,
    installPath: string,
    onProgress: (status: string, progress: number, detail?: string) => void,
  ): Promise<boolean> {
    if (!BINARY_TYPES[binaryType]) {
      onProgress("Invalid binary type", 0);
      return false;
    }

    this.installationStartTime = Date.now();

    let createdInstallDir = false;

    try {
      const blobDir = BINARY_TYPES[binaryType].blobDir;
      const verTag = version.startsWith("version-")
        ? version
        : `version-${version}`;
      const base = `${AWS_MIRROR}${blobDir}${verTag}-`;

      let pkgs: string[] = [];

      let pkgInfo: Record<
        string,
        { md5: string; packedSize: number; unpackedSize: number }
      > = {};
      const isMac = binaryType.startsWith("Mac");

      if (isMac) {
        pkgs =
          binaryType === "MacPlayer"
            ? ["RobloxPlayer.zip"]
            : ["RobloxStudioApp.zip"];
      } else {
        onProgress("Fetching manifest for version: " + verTag, 0);
        let manifest = "";
        try {
          manifest = await safeFetchText(base + "rbxPkgManifest.txt");
          if (!manifest || manifest.length === 0) {
            throw new Error("Manifest is empty - version may not exist");
          }
        } catch (e: any) {
          const errorMsg = e?.message || String(e);
          console.error(
            `[InstallService] Manifest fetch failed for ${verTag}:`,
            errorMsg,
          );
          onProgress(`Version not found: ${verTag}`, 0, errorMsg);
          return false;
        }

        const manifestLines = manifest.split(/\r?\n/).map((l) => l.trim());
        for (let i = 0; i < manifestLines.length; i++) {
          const line = manifestLines[i];
          if (!line.endsWith(".zip")) continue;
          const md5 = manifestLines[i + 1] || "";
          const packedSize = Number(manifestLines[i + 2]);
          const unpackedSize = Number(manifestLines[i + 3]);
          pkgInfo[line] = {
            md5: /^[a-fA-F0-9]{32}$/.test(md5) ? md5.toLowerCase() : "",
            packedSize: Number.isFinite(packedSize) ? packedSize : 0,
            unpackedSize: Number.isFinite(unpackedSize) ? unpackedSize : 0,
          };
        }
        pkgs = [...new Set(manifestLines.filter((l) => l.endsWith(".zip")))];
      }

      if (pkgs.length === 0) {
        onProgress("No packages found", 0);
        return false;
      }

      let roots: Record<string, string> = {};
      if (!isMac) {
        roots = pkgs.includes("RobloxApp.zip")
          ? EXTRACT_ROOTS["player"]
          : EXTRACT_ROOTS["studio"];
      } else {
        roots = {
          "RobloxPlayer.zip": "",
          "RobloxStudioApp.zip": "",
        };
      }

      if (!fs.existsSync(installPath)) {
        fs.mkdirSync(installPath, { recursive: true });
        createdInstallDir = true;
      }

      const appSettingsPath = path.join(installPath, "AppSettings.xml");
      const appSettingsContent = `<?xml version="1.0" encoding="UTF-8"?>
<Settings>
\t<ContentFolder>content</ContentFolder>
\t<BaseUrl>http:
</Settings>
`;
      fs.writeFileSync(appSettingsPath, appSettingsContent);

      let completed = 0;
      const total = pkgs.length;
      const concurrency = 8;

      completed = 0;
      const queue = [...pkgs];

      const { spawn, move } = await import("multithreading");

      const processPackage = async (pkg: string) => {
        const url = base + pkg;
        const zipPath = path.join(installPath, pkg);
        const rootDir = roots[pkg];

        const info = pkgInfo[pkg];
        const workerData = {
          url,
          zipPath,
          installPath,
          rootDir,
          pkg,
          expectedMd5: info?.md5 || "",
          expectedPackedSize: info?.packedSize || 0,
        };

        return spawn(move(workerData), async (data) => {
          const fs = await import("fs");
          const path = await import("path");
          const { pipeline } = await import("stream");
          const { promisify } = await import("util");
          const https = await import("https");
          const yauzl = await import("yauzl");

          const streamPipeline = promisify(pipeline);

          const downloadFile = (url: string, dest: string): Promise<void> => {
            return new Promise((resolve, reject) => {
              const dir = path.dirname(dest);
              if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

              const file = fs.createWriteStream(dest);
              let settled = false;

              const fail = (err: Error) => {
                if (settled) return;
                settled = true;

                file.close(() => {
                  fs.unlink(dest, () => reject(err));
                });
              };

              const succeed = () => {
                if (settled) return;
                settled = true;
                resolve();
              };

              const request = https.get(url, (response) => {
                if (response.statusCode !== 200) {
                  response.resume();
                  fail(
                    new Error(
                      `Failed to download ${url}: ${response.statusCode}`,
                    ),
                  );
                  return;
                }
                response.on("error", fail);
                response.pipe(file);
                file.on("finish", () => {
                  file.close((closeErr) => {
                    if (closeErr) fail(closeErr);
                    else succeed();
                  });
                });
              });

              file.on("error", fail);
              request.on("error", fail);

              request.setTimeout(60000, () => {
                request.destroy(new Error(`Download timed out: ${url}`));
              });
            });
          };

          const extractZip = (
            zipPath: string,
            extractPath: string,
          ): Promise<void> => {
            const normalizedRoot = path.resolve(extractPath);
            const rootWithSep = normalizedRoot.endsWith(path.sep)
              ? normalizedRoot
              : normalizedRoot + path.sep;

            return new Promise((resolve, reject) => {
              let finished = false;
              const finish = (err?: Error) => {
                if (finished) return;
                finished = true;
                if (err) reject(err);
                else resolve();
              };

              yauzl.open(
                zipPath,
                {
                  lazyEntries: true,

                  validateEntrySizes: true,
                  decodeStrings: false,
                },
                (err, zipFile) => {
                  if (err || !zipFile) {
                    finish(err ?? new Error(`Failed to open zip ${zipPath}`));
                    return;
                  }

                  const openReadStream = (entry: any) =>
                    new Promise<NodeJS.ReadableStream>(
                      (resolveStream, rejectStream) => {
                        zipFile.openReadStream(
                          entry,
                          (streamErr, readStream) => {
                            if (streamErr || !readStream) {
                              rejectStream(
                                streamErr ?? new Error(`Failed to open stream`),
                              );
                            } else {
                              resolveStream(readStream);
                            }
                          },
                        );
                      },
                    );

                  const processEntry = async (entry: any) => {
                    let fileName = entry.fileName;
                    if (Buffer.isBuffer(fileName)) {
                      const isUtf8 =
                        (entry.generalPurposeBitFlag & 0x800) !== 0;
                      fileName = fileName.toString(isUtf8 ? "utf8" : "latin1");
                    }
                    const fileNameStr = fileName as string;
                    const sanitizedName = fileNameStr.replace(/^([/\\])+/, "");
                    if (!sanitizedName) {
                      zipFile.readEntry();
                      return;
                    }

                    const normalizedEntryPath = path.resolve(
                      normalizedRoot,
                      sanitizedName,
                    );
                    if (
                      normalizedEntryPath !== normalizedRoot &&
                      !normalizedEntryPath.startsWith(rootWithSep)
                    ) {
                    } else {
                      if (
                        fileNameStr.endsWith("/") ||
                        fileNameStr.endsWith("\\")
                      ) {
                        await fs.promises.mkdir(normalizedEntryPath, {
                          recursive: true,
                        });
                      } else {
                        await fs.promises.mkdir(
                          path.dirname(normalizedEntryPath),
                          {
                            recursive: true,
                          },
                        );
                        const readStream = await openReadStream(entry);
                        const writeStream =
                          fs.createWriteStream(normalizedEntryPath);
                        await streamPipeline(readStream, writeStream);
                      }
                    }
                    zipFile.readEntry();
                  };

                  zipFile.on("entry", (entry) => {
                    processEntry(entry).catch(finish);
                  });
                  zipFile.on("end", () => finish());
                  zipFile.on("error", (err) => finish(err));
                  zipFile.readEntry();
                },
              );
            });
          };

          await downloadFile(data.url, data.zipPath);

          if (data.expectedMd5 || data.expectedPackedSize) {
            const buf = await fs.promises.readFile(data.zipPath);
            if (
              data.expectedPackedSize &&
              buf.length !== data.expectedPackedSize
            ) {
              try {
                await fs.promises.unlink(data.zipPath);
              } catch {}
              throw new Error(
                `Size check failed for ${data.pkg}: expected ${data.expectedPackedSize} bytes, got ${buf.length}`,
              );
            }
            if (data.expectedMd5) {
              const crypto = await import("crypto");
              const actualMd5 = crypto
                .createHash("md5")
                .update(buf)
                .digest("hex")
                .toLowerCase();
              if (actualMd5 !== data.expectedMd5) {
                try {
                  await fs.promises.unlink(data.zipPath);
                } catch {}
                throw new Error(
                  `Integrity check (MD5) failed for ${data.pkg}: expected ${data.expectedMd5}, got ${actualMd5}`,
                );
              }
            }
          }

          if (data.rootDir !== undefined) {
            const targetExtractPath =
              data.rootDir === ""
                ? data.installPath
                : path.join(data.installPath, data.rootDir);
            if (!fs.existsSync(targetExtractPath)) {
              fs.mkdirSync(targetExtractPath, { recursive: true });
            }
            await extractZip(data.zipPath, targetExtractPath);
          } else {
            console.warn(
              `[InstallService] No extract root for package ${data.pkg}; skipping extraction`,
            );
          }

          try {
            await fs.promises.unlink(data.zipPath);
          } catch {}

          return { success: true, pkg: data.pkg };
        });
      };

      const activeWorkers: Promise<any>[] = [];
      let hasError = false;
      let errorMessage = "";

      while (queue.length > 0 && activeWorkers.length < concurrency) {
        const pkg = queue.shift()!;
        const workerPromise = processPackage(pkg).then((handle) =>
          handle.join(),
        );

        const trackedPromise = workerPromise
          .then(() => {
            activeWorkers.splice(activeWorkers.indexOf(trackedPromise), 1);
            completed++;
            onProgress(
              "Installing...",
              Math.floor((completed / total) * 100),
              pkg,
            );
          })
          .catch((err) => {
            activeWorkers.splice(activeWorkers.indexOf(trackedPromise), 1);
            hasError = true;
            errorMessage = `Failed to install ${pkg}: ${err?.message || String(err)}`;
            console.error("[RobloxInstallService]", errorMessage);
            throw err;
          });
        activeWorkers.push(trackedPromise);
      }

      while (activeWorkers.length > 0) {
        try {
          await Promise.race(activeWorkers);
        } catch (err) {
          if (hasError) {
            throw new Error(errorMessage);
          }
        }
        while (queue.length > 0 && activeWorkers.length < concurrency) {
          const pkg = queue.shift()!;
          const workerPromise = processPackage(pkg).then((handle) =>
            handle.join(),
          );
          const trackedPromise = workerPromise
            .then(() => {
              activeWorkers.splice(activeWorkers.indexOf(trackedPromise), 1);
              completed++;
              onProgress(
                "Installing...",
                Math.floor((completed / total) * 100),
                pkg,
              );
            })
            .catch((err) => {
              activeWorkers.splice(activeWorkers.indexOf(trackedPromise), 1);
              hasError = true;
              errorMessage = `Failed to install ${pkg}: ${err?.message || String(err)}`;
              console.error("[RobloxInstallService]", errorMessage);
              throw err;
            });
          activeWorkers.push(trackedPromise);
        }
      }

      if (hasError) {
        throw new Error(errorMessage);
      }

      onProgress("Complete", 100);
      return true;
    } catch (e) {
      console.error("Installation failed", e);

      if (createdInstallDir) {
        try {
          fs.rmSync(installPath, { recursive: true, force: true });
        } catch (cleanupErr) {
          console.warn(
            "[InstallService] Failed to clean up partial install dir:",
            cleanupErr,
          );
        }
      }
      return false;
    }
  }

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

  static async checkForUpdates(
    binaryType: string,
    currentVersionHash: string,
  ): Promise<{ hasUpdate: boolean; latestVersion: string }> {
    const history = await this.getDeployHistory(true);
    const versions = history[binaryType];

    if (!versions || versions.length === 0) {
      throw new Error(`No version history found for ${binaryType}`);
    }

    const latestVersion = versions[0];
    return {
      hasUpdate: latestVersion !== currentVersionHash,
      latestVersion,
    };
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
