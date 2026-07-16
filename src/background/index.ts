import type { ExtensionMessage, ExtensionResponse } from "../shared/messaging";
import {
  pruneIndexedWatchTimerHistory,
  replaceWatchTimerHistory,
  writeWatchTimerSession,
} from "../shared/watchTimerHistory";

let watchTimerWriteQueue = Promise.resolve();

chrome.runtime.onInstalled.addListener(details => {
  console.info("[BiliManager] installed", details.reason);
});

chrome.runtime.onMessage.addListener(
  (message: ExtensionMessage, _sender, sendResponse: (response: ExtensionResponse) => void) => {
    if (message.type === "BILI_FILTER_HELLO") {
      console.info("[BiliManager] page handshake", message.payload);
      sendResponse({ ok: true, source: "background", receivedAt: new Date().toISOString() });
      return true;
    }

    if (message.type === "BILI_FILTER_GET_STATUS") {
      sendResponse({ ok: true, source: "background", receivedAt: new Date().toISOString() });
      return true;
    }

    if (message.type === "BILI_FILTER_SETTINGS_UPDATED") {
      sendResponse({ ok: true, source: "background", receivedAt: new Date().toISOString() });
      return true;
    }

    if (message.type === "BILI_FILTER_SAVE_WATCH_SESSION") {
      enqueueWatchTimerWrite(() => writeWatchTimerSession(message.payload), sendResponse);
      return true;
    }

    if (message.type === "BILI_FILTER_REPLACE_WATCH_HISTORY") {
      enqueueWatchTimerWrite(() => replaceWatchTimerHistory(message.payload), sendResponse);
      return true;
    }

    if (message.type === "BILI_FILTER_PRUNE_WATCH_HISTORY") {
      enqueueWatchTimerWrite(
        () => pruneIndexedWatchTimerHistory(message.payload.todayKey),
        sendResponse,
      );
      return true;
    }

    sendResponse({ ok: false, error: "Unknown message" });
    return true;
  },
);

function enqueueWatchTimerWrite(
  operation: () => Promise<void>,
  sendResponse: (response: ExtensionResponse) => void,
): void {
  const nextWrite = watchTimerWriteQueue.then(operation, operation);
  watchTimerWriteQueue = nextWrite.then(
    () => undefined,
    () => undefined,
  );
  void nextWrite.then(
    () => sendResponse({ ok: true, source: "background", receivedAt: new Date().toISOString() }),
    error =>
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : "观看历史写入失败",
      }),
  );
}
