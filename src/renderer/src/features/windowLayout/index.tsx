import React, { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { LayoutGrid, Save, RotateCcw, Play } from "lucide-react";
import { Button } from "@renderer/components/UI/buttons/Button";
import { useNotification } from "@renderer/features/system/stores/useSnackbarStore";
import CustomDropdown, {
  DropdownOption,
} from "@renderer/components/UI/menus/CustomDropdown";

type LayoutPattern = "grid" | "rows" | "columns" | "cascade";
type MonitorMode = "all" | "primary" | "secondary";

interface LayoutConfig {
  pattern: LayoutPattern;
  monitors: MonitorMode;
  spacing: number;
  columns?: number;
  rows?: number;
}

const LAYOUT_PATTERNS: DropdownOption[] = [
  { value: "grid", label: "Grid (Auto)" },
  { value: "rows", label: "Horizontal Rows" },
  { value: "columns", label: "Vertical Columns" },
  { value: "cascade", label: "Cascade" },
];

const MONITOR_MODES: DropdownOption[] = [
  { value: "all", label: "All Monitors" },
  { value: "primary", label: "Primary Monitor Only" },
  { value: "secondary", label: "Secondary Monitors" },
];

export default function WindowLayoutTab() {
  const { showNotification } = useNotification();
  const [layoutConfig, setLayoutConfig] = useState<LayoutConfig>({
    pattern: "grid",
    monitors: "all",
    spacing: 10,
    columns: 4,
  });
  const [savedLayouts, setSavedLayouts] = useState<
    Record<string, LayoutConfig>
  >({
    default: layoutConfig,
  });
  const [selectedLayout, setSelectedLayout] = useState<string>("default");

  const handlePatternChange = useCallback((value: string) => {
    setLayoutConfig((prev) => ({
      ...prev,
      pattern: value as LayoutPattern,
    }));
  }, []);

  const handleMonitorModeChange = useCallback((value: string) => {
    setLayoutConfig((prev) => ({
      ...prev,
      monitors: value as MonitorMode,
    }));
  }, []);

  const handleSpacingChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = parseInt(e.target.value, 10) || 0;
      setLayoutConfig((prev) => ({
        ...prev,
        spacing: Math.max(0, Math.min(50, value)),
      }));
    },
    [],
  );

  const handleColumnsChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = parseInt(e.target.value, 10) || 1;
      setLayoutConfig((prev) => ({
        ...prev,
        columns: Math.max(1, Math.min(10, value)),
      }));
    },
    [],
  );

  const handleSaveLayout = useCallback(() => {
    const layoutName = prompt("Enter layout name:", selectedLayout);
    if (!layoutName) return;

    setSavedLayouts((prev) => ({
      ...prev,
      [layoutName]: layoutConfig,
    }));
    setSelectedLayout(layoutName);
    showNotification(`Layout saved as "${layoutName}"`, "success");
  }, [layoutConfig, selectedLayout, showNotification]);

  const handleLoadLayout = useCallback(
    (layoutName: string) => {
      const layout = savedLayouts[layoutName];
      if (layout) {
        setLayoutConfig(layout);
        setSelectedLayout(layoutName);
        showNotification(`Loaded layout: ${layoutName}`, "success");
      }
    },
    [savedLayouts, showNotification],
  );

  const handleApplyLayout = useCallback(async () => {
    try {
      if (typeof (window.api as any)?.tileGameWindows === "function") {
        await (window.api as any).tileGameWindows({
          pattern: layoutConfig.pattern,
          monitors: layoutConfig.monitors,
          spacing: layoutConfig.spacing,
          columns: layoutConfig.columns,
        });
        showNotification("Window layout applied", "success");
      } else {
        showNotification("Window tiling feature not yet implemented", "info");
      }
    } catch (error) {
      showNotification("Failed to apply layout", "error");
      console.error(error);
    }
  }, [layoutConfig, showNotification]);

  const layoutOptions: DropdownOption[] = Object.keys(savedLayouts).map(
    (name) => ({
      value: name,
      label: name,
    }),
  );

  return (
    <div className="flex flex-col h-full bg-transparent p-6 overflow-y-auto scrollbar-thin">
      <div className="max-w-4xl w-full mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="space-y-6"
        >
          <div>
            <h1 className="flex items-center gap-3 text-2xl font-bold tracking-tight text-[var(--color-text-primary)] mb-2">
              <LayoutGrid className="h-6 w-6 text-blue-500" />
              Window Layout Manager
            </h1>
            <p className="text-sm text-[var(--color-text-secondary)]">
              Organize and tile multiple game windows across your monitors
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-4 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-5">
              <div>
                <h2 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">
                  Layout Configuration
                </h2>

                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-medium text-[var(--color-text-secondary)] block mb-2">
                      Pattern
                    </label>
                    <CustomDropdown
                      options={LAYOUT_PATTERNS}
                      value={layoutConfig.pattern}
                      onChange={handlePatternChange}
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-[var(--color-text-secondary)] block mb-2">
                      Monitor Mode
                    </label>
                    <CustomDropdown
                      options={MONITOR_MODES}
                      value={layoutConfig.monitors}
                      onChange={handleMonitorModeChange}
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-[var(--color-text-secondary)] block mb-2">
                      Columns: {layoutConfig.columns}
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="10"
                      value={layoutConfig.columns || 4}
                      onChange={handleColumnsChange}
                      className="w-full"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-[var(--color-text-secondary)] block mb-2">
                      Window Spacing: {layoutConfig.spacing}px
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="50"
                      value={layoutConfig.spacing}
                      onChange={handleSpacingChange}
                      className="w-full"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-5">
              <div>
                <h2 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">
                  Saved Layouts
                </h2>

                <div className="space-y-2">
                  <CustomDropdown
                    options={layoutOptions}
                    value={selectedLayout}
                    onChange={handleLoadLayout}
                  />

                  <div className="flex gap-2 pt-2">
                    <Button
                      onClick={handleSaveLayout}
                      className="flex-1 gap-2 bg-[var(--accent-color)] hover:bg-[var(--accent-color-muted)] text-[var(--accent-color-foreground)]"
                    >
                      <Save className="h-4 w-4" />
                      Save
                    </Button>
                    <Button
                      onClick={() => {
                        setLayoutConfig({
                          pattern: "grid",
                          monitors: "all",
                          spacing: 10,
                          columns: 4,
                        });
                      }}
                      variant="ghost"
                      className="gap-2"
                    >
                      <RotateCcw className="h-4 w-4" />
                      Reset
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <Button
            onClick={handleApplyLayout}
            className="w-full gap-2 bg-[var(--accent-color)] hover:bg-[var(--accent-color-muted)] text-[var(--accent-color-foreground)] py-3 text-base"
          >
            <Play className="h-5 w-5" />
            Apply Layout
          </Button>

          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
            <p className="text-xs text-blue-300">
              💡 Window layouts will be applied to all currently running Roblox
              clients. Make sure your game windows are already open before
              applying.
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
