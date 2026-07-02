import type { ExtensionMessage, ExtensionResponse } from "../shared/messaging";

chrome.runtime.onInstalled.addListener(details => {
  console.info("[Bili Filter] installed", details.reason);
});

chrome.runtime.onMessage.addListener(
  (message: ExtensionMessage, _sender, sendResponse: (response: ExtensionResponse) => void) => {
    if (message.type === "BILI_FILTER_HELLO") {
      console.info("[Bili Filter] page handshake", message.payload);
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

    sendResponse({ ok: false, error: "Unknown message" });
    return true;
  },
);
