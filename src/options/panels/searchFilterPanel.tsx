import { Filter } from "lucide-react";
import { MAX_VIEW_COUNT_THRESHOLD } from "../../shared/settingsSchema";
import type { FavoriteRecommendationSettings, SearchFilterSettings } from "../../shared/types";
import { FavoriteFolderManager } from "../components/favoriteFolderManager";
import type { FavoriteFolderRefreshResult } from "../components/favoriteFolderManager";
import { NumberField } from "../components/numberInput";
import {
  SettingNotice,
  SettingRow,
  SettingSection,
  SettingToggleRow,
  SwitchButton,
} from "../components/settingPrimitives";
import type { UpdateCommitOptions } from "../useOptionsSettings";
import { clamp, fromRatePercent, getRangeProgressStyle, toRatePercent } from "../utils";

// 搜索过滤面板只编辑 SearchFilterSettings patch，enabled 同步到 features 的规则留给 useOptionsSettings 统一处理。
export function SearchFilterPanel(props: {
  favoriteRecommendation: FavoriteRecommendationSettings;
  filterTrending: boolean;
  settings: SearchFilterSettings;
  onFavoriteRecommendationChange: (
    patch: Partial<FavoriteRecommendationSettings>,
    options?: UpdateCommitOptions,
  ) => void;
  onFilterTrendingChange: (enabled: boolean) => void;
  onRefreshFavoriteRecommendation: (folderIds: string[]) => Promise<FavoriteFolderRefreshResult[]>;
  onChange: (patch: Partial<SearchFilterSettings>, options?: UpdateCommitOptions) => void;
}) {
  const ratePercent = toRatePercent(props.settings.minDanmakuViewRate);
  const rangeStyle = getRangeProgressStyle(ratePercent * 100);
  const recommendationPercent = Math.round(
    clamp(props.favoriteRecommendation.recommendationRate, 0, 1) * 100,
  );
  const recommendationRangeStyle = getRangeProgressStyle(recommendationPercent);

  function stepRatePercent(delta: number) {
    const nextPercent = clamp(Number((ratePercent + delta).toFixed(3)), 0, 1);
    props.onChange({
      minDanmakuViewRate: fromRatePercent(nextPercent.toString()),
    });
  }

  return (
    <SettingSection
      description="筛掉搜索结果里的水视频、标题党和无关推广"
      disabled={!props.settings.enabled}
      headerAction={
        <SwitchButton
          ariaLabel={props.settings.enabled ? "关闭搜索过滤" : "开启搜索过滤"}
          checked={props.settings.enabled}
          onChange={enabled => props.onChange({ enabled })}
        />
      }
      icon={<Filter className="h-4 w-4" />}
      id="search-filter"
      title="搜索过滤"
    >
      <SettingToggleRow
        checked={props.filterTrending}
        description="去掉搜索页顶部的热搜榜，减少无关干扰"
        title="隐藏搜索热榜"
        onChange={props.onFilterTrendingChange}
      />

      <SettingRow
        control={
          <NumberField
            ariaLabel="最低播放量"
            integer
            max={MAX_VIEW_COUNT_THRESHOLD}
            min={0}
            step={1000}
            suffix="次"
            value={props.settings.minViewCount}
            widthClassName="w-36"
            onCommit={minViewCount => props.onChange({ minViewCount })}
          />
        }
        description="低于这个播放量的视频会被遮住，填 0 表示不限制"
        title="最低播放量"
      />

      <SettingRow
        description="弹幕太少往往意味着内容较水；设为 0% 关闭，零弹幕视频不受影响"
        title="互动率门槛（弹幕 ÷ 播放量）"
      >
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center">
          <input
            aria-label="互动率门槛"
            className="bm-range flex-1"
            max="1"
            min="0"
            step="0.001"
            style={rangeStyle}
            type="range"
            value={ratePercent.toString()}
            onChange={event =>
              props.onChange(
                { minDanmakuViewRate: fromRatePercent(event.target.value) },
                { debounce: true },
              )
            }
          />
          <NumberField
            ariaLabel="互动率门槛"
            max={1}
            min={0}
            step={0.001}
            stepDownLabel="减少互动率门槛"
            stepUpLabel="增加互动率门槛"
            suffix="%"
            value={ratePercent}
            widthClassName="w-32"
            onCommit={nextPercent =>
              props.onChange({
                minDanmakuViewRate: fromRatePercent(nextPercent.toString()),
              })
            }
            onStepDown={() => stepRatePercent(-0.001)}
            onStepUp={() => stepRatePercent(0.001)}
          />
        </div>
      </SettingRow>

      <SettingToggleRow
        checked={props.settings.filterLowDanmakuViewRate}
        description="互动率低于上方门槛时，用遮罩挡住（右键卡片可临时查看）"
        subItem
        title="遮住低互动视频"
        onChange={filterLowDanmakuViewRate => props.onChange({ filterLowDanmakuViewRate })}
      />

      <SettingToggleRow
        checked={props.settings.grayscaleLowDanmakuViewRate}
        description="不遮挡，只把封面和标题变成黑白，方便快速扫过"
        disabled={props.settings.filterLowDanmakuViewRate}
        subItem
        title="仅把低互动视频变灰"
        onChange={grayscaleLowDanmakuViewRate => props.onChange({ grayscaleLowDanmakuViewRate })}
      />

      <SettingToggleRow
        checked={props.settings.filterMissingTitleHighlight}
        description="标题里不含搜索词、且 UP 主名字也不匹配时，用遮罩挡住"
        title="遮住跑题视频"
        onChange={filterMissingTitleHighlight => props.onChange({ filterMissingTitleHighlight })}
      />

      <SettingToggleRow
        checked={props.settings.grayscaleMissingTitleHighlight}
        description="不遮挡，只把封面和标题变成黑白"
        disabled={props.settings.filterMissingTitleHighlight}
        subItem
        title="仅把跑题视频变灰"
        onChange={grayscaleMissingTitleHighlight =>
          props.onChange({ grayscaleMissingTitleHighlight })
        }
      />

      <SettingToggleRow
        checked={props.settings.filterCourseTag}
        description="自动遮住搜索结果里的付费课堂推广"
        title="隐藏付费课程"
        onChange={filterCourseTag => props.onChange({ filterCourseTag })}
      />

      <SettingToggleRow
        checked={props.settings.strictInterception}
        description="直接从搜索列表移除，不再显示遮罩，也不会用收藏夹视频顶替"
        title="彻底隐藏命中视频"
        onChange={strictInterception => props.onChange({ strictInterception })}
      />

      {props.settings.strictInterception && (
        <div className="px-5 py-3.5">
          <SettingNotice tone="info">
            当前已开启「彻底隐藏」，命中视频会直接消失，因此不会用收藏夹顶替；你添加的收藏夹仍会安全保留。
          </SettingNotice>
        </div>
      )}

      <fieldset
        className="m-0 min-w-0 divide-y divide-[var(--bm-divider)] border-0 p-0 transition-opacity duration-200 disabled:opacity-45"
        disabled={props.settings.strictInterception}
      >
        <SettingToggleRow
          checked={props.favoriteRecommendation.enabled}
          description="把被遮住的低质卡片换成你自己收藏夹里的视频，顺便清清吃灰列表"
          disabled={props.settings.strictInterception}
          title="吃灰收藏夹顶替"
          onChange={enabled => props.onFavoriteRecommendationChange({ enabled })}
        />

        <SettingRow subItem title="收藏夹来源与顶替比例">
          <div className="space-y-4">
            <FavoriteFolderManager
              folderIds={props.favoriteRecommendation.folderIds}
              onChange={folderIds => props.onFavoriteRecommendationChange({ folderIds })}
              onRefresh={props.onRefreshFavoriteRecommendation}
            />

            <label className="block">
              <span className="mb-2 flex items-center justify-between gap-3">
                <span className="text-xs font-medium text-[var(--bm-text-secondary)]">
                  顶替比例
                </span>
                <output className="rounded-md border border-[var(--bm-border)] bg-[var(--bm-surface)] px-2 py-0.5 text-xs font-medium tabular-nums text-[var(--bm-text-primary)]">
                  {recommendationPercent}%
                </output>
              </span>
              <input
                aria-label="顶替比例"
                className="bm-range w-full"
                max="100"
                min="0"
                step="5"
                style={recommendationRangeStyle}
                type="range"
                value={recommendationPercent.toString()}
                onChange={event =>
                  props.onFavoriteRecommendationChange(
                    {
                      recommendationRate: clamp(Number(event.target.value), 0, 100) / 100,
                    },
                    { debounce: true },
                  )
                }
              />
              <span className="mt-1.5 block text-xs text-[var(--bm-text-tertiary)]">
                0% 不顶替，100% 时每张被遮住的卡片都会换成收藏夹视频
              </span>
            </label>
          </div>
        </SettingRow>
      </fieldset>
    </SettingSection>
  );
}
