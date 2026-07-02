import type { ExtensionMessage } from "../shared/messaging";
import type { ExtensionSettings, RuntimeSnapshot, SearchFilterSettings } from "../shared/types";
import { applySearchFilter, getSearchSnapshot, isSearchPage } from "./search-filter";

const SETTINGS_KEY = "biliFilter.settings";
const defaultSearchFilter: SearchFilterSettings = {
  enabled: false,
  titlePattern: "",
  uploaderPattern: "",
  minDanmakuViewRate: 0.005,
  filterMissingTitleHighlight: true,
};

let rescanTimer: number | undefined;
let observer: MutationObserver | undefined;
let currentUrl = location.href;

function getSnapshot(): RuntimeSnapshot {
  return {
    url: location.href,
    title: document.title,
    isBilibili: location.hostname.includes("bilibili.com"),
    isSearchPage: isSearchPage(),
    detectedAt: new Date().toISOString(),
  };
}

async function scanSearchPage() {
  const searchFilter = await getSearchFilter();
  return applySearchFilter(searchFilter);
}

async function getSearchFilter(): Promise<SearchFilterSettings> {
  if (typeof chrome === "undefined" || !chrome.storage?.local) return defaultSearchFilter;

  const result = await chrome.storage.local.get(SETTINGS_KEY);
  const saved = result[SETTINGS_KEY] as Partial<ExtensionSettings> | undefined;
  return {
    ...defaultSearchFilter,
    ...saved?.searchFilter,
  };
}

function scheduleScan(delay = 150) {
  window.clearTimeout(rescanTimer);
  rescanTimer = window.setTimeout(() => {
    void scanSearchPage();
  }, delay);
}

function watchSearchResults() {
  observer?.disconnect();
  if (!isSearchPage()) return;

  observer = new MutationObserver(() => scheduleScan());
  observer.observe(document.body, { childList: true, subtree: true });
}

function watchUrlChanges() {
  window.setInterval(() => {
    if (location.href === currentUrl) return;

    currentUrl = location.href;
    watchSearchResults();
    scheduleScan(0);
  }, 500);
}

function bindStorageChanges() {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "local" && changes[SETTINGS_KEY]) scheduleScan(0);
  });
}

function bindRuntimeMessages() {
  chrome.runtime.onMessage.addListener(
    (message: ExtensionMessage, _sender, sendResponse: (response: unknown) => void) => {
      if (message.type === "BILI_FILTER_GET_PAGE_STATUS") {
        void scanSearchPage().then(stats => {
          sendResponse({
            ok: true,
            source: "content",
            receivedAt: new Date().toISOString(),
            snapshot: getSearchSnapshot(stats),
            stats,
          });
        });
        return true;
      }

      if (message.type === "BILI_FILTER_SETTINGS_UPDATED") {
        void scanSearchPage().then(stats => {
          sendResponse({
            ok: true,
            source: "content",
            receivedAt: new Date().toISOString(),
            snapshot: getSearchSnapshot(stats),
            stats,
          });
        });
        return true;
      }

      return false;
    },
  );
}

async function boot() {
  bindRuntimeMessages();
  bindStorageChanges();
  watchSearchResults();
  watchUrlChanges();
  await scanSearchPage();
  await sendRuntimeMessage({ type: "BILI_FILTER_HELLO", payload: getSnapshot() });
}

async function sendRuntimeMessage(message: ExtensionMessage) {
  if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) return null;
  return chrome.runtime.sendMessage(message);
}

void boot();
