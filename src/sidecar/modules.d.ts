/**
 * Ambient declarations for dependencies that ship no types.
 *
 * These were previously absorbed by Electron's own type surface; with Electron
 * gone they have to be declared explicitly. The `any`s are deliberate — the
 * goal is to keep the existing service code compiling, not to retrofit types
 * onto third-party libraries. Callback parameters are typed as explicit `any`
 * rather than left bare so `noImplicitAny` stays on everywhere else.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

declare module "@ryuziii/discord-rpc" {
  // Exported as both a value and a type, because DiscordRPCService uses it in
  // both positions. Left as `any` deliberately: giving it a real shape turns
  // the service's existing null-handling into type errors, which is a separate
  // change from this migration.
  export const DiscordRPCClient: any;
  export type DiscordRPCClient = any;
  export const Client: any;
  export type Client = any;
  const value: any;
  export default value;
}

declare module "discord-rpc" {
  export const Client: any;
  const value: any;
  export default value;
}

declare module "lz4js" {
  const value: any;
  export default value;
  export function decompress(...args: any[]): any;
  export function compress(...args: any[]): any;
}

declare module "multithreading" {
  /** Moves a value into the worker's ownership. */
  export function move<T>(value: T): T;
  /** Runs `task` on a worker thread with `data` transferred in. */
  export function spawn<T, R>(data: T, task: (data: any) => Promise<R> | R): any;
}
