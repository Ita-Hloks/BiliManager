import type { WatchTimerSettings } from "../shared/types";
import {
  getWatchTimerVideoDailyElapsed,
  loadWatchTimerDaily,
  pruneWatchTimerSessions,
  saveWatchTimerSession,
  WATCH_TIMER_DAILY_KEY,
  WATCH_TIMER_HISTORY_KEY,
  WATCH_TIMER_SESSION_KEY_PREFIX,
} from "./playerWatchTimerHistory";
import {
  loadActiveSession,
  saveActiveSession as saveActiveSessionStorage,
} from "./playerWatchTimerStorage";
import type { PlayerWatchTimerActiveSessionStorage } from "./playerWatchTimerStorage";

const TIMER_SETTINGS_KEY = "biliManager.playerWatchTimer";
const ACTIVE_SESSION_SAVE_INTERVAL_MS = 1000;
const SESSION_SAVE_INTERVAL_MS = 1000;
const SESSION_RECORD_MIN_MS = 1000;
const TIMER_ROOT_ID = "bili-manager-watch-timer";
const TIMER_STYLE_ID = "bili-manager-watch-timer-style";
const FULLSCREEN_ATTR = "data-bili-manager-watch-timer-fullscreen";
const DEFAULT_TIMER_SETTINGS: PlayerWatchTimerStorage = {
  left: 24,
  top: 96,
};

type PlayerWatchTimerStorage = {
  left: number;
  top: number;
};

let timerRoot: HTMLElement | undefined;
let timeText: HTMLElement | undefined;
let todayText: HTMLElement | undefined;
let tickTimer: number | undefined;
let currentPageKey = "";
let startedAt = 0;
let elapsedMs = 0;
let todayElapsedMs = 0;
let todayDateKey = getTodayKey();
let lastDailySaveAt = 0;
let lastActiveSessionSaveAt = 0;
let currentSessionId = createSessionId();
let sessionElapsedMs = 0;
let lastSessionSavedElapsedMs = 0;
let isCounting = false;
let persistentTimerReady = false;
let persistentLoadId = 0;
let dailySyncLoadId = 0;
let dailySyncTimer: number | undefined;
let lastSessionPruneAt = 0;
let latestSettings = DEFAULT_TIMER_SETTINGS;
let dragging:
  | {
      pointerId: number;
      offsetX: number;
      offsetY: number;
    }
  | undefined;

export function applyPlayerWatchTimer(enabled: boolean, settings: WatchTimerSettings): void {
  if (!enabled || !isWatchTimerPlayerPage()) {
    destroyPlayerWatchTimer();
    return;
  }

  ensureTimerMounted();
  applyVisibleSettings(settings);
  syncPageTimer();
  startTicker();
}

export function destroyPlayerWatchTimer(): void {
  commitActiveSpan();
  void saveActiveSession(false);
  void saveDailyTimer(false);
  stopTicker();
  window.clearTimeout(dailySyncTimer);
  dailySyncTimer = undefined;
  timerRoot?.remove();
  timerRoot = undefined;
  timeText = undefined;
  todayText = undefined;
  currentPageKey = "";
  elapsedMs = 0;
  todayElapsedMs = 0;
  todayDateKey = getTodayKey();
  lastDailySaveAt = 0;
  lastActiveSessionSaveAt = 0;
  currentSessionId = createSessionId();
  sessionElapsedMs = 0;
  lastSessionSavedElapsedMs = 0;
  isCounting = false;
  persistentTimerReady = false;
  persistentLoadId += 1;
  dailySyncLoadId += 1;
  dragging = undefined;
  document.documentElement.removeAttribute(FULLSCREEN_ATTR);
  window.removeEventListener("resize", keepTimerInViewport);
  window.removeEventListener("focus", syncWindowFocusTiming);
  window.removeEventListener("pagehide", flushPageTiming);
  document.removeEventListener("fullscreenchange", syncFullscreenState);
  document.removeEventListener("visibilitychange", syncVisibilityTiming);
  if (typeof chrome !== "undefined" && chrome.storage?.onChanged) {
    chrome.storage.onChanged.removeListener(syncTimerStorageChange);
  }
}

