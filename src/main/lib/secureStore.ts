import { safeStorage } from "electron";
import {
  randomBytes,
  scryptSync,
  createCipheriv,
  createDecipheriv,
} from "crypto";

export function isSafeStorageAvailable(): boolean {
  try {
    return safeStorage.isEncryptionAvailable();
  } catch {
    return false;
  }
}

export function safeEncrypt(plain: string): string | null {
  try {
    if (!safeStorage.isEncryptionAvailable()) return null;
    return safeStorage.encryptString(plain).toString("base64");
  } catch (err) {
    console.error("[secureStore] safeEncrypt failed:", err);
    return null;
  }
}

export function safeDecrypt(b64: string): string | null {
  try {
    if (!safeStorage.isEncryptionAvailable()) return null;
    return safeStorage.decryptString(Buffer.from(b64, "base64"));
  } catch {
    return null;
  }
}

const PW_PREFIX = "sg1";
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 } as const;
const KEY_LEN = 32;
const IV_LEN = 12;
const SALT_LEN = 16;

function deriveKey(password: string, salt: Buffer): Buffer {
  return scryptSync(password, salt, KEY_LEN, {
    ...SCRYPT_PARAMS,
    maxmem: 64 * 1024 * 1024,
  });
}

export function encryptWithPassword(plain: string, password: string): string {
  const salt = randomBytes(SALT_LEN);
  const iv = randomBytes(IV_LEN);
  const key = deriveKey(password, salt);
  try {
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [
      PW_PREFIX,
      salt.toString("base64"),
      iv.toString("base64"),
      tag.toString("base64"),
      ct.toString("base64"),
    ].join(":");
  } finally {
    key.fill(0);
  }
}

export function decryptWithPassword(
  payload: string,
  password: string,
): string | null {
  if (typeof payload !== "string" || !payload.startsWith(PW_PREFIX + ":")) {
    return null;
  }
  const parts = payload.split(":");
  if (parts.length !== 5) return null;
  const [, saltB64, ivB64, tagB64, ctB64] = parts;
  let key: Buffer | null = null;
  try {
    const salt = Buffer.from(saltB64, "base64");
    const iv = Buffer.from(ivB64, "base64");
    const tag = Buffer.from(tagB64, "base64");
    const ct = Buffer.from(ctB64, "base64");
    key = deriveKey(password, salt);
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    const out = Buffer.concat([decipher.update(ct), decipher.final()]);
    return out.toString("utf8");
  } catch {
    return null;
  } finally {
    if (key) key.fill(0);
  }
}

export function isPasswordEncrypted(payload: unknown): boolean {
  return typeof payload === "string" && payload.startsWith(PW_PREFIX + ":");
}
