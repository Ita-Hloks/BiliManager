import type { DurationPoint, StatsPeriod } from "../popup/types";
import { getWatchTimerHistory } from "./watchTimerHistory";
import type { WatchTimerHistory } from "./watchTimerHistory";

const WEEKDAY_LABELS = ["日", "一", "二", "三", "四", "五", "六"];

export async function getWatchDurationData(period: StatsPeriod): Promise<DurationPoint[]> {
  const history = await getWatchTimerHistory();
  const todayKey = getLocalDateKey(new Date());
  return buildDurationPoints(history, period, todayKey);
}

function buildDurationPoints(
  history: WatchTimerHistory,
  period: StatsPeriod,
  todayKey: string,
): DurationPoint[] {
  if (period === "7d") return buildLastSevenDays(history, todayKey);
  if (period === "month") return buildCurrentMonthWeeks(history, todayKey);
  return buildCurrentYearMonths(history, todayKey);
}

function buildLastSevenDays(history: WatchTimerHistory, todayKey: string): DurationPoint[] {
  const today = parseLocalDateKey(todayKey);
  return Array.from({ length: 7 }, (_, index) => {
    const date = addDays(today, index - 6);
    const dateKey = getLocalDateKey(date);
    return {
      label: WEEKDAY_LABELS[date.getDay()],
      elapsedMs: history[dateKey] ?? 0,
      minutes: msToMinutes(history[dateKey] ?? 0),
    };
  });
}

function buildCurrentMonthWeeks(history: WatchTimerHistory, todayKey: string): DurationPoint[] {
  const today = parseLocalDateKey(todayKey);
  const year = today.getFullYear();
  const month = today.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const weekCount = Math.ceil(daysInMonth / 7);
  const currentWeekIndex = Math.floor((today.getDate() - 1) / 7);

  const points = Array.from({ length: weekCount }, (_, index) => {
    const startDay = index * 7 + 1;
    const endDay = Math.min(startDay + 6, daysInMonth);
    let totalMs = 0;

    for (let day = startDay; day <= endDay; day += 1) {
      totalMs += history[getLocalDateKey(new Date(year, month, day))] ?? 0;
    }

    return {
      label: `${index + 1}周`,
      elapsedMs: totalMs,
      minutes: msToMinutes(totalMs),
    };
  });

  return Array.from(
    { length: weekCount },
    (_, index) => points[(currentWeekIndex + index + 1) % weekCount],
  );
}

function buildCurrentYearMonths(history: WatchTimerHistory, todayKey: string): DurationPoint[] {
  const today = parseLocalDateKey(todayKey);
  const year = today.getFullYear();
  const currentMonth = today.getMonth();

  const points = Array.from({ length: 12 }, (_, month) => {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    let totalMs = 0;

    for (let day = 1; day <= daysInMonth; day += 1) {
      totalMs += history[getLocalDateKey(new Date(year, month, day))] ?? 0;
    }

    return {
      label: `${month + 1}月`,
      elapsedMs: totalMs,
      minutes: msToMinutes(totalMs),
    };
  });

  return Array.from({ length: 12 }, (_, index) => points[(currentMonth + index + 1) % 12]);
}

function getLocalDateKey(date: Date): string {
  return `${date.getFullYear()}-${padDate(date.getMonth() + 1)}-${padDate(date.getDate())}`;
}

function parseLocalDateKey(dateKey: string): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function msToMinutes(ms: number): number {
  return Math.floor(ms / 60000);
}

function padDate(value: number): string {
  return value.toString().padStart(2, "0");
}
