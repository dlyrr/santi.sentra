/**
 * Exercises the app PIN end to end, and checks nothing has re-hardcoded it.
 *
 * The PIN is the one thing standing between a stolen laptop and every
 * ROBLOSECURITY cookie in the config, and it is enforced across three
 * layers that used to each carry their own copy of the rules. This runs the
 * real PinService — not a reimplementation — against the same
 * `@shared/pinPolicy` the renderer draws its input boxes from, so a change
 * that only half-applies fails here instead of on a user's machine.
 *
 * safeStorage is stubbed: its OS-keychain round trip is what
 * `test-safestorage.mjs` covers, and stubbing it lets the encrypted-PIN-data
 * path run on every platform rather than only on Windows.
 *
 *   node scripts/test-pin.mjs
 */

import { buildSync } from "esbuild";
import { pbkdf2Sync, randomBytes } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { resolve, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = resolve(root, "src-tauri/binaries");
const outfile = resolve(outDir, "pin-test.cjs");
const stub = resolve(outDir, "pin-test-electron-stub.cjs");

let failures = 0;
let checks = 0;

function check(what, condition, detail) {
  checks++;
  if (condition) return true;
  failures++;
  console.error(`  FAIL  ${what}${detail ? `: ${detail}` : ""}`);
  return false;
}

function equal(what, actual, expected) {
  return check(
    what,
    actual === expected,
    `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
  );
}

mkdirSync(outDir, { recursive: true });

/**
 * Electron's safeStorage, minus the OS. Base64 stands in for the keychain:
 * the service only needs a reversible round trip to drive its encrypted-PIN
 * path, and any real crypto here would be testing the stub.
 */
writeFileSync(
  stub,
  `exports.safeStorage = {
     isEncryptionAvailable: () => true,
     encryptString: (s) => Buffer.from("stub:" + s, "utf8"),
     decryptString: (b) => {
       const s = Buffer.from(b).toString("utf8");
       if (!s.startsWith("stub:")) throw new Error("not a stub blob");
       return s.slice(5);
     },
   };\n`,
);

try {
  buildSync({
    entryPoints: [
      resolve(root, "src/main/modules/system/PinService.ts"),
      resolve(root, "src/shared/pinPolicy.ts"),
    ],
    outdir: outDir,
    entryNames: "pin-test-[name]",
    bundle: true,
    platform: "node",
    format: "cjs",
    outExtension: { ".js": ".cjs" },
    alias: { electron: stub, "@shared": resolve(root, "src/shared") },
    logLevel: "error",
  });

  const require = createRequire(outfile);
  const { pinService } = require(resolve(outDir, "pin-test-PinService.cjs"));
  const policy = require(resolve(outDir, "pin-test-pinPolicy.cjs"));
  const {
    PIN_POLICY,
    PIN_PATTERN,
    PIN_HASH,
    PIN_ENCRYPTION,
    ACCOUNT_BLOB_OFFSETS,
    DEFAULT_LOCKOUT_SECONDS,
    isValidPin,
    emptyPinDigits,
    lockoutDurationMs,
    lockoutSeconds,
    lockoutNumberForFailures,
  } = policy;

  const digits = (n) =>
    Array.from({ length: PIN_POLICY.length }, (_, i) => (n + i) % 10).join("");
  const PIN = digits(1);
  const WRONG = digits(7);

  console.log(
    `policy: ${PIN_POLICY.length}-digit PIN, ` +
      `${PIN_POLICY.maxAttempts} attempts, ` +
      `first lockout ${DEFAULT_LOCKOUT_SECONDS}s`,
  );

  // --- the policy itself -------------------------------------------------

  check("PIN_PATTERN accepts a policy-length PIN", PIN_PATTERN.test(PIN));
  check("PIN_PATTERN rejects a short PIN", !PIN_PATTERN.test(PIN.slice(1)));
  check("PIN_PATTERN rejects a long PIN", !PIN_PATTERN.test(PIN + "0"));
  check(
    "PIN_PATTERN rejects letters",
    !PIN_PATTERN.test("a".repeat(PIN_POLICY.length)),
  );
  check("isValidPin rejects non-strings", !isValidPin(123456));
  equal(
    "emptyPinDigits has one slot per digit",
    emptyPinDigits().length,
    PIN_POLICY.length,
  );
  check(
    "emptyPinDigits starts blank",
    emptyPinDigits().every((d) => d === ""),
  );

  equal(
    "first lockout is the base duration",
    lockoutDurationMs(1),
    PIN_POLICY.baseLockoutMs,
  );
  equal(
    "second lockout doubles",
    lockoutDurationMs(2),
    PIN_POLICY.baseLockoutMs * 2,
  );
  equal(
    "lockout stops growing at the cap",
    lockoutDurationMs(PIN_POLICY.maxLockoutMultiplier + 5),
    PIN_POLICY.baseLockoutMs * PIN_POLICY.maxLockoutMultiplier,
  );
  equal(
    "a zeroth lockout still lasts the base duration",
    lockoutDurationMs(0),
    PIN_POLICY.baseLockoutMs,
  );
  equal(
    "the failure that trips the lock is the first lockout",
    lockoutNumberForFailures(PIN_POLICY.maxAttempts),
    1,
  );
  equal(
    "each further failure is one more lockout",
    lockoutNumberForFailures(PIN_POLICY.maxAttempts + 3),
    4,
  );
  equal(
    "DEFAULT_LOCKOUT_SECONDS is the first lockout",
    DEFAULT_LOCKOUT_SECONDS,
    lockoutSeconds(1),
  );

  // The account blob is hex on disk with fixed field offsets. These four
  // numbers were literals in StorageService before they were derived from
  // ACCOUNT_BLOB; if deriving them ever moves one, every existing
  // encryptedAccounts blob stops decrypting.
  equal("account blob: salt offset", ACCOUNT_BLOB_OFFSETS.salt, 0);
  equal("account blob: iv offset", ACCOUNT_BLOB_OFFSETS.iv, 32);
  equal("account blob: auth tag offset", ACCOUNT_BLOB_OFFSETS.authTag, 56);
  equal("account blob: ciphertext offset", ACCOUNT_BLOB_OFFSETS.end, 88);

  // --- the hash-and-verify path the app actually stores ------------------

  const stored = pinService.createPinHash(PIN);
  check(
    "createPinHash returns a hash",
    typeof stored === "string" && stored.length > 0,
  );

  const parts = String(stored).split(":");
  equal("stored hash has salt, hash and encryption salt", parts.length, 3);
  check(
    "stored hash is hex",
    parts.every((p) => /^[0-9a-f]+$/.test(p)),
  );
  equal(
    "salt is PIN_HASH.saltLength bytes",
    parts[0].length,
    PIN_HASH.saltLength * 2,
  );
  equal(
    "hash is PIN_HASH.keyLength bytes",
    parts[1].length,
    PIN_HASH.keyLength * 2,
  );
  equal(
    "encryption salt is PIN_ENCRYPTION.saltLength bytes",
    parts[2].length,
    PIN_ENCRYPTION.saltLength * 2,
  );

  check(
    "the same PIN hashes differently twice",
    pinService.createPinHash(PIN) !== stored,
  );

  // The stored hash has to be exactly what PIN_HASH describes: if the
  // service quietly used different KDF parameters, PINs set by one build
  // would not verify in the next.
  const recomputed = pbkdf2Sync(
    PIN,
    Buffer.from(parts[0], "hex"),
    PIN_HASH.iterations,
    PIN_HASH.keyLength,
    PIN_HASH.digest,
  ).toString("hex");
  equal(
    "the hash matches the documented PIN_HASH parameters",
    parts[1],
    recomputed,
  );

  pinService.initialize();
  check("the right PIN verifies", pinService.verifyPin(PIN, stored).success);
  check(
    "verifying marks the session unlocked",
    pinService.isPinCurrentlyVerified(),
  );
  check("verifying derives the config key", pinService.hasEncryptionKey());

  pinService.initialize();
  check(
    "a wrong PIN does not verify",
    !pinService.verifyPin(WRONG, stored).success,
  );
  check(
    "a wrong PIN leaves the session locked",
    !pinService.isPinCurrentlyVerified(),
  );
  check("a wrong PIN derives no key", !pinService.hasEncryptionKey());
  check(
    "an empty PIN does not verify",
    !pinService.verifyPin("", stored).success,
  );
  check(
    "a missing stored hash does not verify",
    !pinService.verifyPin(PIN, "").success,
  );

  // --- the PIN-derived key that encrypts the config ----------------------

  pinService.initialize();
  pinService.verifyPin(PIN, stored);
  const secret = JSON.stringify({ cookie: "ROBLOSECURITY-éüñ-日本語", id: 1 });
  const sealed = pinService.encryptWithVerifiedKey(secret);
  check(
    "the verified key encrypts",
    typeof sealed === "string" && sealed !== secret,
  );
  equal(
    "the verified key round-trips",
    pinService.decryptWithVerifiedKey(sealed),
    secret,
  );

  pinService.clearVerification();
  equal(
    "locking drops the key",
    pinService.decryptWithVerifiedKey(sealed),
    null,
  );
  check(
    "locking clears the verified flag",
    !pinService.isPinCurrentlyVerified(),
  );

  const encryptionSalt = randomBytes(PIN_ENCRYPTION.saltLength).toString(
    "base64",
  );
  const byPin = pinService.encryptWithPin(secret, PIN, encryptionSalt);
  check("encryptWithPin produces a blob", typeof byPin === "string");
  equal(
    "decryptWithPin round-trips",
    pinService.decryptWithPin(byPin, PIN, encryptionSalt),
    secret,
  );
  equal(
    "a wrong PIN cannot decrypt",
    pinService.decryptWithPin(byPin, WRONG, encryptionSalt),
    null,
  );

  // --- lockout, on the encrypted-PIN-data path ---------------------------

  /** The safeStorage-wrapped PIN record, as it is held on disk. */
  function sealPinData(pin, lockout) {
    const salt = randomBytes(PIN_HASH.saltLength);
    const hash = pbkdf2Sync(
      pin,
      salt,
      PIN_HASH.iterations,
      PIN_HASH.keyLength,
      PIN_HASH.digest,
    );
    return Buffer.from(
      "stub:" +
        JSON.stringify({
          hash: hash.toString("base64"),
          salt: salt.toString("base64"),
          encryptionSalt: randomBytes(PIN_ENCRYPTION.saltLength).toString(
            "base64",
          ),
          ...(lockout ? { lockout } : {}),
        }),
      "utf8",
    ).toString("base64");
  }

  pinService.initialize();
  let record = sealPinData(PIN);

  const malformed = pinService.verifyPinEncrypted(PIN.slice(1), record);
  check(
    "a short PIN is rejected before any attempt is spent",
    !malformed.success,
  );
  equal(
    "a short PIN costs no attempts",
    malformed.remainingAttempts,
    PIN_POLICY.maxAttempts,
  );

  for (let attempt = 1; attempt < PIN_POLICY.maxAttempts; attempt++) {
    const result = pinService.verifyPinEncrypted(WRONG, record);
    if (result.updatedEncryptedData) record = result.updatedEncryptedData;
    check(`attempt ${attempt} fails`, !result.success);
    check(`attempt ${attempt} does not lock yet`, !result.locked);
    equal(
      `attempt ${attempt} counts down`,
      result.remainingAttempts,
      PIN_POLICY.maxAttempts - attempt,
    );
  }

  const tripped = pinService.verifyPinEncrypted(WRONG, record);
  if (tripped.updatedEncryptedData) record = tripped.updatedEncryptedData;
  check(`attempt ${PIN_POLICY.maxAttempts} locks`, tripped.locked);
  equal("a locked account has no attempts left", tripped.remainingAttempts, 0);
  equal(
    "the lockout is the first lockout's length",
    tripped.lockoutSeconds,
    lockoutSeconds(1),
  );

  const whileLocked = pinService.verifyPinEncrypted(PIN, record);
  check("the right PIN is refused while locked", !whileLocked.success);
  check("the right PIN does not clear the lockout", whileLocked.locked);

  const status = pinService.getLockoutStatus(record);
  check("the lockout survives a reload from disk", status.locked);
  check(
    "the reported lockout is still counting down",
    status.lockoutSeconds > 0,
  );

  const corrupted = pinService.getLockoutStatus("not-a-pin-record");
  check("unreadable PIN data locks rather than opens", corrupted.locked);
  equal(
    "unreadable PIN data spends every attempt",
    corrupted.remainingAttempts,
    0,
  );

  // A record whose first lockout has already expired: the next one has to be
  // longer, or the ladder that makes brute force expensive is not a ladder.
  pinService.initialize();
  let escalating = sealPinData(PIN, {
    count: 0,
    lastAttempt: Date.now() - 1000,
    lockedUntil: Date.now() - 1000,
    lockoutCount: 1,
  });
  let secondLockout = null;
  for (let attempt = 1; attempt <= PIN_POLICY.maxAttempts; attempt++) {
    secondLockout = pinService.verifyPinEncrypted(WRONG, escalating);
    if (secondLockout.updatedEncryptedData) {
      escalating = secondLockout.updatedEncryptedData;
    }
  }
  check("an expired lockout lets attempts resume", secondLockout.locked);
  equal(
    "the second lockout is longer than the first",
    secondLockout.lockoutSeconds,
    lockoutSeconds(2),
  );

  pinService.initialize();
  const fresh = sealPinData(PIN);
  const opened = pinService.verifyPinEncrypted(PIN, fresh);
  check("the right PIN opens a fresh record", opened.success);
  check("opening derives the config key", pinService.hasEncryptionKey());
  equal(
    "opening restores every attempt",
    opened.remainingAttempts,
    PIN_POLICY.maxAttempts,
  );

  // --- nothing has re-hardcoded the policy -------------------------------

  // Each of these literals used to sit in the files below, out of step with
  // every other copy. `@shared/pinPolicy` owns them now, and this is what
  // stops the next PIN change from being written out by hand again.
  const banned = [
    [/\bArray\(\s*6\s*\)/, "a hardcoded 6-box PIN input"],
    [/\b350[_]?000\b/, "hardcoded PBKDF2 iterations"],
    [/\/\^\\d\{\d+\}\$\//, "a hardcoded PIN-format regex"],
    [/\b5\s*\*\s*60\s*\*\s*1000\b/, "a hardcoded lockout duration"],
    [/\b15\s*\*\s*60\s*\*\s*1000\b/, "a hardcoded attempt-reset window"],
    [/\|\|\s*300\b/, "a hardcoded lockout fallback"],
    [/\[\s*0,\s*1,\s*2,\s*3\s*\]/, "hardcoded account-PIN boxes"],
  ];
  const guarded = [
    "src/main/modules/system/PinService.ts",
    "src/main/modules/system/StorageService.ts",
    "src/renderer/src/components/UI/security/PinLockScreen.tsx",
    "src/renderer/src/components/UI/security/PinSetupDialog.tsx",
    "src/renderer/src/features/onboarding/components/PinSetupStep.tsx",
    "src/renderer/src/features/settings/components/SecuritySettingsTab.tsx",
    "src/renderer/src/features/accountSettings/AccountSettingsTab.tsx",
    "src/renderer/src/onboarding/components/PinSetupStep.tsx",
    "src/renderer/src/settings/SettingsTab.tsx",
  ];

  for (const file of guarded) {
    const source = readFileSync(resolve(root, file), "utf8");
    for (const [pattern, what] of banned) {
      check(`${relative(root, file)} has no ${what}`, !pattern.test(source));
    }
    check(
      `${relative(root, file)} draws its PIN rules from @shared/pinPolicy`,
      source.includes("@shared/pinPolicy"),
    );
  }

  if (failures > 0) {
    console.error(`\nFAIL: ${failures} of ${checks} PIN checks failed`);
    process.exitCode = 1;
  } else {
    console.log(`pin: ${checks} checks passed`);
  }
} catch (error) {
  console.error(`FAIL: ${error.message}`);
  process.exitCode = 1;
} finally {
  rmSync(outfile, { force: true });
  rmSync(stub, { force: true });
  rmSync(resolve(outDir, "pin-test-PinService.cjs"), { force: true });
  rmSync(resolve(outDir, "pin-test-pinPolicy.cjs"), { force: true });
}
