import * as React from "react";
import { cn } from "../../../lib/utils";

type CardVariant = "default" | "ghost" | "account";

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    selected?: boolean;
    disableHover?: boolean;
    variant?: CardVariant;
  }
>(
  (
    { className, selected, disableHover, variant = "default", ...props },
    ref,
  ) => {
    const variantStyles = {
      default:
        "bg-[var(--color-surface-strong)] border-[var(--color-border-subtle)]",
      ghost: "bg-transparent border-transparent shadow-none",
      account:
        "bg-[var(--color-surface)] border-[var(--color-border-subtle)] overflow-hidden p-0",
    };

    return (
      <div
        ref={ref}
        className={cn(
          "rounded-xl border text-[var(--color-text-primary)] transition-[transform,box-shadow,border-color,background-color] duration-200 ease-out shadow-sm",
          variantStyles[variant],
          selected
            ? variant === "account"
              ? "border-[var(--accent-color-border)] shadow-[0_0_0_1px_var(--accent-color-border),0_2px_16px_var(--accent-color-ring)]"
              : "border-[var(--color-border-strong)] shadow-md ring-1 ring-[var(--focus-ring)]"
            : disableHover
              ? ""
              : "hover:border-[var(--color-border)] hover:shadow-md hover:bg-[var(--color-surface-hover)]",
          className,
        )}
        {...props}
      />
    );
  },
);
Card.displayName = "Card";

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-6", className)}
    {...props}
  />
));
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      "text-lg font-semibold leading-none tracking-tight",
      className,
    )}
    {...props}
  />
));
CardTitle.displayName = "CardTitle";

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
));
CardContent.displayName = "CardContent";

export { Card, CardHeader, CardTitle, CardContent };
