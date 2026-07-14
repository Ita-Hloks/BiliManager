import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  getRecentWatchTimerVideos,
  getWatchTimerVideoDailyElapsed,
} from "../../shared/watchTimerHistory";
import type { WatchTimerVideoHistoryItem } from "../../shared/watchTimerHistory";

function formatUpdatedAt(timestamp: number) {
  const date = new Date(timestamp);
  return `${padTime(date.getHours())}:${padTime(date.getMinutes())}`;
}

function formatDuration(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) return `${hours}h${padTime(minutes)}m${padTime(seconds)}s`;
  if (minutes > 0) return `${minutes}m${padTime(seconds)}s`;
  return `${seconds}s`;
}

type RecentVideoViewItem = WatchTimerVideoHistoryItem & {
  dailyElapsedMs: number;
};

function RecentVideoRow({ video }: { video: RecentVideoViewItem }) {
  return (
    <li className="rounded-md border border-white/5 bg-white/[0.02] px-2 py-1.5 text-slate-300 transition-colors duration-300 ease-out hover:bg-white/[0.04]">
      <div className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-0.5 text-left">
        {/* if (video.url) void chrome.tabs?.create?.({ url: video.url }); */}
        <span className="min-w-0 truncate text-[11px] font-medium text-slate-200">
          {video.title}
        </span>
        <span className="shrink-0 text-[11px] tabular-nums text-sky-200">
          {formatDuration(video.dailyElapsedMs)}
        </span>
        <span className="min-w-0 truncate text-[10px] text-slate-500">
          {video.dateKey} {formatUpdatedAt(video.updatedAt)}
        </span>
      </div>
    </li>
  );
}

export function RecentVideosCard() {
  const [videos, setVideos] = useState<RecentVideoViewItem[]>([]);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    void getRecentWatchTimerVideos(3).then(async recentVideos => {
      const videosWithElapsed = await Promise.all(
        recentVideos.map(async video => ({
          ...video,
          dailyElapsedMs: await getWatchTimerVideoDailyElapsed(video.pageKey, video.dateKey),
        })),
      );
      setVideos(videosWithElapsed);
    });
  }, []);

  return (
    <div className="rounded-md border border-white/10 bg-white/[0.04] p-3.5 backdrop-blur-xl">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold text-slate-200">最近播放</h2>
        <button
          aria-expanded={expanded}
          aria-label={expanded ? "折叠最近播放" : "展开最近播放"}
          className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] text-slate-400 transition-colors duration-200 hover:text-sky-300"
          onClick={() => setExpanded(current => !current)}
          type="button"
        >
          {expanded ? "收起" : "展开"}
          <ChevronDown
            className={`h-3 w-3 transition-transform duration-200 ${expanded ? "" : "-rotate-90"}`}
          />
        </button>
      </div>

      <div
        className={[
          "grid transition-[grid-template-rows,opacity] duration-300 ease-out",
          expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        ].join(" ")}
      >
        <div className="min-h-0 overflow-hidden">
          <ul className="mt-2 space-y-1">
            {videos.map(video => (
              <RecentVideoRow key={`${video.dateKey}:${video.pageKey}`} video={video} />
            ))}
          </ul>

          {videos.length === 0 && (
            <div className="mt-2.5 rounded-md border border-white/5 bg-white/[0.02] px-2.5 py-3 text-center text-[11px] text-slate-500">
              暂无播放记录
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function padTime(value: number) {
  return value.toString().padStart(2, "0");
}
