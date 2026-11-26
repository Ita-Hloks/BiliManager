import { ImagePlus, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import type { CustomBackgroundSettings } from "../../shared/types";
import type { OptionsStatusMessage, UpdateCommitOptions } from "../useOptionsSettings";
import { clamp, getRangeProgressStyle } from "../utils";
import { Button } from "./button";
import { SettingNotice, SwitchButton } from "./settingPrimitives";

export function CustomBackgroundPanel(props: {
  background: CustomBackgroundSettings;
  imageDataUrl: string | null;
  message: OptionsStatusMessage | null;
  onChange: (patch: Partial<CustomBackgroundSettings>, options?: UpdateCommitOptions) => void;
  onClear: () => void;
  onUpload: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [imageDimensions, setImageDimensions] = useState<{
    src: string;
    width: number;
    height: number;
  } | null>(null);
  const hasImage = props.background.hasImage && !!props.imageDataUrl;
  const maskOpacityPercent = Math.round(props.background.maskOpacity * 100);
  const maskOpacityStyle = getRangeProgressStyle(props.background.maskOpacity * 100);
  const rangeXStyle = getRangeProgressStyle(props.background.positionX);
  const rangeYStyle = getRangeProgressStyle(props.background.positionY);
  const loadedDimensions =
    props.imageDataUrl && imageDimensions?.src === props.imageDataUrl ? imageDimensions : null;
  const imageAspectRatio = loadedDimensions
    ? loadedDimensions.width / loadedDimensions.height
    : null;
  const previewAspectRatio = 16 / 9;
  const canAdjustHorizontal = imageAspectRatio !== null && imageAspectRatio > previewAspectRatio;
  const canAdjustVertical = imageAspectRatio !== null && imageAspectRatio < previewAspectRatio;

  const messageBanner = props.message && (
    <SettingNotice
      className={!hasImage ? "mt-3" : undefined}
      tone={props.message.tone === "error" ? "error" : "info"}
    >
      <span role={props.message.tone === "error" ? "alert" : "status"}>{props.message.text}</span>
    </SettingNotice>
  );

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
      <div>
        {fileInput}
        <button
          className="flex min-h-36 w-full flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-[var(--bm-border-strong)] bg-[var(--bm-surface-subtle)] p-5 text-sm transition-colors hover:border-[var(--bm-accent)] hover:bg-[var(--bm-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bili-blue/40"
          type="button"
          onClick={() => inputRef.current?.click()}
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--bm-border)] bg-[var(--bm-surface)] text-[var(--bm-accent)]">
            <ImagePlus aria-hidden="true" className="h-5 w-5" />
          </span>
          <span className="flex flex-col items-center gap-1">
            <span className="font-medium text-[var(--bm-text-primary)]">点击上传本地图片</span>
            <span className="text-xs font-normal text-[var(--bm-text-secondary)]">
              支持 PNG / JPG / WebP，会自动压缩至 1920px、2MB 以内
            </span>
          </span>
        </button>
        {messageBanner}
      </div>
    );
  }

  return (
    <div className="grid gap-5 sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]">
      {fileInput}
      <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-[var(--bm-border)] bg-[var(--bm-surface-subtle)] text-left">
        <span className="absolute left-2 top-2 z-10 rounded border border-white/15 bg-slate-950/55 px-2 py-0.5 text-[11px] font-medium text-white shadow-sm">
          预览
        </span>
        <img
          alt=""
          className="h-full w-full object-cover"
          src={props.imageDataUrl ?? undefined}
          style={{
            objectPosition: `${props.background.positionX}% ${props.background.positionY}%`,
          }}
          onLoad={event => {
            const image = event.currentTarget;
            setImageDimensions({
              src: image.currentSrc,
              width: image.naturalWidth,
              height: image.naturalHeight,
            });
          }}
        />
        <span
          className="pointer-events-none absolute inset-0 bg-white dark:bg-slate-950"
          style={{ opacity: props.background.maskOpacity }}
        />
      </div>

      <div className="min-w-0 space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="bm-text-label block text-sm font-medium">启用自定义背景</span>
            <span className="bm-text-muted mt-0.5 block text-xs">在 B 站主要页面显示这张壁纸</span>
          </div>
          <SwitchButton
            ariaLabel={props.background.enabled ? "关闭自定义背景" : "启用自定义背景"}
            checked={props.background.enabled}
            onChange={enabled => props.onChange({ enabled })}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            icon={<Upload className="h-4 w-4" />}
            variant="secondary"
            onClick={() => inputRef.current?.click()}
          >
            更换图片
          </Button>
          <Button icon={<Trash2 className="h-4 w-4" />} variant="danger" onClick={props.onClear}>
            移除图片
          </Button>
        </div>

        <label className="block min-w-0">
          <span className="bm-text-muted mb-1.5 flex items-center justify-between text-xs font-medium">
            <span>背景遮罩浓度</span>
            <span className="tabular-nums">{maskOpacityPercent}%</span>
          </span>
          <input
            className="bm-range w-full"
            max="1"
            min="0"
            step="0.01"
            style={maskOpacityStyle}
            type="range"
            value={props.background.maskOpacity.toString()}
            onChange={event =>
              props.onChange(
                { maskOpacity: clamp(Number(event.target.value), 0, 1) },
                { debounce: true },
              )
            }
          />
          <span className="mt-1 block text-[11px] text-[var(--bm-text-tertiary)]">
            向右拖动遮罩更浓，页面文字会更清楚（0% 为原图）
          </span>
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block min-w-0">
            <span className="bm-text-muted mb-1.5 flex items-center justify-between text-xs font-medium">
              <span>左右裁切位置</span>
              <span className="tabular-nums">
                {canAdjustHorizontal ? `${props.background.positionX}%` : "无需调整"}
              </span>
            </span>
            <input
              className="bm-range w-full"
              disabled={!canAdjustHorizontal}
              max="100"
              min="0"
              step="1"
              style={rangeXStyle}
              type="range"
              value={props.background.positionX.toString()}
              onChange={event =>
                props.onChange({ positionX: Number(event.target.value) }, { debounce: true })
              }
            />
          </label>
          <label className="block min-w-0">
            <span className="bm-text-muted mb-1.5 flex items-center justify-between text-xs font-medium">
              <span>上下裁切位置</span>
              <span className="tabular-nums">
                {canAdjustVertical ? `${props.background.positionY}%` : "无需调整"}
              </span>
            </span>
            <input
              className="bm-range w-full"
              disabled={!canAdjustVertical}
              max="100"
              min="0"
              step="1"
              style={rangeYStyle}
              type="range"
              value={props.background.positionY.toString()}
              onChange={event =>
                props.onChange({ positionY: Number(event.target.value) }, { debounce: true })
              }
            />
          </label>
        </div>
        {loadedDimensions && !canAdjustHorizontal && !canAdjustVertical && (
          <p className="text-[11px] text-[var(--bm-text-tertiary)]">
            当前图片刚好是 16:9 比例，无需调整裁切位置
          </p>
        )}

        {messageBanner}
      </div>
    </div>
  );
}
