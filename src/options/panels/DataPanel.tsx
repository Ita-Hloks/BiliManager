import { Download, Upload } from "lucide-react";
import type { RefObject } from "react";
import type { ThemePalette } from "../theme";

export function DataPanel(props: {
  importInputRef: RefObject<HTMLInputElement | null>;
  importMessage: string;
  palette: ThemePalette;
  onExport: () => void;
  onImport: (file: File) => void;
}) {
  return (
    <section id="data" className={`${props.palette.panel} scroll-mt-6`}>
      <div className={props.palette.sectionHeader}>
        <div className={props.palette.contentWrap}>
          <div>
            <h2 className={`text-base font-medium ${props.palette.heading}`}>配置管理</h2>
            <p className={`mt-1 text-sm ${props.palette.mutedText}`}>
              导出备份或从 JSON / TXT 文件导入规则
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <input
              ref={props.importInputRef}
              accept="application/json,.json,.txt"
              className="hidden"
              type="file"
              onChange={event => {
                const file = event.target.files?.[0];
                if (file) props.onImport(file);
              }}
            />
            <button
              className={props.palette.secondaryButton}
              onClick={() => props.importInputRef.current?.click()}
              type="button"
            >
              <Upload className="h-4 w-4" />
              导入
            </button>
            <button
              className={props.palette.secondaryButton}
              onClick={props.onExport}
              type="button"
            >
              <Download className="h-4 w-4" />
              导出
            </button>
          </div>
        </div>
      </div>
      {props.importMessage && (
        <p className={`${props.palette.contentNotice} ${props.palette.notice}`}>
          {props.importMessage}
        </p>
      )}
    </section>
  );
}
