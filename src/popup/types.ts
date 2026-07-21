import type React from "react";

export type StatsMetric = "duration" | "videoCount";
export type StatsPeriod = "7d" | "month" | "year";

export interface DurationPoint {
  label: string;
  elapsedMs: number;
  dateKey?: string;
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

export interface VideoCountPoint {
  label: string;
  count: number;
}

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  disabled?: boolean;
}
