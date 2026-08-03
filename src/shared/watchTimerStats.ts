import type {
  DurationComparison,
  DurationPoint,
  StatsPeriod,
  VideoCountPoint,
  WatchDurationData,
} from "../popup/types";
import { addDays, getLocalDateKey, parseLocalDateKey } from "./date";
import { getWatchTimerHistory, getWatchTimerVideos } from "./watchTimerHistory";
import type { WatchTimerDurationBreakdown, WatchTimerHistory } from "./watchTimerHistory";

const WEEKDAY_LABELS = ["日", "一", "二", "三", "四", "五", "六"];
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

type DateRange = {
  start: Date;
  end: Date;
};

type PeriodValuePoint = {
  label: string;
  value: number;
  foregroundElapsedMs: number;
  backgroundElapsedMs: number;
  dateKey?: string;
};

type PeriodValue = number | WatchTimerDurationBreakdown;

export async function getWatchDurationData(period: StatsPeriod): Promise<WatchDurationData> {
  const dataByPeriod = await getWatchDurationDataByPeriod();
  return dataByPeriod[period];
}

export async function getWatchDurationDataByPeriod(): Promise<
  Record<StatsPeriod, WatchDurationData>
> {
  const history = await getWatchTimerHistory();
  const todayKey = getLocalDateKey(new Date());
  return {
    "7d": buildWatchDurationData(history, "7d", todayKey),
    month: buildWatchDurationData(history, "month", todayKey),
    year: buildWatchDurationData(history, "year", todayKey),
  };
}

export async function getWatchVideoCountDataByPeriod(): Promise<
  Record<StatsPeriod, VideoCountPoint[]>
> {
  const videos = await getWatchTimerVideos();
  const videoCountsByDate = videos.reduce<Record<string, number>>((counts, video) => {
    counts[video.dateKey] = (counts[video.dateKey] ?? 0) + 1;
    return counts;
  }, {});
  const todayKey = getLocalDateKey(new Date());
  return {
    "7d": buildVideoCountPoints(videoCountsByDate, "7d", todayKey),
    month: buildVideoCountPoints(videoCountsByDate, "month", todayKey),
    year: buildVideoCountPoints(videoCountsByDate, "year", todayKey),
  };
}

function buildWatchDurationData(
  history: WatchTimerHistory,
  period: StatsPeriod,
  todayKey: string,
): WatchDurationData {
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
  return buildPeriodValuePoints(history, period, todayKey).map(point => ({
    label: point.label,
    elapsedMs: point.value,
    foregroundElapsedMs: point.foregroundElapsedMs,
    backgroundElapsedMs: point.backgroundElapsedMs,
    dateKey: point.dateKey,
  }));
}

function buildVideoCountPoints(
  videoCountsByDate: Record<string, number>,
  period: StatsPeriod,
  todayKey: string,
): VideoCountPoint[] {
  return buildPeriodValuePoints(videoCountsByDate, period, todayKey).map(point => ({
    label: point.label,
    count: point.value,
  }));
}

function buildPeriodValuePoints(
  history: Record<string, PeriodValue>,
  period: StatsPeriod,
  todayKey: string,
): PeriodValuePoint[] {
  if (period === "7d") return buildLastSevenDays(history, todayKey);
  if (period === "month") return buildCurrentMonthWeeks(history, todayKey);
  return buildCurrentYearMonths(history, todayKey);
}

function buildLastSevenDays(
  history: Record<string, PeriodValue>,
  todayKey: string,
): PeriodValuePoint[] {
  const today = parseLocalDateKey(todayKey);
  return Array.from({ length: 7 }, (_, index) => {
    const date = addDays(today, index - 6);
    const dateKey = getLocalDateKey(date);
    return createPeriodValuePoint(WEEKDAY_LABELS[date.getDay()], history[dateKey] ?? 0, dateKey);
  });
}

function buildCurrentMonthWeeks(
  history: Record<string, PeriodValue>,
  todayKey: string,
): PeriodValuePoint[] {
  const today = parseLocalDateKey(todayKey);
  const monthRange = getMonthRange(today);
  const firstWeekStart = getWeekRange(monthRange.start).start;
  const currentWeekStart = getWeekRange(today).start.getTime();
  const weekCount = Math.floor((monthRange.end.getTime() - firstWeekStart.getTime()) / WEEK_MS) + 1;
  const currentWeekIndex = Math.floor((currentWeekStart - firstWeekStart.getTime()) / WEEK_MS);

  const points = Array.from({ length: weekCount }, (_, index) => {
    const weekRange = getWeekRange(addDays(firstWeekStart, index * 7));
    const startDate = maxDate(weekRange.start, monthRange.start);
    const endDate = minDate(weekRange.end, monthRange.end);
    const hasStarted = index <= currentWeekIndex;
    const effectiveEndDate = index === currentWeekIndex ? minDate(endDate, today) : endDate;
    const total = hasStarted
      ? sumHistoryRange(history, startDate, effectiveEndDate)
      : createEmptyDurationBreakdown();

    return createPeriodValuePoint(`${index + 1}周`, total);
  });

  return Array.from(
    { length: weekCount },
    (_, index) => points[(currentWeekIndex + index + 1) % weekCount],
  );
}

