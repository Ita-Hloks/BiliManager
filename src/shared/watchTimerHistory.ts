import { addDays, getTodayKey, isDateKey, parseLocalDateKey } from "./date";
import { hasChromeLocalStorage } from "./chromeStorage";
import { sendMessage } from "./messaging";

export const WATCH_TIMER_SESSION_KEY_PREFIX = "biliManager.watchTimer.session:";
export const WATCH_TIMER_SESSION_INDEX_KEY_PREFIX = "biliManager.watchTimer.sessionIndex:";
export const WATCH_TIMER_DAILY_TOTAL_KEY_PREFIX = "biliManager.watchTimer.dailyTotal:";
export const WATCH_TIMER_VIDEO_KEY_PREFIX = "biliManager.watchTimer.video:";
export const WATCH_TIMER_VIDEO_INDEX_KEY_PREFIX = "biliManager.watchTimer.videoIndex:";
export const WATCH_TIMER_DATE_INDEX_KEY = "biliManager.watchTimer.dateIndex";
export const WATCH_TIMER_RECENT_VIDEOS_KEY = "biliManager.watchTimer.recentVideos";

export type WatchTimerDurationBreakdown = {
  elapsedMs: number;
  foregroundElapsedMs: number;
  backgroundElapsedMs: number;
};

export type WatchTimerHistory = Record<string, WatchTimerDurationBreakdown>;

export type WatchTimerDailyStorage = WatchTimerDurationBreakdown & {
  dateKey: string;
};

export type WatchTimerSessionStorage = WatchTimerDurationBreakdown & {
  id: string;
  pageKey: string;
  title: string;
  url: string;
  dateKey: string;
  updatedAt: number;
};

export type WatchTimerVideoHistoryItem = {
  pageKey: string;
  title: string;
  url: string;
  dateKey: string;
  updatedAt: number;
};

export type WatchTimerVideoDailyItem = WatchTimerVideoHistoryItem & {
  dailyElapsedMs: number;
  dailyForegroundElapsedMs: number;
  dailyBackgroundElapsedMs: number;
};

type WatchTimerVideoSortMode = "total" | "foreground" | "background";

export type WatchTimerHistoryBackup = {
  history: WatchTimerHistory;
  videos: WatchTimerVideoHistoryItem[];
};

const MAX_HISTORY_DAYS = 370;
const MAX_RECORDS = 5000;
const MAX_RECENT_VIDEOS = 100;
export const WATCH_TIMER_SESSION_MIN_MS = 3_000;

export async function loadWatchTimerDaily(): Promise<WatchTimerDailyStorage> {
  const dateKey = getTodayKey();
  return { dateKey, ...(await getWatchTimerDailyElapsed(dateKey)) };
}

export async function getWatchTimerHistory(): Promise<WatchTimerHistory> {
  if (!hasChromeLocalStorage()) return {};

  const dateKeys = await loadDateIndex();
  const [dailyTotals, sessionsByDate] = await Promise.all([
    loadDailyTotals(dateKeys),
    loadSessionsByDate(dateKeys),
  ]);

  return Object.fromEntries(
    dateKeys.map(dateKey => {
      const sessions = sessionsByDate[dateKey] ?? [];
      const elapsed =
        sessions.length > 0
          ? sumDurationBreakdown(sessions)
          : getRecordableDurationBreakdown(dailyTotals[dateKey]);
      return [dateKey, elapsed];
    }),
  );
}

export async function getRecentWatchTimerVideos(limit = 5): Promise<WatchTimerVideoHistoryItem[]> {
  if (!hasChromeLocalStorage()) return [];
  const saved = await chrome.storage.local.get(WATCH_TIMER_RECENT_VIDEOS_KEY);
  return normalizeVideoList(saved[WATCH_TIMER_RECENT_VIDEOS_KEY]).slice(0, Math.max(0, limit));
}

