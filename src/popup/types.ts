import type React from "react";

export type StatsMetric = "duration" | "hitRate";
export type StatsPeriod = "7d" | "month" | "year";

export interface DurationPoint {
  label: string;
  elapsedMs: number;
}

export interface DurationComparison {
  label: string;
  elapsedMs: number;
  previousElapsedMs: number;
}

export interface WatchDurationData {
  points: DurationPoint[];
  comparison: DurationComparison;
}

export interface HitRatePoint {
  label: string;
  rate: number;
}

export interface RecentVideo {
  id: string;
  title: string;
  matched: boolean;
  keyword?: string;
}

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  disabled?: boolean;
}
