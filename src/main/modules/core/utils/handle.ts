import { ipcMain, IpcMainInvokeEvent } from "electron";
import { z } from "zod";

/**
 * Helper function to register IPC handlers with validation
 */
export function handle<T extends any[]>(
  channel: string,
  schema: z.ZodTuple<any, any>,
  handler: (event: IpcMainInvokeEvent, ...args: T) => Promise<any>,
) {
  ipcMain.handle(channel, async (event, ...args) => {
    try {
      // args comes in as an array, so we validate against a tuple schema
      const validated = schema.parse(args) as T;
      return await handler(event, ...validated);
    } catch (err: any) {
      console.error(`IPC Error on ${channel}:`, err?.message || err);

      // Create a clean, safely cloneable Error object so Electron IPC doesn't hang
      const safeError = new Error(err?.message || "Unknown error occurred");
      safeError.name = err?.name || "Error";
      if (err?.statusCode) (safeError as any).statusCode = err.statusCode;

      throw safeError;
    }
  });
}
