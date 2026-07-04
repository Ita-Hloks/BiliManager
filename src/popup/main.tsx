import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Power,
  Settings,
  Target,
} from "lucide-react";
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

/* ============================================================================
 * 占位（Mock）数据与类型
 *
 * 下面这些类型 / 常量仅用于搭建统计区域与最近播放列表的 UI 骨架。
 * 目前 shared/types.ts 中还没有对应的数据结构，所以先在本文件内定义。
 * 后续接入真实数据源时，建议：
 *   1. 把 DurationPoint / HitRatePoint / RecentVideo 挪到 shared/types.ts
 *   2. 把 DURATION_DATA / HIT_RATE_DATA / RECENT_VIDEOS 替换为真实数据
 *      （例如通过 chrome.storage 或后台脚本统计得出）
 * ============================================================================ */

type StatsMetric = "duration" | "hitRate";
type StatsPeriod = "7d" | "month" | "year";

interface DurationPoint {
  label: string;
  minutes: number;
}

interface HitRatePoint {
  label: string;
  rate: number; // 0-100
}

interface RecentVideo {
  id: string;
  title: string;
  matched: boolean;
  keyword?: string;
}

const PERIOD_LABEL: Record<StatsPeriod, string> = {
  "7d": "近7天",
  month: "本月",
  year: "本年",
};

const DURATION_DATA: Record<StatsPeriod, DurationPoint[]> = {
  "7d": [
    { label: "一", minutes: 42 },
    { label: "二", minutes: 65 },
    { label: "三", minutes: 38 },
    { label: "四", minutes: 90 },
    { label: "五", minutes: 54 },
    { label: "六", minutes: 120 },
    { label: "日", minutes: 78 },
  ],
  month: [
    { label: "1周", minutes: 320 },
    { label: "2周", minutes: 410 },
    { label: "3周", minutes: 275 },
    { label: "4周", minutes: 390 },
  ],
  year: [
    { label: "1月", minutes: 620 },
    { label: "2月", minutes: 540 },
    { label: "3月", minutes: 780 },
    { label: "4月", minutes: 910 },
    { label: "5月", minutes: 860 },
    { label: "6月", minutes: 1040 },
    { label: "7月", minutes: 700 },
    { label: "8月", minutes: 660 },
    { label: "9月", minutes: 880 },
    { label: "10月", minutes: 950 },
    { label: "11月", minutes: 1120 },
    { label: "12月", minutes: 1005 },
  ],
};

const HIT_RATE_DATA: Record<StatsPeriod, HitRatePoint[]> = {
  "7d": [
    { label: "一", rate: 52 },
    { label: "二", rate: 61 },
    { label: "三", rate: 48 },
    { label: "四", rate: 73 },
    { label: "五", rate: 66 },
    { label: "六", rate: 80 },
    { label: "日", rate: 69 },
  ],
  month: [
    { label: "1周", rate: 58 },
    { label: "2周", rate: 64 },
    { label: "3周", rate: 55 },
    { label: "4周", rate: 71 },
  ],
  year: [
    { label: "1月", rate: 45 },
    { label: "2月", rate: 50 },
    { label: "3月", rate: 58 },
    { label: "4月", rate: 62 },
    { label: "5月", rate: 60 },
    { label: "6月", rate: 68 },
    { label: "7月", rate: 55 },
    { label: "8月", rate: 59 },
    { label: "9月", rate: 66 },
    { label: "10月", rate: 70 },
    { label: "11月", rate: 74 },
    { label: "12月", rate: 71 },
  ],
};

const RECENT_VIDEOS: RecentVideo[] = [
  {
    id: "1",
    title: "我是标题！",
    matched: true,
    keyword: "标题",
  },
  {
    id: "2",
    title: "好，那么坏",
    matched: false,
  },
  {
    id: "3",
    title: "你说的对，但是BiliManger是一款基于 Manifest V3 的浏览器扩展",
    matched: true,
    keyword: "你说的对",
  },
];

