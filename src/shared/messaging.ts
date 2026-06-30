import type { RuntimeSnapshot } from "./types";

export type ExtensionMessage =
  | { type: "BILI_FILTER_HELLO"; payload: RuntimeSnapshot }
  | { type: "BILI_FILTER_GET_STATUS" };

export type ExtensionResponse =
  | { ok: true; source: "background"; receivedAt: string }
  | { ok: false; error: string };

export async function sendMessage(message: ExtensionMessage): Promise<ExtensionResponse | null> {
  if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) return null;
  return chrome.runtime.sendMessage(message);
}
