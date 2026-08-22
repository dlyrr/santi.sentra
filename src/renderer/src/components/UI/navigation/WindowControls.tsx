import { useEffect, useState } from "react";
import { Minus, Square, Copy, X } from "lucide-react";
import { cn } from "@renderer/lib/utils";

/**
 * Caption buttons.
 *
 * Electron drew these for us on Windows via `titleBarOverlay`, and Tauri has no
 * equivalent — the window is created with `decorations: false`, so the app has
 * to paint them. macOS keeps its native traffic lights, so this renders nothing
 * there.
 */
export const WindowControls = ({ className }: { className?: string }) => {
  const [isMaximized, setIsMaximized] = useState(false);
  const isMac = window.platform?.isMac ?? false;

  useEffect(() => {
    if (isMac) return;
    let cancelled = false;
    window.electron.ipcRenderer
      .invoke("window:is-maximized")
      .then((value) => {
        if (!cancelled) setIsMaximized(Boolean(value));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [isMac]);

  if (isMac) return null;

  const call = async (channel: string) => {
    const result = await window.electron.ipcRenderer.invoke(channel);
    if (channel === "window:toggle-maximize") setIsMaximized(Boolean(result));
  };

  const buttonClass =
    "h-full w-[46px] inline-flex items-center justify-center text-[var(--color-text-muted)] " +
    "transition-colors duration-150 hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]";

  return (
    <div className={cn("flex items-stretch h-full shrink-0", className)}>
      <button
        type="button"
        aria-label="Minimize"
        className={buttonClass}
        onClick={() => void call("window:minimize")}
      >
        <Minus size={15} strokeWidth={1.8} />
      </button>
      <button
        type="button"
        aria-label={isMaximized ? "Restore" : "Maximize"}
        className={buttonClass}
        onClick={() => void call("window:toggle-maximize")}
      >
        {isMaximized ? (
          <Copy size={12} strokeWidth={1.8} />
        ) : (
          <Square size={12} strokeWidth={1.8} />
        )}
      </button>
      <button
        type="button"
        aria-label="Close"
        className={cn(
          buttonClass,
          "hover:bg-red-600 hover:text-white focus-visible:bg-red-600",
        )}
        onClick={() => void call("window:close")}
      >
        <X size={15} strokeWidth={1.8} />
      </button>
    </div>
  );
};

export default WindowControls;
