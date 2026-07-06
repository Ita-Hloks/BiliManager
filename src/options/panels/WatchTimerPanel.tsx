import type { WatchTimerSettings } from "../../shared/types";
import { Switch } from "../components/switch";
import type { ThemePalette } from "../theme";
import { clamp, getRangeProgressStyle } from "../utils";

// 定时器面板把功能启用状态和浮层参数分开回传，避免 features.watchTimer 与 watchTimer 设置互相污染。
export function WatchTimerPanel(props: {
  enabled: boolean;
  isDark: boolean;
  palette: ThemePalette;
  settings: WatchTimerSettings;
  onChange: (patch: Partial<WatchTimerSettings>) => void;
  onEnabledChange: (enabled: boolean) => void;
}) {
  const opacityPercent = Math.round(props.settings.opacity * 100);
  const opacityProgress = ((props.settings.opacity - 0.45) / 0.55) * 100;

  return (
    <section id="watch-timer" className={`${props.palette.panel} scroll-mt-6`}>
      <div className={props.palette.sectionHeader}>
        <div className={props.palette.contentWrap}>
          <div>
            <h2 className={`text-base font-medium ${props.palette.heading}`}>定时器</h2>
            <p className={`mt-1 text-sm ${props.palette.mutedText}`}>统计当前播放器实际播放时间</p>
          </div>
        </div>
      </div>

      <div className="space-y-5 px-4 pb-5 sm:px-5">
        <button
          className={props.palette.toggleRow}
          onClick={() => props.onEnabledChange(!props.enabled)}
          type="button"
        >
          <span>
            <span className="block font-medium">启用定时器</span>
            <span className={`mt-1 block text-xs ${props.palette.mutedText}`}>
              播放器浮层可拖动，全屏时自动隐藏
            </span>
          </span>
          <Switch enabled={props.enabled} />
        </button>

        <div
          className={[
            "grid gap-4 rounded-md border p-3 sm:grid-cols-[10rem_minmax(0,1fr)] sm:items-center",
            props.isDark ? "border-white/10 bg-white/[0.04]" : "border-slate-200 bg-white/55",
          ].join(" ")}
        >
          <div
            className={[
              "w-full rounded-lg border px-3 py-2 shadow-[0_14px_34px_rgba(15,23,42,0.18)] backdrop-blur",
              props.isDark
                ? "border-sky-300/25 bg-[linear-gradient(135deg,rgba(14,165,233,0.2),rgba(15,23,42,0.72))] text-slate-50"
                : "border-sky-200 bg-[linear-gradient(135deg,rgba(14,165,233,0.18),rgba(15,23,42,0.68))] text-slate-50",
            ].join(" ")}
            style={{ opacity: props.settings.opacity }}
          >
            <strong className="block text-[22px] leading-none tracking-normal">00:00</strong>
            <span className="mt-2 flex justify-between text-xs font-medium text-slate-300">
              <span>今日：</span>
              <span>00:00</span>
            </span>
          </div>

          <label className="block min-w-0">
            <span className={`mb-2 block text-sm font-medium ${props.palette.label}`}>
              定时器透明度
            </span>
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
              <div className={props.palette.numberInputGroup}>
                <input
                  className={`bm-number-input ${props.palette.numberInputField}`}
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
                <span className={props.palette.numberSuffix}>%</span>
              </div>
            </div>
          </label>
        </div>
      </div>
    </section>
  );
}
