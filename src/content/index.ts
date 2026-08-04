import type { ExtensionMessage } from "../shared/messaging";
import { sendMessage } from "../shared/messaging";
import { hasExtensionContext, isExtensionContextInvalidated } from "../shared/extensionContext";
import { getSettings, SETTINGS_KEY } from "../shared/storage";
import { loadSearchTagIndex } from "./searchTags";
import { getTagBlocklist, TAG_BLOCKLIST_KEY } from "../shared/tagBlocklist";
import type { BlockedTag } from "../shared/tagBlocklist";
import { getUploaderBlocklist, UPLOADER_BLOCKLIST_KEY } from "../shared/uploaderBlocklist";
import type { BlockedUploader } from "../shared/uploaderBlocklist";
import type {
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
  isPlayerPage,
} from "./playerPersonalization";
import { applyCustomBackground } from "./customBackground";
import { bindBilibiliPageThemeUpdates } from "./pageThemeEvents";
import { applyPlayerWatchTimer } from "./playerWatchTimer";
import { applyPlayerWatchReminder } from "./playerWatchReminder";
import {
  applySearchFilter,
  clearSearchFilter,
  getSearchSnapshot,
  isSearchPage,
} from "./searchFilter";
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
let urlPollTimer: number | undefined;
let currentUrl = location.href;
let scanQueued = false;
let unbindPageThemeUpdates: (() => void) | undefined;
let scanGeneration = 0;
let scanRequest = 0;
let managedPageActive = false;
let extensionContextInvalidated = false;

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
  applySearchCleanup(settings.personalization.filterTrending);
  applyPlayerPersonalization(settings.personalization);
  applyCustomBackground(settings.personalization.customBackground);
  applyPlayerWatchTimer(settings.watchTimerEnabled, settings.watchTimer);
  applyPlayerWatchReminder(settings.watchReminderEnabled, settings.watchReminder);
  if (searchPage) {
    const searchUrl = location.href;
    const tagSnapshot = settings.tagBlockingEnabled
      ? loadSearchTagIndex(searchUrl)
      : { ready: true, index: {} };
    if (generation !== scanGeneration || request !== scanRequest || location.href !== searchUrl) {
      scheduleScan(0);
      return unavailableSearchStats;
    }
    const cachedRecommendationPool = getCachedFavoriteRecommendationPool(
      settings.favoriteRecommendation,
    );
    const initialStats = applySearchFilter(
      settings.searchFilter,
      cachedRecommendationPool ?? undefined,
      settings.uploaderBlocklist,
      settings.uploaderBlockingEnabled,
      settings.tagBlocklist,
      settings.tagBlockingEnabled,
      tagSnapshot.index,
      tagSnapshot.ready,
    );
    if (
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
    const latestTagSnapshot = settings.tagBlockingEnabled
      ? loadSearchTagIndex(searchUrl)
      : tagSnapshot;
    return applySearchFilter(
      settings.searchFilter,
      recommendationPool,
      settings.uploaderBlocklist,
      settings.uploaderBlockingEnabled,
      settings.tagBlocklist,
      settings.tagBlockingEnabled,
      latestTagSnapshot.index,
      latestTagSnapshot.ready,
    );
  }

  clearSearchFilter();
  return {
    ...unavailableSearchStats,
    enabled: settings.searchFilter.enabled,
    updatedAt: new Date().toISOString(),
  };
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
  tagBlocklist: BlockedTag[];
  tagBlockingEnabled: boolean;
  pluginEnabled: boolean;
}> {
  const [settings, uploaderBlocklist, tagBlocklist] = await Promise.all([
    getSettings(),
    getUploaderBlocklist(),
    getTagBlocklist(),
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
    tagBlocklist,
    tagBlockingEnabled: pluginEnabled,
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
  if (!urlPollTimer) watchUrlChanges();
  bindPageThemeUpdates();
  watchManagedPage();
}

function stopManagedPage(): void {
  managedPageActive = false;
  scanGeneration += 1;
  observer?.disconnect();
  observer = undefined;
  window.clearTimeout(rescanTimer);
  rescanTimer = undefined;
  window.clearInterval(urlPollTimer);
  urlPollTimer = undefined;
  scanQueued = false;
  unbindPageThemeUpdates?.();
  unbindPageThemeUpdates = undefined;
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
  if (urlPollTimer) return;

  urlPollTimer = window.setInterval(() => {
    if (location.href === currentUrl) return;

    currentUrl = location.href;
    watchManagedPage();
    scheduleScan(0);
  }, 500);
}

function bindStorageChanges() {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (
      areaName === "local" &&
      (changes[SETTINGS_KEY] || changes[UPLOADER_BLOCKLIST_KEY] || changes[TAG_BLOCKLIST_KEY])
    ) {
      scheduleScan(0);
    }
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

async function sendRuntimeMessage(message: ExtensionMessage) {
  return sendMessage(message);
}

runContentTask(boot());
