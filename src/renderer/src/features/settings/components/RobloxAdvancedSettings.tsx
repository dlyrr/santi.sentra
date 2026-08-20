import { useState, useCallback, useEffect, useMemo } from "react";
import {
  Save,
  Monitor,
  Cpu,
  Zap,
  RefreshCw,
  Tag,
  Database,
  Layers,
  Clock,
} from "lucide-react";
import type { Settings } from "@renderer/types";
import CustomCheckbox from "../../../components/UI/buttons/CustomCheckbox";

interface RobloxAdvancedSettingsProps {
  settings: Settings;
  onSettingsChange: (settings: Partial<Settings>) => Promise<void>;
  onClose: () => void;
  isLoading?: boolean;
}

const isWindows = window.platform?.isWindows !== false;

type RobloxOnlySettings = ReturnType<typeof extractRobloxSettings>;

function extractRobloxSettings(settings: Settings) {
  return {
    enableOptimizations: settings.enableOptimizations ?? false,
    useDirectX12: settings.useDirectX12 ?? false,
    lowEndGraphics: settings.lowEndGraphics ?? false,
    antiAfkEnabled: settings.antiAfkEnabled ?? false,
    renameWindowsEnabled: settings.renameWindowsEnabled ?? false,
    framerateCapEnabled: settings.framerateCapEnabled ?? false,
    framerateCapValue: settings.framerateCapValue ?? 60,
    optimizeRamEnabled: settings.optimizeRamEnabled ?? false,
    ramOptimization: settings.ramOptimization ?? 2048,
    cpuOptimization: settings.cpuOptimization ?? 0,
    headlessModeEnabled: settings.headlessModeEnabled ?? false,
    timeoutRelaunchEnabled: settings.timeoutRelaunchEnabled ?? false,
    timeoutRelaunchSeconds: settings.timeoutRelaunchSeconds ?? 3600,
    windowLayoutEnabled: settings.windowLayoutEnabled ?? false,
    windowLayoutPattern: settings.windowLayoutPattern ?? "grid",
    windowLayoutSpacing: settings.windowLayoutSpacing ?? 12,
    windowLayoutColumns: settings.windowLayoutColumns ?? 3,
    windowLayoutWidth: settings.windowLayoutWidth ?? 0,
    windowLayoutHeight: settings.windowLayoutHeight ?? 0,
  };
}

function BentoCard({
  icon,
  label,
  desc,
  control,
  extraInput,
  disabled,
  colSpan = 1,
}: {
  icon: React.ReactNode;
  label: string;
  desc: string;
  control?: React.ReactNode;
  extraInput?: React.ReactNode;
  disabled?: boolean;
  colSpan?: 1 | 2;
}) {
  return (
    <div
      className={`relative overflow-hidden group rounded-lg border transition-colors duration-200 ${disabled ? "opacity-40 border-[var(--color-border)] bg-[var(--color-surface-hover)]" : "bg-[var(--color-surface)] border-[var(--color-border)] hover:border-[var(--color-border-strong)]"} ${colSpan === 2 ? "col-span-2" : "col-span-1"} flex flex-col p-3`}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-[var(--accent-color)]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

      <div className="flex items-start justify-between mb-2 z-10 relative">
        <div
          className={`w-8 h-8 rounded-md flex items-center justify-center transition-colors ${disabled ? "bg-[var(--color-surface-secondary)] text-[var(--color-text-muted)]" : "bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)] group-hover:text-[var(--accent-color)] border border-[var(--color-border)]"}`}
        >
          {icon}
        </div>
        {control && <div className="shrink-0">{control}</div>}
      </div>

      <div className="mt-auto z-10 relative">
        <h4 className="text-[13px] font-semibold text-[var(--color-text-primary)] leading-tight mb-1">
          {label}
        </h4>
        <p className="text-[11px] text-[var(--color-text-muted)] leading-snug line-clamp-2">
          {desc}
        </p>
      </div>

      {extraInput && (
        <div className="mt-2 pt-2 border-t border-[var(--color-border)] z-10 relative">
          {extraInput}
        </div>
      )}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="col-span-2 flex items-center gap-3 mt-3 mb-1">
      <span className="text-[11px] font-semibold text-[var(--color-text-secondary)]">
        {children}
      </span>
      <div className="flex-1 h-px bg-[var(--color-border)]" />
    </div>
  );
}

