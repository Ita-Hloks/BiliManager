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
  "inline-flex items-center justify-center transition-colors duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bili-blue/40 disabled:cursor-not-allowed";

const variantClassMap: Record<ButtonVariant, string> = {
  primary:
    "gap-1.5 rounded-lg bg-bili-blue text-sm font-medium text-white hover:bg-[#009bd3] disabled:bg-slate-200 disabled:text-slate-500 dark:disabled:bg-slate-700 dark:disabled:text-slate-400",
  secondary:
    "gap-1.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 hover:border-sky-200 hover:bg-sky-50 hover:text-bili-blue disabled:opacity-50 dark:border-[#3a3e47] dark:bg-[#242830] dark:text-slate-100 dark:hover:border-bili-blue/40 dark:hover:bg-bili-blue/10",
  icon: "rounded text-slate-400 hover:text-rose-500 dark:text-slate-500 dark:hover:text-rose-300",
  numberStep:
    "flex-1 text-slate-500 hover:bg-sky-50 hover:text-bili-blue dark:text-slate-400 dark:hover:bg-bili-blue/10 dark:hover:text-sky-200",
  toggleRow:
    "w-full justify-between gap-4 rounded-lg bg-bili-canvas px-3 py-3 text-left text-sm text-slate-800 hover:bg-sky-50 dark:bg-[#15181e] dark:text-slate-100 dark:hover:bg-bili-blue/10",
  toggleGroupRow:
    "w-full justify-between gap-4 px-3 py-3 text-left text-sm text-slate-800 hover:bg-sky-50 dark:text-slate-100 dark:hover:bg-bili-blue/10",
};

const sizeClassMap: Record<ButtonSize, string> = {
  sm: "px-2 py-1",
  md: "px-3 py-2",
  full: "w-full px-3 py-2 sm:w-auto",
};

const activeClassMap: Partial<Record<ButtonVariant, string>> = {
  toggleRow:
    "bg-slate-100 text-slate-500 hover:bg-slate-100 dark:bg-white/[0.03] dark:text-slate-500 dark:opacity-75 dark:hover:bg-white/[0.03]",
  toggleGroupRow:
    "bg-slate-100 text-slate-500 hover:bg-slate-100 dark:bg-white/[0.03] dark:text-slate-500 dark:opacity-75 dark:hover:bg-white/[0.03]",
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
