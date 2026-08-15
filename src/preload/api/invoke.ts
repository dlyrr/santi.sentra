import { ipcRenderer } from "electron";
import { z } from "zod";

/**
 * Helper to validate IPC responses with Zod schemas
 */
export async function invoke<T>(
  channel: string,
  schema: z.ZodType<T>,
  ...args: unknown[]
): Promise<T> {
  const result = await ipcRenderer.invoke(channel, ...args);
  try {
    return schema.parse(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error(
        `[IPC] Validation error for channel "${channel}":`,
        error.issues,
      );
      throw new Error(
        `IPC validation failed for ${channel}: ${error.issues.map((e) => `${e.path.join(".")} - ${e.message}`).join("; ")}`,
      );
    }
    throw error;
  }
}