function buildCurrentYearMonths(
  history: Record<string, PeriodValue>,
  todayKey: string,
): PeriodValuePoint[] {
  const today = parseLocalDateKey(todayKey);
  const year = today.getFullYear();
  const currentMonth = today.getMonth();

  const points = Array.from({ length: 12 }, (_, month) => {
    const monthRange = getMonthRange(new Date(year, month, 1));
    const hasStarted = month <= currentMonth;
    const endDate = month === currentMonth ? today : monthRange.end;
    const total = hasStarted
      ? sumHistoryRange(history, monthRange.start, endDate)
      : createEmptyDurationBreakdown();

    return createPeriodValuePoint(`${month + 1}月`, total);
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
    const current = toDurationBreakdown(history[todayKey] ?? 0);
    const previous = toDurationBreakdown(history[getLocalDateKey(addDays(today, -1))] ?? 0);
    return {
      label: "较前一日",
      elapsedMs: current.elapsedMs,
      previousElapsedMs: previous.elapsedMs,
      backgroundElapsedMs: current.backgroundElapsedMs,
      previousBackgroundElapsedMs: previous.backgroundElapsedMs,
    };
  }

  if (period === "month") {
    const currentWeek = getWeekRange(today);
    const previousWeek = getWeekRange(addDays(today, -7));
    const currentMonth = getMonthRange(today);
    const current = sumHistoryRange(history, maxDate(currentWeek.start, currentMonth.start), today);
    const previous = sumHistoryRange(history, previousWeek.start, previousWeek.end);
    return {
      label: "较前一周",
      elapsedMs: current.elapsedMs,
      previousElapsedMs: previous.elapsedMs,
      backgroundElapsedMs: current.backgroundElapsedMs,
      previousBackgroundElapsedMs: previous.backgroundElapsedMs,
    };
  }

  const currentMonth = getMonthRange(today);
  const previousMonth = getMonthRange(new Date(today.getFullYear(), today.getMonth() - 1, 1));
  const current = sumHistoryRange(history, currentMonth.start, today);
  const previous = sumHistoryRange(history, previousMonth.start, previousMonth.end);
  return {
    label: "较前一月",
    elapsedMs: current.elapsedMs,
    previousElapsedMs: previous.elapsedMs,
    backgroundElapsedMs: current.backgroundElapsedMs,
    previousBackgroundElapsedMs: previous.backgroundElapsedMs,
  };
}

function getWeekRange(date: Date): DateRange {
  const mondayOffset = (date.getDay() + 6) % 7;
  const start = addDays(date, -mondayOffset);
  return { start, end: addDays(start, 6) };
}

function getMonthRange(date: Date): DateRange {
  const year = date.getFullYear();
  const month = date.getMonth();
  return {
    start: new Date(year, month, 1),
    end: new Date(year, month + 1, 0),
  };
}

function minDate(first: Date, second: Date): Date {
  return first.getTime() <= second.getTime() ? first : second;
}

function maxDate(first: Date, second: Date): Date {
  return first.getTime() >= second.getTime() ? first : second;
}

function sumHistoryRange(
  history: Record<string, PeriodValue>,
  startDate: Date,
  endDate: Date,
): WatchTimerDurationBreakdown {
  let total = createEmptyDurationBreakdown();
  for (let date = startDate; date.getTime() <= endDate.getTime(); date = addDays(date, 1)) {
    total = addDurationBreakdown(total, toDurationBreakdown(history[getLocalDateKey(date)] ?? 0));
  }
  return total;
}

function createPeriodValuePoint(
  label: string,
  value: PeriodValue,
  dateKey?: string,
): PeriodValuePoint {
  const breakdown = toDurationBreakdown(value);
  return {
    label,
    value: breakdown.elapsedMs,
    foregroundElapsedMs: breakdown.foregroundElapsedMs,
    backgroundElapsedMs: breakdown.backgroundElapsedMs,
    dateKey,
  };
}

function toDurationBreakdown(value: PeriodValue): WatchTimerDurationBreakdown {
  if (typeof value === "number") {
    const elapsedMs = Math.max(0, value);
    return {
      elapsedMs,
      foregroundElapsedMs: elapsedMs,
      backgroundElapsedMs: 0,
    };
  }
  return value;
}

function createEmptyDurationBreakdown(): WatchTimerDurationBreakdown {
  return {
    elapsedMs: 0,
    foregroundElapsedMs: 0,
    backgroundElapsedMs: 0,
  };
}

function addDurationBreakdown(
  left: WatchTimerDurationBreakdown,
  right: WatchTimerDurationBreakdown,
): WatchTimerDurationBreakdown {
  return {
    elapsedMs: left.elapsedMs + right.elapsedMs,
    foregroundElapsedMs: left.foregroundElapsedMs + right.foregroundElapsedMs,
    backgroundElapsedMs: left.backgroundElapsedMs + right.backgroundElapsedMs,
  };
}
