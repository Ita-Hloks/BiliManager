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
    <div className="flex gap-1 rounded-lg border border-white/10 bg-slate-950/40 p-1">
      {options.map(option => {
        const Icon = option.icon;
        const active = option.value === value;
        return (
          <button
            key={option.value}
            aria-pressed={active}
            className={[
              "flex flex-1 items-center justify-center gap-1.5 rounded-md font-medium transition-all duration-300 ease-out",
              size === "sm" ? "px-2 py-1 text-[11px]" : "px-2.5 py-1.5 text-xs",
              active
                ? "bg-sky-400/90 text-slate-950 shadow-[0_4px_16px_rgba(56,189,248,0.35)]"
                : "text-slate-400 hover:text-slate-200",
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
