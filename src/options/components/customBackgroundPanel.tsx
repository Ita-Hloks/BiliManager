import { ImagePlus, Trash2, Upload } from "lucide-react";
import { useRef } from "react";
import type { CustomBackgroundSettings } from "../../shared/types";

import { clamp, getRangeProgressStyle } from "../utils";
import { Button } from "./button";
import { Switch } from "./switch";

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

  const fileInput = (
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
  );

  if (!hasImage) {
    return (
      <div className="rounded-lg bg-bili-canvas p-3 dark:bg-[#15181e]">
        {fileInput}
        <button
          className="bm-text-muted flex min-h-36 w-full flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-slate-300 bg-white/45 p-5 text-sm transition-colors hover:border-bili-blue/60 hover:bg-sky-50/70 hover:text-bili-blue focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bili-blue/40 dark:border-slate-600 dark:bg-slate-950/20 dark:hover:border-bili-blue/60 dark:hover:bg-bili-blue/10 dark:hover:text-sky-200"
          onClick={() => inputRef.current?.click()}
          type="button"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-100 text-bili-blue dark:bg-bili-blue/15 dark:text-sky-200">
            <ImagePlus aria-hidden="true" className="h-5 w-5" />
          </span>
          <span className="flex flex-col items-center gap-1">
            <span className="font-medium">选择背景图</span>
            <span className="text-xs font-normal opacity-70">支持 PNG、JPEG 和 WebP</span>
          </span>
        </button>
        {props.message && <p className="bm-notice mt-3 text-xs">{props.message}</p>}
      </div>
    );
  }

  return (
    <div className="grid gap-4 rounded-lg bg-bili-canvas p-3 sm:grid-cols-[minmax(0,16rem)_minmax(0,1fr)] dark:bg-[#15181e]">
      {fileInput}
      <div className="relative aspect-video w-full overflow-hidden rounded-md border border-sky-300/35 text-left shadow-sm">
        <span className="absolute left-2 top-2 z-10 rounded border border-white/15 bg-slate-950/55 px-2 py-0.5 text-[11px] font-medium text-white shadow-sm">
          预览
        </span>
        <img
          alt=""
          className="h-full w-full object-cover"
          src={props.background.imageDataUrl}
          style={{
            objectPosition: `${props.background.positionX}% ${props.background.positionY}%`,
          }}
        />
        <span
          className="pointer-events-none absolute inset-0 bg-white dark:bg-slate-950"
          style={{ opacity: props.background.maskOpacity }}
        />
      </div>

      <div className="min-w-0 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="bm-text-label block text-sm font-medium">背景图</span>
            <span className="bm-text-muted mt-1 block text-xs">调整图片位置与遮罩透明度</span>
          </div>
          <button
            aria-label={props.background.enabled ? "关闭背景图" : "启用背景图"}
            className="inline-flex shrink-0 items-center justify-center rounded-full p-1 transition-opacity duration-300 ease-out"
            onClick={() => props.onChange({ enabled: !props.background.enabled })}
            type="button"
          >
            <Switch enabled={props.background.enabled} />
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button icon={<Upload className="h-4 w-4" />} onClick={() => inputRef.current?.click()}>
            更换
          </Button>
          <Button icon={<Trash2 className="h-4 w-4" />} onClick={props.onClear}>
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
