const TIMER_ACTIVE_SESSION_KEY = "biliManager.playerWatchTimerActiveSession";
const ACTIVE_SESSION_MAX_AGE_MS = 12 * 60 * 60 * 1000;

export type PlayerWatchTimerActiveSessionStorage = {
  pageKey: string;
  dateKey: string;
  elapsedMs: number;
  todayElapsedMs: number;
  updatedAt: number;
};

export async function loadActiveSession(): Promise<
  PlayerWatchTimerActiveSessionStorage | undefined
> {
  if (!hasChromeStorage()) return undefined;

  const saved = await chrome.storage.local.get(TIMER_ACTIVE_SESSION_KEY);
  return normalizeActiveSession(saved[TIMER_ACTIVE_SESSION_KEY]);
}

export async function saveActiveSession(
  session: PlayerWatchTimerActiveSessionStorage,
): Promise<void> {
  if (!hasChromeStorage()) return;

  await chrome.storage.local.set({
    [TIMER_ACTIVE_SESSION_KEY]: {
      pageKey: session.pageKey,
      dateKey: session.dateKey,
      elapsedMs: Math.max(0, Math.floor(session.elapsedMs)),
      todayElapsedMs: Math.max(0, Math.floor(session.todayElapsedMs)),
      updatedAt: Math.max(0, Math.floor(session.updatedAt)),
    },
  });
}

function normalizeActiveSession(value: unknown): PlayerWatchTimerActiveSessionStorage | undefined {
  if (!value || typeof value !== "object") return undefined;

  const record = value as Partial<PlayerWatchTimerActiveSessionStorage>;
  if (typeof record.pageKey !== "string" || record.pageKey.length === 0) return undefined;
  if (typeof record.dateKey !== "string" || !isDateKey(record.dateKey)) return undefined;
  if (typeof record.updatedAt !== "number" || !Number.isFinite(record.updatedAt)) return undefined;
  if (Date.now() - record.updatedAt > ACTIVE_SESSION_MAX_AGE_MS) return undefined;

  return {
    pageKey: record.pageKey,
    dateKey: record.dateKey,
    elapsedMs: clampNumber(record.elapsedMs, 0, Number.MAX_SAFE_INTEGER, 0),
    todayElapsedMs: clampNumber(record.todayElapsedMs, 0, Number.MAX_SAFE_INTEGER, 0),
    updatedAt: Math.max(0, Math.floor(record.updatedAt)),
  };
}

function isDateKey(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(Math.max(value, min), Math.max(min, max))
    : fallback;
}

function hasChromeStorage(): boolean {
  return typeof chrome !== "undefined" && !!chrome.storage?.local;
}
