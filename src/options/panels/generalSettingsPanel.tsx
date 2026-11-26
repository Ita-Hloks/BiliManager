import { Settings2 } from "lucide-react";
import type { CustomBackgroundSettings, ExtensionSettings } from "../../shared/types";
import { CustomBackgroundPanel } from "../components/customBackgroundPanel";
import { SettingRow, SettingSection } from "../components/settingPrimitives";
import { ThemeSwitch } from "../components/themeSwitch";
import type { OptionsStatusMessage, UpdateCommitOptions } from "../useOptionsSettings";

export function GeneralSettingsPanel(props: {
  background: CustomBackgroundSettings;
  backgroundImageDataUrl: string | null;
  backgroundMessage: OptionsStatusMessage | null;
  theme: ExtensionSettings["theme"];
  onBackgroundChange: (
    patch: Partial<CustomBackgroundSettings>,
    options?: UpdateCommitOptions,
  ) => void;
  onBackgroundClear: () => void;
  onBackgroundUpload: (file: File) => void;
  onThemeChange: (theme: ExtensionSettings["theme"]) => void;
}) {
  return (
    <SettingSection
      description="调整扩展配色，或给 B 站换上你喜欢的自定义壁纸"
      icon={<Settings2 className="h-4 w-4" />}
      id="general-appearance"
      title="界面与外观"
    >
      <SettingRow
        control={<ThemeSwitch value={props.theme} onChange={props.onThemeChange} />}
        description="控制工具栏弹窗与本设置页的亮暗风格"
        title="扩展配色"
      />

      <SettingRow
        description="应用于 B 站首页、搜索页、视频页等主要页面，壁纸仅保存在本地"
        title="自定义 B 站背景"
      >
        <CustomBackgroundPanel
          background={props.background}
          imageDataUrl={props.backgroundImageDataUrl}
          message={props.backgroundMessage}
          onChange={props.onBackgroundChange}
          onClear={props.onBackgroundClear}
          onUpload={props.onBackgroundUpload}
        />
      </SettingRow>
    </SettingSection>
  );
}