export async function getWatchTimerVideos(): Promise<WatchTimerVideoHistoryItem[]> {
  if (!hasChromeLocalStorage()) return [];
  const dateKeys = await loadDateIndex();
  const [videosByDate, sessionsByDate] = await Promise.all([
    loadVideosByDate(dateKeys),
    loadSessionsByDate(dateKeys),
  ]);
  return dateKeys.flatMap(dateKey => {
    const videos = videosByDate[dateKey] ?? [];
    const sessions = sessionsByDate[dateKey] ?? [];
    if (sessions.length === 0) return videos;
    const recordablePageKeys = new Set(
      sessions.filter(isRecordableSession).map(session => session.pageKey),
    );
    return videos.filter(video => recordablePageKeys.has(video.pageKey));
  });
}

export async function saveWatchTimerSession(session: WatchTimerSessionStorage): Promise<void> {
  if (!hasChromeLocalStorage()) return;
  const normalized = normalizeSession(session);
  if (!normalized || normalized.elapsedMs <= WATCH_TIMER_SESSION_MIN_MS) return;
  const response = await sendMessage({
    type: "BILI_FILTER_SAVE_WATCH_SESSION",
    payload: normalized,
  });
  assertMutationSucceeded(response);
}

export async function getWatchTimerVideoDailyElapsed(
  pageKey: string,
  dateKey = getTodayKey(),
): Promise<number> {
  return (await getWatchTimerVideoDailyBreakdown(pageKey, dateKey)).elapsedMs;
}

export async function getWatchTimerVideoDailyBreakdown(
  pageKey: string,
  dateKey = getTodayKey(),
): Promise<WatchTimerDurationBreakdown> {
  if (!hasChromeLocalStorage() || !pageKey || !isDateKey(dateKey)) {
    return createEmptyDurationBreakdown();
  }
  const sessions = await loadSessionsForDate(dateKey);
  return sumDurationBreakdown(sessions.filter(session => session.pageKey === pageKey));
}

export async function getTopWatchTimerVideosForDate(
  dateKey: string,
  limit = 3,
  sortMode: WatchTimerVideoSortMode = "total",
): Promise<WatchTimerVideoDailyItem[]> {
  if (!hasChromeLocalStorage() || !isDateKey(dateKey)) return [];
  const [videosByDate, sessions] = await Promise.all([
    loadVideosByDate([dateKey]),
    loadSessionsForDate(dateKey),
  ]);
  const elapsedByPageKey = new Map<string, WatchTimerDurationBreakdown>();
  sessions.filter(isRecordableSession).forEach(session => {
    elapsedByPageKey.set(
      session.pageKey,
      addDurationBreakdown(
        elapsedByPageKey.get(session.pageKey) ?? createEmptyDurationBreakdown(),
        session,
      ),
    );
  });

  return (videosByDate[dateKey] ?? [])
    .map(video => {
      const elapsed = elapsedByPageKey.get(video.pageKey) ?? createEmptyDurationBreakdown();
      return {
        ...video,
        dailyElapsedMs: elapsed.elapsedMs,
        dailyForegroundElapsedMs: elapsed.foregroundElapsedMs,
        dailyBackgroundElapsedMs: elapsed.backgroundElapsedMs,
      };
    })
    .filter(video => getVideoDurationForMode(video, sortMode) > WATCH_TIMER_SESSION_MIN_MS)
    .sort(
      (left, right) =>
        getVideoDurationForMode(right, sortMode) - getVideoDurationForMode(left, sortMode) ||
        right.updatedAt - left.updatedAt,
    )
    .slice(0, Math.max(0, limit));
}

function getVideoDurationForMode(
  video: WatchTimerVideoDailyItem,
  sortMode: WatchTimerVideoSortMode,
): number {
  if (sortMode === "foreground") return video.dailyForegroundElapsedMs;
  if (sortMode === "background") return video.dailyBackgroundElapsedMs;
  return video.dailyElapsedMs;
}

async function getWatchTimerDailyElapsed(dateKey: string): Promise<WatchTimerDurationBreakdown> {
  if (!hasChromeLocalStorage() || !isDateKey(dateKey)) return createEmptyDurationBreakdown();
  const dailyTotalKey = getDailyTotalKey(dateKey);
  const [total, sessions] = await Promise.all([
    chrome.storage.local.get(dailyTotalKey),
    loadSessionsForDate(dateKey),
  ]);
  const dailyTotal = normalizeDurationBreakdown(total[dailyTotalKey]);
  return sessions.length > 0
    ? sumDurationBreakdown(sessions)
    : getRecordableDurationBreakdown(dailyTotal);
}

