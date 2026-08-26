/**
 * The one place the app's PIN rules live.
 *
 * Before this file the same numbers were spelled out at every site that
 * touched a PIN: six input boxes written as `Array(6)` in four components,
 * `5` remaining attempts in the renderer and again in StorageService and
 * again in PinService, `300` as a fallback lockout, and two separate copies
 * of the PBKDF2 parameters inside PinService itself. Nothing held them in
 * step, so changing any one of them only ever half-applied.
 *
 * The constants come in two groups, and they are not equally safe to touch:
 *
 *   - Policy (`PIN_POLICY`, `ROBLOX_ACCOUNT_PIN`): how long a PIN is, how
 *     many attempts lock the app, how long a lockout lasts. Nothing on disk
 *     depends on these, so they can be changed freely; every screen and
 *     every check derives from them.
 *
 *   - Format (`PIN_HASH`, `PIN_ENCRYPTION`, `ACCOUNT_BLOB`): the KDF and
 *     cipher parameters the data on disk was written with. Change one and
 *     every stored PIN stops verifying and every stored account stops
 *     decrypting, on machines that already hold data. They are named here
 *     so they can be read and checked, not so they can be tuned.
 */

/** How the app PIN behaves. Safe to change: nothing on disk depends on it. */
export interface PinPolicy {
  readonly length: number;
  readonly maxAttempts: number;
  readonly baseLockoutMs: number;
  readonly attemptResetMs: number;
  readonly maxLockoutMultiplier: number;
}

/**
 * Typed as plain numbers rather than `as const` literals on purpose: these
 * are values to compare and count with, and a `5` that is typed `5` makes
 * every `useState(PIN_POLICY.maxAttempts)` reject the next number put in it.
 */
export const PIN_POLICY: PinPolicy = {
  /** Digits in an app PIN. */
  length: 6,
  /** Failed attempts allowed before a lockout starts. */
  maxAttempts: 5,
  /** Length of the first lockout; each further lockout is a multiple of it. */
  baseLockoutMs: 5 * 60 * 1000,
  /** Idle time after which the failed-attempt count returns to zero. */
  attemptResetMs: 15 * 60 * 1000,
  /** The lockout stops growing at this multiple of `baseLockoutMs`. */
  maxLockoutMultiplier: 12,
};

/** Matches a complete, well-formed app PIN. */
export const PIN_PATTERN = new RegExp(`^\\d{${PIN_POLICY.length}}$`);

/** True when `pin` is a string of exactly `PIN_POLICY.length` digits. */
export function isValidPin(pin: unknown): pin is string {
  return typeof pin === "string" && PIN_PATTERN.test(pin);
}

/** A fresh, empty digit array for the PIN entry boxes. */
export function emptyPinDigits(): string[] {
  return Array(PIN_POLICY.length).fill("");
}

/** Index of the last PIN entry box, for focus movement. */
export const LAST_PIN_INDEX = PIN_POLICY.length - 1;

/**
 * How long the `nth` consecutive lockout lasts (1-based: the first lockout
 * is `baseLockoutMs`, the second twice that, and so on up to the cap).
 */
export function lockoutDurationMs(lockoutNumber: number): number {
  const multiplier = Math.min(
    Math.max(Math.floor(lockoutNumber), 1),
    PIN_POLICY.maxLockoutMultiplier,
  );
  return PIN_POLICY.baseLockoutMs * multiplier;
}

/** `lockoutDurationMs`, rounded up to whole seconds for display. */
export function lockoutSeconds(lockoutNumber: number): number {
  return Math.ceil(lockoutDurationMs(lockoutNumber) / 1000);
}

/**
 * The lockout ordinal implied by a raw failure count. The count keeps
 * climbing past `maxAttempts`, and every failure beyond it is one more
 * lockout: 5 failures is the first, 6 the second, and so on.
 */
export function lockoutNumberForFailures(failureCount: number): number {
  return failureCount - PIN_POLICY.maxAttempts + 1;
}

/** Shown when the backend locked us out but did not say for how long. */
export const DEFAULT_LOCKOUT_SECONDS = lockoutSeconds(1);

/** The longest a lockout can get, used when PIN data is unreadable. */
export const MAX_LOCKOUT_SECONDS = lockoutSeconds(
  PIN_POLICY.maxLockoutMultiplier,
);

/** Roblox's own account PIN, which is their format and not ours. */
export const ROBLOX_ACCOUNT_PIN: { readonly length: number } = {
  length: 4,
};

/** Index positions of the Roblox account PIN boxes. */
export const ROBLOX_ACCOUNT_PIN_INDEXES = Array.from(
  { length: ROBLOX_ACCOUNT_PIN.length },
  (_, index) => index,
);

/**
 * PBKDF2 parameters for the stored PIN hash. On-disk format — see the file
 * header before changing anything here.
 */
export const PIN_HASH = {
  saltLength: 32,
  iterations: 350_000,
  keyLength: 64,
  digest: "sha512",
} as const;

/**
 * The PIN-derived key that encrypts the config blob. On-disk format — see
 * the file header before changing anything here.
 */
export const PIN_ENCRYPTION = {
  saltLength: 32,
  keyLength: 32,
  ivLength: 16,
  authTagLength: 16,
  iterations: 50_000,
  digest: "sha256",
  algorithm: "aes-256-gcm",
} as const;

/**
 * The separate, older account blob (`encryptedAccounts`), which is hex and
 * uses its own weaker KDF. On-disk format — see the file header before
 * changing anything here.
 */
export const ACCOUNT_BLOB = {
  saltLength: 16,
  ivLength: 12,
  authTagLength: 16,
  keyLength: 32,
  iterations: 100_000,
  digest: "sha256",
  algorithm: "aes-256-gcm",
} as const;

/**
 * Where each field starts in the hex account blob. Two hex characters per
 * byte; the ciphertext runs from `end` to the end of the string.
 */
export const ACCOUNT_BLOB_OFFSETS = {
  salt: 0,
  iv: ACCOUNT_BLOB.saltLength * 2,
  authTag: (ACCOUNT_BLOB.saltLength + ACCOUNT_BLOB.ivLength) * 2,
  end:
    (ACCOUNT_BLOB.saltLength +
      ACCOUNT_BLOB.ivLength +
      ACCOUNT_BLOB.authTagLength) *
    2,
} as const;
