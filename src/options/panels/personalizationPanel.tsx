import type { CustomBackgroundSettings, PlayerPersonalizationSettings } from "../../shared/types";
import { Button } from "../components/button";
import { CustomBackgroundPanel } from "../components/customBackgroundPanel";
import { Switch } from "../components/switch";

// 个性化面板聚合推荐拦截、广告拦截和背景图 UI，但只通过 patch 回传，不直接保存全局设置。
export function PersonalizationPanel(props: {
  backgroundMessage: string;
  settings: PlayerPersonalizationSettings;
  onBackgroundChange: (patch: Partial<CustomBackgroundSettings>) => void;
  onBackgroundClear: () => void;
  onBackgroundUpload: (file: File) => void;
  onChange: (patch: Partial<PlayerPersonalizationSettings>) => void;
}) {
  return (
    <section id="personalization" className="bm-panel scroll-mt-6">
      <div className="bm-section-header">
        <div className="bm-content-wrap">
          <div>
            <h2 className="bm-text-heading text-base font-medium">个性化</h2>
            <p className="bm-text-muted mt-1 text-sm">控制播放器页视频推荐、广告和推荐连播</p>
          </div>
        </div>
      </div>

      <div className="space-y-3 px-4 pb-5 sm:px-5">
        <div className="overflow-hidden rounded-md border border-slate-200 bg-white/65 shadow-sm transition-colors duration-300 ease-out dark:border-white/10 dark:bg-white/10">
          <Button
            onClick={() =>
              props.onChange({
                blockRelatedVideos: !props.settings.blockRelatedVideos,
              })
            }
            variant="toggleGroupRow"
          >
            <span>
              <span className="block font-medium">拦截推荐视频列表</span>
              <span className="bm-text-muted mt-1 block text-xs">
                隐藏播放器右侧推荐视频，并自动关闭推荐自动连播
              </span>
            </span>
            <Switch enabled={props.settings.blockRelatedVideos} />
          </Button>

          <Button
            active={props.settings.blockRelatedVideos}
            className="border-t border-slate-200 dark:border-white/10"
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
              <span className="bm-text-muted mt-1 block text-xs">拦截推荐视频列表时自动开启</span>
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
              blockPlayerAds: !props.settings.blockPlayerAds,
            })
          }
          variant="toggleRow"
        >
          <span>
            <span className="block font-medium">拦截播放器广告</span>
            <span className="bm-text-muted mt-1 block text-xs">
              隐藏播放器右侧广告、活动推广和广告位
            </span>
          </span>
          <Switch enabled={props.settings.blockPlayerAds} />
        </Button>

        <CustomBackgroundPanel
          background={props.settings.customBackground}
          message={props.backgroundMessage}
          onChange={props.onBackgroundChange}
          onClear={props.onBackgroundClear}
          onUpload={props.onBackgroundUpload}
        />
      </div>
    </section>
  );
}
