import { applyAccentColor } from "@renderer/utils/themeUtils";

import ballTile from "@assets/themes/ball2.0.png";
import voxlisSprite from "@assets/themes/red-heart.svg";
import sirmemeSprite from "@assets/themes/sirmeme.png";

/**
 * Theme presets, brought over from santi.weblauncher.
 *
 * The launcher describes a theme as ten colours — the same set rdd.xocat.online
 * uses — while this app is built on a larger token vocabulary (four surface
 * levels, three border weights, three text weights). Rather than hand-author
 * every token for all nine presets, the extra levels are *derived*: surfaces and
 * borders are the base surface mixed with the palette's `glass` colour.
 *
 * That derivation is what makes the light presets work at all. `glass` is the
 * tint controls take, and it is dark on a light palette and light on a dark one,
 * so mixing toward it always moves a surface *away* from the background rather
 * than assuming everything is dark like the built-in theme does.
 */

/** The launcher's palette shape, kept verbatim so the two stay comparable. */
export interface PresetPalette {
  background: string;
  surface: string;
  /** Tint for controls: dark on light palettes, light on dark ones. */
  glass: string;
  text: string;
  description: string;
  buttons: string;
  inputs: string;
  accent: string;
  loading: string;
  danger: string;
}

/** A sprite the theme drops down the window. */
export interface RainArtwork {
  src: string;
  size: number;
  count: number;
}

export interface ThemePreset {
  id: string;
  name: string;
  palette: PresetPalette;
  /** Decorative glow behind the app, as two tinted radials. */
  glow?: [string, string];
  glowOpacity?: number;
  /** Artwork repeated across every surface. */
  tile?: { src: string; size: number };
  rain?: RainArtwork;
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: "dark",
    name: "Dark",
    palette: {
      background: "#1a1a1a", surface: "#1a1a1a", glass: "#ffffff", text: "#ffffff",
      description: "#767676", buttons: "#a3a3a3", inputs: "#d1d1d1",
      accent: "#3bea57", loading: "#3bea57", danger: "#ec3b47",
    },
    glow: ["rgba(59, 234, 87, .5)", "rgba(236, 59, 71, .5)"],
    glowOpacity: 0.5,
  },
  {
    id: "light",
    name: "Light",
    palette: {
      background: "#f5f5f5", surface: "#ffffff", glass: "#121212", text: "#121212",
      description: "#939393", buttons: "#626262", inputs: "#313131",
      accent: "#3bea57", loading: "#3bea57", danger: "#ec3b47",
    },
    glow: ["rgba(59, 234, 87, .5)", "rgba(236, 59, 71, .5)"],
    glowOpacity: 0.5,
  },
  {
    id: "revision",
    name: "Revision",
    palette: {
      background: "#0f0f14", surface: "#0f0f14", glass: "#e0e0e0", text: "#e0e0e0",
      description: "#636366", buttons: "#8c8c8e", inputs: "#b6b6b7",
      accent: "#3bea57", loading: "#3bea57", danger: "#ec3b47",
    },
    glow: ["rgba(224, 108, 117, .5)", "rgba(10, 10, 10, .5)"],
    glowOpacity: 0.5,
  },
  {
    id: "voxlis",
    name: "voxlis.NET",
    palette: {
      background: "#000000", surface: "#000000", glass: "#ffffff", text: "#ffffff",
      description: "#666666", buttons: "#999999", inputs: "#cccccc",
      accent: "#dc2626", loading: "#dc2626", danger: "#dc2626",
    },
    glow: ["rgba(220, 38, 38, .5)", "rgba(0, 0, 0, .5)"],
    glowOpacity: 0.5,
    rain: { src: voxlisSprite, size: 46, count: 34 },
  },
  {
    id: "pulsery",
    name: "Pulsery",
    palette: {
      background: "#0a0a0f", surface: "#0a0a0f", glass: "#ffffff", text: "#ffffff",
      description: "#6c6c6f", buttons: "#9d9d9f", inputs: "#cececf",
      accent: "#6366f1", loading: "#6366f1", danger: "#6366f1",
    },
    glow: ["rgba(99, 102, 241, .2)", "rgba(99, 102, 241, .2)"],
    glowOpacity: 0.2,
  },
  {
    id: "amoled",
    name: "Amoled",
    palette: {
      background: "#000000", surface: "#000000", glass: "#ffffff", text: "#ffffff",
      description: "#535353", buttons: "#7d7d7d", inputs: "#a6a6a6",
      accent: "#808080", loading: "#808080", danger: "#808080",
    },
    glow: ["rgba(80, 80, 80, .5)", "rgba(60, 60, 60, .5)"],
    glowOpacity: 0.5,
  },
  {
    id: "kyoto",
    name: "Kyoto",
    palette: {
      background: "#171821", surface: "#171821", glass: "#d1d9f9", text: "#d1d9f9",
      description: "#333440", buttons: "#414350", inputs: "#4f515f",
      accent: "#b8bed7", loading: "#d1d9f9", danger: "#d1d9f9",
    },
    glow: ["rgba(209, 217, 249, .5)", "rgba(94, 102, 119, .5)"],
    glowOpacity: 0.5,
  },
  {
    id: "sirmeme",
    name: "Sirmeme",
    palette: {
      background: "#000000", surface: "#000000", glass: "#ffffff", text: "#ffffff",
      description: "#666666", buttons: "#999999", inputs: "#cccccc",
      accent: "#ff00d8", loading: "#ff00d8", danger: "#35ff03",
    },
    glow: ["rgba(53, 255, 3, .5)", "rgba(255, 0, 216, .5)"],
    glowOpacity: 0.5,
    rain: { src: sirmemeSprite, size: 54, count: 28 },
  },
  {
    id: "ball20",
    name: "Ball 2.0",
    palette: {
      background: "#ffffff", surface: "#ffffff", glass: "#000000", text: "#000000",
      description: "#999999", buttons: "#666666", inputs: "#333333",
      accent: "#000000", loading: "#000000", danger: "#000000",
    },
    glow: ["rgba(0, 0, 0, .5)", "rgba(0, 0, 0, .5)"],
    glowOpacity: 0.5,
    tile: { src: ballTile, size: 84 },
  },
];

