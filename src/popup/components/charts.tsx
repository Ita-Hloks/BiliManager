import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import type { DurationPoint, HitRatePoint } from "../types";

function useMountedAnimation() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return mounted;
}

export function DurationBarChart({ data }: { data: DurationPoint[] }) {
  const mounted = useMountedAnimation();
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const elapsedValues = data.map(point => Math.max(0, point.elapsedMs ?? point.minutes * 60000));
  const maxElapsed = Math.max(...elapsedValues, 1);
  const activePoint = activeIndex === null ? null : data[activeIndex];
  const activeElapsed = activeIndex === null ? 0 : elapsedValues[activeIndex];
  const tooltipStyle = {
    "--tooltip-x":
      activeIndex === null || data.length === 0
        ? "50%"
        : `${((activeIndex + 0.5) / data.length) * 100}%`,
  } as CSSProperties;

  return (
    <div className="relative min-w-0 overflow-hidden pb-1 pt-7" style={tooltipStyle}>
      <div
        className={[
          "pointer-events-none absolute top-0 z-10 max-w-[calc(100%-0.75rem)] -translate-x-1/2 truncate whitespace-nowrap rounded border border-sky-300/25 bg-slate-950/95 px-2 py-1 text-[10px] font-medium leading-none text-sky-100 shadow-lg shadow-slate-950/30 transition-[left,opacity]",
          activePoint ? "opacity-100" : "opacity-0",
        ].join(" ")}
        style={{
          left: "clamp(2.75rem, var(--tooltip-x), calc(100% - 2.75rem))",
        }}
      >
        {activePoint ? `${activePoint.label} ${formatDurationDetail(activeElapsed)}` : "0s"}
      </div>

      <div className="flex h-28 min-w-0 items-end justify-between gap-1.5 overflow-hidden">
        {data.map((point, index) => {
          const elapsed = elapsedValues[index];
          const pct = elapsed > 0 ? Math.max((elapsed / maxElapsed) * 90, 3) : 0;
          return (
            <div
              key={point.label}
              className="flex min-w-0 flex-1 flex-col items-center gap-1.5"
              onPointerEnter={() => setActiveIndex(index)}
              onPointerLeave={() => setActiveIndex(null)}
              title={`${point.label} ${formatDurationDetail(elapsed)}`}
            >
              <div className="flex h-20 w-full items-end overflow-hidden rounded-t-sm bg-white/[0.03]">
                <div
                  className="w-full rounded-t-sm bg-gradient-to-t from-sky-500/60 to-sky-300/95 transition-[height] duration-700 ease-out"
                  style={{
                    height: mounted ? `${pct}%` : "0%",
                    transitionDelay: `${index * 45}ms`,
                  }}
                />
              </div>
              <span className="max-w-full truncate text-[9px] leading-none text-slate-500">
                {point.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatDurationDetail(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) return `${hours}h${padTime(minutes)}m${padTime(seconds)}s`;
  if (minutes > 0) return `${minutes}m${padTime(seconds)}s`;
  return `${seconds}s`;
}

export function HitRateLineChart({ data }: { data: HitRatePoint[] }) {
  const mounted = useMountedAnimation();
  const width = Math.max(280, data.length * 20);
  const height = 96;
  const stepX = width / (data.length - 1 || 1);

  const points = data.map((point, index) => ({
    x: index * stepX,
    y: height - (point.rate / 100) * height,
  }));

  const linePath = points
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)},${point.y.toFixed(1)}`)
    .join(" ");
  const areaPath = `${linePath} L${width},${height} L0,${height} Z`;
  const last = points[points.length - 1];

  return (
    <div className="overflow-hidden pb-1">
      <svg className="h-24 w-full overflow-visible" viewBox={`0 0 ${width} ${height}`}>
        <defs>
          <linearGradient id="hitRateFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="rgba(56,189,248,0.35)" />
            <stop offset="100%" stopColor="rgba(56,189,248,0)" />
          </linearGradient>
        </defs>
        <path
          className="transition-opacity duration-700 ease-out"
          d={areaPath}
          fill="url(#hitRateFill)"
          opacity={mounted ? 1 : 0}
        />
        <path
          d={linePath}
          fill="none"
          pathLength={1}
          stroke="rgb(56,189,248)"
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
            fill="#0b1120"
            key={data[index].label}
            opacity={mounted ? 1 : 0}
            r={2.5}
            stroke="rgb(56,189,248)"
            strokeWidth={1.5}
            style={{ transition: `opacity 400ms ease-out ${300 + index * 60}ms` }}
          />
        ))}
        <text
          fill="rgb(125,211,252)"
          fontSize="9"
          opacity={mounted ? 1 : 0}
          style={{ transition: "opacity 400ms ease-out 700ms" }}
          textAnchor="end"
          x={last.x}
          y={Math.max(last.y - 8, 9)}
        >
          {data[data.length - 1].rate}%
        </text>
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-slate-500">
        {data.map(point => (
          <span className="min-w-0 truncate" key={point.label}>
            {point.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function padTime(value: number) {
  return value.toString().padStart(2, "0");
}
