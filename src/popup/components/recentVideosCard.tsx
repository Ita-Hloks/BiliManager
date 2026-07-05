import React from "react";
import { ChevronRight } from "lucide-react";
import { RECENT_VIDEOS } from "../demoData";
import type { RecentVideo } from "../types";

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

export function RecentVideosCard() {
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
