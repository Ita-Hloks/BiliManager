import { useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { BellRing, Clock, Download, Filter, Settings2, Sparkles, UserX } from "lucide-react";
import "../styles/globals.css";
import "../styles/options-controls.css";
import { getCustomBackgroundImage } from "../shared/customBackgroundStorage";
import type { StoredCustomBackgroundImage } from "../shared/customBackgroundStorage";
import { defaultSettings, getSettings } from "../shared/storage";
import type { ExtensionSettings } from "../shared/types";
import { getUploaderBlocklist } from "../shared/uploaderBlocklist";
import type { BlockedUploader } from "../shared/uploaderBlocklist";
import { isEffectiveDarkTheme, useEffectiveDarkTheme } from "../shared/useEffectiveDarkTheme";
import { Button } from "./components/button";
import { SettingNotice, SwitchButton } from "./components/settingPrimitives";
import { BlocklistSettingsPanel } from "./panels/blocklistSettingsPanel";
import { DataPanel } from "./panels/dataPanel";
import { GeneralSettingsPanel } from "./panels/generalSettingsPanel";
import { PersonalizationPanel } from "./panels/personalizationPanel";
import { SearchFilterPanel } from "./panels/searchFilterPanel";
import { WatchReminderPanel } from "./panels/watchReminderPanel";
import { WatchTimerPanel } from "./panels/watchTimerPanel";
import { useOptionsSettings } from "./useOptionsSettings";

type SectionId =
  | "search-filter"
  | "blocklist"
  | "playback"
  | "watch-timer"
  | "watch-reminder"
  | "general-appearance"
  | "data";

const sectionNavItems = [
  { id: "search-filter", label: "搜索过滤", icon: Filter },
  { id: "blocklist", label: "屏蔽规则", icon: UserX },
  { id: "playback", label: "播放器", icon: Sparkles },
  { id: "watch-timer", label: "观看计时器", icon: Clock },
  { id: "watch-reminder", label: "休息提醒", icon: BellRing },
  { id: "general-appearance", label: "界面与外观", icon: Settings2 },
  { id: "data", label: "数据管理", icon: Download },
] as const satisfies ReadonlyArray<{
  id: SectionId;
  label: string;
  icon: typeof Filter;
}>;

applyOptionsTheme(isEffectiveDarkTheme("system"));
void bootOptions();

async function bootOptions() {
  const [initialSettings, initialUploaderBlocklist, initialBackgroundImage] = await Promise.all([
    getSettings().catch(() => defaultSettings),
    getUploaderBlocklist().catch(() => []),
    getCustomBackgroundImage().catch(() => null),
  ]);
  applyOptionsTheme(isEffectiveDarkTheme(initialSettings.theme));
  createRoot(document.getElementById("root")!).render(
    <OptionsApp
      initialBackgroundImage={initialBackgroundImage}
      initialSettings={initialSettings}
      initialUploaderBlocklist={initialUploaderBlocklist}
    />,
  );
}

function applyOptionsTheme(isDark: boolean) {
  document.documentElement.classList.toggle("dark", isDark);
  document.documentElement.style.colorScheme = isDark ? "dark" : "light";
}

function isValidSectionId(candidate: string): candidate is SectionId {
  return sectionNavItems.some(item => item.id === candidate);
}

function resolveSectionFromHash(hash: string): SectionId {
  const candidate = hash.replace(/^#/, "");
  return isValidSectionId(candidate) ? candidate : "search-filter";
}

function OptionsApp(props: {
  initialSettings: ExtensionSettings;
  initialUploaderBlocklist: BlockedUploader[];
  initialBackgroundImage: StoredCustomBackgroundImage | null;
}) {
  const {
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
  } = useOptionsSettings(props);

  const [activeSection, setActiveSection] = useState<SectionId>(() =>
    resolveSectionFromHash(window.location.hash),
  );
  const manualScrollLockRef = useRef<{ targetId: SectionId; timerId: number } | null>(null);
  const isDark = useEffectiveDarkTheme(settings.theme);
  const extensionVersion = chrome.runtime?.getManifest?.()?.version ?? "0.2.0";

  useEffect(() => {
    applyOptionsTheme(isDark);
  }, [isDark]);

  const scrollToSection = useCallback((sectionId: SectionId) => {
    if (manualScrollLockRef.current !== null) {
      window.clearTimeout(manualScrollLockRef.current.timerId);
    }
    const timerId = window.setTimeout(() => {
      manualScrollLockRef.current = null;
    }, 700);
    manualScrollLockRef.current = { targetId: sectionId, timerId };

    setActiveSection(sectionId);
    const nextHash = `#${sectionId}`;
    if (window.location.hash !== nextHash) {
      window.history.replaceState(null, "", nextHash);
    }
    document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  useEffect(() => {
    const candidate = window.location.hash.replace(/^#/, "");
    if (!isValidSectionId(candidate)) return;
    const rafId = window.requestAnimationFrame(() => {
      document.getElementById(candidate)?.scrollIntoView({ behavior: "auto", block: "start" });
    });
    return () => window.cancelAnimationFrame(rafId);
  }, []);

  useEffect(() => {
    let rafId = 0;

    const computeActiveSection = (): SectionId => {
      if (window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 8) {
        return "data";
      }
      let current: SectionId = sectionNavItems[0].id;
      for (const item of sectionNavItems) {
        const element = document.getElementById(item.id);
        if (!element) continue;
        if (element.getBoundingClientRect().top <= 120) {
          current = item.id;
        }
      }
      return current;
    };

    const syncActiveSection = () => {
      rafId = 0;
      const lock = manualScrollLockRef.current;
      if (lock) {
        const targetElement = document.getElementById(lock.targetId);
        const reachedTarget =
          targetElement !== null && Math.abs(targetElement.getBoundingClientRect().top - 80) <= 12;
        if (!reachedTarget) {
          return;
        }
        window.clearTimeout(lock.timerId);
        manualScrollLockRef.current = null;
      }

      const nextSection = computeActiveSection();
      setActiveSection(prev => (prev === nextSection ? prev : nextSection));
      const nextHash = `#${nextSection}`;
      if (window.location.hash !== nextHash) {
        window.history.replaceState(null, "", nextHash);
      }
    };

    const scheduleSync = () => {
      if (rafId !== 0) return;
      rafId = window.requestAnimationFrame(syncActiveSection);
    };

    const handleHashChange = () => {
      const target = resolveSectionFromHash(window.location.hash);
      scrollToSection(target);
    };

    window.addEventListener("scroll", scheduleSync, { passive: true });
    window.addEventListener("resize", scheduleSync);
    window.addEventListener("hashchange", handleHashChange);

    return () => {
      window.removeEventListener("scroll", scheduleSync);
      window.removeEventListener("resize", scheduleSync);
      window.removeEventListener("hashchange", handleHashChange);
      if (rafId !== 0) {
        window.cancelAnimationFrame(rafId);
      }
      if (manualScrollLockRef.current !== null) {
        window.clearTimeout(manualScrollLockRef.current.timerId);
        manualScrollLockRef.current = null;
      }
    };
  }, [scrollToSection]);

  return (
    <div className="min-h-screen bg-[var(--bm-bg)] text-[var(--bm-text-primary)] transition-colors duration-200">
      <header className="sticky top-0 z-30 border-b border-[var(--bm-border)] bg-[#f6f7f9]/90 backdrop-blur-md transition-colors duration-200 dark:bg-[#0e1013]/90">
        <div className="mx-auto flex max-w-[64rem] items-center justify-between gap-4 px-4 py-3.5 sm:px-6">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-0.5">
            <h1 className="text-base font-semibold tracking-tight text-[var(--bm-text-primary)]">
              <span className="text-[var(--bm-accent)]">Bili</span>Manager
            </h1>
            <span className="text-xs text-[var(--bm-text-tertiary)]">修改自动保存，即时生效</span>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <span
              className={
                settings.features.enabled
                  ? "inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300"
                  : "inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 dark:bg-amber-400/10 dark:text-amber-300"
              }
            >
              <span
                aria-hidden="true"
                className={
                  settings.features.enabled
                    ? "h-1.5 w-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400"
                    : "h-1.5 w-1.5 rounded-full bg-amber-500 dark:bg-amber-400"
                }
              />
              {settings.features.enabled ? "运行中" : "已暂停"}
            </span>
            <SwitchButton
              ariaLabel={settings.features.enabled ? "暂停 BiliManager" : "启用 BiliManager"}
              checked={settings.features.enabled}
              onChange={updatePluginEnabled}
            />
          </div>
        </div>
      </header>

      <nav
        aria-label="页面目录"
        className="border-b border-[var(--bm-border)] bg-[var(--bm-surface)] lg:hidden"
      >
        <div className="bm-scrollbar mx-auto flex max-w-[64rem] items-center gap-1.5 overflow-x-auto px-4 py-2.5 sm:px-6">
          {sectionNavItems.map(item => {
            const Icon = item.icon;
            const active = activeSection === item.id;
            return (
              <button
                key={item.id}
                aria-current={active ? "location" : undefined}
                className={
                  active
                    ? "inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[var(--bm-accent-soft)] px-3 py-1.5 text-xs font-medium text-[var(--bm-accent)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bili-blue/40"
                    : "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs text-[var(--bm-text-secondary)] transition-colors hover:bg-[var(--bm-surface-hover)] hover:text-[var(--bm-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bili-blue/40"
                }
                type="button"
                onClick={() => scrollToSection(item.id)}
              >
                <Icon className="h-3.5 w-3.5" />
                {item.label}
              </button>
            );
          })}
        </div>
      </nav>

      <main className="mx-auto grid w-full max-w-[64rem] gap-10 px-4 py-7 sm:px-6 lg:grid-cols-[minmax(0,1fr)_12rem]">
        <div className="min-w-0 space-y-8 pb-24">
          {!settings.features.enabled && (
            <SettingNotice
              action={
                <Button size="sm" variant="primary" onClick={() => updatePluginEnabled(true)}>
                  恢复运行
                </Button>
              }
              tone="warning"
            >
              <span role="status">
                BiliManager 当前已暂停，所有过滤、净化、壁纸与计时功能均暂不生效
              </span>
            </SettingNotice>
          )}

          <SearchFilterPanel
            favoriteRecommendation={settings.favoriteRecommendation}
            filterTrending={settings.personalization.filterTrending}
            settings={settings.searchFilter}
            onChange={updateSearchFilter}
            onFavoriteRecommendationChange={updateFavoriteRecommendation}
            onFilterTrendingChange={enabled => updatePersonalization({ filterTrending: enabled })}
            onRefreshFavoriteRecommendation={refreshFavoriteRecommendation}
          />

          <BlocklistSettingsPanel
            searchFilter={settings.searchFilter}
            uploaderBlocklist={uploaderBlocklist}
            onSearchFilterChange={updateSearchFilter}
            onUploaderRemove={id => void unblockUploader(id)}
          />

          <PersonalizationPanel
            settings={settings.personalization}
            onChange={updatePersonalization}
          />

          <WatchTimerPanel
            enabled={settings.features.watchTimer}
            settings={settings.watchTimer}
            onChange={updateWatchTimer}
            onEnabledChange={updateWatchTimerEnabled}
          />

          <WatchReminderPanel
            enabled={settings.features.watchReminder}
            settings={settings.watchReminder}
            onChange={updateWatchReminder}
            onEnabledChange={updateWatchReminderEnabled}
          />

          <GeneralSettingsPanel
            background={settings.personalization.customBackground}
            backgroundImageDataUrl={backgroundImage?.dataUrl ?? null}
            backgroundMessage={backgroundMessage}
            theme={settings.theme}
            onBackgroundChange={updateCustomBackground}
            onBackgroundClear={() => void clearCustomBackground()}
            onBackgroundUpload={file => void uploadCustomBackground(file)}
            onThemeChange={updateTheme}
          />

          <DataPanel
            importInputRef={importInputRef}
            importMessage={importMessage}
            onExport={kind => void exportSettings(kind)}
            onImport={file => void importSettings(file)}
          />

          <footer className="pt-2 text-center text-xs text-[var(--bm-text-tertiary)]">
            BiliManager v{extensionVersion} · 所有设置与记录仅保存在本地浏览器，不会上传任何数据
          </footer>
        </div>

        <div className="hidden lg:block">
          <aside aria-label="页面目录" className="sticky top-20 h-fit">
            <p className="mb-3 px-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--bm-text-tertiary)]">
              页面目录
            </p>
            <nav className="relative flex flex-col border-l border-[var(--bm-border)]">
              {sectionNavItems.map(item => {
                const Icon = item.icon;
                const active = activeSection === item.id;
                return (
                  <button
                    key={item.id}
                    aria-current={active ? "location" : undefined}
                    className={
                      active
                        ? "-ml-[1px] flex items-center gap-2 border-l-2 border-[var(--bm-accent)] py-2 pl-3.5 text-left text-[13px] font-medium text-[var(--bm-accent)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bili-blue/40"
                        : "-ml-[1px] flex items-center gap-2 border-l-2 border-transparent py-2 pl-3.5 text-left text-[13px] text-[var(--bm-text-secondary)] transition-colors hover:border-[var(--bm-border-strong)] hover:text-[var(--bm-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bili-blue/40"
                    }
                    type="button"
                    onClick={() => scrollToSection(item.id)}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </aside>
        </div>
      </main>
    </div>
  );
}
