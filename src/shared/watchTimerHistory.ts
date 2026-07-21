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

export type WatchTimerHistory = Record<string, number>;

export type WatchTimerDailyStorage = {
  dateKey: string;
  elapsedMs: number;
};

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
  updatedAt: number;
};

export type WatchTimerVideoDailyItem = WatchTimerVideoHistoryItem & {
  dailyElapsedMs: number;
};

export type WatchTimerHistoryBackup = {
  history: WatchTimerHistory;
  videos: WatchTimerVideoHistoryItem[];
};

const MAX_HISTORY_DAYS = 370;
const MAX_RECORDS = 5000;
const MAX_RECENT_VIDEOS = 100;
const WATCH_TIMER_SESSION_MIN_MS = 1000;

export async function loadWatchTimerDaily(): Promise<WatchTimerDailyStorage> {
  const dateKey = getTodayKey();
  return { dateKey, elapsedMs: await getWatchTimerDailyElapsed(dateKey) };
}

export async function getWatchTimerHistory(): Promise<WatchTimerHistory> {
  if (!hasChromeLocalStorage()) return {};

  const dateKeys = await loadDateIndex();
  const [dailyTotals, sessionsByDate] = await Promise.all([
    loadDailyTotals(dateKeys),
    loadSessionsByDate(dateKeys),
  ]);

  return Object.fromEntries(
    dateKeys.map(dateKey => [
      dateKey,
      dailyTotals[dateKey] > 0 ? dailyTotals[dateKey] : sumElapsed(sessionsByDate[dateKey] ?? []),
    ]),
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
  const videosByDate = await loadVideosByDate(dateKeys);
  return dateKeys.flatMap(dateKey => videosByDate[dateKey] ?? []);
}

export async function saveWatchTimerSession(session: WatchTimerSessionStorage): Promise<void> {
  if (!hasChromeLocalStorage()) return;
  const normalized = normalizeSession(session);
  if (!normalized || normalized.elapsedMs < WATCH_TIMER_SESSION_MIN_MS) return;
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
  if (!hasChromeLocalStorage() || !pageKey || !isDateKey(dateKey)) return 0;
  const sessions = await loadSessionsForDate(dateKey);
  return sumElapsed(sessions.filter(session => session.pageKey === pageKey));
}

export async function getTopWatchTimerVideosForDate(
  dateKey: string,
  limit = 3,
): Promise<WatchTimerVideoDailyItem[]> {
  if (!hasChromeLocalStorage() || !isDateKey(dateKey)) return [];
  const [videosByDate, sessions] = await Promise.all([
    loadVideosByDate([dateKey]),
    loadSessionsForDate(dateKey),
  ]);
  const elapsedByPageKey = new Map<string, number>();
  sessions.forEach(session => {
    elapsedByPageKey.set(
      session.pageKey,
      (elapsedByPageKey.get(session.pageKey) ?? 0) + session.elapsedMs,
    );
  });

  return (videosByDate[dateKey] ?? [])
    .map(video => ({
      ...video,
      dailyElapsedMs: elapsedByPageKey.get(video.pageKey) ?? 0,
    }))
    .sort(
      (left, right) =>
        right.dailyElapsedMs - left.dailyElapsedMs || right.updatedAt - left.updatedAt,
    )
    .slice(0, Math.max(0, limit));
}

async function getWatchTimerDailyElapsed(dateKey: string): Promise<number> {
  if (!hasChromeLocalStorage() || !isDateKey(dateKey)) return 0;
  const dailyTotalKey = getDailyTotalKey(dateKey);
  const [total, sessions] = await Promise.all([
    chrome.storage.local.get(dailyTotalKey),
    loadSessionsForDate(dateKey),
  ]);
  const dailyTotal = normalizeElapsed(total[dailyTotalKey]);
  return dailyTotal > 0 ? dailyTotal : sumElapsed(sessions);
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
  if (!normalized || normalized.elapsedMs < WATCH_TIMER_SESSION_MIN_MS) return;

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
  const previousDailyTotal = normalizeElapsed(saved[getDailyTotalKey(normalized.dateKey)]);
  const sessionDelta = Math.max(0, normalized.elapsedMs - (previousSession?.elapsedMs ?? 0));

  await chrome.storage.local.set({
    [sessionKey]: normalized,
    [videoKey]: video,
    [getDailyTotalKey(normalized.dateKey)]: previousDailyTotal + sessionDelta,
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

  Object.entries(history).forEach(([dateKey, elapsedMs]) => {
    nextStorage[getDailyTotalKey(dateKey)] = elapsedMs;
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
    dateKeys.map(dateKey => [dateKey, normalizeElapsed(saved[getDailyTotalKey(dateKey)])]),
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
  return {
    id: record.id,
    pageKey: record.pageKey,
    title: normalizeTitle(record.title, record.pageKey),
    url: typeof record.url === "string" ? record.url : "",
    dateKey: record.dateKey,
    elapsedMs: normalizeElapsed(record.elapsedMs),
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
      .map(([dateKey, elapsedMs]) => [dateKey, normalizeElapsed(elapsedMs)]),
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
  if (!response) throw new Error("后台服务不可用，观看历史未写入");
  if (!response.ok) throw new Error(response.error);
}

function appendUnique(values: string[], next: string): string[] {
  return values.includes(next) ? values : [...values, next];
}

function sortDateKeys(values: string[]): string[] {
  return [...new Set(values.filter(isDateKey))].sort();
}

function sumElapsed(sessions: WatchTimerSessionStorage[]): number {
  return sessions.reduce((total, session) => total + session.elapsedMs, 0);
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
