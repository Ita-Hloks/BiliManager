import { ChevronDown, ChevronUp } from "lucide-react";
import type { SearchFilterSettings } from "../../shared/types";
import { Button } from "../components/button";
import { RuleListEditor } from "../components/ruleListEditor";
import { Switch } from "../components/switch";
import { clamp, fromRatePercent, getRangeProgressStyle, toRatePercent } from "../utils";

// 搜索过滤面板只编辑 SearchFilterSettings patch，enabled 同步到 features 的规则留给 main.tsx 统一处理。
export function SearchFilterPanel(props: {
  settings: SearchFilterSettings;
  onChange: (patch: Partial<SearchFilterSettings>) => void;
}) {
  const ratePercent = toRatePercent(props.settings.minDanmakuViewRate);
  const rangeStyle = getRangeProgressStyle(ratePercent * 100);

  function stepRatePercent(delta: number) {
    const nextPercent = clamp(Number((ratePercent + delta).toFixed(2)), 0, 1);
    props.onChange({
      minDanmakuViewRate: fromRatePercent(nextPercent.toString()),
    });
  }

  return (
    <section id="search-filter" className="bm-panel scroll-mt-6">
      <div className="flex items-center justify-between gap-4 border-b border-white/70 px-4 py-4 transition-colors duration-300 ease-out sm:px-5 dark:border-white/10">
        <button
          aria-label={props.settings.enabled ? "关闭过滤" : "开启过滤"}
          className="order-2 flex shrink-0 items-center justify-center"
          onClick={() => props.onChange({ enabled: !props.settings.enabled })}
          type="button"
        >
          <Switch enabled={props.settings.enabled} />
        </button>
        <div>
          <h2 className="bm-text-heading text-base font-medium">过滤搜索</h2>
          <p className="bm-text-muted mt-1 text-sm">减少低相关搜索结果</p>
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
        <Button
          onClick={() =>
            props.onChange({
              filterMissingTitleHighlight: !props.settings.filterMissingTitleHighlight,
            })
          }
          variant="toggleRow"
        >
          <span>
            <span className="block font-medium">过滤无粉色命中标题</span>
            <span className="bm-text-muted mt-1 block text-xs">
              搜索词没有出现在标题高亮里时，标记为低相关结果
            </span>
          </span>
          <Switch enabled={props.settings.filterMissingTitleHighlight} />
        </Button>
      </div>
    </section>
  );
}
