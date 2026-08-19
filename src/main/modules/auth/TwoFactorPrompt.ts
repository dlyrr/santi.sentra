import { ipcMain, WebContents } from "electron";

export function promptTwoFactor(
  webContents: WebContents,
  payload: { accountId?: string; message?: string },
  timeoutMs = 5 * 60 * 1000,
): Promise<string | null> {
  return new Promise((resolve) => {
    let resolved = false;

    let timeout: NodeJS.Timeout | undefined = undefined;

    const onResponse = (_event: any, code: string | null) => {
      if (resolved) return;
      resolved = true;
      cleanup();
      resolve(code ?? null);
    };

    const cleanup = () => {
      try {
        ipcMain.removeListener("two-factor-response", onResponse as any);
      } catch {}
      if (timeout) clearTimeout(timeout);
    };

    ipcMain.once("two-factor-response", onResponse as any);

    try {
      webContents.send("prompt-two-factor", payload);
    } catch (err) {
      cleanup();
      resolve(null);
      return;
    }

    timeout = setTimeout(() => {
      if (resolved) return;
      resolved = true;
      cleanup();
      resolve(null);
    }, timeoutMs);
  });
}

export default promptTwoFactor;