export async function exportWatchTimerHistory(): Promise<WatchTimerHistoryBackup> {
  if (!hasChromeLocalStorage()) return { history: {}, videos: [] };
  const [history, videos] = await Promise.all([getWatchTimerHistory(), getWatchTimerVideos()]);
  return { history, videos };
}

export async function importWatchTimerHistory(history: WatchTimerHistoryBackup): Promise<void> {
  if (!hasChromeLocalStorage()) return;
  const response = await sendMessage({
    type: "BILI_FILTER_REPLACE_WATCH_HISTORY",
    payload: history,
  });
  assertMutationSucceeded(response);
}

export async function pruneWatchTimerSessions(todayKey = getTodayKey()): Promise<void> {
  if (!hasChromeLocalStorage() || !isDateKey(todayKey)) return;
  const response = await sendMessage({
    type: "BILI_FILTER_PRUNE_WATCH_HISTORY",
    payload: { todayKey },
  });
  assertMutationSucceeded(response);
}

export async function writeWatchTimerSession(session: WatchTimerSessionStorage): Promise<void> {
  if (!hasChromeLocalStorage()) return;
  const normalized = normalizeSession(session);
  if (!normalized || normalized.elapsedMs <= WATCH_TIMER_SESSION_MIN_MS) return;

  const sessionKey = getSessionKey(normalized.dateKey, normalized.id);
  const sessionIndexKey = getSessionIndexKey(normalized.dateKey);
  const videoKey = getVideoKey(normalized.dateKey, normalized.pageKey);
  const videoIndexKey = getVideoIndexKey(normalized.dateKey);
  const saved = await chrome.storage.local.get([
    sessionIndexKey,
    videoIndexKey,
    sessionKey,
    getDailyTotalKey(normalized.dateKey),
    WATCH_TIMER_DATE_INDEX_KEY,
    WATCH_TIMER_RECENT_VIDEOS_KEY,
  ]);
  const video = toVideoRecord(normalized);
  const previousSession = normalizeSession(saved[sessionKey]);
  const previousDailyTotal = normalizeDurationBreakdown(
    saved[getDailyTotalKey(normalized.dateKey)],
  );
  const sessionDelta = subtractDurationBreakdown(
    normalized,
    previousSession ?? createEmptyDurationBreakdown(),
  );

  await chrome.storage.local.set({
    [sessionKey]: normalized,
    [videoKey]: video,
    [getDailyTotalKey(normalized.dateKey)]: addDurationBreakdown(previousDailyTotal, sessionDelta),
  });
  await chrome.storage.local.set({
    [sessionIndexKey]: appendUnique(normalizeKeyList(saved[sessionIndexKey]), sessionKey),
    [videoIndexKey]: appendUnique(normalizeKeyList(saved[videoIndexKey]), videoKey),
    [WATCH_TIMER_DATE_INDEX_KEY]: sortDateKeys([
      ...normalizeDateIndex(saved[WATCH_TIMER_DATE_INDEX_KEY]),
      normalized.dateKey,
    ]),
    [WATCH_TIMER_RECENT_VIDEOS_KEY]: updateRecentVideos(
      normalizeVideoList(saved[WATCH_TIMER_RECENT_VIDEOS_KEY]),
      video,
    ),
  });
}

