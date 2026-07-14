import { Monitor, Moon, Sun } from "lucide-react";
import type { ExtensionSettings } from "../../shared/types";

export function ThemeSwitch(props: {
  value: ExtensionSettings["theme"];
  onChange: (theme: ExtensionSettings["theme"]) => void;
}) {
  const options = [
    { value: "system", label: "系统", icon: Monitor },
    { value: "light", label: "亮色", icon: Sun },
    { value: "dark", label: "暗色", icon: Moon },
  ] as const;

  return (
    <div className="inline-flex rounded-lg bg-slate-100 p-1 transition-colors duration-300 ease-out dark:bg-[#15181e]">
      {options.map(option => {
        const Icon = option.icon;
        const selected = props.value === option.value;

        return (
          <button
            key={option.value}
            className={[
              "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm transition-colors duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bili-blue/40",
              selected
                ? "bg-white text-bili-blue shadow-sm dark:bg-[#2a2e36] dark:text-sky-200"
                : "text-slate-600 hover:bg-white/70 dark:text-slate-300 dark:hover:bg-white/[0.06]",
            ].join(" ")}
            onClick={() => props.onChange(option.value)}
            type="button"
          >
            <Icon className="h-4 w-4" />
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
