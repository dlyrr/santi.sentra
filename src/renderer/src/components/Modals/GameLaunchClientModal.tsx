import React, { useEffect, useMemo, useState } from "react";
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

interface GameLaunchClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectClient: (path?: string) => void;
  installations: Array<{ path?: string; name: string; version?: string }>;
  isLaunching: boolean;
}

export const GameLaunchClientModal: React.FC<GameLaunchClientModalProps> =
  React.memo(
    ({ isOpen, onClose, onSelectClient, installations, isLaunching }) => {
      const [selectedPath, setSelectedPath] = useState<string | undefined>(
        installations[0]?.path,
      );

      const options = useMemo(
        () => [
          ...installations,
          {
            path: undefined,
            name: "System Default",
            version: "Auto-detect installation",
          },
        ],
        [installations],
      );

      useEffect(() => {
        if (!isOpen) return;
        setSelectedPath((prev) => prev ?? installations[0]?.path);
      }, [isOpen, installations]);

      const handleLaunch = () => {
        onSelectClient(selectedPath);
        onClose();
      };

      return (
        <Dialog isOpen={isOpen} onClose={onClose}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Select Roblox Client</DialogTitle>
              <DialogClose />
            </DialogHeader>
            <DialogBody>
              <div className="space-y-4">
                <p className="text-sm text-[var(--color-text-secondary)]">
                  Choose which Roblox client installation to launch games with.
                </p>

                <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                  {options.map((installation) => (
                    <button
                      key={installation.path ?? "default"}
                      type="button"
                      onClick={() => setSelectedPath(installation.path)}
                      className={`w-full px-4 py-3 rounded-lg border transition-all text-left ${
                        selectedPath === installation.path
                          ? "bg-blue-500/20 border-blue-500 text-blue-300"
                          : "bg-[var(--color-surface-muted)] border-[var(--color-border)] text-[var(--color-text-primary)] hover:border-[var(--color-border-strong)]"
                      }`}
                    >
                      <div className="font-medium text-sm">
                        {installation.name}
                      </div>
                      <div className="text-xs text-[var(--color-text-muted)] mt-1">
                        {(
                          installation.version ?? "Auto-detect installation"
                        ).substring(0, 20)}
                        ...
                      </div>
                    </button>
                  ))}
                </div>

                <div className="flex gap-2 pt-4">
                  <Button
                    variant="secondary"
                    onClick={onClose}
                    disabled={isLaunching}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="default"
                    onClick={handleLaunch}
                    disabled={isLaunching}
                  >
                    {isLaunching && (
                      <Loader2 size={16} className="animate-spin mr-2" />
                    )}
                    Launch
                  </Button>
                </div>
              </div>
            </DialogBody>
          </DialogContent>
        </Dialog>
      );
    },
  );
