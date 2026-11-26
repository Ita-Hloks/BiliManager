import { Clock, X } from "lucide-react";
import type { WatchTimerSettings } from "../../shared/types";
import { NumberField } from "../components/numberInput";
import { SettingRow, SettingSection, SwitchButton } from "../components/settingPrimitives";
import type { UpdateCommitOptions } from "../useOptionsSettings";
import { clamp, getRangeProgressStyle } from "../utils";

export function WatchTimerPanel(props: {
  enabled: boolean;
  settings: WatchTimerSettings;
  onChange: (patch: Partial<WatchTimerSettings>, options?: UpdateCommitOptions) => void;
  onEnabledChange: (enabled: boolean) => void;
}) {
  const opacityPercent = Math.round(props.settings.opacity * 100);
  const opacityProgress = ((props.settings.opacity - 0.45) / 0.55) * 100;

  return (
    <SettingSection
      description="在播放页显示悬浮计时卡片并统计观看时长；卡片可拖动，全屏自动隐藏"
      disabled={!props.enabled}
      headerAction={
        <SwitchButton
          ariaLabel={props.enabled ? "关闭观看计时器" : "启用观看计时器"}
          checked={props.enabled}
          onChange={props.onEnabledChange}
        />
      }
      icon={<Clock className="h-4 w-4" />}
      id="watch-timer"
      title="观看计时器"
    >
      <SettingRow
        description="数值越高卡片背景越实、文字越清晰；拖动滑块可实时看左侧效果"
        title="浮层背景浓度"
      >
        <div className="grid gap-5 sm:grid-cols-[10rem_minmax(0,1fr)] sm:items-center">
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

          <div className="flex w-full min-w-0 flex-col gap-3 sm:flex-row sm:items-center">
            <input
              aria-label="浮层背景浓度"
              className="bm-range min-w-0 flex-1"
              max="1"
              min="0.45"
              step="0.01"
              style={getRangeProgressStyle(opacityProgress)}
              type="range"
              value={props.settings.opacity.toString()}
              onChange={event =>
                props.onChange(
                  { opacity: clamp(Number(event.target.value), 0.45, 1) },
                  { debounce: true },
                )
              }
            />
            <NumberField
              ariaLabel="浮层背景浓度"
              integer
              max={100}
              min={45}
              step={1}
              suffix="%"
              value={opacityPercent}
              widthClassName="w-28"
              onCommit={percent =>
                props.onChange({
                  opacity: clamp(percent / 100, 0.45, 1),
                })
              }
            />
          </div>
        </div>
      </SettingRow>
    </SettingSection>
  );
}
