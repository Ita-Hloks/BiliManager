import type { ExtensionSettings } from "./types";

const SETTINGS_KEY = "biliFilter.settings";

export const defaultSettings: ExtensionSettings = {
  features: {
    enabled: true,
    searchFilter: true,
    personalization: false,
    watchTimer: false,
    dailyStats: false,
  },
  // searchFilter.enabled 是内容脚本实际开关，features.searchFilter 用于设置页功能分组同步。
  searchFilter: {
    enabled: true,
    titlePattern: "",
    uploaderPattern: "",
    minDanmakuViewRate: 0.005,
    filterMissingTitleHighlight: true,
  },
  personalization: {
    blockRelatedVideos: false,
    blockPlayerAds: false,
    disableRecommendationAutoplay: false,
  },
  watchTimer: {
    opacity: 0.86,
  },
  theme: "system",
  updatedAt: new Date(0).toISOString(),
};

function hasChromeStorage() {
  return typeof chrome !== "undefined" && !!chrome.storage?.local;
}

export async function getSettings(): Promise<ExtensionSettings> {
  if (!hasChromeStorage()) return defaultSettings;
  const result = await chrome.storage.local.get(SETTINGS_KEY);
  const saved = result[SETTINGS_KEY] as Partial<ExtensionSettings> | undefined;
  return {
    ...defaultSettings,
    ...saved,
    features: {
      ...defaultSettings.features,
      ...saved?.features,
    },
    searchFilter: {
      ...defaultSettings.searchFilter,
      ...saved?.searchFilter,
    },
    personalization: {
      ...defaultSettings.personalization,
      ...saved?.personalization,
    },
    watchTimer: {
      ...defaultSettings.watchTimer,
      ...saved?.watchTimer,
    },
  };
}

export async function saveSettings(settings: ExtensionSettings): Promise<void> {
  const next = { ...settings, updatedAt: new Date().toISOString() };
  if (!hasChromeStorage()) return;
  await chrome.storage.local.set({ [SETTINGS_KEY]: next });
}
