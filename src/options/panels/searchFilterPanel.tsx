import { ChevronDown, ChevronUp, Filter, Folder } from "lucide-react";
import type { FavoriteRecommendationSettings, SearchFilterSettings } from "../../shared/types";
import { Button } from "../components/button";
import { FavoriteFolderManager } from "../components/favoriteFolderManager";
import type { FavoriteFolderRefreshResult } from "../components/favoriteFolderManager";
import { RuleListEditor } from "../components/ruleListEditor";
import { Switch } from "../components/switch";
import { clamp, fromRatePercent, getRangeProgressStyle, toRatePercent } from "../utils";

// 搜索过滤面板只编辑 SearchFilterSettings patch，enabled 同步到 features 的规则留给 main.tsx 统一处理。
export function SearchFilterPanel(props: {
  favoriteRecommendation: FavoriteRecommendationSettings;
  filterTrending: boolean;
  settings: SearchFilterSettings;
  onFavoriteRecommendationChange: (patch: Partial<FavoriteRecommendationSettings>) => void;
  onFilterTrendingChange: (enabled: boolean) => void;
  onRefreshFavoriteRecommendation: (folderIds: string[]) => Promise<FavoriteFolderRefreshResult[]>;
  onChange: (patch: Partial<SearchFilterSettings>) => void;
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
    <section id="search-filter" className="bm-panel scroll-mt-6">
      <div className="bm-section-header">
        <button
          aria-label={props.settings.enabled ? "关闭过滤" : "开启过滤"}
          className="order-2 flex shrink-0 items-center justify-center"
          onClick={() => props.onChange({ enabled: !props.settings.enabled })}
          type="button"
        >
          <Switch enabled={props.settings.enabled} />
        </button>
        <div className="flex items-start gap-3">
          <Filter className="mt-0.5 h-5 w-5 shrink-0 text-bili-blue" />
          <div>
            <h2 className="bm-text-heading text-base font-medium">过滤搜索</h2>
            <p className="bm-text-muted mt-1 text-sm">减少低相关搜索结果</p>
          </div>
        </div>
      </div>

      <div className="space-y-5 px-4 py-5 sm:px-5">
        <Button
          onClick={() => props.onFilterTrendingChange(!props.filterTrending)}
          variant="toggleRow"
        >
          <span>
            <span className="block font-medium">过滤搜索热榜</span>
            <span className="bm-text-muted mt-1 block text-xs">
              移除搜索页顶部的热榜内容，减少无关干扰
            </span>
          </span>
          <Switch enabled={props.filterTrending} />
        </Button>

        <RuleListEditor
          label="标题过滤词正则"
          placeholder="输入后回车，参考：震惊 | 迷惑行为 | 的一集"
          value={props.settings.titlePattern}
          onChange={titlePattern => props.onChange({ titlePattern })}
        />
        <RuleListEditor
          label="UP 主过滤词正则"
          placeholder="输入后回车，参考：影视 | 好剧 | 经典"
          value={props.settings.uploaderPattern}
          onChange={uploaderPattern => props.onChange({ uploaderPattern })}
        />
        <label className="block">
          <span className="bm-text-label mb-2 block text-sm font-medium">
            弹幕 / 播放互动率 临界值
          </span>
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center">
            <input
              className="bm-range flex-1"
              max="1"
              min="0"
              step="0.001"
              style={rangeStyle}
              type="range"
              value={ratePercent.toString()}
              onChange={event =>
                props.onChange({
                  minDanmakuViewRate: fromRatePercent(event.target.value),
                })
              }
            />
            <div className="bm-number-input-group">
              <input
                className="bm-number-input bm-number-input-field"
                max="1"
                min="0"
                step="0.001"
                type="number"
                value={ratePercent.toString()}
                onChange={event =>
                  props.onChange({
                    minDanmakuViewRate: fromRatePercent(event.target.value),
                  })
                }
              />
              <span className="bm-number-suffix">%</span>
              <div className="flex w-7 flex-col border-l border-slate-200 bg-slate-50/80 dark:border-white/10 dark:bg-white/[0.04]">
                <Button
                  aria-label="增加互动率阈值"
                  icon={<ChevronUp className="h-3 w-3" />}
                  onClick={() => stepRatePercent(0.001)}
                  size="sm"
                  variant="numberStep"
                />
                <Button
                  aria-label="减少互动率阈值"
                  icon={<ChevronDown className="h-3 w-3" />}
                  onClick={() => stepRatePercent(-0.001)}
                  size="sm"
                  variant="numberStep"
                />
              </div>
            </div>
          </div>
          <span className="bm-text-muted mt-1 block text-xs">
            取值范围 0-1%；弹幕为 0 时不会触发
          </span>
        </label>
        <div className="divide-y divide-slate-100 overflow-hidden rounded-lg bg-bili-canvas transition-colors duration-300 ease-out dark:divide-[#30343c] dark:bg-[#15181e]">
          <Button
            onClick={() =>
              props.onChange({
                filterLowDanmakuViewRate: !props.settings.filterLowDanmakuViewRate,
              })
            }
            variant="toggleGroupRow"
          >
            <span>
              <span className="block font-medium">过滤互动率过低的视频</span>
              <span className="bm-text-muted mt-1 block text-xs">
                互动率低于阈值时，直接加遮罩过滤
              </span>
            </span>
            <Switch enabled={props.settings.filterLowDanmakuViewRate} />
          </Button>
          <Button
            active={props.settings.filterLowDanmakuViewRate}
            disabled={props.settings.filterLowDanmakuViewRate}
            onClick={() =>
              props.onChange({
                grayscaleLowDanmakuViewRate: !props.settings.grayscaleLowDanmakuViewRate,
              })
            }
            variant="toggleGroupRow"
          >
            <span>
              <span className="block font-medium">黑白处理低互动率低的视频</span>
              <span className="bm-text-muted mt-1 block text-xs">
                不过滤，仅将视频封面和标题降为黑白
              </span>
            </span>
            <Switch
              disabled={props.settings.filterLowDanmakuViewRate}
              enabled={props.settings.grayscaleLowDanmakuViewRate}
            />
          </Button>
        </div>

        <div className="divide-y divide-slate-100 overflow-hidden rounded-lg bg-bili-canvas transition-colors duration-300 ease-out dark:divide-[#30343c] dark:bg-[#15181e]">
          <Button
            onClick={() =>
              props.onChange({
                filterMissingTitleHighlight: !props.settings.filterMissingTitleHighlight,
              })
            }
            variant="toggleGroupRow"
          >
            <span>
              <span className="block font-medium">过滤未命中搜索词的视频</span>
              <span className="bm-text-muted mt-1 block text-xs">
                搜索词没有出现在标题高亮或完整 UP 名中时，过滤
              </span>
            </span>
            <Switch enabled={props.settings.filterMissingTitleHighlight} />
          </Button>
          <Button
            active={props.settings.filterMissingTitleHighlight}
            disabled={props.settings.filterMissingTitleHighlight}
            onClick={() =>
              props.onChange({
                grayscaleMissingTitleHighlight: !props.settings.grayscaleMissingTitleHighlight,
              })
            }
            variant="toggleGroupRow"
          >
            <span>
              <span className="block font-medium">黑白处理未命中搜索词的视频</span>
              <span className="bm-text-muted mt-1 block text-xs">
                不过滤视频，仅将视频封面和标题降为黑白
              </span>
            </span>
            <Switch
              disabled={props.settings.filterMissingTitleHighlight}
              enabled={props.settings.grayscaleMissingTitleHighlight}
            />
          </Button>
        </div>

        <div className="overflow-hidden rounded-lg bg-bili-canvas transition-colors duration-300 ease-out dark:bg-[#15181e]">
          <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-3 py-3 dark:border-[#30343c]">
            <div className="flex items-center gap-2">
              <Folder className="h-4 w-4 text-bili-blue" />
              <span className="bm-text-label text-sm font-medium">收藏夹推荐</span>
            </div>
            <button
              aria-label={
                props.favoriteRecommendation.enabled ? "关闭收藏夹推荐" : "开启收藏夹推荐"
              }
              className="flex shrink-0 items-center justify-center"
              onClick={() =>
                props.onFavoriteRecommendationChange({
                  enabled: !props.favoriteRecommendation.enabled,
                })
              }
              type="button"
            >
              <Switch enabled={props.favoriteRecommendation.enabled} />
            </button>
          </div>

          <div className="space-y-4 px-3 py-4">
            <FavoriteFolderManager
              folderIds={props.favoriteRecommendation.folderIds}
              onChange={folderIds => props.onFavoriteRecommendationChange({ folderIds })}
              onRefresh={props.onRefreshFavoriteRecommendation}
            />

            <label className="block">
              <span className="mb-2 flex items-center justify-between gap-3">
                <span className="bm-text-label text-sm font-medium">
                  遮罩推荐比例，100%时会替换所有遮罩为收藏夹视频
                </span>
                <output className="bm-text-muted text-sm tabular-nums">
                  {recommendationPercent}%
                </output>
              </span>
              <input
                className="bm-range w-full"
                max="100"
                min="0"
                step="5"
                style={recommendationRangeStyle}
                type="range"
                value={recommendationPercent.toString()}
                onChange={event =>
                  props.onFavoriteRecommendationChange({
                    recommendationRate: clamp(Number(event.target.value), 0, 100) / 100,
                  })
                }
              />
            </label>
          </div>
        </div>
      </div>
    </section>
  );
}
