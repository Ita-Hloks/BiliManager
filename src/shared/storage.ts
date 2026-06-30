import type { ExtensionSettings } from "./types";

const SETTINGS_KEY = "biliFilter.settings";

export const defaultSettings: ExtensionSettings = {
  features: {
    searchFilter: false,
    watchTimer: false,
    dailyStats: false,
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
  return { ...defaultSettings, ...(result[SETTINGS_KEY] as Partial<ExtensionSettings> | undefined) };
}

export async function saveSettings(settings: ExtensionSettings): Promise<void> {
  const next = { ...settings, updatedAt: new Date().toISOString() };
  if (!hasChromeStorage()) return;
  await chrome.storage.local.set({ [SETTINGS_KEY]: next });
}
