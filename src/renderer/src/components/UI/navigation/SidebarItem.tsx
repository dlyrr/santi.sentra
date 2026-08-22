import { LucideIcon } from "lucide-react";
import { motion } from "framer-motion";
import { Tooltip, TooltipTrigger, TooltipContent } from "../display/Tooltip";
import { cn } from "../../../lib/utils";
import {
  NAV_SPRING,
  navBadge,
  navIconStroke,
  navIconTone,
  navIndicator,
  navItemBase,
  navItemTone,
} from "./navTokens";

interface SidebarItemProps {
  icon: LucideIcon;
  label: string;
  isActive: boolean;
  isCollapsed: boolean;
  onClick: () => void;
  count?: number;
  /** Suppress the sliding indicator while the sidebar itself is animating. */
  disableLayoutAnimation?: boolean;
  /** Groups the sliding indicator so it only travels within one nav surface. */
  indicatorId?: string;
}

const SidebarItem = ({
  icon: Icon,
  label,
  isActive,
  isCollapsed,
  onClick,
  count,
  disableLayoutAnimation = false,
  indicatorId = "sidebar-active",
}: SidebarItemProps) => {
  const content = (
    <button
      type="button"
      onMouseDown={onClick}
      aria-current={isActive ? "page" : undefined}
      title={undefined}
      className={cn(
        navItemBase,
        "group h-9 w-[calc(100%-16px)] mx-2 mb-0.5",
        isCollapsed ? "justify-center px-0" : "px-2.5 gap-3",
        navItemTone(isActive),
      )}
    >
      {isActive &&
        (disableLayoutAnimation ? (
          <span className={navIndicator} />
        ) : (
          <motion.span
            layoutId={indicatorId}
            className={navIndicator}
            transition={NAV_SPRING}
          />
        ))}

      <Icon
        size={17}
        strokeWidth={navIconStroke(isActive)}
        className={cn("relative z-10 shrink-0", navIconTone(isActive))}
      />

      <span
        className={cn(
          "relative z-10 flex items-center gap-2 text-[13px] whitespace-nowrap overflow-hidden transition-[opacity,width] duration-200",
          isCollapsed ? "opacity-0 w-0" : "opacity-100 w-auto",
        )}
      >
        {label}
        {count !== undefined && !isCollapsed && (
          <span
            className={cn(
              navBadge,
              "bg-[var(--color-surface-muted)] text-[var(--color-text-muted)] border-[var(--color-border)]",
            )}
          >
            {count}
          </span>
        )}
      </span>
    </button>
  );

  if (isCollapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent side="right" sideOffset={10}>
          {label}
          {count !== undefined && ` (${count})`}
        </TooltipContent>
      </Tooltip>
    );
  }

  return content;
};

export default SidebarItem;
