import { ipcMain, IpcMainInvokeEvent } from "electron";
import { z } from "zod";

export function handle<T extends any[]>(
  channel: string,
  schema: z.ZodTuple<any, any>,
  handler: (event: IpcMainInvokeEvent, ...args: T) => Promise<any>,
) {
  ipcMain.handle(channel, async (event, ...args) => {
    try {
      const validated = schema.parse(args) as T;
      return await handler(event, ...validated);
    } catch (err: any) {
      console.error(`IPC Error on ${channel}:`, err?.message || err);

      const safeError = new Error(err?.message || "Unknown error occurred");
      safeError.name = err?.name || "Error";
      if (err?.statusCode) (safeError as any).statusCode = err.statusCode;

      throw safeError;
    }
  });
}