export const getPreset = (id: string | null | undefined): ThemePreset | null =>
  THEME_PRESETS.find((preset) => preset.id === id) ?? null;

/* ── Derivation ─────────────────────────────────────────────── */

const hexToRgb = (hex: string): [number, number, number] => {
  const value = hex.replace("#", "");
  const full =
    value.length === 3
      ? value
          .split("")
          .map((c) => c + c)
          .join("")
      : value;
  const int = parseInt(full, 16);
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
};

/** Blends `amount` of `toward` into `base`, both as hex. */
const mix = (base: string, toward: string, amount: number): string => {
  const [r1, g1, b1] = hexToRgb(base);
  const [r2, g2, b2] = hexToRgb(toward);
  const blend = (a: number, b: number) => Math.round(a + (b - a) * amount);
  const hex = (n: number) => n.toString(16).padStart(2, "0");
  return `#${hex(blend(r1, r2))}${hex(blend(g1, g2))}${hex(blend(b1, b2))}`;
};

const setVar = (key: string, value: string) => {
  document.documentElement.style.setProperty(key, value);
};

/** Perceived lightness, 0–1. Used to decide which way a palette leans. */
const lightness = (hex: string): number => {
  const [r, g, b] = hexToRgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
};

/**
 * Paints a preset across the app's tokens.
 *
 * Called instead of `applyTint` when a preset is chosen: a preset supplies the
 * whole surface ramp itself, so letting the tint palette run afterwards would
 * overwrite it with the built-in dark values.
 */
export const applyPreset = (preset: ThemePreset): void => {
  if (typeof document === "undefined") return;

  const p = preset.palette;
  const isLight = lightness(p.background) > 0.5;

  setVar("--color-app-bg", p.background);
  setVar("--color-titlebar", p.background);
  setVar("--color-surface", p.surface);
  setVar("--color-surface-strong", mix(p.surface, p.glass, 0.04));
  setVar("--color-surface-muted", mix(p.surface, p.glass, 0.07));
  setVar("--color-surface-hover", mix(p.surface, p.glass, 0.11));
  setVar("--color-muted-bg", mix(p.surface, p.glass, 0.06));

  setVar("--color-border-subtle", mix(p.surface, p.glass, 0.08));
  setVar("--color-border", mix(p.surface, p.glass, 0.14));
  setVar("--color-border-strong", mix(p.surface, p.glass, 0.24));

  setVar("--color-text-primary", p.text);
  setVar("--color-text-secondary", p.buttons);

  // On a light palette the launcher's `description` grey sits at roughly 3:1
  // against white, which is legible on a 460px launcher and washed out across a
  // full-size app. Pull it toward the text colour until it carries.
  setVar(
    "--color-text-muted",
    isLight ? mix(p.description, p.text, 0.25) : p.description,
  );

  // `loading` is the launcher's progress fill, which is the same role success
  // plays here; `danger` maps straight onto error.
  setVar("--color-success", p.loading);
  setVar("--color-error", p.danger);

  // The built-in theme's shadow and focus ring are both tuned for a near-black
  // background: the shadow is a heavy black bloom and the ring is translucent
  // white. Both disappear or look like grime on a light palette.
  setVar(
    "--shadow-lg",
    isLight
      ? "0 12px 32px rgba(0, 0, 0, 0.12)"
      : "0 24px 72px rgba(0, 0, 0, 0.45)",
  );
  setVar(
    "--focus-ring",
    isLight ? "rgba(0, 0, 0, 0.16)" : "rgba(255, 255, 255, 0.14)",
  );

  applyAccentColor(p.accent);

  // Artwork. Cleared first so switching away from Ball 2.0 does not leave its
  // tile painted across every surface.
  setVar("--theme-tile", preset.tile ? `url("${preset.tile.src}")` : "none");
  setVar("--theme-tile-size", preset.tile ? `${preset.tile.size}px` : "auto");

  if (preset.glow) {
    setVar("--theme-glow-a", preset.glow[0]);
    setVar("--theme-glow-b", preset.glow[1]);
    setVar("--theme-glow-opacity", String(preset.glowOpacity ?? 0.5));
  }

  document.documentElement.dataset.preset = preset.id;
};

/** Returns the app to its built-in dark theme and tint. */
export const clearPreset = (): void => {
  if (typeof document === "undefined") return;
  delete document.documentElement.dataset.preset;
};
