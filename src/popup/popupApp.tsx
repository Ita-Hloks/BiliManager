import { useEffect, useLayoutEffect, useState } from "react";
import { AlertCircle, Power, Settings } from "lucide-react";
import type { ExtensionMessage, ExtensionResponse } from "../shared/messaging";
import { getSettings, saveSettings, SETTINGS_KEY } from "../shared/storage";
import type { ExtensionSettings, SearchFilterStats } from "../shared/types";
import { useEffectiveDarkTheme } from "../shared/useEffectiveDarkTheme";
import { RecentVideosCard } from "./components/recentVideosCard";
import { StatsCard } from "./components/statsCard";

const unavailableStats: SearchFilterStats = {
  available: false,
  enabled: false,
  total: 0,
  filtered: 0,
  regexErrors: [],
  updatedAt: new Date(0).toISOString(),
};
const GITHUB_REPOSITORY_URL = "https://github.com/Ita-Hloks/BiliManager";

export function PopupApp(props: { initialSettings: ExtensionSettings }) {
  const [settings, setSettings] = useState<ExtensionSettings>(props.initialSettings);
  const [stats, setStats] = useState<SearchFilterStats>(unavailableStats);
  const [contentConnected, setContentConnected] = useState(false);
  const isDark = useEffectiveDarkTheme(settings.theme);
  const extensionVersion = chrome.runtime.getManifest().version;

  useEffect(() => {
    void refreshPageStatus();
  }, []);

  useLayoutEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
    document.documentElement.style.colorScheme = isDark ? "dark" : "light";
  }, [isDark]);

  useEffect(() => {
    if (typeof chrome === "undefined" || !chrome.storage?.onChanged) return;

    const syncStoredSettings = (
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string,
    ) => {
      if (areaName !== "local" || !changes[SETTINGS_KEY]) return;
      void getSettings().then(setSettings);
    };

    chrome.storage.onChanged.addListener(syncStoredSettings);
    return () => chrome.storage.onChanged.removeListener(syncStoredSettings);
  }, []);

  async function refreshPageStatus() {
    const response = await sendActiveTabMessage({ type: "BILI_FILTER_GET_PAGE_STATUS" });

    if (response?.ok && response.source === "content") {
      setStats(response.stats);
      setContentConnected(true);
      return;
    }

    setStats(unavailableStats);
    setContentConnected(false);
  }

  function openGithubRepository() {
    void chrome.tabs?.create?.({ url: GITHUB_REPOSITORY_URL });
  }

  async function setPluginEnabled(enabled: boolean) {
    const next = {
      ...settings,
      features: {
        ...settings.features,
        enabled,
      },
    };

    setSettings(next);
    await saveSettings(next);

    const response = await sendActiveTabMessage({ type: "BILI_FILTER_SETTINGS_UPDATED" });
    if (response?.ok && response.source === "content") {
      setStats(response.stats);
      setContentConnected(true);
      return;
    }

    setContentConnected(false);
  }

  const pluginEnabled = settings.features.enabled;
  const runningText = pluginEnabled ? "BiliManager 正在运行" : "BiliManager 已暂停";
  const runningTone = pluginEnabled
    ? "bg-sky-50 text-bili-blue dark:bg-bili-blue/15 dark:text-sky-200"
    : "bg-slate-100 text-slate-500 dark:bg-white/[0.06] dark:text-slate-400";

  return (
    <main className="flex max-h-[600px] w-[360px] flex-col bg-bili-canvas text-slate-800 transition-colors duration-300 dark:bg-[#111318] dark:text-slate-100">
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 py-3 transition-colors duration-300 dark:border-[#30343c] dark:bg-[#1c1f26]">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 truncate text-[15px] font-semibold tracking-normal text-slate-800 dark:text-slate-100">
            <span>
              <span className="text-bili-blue">Bili</span>Manager
            </span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${runningTone}`}>
              {pluginEnabled ? "运行中" : "已暂停"}
            </span>
          </h1>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            aria-label="打开设置"
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-sky-50 hover:text-bili-blue focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bili-blue/40 dark:text-slate-400 dark:hover:bg-bili-blue/10 dark:hover:text-sky-200"
            onClick={() => chrome.runtime.openOptionsPage()}
            title="打开设置"
            type="button"
          >
            <Settings className="h-4 w-4" />
          </button>
          <button
            aria-checked={pluginEnabled}
            aria-label={runningText}
            className={[
              "flex h-8 w-8 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bili-blue/40",
              pluginEnabled
                ? "bg-bili-blue text-white hover:bg-[#009bd3]"
                : "bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700 dark:bg-white/[0.06] dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-slate-200",
            ].join(" ")}
            onClick={() => void setPluginEnabled(!pluginEnabled)}
            role="switch"
            type="button"
          >
            <Power className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3 [scrollbar-gutter:stable] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300 dark:[&::-webkit-scrollbar-thumb]:bg-slate-600 [&::-webkit-scrollbar-track]:bg-transparent">
        {!contentConnected && (
          <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200">
            <AlertCircle className="h-4 w-4 shrink-0 text-amber-500" />
            <span>当前页面暂不支持</span>
          </div>
        )}

        {stats.regexErrors.length > 0 && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs leading-5 text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-200">
            {stats.regexErrors.join("；")}
          </div>
        )}

        <StatsCard />
        <RecentVideosCard />
      </div>

      <footer className="flex shrink-0 items-center justify-between border-t border-slate-200 bg-white px-4 py-2 text-[11px] text-slate-400 transition-colors duration-300 dark:border-[#30343c] dark:bg-[#1c1f26] dark:text-slate-500">
        <span>v{extensionVersion}</span>
        <button
          className="font-medium text-slate-500 transition-colors hover:text-bili-blue focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bili-blue/40 dark:text-slate-400 dark:hover:text-sky-200"
          onClick={openGithubRepository}
          type="button"
        >
          GitHub
        </button>
      </footer>
    </main>
  );
}

async function sendActiveTabMessage(message: ExtensionMessage): Promise<ExtensionResponse | null> {
  if (typeof chrome === "undefined" || !chrome.tabs?.query) return null;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return null;

  try {
    return await chrome.tabs.sendMessage(tab.id, message);
  } catch {
    return null;
  }
}
