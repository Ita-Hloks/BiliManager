import { getTodayKey } from "../../shared/date";
import { getSettings, saveSettings } from "../../shared/storage";
import type { WatchTimerSettings } from "../../shared/types";
import {
  getWatchTimerVideoDailyElapsed,
  loadWatchTimerDaily,
  pruneWatchTimerSessions,
  saveWatchTimerSession,
  WATCH_TIMER_DAILY_TOTAL_KEY_PREFIX,
  WATCH_TIMER_DATE_INDEX_KEY,
  WATCH_TIMER_SESSION_KEY_PREFIX,
} from "../../shared/watchTimerHistory";
import {
  loadActiveSession,
  loadTimerPosition,
  saveActiveSession as saveActiveSessionStorage,
  saveTimerPosition,
} from "./storage";
import { WatchTimerState } from "./state";
import { WatchTimerView } from "./view";

const ACTIVE_SESSION_SAVE_INTERVAL_MS = 1000;
const SESSION_SAVE_INTERVAL_MS = 1000;
const SESSION_RECORD_MIN_MS = 1000;
const STORED_TOTALS_SYNC_DELAY_MS = 300;
const SESSION_PRUNE_INTERVAL_MS = 60_000;

const state = new WatchTimerState();
const view = new WatchTimerView(
  position => void saveTimerPosition(position),
  () => void disableWatchTimer(),
);

let tickTimer: number | undefined;
let storedTotalsSyncTimer: number | undefined;
let persistentReady = false;
let persistentLoadId = 0;
let storedTotalsLoadId = 0;
let lastDailySaveAt = 0;
let lastActiveSessionSaveAt = 0;
let lastSessionPruneAt = 0;

async function disableWatchTimer(): Promise<void> {
  const settings = await getSettings();
  if (!settings.features.watchTimer) return;
  await saveSettings({
    ...settings,
    features: {
      ...settings.features,
      watchTimer: false,
    },
  });
}

export function applyPlayerWatchTimer(enabled: boolean, settings: WatchTimerSettings): void {
  if (!enabled || !isWatchTimerPlayerPage()) {
    destroyPlayerWatchTimer();
    return;
  }

  const mounted = view.mount();
  if (mounted) {
    bindLifecycleEvents();
    void loadPersistentState();
  }
  view.setOpacity(settings.opacity);
  syncPageTimer();
  startTicker();
}

export function destroyPlayerWatchTimer(): void {
  if (!view.mounted) return;

  state.commit();
  void saveActiveSession(false);
  void saveDailyTimer(false);
  stopTicker();
  window.clearTimeout(storedTotalsSyncTimer);
  storedTotalsSyncTimer = undefined;
  unbindLifecycleEvents();
  view.unmount();
  state.reset();
  persistentReady = false;
  persistentLoadId += 1;
  storedTotalsLoadId += 1;
  lastDailySaveAt = 0;
  lastActiveSessionSaveAt = 0;
}

async function loadPersistentState(): Promise<void> {
  const loadId = ++persistentLoadId;
  const pageKey = getCurrentPageKey();
  const [position, daily, videoElapsedMs, activeSession] = await Promise.all([
    loadTimerPosition(),
    loadWatchTimerDaily(),
    getWatchTimerVideoDailyElapsed(pageKey, state.dateKey),
    loadActiveSession(),
    pruneWatchTimerSessions(),
  ]);

  if (loadId !== persistentLoadId || !view.mounted || pageKey !== state.pageKey) return;

  view.applyPosition(position);
  state.hydrate(pageKey, daily.dateKey, videoElapsedMs, daily.elapsedMs, activeSession);
  persistentReady = true;
  lastDailySaveAt = 0;
  lastActiveSessionSaveAt = 0;
  renderTime();
}

function bindLifecycleEvents(): void {
  window.addEventListener("focus", syncWindowFocusTiming);
  window.addEventListener("pagehide", flushPageTiming);
  document.addEventListener("visibilitychange", syncVisibilityTiming);
  chrome.storage?.onChanged.addListener(syncTimerStorageChange);
}

function unbindLifecycleEvents(): void {
  window.removeEventListener("focus", syncWindowFocusTiming);
  window.removeEventListener("pagehide", flushPageTiming);
  document.removeEventListener("visibilitychange", syncVisibilityTiming);
  chrome.storage?.onChanged.removeListener(syncTimerStorageChange);
}

function startTicker(): void {
  if (tickTimer) return;
  tickTimer = window.setInterval(updateTimer, 1000);
  updateTimer();
}

function stopTicker(): void {
  window.clearInterval(tickTimer);
  tickTimer = undefined;
}

function syncPageTimer(): void {
  syncTodayBoundary();
  const nextPageKey = getCurrentPageKey();
  if (nextPageKey === state.pageKey) return;

  state.commit();
  void saveActiveSession(false);
  void saveDailyTimer(false);
  state.switchPage(nextPageKey, isVideoActivelyPlaying());
  void syncStoredTimerTotals();
  lastActiveSessionSaveAt = 0;
  renderTime();
}

function syncVisibilityTiming(): void {
  syncTodayBoundary();
  if (document.visibilityState === "visible") void syncStoredTimerTotals();
  syncPlaybackTiming();
  renderTime();
}

function syncWindowFocusTiming(): void {
  syncTodayBoundary();
  void syncStoredTimerTotals();
  syncPlaybackTiming();
  renderTime();
}

function flushPageTiming(): void {
  state.commit();
  void saveActiveSession(false);
  void saveDailyTimer(false);
}

