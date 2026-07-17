import type { WatchReminderSettings } from "../../shared/types";
import {
  createEmptyWatchReminderSession,
  loadWatchReminderSession,
  saveWatchReminderSession,
  WATCH_REMINDER_SESSION_KEY,
} from "./storage";
import type { WatchReminderSession } from "./storage";
import { WatchReminderView } from "./view";

const TICK_INTERVAL_MS = 1000;
const SAVE_INTERVAL_MS = 5000;

const view = new WatchReminderView();

let currentSettings: WatchReminderSettings | undefined;
let session = createEmptyWatchReminderSession();
let tickTimer: number | undefined;
let loadId = 0;
let ready = false;
let wasPlaying = false;
let triggering = false;
let lastTickAt = 0;
let lastSaveAt = 0;

export function applyPlayerWatchReminder(enabled: boolean, settings: WatchReminderSettings): void {
  currentSettings = settings;
  if (!enabled || !isWatchReminderPlayerPage()) {
    destroyPlayerWatchReminder();
    return;
  }

  if (tickTimer) return;
  bindEvents();
  tickTimer = window.setInterval(updateReminder, TICK_INTERVAL_MS);
  void hydrateSession();
}

export function destroyPlayerWatchReminder(): void {
  if (!tickTimer && !ready) return;
  window.clearInterval(tickTimer);
  tickTimer = undefined;
  unbindEvents();
  view.hide();
  void persistSession(true);
  loadId += 1;
  ready = false;
  wasPlaying = false;
  triggering = false;
  lastTickAt = 0;
  lastSaveAt = 0;
}

async function hydrateSession(): Promise<void> {
  const currentLoadId = ++loadId;
  const storedSession = await loadWatchReminderSession().catch(() =>
    createEmptyWatchReminderSession(),
  );
  if (currentLoadId !== loadId || !tickTimer) return;

  session = storedSession;
  resetExpiredSession(Date.now());
  ready = true;
  lastTickAt = Date.now();
  updateReminder();
}

function bindEvents(): void {
  window.addEventListener("pagehide", flushSession);
  document.addEventListener("visibilitychange", syncVisibility);
  chrome.storage?.onChanged.addListener(syncStoredSession);
}

function unbindEvents(): void {
  window.removeEventListener("pagehide", flushSession);
  document.removeEventListener("visibilitychange", syncVisibility);
  chrome.storage?.onChanged.removeListener(syncStoredSession);
}

function updateReminder(): void {
  if (!ready || !currentSettings) return;

  const now = Date.now();
  const playing = document.visibilityState === "visible" && isVideoActivelyPlaying();
  resetExpiredSession(now);

  if (playing) {
    if (wasPlaying) session.accumulatedMs += Math.max(0, now - lastTickAt);
    session.lastPlaybackAt = now;
  }

  session.updatedAt = now;
  wasPlaying = playing;
  lastTickAt = now;

  if (session.accumulatedMs >= currentSettings.limitMinutes * 60_000) {
    void triggerReminder();
    return;
  }

  void persistSession(false);
}

function resetExpiredSession(now: number): void {
  if (!currentSettings || session.lastPlaybackAt === 0) return;
  if (now - session.lastPlaybackAt < currentSettings.interruptionMinutes * 60_000) return;
  session = createEmptyWatchReminderSession(now);
  wasPlaying = false;
}

async function triggerReminder(): Promise<void> {
  if (!currentSettings || triggering) return;
  triggering = true;
  document.querySelectorAll<HTMLVideoElement>("video").forEach(video => video.pause());
  const limitMinutes = currentSettings.limitMinutes;
  session = createEmptyWatchReminderSession(Date.now());
  wasPlaying = false;
  const savePromise = persistSession(true);

  if (document.fullscreenElement) {
    await document.exitFullscreen().catch(() => undefined);
  }

  await savePromise;
  view.show(limitMinutes);
  triggering = false;
}

function persistSession(force: boolean): Promise<void> {
  if (!ready) return Promise.resolve();
  const now = Date.now();
  if (!force && now - lastSaveAt < SAVE_INTERVAL_MS) return Promise.resolve();
  lastSaveAt = now;
  return saveWatchReminderSession({ ...session }).catch(() => undefined);
}

function flushSession(): void {
  updateReminder();
  void persistSession(true);
}

function syncVisibility(): void {
  updateReminder();
}

function syncStoredSession(
  changes: Record<string, chrome.storage.StorageChange>,
  areaName: string,
): void {
  if (areaName !== "local" || !ready) return;
  const next = changes[WATCH_REMINDER_SESSION_KEY]?.newValue as WatchReminderSession | undefined;
  if (!next || next.updatedAt <= session.updatedAt) return;
  session = next;
  wasPlaying = false;
  lastTickAt = Date.now();
}

function isWatchReminderPlayerPage(url = location.href): boolean {
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
