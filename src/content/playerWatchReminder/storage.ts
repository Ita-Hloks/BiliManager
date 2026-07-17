import { hasChromeLocalStorage } from "../../shared/chromeStorage";

export const WATCH_REMINDER_SESSION_KEY = "biliManager.watchReminder.session";

export type WatchReminderSession = {
  accumulatedMs: number;
  lastPlaybackAt: number;
  updatedAt: number;
};

export async function loadWatchReminderSession(): Promise<WatchReminderSession> {
  if (!hasChromeLocalStorage()) return createEmptyWatchReminderSession();
  const saved = await chrome.storage.local.get(WATCH_REMINDER_SESSION_KEY);
  return normalizeWatchReminderSession(saved[WATCH_REMINDER_SESSION_KEY]);
}

export async function saveWatchReminderSession(session: WatchReminderSession): Promise<void> {
  if (!hasChromeLocalStorage()) return;
  await chrome.storage.local.set({ [WATCH_REMINDER_SESSION_KEY]: session });
}

export function createEmptyWatchReminderSession(updatedAt = 0): WatchReminderSession {
  return { accumulatedMs: 0, lastPlaybackAt: 0, updatedAt };
}

function normalizeWatchReminderSession(value: unknown): WatchReminderSession {
  if (!value || typeof value !== "object") return createEmptyWatchReminderSession();
  const session = value as Partial<WatchReminderSession>;
  return {
    accumulatedMs: normalizeTimestamp(session.accumulatedMs),
    lastPlaybackAt: normalizeTimestamp(session.lastPlaybackAt),
    updatedAt: normalizeTimestamp(session.updatedAt),
  };
}

function normalizeTimestamp(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
}
