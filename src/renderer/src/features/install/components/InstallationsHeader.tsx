import React from "react";
import { RefreshCw, Plus, DownloadCloud } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@renderer/components/UI/display/Tooltip";
import { Button } from "@renderer/components/UI/buttons/Button";

interface InstallationsHeaderProps {
  count: number;
  onRefresh: () => void;
  onNew: () => void;
  isMac: boolean;
}

export const InstallationsHeader: React.FC<InstallationsHeaderProps> = ({
  count,
  onRefresh,
  onNew,
  isMac,
}) => {
  return (
    <div className="shrink-0 h-[72px] bg-[var(--color-surface-strong)] border-b border-[var(--color-border)] z-20 flex items-center justify-between px-6">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-bold text-[var(--color-text-primary)]">Installations</h1>
        <span className="flex items-center justify-center px-2.5 py-0.5 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] text-xs font-semibold tracking-tight text-[var(--color-text-secondary)]">
          {count}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={onRefresh}
              className="pressable flex items-center gap-2 px-4 py-2 rounded-[var(--control-radius)] transition-all text-sm font-medium bg-[var(--color-surface)] text-[var(--color-text-secondary)] border border-[var(--color-border)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)]"
            >
              <RefreshCw size={15} />
              Refresh
            </button>
          </TooltipTrigger>
          <TooltipContent>
            Refresh version history and installations
          </TooltipContent>
        </Tooltip>
        <Button
          variant="default"
          onClick={onNew}
          className="gap-2"
          disabled={isMac}
        >
          <Plus size={16} />
          <span>New Installation</span>
        </Button>
      </div>
    </div>
  );
};
