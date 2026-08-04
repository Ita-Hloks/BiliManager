import { Palette, Settings2 } from "lucide-react";
import type { RefObject } from "react";
import type { CustomBackgroundSettings, ExtensionSettings } from "../../shared/types";
import type { DataExportKind } from "../dataTransfer";
import { CustomBackgroundPanel } from "../components/customBackgroundPanel";
import { ThemeSwitch } from "../components/themeSwitch";
import { DataPanel } from "./dataPanel";

export function GeneralSettingsPanel(props: {
  background: CustomBackgroundSettings;
  backgroundMessage: string;
  importInputRef: RefObject<HTMLInputElement | null>;
  importMessage: string;
  theme: ExtensionSettings["theme"];
  onBackgroundChange: (patch: Partial<CustomBackgroundSettings>) => void;
  onBackgroundClear: () => void;
  onBackgroundUpload: (file: File) => void;
  onExport: (kind: DataExportKind) => void;
  onImport: (file: File) => void;
  onThemeChange: (theme: ExtensionSettings["theme"]) => void;
}) {
  return (
    <>
      <section id="general-appearance" className="bm-panel scroll-mt-6">
        <div className="bm-section-header">
          <div className="bm-content-wrap">
            <div className="flex items-start gap-3">
              <Settings2 className="mt-0.5 h-5 w-5 shrink-0 text-bili-blue" />
              <div>
                <h2 className="bm-text-heading text-base font-medium">界面</h2>
                <p className="bm-text-muted mt-1 text-sm">主题与页面背景</p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-5 px-4 py-5 sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg bg-bili-canvas px-3 py-3 dark:bg-[#15181e]">
            <div className="flex min-w-0 items-center gap-2">
              <Palette className="h-4 w-4 shrink-0 text-bili-blue" />
              <div>
                <span className="bm-text-label block text-sm font-medium">主题</span>
                <span className="bm-text-muted mt-1 block text-xs">选择设置页的配色模式</span>
              </div>
            </div>
            <ThemeSwitch value={props.theme} onChange={props.onThemeChange} />
          </div>

          <div>
            <div className="mb-3 flex items-center gap-2">
              <span className="bm-text-label text-sm font-medium">页面背景</span>
              <span className="bm-text-muted text-xs">应用于主要 B 站页面</span>
            </div>
            <CustomBackgroundPanel
              background={props.background}
              message={props.backgroundMessage}
              onChange={props.onBackgroundChange}
              onClear={props.onBackgroundClear}
              onUpload={props.onBackgroundUpload}
            />
          </div>
        </div>
      </section>

      <DataPanel
        importInputRef={props.importInputRef}
        importMessage={props.importMessage}
        onExport={props.onExport}
        onImport={props.onImport}
      />
    </>
  );
}
