import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { AlertCircle, CheckCircle2, Settings } from "lucide-react";
import "../styles/globals.css";
import type { ExtensionMessage, ExtensionResponse } from "../shared/messaging";
import { defaultSettings, getSettings, saveSettings } from "../shared/storage";
import type { ExtensionSettings, SearchFilterStats } from "../shared/types";

const unavailableStats: SearchFilterStats = {
  available: false,
  enabled: false,
  total: 0,
  filtered: 0,
  regexErrors: [],
  updatedAt: new Date(0).toISOString(),
};

function PopupApp() {
  const [settings, setSettings] = useState<ExtensionSettings>(defaultSettings);
  const [stats, setStats] = useState<SearchFilterStats>(unavailableStats);

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
      return;
    }

    setStats(unavailableStats);
  }

  async function setFilterEnabled(enabled: boolean) {
    const next = {
      ...settings,
      features: {
        ...settings.features,
        searchFilter: enabled,
      },
      searchFilter: {
        ...settings.searchFilter,
        enabled,
      },
    };

    setSettings(next);
    await saveSettings(next);

    const response = await sendActiveTabMessage({ type: "BILI_FILTER_SETTINGS_UPDATED" });
    if (response?.ok && response.source === "content") setStats(response.stats);
  }

  return (
    <main className="w-[320px] bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 px-4 py-4">
        <h1 className="text-base font-semibold tracking-normal">BiliManager</h1>
      </header>

      <section className="space-y-3 px-4 py-4">
        <div
          className={[
            "flex items-center gap-2 rounded-md border px-3 py-2 text-xs",
            stats.available
              ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-200"
              : "border-zinc-800 bg-zinc-900 text-zinc-400",
          ].join(" ")}
        >
          {stats.available ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0" />
          )}
          <span>{stats.available ? "当前搜索页已连接" : "当前页面未连接过滤器"}</span>
        </div>

        {stats.available && (
          <button
            className={[
              "flex w-full items-center justify-between rounded-md border px-3 py-3 text-left text-sm transition",
              settings.searchFilter.enabled
                ? "border-bili-blue bg-bili-blue/10 text-zinc-100"
                : "border-zinc-800 bg-zinc-900 text-zinc-300",
            ].join(" ")}
            onClick={() => void setFilterEnabled(!settings.searchFilter.enabled)}
            type="button"
          >
            <span>搜索结果过滤</span>
            <span className={settings.searchFilter.enabled ? "text-bili-blue" : "text-zinc-500"}>
              {settings.searchFilter.enabled ? "已启用" : "已停用"}
            </span>
          </button>
        )}

        {stats.regexErrors.length > 0 && (
          <div className="rounded-md border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-xs leading-5 text-rose-200">
            {stats.regexErrors.join("；")}
          </div>
        )}
      </section>

      <footer className="flex items-center justify-between border-t border-zinc-800 px-4 py-3 text-xs text-zinc-400">
        <button
          className="inline-flex items-center gap-1 rounded-md border border-zinc-700 px-2 py-1 text-zinc-200 hover:border-zinc-500"
          onClick={() => chrome.runtime.openOptionsPage()}
          type="button"
        >
          <Settings className="h-3.5 w-3.5" />
          设置
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

createRoot(document.getElementById("root")!).render(<PopupApp />);
