import koffi from "koffi";
import { Handle64Service } from "./Handle64Service";

// just hold the mutex
const isWindows = process.platform === "win32";

let kernel32: any;
if (isWindows) {
  try {
    kernel32 = koffi.load("kernel32.dll");
  } catch (e) {
    console.error("Failed to load kernel32.dll:", e);
  }
}

let CreateMutexW: any;
let CloseHandle: any;

if (kernel32) {
  CreateMutexW = kernel32.func("__stdcall", "CreateMutexW", "void*", [
    "void*",
    "int",
    "str16",
  ]);
  CloseHandle = kernel32.func("__stdcall", "CloseHandle", "int", ["void*"]);
}

let g_mutex: any = null;

const Enable = (method: "mutex" | "handle64" = "mutex"): void => {
  if (!isWindows) return;

  if (method === "handle64") {
    Handle64Service.startMonitoring();
    return;
  }

  // Mutex method
  if (!kernel32) return;

  if (!g_mutex) {
    try {
      g_mutex = CreateMutexW(null, 0, "ROBLOX_singletonEvent");

      if (!g_mutex) {
        console.error("MultiInstance: Failed to create mutex");
      }
    } catch (e) {
      console.error("MultiInstance: Error creating mutex:", e);
    }
  }
};

const Disable = (): void => {
  if (!isWindows) return;

  Handle64Service.stopMonitoring();

  if (!kernel32) return;

  if (g_mutex) {
    try {
      CloseHandle(g_mutex);
      g_mutex = null;
    } catch (e) {
      console.error("MultiInstance: Error closing mutex:", e);
    }
  }
};

export const MultiInstance = {
  Enable,
  Disable,
};
