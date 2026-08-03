import { getTodayKey } from "../../shared/date";
import { normalizeWatchTimerDurationBreakdown } from "../../shared/watchTimerHistory";
import type { WatchTimerDurationBreakdown } from "../../shared/watchTimerHistory";
import type { PlayerWatchTimerActiveSessionStorage } from "./storage";

export type WatchTimerCountingMode = "foreground" | "background" | null;

export class WatchTimerState {
  pageKey = "";
  dateKey = getTodayKey();
  sessionId = createSessionId();
  sessionElapsedMs = 0;
  sessionForegroundElapsedMs = 0;
  sessionBackgroundElapsedMs = 0;
  lastSavedSessionElapsedMs = 0;
  lastSavedSessionForegroundElapsedMs = 0;
  lastSavedSessionBackgroundElapsedMs = 0;
  countingMode: WatchTimerCountingMode = null;

  private elapsedMs = 0;
  private foregroundElapsedMs = 0;
  private backgroundElapsedMs = 0;
  private todayElapsedMs = 0;
  private todayForegroundElapsedMs = 0;
  private todayBackgroundElapsedMs = 0;
  private startedAt = 0;

  getElapsedMs(now = Date.now()): number {
    return this.getElapsedBreakdown(now).elapsedMs;
  }

  getForegroundElapsedMs(now = Date.now()): number {
    return this.getElapsedBreakdown(now).foregroundElapsedMs;
  }

  getBackgroundElapsedMs(now = Date.now()): number {
    return this.getElapsedBreakdown(now).backgroundElapsedMs;
  }

  getTodayElapsedMs(now = Date.now()): number {
    return this.getTodayElapsedBreakdown(now).elapsedMs;
  }

  getTodayForegroundElapsedMs(now = Date.now()): number {
    return this.getTodayElapsedBreakdown(now).foregroundElapsedMs;
  }

  getTodayBackgroundElapsedMs(now = Date.now()): number {
    return this.getTodayElapsedBreakdown(now).backgroundElapsedMs;
  }

  getSessionBreakdown(): WatchTimerDurationBreakdown {
    return {
      elapsedMs: this.sessionElapsedMs,
      foregroundElapsedMs: this.sessionForegroundElapsedMs,
      backgroundElapsedMs: this.sessionBackgroundElapsedMs,
    };
  }

  commit(now = Date.now()): void {
    const delta = this.getActiveBreakdown(now);
    if (delta.elapsedMs === 0) return;

    this.elapsedMs += delta.elapsedMs;
    this.foregroundElapsedMs += delta.foregroundElapsedMs;
    this.backgroundElapsedMs += delta.backgroundElapsedMs;
    this.todayElapsedMs += delta.elapsedMs;
    this.todayForegroundElapsedMs += delta.foregroundElapsedMs;
    this.todayBackgroundElapsedMs += delta.backgroundElapsedMs;
    this.sessionElapsedMs += delta.elapsedMs;
    this.sessionForegroundElapsedMs += delta.foregroundElapsedMs;
    this.sessionBackgroundElapsedMs += delta.backgroundElapsedMs;
    this.startedAt = now;
  }

  setCountingMode(countingMode: WatchTimerCountingMode, now = Date.now()): boolean {
    if (this.countingMode === countingMode) return false;
    this.commit(now);
    this.countingMode = countingMode;
    this.startedAt = now;
    return true;
  }

  switchPage(pageKey: string, countingMode: WatchTimerCountingMode, now = Date.now()): boolean {
    if (pageKey === this.pageKey) return false;

    this.commit(now);
    this.pageKey = pageKey;
    this.elapsedMs = 0;
    this.foregroundElapsedMs = 0;
    this.backgroundElapsedMs = 0;
    this.resetSession();
    this.countingMode = countingMode;
    this.startedAt = now;
    return true;
  }

