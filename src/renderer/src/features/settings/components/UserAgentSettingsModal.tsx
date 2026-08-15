import { Globe, RotateCcw, Zap, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
  DialogBody,
} from "../../../components/UI/dialogs/Dialog";

interface UserAgentSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserAgent: string;
  userAgentIndex: number;
  allUserAgents: string[];
  isLoadingUserAgent: boolean;
  isAutoSwapEnabled: boolean;
  autoSwapInterval: number;
  setAutoSwapInterval: (val: number) => void;
  onRotateNext: () => Promise<void>;
  onSelectAgent: (index: number) => Promise<void>;
  onToggleAutoSwap: () => Promise<void>;
}

export default function UserAgentSettingsModal({
  isOpen,
  onClose,
  currentUserAgent,
  userAgentIndex,
  allUserAgents,
  isLoadingUserAgent,
  isAutoSwapEnabled,
  autoSwapInterval,
  setAutoSwapInterval,
  onRotateNext,
  onSelectAgent,
  onToggleAutoSwap,
}: UserAgentSettingsModalProps) {
  return (
    <Dialog isOpen={isOpen} onClose={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-[var(--accent-color)]" />
            <DialogTitle>User Agent Configuration</DialogTitle>
          </div>
          <DialogClose />
        </DialogHeader>
        <DialogBody className="px-4 py-3 space-y-4">
          <div className="flex items-center gap-3">
            <button
              onClick={onRotateNext}
              disabled={isLoadingUserAgent}
              className="px-4 py-2 text-sm font-medium rounded-[var(--control-radius)] text-black bg-[var(--accent-color)] hover:brightness-110 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-[0_0_15px_rgba(var(--accent-color-rgb),0.3)]"
            >
              <RotateCcw
                size={14}
                className={isLoadingUserAgent ? "animate-spin" : ""}
              />
              Rotate to Next
            </button>
            <div className="text-xs text-[var(--color-text-muted)]">
              Current:{" "}
              <span className="font-semibold text-[var(--color-text-primary)]">
                #{userAgentIndex + 1}
              </span>{" "}
              of {allUserAgents.length}
            </div>
          </div>

          <div className="bg-[var(--color-surface-hover)] p-3 rounded-[var(--control-radius)] border border-[var(--color-border)]">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)] mb-1">
              Active User Agent
            </p>
            <p className="text-xs text-[var(--color-text-primary)] break-words font-mono leading-relaxed">
              {currentUserAgent || "Loading..."}
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)]">
              Select from {allUserAgents.length} Agents
            </label>
            <div className="h-48 overflow-y-auto border border-[var(--color-border)] rounded-[var(--control-radius)] bg-[var(--color-surface-muted)] styled-scrollbar divide-y divide-[var(--color-border)]/50">
              {allUserAgents.map((ua, index) => {
                const isActive = userAgentIndex === index;
                return (
                  <button
                    key={index}
                    onClick={() => onSelectAgent(index)}
                    disabled={isLoadingUserAgent || isActive}
                    className={`w-full text-left px-3 py-2.5 transition-colors disabled:opacity-50 flex items-start gap-3 group ${
                      isActive
                        ? "bg-[var(--accent-color)]/10 text-[var(--accent-color)] border-l-2 border-[var(--accent-color)]"
                        : "hover:bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)]"
                    }`}
                  >
                    <span
                      className={`text-[10px] font-bold mt-0.5 shrink-0 w-6 ${isActive ? "text-[var(--accent-color)]" : "text-[var(--color-text-muted)] group-hover:text-[var(--color-text-primary)]"}`}
                    >
                      #{index + 1}
                    </span>
                    <span className="text-xs break-words font-mono leading-tight">
                      {ua}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-4 p-3.5 bg-[var(--color-surface-hover)] rounded-[var(--control-radius)] border border-[var(--color-border)]">
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-primary)]">
                  Auto-rotate User Agents
                </label>
                <span className="text-xs font-medium text-[var(--accent-color)]">
                  {autoSwapInterval} min
                </span>
              </div>
              <input
                type="range"
                min="5"
                max="120"
                step="5"
                value={autoSwapInterval}
                onChange={(e) => setAutoSwapInterval(Number(e.target.value))}
                disabled={isLoadingUserAgent}
                className="w-full appearance-none bg-transparent cursor-pointer disabled:opacity-50 custom-dot-slider"
              />
            </div>
            <button
              onClick={onToggleAutoSwap}
              disabled={isLoadingUserAgent}
              className={`shrink-0 px-4 py-2 text-xs font-bold rounded-[var(--control-radius)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 ${
                isAutoSwapEnabled
                  ? "text-black bg-[var(--accent-color)]"
                  : "text-[var(--color-text-secondary)] bg-[var(--color-surface-muted)] hover:bg-[var(--color-surface-secondary)] border border-[var(--color-border)]"
              }`}
            >
              <Zap size={14} />
              {isAutoSwapEnabled ? "Enabled" : "Disabled"}
            </button>
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
