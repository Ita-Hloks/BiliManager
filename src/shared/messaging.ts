import type { RuntimeSnapshot, SearchFilterStats } from "./types";
import type { FavoriteFolderResult } from "./favoriteFolder";
import type { WatchTimerHistoryBackup, WatchTimerSessionStorage } from "./watchTimerHistory";

export type ExtensionMessage =
  | { type: "BILI_FILTER_HELLO"; payload: RuntimeSnapshot }
  | { type: "BILI_FILTER_GET_STATUS" }
  | { type: "BILI_FILTER_GET_PAGE_STATUS" }
  | { type: "BILI_FILTER_GET_FAVORITE_VIDEOS"; payload: { folderId: string } }
  | { type: "BILI_FILTER_SETTINGS_UPDATED" }
  | { type: "BILI_FILTER_SAVE_WATCH_SESSION"; payload: WatchTimerSessionStorage }
  | { type: "BILI_FILTER_REPLACE_WATCH_HISTORY"; payload: WatchTimerHistoryBackup }
  | { type: "BILI_FILTER_PRUNE_WATCH_HISTORY"; payload: { todayKey: string } };

export type ExtensionResponse =
  | { ok: true; source: "background"; receivedAt: string }
  | {
      ok: true;
      source: "background";
      receivedAt: string;
      favoriteFolder: FavoriteFolderResult;
    }
  | {
      ok: true;
      source: "content";
      receivedAt: string;
      snapshot: RuntimeSnapshot;
      stats: SearchFilterStats;
    }
  | { ok: false; error: string };

export async function sendMessage(message: ExtensionMessage): Promise<ExtensionResponse | null> {
  if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) return null;
  return chrome.runtime.sendMessage(message);
}
