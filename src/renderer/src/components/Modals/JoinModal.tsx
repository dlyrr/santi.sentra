import React, { useEffect, useMemo, useState } from "react";
import { X, Play, User, MapPin, Briefcase, LogIn, Link2 } from "lucide-react";
import { JoinMethod, JoinConfig } from "../../types";
import { Dialog, DialogContent } from "../UI/dialogs/Dialog";

export interface JoinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLaunch: (config: JoinConfig) => void;
  selectedCount: number;
}

const JoinModal: React.FC<JoinModalProps> = ({
  isOpen,
  onClose,
  onLaunch,
  selectedCount,
}) => {
  const [method, setMethod] = useState<JoinMethod>(JoinMethod.Username);
  const [target, setTarget] = useState("");
  const [placeId, setPlaceId] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setTarget("");
    setPlaceId("");
    setMethod(JoinMethod.Username);
  }, [isOpen]);

  const joinMethodOptions = useMemo(
    () => [
      { id: JoinMethod.Username, label: "Username", icon: User },
      { id: JoinMethod.PlaceId, label: "Place ID", icon: MapPin },
      { id: JoinMethod.JobId, label: "Job ID", icon: Briefcase },
      { id: JoinMethod.PrivateServer, label: "Private", icon: Link2 },
    ],
    [],
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let finalTarget = target;
    if (method === JoinMethod.JobId) {
      finalTarget = `${placeId.trim()}:${target.trim()}`;
    }
    onLaunch({ method, target: finalTarget });
  };

  return (
    <Dialog isOpen={isOpen} onClose={onClose}>
      <DialogContent className="w-full max-w-md bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl shadow-2xl overflow-hidden ring-1 ring-[var(--accent-color-ring)]">
        {}
        <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)] bg-[var(--color-surface-strong)]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[var(--color-surface-hover)] rounded-lg">
              <LogIn className="text-[var(--color-text-secondary)]" size={20} />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-[var(--color-text-primary)]">
                Launch Options
              </h3>
              <p className="text-sm text-[var(--color-text-muted)]">
                {selectedCount} selected account{selectedCount !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="pressable p-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {}
          <div className="space-y-3">
            <label className="block text-base font-medium text-[var(--color-text-secondary)]">
              Join Method
            </label>
            <div className="grid grid-cols-2 gap-2">
              {joinMethodOptions.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setMethod(id)}
                  className={`pressable flex flex-col items-center justify-center gap-2 p-3 rounded border transition-all ${
                    method === id
                      ? "bg-[var(--accent-color)] border-[var(--accent-color-border)] text-[var(--accent-color-foreground)] shadow-[0_5px_20px_var(--accent-color-shadow)]"
                      : "bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-secondary)]"
                  }`}
                >
                  <Icon size={24} />
                  <span className="text-sm font-medium">{label}</span>
                </button>
              ))}
            </div>
          </div>

          {}
          <div className="space-y-4">
            {method === JoinMethod.JobId ? (
              <>
                <div className="space-y-2">
                  <label
                    htmlFor="placeIdInput"
                    className="block text-base font-medium text-[var(--color-text-secondary)] pb-2"
                  >
                    Game Place ID
                  </label>
                  <input
                    id="placeIdInput"
                    type="text"
                    value={placeId}
                    onChange={(e) => setPlaceId(e.target.value)}
                    placeholder="e.g. 1818"
                    className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--color-border-strong)] focus:border-[var(--accent-color)] transition-all"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label
                    htmlFor="jobIdInput"
                    className="block text-base font-medium text-[var(--color-text-secondary)] pb-2"
                  >
                    Server Job ID
                  </label>
                  <input
                    id="jobIdInput"
                    type="text"
                    value={target}
                    onChange={(e) => setTarget(e.target.value)}
                    placeholder="e.g. 772-112-991"
                    className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--color-border-strong)] focus:border-[var(--accent-color)] transition-all"
                    required
                  />
                </div>
              </>
            ) : method === JoinMethod.PrivateServer ? (
              <div className="space-y-2">
                <label
                  htmlFor="targetInput"
                  className="block text-base font-medium text-[var(--color-text-secondary)] pb-2"
                >
                  Private Server Link or Code
                </label>
                <input
                  id="targetInput"
                  type="text"
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  placeholder="https://www.roblox.com/games/1818?privateServerLinkCode=... or 1818:ABC123"
                  className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--color-border-strong)] focus:border-[var(--accent-color)] transition-all"
                  required
                />
              </div>
            ) : (
              <div className="space-y-2">
                <label
                  htmlFor="targetInput"
                  className="block text-base font-medium text-[var(--color-text-secondary)] pb-2"
                >
                  {method === JoinMethod.Username && "Target Username"}
                  {method === JoinMethod.PlaceId && "Game Place ID"}
                </label>
                <input
                  id="targetInput"
                  type="text"
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  placeholder={
                    method === JoinMethod.Username
                      ? "e.g. Builderman"
                      : "e.g. 1818"
                  }
                  className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--color-border-strong)] focus:border-[var(--accent-color)] transition-all"
                  required
                />
              </div>
            )}
          </div>

          {}
          <div className="pt-2 flex gap-3">
            <button
              type="submit"
              disabled={
                !target ||
                (method === JoinMethod.JobId && !placeId) ||
                (method === JoinMethod.PrivateServer && !target.trim())
              }
              className="pressable flex-1 flex items-center justify-center gap-2 bg-[var(--accent-color)] hover:bg-[var(--accent-color-muted)] text-[var(--accent-color-foreground)] text-md font-bold h-10 rounded shadow-lg shadow-[0_10px_30px_var(--accent-color-shadow)] border border-[var(--accent-color-border)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Play size={16} fill="currentColor" />
              <span>Launch Game</span>
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default React.memo(JoinModal);
