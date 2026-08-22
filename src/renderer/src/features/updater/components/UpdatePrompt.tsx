import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Download, RefreshCw, Sparkles, X } from "lucide-react";
import { cn } from "@renderer/lib/utils";
import { useUpdater } from "../hooks/useUpdater";

/**
 * The "an update is available" prompt.
 *
 * Deliberately an in-app surface rather than a native dialog or the webview's
 * `confirm()`: those cannot be styled, block the whole window, and look like
 * they belong to the browser rather than the app.
 *
 * It checks once shortly after launch, and only ever appears on its own when
 * there is genuinely something to install. Declining is remembered per version,
 * so saying no does not turn into a prompt on every single launch.
 */

/** Versions the user has already declined. */
const DISMISSED_KEY = "updater:dismissed-versions";

/** Long enough for the app to finish its own startup work first. */
const CHECK_DELAY_MS = 8000;

function readDismissed(): string[] {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function rememberDismissed(version: string): void {
  try {
    const next = [...new Set([...readDismissed(), version])].slice(-20);
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(next));
  } catch {
    // A full or disabled store just means the prompt returns next launch.
  }
}

/** Release notes arrive as markdown-ish text; show a readable excerpt. */
function excerpt(notes: unknown): string | null {
  if (typeof notes !== "string") return null;
  const text = notes
    .replace(/^#+\s*/gm, "")
    .replace(/\*\*/g, "")
    .trim();
  if (!text) return null;
  return text.length > 320 ? `${text.slice(0, 320).trimEnd()}…` : text;
}

export const UpdatePrompt = () => {
  const {
    state,
    isDownloading,
    checkForUpdates,
    downloadUpdate,
    installUpdate,
  } = useUpdater();

  const [dismissed, setDismissed] = useState(false);
  const hasChecked = useRef(false);
  const hasStartedInstall = useRef(false);

  // One quiet check after launch. The settings card still offers a manual one.
  useEffect(() => {
    if (hasChecked.current) return;
    hasChecked.current = true;
    const timer = setTimeout(() => checkForUpdates(), CHECK_DELAY_MS);
    return () => clearTimeout(timer);
  }, [checkForUpdates]);

  const version = state?.info?.version ?? null;

  // Once the download finishes, install immediately: the user already agreed,
  // and asking a second time to do the thing they just asked for is a nag.
  useEffect(() => {
    if (state?.status === "downloaded" && !hasStartedInstall.current) {
      hasStartedInstall.current = true;
      installUpdate();
    }
  }, [state?.status, installUpdate]);

  const isDeclined = useMemo(
    () => (version ? readDismissed().includes(version) : false),
    [version],
  );

  const busy = isDownloading || state?.status === "downloaded";

  const visible =
    !dismissed &&
    !isDeclined &&
    Boolean(version) &&
    (state?.status === "available" ||
      state?.status === "downloading" ||
      state?.status === "downloaded" ||
      (state?.status === "error" && busy));

  if (!visible) return null;

  const percent = Math.round(state?.progress?.percent ?? 0);
  const notes = excerpt(state?.info?.releaseNotes);

  const decline = () => {
    if (version) rememberDismissed(version);
    setDismissed(true);
  };

  return (
    <AnimatePresence>
      <motion.div
        role="dialog"
        aria-modal="false"
        aria-label={`Version ${version} is available`}
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.98 }}
        transition={{ type: "spring", stiffness: 380, damping: 30 }}
        className={cn(
          "fixed bottom-5 right-5 z-[100] w-[360px] overflow-hidden",
          "rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]",
          "shadow-[0_20px_50px_rgba(0,0,0,0.45)]",
        )}
      >
        <div className="flex items-start gap-3 p-4">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-color-soft)]">
            <Sparkles size={17} className="text-[var(--accent-color)]" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-[var(--color-text-primary)]">
              Version {version} is available
            </div>
            {notes ? (
              <p className="mt-1 max-h-24 overflow-y-auto whitespace-pre-line text-[12px] leading-relaxed text-[var(--color-text-muted)] scrollbar-hide">
                {notes}
              </p>
            ) : (
              <p className="mt-1 text-[12px] text-[var(--color-text-muted)]">
                A newer version of santi.manager is ready to install.
              </p>
            )}
          </div>

          {!busy && (
            <button
              type="button"
              onClick={decline}
              aria-label="Dismiss"
              className="rounded-md p-1 text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]"
            >
              <X size={15} />
            </button>
          )}
        </div>

        {busy ? (
          <div className="px-4 pb-4">
            <div className="mb-2 flex items-center justify-between text-[11px] text-[var(--color-text-muted)]">
              <span className="flex items-center gap-1.5">
                <RefreshCw size={11} className="animate-spin" />
                {state?.status === "downloaded"
                  ? "Restarting to install…"
                  : "Downloading…"}
              </span>
              {state?.status !== "downloaded" && <span>{percent}%</span>}
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-surface-muted)]">
              <motion.div
                className="h-full rounded-full bg-[var(--accent-color)]"
                initial={{ width: 0 }}
                animate={{
                  width: state?.status === "downloaded" ? "100%" : `${percent}%`,
                }}
                transition={{ ease: "easeOut", duration: 0.3 }}
              />
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-4 pb-4">
            <button
              type="button"
              onClick={() => downloadUpdate()}
              className={cn(
                "flex h-9 flex-1 items-center justify-center gap-2 rounded-lg text-[13px] font-semibold",
                "bg-[var(--accent-color)] text-white transition-opacity hover:opacity-90",
              )}
            >
              <Download size={14} />
              Update now
            </button>
            <button
              type="button"
              onClick={decline}
              className={cn(
                "h-9 rounded-lg px-3 text-[13px] font-medium",
                "border border-[var(--color-border)] text-[var(--color-text-secondary)]",
                "transition-colors hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]",
              )}
            >
              Not now
            </button>
          </div>
        )}

        {state?.status === "error" && state.error && (
          <div className="border-t border-[var(--color-border)] px-4 py-2 text-[11px] text-red-400">
            {state.error}
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
};

export default UpdatePrompt;
