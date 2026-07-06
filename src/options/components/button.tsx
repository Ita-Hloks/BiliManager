import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant =
  "primary" | "secondary" | "icon" | "numberStep" | "toggleRow" | "toggleGroupRow";

type ButtonSize = "sm" | "md" | "full";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean;
  icon?: ReactNode;
  size?: ButtonSize;
  variant?: ButtonVariant;
};

const baseButtonClass =
  "inline-flex items-center justify-center transition-colors duration-300 ease-out disabled:cursor-not-allowed";

const variantClassMap: Record<ButtonVariant, string> = {
  primary:
    "gap-1.5 rounded-md border border-sky-200 bg-sky-500 text-sm font-medium text-white shadow-sm hover:bg-sky-600 disabled:border-slate-200 disabled:bg-slate-200 disabled:text-slate-500 dark:border-sky-300/30 dark:bg-sky-400 dark:text-slate-950 dark:hover:bg-sky-300 dark:disabled:border-white/10 dark:disabled:bg-slate-700 dark:disabled:text-slate-400",
  secondary:
    "gap-1.5 rounded-md border border-slate-200 bg-white/70 text-sm text-slate-700 shadow-sm hover:bg-sky-50 disabled:opacity-50 dark:border-white/10 dark:bg-white/10 dark:text-slate-100 dark:hover:bg-sky-300/10",
  icon: "rounded text-slate-400 hover:text-rose-500 dark:text-slate-500 dark:hover:text-rose-300",
  numberStep:
    "flex-1 text-slate-500 hover:bg-sky-50 hover:text-sky-600 dark:text-slate-400 dark:hover:bg-sky-300/10 dark:hover:text-sky-200",
  toggleRow:
    "w-full justify-between gap-4 rounded-md border border-slate-200 bg-white/65 px-3 py-3 text-left text-sm text-slate-800 shadow-sm hover:bg-white/85 dark:border-white/10 dark:bg-white/10 dark:text-slate-100 dark:hover:bg-white/15",
  toggleGroupRow:
    "w-full justify-between gap-4 px-3 py-3 text-left text-sm text-slate-800 hover:bg-white/85 dark:text-slate-100 dark:hover:bg-white/[0.05]",
};

const sizeClassMap: Record<ButtonSize, string> = {
  sm: "px-2 py-1",
  md: "px-3 py-2",
  full: "w-full px-3 py-2 sm:w-auto",
};

const activeClassMap: Partial<Record<ButtonVariant, string>> = {
  toggleGroupRow:
    "bg-slate-100/55 text-slate-500 hover:bg-slate-100/55 dark:bg-white/[0.03] dark:text-slate-500 dark:opacity-75 dark:hover:bg-white/[0.03]",
};

// 设置页按钮的唯一样式入口：业务组件只传 variant/size/active，避免到处散落不可读 className。
export function Button({
  active = false,
  children,
  className = "",
  icon,
  size = "md",
  type = "button",
  variant = "secondary",
  ...buttonProps
}: ButtonProps) {
  return (
    <button
      className={[
        baseButtonClass,
        variantClassMap[variant],
        sizeClassMap[size],
        active ? (activeClassMap[variant] ?? "") : "",
        className,
      ]
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
