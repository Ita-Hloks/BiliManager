import { ChevronDown, Download, Upload } from "lucide-react";
import type { RefObject } from "react";
import { useEffect, useRef, useState } from "react";
import { Button } from "../components/button";
import { SettingNotice, SettingRow, SettingSection } from "../components/settingPrimitives";
import type { DataExportKind } from "../dataTransfer";
import type { OptionsStatusMessage } from "../useOptionsSettings";

const exportOptions: Array<{ kind: DataExportKind; label: string; desc: string }> = [
  { kind: "all", label: "全部数据", desc: "规则设置与观看记录" },
  { kind: "settings", label: "仅规则设置", desc: "过滤与屏蔽规则，不含壁纸" },
  { kind: "watchHistory", label: "仅观看记录", desc: "每日观看时长与视频列表" },
];

export function DataPanel(props: {
  importInputRef: RefObject<HTMLInputElement | null>;
  importMessage: OptionsStatusMessage | null;
  onExport: (kind: DataExportKind) => void;
  onImport: (file: File) => void;
}) {
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const menuContainerRef = useRef<HTMLDivElement>(null);
  const exportButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!exportMenuOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!menuContainerRef.current?.contains(event.target as Node)) {
        setExportMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setExportMenuOpen(false);
      exportButtonRef.current?.focus();
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [exportMenuOpen]);

  function exportData(kind: DataExportKind) {
    setExportMenuOpen(false);
    props.onExport(kind);
  }

  return (
    <SettingSection
      clipContent={false}
      description="把设置和观看记录导出成文件备份，换设备时随时导入恢复"
      icon={<Download className="h-4 w-4" />}
      id="data"
      title="数据管理"
    >
      <SettingRow
        control={
          <div ref={menuContainerRef} className="relative">
            <Button
              ref={exportButtonRef}
              aria-expanded={exportMenuOpen}
              aria-haspopup="menu"
              icon={<Download className="h-4 w-4" />}
              onClick={() => setExportMenuOpen(open => !open)}
            >
              导出备份
              <ChevronDown
                className={[
                  "h-4 w-4 transition-transform duration-200",
                  exportMenuOpen ? "rotate-180" : "",
                ].join(" ")}
              />
            </Button>

            {exportMenuOpen && (
              <div
                className="absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-lg border border-[var(--bm-border)] bg-[var(--bm-surface)] p-1 shadow-lg"
                role="menu"
              >
                {exportOptions.map(option => (
                  <button
                    key={option.kind}
                    className="group block w-full rounded-md px-3 py-2 text-left transition-colors duration-200 hover:bg-[var(--bm-surface-hover)] focus-visible:bg-[var(--bm-surface-hover)] focus-visible:outline-none"
                    role="menuitem"
                    type="button"
                    onClick={() => exportData(option.kind)}
                  >
                    <span className="block text-sm font-medium text-[var(--bm-text-primary)] group-hover:text-[var(--bm-accent)] group-focus-visible:text-[var(--bm-accent)]">
                      {option.label}
                    </span>
                    <span className="mt-0.5 block text-xs text-[var(--bm-text-tertiary)]">
                      {option.desc}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        }
        description="可导出全部内容、仅规则设置（不含壁纸），或仅观看记录"
        title="导出到本地"
      />

      <SettingRow
        control={
          <>
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
              选择文件导入
            </Button>
          </>
        }
        description="支持之前导出的 JSON 备份，也支持每行一个词的 .txt 标题屏蔽词文件"
        title="从文件导入"
      />

      {props.importMessage && (
        <div className="px-5 py-3.5">
          <SettingNotice tone={props.importMessage.tone}>
            <span role={props.importMessage.tone === "error" ? "alert" : "status"}>
              {props.importMessage.text}
            </span>
          </SettingNotice>
        </div>
      )}
    </SettingSection>
  );
}