export async function replaceWatchTimerHistory(backup: WatchTimerHistoryBackup): Promise<void> {
  if (!hasChromeLocalStorage()) return;
  await clearIndexedHistory();

  const history = normalizeHistory(backup.history);
  const videos = backup.videos
    .map(normalizeVideoRecord)
    .filter((record): record is WatchTimerVideoHistoryItem => !!record);
  const dateKeys = sortDateKeys([...Object.keys(history), ...videos.map(video => video.dateKey)]);
  const nextStorage: Record<string, unknown> = {
    [WATCH_TIMER_DATE_INDEX_KEY]: dateKeys,
    [WATCH_TIMER_RECENT_VIDEOS_KEY]: videos
      .sort((left, right) => right.updatedAt - left.updatedAt)
      .slice(0, MAX_RECENT_VIDEOS),
  };

  Object.entries(history).forEach(([dateKey, breakdown]) => {
    nextStorage[getDailyTotalKey(dateKey)] = breakdown;
  });
  dateKeys.forEach(dateKey => {
    const dateVideos = deduplicateVideos(videos.filter(video => video.dateKey === dateKey));
    const videoKeys = dateVideos.map(video => getVideoKey(dateKey, video.pageKey));
    nextStorage[getVideoIndexKey(dateKey)] = videoKeys;
    dateVideos.forEach((video, index) => {
      nextStorage[videoKeys[index]] = video;
    });
  });

  await chrome.storage.local.set(nextStorage);
  await pruneIndexedWatchTimerHistory();
}

export async function pruneIndexedWatchTimerHistory(todayKey = getTodayKey()): Promise<void> {
  if (!hasChromeLocalStorage() || !isDateKey(todayKey)) return;
  const dateKeys = await loadDateIndex();
  const minDate = addDays(parseLocalDateKey(todayKey), -MAX_HISTORY_DAYS + 1).getTime();
  const expiredDates = dateKeys.filter(dateKey => parseLocalDateKey(dateKey).getTime() < minDate);
  let retainedDates = dateKeys.filter(dateKey => !expiredDates.includes(dateKey));
  const indices = await loadIndices(dateKeys);
  const removalKeys = expiredDates.flatMap(dateKey => getDateStorageKeys(dateKey, indices));

  let recordCount = retainedDates.reduce(
    (total, dateKey) =>
      total +
      (indices.sessionKeys[dateKey]?.length ?? 0) +
      (indices.videoKeys[dateKey]?.length ?? 0),
    0,
  );
  while (recordCount > MAX_RECORDS && retainedDates.length > 0) {
    const oldestDate = retainedDates[0];
    const dateKeysToRemove = getDateStorageKeys(oldestDate, indices);
    removalKeys.push(...dateKeysToRemove);
    recordCount -= dateKeysToRemove.length - 3;
    retainedDates = retainedDates.slice(1);
  }

  if (removalKeys.length > 0) await chrome.storage.local.remove([...new Set(removalKeys)]);
  const recent = await getRecentWatchTimerVideos(MAX_RECENT_VIDEOS);
  await chrome.storage.local.set({
    [WATCH_TIMER_DATE_INDEX_KEY]: retainedDates,
    [WATCH_TIMER_RECENT_VIDEOS_KEY]: recent.filter(video => retainedDates.includes(video.dateKey)),
  });
}

async function clearIndexedHistory(): Promise<void> {
  const dateKeys = await loadDateIndex();
  const indices = await loadIndices(dateKeys);
  const keys = dateKeys.flatMap(dateKey => getDateStorageKeys(dateKey, indices));
  await chrome.storage.local.remove([
    ...keys,
    WATCH_TIMER_DATE_INDEX_KEY,
    WATCH_TIMER_RECENT_VIDEOS_KEY,
  ]);
}

async function loadDateIndex(): Promise<string[]> {
  const saved = await chrome.storage.local.get(WATCH_TIMER_DATE_INDEX_KEY);
  return normalizeDateIndex(saved[WATCH_TIMER_DATE_INDEX_KEY]);
}

async function loadSessionsForDate(dateKey: string): Promise<WatchTimerSessionStorage[]> {
  const indexKey = getSessionIndexKey(dateKey);
  const index = await chrome.storage.local.get(indexKey);
  const keys = normalizeKeyList(index[indexKey]);
  if (keys.length === 0) return [];
  const saved = await chrome.storage.local.get(keys);
  return keys
    .map(key => normalizeSession(saved[key]))
    .filter((session): session is WatchTimerSessionStorage => !!session);
}

