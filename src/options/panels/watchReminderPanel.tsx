import { BellRing } from "lucide-react";
import type { WatchReminderSettings } from "../../shared/types";
import { NumberField } from "../components/numberInput";
import { SettingRow, SettingSection, SwitchButton } from "../components/settingPrimitives";

export function WatchReminderPanel(props: {
  enabled: boolean;
  settings: WatchReminderSettings;
  onChange: (patch: Partial<WatchReminderSettings>) => void;
  onEnabledChange: (enabled: boolean) => void;
}) {
  return (
    <SettingSection
      description="连续看太久时自动暂停视频、退出全屏，提醒你起身休息"
      disabled={!props.enabled}
      headerAction={
        <SwitchButton
          ariaLabel={props.enabled ? "关闭休息提醒" : "启用休息提醒"}
          checked={props.enabled}
          onChange={props.onEnabledChange}
        />
      }
      icon={<BellRing className="h-4 w-4" />}
      id="watch-reminder"
      title="休息提醒"
    >
      <SettingRow
        control={
          <NumberField
            ariaLabel="单次最长连看"
            disabled={!props.enabled}
            integer
            max={720}
            min={1}
            step={1}
            suffix="分钟"
            value={props.settings.limitMinutes}
            widthClassName="w-32"
            onCommit={limitMinutes => props.onChange({ limitMinutes })}
          />
        }
        description="前台连续看满这个时间就会弹出休息提醒（1 ~ 720 分钟）"
        title="单次最长连看"
      />

      <SettingRow
        control={
          <NumberField
            ariaLabel="休息重置时长"
            disabled={!props.enabled}
            integer
            max={120}
            min={1}
            step={1}
            suffix="分钟"
            value={props.settings.interruptionMinutes}
            widthClassName="w-32"
            onCommit={interruptionMinutes => props.onChange({ interruptionMinutes })}
          />
        }
        description="暂停或切走超过这个时间，就当休息好了，重新开始计时（1 ~ 120 分钟）"
        title="休息重置时长"
      />
    </SettingSection>
  );
}
