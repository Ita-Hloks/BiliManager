import type { DurationPoint, StatsPeriod } from "../popup/types";
import { addDays, getLocalDateKey, parseLocalDateKey } from "./date";
import { getWatchTimerHistory } from "./watchTimerHistory";
import type { WatchTimerHistory } from "./watchTimerHistory";

const WEEKDAY_LABELS = ["日", "一", "二", "三", "四", "五", "六"];
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

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
  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 0);
  const firstWeekStart = getWeekStart(monthStart);
  const currentWeekStart = getWeekStart(today).getTime();
  const weekCount = Math.floor((monthEnd.getTime() - firstWeekStart.getTime()) / WEEK_MS) + 1;
  const currentWeekIndex = Math.floor((currentWeekStart - firstWeekStart.getTime()) / WEEK_MS);

  const points = Array.from({ length: weekCount }, (_, index) => {
    const weekStart = addDays(firstWeekStart, index * 7);
    const weekEnd = addDays(weekStart, 6);
    const startDate = maxDate(weekStart, monthStart);
    const endDate = minDate(weekEnd, monthEnd);
    let totalMs = 0;

    for (let date = startDate; date.getTime() <= endDate.getTime(); date = addDays(date, 1)) {
      totalMs += history[getLocalDateKey(date)] ?? 0;
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

function getWeekStart(date: Date): Date {
  const mondayOffset = (date.getDay() + 6) % 7;
  return addDays(date, -mondayOffset);
}

function minDate(first: Date, second: Date): Date {
  return first.getTime() <= second.getTime() ? first : second;
}

function maxDate(first: Date, second: Date): Date {
  return first.getTime() >= second.getTime() ? first : second;
}

function msToMinutes(ms: number): number {
  return Math.floor(ms / 60000);
}
