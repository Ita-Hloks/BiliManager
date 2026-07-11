import { getTodayKey } from "../../shared/date";
import type { PlayerWatchTimerActiveSessionStorage } from "./storage";

export class WatchTimerState {
  pageKey = "";
  dateKey = getTodayKey();
  sessionId = createSessionId();
  sessionElapsedMs = 0;
  lastSavedSessionElapsedMs = 0;
  isCounting = false;

  private elapsedMs = 0;
  private todayElapsedMs = 0;
  private startedAt = 0;

  getElapsedMs(now = Date.now()): number {
    return this.elapsedMs + this.getActiveDelta(now);
  }

  getTodayElapsedMs(now = Date.now()): number {
    return this.todayElapsedMs + this.getActiveDelta(now);
  }

  commit(now = Date.now()): void {
    const delta = this.getActiveDelta(now);
    if (delta === 0) return;

    this.elapsedMs += delta;
    this.todayElapsedMs += delta;
    this.sessionElapsedMs += delta;
    this.startedAt = now;
  }

  setCounting(shouldCount: boolean, now = Date.now()): boolean {
    if (this.isCounting === shouldCount) return false;
    if (!shouldCount) this.commit(now);
    this.isCounting = shouldCount;
    this.startedAt = now;
    return true;
  }

  switchPage(pageKey: string, shouldCount: boolean, now = Date.now()): boolean {
    if (pageKey === this.pageKey) return false;

    this.commit(now);
    this.pageKey = pageKey;
    this.elapsedMs = 0;
    this.resetSession();
    this.isCounting = shouldCount;
    this.startedAt = now;
    return true;
  }

  hydrate(
    pageKey: string,
    dateKey: string,
    elapsedMs: number,
    todayElapsedMs: number,
    activeSession: PlayerWatchTimerActiveSessionStorage | undefined,
    now = Date.now(),
  ): void {
    if (this.pageKey !== pageKey) return;

    const activeDelta = this.getActiveDelta(now);
    this.dateKey = dateKey;
    this.todayElapsedMs = todayElapsedMs;
    this.elapsedMs = elapsedMs;
    if (activeSession?.dateKey === dateKey && activeSession.pageKey === pageKey) {
      this.elapsedMs = Math.max(this.elapsedMs, activeSession.elapsedMs) + activeDelta;
      this.startedAt = now;
    }
  }

  rolloverDate(nextDateKey: string, now = Date.now()): boolean {
    if (nextDateKey === this.dateKey) return false;

    this.commit(now);
    this.dateKey = nextDateKey;
    this.todayElapsedMs = 0;
    this.resetSession();
    this.startedAt = now;
    return true;
  }

  mergeDaily(dateKey: string, storedElapsedMs: number, now = Date.now()): void {
    if (dateKey !== this.dateKey) return;
    this.commit(now);
    this.todayElapsedMs = Math.max(
      this.todayElapsedMs,
      storedElapsedMs + this.getPendingSessionElapsedMs(),
    );
  }

  mergeVideo(dateKey: string, storedElapsedMs: number, now = Date.now()): void {
    if (dateKey !== this.dateKey) return;
    this.commit(now);
    this.elapsedMs = Math.max(this.elapsedMs, storedElapsedMs + this.getPendingSessionElapsedMs());
  }

  markSessionSaved(elapsedMs: number): void {
    this.lastSavedSessionElapsedMs = elapsedMs;
  }

  reset(): void {
    this.pageKey = "";
    this.dateKey = getTodayKey();
    this.elapsedMs = 0;
    this.todayElapsedMs = 0;
    this.startedAt = 0;
    this.isCounting = false;
    this.resetSession();
  }

  private getActiveDelta(now: number): number {
    return this.isCounting ? Math.max(0, now - this.startedAt) : 0;
  }

  private getPendingSessionElapsedMs(): number {
    return Math.max(0, this.sessionElapsedMs - this.lastSavedSessionElapsedMs);
  }

  private resetSession(): void {
    this.sessionId = createSessionId();
    this.sessionElapsedMs = 0;
    this.lastSavedSessionElapsedMs = 0;
  }
}

function createSessionId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}
