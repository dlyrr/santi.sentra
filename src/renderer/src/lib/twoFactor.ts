import useTwoFactorStore from "@renderer/stores/useTwoFactorStore";

export function promptTwoFactor(opts?: {
  accountId?: string;
  message?: string;
}) {
  return useTwoFactorStore.getState().open(opts);
}

export default promptTwoFactor;
