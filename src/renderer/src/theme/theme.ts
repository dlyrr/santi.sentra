import { ThemePreference, TintPreference } from "../types";

export type ThemeName = "dark";

type ThemeColors = {
  appBackground: string;
  surface: string;
  surfaceStrong: string;
  surfaceMuted: string;
  surfaceHover: string;
  titlebar: string;
  border: string;
  borderStrong: string;
  borderSubtle: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  mutedBackground: string;
  focusRing: string;
  shadowLg: string;
  success: string;
  error: string;
};

export type ThemeDefinition = {
  name: ThemeName;
  colors: ThemeColors;
  radii: {
    md: string;
    lg: string;
    xl: string;
    pill: string;
  };
};

const commonRadii = {
  md: "6px",
  lg: "10px",
  xl: "14px",
  pill: "999px",
};

const themes: Record<ThemeName, ThemeDefinition> = {
  dark: {
    name: "dark",
    colors: {
      appBackground: "#050505",
      surface: "#0c0c0c",
      surfaceStrong: "#111111",
      surfaceMuted: "#151515",
      surfaceHover: "#1b1b1b",
      titlebar: "#151515",
      border: "#1f1f1f",
      borderStrong: "#292929",
      borderSubtle: "rgba(255, 255, 255, 0.06)",
      textPrimary: "#f6f7fb",
      textSecondary: "#d6d8e0",
      textMuted: "#9ea3b3",
      mutedBackground: "rgba(255, 255, 255, 0.02)",
      focusRing: "rgba(255, 255, 255, 0.14)",
      shadowLg: "0 24px 72px rgba(0, 0, 0, 0.45)",
      success: "#22c55e",
      error: "#ef4444",
    },
    radii: commonRadii,
  },
};

const tintPalettes: Record<
  ThemeName,
  Record<
    TintPreference,
    Pick<
      ThemeColors,
      | "appBackground"
      | "surface"
      | "surfaceStrong"
      | "surfaceMuted"
      | "surfaceHover"
      | "titlebar"
      | "border"
      | "borderStrong"
    >
  >
> = {
  dark: {
    neutral: {
      appBackground: "#050505",
      surface: "#0a0a0a",
      surfaceStrong: "#0f0f0f",
      surfaceMuted: "#141414",
      surfaceHover: "#1a1a1a",
      titlebar: "#050505",
      border: "#1f1f1f",
      borderStrong: "#2a2a2a",
    },
    cool: {
      appBackground: "#050608",
      surface: "#090a0f",
      surfaceStrong: "#0e0f14",
      surfaceMuted: "#13141a",
      surfaceHover: "#191a22",
      titlebar: "#050608",
      border: "#1f222b",
      borderStrong: "#2a2f3b",
    },
    warm: {
      appBackground: "#080605",
      surface: "#0f0a09",
      surfaceStrong: "#140f0e",
      surfaceMuted: "#1a1413",
      surfaceHover: "#221918",
      titlebar: "#080605",
      border: "#2b221f",
      borderStrong: "#3b2e2a",
    },
    forest: {
      appBackground: "#050806",
      surface: "#090f0a",
      surfaceStrong: "#0e140f",
      surfaceMuted: "#131a14",
      surfaceHover: "#19221a",
      titlebar: "#050806",
      border: "#1f2b22",
      borderStrong: "#2a3b2e",
    },
    twilight: {
      appBackground: "#070508",
      surface: "#0d090f",
      surfaceStrong: "#120e14",
      surfaceMuted: "#18131a",
      surfaceHover: "#201922",
      titlebar: "#070508",
      border: "#261f2b",
      borderStrong: "#352a3b",
    },
  },
};


const setCssVariable = (key: string, value: string) => {
  if (typeof document === "undefined") return;
  document.documentElement.style.setProperty(key, value);
};

export const getCurrentThemeNameFromDom = (): ThemeName => {
  return "dark";
};

export const applyTint = (themeName: ThemeName, tint: TintPreference) => {
  const palette =
    tintPalettes[themeName]?.[tint] ?? tintPalettes[themeName]?.neutral;
  if (!palette) return;

  setCssVariable("--color-app-bg", palette.appBackground);
  setCssVariable("--color-surface", palette.surface);
  setCssVariable("--color-surface-strong", palette.surfaceStrong);
  setCssVariable("--color-surface-muted", palette.surfaceMuted);
  setCssVariable("--color-surface-hover", palette.surfaceHover);
  setCssVariable("--color-titlebar", palette.titlebar);
  setCssVariable("--color-border", palette.border);
  setCssVariable("--color-border-strong", palette.borderStrong);
};

export const applyTheme = (theme: ThemeDefinition) => {
  const { colors, radii } = theme;
  const tint =
    (typeof document !== "undefined"
      ? (document.documentElement.dataset.tint as TintPreference | undefined)
      : undefined) ?? "neutral";

  applyTint(theme.name, tint);
  setCssVariable("--color-border-subtle", colors.borderSubtle);
  setCssVariable("--color-text-primary", colors.textPrimary);
  setCssVariable("--color-text-secondary", colors.textSecondary);
  setCssVariable("--color-text-muted", colors.textMuted);
  setCssVariable("--color-muted-bg", colors.mutedBackground);
  setCssVariable("--focus-ring", colors.focusRing);
  setCssVariable("--shadow-lg", colors.shadowLg);
  setCssVariable("--color-success", colors.success);
  setCssVariable("--color-error", colors.error);

  setCssVariable("--radius-md", radii.md);
  setCssVariable("--radius-lg", radii.lg);
  setCssVariable("--radius-xl", radii.xl);
  setCssVariable("--radius-pill", radii.pill);

  document.documentElement.dataset.theme = theme.name;
};

export const getTheme = (name: ThemeName = "dark"): ThemeDefinition =>
  themes[name];

export const availableThemes = themes;

export type { ThemePreference };
