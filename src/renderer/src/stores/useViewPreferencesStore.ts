import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

// ============================================================================
// View Preferences Store
// ============================================================================

export type ViewMode = "default" | "compact";
export type ContentRadius = "sharp" | "rounded" | "pill";
export type NavBorderStyle = "solid" | "subtle" | "none";
export type UIDensity = "compact" | "default" | "relaxed";
export type BlurIntensity = "light" | "medium" | "heavy";
export type IconWeight = "light" | "regular" | "bold";
export type MotionSpeed = "none" | "fast" | "default" | "slow";
export type FontWeight = "light" | "regular" | "medium";

interface ViewPreferencesState {
  // Catalog view mode
  catalogViewMode: ViewMode;
  // Inventory view mode
  inventoryViewMode: ViewMode;
  // UI corner radius
  contentRadius: ContentRadius;
  // Nav border style
  navBorderStyle: NavBorderStyle;
  // Global UI density
  uiDensity: UIDensity;
  // Global background blur intensity
  blurIntensity: BlurIntensity;
  // Icon stroke weight
  iconWeight: IconWeight;
  // UI motion/animation speed
  motionSpeed: MotionSpeed;
  // Base font weight
  fontWeight: FontWeight;
}

interface ViewPreferencesActions {
  setCatalogViewMode: (mode: ViewMode) => void;
  setInventoryViewMode: (mode: ViewMode) => void;
  setContentRadius: (radius: ContentRadius) => void;
  setNavBorderStyle: (style: NavBorderStyle) => void;
  setUIDensity: (density: UIDensity) => void;
  setBlurIntensity: (intensity: BlurIntensity) => void;
  setIconWeight: (weight: IconWeight) => void;
  setMotionSpeed: (speed: MotionSpeed) => void;
  setFontWeight: (weight: FontWeight) => void;
  resetViewPreferences: () => void;
}

type ViewPreferencesStore = ViewPreferencesState & ViewPreferencesActions;

const initialState: ViewPreferencesState = {
  catalogViewMode: "default",
  inventoryViewMode: "default",
  contentRadius: "rounded",
  navBorderStyle: "solid",
  uiDensity: "default",
  blurIntensity: "medium",
  iconWeight: "regular",
  motionSpeed: "default",
  fontWeight: "regular",
};

export const useViewPreferencesStore = create<ViewPreferencesStore>()(
  devtools(
    persist(
      (set) => ({
        ...initialState,

        setCatalogViewMode: (catalogViewMode) => {
          set({ catalogViewMode }, false, "setCatalogViewMode");
          window.api.setSettings({ catalogViewMode });
        },

        setInventoryViewMode: (inventoryViewMode) => {
          set({ inventoryViewMode }, false, "setInventoryViewMode");
          window.api.setSettings({ inventoryViewMode });
        },

        setContentRadius: (contentRadius) => {
          set({ contentRadius }, false, "setContentRadius");
          
        },

        setNavBorderStyle: (navBorderStyle) => {
          set({ navBorderStyle }, false, "setNavBorderStyle");
          
        },

        setUIDensity: (uiDensity) => {
          set({ uiDensity }, false, "setUIDensity");
          window.api.setSettings({ uiDensity });
        },

        setBlurIntensity: (blurIntensity) => {
          set({ blurIntensity }, false, "setBlurIntensity");
          
        },

        setIconWeight: (iconWeight) => {
          set({ iconWeight }, false, "setIconWeight");
          
        },

        setMotionSpeed: (motionSpeed) => {
          set({ motionSpeed }, false, "setMotionSpeed");
          window.api.setSettings({ motionSpeed });
        },

        setFontWeight: (fontWeight) => {
          set({ fontWeight }, false, "setFontWeight");
          
        },

        resetViewPreferences: () =>
          set(initialState, false, "resetViewPreferences"),
      }),
      {
        name: "view-preferences-storage",
        // Persist all view preferences
        partialize: (state) => ({
          catalogViewMode: state.catalogViewMode,
          inventoryViewMode: state.inventoryViewMode,
          contentRadius: state.contentRadius,
          navBorderStyle: state.navBorderStyle,
          uiDensity: state.uiDensity,
          blurIntensity: state.blurIntensity,
          iconWeight: state.iconWeight,
          motionSpeed: state.motionSpeed,
          fontWeight: state.fontWeight,
        }),
      },
    ),
    { name: "ViewPreferencesStore" },
  ),
);

