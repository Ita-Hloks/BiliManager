import type { ComponentPropsWithRef, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost" | "icon" | "numberStep";

type ButtonSize = "sm" | "md" | "full";

type ButtonProps = ComponentPropsWithRef<"button"> & {
  icon?: ReactNode;
  size?: ButtonSize;
  variant?: ButtonVariant;
};

const baseButtonClass =
  "inline-flex items-center justify-center transition-colors duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bili-blue/40 enabled:active:scale-[0.98] disabled:cursor-not-allowed";

const variantClassMap: Record<ButtonVariant, string> = {
  primary:
    "gap-1.5 rounded-lg bg-[var(--bm-accent)] font-medium text-white shadow-[0_1px_2px_rgb(0_174_236/0.25),inset_0_1px_0_rgb(255_255_255/0.18)] hover:bg-[var(--bm-accent-hover)] disabled:opacity-45 disabled:shadow-none",
  secondary:
    "gap-1.5 rounded-lg border border-[var(--bm-border)] bg-[var(--bm-surface)] font-medium text-[var(--bm-text-primary)] shadow-[0_1px_2px_rgb(15_23_42/0.04)] hover:border-[var(--bm-border-strong)] hover:bg-[var(--bm-surface-hover)] disabled:opacity-50 disabled:shadow-none dark:shadow-none",
  danger:
    "gap-1.5 rounded-lg border border-[var(--bm-border)] bg-[var(--bm-surface)] font-medium text-rose-600 shadow-[0_1px_2px_rgb(15_23_42/0.04)] hover:border-rose-300 hover:bg-rose-50 disabled:opacity-50 disabled:shadow-none dark:text-rose-400 dark:shadow-none dark:hover:border-rose-500/40 dark:hover:bg-rose-500/10",
  ghost:
    "gap-1.5 rounded-lg font-medium text-[var(--bm-text-secondary)] hover:bg-[var(--bm-surface-hover)] hover:text-[var(--bm-text-primary)] disabled:opacity-50",
  icon: "rounded-md text-[var(--bm-text-tertiary)] hover:bg-rose-500/10 hover:text-rose-500 disabled:opacity-40",
  numberStep:
    "flex-1 text-[var(--bm-text-tertiary)] hover:bg-[var(--bm-surface-hover)] hover:text-[var(--bm-text-primary)] disabled:opacity-40",
};

const standardSizeClassMap: Record<ButtonSize, string> = {
  sm: "h-8 px-2.5 text-xs",
  md: "h-9 px-3.5 text-sm",
  full: "h-9 w-full px-3.5 text-sm sm:w-auto",
};

const compactSizeClassMap: Record<ButtonSize, string> = {
  sm: "p-1",
  md: "p-1.5",
  full: "p-1.5",
};

// 设置页按钮的唯一样式入口：业务组件只传 variant/size，避免到处散落重复 className。
export function Button({
  children,
  className = "",
  icon,
  ref,
  size = "md",
  type = "button",
  variant = "secondary",
  ...buttonProps
}: ButtonProps) {
  const sizeClass =
    variant === "icon" || variant === "numberStep"
      ? compactSizeClassMap[size]
      : standardSizeClassMap[size];

  return (
    <button
      ref={ref}
      className={[baseButtonClass, variantClassMap[variant], sizeClass, className]
        .filter(Boolean)
        .join(" ")}
      type={type}
      {...buttonProps}
    >
      {icon}
      {children}
    </button>
  );
}
