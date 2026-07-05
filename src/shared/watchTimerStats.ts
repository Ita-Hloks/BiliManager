import type { DurationPoint, StatsPeriod } from "../popup/types";

export const WATCH_TIMER_DAILY_KEY = "biliManager.playerWatchTimerDaily";
export const WATCH_TIMER_HISTORY_KEY = "biliManager.playerWatchTimerHistory";

export type WatchTimerDailyStorage = {
  dateKey: string;
  elapsedMs: number;
};

export type WatchTimerHistory = Record<string, number>;

const WEEKDAY_LABELS = ["日", "一", "二", "三", "四", "五", "六"];
const MAX_HISTORY_DAYS = 370;

export async function getWatchDurationData(period: StatsPeriod): Promise<DurationPoint[]> {
  const history = await loadWatchTimerHistory();
  const todayKey = getLocalDateKey(new Date());
  return buildDurationPoints(history, period, todayKey);
}

export async function loadWatchTimerDaily(): Promise<WatchTimerDailyStorage> {
  if (!hasChromeStorage()) return createEmptyDailyStorage();

  const saved = await chrome.storage.local.get(WATCH_TIMER_DAILY_KEY);
  return normalizeDailyStorage(saved[WATCH_TIMER_DAILY_KEY]);
}

export async function saveWatchTimerDailyElapsed(
  dateKey: string,
  elapsedMs: number,
): Promise<void> {
  if (!hasChromeStorage()) return;

  const normalized = {
    dateKey,
    elapsedMs: Math.max(0, Math.floor(elapsedMs)),
  };
  const history = await loadWatchTimerHistory();
  const nextHistory = pruneHistory(
    {
      ...history,
      [normalized.dateKey]: normalized.elapsedMs,
    },
    normalized.dateKey,
  );

  await chrome.storage.local.set({
    [WATCH_TIMER_DAILY_KEY]: normalized,
    [WATCH_TIMER_HISTORY_KEY]: nextHistory,
  });
}

export function getTodayKey(): string {
  return getLocalDateKey(new Date());
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

  return Array.from({ length: weekCount }, (_, index) => {
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
}

function buildCurrentYearMonths(history: WatchTimerHistory, todayKey: string): DurationPoint[] {
  const today = parseLocalDateKey(todayKey);
  const year = today.getFullYear();

  return Array.from({ length: 12 }, (_, month) => {
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
}

async function loadWatchTimerHistory(): Promise<WatchTimerHistory> {
  if (!hasChromeStorage()) return {};

  const saved = await chrome.storage.local.get(WATCH_TIMER_HISTORY_KEY);
  return normalizeHistory(saved[WATCH_TIMER_HISTORY_KEY]);
}

function normalizeDailyStorage(value: unknown): WatchTimerDailyStorage {
  const todayKey = getTodayKey();
  if (!value || typeof value !== "object") return createEmptyDailyStorage();

  const record = value as Partial<WatchTimerDailyStorage>;
  if (record.dateKey !== todayKey) return createEmptyDailyStorage();

  return {
    dateKey: todayKey,
    elapsedMs:
      typeof record.elapsedMs === "number" && Number.isFinite(record.elapsedMs)
        ? Math.max(0, Math.floor(record.elapsedMs))
        : 0,
  };
}

function normalizeHistory(value: unknown): WatchTimerHistory {
  if (!value || typeof value !== "object") return {};

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([dateKey, elapsedMs]) => isDateKey(dateKey) && typeof elapsedMs === "number")
      .map(([dateKey, elapsedMs]) => [dateKey, Math.max(0, Math.floor(elapsedMs as number))]),
  );
}

function pruneHistory(history: WatchTimerHistory, todayKey: string): WatchTimerHistory {
  const today = parseLocalDateKey(todayKey).getTime();
  const minDate = addDays(new Date(today), -MAX_HISTORY_DAYS + 1).getTime();

  return Object.fromEntries(
    Object.entries(history).filter(([dateKey]) => parseLocalDateKey(dateKey).getTime() >= minDate),
  );
}

function createEmptyDailyStorage(): WatchTimerDailyStorage {
  return {
    dateKey: getTodayKey(),
    elapsedMs: 0,
  };
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

function isDateKey(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function msToMinutes(ms: number): number {
  return Math.floor(ms / 60000);
}

function padDate(value: number): string {
  return value.toString().padStart(2, "0");
}

function hasChromeStorage(): boolean {
  return typeof chrome !== "undefined" && !!chrome.storage?.local;
}
