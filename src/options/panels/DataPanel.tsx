import { Download, Upload } from "lucide-react";
import type { RefObject } from "react";
import { Button } from "../components/button";

export function DataPanel(props: {
  importInputRef: RefObject<HTMLInputElement | null>;
  importMessage: string;
  onExport: () => void;
  onImport: (file: File) => void;
}) {
  return (
    <section id="data" className="bm-panel scroll-mt-6">
      <div className="bm-section-header">
        <div className="bm-content-wrap">
          <div>
            <h2 className="bm-text-heading text-base font-medium">配置管理</h2>
            <p className="bm-text-muted mt-1 text-sm">导出备份，支持 JSON 配置与 TXT 规则导入</p>
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
            <Button
              icon={<Upload className="h-4 w-4" />}
              onClick={() => props.importInputRef.current?.click()}
            >
              导入
            </Button>
            <Button icon={<Download className="h-4 w-4" />} onClick={props.onExport}>
              导出
            </Button>
          </div>
        </div>
      </div>
      {props.importMessage && <p className="bm-notice mx-5 mb-5">{props.importMessage}</p>}
    </section>
  );
}
