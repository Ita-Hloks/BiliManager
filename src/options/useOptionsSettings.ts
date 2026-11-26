import { useCallback, useEffect, useRef, useState } from "react";
import {
  clearCustomBackgroundImage,
  CUSTOM_BACKGROUND_IMAGE_KEY,
  getCustomBackgroundImage,
  saveCustomBackgroundImage,
} from "../shared/customBackgroundStorage";
import type { StoredCustomBackgroundImage } from "../shared/customBackgroundStorage";
import { sendMessage } from "../shared/messaging";
import { normalizeSettings } from "../shared/settingsSchema";
import { defaultSettings, getSettings, saveSettings, SETTINGS_KEY } from "../shared/storage";
import type {
  CustomBackgroundSettings,
  ExtensionSettings,
  FavoriteRecommendationSettings,
  PlayerPersonalizationSettings,
  SearchFilterSettings,
  WatchReminderSettings,
  WatchTimerSettings,
} from "../shared/types";
import {
  getUploaderBlocklist,
  removeBlockedUploader,
  UPLOADER_BLOCKLIST_KEY,
} from "../shared/uploaderBlocklist";
import type { BlockedUploader } from "../shared/uploaderBlocklist";
import type { FavoriteFolderRefreshResult } from "./components/favoriteFolderManager";
import type { DataExportKind } from "./dataTransfer";
import {
  createDataExportPayload,
  getExportFileName,
  getExportMessage,
  importDataBackup,
} from "./dataTransfer";
import { createBackgroundImageAsset, formatDateForFile } from "./utils";

const SLIDER_DEBOUNCE_MS = 250;
const SELF_SAVE_WINDOW_TTL_MS = 10_000;

export type OptionsStatusMessage = {
  text: string;
  tone: "info" | "error";
};

export type UpdateCommitOptions = {
  debounce?: boolean;
};

type SelfSaveRecord = {
  savedAt: string;
  startMs: number;
  endMs: number;
  signature: string;
};

