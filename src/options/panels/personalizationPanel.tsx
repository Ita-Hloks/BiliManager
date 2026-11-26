import { Sparkles } from "lucide-react";
import type { PlayerPersonalizationSettings } from "../../shared/types";
import { SettingSection, SettingToggleRow } from "../components/settingPrimitives";

// 播放面板只编辑播放器相关设置，通过 patch 回传，不直接保存全局设置。
export function PersonalizationPanel(props: {
  settings: PlayerPersonalizationSettings;
  onChange: (patch: Partial<PlayerPersonalizationSettings>) => void;
}) {
  return (
    <SettingSection
      description="看视频时清掉干扰元素，更专注当前内容"
      icon={<Sparkles className="h-4 w-4" />}
      id="playback"
      title="播放器"
    >
      <SettingToggleRow
        checked={props.settings.blockRelatedVideos}
        description="移除播放器右侧「接下来播放」和播完推荐浮层，并自动关闭连播"
        title="隐藏右侧推荐视频"
        onChange={blockRelatedVideos => props.onChange({ blockRelatedVideos })}
      />

      <SettingToggleRow
        checked={props.settings.disableRecommendationAutoplay}
        description={
          props.settings.blockRelatedVideos
            ? "已随「隐藏右侧推荐视频」自动开启"
            : "播完当前视频后自动停住，不会接着放下一个推荐"
        }
        disabled={props.settings.blockRelatedVideos}
        subItem
        title="关闭自动连播"
        onChange={disableRecommendationAutoplay =>
          props.onChange({ disableRecommendationAutoplay })
        }
      />

      <SettingToggleRow
        checked={props.settings.disableDanmakuOnVideoEnter}
        description="进入普通视频页时自动关闭弹幕，想看时随时可以手动打开"
        title="打开视频默认关弹幕"
        onChange={disableDanmakuOnVideoEnter => props.onChange({ disableDanmakuOnVideoEnter })}
      />

      <SettingToggleRow
        checked={props.settings.blockPlayerAds}
        description="移除右侧推广卡片、活动横幅和广告位"
        title="隐藏播放页广告"
        onChange={blockPlayerAds => props.onChange({ blockPlayerAds })}
      />
    </SettingSection>
  );
}
