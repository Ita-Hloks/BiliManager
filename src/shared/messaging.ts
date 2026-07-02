import type { RuntimeSnapshot, SearchFilterStats } from "./types";

export type ExtensionMessage =
  | { type: "BILI_FILTER_HELLO"; payload: RuntimeSnapshot }
  | { type: "BILI_FILTER_GET_STATUS" }
  | { type: "BILI_FILTER_GET_PAGE_STATUS" }
  | { type: "BILI_FILTER_SETTINGS_UPDATED" };

export type ExtensionResponse =
  | { ok: true; source: "background"; receivedAt: string }
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
