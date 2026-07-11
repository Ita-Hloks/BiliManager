import type { ExtensionMessage } from "../shared/messaging";
import { getSettings, SETTINGS_KEY } from "../shared/storage";
import type {
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
} from "./playerPersonalization";
import { applyCustomBackground } from "./customBackground";
import { bindBilibiliPageThemeUpdates } from "./pageThemeEvents";
import { applyPlayerWatchTimer } from "./playerWatchTimer";
import { applySearchFilter, getSearchSnapshot, isSearchPage } from "./searchFilter";

const disabledPersonalization: PlayerPersonalizationSettings = {
  blockRelatedVideos: false,
  blockPlayerAds: false,
  disableRecommendationAutoplay: false,
  customBackground: {
    enabled: false,
    imageDataUrl: "",
    maskOpacity: 0.18,
    positionX: 50,
    positionY: 50,
  },
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
let unbindPageThemeUpdates: (() => void) | undefined;

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
  applyCustomBackground(settings.personalization.customBackground);
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
  const settings = await getSettings();
  const pluginEnabled = settings.features.enabled;

  return {
    searchFilter: pluginEnabled
      ? settings.searchFilter
      : { ...settings.searchFilter, enabled: false },
    personalization: pluginEnabled ? settings.personalization : disabledPersonalization,
    watchTimer: settings.watchTimer,
    watchTimerEnabled: pluginEnabled && settings.features.watchTimer,
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

function bindPageThemeUpdates() {
  if (unbindPageThemeUpdates) return;

  unbindPageThemeUpdates = bindBilibiliPageThemeUpdates(() => scheduleScan(0));
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
  bindPageThemeUpdates();
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
