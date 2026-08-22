/**
 * A wire-compatible replacement for Electron's `safeStorage`, on Windows DPAPI.
 *
 * Two constraints force this to be a real local implementation rather than a
 * reverse call to the Rust host:
 *
 *  1. It must be synchronous. `secureStore` and `PinService` call
 *     `encryptString` / `decryptString` inline and use the returned Buffer
 *     immediately; there is nowhere to await.
 *  2. It must read blobs Electron already wrote. Users have config files
 *     encrypted by Electron's safeStorage today. On Windows that is a plain
 *     DPAPI blob from `CryptProtectData` with no extra entropy, so calling the
 *     same Win32 API reproduces the exact format and existing data keeps
 *     opening. A different scheme would lock people out of their own accounts.
 *
 * koffi is already a dependency (MultiInstance uses it for Win32 handle work),
 * so the FFI cost here is zero.
 */

import koffi from "koffi";

interface DataBlob {
  cbData: number;
  pbData: Buffer | null;
}

let crypt32: ReturnType<typeof koffi.load> | null = null;
let protect: ((...args: unknown[]) => number) | null = null;
let unprotect: ((...args: unknown[]) => number) | null = null;
let initError: string | null = null;

function init(): boolean {
  if (protect && unprotect) return true;
  if (initError) return false;

  if (process.platform !== "win32") {
    initError =
      "safeStorage is only implemented for Windows in the Tauri shell; " +
      "see MIGRATION.md for the macOS/Linux keychain work.";
    return false;
  }

  try {
    const BLOB = koffi.struct("DATA_BLOB", {
      cbData: "uint32",
      pbData: "uint8_t *",
    });

    crypt32 = koffi.load("crypt32.dll");
    protect = crypt32.func("__stdcall", "CryptProtectData", "bool", [
      koffi.pointer(BLOB), // pDataIn
      "str16", // szDataDescr
      koffi.pointer(BLOB), // pOptionalEntropy
      "void *", // pvReserved
      "void *", // pPromptStruct
      "uint32", // dwFlags
      koffi.out(koffi.pointer(BLOB)), // pDataOut
    ]) as never;

    unprotect = crypt32.func("__stdcall", "CryptUnprotectData", "bool", [
      koffi.pointer(BLOB),
      "void *",
      koffi.pointer(BLOB),
      "void *",
      "void *",
      "uint32",
      koffi.out(koffi.pointer(BLOB)),
    ]) as never;

    return true;
  } catch (error) {
    initError = `failed to bind crypt32: ${error}`;
    return false;
  }
}

/** CRYPTPROTECT_UI_FORBIDDEN — never prompt; this runs headless. */
const UI_FORBIDDEN = 0x1;

function callDpapi(
  fn: (...args: unknown[]) => number,
  input: Buffer,
): Buffer | null {
  const inBlob: DataBlob = { cbData: input.length, pbData: input };
  const outBlob: DataBlob[] = [{ cbData: 0, pbData: null }];

  const ok = fn(inBlob, null, null, null, null, UI_FORBIDDEN, outBlob);
  if (!ok) return null;

  const { cbData, pbData } = outBlob[0];
  if (!pbData || cbData === 0) return null;

  return Buffer.from(koffi.decode(pbData, koffi.array("uint8_t", cbData)));
}

export const safeStorage = {
  isEncryptionAvailable(): boolean {
    return init();
  },

  encryptString(plaintext: string): Buffer {
    if (!init()) {
      throw new Error(initError ?? "safeStorage is unavailable");
    }
    const result = callDpapi(protect!, Buffer.from(plaintext, "utf8"));
    if (!result) throw new Error("CryptProtectData failed");
    return result;
  },

  decryptString(encrypted: Buffer): string {
    if (!init()) {
      throw new Error(initError ?? "safeStorage is unavailable");
    }
    const result = callDpapi(unprotect!, Buffer.from(encrypted));
    if (!result) throw new Error("CryptUnprotectData failed");
    return result.toString("utf8");
  },
};