  hydrate(
    pageKey: string,
    dateKey: string,
    elapsedBreakdown: WatchTimerDurationBreakdown,
    todayElapsedBreakdown: WatchTimerDurationBreakdown,
    activeSession: PlayerWatchTimerActiveSessionStorage | undefined,
    now = Date.now(),
  ): void {
    if (this.pageKey !== pageKey) return;

    const activeDelta = this.getActiveBreakdown(now);
    this.dateKey = dateKey;
    let hydratedElapsed = normalizeWatchTimerDurationBreakdown(elapsedBreakdown);
    let hydratedTodayElapsed = normalizeWatchTimerDurationBreakdown(todayElapsedBreakdown);
    const hasMatchingActiveSession =
      activeSession?.dateKey === dateKey && activeSession.pageKey === pageKey;
    if (hasMatchingActiveSession && activeSession) {
      hydratedElapsed = selectLargerBreakdown(hydratedElapsed, activeSession);
      hydratedTodayElapsed = selectLargerBreakdown(hydratedTodayElapsed, {
        elapsedMs: activeSession.todayElapsedMs,
        foregroundElapsedMs: activeSession.todayForegroundElapsedMs,
        backgroundElapsedMs: activeSession.todayBackgroundElapsedMs,
      });
    }

    if (hasMatchingActiveSession) {
      hydratedElapsed = addBreakdowns(hydratedElapsed, activeDelta);
      hydratedTodayElapsed = addBreakdowns(hydratedTodayElapsed, activeDelta);
      this.startedAt = now;
    }
    this.elapsedMs = hydratedElapsed.elapsedMs;
    this.foregroundElapsedMs = hydratedElapsed.foregroundElapsedMs;
    this.backgroundElapsedMs = hydratedElapsed.backgroundElapsedMs;
    this.todayElapsedMs = hydratedTodayElapsed.elapsedMs;
    this.todayForegroundElapsedMs = hydratedTodayElapsed.foregroundElapsedMs;
    this.todayBackgroundElapsedMs = hydratedTodayElapsed.backgroundElapsedMs;
  }

  rolloverDate(nextDateKey: string, now = Date.now()): boolean {
    if (nextDateKey === this.dateKey) return false;

    this.commit(now);
    this.dateKey = nextDateKey;
    this.todayElapsedMs = 0;
    this.todayForegroundElapsedMs = 0;
    this.todayBackgroundElapsedMs = 0;
    this.resetSession();
    this.startedAt = now;
    return true;
  }

  mergeDaily(
    dateKey: string,
    storedElapsedBreakdown: WatchTimerDurationBreakdown,
    now = Date.now(),
  ): void {
    if (dateKey !== this.dateKey) return;
    this.commit(now);
    const pending = this.getPendingSessionBreakdown();
    const current = this.getStoredTodayBreakdown();
    const stored = addBreakdowns(storedElapsedBreakdown, pending);
    const merged = selectLargerBreakdown(current, stored);
    this.todayElapsedMs = merged.elapsedMs;
    this.todayForegroundElapsedMs = merged.foregroundElapsedMs;
    this.todayBackgroundElapsedMs = merged.backgroundElapsedMs;
  }

  mergeVideo(
    dateKey: string,
    storedElapsedBreakdown: WatchTimerDurationBreakdown,
    now = Date.now(),
  ): void {
    if (dateKey !== this.dateKey) return;
    this.commit(now);
    const pending = this.getPendingSessionBreakdown();
    const current = this.getStoredElapsedBreakdown();
    const stored = addBreakdowns(storedElapsedBreakdown, pending);
    const merged = selectLargerBreakdown(current, stored);
    this.elapsedMs = merged.elapsedMs;
    this.foregroundElapsedMs = merged.foregroundElapsedMs;
    this.backgroundElapsedMs = merged.backgroundElapsedMs;
  }

  markSessionSaved(breakdown: WatchTimerDurationBreakdown): void {
    const normalized = normalizeWatchTimerDurationBreakdown(breakdown);
    this.lastSavedSessionElapsedMs = normalized.elapsedMs;
    this.lastSavedSessionForegroundElapsedMs = normalized.foregroundElapsedMs;
    this.lastSavedSessionBackgroundElapsedMs = normalized.backgroundElapsedMs;
  }

