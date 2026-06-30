import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Activity, Bot, Clock, Filter, Settings } from "lucide-react";
import "../styles/globals.css";
import { defaultSettings, getSettings, saveSettings } from "../shared/storage";
import type { ExtensionSettings, FeatureKey } from "../shared/types";

const featureCards: Array<{
  key: FeatureKey;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    key: "searchFilter",
    title: "搜索过滤器",
    description: "下一步迁移搜索卡片识别、黑名单和排序策略。",
    icon: Filter,
  },
  {
    key: "watchTimer",
    title: "播放计时器",
    description: "预留播放器事件和每日观看时间统计入口。",
    icon: Clock,
  },
  {
    key: "dailyStats",
    title: "今日看板",
    description: "后续展示折线图、命中率和导入导出。",
    icon: Activity,
  },
];

function PopupApp() {
  const [settings, setSettings] = useState<ExtensionSettings>(defaultSettings);

  useEffect(() => {
    void getSettings().then(setSettings);
  }, []);

  async function toggleFeature(key: FeatureKey) {
    const next = {
      ...settings,
      features: {
        ...settings.features,
        [key]: !settings.features[key],
      },
    };
    setSettings(next);
    await saveSettings(next);
  }

  return (
    <main className="w-[360px] bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 px-4 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base font-semibold tracking-normal">Bili Filter</h1>
            <p className="mt-1 text-xs text-zinc-400">React + TypeScript + Tailwind Demo</p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-bili-blue/15 text-bili-blue">
            <Bot className="h-5 w-5" />
          </div>
        </div>
      </header>

      <section className="space-y-3 px-4 py-4">
        {featureCards.map(feature => {
          const Icon = feature.icon;
          const enabled = settings.features[feature.key];
          return (
            <button
              key={feature.key}
              className="flex w-full items-center gap-3 rounded-md border border-zinc-800 bg-zinc-900 px-3 py-3 text-left transition hover:border-zinc-600"
              onClick={() => void toggleFeature(feature.key)}
              type="button"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-md bg-zinc-800 text-zinc-200">
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-zinc-100">{feature.title}</span>
                <span className="mt-0.5 block text-xs leading-5 text-zinc-400">{feature.description}</span>
              </span>
              <span
                className={[
                  "h-5 w-9 rounded-full p-0.5 transition",
                  enabled ? "bg-bili-blue" : "bg-zinc-700",
                ].join(" ")}
              >
                <span
                  className={[
                    "block h-4 w-4 rounded-full bg-white transition",
                    enabled ? "translate-x-4" : "translate-x-0",
                  ].join(" ")}
                />
              </span>
            </button>
          );
        })}
      </section>

      <footer className="flex items-center justify-between border-t border-zinc-800 px-4 py-3 text-xs text-zinc-400">
        <span>v0.1.0 demo</span>
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

createRoot(document.getElementById("root")!).render(<PopupApp />);