// ============================================================================
// Bootstrap from backend config.json on first load
// ============================================================================

import { useEffect } from "react";

/**
 * Call this once near the app root to hydrate the view preferences store
 * from the backend config.json, overriding any stale localStorage values.
 */
export function useInitViewPreferencesFromBackend(): void {
  useEffect(() => {
    if (!(window as any).api?.getSettings) return;
    (window as any).api
      .getSettings()
      .then((settings: any) => {
        const store = useViewPreferencesStore.getState();
        const s = settings as any;
        if (s?.catalogViewMode) store.setCatalogViewMode(s.catalogViewMode);
        if (s?.inventoryViewMode) store.setInventoryViewMode(s.inventoryViewMode);
        if (s?.contentRadius) store.setContentRadius(s.contentRadius);
        if (s?.navBorderStyle) store.setNavBorderStyle(s.navBorderStyle);
        if (s?.uiDensity) store.setUIDensity(s.uiDensity);
        if (s?.blurIntensity) store.setBlurIntensity(s.blurIntensity);
        if (s?.iconWeight) store.setIconWeight(s.iconWeight);
        if (s?.motionSpeed) store.setMotionSpeed(s.motionSpeed);
        if (s?.fontWeight) store.setFontWeight(s.fontWeight);
      })
      .catch(() => {/* ignore — localStorage fallback still applies */});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

// ============================================================================
// Selectors
// ============================================================================

export const useCatalogViewMode = () =>
  useViewPreferencesStore((state) => state.catalogViewMode);
export const useSetCatalogViewMode = () =>
  useViewPreferencesStore((state) => state.setCatalogViewMode);

export const useInventoryViewMode = () =>
  useViewPreferencesStore((state) => state.inventoryViewMode);
export const useSetInventoryViewMode = () =>
  useViewPreferencesStore((state) => state.setInventoryViewMode);

export const useContentRadius = () =>
  useViewPreferencesStore((state) => state.contentRadius);
export const useSetContentRadius = () =>
  useViewPreferencesStore((state) => state.setContentRadius);

export const useNavBorderStyle = () =>
  useViewPreferencesStore((state) => state.navBorderStyle);
export const useSetNavBorderStyle = () =>
  useViewPreferencesStore((state) => state.setNavBorderStyle);

export const useUIDensity = () =>
  useViewPreferencesStore((state) => state.uiDensity);
export const useSetUIDensity = () =>
  useViewPreferencesStore((state) => state.setUIDensity);

export const useBlurIntensity = () =>
  useViewPreferencesStore((state) => state.blurIntensity);
export const useSetBlurIntensity = () =>
  useViewPreferencesStore((state) => state.setBlurIntensity);

export const useIconWeight = () =>
  useViewPreferencesStore((state) => state.iconWeight);
export const useSetIconWeight = () =>
  useViewPreferencesStore((state) => state.setIconWeight);

export const useMotionSpeed = () =>
  useViewPreferencesStore((state) => state.motionSpeed);
export const useSetMotionSpeed = () =>
  useViewPreferencesStore((state) => state.setMotionSpeed);

export const useFontWeight = () =>
  useViewPreferencesStore((state) => state.fontWeight);
export const useSetFontWeight = () =>
  useViewPreferencesStore((state) => state.setFontWeight);

export const useResetViewPreferences = () =>
  useViewPreferencesStore((state) => state.resetViewPreferences);
