import type { SegmentedOption } from "../types";

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  size = "md",
}: {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: "sm" | "md";
}) {
  return (
    <div className="flex gap-1 rounded-lg bg-slate-100 p-1 transition-colors duration-300 dark:bg-[#15181e]">
      {options.map(option => {
        const Icon = option.icon;
        const active = option.value === value;
        return (
          <button
            key={option.value}
            aria-pressed={active}
            className={[
              "flex flex-1 items-center justify-center gap-1.5 rounded-md font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bili-blue/40",
              size === "sm" ? "px-2 py-1 text-[11px]" : "px-2.5 py-1.5 text-xs",
              active
                ? "bg-white text-bili-blue shadow-sm dark:bg-[#2a2e36] dark:text-sky-200 dark:shadow-none"
                : "text-slate-500 hover:bg-white/70 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-white/[0.06] dark:hover:text-slate-200",
            ].join(" ")}
            onClick={() => onChange(option.value)}
            type="button"
          >
            {Icon && <Icon className={size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"} />}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
