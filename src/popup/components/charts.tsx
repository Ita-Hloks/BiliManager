import { useEffect, useState } from "react";
import { Headphones, Layers3, Monitor } from "lucide-react";
import { formatCompactDuration } from "../../shared/duration";
import type { DurationDisplayMode, DurationPoint, VideoCountPoint } from "../types";

const DURATION_DISPLAY_MODES: Array<{
  value: DurationDisplayMode;
  label: string;
  Icon: typeof Layers3;
}> = [
  { value: "total", label: "总计", Icon: Layers3 },
  { value: "foreground", label: "前台", Icon: Monitor },
  { value: "background", label: "后台", Icon: Headphones },
];

function useMountedAnimation() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return mounted;
}

export function DurationBarChart({
  data,
  onSelect,
  selectedDateKey,
  displayMode,
  onDisplayModeChange,
}: {
  data: DurationPoint[];
  onSelect?: (dateKey: string) => void;
  selectedDateKey?: string;
  displayMode: DurationDisplayMode;
  onDisplayModeChange: (mode: DurationDisplayMode) => void;
}) {
  const mounted = useMountedAnimation();
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [tooltipX, setTooltipX] = useState(0);
  const elapsedValues = data.map(point => Math.max(0, point.elapsedMs));
  const foregroundValues = data.map(point =>
    Math.min(Math.max(0, point.foregroundElapsedMs), Math.max(0, point.elapsedMs)),
  );
  const backgroundValues = data.map((point, index) =>
    Math.min(
      Math.max(0, point.backgroundElapsedMs),
      Math.max(0, elapsedValues[index] - foregroundValues[index]),
    ),
  );
  const displayValues =
    displayMode === "foreground"
      ? foregroundValues
      : displayMode === "background"
        ? backgroundValues
        : elapsedValues;
  const maxDisplayValue = Math.max(...displayValues, 1);
  const displayModeLabel =
    DURATION_DISPLAY_MODES.find(mode => mode.value === displayMode)?.label ?? "总计";
  const activeDisplayValue = activeIndex === null ? 0 : displayValues[activeIndex];

  return (
    <div className="min-w-0">
      <div className="mb-1 flex min-h-7 items-center justify-between gap-2">
        <span
          className={[
            "min-w-0 truncate text-[10px] font-medium",
            displayMode === "background"
              ? "text-amber-600 dark:text-amber-300"
              : "text-slate-500 dark:text-slate-400",
          ].join(" ")}
        >
          {displayModeLabel}
        </span>
        <div className="inline-flex rounded-lg bg-slate-100 p-0.5 dark:bg-[#15181e]">
          {DURATION_DISPLAY_MODES.map(({ value, label, Icon }) => {
            const active = value === displayMode;
            return (
              <button
                aria-label={`切换到${label}视图`}
                aria-pressed={active}
                className={[
                  "inline-flex h-6 w-7 items-center justify-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bili-blue/40",
                  active
                    ? value === "background"
                      ? "bg-amber-100 text-amber-600 dark:bg-amber-400/15 dark:text-amber-300"
                      : "bg-sky-100 text-bili-blue dark:bg-sky-400/15 dark:text-sky-200"
                    : "text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-white/[0.06] dark:hover:text-slate-300",
                ].join(" ")}
                key={value}
                onClick={() => {
                  onDisplayModeChange(value);
                  setActiveIndex(null);
                }}
                title={`切换到${label}视图`}
                type="button"
              >
                <Icon className="h-3.5 w-3.5" />
              </button>
            );
          })}
        </div>
      </div>

      <div className="relative min-w-0 overflow-hidden pb-1 pt-5">
        {activeIndex !== null && (
          <span
            className={[
              "pointer-events-none absolute top-0 z-30 max-w-[10rem] truncate whitespace-nowrap text-[10px] font-medium leading-none tabular-nums",
              displayMode === "background"
                ? "text-amber-600 dark:text-amber-300"
                : "text-bili-blue dark:text-sky-200",
              activeIndex === 0
                ? "left-0"
                : activeIndex === data.length - 1
                  ? "right-0"
                  : "-translate-x-1/2",
            ].join(" ")}
            style={
              activeIndex > 0 && activeIndex < data.length - 1
                ? { left: `${tooltipX}px` }
                : undefined
            }
          >
            {displayModeLabel} {formatCompactDuration(activeDisplayValue)}
          </span>
        )}

        <div
          className="flex h-24 min-w-0 items-end justify-between gap-1.5 overflow-hidden"
          onPointerLeave={() => setActiveIndex(null)}
        >
          {data.map((point, index) => {
            const elapsed = elapsedValues[index];
            const displayValue = displayValues[index];
            const segmentTotal =
              displayMode === "total" ? Math.max(elapsed, 1) : Math.max(displayValue, 1);
            const pct = displayValue > 0 ? Math.max((displayValue / maxDisplayValue) * 90, 3) : 0;
            const selectable = !!point.dateKey && !!onSelect;
            const selected = point.dateKey === selectedDateKey;
            return (
              <button
                aria-label={selectable ? `查看${point.dateKey}观看排行` : undefined}
                aria-disabled={!selectable}
                aria-pressed={selectable ? selected : undefined}
                className={[
                  "flex min-w-0 flex-1 flex-col items-center gap-1.5 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bili-blue/40",
                  selectable ? "cursor-pointer" : "cursor-default",
                ].join(" ")}
                key={point.dateKey ?? point.label}
                onClick={() => point.dateKey && onSelect?.(point.dateKey)}
                onPointerEnter={event => {
                  setActiveIndex(index);
                  setTooltipX(event.currentTarget.offsetLeft + event.currentTarget.offsetWidth / 2);
                }}
                tabIndex={selectable ? 0 : -1}
                type="button"
              >
                <div className="flex h-20 w-full items-end overflow-hidden rounded-t-sm bg-sky-50 dark:bg-slate-700/60">
                  <div
                    className={[
                      "flex w-full flex-col overflow-hidden rounded-t-sm transition-[height,opacity] duration-700 ease-out",
                      selected ? "opacity-100" : "opacity-75",
                    ].join(" ")}
                    style={{
                      height: mounted ? `${pct}%` : "0%",
                      transitionDelay: `${index * 45}ms`,
                    }}
                  >
                    {displayMode !== "foreground" && backgroundValues[index] > 0 && (
                      <span
                        className="w-full bg-amber-400"
                        style={{
                          height: `${(backgroundValues[index] / segmentTotal) * 100}%`,
                        }}
                        aria-label={`后台 ${formatCompactDuration(backgroundValues[index])}`}
                      />
                    )}
                    {displayMode !== "background" && foregroundValues[index] > 0 && (
                      <span
                        className="w-full bg-bili-blue"
                        style={{
                          height: `${(foregroundValues[index] / segmentTotal) * 100}%`,
                        }}
                        aria-label={`前台 ${formatCompactDuration(foregroundValues[index])}`}
                      />
                    )}
                  </div>
                </div>
                <span className="whitespace-nowrap text-[10px] leading-none text-slate-500 dark:text-slate-300">
                  {point.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function VideoCountLineChart({ data }: { data: VideoCountPoint[] }) {
  const mounted = useMountedAnimation();
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  if (data.length === 0) return <div className="h-28" />;

  const width = Math.max(280, data.length * 20);
  const height = 96;
  const plotPadding = 8;
  const plotWidth = width - plotPadding * 2;
  const plotHeight = height - plotPadding * 2;
  const stepX = plotWidth / (data.length - 1 || 1);
  const maxCount = Math.max(...data.map(point => point.count), 1);

  const points = data.map((point, index) => ({
    x: plotPadding + index * stepX,
    y: plotPadding + (1 - point.count / maxCount) * plotHeight,
  }));

  const linePath = points
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)},${point.y.toFixed(1)}`)
    .join(" ");
  const areaPath = `${linePath} L${points[points.length - 1].x.toFixed(1)},${height - plotPadding} L${points[0].x.toFixed(1)},${height - plotPadding} Z`;
  const activePoint = activeIndex === null ? undefined : points[activeIndex];

  return (
    <div className="relative min-w-0 overflow-hidden pb-1 pt-6">
      {activeIndex !== null && activePoint && (
        <span
          className={[
            "pointer-events-none absolute z-30 whitespace-nowrap text-[10px] font-medium tabular-nums text-emerald-600 dark:text-emerald-300",
            activeIndex === 0
              ? "left-0"
              : activeIndex === data.length - 1
                ? "right-0"
                : "-translate-x-1/2",
          ].join(" ")}
          style={{
            left:
              activeIndex > 0 && activeIndex < data.length - 1
                ? `${(activePoint.x / width) * 100}%`
                : undefined,
            top: `${Math.max(0, 24 + activePoint.y - 14)}px`,
          }}
        >
          {data[activeIndex].count} 个
        </span>
      )}

      <svg
        className="h-24 w-full"
        onPointerLeave={() => setActiveIndex(null)}
        onPointerMove={event => {
          const bounds = event.currentTarget.getBoundingClientRect();
          const pointerX = ((event.clientX - bounds.left) / bounds.width) * width;
          const nearestIndex = points.reduce(
            (nearest, point, index) =>
              Math.abs(point.x - pointerX) < Math.abs(points[nearest].x - pointerX)
                ? index
                : nearest,
            0,
          );
          setActiveIndex(nearestIndex);
        }}
        viewBox={`0 0 ${width} ${height}`}
      >
        <defs>
          <linearGradient id="videoCountFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="rgba(16,185,129,0.24)" />
            <stop offset="100%" stopColor="rgba(16,185,129,0)" />
          </linearGradient>
        </defs>
        <path
          className="transition-opacity duration-700 ease-out"
          d={areaPath}
          fill="url(#videoCountFill)"
          opacity={mounted ? 1 : 0}
        />
        <path
          d={linePath}
          fill="none"
          pathLength={1}
          stroke="rgb(16,185,129)"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          style={{
            strokeDasharray: 1,
            strokeDashoffset: mounted ? 0 : 1,
            transition: "stroke-dashoffset 900ms ease-out",
          }}
        />
        {points.map((point, index) => (
          <circle
            cx={point.x}
            cy={point.y}
            className="fill-white dark:fill-[#1c1f26]"
            key={data[index].label}
            opacity={mounted ? 1 : 0}
            pointerEvents="none"
            r={activeIndex === index ? 4 : 2.5}
            stroke="rgb(16,185,129)"
            strokeWidth={1.5}
            style={{
              transition: `opacity 400ms ease-out ${300 + index * 60}ms, r 150ms ease-out`,
            }}
          />
        ))}
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-slate-500 dark:text-slate-300">
        {data.map(point => (
          <span className="shrink-0 whitespace-nowrap" key={point.label}>
            {point.label}
          </span>
        ))}
      </div>
    </div>
  );
}