async function loadSessionsByDate(
  dateKeys: string[],
): Promise<Record<string, WatchTimerSessionStorage[]>> {
  const indices = await loadIndices(dateKeys);
  const keys = dateKeys.flatMap(dateKey => indices.sessionKeys[dateKey] ?? []);
  const saved = keys.length > 0 ? await chrome.storage.local.get(keys) : {};
  return Object.fromEntries(
    dateKeys.map(dateKey => [
      dateKey,
      (indices.sessionKeys[dateKey] ?? [])
        .map(key => normalizeSession(saved[key]))
        .filter((session): session is WatchTimerSessionStorage => !!session),
    ]),
  );
}

async function loadVideosByDate(
  dateKeys: string[],
): Promise<Record<string, WatchTimerVideoHistoryItem[]>> {
  const indices = await loadIndices(dateKeys);
  const keys = dateKeys.flatMap(dateKey => indices.videoKeys[dateKey] ?? []);
  const saved = keys.length > 0 ? await chrome.storage.local.get(keys) : {};
  return Object.fromEntries(
    dateKeys.map(dateKey => [
      dateKey,
      (indices.videoKeys[dateKey] ?? [])
        .map(key => normalizeVideoRecord(saved[key]))
        .filter((video): video is WatchTimerVideoHistoryItem => !!video),
    ]),
  );
}

async function loadDailyTotals(dateKeys: string[]): Promise<WatchTimerHistory> {
  const keys = dateKeys.map(getDailyTotalKey);
  const saved = keys.length > 0 ? await chrome.storage.local.get(keys) : {};
  return Object.fromEntries(
    dateKeys.map(dateKey => [
      dateKey,
      normalizeDurationBreakdown(saved[getDailyTotalKey(dateKey)]),
    ]),
  );
}

async function loadIndices(dateKeys: string[]): Promise<{
  sessionKeys: Record<string, string[]>;
  videoKeys: Record<string, string[]>;
}> {
  const keys = dateKeys.flatMap(dateKey => [
    getSessionIndexKey(dateKey),
    getVideoIndexKey(dateKey),
  ]);
  const saved = keys.length > 0 ? await chrome.storage.local.get(keys) : {};
  return {
    sessionKeys: Object.fromEntries(
      dateKeys.map(dateKey => [dateKey, normalizeKeyList(saved[getSessionIndexKey(dateKey)])]),
    ),
    videoKeys: Object.fromEntries(
      dateKeys.map(dateKey => [dateKey, normalizeKeyList(saved[getVideoIndexKey(dateKey)])]),
    ),
  };
}

function getDateStorageKeys(
  dateKey: string,
  indices: { sessionKeys: Record<string, string[]>; videoKeys: Record<string, string[]> },
): string[] {
  return [
    ...(indices.sessionKeys[dateKey] ?? []),
    ...(indices.videoKeys[dateKey] ?? []),
    getSessionIndexKey(dateKey),
    getVideoIndexKey(dateKey),
    getDailyTotalKey(dateKey),
  ];
}

function normalizeSession(value: unknown): WatchTimerSessionStorage | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Partial<WatchTimerSessionStorage>;
  if (typeof record.id !== "string" || !record.id) return undefined;
  if (typeof record.pageKey !== "string" || !record.pageKey) return undefined;
  if (typeof record.dateKey !== "string" || !isDateKey(record.dateKey)) return undefined;
  if (typeof record.updatedAt !== "number" || !Number.isFinite(record.updatedAt)) return undefined;
  const breakdown = normalizeDurationBreakdown(record);
  return {
    id: record.id,
    pageKey: record.pageKey,
    title: normalizeTitle(record.title, record.pageKey),
    url: typeof record.url === "string" ? record.url : "",
    dateKey: record.dateKey,
    elapsedMs: breakdown.elapsedMs,
    foregroundElapsedMs: breakdown.foregroundElapsedMs,
    backgroundElapsedMs: breakdown.backgroundElapsedMs,
    updatedAt: Math.max(0, Math.floor(record.updatedAt)),
  };
}

function normalizeVideoRecord(value: unknown): WatchTimerVideoHistoryItem | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Partial<WatchTimerVideoHistoryItem>;
  if (typeof record.pageKey !== "string" || !record.pageKey) return undefined;
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

function normalizeVideoList(value: unknown): WatchTimerVideoHistoryItem[] {
  return Array.isArray(value)
    ? value
        .map(normalizeVideoRecord)
        .filter((video): video is WatchTimerVideoHistoryItem => !!video)
        .sort((left, right) => right.updatedAt - left.updatedAt)
    : [];
}

