import React, { useEffect, useState } from "react";
import { Clock3, Film } from "lucide-react";
import { PERIOD_LABEL } from "../demoData";
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
  const durationPoints = durationData?.points ?? [];
  const videoCountPoints = videoCountDataByPeriod?.[period] ?? [];
  const totalMinutes = durationPoints.reduce(
    (sum, point) => sum + Math.floor(point.elapsedMs / 60000),
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
          <React.Fragment key="videoCount">
            <VideoCountLineChart data={videoCountPoints} />
            <p className="mt-2.5 text-center text-[11px] text-slate-500 dark:text-slate-400">
              {PERIOD_LABEL[period]}观看视频共{" "}
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
