import { useEffect, useState } from "react";
import { AlertCircle, Power, Settings } from "lucide-react";
import type { ExtensionMessage, ExtensionResponse } from "../shared/messaging";
import { defaultSettings, getSettings, saveSettings } from "../shared/storage";
import type { ExtensionSettings, SearchFilterStats } from "../shared/types";
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

export function PopupApp() {
  const [settings, setSettings] = useState<ExtensionSettings>(defaultSettings);
  const [stats, setStats] = useState<SearchFilterStats>(unavailableStats);
  const [contentConnected, setContentConnected] = useState(false);

  useEffect(() => {
    void getSettings().then(nextSettings => {
      setSettings(nextSettings);
      void refreshPageStatus();
    });
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
  const runningTone = pluginEnabled ? "text-emerald-200/80" : "text-rose-200/80";

  return (
    <main className="flex max-h-[600px] w-[360px] flex-col bg-[radial-gradient(circle_at_12%_0%,rgba(56,189,248,0.22),transparent_34%),radial-gradient(circle_at_88%_8%,rgba(244,114,182,0.14),transparent_32%),linear-gradient(135deg,#07111f_0%,#111827_58%,#1e1b2e_100%)] text-slate-100">
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-white/10 px-5 py-4">
        <div className="min-w-0">
          <h1 className="truncate text-base font-semibold tracking-normal">
            <span className="text-bili-blue">Bili</span> <span>Manager </span>
            <span className={runningTone}>{pluginEnabled ? "正在运行" : "已暂停"}</span>
          </h1>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            aria-label="打开设置"
            className="group flex h-9 w-9 items-center justify-center rounded-md border border-white/10 bg-slate-950/25 text-slate-300 opacity-85 transition-all duration-300 ease-out hover:border-sky-300/35 hover:bg-sky-400/15 hover:text-sky-100 hover:opacity-100"
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
              "group flex h-9 w-9 items-center justify-center rounded-md border transition-all duration-300 ease-out",
              pluginEnabled
                ? "border-sky-300/45 bg-sky-400/20 text-sky-100 shadow-[0_0_0_1px_rgba(56,189,248,0.08),0_8px_22px_rgba(14,165,233,0.18)] hover:bg-sky-400/25"
                : "border-white/10 bg-slate-950/25 text-slate-500 opacity-75 hover:border-white/20 hover:bg-white/[0.05] hover:opacity-100",
            ].join(" ")}
            onClick={() => void setPluginEnabled(!pluginEnabled)}
            role="switch"
            type="button"
          >
            <Power className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4 [scrollbar-gutter:stable] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-track]:bg-transparent">
        {!contentConnected && (
          <div className="flex items-center gap-2 rounded-md border border-white/10 bg-slate-950/30 px-3 py-2 text-xs text-slate-400 backdrop-blur-xl">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>当前页面不支持</span>
          </div>
        )}

        {stats.regexErrors.length > 0 && (
          <div className="rounded-md border border-rose-400/25 bg-rose-400/10 px-3 py-2 text-xs leading-5 text-rose-200">
            {stats.regexErrors.join("；")}
          </div>
        )}

        <StatsCard />
        <RecentVideosCard />
      </div>

      <footer className="flex shrink-0 items-center justify-between border-t border-white/10 px-4 py-2 text-[11px] text-slate-500">
        <span className="text-slate-500">0.0.0 测试版</span>
        <button
          className="text-slate-500 transition-colors hover:text-slate-300"
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
