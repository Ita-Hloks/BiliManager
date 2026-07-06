import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Clock, Download, Filter, Sparkles } from "lucide-react";
import "../styles/globals.css";
import { defaultSettings, getSettings, saveSettings } from "../shared/storage";
import type {
  CustomBackgroundSettings,
  ExtensionSettings,
  PlayerPersonalizationSettings,
  SearchFilterSettings,
  WatchTimerSettings,
} from "../shared/types";
import { ThemeSwitch } from "./components/themeSwitch";
import { DataPanel } from "./panels/DataPanel";
import { PersonalizationPanel } from "./panels/PersonalizationPanel";
import { SearchFilterPanel } from "./panels/SearchFilterPanel";
import { WatchTimerPanel } from "./panels/WatchTimerPanel";
import { parseImportedSettings } from "./settingsImport";
import { getThemePalette, useEffectiveDarkTheme } from "./theme";
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
  const palette = getThemePalette();

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

  // 搜索过滤同时服务设置页分组状态和内容脚本实际开关，更新时必须保持同步。
  async function updateSearchFilter(patch: Partial<SearchFilterSettings>) {
    const enabled = patch.enabled ?? settings.searchFilter.enabled;
    await updateSettings({
      ...settings,
      features: {
        ...settings.features,
        searchFilter: enabled,
      },
      searchFilter: {
        ...settings.searchFilter,
        ...patch,
        enabled,
      },
    });
  }

  // 个性化功能是多个子开关的聚合状态；这里统一推导 features.personalization，避免面板各自重复计算。
  async function updatePersonalization(patch: Partial<PlayerPersonalizationSettings>) {
    const personalization = {
      ...settings.personalization,
      ...patch,
    };
    if (personalization.blockRelatedVideos) {
      personalization.disableRecommendationAutoplay = true;
    }
    const enabled =
      personalization.blockRelatedVideos ||
      personalization.blockPlayerAds ||
      personalization.disableRecommendationAutoplay ||
      personalization.customBackground.enabled;

    await updateSettings({
      ...settings,
      features: {
        ...settings.features,
        personalization: enabled,
      },
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

  // 导入入口只负责文件读取和提示文案；格式兼容与字段归一化交给 settingsImport 统一处理。
  async function importSettings(file: File) {
    try {
      const next = parseImportedSettings(await file.text(), settings);
      await updateSettings(next);
      setImportMessage("已导入完整配置");
    } catch (error) {
      setImportMessage(error instanceof Error ? error.message : "导入失败");
    } finally {
      if (importInputRef.current) importInputRef.current.value = "";
    }
  }

  function exportSettings() {
    const payload = {
      version: 2,
      exportedAt: new Date().toISOString(),
      settings,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `bili-manager-settings-${formatDateForFile(new Date())}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setImportMessage("已导出完整配置");
  }

  return (
    <main
      className={`min-h-screen px-3 py-4 transition-colors duration-300 ease-out sm:px-4 lg:px-6 ${palette.page}`}
    >
      <div className="mx-auto w-full max-w-[80rem]">
        <header className={palette.header}>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-semibold tracking-normal">
                <span className="text-bili-blue">Bili</span>{" "}
                <span className={palette.brandText}>Manager</span>
              </h1>
            </div>
            <p className={`mt-2 text-sm ${palette.mutedText}`}>
              规则会自动保存，并同步到已经打开的 B 站页面
            </p>
          </div>
          <ThemeSwitch value={settings.theme} onChange={updateTheme} />
        </header>

        <div className="grid gap-4 xl:grid-cols-[12rem_minmax(0,1fr)]">
          <nav className={palette.sideNav} aria-label="偏好分类">
            {sectionNavItems.map(item => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  className={
                    activeSection === item.id ? palette.sideNavItemActive : palette.sideNavItem
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
              palette={palette}
              settings={settings.searchFilter}
              onChange={patch => void updateSearchFilter(patch)}
            />
            <PersonalizationPanel
              backgroundMessage={backgroundMessage}
              palette={palette}
              settings={settings.personalization}
              onBackgroundChange={patch => void updateCustomBackground(patch)}
              onBackgroundClear={() => void clearCustomBackground()}
              onBackgroundUpload={file => void uploadCustomBackground(file)}
              onChange={patch => void updatePersonalization(patch)}
            />
            <WatchTimerPanel
              enabled={settings.features.watchTimer}
              palette={palette}
              settings={settings.watchTimer}
              onChange={patch => void updateWatchTimer(patch)}
              onEnabledChange={enabled => void updateWatchTimerEnabled(enabled)}
            />
            <DataPanel
              importInputRef={importInputRef}
              importMessage={importMessage}
              palette={palette}
              onExport={exportSettings}
              onImport={file => void importSettings(file)}
            />
          </div>
        </div>
      </div>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<OptionsApp />);
