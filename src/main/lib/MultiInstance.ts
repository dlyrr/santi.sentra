import koffi from "koffi";
import { Handle64Service } from "./Handle64Service";

const isWindows = process.platform === "win32";
const LOG = "[MultiInstance]";

const SINGLETON_MUTEX_NAME = "ROBLOX_singletonMutex";

const SINGLETON_EVENT_NAME = "ROBLOX_singletonEvent";

const ROBLOX_PROCESS_PREFIXES = ["RobloxPlayer", "Bloxstrap"];

const PROCESS_DUP_HANDLE = 0x0040;
const PROCESS_QUERY_LIMITED_INFORMATION = 0x1000;
const DUPLICATE_CLOSE_SOURCE = 0x1;
const DUPLICATE_SAME_ACCESS = 0x2;
const STATUS_INFO_LENGTH_MISMATCH = 0xc0000004;
const STATUS_SUCCESS = 0x0;
const SystemExtendedHandleInformation = 64;
const ObjectNameInformation = 1;
const ObjectTypeInformation = 2;
const WAIT_OBJECT_0 = 0x0;
const WAIT_ABANDONED = 0x80;
const TH32CS_SNAPPROCESS = 0x2;
const EVENT_MODIFY_STATE = 0x0002;
const SYNCHRONIZE = 0x00100000;

const HANDLE_ENTRY_SIZE = 40;
const HANDLE_ARRAY_OFFSET = 16;
const OFF_UNIQUE_PROCESS_ID = 8;
const OFF_HANDLE_VALUE = 16;
const OFF_OBJECT_TYPE_INDEX = 30;

let libLoaded = false;
let libAvailable = false;

let kernel32: any;
let ntdll: any;
let UNICODE_STRING: any;

let CreateMutexW: any;
let ReleaseMutex: any;
let WaitForSingleObject: any;
let CreateEventW: any;
let OpenEventW: any;
let OpenProcess: any;
let GetCurrentProcess: any;
let CloseHandle: any;
let DuplicateHandle: any;
let NtQuerySystemInformation: any;
let NtQueryObject: any;
let CreateToolhelp32Snapshot: any;
let Process32FirstW: any;
let Process32NextW: any;
let PROCESSENTRY32W: any;
let PE_SIZE = 0;
let PE_OFF_PID = 8;
let PE_OFF_EXE = 44;

