import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";
import { startTransition } from "react";
import { TabId, JoinConfig, Account, Game, RobloxInstallation } from "../types";

export type ModalType =
  | "join"
  | "addAccount"
  | "instanceSelection"
  | "changeDisplayName";

export type NavLayout = "sidebar" | "topbar";

interface UIState {
  activeTab: TabId;

  isSidebarCollapsed: boolean;

  navLayout: NavLayout;

  modals: Record<ModalType, boolean>;

  activeMenu: { id: string; x: number; y: number } | null;

  editingAccount: Account | null;
  infoAccount: Account | null;
  selectedGame: Game | null;
  serverTabTargetPlaceId: string;

  pendingLaunchConfig: JoinConfig | null;
  availableInstallations: RobloxInstallation[];

  isAppUnlocked: boolean;
}

interface UIActions {
  setActiveTab: (tab: TabId) => void;

  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebarCollapsed: () => void;

  setNavLayout: (layout: NavLayout) => void;

  openModal: (modal: ModalType) => void;
  closeModal: (modal: ModalType) => void;
  setModalOpen: (modal: ModalType, open: boolean) => void;

  setActiveMenu: (menu: { id: string; x: number; y: number } | null) => void;

  setEditingAccount: (account: Account | null) => void;
  setInfoAccount: (account: Account | null) => void;
  setSelectedGame: (game: Game | null) => void;
  setServerTabTargetPlaceId: (placeId: string) => void;

  setPendingLaunchConfig: (config: JoinConfig | null) => void;
  setAvailableInstallations: (installations: RobloxInstallation[]) => void;

  setAppUnlocked: (unlocked: boolean) => void;
}

type UIStore = UIState & UIActions;

const initialState: UIState = {
  activeTab: "Accounts",
  isSidebarCollapsed: false,
  navLayout: "sidebar",
  modals: {
    join: false,
    addAccount: false,
    instanceSelection: false,
    changeDisplayName: false,
  },
  activeMenu: null,
  editingAccount: null,
  infoAccount: null,
  selectedGame: null,
  serverTabTargetPlaceId: "",
  pendingLaunchConfig: null,
  availableInstallations: [],
  isAppUnlocked: false,
};

export const useUIStore = create<UIStore>()(
  devtools(
    persist(
      (set) => ({
        ...initialState,

        setActiveTab: (activeTab) =>
          startTransition(() => {
            set({ activeTab }, false, "setActiveTab");
          }),

        setSidebarCollapsed: (isSidebarCollapsed) => {
          set({ isSidebarCollapsed }, false, "setSidebarCollapsed");
          window.api.setSettings({ isSidebarCollapsed });
        },
        toggleSidebarCollapsed: () =>
          set(
            (state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed }),
            false,
            "toggleSidebarCollapsed",
          ),

        setNavLayout: (navLayout) => {
          set({ navLayout }, false, "setNavLayout");
          window.api.setSettings({ navLayout });
        },

        openModal: (modal) =>
          set(
            (state) => ({ modals: { ...state.modals, [modal]: true } }),
            false,
            `openModal:${modal}`,
          ),
        closeModal: (modal) =>
          set(
            (state) => ({ modals: { ...state.modals, [modal]: false } }),
            false,
            `closeModal:${modal}`,
          ),
        setModalOpen: (modal, open) =>
          set(
            (state) => ({ modals: { ...state.modals, [modal]: open } }),
            false,
            `setModalOpen:${modal}`,
          ),

        setActiveMenu: (activeMenu) =>
          set({ activeMenu }, false, "setActiveMenu"),

        setEditingAccount: (editingAccount) =>
          set({ editingAccount }, false, "setEditingAccount"),
        setInfoAccount: (infoAccount) =>
          set({ infoAccount }, false, "setInfoAccount"),
        setSelectedGame: (selectedGame) =>
          set({ selectedGame }, false, "setSelectedGame"),
        setServerTabTargetPlaceId: (serverTabTargetPlaceId) =>
          set({ serverTabTargetPlaceId }, false, "setServerTabTargetPlaceId"),

        setPendingLaunchConfig: (pendingLaunchConfig) =>
          set({ pendingLaunchConfig }, false, "setPendingLaunchConfig"),
        setAvailableInstallations: (availableInstallations) =>
          set({ availableInstallations }, false, "setAvailableInstallations"),

        setAppUnlocked: (isAppUnlocked) =>
          set({ isAppUnlocked }, false, "setAppUnlocked"),
      }),
      {
        name: "ui-storage",

        partialize: (state) => ({
          isSidebarCollapsed: state.isSidebarCollapsed,
          navLayout: state.navLayout,
        }),
      },
    ),
    { name: "UIStore" },
  ),
);

export const useActiveTab = () => useUIStore((state) => state.activeTab);
export const useSetActiveTab = () => useUIStore((state) => state.setActiveTab);

export const useSidebarCollapsed = () =>
  useUIStore((state) => state.isSidebarCollapsed);
export const useToggleSidebarCollapsed = () =>
  useUIStore((state) => state.toggleSidebarCollapsed);

export const useNavLayout = () => useUIStore((state) => state.navLayout);
export const useSetNavLayout = () => useUIStore((state) => state.setNavLayout);

export const useModals = () => useUIStore((state) => state.modals);
export const useOpenModal = () => useUIStore((state) => state.openModal);
export const useCloseModal = () => useUIStore((state) => state.closeModal);

export const useActiveMenu = () => useUIStore((state) => state.activeMenu);
export const useSetActiveMenu = () =>
  useUIStore((state) => state.setActiveMenu);

export const useEditingAccount = () =>
  useUIStore((state) => state.editingAccount);
export const useSetEditingAccount = () =>
  useUIStore((state) => state.setEditingAccount);

export const useInfoAccount = () => useUIStore((state) => state.infoAccount);
export const useSetInfoAccount = () =>
  useUIStore((state) => state.setInfoAccount);

export const useSelectedGame = () => useUIStore((state) => state.selectedGame);
export const useSetSelectedGame = () =>
  useUIStore((state) => state.setSelectedGame);

export const useServerTabTargetPlaceId = () =>
  useUIStore((state) => state.serverTabTargetPlaceId);
export const useSetServerTabTargetPlaceId = () =>
  useUIStore((state) => state.setServerTabTargetPlaceId);

export const usePendingLaunchConfig = () =>
  useUIStore((state) => state.pendingLaunchConfig);
export const useSetPendingLaunchConfig = () =>
  useUIStore((state) => state.setPendingLaunchConfig);

export const useAvailableInstallations = () =>
  useUIStore((state) => state.availableInstallations);
export const useSetAvailableInstallations = () =>
  useUIStore((state) => state.setAvailableInstallations);

export const useAppUnlocked = () => useUIStore((state) => state.isAppUnlocked);
export const useSetAppUnlocked = () =>
  useUIStore((state) => state.setAppUnlocked);
