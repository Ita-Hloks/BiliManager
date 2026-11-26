import type { ExtensionMessage } from "../shared/messaging";
import { sendMessage } from "../shared/messaging";
import { CUSTOM_BACKGROUND_IMAGE_KEY } from "../shared/customBackgroundStorage";
import { hasExtensionContext, isExtensionContextInvalidated } from "../shared/extensionContext";
import { getSettings, SETTINGS_KEY } from "../shared/storage";
import { getUploaderBlocklist, UPLOADER_BLOCKLIST_KEY } from "../shared/uploaderBlocklist";
import type { BlockedUploader } from "../shared/uploaderBlocklist";
import type {
  ExtensionSettings,
  FavoriteRecommendationSettings,
  PlayerPersonalizationSettings,
  RuntimeSnapshot,
  SearchFilterSettings,
  SearchFilterStats,
  WatchReminderSettings,
  WatchTimerSettings,
} from "../shared/types";
import {
  applyPlayerPersonalization,
  getPlayerObservationTargets,
  isIgnoredPlayerMutation,
  isPlayerPage,
} from "./playerPersonalization";
import { applyCustomBackground, isCustomBackgroundSupportedPage } from "./customBackground";
import { bindBilibiliPageThemeUpdates } from "./pageThemeEvents";
import { applyPlayerWatchTimer } from "./playerWatchTimer";
import { applyPlayerWatchReminder } from "./playerWatchReminder";
import {
  applySearchFilter,
  clearSearchFilter,
  getSearchSnapshot,
  isSearchPage,
} from "./searchFilter";
import { isSearchFilterBypassed, SEARCH_BYPASS_BAR_ID } from "./searchFilter/bypassBar";
import { applySearchCleanup } from "./searchCleanup";
import {
  getCachedFavoriteRecommendationPool,
  loadFavoriteRecommendationPool,
} from "./favoriteRecommendation";

