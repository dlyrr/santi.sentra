import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  PanelLeft,
  LayoutTemplate,
  Square,
  Circle,
  SquareDashedBottom,
  Pipette,
  Check,
  Sparkles,
  Type,
  Palette,
  LayoutGrid,
  Maximize2,
  Layers,
  Sliders,
  Trash2,
  X,
  PaintBucket,
  Droplets,
  Wand2,
} from "lucide-react";
import { cn } from "@renderer/lib/utils";
import { useNavLayout, useSetNavLayout } from "@renderer/stores/useUIStore";
import {
  useUIDensity,
  useSetUIDensity,
  useMotionSpeed,
  useSetMotionSpeed,
  UIDensity,
  MotionSpeed,
} from "@renderer/stores/useViewPreferencesStore";
import { useSettingsManager } from "@renderer/hooks/queries";
import { BentoCard, SectionDivider, PageHeader } from "./SharedComponents";
import CustomDropdown, {
  DropdownOption,
} from "@renderer/components/UI/menus/CustomDropdown";
import { applyTint } from "@renderer/theme/theme";
import { TintPreference } from "@renderer/types";
import Color from "color";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CustomFont,
  getGoogleFontUrl,
  loadFont,
  unloadFont,
  applyFont,
  isValidGoogleFontFamily,
} from "@renderer/utils/fontUtils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
  DialogBody,
} from "@renderer/components/UI/dialogs/Dialog";
import {
  ColorPicker,
  ColorPickerSelection,
  ColorPickerHue,
  ColorPickerEyeDropper,
  ColorPickerOutput,
  ColorPickerFormat,
} from "@renderer/components/UI/inputs/ColorPicker";

// ─── Data ────────────────────────────────────────────────────────────────────

const TINTS: {
  id: TintPreference;
  label: string;
  color: string;
  gradient: string;
  glow: string;
}[] = [
  {
    id: "neutral",
    label: "Default",
    color: "#505060",
    gradient: "#303040",
    glow: "rgba(80,80,96,0.4)",
  },
  {
    id: "cool",
    label: "Ocean",
    color: "#3b82f6",
    gradient: "#1d4ed8",
    glow: "rgba(59,130,246,0.4)",
  },
  {
    id: "warm",
    label: "Ember",
    color: "#f97316",
    gradient: "#c2410c",
    glow: "rgba(249,115,22,0.4)",
  },
  {
    id: "forest",
    label: "Forest",
    color: "#10b981",
    gradient: "#047857",
    glow: "rgba(16,185,129,0.4)",
  },
  {
    id: "twilight",
    label: "Cosmic",
    color: "#a855f7",
    gradient: "#6d28d9",
    glow: "rgba(168,85,247,0.4)",
  },
];

const PRESETS = [
  { value: "#e05c1a", label: "Sentra Orange" },
  { value: "#3b82f6", label: "Blue" },
  { value: "#8b5cf6", label: "Purple" },
  { value: "#10b981", label: "Emerald" },
  { value: "#ef4444", label: "Red" },
  { value: "#f59e0b", label: "Amber" },
  { value: "#ec4899", label: "Pink" },
  { value: "#06b6d4", label: "Cyan" },
];

