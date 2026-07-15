import type {
  DurationComparison,
  DurationPoint,
  StatsPeriod,
  WatchDurationData,
} from "../popup/types";
import { addDays, getLocalDateKey, parseLocalDateKey } from "./date";
import { getWatchTimerHistory } from "./watchTimerHistory";
import type { WatchTimerHistory } from "./watchTimerHistory";

const WEEKDAY_LABELS = ["日", "一", "二", "三", "四", "五", "六"];
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export async function getWatchDurationData(period: StatsPeriod): Promise<WatchDurationData> {
  const history = await getWatchTimerHistory();
  const todayKey = getLocalDateKey(new Date());
  return {
    points: buildDurationPoints(history, period, todayKey),
    comparison: buildCurrentComparison(history, period, todayKey),
  };
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
    const hasStarted = index <= currentWeekIndex;
    const effectiveEndDate = index === currentWeekIndex ? minDate(endDate, today) : endDate;
    const totalMs = hasStarted ? sumHistoryRange(history, startDate, effectiveEndDate) : 0;

    return {
      label: `${index + 1}周`,
      elapsedMs: totalMs,
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
    const hasStarted = month <= currentMonth;
    const endDay = month === currentMonth ? today.getDate() : daysInMonth;
    const totalMs = hasStarted
      ? sumHistoryRange(history, new Date(year, month, 1), new Date(year, month, endDay))
      : 0;

    return {
      label: `${month + 1}月`,
      elapsedMs: totalMs,
    };
  });

  return Array.from({ length: 12 }, (_, index) => points[(currentMonth + index + 1) % 12]);
}

function buildCurrentComparison(
  history: WatchTimerHistory,
  period: StatsPeriod,
  todayKey: string,
): DurationComparison {
  const today = parseLocalDateKey(todayKey);
  if (period === "7d") {
    return {
      label: "较前一日",
      elapsedMs: history[todayKey] ?? 0,
      previousElapsedMs: history[getLocalDateKey(addDays(today, -1))] ?? 0,
    };
  }

  if (period === "month") {
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const startDate = maxDate(getWeekStart(today), monthStart);
    return {
      label: "较前一周",
      elapsedMs: sumHistoryRange(history, startDate, today),
      previousElapsedMs: sumHistoryRange(history, addDays(startDate, -7), addDays(today, -7)),
    };
  }

  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const previousMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const previousMonthDays = new Date(today.getFullYear(), today.getMonth(), 0).getDate();
  const previousEndDay = Math.min(today.getDate(), previousMonthDays);
  return {
    label: "较前一月",
    elapsedMs: sumHistoryRange(history, monthStart, today),
    previousElapsedMs: sumHistoryRange(
      history,
      previousMonth,
      new Date(previousMonth.getFullYear(), previousMonth.getMonth(), previousEndDay),
    ),
  };
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

function sumHistoryRange(history: WatchTimerHistory, startDate: Date, endDate: Date): number {
  let totalMs = 0;
  for (let date = startDate; date.getTime() <= endDate.getTime(); date = addDays(date, 1)) {
    totalMs += history[getLocalDateKey(date)] ?? 0;
  }
  return totalMs;
}
