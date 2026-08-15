import React from "react";
import CustomCheckbox from "../buttons/CustomCheckbox";

export const ToggleRow: React.FC<{
  title: string;
  description: React.ReactNode;
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  icon?: React.ReactNode;
  hint?: React.ReactNode;
}> = ({ title, description, checked, onChange, disabled, icon, hint }) => (
  <div className="flex items-start gap-3 p-4 bg-[var(--color-surface-muted)] rounded-[var(--control-radius)] border border-[var(--color-border)]/50 hover:border-[var(--color-border-strong)]/50 transition-colors">
    <div className="mt-1">
      <CustomCheckbox
        checked={checked}
        onChange={onChange}
        disabled={disabled}
      />
    </div>
    <div className="space-y-1">
      <div className="flex items-center gap-2 text-sm font-medium text-[var(--color-text-secondary)]">
        {icon}
        <span>{title}</span>
      </div>
      <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
        {description}
      </p>
      {hint}
    </div>
  </div>
);
