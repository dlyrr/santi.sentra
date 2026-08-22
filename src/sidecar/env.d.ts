/**
 * `process.resourcesPath` is an Electron addition that plain Node does not
 * declare. The sidecar installs it at boot from the `SENTRA_RESOURCES`
 * environment variable Rust passes in (see src/sidecar/index.ts), so the
 * services that read it keep type-checking.
 */
declare namespace NodeJS {
  interface Process {
    resourcesPath: string;
  }
}
