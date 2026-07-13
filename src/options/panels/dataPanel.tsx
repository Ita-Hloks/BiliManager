import { ChevronDown, Download, Upload } from "lucide-react";
import type { RefObject } from "react";
import { useState } from "react";
import type { DataExportKind } from "../dataTransfer";
import { Button } from "../components/button";

const exportOptions: Array<{ kind: DataExportKind; label: string }> = [
  { kind: "all", label: "全部数据" },
  { kind: "settings", label: "设置配置" },
  { kind: "watchHistory", label: "观看历史" },
];

export function DataPanel(props: {
  importInputRef: RefObject<HTMLInputElement | null>;
  importMessage: string;
  onExport: (kind: DataExportKind) => void;
  onImport: (file: File) => void;
}) {
  const [exportMenuOpen, setExportMenuOpen] = useState(false);

  function exportData(kind: DataExportKind) {
    setExportMenuOpen(false);
    props.onExport(kind);
  }

  return (
    <section id="data" className="bm-panel scroll-mt-6">
      <div className="bm-section-header">
        <div className="bm-content-wrap">
          <div className="flex items-start gap-3">
            <Download className="mt-0.5 h-5 w-5 shrink-0 text-sky-500" />
            <div>
              <h2 className="bm-text-heading text-base font-medium">数据管理</h2>
              <p className="bm-text-muted mt-1 text-sm">导入备份，或按类型导出数据</p>
            </div>
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

            <div className="relative">
              <Button
                icon={<Download className="h-4 w-4" />}
                onClick={() => setExportMenuOpen(open => !open)}
              >
                导出
                <ChevronDown
                  className={[
                    "h-4 w-4 transition-transform duration-200",
                    exportMenuOpen ? "rotate-180" : "",
                  ].join(" ")}
                />
              </Button>

              {exportMenuOpen && (
                <div className="absolute right-0 z-20 mt-2 w-36 overflow-hidden rounded-md border border-white/70 bg-white/95 p-1 shadow-xl shadow-slate-200/60 backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/95 dark:shadow-slate-950/40">
                  {exportOptions.map(option => (
                    <button
                      key={option.kind}
                      className="block w-full whitespace-nowrap rounded px-3 py-2 text-left text-sm font-medium text-slate-800 transition-colors duration-200 hover:bg-sky-50 dark:text-slate-100 dark:hover:bg-white/[0.08]"
                      onClick={() => exportData(option.kind)}
                      type="button"
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {props.importMessage && <p className="bm-notice mx-5 mb-5">{props.importMessage}</p>}
    </section>
  );
}
