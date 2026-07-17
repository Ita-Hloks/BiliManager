import type { WatchReminderSettings } from "../../shared/types";
import { BellRing } from "lucide-react";
import { Button } from "../components/button";
import { Switch } from "../components/switch";
import { clamp } from "../utils";

export function WatchReminderPanel(props: {
  enabled: boolean;
  settings: WatchReminderSettings;
  onChange: (patch: Partial<WatchReminderSettings>) => void;
  onEnabledChange: (enabled: boolean) => void;
}) {
  return (
    <section id="watch-reminder" className="bm-panel scroll-mt-6">
      <div className="bm-section-header">
        <div className="bm-content-wrap">
          <div className="flex items-start gap-3">
            <BellRing className="mt-0.5 h-5 w-5 shrink-0 text-bili-blue" />
            <div>
              <h2 className="bm-text-heading text-base font-medium">定时器</h2>
              <p className="bm-text-muted mt-1 text-sm">连续观看提醒</p>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4 px-4 py-5 sm:px-5">
        <Button onClick={() => props.onEnabledChange(!props.enabled)} variant="toggleRow">
          <span>
            <span className="block font-medium">启用定时器</span>
            <span className="bm-text-muted mt-1 block text-xs">
              达到设定时长后暂停播放、退出全屏并提醒
            </span>
          </span>
          <Switch enabled={props.enabled} />
        </Button>

        <div
          className={`space-y-4 rounded-lg bg-bili-canvas p-4 transition-opacity dark:bg-[#15181e] ${
            props.enabled ? "opacity-100" : "opacity-50"
          }`}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <MinuteInput
              disabled={!props.enabled}
              hint="达到后自动暂停并提醒"
              label="连续播放时间"
              max={720}
              value={props.settings.limitMinutes}
              onChange={limitMinutes => props.onChange({ limitMinutes })}
            />
            <MinuteInput
              disabled={!props.enabled}
              hint="达到后视为新的观看周期"
              label="连续观看间隔"
              max={120}
              value={props.settings.interruptionMinutes}
              onChange={interruptionMinutes => props.onChange({ interruptionMinutes })}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function MinuteInput(props: {
  disabled: boolean;
  hint: string;
  label: string;
  max: number;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block min-w-0 rounded-lg border border-slate-200 bg-white p-4 dark:border-[#30343c] dark:bg-[#1c1f26]">
      <span className="bm-text-label block text-sm font-medium">{props.label}</span>
      <span className="bm-text-muted mt-1 block text-xs">{props.hint}</span>
      <div className="mt-3 flex items-center gap-3">
        <input
          className="bm-number-input min-w-0 flex-1 rounded-lg border border-slate-200 bg-bili-canvas px-3 py-2 text-right text-sm text-slate-900 outline-none transition-colors focus:border-bili-blue focus:ring-2 focus:ring-bili-blue/15 disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#30343c] dark:bg-[#15181e] dark:text-slate-100 dark:focus:border-bili-blue"
          disabled={props.disabled}
          max={props.max}
          min="1"
          step="1"
          type="number"
          value={props.value.toString()}
          onChange={event =>
            props.onChange(Math.round(clamp(Number(event.target.value), 1, props.max)))
          }
        />
        <span className="bm-text-muted shrink-0 whitespace-nowrap text-sm">分钟</span>
      </div>
    </label>
  );
}