function ensureTimerMounted() {
  if (timerRoot?.isConnected) return;

  injectTimerStyle();
  const root = document.createElement("aside");
  root.id = TIMER_ROOT_ID;
  root.setAttribute("aria-label", "播放器浏览计时器");

  const handle = document.createElement("button");
  handle.className = "bili-manager-watch-timer__handle";
  handle.type = "button";
  handle.title = "拖动调整位置";
  handle.addEventListener("pointerdown", startDrag);

  timeText = document.createElement("strong");
  timeText.className = "bili-manager-watch-timer__time";
  timeText.textContent = "00:00";

  const todayRow = document.createElement("span");
  todayRow.className = "bili-manager-watch-timer__today";
  const todayLabel = document.createElement("span");
  todayLabel.textContent = "今日：";
  todayText = document.createElement("span");
  todayText.textContent = "00:00";
  todayRow.append(todayLabel, todayText);

  handle.append(timeText, todayRow);
  root.append(handle);
  document.body.append(root);
  timerRoot = root;

  window.addEventListener("resize", keepTimerInViewport);
  window.addEventListener("focus", syncWindowFocusTiming);
  window.addEventListener("pagehide", flushPageTiming);
  document.addEventListener("fullscreenchange", syncFullscreenState);
  document.addEventListener("visibilitychange", syncVisibilityTiming);
  if (typeof chrome !== "undefined" && chrome.storage?.onChanged) {
    chrome.storage.onChanged.addListener(syncTimerStorageChange);
  }

  void loadPersistentTimerState();
  syncFullscreenState();
}

