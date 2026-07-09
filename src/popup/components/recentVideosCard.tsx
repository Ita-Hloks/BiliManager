import { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import { getRecentWatchTimerSessions } from "../../shared/watchTimerHistory";
import type { WatchTimerSessionStorage } from "../../shared/watchTimerHistory";

function handleExpandRecentVideos() {
  // TODO: 后续跳转到完整的播放历史页面
}

function formatDuration(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}:${padTime(minutes)}:${padTime(seconds)}`;
  return `${padTime(minutes)}:${padTime(seconds)}`;
}

function formatUpdatedAt(timestamp: number) {
  const date = new Date(timestamp);
  return `${padTime(date.getHours())}:${padTime(date.getMinutes())}`;
}

function RecentVideoRow({ video }: { video: WatchTimerSessionStorage }) {
  return (
    <li className="rounded-md border border-white/5 bg-white/[0.02] px-2.5 py-2 text-slate-300 transition-colors duration-300 ease-out hover:bg-white/[0.04]">
      <button
        className="grid w-full grid-cols-[1fr_auto] items-center gap-3 text-left"
        onClick={() => {
          if (video.url) void chrome.tabs?.create?.({ url: video.url });
        }}
        type="button"
      >
        <span className="min-w-0 truncate text-xs font-medium text-slate-200">{video.title}</span>
        <span className="shrink-0 text-[11px] tabular-nums text-sky-200">
          {formatDuration(video.elapsedMs)}
        </span>
        <span className="min-w-0 truncate text-[10px] text-slate-500">{video.dateKey}</span>
        <span className="shrink-0 text-[10px] tabular-nums text-slate-500">
          {formatUpdatedAt(video.updatedAt)}
        </span>
      </button>
    </li>
  );
}

export function RecentVideosCard() {
  const [videos, setVideos] = useState<WatchTimerSessionStorage[]>([]);

  useEffect(() => {
    void getRecentWatchTimerSessions(5).then(setVideos);
  }, []);

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
        {videos.map(video => (
          <RecentVideoRow key={video.id} video={video} />
        ))}
      </ul>
    </div>
  );
}

function padTime(value: number) {
  return value.toString().padStart(2, "0");
}