// ─── Shared primitives ────────────────────────────────────────────────────────
function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { id: T; label: string; icon?: React.ReactNode }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex bg-[var(--color-surface-hover)] rounded-lg p-1 border border-[var(--color-border)]">
      {options.map(({ id, label, icon }) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-md text-xs font-semibold transition-all duration-200",
            value === id
              ? "bg-[var(--color-surface)] text-[var(--color-text-primary)] shadow-sm border border-[var(--color-border-strong)]"
              : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]",
          )}
        >
          {icon}
          {label}
        </button>
      ))}
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export function AppearanceBentoGrid() {
  const queryClient = useQueryClient();
  const navLayout = useNavLayout();
  const setNavLayout = useSetNavLayout();
  const uiDensity = useUIDensity();
  const setUIDensity = useSetUIDensity();
  const motionSpeed = useMotionSpeed();
  const setMotionSpeed = useSetMotionSpeed();
  const { settings, updateSettings } = useSettingsManager();

  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const [newFontFamily, setNewFontFamily] = useState("");
  const [fontError, setFontError] = useState<string | null>(null);
  const [isAddingFont, setIsAddingFont] = useState(false);

  const currentTint: TintPreference =
    (settings?.tint as TintPreference) || "neutral";
  const currentAccent = settings?.accentColor || "#e05c1a";

  // ── Font queries ────────────────────────────────
  const { data: customFonts = [] } = useQuery<CustomFont[]>({
    queryKey: ["customFonts"],
    queryFn: () => window.api.getCustomFonts(),
    staleTime: Infinity,
  });
  const { data: activeFont = null } = useQuery<string | null>({
    queryKey: ["activeFont"],
    queryFn: () => window.api.getActiveFont(),
    staleTime: Infinity,
  });
  useEffect(() => {
    customFonts.forEach((f) => loadFont(f).catch(console.error));
  }, [customFonts]);
  useEffect(() => {
    applyFont(activeFont);
  }, [activeFont]);

  const addFontMutation = useMutation({
    mutationFn: async (font: CustomFont) => {
      await loadFont(font);
      await window.api.addCustomFont(font);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customFonts"] });
      setNewFontFamily("");
      setFontError(null);
    },
    onError: (e: Error) => setFontError(e.message),
  });
  const removeFontMutation = useMutation({
    mutationFn: async (family: string) => {
      unloadFont(family);
      await window.api.removeCustomFont(family);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customFonts"] });
      queryClient.invalidateQueries({ queryKey: ["activeFont"] });
    },
  });
  const setActiveFontMutation = useMutation({
    mutationFn: async (family: string | null) => {
      await window.api.setActiveFont(family);
      applyFont(family);
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["activeFont"] }),
  });

  const handleAddFont = async () => {
    const t = newFontFamily.trim();
    if (!t) {
      setFontError("Enter a font family name");
      return;
    }
    if (!isValidGoogleFontFamily(t)) {
      setFontError("Invalid name. Letters, numbers, spaces only.");
      return;
    }
    if (customFonts.some((f) => f.family.toLowerCase() === t.toLowerCase())) {
      setFontError("Already added");
      return;
    }
    setIsAddingFont(true);
    setFontError(null);
    try {
      await addFontMutation.mutateAsync({
        family: t,
        url: getGoogleFontUrl(t),
      });
    } catch {
      setFontError("Failed to load. Check font name.");
    } finally {
      setIsAddingFont(false);
    }
  };

  // ── Theme logic ─────────────────────────────────
  const handleTintChange = (id: TintPreference) => {
    updateSettings({ tint: id });
    applyTint("dark", id);
  };
  const handleAccentPreset = (hex: string) =>
    updateSettings({ accentColor: hex });
  const handleAccentPickerChange = (rgba: [number, number, number, number]) => {
    try {
      updateSettings({
        accentColor: Color.rgb(rgba[0], rgba[1], rgba[2]).hex(),
      });
    } catch {
      /* noop */
    }
  };

  const isPresetAccent = PRESETS.some(
    (p) => p.value.toLowerCase() === currentAccent.toLowerCase(),
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="pb-10"
    >
      <div className="grid grid-cols-2 gap-4">
        <PageHeader
          title="Appearance"
          description="Personalize every pixel of your experience."
        />
        {/* ─── Theme & Colors ─── */}
        <SectionDivider label="Theme & Colors" />

        {/* Surface Tint — full width */}
        <BentoCard
          colSpan={2}
          icon={<PaintBucket size={16} />}
          title="Surface Tint"
          description="Adds a subtle color cast to surfaces and borders throughout the app."
          disabled={false}
        >
          <div className="flex gap-3">
            {TINTS.map((tint) => {
              const active = currentTint === tint.id;
              return (
                <button
                  key={tint.id}
                  onClick={() => {
                    handleTintChange(tint.id);
                  }}
                  className={cn(
                    "relative flex-1 flex flex-col items-center gap-3 py-4 rounded-xl border-2 transition-all duration-200 group",
                    active
                      ? "border-[var(--accent-color)] bg-[var(--accent-color-faint)]"
                      : "border-[var(--color-border)] bg-[var(--color-surface-hover)] hover:border-[var(--color-border-strong)]",
                    "cursor-pointer",
                  )}
                >
                  <div
                    className="w-12 h-12 rounded-full shadow-lg transition-transform duration-200 group-hover:scale-110"
                    style={{
                      background: `linear-gradient(135deg, ${tint.color}, ${tint.gradient})`,
                      boxShadow: active
                        ? `0 0 20px ${tint.glow}`
                        : "0 4px 12px rgba(0,0,0,0.25)",
                    }}
                  />
                  <span
                    className={cn(
                      "text-[11px] font-semibold",
                      active
                        ? "text-[var(--color-text-primary)]"
                        : "text-[var(--color-text-muted)]",
                    )}
                  >
                    {tint.label}
                  </span>
                  {active && (
                    <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-[var(--accent-color)] flex items-center justify-center">
                      <Check size={9} strokeWidth={3} className="text-white" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </BentoCard>

        {/* Accent Color — full width */}
        <BentoCard
          colSpan={2}
          icon={<Pipette size={16} />}
          title="Accent Color"
          description="Applied to buttons, active states, highlights, and interactive elements."
          disabled={false}
        >
          <div className="flex items-center flex-wrap gap-2.5">
            {PRESETS.map((p) => {
              const selected =
                currentAccent.toLowerCase() === p.value.toLowerCase();
              return (
                <button
                  key={p.value}
                  title={p.label}
                  onClick={() => handleAccentPreset(p.value)}
                  className={cn(
                    "relative w-9 h-9 rounded-full transition-all duration-200 cursor-pointer",
                    selected
                      ? "ring-2 ring-white ring-offset-2 ring-offset-[var(--color-surface)] scale-110"
                      : "hover:scale-105 hover:ring-1 hover:ring-white/30",
                  )}
                  style={{
                    backgroundColor: p.value,
                    boxShadow: selected ? `0 0 14px ${p.value}70` : undefined,
                  }}
                >
                  {selected && (
                    <Check
                      size={13}
                      strokeWidth={3}
                      className="absolute inset-0 m-auto text-white drop-shadow"
                    />
                  )}
                </button>
              );
            })}
            <button
              onClick={() => setIsColorPickerOpen(true)}
              title="Custom color"
              className="w-9 h-9 rounded-full border-2 border-dashed border-[var(--color-border-strong)] hover:border-[var(--color-text-muted)] flex items-center justify-center transition-all bg-[var(--color-surface-hover)]"
            >
              <Pipette size={13} className="text-[var(--color-text-muted)]" />
            </button>
            {!isPresetAccent && (
              <div
                className="w-9 h-9 rounded-full ring-2 ring-white ring-offset-2 ring-offset-[var(--color-surface)] scale-110 flex items-center justify-center"
                style={{
                  backgroundColor: currentAccent,
                  boxShadow: `0 0 14px ${currentAccent}70`,
                }}
              >
                <Check
                  size={13}
                  strokeWidth={3}
                  className="text-white drop-shadow"
                />
              </div>
            )}
            <div className="ml-auto flex items-center gap-2">
              <div
                className="w-5 h-5 rounded-full border border-white/20"
                style={{ backgroundColor: currentAccent }}
              />
              <span className="text-[11px] font-mono text-[var(--color-text-muted)] uppercase">
                {currentAccent}
              </span>
              <button
                onClick={() => handleAccentPreset("#e05c1a")}
                className="text-[11px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors underline decoration-dotted ml-1"
              >
                Reset
              </button>
            </div>
          </div>
        </BentoCard>

        {/* ─── Effects & Materials ─── */}
        {/* ─── Layout & Density ─── */}
        <SectionDivider label="Layout & Style" />

        {/* Navigation Layout — full width */}
        <BentoCard
          colSpan={2}
          icon={<LayoutTemplate size={16} />}
          title="Navigation Layout"
          description="Choose where the main navigation menu appears."
        >
          <div className="grid grid-cols-2 gap-3">
            {[
              {
                id: "sidebar" as const,
                label: "Sidebar",
                Icon: PanelLeft,
                desc: "Classic left-side vertical navigation",
              },
              {
                id: "topbar" as const,
                label: "Top Bar",
                Icon: LayoutTemplate,
                desc: "Compact horizontal bar at the top",
              },
            ].map(({ id, label, Icon, desc }) => (
              <button
                key={id}
                onClick={() => setNavLayout(id)}
                className={cn(
                  "relative flex items-center gap-3.5 p-4 rounded-xl border-2 text-left transition-all duration-200 group",
                  navLayout === id
                    ? "border-[var(--accent-color)] bg-[var(--accent-color-faint)]"
                    : "border-[var(--color-border)] bg-[var(--color-surface-hover)] hover:border-[var(--color-border-strong)]",
                )}
              >
                <div
                  className={cn(
                    "p-2.5 rounded-lg shrink-0 transition-colors",
                    navLayout === id
                      ? "bg-[var(--accent-color-soft)] text-[var(--accent-color)]"
                      : "bg-[var(--color-surface-muted)] text-[var(--color-text-muted)] group-hover:text-[var(--color-text-primary)] group-hover:bg-[var(--color-surface-hover)]",
                  )}
                >
                  <Icon size={20} strokeWidth={1.75} />
                </div>
                <div>
                  <p
                    className={cn(
                      "text-sm font-bold",
                      navLayout === id
                        ? "text-[var(--color-text-primary)]"
                        : "text-[var(--color-text-secondary)]",
                    )}
                  >
                    {label}
                  </p>
                  <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                    {desc}
                  </p>
                </div>
                {navLayout === id && (
                  <div className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-[var(--accent-color)] flex items-center justify-center">
                    <Check size={10} strokeWidth={3} className="text-white" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </BentoCard>

        {/* ─── Density & Blur ─── */}
        <SectionDivider label="Density & Effects" />

        {/* UI Density */}
        <BentoCard
          icon={<Sliders size={16} />}
          title="UI Density"
          description="Control the spacing and padding throughout the interface."
        >
          <SegmentedControl<UIDensity>
            value={uiDensity}
            onChange={setUIDensity}
            options={[
              { id: "compact", label: "Compact" },
              { id: "default", label: "Default" },
              { id: "relaxed", label: "Relaxed" },
            ]}
          />
        </BentoCard>

        {/* Motion Speed */}
        <BentoCard
          icon={<Sparkles size={16} />}
          title="Animation Speed"
          description="Control how fast UI transitions and animations play."
        >
          <SegmentedControl<MotionSpeed>
            value={motionSpeed}
            onChange={setMotionSpeed}
            options={[
              { id: "none", label: "Off" },
              { id: "fast", label: "Fast" },
              { id: "default", label: "Normal" },
              { id: "slow", label: "Slow" },
            ]}
          />
        </BentoCard>

        {/* ─── Content & Effects ─── */}
        {/* Typography */}
        <BentoCard
          icon={<Type size={16} />}
          title="Typography"
          description="Add custom Google Fonts to use throughout the interface."
        >
          <div className="space-y-3">
            <div className="flex gap-2">
              <input
                type="text"
                value={newFontFamily}
                onChange={(e) => {
                  setNewFontFamily(e.target.value);
                  setFontError(null);
                }}
                onKeyDown={(e) => e.key === "Enter" && handleAddFont()}
                placeholder="e.g., Inter, Roboto..."
                className="flex-1 bg-[var(--color-surface-hover)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-xs text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--accent-color)] focus:outline-none transition-colors"
              />
              <button
                onClick={handleAddFont}
                disabled={isAddingFont || !newFontFamily.trim()}
                className="px-3 py-2 text-xs font-bold rounded-lg bg-[var(--accent-color)] text-white hover:brightness-110 disabled:opacity-50 transition-all shrink-0"
              >
                {isAddingFont ? "..." : "Add"}
              </button>
            </div>
            {fontError && (
              <p className="text-[11px] text-red-400">{fontError}</p>
            )}
            <div className="space-y-1 max-h-[140px] overflow-y-auto styled-scrollbar -mr-1 pr-1">
              <button
                onClick={() => setActiveFontMutation.mutate(null)}
                className={cn(
                  "w-full text-left px-3 py-2 text-xs rounded-lg flex items-center justify-between transition-colors",
                  activeFont === null
                    ? "bg-[var(--accent-color-soft)] text-[var(--accent-color)]"
                    : "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]",
                )}
              >
                <span>System Default</span>
                {activeFont === null && <Check size={12} />}
              </button>
              {customFonts.map((font) => (
                <div
                  key={font.family}
                  className={cn(
                    "flex items-center rounded-lg transition-colors group",
                    activeFont === font.family
                      ? "bg-[var(--accent-color-soft)]"
                      : "hover:bg-[var(--color-surface-hover)]",
                  )}
                >
                  <button
                    className={cn(
                      "flex-1 text-left px-3 py-2 text-xs flex items-center justify-between",
                      activeFont === font.family
                        ? "text-[var(--accent-color)]"
                        : "text-[var(--color-text-secondary)]",
                    )}
                    onClick={() => setActiveFontMutation.mutate(font.family)}
                  >
                    <span style={{ fontFamily: font.family }}>
                      {font.family}
                    </span>
                    {activeFont === font.family && <Check size={12} />}
                  </button>
                  <button
                    onClick={() => removeFontMutation.mutate(font.family)}
                    className="p-2 text-[var(--color-text-muted)] hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all mr-1"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </BentoCard>
      </div>

      {/* Color Picker Dialog */}
      <Dialog
        isOpen={isColorPickerOpen}
        onClose={() => setIsColorPickerOpen(false)}
      >
        <DialogContent className="max-w-md overflow-visible">
          <DialogHeader>
            <DialogTitle>Custom Accent Color</DialogTitle>
            <DialogClose />
          </DialogHeader>
          <DialogBody>
            <ColorPicker
              value={currentAccent}
              onChange={handleAccentPickerChange}
              className="w-full"
            >
              <div className="flex flex-col gap-4">
                <div className="flex gap-3 items-stretch">
                  <div className="flex-1 h-64 rounded-lg overflow-hidden border border-[var(--color-border)]">
                    <ColorPickerSelection className="h-full" />
                  </div>
                  <div className="w-8 h-64 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-1 flex items-center justify-center">
                    <ColorPickerHue
                      orientation="vertical"
                      className="h-full w-full rounded-full"
                    />
                  </div>
                </div>
                <div className="flex gap-2 items-end">
                  <ColorPickerEyeDropper />
                  <div className="flex-1">
                    <ColorPickerFormat />
                  </div>
                  <ColorPickerOutput />
                </div>
              </div>
            </ColorPicker>
          </DialogBody>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