  reset(): void {
    this.pageKey = "";
    this.dateKey = getTodayKey();
    this.elapsedMs = 0;
    this.foregroundElapsedMs = 0;
    this.backgroundElapsedMs = 0;
    this.todayElapsedMs = 0;
    this.todayForegroundElapsedMs = 0;
    this.todayBackgroundElapsedMs = 0;
    this.startedAt = 0;
    this.countingMode = null;
    this.resetSession();
  }

  private getElapsedBreakdown(now: number): WatchTimerDurationBreakdown {
    const active = this.getActiveBreakdown(now);
    return {
      elapsedMs: this.elapsedMs + active.elapsedMs,
      foregroundElapsedMs: this.foregroundElapsedMs + active.foregroundElapsedMs,
      backgroundElapsedMs: this.backgroundElapsedMs + active.backgroundElapsedMs,
    };
  }

  private getTodayElapsedBreakdown(now: number): WatchTimerDurationBreakdown {
    const active = this.getActiveBreakdown(now);
    return {
      elapsedMs: this.todayElapsedMs + active.elapsedMs,
      foregroundElapsedMs: this.todayForegroundElapsedMs + active.foregroundElapsedMs,
      backgroundElapsedMs: this.todayBackgroundElapsedMs + active.backgroundElapsedMs,
    };
  }

  private getActiveBreakdown(now: number): WatchTimerDurationBreakdown {
    const elapsedMs = this.countingMode ? Math.max(0, now - this.startedAt) : 0;
    return {
      elapsedMs,
      foregroundElapsedMs: this.countingMode === "foreground" ? elapsedMs : 0,
      backgroundElapsedMs: this.countingMode === "background" ? elapsedMs : 0,
    };
  }

  private getPendingSessionBreakdown(): WatchTimerDurationBreakdown {
    return {
      elapsedMs: Math.max(0, this.sessionElapsedMs - this.lastSavedSessionElapsedMs),
      foregroundElapsedMs: Math.max(
        0,
        this.sessionForegroundElapsedMs - this.lastSavedSessionForegroundElapsedMs,
      ),
      backgroundElapsedMs: Math.max(
        0,
        this.sessionBackgroundElapsedMs - this.lastSavedSessionBackgroundElapsedMs,
      ),
    };
  }

  private getStoredElapsedBreakdown(): WatchTimerDurationBreakdown {
    return {
      elapsedMs: this.elapsedMs,
      foregroundElapsedMs: this.foregroundElapsedMs,
      backgroundElapsedMs: this.backgroundElapsedMs,
    };
  }

  private getStoredTodayBreakdown(): WatchTimerDurationBreakdown {
    return {
      elapsedMs: this.todayElapsedMs,
      foregroundElapsedMs: this.todayForegroundElapsedMs,
      backgroundElapsedMs: this.todayBackgroundElapsedMs,
    };
  }

  private resetSession(): void {
    this.sessionId = createSessionId();
    this.sessionElapsedMs = 0;
    this.sessionForegroundElapsedMs = 0;
    this.sessionBackgroundElapsedMs = 0;
    this.lastSavedSessionElapsedMs = 0;
    this.lastSavedSessionForegroundElapsedMs = 0;
    this.lastSavedSessionBackgroundElapsedMs = 0;
  }
}

function addBreakdowns(
  left: WatchTimerDurationBreakdown,
  right: WatchTimerDurationBreakdown,
): WatchTimerDurationBreakdown {
  return normalizeWatchTimerDurationBreakdown({
    elapsedMs: left.elapsedMs + right.elapsedMs,
    foregroundElapsedMs: left.foregroundElapsedMs + right.foregroundElapsedMs,
    backgroundElapsedMs: left.backgroundElapsedMs + right.backgroundElapsedMs,
  });
}

function selectLargerBreakdown(
  current: WatchTimerDurationBreakdown,
  candidate: WatchTimerDurationBreakdown,
): WatchTimerDurationBreakdown {
  const normalizedCurrent = normalizeWatchTimerDurationBreakdown(current);
  const normalizedCandidate = normalizeWatchTimerDurationBreakdown(candidate);
  return normalizedCandidate.elapsedMs >= normalizedCurrent.elapsedMs
    ? normalizedCandidate
    : normalizedCurrent;
}

function createSessionId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}