export function useOptionsSettings(params: {
  initialSettings: ExtensionSettings;
  initialUploaderBlocklist: BlockedUploader[];
  initialBackgroundImage: StoredCustomBackgroundImage | null;
}) {
  const [settings, setSettings] = useState<ExtensionSettings>(params.initialSettings);
  const [uploaderBlocklist, setUploaderBlocklist] = useState<BlockedUploader[]>(
    params.initialUploaderBlocklist,
  );
  const [backgroundImage, setBackgroundImage] = useState<StoredCustomBackgroundImage | null>(
    params.initialBackgroundImage,
  );
  const [backgroundMessage, setBackgroundMessage] = useState<OptionsStatusMessage | null>(null);
  const [importMessage, setImportMessage] = useState<OptionsStatusMessage | null>(null);

  const settingsRef = useRef<ExtensionSettings>(params.initialSettings);
  const pendingSettingsRef = useRef<ExtensionSettings | null>(null);
  const debounceTimerRef = useRef<number | null>(null);
  const lastSelfSavedAtRef = useRef<string | null>(null);
  const recentSelfSavesRef = useRef<SelfSaveRecord[]>([]);
  const inFlightSavesRef = useRef(0);
  const importInputRef = useRef<HTMLInputElement>(null);

  const persistSettings = useCallback(async (next: ExtensionSettings) => {
    const startMs = Date.now();
    lastSelfSavedAtRef.current = next.updatedAt;
    inFlightSavesRef.current += 1;

    try {
      const savePromise = saveSettings(next);
      const endMs = Date.now();
      const cutoff = endMs - SELF_SAVE_WINDOW_TTL_MS;
      recentSelfSavesRef.current = [
        ...recentSelfSavesRef.current.filter(record => record.endMs >= cutoff).slice(-9),
        {
          savedAt: next.updatedAt,
          startMs,
          endMs,
          signature: getSettingsSignature(next),
        },
      ];
      await savePromise;
    } finally {
      inFlightSavesRef.current = Math.max(0, inFlightSavesRef.current - 1);
    }
  }, []);

  const flushPendingSettings = useCallback(() => {
    if (debounceTimerRef.current !== null) {
      window.clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    const pending = pendingSettingsRef.current;
    if (!pending) return;
    pendingSettingsRef.current = null;
    void persistSettings(pending);
  }, [persistSettings]);

  const commitSettings = useCallback(
    (
      updater: (current: ExtensionSettings) => ExtensionSettings,
      options?: { debounceMs?: number },
    ) => {
      const next: ExtensionSettings = {
        ...updater(settingsRef.current),
        updatedAt: new Date().toISOString(),
      };
      settingsRef.current = next;
      setSettings(next);

      if (debounceTimerRef.current !== null) {
        window.clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }

      if (options?.debounceMs && options.debounceMs > 0) {
        pendingSettingsRef.current = next;
        debounceTimerRef.current = window.setTimeout(() => {
          debounceTimerRef.current = null;
          const pending = pendingSettingsRef.current;
          if (!pending) return;
          pendingSettingsRef.current = null;
          void persistSettings(pending);
        }, options.debounceMs);
        return;
      }

      pendingSettingsRef.current = null;
      void persistSettings(next);
    },
    [persistSettings],
  );

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        flushPendingSettings();
      }
    };
    const handlePageHide = () => {
      flushPendingSettings();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", handlePageHide);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", handlePageHide);
      flushPendingSettings();
    };
  }, [flushPendingSettings]);

  useEffect(() => {
    if (typeof chrome === "undefined" || !chrome.storage?.onChanged) return;
    let active = true;

    const syncStoredState = (
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string,
    ) => {
      if (areaName !== "local") return;

      if (changes[SETTINGS_KEY]) {
        const newValue = changes[SETTINGS_KEY].newValue as Partial<ExtensionSettings> | undefined;
        if (
          !isSelfSavedSettingsChange(
            newValue,
            lastSelfSavedAtRef.current,
            recentSelfSavesRef.current,
          )
        ) {
          void getSettings().then(nextSettings => {
            if (!active) return;
            settingsRef.current = nextSettings;
            setSettings(nextSettings);
          });
        }
      }

      if (changes[UPLOADER_BLOCKLIST_KEY]) {
        void getUploaderBlocklist().then(nextBlocklist => {
          if (!active) return;
          setUploaderBlocklist(nextBlocklist);
        });
      }

      if (changes[CUSTOM_BACKGROUND_IMAGE_KEY]) {
        const newValue = changes[CUSTOM_BACKGROUND_IMAGE_KEY].newValue;
        if (!newValue) {
          setBackgroundImage(prev => (prev === null ? prev : null));
        } else {
          void getCustomBackgroundImage().then(nextImage => {
            if (!active) return;
            setBackgroundImage(prev =>
              prev?.dataUrl === nextImage?.dataUrl && prev?.revision === nextImage?.revision
                ? prev
                : nextImage,
            );
          });
        }
      }
    };

    chrome.storage.onChanged.addListener(syncStoredState);
    return () => {
      active = false;
      chrome.storage.onChanged.removeListener(syncStoredState);
    };
  }, []);

  const updatePluginEnabled = useCallback(
    (enabled: boolean) => {
      commitSettings(current => ({
        ...current,
        features: {
          ...current.features,
          enabled,
        },
      }));
    },
    [commitSettings],
  );

  const updateSearchFilter = useCallback(
    (patch: Partial<SearchFilterSettings>, options?: UpdateCommitOptions) => {
      commitSettings(
        current => {
          const searchFilter = {
            ...current.searchFilter,
            ...patch,
          };
          if (searchFilter.filterMissingTitleHighlight) {
            searchFilter.grayscaleMissingTitleHighlight = true;
          }
          if (searchFilter.filterLowDanmakuViewRate) {
            searchFilter.grayscaleLowDanmakuViewRate = true;
          }
          return {
            ...current,
            searchFilter,
          };
        },
        options?.debounce ? { debounceMs: SLIDER_DEBOUNCE_MS } : undefined,
      );
    },
    [commitSettings],
  );

  const updateFavoriteRecommendation = useCallback(
    (patch: Partial<FavoriteRecommendationSettings>, options?: UpdateCommitOptions) => {
      commitSettings(
        current => ({
          ...current,
          favoriteRecommendation: {
            ...current.favoriteRecommendation,
            ...patch,
          },
        }),
        options?.debounce ? { debounceMs: SLIDER_DEBOUNCE_MS } : undefined,
      );
    },
    [commitSettings],
  );

  const refreshFavoriteRecommendation = useCallback(
    async (folderIds: string[]): Promise<FavoriteFolderRefreshResult[]> => {
      const uniqueFolderIds = [...new Set(folderIds.filter(folderId => /^\d+$/.test(folderId)))];
      return Promise.all(
        uniqueFolderIds.map(async folderId => {
          try {
            const response = await sendMessage({
              type: "BILI_FILTER_REFRESH_FAVORITE_VIDEOS",
              payload: { folderId },
            });
            if (!response || !response.ok) {
              return {
                folderId,
                ok: false,
                error: response?.error ?? `收藏夹 ID ${folderId} 获取失败`,
              } satisfies FavoriteFolderRefreshResult;
            }
            if (!("favoriteFolder" in response)) {
              return {
                folderId,
                ok: false,
                error: `收藏夹 ID ${folderId} 响应格式无效`,
              } satisfies FavoriteFolderRefreshResult;
            }
            return {
              folderId,
              ok: true,
              videoCount: response.favoriteFolder.videos.length,
            } satisfies FavoriteFolderRefreshResult;
          } catch (error) {
            return {
              folderId,
              ok: false,
              error: error instanceof Error ? error.message : `收藏夹 ID ${folderId} 获取失败`,
            } satisfies FavoriteFolderRefreshResult;
          }
        }),
      );
    },
    [],
  );

  const updatePersonalization = useCallback(
    (patch: Partial<PlayerPersonalizationSettings>, options?: UpdateCommitOptions) => {
      commitSettings(
        current => {
          const personalization = {
            ...current.personalization,
            ...patch,
          };
          if (personalization.blockRelatedVideos) {
            personalization.disableRecommendationAutoplay = true;
          }
          return {
            ...current,
            personalization,
          };
        },
        options?.debounce ? { debounceMs: SLIDER_DEBOUNCE_MS } : undefined,
      );
    },
    [commitSettings],
  );

  const updateCustomBackground = useCallback(
    (patch: Partial<CustomBackgroundSettings>, options?: UpdateCommitOptions) => {
      commitSettings(
        current => ({
          ...current,
          personalization: {
            ...current.personalization,
            customBackground: {
              ...current.personalization.customBackground,
              ...patch,
            },
          },
        }),
        options?.debounce ? { debounceMs: SLIDER_DEBOUNCE_MS } : undefined,
      );
    },
    [commitSettings],
  );

  const uploadCustomBackground = useCallback(
    async (file: File) => {
      try {
        const { dataUrl, width, height } = await createBackgroundImageAsset(file);
        const nextRevision =
          Math.max(0, settingsRef.current.personalization.customBackground.imageRevision) + 1;
        const asset: StoredCustomBackgroundImage = {
          dataUrl,
          revision: nextRevision,
          width,
          height,
        };
        await saveCustomBackgroundImage(asset);
        setBackgroundImage(asset);
        commitSettings(current => ({
          ...current,
          personalization: {
            ...current.personalization,
            customBackground: {
              ...current.personalization.customBackground,
              enabled: true,
              hasImage: true,
              imageRevision: nextRevision,
            },
          },
        }));
        setBackgroundMessage({ text: "已更新背景图", tone: "info" });
      } catch (error) {
        setBackgroundMessage({
          text: error instanceof Error ? error.message : "背景图上传失败",
          tone: "error",
        });
      }
    },
    [commitSettings],
  );

  const clearCustomBackground = useCallback(async () => {
    try {
      await clearCustomBackgroundImage();
      setBackgroundImage(null);
      commitSettings(current => ({
        ...current,
        personalization: {
          ...current.personalization,
          customBackground: {
            enabled: false,
            hasImage: false,
            imageRevision: 0,
            maskOpacity: defaultSettings.personalization.customBackground.maskOpacity,
            positionX: 50,
            positionY: 50,
          },
        },
      }));
      setBackgroundMessage({ text: "已清除背景图", tone: "info" });
    } catch (error) {
      setBackgroundMessage({
        text: error instanceof Error ? error.message : "清除背景图失败",
        tone: "error",
      });
    }
  }, [commitSettings]);

  const updateWatchTimer = useCallback(
    (patch: Partial<WatchTimerSettings>, options?: UpdateCommitOptions) => {
      commitSettings(
        current => ({
          ...current,
          watchTimer: {
            ...current.watchTimer,
            ...patch,
          },
        }),
        options?.debounce ? { debounceMs: SLIDER_DEBOUNCE_MS } : undefined,
      );
    },
    [commitSettings],
  );

  const updateWatchTimerEnabled = useCallback(
    (enabled: boolean) => {
      commitSettings(current => ({
        ...current,
        features: {
          ...current.features,
          watchTimer: enabled,
        },
      }));
    },
    [commitSettings],
  );

  const updateWatchReminder = useCallback(
    (patch: Partial<WatchReminderSettings>) => {
      commitSettings(current => ({
        ...current,
        watchReminder: {
          ...current.watchReminder,
          ...patch,
        },
      }));
    },
    [commitSettings],
  );

  const updateWatchReminderEnabled = useCallback(
    (enabled: boolean) => {
      commitSettings(current => ({
        ...current,
        features: {
          ...current.features,
          watchReminder: enabled,
        },
      }));
    },
    [commitSettings],
  );

  const updateTheme = useCallback(
    (theme: ExtensionSettings["theme"]) => {
      commitSettings(current => ({
        ...current,
        theme,
      }));
    },
    [commitSettings],
  );

  const unblockUploader = useCallback(async (id: string) => {
    setUploaderBlocklist(current => current.filter(item => item.id !== id));
    await removeBlockedUploader(id);
  }, []);

  const importSettings = useCallback(
    async (file: File) => {
      try {
        const result = await importDataBackup(await file.text(), settingsRef.current);
        if (result.settings) {
          const imported = result.settings;
          commitSettings(() => imported);
        }
        setImportMessage({ text: result.message, tone: "info" });
      } catch (error) {
        setImportMessage({
          text: error instanceof Error ? error.message : "导入失败",
          tone: "error",
        });
      } finally {
        if (importInputRef.current) importInputRef.current.value = "";
      }
    },
    [commitSettings],
  );

  const exportSettings = useCallback(async (kind: DataExportKind) => {
    try {
      const payload = await createDataExportPayload(kind, settingsRef.current);
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = getExportFileName(kind, formatDateForFile(new Date()));
      link.click();
      URL.revokeObjectURL(url);
      setImportMessage({ text: getExportMessage(kind), tone: "info" });
    } catch (error) {
      setImportMessage({
        text: error instanceof Error ? error.message : "导出失败",
        tone: "error",
      });
    }
  }, []);

  return {
    settings,
    uploaderBlocklist,
    backgroundImage,
    backgroundMessage,
    importMessage,
    importInputRef,
    updatePluginEnabled,
    updateSearchFilter,
    updateFavoriteRecommendation,
    refreshFavoriteRecommendation,
    updatePersonalization,
    updateWatchTimer,
    updateWatchTimerEnabled,
    updateWatchReminder,
    updateWatchReminderEnabled,
    updateCustomBackground,
    uploadCustomBackground,
    clearCustomBackground,
    updateTheme,
    unblockUploader,
    importSettings,
    exportSettings,
  };
}

function getSettingsSignature(settings: ExtensionSettings): string {
  return JSON.stringify({ ...settings, updatedAt: "" });
}

function isSelfSavedSettingsChange(
  newValue: Partial<ExtensionSettings> | undefined,
  lastSelfSavedAt: string | null,
  recentSelfSaves: SelfSaveRecord[],
): boolean {
  if (!newValue || typeof newValue !== "object") return false;
  const newUpdatedAt = typeof newValue.updatedAt === "string" ? newValue.updatedAt : null;
  if (newUpdatedAt && lastSelfSavedAt && newUpdatedAt === lastSelfSavedAt) {
    return true;
  }

  if (!newUpdatedAt) return false;
  const newUpdatedAtMs = Date.parse(newUpdatedAt);
  if (!Number.isFinite(newUpdatedAtMs)) return false;

  const incomingSignature = getSettingsSignature(normalizeSettings(newValue, defaultSettings));
  return recentSelfSaves.some(
    record =>
      record.signature === incomingSignature &&
      newUpdatedAtMs >= record.startMs - 5 &&
      newUpdatedAtMs <= record.endMs + 5,
  );
}
