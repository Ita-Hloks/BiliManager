import type { ExtensionMessage } from "../shared/messaging";
import type {
  ExtensionSettings,
  PlayerPersonalizationSettings,
  RuntimeSnapshot,
  SearchFilterSettings,
} from "../shared/types";
import { applyPlayerPersonalization, isPlayerPage } from "./player-personalization";
import { applySearchFilter, getSearchSnapshot, isSearchPage } from "./search-filter";

const SETTINGS_KEY = "biliFilter.settings";
const defaultSearchFilter: SearchFilterSettings = {
  enabled: false,
  titlePattern: "",
  uploaderPattern: "",
  minDanmakuViewRate: 0.005,
  filterMissingTitleHighlight: true,
};
const defaultPersonalization: PlayerPersonalizationSettings = {
  blockRelatedVideos: false,
  disableRecommendationAutoplay: false,
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

async function scanCurrentPage() {
  const settings = await getContentSettings();
  applyPlayerPersonalization(settings.personalization);

  return applySearchFilter(settings.searchFilter);
}

async function getContentSettings(): Promise<{
  searchFilter: SearchFilterSettings;
  personalization: PlayerPersonalizationSettings;
}> {
  if (typeof chrome === "undefined" || !chrome.storage?.local) {
    return {
      searchFilter: defaultSearchFilter,
      personalization: defaultPersonalization,
    };
  }

  const result = await chrome.storage.local.get(SETTINGS_KEY);
  const saved = result[SETTINGS_KEY] as Partial<ExtensionSettings> | undefined;

  return {
    searchFilter: {
      ...defaultSearchFilter,
      ...saved?.searchFilter,
    },
    personalization: {
      ...defaultPersonalization,
      ...saved?.personalization,
    },
  };
}

function scheduleScan(delay = 150) {
  window.clearTimeout(rescanTimer);
  rescanTimer = window.setTimeout(() => {
    void scanCurrentPage();
  }, delay);
}

function watchManagedPage() {
  observer?.disconnect();
  if (!isSearchPage() && !isPlayerPage()) return;

  observer = new MutationObserver(() => scheduleScan());
  observer.observe(document.body, { childList: true, subtree: true });
}

function watchUrlChanges() {
  window.setInterval(() => {
    if (location.href === currentUrl) return;

    currentUrl = location.href;
    watchManagedPage();
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
        void scanCurrentPage().then(stats => {
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
        void scanCurrentPage().then(stats => {
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
  watchManagedPage();
  watchUrlChanges();
  await scanCurrentPage();
  await sendRuntimeMessage({ type: "BILI_FILTER_HELLO", payload: getSnapshot() });
}

async function sendRuntimeMessage(message: ExtensionMessage) {
  if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) return null;
  return chrome.runtime.sendMessage(message);
}

void boot();
