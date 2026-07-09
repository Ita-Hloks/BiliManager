export const WATCH_TIMER_DAILY_KEY = "biliManager.playerWatchTimerDaily";
export const WATCH_TIMER_HISTORY_KEY = "biliManager.playerWatchTimerHistory";
export const WATCH_TIMER_SESSION_KEY_PREFIX = "biliManager.playerWatchTimerSession:";
export const WATCH_TIMER_VIDEO_RECORD_KEY_PREFIX = "biliManager.playerWatchTimerVideoRecord:";

export type WatchTimerDailyStorage = {
  dateKey: string;
  elapsedMs: number;
};

type WatchTimerHistory = Record<string, number>;

type WatchTimerSessionStorage = {
  id: string;
  pageKey: string;
  title: string;
  url: string;
  dateKey: string;
  elapsedMs: number;
  updatedAt: number;
};

type WatchTimerVideoRecordStorage = {
  pageKey: string;
  title: string;
  url: string;
  dateKey: string;
  updatedAt: number;
};

const MAX_HISTORY_DAYS = 370;
const MAX_WATCH_TIMER_RECORDS = 5000;
const WATCH_TIMER_SESSION_MIN_MS = 1000;

export async function loadWatchTimerDaily(): Promise<WatchTimerDailyStorage> {
  if (!hasChromeStorage()) return createEmptyDailyStorage();

  const todayKey = getTodayKey();
  return {
    dateKey: todayKey,
    elapsedMs: await getWatchTimerDailyElapsed(todayKey),
  };
}

export async function getWatchTimerVideoDailyElapsed(
  pageKey: string,
  dateKey = getTodayKey(),
): Promise<number> {
  if (!hasChromeStorage()) return 0;
  if (!pageKey || !isDateKey(dateKey)) return 0;

  const sessions = await getWatchTimerSessions();
  return sessions
    .filter(session => session.pageKey === pageKey && session.dateKey === dateKey)
    .reduce((sum, session) => sum + session.elapsedMs, 0);
}

export async function saveWatchTimerSession(session: WatchTimerSessionStorage): Promise<void> {
  if (!hasChromeStorage()) return;
  const normalized = normalizeSession(session);
  if (!normalized || normalized.elapsedMs < WATCH_TIMER_SESSION_MIN_MS) return;

  await chrome.storage.local.set({
    [getWatchTimerSessionKey(normalized.id)]: normalized,
    [getWatchTimerVideoRecordKey(normalized.dateKey, normalized.pageKey)]: {
      pageKey: normalized.pageKey,
      title: normalized.title,
      url: normalized.url,
      dateKey: normalized.dateKey,
      updatedAt: normalized.updatedAt,
    } satisfies WatchTimerVideoRecordStorage,
  });
}

export async function pruneWatchTimerSessions(todayKey = getTodayKey()): Promise<void> {
  if (!hasChromeStorage()) return;
  if (!isDateKey(todayKey)) return;

  const saved = await chrome.storage.local.get(null);
  const minDate = addDays(parseLocalDateKey(todayKey), -MAX_HISTORY_DAYS + 1).getTime();
  const recordEntries = Object.entries(saved).flatMap(([key, value]) => {
    if (key.startsWith(WATCH_TIMER_SESSION_KEY_PREFIX)) {
      const record = normalizeSession(value);
      return [{ key, dateKey: record?.dateKey, updatedAt: record?.updatedAt }];
    }
    if (key.startsWith(WATCH_TIMER_VIDEO_RECORD_KEY_PREFIX)) {
      const record = normalizeVideoRecord(value);
      return [{ key, dateKey: record?.dateKey, updatedAt: record?.updatedAt }];
    }
    return [];
  });
  const expiredKeys = recordEntries
    .filter(({ dateKey }) => !dateKey || parseLocalDateKey(dateKey).getTime() < minDate)
    .map(({ key }) => key);
  const overflowKeys = recordEntries
    .filter(({ updatedAt }) => typeof updatedAt === "number")
    .sort((left, right) => (right.updatedAt ?? 0) - (left.updatedAt ?? 0))
    .slice(MAX_WATCH_TIMER_RECORDS)
    .map(({ key }) => key);
  const removableKeys = [...new Set([...expiredKeys, ...overflowKeys])];

  if (removableKeys.length > 0) await chrome.storage.local.remove(removableKeys);
}