function normalizeHistory(value: unknown): WatchTimerHistory {
  if (!value || typeof value !== "object") return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([dateKey]) => isDateKey(dateKey))
      .map(([dateKey, elapsedMs]) => ({
        dateKey,
        breakdown: normalizeDurationBreakdown(elapsedMs),
      }))
      .filter(({ breakdown }) => breakdown.elapsedMs > WATCH_TIMER_SESSION_MIN_MS)
      .map(({ dateKey, breakdown }) => [dateKey, breakdown] as const),
  );
}

function normalizeDateIndex(value: unknown): string[] {
  return sortDateKeys(Array.isArray(value) ? value.filter(isDateKey) : []);
}

function normalizeKeyList(value: unknown): string[] {
  return Array.isArray(value)
    ? [...new Set(value.filter((key): key is string => typeof key === "string" && !!key))]
    : [];
}

function normalizeElapsed(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

function normalizeDurationBreakdown(value: unknown): WatchTimerDurationBreakdown {
  if (typeof value === "number") {
    const elapsedMs = normalizeElapsed(value);
    return {
      elapsedMs,
      foregroundElapsedMs: elapsedMs,
      backgroundElapsedMs: 0,
    };
  }

  if (!value || typeof value !== "object") return createEmptyDurationBreakdown();

  const record = value as Partial<WatchTimerDurationBreakdown>;
  const elapsedMs = normalizeElapsed(record.elapsedMs);
  const hasForeground = typeof record.foregroundElapsedMs === "number";
  const hasBackground = typeof record.backgroundElapsedMs === "number";
  let foregroundElapsedMs = hasForeground
    ? normalizeElapsed(record.foregroundElapsedMs)
    : undefined;
  let backgroundElapsedMs = hasBackground
    ? normalizeElapsed(record.backgroundElapsedMs)
    : undefined;

  if (foregroundElapsedMs === undefined && backgroundElapsedMs === undefined) {
    foregroundElapsedMs = elapsedMs;
    backgroundElapsedMs = 0;
  } else if (foregroundElapsedMs === undefined) {
    backgroundElapsedMs = Math.min(backgroundElapsedMs ?? 0, elapsedMs);
    foregroundElapsedMs = elapsedMs - backgroundElapsedMs;
  } else if (backgroundElapsedMs === undefined) {
    foregroundElapsedMs = Math.min(foregroundElapsedMs, elapsedMs);
    backgroundElapsedMs = elapsedMs - foregroundElapsedMs;
  }

  foregroundElapsedMs = Math.min(foregroundElapsedMs ?? 0, elapsedMs);
  backgroundElapsedMs = Math.min(backgroundElapsedMs ?? 0, elapsedMs);
  const componentTotal = foregroundElapsedMs + backgroundElapsedMs;

  if (componentTotal > elapsedMs) {
    const overflow = componentTotal - elapsedMs;
    const foregroundReduction = Math.min(foregroundElapsedMs, overflow);
    foregroundElapsedMs -= foregroundReduction;
    backgroundElapsedMs = Math.max(0, backgroundElapsedMs - (overflow - foregroundReduction));
  } else if (componentTotal < elapsedMs) {
    foregroundElapsedMs += elapsedMs - componentTotal;
  }

  return {
    elapsedMs,
    foregroundElapsedMs,
    backgroundElapsedMs,
  };
}

export function normalizeWatchTimerDurationBreakdown(value: unknown): WatchTimerDurationBreakdown {
  return normalizeDurationBreakdown(value);
}

function createEmptyDurationBreakdown(): WatchTimerDurationBreakdown {
  return {
    elapsedMs: 0,
    foregroundElapsedMs: 0,
    backgroundElapsedMs: 0,
  };
}

export function createEmptyWatchTimerDurationBreakdown(): WatchTimerDurationBreakdown {
  return createEmptyDurationBreakdown();
}

function addDurationBreakdown(
  left: WatchTimerDurationBreakdown,
  right: WatchTimerDurationBreakdown,
): WatchTimerDurationBreakdown {
  return normalizeDurationBreakdown({
    elapsedMs: left.elapsedMs + right.elapsedMs,
    foregroundElapsedMs: left.foregroundElapsedMs + right.foregroundElapsedMs,
    backgroundElapsedMs: left.backgroundElapsedMs + right.backgroundElapsedMs,
  });
}

function subtractDurationBreakdown(
  next: WatchTimerDurationBreakdown,
  previous: WatchTimerDurationBreakdown,
): WatchTimerDurationBreakdown {
  return normalizeDurationBreakdown({
    elapsedMs: Math.max(0, next.elapsedMs - previous.elapsedMs),
    foregroundElapsedMs: Math.max(0, next.foregroundElapsedMs - previous.foregroundElapsedMs),
    backgroundElapsedMs: Math.max(0, next.backgroundElapsedMs - previous.backgroundElapsedMs),
  });
}

function normalizeTitle(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  return value.replace(/[_-]?哔哩哔哩.*$/u, "").trim() || fallback;
}

function toVideoRecord(session: WatchTimerSessionStorage): WatchTimerVideoHistoryItem {
  return {
    pageKey: session.pageKey,
    title: session.title,
    url: session.url,
    dateKey: session.dateKey,
    updatedAt: session.updatedAt,
  };
}

function updateRecentVideos(
  videos: WatchTimerVideoHistoryItem[],
  next: WatchTimerVideoHistoryItem,
): WatchTimerVideoHistoryItem[] {
  return [next, ...videos.filter(video => video.pageKey !== next.pageKey)]
    .sort((left, right) => right.updatedAt - left.updatedAt)
    .slice(0, MAX_RECENT_VIDEOS);
}

function deduplicateVideos(videos: WatchTimerVideoHistoryItem[]): WatchTimerVideoHistoryItem[] {
  return videos
    .sort((left, right) => right.updatedAt - left.updatedAt)
    .filter(
      (video, index, values) =>
        values.findIndex(candidate => candidate.pageKey === video.pageKey) === index,
    );
}

function assertMutationSucceeded(
  response: Awaited<ReturnType<typeof sendMessage>>,
): asserts response is Exclude<typeof response, null> {
  if (!response) throw new Error("后台服务未返回观看历史写入响应");
  if (!response.ok) throw new Error(response.error);
}

function appendUnique(values: string[], next: string): string[] {
  return values.includes(next) ? values : [...values, next];
}

function sortDateKeys(values: string[]): string[] {
  return [...new Set(values.filter(isDateKey))].sort();
}

function sumDurationBreakdown(sessions: WatchTimerSessionStorage[]): WatchTimerDurationBreakdown {
  return sessions
    .filter(isRecordableSession)
    .reduce(addDurationBreakdown, createEmptyDurationBreakdown());
}

function isRecordableSession(session: WatchTimerSessionStorage): boolean {
  return session.elapsedMs > WATCH_TIMER_SESSION_MIN_MS;
}

function getRecordableDurationBreakdown(
  breakdown: WatchTimerDurationBreakdown,
): WatchTimerDurationBreakdown {
  return breakdown.elapsedMs > WATCH_TIMER_SESSION_MIN_MS
    ? breakdown
    : createEmptyDurationBreakdown();
}

function getSessionKey(dateKey: string, id: string): string {
  return `${WATCH_TIMER_SESSION_KEY_PREFIX}${dateKey}:${encodeURIComponent(id)}`;
}

function getSessionIndexKey(dateKey: string): string {
  return `${WATCH_TIMER_SESSION_INDEX_KEY_PREFIX}${dateKey}`;
}

function getDailyTotalKey(dateKey: string): string {
  return `${WATCH_TIMER_DAILY_TOTAL_KEY_PREFIX}${dateKey}`;
}

function getVideoKey(dateKey: string, pageKey: string): string {
  return `${WATCH_TIMER_VIDEO_KEY_PREFIX}${dateKey}:${encodeURIComponent(pageKey)}`;
}

function getVideoIndexKey(dateKey: string): string {
  return `${WATCH_TIMER_VIDEO_INDEX_KEY_PREFIX}${dateKey}`;
}
