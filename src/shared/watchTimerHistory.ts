const WATCH_TIMER_HISTORY_KEY = "biliManager.playerWatchTimerHistory";
const WATCH_TIMER_SESSION_KEY_PREFIX = "biliManager.playerWatchTimerSession:";
const WATCH_TIMER_VIDEO_RECORD_KEY_PREFIX = "biliManager.playerWatchTimerVideoRecord:";

export type WatchTimerHistory = Record<string, number>;

type WatchTimerSessionStorage = {
  id: string;
  pageKey: string;
  title: string;
  url: string;
  dateKey: string;
  elapsedMs: number;
  updatedAt: number;
};

export type WatchTimerVideoHistoryItem = {
  pageKey: string;
  title: string;
  url: string;
  dateKey: string;
  updatedAt: number;
};

export type WatchTimerHistoryBackup = {
  history: WatchTimerHistory;
  videos: WatchTimerVideoHistoryItem[];
};

const MAX_HISTORY_DAYS = 370;
const MAX_WATCH_TIMER_RECORDS = 5000;

export async function getWatchTimerHistory(): Promise<WatchTimerHistory> {
  if (!hasChromeStorage()) return {};

  const saved = await chrome.storage.local.get(null);
  const legacyHistory = normalizeHistory(saved[WATCH_TIMER_HISTORY_KEY]);
  const sessionHistory = buildSessionHistory(saved);
  return pruneHistory(mergeHistories(legacyHistory, sessionHistory), getTodayKey());
}

export async function getRecentWatchTimerVideos(limit = 5): Promise<WatchTimerVideoHistoryItem[]> {
  const saved = await chrome.storage.local.get(null);
  return getWatchTimerVideoRecordsFromStorage(saved)
    .sort((left, right) => right.updatedAt - left.updatedAt)
    .slice(0, Math.max(0, limit));
}

export async function exportWatchTimerHistory(): Promise<WatchTimerHistoryBackup> {
  if (!hasChromeStorage()) {
    return {
      history: {},
      videos: [],
    };
  }

  const saved = await chrome.storage.local.get(null);
  return {
    history: pruneHistory(
      mergeHistories(normalizeHistory(saved[WATCH_TIMER_HISTORY_KEY]), buildSessionHistory(saved)),
      getTodayKey(),
    ),
    videos: getWatchTimerVideoRecordsFromStorage(saved),
  };
}

export async function importWatchTimerHistory(history: WatchTimerHistoryBackup): Promise<void> {
  if (!hasChromeStorage()) return;

  const saved = await chrome.storage.local.get(null);
  const oldSessionKeys = Object.keys(saved).filter(key =>
    key.startsWith(WATCH_TIMER_SESSION_KEY_PREFIX),
  );
  if (oldSessionKeys.length > 0) await chrome.storage.local.remove(oldSessionKeys);
  const oldVideoRecordKeys = Object.keys(saved).filter(key =>
    key.startsWith(WATCH_TIMER_VIDEO_RECORD_KEY_PREFIX),
  );
  if (oldVideoRecordKeys.length > 0) await chrome.storage.local.remove(oldVideoRecordKeys);

  const nextHistory = normalizeHistory(history.history);
  const videos = history.videos
    .map(normalizeVideoRecord)
    .filter((record): record is WatchTimerVideoHistoryItem => !!record);
  const nextStorage: Record<string, unknown> = {
    [WATCH_TIMER_HISTORY_KEY]: nextHistory,
  };
  videos.forEach(record => {
    nextStorage[getWatchTimerVideoRecordKey(record.dateKey, record.pageKey)] = record;
  });

  await chrome.storage.local.set(nextStorage);
  await pruneWatchTimerSessions();
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

function buildSessionHistory(storage: Record<string, unknown>): WatchTimerHistory {
  return getWatchTimerSessionsFromStorage(storage).reduce<WatchTimerHistory>((history, session) => {
    history[session.dateKey] = (history[session.dateKey] ?? 0) + session.elapsedMs;
    return history;
  }, {});
}

export function getTodayKey(): string {
  return getLocalDateKey(new Date());
}

function mergeHistories(...histories: WatchTimerHistory[]): WatchTimerHistory {
  return histories.reduce<WatchTimerHistory>((merged, history) => {
    Object.entries(history).forEach(([dateKey, elapsedMs]) => {
      merged[dateKey] = (merged[dateKey] ?? 0) + elapsedMs;
    });
    return merged;
  }, {});
}

function normalizeHistory(value: unknown): WatchTimerHistory {
  if (!value || typeof value !== "object") return {};

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([dateKey, elapsedMs]) => isDateKey(dateKey) && typeof elapsedMs === "number")
      .map(([dateKey, elapsedMs]) => [dateKey, Math.max(0, Math.floor(elapsedMs as number))]),
  );
}

function getWatchTimerSessionsFromStorage(
  storage: Record<string, unknown>,
): WatchTimerSessionStorage[] {
  return Object.entries(storage)
    .filter(([key]) => key.startsWith(WATCH_TIMER_SESSION_KEY_PREFIX))
    .map(([, value]) => normalizeSession(value))
    .filter((session): session is WatchTimerSessionStorage => !!session);
}

function getWatchTimerVideoRecordsFromStorage(
  storage: Record<string, unknown>,
): WatchTimerVideoHistoryItem[] {
  return Object.entries(storage)
    .filter(([key]) => key.startsWith(WATCH_TIMER_VIDEO_RECORD_KEY_PREFIX))
    .map(([, value]) => normalizeVideoRecord(value))
    .filter((record): record is WatchTimerVideoHistoryItem => !!record);
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

function normalizeVideoRecord(value: unknown): WatchTimerVideoHistoryItem | undefined {
  if (!value || typeof value !== "object") return undefined;

  const record = value as Partial<WatchTimerVideoHistoryItem>;
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

function normalizeTitle(title: unknown, fallback: string): string {
  if (typeof title !== "string") return fallback;
  const normalized = title.replace(/[_-]?哔哩哔哩.*$/u, "").trim();
  return normalized || fallback;
}

function getWatchTimerVideoRecordKey(dateKey: string, pageKey: string): string {
  return `${WATCH_TIMER_VIDEO_RECORD_KEY_PREFIX}${encodeURIComponent(`${dateKey}:${pageKey}`)}`;
}

function pruneHistory(history: WatchTimerHistory, todayKey: string): WatchTimerHistory {
  const today = parseLocalDateKey(todayKey).getTime();
  const minDate = addDays(new Date(today), -MAX_HISTORY_DAYS + 1).getTime();

  return Object.fromEntries(
    Object.entries(history).filter(([dateKey]) => parseLocalDateKey(dateKey).getTime() >= minDate),
  );
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

function padDate(value: number): string {
  return value.toString().padStart(2, "0");
}

function hasChromeStorage(): boolean {
  return typeof chrome !== "undefined" && !!chrome.storage?.local;
}