function syncPlaybackTiming(): void {
  syncTodayBoundary();
  const shouldCount = document.visibilityState === "visible" && isVideoActivelyPlaying();
  if (!state.setCounting(shouldCount)) return;

  if (!shouldCount) {
    void saveActiveSession(false);
    void saveDailyTimer(false);
  }
}

function updateTimer(): void {
  syncPlaybackTiming();
  renderTime();
  void saveActiveSession(true);
  void saveDailyTimer(true);
}

function renderTime(): void {
  view.setTime(state.getElapsedMs(), state.getTodayElapsedMs());
}

async function saveActiveSession(throttle: boolean): Promise<void> {
  if (!persistentReady || !state.pageKey) return;
  const now = Date.now();
  if (throttle && now - lastActiveSessionSaveAt < ACTIVE_SESSION_SAVE_INTERVAL_MS) return;

  lastActiveSessionSaveAt = now;
  await saveActiveSessionStorage({
    pageKey: state.pageKey,
    dateKey: state.dateKey,
    elapsedMs: state.getElapsedMs(now),
    todayElapsedMs: state.getTodayElapsedMs(now),
    updatedAt: now,
  });
}

async function saveDailyTimer(throttle: boolean): Promise<void> {
  if (!persistentReady) return;
  const now = Date.now();
  if (throttle && now - lastDailySaveAt < SESSION_SAVE_INTERVAL_MS) return;

  state.commit(now);
  lastDailySaveAt = now;
  if (state.sessionElapsedMs < SESSION_RECORD_MIN_MS) return;

  const savedSessionElapsedMs = state.sessionElapsedMs;
  state.markSessionSaved(savedSessionElapsedMs);
  await saveWatchTimerSession({
    id: state.sessionId,
    pageKey: state.pageKey,
    title: getCurrentVideoTitle(),
    url: location.href,
    dateKey: state.dateKey,
    elapsedMs: savedSessionElapsedMs,
    updatedAt: now,
  });

  if (now - lastSessionPruneAt > SESSION_PRUNE_INTERVAL_MS) {
    lastSessionPruneAt = now;
    void pruneWatchTimerSessions(state.dateKey);
  }
}

function syncTodayBoundary(): void {
  const currentDateKey = getTodayKey();
  if (currentDateKey === state.dateKey) return;

  state.commit();
  void saveDailyTimer(false);
  state.rolloverDate(currentDateKey);
  lastDailySaveAt = 0;
  void saveDailyTimer(false);
}

async function syncStoredTimerTotals(): Promise<void> {
  if (!persistentReady || !state.pageKey) return;

  const loadId = ++storedTotalsLoadId;
  const pageKey = state.pageKey;
  const [daily, videoElapsedMs] = await Promise.all([
    loadWatchTimerDaily(),
    getWatchTimerVideoDailyElapsed(pageKey, state.dateKey),
  ]);
  if (loadId !== storedTotalsLoadId || !view.mounted || pageKey !== state.pageKey) return;

  state.mergeDaily(daily.dateKey, daily.elapsedMs);
  state.mergeVideo(daily.dateKey, videoElapsedMs);
  renderTime();
}

function scheduleStoredTimerSync(): void {
  window.clearTimeout(storedTotalsSyncTimer);
  storedTotalsSyncTimer = window.setTimeout(() => {
    storedTotalsSyncTimer = undefined;
    void syncStoredTimerTotals();
  }, STORED_TOTALS_SYNC_DELAY_MS);
}

function syncTimerStorageChange(
  changes: Record<string, chrome.storage.StorageChange>,
  areaName: string,
): void {
  if (areaName !== "local" || !persistentReady) return;

  const hasWatchTimerChange = Object.keys(changes).some(
    key =>
      key.startsWith(WATCH_TIMER_SESSION_KEY_PREFIX) ||
      key.startsWith(WATCH_TIMER_DAILY_TOTAL_KEY_PREFIX) ||
      key === WATCH_TIMER_DATE_INDEX_KEY,
  );
  if (hasWatchTimerChange) scheduleStoredTimerSync();
}

function getCurrentPageKey(): string {
  const parsed = new URL(location.href);
  const bvid = parsed.pathname.match(/\/video\/(BV[\da-z]+)/i)?.[1];
  const avid = parsed.pathname.match(/\/video\/(av\d+)/i)?.[1];
  const bangumiId = parsed.pathname.match(/\/bangumi\/play\/([^/?#]+)/i)?.[1];
  return `${parsed.hostname}${bvid ?? avid ?? bangumiId ?? parsed.pathname}`;
}

function getCurrentVideoTitle(): string {
  const heading = document.querySelector<HTMLElement>(
    "h1.video-title, h1[title], .video-title, .media-title",
  );
  const rawTitle = heading?.getAttribute("title") || heading?.textContent || document.title;
  return rawTitle.replace(/[_-]?哔哩哔哩.*$/u, "").trim() || state.pageKey;
}

function isWatchTimerPlayerPage(url = location.href): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.hostname.endsWith("bilibili.com") &&
      (/^\/video\/(?:BV|av)/i.test(parsed.pathname) || parsed.pathname.startsWith("/bangumi/play/"))
    );
  } catch {
    return false;
  }
}

function isVideoActivelyPlaying(): boolean {
  return [...document.querySelectorAll<HTMLVideoElement>("video")].some(
    video => !video.paused && !video.ended && video.readyState > HTMLMediaElement.HAVE_CURRENT_DATA,
  );
}