const disabledPersonalization: PlayerPersonalizationSettings = {
  filterTrending: false,
  blockRelatedVideos: false,
  blockPlayerAds: false,
  disableRecommendationAutoplay: false,
  disableDanmakuOnVideoEnter: false,
  customBackground: {
    enabled: false,
    hasImage: false,
    imageRevision: 0,
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

const URL_POLL_INTERVAL_MS = 1500;

let rescanTimer: number | undefined;
let observer: MutationObserver | undefined;
let unbindUrlChanges: (() => void) | undefined;
let currentUrl = location.href;
let scanQueued = false;
let unbindPageThemeUpdates: (() => void) | undefined;
let scanGeneration = 0;
let scanRequest = 0;
let managedPageActive = false;
let extensionContextInvalidated = false;
let cachedSettings: ExtensionSettings | undefined;
let cachedUploaderBlocklist: BlockedUploader[] | undefined;
let pendingSettingsPromise: Promise<ExtensionSettings> | undefined;
let pendingBlocklistPromise: Promise<BlockedUploader[]> | undefined;

type NavigationEventTarget = {
  addEventListener: (type: "navigatesuccess", listener: () => void) => void;
  removeEventListener: (type: "navigatesuccess", listener: () => void) => void;
};

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
  if (extensionContextInvalidated || !hasExtensionContext()) {
    invalidateExtensionContext();
    return unavailableSearchStats;
  }

  const generation = scanGeneration;
  const request = ++scanRequest;
  const settings = await getContentSettings();
  if (generation !== scanGeneration || request !== scanRequest) return unavailableSearchStats;

  if (!settings.pluginEnabled) {
    stopManagedPage();
    applySearchCleanup(false);
    applyPlayerPersonalization(disabledPersonalization);
    applyCustomBackground(disabledPersonalization.customBackground);
    applyPlayerWatchTimer(false, settings.watchTimer);
    applyPlayerWatchReminder(false, settings.watchReminder);
    clearSearchFilter();
    return {
      ...unavailableSearchStats,
      updatedAt: new Date().toISOString(),
    };
  }

  startManagedPage();
  const searchPage = isSearchPage();
  const shouldWatchTheme =
    searchPage ||
    (settings.personalization.customBackground.enabled &&
      settings.personalization.customBackground.hasImage &&
      isCustomBackgroundSupportedPage());
  syncPageThemeUpdates(shouldWatchTheme);
  applySearchCleanup(settings.personalization.filterTrending);
  applyPlayerPersonalization(settings.personalization);
  applyCustomBackground(settings.personalization.customBackground);
  applyPlayerWatchTimer(settings.watchTimerEnabled, settings.watchTimer);
  applyPlayerWatchReminder(settings.watchReminderEnabled, settings.watchReminder);
  if (searchPage) {
    const onBypassChange = () => scheduleScan(0);
    const cachedRecommendationPool = getCachedFavoriteRecommendationPool(
      settings.favoriteRecommendation,
    );
    const initialStats = applySearchFilter(
      settings.searchFilter,
      cachedRecommendationPool ?? undefined,
      settings.uploaderBlocklist,
      settings.uploaderBlockingEnabled,
      onBypassChange,
    );
    if (
      isSearchFilterBypassed() ||
      !settings.searchFilter.enabled ||
      !settings.favoriteRecommendation.enabled ||
      settings.favoriteRecommendation.folderIds.length === 0 ||
      settings.favoriteRecommendation.recommendationRate <= 0
    ) {
      return initialStats;
    }

    const recommendationPool = await loadFavoriteRecommendationPool(
      settings.favoriteRecommendation,
    );
    if (generation !== scanGeneration || request !== scanRequest) return unavailableSearchStats;
    if (recommendationPool.videos.length === 0) return initialStats;
    return applySearchFilter(
      settings.searchFilter,
      recommendationPool,
      settings.uploaderBlocklist,
      settings.uploaderBlockingEnabled,
      onBypassChange,
    );
  }

  clearSearchFilter();
  return {
    ...unavailableSearchStats,
    enabled: settings.searchFilter.enabled,
    updatedAt: new Date().toISOString(),
  };
}

async function loadCachedSettings(): Promise<ExtensionSettings> {
  if (cachedSettings) return cachedSettings;
  if (!pendingSettingsPromise) {
    const request = getSettings()
      .then(settings => {
        if (pendingSettingsPromise === request) {
          cachedSettings = settings;
          pendingSettingsPromise = undefined;
        }
        return settings;
      })
      .catch(error => {
        if (pendingSettingsPromise === request) {
          pendingSettingsPromise = undefined;
        }
        throw error;
      });
    pendingSettingsPromise = request;
  }
  return pendingSettingsPromise;
}

async function loadCachedUploaderBlocklist(): Promise<BlockedUploader[]> {
  if (cachedUploaderBlocklist) return cachedUploaderBlocklist;
  if (!pendingBlocklistPromise) {
    const request = getUploaderBlocklist()
      .then(blocklist => {
        if (pendingBlocklistPromise === request) {
          cachedUploaderBlocklist = blocklist;
          pendingBlocklistPromise = undefined;
        }
        return blocklist;
      })
      .catch(error => {
        if (pendingBlocklistPromise === request) {
          pendingBlocklistPromise = undefined;
        }
        throw error;
      });
    pendingBlocklistPromise = request;
  }
  return pendingBlocklistPromise;
}

async function getContentSettings(): Promise<{
  searchFilter: SearchFilterSettings;
  favoriteRecommendation: FavoriteRecommendationSettings;
  personalization: PlayerPersonalizationSettings;
  watchTimer: WatchTimerSettings;
  watchTimerEnabled: boolean;
  watchReminder: WatchReminderSettings;
  watchReminderEnabled: boolean;
  uploaderBlocklist: BlockedUploader[];
  uploaderBlockingEnabled: boolean;
  pluginEnabled: boolean;
}> {
  const [settings, uploaderBlocklist] = await Promise.all([
    loadCachedSettings(),
    loadCachedUploaderBlocklist(),
  ]);
  const pluginEnabled = settings.features.enabled;

  return {
    searchFilter: pluginEnabled
      ? settings.searchFilter
      : { ...settings.searchFilter, enabled: false },
    favoriteRecommendation: pluginEnabled
      ? settings.favoriteRecommendation
      : { ...settings.favoriteRecommendation, enabled: false },
    personalization: pluginEnabled ? settings.personalization : disabledPersonalization,
    watchTimer: settings.watchTimer,
    watchTimerEnabled: pluginEnabled && settings.features.watchTimer,
    watchReminder: settings.watchReminder,
    watchReminderEnabled: pluginEnabled && settings.features.watchReminder,
    uploaderBlocklist,
    uploaderBlockingEnabled: pluginEnabled,
    pluginEnabled,
  };
}

function scheduleScan(delay = 150) {
  if (extensionContextInvalidated) return;
  window.clearTimeout(rescanTimer);
  rescanTimer = window.setTimeout(() => {
    if (scanQueued) return;
    scanQueued = true;
    window.requestAnimationFrame(() => {
      scanQueued = false;
      runContentTask(scanCurrentPage());
    });
  }, delay);
}

function startManagedPage(): void {
  if (managedPageActive) return;

  managedPageActive = true;
  watchUrlChanges();
  watchManagedPage();
}

function stopManagedPage(): void {
  managedPageActive = false;
  scanGeneration += 1;
  observer?.disconnect();
  observer = undefined;
  window.clearTimeout(rescanTimer);
  rescanTimer = undefined;
  unbindUrlChanges?.();
  unbindUrlChanges = undefined;
  scanQueued = false;
  syncPageThemeUpdates(false);
}

function watchManagedPage() {
  observer?.disconnect();
  observer = undefined;

  if (isSearchPage()) {
    observer = new MutationObserver(records => {
      if (records.every(isSearchBypassBarMutation)) return;
      scheduleScan();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return;
  }

  if (!isPlayerPage()) return;

  const targets = getPlayerObservationTargets();
  observer = new MutationObserver(records => {
    if (records.every(isIgnoredPlayerMutation)) return;
    scheduleScan(80);
  });
  targets.forEach(target => {
    observer?.observe(target, { childList: true, subtree: true });
  });
}

function handleUrlCheck(): void {
  if (location.href === currentUrl) return;

  currentUrl = location.href;
  watchManagedPage();
  scheduleScan(0);
}

function getWindowNavigation(): NavigationEventTarget | undefined {
  if (!("navigation" in window)) return undefined;
  const candidate = (window as Window & { navigation?: unknown }).navigation;
  if (
    candidate &&
    typeof candidate === "object" &&
    "addEventListener" in candidate &&
    "removeEventListener" in candidate &&
    typeof candidate.addEventListener === "function" &&
    typeof candidate.removeEventListener === "function"
  ) {
    return candidate as NavigationEventTarget;
  }
  return undefined;
}

function watchUrlChanges() {
  if (unbindUrlChanges) return;

  window.addEventListener("popstate", handleUrlCheck);
  window.addEventListener("hashchange", handleUrlCheck);
  const navigation = getWindowNavigation();
  navigation?.addEventListener("navigatesuccess", handleUrlCheck);
  const timerId = window.setInterval(handleUrlCheck, URL_POLL_INTERVAL_MS);

  unbindUrlChanges = () => {
    window.removeEventListener("popstate", handleUrlCheck);
    window.removeEventListener("hashchange", handleUrlCheck);
    navigation?.removeEventListener("navigatesuccess", handleUrlCheck);
    window.clearInterval(timerId);
  };
}

function bindStorageChanges() {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local") return;

    let shouldScan = false;
    if (changes[SETTINGS_KEY]) {
      cachedSettings = undefined;
      pendingSettingsPromise = undefined;
      shouldScan = true;
    }
    if (changes[UPLOADER_BLOCKLIST_KEY]) {
      cachedUploaderBlocklist = undefined;
      pendingBlocklistPromise = undefined;
      shouldScan = true;
    }
    if (changes[CUSTOM_BACKGROUND_IMAGE_KEY]) {
      shouldScan = true;
    }

    if (shouldScan) scheduleScan(0);
  });
}

function syncPageThemeUpdates(shouldWatch: boolean): void {
  if (shouldWatch && managedPageActive) {
    bindPageThemeUpdates();
    return;
  }

  unbindPageThemeUpdates?.();
  unbindPageThemeUpdates = undefined;
}

function bindPageThemeUpdates() {
  if (unbindPageThemeUpdates) return;

  unbindPageThemeUpdates = bindBilibiliPageThemeUpdates(() => scheduleScan(0));
}

function bindRuntimeMessages() {
  chrome.runtime.onMessage.addListener(
    (message: ExtensionMessage, _sender, sendResponse: (response: unknown) => void) => {
      if (message.type === "BILI_FILTER_GET_PAGE_STATUS") {
        runContentTask(
          scanCurrentPage().then(stats => {
            sendResponse({
              ok: true,
              source: "content",
              receivedAt: new Date().toISOString(),
              snapshot: getSearchSnapshot(stats),
              stats,
            });
          }),
        );
        return true;
      }

      if (message.type === "BILI_FILTER_SETTINGS_UPDATED") {
        cachedSettings = undefined;
        pendingSettingsPromise = undefined;
        cachedUploaderBlocklist = undefined;
        pendingBlocklistPromise = undefined;
        runContentTask(
          scanCurrentPage().then(stats => {
            sendResponse({
              ok: true,
              source: "content",
              receivedAt: new Date().toISOString(),
              snapshot: getSearchSnapshot(stats),
              stats,
            });
          }),
        );
        return true;
      }

      return false;
    },
  );
}

async function boot() {
  window.addEventListener("unhandledrejection", handleUnhandledRejection);
  bindRuntimeMessages();
  bindStorageChanges();
  await scanCurrentPage();
  await sendRuntimeMessage({ type: "BILI_FILTER_HELLO", payload: getSnapshot() });
}

function runContentTask(task: Promise<unknown>): void {
  void task.catch(error => {
    if (isExtensionContextInvalidated(error)) {
      invalidateExtensionContext();
      return;
    }
    console.error("[BiliManager] 内容脚本任务失败", error);
  });
}

function handleUnhandledRejection(event: PromiseRejectionEvent): void {
  if (!isExtensionContextInvalidated(event.reason)) return;
  event.preventDefault();
  invalidateExtensionContext();
}

function invalidateExtensionContext(): void {
  if (extensionContextInvalidated) return;
  extensionContextInvalidated = true;
  stopManagedPage();
}

function isSearchBypassBarMutation(record: MutationRecord): boolean {
  if (record.target instanceof Element && record.target.closest(`#${SEARCH_BYPASS_BAR_ID}`)) {
    return true;
  }

  const changedNodes = [...record.addedNodes, ...record.removedNodes];
  return (
    changedNodes.length > 0 &&
    changedNodes.every(
      node => node instanceof Element && node.closest(`#${SEARCH_BYPASS_BAR_ID}`) !== null,
    )
  );
}

async function sendRuntimeMessage(message: ExtensionMessage) {
  return sendMessage(message);
}

runContentTask(boot());
