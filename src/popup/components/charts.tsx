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
  const max = Math.max(...data.map(point => point.minutes), 1);
  const minWidth = Math.max(280, data.length * 20);

  return (
    <div className="overflow-x-auto pb-1">
      <div className="flex h-28 items-end justify-between gap-1.5" style={{ minWidth }}>
        {data.map((point, index) => {
          const pct = (point.minutes / max) * 100;
          return (
            <div className="flex flex-1 flex-col items-center gap-1.5" key={point.label}>
              <div className="flex h-20 w-full items-end overflow-hidden rounded-t-sm bg-white/[0.03]">
                <div
                  className="w-full rounded-t-sm bg-gradient-to-t from-sky-500/60 to-sky-300/95 transition-[height] duration-700 ease-out"
                  style={{
                    height: mounted ? `${pct}%` : "0%",
                    transitionDelay: `${index * 45}ms`,
                  }}
                />
              </div>
              <span className="whitespace-nowrap text-[9px] leading-none text-slate-500">
                {point.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
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
    <div className="overflow-x-auto pb-1">
      <svg
        className="h-24 w-full overflow-visible"
        style={{ minWidth: width }}
        viewBox={`0 0 ${width} ${height}`}
      >
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
      <div
        className="mt-1 flex justify-between text-[10px] text-slate-500"
        style={{ minWidth: width }}
      >
        {data.map(point => (
          <span className="whitespace-nowrap" key={point.label}>
            {point.label}
          </span>
        ))}
      </div>
    </div>
  );
}