export default function RobloxAdvancedSettings({
  settings,
  onSettingsChange,
  onClose,
  isLoading = false,
}: RobloxAdvancedSettingsProps) {
  const robloxSettings = useMemo(
    () => extractRobloxSettings(settings),
    [
      settings.enableOptimizations,
      settings.useDirectX12,
      settings.lowEndGraphics,
      settings.antiAfkEnabled,
      settings.renameWindowsEnabled,
      settings.framerateCapEnabled,
      settings.framerateCapValue,
      settings.optimizeRamEnabled,
      settings.ramOptimization,
      settings.cpuOptimization,
      settings.headlessModeEnabled,
      settings.timeoutRelaunchEnabled,
      settings.timeoutRelaunchSeconds,
      settings.windowLayoutEnabled,
      settings.windowLayoutPattern,
      settings.windowLayoutSpacing,
      settings.windowLayoutColumns,
      settings.windowLayoutWidth,
      settings.windowLayoutHeight,
    ],
  );
  const [local, setLocal] = useState(robloxSettings);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = useCallback(
    <K extends keyof RobloxOnlySettings>(
      key: K,
      value: RobloxOnlySettings[K],
    ) => {
      setLocal((prev) => ({ ...prev, [key]: value }));
      setError(null);
    },
    [],
  );

  useEffect(() => {
    setLocal(robloxSettings);
    setError(null);
  }, [robloxSettings]);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    setError(null);
    try {
      const changes: Partial<Settings> = {};
      let hasChanges = false;
      let layoutChanged = false;

      const robloxKeys = Object.keys(
        robloxSettings,
      ) as (keyof typeof robloxSettings)[];
      for (const k of robloxKeys) {
        if ((local as any)[k] !== (robloxSettings as any)[k]) {
          (changes as any)[k] = (local as any)[k];
          hasChanges = true;
          if (k.startsWith("windowLayout")) {
            layoutChanged = true;
          }
        }
      }

      if (hasChanges) {
        await onSettingsChange(changes);
        if (layoutChanged && local.windowLayoutEnabled) {
          window.api.tileGameWindows({
            pattern: local.windowLayoutPattern ?? "grid",
            spacing: local.windowLayoutSpacing ?? 12,
            columns: local.windowLayoutColumns ?? 3,
            width: local.windowLayoutWidth ?? 0,
            height: local.windowLayoutHeight ?? 0,
          }).catch(e => console.error("Failed to tile windows immediately:", e));
        }
      }
      onClose();
    } catch (e) {
      const errorMsg =
        e instanceof Error ? e.message : "Failed to save settings";
      console.error("[RobloxAdvancedSettings] save error:", e);
      setError(errorMsg);
    } finally {
      setIsSaving(false);
    }
  }, [local, robloxSettings, onSettingsChange, onClose]);

  const busy = isSaving || isLoading;
  const ic = 14;

  return (
    <div className="flex flex-col h-full -mx-1">
      {error && (
        <div className="shrink-0 mx-1 mb-3 p-3 rounded-lg bg-red-500/10 border border-red-500/30 flex items-start gap-2">
          <div className="text-red-400 text-xs leading-snug flex-1">
            {error}
          </div>
          <button
            onClick={() => setError(null)}
            className="shrink-0 text-red-400 hover:text-red-300 text-xs font-bold"
          >
            ✕
          </button>
        </div>
      )}
      <div className="flex-1 overflow-y-auto px-1 pb-4 styled-scrollbar min-h-0">
        <div className="grid grid-cols-2 gap-2.5">
          <SectionLabel>System & resources</SectionLabel>

          <BentoCard
            icon={<Zap size={ic} />}
            label="System optimizations"
            desc="Enable process tuning plus the RAM and CPU limits below."
            disabled={busy || !isWindows}
            control={
              <CustomCheckbox
                checked={!!local.enableOptimizations}
                onChange={() => {
                  const enabled = !local.enableOptimizations;
                  set("enableOptimizations", enabled);
                  set("optimizeRamEnabled", enabled);
                  set("ramOptimization", enabled ? Math.max(512, local.ramOptimization || 2048) : local.ramOptimization);
                  set("cpuOptimization", enabled ? Math.max(20, local.cpuOptimization || 20) : 0);
                }}
                disabled={busy || !isWindows}
              />
            }
          />

          <BentoCard
            icon={<Database size={ic} />}
            label="RAM limiter"
            desc="Trim a client working set when it grows past this limit."
            disabled={busy || !isWindows}
            control={
              <CustomCheckbox
                checked={!!local.optimizeRamEnabled}
                onChange={() => {
                  set("optimizeRamEnabled", !local.optimizeRamEnabled);
                }}
                disabled={busy || !isWindows}
              />
            }
            extraInput={
              local.optimizeRamEnabled && (
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-medium text-[var(--color-text-secondary)]">
                    Limit
                  </span>
                  <input
                    type="number"
                    min="100"
                    max="16384"
                    step="256"
                    value={Math.max(
                      100,
                      Math.min(16384, local.ramOptimization || 2048),
                    )}
                    onChange={(e) => {
                      const val = Math.max(
                        100,
                        Math.min(16384, parseInt(e.target.value, 10) || 2048),
                      );
                      set("ramOptimization", val);
                    }}
                    disabled={busy || !isWindows}
                    className="w-16 text-xs px-2 py-1 rounded bg-[var(--color-surface-secondary)] border border-[var(--color-border)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--accent-color)] text-center transition-colors"
                  />
                </div>
              )
            }
          />

          <BentoCard
            icon={<Cpu size={ic} />}
            label="CPU limiter"
            desc="Lower client priority and leave CPU capacity for Windows."
            disabled={busy || !isWindows}
            control={
              <CustomCheckbox
                checked={!!local.cpuOptimization}
                onChange={() => {
                    set("cpuOptimization", local.cpuOptimization ? 0 : 20);
                }}
                disabled={busy || !isWindows}
              />
            }
            extraInput={
              !!local.cpuOptimization && (
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-medium text-[var(--color-text-secondary)]">
                    Target
                  </span>
                  <input
                    type="number"
                    min="20"
                    max="100"
                    step="5"
                    value={Math.max(
                      20,
                      Math.min(100, local.cpuOptimization || 20),
                    )}
                    onChange={(e) => {
                      const val = Math.max(
                        20,
                        Math.min(100, parseInt(e.target.value, 10) || 20),
                      );
                      set("cpuOptimization", val);
                    }}
                    disabled={busy || !isWindows}
                    className="w-16 text-xs px-2 py-1 rounded bg-[var(--color-surface-secondary)] border border-[var(--color-border)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--accent-color)] text-center transition-colors"
                  />
                </div>
              )
            }
          />

          <BentoCard
            icon={<Monitor size={ic} />}
            label="DirectX 12"
            desc="Use modern DX12 rendering pipeline."
            disabled={busy || !isWindows}
            control={
              <CustomCheckbox
                checked={!!local.useDirectX12}
                onChange={() => set("useDirectX12", !local.useDirectX12)}
                disabled={busy || !isWindows}
              />
            }
          />

          <BentoCard
            icon={<Layers size={ic} />}
            label="Low-End Mode"
            desc="Drastically reduce quality for weak hardware."
            disabled={busy}
            control={
              <CustomCheckbox
                checked={!!local.lowEndGraphics}
                onChange={() => set("lowEndGraphics", !local.lowEndGraphics)}
                disabled={busy}
              />
            }
          />

          <SectionLabel>Client behavior</SectionLabel>

          <BentoCard
            icon={<RefreshCw size={ic} />}
            label="FPS Cap"
            desc="Cap how many frames the client processes per second."
            disabled={busy}
            control={
              <CustomCheckbox
                checked={!!local.framerateCapEnabled}
                onChange={() =>
                  set("framerateCapEnabled", !local.framerateCapEnabled)
                }
                disabled={busy}
              />
            }
            extraInput={
              local.framerateCapEnabled && (
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-medium text-[var(--color-text-secondary)]">
                    Frames per second
                  </span>
                  <input
                    type="number"
                    min="1"
                    max="360"
                    value={Math.max(
                      1,
                      Math.min(360, local.framerateCapValue || 60),
                    )}
                    onChange={(e) =>
                      set(
                        "framerateCapValue",
                        Math.max(
                          1,
                          Math.min(360, parseInt(e.target.value, 10) || 60),
                        ),
                      )
                    }
                    disabled={busy}
                    className="w-16 text-xs px-2 py-1 rounded bg-[var(--color-surface-secondary)] border border-[var(--color-border)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--accent-color)] text-center transition-colors"
                  />
                </div>
              )
            }
          />

          <BentoCard
            icon={<Monitor size={ic} />}
            label="Headless Mode"
            desc="Launch clients without 3D rendering while keeping them connected."
            disabled={busy || !isWindows}
            control={
              <CustomCheckbox
                checked={!!local.headlessModeEnabled}
                onChange={() =>
                  set("headlessModeEnabled", !local.headlessModeEnabled)
                }
                disabled={busy || !isWindows}
              />
            }
          />

          <BentoCard
            icon={<Tag size={ic} />}
            label="Name client windows"
            desc="Use the account name as each Roblox window title."
            disabled={busy || !isWindows}
            control={
              <CustomCheckbox
                checked={!!local.renameWindowsEnabled}
                onChange={() =>
                  set("renameWindowsEnabled", !local.renameWindowsEnabled)
                }
                disabled={busy || !isWindows}
              />
            }
          />

          <BentoCard
            icon={<Clock size={ic} />}
            label="Anti-AFK"
            desc="Send a harmless keep-alive input during long sessions."
            disabled={busy}
            control={
              <CustomCheckbox
                checked={!!local.antiAfkEnabled}
                onChange={() => set("antiAfkEnabled", !local.antiAfkEnabled)}
                disabled={busy}
              />
            }
          />

          <BentoCard
            icon={<RefreshCw size={ic} />}
            label="Timeout relaunch"
            desc="Restart a tracked client after it exceeds the session timeout."
            disabled={busy}
            control={
              <CustomCheckbox
                checked={!!local.timeoutRelaunchEnabled}
                onChange={() =>
                  set("timeoutRelaunchEnabled", !local.timeoutRelaunchEnabled)
                }
                disabled={busy}
              />
            }
            extraInput={
              local.timeoutRelaunchEnabled && (
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-medium text-[var(--color-text-secondary)]">
                    Timeout
                  </span>
                  <input
                    type="number"
                    min="60"
                    max="86400"
                    step="60"
                    value={Math.max(
                      60,
                      Math.min(86400, local.timeoutRelaunchSeconds || 3600),
                    )}
                    onChange={(e) =>
                      set(
                        "timeoutRelaunchSeconds",
                        Math.max(
                          60,
                          Math.min(86400, parseInt(e.target.value, 10) || 3600),
                        ),
                      )
                    }
                    disabled={busy}
                    className="w-20 text-xs px-2 py-1 rounded bg-[var(--color-surface-secondary)] border border-[var(--color-border)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--accent-color)] text-center transition-colors"
                  />
                </div>
              )
            }
          />

          <SectionLabel>Windows</SectionLabel>

          <BentoCard
            icon={<Monitor size={ic} />}
            label="Arrange client windows"
            desc="Automatically lay out running Roblox windows."
            colSpan={2}
            disabled={busy || !isWindows}
            control={
              <CustomCheckbox
                checked={!!local.windowLayoutEnabled}
                onChange={() =>
                  set("windowLayoutEnabled", !local.windowLayoutEnabled)
                }
                disabled={busy || !isWindows}
              />
            }
            extraInput={
              local.windowLayoutEnabled && (
                <div className="space-y-2">
                  <div>
                    <label className="text-[9px] font-medium text-[var(--color-text-secondary)] block mb-1">
                      Pattern
                    </label>
                    <select
                      value={local.windowLayoutPattern}
                      onChange={(e) =>
                        set(
                          "windowLayoutPattern",
                          e.target.value as
                            | "grid"
                            | "rows"
                            | "columns"
                            | "cascade",
                        )
                      }
                      disabled={busy}
                      className="w-full text-[10px] px-2 py-1.5 rounded bg-[var(--color-surface-secondary)] border border-[var(--color-border)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--accent-color)] transition-colors"
                    >
                      <option value="grid">Grid</option>
                      <option value="rows">Rows</option>
                      <option value="columns">Columns</option>
                      <option value="cascade">Cascade</option>
                    </select>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[9px] font-medium text-[var(--color-text-secondary)]">
                        Spacing
                      </label>
                      <span className="text-[9px] text-[var(--color-text-muted)]">
                        {local.windowLayoutSpacing}px
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="36"
                      value={local.windowLayoutSpacing}
                      onChange={(e) =>
                        set("windowLayoutSpacing", Number(e.target.value))
                      }
                      disabled={busy}
                      className="w-full cursor-pointer accent-[var(--accent-color)]"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[9px] font-medium text-[var(--color-text-secondary)]">
                        Columns
                      </label>
                      <span className="text-[9px] text-[var(--color-text-muted)]">
                        {local.windowLayoutColumns}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="6"
                      value={local.windowLayoutColumns}
                      onChange={(e) =>
                        set("windowLayoutColumns", Number(e.target.value))
                      }
                      disabled={busy}
                      className="w-full cursor-pointer accent-[var(--accent-color)]"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-[9px] font-medium text-[var(--color-text-secondary)]">
                      Width
                      <input
                        type="number"
                        min="0"
                        max="3840"
                        step="10"
                        placeholder="Auto"
                        value={local.windowLayoutWidth || ""}
                        onChange={(e) =>
                          set(
                            "windowLayoutWidth",
                            Math.max(
                              0,
                              Math.min(3840, Number(e.target.value) || 0),
                            ),
                          )
                        }
                        disabled={busy}
                        className="mt-1 w-full text-[10px] px-2 py-1.5 rounded bg-[var(--color-surface-secondary)] border border-[var(--color-border)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--accent-color)]"
                      />
                    </label>
                    <label className="text-[9px] font-medium text-[var(--color-text-secondary)]">
                      Height
                      <input
                        type="number"
                        min="0"
                        max="2160"
                        step="10"
                        placeholder="Auto"
                        value={local.windowLayoutHeight || ""}
                        onChange={(e) =>
                          set(
                            "windowLayoutHeight",
                            Math.max(
                              0,
                              Math.min(2160, Number(e.target.value) || 0),
                            ),
                          )
                        }
                        disabled={busy}
                        className="mt-1 w-full text-[10px] px-2 py-1.5 rounded bg-[var(--color-surface-secondary)] border border-[var(--color-border)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--accent-color)]"
                      />
                    </label>
                  </div>
                </div>
              )
            }
          />

        </div>
      </div>

      <div className="flex items-center justify-end gap-2 pt-4 mt-2 border-t border-[var(--color-border)] shrink-0">
        <button
          onClick={() => {
            setLocal(robloxSettings);
            onClose();
          }}
          disabled={busy}
          className="px-4 py-2 text-xs font-semibold rounded-lg text-[var(--color-text-secondary)] border border-[var(--color-border)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)] transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={busy}
          className="px-6 py-2 text-xs font-bold rounded-lg text-[var(--accent-color-foreground)] bg-[var(--accent-color)] hover:brightness-110 active:scale-95 transition-all disabled:opacity-50 flex items-center gap-2 shadow-[0_0_15px_rgba(var(--accent-color-rgb),0.3)]"
        >
          {isSaving ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Save className="w-3.5 h-3.5" />
          )}
          {isSaving ? "Saving..." : "Save Settings"}
        </button>
      </div>
    </div>
  );
}