const ensureLib = (): boolean => {
  if (libLoaded) return libAvailable;
  libLoaded = true;

  if (!isWindows) return false;

  try {
    kernel32 = koffi.load("kernel32.dll");
    ntdll = koffi.load("ntdll.dll");

    UNICODE_STRING = koffi.struct("MI_UNICODE_STRING", {
      Length: "uint16",
      MaximumLength: "uint16",
      Buffer: koffi.pointer("uint16"),
    });

    PROCESSENTRY32W = koffi.struct("MI_PROCESSENTRY32W", {
      dwSize: "uint32",
      cntUsage: "uint32",
      th32ProcessID: "uint32",
      th32DefaultHeapID: "uintptr_t",
      th32ModuleID: "uint32",
      cntThreads: "uint32",
      th32ParentProcessID: "uint32",
      pcPriClassBase: "int32",
      dwFlags: "uint32",
      szExeFile: koffi.array("uint16", 260),
    });
    PE_SIZE = koffi.sizeof(PROCESSENTRY32W);
    PE_OFF_PID = koffi.offsetof(PROCESSENTRY32W, "th32ProcessID");
    PE_OFF_EXE = koffi.offsetof(PROCESSENTRY32W, "szExeFile");

    CreateMutexW = kernel32.func("__stdcall", "CreateMutexW", "void*", [
      "void*",
      "int",
      "str16",
    ]);
    ReleaseMutex = kernel32.func("__stdcall", "ReleaseMutex", "int", ["void*"]);
    WaitForSingleObject = kernel32.func(
      "__stdcall",
      "WaitForSingleObject",
      "uint32",
      ["void*", "uint32"],
    );
    CreateEventW = kernel32.func("__stdcall", "CreateEventW", "void*", [
      "void*",
      "int",
      "int",
      "str16",
    ]);
    OpenEventW = kernel32.func("__stdcall", "OpenEventW", "void*", [
      "uint32",
      "int",
      "str16",
    ]);
    OpenProcess = kernel32.func("__stdcall", "OpenProcess", "void*", [
      "uint32",
      "int",
      "uint32",
    ]);
    GetCurrentProcess = kernel32.func(
      "__stdcall",
      "GetCurrentProcess",
      "void*",
      [],
    );
    CloseHandle = kernel32.func("__stdcall", "CloseHandle", "int", ["void*"]);
    DuplicateHandle = kernel32.func("__stdcall", "DuplicateHandle", "int", [
      "void*",
      "uintptr_t",
      "void*",
      koffi.out(koffi.pointer("void*")),
      "uint32",
      "int",
      "uint32",
    ]);
    NtQuerySystemInformation = ntdll.func(
      "__stdcall",
      "NtQuerySystemInformation",
      "uint32",
      ["uint32", "void*", "uint32", koffi.out(koffi.pointer("uint32"))],
    );
    NtQueryObject = ntdll.func("__stdcall", "NtQueryObject", "uint32", [
      "void*",
      "uint32",
      "void*",
      "uint32",
      koffi.out(koffi.pointer("uint32")),
    ]);
    CreateToolhelp32Snapshot = kernel32.func(
      "__stdcall",
      "CreateToolhelp32Snapshot",
      "void*",
      ["uint32", "uint32"],
    );
    Process32FirstW = kernel32.func("__stdcall", "Process32FirstW", "int", [
      "void*",
      "void*",
    ]);
    Process32NextW = kernel32.func("__stdcall", "Process32NextW", "int", [
      "void*",
      "void*",
    ]);

    libAvailable = true;
  } catch (e) {
    console.error(`${LOG} Failed to initialize native bindings:`, e);
    libAvailable = false;
  }

  return libAvailable;
};

let g_mutexHandle: any = null;
let g_mutexOwned = false;
let g_ownRetryInterval: NodeJS.Timeout | null = null;
let g_handle64FailureCheckInterval: NodeJS.Timeout | null = null;

const ensureMutexOwned = (): boolean => {
  if (!ensureLib()) {
    console.warn(
      `${LOG} native bindings unavailable, cannot own the singleton mutex`,
    );
    return false;
  }
  if (g_mutexOwned) return true;

  try {
    if (!g_mutexHandle) {
      g_mutexHandle = CreateMutexW(null, 1, SINGLETON_MUTEX_NAME);
      if (!g_mutexHandle) {
        console.error(`${LOG} CreateMutexW failed for ${SINGLETON_MUTEX_NAME}`);
        return false;
      }
    }

    const wait = WaitForSingleObject(g_mutexHandle, 0);
    if (wait === WAIT_OBJECT_0 || wait === WAIT_ABANDONED) {
      g_mutexOwned = true;
      console.log(
        `${LOG} Owning ${SINGLETON_MUTEX_NAME} — no Roblox client can become the primary instance.`,
      );
    } else {
      console.log(
        `${LOG} ${SINGLETON_MUTEX_NAME} is owned by another process; will retry and rely on the event sweeper meanwhile.`,
      );
    }
  } catch (e) {
    console.error(`${LOG} Error acquiring ${SINGLETON_MUTEX_NAME}:`, e);
  }

  return g_mutexOwned;
};

const startOwnershipRetry = (): void => {
  if (g_mutexOwned || g_ownRetryInterval) return;
  g_ownRetryInterval = setInterval(() => {
    if (ensureMutexOwned() && g_ownRetryInterval) {
      clearInterval(g_ownRetryInterval);
      g_ownRetryInterval = null;
    }
  }, 5000);
};

