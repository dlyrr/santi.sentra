import React, { useState } from "react";
import { X, Lock, Link2, Play } from "lucide-react";
import { Dialog, DialogContent } from "../UI/dialogs/Dialog";

export interface PrivateServerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (link: string, serverName?: string) => void;
  isLoading?: boolean;
  sessionUsername?: string;
}

const PrivateServerModal: React.FC<PrivateServerModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  isLoading = false,
  sessionUsername = "Session",
}) => {
  const [link, setLink] = useState("");
  const [serverName, setServerName] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (link.trim()) {
      onSubmit(link.trim(), serverName.trim() || undefined);
      setLink("");
      setServerName("");
    }
  };

  const handleClose = () => {
    setLink("");
    setServerName("");
    onClose();
  };

  return (
    <Dialog isOpen={isOpen} onClose={handleClose}>
      <DialogContent className="w-full max-w-md bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl shadow-2xl overflow-hidden">
        {}
        <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)] bg-[var(--color-surface-strong)]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[var(--color-surface-hover)] rounded-lg">
              <Lock className="text-[var(--color-text-primary)]" size={20} />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-[var(--color-text-primary)]">
                Join Private Server
              </h3>
              <p className="text-sm text-[var(--color-text-muted)]">
                {sessionUsername}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={isLoading}
            className="pressable p-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] rounded-lg transition-colors disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </div>

        {}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {}
          <div className="space-y-2">
            <label
              htmlFor="linkInput"
              className="block text-sm font-medium text-[var(--color-text-primary)]"
            >
              <div className="flex items-center gap-2">
                <Link2 size={14} />
                <span>Server Link</span>
              </div>
            </label>
            <input
              id="linkInput"
              type="text"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://www.roblox.com/games/..."
              className="w-full bg-[var(--color-surface-muted)] border border-[var(--color-border)] rounded-lg px-4 py-2.5 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-color)] focus:border-[var(--accent-color)] transition-all"
              required
              disabled={isLoading}
            />
            <p className="text-xs text-[var(--color-text-muted)]">
              Paste the private server link here
            </p>
          </div>

          {}
          <div className="space-y-2">
            <label
              htmlFor="serverNameInput"
              className="block text-sm font-medium text-[var(--color-text-primary)]"
            >
              Server Name{" "}
              <span className="text-[var(--color-text-muted)] text-xs font-normal">
                (optional)
              </span>
            </label>
            <input
              id="serverNameInput"
              type="text"
              value={serverName}
              onChange={(e) => setServerName(e.target.value)}
              placeholder="e.g. Trading Server"
              className="w-full bg-[var(--color-surface-muted)] border border-[var(--color-border)] rounded-lg px-4 py-2.5 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-color)] focus:border-[var(--accent-color)] transition-all"
              disabled={isLoading}
            />
          </div>

          {}
          <div className="pt-2 flex gap-3">
            <button
              type="button"
              onClick={handleClose}
              disabled={isLoading}
              className="flex-1 flex items-center justify-center gap-2 bg-[var(--color-surface-hover)] hover:bg-[var(--color-surface-muted)] text-[var(--color-text-primary)] font-medium h-10 rounded-lg border border-[var(--color-border)] transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!link.trim() || isLoading}
              className="pressable flex-1 flex items-center justify-center gap-2 bg-[var(--accent-color)] hover:bg-[var(--accent-color-muted)] text-[var(--accent-color-foreground)] font-bold h-10 rounded-lg shadow-[0_10px_30px_var(--accent-color-shadow)] border border-[var(--accent-color-border)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Play size={16} fill="currentColor" />
              <span>{isLoading ? "Joining..." : "Join Server"}</span>
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default PrivateServerModal;
