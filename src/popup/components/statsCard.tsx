import React, { useEffect, useState } from "react";
import { Clock3, Target } from "lucide-react";
import { HIT_RATE_DATA, PERIOD_LABEL } from "../demoData";
import { getWatchDurationData } from "../../shared/watchTimerStats";
import type { DurationPoint, SegmentedOption, StatsMetric, StatsPeriod } from "../types";
import { DurationBarChart, HitRateLineChart } from "./charts";
import { SegmentedControl } from "./segmentedControl";

const METRIC_OPTIONS: SegmentedOption<StatsMetric>[] = [
  { value: "duration", label: "观看时长", icon: Clock3 },
  { value: "hitRate", label: "命中率", icon: Target },
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

export function StatsCard() {
  const [metric, setMetric] = useState<StatsMetric>("duration");
  const [period, setPeriod] = useState<StatsPeriod>("7d");
  const [durationPoints, setDurationPoints] = useState<DurationPoint[]>([]);

  const hitRatePoints = HIT_RATE_DATA[period];
  const totalMinutes = durationPoints.reduce((sum, point) => sum + point.minutes, 0);
  const avgHitRate = Math.round(
    hitRatePoints.reduce((sum, point) => sum + point.rate, 0) / hitRatePoints.length,
  );

  useEffect(() => {
    void getWatchDurationData(period).then(setDurationPoints);
  }, [period]);

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <SegmentedControl onChange={setMetric} options={METRIC_OPTIONS} value={metric} />

      <div className="mt-2.5">
        <SegmentedControl onChange={setPeriod} options={PERIOD_OPTIONS} size="sm" value={period} />
      </div>

      <div className="mt-3.5">
        {metric === "duration" ? (
          <React.Fragment key="duration">
            <DurationBarChart data={durationPoints} key={period} />
            <p className="mt-2.5 text-center text-[11px] text-slate-500">
              {PERIOD_LABEL[period]}观看时长共{" "}
              <span className="font-semibold text-slate-700">{formatMinutes(totalMinutes)}</span>
            </p>
          </React.Fragment>
        ) : (
          <React.Fragment key="hitRate">
            <HitRateLineChart data={hitRatePoints} key={period} />
            <p className="mt-2.5 text-center text-[11px] text-slate-500">
              {PERIOD_LABEL[period]}平均命中率{" "}
              <span className="font-semibold text-bili-blue">{avgHitRate}%</span>
            </p>
          </React.Fragment>
        )}
      </div>
    </section>
  );
}
