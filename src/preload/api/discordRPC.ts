import { z } from "zod";
import { invoke } from "./invoke";

const discordStatusModeSchema = z.enum([
  "full",
  "playing",
  "accounts",
  "minimal",
]);

const discordPresenceStateSchema = z.object({
  isEnabled: z.boolean(),
  isConnected: z.boolean(),
  currentGame: z
    .object({
      name: z.string(),
      placeId: z.string(),
      thumbnailUrl: z.string().optional(),
    })
    .nullable(),
  currentTab: z.string().nullable(),
  statusMode: discordStatusModeSchema,
  customStatusText: z.string().nullable(),
  accountCount: z.number(),
});

export const discordRPCApi = {
  enableDiscordRPC: () => invoke("discord-rpc-enable", z.boolean()),
  disableDiscordRPC: () => invoke("discord-rpc-disable", z.void()),
  getDiscordRPCState: () =>
    invoke("discord-rpc-get-state", discordPresenceStateSchema),
  setDiscordRPCTab: (tabId: string | null) =>
    invoke("discord-rpc-set-tab", z.void(), tabId),
  isDiscordRPCEnabled: () => invoke("discord-rpc-is-enabled", z.boolean()),
  setDiscordRPCStatusMode: (
    mode: "full" | "playing" | "accounts" | "minimal",
  ) => invoke("discord-rpc-set-status-mode", z.void(), mode),
  setDiscordRPCCustomText: (text: string | null) =>
    invoke("discord-rpc-set-custom-text", z.void(), text),
  getDiscordRPCStatusMode: () =>
    invoke("discord-rpc-get-status-mode", discordStatusModeSchema),
  getDiscordRPCCustomText: () =>
    invoke("discord-rpc-get-custom-text", z.string().nullable()),
};
