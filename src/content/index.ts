import type { ExtensionMessage } from "../shared/messaging";
import type {
  ExtensionSettings,
  PlayerPersonalizationSettings,
  RuntimeSnapshot,
  SearchFilterSettings,
  SearchFilterStats,
  WatchTimerSettings,
} from "../shared/types";
import {
  applyPlayerPersonalization,
  getPlayerObservationTargets,
  isPlayerPage,
} from "./player-personalization";
import { applyPlayerWatchTimer } from "./player-watch-timer";
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
  blockPlayerAds: false,
  disableRecommendationAutoplay: false,
};
const defaultWatchTimer: WatchTimerSettings = {
  opacity: 0.86,
};
const disabledSearchFilter: SearchFilterSettings = {
  ...defaultSearchFilter,
  enabled: false,
};
const disabledPersonalization: PlayerPersonalizationSettings = {
  blockRelatedVideos: false,
  blockPlayerAds: false,
  disableRecommendationAutoplay: false,
};
const unavailableSearchStats: SearchFilterStats = {
  available: false,
  enabled: false,
  total: 0,
  filtered: 0,
  regexErrors: [],
  updatedAt: new Date(0).toISOString(),
};

let rescanTimer: number | undefined;
let observer: MutationObserver | undefined;
let currentUrl = location.href;
let scanQueued = false;

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
  const searchPage = isSearchPage();
  applyPlayerPersonalization(settings.personalization);
  applyPlayerWatchTimer(settings.watchTimerEnabled, settings.watchTimer);

  if (searchPage) return applySearchFilter(settings.searchFilter);

  return {
    ...unavailableSearchStats,
    enabled: settings.searchFilter.enabled,
    updatedAt: new Date().toISOString(),
  };
}

async function getContentSettings(): Promise<{
  searchFilter: SearchFilterSettings;
  personalization: PlayerPersonalizationSettings;
  watchTimer: WatchTimerSettings;
  watchTimerEnabled: boolean;
}> {
  if (typeof chrome === "undefined" || !chrome.storage?.local) {
    return {
      searchFilter: defaultSearchFilter,
      personalization: defaultPersonalization,
      watchTimer: defaultWatchTimer,
      watchTimerEnabled: false,
    };
  }

  const result = await chrome.storage.local.get(SETTINGS_KEY);
  const saved = result[SETTINGS_KEY] as Partial<ExtensionSettings> | undefined;
  const pluginEnabled = saved?.features?.enabled ?? true;
  const searchFilter = {
    ...defaultSearchFilter,
    ...saved?.searchFilter,
    enabled: saved?.features?.searchFilter ?? saved?.searchFilter?.enabled ?? false,
  };
  const personalization = {
    ...defaultPersonalization,
    ...saved?.personalization,
  };
  const watchTimer = {
    ...defaultWatchTimer,
    ...saved?.watchTimer,
  };

  return {
    searchFilter: pluginEnabled ? searchFilter : disabledSearchFilter,
    personalization:
      pluginEnabled && (saved?.features?.personalization ?? true)
        ? personalization
        : disabledPersonalization,
    watchTimer,
    watchTimerEnabled: pluginEnabled && (saved?.features?.watchTimer ?? false),
  };
}

function scheduleScan(delay = 150) {
  window.clearTimeout(rescanTimer);
  rescanTimer = window.setTimeout(() => {
    if (scanQueued) return;
    scanQueued = true;
    window.requestAnimationFrame(() => {
      scanQueued = false;
      void scanCurrentPage();
    });
  }, delay);
}

function watchManagedPage() {
  observer?.disconnect();
  observer = undefined;

  if (isSearchPage()) {
    observer = new MutationObserver(() => scheduleScan());
    observer.observe(document.body, { childList: true, subtree: true });
    return;
  }

  if (!isPlayerPage()) return;

  const targets = getPlayerObservationTargets();
  observer = new MutationObserver(() => scheduleScan(80));
  targets.forEach(target => {
    observer?.observe(target, { childList: true, subtree: true });
  });
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
