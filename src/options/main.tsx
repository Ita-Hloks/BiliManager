import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { BellRing, Clock, Download, Filter, Settings2, Sparkles, UserX } from "lucide-react";
import "../styles/globals.css";
import "../styles/options-controls.css";
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
import { GeneralSettingsPanel } from "./panels/generalSettingsPanel";
import { PersonalizationPanel } from "./panels/personalizationPanel";
import { SearchFilterPanel } from "./panels/searchFilterPanel";
import { WatchTimerPanel } from "./panels/watchTimerPanel";
import { WatchReminderPanel } from "./panels/watchReminderPanel";
import type { FavoriteFolderRefreshResult } from "./components/favoriteFolderManager";
import type { DataExportKind } from "./dataTransfer";
import {
  createDataExportPayload,
  getExportFileName,
  getExportMessage,
  importDataBackup,
} from "./dataTransfer";
import { useEffectiveDarkTheme } from "../shared/useEffectiveDarkTheme";
import { createBackgroundDataUrl, formatDateForFile } from "./utils";
import { sendMessage } from "../shared/messaging";
import {
  getUploaderBlocklist,
  removeBlockedUploader,
  UPLOADER_BLOCKLIST_KEY,
} from "../shared/uploaderBlocklist";
import type { BlockedUploader } from "../shared/uploaderBlocklist";
import { BlocklistSettingsPanel } from "./panels/blocklistSettingsPanel";

type SectionId =
  | "search-filter"
  | "blocklist"
  | "playback"
  | "watch-timer"
  | "watch-reminder"
  | "general-appearance"
  | "data";

const sectionNavItems = [
  { id: "search-filter", label: "过滤搜索", icon: Filter },
  { id: "blocklist", label: "屏蔽列表", icon: UserX },
  { id: "playback", label: "播放器", icon: Sparkles },
  { id: "watch-timer", label: "计时器", icon: Clock },
  { id: "watch-reminder", label: "定时器", icon: BellRing },
  { id: "general-appearance", label: "界面", icon: Settings2 },
  { id: "data", label: "数据管理", icon: Download },
] as const satisfies ReadonlyArray<{
  id: SectionId;
  label: string;
  icon: typeof Filter;
}>;