function formatMinutes(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) return `${minutes} 分钟`;
  if (minutes === 0) return `${hours} 小时`;
  return `${hours} 小时 ${minutes} 分钟`;
}

function handleExpandRecentVideos() {
  // TODO: 后续跳转到完整的播放历史页面
}

function renderHighlightedTitle(video: RecentVideo) {
  if (!video.matched || !video.keyword) return video.title;

  const index = video.title.indexOf(video.keyword);
  if (index < 0) return video.title;

  const before = video.title.slice(0, index);
  const hit = video.title.slice(index, index + video.keyword.length);
  const after = video.title.slice(index + video.keyword.length);

  return (
    <React.Fragment>
      {before}
      <span className="font-semibold text-sky-300">{hit}</span>
      {after}
    </React.Fragment>
  );
}

/* ============================================================================
 * 通用小组件
 * ============================================================================ */

interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
}

function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  size = "md",
}: {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: "sm" | "md";
}) {
  return (
    <div className="flex gap-1 rounded-lg border border-white/10 bg-slate-950/40 p-1">
      {options.map(option => {
        const Icon = option.icon;
        const active = option.value === value;
        return (
          <button
            key={option.value}
            aria-pressed={active}
            className={[
              "flex flex-1 items-center justify-center gap-1.5 rounded-md font-medium transition-all duration-300 ease-out",
              size === "sm" ? "px-2 py-1 text-[11px]" : "px-2.5 py-1.5 text-xs",
              active
                ? "bg-sky-400/90 text-slate-950 shadow-[0_4px_16px_rgba(56,189,248,0.35)]"
                : "text-slate-400 hover:text-slate-200",
            ].join(" ")}
            onClick={() => onChange(option.value)}
            type="button"
          >
            {Icon && <Icon className={size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"} />}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function useMountedAnimation() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return mounted;
}

function DurationBarChart({ data }: { data: DurationPoint[] }) {
  const mounted = useMountedAnimation();
  const max = Math.max(...data.map(point => point.minutes), 1);
  const minWidth = Math.max(280, data.length * 20);

  return (
    <div className="overflow-x-auto pb-1">
      <div className="flex h-28 items-end justify-between gap-1.5" style={{ minWidth }}>
        {data.map((point, index) => {
          const pct = (point.minutes / max) * 100;
          return (
            <div className="flex flex-1 flex-col items-center gap-1.5" key={point.label}>
              <div className="flex h-20 w-full items-end overflow-hidden rounded-t-sm bg-white/[0.03]">
                <div
                  className="w-full rounded-t-sm bg-gradient-to-t from-sky-500/60 to-sky-300/95 transition-[height] duration-700 ease-out"
                  style={{
                    height: mounted ? `${pct}%` : "0%",
                    transitionDelay: `${index * 45}ms`,
                  }}
                />
              </div>
              <span className="whitespace-nowrap text-[9px] leading-none text-slate-500">
                {point.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function HitRateLineChart({ data }: { data: HitRatePoint[] }) {
  const mounted = useMountedAnimation();
  const width = Math.max(280, data.length * 20);
  const height = 96;
  const stepX = width / (data.length - 1 || 1);

  const points = data.map((point, index) => ({
    x: index * stepX,
    y: height - (point.rate / 100) * height,
  }));

  const linePath = points
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)},${point.y.toFixed(1)}`)
    .join(" ");
  const areaPath = `${linePath} L${width},${height} L0,${height} Z`;
  const last = points[points.length - 1];

  return (
    <div className="overflow-x-auto pb-1">
      <svg
        className="h-24 w-full overflow-visible"
        style={{ minWidth: width }}
        viewBox={`0 0 ${width} ${height}`}
      >
        <defs>
          <linearGradient id="hitRateFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="rgba(56,189,248,0.35)" />
            <stop offset="100%" stopColor="rgba(56,189,248,0)" />
          </linearGradient>
        </defs>
        <path
          className="transition-opacity duration-700 ease-out"
          d={areaPath}
          fill="url(#hitRateFill)"
          opacity={mounted ? 1 : 0}
        />
        <path
          d={linePath}
          fill="none"
          pathLength={1}
          stroke="rgb(56,189,248)"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          style={{
            strokeDasharray: 1,
            strokeDashoffset: mounted ? 0 : 1,
            transition: "stroke-dashoffset 900ms ease-out",
          }}
        />
        {points.map((point, index) => (
          <circle
            cx={point.x}
            cy={point.y}
            fill="#0b1120"
            key={data[index].label}
            opacity={mounted ? 1 : 0}
            r={2.5}
            stroke="rgb(56,189,248)"
            strokeWidth={1.5}
            style={{ transition: `opacity 400ms ease-out ${300 + index * 60}ms` }}
          />
        ))}
        <text
          fill="rgb(125,211,252)"
          fontSize="9"
          opacity={mounted ? 1 : 0}
          style={{ transition: "opacity 400ms ease-out 700ms" }}
          textAnchor="end"
          x={last.x}
          y={Math.max(last.y - 8, 9)}
        >
          {data[data.length - 1].rate}%
        </text>
      </svg>
      <div
        className="mt-1 flex justify-between text-[10px] text-slate-500"
        style={{ minWidth: width }}
      >
        {data.map(point => (
          <span className="whitespace-nowrap" key={point.label}>
            {point.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ============================================================================
 * 卡片：统计（观看时长 / 命中关键词率），两个指标共用同一个时间范围切换
 * ============================================================================ */

const METRIC_OPTIONS: SegmentedOption<StatsMetric>[] = [
  { value: "duration", label: "观看时长", icon: Clock3 },
  { value: "hitRate", label: "命中率", icon: Target },
];

const PERIOD_OPTIONS: SegmentedOption<StatsPeriod>[] = [
  { value: "7d", label: "近7天" },
  { value: "month", label: "本月" },
  { value: "year", label: "本年" },
];

function StatsCard() {
  const [metric, setMetric] = useState<StatsMetric>("duration");
  const [period, setPeriod] = useState<StatsPeriod>("7d");

  const durationPoints = DURATION_DATA[period];
  const hitRatePoints = HIT_RATE_DATA[period];
  const totalMinutes = durationPoints.reduce((sum, point) => sum + point.minutes, 0);
  const avgHitRate = Math.round(
    hitRatePoints.reduce((sum, point) => sum + point.rate, 0) / hitRatePoints.length,
  );

  return (
    <div className="rounded-md border border-white/10 bg-white/[0.04] p-3.5 backdrop-blur-xl">
      <SegmentedControl onChange={setMetric} options={METRIC_OPTIONS} value={metric} />

      <div className="mt-2.5">
        <SegmentedControl onChange={setPeriod} options={PERIOD_OPTIONS} size="sm" value={period} />
      </div>

      <div className="mt-3.5">
        {metric === "duration" ? (
          <React.Fragment key="duration">
            <DurationBarChart data={durationPoints} key={period} />
            <p className="mt-2.5 text-center text-[11px] text-slate-400">
              {PERIOD_LABEL[period]}观看时长共{" "}
              <span className="font-semibold text-slate-200">{formatMinutes(totalMinutes)}</span>
            </p>
          </React.Fragment>
        ) : (
          <React.Fragment key="hitRate">
            <HitRateLineChart data={hitRatePoints} key={period} />
            <p className="mt-2.5 text-center text-[11px] text-slate-400">
              {PERIOD_LABEL[period]}平均命中率{" "}
              <span className="font-semibold text-sky-300">{avgHitRate}%</span>
            </p>
          </React.Fragment>
        )}
      </div>

      <p className="mt-3 border-t border-white/5 pt-2 text-center text-[10px] text-slate-600">
        占位数据 · 后续接入真实统计
      </p>
    </div>
  );
}

/* ============================================================================
 * 卡片：最近播放
 * ============================================================================ */

function RecentVideoRow({ video }: { video: RecentVideo }) {
  return (
    <li
      className={[
        "flex items-center gap-3 rounded-md border px-2.5 py-2 transition-colors duration-300 ease-out",
        video.matched
          ? "border-sky-300/25 bg-sky-400/[0.07] text-slate-100 hover:bg-sky-400/[0.12]"
          : "border-white/5 bg-white/[0.02] text-slate-400 opacity-70 hover:opacity-90",
      ].join(" ")}
    >
      <p className="min-w-0 truncate text-xs font-medium">{renderHighlightedTitle(video)}</p>
    </li>
  );
}

function RecentVideosCard() {
  return (
    <div className="rounded-md border border-white/10 bg-white/[0.04] p-3.5 backdrop-blur-xl">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold text-slate-200">最近播放</h2>
        <button
          className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] text-slate-400 transition-colors duration-200 hover:text-sky-300"
          onClick={handleExpandRecentVideos}
          type="button"
        >
          查看更多
          <ChevronRight className="h-3 w-3" />
        </button>
      </div>

      <ul className="mt-2.5 space-y-1.5">
        {RECENT_VIDEOS.slice(0, 3).map(video => (
          <RecentVideoRow key={video.id} video={video} />
        ))}
      </ul>
    </div>
  );
}

/* ============================================================================
 * 主组件
 * ============================================================================ */

function PopupApp() {
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

  const statusText = contentConnected ? "当前页面已连接" : "当前页面未连接内容脚本";
  const pluginEnabled = settings.features.enabled;
  const runningText = pluginEnabled ? "BiliManager 正在运行" : "BiliManager 已暂停";

  return (
    <main className="flex max-h-[600px] w-[360px] flex-col bg-[radial-gradient(circle_at_12%_0%,rgba(56,189,248,0.22),transparent_34%),radial-gradient(circle_at_88%_8%,rgba(244,114,182,0.14),transparent_32%),linear-gradient(135deg,#07111f_0%,#111827_58%,#1e1b2e_100%)] text-slate-100">
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-white/10 px-5 py-4">
        <div className="min-w-0">
          <h1 className="truncate text-base font-semibold tracking-normal">
            <span className="text-bili-blue">Bili</span>{" "}
            <span>Manager {pluginEnabled ? "正在运行" : "已暂停"}</span>
          </h1>
          <p className="mt-0.5 text-[11px] text-slate-500">智能过滤 · 时长管理</p>
        </div>
        <button
          aria-checked={pluginEnabled}
          aria-label={runningText}
          className={[
            "group flex h-9 w-9 shrink-0 items-center justify-center rounded-md border transition-colors duration-300 ease-out",
            pluginEnabled
              ? "border-sky-300/25 bg-sky-400/10 text-sky-200 hover:border-sky-300/40"
              : "border-white/10 bg-white/[0.04] text-slate-400 hover:border-white/20",
          ].join(" ")}
          onClick={() => void setPluginEnabled(!pluginEnabled)}
          role="switch"
          type="button"
        >
          <Power className="h-4 w-4" />
        </button>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-track]:bg-transparent">
        <div
          className={[
            "flex items-center gap-2 rounded-md border px-3 py-2 text-xs backdrop-blur-xl",
            contentConnected
              ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
              : "border-white/10 bg-slate-950/30 text-slate-400",
          ].join(" ")}
        >
          {contentConnected ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0" />
          )}
          <span>{statusText}</span>
        </div>

        {stats.regexErrors.length > 0 && (
          <div className="rounded-md border border-rose-400/25 bg-rose-400/10 px-3 py-2 text-xs leading-5 text-rose-200">
            {stats.regexErrors.join("；")}
          </div>
        )}

        <StatsCard />
        <RecentVideosCard />
      </div>

      <footer className="flex shrink-0 items-center justify-between border-t border-white/10 px-4 py-3 text-xs text-slate-400">
        <button
          className="inline-flex items-center gap-1 rounded-md border border-white/15 bg-white/5 px-2 py-1 text-slate-200 transition-colors hover:border-sky-300/40 hover:bg-white/10"
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