function injectTimerStyle() {
  if (document.getElementById(TIMER_STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = TIMER_STYLE_ID;
  style.textContent = `
    #${TIMER_ROOT_ID} {
      position: fixed;
      z-index: 2147483646;
      box-sizing: border-box;
      width: 148px;
      border: 1px solid rgba(125, 211, 252, 0.28);
      border-radius: 10px;
      background: linear-gradient(135deg, rgba(14, 165, 233, 0.2), rgba(15, 23, 42, 0.72));
      box-shadow: 0 14px 34px rgba(15, 23, 42, 0.22);
      color: rgba(248, 250, 252, 0.96);
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      overflow: hidden;
      user-select: none;
      backdrop-filter: blur(14px);
    }

    html[${FULLSCREEN_ATTR}="true"] #${TIMER_ROOT_ID} {
      display: none !important;
    }

    #${TIMER_ROOT_ID} * {
      box-sizing: border-box;
    }

    .bili-manager-watch-timer__handle {
      display: block;
      width: 100%;
      padding: 9px 10px 7px;
      border: 0;
      background: transparent;
      color: inherit;
      cursor: grab;
      text-align: left;
    }

    .bili-manager-watch-timer__handle:active {
      cursor: grabbing;
    }

    .bili-manager-watch-timer__time {
      display: block;
      color: #f8fafc;
      font-size: 22px;
      font-weight: 700;
      line-height: 1.12;
      letter-spacing: 0;
    }

    .bili-manager-watch-timer__today {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      margin-top: 7px;
      color: rgba(226, 232, 240, 0.78);
      font-size: 12px;
      font-weight: 500;
      line-height: 1.2;
    }
  `;
  document.head.append(style);
}

async function loadTimerSettings(): Promise<PlayerWatchTimerStorage> {
  if (typeof chrome === "undefined" || !chrome.storage?.local) return DEFAULT_TIMER_SETTINGS;

  const saved = await chrome.storage.local.get(TIMER_SETTINGS_KEY);
  return normalizeTimerSettings(saved[TIMER_SETTINGS_KEY]);
}

async function loadDailyTimer() {
  return loadWatchTimerDaily();
}

async function loadVideoTimer(pageKey: string) {
  return getWatchTimerVideoDailyElapsed(pageKey, todayDateKey);
}

async function loadPersistentTimerState() {
  const loadId = ++persistentLoadId;
  const pageKey = getCurrentPageKey();
  const [settings, daily, videoElapsedMs, activeSession] = await Promise.all([
    loadTimerSettings(),
    loadDailyTimer(),
    loadVideoTimer(pageKey),
    loadActiveSession(),
    pruneWatchTimerSessions(),
  ]);

  if (loadId !== persistentLoadId || !timerRoot?.isConnected) return;

  latestSettings = settings;
  applyTimerSettings(settings);
  todayDateKey = daily.dateKey;
  todayElapsedMs = daily.elapsedMs;
  elapsedMs = videoElapsedMs;
  restoreActiveSession(activeSession);
  persistentTimerReady = true;
  lastDailySaveAt = 0;
  lastActiveSessionSaveAt = 0;
  updateTimeText();
}

function normalizeTimerSettings(value: unknown): PlayerWatchTimerStorage {
  if (!value || typeof value !== "object") return DEFAULT_TIMER_SETTINGS;

  const record = value as Partial<PlayerWatchTimerStorage>;
  return {
    left: clampNumber(record.left, 8, window.innerWidth - 156, DEFAULT_TIMER_SETTINGS.left),
    top: clampNumber(record.top, 8, window.innerHeight - 94, DEFAULT_TIMER_SETTINGS.top),
  };
}

function restoreActiveSession(session: PlayerWatchTimerActiveSessionStorage | undefined) {
  const currentDateKey = getTodayKey();
  if (!session || session.dateKey !== currentDateKey || session.pageKey !== getCurrentPageKey()) {
    return;
  }

  const activeDelta = isCounting ? Math.max(0, Date.now() - startedAt) : 0;
  elapsedMs = Math.max(elapsedMs, session.elapsedMs) + activeDelta;
  startedAt = Date.now();
}

function applyTimerSettings(settings: PlayerWatchTimerStorage) {
  if (!timerRoot) return;

  timerRoot.style.left = `${settings.left}px`;
  timerRoot.style.top = `${settings.top}px`;
  keepTimerInViewport();
}

function applyVisibleSettings(settings: WatchTimerSettings) {
  if (!timerRoot) return;
  timerRoot.style.opacity = clampNumber(settings.opacity, 0.45, 1, 0.86).toString();
}

function startTicker() {
  if (tickTimer) return;

  tickTimer = window.setInterval(updateTimeText, 1000);
  updateTimeText();
}

function stopTicker() {
  window.clearInterval(tickTimer);
  tickTimer = undefined;
}

function syncPageTimer() {
  syncTodayBoundary();
  const nextPageKey = getCurrentPageKey();
  if (nextPageKey === currentPageKey) return;

  commitActiveSpan();
  void saveActiveSession(false);
  void saveDailyTimer(false);
  currentPageKey = nextPageKey;
  elapsedMs = 0;
  resetWatchSession();
  void syncStoredTimerTotals();
  lastActiveSessionSaveAt = 0;
  isCounting = isVideoActivelyPlaying();
  startedAt = Date.now();
  updateTimeText();
}

function syncVisibilityTiming() {
  syncTodayBoundary();
  if (document.visibilityState === "visible") void syncStoredTimerTotals();
  syncPlaybackTiming();
  updateTimeText();
}

function syncWindowFocusTiming() {
  syncTodayBoundary();
  void syncStoredTimerTotals();
  syncPlaybackTiming();
  updateTimeText();
}

function flushPageTiming() {
  commitActiveSpan();
  void saveActiveSession(false);
  void saveDailyTimer(false);
}

function syncPlaybackTiming() {
  syncTodayBoundary();
  const shouldCount = document.visibilityState === "visible" && isVideoActivelyPlaying();
  if (isCounting === shouldCount) return;

  if (!shouldCount) {
    commitActiveSpan();
    void saveActiveSession(false);
    void saveDailyTimer(false);
  }

  isCounting = shouldCount;
  startedAt = Date.now();
}

function updateTimeText() {
  if (!timeText || !todayText) return;
  syncPlaybackTiming();
  timeText.textContent = formatDuration(getElapsedMs());
  todayText.textContent = formatDuration(getTodayElapsedMs());
  void saveActiveSession(true);
  void saveDailyTimer(true);
}

function getElapsedMs() {
  if (!isCounting) return elapsedMs;
  return elapsedMs + Date.now() - startedAt;
}

function getTodayElapsedMs() {
  if (!isCounting) return todayElapsedMs;
  return todayElapsedMs + Date.now() - startedAt;
}

function commitActiveSpan() {
  if (!isCounting) return;

  const now = Date.now();
  const delta = Math.max(0, now - startedAt);
  elapsedMs += delta;
  todayElapsedMs += delta;
  sessionElapsedMs += delta;
  startedAt = now;
}

function getCurrentPageKey() {
  const parsed = new URL(location.href);
  const bvid = parsed.pathname.match(/\/video\/(BV[\da-z]+)/i)?.[1];
  const avid = parsed.pathname.match(/\/video\/(av\d+)/i)?.[1];
  const bangumiId = parsed.pathname.match(/\/bangumi\/play\/([^/?#]+)/i)?.[1];
  return `${parsed.hostname}${bvid ?? avid ?? bangumiId ?? parsed.pathname}`;
}

function getCurrentVideoTitle() {
  const heading = document.querySelector<HTMLElement>(
    "h1.video-title, h1[title], .video-title, .media-title",
  );
  const rawTitle = heading?.getAttribute("title") || heading?.textContent || document.title;
  return rawTitle.replace(/[_-]?哔哩哔哩.*$/u, "").trim() || currentPageKey;
}

function formatDuration(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const minuteSecond = `${padTime(minutes)}:${padTime(seconds)}`;

  return hours > 0 ? `${hours}:${minuteSecond}` : minuteSecond;
}

function startDrag(event: PointerEvent) {
  if (!timerRoot) return;

  const rect = timerRoot.getBoundingClientRect();
  dragging = {
    pointerId: event.pointerId,
    offsetX: event.clientX - rect.left,
    offsetY: event.clientY - rect.top,
  };
  timerRoot.setPointerCapture(event.pointerId);
  timerRoot.addEventListener("pointermove", dragTimer);
  timerRoot.addEventListener("pointerup", finishDrag);
  timerRoot.addEventListener("pointercancel", finishDrag);
}

function dragTimer(event: PointerEvent) {
  if (!timerRoot || !dragging || event.pointerId !== dragging.pointerId) return;

  const next = {
    ...latestSettings,
    left: clampNumber(
      event.clientX - dragging.offsetX,
      8,
      window.innerWidth - timerRoot.offsetWidth - 8,
      8,
    ),
    top: clampNumber(
      event.clientY - dragging.offsetY,
      8,
      window.innerHeight - timerRoot.offsetHeight - 8,
      8,
    ),
  };
  latestSettings = next;
  applyTimerSettings(next);
}

function finishDrag(event: PointerEvent) {
  if (!timerRoot || !dragging || event.pointerId !== dragging.pointerId) return;

  timerRoot.releasePointerCapture(event.pointerId);
  timerRoot.removeEventListener("pointermove", dragTimer);
  timerRoot.removeEventListener("pointerup", finishDrag);
  timerRoot.removeEventListener("pointercancel", finishDrag);
  dragging = undefined;
  void saveTimerSettings(latestSettings);
}

async function saveTimerSettings(settings: PlayerWatchTimerStorage) {
  if (typeof chrome === "undefined" || !chrome.storage?.local) return;
  await chrome.storage.local.set({ [TIMER_SETTINGS_KEY]: settings });
}

async function saveActiveSession(throttle: boolean) {
  if (!persistentTimerReady || !currentPageKey) return;

  const now = Date.now();
  if (throttle && now - lastActiveSessionSaveAt < ACTIVE_SESSION_SAVE_INTERVAL_MS) return;

  lastActiveSessionSaveAt = now;
  await saveActiveSessionStorage({
    pageKey: currentPageKey,
    dateKey: todayDateKey,
    elapsedMs: getElapsedMs(),
    todayElapsedMs: getTodayElapsedMs(),
    updatedAt: now,
  });
}

async function saveDailyTimer(throttle: boolean) {
  if (!persistentTimerReady) return;
  const now = Date.now();
  if (throttle && now - lastDailySaveAt < SESSION_SAVE_INTERVAL_MS) return;

  commitActiveSpan();
  lastDailySaveAt = now;
  if (sessionElapsedMs < SESSION_RECORD_MIN_MS) return;

  const savedSessionElapsedMs = sessionElapsedMs;
  lastSessionSavedElapsedMs = savedSessionElapsedMs;
  await saveWatchTimerSession({
    id: currentSessionId,
    pageKey: currentPageKey,
    title: getCurrentVideoTitle(),
    url: location.href,
    dateKey: todayDateKey,
    elapsedMs: savedSessionElapsedMs,
    updatedAt: now,
  });

  if (now - lastSessionPruneAt > 60_000) {
    lastSessionPruneAt = now;
    void pruneWatchTimerSessions(todayDateKey);
  }
}

function keepTimerInViewport() {
  if (!timerRoot) return;

  const next = {
    ...latestSettings,
    left: clampNumber(latestSettings.left, 8, window.innerWidth - timerRoot.offsetWidth - 8, 8),
    top: clampNumber(latestSettings.top, 8, window.innerHeight - timerRoot.offsetHeight - 8, 8),
  };
  latestSettings = next;
  timerRoot.style.left = `${next.left}px`;
  timerRoot.style.top = `${next.top}px`;
}

function syncFullscreenState() {
  if (document.fullscreenElement) {
    document.documentElement.setAttribute(FULLSCREEN_ATTR, "true");
    return;
  }

  document.documentElement.removeAttribute(FULLSCREEN_ATTR);
}

function isWatchTimerPlayerPage(url = location.href): boolean {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.endsWith("bilibili.com")) return false;

    return (
      /^\/video\/(?:BV|av)/i.test(parsed.pathname) || parsed.pathname.startsWith("/bangumi/play/")
    );
  } catch {
    return false;
  }
}

function isVideoActivelyPlaying() {
  return [...document.querySelectorAll<HTMLVideoElement>("video")].some(
    video => !video.paused && !video.ended && video.readyState > HTMLMediaElement.HAVE_CURRENT_DATA,
  );
}

function syncTodayBoundary() {
  const currentDateKey = getTodayKey();
  if (currentDateKey === todayDateKey) return;

  commitActiveSpan();
  void saveDailyTimer(false);

  todayDateKey = currentDateKey;
  todayElapsedMs = 0;
  resetWatchSession();
  startedAt = Date.now();
  lastDailySaveAt = 0;
  void saveDailyTimer(false);
}

async function syncStoredTimerTotals() {
  if (!persistentTimerReady) return;

  const loadId = ++dailySyncLoadId;
  const [daily, videoElapsedMs] = await Promise.all([
    loadDailyTimer(),
    loadVideoTimer(currentPageKey),
  ]);
  if (loadId !== dailySyncLoadId || !timerRoot?.isConnected) return;

  mergeDailyElapsed(daily.dateKey, daily.elapsedMs);
  mergeVideoElapsed(daily.dateKey, videoElapsedMs);
  updateTimeText();
}

function scheduleStoredTimerSync() {
  window.clearTimeout(dailySyncTimer);
  dailySyncTimer = window.setTimeout(() => {
    dailySyncTimer = undefined;
    void syncStoredTimerTotals();
  }, 300);
}

function syncTimerStorageChange(
  changes: Record<string, chrome.storage.StorageChange>,
  areaName: string,
) {
  if (areaName !== "local" || !persistentTimerReady) return;

  const hasWatchTimerChange = Object.keys(changes).some(
    key =>
      key.startsWith(WATCH_TIMER_SESSION_KEY_PREFIX) ||
      key === WATCH_TIMER_DAILY_KEY ||
      key === WATCH_TIMER_HISTORY_KEY,
  );
  if (!hasWatchTimerChange) return;

  scheduleStoredTimerSync();
}

function mergeDailyElapsed(dateKey: string, storedElapsedMs: number) {
  if (dateKey !== todayDateKey) return;

  commitActiveSpan();
  const pendingLocalElapsedMs = Math.max(0, sessionElapsedMs - lastSessionSavedElapsedMs);
  todayElapsedMs = Math.max(todayElapsedMs, storedElapsedMs + pendingLocalElapsedMs);
}

function mergeVideoElapsed(dateKey: string, storedElapsedMs: number) {
  if (dateKey !== todayDateKey) return;

  commitActiveSpan();
  const pendingLocalElapsedMs = Math.max(0, sessionElapsedMs - lastSessionSavedElapsedMs);
  elapsedMs = Math.max(elapsedMs, storedElapsedMs + pendingLocalElapsedMs);
}

function resetWatchSession() {
  currentSessionId = createSessionId();
  sessionElapsedMs = 0;
  lastSessionSavedElapsedMs = 0;
}

function getTodayKey() {
  const date = new Date();
  return `${date.getFullYear()}-${padDate(date.getMonth() + 1)}-${padDate(date.getDate())}`;
}

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(Math.max(value, min), Math.max(min, max))
    : fallback;
}

function padTime(value: number) {
  return value.toString().padStart(2, "0");
}

function padDate(value: number) {
  return value.toString().padStart(2, "0");
}

function createSessionId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}
