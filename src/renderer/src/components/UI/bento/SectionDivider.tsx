import React from "react";

export function SectionDivider({ label }: { label: string }) {
  return (
    <div className="col-span-1 md:col-span-2 flex items-center gap-3 pt-4 pb-1">
      <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--color-text-muted)] whitespace-nowrap">
        {label}
      </span>
      <div className="flex-1 h-px bg-[var(--color-border)]" />
    </div>
  );
}
