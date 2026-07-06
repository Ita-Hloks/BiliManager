import { Monitor, Moon, Sun } from "lucide-react";
import type { ExtensionSettings } from "../../shared/types";

export function ThemeSwitch(props: {
  value: ExtensionSettings["theme"];
  isDark: boolean;
  onChange: (theme: ExtensionSettings["theme"]) => void;
}) {
  const options = [
    { value: "system", label: "系统", icon: Monitor },
    { value: "light", label: "亮色", icon: Sun },
    { value: "dark", label: "暗色", icon: Moon },
  ] as const;

  return (
    <div
      className={[
        "inline-flex rounded-md border p-1 shadow-sm backdrop-blur transition-colors duration-300 ease-out",
        props.isDark ? "border-white/10 bg-slate-950/35" : "border-white/70 bg-white/55",
      ].join(" ")}
    >
      {options.map(option => {
        const Icon = option.icon;
        const selected = props.value === option.value;

        return (
          <button
            key={option.value}
            className={[
              "inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-sm transition-colors duration-300 ease-out",
              selected
                ? props.isDark
                  ? "bg-sky-400 text-slate-950"
                  : "bg-sky-500 text-white"
                : props.isDark
                  ? "text-slate-300 hover:bg-white/10"
                  : "text-slate-600 hover:bg-white/75",
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
