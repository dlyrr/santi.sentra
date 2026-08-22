import { useMemo, useState } from "react";
import { Gamepad2, HardDrive, Rocket, User } from "lucide-react";
import { cn } from "@renderer/lib/utils";
import { useInstallations } from "@renderer/features/install/stores/useInstallationsStore";
import type { Account } from "@renderer/types";

/**
 * Launch.
 *
 * The bootstrapper's job, brought into the app: pick a build, pick an account,
 * go. santi.weblauncher still owns version pinning and the `roblox-player:`
 * protocol handler — this is the launch itself, for when you are already here.
 *
 * With a place id it joins that experience as the chosen account; without one
 * it just starts the client, which is what the launcher's own button does.
 */

interface LaunchTabProps {
  accounts: Account[];
  selectedAccount: Account | null;
}

export const LaunchTab = ({ accounts, selectedAccount }: LaunchTabProps) => {
  const installations = useInstallations();

  const usable = useMemo(
    () => installations.filter((install) => install.status === "Ready"),
    [installations],
  );

  const [installId, setInstallId] = useState<string | null>(null);
  const [accountId, setAccountId] = useState<string | null>(
    selectedAccount?.id ?? null,
  );
  const [placeId, setPlaceId] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  const install =
    usable.find((entry) => entry.id === installId) ?? usable[0] ?? null;
  const account =
    accounts.find((entry) => entry.id === accountId) ??
    selectedAccount ??
    accounts[0] ??
    null;

  const launch = async () => {
    if (!install || busy) return;

    setBusy(true);
    setStatus("");
    try {
      const place = placeId.trim();

      if (place) {
        if (!account?.cookie) {
          // Falling back to a plain launch beats refusing outright: the client
          // opens, and the user can join from inside it.
          await window.api.launchRobloxInstall(install.path);
          setStatus(
            "Started Roblox signed out — joining an experience directly needs a saved account.",
          );
          return;
        }
        await window.api.launchGame(
          account.cookie,
          place,
          undefined,
          undefined,
          install.path,
        );
        setStatus(`Joining ${place} as ${account.displayName || account.username}.`);
      } else {
        // No place: just start the client from this build.
        await window.api.launchRobloxInstall(install.path);
        setStatus(`Started ${install.name}.`);
      }
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "The launch could not be started.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="flex items-center gap-3 px-6 pt-6 pb-4">
        <Rocket size={20} className="text-[var(--accent-color)]" />
        <div>
          <h1 className="text-xl font-bold text-[var(--color-text-primary)]">
            Launch
          </h1>
          <p className="text-[12px] text-[var(--color-text-muted)]">
            Start Roblox from a chosen build, signed in as a chosen account.
          </p>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-6 pb-8">
        {/* ── Build ── */}
        <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <div className="mb-3 flex items-center gap-2">
            <HardDrive size={15} className="text-[var(--color-text-muted)]" />
            <h2 className="text-[13px] font-semibold text-[var(--color-text-primary)]">
              Build
            </h2>
          </div>

          {usable.length === 0 ? (
            <p className="text-[12px] text-[var(--color-text-muted)]">
              No installations are ready yet. Add one from the Install tab, or let
              santi.weblauncher install a build.
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {usable.map((entry) => {
                const active = install?.id === entry.id;
                return (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => setInstallId(entry.id)}
                    className={cn(
                      "rounded-xl border-2 p-3 text-left transition-colors",
                      active
                        ? "border-[var(--accent-color)] bg-[var(--accent-color-faint)]"
                        : "border-[var(--color-border)] bg-[var(--color-surface-hover)] hover:border-[var(--color-border-strong)]",
                    )}
                  >
                    <div className="truncate text-[13px] font-semibold text-[var(--color-text-primary)]">
                      {entry.name}
                    </div>
                    <div className="mt-0.5 truncate text-[11px] text-[var(--color-text-muted)]">
                      {entry.binaryType} · {entry.version}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* ── Account ── */}
        <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <div className="mb-3 flex items-center gap-2">
            <User size={15} className="text-[var(--color-text-muted)]" />
            <h2 className="text-[13px] font-semibold text-[var(--color-text-primary)]">
              Account
            </h2>
          </div>

          {accounts.length === 0 ? (
            <p className="text-[12px] text-[var(--color-text-muted)]">
              No account saved. Roblox still starts — it just opens signed out.
              An account is only needed to join a specific experience.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {accounts.map((entry) => {
                const active = account?.id === entry.id;
                return (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => setAccountId(entry.id)}
                    className={cn(
                      "flex items-center gap-2 rounded-full border-2 py-1 pl-1 pr-3 transition-colors",
                      active
                        ? "border-[var(--accent-color)] bg-[var(--accent-color-faint)]"
                        : "border-[var(--color-border)] bg-[var(--color-surface-hover)] hover:border-[var(--color-border-strong)]",
                    )}
                  >
                    {entry.avatarUrl ? (
                      <img
                        src={entry.avatarUrl}
                        alt=""
                        className="h-6 w-6 rounded-full object-cover"
                      />
                    ) : (
                      <span className="h-6 w-6 rounded-full bg-[var(--color-surface-muted)]" />
                    )}
                    <span className="max-w-[160px] truncate text-[12.5px] text-[var(--color-text-primary)]">
                      {entry.displayName || entry.username}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* ── Destination ── */}
        <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <div className="mb-3 flex items-center gap-2">
            <Gamepad2 size={15} className="text-[var(--color-text-muted)]" />
            <h2 className="text-[13px] font-semibold text-[var(--color-text-primary)]">
              Experience
            </h2>
          </div>
          <input
            value={placeId}
            onChange={(event) => setPlaceId(event.target.value)}
            placeholder="Place ID — leave empty to just open Roblox"
            inputMode="numeric"
            className={cn(
              "h-10 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-hover)] px-3",
              "text-[13px] text-[var(--color-text-primary)] outline-none",
              "placeholder:text-[var(--color-text-muted)]",
              "focus-visible:border-[var(--accent-color-border)]",
            )}
          />
        </section>

        <button
          type="button"
          onClick={launch}
          disabled={busy || !install}
          className={cn(
            "h-11 w-full rounded-xl text-[14px] font-semibold transition-opacity",
            "bg-[var(--accent-color)] text-[var(--accent-color-foreground)]",
            "hover:opacity-90 disabled:opacity-40",
          )}
        >
          {busy ? "Starting…" : "Launch Roblox"}
        </button>

        {status && (
          <p className="text-center text-[12px] text-[var(--color-text-muted)]">
            {status}
          </p>
        )}
      </div>
    </div>
  );
};

export default LaunchTab;
