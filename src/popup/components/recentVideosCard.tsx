import { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import { getRecentWatchTimerVideos } from "../../shared/watchTimerHistory";
import type { WatchTimerVideoHistoryItem } from "../../shared/watchTimerHistory";

function handleExpandRecentVideos() {
  // TODO: 后续跳转到完整的播放历史页面
}

function formatUpdatedAt(timestamp: number) {
  const date = new Date(timestamp);
  return `${padTime(date.getHours())}:${padTime(date.getMinutes())}`;
}

function RecentVideoRow({ video }: { video: WatchTimerVideoHistoryItem }) {
  return (
    <li className="rounded-md border border-white/5 bg-white/[0.02] px-2 py-1.5 text-slate-300 transition-colors duration-300 ease-out hover:bg-white/[0.04]">
      <div className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-0.5 text-left">
        {/* if (video.url) void chrome.tabs?.create?.({ url: video.url }); */}
        <span className="min-w-0 truncate text-[11px] font-medium text-slate-200">
          {video.title}
        </span>
        <span className="min-w-0 truncate text-[10px] text-slate-500">{video.dateKey}</span>
        <span className="shrink-0 text-[10px] tabular-nums text-slate-500">
          {formatUpdatedAt(video.updatedAt)}
        </span>
      </div>
    </li>
  );
}

export function RecentVideosCard() {
  const [videos, setVideos] = useState<WatchTimerVideoHistoryItem[]>([]);

  useEffect(() => {
    void getRecentWatchTimerVideos(3).then(setVideos);
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
  );
}

function padTime(value: number) {
  return value.toString().padStart(2, "0");
}
