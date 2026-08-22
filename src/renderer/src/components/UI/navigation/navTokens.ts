/**
 * One visual language for every navigation surface in the app.
 *
 * The sidebar, the top bar and the in-page pill tabs all used to hand-roll
 * their own colours, spring curves and active treatments, which is why they
 * never quite looked related. They now all pull from here instead.
 */

/** Shared spring for every sliding active indicator. */
export const NAV_SPRING = {
  type: "spring",
  stiffness: 420,
  damping: 38,
  mass: 0.7,
} as const;

/** Shared easing for colour/opacity changes that are not layout-driven. */
export const NAV_EASE = [0.16, 1, 0.3, 1] as const;

/**
 * The moving surface that marks the active item. Rendered behind the label
 * with a `layoutId` so it slides between items instead of cross-fading.
 */
export const navIndicator =
  "absolute inset-0 rounded-lg bg-[var(--accent-color-soft)] " +
  "shadow-[inset_0_0_0_1px_rgba(var(--accent-color-rgb),0.18)]";

/** Base geometry shared by every nav item, whatever the surface. */
export const navItemBase =
  "relative flex items-center rounded-lg font-medium select-none " +
  "transition-colors duration-200 outline-none " +
  "focus-visible:ring-2 focus-visible:ring-[var(--accent-color)] focus-visible:ring-offset-0";

/** Foreground treatment, driven purely by active state. */
export const navItemTone = (isActive: boolean) =>
  isActive
    ? "text-[var(--color-text-primary)]"
    : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)]";

/** Icon treatment. Active icons take the accent; nothing scales or jumps. */
export const navIconTone = (isActive: boolean) =>
  isActive
    ? "text-[var(--accent-color)] transition-colors duration-200"
    : "transition-colors duration-200";

/** Icons gain a little weight when active — the only remaining size cue. */
export const navIconStroke = (isActive: boolean) => (isActive ? 2.2 : 1.75);

/** Small caps section heading used by the sidebar groups. */
export const navSectionLabel =
  "text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]";

/** Counter/badge chip, shared by sidebar items and in-page tabs. */
export const navBadge =
  "text-[10px] leading-none px-1.5 py-0.5 rounded-full border font-medium";

export const navBadgeTone = (
  variant: "default" | "warning" | "success" | "error" = "default",
) => {
  switch (variant) {
    case "warning":
      return "bg-yellow-500/15 text-yellow-400 border-yellow-500/25";
    case "success":
      return "bg-emerald-500/15 text-emerald-400 border-emerald-500/25";
    case "error":
      return "bg-red-500/15 text-red-400 border-red-500/25";
    default:
      return "bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)] border-[var(--color-border)]";
  }
};