const enumerateHandles = (): { buf: Buffer; count: number } | null => {
  let length = 0x10000;
  let buf = Buffer.alloc(length);
  let status = STATUS_INFO_LENGTH_MISMATCH;

  for (let guard = 0; guard < 24; guard++) {
    const outLen = [0];
    status = NtQuerySystemInformation(
      SystemExtendedHandleInformation,
      buf,
      length,
      outLen,
    );
    if (status === STATUS_INFO_LENGTH_MISMATCH) {
      length = Math.max(length * 2, outLen[0] || 0);
      buf = Buffer.alloc(length);
      continue;
    }
    break;
  }

  if (status !== STATUS_SUCCESS) {
    console.error(
      `${LOG} NtQuerySystemInformation failed: 0x${(status >>> 0).toString(16)}`,
    );
    return null;
  }

  const count = Number(buf.readBigUInt64LE(0));
  if (
    count <= 0 ||
    HANDLE_ARRAY_OFFSET + count * HANDLE_ENTRY_SIZE > buf.length
  ) {
    console.error(
      `${LOG} handle count ${count} inconsistent with buffer ${buf.length}`,
    );
    return null;
  }
  return { buf, count };
};

let g_eventTypeIndex = -2;
const getEventTypeIndex = (): number => {
  if (g_eventTypeIndex !== -2) return g_eventTypeIndex;
  g_eventTypeIndex = -1;

  if (!ensureLib()) return g_eventTypeIndex;

  let probe: any = null;
  try {
    probe = CreateEventW(null, 0, 0, null);
    if (!probe) return g_eventTypeIndex;
    const probeValue = koffi.address(probe);
    const myPid = process.pid;

    const enumerated = enumerateHandles();
    if (!enumerated) return g_eventTypeIndex;
    const { buf, count } = enumerated;

    for (let i = 0; i < count; i++) {
      const off = HANDLE_ARRAY_OFFSET + i * HANDLE_ENTRY_SIZE;
      if (Number(buf.readBigUInt64LE(off + OFF_UNIQUE_PROCESS_ID)) !== myPid)
        continue;
      if (buf.readBigUInt64LE(off + OFF_HANDLE_VALUE) !== probeValue) continue;
      g_eventTypeIndex = buf.readUInt16LE(off + OFF_OBJECT_TYPE_INDEX);
      break;
    }
    console.log(
      `${LOG} Event object-type index resolved to ${g_eventTypeIndex}`,
    );
  } catch (e) {
    console.error(`${LOG} Failed to resolve Event type index:`, e);
  } finally {
    if (probe) {
      try {
        CloseHandle(probe);
      } catch {}
    }
  }
  return g_eventTypeIndex;
};

const queryObjectString = (
  handle: unknown,
  infoClass: number,
): string | null => {
  let length = 0x1000;
  let buf = Buffer.alloc(length);
  const outLen = [0];

  let status = NtQueryObject(handle, infoClass, buf, length, outLen);
  if (status === STATUS_INFO_LENGTH_MISMATCH) {
    length = Math.max(outLen[0] || 0, length * 2);
    buf = Buffer.alloc(length);
    status = NtQueryObject(handle, infoClass, buf, length, outLen);
  }
  if (status !== STATUS_SUCCESS) return null;

  const us = koffi.decode(buf, UNICODE_STRING) as {
    Length: number;
    MaximumLength: number;
    Buffer: unknown;
  };
  if (!us.Buffer || us.Length === 0) return "";

  const units = koffi.decode(
    us.Buffer,
    koffi.array("uint16", us.Length / 2),
  ) as number[];
  return String.fromCharCode.apply(null, units);
};

const getRobloxPids = (): Set<number> => {
  const pids = new Set<number>();
  if (!ensureLib()) return pids;

  let snap: any = null;
  try {
    snap = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
    const snapAddr = koffi.address(snap);

    if (!snap || snapAddr === 0xffffffffffffffffn) {
      console.error(`${LOG} CreateToolhelp32Snapshot failed`);
      return pids;
    }

    const pe = Buffer.alloc(PE_SIZE);
    pe.writeUInt32LE(PE_SIZE, 0);

    let ok = Process32FirstW(snap, pe);
    while (ok) {
      const pid = pe.readUInt32LE(PE_OFF_PID);
      const name = pe
        .toString("utf16le", PE_OFF_EXE, PE_OFF_EXE + 520)
        .replace(/\0[\s\S]*$/, "");
      if (
        ROBLOX_PROCESS_PREFIXES.some((p) =>
          name.toLowerCase().startsWith(p.toLowerCase()),
        )
      ) {
        pids.add(pid);
      }
      ok = Process32NextW(snap, pe);
    }
  } catch (e) {
    console.error(`${LOG} Toolhelp32 enumeration failed:`, e);
  } finally {
    if (snap) {
      try {
        CloseHandle(snap);
      } catch {}
    }
  }
  return pids;
};

