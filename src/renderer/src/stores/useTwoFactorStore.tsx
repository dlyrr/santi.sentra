import { create } from "zustand";

interface TwoFactorState {
  isOpen: boolean;
  accountId?: string | null;
  message?: string | null;
  resolve?: ((code: string | null) => void) | null;
  open: (opts?: {
    accountId?: string;
    message?: string;
  }) => Promise<string | null>;
  close: (value?: string | null) => void;
}

export const useTwoFactorStore = create<TwoFactorState>((set, get) => ({
  isOpen: false,
  accountId: null,
  message: null,
  resolve: null,
  open: (opts) =>
    new Promise((resolve) => {
      set({
        isOpen: true,
        accountId: opts?.accountId ?? null,
        message: opts?.message ?? null,
        resolve,
      });
    }),
  close: (value = null) => {
    const r = get().resolve;
    if (r) r(value);
    set({ isOpen: false, accountId: null, message: null, resolve: null });
  },
}));

export default useTwoFactorStore;