function OptionsApp() {
  const [settings, setSettings] = useState<ExtensionSettings>(defaultSettings);
  const [importMessage, setImportMessage] = useState("");
  const [backgroundMessage, setBackgroundMessage] = useState("");
  const [uploaderBlocklist, setUploaderBlocklist] = useState<BlockedUploader[]>([]);
  const [activeSection, setActiveSection] = useState<SectionId>("search-filter");
  const importInputRef = useRef<HTMLInputElement>(null);
  const isDark = useEffectiveDarkTheme(settings.theme);

  useEffect(() => {
    void Promise.all([getSettings(), getUploaderBlocklist()]).then(
      ([nextSettings, nextUploaderBlocklist]) => {
        setSettings(nextSettings);
        setUploaderBlocklist(nextUploaderBlocklist);
      },
    );
  }, []);

  useEffect(() => {
    if (typeof chrome === "undefined" || !chrome.storage?.onChanged) return;

    const syncStoredSettings = (
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string,
    ) => {
      if (areaName !== "local") return;
      if (changes[SETTINGS_KEY]) void getSettings().then(setSettings);
      if (changes[UPLOADER_BLOCKLIST_KEY]) {
        void getUploaderBlocklist().then(setUploaderBlocklist);
      }
    };

    chrome.storage.onChanged.addListener(syncStoredSettings);
    return () => chrome.storage.onChanged.removeListener(syncStoredSettings);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
    document.documentElement.style.colorScheme = isDark ? "dark" : "light";
  }, [isDark]);

  useEffect(() => {
    let frameId: number | null = null;

    const updateActiveSection = () => {
      const scrollThreshold = window.scrollY + 96;
      let nextSection: SectionId = sectionNavItems[0].id;

      for (const item of sectionNavItems) {
        const section = document.getElementById(item.id);
        if (!section) continue;

        const sectionTop = section.getBoundingClientRect().top + window.scrollY;
        if (sectionTop <= scrollThreshold) nextSection = item.id;
      }

      const isAtPageBottom =
        window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 4;
      const lastSectionId = sectionNavItems.at(-1)?.id;
      if (isAtPageBottom && lastSectionId) nextSection = lastSectionId;

      setActiveSection(nextSection);
    };

    const handleScroll = () => {
      if (frameId !== null) return;

      frameId = window.requestAnimationFrame(() => {
        frameId = null;
        updateActiveSection();
      });
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (frameId !== null) window.cancelAnimationFrame(frameId);
    };
  }, []);

  async function updateSettings(next: ExtensionSettings) {
    setSettings(next);
    await saveSettings(next);
  }

  async function unblockUploader(id: string) {
    await removeBlockedUploader(id);
  }

  async function updateSearchFilter(patch: Partial<SearchFilterSettings>) {
    const searchFilter = {
      ...settings.searchFilter,
      ...patch,
    };
    if (searchFilter.filterMissingTitleHighlight) {
      searchFilter.grayscaleMissingTitleHighlight = true;
    }
    if (searchFilter.filterLowDanmakuViewRate) {
      searchFilter.grayscaleLowDanmakuViewRate = true;
    }
    await updateSettings({
      ...settings,
      searchFilter,
    });
  }

  async function updateFavoriteRecommendation(patch: Partial<FavoriteRecommendationSettings>) {
    await updateSettings({
      ...settings,
      favoriteRecommendation: {
        ...settings.favoriteRecommendation,
        ...patch,
      },
    });
  }

  async function refreshFavoriteRecommendation(
    folderIds: string[],
  ): Promise<FavoriteFolderRefreshResult[]> {
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
  }

  async function updatePersonalization(patch: Partial<PlayerPersonalizationSettings>) {
    const personalization = {
      ...settings.personalization,
      ...patch,
    };
    if (personalization.blockRelatedVideos) {
      personalization.disableRecommendationAutoplay = true;
    }

    await updateSettings({
      ...settings,
      personalization,
    });
  }

  async function updateWatchTimer(patch: Partial<WatchTimerSettings>) {
    await updateSettings({
      ...settings,
      watchTimer: {
        ...settings.watchTimer,
        ...patch,
      },
    });
  }

  async function updateWatchTimerEnabled(enabled: boolean) {
    await updateSettings({
      ...settings,
      features: {
        ...settings.features,
        watchTimer: enabled,
      },
    });
  }

  async function updateWatchReminder(patch: Partial<WatchReminderSettings>) {
    await updateSettings({
      ...settings,
      watchReminder: {
        ...settings.watchReminder,
        ...patch,
      },
    });
  }

  async function updateWatchReminderEnabled(enabled: boolean) {
    await updateSettings({
      ...settings,
      features: {
        ...settings.features,
        watchReminder: enabled,
      },
    });
  }

  // 自定义背景属于 personalization 的子设置，所有背景改动都从这里进入以复用功能启用状态推导。
  async function updateCustomBackground(patch: Partial<CustomBackgroundSettings>) {
    const customBackground = {
      ...settings.personalization.customBackground,
      ...patch,
    };
    await updatePersonalization({ customBackground });
  }

  // 上传背景图会先压缩成可存入 chrome.storage 的 data URL，再复用背景设置更新链路。
  async function uploadCustomBackground(file: File) {
    try {
      const imageDataUrl = await createBackgroundDataUrl(file);
      await updateCustomBackground({
        enabled: true,
        imageDataUrl,
        maskOpacity: settings.personalization.customBackground.maskOpacity,
        positionX: settings.personalization.customBackground.positionX,
        positionY: settings.personalization.customBackground.positionY,
      });
      setBackgroundMessage("已更新背景图");
    } catch (error) {
      setBackgroundMessage(error instanceof Error ? error.message : "背景图上传失败");
    }
  }

  async function clearCustomBackground() {
    await updateCustomBackground({
      enabled: false,
      imageDataUrl: "",
      maskOpacity: defaultSettings.personalization.customBackground.maskOpacity,
      positionX: 50,
      positionY: 50,
    });
    setBackgroundMessage("已清除背景图");
  }

  async function updateTheme(theme: ExtensionSettings["theme"]) {
    await updateSettings({ ...settings, theme });
  }

  // 导入入口只负责文件读取和提示文案；格式解析与字段归一化交给 settingsImport 统一处理。
  async function importSettings(file: File) {
    try {
      const result = await importDataBackup(await file.text(), settings);
      if (result.settings) await updateSettings(result.settings);
      setImportMessage(result.message);
    } catch (error) {
      setImportMessage(error instanceof Error ? error.message : "导入失败");
    } finally {
      if (importInputRef.current) importInputRef.current.value = "";
    }
  }

  async function exportSettings(kind: DataExportKind) {
    const payload = await createDataExportPayload(kind, settings);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = getExportFileName(kind, formatDateForFile(new Date()));
    link.click();
    URL.revokeObjectURL(url);
    setImportMessage(getExportMessage(kind));
  }

  function scrollToSection(sectionId: SectionId) {
    setActiveSection(sectionId);
    document.getElementById(sectionId)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  return (
    <main className="min-h-screen bg-bili-canvas px-3 py-4 text-slate-900 transition-colors duration-300 ease-out sm:px-4 lg:px-6 dark:bg-[#111318] dark:text-slate-100">
      <div className="mx-auto w-full max-w-[80rem]">
        <header className="mb-4 flex flex-wrap items-start justify-between gap-4 rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm transition-colors duration-300 ease-out sm:px-5 lg:mb-6 dark:border-[#30343c] dark:bg-[#1c1f26] dark:shadow-none">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-semibold tracking-normal">
                <span className="text-bili-blue">Bili</span>{" "}
                <span className="text-slate-950 dark:text-white">Manager</span>
              </h1>
            </div>
            <p className="bm-text-muted mt-2 text-sm">
              规则会自动保存，并同步到已经打开的 B 站页面
            </p>
          </div>
        </header>

        <div className="grid gap-4 lg:grid-cols-[12rem_minmax(0,1fr)]">
          <nav
            aria-label="偏好分类"
            className="grid grid-cols-2 gap-1 rounded-xl border border-slate-200 bg-white p-2 shadow-sm transition-colors duration-300 ease-out lg:sticky lg:top-4 lg:flex lg:h-fit lg:flex-col dark:border-[#30343c] dark:bg-[#1c1f26] dark:shadow-none"
          >
            {sectionNavItems.map(item => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  className={
                    activeSection === item.id
                      ? "flex min-h-10 items-center justify-center gap-2 rounded-lg bg-sky-50 px-3 py-2 text-sm font-medium text-bili-blue transition-colors duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bili-blue/40 lg:justify-start dark:bg-bili-blue/15 dark:text-sky-200"
                      : "flex min-h-10 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-600 transition-colors duration-200 ease-out hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bili-blue/40 lg:justify-start dark:text-slate-400 dark:hover:bg-white/[0.06] dark:hover:text-slate-100"
                  }
                  aria-current={activeSection === item.id ? "location" : undefined}
                  onClick={() => scrollToSection(item.id)}
                  type="button"
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div className="space-y-4">
            <SearchFilterPanel
              favoriteRecommendation={settings.favoriteRecommendation}
              filterTrending={settings.personalization.filterTrending}
              settings={settings.searchFilter}
              onFavoriteRecommendationChange={patch => void updateFavoriteRecommendation(patch)}
              onFilterTrendingChange={enabled =>
                void updatePersonalization({ filterTrending: enabled })
              }
              onRefreshFavoriteRecommendation={refreshFavoriteRecommendation}
              onChange={patch => void updateSearchFilter(patch)}
            />

            <BlocklistSettingsPanel
              searchFilter={settings.searchFilter}
              uploaderBlocklist={uploaderBlocklist}
              onSearchFilterChange={patch => void updateSearchFilter(patch)}
              onUploaderRemove={id => void unblockUploader(id)}
            />

            <PersonalizationPanel
              settings={settings.personalization}
              onChange={patch => void updatePersonalization(patch)}
            />

            <div className="space-y-4">
              <WatchTimerPanel
                enabled={settings.features.watchTimer}
                settings={settings.watchTimer}
                onChange={patch => void updateWatchTimer(patch)}
                onEnabledChange={enabled => void updateWatchTimerEnabled(enabled)}
              />
              <WatchReminderPanel
                enabled={settings.features.watchReminder}
                settings={settings.watchReminder}
                onChange={patch => void updateWatchReminder(patch)}
                onEnabledChange={enabled => void updateWatchReminderEnabled(enabled)}
              />
            </div>

            <div className="space-y-4">
              <GeneralSettingsPanel
                background={settings.personalization.customBackground}
                backgroundMessage={backgroundMessage}
                importInputRef={importInputRef}
                importMessage={importMessage}
                theme={settings.theme}
                onBackgroundChange={patch => void updateCustomBackground(patch)}
                onBackgroundClear={() => void clearCustomBackground()}
                onBackgroundUpload={file => void uploadCustomBackground(file)}
                onExport={kind => void exportSettings(kind)}
                onImport={file => void importSettings(file)}
                onThemeChange={updateTheme}
              />
            </div>
            <footer className="h-28" aria-hidden="true" />
          </div>
        </div>
      </div>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<OptionsApp />);
