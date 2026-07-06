import type { CSSProperties } from "react";
import { clamp } from "../shared/number";

export { clamp } from "../shared/number";

// 规则编辑器和导入兼容共用的拆分逻辑：底层存储仍是 `|` 拼接字符串，UI 层展示为列表。
export function splitRules(value: string) {
  return value
    .split("|")
    .map(rule => rule.trim())
    .filter(Boolean);
}

export function formatDateForFile(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function toRatePercent(rate: number) {
  return Number(clamp(rate * 100, 0, 1).toFixed(2));
}

export function fromRatePercent(value: string) {
  return clamp(Number(value), 0, 1) / 100;
}

// 自定义 range 通过 CSS 变量渲染已选进度，统一生成可直接绑定到 style 的对象。
export function getRangeProgressStyle(progressPercent: number) {
  return {
    "--bm-range-progress": `${clamp(progressPercent, 0, 100)}%`,
  } as CSSProperties;
}

// 将用户上传图片压缩为 storage 友好的 JPEG data URL，并在过大时提前失败给 UI 提示。
export async function createBackgroundDataUrl(file: File) {
  if (!file.type.startsWith("image/")) throw new Error("请选择图片文件");

  const bitmap = await createImageBitmap(file);
  const maxSize = 1920;
  const ratio = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * ratio));
  const height = Math.max(1, Math.round(bitmap.height * ratio));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    throw new Error("无法处理图片");
  }

  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
  if (dataUrl.length > 4_500_000) throw new Error("图片过大，请换一张更小的图");
  return dataUrl;
}
