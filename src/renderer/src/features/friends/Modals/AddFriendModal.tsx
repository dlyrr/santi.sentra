import React, { useState, useEffect } from "react";
import { UserPlus, Loader2, AlertCircle } from "lucide-react";
import { Account } from "@renderer/types";
import { useNotification } from "@renderer/features/system/stores/useSnackbarStore";
import {
  Dialog,
  DialogContent,
  DialogClose,
} from "@renderer/components/UI/dialogs/Dialog";

interface AddFriendModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedAccount: Account | null;
  onFriendRequestSent?: () => void;
}

const AddFriendModal: React.FC<AddFriendModalProps> = ({
  isOpen,
  onClose,
  selectedAccount,
  onFriendRequestSent,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { showNotification } = useNotification();

  useEffect(() => {
    if (isOpen) {
      setIsLoading(false);
      setUsername("");
      setError(null);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || isLoading || !selectedAccount?.cookie) return;

    setIsLoading(true);
    setError(null);

    try {
      const userData = await window.api.getUserByUsername(username.trim());
      if (!userData) {
        setError("User not found.");
        setIsLoading(false);
        return;
      }

      const result = await window.api.sendFriendRequest(
        selectedAccount.cookie,
        userData.id,
      );

      if (result.success) {
        showNotification(
          `Friend request sent to ${userData.displayName}!`,
          "success",
        );
        setUsername("");
        onFriendRequestSent?.();
        onClose();
      } else if (result.isCaptchaRequired) {
        setError("Captcha required. Please try again later.");
      } else {
        setError("Failed to send friend request.");
      }
    } catch (err: any) {
      console.error("Failed to send friend request:", err);
      const errorMessage =
        err.message ||
        "Failed to send friend request. Please check the username and try again.";
      setError(errorMessage);
      showNotification(errorMessage, "error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog isOpen={isOpen} onClose={onClose}>
      <DialogContent className="w-full max-w-md bg-[var(--color-app-bg)] border border-[var(--color-border)] rounded-xl shadow-2xl overflow-hidden ring-1 ring-[var(--accent-color-ring)]">
        <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)] bg-[var(--color-app-bg)]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[var(--color-surface)] rounded-lg">
              <UserPlus
                size={20}
                className="text-[var(--color-text-secondary)]"
              />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-[var(--color-text-primary)]">
                Add Friend
              </h3>
              <p className="text-sm text-[var(--color-text-muted)]">
                Send a friend request
              </p>
            </div>
          </div>
          <DialogClose disabled={isLoading} />
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 flex gap-3 items-start">
              <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={18} />
              <p className="text-sm text-red-200/80 leading-relaxed">{error}</p>
            </div>
          )}

          {!selectedAccount && (
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 flex gap-3 items-start">
              <AlertCircle
                className="text-yellow-500 shrink-0 mt-0.5"
                size={18}
              />
              <p className="text-sm text-yellow-200/80 leading-relaxed">
                Please select an account first.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <label
              htmlFor="usernameInput"
              className="text-sm font-medium text-[var(--color-text-secondary)]"
            >
              Username
            </label>
            <input
              id="usernameInput"
              type="text"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                setError(null);
              }}
              disabled={isLoading || !selectedAccount}
              placeholder="Enter player username..."
              className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-4 py-3 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--color-border-strong)] focus:border-[var(--accent-color)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              autoFocus
            />
          </div>

          <div className="pt-2 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="pressable flex-1 px-4 py-3 bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)] font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!username.trim() || isLoading || !selectedAccount}
              className="pressable flex-[2] flex items-center justify-center gap-2 bg-[var(--accent-color)] hover:bg-[var(--accent-color-muted)] text-[var(--accent-color-foreground)] font-bold py-3 rounded-lg transition-colors border border-[var(--accent-color-border)] shadow-[0_5px_20px_var(--accent-color-shadow)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <UserPlus size={18} />
              )}
              <span>{isLoading ? "Sending..." : "Send Request"}</span>
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddFriendModal;
