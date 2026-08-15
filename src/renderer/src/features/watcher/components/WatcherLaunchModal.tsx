import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
  DialogBody,
} from "@renderer/components/UI/dialogs/Dialog";
import { Button } from "@renderer/components/UI/buttons/Button";
import { Loader2 } from "lucide-react";

interface WatcherLaunchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLaunch: (choice: "public" | "private" | "jobid" | "username") => void;
  launchJobId: string;
  setLaunchJobId: (val: string) => void;
  launchUsername: string;
  setLaunchUsername: (val: string) => void;
  launchPrivateServerLink: string;
  setLaunchPrivateServerLink: (val: string) => void;
  isLaunching: boolean;
}

export const WatcherLaunchModal: React.FC<WatcherLaunchModalProps> = ({
  isOpen,
  onClose,
  onLaunch,
  launchJobId,
  setLaunchJobId,
  launchUsername,
  setLaunchUsername,
  launchPrivateServerLink,
  setLaunchPrivateServerLink,
  isLaunching,
}) => {
  const [joinMode, setJoinMode] = useState<
    "public" | "private" | "jobid" | "username"
  >("public");

  return (
    <Dialog isOpen={isOpen} onClose={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Launch Configuration</DialogTitle>
          <DialogClose />
        </DialogHeader>
        <DialogBody>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Joining Mode</label>
              <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-2">
                <button
                  type="button"
                  onClick={() => setJoinMode("public")}
                  className={`w-full px-4 py-2.5 rounded-lg border transition-all text-left ${
                    joinMode === "public"
                      ? "bg-blue-500/20 border-blue-500 text-blue-300"
                      : "bg-[var(--color-surface-muted)] border-[var(--color-border)] text-[var(--color-text-primary)] hover:border-[var(--color-border-strong)]"
                  }`}
                >
                  <div className="font-medium text-sm">Public Server</div>
                  <div className="text-xs text-[var(--color-text-muted)] mt-1">
                    Join a random public server
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setJoinMode("jobid")}
                  className={`w-full px-4 py-2.5 rounded-lg border transition-all text-left ${
                    joinMode === "jobid"
                      ? "bg-emerald-500/20 border-emerald-500 text-emerald-300"
                      : "bg-[var(--color-surface-muted)] border-[var(--color-border)] text-[var(--color-text-primary)] hover:border-[var(--color-border-strong)]"
                  }`}
                >
                  <div className="font-medium text-sm">Job ID</div>
                  <div className="text-xs text-[var(--color-text-muted)] mt-1">
                    Join a specific server by Job ID
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setJoinMode("private")}
                  className={`w-full px-4 py-2.5 rounded-lg border transition-all text-left ${
                    joinMode === "private"
                      ? "bg-purple-500/20 border-purple-500 text-purple-300"
                      : "bg-[var(--color-surface-muted)] border-[var(--color-border)] text-[var(--color-text-primary)] hover:border-[var(--color-border-strong)]"
                  }`}
                >
                  <div className="font-medium text-sm">Private Server Link</div>
                  <div className="text-xs text-[var(--color-text-muted)] mt-1">
                    Join with an invite link or code
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setJoinMode("username")}
                  className={`w-full px-4 py-2.5 rounded-lg border transition-all text-left ${
                    joinMode === "username"
                      ? "bg-orange-500/20 border-orange-500 text-orange-300"
                      : "bg-[var(--color-surface-muted)] border-[var(--color-border)] text-[var(--color-text-primary)] hover:border-[var(--color-border-strong)]"
                  }`}
                >
                  <div className="font-medium text-sm">Follow User</div>
                  <div className="text-xs text-[var(--color-text-muted)] mt-1">
                    Join a user in game by username/ID
                  </div>
                </button>
              </div>
            </div>

            {joinMode === "jobid" && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Job ID</label>
                <input
                  type="text"
                  value={launchJobId}
                  onChange={(e) => setLaunchJobId(e.target.value)}
                  placeholder="e.g. 12345678-1234-1234-1234-123456789012"
                  className="w-full px-3 py-2 bg-[var(--color-surface-muted)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] text-sm placeholder-[var(--color-text-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-color)]"
                />
              </div>
            )}

            {joinMode === "private" && (
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Private Server Link
                </label>
                <input
                  type="text"
                  value={launchPrivateServerLink}
                  onChange={(e) => setLaunchPrivateServerLink(e.target.value)}
                  placeholder="https://www.roblox.com/games/...?privateServerLinkCode=..."
                  className="w-full px-3 py-2 bg-[var(--color-surface-muted)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] text-sm placeholder-[var(--color-text-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-color)]"
                />
              </div>
            )}

            {joinMode === "username" && (
              <div className="space-y-2">
                <label className="text-sm font-medium">User ID to Follow</label>
                <input
                  type="text"
                  value={launchUsername}
                  onChange={(e) => setLaunchUsername(e.target.value)}
                  placeholder="e.g. 123456789"
                  className="w-full px-3 py-2 bg-[var(--color-surface-muted)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] text-sm placeholder-[var(--color-text-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-color)]"
                />
              </div>
            )}

            <Button
              className="w-full mt-4"
              variant="default"
              onClick={() => onLaunch(joinMode)}
              disabled={isLaunching}
            >
              {isLaunching ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Launching...
                </>
              ) : (
                "Launch All Selected"
              )}
            </Button>
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
};
