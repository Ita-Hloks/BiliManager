import { hasChromeLocalStorage } from "./chromeStorage";
import { defaultSettings, normalizeSettings } from "./settingsSchema";
import type { ExtensionSettings } from "./types";

export const SETTINGS_KEY = "biliFilter.settings";

export { defaultSettings } from "./settingsSchema";

export async function getSettings(): Promise<ExtensionSettings> {
  if (!hasChromeLocalStorage()) return defaultSettings;
  const result = await chrome.storage.local.get(SETTINGS_KEY);
  const saved = result[SETTINGS_KEY] as Partial<ExtensionSettings> | undefined;
  return normalizeSettings(saved, defaultSettings);
}

export async function saveSettings(settings: ExtensionSettings): Promise<void> {
  const next = { ...settings, updatedAt: new Date().toISOString() };
  if (!hasChromeLocalStorage()) return;
  await chrome.storage.local.set({ [SETTINGS_KEY]: next });
}
