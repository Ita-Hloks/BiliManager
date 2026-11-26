import { Monitor, Moon, Sun } from "lucide-react";
import type { ExtensionSettings } from "../../shared/types";

export function ThemeSwitch(props: {
  value: ExtensionSettings["theme"];
  onChange: (theme: ExtensionSettings["theme"]) => void;
}) {
  const options = [
    { value: "system", label: "跟随系统", icon: Monitor },
    { value: "light", label: "浅色", icon: Sun },
    { value: "dark", label: "深色", icon: Moon },
  ] as const;

  return (
    <div
      aria-label="外观主题"
      className="inline-flex h-9 items-center rounded-lg border border-[var(--bm-border)] bg-[var(--bm-input-bg)] p-0.5 transition-colors duration-200 ease-out"
      role="radiogroup"
    >
      {options.map(option => {
        const Icon = option.icon;
        const selected = props.value === option.value;

        return (
          <button
            key={option.value}
            aria-checked={selected}
            className={[
              "inline-flex h-full items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bili-blue/40 sm:text-[13px]",
              selected
                ? "bg-[var(--bm-surface)] text-[var(--bm-text-primary)] shadow-sm"
                : "text-[var(--bm-text-secondary)] hover:text-[var(--bm-text-primary)]",
            ].join(" ")}
            role="radio"
            type="button"
            onClick={() => props.onChange(option.value)}
          >
            <Icon className="h-4 w-4" />
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
