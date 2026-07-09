export const WATCH_TIMER_DAILY_KEY = "biliManager.playerWatchTimerDaily";
export const WATCH_TIMER_HISTORY_KEY = "biliManager.playerWatchTimerHistory";
export const WATCH_TIMER_SESSION_KEY_PREFIX = "biliManager.playerWatchTimerSession:";

export type WatchTimerDailyStorage = {
  dateKey: string;
  elapsedMs: number;
};

export type WatchTimerHistory = Record<string, number>;

export type WatchTimerSessionStorage = {
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
  elapsedMs: number;
  updatedAt: number;
};

export type WatchTimerHistoryBackup = {
  daily?: WatchTimerDailyStorage;
  history: WatchTimerHistory;
  sessions: WatchTimerSessionStorage[];
};

const MAX_HISTORY_DAYS = 370;
const MAX_SESSION_RECORDS = 5000;
const WATCH_TIMER_SESSION_MIN_MS = 1000;

export async function loadWatchTimerDaily(): Promise<WatchTimerDailyStorage> {
  if (!hasChromeStorage()) return createEmptyDailyStorage();

  const todayKey = getTodayKey();
  return {
    dateKey: todayKey,
    elapsedMs: await getWatchTimerDailyElapsed(todayKey),
  };
}

export async function saveWatchTimerDailyElapsed(
  dateKey: string,
  elapsedMs: number,
): Promise<void> {
  if (!hasChromeStorage()) return;
  if (!isDateKey(dateKey)) return;

  const normalized = {
    dateKey,
    elapsedMs: Math.max(0, Math.floor(elapsedMs)),
  };
  const history = await loadLegacyWatchTimerHistory();
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

export async function saveWatchTimerSession(session: WatchTimerSessionStorage): Promise<void> {
  if (!hasChromeStorage()) return;
  const normalized = normalizeSession(session);
  if (!normalized || normalized.elapsedMs < WATCH_TIMER_SESSION_MIN_MS) return;

  await chrome.storage.local.set({
    [getWatchTimerSessionKey(normalized.id)]: normalized,
  });
}

export async function getWatchTimerDailyElapsed(dateKey = getTodayKey()): Promise<number> {
  if (!hasChromeStorage()) return 0;
  if (!isDateKey(dateKey)) return 0;

  const history = await getWatchTimerHistory();
  return history[dateKey] ?? 0;
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

export async function getWatchTimerHistory(): Promise<WatchTimerHistory> {
  if (!hasChromeStorage()) return {};

  const saved = await chrome.storage.local.get(null);
  const legacyHistory = normalizeHistory(saved[WATCH_TIMER_HISTORY_KEY]);
  const sessionHistory = buildSessionHistory(saved);
  return pruneHistory(mergeHistories(legacyHistory, sessionHistory), getTodayKey());
}

export async function getRecentWatchTimerSessions(limit = 5): Promise<WatchTimerSessionStorage[]> {
  const sessions = await getWatchTimerSessions();
  return sessions
    .sort((left, right) => right.updatedAt - left.updatedAt)
    .slice(0, Math.max(0, limit));
}

export async function getRecentWatchTimerVideos(limit = 5): Promise<WatchTimerVideoHistoryItem[]> {
  const sessions = await getWatchTimerSessions();
  const videos = sessions.reduce<Record<string, WatchTimerVideoHistoryItem>>((grouped, session) => {
    const key = `${session.dateKey}:${session.pageKey}`;
    const current = grouped[key];
    if (!current) {
      grouped[key] = {
        pageKey: session.pageKey,
        title: session.title,
        url: session.url,
        dateKey: session.dateKey,
        elapsedMs: session.elapsedMs,
        updatedAt: session.updatedAt,
      };
      return grouped;
    }

    current.elapsedMs += session.elapsedMs;
    if (session.updatedAt > current.updatedAt) {
      current.title = session.title;
      current.url = session.url;
      current.updatedAt = session.updatedAt;
    }
    return grouped;
  }, {});

  return Object.values(videos)
    .sort((left, right) => right.updatedAt - left.updatedAt)
    .slice(0, Math.max(0, limit));
}

export async function exportWatchTimerHistory(): Promise<WatchTimerHistoryBackup> {
  if (!hasChromeStorage()) {
    return {
      history: {},
      sessions: [],
    };
  }

  const saved = await chrome.storage.local.get(null);
  return {
    daily: normalizeDailyStorage(saved[WATCH_TIMER_DAILY_KEY]),
    history: normalizeHistory(saved[WATCH_TIMER_HISTORY_KEY]),
    sessions: getWatchTimerSessionsFromStorage(saved),
  };
}

export async function importWatchTimerHistory(history: WatchTimerHistoryBackup): Promise<void> {
  if (!hasChromeStorage()) return;

  const saved = await chrome.storage.local.get(null);
  const oldSessionKeys = Object.keys(saved).filter(key =>
    key.startsWith(WATCH_TIMER_SESSION_KEY_PREFIX),
  );
  if (oldSessionKeys.length > 0) await chrome.storage.local.remove(oldSessionKeys);

  const nextHistory = normalizeHistory(history.history);
  const sessions = Array.isArray(history.sessions)
    ? history.sessions
        .map(normalizeSession)
        .filter((session): session is WatchTimerSessionStorage => !!session)
    : [];
  const nextStorage: Record<string, unknown> = {
    [WATCH_TIMER_HISTORY_KEY]: nextHistory,
  };
  const daily = normalizeDailyStorage(history.daily);
  if (daily) nextStorage[WATCH_TIMER_DAILY_KEY] = daily;
  sessions.forEach(session => {
    nextStorage[getWatchTimerSessionKey(session.id)] = session;
  });

  await chrome.storage.local.set(nextStorage);
  await pruneWatchTimerSessions();
}

export async function pruneWatchTimerSessions(todayKey = getTodayKey()): Promise<void> {
  if (!hasChromeStorage()) return;
  if (!isDateKey(todayKey)) return;

  const saved = await chrome.storage.local.get(null);
  const minDate = addDays(parseLocalDateKey(todayKey), -MAX_HISTORY_DAYS + 1).getTime();
  const sessionEntries = Object.entries(saved)
    .map(([key, value]) => ({
      key,
      session: key.startsWith(WATCH_TIMER_SESSION_KEY_PREFIX) ? normalizeSession(value) : undefined,
    }))
    .filter(({ key }) => key.startsWith(WATCH_TIMER_SESSION_KEY_PREFIX));
  const expiredKeys = sessionEntries
    .filter(({ session }) => {
      if (!session) return true;
      return parseLocalDateKey(session.dateKey).getTime() < minDate;
    })
    .map(({ key }) => key);
  const overflowKeys = sessionEntries
    .filter(({ session }) => !!session)
    .sort((left, right) => (right.session?.updatedAt ?? 0) - (left.session?.updatedAt ?? 0))
    .slice(MAX_SESSION_RECORDS)
    .map(({ key }) => key);
  const removableKeys = [...new Set([...expiredKeys, ...overflowKeys])];

  if (removableKeys.length > 0) await chrome.storage.local.remove(removableKeys);
}

function loadLegacyWatchTimerHistory(): Promise<WatchTimerHistory> {
  if (!hasChromeStorage()) return Promise.resolve({});

  return chrome.storage.local
    .get(WATCH_TIMER_HISTORY_KEY)
    .then(saved => normalizeHistory(saved[WATCH_TIMER_HISTORY_KEY]));
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

function normalizeDailyStorage(value: unknown): WatchTimerDailyStorage | undefined {
  if (!value || typeof value !== "object") return undefined;

  const record = value as Partial<WatchTimerDailyStorage>;
  if (typeof record.dateKey !== "string" || !isDateKey(record.dateKey)) return undefined;

  return {
    dateKey: record.dateKey,
    elapsedMs:
      typeof record.elapsedMs === "number" && Number.isFinite(record.elapsedMs)
        ? Math.max(0, Math.floor(record.elapsedMs))
        : 0,
  };
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

function padDate(value: number): string {
  return value.toString().padStart(2, "0");
}

function hasChromeStorage(): boolean {
  return typeof chrome !== "undefined" && !!chrome.storage?.local;
}
