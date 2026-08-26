import fs from "fs";
import path from "path";
import crypto from "crypto";
import { getDataFile } from "../../utils/paths";
import {
  encryptWithPassword,
  decryptWithPassword,
  isPasswordEncrypted,
} from "../../lib/secureStore";

/**
 * Parameters of the pre-`sg1` backup format, kept only so old backup files
 * still restore. New backups go through `encryptWithPassword`, which uses
 * scrypt and a random per-file salt; this format derived its key from the
 * PIN and one salt shared by every backup ever written, which is why it is
 * read-only. Nothing here may change without orphaning those files.
 */
const LEGACY_BACKUP = {
  salt: "sentra-backup-salt-v1",
  iterations: 100_000,
  keyLength: 32,
  digest: "sha256",
  algorithm: "aes-256-cbc",
} as const;

export interface BackupData {
  version: string;
  createdAt: string;
  accounts: any[];
  settings?: any;
}

export class AccountBackupService {
  private static readonly BACKUP_DIR = getDataFile("Backups");

  static async createBackup(
    accounts: any[],
    backupPin: string,
    savePath?: string,
  ): Promise<string> {
    try {
      backupPin = String(backupPin || "");

      if (backupPin.length === 0) {
        throw new Error("A backup PIN is required");
      }

      let filepath: string;

      if (savePath) {
        filepath = savePath;

        const dir = path.dirname(filepath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
      } else {
        if (!fs.existsSync(this.BACKUP_DIR)) {
          fs.mkdirSync(this.BACKUP_DIR, { recursive: true });
        }
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const filename = `sentra-backup-${timestamp}.bak`;
        filepath = path.join(this.BACKUP_DIR, filename);
      }

      const backupData: BackupData = {
        version: "1.0.0",
        createdAt: new Date().toISOString(),
        accounts: accounts,
      };

      const jsonData = JSON.stringify(backupData);

      const encrypted = this.encryptData(jsonData, backupPin);

      fs.writeFileSync(filepath, encrypted, "utf-8");

      console.debug &&
        console.debug("[BackupService] Backup created:", filepath);
      return filepath;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error("[BackupService] Failed to create backup:", errorMsg);
      throw new Error(errorMsg);
    }
  }

  static async restoreBackup(
    filepath: string,
    backupPin: string,
  ): Promise<any[]> {
    try {
      backupPin = String(backupPin || "");

      if (!fs.existsSync(filepath)) {
        throw new Error("Backup file not found: " + filepath);
      }

      const encrypted = fs.readFileSync(filepath, "utf-8");

      const jsonData = this.decryptData(encrypted, backupPin);

      const backupData: BackupData = JSON.parse(jsonData);

      if (!Array.isArray(backupData.accounts)) {
        throw new Error("Invalid backup format: accounts list missing");
      }

      const normalized = backupData.accounts.map((a: any) => {
        const id = a?.id ?? a?.uuid ?? a?.uid ?? crypto.randomUUID();
        const displayName = a?.displayName ?? a?.display_name ?? a?.name ?? "";
        const username = a?.username ?? a?.user ?? a?.handle ?? "";
        const userId = a?.userId ?? a?.user_id ?? a?.uid ?? "";

        const normalizedAccount = {
          ...a,
          id: String(id),
          displayName: String(displayName),
          username: String(username),
          userId: String(userId),
        };

        return normalizedAccount;
      });

      console.debug &&
        console.debug(
          "[BackupService] Normalized accounts count:",
          normalized.length,
        );

      return normalized;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error("[BackupService] Failed to restore backup:", errorMsg);
      throw new Error(errorMsg);
    }
  }

  private static encryptData(data: string, pin: string): string {
    try {
      return encryptWithPassword(data, pin);
    } catch (error) {
      throw new Error(
        "Encryption failed: " +
          (error instanceof Error ? error.message : String(error)),
      );
    }
  }

  private static decryptData(combined: string, pin: string): string {
    if (isPasswordEncrypted(combined)) {
      const plain = decryptWithPassword(combined, pin);
      if (plain === null) {
        throw new Error("Invalid PIN or corrupted backup file");
      }
      return plain;
    }

    try {
      const idx = combined.indexOf(":");
      if (idx === -1) throw new Error("Invalid backup file format");
      const ivPart = combined.substring(0, idx);
      const encryptedPart = combined.substring(idx + 1);

      if (!ivPart || !encryptedPart)
        throw new Error("Invalid backup file format");

      const isHex = /^[0-9a-fA-F]+$/.test(ivPart) && ivPart.length % 2 === 0;

      const key = crypto.pbkdf2Sync(
        pin,
        LEGACY_BACKUP.salt,
        LEGACY_BACKUP.iterations,
        LEGACY_BACKUP.keyLength,
        LEGACY_BACKUP.digest,
      );

      if (isHex) {
        const iv = Buffer.from(ivPart, "hex");
        const decipher = crypto.createDecipheriv(
          LEGACY_BACKUP.algorithm,
          key,
          iv,
        );
        let decrypted = decipher.update(encryptedPart, "hex", "utf-8");
        decrypted += decipher.final("utf-8");
        console.debug &&
          console.debug("[BackupService] Decrypted legacy backup (hex)");
        return decrypted;
      } else {
        const iv = Buffer.from(ivPart, "base64");
        const decipher = crypto.createDecipheriv(
          LEGACY_BACKUP.algorithm,
          key,
          iv,
        );
        let decrypted = decipher.update(encryptedPart, "base64", "utf-8");
        decrypted += decipher.final("utf-8");
        console.debug &&
          console.debug("[BackupService] Decrypted legacy backup (base64)");
        return decrypted;
      }
    } catch (error) {
      console.error("[BackupService] Decryption error:", error);
      throw new Error("Invalid PIN or corrupted backup file");
    }
  }
}