const tryCloseIfSingletonEvent = (
  srcProcess: unknown,
  curProcess: unknown,
  handleValue: bigint,
  typePreFiltered: boolean,
): boolean => {
  const dupOut = [null];
  if (
    !DuplicateHandle(
      srcProcess,
      handleValue,
      curProcess,
      dupOut,
      0,
      0,
      DUPLICATE_SAME_ACCESS,
    ) ||
    !dupOut[0]
  ) {
    return false;
  }
  const dup = dupOut[0];
  try {
    if (!typePreFiltered) {
      const typeName = queryObjectString(dup, ObjectTypeInformation);
      if (typeName !== "Event") return false;
    }

    const objectName = queryObjectString(dup, ObjectNameInformation);
    if (!objectName || !objectName.endsWith(SINGLETON_EVENT_NAME)) return false;

    const closerOut = [null];
    if (
      !DuplicateHandle(
        srcProcess,
        handleValue,
        curProcess,
        closerOut,
        0,
        0,
        DUPLICATE_CLOSE_SOURCE,
      ) ||
      !closerOut[0]
    ) {
      console.warn(`${LOG} DuplicateHandle(close) failed for ${objectName}`);
      return false;
    }
    CloseHandle(closerOut[0]);
    console.log(`${LOG} Closed ${objectName}`);
    return true;
  } finally {
    CloseHandle(dup);
  }
};

const sweepSingletonEvents = (): number => {
  if (!ensureLib()) return 0;

  const robloxPids = getRobloxPids();
  if (robloxPids.size === 0) return 0;

  const enumerated = enumerateHandles();
  if (!enumerated) return 0;
  const { buf, count } = enumerated;

  const eventTypeIndex = getEventTypeIndex();
  const typePreFiltered = eventTypeIndex >= 0;

  const byPid = new Map<number, bigint[]>();
  for (let i = 0; i < count; i++) {
    const off = HANDLE_ARRAY_OFFSET + i * HANDLE_ENTRY_SIZE;
    const pid = Number(buf.readBigUInt64LE(off + OFF_UNIQUE_PROCESS_ID));
    if (!robloxPids.has(pid)) continue;
    if (
      typePreFiltered &&
      buf.readUInt16LE(off + OFF_OBJECT_TYPE_INDEX) !== eventTypeIndex
    )
      continue;
    const handleValue = buf.readBigUInt64LE(off + OFF_HANDLE_VALUE);
    const list = byPid.get(pid);
    if (list) list.push(handleValue);
    else byPid.set(pid, [handleValue]);
  }

  if (byPid.size === 0) return 0;

  let closed = 0;
  const cur = GetCurrentProcess();
  for (const [pid, handles] of byPid) {
    const src = OpenProcess(
      PROCESS_DUP_HANDLE | PROCESS_QUERY_LIMITED_INFORMATION,
      0,
      pid,
    );
    if (!src) {
      console.warn(
        `${LOG} OpenProcess(${pid}) failed; skipping (elevated client?).`,
      );
      continue;
    }
    try {
      for (const hv of handles) {
        if (tryCloseIfSingletonEvent(src, cur, hv, typePreFiltered)) closed++;
      }
    } finally {
      try {
        CloseHandle(src);
      } catch {}
    }
  }

  if (closed > 0) {
    console.log(
      `${LOG} Closed ${closed} singleton event handle(s) across ${byPid.size} Roblox process(es).`,
    );
  }
  return closed;
};

const SingletonEventExists = (): boolean => {
  if (!ensureLib()) return false;
  let handle: any = null;
  try {
    handle = OpenEventW(
      EVENT_MODIFY_STATE | SYNCHRONIZE,
      0,
      SINGLETON_EVENT_NAME,
    );
    if (handle) {
      CloseHandle(handle);
      return true;
    }
    return false;
  } catch {
    return false;
  }
};

