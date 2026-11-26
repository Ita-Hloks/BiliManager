import type { ReactNode } from "react";
import { Switch } from "./switch";

export type SettingSectionProps = {
  id: string;
  icon: ReactNode;
  title: string;
  description?: string;
  headerAction?: ReactNode;
  disabled?: boolean;
  clipContent?: boolean;
  children: ReactNode;
};

/**
 * 设置页分区外壳：外置分区标题与操作区，内部用圆角卡片承载分割线列表。
 */
export function SettingSection({
  id,
  icon,
  title,
  description,
  headerAction,
  disabled,
  clipContent = false,
  children,
}: SettingSectionProps) {
  const cardClassName = [
    "rounded-2xl border border-[var(--bm-border)] bg-[var(--bm-surface)] shadow-[0_1px_2px_rgb(15_23_42/0.04)] dark:shadow-none",
    clipContent ? "overflow-hidden" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <section id={id} className="scroll-mt-20">
      <div className="mb-3 flex items-center justify-between gap-4 px-1">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[var(--bm-border)] bg-[var(--bm-surface)] text-[var(--bm-accent)]">
            {icon}
          </span>
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold tracking-tight text-[var(--bm-text-primary)]">
              {title}
            </h2>
            {description && (
              <p className="mt-0.5 text-xs leading-relaxed text-[var(--bm-text-secondary)]">
                {description}
              </p>
            )}
          </div>
        </div>
        {headerAction && <div className="shrink-0">{headerAction}</div>}
      </div>

      <div className={cardClassName}>
        {disabled !== undefined ? (
          <fieldset
            className="m-0 min-w-0 divide-y divide-[var(--bm-divider)] border-0 p-0 transition-opacity duration-200 disabled:opacity-45"
            disabled={disabled}
          >
            {children}
          </fieldset>
        ) : (
          <div className="divide-y divide-[var(--bm-divider)]">{children}</div>
        )}
      </div>
    </section>
  );
}

export type SettingRowProps = {
  title: string;
  description?: string;
  control?: ReactNode;
  children?: ReactNode;
  subItem?: boolean;
  className?: string;
};

/**
 * 通用设置行：支持右侧控件、下方扩展内容区以及子级缩进引导线。
 */
export function SettingRow({
  title,
  description,
  control,
  children,
  subItem = false,
  className = "",
}: SettingRowProps) {
  return (
    <div
      className={[
        "first:rounded-t-2xl last:rounded-b-2xl",
        subItem ? "relative bg-[var(--bm-surface-subtle)] py-3.5 pl-9 pr-5" : "px-5 py-4",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {subItem && (
        <span
          aria-hidden="true"
          className="absolute bottom-3 left-5 top-3 w-0.5 rounded-full bg-[var(--bm-border-strong)]"
        />
      )}

      {control ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="text-sm font-medium text-[var(--bm-text-primary)]">{title}</div>
            {description && (
              <p className="mt-0.5 text-xs leading-relaxed text-[var(--bm-text-secondary)]">
                {description}
              </p>
            )}
          </div>
          <div className="shrink-0">{control}</div>
        </div>
      ) : (
        <div className="min-w-0">
          <div className="text-sm font-medium text-[var(--bm-text-primary)]">{title}</div>
          {description && (
            <p className="mt-0.5 text-xs leading-relaxed text-[var(--bm-text-secondary)]">
              {description}
            </p>
          )}
        </div>
      )}

      {children && <div className={control ? "mt-3.5" : "mt-3"}>{children}</div>}
    </div>
  );
}

/**
 * 独立开关按钮：用于需要把 switch 单独放在自定义布局右侧的场景。
 */
export function SwitchButton(props: {
  checked: boolean;
  disabled?: boolean;
  ariaLabel: string;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      aria-checked={props.checked}
      aria-label={props.ariaLabel}
      className="inline-flex shrink-0 items-center justify-center rounded-full p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bili-blue/40 disabled:cursor-not-allowed"
      disabled={props.disabled}
      role="switch"
      type="button"
      onClick={() => props.onChange(!props.checked)}
    >
      <Switch disabled={props.disabled} enabled={props.checked} />
    </button>
  );
}

export type SettingToggleRowProps = {
  title: string;
  description?: string;
  checked: boolean;
  disabled?: boolean;
  subItem?: boolean;
  onChange: (next: boolean) => void;
};

/**
 * 整行可点击的开关设置项，内置 switch 语义与键盘焦点高亮。
 */
export function SettingToggleRow({
  title,
  description,
  checked,
  disabled = false,
  subItem = false,
  onChange,
}: SettingToggleRowProps) {
  return (
    <button
      aria-checked={checked}
      className={[
        "flex w-full items-center justify-between gap-4 text-left transition-colors duration-200 ease-out",
        "first:rounded-t-2xl last:rounded-b-2xl",
        "hover:bg-[var(--bm-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-bili-blue/40",
        "disabled:cursor-not-allowed disabled:hover:bg-transparent",
        subItem ? "relative bg-[var(--bm-surface-subtle)] py-3.5 pl-9 pr-5" : "px-5 py-4",
      ].join(" ")}
      disabled={disabled}
      role="switch"
      type="button"
      onClick={() => onChange(!checked)}
    >
      {subItem && (
        <span
          aria-hidden="true"
          className="absolute bottom-3 left-5 top-3 w-0.5 rounded-full bg-[var(--bm-border-strong)]"
        />
      )}
      <span className="min-w-0">
        <span className="block text-sm font-medium text-[var(--bm-text-primary)]">{title}</span>
        {description && (
          <span className="mt-0.5 block text-xs leading-relaxed text-[var(--bm-text-secondary)]">
            {description}
          </span>
        )}
      </span>
      <Switch disabled={disabled} enabled={checked} />
    </button>
  );
}

export type SettingNoticeProps = {
  tone?: "info" | "warning" | "error";
  children: ReactNode;
  action?: ReactNode;
  className?: string;
};

const noticeToneClassMap: Record<NonNullable<SettingNoticeProps["tone"]>, string> = {
  info: "bm-notice",
  warning: "bm-notice-warning",
  error: "bm-notice-error",
};

/**
 * 卡片内提示条，支持 info / warning / error 语义与右侧操作按钮。
 */
export function SettingNotice({
  tone = "info",
  children,
  action,
  className = "",
}: SettingNoticeProps) {
  return (
    <div
      className={[
        noticeToneClassMap[tone],
        action ? "flex flex-wrap items-center justify-between gap-3" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {action ? (
        <>
          <div className="min-w-0 flex-1">{children}</div>
          <div className="shrink-0">{action}</div>
        </>
      ) : (
        children
      )}
    </div>
  );
}
