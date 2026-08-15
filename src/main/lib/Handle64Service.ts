import fs from "fs";
import path from "path";
import https from "https";
import { app } from "electron";
import { exec } from "child_process";
import AdmZip from "adm-zip";

export class Handle64Service {
  private static isMonitoring = false;
  private static monitorInterval: NodeJS.Timeout | null = null;
  private static handle64Path = path.join(
    app.getPath("userData"),
    "handle64.exe",
  );
  private static isDownloading = false;

  public static async initialize(): Promise<void> {
    if (process.platform !== "win32") return;
    if (!fs.existsSync(this.handle64Path)) {
      await this.downloadHandle64();
    }
  }

  private static async downloadHandle64(): Promise<void> {
    if (this.isDownloading) return;
    this.isDownloading = true;

    try {
      console.log("[Handle64] Downloading handle64.exe from Sysinternals...");
      const zipPath = path.join(app.getPath("temp"), "Handle.zip");

      await new Promise<void>((resolve, reject) => {
        const file = fs.createWriteStream(zipPath);
        https
          .get(
            "https://download.sysinternals.com/files/Handle.zip",
            (response) => {
              if (response.statusCode !== 200) {
                reject(
                  new Error(
                    `Failed to download Handle.zip: ${response.statusCode}`,
                  ),
                );
                return;
              }
              response.pipe(file);
              file.on("finish", () => {
                file.close();
                resolve();
              });
            },
          )
          .on("error", (err) => {
            fs.unlink(zipPath, () => {});
            reject(err);
          });
      });

      const zip = new AdmZip(zipPath);
      const zipEntries = zip.getEntries();

      for (const entry of zipEntries) {
        if (entry.entryName.toLowerCase() === "handle64.exe") {
          fs.writeFileSync(this.handle64Path, entry.getData());
          break;
        }
      }

      fs.unlinkSync(zipPath);
      console.log("[Handle64] Download complete.");
    } catch (error) {
      console.error("[Handle64] Failed to download/extract handle64:", error);
    } finally {
      this.isDownloading = false;
    }
  }

  public static startMonitoring(): void {
    if (process.platform !== "win32") return;
    if (this.isMonitoring) return;

    this.initialize().then(() => {
      this.isMonitoring = true;
      this.monitorInterval = setInterval(() => {
        this.closeRobloxHandles();
      }, 3000);
      console.log("[Handle64] Started monitoring for Roblox handles.");
    });
  }

  public static stopMonitoring(): void {
    if (!this.isMonitoring) return;
    this.isMonitoring = false;
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }
    console.log("[Handle64] Stopped monitoring for Roblox handles.");
  }

  private static closeRobloxHandles(): void {
    if (!fs.existsSync(this.handle64Path)) return;

    // Find all RobloxPlayerBeta.exe processes and their handles for ROBLOX_singletonEvent
    exec(
      `"${this.handle64Path}" -a -p RobloxPlayerBeta.exe -accepteula`,
      (error, stdout) => {
        if (error && error.code !== 1) {
          return;
        }

        const lines = stdout.split("\n");
        let currentPid: string | null = null;
        
        for (const line of lines) {
          // Track the current PID from the header line
          const pidMatch = line.match(/pid:\s*(\d+)/i);
          if (pidMatch) {
            currentPid = pidMatch[1];
            continue;
          }

          // If we have a PID and find the singleton event, extract the handle
          if (currentPid && line.includes("ROBLOX_singletonEvent")) {
            const handleMatch = line.match(/^\s*([0-9a-fA-F]+):/i);

            if (handleMatch) {
              const pid = currentPid;
              const handleHex = handleMatch[1];

              exec(
                `"${this.handle64Path}" -c ${handleHex} -p ${pid} -y -accepteula`,
                (closeErr) => {
                  if (closeErr) {
                    console.error(
                      `[Handle64] Failed to close handle ${handleHex} for PID ${pid}:`,
                      closeErr,
                    );
                  } else {
                    console.log(
                      `[Handle64] Successfully closed ROBLOX_singletonEvent handle ${handleHex} for PID ${pid}`,
                    );
                  }
                },
              );
            }
          }
        }
      },
    );
  }
}