const ClearSingletonEvents = (): number => {
  try {
    return SingletonEventExists() ? sweepSingletonEvents() : 0;
  } catch (e) {
    console.error(`${LOG} ClearSingletonEvents failed:`, e);
    return 0;
  }
};

const PrepareForLaunch = (): void => {
  if (!isWindows) return;
  try {
    ensureMutexOwned();
    if (!g_mutexOwned) startOwnershipRetry();

    if (SingletonEventExists()) {
      console.log(
        `${LOG} A running client holds the singleton event — sweeping it before launch.`,
      );
      sweepSingletonEvents();
    }
  } catch (e) {
    console.error(`${LOG} PrepareForLaunch failed:`, e);
  }
};

let g_sweepTimer: NodeJS.Timeout | null = null;
const ScheduleSingletonSweep = (): void => {
  if (!isWindows) return;
  if (g_sweepTimer) return;

  const deadline = Date.now() + 45_000;
  const tick = (): void => {
    try {
      if (Date.now() >= deadline) {
        g_sweepTimer = null;
        return;
      }
      if (SingletonEventExists() && sweepSingletonEvents() > 0) {
        g_sweepTimer = null;
        return;
      }
    } catch (e) {
      console.error(`${LOG} ScheduleSingletonSweep tick failed:`, e);
    }
    g_sweepTimer = setTimeout(tick, 3000);
  };
  g_sweepTimer = setTimeout(tick, 3000);
};

const Enable = (method: "mutex" | "handle64" = "mutex"): void => {
  if (!isWindows) {
    console.log(`${LOG} Not on Windows, skipping multi-instance setup`);
    return;
  }

  console.log(`${LOG} Enabling multi-instance with method: ${method}`);

  ensureMutexOwned();
  if (!g_mutexOwned) startOwnershipRetry();

  if (method === "handle64") {
    console.log(`${LOG} Starting Handle64 monitoring...`);
    void (async () => {
      try {
        const started = await Handle64Service.startMonitoring();
        if (started) {
          console.log(`${LOG} Handle64 monitoring started (success)`);
          if (g_handle64FailureCheckInterval)
            clearInterval(g_handle64FailureCheckInterval);
          g_handle64FailureCheckInterval = setInterval(() => {
            if (Handle64Service.checkAndReportFailure()) {
              console.error(
                `${LOG} Handle64 has failed; relying on the owned mutex and native sweeper.`,
              );
              if (g_handle64FailureCheckInterval)
                clearInterval(g_handle64FailureCheckInterval);
              g_handle64FailureCheckInterval = null;
              Handle64Service.stopMonitoring();
            }
          }, 1000);
        } else {
          console.error(
            `${LOG} Handle64 startup failed; relying on the owned mutex and native sweeper.`,
          );
        }
      } catch (error) {
        console.error(
          `${LOG} Unexpected error during Handle64 startup:`,
          error,
        );
      }
    })();
    return;
  }

  if (g_handle64FailureCheckInterval) {
    clearInterval(g_handle64FailureCheckInterval);
    g_handle64FailureCheckInterval = null;
  }
  Handle64Service.stopMonitoring();
};

const Disable = (): void => {
  if (!isWindows) return;

  if (g_handle64FailureCheckInterval) {
    clearInterval(g_handle64FailureCheckInterval);
    g_handle64FailureCheckInterval = null;
  }
  if (g_ownRetryInterval) {
    clearInterval(g_ownRetryInterval);
    g_ownRetryInterval = null;
  }
  if (g_sweepTimer) {
    clearTimeout(g_sweepTimer);
    g_sweepTimer = null;
  }

  Handle64Service.stopMonitoring();

  if (!ensureLib()) return;

  if (g_mutexHandle) {
    try {
      if (g_mutexOwned) ReleaseMutex(g_mutexHandle);
      CloseHandle(g_mutexHandle);
    } catch (e) {
      console.error(`${LOG} Error releasing ${SINGLETON_MUTEX_NAME}:`, e);
    }
    g_mutexHandle = null;
    g_mutexOwned = false;
  }
};

export const MultiInstance = {
  Enable,
  Disable,
  PrepareForLaunch,
  ScheduleSingletonSweep,
  ClearSingletonEvents,
  SingletonEventExists,
};
