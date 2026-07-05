import type { WatchTimerSettings } from "../shared/types";

const TIMER_SETTINGS_KEY = "biliManager.playerWatchTimer";
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
let tickTimer: number | undefined;
let currentPageKey = "";
let startedAt = 0;
let elapsedMs = 0;
let isCounting = false;
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
  stopTicker();
  timerRoot?.remove();
  timerRoot = undefined;
  timeText = undefined;
  isCounting = false;
  dragging = undefined;
  document.documentElement.removeAttribute(FULLSCREEN_ATTR);
  window.removeEventListener("resize", keepTimerInViewport);
  document.removeEventListener("fullscreenchange", syncFullscreenState);
  document.removeEventListener("visibilitychange", syncVisibilityTiming);
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

  const label = document.createElement("span");
  label.className = "bili-manager-watch-timer__label";
  label.textContent = "当前播放器";

  timeText = document.createElement("strong");
  timeText.className = "bili-manager-watch-timer__time";
  timeText.textContent = "00:00";

  handle.append(label, timeText);
  root.append(handle);
  document.body.append(root);
  timerRoot = root;

  window.addEventListener("resize", keepTimerInViewport);
  document.addEventListener("fullscreenchange", syncFullscreenState);
  document.addEventListener("visibilitychange", syncVisibilityTiming);

  void loadTimerSettings().then(settings => {
    latestSettings = settings;
    applyTimerSettings(settings);
  });
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

    .bili-manager-watch-timer__label {
      display: block;
      color: rgba(226, 232, 240, 0.76);
      font-size: 11px;
      line-height: 1.2;
    }

    .bili-manager-watch-timer__time {
      display: block;
      margin-top: 2px;
      color: #f8fafc;
      font-size: 22px;
      font-weight: 700;
      line-height: 1.12;
      letter-spacing: 0;
    }
  `;
  document.head.append(style);
}

async function loadTimerSettings(): Promise<PlayerWatchTimerStorage> {
  if (typeof chrome === "undefined" || !chrome.storage?.local) return DEFAULT_TIMER_SETTINGS;

  const saved = await chrome.storage.local.get(TIMER_SETTINGS_KEY);
  return normalizeTimerSettings(saved[TIMER_SETTINGS_KEY]);
}

function normalizeTimerSettings(value: unknown): PlayerWatchTimerStorage {
  if (!value || typeof value !== "object") return DEFAULT_TIMER_SETTINGS;

  const record = value as Partial<PlayerWatchTimerStorage>;
  return {
    left: clampNumber(record.left, 8, window.innerWidth - 156, DEFAULT_TIMER_SETTINGS.left),
    top: clampNumber(record.top, 8, window.innerHeight - 94, DEFAULT_TIMER_SETTINGS.top),
  };
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
  const nextPageKey = getCurrentPageKey();
  if (nextPageKey === currentPageKey) return;

  currentPageKey = nextPageKey;
  elapsedMs = 0;
  isCounting = isVideoActivelyPlaying();
  startedAt = Date.now();
  updateTimeText();
}

function syncVisibilityTiming() {
  syncPlaybackTiming();
  updateTimeText();
}

function syncPlaybackTiming() {
  const shouldCount = document.visibilityState === "visible" && isVideoActivelyPlaying();
  if (isCounting === shouldCount) return;

  if (!shouldCount) {
    elapsedMs = getElapsedMs();
    startedAt = Date.now();
  }

  isCounting = shouldCount;
  startedAt = Date.now();
}

function updateTimeText() {
  if (!timeText) return;
  syncPlaybackTiming();
  timeText.textContent = formatDuration(getElapsedMs());
}

function getElapsedMs() {
  if (!isCounting) return elapsedMs;
  return elapsedMs + Date.now() - startedAt;
}

function getCurrentPageKey() {
  const parsed = new URL(location.href);
  const bvid = parsed.pathname.match(/\/video\/(BV[\da-z]+)/i)?.[1];
  const avid = parsed.pathname.match(/\/video\/(av\d+)/i)?.[1];
  const bangumiId = parsed.pathname.match(/\/bangumi\/play\/([^/?#]+)/i)?.[1];
  return `${parsed.hostname}${bvid ?? avid ?? bangumiId ?? parsed.pathname}`;
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

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(Math.max(value, min), Math.max(min, max))
    : fallback;
}

function padTime(value: number) {
  return value.toString().padStart(2, "0");
}
