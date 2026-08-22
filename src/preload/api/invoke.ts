import { ipcRenderer } from "electron";
import { z } from "zod";

/**
 * JSON has no `undefined`, so a handler that returns nothing arrives as `null`.
 *
 * 29 channels here declare `z.void()` — every settings write, the sidebar
 * geometry setters, the Discord Rich Presence toggles — and `z.void()` accepts
 * `undefined`, not `null`. Under Electron the structured clone preserved
 * `undefined` and these validated fine. Over a JSON transport they all started
 * throwing, and because the settings mutation applies its change optimistically
 * and rolls back on error, the symptom was a setting that visibly reverted a
 * moment after you changed it: accent colour, surface tint, privacy mode,
 * Discord Rich Presence.
 *
 * So when a `null` fails validation, retry it as `undefined` before treating it
 * as a real error. Only the null-vs-undefined distinction is papered over; a
 * genuinely wrong shape still fails loudly.
 */
function parseResult<T>(schema: z.ZodType<T>, result: unknown) {
  const parsed = schema.safeParse(result);
  if (parsed.success || result !== null) return parsed;
  return schema.safeParse(undefined);
}

export async function invoke<T>(
  channel: string,
  schema: z.ZodType<T>,
  ...args: unknown[]
): Promise<T> {
  const result = await ipcRenderer.invoke(channel, ...args);

  const parsed = parseResult(schema, result);
  if (parsed.success) return parsed.data;

  const error = parsed.error;
  const detail = error.issues
    .map((issue: z.core.$ZodIssue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("; ");

  console.error(`[IPC] Validation error for channel "${channel}":`, error.issues);
  // Also report it into the app log. A validation failure happens after the IPC
  // call succeeds, so without this it exists only in the webview console and a
  // view just says "something went wrong".
  if (channel !== "app:log") {
    void ipcRenderer
      .invoke("app:log", "warn", `IPC validation failed for ${channel}: ${detail}`)
      .catch(() => undefined);
  }
  throw new Error(
    `IPC validation failed for ${channel}: ${detail}`,
  );
}
