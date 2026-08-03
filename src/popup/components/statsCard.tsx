import React, { useEffect, useState } from "react";
import { Clock3, Film } from "lucide-react";
import { formatReadableDuration } from "../../shared/duration";
import {
  getWatchDurationDataByPeriod,
  getWatchVideoCountDataByPeriod,
} from "../../shared/watchTimerStats";
import type {
  DurationComparison,
  SegmentedOption,
  StatsMetric,
  StatsPeriod,
  VideoCountPoint,
  WatchDurationData,
} from "../types";
import { DurationBarChart, VideoCountLineChart } from "./charts";
import { SegmentedControl } from "./segmentedControl";

const METRIC_OPTIONS: SegmentedOption<StatsMetric>[] = [
  { value: "duration", label: "观看时长", icon: Clock3 },
  { value: "videoCount", label: "观看数量", icon: Film },
];

const PERIOD_OPTIONS: SegmentedOption<StatsPeriod>[] = [
  { value: "7d", label: "近7天" },
  { value: "month", label: "本月" },
  { value: "year", label: "本年" },
];

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

export function StatsCard({
  onDateSelect,
  selectedDateKey,
}: {
  onDateSelect: (dateKey: string) => void;
  selectedDateKey?: string;
}) {
  const [metric, setMetric] = useState<StatsMetric>("duration");
  const [period, setPeriod] = useState<StatsPeriod>("7d");
  const [durationDataByPeriod, setDurationDataByPeriod] =
    useState<Record<StatsPeriod, WatchDurationData>>();
  const [videoCountDataByPeriod, setVideoCountDataByPeriod] =
    useState<Record<StatsPeriod, VideoCountPoint[]>>();

  const durationData = durationDataByPeriod?.[period];
  const periodLabel = PERIOD_OPTIONS.find(option => option.value === period)?.label ?? "";
  const durationPoints = durationData?.points ?? [];
  const videoCountPoints = videoCountDataByPeriod?.[period] ?? [];
  const totalElapsedMs = durationPoints.reduce((sum, point) => sum + point.elapsedMs, 0);
  const backgroundElapsedMs = durationPoints.reduce(
    (sum, point) => sum + point.backgroundElapsedMs,
    0,
  );
  const foregroundElapsedMs = durationPoints.reduce(
    (sum, point) => sum + point.foregroundElapsedMs,
    0,
  );
  const totalVideoCount = videoCountPoints.reduce((sum, point) => sum + point.count, 0);
  const durationComparison = durationData
    ? formatDurationComparison(durationData.comparison)
    : null;

  useEffect(() => {
    let active = true;
    void Promise.all([getWatchDurationDataByPeriod(), getWatchVideoCountDataByPeriod()]).then(
      ([durationData, videoCountData]) => {
        if (!active) return;
        setDurationDataByPeriod(durationData);
        setVideoCountDataByPeriod(videoCountData);
      },
    );
    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-colors duration-300 dark:border-[#30343c] dark:bg-[#1c1f26] dark:shadow-none">
      <SegmentedControl onChange={setMetric} options={METRIC_OPTIONS} value={metric} />

      <div className="mt-2.5">
        <SegmentedControl onChange={setPeriod} options={PERIOD_OPTIONS} size="sm" value={period} />
      </div>

      <div className="mt-3.5">
        {metric === "duration" ? (
          <React.Fragment key="duration">
            <DurationBarChart
              data={durationPoints}
              onSelect={period === "7d" ? onDateSelect : undefined}
              selectedDateKey={selectedDateKey}
            />
            <p className="mt-2.5 text-center text-[11px] text-slate-500 dark:text-slate-400">
              {periodLabel}观看时长
            </p>
            <div className="mt-1 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] tabular-nums">
              <span className="font-semibold text-slate-700 dark:text-slate-200">
                总计 {formatReadableDuration(totalElapsedMs)}
              </span>
              <span className="font-semibold text-bili-blue dark:text-sky-200">
                前台 {formatReadableDuration(foregroundElapsedMs)}
              </span>
              <span className="font-semibold text-amber-500 dark:text-amber-300">
                后台 {formatReadableDuration(backgroundElapsedMs)}
              </span>
            </div>
            {durationComparison && (
              <p className="mt-1 text-center text-[10px] text-slate-400 dark:text-slate-500">
                {durationComparison}
              </p>
            )}
          </React.Fragment>
        ) : (
          <React.Fragment key="videoCount">
            <VideoCountLineChart data={videoCountPoints} />
            <p className="mt-2.5 text-center text-[11px] text-slate-500 dark:text-slate-400">
              {periodLabel}观看视频共{" "}
              <span className="font-semibold text-emerald-600 dark:text-emerald-300">
                {totalVideoCount} 个
              </span>
            </p>
          </React.Fragment>
        )}
      </div>
    </section>
  );
}
