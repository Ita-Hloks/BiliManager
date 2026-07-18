import { ChevronDown, ChevronUp, Filter, Folder } from "lucide-react";
import type { FavoriteRecommendationSettings, SearchFilterSettings } from "../../shared/types";
import { Button } from "../components/button";
import { RuleListEditor } from "../components/ruleListEditor";
import { Switch } from "../components/switch";
import { clamp, fromRatePercent, getRangeProgressStyle, toRatePercent } from "../utils";

// 搜索过滤面板只编辑 SearchFilterSettings patch，enabled 同步到 features 的规则留给 main.tsx 统一处理。
export function SearchFilterPanel(props: {
  favoriteRecommendation: FavoriteRecommendationSettings;
  settings: SearchFilterSettings;
  onFavoriteRecommendationChange: (patch: Partial<FavoriteRecommendationSettings>) => void;
  favoriteRecommendationMessage: string;
  onRefreshFavoriteRecommendation: () => void;
  onChange: (patch: Partial<SearchFilterSettings>) => void;
}) {
  const ratePercent = toRatePercent(props.settings.minDanmakuViewRate);
  const rangeStyle = getRangeProgressStyle(ratePercent * 100);
  const recommendationPercent = Math.round(
    clamp(props.favoriteRecommendation.recommendationRate, 0, 1) * 100,
  );
  const recommendationRangeStyle = getRangeProgressStyle(recommendationPercent);

  function stepRatePercent(delta: number) {
    const nextPercent = clamp(Number((ratePercent + delta).toFixed(2)), 0, 1);
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
        <RuleListEditor
          label="标题过滤词正则"
          placeholder="输入后按回车，例如：关键词A|关键词B"
          value={props.settings.titlePattern}
          onChange={titlePattern => props.onChange({ titlePattern })}
        />
        <RuleListEditor
          label="UP 主过滤词正则"
          placeholder="输入后按回车，例如：账号名|作者关键词"
          value={props.settings.uploaderPattern}
          onChange={uploaderPattern => props.onChange({ uploaderPattern })}
        />
        <label className="block">
          <span className="bm-text-label mb-2 block text-sm font-medium">
            最低弹幕 / 播放互动率
          </span>
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center">
            <input
              className="bm-range flex-1"
              max="1"
              min="0"
              step="0.01"
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
                step="0.01"
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
                  onClick={() => stepRatePercent(0.01)}
                  size="sm"
                  variant="numberStep"
                />
                <Button
                  aria-label="减少互动率阈值"
                  icon={<ChevronDown className="h-3 w-3" />}
                  onClick={() => stepRatePercent(-0.01)}
                  size="sm"
                  variant="numberStep"
                />
              </div>
            </div>
          </div>
          <span className="bm-text-muted mt-1 block text-xs">
            取值范围 0-1%；弹幕为 0 时不会触发互动率过低
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
                弹幕与播放比例低于阈值时，标记为低相关结果
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
              <span className="block font-medium">黑白处理互动率过低的视频</span>
              <span className="bm-text-muted mt-1 block text-xs">
                不过滤卡片，仅将视频封面和标题降为黑白
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
              <span className="block font-medium">过滤无粉色命中标题</span>
              <span className="bm-text-muted mt-1 block text-xs">
                搜索词没有出现在标题高亮里时，标记为低相关结果
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
              <span className="block font-medium">黑白处理无粉色命中的视频</span>
              <span className="bm-text-muted mt-1 block text-xs">
                不过滤卡片，仅将视频封面和标题降为黑白
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
            <label className="block">
              <span className="bm-text-label mb-2 block text-sm font-medium">收藏夹 ID</span>
              <input
                className="bm-text-input w-full"
                inputMode="numeric"
                placeholder="2045665532"
                type="text"
                value={props.favoriteRecommendation.folderId}
                onChange={event =>
                  props.onFavoriteRecommendationChange({
                    folderId: event.target.value.replace(/\D/g, ""),
                  })
                }
              />
              <span className="bm-text-muted mt-1 block text-xs">取自收藏夹地址中的 fid 参数</span>
            </label>

            <div className="flex items-center gap-3">
              <Button
                disabled={!props.favoriteRecommendation.folderId}
                onClick={props.onRefreshFavoriteRecommendation}
                size="sm"
                variant="secondary"
              >
                手动更新收藏夹
              </Button>
              {props.favoriteRecommendationMessage && (
                <span className="bm-text-muted text-xs">{props.favoriteRecommendationMessage}</span>
              )}
            </div>

            <label className="block">
              <span className="mb-2 flex items-center justify-between gap-3">
                <span className="bm-text-label text-sm font-medium">遮罩推荐比例</span>
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
