import type { WatchTimerSettings } from "../../shared/types";
import { Clock, X } from "lucide-react";
import { Button } from "../components/button";
import { Switch } from "../components/switch";
import { clamp, getRangeProgressStyle } from "../utils";

export function WatchTimerPanel(props: {
  enabled: boolean;
  settings: WatchTimerSettings;
  onChange: (patch: Partial<WatchTimerSettings>) => void;
  onEnabledChange: (enabled: boolean) => void;
}) {
  const opacityPercent = Math.round(props.settings.opacity * 100);
  const opacityProgress = ((props.settings.opacity - 0.45) / 0.55) * 100;

  return (
    <section id="watch-timer" className="bm-panel scroll-mt-6">
      <div className="bm-section-header">
        <div className="bm-content-wrap">
          <div className="flex items-start gap-3">
            <Clock className="mt-0.5 h-5 w-5 shrink-0 text-bili-blue" />
            <div>
              <h2 className="bm-text-heading text-base font-medium">计时器</h2>
              <p className="bm-text-muted mt-1 text-sm">统计当前播放器实际播放时间</p>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-5 px-4 py-5 sm:px-5">
        <Button onClick={() => props.onEnabledChange(!props.enabled)} variant="toggleRow">
          <span>
            <span className="block font-medium">启用计时器</span>
            <span className="bm-text-muted mt-1 block text-xs">
              播放器浮层可拖动，全屏时自动隐藏
            </span>
          </span>
          <Switch enabled={props.enabled} />
        </Button>

        <div className="grid gap-4 rounded-lg bg-bili-canvas p-3 sm:grid-cols-[10rem_minmax(0,1fr)] sm:items-center dark:bg-[#15181e]">
          <div className="group relative w-full overflow-hidden rounded-[14px] px-3 pb-2.5 pt-3 text-slate-50 shadow-[0_12px_26px_rgba(2,8,23,0.24)]">
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 rounded-[inherit] border border-slate-400/20 bg-gradient-to-br from-[#081824] to-[#112f41] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition-opacity duration-200 ease-out"
              style={{ opacity: props.settings.opacity }}
            />
            <span
              aria-hidden="true"
              className="absolute right-2 top-2 z-20 inline-flex h-6 w-6 items-center justify-center rounded-md border border-white/10 bg-slate-950/30 text-slate-300/60 opacity-0 transition-[opacity,color,background-color] duration-150 ease-out group-hover:opacity-100"
            >
              <X aria-hidden="true" className="h-3.5 w-3.5" />
            </span>
            <strong className="relative z-10 block text-2xl leading-none tracking-normal">
              00:00
            </strong>
            <span className="relative z-10 mt-2.5 flex justify-between text-xs font-medium text-sky-100/80">
              <span>今日：</span>
              <span>00:00</span>
            </span>
          </div>

          <label className="block min-w-0">
            <span className="bm-text-label mb-2 block text-sm font-medium">计时器透明度</span>
            <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center">
              <input
                className="bm-range min-w-0 flex-1"
                max="1"
                min="0.45"
                step="0.01"
                style={getRangeProgressStyle(opacityProgress)}
                type="range"
                value={props.settings.opacity.toString()}
                onChange={event =>
                  props.onChange({
                    opacity: clamp(Number(event.target.value), 0.45, 1),
                  })
                }
              />
              <div className="bm-number-input-group">
                <input
                  className="bm-number-input bm-number-input-field"
                  max="100"
                  min="45"
                  step="1"
                  type="number"
                  value={opacityPercent.toString()}
                  onChange={event =>
                    props.onChange({
                      opacity: clamp(Number(event.target.value) / 100, 0.45, 1),
                    })
                  }
                />
                <span className="bm-number-suffix">%</span>
              </div>
            </div>
          </label>
        </div>
      </div>
    </section>
  );
}
