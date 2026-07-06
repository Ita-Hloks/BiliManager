import type { CustomBackgroundSettings, PlayerPersonalizationSettings } from "../../shared/types";
import { CustomBackgroundPanel } from "../components/customBackgroundPanel";
import { Switch } from "../components/switch";
import type { ThemePalette } from "../theme";

// 个性化面板聚合推荐拦截、广告拦截和背景图 UI，但只通过 patch 回传，不直接保存全局设置。
export function PersonalizationPanel(props: {
  backgroundMessage: string;
  palette: ThemePalette;
  settings: PlayerPersonalizationSettings;
  onBackgroundChange: (patch: Partial<CustomBackgroundSettings>) => void;
  onBackgroundClear: () => void;
  onBackgroundUpload: (file: File) => void;
  onChange: (patch: Partial<PlayerPersonalizationSettings>) => void;
}) {
  return (
    <section id="personalization" className={`${props.palette.panel} scroll-mt-6`}>
      <div className={props.palette.sectionHeader}>
        <div className={props.palette.contentWrap}>
          <div>
            <h2 className={`text-base font-medium ${props.palette.heading}`}>个性化</h2>
            <p className={`mt-1 text-sm ${props.palette.mutedText}`}>
              控制播放器页视频推荐、广告和推荐连播
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-3 px-4 pb-5 sm:px-5">
        <div className={props.palette.toggleGroup}>
          <button
            className={props.palette.toggleGroupRow}
            onClick={() =>
              props.onChange({
                blockRelatedVideos: !props.settings.blockRelatedVideos,
              })
            }
            type="button"
          >
            <span>
              <span className="block font-medium">拦截推荐视频列表</span>
              <span className={`mt-1 block text-xs ${props.palette.mutedText}`}>
                隐藏播放器右侧推荐视频，并自动关闭推荐自动连播
              </span>
            </span>
            <Switch enabled={props.settings.blockRelatedVideos} />
          </button>

          <button
            className={[
              props.palette.toggleGroupRow,
              props.palette.toggleGroupDivider,
              props.settings.blockRelatedVideos ? props.palette.toggleGroupRowDisabled : "",
            ].join(" ")}
            disabled={props.settings.blockRelatedVideos}
            onClick={() =>
              props.onChange({
                disableRecommendationAutoplay: !props.settings.disableRecommendationAutoplay,
              })
            }
            type="button"
          >
            <span>
              <span className="block font-medium">关闭推荐自动连播</span>
              <span className={`mt-1 block text-xs ${props.palette.mutedText}`}>
                拦截推荐视频列表时自动开启
              </span>
            </span>
            <Switch
              disabled={props.settings.blockRelatedVideos}
              enabled={props.settings.disableRecommendationAutoplay}
            />
          </button>
        </div>

        <button
          className={props.palette.toggleRow}
          onClick={() =>
            props.onChange({
              blockPlayerAds: !props.settings.blockPlayerAds,
            })
          }
          type="button"
        >
          <span>
            <span className="block font-medium">拦截播放器广告</span>
            <span className={`mt-1 block text-xs ${props.palette.mutedText}`}>
              隐藏播放器右侧广告、活动推广和广告位
            </span>
          </span>
          <Switch enabled={props.settings.blockPlayerAds} />
        </button>

        <CustomBackgroundPanel
          background={props.settings.customBackground}
          message={props.backgroundMessage}
          palette={props.palette}
          onChange={props.onBackgroundChange}
          onClear={props.onBackgroundClear}
          onUpload={props.onBackgroundUpload}
        />
      </div>
    </section>
  );
}
