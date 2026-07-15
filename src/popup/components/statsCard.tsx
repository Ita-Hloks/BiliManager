import React, { useEffect, useState } from "react";
import { Clock3, Target } from "lucide-react";
import { HIT_RATE_DATA, PERIOD_LABEL } from "../demoData";
import { formatReadableDuration } from "../../shared/duration";
import { getWatchDurationData } from "../../shared/watchTimerStats";
import type {
  DurationComparison,
  SegmentedOption,
  StatsMetric,
  StatsPeriod,
  WatchDurationData,
} from "../types";
import { DurationBarChart, HitRateLineChart } from "./charts";
import { SegmentedControl } from "./segmentedControl";

const METRIC_OPTIONS: SegmentedOption<StatsMetric>[] = [
  { value: "duration", label: "观看时长", icon: Clock3 },
  { value: "hitRate", label: "等待更新", icon: Target, disabled: true },
];

const PERIOD_OPTIONS: SegmentedOption<StatsPeriod>[] = [
  { value: "7d", label: "近7天" },
  { value: "month", label: "本月" },
  { value: "year", label: "本年" },
];

function formatMinutes(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) return `${minutes} 分钟`;
  if (minutes === 0) return `${hours} 小时`;
  return `${hours} 小时 ${minutes} 分钟`;
}

function formatDurationComparison(comparison: DurationComparison): string {
  const elapsedMs = Math.max(0, comparison.elapsedMs);
  const previousElapsedMs = Math.max(0, comparison.previousElapsedMs);
  const deltaMs = elapsedMs - previousElapsedMs;
  if (deltaMs === 0) return `${comparison.label}持平（0%）`;

  const direction = deltaMs > 0 ? "增加" : "减少";
  const duration = formatReadableDuration(Math.abs(deltaMs));
  if (previousElapsedMs === 0) {
    return `${comparison.label}${direction} ${duration}（暂无百分比）`;
  }

  const percent = (Math.abs(deltaMs) / previousElapsedMs) * 100;
  const sign = deltaMs > 0 ? "+" : "-";
  const formattedPercent = percent.toFixed(1).replace(/\.0$/, "");
  return `${comparison.label}${direction} ${duration}（${sign}${formattedPercent}%）`;
}

export function StatsCard() {
  const [metric, setMetric] = useState<StatsMetric>("duration");
  const [period, setPeriod] = useState<StatsPeriod>("7d");
  const [durationResult, setDurationResult] = useState<{
    period: StatsPeriod;
    data: WatchDurationData;
  }>();

  const hitRatePoints = HIT_RATE_DATA[period];
  const durationData = durationResult?.period === period ? durationResult.data : undefined;
  const durationPoints = durationData?.points ?? [];
  const totalMinutes = durationPoints.reduce(
    (sum, point) => sum + Math.floor(point.elapsedMs / 60000),
    0,
  );
  const durationComparison = durationData
    ? formatDurationComparison(durationData.comparison)
    : null;
  const avgHitRate = Math.round(
    hitRatePoints.reduce((sum, point) => sum + point.rate, 0) / hitRatePoints.length,
  );

  useEffect(() => {
    let active = true;
    void getWatchDurationData(period).then(data => {
      if (active) setDurationResult({ period, data });
    });
    return () => {
      active = false;
    };
  }, [period]);

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-colors duration-300 dark:border-[#30343c] dark:bg-[#1c1f26] dark:shadow-none">
      <SegmentedControl onChange={setMetric} options={METRIC_OPTIONS} value={metric} />

      <div className="mt-2.5">
        <SegmentedControl onChange={setPeriod} options={PERIOD_OPTIONS} size="sm" value={period} />
      </div>

      <div className="mt-3.5">
        {metric === "duration" ? (
          <React.Fragment key="duration">
            <DurationBarChart data={durationPoints} key={period} />
            <p className="mt-2.5 text-center text-[11px] text-slate-500 dark:text-slate-400">
              {PERIOD_LABEL[period]}观看时长共{" "}
              <span className="font-semibold text-slate-700 dark:text-slate-200">
                {formatMinutes(totalMinutes)}
              </span>
            </p>
            {durationComparison && (
              <p className="mt-1 text-center text-[10px] text-slate-400 dark:text-slate-500">
                {durationComparison}
              </p>
            )}
          </React.Fragment>
        ) : (
          <React.Fragment key="hitRate">
            <HitRateLineChart data={hitRatePoints} key={period} />
            <p className="mt-2.5 text-center text-[11px] text-slate-500 dark:text-slate-400">
              {PERIOD_LABEL[period]}平均命中率{" "}
              <span className="font-semibold text-bili-blue dark:text-sky-200">{avgHitRate}%</span>
            </p>
          </React.Fragment>
        )}
      </div>
    </section>
  );
}
