import type { PlayerPersonalizationSettings } from "../../shared/types";
import { Sparkles } from "lucide-react";
import { Button } from "../components/button";
import { Switch } from "../components/switch";

// 播放面板只编辑播放器相关设置，通过 patch 回传，不直接保存全局设置。
export function PersonalizationPanel(props: {
  settings: PlayerPersonalizationSettings;
  onChange: (patch: Partial<PlayerPersonalizationSettings>) => void;
}) {
  return (
    <section id="playback" className="bm-panel scroll-mt-6">
      <div className="bm-section-header">
        <div className="bm-content-wrap">
          <div className="flex items-start gap-3">
            <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-bili-blue" />
            <div>
              <h2 className="bm-text-heading text-base font-medium">播放器</h2>
              <p className="bm-text-muted mt-1 text-sm">管理推荐、广告和弹幕行为</p>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-3 px-4 py-5 sm:px-5">
        <div className="divide-y divide-slate-100 overflow-hidden rounded-lg bg-bili-canvas transition-colors duration-300 ease-out dark:divide-[#30343c] dark:bg-[#15181e]">
          <Button
            onClick={() =>
              props.onChange({
                blockRelatedVideos: !props.settings.blockRelatedVideos,
              })
            }
            variant="toggleGroupRow"
          >
            <span>
              <span className="block font-medium">移除推荐视频列表</span>
              <span className="bm-text-muted mt-1 block text-xs">
                移除播放器右侧推荐视频，并自动关闭推荐自动连播
              </span>
            </span>
            <Switch enabled={props.settings.blockRelatedVideos} />
          </Button>

          <Button
            active={props.settings.blockRelatedVideos}
            disabled={props.settings.blockRelatedVideos}
            onClick={() =>
              props.onChange({
                disableRecommendationAutoplay: !props.settings.disableRecommendationAutoplay,
              })
            }
            variant="toggleGroupRow"
          >
            <span>
              <span className="block font-medium">关闭推荐自动连播</span>
            </span>
            <Switch
              disabled={props.settings.blockRelatedVideos}
              enabled={props.settings.disableRecommendationAutoplay}
            />
          </Button>
        </div>

        <Button
          onClick={() =>
            props.onChange({
              disableDanmakuOnVideoEnter: !props.settings.disableDanmakuOnVideoEnter,
            })
          }
          variant="toggleRow"
        >
          <span className="font-medium">进入视频时关闭弹幕</span>
          <Switch enabled={props.settings.disableDanmakuOnVideoEnter} />
        </Button>

        <Button
          onClick={() =>
            props.onChange({
              blockPlayerAds: !props.settings.blockPlayerAds,
            })
          }
          variant="toggleRow"
        >
          <span>
            <span className="block font-medium">移除播放器广告</span>
            <span className="bm-text-muted mt-1 block text-xs">
              移除播放器右侧广告、活动推广和广告位
            </span>
          </span>
          <Switch enabled={props.settings.blockPlayerAds} />
        </Button>
      </div>
    </section>
  );
}
