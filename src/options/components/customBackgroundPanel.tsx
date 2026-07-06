import { Trash2, Upload } from "lucide-react";
import { useRef } from "react";
import type { CustomBackgroundSettings } from "../../shared/types";

import { clamp, getRangeProgressStyle } from "../utils";
import { Button } from "./button";
import { Switch } from "./switch";

// 背景图面板只负责预览和输入事件，图片压缩、存储和功能启用推导由上层复用统一链路处理。
export function CustomBackgroundPanel(props: {
  background: CustomBackgroundSettings;
  message: string;
  onChange: (patch: Partial<CustomBackgroundSettings>) => void;
  onClear: () => void;
  onUpload: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const hasImage = !!props.background.imageDataUrl;
  const maskOpacityPercent = Math.round(props.background.maskOpacity * 100);
  const maskOpacityStyle = getRangeProgressStyle((props.background.maskOpacity / 0.7) * 100);
  const rangeXStyle = getRangeProgressStyle(props.background.positionX);
  const rangeYStyle = getRangeProgressStyle(props.background.positionY);

  return (
    <div className="grid gap-4 rounded-md border border-sky-300/20 bg-sky-300/[0.06] p-3 sm:grid-cols-[minmax(0,16rem)_minmax(0,1fr)]">
      <div
        className={[
          "relative aspect-video w-full overflow-hidden rounded-md border text-left shadow-sm",
          hasImage ? "border-sky-300/35" : "border-white/10 bg-slate-950/35",
        ].join(" ")}
      >
        <span className="absolute left-2 top-2 z-10 rounded border border-white/15 bg-slate-950/55 px-2 py-0.5 text-[11px] font-medium text-white shadow-sm">
          预览
        </span>
        {hasImage ? (
          <img
            alt=""
            className="h-full w-full object-cover"
            src={props.background.imageDataUrl}
            style={{
              objectPosition: `${props.background.positionX}% ${props.background.positionY}%`,
            }}
          />
        ) : (
          <span className="bm-text-muted flex h-full items-center justify-center text-sm">
            选择背景图
          </span>
        )}
        {hasImage && (
          <span
            className="pointer-events-none absolute inset-0 bg-white dark:bg-slate-950"
            style={{
              opacity: props.background.maskOpacity,
            }}
          />
        )}
      </div>

      <div className="min-w-0 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="bm-text-label block text-sm font-medium">背景图</span>
            <span className="bm-text-muted mt-1 block text-xs">调整图片位置与遮罩透明度</span>
          </div>
          <button
            aria-label={props.background.enabled ? "关闭背景图" : "启用背景图"}
            className="inline-flex shrink-0 items-center justify-center rounded-full p-1 transition-opacity duration-300 ease-out disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!hasImage}
            onClick={() => props.onChange({ enabled: !props.background.enabled })}
            type="button"
          >
            <Switch enabled={props.background.enabled && hasImage} />
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          <input
            ref={inputRef}
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            type="file"
            onChange={event => {
              const file = event.target.files?.[0];
              if (file) props.onUpload(file);
              if (inputRef.current) inputRef.current.value = "";
            }}
          />
          <Button icon={<Upload className="h-4 w-4" />} onClick={() => inputRef.current?.click()}>
            上传
          </Button>
          <Button
            disabled={!hasImage}
            icon={<Trash2 className="h-4 w-4" />}
            onClick={props.onClear}
          >
            清除
          </Button>
        </div>

        <label className="block min-w-0">
          <span className="bm-text-muted mb-2 flex items-center justify-between text-xs font-medium">
            <span>遮罩透明度</span>
            <span>{maskOpacityPercent}%</span>
          </span>
          <input
            className="bm-range w-full"
            disabled={!hasImage}
            max="0.7"
            min="0"
            step="0.01"
            style={maskOpacityStyle}
            type="range"
            value={props.background.maskOpacity.toString()}
            onChange={event =>
              props.onChange({ maskOpacity: clamp(Number(event.target.value), 0, 0.7) })
            }
          />
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block min-w-0">
            <span className="bm-text-muted mb-2 block text-xs font-medium">横向位置</span>
            <input
              className="bm-range w-full"
              disabled={!hasImage}
              max="100"
              min="0"
              step="1"
              style={rangeXStyle}
              type="range"
              value={props.background.positionX.toString()}
              onChange={event => props.onChange({ positionX: Number(event.target.value) })}
            />
          </label>
          <label className="block min-w-0">
            <span className="bm-text-muted mb-2 block text-xs font-medium">纵向位置</span>
            <input
              className="bm-range w-full"
              disabled={!hasImage}
              max="100"
              min="0"
              step="1"
              style={rangeYStyle}
              type="range"
              value={props.background.positionY.toString()}
              onChange={event => props.onChange({ positionY: Number(event.target.value) })}
            />
          </label>
        </div>

        {props.message && <p className="bm-notice text-xs">{props.message}</p>}
      </div>
    </div>
  );
}
