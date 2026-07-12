import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Clock, Download, Filter, Sparkles } from "lucide-react";
import "../styles/globals.css";
import "../styles/options-controls.css";
import { defaultSettings, getSettings, saveSettings } from "../shared/storage";
import type {
  CustomBackgroundSettings,
  ExtensionSettings,
  PlayerPersonalizationSettings,
  SearchFilterSettings,
  WatchTimerSettings,
} from "../shared/types";
import { ThemeSwitch } from "./components/themeSwitch";
import { DataPanel } from "./panels/dataPanel";
import { PersonalizationPanel } from "./panels/personalizationPanel";
import { SearchFilterPanel } from "./panels/searchFilterPanel";
import { WatchTimerPanel } from "./panels/watchTimerPanel";
import type { DataExportKind } from "./dataTransfer";
import {
  createDataExportPayload,
  getExportFileName,
  getExportMessage,
  importDataBackup,
} from "./dataTransfer";
import { useEffectiveDarkTheme } from "./theme";
import { createBackgroundDataUrl, formatDateForFile } from "./utils";

type SectionId = "search-filter" | "personalization" | "watch-timer" | "data";

const sectionNavItems = [
  { id: "search-filter", label: "过滤搜索", icon: Filter },
  { id: "personalization", label: "个性化", icon: Sparkles },
  { id: "watch-timer", label: "定时器", icon: Clock },
  { id: "data", label: "配置", icon: Download },
] as const satisfies ReadonlyArray<{
  id: SectionId;
  label: string;
  icon: typeof Filter;
}>;

function OptionsApp() {
  const [settings, setSettings] = useState<ExtensionSettings>(defaultSettings);
  const [importMessage, setImportMessage] = useState("");
  const [backgroundMessage, setBackgroundMessage] = useState("");
  const [activeSection, setActiveSection] = useState<SectionId>("search-filter");
  const importInputRef = useRef<HTMLInputElement>(null);
  const isDark = useEffectiveDarkTheme(settings.theme);

  useEffect(() => {
    void getSettings().then(setSettings);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
    document.documentElement.style.colorScheme = isDark ? "dark" : "light";
  }, [isDark]);

  async function updateSettings(next: ExtensionSettings) {
    setSettings(next);
    await saveSettings(next);
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

  function scrollToSection(sectionId: SectionId) {
    setActiveSection(sectionId);
    document.getElementById(sectionId)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
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

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_15%_12%,rgba(251,207,232,0.55),transparent_34%),radial-gradient(circle_at_82%_6%,rgba(191,219,254,0.62),transparent_32%),linear-gradient(135deg,#f8fbff_0%,#eef7ff_48%,#fff1f8_100%)] px-3 py-4 text-slate-900 transition-colors duration-300 ease-out sm:px-4 lg:px-6 dark:bg-[radial-gradient(circle_at_15%_12%,rgba(56,189,248,0.22),transparent_34%),radial-gradient(circle_at_82%_6%,rgba(244,114,182,0.16),transparent_32%),linear-gradient(135deg,#07111f_0%,#111827_52%,#1e1b2e_100%)] dark:text-slate-100">
      <div className="mx-auto w-full max-w-[80rem]">
        <header className="mb-4 flex flex-wrap items-start justify-between gap-4 rounded-md border border-white/70 bg-white/55 px-4 py-4 shadow-[0_18px_80px_rgba(59,130,246,0.14)] backdrop-blur-xl transition-colors duration-300 ease-out sm:px-5 lg:mb-6 dark:border-white/10 dark:bg-slate-950/45 dark:shadow-[0_18px_80px_rgba(15,23,42,0.3)]">
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
          <ThemeSwitch value={settings.theme} onChange={updateTheme} />
        </header>

        <div className="grid gap-4 xl:grid-cols-[12rem_minmax(0,1fr)]">
          <nav
            aria-label="偏好分类"
            className="flex h-fit gap-2 overflow-x-auto rounded-md border border-white/70 bg-white/45 p-2 shadow-sm backdrop-blur-xl transition-colors duration-300 ease-out xl:sticky xl:top-4 xl:flex-col xl:overflow-visible dark:border-white/10 dark:bg-slate-950/35"
          >
            {sectionNavItems.map(item => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  className={
                    activeSection === item.id
                      ? "flex min-w-28 items-center gap-2 rounded bg-sky-100 px-3 py-2 text-left text-sm font-medium text-sky-700 shadow-sm shadow-sky-100/80 transition-colors duration-300 ease-out xl:w-full xl:min-w-0 dark:bg-sky-400/15 dark:text-sky-200 dark:shadow-sky-950/20"
                      : "flex min-w-28 items-center gap-2 rounded px-3 py-2 text-left text-sm text-slate-600 transition-colors duration-300 ease-out hover:bg-white/60 hover:text-slate-900 xl:w-full xl:min-w-0 dark:text-slate-400 dark:hover:bg-white/[0.08] dark:hover:text-slate-100"
                  }
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
              settings={settings.searchFilter}
              onChange={patch => void updateSearchFilter(patch)}
            />
            <PersonalizationPanel
              backgroundMessage={backgroundMessage}
              settings={settings.personalization}
              onBackgroundChange={patch => void updateCustomBackground(patch)}
              onBackgroundClear={() => void clearCustomBackground()}
              onBackgroundUpload={file => void uploadCustomBackground(file)}
              onChange={patch => void updatePersonalization(patch)}
            />
            <WatchTimerPanel
              enabled={settings.features.watchTimer}
              settings={settings.watchTimer}
              onChange={patch => void updateWatchTimer(patch)}
              onEnabledChange={enabled => void updateWatchTimerEnabled(enabled)}
            />
            <DataPanel
              importInputRef={importInputRef}
              importMessage={importMessage}
              onExport={kind => void exportSettings(kind)}
              onImport={file => void importSettings(file)}
            />
            <footer className="h-28" aria-hidden="true" />
          </div>
        </div>
      </div>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<OptionsApp />);
