import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Filter, Trash2 } from "lucide-react";
import "../styles/globals.css";
import { defaultSettings, getSettings, saveSettings } from "../shared/storage";
import type { ExtensionSettings } from "../shared/types";

function OptionsApp() {
  const [settings, setSettings] = useState<ExtensionSettings>(defaultSettings);

  useEffect(() => {
    void getSettings().then(setSettings);
  }, []);

  async function updateSearchFilter(patch: Partial<ExtensionSettings["searchFilter"]>) {
    const enabled = patch.enabled ?? settings.searchFilter.enabled;
    const next = {
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
    };

    setSettings(next);
    await saveSettings(next);
  }

  const ratePercent = toRatePercent(settings.searchFilter.minDanmakuViewRate);

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-8 text-zinc-100">
      <div className="mx-auto max-w-4xl">
        <header className="mb-8">
          <h1 className="text-2xl font-semibold tracking-normal">BiliManager 设置</h1>
          <p className="mt-2 text-sm text-zinc-400">
            搜索结果过滤规则会自动保存并同步到已打开的搜索页。
          </p>
        </header>

        <section className="rounded-md border border-zinc-800 bg-zinc-900/70">
          <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-md bg-bili-blue/15 text-bili-blue">
                <Filter className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-base font-medium text-zinc-100">搜索结果过滤</h2>
                <p className="mt-1 text-xs text-zinc-500">
                  支持 search.bilibili.com/all 和 /video。
                </p>
              </div>
            </div>
            <button
              className={[
                "rounded-md border px-3 py-2 text-sm transition",
                settings.searchFilter.enabled
                  ? "border-bili-blue bg-bili-blue text-white"
                  : "border-zinc-700 bg-zinc-950 text-zinc-300",
              ].join(" ")}
              onClick={() => void updateSearchFilter({ enabled: !settings.searchFilter.enabled })}
              type="button"
            >
              {settings.searchFilter.enabled ? "已启用" : "已停用"}
            </button>
          </div>

          <div className="space-y-5 p-5">
            <RuleListEditor
              label="过滤词正则"
              placeholder="输入后按回车，例如：猎奇|居然|的一集|这下"
              value={settings.searchFilter.titlePattern}
              onChange={titlePattern => void updateSearchFilter({ titlePattern })}
            />
            <RuleListEditor
              label="UP 主过滤词正则"
              placeholder="输入后按回车，例如：搞笑|电影|放映"
              value={settings.searchFilter.uploaderPattern}
              onChange={uploaderPattern => void updateSearchFilter({ uploaderPattern })}
            />
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-zinc-200">
                最低弹幕/播放互动率
              </span>
              <div className="flex max-w-xl items-center gap-3">
                <input
                  className="h-2 flex-1 accent-bili-blue"
                  max="1"
                  min="0"
                  step="0.01"
                  type="range"
                  value={ratePercent.toString()}
                  onChange={event =>
                    void updateSearchFilter({
                      minDanmakuViewRate: fromRatePercent(event.target.value),
                    })
                  }
                />
                <input
                  className="w-24 rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-right text-sm text-zinc-100 outline-none transition focus:border-bili-blue"
                  max="1"
                  min="0"
                  step="0.01"
                  type="number"
                  value={ratePercent.toString()}
                  onChange={event =>
                    void updateSearchFilter({
                      minDanmakuViewRate: fromRatePercent(event.target.value),
                    })
                  }
                />
                <span className="text-sm text-zinc-400">%</span>
              </div>
              <span className="mt-1 block text-xs text-zinc-500">
                0-1% 范围；弹幕为 0 时不会触发互动率过低。
              </span>
            </label>
            <button
              className="flex w-full max-w-xl items-center justify-between rounded-md border border-zinc-800 bg-zinc-950 px-3 py-3 text-left text-sm text-zinc-100 transition hover:border-zinc-600"
              onClick={() =>
                void updateSearchFilter({
                  filterMissingTitleHighlight: !settings.searchFilter.filterMissingTitleHighlight,
                })
              }
              type="button"
            >
              <span>过滤无粉红命中标题</span>
              <Switch enabled={settings.searchFilter.filterMissingTitleHighlight} />
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}

function RuleListEditor(props: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const rules = splitRules(props.value);

  function addRule() {
    const trimmed = draft.trim();
    if (!trimmed || rules.includes(trimmed)) return;
    props.onChange([...rules, trimmed].join("|"));
    setDraft("");
  }

  function removeRule(rule: string) {
    props.onChange(rules.filter(item => item !== rule).join("|"));
  }

  return (
    <div>
      <label className="block">
        <span className="mb-2 block text-sm font-medium text-zinc-200">{props.label}</span>
        <input
          className="w-full max-w-xl rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-bili-blue"
          placeholder={props.placeholder}
          type="text"
          value={draft}
          onChange={event => setDraft(event.target.value)}
          onKeyDown={event => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            addRule();
          }}
        />
      </label>
      {rules.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {rules.map(rule => (
            <span
              key={rule}
              className="inline-flex items-center gap-2 rounded-md border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 text-sm text-zinc-200"
            >
              {rule}
              <button
                className="text-zinc-500 transition hover:text-rose-300"
                onClick={() => removeRule(rule)}
                title="删除"
                type="button"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function Switch(props: { enabled: boolean }) {
  return (
    <span
      className={[
        "h-5 w-9 rounded-full p-0.5 transition",
        props.enabled ? "bg-bili-blue" : "bg-zinc-700",
      ].join(" ")}
    >
      <span
        className={[
          "block h-4 w-4 rounded-full bg-white transition",
          props.enabled ? "translate-x-4" : "translate-x-0",
        ].join(" ")}
      />
    </span>
  );
}

function splitRules(value: string) {
  return value
    .split("|")
    .map(rule => rule.trim())
    .filter(Boolean);
}

function toRatePercent(rate: number) {
  return Number(clamp(rate * 100, 0, 1).toFixed(2));
}

function fromRatePercent(value: string) {
  return clamp(Number(value), 0, 1) / 100;
}

function clamp(value: number, min: number, max: number) {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}

createRoot(document.getElementById("root")!).render(<OptionsApp />);
