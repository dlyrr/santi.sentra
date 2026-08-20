import { shell } from "electron";

export function openExternalSafely(rawUrl: string): void {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      console.warn(
        `[safeShell] Blocked openExternal for non-web protocol: ${parsed.protocol}`,
      );
      return;
    }
    void shell.openExternal(parsed.toString());
  } catch {
    console.warn("[safeShell] Blocked openExternal for malformed URL");
  }
}

export function normalizeWebUrl(raw: string): string | null {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  try {
    const parsed = new URL(withScheme);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}