async function getWatchTimerDailyElapsed(dateKey = getTodayKey()): Promise<number> {
  if (!hasChromeStorage()) return 0;
  if (!isDateKey(dateKey)) return 0;

  const saved = await chrome.storage.local.get(null);
  const legacyHistory = normalizeHistory(saved[WATCH_TIMER_HISTORY_KEY]);
  const sessionHistory = getWatchTimerSessionsFromStorage(saved).reduce<WatchTimerHistory>(
    (history, session) => {
      history[session.dateKey] = (history[session.dateKey] ?? 0) + session.elapsedMs;
      return history;
    },
    {},
  );
  return (legacyHistory[dateKey] ?? 0) + (sessionHistory[dateKey] ?? 0);
}

async function getWatchTimerSessions(): Promise<WatchTimerSessionStorage[]> {
  if (!hasChromeStorage()) return [];

  const saved = await chrome.storage.local.get(null);
  return getWatchTimerSessionsFromStorage(saved);
}

function getWatchTimerSessionsFromStorage(
  storage: Record<string, unknown>,
): WatchTimerSessionStorage[] {
  return Object.entries(storage)
    .filter(([key]) => key.startsWith(WATCH_TIMER_SESSION_KEY_PREFIX))
    .map(([, value]) => normalizeSession(value))
    .filter((session): session is WatchTimerSessionStorage => !!session);
}

function normalizeVideoRecord(value: unknown): WatchTimerVideoRecordStorage | undefined {
  if (!value || typeof value !== "object") return undefined;

  const record = value as Partial<WatchTimerVideoRecordStorage>;
  if (typeof record.pageKey !== "string" || record.pageKey.length === 0) return undefined;
  if (typeof record.dateKey !== "string" || !isDateKey(record.dateKey)) return undefined;
  if (typeof record.updatedAt !== "number" || !Number.isFinite(record.updatedAt)) return undefined;

  return {
    pageKey: record.pageKey,
    title: normalizeTitle(record.title, record.pageKey),
    url: typeof record.url === "string" ? record.url : "",
    dateKey: record.dateKey,
    updatedAt: Math.max(0, Math.floor(record.updatedAt)),
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

function normalizeSession(value: unknown): WatchTimerSessionStorage | undefined {
  if (!value || typeof value !== "object") return undefined;

  const record = value as Partial<WatchTimerSessionStorage>;
  if (typeof record.id !== "string" || record.id.length === 0) return undefined;
  if (typeof record.pageKey !== "string" || record.pageKey.length === 0) return undefined;
  if (typeof record.dateKey !== "string" || !isDateKey(record.dateKey)) return undefined;
  if (typeof record.updatedAt !== "number" || !Number.isFinite(record.updatedAt)) return undefined;

  return {
    id: record.id,
    pageKey: record.pageKey,
    title: normalizeTitle(record.title, record.pageKey),
    url: typeof record.url === "string" ? record.url : "",
    dateKey: record.dateKey,
    elapsedMs:
      typeof record.elapsedMs === "number" && Number.isFinite(record.elapsedMs)
        ? Math.max(0, Math.floor(record.elapsedMs))
        : 0,
    updatedAt: Math.max(0, Math.floor(record.updatedAt)),
  };
}

function normalizeTitle(title: unknown, fallback: string): string {
  if (typeof title !== "string") return fallback;
  const normalized = title.replace(/[_-]?哔哩哔哩.*$/u, "").trim();
  return normalized || fallback;
}

function getWatchTimerSessionKey(sessionId: string): string {
  return `${WATCH_TIMER_SESSION_KEY_PREFIX}${encodeURIComponent(sessionId)}`;
}

function getWatchTimerVideoRecordKey(dateKey: string, pageKey: string): string {
  return `${WATCH_TIMER_VIDEO_RECORD_KEY_PREFIX}${encodeURIComponent(`${dateKey}:${pageKey}`)}`;
}

function createEmptyDailyStorage(): WatchTimerDailyStorage {
  return {
    dateKey: getTodayKey(),
    elapsedMs: 0,
  };
}

function getTodayKey() {
  const date = new Date();
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

function padDate(value: number) {
  return value.toString().padStart(2, "0");
}

function hasChromeStorage(): boolean {
  return typeof chrome !== "undefined" && !!chrome.storage?.local;
}
